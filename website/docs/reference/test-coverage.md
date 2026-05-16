---
sidebar_position: 3
title: Test coverage
---

# Test coverage

Every Certeasy release ships only after the full automated test suite
passes against the targeted database backends. This page lists the suites
that compose the gate, what each one verifies, and the headline counts at
the time of writing.

## Headline numbers

| Category | Tests | What it verifies |
|---|---|---|
| Unit (TU) | **474** | Pure logic: configuration parsing, policy resolution, JWS signing primitives, DNS scope matching, CSR validation, crypto helpers, rate-limit decision tables, audit-line encoding. No I/O, no database. |
| Integration (IT) | **63** | Real database (SQLite, PostgreSQL, SQL Server), real audit file on disk, real PKI request store, full ACME handler stack wired against the storage layer. Each test runs against every supported database backend. |
| End-to-end (E2E) | **68** | The full Certeasy binary running as a subprocess. Two flavours: (1) CLI black-box — every subcommand (`serve`, `license`, `backup`, `audit verify`), exit codes, error messages. (2) ACME protocol — real third-party clients (lego, certbot, acme.sh) plus a RFC-strict native client driving certificate issuance, renewal, revocation, account lifecycle, key rollover, and the full error/security path. |
| **Total** | **605** | |

Numbers are refreshed at every release. The most recent count above reflects
the **v0.9** line.

## What is covered, by area

### ACME protocol (RFC 8555 + RFC 9773)

- Account: create, lookup-by-key, contact update, deactivate, key rollover
  (including the `409 Conflict` path when rolling to an already-used key).
- Order: create, get, finalize, state machine transitions, expiry.
- Authorization + challenges: HTTP-01, DNS-01, TLS-ALPN-01 — happy path and
  every documented failure mode.
- Wildcards: pure `*.zone` and mixed `zone + *.zone` in a single order.
- Renewal information (ARI): suggested window, `Retry-After`, revoked-cert
  collapse to immediate renewal.
- Revocation: client-signed and account-key-signed paths, double-revoke
  rejection.
- URL and header conformance: every endpoint where RFC 8555 requires a
  `Location` header is asserted on the wire.

### ACME client interoperability

E2E suite runs the full happy-path issuance against:
- **lego** — HTTP-01, DNS-01, TLS-ALPN-01.
- **certbot** — HTTP-01, DNS-01.
- **acme.sh** — HTTP-01, DNS-01, TLS-ALPN-01.
- A built-in RFC-strict native client (`golang.org/x/crypto/acme`) for paths
  the third-party CLIs do not exercise: error-path, security probes,
  account lifecycle ops, RFC URL/header conformance.

### Database support

The integration suite runs the same test set against every supported
backend:
- **SQLite** — always.
- **PostgreSQL** — when configured in the CI environment.
- **SQL Server** — when configured in the CI environment.

Schema migrations, concurrent-writer behaviour (serialisable retry), and
dialect-specific edge cases (UUID handling, NULL semantics in unique
indexes, cascade chain restrictions on SQL Server) are all covered.

### Rate limiting

Dedicated suite (7 tests) under a tight rate-limit profile, covering global
denial, account-creation throttling, order-creation throttling,
duplicate-certificate refusal, failed-validation back-off, and the
pending-authorization cap.

### Audit log

- Round-trip write + verify on every supported database backend.
- HMAC chain anchoring on `installation_id`.
- Recovery across process restart, including rotated files.
- Tampering detection (line removed, line modified, MAC altered, wrong
  installation_id).
- Every protocol event (account create / key change / deactivate, order
  create / finalize / invalid, authorization & challenge validate,
  certificate issue / revoke, rate-limit deny, license deny) is asserted
  to fire exactly once at the right point in the request lifecycle.

### License enforcement

- Boot-strict refusal (no license, expired license, wrong environment).
- Runtime per-order enforcement (`max_managed_servers`, `max_cas`,
  `allowed_dbs`, `max_managed_servers=0`).
- Renewal escape hatch (an order for a domain already covered by an
  active certificate is not counted against the cap).
- Acknowledgement path for boot-degraded states.

### CLI

Every subcommand and flag is exercised in the E2E suite: argument
validation, exit codes, error messages on missing file / bad format /
incompatible flag combinations, help output for every command level.

### Backup &amp; restore

- SQLite snapshot round-trip with schema verification.
- Integrity check (`quick` and `full`).
- Refusal to overwrite an existing target.
- Verify against a corrupted file / missing tables / wrong driver.

### Cross-platform

The suite is run on Linux for every release. The protocol suite is
additionally run on Windows when an ADCS lab is available (the ADCS
backend variant is gated on a Windows host with `certreq.exe`).

## How the categories are defined

Classification is purely based on the file path of the test, so the
numbers are reproducible without judgement calls:

- **End-to-end (E2E)** — tests that run the Certeasy binary as a subprocess
  and assert on the wire or the CLI output.
- **Integration (IT)** — tests that hit a real database, write a real
  audit file to disk, or wire the full handler stack against a real
  storage backend.
- **Unit (TU)** — every other test: pure-function logic with no I/O.

A test that touches both a database and a real subprocess counts as E2E
(the more demanding category wins).

## Where the numbers come from

The full suite is launched from the repository root with a single
script that records pass/fail/skip per module and writes per-module logs
for diagnostics. The headline numbers above are produced by enumerating
`go test -list` per module and classifying each test by its package path.
