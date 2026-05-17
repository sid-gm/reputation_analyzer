"use client";

import { useEffect, useState } from "react";
import { Sparkline } from "@/components/primitives";

const STAGE_COLORS: Record<string, string> = {
  emerging:   "var(--ok)",
  developing: "var(--accent)",
  peaked:     "var(--warn)",
  declining:  "var(--err)",
  relaxed:    "var(--ink-40)",
};

function fillHourlySeries(
  sparse: { hour: string; count: number }[],
  hours: number
): number[] {
  const map = new Map(sparse.map((r) => [r.hour, r.count]));
  const now = Date.now();
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(now - (hours - 1 - i) * 3600000);
    // Floor to hour
    t.setMinutes(0, 0, 0);
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} ${String(t.getHours()).padStart(2, "0")}:00`;
    return map.get(key) ?? 0;
  });
}

export function VelocitySparkline({
  clusterId,
  stage,
  hours = 24,
}: {
  clusterId: string;
  stage: string | null;
  hours?: number;
}) {
  const [series, setSeries] = useState<number[] | null>(null);

  useEffect(() => {
    fetch(`/api/clusters/${clusterId}/velocity-history?hours=${hours}`)
      .then((r) => r.json())
      .then((d) => setSeries(fillHourlySeries(d.series ?? [], hours)))
      .catch(() => setSeries(null));
  }, [clusterId, hours]);

  if (series === null) {
    return <div style={{ width: 120, height: 26, opacity: 0 }} />;
  }

  const hasData = series.some((v) => v > 0);
  if (!hasData) return null;

  const color = STAGE_COLORS[stage ?? ""] ?? "var(--ink-40)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
      <Sparkline values={series} color={color} fill height={26} />
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        color,
        opacity: 0.6,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}>
        {hours}H
      </span>
    </div>
  );
}
