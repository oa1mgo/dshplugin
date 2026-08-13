import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const [request, expectedAssetCalls] of [
    [new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }), 0],
    [new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }), 1],
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, expectedAssetCalls);
  }
});

function createDatabaseMock() {
  const inserts = [];
  return {
    inserts,
    prepare(sql) {
      return {
        bind(...values) {
          return { run: async () => { inserts.push({ sql, values }); return { meta: { changes: 1 } }; } };
        },
      };
    },
  };
}

test("persists a valid plugin submission through the API", async () => {
  const DB = createDatabaseMock();
  const response = await worker.fetch(new Request("https://example.test/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ source: "github:owner/plugin#abc123", email: "maintainer@example.com" }),
  }), { DB });

  assert.equal(response.status, 201);
  assert.equal(DB.inserts.length, 1);
  assert.equal(DB.inserts[0].values[1], "github:owner/plugin#abc123");
});

test("requires a reason and useful details for reports", async () => {
  const DB = createDatabaseMock();
  const response = await worker.fetch(new Request("https://example.test/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ pluginSlug: "demo", pluginName: "Demo", repo: "owner/demo", reason: "other", details: "short" }),
  }), { DB });

  assert.equal(response.status, 400);
  assert.equal(DB.inserts.length, 0);
});

test("serves catalog review overrides to the public registry", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/catalog-reviews"), {
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM catalog_reviews/);
        return { all: async () => ({ results: [{ plugin_slug: "dsh-cc-tui", status: "verified", note: null }] }) };
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reviews: [{ plugin_slug: "dsh-cc-tui", status: "verified", note: null }] });
});

test("rejects admin API requests without a Cloudflare Access assertion", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/admin/records"), {
    DB: { batch: async () => { throw new Error("database should not be queried"); } },
    ADMIN_EMAIL: "admin@example.com",
    CF_ACCESS_AUD: "test-audience",
    CF_ACCESS_ISSUER: "https://example.cloudflareaccess.com",
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("accepts only the configured email in a valid Cloudflare Access JWT", async () => {
  const issuer = "https://example.cloudflareaccess.com";
  const audience = "test-audience";
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...await exportJWK(publicKey), alg: "RS256", kid: "access-test-key", use: "sig" };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), `${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [jwk] });
  };

  const createToken = (email) => new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const DB = {
    batch: async () => [
      { results: [{ id: "submission-1", status: "pending" }] },
      { results: [{ id: "report-1", status: "pending" }] },
      { results: [{ plugin_slug: "dsh-cc-tui", status: "verified" }] },
    ],
    prepare: (sql) => ({
      bind: (...values) => ({
        run: async () => ({ meta: { changes: 1 } }),
        first: async () => ({
          plugin_slug: values[0],
          status: "review",
          note: null,
          updated_by: "admin@example.com",
          created_at: "2026-08-14 00:00:00",
          updated_at: "2026-08-14 00:00:00",
        }),
      }),
      sql,
    }),
  };
  const env = { DB, ADMIN_EMAIL: "admin@example.com", CF_ACCESS_AUD: audience, CF_ACCESS_ISSUER: issuer };

  try {
    const denied = await worker.fetch(new Request("https://example.test/api/admin/records", {
      headers: { "Cf-Access-Jwt-Assertion": await createToken("someone@example.com") },
    }), env);
    assert.equal(denied.status, 401);

    const allowed = await worker.fetch(new Request("https://example.test/api/admin/records", {
      headers: { "Cf-Access-Jwt-Assertion": await createToken("admin@example.com") },
    }), env);
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), {
      submissions: [{ id: "submission-1", status: "pending" }],
      reports: [{ id: "report-1", status: "pending" }],
      catalogReviews: [{ plugin_slug: "dsh-cc-tui", status: "verified" }],
      viewer: { email: "admin@example.com" },
    });

    const catalogUpdate = await worker.fetch(new Request("https://example.test/api/admin/catalog/dsh-cc-tui", {
      method: "PATCH",
      headers: {
        "Cf-Access-Jwt-Assertion": await createToken("admin@example.com"),
        "Content-Type": "application/json",
        Origin: "https://example.test",
      },
      body: JSON.stringify({ status: "review" }),
    }), env);
    assert.equal(catalogUpdate.status, 200);
    assert.deepEqual((await catalogUpdate.json()).review, {
      plugin_slug: "dsh-cc-tui",
      status: "review",
      note: null,
      updated_by: "admin@example.com",
      created_at: "2026-08-14 00:00:00",
      updated_at: "2026-08-14 00:00:00",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
