---
sidebar_position: 1
title: What is Certeasy?
---

# What is Certeasy?

Certeasy is an **on-premise ACME server** that bridges standard ACME clients (certbot, acme.sh, Caddy, Traefik…) with your internal **Active Directory Certificate Services (ADCS)** PKI.

It lets you automate TLS certificate issuance inside your organization — without relying on any external cloud service, without exposing your PKI, and without changing your existing infrastructure.

## The Problem

Internal PKI is hard to automate. ADCS was not designed for the kind of automated, API-driven certificate lifecycle that modern infrastructure expects. Most organizations end up with one of these situations:

- Certificates managed manually → forgotten renewals, outages
- Complex scripting around `certreq.exe` → fragile and hard to audit
- External CAs for internal services → data leaves your network

## The Solution

Certeasy sits between your ACME clients and your ADCS. It:

1. Exposes a standard ACME endpoint that any ACME client can talk to
2. Validates the DNS challenge to confirm ownership of the requested domain
3. Submits the CSR to your ADCS authority using `certreq.exe`
4. Returns the signed certificate to the ACME client

Your ADCS never changes. Your ACME clients don't know they're talking to an internal CA. Everything stays inside your network.

## Key Properties

| Property | Detail |
|---|---|
| **100% on-premise** | No data leaves your network |
| **Standard protocol** | RFC 8555 ACME — works with any ACME client |
| **ADCS-native** | Uses `certreq.exe`, no ADCS changes required |
| **Secure by default** | Conservative defaults: RSA 3072-bit minimum, strict algorithm allow-list |
| **Hardened against ADCS attacks** | Certificate identity limited to validated DNS names — prevents ESC1–ESC13 by design |
| **Isolated networks** | Supports segmented environments (v2) |
| **Auditable** | Full audit log of all certificate operations |

## What Certeasy Is Not

- Not a CA — it delegates issuance to your existing ADCS
- Not a cloud service — it runs entirely inside your infrastructure
- Not a replacement for your PKI — it automates access to it
