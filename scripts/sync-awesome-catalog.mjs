#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGitAdvertisement, readHeadRevision } from "./github-repository-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRepo = "AdamPlatin123/awesome-dsh-plugins";
const sourceUrl = `https://github.com/${sourceRepo}`;
const sourcePath = "PLUGINS.md";
const catalogUrl = `https://raw.githubusercontent.com/${sourceRepo}/main/${sourcePath}`;

const categoryMarkers = new Map([
  ["单插件", "Plugin"],
  ["插件集", "Bundle"],
  ["技能", "Skill"],
  ["远程渠道", "Channel"],
  ["基础设施", "Infrastructure"],
  ["未分类", "Other"],
]);

function readCategory(line) {
  if (!line.startsWith("## ")) return null;
  for (const [marker, category] of categoryMarkers) {
    if (line.includes(marker)) return category;
  }
  return null;
}

function parseCatalog(markdown) {
  const entries = new Map();
  let category = null;
  const catalogBlock = markdown.split("<!-- 新增条目示例")[0];

  for (const line of catalogBlock.split(/\r?\n/)) {
    category = readCategory(line) ?? category;
    if (!category || !line.startsWith("|")) continue;

    const match = /^\|\s*([^|]+?)\s*\|\s*\[[^\]]+\]\((https:\/\/github\.com\/([^/\s]+)\/([^/)\s]+))\)\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (!match) continue;

    const [, name, url, owner, repository, rawDescription] = match;
    const repo = `${owner}/${repository}`;
    if (repo.toLowerCase() === sourceRepo.toLowerCase()) continue;

    const description = rawDescription === "null" || rawDescription === "—"
      ? ""
      : rawDescription.replace(/\\\|/g, "|").trim();

    entries.set(repo.toLowerCase(), {
      name,
      repo,
      owner,
      url,
      category,
      description,
    });
  }

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withRetry(operation, label, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const waitFor = 500 * 2 ** (attempt - 1);
      console.log(`${label} failed; retrying in ${waitFor}ms.`);
      await sleep(waitFor);
    }
  }
  throw lastError;
}

async function fetchText(url) {
  return withRetry(async () => {
    const response = await fetch(url, { headers: { "user-agent": "dshplugin-catalog-sync" } });
    if (!response.ok) throw new Error(`Catalog fetch failed: ${response.status} ${url}`);
    return response.text();
  }, `Catalog fetch ${url}`);
}

const checkedAt = new Date().toISOString();
const markdown = await fetchText(catalogUrl);
const candidates = parseCatalog(markdown);
const validationResults = await Promise.all(
  candidates.map(async (plugin) => ({
    plugin,
    check: await withRetry(() => fetchGitAdvertisement(plugin.repo), `Repository check ${plugin.repo}`),
  })),
);
const validatedPlugins = validationResults
  .filter(({ check }) => check.exists)
  .map(({ plugin, check }) => {
    const [owner] = check.canonicalRepository.split("/");
    return {
      ...plugin,
      owner,
      repo: check.canonicalRepository,
      url: check.canonicalUrl,
      ...(plugin.repo === check.canonicalRepository ? {} : { upstreamRepo: plugin.repo }),
      repositoryStatus: "public",
      repositoryCheckedAt: checkedAt,
    };
  });
const plugins = [...new Map(validatedPlugins.map((plugin) => [plugin.repo.toLowerCase(), plugin])).values()];
const rejectedRepositories = validationResults
  .filter(({ check }) => !check.exists)
  .map(({ plugin }) => plugin.repo);

const sourceAdvertisement = await withRetry(
  () => fetchGitAdvertisement(sourceRepo),
  `Source revision check ${sourceRepo}`,
);
const revision = readHeadRevision(sourceAdvertisement.text);
if (!revision) throw new Error(`Could not resolve source revision for ${sourceRepo}`);

const categoryCounts = Object.fromEntries(
  [...categoryMarkers.values()].map((category) => [
    category,
    plugins.filter((plugin) => plugin.category === category).length,
  ]),
);

const output = {
  meta: {
    sourceRepo,
    sourceUrl,
    sourcePath,
    sourceRevision: revision,
    sourceUpdatedAt: checkedAt,
    repositoryValidation: {
      method: "git-smart-http",
      checkedAt,
      candidates: candidates.length,
      validated: validatedPlugins.length,
      accepted: plugins.length,
      deduplicated: validatedPlugins.length - plugins.length,
      rejected: rejectedRepositories.length,
      rejectedRepositories,
    },
    license: "MIT",
    total: plugins.length,
    categoryCounts,
  },
  plugins,
};

const destination = path.join(root, "src", "data", "awesome-catalog.generated.json");
await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Synced ${plugins.length}/${candidates.length} public repositories from ${sourceRepo}/${sourcePath} @ ${revision.slice(0, 7)}`,
);
