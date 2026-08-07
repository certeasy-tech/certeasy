---
sidebar_position: 5
title: First certificate
---

# First Certificate

Goal: prove your Certeasy instance works end-to-end by issuing one certificate. We use **certbot** with **HTTP-01** because it's the safest "out of the box" combination — certbot (2.x and later) defaults to an **ECDSA P-256** key and a `serverAuth`-only EKU, which line up with Certeasy's default policy without any tuning. (On an older certbot that still defaults to RSA 2048, add `--key-type ecdsa` — RSA 2048 is below the default `min-rsa-bits: 3072` and would be refused.)

If you already know which client you want to use, skip straight to its fiche:

| Client | Best fit | Fiche |
|---|---|---|
| **certbot** | Linux servers, distro packages, widest docs | [ACME Clients → certbot](../clients/certbot.md) |
| **lego** | Containers / CI, static binary, ECDSA default | [ACME Clients → lego](../clients/lego.md) |
| **acme.sh** | Minimal systems, pure shell+curl, no Python/Go | [ACME Clients → acme.sh](../clients/acme-sh.md) |

Each fiche covers HTTP-01 (standalone + webroot), DNS-01, renewal and revocation for that specific client, plus the gotchas (key types, trust store, EKU…).

## Prerequisites

- Certeasy running and accessible at `https://acme.corp.internal`
- certbot installed on the target machine
- Port **80** reachable on the target machine from Certeasy's configured DNS resolver
- The target machine's DNS name is allowed by your issuance policy
- Your internal CA deployed to the OS trust store (see [Trusting your internal CA](../clients/certbot.md#trusting-your-internal-ca) on the certbot fiche)

## Issue your first certificate

```bash
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt   # adapt for RHEL
certbot certonly \
  --standalone \
  --preferred-challenges http \
  --server https://acme.corp.internal/acme/directory \
  -d app.corp.internal
```

What happens:
1. certbot opens port 80 inside its process.
2. certbot POSTs an order to Certeasy.
3. Certeasy fetches `http://app.corp.internal/.well-known/acme-challenge/<token>` and verifies the response.
4. Certeasy forwards the CSR to your back-end CA (ADCS or fakepki).
5. certbot writes the issued certificate under `/etc/letsencrypt/live/app.corp.internal/`.

## Check the result

```bash
openssl s_client -connect app.corp.internal:443 -showcerts
```

You should see a certificate issued by your internal CA.

## Next steps

- **Automate renewal**: `systemctl enable --now certbot.timer`. Full details on the [certbot fiche → Renewal](../clients/certbot.md#renewal).
- **Wildcards**: HTTP-01 cannot validate `*.corp.internal`. Switch to DNS-01 — see [DNS-01 on the certbot fiche](../clients/certbot.md#dns-01-for-wildcards).
- **Switch clients**: [lego](../clients/lego.md) for containers/CI, [acme.sh](../clients/acme-sh.md) for minimal systems.

## Troubleshooting

If this minimal scenario fails, the [certbot fiche](../clients/certbot.md) has the comprehensive coverage. Three most common causes on a fresh setup:

- **TLS handshake fails before any cert request**: the internal CA isn't in the OS trust store, and `REQUESTS_CA_BUNDLE` isn't set. Re-read [Trusting your internal CA](../clients/certbot.md#trusting-your-internal-ca).
- **Challenge validation fails**: port 80 isn't reachable from Certeasy's host, or certbot can't bind it (run as root or grant `cap_net_bind_service`).
- **DNS name rejected**: the target FQDN is outside the allow list of your [issuance policy](../configuration/issuance-policies.md).
