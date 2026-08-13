import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../src/data/awesome-catalog.generated.json", import.meta.url), "utf-8"));

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
