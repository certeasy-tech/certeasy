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
  conn-max-lifetime: 2m   # Default: 2m (postgres/sqlserver), unset for SQLite.
                          # Sits below typical firewall/NAT idle timeouts so the
                          # pool recycles before the network drops a connection.
  conn-max-idle-time: 1m  # Default: 1m (postgres/sqlserver), unset for SQLite
  noddl: false            # true when the account holds no schema rights:
                          # Certeasy issues no DDL, checks the schema at startup,
                          # and `certeasy migrate` writes the SQL for your DBA

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
  shutdown-timeout: 30s
  remote-ip-header: "X-Forwarded-For"  # Only used when trusted-proxies is set
  trusted-proxies:
    - "10.0.0.0/8"

# ── Logs ──────────────────────────────────────────────────────────────────────
logs:
  level: info             # debug | info | warn | error
  format: json            # json | text
  output: file            # stderr | stdout | file
  # With rotation enabled, `file` is a NAMING BASE, not a file: segments are
  # written beside it as <name>.<UTC timestamp>.<discriminant>.log and are never
  # renamed. Point log collectors at the directory glob, not at this path.
  file: "C:\\ProgramData\\certeasy\\certeasy.log"
  rotate:
    max-size-mb: 100
    max-backups: 10                    # closed segments kept; 0 = none, -1 = never delete
  services:               # Per-service log level overrides
    DB-Driver: warn
    adcs: info
    Certeasy-acme-server: info
    Async-Acme-Pki-Handler: info
    Async-Acme-Challenges: info
    JWKS: warn
    worker: info
    http-server: info
  tags:                   # Free-form labels added to every log entry (Grafana/Loki)
    instance: cert-srv-01
    region: eu-west

# ── TLS Certificate Manager ───────────────────────────────────────────────────
tls-certificate-manager:
  acquire-timeout: 2m                  # pki mode only
  renew-before: 720h                   # pki mode only — 30 days
  pki-poll-interval: 2s                # pki mode only
  file-watch-interval: 5s              # files mode only
  local-pki-cache-dir: "%WORKDIR%\\server-certificate-cache"  # pki mode only
  # letsencrypt mode (beta) — public CA for an internet-facing host:
  letsencrypt:
    enabled: false                     # set true when a bundle uses mode: letsencrypt
    email: "pki@example.com"           # ACME account / expiry notices
    http-addr: ":80"                   # HTTP-01 challenge listener
    cache-dir: "%WORKDIR%\\autocert"   # issued-cert + account-key cache
  bundles:
    - name: public
      hosts:
        - "acme.corp.internal"
      mode: pki                        # files | pki | letsencrypt (beta)
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
    type: adcs                         # adcs/adcs-native (in-process, default) | adcs-cli (certreq.exe) | fake
    disable-ca-revocation: false       # default — propagate revocations to the CA (needs the Certificate Manager role)
    configuration:
      ca-name: "PKI\\LAB-RootCA"       # as shown by certutil -CA
      certificate-template: "ACME-Template-Server"
      default-timeout: 4m              # keep below workers.max-job-duration (default 5m)
      # Taken from the Windows system directory by default (since 0.9.4).
      # Set these only to run a copy kept elsewhere, e.g. on a path carved out
      # of an EDR policy. adcs-cli connector only.
      # certreq-path: "C:\\Tools\\certreq.exe"
      # certutil-path: "C:\\Tools\\certutil.exe"   # used for revocation

  # Fake PKI for local testing — do not use in production
  # - name: test-ca
  #   type: fake
  #   configuration:
  #     common-name: "Certeasy Test CA"
  #     password: "testpassword"
  #     key-size: 4096
  #     validity: 3650                 # CA certificate lifetime, in days
  #     certificate-validity: 2160h    # issued-certificate lifetime (default 90 days)

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
    # CSR Extended Key Usage whitelist. Default: serverAuth only.
    # See SECURITY WARNING in configuration/issuance-policies.md before
    # adding non-server purposes — back-end ADCS templates configured as
    # "Supply in the request" will honor the CSR's EKU.
    #
    # clientAuth note: acme.sh's default OpenSSL template emits
    # EKU=serverAuth,clientAuth. The CA/B Forum baseline forbids this
    # combination on publicly-trusted certs from June 2026 onwards. Keep
    # the entry below ONLY if you must support unmodified acme.sh; lego
    # and certbot emit serverAuth only and don't need it. See
    # configuration/issuance-policies.md for the full discussion.
    # csr:
    #   allowed-extra-eku:
    #     - clientAuth
    #     # - codeSigning
    #     # - emailProtection
    #     # raw OID also accepted, e.g. Microsoft EFS:
    #     # - "1.3.6.1.4.1.311.10.3.4"

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
  workers: 16
  lease: 30s
  idle-min: 50ms
  idle-max: 200ms
  base-backoff: 1s
  max-backoff: 2m
  queue-size: 16                       # defaults to value of workers

# ── Rate Limiting ─────────────────────────────────────────────────────────────
# Omit this section entirely to apply the defaults shown below.
# Whitelist is intentionally empty — secure by default, no IP is auto-trusted.
rate-limiting:
  whitelist:                           # OPTIONAL — entries bypass IP-based limits
                                       # Add only if you have a specific reason
                                       # (e.g. monitoring probes you control).
                                       # Example values (commented out by default):
                                       # - "127.0.0.1"
                                       # - "10.42.0.0/16"

  global:                              # Per-IP token bucket on every endpoint.
    enabled: true                      # Comfort ceiling — sized so a legitimate
    requests-per-minute: 1200          # client is never the one it stops.
    burst: 100

  abuse:                               # Per-IP marking, not a request ceiling.
    enabled: true                      # A marked IP is refused on EVERYTHING,
    abuses-before-block: 10            # not only on further misbehaviour.
    recovery-per-minute: 20            # Gradual recovery, not a fixed ban.

  account-creation:                    # Per-IP cap on new-account
    enabled: true
    per-ip-per-hour: 10          # burst == hourly: account creation happens
    burst: 10                   # in deployment waves, not at a steady rate

  order-creation:                      # Per-account caps on new-order
    enabled: true
    orders-per-account-per-hour: 20
    order-burst: 5
    san-budget-per-account-per-hour: 100

  duplicate-certificate:               # Anti-runaway: same FQDN set per account
    enabled: true                      # Set to false to disable entirely
    max-per-window: 5
    window: 168h                       # 7 days

  failed-validation:                   # Anti-misconfig: bucket per (account, hostname)
    enabled: true                      # Counter lives in memory only
    max-per-window: 5
    window: 1h

  pending-authorizations:              # Anti-DoS: in-flight authzs per account
    enabled: true
    max: 30                            # Calibrated for 1 machine = 1 account

# ── Renewal Information (ARI, RFC 9773) ───────────────────────────────────────
# Always active — endpoint advertised in /directory as renewalInfo.
# Omit this section to apply the defaults.
renewal-info:
  lifetime-fraction: 2/3               # Window opens at notBefore + lifetime*2/3
                                       # Decimal (0.75) or fraction (2/3) both accepted
  window-width: 48h                    # Spread renewals across this duration
  retry-after: 6h                      # Sent as Retry-After header on responses

# ── Audit log (HMAC-chained JSONL) ────────────────────────────────────────────
# Enabled by default. Omit this section to apply the defaults shown below.
# Verify the chain with: certeasy audit verify -f config.yml
audit:
  enabled: true
  path: ""                             # Empty → <workdir>/audit.log
  rotate:
    # 0 → a single segment that grows indefinitely. Above 0, Certeasy starts a
    # new dated segment at that size. External rotation (logrotate, Scheduled
    # Task) on this file is NOT supported: it breaks the tamper-evident chain.
    # There is no max-backups here — Certeasy never deletes an audit segment.
    max-size-mb: 0
```
