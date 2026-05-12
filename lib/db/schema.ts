import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const entityTypeEnum = pgEnum("entity_type", [
  "keyword",
  "executive",
  "product",
]);

export const platformEnum = pgEnum("platform", [
  "hackernews",
  "reddit",
  "twitter",
  "google_alerts",
  "manual",
]);

export const trackedEntities = pgTable("tracked_entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  queryString: text("query_string").notNull(),
  entityType: entityTypeEnum("entity_type").notNull(),
  // For Google Alerts: store the RSS feed URL here
  googleAlertsFeedUrl: text("google_alerts_feed_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ingestedItems = pgTable(
  "ingested_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityId: uuid("entity_id").references(() => trackedEntities.id, {
      onDelete: "set null",
    }),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id"),
    url: text("url"),
    title: text("title"),
    body: text("body"),
    author: text("author"),
    publishedAt: timestamp("published_at"),
    rawJson: jsonb("raw_json"),
    subtype: text("subtype"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("platform_external_id_unique").on(t.platform, t.externalId)]
);

export type TrackedEntity = typeof trackedEntities.$inferSelect;
export type NewTrackedEntity = typeof trackedEntities.$inferInsert;
export type IngestedItem = typeof ingestedItems.$inferSelect;
export type NewIngestedItem = typeof ingestedItems.$inferInsert;
