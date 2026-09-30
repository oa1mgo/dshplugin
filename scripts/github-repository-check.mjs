const githubRepositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

async function httpError(response, repository, phase) {
  const receivedAt = Date.now();
  const retryAfter = response.headers.get("retry-after");
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
  let rateLimited = response.status === 429
    || (response.status === 403 && (retryAfter !== null || rateLimitRemaining === "0"));
  if (response.status === 403) {
    const body = await response.text();
    rateLimited ||= /rate.?limit|abuse detection/i.test(body);
  } else {
    await response.body?.cancel();
  }
  return Object.assign(new Error(`GitHub repository ${phase} check failed: ${response.status} ${repository}`), {
    repository,
    phase,
    status: response.status,
    receivedAt,
    responseDate: response.headers.get("date"),
    retryAfter,
    rateLimitRemaining,
    rateLimitReset: response.headers.get("x-ratelimit-reset"),
    rateLimited,
  });
}

export async function fetchGitAdvertisement(repository, {
  timeoutMs = 15000,
  fetchImpl = fetch,
  beforeRequest = async () => {},
} = {}) {
  if (!githubRepositoryPattern.test(repository)) {
    throw new Error(`Invalid GitHub repository identifier: ${repository}`);
  }

  async function request(url, accept, inspect) {
    // Queueing and server-requested cooldowns must not consume the network timeout.
    await beforeRequest();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { accept, "user-agent": "dshplugin-catalog-validator" },
        redirect: "follow",
        signal: controller.signal,
      });
      return await inspect(response);
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`GitHub repository check timed out: ${repository}`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const page = await request(`https://github.com/${repository}`, "text/html", async (response) => {
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      return { exists: false, repository, phase: "page", status: response.status, text: "" };
    }
    if (!response.ok) throw await httpError(response, repository, "page");

    const canonicalUrl = new URL(response.url);
    await response.body?.cancel();
    const [, canonicalOwner, canonicalName] = canonicalUrl.pathname.split("/");
    const canonicalRepository = `${canonicalOwner}/${canonicalName}`;
    if (canonicalUrl.hostname !== "github.com" || !githubRepositoryPattern.test(canonicalRepository)) {
      throw new Error(`Unexpected GitHub repository redirect for ${repository}: ${response.url}`);
    }
    return { canonicalRepository, canonicalUrl: `https://github.com/${canonicalRepository}` };
  });
  if (page.exists === false) return page;

  return request(
    `https://github.com/${page.canonicalRepository}.git/info/refs?service=git-upload-pack`,
    "application/x-git-upload-pack-advertisement",
    async (response) => {
      if (response.status === 401 || response.status === 404 || response.status === 410) {
        await response.body?.cancel();
        return { exists: false, repository, phase: "git", status: response.status, text: "" };
      }
      if (!response.ok) throw await httpError(response, repository, "git");
      const text = await response.text();
      if (!text.includes("git-upload-pack") || !/[0-9a-f]{40}\s+HEAD\0/.test(text)) {
        throw new Error(`Unexpected GitHub Git response for ${repository}`);
      }
      return { ...page, exists: true, repository, status: response.status, text };
    },
  );
}

export function readHeadRevision(advertisement) {
  return advertisement.match(/([0-9a-f]{40})\s+HEAD\0/)?.[1] ?? null;
}
