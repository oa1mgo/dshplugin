#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGitAdvertisement } from "./github-repository-check.mjs";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const defaultLog = (event) => console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));

export function checkerOptions(env = process.env) {
  function integer(name, fallback, minimum, maximum) {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
    }
    return value;
  }
  return {
    concurrency: integer("CATALOG_LINK_CONCURRENCY", 2, 1, 8),
    minIntervalMs: integer("CATALOG_LINK_MIN_INTERVAL_MS", 250, 100, 60000),
  };
}

export function rateLimitDelay(error, attempt, now = Date.now()) {
  const delays = [];
  const serverDate = Date.parse(error.responseDate);
  function until(timestamp) {
    // Account conservatively for client/server clock differences.
    return Math.max(timestamp - now, Number.isFinite(serverDate) ? timestamp - serverDate : 0);
  }
  if (error.retryAfter !== null && error.retryAfter !== undefined) {
    const value = error.retryAfter.trim();
    if (/^\d+(?:\.\d+)?$/.test(value)) delays.push(Number(value) * 1000);
    else {
      const date = Date.parse(value);
      if (Number.isFinite(date)) delays.push(until(date));
    }
  }
  if (error.rateLimitRemaining === "0" && /^\d+$/.test(error.rateLimitReset || "")) {
    delays.push(until(Number(error.rateLimitReset) * 1000));
  }
  const hintedDelay = Math.max(0, ...delays);
  return hintedDelay > 0 ? Math.ceil(hintedDelay) : 60000 * 2 ** (attempt - 1);
}

export function createRequestGate({ minIntervalMs = 250, now = Date.now, wait = sleep, log = defaultLog } = {}) {
  let queued = Promise.resolve();
  let nextRequestAt = 0;
  let pausedUntil = 0;
  return {
    acquire() {
      const ready = queued.then(async () => {
        while (Math.max(nextRequestAt, pausedUntil) > now()) {
          await wait(Math.min(60000, Math.max(nextRequestAt, pausedUntil) - now()));
        }
        nextRequestAt = now() + minIntervalMs;
      });
      queued = ready.catch(() => {});
      return ready;
    },
    pause(delayMs, details) {
      const resumeAt = now() + delayMs;
      if (resumeAt > pausedUntil) {
        pausedUntil = resumeAt;
        log({ event: "rate_limit_wait", ...details, waitMs: delayMs, resumeAt: new Date(pausedUntil).toISOString() });
      }
    },
    get pausedUntil() { return pausedUntil; },
  };
}

export async function validateRepositories(repositories, {
  concurrency = 2,
  minIntervalMs = 250,
  attempts = 4,
  timeoutMs = 15000,
  fetchImpl = fetch,
  now = Date.now,
  wait = sleep,
  log = defaultLog,
} = {}) {
  const gate = createRequestGate({ minIntervalMs, now, wait, log });
  let cursor = 0;
  let checked = 0;
  let valid = 0;
  let stop = false;
  const missing = [];
  const unresolved = [];
  let rateLimitAttempt = 0;
  let lastProgressAt = now();
  log({ event: "start", total: repositories.length, concurrency, minIntervalMs, attempts });

  async function checkWithRetry(repository) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await fetchGitAdvertisement(repository, {
          timeoutMs,
          fetchImpl,
          beforeRequest: async () => {
            await gate.acquire();
            if (stop) throw new Error("Validation stopped after an unresolved repository");
          },
        });
        rateLimitAttempt = 0;
        return result;
      } catch (error) {
        const details = {
          repository, attempt, status: error.status ?? null, phase: error.phase ?? null,
          message: error.message, networkCode: error.cause?.code ?? null,
          retryAfter: error.retryAfter ?? null, rateLimitRemaining: error.rateLimitRemaining ?? null,
          rateLimitReset: error.rateLimitReset ?? null,
        };
        if (error.rateLimited) {
          rateLimitAttempt += 1;
          gate.pause(rateLimitDelay(error, Math.max(attempt, rateLimitAttempt), now()), details);
        }
        log({ event: "retry", ...details, retrying: attempt < attempts });
        if (attempt === attempts || stop) throw error;
        if (!error.rateLimited) await wait(500 * 2 ** (attempt - 1));
      }
    }
  }

  async function worker() {
    while (!stop && cursor < repositories.length) {
      const repository = repositories[cursor++];
      try {
        const result = await checkWithRetry(repository);
        checked += 1;
        if (result.exists) valid += 1;
        else {
          const failure = { repository, status: result.status, phase: result.phase };
          missing.push(failure);
          log({ event: "inaccessible", ...failure });
        }
        if (checked % 200 === 0 || now() - lastProgressAt >= 60000) {
          lastProgressAt = now();
          log({ event: "progress", checked, total: repositories.length, valid, inaccessible: missing.length });
        }
      } catch (error) {
        stop = true;
        unresolved.push({ repository, status: error.status ?? null, phase: error.phase ?? null, message: error.message, networkCode: error.cause?.code ?? null });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, repositories.length) }, worker));
  const summary = {
    event: "summary", total: repositories.length, checked, valid, missing, unresolved,
    notChecked: repositories.length - checked - unresolved.length,
    retryAt: gate.pausedUntil > now() ? new Date(gate.pausedUntil).toISOString() : null,
    result: unresolved.length || checked !== repositories.length ? "blocked" : missing.length ? "inaccessible" : "passed",
  };
  log(summary);
  return summary;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const options = checkerOptions();
  const [packageSource, awesomeText, topicText] = await Promise.all([
    readFile(path.join(root, "src/data/packages.js"), "utf8"),
    readFile(path.join(root, "src/data/awesome-catalog.generated.json"), "utf8"),
    readFile(path.join(root, "public/catalog/github-topic.generated.json"), "utf8"),
  ]);
  const awesomeCatalog = JSON.parse(awesomeText);
  const githubTopicCatalog = JSON.parse(topicText);
  const curatedBlock = packageSource.split("const catalogStyle =")[0];
  const curatedRepositories = [...curatedBlock.matchAll(/^\s+repo:\s*"([^"]+)",$/gm)].map((match) => match[1]);
  const repositories = [...new Set([
    ...curatedRepositories,
    ...awesomeCatalog.plugins.map((plugin) => plugin.repo),
    ...githubTopicCatalog.plugins.map((plugin) => plugin.repo),
  ])];
  defaultLog({ event: "snapshot", commit: process.env.GITHUB_SHA ?? null, sourceUpdatedAt: githubTopicCatalog.meta.sourceUpdatedAt });
  const summary = await validateRepositories(repositories, options);
  process.exitCode = summary.result === "passed" ? 0 : summary.result === "inaccessible" ? 1 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    defaultLog({ event: "fatal", message: error.message });
    process.exitCode = 2;
  });
}
