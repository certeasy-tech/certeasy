---
sidebar_position: 1
title: Full Configuration Example
---

# Full Configuration Example

A complete configuration file with every available option. All optional fields are included with their default values or representative examples.

Comments indicate which fields are required, optional, or mode-specific.

```yaml
# Base directory for runtime files (SQLite, TLS cache, logs).
# Default: %ProgramData%\certeasy (Windows) | /var/lib/certeasy (Linux)
workdir: "C:\\ProgramData\\certeasy"

# ── Database ──────────────────────────────────────────────────────────────────
# Omit this section entirely to use SQLite with all defaults.
database:
  driver: sqlite          # sqlite | postgres | sqlserver
  path: ""                # SQLite only — defaults to %WORKDIR%/db.sqlite
  dsn: ""                 # PostgreSQL and SQL Server connection string
  ping-timeout-sec: 10
  max-idle-conn: 2        # Default: 2 (SQLite) | 5 (postgres/sqlserver)
  max-conn: 10

# ── Server ────────────────────────────────────────────────────────────────────
server:
  url:
    - "https://acme.corp.internal"   # Public URL(s) for ACME clients — required
  listen: "0.0.0.0:8443"
  read-header-timeout: 5s
  read-timeout: 10s
  write-timeout: 30s
  idle-timeout: 60s
  max-body-bytes: 1048576            # 1 MB
  shutdown-timeout: 10s
  remote-ip-header: "X-Forwarded-For"  # Only used when trusted-proxies is set
  trusted-proxies:
    - "10.0.0.0/8"

# ── Logs ──────────────────────────────────────────────────────────────────────
logs:
  level: info             # debug | info | warn | error
  format: json            # json | text
  output: file            # stderr | stdout | file
  file: "C:\\ProgramData\\certeasy\\certeasy.log"
  rotate:
    max-size-mb: 100
    max-backups: 10
  services:               # Per-service log level overrides
    DB-Driver: warn
    adcs: info
    Certeasy-acme-server: info
    Async-Acme-Pki-Handler: info
    Async-Acme-Challenges: info
    JWKS: warn
    worker: info
    http-server: info

# ── TLS Certificate Manager ───────────────────────────────────────────────────
tls-certificate-manager:
  acquire-timeout: 2m                  # pki mode only
  renew-before: 720h                   # pki mode only — 30 days
  pki-poll-interval: 2s                # pki mode only
  file-watch-interval: 5s              # files mode only
  local-pki-cache-dir: "%WORKDIR%\\server-certificate-cache"  # pki mode only
  bundles:
    - name: public
      hosts:
        - "acme.corp.internal"
      mode: pki                        # files | pki
      authority: ca1                   # pki mode — authority name
      # files mode fields (use instead of authority):
      # local-cert-file: "C:\\certeasy\\tls\\fullchain.pem"
      # local-key-file: "C:\\certeasy\\tls\\privkey.pem"

# ── DNS Validation Profiles ───────────────────────────────────────────────────
dns-validation-profiles:
  - name: internal-default
    mode: local                        # local only (remote: not yet implemented)
    timeout: ""                        # overall validation timeout
    zones:
      - suffixes:
          - "corp.internal"
        system: true                   # use system DNS resolver
        dns-server: ""                 # explicit resolver (overrides system)
        authoritative: false
        dnssec: false
        protocol: udp                  # udp | tcp
    resolved-ip-policy:
      allow-cidrs:
        - "10.0.0.0/8"
      deny-cidrs:
        - "127.0.0.0/8"
        - "169.254.0.0/16"
        - "::1/128"
        - "fe80::/10"

# ── Authorities ───────────────────────────────────────────────────────────────
authorities:
  - name: ca1
    type: adcs                         # adcs | fake
    configuration:
      ca-name: "PKI\\LAB-RootCA"       # as shown by certutil -CA
      certificate-template: "ACME-Template-Server"
      certreq-path: "certreq.exe"      # full path if not in PATH
      default-timeout: 10m
      cert-util-timeout: 30s

  # Fake PKI for local testing — do not use in production
  # - name: test-ca
  #   type: fake
  #   configuration:
  #     common-name: "Certeasy Test CA"
  #     password: "testpassword"
  #     key-size: 2048
  #     validity: 8760h

# ── Issuance Policies ─────────────────────────────────────────────────────────
issuance-policies:
  - name: corp-server
    dns-validation-profile: internal-default  # required if multiple profiles exist
    dns:
      allow:
        - ".corp.internal/3"           # non-wildcard names, max 3 labels
        - "*.corp.internal"            # wildcard at zone root only
      deny:
        - "=forbidden.corp.internal"   # exact match deny
    signature:
      allowed-algorithms:
        - "RSA-SHA256"
        - "RSA-SHA384"
        - "RSA-SHA512"
        - "ECDSA-SHA256"
        - "ECDSA-SHA384"
        - "ECDSA-SHA512"
        - "ED25519"
      min-rsa-bits: 3072
      allowed-ec-curves:
        - "P-256"
        - "P-384"

# ── Policy Bindings ───────────────────────────────────────────────────────────
# Can be omitted when there is exactly one policy and one authority.
policy-bindings:
  - policy: corp-server
    authorities:
      - ca1
    strategy: first_available          # first_available | round_robin

# ── Workers ───────────────────────────────────────────────────────────────────
workers:
  worker-id: "worker"
  workers: 4
  lease: 30s
  idle-min: 200ms
  idle-max: 5s
  base-backoff: 1s
  max-backoff: 2m
  queue-size: 4                        # defaults to value of workers
```
