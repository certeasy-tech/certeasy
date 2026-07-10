---
sidebar_position: 1
title: Changelog
---

# Changelog

## v0.9.3 - 2026-07-09

### New features

- **ADCS certificate revocation**: ACME revocations now propagate to the backing Microsoft ADCS CA (CRL / OCSP), not just Certeasy's own database. RFC 8555 §7.6 authorization is supported with both the account key (`kid`) and the certificate key (`jwk`). Propagation can be turned off per authority with `disable-ca-revocation: true` (for service accounts without the required CA role, or air-gapped deployments). Note: revoking on the CA needs the **Certificate Manager** role — a higher privilege than enrollment.
- **`certeasy adcs check`** — a read-only preflight for ADCS authorities: checks that the CA is reachable, that the certificate template is published, and reports the template's key requirement. Use it to diagnose ADCS setup before starting the server (or to hand support a clear status).
- **Configurable server-certificate key**: a `pki`-mode bundle in the TLS certificate manager now accepts an explicit `key:` — `type: rsa` with `size:` (bits), or `type: ecdsa` with `curve:` (`P-256`/`P-384`/`P-521`). Set it when the CA template mandates a specific key. In particular, an ADCS template that requires **RSA 4096** previously rejected Certeasy's default ECDSA key and prevented startup; `key: { type: rsa, size: 4096 }` resolves it. The default is unchanged (ECDSA P-256).

### Improvements

- **`certeasy init` — ADCS onboarding**: the wizard now defaults to ADCS, lists the CA's published certificate templates so you select the exact one (no typos, only published templates), and reads the template's key requirement to set the server-certificate key automatically — falling back to asking you when the template cannot be read.
- **Clearer ADCS denial messages**: when the CA denies a request, Certeasy now surfaces the actual reason (for example, "the public key does not meet the template's key size requirement", `CERTSRV_E_KEY_LENGTH`) with an actionable hint, instead of an opaque `CR_DISP_DENIED`. The diagnosis is keyed on the CA's error code, so it stays accurate regardless of the CA's display language.

### Security

- Updated the Go toolchain to **1.26.5** to address **GO-2026-5856** (an Encrypted Client Hello privacy leak in the standard library's `crypto/tls`).

---

## v0.9.2 - 2026-06-17

### New features

- **Native ADCS connector** (now the default for `type: adcs`): Certeasy enrolls against ADCS **in-process**, without launching `certreq.exe`. This removes the child-process (LOLBin) signature that strict EDRs flag, making Certeasy eligible for more hardened deployment perimeters. Existing `type: adcs` configurations switch to it automatically on upgrade — no change required.
- **`certeasy validate`** — a configuration check in the spirit of `nginx -t`. `certeasy validate -f <config>` parses and validates a configuration statically, with no side effects (no database, no network, no file writes). `serve` now runs the same validation as a fail-fast boot gate, so an invalid configuration is rejected before startup instead of failing halfway through.

### Improvements

- `certeasy init` now lets you choose the ADCS connector (native in-process, or `certreq.exe`) when generating a configuration.

### Changes

- The `certreq.exe`-based integration remains available as an opt-in fallback under `type: adcs-cli`.
- The unused `cert-util-timeout` ADCS option is no longer documented; it is still accepted in existing configurations but has no effect.
- **ADCS request timeout**: `default-timeout` now defaults to **4 minutes** and is honored as configured. Previously a legacy behavior capped the effective ADCS wait at **30 seconds** regardless of `default-timeout`; that cap is removed. Keep `default-timeout` below `workers.max-job-duration` (default 5m) — Certeasy warns at startup if it is greater than or equal.

### Fixes

- `certeasy init` generated an ADCS authority block with incorrect field names; it now emits the correct `ca-name` / `certificate-template` schema.
- **SQL Server backends**: upgraded the SQL Server driver to go-mssqldb v1.10.0, which improves connection handling when a query is cancelled or times out. Recommended for all SQL Server deployments.
- **DNS validation profiles**: the zone `protocol` field (`udp` / `tcp`) is now honored. It was previously parsed but ignored (DNS lookups were always UDP-first with a TCP fallback); set `protocol: tcp` to force DNS validation over TCP on networks where UDP/53 is unavailable.

---

## v0.9.1 - 2026-06-10

### New features

- `certeasy init` command — interactive (and scriptable) wizard to generate a `config.yml`.
- Database connection: new `conn-max-lifetime` and `conn-max-idle-time` options.

### Improvements

- Readable text output for one-shot subcommands (`license`, `backup`, `audit`, `cold-start`). The `serve` daemon keeps its structured JSON output.
- All displayed and logged dates are in UTC.
- Richer startup banner: installation ID and license ID.

### Changes

- The `--grace` and `--cold-start-plan` flags are removed. The boot mode (valid license, post-expiration, cold-start, refusal) is now determined automatically from persistent state.
- License registration is validated by the portal; a portal refusal is surfaced verbatim to the operator.
- A license retired by the portal enters a grace window before boot is refused.

### Fixes

- Shutdown stability: removed a possible SQLite panic and a goroutine leak on the ACME rate limiter.

---

## v0.9.0 - 2026-05-31

Initial public release.

### Features

- ACME server (RFC 8555) covering account registration with key rollover, orders, authorizations, challenge validation, finalization, certificate retrieval, and revocation
- HTTP-01, DNS-01 and TLS-ALPN-01 challenge validation
- Wildcard certificates, including mixed `[apex, *.apex]` orders (RFC 8555 §7.1.4)
- ACME Renewal Information endpoint (RFC 9773, read-only) for client-driven renewal scheduling
- ADCS authority via `certreq.exe`
- Built-in fake PKI authority for local testing
- Issuance policies with DNS scope rules and signature constraints
- Policy bindings with `first_available` and `round_robin` strategies
- Server-side rate limiting per ACME account (duplicate-certificate)
- SQLite (default), PostgreSQL and SQL Server backends
- Async job engine with persistent retry and exponential backoff
- TLS certificate manager for the server's own certificate (`files` and `pki` modes)
- Structured logging with per-service level overrides and log rotation
- Tamper-evident ACME audit log (JSONL + HMAC chain, validated by the `audit verify` command)
- SQLite backup CLI (`backup create` / `backup verify`)
- License enforcement with strict boot and acknowledgement of degraded states
- Graceful HTTP shutdown
- Built-in mitigations against ESC-class attacks: DNS-only identity, Server Authentication EKU only by default

### Interoperability covered by automated tests

- ACME clients: certbot, lego, acme.sh, and a built-in protocol client
- Backends: ADCS, fake PKI
- Databases: SQLite, PostgreSQL, SQL Server
- Full clients × challenges × databases × backends matrix

---

:::note
Certeasy v0.9.x is a **stable release**, used for day-to-day issuance, renewal and revocation. The full **production-ready** label is reserved for the upcoming **v1.0**, which closes the known, non-blocking limitations below:

- **No health or metrics HTTP endpoints yet.** Operational monitoring is limited to log scraping and database introspection for now; dedicated `/health` and metrics endpoints are planned for v1.0.
- **No automatic data retention or cleanup.** ACME tables (orders, authorizations, challenges, …) grow without bound. Operators running long-lived deployments should plan for manual maintenance until automated retention ships in v1.0.
- **RFC 9773 `replaces` field is accepted but not yet honored.** Clients can supply `replaces` on new orders without error, but the linkage to the previous certificate is not applied. The `renewalInfo` endpoint itself is fully functional; full `replaces` semantics are planned for v1.1.
- **External Account Binding (EAB)** is not supported and is not planned for v1.0. Single-tenant enterprise deployments do not need it; see the [roadmap](../intro/roadmap.md) for v2.0 timing.
- **Caddy** interoperability has not been formally validated in this release.
:::
