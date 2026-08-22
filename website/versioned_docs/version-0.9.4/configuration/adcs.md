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
[Authorities → Connector](./authorities.md#connector-native-default-or-certreqexe).
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
[Authorities → Revocation](./authorities.md#revocation) for the full
revocation behavior (asynchronous publication, authorization modes, accepted
reason codes).

:::tip Use a dedicated template
We recommend a certificate template dedicated to Certeasy. It lets the key
requirement, the SAN policy and the Certificate Manager permission all be scoped
to Certeasy, with no side effects on your other templates.
:::

:::note RSA-only templates
If your template mandates RSA (e.g. a minimum key size of 4096), both Certeasy's
own certificate and the ACME clients' certificates must use RSA. See the FAQ:
[My PKI / ADCS template only allows RSA](../reference/faq.md#rsa-only-templates).
:::

## Preflight your setup: `certeasy adcs check`

Before starting the server, verify the ADCS setup against the live CA:

```bash
certeasy adcs check -f config.yml
```

It is **read-only** — no certificate is requested — and reports, for each ADCS
authority:

- whether the CA is reachable,
- whether the certificate template is **published**,
- the template's **key requirement** (so you can set the matching `key:` and
  issuance policy).

Run it on the Certeasy host (it uses `certutil`, so it is Windows-only; on other
platforms it reports "skipped"). Exit code `0` means every check passed, `1`
means at least one failed.

The interactive [`certeasy init`](../getting-started/wizard.md) wizard runs the
same checks: it lists the CA's published templates so you pick the exact one, and
reads the template's key requirement to set the server certificate key for you.
