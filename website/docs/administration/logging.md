---
sidebar_position: 1
title: Logging
---

# Logging

Certeasy uses structured logging with configurable level, format, output, and per-service overrides.

## Configuration

```yaml
logs:
  level: info
  format: json
  output: file
  file: "/var/log/certeasy/certeasy.log"
  rotate:
    max-size-mb: 100
    max-backups: 10
  services:
    DB-Driver: warn
    Certeasy-acme-server: debug
```

## Fields

| Field | Default | Description |
|---|---|---|
| `level` | `info` | Global log level: `debug`, `info`, `warn`, `error` |
| `format` | `json` | Log format: `json` or `text` |
| `output` | `stderr` | Output destination: `stderr`, `stdout`, or `file` |
| `file` | — | Log file path. Required if `output: file`. |
| `rotate.max-size-mb` | — | Max log file size in MB before rotation |
| `rotate.max-backups` | — | Number of rotated log files to keep |
| `services` | `{}` | Per-service log level overrides |

## Per-Service Log Levels

You can set a different log level for each internal service. This is useful for debugging a specific component without flooding logs with debug output from everything else.

```yaml
logs:
  level: info
  services:
    Certeasy-acme-server: debug
    Async-Acme-Challenges: debug
```

### Registered Service Names

| Service Name | Description |
|---|---|
| `DB-Driver` | Database driver and query logs |
| `adcs` | ADCS authority operations |
| `Certeasy-acme-server` | ACME HTTP request handling |
| `Async-Acme-Pki-Handler` | Async PKI job processing |
| `Async-Acme-Challenges` | Async challenge validation |
| `JWKS` | JWS key validation |
| `worker` | Job engine (lease, dispatch, backoff) |
| `http-server` | HTTP server lifecycle |

## Log Rotation

Log rotation is supported when `output: file`. Configure `rotate` to limit disk usage:

```yaml
logs:
  output: file
  file: "C:\\ProgramData\\certeasy\\certeasy.log"
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
