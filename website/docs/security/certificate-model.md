---
sidebar_position: 1
title: Certificate Security Model
---

# Certificate Security Model

Certeasy enforces a strict certificate identity model at issuance time. This behavior is **mandatory, non-configurable, and secure by default**.

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

EKU values are **forced by policy**. CSR-provided EKU values are ignored or rejected.

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

Certeasy enforces a single safe issuance model.

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
- ⚠️ **Operator responsibility**: do not configure `certificate-template` to point at an Enrollment Agent template. Certeasy does not validate the template type.

---

### ESC4 / ESC5 — Dangerous CA or Template Permissions

**Attack**: An attacker modifies CA or template permissions to issue malicious certificates.

**Mitigations**:
- Template selection not exposed to ACME clients — enforced in code, clients cannot influence which template is used
- Enrollment runs under the Certeasy service account *(architectural)*
- ⚠️ **Operator responsibility**: create a dedicated ADCS template for ACME issuance and grant only Enroll permission to the Certeasy service account

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
- All certificate operations are recorded in the audit log (`acme_audit_logs`) *(enforced)*
- ACME protocol supports automated renewal — clients can request new certificates before expiry *(architectural)*
- ⚠️ **Operator responsibility**: configure the ADCS template with a short validity period (30–90 days recommended). Certeasy does not currently enforce a maximum validity on ADCS-issued certificates. See [Security TODO](/security/TODO).

---

### ESC13 — Cross-Forest Certificate Abuse

**Attack**: Certificates trusted across forests allow lateral movement.

**Mitigations**: EKU restricted to Server Authentication. No user or machine authentication EKUs. No identity-bearing Subject or SAN fields.
