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

## HTTP-01 with certbot (standalone)

The simplest approach: certbot spins up a temporary HTTP server on port 80 to answer the challenge.

```bash
certbot certonly \
  --standalone \
  --preferred-challenges http \
  --server https://acme.corp.internal/acme/directory \
  --no-verify-ssl \
  -d app.corp.internal
```

:::note `--no-verify-ssl`
Required when Certeasy uses an internal CA certificate that is not trusted by the OS certificate store on the certbot machine. Alternatively, add your internal CA to the system trust store and omit this flag.
:::

Certbot opens port 80, Certeasy fetches `http://app.corp.internal/.well-known/acme-challenge/<token>`, and on success submits the CSR to ADCS. The signed certificate is written to `/etc/letsencrypt/live/app.corp.internal/`.

## HTTP-01 with certbot (webroot)

If a web server is already running on port 80, use `--webroot` instead of `--standalone`:

```bash
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
certbot certonly \
  --manual \
  --preferred-challenges dns \
  --server https://acme.corp.internal/acme/directory \
  --no-verify-ssl \
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
