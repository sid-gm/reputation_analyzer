"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type EnvStatus = {
  hackernews: boolean;
  reddit: boolean;
  twitter: boolean;
};

type Entity = {
  id: string;
  label: string;
  entityType: string;
  googleAlertsFeedUrl: string | null;
};

const SOURCES = [
  {
    key: "hackernews",
    name: "HackerNews",
    description: "Algolia HN search API — free, no credentials required.",
    envKey: null,
    color: "bg-orange-50 border-orange-200",
  },
  {
    key: "reddit",
    name: "Reddit",
    description: "Reddit OAuth2 search. Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.",
    envKey: "reddit",
    color: "bg-red-50 border-red-200",
  },
  {
    key: "twitter",
    name: "X / Twitter",
    description: "Twitter API v2 recent search. Requires TWITTER_BEARER_TOKEN.",
    envKey: "twitter",
    color: "bg-sky-50 border-sky-200",
  },
  {
    key: "google_alerts",
    name: "Google Alerts",
    description: "Parses RSS feeds you configure in Google Alerts. Set feed URLs on tracked entities.",
    envKey: null,
    color: "bg-blue-50 border-blue-200",
  },
  {
    key: "manual",
    name: "Manual Submission",
    description: "Analyst submits articles directly via the Submit page. Always active.",
    envKey: null,
    color: "bg-gray-50 border-gray-200",
  },
];

export default function SourcesPage() {
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    fetch("/api/sources/status")
      .then((r) => r.json())
      .then(setEnvStatus)
      .catch(() => {});
    fetch("/api/entities")
      .then((r) => r.json())
      .then(setEntities);
  }, []);

  const alertEntities = entities.filter((e) => e.googleAlertsFeedUrl);

  const isConnected = (key: string) => {
    if (key === "hackernews" || key === "manual") return true;
    if (key === "google_alerts") return alertEntities.length > 0;
    if (key === "reddit") return envStatus?.reddit ?? false;
    if (key === "twitter") return envStatus?.twitter ?? false;
    return false;
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Sources</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Platform status and configuration. Set API credentials as environment variables. Each cron job runs hourly and polls all tracked entities.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((source) => {
          const connected = isConnected(source.key);
          return (
            <Card key={source.key} className={`border ${source.color}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{source.name}</CardTitle>
                  <Badge
                    variant={connected ? "default" : "secondary"}
                    className={connected ? "bg-green-600 text-white" : ""}
                  >
                    {connected ? "Active" : "Not configured"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{source.description}</p>
                {source.key === "google_alerts" && alertEntities.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {alertEntities.map((e) => (
                      <li key={e.id} className="text-xs font-mono truncate">· {e.label}</li>
                    ))}
                  </ul>
                )}
                {source.envKey === "reddit" && !envStatus?.reddit && (
                  <p className="mt-2 text-xs font-mono">
                    Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET
                  </p>
                )}
                {source.envKey === "twitter" && !envStatus?.twitter && (
                  <p className="mt-2 text-xs font-mono">
                    Set TWITTER_BEARER_TOKEN
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 p-4 rounded-lg bg-muted/50 text-sm">
        <p className="font-medium mb-1">Cron schedule</p>
        <p className="text-muted-foreground text-xs">All collectors run hourly at minute 0. Vercel Cron calls each <code className="font-mono">/api/cron/[platform]</code> endpoint with your <code className="font-mono">CRON_SECRET</code>.</p>
      </div>
    </div>
  );
}
