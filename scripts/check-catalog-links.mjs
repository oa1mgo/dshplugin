#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGitAdvertisement } from "./github-repository-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageSource = await readFile(path.join(root, "src", "data", "packages.js"), "utf8");
const catalog = JSON.parse(await readFile(path.join(root, "src", "data", "awesome-catalog.generated.json"), "utf8"));
const curatedBlock = packageSource.split("const catalogStyle =")[0];
const curatedRepositories = [...curatedBlock.matchAll(/^\s+repo:\s*"([^"]+)",$/gm)].map((match) => match[1]);
const repositories = [...new Set([...curatedRepositories, ...catalog.plugins.map((plugin) => plugin.repo)])];

const results = await Promise.all(repositories.map((repository) => fetchGitAdvertisement(repository)));
const missing = results.filter((result) => !result.exists).map((result) => result.repository);

if (missing.length) {
  throw new Error(`Catalog contains inaccessible GitHub repositories:\n${missing.join("\n")}`);
}

console.log(`Validated ${repositories.length} public GitHub repositories; 0 inaccessible.`);
