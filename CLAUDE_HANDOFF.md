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

# 4. Create a feature branch (never commit directly to main)
git checkout -b feature/your-feature-name

# 5. Edit files in place, then commit and push
git add --sparse path/to/file.tsx another/file.ts
git commit -m "feat: description"
git push origin feature/your-feature-name

# 6. When approved, merge to main
git fetch origin main && git checkout main
git merge --no-ff feature/your-feature-name -m "merge: description"
git push origin main

# For new files (not yet in repo), just create them and add --sparse works fine
# To add more files mid-session:
git sparse-checkout set --skip-checks existing/file.tsx new/file.tsx
```

**Key rules:**
- **Always use a feature branch** — never commit directly to `main`. `main` auto-deploys to Vercel.
- Always `git add --sparse` (not plain `git add`) for files outside the sparse cone
- Always `git pull origin main --quiet` at session start if repo was cloned in a previous session
- New files in new directories: create the directory and file, then `git add --sparse`
- Read files with `cat`, edit with `str_replace` or full rewrites via `cat > file << 'EOF'`
- **Only sparse-checkout the exact files being edited** — never pull the whole repo (usage cost)
- Unicode in files (em-dashes etc.) will break `str_replace` — use Python string replacement instead

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
- Displayed as: "Super Admin" / "Admin" / (no label)

## Tier System
- `free` / `assistant` / `manager` / `executive` (+ legacy: `trial` / `paid` / `enterprise`)
- `trialEndsAt` on Tenant model — null means no expiry
- Gate enforced in `/api/query/route.ts` — 402 if tier blocked
- `UpgradePrompt` component shown on dashboard when gated
- `checkTierAccess()` in `lib/tier.ts` — handles all tier names incl. legacy
- `checkFeatureAccess()` in `lib/tier.ts` — gates specific features per plan

## Stripe Billing
- **SDK:** `stripe` v22, API version `2026-04-22.dahlia`
- **Singleton:** `lib/stripe.ts` — lazy-init proxy (safe at build time)
- **Plan config:** `lib/stripe-prices.ts` — plan definitions, `mrrOf()`, `getPlanByPriceId()`
- **Adaptive Pricing:** enabled in Stripe dashboard — auto-converts NZD to customer's local currency
- **Webhook:** `POST /api/webhooks/stripe` — whitelisted in middleware (no auth)
- **Plan switch:** existing active subscription is updated in-place via `stripe.subscriptions.update()` with prorations — no new Checkout Session created
- **Upgrades** take effect immediately; **downgrades** apply at next billing date
- **Cancellation survey** can be enabled in Stripe → Settings → Billing → Customer Portal

### Plans & Pricing (NZD)
| Plan | Monthly | Annual | Features |
|------|---------|--------|----------|
| Free | $0 | $0 | Customisations + Migration Analyser only |
| Assistant | $299 | $3,289 | + CFO Assistant |
| Manager | $499 | $5,489 | + Future One Day Close |
| Executive | $999 | $10,989 | Everything + 10% off paid services |

### Stripe Env Vars (all set in Vercel)
```
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ASSISTANT_MONTHLY
STRIPE_PRICE_ASSISTANT_ANNUAL
STRIPE_PRICE_MANAGER_MONTHLY
STRIPE_PRICE_MANAGER_ANNUAL
STRIPE_PRICE_EXECUTIVE_MONTHLY
STRIPE_PRICE_EXECUTIVE_ANNUAL
```

### Webhook Events Handled
- `customer.subscription.created/updated` → update tenant tier + subscription fields
- `customer.subscription.deleted` → tier → `free`, store cancellation reason/feedback
- `checkout.session.completed` → link stripeCustomerId; handle one-time payment metadata
- `invoice.payment_succeeded` → keep subscriptionStatus = active
- `invoice.payment_failed` → subscriptionStatus = past_due

## File Structure
```
app/
  page.tsx                         → redirects / to /index.html
  layout.tsx                       → root layout with SessionProvider
  globals.css                      → CSS variables + keyframes
  dashboard/page.tsx               → CFO dashboard (superadmin redirected to /admin)
  onboarding/page.tsx              → first-login onboarding wizard (5 steps)
  admin/page.tsx                   → superadmin portal (overview, tenants, users, signups, requirements)
  billing/page.tsx                 → pricing page — monthly/annual toggle, plan cards, checkout
  login/page.tsx                   → login form with "Forgot password?" link
  forgot-password/page.tsx         → enter email to receive reset link
  reset-password/page.tsx          → enter new password (reads ?token=&email= from URL)
  signup/page.tsx                  → public signup request form
  demo/page.tsx                    → public demo (no auth) with mock BC data
  settings/page.tsx                → tenant settings (tenant_admin) — Overview, Users, Entities, BC Installer tabs
  api/
    query/route.ts                 → main BC OData query endpoint (GPT → OData → response)
    health/route.ts                → BC connection health check
    history/route.ts               → query log history
    onboarding/route.ts            → GET (prefill from User+Tenant+SignupRequest) / POST (save + mark done)
    billing/
      status/route.ts              → GET — tier, subscriptionStatus, price IDs (server→client)
      create-checkout/route.ts     → POST — new Checkout Session OR in-place sub update
      create-portal/route.ts       → POST — Stripe Customer Portal session
    requirements/
      route.ts                     → GET (list) / POST (create)
      [id]/
        route.ts                   → PATCH / DELETE
        ai-spec/route.ts           → POST — full-rewrite AI spec with all context
        dev-plan/route.ts          → POST — internal dev plan (superadmin only)
    admin/
      requirements/route.ts        → GET all requirements (superadmin)
      users/route.ts
      tenants/route.ts             → GET (includes queryLogs + _count.requirements) / POST
      signups/[id]/activate/route.ts
      tier-check/route.ts
      migration-enquiries/route.ts → GET all / PATCH status
      tenant-health/[tenantId]/route.ts → live BC health check for any tenant
      billing-stats/route.ts       → GET — MRR, new subs, upgrades, downgrades, cancellations
      installer/[tenantId]/route.ts → POST — generates pre-configured BCAgent installer zip
    auth/
      [...nextauth]/route.ts
      forgot-password/route.ts     → generate reset token, send email
      reset-password/route.ts      → validate token, update password
    demo/query/route.ts
    migration/enquiry/route.ts     → POST — save MigrationEnquiry + send email
    settings/route.ts              → GET tenant / PATCH (country, bcInstance, bcCompany, bcPort, agentPort, navProduct, navVersion, lastCU)
    settings/installer/route.ts    → POST — tenant-facing installer download (proxies to admin installer)
    signup/route.ts                → POST — checks User table + pending SignupRequests before creating
    user/change-password/route.ts
    webhooks/
      stripe/route.ts              → POST — Stripe webhook handler (no auth)
components/
  RequirementsBuilder.tsx          → customer-facing requirements UI
  DataVisualizer.tsx               → BC data chart/table renderer
  UpgradePrompt.tsx                → tier gate UI
  SuperAdminDashboard.tsx          → superadmin overview: attention items, billing stats, tenant health, migration enquiries
  MigrationAnalyzerLanding.tsx     → customer-facing migration analysis sales/lead page
lib/
  auth.ts           → NextAuth config — JWT carries tenantId, role, persona, onboardingDone; refreshes on update()
  db.ts             → Prisma client singleton
  email.ts          → sendVerificationEmail, sendWelcomeEmail, sendEmail, sendPasswordResetEmail
  tenants.ts        → getTenantById, buildODataUrl, TenantConfig (includes navProduct, navVersion, lastCU, bcPort, agentPort)
  tier.ts           → checkTierAccess(), checkFeatureAccess()
  roles.ts          → role helpers
  bc-entities.ts    → BC entity/field definitions
  stripe.ts         → Stripe client singleton (lazy-init proxy)
  stripe-prices.ts  → plan config, price IDs, mrrOf(), planLabel(), tierOf()
public/
  index.html        → marketing landing page (static HTML/CSS/JS)
  favicon.svg
prisma/
  schema.prisma     → full Prisma schema
```

## Prisma Schema (current)
```prisma
model Tenant {
  id                   String             @id @default(cuid())
  name                 String
  tunnelSubdomain      String             @unique
  bcInstance           String             @default("GWM_Dev")
  bcCompany            String             @default("GWM")
  apiKey               String
  active               Boolean            @default(true)
  entityConfig         Json?
  tunnelId             String?
  country              String             @default("NZ")
  navProduct           String?                    // "BC" | "NAV" | "unsure"
  navVersion           String?                    // e.g. "Business Central 2024 Wave 2 (BC25)"
  lastCU               String?                    // e.g. "CU3" — free text
  bcPort               Int                @default(8048)   // OData port — injected into installer
  agentPort            Int                @default(8080)   // BCAgent port — injected into installer
  tier                 String             @default("trial") // free | assistant | manager | executive (+ legacy: trial | paid | enterprise)
  trialEndsAt          DateTime?
  stripeCustomerId     String?
  stripeSubscriptionId String?
  stripePriceId        String?
  subscriptionStatus   String?  @default("inactive")
  cancelledAt          DateTime?
  cancellationReason   String?
  cancellationFeedback String?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  users                User[]
  queryLogs            QueryLog[]
  requirements         Requirement[]
  migrationEnquiries   MigrationEnquiry[]
}

model User {
  id                 String             @id @default(cuid())
  email              String             @unique
  name               String?
  password           String
  role               String             @default("user")       // superadmin | tenant_admin | user
  persona            String?                                   // cfo | finance | it | other
  onboardingDone     Boolean            @default(false)
  active             Boolean            @default(true)
  tenantId           String
  tenant             Tenant             @relation(fields: [tenantId], references: [id])
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  accounts           Account[]
  sessions           Session[]
  queryLogs          QueryLog[]
  requirements       Requirement[]
  migrationEnquiries MigrationEnquiry[]
}
```
(Other models — MigrationEnquiry, Requirement, QueryLog, Account, Session, VerificationToken, SignupRequest — unchanged from previous session.)

## SQL Migrations Applied to Production
```sql
-- Onboarding + BC system config fields (applied this session)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "navProduct"  TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "navVersion"  TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "lastCU"      TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "bcPort"      INTEGER DEFAULT 8048;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "agentPort"   INTEGER DEFAULT 8080;
ALTER TABLE "User"   ADD COLUMN IF NOT EXISTS "persona"     TEXT;
ALTER TABLE "User"   ADD COLUMN IF NOT EXISTS "onboardingDone" BOOLEAN DEFAULT false;

-- Stripe fields on Tenant (previous session)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT DEFAULT 'inactive';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cancellationFeedback" TEXT;

-- Payment fields on Requirement (previous session)
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositStripeSessionId" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositBypassed" BOOLEAN DEFAULT false;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "fullPaymentRequested" BOOLEAN DEFAULT false;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "fullPaymentApproved" BOOLEAN DEFAULT false;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "balanceStripeSessionId" TEXT;

-- Payment fields on MigrationEnquiry (previous session)
ALTER TABLE "MigrationEnquiry" ADD COLUMN IF NOT EXISTS "depositStripeSessionId" TEXT;
ALTER TABLE "MigrationEnquiry" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3);

-- Earlier migrations (already applied)
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10,2);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "balancePaidAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "devPlan" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "quoteRejectedAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "quoteRejectionReason" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "adminQALog" TEXT;
```

## Onboarding Wizard (NEW — completed this session)

### Flow
```
Login → /onboarding (if onboardingDone = false) → /dashboard
```
All existing users were set to `onboardingDone = false` by the migration and will be routed through it on next login. This is intentional — it collects BC version, CU, and port info retroactively.

### Steps
1. **Role** — persona selection (CFO / Finance / IT / Other)
2. **System** — BC or NAV product, version, last CU (pre-filled from SignupRequest.bcVersion and/or saved Tenant fields)
3. **Goals** — connect now or set up later (branches step 4)
4. **Connection** *(skipped if "set up later")* — bcPort + agentPort confirmation
5. **Done** — personalised summary, writes to DB, sets onboardingDone = true, redirects to dashboard

### Prefill logic (`GET /api/onboarding`)
- Fetches User, Tenant, and SignupRequest in parallel
- `SignupRequest.bcVersion` (e.g. `"BC25"`) is mapped to full navProduct + navVersion strings
- Tenant fields take priority over signup data (returning users see saved values)
- Contextual copy changes based on source: "pre-filled from your signup" / "previously saved" / generic prompt
- Step 1 greets by first name; company name shown in subtext; Step 5 summary shows company

### Save (`POST /api/onboarding`)
- Updates `User`: persona, onboardingDone = true
- Updates `Tenant`: navProduct, navVersion, lastCU, bcPort, agentPort
- Client calls `update()` (NextAuth session refresh) so JWT flips onboardingDone immediately
- Redirects to `/dashboard`

## BC Connection Architecture
- Each tenant has a Cloudflare tunnel (`{tunnelSubdomain}-agent.bespoxai.com`)
- BC agent runs on-prem, proxies OData requests
- Auth: `X-BespoxAI-Key: <tenant.apiKey>` header on every BC request
- OData base: `https://{tunnelSubdomain}-agent.bespoxai.com/{bcInstance}/ODataV4/Company('{bcCompany}')/`
- Health check: `GET /api/health` — polls BC agent, returns `{ ok, latencyMs, checkedAt }`
- Superadmin can check any tenant: `GET /api/admin/tenant-health/[tenantId]`
- `isConnected = health.status === 'ok'` — never assume connected
- **bcPort and agentPort** are now saved on Tenant and pre-filled into the installer form in Settings → BC Installer
- **bcInstance and bcCompany** are editable in Settings → BC Installer tab (saved on blur via PATCH /api/settings)
- Installer route: `POST /api/settings/installer` (tenant-facing) → proxies to `POST /api/admin/installer/[tenantId]` (superadmin)

## Settings Page — BC Installer Tab
Fields (all pre-filled from tenant, saved on blur or on installer download):
- **BC Instance name** — service instance (e.g. "BC") — saved to Tenant.bcInstance
- **BC Company name** — exact company name in BC — saved to Tenant.bcCompany
- **BC Username** — embedded in installer only, never stored
- **BC Password** — embedded in installer only, never stored
- **BC OData Port** — default 8048, saved to Tenant.bcPort
- **Agent Port** — default 8080, saved to Tenant.agentPort

## Key Patterns

### Superadmin guard
```typescript
if ((session.user as any).role !== 'superadmin')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Onboarding guard (dashboard)
```typescript
useEffect(() => {
  if (user && user.onboardingDone === false) router.replace('/onboarding')
}, [user?.onboardingDone, router])
// Also return null if onboardingDone === false to prevent flash
```

### JWT session refresh after onboarding
```typescript
const { update } = useSession()
await update() // triggers trigger: 'update' in JWT callback → re-reads DB
```

### Prisma (use `(prisma as any).model` for newer models)
```typescript
import { prisma } from '@/lib/db'
const req = await (prisma as any).requirement.findUnique({ where: { id } })
```

### Stripe client (always import from lib/stripe)
```typescript
import { stripe } from '@/lib/stripe'
// Never instantiate Stripe directly — lazy proxy handles missing env vars at build time
```

### Price IDs are server-only
`process.env.STRIPE_PRICE_*` vars are not available in client components.
Always fetch them via `/api/billing/status` which returns a `prices` object.

### JSON repair (for truncated AI responses)
Both ai-spec and dev-plan routes have `repairJSON()`. Always set `max_tokens: 4096`.

### Password reset tokens
Use `VerificationToken` table with `identifier: reset:${email}` prefix. 1 hour expiry.

### Unicode in files
Files with em-dashes or other unicode will silently break `str_replace`. Use Python instead:
```python
with open('file.tsx', 'r', encoding='utf-8') as f: content = f.read()
content = content.replace('old string', 'new string')
with open('file.tsx', 'w', encoding='utf-8') as f: f.write(content)
```

## AI Spec Generation (ai-spec route)
- Always a **full rewrite** — never a partial patch of the previous spec
- All context included every time: original description, all admin Q&A rounds, all customer answers, customer-requested changes
- `_history` array stores previous spec snapshots with trigger + timestamp (keep last 5)
- `_changeSummary` field: AI describes what changed in plain English
- `_genCount` tracks generations; non-superadmin capped at 4

## Completed Stages
- ✅ 5.1 Tenant settings page
- ✅ 5.2 Role system (superadmin / tenant_admin / user)
- ✅ 5.3 Tier gating (trial / paid / enterprise)
- ✅ 5.4 Public demo at `/demo` with mock BC data
- ✅ 5.5 Self-service signup (form → verify email → admin activates → welcome email)
- ✅ 5.6 Requirements Builder (full end-to-end)
- ✅ 5.7 Superadmin dashboard (attention items, tenant health, migration enquiries)
- ✅ 5.8 Migration Analyser landing page + lead capture
- ✅ 5.9 Forgot/reset password flow
- ✅ 5.10 AI spec full-rewrite with proper version history
- ✅ 6.1 Stripe foundation — SDK, webhook handler, tier rename, schema fields
- ✅ 6.2 Subscription billing — `/billing` pricing page, Checkout, Customer Portal, in-place upgrade/downgrade
- ✅ 6.3 Billing stats on superadmin dashboard — MRR, new subs today/month by tier, upgrades, downgrades, cancellations
- ✅ 7.1 Onboarding wizard — personalised 5-step first-login flow, BC/NAV system config, port settings
- ✅ 7.2 Duplicate email check on signup (User table + pending SignupRequest)
- ✅ 7.3 BC connection details editable in Settings → BC Installer (bcInstance, bcCompany, ports)

## Stage 5.6 — Requirements Builder (COMPLETE)
### Customer flow
1. New Request → "Save & Generate Spec →" — spec auto-generates
2. AI spec: user story, acceptance criteria, BC objects, complexity, assumptions, clarifying questions
3. Customer answers questions (structured Q&A pairs stored as JSON [{q,a}])
4. "✏ Refine & Regenerate" — up to 4 total generations (superadmin exempt)
5. Submit → admin reviews → may send back with questions → customer resubmits
6. Admin quotes → customer accepts (20% deposit) → dev → complete → final payment

### Status colour coding
- Red: `rejected`, `quote_rejected`, `needs_clarification`
- Amber: `submitted`, `in_review`, `deposit_required`, `complete_pending_payment`
- Green: `quoted`, `deposit_paid`, `in_development`, `fully_paid`

## Stage 6.2 — Billing (COMPLETE)
- `/billing` — pricing page with monthly/annual toggle
- Plan switch: if active sub exists → update in place (prorations); new customers → Stripe Checkout
- Upgrade: immediate; Downgrade: applies at next billing date
- Customer Portal: manage billing, invoices, cancellation at `POST /api/billing/create-portal`
- "⭐ Upgrade / Billing" link in dashboard sidebar for non-superadmin users

## Navigation
- `/` → `/index.html` (marketing)
- `/login` → `/onboarding` (first login) → `/dashboard` (or `/admin` for superadmin)
- `/billing` → pricing page (requires auth)
- `/forgot-password` → email → `/reset-password?token=&email=` → `/login`
- `/signup` → public request form
- `/demo` → public mock BC data

## Next Stages (not started)
- **6.4 Customisation payments** — deposit (Stripe), superadmin bypass, pay-in-full request, balance payment
- **6.5 Migration Analyser deposit** — $500 NZD deposit gates Phase 2
- **Microsoft SSO** — OAuth for BC SaaS customers
- **Migration Analyser Phase 2** — object upload, AI analysis, PDF report
- **Onboarding refinement** — tier selection during onboarding; guided IT setup flow

## Known Patterns / Gotchas
- `(prisma as any).model` needed for newer models until Vercel rebuild regenerates types
- `useSearchParams()` must be inside `<Suspense>` in Next.js App Router
- `[...new Set(arr)]` fails TypeScript — use `Array.from(new Set(arr))`
- GPT-4o responses can truncate → always `max_tokens: 4096` + `repairJSON()` fallback
- `devPlan` stripped from GET `/api/requirements` for non-superadmin
- `adminQALog` always appends — never overwrites
- Vercel Postgres schema changes = raw SQL `ALTER TABLE` — no `prisma db push` in production
- Tenant health check API at `/api/admin/tenant-health/[tenantId]` uses `/health` endpoint on BCAgent
- Password reset uses `VerificationToken` with `identifier: reset:${email}` prefix to avoid collisions
- Stripe price IDs (`STRIPE_PRICE_*`) are server-only — never read in client components; use `/api/billing/status` to expose them
- Stripe SDK v22 requires `apiVersion: '2026-04-22.dahlia'` — do not use older version strings
- `lib/stripe.ts` uses a lazy Proxy — never throws at build time even if env var is missing
- **Early `return null` guards must come AFTER all hooks** — placing one mid-component causes React error #310. Always put session/role guards just before the JSX `return`.
- **Tab state must be URL-tracked for back button to work** — pure `useState` tabs create no browser history entries; use `router.push('?tab=xxx')` + `useEffect` to sync on searchParams change
- **`router.back()` can exit to login** if there are no history entries within the app — use URL-tracked tabs so back button navigates between tabs before leaving the page
- **Unicode in source files breaks `str_replace`** — use Python file I/O instead (see pattern above)
- **`onboardingDone` defaults to `false`** — new users always go through onboarding; existing users were also set to false by migration (intentional, to collect BC version data)
- **Never commit directly to `main`** — always use a feature branch; main auto-deploys to Vercel

## Navigation Patterns (established)
- `/dashboard` tabs: tracked via `?view=xxx`, uses `router.replace` (no extra history entries per tab switch)
- `/admin` tabs: tracked via `?tab=xxx`, uses `router.push` (each tab = one history entry, back button works)
- Back buttons on `/billing`, `/settings`, `/admin` sidebar: use `router.back()` — NOT `router.push('/dashboard')`
- Superadmin visiting `/dashboard`: renders `null` immediately (no flash), then `router.replace('/admin')` fires — guard is placed AFTER all hooks, just before the JSX `return`
- First-login users visiting `/dashboard`: renders `null` immediately, `router.replace('/onboarding')` fires — same pattern as superadmin guard
