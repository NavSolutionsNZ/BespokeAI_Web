# BespoxAI — Requirements Automated Testing Context

Use this doc in a new chat to run or extend the automated test suite for the Requirements and AI Spec features.

---

## Test Runner

**File:** `bespoxai-test.mjs` (download from repo root or request from Claude)
**Runtime:** Node 18+ — no npm install needed, uses built-in fetch
**Run:** `node bespoxai-test.mjs`

### Corporate proxy (VGNET etc.)
```powershell
# PowerShell
$env:HTTPS_PROXY="http://your-proxy:8080"
node bespoxai-test.mjs
```

### Config block (top of script — edit before running)
```javascript
const CONFIG = {
  baseUrl: 'https://bespoxai.com',
  superadminEmail: 'admin@bespoxai.com',
  superadminPassword: 'YOUR_PASSWORD',
  fullyPaidRequirementId: null,  // set to skip auto-discovery
  secondRequirementId: null,
}
```

---

## What Is Tested (42 assertions)

| # | Test | What it checks |
|---|------|---------------|
| Auth | Get CSRF token | `/api/auth/csrf` reachable and returns token |
| Auth | Login as superadmin | NextAuth credentials flow, role === superadmin |
| Setup | Find fully_paid requirement | Auto-discovers from `/api/admin/requirements` if not configured |
| 3 | GET objects endpoint | Returns 200 and array (or `{objects:[]}`) |
| 9 | Access control | Upload without session returns 401/403 |
| 4 | AL upload status | POST returns 200/201 |
| 4 | AL objects returned | At least 1 object in response |
| 4 | AL object type | `objectType` contains "tableext" or "extension" |
| 4 | AL object ID | `objectId` === 50100 |
| 4 | AL object name | `objectName` contains "Sales Header Approval" |
| 4 | AL language | `language` === "AL" |
| 4 | AL parse error | `parseError` === false |
| 4 | AL fields | `summary.fields` has ≥ 3 entries |
| 5 | C/AL upload status | POST returns 200/201 |
| 5 | C/AL split | ≥ 2 objects returned (multi-object .txt splits correctly) |
| 5 | C/AL Table found | Table type object present with correct name + ID |
| 5 | C/AL Table language | `language` === "CAL" |
| 5 | C/AL Table fields | ≥ 4 fields extracted |
| 5 | C/AL Codeunit found | Codeunit type object present |
| 5 | C/AL Codeunit procs | ≥ 2 procedures extracted |
| 6 | Garbage no crash | Upload of random text returns 200 (not 500) |
| 6 | Garbage parse error | `parseError` === true OR stored as Unknown/no objectId |
| 7 | DELETE returns 200/204 | Object deleted successfully |
| 7 | DELETE verified | Object absent from subsequent GET |
| 1 | Spec HTTP 200 | AI spec generation returns 200 |
| 1 | Spec BC version | Spec JSON contains BC/NAV version pattern |
| 1 | Spec no fallback | Does not contain "version not specified" |
| 2 | Gen 1 generated | First spec generation succeeds |
| 2 | Gen 2 generated | Second spec generation succeeds |
| 2 | Gen 2 no bleed | Gen 2 does not contain "as before/previously/as mentioned" |
| 2 | Gen 2 complete | Gen 2 has standard spec fields (userStory, acceptanceCriteria, etc.) |
| 2 | Gen 2 differs | Gen 2 output differs from Gen 1 (was re-generated, not cached) |
| Cleanup | Test objects removed | All objects created during test run are deleted |
| F1 | Feasibility endpoint returns 200 | `POST /api/requirements/[id]/feasibility` reachable |
| F2 | Response contains requirement | `d.requirement` object present in response |
| F3 | feasibility is valid enum | Value is `cfo_assistant`, `development`, or `infeasible` |
| F4 | feasibilityNotes non-empty | String with >10 chars returned |
| F5 | feasibilityCheckedAt set | Timestamp present in response |
| F6 | Development has cost range | `feasibilityCostRange` is `2-5k`, `5-15k`, or `15k+` when `feasibility=development` |
| F7 | Non-development cost range null | `feasibilityCostRange` is null for `cfo_assistant` and `infeasible` |
| F8 | Result persisted | Requirement list reflects updated feasibility fields |
| F9 | Re-run is stable | Second call returns 200 and same classification |
| F10 | Access control | No-session request returns 401 |

---

## Important Behavioural Notes

**Feasibility tests use `secondRequirementId`** (or `fullyPaidRequirementId` as fallback). They call `POST /api/requirements/[id]/feasibility` which makes a GPT-4o call — expect ~3–5 seconds per call. Two calls are made per run (F1 + F9 re-run). The classification result is logged to the console so you can verify it makes sense for the requirement description.

**Classification type tests (cfo_assistant vs development)** are validated structurally (cost range present/absent) but the specific type is not asserted — it depends on the requirement description and may legitimately vary.


**Route returns the full list after every write.** `POST /api/requirements/[id]/objects` returns all objects for the requirement, not just the newly uploaded ones. Always find uploaded records by `filename`, not by index — pre-existing objects will be at lower indices.

**Spec tests are GPT calls** — each takes 10–20 seconds. The suite will take ~60 seconds total to run.

**Spec context isolation test is structural, not content-based.** `requestedChanges` is injected into the prompt but GPT won't pivot the topic away from `description`. The test checks structural completeness and that gen 2 differs from gen 1 — not that GPT followed specific instructions.

---

## What Was Discovered / Fixed During Initial Test Run (Session 9)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| All `/objects` routes returning blank 500 | `TenantObjectFile` was in the DB (SQL migration applied) but missing from `schema.prisma` — so `prisma generate` never included it, making `prisma.tenantObjectFile` undefined at runtime | Added model + back-relations to `schema.prisma`, pushed to main |
| Admin Users + Tenants tables clipping action buttons | Table wrapper had `overflow: hidden` | Changed to `overflowX: auto`, added `minWidth: 700` on tables |
| Superadmin landing on `/onboarding` | Two `useEffect`s (→ /admin, → /onboarding) raced on dashboard load | Added `role !== 'superadmin'` guard to onboarding effect |

---

## Manual Checks Not Covered by Automation

These should be verified by hand after any significant deploy:

1. **UI card visibility** — Log in as superadmin, open a `fully_paid` requirement, confirm "Deployed BC Objects" card is present and the upload button works
2. **Object context in new spec** — Upload an AL file to Tenant A, create a new requirement for Tenant A, generate spec, confirm AI references field numbers above those already taken
3. **Cleanup safety** — The test runner deletes objects it creates. If pre-existing objects exist on the test requirement, they will also be deleted during cleanup. Use a dedicated test requirement, or set `fullyPaidRequirementId` to one that has no real data.

---

## If Something Looks Wrong

| Symptom | Likely Cause |
|---------|-------------|
| `fetch failed` on CSRF | Corporate proxy — set `HTTPS_PROXY` env var |
| `SyntaxError: Unexpected identifier` | Node < 18, or running as CJS not ESM — ensure file is `.mjs` and Node 18+ |
| All objects routes 500 (empty body) | `TenantObjectFile` missing from `schema.prisma` — check and add if absent |
| Upload succeeds but wrong object asserted | Pre-existing objects on requirement — test finds by filename, not index |
| Spec tests return 402 | Tier gate on requirement's tenant — use a tenant with assistant+ tier |
| BC version shows "version not specified" | Tenant has no onboarding data (`navProduct`/`navVersion` null) — expected fallback |
