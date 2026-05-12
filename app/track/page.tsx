"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Entity = {
  id: string;
  label: string;
  queryString: string;
  entityType: "keyword" | "executive" | "product";
  googleAlertsFeedUrl: string | null;
  createdAt: string;
};

const TYPE_LABELS = { keyword: "Keyword", executive: "Executive", product: "Product" };
const TYPE_COLORS = {
  keyword: "bg-purple-100 text-purple-800",
  executive: "bg-green-100 text-green-800",
  product: "bg-yellow-100 text-yellow-800",
};

const emptyForm = {
  label: "",
  queryString: "",
  entityType: "keyword" as Entity["entityType"],
  googleAlertsFeedUrl: "",
};

export default function TrackPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/entities")
      .then((r) => r.json())
      .then(setEntities);

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(emptyForm);
      await load();
    } else {
      setError("Failed to save. Check your inputs.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tracked entity?")) return;
    await fetch(`/api/entities/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Tracked Entities</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Label</label>
          <Input
            placeholder="e.g. Sam Altman"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Search query</label>
          <Input
            placeholder='e.g. "Sam Altman" OR from:sama'
            value={form.queryString}
            onChange={(e) => setForm((f) => ({ ...f, queryString: e.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <Select
            value={form.entityType}
            onValueChange={(v) => setForm((f) => ({ ...f, entityType: (v ?? "keyword") as Entity["entityType"] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keyword">Keyword</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
              <SelectItem value="product">Product</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Google Alerts RSS (optional)</label>
          <Input
            placeholder="https://google.com/alerts/feeds/…"
            value={form.googleAlertsFeedUrl}
            onChange={(e) => setForm((f) => ({ ...f, googleAlertsFeedUrl: e.target.value }))}
          />
        </div>
        <div className="lg:col-span-4 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add Entity"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {entities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entities tracked yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Search Query</TableHead>
              <TableHead>Google Alerts</TableHead>
              <TableHead>Added</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.label}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[e.entityType]}`}>
                    {TYPE_LABELS[e.entityType]}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground max-w-48 truncate">
                  {e.queryString}
                </TableCell>
                <TableCell>
                  {e.googleAlertsFeedUrl ? (
                    <Badge variant="outline" className="text-xs">RSS set</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(e.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
