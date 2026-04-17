---
sidebar_position: 1
title: Full Configuration Reference
---

# Full Configuration Reference

This page documents every available configuration option. All sections are described with their fields, types, defaults, and constraints.

## Top-Level Structure

```yaml
workdir: "/var/lib/certeasy"
database: { ... }
server: { ... }
logs: { ... }
tls-certificate-manager: { ... }
dns-validation-profiles: [ ... ]
authorities: [ ... ]
issuance-policies: [ ... ]
policy-bindings: [ ... ]
workers: { ... }
```

---

## `workdir`

```yaml
workdir: "/var/lib/certeasy"
```

Base directory for runtime files (SQLite database, TLS certificate cache, logs if using file output).

| OS | Default |
|---|---|
| Linux | `/var/lib/certeasy` |
| Windows | `%ProgramData%\certeasy` |

---

## `database`

```yaml
database:
  driver: sqlite          # sqlite | postgres | sqlserver
  path: ""                # SQLite only — defaults to %WORKDIR%/db.sqlite
  dsn: ""                 # PostgreSQL and SQL Server
  ping-timeout-sec: 10
  max-idle-conn: 2        # 5 for postgres/sqlserver
  max-conn: 10
```

| Field | Default | Description |
|---|---|---|
| `driver` | `sqlite` | Database driver |
| `path` | `%WORKDIR%/db.sqlite` | SQLite file path |
| `dsn` | — | Connection string (non-SQLite) |
| `ping-timeout-sec` | `10` | Startup connectivity check timeout |
| `max-idle-conn` | `2` / `5` | Max idle connections |
| `max-conn` | `10` | Max open connections |

---

## `server`

```yaml
server:
  listen: "0.0.0.0:8443"
  url:
    - "https://acme.corp.internal"
  read-header-timeout: 5s
  read-timeout: 10s
  write-timeout: 30s
  idle-timeout: 60s
  max-body-bytes: 1048576
  shutdown-timeout: 10s
  remote-ip-header: ""
  trusted-proxies: []
```

| Field | Default | Required | Description |
|---|---|---|---|
| `url` | — | **Yes** | Public URL(s) for ACME clients |
| `listen` | `0.0.0.0:8443` | Recommended | Bind address |
| `read-header-timeout` | `5s` | No | |
| `read-timeout` | `10s` | No | |
| `write-timeout` | `30s` | No | |
| `idle-timeout` | `60s` | No | |
| `max-body-bytes` | `1048576` | No | |
| `shutdown-timeout` | `10s` | No | |
| `remote-ip-header` | — | No | Header for client IP behind proxy |
| `trusted-proxies` | — | No | CIDRs of trusted proxies |

---

## `logs`

```yaml
logs:
  level: info             # debug | info | warn | error
  format: json            # json | text
  output: stderr          # stderr | stdout | file
  file: ""
  rotate:
    max-size-mb: 100
    max-backups: 10
  services:
    DB-Driver: warn
    Certeasy-acme-server: debug
```

| Field | Default | Description |
|---|---|---|
| `level` | `info` | Global log level |
| `format` | `json` | `json` or `text` |
| `output` | `stderr` | `stderr`, `stdout`, or `file` |
| `file` | — | Required if `output: file` |
| `rotate.max-size-mb` | — | Max file size before rotation |
| `rotate.max-backups` | — | Number of rotated files to keep |
| `services` | `{}` | Per-service level overrides |

Service names: `DB-Driver`, `adcs`, `Certeasy-acme-server`, `Async-Acme-Pki-Handler`, `Async-Acme-Challenges`, `JWKS`, `worker`, `http-server`

---

## `tls-certificate-manager`

```yaml
tls-certificate-manager:
  acquire-timeout: 2m
  renew-before: 720h
  pki-poll-interval: 2s
  file-watch-interval: 5s
  local-pki-cache-dir: "%WORKDIR%/server-certificate-cache"
  bundles:
    - name: public
      hosts:
        - "acme.corp.internal"
      mode: files             # files | pki
      local-cert-file: ""     # files mode
      local-key-file: ""      # files mode
      authority: ""           # pki mode
```

| Field | Default | Description |
|---|---|---|
| `acquire-timeout` | `2m` | Startup certificate acquisition timeout |
| `renew-before` | `720h` | Renewal lead time before expiry |
| `pki-poll-interval` | `2s` | Poll interval for PKI-mode issuance |
| `file-watch-interval` | `5s` | File change check interval |
| `local-pki-cache-dir` | `%WORKDIR%/server-certificate-cache` | Cache for PKI-issued server certs |
| `bundles[].name` | — | Bundle identifier |
| `bundles[].hosts` | — | Hostnames (optional if single bundle) |
| `bundles[].mode` | — | `files` or `pki` |
| `bundles[].local-cert-file` | — | PEM cert chain (files mode) |
| `bundles[].local-key-file` | — | PEM private key (files mode) |
| `bundles[].authority` | — | Authority name (pki mode) |

---

## `dns-validation-profiles`

```yaml
dns-validation-profiles:
  - name: internal-default
    mode: local             # local only (remote: not yet implemented)
    timeout: ""
    zones:
      - suffixes:
          - "corp.internal"
        system: true
        dns-server: ""
        authoritative: false
        dnssec: false
        protocol: udp       # udp | tcp
    resolved-ip-policy:
      allow-cidrs:
        - "10.0.0.0/8"
      deny-cidrs:
        - "127.0.0.0/8"
```

| Field | Default | Description |
|---|---|---|
| `name` | — | Profile name |
| `mode` | `local` | Validation mode |
| `timeout` | — | Overall validation timeout |
| `zones[].suffixes` | — | DNS zone suffixes |
| `zones[].system` | — | Use system resolver |
| `zones[].dns-server` | — | Explicit resolver address |
| `zones[].authoritative` | — | Require authoritative responses |
| `zones[].dnssec` | — | Require DNSSEC |
| `zones[].protocol` | — | `udp` or `tcp` |
| `resolved-ip-policy.allow-cidrs` | — | Acceptable resolved IP ranges |
| `resolved-ip-policy.deny-cidrs` | — | Rejected IP ranges (evaluated first) |

---

## `authorities`

```yaml
authorities:
  - name: ca1
    type: adcs              # adcs | fakepki
    policies: []
    configuration:
      # ADCS
      ca-name: "PKI\\LAB-RootCA"
      certificate-template: "ACME-Template-Server"
      certreq-path: "certreq.exe"
      default-timeout: 10m
      cert-util-timeout: 30s
      # Fake PKI (type: fake)
      # common-name: "Test CA"
      # password: "secret"
      # key-size: 2048
      # validity: 8760h
```

| Field | Default | Description |
|---|---|---|
| `name` | — | Authority name |
| `type` | — | `adcs` or `fake` |
| `policies` | — | Remote policy constraints (optional) |
| `configuration.ca-name` | — | ADCS: full CA name |
| `configuration.certificate-template` | — | ADCS: template name |
| `configuration.certreq-path` | `certreq.exe` | ADCS: path to certreq.exe |
| `configuration.default-timeout` | `10m` | ADCS: max issuance wait |
| `configuration.cert-util-timeout` | — | ADCS: certutil timeout |

---

## `issuance-policies`

```yaml
issuance-policies:
  - name: corp-server
    dns-validation-profile: internal-default
    dns:
      allow:
        - ".corp.internal/3"
        - "*.corp.internal"
      deny:
        - "=forbidden.corp.internal"
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
```

| Field | Default | Description |
|---|---|---|
| `name` | — | Policy name |
| `dns-validation-profile` | — | Profile name. Required if multiple profiles exist. |
| `dns.allow` | — | DNS scope rules (required, must not be empty) |
| `dns.deny` | — | Explicit deny rules |
| `signature.allowed-algorithms` | all supported | Allowed signing algorithms. Supported: `RSA-SHA256/384/512`, `ECDSA-SHA256/384/512`, `ED25519` |
| `signature.min-rsa-bits` | `3072` | Minimum RSA key size |
| `signature.allowed-ec-curves` | secure defaults | Allowed EC curves |

**DNS rule syntax:**

| Rule | Syntax | Example |
|---|---|---|
| Non-wildcard with depth | `.zone/N` | `.corp.internal/3` |
| Wildcard at zone | `*.zone` | `*.corp.internal` |
| Wildcard in subzones | `*..zone/N` | `*..corp.internal/2` |
| Exact match | `=name` | `=host.corp.internal` |

---

## `policy-bindings`

```yaml
policy-bindings:
  - policy: corp-server
    authorities:
      - ca1
      - ca2
    strategy: first_available   # first_available | round_robin
```

| Field | Default | Description |
|---|---|---|
| `policy` | — | Issuance policy name |
| `authorities` | — | Authority names |
| `strategy` | `first_available` | `first_available` or `round_robin` |

Can be omitted when exactly one issuance policy and one authority exist.

---

## `workers`

```yaml
workers:
  worker-id: "worker"
  workers: 4
  lease: 30s
  idle-min: 200ms
  idle-max: 5s
  base-backoff: 1s
  max-backoff: 2m
  queue-size: 4
```

| Field | Default | Description |
|---|---|---|
| `worker-id` | `worker` | Unique instance identifier |
| `workers` | `4` | Concurrent worker goroutines |
| `lease` | `30s` | Job lock duration |
| `idle-min` | `200ms` | Min polling interval when idle |
| `idle-max` | `5s` | Max polling interval when idle |
| `base-backoff` | `1s` | Initial retry backoff |
| `max-backoff` | `2m` | Maximum retry backoff |
| `queue-size` | `workers` | In-memory buffer size |
