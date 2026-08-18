import assert from "node:assert/strict";
import test from "node:test";
import { createSearchHref, isSearchPath, normalizeSearchQuery, readSearchQuery } from "../src/search-route.js";

test("recognizes only the public search route", () => {
  assert.equal(isSearchPath("/search"), true);
  assert.equal(isSearchPath("/search/"), true);
  assert.equal(isSearchPath("/"), false);
  assert.equal(isSearchPath("/search/plugins"), false);
});

test("normalizes and encodes submitted search terms", () => {
  assert.equal(normalizeSearchQuery("  terminal   tools  "), "terminal tools");
  assert.equal(createSearchHref("终端 插件"), "/search?q=%E7%BB%88%E7%AB%AF%20%E6%8F%92%E4%BB%B6");
  assert.equal(createSearchHref("   "), "/search");
});

test("reads a normalized query from the URL", () => {
  assert.equal(readSearchQuery("?q=terminal%20%20tools&page=2"), "terminal tools");
  assert.equal(readSearchQuery("?page=2"), "");
});
