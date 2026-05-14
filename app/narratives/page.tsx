"use client";

import { useEffect, useState, useCallback } from "react";
import { cx, PlatformChip, Dot } from "@/components/primitives";

type ClusterItem = {
  clusterId: string;
  itemId: string;
  similarity: number;
  itemSignal: string;
  analystSignal: string | null;
  signalReason: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  platform: string;
  publishedAt: string | null;
};

type Narrative = {
  id: string;
  label: string | null;
  itemCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  narrativeStage: string | null;
  narrativeSummary: string | null;
  momentum: number | null;
  classificationConfidence: number | null;
  analystClassification: string | null;
  analystNote: string | null;
  effectiveClassification: string;
  topItems: ClusterItem[];
  platforms: string[];
};

type Entity = { id: string; label: string };

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
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
      textTransform: "uppercase", color: s.color, background: s.bg,
      borderRadius: 3, padding: "2px 6px",
    }}>
      {s.label}
    </span>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, { label: string; color: string }> = {
    signal: { label: "SIGNAL", color: "var(--ok)" },
    watch:  { label: "WATCH",  color: "var(--accent)" },
    noise:  { label: "NOISE",  color: "var(--ink-30)" },
    unclassified: { label: "—", color: "var(--ink-20)" },
  };
  const m = map[signal] ?? map.unclassified;
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em",
      textTransform: "uppercase", color: m.color,
      border: `1px solid ${m.color}`, borderRadius: 2, padding: "1px 4px",
      flexShrink: 0,
    }}>
      {m.label}
    </span>
  );
}

function ItemSignalOverride({
  clusterId,
  itemId,
  current,
  onDone,
}: {
  clusterId: string;
  itemId: string;
  current: string | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const apply = async (val: "signal" | "noise" | "watch" | null) => {
    setBusy(true);
    await fetch(`/api/clusters/${clusterId}/items/${itemId}/signal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal: val }),
    });
    setBusy(false);
    onDone();
  };

  return (
    <select
      value={current ?? ""}
      disabled={busy}
      onChange={(e) => {
        const v = e.target.value;
        apply(v ? (v as "signal" | "noise" | "watch") : null);
      }}
      style={{
        fontSize: 11, fontFamily: "var(--font-mono)", border: "1px solid var(--border)",
        borderRadius: 3, padding: "1px 4px", background: "var(--paper)", color: "var(--ink-60)",
        cursor: "pointer",
      }}
    >
      <option value="">auto</option>
      <option value="signal">signal</option>
      <option value="noise">noise</option>
      <option value="watch">watch</option>
    </select>
  );
}

export default function NarrativesPage() {
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Record<string, ClusterItem[]>>({});
  const [expandLoading, setExpandLoading] = useState<Set<string>>(new Set());

  const fetchNarratives = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      classification: "narrative",
      sort: "momentum",
      hideSingletons: "true",
      stage: stageFilter,
    });
    if (entityId !== "all") params.set("entityId", entityId);
    const res = await fetch(`/api/clusters?${params}`);
    const data = await res.json();
    setNarratives(data.clusters ?? []);
    setLoading(false);
  }, [entityId, stageFilter]);

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then(setEntities);
  }, []);

  useEffect(() => { fetchNarratives(); }, [fetchNarratives]);

  const loadItems = useCallback(async (narrativeId: string) => {
    if (expandedItems[narrativeId]) return expandedItems[narrativeId];
    setExpandLoading((prev) => new Set(prev).add(narrativeId));
    const res = await fetch(`/api/clusters/${narrativeId}/items`);
    const items: ClusterItem[] = await res.json();
    setExpandedItems((prev) => ({ ...prev, [narrativeId]: items }));
    setExpandLoading((prev) => { const s = new Set(prev); s.delete(narrativeId); return s; });
    return items;
  }, [expandedItems]);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      await loadItems(id);
      setExpandedIds((prev) => new Set(prev).add(id));
    }
  }, [expandedIds, loadItems]);

  const activeNarratives = narratives.filter((n) =>
    n.narrativeStage === "emerging" || n.narrativeStage === "developing"
  ).length;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 3 · Narratives</div>
          <h1 className="page-title">Narratives</h1>
          <p className="page-desc">Developing stories classified from your clusters. Track signal and noise within each.</p>
        </div>
      </header>

      <div className="page">
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Active narratives</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{loading ? "—" : narratives.length}</div>
              <div className="kpi-delta kpi-delta-flat">→ total classified</div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Developing now</div></div>
            <div className="kpi-mid">
              <div className="kpi-value">{loading ? "—" : activeNarratives}</div>
              <div className={cx("kpi-delta", activeNarratives > 0 ? "kpi-delta-up" : "kpi-delta-flat")}>
                {activeNarratives > 0 ? "▲ emerging or developing" : "→ none active"}
              </div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Top story</div></div>
            <div className="kpi-mid">
              <div className="kpi-value" style={{ fontSize: 14, fontWeight: 500, marginTop: 4, lineHeight: 1.3 }}>
                {narratives[0]?.label ?? "—"}
              </div>
              {narratives[0] && (
                <div className="kpi-delta kpi-delta-up">
                  ▲ {relativeTime(narratives[0].lastSeenAt)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="filter-group">
            <span className="filter-label">Entity</span>
            <select className="select" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="all">All entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
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
        </div>

        {loading ? (
          <div className="empty"><div className="empty-mark">⧖</div><div className="empty-title">Loading narratives…</div></div>
        ) : narratives.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">◎</div>
            <div className="empty-title">No narratives yet</div>
            <div className="empty-sub">Run Classify on the Clusters page to identify developing stories.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {narratives.map((n) => {
              const isExpanded = expandedIds.has(n.id);
              const items = expandedItems[n.id] ?? n.topItems;
              const signalCount = items.filter((i) => (i.analystSignal ?? i.itemSignal) === "signal").length;
              const noiseCount = items.filter((i) => (i.analystSignal ?? i.itemSignal) === "noise").length;

              return (
                <div key={n.id} className="cluster-card" style={{ padding: 16 }}>
                  {/* Narrative header */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        {n.narrativeStage && <StagePill stage={n.narrativeStage} />}
                        {n.classificationConfidence != null && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-30)" }}>
                            {Math.round(n.classificationConfidence * 100)}% conf
                          </span>
                        )}
                        {n.momentum != null && n.momentum > 0 && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)" }}>
                            ↑{n.momentum.toFixed(1)}/day
                          </span>
                        )}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ok)" }}>
                          {signalCount} signal
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-30)" }}>
                          {noiseCount} noise
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-80)", lineHeight: 1.3 }}>
                        {n.label ?? (
                          <span style={{ color: "var(--ink-40)", fontWeight: 400, fontStyle: "italic" }}>Unnamed narrative</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-30)", flexShrink: 0, textAlign: "right" }}>
                      <div>{n.itemCount} items</div>
                      <div>{shortDate(n.firstSeenAt)} → {relativeTime(n.lastSeenAt)}</div>
                    </div>
                  </div>

                  {/* Analyst override note */}
                  {n.analystClassification && (
                    <div style={{ fontSize: 11, color: "var(--ink-40)", fontStyle: "italic", marginBottom: 6 }}>
                      Analyst confirmed: {n.analystNote ? `"${n.analystNote}"` : "narrative"}
                    </div>
                  )}

                  {/* Narrative summary */}
                  {n.narrativeSummary && (
                    <p style={{
                      fontSize: 13, color: "var(--ink-60)", lineHeight: 1.5, margin: "0 0 10px",
                      padding: "8px 10px",
                      background: "color-mix(in oklch, var(--accent) 6%, var(--paper))",
                      borderLeft: "2px solid var(--accent)",
                      borderRadius: "0 4px 4px 0",
                    }}>
                      {n.narrativeSummary}
                    </p>
                  )}

                  {/* Items with signal/noise labels */}
                  <div className="cluster-card-items">
                    {items.map((item, i) => {
                      const effectiveSignal = item.analystSignal ?? item.itemSignal;
                      return (
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
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            <SignalBadge signal={effectiveSignal} />
                            <ItemSignalOverride
                              clusterId={n.id}
                              itemId={item.itemId}
                              current={item.analystSignal}
                              onDone={fetchNarratives}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="cluster-card-foot" style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {n.platforms.map((p) => <PlatformChip key={p} platform={p} size="sm" />)}
                    </div>
                    <button
                      className="cluster-card-more"
                      onClick={() => toggleExpand(n.id)}
                    >
                      {expandLoading.has(n.id)
                        ? "loading…"
                        : isExpanded
                        ? "show less"
                        : n.itemCount > 3 ? `+ ${n.itemCount - 3} more` : "show all"}
                    </button>
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
