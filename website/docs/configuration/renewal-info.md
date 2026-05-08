---
sidebar_position: 11
title: Renewal Information (ARI)
---

# ACME Renewal Information (RFC 9773)

Certeasy implements [ACME Renewal Information (ARI)](https://datatracker.ietf.org/doc/html/rfc9773), the standard mechanism that lets the server tell ACME clients **when** to renew. Compliant clients (recent certbot, acme.sh, lego, Caddy, Traefik) honour the suggested window instead of relying on their own renewal heuristics.

ARI is **always enabled** and exposes one new endpoint:

```
GET /acme/renewal-info/<certID>
```

It is also advertised in the `/directory` response under the `renewalInfo` key. Clients discover the endpoint automatically.

## Why ARI Matters

Without ARI, every client picks its own renewal threshold (typically "30 days before expiry"). When ten thousand certificates were all issued on the same day, ten thousand clients renew on the same day, hammering the CA. ARI lets the CA suggest a **per-certificate window** so renewals are spread out across days and the server can also signal an early renewal — for example, after a key compromise.

## Configuration

```yaml
renewal-info:
  lifetime-fraction: 0.66
  window-width: 48h
  retry-after: 6h
```

Omitting this section applies the defaults.

| Field | Default | Meaning |
|---|---|---|
| `lifetime-fraction` | `0.66` | Fraction of the cert lifetime past which the suggested window opens. `0.66` means renewal is suggested in the last third of the certificate's validity. |
| `window-width` | `48h` | Width of the suggested window. Spreads renewals over this interval to avoid thundering-herd reissue. |
| `retry-after` | `6h` | Sent as the HTTP `Retry-After` header — tells clients how long to wait before polling `renewal-info` again. |

There is no `enabled` flag. ARI is a recovery tool: a client cannot ignore renewal-info if you also need it to react to revocation. Disabling it would only encourage clients to fall back to their own heuristics, defeating the purpose.

## How the Window Is Computed

For a non-revoked certificate:

```
lifetime = notAfter − notBefore
start    = notBefore + lifetime × lifetime-fraction
end      = min(start + window-width, notAfter)
```

For a **revoked** certificate, the window collapses to `[now, now]`. Compliant clients renew immediately. This makes revocation an effective rollover mechanism — operators no longer need to coordinate manual reissuance after a key compromise or template change.

For a degenerate (zero-lifetime) certificate, the window is also `[now, now]`.

## Endpoint Details

| Property | Value |
|---|---|
| Method | `GET` (no JWS) |
| Path | `/acme/renewal-info/<certID>` |
| Auth | None (public) |
| Rate limit | Global per-IP only — see [Rate Limiting](./rate-limiting) |
| Body format | RFC 9773 §4.2: `suggestedWindow.start` and `suggestedWindow.end` as RFC 3339 timestamps |
| Response headers | `Retry-After: <seconds>` |

The `certID` path parameter is the [RFC 9773 §4.1](https://datatracker.ietf.org/doc/html/rfc9773#section-4.1) format:

```
base64url(AKI) "." base64url(serialNumber)
```

Both components use unpadded base64url. AKI is the Authority Key Identifier extension of the leaf certificate; serial number is the cert's serial as unsigned big-endian bytes.

### Example response

```json
{
  "suggestedWindow": {
    "start": "2026-08-15T00:00:00Z",
    "end":   "2026-08-17T00:00:00Z"
  }
}
```

## Lookup Storage

Each issued certificate is stored with its `aki` and `serial` (lowercase hex) in `acme_certificates`, with a composite index `(aki, serial)`. Lookup is O(log n).

## Compatibility Notes

- Certificates issued by an authority that does not include an Authority Key Identifier extension are not addressable via ARI. The `renewal-info` endpoint will return 404 for them. Configure your ADCS template to include AKI (this is the default in modern ADCS).
- Older ACME clients that do not implement ARI continue to work normally — the `directory.renewalInfo` field is simply ignored by them.
