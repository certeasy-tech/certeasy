---
sidebar_position: 2
title: acme.sh
---

# acme.sh

[acme.sh](https://github.com/acmesh-official/acme.sh) is a pure shell client — useful when Python (certbot) or Go (lego) aren't available, or simply when minimum runtime footprint matters. This page covers the acme.sh-specific bits; for the general onboarding flow and trust-store setup see [First Certificate](../getting-started/first-certificate.md).

:::info Documented for acme.sh **3.x** (tested with the latest `neilpang/acme.sh:latest` Docker image)
acme.sh's CLI has been stable for years — `--issue` / `--renew` / `--revoke` and their flags work identically across 2.x and 3.x. If you are on an older version and a flag is missing, upgrade is the recommended path.
:::

## What changes vs certbot

- **Key type**: acme.sh generates **RSA 2048** by default. This is **refused** by Certeasy under the default `signature.min-rsa-bits: 3072` policy — always pass `--keylength` explicitly:
  - `--keylength 3072` or `4096` for RSA
  - `--keylength ec-256` or `ec-384` for ECDSA
- **CSR EKU — read this carefully**: acme.sh's built-in OpenSSL template declares **both `serverAuth` and `clientAuth`** in the CSR's Extended Key Usage, regardless of intended purpose. By default Certeasy rejects this combination, returning `badCSR: EKU 1.3.6.1.5.5.7.3.2 in CSR not allowed by policy`.

  Two paths to make it work:

  1. **Strict (preferred from June 2026)**: drop `clientAuth` from acme.sh's CSR template. The CA/B Forum baseline forbids the `serverAuth + clientAuth` combination on publicly-trusted server certificates from June 2026 onwards — production deployments should align even when fronted by an internal ADCS. The cleanest way is to maintain a private fork of `acme.sh` or to override its OpenSSL config file (`~/.acme.sh/openssl.cnf` if you use `--certhome`).
  2. **Pragmatic (existing fleet)**: add `clientAuth` to the policy's `csr.allowed-extra-eku` on the Certeasy side. See [Configuration → Issuance policies → EKU](../configuration/issuance-policies.md). This unblocks acme.sh as-is; plan a migration before June 2026.

- **Trust store**: acme.sh uses curl under the hood. Point both `--ca-bundle` and the `CA_BUNDLE` / `CURL_CA_BUNDLE` env vars at your OS bundle:

```bash
# Debian / Ubuntu
export CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
export CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
# RHEL / CentOS / Rocky
export CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt
export CURL_CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt
```

`--ca-bundle` is for the ACME server's TLS cert; `CURL_CA_BUNDLE` covers the underlying curl invocations acme.sh uses for some HTTP calls. Setting both is belt-and-braces.

- **Built-in scheduler**: acme.sh installs its own daily cron entry via `--install-cronjob`, no systemd timer to write.

## HTTP-01 (standalone)

```bash
acme.sh --issue \
  --server https://acme.corp.internal/acme/directory \
  --ca-bundle /etc/ssl/certs/ca-certificates.crt \
  --standalone \
  --keylength 3072 \
  -d app.corp.internal
```

Cert + key land under `~/.acme.sh/app.corp.internal/`:
- `fullchain.cer` — leaf + chain.
- `app.corp.internal.cer` — leaf only.
- `app.corp.internal.key` — private key.
- `ca.cer` — chain only.

acme.sh's `--standalone` binds port 80 with a tiny built-in server for the duration of the challenge.

## HTTP-01 (webroot)

```bash
acme.sh --issue \
  --server https://acme.corp.internal/acme/directory \
  --ca-bundle /etc/ssl/certs/ca-certificates.crt \
  --webroot /var/www/html \
  --keylength 3072 \
  -d app.corp.internal
```

acme.sh writes the challenge token under `/var/www/html/.well-known/acme-challenge/`. The web server must serve that path over HTTP without authentication.

## TLS-ALPN-01

```bash
acme.sh --issue \
  --server https://acme.corp.internal/acme/directory \
  --ca-bundle /etc/ssl/certs/ca-certificates.crt \
  --alpn \
  --keylength 3072 \
  -d app.corp.internal
```

Same constraint as HTTP-01 standalone but on port 443.

## DNS-01 (for wildcards)

acme.sh has its own catalogue of DNS plugins under `~/.acme.sh/dnsapi/`. Configure with env vars and pass `--dns dns_<provider>`:

:::warning Disable the public DNS pre-check on intranet deployments
By default, acme.sh resolves the just-installed `_acme-challenge.<domain>` TXT
record through public DoH resolvers (Cloudflare, Google) before notifying
Certeasy. On an internal-only deployment this check **will always fail** —
the names do not exist publicly — and worse, the internal domain name is
leaked in cleartext to the public resolvers.

Pass `--dnssleep <N>` to skip the pre-check and wait `N` seconds before
notifying the server. A short value such as `--dnssleep 1` is enough when
the DNS plugin updates the authoritative server synchronously
(`dns_nsupdate`, BIND/Knot RFC 2136, MS DNS via `dns_namesilo` etc.);
larger values may be required for providers with slow API propagation.
:::


```bash
# Example: RFC 2136 / nsupdate
export NSUPDATE_SERVER='10.0.0.53'
export NSUPDATE_KEY='/etc/acme.sh/keyfile'

acme.sh --issue \
  --server https://acme.corp.internal/acme/directory \
  --ca-bundle /etc/ssl/certs/ca-certificates.crt \
  --dns dns_nsupdate \
  --dnssleep 1 \
  --keylength 3072 \
  -d '*.corp.internal'
```

The full list of plugins is in acme.sh's [DNS API documentation](https://github.com/acmesh-official/acme.sh/wiki/dnsapi).

## Renewal

acme.sh installs its own daily cron entry. Enable it once after the first issuance:

```bash
acme.sh --install-cronjob
```

The cron job runs `acme.sh --cron` daily; certs within 30 days of expiration are renewed automatically. To force a one-off renewal:

```bash
acme.sh --renew -d app.corp.internal --force
```

## Revocation

```bash
acme.sh --revoke -d app.corp.internal \
  --server https://acme.corp.internal/acme/directory \
  --ca-bundle /etc/ssl/certs/ca-certificates.crt
```
