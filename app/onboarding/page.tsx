'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Data ─────────────────────────────────────────────────────────────────────

const BC_VERSIONS = [
  'Business Central 2024 Wave 2 (BC25)',
  'Business Central 2024 Wave 1 (BC24)',
  'Business Central 2023 Wave 2 (BC23)',
  'Business Central 2023 Wave 1 (BC22)',
  'Business Central 2022 Wave 2 (BC21)',
  'Business Central 2022 Wave 1 (BC20)',
  'Business Central 2021 Wave 2 (BC19)',
  'Business Central 2021 Wave 1 (BC18)',
  'Business Central 2020 Wave 2 (BC17)',
  'Business Central 2020 Wave 1 (BC16)',
  'Business Central 14 — 2019 Wave 1',
  'Older / Not sure',
]
const NAV_VERSIONS = [
  'NAV 2018 (NAV 12)',
  'NAV 2017 (NAV 11)',
  'NAV 2016 (NAV 10)',
  'NAV 2015 (NAV 9)',
  'NAV 2013 R2 (NAV 8)',
  'NAV 2013 (NAV 7)',
  'Older / Not sure',
]

const PERSONAS = [
  { id: 'cfo',     label: 'CFO / Finance Lead',    desc: 'Responsible for financial reporting and strategy' },
  { id: 'finance', label: 'Finance Assistant',      desc: 'Day-to-day financial data and reporting tasks'    },
  { id: 'it',      label: 'IT / System Admin',      desc: 'Setting up and managing the BC environment'      },
  { id: 'other',   label: 'Other',                  desc: 'Another role within the organisation'             },
]

const STEPS = [
  { label: 'Your role',     desc: 'Who you are'          },
  { label: 'Your system',   desc: 'BC or NAV version'    },
  { label: 'Your goals',    desc: 'What you want to do'  },
  { label: 'Connection',    desc: 'Connect your system'  },
  { label: 'All done',      desc: 'Ready to go'          },
]

// ─── Shared sub-components ────────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function FieldInput({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--fog)', borderRadius: 8, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
        onFocus={e  => (e.target.style.borderColor = 'var(--forest)')}
        onBlur={e   => (e.target.style.borderColor = 'var(--fog)')}
      />
    </div>
  )
}

function Select({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 14, color: value ? 'var(--ink)' : 'var(--slate)', background: 'var(--parchment)', border: '1px solid var(--fog)', borderRadius: 8, padding: '9px 12px', outline: 'none', cursor: 'pointer', appearance: 'none', boxSizing: 'border-box' }}
        onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--fog)')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [step,           setStep]          = useState(1)
  const [saving,         setSaving]        = useState(false)
  const [error,          setError]         = useState('')

  // Step 1
  const [persona, setPersona] = useState('')

  // Step 2
  const [navProduct,  setNavProduct]  = useState('')
  const [navVersion,  setNavVersion]  = useState('')
  const [lastCU,      setLastCU]      = useState('')

  // Step 3
  const [wantsToConnect, setWantsToConnect] = useState<boolean | null>(null)

  // Step 4
  const [bcPort,    setBcPort]    = useState('8048')
  const [agentPort, setAgentPort] = useState('8080')

  const user = session?.user as any

  // Redirect if already onboarded or not authed
  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/login'); return }
    if (user?.onboardingDone) router.replace('/dashboard')
  }, [status, session, user?.onboardingDone])

  if (status === 'loading' || !session || user?.onboardingDone) return null

  // Which steps are active/done
  const totalSteps = wantsToConnect === false ? 4 : 5  // step 4 skipped if no connection
  const effectiveStep = step

  // ── Helpers ────────────────────────────────────────────────────────────────

  function sidebarStepState(n: number): 'done' | 'active' | 'upcoming' {
    if (n < step) return 'done'
    if (n === step) return 'active'
    return 'upcoming'
  }

  function next() { setError(''); setStep(s => s + 1) }
  function back() { setError(''); setStep(s => s - 1) }

  function validateStep(): boolean {
    if (step === 1 && !persona) { setError('Please select your role to continue.'); return false }
    if (step === 2 && !navProduct) { setError('Please select your product to continue.'); return false }
    return true
  }

  function handleNext() {
    if (!validateStep()) return
    // Skip step 4 (connection) if they chose not to connect
    if (step === 3 && wantsToConnect === false) {
      setStep(5)
    } else {
      next()
    }
  }

  function handleBack() {
    // If on step 5 and skipped step 4
    if (step === 5 && wantsToConnect === false) {
      setStep(3)
    } else {
      back()
    }
  }

  async function finish() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona,
          navProduct: navProduct || null,
          navVersion: navVersion || null,
          lastCU:     lastCU     || null,
          bcPort:     parseInt(bcPort,    10) || 8048,
          agentPort:  parseInt(agentPort, 10) || 8080,
          wantsToConnect,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      await update()           // refresh JWT so onboardingDone flips to true
      router.replace('/dashboard')
    } catch {
      setError('Something went wrong — please try again.')
      setSaving(false)
    }
  }

  // ── Layout pieces ──────────────────────────────────────────────────────────

  const versionOptions = navProduct === 'BC' ? BC_VERSIONS : navProduct === 'NAV' ? NAV_VERSIONS : []

  const isSaaS = navProduct === 'BC' && (
    navVersion.startsWith('Business Central 2024') ||
    navVersion.startsWith('Business Central 2023') ||
    navVersion.startsWith('Business Central 2022')
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 260, flexShrink: 0, background: 'var(--ink)', display: 'flex', flexDirection: 'column', padding: '40px 28px', borderRight: '1px solid rgba(255,255,255,0.04)' }}>

        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--cream)', letterSpacing: '-0.3px' }}>Bespox</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 17, color: 'var(--amber)', letterSpacing: '0.04em', marginLeft: 3 }}>AI</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(214,217,212,0.3)', marginTop: 6 }}>Account setup</div>
        </div>

        {/* Steps */}
        <nav style={{ flex: 1 }}>
          {STEPS.map((s, i) => {
            const n     = i + 1
            const state = sidebarStepState(n)
            // Hide step 4 label if skipping connection
            if (n === 4 && wantsToConnect === false) return null

            const dotBg    = state === 'done'   ? 'rgba(26,146,114,0.2)'  : state === 'active' ? 'rgba(10,92,70,0.4)' : 'transparent'
            const dotBorder= state === 'done'   ? 'var(--jade)'           : state === 'active' ? 'var(--forest)'      : 'rgba(214,217,212,0.15)'
            const dotColor = state === 'done'   ? 'var(--jade)'           : state === 'active' ? 'var(--cream)'       : 'rgba(214,217,212,0.25)'
            const nameColor= state === 'active' ? 'var(--cream)'          : 'rgba(214,217,212,0.35)'
            const descColor= state === 'active' ? 'rgba(214,217,212,0.5)' : 'rgba(214,217,212,0.2)'

            return (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 6, position: 'relative' }}>
                {/* Connector line */}
                {i < STEPS.length - 1 && !(n === 3 && wantsToConnect === false) && (
                  <div style={{ position: 'absolute', left: 14, top: 30, width: 1, height: 28, background: state === 'done' ? 'rgba(26,146,114,0.3)' : 'rgba(255,255,255,0.05)' }} />
                )}
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${dotBorder}`, background: dotBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 500, color: dotColor, fontFamily: 'var(--font-mono)', zIndex: 1 }}>
                  {state === 'done' ? '✓' : n}
                </div>
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: state === 'active' ? 600 : 400, color: nameColor }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: descColor, marginTop: 1 }}>{s.desc}</div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(214,217,212,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, textAlign: 'left', padding: 0, marginTop: 16, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(214,217,212,0.55)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(214,217,212,0.25)')}
        >
          ↪ Sign out
        </button>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--fog)' }}>
          <div style={{ height: '100%', background: 'var(--forest)', width: `${(step / (wantsToConnect === false ? 4 : 5)) * 100}%`, transition: 'width 0.4s ease' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>

            {/* ── Step 1: Persona ── */}
            {step === 1 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', marginBottom: 10 }}>Step 1 of {wantsToConnect === false ? 4 : 5}</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.1 }}>Who are you?</h1>
                <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.65, marginBottom: 32, fontWeight: 300 }}>
                  Tell us your role so we can tailor the experience to what matters most to you.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                  {PERSONAS.map(p => {
                    const active = persona === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPersona(p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', border: `1.5px solid ${active ? 'var(--forest)' : 'var(--fog)'}`, borderRadius: 10, background: active ? 'rgba(10,92,70,0.06)' : 'var(--white)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active ? 'var(--forest)' : 'var(--fog)'}`, background: active ? 'var(--forest)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>{p.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {error && <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 16 }}>{error}</p>}
                <button onClick={handleNext} style={primaryBtn}>Continue →</button>
              </div>
            )}

            {/* ── Step 2: System ── */}
            {step === 2 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', marginBottom: 10 }}>Step 2 of {wantsToConnect === false ? 4 : 5}</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.1 }}>Your system</h1>
                <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.65, marginBottom: 32, fontWeight: 300 }}>
                  This helps us configure the right connection settings and compatibility checks. Don't worry if you're not sure — you can update this later in Settings.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                  {/* Product */}
                  <div>
                    <Label>Product</Label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {(['BC', 'NAV', 'unsure'] as const).map(p => {
                        const labels = { BC: 'Business Central', NAV: 'Microsoft NAV', unsure: 'Not sure' }
                        const active = navProduct === p
                        return (
                          <button key={p} onClick={() => { setNavProduct(p); setNavVersion('') }}
                            style={{ flex: 1, padding: '10px 12px', border: `1.5px solid ${active ? 'var(--forest)' : 'var(--fog)'}`, borderRadius: 8, background: active ? 'rgba(10,92,70,0.06)' : 'var(--white)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--forest)' : 'var(--slate)', transition: 'all 0.15s' }}>
                            {labels[p]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Version — shown once product selected */}
                  {navProduct && navProduct !== 'unsure' && (
                    <Select
                      label="Version"
                      value={navVersion}
                      onChange={setNavVersion}
                      options={versionOptions}
                      placeholder="Select version…"
                    />
                  )}

                  {/* Last CU */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <Label>Last cumulative update (CU)</Label>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)', letterSpacing: '0.06em' }}>optional</span>
                    </div>
                    <input
                      type="text"
                      value={lastCU}
                      placeholder="e.g. CU3, CU14, Update 23…"
                      onChange={e => setLastCU(e.target.value)}
                      style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--fog)', borderRadius: 8, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                      onBlur={e  => (e.target.style.borderColor = 'var(--fog)')}
                    />
                    <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 6, lineHeight: 1.5 }}>
                      Found in BC/NAV under Help → About. Not sure? Leave it blank — you can add it later.
                    </p>
                  </div>
                </div>

                {error && <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 16 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button onClick={handleBack} style={backBtn}>← Back</button>
                  <button onClick={handleNext} style={primaryBtn}>Continue →</button>
                </div>
              </div>
            )}

            {/* ── Step 3: Goals & Connection intent ── */}
            {step === 3 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', marginBottom: 10 }}>Step 3 of {wantsToConnect === false ? 4 : 5}</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.1 }}>Your goals</h1>
                <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.65, marginBottom: 32, fontWeight: 300 }}>
                  Would you like to connect your Business Central or NAV system now, or explore first and connect later?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                  {[
                    {
                      value: true,
                      title: 'Connect my system now',
                      desc: 'We\'ll walk you through the port settings. Your IT team will complete the agent install.',
                      icon: '⚡',
                    },
                    {
                      value: false,
                      title: 'Set up later',
                      desc: 'Explore the platform first. You can connect from Settings → BC Installer at any time.',
                      icon: '○',
                    },
                  ].map(opt => {
                    const active = wantsToConnect === opt.value
                    return (
                      <button
                        key={String(opt.value)}
                        onClick={() => setWantsToConnect(opt.value)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 18px', border: `1.5px solid ${active ? 'var(--forest)' : 'var(--fog)'}`, borderRadius: 10, background: active ? 'rgba(10,92,70,0.06)' : 'var(--white)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                      >
                        <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{opt.icon}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{opt.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 4, lineHeight: 1.5 }}>{opt.desc}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active ? 'var(--forest)' : 'var(--fog)'}`, background: active ? 'var(--forest)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {error && <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 16 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button onClick={handleBack} style={backBtn}>← Back</button>
                  <button onClick={handleNext} disabled={wantsToConnect === null} style={{ ...primaryBtn, opacity: wantsToConnect === null ? 0.4 : 1, cursor: wantsToConnect === null ? 'default' : 'pointer' }}>Continue →</button>
                </div>
              </div>
            )}

            {/* ── Step 4: Connection setup (conditional) ── */}
            {step === 4 && wantsToConnect && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', marginBottom: 10 }}>Step 4 of 5</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.1 }}>Connection setup</h1>
                <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.65, marginBottom: 28, fontWeight: 300 }}>
                  BespoxAI connects via a lightweight agent installed on your BC server. We just need to know which ports it will use — your IT team downloads and runs the installer from Settings.
                </p>

                {/* SaaS note */}
                {isSaaS && (
                  <div style={{ background: 'rgba(200,149,42,0.08)', border: '1px solid rgba(200,149,42,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 24 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>BC SaaS detected</div>
                    <p style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 1.55 }}>
                      Your version may support direct API / OAuth connections — our team will confirm the best approach for your environment. For now, enter your on-prem port settings if applicable, or skip and we'll be in touch.
                    </p>
                  </div>
                )}

                <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <Label>BC OData port</Label>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)' }}>default: 8048</span>
                      </div>
                      <input
                        type="number"
                        value={bcPort}
                        onChange={e => setBcPort(e.target.value)}
                        style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--fog)', borderRadius: 8, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                        onBlur={e  => (e.target.style.borderColor = 'var(--fog)')}
                      />
                      <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 5 }}>The port BC exposes for OData services</p>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <Label>Agent port</Label>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)' }}>default: 8080</span>
                      </div>
                      <input
                        type="number"
                        value={agentPort}
                        onChange={e => setAgentPort(e.target.value)}
                        style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)', background: 'var(--parchment)', border: '1px solid var(--fog)', borderRadius: 8, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                        onBlur={e  => (e.target.style.borderColor = 'var(--fog)')}
                      />
                      <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 5 }}>The port the BespoxAI agent will listen on</p>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--fog)', paddingTop: 14 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 6 }}>What happens next</div>
                    <p style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 1.6 }}>
                      These port values are saved and pre-filled into the installer in <strong>Settings → BC Installer</strong>. Your IT team enters BC credentials there and downloads a pre-configured installer zip — no manual config required.
                    </p>
                  </div>
                </div>

                {error && <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 16 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button onClick={handleBack} style={backBtn}>← Back</button>
                  <button onClick={handleNext} style={primaryBtn}>Continue →</button>
                </div>
              </div>
            )}

            {/* ── Step 5: Done ── */}
            {step === 5 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(26,146,114,0.12)', border: '2px solid var(--jade)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', fontSize: 24 }}>
                  ✓
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 400, color: 'var(--ink)', marginBottom: 10 }}>You're all set.</h1>
                <p style={{ fontSize: 15, color: 'var(--slate)', lineHeight: 1.65, marginBottom: 36, fontWeight: 300, maxWidth: 380, margin: '0 auto 36px' }}>
                  Your workspace is configured. {wantsToConnect
                    ? 'Head to Settings → BC Installer when your IT team is ready to complete the connection.'
                    : 'You can connect your BC or NAV system any time from Settings → BC Installer.'}
                </p>

                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 36, textAlign: 'left' }}>
                  {[
                    ['Role',          PERSONAS.find(p => p.id === persona)?.label ?? persona],
                    ['Product',       navProduct === 'BC' ? 'Business Central' : navProduct === 'NAV' ? 'Microsoft NAV' : 'Not specified'],
                    ['Version',       navVersion || '—'],
                    ['Last CU',       lastCU     || '—'],
                    ...(wantsToConnect ? [['BC OData port', bcPort], ['Agent port', agentPort]] : []),
                    ['Connection',    wantsToConnect ? 'Installer ready in Settings' : 'Set up later'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {error && <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 16 }}>{error}</p>}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button onClick={handleBack} style={backBtn}>← Back</button>
                  <button onClick={finish} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer' }}>
                    {saving ? 'Setting up…' : 'Go to dashboard →'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Button styles ─────────────────────────────────────────────────────────────

const primaryBtn: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 500,
  padding: '11px 28px',
  background: 'var(--forest)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
}

const backBtn: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  color: 'var(--slate)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '11px 0',
}
