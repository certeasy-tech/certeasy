---
sidebar_position: 1
title: lego
---

# lego

[lego](https://go-acme.github.io/lego/) is a single static Go binary with no runtime dependency — ideal for container images, CI runners, and minimal Linux installs. This page covers the lego-specific bits; for the general onboarding flow and trust-store setup see [First Certificate](../getting-started/first-certificate.md).

:::info Documented for lego **5.x** (tested with 5.0.2)
lego 5.0 introduced a CLI breaking change: every flag (`--server`, `--email`, `--domains`, `--http`, `--dns`, etc.) is now a **subcommand flag**, not a global flag. The subcommand (`run`, `renew`, `revoke`) must come first. The legacy `renew` and top-level `revoke` are gone — use `run --renew-force` and `certificates revoke`. If you are still on lego 4.x, the global-flag-first syntax of the old documentation applies; consider upgrading.
:::

## What changes vs certbot

- **Key type**: lego generates **ECDSA P-256** keys by default for both the ACME account and the certificate. This sidesteps the `signature.min-rsa-bits` policy entirely. To force RSA, pass `--key-type rsa3072` (or `rsa4096`). `rsa2048` will be refused under the default `min-rsa-bits: 3072` policy. See [FAQ → RSA-only templates](/reference/faq#rsa-only-templates).
- **CSR EKU**: lego declares `serverAuth` only in its CSR — no `clientAuth` smuggling, no need to loosen `csr.allowed-extra-eku` on the policy.
- **Trust store**: lego reads a single PEM file pointed at by the env var `LEGO_CA_CERTIFICATES`. Point it at your OS bundle to keep one source of truth:

```bash
# Debian / Ubuntu
export LEGO_CA_CERTIFICATES=/etc/ssl/certs/ca-certificates.crt
# RHEL / CentOS / Rocky
export LEGO_CA_CERTIFICATES=/etc/pki/tls/certs/ca-bundle.crt
```

- **No built-in scheduler**: unlike certbot's `certbot.timer` or acme.sh's `--install-cronjob`, lego expects you to wire renewal yourself via a systemd timer or cron job.

:::note Command-line layout
The `run`, `renew`, and `revoke` subcommands come **first**, then the flags that configure them (`--server`, `--email`, `--domains`, `--http`, `--dns`, ...). Only logging flags (`--log.level`, `--log.format`) and `--config` are global and may appear before the subcommand.
:::

## HTTP-01 (standalone)

```bash
export LEGO_CA_CERTIFICATES=/etc/ssl/certs/ca-certificates.crt

lego run \
     --server https://acme.corp.internal/acme/directory \
     --email ops@corp.internal \
     --accept-tos \
     --http \
     --domains app.corp.internal \
     --path /etc/lego
```

Cert + chain + key land under `/etc/lego/certificates/`:
- `app.corp.internal.crt` — the full chain (leaf first, then any intermediates).
- `app.corp.internal.key` — the private key.
- `app.corp.internal.issuer.crt` — issuer cert only.

`lego` opens port 80 inside the process to answer the HTTP-01 challenge, then exits. Port 80 must therefore be free at the moment of the call. On systems where another service holds port 80 permanently, see [HTTP-01 webroot](#http-01-webroot) below.

## HTTP-01 (webroot)

When a web server is already serving on port 80, use the `webroot` solver instead. lego writes the challenge token to a directory of your choice; the web server only has to serve `/.well-known/acme-challenge/` from there.

```bash
lego run \
     --server https://acme.corp.internal/acme/directory \
     --email ops@corp.internal \
     --accept-tos \
     --http.webroot /var/www/html \
     --domains app.corp.internal \
     --path /etc/lego
```

## TLS-ALPN-01

```bash
lego run \
     --server https://acme.corp.internal/acme/directory \
     --email ops@corp.internal \
     --accept-tos \
     --tls \
     --domains app.corp.internal \
     --path /etc/lego
```

lego binds port 443 with the ACME-specific ALPN protocol; Certeasy probes the IP at port 443 with ALPN `acme-tls/1` to verify ownership. Useful when port 80 is unavailable but port 443 is free.

## DNS-01 (for wildcards)

lego ships built-in plugins for ~80 DNS providers — no extra package needed. Pick the one matching your DNS, configure it via env vars, and pass `--dns <provider>`.

:::warning Point the propagation check at your internal resolver
By default, lego waits until the just-installed `_acme-challenge.<domain>` TXT
record is visible through public resolvers (Cloudflare `1.1.1.1`, Google
`8.8.8.8`) before notifying Certeasy. On an internal-only deployment that
check **will never succeed** — the names do not exist publicly — and worse,
the internal domain name is leaked in cleartext to those resolvers.

Use `--dns.resolvers=<host:port>` to point the propagation probe at your
authoritative internal resolver instead. This keeps the sanity check
(detects a misconfigured plugin) without leaking anything outside:

```bash
lego run \
     --dns rfc2136 \
     --dns.resolvers '10.0.0.53:53' \
     ...
```

If the propagation check is not desired at all (synchronous plugin, very
short TTLs, etc.) pass `--dns.propagation.disable-ans` (authoritative
nameservers) and/or `--dns.propagation.disable-rns` (recursive resolvers)
to skip it entirely. `--dns.propagation.wait <duration>` replaces the
check with a fixed sleep when neither flag fits.
:::


```bash
export LEGO_CA_CERTIFICATES=/etc/ssl/certs/ca-certificates.crt
# Example: RFC 2136 / nsupdate against an internal Bind server
export RFC2136_NAMESERVER='10.0.0.53'
export RFC2136_TSIG_KEY='acme.'
export RFC2136_TSIG_SECRET='<base64-secret>'
export RFC2136_TSIG_ALGORITHM='hmac-sha256.'

lego run \
     --server https://acme.corp.internal/acme/directory \
     --email ops@corp.internal \
     --accept-tos \
     --dns rfc2136 \
     --dns.resolvers '10.0.0.53:53' \
     --domains '*.corp.internal' \
     --path /etc/lego
```

For internal infrastructures without a public DNS provider, `rfc2136` against your own Bind/PowerDNS is usually the simplest path. The full list of providers is in lego's [DNS providers documentation](https://go-acme.github.io/lego/dns/).

## Renewal

lego has no built-in scheduler. `lego run` itself issues or renews depending on whether the cert is already on disk — call it on a schedule (systemd timer, cron) and pass `--renew-days N` to actually do the renew only when the cert is within N days of expiration. Add `--renew-force` if you want to force a renew regardless:

```bash
lego run \
     --server https://acme.corp.internal/acme/directory \
     --email ops@corp.internal \
     --accept-tos \
     --http \
     --domains app.corp.internal \
     --path /etc/lego \
     --renew-days 30
```

Minimal systemd setup (`/etc/systemd/system/lego-renew.service` + `lego-renew.timer`):

```ini
# lego-renew.service
[Unit]
Description=Renew certificates via lego

[Service]
Type=oneshot
Environment=LEGO_CA_CERTIFICATES=/etc/ssl/certs/ca-certificates.crt
ExecStart=/usr/local/bin/lego run \
  --server https://acme.corp.internal/acme/directory \
  --email ops@corp.internal \
  --accept-tos \
  --http \
  --domains app.corp.internal \
  --path /etc/lego \
  --renew-days 30

# lego-renew.timer
[Unit]
Description=Daily lego renewal check

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=4h

[Install]
WantedBy=timers.target
```

Enable with `systemctl enable --now lego-renew.timer`.

## Revocation

```bash
LEGO_PATH=/etc/lego lego certificates revoke \
     --server https://acme.corp.internal/acme/directory \
     --email ops@corp.internal \
     --cert.name app.corp.internal
```

`--cert.name` is the certificate's ID/name on disk — by default this is the first domain you passed at issuance. `certificates revoke` does not accept `--path` or `--domains`; pass the storage location via the `LEGO_PATH` environment variable instead. Revoke uses the account key — no need to present the certificate key separately.
