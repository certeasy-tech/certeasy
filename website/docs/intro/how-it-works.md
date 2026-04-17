---
sidebar_position: 2
title: How It Works
---

# How It Works

## Architecture Overview

```
ACME Client (certbot, acme.sh, Caddy…)
        │
        │  HTTPS  RFC 8555
        ▼
┌─────────────────────────┐
│       Certeasy          │
│                         │
│  ┌─────────────────┐    │
│  │  ACME Server    │    │
│  │  (HTTP handlers)│    │
│  └────────┬────────┘    │
│           │             │
│  ┌────────▼────────┐    │
│  │  Challenge      │    │
│  │  Validator      │◄───┼─── DNS / HTTP / TLS-ALPN
│  └────────┬────────┘    │
│           │             │
│  ┌────────▼────────┐    │
│  │  Issuance       │    │
│  │  Policy Engine  │    │
│  └────────┬────────┘    │
└───────────┼─────────────┘
            │  certreq.exe
            ▼
    ┌───────────────┐
    │  Your ADCS    │
    │  (unchanged)  │
    └───────────────┘
```

## Step-by-Step Flow

### 1. Account Registration
The ACME client creates an account on Certeasy by submitting a JWK public key. Certeasy stores the account and issues a unique account URL.

### 2. Order Creation
The client requests a certificate by submitting a list of DNS identifiers (e.g. `app.corp.internal`, `*.corp.internal`). Certeasy creates an order with one authorization per identifier.

### 3. Challenge Validation
For each identifier, the client responds to a DNS-01, HTTP-01, or TLS-ALPN-01 challenge. Certeasy validates the challenge asynchronously using its configured DNS validation profile.

The validation profile controls:
- which DNS resolver to use
- which DNS zones are in scope
- which resolved IP ranges are allowed

### 4. Issuance Policy Selection
Once all challenges pass, the client submits a CSR to finalize the order. Certeasy selects the appropriate **issuance policy** based on the requested identifiers.

The issuance policy defines:
- which DNS names are allowed
- what key types and sizes are accepted
- which ADCS authority handles the request

### 5. Certificate Issuance
Certeasy submits the validated CSR to the configured ADCS authority using `certreq.exe`. The authority issues the certificate according to the configured template.

This step is asynchronous — Certeasy polls ADCS until the certificate is ready.

### 6. Certificate Delivery
The signed certificate (PEM chain, without private key) is stored and made available at the certificate URL. The client downloads it with a standard `GET` request.

## Async Job Engine

Challenge validation and certificate issuance both run as **async jobs**. This decouples the ACME HTTP layer from the potentially slow operations of DNS validation and ADCS polling.

Jobs are persisted in the database. If Certeasy restarts mid-operation, jobs resume where they left off.

## Security Model

Certeasy enforces a strict security model at issuance time:

- **Certificate identity limited to DNS**: SAN contains only the validated DNS names — no IP, UPN, or email
- **No identity fields**: `O`, `OU`, `DC`, `L`, `ST`, `C` are forbidden in Subject
- **Restricted EKU**: only Server Authentication (`1.3.6.1.5.5.7.3.1`) is allowed
- **No UPN/email SAN**: prevents ADCS ESC attacks

See [Security Model](/security/certificate-model) for full details.
