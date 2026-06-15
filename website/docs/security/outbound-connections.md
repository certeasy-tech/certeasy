---
sidebar_position: 4
title: Outbound connections & licensing
---

# Outbound connections & licensing

Certeasy is designed to run inside hardened, segmented networks — often right
next to your CA. Security teams rightly audit everything that leaves such a
host. This page explains the **only** network connection Certeasy makes, **why**
it exists, and **how to turn it off entirely**.

Short version:

- In **online mode** (default), the binary's only outbound destination is
  Certeasy's licensing backend (HTTPS, on `certeasy.tech`). Nothing else.
- In **offline mode** (`license: offline: true`), the binary makes **zero**
  outbound connections. It is fully air-gappable.
- It **never** sends your certificates, private keys, the domain names you
  issue for, your ACME accounts, your DNS configuration, or your audit log.

## Why the connection exists

The connection serves one purpose: the **license lifecycle**. A Certeasy
license is a signed file (`.lic`) that describes what the instance is allowed to
do (allowed databases, max CAs, max managed servers, expiry). The backend is the
authority that issues and updates that file. The binary contacts it to:

1. **Receive its license** after registration.
2. **Pick up changes you make in the portal — with no action on the box.** This
   is why the check is periodic: a **plan upgrade** (more CAs, more managed
   servers, …), a **renewal**, or a **revocation/retirement** done in the portal
   lands on the running instance automatically, instead of forcing you to copy a
   new license file by hand.

## How an instance becomes licensed

- **From the box (CLI):** an operator runs `certeasy license register`. The
  instance is bound to the license and receives its `.lic`.
- **From the portal (web):** an admin links the instance's installation key to a
  license in the portal UI. The box only **polls**; once the key is linked, the
  next poll delivers the `.lic` — no register command needed on the box.

The recurring polls afterwards are what deliver **upgrades, renewals and
revocations** without operator action.

## What is exchanged

The binary sends **license-enforcement metrics** (the figures used to verify
your running configuration against your plan) and the **machine name** you set
at registration. In return it may receive an updated license file.

It does **not** send any operational data — specifically never:

- certificates, certificate chains, or CSRs;
- private keys (CA keys, the server's own key — none);
- the domain names / SANs you issue certificates for;
- ACME accounts or any ACME protocol data;
- your DNS-validation configuration or network topology;
- the audit log or database contents.

There is no telemetry, analytics, or crash-reporting channel. Licensing is the
entire outbound surface.

## Turning it off — offline mode

In `config.yml`:

```yaml
license:
  offline: true
```

With `offline: true` the binary builds no licensing client at all: no polling,
registration, renewal, or revocation check, in any boot mode. **Zero outbound
connections** — the mode for air-gapped or strictly segmented deployments.

Trade-offs you accept offline:

- You install the license yourself: `certeasy license install <file.lic>`
  (delivered out-of-band).
- No automatic renewal or **plan-upgrade pickup** — apply a new `.lic` manually.
- No portal-driven revocation/retirement of the instance.

## Verifying it yourself

The surface is small and deterministic, so you can confirm it: point a network
monitor at the host — in online mode you see only HTTPS to `certeasy.tech`; in
offline mode, nothing at all. The binary is reproducible and its dependencies
are published — see [Dependencies & SBOM](./dependencies.md) and
[Verifying release binaries](./verifying-binaries.md).
