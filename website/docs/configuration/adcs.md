---
sidebar_position: 2
title: ADCS Configuration
---

# ADCS Configuration

:::caution Work in progress
This page is not yet complete. Content and best practices will be added shortly.
:::

:::tip Connector choice
Certeasy reaches ADCS through a **native in-process connector by default**
(`type: adcs`), with a `certreq.exe` fallback (`type: adcs-cli`). See
[Authorities → Connector](/configuration/authorities#connector-native-default-or-certreqexe).
:::

This page will cover:

- Prerequisites on the ADCS host
- Creating a certificate template for ACME enrollment
- Setting the correct permissions (enroll rights for the Certeasy service account)
- Finding the correct `ca-name` value (`certutil -CA`)
- Recommended template settings (key usage, validity, issuance requirements)
- Security best practices (least-privilege service account, auditing, etc.)
