---
sidebar_position: 1
title: Logging
---

# Logging

Hortval uses structured logging with configurable level, format, output, and per-service overrides.

:::caution Startup lines go to stderr, not to `logs.file`
The configured destination is installed once the configuration has been read, so
the lines emitted before that point are written to **stderr** and never appear in
`logs.file`. When startup is *refused*, the log file is not created at all and
everything — the JSON line and the human-readable message — goes to stderr.

Keep stderr captured wherever Hortval runs. Under systemd it is routed to
journald by default, so nothing is lost, only split across two places. Under the
Windows Service Control Manager stderr is attached to nothing and those lines are
lost; see [Installation](../getting-started/installation.md) for what that means
today.
:::

## Configuration

```yaml
logs:
  level: info
  format: json
  output: file
  file: "C:\\ProgramData\\hortval\\logs\\hortval.log"
  rotate:
    max-size-mb: 100
    max-backups: 10
  services:
    DB-Driver: warn
    acme-server: debug
  tags:
    instance: cert-srv-01
    region: eu-west
```

## Fields

| Field | Default | Description |
|---|---|---|
| `level` | `info` | Global log level: `debug`, `info`, `warn`, `error`, `off`. `off` (alias `none`) fully suppresses logs and is most useful as a per-service override. |
| `format` | `json` | Log format: `json` or `text` |
| `output` | `stderr` | Output destination: `stderr`, `stdout`, or `file` |
| `file` | — | Log file path. Required if `output: file`. With rotation enabled it is a **naming base**, not a file — see [Rotation](#rotation). |
| `rotate.max-size-mb` | `0` | Size at which a new segment is started. `0` disables rotation: a single file grows indefinitely. |
| `rotate.max-backups` | `5` | Number of **closed** segments kept. `0` keeps only the one being written; `-1` never deletes. |
| `services` | empty | Per-service log level overrides |
| `tags` | empty | User-defined labels added to every log entry — useful for Grafana/Loki filtering |

## Rotation

When `output: file` and `rotate.max-size-mb` is greater than zero, `file` is a
**naming base**, not a file. Hortval writes dated segments beside it and never
renames them:

```
file: C:\ProgramData\hortval\logs\hortval.log

C:\ProgramData\hortval\logs\
    hortval.20260726T091702Z.ms123.log     <- closed
    hortval.20260726T104417Z.ms008.log     <- being written
```

The suffix is a UTC timestamp, so the alphabetical order of the file names is
their chronological order. A closed segment is never reopened, which is what
makes it safe to copy or archive.

**Configure your log collector with the folder and a `*.log` pattern**, not with
the path in `file`. To follow the live file interactively:

```powershell
Get-Content -Wait (Get-ChildItem C:\ProgramData\hortval\logs\hortval.*.log |
    Sort-Object Name | Select-Object -Last 1)
```

If a rotation cannot complete — an antivirus holding the file, a full disk, a
permissions problem — Hortval keeps writing to the current segment, reports the
reason on stderr (captured by the Windows service manager), and retries later.
Nothing is lost.

`max-backups` bounds disk usage at roughly `max-backups × max-size-mb`. It
defaults to **5**; before v0.9.4 it defaulted to `0`, which meant "keep nothing",
so enabling rotation silently discarded the log at each rotation.

:::note Permissions
On Windows, access to the log files is governed by the **NTFS permissions
inherited from the containing folder** — set that folder's ACL at install time.
On Linux and macOS, files are created `0600` and the directory `0700`, so a
collector running under its own account cannot read them without being granted
access out of band.
:::

## Per-Service Log Levels

You can set a different log level for each internal service. This is useful for debugging a specific component without flooding logs with debug output from everything else.

```yaml
logs:
  level: info
  services:
    acme-server: debug
    Async-Acme-Challenges: debug
```

Use `off` (or `none`) to fully silence a service — for example when a chatty driver is generating noise during dev or staging captures:

```yaml
logs:
  services:
    DB-Driver: off
    acme-server: warn
```

### Registered Service Names

:::caution An unrecognised name stops startup
Only the names below are accepted. Anything else — a typo, or a name from a
release before 0.9.5 — is refused at startup and by `hortval validate`, with the
accepted list in the message.

Until 0.9.5 it was silently ignored: the level fell back to the global default
and nothing said so, which is the worst way for a diagnostic setting to fail.
Two names changed in 0.9.5 and have **no alias** — `Certeasy-acme-server` became
`acme-server`, `cert-easy-main` became `main`.
:::

| Service Name | Description |
|---|---|
| `DB-Driver` | Database driver and query logs |
| `acme-server` | ACME HTTP request handling |
| `Async-Acme-Pki-Handler` | Async PKI job processing |
| `Async-Acme-Challenges` | Async challenge validation |
| `JWKS` | JWS key validation |
| `worker` | Job engine (lease, dispatch, backoff) |
| `http-server` | HTTP server lifecycle |
| `adcs-native` | ADCS authority operations — native in-process connector (default) |
| `adcs-cli` | ADCS authority operations — `certreq.exe` connector (`adcs-cli`) |
| `license` | License lifecycle (install, refresh, enforcement) |
| `node` | Node identity (`server_id`, servers table) |
| `main` | Startup and shutdown: configuration, working directory, schema gate |
| `audit` | Tamper-evident audit log (open, rotate, chain recovery) |
| `fakepki` | Built-in test PKI — CA generation and issuance |

The list is exhaustive as of 0.9.5, and it has to be: a name absent from it is
refused. It is kept in step with the code by a test that scans every service
registration in the codebase, so it cannot quietly fall behind.

## Tags (Grafana/Loki labels)

`logs.tags` is a free-form map of `key: value` pairs added to **every** log entry. Use it to attach environment metadata that your log aggregator (Grafana/Loki, Splunk, Elastic…) can filter on.

```yaml
logs:
  tags:
    instance: cert-srv-01
    region: eu-west
    role: production
```

Each entry shows up as a top-level field in the JSON output, alongside `time`, `level`, `msg`, etc. There is no fixed list of allowed keys — pick whatever your stack expects.

:::note
The previous automatic `env` field is no longer added to log entries; it conflicted with the `env=` shown inside license-related log messages (license environment, e.g. `env=dev` / `env=prod`). If you want an environment label, set it explicitly under `tags`.
:::

## Log Rotation

Log rotation is supported when `output: file`. Configure `rotate` to limit disk usage:

```yaml
logs:
  output: file
  file: "C:\\ProgramData\\hortval\\hortval.log"
  rotate:
    max-size-mb: 100
    max-backups: 5
```

This keeps up to 5 rotated files of 100 MB each (500 MB total).

## Production Recommendations

- Use `format: json` for structured log ingestion (Splunk, Elastic, Loki…)
- Use `output: file` with rotation to avoid filling disk
- Keep global level at `info` and only set `debug` on specific services when troubleshooting
- Route logs to your SIEM — the audit log entries contain account IDs, order IDs, and operation details
