# Security Policy

## Reporting a vulnerability

Please do not disclose security vulnerabilities in public issues, discussions, pull requests, or plugin reports.

Use [GitHub private vulnerability reporting](https://github.com/oa1mgo/dshplugin/security/advisories/new). Include:

- the affected route, component, or revision
- steps to reproduce
- expected and observed impact
- any suggested mitigation

If you discover an exposed credential, revoke or rotate it first when you control it, then report the incident privately. Do not include live credentials in the report.

## Security boundaries

The public repository contains application source and sanitized deployment examples. It does not contain production Cloudflare account credentials, Access application values, D1 identifiers, administrator identity, DNS configuration, or production data.

Production admin routes must be protected in two layers:

1. Cloudflare Access protects `/admin*` and `/api/admin/*`.
2. The Worker validates the Access JWT and configured administrator identity again before reading or mutating moderation data.

Forks and self-hosted deployments are responsible for their own Cloudflare account, Access policies, secrets, rate limits, and data retention rules.

## Supported versions

Security fixes are applied to the latest code on `main`. Older commits and third-party deployments may not receive fixes.
