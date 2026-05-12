"use client";

import { useEffect, useState } from "react";
import { cx, Dot, PlatformChip, Sparkline } from "@/components/primitives";

type EnvStatus = { hackernews: boolean; reddit: boolean; twitter: boolean };

type SourceDef = {
  key: string;
  name: string;
  desc: string;
  requiresEnv: string[];
  note?: string;
};

const SOURCE_DEFS: SourceDef[] = [
  {
    key: "hackernews",
    name: "HackerNews",
    desc: "Algolia HN search API — free, no credentials required. Searches stories and comments across all of HN.",
    requiresEnv: [],
  },
  {
    key: "reddit",
    name: "Reddit",
    desc: "OAuth2 client credentials flow, searches across all subreddits. Returns posts sorted by new.",
    requiresEnv: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
  },
  {
    key: "twitter",
    name: "X / Twitter",
    desc: "Twitter API v2 recent search. Supports boolean queries and from: handle syntax for executives.",
    requiresEnv: ["TWITTER_BEARER_TOKEN"],
    note: "Basic tier ($100/mo) recommended for useful volume. Free tier is heavily rate-limited.",
  },
  {
    key: "google_alerts",
    name: "Google Alerts",
    desc: "Parses RSS feeds you configure in Google Alerts. Add a feed URL to each tracked entity in the Track page.",
    requiresEnv: [],
  },
  {
    key: "manual",
    name: "Manual",
    desc: "Analyst submits articles directly via the Submit page. Always active — no configuration needed.",
    requiresEnv: [],
  },
];

function pseudoSpark(seed: number): number[] {
  return Array.from({ length: 24 }, (_, i) =>
    Math.abs(Math.sin(i * 0.4 + seed) * 30 + 15)
  );
}

export default function SourcesPage() {
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [pollStatus, setPollStatus] = useState<Record<string, "idle" | "polling" | { inserted: number } | "error">>({});

  useEffect(() => {
    fetch("/api/sources/status").then((r) => r.json()).then(setEnvStatus);
    fetch("/api/entities")
      .then((r) => r.json())
      .then((entities: { googleAlertsFeedUrl: string | null }[]) =>
        setAlertCount(entities.filter((e) => e.googleAlertsFeedUrl).length)
      );
  }, []);

  const isConnected = (key: string) => {
    if (key === "hackernews" || key === "manual") return "active";
    if (key === "google_alerts") return alertCount > 0 ? "active" : "offline";
    if (key === "reddit")
      return envStatus?.reddit ? "active" : "offline";
    if (key === "twitter")
      return envStatus?.twitter ? "active" : "offline";
    return "offline";
  };

  async function pollGoogleAlerts() {
    setPollStatus((s) => ({ ...s, google_alerts: "polling" }));
    try {
      const res = await fetch("/api/sources/poll/google-alerts", { method: "POST" });
      const data = await res.json();
      setPollStatus((s) => ({ ...s, google_alerts: { inserted: data.inserted ?? 0 } }));
    } catch {
      setPollStatus((s) => ({ ...s, google_alerts: "error" }));
    }
  }

  const now = new Date();
  const nextPollMin = 60 - now.getMinutes();

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 1 · Ingestion</div>
          <h1 className="page-title">Sources</h1>
          <p className="page-desc">Platform health, polling cadence and credentials.</p>
        </div>
        <div className="topbar-actions">
          <div className="seg">
            {["1h", "24h", "7d"].map((r) => (
              <button key={r} className="seg-btn">{r}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="page">
        <div className="src-grid">
          {SOURCE_DEFS.map((s, idx) => {
            const status = isConnected(s.key) as "active" | "degraded" | "offline";
            const tone = status === "active" ? "ok" : status === "degraded" ? "warn" : "err";
            const spark = pseudoSpark(idx + 1);
            return (
              <div key={s.key} className={cx("scard", `scard-${tone}`)}>
                <div className="scard-head">
                  <div className="scard-id">
                    <PlatformChip platform={s.key} size="lg" />
                  </div>
                  <div className={cx("status-pill", `status-${tone}`)}>
                    <Dot color={`var(--${tone})`} pulse={tone === "ok"} />
                    {status === "active" ? "Active" : (status as string) === "degraded" ? "Degraded" : "Not configured"}
                  </div>
                </div>

                <h3 className="scard-name">{s.name}</h3>
                <p className="scard-desc">{s.desc}</p>

                {s.note && (
                  <div className="scard-note">
                    <span className="scard-note-mark">!</span>
                    <span>{s.note}</span>
                  </div>
                )}

                <div className="scard-stats">
                  <div>
                    <div className="scard-stat-label">Today</div>
                    <div className="scard-stat-value">—</div>
                  </div>
                  <div>
                    <div className="scard-stat-label">7 days</div>
                    <div className="scard-stat-value">—</div>
                  </div>
                  <div>
                    <div className="scard-stat-label">Latency</div>
                    <div className="scard-stat-value mono">—</div>
                  </div>
                  <div>
                    <div className="scard-stat-label">Last poll</div>
                    <div className="scard-stat-value mono">—</div>
                  </div>
                </div>

                <div className="scard-spark">
                  <Sparkline
                    values={spark}
                    color={`var(--${tone})`}
                    height={32}
                    fill
                  />
                  <span className="scard-spark-hint">24h ingest</span>
                </div>

                {s.requiresEnv.length > 0 && (
                  <div className="scard-env">
                    <div className="scard-env-label">Required env</div>
                    <div className="scard-env-list">
                      {s.requiresEnv.map((v) => (
                        <code key={v} className="codepill">
                          <span
                            className={cx(
                              "env-dot",
                              tone === "ok" ? "env-dot-ok" : "env-dot-err"
                            )}
                          />
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {s.key === "google_alerts" && (
                  <div className="scard-env">
                    <div className="scard-env-label">RSS feeds configured</div>
                    <div style={{ fontSize: 13, color: "var(--ink-80)" }}>
                      {alertCount > 0 ? (
                        <span style={{ color: "var(--ok)" }}>{alertCount} entity {alertCount === 1 ? "feed" : "feeds"} active</span>
                      ) : (
                        <span className="dim">None — add a feed URL to a tracked entity</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="scard-foot">
                  {s.key === "google_alerts" ? (() => {
                    const ps = pollStatus["google_alerts"] ?? "idle";
                    const polling = ps === "polling";
                    const label = ps === "polling"
                      ? "Polling…"
                      : ps === "error"
                      ? "Error"
                      : typeof ps === "object"
                      ? ps.inserted > 0 ? `✓ ${ps.inserted} new` : "✓ Up to date"
                      : "↻ Poll now";
                    return (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={pollGoogleAlerts}
                        disabled={polling}
                      >
                        {label}
                      </button>
                    );
                  })() : (
                    <button className="btn btn-ghost btn-sm">↻ Poll now</button>
                  )}
                  <button className="btn btn-ghost btn-sm">View logs</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cron-panel">
          <div className="cron-head">
            <div>
              <div className="cron-title">Cron schedule</div>
              <div className="cron-sub">
                All collectors run hourly at minute 0. Vercel Cron hits{" "}
                <code className="codepill">/api/cron/[platform]</code> with the{" "}
                <code className="codepill">CRON_SECRET</code> header.
              </div>
            </div>
            <div className="cron-next">
              <div className="cron-next-label">Next run in</div>
              <div className="cron-next-time">{nextPollMin}m</div>
            </div>
          </div>

          <div className="cron-strip">
            {Array.from({ length: 24 }).map((_, i) => {
              const hour = (now.getHours() + 1 - 24 + i + 24) % 24;
              const status = i === 23 ? "next" : i > 20 && Math.random() < 0.2 ? "warn" : "ok";
              return (
                <div
                  key={i}
                  className={cx("cron-tick", `cron-tick-${status}`)}
                  title={`${hour.toString().padStart(2, "0")}:00 — ${status}`}
                >
                  <span className="cron-tick-bar" />
                  {i % 6 === 0 && (
                    <span className="cron-tick-label">
                      {hour.toString().padStart(2, "0")}:00
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="cron-legend">
            <span><Dot color="var(--ok)" /> Successful poll</span>
            <span><Dot color="var(--warn)" /> Partial / rate-limited</span>
            <span><Dot color="var(--err)" /> Failed</span>
            <span><Dot color="var(--ink-40)" /> Scheduled</span>
          </div>
        </div>
      </div>
    </>
  );
}
