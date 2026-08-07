---
sidebar_position: 2
title: Database Schema
---

# Database Schema


Certeasy's schema travels inside the binary. A restart applies additive changes on its own; anything heavier waits for an explicit [`certeasy migrate`](./migrations.md), and on a database where Certeasy may not issue DDL it writes the script for your DBA. This page is a **functional map** of the core ACME tables and how they change as an order progresses; it is not an exhaustive column-level reference. Internal/support tables (job queue, licensing, PKI request tracking, audit state) are managed automatically and are not covered here.

## ACME Flow Overview

| Step | Endpoint | Server Action | Tables Affected |
|------|----------|---------------|-----------------|
| New Account | `POST /acme/newAccount` | Creates a client account | `acme_accounts` |
| New Order | `POST /acme/newOrder` | Creates an order with authorizations and challenges | `acme_orders`, `acme_authorizations`, `acme_challenges` |
| Challenge Validation | `POST /acme/chall/<id>` | Client responds, server validates asynchronously | `acme_challenges`, `acme_authorizations` |
| Finalization | `POST /acme/finalize/<id>` | Client sends CSR → certificate issued | `acme_orders`, `acme_certificates` |
| Certificate Retrieval | `GET /acme/cert/<id>` | Client downloads certificate | Read only |
| Revocation | `POST /acme/revoke-cert` | Revokes a certificate | `acme_certificates` |
| Replay Protection | Automatic | Anti-replay nonces | `acme_nonces` |
| Auditing | Automatic | All significant actions | Tamper-evident [audit log](./audit.md) (JSONL, separate from the database) |

---

## Table: `acme_accounts`

Stores registered ACME client accounts (RFC 8555 §7.1.2).

| Column | Description |
|---|---|
| `id` | Account ID (e.g. `/acme/acct/123`) |
| `jwk` | Client public key in canonical JSON |
| `contact` | List of `mailto:` addresses |
| `status` | `valid`, `deactivated`, `revoked` |
| `tos_agreed_at` | Timestamp of Terms of Service acceptance |

**Created**: `POST /acme/newAccount` (when JWK thumbprint is new)

**State transitions**:
- `valid` → `deactivated`: via `POST /acme/acct/{id}` with `"status":"deactivated"`
- `valid` → `revoked`: on full account revocation

---

## Table: `acme_nonces`

Anti-replay nonces used in JWS request headers.

| Column | Description |
|---|---|
| `nonce` | Random nonce value |
| `issued_at` | When the nonce was issued |
| `used_at` | When the nonce was consumed (null if unused) |

Every ACME response generates a new nonce. Once a nonce is used in a valid JWS request, it is marked used and cannot be reused. Expired nonces are cleaned up periodically.

---

## Table: `acme_orders`

Represents a certificate order.

| Column | Description |
|---|---|
| `id` | Order identifier |
| `account_id` | Owning account |
| `status` | `pending`, `ready`, `processing`, `valid`, `invalid` |
| `csr` | Raw CSR bytes / DER (set at finalize) |
| `not_before`, `not_after` | Requested validity window |
| `expires_at` | Order expiry |
| `certificate_id` | Linked certificate (set when issued) |

**Created**: `POST /acme/newOrder`

**Status flow**:
```
pending → ready (all authorizations valid)
        → processing (finalize received)
        → valid (certificate issued)
        → invalid (challenge or issuance failure)
```

---

## Table: `acme_authorizations`

Proof of control for each identifier in an order.

| Column | Description |
|---|---|
| `id` | Authorization ID (appears in its public URL) |
| `identifier_value` | DNS name (e.g. `app.corp.internal`) |
| `status` | `pending`, `valid`, `invalid` |
| `expires_at` | Authorization expiry |
| `wildcard` | Whether this is a wildcard authorization |
| `error_msg` | Validation error detail (if failed) |

When at least one challenge for an authorization becomes `valid`, the authorization becomes `valid`. When all authorizations for an order are `valid`, the order status moves to `ready`.

---

## Table: `acme_challenges`

Validation challenges (DNS-01, HTTP-01, TLS-ALPN-01) for each authorization.

| Column | Description |
|---|---|
| `id` | Challenge identifier |
| `challenge_type` | `dns-01`, `http-01`, `tls-alpn-01` |
| `status` | `pending`, `processing`, `valid`, `invalid` |
| `token` | Challenge token |
| `key_authorization` | Computed key authorization |
| `validated_at` | Timestamp of successful validation |

**Created**: automatically with `newOrder`

**Updated**: on `POST /acme/challenge/<id>` → moves to `processing`, then `valid` or `invalid`

---

## Table: `acme_certificates`

Issued TLS certificates.

| Column | Description |
|---|---|
| `id` | Certificate identifier |
| `account_id` | Owning account |
| `order_id` | Originating order |
| `pem_chain` | PEM certificate chain (never includes private key) |
| `not_before`, `not_after` | Validity window |
| `fingerprint` | SHA-256 fingerprint of the leaf certificate |
| `revoked_at` | Revocation timestamp (null if active) |
| `revoke_reason` | RFC 5280 reason code (0–10, excluding 7) |

**Created**: `POST /acme/finalize/<id>` after successful ADCS issuance

**Updated**: `POST /acme/revoke-cert`

---

## Full Flow Reference

```
POST /acme/newAccount
    → INSERT acme_accounts

POST /acme/newOrder
    → INSERT acme_orders
    → INSERT acme_authorizations (one per identifier)
    → INSERT acme_challenges (one per auth × challenge type)

POST /acme/challenge/{id}
    → UPDATE acme_challenges (status → processing)
    [async job validates DNS/HTTP/TLS]
    → UPDATE acme_challenges (status → valid/invalid)
    → UPDATE acme_authorizations (status → valid if one challenge valid)
    → UPDATE acme_orders (status → ready if all authorizations valid)

POST /acme/finalize/{id}
    → UPDATE acme_orders (status → processing)
    [async job submits CSR to ADCS]
    → INSERT acme_certificates
    → UPDATE acme_orders (status → valid, certificate_id → ...)

GET /acme/cert/{id}
    → SELECT acme_certificates

POST /acme/revoke-cert
    → UPDATE acme_certificates (revoked_at, revoke_reason)
```
