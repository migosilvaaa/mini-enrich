# Contact Enrichment

Internal Miro tool for XDR teams. Upload a Looker CSV of active users, enrich it with titles and mobile phone numbers via the ZoomInfo API, and download an Outreach-ready CSV — all in under 30 seconds.

**Flow:** Upload CSV → Auto-map columns → Enrich via ZoomInfo → Download enriched CSV

---

## Prerequisites

- **ZoomInfo API access** — either username/password credentials or a pre-generated Bearer Token from the [ZoomInfo Developer Portal](https://api.zoominfo.com/docs)
- **Vercel account** — for deployment and hosting the serverless API routes
- Node.js 18+

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set your ZoomInfo credentials
cp .env.example .env.local
# Edit .env.local and add your credentials (see below)

# 3. Run with Vercel dev (required for API routes to work)
npx vercel dev

# Or for UI-only development (API calls will fail without credentials):
npm run dev
```

### Environment Variables

Create `.env.local` (never committed — already in `.gitignore`):

```env
# Option A: Username + Password (recommended)
ZOOMINFO_USERNAME=your_zoominfo_username
ZOOMINFO_PASSWORD=your_zoominfo_password

# Option B: Static Bearer Token (easier for testing, expires after 24h)
ZOOMINFO_BEARER_TOKEN=eyJ...
```

---

## Deployment

1. Push the repo to GitHub (private)
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo
3. Vercel auto-detects Vite — no build settings needed
4. Add environment variables in **Vercel Dashboard → Settings → Environment Variables**:
   - `ZOOMINFO_USERNAME`
   - `ZOOMINFO_PASSWORD`
   (or `ZOOMINFO_BEARER_TOKEN` if using a static token)
5. Deploy — share the URL with the XDR team

Reps need no per-user configuration. The app uses org-level ZoomInfo credentials stored server-side.

---

## Input CSV Format

Looker export with any columns. Only three are used:

| Column | Example |
|--------|---------|
| `Name` | `Pat La Morte` |
| `Email` | `plamorte@pax8.com` |
| `Combined Title` | `Senior Director, Leadership & Enablement Programs` |

The app auto-detects these columns on the Map Fields screen. All other columns are ignored.

**Limits:** 1–500 contacts per upload.

---

## Output CSV

```csv
first_name,last_name,title,email,phone,account_domain,account_name
Pat,La Morte,"Senior Director, Leadership & Enablement Programs",plamorte@pax8.com,+1-555-0142,pax8.com,Pax8 Inc.
```

**Download with metadata** adds: `enrichment_status`, `original_title`, `accuracy_score`.

---

## How It Works

```
Browser → Vercel API routes → ZoomInfo REST API
```

ZoomInfo credentials stay server-side in Vercel env vars — never exposed to the browser. The app makes direct REST calls to ZoomInfo (not through an AI model), so enrichment is deterministic and fast.

- **Phase 1** — Contact enrichment: batches of 25 emails → ZoomInfo `/enrich/contact` → returns titles, phones, company IDs
- **Phase 2** — Company enrichment: unique company IDs/domains → ZoomInfo `/enrich/company` → returns canonical company names

For 50 contacts: 2 contact batches + 1 company batch = 3 API calls total (~5–10 seconds).

---

## ZoomInfo API Reference

- [Authentication](https://api.zoominfo.com/docs#tag/Authentication)
- [Enrich Contact](https://api.zoominfo.com/docs#tag/Enrich/operation/enrichContact)
- [Enrich Company](https://api.zoominfo.com/docs#tag/Enrich/operation/enrichCompany)

Rate limit: 1,500 requests/minute. Credits: 1 per unique record enriched (free re-enrichment for 12 months).
