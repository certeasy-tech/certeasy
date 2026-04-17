---
sidebar_position: 1
title: Changelog
---

# Changelog

## v1.0.0 *(coming soon)*

Initial public release.

### Features

- Full ACME server (RFC 8555): account registration, orders, challenge validation, finalization, revocation
- HTTP-01, DNS-01, TLS-ALPN-01 challenge validation
- ADCS authority via `certreq.exe`
- Issuance policies with DNS scope rules and signature constraints
- Policy bindings with `first_available` and `round_robin` strategies
- SQLite, PostgreSQL, and SQL Server support
- Async job engine with persistent retry and exponential backoff
- TLS certificate manager (`files` and `pki` modes)
- Structured logging with per-service level overrides and log rotation
- Full ACME audit log
- Built-in ESC attack mitigations (DNS-only identity, Server Authentication EKU only)
- Fake PKI authority for local testing

---

:::note
Certeasy is currently in beta. This changelog will be updated with each release.
:::
