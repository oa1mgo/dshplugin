---
name: find-dsh-plugins
description: Find and compare DeepSeek Harness plugins by capability, workflow, language, popularity, or maintainer using only the DSHPlugin catalog. Use when a user asks which DSH plugin fits a need, wants alternatives from DSHPlugin, or describes a task in natural language and needs matching catalog entries.
---

# Find DSH Plugins

Match a user's intent to plugins already indexed by DSHPlugin. Perform semantic matching yourself against the catalog fields; do not broaden discovery beyond this registry.

## Query efficiently within the boundary

- Before running anything, turn the request into one compact query containing the core capability and useful English synonyms.
- Run `python3 scripts/catalog_client.py --query "<capability and synonyms>" --limit 20` from this skill directory.
- The bundled client fetches only `https://dshplugin.org/api/github-catalog`, caches it locally for six hours, uses ETag revalidation, and returns a small candidate set. Reuse that output for the whole task.
- Do not add cache-busting query parameters or bypass the client with repeated catalog downloads.
- Search only the response's `plugins` array.
- Do not use GitHub Search, web search, other marketplaces, package registries, or guessed repository names.
- If the catalog is unavailable, report that clearly and stop. Do not replace it with an outside source.
- If no catalog entry fits, say so and suggest a narrower or alternate description without searching elsewhere.

## Match semantically

1. Translate the request into capabilities, likely synonyms, constraints, and exclusions before invoking the client.
2. Semantically rerank the returned candidates using their `name`, `description`, `topics`, `language`, and `repo` fields. Treat the client's `lexicalScore` only as candidate generation, not the final ranking.
3. Rank capability fit first. Use `stars` and `pushedAt` only as tie-breakers, never as proof of quality or safety.
4. Prefer entries with a complete immutable bundle contract: `repo`, `headSha`, and `bundlePatch`.
5. Return three to five strong matches unless fewer genuinely fit.

Do not require exact keyword overlap. For example, a request for "a terminal interface" can match descriptions or topics containing `tui`, `cli`, or `terminal` when the surrounding context supports it.

## Present recommendations

For every result, include:

- Plugin name and repository.
- A concise explanation tied to the user's requested capability.
- Current GitHub stars as a popularity signal.
- Relevant topics or language when useful.
- The pinned install command:

```text
dsh plugin --profile community add github:<repo>#<headSha>
```

- A source link pinned to the cataloged commit: `https://github.com/<repo>/tree/<headSha>`.

State that DSHPlugin indexing and stars are not a security review or endorsement. Before installation, offer to use `$audit-dsh-plugin-security` on the selected catalog entry.
