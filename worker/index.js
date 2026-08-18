import { createRemoteJWKSet, jwtVerify } from "jose";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

const REPORT_REASONS = new Set(["security", "broken", "misleading", "harmful", "other"]);
const MODERATION_STATUSES = new Set(["pending", "reviewing", "resolved", "rejected"]);
const GITHUB_CATALOG_URL = "https://raw.githubusercontent.com/oa1mgo/dshplugin/main/public/catalog/github-topic.generated.json?source=dshplugin";
const CATALOG_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const CATALOG_EDGE_TTL_SECONDS = 3600;
const accessKeysets = new Map();

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return withSecurityHeaders(Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  }));
}

function text(value, status) {
  return withSecurityHeaders(new Response(value, { status }));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

function isValidSource(value) {
  return value.length <= 500 && (
    /^github:[\w.-]+\/[\w.-]+(?:#[\w./-]+)?$/i.test(value)
    || /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:[/?#].*)?$/i.test(value)
    || /^npm:[@\w./-]+$/i.test(value)
  );
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16_384) throw new Error("payload_too_large");
  return request.json();
}

async function requireAdmin(request, env) {
  const token = request.headers.get("cf-access-jwt-assertion");
  const issuer = String(env.CF_ACCESS_ISSUER || "").replace(/\/$/, "");
  const audience = String(env.CF_ACCESS_AUD || "");
  const allowedEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!token || !issuer || !audience || !allowedEmail) return null;

  try {
    const issuerUrl = new URL(issuer);
    if (issuerUrl.protocol !== "https:" || !issuerUrl.hostname.endsWith(".cloudflareaccess.com")) return null;
    if (!accessKeysets.has(issuer)) {
      accessKeysets.set(issuer, createRemoteJWKSet(new URL("/cdn-cgi/access/certs", `${issuer}/`)));
    }
    const { payload } = await jwtVerify(token, accessKeysets.get(issuer), {
      algorithms: ["RS256"],
      audience,
      issuer,
    });
    return typeof payload.email === "string" && payload.email.toLowerCase() === allowedEmail ? payload : null;
  } catch (error) {
    console.warn(JSON.stringify({ event: "access_denied", reason: error?.code || "invalid_token" }));
    return null;
  }
}

async function handleSubmission(request, env) {
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
  const body = await readJson(request);
  const source = String(body.source || "").trim();
  const email = String(body.email || "").trim();
  if (body.website) return json({ ok: true }, 202);
  if (!isValidSource(source) || !isValidEmail(email)) return json({ error: "invalid_submission" }, 400);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO submissions (id, source, email, status) VALUES (?1, ?2, ?3, 'pending')",
  ).bind(id, source, email).run();
  console.log(JSON.stringify({ event: "submission_created", id }));
  return json({ ok: true, id }, 201);
}

async function handleReport(request, env) {
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
  const body = await readJson(request);
  const pluginSlug = String(body.pluginSlug || "").trim().slice(0, 180);
  const pluginName = String(body.pluginName || "").trim().slice(0, 180);
  const repo = String(body.repo || "").trim().slice(0, 300);
  const reason = String(body.reason || "").trim();
  const details = String(body.details || "").trim();
  const email = String(body.email || "").trim();
  if (body.website) return json({ ok: true }, 202);
  if (!pluginSlug || !pluginName || !repo || !REPORT_REASONS.has(reason) || details.length < 10 || details.length > 2_000 || (email && !isValidEmail(email))) {
    return json({ error: "invalid_report" }, 400);
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO reports (id, plugin_slug, plugin_name, repo, reason, details, reporter_email, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')",
  ).bind(id, pluginSlug, pluginName, repo, reason, details, email || null).run();
  console.log(JSON.stringify({ event: "report_created", id, pluginSlug }));
  return json({ ok: true, id }, 201);
}

async function handleAdminList(request, env) {
  const viewer = await requireAdmin(request, env);
  if (!viewer) return json({ error: "unauthorized" }, 401);
  const [submissions, reports] = await env.DB.batch([
    env.DB.prepare("SELECT id, source, email, status, created_at, updated_at FROM submissions ORDER BY created_at DESC LIMIT 200"),
    env.DB.prepare("SELECT id, plugin_slug, plugin_name, repo, reason, details, reporter_email, status, created_at, updated_at FROM reports ORDER BY created_at DESC LIMIT 200"),
  ]);
  return json({ submissions: submissions.results, reports: reports.results, viewer: { email: viewer.email } });
}

function requestMatchesEtag(request, etag) {
  if (!etag) return false;
  return (request.headers.get("if-none-match") || "")
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value === etag);
}

async function handleGithubCatalog(request, env) {
  const fetcher = env.CATALOG_FETCH || fetch;
  const upstream = await fetcher(GITHUB_CATALOG_URL, {
    headers: { accept: "application/json", "user-agent": "dshplugin-catalog-proxy" },
    cf: { cacheEverything: true, cacheTtl: CATALOG_EDGE_TTL_SECONDS },
  });
  if (!upstream.ok) return json({ error: "catalog_unavailable" }, 502);
  const etag = upstream.headers.get("etag");
  const lastModified = upstream.headers.get("last-modified");
  const headers = new Headers({
    "Cache-Control": CATALOG_CACHE_CONTROL,
    "Content-Type": "application/json; charset=utf-8",
  });
  if (etag) headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);
  if (requestMatchesEtag(request, etag)) {
    await upstream.body?.cancel();
    return withSecurityHeaders(new Response(null, { status: 304, headers }));
  }
  return withSecurityHeaders(new Response(upstream.body, {
    headers,
  }));
}

async function handleAdminUpdate(request, env, kind, id) {
  const viewer = await requireAdmin(request, env);
  if (!viewer) return json({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return json({ error: "origin_not_allowed" }, 403);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["submissions", "reports"].includes(kind)) return json({ error: "not_found" }, 404);
  const body = await readJson(request);
  const status = String(body.status || "");
  if (!MODERATION_STATUSES.has(status)) return json({ error: "invalid_status" }, 400);
  const result = await env.DB.prepare(
    `UPDATE ${kind} SET status = ?1, updated_at = datetime('now') WHERE id = ?2`,
  ).bind(status, id).run();
  if (!result.meta.changes) return json({ error: "not_found" }, 404);
  console.log(JSON.stringify({ event: "moderation_updated", kind, id, status, actor: viewer.email }));
  return json({ ok: true });
}

async function handleApi(request, env, pathname) {
  const isKnownRoute = (request.method === "GET" && pathname === "/api/github-catalog")
    || (request.method === "POST" && ["/api/submissions", "/api/reports"].includes(pathname))
    || (request.method === "GET" && pathname === "/api/admin/records")
    || (request.method === "PATCH" && /^\/api\/admin\/(submissions|reports)\/([0-9a-f-]{36})$/i.test(pathname));
  if (!isKnownRoute) return json({ error: "not_found" }, 404);
  if (request.method === "GET" && pathname === "/api/github-catalog") {
    try {
      return await handleGithubCatalog(request, env);
    } catch (error) {
      console.error(JSON.stringify({ event: "catalog_proxy_error", message: error?.message || "unknown" }));
      return json({ error: "catalog_unavailable" }, 502);
    }
  }
  if (!env.DB) return json({ error: "database_unavailable" }, 503);
  try {
    if (request.method === "POST" && pathname === "/api/submissions") return await handleSubmission(request, env);
    if (request.method === "POST" && pathname === "/api/reports") return await handleReport(request, env);
    if (request.method === "GET" && pathname === "/api/admin/records") return await handleAdminList(request, env);
    const match = pathname.match(/^\/api\/admin\/(submissions|reports)\/([0-9a-f-]{36})$/i);
    if (request.method === "PATCH" && match) return await handleAdminUpdate(request, env, match[1], match[2]);
    return json({ error: "not_found" }, 404);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error?.message === "payload_too_large" ? 413 : 500;
    console.error(JSON.stringify({ event: "api_error", pathname, message: error?.message || "unknown" }));
    return json({ error: status === 500 ? "internal_error" : error.message }, status);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url.pathname);

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) return withSecurityHeaders(response);

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return withSecurityHeaders(await env.ASSETS.fetch(new Request(indexUrl, request)));
  },
};
