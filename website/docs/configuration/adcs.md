---
sidebar_position: 2
title: ADCS Configuration
---

# ADCS Configuration

:::caution Work in progress
This page is not yet complete. Content and best practices will be added shortly.
:::

:::tip Connector choice
Certeasy reaches ADCS through a **native in-process connector by default**
(`type: adcs`), with a `certreq.exe` fallback (`type: adcs-cli`). See
[Authorities → Connector](/configuration/authorities#connector-native-default-or-certreqexe).
:::

This page will cover:

- Prerequisites on the ADCS host
- Creating a certificate template for ACME enrollment
- Setting the correct permissions (enroll rights for the Certeasy service account)
- Finding the correct `ca-name` value (`certutil -CA`)
- Recommended template settings (key usage, validity, issuance requirements)
- Security best practices (least-privilege service account, auditing, etc.)

## Permissions: enrollment vs revocation

Certeasy needs **different CA privileges depending on what it does**:

| Operation | Required ADCS rights |
|---|---|
| **Enrollment** (issuing certificates) | *Read* + *Enroll* on the template, and *Request Certificates* on the CA. |
| **Revocation** (propagating revocations to the CA) | The **Certificate Manager** role — the *Issue and Manage Certificates* permission on the CA. This is a CA-administration privilege, higher than enrollment. |

If the Certeasy service account has enrollment rights but **not** the Certificate
Manager role, issuance works while revocation fails with *Access Denied*. If you
cannot (or do not want to) grant that role, disable CA propagation per authority
with `disable-ca-revocation: true` — see
[Authorities → Revocation](/configuration/authorities#revocation) for the full
revocation behavior (asynchronous publication, authorization modes, accepted
reason codes).
