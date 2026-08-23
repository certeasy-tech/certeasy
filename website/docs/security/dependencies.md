---
sidebar_position: 2
title: Dependencies & SBOM
---

# Dependencies & SBOM

Hortval is a Go binary with a small, auditable dependency tree. This page lists the direct runtime dependencies, explains how to generate a Software Bill of Materials (SBOM), and covers compliance requirements under the EU **Cyber Resilience Act (CRA)** and **NIS2 Directive**.

## Direct Dependencies

| Package | Purpose | License |
|---|---|---|
| `github.com/miekg/dns` | DNS resolver for challenge validation | BSD-3-Clause |
| `golang.org/x/crypto` | TLS, PKCS8, cryptographic primitives | BSD-3-Clause |
| `golang.org/x/net` | HTTP/2, IDNA, DNS utilities | BSD-3-Clause |
| `golang.org/x/sync` | Concurrency primitives | BSD-3-Clause |
| `modernc.org/sqlite` | SQLite driver (pure Go, CGO-free) | MIT |
| `github.com/lib/pq` | PostgreSQL driver | MIT |
| `github.com/microsoft/go-mssqldb` | SQL Server driver | BSD-3-Clause |
| `gopkg.in/yaml.v3` | YAML configuration parser | MIT / Apache-2.0 |
| `github.com/google/uuid` | UUID generation | BSD-3-Clause |
| `github.com/shopspring/decimal` | Decimal arithmetic (SQL Server) | MIT |
| `github.com/dustin/go-humanize` | Human-readable sizes in logs | MIT |
| `github.com/mattn/go-isatty` | Terminal detection for log formatting | MIT |

All dependencies are **open source** with permissive licenses (MIT, BSD, Apache 2.0). No GPL or LGPL dependencies are included.

## Transitive Dependencies

The full transitive dependency graph is recorded in each module's `go.sum` file. To list all dependencies including transitive ones:

```bash
go list -m all
```

To check for known vulnerabilities:

```bash
# Install govulncheck
go install golang.org/x/vuln/cmd/govulncheck@latest

# Run against the binary or source
govulncheck ./...
```

## Generating an SBOM

### CycloneDX (recommended)

[CycloneDX](https://cyclonedx.org) is the format required by most regulatory frameworks including CRA.

```bash
# Install cyclonedx-gomod
go install github.com/CycloneDX/cyclonedx-gomod/cmd/cyclonedx-gomod@latest

# Generate SBOM for the cmd module
cd cmd
cyclonedx-gomod app -output hortval-sbom.cdx.json -json
```

This produces a machine-readable SBOM listing all dependencies with version, hash, and license information.

### SPDX

```bash
# Install syft
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Generate SPDX SBOM from the binary
syft hortval.exe -o spdx-json > hortval-sbom.spdx.json
```

### Go native

```bash
# Export dependency graph as JSON
go list -m -json all > sbom-deps.json
```

## CRA & NIS2 Compliance

### EU Cyber Resilience Act (CRA)

The CRA (applicable from 2027) requires software vendors to:

- Maintain and publish an SBOM for each release
- Track and remediate known vulnerabilities (CVEs) within defined timelines
- Provide a vulnerability disclosure policy
- Document security properties of the software

**Hortval approach:**
- SBOM generated per release using `cyclonedx-gomod`
- Dependencies monitored via `govulncheck` in CI
- Vulnerability reports accepted at [security contact on hortval.com](https://hortval.com)

### NIS2 Directive

NIS2 applies to operators of essential and important entities. If your organization falls under NIS2, deploying Hortval for internal certificate automation contributes to:

- **Supply chain security**: all dependencies are open source and auditable
- **Incident response**: tamper-evident audit log (JSONL + HMAC chain) records all certificate operations
- **Patch management**: single binary deployment simplifies updates

### Go Supply Chain Security

Go's module system provides strong supply chain security guarantees:

- **Reproducible builds**: `go.sum` records cryptographic hashes of every dependency
- **Module transparency log**: the Go checksum database (`sum.golang.org`) independently verifies module hashes
- **No runtime package loading**: all dependencies are compiled into the binary — no dynamic loading, no plugin injection surface

To verify the binary was built from unmodified sources:

```bash
go mod verify
```

## Minimal Footprint

Hortval is designed for a minimal attack surface:

- **Single binary** — no installer, no runtime dependencies, no package manager
- **Minimal outbound network** at runtime — your own ADCS and DNS servers, plus Hortval's licensing backend over HTTPS in the default online mode (`license: offline: true` removes it entirely). See [Outbound connections & licensing](./outbound-connections.md).
- **No separate telemetry channel** — the licensing call above is the entire outbound surface; there is no analytics or crash-reporting channel beside it, and what that call carries is listed in [What is exchanged](./outbound-connections.md#what-is-exchanged)
- **Standard library first** — cryptographic operations use Go's standard `crypto/x509` and `crypto/tls`; no custom crypto implementations
