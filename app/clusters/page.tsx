"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cx, PlatformChip, Dot } from "@/components/primitives";

// ─── Types ───────────────────────────────────────────────────────────────────

type MergeInfo = {
  absorbedLabel: string | null;
  absorbedFirstSeenAt: string;
  absorbedLastSeenAt: string;
  absorbedItemCount: number;
  mergedAt: string;
};

type ClusterItem = {
  clusterId: string;
  itemId: string;
  similarity: number;
  itemSignal: string;
  analystSignal: string | null;
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

type Stats = { total: number; avgSize: string; itemsClustered: number; totalItems: number };
type Entity = { id: string; label: string };
type Point = { x: number; y: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanTitle(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .trim() || null;
}

function simColor(sim: number) {
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function ClassificationPill({ classification }: { classification: string }) {
  const styles: Record<string, { label: string; color: string }> = {
    narrative:    { label: "NARRATIVE",    color: "var(--accent)" },
    noise:        { label: "NOISE",        color: "var(--ink-30)" },
    unclassified: { label: "UNCLASSIFIED", color: "var(--ink-20)" },
  };
  const s = styles[classification] ?? styles.unclassified;
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: s.color, border: `1px solid ${s.color}`, borderRadius: 3, padding: "1px 5px", lineHeight: 1.4 }}>
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
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: s.color, background: s.bg, borderRadius: 3, padding: "1px 5px", lineHeight: 1.4 }}>
      {s.label}
    </span>
  );
}

function SignalDot({ signal }: { signal: string }) {
  const color = signal === "signal" ? "var(--ok)" : signal === "watch" ? "var(--accent)" : signal === "noise" ? "var(--ink-20)" : "var(--ink-10)";
  return <Dot color={color} size={7} />;
}

function OverrideMenu({ clusterId, current, onDone }: { clusterId: string; current: string | null; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const apply = async (val: "narrative" | "noise" | null) => {
    setBusy(true);
    await fetch(`/api/clusters/${clusterId}/classify`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classification: val }) });
    setBusy(false); setOpen(false); onDone();
  };
  return (
    <div style={{ position: "relative" }}>
      <button className="btn-ghost" style={{ fontSize: 14, padding: "0 6px", lineHeight: 1 }} onClick={() => setOpen((v) => !v)} disabled={busy} title="Analyst override">⋯</button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 100, background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 160, padding: "4px 0" }}>
          <div style={{ padding: "4px 12px 2px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-30)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Analyst override</div>
          {current !== "narrative" && <button className="dropdown-item" onClick={() => apply("narrative")}>Mark as Narrative</button>}
          {current !== "noise"     && <button className="dropdown-item" onClick={() => apply("noise")}>Mark as Noise</button>}
          {current !== null        && <button className="dropdown-item" style={{ color: "var(--ink-40)" }} onClick={() => apply(null)}>Reset override</button>}
          <button className="dropdown-item" onClick={() => setOpen(false)} style={{ color: "var(--ink-30)" }}>Cancel</button>
        </div>
      )}
    </div>
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

// ─── Merge Modal ─────────────────────────────────────────────────────────────

type MergeModalState = {
  selected: Cluster[];
  label: string;
  classification: string | null;
  hasConflict: boolean;
};

function MergeModal({
  state,
  onChange,
  onConfirm,
  onCancel,
  busy,
}: {
  state: MergeModalState;
  onChange: (patch: Partial<MergeModalState>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const classOptions: Array<{ value: string; label: string }> = [
    { value: "narrative",    label: "Narrative" },
    { value: "noise",        label: "Noise" },
    { value: "unclassified", label: "Unclassified" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: 480, maxWidth: "90vw", padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          Merge {state.selected.length} clusters
        </div>

        {/* Selected clusters summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, background: "var(--ink-05, color-mix(in oklch, var(--ink) 4%, var(--paper)))", borderRadius: 6, padding: "10px 12px" }}>
          {state.selected.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <ClassificationPill classification={c.effectiveClassification} />
              <span style={{ flex: 1, fontWeight: 500 }}>{c.label ?? <em style={{ color: "var(--ink-40)", fontWeight: 400 }}>Unnamed</em>}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-40)" }}>{c.itemCount} items</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-30)" }}>
                {shortDate(c.firstSeenAt)} → {relativeTime(c.lastSeenAt)}
              </span>
            </div>
          ))}
        </div>

        {/* Label */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5, color: "var(--ink-60)" }}>Cluster name</div>
          <input
            value={state.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Cluster name (optional)"
            style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 5, background: "var(--paper)", color: "var(--ink-80)", boxSizing: "border-box" }}
          />
        </div>

        {/* Classification */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--ink-60)", display: "flex", alignItems: "center", gap: 6 }}>
            Classification
            {state.hasConflict && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--warn)", border: "1px solid var(--warn)", borderRadius: 3, padding: "1px 5px" }}>CONFLICT</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {classOptions.map((opt) => (
              <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer", padding: "5px 10px", borderRadius: 5, border: `1px solid ${state.classification === opt.value ? "var(--accent)" : "var(--border)"}`, background: state.classification === opt.value ? "color-mix(in oklch, var(--accent) 8%, var(--paper))" : "transparent" }}>
                <input type="radio" name="merge-class" value={opt.value} checked={state.classification === opt.value} onChange={() => onChange({ classification: opt.value })} style={{ accentColor: "var(--accent)" }} />
                {opt.label}
              </label>
            ))}
          </div>
          {state.hasConflict && !state.classification && (
            <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 5 }}>Please choose a classification to continue.</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-ghost btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn"
            style={{ background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }}
            onClick={onConfirm}
            disabled={!state.classification || busy}
          >
            {busy ? "Merging…" : `Merge ${state.selected.length} clusters`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClustersPage() {
  const [clusterList, setClusterList] = useState<Cluster[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityId, setEntityId] = useState("all");
  const [sort, setSort] = useState("activity");
  const [hideSingletons, setHideSingletons] = useState(false);
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [clusterRunning, setClusterRunning] = useState(false);
  const [clusterResult, setClusterResult] = useState<string | null>(null);
  const [classifyRunning, setClassifyRunning] = useState(false);
  const [classifyResult, setClassifyResult] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedData, setExpandedData] = useState<Record<string, ExpandedData>>({});
  const [expandLoading, setExpandLoading] = useState<Set<string>>(new Set());
  const [summaryExpanded, setSummaryExpanded] = useState<Set<string>>(new Set());

  // Merge mode
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lassoStart, setLassoStart] = useState<Point | null>(null);
  const [lassoEnd, setLassoEnd] = useState<Point | null>(null);
  const [mergeModal, setMergeModal] = useState<MergeModalState | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort, hideSingletons: String(hideSingletons), classification: classificationFilter, confidence: confidenceFilter });
    if (entityId !== "all") params.set("entityId", entityId);
    const res = await fetch(`/api/clusters?${params}`);
    const data = await res.json();
    setClusterList(data.clusters ?? []);
    setStats(data.stats ?? null);
    setLoading(false);
  }, [entityId, sort, hideSingletons, classificationFilter, confidenceFilter]);

  useEffect(() => { fetch("/api/entities").then((r) => r.json()).then(setEntities); }, []);
  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  // ── Lasso: global mousemove/mouseup listeners while dragging ────────────────
  useEffect(() => {
    if (!lassoStart) return;
    const onMove = (e: MouseEvent) => setLassoEnd({ x: e.clientX, y: e.clientY });
    const onUp = (e: MouseEvent) => {
      const end = { x: e.clientX, y: e.clientY };
      const delta = Math.abs(end.x - lassoStart.x) + Math.abs(end.y - lassoStart.y);
      if (delta < 5) {
        // Click — toggle the card under the cursor
        for (const [id, el] of cardRefs.current.entries()) {
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
            break;
          }
        }
      } else {
        // Lasso — find all cards that intersect the rect
        const selLeft = Math.min(lassoStart.x, end.x);
        const selTop = Math.min(lassoStart.y, end.y);
        const selRight = Math.max(lassoStart.x, end.x);
        const selBottom = Math.max(lassoStart.y, end.y);
        const intersecting = new Set<string>();
        for (const [id, el] of cardRefs.current.entries()) {
          const r = el.getBoundingClientRect();
          if (r.left < selRight && r.right > selLeft && r.top < selBottom && r.bottom > selTop) intersecting.add(id);
        }
        setSelectedIds(intersecting);
      }
      setLassoStart(null);
      setLassoEnd(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [lassoStart]);

  const handleGridMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mergeMode) return;
    if ((e.target as HTMLElement).closest("button, a, select, input")) return;
    e.preventDefault();
    setLassoStart({ x: e.clientX, y: e.clientY });
    setLassoEnd({ x: e.clientX, y: e.clientY });
  }, [mergeMode]);

  const toggleMergeMode = () => {
    setMergeMode((v) => !v);
    setSelectedIds(new Set());
    setLassoStart(null);
    setLassoEnd(null);
  };

  const openMergeModal = () => {
    const selected = clusterList.filter((c) => selectedIds.has(c.id));
    const bySize = [...selected].sort((a, b) => b.itemCount - a.itemCount);
    const defaultLabel = bySize.find((c) => c.label)?.label ?? "";
    const classSet = [...new Set(selected.map((c) => c.effectiveClassification))];
    const hasConflict = classSet.length > 1;
    setMergeModal({ selected, label: defaultLabel, classification: hasConflict ? null : (classSet[0] ?? null), hasConflict });
  };

  const confirmMerge = async () => {
    if (!mergeModal?.classification) return;
    setMergeBusy(true);
    try {
      await fetch("/api/clusters/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterIds: [...selectedIds], label: mergeModal.label || null, classification: mergeModal.classification }),
      });
      setMergeModal(null);
      setMergeMode(false);
      setSelectedIds(new Set());
      fetchClusters();
    } catch (err) {
      console.error("[merge]", err);
    } finally {
      setMergeBusy(false);
    }
  };

  const runCluster = useCallback(async () => {
    setClusterRunning(true); setClusterResult(null);
    try {
      const res = await fetch("/api/run/cluster", { method: "POST" });
      const data = await res.json();
      setClusterResult(data.assigned === 0 && data.created === 0 ? "nothing to cluster" : `${data.assigned} assigned · ${data.created} new clusters`);
      fetchClusters();
    } catch { setClusterResult("error — check console"); }
    finally { setClusterRunning(false); }
  }, [fetchClusters]);

  const runClassify = useCallback(async () => {
    setClassifyRunning(true); setClassifyResult(null);
    try {
      const res = await fetch("/api/run/classify", { method: "POST" });
      const data = await res.json();
      setClassifyResult(`${data.classified} classified · ${data.signalsTagged} signals tagged`);
      fetchClusters();
    } catch { setClassifyResult("error — check console"); }
    finally { setClassifyRunning(false); }
  }, [fetchClusters]);

  const toggleExpand = useCallback(async (clusterId: string) => {
    if (expandedIds.has(clusterId)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(clusterId); return s; });
      return;
    }
    if (!expandedData[clusterId]) {
      setExpandLoading((prev) => new Set(prev).add(clusterId));
      const res = await fetch(`/api/clusters/${clusterId}/items`);
      const data: ExpandedData = await res.json();
      setExpandedData((prev) => ({ ...prev, [clusterId]: data }));
      setExpandLoading((prev) => { const s = new Set(prev); s.delete(clusterId); return s; });
    }
    setExpandedIds((prev) => new Set(prev).add(clusterId));
  }, [expandedIds, expandedData]);

  const toggleSummary = (id: string) =>
    setSummaryExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── Render wave-grouped expanded items ──────────────────────────────────────
  function renderExpandedItems(cluster: Cluster) {
    const data = expandedData[cluster.id];
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
          <WaveHeader label={`Original · ${shortDate(cluster.firstSeenAt)}`} isFirst />
        )}
        {originalItems.map((item, i) => renderItemRow(item, i))}
        {mergeGroups.map(({ mergeId, merge, items: waveItems }, gi) => (
          <div key={mergeId}>
            <WaveHeader
              label={`Merged from "${merge.absorbedLabel ?? "Unnamed"}" · ${shortDate(merge.absorbedFirstSeenAt)} → ${shortDate(merge.absorbedLastSeenAt)} · ${merge.absorbedItemCount} items`}
              isFirst={!hasWaves || (originalItems.length === 0 && gi === 0)}
            />
            {waveItems.map((item, i) => renderItemRow(item, i))}
          </div>
        ))}
      </div>
    );
  }

  function renderItemRow(item: ClusterItem, i: number) {
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
  }

  const latestCluster = clusterList[0];
  const lassoRect = lassoStart && lassoEnd ? {
    left: Math.min(lassoStart.x, lassoEnd.x),
    top: Math.min(lassoStart.y, lassoEnd.y),
    width: Math.abs(lassoEnd.x - lassoStart.x),
    height: Math.abs(lassoEnd.y - lassoStart.y),
  } : null;

  return (
    <>
      {/* Lasso selection rect */}
      {lassoRect && lassoRect.width > 2 && lassoRect.height > 2 && (
        <div style={{ position: "fixed", zIndex: 9999, pointerEvents: "none", left: lassoRect.left, top: lassoRect.top, width: lassoRect.width, height: lassoRect.height, border: "1.5px dashed var(--accent)", background: "color-mix(in oklch, var(--accent) 8%, transparent)", borderRadius: 3 }} />
      )}

      {/* Merge confirmation modal */}
      {mergeModal && (
        <MergeModal
          state={mergeModal}
          onChange={(patch) => setMergeModal((prev) => prev ? { ...prev, ...patch } : null)}
          onConfirm={confirmMerge}
          onCancel={() => setMergeModal(null)}
          busy={mergeBusy}
        />
      )}

      <header className="topbar">
        <div>
          <div className="eyebrow">Part 2 · Clusters</div>
          <h1 className="page-title">Clusters</h1>
          <p className="page-desc">Topics grouped by semantic similarity. Classify to surface narratives.</p>
        </div>
        <div className="topbar-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn-ghost btn" onClick={toggleMergeMode} style={mergeMode ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}>
              {mergeMode ? "Exit Merge Mode" : "Select to Merge"}
            </button>
            <button className="btn-ghost btn" onClick={runCluster} disabled={clusterRunning}>{clusterRunning ? "Clustering…" : "Run Cluster"}</button>
            <button className="btn" onClick={runClassify} disabled={classifyRunning}>{classifyRunning ? "Classifying…" : "Run Classify"}</button>
            {(clusterResult || classifyResult) && (
              <span style={{ fontSize: 12, color: "var(--ink-40)", whiteSpace: "nowrap" }}>{classifyResult ?? clusterResult}</span>
            )}
          </div>
        </div>
      </header>

      <div className="page">
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Active clusters</div></div>
            <div className="kpi-mid"><div className="kpi-value">{stats?.total ?? "—"}</div><div className="kpi-delta kpi-delta-flat">→ topics found</div></div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Items clustered</div></div>
            <div className="kpi-mid"><div className="kpi-value">{stats?.itemsClustered ?? "—"}</div><div className="kpi-delta kpi-delta-flat">→ of {stats?.totalItems ?? "—"} total</div></div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Avg cluster size</div></div>
            <div className="kpi-mid"><div className="kpi-value">{stats?.avgSize ?? "—"}</div><div className="kpi-delta kpi-delta-flat">→ items / topic</div></div>
          </div>
          <div className="kpi">
            <div className="kpi-top"><div className="kpi-label">Latest activity</div></div>
            <div className="kpi-mid">
              <div className="kpi-value" style={{ fontSize: 15, fontWeight: 500, marginTop: 6, lineHeight: 1.3 }}>{latestCluster?.label ?? (latestCluster ? "Unnamed" : "—")}</div>
              <div className={cx("kpi-delta", latestCluster ? "kpi-delta-up" : "kpi-delta-flat")}>{latestCluster ? `▲ ${relativeTime(latestCluster.lastSeenAt)}` : "no clusters yet"}</div>
            </div>
          </div>
        </div>

        {mergeMode && (
          <div style={{ padding: "8px 12px", background: "color-mix(in oklch, var(--accent) 8%, var(--paper))", border: "1px solid color-mix(in oklch, var(--accent) 30%, transparent)", borderRadius: 6, fontSize: 13, color: "var(--ink-60)", marginBottom: 8 }}>
            <strong style={{ color: "var(--accent)" }}>Merge mode:</strong> click a card to select it, or drag to lasso-select multiple clusters.
          </div>
        )}

        <div className="toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="filter-group">
            <span className="filter-label">Entity</span>
            <select className="select" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="all">All entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
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
          <div className="empty"><div className="empty-mark">⧖</div><div className="empty-title">Loading clusters…</div></div>
        ) : clusterList.length === 0 ? (
          <div className="empty"><div className="empty-mark">◎</div><div className="empty-title">No clusters match filters</div><div className="empty-sub">Run cluster then classify to group and label topics.</div></div>
        ) : (
          <div
            className="cluster-grid"
            ref={gridRef}
            onMouseDown={handleGridMouseDown}
            style={{ cursor: mergeMode ? "crosshair" : undefined, userSelect: mergeMode ? "none" : undefined }}
          >
            {clusterList.map((cluster) => {
              const isSelected = selectedIds.has(cluster.id);
              const isExpanded = expandedIds.has(cluster.id);
              const displayItems = isExpanded ? (expandedData[cluster.id]?.items ?? cluster.topItems) : cluster.topItems;

              return (
                <div
                  key={cluster.id}
                  className="cluster-card"
                  ref={(el) => { if (el) cardRefs.current.set(cluster.id, el); else cardRefs.current.delete(cluster.id); }}
                  style={isSelected ? { outline: "2px solid var(--accent)", outlineOffset: 2 } : undefined}
                >
                  {/* Header */}
                  <div className="cluster-card-head" style={{ alignItems: "flex-start", gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <ClassificationPill classification={cluster.effectiveClassification} />
                        {cluster.narrativeStage && cluster.effectiveClassification === "narrative" && <StagePill stage={cluster.narrativeStage} />}
                        {cluster.classificationConfidence != null && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-30)" }}>{Math.round(cluster.classificationConfidence * 100)}% conf</span>
                        )}
                        {cluster.momentum != null && cluster.momentum > 0 && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-40)" }}>↑{cluster.momentum.toFixed(1)}/day</span>
                        )}
                      </div>
                      <span className="cluster-card-label">
                        {cluster.label ?? <span style={{ color: "var(--ink-40)", fontWeight: 400, fontStyle: "italic" }}>Unnamed cluster</span>}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span className="cluster-card-count">{cluster.itemCount} items</span>
                      {!mergeMode && <OverrideMenu clusterId={cluster.id} current={cluster.analystClassification} onDone={fetchClusters} />}
                    </div>
                  </div>

                  {cluster.analystClassification && (
                    <div style={{ fontSize: 11, color: "var(--ink-40)", fontStyle: "italic", marginBottom: 4, paddingLeft: 2 }}>
                      Analyst: marked as {cluster.analystClassification}{cluster.analystNote ? ` — ${cluster.analystNote}` : ""}
                    </div>
                  )}

                  <div className="cluster-card-meta">{shortDate(cluster.firstSeenAt)} → {relativeTime(cluster.lastSeenAt)}</div>

                  {/* Narrative summary */}
                  {cluster.narrativeSummary && cluster.effectiveClassification === "narrative" && (
                    <div style={{ marginBottom: 8 }}>
                      <button onClick={() => toggleSummary(cluster.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 0", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-40)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
                        {summaryExpanded.has(cluster.id) ? "▾" : "▸"} Summary
                      </button>
                      {summaryExpanded.has(cluster.id) && (
                        <p style={{ fontSize: 12, color: "var(--ink-60)", lineHeight: 1.5, margin: "4px 0 0", padding: "6px 8px", background: "color-mix(in oklch, var(--accent) 6%, var(--paper))", borderLeft: "2px solid var(--accent)", borderRadius: "0 4px 4px 0" }}>
                          {cluster.narrativeSummary}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Items */}
                  {isExpanded
                    ? renderExpandedItems(cluster)
                    : displayItems.length > 0 && (
                      <div className="cluster-card-items">
                        {displayItems.map((item, i) => renderItemRow(item, i))}
                      </div>
                    )
                  }

                  <div className="cluster-card-foot">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-40)" }}>sources</span>
                      {cluster.platforms.map((p) => <PlatformChip key={p} platform={p} size="sm" />)}
                    </div>
                    {cluster.itemCount > 3 && (
                      <button className="cluster-card-more" onClick={() => toggleExpand(cluster.id)}>
                        {expandLoading.has(cluster.id) ? "loading…" : isExpanded ? "show less" : `+ ${cluster.itemCount - 3} more`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating merge action bar */}
      {mergeMode && selectedIds.size >= 2 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 150, background: "var(--ink)", color: "var(--paper)", borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", fontSize: 14 }}>
          <span style={{ fontWeight: 500 }}>{selectedIds.size} clusters selected</span>
          <button onClick={openMergeModal} style={{ background: "var(--paper)", color: "var(--ink)", border: "none", borderRadius: 5, padding: "5px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Merge</button>
          <button onClick={() => setSelectedIds(new Set())} style={{ background: "transparent", color: "var(--ink-40)", border: "none", fontSize: 13, cursor: "pointer" }}>Clear</button>
        </div>
      )}
    </>
  );
}
