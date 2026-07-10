---
sidebar_position: 2
title: Standards & RFC support
---

# Standards & RFC support

Certeasy implements the IETF ACME family of standards. This page documents which parts of each RFC are supported today, which are partial, and which are planned. Use it when auditing Certeasy against a compliance requirement or before integrating an ACME client that depends on a specific feature.

## RFC 8555 — ACME core protocol

**Status**: Supported with known gaps documented below.

| Feature | RFC § | Status |
|---|---|---|
| Account create / contact update / key change / deactivate | §7.3 | ✅ |
| `newOrder` and order state machine | §7.4 | ✅ |
| Authorization + challenge dispatch (HTTP-01, DNS-01, TLS-ALPN-01) | §7.5, §8 | ✅ |
| `finalize` + CSR validation | §7.4 | ✅ |
| `revoke-cert` signed with the account key (`kid`) or the certificate key (`jwk`) | §7.6 | ✅ (propagates to the ADCS CA — see notes) |
| Wildcard issuance (`*.zone`, mixed `zone + *.zone` in one order) | §7.1.4, §8.4 | ✅ |
| `Location` headers and response URLs canonicalization | §7.4 and following | ✅ |
| External Account Binding (EAB) | §7.3.4 | 🔴 not supported in V0.9 / V1.0 — planned for V2.0 |

### Known limitations

#### ADCS revocation propagation (shipped in 0.9.3)

Since **0.9.3**, `POST /acme/revoke-cert` propagates to the backing ADCS CA — the certificate is revoked on the CA itself, not only in Certeasy's database. Two things to know:

- Revoking on the CA requires the **Certificate Manager** role on the ADCS service account — a higher privilege than enrollment. If the account only holds enrollment rights (or the deployment is air-gapped), turn propagation off per authority with `disable-ca-revocation: true`; revocation then stays server-side only, as before.
- Propagation to the CA is immediate, but a client validating chain status still sees the certificate as valid until the CA **publishes its next CRL** (or its OCSP responder refreshes). That cadence is governed by your ADCS CRL publication schedule, not by Certeasy.

#### External Account Binding (EAB) — planned for V2.0

EAB lets you bind a new ACME account to an out-of-band identity (HMAC key shared via your provisioning system). Useful for multi-tenant DevOps deployments where each team is given its own credentials. Not implemented in V0.9 / V1.0 — single-tenant enterprise deployments do not need it. Tracked on the [roadmap](../intro/roadmap.md) for V2.0.

## RFC 9773 — ACME Renewal Information (ARI)

**Status**: Partial — read-only ARI is supported, the `replaces` hint is silently accepted.

| Feature | RFC § | Status |
|---|---|---|
| `renewalInfo` directory entry | §3 | ✅ |
| `GET /acme/renewal-info/<certID>` with suggested window + `Retry-After` | §4 | ✅ |
| `newOrder.replaces` validation + persistence + `renewalInfo` window collapse on the replaced cert | §5 | 🟡 field accepted silently — full semantics planned for V1.1 |

### Known limitations

#### `replaces` semantics (planned for V1.1)

ARI-aware clients (recent lego, certbot) can send `newOrder.replaces` without seeing a `400 malformed` — Certeasy accepts the field. However the server does not yet:

- Reject duplicate `replaces` with `409 alreadyReplaced`.
- Persist the `old_cert → new_cert` link.
- Collapse the replaced certificate's `renewalInfo` window to force renewal of other clients holding the old cert.

In a single-instance deployment this is invisible. In multi-instance or HA deployments the full ARI benefit is reduced until the semantics ship.

## RFC 5280 — X.509 certificates

**Status**: Supported.

- Issued certificates carry the **Subject Alternative Name** extension only, with DNS names from the validated authorizations.
- The **Subject Common Name** field is intentionally left empty. This follows the CA/Browser Forum baseline since 2019: modern TLS clients (Chrome, Firefox, Go ≥ 1.15, Java ≥ 11) validate against SAN, not CN. Legacy clients that still require a CN-based match may need adjustment.
- **Extended Key Usage**: `serverAuth` only. `clientAuth`, `codeSigning`, `anyPurpose` and other EKUs are never set, even if requested by the client's CSR. Certificates issued by Certeasy are TLS server certificates — never reusable for AD authentication, SMB signing, or other server-side roles. The strict EKU policy can be relaxed per-policy via `csr.allowed-extra-eku` if a specific client (e.g. acme.sh) declares additional EKUs in its CSR.
- **Signature algorithms**: configurable allow-list per policy, default minimum RSA 3072-bit, ECDSA P-256 and above.

## Roadmap

The remaining gaps on this page are tracked in the [public roadmap](../intro/roadmap.md) and target the next minor releases. Subscribe now (Pro, Enterprise) to lock the price while features ship progressively.
