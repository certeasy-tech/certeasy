---
sidebar_position: 2
title: Database
---

# Database

Certeasy stores all ACME state (accounts, orders, challenges, certificates, audit logs) in a relational database.

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
  dsn: "postgres://certeasy:secret@db01:5432/certeasy?sslmode=require"
  ping-timeout-sec: 5
  max-idle-conn: 5
  max-conn: 10
  conn-max-lifetime: 2m
  conn-max-idle-time: 1m
```

### SQLite (default)

If `database` is omitted entirely, Certeasy uses SQLite at `%WORKDIR%/db.sqlite`.

```yaml
# Explicit SQLite config
database:
  driver: sqlite
  path: "C:\\ProgramData\\certeasy\\db.sqlite"
```

### PostgreSQL

```yaml
database:
  driver: postgres
  dsn: "postgres://certeasy:secret@db01:5432/certeasy?sslmode=require"
```

### SQL Server

```yaml
database:
  driver: sqlserver
  dsn: "sqlserver://certeasy:secret@sqlserver01:1433?database=certeasy"
```

## Fields

| Field | Default | Description |
|---|---|---|
| `driver` | `sqlite` | Database driver: `sqlite`, `postgres`, `sqlserver` |
| `dsn` | — | Connection string (PostgreSQL and SQL Server) |
| `path` | `%WORKDIR%/db.sqlite` | File path (SQLite only) |
| `noddl` | `false` | The application account holds no schema rights. Certeasy never issues DDL: it checks the schema at startup, refuses to run if anything is missing, and `certeasy migrate` writes the SQL for your DBA instead of applying it. See [Migrations](../administration/migrations.md). |
| `ping-timeout-sec` | `10` | Timeout for the startup connectivity check |
| `max-idle-conn` | `2` (SQLite), `5` (others) | Maximum idle connections |
| `max-conn` | `10` | Maximum open connections |
| `conn-max-lifetime` | `2m` (PostgreSQL / SQL Server), unset for SQLite | Hard cap on a pooled connection's total lifetime. The default sits **strictly below** typical firewall / NAT idle timeouts (5–15 min) so the pool recycles **before** the network drops a stale connection — otherwise the next use surfaces as `Read: EOF`. `0` disables the cap. |
| `conn-max-idle-time` | `1m` (PostgreSQL / SQL Server), unset for SQLite | A connection idle in the pool longer than this is closed. Complements `conn-max-lifetime` for hosts that drop idle sockets aggressively. `0` disables. |

## Migrations

The schema travels inside the binary — no external SQL files. A restart applies
**additive** migrations on its own; anything that cannot be undone by doing
nothing waits for an explicit `certeasy migrate`. See
[Migrations](../administration/migrations.md) for the full contract, the `--sql`
output, and the `noddl` mode.

## Schema

Certeasy writes to the schema its database account resolves to, and says which
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
  dsn: "postgres://certeasy:secret@db01:5432/shared?options=-csearch_path%3Dcerteasy"
```

On SQL Server the schema comes from the database user, not the connection
string — use one user per installation, each with its own `DEFAULT_SCHEMA`.

## Schema Reference

See [Schema Reference](../administration/schema.md) for the full list of tables and their lifecycle.
