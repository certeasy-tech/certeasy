---
sidebar_position: 6
title: Audit Log
---

# Audit Log

Certeasy writes a tamper-evident audit log of business decisions and security-relevant events: account lifecycle, order creation, authorization outcomes, certificate issuance and revocation, rate-limit denials, and license transitions. Each line is HMAC-chained to the previous one so any insertion, deletion, or modification is detectable after the fact with the bundled `certeasy audit verify` command.

The audit log is **enabled by default**: a silent opt-out would be a compliance hole. Disable it explicitly with `enabled: false` if you have a specific reason.

## Configuration

```yaml
audit:
  enabled: true
  path: ""
  rotate:
    max-size-mb: 0
    max-backups: 0
```

Omitting the `audit` block applies the defaults shown above.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Set to `false` to disable the audit writer entirely. No file is created and `Audit()` calls are dropped silently. |
| `path` | `""` | Absolute path to the audit log file. Empty resolves to `<workdir>/audit.log`. |
| `rotate.max-size-mb` | `0` | When greater than zero, Certeasy rotates the file in-process once it exceeds this size (using the same writer as `logs.rotate`). `0` means "no in-process rotation" — let the OS handle it (logrotate on Linux, Task Scheduler on Windows). |
| `rotate.max-backups` | `0` | Number of rotated backups to keep when in-process rotation is active. `0` deletes the previous file on rotation. Ignored when `max-size-mb` is `0`. |

### Choosing in-process vs OS-managed rotation

In-process rotation is convenient on Windows where logrotate is not available out of the box. It uses the same `logx.RotatingFileWriter` as the application log: rotated files are renamed `<path>.1`, `<path>.2`, …, with `.1` being the most recent backup.

OS-managed rotation is the recommended setup on Linux: drop a logrotate snippet that uses `copytruncate` so Certeasy's append-mode handle is not invalidated mid-rotation. Either way, `certeasy audit verify` walks rotated files automatically — the chain is preserved across rotations.

## What Is Logged

The audit log captures decisions and security events. The list is intentionally narrow: nonce churn, individual JWS verifications, GET requests on the directory, and `/metrics` scrapes are explicitly excluded — they would drown the signal in noise without forensic value.

The tables below list every recorded event, what triggers it, and what extra context is attached in the `details` field. Common fields (`ts`, `account_id`, `source_ip`, `user_agent`) are described in [Line Format](#line-format) and are not repeated here.

### Account events

| Event | When | Details |
|---|---|---|
| `account.create` | A new ACME account is created. The dedupe path (existing key reused) is silent. | `contact`: list of contact URIs declared by the client |
| `account.keychange` | An account's JWK is rotated successfully via `keyChange`. | `old_thumbprint`, `new_thumbprint` |
| `account.deactivate` | An account is set to `deactivated` by its owner. | _(none)_ |

### Order and authorization events

| Event | When | Details |
|---|---|---|
| `order.create` | A new order is accepted and persisted. | `order_id`, `dns_names` (canonical: lowercased, sorted, deduped, wildcards preserved) |
| `order.finalize` | A `finalize` request has been accepted and the issuance job is enqueued. Represents the client's accepted finalize, not the actual cert issuance. | `order_id`, `policy_id`, `dns_names` |
| `order.invalid` | An order transitions to `invalid`. Emitted at most once per order — retries do not duplicate the event. The free-form `reason` field on the line carries the failure message. | `order_id`, `source`: `"challenge"` or `"pki"` |
| `authorization.validate` | An authorization transitions to `valid` (`decision: allow`) or `invalid` (`decision: deny`). Deny is emitted only when the authorization actually flips to invalid (i.e. all challenges of that authz failed). | `authz_id`, `identifier`, `chall_type` |
| `challenge.validate` | A challenge succeeds. **Failures are not recorded per challenge** — they would be too noisy. The chain "these challenges passed → this cert was issued" remains reconstructible from the order, authorization, and certificate events. | `chall_id`, `chall_type`, `identifier`, `authz_id` |

### Certificate events

| Event | When | Details |
|---|---|---|
| `certificate.issue` | A certificate has been issued and persisted. | `cert_id`, `order_id`, `pki_request_id`, `serial`, `dns_names` |
| `certificate.revoke` | A certificate is revoked via the `revoke-cert` endpoint. | `cert_id`, `fingerprint`, `reason` (RFC 5280 reason code; JSON `null` when the client did not provide one) |

### Rate limiting

| Event | When | Details |
|---|---|---|
| `ratelimit.deny` | A request is refused with HTTP 429. Emitted once per refusal. | `type`: one of `global`, `account-creation`, `order-creation`, `duplicate-certificate`, `failed-validation`, `pending-authorizations`; `retry_after` (seconds) |

### License

| Event | When | Details |
|---|---|---|
| `license.change` | The license state transitions between `valid`, `grace`, `expired`, `revoked`, or `no_license`. The boot baseline is not emitted — only subsequent transitions are. | `prev`, `next` |

## Line Format

The log is JSONL — one self-contained JSON object per line. Field order is fixed by the schema version (currently `"1"`).

```json
{"ts":"2026-05-08T14:32:11.123Z","schema":"1","seq":12345,"prev_mac":"hmac-sha256:abcd...","event":"order.create","account_id":"acct_abc","source_ip":"10.0.0.5","user_agent":"certbot/2.9","decision":"allow","details":{"order_id":"ord_xyz"},"mac":"hmac-sha256:1234..."}
```

| Field | Always present | Description |
|---|---|---|
| `ts` | yes | RFC 3339 timestamp with millisecond precision, in UTC |
| `schema` | yes | Schema version string. Currently `"1"`. Bumped only on incompatible layout changes. |
| `seq` | yes | Strictly increasing per installation. Resumes across restarts and rotations. |
| `prev_mac` | yes | The `mac` of the previous line, prefixed with `hmac-sha256:`. The first line uses the **genesis MAC** anchored on the installation ID. |
| `event` | yes | Dot-namespaced event name (`order.create`, `certificate.revoke`, …) |
| `account_id` | optional | ACME account identifier when the event is account-scoped |
| `source_ip` | optional | Client IP (see RGPD note below) |
| `user_agent` | optional | Client User-Agent string |
| `decision` | optional | `allow` or `deny` for events that involve a policy check |
| `reason` | optional | Human-readable reason — empty when not applicable |
| `details` | optional | Event-specific payload, encoded as a JSON object |
| `mac` | yes | `hmac-sha256:<hex>` of all preceding fields. Always the last field on the line. |

Optional fields are omitted from the line when empty (`omitempty`).

## How the Chain Works

On the very first install, Certeasy generates a 32-byte random secret and stores it in the database (`audit_state` table). The secret is never logged, never exposed via any API, and never rotated.

The first line of every installation is anchored to a **genesis MAC** computed from the secret and the stable installation identifier:

```
genesis_mac = HMAC-SHA-256(secret, "certeasy-audit-v1|" + installation_id)
```

Each subsequent line carries the `mac` of the previous line in its `prev_mac` field, and computes its own `mac` as `HMAC-SHA-256(secret, line_bytes_without_mac)`. Tampering with any line invalidates that line's MAC; tampering with the chain (insertion, deletion, reordering) invalidates the next `prev_mac`.

The genesis anchor matters: an audit file restored on a different installation (different `installation_id`) will not validate, even if the secret matches. This is intentional — it prevents a stolen audit file from being passed off as evidence on another system.

### Why HMAC and not plain SHA-256

A plain hash chain seeded from a publicly known value (the installation ID is visible in logs and the license portal) would let anyone with write access to the file rebuild the chain after modifying a line. HMAC requires the secret stored in the database — without DB access, the chain cannot be reforged.

The threat model: filesystem compromise alone does not allow forgery. DB compromise is a higher bar; if an attacker has read/write access to the database, the audit log is no longer the weakest link.

## Verifying the Chain

The chain is only useful if you actually verify it. Run:

```sh
certeasy audit verify -f /etc/certeasy/config.yml
```

The command walks rotated predecessors (`audit.log.1`, `.2`, …) chronologically, then the active file. It validates:

1. Each line's `mac` against `HMAC(secret, line_bytes_without_mac)`.
2. Each `prev_mac` against the previous line's `mac` (or the genesis MAC for line 1).
3. That `seq` is strictly increasing.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Chain valid (or no audit lines exist yet — fresh install) |
| `1` | Chain broken. The first break is reported on stderr with file, line number, and reason. |

You can override the file path:

```sh
certeasy audit verify -f /etc/certeasy/config.yml --path /backups/2026-05/audit.log
```

This still requires the database (the secret and the installation ID live there), so the override is for verifying a copy of the file alongside the live DB — not for verifying a backup on a different machine. To verify a snapshot offline, restore the DB backup alongside the audit file first.

### When to verify

- **Periodically** (e.g. nightly via cron / Task Scheduler) — catch silent corruption early.
- **After every restore** — confirm the audit file and the database secret are consistent.
- **When investigating an incident** — confirm the timeline you are reading was not modified after the fact.

## Storage and Backups

The HMAC secret lives in the database. **Backing up the database is required** for the audit log to remain verifiable: the audit file alone is useless without the secret. Cover both in the same backup procedure — see the [Backup](../administration/backup) page.

Loss of the secret means loss of verifiability for all earlier lines (the file is still readable, just no longer cryptographically anchored). New writes cannot resume the old chain; on a fresh install, the writer starts a new chain from a new genesis.

## Personal Data and RGPD

`source_ip` and `user_agent` are potential personal data. Retention and the user-facing notice are the responsibility of the operator who installs and runs Certeasy:

- **Retention** — Certeasy does not delete audit lines on its own. The retention policy is whatever your OS rotation rule keeps.
- **Notice** — Mention the audit log in your service's privacy notice.
- **Access controls** — The audit file is created with `0644` permissions by default. Restrict the directory if your hosting model requires it.

There is no PII redaction option in v1: the goal of the audit log is forensic, and redacted entries would defeat that goal. Operators who cannot retain IPs should disable the audit log entirely (`enabled: false`) and accept the loss of forensic capability.

## Operational Notes

- **Failures do not block business flow.** If a write to the audit file fails (full disk, permission error), the failure is logged via the `audit` log service and the operation continues. Audit gaps are detected by `audit verify`, not by ACME clients.
- **Line size cap.** Lines are capped at 1 MiB. Events that would produce a larger line are dropped with a log entry. The cap is a defence against a misbehaving event source — legitimate events are well below 1 KiB.
- **No auto-purge.** Even when in-process rotation is enabled, Certeasy never deletes lines based on age. Retention is purely a function of how many rotated backups you keep (`max-backups` or your OS rotator).
