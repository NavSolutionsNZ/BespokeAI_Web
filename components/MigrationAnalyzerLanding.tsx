'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

const BC_VERSIONS = [
  'NAV 2009 / Classic',
  'NAV 2013 / 2013 R2',
  'NAV 2015',
  'NAV 2016',
  'NAV 2017',
  'NAV 2018',
  'Business Central 14 (on-prem, last CAL version)',
  'Business Central 15–23 (on-prem, AL)',
  'Not sure',
]

const USER_RANGES = ['1–5 users', '6–15 users', '16–50 users', '50+ users']

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  color: 'var(--slate)',
  letterSpacing: '0.06em',
  marginBottom: 6,
  marginTop: 14,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--fog)',
  borderRadius: 7,
  fontSize: 14,
  fontFamily: 'var(--font-body)',
  color: 'var(--ink)',
  background: 'var(--cream)',
  outline: 'none',
  boxSizing: 'border-box',
}

function SuccessState({ firstName }: { firstName: string }) {
  return (
    <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32,
        color: 'var(--ink)',
        margin: '0 0 12px',
      }}>
        We&apos;re on it{firstName ? `, ${firstName}` : ''}!
      </h2>
      <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.65, margin: '0 0 20px' }}>
        Your migration analysis request has been received. We&apos;ll review your details
        and call you within 1 business day to talk through scope and pricing.
      </p>
      <p style={{ color: 'var(--slate)', fontSize: 14, lineHeight: 1.6 }}>
        In the meantime, it&apos;s worth noting any key integrations your system has,
        and whether you still have access to your original installation media or a
        clean object export from go-live.
      </p>
    </div>
  )
}

export default function MigrationAnalyzerLanding() {
  const { data: session } = useSession()
  const [form, setForm] = useState({
    contactName: (session?.user as any)?.name || '',
    phone: '',
    version: '',
    users: '',
    urgency: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.phone || !form.version || !form.users) {
      setError('Please fill in your phone number, NAV/BC version, and number of users.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/migration/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      setError('Something went wrong — please try again or contact us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const firstName = form.contactName?.split(' ')[0] || ''
    return <SuccessState firstName={firstName} />
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--forest) 0%, var(--ink) 100%)',
        borderRadius: 16,
        padding: '52px 48px',
        marginBottom: 36,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 340, height: 340,
          background: 'rgba(200,149,42,0.07)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        <div style={{
          display: 'inline-block',
          background: 'rgba(200,149,42,0.18)',
          border: '1px solid rgba(200,149,42,0.35)',
          borderRadius: 20,
          padding: '4px 14px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--amber)',
          letterSpacing: '0.09em',
          marginBottom: 22,
          textTransform: 'uppercase',
        }}>
          Migration Analyser
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 44,
          fontWeight: 600,
          color: 'var(--white)',
          margin: '0 0 18px',
          lineHeight: 1.12,
          maxWidth: 600,
        }}>
          Your legacy NAV system is holding your business back
        </h1>

        <p style={{
          color: 'rgba(250,250,248,0.75)',
          fontSize: 17,
          lineHeight: 1.68,
          maxWidth: 580,
          margin: '0 0 36px',
          fontFamily: 'var(--font-body)',
        }}>
          No AI. No Power BI. No modern integrations. No support. Every year you stay on
          an unsupported version, the cost and risk of your eventual upgrade grows.
          Know exactly what you&apos;re dealing with — before it becomes a crisis.
        </p>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { num: '72%', label: 'of NAV upgrades cost more than budgeted' },
            { num: '3×', label: 'higher cost when migrating unplanned' },
            { num: '100%', label: 'of businesses eventually have to upgrade' },
          ].map(stat => (
            <div key={stat.num} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '14px 22px',
              minWidth: 160,
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 34,
                color: 'var(--amber)',
                fontWeight: 600,
                lineHeight: 1,
              }}>{stat.num}</div>
              <div style={{
                fontSize: 12,
                color: 'rgba(250,250,248,0.58)',
                marginTop: 5,
                fontFamily: 'var(--font-body)',
                lineHeight: 1.45,
              }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Report contents + CTA form ────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 28,
        marginBottom: 36,
        alignItems: 'start',
      }}>

        {/* Left — what you get */}
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--ink)',
            margin: '0 0 8px',
          }}>What&apos;s in your report</h2>
          <p style={{
            color: 'var(--slate)',
            fontSize: 14,
            lineHeight: 1.65,
            margin: '0 0 24px',
          }}>
            A plain-English analysis of your current system and a clear roadmap for
            your upgrade — yours to keep, whoever ends up doing the work.
          </p>

          {[
            {
              icon: '📋',
              title: 'Full Object Inventory',
              desc: 'Every customisation catalogued — standard modifications, custom objects, integrations, and data structures',
            },
            {
              icon: '⚠️',
              title: 'Upgrade Risk Assessment',
              desc: 'Each modification rated Low / Medium / High risk for the upgrade path, with clear reasoning',
            },
            {
              icon: '🧩',
              title: 'AL Extension Map',
              desc: 'Which mods become AL extensions, which are now standard in BC, and which can be safely dropped',
            },
            {
              icon: '⏱️',
              title: 'Effort Estimate',
              desc: 'Detailed hours breakdown by phase: scoping, development, data migration, testing, and go-live',
            },
            {
              icon: '🗺️',
              title: 'Migration Roadmap',
              desc: 'Recommended target BC version, sequencing of work, and the key decisions you\'ll need to make',
            },
            {
              icon: '📄',
              title: 'Yours to Keep',
              desc: 'Full PDF report — use it internally, take it to any partner, or use it to plan your own timeline',
            },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 22, marginTop: 1, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'var(--ink)',
                  marginBottom: 3,
                }}>{item.title}</div>
                <div style={{
                  fontSize: 13,
                  color: 'var(--slate)',
                  lineHeight: 1.55,
                }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Right — request form */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--fog)',
          borderRadius: 14,
          padding: '32px 30px',
          boxShadow: '0 4px 28px rgba(4,14,9,0.06)',
          position: 'sticky',
          top: 24,
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            color: 'var(--ink)',
            margin: '0 0 6px',
          }}>Request your analysis</h3>
          <p style={{
            fontSize: 13,
            color: 'var(--slate)',
            margin: '0 0 22px',
            lineHeight: 1.55,
          }}>
            We&apos;ll review your details and call you within 1 business day
            to discuss scope and pricing — no obligation.
          </p>

          <label style={labelStyle}>Your name</label>
          <input
            style={inputStyle}
            value={form.contactName}
            onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
            placeholder="Full name"
          />

          <label style={labelStyle}>Phone number *</label>
          <input
            style={inputStyle}
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+64 21 000 0000"
          />

          <label style={labelStyle}>Current NAV / BC version *</label>
          <select
            style={inputStyle}
            value={form.version}
            onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
          >
            <option value="">Select your version…</option>
            {BC_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <label style={labelStyle}>Number of users *</label>
          <select
            style={inputStyle}
            value={form.users}
            onChange={e => setForm(f => ({ ...f, users: e.target.value }))}
          >
            <option value="">Select range…</option>
            {USER_RANGES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          <label style={labelStyle}>Urgency</label>
          <select
            style={inputStyle}
            value={form.urgency}
            onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}
          >
            <option value="">Select…</option>
            <option value="exploring">Just exploring options</option>
            <option value="planning">Planning for the next 12 months</option>
            <option value="urgent">Need to move soon</option>
            <option value="crisis">Upgrade is overdue / business critical</option>
          </select>

          <label style={labelStyle}>Anything else we should know?</label>
          <textarea
            style={{ ...inputStyle, minHeight: 76, resize: 'vertical' }}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Key integrations, number of companies, known customisations…"
          />

          {error && (
            <div style={{
              color: '#b91c1c',
              fontSize: 13,
              marginTop: 10,
              marginBottom: 4,
              lineHeight: 1.45,
            }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%',
              marginTop: 18,
              padding: '13px 24px',
              background: submitting ? 'var(--slate)' : 'var(--forest)',
              color: 'var(--white)',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.01em',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? 'Sending…' : 'Request My Migration Analysis →'}
          </button>

          <p style={{
            fontSize: 11,
            color: 'var(--slate)',
            textAlign: 'center',
            marginTop: 10,
            lineHeight: 1.5,
          }}>
            We&apos;ll call within 1 business day. No spam, no obligation.
          </p>
        </div>
      </div>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--parchment)',
        borderRadius: 14,
        padding: '40px 44px',
        marginBottom: 28,
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          color: 'var(--ink)',
          margin: '0 0 32px',
          textAlign: 'center',
        }}>How it works</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 24,
        }}>
          {[
            {
              step: '01',
              icon: '📞',
              title: 'We talk',
              desc: 'A quick call to understand your setup, version history, and what a successful upgrade looks like for your business',
            },
            {
              step: '02',
              icon: '📤',
              title: 'You export',
              desc: 'Export your NAV objects as a .txt file using the classic dev environment — we send you step-by-step instructions',
            },
            {
              step: '03',
              icon: '🔍',
              title: 'We analyse',
              desc: 'Our AI compares your objects against the standard baseline for your version, identifying every modification and its upgrade impact',
            },
            {
              step: '04',
              icon: '📄',
              title: 'You get your report',
              desc: 'Full PDF delivered within 5 business days — yours to keep and act on however you choose',
            },
          ].map(step => (
            <div key={step.step} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--jade)',
                letterSpacing: '0.1em',
                marginBottom: 10,
              }}>{step.step}</div>
              <div style={{ fontSize: 30, marginBottom: 10 }}>{step.icon}</div>
              <div style={{
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--ink)',
                marginBottom: 6,
              }}>{step.title}</div>
              <div style={{
                fontSize: 13,
                color: 'var(--slate)',
                lineHeight: 1.55,
              }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Reassurance pills ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {[
          '✓ Fixed fee — no surprises',
          '✓ Report is yours regardless of who does the work',
          '✓ No obligation to use us for the upgrade',
          '✓ Delivered within 5 business days',
        ].map(item => (
          <div key={item} style={{
            fontSize: 13,
            color: 'var(--forest)',
            fontWeight: 500,
            background: 'rgba(10,92,70,0.08)',
            border: '1px solid rgba(10,92,70,0.15)',
            borderRadius: 20,
            padding: '6px 16px',
          }}>{item}</div>
        ))}
      </div>
    </div>
  )
}
