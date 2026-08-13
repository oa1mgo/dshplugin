<div align="center">

# DSHPlugin

**Everything is a plugin.**

A community-built discovery and verification registry for the DeepSeek Harness ecosystem.

[Open dshplugin.org](https://dshplugin.org) · [Contributing](CONTRIBUTING.md) · [中文说明](README.zh-CN.md)

[![CI](https://github.com/oa1mgo/dshplugin/actions/workflows/ci.yml/badge.svg)](https://github.com/oa1mgo/dshplugin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0f766e.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

</div>

![DSHPlugin registry](qa-home-final.png)

> [!NOTE]
> DSHPlugin is an independent community project. It is not an official DeepSeek product and is not endorsed by DeepSeek.

## Why DSHPlugin?

DeepSeek Harness is intentionally extensible, but discovery should not require searching through scattered repositories or trusting a name alone. DSHPlugin brings plugin discovery, source provenance, compatibility notes, and verification state into one focused registry.

The project is built in public so plugin authors, DSH users, security researchers, and translators can improve the ecosystem together.

Explore the production registry at **[dshplugin.org](https://dshplugin.org)**.

## What is included

- Searchable, paginated plugin registry with direct links to canonical repositories
- English, Simplified Chinese, Japanese, Korean, and Spanish interfaces
- Light, dark, and system themes
- Cross-platform DSH installation commands
- Catalog synchronization from [`awesome-dsh-plugins`](https://github.com/AdamPlatin123/awesome-dsh-plugins)
- Git smart-HTTP validation that rejects missing or redirected repository placeholders
- D1-backed plugin submissions, reports, and catalog review state
- Cloudflare Access-protected moderation UI with server-side JWT verification
- Evidence-aware verification marks—imported entries are never automatically treated as verified

## Trust model

DSHPlugin separates *being listed* from *being verified*.

| State | Meaning |
| --- | --- |
| Unverified | The source repository is publicly reachable, but DSHPlugin has not produced verification evidence. |
| Review | The entry or its evidence needs human review. |
| Verified | DSHPlugin has recorded verification evidence for an immutable source revision and tested DSH revision. |

A green verification mark is intentionally narrow: it describes recorded evidence for a specific revision, not a permanent guarantee about future releases.

## Architecture

```text
React + Vite registry
        │
Cloudflare Worker ── static assets and API routing
        │
Cloudflare D1 ────── submissions, reports, review state
        │
Cloudflare Access ── /admin and /api/admin/*
```

The public source contains the application and deployment examples. Production account identifiers, Access configuration, database IDs, domains, and local secrets are deliberately excluded.

## Quick start

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/oa1mgo/dshplugin.git
cd dshplugin
npm ci
npm run dev
```

The Vite development server is enough for registry UI work. To run the complete Worker and D1 flow locally:

```bash
cp wrangler.example.jsonc wrangler.jsonc
cp .dev.vars.example .dev.vars
npm run build
npx wrangler d1 migrations apply dshplugin-moderation --local
npx wrangler dev
```

Use example values locally. Never commit `.dev.vars`, `.env` files, or your real `wrangler.jsonc`.

## Useful commands

```bash
npm test                    # catalog and localization tests
npm run build               # production frontend and Worker package
npm run test:sites          # Worker API and packaging tests
npm run verify              # complete local verification
npm run check:catalog-links # live GitHub repository validation
npm run sync:catalog        # refresh the upstream catalog snapshot
```

## Deploying your own instance

DSHPlugin runs on Cloudflare Workers with a D1 binding.

1. Copy `wrangler.example.jsonc` to the ignored `wrangler.jsonc`.
2. Create your own D1 database and replace the placeholder database ID.
3. Store `ADMIN_EMAIL`, `CF_ACCESS_AUD`, and `CF_ACCESS_ISSUER` with `wrangler secret put` or in the Cloudflare dashboard—never in Git.
4. Apply the migrations in `migrations/`.
5. Protect both `/admin*` and `/api/admin/*` with your own Cloudflare Access application and allow policy.
6. Add your own routes or custom domains only in the ignored deployment configuration.
7. Run `npm run deploy`.

Every fork must use its own Cloudflare account, database, Access policy, and identity provider. The repository does not grant access to the production DSHPlugin infrastructure.

## Contributing

There are useful contributions at every level:

- Submit or correct a plugin repository
- Improve verification methodology and evidence presentation
- Add tests for catalog parsing, links, API behavior, or localization
- Improve accessibility, responsive behavior, and translations
- Review reports and ecosystem edge cases
- Propose reliable automation for plugin health and compatibility

Start with a [good first issue](https://github.com/oa1mgo/dshplugin/labels/good%20first%20issue), open a proposal, or read [CONTRIBUTING.md](CONTRIBUTING.md). Chinese and English contributions are both welcome.

All commits follow [Conventional Commits](https://www.conventionalcommits.org/), for example `feat: add plugin health filters` or `fix: reject unreachable repository redirects`.

## Security

Please do not disclose vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) and use GitHub private vulnerability reporting.

## Acknowledgements

- [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) for the extensible Harness architecture
- [`AdamPlatin123/awesome-dsh-plugins`](https://github.com/AdamPlatin123/awesome-dsh-plugins) for the community catalog source
- Everyone building, testing, documenting, and reviewing DSH plugins

## License

[MIT](LICENSE) © DSHPlugin contributors.
