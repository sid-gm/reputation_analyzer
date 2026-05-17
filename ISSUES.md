# SMA Tool — Issues & Feature Plan
_Generated: 2026-05-15_

---

## Priority Order

Issues ordered by: bug-first → quick wins → high-leverage features → heavy new features.

| # | Issue | Effort | Type |
|---|-------|--------|------|
| 1 | Fix HackerNews link to open HN, not source article | XS | Bug |
| 2 | Fix cluster classification pills (signal/watch/noise/unclassified + "move to narrative") | S | Fix |
| 3 | Bug: cluster `2205c87d` shows no stage/stats | S | Bug |
| 4 | Velocity indicators on Cluster Review | S | Feature |
| 5 | Sort clusters by "has recent activity but is not new" | M | Feature |
| 6 | Filter clusters by non-news platform (has reddit/twitter post) | S | Feature |
| 7 | Mark as Junk (bulk + single story) | M | Feature |
| 8 | Force-generate AI summaries per date inside expanded narrative | M | Feature |
| 9 | Sentiment extraction on Narratives, Signal/Watch, Noise | M | Feature |
| 10 | Bookmarks with analyst notes | L | Feature |
| 11 | Evolution & sentiment shift report (uses bookmarks) | L | Feature |
| 12 | Select multiple narratives → generate .md report | M | Feature |

---

## Detailed Approach

---

### Issue 1 — HackerNews: open HN discussion, not source article
**Priority: First — trivial, high analyst value.**

**Problem:**  
`lib/collectors/hackernews.ts` maps HN stories to `url: hit.url ?? https://news.ycombinator.com/item?id=...`.  
For stories with an external URL (e.g., NYT), the stored URL is the source article. The analyst expects to land on the HN thread.

**Fix:**  
The raw ingested `url` field should stay as-is (it's useful for dedup and context). The fix is in the **render layer** only.  

In `app/clusters/page.tsx` and `app/narratives/page.tsx`, wherever a `ClusterItem` link is rendered, check `item.platform === "hackernews"` and construct the HN link as:
```
https://news.ycombinator.com/item?id=${item.externalId}
```
`externalId` is already available in the cluster items query — just confirm it's included in the API response (`app/api/clusters/[id]/items/route.ts`). If not, add it to the select.

No DB change. No schema change. Two render-layer patches.

---

### Issue 2 — Cluster Review: fix classification options
**Priority: Second — currently misleading UX.**

**Problem:**  
The cluster classify API (`app/api/clusters/[id]/classify/route.ts`) already accepts `"narrative" | "noise" | "signal" | "watch" | null`.  
But the Cluster Review page UI only exposes `Narrative | Noise | Unclassified` as options, missing Signal and Watch.

**Fix:**  
Update the classification pill/button group in `app/clusters/page.tsx` to expose:
- **Signal** (`analystClassification = "signal"`)
- **Watch** (`analystClassification = "watch"`)
- **Noise** (`analystClassification = "noise"`)
- **Unclassified** (`analystClassification = null`)
- **Move to Narrative** (`analystClassification = "narrative"`)

"Move to Narrative" should be styled distinctly (e.g., outlined with an arrow icon) since it changes the effective page the cluster appears on, not just its label within Cluster Review.

No API change needed. UI-only patch in `app/clusters/page.tsx`.

---

### Issue 3 — Bug: cluster `2205c87d-469e-4c4f-8cb6-0da82f5882f7` shows no stage stats
**Priority: Third — blocking analyst trust in the system.**

**Investigation approach:**  
1. Query the cluster directly: check `narrativeStage`, `momentum`, `velocity24h`, `prevVelocity24h`, `peakMomentum` values.  
2. The `StagePill` component (in narratives page) renders nothing if all these are null. Check if the cron/run job that populates momentum/velocity skipped this cluster.
3. Check `clusterItems` count — if it was merged from another cluster (`clusterMerges`), confirm `itemCount` reflects the merged total.
4. Likely root cause: `velocity24h` and `prevVelocity24h` are `null` because the momentum cron (`app/api/cron/` or `app/api/run/`) didn't process it — possibly because its `firstSeenAt` is very old and the sliding window query excluded it, or it has no items after a recent merge cleaned up duplicates.

**Fix options (after investigation):**
- If the momentum cron uses a recency filter, remove or widen it so old ongoing stories get reprocessed.
- Force-recompute velocity for a single cluster: add a debug endpoint or use existing `/api/run` to re-trigger momentum calculation for this cluster ID.

---

### Issue 4 — Velocity indicators on Cluster Review
**Priority: After bugs — reuse is almost free.**

**Problem:**  
`app/narratives/page.tsx` already has a fully-built `StagePill` component with velocity rendering.  
`app/clusters/page.tsx` has the data (`velocity24h`, `prevVelocity24h`, `peakMomentum`, `narrativeStage`) on the `Cluster` type but doesn't render it.

**Fix:**  
Extract `StagePill` from `app/narratives/page.tsx` into `components/primitives.tsx` (or a new `components/StagePill.tsx`), then import and render it in `app/clusters/page.tsx` alongside the cluster card, the same way it appears on narrative cards.

The momentum value (`↑X/day`) display is also in the narratives page — bring that across too.

---

### Issue 5 — Sort: clusters with recent activity that are not new
**Priority: After velocity work, shares the sorting infrastructure.**

**New sort option: "Active Stories"**  
Formula: clusters where `lastSeenAt` is today (or within 24h) AND `firstSeenAt` is older than today.  
Order: by `(today - firstSeenAt)` descending — longest-running stories that are still active appear first.

**Implementation:**
1. Add `sort=active_stories` to `app/api/clusters/route.ts`. The query adds:
   - `WHERE last_seen_at >= NOW() - INTERVAL '24 hours'`
   - `AND first_seen_at < NOW() - INTERVAL '24 hours'`
   - `ORDER BY first_seen_at ASC` (oldest ongoing = highest value)
2. Add "Active Stories" to the sort dropdown in `app/clusters/page.tsx`.

---

### Issue 5.5 — Filter: clusters with non-news platform posts
**Priority: Pairs with Issue 5 — filter + sort work together.**

**New filter: "Has Online Discussion"**  
Means: the cluster contains at least one item from `reddit`, `twitter`, or another non-`hackernews`/non-`google_alerts` platform.

**Implementation:**
1. In `app/api/clusters/route.ts`, add a `hasDiscussion=true` query param.
2. When set, add a subquery/EXISTS clause:  
   ```sql
   EXISTS (
     SELECT 1 FROM cluster_items ci
     JOIN ingested_items ii ON ii.id = ci.item_id
     WHERE ci.cluster_id = clusters.id
     AND ii.platform IN ('reddit', 'twitter')
   )
   ```
3. Add a toggle/filter chip in `app/clusters/page.tsx`.

---

### Issue 6 — Mark as Junk
**Priority: High workflow value, self-contained.**

**Scope:**
- Bulk: analyst selects multiple clusters → "Mark as Junk" → clusters are soft-deleted (`archivedAt = NOW()`) with a `junk` flag.
- Single: individual story in the Feed page can be marked junk too.
- Hard-delete after 60 days: handled by a cron job.

**Schema change:**
Add `isJunk boolean default false` and ensure `archivedAt` is set on junk. Actually, can reuse `archivedAt` + add a `junkAt timestamp` column to distinguish junk from regular archive.

```sql
ALTER TABLE clusters ADD COLUMN junk_at TIMESTAMP;
```

**Implementation:**
1. Schema: add `junkAt` to `clusters` table in `lib/db/schema.ts` + migration.
2. API: `PATCH /api/clusters/[id]/classify` or new `POST /api/clusters/junk` (for bulk). Sets `junkAt = NOW()` and `archivedAt = NOW()`.
3. UI: checkbox multi-select on cluster cards in `app/clusters/page.tsx` + "Mark Junk" action bar at bottom. Confirm dialog.
4. Feed: single "Mark Junk" action on individual items — marks the `ingestedItem` (add `junkAt` to `ingestedItems` too, or just exclude from future clustering).
5. Cron: `app/api/cron/` — add a job that deletes clusters/items where `junk_at < NOW() - INTERVAL '60 days'`.

---

### Issue 7 — Force-generate AI summaries by date
**Priority: High analyst value, moderate effort.**

**Where:** Inside an expanded cluster/narrative card, per-date row that currently shows `periodNarrative`.

**UI:**
- Each date row that has no `aiNarrative` (or analyst wants a refresh) shows a "Generate Summary" button.
- Clicking it calls a new API endpoint with the cluster ID + date.

**API: `POST /api/clusters/[id]/period-narrative`**  
Already exists at `app/api/clusters/[id]/period-narrative/` — check if it has a generate-on-demand path. If not, add one:
1. Fetch all `clusterItems` for this cluster where `publishedAt::date = periodDate`.
2. Build a prompt: send `title` + `body` snippets to OpenAI.
3. Store result in `clusterPeriodNarratives.aiNarrative`.
4. Return to UI, replace the placeholder.

**Also need:** "Generate Overall Summary" button at the cluster level — summarizes all period narratives into one `narrativeSummary` on the cluster row.

---

### Issue 8 — Sentiment extraction on Narratives/Signal/Noise
**Priority: AI feature, moderate — can be done in batch via cron or on-demand.**

**Approach:**
- Per cluster (not per item), compute an overall sentiment from item titles using OpenAI: `positive | negative | mixed | neutral`.
- Store in a new column: `clusters.sentiment` (text enum).
- Display as a small pill on narrative/signal/noise cards.

**Schema:**
```sql
ALTER TABLE clusters ADD COLUMN sentiment TEXT; -- 'positive' | 'negative' | 'mixed' | 'neutral'
```

**Implementation:**
1. Schema + migration.
2. Batch cron: for all clusters with `itemCount > 2` and no sentiment, run title batch through OpenAI with a single call per cluster (send top 10 titles as a list, ask for sentiment).
3. On-demand: add a "Analyze Sentiment" button per card.
4. Render: pill on narrative/signal/noise cards. Green = positive, red = negative, yellow = mixed, gray = neutral.

---

### Issue 9 — Bookmarks with analyst notes
**Priority: Enables Issue 10 (reports), build first.**

**New table:**
```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  analyst_email TEXT NOT NULL,
  item_id UUID REFERENCES ingested_items(id),
  cluster_id UUID REFERENCES clusters(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**UI:**
- Bookmark icon on every `ClusterItem` row (in expanded cluster view, in narratives, signal/watch, noise pages).
- Clicking opens a small popover with a text area for notes and a Save button.
- Bookmarks list accessible from sidebar (new `/bookmarks` page).

**API:**
- `POST /api/bookmarks` — create
- `GET /api/bookmarks?companyId=` — list
- `DELETE /api/bookmarks/[id]` — remove

---

### Issue 10 — Evolution & sentiment shift report
**Priority: Depends on bookmarks (Issue 9) and sentiment (Issue 8).**

**Generates a structured report per cluster containing:**
- Cluster label + date range
- Narrative summary (from `narrativeSummary` or per-period narratives)
- Sentiment shift over time (sentiment per period date if computed)
- Velocity/momentum trend
- Narrative stage: Emerging → Accelerating → Peak → Dying
- Signal or Noise classification
- Risks / Business Impact (analyst-written or AI-drafted)
- Bookmarks & example notes from analyst

**Implementation:**
1. New API: `POST /api/clusters/[id]/report` — assembles all data, sends to OpenAI for a structured draft.
2. UI: "Generate Report" button inside expanded cluster. Opens a modal with the rendered report.
3. Export as `.md` (download button).

---

### Issue 11 — Multi-narrative report (.md)
**Priority: Similar to Issue 10 but for bulk selection.**

**Implementation:**
1. Checkboxes on narrative/cluster cards (already planned for Junk).
2. "Generate Report" action bar appears when 2+ are selected.
3. `POST /api/report/multi` — accepts array of cluster IDs, fetches summary data for each, concatenates into a structured `.md` document.
4. Returns the `.md` as a downloadable blob or renders in a modal.

---

## What to Build First

**Sprint 1 (quick, high-trust wins):**
1. Issue 1 — HN link fix (render layer only)
2. Issue 2 — Fix cluster classification pills
3. Issue 4 — Velocity indicators on Cluster Review

**Sprint 2 (bugs + sort/filter):**
4. Issue 3 — Investigate + fix cluster 2205c87d
5. Issue 5 — Sort by active stories
6. Issue 5.5 — Filter by online discussion (reddit/twitter)

**Sprint 3 (workflow + junk):**
7. Issue 6 — Mark as Junk

**Sprint 4 (AI features):**
8. Issue 7 — Force-generate summaries
9. Issue 8 — Sentiment extraction

**Sprint 5 (bookmarks + reports):**
10. Issue 9 — Bookmarks with notes
11. Issue 10 — Evolution report
12. Issue 11 — Multi-narrative report
