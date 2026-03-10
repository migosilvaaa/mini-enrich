# Contact Enrichment App — Claude Code Implementation Plan

## READ THIS FIRST

This is the complete spec for a Miro internal tool. Feed this entire file as context to Claude Code and then use the step-by-step prompts at the bottom to build it.

---

## What This App Does

XDRs (BDR/SDR reps) at Miro export CSVs from Looker dashboards containing active Miro users. These CSVs have names, emails, and sometimes titles — but no phone numbers and often stale titles. Reps currently spend ~45 minutes manually scraping LinkedIn and ZoomInfo to enrich each list.

This app takes a CSV upload, calls the ZoomInfo REST API directly (no AI middleman), and outputs an Outreach-ready CSV with enriched titles and mobile phone numbers in under 30 seconds.

**User flow:**
1. Rep uploads Looker CSV
2. App auto-maps the columns (Name, Email, Combined Title)
3. Rep clicks "Enrich" — app calls ZoomInfo API directly
4. App outputs a clean CSV: first_name, last_name, title, email, phone, account_domain, account_name

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│              React Frontend (Vite)                │
│                                                    │
│  Upload CSV → Map Columns → Enrich → Download     │
│                                                    │
│  Calls /api/* routes (same Vercel deployment)      │
└────────────────────┬─────────────────────────────┘
                     │  fetch("/api/enrich-contacts")
                     │  fetch("/api/enrich-companies")
                     ▼
┌──────────────────────────────────────────────────┐
│         Vercel Serverless API Routes              │
│         (api/ directory in the project)           │
│                                                    │
│  /api/enrich-contacts.js                           │
│  /api/enrich-companies.js                          │
│  /api/auth-check.js                                │
│                                                    │
│  ZoomInfo creds stored in Vercel env vars:         │
│  ZOOMINFO_USERNAME + ZOOMINFO_PASSWORD             │
│  (or ZOOMINFO_BEARER_TOKEN for testing)            │
│                                                    │
│  Routes handle:                                    │
│  1. Authenticate to ZoomInfo (get/cache JWT)       │
│  2. Proxy the enrich request to ZoomInfo           │
│  3. Return structured JSON to the frontend         │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│             ZoomInfo REST API                     │
│                                                    │
│  POST /authenticate                                │
│    → Returns JWT (valid 1 hour)                    │
│                                                    │
│  POST /enrich/contact                              │
│    → Up to 25 contacts per call                    │
│    → Match by email (most reliable)                │
│    → Returns: jobTitle, mobilePhone, phone,        │
│      companyName, zoominfoCompanyId, etc.           │
│                                                    │
│  POST /enrich/company                              │
│    → Up to 25 companies per call                   │
│    → Match by companyId or domain                  │
│    → Returns: name, website, domainList            │
│                                                    │
│  Base URL: https://api.zoominfo.com                │
│  Rate limit: 1,500 req/min                         │
│  Credits: 1 per new record (free re-enrich 12mo)   │
└──────────────────────────────────────────────────┘
```

**Why Vercel API routes (not direct browser → ZoomInfo)?**
- ZoomInfo API does not allow browser-origin requests (CORS)
- ZoomInfo credentials stay server-side in Vercel env vars — never exposed to the browser
- Reps don't need to enter any credentials — the app "just works" once deployed

**Why NOT the Anthropic API + MCP approach?**
- This is a deterministic data pipeline (structured in → structured out) — no AI reasoning needed
- Direct API is 10x faster (sub-second vs 5-15 sec per batch through Claude)
- No Anthropic API costs
- Deterministic JSON responses — no parsing ambiguity
- ZoomInfo enrich endpoint accepts up to 25 records per call (vs 10 via MCP)

---

## Sample CSV Input (from Looker)

The Looker export has 18 columns. Only 3 matter:

| Column Header | Example Value | How We Use It |
|---|---|---|
| `Name` | `Pat La Morte` | Split into first_name + last_name |
| `Email` | `plamorte@pax8.com` | Primary ZoomInfo match key, also derive account_domain |
| `Combined Title` | `Senior Director, Leadership & Enablement Programs` | Fallback title if ZoomInfo returns nothing |

Other columns in the CSV (ignored): Subscription ID, User ID, Feature, Line of Business, Combined Seniority Level, Power User Type, Collaboration Type, Last Open Board Date, Registration At Date, Top Templates Added Last 90D, Top Use Case Added Last 90D, Recent Feature Usage Date, Average Active Days, Average Feature Used Count.

Typical export size: under 50 contacts. Max the app should support: 500.

---

## Final Output CSV

```csv
first_name,last_name,title,email,phone,account_domain,account_name
Pat,La Morte,"Senior Director, Leadership & Enablement Programs",plamorte@pax8.com,+1-555-0142,pax8.com,Pax8 Inc.
```

| Column | Source | Fallback |
|---|---|---|
| first_name | Split from Name | — |
| last_name | Split from Name | "" for single names |
| title | ZoomInfo `jobTitle` | CSV `Combined Title` → "" |
| email | Original CSV | — |
| phone | ZoomInfo `mobilePhone` | ZoomInfo `phone` → "" |
| account_domain | Extracted from email | — |
| account_name | ZoomInfo company `name` | ZoomInfo contact `companyName` → capitalize domain |

---

## ZoomInfo API Details

### Authentication

```
POST https://api.zoominfo.com/authenticate
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}

Response: { "jwt": "eyJ..." }
```

- JWT is valid for 1 hour
- Cache the JWT and refresh when it expires or returns 401
- Alternative: Use a pre-generated Bearer Token from ZoomInfo Developer Portal (valid 24 hours, good for testing)

### Enrich Contacts

```
POST https://api.zoominfo.com/enrich/contact
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "matchPersonInput": [
    { "emailAddress": "plamorte@pax8.com" },
    { "emailAddress": "sheflin@pax8.com" }
    // ... up to 25 per call
  ],
  "outputFields": [
    "firstName",
    "lastName", 
    "jobTitle",
    "mobilePhone",
    "phone",
    "contactAccuracyScore",
    "companyName",
    "zoominfoCompanyId"
  ]
}
```

Response contains a `data` array with enriched contact objects. Each object has the requested output fields.

### Enrich Companies

```
POST https://api.zoominfo.com/enrich/company
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "matchCompanyInput": [
    { "companyId": "344589814" },
    // OR
    { "companyWebsite": "https://www.pax8.com" }
    // ... up to 25 per call
  ],
  "outputFields": [
    "name",
    "website",
    "domainList"
  ]
}
```

### Rate Limits & Credits
- 1,500 requests per minute
- 1 credit per unique record enriched (free re-enrichment for 12 months)
- For 50 contacts: 2 contact enrichment calls + 1 company enrichment call = 3 API calls total

---

## File Structure

```
enrichment-app/
├── api/                              # Vercel serverless functions
│   ├── auth-check.js                 # GET — check if ZoomInfo auth is working
│   ├── enrich-contacts.js            # POST — proxy to ZoomInfo contact enrich
│   └── enrich-companies.js           # POST — proxy to ZoomInfo company enrich
├── src/
│   ├── main.jsx                      # React entry
│   ├── App.jsx                       # Step state machine: upload → map → enrich → results
│   ├── components/
│   │   ├── StepIndicator.jsx         # 3-step visual progress bar
│   │   ├── FileUpload.jsx            # Drag-drop + file picker + CSV preview table
│   │   ├── ColumnMapper.jsx          # 3 dropdowns (name, email, title) + auto-map + preview
│   │   ├── EnrichmentProgress.jsx    # Progress bar, phase indicator, live table
│   │   ├── ResultsTable.jsx          # Final table with filters + summary stats
│   │   └── ConnectionStatus.jsx      # Shows "ZoomInfo Connected ✓" or error
│   ├── hooks/
│   │   ├── useCsvParser.js           # PapaParse wrapper
│   │   ├── useColumnMapping.js       # Auto-detect + manual override
│   │   └── useEnrichment.js          # Orchestrates /api calls, batching, merging
│   ├── lib/
│   │   ├── api.js                    # fetch wrappers for /api/enrich-* routes
│   │   ├── nameUtils.js              # splitName(), extractDomain(), domainToAccountName()
│   │   ├── fieldMapping.js           # Auto-mapping heuristics
│   │   └── csvExport.js              # PapaParse unparse + download trigger
│   └── styles/
│       └── globals.css               # Tailwind base + custom styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
├── .env.example                      # ZOOMINFO_USERNAME, ZOOMINFO_PASSWORD
├── .gitignore
└── README.md
```

---

## UI Spec

### Screen 1: Upload

Top of screen: `ConnectionStatus` component
- On page load, calls `GET /api/auth-check`
- If successful: green badge "✓ ZoomInfo Connected"  
- If failed: red badge "✗ ZoomInfo Not Configured — contact your admin"
- This replaces the old MCP button and API key input — no rep-side configuration needed

Main area: drag-and-drop upload zone
- Accepts .csv files only
- After upload: preview table showing first 5 rows (show up to 8 columns, "+N more" for the rest)
- Row count badge: "88 contacts loaded"
- "Next: Map Fields →" button (disabled until file is uploaded AND ZoomInfo is connected)

### Screen 2: Map Fields

Three mapping rows with dropdowns populated from CSV headers:
1. **Full Name** (required) — auto-maps to any header containing "name"
2. **Email** (required) — auto-maps to any header containing "email"
3. **Existing Title** (optional) — auto-maps to "Combined Title" or "title"

Auto-mapping heuristics (case-insensitive, trimmed):
```
name:  ["name", "full name", "fullname", "contact name", "contact"]
email: ["email", "email address", "e-mail", "mail", "user email"]
title: ["combined title", "title", "job title", "role", "position"]
```

Preview card below mapping: show first 3 contacts resolved:
```
Pat La Morte → first: Pat, last: La Morte
plamorte@pax8.com → domain: pax8.com
Senior Director, Leadership & Enablement Programs → will be enriched via ZoomInfo
```

Name splitting logic: split on whitespace, first token = firstName, rest joined = lastName. Handles triple names ("Pat La Morte" → first: "Pat", last: "La Morte").

"← Back" and "Start Enrichment →" buttons.

### Screen 3: Enrich + Results

**While enriching:**
- Progress bar with percentage and contact count
- Phase label: "Phase 1: Enriching titles & phones" → "Phase 2: Looking up accounts"
- Live table that fills in as batches complete
- Status chips per row: ⏳ Pending, ✅ Enriched, ⚠️ Partial, ❌ Not Found
- Cancel button

**After enrichment:**
- Summary stats: "74 enriched · 9 partial · 5 not found"
- Filter toggles: All | Enriched | Partial | Not Found
- Full results table: first_name, last_name, title, email, phone, account_domain, account_name
- Row color coding: white (enriched), light amber (partial), light red (not found)
- "Download CSV" primary button
- "Download with metadata" secondary link (adds enrichment_status, original_title, accuracy_score)
- "Start Over" button

---

## Vercel API Routes — Detailed Spec

### GET /api/auth-check.js

Purpose: Verify that ZoomInfo credentials are configured and working.

```javascript
// 1. Read ZOOMINFO_USERNAME and ZOOMINFO_PASSWORD from process.env
//    OR read ZOOMINFO_BEARER_TOKEN from process.env
// 2. If neither exists, return { status: "not_configured" }
// 3. If bearer token exists, attempt a lightweight ZoomInfo call to verify it works
// 4. If username/password exist, call POST https://api.zoominfo.com/authenticate
// 5. If successful, return { status: "connected" }
// 6. If failed, return { status: "error", message: "..." }
```

### POST /api/enrich-contacts.js

Purpose: Accept a batch of emails, call ZoomInfo enrich contact, return results.

```javascript
// Request body from frontend:
// { contacts: [{ email: "plamorte@pax8.com" }, ...] }  (max 25)
//
// 1. Authenticate with ZoomInfo (get JWT or use bearer token)
//    - Cache JWT in a module-level variable; refresh if expired or 401
// 2. Call POST https://api.zoominfo.com/enrich/contact with:
//    {
//      matchPersonInput: contacts.map(c => ({ emailAddress: c.email })),
//      outputFields: ["firstName", "lastName", "jobTitle", "mobilePhone", 
//                      "phone", "contactAccuracyScore", "companyName", "zoominfoCompanyId"]
//    }
// 3. Parse response: extract the data array
// 4. Normalize each result into:
//    { email, jobTitle, mobilePhone, phone, companyName, zoominfoCompanyId, contactAccuracyScore, matched: true/false }
// 5. For any input email not found in results, return { email, matched: false, ... nulls }
// 6. Return JSON array to frontend
//
// Error handling:
// - 401: Re-authenticate and retry once
// - 429: Return 429 to frontend (it will retry with backoff)
// - Other: Return error message
```

### POST /api/enrich-companies.js

Purpose: Accept a batch of company identifiers, call ZoomInfo enrich company, return results.

```javascript
// Request body from frontend:
// { companies: [{ companyId: "344589814", domain: "pax8.com" }, ...] }  (max 25)
//
// 1. Authenticate (same as above)
// 2. Call POST https://api.zoominfo.com/enrich/company with:
//    {
//      matchCompanyInput: companies.map(c => 
//        c.companyId ? { companyId: c.companyId } : { companyWebsite: `https://www.${c.domain}` }
//      ),
//      outputFields: ["name", "website", "domainList"]
//    }
// 3. Parse and return normalized results
```

### JWT Caching in Serverless Functions

Vercel serverless functions can share module-level state within a warm instance. Cache the JWT:

```javascript
let cachedJwt = null;
let jwtExpiry = 0;

async function getJwt() {
  if (cachedJwt && Date.now() < jwtExpiry) return cachedJwt;
  
  const res = await fetch("https://api.zoominfo.com/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.ZOOMINFO_USERNAME,
      password: process.env.ZOOMINFO_PASSWORD
    })
  });
  
  const data = await res.json();
  cachedJwt = data.jwt;
  jwtExpiry = Date.now() + 55 * 60 * 1000; // Refresh 5 min before expiry
  return cachedJwt;
}
```

---

## Frontend Enrichment Hook — Detailed Logic

The `useEnrichment` hook orchestrates everything:

### Phase 1: Contact Enrichment

```
1. Take mappedData array (each item has: email, first_name, last_name, domain, existing_title)
2. Deduplicate by email (keep all original rows, but only enrich unique emails)
3. Batch into groups of 25 (ZoomInfo's limit per call)
4. For each batch:
   a. POST to /api/enrich-contacts with { contacts: [{ email }, ...] }
   b. Merge results back: match by email
   c. For each contact:
      - title: ZoomInfo jobTitle || existing_title || ""
      - phone: ZoomInfo mobilePhone || ZoomInfo phone || ""
      - companyName: ZoomInfo companyName || null
      - zoominfoCompanyId: ZoomInfo zoominfoCompanyId || null
      - status: "enriched" if title AND phone found, "partial" if some, "not_found" if none
   d. Update progress state
   e. Wait 200ms between batches (rate limit courtesy, not strictly needed at this volume)
5. If a batch returns 429: wait 2 seconds, retry (max 3 retries)
6. If a batch returns 401: show "ZoomInfo authentication failed" error, stop
```

### Phase 2: Company Enrichment

```
1. Collect unique { zoominfoCompanyId, domain } pairs from Phase 1
   (usually just 1 company per CSV since Looker exports are per-account)
2. Batch into groups of 25
3. POST to /api/enrich-companies
4. Build domain → companyName map from results
5. Merge back into contact results:
   - account_name: ZoomInfo company name || ZoomInfo contact companyName || domainToAccountName(domain)
   - account_domain: already set from email
```

### Merge & Finalize

```
1. Set final status per contact:
   - "enriched": title AND phone both present
   - "partial": some enriched fields present
   - "not_found": no ZoomInfo match at all
2. Compute stats: { enriched: N, partial: N, notFound: N }
3. Set phase to "done"
```

---

## Name Splitting + Domain Extraction

```javascript
function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
// "Pat La Morte" → { firstName: "Pat", lastName: "La Morte" }
// "Stephanie" → { firstName: "Stephanie", lastName: "" }

function extractDomain(email) {
  return email.split("@")[1]?.toLowerCase() || "";
}
// "sheflin@pax8.com" → "pax8.com"

function domainToAccountName(domain) {
  return domain.split(".")[0].split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
// "pax8.com" → "Pax8"
```

---

## Environment Variables (Vercel)

```env
# Option A: Username/password (recommended — auto-generates JWT)
ZOOMINFO_USERNAME=your_zi_username
ZOOMINFO_PASSWORD=your_zi_password

# Option B: Bearer token (simpler for testing — valid 24 hours)
ZOOMINFO_BEARER_TOKEN=eyJ...
```

Set these in Vercel dashboard: Settings → Environment Variables.

---

## Tech Stack

- **Vite + React** — build and UI
- **Tailwind CSS** — styling  
- **PapaParse** — CSV parsing and export (install via npm)
- **Vercel** — hosting + serverless API routes
- **ZoomInfo REST API** — direct enrichment (no AI middleman)

---

## Edge Cases

1. **No email for a row** → Skip that row, warn user "3 rows skipped (no email)"
2. **Duplicate emails** → Deduplicate before enrichment, map results back to all original rows
3. **ZoomInfo returns no match** → Mark as "not_found", keep original CSV data, leave enriched fields blank
4. **Single-name contacts** → Set lastName to "", still enrich by email
5. **CSV has commas in titles** → PapaParse handles this automatically (quoted fields)
6. **Very small CSV (1-2 contacts)** → Works fine, just 1 API call
7. **All contacts from same company** → Company enrichment is 1 API call total
8. **ZoomInfo returns company-only match** → Use the company data, mark contact as "partial"

---

## STEP-BY-STEP CLAUDE CODE PROMPTS

Feed these prompts to Claude Code in order. Each builds on the previous.

### PROMPT 1: Scaffold + API Routes

```
Create a Vite + React + Tailwind CSS project called "enrichment-app" that deploys to Vercel as a static site with serverless API routes.

Install dependencies: papaparse, lucide-react.

Create the project structure per the file structure in my spec. Focus on the API layer first:

1. api/auth-check.js — GET handler that:
   - Reads ZOOMINFO_USERNAME + ZOOMINFO_PASSWORD from process.env (or ZOOMINFO_BEARER_TOKEN)
   - If neither exists, returns { status: "not_configured" }
   - If credentials exist, calls POST https://api.zoominfo.com/authenticate with { username, password }
   - Returns { status: "connected" } or { status: "error", message: "..." }
   - Handles CORS headers for the frontend

2. api/enrich-contacts.js — POST handler that:
   - Receives { contacts: [{ email: "..." }, ...] } from the frontend (max 25)
   - Authenticates to ZoomInfo (cache JWT in module-level variable, refresh if expired)
   - Calls POST https://api.zoominfo.com/enrich/contact with:
     matchPersonInput: contacts mapped to { emailAddress: c.email }
     outputFields: ["firstName", "lastName", "jobTitle", "mobilePhone", "phone", "contactAccuracyScore", "companyName", "zoominfoCompanyId"]
   - Returns normalized array of results
   - Handles 401 (re-auth + retry), 429 (pass through), errors

3. api/enrich-companies.js — POST handler that:
   - Receives { companies: [{ companyId?, domain }] } from the frontend (max 25)
   - Calls POST https://api.zoominfo.com/enrich/company with:
     matchCompanyInput: mapped to { companyId } or { companyWebsite: "https://www." + domain }
     outputFields: ["name", "website", "domainList"]
   - Returns normalized array

Create a shared api/_lib/zoominfo-auth.js module for JWT caching:
- Module-level cachedJwt and jwtExpiry
- getJwt() function that returns cached or fetches new
- getBearerToken() that checks ZOOMINFO_BEARER_TOKEN first, then falls back to JWT

Add vercel.json with the correct config for the Vite build output directory.
Add .env.example with ZOOMINFO_USERNAME, ZOOMINFO_PASSWORD, ZOOMINFO_BEARER_TOKEN.
```

### PROMPT 2: Upload + Connection Status

```
Build the upload screen for the enrichment app.

1. ConnectionStatus.jsx component:
   - On mount, calls GET /api/auth-check
   - Loading state: gray "Checking ZoomInfo connection..."
   - Connected: green badge "✓ ZoomInfo Connected" 
   - Error: red badge "✗ ZoomInfo Not Configured" with small text "Contact your admin to set environment variables"
   - Store status in state so other components can check it

2. FileUpload.jsx component:
   - Drag-and-drop zone with dashed border, accepts .csv only
   - On drop/select: parse with PapaParse (header: true, skipEmptyLines: true)
   - Reject if 0 data rows or > 500 rows
   - After upload: show preview table (first 5 rows, first 8 columns, "+N more" indicator)
   - Row count badge showing total contacts loaded
   - Clear button to remove the file and start over

3. useCsvParser.js hook:
   - Wraps PapaParse, returns { data, headers, rowCount, error, fileName, parseFile, reset }

4. StepIndicator.jsx — 3-step progress indicator: Upload → Map → Enrich & Download

5. App.jsx — state machine with steps: upload, map, enrich
   - Renders header with app name "Contact Enrichment" and StepIndicator
   - Upload step shows ConnectionStatus at top, FileUpload below
   - "Next: Map Fields" button disabled until file uploaded AND ZoomInfo connected

Use Tailwind. Clean, professional design. White background, subtle gray borders, dark navy (#050038) as the primary accent. DM Sans font from Google Fonts.
```

### PROMPT 3: Column Mapping

```
Build the column mapping screen.

1. ColumnMapper.jsx component:
   - 3 mapping rows, each with label + icon + dropdown of CSV column headers:
     a. "Full Name" (required) — auto-maps to any header containing "name"
     b. "Email" (required) — auto-maps to any header containing "email"
     c. "Existing Title" (optional) — auto-maps to "Combined Title" or "title"
   - Auto-mapping is case-insensitive
   - Dropdowns populated with all CSV column headers
   - Optional title field has an additional "None" option
   - Preview card showing first 3 contacts resolved:
     "Pat La Morte → first: Pat, last: La Morte"
     "plamorte@pax8.com → domain: pax8.com"
   - "← Back" and "Start Enrichment →" buttons
   - Start Enrichment disabled until Name and Email are mapped

2. useColumnMapping.js hook:
   - Auto-maps on mount when headers are provided
   - Exposes: mapping, updateMapping, isValid, mappedData (transformed array), preview
   - mappedData transforms each row: splits name, extracts domain, includes existing_title

3. nameUtils.js — splitName(), extractDomain(), domainToAccountName()

4. fieldMapping.js — FIELD_HINTS object + autoMapColumns(headers) function
```

### PROMPT 4: Enrichment Engine

```
Build the enrichment engine that calls the ZoomInfo API routes.

1. lib/api.js — fetch wrappers:
   - checkConnection(): GET /api/auth-check
   - enrichContacts(contacts): POST /api/enrich-contacts with { contacts }
   - enrichCompanies(companies): POST /api/enrich-companies with { companies }
   - All return parsed JSON, throw on error

2. useEnrichment.js hook — the core orchestration:

   Phase 1 — Contact enrichment:
   - Deduplicate mappedData by email
   - Batch unique emails into groups of 25
   - For each batch: call enrichContacts(), merge results back
   - Phone priority: mobilePhone first, then phone
   - Title priority: ZoomInfo jobTitle first, then existing_title from CSV
   - Update progress after each batch (current/total, percent)
   - Handle 429 (wait 2s, retry 3x), 401 (stop with error)
   - Wait 200ms between batches

   Phase 2 — Company enrichment:
   - Collect unique { zoominfoCompanyId, domain } from Phase 1
   - Batch into groups of 25
   - Call enrichCompanies()
   - Build domain → companyName lookup map
   - Merge back: account_name = ZoomInfo company name || contact companyName || domainToAccountName

   Final status per contact:
   - "enriched" = title AND phone both found
   - "partial" = some fields found
   - "not_found" = no ZoomInfo match

   Exposes: { isRunning, phase, progress, results, error, stats, startEnrichment, cancel, reset }

3. EnrichmentProgress.jsx:
   - While running: progress bar, phase label, live-filling table with status chips
   - Chips: ⏳ Pending (gray), ✅ Enriched (green), ⚠️ Partial (amber), ❌ Not Found (red)
   - Cancel button
   - After done: transitions to results view
```

### PROMPT 5: Results Table + CSV Export

```
Build the results display and CSV download.

1. ResultsTable.jsx:
   - Summary stats bar: "74 enriched · 9 partial · 5 not found"
   - Filter toggles: All | Enriched | Partial | Not Found (styled as segmented control)
   - Full scrollable table: first_name, last_name, title, email, phone, account_domain, account_name
   - Row backgrounds: white (enriched), light amber (partial), light red (not found)
   - Missing values show "—" in gray italic
   - Status chip column

2. csvExport.js:
   - downloadCsv(results, includeMetadata): 
     - Uses PapaParse.unparse()
     - Standard columns: first_name, last_name, title, email, phone, account_domain, account_name
     - With metadata: also enrichment_status, original_title, accuracy_score
     - Filename: enriched_contacts_YYYY-MM-DD.csv
     - Triggers browser download via Blob + createObjectURL

3. Download buttons:
   - Primary "Download CSV" button
   - Secondary "Download with metadata" link
   - "Start Over" button that resets all app state to step 1
```

### PROMPT 6: Polish + Deploy

```
Final polish and deployment readiness:

1. Error handling:
   - Toast/banner for API errors with the error message
   - If ZoomInfo returns 401 during enrichment, show "ZoomInfo session expired — please retry"
   - If all batches fail, full-screen error with "Check ZoomInfo configuration" message

2. Loading states:
   - Connection check: skeleton/spinner while checking
   - Enrichment: progress bar with estimated time ("~10 seconds for 50 contacts")
   - Buttons show spinner when clicked

3. Edge cases:
   - Empty CSV: "No contacts found"
   - Missing emails on some rows: "3 rows skipped (no email)" warning
   - Duplicate emails: dedupe, map back after enrichment
   - CSV with only 1 row: works fine

4. README.md:
   - What the app does (1 paragraph)
   - Prerequisites: ZoomInfo API credentials
   - Local dev: npm install && npm run dev
   - Deployment: push to GitHub, import in Vercel, set ZOOMINFO_USERNAME and ZOOMINFO_PASSWORD env vars
   - Link to ZoomInfo API docs: https://docs.zoominfo.com

5. Ensure vercel.json, .gitignore, .env.example are all correct.

6. Test the build: npm run build should succeed with no errors.
```

---

## Deployment Checklist

1. Push repo to GitHub (private)
2. Go to vercel.com/new → import the repo
3. Vercel auto-detects Vite
4. Set environment variables in Vercel dashboard:
   - `ZOOMINFO_USERNAME` = your ZoomInfo username
   - `ZOOMINFO_PASSWORD` = your ZoomInfo password
5. Deploy
6. Share URL with XDR team — no per-rep setup needed

---

## What's Different from the MCP Version

| Aspect | MCP Version | Direct API Version |
|---|---|---|
| Auth | Per-rep Anthropic API key + MCP toggle | Org-level ZoomInfo creds in Vercel env vars |
| Enrichment speed | ~15 sec per batch of 10 | Sub-second per batch of 25 |
| Batch size | 10 contacts | 25 contacts |
| Total API calls for 50 contacts | 5 contact + 1 company = 6 calls through Claude | 2 contact + 1 company = 3 direct calls |
| Cost per enrichment | Anthropic API tokens + ZoomInfo credits | ZoomInfo credits only |
| Response reliability | Non-deterministic (Claude may format differently) | Deterministic JSON |
| Rep configuration | Enter API key, click MCP button | Nothing — app works immediately |
| Backend needed | No (browser → Anthropic → MCP → ZoomInfo) | Yes, but Vercel API routes (3 small files) |
