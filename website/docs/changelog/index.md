---
sidebar_position: 1
title: Changelog
---

# Changelog

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
Certeasy is in **public beta**. Known limitations in this release:

- **Revocation is server-side only.** A revoked certificate is marked revoked in Certeasy's database and an audit event is emitted, but the ADCS CRL / OCSP responder is not updated. Clients validating chain status against ADCS will still see the certificate as valid until the CRL is republished. Full propagation lands in v1.0.
- **No health or metrics HTTP endpoints yet.** Operational monitoring is limited to log scraping and database introspection in this release; dedicated `/health` and metrics endpoints are planned.
- **No automatic data retention or cleanup.** ACME tables (orders, authorizations, challenges, …) grow without bound. Operators running long-lived deployments should plan for manual maintenance until automated retention ships.
- **RFC 9773 `replaces` field is accepted but not yet honored.** Clients can supply `replaces` on new orders without error, but the linkage to the previous certificate is not applied. The `renewalInfo` endpoint itself is fully functional.
- **External Account Binding (EAB)** is not supported and is not planned for v1.0. Single-tenant enterprise deployments do not need it; see the [roadmap](../intro/roadmap.md) for v2.0 timing.
- **Caddy** interoperability has not been formally validated in this release.
:::
