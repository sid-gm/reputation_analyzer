"use client";

import { useEffect, useState, useMemo } from "react";
import { cx, PlatformChip, Sparkline, EntityBadge, Field } from "@/components/primitives";

type Entity = {
  id: string;
  label: string;
  queryString: string;
  entityType: "keyword" | "executive" | "product";
  googleAlertsFeedUrl: string | null;
  createdAt: string;
};

const emptyForm = {
  label: "",
  queryString: "",
  entityType: "keyword" as Entity["entityType"],
  googleAlertsFeedUrl: "",
};

function pseudoSpark(seed: number, base: number): number[] {
  return Array.from({ length: 16 }, (_, i) =>
    Math.abs(Math.sin(i * 0.7 + seed) * base * 0.5 + base * 0.4)
  );
}

export default function TrackPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/entities").then((r) => r.json()).then(setEntities);

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: entities.length, keyword: 0, executive: 0, product: 0 };
    for (const e of entities) c[e.entityType]++;
    return c;
  }, [entities]);

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (type !== "all" && e.entityType !== type) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!e.label.toLowerCase().includes(q) && !e.queryString.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [entities, type, query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(emptyForm);
      setAdding(false);
      await load();
    } else {
      setError("Failed to save.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tracked entity?")) return;
    await fetch(`/api/entities/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 1 · Ingestion</div>
          <h1 className="page-title">Tracked entities</h1>
          <p className="page-desc">Keywords, products and executives the system monitors.</p>
        </div>
        <div className="topbar-actions">
          <label className="search">
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter entities…"
            />
          </label>
          <button className="btn btn-primary" onClick={() => setAdding(!adding)}>
            {adding ? "✕ Cancel" : "+ Add entity"}
          </button>
        </div>
      </header>

      <div className="page">
        <div className="track-summary">
          <div className="sumstat">
            <div className="sumstat-label">Tracked entities</div>
            <div className="sumstat-value">{counts.all}</div>
            <div className="sumstat-hint">{counts.keyword} keywords · {counts.product} products · {counts.executive} executives</div>
          </div>
          <div className="sumstat">
            <div className="sumstat-label">With Google Alerts</div>
            <div className="sumstat-value">{entities.filter((e) => e.googleAlertsFeedUrl).length}</div>
            <div className="sumstat-hint">RSS feed configured</div>
          </div>
          <div className="sumstat sumstat-accent">
            <div className="sumstat-label">Keywords</div>
            <div className="sumstat-value">{counts.keyword}</div>
            <div className="sumstat-hint">Brand + topic terms</div>
          </div>
          <div className="sumstat sumstat-accent">
            <div className="sumstat-label">People tracked</div>
            <div className="sumstat-value">{counts.executive}</div>
            <div className="sumstat-hint">Executives + influencers</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="filter-group">
            <span className="filter-label">Type</span>
            <div className="seg">
              {(["all", "keyword", "product", "executive"] as const).map((t) => (
                <button
                  key={t}
                  className={cx("seg-btn", type === t && "seg-btn-on")}
                  onClick={() => setType(t)}
                >
                  {t !== "all" && (
                    <span className={`ebadge-glyph eg-${t}`}>
                      {t === "executive" ? "◉" : t === "product" ? "◧" : "◇"}
                    </span>
                  )}
                  {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}{" "}
                  <span className="seg-count">{counts[t]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group filter-group-right">
            <button className="btn btn-primary" onClick={() => setAdding(!adding)}>
              {adding ? "✕ Cancel" : "+ Add entity"}
            </button>
          </div>
        </div>

        {adding && (
          <form className="addcard" onSubmit={handleSubmit}>
            <div className="addcard-head">
              <span className="kbd">New</span>
              <span>Add a tracked entity. The query runs against every active source on the next hourly poll.</span>
            </div>
            <div className="addcard-grid">
              <Field label="Label" hint="Display name used everywhere">
                <input
                  className="ipt"
                  placeholder="e.g. Sam Altman — CEO"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Type">
                <div className="seg">
                  {(["keyword", "product", "executive"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={cx("seg-btn", form.entityType === t && "seg-btn-on")}
                      onClick={() => setForm((f) => ({ ...f, entityType: t }))}
                    >
                      <span className={`ebadge-glyph eg-${t}`}>
                        {t === "executive" ? "◉" : t === "product" ? "◧" : "◇"}
                      </span>
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field
                label="Search query"
                hint='Boolean operators: "exact phrase" OR term1 OR term2 · use from:handle for Twitter accounts · commas are not supported'
                full
              >
                <input
                  className="ipt mono"
                  placeholder='"Sam Altman" OR "sama" OR from:sama'
                  value={form.queryString}
                  onChange={(e) => setForm((f) => ({ ...f, queryString: e.target.value }))}
                  required
                />
              </Field>
              <Field
                label="Google Alerts RSS"
                hint="Paste the feed URL from your Google Alert (optional)"
                full
              >
                <input
                  className="ipt mono"
                  placeholder="https://www.google.com/alerts/feeds/…"
                  value={form.googleAlertsFeedUrl}
                  onChange={(e) => setForm((f) => ({ ...f, googleAlertsFeedUrl: e.target.value }))}
                />
              </Field>
            </div>
            <div className="addcard-foot">
              <div className="addcard-platforms">
                <span className="dim">Will be polled on:</span>
                <PlatformChip platform="hackernews" />
                <PlatformChip platform="reddit" />
                <PlatformChip platform="twitter" />
                {form.googleAlertsFeedUrl && <PlatformChip platform="google_alerts" />}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {error && <span style={{ color: "var(--err)", fontSize: 12 }}>{error}</span>}
                <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Adding…" : "Add entity"}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="tbl-wrap">
          <table className="tbl tbl-entities">
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                <th>Entity</th>
                <th style={{ width: 110 }}>Type</th>
                <th>Search query</th>
                <th style={{ width: 120 }}>Sources</th>
                <th style={{ width: 150 }}>Volume</th>
                <th style={{ width: 100 }}>Added</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => {
                const sources = ["hackernews", "reddit", "twitter"].concat(
                  e.googleAlertsFeedUrl ? ["google_alerts"] : []
                );
                const spark = pseudoSpark(idx + 1, 40);
                return (
                  <tr key={e.id} className="entity-row">
                    <td>
                      <span className={cx("ebadge-glyph", `eg-${e.entityType}`)}>
                        {e.entityType === "executive" ? "◉" : e.entityType === "product" ? "◧" : "◇"}
                      </span>
                    </td>
                    <td className="entity-label">{e.label}</td>
                    <td>
                      <span className={cx("type-pill", `type-${e.entityType}`)}>
                        {e.entityType}
                      </span>
                    </td>
                    <td>
                      <code className="codepill">{e.queryString}</code>
                    </td>
                    <td>
                      <div className="src-stack">
                        {sources.map((s) => (
                          <PlatformChip key={s} platform={s} />
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="vol-cell">
                        <Sparkline values={spark} color="var(--ink-50)" height={20} />
                        <span className="mono">—</span>
                      </div>
                    </td>
                    <td className="mono dim">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td className="actions">
                      <button
                        className="iconbtn iconbtn-danger"
                        title="Delete"
                        onClick={() => handleDelete(e.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty">
              <div className="empty-mark">∅</div>
              <div className="empty-title">No entities yet</div>
              <div className="empty-sub">Add your first keyword, product, or executive above.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
