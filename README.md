# Reputation Analyzer — Signal-to-Noise (STN) Tool

A tool for social media analysts to cut through the noise and surface what actually matters about a company's reputation online.

---

## The Problem

A social media analyst tracking a company is drowning in content — Reddit threads, tweets, HackerNews discussions, news articles. Most of it is noise. Some of it is a signal: a conversation that's shifting how people perceive the company, impacting sales, or changing the narrative around a product or executive. The analyst's job is to find those signals before the stakeholders ask about them.

Today, that work happens in browser tabs, spreadsheets, and gut instinct. This tool replaces all of that.

---

## What It Does

The Reputation Analyzer is a single-company intelligence tool. You configure what you care about — keywords, products, executives — and the tool listens across the internet, collects everything, and helps you separate signal from noise.

It's built for **one analyst, one company**, with a complex profile: multiple products, multiple public-facing executives, and dozens of keywords that all need monitoring simultaneously.

---

## The 5-Part System

### Part 1 — Source Ingestion *(MVP — built)*
Configure what to track and where to listen. The tool polls multiple platforms automatically and lets the analyst manually submit anything they find themselves.

**Sources:**
- **HackerNews** — keyword search via Algolia (free, always on)
- **Reddit** — search across all subreddits via Reddit API
- **X / Twitter** — recent tweets matching queries or from specific handles
- **Google Alerts** — RSS feeds for any keyword alert you've set up
- **Manual submission** — analyst pastes in a URL or writes up content directly

Everything lands in a unified raw feed, tagged by source and linked to the tracked entity that triggered it.

### Part 2 — Clustering *(coming next)*
Group related items from different sources into clusters. A Reddit thread, a tweet, and a manually submitted article about the same event get treated as one story. Clustering uses semantic similarity and time windows to surface connected coverage automatically.

### Part 3 — Signal vs. Noise Classification *(coming)*
Each cluster gets classified:
- **Signal** — conversation causing a meaningful shift in perception, reputation, or business outcomes
- **Noise** — background chatter, low-engagement mentions, unrelated references

### Part 4 — Structured Analysis *(coming)*
For every cluster, the tool generates a structured breakdown:

| Signals | Noise |
|---|---|
| Confidence level | Confidence it's noise |
| Reasoning | Reasoning |
| Business impact | Business impact |
| Supporting examples | — |
| Narrative summary | — |
| Risk assessment | — |
| Sentiment shift | — |

### Part 5 — Stakeholder Report *(coming)*
One-click report generation for executives and comms teams. Clear, scannable, no analyst jargon. Shows what's happening, what matters, and what to watch.

---

## Current MVP (Part 1)

The MVP is the data ingestion and monitoring layer. An analyst can:

1. **Add tracked entities** — define keywords, executives, and products to monitor, with a search query and entity type
2. **Configure sources** — connect API credentials for Reddit and Twitter; Google Alerts via RSS; HackerNews needs no setup
3. **Browse the raw feed** — a unified, filterable stream of everything collected across all platforms
4. **Submit manually** — paste a URL (auto-fetches title and author), add context, and link it to a tracked entity

The system polls all sources hourly via Vercel Cron and deduplicates on ingest so nothing appears twice.

---

## UI Pages

| Page | Purpose |
|---|---|
| **Feed** `/` | The raw feed — all ingested items, filterable by platform and entity. Each item shows source badge, title, author, date, and entity tag. |
| **Track** `/track` | Manage tracked entities. Add keywords, executives, and products with their search query and optional Google Alerts RSS URL. |
| **Sources** `/sources` | Status of each platform — connected or not, which credentials are set, which entities have Google Alerts configured. |
| **Submit** `/submit` | Manual submission form. Paste a URL (title auto-fills from page metadata), add body, author, date, and optionally link to a tracked entity. |

---

## Design Direction

The primary user is a **professional social media analyst** — detail-oriented, high information density is fine, speed matters. This is a working tool, not a marketing page.

Key design considerations:
- **Dense but readable** — the feed needs to show many items at a glance without feeling cluttered
- **Platform color-coding** — HN (orange), Reddit (red), Twitter/X (sky blue), Google Alerts (blue), Manual (gray)
- **Entity tagging** — small badges that let the analyst quickly see which tracked entity an item belongs to
- **Minimal chrome** — the content is the product; navigation should stay out of the way
- **No empty states that feel broken** — helpful prompts when the feed is empty (add entities, submit something)
- **Fast filtering** — platform and entity dropdowns should feel instant
- **Analyst-first language** — "tracked entities" not "topics", "raw feed" not "dashboard"

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database:** Neon PostgreSQL + Drizzle ORM
- **Styling:** Tailwind CSS + shadcn/ui
- **Scheduling:** Vercel Cron (hourly polling)
- **Deployment:** Vercel

---

## Data Model

**`tracked_entities`** — what to monitor
- Label (e.g. "Sam Altman"), query string (e.g. `"Sam Altman" OR from:sama`), type (keyword / executive / product), optional Google Alerts RSS URL

**`ingested_items`** — everything collected
- Platform, URL, title, body, author, published date, linked entity, raw payload — with a unique constraint on `(platform, external_id)` to prevent duplicates
