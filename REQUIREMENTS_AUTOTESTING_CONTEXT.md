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

## What Is Tested (32 assertions)

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

---

## Important Behavioural Notes

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
