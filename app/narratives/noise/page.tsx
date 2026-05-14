"use client";

import { useEffect, useState, useCallback } from "react";
import { PlatformChip } from "@/components/primitives";

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

type MergeInfo = {
  absorbedLabel: string | null;
  absorbedItemCount: number;
  mergedAt: string;
  ingestedFirstAt: string;
  ingestedLastAt: string;
};

type ExpandedData = {
  items: ClusterItem[];
  merges: Record<string, MergeInfo>;
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

function WaveHeader({ label, isFirst }: { label: string; isFirst: boolean }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
      color: "var(--ink-30)", padding: "5px 0 3px",
      borderTop: isFirst ? "none" : "1px solid var(--border-soft)", marginTop: isFirst ? 0 : 6,
    }}>
      {label}
    </div>
  );
}

export default function NoisePage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedData, setExpandedData] = useState<Record<string, ExpandedData>>({});

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/clusters?analystClassification=noise&sort=activity");
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
    if (!expandedData[id]) {
      const res = await fetch(`/api/clusters/${id}/items`);
      const data: ExpandedData = await res.json();
      setExpandedData((prev) => ({ ...prev, [id]: data }));
    }
    setExpandedIds((prev) => new Set(prev).add(id));
  }, [expandedIds, expandedData]);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 3 · Narratives</div>
          <h1 className="page-title">Noise</h1>
          <p className="page-desc">Clusters the analyst has reviewed and confirmed as noise. May still contain narrative patterns.</p>
        </div>
      </header>

      <div className="page">
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Noise clusters</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{loading ? "—" : clusters.length}</div>
              <div className="kpi-delta kpi-delta-flat">→ analyst reviewed</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Total items</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{loading ? "—" : clusters.reduce((s, c) => s + c.itemCount, 0)}</div>
              <div className="kpi-delta kpi-delta-flat">→ across noise clusters</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty"><div className="empty-mark">⧖</div><div className="empty-title">Loading…</div></div>
        ) : clusters.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">◇</div>
            <div className="empty-title">No noise clusters yet</div>
            <div className="empty-sub">Use the ⋯ menu on a cluster in Cluster Review to mark it as Noise.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {clusters.map((cluster) => {
              const isExpanded = expandedIds.has(cluster.id);
              const expanded = expandedData[cluster.id];
              const displayItems = isExpanded ? (expanded?.items ?? cluster.topItems) : cluster.topItems;
              return (
                <div key={cluster.id} className="cluster-card" style={{ padding: 16, opacity: 0.85 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                          textTransform: "uppercase", color: "var(--ink-40)",
                          border: "1px solid var(--ink-20)", borderRadius: 3, padding: "1px 5px",
                        }}>
                          NOISE
                        </span>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                          textTransform: "uppercase", color: "var(--ink-40)",
                          border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px",
                        }}>
                          ANALYST REVIEWED
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-60)", lineHeight: 1.3 }}>
                        {cluster.label ?? <span style={{ color: "var(--ink-30)", fontWeight: 400, fontStyle: "italic" }}>Unnamed cluster</span>}
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

                  {(() => {
                    const renderItem = (item: ClusterItem, i: number) => (
                      <div key={i} className="cluster-item-row" style={{ alignItems: "flex-start", gap: 6 }}>
                        <PlatformChip platform={item.platform} size="sm" />
                        <span className="cluster-item-title" style={{ flex: 1, color: "var(--ink-50)" }}>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-50)" }}>
                              {cleanTitle(item.title) ?? item.body?.slice(0, 140) ?? item.url}
                            </a>
                          ) : (
                            cleanTitle(item.title) ?? item.body?.slice(0, 140) ?? "—"
                          )}
                        </span>
                      </div>
                    );
                    if (!isExpanded || !expanded?.merges || Object.keys(expanded.merges).length === 0) {
                      return <div className="cluster-card-items">{displayItems.map(renderItem)}</div>;
                    }
                    const originalItems = displayItems.filter((i) => !i.mergeId);
                    const mergeGroups = Object.entries(expanded.merges)
                      .map(([mergeId, merge]) => ({ mergeId, merge, items: displayItems.filter((i) => i.mergeId === mergeId) }))
                      .filter((g) => g.items.length > 0)
                      .sort((a, b) => new Date(a.merge.ingestedFirstAt).getTime() - new Date(b.merge.ingestedFirstAt).getTime());
                    return (
                      <div className="cluster-card-items">
                        {originalItems.length > 0 && mergeGroups.length > 0 && (
                          <WaveHeader label="Original" isFirst />
                        )}
                        {originalItems.map(renderItem)}
                        {mergeGroups.map(({ mergeId, merge, items: waveItems }, gi) => (
                          <div key={mergeId}>
                            <WaveHeader
                              label={`Merged from "${merge.absorbedLabel ?? "Unnamed"}" · ${shortDate(merge.ingestedFirstAt)} → ${shortDate(merge.ingestedLastAt)} · ${merge.absorbedItemCount} items`}
                              isFirst={originalItems.length === 0 && gi === 0}
                            />
                            {waveItems.map(renderItem)}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

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
