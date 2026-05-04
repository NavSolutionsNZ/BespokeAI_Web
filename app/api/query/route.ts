import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantById, buildODataUrl } from '@/lib/tenants'
import { getEntitiesSummary } from '@/lib/bc-entities'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueryPlan {
  entity: string
  params: string
  reasoning: string
  // Optional second entity to fetch and join with the primary
  secondEntity?: string
  secondParams?: string
  joinKey?: string        // key field on primary entity (e.g. 'No')
  joinForeignKey?: string // matching field on second entity (e.g. 'Document_No')
}

export type DisplayHint = 'narrative' | 'kpi' | 'table' | 'bar_chart' | 'line_chart'

export interface StructuredData {
  // Used for table, bar_chart, line_chart
  columns?: string[]
  rows?: (string | number | null)[][]
  // Used for kpi — one or more headline figures
  kpis?: { label: string; value: string; subtext?: string }[]
}

interface AnswerPayload {
  answer: string
  displayHint: DisplayHint
  data: StructuredData | null
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth guard
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  const body = await req.json().catch(() => ({}))
  const question: string = body.question?.trim() ?? ''
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  // 3. Load tenant config
  const tenant = await getTenantById(session.user.tenantId)
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not configured' }, { status: 404 })
  }

  // ── Step 1: Plan — which BC entity & OData params? ──────────────────────

  let plan: QueryPlan
  try {
    const planRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a Microsoft Business Central OData query planner.
Given a user's natural language question, output ONLY a JSON object with:
  - entity: exact BC OData entity name from the list below
  - params: OData query string (everything after the '?'), e.g. "$top=20&$filter=Balance_LCY gt 0&$orderby=Balance_LCY desc&$select=No,Name,Balance_LCY"
  - reasoning: one-sentence explanation of your choice
  - secondEntity (optional): a second entity to fetch when data must be joined
  - secondParams (optional): OData params for the second entity
  - joinKey (optional): key field on the primary entity (e.g. "No")
  - joinForeignKey (optional): matching field on secondEntity (e.g. "Document_No")

Use secondEntity when you need fields from two entities that must be joined.
Example — invoice totals by month needs dates from SalesInvoice AND amounts from SalesInvoiceSalesLines:
{
  "entity": "SalesInvoice",
  "params": "$top=500&$select=No,Posting_Date,Sell_to_Customer_Name&$orderby=Posting_Date desc",
  "secondEntity": "SalesInvoiceSalesLines",
  "secondParams": "$top=2000&$select=Document_No,Amount_Including_VAT",
  "joinKey": "No",
  "joinForeignKey": "Document_No",
  "reasoning": "Invoice dates from header, amounts from lines, joined on No=Document_No"
}

Available entities:
${getEntitiesSummary()}

OData rules:
- Always include $top (default 20, max 100 unless user asks for all)
- Use $select to limit to relevant fields only — always include the key field
- String filter: contains(Name,'text'), startswith(No,'C')
- Date filter on Customer/Vendor/Item (non-posted): Posting_Date ge 2024-01-01T00:00:00Z and Posting_Date le 2024-12-31T23:59:59Z
- NEVER filter by date on posted document entities (SalesInvoice, PurchaseInvoice, SalesCrMemo, GeneralLedgerEntry) — these return 400. Fetch all and let the answerer filter.
- Number filter: Balance_LCY gt 0, Amount ge 10000
- Boolean: Open eq true
- $orderby for sorting: fieldName desc
- Combine with 'and' / 'or'
- OData field names use underscores (e.g. Sell_to_Customer_No, not SellToCustomerNo)
- CRITICAL: only use field names that appear in the entity's Fields list above — never guess or invent field names (e.g. use E_Mail not Email, Balance_LCY not Balance)

CRITICAL — BC 14 does NOT support these — never use them:
- $apply (no aggregation, no groupby, no aggregate())
- $compute, $search
- Lambda operators: any(), all()
- Functions inside $filter: year(), month(), day()

For time-series / "by month" / "over last N months" / trend questions:
- Do NOT attempt OData aggregation — BC 14 will return 400
- Do NOT use $filter on date fields — BC 14 posted-document entities (SalesInvoice, PurchaseInvoice, GeneralLedgerEntry, SalesCrMemo) do not support date filtering and will return 400
- Instead: fetch all records with $top=500, $select only the date + amount fields, $orderby by date desc
- Example for "invoice totals last 6 months": $top=500&$select=No,Posting_Date,Amount_Including_VAT&$orderby=Posting_Date desc
- The answerer step will filter to the requested date range and group by month
- For invoice/credit memo totals by month: use secondEntity join — SalesInvoice (dates) + SalesInvoiceSalesLines (amounts)
- For purchase totals by month: use secondEntity join — PurchaseInvoice (dates) + PurchaseInvoicePurchLines (amounts)
- SalesInvoice / PurchaseInvoice / SalesCrMemo headers have NO amount fields — never $select Amount or Amount_Including_VAT from them
- SalesInvoiceSalesLines / PurchaseInvoicePurchLines have NO Posting_Date — never $select or $orderby Posting_Date from them`,
        },
        { role: 'user', content: question },
      ],
    })

    const planText = planRes.choices[0].message.content ?? ''
    const clean = planText.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()
    plan = JSON.parse(clean)
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Query planner failed', detail: err.message, step: 'planner' },
      { status: 500 },
    )
  }

  // ── Step 2: Fetch BC data via BCAgent tunnel ─────────────────────────────

  const odataUrl = buildODataUrl(tenant, plan.entity, plan.params)

  let bcData: any
  let rawRecords: any[]

  try {
    const bcRes = await fetch(odataUrl, {
      headers: {
        'X-BespoxAI-Key': tenant.apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    })

    if (!bcRes.ok) {
      const errText = await bcRes.text()
      return NextResponse.json(
        {
          error: `BC OData returned ${bcRes.status}`,
          detail: errText,
          odataUrl,
          plan,
        },
        { status: 400 },
      )
    }

    bcData = await bcRes.json()
    rawRecords = bcData.value ?? (Array.isArray(bcData) ? bcData : [bcData])
  } catch (err: any) {
    return NextResponse.json(
      { error: `BCAgent unreachable: ${err.message}`, odataUrl, plan },
      { status: 502 },
    )
  }

  // ── Step 2b: Fetch + join second entity (optional) ───────────────────────

  if (plan.secondEntity && plan.joinKey && plan.joinForeignKey) {
    const secondUrl = buildODataUrl(tenant, plan.secondEntity, plan.secondParams)
    try {
      const secondRes = await fetch(secondUrl, {
        headers: { 'X-BespoxAI-Key': tenant.apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (secondRes.ok) {
        const secondData = await secondRes.json()
        const secondRecords: any[] = secondData.value ?? []

        // Build lookup map: foreignKey → aggregated values from second records
        const lookup = new Map<string, any>()
        for (const rec of secondRecords) {
          const fk = rec[plan.joinForeignKey]
          if (fk == null) continue
          if (!lookup.has(fk)) {
            lookup.set(fk, { ...rec })
          } else {
            // Sum numeric fields across multiple lines for the same document
            const existing = lookup.get(fk)
            for (const [k, v] of Object.entries(rec)) {
              if (typeof v === 'number' && typeof existing[k] === 'number') {
                existing[k] += v
              }
            }
          }
        }

        // Merge second-entity fields into primary records
        rawRecords = rawRecords.map(rec => {
          const pk = rec[plan.joinKey!]
          const joined = lookup.get(pk)
          return joined ? { ...rec, ...joined } : rec
        })
      }
    } catch {
      // Non-fatal — continue with primary records only
    }
  }

  // ── Step 3: Answer — Claude produces natural language + structured data ──

  // Truncate huge payloads before sending to Claude (keep first 80 records)
  const recordsForClaude = rawRecords.slice(0, 80)
  const truncated = rawRecords.length > 80

  let payload: AnswerPayload
  try {
    const answerRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a senior financial data analyst presenting Business Central data to a CFO at ${tenant.name}.

Your response MUST be a single valid JSON object with this exact shape:
{
  "answer": "...",
  "displayHint": "...",
  "data": { ... } or null
}

─── answer ───────────────────────────────────────────────────────────────────
Write as a trusted financial advisor briefing a CFO. Rules:
- Lead with the key insight or headline number, not a preamble
- Currency: comma-separated with 2 decimal places (e.g. $142,000.00)
- Dates: "15 Jan 2024" format
- Percentages where useful (e.g. "top 3 customers represent 61% of AR")
- Flag anomalies, overdue items, or concentration risk where relevant
- 2–4 sentences for simple answers; up to 8 for complex ones
- No bullet points — flowing, professional prose
${truncated ? `- Data was truncated to 80 of ${rawRecords.length} records` : ''}

─── displayHint ──────────────────────────────────────────────────────────────
Choose exactly one:
- "kpi"        → single headline figure or a small set of KPIs
- "bar_chart"  → ranking / comparison across named categories
- "line_chart" → trend over time
- "table"      → multi-field detail rows where columns matter
- "narrative"  → data doesn't lend itself to a visual

─── data ─────────────────────────────────────────────────────────────────────
kpi:    { "kpis": [{ "label": "Total AR", "value": "$1,234,567.00", "subtext": "across 42 customers" }] }
table / bar_chart: { "columns": ["Customer", "Balance ($)"], "rows": [["Acme Ltd", 142000.00]] }
line_chart: { "columns": ["Month", "Amount ($)"], "rows": [["Jan 2024", 54000]] }
narrative: null
Numbers in rows must be raw numeric — no $ signs or commas.`,
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nBC data (${recordsForClaude.length} records from ${plan.entity}):\n${JSON.stringify(recordsForClaude, null, 2)}`,
        },
      ],
    })

    const raw = answerRes.choices[0].message.content ?? ''
    const clean = raw.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()
    payload = JSON.parse(clean)

    // Defensive fallbacks
    payload.answer      = payload.answer      ?? 'No answer generated.'
    payload.displayHint = payload.displayHint ?? 'narrative'
    payload.data        = payload.data        ?? null
  } catch (err: any) {
    return NextResponse.json(
      { error: `Answer generation failed: ${err.message}`, step: 'answerer' },
      { status: 500 },
    )
  }

  // ── Persist to QueryLog ───────────────────────────────────────────────────

  try {
    await prisma.queryLog.create({
      data: {
        tenantId:    tenant.tenantId,
        userId:      (session.user as any).id,
        question,
        answer:      payload.answer,
        displayHint: payload.displayHint,
        data:        payload.data ? (payload.data as any) : undefined,
        entity:      plan.entity,
        recordCount: rawRecords.length,
      },
    })
  } catch { /* non-fatal — don't block the response */ }

  // ── Return ───────────────────────────────────────────────────────────────

  return NextResponse.json({
    answer:      payload.answer,
    displayHint: payload.displayHint,
    data:        payload.data,
    meta: {
      entity:      plan.entity,
      reasoning:   plan.reasoning,
      recordCount: rawRecords.length,
      odataUrl,
    },
  })
}
