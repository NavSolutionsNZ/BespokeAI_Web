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
- `free` / `assistant` / `manager` / `executive` (+ legacy: `trial` / `paid` / `enterprise`)
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
| Free | $0 | $0 | Customisations + Migration Analyser only |
| Assistant | $299 | $3,289 | + CFO Assistant |
| Manager | $499 | $5,489 | + Future One Day Close |
| Executive | $999 | $10,989 | Everything + 10% off paid services |

### Stripe Env Vars
```
STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
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
  RequirementsBuilder.tsx          → requirements UI + superadmin object upload
  DataVisualizer.tsx / UpgradePrompt.tsx / SuperAdminDashboard.tsx / MigrationAnalyzerLanding.tsx
lib/
  auth.ts / db.ts / email.ts / tenants.ts / tier.ts / roles.ts / bc-entities.ts
  bc-object-parser.ts              → parseObjectFile() + buildObjectContextSection()
  stripe.ts / stripe-prices.ts
public/index.html / favicon.svg
prisma/schema.prisma
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
}
```

## SQL Migrations Applied to Production
```sql
-- TenantObjectFile (latest)
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

-- Onboarding fields
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "navProduct" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "navVersion" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lastCU" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "bcPort" INTEGER DEFAULT 8048;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "agentPort" INTEGER DEFAULT 8080;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "persona" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingDone" BOOLEAN DEFAULT false;

-- Stripe + payment fields (all previously applied — listed for completeness)
-- See previous handoff for full list
```

## AI Spec Generation
- Always a **full rewrite** — synthesises from source inputs only, no history in prompt
- **BC version priority:** onboarding fields (navProduct+navVersion+lastCU) → signup bcVersion code → bcInstance → generic fallback
- **Tenant object context:** all `TenantObjectFile` records (parseError=false) injected via `buildObjectContextSection()` — AI avoids conflicting field/object IDs
- `_history` stored for UI display only — never sent to GPT
- `_genCount` cap: 4 for non-superadmin, unlimited for superadmin

## Deployed BC Object Files
- Upload UI: superadmin requirement detail panel, `fully_paid` status only
- Accepts `.al` (AL) and `.txt` (C/AL) — multiple files per upload
- C/AL `.txt` may contain many objects; parser splits on `OBJECT` boundary automatically
- Best-effort parsing: `parseError=true` on failure — never blocks upload
- Raw file content discarded — only structured `summary` JSON stored
- Scoped to `tenantId` — each customer's object set is independent
- All tenant objects injected into ai-spec prompts for that tenant (across all requirements)

## Completed Stages
- ✅ 5.1–5.10 Core platform (settings, roles, tiers, demo, signup, requirements, admin, migration, passwords, AI spec)
- ✅ 6.1–6.3 Stripe billing (foundation, subscription billing, billing stats)
- ✅ 7.1–7.3 Onboarding wizard, duplicate email check, BC installer settings
- ✅ 8.1 AI spec context isolation — per-requirement, version-aware, no cross-contamination
- ✅ 8.2 Deployed BC object upload — AL/C/AL parser, superadmin upload UI, ai-spec injection

## Next Stages
- **6.4** Customisation payments — Stripe deposit, bypass, pay-in-full, balance
- **6.5** Migration Analyser deposit — $500 NZD gates Phase 2
- **Microsoft SSO** — OAuth for BC SaaS customers
- **Migration Analyser Phase 2** — object upload, AI analysis, PDF report
- **Onboarding refinement** — tier selection, guided IT setup

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
- `useSearchParams()` must be inside `<Suspense>`
- GPT-4o can truncate → always `max_tokens: 4096` + `repairJSON()`
- `STRIPE_PRICE_*` server-only — fetch via `/api/billing/status` in client components
- Stripe SDK v22 requires `apiVersion: '2026-04-22.dahlia'`
- Early `return null` guards must come AFTER all hooks (React error #310)
- Tab state must be URL-tracked — pure `useState` tabs break back button
- Vercel Postgres = raw `ALTER TABLE` SQL only — no `prisma db push`

## Navigation
- `/dashboard` tabs: `?view=xxx` with `router.replace`
- `/admin` tabs: `?tab=xxx` with `router.push`
- Back buttons: `router.back()` not `router.push('/dashboard')`
- Superadmin → `/dashboard` immediately redirects to `/admin` (guard after all hooks)
- New users → `/dashboard` immediately redirects to `/onboarding`
