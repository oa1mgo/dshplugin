#!/usr/bin/env python3

import argparse
import gzip
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

CATALOG_URL = "https://dshplugin.org/api/github-catalog"
CACHE_TTL_SECONDS = 6 * 60 * 60
MAX_TRANSFER_BYTES = 12 * 1024 * 1024
MAX_CATALOG_BYTES = 32 * 1024 * 1024
TOKEN_PATTERN = re.compile(r"[\w.+#-]+", re.UNICODE)
CACHE_ROOT = Path(os.environ.get("DSHPLUGIN_CACHE_DIR") or (Path(tempfile.gettempdir()) / "dshplugin-agent-cache"))
CACHE_FILE = CACHE_ROOT / "github-catalog.json"
METADATA_FILE = CACHE_ROOT / "github-catalog.meta.json"


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def write_json(path, value):
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def validate_catalog(catalog):
    if not isinstance(catalog, dict) or not isinstance(catalog.get("plugins"), list):
        raise RuntimeError("DSHPlugin returned an invalid catalog payload")
    return catalog


def fetch_catalog():
    cached = read_json(CACHE_FILE)
    metadata = read_json(METADATA_FILE) or {}
    fetched_at = float(metadata.get("fetchedAt") or 0)
    if cached is not None and time.time() - fetched_at < CACHE_TTL_SECONDS:
        return validate_catalog(cached)

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "User-Agent": "dshplugin-agent-skill/1.0",
    }
    if cached is not None and metadata.get("etag"):
        headers["If-None-Match"] = metadata["etag"]
    if cached is not None and metadata.get("lastModified"):
        headers["If-Modified-Since"] = metadata["lastModified"]

    try:
        with urlopen(Request(CATALOG_URL, headers=headers), timeout=30) as response:
            payload = response.read(MAX_TRANSFER_BYTES + 1)
            if len(payload) > MAX_TRANSFER_BYTES:
                raise RuntimeError("DSHPlugin catalog transfer exceeded the safety limit")
            if response.headers.get("Content-Encoding", "").lower() == "gzip":
                payload = gzip.decompress(payload)
            if len(payload) > MAX_CATALOG_BYTES:
                raise RuntimeError("DSHPlugin catalog exceeded the safety limit")
            catalog = validate_catalog(json.loads(payload.decode("utf-8")))
            write_json(CACHE_FILE, catalog)
            write_json(METADATA_FILE, {
                "etag": response.headers.get("ETag", ""),
                "lastModified": response.headers.get("Last-Modified", ""),
                "fetchedAt": time.time(),
            })
            return catalog
    except HTTPError as error:
        if error.code == 304 and cached is not None:
            metadata["fetchedAt"] = time.time()
            write_json(METADATA_FILE, metadata)
            return validate_catalog(cached)
        if cached is not None:
            print(f"Warning: using cached DSHPlugin catalog after HTTP {error.code}", file=sys.stderr)
            return validate_catalog(cached)
        raise RuntimeError(f"DSHPlugin catalog request failed with HTTP {error.code}") from error
    except (OSError, ValueError, json.JSONDecodeError) as error:
        if cached is not None:
            print("Warning: using cached DSHPlugin catalog after a refresh error", file=sys.stderr)
            return validate_catalog(cached)
        raise RuntimeError("DSHPlugin catalog is unavailable") from error


def tokens(value):
    return set(TOKEN_PATTERN.findall(str(value).casefold()))


def searchable(plugin):
    return {
        "name": str(plugin.get("name") or "").casefold(),
        "repo": str(plugin.get("repo") or "").casefold(),
        "description": str(plugin.get("description") or "").casefold(),
        "topics": " ".join(plugin.get("topics") or []).casefold(),
        "language": str(plugin.get("language") or "").casefold(),
    }


def score_plugin(plugin, query):
    fields = searchable(plugin)
    normalized_query = query.casefold().strip()
    query_tokens = tokens(normalized_query)
    score = 0
    matched = 0
    if normalized_query and normalized_query == fields["name"]:
        score += 120
    if normalized_query and normalized_query == fields["repo"]:
        score += 140
    if normalized_query and normalized_query in fields["name"]:
        score += 45
    for term in query_tokens:
        term_score = 0
        if term in fields["name"]:
            term_score += 18
        if term in fields["topics"]:
            term_score += 14
        if term in fields["repo"]:
            term_score += 9
        if term in fields["description"]:
            term_score += 6
        if term in fields["language"]:
            term_score += 4
        if term_score:
            matched += 1
            score += term_score
    if query_tokens:
        score += round(12 * matched / len(query_tokens), 3)
    return score


def public_result(plugin, score=None):
    result = {
        key: plugin.get(key)
        for key in ("name", "repo", "description", "topics", "language", "stars", "pushedAt", "headSha", "bundlePatch", "lifecycleScripts")
        if plugin.get(key) not in (None, "", [])
    }
    if score is not None:
        result["lexicalScore"] = score
    return result


def main():
    parser = argparse.ArgumentParser(description="Query the cached DSHPlugin catalog without using outside discovery sources.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--query", help="Capability terms and synonyms prepared by the agent")
    mode.add_argument("--repo", help="Exact owner/repository from the user's request")
    parser.add_argument("--limit", type=int, default=20, help="Maximum candidates to return (1-50)")
    args = parser.parse_args()
    if not 1 <= args.limit <= 50:
        parser.error("--limit must be between 1 and 50")

    catalog = fetch_catalog()
    if args.repo:
        repository = args.repo.casefold().removeprefix("https://github.com/").strip("/")
        matches = [plugin for plugin in catalog["plugins"] if str(plugin.get("repo") or "").casefold() == repository]
        results = [public_result(plugin) for plugin in matches[:1]]
    else:
        ranked = [
            (score_plugin(plugin, args.query), plugin)
            for plugin in catalog["plugins"]
        ]
        ranked = [(score, plugin) for score, plugin in ranked if score > 0]
        ranked.sort(key=lambda item: (item[0], int(item[1].get("stars") or 0)), reverse=True)
        results = [public_result(plugin, score) for score, plugin in ranked[:args.limit]]

    print(json.dumps({
        "catalog": CATALOG_URL,
        "sourceUpdatedAt": catalog.get("meta", {}).get("sourceUpdatedAt"),
        "matches": results,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
