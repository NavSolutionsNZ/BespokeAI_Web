# BespoxAI — Claude Developer Handoff Context

## GitHub Access
- **Repo:** `NavSolutionsNZ/BespokeAI_Web`
- **Token:** provided by Rich at the start of each session (ask if not provided)

## ⚡ Git Workflow (IMPORTANT — use this every session)

`api.github.com` is blocked by the egress proxy. Use **sparse clone via git** instead:

```bash
# 1. Clone (sparse, depth 1 — fast and lean)
cd /tmp && git clone \
  --depth 1 --filter=blob:none --sparse \
  https://TOKEN@github.com/NavSolutionsNZ/BespokeAI_Web.git

# 2. Fetch only the files you need
cd BespokeAI_Web
git sparse-checkout set --skip-checks \
  path/to/file.tsx \
  another/file.ts

# 3. Configure git identity (once per session)
git config user.email "claude@anthropic.com"
git config user.name "Claude"
git remote set-url origin https://TOKEN@github.com/NavSolutionsNZ/BespokeAI_Web.git

# 4. Push directly to main (until Rich instructs otherwise — no feature branches needed)
git checkout main
git add --sparse path/to/file.tsx
git commit -m "feat: description"
git push origin main

# To add more files mid-session:
git sparse-checkout set --skip-checks existing/file.tsx new/file.tsx
```

**Key rules:**
- **Push directly to `main`** — Rich confirmed, until preview deployments are enabled
- Always `git add --sparse` (not plain `git add`) for files outside the sparse cone
- `git pull origin main --quiet` at session start if repo was cloned in a previous session
- New files in new directories: create the directory and file, then `git add --sparse`
- **Only sparse-checkout the exact files being edited** — never pull the whole repo
- Unicode in files will break `str_replace` — use Python string replacement instead

## When you cannot act autonomously
SQL migrations on Vercel Postgres, environment variables, DNS, Cloudflare tunnel config — provide the exact SQL/command clearly labelled as a **manual step for Rich**.

## Tech Stack
- **Framework:** Next.js 14 (App Router, `'use client'` where needed)
- **Database:** Vercel Postgres via Prisma ORM (`lib/db.ts`)
- **Auth:** NextAuth (`lib/auth.ts`) — credentials provider, bcrypt passwords, JWT strategy
- **Email:** Nodemailer via Spacemail SMTP port 587 (`lib/email.ts`)
- **AI:** OpenAI GPT-4o (`OPENAI_API_KEY` env var)
- **BC Connection:** BCAgent proxy via Cloudflare tunnel, OData v4, `X-BespoxAI-Key` header
- **Payments:** Stripe SDK v22 (`stripe` package) — subscriptions + one-time payments
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
- `superadmin` — full admin portal at `/admin`, redirected away from `/dashboard`
- `tenant_admin` — tenant settings, user management, same dashboard as user
- `user` — standard dashboard access

## Tier System
- `free` / `starter` / `assistant` / `manager` / `executive` (+ legacy: `trial` / `paid` / `enterprise`)
- `trialEndsAt` on Tenant model — null means no expiry
- Gate enforced in `/api/query/route.ts` — 402 if tier blocked
- `checkTierAccess()` in `lib/tier.ts` — handles all tier names incl. legacy
- `checkFeatureAccess()` in `lib/tier.ts` — gates specific features per plan

## Stripe Billing
- **SDK:** `stripe` v22, API version `2026-04-22.dahlia`
- **Singleton:** `lib/stripe.ts` — lazy-init proxy (safe at build time)
- **Plan switch:** in-place via `stripe.subscriptions.update()` — no new Checkout Session
- **Upgrades** immediate; **downgrades** at next billing date
- **Webhook:** `POST /api/webhooks/stripe` — whitelisted in middleware (no auth)

### Plans & Pricing (NZD)
| Plan | Monthly | Annual | Features |
|------|---------|--------|----------|
| Free | $0 | $0 | Data health scanner + up to 3 requirement scopes/month |
| Starter | $59 | TBD | Unlimited scoping + full feasibility output (cost/time indication) |
| Assistant | $299 | $3,289 | + CFO Assistant (live BC/NAV data queries) |
| Manager | $499 | $5,489 | + One Day Close |
| Executive | $999 | $10,989 | Everything + 10% off all development services |

### Development Services (separate to subscription)
- Fixed price, quoted from the scoped requirement spec
- 20% deposit to start, balance on delivery
- Typical range: $2–5k NZD (simple), $5–15k (medium), $15k+ (complex)
- Executive subscribers receive 10% off all quoted work

### Stripe Env Vars
```
STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER_MONTHLY / ANNUAL
STRIPE_PRICE_ASSISTANT_MONTHLY / ANNUAL
STRIPE_PRICE_MANAGER_MONTHLY / ANNUAL
STRIPE_PRICE_EXECUTIVE_MONTHLY / ANNUAL
```

### Webhook Events Handled
- `customer.subscription.created/updated` → update tenant tier + subscription fields
- `customer.subscription.deleted` → tier = `free`
- `checkout.session.completed` → link stripeCustomerId
- `invoice.payment_succeeded` → subscriptionStatus = active
- `invoice.payment_failed` → subscriptionStatus = past_due

## File Structure
```
app/
  page.tsx                         → redirects / to /index.html
  layout.tsx                       → root layout with SessionProvider
  globals.css                      → CSS variables + keyframes
  dashboard/page.tsx               → CFO dashboard (superadmin redirected to /admin)
  onboarding/page.tsx              → first-login onboarding wizard (5 steps)
  admin/page.tsx                   → superadmin portal
  billing/page.tsx                 → pricing page
  login / forgot-password / reset-password / signup / demo pages
  api/
    query/route.ts                 → main BC OData query endpoint
    health/route.ts                → BC connection health check
    history/route.ts               → query log history
    onboarding/route.ts            → GET (prefill) / POST (save + mark done)
    billing/
      status / create-checkout / create-portal
    requirements/
      route.ts                     → GET list / POST create
      [id]/
        route.ts                   → PATCH / DELETE
        ai-spec/route.ts           → POST — full-rewrite AI spec (version-aware + object context)
        feasibility/route.ts       → POST — lightweight GPT classification (cfo_assistant/development/infeasible)
        dev-plan/route.ts          → POST — internal dev plan (superadmin only)
        objects/
          route.ts                 → GET list / POST upload+parse
          [fileId]/route.ts        → DELETE
    admin/
      requirements / users / tenants / signups/[id]/activate
      tier-check / migration-enquiries / tenant-health/[tenantId]
      billing-stats / installer/[tenantId]
    auth/ [...nextauth] / forgot-password / reset-password
    demo/query / migration/enquiry / settings / settings/installer
    signup / user/change-password / webhooks/stripe
components/
  RequirementsBuilder.tsx          → requirements UI + feasibility card + superadmin object upload
  DataVisualizer.tsx / UpgradePrompt.tsx / SuperAdminDashboard.tsx / MigrationAnalyzerLanding.tsx
lib/
  auth.ts / db.ts / email.ts / tenants.ts / tier.ts / roles.ts / bc-entities.ts
  bc-object-parser.ts              → parseObjectFile() + buildObjectContextSection()
  stripe.ts / stripe-prices.ts
public/
  index.html                       → public homepage (see Homepage section below)
  favicon.svg
prisma/schema.prisma
bespoxai-test.mjs                  → automated regression suite (42 assertions)
REQUIREMENTS_AUTOTESTING_CONTEXT.md
FEASIBILITY_TEST.md                → manual + automated testing guide for feasibility feature
```

## Prisma Schema (current — key models)
```prisma
model Tenant {
  id / name / tunnelSubdomain / bcInstance / bcCompany / apiKey / active
  entityConfig / tunnelId / country
  navProduct  String?   // "BC" | "NAV" | "unsure"
  navVersion  String?   // e.g. "Business Central 2024 Wave 2 (BC25)"
  lastCU      String?   // e.g. "CU3"
  bcPort      Int       @default(8048)
  agentPort   Int       @default(8080)
  tier        String    @default("trial")
  trialEndsAt / stripeCustomerId / stripeSubscriptionId / stripePriceId
  subscriptionStatus / cancelledAt / cancellationReason / cancellationFeedback
  createdAt / updatedAt
  relations: users / queryLogs / requirements / migrationEnquiries / objectFiles
}

model User {
  id / email / name / password
  role           String   @default("user")   // superadmin | tenant_admin | user
  persona        String?                     // cfo | finance | it | other
  onboardingDone Boolean  @default(false)
  active / tenantId / createdAt / updatedAt
  relations: accounts / sessions / queryLogs / requirements / migrationEnquiries / uploadedObjects
}

model Requirement {
  id / tenantId / userId / title / description / bcArea / priority
  aiSpec          String?   @db.Text   // JSON spec output
  status          String    @default("draft")
  // Status flow: draft → submitted → in_review → quoted → deposit_required
  //              → deposit_paid → in_development → complete_pending_payment → fully_paid
  // Also: needs_clarification / quote_rejected / rejected
  quote / quoteApprovedAt / depositAmount / depositPaidAt / balancePaidAt
  consultantNote / adminQuestions / customerAnswers / adminQALog
  quoteRejectedAt / quoteRejectionReason / devPlan
  depositStripeSessionId / depositBypassed / fullPaymentRequested
  fullPaymentApproved / balanceStripeSessionId

  // Feasibility check — populated by POST /api/requirements/[id]/feasibility
  feasibility          String?   // "cfo_assistant" | "development" | "infeasible"
  feasibilityNotes     String?   @db.Text   // plain-English explanation
  feasibilityCostRange String?   // "2-5k" | "5-15k" | "15k+" (development only)
  feasibilityCheckedAt DateTime?

  createdAt / updatedAt
  relations: tenant / user / objects (TenantObjectFile[])
}

model TenantObjectFile {
  id            String    @id @default(cuid())
  tenantId      String    // FK → Tenant
  requirementId String?   // FK → Requirement (nullable)
  filename      String
  objectType    String    @default("Unknown") // Table, TableExtension, Page, Codeunit, Enum...
  objectId      Int?      // BC object number e.g. 50100
  objectName    String
  language      String    @default("AL")      // "AL" | "CAL"
  summary       Json      @default("{}")       // parsed structure — never raw content
  parseError    Boolean   @default(false)
  uploadedAt    DateTime  @default(now())
  uploadedById  String    // FK → User
  relations: tenant / requirement / uploadedBy
}
```

## SQL Migrations Applied to Production
```sql
-- TenantObjectFile (session 8)
CREATE TABLE "TenantObjectFile" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "requirementId" TEXT,
  "filename" TEXT NOT NULL, "objectType" TEXT NOT NULL DEFAULT 'Unknown',
  "objectId" INTEGER, "objectName" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'AL',
  "summary" JSONB NOT NULL DEFAULT '{}', "parseError" BOOLEAN NOT NULL DEFAULT false,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "uploadedById" TEXT NOT NULL,
  CONSTRAINT "TenantObjectFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantObjectFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"),
  CONSTRAINT "TenantObjectFile_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL,
  CONSTRAINT "TenantObjectFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
);
CREATE INDEX "TenantObjectFile_tenantId_idx" ON "TenantObjectFile"("tenantId");
CREATE INDEX "TenantObjectFile_requirementId_idx" ON "TenantObjectFile"("requirementId");

-- Onboarding fields (session 7)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "navProduct" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "navVersion" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lastCU" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "bcPort" INTEGER DEFAULT 8048;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "agentPort" INTEGER DEFAULT 8080;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "persona" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingDone" BOOLEAN DEFAULT false;

-- Feasibility check fields (session 10) ✅ applied
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibility" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibilityNotes" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibilityCostRange" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibilityCheckedAt" TIMESTAMP(3);
```

## Homepage (`public/index.html`)
The public homepage was comprehensively rewritten in session 10. Key sections:

- **Hero:** "Your Business Central. One portal. Complete control."
- **Marquee:** Feasibility Analysis · CFO AI Assistant · Fixed-Price Development · Requirement Scoping · Data Health Scanning · Project Pipeline · NAV Migration Analysis · Bring Your Own Partner
- **Problem section:** Three cards — answers that take days / ideas that die in a calendar / partner bottlenecks. Comparison table vs traditional BC partner (not Copilot).
- **How it Works:** Ask → Scope → Build three-act flow. Know Before You Commit panel (forest green, inside How it Works section).
- **Partner Flex:** Option A (take spec to your partner) / Option B (let BespoxAI build it — fixed price, 20% deposit).
- **Pipeline Visual:** Five stages — Scoping / Quoted / Accepted / In Progress / Complete.
- **Connected Intelligence:** Dark section explaining how the BespoxAI profile builds over time. Data ownership panel ("Your data. Always yours.").
- **Pricing:** Free (3 scopes/month) → Starter $59 → Assistant $299 → Manager $499 → Executive $999 → Development Services (fixed fee). Migration Analyser callout below pricing.
- **Design tokens:** Uses existing CSS variables. New CSS classes: `.flow-grid`, `.flow-step`, `.pf-grid`, `.pf-card`, `.pipe-vis`, `.pipe-stage`, `.ci-grid`, `.ci-items`, `.own-panel`, `.kbc-wrap`, `.mig-callout`.

## AI Spec Generation
- Always a **full rewrite** — synthesises from source inputs only, no history in prompt
- **BC version priority:** onboarding fields (navProduct+navVersion+lastCU) → signup bcVersion code → bcInstance → generic fallback
- **Tenant object context:** all `TenantObjectFile` records (parseError=false) injected via `buildObjectContextSection()` — AI avoids conflicting field/object IDs
- `_history` stored for UI display only — never sent to GPT
- `_genCount` cap: 4 for non-superadmin, unlimited for superadmin
- **Spec is only triggered manually** (button click) after feasibility check returns `development`

## Feasibility Check
- **Route:** `POST /api/requirements/[id]/feasibility`
- **Triggered:** automatically on first save (`createReq()` in RequirementsBuilder calls it instead of generateSpec)
- **Model:** GPT-4o, max_tokens 600, temperature 0.2
- **Output:** `feasibility` (cfo_assistant | development | infeasible) + `feasibilityNotes` + `feasibilityCostRange` (development only)
- **UI:** Card shown in requirement detail panel before pipeline stages
  - `cfo_assistant` → amber card, "Try CFO Assistant" button + "Scope as development anyway" secondary option
  - `development` → green card with cost range badge, "Generate Full Specification →" button
  - `infeasible` → red card with notes, "Contact us to discuss" mailto link
- **List view:** Small badges — "💡 no dev needed" (amber) and "⚠ constrained" (red)
- **Re-runnable:** calling the endpoint again overwrites previous result
- **Superadmin** can call feasibility on any tenant's requirement
- **Cost ranges:** `2-5k` = simple (fields, basic workflows), `5-15k` = medium (multi-object, integrations), `15k+` = complex (architectural, large-scale)
- See `FEASIBILITY_TEST.md` for full manual and automated testing guide

## Deployed BC Object Files
- Upload UI: superadmin requirement detail panel, `fully_paid` status only
- Accepts `.al` (AL) and `.txt` (C/AL) — multiple files per upload
- C/AL `.txt` may contain many objects; parser splits on `OBJECT` boundary automatically
- Best-effort parsing: `parseError=true` on failure — never blocks upload
- Raw file content discarded — only structured `summary` JSON stored
- Scoped to `tenantId` — each customer's object set is independent
- All tenant objects injected into ai-spec prompts for that tenant (across all requirements)

## Automated Test Suite
- **Runner:** `bespoxai-test.mjs` in repo root
- **Doc:** `REQUIREMENTS_AUTOTESTING_CONTEXT.md` (suite overview) + `FEASIBILITY_TEST.md` (feasibility-specific)
- **Total:** 42 assertions across 10 test sections
- **Run:** `node bespoxai-test.mjs` (Node 18+, no npm install needed)
- **Corporate proxy:** set `HTTPS_PROXY` env var before running if on VGNET
- **Config block** at top of `bespoxai-test.mjs` — edit `superadminPassword` and optionally pin requirement IDs
- Covers: auth, objects API (GET/POST/DELETE), AL parse, C/AL multi-object parse, parse error handling, access control, BC version in spec, spec context isolation, feasibility check (10 assertions)
- **Route returns full requirement object list after every write** — always find uploaded records by filename, not by index

## Completed Stages
- ✅ 5.1–5.10 Core platform (settings, roles, tiers, demo, signup, requirements, admin, migration, passwords, AI spec)
- ✅ 6.1–6.3 Stripe billing (foundation, subscription billing, billing stats)
- ✅ 7.1–7.3 Onboarding wizard, duplicate email check, BC installer settings
- ✅ 8.1 AI spec context isolation — per-requirement, version-aware, no cross-contamination
- ✅ 8.2 Deployed BC object upload — AL/C/AL parser, superadmin upload UI, ai-spec injection
- ✅ 9.1 Automated regression test suite for session 8 features (32/32 passing)
- ✅ 9.2 Bug fixes: TenantObjectFile missing from schema.prisma, admin table overflow, superadmin onboarding redirect race
- ✅ 10.1 Homepage complete rewrite — unified BC portal positioning, new tier structure, new sections
- ✅ 10.2 Starter tier ($59/mo) added — feasibility + unlimited scoping, no CFO Assistant
- ✅ 10.3 Feasibility check feature — auto-runs on first requirement save, classifies as cfo_assistant/development/infeasible, cost range, persisted to DB
- ✅ 10.4 Automated test suite extended to 42 assertions (10 new feasibility tests)

## Next Stages
- **6.4** Customisation payments — Stripe deposit, bypass, pay-in-full, balance
- **6.5** Migration Analyser deposit — $500 NZD gates Phase 2
- **Starter tier** — add to Stripe (price IDs), add to `checkTierAccess()` in `lib/tier.ts`
- **Microsoft SSO** — OAuth for BC SaaS customers
- **Migration Analyser Phase 2** — object upload, AI analysis, PDF report
- **Onboarding refinement** — tier selection, guided IT setup
- **Pipeline UI refinement** — status labels, milestone visibility, customer-facing progress view

## Key Patterns

### Superadmin guard
```typescript
if ((session.user as any).role !== 'superadmin')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Prisma newer models
```typescript
const rec = await (prisma as any).tenantObjectFile.findMany({ where: { tenantId } })
```

### Feasibility route pattern (lightweight GPT call)
```typescript
// temperature 0.2, max_tokens 600 — fast classification, not spec generation
// Always use repairJSON() on response — GPT occasionally truncates
// Validate enum value before writing to DB
if (!['cfo_assistant', 'development', 'infeasible'].includes(feasibility))
  throw new Error('Unexpected classification value')
```

### Stripe singleton
```typescript
import { stripe } from '@/lib/stripe'  // never instantiate directly
```

### Unicode-safe file editing
```python
with open('file.tsx', 'r', encoding='utf-8') as f: content = f.read()
content = content.replace('old', 'new')
with open('file.tsx', 'w', encoding='utf-8') as f: f.write(content)
```

## Known Gotchas
- `Array.from(str.matchAll(re))` — never `[...str.matchAll(re)]` (TS downlevel error)
- Multi-line `Array.from(matchAll(...))` — closing must be `))` not `)]`
- `Array.from(new Set(arr))` — never `[...new Set(arr)]`
- `(prisma as any).model` for models added after last Vercel type regeneration
- **Always add new models to `schema.prisma`** — SQL migration alone is not enough; `prisma generate` runs from the schema at build time, so a model missing from the schema causes blank 500s at runtime even if the table exists in the DB
- `useSearchParams()` must be inside `<Suspense>`
- GPT-4o can truncate → always `max_tokens: 4096` + `repairJSON()` for spec; `max_tokens: 600` is enough for feasibility classification
- `STRIPE_PRICE_*` server-only — fetch via `/api/billing/status` in client components
- Stripe SDK v22 requires `apiVersion: '2026-04-22.dahlia'`
- Early `return null` guards must come AFTER all hooks (React error #310)
- Tab state must be URL-tracked — pure `useState` tabs break back button
- Vercel Postgres = raw `ALTER TABLE` SQL only — no `prisma db push`
- **Node 24 ESM**: `await` inside a bare `{}` block at module level is a syntax error — put async logic inside `async function` or use an async IIFE
- **Admin tables**: use `overflowX: auto` + `minWidth` on table wrappers — `overflow: hidden` clips action button columns
- **Parallel useEffects**: when multiple redirects fire from the same component, guard each with role checks or they race
- **Homepage CSS**: `prod-sec` background is `rgba(244,239,228,.015)` — nearly transparent, renders white on white page. Text inside `prod-item` (which has `background:var(--ink)`) uses cream colours. Text outside prod-items (headings, sub-text) must use dark colours (`var(--slate)` or `var(--ink)`).
- **Feasibility state**: `feasLoadingId` (string|null) not a boolean — tracks which specific requirement is being checked, avoids showing spinner on wrong requirement if user clicks away mid-check

## Navigation
- `/dashboard` tabs: `?view=xxx` with `router.replace`
- `/admin` tabs: `?tab=xxx` with `router.push`
- Back buttons: `router.back()` not `router.push('/dashboard')`
- Superadmin → `/dashboard` immediately redirects to `/admin` (guard after all hooks)
- New users (non-superadmin only) → `/dashboard` immediately redirects to `/onboarding`
- CFO Assistant tab: `/dashboard?view=chat` — used by feasibility card "Try CFO Assistant" button
