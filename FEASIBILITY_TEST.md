# BespoxAI — Feasibility Check: Testing Guide

## Overview

The feasibility check runs automatically when a customer saves a new requirement. BespoxAI makes a lightweight GPT-4o call to classify the requirement as one of three outcomes before any development spec is generated:

| Classification | Meaning | What the customer sees |
|---|---|---|
| `cfo_assistant` | Answerable from live BC/NAV data, no dev needed | Amber card — "This may not need development" + CFO Assistant link |
| `development` | Requires AL/C/AL code changes | Green card with cost range badge + "Generate Full Specification" button |
| `infeasible` | Not achievable in this BC/NAV version | Red card with explanation + "Contact us" link |

---

## Prerequisites

Before testing, confirm the following are in place:

1. **SQL migration applied** to Vercel Postgres:
   ```sql
   ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibility" TEXT;
   ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibilityNotes" TEXT;
   ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibilityCostRange" TEXT;
   ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "feasibilityCheckedAt" TIMESTAMP(3);
   ```
2. **Deployment live** — push to `main` triggers Vercel build. Confirm build succeeded in Vercel dashboard.
3. **`OPENAI_API_KEY`** set in Vercel environment variables.

---

## Manual Testing

### Test A — Development requirement (most common)

**Steps:**
1. Log in as any tenant user (not superadmin — superadmin has no tenantId and cannot create requirements)
2. Go to Dashboard → Requirements tab
3. Click **+ New Request**
4. Fill in:
   - Title: `Add two-level purchase order approval`
   - Description: `Right now purchase orders go straight to the vendor with no approval process. We need two approval levels: line manager for orders under $10,000, and CFO for anything above. Approvers should receive an email notification with a link to approve or reject directly in BC without needing to log in.`
   - BC Area: `Purchase`
   - Priority: `Important`
5. Click **Save & Check Feasibility**

**Expected result:**
- Button changes to "Saving…" briefly
- Requirement appears in the list on the left
- Detail panel shows "BespoxAI is checking feasibility…" with a spinner
- After 3–8 seconds: green card appears with label "Development required — feasible"
- Cost range badge shows one of: `$2–5k NZD`, `$5–15k NZD`, or `$15k+ NZD`
- `feasibilityNotes` explains why this needs development
- "Generate Full Specification →" button appears below the card
- List view shows the requirement without a badge (development has no badge — normal)

---

### Test B — CFO Assistant (data query)

**Steps:**
1. Log in as any tenant user
2. Click **+ New Request**
3. Fill in:
   - Title: `Show overdue customer balances`
   - Description: `I need a report showing all customers with an accounts receivable balance overdue by more than 30 days. Sorted by balance descending, showing customer name, overdue amount, and days overdue.`
   - BC Area: `Finance`
   - Priority: `Nice to have`
4. Click **Save & Check Feasibility**

**Expected result:**
- Amber card appears with label "This may not need development"
- `feasibilityNotes` explains that the CFO Assistant can answer this from live data
- Two buttons: **Try CFO Assistant →** and **Scope as development anyway**
- Clicking "Try CFO Assistant →" navigates to `/dashboard?view=chat`
- List view shows `💡 no dev needed` badge in amber

---

### Test C — Re-run feasibility check

**Steps:**
1. Open any requirement that already has a feasibility result
2. In the browser console (or via API tool), POST to `/api/requirements/[id]/feasibility`
3. Or: click "Scope as development anyway" on a `cfo_assistant` result — this triggers `generateSpec`, not a re-check. Re-check must be triggered via API for now.

**Expected result:**
- Same classification returned (GPT is consistent on clear-cut cases)
- `feasibilityCheckedAt` timestamp updated
- `feasibilityNotes` may vary slightly in wording — this is acceptable

---

### Test D — Existing requirements (no feasibility check)

**Steps:**
1. Open any requirement created before this feature was deployed (feasibility fields will be null)

**Expected result:**
- No feasibility card is shown — the detail panel renders as before
- Pipeline stages, description, spec, and all other panels show normally
- No errors or empty cards

---

### Test E — Infeasible requirement (edge case)

**Steps:**
1. Create a requirement describing something outside BC's scope:
   - Title: `Replace BC with a custom ERP system`
   - Description: `We want to completely replace Business Central with a bespoke ERP system built from scratch, migrating all data and decommissioning BC entirely.`
   - BC Area: `Other`
   - Priority: `Nice to have`

**Expected result:**
- Red card appears with label "Technical constraints identified"
- `feasibilityNotes` explains why this is outside BC customisation scope
- "Contact us to discuss →" mailto link appears
- List view shows `⚠ constrained` badge in red

---

## Automated Testing

The automated suite is in `bespoxai-test.mjs` at the repo root.

### Setup

1. Clone or pull the repo
2. Open `bespoxai-test.mjs` and edit the CONFIG block at the top:
   ```javascript
   const CONFIG = {
     baseUrl:                'https://bespoxai.com',
     superadminEmail:        'admin@bespoxai.com',
     superadminPassword:     'YOUR_PASSWORD',    // ← required
     fullyPaidRequirementId: null,               // auto-discovered if null
     secondRequirementId:    null,               // auto-discovered if null
   }
   ```
3. Do not commit the file with the password filled in.

### Run

```bash
node bespoxai-test.mjs
```

Corporate proxy (VGNET):
```powershell
$env:HTTPS_PROXY="http://your-proxy:8080"
node bespoxai-test.mjs
```

### What the feasibility section (Test F) covers

| Assertion | What is checked |
|-----------|----------------|
| F1 | `POST /api/requirements/[id]/feasibility` returns HTTP 200 |
| F2 | Response body contains a `requirement` object |
| F3 | `requirement.feasibility` is one of: `cfo_assistant`, `development`, `infeasible` |
| F4 | `requirement.feasibilityNotes` is a non-empty string (>10 chars) |
| F5 | `requirement.feasibilityCheckedAt` is set (not null) |
| F6 | If `development`: `feasibilityCostRange` is one of `2-5k`, `5-15k`, `15k+` |
| F7 | If not `development`: `feasibilityCostRange` is null |
| F8 | Persisted: requirements list reflects the updated feasibility fields |
| F9 | Re-run: second call returns 200 and same classification |
| F10 | No-session: unauthenticated request returns 401 |

The test uses `secondRequirementId` (auto-discovered if not set in CONFIG). After each run the suite prints the classification result and notes so you can sanity-check the output for that requirement.

### Expected output (feasibility section)

```
── Test F — Feasibility check feature ──────────────────────────
  ✓ F1 — Feasibility endpoint returns 200
  ✓ F2 — Response contains requirement object
  ✓ F3 — feasibility is valid enum value
  ✓ F4 — feasibilityNotes is non-empty string
  ✓ F5 — feasibilityCheckedAt is set
  ✓ F6 — Development has valid feasibilityCostRange
  ✓ F7 — Non-development has null feasibilityCostRange (skipped if development)
  ✓ F8 — Feasibility result persisted in requirement list
  ✓ F9 — Re-run returns 200
  ✓ F9 — Re-run returns same classification

  Classification result: development ($2–5k NZD)
  Notes: This requirement needs a custom approval workflow in BC using…
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| F1 fails with 500 | New DB columns not present | Run the SQL migration (see Prerequisites) |
| F1 fails with 404 | Route not deployed | Check Vercel build succeeded after push |
| F1 fails with 500 "Unexpected classification value" | GPT returned unexpected JSON | Re-run — rare, GPT occasionally misforms output; `repairJSON()` handles most cases |
| F3 fails — feasibility is null | Migration ran but Prisma client not rebuilt | Trigger a new Vercel deployment (push any small change) |
| F9 classification differs between runs | Requirement description is ambiguous | Expected on borderline cases — check if both values are reasonable |
| "BespoxAI is checking feasibility…" spinner never resolves | `OPENAI_API_KEY` missing or invalid | Check Vercel environment variables |
| Spinner resolves but no card appears | `feasibility` field returned null | Check server logs in Vercel for GPT parse error |
| "Try CFO Assistant" button navigates incorrectly | Dashboard view param mismatch | Check `/dashboard?view=chat` resolves to the CFO Assistant tab |

---

## What Is Not Tested by Automation

These require manual verification:

1. **UI rendering** — spinner animation, card colours, badge placement in list view
2. **Classification accuracy** — that GPT correctly identifies a query as `cfo_assistant` vs `development` for edge-case descriptions
3. **"Try CFO Assistant" navigation** — clicking navigates to the correct dashboard tab
4. **"Scope as development anyway" flow** — after a `cfo_assistant` result, clicking this should trigger `generateSpec()` and produce a full spec
5. **Superadmin view** — superadmin sees the feasibility card on any tenant's requirement

---

## Data Notes

- Feasibility results are **tenant-scoped** — superadmin can read and re-run any tenant's check but cannot create requirements (no tenantId)
- **Existing requirements** (created before this feature) have `feasibility = null` — no card is shown, the portal behaves as before
- **Re-running** overwrites the previous result — there is no history of past feasibility checks (unlike the AI spec which maintains `_history`)
- The feasibility check **does not gate** any other action — a `cfo_assistant` result still allows the customer to proceed with a development scope if they choose
