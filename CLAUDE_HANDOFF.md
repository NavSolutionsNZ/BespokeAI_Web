# BespoxAI — Claude Developer Handoff Context

## GitHub Access
- **Repo:** `NavSolutionsNZ/BespokeAI_Web`
- **Token:** provided by Rich at the start of each session (ask if not provided)
- **Base raw URL:** `https://raw.githubusercontent.com/NavSolutionsNZ/BespokeAI_Web/main/`
- **API URL:** `https://api.github.com/repos/NavSolutionsNZ/BespokeAI_Web/contents/`

## Autonomous Operation Rules — EFFICIENCY FIRST

### DO NOT clone the repo — it burns context and usage
Instead, fetch only the files you need:
```bash
# Read a file
curl -s -H "Authorization: token TOKEN" \
  https://raw.githubusercontent.com/NavSolutionsNZ/BespokeAI_Web/main/path/to/file.tsx

# Push a changed file (get SHA first, then update)
SHA=$(curl -s -H "Authorization: token TOKEN" \
  https://api.github.com/repos/NavSolutionsNZ/BespokeAI_Web/contents/path/to/file.tsx \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")

curl -s -X PUT -H "Authorization: token TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/NavSolutionsNZ/BespokeAI_Web/contents/path/to/file.tsx \
  -d "{"message":"commit message","content":"$(base64 -w0 /tmp/newfile.tsx)","sha":"$SHA"}"
```

### Workflow per change
1. Read the specific file(s) you need via raw GitHub URL
2. Make changes in `/tmp/` or `/home/claude/`
3. Push each file individually via GitHub Contents API
4. For new files (no SHA needed), omit the `sha` field in the PUT body

### When you cannot act autonomously
SQL migrations on Vercel Postgres, environment variables, DNS, Cloudflare tunnel config — provide the exact SQL/command clearly labelled as a **manual step for Rich**.

### Never
- Clone the whole repo
- Ask Rich to copy/paste code
- Ask Rich to run local commands (no local dev environment — everything via Vercel/GitHub)

## Tech Stack
- **Framework:** Next.js 14 (App Router, `'use client'` where needed)
- **Database:** Vercel Postgres via Prisma ORM (`lib/db.ts`)
- **Auth:** NextAuth (`lib/auth.ts`) — credentials provider, bcrypt passwords
- **Email:** Nodemailer via Spacemail SMTP port 587 (`lib/email.ts`)
- **AI:** OpenAI GPT-4o (`OPENAI_API_KEY` env var)
- **BC Connection:** BCAgent proxy via Cloudflare tunnel, OData v4, `X-BespoxAI-Key` header
- **Hosting/CI:** Vercel — auto-deploys on push to `main`
- **Styling:** Inline styles using CSS variables (no Tailwind, no CSS modules)

## CSS Variables (design tokens — defined in `app/globals.css`)
```
--ink: #040E09       (near black)
--forest: #0A5C46    (primary green)
--emerald: #0F6E56
--jade: #1A9272
--gold: #C8952A
--amber: #E8A838
--cream: #F4EFE4     (page background)
--parchment: #EDE8DC
--slate: #3B5249     (secondary text)
--fog: #D6D9D4       (borders)
--white: #FAFAF8
--font-display: 'Cormorant Garamond' (headings)
--font-body: 'DM Sans' (body text)
--font-mono: 'DM Mono' (labels, tags, metadata)
```

## Role System
- `superadmin` — full admin portal access, internal dev tools, no tenant dashboard
- `tenant_admin` — tenant settings, user management, same dashboard as user
- `user` — standard dashboard access
- Displayed as: "Super Admin" / "Admin" / (no label)

## Tier System
- `trial` / `paid` / `enterprise`
- `trialEndsAt` on Tenant model — null means no expiry
- Gate enforced in `/api/query/route.ts` — 402 if tier blocked
- `UpgradePrompt` component shown on dashboard when gated

## File Structure
```
app/
  page.tsx                    → redirects / to /index.html
  layout.tsx                  → root layout with SessionProvider
  globals.css                 → CSS variables + keyframes
  dashboard/page.tsx          → main CFO dashboard (client component)
  admin/page.tsx              → superadmin portal (tenants, users, signups, requirements)
  login/page.tsx              → login form (NextAuth credentials)
  signup/page.tsx             → public signup request form
  demo/page.tsx               → public demo (no auth) with mock BC data
  settings/page.tsx           → tenant settings (tenant_admin)
  api/
    query/route.ts            → main BC OData query endpoint (GPT → OData → response)
    health/route.ts           → BC connection health check
    requirements/
      route.ts                → GET (list) / POST (create) requirements
      [id]/
        route.ts              → PATCH / DELETE requirement
        ai-spec/route.ts      → POST — generate/refine AI functional spec (GPT-4o)
        dev-plan/route.ts     → POST — generate internal dev plan (superadmin only)
    admin/
      requirements/route.ts  → GET all requirements (superadmin)
      users/route.ts
      tenants/route.ts
      signups/[id]/activate/route.ts
      tier-check/route.ts
    auth/[...nextauth]/route.ts
    demo/query/route.ts
    settings/route.ts
    signup/route.ts
    user/change-password/route.ts
components/
  RequirementsBuilder.tsx     → full requirements UI (customer-facing)
  DataVisualizer.tsx          → BC data chart/table renderer
  UpgradePrompt.tsx           → tier gate UI
lib/
  auth.ts                     → NextAuth config
  db.ts                       → Prisma client singleton
  email.ts                    → Nodemailer helpers (welcome, verify, etc.)
  tenants.ts                  → getTenantById, buildODataUrl, TenantConfig
  tier.ts                     → checkTier()
  roles.ts                    → role helpers
  bc-entities.ts              → BC entity/field definitions
public/
  index.html                  → marketing landing page (static HTML/CSS/JS)
  favicon.svg
prisma/
  schema.prisma               → full Prisma schema
scripts/
  migrate-5.6-requirements.sql     → initial Requirement table creation
  migrate-5.6b-payments.sql        → deposit/balance payment columns
```

## Prisma Schema (current — as of last session)
```prisma
model Tenant {
  id              String    @id @default(cuid())
  name            String
  tunnelSubdomain String    @unique
  bcInstance      String    @default("GWM_Dev")
  bcCompany       String    @default("GWM")
  apiKey          String
  active          Boolean   @default(true)
  entityConfig    Json?
  tunnelId        String?
  country         String    @default("NZ")
  tier            String    @default("trial")
  trialEndsAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  users           User[]
  queryLogs       QueryLog[]
  requirements    Requirement[]
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String
  role          String    @default("user")
  active        Boolean   @default(true)
  tenantId      String
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  queryLogs     QueryLog[]
  requirements  Requirement[]
}

model SignupRequest {
  id          String    @id @default(cuid())
  companyName String
  country     String    @default("NZ")
  bcVersion   String    @default("BC25")
  email       String
  verifyToken String    @unique
  verifiedAt  DateTime?
  activatedAt DateTime?
  createdAt   DateTime  @default(now())
}

model Requirement {
  id              String    @id @default(cuid())
  tenantId        String
  userId          String
  title           String
  description     String    @db.Text
  bcArea          String
  priority        String    // nice_to_have | important | critical
  aiSpec          String?   @db.Text  // JSON incl. _genCount, _refinementHistory
  status          String    @default("draft")
  // Status pipeline: draft | submitted | needs_clarification | in_review |
  //   quoted | quote_rejected | deposit_required | deposit_paid |
  //   in_development | complete_pending_payment | fully_paid | rejected
  quote           Decimal?  @db.Decimal(10, 2)
  quoteApprovedAt DateTime?
  depositAmount   Decimal?  @db.Decimal(10, 2)  // auto-set to 20% on acceptance
  depositPaidAt   DateTime?
  balancePaidAt   DateTime?
  consultantNote  String?   @db.Text
  adminQuestions  String?   @db.Text  // current round questions
  customerAnswers String?   @db.Text  // JSON [{q, a}] AI clarification answers
  adminQALog      String?   @db.Text  // JSON [{round, questions, answers, askedAt, answeredAt}]
  quoteRejectedAt      DateTime?
  quoteRejectionReason String?  @db.Text
  devPlan         String?   @db.Text  // superadmin-only internal dev plan JSON
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  tenant          Tenant    @relation(...)
  user            User      @relation(...)
}
```

## SQL Migrations Required on Vercel Postgres
All run via Vercel Dashboard → Storage → your Postgres DB → Query tab.
These have already been applied to production. Documenting for any new environment:
```sql
-- Requirement table (initial)
-- See scripts/migrate-5.6-requirements.sql for full CREATE TABLE

-- Payment fields
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10,2);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "balancePaidAt" TIMESTAMP(3);

-- Dev plan
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "devPlan" TEXT;

-- Quote rejection
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "quoteRejectedAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "quoteRejectionReason" TEXT;

-- Admin Q&A log
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "adminQALog" TEXT;
```

## BC Connection Architecture
- Each tenant has a Cloudflare tunnel (`tunnelSubdomain.bespoxai.com`)
- BC agent runs on-prem, proxies OData requests
- Auth: `X-BespoxAI-Key: <tenant.apiKey>` header on every BC request
- OData base: `https://{tunnelSubdomain}-agent.bespoxai.com/{bcInstance}/ODataV4/Company('{bcCompany}')/`
- Health check: `GET /api/health` — polls BC agent, returns `{ ok, latencyMs, checkedAt }`
- `isConnected = health.status === 'ok'` — never assume connected

## Key Patterns

### BC OData query (from `/api/query/route.ts`)
```typescript
const bcRes = await fetch(odataUrl, {
  headers: { 'X-BespoxAI-Key': tenant.apiKey, Accept: 'application/json' },
  signal: AbortSignal.timeout(30_000),
})
```

### Superadmin guard
```typescript
if ((session.user as any).role !== 'superadmin')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Prisma (use `(prisma as any).model` for newer models not yet in generated types)
```typescript
import { prisma } from '@/lib/db'
const req = await (prisma as any).requirement.findUnique({ where: { id } })
```

### JSON repair (for truncated AI responses)
Both ai-spec and dev-plan routes have a `repairJSON()` function that closes
unclosed braces/brackets from truncated GPT responses. Always set `max_tokens: 4096`.

## Completed Stages
- ✅ 5.1 Tenant settings page
- ✅ 5.2 Role system (superadmin / tenant_admin / user)
- ✅ 5.3 Tier gating (trial / paid / enterprise)
- ✅ 5.4 Public demo at `/demo` with mock BC data
- ✅ 5.5 Self-service signup (form → verify email → admin activates → welcome email)
- ✅ 5.6 Requirements Builder (full end-to-end — see below)

## Stage 5.6 — Requirements Builder (COMPLETE)

### Customer flow
1. New Request form → "Save & Generate Spec →" — spec auto-generates immediately
2. AI spec: user story, acceptance criteria, BC objects, complexity estimate, assumptions, **clarifying questions**
3. Customer answers questions per-question (structured Q&A pairs stored as JSON [{q,a}])
4. "✏ Refine & Regenerate" — opens edit panel: change description, edit user story, edit criteria
5. Up to **4 total generations** (1 initial + 3 refinements) — counter shown, superadmin exempt
6. Submit for Review → admin reviews
7. Admin may "Send Back with Questions" → `needs_clarification` → customer answers → resubmits
8. Admin quotes → customer sees payment terms (20% deposit / 80% balance on completion)
9. Customer accepts → `deposit_required` (20% auto-calculated) → admin confirms deposit → `deposit_paid`
10. Admin starts dev → `in_development` → marks complete → `complete_pending_payment` → confirms balance → `fully_paid`
11. Customer can reject quote (with reason) → admin sees reason, revises quote → customer resubmits

### Admin flow (Customisations tab in `/admin`)
- Sees all tenants' requirements with status badges
- Send Back with Questions → accumulates in `adminQALog` (all rounds preserved)
- **BC Object Editor** — edit/add/remove bcObjects from spec before dev plan
- **AI Dev Plan** (superadmin only, dark panel):
  - Queries live BC instance via OData to get actual field lists before generating
  - Checks if planned fields already exist — flags existing vs missing
  - GPT-4o generates: tasks with hours/phase/AL code snippets, estimated hours, suggested day rate, calculated quote, quoting notes (internal), risks, testing plan, deployment notes
  - Code snippets: filename + placement instruction + AL code block
  - BC connection status shown: `🔌 BC live · Item, Customer` or not connected

### Status colour coding
- Red: `rejected`, `quote_rejected`, `needs_clarification`
- Amber: `submitted`, `in_review`, `deposit_required`, `complete_pending_payment`
- Green: `quoted`, `deposit_paid`, `in_development`, `fully_paid`

### Key files
- `components/RequirementsBuilder.tsx` — customer-facing full UI (~800 lines)
- `app/admin/page.tsx` — admin portal including `AdminRequirementsTab` (~1400 lines)
- `app/api/requirements/route.ts` — list + create
- `app/api/requirements/[id]/route.ts` — PATCH (status transitions, bcObjects patch, adminQALog accumulation) / DELETE
- `app/api/requirements/[id]/ai-spec/route.ts` — AI spec generation with refinement mode, genCount, adminQALog context
- `app/api/requirements/[id]/dev-plan/route.ts` — internal dev plan, live BC field introspection, superadmin only
- `app/api/admin/requirements/route.ts` — all-tenants view, strips devPlan from non-superadmin

## Dashboard
- `app/dashboard/page.tsx` — main client component (~1000 lines)
- Nav persists in URL `?view=xxx` — refresh lands on correct tab
- Views: `assistant` | `health` | `customisations` | `cashflow`* | `monthend`* | `migration`*  (*soon)
- `isConnected = health.status === 'ok'` — greeting and overview cards only shown when truly connected
- **OverviewCards** component: fetches 4 live KPI cards in parallel (overdue debtors, cash, payables, revenue) — clickable to drill into assistant
- `<Suspense>` wraps `DashboardInner` for `useSearchParams()`

## Navigation (fully wired)
- `/` → redirects to `/index.html` (marketing page)
- `/index.html` — all CTA buttons → `/login`
- `/login` → on success → `/dashboard`; has "Request access →" link to `/signup`
- `/signup` — logo links home; success links back to `/login`
- `/demo` — public, no auth, mock BC data
- `/admin` — superadmin only (middleware protected)
- `/settings` — tenant_admin only

## Next Stages (not started)
- **5.7 Stripe billing** — subscription management, webhook handling
- **5.8 Microsoft SSO** — OAuth for BC SaaS customers

## Known Patterns / Gotchas
- Prisma `(prisma as any).model` needed for `Requirement` until `prisma generate` is run — Vercel handles this at build time
- `useSearchParams()` must be inside `<Suspense>` in Next.js App Router — see `DashboardPage` wrapper pattern
- `[...new Set(arr)]` fails TypeScript — use `Array.from(new Set(arr))`
- Literal type comparisons (e.g. `const X = 3` then `X !== 1`) cause TS errors — avoid or cast
- GPT-4o responses can truncate → always set `max_tokens: 4096` and use `repairJSON()` fallback
- `devPlan` field is stripped from GET `/api/requirements` responses for non-superadmin users
- `adminQALog` accumulates all question rounds — never overwrites, always appends
- Dashboard health check polls every 30s; `isConnected` only true when `health.status === 'ok'`
- Vercel Postgres schema changes = raw SQL `ALTER TABLE` — no `prisma db push` in production
- No local dev environment — Rich works entirely through GitHub → Vercel
