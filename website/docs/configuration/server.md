---
sidebar_position: 7
title: Server
---

# Server

The `server` section configures the ACME HTTP endpoint — the address Certeasy listens on and the public URL exposed to ACME clients.

## Configuration

```yaml
server:
  listen: ":8443"
  url:
    - "https://acme.corp.internal"
  read-header-timeout: 5s
  read-timeout: 10s
  write-timeout: 30s
  idle-timeout: 60s
  max-body-bytes: 1048576
  shutdown-timeout: 10s
  remote-ip-header: "X-Forwarded-For"
  trusted-proxies:
    - "10.0.0.0/8"
```

## Fields

| Field | Default | Required | Description |
|---|---|---|---|
| `url` | — | Yes | Public URL(s) ACME clients use to reach Certeasy. Used to build all ACME directory links. |
| `listen` | `0.0.0.0:8443` | Recommended | Address and port to listen on. |
| `read-header-timeout` | `5s` | No | Timeout for reading request headers. |
| `read-timeout` | `10s` | No | Timeout for reading the full request body. |
| `write-timeout` | `30s` | No | Timeout for writing the response. |
| `idle-timeout` | `60s` | No | Keep-alive idle connection timeout. |
| `max-body-bytes` | `1048576` (1 MB) | No | Maximum request body size. |
| `shutdown-timeout` | `10s` | No | Graceful shutdown wait time. |
| `remote-ip-header` | — | No | Header to trust for the client IP (e.g. `X-Forwarded-For`). Only used if `trusted-proxies` is set. |
| `trusted-proxies` | — | No | CIDR ranges of trusted reverse proxies. |

## Notes

### `server.url`

`url` is mandatory. It must match the hostname that ACME clients will use to reach Certeasy. Certeasy embeds this URL in the ACME directory response and in all object links (orders, authorizations, challenges).

If you are behind a reverse proxy, set `url` to the public hostname, not the internal listen address.

```yaml
server:
  listen: ":8443"          # internal bind address
  url:
    - "https://acme.corp.internal"   # public URL clients use
```

### Behind a Reverse Proxy

If Certeasy sits behind a reverse proxy (nginx, Caddy, IIS ARR…), set `remote-ip-header` and `trusted-proxies` to preserve the original client IP in logs and audit records:

```yaml
server:
  remote-ip-header: "X-Forwarded-For"
  trusted-proxies:
    - "10.0.0.0/8"
```

Only proxies in `trusted-proxies` are allowed to set the `remote-ip-header`. Requests from untrusted IPs ignore the header.
