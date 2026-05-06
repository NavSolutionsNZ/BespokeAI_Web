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

# 4. Edit files in place, then commit and push
git add --sparse path/to/file.tsx another/file.ts
git commit -m "feat: description"
git push origin main

# For new files (not yet in repo), just create them and add --sparse works fine
# To add more files mid-session:
git sparse-checkout set --skip-checks existing/file.tsx new/file.tsx
```

**Key rules:**
- Always `git add --sparse` (not plain `git add`) for files outside the sparse cone
- Always `git pull origin main --quiet` at session start if repo was cloned in a previous session
- New files in new directories: create the directory and file, then `git add --sparse`
- Read files with `cat`, edit with `str_replace` or full rewrites via `cat > file << 'EOF'`

## When you cannot act autonomously
SQL migrations on Vercel Postgres, environment variables, DNS, Cloudflare tunnel config — provide the exact SQL/command clearly labelled as a **manual step for Rich**.

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
- `superadmin` — full admin portal at `/admin`, redirected away from `/dashboard`
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
  page.tsx                         → redirects / to /index.html
  layout.tsx                       → root layout with SessionProvider
  globals.css                      → CSS variables + keyframes
  dashboard/page.tsx               → CFO dashboard (superadmin redirected to /admin)
  admin/page.tsx                   → superadmin portal (overview, tenants, users, signups, requirements)
  login/page.tsx                   → login form with "Forgot password?" link
  forgot-password/page.tsx         → enter email to receive reset link
  reset-password/page.tsx          → enter new password (reads ?token=&email= from URL)
  signup/page.tsx                  → public signup request form
  demo/page.tsx                    → public demo (no auth) with mock BC data
  settings/page.tsx                → tenant settings (tenant_admin)
  api/
    query/route.ts                 → main BC OData query endpoint (GPT → OData → response)
    health/route.ts                → BC connection health check
    history/route.ts               → query log history
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
    auth/
      [...nextauth]/route.ts
      forgot-password/route.ts     → generate reset token, send email
      reset-password/route.ts      → validate token, update password
    demo/query/route.ts
    migration/enquiry/route.ts     → POST — save MigrationEnquiry + send email
    settings/route.ts
    signup/route.ts
    user/change-password/route.ts
components/
  RequirementsBuilder.tsx          → customer-facing requirements UI
  DataVisualizer.tsx               → BC data chart/table renderer
  UpgradePrompt.tsx                → tier gate UI
  SuperAdminDashboard.tsx          → superadmin overview: attention items, tenant health, migration enquiries
  MigrationAnalyzerLanding.tsx     → customer-facing migration analysis sales/lead page
lib/
  auth.ts        → NextAuth config
  db.ts          → Prisma client singleton
  email.ts       → sendVerificationEmail, sendWelcomeEmail, sendEmail, sendPasswordResetEmail
  tenants.ts     → getTenantById, buildODataUrl, TenantConfig
  tier.ts        → checkTier()
  roles.ts       → role helpers
  bc-entities.ts → BC entity/field definitions
public/
  index.html     → marketing landing page (static HTML/CSS/JS)
  favicon.svg
prisma/
  schema.prisma  → full Prisma schema
```

## Prisma Schema (current)
```prisma
model Tenant {
  id                  String             @id @default(cuid())
  name                String
  tunnelSubdomain     String             @unique
  bcInstance          String             @default("GWM_Dev")
  bcCompany           String             @default("GWM")
  apiKey              String
  active              Boolean            @default(true)
  entityConfig        Json?
  tunnelId            String?
  country             String             @default("NZ")
  tier                String             @default("trial")
  trialEndsAt         DateTime?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
  users               User[]
  queryLogs           QueryLog[]
  requirements        Requirement[]
  migrationEnquiries  MigrationEnquiry[]
}

model User {
  id                 String             @id @default(cuid())
  email              String             @unique
  name               String?
  password           String
  role               String             @default("user")
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

model MigrationEnquiry {
  id          String   @id @default(cuid())
  tenantId    String
  userId      String
  contactName String?
  phone       String
  version     String
  users       String
  urgency     String?
  notes       String?  @db.Text
  status      String   @default("new")  // new | contacted | quoted | closed
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
}

model Requirement {
  id              String    @id @default(cuid())
  tenantId        String
  userId          String
  title           String
  description     String    @db.Text
  bcArea          String
  priority        String    // nice_to_have | important | critical
  aiSpec          String?   @db.Text  // JSON: full spec + _genCount + _history snapshots
  status          String    @default("draft")
  // Status pipeline: draft | submitted | needs_clarification | in_review |
  //   quoted | quote_rejected | deposit_required | deposit_paid |
  //   in_development | complete_pending_payment | fully_paid | rejected
  quote           Decimal?  @db.Decimal(10, 2)
  quoteApprovedAt DateTime?
  depositAmount   Decimal?  @db.Decimal(10, 2)
  depositPaidAt   DateTime?
  balancePaidAt   DateTime?
  consultantNote  String?   @db.Text
  adminQuestions  String?   @db.Text
  customerAnswers String?   @db.Text  // JSON [{q, a}]
  adminQALog      String?   @db.Text  // JSON [{round, questions, answers, askedAt, answeredAt}]
  quoteRejectedAt      DateTime?
  quoteRejectionReason String?  @db.Text
  devPlan         String?   @db.Text  // superadmin-only internal dev plan JSON
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  user            User      @relation(fields: [userId], references: [id])
}
```

## SQL Migrations Applied to Production
```sql
-- MigrationEnquiry table (added this session)
CREATE TABLE IF NOT EXISTS "MigrationEnquiry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "users" TEXT NOT NULL,
  "urgency" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MigrationEnquiry_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "MigrationEnquiry" ADD CONSTRAINT "MigrationEnquiry_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MigrationEnquiry" ADD CONSTRAINT "MigrationEnquiry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Earlier migrations (already applied):
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10,2);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "balancePaidAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "devPlan" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "quoteRejectedAt" TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "quoteRejectionReason" TEXT;
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "adminQALog" TEXT;
```

## BC Connection Architecture
- Each tenant has a Cloudflare tunnel (`{tunnelSubdomain}-agent.bespoxai.com`)
- BC agent runs on-prem, proxies OData requests
- Auth: `X-BespoxAI-Key: <tenant.apiKey>` header on every BC request
- OData base: `https://{tunnelSubdomain}-agent.bespoxai.com/{bcInstance}/ODataV4/Company('{bcCompany}')/`
- Health check: `GET /api/health` — polls BC agent, returns `{ ok, latencyMs, checkedAt }`
- Superadmin can check any tenant: `GET /api/admin/tenant-health/[tenantId]`
- `isConnected = health.status === 'ok'` — never assume connected

## Key Patterns

### Superadmin guard
```typescript
if ((session.user as any).role !== 'superadmin')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Prisma (use `(prisma as any).model` for newer models)
```typescript
import { prisma } from '@/lib/db'
const req = await (prisma as any).requirement.findUnique({ where: { id } })
```

### JSON repair (for truncated AI responses)
Both ai-spec and dev-plan routes have `repairJSON()`. Always set `max_tokens: 4096`.

### Password reset tokens
Use `VerificationToken` table with `identifier: reset:${email}` prefix. 1 hour expiry.

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

## Stage 5.7 — Superadmin Dashboard (COMPLETE)
- `SuperAdminDashboard` component replaces overview tab in `/admin`
- Superadmin redirected from `/dashboard` → `/admin` automatically
- Attention items: new customisation requests, customer replies, quote rejections, ready-to-start, pending signups, new migration enquiries
- Tenant grid: live BC health check per tenant (parallel on load, refresh button per card)
- Migration enquiries table with inline status selector (new → contacted → quoted → closed)

## Stage 5.8 — Migration Analyser (COMPLETE — Phase 1)
- `MigrationAnalyzerLanding` component at `?view=migration` in dashboard
- Sales page: hero, what's in the report, how it works, request form
- Lead capture: saves `MigrationEnquiry` to DB + emails superadmin
- Phase 2 (not built): object upload, AI analysis, PDF report generation

## Navigation
- `/` → `/index.html` (marketing)
- `/login` → `/dashboard` (or `/admin` for superadmin)
- `/forgot-password` → email → `/reset-password?token=&email=` → `/login`
- `/signup` → public request form
- `/demo` → public mock BC data

## Next Stages (not started)
- **Stripe billing** — subscription management, webhook handling
- **Microsoft SSO** — OAuth for BC SaaS customers
- **Migration Analyser Phase 2** — object upload, AI analysis, PDF report

## Known Patterns / Gotchas
- `(prisma as any).model` needed for newer models (MigrationEnquiry etc) until Vercel rebuild
- `useSearchParams()` must be inside `<Suspense>` in Next.js App Router
- `[...new Set(arr)]` fails TypeScript — use `Array.from(new Set(arr))`
- GPT-4o responses can truncate → always `max_tokens: 4096` + `repairJSON()` fallback
- `devPlan` stripped from GET `/api/requirements` for non-superadmin
- `adminQALog` always appends — never overwrites
- Vercel Postgres schema changes = raw SQL `ALTER TABLE` — no `prisma db push` in production
- Tenant health check API at `/api/admin/tenant-health/[tenantId]` uses `/health` endpoint on BCAgent
- Password reset uses `VerificationToken` with `identifier: reset:${email}` prefix to avoid collisions
