# BespoxAI — Testing Context (Session 8 Features)

Use this doc in a new chat to guide testing of the two features shipped this session.

---

## What Was Built

### 8.1 — AI Spec Context Isolation
**Problem fixed:** AI specs were using a fuzzy company-name lookup against SignupRequest
for BC version, and were injecting historical spec version summaries into every regeneration prompt.

**What changed:**
- `lib/bc-object-parser.ts` — new parser
- `app/api/requirements/[id]/ai-spec/route.ts` — version resolution + object context injection
- BC version now reads directly from `Tenant.navProduct` + `navVersion` + `lastCU` (set during onboarding)
- Spec history (`_history`) stored for UI only — no longer sent to GPT
- Each spec generation synthesises only from: original description, customer Q&A, admin Q&A, requested changes

### 8.2 — Deployed BC Object Upload
**What it does:** Superadmin uploads delivered `.al` or `.txt` (C/AL) object files on a
`fully_paid` requirement. Parser extracts structured metadata (fields, procedures, event
subscribers). Summary stored in `TenantObjectFile` table — raw content discarded.
All objects for a tenant are injected into future ai-spec prompts so the AI avoids
field/object number conflicts.

**New API routes:**
- `GET /api/requirements/[id]/objects` — list parsed objects for a requirement
- `POST /api/requirements/[id]/objects` — upload + parse files (superadmin only)
- `DELETE /api/requirements/[id]/objects/[fileId]` — remove a record (superadmin only)

**UI:** "Deployed BC Objects" card appears on requirement detail panel when superadmin
views a `fully_paid` requirement.

---

## Testing Checklist

### Prerequisites
- Superadmin account logged in
- At least one tenant with a requirement that has been progressed to `fully_paid`
- If no `fully_paid` requirement exists: create one and use the admin panel to fast-track
  its status (submitted → in_review → quoted → deposit_required → deposit_paid →
  in_development → complete_pending_payment → fully_paid)
- Have a sample `.al` or C/AL `.txt` object file ready (see samples below)

---

### Test 1 — BC Version in Spec

**Goal:** Confirm the spec references the correct BC/NAV version for the tenant.

1. Ensure the tenant has completed onboarding (navProduct + navVersion set)
   - Check via admin panel → Tenants → find tenant → or query DB:
     `SELECT "navProduct", "navVersion", "lastCU" FROM "Tenant" WHERE name = 'X';`
2. As a tenant user (or superadmin), create a new requirement and let the spec generate
3. Check the generated spec's `notes` field and `bcObjects` array — they should reference
   the correct version (e.g. "BC 25 AL extensions" not "Business Central (version not specified)")
4. If the tenant has no onboarding data set, the spec should still generate with a
   generic fallback — not crash

**Pass:** Spec notes mention the correct BC version and AL/C/AL development model.

---

### Test 2 — Spec Context Isolation (No History Bleed)

**Goal:** Confirm regenerating a spec doesn't carry over stale assumptions.

1. Create a requirement with a vague description
2. Let spec generate (gen 1) — note the questions it asks
3. Answer the questions with very specific, different information
4. Regenerate (gen 2) — the new spec should reflect ONLY the original description + your answers
5. Check that the spec does not say "as before" or reference anything from gen 1 that
   contradicts your answers

**Pass:** Gen 2 spec is a clean synthesis of all inputs, not a patch of gen 1.

---

### Test 3 — Object Upload UI Visible

**Goal:** Confirm the upload card appears correctly for superadmin on fully_paid requirements.

1. Log in as superadmin
2. Navigate to admin panel → Requirements (or dashboard → Requirements if available)
3. Select a `fully_paid` requirement
4. Scroll down past the action buttons
5. You should see a green-bordered "Deployed BC Objects" card with:
   - Descriptive helper text
   - "+ Upload Object Files" button
   - Empty state message if no files uploaded yet

**Pass:** Card visible, no console errors.
**Fail conditions:** Card missing, or appears on non-fully_paid requirements.

---

### Test 4 — Upload an AL File

**Goal:** Upload a simple AL table extension and confirm it parses correctly.

Use this sample file — save as `test-approval.al`:
```al
tableextension 50100 "Sales Header Approval Ext" extends "Sales Header"
{
    fields
    {
        field(50100; "Approval Status"; Option)
        {
            OptionMembers = Open,Pending,Approved,Rejected;
            Caption = 'Approval Status';
        }
        field(50101; "Approved By"; Code[50])
        {
            Caption = 'Approved By';
        }
        field(50102; "Approval Threshold"; Decimal)
        {
            Caption = 'Approval Threshold';
        }
    }
}
```

Steps:
1. Click "+ Upload Object Files" on a fully_paid requirement
2. Select `test-approval.al`
3. Expect: card shows one object row with:
   - Type badge: "Tableextension" (green)
   - ID: #50100
   - Name: "Sales Header Approval Ext"
   - Language: AL
   - No "parse err" badge

**Pass:** Object listed correctly, no parse error badge.

---

### Test 5 — Upload a C/AL .txt File (Multi-Object)

**Goal:** Confirm C/AL .txt with multiple objects splits and stores correctly.

Use this sample — save as `test-cal-objects.txt`:
```
OBJECT Table 50100 Approval Setup
{
  OBJECT-PROPERTIES
  {
    Date=01/01/24;
    Time=12:00:00;
    Modified=Yes;
    Version List=BESPOX1.0;
  }
  PROPERTIES
  {
  }
  FIELDS
  {
    { 1   ;   ;Code                ;Code10         }
    { 2   ;   ;Description         ;Text50         }
    { 3   ;   ;Approval Threshold  ;Decimal        }
    { 4   ;   ;CFO User ID         ;Code50         }
  }
  KEYS
  {
    {    ;Code                                    ;Clustered=Yes }
  }
  CODE
  {
    BEGIN
    END.
  }
}

OBJECT Codeunit 50100 Approval Management
{
  OBJECT-PROPERTIES
  {
    Date=01/01/24;
    Time=12:00:00;
    Modified=Yes;
    Version List=BESPOX1.0;
  }
  PROPERTIES
  {
    OnRun=BEGIN
    END;
  }
  CODE
  {
    PROCEDURE CheckApproval@1(VAR SalesHeader@2 : Record 36);
    BEGIN
    END;

    PROCEDURE SendApprovalEmail@3(VAR SalesHeader@4 : Record 36;Approver@5 : Code[50]);
    BEGIN
    END;

    BEGIN
    END.
  }
}
```

Steps:
1. Upload `test-cal-objects.txt` to a fully_paid requirement
2. Expect: **two** object rows appear:
   - Table 50100 "Approval Setup" [CAL] — fields: Code, Description, Approval Threshold, CFO User ID
   - Codeunit 50100 "Approval Management" [CAL] — procedures: CheckApproval, SendApprovalEmail

**Pass:** Two rows, correct types, names, and language badges.

---

### Test 6 — Parse Error Handling

**Goal:** Confirm unrecognised files don't crash — they get a parse error badge.

1. Upload a plain `.txt` file with random text (e.g. a Word document exported as .txt)
2. Expect: one row appears with red "parse err" badge and the filename as the name
3. Confirm no 500 error — upload should succeed

**Pass:** Row with "parse err" badge appears, no server error.

---

### Test 7 — Delete an Object Record

**Goal:** Confirm delete works and removes the row from the UI.

1. With at least one object uploaded, click the ✕ button on a row
2. Confirm browser prompt appears
3. Confirm the row disappears after confirming

**Pass:** Row removed, remaining rows unaffected.

---

### Test 8 — Object Context in New Spec

**Goal:** Confirm uploaded objects appear in the ai-spec prompt context.

1. Upload the AL table extension from Test 4 to a fully_paid requirement for Tenant A
2. Create a NEW requirement for the same Tenant A (new requirement, any status)
3. Generate a spec for this new requirement — the description should be something
   that would naturally touch Table 36 / Sales Header, e.g.:
   "We need to add a secondary approval flag to sales orders"
4. Check the generated spec's `bcObjects` and `notes` fields
5. The AI should reference field numbers above 50102 (since 50100-50102 are taken)
   and ideally acknowledge the existing extension

**Pass:** AI avoids conflicting field IDs and shows awareness of existing customisation.
**Note:** This is a "soft" test — AI behaviour varies. The key check is that field IDs
don't conflict with the uploaded objects.

---

## If Something Looks Wrong

- **Object upload 500 error:** Check that `TenantObjectFile` table exists in Vercel Postgres
- **"Deployed BC Objects" card missing:** Confirm requirement status is exactly `fully_paid`
  and you're logged in as superadmin
- **BC version still generic in spec:** Check tenant's `navProduct` + `navVersion` in DB —
  if null, the fallback chain kicks in (expected behaviour for pre-onboarding tenants)
- **Parse error on valid AL file:** Share the file content — parser may need a regex tweak
  for edge-case formatting (this is the expected best-effort improvement cycle)
