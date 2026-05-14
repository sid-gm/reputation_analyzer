"use client";

import { useEffect, useState, useCallback } from "react";
import { cx, PlatformChip, Dot } from "@/components/primitives";

type ClusterItem = {
  clusterId: string;
  itemId: string;
  similarity: number;
  itemSignal: string;
  analystSignal: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  platform: string;
  publishedAt: string | null;
};

type Cluster = {
  id: string;
  entityId: string | null;
  label: string | null;
  itemCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  classification: string;
  effectiveClassification: string;
  narrativeStage: string | null;
  narrativeSummary: string | null;
  momentum: number | null;
  classificationConfidence: number | null;
  analystClassification: string | null;
  analystNote: string | null;
  topItems: ClusterItem[];
  platforms: string[];
};

type Stats = {
  total: number;
  avgSize: string;
  itemsClustered: number;
  totalItems: number;
};

type Entity = { id: string; label: string };

function cleanTitle(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .trim() || null;
}

function simColor(sim: number): string {
  if (sim >= 0.92) return "var(--ok)";
  if (sim >= 0.86) return "var(--accent)";
  return "var(--ink-20)";
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

function ClassificationPill({ classification }: { classification: string }) {
  const styles: Record<string, { label: string; color: string }> = {
    narrative:    { label: "NARRATIVE",    color: "var(--accent)" },
    noise:        { label: "NOISE",        color: "var(--ink-30)" },
    unclassified: { label: "UNCLASSIFIED", color: "var(--ink-20)" },
  };
  const s = styles[classification] ?? styles.unclassified;
  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: s.color,
      border: `1px solid ${s.color}`,
      borderRadius: 3,
      padding: "1px 5px",
      lineHeight: 1.4,
    }}>
      {s.label}
    </span>
  );
}

function StagePill({ stage }: { stage: string }) {
  const styles: Record<string, { label: string; bg: string; color: string }> = {
    emerging:   { label: "EMERGING",   bg: "color-mix(in oklch, var(--ok) 15%, transparent)",     color: "var(--ok)" },
    developing: { label: "DEVELOPING", bg: "color-mix(in oklch, var(--accent) 15%, transparent)", color: "var(--accent)" },
    peaked:     { label: "PEAKED",     bg: "color-mix(in oklch, var(--warn) 15%, transparent)",   color: "var(--warn)" },
    declining:  { label: "DECLINING",  bg: "color-mix(in oklch, var(--err) 12%, transparent)",    color: "var(--err)" },
  };
  const s = styles[stage];
  if (!s) return null;
  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: s.color,
      background: s.bg,
      borderRadius: 3,
      padding: "1px 5px",
      lineHeight: 1.4,
    }}>
      {s.label}
    </span>
  );
}

function SignalDot({ signal }: { signal: string }) {
  const color =
    signal === "signal" ? "var(--ok)" :
    signal === "watch"  ? "var(--accent)" :
    signal === "noise"  ? "var(--ink-20)" :
    "var(--ink-10)";
  return <Dot color={color} size={7} />;
}

function OverrideMenu({
  clusterId,
  current,
  onDone,
}: {
  clusterId: string;
  current: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = async (val: "narrative" | "noise" | null) => {
    setBusy(true);
    await fetch(`/api/clusters/${clusterId}/classify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification: val }),
    });
    setBusy(false);
    setOpen(false);
    onDone();
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn-ghost"
        style={{ fontSize: 14, padding: "0 6px", lineHeight: 1 }}
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title="Analyst override"
      >
        ⋯
      </button>
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "100%",
          zIndex: 100,
          background: "var(--paper)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          minWidth: 160,
          padding: "4px 0",
        }}>
          <div style={{ padding: "4px 12px 2px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-30)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Analyst override
          </div>
          {current !== "narrative" && (
            <button className="dropdown-item" onClick={() => apply("narrative")}>Mark as Narrative</button>
          )}
          {current !== "noise" && (
            <button className="dropdown-item" onClick={() => apply("noise")}>Mark as Noise</button>
          )}
          {current !== null && (
            <button className="dropdown-item" style={{ color: "var(--ink-40)" }} onClick={() => apply(null)}>Reset override</button>
          )}
          <button className="dropdown-item" onClick={() => setOpen(false)} style={{ color: "var(--ink-30)" }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default function ClustersPage() {
  const [clusterList, setClusterList] = useState<Cluster[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState("all");
  const [sort, setSort] = useState("activity");
  const [hideSingletons, setHideSingletons] = useState(false);
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [clusterRunning, setClusterRunning] = useState(false);
  const [clusterResult, setClusterResult] = useState<string | null>(null);
  const [classifyRunning, setClassifyRunning] = useState(false);
  const [classifyResult, setClassifyResult] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Record<string, ClusterItem[]>>({});
  const [expandLoading, setExpandLoading] = useState<Set<string>>(new Set());
  const [summaryExpanded, setSummaryExpanded] = useState<Set<string>>(new Set());

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      sort,
      hideSingletons: String(hideSingletons),
      classification: classificationFilter,
      stage: stageFilter,
      confidence: confidenceFilter,
    });
    if (entityId !== "all") params.set("entityId", entityId);
    const res = await fetch(`/api/clusters?${params}`);
    const data = await res.json();
    setClusterList(data.clusters ?? []);
    setStats(data.stats ?? null);
    setLoading(false);
  }, [entityId, sort, hideSingletons, classificationFilter, stageFilter, confidenceFilter]);

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then(setEntities);
  }, []);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  const runCluster = useCallback(async () => {
    setClusterRunning(true);
    setClusterResult(null);
    try {
      const res = await fetch("/api/run/cluster", { method: "POST" });
      const data = await res.json();
      setClusterResult(
        data.assigned === 0 && data.created === 0
          ? "nothing to cluster"
          : `${data.assigned} assigned · ${data.created} new clusters`
      );
      fetchClusters();
    } catch {
      setClusterResult("error — check console");
    } finally {
      setClusterRunning(false);
    }
  }, [fetchClusters]);

  const runClassify = useCallback(async () => {
    setClassifyRunning(true);
    setClassifyResult(null);
    try {
      const res = await fetch("/api/run/classify", { method: "POST" });
      const data = await res.json();
      setClassifyResult(`${data.classified} classified · ${data.signalsTagged} signals tagged`);
      fetchClusters();
    } catch {
      setClassifyResult("error — check console");
    } finally {
      setClassifyRunning(false);
    }
  }, [fetchClusters]);

  const toggleExpand = useCallback(async (clusterId: string) => {
    if (expandedIds.has(clusterId)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(clusterId); return s; });
      return;
    }
    if (!expandedItems[clusterId]) {
      setExpandLoading((prev) => new Set(prev).add(clusterId));
      const res = await fetch(`/api/clusters/${clusterId}/items`);
      const items: ClusterItem[] = await res.json();
      setExpandedItems((prev) => ({ ...prev, [clusterId]: items }));
      setExpandLoading((prev) => { const s = new Set(prev); s.delete(clusterId); return s; });
    }
    setExpandedIds((prev) => new Set(prev).add(clusterId));
  }, [expandedIds, expandedItems]);

  const toggleSummary = (id: string) =>
    setSummaryExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const latestCluster = clusterList[0];

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 2 · Clusters</div>
          <h1 className="page-title">Clusters</h1>
          <p className="page-desc">Topics grouped by semantic similarity. Classify to surface narratives.</p>
        </div>
        <div className="topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn-ghost" onClick={runCluster} disabled={clusterRunning}>
              {clusterRunning ? "Clustering…" : "Run Cluster"}
            </button>
            <button className="btn" onClick={runClassify} disabled={classifyRunning}>
              {classifyRunning ? "Classifying…" : "Run Classify"}
            </button>
            {(clusterResult || classifyResult) && (
              <span style={{ fontSize: 12, color: "var(--ink-40)", whiteSpace: "nowrap" }}>
                {classifyResult ?? clusterResult}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="page">
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Active clusters</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{stats?.total ?? "—"}</div>
              <div className="kpi-delta kpi-delta-flat">→ topics found</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Items clustered</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{stats?.itemsClustered ?? "—"}</div>
              <div className="kpi-delta kpi-delta-flat">→ of {stats?.totalItems ?? "—"} total</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Avg cluster size</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{stats?.avgSize ?? "—"}</div>
              <div className="kpi-delta kpi-delta-flat">→ items / topic</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Latest activity</div></div>
            <div className="kpi-mid">
              <div className="kpi-value" style={{ fontSize: 15, fontWeight: 500, marginTop: 6, lineHeight: 1.3 }}>
                {latestCluster?.label ?? (latestCluster ? "Unnamed" : "—")}
              </div>
              <div className={cx("kpi-delta", latestCluster ? "kpi-delta-up" : "kpi-delta-flat")}>
                {latestCluster ? `▲ ${relativeTime(latestCluster.lastSeenAt)}` : "no clusters yet"}
              </div>
            </div>
          </div>
        </div>

        <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="filter-group">
            <span className="filter-label">Entity</span>
            <select className="select" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="all">All entities</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Classification</span>
            <select className="select" value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="narrative">Narrative</option>
              <option value="noise">Noise</option>
              <option value="unclassified">Unclassified</option>
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Stage</span>
            <select className="select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="all">All stages</option>
              <option value="emerging">Emerging</option>
              <option value="developing">Developing</option>
              <option value="peaked">Peaked</option>
              <option value="declining">Declining</option>
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Confidence</span>
            <select className="select" value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="high">High ≥80%</option>
              <option value="medium">Medium 50–79%</option>
              <option value="low">Low &lt;50%</option>
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Sort</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="activity">Latest activity</option>
              <option value="momentum">Momentum</option>
              <option value="size">Largest</option>
              <option value="created">Newest</option>
            </select>
          </div>
          <div className="filter-group" style={{ marginLeft: "auto" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={hideSingletons} onChange={(e) => setHideSingletons(e.target.checked)} />
              Hide singletons
            </label>
          </div>
        </div>

        {loading ? (
          <div className="empty">
            <div className="empty-mark">⧖</div>
            <div className="empty-title">Loading clusters…</div>
          </div>
        ) : clusterList.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">◎</div>
            <div className="empty-title">No clusters match filters</div>
            <div className="empty-sub">Run cluster then classify to group and label topics.</div>
          </div>
        ) : (
          <div className="cluster-grid">
            {clusterList.map((cluster) => (
              <div key={cluster.id} className="cluster-card">
                {/* Card header */}
                <div className="cluster-card-head" style={{ alignItems: "flex-start", gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <ClassificationPill classification={cluster.effectiveClassification} />
                      {cluster.narrativeStage && cluster.effectiveClassification === "narrative" && (
                        <StagePill stage={cluster.narrativeStage} />
                      )}
                      {cluster.classificationConfidence != null && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-30)" }}>
                          {Math.round(cluster.classificationConfidence * 100)}% conf
                        </span>
                      )}
                      {cluster.momentum != null && cluster.momentum > 0 && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-40)" }}>
                          ↑{cluster.momentum.toFixed(1)}/day
                        </span>
                      )}
                    </div>
                    <span className="cluster-card-label">
                      {cluster.label ?? (
                        <span style={{ color: "var(--ink-40)", fontWeight: 400, fontStyle: "italic" }}>
                          Unnamed cluster
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span className="cluster-card-count">{cluster.itemCount} items</span>
                    <OverrideMenu
                      clusterId={cluster.id}
                      current={cluster.analystClassification}
                      onDone={fetchClusters}
                    />
                  </div>
                </div>

                {/* Analyst override indicator */}
                {cluster.analystClassification && (
                  <div style={{ fontSize: 11, color: "var(--ink-40)", fontStyle: "italic", marginBottom: 4, paddingLeft: 2 }}>
                    Analyst: marked as {cluster.analystClassification}
                    {cluster.analystNote ? ` — ${cluster.analystNote}` : ""}
                  </div>
                )}

                <div className="cluster-card-meta">
                  {shortDate(cluster.firstSeenAt)} → {relativeTime(cluster.lastSeenAt)}
                </div>

                {/* Narrative summary */}
                {cluster.narrativeSummary && cluster.effectiveClassification === "narrative" && (
                  <div style={{ marginBottom: 8 }}>
                    <button
                      onClick={() => toggleSummary(cluster.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "3px 0",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "var(--ink-40)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {summaryExpanded.has(cluster.id) ? "▾" : "▸"} Summary
                    </button>
                    {summaryExpanded.has(cluster.id) && (
                      <p style={{
                        fontSize: 12,
                        color: "var(--ink-60)",
                        lineHeight: 1.5,
                        margin: "4px 0 0",
                        padding: "6px 8px",
                        background: "color-mix(in oklch, var(--accent) 6%, var(--paper))",
                        borderLeft: "2px solid var(--accent)",
                        borderRadius: "0 4px 4px 0",
                      }}>
                        {cluster.narrativeSummary}
                      </p>
                    )}
                  </div>
                )}

                {/* Items list */}
                {(() => {
                  const isExpanded = expandedIds.has(cluster.id);
                  const displayItems = isExpanded
                    ? (expandedItems[cluster.id] ?? cluster.topItems)
                    : cluster.topItems;
                  return displayItems.length > 0 ? (
                    <div className="cluster-card-items">
                      {displayItems.map((item, i) => {
                        const effectiveSignal = item.analystSignal ?? item.itemSignal;
                        return (
                          <div key={i} className="cluster-item-row">
                            <PlatformChip platform={item.platform} size="sm" />
                            <span className="cluster-item-title">
                              {item.url ? (
                                <a href={item.url} target="_blank" rel="noopener noreferrer">
                                  {cleanTitle(item.title) ?? item.body?.slice(0, 120) ?? item.url}
                                </a>
                              ) : (
                                cleanTitle(item.title) ?? item.body?.slice(0, 120) ?? "—"
                              )}
                            </span>
                            <SignalDot signal={effectiveSignal} />
                            <Dot color={simColor(item.similarity)} size={7} />
                          </div>
                        );
                      })}
                    </div>
                  ) : null;
                })()}

                <div className="cluster-card-foot">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-40)" }}>
                      sources
                    </span>
                    {cluster.platforms.map((p) => (
                      <PlatformChip key={p} platform={p} size="sm" />
                    ))}
                  </div>
                  {cluster.itemCount > 3 && (
                    <button
                      className="cluster-card-more"
                      onClick={() => toggleExpand(cluster.id)}
                    >
                      {expandLoading.has(cluster.id)
                        ? "loading…"
                        : expandedIds.has(cluster.id)
                        ? "show less"
                        : `+ ${cluster.itemCount - 3} more`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
