"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  cx, PLATFORMS, PlatformChip, SignalTag, SentimentBar,
  EntityBadge, Sparkline, Dot,
} from "@/components/primitives";

type FeedItem = {
  id: string;
  entityId: string | null;
  entityLabel: string | null;
  platform: string;
  url: string | null;
  title: string | null;
  body: string | null;
  author: string | null;
  publishedAt: string | null;
  subtype: string | null;
  createdAt: string;
};

type Entity = { id: string; label: string; entityType: string };

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function pseudoSpark(seed: number, len = 16): number[] {
  return Array.from({ length: len }, (_, i) =>
    Math.abs(Math.sin(i * 0.7 + seed) * 40 + 20)
  );
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [platform, setPlatform] = useState("all");
  const [entityId, setEntityId] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "table">("list");
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [embedRunning, setEmbedRunning] = useState(false);
  const [embedResult, setEmbedResult] = useState<string | null>(null);

  const runEmbed = useCallback(async () => {
    setEmbedRunning(true);
    setEmbedResult(null);
    try {
      const res = await fetch("/api/run/embed", { method: "POST" });
      const data = await res.json();
      setEmbedResult(
        data.embedded === 0
          ? "nothing to embed"
          : `${data.embedded} embedded${data.hasMore ? " · more pending" : " · all done"}`
      );
    } catch {
      setEmbedResult("error — check console");
    } finally {
      setEmbedRunning(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "500" });
    if (platform !== "all") params.set("platform", platform);
    if (entityId !== "all") params.set("entityId", entityId);
    const res = await fetch(`/api/items?${params}`);
    setItems(await res.json());
    setLoading(false);
  }, [platform, entityId]);

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then(setEntities);
  }, []);

  useEffect(() => { fetchItems(); setPage(1); }, [fetchItems]);

  const filtered = useMemo(() => {
    setPage(1);
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.title?.toLowerCase().includes(q) ||
        i.body?.toLowerCase().includes(q) ||
        i.author?.toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const k of Object.keys(PLATFORMS)) c[k] = 0;
    for (const i of items) c[i.platform] = (c[i.platform] ?? 0) + 1;
    return c;
  }, [items]);

  const spark1 = pseudoSpark(1);
  const spark2 = pseudoSpark(2);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 1 · Ingestion</div>
          <h1 className="page-title">Raw feed</h1>
          <p className="page-desc">Every item collected across all platforms, freshest first.</p>
        </div>
        <div className="topbar-actions">
          <label className="search">
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search feed…"
            />
            <span className="kbd kbd-soft">/</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn"
              onClick={runEmbed}
              disabled={embedRunning}
            >
              {embedRunning ? "Embedding…" : "Run Embed"}
            </button>
            {embedResult && (
              <span style={{ fontSize: 12, color: "var(--ink-40)", whiteSpace: "nowrap" }}>
                {embedResult}
              </span>
            )}
          </div>
          <a href="/submit" className="btn btn-primary">+ Submit</a>
        </div>
      </header>

      <div className="page">
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-label">Total items</div>
              <Sparkline values={spark1} color="var(--ink-40)" />
            </div>
            <div className="kpi-mid">
              <div className="kpi-value">{items.length}</div>
              <div className="kpi-delta kpi-delta-up">▲ ingested</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-label">Sources active</div>
              <Sparkline values={spark2} color="var(--accent)" fill />
            </div>
            <div className="kpi-mid">
              <div className="kpi-value">
                {Object.keys(PLATFORMS).filter((k) => (counts[k] ?? 0) > 0).length}
              </div>
              <div className="kpi-delta kpi-delta-flat">→ of 5</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-label">Tracked entities</div>
            </div>
            <div className="kpi-mid">
              <div className="kpi-value">{entities.length}</div>
              <div className="kpi-delta kpi-delta-flat">→ configured</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top">
              <div className="kpi-label">Cron status</div>
            </div>
            <div className="kpi-mid">
              <div className="kpi-value" style={{ fontSize: 20, marginTop: 4 }}>
                <Dot color="var(--ok)" pulse size={10} />
              </div>
              <div className="kpi-delta kpi-delta-up">▲ Healthy</div>
            </div>
            <div className="kpi-sub">Polls every hour</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="filter-group">
            <span className="filter-label">Platform</span>
            <div className="seg seg-mono">
              <button
                className={cx("seg-btn", platform === "all" && "seg-btn-on")}
                onClick={() => setPlatform("all")}
              >
                All <span className="seg-count">{counts.all}</span>
              </button>
              {Object.entries(PLATFORMS).map(([k, p]) => (
                <button
                  key={k}
                  className={cx("seg-btn", platform === k && "seg-btn-on")}
                  onClick={() => setPlatform(k)}
                >
                  <span
                    className="seg-pdot"
                    style={{ background: `oklch(0.62 0.16 ${p.hue})` }}
                  />
                  {p.label}{" "}
                  <span className="seg-count">{counts[k] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group filter-group-right">
            <select
              className="select"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            >
              <option value="all">All entities ({entities.length})</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
            <div className="seg">
              <button
                className={cx("seg-btn", view === "list" && "seg-btn-on")}
                onClick={() => setView("list")}
              >
                List
              </button>
              <button
                className={cx("seg-btn", view === "table" && "seg-btn-on")}
                onClick={() => setView("table")}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        <div className="result-meta">
          <span>
            <strong>{filtered.length}</strong> of {items.length} items
          </span>
          <span className="dim">·</span>
          <span className="dim">Deduplicated on ingest · sorted by recency</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="dim">Show</span>
            <div className="seg">
              {[25, 50, 100].map((n) => (
                <button
                  key={n}
                  className={cx("seg-btn", pageSize === n && "seg-btn-on")}
                  onClick={() => { setPageSize(n); setPage(1); }}
                >
                  {n}
                </button>
              ))}
            </div>
          </span>
        </div>

        {loading ? (
          <div className="empty">
            <div className="empty-mark">…</div>
            <div className="empty-title">Loading feed</div>
          </div>
        ) : view === "list" ? (
          <FeedList items={paginated} entities={entities} />
        ) : (
          <FeedTable items={paginated} entities={entities} />
        )}

        {!loading && filtered.length > 0 && (
          <div className="result-meta" style={{ marginTop: 12, justifyContent: "center", gap: 12 }}>
            <button
              className="btn btn-sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span>
              Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              className="btn btn-sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function FeedList({ items, entities }: { items: FeedItem[]; entities: Entity[] }) {
  if (items.length === 0) return <Empty />;
  return (
    <div className="feedlist">
      {items.map((item) => (
        <FeedRow key={item.id} item={item} entities={entities} />
      ))}
    </div>
  );
}

function FeedRow({ item, entities }: { item: FeedItem; entities: Entity[] }) {
  const ent = entities.find((e) => e.id === item.entityId);
  const sentiment = 0;
  return (
    <article className="feedrow feedrow-low">
      <div className="feedrow-rail" />
      <div className="feedrow-left">
        <PlatformChip platform={item.platform} />
        {item.platform === "hackernews" && (
          <span className={cx("subtype-chip", item.subtype === "comment" ? "subtype-comment" : "subtype-story")}>
            {item.subtype === "comment" ? "Comment" : "Story"}
          </span>
        )}
        <div className="feedrow-time">{relativeTime(item.publishedAt ?? item.createdAt)}</div>
      </div>
      <div className="feedrow-body">
        <div className="feedrow-head">
          <h3 className="feedrow-title">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.title ?? item.body?.slice(0, 120) ?? "(no title)"}
              </a>
            ) : (
              item.title ?? item.body?.slice(0, 120) ?? "(no title)"
            )}
          </h3>
          <SignalTag level="low" />
        </div>
        {item.body && item.title && (
          <p className="feedrow-snippet">{item.body}</p>
        )}
        <div className="feedrow-meta">
          {item.author && <span className="meta-mono">{item.author}</span>}
          {ent && <EntityBadge label={ent.label} type={ent.entityType} />}
          <span className="meta-sent">
            <span className="meta-sent-label">sentiment</span>
            <SentimentBar value={sentiment} />
            <span className="meta-mono dim">{sentiment.toFixed(2)}</span>
          </span>
        </div>
      </div>
      <div className="feedrow-actions">
        <button className="iconbtn" title="Star">☆</button>
        {item.url && (
          <a className="iconbtn" href={item.url} target="_blank" rel="noopener noreferrer" title="Open">↗</a>
        )}
      </div>
    </article>
  );
}

function FeedTable({ items, entities }: { items: FeedItem[]; entities: Entity[] }) {
  if (items.length === 0) return <Empty />;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 70 }}>Src</th>
            <th style={{ width: 80 }}>Time</th>
            <th>Title</th>
            <th style={{ width: 200 }}>Entity</th>
            <th style={{ width: 120 }}>Sentiment</th>
            <th style={{ width: 90 }}>Class</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const ent = entities.find((e) => e.id === i.entityId);
            return (
              <tr key={i.id}>
                <td>
                  <PlatformChip platform={i.platform} />
                  {i.platform === "hackernews" && (
                    <span className={cx("subtype-chip", i.subtype === "comment" ? "subtype-comment" : "subtype-story")}>
                      {i.subtype === "comment" ? "Cmt" : "Str"}
                    </span>
                  )}
                </td>
                <td className="mono dim">{relativeTime(i.publishedAt ?? i.createdAt)}</td>
                <td className="tbl-title">
                  {i.url ? (
                    <a href={i.url} target="_blank" rel="noopener noreferrer">
                      {i.title ?? i.body?.slice(0, 80) ?? "(no title)"}
                    </a>
                  ) : (
                    i.title ?? "(no title)"
                  )}
                </td>
                <td>{ent && <EntityBadge label={ent.label} type={ent.entityType} />}</td>
                <td><SentimentBar value={0} /></td>
                <td><SignalTag level="low" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return (
    <div className="empty">
      <div className="empty-mark">∅</div>
      <div className="empty-title">Nothing here yet</div>
      <div className="empty-sub">
        Add entities in{" "}
        <a href="/track" className="ulink">Track</a>, configure sources in{" "}
        <a href="/sources" className="ulink">Sources</a>, or{" "}
        <a href="/submit" className="ulink">submit manually</a>.
      </div>
    </div>
  );
}
