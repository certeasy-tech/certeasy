---
sidebar_position: 3
title: Migrations
---

# Migrations

Certeasy manages its database schema automatically. There is nothing to run manually.

## How It Works

Migrations are **embedded in the binary** as Go code. At every startup, Certeasy:

1. Connects to the configured database
2. Checks the current schema version
3. Applies any pending migrations in order
4. Proceeds to start

If the schema is already up to date, startup proceeds immediately with no changes.

## Supported Databases

Migrations are implemented for all three supported drivers:

| Driver | Notes |
|---|---|
| SQLite | Default. File-based, no external setup. |
| PostgreSQL | Uses PostgreSQL-specific DDL where applicable. |
| SQL Server | Uses T-SQL DDL. |

Each driver has its own migration set — Certeasy does not use a generic SQL abstraction layer.

## No Downtime Migrations

Migrations are additive by design (new columns, new tables, new indexes). They do not drop or rename existing columns, so upgrading Certeasy does not require a maintenance window in most cases.

## Manual Intervention

You should never need to run SQL manually. If a migration fails at startup, Certeasy logs the error and exits. The error message identifies the failing migration.

If you need to inspect the schema, use the standard tools for your database driver:

```bash
# SQLite
sqlite3 /var/lib/certeasy/db.sqlite ".schema"

# PostgreSQL
psql -U certeasy -d certeasy -c "\d"

# SQL Server
sqlcmd -S sqlserver01 -d certeasy -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES"
```

## Backup Before Upgrade

Before upgrading Certeasy to a new version, back up your database:

```bash
# SQLite
cp /var/lib/certeasy/db.sqlite /var/lib/certeasy/db.sqlite.bak

# PostgreSQL
pg_dump -U certeasy certeasy > certeasy_backup.sql
```
