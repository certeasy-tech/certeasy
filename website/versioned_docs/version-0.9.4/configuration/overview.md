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

:::warning Relative paths are **not** resolved against `workdir`
A path you write elsewhere in the configuration — `database.path`, `audit.path`, `logs.file`, `local-pki-cache-dir`, `letsencrypt.cache-dir`, or a bundle's `local-cert-file` / `local-key-file` — is used exactly as written. A relative one therefore resolves against the **process working directory**, not against `workdir`.

That directory is rarely the one you have in mind. A Windows service created with `sc.exe` starts in `C:\Windows\System32` — and `sc.exe` offers no field to change it — so a relative path lands there instead of beside your installation. On PostgreSQL or SQL Server, where the connection string is independent of `workdir`, the server then starts perfectly well on a *second*, empty working directory: fresh node identity, fresh audit chain, regenerated fake CA.

**Write absolute paths.** Omitting a key is also always safe: only the defaults are anchored to `workdir` — leaving `audit.path` unset gives you `<workdir>/audit.log`.

Earlier revisions of this page stated the opposite. That was wrong, and it is withdrawn.
:::

:::tip Two habits that cost nothing here, and save an edit later
**Set `workdir` explicitly, to an absolute path.** Leaving it out works — a
default is picked for you, per the table above — but a value you wrote yourself
is a value you can read, and it survives a change of platform, of service
account, or of default.

**Do not write `%WORKDIR%` in `audit.path`, `logs.file`,
`letsencrypt.cache-dir`, `local-cert-file` or `local-key-file`.** This release
takes it **literally**: it creates a directory actually named `%WORKDIR%` under
the process working directory, and your audit log or cache quietly lands there.
Write an absolute path, or omit the key — an omitted key already defaults under
`workdir`, which is the behaviour people expect from the placeholder.

**If `certeasy init` wrote `workdir: ./workdir`, replace it with an absolute
path.** The wizard's own output is relative, and a relative path resolves
against the process working directory — see the warning above for what that
costs on a Windows service.

A configuration written this way loads unchanged on later releases.
:::
