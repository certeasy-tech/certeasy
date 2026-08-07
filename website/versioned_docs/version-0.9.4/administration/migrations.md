---
sidebar_position: 3
title: Migrations
---

# Migrations

Certeasy carries its database schema inside the binary. There are no SQL files to
deploy alongside it.

A **restart** applies only the migrations that adding nothing back could have
survived — a new table, a new column with a default, a new non-unique index.
Anything heavier waits for you to run `certeasy migrate`. A restart is rarely
something a human decided: a crash, a reboot or a failed health check all restart
the process, and none of them is a moment when someone is standing by with a
backup.

:::info No breaking migration has shipped yet
Every migration in Certeasy to date is additive, on all three drivers. A restart
applies them, and the refusal described below is not something you will meet on
an upgrade today. It exists so that the first non-additive change — whenever it
comes — cannot land as a side effect of a process restarting.
:::

## Upgrading

Replace the binary and start Certeasy. In the common case it applies what is
missing and starts.

If it refuses, the message names what is pending:

```
REFUSED: 1 of the 3 pending migration(s) cannot be undone by doing nothing.

Back up the database first:
  certeasy backup create -f <config> --output <file>   (SQLite)
  your DBA's procedure                                 (PostgreSQL / SQL Server)
```

Back up first. On SQLite, Certeasy ships the command — it snapshots the database
and runs an integrity check on the result:

```bash
certeasy backup create -f /etc/certeasy/config.yml --output /backup/certeasy.sqlite
```

On PostgreSQL and SQL Server, use your DBA's procedure (`pg_dump`, a native
backup). See [Backup](./backup.md).

Then migrate:

```bash
certeasy migrate -f /etc/certeasy/config.yml --confirm
```

`--confirm` is your acknowledgement that a backup exists. It is required only for
a change a restart may not apply.

`certeasy backup create` keeps working while startup is refusing — it is the
remedy the refusal points at, so it has to work on a database Certeasy will not
start on, and it never changes the schema.

## `certeasy migrate`

```bash
certeasy migrate [-f <config>] [--confirm] [--sql]
```

| Flag | Effect |
|---|---|
| `--confirm` | Acknowledges a backup. Required only for a breaking migration. |
| `--sql` | Writes the SQL to standard output and applies **nothing**. |

| Exit | Meaning |
|---|---|
| `0` | Applied, or nothing to do |
| `1` | Failed — the schema may be partially migrated |
| `2` | Bad invocation |
| `3` | Refused: a breaking migration is pending and `--confirm` was not given |

Exit `3` is distinct so a deployment script can tell a failure from a missing
confirmation.

Each migration runs in its own transaction: an interrupted run leaves a coherent
prefix and re-running resumes where it stopped.

**`--sql`** is for reviewing an upgrade, or handing it to a DBA:

```bash
certeasy migrate -f /etc/certeasy/config.yml --sql > schema.sql
```

Progress goes to standard error, so the file runs as-is. Apply it **whole** — it
carries the bookkeeping rows Certeasy reads to know what has run. Statements are
numbered in comments, so a client's "error at statement 12" points somewhere.

## When startup refuses

| Situation | What to do |
|---|---|
| A breaking migration is pending | back up, then `certeasy migrate --confirm` |
| The database is **newer** than the binary | run a newer Certeasy, or restore a backup taken before the upgrade |
| Ahead on one module, behind on another — a failed upgrade followed by a rollback | restore, or move to the latest release, which carries every version involved |
| A migration that already ran no longer matches this binary | run the build that produced this database, or restore a backup |

A fresh install is exempt: creating a schema from nothing has nothing to gate.

## Databases where Certeasy may not issue DDL

For accounts that hold no schema rights:

```yaml
database:
  driver: sqlserver
  dsn: "sqlserver://certeasy:secret@sqlserver01:1433?database=certeasy"
  noddl: true
```

Certeasy then emits no DDL. It checks the schema at startup and refuses to run if
anything is missing; `certeasy migrate` writes the script for your DBA instead of
applying it.

The account still needs to **read** the catalog. That is what distinguishes "the
schema is missing" from "I am not allowed to look" — without it you would be told
to rebuild a schema that already exists.

## Choosing the schema

Certeasy writes to the schema its database account resolves to, and says which
one at every start:

```
Database schema in use  schema=public
```

Two instances pointed at the same database **and the same schema** share their
data. That is a valid multi-node deployment, and an accident that looks identical
from the database's side. For two separate installations, give each one a schema:

```yaml
# PostgreSQL — the default search path sends every installation to `public`
database:
  driver: postgres
  dsn: "postgres://certeasy:secret@db01:5432/shared?options=-csearch_path%3Dcerteasy"
```

On SQL Server the schema comes from the database user, not the connection string:

```sql
ALTER USER certeasy WITH DEFAULT_SCHEMA = certeasy;
```

Certeasy also names, at start-up, any of its tables that are not in the schema it
writes to — possible on a database migrated by a much older release inside a
shared schema. The message gives both possible causes, because their remedies are
opposite: moving the tables is right when they are an earlier install of *this*
instance, and takes another application's tables away when they are not.

## If a migration fails

Certeasy logs the failing module and statement, then stops; the schema may be
partially migrated. Restore the backup taken before the run, or fix the cause and
run `certeasy migrate` again — what already applied is skipped.

See [Schema Reference](./schema.md) for what the tables hold.
