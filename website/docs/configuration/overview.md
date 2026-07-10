---
sidebar_position: 1
title: Overview
---

# Configuration Overview

Certeasy is configured with a single YAML file. The parser is strict: unknown fields, malformed YAML, and missing required relationships all cause startup to fail with an explicit error.

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

Certeasy avoids requiring explicit configuration for common cases:

- If `database` is omitted → SQLite at `%WORKDIR%/db.sqlite`
- If `license` is omitted → online license mode with defaults (`certeasy.tech`, `30s`)
- If `license.offline: true` → offline license mode
- If `workers` is omitted → 16 workers with sensible backoff settings
- If only one DNS profile exists → policies don't need to reference it explicitly
- If exactly one policy and one authority exist → `policy-bindings` can be omitted entirely
- If `rate-limiting` is omitted → safe defaults: 200 req/min/IP, 5 accounts/h/IP, 20 orders/h/account, 5 same-FQDN issuances per 7 days, 5 failed validations per (account, hostname) per hour, 30 in-flight pending authzs per account
- If `renewal-info` is omitted → ARI is still active with default window (last third of cert lifetime, 48h wide, 6h `Retry-After`)
- If `audit` is omitted → the tamper-evident audit log is enabled and writes to `<workdir>/audit.log` with no in-process rotation (rotation delegated to the OS)

## `workdir`

```yaml
workdir: "C:\\ProgramData\\certeasy"
```

Base directory for all runtime files: SQLite database, TLS certificate cache, log files (when `output: file`).

| OS | Default |
|---|---|
| Windows | `%ProgramData%\certeasy` |
| Linux | `/var/lib/certeasy` |

All relative paths in other configuration sections (e.g. `database.path`, `local-pki-cache-dir`) are resolved relative to `workdir`.
