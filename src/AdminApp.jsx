import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { Cube } from "@phosphor-icons/react/Cube";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { SealCheck } from "@phosphor-icons/react/SealCheck";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { packages, packagesWithGithubTopic } from "./data/packages.js";

const statuses = ["pending", "reviewing", "resolved", "rejected"];
const catalogStatuses = ["unverified", "review", "verified"];
const catalogStatusLabels = { unverified: "未认证", review: "审核中", verified: "已认证" };
const CATALOG_PAGE_SIZE = 30;

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${value}Z`)) : "—";
}

export function AdminApp() {
  const [records, setRecords] = useState({ submissions: [], reports: [], catalogReviews: [], viewer: null });
  const [section, setSection] = useState("catalog");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [savingSlug, setSavingSlug] = useState("");
  const [indexedPackages, setIndexedPackages] = useState(packages);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/records", { headers: { Accept: "application/json" } });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error([401, 403].includes(response.status) ? "Cloudflare Access 会话无效，请重新打开后台" : "读取后台数据失败");
      }
      const payload = await response.json();
      setRecords({ ...payload, catalogReviews: Array.isArray(payload.catalogReviews) ? payload.catalogReviews : [] });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCatalog() {
      for (const source of ["/api/github-catalog", "/catalog/github-topic.generated.json"]) {
        try {
          const response = await fetch(source, { headers: { Accept: "application/json" }, signal: controller.signal });
          if (!response.ok) continue;
          const payload = await response.json();
          if (Array.isArray(payload.plugins)) return payload;
        } catch (requestError) {
          if (requestError.name === "AbortError") throw requestError;
        }
      }
      throw new Error("github_catalog_unavailable");
    }
    loadCatalog()
      .then((payload) => setIndexedPackages(packagesWithGithubTopic(payload)))
      .catch((requestError) => { if (requestError.name !== "AbortError") setIndexedPackages(packages); });
    return () => controller.abort();
  }, []);

  const counts = useMemo(() => ({
    submissions: records.submissions.filter((item) => item.status === "pending").length,
    reports: records.reports.filter((item) => item.status === "pending").length,
  }), [records]);
  const catalogItems = useMemo(() => {
    const reviewBySlug = new Map(records.catalogReviews.map((review) => [review.plugin_slug, review]));
    const query = catalogQuery.trim().toLowerCase();
    return indexedPackages
      .map((item) => ({ ...item, catalogReview: reviewBySlug.get(item.slug) || null }))
      .filter((item) => !query || item.searchText.includes(query));
  }, [catalogQuery, indexedPackages, records.catalogReviews]);
  const catalogPageCount = Math.max(1, Math.ceil(catalogItems.length / CATALOG_PAGE_SIZE));
  const currentCatalogPage = Math.min(catalogPage, catalogPageCount);
  const visibleCatalogItems = catalogItems.slice((currentCatalogPage - 1) * CATALOG_PAGE_SIZE, currentCatalogPage * CATALOG_PAGE_SIZE);

  async function updateStatus(kind, id, status) {
    setError("");
    const response = await fetch(`/api/admin/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setError("更新状态失败，请重试");
      return;
    }
    setRecords((current) => ({
      ...current,
      [kind]: current[kind].map((item) => item.id === id ? { ...item, status } : item),
    }));
  }

  async function updateCatalogStatus(item, status) {
    setSavingSlug(item.slug);
    setError("");
    try {
      const response = await fetch(`/api/admin/catalog/${encodeURIComponent(item.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: item.catalogReview?.note || "" }),
      });
      if (!response.ok) throw new Error("更新插件审核状态失败，请重试");
      const payload = await response.json();
      setRecords((current) => ({
        ...current,
        catalogReviews: [
          payload.review,
          ...current.catalogReviews.filter((review) => review.plugin_slug !== item.slug),
        ],
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingSlug("");
    }
  }

  const items = section === "catalog" ? visibleCatalogItems : records[section];
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="brand" href="/"><Cube size={28} weight="duotone" /><strong>DSHPlugin</strong></a>
        <span>管理后台{records.viewer?.email ? ` · ${records.viewer.email}` : ""}</span>
        <div>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => loadRecords()}><ArrowClockwise size={16} /> 刷新</button>
          <a className="icon-button" href="/cdn-cgi/access/logout" aria-label="退出 Cloudflare Access" title="退出 Cloudflare Access"><SignOut size={20} /></a>
        </div>
      </header>
      <main className="admin-main">
        <div className="admin-title"><div><p className="section-kicker">Registry operations</p><h1>内容与审核</h1></div><span>{loading ? "正在同步…" : "审核结果实时同步到公开目录"}</span></div>
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={section === "catalog"} className={section === "catalog" ? "is-active" : ""} onClick={() => setSection("catalog")}>已上架插件 <span>{indexedPackages.length}</span></button>
          <button type="button" role="tab" aria-selected={section === "reports"} className={section === "reports" ? "is-active" : ""} onClick={() => setSection("reports")}>举报 <span>{counts.reports}</span></button>
          <button type="button" role="tab" aria-selected={section === "submissions"} className={section === "submissions" ? "is-active" : ""} onClick={() => setSection("submissions")}>插件提交 <span>{counts.submissions}</span></button>
        </div>
        {section === "catalog" ? (
          <label className="admin-search"><MagnifyingGlass size={18} /><input value={catalogQuery} onChange={(event) => { setCatalogQuery(event.target.value); setCatalogPage(1); }} placeholder="搜索插件、仓库或维护者" /></label>
        ) : null}
        <div className="admin-list">
          {items.length ? items.map((item) => (
            <article className={section === "catalog" ? "admin-record catalog-admin-record" : "admin-record"} key={section === "catalog" ? item.slug : item.id}>
              <div className="admin-record-main">
                <div className="admin-record-heading">
                  {section === "catalog" && (item.catalogReview?.status || item.status) === "verified" ? <SealCheck className="admin-verified-icon" size={17} weight="fill" /> : null}
                  <strong>{section === "catalog" ? item.name : section === "reports" ? item.plugin_name : item.source}</strong>
                  <span className={`moderation-status status-${section === "catalog" ? item.catalogReview?.status || item.status : item.status}`}>{section === "catalog" ? catalogStatusLabels[item.catalogReview?.status || item.status] : item.status}</span>
                </div>
                {section === "catalog" ? (
                  <><a href={`https://github.com/${item.repo}`} target="_blank" rel="noreferrer">github.com/{item.repo}</a><p>{item.type} · 默认状态：{catalogStatusLabels[item.status]}</p><small>{item.catalogReview ? `最近更新：${formatDate(item.catalogReview.updated_at)} · ${item.catalogReview.updated_by}` : "尚未在后台修改，使用目录默认状态"}</small></>
                ) : section === "reports" ? (
                  <><a href={`https://github.com/${item.repo}`} target="_blank" rel="noreferrer">github.com/{item.repo}</a><p><b>{item.reason}</b> · {item.details}</p><small>{item.reporter_email || "匿名举报"} · {formatDate(item.created_at)}</small></>
                ) : (
                  <><p>{item.email}</p><small>{formatDate(item.created_at)}</small></>
                )}
              </div>
              {section === "catalog" ? (
                <label>审核状态<select disabled={savingSlug === item.slug} value={item.catalogReview?.status || item.status} onChange={(event) => updateCatalogStatus(item, event.target.value)}>{catalogStatuses.map((status) => <option value={status} key={status}>{catalogStatusLabels[status]}</option>)}</select></label>
              ) : (
                <label>处理状态<select value={item.status} onChange={(event) => updateStatus(section, item.id, event.target.value)}>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
              )}
            </article>
          )) : <div className="admin-empty">这里还没有记录。</div>}
        </div>
        {section === "catalog" && catalogItems.length ? (
          <div className="admin-pagination"><span>共 {catalogItems.length} 个插件 · 第 {currentCatalogPage} / {catalogPageCount} 页</span><div><button className="secondary-button" type="button" disabled={currentCatalogPage === 1} onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}>上一页</button><button className="secondary-button" type="button" disabled={currentCatalogPage === catalogPageCount} onClick={() => setCatalogPage((page) => Math.min(catalogPageCount, page + 1))}>下一页</button></div></div>
        ) : null}
      </main>
    </div>
  );
}
