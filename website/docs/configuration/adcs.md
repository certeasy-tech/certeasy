---
sidebar_position: 2
title: ADCS Configuration
---

# ADCS Configuration

:::caution Work in progress
This page is not yet complete. Content and best practices will be added shortly.
:::

This page will cover:

- Prerequisites on the ADCS host
- Creating a certificate template for ACME enrollment
- Setting the correct permissions (enroll rights for the Certeasy service account)
- Finding the correct `ca-name` value (`certutil -CA`)
- Recommended template settings (key usage, validity, issuance requirements)
- Security best practices (least-privilege service account, auditing, etc.)
