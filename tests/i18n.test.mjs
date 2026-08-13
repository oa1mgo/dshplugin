import assert from "node:assert/strict";
import test from "node:test";
import { messages, resolveSupportedLanguage, SUPPORTED_LANGUAGE_CODES, translate } from "../src/i18n-core.js";

test("prefers the first supported system language", () => {
  assert.equal(resolveSupportedLanguage(["zh-CN", "en-US"]), "zh-CN");
  assert.equal(resolveSupportedLanguage(["ja-JP", "en-GB", "zh-CN"]), "ja");
  assert.equal(resolveSupportedLanguage(["zh-Hant-HK", "en-US"]), "zh-CN");
  assert.equal(resolveSupportedLanguage(["ko-KR"]), "ko");
  assert.equal(resolveSupportedLanguage(["es-MX"]), "es");
});

test("does not expose Traditional Chinese as a selectable locale", () => {
  assert.equal(SUPPORTED_LANGUAGE_CODES.includes("zh-TW"), false);
});

test("falls back to English for unsupported system languages", () => {
  assert.equal(resolveSupportedLanguage(["fr-FR", "de-DE"]), "en");
  assert.equal(resolveSupportedLanguage([]), "en");
});

test("formats translated variables", () => {
  assert.equal(translate("zh-CN", "registry.showingRange", { start: 25, end: 48, total: 266 }), "第 25–48 条，共 266 条");
  assert.equal(translate("en", "pagination.page", { current: 2, total: 12 }), "Page 2 of 12");
});

test("uses the official plugin architecture philosophy in the hero", () => {
  assert.equal(`${messages.en["hero.title.before"]} ${messages.en["hero.title.emphasis"]}`, "Everything is a plugin.");
  assert.equal(`${messages["zh-CN"]["hero.title.before"]}${messages["zh-CN"]["hero.title.emphasis"]}`, "一切皆是插件。");
});

test("all supported locales cover the complete interface dictionary", () => {
  const englishKeys = Object.keys(messages.en).toSorted();
  for (const locale of SUPPORTED_LANGUAGE_CODES) {
    assert.deepEqual(Object.keys(messages[locale]).toSorted(), englishKeys, locale);
  }
});
