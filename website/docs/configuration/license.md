---
sidebar_position: 10
title: License
---

# License Configuration

The `license` section controls optional online checks and auto-renew behavior.

License activation is done with a CLI subcommand — either `hortval license register <license-key>` (e.g. `CRT-…`) for online registration, or `hortval license install <path>` to import a `.lic` file. On first start the server prints its **installation key** (`INST-…`) in the logs; you'll need it to download a `.lic` from the portal. See [Getting Started / License](../getting-started/license) for the full flow.

## Configuration

```yaml
license:
  offline: false
  proxy-url: "http://proxy.corp.local:3128"
  timeout: 8s
```

## Fields

| Field | Default | Description |
|---|---|---|
| `offline` | `false` | If `true`, disables online check/renew and runs in offline-only mode |
| `proxy-url` | empty | Optional explicit HTTP/HTTPS proxy URL for online license calls |
| `timeout` | `30s` | HTTP timeout per online request |

## Online Mode (Default)

Online mode is active when `offline` is not set (or set to `false`).

Behavior:
- startup always validates license offline first (signature + expiry)
- background online checks run with adaptive cadence:
  - `> 30` days before expiry: every 30 days
  - `<= 30` days before expiry: every 24h
  - after failed online attempt: retry in 6h (or 1h near expiry)
- if the backend returns a renewed `.lic`, Hortval stores it in DB automatically
- if backend is unreachable, Hortval keeps running from offline validation
- only explicit revocation response from backend is a hard failure

The backend base URL is fixed to Hortval's official endpoint in customer-facing deployments.

## Offline Mode (Air-Gapped)

Set `offline: true`:

```yaml
license:
  offline: true
```

In offline mode:
- no outbound license HTTP calls are made
- startup/runtime rely only on the locally stored license in DB
- renewal is manual: import a new file with `hortval license install`

:::note
`hortval license register` requires online access and does not work when `offline: true`. Use `hortval license install` for air-gapped environments.
:::

