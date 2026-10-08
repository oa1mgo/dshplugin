import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../src/data/awesome-catalog.generated.json", import.meta.url), "utf-8"));
const githubTopicCatalog = JSON.parse(await readFile(new URL("../public/catalog/github-topic.generated.json", import.meta.url), "utf-8"));
const { compareByStars, curatedPackages, packages: basePackages, packagesWithGithubTopic } = await import("../src/data/packages.js");

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
  assert.ok(Array.isArray(githubTopicCatalog.repositoryMetadata));
  assert.ok(githubTopicCatalog.repositoryMetadata.length >= 10);
  assert.ok(githubTopicCatalog.repositoryMetadata.every((repository) => Number.isInteger(repository.stars) && repository.stars >= 0));
});

test("GitHub topic entries have an immutable installable bundle contract", () => {
  const repositories = githubTopicCatalog.plugins.map((plugin) => plugin.repo.toLowerCase());
  assert.equal(new Set(repositories).size, repositories.length);
  assert.ok(
    githubTopicCatalog.plugins.every((plugin) => plugin.topics.includes("dsh-plugin")),
    `Missing required dsh-plugin topic: ${githubTopicCatalog.plugins.filter((plugin) => !plugin.topics.includes("dsh-plugin")).map((plugin) => plugin.repo).join(", ")}`,
  );
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

test("registry enriches every source with GitHub stars and ranks descending", () => {
  const packages = packagesWithGithubTopic(githubTopicCatalog);
  const metadataByRepo = new Map([
    ...githubTopicCatalog.plugins,
    ...githubTopicCatalog.repositoryMetadata,
  ].flatMap((repository) => [repository.repo, ...(repository.aliases || [])]
    .map((repo) => [repo.toLowerCase(), repository])));

  assert.ok(packages.every((plugin) => Number.isInteger(plugin.stars) && plugin.stars >= 0));
  assert.ok(packages.every((plugin) => metadataByRepo.has(plugin.repo.toLowerCase())));
  assert.ok(packages.every((plugin) => (
    plugin.stars === metadataByRepo.get(plugin.repo.toLowerCase()).stars
  )));

  const ranked = packages.toSorted(compareByStars);
  assert.ok(ranked.every((plugin, index) => index === 0 || ranked[index - 1].stars >= plugin.stars));
});

const renamedCuratedRepository = "zhu1090093659/dsh-web-ui";
const canonicalRepository = "zhu1090093659/dsh-web";
const fixtureHeadSha = "a".repeat(40);

function topicFixture(repo, stars) {
  return {
    name: "renamed-bundle",
    repo,
    description: "Installable bundle fixture",
    topics: ["dsh-plugin"],
    stars,
    forks: 1,
    language: "TypeScript",
    license: "MIT",
    pushedAt: "2026-08-31T00:00:00Z",
    headSha: fixtureHeadSha,
    bundlePatch: "cordis.patch.yml",
    lifecycleScripts: [],
  };
}

function metadataFixture(repo, stars, aliases = []) {
  const { headSha, bundlePatch, lifecycleScripts, ...metadata } = topicFixture(repo, stars);
  return { ...metadata, aliases };
}

test("registry deduplicates renamed curated and topic repositories after enrichment", () => {
  const curated = curatedPackages.find((plugin) => plugin.repo === renamedCuratedRepository);
  assert.ok(curated);
  for (const topicStars of [100, 101]) {
    const packages = packagesWithGithubTopic({
      plugins: [topicFixture(canonicalRepository.toUpperCase(), topicStars)],
      repositoryMetadata: [metadataFixture(canonicalRepository, 101, [renamedCuratedRepository])],
    });
    const matches = packages.filter((plugin) => plugin.repo.toLowerCase() === canonicalRepository);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].sourceKind, "curated");
    assert.equal(matches[0].slug, curated.slug);
    assert.equal(matches[0].stars, 101);
    assert.equal(matches[0].command, curated.command);
    assert.equal(new Set(packages.map((plugin) => plugin.repo.toLowerCase())).size, packages.length);
    assert.equal(new Set(packages.map((plugin) => plugin.slug)).size, packages.length);
  }
});

test("registry uses one metadata snapshot for topic stars and preserves pinned installation", () => {
  const repo = "fixture-owner/topic-bundle";
  const packages = packagesWithGithubTopic({
    plugins: [topicFixture(repo, 100)],
    repositoryMetadata: [metadataFixture(repo, 101, ["fixture-owner/previous-bundle"])],
  });
  const plugin = packages.find((item) => item.repo === repo);
  assert.equal(plugin.stars, 101);
  assert.equal(plugin.sourceKind, "github-topic");
  assert.equal(plugin.installable, true);
  assert.equal(plugin.headSha, fixtureHeadSha);
  assert.equal(plugin.bundlePatch, "cordis.patch.yml");
  assert.equal(plugin.command, `dsh plugin --profile community add github:${repo}#${fixtureHeadSha}`);
});

test("registry preserves curated precedence when an awesome alias resolves to the same repository", () => {
  const awesome = basePackages.find((plugin) => plugin.sourceKind === "awesome");
  assert.ok(awesome);
  const packages = packagesWithGithubTopic({
    plugins: [],
    repositoryMetadata: [metadataFixture(canonicalRepository, 101, [renamedCuratedRepository, awesome.repo])],
  });
  const matches = packages.filter((plugin) => plugin.repo.toLowerCase() === canonicalRepository);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].sourceKind, "curated");
  assert.equal(matches[0].stars, 101);
  assert.equal(new Set(packages.map((plugin) => plugin.repo.toLowerCase())).size, packages.length);
});
