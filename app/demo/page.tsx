'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import DataVisualizer from '@/components/DataVisualizer'
import type { DisplayHint, StructuredData } from '@/app/api/query/route'

interface DemoResult {
  id: string
  question: string
  answer: string
  displayHint?: DisplayHint
  data?: StructuredData | null
  loading: boolean
}

const SUGGESTED = [
  'What is our revenue this financial year?',
  'Show overdue invoices',
  'What is our cash balance?',
  'Expenses by category YTD',
  'What is our net profit margin?',
  'GST return estimate',
]

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export default function DemoPage() {
  const [history, setHistory]   = useState<DemoResult[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function runQuery(q?: string) {
    const text = (q ?? question).trim()
    if (!text || loading) return
    setQuestion('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const id = Math.random().toString(36).slice(2)
    setHistory(prev => [...prev, { id, question: text, answer: '', loading: true }])
    setLoading(true)

    try {
      const res  = await fetch('/api/demo/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await res.json()
      setHistory(prev => prev.map(item => item.id !== id ? item : {
        ...item, loading: false,
        answer: data.answer ?? '',
        displayHint: data.displayHint,
        data: data.data,
      }))
    } catch {
      setHistory(prev => prev.map(item => item.id !== id ? item : {
        ...item, loading: false,
        answer: 'Demo query failed — please refresh and try again.',
      }))
    }
    setLoading(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runQuery() }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ink)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)',
    }}>

      {/* ── Top banner ───────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #0A5C46, #0c6e56)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#C8952A',
            boxShadow: '0 0 6px #C8952A',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ color: '#F4EFE4', fontSize: 13, fontWeight: 500 }}>
            Live demo — sample NZ business data · No login required
          </span>
        </div>
        <a
          href="/signup"
          style={{
            background: '#C8952A',
            color: '#040E09',
            padding: '7px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Start free trial →
        </a>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        background: '#040E09',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--font-cormorant)',
            fontSize: 22,
            fontWeight: 600,
            color: '#F4EFE4',
            letterSpacing: '0.01em',
          }}>
            Bespox<span style={{ color: '#C8952A' }}>AI</span>
          </span>
          <span style={{
            background: 'rgba(200,149,42,0.12)',
            border: '1px solid rgba(200,149,42,0.25)',
            color: '#C8952A',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            borderRadius: 4,
            letterSpacing: '0.08em',
          }}>
            DEMO
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/login" style={{ color: '#8a9a8e', fontSize: 13, textDecoration: 'none' }}>
            Sign in
          </a>
          <a
            href="/signup"
            style={{
              background: 'transparent',
              border: '1px solid #0A5C46',
              color: '#F4EFE4',
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Start free trial
          </a>
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: 'calc(100vh - 108px)' }}>

        {/* Sidebar */}
        <aside style={{
          width: 240,
          background: '#040E09',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}>
          <div style={{ padding: '0 16px 12px', marginBottom: 4 }}>
            <span style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: '#4a5a4e',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              Demo Company
            </span>
            <div style={{ marginTop: 4, fontSize: 13, color: '#8a9a8e', fontWeight: 500 }}>
              Acme NZ Ltd
            </div>
          </div>

          {/* Active nav item */}
          {[
            { label: 'CFO Assistant', active: true },
            { label: 'Data Health', active: false },
          ].map(item => (
            <div key={item.label} style={{
              margin: '0 10px',
              padding: '9px 14px',
              borderRadius: 8,
              background: item.active ? 'rgba(10,92,70,0.35)' : 'transparent',
              border: item.active ? '1px solid rgba(10,92,70,0.5)' : '1px solid transparent',
              color: item.active ? '#F4EFE4' : '#4a5a4e',
              fontSize: 13,
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>{item.label === 'CFO Assistant' ? '◈' : '◉'}</span>
              {item.label}
            </div>
          ))}

          {/* Upgrade CTA in sidebar */}
          <div style={{ flex: 1 }} />
          <div style={{
            margin: '0 10px',
            padding: '14px',
            borderRadius: 10,
            background: 'rgba(200,149,42,0.06)',
            border: '1px solid rgba(200,149,42,0.2)',
          }}>
            <div style={{ fontSize: 12, color: '#C8952A', fontWeight: 600, marginBottom: 6 }}>
              Ready to connect your BC?
            </div>
            <div style={{ fontSize: 11, color: '#8a9a8e', marginBottom: 10, lineHeight: 1.5 }}>
              7-day free trial. Your live data, your questions.
            </div>
            <a href="/signup" style={{
              display: 'block',
              background: '#C8952A',
              color: '#040E09',
              textAlign: 'center',
              padding: '7px 0',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}>
              Start free trial
            </a>
          </div>
        </aside>

        {/* Chat area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f7f5f0', overflow: 'hidden' }}>

          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

            {/* Greeting */}
            {history.length === 0 && (
              <div style={{ maxWidth: 680, margin: '0 auto' }}>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e8e4dc',
                  borderRadius: '2px 16px 16px 16px',
                  padding: '20px 24px',
                  marginBottom: 28,
                  boxShadow: '0 2px 12px rgba(4,14,9,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0A5C46, #0F6E56)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>AI</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#040E09' }}>BespoxAI CFO Assistant</span>
                    <span style={{
                      fontSize: 10, color: '#C8952A', fontFamily: 'var(--font-mono)',
                      background: 'rgba(200,149,42,0.1)', padding: '2px 7px', borderRadius: 4,
                    }}>DEMO</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#3a4a3e', lineHeight: 1.65, margin: 0 }}>
                    Welcome to the BespoxAI demo. I'm showing you what your CFO Assistant looks like connected to a sample NZ business in Business Central.
                  </p>
                  <p style={{ fontSize: 14, color: '#3a4a3e', lineHeight: 1.65, margin: '10px 0 0' }}>
                    Ask me anything about the demo company's finances — revenue, debtors, expenses, GST, cash flow, and more.
                  </p>
                </div>

                {/* Suggested questions */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8a9a8e', letterSpacing: '0.08em', marginBottom: 10 }}>
                    TRY ASKING
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SUGGESTED.map(q => (
                      <button
                        key={q}
                        onClick={() => runQuery(q)}
                        style={{
                          background: '#fff',
                          border: '1px solid #e0dbd4',
                          borderRadius: 20,
                          padding: '7px 14px',
                          fontSize: 13,
                          color: '#040E09',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#0A5C46')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0dbd4')}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat history */}
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              {history.map(item => (
                <div key={item.id} style={{ marginBottom: 24 }}>

                  {/* User bubble */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <div style={{
                      background: '#0A5C46',
                      color: '#fff',
                      borderRadius: '16px 2px 16px 16px',
                      padding: '11px 16px',
                      fontSize: 14,
                      maxWidth: '75%',
                      lineHeight: 1.55,
                    }}>
                      {item.question}
                    </div>
                  </div>

                  {/* AI answer */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e8e4dc',
                    borderRadius: '2px 16px 16px 16px',
                    padding: '18px 22px',
                    boxShadow: '0 2px 8px rgba(4,14,9,0.04)',
                  }}>
                    {item.loading ? (
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#0A5C46',
                            opacity: 0.4,
                            animation: `bounce 1.2s ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div
                          style={{ fontSize: 14, color: '#1a2a1e', lineHeight: 1.7 }}
                          dangerouslySetInnerHTML={{ __html: parseMarkdown(item.answer) }}
                        />
                        {item.displayHint && item.displayHint !== 'narrative' && item.data && (
                          <div style={{ marginTop: 16 }}>
                            <DataVisualizer displayHint={item.displayHint} data={item.data} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar */}
          <div style={{
            background: '#ffffff',
            borderTop: '1px solid #e8e4dc',
            padding: '14px 28px 18px',
          }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask about revenue, expenses, debtors, cash flow…"
                  style={{
                    flex: 1,
                    background: '#f7f5f0',
                    border: '1px solid #e0dbd4',
                    borderRadius: 10,
                    padding: '11px 16px',
                    color: '#040E09',
                    fontSize: 14,
                    fontFamily: 'var(--font-body)',
                    resize: 'none',
                    outline: 'none',
                    lineHeight: 1.5,
                    maxHeight: 120,
                    overflowY: 'auto',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#0A5C46')}
                  onBlur={e => (e.target.style.borderColor = '#e0dbd4')}
                  onInput={e => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  onClick={() => runQuery()}
                  disabled={!question.trim() || loading}
                  style={{
                    background: question.trim() && !loading ? '#0A5C46' : '#e0dbd4',
                    color: question.trim() && !loading ? '#fff' : '#8a9a8e',
                    border: 'none',
                    borderRadius: 10,
                    padding: '11px 20px',
                    cursor: question.trim() && !loading ? 'pointer' : 'not-allowed',
                    fontSize: 16,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  →
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#8a9a8e', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
                Demo data only · No Business Central connection ·{' '}
                <a href="/signup" style={{ color: '#0A5C46', textDecoration: 'none', fontWeight: 600 }}>
                  Start your free trial to connect your real data →
                </a>
              </p>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  )
}
