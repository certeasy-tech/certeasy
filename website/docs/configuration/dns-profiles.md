---
sidebar_position: 3
title: DNS Validation Profiles
---

# DNS Validation Profiles

DNS validation profiles define **how Certeasy resolves and validates DNS challenges**. Each profile controls which DNS zones are in scope, which resolver to use, and which resolved IP addresses are acceptable.

## Configuration

```yaml
dns-validation-profiles:
  - name: internal-default
    mode: local
    zones:
      - suffixes:
          - "corp.internal"
        system: true
        authoritative: false
        dnssec: false
        protocol: udp
    resolved-ip-policy:
      allow-cidrs:
        - "10.0.0.0/8"
      deny-cidrs:
        - "127.0.0.0/8"
        - "169.254.0.0/16"
        - "::1/128"
        - "fe80::/10"
```

## Fields

### Profile

 | Field | Default | Type | Description                                      |
|---|---|----------|------|---------------------------------------------|
| `name` | — | string | Unique profile name. Referenced by issuance policies. |
| `mode` | `local` | string | Validation mode. Only `local` is currently available. |
| `timeout` | — | duration | Overall validation timeout.                           |

### Zones

Each zone entry defines which DNS zones this profile handles and how to resolve them.

| Field | Default | Type                                | Description                                      |
|---|---|-------------------------------------|--------------------------------------------------|
| `suffixes` | — | List string                         | List of DNS zone suffixes (e.g. `corp.internal`) |
| `system` | — | boolean                             | Use the system resolver for this zone            |
| `dns-server` | — | List string                         | Explicit DNS server address (overrides system)   |
| `authoritative` | — | boolean                             | Require authoritative responses                  |
| `dnssec` | — | boolean                             | Require DNSSEC validation                        |
| `protocol` | — | string | DNS protocol: `udp` or `tcp`                     |

### Resolved IP Policy

After a challenge DNS name resolves, Certeasy checks the resulting IP against these rules.

| Field | Type                                                                | Description                   |
|---|---------------------------------------------------------------------|-------------------------------|
| `allow-cidrs` | List string | IP ranges that are acceptable |
| `deny-cidrs` | List string | IP ranges that are explicitly rejected (loopback, link-local, etc.) |

Deny rules are evaluated first. If an IP matches a deny CIDR, the challenge fails regardless of allow rules.

## Multiple Profiles

You can define multiple profiles for different DNS zones or resolution strategies:

```yaml
dns-validation-profiles:
  - name: corp-internal
    mode: local
    zones:
      - suffixes: 
        - "corp.internal"
        system: true
    resolved-ip-policy:
      allow-cidrs: 
       - "10.0.0.0/8"

  - name: dmz
    mode: local
    zones:
      - suffixes: 
        - "dmz.example.com"
        dns-server: "192.168.100.1"
    resolved-ip-policy:
      allow-cidrs: 
       - "172.16.0.0/12"
```

When multiple profiles exist, each [issuance policy](/configuration/issuance-policies) must explicitly reference the profile to use.
