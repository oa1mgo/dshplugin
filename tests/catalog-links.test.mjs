import assert from "node:assert/strict";
import test from "node:test";
import { checkerOptions, createRequestGate, rateLimitDelay, validateRepositories } from "../scripts/check-catalog-links.mjs";
import { fetchGitAdvertisement, readHeadRevision } from "../scripts/github-repository-check.mjs";

const head = "a".repeat(40);
const advertisement = `001e# service=git-upload-pack\n0000${head} HEAD\0symref=HEAD:refs/heads/main\n`;
function response(url, status = 200, body = "", headers = {}) {
  const result = new Response(body, { status, headers });
  Object.defineProperty(result, "url", { value: url });
  return result;
}
function successfulFetch(url) {
  return Promise.resolve(response(url, 200, url.includes("info/refs") ? advertisement : "public repository"));
}
function clock() {
  let time = Date.parse("2026-09-30T00:00:00Z");
  return { now: () => time, wait: async (ms) => { time += ms; }, advance: (ms) => { time += ms; } };
}

test("link checker validates conservative configurable concurrency and pacing", () => {
  assert.deepEqual(checkerOptions({}), { concurrency: 2, minIntervalMs: 250 });
  assert.deepEqual(checkerOptions({ CATALOG_LINK_CONCURRENCY: "1", CATALOG_LINK_MIN_INTERVAL_MS: "1000" }), { concurrency: 1, minIntervalMs: 1000 });
  for (const env of [
    { CATALOG_LINK_CONCURRENCY: "0" }, { CATALOG_LINK_CONCURRENCY: "1.5" },
    { CATALOG_LINK_MIN_INTERVAL_MS: "0" }, { CATALOG_LINK_MIN_INTERVAL_MS: "NaN" },
  ]) assert.throws(() => checkerOptions(env), /must be an integer/);
});

test("rate limits honor seconds, HTTP dates and exhausted reset, including clock skew", () => {
  const now = Date.parse("2026-09-30T00:00:00Z");
  assert.equal(rateLimitDelay({ retryAfter: "90" }, 1, now), 90000);
  assert.equal(rateLimitDelay({ retryAfter: "0.5" }, 1, now), 500);
  assert.equal(rateLimitDelay({ retryAfter: new Date(now + 120000).toUTCString() }, 1, now), 120000);
  assert.equal(rateLimitDelay({ retryAfter: "10", rateLimitRemaining: "0", rateLimitReset: String((now + 180000) / 1000) }, 1, now), 180000);
  assert.equal(rateLimitDelay({ retryAfter: new Date(now + 30000).toUTCString(), responseDate: new Date(now - 30000).toUTCString() }, 1, now), 60000);
  assert.equal(rateLimitDelay({ rateLimitRemaining: "10", rateLimitReset: String((now + 180000) / 1000) }, 1, now), 60000);
});

test("missing, invalid or expired hints use at least a minute and exponential backoff", () => {
  const now = Date.now();
  for (const retryAfter of [null, "invalid", "", "0", new Date(now - 1000).toUTCString()]) {
    assert.equal(rateLimitDelay({ retryAfter }, 1, now), 60000);
    assert.equal(rateLimitDelay({ retryAfter }, 3, now), 240000);
  }
});

test("HTTP failures retain rate-limit diagnostics on both page and Git phases", async () => {
  const headers = { "retry-after": "75", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1790730000", date: "Wed, 30 Sep 2026 00:00:00 GMT" };
  for (const phase of ["page", "git"]) {
    await assert.rejects(fetchGitAdvertisement("owner/plugin", { fetchImpl: async (url) => (
      phase === "page" || url.includes("info/refs") ? response(url, 429, "slow down", headers) : response(url)
    ) }), (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.phase, phase);
      assert.equal(error.retryAfter, "75");
      assert.equal(error.rateLimitRemaining, "0");
      assert.equal(error.rateLimitReset, "1790730000");
      assert.equal(error.responseDate, headers.date);
      assert.equal(error.rateLimited, true);
      assert.ok(Number.isFinite(error.receivedAt));
      return true;
    });
  }
});

test("secondary-limit 403 and ordinary 403 remain distinguishable", async () => {
  for (const [body, limited] of [["secondary rate limit exceeded", true], ["forbidden by policy", false]]) {
    await assert.rejects(fetchGitAdvertisement("owner/plugin", { fetchImpl: async (url) => response(url, 403, body) }), (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.rateLimited, limited);
      return true;
    });
  }
});

test("canonical redirects and Git HEAD validation preserve the public-repository contract", async () => {
  const requests = [];
  const result = await fetchGitAdvertisement("old/plugin", { fetchImpl: async (url) => {
    requests.push(url);
    return response(url.includes("info/refs") ? url : "https://github.com/new/plugin", 200, url.includes("info/refs") ? advertisement : "");
  } });
  assert.equal(result.canonicalRepository, "new/plugin");
  assert.equal(readHeadRevision(result.text), head);
  assert.equal(requests[1], "https://github.com/new/plugin.git/info/refs?service=git-upload-pack");
  await assert.rejects(fetchGitAdvertisement("owner/plugin", { fetchImpl: async () => response("https://elsewhere.invalid/owner/plugin") }), /Unexpected GitHub repository redirect/);
  await assert.rejects(fetchGitAdvertisement("owner/plugin", { fetchImpl: async (url) => response(url, 200, "git-upload-pack without HEAD") }), /Unexpected GitHub Git response/);
});

test("404/410 pages and inaccessible Git responses retain definite failure status", async () => {
  for (const status of [404, 410]) {
    const result = await fetchGitAdvertisement("owner/plugin", { fetchImpl: async (url) => response(url, status) });
    assert.equal(result.exists, false);
    assert.equal(result.status, status);
    assert.equal(result.phase, "page");
  }
  for (const status of [401, 404, 410]) {
    const result = await fetchGitAdvertisement("owner/plugin", { fetchImpl: async (url) => response(url, url.includes("info/refs") ? status : 200) });
    assert.equal(result.exists, false);
    assert.equal(result.status, status);
    assert.equal(result.phase, "git");
  }
});

test("queue waits do not consume the timeout for either HTTP request", async () => {
  let gates = 0;
  const result = await fetchGitAdvertisement("owner/plugin", {
    timeoutMs: 5,
    beforeRequest: async () => { gates++; await new Promise((resolve) => setTimeout(resolve, 20)); },
    fetchImpl: async (url, { signal }) => { assert.equal(signal.aborted, false); return successfulFetch(url); },
  });
  assert.equal(gates, 2);
  assert.equal(result.exists, true);
});

test("a real network timeout remains uncertain instead of becoming a missing link", async () => {
  const result = await validateRepositories(["owner/plugin", "owner/unattempted"], {
    concurrency: 1, attempts: 1, timeoutMs: 5, minIntervalMs: 0, log: () => {},
    fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })),
  });
  assert.equal(result.result, "blocked");
  assert.equal(result.missing.length, 0);
  assert.equal(result.unresolved.length, 1);
  assert.equal(result.notChecked, 1);
});

test("queued requests observe a later global pause and maintain request spacing", async () => {
  const fake = clock();
  const starts = [];
  let release;
  let notify;
  const waiting = new Promise((resolve) => { notify = resolve; });
  let firstWait = true;
  const gate = createRequestGate({ minIntervalMs: 250, now: fake.now, log: () => {}, wait: async (ms) => {
    if (firstWait) { firstWait = false; notify(); await new Promise((resolve) => { release = resolve; }); }
    fake.advance(ms);
  } });
  await gate.acquire();
  starts.push(fake.now());
  const next = gate.acquire().then(() => starts.push(fake.now()));
  await waiting;
  const pausedAt = fake.now();
  gate.pause(60000, { repository: "owner/limited" });
  release();
  await next;
  await gate.acquire();
  starts.push(fake.now());
  assert.ok(starts[1] >= pausedAt + 60000);
  assert.ok(starts[2] - starts[1] >= 250);
});

test("successful full scans bound concurrency and pace both page and Git requests", async () => {
  const starts = [];
  let active = 0;
  let peak = 0;
  const started = Date.now();
  const summary = await validateRepositories(["owner/one", "owner/two", "owner/three"], {
    concurrency: 2, minIntervalMs: 10, log: () => {},
    fetchImpl: async (url) => {
      starts.push(Date.now());
      active++; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active--;
      return successfulFetch(url);
    },
  });
  assert.equal(summary.result, "passed");
  assert.equal(summary.checked, 3);
  assert.equal(summary.notChecked, 0);
  assert.equal(starts.length, 6);
  assert.ok(peak <= 2);
  assert.ok(Date.now() - started >= 50);
  assert.ok(starts.every((time, index) => index === 0 || time - starts[index - 1] >= 8));
});

test("a 429 pauses other workers globally before they can issue Git requests", async () => {
  const fake = clock();
  const logs = [];
  const starts = [];
  let limitedAt;
  let first = true;
  const summary = await validateRepositories(["owner/limited", "owner/other"], {
    ...fake, concurrency: 2, minIntervalMs: 250, log: (event) => logs.push(event),
    fetchImpl: async (url) => {
      starts.push({ url, at: fake.now() });
      if (url.endsWith("/owner/limited") && first) {
        first = false;
        limitedAt = fake.now();
        return response(url, 429, "slow down", { "retry-after": "90" });
      }
      return successfulFetch(url);
    },
  });
  assert.equal(summary.result, "passed");
  const pause = logs.find((event) => event.event === "rate_limit_wait");
  assert.equal(pause.waitMs, 90000);
  const gitStarts = starts.filter(({ url }) => url.includes("info/refs"));
  assert.ok(gitStarts.every(({ at }) => at >= limitedAt + 90000));
});

test("rate-limit exhaustion halts the scan, preserves diagnostics and never reports bad links", async () => {
  const fake = clock();
  const logs = [];
  const summary = await validateRepositories(["owner/limited", "owner/unattempted"], {
    ...fake, concurrency: 1, attempts: 3, minIntervalMs: 250, log: (event) => logs.push(event),
    fetchImpl: async (url) => response(url, 429, "slow down"),
  });
  assert.equal(summary.result, "blocked");
  assert.equal(summary.missing.length, 0);
  assert.equal(summary.unresolved[0].status, 429);
  assert.equal(summary.notChecked, 1);
  assert.deepEqual(logs.filter(({ event }) => event === "rate_limit_wait").map(({ waitMs }) => waitMs), [60000, 120000, 240000]);
});

test("complete scans distinguish definite inaccessible repositories from transient failures", async () => {
  const fake = clock();
  const summary = await validateRepositories(["owner/missing", "owner/good"], {
    ...fake, concurrency: 1, minIntervalMs: 250, log: () => {},
    fetchImpl: async (url) => url.endsWith("/owner/missing") ? response(url, 404) : successfulFetch(url),
  });
  assert.equal(summary.result, "inaccessible");
  assert.equal(summary.checked, 2);
  assert.equal(summary.valid, 1);
  assert.equal(summary.unresolved.length, 0);
  assert.deepEqual(summary.missing, [{ repository: "owner/missing", status: 404, phase: "page" }]);
});
