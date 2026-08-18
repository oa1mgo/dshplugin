const MAX_SEARCH_QUERY_LENGTH = 200;

export function isSearchPath(pathname) {
  return /^\/search\/?$/.test(String(pathname || ""));
}

export function normalizeSearchQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_SEARCH_QUERY_LENGTH);
}

export function readSearchQuery(search) {
  return normalizeSearchQuery(new URLSearchParams(search).get("q"));
}

export function createSearchHref(query) {
  const normalized = normalizeSearchQuery(query);
  return normalized ? `/search?q=${encodeURIComponent(normalized)}` : "/search";
}
