#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGitAdvertisement } from "./github-repository-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageSource = await readFile(path.join(root, "src", "data", "packages.js"), "utf8");
const awesomeCatalog = JSON.parse(await readFile(path.join(root, "src", "data", "awesome-catalog.generated.json"), "utf8"));
const githubTopicCatalog = JSON.parse(await readFile(path.join(root, "public", "catalog", "github-topic.generated.json"), "utf8"));
const curatedBlock = packageSource.split("const catalogStyle =")[0];
const curatedRepositories = [...curatedBlock.matchAll(/^\s+repo:\s*"([^"]+)",$/gm)].map((match) => match[1]);
const repositories = [...new Set([
  ...curatedRepositories,
  ...awesomeCatalog.plugins.map((plugin) => plugin.repo),
  ...githubTopicCatalog.plugins.map((plugin) => plugin.repo),
])];

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function checkWithRetry(repository, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchGitAdvertisement(repository);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

let checked = 0;
const results = await mapLimit(repositories, 16, async (repository) => {
  const result = await checkWithRetry(repository);
  checked += 1;
  if (checked % 200 === 0) console.log(`Validated ${checked}/${repositories.length} repositories.`);
  return result;
});
const missing = results.filter((result) => !result.exists).map((result) => result.repository);

if (missing.length) {
  throw new Error(`Catalog contains inaccessible GitHub repositories:\n${missing.join("\n")}`);
}

console.log(`Validated ${repositories.length} public GitHub repositories; 0 inaccessible.`);
