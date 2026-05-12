"use client";

import { useEffect, useState, useCallback } from "react";
import { cx, PlatformChip, Dot } from "@/components/primitives";

type ClusterItem = {
  clusterId: string;
  similarity: number;
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

export default function ClustersPage() {
  const [clusterList, setClusterList] = useState<Cluster[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState("all");
  const [sort, setSort] = useState("activity");
  const [hideSingletons, setHideSingletons] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clusterRunning, setClusterRunning] = useState(false);
  const [clusterResult, setClusterResult] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort, hideSingletons: String(hideSingletons) });
    if (entityId !== "all") params.set("entityId", entityId);
    const res = await fetch(`/api/clusters?${params}`);
    const data = await res.json();
    setClusterList(data.clusters ?? []);
    setStats(data.stats ?? null);
    setLoading(false);
  }, [entityId, sort, hideSingletons]);

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

  const latestCluster = clusterList[0];

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 2 · Clusters</div>
          <h1 className="page-title">Clusters</h1>
          <p className="page-desc">Topics grouped by semantic similarity across all sources.</p>
        </div>
        <div className="topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn" onClick={runCluster} disabled={clusterRunning}>
              {clusterRunning ? "Clustering…" : "Run Cluster"}
            </button>
            {clusterResult && (
              <span style={{ fontSize: 12, color: "var(--ink-40)", whiteSpace: "nowrap" }}>
                {clusterResult}
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

        <div className="toolbar">
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
            <span className="filter-label">Sort</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="activity">Latest activity</option>
              <option value="size">Largest</option>
              <option value="created">Newest</option>
            </select>
          </div>
          <div className="filter-group" style={{ marginLeft: "auto" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={hideSingletons}
                onChange={(e) => setHideSingletons(e.target.checked)}
              />
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
            <div className="empty-title">No clusters yet</div>
            <div className="empty-sub">Run embed then cluster to group items by topic.</div>
          </div>
        ) : (
          <div className="cluster-grid">
            {clusterList.map((cluster) => (
              <div key={cluster.id} className="cluster-card">
                <div className="cluster-card-head">
                  <span className="cluster-card-label">
                    {cluster.label ?? (
                      <span style={{ color: "var(--ink-40)", fontWeight: 400, fontStyle: "italic" }}>
                        Unnamed cluster
                      </span>
                    )}
                  </span>
                  <span className="cluster-card-count">{cluster.itemCount} items</span>
                </div>
                <div className="cluster-card-meta">
                  {shortDate(cluster.firstSeenAt)} → {relativeTime(cluster.lastSeenAt)}
                </div>

                {cluster.topItems.length > 0 && (
                  <div className="cluster-card-items">
                    {cluster.topItems.map((item, i) => (
                      <div key={i} className="cluster-item-row">
                        <PlatformChip platform={item.platform} size="sm" />
                        <span className="cluster-item-title">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.title ?? item.body?.slice(0, 120) ?? item.url}
                            </a>
                          ) : (
                            item.title ?? item.body?.slice(0, 120) ?? "—"
                          )}
                        </span>
                        <Dot color={simColor(item.similarity)} size={7} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="cluster-card-foot">
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {cluster.platforms.map((p) => (
                      <PlatformChip key={p} platform={p} size="sm" />
                    ))}
                  </div>
                  {cluster.itemCount > 3 && (
                    <span className="cluster-card-more">+ {cluster.itemCount - 3} more</span>
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
