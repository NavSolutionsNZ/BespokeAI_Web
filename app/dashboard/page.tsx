'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useSession, signOut } from 'next-auth/react'
import type { DisplayHint, StructuredData } from '@/app/api/query/route'
import DataVisualizer from '@/components/DataVisualizer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthStatus {
  status:     'checking' | 'ok' | 'error'
  latencyMs:  number | null
  checkedAt:  Date | null
  error?:     string
}

interface QueryLogItem {
  id:          string
  question:    string
  answer:      string
  displayHint: string | null
  data:        any
  entity:      string | null
  recordCount: number | null
  createdAt:   string
}

interface QueryResult {
  id: string
  question: string
  answer: string
  displayHint?: DisplayHint
  data?: StructuredData | null
  meta?: { entity: string; reasoning: string; recordCount: number; odataUrl: string }
  error?: string
  errorDetail?: string
  errorUrl?: string
  ts: Date
  loading?: boolean
}

type NavItem = 'assistant' | 'health' | 'cashflow' | 'monthend' | 'migration'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  'Show me overdue debtors',
  'Budget vs actual this month',
  'Which costs increased most in Q1?',
  'Forecast cash for next 4 weeks',
  "What's our gross margin by product line?",
  'Top 10 customers by balance',
]

const NAV_ITEMS: { id: NavItem; icon: string; label: string; badge?: string; soon?: boolean }[] = [
  { id: 'assistant', icon: '💬', label: 'CFO Assistant' },
  { id: 'health',    icon: '🔍', label: 'Health Scanner', badge: '3' },
  { id: 'cashflow',  icon: '📊', label: 'Cash Flow', soon: true },
  { id: 'monthend',  icon: '📅', label: 'Month-End Close', soon: true },
  { id: 'migration', icon: '🏗️', label: 'Migration Analyser', soon: true },
]

// ─── Health polling hook ──────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000

function useHealthStatus(): HealthStatus {
  const [health, setHealth] = useState<HealthStatus>({ status: 'checking', latencyMs: null, checkedAt: null })

  useEffect(() => {
    async function check() {
      try {
        const res  = await fetch('/api/health')
        const data = await res.json()
        setHealth({
          status:    data.ok ? 'ok' : 'error',
          latencyMs: data.latencyMs ?? null,
          checkedAt: new Date(data.checkedAt),
          error:     data.error,
        })
      } catch {
        setHealth(prev => ({ ...prev, status: 'error', checkedAt: new Date() }))
      }
    }

    check()
    const timer = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return health
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const health = useHealthStatus()

  const [activeNav, setActiveNav] = useState<NavItem>('assistant')
  const [question, setQuestion]   = useState('')
  const [history, setHistory]     = useState<QueryResult[]>([])
  const [showMeta, setShowMeta]   = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [queryLogs, setQueryLogs] = useState<QueryLogItem[]>([])

  // Load query history on mount
  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(d => setQueryLogs(d.logs ?? []))
      .catch(() => {})
  }, [])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  // ── Greeting ────────────────────────────────────────────────────────────────

  const firstName  = user?.name?.split(' ')[0] ?? 'there'
  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const tenantName = user?.tenantName ?? 'Your Company'

  // ── Query ───────────────────────────────────────────────────────────────────

  async function runQuery() {
    const q = question.trim()
    if (!q) return
    const id = Date.now().toString()
    setQuestion('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    setHistory(prev => [...prev, { id, question: q, answer: '', ts: new Date(), loading: true }])

    try {
      const res  = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      setHistory(prev => prev.map(item => item.id !== id ? item : {
        ...item, loading: false,
        answer: data.answer ?? '', displayHint: data.displayHint,
        data: data.data, meta: data.meta, error: data.error,
        errorDetail: data.detail, errorUrl: data.odataUrl,
      }))
      if (!data.error) {
        fetch('/api/history').then(r => r.json()).then(d => setQueryLogs(d.logs ?? [])).catch(() => {})
      }
    } catch {
      setHistory(prev => prev.map(item => item.id !== id ? item : {
        ...item, loading: false, error: 'Network error — could not reach server.',
      }))
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runQuery() }
  }

  // ── Initials ─────────────────────────────────────────────────────────────────

  const initials = (user?.name ?? 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarOpen ? 240 : 0, flexShrink: 0,
        background: 'var(--ink)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', transition: 'width 0.2s ease',
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}>

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22,
              color: 'var(--cream)', letterSpacing: '-0.3px',
            }}>Bespox</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 17,
              color: 'var(--amber)', letterSpacing: '0.04em', marginLeft: 3,
            }}>AI</span>
          </div>
          {/* Connected company badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
            background: health.status === 'ok'
              ? 'rgba(10,92,70,0.25)'
              : health.status === 'error'
              ? 'rgba(163,45,45,0.2)'
              : 'rgba(100,100,100,0.15)',
            border: `1px solid ${health.status === 'ok' ? 'rgba(10,92,70,0.4)' : health.status === 'error' ? 'rgba(163,45,45,0.35)' : 'rgba(100,100,100,0.25)'}`,
            borderRadius: 12, padding: '4px 10px',
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: health.status === 'ok' ? 'var(--jade)' : health.status === 'error' ? '#E24B4A' : 'rgba(214,217,212,0.4)',
              animation: health.status === 'ok' ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: health.status === 'ok' ? 'var(--jade)' : health.status === 'error' ? '#E24B4A' : 'rgba(214,217,212,0.4)',
            }}>
              {tenantName} · {health.status === 'ok' ? 'Live' : health.status === 'error' ? 'Offline' : '···'}
            </span>
          </div>
        </div>

        {/* Workspace label */}
        <div style={{ padding: '18px 20px 8px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(214,217,212,0.3)',
          }}>Workspace</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 10px' }}>
          {NAV_ITEMS.map(item => {
            const active = activeNav === item.id
            return (
              <button
                key={item.id}
                onClick={() => !item.soon && setActiveNav(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8, marginBottom: 2, border: 'none',
                  background: active ? 'rgba(10,92,70,0.3)' : 'transparent',
                  cursor: item.soon ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!active && !item.soon) (e.currentTarget.style.background = 'rgba(255,255,255,0.04)') }}
                onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent') }}
              >
                <span style={{ fontSize: 14, opacity: item.soon ? 0.35 : 1 }}>{item.icon}</span>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: active ? 600 : 400,
                  color: item.soon ? 'rgba(214,217,212,0.3)' : active ? 'var(--cream)' : 'rgba(214,217,212,0.7)',
                  flex: 1, textAlign: 'left',
                }}>
                  {item.label}
                </span>
                {item.badge && (
                  <span style={{
                    background: 'rgba(200,149,42,0.2)', border: '1px solid rgba(200,149,42,0.4)',
                    color: 'var(--amber)', fontFamily: 'var(--font-mono)',
                    fontSize: 9, padding: '1px 6px', borderRadius: 8,
                  }}>
                    {item.badge}
                  </span>
                )}
                {item.soon && (
                  <span style={{
                    color: 'rgba(214,217,212,0.25)', fontFamily: 'var(--font-mono)',
                    fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    Soon
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Query history */}
        {queryLogs.length > 0 && (
          <div style={{ padding: '12px 10px 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}>
            <div style={{ padding: '0 10px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(214,217,212,0.3)' }}>
              Recent queries
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 220 }}>
              {queryLogs.map(log => (
                <button
                  key={log.id}
                  onClick={() => {
                    setQuestion(log.question)
                    setActiveNav('assistant')
                    textareaRef.current?.focus()
                  }}
                  title={log.question}
                  style={{
                    width: '100%', display: 'flex', flexDirection: 'column', gap: 2,
                    padding: '7px 10px', borderRadius: 6, marginBottom: 1,
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 11,
                    color: 'rgba(214,217,212,0.7)', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
                  }}>
                    {log.question}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(214,217,212,0.25)', letterSpacing: '0.08em' }}>
                    {log.entity ?? ''}{log.entity && log.recordCount ? ' · ' : ''}{log.recordCount ? `${log.recordCount} records` : ''} · {formatRelativeTime(new Date(log.createdAt))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--jade), var(--forest))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--cream)',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? user?.email}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(214,217,212,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {user?.role ?? 'User'}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sign out"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(214,217,212,0.3)', fontSize: 14, padding: 4, lineHeight: 1,
              transition: 'color 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fog)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(214,217,212,0.3)')}
          >
            ⎋
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cream)' }}>

        {/* Header */}
        <header style={{
          padding: '0 28px', height: 60, flexShrink: 0,
          background: 'var(--white)', borderBottom: '1px solid var(--fog)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)', fontSize: 16, padding: 4 }}
            >
              ☰
            </button>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20,
                color: 'var(--ink)', lineHeight: 1,
              }}>
                {activeNav === 'assistant' ? 'CFO Assistant' : 'Data Health Scanner'}
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Live / offline badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: health.status === 'ok'
                ? 'rgba(26,146,114,0.08)'
                : health.status === 'error'
                ? 'rgba(163,45,45,0.08)'
                : 'rgba(100,100,100,0.06)',
              border: `1px solid ${health.status === 'ok' ? 'rgba(26,146,114,0.2)' : health.status === 'error' ? 'rgba(163,45,45,0.2)' : 'rgba(100,100,100,0.15)'}`,
              borderRadius: 20, padding: '4px 12px',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: health.status === 'ok' ? 'var(--jade)' : health.status === 'error' ? '#E24B4A' : 'rgba(150,150,150,0.5)',
                animation: health.status === 'ok' ? 'pulse 2s infinite' : 'none',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: health.status === 'ok' ? 'var(--forest)' : health.status === 'error' ? '#A32D2D' : 'var(--slate)',
              }}>
                {health.status === 'ok' ? 'BC connected' : health.status === 'error' ? 'Agent offline' : 'Checking…'}
              </span>
            </div>
            {/* Last checked + latency */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fog)' }}>
              {health.checkedAt
                ? `Checked ${formatRelativeTime(health.checkedAt)}${health.latencyMs != null ? ` · ${health.latencyMs}ms` : ''}`
                : 'Connecting…'}
            </span>
          </div>
        </header>

        {/* ── CFO Assistant view ─────────────────────────────────────────────── */}
        {activeNav === 'assistant' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Chat area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

              {/* Greeting state */}
              {history.length === 0 && (
                <div style={{ maxWidth: 680, margin: '0 auto' }}>
                  {/* AI opening message */}
                  <div style={{
                    background: 'var(--white)', border: '1px solid var(--fog)',
                    borderRadius: '2px 16px 16px 16px', padding: '20px 24px', marginBottom: 28,
                    boxShadow: '0 2px 12px rgba(4,14,9,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--jade), var(--forest))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream)',
                      }}>AI</div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)' }}>
                        BespoxAI · Financial Assistant
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
                      {greeting}, {firstName}. I&apos;m connected to{' '}
                      <strong>{tenantName}</strong> and ready to answer questions about your finances.
                      What would you like to know?
                    </p>
                  </div>

                  {/* Example queries */}
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate)' }}>
                      Suggested questions
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {EXAMPLE_QUERIES.map(q => (
                      <button key={q}
                        onClick={() => { setQuestion(q); textareaRef.current?.focus() }}
                        style={{
                          background: 'var(--white)', border: '1px solid var(--fog)',
                          borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                          fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--emerald)'; e.currentTarget.style.color = 'var(--forest)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--fog)'; e.currentTarget.style.color = 'var(--slate)' }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message history */}
              <div style={{ maxWidth: 680, margin: '0 auto' }}>
                {history.map(item => (
                  <div key={item.id} style={{ marginBottom: 24 }}>

                    {/* User question */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                      <div style={{
                        background: 'var(--forest)', color: 'var(--cream)',
                        borderRadius: '16px 2px 16px 16px', padding: '11px 18px',
                        maxWidth: '72%', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.55,
                        boxShadow: '0 2px 8px rgba(10,92,70,0.2)',
                      }}>
                        {item.question}
                      </div>
                    </div>

                    {/* AI answer */}
                    <div style={{
                      background: 'var(--white)', border: '1px solid var(--fog)',
                      borderRadius: '2px 16px 16px 16px', padding: '18px 22px',
                      maxWidth: '88%', boxShadow: '0 2px 12px rgba(4,14,9,0.04)',
                    }}>
                      {item.loading ? (
                        <LoadingDots />
                      ) : item.error ? (
                        <div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#A32D2D', lineHeight: 1.6, marginBottom: item.errorUrl ? 10 : 0 }}>
                            <strong>Error:</strong> {item.error}
                          </p>
                          {item.errorUrl && (
                            <details style={{ marginTop: 8 }}>
                              <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', cursor: 'pointer' }}>
                                Debug info
                              </summary>
                              <code style={{ display: 'block', background: 'var(--parchment)', padding: '8px 12px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', wordBreak: 'break-all', lineHeight: 1.6, marginTop: 6 }}>
                                {item.errorUrl}
                              </code>
                              {item.errorDetail && (
                                <code style={{ display: 'block', background: '#FEF2F2', padding: '8px 12px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#A32D2D', wordBreak: 'break-all', lineHeight: 1.6, marginTop: 4 }}>
                                  {item.errorDetail}
                                </code>
                              )}
                            </details>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Data pulse decoration */}
                          <DataPulseBar />

                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: item.data ? 0 : item.meta ? 14 : 0 }}>
                            {item.answer}
                          </p>

                          {/* Chart / table / KPI visualizer */}
                          {item.displayHint && item.displayHint !== 'narrative' && item.data && (
                            <div style={{ marginBottom: item.meta ? 18 : 0 }}>
                              <DataVisualizer displayHint={item.displayHint} data={item.data} />
                            </div>
                          )}

                          {/* Meta footer */}
                          {item.meta && (
                            <div style={{ borderTop: '1px solid var(--fog)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              {item.displayHint && item.displayHint !== 'narrative' && (
                                <span style={{
                                  background: 'rgba(10,92,70,0.08)', border: '1px solid rgba(10,92,70,0.2)',
                                  color: 'var(--forest)', fontFamily: 'var(--font-mono)',
                                  fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                                  padding: '2px 8px', borderRadius: 6,
                                }}>
                                  {item.displayHint.replace('_', ' ')}
                                </span>
                              )}
                              <button
                                onClick={() => setShowMeta(showMeta === item.id ? null : item.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontFamily: 'var(--font-mono)', fontSize: 9,
                                  letterSpacing: '0.1em', textTransform: 'uppercase',
                                  color: 'var(--slate)', padding: 0,
                                }}
                              >
                                {showMeta === item.id ? '▼' : '▶'} {item.meta.entity} · {item.meta.recordCount} records
                              </button>
                              {showMeta === item.id && (
                                <div style={{ width: '100%', marginTop: 8 }}>
                                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)', marginBottom: 6 }}>
                                    {item.meta.reasoning}
                                  </p>
                                  <code style={{
                                    display: 'block', background: 'var(--parchment)',
                                    padding: '8px 12px', borderRadius: 6,
                                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)',
                                    wordBreak: 'break-all', lineHeight: 1.6,
                                  }}>
                                    {item.meta.odataUrl}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fog)', marginTop: 5, paddingLeft: 4 }}>
                      {item.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input bar */}
            <div style={{
              background: 'var(--white)', borderTop: '1px solid var(--fog)',
              padding: '16px 28px 20px',
            }}>
              <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask about your Business Central data…  (Enter to send, Shift+Enter for new line)"
                  style={{
                    flex: 1, background: 'var(--cream)', border: '1px solid var(--fog)',
                    borderRadius: 10, padding: '11px 16px', color: 'var(--ink)', fontSize: 14,
                    fontFamily: 'var(--font-body)', resize: 'none', outline: 'none',
                    lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--fog)')}
                  onInput={e => {
                    const t = e.currentTarget; t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  onClick={runQuery}
                  disabled={!question.trim()}
                  style={{
                    background: question.trim() ? 'var(--forest)' : 'var(--fog)',
                    color: question.trim() ? 'var(--white)' : 'var(--slate)',
                    border: 'none', borderRadius: 10, padding: '11px 20px',
                    cursor: question.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 16, fontWeight: 700, transition: 'background 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (question.trim()) (e.currentTarget.style.background = 'var(--emerald)') }}
                  onMouseLeave={e => { if (question.trim()) (e.currentTarget.style.background = 'var(--forest)') }}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Health Scanner placeholder ─────────────────────────────────────── */}
        {activeNav === 'health' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <HealthScoreCard />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs  = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 10)  return 'just now'
  if (diffSec < 60)  return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60)  return `${diffMin}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--forest)', opacity: 0.3,
          animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(1); opacity: 0.3; }
          40%            { transform: scale(1.35); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

function DataPulseBar() {
  return (
    <div style={{ marginBottom: 14 }}>
      <svg width="120" height="20" viewBox="0 0 120 20" fill="none">
        <line x1="0" y1="10" x2="18" y2="10" stroke="var(--fog)" strokeWidth="1.5" />
        <path d="M18 10L30 10L36 3L42 17L48 6L54 14L60 10L102 10"
          stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="60" cy="10" r="2.5" fill="var(--gold)" />
        <line x1="102" y1="10" x2="120" y2="10" stroke="var(--fog)" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function HealthScoreCard() {
  const findings = [
    { severity: 'Critical', title: 'Duplicate VAT registration numbers', detail: '14 customers share VAT numbers — potential compliance risk and fraud exposure' },
    { severity: 'Critical', title: 'G/L balance discrepancy detected', detail: '3 accounts show net imbalance totalling $2,140 — likely from a failed posting batch' },
    { severity: 'Critical', title: 'Bank reconciliation 47 days overdue', detail: 'Reserve account has not been reconciled since 11 March — period is still open' },
    { severity: 'Warning',  title: '4 vendors without payment terms', detail: 'Missing terms cause inconsistent due date calculation on AP ageing reports' },
    { severity: 'Warning',  title: 'Dimension gaps on 23 transactions', detail: 'Sales journal entries missing required department dimension — affects management reporting' },
    { severity: 'Warning',  title: 'Number series approaching limit', detail: 'Sales Invoice series (SI-) at 94% capacity — will fail to post when exhausted' },
    { severity: 'Info',     title: '2 inactive user accounts with SUPER role', detail: 'Former employees retain full permissions — recommend removing access' },
  ]

  const colors = {
    Critical: { bg: 'rgba(163,45,45,0.06)', border: 'rgba(163,45,45,0.2)', text: '#A32D2D' },
    Warning:  { bg: 'rgba(200,149,42,0.08)', border: 'rgba(200,149,42,0.25)', text: 'var(--gold)' },
    Info:     { bg: 'rgba(59,82,73,0.06)',  border: 'rgba(59,82,73,0.2)',  text: 'var(--slate)' },
  }

  return (
    <>
      {/* Score card */}
      <div style={{
        background: 'var(--ink)', borderRadius: 16, padding: '28px 32px',
        display: 'flex', alignItems: 'center', gap: 32, marginBottom: 24,
      }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 300, color: 'var(--amber)', lineHeight: 1 }}>63</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(214,217,212,0.4)', marginTop: 4 }}>/ 100</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--cream)', marginBottom: 6 }}>
            Moderate — attention required
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(214,217,212,0.6)', lineHeight: 1.6 }}>
            3 critical issues and 4 warnings found across 34 automated checks. Run a fresh scan to update.
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            {[['3', 'Critical', '#A32D2D'], ['4', 'Warnings', 'var(--amber)'], ['0', 'Info', 'var(--slate)']].map(([n, label, color]) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '6px 14px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: color as string }}>{n}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(214,217,212,0.35)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Findings list */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 12 }}>
        All findings · Last scan: Today 9:14am · 34 checks run
      </div>
      {findings.map((f, i) => {
        const c = colors[f.severity as keyof typeof colors]
        return (
          <div key={i} style={{
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 10, padding: '14px 18px', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: c.text, marginTop: 2, flexShrink: 0,
              }}>{f.severity}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)', lineHeight: 1.5 }}>{f.detail}</div>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
