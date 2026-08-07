---
sidebar_position: 1
title: FAQ
---

# Frequently asked questions

## My PKI / ADCS template only allows RSA — how do I configure Certeasy? {#rsa-only-templates}

RSA-only templates (for example a Microsoft ADCS template with a minimum key
size of 4096 and an RSA provider) reject ECDSA keys. Two different keys are
involved, and both must be RSA.

**1. Certeasy's own server certificate.** Certeasy generates this key and
defaults to ECDSA P-256. Pin it to RSA on the certificate-manager bundle:

```yaml
tls-certificate-manager:
  bundles:
    - name: server
      mode: pki
      authority: ca1
      key:
        type: rsa
        size: 4096
```

See [TLS certificate manager → Key type](/0.9.4/configuration/tls#key-type).

**2. Certificates issued to ACME clients.** Here the *client* generates the key,
so the key type is chosen on the client, not in Certeasy. Most clients default to
ECDSA (or RSA 2048), which an RSA-4096 template rejects — set it explicitly:

| Client | Option |
|---|---|
| lego | `--key-type rsa4096` |
| certbot | `--key-type rsa --rsa-key-size 4096` |
| acme.sh | `--keylength 4096` |

**3. (Recommended) Reject a wrong key early.** Constrain the issuance policy to
match the template, so a non-conforming client request is refused by Certeasy
with a clear message rather than forwarded and denied opaquely by the CA:

```yaml
issuance-policies:
  - name: adcs-rsa
    signature:
      allowed-algorithms:
        - "RSA-SHA256"
        - "RSA-SHA384"
        - "RSA-SHA512"
      min-rsa-bits: 4096
```

:::note
Lists must be written as block sequences (one `-` item per line). Certeasy's
configuration parser does not accept YAML flow sequences (`["a", "b"]`) and
will refuse to start with `expected sequence (use '-' items)`.
:::

:::tip
Use a certificate template **dedicated** to Certeasy — it lets the key
requirement, the SAN policy and the revocation permission be scoped to Certeasy
without affecting your other templates. Run
[`certeasy adcs check`](/0.9.4/configuration/adcs#preflight-your-setup-certeasy-adcs-check)
to confirm the template is published and see its key requirement before you
start the server.
:::
