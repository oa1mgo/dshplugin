# Contributing to DSHPlugin

Thanks for helping make the DeepSeek Harness plugin ecosystem easier to discover and safer to explore. Contributions in English or Chinese are welcome.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use an issue for changes that alter the trust model, verification meaning, catalog schema, or moderation workflow.
- Use GitHub private vulnerability reporting for security issues; do not open a public security issue.
- Never include credentials, personal contact details, Cloudflare identifiers, production database IDs, or copied production data.

## Development setup

```bash
npm ci
npm run dev
```

Run the complete verification suite before opening a pull request:

```bash
npm run verify
```

When your change affects catalog sources or links, also run:

```bash
npm run check:catalog-links
```

This command performs live GitHub checks and therefore requires network access.

## Working with the catalog

- `src/data/awesome-catalog.generated.json` is generated. Do not hand-edit it.
- Update the snapshot with `npm run sync:catalog`.
- Repository imports must resolve to a canonical, publicly reachable GitHub repository.
- An imported repository remains unverified until DSHPlugin has its own evidence.
- Do not mark a plugin verified merely because it appears in an external list or has a trusted maintainer.
- Installation commands must only be shown for entries that DSH can actually install.

If you only want to propose a plugin, the plugin submission issue form is the easiest route.

## Commit convention

DSHPlugin uses Conventional Commits:

```text
<type>(optional-scope): <short imperative description>
```

Common types:

- `feat`: a user-visible capability
- `fix`: a bug or incorrect behavior
- `docs`: documentation only
- `refactor`: an internal change without behavior changes
- `test`: tests only
- `perf`: a performance improvement
- `build`: build or dependency changes
- `ci`: continuous integration changes
- `chore`: repository maintenance

Examples:

```text
feat(catalog): add runtime compatibility filters
fix(links): follow canonical GitHub redirects
docs: explain verification evidence
```

Use `!` or a `BREAKING CHANGE:` footer for breaking changes.

## Pull requests

Keep pull requests focused. A good pull request:

- explains the user or maintainer impact
- includes tests for changed behavior
- updates translations when visible copy changes
- does not weaken Cloudflare Access or Worker-side admin checks
- contains no generated build output, local configuration, or secrets
- uses a Conventional Commit-compatible title

By contributing, you agree that your contribution is licensed under the MIT License.
