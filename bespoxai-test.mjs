#!/usr/bin/env node
// bespoxai-test.mjs — BespoxAI automated regression suite
// Runtime: Node 18+  |  No npm install needed  |  Run: node bespoxai-test.mjs
//
// Edit CONFIG below before running.
// Corporate proxy: set HTTPS_PROXY env var if on VGNET.

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl:               'https://bespoxai.com',
  superadminEmail:       'admin@bespoxai.com',
  superadminPassword:    'YOUR_PASSWORD',          // ← edit
  fullyPaidRequirementId: null,   // leave null to auto-discover
  secondRequirementId:    null,   // leave null to auto-discover
}

// ── COOKIE JAR ───────────────────────────────────────────────────────────────
const jar = {}

function setCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? []
  for (const c of raw) {
    const [kv] = c.split(';')
    const eq   = kv.indexOf('=')
    if (eq < 0) continue
    const k = kv.slice(0, eq).trim()
    const v = kv.slice(eq + 1).trim()
    jar[k] = v
  }
}

function cookieHeader() {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

// ── HTTP HELPERS ─────────────────────────────────────────────────────────────
async function req(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${CONFIG.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader(),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  setCookies(res)
  return res
}

async function multipart(method, path, form) {
  const res = await fetch(`${CONFIG.baseUrl}${path}`, {
    method,
    headers: { 'Cookie': cookieHeader() },
    body: form,
    redirect: 'manual',
  })
  setCookies(res)
  return res
}

// ── ASSERTION ENGINE ─────────────────────────────────────────────────────────
let passed = 0, failed = 0
const failures = []

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    const msg = detail ? `${name} — ${detail}` : name
    console.log(`  ✗ ${msg}`)
    failed++
    failures.push(msg)
  }
}

function section(name) {
  console.log(`\n── ${name} ──────────────────────────────`)
}

function skip(name) {
  console.log(`  · ${name} (skipped)`)
}

// ── TEST FILE PAYLOADS ───────────────────────────────────────────────────────
// AL table extension — should parse to objectType containing "tableext/extension",
// objectId 50100, objectName containing "Sales Header Approval", language AL, ≥3 fields
const AL_CONTENT = `tableextension 50100 "Sales Header Approval" extends "Sales Header"
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
        field(50102; "Approval Date"; Date)
        {
            Caption = 'Approval Date';
        }
    }
}
`

// C/AL multi-object file — table 50200 + codeunit 50201
// Should split into ≥2 objects; table has ≥4 fields, codeunit has ≥2 procedures
const CAL_CONTENT = `OBJECT Table 50200 BespoxTest Approval Header
{
  OBJECT-PROPERTIES
  {
    Date=01/01/20;
    Version List=BESPOX1.0;
  }
  FIELDS
  {
    { 1   ;   ;Entry No.      ;Integer        ; }
    { 2   ;   ;Document Type  ;Option         ;OptionMembers=Quote,Order,Invoice,Credit Memo; }
    { 3   ;   ;Document No.   ;Code[20]       ; }
    { 4   ;   ;Vendor No.     ;Code[20]       ; }
    { 5   ;   ;Amount         ;Decimal        ; }
  }
  KEYS
  {
    {    ;Entry No.;Clustered=Yes; }
  }
}

OBJECT Codeunit 50201 BespoxTest Approval Mgmt
{
  OBJECT-PROPERTIES
  {
    Date=01/01/20;
    Version List=BESPOX1.0;
  }
  CODE
  {
    PROCEDURE SendApprovalRequest@1(DocNo@1000:Code[20]);
    BEGIN
      MESSAGE('Approval sent for %1', DocNo);
    END;

    PROCEDURE ApproveDocument@2(EntryNo@1000:Integer);
    BEGIN
      MESSAGE('Document %1 approved', EntryNo);
    END;

    PROCEDURE RejectDocument@3(EntryNo@1000:Integer;Reason@1001:Text[250]);
    BEGIN
      MESSAGE('Document %1 rejected: %2', EntryNo, Reason);
    END;
  }
}
`

// Garbage — should not crash the parser
const GARBAGE_CONTENT = `This is not valid AL or CAL code.
RANDOM_KEYWORD 99999 "Some Nonsense" { FIELDS { } }
!@#$%^&*() syntax error expected here 12345
`

// ── AUTH ─────────────────────────────────────────────────────────────────────
async function authenticate() {
  section('Authentication')

  // CSRF
  const csrfRes  = await req('GET', '/api/auth/csrf')
  const csrfBody = await csrfRes.json()
  const csrfToken = csrfBody?.csrfToken
  assert('Get CSRF token', !!csrfToken, csrfToken ?? 'no token returned')

  // Login
  const loginRes = await req('POST', '/api/auth/callback/credentials', {
    email:      CONFIG.superadminEmail,
    password:   CONFIG.superadminPassword,
    csrfToken,
    redirect:   false,
    callbackUrl: CONFIG.baseUrl,
  })
  // NextAuth may return 200, 302, or set cookies — check session
  const sessionRes  = await req('GET', '/api/auth/session')
  const sessionBody = await sessionRes.json()
  const role = sessionBody?.user?.role
  assert('Login as superadmin', role === 'superadmin', `role=${role ?? 'none'}`)

  return role === 'superadmin'
}

// ── SETUP — discover test requirements ───────────────────────────────────────
async function discoverRequirements() {
  section('Setup — discover test requirements')

  const res  = await req('GET', '/api/admin/requirements')
  const body = await res.json()
  const all  = body?.requirements ?? []

  if (!CONFIG.fullyPaidRequirementId) {
    const fp = all.find(r => r.status === 'fully_paid')
    if (fp) { CONFIG.fullyPaidRequirementId = fp.id; console.log(`  · Auto-discovered fully_paid: ${fp.id}`) }
    else     { console.log('  · No fully_paid requirement found — object tests will be skipped') }
  } else {
    console.log(`  · Using configured fully_paid: ${CONFIG.fullyPaidRequirementId}`)
  }

  if (!CONFIG.secondRequirementId) {
    const second = all.find(r => r.id !== CONFIG.fullyPaidRequirementId && r.aiSpec)
    if (second) { CONFIG.secondRequirementId = second.id; console.log(`  · Auto-discovered second req: ${second.id}`) }
    else         { console.log('  · No second requirement found — some spec/feasibility tests will be skipped') }
  } else {
    console.log(`  · Using configured second req: ${CONFIG.secondRequirementId}`)
  }

  return all
}

// ── TEST 3: GET objects endpoint ─────────────────────────────────────────────
async function testGetObjects() {
  section('Test 3 — GET objects endpoint')
  if (!CONFIG.fullyPaidRequirementId) { skip('GET objects (no fully_paid req)'); return }

  const res  = await req('GET', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects`)
  const body = await res.json()
  assert('GET objects — HTTP 200',   res.status === 200, `status=${res.status}`)
  assert('GET objects — array returned', Array.isArray(body?.objects), JSON.stringify(body).slice(0, 80))
}

// ── TEST 9: Access control ───────────────────────────────────────────────────
async function testAccessControl() {
  section('Test 9 — Access control (no session)')
  if (!CONFIG.fullyPaidRequirementId) { skip('Access control (no fully_paid req)'); return }

  // Temporarily clear cookies to simulate no session
  const savedJar = { ...jar }
  Object.keys(jar).forEach(k => delete jar[k])

  const res = await multipart('POST', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects`, new FormData())
  assert('No-session upload → 401/403', [401, 403].includes(res.status), `status=${res.status}`)

  // Restore session
  Object.assign(jar, savedJar)
}

// ── TEST 4: AL upload ────────────────────────────────────────────────────────
let alObjectId = null
async function testALUpload() {
  section('Test 4 — AL file upload and parse')
  if (!CONFIG.fullyPaidRequirementId) { skip('AL upload (no fully_paid req)'); return }

  const form = new FormData()
  form.append('files', new Blob([AL_CONTENT], { type: 'text/plain' }), 'test-approval-ext.al')

  const res  = await multipart('POST', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects`, form)
  const body = await res.json()
  assert('AL upload — HTTP 200/201', [200, 201].includes(res.status), `status=${res.status}`)

  const objects = body?.objects ?? []
  const al = objects.find(o => o.filename === 'test-approval-ext.al')
  assert('AL objects returned',  !!al,                                  'file not found in response')
  assert('AL object type',       al && /tableext|extension/i.test(al.objectType ?? ''), `objectType=${al?.objectType}`)
  assert('AL object ID',         al?.objectId === 50100,                `objectId=${al?.objectId}`)
  assert('AL object name',       al && /sales header approval/i.test(al.objectName ?? ''), `objectName=${al?.objectName}`)
  assert('AL language',          al?.language === 'AL',                 `language=${al?.language}`)
  assert('AL parse error false', al?.parseError === false,              `parseError=${al?.parseError}`)

  const fields = al?.summary?.fields ?? al?.summary?.Fields ?? []
  assert('AL fields ≥ 3',        Array.isArray(fields) && fields.length >= 3, `fields.length=${fields.length}`)

  if (al) alObjectId = al.id
}

// ── TEST 5: C/AL multi-object upload ─────────────────────────────────────────
let calTableId = null, calCodeunitId = null
async function testCALUpload() {
  section('Test 5 — C/AL multi-object upload and parse')
  if (!CONFIG.fullyPaidRequirementId) { skip('C/AL upload (no fully_paid req)'); return }

  const form = new FormData()
  form.append('files', new Blob([CAL_CONTENT], { type: 'text/plain' }), 'test-approval-cal.txt')

  const res  = await multipart('POST', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects`, form)
  const body = await res.json()
  assert('C/AL upload — HTTP 200/201', [200, 201].includes(res.status), `status=${res.status}`)

  const objects = body?.objects ?? []
  const calObjs = objects.filter(o => o.filename === 'test-approval-cal.txt')
  assert('C/AL split — ≥ 2 objects', calObjs.length >= 2, `objects from file=${calObjs.length}`)

  const table    = calObjs.find(o => /table/i.test(o.objectType ?? '') && !/ext/i.test(o.objectType ?? ''))
  const codeunit = calObjs.find(o => /codeunit/i.test(o.objectType ?? ''))

  assert('C/AL Table found',     !!table,                               'Table object not found')
  assert('C/AL Table language',  table?.language === 'CAL',             `language=${table?.language}`)
  const tableFields = table?.summary?.fields ?? table?.summary?.Fields ?? []
  assert('C/AL Table fields ≥ 4', Array.isArray(tableFields) && tableFields.length >= 4, `fields=${tableFields.length}`)

  assert('C/AL Codeunit found',  !!codeunit,                            'Codeunit object not found')
  const procs = codeunit?.summary?.procedures ?? codeunit?.summary?.Procedures ?? codeunit?.summary?.functions ?? []
  assert('C/AL Codeunit procs ≥ 2', Array.isArray(procs) && procs.length >= 2, `procs=${procs.length}`)

  if (table)    calTableId    = table.id
  if (codeunit) calCodeunitId = codeunit.id
}

// ── TEST 6: Garbage upload ───────────────────────────────────────────────────
let garbageObjectId = null
async function testGarbageUpload() {
  section('Test 6 — Garbage file (parse error handling)')
  if (!CONFIG.fullyPaidRequirementId) { skip('Garbage upload (no fully_paid req)'); return }

  const form = new FormData()
  form.append('files', new Blob([GARBAGE_CONTENT], { type: 'text/plain' }), 'test-garbage.txt')

  const res  = await multipart('POST', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects`, form)
  const body = await res.json()
  assert('Garbage upload — no 500', res.status !== 500, `status=${res.status}`)

  const objects = body?.objects ?? []
  const garbage = objects.find(o => o.filename === 'test-garbage.txt')
  assert('Garbage parse error true OR unknown type',
    !garbage || garbage.parseError === true || !garbage.objectId,
    `parseError=${garbage?.parseError}, objectId=${garbage?.objectId}`)

  if (garbage) garbageObjectId = garbage.id
}

// ── TEST 7: DELETE ───────────────────────────────────────────────────────────
async function testDelete(objectId, label) {
  if (!objectId || !CONFIG.fullyPaidRequirementId) return
  const res = await req('DELETE', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects/${objectId}`)
  assert(`DELETE ${label} — 200/204`, [200, 204].includes(res.status), `status=${res.status}`)

  const listRes  = await req('GET', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects`)
  const listBody = await listRes.json()
  const still    = (listBody?.objects ?? []).find(o => o.id === objectId)
  assert(`DELETE ${label} — absent from GET`, !still, still ? 'still present' : '')
}

// ── TEST 1: Spec — BC version present ────────────────────────────────────────
async function testSpec() {
  section('Test 1 — AI spec generation (BC version)')
  if (!CONFIG.fullyPaidRequirementId) { skip('Spec test (no fully_paid req)'); return }

  const res  = await req('POST', `/api/requirements/${CONFIG.fullyPaidRequirementId}/ai-spec`, {})
  const body = await res.json()
  assert('Spec — HTTP 200', res.status === 200, `status=${res.status}`)
  if (res.status !== 200) return

  let spec = null
  try { spec = JSON.parse(body?.requirement?.aiSpec ?? '{}') } catch {}
  const specStr = JSON.stringify(spec ?? {})

  assert('Spec — BC version present',
    /business central|navision|nav \d|bc\d|bc saa/i.test(specStr),
    specStr.slice(0, 120))
  assert('Spec — no version-not-confirmed fallback',
    !/version not confirmed|version not specified/i.test(body?.requirement?.aiSpec ?? ''),
    '')
}

// ── TEST 2: Spec context isolation (two requirements) ────────────────────────
async function testSpecIsolation() {
  section('Test 2 — Spec context isolation (no bleed between requirements)')
  if (!CONFIG.secondRequirementId) { skip('Spec isolation (no second req)'); return }

  const res1  = await req('POST', `/api/requirements/${CONFIG.secondRequirementId}/ai-spec`, {})
  const body1 = await res1.json()
  assert('Gen 1 — HTTP 200', res1.status === 200, `status=${res1.status}`)
  if (res1.status !== 200) return

  const spec1Str = body1?.requirement?.aiSpec ?? ''

  const res2  = await req('POST', `/api/requirements/${CONFIG.secondRequirementId}/ai-spec`, {
    customerRefinements: 'Please review and confirm the acceptance criteria are complete.',
  })
  const body2 = await res2.json()
  assert('Gen 2 — HTTP 200', res2.status === 200, `status=${res2.status}`)
  if (res2.status !== 200) return

  const spec2Str = body2?.requirement?.aiSpec ?? ''
  let spec2 = null
  try { spec2 = JSON.parse(spec2Str) } catch {}

  assert('Gen 2 — no bleed phrases',
    !/as before|as previously|as mentioned earlier/i.test(spec2Str), '')
  assert('Gen 2 — complete spec fields',
    spec2 && spec2.userStory && Array.isArray(spec2.acceptanceCriteria) && spec2.bcObjects,
    `fields: ${Object.keys(spec2 ?? {}).join(', ')}`)
  assert('Gen 2 — differs from Gen 1', spec1Str !== spec2Str, 'identical — may be cached')
}

// ── TEST F: Feasibility check ─────────────────────────────────────────────────
async function testFeasibility() {
  section('Test F — Feasibility check feature')

  const reqId = CONFIG.secondRequirementId ?? CONFIG.fullyPaidRequirementId
  if (!reqId) { skip('Feasibility tests (no requirement available)'); return }

  // F1: Endpoint reachable
  const res1  = await req('POST', `/api/requirements/${reqId}/feasibility`)
  const body1 = await res1.json()
  assert('F1 — Feasibility endpoint returns 200', res1.status === 200, `status=${res1.status} — ${body1?.error ?? ''}`)
  if (res1.status !== 200) {
    console.log(`     (remaining feasibility tests skipped due to F1 failure)`)
    return
  }

  const r = body1?.requirement
  assert('F2 — Response contains requirement object', !!r, JSON.stringify(body1).slice(0, 80))
  if (!r) return

  // F3: Valid enum
  const validValues = ['cfo_assistant', 'development', 'infeasible']
  assert('F3 — feasibility is valid enum value',
    validValues.includes(r.feasibility),
    `feasibility="${r.feasibility}"`)

  // F4: Notes non-empty
  assert('F4 — feasibilityNotes is non-empty string',
    typeof r.feasibilityNotes === 'string' && r.feasibilityNotes.trim().length > 10,
    `notes="${(r.feasibilityNotes ?? '').slice(0, 60)}"`)

  // F5: Timestamp set
  assert('F5 — feasibilityCheckedAt is set',
    !!r.feasibilityCheckedAt,
    `feasibilityCheckedAt=${r.feasibilityCheckedAt}`)

  // F6 + F7: Cost range rules
  if (r.feasibility === 'development') {
    assert('F6 — Development has valid feasibilityCostRange',
      ['2-5k', '5-15k', '15k+'].includes(r.feasibilityCostRange),
      `feasibilityCostRange="${r.feasibilityCostRange}"`)
  } else {
    assert('F7 — Non-development has null feasibilityCostRange',
      r.feasibilityCostRange === null || r.feasibilityCostRange === undefined,
      `feasibilityCostRange="${r.feasibilityCostRange}"`)
  }

  // F8: Persisted — check via requirements list
  const listRes  = await req('GET', '/api/requirements')
  const listBody = await listRes.json()
  const persisted = (listBody?.requirements ?? []).find(x => x.id === reqId)
  assert('F8 — Feasibility result persisted in requirement list',
    persisted?.feasibility === r.feasibility,
    `list.feasibility="${persisted?.feasibility}" vs response="${r.feasibility}"`)

  // F9: Re-run is stable — same classification returned
  const res2  = await req('POST', `/api/requirements/${reqId}/feasibility`)
  const body2 = await res2.json()
  assert('F9 — Re-run returns 200', res2.status === 200, `status=${res2.status}`)
  const r2 = body2?.requirement
  assert('F9 — Re-run returns same classification',
    r2?.feasibility === r.feasibility,
    `first="${r.feasibility}", second="${r2?.feasibility}"`)

  // F10: Access control — no session
  const savedJar = { ...jar }
  Object.keys(jar).forEach(k => delete jar[k])

  const resAnon = await req('POST', `/api/requirements/${reqId}/feasibility`)
  assert('F10 — No session returns 401', resAnon.status === 401, `status=${resAnon.status}`)

  Object.assign(jar, savedJar)

  console.log(`\n  Classification result: ${r.feasibility}${r.feasibilityCostRange ? ` (${r.feasibilityCostRange} NZD)` : ''}`)
  console.log(`  Notes: ${(r.feasibilityNotes ?? '').slice(0, 100)}${(r.feasibilityNotes ?? '').length > 100 ? '…' : ''}`)
}

// ── CLEANUP ───────────────────────────────────────────────────────────────────
async function cleanup() {
  section('Cleanup — remove test objects')
  if (!CONFIG.fullyPaidRequirementId) { skip('Cleanup (no fully_paid req)'); return }

  const objectsToDelete = [alObjectId, calTableId, calCodeunitId, garbageObjectId].filter(Boolean)

  if (objectsToDelete.length === 0) {
    console.log('  · No objects to clean up')
    return
  }

  for (const id of objectsToDelete) {
    await req('DELETE', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects/${id}`)
  }

  const listRes  = await req('GET', `/api/requirements/${CONFIG.fullyPaidRequirementId}/objects`)
  const listBody = await listRes.json()
  const remaining = (listBody?.objects ?? []).filter(o => objectsToDelete.includes(o.id))
  assert(`Cleanup — ${objectsToDelete.length} test objects removed`, remaining.length === 0,
    remaining.length > 0 ? `${remaining.length} still present` : '')
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('BespoxAI — Automated Regression Suite')
  console.log(`Target: ${CONFIG.baseUrl}`)
  console.log(`Time:   ${new Date().toLocaleString('en-NZ')}`)

  const authed = await authenticate()
  if (!authed) {
    console.log('\nAuthentication failed — aborting.')
    process.exit(1)
  }

  await discoverRequirements()
  await testGetObjects()
  await testAccessControl()
  await testALUpload()
  await testCALUpload()
  await testGarbageUpload()

  // DELETE tests inline after uploads
  section('Test 7 — DELETE objects')
  await testDelete(alObjectId,      'AL object')
  await testDelete(calTableId,      'C/AL Table')
  await testDelete(calCodeunitId,   'C/AL Codeunit')
  await testDelete(garbageObjectId, 'Garbage object')

  // Reset tracked IDs so cleanup skips already-deleted
  alObjectId = calTableId = calCodeunitId = garbageObjectId = null

  await testSpec()
  await testSpecIsolation()
  await testFeasibility()
  await cleanup()

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════')
  console.log(`  ${passed} passed   ${failed} failed   ${passed + failed} total`)
  console.log('══════════════════════════════════════════')

  if (failures.length > 0) {
    console.log('\nFailed assertions:')
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
  } else {
    console.log('\nAll assertions passed ✓')
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\nUnhandled error:', err.message)
  process.exit(1)
})
