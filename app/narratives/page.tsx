"use client";

import { useEffect, useState, useCallback } from "react";
import { cx, PlatformChip, Dot } from "@/components/primitives";

type MergeInfo = {
  absorbedLabel: string | null;
  absorbedFirstSeenAt: string;
  absorbedLastSeenAt: string;
  absorbedItemCount: number;
  mergedAt: string;
  ingestedFirstAt: string;
  ingestedLastAt: string;
};

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

type ExpandedData = {
  items: ClusterItem[];
  merges: Record<string, MergeInfo>;
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
  peakMomentum: number | null;
  velocity24h: number | null;
  prevVelocity24h: number | null;
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

const STAGE_RULES: Array<{ stage: string; color: string; conditions: Array<{ label: string; check: (v: number, p: number, a: number, age: number) => boolean }> }> = [
  { stage: "emerging",   color: "var(--ok)",     conditions: [{ label: "age < 2d", check: (_v,_p,_a,age) => age < 2 }, { label: "v > 0", check: (v) => v > 0 }] },
  { stage: "developing", color: "var(--accent)",  conditions: [{ label: "accel > 0", check: (_v,_p,a) => a > 0 }, { label: "ratio < 85%", check: (v,p) => p > 0 && v/p < 0.85 }] },
  { stage: "peaked",     color: "var(--warn)",    conditions: [{ label: "ratio ≥ 85%", check: (v,p) => p > 0 && v/p >= 0.85 }, { label: "accel ≤ 0", check: (_v,_p,a) => a <= 0 }] },
  { stage: "declining",  color: "var(--err)",     conditions: [{ label: "ratio < 50%", check: (v,p) => p > 0 && v/p < 0.5 }, { label: "accel ≤ 0", check: (_v,_p,a) => a <= 0 }] },
];

function StageKey() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-40)", textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>Stage key</span>
        <span style={{ opacity: 0.5, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· ratio = velocity ÷ peak</span>
      </button>
      {open && (
        <div style={{
          marginTop: 8, padding: "10px 14px", border: "1px solid var(--border)",
          borderRadius: 6, background: "var(--paper)",
          display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 20px", alignItems: "center",
        }}>
          {STAGE_RULES.map(({ stage, color, conditions }) => (
            <>
              <span key={stage + "-label"} style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color }}>
                {stage}
              </span>
              <span key={stage + "-cond"} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-60)" }}>
                {conditions.map((c) => c.label).join("  ·  ")}
              </span>
            </>
          ))}
        </div>
      )}
    </div>
  );
}

function StagePill({ stage, velocity24h, prevVelocity24h, peakMomentum, firstSeenAt }: {
  stage: string;
  velocity24h?: number | null;
  prevVelocity24h?: number | null;
  peakMomentum?: number | null;
  firstSeenAt?: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const styles: Record<string, { label: string; bg: string; color: string }> = {
    emerging:   { label: "EMERGING",   bg: "color-mix(in oklch, var(--ok) 15%, transparent)",     color: "var(--ok)" },
    developing: { label: "DEVELOPING", bg: "color-mix(in oklch, var(--accent) 15%, transparent)", color: "var(--accent)" },
    peaked:     { label: "PEAKED",     bg: "color-mix(in oklch, var(--warn) 15%, transparent)",   color: "var(--warn)" },
    declining:  { label: "DECLINING",  bg: "color-mix(in oklch, var(--err) 12%, transparent)",    color: "var(--err)" },
  };
  const s = styles[stage];
  if (!s) return null;
  const v = velocity24h ?? 0;
  const pv = prevVelocity24h ?? 0;
  const pk = peakMomentum ?? 0;
  const accel = v - pv;
  const ageInDays = firstSeenAt ? (Date.now() - new Date(firstSeenAt).getTime()) / 86400000 : 99;
  const ratio = pk > 0 ? v / pk : null;
  const fmt = (n: number | null | undefined) => n == null ? "—" : n.toFixed(1);
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: s.color, background: s.bg,
        borderRadius: 3, padding: "2px 6px", cursor: "default",
      }}>
        {s.label}
      </span>
      {hovered && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 9000,
          background: "var(--ink)", color: "var(--paper)", borderRadius: 6,
          padding: "10px 14px", fontSize: 11, fontFamily: "var(--font-mono)",
          whiteSpace: "nowrap", pointerEvents: "none",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)", minWidth: 260,
        }}>
          {/* Current values */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 16px", marginBottom: 10 }}>
            <span style={{ opacity: 0.45 }}>velocity</span><span>{fmt(velocity24h)}<span style={{ opacity: 0.5 }}>/day</span></span>
            <span style={{ opacity: 0.45 }}>prev</span><span>{fmt(prevVelocity24h)}<span style={{ opacity: 0.5 }}>/day</span></span>
            <span style={{ opacity: 0.45 }}>accel</span><span>{accel >= 0 ? "+" : ""}{fmt(accel)}<span style={{ opacity: 0.5 }}>/day</span></span>
            <span style={{ opacity: 0.45 }}>peak</span><span>{fmt(peakMomentum)}<span style={{ opacity: 0.5 }}>/day</span></span>
            <span style={{ opacity: 0.45 }}>ratio</span><span>{ratio != null ? `${Math.round(ratio * 100)}%` : "—"}</span>
          </div>
          {/* Rule conditions */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {STAGE_RULES.map(({ stage: rs, color, conditions }) => {
              const isActive = rs === stage;
              return (
                <div key={rs} style={{ display: "flex", alignItems: "center", gap: 8, opacity: isActive ? 1 : 0.35 }}>
                  <span style={{ color, width: 8, fontSize: 8 }}>{isActive ? "●" : "○"}</span>
                  <span style={{ color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", minWidth: 82 }}>{rs}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    {conditions.map((c) => {
                      const met = c.check(v, pk, accel, ageInDays);
                      return (
                        <span key={c.label} style={{ color: met ? "var(--ok)" : "rgba(255,255,255,0.4)" }}>
                          {c.label}{isActive ? (met ? " ✓" : " ✗") : ""}
                        </span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  const [expandedData, setExpandedData] = useState<Record<string, ExpandedData>>({});
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

  const loadItems = useCallback(async (narrativeId: string): Promise<ExpandedData> => {
    setExpandLoading((prev) => new Set(prev).add(narrativeId));
    const res = await fetch(`/api/clusters/${narrativeId}/items`);
    const data: ExpandedData = await res.json();
    setExpandedData((prev) => ({ ...prev, [narrativeId]: data }));
    setExpandLoading((prev) => { const s = new Set(prev); s.delete(narrativeId); return s; });
    return data;
  }, []);

  const reloadItems = useCallback(async (narrativeId: string) => {
    const res = await fetch(`/api/clusters/${narrativeId}/items`);
    const data: ExpandedData = await res.json();
    setExpandedData((prev) => ({ ...prev, [narrativeId]: data }));
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      if (!expandedData[id]) await loadItems(id);
      setExpandedIds((prev) => new Set(prev).add(id));
    }
  }, [expandedIds, expandedData, loadItems]);

  function renderItemRow(item: ClusterItem, i: number, narrativeId: string) {
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
            clusterId={narrativeId}
            itemId={item.itemId}
            current={item.analystSignal}
            onDone={() => { fetchNarratives(); reloadItems(narrativeId); }}
          />
        </div>
      </div>
    );
  }

  function renderExpandedItems(narrative: Narrative) {
    const data = expandedData[narrative.id];
    if (!data) return null;
    const { items, merges } = data;

    const originalItems = items.filter((i) => !i.mergeId);
    const mergeGroups = Object.entries(merges)
      .map(([mergeId, merge]) => ({ mergeId, merge, items: items.filter((i) => i.mergeId === mergeId) }))
      .filter((g) => g.items.length > 0)
      .sort((a, b) => new Date(a.merge.absorbedFirstSeenAt).getTime() - new Date(b.merge.absorbedFirstSeenAt).getTime());

    const hasWaves = mergeGroups.length > 0;

    return (
      <div className="cluster-card-items">
        {hasWaves && originalItems.length > 0 && (
          <WaveHeader label={`Original · ${shortDate(narrative.firstSeenAt)}`} isFirst />
        )}
        {originalItems.map((item, i) => renderItemRow(item, i, narrative.id))}
        {mergeGroups.map(({ mergeId, merge, items: waveItems }, gi) => (
          <div key={mergeId}>
            <WaveHeader
              label={`Merged from "${merge.absorbedLabel ?? "Unnamed"}" · ${shortDate(merge.ingestedFirstAt)} → ${shortDate(merge.ingestedLastAt)} · ${merge.absorbedItemCount} items`}
              isFirst={!hasWaves || (originalItems.length === 0 && gi === 0)}
            />
            {waveItems.map((item, i) => renderItemRow(item, i, narrative.id))}
          </div>
        ))}
      </div>
    );
  }

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

        <StageKey />

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
              const allItems = expandedData[n.id]?.items ?? n.topItems;
              const signalCount = allItems.filter((i) => (i.analystSignal ?? i.itemSignal) === "signal").length;
              const noiseCount = allItems.filter((i) => (i.analystSignal ?? i.itemSignal) === "noise").length;

              return (
                <div key={n.id} className="cluster-card" style={{ padding: 16 }}>
                  {/* Narrative header */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                        {n.narrativeStage && <StagePill stage={n.narrativeStage} velocity24h={n.velocity24h} prevVelocity24h={n.prevVelocity24h} peakMomentum={n.peakMomentum} firstSeenAt={n.firstSeenAt} />}
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

                  {/* Items */}
                  {isExpanded
                    ? renderExpandedItems(n)
                    : (
                      <div className="cluster-card-items">
                        {n.topItems.map((item, i) => renderItemRow(item, i, n.id))}
                      </div>
                    )
                  }

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
