# BespoxAI — Stage 4 Complete. Paste into new chat to continue.

## What BespoxAI Is
A multi-tenant SaaS platform connecting customers' on-premise Business Central (BC)
servers to an AI query layer at `bespoxai.com`. Users log into the portal and query
their live BC data in natural language. Answers are CFO-grade prose with structured
data hints for chart/table rendering.

## Architecture
```
User (bespoxai.com) → Vercel (Next.js 14)
                           │
                    NextAuth JWT session
                           │
                    /api/query route
                     ├─ GPT-4o (classifier) → generic or data question
                     ├─ GPT-4o (planner) → OData query [data questions only]
                     ├─ Cloudflare Tunnel → BCAgent (on-prem) → BC OData (NTLM)
                     └─ GPT-4o (answerer) → CFO natural language + displayHint + data
```

## Environment
- **Server:** Windows Server 2022 Azure VM
- **BC:** Version 14, instance `GWM_Dev`, OData port `8048`
- **Windows Auth:** NTLM — BC user `incadea\9lancasterr`
- **BCAgent:** `C:\BespoxAI\Agent\BCAgent.ps1` (v2.1) — runs as Scheduled Task (SYSTEM)
- **Cloudflared:** `C:\cloudflared\cloudflared.exe`
- **Tunnel:** `bespoxai-gwmdev` (ID: `a94faded-fe20-436d-8ac3-909d60c06fb2`)
- **Domain:** `bespoxai.com` — nameservers on Cloudflare
- **GitHub:** `github.com/NavSolutionsNZ/BespokeAI_Web`
- **Vercel project:** `bespoke-ai-web` (team: `navsolutionsnz`)

## Credentials & Keys
- **BCAgent API key:** `Xh11SG474IAy/zmNHSKCj4eRmphOSekSjAFaj1j/ccA=`
- **Tunnel public URL:** `https://gwmdev-agent.bespoxai.com`
- **OData base URL:** `https://gwmdev-agent.bespoxai.com/GWM_Dev/ODataV4/Company('GWM')/{Entity}`
- **Cloudflare Account ID:** `d73b490bccc502c1ffc7227be6382fa2`

## Vercel Environment Variables
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | GPT-4o API key |
| `DATABASE_URL` | Vercel Postgres (pooled) |
| `PRISMA_DATABASE_URL` | Prisma pooled connection |
| `POSTGRES_URL` | Prisma direct connection |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXTAUTH_URL` | `https://bespoxai.com` |
| `GITHUB_DEPLOY_TOKEN` | GitHub PAT for pushing code |
| `CLOUDFLARE_API_TOKEN` | CF API token (Tunnel:Edit + DNS:Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | `d73b490bccc502c1ffc7227be6382fa2` |
| `CLOUDFLARE_ZONE_ID` | Zone ID for bespoxai.com |

## Stage 4 Completed ✅

### 4.1 Live health indicator
- Polls `GET /api/health` every 60s (server-side proxy to BCAgent `/health`)
- BCAgent health endpoint validates API key — false-green impossible
- Header badge: BC connected / Agent offline / Checking…
- Sidebar badge updates to match
- Shows last-checked relative time + latency in ms

### 4.2 Chart & table rendering
- `components/DataVisualizer.tsx` — four renderers driven by `displayHint`
- `kpi` → KPI cards (dark primary + parchment secondaries)
- `table` → sortable table (click column to sort, numeric cols formatted)
- `bar_chart` → Recharts BarChart (jade/forest/amber bars)
- `line_chart` → Recharts LineChart (jade line, amber active dot)
- Two-entity join support — SalesInvoice headers + SalesInvoiceSalesLines amounts

### 4.3 Query history
- `QueryLog` model in Postgres (tenantId, userId, question, answer, displayHint, data, entity, recordCount)
- Every successful query persisted after response
- `GET /api/history` — last 30 queries for current user
- Dashboard sidebar: Recent queries panel with entity, record count, relative time
- Click to re-run (populates input)

### 4.4 Admin portal (`/admin`)
- Protected: admin role only — non-admins redirected to /dashboard
- **Overview tab:** KPI row + per-tenant usage table + top queried entities
- **Tenants tab:** list with activate/deactivate, New Tenant form (auto-provision or manual)
- **Users tab:** all users across tenants, Invite User (generates temp password shown once), per-row: Disable/Enable, Reset password, Delete (with confirm)
- **Entities tab:** scan BC $metadata, compare vs catalogue, toggle entities on/off per tenant

### 4.5 BC entity auto-discovery
- `GET /api/admin/discover/[tenantId]` — fetches $metadata, classifies into: available, missing, uncatalogued
- `GET/PATCH /api/admin/entities/[tenantId]` — read/write entity config per tenant
- Planner only sees entities the tenant admin has enabled
- `entityConfig Json?` on Tenant model

### 4.6 Installer package
- `scripts/Install-BespoxAI.ps1` — embedded in every generated installer
- `POST /api/admin/installer/[tenantId]` — accepts BC credentials, injects into PS1, base64-encodes, returns self-elevating `.bat` wrapped in `.zip`
- `.bat` auto-requests UAC elevation, decodes PS1 to temp file, runs, cleans up
- Port conflict check with continue/abort prompt
- Download button opens modal: BCUsername, BCPassword, BCPort (8048), AgentPort (8080)

### 4.7 Automated tunnel provisioning (4.8 pulled forward)
- `POST /api/admin/provision` — creates CF tunnel, configures ingress, creates DNS CNAME, seeds tenant in DB
- `lib/cloudflare.ts` — CF API helpers
- `tunnelId String?` on Tenant model
- Installer download fetches live tunnel token from CF API at generation time

### Smart query routing
- Step 0 in `/api/query` — GPT classifies: needsData or generic
- Generic questions answered from BC v14 + CFO expertise directly
- Returns `suggestedQueries` — clickable BC data question buttons in UI
- No OData fetch for generic questions

### AI persona
- BC v14 functional consultant + senior CFO advisor for tenant's country
- `country String` on Tenant model (default 'NZ', ISO code)
- Used in both classifier and answerer system prompts

### PDF export
- "↓ Export PDF" button on every answer
- Modal with editable textarea — user can edit before saving
- "Save as PDF" opens formatted print window → browser print dialog

### User password management
- `PATCH /api/user/password` — validates current password, enforces 8 char min
- 🔑 icon in dashboard sidebar opens change password modal
- Disabled users (active=false) blocked at login

## Key Files
| File | Purpose |
|------|---------|
| `app/login/page.tsx` | Portal sign-in |
| `app/dashboard/page.tsx` | CFO Assistant + Health Scanner + change password |
| `app/admin/page.tsx` | Super-admin portal (Overview, Tenants, Users, Entities) |
| `app/api/query/route.ts` | 4-step pipeline: classify → plan → fetch → answer |
| `app/api/health/route.ts` | BCAgent health proxy |
| `app/api/history/route.ts` | Query log retrieval |
| `app/api/admin/tenants/route.ts` | Tenant CRUD |
| `app/api/admin/tenants/[id]/route.ts` | Tenant toggle active |
| `app/api/admin/users/route.ts` | User list + invite |
| `app/api/admin/users/[id]/route.ts` | User disable/delete/reset password |
| `app/api/admin/provision/route.ts` | Full CF + DB tenant provisioning |
| `app/api/admin/installer/[tenantId]/route.ts` | Pre-configured .bat generator |
| `app/api/admin/discover/[tenantId]/route.ts` | $metadata entity discovery |
| `app/api/admin/entities/[tenantId]/route.ts` | Entity config read/write |
| `app/api/admin/stats/route.ts` | Usage stats |
| `app/api/user/password/route.ts` | Change own password |
| `app/api/bc-test/route.ts` | Diagnostic: test any BC entity |
| `lib/auth.ts` | NextAuth (blocks disabled users) |
| `lib/tenants.ts` | Tenant lookup + OData URL builder |
| `lib/bc-entities.ts` | BC entity catalogue (confirmed real field names) |
| `lib/cloudflare.ts` | Cloudflare API helpers |
| `lib/db.ts` | Prisma client singleton |
| `components/DataVisualizer.tsx` | KPI / table / bar / line chart renderers |
| `scripts/Install-BespoxAI.ps1` | BCAgent v2.1 installer template |
| `prisma/schema.prisma` | Tenant, User, QueryLog, NextAuth models |
| `middleware.ts` | Protect /dashboard, /admin, /api/admin, /api/query |
| `C:\BespoxAI\Agent\BCAgent.ps1` | On-prem proxy v2.1 |

## Prisma Schema (current)
```
Tenant: id, name, tunnelSubdomain, bcInstance, bcCompany, apiKey,
        active, entityConfig(Json?), tunnelId(String?), country(String, default NZ),
        createdAt, updatedAt

User:   id, email, name, password, role, active(Boolean, default true),
        tenantId, createdAt, updatedAt

QueryLog: id, tenantId, userId, question, answer, displayHint,
          data(Json?), entity, recordCount, createdAt
```

## BC Entity Catalogue (confirmed real field names from bc-test)
All entities verified against actual OData responses. Key notes:
- SalesInvoice / PurchaseInvoice / SalesCrMemo — HEADER ONLY, no amount fields
- Amounts on *Lines entities (Line_Amount, Amount_Including_VAT)
- GeneralLedgerEntry — real financial GL (G_L_Account_No, Debit_Amount, Credit_Amount)
- ItemLedgerEntry — inventory movements (requires BC web service published)
- Date filtering on posted document headers returns 400 — fetch all, answerer filters

## API Response Shape
```json
{
  "answer": "CFO-grade natural language...",
  "displayHint": "table | bar_chart | line_chart | kpi | narrative",
  "data": { "columns": [...], "rows": [...] } | { "kpis": [...] } | null,
  "suggestedQueries": ["..."] | undefined,
  "meta": {
    "entity": "Customer",
    "reasoning": "...",
    "recordCount": 100,
    "odataUrl": "https://gwmdev-agent.bespoxai.com/..."
  }
}
```

## Multi-tenant Architecture (current state)
- All queries scoped to `session.user.tenantId` — tenants never see each other's data
- `/admin` is a super-admin portal (Richard only)
- Customers currently have NO self-service — they only see CFO Assistant + Health Scanner

---

## Stage 5 — To Do

### 5.1 Tenant self-service settings page (`/settings`)
Customer-facing equivalent of the admin portal. Visible to tenant_admin role.
- Connection status + BCAgent details
- Generate installer (enter BC credentials → download .bat)
- Entity enable/disable for their own tenant
- User management within their own company (invite, disable, delete)
- Change tenant country setting

### 5.2 Role system upgrade
Currently: `admin` (global superadmin) | `user`
Needed: `superadmin` (Richard) | `tenant_admin` (customer IT/finance lead) | `user`
- `superadmin` — full /admin portal access
- `tenant_admin` — /settings page, manage own tenant's users and entities
- `user` — CFO Assistant only

### 5.3 Access control + tier gating
- CFO Assistant currently open to all users — needs tier check
- Tiers: Free trial (7 days) | Paid | Superadmin (always on)
- Add `tier String @default("trial")` and `trialEndsAt DateTime?` to User or Tenant
- Middleware/API guard: check tier on /api/query
- Blocked users see upgrade prompt instead of CFO Assistant

### 5.4 Demo mode
- Public demo at `/demo` — no login required
- Uses mock BC data (hardcoded responses) to show the full CFO Assistant experience
- CTA buttons: "Start free trial" → signup flow

### 5.5 Self-service signup flow
- Public `/signup` page — collects company name, country, BC version, contact email
- Creates tenant + tenant_admin user + triggers CF tunnel provisioning
- Sends welcome email with login credentials + installer download link
- 7-day trial starts on signup

### 5.6 Requirements builder (new menu item in dashboard)
BespoxAI also offers BC/NAV customisation and localisation services.
Customers should be able to submit requirements from within the platform.

**New nav item:** "Customisations" (between Health Scanner and Cash Flow)

**Features:**
- Requirements form: title, description, BC area (Sales, Purchase, Finance, Inventory, etc.),
  priority (Nice to have / Important / Critical), attachments (screenshots)
- AI assists: user describes what they want in plain English, AI converts to structured
  BC functional spec (user story + acceptance criteria + estimated complexity)
- Requirements list: draft → submitted → in review → quoted → approved → in development → complete
- Admin view: see all requirements across tenants, assign to consultants
- Quote/approval flow: admin adds quote, customer approves

**Prisma model needed:**
```
Requirement: id, tenantId, userId, title, description, bcArea, priority,
             aiSpec(Text?), status, quote(Decimal?), quoteApprovedAt,
             createdAt, updatedAt
```

### 5.7 Stripe billing integration
- Attach Stripe customer to Tenant on signup
- Webhook: payment success → upgrade tier, payment failed → downgrade/warn
- Admin portal: view billing status per tenant

### 5.8 Microsoft SSO (future)
- BC SaaS OAuth via Entra ID
- Button already on login page (disabled) — just needs wiring

## How to Push Code (for Claude)
```bash
cd /tmp/BespokeAI_Web
git remote set-url origin https://{GITHUB_DEPLOY_TOKEN}@github.com/NavSolutionsNZ/BespokeAI_Web.git
git fetch origin main && git rebase origin/main
git push origin HEAD:main
```
