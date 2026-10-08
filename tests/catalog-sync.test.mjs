import assert from "node:assert/strict";
import test from "node:test";
import { inspectRepository, normalizeTopics } from "../scripts/sync-github-topic-catalog.mjs";

const topic = "dsh-plugin";
const headSha = "a".repeat(40);
function repository(overrides = {}) {
  return {
    full_name: "fixture/plugin", name: "plugin", default_branch: "main",
    topics: [topic], private: false, archived: false, fork: false,
    stargazers_count: 1, forks_count: 0, pushed_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}
function inspection(overrides = {}) {
  const calls = [];
  const events = [];
  return {
    calls, events,
    options: {
      readMetadata: async (repo) => { calls.push(["metadata", repo]); return repository(); },
      readFile: async (repo, branch, file) => {
        calls.push(["file", repo, branch, file]);
        return file === "package.json" ? JSON.stringify({ name: "fixture", dsh: { bundle: { patch: "bundle.yml" } }, keywords: [topic] }) : "bundle: valid";
      },
      readHead: async (repo) => { calls.push(["head", repo]); return headSha; },
      log: (event) => events.push(event),
      ...overrides,
    },
  };
}

test("topic merge keeps verified membership with more than 32 earlier keywords", () => {
  const tags = Array.from({ length: 40 }, (_, index) => `a${String(index).padStart(2, "0")}`);
  const result = normalizeTopics([topic, ...tags], topic);
  assert.equal(result.length, 32);
  assert.ok(result.includes(topic));
  assert.deepEqual(result, [...tags.slice(0, 31), topic].sort());
});

test("topic normalization precedes deduplication and limiting", () => {
  const tags = Array.from({ length: 16 }, (_, index) => `a${String(index).padStart(2, "0")}`);
  const result = normalizeTopics([topic, " DSH-PLUGIN ", ...tags.flatMap((tag) => [tag, tag.toUpperCase()])], topic);
  assert.equal(result.length, 17);
  assert.equal(new Set(result).size, result.length);
  assert.ok(result.includes(topic));
  assert.deepEqual(normalizeTopics([" Foo ", "FOO", "", null, 123]), ["foo"]);
});

test("required-topic retention cannot invent a missing GitHub topic", () => {
  assert.throws(() => normalizeTopics(["other"], topic), /not verified/);
});

test("verified search membership avoids extra metadata calls and preserves the bundle contract", async () => {
  const context = inspection({ readMetadata: async () => { throw new Error("Unexpected metadata read"); } });
  const result = await inspectRepository(repository({ topics: [" DSH-PLUGIN "] }), context.options);
  assert.equal(result.plugin.repo, "fixture/plugin");
  assert.ok(result.plugin.topics.includes(topic));
  assert.equal(result.plugin.headSha, headSha);
  assert.equal(result.plugin.bundlePatch, "bundle.yml");
});

test("anomalous search results recheck metadata and use fresh canonical repository and branch", async () => {
  const fresh = repository({ full_name: "canonical/renamed", default_branch: "fresh", topics: ["DSH-PLUGIN"], stargazers_count: 9 });
  const context = inspection({ readMetadata: async (repo) => { context.calls.push(["metadata", repo]); return fresh; } });
  const result = await inspectRepository(repository({ topics: [] }), context.options);
  assert.deepEqual(context.calls[0], ["metadata", "fixture/plugin"]);
  assert.ok(context.calls.filter(([kind]) => kind === "file").every(([, repo, branch]) => repo === fresh.full_name && branch === "fresh"));
  assert.equal(result.plugin.repo, fresh.full_name);
  assert.equal(result.plugin.stars, 9);
  assert.ok(result.plugin.topics.includes(topic));
  assert.ok(context.events.some((event) => event.event === "topic_metadata_recheck" && event.repository === "fixture/plugin"));
});

test("manifest keywords cannot substitute for absent verified GitHub membership", async () => {
  const context = inspection({ readMetadata: async () => repository({ topics: ["other"] }) });
  const result = await inspectRepository(repository({ topics: [] }), context.options);
  assert.equal(result.rejection, "missingRequiredTopic");
  assert.equal(result.plugin, undefined);
  assert.deepEqual(context.calls, []);
  assert.ok(context.events.some((event) => event.event === "topic_metadata_rejected" && event.reason === "missingRequiredTopic"));
});

test("anomaly metadata 404 and 410 are explicit rejection, while ineligible repositories stay excluded", async () => {
  for (const status of [404, 410]) {
    const context = inspection({ readMetadata: async () => { throw Object.assign(new Error("Gone"), { status }); } });
    const result = await inspectRepository(repository({ topics: [] }), context.options);
    assert.equal(result.rejection, "repositoryUnavailable");
    assert.equal(result.plugin, undefined);
  }
  for (const field of ["private", "archived", "fork"]) {
    const context = inspection({ readMetadata: async () => repository({ [field]: true }) });
    const result = await inspectRepository(repository({ topics: [] }), context.options);
    assert.equal(result.rejection, "ineligibleRepository");
    assert.deepEqual(context.calls, []);
  }
});

test("uncertain metadata failures preserve the original error and identify the repository", async () => {
  for (const error of [Object.assign(new Error("Upstream unavailable"), { status: 503 }), Object.assign(new Error("TLS reset"), { cause: { code: "ECONNRESET" } })]) {
    const context = inspection({ readMetadata: async () => { throw error; } });
    await assert.rejects(inspectRepository(repository({ topics: [] }), context.options), (actual) => actual === error);
    assert.ok(context.events.some((event) => event.event === "topic_metadata_failed" && event.repository === "fixture/plugin"));
    assert.deepEqual(context.calls, []);
  }
});

test("malformed fresh metadata fails explicitly instead of inventing membership", async () => {
  const context = inspection({ readMetadata: async () => repository({ topics: undefined }) });
  await assert.rejects(inspectRepository(repository({ topics: [] }), context.options), /Invalid GitHub repository metadata.*fixture\/plugin/);
  assert.deepEqual(context.calls, []);
});

test("crowded bundle tags retain verified membership and log the identifying repository", async () => {
  const keywords = Array.from({ length: 40 }, (_, index) => `a${index}`);
  const context = inspection({ readFile: async (_repo, _branch, file) => file === "package.json" ? JSON.stringify({ dsh: { bundle: { patch: "bundle.yml" } }, keywords }) : "bundle: valid" });
  const result = await inspectRepository(repository(), context.options);
  assert.equal(result.plugin.topics.length, 32);
  assert.ok(result.plugin.topics.includes(topic));
  assert.ok(context.events.some((event) => event.event === "topic_tags_trimmed" && event.repository === "fixture/plugin"));
});
