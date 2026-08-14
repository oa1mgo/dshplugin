import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../src/data/awesome-catalog.generated.json", import.meta.url), "utf-8"));
const githubTopicCatalog = JSON.parse(await readFile(new URL("../public/catalog/github-topic.generated.json", import.meta.url), "utf-8"));
const { packagesWithGithubTopic } = await import("../src/data/packages.js");

test("catalog snapshot is attributable and substantial", () => {
  assert.equal(catalog.meta.sourceRepo, "AdamPlatin123/awesome-dsh-plugins");
  assert.equal(catalog.meta.sourcePath, "PLUGINS.md");
  assert.match(catalog.meta.sourceRevision, /^[0-9a-f]{40}$/);
  assert.ok(catalog.plugins.length >= 5);
  assert.equal(catalog.meta.total, catalog.plugins.length);
  assert.equal(catalog.meta.repositoryValidation.accepted, catalog.plugins.length);
});

test("catalog repositories are unique and categorized", () => {
  const repositories = catalog.plugins.map((plugin) => plugin.repo.toLowerCase());
  assert.equal(new Set(repositories).size, repositories.length);
  assert.ok(catalog.plugins.every((plugin) => plugin.name && plugin.repo && plugin.category));
  assert.ok(catalog.plugins.every((plugin) => plugin.repositoryStatus === "public"));
  assert.ok(catalog.plugins.every((plugin) => !plugin.repo.startsWith("dsh-external/")));
  assert.ok(catalog.plugins.every((plugin) => plugin.url === `https://github.com/${plugin.repo}`));
  assert.ok(catalog.meta.categoryCounts.Plugin >= 4);
});

test("GitHub topic snapshot records a complete, filtered scan", () => {
  assert.equal(githubTopicCatalog.meta.topic, "dsh-plugin");
  assert.equal(githubTopicCatalog.meta.sourceUrl, "https://github.com/topics/dsh-plugin");
  assert.match(githubTopicCatalog.meta.sourceUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(githubTopicCatalog.meta.total, githubTopicCatalog.plugins.length);
  assert.ok(githubTopicCatalog.plugins.length >= 100);
  assert.equal(
    githubTopicCatalog.meta.discovery.candidates,
    githubTopicCatalog.meta.discovery.accepted + githubTopicCatalog.meta.discovery.rejected,
  );
  assert.equal(githubTopicCatalog.meta.discovery.accepted, githubTopicCatalog.plugins.length);
});

test("GitHub topic entries have an immutable installable bundle contract", () => {
  const repositories = githubTopicCatalog.plugins.map((plugin) => plugin.repo.toLowerCase());
  assert.equal(new Set(repositories).size, repositories.length);
  assert.ok(githubTopicCatalog.plugins.every((plugin) => plugin.topics.includes("dsh-plugin")));
  assert.ok(githubTopicCatalog.plugins.every((plugin) => /^[0-9a-f]{40}$/.test(plugin.headSha)));
  assert.ok(githubTopicCatalog.plugins.every((plugin) => plugin.bundlePatch && !plugin.bundlePatch.includes("..")));
  assert.ok(githubTopicCatalog.plugins.every((plugin) => Array.isArray(plugin.lifecycleScripts)));
});

test("registry deduplicates sources and only claims install commands for confirmed bundles", () => {
  const packages = packagesWithGithubTopic(githubTopicCatalog);
  const repositories = packages.map((plugin) => plugin.repo.toLowerCase());
  const slugs = packages.map((plugin) => plugin.slug);
  assert.equal(new Set(repositories).size, repositories.length);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(packages.length > githubTopicCatalog.plugins.length);
  assert.ok(packages.filter((plugin) => plugin.sourceKind === "github-topic").every((plugin) => (
    plugin.installable && plugin.command.endsWith(`#${plugin.headSha}`)
  )));
  assert.ok(packages.filter((plugin) => plugin.sourceKind === "awesome").every((plugin) => (
    plugin.installable === false && plugin.command === ""
  )));
});
