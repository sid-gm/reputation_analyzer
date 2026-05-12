"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [saving, setSaving] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/entities")
      .then((r) => r.json())
      .then(setEntities);
  }, []);

  const handleUrlBlur = async () => {
    if (!form.url || form.title) return;
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
    } catch {
      // meta fetch is best-effort
    }
    setFetchingMeta(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const payload = {
      ...form,
      entityId: form.entityId === "none" ? undefined : form.entityId,
    };

    const res = await fetch("/api/items/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setForm(emptyForm);
      setSuccess(true);
    } else {
      setError("Failed to submit. Check required fields.");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-2">Manual Submission</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Submit an article, post, or piece of content you found manually. It will appear in the feed tagged as <span className="font-medium">Manual</span>.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">URL</label>
          <Input
            type="url"
            placeholder="https://…"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            onBlur={handleUrlBlur}
          />
          {fetchingMeta && (
            <p className="text-xs text-muted-foreground">Fetching metadata…</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="Article or post title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Summary / Body</label>
          <Textarea
            placeholder="Paste the key content or a summary…"
            rows={4}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Author</label>
            <Input
              placeholder="Author or handle"
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Published date</label>
            <Input
              type="date"
              value={form.publishedAt}
              onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Link to tracked entity (optional)
          </label>
          <Select
            value={form.entityId}
            onValueChange={(v) => setForm((f) => ({ ...f, entityId: v ?? "none" }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Submitting…" : "Submit"}
          </Button>
          {success && (
            <p className="text-sm text-green-600">Submitted — visible in the <a href="/" className="underline">feed</a>.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>
    </div>
  );
}
