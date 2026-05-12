"use client";

import { useEffect, useState } from "react";
import { PlatformChip, EntityBadge, Field } from "@/components/primitives";

type Entity = { id: string; label: string; entityType: string };

const emptyForm = {
  url: "",
  title: "",
  body: "",
  author: "",
  publishedAt: "",
  entityId: "none",
};

export default function SubmitPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then(setEntities);
  }, []);

  const handleFetch = async () => {
    if (!form.url) return;
    setFetchingMeta(true);
    try {
      const res = await fetch(`/api/meta?url=${encodeURIComponent(form.url)}`);
      if (res.ok) {
        const data = await res.json();
        setForm((f) => ({
          ...f,
          title: data.title ?? f.title,
          author: data.author ?? f.author,
        }));
      }
    } catch { /* best-effort */ }
    setFetchingMeta(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/items/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        entityId: form.entityId === "none" ? undefined : form.entityId,
      }),
    });
    if (res.ok) {
      setDone(true);
      setForm(emptyForm);
    } else {
      setError("Failed to submit. Check required fields.");
    }
    setSaving(false);
  };

  const previewEntity = entities.find((e) => e.id === form.entityId);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Part 1 · Ingestion</div>
          <h1 className="page-title">Manual submission</h1>
          <p className="page-desc">Paste a URL or write up something the crawlers missed.</p>
        </div>
      </header>

      <div className="page">
        <div className="submit-grid">
          <form className="submit-form" onSubmit={handleSubmit}>
            <div className="form-stack">
              <Field
                label="URL"
                hint="Paste an article URL — we'll try to auto-fetch the title and author."
                full
              >
                <div className="ipt-wrap">
                  <input
                    className="ipt mono"
                    placeholder="https://…"
                    value={form.url}
                    onChange={(e) => set("url", e.target.value)}
                    type="url"
                  />
                  <button
                    type="button"
                    className="ipt-action"
                    onClick={handleFetch}
                    disabled={!form.url || fetchingMeta}
                  >
                    {fetchingMeta ? "Fetching…" : "Fetch metadata"}
                  </button>
                </div>
              </Field>

              <Field
                label="Title"
                hint="Required. The headline you'd file this under."
                full
              >
                <input
                  className="ipt"
                  placeholder="Article or post title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  required
                />
              </Field>

              <Field
                label="Summary / body"
                hint="Paste the key passage, or your own write-up."
                full
              >
                <textarea
                  className="ipt ipt-area"
                  rows={6}
                  placeholder="Paste the key content or write a summary…"
                  value={form.body}
                  onChange={(e) => set("body", e.target.value)}
                />
              </Field>

              <div className="form-row">
                <Field label="Author / handle" hint="Byline or @handle">
                  <input
                    className="ipt"
                    placeholder="@author or Author Name"
                    value={form.author}
                    onChange={(e) => set("author", e.target.value)}
                  />
                </Field>
                <Field label="Published date" hint="ISO date">
                  <input
                    className="ipt mono"
                    type="date"
                    value={form.publishedAt}
                    onChange={(e) => set("publishedAt", e.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Link to tracked entity"
                hint="Routes this item into that entity's stream. Optional but recommended."
                full
              >
                <select
                  className="ipt"
                  value={form.entityId}
                  onChange={(e) => set("entityId", e.target.value)}
                >
                  <option value="none">— None —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </Field>

              <div className="form-foot">
                <div className="form-foot-meta">
                  <PlatformChip platform="manual" />
                  <span className="dim">Will appear in feed tagged Manual</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setForm(emptyForm); setDone(false); }}
                  >
                    Clear
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Submitting…" : "Submit to feed"}
                  </button>
                </div>
              </div>

              {done && (
                <div className="banner banner-ok">
                  <span style={{ fontSize: 12 }}>✓</span>
                  Saved.{" "}
                  <a href="/" className="ulink">View in feed →</a>
                </div>
              )}
              {error && (
                <div className="banner" style={{ background: "oklch(0.96 0.05 25)", color: "var(--err)", border: "1px solid oklch(0.86 0.10 25)" }}>
                  {error}
                </div>
              )}
            </div>
          </form>

          <aside className="submit-side">
            <div className="side-card">
              <div className="side-card-title">When to submit manually</div>
              <ul className="side-list">
                <li>An article behind a paywall the crawler can't reach.</li>
                <li>A LinkedIn post — no LinkedIn collector yet.</li>
                <li>A podcast episode, conference talk, or video.</li>
                <li>Anything sent to you directly (email, DM) worth tracking.</li>
              </ul>
            </div>

            <div className="side-card">
              <div className="side-card-title">Live preview</div>
              <article className="feedrow feedrow-medium feedrow-preview">
                <div className="feedrow-rail" />
                <div className="feedrow-left">
                  <PlatformChip platform="manual" />
                  <div className="feedrow-time">now</div>
                </div>
                <div className="feedrow-body">
                  <div className="feedrow-head">
                    <h3 className="feedrow-title">
                      {form.title || <span className="dim">Title appears here…</span>}
                    </h3>
                  </div>
                  <p className="feedrow-snippet">
                    {form.body ? (
                      form.body.slice(0, 180) + (form.body.length > 180 ? "…" : "")
                    ) : (
                      <span className="dim">Snippet preview will render here as you type.</span>
                    )}
                  </p>
                  <div className="feedrow-meta">
                    {form.author && <span className="meta-mono">{form.author}</span>}
                    {previewEntity && (
                      <EntityBadge label={previewEntity.label} type={previewEntity.entityType} />
                    )}
                  </div>
                </div>
              </article>
            </div>

            <div className="side-card side-card-tip">
              <div className="side-card-title">Tip — URL parsing</div>
              <div className="side-card-body">
                We use <code className="codepill">/api/meta</code> to extract{" "}
                <code className="codepill">og:title</code> and{" "}
                <code className="codepill">author</code>. If a site blocks scraping, paste the
                text by hand — manual items get the same treatment in clustering.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
