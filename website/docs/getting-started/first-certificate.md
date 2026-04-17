---
sidebar_position: 3
title: First Certificate
---

# First Certificate

This guide walks through issuing your first certificate using **certbot** against a running Certeasy instance, using the **HTTP-01** challenge.

## Prerequisites

- Certeasy running and accessible at `https://acme.corp.internal`
- certbot installed on the target machine
- Port **80** reachable on the target machine from Certeasy's configured DNS resolver
- The target machine's DNS name is allowed by your issuance policy

## Trusting your internal CA

Certeasy's HTTPS certificate is signed by your internal ADCS root CA. ACME clients need to trust that CA, otherwise the TLS handshake fails before any certificate request can be made.

The recommended approach is to **deploy your root CA to the OS trust store on all Linux servers** — ideally via your configuration management tool (Ansible, Puppet, Chef…). This is good practice regardless of Certeasy: any internal service using TLS with an internal CA benefits from it.

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

**certbot does not use the OS trust store directly** — it uses Python's own CA bundle (`certifi`). However, once your CA is in the OS trust store, you can point certbot to the system bundle file with `REQUESTS_CA_BUNDLE`, so both stay in sync automatically:

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
`--no-verify-ssl` disables TLS certificate verification entirely. The client has no guarantee it is talking to your Certeasy instance — the connection could be intercepted. Acceptable for a quick local test, never for production or automated renewal.
:::

---

## HTTP-01 with certbot (standalone)

The simplest approach: certbot spins up a temporary HTTP server on port 80 to answer the challenge.

```bash
# With root CA deployed on the system (recommended) (adapt for RHEL)
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt 
certbot certonly \
  --standalone \
  --preferred-challenges http \
  --server https://acme.corp.internal/acme/directory \
  -d app.corp.internal

# Quick test only — insecure, do not use in production
certbot certonly \
  --standalone \
  --preferred-challenges http \
  --server https://acme.corp.internal/acme/directory \
  --no-verify-ssl \
  -d app.corp.internal
```

Certbot opens port 80, Certeasy fetches `http://app.corp.internal/.well-known/acme-challenge/<token>`, and on success submits the CSR to ADCS. The signed certificate is written to `/etc/letsencrypt/live/app.corp.internal/`.

## HTTP-01 with certbot (webroot)

If a web server is already running on port 80, use `--webroot` instead of `--standalone`:

```bash
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt 
certbot certonly \
  --webroot -w /var/www/html \
  --preferred-challenges http \
  --server https://acme.corp.internal/acme/directory \
  --no-verify-ssl \
  -d app.corp.internal
```

Certbot writes the challenge file under `/var/www/html/.well-known/acme-challenge/`. Your web server must serve that path over HTTP.

## HTTP-01 with acme.sh

```bash
acme.sh --issue \
  --server https://acme.corp.internal/acme/directory \
  --insecure \
  -d app.corp.internal \
  -w /var/www/html
```

## Automated renewal

Once the certificate is issued, certbot can renew it automatically:

```bash
# Test renewal
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt 
certbot renew --dry-run

# Enable automatic renewal (systemd timer or cron)
systemctl enable --now certbot.timer
```

## With Caddy (automatic)

Caddy handles ACME automatically — no manual renewal needed:

```
{
  acme_ca https://acme.corp.internal/acme/directory
  acme_ca_root /path/to/your/internal-ca.pem
}

app.corp.internal {
  reverse_proxy localhost:8080
}
```

Caddy uses HTTP-01 by default for non-wildcard names.

## DNS-01 (for wildcard certificates)

HTTP-01 cannot validate wildcard names (`*.corp.internal`). Use DNS-01 instead:

```bash
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt 
certbot certonly \
  --manual \
  --preferred-challenges dns \
  --server https://acme.corp.internal/acme/directory \
  -d "*.corp.internal"
```

certbot will prompt you to add a `_acme-challenge.corp.internal` TXT record. For automated wildcard renewal, use a DNS plugin for your DNS provider.

## Checking the Result

```bash
openssl s_client -connect app.corp.internal:443 -showcerts
```

You should see a certificate issued by your internal ADCS CA.

## Troubleshooting

**Challenge validation fails (HTTP-01)**

- Verify port 80 is open and reachable from Certeasy's host
- Certbot must be running as root (or have permission to bind port 80) for `--standalone`
- Check Certeasy logs for the outbound HTTP request attempt

**Challenge validation fails (DNS-01)**

Check that the TXT record is resolvable from Certeasy's configured DNS server:

```bash
nslookup -type=TXT _acme-challenge.app.corp.internal <your-dns-server>
```

**CSR rejected**

Common causes:
- Key too small (RSA minimum 3072-bit by default)
- DNS name not in the allowed scope of the issuance policy
- Forbidden Subject fields (`O`, `OU`, etc.) in the CSR

**ADCS submission fails**

Verify `ca-name` with `certutil -CA` and ensure the service account has Enroll permission on the certificate template.

```powershell
# Check Certeasy logs on Windows
Get-Content "C:\ProgramData\certeasy\certeasy.log" -Tail 50
```
