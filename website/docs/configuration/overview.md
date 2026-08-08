---
sidebar_position: 1
title: Overview
---

# Configuration Overview

Hortval is configured with a single YAML file. The parser is strict: unknown fields, malformed YAML, and missing required relationships all cause startup to fail with an explicit error.

## Top-Level Sections

| Section | Required | Description |
|---|---|---|
| [`server`](./server) | Yes | ACME HTTP server settings |
| [`tls-certificate-manager`](./tls) | Yes | TLS certificate for the ACME endpoint |
| [`dns-validation-profiles`](./dns-profiles) | Yes | DNS challenge validation settings |
| [`authorities`](./authorities) | Yes | ADCS or fake PKI backends |
| [`issuance-policies`](./issuance-policies) | Yes | Which names are allowed, key requirements |
| [`policy-bindings`](./policy-bindings) | Conditional | Links policies to authorities |
| [`database`](./database) | No | Database driver and connection settings |
| [`license`](./license) | No | Optional online license checks and auto-renew |
| [`logs`](../administration/logging) | No | Log level, format, output, per-service levels |
| [`workers`](./workers) | No | Async job engine tuning |
| [`rate-limiting`](./rate-limiting) | No | Per-IP, per-account, and duplicate-certificate rate limits |
| [`renewal-info`](./renewal-info) | No | ACME Renewal Information (RFC 9773) — suggested renewal window |
| [`audit`](../administration/audit) | No | Tamper-evident audit log (HMAC-chained JSONL) |
| `workdir` | No | Base directory for runtime files |

## Runtime Model

The configuration expresses a **policy pipeline**:

```
Incoming CSR
    │
    ▼
issuance-policy           ← selects allowed DNS scope and key requirements
    │
    ├── dns-validation-profile  ← controls how challenge DNS is resolved
    │
    └── policy-binding          ← selects which authority handles issuance
            │
            ▼
        authority               ← ADCS or fake PKI
```

At runtime:
1. An issuance policy is selected based on the requested identifiers and CSR
2. The policy's DNS validation profile is used to validate challenges
3. On finalize, the policy binding selects an authority (with failover or round-robin)
4. The authority submits the CSR to ADCS

## Implicit Defaults

Hortval avoids requiring explicit configuration for common cases:

- If `database` is omitted → SQLite at `%WORKDIR%/db.sqlite`
- If `license` is omitted → online license mode with defaults (`api.hortval.com`, `30s`)
- If `license.offline: true` → offline license mode
- If `workers` is omitted → 16 workers with sensible backoff settings
- If only one DNS profile exists → policies don't need to reference it explicitly
- If exactly one policy and one authority exist → `policy-bindings` can be omitted entirely
- If `rate-limiting` is omitted → safe defaults: 200 req/min/IP, 5 accounts/h/IP, 20 orders/h/account, 5 same-FQDN issuances per 7 days, 5 failed validations per (account, hostname) per hour, 30 in-flight pending authzs per account
- If `renewal-info` is omitted → ARI is still active with default window (last third of cert lifetime, 48h wide, 6h `Retry-After`)
- If `audit` is omitted → the tamper-evident audit log is enabled and writes to `<workdir>/audit.log` with no in-process rotation (rotation delegated to the OS)

## `workdir`

```yaml
workdir: "C:\\ProgramData\\hortval"
```

Base directory for all runtime files: SQLite database, TLS certificate cache, log files (when `output: file`).

| OS | Default |
|---|---|
| Windows | `%ProgramData%\hortval` |
| Linux | `/var/lib/hortval` |
| macOS | `~/Library/Application Support/hortval` |

:::warning Coming from Certeasy: the server stops rather than use the old directory
The default was renamed with the product. If you leave `workdir` unset **and** the
pre-rename directory still holds data, startup stops rather than picking either
one, and names three ways out: move it to the new default, keep it where it is by
naming it explicitly with `workdir:`, or delete it if it is a leftover.

**Nothing is moved for you.** That directory holds the database, the node identity,
the audit log and the CA key. The check fires on a directory that is simply
*non-empty*, rather than on a recognised installation marker — that marker arrived
with the node identity, so the oldest releases would not be recognised, and they
are exactly the ones worth catching. An empty directory left behind by a package
or a `mkdir` does not trigger it.

Setting `workdir` to an absolute path skips the check entirely: saying where your
data lives *is* the way out this error offers.
:::

## Every path must be absolute or anchored

:::warning Relative paths are refused
This corrects the documentation as much as the product. Earlier versions of this
page stated that relative paths in other sections were resolved relative to
`workdir`. **They were not** — they were resolved against the process working
directory, which for a Windows service created with `sc.exe` is
`C:\Windows\System32`, and `sc.exe` offers no field to change it.

On SQLite that failed loudly. On PostgreSQL or SQL Server, where the connection
string does not depend on `workdir`, it did not: the server started perfectly well
on a *second*, empty working directory, with a fresh node identity, a fresh audit
chain and a regenerated fake CA. Hortval now refuses them at startup and in
`hortval validate`.
:::

A path setting is accepted when it is **absolute**, or when it starts with an
anchor token:

| Token | Expands to | Valid in |
|---|---|---|
| `%WORKDIR%` | the resolved `workdir` | `database.path`, `audit.path`, `logs.file`, `local-pki-cache-dir`, `letsencrypt.cache-dir`, `local-cert-file`, `local-key-file` |
| `%CONFIGDIR%` | the directory holding the configuration file | `workdir` only |

```yaml
workdir: "%CONFIGDIR%/workdir"      # beside the config file — what `hortval init` writes
database:
  path: "%WORKDIR%/db.sqlite"
audit:
  path: "%WORKDIR%/audit.log"
```

`%CONFIGDIR%` exists for `workdir` alone: it is the one path that could not use
`%WORKDIR%`, since it *is* the working directory. Written anywhere else it is
refused rather than left as-is — an unsubstituted token would silently create a
directory named `%CONFIGDIR%`.

Omitting a key entirely is always safe: every default is anchored by
construction.
