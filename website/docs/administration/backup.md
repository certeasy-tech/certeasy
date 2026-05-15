---
sidebar_position: 4
title: Backup & restore
---

# Backup &amp; restore

Certeasy stores all persistent state in a single database plus a small set of
files in the workdir. This page covers SQLite, the default driver. Postgres
and SQL Server users should follow their standard DBA tooling — see the
[Other databases](#other-databases) section.

## What to back up

| Path | Contents | Backup method |
|---|---|---|
| `db.sqlite` (+ `-wal`, `-shm`) | Default SQLite database | `certeasy backup create` (NOT raw copy) |
| `<workdir>/server-certificate-cache/` | Certmanager TLS bundles for the ACME endpoint | File copy |
| `<workdir>/fakepki/` | Fake PKI CA + key (only if running the fake authority) | File copy |
| `<audit.path>` (or `<workdir>/audit.log`) | Audit log (when enabled) | File copy |
| `config.yml` | Server configuration | File copy |
| Let&#39;s Encrypt cache | `tls-certificate-manager.lets-encrypt.cache-dir`, may be outside workdir | File copy if configured |

The `<workdir>/adcs/` directory is **transient** (CSRs and certutil scratch
files recreated on demand) and must not be in your backup set.

The DB file itself must never be copied raw with the server running: the
`-wal` and `-shm` companion files contain uncommitted writes and the result
is corrupt. Always use `certeasy backup create`, which calls SQLite&#39;s
`VACUUM INTO` to produce a self-contained snapshot.

## `certeasy backup create`

```
certeasy backup create -f <config> --output <path>
                       [--check none|quick|full]   (default: quick)
                       [--allow-incomplete]
```

The command:

1. Loads the same config as the running server.
2. Runs the integrity check selected by `--check`.
3. If the check fails and `--allow-incomplete` is not set: exits non-zero
   without producing a file.
4. If the check fails and `--allow-incomplete` is set: prints a warning,
   produces the backup, and exits with code `2` (distinguishes from a clean
   success).
5. Runs `VACUUM INTO` against the destination path. SQLite refuses to
   overwrite an existing destination — pick a fresh filename.

### Choosing `--check`

| Level | SQL | Catches | Cost |
|---|---|---|---|
| `none` | (skip) | nothing | ~0 |
| `quick` | `PRAGMA quick_check` | B-tree, page, header corruption (~95% of issues) | 30–50% of full |
| `full` | `PRAGMA integrity_check` | + cross-checks indexes/data, FK validity | seconds on a nominal DB |

**No hard write-lock during the check.** In WAL mode an integrity check is a
read transaction — writers continue working. The actual cost is *WAL
pressure*: the checkpoint is deferred while the check runs, so the `-wal`
file grows, marginally slowing writes after several hundred MB. Negligible
for a nominal Certeasy database.

Recommended cadence:

- `quick` every 4 hours during business hours
- `full` once a day (typically overnight)
- `none` only when paired with `backup verify` run asynchronously on the
  produced file

### `--allow-incomplete`

Use this when a database is degrading and you want a snapshot for forensic
purposes even if integrity checks fail. The exit code `2` is the signal that
the backup exists but is suspect — your scheduled task should treat it as a
distinct outcome from `0` (clean success) and `1` (no backup produced).

## `certeasy backup verify`

```
certeasy backup verify --input <path>
                       [--check quick|full]   (default: full)
                       [--schema]
```

Runs against a backup file directly, without needing the server&#39;s config:

- Opens the file in read-only mode.
- Runs the integrity PRAGMA selected by `--check`.
- With `--schema`: also checks that the canonical Certeasy tables exist
  (catches "this is not a Certeasy DB" or partial backup).
- Exits `0` on success, non-zero with a message on stderr otherwise.

This enables a fast-backup pattern: run `backup create --check none` for
speed, then verify the produced file in the background:

```bash
certeasy backup create -f config.yml --output backup.sqlite --check none
certeasy backup verify --input backup.sqlite --check full --schema
```

## Procedure example (Windows Task Scheduler)

```bat
1. certeasy.exe backup create -f C:\certeasy\config.yml ^
                              --output D:\backups\db.sqlite
2. xcopy C:\certeasy\workdir\server-certificate-cache D:\backups\server-certificate-cache /E /I /Y
3. xcopy C:\certeasy\workdir\fakepki D:\backups\fakepki /E /I /Y
4. copy C:\certeasy\workdir\audit.log D:\backups\audit.log
5. copy C:\certeasy\config.yml D:\backups\config.yml
```

Steps 3–4 are conditional: skip step 3 if you are not using the fake PKI,
skip step 4 if no audit log is configured. If your Let&#39;s Encrypt cache is
outside the workdir, copy it too.

## Restore (manual procedure)

There is no `restore` subcommand in v1: the procedure is a few file moves.

1. Stop the service: `Stop-Service Certeasy`.
2. Move the failed `db.sqlite`, `db.sqlite-wal`, `db.sqlite-shm` aside (do
   **not** delete them yet).
3. Copy the backup&#39;s `db.sqlite` to the workdir.
4. **Delete any stale `-wal` and `-shm` files** at the destination — those
   from the failed instance are no longer consistent with the restored DB.
5. Restore `server-certificate-cache/` and (if applicable) `fakepki/` from
   the backup.
6. Restore `audit.log` to its configured path.
7. Start the service: `Start-Service Certeasy`.
8. Tail the startup logs to confirm the license, schema migrations, and
   first request all succeed.
9. (When implemented, ROADMAP #1) `certeasy audit verify` to confirm the
   audit log MAC chain.

## 3-2-1-1 baseline

A safe backup posture for a production Certeasy:

- **3** copies of the data
- on **2** different storage media
- with **1** copy offsite
- and **1** copy offline or immutable

A test restore on a regular cadence (quarterly minimum) is the only way to
prove your backup chain actually works. A backup that has never been
restored is a hope, not a backup.

## Other databases

### PostgreSQL

Out of scope for `certeasy backup`. Use standard PostgreSQL tooling:

- `pg_dump` for logical, point-in-time snapshots that are portable across
  PG versions.
- `pg_basebackup` plus WAL archiving for physical backups with PITR.

The workdir (certificate cache, fakepki, audit log, config) still needs the
file-copy procedure above; only step 1 changes.

### SQL Server

Out of scope for `certeasy backup`. Use standard SQL Server tooling:

- `BACKUP DATABASE` T-SQL with maintenance plans driven by SQL Server Agent.
- Full / differential / log backup chains depending on your RPO.

The workdir procedure is identical to SQLite.

## PII and retention

The Certeasy database and audit log contain potentially personal data
(account contact addresses, validation source IPs, user agents). Backups
are subject to the same data-protection obligations as the live data —
encrypt them at rest, restrict access, and apply a retention policy that
matches your compliance requirements.
