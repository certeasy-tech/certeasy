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
| `ping-timeout-sec` | `10` | Timeout for the startup connectivity check |
| `max-idle-conn` | `2` (SQLite), `5` (others) | Maximum idle connections |
| `max-conn` | `10` | Maximum open connections |

## Migrations

Certeasy runs database migrations automatically at startup. Migrations are embedded in the binary — no external SQL files are needed. If the schema is already up to date, startup proceeds immediately.

## Schema Reference

See [Schema Reference](/administration/schema) for the full list of tables and their lifecycle.
