---
sidebar_position: 1
title: What is Hortval?
---

# What is Hortval?

Hortval is an **on-premise ACME server** that bridges standard ACME clients (certbot, acme.sh, Caddy, Traefik…) with your internal **Active Directory Certificate Services (ADCS)** PKI.

It lets you automate TLS certificate issuance inside your organization — without relying on any external cloud service, without exposing your PKI, and without changing your existing infrastructure.

## The Problem

Active Directory takes care of Windows machines: certificates are deployed automatically through Group Policy, no one has to think about it.

Linux servers, reverse proxies, load balancers, and containers are a different story. ADCS was never designed for them, so teams fill the gap however they can:

- Certificates managed manually, renewed by hand → forgotten renewals, outages
- Custom scripts around `certreq.exe` → fragile, hard to audit, breaks on updates
- External CAs for internal services → certificates issued outside your network, outside your policies

## The Solution

Hortval sits between your ACME clients and your ADCS. It:

1. Exposes a standard ACME endpoint that any ACME client can talk to
2. Validates the ACME challenge — `dns-01`, `http-01` or `tls-alpn-01` — to confirm ownership of the requested domain
3. Submits the CSR to your ADCS authority in-process (no child process), with a `certreq.exe` connector available as a fallback
4. Returns the signed certificate to the ACME client

Your ADCS never changes. Your ACME clients don't know they're talking to an internal CA. Everything stays inside your network.

## Key Properties

| Property | Detail |
|---|---|
| **100% on-premise** | No data leaves your network |
| **Standard protocol** | RFC 8555 ACME + RFC 9773 ARI (read-only) — works with any ACME client. See [Standards & RFC support](../reference/standards-compliance.md) for the detailed conformance matrix. |
| **ADCS-native** | Connects to ADCS in-process — no `certreq.exe` child process, no ADCS changes required (a `certreq.exe` connector remains available as a fallback) |
| **Secure by default** | Conservative defaults: RSA 3072-bit minimum, strict algorithm allow-list |
| **Hardened against ADCS attacks** | Certificate identity limited to validated DNS names — prevents ESC1–ESC13 by design |
| **Isolated networks** | Supports segmented environments (v2.0) |
| **Auditable** | Full audit log of all certificate operations |

## What Hortval Is Not

- Not a CA — it delegates issuance to your existing ADCS
- Not a cloud service — it runs entirely inside your infrastructure
- Not a replacement for your PKI — it automates access to it
