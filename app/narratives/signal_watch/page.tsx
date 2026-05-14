"use client";

import { useEffect, useState, useCallback } from "react";
import { cx, PlatformChip } from "@/components/primitives";

type ClusterItem = {
  clusterId: string;
  itemId: string;
  similarity: number;
  itemSignal: string;
  analystSignal: string | null;
  signalReason: string | null;
  mergeId: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  platform: string;
  publishedAt: string | null;
};

type Cluster = {
  id: string;
  label: string | null;
  itemCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  analystClassification: string | null;
  analystNote: string | null;
  narrativeSummary: string | null;
  topItems: ClusterItem[];
  platforms: string[];
};

function cleanTitle(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .trim() || null;
}

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

function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AnalystBadge({ classification }: { classification: string }) {
  const isSignal = classification === "signal";
  const color = isSignal ? "var(--ok)" : "var(--warn)";
  const label = isSignal ? "SIGNAL" : "WATCH";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color, border: `1px solid ${color}`,
        borderRadius: 3, padding: "1px 5px",
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--ink-40)",
        border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px",
      }}>
        ANALYST REVIEWED
      </span>
    </span>
  );
}

export default function SignalWatchPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Record<string, ClusterItem[]>>({});

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/clusters?analystClassification=signal_watch&sort=activity");
    const data = await res.json();
    setClusters(data.clusters ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      return;
    }
    if (!expandedItems[id]) {
      const res = await fetch(`/api/clusters/${id}/items`);
      const data = await res.json();
      setExpandedItems((prev) => ({ ...prev, [id]: data.items ?? [] }));
    }
    setExpandedIds((prev) => new Set(prev).add(id));
  }, [expandedIds, expandedItems]);

  const signalCount = clusters.filter((c) => c.analystClassification === "signal").length;
  const watchCount = clusters.filter((c) => c.analystClassification === "watch").length;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 3 · Narratives</div>
          <h1 className="page-title">Signal &amp; Watch</h1>
          <p className="page-desc">Clusters the analyst has explicitly marked as signal or watch for monitoring.</p>
        </div>
      </header>

      <div className="page">
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Signal</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{loading ? "—" : signalCount}</div>
              <div className="kpi-delta" style={{ color: "var(--ok)" }}>confirmed signal</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Watch</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{loading ? "—" : watchCount}</div>
              <div className="kpi-delta" style={{ color: "var(--warn)" }}>monitoring</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Total reviewed</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{loading ? "—" : clusters.length}</div>
              <div className="kpi-delta kpi-delta-flat">→ analyst reviewed</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty"><div className="empty-mark">⧖</div><div className="empty-title">Loading…</div></div>
        ) : clusters.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">◆</div>
            <div className="empty-title">No signal or watch clusters yet</div>
            <div className="empty-sub">Use the ⋯ menu on a cluster in Cluster Review to mark it as Signal or Watch.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {clusters.map((cluster) => {
              const isExpanded = expandedIds.has(cluster.id);
              const displayItems = isExpanded ? (expandedItems[cluster.id] ?? cluster.topItems) : cluster.topItems;
              return (
                <div key={cluster.id} className="cluster-card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 6 }}>
                        <AnalystBadge classification={cluster.analystClassification!} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-80)", lineHeight: 1.3 }}>
                        {cluster.label ?? <span style={{ color: "var(--ink-40)", fontWeight: 400, fontStyle: "italic" }}>Unnamed cluster</span>}
                      </div>
                      {cluster.analystNote && (
                        <div style={{ fontSize: 11, color: "var(--ink-40)", fontStyle: "italic", marginTop: 4 }}>
                          "{cluster.analystNote}"
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-30)", flexShrink: 0, textAlign: "right" }}>
                      <div>{cluster.itemCount} items</div>
                      <div>{shortDate(cluster.firstSeenAt)} → {relativeTime(cluster.lastSeenAt)}</div>
                    </div>
                  </div>

                  {cluster.narrativeSummary && (
                    <p style={{
                      fontSize: 13, color: "var(--ink-60)", lineHeight: 1.5, margin: "0 0 10px",
                      padding: "8px 10px",
                      background: "color-mix(in oklch, var(--accent) 6%, var(--paper))",
                      borderLeft: "2px solid var(--accent)",
                      borderRadius: "0 4px 4px 0",
                    }}>
                      {cluster.narrativeSummary}
                    </p>
                  )}

                  <div className="cluster-card-items">
                    {displayItems.map((item, i) => (
                      <div key={i} className="cluster-item-row" style={{ alignItems: "flex-start", gap: 6 }}>
                        <PlatformChip platform={item.platform} size="sm" />
                        <span className="cluster-item-title" style={{ flex: 1 }}>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {cleanTitle(item.title) ?? item.body?.slice(0, 140) ?? item.url}
                            </a>
                          ) : (
                            cleanTitle(item.title) ?? item.body?.slice(0, 140) ?? "—"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="cluster-card-foot" style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {cluster.platforms.map((p) => <PlatformChip key={p} platform={p} size="sm" />)}
                    </div>
                    {cluster.itemCount > 3 && (
                      <button className="cluster-card-more" onClick={() => toggleExpand(cluster.id)}>
                        {isExpanded ? "show less" : `+ ${cluster.itemCount - 3} more`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
