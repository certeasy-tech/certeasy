---
sidebar_position: 99
title: Security TODO
---

# Security TODO

This page tracks security mitigations that are **claimed in the documentation but not currently enforced by Certeasy code**. These are either operator responsibilities or planned enforcement features.

---

## ESC12 — Short Validity Periods

**Claim in docs**: "Short validity periods" is listed as a Certeasy mitigation.

**Reality**: For ADCS authorities, certificate validity is controlled entirely by the ADCS template configuration. Certeasy does not inspect or enforce validity periods on ADCS-issued certificates. The 90-day limit only exists in the `fake` (test) PKI backend.

**Gap**: An ADCS template could issue 10-year certificates and Certeasy would accept and serve them without complaint.

**Proposed fix**: Add an optional `max-validity` field to authority or issuance-policy config. If the issued certificate's `NotAfter` exceeds the configured maximum, Certeasy refuses to store and return it.

---

## ESC3 — No Enrollment Agent Templates

**Claim in docs**: "No Enrollment Agent templates used."

**Reality**: This is purely an operator configuration responsibility. Certeasy does not inspect or validate the ADCS template it is configured to use. Nothing prevents an operator from pointing `certificate-template` at an Enrollment Agent template.

**Gap**: No validation that the configured template is safe.

**Proposed fix**: Document clearly as operator responsibility (not a Certeasy enforcement). Optionally: warn or refuse if the issued certificate contains Enrollment Agent EKU (`1.3.6.1.4.1.311.20.2.1`).

---

## ESC4/ESC5 — Enrollment Permissions Restricted to Service Account

**Claim in docs**: "Enrollment permissions restricted to service account."

**Reality**: Architectural — Certeasy calls `certreq.exe` under its own service account, so clients never authenticate to ADCS directly. However, Certeasy cannot verify or enforce what permissions the service account has on the ADCS template. A misconfigured service account with Write/Manage permissions on the template would be a risk Certeasy cannot detect.

**Gap**: No validation of service account permissions.

**Proposed fix**: Document as operator responsibility. Consider adding a startup check that verifies the service account only has Enroll (not Manage/Write) on the ADCS template, using `certutil -v -template`.

---

## ESC12 — Full Audit Logging

**Claim in docs**: "Full audit logging."

**Reality**: Certeasy logs certificate operations (submission, issuance, revocation) via its structured logger. However, there is no dedicated, tamper-evident audit log file separate from the application log. Log integrity depends entirely on the operator's log aggregation and storage setup.

**Gap**: No dedicated audit log with guaranteed durability/integrity.

**Proposed fix**: Already tracked separately — the `acme_audit_logs` database table stores all actions. Consider exposing a dedicated audit log export endpoint or file.

---

## Notes

Mitigations **fully enforced in Certeasy code** (not listed here):
- Subject validation: only empty or `CN=<dns>` allowed (`common/x509v/certificate_context.go`)
- SAN validation: DNS names only, no otherName/UPN/email/IP/URI (`common/x509v/certificate_context.go`)
- EKU: forced to Server Authentication, not configurable by clients
- Template selection: not exposed to ACME clients
- CSR structural validation: no ASN.1 smuggling, duplicate extensions, etc.
