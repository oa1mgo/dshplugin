import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGE_CODES, resolveSupportedLanguage, translate } from "./i18n-core.js";
import { isSearchPath, readSearchQuery } from "./search-route.js";

const I18nContext = createContext(null);
const supportedChoices = new Set(["system", ...SUPPORTED_LANGUAGE_CODES]);

function detectSystemLanguage() {
  return resolveSupportedLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

function readLanguageChoice() {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return supportedChoices.has(stored) ? stored : "system";
}

export function I18nProvider({ children }) {
  const [languageChoice, setLanguageChoice] = useState(readLanguageChoice);
  const [systemLanguage, setSystemLanguage] = useState(detectSystemLanguage);
  const locale = languageChoice === "system" ? systemLanguage : languageChoice;

  useEffect(() => {
    const update = () => setSystemLanguage(detectSystemLanguage());
    window.addEventListener("languagechange", update);
    return () => window.removeEventListener("languagechange", update);
  }, []);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languageChoice);
    document.documentElement.lang = locale;
    const isAdmin = window.location.pathname.startsWith("/admin");
    const isSearch = isSearchPath(window.location.pathname);
    const searchQuery = isSearch ? readSearchQuery(window.location.search) : "";
    document.title = isAdmin
      ? "DSHPlugin — 管理后台"
      : isSearch
        ? translate(locale, "search.metaTitle", { query: searchQuery || translate(locale, "search.allTitle") })
        : translate(locale, "meta.title");
    document.querySelector('meta[name="description"]')?.setAttribute(
      "content",
      isAdmin ? "DSHPlugin 插件提交与举报管理后台。" : translate(locale, "meta.description"),
    );
  }, [languageChoice, locale]);

  const value = useMemo(() => ({
    languageChoice,
    locale,
    setLanguageChoice,
    t: (key, variables) => translate(locale, key, variables),
  }), [languageChoice, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
