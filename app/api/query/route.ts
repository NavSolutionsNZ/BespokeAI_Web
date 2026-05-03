import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantById, buildODataUrl } from '@/lib/tenants'
import { getEntitiesSummary } from '@/lib/bc-entities'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueryPlan {
  entity: string
  params: string
  reasoning: string
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
    const planRes = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      system: `You are a Microsoft Business Central OData query planner.
Given a user's natural language question, output ONLY a JSON object (no markdown, no explanation) with:
  - entity: exact BC OData entity name from the list below
  - params: OData query string (everything after the '?'), e.g. "$top=20&$filter=Balance_LCY gt 0&$orderby=Balance_LCY desc&$select=No,Name,Balance_LCY"
  - reasoning: one-sentence explanation of your choice

Available entities:
${getEntitiesSummary()}

OData rules:
- Always include $top (default 20, max 100 unless user asks for all)
- Use $select to limit to relevant fields only — always include the key field
- String filter: contains(Name,'text'), startswith(No,'C')
- Date filter: Posting_Date ge 2024-01-01 and Posting_Date le 2024-12-31
- Number filter: Balance_LCY gt 0, Amount ge 10000
- Boolean: Open eq true
- $orderby for sorting: fieldName desc
- Combine with 'and' / 'or'
- OData field names use underscores (e.g. Sell_to_Customer_No, not SellToCustomerNo)

Output ONLY valid JSON. No backticks, no markdown.`,
      messages: [{ role: 'user', content: question }],
    })

    const planText =
      planRes.content[0].type === 'text' ? planRes.content[0].text.trim() : ''

    // Strip accidental markdown fences if present
    const clean = planText.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()
    plan = JSON.parse(clean)
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Query planner failed', detail: err.message },
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
          error: `BC returned ${bcRes.status}`,
          detail: errText,
          odataUrl,
          plan,
        },
        { status: 502 },
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

  // ── Step 3: Answer — Claude produces natural language + structured data ──

  // Truncate huge payloads before sending to Claude (keep first 80 records)
  const recordsForClaude = rawRecords.slice(0, 80)
  const truncated = rawRecords.length > 80

  let payload: AnswerPayload
  try {
    const answerRes = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: `You are a senior financial data analyst presenting Business Central data to a CFO at ${tenant.name}.

Your response MUST be a single valid JSON object. No markdown, no explanation outside the JSON.

JSON shape:
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
- "kpi"        → single headline figure or a small set of KPIs (e.g. total AR balance, count of overdue invoices)
- "bar_chart"  → ranking / comparison across named categories (e.g. top customers by balance)
- "line_chart" → trend over time (e.g. monthly sales, daily entries)
- "table"      → multi-field detail rows where columns matter (e.g. overdue invoices with customer, amount, due date)
- "narrative"  → data doesn't lend itself to a visual (explanatory, mixed, or very few points)

─── data ─────────────────────────────────────────────────────────────────────
Populate based on displayHint. Use null for "narrative".

kpi:
  { "kpis": [{ "label": "Total AR", "value": "$1,234,567.00", "subtext": "across 42 customers" }] }

bar_chart / table:
  { "columns": ["Customer", "Balance ($)"], "rows": [["Acme Ltd", 142000.00], ["Beta Co", 98500.00]] }
  - columns: short human-readable labels
  - rows: each row matches columns order; numbers must be raw numeric (no $ or commas)

line_chart:
  { "columns": ["Month", "Amount ($)"], "rows": [["Jan 2024", 54000], ["Feb 2024", 61200]] }
  - First column is always the x-axis label

Output ONLY the JSON object. No backticks.`,
      messages: [
        {
          role: 'user',
          content: `Question: ${question}\n\nBC data (${recordsForClaude.length} records from ${plan.entity}):\n${JSON.stringify(recordsForClaude, null, 2)}`,
        },
      ],
    })

    const raw = answerRes.content[0].type === 'text' ? answerRes.content[0].text.trim() : ''
    const clean = raw.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()
    payload = JSON.parse(clean)

    // Defensive fallback — if Claude drops fields
    payload.answer      = payload.answer      ?? 'No answer generated.'
    payload.displayHint = payload.displayHint ?? 'narrative'
    payload.data        = payload.data        ?? null
  } catch (err: any) {
    return NextResponse.json(
      { error: `Answer generation failed: ${err.message}` },
      { status: 500 },
    )
  }

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
