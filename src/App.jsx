import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { Bell } from "@phosphor-icons/react/Bell";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { Check } from "@phosphor-icons/react/Check";
import { Copy } from "@phosphor-icons/react/Copy";
import { Cube } from "@phosphor-icons/react/Cube";
import { Desktop } from "@phosphor-icons/react/Desktop";
import { Eye } from "@phosphor-icons/react/Eye";
import { Flask } from "@phosphor-icons/react/Flask";
import { GitFork } from "@phosphor-icons/react/GitFork";
import { GithubLogo } from "@phosphor-icons/react/GithubLogo";
import { Globe } from "@phosphor-icons/react/Globe";
import { ListMagnifyingGlass } from "@phosphor-icons/react/ListMagnifyingGlass";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Monitor } from "@phosphor-icons/react/Monitor";
import { Moon } from "@phosphor-icons/react/Moon";
import { Package } from "@phosphor-icons/react/Package";
import { Plugs } from "@phosphor-icons/react/Plugs";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Sidebar } from "@phosphor-icons/react/Sidebar";
import { Star } from "@phosphor-icons/react/Star";
import { Sun } from "@phosphor-icons/react/Sun";
import { TerminalWindow } from "@phosphor-icons/react/TerminalWindow";
import { Translate } from "@phosphor-icons/react/Translate";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { X } from "@phosphor-icons/react/X";
import { compareByStars, packages, packagesWithGithubTopic } from "./data/packages.js";
import { useI18n } from "./i18n.jsx";

const PAGE_SIZE = 24;
const otherTypes = new Set(["Infrastructure", "Community", "Research", "Other"]);
const categories = ["All", "Plugin", "Bundle", "Skill", "Interface", "Tool", "TUI", "Skin", "Channel", "Other"];
const themeOptions = [
  { id: "system", labelKey: "theme.system", Icon: Desktop },
  { id: "light", labelKey: "theme.light", Icon: Sun },
  { id: "dark", labelKey: "theme.dark", Icon: Moon },
];
const languageOptions = [
  { id: "en", labelKey: "language.english" },
  { id: "zh-CN", labelKey: "language.simplified" },
  { id: "ja", labelKey: "language.japanese" },
  { id: "ko", labelKey: "language.korean" },
  { id: "es", labelKey: "language.spanish" },
  { id: "system", labelKey: "language.system" },
];
const agentSkills = [
  {
    id: "finder",
    Icon: ListMagnifyingGlass,
    installUrl: "https://github.com/oa1mgo/dshplugin/tree/main/skills/find-dsh-plugins",
    sourceUrl: "https://github.com/oa1mgo/dshplugin/blob/main/skills/find-dsh-plugins/SKILL.md",
  },
  {
    id: "security",
    Icon: ShieldCheck,
    installUrl: "https://github.com/oa1mgo/dshplugin/tree/main/skills/audit-dsh-plugin-security",
    sourceUrl: "https://github.com/oa1mgo/dshplugin/blob/main/skills/audit-dsh-plugin-security/SKILL.md",
  },
];

const iconMap = {
  interface: Monitor,
  vision: Eye,
  workspace: Sidebar,
  terminal: TerminalWindow,
  skin: Package,
  skill: ListMagnifyingGlass,
  bundle: Cube,
  team: UsersThree,
  notify: Bell,
  plugin: Plugs,
  channel: Globe,
  infrastructure: Desktop,
  community: UsersThree,
  research: Flask,
};

function readStoredTheme() {
  const value = localStorage.getItem("dshpkg-theme");
  return themeOptions.some((option) => option.id === value) ? value : "system";
}

function categoryKey(type) {
  const normalized = type.toLowerCase();
  return ["infrastructure", "community", "research"].includes(normalized) ? "other" : normalized;
}

function localizeDescription(item, locale, t, long = false) {
  if (item.sourceKind === "github-topic") {
    if (long) return t("catalog.topicLongDescription");
    return item.description || t("catalog.descriptionFallback");
  }
  if (item.sourceKind === "awesome") {
    if (long) return t("catalog.longDescription");
    return item.description || t("catalog.descriptionFallback");
  }
  if (locale === "zh-CN") return (long ? item.longDescriptionZh : item.descriptionZh) || (long ? item.longDescription : item.description);
  return long ? item.longDescription : item.description;
}

function formatNumber(value, locale, compact = false) {
  return new Intl.NumberFormat(locale, compact ? { notation: "compact", maximumFractionDigits: 1 } : undefined)
    .format(Number(value) || 0);
}

function detectPlatform() {
  const value = navigator.userAgentData?.platform || navigator.platform || "Unknown";
  if (/win/i.test(value)) return "Windows";
  if (/mac/i.test(value)) return "macOS";
  if (/linux|android/i.test(value)) return "Linux";
  return value;
}

function ThemePicker({ theme, setTheme }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = themeOptions.find((option) => option.id === theme) ?? themeOptions[0];
  const CurrentIcon = current.Icon;

  return (
    <div className="theme-picker">
      <button
        className="icon-button theme-trigger"
        type="button"
        aria-label={t("theme.menu", { theme: t(current.labelKey) })}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon size={20} weight="regular" />
      </button>
      {open ? (
        <div className="theme-menu" role="menu">
          {themeOptions.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              className={theme === id ? "theme-option is-active" : "theme-option"}
              onClick={() => {
                setTheme(id);
                setOpen(false);
              }}
              role="menuitemradio"
              aria-checked={theme === id}
            >
              <Icon size={18} />
              <span>{t(labelKey)}</span>
              {theme === id ? <Check size={16} weight="bold" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LanguageFlag({ id }) {
  if (id === "system") return <Translate className="language-symbol" size={19} weight="duotone" />;
  return (
    <svg className="language-flag" viewBox="0 0 24 16" aria-hidden="true">
      {id === "en" ? <><rect width="24" height="16" fill="#183b73" /><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" /><path d="M0 0 24 16M24 0 0 16" stroke="#d62d3f" strokeWidth="1.8" /><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" /><path d="M12 0v16M0 8h24" stroke="#d62d3f" strokeWidth="2.7" /></> : null}
      {id === "zh-CN" ? <><rect width="24" height="16" fill="#de2910" /><path d="m5 2 .7 2.1H8l-1.8 1.3.7 2.1L5 6.2 3.1 7.5l.7-2.1L2 4.1h2.3Z" fill="#ffde00" /></> : null}
      {id === "ja" ? <><rect width="24" height="16" fill="#fff" /><circle cx="12" cy="8" r="4" fill="#bc002d" /></> : null}
      {id === "ko" ? <><rect width="24" height="16" fill="#fff" /><path d="M9.2 8a2.8 2.8 0 0 1 5.6 0c-1.4-1-2.8 1-4.2 0-.5-.35-1-.55-1.4 0Z" fill="#cd2e3a" /><path d="M14.8 8a2.8 2.8 0 0 1-5.6 0c1.4 1 2.8-1 4.2 0 .5.35 1 .55 1.4 0Z" fill="#0047a0" /><path d="m4 3 3 2m-2.5-3 3 2m12.5 9-3-2m2.5 3-3-2M20 3l-3 2m2.5-3-3 2M4 13l3-2m-2.5 3 3-2" stroke="#111" strokeWidth=".75" /></> : null}
      {id === "es" ? <><rect width="24" height="16" fill="#aa151b" /><rect y="4" width="24" height="8" fill="#f1bf00" /><circle cx="7" cy="8" r="1.25" fill="#aa151b" /></> : null}
    </svg>
  );
}

function LanguagePicker() {
  const { languageChoice, setLanguageChoice, t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = languageOptions.find((option) => option.id === languageChoice) ?? languageOptions[0];

  return (
    <div className="theme-picker language-picker">
      <button
        className="icon-button"
        type="button"
        aria-label={t("language.menu", { language: t(current.labelKey) })}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LanguageFlag id={current.id} />
      </button>
      {open ? (
        <div className="theme-menu language-menu" role="menu">
          {languageOptions.map(({ id, labelKey }) => (
            <button
              key={id}
              type="button"
              className={languageChoice === id ? "theme-option language-option is-active" : "theme-option language-option"}
              onClick={() => {
                setLanguageChoice(id);
                setOpen(false);
              }}
              role="menuitemradio"
              aria-checked={languageChoice === id}
            >
              <span className="language-code"><LanguageFlag id={id} /></span>
              <span>{t(labelKey)}</span>
              {languageChoice === id ? <Check size={16} weight="bold" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function writeClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through for browsers that expose the API but deny clipboard access.
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

function CopyButton({ text, compact = false, label, copiedLabel }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!await writeClipboard(text)) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className={compact ? "copy-button is-compact" : "copy-button"} type="button" onClick={copy}>
      {copied ? <Check size={17} weight="bold" /> : <Copy size={17} />}
      {copied ? (copiedLabel || t("actions.copied")) : (label || t("actions.copy"))}
    </button>
  );
}

function AgentSkillsSection() {
  const { t } = useI18n();

  return (
    <section className="agent-skills-section" id="agent-skills">
      <div className="agent-skills-intro">
        <span className="section-kicker">{t("agentSkills.kicker")}</span>
        <h2>{t("agentSkills.title")}</h2>
        <p>{t("agentSkills.description")}</p>
      </div>
      <div className="agent-skills-grid">
        {agentSkills.map(({ id, Icon, installUrl, sourceUrl }) => (
          <article className="agent-skill-card" key={id}>
            <div className="agent-skill-heading">
              <span className="agent-skill-icon"><Icon size={24} weight="duotone" /></span>
              <div><small>Agent Skill</small><h3>{t(`agentSkills.${id}.title`)}</h3></div>
            </div>
            <p>{t(`agentSkills.${id}.description`)}</p>
            <span className="agent-skill-scope"><Check size={15} weight="bold" /> {t("agentSkills.scope")}</span>
            <a className="agent-skill-url" href={installUrl} target="_blank" rel="noreferrer">
              <span>{t("agentSkills.installLink")}</span>
              <code>{installUrl}</code>
            </a>
            <div className="agent-skill-actions">
              <CopyButton
                text={t(`agentSkills.${id}.prompt`, { url: installUrl })}
                label={t("agentSkills.copyPrompt")}
                copiedLabel={t("agentSkills.promptCopied")}
              />
              <a className="secondary-button" href={sourceUrl} target="_blank" rel="noreferrer">
                <GithubLogo size={18} weight="fill" /> {t("agentSkills.source")}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PackageIcon({ kind, color }) {
  const Icon = iconMap[kind] ?? Cube;
  return (
    <span className="package-icon" style={{ "--icon-color": color }}>
      <Icon size={23} weight="duotone" />
    </span>
  );
}

function PackageRow({ item, selected, onSelect, detectedPlatform }) {
  const { locale, t } = useI18n();
  const description = localizeDescription(item, locale, t);
  const exactStars = formatNumber(item.stars, locale);

  return (
    <article className={selected ? "package-row is-selected" : "package-row"}>
      <button className="row-main" type="button" onClick={() => onSelect(selected ? null : item.slug)}>
        <span className="package-cell">
          <PackageIcon kind={item.icon} color={item.color} />
          <span className="package-copy">
            <span className="package-title"><strong>{item.name}</strong></span>
            <span>{description}</span>
          </span>
        </span>
        <span className="source-cell">
          <span><GithubLogo size={15} weight="fill" /> {item.owner}</span>
          <small>github.com/{item.repo}</small>
        </span>
        <span className="type-cell"><span className={`type-tag type-${categoryKey(item.type)}`}>{t(`category.${categoryKey(item.type)}`)}</span></span>
        <span className="stars-cell" title={`${t("table.stars")}: ${exactStars}`}><Star size={17} weight="fill" /><strong>{formatNumber(item.stars, locale, true)}</strong></span>
      </button>
      {selected ? item.installable !== false ? (
        <div className="install-row">
          <code><span>$</span> {item.command}</code>
          <span className="platform-badge" title={t("platform.detected", { platform: detectedPlatform })}><Desktop size={15} /> {t("platform.cli")}</span>
          <CopyButton text={item.command} compact />
          <button className="details-link" type="button" onClick={() => onSelect(`${item.slug}:details`)}>
            {t("actions.details")} <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className="install-row discovery-row">
          <span className="discovery-only"><ShieldCheck size={16} /> {t("catalog.noInstall")}</span>
          <button className="details-link" type="button" onClick={() => onSelect(`${item.slug}:details`)}>
            {t("actions.details")} <ArrowRight size={15} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

function PackageDrawer({ item, onClose, detectedPlatform }) {
  const { locale, t } = useI18n();
  const [reportOpen, setReportOpen] = useState(false);
  if (!item) return null;
  const description = localizeDescription(item, locale, t, true);
  const lifecycleScripts = item.lifecycleScripts?.length
    ? item.lifecycleScripts.join(", ")
    : t("catalog.topicNoScripts");
  const sourceRevision = item.headSha?.slice(0, 7) || item.commit || t("drawer.unavailable");

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="package-drawer" role="dialog" aria-modal="true" aria-label={`${item.name} ${t("actions.details")}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <PackageIcon kind={item.icon} color={item.color} />
          <div><span className="drawer-kicker">{t("drawer.package", { type: t(`category.${categoryKey(item.type)}`) })}</span><h2>{item.name}</h2></div>
          <button className="icon-button" type="button" aria-label={t("drawer.close")} onClick={onClose}><X size={20} /></button>
        </div>
        <p className="drawer-description">{description}</p>
        {item.installable !== false ? (
          <>
            <div className="platform-callout"><Desktop size={18} /><span><strong>{t("platform.cli")}</strong><small>{t("platform.detected", { platform: detectedPlatform })}</small></span></div>
            <div className="drawer-command"><code>{item.command}</code><CopyButton text={item.command} compact /></div>
          </>
        ) : <div className="platform-callout"><ShieldCheck size={18} /><span><strong>{t("catalog.noInstall")}</strong></span></div>}
        <div className="repository-card">
          <div className="repository-summary">
            <span><Star size={17} weight="fill" /> <strong>{formatNumber(item.stars, locale)}</strong> {t("drawer.stars")}</span>
            <span><GitFork size={17} /> <strong>{formatNumber(item.forks, locale)}</strong> {t("drawer.forks")}</span>
          </div>
          <dl>
            <div><dt>{t("drawer.repository")}</dt><dd>github.com/{item.repo}</dd></div>
            <div><dt>{t("drawer.source")}</dt><dd>{sourceRevision}</dd></div>
            {item.bundlePatch ? <div><dt>{t("drawer.bundle")}</dt><dd>{item.bundlePatch}</dd></div> : null}
            <div><dt>{t("drawer.lifecycle")}</dt><dd>{lifecycleScripts}</dd></div>
            <div><dt>{t("drawer.language")}</dt><dd>{item.language || t("drawer.unavailable")}</dd></div>
            <div><dt>{t("drawer.license")}</dt><dd>{item.license || t("drawer.unavailable")}</dd></div>
          </dl>
        </div>
        <div className="drawer-actions">
          <a className="primary-button" href={`https://github.com/${item.repo}`} target="_blank" rel="noreferrer">{t("actions.github")} <GithubLogo size={18} /></a>
        </div>
        <button className="report-link" type="button" onClick={() => setReportOpen(true)}>{t("actions.report")}</button>
      </aside>
      {reportOpen ? <ReportDialog item={item} onClose={() => setReportOpen(false)} /> : null}
    </div>
  );
}

function ReportDialog({ item, onClose }) {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submitReport(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginSlug: item.slug,
          pluginName: item.name,
          repo: item.repo,
          reason: form.get("reason"),
          details: form.get("details"),
          email: form.get("email"),
          website: form.get("website"),
        }),
      });
      if (!response.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError(t("report.error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="nested-dialog-backdrop" role="presentation" onMouseDown={(event) => { event.stopPropagation(); onClose(); }}>
      <section className="submit-dialog report-dialog" role="dialog" aria-modal="true" aria-label={t("report.title")} onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button dialog-close" type="button" aria-label={t("drawer.close")} onClick={onClose}><X size={20} /></button>
        {submitted ? (
          <div className="success-state compact-success"><span><Check size={26} weight="bold" /></span><h2>{t("report.success")}</h2><p>{t("report.successDescription")}</p><button className="primary-button" type="button" onClick={onClose}>{t("submit.back")}</button></div>
        ) : (
          <form onSubmit={submitReport}>
            <span className="dialog-kicker">{item.name}</span>
            <h2>{t("report.title")}</h2>
            <p>{t("report.description")}</p>
            <label>{t("report.reason")}<select name="reason" required defaultValue=""><option value="" disabled>{t("report.choose")}</option><option value="security">{t("report.security")}</option><option value="broken">{t("report.broken")}</option><option value="misleading">{t("report.misleading")}</option><option value="harmful">{t("report.harmful")}</option><option value="other">{t("report.other")}</option></select></label>
            <label>{t("report.details")}<textarea name="details" required minLength={10} maxLength={2000} rows={5} placeholder={t("report.detailsPlaceholder")} /></label>
            <label>{t("report.email")}<input name="email" type="email" placeholder="you@example.com" /></label>
            <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" />
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={sending}>{sending ? t("report.sending") : t("report.submit")}</button>
          </form>
        )}
      </section>
    </div>
  );
}

function SubmitDialog({ onClose }) {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submitPlugin(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: form.get("source"), email: form.get("email"), website: form.get("website") }),
      });
      if (!response.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError(t("submit.error"));
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="submit-dialog" role="dialog" aria-modal="true" aria-label={t("actions.submit")} onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button dialog-close" type="button" onClick={onClose}><X size={20} /></button>
        {submitted ? (
          <div className="success-state">
            <span><Check size={26} weight="bold" /></span>
            <h2>{t("submit.success")}</h2>
            <p>{t("submit.successDescription")}</p>
            <button className="primary-button" type="button" onClick={onClose}>{t("submit.back")}</button>
          </div>
        ) : (
          <form onSubmit={submitPlugin}>
            <span className="dialog-kicker">{t("submit.kicker")}</span>
            <h2>{t("submit.title")}</h2>
            <p>{t("submit.description")}</p>
            <label>{t("submit.source")}<input name="source" required placeholder="github:owner/repository#commit" /></label>
            <label>{t("submit.email")}<input name="email" required type="email" placeholder="you@example.com" /></label>
            <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" />
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={sending}>{sending ? t("submit.sending") : t("submit.queue")} <ArrowRight size={17} /></button>
          </form>
        )}
      </section>
    </div>
  );
}

export function App() {
  const { locale, t } = useI18n();
  const [theme, setTheme] = useState(readStoredTheme);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("stars");
  const [language, setLanguage] = useState("All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [indexedPackages, setIndexedPackages] = useState(packages);
  const searchRef = useRef(null);
  const tableRef = useRef(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const detectedPlatform = useMemo(detectPlatform, []);
  const effectiveTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const installableCount = useMemo(() => indexedPackages.filter((item) => item.installable !== false).length, [indexedPackages]);
  const totalStars = useMemo(() => indexedPackages.reduce((total, item) => total + (Number(item.stars) || 0), 0), [indexedPackages]);
  const languages = useMemo(() => [...new Set(indexedPackages.map((item) => item.language).filter(Boolean))]
    .toSorted((a, b) => a.localeCompare(b, locale)), [indexedPackages, locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.style.colorScheme = effectiveTheme;
    localStorage.setItem("dshpkg-theme", theme);
  }, [effectiveTheme, theme]);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = (event) => setSystemDark(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCatalog() {
      for (const source of ["/api/github-catalog", "/catalog/github-topic.generated.json"]) {
        try {
          const response = await fetch(source, { headers: { Accept: "application/json" }, signal: controller.signal });
          if (!response.ok) continue;
          const payload = await response.json();
          if (Array.isArray(payload.plugins)) return payload;
        } catch (error) {
          if (error.name === "AbortError") throw error;
        }
      }
      throw new Error("github_catalog_unavailable");
    }
    loadCatalog()
      .then((payload) => setIndexedPackages(packagesWithGithubTopic(payload)))
      .catch((error) => { if (error.name !== "AbortError") setIndexedPackages(packages); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSubmitOpen(false);
        if (typeof selected === "string" && selected.endsWith(":details")) setSelected(selected.split(":")[0]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  const filteredPackages = useMemo(() => {
    const filtered = indexedPackages.filter((item) => {
      const categoryMatch = category === "All"
        || (category === "Other" ? otherTypes.has(item.type) : item.type === category);
      const languageMatch = language === "All" || item.language === language;
      return categoryMatch && languageMatch && (!deferredQuery || item.searchText.includes(deferredQuery));
    });
    return filtered.toSorted((a, b) => {
      if (sort === "stars") return compareByStars(a, b);
      if (sort === "name") return a.name.localeCompare(b.name, locale);
      return (Date.parse(b.pushedAt) || 0) - (Date.parse(a.pushedAt) || 0) || compareByStars(a, b);
    });
  }, [category, deferredQuery, indexedPackages, language, locale, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visiblePackages = filteredPackages.slice(pageStart, pageStart + PAGE_SIZE);
  const goToPage = (nextPage) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    setSelected(null);
    requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const drawerItem = typeof selected === "string" && selected.endsWith(":details")
    ? indexedPackages.find((item) => item.slug === selected.split(":")[0])
    : null;
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="DSHPlugin home"><Cube size={31} weight="duotone" /><strong>DSHPlugin</strong></a>
        <div className="header-actions">
          <button className="icon-button desktop-search" type="button" aria-label={t("search.placeholder")} onClick={() => searchRef.current?.focus()}><MagnifyingGlass size={21} /></button>
          <a className="icon-button" href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noreferrer" aria-label="DeepSeek Harness on GitHub"><GithubLogo size={23} weight="fill" /></a>
          <LanguagePicker />
          <ThemePicker theme={theme} setTheme={setTheme} />
          <button className="primary-button submit-button" type="button" onClick={() => setSubmitOpen(true)}>{t("actions.submit")}</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">{t("hero.eyebrow")}</span>
            <h1>{t("hero.title.before")}<br /><em>{t("hero.title.emphasis")}</em></h1>
            <p>{t("hero.description")}</p>
          </div>
          <div className="hero-search">
            <label className="search-box">
              <MagnifyingGlass size={21} />
              <input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("search.placeholder")} />
              <kbd>/</kbd>
            </label>
            <div className="quick-stats">
              <span><strong>{indexedPackages.length}</strong> {t("stats.discovered")}</span>
              <span><strong>{formatNumber(totalStars, locale, true)}</strong> {t("stats.stars")}</span>
              <span><strong>{installableCount}</strong> {t("stats.installable")}</span>
            </div>
          </div>
        </section>

        <AgentSkillsSection />

        <section className="registry-section" id="registry">
          <div className="section-heading">
            <div><span className="section-kicker">{t("registry.kicker")}</span><h2>{t("registry.title")}</h2></div>
            <div className="registry-controls">
              <label className="sort-control">{t("registry.language")} <select value={language} onChange={(event) => { setLanguage(event.target.value); setPage(1); }}><option value="All">{t("registry.allLanguages")}</option>{languages.map((item) => <option value={item} key={item}>{item}</option>)}</select><CaretDown size={15} /></label>
              <label className="sort-control">{t("registry.sort")} <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="recent">{t("registry.recent")}</option><option value="stars">{t("registry.stars")}</option><option value="name">{t("registry.name")}</option></select><CaretDown size={15} /></label>
            </div>
          </div>

          <div className="category-tabs" aria-label={t("registry.title")}>
            {categories.map((item) => <button key={item} className={category === item ? "is-active" : ""} type="button" onClick={() => { setCategory(item); setPage(1); }}>{t(`category.${item.toLowerCase()}`)}</button>)}
          </div>

          <div className="package-table" ref={tableRef}>
            <div className="table-header"><span>{t("table.plugin")}</span><span>{t("table.source")}</span><span>{t("table.type")}</span><span>{t("table.stars")}</span></div>
            <div className="package-list">
              {visiblePackages.length ? visiblePackages.map((item) => (
                <PackageRow key={item.slug} item={item} selected={selected === item.slug} onSelect={setSelected} detectedPlatform={detectedPlatform} />
              )) : (
                <div className="empty-state"><ListMagnifyingGlass size={32} /><strong>{t("empty.title")}</strong><span>{t("empty.description")}</span><button type="button" onClick={() => { setQuery(""); setCategory("All"); setLanguage("All"); setPage(1); }}>{t("empty.clear")}</button></div>
              )}
            </div>
          </div>
          {filteredPackages.length ? (
            <div className="registry-footer">
              <span>{t("registry.showingRange", { start: pageStart + 1, end: Math.min(pageStart + PAGE_SIZE, filteredPackages.length), total: filteredPackages.length })}</span>
              <nav className="pagination" aria-label={t("pagination.label")}>
                <button className="secondary-button" type="button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>{t("pagination.previous")}</button>
                <span>{t("pagination.page", { current: currentPage, total: totalPages })}</span>
                <button className="secondary-button" type="button" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>{t("pagination.next")}</button>
              </nav>
            </div>
          ) : null}
        </section>

        <section className="publisher-band">
          <div><span className="section-kicker">{t("publisher.kicker")}</span><h2>{t("publisher.title")}</h2><p>{t("publisher.description")}</p></div>
          <button className="inverse-button" type="button" onClick={() => setSubmitOpen(true)}>{t("publisher.action")} <ArrowRight size={17} /></button>
        </section>
      </main>

      <footer><a className="brand footer-brand" href="#top"><Cube size={23} weight="duotone" /><strong>DSHPlugin</strong></a><p>{t("footer.description")}</p><div><a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noreferrer">DSH</a><a href="#registry">{t("nav.browse")}</a></div></footer>

      <PackageDrawer item={drawerItem} onClose={() => setSelected(drawerItem?.slug ?? null)} detectedPlatform={detectedPlatform} />
      {submitOpen ? <SubmitDialog onClose={() => setSubmitOpen(false)} /> : null}
    </div>
  );
}
