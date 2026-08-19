---
sidebar_position: 1
title: Certificate Security Model
---

# Certificate Security Model

Hortval enforces a strict certificate identity model at issuance time. This behavior is **mandatory, non-configurable, and secure by default**.

:::warning These rules are enforced on the request, not on what your CA returns
Every rule on this page is checked against the CSR and the ACME order, before submission. The certificate your CA issues is **not** re-checked against them.

Hortval prevents an ACME client from *asking* for a dangerous certificate. It does not prevent your CA from *issuing* one. If the ADCS template adds a SAN, sets a different Subject, or grants a broader EKU than was requested, Hortval returns that certificate to the client without detecting the difference.

The mitigations below are therefore only as strong as the template they are paired with. See [ADCS hardening & shared responsibility](./hardening.md).
:::

## Core Principle

> ACME proves **control over a DNS identifier** — nothing else.

ACME does not prove organizational identity, user identity, Active Directory account ownership, or authorization to authenticate to AD. Any certificate content beyond validated DNS names cannot be justified by the ACME protocol.

## Subject Rules

### What is allowed

- An **empty Subject**, or
- `CN = one of the validated DNS names`

### What is forbidden

All other Subject fields are rejected:

| Field | Reason |
|---|---|
| `O` (Organization) | Identity claim — not proven by ACME |
| `OU` (Organizational Unit) | Identity claim — not proven by ACME |
| `DC` (Domain Component) | AD-specific — can influence authentication |
| `L`, `ST`, `C` | Identity/location claims |
| Any custom RDN | Not justified by DNS validation |

In Windows and ADCS environments, Subject fields influence certificate-to-account mapping and authentication flows. Allowing arbitrary Subject attributes reintroduces identity confusion and privilege escalation risk.

## Subject Alternative Name Rules

- SAN **must** be present
- SAN entries **must** be `dNSName` only
- DNS names **must** match ACME-validated identifiers

### Forbidden SAN types

| Type | Reason |
|---|---|
| `otherName` (UPN / msUPN) | Enables AD account impersonation |
| `rfc822Name` (email) | Identity claim |
| `uniformResourceIdentifier` | Not proven by ACME |
| `iPAddress` | Not validated via DNS challenge |

## Extension Rules

### Allowed extensions

| Extension | OID | Constraint |
|---|---|---|
| Subject Alternative Name | `2.5.29.17` | DNS names only, no duplicates |
| Extended Key Usage | `2.5.29.37` | Server Authentication (`1.3.6.1.5.5.7.3.1`) only |

CSR-provided EKU values are ignored or rejected. The EKU that ends up in the certificate comes from your ADCS template — configure it to grant Server Authentication only.

### Forbidden extensions

All extensions not in the allow-list are rejected, including:

- `Any Purpose` EKU
- `Client Authentication` EKU
- `Smartcard Logon`
- `IP Security` EKUs
- `Certificate Policies`
- `Name Constraints`
- `Authority Information Access`
- `CRL Distribution Points`
- Microsoft-specific extensions

## CSR Structural Validation

To prevent ASN.1 smuggling and parsing ambiguity:

- Exactly one `extensionRequest` attribute (`1.2.840.113549.1.9.14`)
- No other CSR attributes
- Exactly one SAN extension
- No duplicate extensions
- No trailing or unused ASN.1 bytes
- Full DER consumed
- Valid CSR signature

Any deviation results in rejection.

## Why This Is Not Configurable

Security boundaries must be enforced in code. Allowing configuration to relax identity or extension rules would:

- Shift responsibility to operators
- Increase misconfiguration risk
- Complicate audits
- Reintroduce known ADCS vulnerabilities

Hortval enforces a single safe issuance model.

---

## ADCS ESC Attack Mitigations

The enforced rules prevent entire classes of ADCS certificate-based attacks (ESC1–ESC13).

### ESC1 — User-Supplied Subject or SAN with Client Authentication

**Attack**: Requester controls Subject or SAN (e.g. UPN) and obtains a certificate usable for AD authentication.

**Mitigations**: No user-supplied Subject identity. No `otherName`/UPN in SAN. EKU restricted to Server Authentication only.

---

### ESC2 — Any Purpose EKU Abuse

**Attack**: A certificate with `Any Purpose` EKU is used for unintended authentication.

**Mitigations**: `Any Purpose` EKU explicitly forbidden. EKU forced to Server Authentication only.

---

### ESC3 — Enrollment Agent Abuse

**Attack**: Enrollment Agent certificates allow requesting certificates on behalf of other users.

**Mitigations**:
- No delegation of enrollment authority — ACME clients never authenticate to ADCS directly *(architectural)*
- ⚠️ **Operator responsibility**: do not configure `certificate-template` to point at an Enrollment Agent template. Hortval does not validate the template type.

---

### ESC4 / ESC5 — Dangerous CA or Template Permissions

**Attack**: An attacker modifies CA or template permissions to issue malicious certificates.

**Mitigations**:
- Template selection not exposed to ACME clients — enforced in code, clients cannot influence which template is used
- Enrollment runs under the Hortval service account *(architectural)*
- ⚠️ **Operator responsibility**: create a dedicated ADCS template for ACME issuance and grant only Enroll permission to the Hortval service account

---

### ESC6 — UPN Injection via SAN

**Attack**: A certificate contains a UPN in SAN, enabling authentication abuse.

**Mitigations**: `otherName` SAN types explicitly forbidden. DNS-only SAN enforcement.

---

### ESC8 — NTLM Relay to ADCS

**Attack**: NTLM authentication to ADCS is relayed to obtain certificates as another identity.

**Mitigations**: ACME service does not expose ADCS enrollment endpoints. ACME clients never authenticate directly to ADCS.

---

### ESC9 / ESC10 — Weak or Legacy Certificate Mapping

**Attack**: Certificates map to AD accounts via weak identifiers (CN, email, legacy rules).

**Mitigations**: No email, UPN, or URI SANs. Minimal Subject. No identity-bearing attributes.

---

### ESC11 — Web Enrollment Abuse

**Attack**: ADCS Web Enrollment interfaces abused for unauthorized issuance.

**Mitigations**: Web Enrollment not used. Enrollment performed by controlled service account only.

---

### ESC12 — Long-Lived Misissued Certificates

**Attack**: Misissued certificates remain valid for long periods.

**Mitigations**:
- All certificate operations are recorded in the tamper-evident [audit log](../administration/audit.md) (JSONL + HMAC chain) *(enforced)*
- ACME protocol supports automated renewal — clients can request new certificates before expiry *(architectural)*
- ⚠️ **Shared responsibility**: certificate validity comes from your ADCS template — configure it with a short validity period (30–90 days recommended); Hortval honors the template's validity as-is. See [ADCS hardening & shared responsibility](./hardening.md).

---

### ESC13 — Cross-Forest Certificate Abuse

**Attack**: Certificates trusted across forests allow lateral movement.

**Mitigations**: EKU restricted to Server Authentication. No user or machine authentication EKUs. No identity-bearing Subject or SAN fields.

---

## Lifecycle Protections

The rules above apply at issuance time. Two additional protections operate around the certificate's lifetime:

### Anti-DoS: Pending Authorizations Cap

Clients that create orders but never finalize them leave behind pending `acme_authorizations` rows. Without a cap, this is a silent storage-growth DoS. Hortval refuses new orders when the account already has too many in-flight pending authzs.

| Property | Default | Configurable |
|---|---|---|
| Max in-flight | 30 | `rate-limiting.pending-authorizations.max` |
| Disable | — | `rate-limiting.pending-authorizations.enabled: false` |

The default of 30 is calibrated for the typical "one machine = one ACME account" model where a real client rarely has more than 5–10 pending authzs at once. Expired authzs are excluded from the count so abandoned orders don't lock the account out forever.

See [Rate Limiting](../configuration/rate-limiting#pending-authorizations).

### Anti-Misconfig: Failed Validation Limit

A misconfigured ACME client (broken DNS, port 80 closed, wrong TLS-ALPN) will keep retrying validations indefinitely, burning CA worker capacity. Hortval keeps an in-memory counter per `(account, hostname)` and refuses new authorizations once that counter is at cap.

| Property | Default | Configurable |
|---|---|---|
| Cap | 5 failed validations | `rate-limiting.failed-validation.max-per-window` |
| Window | 1h | `rate-limiting.failed-validation.window` |
| Disable | — | `rate-limiting.failed-validation.enabled: false` |

The counter decays continuously, so a transient outage that produces a few failures clears within minutes. The check at order-creation time is non-consuming — only actual challenge failures count.

See [Rate Limiting](../configuration/rate-limiting#failed-validation).

### Anti-Runaway: Duplicate Certificate Limit

A misconfigured or compromised ACME client can loop on the same domain and burn through CA resources — the "2000 certs for one site" failure mode. Hortval caps repeat issuance of the same FQDN set per account within a rolling time window.

| Property | Default | Configurable |
|---|---|---|
| Cap | 5 issuances | `rate-limiting.duplicate-certificate.max-per-window` |
| Window | 168h (7 days) | `rate-limiting.duplicate-certificate.window` |
| Disable | — | `rate-limiting.duplicate-certificate.enabled: false` |

The set is canonicalised (lowercased, sorted, deduplicated, wildcards preserved) and hashed; the count uses an indexed DB lookup. **Revoked certificates are excluded** so legitimate post-revocation reissuance is not blocked. When the limit is hit, the response is HTTP 429 with a precise `Retry-After` (the moment the oldest in-window certificate falls out of the window).

See [Rate Limiting](../configuration/rate-limiting#duplicate-certificate).

### Forced Renewal via ARI

Hortval implements ACME Renewal Information (RFC 9773). For a **revoked** certificate, the suggested renewal window collapses to `[now, now]`, instructing compliant clients (recent certbot, acme.sh, lego, Caddy, Traefik) to renew immediately. This makes revocation a usable rollover tool for key compromise, template misconfiguration, or rotation.

For non-revoked certificates, ARI spreads renewals across a configurable window in the last third of the certificate's lifetime, avoiding thundering-herd reissue across thousands of clients.

See [Renewal Information](../configuration/renewal-info).
