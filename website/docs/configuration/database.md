---
sidebar_position: 2
title: Database
---

# Database

Hortval stores all ACME state (accounts, orders, challenges, certificates, audit logs) in a relational database.

## Supported Drivers

| Driver | Key | Notes                                                                                               |
|---|---|-----------------------------------------------------------------------------------------------------|
| SQLite | `sqlite` | Default. No setup required. Recommended for single-node deployments. Do not supports multiple nodes |
| PostgreSQL | `postgres` | Recommended for multi node deploymnent.                                                             |
| SQL Server | `sqlserver` | For environments standardized on Microsoft SQL Server.                                              |

## Configuration

```yaml
database:
  driver: postgres
  dsn: "postgres://hortval:secret@db01:5432/hortval?sslmode=require"
  ping-timeout-sec: 5
  max-idle-conn: 5
  max-conn: 10
  conn-max-lifetime: 2m
  conn-max-idle-time: 1m
```

### SQLite (default)

If `database` is omitted entirely, Hortval uses SQLite at `%WORKDIR%/db.sqlite`.

```yaml
# Explicit SQLite config
database:
  driver: sqlite
  path: "C:\\ProgramData\\hortval\\db.sqlite"
```

### PostgreSQL

```yaml
database:
  driver: postgres
  dsn: "postgres://hortval:secret@db01:5432/hortval?sslmode=require"
```

### SQL Server

```yaml
database:
  driver: sqlserver
  dsn: "sqlserver://hortval:secret@sqlserver01:1433?database=hortval"
```

#### Windows integrated authentication

On Windows, Hortval can connect as the account it runs under, so no SQL password
appears in the configuration file. Add `authenticator=winsspi` and drop the
credentials:

```yaml
database:
  driver: sqlserver
  dsn: "sqlserver://sqlserver01:1433?database=hortval&authenticator=winsspi"
```

The identity used is the **account of the Hortval process**, so it is the one
that needs a SQL Server login and permissions on the database. A domain account
or a group Managed Service Account (gMSA) — see
[Installation](../getting-started/installation.md#windows-service) for the account
model.

:::caution `LocalSystem` presents itself as the machine account
A service created with `sc.exe` and no `obj=` runs as `LocalSystem`, which
authenticates to SQL Server as `DOMAIN\MACHINE$`. Grant that, and every service
on the host inherits database access. Give Hortval its own account.
:::

Windows only — the provider is compiled into the Windows binary alone. Linux and
macOS builds use username and password.

#### Check that it is really Kerberos

An integrated connection can fall back to **NTLM with no error at all**: it
connects, and everything appears to work.

Hortval therefore reports the method it obtained, once, at startup:

```
INFO  SQL Server: integrated authentication  account=DOMAIN\svc-hortval auth_scheme=KERBEROS
WARN  SQL Server: the connection fell back to NTLM because no Service Principal Name …
```

If the account cannot read `sys.dm_exec_connections`, Hortval says that too
rather than staying silent — an absent line would be ambiguous.

To check independently, or from a DBA session, run this against the instance as
the account Hortval runs under:

```sql
SELECT SUSER_SNAME(), auth_scheme
FROM sys.dm_exec_connections
WHERE session_id = @@SPID;
```

`KERBEROS`, together with the expected account name, is the answer you want.

`NTLM` means the connection is integrated but no **Service Principal Name** is
registered. It works — and it will keep working, until the day your domain
restricts NTLM. Hortval then stops connecting, and the outage looks like a
Hortval problem rather than what it is: a dependency that was there from the
first day and that nothing ever reported. NTLM is also relayable where Kerberos
is not, and the account Hortval uses holds schema and write rights on your
certificate store.

Either way the SQL password is out of `config.yml` — that part of the benefit
does not depend on which one you got.

The SPN belongs to the account the **SQL Server service** runs under, which is
the machine account when that service runs as `LocalSystem` or `NetworkService`:

```powershell
setspn -S MSSQLSvc/sqlserver01.example.com:1433 EXAMPLE\SQLSERVER01$
setspn -S MSSQLSvc/sqlserver01:1433             EXAMPLE\SQLSERVER01$
```

If `setspn` cannot bind to a domain controller — some hardened domains reject
its LDAP bind — the ActiveDirectory module writes the same attribute over ADWS:

```powershell
Set-ADComputer -Identity SQLSERVER01 -ServicePrincipalNames @{
    Add = 'MSSQLSvc/sqlserver01.example.com:1433', 'MSSQLSvc/sqlserver01:1433'
}
```

An SPN carries a **port**. One registered for a port the instance does not
listen on matches nothing, and the connection quietly falls back to NTLM — so
fix the port the instance listens on first, register the SPN second.

:::note A local connection never proves anything
Connecting from the machine that hosts SQL Server goes over shared memory or
named pipes, and reports `NTLM` even when everything is configured correctly.
Run the check from another host — which is also how Hortval will connect.
:::

## Fields

| Field | Default | Description |
|---|---|---|
| `driver` | `sqlite` | Database driver: `sqlite`, `postgres`, `sqlserver` |
| `dsn` | — | Connection string (PostgreSQL and SQL Server) |
| `path` | `%WORKDIR%/db.sqlite` | File path (SQLite only) |
| `noddl` | `false` | The application account holds no schema rights. Hortval never issues DDL: it checks the schema at startup, refuses to run if anything is missing, and `hortval migrate` writes the SQL for your DBA instead of applying it. See [Migrations](../administration/migrations.md). |
| `ping-timeout-sec` | `10` | Timeout for the startup connectivity check |
| `max-idle-conn` | `2` (SQLite), `5` (others) | Maximum idle connections |
| `max-conn` | `10` | Maximum open connections |
| `conn-max-lifetime` | `2m` (PostgreSQL / SQL Server), unset for SQLite | Hard cap on a pooled connection's total lifetime. The default sits **strictly below** typical firewall / NAT idle timeouts (5–15 min) so the pool recycles **before** the network drops a stale connection — otherwise the next use surfaces as `Read: EOF`. `0` disables the cap. |
| `conn-max-idle-time` | `1m` (PostgreSQL / SQL Server), unset for SQLite | A connection idle in the pool longer than this is closed. Complements `conn-max-lifetime` for hosts that drop idle sockets aggressively. `0` disables. |

## Migrations

The schema travels inside the binary — no external SQL files. A restart applies
**additive** migrations on its own; anything that cannot be undone by doing
nothing waits for an explicit `hortval migrate`. See
[Migrations](../administration/migrations.md) for the full contract, the `--sql`
output, and the `noddl` mode.

## Schema

Hortval writes to the schema its database account resolves to, and says which
one at every start:

```
Database schema in use  schema=public
```

Two instances sharing a database **and a schema** share their data. That is a
valid multi-node deployment — and an accident that looks identical from the
database's side. For two separate installations, give each one a schema:

```yaml
# PostgreSQL: the default search path sends everyone to `public`
database:
  driver: postgres
  dsn: "postgres://hortval:secret@db01:5432/shared?options=-csearch_path%3Dhortval"
```

On SQL Server the schema comes from the database user, not the connection
string — use one user per installation, each with its own `DEFAULT_SCHEMA`.

## Schema Reference

See [Schema Reference](../administration/schema.md) for the full list of tables and their lifecycle.
