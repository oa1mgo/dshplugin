const githubRepositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export async function fetchGitAdvertisement(repository, { timeoutMs = 15000 } = {}) {
  if (!githubRepositoryPattern.test(repository)) {
    throw new Error(`Invalid GitHub repository identifier: ${repository}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const pageResponse = await fetch(`https://github.com/${repository}`, {
      headers: {
        accept: "text/html",
        "user-agent": "dshplugin-catalog-validator",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (pageResponse.status === 404 || pageResponse.status === 410) {
      await pageResponse.body?.cancel();
      return { exists: false, repository, status: pageResponse.status, text: "" };
    }
    if (!pageResponse.ok) {
      await pageResponse.body?.cancel();
      throw new Error(`GitHub repository page check failed: ${pageResponse.status} ${repository}`);
    }

    const canonicalUrl = new URL(pageResponse.url);
    await pageResponse.body?.cancel();
    const [, canonicalOwner, canonicalName] = canonicalUrl.pathname.split("/");
    const canonicalRepository = `${canonicalOwner}/${canonicalName}`;
    if (canonicalUrl.hostname !== "github.com" || !githubRepositoryPattern.test(canonicalRepository)) {
      throw new Error(`Unexpected GitHub repository redirect for ${repository}: ${pageResponse.url}`);
    }

    const response = await fetch(
      `https://github.com/${canonicalRepository}.git/info/refs?service=git-upload-pack`,
      {
      headers: {
        accept: "application/x-git-upload-pack-advertisement",
        "user-agent": "dshplugin-catalog-validator",
      },
      redirect: "follow",
      signal: controller.signal,
      },
    );

    if (response.status === 401 || response.status === 404 || response.status === 410) {
      return { exists: false, repository, status: response.status, text: "" };
    }
    if (!response.ok) {
      throw new Error(`GitHub repository check failed: ${response.status} ${repository}`);
    }

    const text = await response.text();
    if (!text.includes("git-upload-pack") || !/[0-9a-f]{40}\s+HEAD\0/.test(text)) {
      throw new Error(`Unexpected GitHub Git response for ${repository}`);
    }

    return {
      canonicalRepository,
      canonicalUrl: `https://github.com/${canonicalRepository}`,
      exists: true,
      repository,
      status: response.status,
      text,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`GitHub repository check timed out: ${repository}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function readHeadRevision(advertisement) {
  return advertisement.match(/([0-9a-f]{40})\s+HEAD\0/)?.[1] ?? null;
}
