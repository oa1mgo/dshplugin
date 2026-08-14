import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ArrowClockwise";
import { Cube } from "@phosphor-icons/react/Cube";
import { SignOut } from "@phosphor-icons/react/SignOut";

const statuses = ["pending", "reviewing", "resolved", "rejected"];

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${value}Z`)) : "—";
}

export function AdminApp() {
  const [records, setRecords] = useState({ submissions: [], reports: [], viewer: null });
  const [section, setSection] = useState("reports");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/records", { headers: { Accept: "application/json" } });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error([401, 403].includes(response.status) ? "Cloudflare Access 会话无效，请重新打开后台" : "读取后台数据失败");
      }
      const payload = await response.json();
      setRecords(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const counts = useMemo(() => ({
    submissions: records.submissions.filter((item) => item.status === "pending").length,
    reports: records.reports.filter((item) => item.status === "pending").length,
  }), [records]);
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

  const items = records[section];
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
        <div className="admin-title"><div><p className="section-kicker">Registry operations</p><h1>内容管理</h1></div><span>{loading ? "正在同步…" : "举报与插件提交实时同步"}</span></div>
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={section === "reports"} className={section === "reports" ? "is-active" : ""} onClick={() => setSection("reports")}>举报 <span>{counts.reports}</span></button>
          <button type="button" role="tab" aria-selected={section === "submissions"} className={section === "submissions" ? "is-active" : ""} onClick={() => setSection("submissions")}>插件提交 <span>{counts.submissions}</span></button>
        </div>
        <div className="admin-list">
          {items.length ? items.map((item) => (
            <article className="admin-record" key={item.id}>
              <div className="admin-record-main">
                <div className="admin-record-heading">
                  <strong>{section === "reports" ? item.plugin_name : item.source}</strong>
                  <span className={`moderation-status status-${item.status}`}>{item.status}</span>
                </div>
                {section === "reports" ? (
                  <><a href={`https://github.com/${item.repo}`} target="_blank" rel="noreferrer">github.com/{item.repo}</a><p><b>{item.reason}</b> · {item.details}</p><small>{item.reporter_email || "匿名举报"} · {formatDate(item.created_at)}</small></>
                ) : (
                  <><p>{item.email}</p><small>{formatDate(item.created_at)}</small></>
                )}
              </div>
              <label>处理状态<select value={item.status} onChange={(event) => updateStatus(section, item.id, event.target.value)}>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
            </article>
          )) : <div className="admin-empty">这里还没有记录。</div>}
        </div>
      </main>
    </div>
  );
}
