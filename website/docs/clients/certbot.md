---
sidebar_position: 1
title: certbot
---

# certbot

[certbot](https://certbot.eff.org/) is the EFF's reference ACME client, Python-based, with the broadest community documentation and the most mature distro packaging. This page is the comprehensive reference; for a 5-minute onboarding tour see [Getting Started → First Certificate](../getting-started/first-certificate.md).

:::info Documented for certbot **3.x** (tested with the latest `certbot/certbot:latest` Docker image)
certbot's CLI has been stable since 1.x — the `certonly` / `renew` / `revoke` subcommands and their flags work identically across recent versions. If you are on an older 1.x or 2.x release, the syntax on this page still applies.
:::

## What changes vs lego / acme.sh

- **Key type**: certbot's default depends on the version — certbot **2.x defaults to ECDSA** (P-256), older versions to **RSA 2048**. Neither satisfies a template (or policy) that mandates RSA 4096, so pass the key type explicitly when you need it: `--key-type rsa --rsa-key-size 4096` for RSA, or `--key-type ecdsa` for ECDSA. See [FAQ → RSA-only templates](/reference/faq#rsa-only-templates).
- **CSR EKU**: certbot declares `serverAuth` only — no `clientAuth` smuggling, no need to loosen `csr.allowed-extra-eku` on the policy.
- **Trust store**: certbot uses Python's own CA bundle (`certifi`), **not** the OS trust store. You point it at the OS bundle via the `REQUESTS_CA_BUNDLE` env var. Once set, the OS trust store becomes the single source of truth for both system commands and certbot.
- **Built-in scheduler**: certbot installs a `certbot.timer` systemd unit on most distros. `systemctl enable --now certbot.timer` is enough to wire renewal.

## Trusting your internal CA

Hortval's HTTPS certificate is signed by your internal ADCS root CA. ACME clients need to trust that CA, otherwise the TLS handshake fails before any certificate request can be made.

The recommended approach is to **deploy your root CA to the OS trust store on all Linux servers** — ideally via your configuration management tool (Ansible, Puppet, Chef…). This is good practice regardless of Hortval: any internal service using TLS with an internal CA benefits from it.

```bash
# Debian / Ubuntu
sudo cp internal-root-ca.pem /usr/local/share/ca-certificates/internal-root-ca.crt
sudo update-ca-certificates
# → consolidated bundle at /etc/ssl/certs/ca-certificates.crt

# RHEL / CentOS / Rocky
sudo cp internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
sudo update-ca-trust
# → consolidated bundle at /etc/pki/tls/certs/ca-bundle.crt
```

With Ansible, this becomes a one-liner across your fleet:

```yaml
- name: Deploy internal root CA
  copy:
    src: internal-root-ca.pem
    dest: /usr/local/share/ca-certificates/internal-root-ca.crt  # adjust for RHEL
  notify: update-ca-certificates
```

**certbot does not use the OS trust store directly** — it uses Python's own CA bundle (`certifi`). Once your CA is in the OS trust store, you can point certbot to the system bundle file with `REQUESTS_CA_BUNDLE`, so both stay in sync automatically:

```bash
# Debian / Ubuntu
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# RHEL / CentOS / Rocky
export REQUESTS_CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt
```

For automated renewal, set this in certbot's systemd service:

```ini
# /etc/systemd/system/certbot.service.d/override.conf
[Service]
Environment="REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt"
```

This way there is a single source of truth: the OS trust store. Update it, and certbot picks up the change automatically.

### `--no-verify-ssl` (testing only)

:::danger Do not use in production
`--no-verify-ssl` disables TLS certificate verification entirely. The client has no guarantee it is talking to your Hortval instance — the connection could be intercepted. Acceptable for a quick local test, never for production or automated renewal.
:::

## HTTP-01 (standalone)

The simplest approach: certbot spins up a temporary HTTP server on port 80 to answer the challenge.

```bash
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
certbot certonly \
  --standalone \
  --preferred-challenges http \
  --server https://acme.corp.internal/acme/directory \
  -d app.corp.internal
```

Certbot opens port 80, Hortval fetches `http://app.corp.internal/.well-known/acme-challenge/<token>`, and on success submits the CSR to ADCS. The signed certificate is written to `/etc/letsencrypt/live/app.corp.internal/`.

## HTTP-01 (webroot)

If a web server is already running on port 80, use `--webroot` instead of `--standalone`:

```bash
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
certbot certonly \
  --webroot -w /var/www/html \
  --preferred-challenges http \
  --server https://acme.corp.internal/acme/directory \
  -d app.corp.internal
```

Certbot writes the challenge file under `/var/www/html/.well-known/acme-challenge/`. Your web server must serve that path over HTTP.

## DNS-01 (for wildcards)

HTTP-01 and TLS-ALPN-01 cannot validate wildcard names (`*.corp.internal`) — RFC 8555 §8.4 limits them to DNS-01.

```bash
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
certbot certonly \
  --manual \
  --preferred-challenges dns \
  --server https://acme.corp.internal/acme/directory \
  -d "*.corp.internal"
```

certbot prompts you interactively to add the `_acme-challenge.corp.internal` TXT record. For automation, install a DNS plugin matching your provider (`certbot-dns-route53`, `certbot-dns-rfc2136`, …) and use `--dns-<plugin>` flags instead of `--manual`.

## Renewal

Once the certificate is issued, certbot can renew it automatically via the `certbot.timer` systemd unit:

```bash
# Test renewal
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
certbot renew --dry-run

# Enable automatic renewal
systemctl enable --now certbot.timer
```

Renewal config is stored under `/etc/letsencrypt/renewal/<domain>.conf` and inherits the flags used at the initial `certonly` call.

## Revocation

```bash
certbot revoke --cert-name app.corp.internal \
  --server https://acme.corp.internal/acme/directory
```

`--cert-name` is the directory name under `/etc/letsencrypt/live/`. Add `--no-delete-after-revoke` if you want to keep the files on disk after revocation.

## With Caddy (automatic, no certbot)

If you run Caddy as your reverse proxy, it can handle ACME directly — no certbot involvement, no renewal scripts to write:

```
{
  acme_ca https://acme.corp.internal/acme/directory
  acme_ca_root /path/to/your/internal-ca.pem
}

app.corp.internal {
  reverse_proxy localhost:8080
}
```

Caddy uses HTTP-01 by default for non-wildcard names. For wildcards, configure a DNS module from [caddy-dns](https://github.com/caddy-dns).
