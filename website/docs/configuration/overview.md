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
| `workdir` | **Yes** | Base directory for runtime files — absolute, no default |

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

:::warning Required, and absolute. There is no default.
A configuration that does not set `workdir` is refused at startup, and by
`hortval validate`. Earlier releases picked a location for you; this one does
not.

**Why.** Every other path setting in this file already refuses to be guessed —
all eight are rejected unless absolute or anchored (see below). `workdir` was
the single exception, and it is the one that decides where the database, the
node identity, the audit log and the CA key live. A default for *that* is a
location nobody chose, that moves when the product is renamed, and that has to
be arbitrated against the location the previous release used.

These are the values previous releases used, and they remain the sensible
choice — write the one for your platform:

| OS | Conventional location |
|---|---|
| Windows | `%ProgramData%\hortval` |
| Linux | `/var/lib/hortval` |
| macOS | `~/Library/Application Support/hortval` |

**Upgrading? The refusal tells you where your data is.** Until v2, startup also
looks at the locations previous releases used — including the pre-rename
`certeasy` ones — and, when an installation is there, names it and prints the
exact line to paste. If both hold one, it says so and lets you choose.

**Nothing is ever moved for you.** That directory holds the database, the node
identity, the audit log and the CA key. Copying a database while opening it is
not something a startup path should attempt, and a half-copy leaves two
installations that both look right.

An installation is recognised by its `server_id` marker, which every release
since v0.9.0 writes. A directory holding only a `logs/` folder is not one: a
service that started once and failed leaves exactly that, and it says nothing
about where your data is.
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
