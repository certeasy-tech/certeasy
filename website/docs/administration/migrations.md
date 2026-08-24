---
sidebar_position: 3
title: Migrations
---

# Migrations

Hortval carries its database schema inside the binary. There are no SQL files to
deploy alongside it.

A **restart** applies only the migrations that adding nothing back could have
survived — a new table, a new column with a default, a new non-unique index.
Anything heavier waits for you to run `hortval migrate`. A restart is rarely
something a human decided: a crash, a reboot or a failed health check all restart
the process, and none of them is a moment when someone is standing by with a
backup.

:::info No breaking migration has shipped yet
Every migration in Hortval to date is additive, on all three drivers. A restart
applies them, and the refusal described below is not something you will meet on
an upgrade today. It exists so that the first non-additive change — whenever it
comes — cannot land as a side effect of a process restarting.
:::

## Upgrading

Replace the binary and start Hortval. In the common case it applies what is
missing and starts.

If it refuses, the message names what is pending:

```
REFUSED: 1 of the 3 pending migration(s) cannot be undone by doing nothing.

Back up the database first:
  hortval backup create -f <config> --output <file>   (SQLite)
  your DBA's procedure                                 (PostgreSQL / SQL Server)
```

Back up first. On SQLite, Hortval ships the command — it snapshots the database
and runs an integrity check on the result:

```bash
hortval backup create -f /etc/hortval/config.yml --output /backup/hortval.sqlite
```

On PostgreSQL and SQL Server, use your DBA's procedure (`pg_dump`, a native
backup). See [Backup](./backup.md).

Then migrate:

```bash
hortval migrate -f /etc/hortval/config.yml --confirm
```

`--confirm` is your acknowledgement that a backup exists. It is required only for
a change a restart may not apply.

`hortval backup create` keeps working while startup is refusing — it is the
remedy the refusal points at, so it has to work on a database Hortval will not
start on, and it never changes the schema.

## Versions and support

**Your ACME clients never change.** The interface between them and Hortval is
RFC 8555, not our API. certbot, acme.sh, lego, Caddy and Traefik are unaffected
by any Hortval version: an upgrade touches the server, never the fleet that talks
to it. That is the reason everything below is affordable.

**From 1.0.0 onward, no release asks you to edit your configuration.** The
schema does keep evolving — a new capability usually needs a new table or column
— but **that is not a break**: nothing you wrote stops working, and no client of
yours is reconfigured.

Additive changes apply on restart. Anything heavier waits for `hortval migrate`,
which is to say for a moment when you are present and holding a backup. That is
not a constraint we impose; it is the moment you would have chosen anyway, and
the gate exists so a restart nobody decided cannot pick it for you.

A minor adds capability, a patch fixes. Either way the upgrade is the same three
steps: back up, replace the binary, restart.

Each minor is supported for **twelve months**. Security fixes ship in the current
release, and upgrading is how you receive them. If we do introduce a breaking
change, the fix is **backported** to the minors still inside their twelve months:
the backport is the price of our own break, not a service you have to ask for.

**Before 1.0.0 — that is, today — the 0.9.x series still asks you to edit your
configuration.** v0.9.4 and v0.9.5 carry fourteen breaking changes between them,
and it is worth naming what they are: **every one of them is configuration.**

- **None touches the ACME protocol.** No client was ever reconfigured.
- **None touches the schema.** Every migration shipped to date is additive.
- **None invalidates a certificate.**

Most are refused **at startup**, with the line to write printed for you — v0.9.5
sums its own up as *"a value that was guessed is now demanded, and each refusal
prints what to write"*. The few exceptions are operational rather than syntactic:
external rotation of the audit file was withdrawn, and `logs.file` and
`audit.path` became naming bases rather than file names.

So what stops at 1.0.0 is not "breaking your system" but **"asking you to edit
your configuration again"**. Every [changelog](../changelog/) entry until then
carries its own "Breaking changes" section and an upgrade guide.

## `hortval migrate`

```bash
hortval migrate [-f <config>] [--confirm] [--sql]
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
hortval migrate -f /etc/hortval/config.yml --sql > schema.sql
```

Progress goes to standard error, so the file runs as-is. Apply it **whole** — it
carries the bookkeeping rows Hortval reads to know what has run. Statements are
numbered in comments, so a client's "error at statement 12" points somewhere.

## When startup refuses

| Situation | What to do |
|---|---|
| A breaking migration is pending | back up, then `hortval migrate --confirm` |
| The database is **newer** than the binary | run a newer Hortval, or restore a backup taken before the upgrade |
| Ahead on one module, behind on another — a failed upgrade followed by a rollback | restore, or move to the latest release, which carries every version involved |
| A migration that already ran no longer matches this binary | run the build that produced this database, or restore a backup |

A fresh install is exempt: creating a schema from nothing has nothing to gate.

## Databases where Hortval may not issue DDL

For accounts that hold no schema rights:

```yaml
database:
  driver: sqlserver
  dsn: "sqlserver://hortval:secret@sqlserver01:1433?database=hortval"
  noddl: true
```

Hortval then emits no DDL. It checks the schema at startup and refuses to run if
anything is missing; `hortval migrate` writes the script for your DBA instead of
applying it.

The account still needs to **read** the catalog. That is what distinguishes "the
schema is missing" from "I am not allowed to look" — without it you would be told
to rebuild a schema that already exists.

## Choosing the schema

Hortval writes to the schema its database account resolves to, and says which
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
  dsn: "postgres://hortval:secret@db01:5432/shared?options=-csearch_path%3Dhortval"
```

On SQL Server the schema comes from the database user, not the connection string:

```sql
ALTER USER hortval WITH DEFAULT_SCHEMA = hortval;
```

Hortval also names, at start-up, any of its tables that are not in the schema it
writes to — possible on a database migrated by a much older release inside a
shared schema. The message gives both possible causes, because their remedies are
opposite: moving the tables is right when they are an earlier install of *this*
instance, and takes another application's tables away when they are not.

## If a migration fails

Hortval logs the failing module and statement, then stops; the schema may be
partially migrated. Restore the backup taken before the run, or fix the cause and
run `hortval migrate` again — what already applied is skipped.

See [Schema Reference](./schema.md) for what the tables hold.
