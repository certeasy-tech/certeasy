---
sidebar_position: 5
title: EU Cyber Resilience Act
---

# EU Cyber Resilience Act (CRA)

This page states where Hortval stands against Regulation (EU) 2024/2847. It is
written for the security team assessing Hortval as a supplier: what is already in
place, what is being worked on, and what has not started — with the evidence for
each.

:::info Status: in progress, not certified
Hortval has **not** completed a conformity assessment and does **not** carry CE
marking. Those obligations apply to products placed on the EU market from
**11 December 2027**, and we are working towards that date.
:::

Most of what the CRA asks of the product itself is already in place and
documented on this site — machine-readable SBOM, continuous dependency scanning,
signed releases, a tamper-evident audit log, no default credentials, a published
disclosure contact. What remains is largely formal conformity work, and none of
it is due yet.

## The two dates that matter

The CRA does not arrive all at once.

| Date | What applies |
|---|---|
| **11 September 2026** | Reporting of actively exploited vulnerabilities and severe incidents (Art. 14): early warning within 24 h, notification within 72 h, final report within 14 days |
| **11 December 2027** | Everything else — essential requirements, conformity assessment, EU declaration of conformity, CE marking, technical file |

Reports are filed through the Single Reporting Platform that ENISA operates
under Art. 16, which relays to the coordinating CSIRT of the member state where
the manufacturer is established — CERT-FR, for us.

## Where Hortval sits among the product categories

Annex III lists *public key infrastructure and digital certificate issuance
software* among important products. The category matters because it decides
which conformity assessment route is open, so it is worth being precise about
what Hortval actually does.

**Hortval is a registration authority, not a certification authority.** It
speaks ACME to your clients, validates the challenges, applies your issuance
policy — and then forwards the CSR to the PKI you already run. In a production
deployment that is Microsoft ADCS: the CA holds the signing key, applies its own
template permissions, and issues the certificate. Hortval stores the result and
serves it back over ACME.

The one exception is the built-in `fakepki` backend, which does hold a CA key.
It exists so you can exercise the full issuance path without touching your real
PKI, and it is a laboratory backend — not a production topology.

This analysis is part of our technical file. The classification determines the
assessment route, and we will state the outcome here once it is settled.

## What is in place today

These are not plans. Each links to the page that documents it.

| Area | Where it is |
|---|---|
| **SBOM**, CycloneDX, machine-readable, one per released artefact | [Dependencies & SBOM](dependencies.md) |
| **Third-party licence attribution** shipped with every release | [Dependencies & SBOM](dependencies.md) |
| **Vulnerability scanning** of dependencies (`govulncheck`), continuous, not per-release | [Dependencies & SBOM](dependencies.md) |
| **Signed releases** — Authenticode on Windows, published checksums, and a documented verification procedure | [Verifying release binaries](verifying-binaries.md) |
| **Documented outbound connections** — one destination in online mode, none in offline mode | [Outbound connections](outbound-connections.md) |
| **Tamper-evident audit log** — HMAC chain, offline verification with `hortval audit verify` | [Audit log](../administration/audit.md) |
| **No default credentials** — nothing ships with a preset password, key or account | [Hardening](hardening.md) |
| **Deployment hardening guidance** and the Hortval ↔ ADCS responsibility split | [Hardening](hardening.md) |
| **Recurring security reviews** of the codebase, on a repeating cadence rather than a one-off audit | this page |
| **Published vulnerability contact**, human-readable and machine-readable ([`security.txt`](https://hortval.com/.well-known/security.txt), RFC 9116) | [below](#reporting-a-vulnerability) |
| **Third-party component policy** — every dependency upgrade is reviewed against the published source diff and the provenance of the repository, not the changelog | [Dependencies & SBOM](dependencies.md) |

On the last two rows, a note on what we mean by *effective and regular*, since
Annex I Part II(3) uses those words and leaves them open. Security reviews of
the code are run on a repeating schedule, and each finding is tracked to a
resolution or to an explicitly recorded accepted risk. The record — not the
review — is the evidence, so it is kept alongside the code and written at the
time of the change.

## What is in progress

| Area | State |
|---|---|
| **Vulnerability reporting procedure** (Art. 14) | Contact published and platform prerequisites done; the internal procedure — who files, within which deadline, and who covers when they are away — is being written ahead of 11 September 2026 |
| **Declared support period** | Art. 13(8) sets a floor of five years. Our current policy is stated per minor release, and reconciling the two wordings is an open decision. We will not publish a number we would have to revise downwards |
| **Secure development lifecycle, written up as such** | The practice exists — mandatory review rules, a written definition of done, schema-change and dependency-upgrade procedures. It is not yet presented as a single documented SDL, which is what Art. 13(1) asks for |
| **Product risk assessment and threat model** | Our security work to date has been code-level review. A product-level risk assessment and a published threat model for the audit chain are separate deliverables |
| **Inbound connection inventory** | The outbound side is documented; the inbound side (ACME on your chosen port, plus port 80 when HTTP-01 is used) is not yet a page |
| **Storage encryption** | Database transport security is being tightened; encryption at rest is delegated to your database and filesystem today |

## What has not started — due 11 December 2027

**None of this is overdue.** These obligations apply to products placed on the EU
market from 11 December 2027, and three of them cannot be completed yet at all:
the conformity assessment, the declaration of conformity and the CE marking all
depend on harmonised standards that are still being drafted. Listing them is how
you can check that timing later — not a backlog we are behind on.

- Conformity assessment route and the assessment itself (Art. 32)
- EU declaration of conformity (Art. 28) and CE marking (Art. 30)
- Technical file (Art. 31, Annex VII) and its ten-year retention
- Declared end-of-life date and the advance notice that goes with it (Art. 13(8))
- Automatic distribution of security updates (Art. 14(2)(a)) — Hortval is
  updated by replacing a signed binary; there is no update channel yet
- A defined process for re-running the risk assessment after a significant
  change (Annex I I(1))

## Reporting a vulnerability

Send it to **security@hortval.com**. Please do not open a public issue.

The same contact is published in machine-readable form at
[`https://hortval.com/.well-known/security.txt`](https://hortval.com/.well-known/security.txt),
following RFC 9116. If you run automated tooling against your suppliers, that is
the endpoint to point it at.

If we determine a reported vulnerability is being actively exploited, the Art. 14
clocks start when we become aware of it, and we will keep affected users informed
of the vulnerability and of the corrective measures available — that obligation
sits with us regardless of the state of any reporting platform.

## Using this page in a vendor assessment

Two suggestions, from the questions we already get.

**Ask for the SBOM before you ask for a questionnaire.** It is published with
every release, it is machine-readable, and it will tell you more in five minutes
than a completed spreadsheet.

**Read the dates, not just the colours.** Every line above is either evidenced by
a page on this site or carries the date it comes due. If a supplier's CRA page is
entirely green today, the useful follow-up is which conformity assessment route
they took and who assessed them — the answer is informative either way.
