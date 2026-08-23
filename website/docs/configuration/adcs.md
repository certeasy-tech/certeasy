---
sidebar_position: 2
title: ADCS Configuration
---

# ADCS Configuration

:::tip Connector choice
Hortval reaches ADCS through a **native in-process connector by default**
(`type: adcs`), with a `certreq.exe` fallback (`type: adcs-cli`). See
[Authorities → Connector](./authorities.md#connector-native-default-or-certreqexe).
:::

This page covers what Hortval needs from the CA side: the privileges its service
account requires, how to serve ACME clients that ask for EC and for RSA keys, and
how to check a setup before going live. Creating the certificate template itself
in `certtmpl.msc` is not covered here yet.

## Permissions: enrollment vs revocation

Hortval needs **different CA privileges depending on what it does**:

| Operation | Required ADCS rights |
|---|---|
| **Enrollment** (issuing certificates) | *Read* + *Enroll* on the template, and *Request Certificates* on the CA. |
| **Revocation** (propagating revocations to the CA) | The **Certificate Manager** role — the *Issue and Manage Certificates* permission on the CA. This is a CA-administration privilege, higher than enrollment. |

If the Hortval service account has enrollment rights but **not** the Certificate
Manager role, issuance works while revocation fails with *Access Denied*. If you
cannot (or do not want to) grant that role, disable CA propagation per authority
with `disable-ca-revocation: true` — see
[Authorities → Revocation](./authorities.md#revocation) for the full
revocation behavior (asynchronous publication, authorization modes, accepted
reason codes).

:::tip Use a dedicated template
We recommend a certificate template dedicated to Hortval. It lets the key
requirement, the SAN policy and the Certificate Manager permission all be scoped
to Hortval, with no side effects on your other templates.
:::

:::note RSA-only templates
If your template mandates RSA (e.g. a minimum key size of 4096), both Hortval's
own certificate and the ACME clients' certificates must use RSA. See the FAQ:
[My PKI / ADCS template only allows RSA](../reference/faq.md#rsa-only-templates).
:::

## Serving both EC and RSA clients

An ADCS template can pin the **key algorithm**, not only the key size — the CNG
settings a template carries (`msPKI-RA-Application-Policies`) can require, say,
`ECDH_P256`. Such a template refuses an RSA request, and vice versa. Meanwhile
ACME clients disagree on their default: lego and certbot generate ECDSA, acme.sh
generates RSA. One pinned template therefore splits your client population in
two.

**The refusal is hard to read**, which is the reason to know about it in advance.
The CA accepts the request, applies the template, builds the certificate content
— and *then* denies it:

```
ADCS denied the request (CR_DISP_DENIED): 0x80094003
CA message: Denied by Policy Module
```

Nothing there names the key. In particular it is **not**
`CERTSRV_E_KEY_LENGTH`: an RSA 3072 key satisfies a template whose *minimum key
size* is 256, so the size check passes and only the algorithm mismatches.
Enrollment rights are not involved either — other clients keep succeeding
against the same template with the same account.

You have two options.

### Option 1 — one template that accepts both

Leave the template without a CNG algorithm requirement and it signs whatever the
client brings. Simplest, and it is what a `WebServer` clone does by default. The
cost: a single *minimum key size* now has to cover both families, so a value low
enough for P-256 also accepts a weak RSA key.

### Option 2 — one authority per template

Keep the pinned templates and declare **one authority per template**. The
routing then happens at the authority, not at the policy the client sees:

```yaml
authorities:
  - name: ca-ec
    type: adcs
    policies:
      - ec-only          # this authority's own policy
    configuration:
      ca-name: "PKI\\CORP-CA"
      certificate-template: "ACME-Server-EC"
  - name: ca-rsa
    type: adcs
    policies:
      - rsa-only
    configuration:
      ca-name: "PKI\\CORP-CA"
      certificate-template: "ACME-Server-RSA"

issuance-policies:
  # The policy ACME orders are bound to. It must accept BOTH key types —
  # see the caution below.
  - name: corp-server
    dns:
      allow:
        - ".corp.example/3"

  - name: ec-only
    dns:
      allow:
        - ".corp.example/3"
    signature:
      allowed-algorithms: ["ECDSA-SHA256"]
      allowed-ec-curves: ["P-256"]

  - name: rsa-only
    dns:
      allow:
        - ".corp.example/3"
    signature:
      allowed-algorithms: ["RSA-SHA256"]
      min-rsa-bits: 3072

policy-bindings:
  - policy: corp-server
    authorities: [ca-ec, ca-rsa]
  - policy: ec-only
    authorities: [ca-ec]
  - policy: rsa-only
    authorities: [ca-rsa]
```

At finalize, Hortval validates the CSR against **each candidate authority's own
policies** and keeps the authorities that accept it. An ECDSA CSR satisfies
`ec-only` and fails `rsa-only`, so it is issued from `ACME-Server-EC`; an RSA CSR
does the opposite. Each family also gets its own floor — P-256 on one side,
RSA 3072 on the other — which a single template cannot express.

:::caution Do not constrain the key on the order's policy
`corp-server` deliberately carries **no `signature:` block**. The policy an ACME
order is bound to is chosen when the order is created — *before the client has
sent its CSR* — from the requested DNS names alone, and it is pinned there so
that a client cannot steer which CA template signs its request. Adding a key
constraint to it would therefore **reject** one family of clients outright
instead of routing it: the order is already pinned by the time the CSR arrives,
and the other policy is never consulted.

Two consequences:

- **Declaration order matters.** Several policies covering the same names are
  legitimate; the first one whose names validate wins the order. Keep the
  order-facing policy first.
- **The template becomes the floor for what the order policy no longer states.**
  A CSR the order policy accepts can still be refused later, either by an
  authority policy or by the CA itself.
:::

:::caution An issuance policy is not a proxy for the template
The policy says what ACME clients are **allowed to ask for**; the template says
what the CA will **sign**. Hortval does not read the template, so nothing keeps
the two aligned — you align them by hand. A policy looser than the template turns
a clean refusal by Hortval into a CA denial mid-issuance; a policy stricter than
the template refuses requests the CA would have signed.
:::

With a single template and a single authority, none of this applies: keep one
policy and omit `policy-bindings` entirely.

## Preflight your setup: `hortval adcs check`

Before starting the server, verify the ADCS setup against the live CA:

```bash
hortval adcs check -f config.yml
```

It is **read-only** — no certificate is requested — and reports, for each ADCS
authority:

- whether the CA is reachable,
- whether the certificate template is **published**,
- the template's **key requirement** (so you can set the matching `key:` and
  issuance policy).

Run it on the Hortval host (it uses `certutil`, so it is Windows-only; on other
platforms it reports "skipped"). Exit code `0` means every check passed, `1`
means at least one failed.

The interactive [`hortval init`](../getting-started/wizard.md) wizard runs the
same checks: it lists the CA's published templates so you pick the exact one, and
reads the template's key requirement to set the server certificate key for you.
