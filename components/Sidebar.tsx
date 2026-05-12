"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx, Dot } from "@/components/primitives";

const NAV = [
  { href: "/",         label: "Feed",     glyph: "≡" },
  { href: "/track",    label: "Track",    glyph: "◆" },
  { href: "/sources",  label: "Sources",  glyph: "◴" },
  { href: "/submit",   label: "Submit",   glyph: "✎" },
  { href: "/clusters", label: "Clusters", glyph: "◎" },
];

const SOON = [
  { label: "Classify", stage: "P3" },
  { label: "Analysis", stage: "P4" },
  { label: "Report",   stage: "P5" },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <span className="brand-mark-inner">RA</span>
        </div>
        <div className="brand-text">
          <div className="brand-title">Reputation Analyzer</div>
          <div className="brand-sub">Signal-to-noise · v0.1</div>
        </div>
      </div>

      <div className="company">
        <div className="company-name">Your Company</div>
        <div className="company-meta">
          <span className="kbd">—</span>
          <span>·</span>
          <span>Since 2026</span>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-section">Workflow</div>
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cx("nav-item", active && "nav-item-on")}
            >
              <span className="nav-glyph">{n.glyph}</span>
              <span className="nav-label">{n.label}</span>
            </Link>
          );
        })}

        <div className="nav-section" style={{ marginTop: 16 }}>
          Pipeline (locked)
        </div>
        {SOON.map((n) => (
          <div
            key={n.label}
            className="nav-item nav-item-soon"
            title={`Phase ${n.stage} — not yet built`}
          >
            <span className="nav-glyph">·</span>
            <span className="nav-label">{n.label}</span>
            <span className="nav-stage">{n.stage}</span>
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        <div className="sb-foot-row">
          <Dot color="var(--ok)" pulse />
          <span>Cron healthy · hourly</span>
        </div>
        <div className="sb-foot-row sb-foot-row-mono">
          <span className="kbd">⌘K</span>
          <span>Quick command</span>
        </div>
      </div>
    </aside>
  );
}
