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
| Unit (TU) | **628** | Pure logic: configuration parsing and validation, policy resolution, JWS signing and verification, anti-replay nonces, DNS scope matching, CSR validation, key handling, the asynchronous job engine, licensing decisions, rate-limit decision tables, audit-line encoding. No I/O, no database. |
| Integration (IT) | **171** | Real database (SQLite, PostgreSQL, SQL Server), real audit file on disk, real PKI request store, full ACME handler stack wired against the storage layer. Each test runs against every supported database backend. |
| End-to-end (E2E) | **117** | The full Certeasy binary running as a subprocess. Two flavours: (1) CLI black-box — every subcommand (`serve`, `init`, `validate`, `license`, `cold-start`, `backup`, `audit`, `adcs check`), exit codes, error messages. (2) ACME protocol — real third-party clients (lego, certbot, acme.sh) plus a RFC-strict native client driving certificate issuance, renewal, revocation, account lifecycle, key rollover, and the full error/security path. |
| **Total** | **916** | |

Numbers are refreshed at every release. The most recent count above reflects
the **v0.9.4** line — **+107 tests since v0.9.3**.

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
  rejection, and — against Microsoft ADCS — real propagation to the
  certificate authority (see below).
- URL and header conformance: every endpoint where RFC 8555 requires a
  `Location` header is asserted on the wire.
- Anti-replay nonces: single-use enforcement, validity under concurrent
  clients running at uneven speeds, and both window edges.
- Account keys: RSA, ECDSA and Ed25519. One key yields one account, whatever
  the encoding of its JWK.

### ACME client interoperability

E2E suite runs the full happy-path issuance against:
- **lego** — HTTP-01, DNS-01, TLS-ALPN-01.
- **certbot** — HTTP-01, DNS-01.
- **acme.sh** — HTTP-01, DNS-01, TLS-ALPN-01.
- A built-in, RFC-strict native client for the paths the third-party CLIs do
  not exercise: error-path, security probes, account lifecycle operations, and
  RFC URL/header conformance.

One scenario runs the three CLIs simultaneously against a single server, each
solving a different challenge type. Another issues and renews an ECDSA
certificate under an ECDSA account key.

### Microsoft ADCS integration

When an ADCS lab is available, Certeasy is validated against a real Active
Directory Certificate Services authority:

- **Issuance** through both supported ADCS connectors, so an upgrade never
  changes behaviour silently.
- **Revocation propagated to the CA**, then confirmed on the authority itself
  — a revoked certificate is verified as revoked at the source, not only in
  Certeasy's own records.
- **Onboarding checks** — the `adcs check` command and the setup wizard verify
  that the CA is reachable, that the certificate template is published, and
  read the template's key requirements, so common misconfigurations surface
  at setup time instead of as opaque startup failures.
- **Clear diagnostics** — when the CA refuses a request, the underlying reason
  is surfaced with actionable guidance (for example, a key that does not meet
  the template's requirements), independent of the CA's display language.
- **Server-certificate key selection** — Certeasy's own certificate can be
  issued as RSA or ECDSA at the strength the CA template mandates, and this
  selection is verified end to end.

### Database support

The integration suite runs the same test set against every supported
backend:
- **SQLite** — always.
- **PostgreSQL** — when configured in the CI environment.
- **SQL Server** — when configured in the CI environment.

Schema migrations, concurrent-writer behaviour (serialisable retry), and
dialect-specific edge cases (UUID handling, NULL semantics in unique
indexes, cascade chain restrictions on SQL Server) are all covered.

### Asynchronous issuance &amp; revocation

Certificate signing and revocation against a CA run through an asynchronous
job engine, and its reliability guarantees are tested:

- Retries with escalating back-off when the CA is momentarily unavailable,
  up to a bounded window before a request is marked failed.
- Idempotent processing — a job that is retried, or replayed after a crash,
  never issues or revokes twice.
- The full issuance and revocation job lifecycle, including the audit record
  emitted at each terminal outcome.

### Server certificate management

Certeasy manages its own TLS certificate, and each source is exercised:

- **Static files** — loaded from disk and hot-reloaded when they change.
- **Internal PKI** — issued and automatically renewed from a configured
  authority, with the key algorithm and strength selectable to match the CA
  template (see [Microsoft ADCS integration](#microsoft-adcs-integration)).
- **Let's Encrypt** — automatic ACME issuance.
- Startup acquisition, renewal timing, and local caching are all covered.

### Resilience &amp; recovery

- **Node identity** — each server instance has a stable identity that anchors
  its audit trail; work in flight is recovered correctly across a process
  restart.
- **Graceful shutdown** — in-flight requests and jobs drain within the
  configured window, and terminal database writes survive a shutdown signal.

### Configuration

- The configuration parser is covered for strict schema checking (unknown
  fields are rejected), quoting and escaping, and Windows path handling.
- `certeasy validate` runs exactly the same static validation as the server's
  fail-fast boot gate, with no side effects — an invalid configuration is
  caught before startup rather than halfway through it.
- A partial section leaves the other keys at their documented defaults; an
  explicit value is honoured or rejected, never silently replaced.

### Rate limiting

End-to-end suite (7 tests) under a tight profile, covering global denial,
account-creation throttling, order-creation throttling, duplicate-certificate
refusal, failed-validation back-off, and the pending-authorization cap.

A further 22 tests cover the two per-address buckets: refusal of a misbehaving
address, isolation of its neighbours, whitelist exemption, threshold weighting,
and the outcomes that deliberately do not count as abuse (stale nonce, expired
order, licence refusal).

### Audit log

- Round-trip write + verify on every supported database backend.
- HMAC chain anchoring on the installation key.
- Recovery across process restart, including rotated files. Rotation writes
  dated segments that are never renamed.
- Tampering detection (line removed, line modified, MAC altered, wrong
  installation key).
- Every protocol event (account create / key change / deactivate, order
  create / finalize / invalid, authorization & challenge validate,
  certificate issue / revoke, rate-limit deny, license deny) is asserted
  to fire exactly once at the right point in the request lifecycle.

### License enforcement

Licensing is enforced at startup and at runtime, including the recovery paths
that keep a server running through a degraded or expired state.

### CLI

Every subcommand and flag is exercised in the E2E suite — including
`serve`, `init`, `validate`, `license`, `backup`, `audit verify`, and the
ADCS preflight `adcs check`: argument validation, exit codes, error
messages on missing file / bad format / incompatible flag combinations,
help output for every command level.

### Backup &amp; restore

- SQLite snapshot round-trip with schema verification.
- Integrity check (`quick` and `full`).
- Refusal to overwrite an existing target.
- Verify against a corrupted file / missing tables / wrong driver.

### Cross-platform

The suite runs on Linux for every release. On Windows, when an ADCS lab is
available, the protocol suite additionally runs against a real Active
Directory Certificate Services authority — covering both certificate
issuance and revocation, and both ADCS connectors (see
[Microsoft ADCS integration](#microsoft-adcs-integration)).

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

The full suite is launched from the repository root with a single command
that records pass / fail / skip per module and writes per-module logs for
diagnostics. The headline numbers above come from enumerating the whole test
suite and classifying each test by an objective, path-based rule.
