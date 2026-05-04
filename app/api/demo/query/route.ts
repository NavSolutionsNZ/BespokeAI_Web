import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─── Mock response library ────────────────────────────────────────────────────
// Realistic NZ-based demo data — never hits a real BC instance

const MOCK_RESPONSES: {
  keywords: string[]
  answer: string
  displayHint: string
  data: object | null
}[] = [
  {
    keywords: ['revenue', 'sales', 'income', 'turnover'],
    answer: `**Total revenue for the current financial year is $4,218,340.**\n\nQ1 was your strongest quarter at $1,284,000, driven by the Auckland infrastructure project. Q2 and Q3 held steady around $1.0–1.1M. Q4 is tracking slightly below prior year — worth monitoring before 31 March close.\n\nGross margin sits at **38.4%**, in line with industry benchmarks for NZ professional services.`,
    displayHint: 'bar_chart',
    data: {
      columns: ['Quarter', 'Revenue'],
      rows: [
        ['Q1', 1284000],
        ['Q2', 1062500],
        ['Q3', 1109840],
        ['Q4', 762000],
      ],
    },
  },
  {
    keywords: ['overdue', 'outstanding', 'receivable', 'owe', 'debtor'],
    answer: `**You have $312,450 in overdue receivables across 8 customers.**\n\nThe top 3 overdue accounts make up 74% of the total:\n\n- **Kauri Construction Ltd** — $118,200 (62 days overdue)\n- **Tūhoe Enterprises** — $72,300 (45 days overdue)\n- **Pacific Rim Logistics** — $41,800 (38 days overdue)\n\nI'd recommend prioritising a call to Kauri Construction — that's been sitting the longest and is above your $100k credit threshold.`,
    displayHint: 'table',
    data: {
      columns: ['Customer', 'Amount Overdue', 'Days Overdue'],
      rows: [
        ['Kauri Construction Ltd', '$118,200', '62 days'],
        ['Tūhoe Enterprises', '$72,300', '45 days'],
        ['Pacific Rim Logistics', '$41,800', '38 days'],
        ['Wellington City Trust', '$38,950', '31 days'],
        ['Other (4 customers)', '$41,200', '< 30 days'],
      ],
    },
  },
  {
    keywords: ['expense', 'cost', 'spend', 'spending', 'opex'],
    answer: `**Total operating expenses year-to-date: $2,598,270.**\n\nStaff costs remain your largest expense at 61% of total OpEx ($1,584,950), followed by subcontractors at 18% ($467,690). All categories are within budget except travel & accommodation, which is 12% over — mainly attributable to the Christchurch project in Q2.\n\nNo unusual spikes detected in the last 30 days.`,
    displayHint: 'bar_chart',
    data: {
      columns: ['Category', 'Amount'],
      rows: [
        ['Staff Costs', 1584950],
        ['Subcontractors', 467690],
        ['Materials', 312840],
        ['Travel & Accom', 134200],
        ['Software & Tools', 58400],
        ['Other', 40190],
      ],
    },
  },
  {
    keywords: ['cash', 'bank', 'balance', 'liquidity'],
    answer: `**Current bank balance: $748,320 across 2 accounts.**\n\n- ANZ Business Account: $612,480\n- BNZ Operating Account: $135,840\n\nCash flow for the next 30 days looks positive — $284,000 in invoices due for collection against $198,500 in scheduled supplier payments. **Net cash position in 30 days: ~$834,000** assuming normal collection rates.\n\nNo overdraft risk detected.`,
    displayHint: 'kpi',
    data: {
      kpis: [
        { label: 'Total Bank Balance', value: '$748,320', subtext: 'Across 2 accounts' },
        { label: '30-Day Forecast', value: '$834,000', subtext: 'At normal collection rates' },
        { label: 'Invoices Due', value: '$284,000', subtext: 'Next 30 days' },
        { label: 'Payments Scheduled', value: '$198,500', subtext: 'Next 30 days' },
      ],
    },
  },
  {
    keywords: ['invoice', 'posted', 'issued', 'billed'],
    answer: `**47 sales invoices posted in the last 30 days, totalling $389,240.**\n\nAverage invoice value: $8,281. Largest single invoice: $68,400 to Fletcher Building for the Queenstown fit-out project.\n\nAll invoices have valid GST numbers and correct payment terms applied. 3 invoices are currently in draft — do you want me to list them?`,
    displayHint: 'kpi',
    data: {
      kpis: [
        { label: 'Invoices (30 days)', value: '47', subtext: 'All posted' },
        { label: 'Total Billed', value: '$389,240', subtext: 'Last 30 days' },
        { label: 'Avg Invoice Value', value: '$8,281' },
        { label: 'Largest Invoice', value: '$68,400', subtext: 'Fletcher Building' },
      ],
    },
  },
  {
    keywords: ['profit', 'margin', 'net', 'ebitda', 'bottom line'],
    answer: `**Net profit year-to-date: $892,450 — a margin of 21.2%.**\n\nThis is up from 18.7% at the same point last year, driven primarily by improved subcontractor management and the shift to fixed-price contracts in Q2.\n\nEBITDA sits at $1,040,200 (24.6% margin). Depreciation and amortisation of $147,750 is largely the fleet vehicles added in FY23.`,
    displayHint: 'kpi',
    data: {
      kpis: [
        { label: 'Net Profit YTD', value: '$892,450', subtext: '21.2% margin' },
        { label: 'EBITDA', value: '$1,040,200', subtext: '24.6% margin' },
        { label: 'vs Prior Year', value: '+2.5pp', subtext: 'Margin improvement' },
        { label: 'Revenue YTD', value: '$4,218,340' },
      ],
    },
  },
  {
    keywords: ['vendor', 'supplier', 'payable', 'creditor', 'ap'],
    answer: `**Total accounts payable: $218,640 across 14 active vendors.**\n\nNothing is critically overdue — your oldest outstanding is 28 days (Placemakers, $14,200). Largest payable is Fulton Hogan at $68,300 due in 12 days.\n\nYour average payment days (DPO) is **24 days**, well within standard 30-day terms. No supplier relationship risk detected.`,
    displayHint: 'table',
    data: {
      columns: ['Vendor', 'Amount Due', 'Due In'],
      rows: [
        ['Fulton Hogan Ltd', '$68,300', '12 days'],
        ['Naylor Love Construction', '$42,180', '18 days'],
        ['Mitre 10 Trade', '$28,640', '22 days'],
        ['Placemakers', '$14,200', 'Overdue 28d'],
        ['Other (10 vendors)', '$65,320', 'Within terms'],
      ],
    },
  },
  {
    keywords: ['gst', 'tax', 'ird', 'inland revenue', 'return'],
    answer: `**Your next GST return covers 1 Feb – 31 Mar and is due 28 April.**\n\nEstimated GST liability: **$84,320** (output tax $142,180 less input credits $57,860).\n\nAll transactions in the period have valid tax codes applied. 2 purchase invoices are missing GST numbers — I'd recommend resolving those before filing to avoid IRD queries.\n\nWould you like me to list the invoices with missing GST numbers?`,
    displayHint: 'kpi',
    data: {
      kpis: [
        { label: 'GST Liability', value: '$84,320', subtext: 'Feb–Mar period' },
        { label: 'Output Tax', value: '$142,180' },
        { label: 'Input Credits', value: '$57,860' },
        { label: 'Return Due', value: '28 April' },
      ],
    },
  },
]

const DEFAULT_RESPONSE = {
  answer: `That's a great question. In a live BespoxAI deployment connected to your Business Central instance, I'd query your actual data and give you a precise answer with figures, trends, and recommendations.\n\nThis demo uses sample NZ business data. Try asking about:\n- **Revenue or sales** this year\n- **Overdue invoices** or receivables\n- **Cash balance** and 30-day forecast\n- **Expenses** by category\n- **GST** return estimate\n- **Profit margin** year-to-date`,
  displayHint: 'narrative',
  data: null,
}

function findResponse(question: string) {
  const q = question.toLowerCase()
  for (const mock of MOCK_RESPONSES) {
    if (mock.keywords.some(kw => q.includes(kw))) {
      return mock
    }
  }
  return DEFAULT_RESPONSE
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const question: string = body.question?.trim() ?? ''

  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  // Simulate a small realistic delay
  await new Promise(r => setTimeout(r, 800 + Math.random() * 600))

  const response = findResponse(question)

  return NextResponse.json({
    answer: response.answer,
    displayHint: response.displayHint,
    data: response.data,
    meta: { demo: true, recordCount: null },
  })
}
