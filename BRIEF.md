# Signal-To-Noise (STN) Analyzer — Project Brief

A tool for social media analysts to monitor public conversation about a company, surface meaningful signals, and filter out noise.

---

## The 5 Parts

### Part 1 — Source Ingestion (MVP)
Keep track of where information comes from. Sources include:
- **Google Alerts** (RSS feed per keyword/topic)
- **X / Twitter API** — track keywords, specific users, executives
- **Reddit API** — track keywords across subreddits
- **HackerNews API** (Algolia) — track keywords and company mentions
- **Manual submission** — analyst pastes in a URL or article they found

Ingested items land in a unified raw feed, tagged by source platform and tracked entity.

### Part 2 — Clustering
Group related items from different sources into clusters.  
Example: a Reddit thread and a manually submitted blog post about the same event get the same cluster ID.  
Clustering can be AI-assisted (embedding similarity) or rule-based (keyword overlap, time window).

### Part 3 — Signal vs. Noise Classification
Classify each cluster:
- **Signal** — conversation causing a meaningful shift in how people think about the company, its products, executives, or reputation. Could impact sales or public perception.
- **Noise** — everything else (background chatter, unrelated mentions, low-engagement posts).

### Part 4 — Tabulated Analysis
For each cluster, generate structured analysis:

**Signals:**
- Confidence level
- Reasoning for signal classification
- Business impact assessment
- Supporting examples (links from Part 1)
- Narrative behind the signal
- Risks this signal poses
- Sentiment shift caused by signal

**Noise:**
- Confidence level that it's noise
- Reasoning for noise classification
- Business impact (usually none, but not defaulted)

### Part 5 — Stakeholder Report
Generate a shareable report from Part 4 analysis for company stakeholders. Provides an executive-level picture of what's being said, what matters, and what to watch.

---

## What We Track (Single Company, Complex Profile)

- **Keywords** — company name, brand terms, product names
- **Executives** — public-facing leaders (by name and social handles)
- **Products** — individual product lines or features

Each tracked entity can be monitored across all active source platforms simultaneously.

---

## Tech Stack
- Next.js 16 App Router + TypeScript
- Neon PostgreSQL + Drizzle ORM
- Tailwind CSS + shadcn/ui
- Vercel Cron Jobs (hourly polling)
- Deployed on Vercel

---

## Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `REDDIT_CLIENT_ID` | Reddit OAuth2 app client ID |
| `REDDIT_CLIENT_SECRET` | Reddit OAuth2 app client secret |
| `TWITTER_BEARER_TOKEN` | Twitter API v2 bearer token |
| `CRON_SECRET` | Vercel cron job authorization header |
