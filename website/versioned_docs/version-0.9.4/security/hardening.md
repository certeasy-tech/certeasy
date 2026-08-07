---
sidebar_position: 99
title: ADCS hardening & shared responsibility
---

# ADCS hardening & shared responsibility

Certeasy bridges ACME to your existing PKI; it does not replace your AD CS
hardening. Several well-known AD CS misconfiguration classes (the "ESCx" escalation
paths) live **in the CA and template configuration you operate**, not in Certeasy.
This page maps those boundaries so you can review them with your PKI/AD team during
deployment — what Certeasy handles, what stays on your side, and where an optional
Certeasy-side check could be added for defense-in-depth.

None of the items below are Certeasy defects; they are properties of the
surrounding environment worth confirming together.

---

## Certificate validity periods

**Where it's handled**: for ADCS authorities, certificate validity comes entirely
from the ADCS template. Certeasy honors it as-is (the 90-day limit only applies to
the built-in `fake` test PKI).

**To confirm together**: that your templates issue appropriately short-lived
certificates for the use case.

**Optional Certeasy-side check** (on request): a `max-validity` limit on the
authority / issuance-policy that refuses a certificate whose `NotAfter` exceeds it.

---

## Extended Key Usage on the issued certificate (incl. ESC3)

**Where it's handled**: the EKUs on the issued certificate are defined by the ADCS
template, not by Certeasy. Certeasy constrains what an ACME **client** may request
in its CSR (Server Authentication only; extra EKUs are rejected unless you allow
them via `csr.allowed-extra-eku`) — but the template has the final say. If the
template itself grants additional EKUs, the issued certificate carries them and
Certeasy passes it through. A template that hands out an Enrollment Agent EKU
(`1.3.6.1.4.1.311.20.2.1`) or Any Purpose is the classic ESC3 case.

**To confirm together**: that the template grants only the EKUs the certificate
actually needs. This is owned by whoever creates the template.

**Optional Certeasy-side check** (on request): warn or refuse if the issued
certificate carries EKUs beyond an allow-list (e.g. Enrollment Agent).

---

## Service-account enrollment permissions (ESC4/ESC5)

**Where it's handled**: architectural on the Certeasy side — Certeasy enrolls under
its own service account (in-process with the native connector, or via `certreq.exe`
with `adcs-cli`), so ACME clients never authenticate to ADCS directly. The
permissions that account holds on the template are set in AD, which Certeasy cannot
change or fully verify.

**To confirm together**: that the service account has only what it needs (Enroll,
plus the Certificate Manager role only if you want CA-side revocation) — not
Write / Manage on the template.

**Optional Certeasy-side check** (on request): a startup check that inspects the
template with `certutil -v -template` and warns on excess rights.

---

## Audit logging

**Where it's handled**: Certeasy ships a dedicated, tamper-evident audit log (JSONL
with an HMAC chain, verifiable via `certeasy audit verify`) covering account, order,
challenge, issuance and revocation events — independent of the application log. See
[Audit log](../administration/audit.md).

**To confirm together**: retention, off-host shipping and access control for that
log file, which remain on your operational side.

---

## Enforced entirely by Certeasy (for reference)

Handled in Certeasy code, no operator action needed:

- Subject validation: only empty or `CN=<dns>` accepted (`common/x509v/certificate_context.go`)
- SAN validation: DNS names only — no otherName/UPN/email/IP/URI
- Client CSR EKU: constrained to Server Authentication; extra EKUs rejected unless explicitly allowed via `csr.allowed-extra-eku`
- Template selection: never exposed to ACME clients
- CSR structural validation: no ASN.1 smuggling or duplicate extensions
