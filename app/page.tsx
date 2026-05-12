"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FeedItem = {
  id: string;
  entityId: string | null;
  entityLabel: string | null;
  platform: string;
  url: string | null;
  title: string | null;
  body: string | null;
  author: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type Entity = { id: string; label: string };

const PLATFORM_COLORS: Record<string, string> = {
  hackernews: "bg-orange-100 text-orange-800",
  reddit: "bg-red-100 text-red-800",
  twitter: "bg-sky-100 text-sky-800",
  google_alerts: "bg-blue-100 text-blue-800",
  manual: "bg-gray-100 text-gray-800",
};

const PLATFORM_LABELS: Record<string, string> = {
  hackernews: "HackerNews",
  reddit: "Reddit",
  twitter: "X / Twitter",
  google_alerts: "Google Alerts",
  manual: "Manual",
};

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [platform, setPlatform] = useState("all");
  const [entityId, setEntityId] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (platform !== "all") params.set("platform", platform);
    if (entityId !== "all") params.set("entityId", entityId);
    const res = await fetch(`/api/items?${params}`);
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, [platform, entityId]);

  useEffect(() => {
    fetch("/api/entities")
      .then((r) => r.json())
      .then(setEntities);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Raw Feed</h1>
        <div className="flex gap-3">
          <Select value={platform} onValueChange={(v) => setPlatform(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {Object.entries(PLATFORM_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={entityId} onValueChange={(v) => setEntityId(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No items yet. Configure sources in{" "}
          <a href="/track" className="underline">Track</a> and run a cron poll, or{" "}
          <a href="/submit" className="underline">submit manually</a>.
        </p>
      ) : (
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.id} className="py-4">
              <div className="flex items-start gap-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${
                    PLATFORM_COLORS[item.platform] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {PLATFORM_LABELS[item.platform] ?? item.platform}
                </span>
                <div className="flex-1 min-w-0">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:underline leading-snug block"
                    >
                      {item.title ?? item.body?.slice(0, 120) ?? "(no title)"}
                    </a>
                  ) : (
                    <p className="font-medium text-sm leading-snug">
                      {item.title ?? item.body?.slice(0, 120) ?? "(no title)"}
                    </p>
                  )}
                  {item.body && item.title && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.body}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {item.author && <span>{item.author}</span>}
                    {item.publishedAt && (
                      <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                    )}
                    {item.entityLabel && (
                      <Badge variant="outline" className="text-xs h-4 px-1.5">
                        {item.entityLabel}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
