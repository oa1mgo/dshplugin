#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import awesomeCatalog from "../src/data/awesome-catalog.generated.json" with { type: "json" };
import { curatedPackages } from "../src/data/packages.js";
import { readHeadRevision } from "./github-repository-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "public", "catalog", "github-topic.generated.json");
const topic = "dsh-plugin";
const sourceUrl = `https://github.com/topics/${topic}`;
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const apiHeaders = {
  accept: "application/vnd.github+json",
  "user-agent": "dshplugin-topic-sync",
  "x-github-api-version": "2022-11-28",
  ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
};
const starSlices = [">=100", "10..99", "5..9", "1..4", "0"];
const rawConcurrency = 16;
const oldestGitHubTimestamp = Date.parse("2008-01-01T00:00:00Z");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, options = {}, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) return response;
      const retryAfter = Number(response.headers.get("retry-after")) * 1000;
      const rateLimitReset = Number(response.headers.get("x-ratelimit-reset")) * 1000 - Date.now() + 1000;
      const waitFor = Math.min(Math.max(retryAfter || 0, rateLimitReset || 0, 500 * 2 ** (attempt - 1)), 60_000);
      await response.body?.cancel();
      if (response.status === 429) console.log(`GitHub throttled a repository check; retrying in ${Math.ceil(waitFor / 1000)}s.`);
      await sleep(waitFor);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function fetchSearchPage(query, page) {
  const parameters = new URLSearchParams({
    q: query,
    sort: "updated",
    order: "desc",
    per_page: "100",
    page: String(page),
  });
  const response = await fetchWithRetry(`https://api.github.com/search/repositories?${parameters}`, {
    headers: apiHeaders,
  });

  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    const resetAt = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    const waitFor = Math.max(resetAt - Date.now() + 1000, 1000);
    await response.body?.cancel();
    console.log(`GitHub Search rate limit reached; retrying in ${Math.ceil(waitFor / 1000)}s.`);
    await sleep(waitFor);
    return fetchSearchPage(query, page);
  }
  if (!response.ok) {
    throw new Error(`GitHub repository search failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.incomplete_results) throw new Error(`GitHub returned incomplete search results for: ${query}`);
  return payload;
}

function formatSearchTimestamp(value) {
  return new Date(value).toISOString().replace(".000Z", "Z");
}

async function searchSlice(stars, createdStart, createdEnd) {
  const query = [
    `topic:${topic}`,
    "fork:false",
    "archived:false",
    `stars:${stars}`,
    ...(createdStart ? [`created:${createdStart}..${createdEnd}`] : []),
  ].join(" ");
  const firstPage = await fetchSearchPage(query, 1);

  if (firstPage.total_count > 1000) {
    const start = createdStart ? Date.parse(createdStart) : oldestGitHubTimestamp;
    const end = createdEnd ? Date.parse(createdEnd) : Math.floor(Date.now() / 1000) * 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      throw new Error(`More than 1,000 repositories share the same search partition: ${query}`);
    }
    const midpoint = start + Math.floor((end - start) / 2000) * 1000;
    const left = await searchSlice(stars, formatSearchTimestamp(start), formatSearchTimestamp(midpoint));
    const right = await searchSlice(stars, formatSearchTimestamp(midpoint + 1000), formatSearchTimestamp(end));
    return [...left, ...right];
  }

  const repositories = [...firstPage.items];
  const pages = Math.ceil(firstPage.total_count / 100);
  for (let page = 2; page <= pages; page += 1) {
    const payload = await fetchSearchPage(query, page);
    repositories.push(...payload.items);
  }
  return repositories;
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function rawUrl(repository, branch, filePath) {
  return `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(branch)}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

async function readRawFile(repository, branch, filePath) {
  const response = await fetchWithRetry(rawUrl(repository, branch, filePath), {
    headers: { "user-agent": "dshplugin-topic-sync" },
    redirect: "follow",
  });
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    throw new Error(`Raw GitHub fetch failed: ${response.status} ${repository}/${filePath}`);
  }
  return response.text();
}

async function readRepositoryHead(repository) {
  const response = await fetchWithRetry(`https://github.com/${repository}.git/info/refs?service=git-upload-pack`, {
    headers: {
      accept: "application/x-git-upload-pack-advertisement",
      "user-agent": "dshplugin-topic-sync",
    },
    redirect: "follow",
  });
  if (response.status === 404 || response.status === 410) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) throw new Error(`GitHub Git advertisement failed: ${response.status} ${repository}`);
  const advertisement = await response.text();
  if (!advertisement.includes("git-upload-pack")) {
    throw new Error(`Unexpected GitHub Git response for ${repository}`);
  }
  return readHeadRevision(advertisement);
}

async function readRepositoryMetadata(repository) {
  const response = await fetchWithRetry(`https://api.github.com/repos/${repository}`, { headers: apiHeaders });
  if (!response.ok) throw new Error(`GitHub repository metadata failed: ${response.status} ${repository}`);
  const payload = await response.json();
  const canonicalRepo = payload.full_name;
  return {
    repo: canonicalRepo,
    ...(canonicalRepo.toLowerCase() === repository.toLowerCase() ? {} : { aliases: [repository] }),
    stars: payload.stargazers_count,
    forks: payload.forks_count,
    language: cleanText(payload.language, 40),
    license: payload.license?.spdx_id === "NOASSERTION" ? "" : cleanText(payload.license?.spdx_id, 40),
    topics: (payload.topics || []).map((value) => cleanText(value.toLowerCase(), 64)).filter(Boolean).sort().slice(0, 32),
    pushedAt: payload.pushed_at,
    defaultBranch: payload.default_branch,
  };
}

function normalizePatchPath(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^\.\//, "");
  if (!normalized || path.posix.isAbsolute(normalized)) return null;
  if (normalized.split("/").some((segment) => !segment || segment === ".." || segment === ".git")) return null;
  return normalized;
}

function stringList(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  if (typeof value === "string" && value.trim()) return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

function cleanText(value, maximumLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maximumLength).trimEnd();
}

async function inspectRepository(repository) {
  const manifestText = await readRawFile(repository.full_name, repository.default_branch, "package.json");
  if (manifestText === null) return { rejection: "missingPackageManifest" };

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    return { rejection: "invalidPackageManifest" };
  }

  const bundlePatch = normalizePatchPath(manifest?.dsh?.bundle?.patch);
  if (!bundlePatch) return { rejection: "missingBundleDeclaration" };
  const patchText = await readRawFile(repository.full_name, repository.default_branch, bundlePatch);
  if (patchText === null || !patchText.trim()) return { rejection: "missingBundlePatch" };

  const headSha = await readRepositoryHead(repository.full_name);
  if (!headSha) return { rejection: "unresolvedRevision" };

  const canonicalRepo = repository.full_name;
  const scripts = manifest.scripts && typeof manifest.scripts === "object" ? manifest.scripts : {};
  const lifecycleScripts = ["preinstall", "install", "postinstall", "prepare"].filter(
    (script) => typeof scripts[script] === "string" && scripts[script].trim(),
  );
  const topics = [...new Set([...(repository.topics || []), ...stringList(manifest.keywords)])]
    .map((value) => cleanText(value.toLowerCase(), 64))
    .filter(Boolean)
    .sort()
    .slice(0, 32);

  return {
    plugin: {
      name: cleanText(manifest.name, 100) || repository.name,
      version: cleanText(manifest.version, 40),
      repo: canonicalRepo,
      description: cleanText(manifest.description, 360) || cleanText(repository.description, 360),
      topics,
      language: cleanText(repository.language, 40),
      license: repository.license?.spdx_id === "NOASSERTION" ? "" : cleanText(repository.license?.spdx_id, 40),
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      defaultBranch: repository.default_branch,
      headSha,
      pushedAt: repository.pushed_at,
      bundlePatch,
      lifecycleScripts,
    },
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

const discovered = [];
for (const stars of starSlices) {
  discovered.push(...await searchSlice(stars));
}
const repositories = [...new Map(discovered.map((repository) => [repository.full_name.toLowerCase(), repository])).values()];
console.log(`Discovered ${repositories.length} public, non-archived repositories with topic:${topic}.`);

let inspected = 0;
const inspectionResults = await mapLimit(repositories, rawConcurrency, async (repository) => {
  const result = await inspectRepository(repository);
  inspected += 1;
  if (inspected % 200 === 0) console.log(`Inspected ${inspected}/${repositories.length} repository manifests.`);
  return result;
});
const plugins = inspectionResults
  .flatMap((result) => result.plugin ? [result.plugin] : [])
  .sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt) || b.stars - a.stars || a.repo.localeCompare(b.repo));
const rejections = countBy(inspectionResults.filter((result) => result.rejection), "rejection");
const topicRepositories = new Set(plugins.map((plugin) => plugin.repo.toLowerCase()));
const supplementalRepositories = [...new Set([
  ...curatedPackages.map((plugin) => plugin.repo),
  ...awesomeCatalog.plugins.map((plugin) => plugin.repo),
])].filter((repository) => !topicRepositories.has(repository.toLowerCase()));
const repositoryMetadata = (await mapLimit(supplementalRepositories, rawConcurrency, readRepositoryMetadata))
  .sort((a, b) => b.stars - a.stars || a.repo.localeCompare(b.repo));
const checkedAt = new Date().toISOString();
const output = {
  meta: {
    topic,
    sourceUrl,
    searchQuery: `topic:${topic} fork:false archived:false`,
    sourceUpdatedAt: checkedAt,
    discovery: {
      method: "github-search-and-root-bundle-manifest",
      candidates: repositories.length,
      accepted: plugins.length,
      rejected: repositories.length - plugins.length,
      rejectionCounts: rejections,
    },
    total: plugins.length,
  },
  plugins,
  repositoryMetadata,
};

try {
  const previous = JSON.parse(await readFile(destination, "utf8"));
  const comparablePrevious = structuredClone(previous);
  const comparableOutput = structuredClone(output);
  comparablePrevious.meta.sourceUpdatedAt = "";
  comparableOutput.meta.sourceUpdatedAt = "";
  if (JSON.stringify(comparablePrevious) === JSON.stringify(comparableOutput)) {
    output.meta.sourceUpdatedAt = previous.meta.sourceUpdatedAt;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Accepted ${plugins.length}/${repositories.length} repositories with a root dsh.bundle.patch contract.`);
console.log(`Refreshed stars and repository metadata for ${repositoryMetadata.length} additional catalog entries.`);
