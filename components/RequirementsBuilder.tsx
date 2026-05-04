'use client'

import { useState, useEffect } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Requirement {
  id:              string
  tenantId:        string
  userId:          string
  title:           string
  description:     string
  bcArea:          string
  priority:        string
  aiSpec:          string | null
  status:          string
  quote:           string | null
  quoteApprovedAt: string | null
  consultantNote:  string | null
  createdAt:       string
  updatedAt:       string
  user:            { name: string | null; email: string }
  tenant:          { name: string }
}

interface AiSpec {
  userStory:           string
  acceptanceCriteria:  string[]
  bcObjects:           string[]
  complexity:          'Simple' | 'Medium' | 'Complex'
  estimatedDays:       number
  notes:               string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const BC_AREAS = [
  'Sales', 'Purchase', 'Finance', 'Inventory',
  'Manufacturing', 'Project', 'HR', 'Fixed Assets',
  'Warehouse', 'Service', 'Other',
]

const PRIORITIES = [
  { value: 'nice_to_have', label: 'Nice to have',  color: '#3B5249',  bg: 'rgba(59,82,73,0.08)',  border: 'rgba(59,82,73,0.2)'  },
  { value: 'important',    label: 'Important',      color: '#C8952A',  bg: 'rgba(200,149,42,0.08)', border: 'rgba(200,149,42,0.25)' },
  { value: 'critical',     label: 'Critical',       color: '#A32D2D',  bg: 'rgba(163,45,45,0.06)', border: 'rgba(163,45,45,0.2)'  },
]

const STATUS_PIPELINE: { key: string; label: string }[] = [
  { key: 'draft',          label: 'Draft'          },
  { key: 'submitted',      label: 'Submitted'      },
  { key: 'in_review',      label: 'In Review'      },
  { key: 'quoted',         label: 'Quoted'         },
  { key: 'approved',       label: 'Approved'       },
  { key: 'in_development', label: 'In Development' },
  { key: 'complete',       label: 'Complete'       },
]

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  draft:          { bg: 'rgba(59,82,73,0.06)',   border: 'rgba(59,82,73,0.15)',  text: '#3B5249' },
  submitted:      { bg: 'rgba(200,149,42,0.08)', border: 'rgba(200,149,42,0.25)', text: '#C8952A' },
  in_review:      { bg: 'rgba(200,149,42,0.12)', border: 'rgba(200,149,42,0.35)', text: '#9A6A00' },
  quoted:         { bg: 'rgba(10,92,70,0.08)',   border: 'rgba(10,92,70,0.2)',   text: '#0A5C46' },
  approved:       { bg: 'rgba(10,92,70,0.12)',   border: 'rgba(10,92,70,0.3)',   text: '#085040' },
  in_development: { bg: 'rgba(14,110,86,0.1)',   border: 'rgba(14,110,86,0.25)', text: '#0A5C46' },
  complete:       { bg: 'rgba(26,146,114,0.1)',  border: 'rgba(26,146,114,0.3)', text: '#0F6E56' },
  rejected:       { bg: 'rgba(163,45,45,0.06)',  border: 'rgba(163,45,45,0.2)',  text: '#A32D2D' },
}

function statusLabel(status: string) {
  return STATUS_PIPELINE.find(s => s.key === status)?.label ?? status.replace(/_/g, ' ')
}

function priorityMeta(priority: string) {
  return PRIORITIES.find(p => p.value === priority) ?? PRIORITIES[0]
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userRole: string
  tenantId: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function RequirementsBuilder({ userRole, tenantId }: Props) {
  const isSuperadmin = userRole === 'superadmin'
  const isAdmin = userRole === 'tenant_admin' || isSuperadmin

  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', bcArea: 'Finance', priority: 'important' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Detail / edit panel
  const [selected, setSelected]       = useState<Requirement | null>(null)
  const [generatingSpec, setGeneratingSpec] = useState(false)
  const [specError, setSpecError]     = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Admin: quote input overlay
  const [quoteInput, setQuoteInput]   = useState('')
  const [quoteNote, setQuoteNote]     = useState('')
  const [showQuoteForm, setShowQuoteForm] = useState(false)

  // Filter
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterArea, setFilterArea]     = useState<string>('all')

  // ── Load ────────────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/requirements')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRequirements(data.requirements)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load requirements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Create ──────────────────────────────────────────────────────────────────

  async function createRequirement() {
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('Title and description are required.')
      return
    }
    setSaving(true); setFormError('')
    try {
      const res  = await fetch('/api/requirements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRequirements(prev => [data.requirement, ...prev])
      setSelected(data.requirement)
      setShowCreate(false)
      setForm({ title: '', description: '', bcArea: 'Finance', priority: 'important' })
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to create requirement')
    } finally {
      setSaving(false)
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function patchRequirement(id: string, body: object) {
    setActionLoading(true)
    try {
      const res  = await fetch(`/api/requirements/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const updated = data.requirement
      setRequirements(prev => prev.map(r => r.id === id ? updated : r))
      if (selected?.id === id) setSelected(updated)
      return updated
    } catch (e: any) {
      alert(e.message ?? 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function deleteRequirement(id: string) {
    if (!confirm('Delete this draft requirement?')) return
    const res  = await fetch(`/api/requirements/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Delete failed'); return }
    setRequirements(prev => prev.filter(r => r.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function generateSpec(req: Requirement) {
    setGeneratingSpec(true); setSpecError('')
    try {
      const res  = await fetch(`/api/requirements/${req.id}/ai-spec`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const updated = data.requirement
      setRequirements(prev => prev.map(r => r.id === req.id ? updated : r))
      setSelected(updated)
    } catch (e: any) {
      setSpecError(e.message ?? 'AI generation failed')
    } finally {
      setGeneratingSpec(false)
    }
  }

  async function submitQuote() {
    if (!selected) return
    await patchRequirement(selected.id, {
      status:         'quoted',
      quote:          quoteInput,
      consultantNote: quoteNote || undefined,
    })
    setShowQuoteForm(false)
    setQuoteInput('')
    setQuoteNote('')
  }

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered = requirements.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterArea   !== 'all' && r.bcArea  !== filterArea)  return false
    return true
  })

  // ─────────────────────────────────────────────────────────────────────────────

  const parsedSpec = (req: Requirement): AiSpec | null => {
    if (!req.aiSpec) return null
    try { return JSON.parse(req.aiSpec) } catch { return null }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        Loading requirements…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#A32D2D', fontFamily: 'var(--font-body)', fontSize: 13 }}>
        {error} <button onClick={load} style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--forest)', textDecoration: 'underline', fontSize: 13 }}>Retry</button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Left: list ──────────────────────────────────────────────────────── */}
      <div style={{
        width: selected ? 380 : '100%', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: selected ? '1px solid var(--fog)' : 'none',
        overflow: 'hidden', transition: 'width 0.2s',
      }}>

        {/* Toolbar */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--fog)',
          display: 'flex', alignItems: 'center', gap: 10, background: 'var(--white)',
        }}>
          <button
            onClick={() => { setShowCreate(true); setSelected(null) }}
            style={{
              background: 'var(--forest)', color: 'var(--white)',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            + New Request
          </button>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All statuses</option>
            {STATUS_PIPELINE.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All areas</option>
            {BC_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Stats strip */}
        <div style={{
          padding: '10px 20px', borderBottom: '1px solid var(--fog)',
          display: 'flex', gap: 16, background: 'var(--cream)',
        }}>
          {[
            { label: 'Total',       count: requirements.length },
            { label: 'In progress', count: requirements.filter(r => ['submitted','in_review','quoted','approved','in_development'].includes(r.status)).length },
            { label: 'Complete',    count: requirements.filter(r => r.status === 'complete').length },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{s.count}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--slate)' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)' }}>
                {requirements.length === 0
                  ? 'No customisation requests yet. Click "+ New Request" to get started.'
                  : 'No requests match your filters.'}
              </p>
            </div>
          )}
          {filtered.map(req => {
            const prio    = priorityMeta(req.priority)
            const statusC = STATUS_COLOR[req.status] ?? STATUS_COLOR.draft
            const isActive = selected?.id === req.id
            const spec     = parsedSpec(req)
            return (
              <div
                key={req.id}
                onClick={() => setSelected(req)}
                style={{
                  background: isActive ? 'rgba(10,92,70,0.06)' : 'var(--white)',
                  border: `1px solid ${isActive ? 'rgba(10,92,70,0.25)' : 'var(--fog)'}`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 8, cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(10,92,70,0.2)' }}}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--fog)' }}}
              >
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, flex: 1, margin: 0 }}>
                    {req.title}
                  </p>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: prio.color,
                    background: prio.bg, border: `1px solid ${prio.border}`,
                    padding: '2px 7px', borderRadius: 6, flexShrink: 0,
                  }}>
                    {prio.label}
                  </span>
                </div>
                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: statusC.text, background: statusC.bg, border: `1px solid ${statusC.border}`,
                    padding: '2px 7px', borderRadius: 6,
                  }}>
                    {statusLabel(req.status)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)', letterSpacing: '0.06em' }}>
                    {req.bcArea}
                  </span>
                  {isSuperadmin && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(59,82,73,0.5)', marginLeft: 'auto' }}>
                      {req.tenant.name}
                    </span>
                  )}
                  {spec && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--jade)', letterSpacing: '0.08em' }}>
                      ✦ AI spec
                    </span>
                  )}
                  {req.quote && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--forest)', marginLeft: 'auto', fontWeight: 600 }}>
                      ${parseFloat(req.quote).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: detail / create panel ─────────────────────────────────────── */}
      {(selected || showCreate) && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--cream)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── CREATE FORM ─────────────────────────────────────────────────── */}
          {showCreate && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>
                  New Customisation Request
                </h2>
                <button onClick={() => setShowCreate(false)} style={closeBtn}>✕</button>
              </div>

              <div style={card}>
                <label style={labelStyle}>Title <span style={{ color: '#A32D2D' }}>*</span></label>
                <input
                  placeholder="e.g. Add approval workflow to purchase orders"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--fog)')}
                />
              </div>

              <div style={card}>
                <label style={labelStyle}>Describe what you need <span style={{ color: '#A32D2D' }}>*</span></label>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--slate)', marginBottom: 10, lineHeight: 1.5 }}>
                  Write in plain English — describe the business problem you're trying to solve, any current workarounds, and what success looks like. Our AI will convert this into a formal BC spec.
                </p>
                <textarea
                  placeholder="e.g. Right now our purchase orders go straight to the vendor without any internal approval. We need a two-level approval: line manager for orders under $5,000 and CFO for anything above. The approver should get an email with a link to approve or reject..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={6}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--fog)')}
                />
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ ...card, flex: 1 }}>
                  <label style={labelStyle}>BC Area</label>
                  <select value={form.bcArea} onChange={e => setForm(f => ({ ...f, bcArea: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {BC_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div style={{ ...card, flex: 1 }}>
                  <label style={labelStyle}>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {formError && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#A32D2D' }}>{formError}</p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={createRequirement}
                  disabled={saving}
                  style={{
                    background: 'var(--forest)', color: 'var(--white)',
                    border: 'none', borderRadius: 8, padding: '10px 22px',
                    cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save as Draft'}
                </button>
                <button onClick={() => setShowCreate(false)} style={secondaryBtn}>Cancel</button>
              </div>
            </>
          )}

          {/* ── DETAIL VIEW ─────────────────────────────────────────────────── */}
          {selected && !showCreate && (() => {
            const req    = selected
            const prio   = priorityMeta(req.priority)
            const statusC = STATUS_COLOR[req.status] ?? STATUS_COLOR.draft
            const spec   = parsedSpec(req)
            const stepIdx = STATUS_PIPELINE.findIndex(s => s.key === req.status)

            return (
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 10 }}>
                      {req.title}
                    </h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: statusC.text, background: statusC.bg, border: `1px solid ${statusC.border}`,
                        padding: '3px 10px', borderRadius: 20,
                      }}>{statusLabel(req.status)}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: prio.color, background: prio.bg, border: `1px solid ${prio.border}`,
                        padding: '3px 10px', borderRadius: 20,
                      }}>{prio.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)' }}>
                        {req.bcArea}
                      </span>
                      {isSuperadmin && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--jade)' }}>
                          {req.tenant.name} · {req.user.name ?? req.user.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={closeBtn}>✕</button>
                </div>

                {/* Status pipeline */}
                {req.status !== 'rejected' && (
                  <div style={card}>
                    <label style={labelStyle}>Progress</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
                      {STATUS_PIPELINE.map((s, i) => {
                        const done    = i < stepIdx
                        const current = i === stepIdx
                        return (
                          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_PIPELINE.length - 1 ? 1 : 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                background: done ? 'var(--jade)' : current ? 'var(--forest)' : 'var(--fog)',
                                border: current ? '3px solid var(--forest)' : 'none',
                                boxShadow: current ? '0 0 0 3px rgba(10,92,70,0.15)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {done && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
                              </div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.08em', textTransform: 'uppercase', color: current ? 'var(--forest)' : done ? 'var(--jade)' : 'var(--slate)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {s.label}
                              </span>
                            </div>
                            {i < STATUS_PIPELINE.length - 1 && (
                              <div style={{ flex: 1, height: 2, background: done ? 'var(--jade)' : 'var(--fog)', margin: '0 2px', marginBottom: 20 }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div style={card}>
                  <label style={labelStyle}>Description</label>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                    {req.description}
                  </p>
                </div>

                {/* Quote */}
                {req.quote && (
                  <div style={{ ...card, background: req.status === 'approved' ? 'rgba(10,92,70,0.05)' : 'var(--white)', borderColor: req.status === 'approved' ? 'rgba(10,92,70,0.2)' : 'var(--fog)' }}>
                    <label style={labelStyle}>Quote from BespoxAI</label>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: 'var(--forest)', lineHeight: 1 }}>
                        ${parseFloat(req.quote).toLocaleString()}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)' }}>NZD excl. GST</span>
                    </div>
                    {req.consultantNote && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)', marginTop: 10, lineHeight: 1.6, fontStyle: 'italic' }}>
                        {req.consultantNote}
                      </p>
                    )}
                    {req.quoteApprovedAt && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--jade)', marginTop: 8, letterSpacing: '0.08em' }}>
                        ✓ Approved {new Date(req.quoteApprovedAt).toLocaleDateString('en-NZ', { dateStyle: 'medium' })}
                      </p>
                    )}
                  </div>
                )}

                {/* AI Spec */}
                {spec ? (
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <label style={labelStyle}>AI-Generated Functional Spec</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: complexityBg(spec.complexity), color: complexityColor(spec.complexity), border: `1px solid ${complexityBorder(spec.complexity)}` }}>
                            {spec.complexity}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)', letterSpacing: '0.08em' }}>
                            Est. {spec.estimatedDays} day{spec.estimatedDays !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => generateSpec(req)}
                        disabled={generatingSpec}
                        style={{ ...secondaryBtn, fontSize: 11 }}
                      >
                        {generatingSpec ? 'Regenerating…' : '↺ Regenerate'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div style={specLabel}>User Story</div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, fontStyle: 'italic' }}>
                          {spec.userStory}
                        </p>
                      </div>
                      <div>
                        <div style={specLabel}>Acceptance Criteria</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {spec.acceptanceCriteria.map((c, i) => (
                            <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 4 }}>{c}</li>
                          ))}
                        </ul>
                      </div>
                      {spec.bcObjects.length > 0 && (
                        <div>
                          <div style={specLabel}>BC Objects Affected</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {spec.bcObjects.map((o, i) => (
                              <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--parchment)', border: '1px solid var(--fog)', borderRadius: 6, padding: '3px 9px', color: 'var(--slate)' }}>{o}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {spec.notes && (
                        <div>
                          <div style={specLabel}>Technical Notes</div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)', lineHeight: 1.65 }}>{spec.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ ...card, textAlign: 'center', padding: '24px 20px' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)', marginBottom: 14, lineHeight: 1.6 }}>
                      Generate an AI-powered BC functional specification from your description.
                      This will produce a user story, acceptance criteria, and estimated complexity.
                    </p>
                    {specError && <p style={{ color: '#A32D2D', fontSize: 12, marginBottom: 12 }}>{specError}</p>}
                    <button
                      onClick={() => generateSpec(req)}
                      disabled={generatingSpec}
                      style={{
                        background: generatingSpec ? 'var(--fog)' : 'var(--ink)', color: 'var(--cream)',
                        border: 'none', borderRadius: 8, padding: '9px 20px',
                        cursor: generatingSpec ? 'wait' : 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
                      }}
                    >
                      {generatingSpec ? '✦ Generating spec…' : '✦ Generate AI Spec'}
                    </button>
                  </div>
                )}

                {/* ── Action buttons ──────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

                  {/* User actions */}
                  {!isSuperadmin && req.status === 'draft' && (
                    <>
                      <button
                        onClick={() => patchRequirement(req.id, { status: 'submitted' })}
                        disabled={actionLoading}
                        style={primaryBtn}
                      >
                        Submit for Review →
                      </button>
                      <button onClick={() => deleteRequirement(req.id)} style={{ ...secondaryBtn, color: '#A32D2D' }}>
                        Delete Draft
                      </button>
                    </>
                  )}

                  {!isSuperadmin && req.status === 'quoted' && (
                    <button
                      onClick={() => patchRequirement(req.id, { status: 'approved' })}
                      disabled={actionLoading}
                      style={{ ...primaryBtn, background: '#0A5C46' }}
                    >
                      ✓ Approve Quote
                    </button>
                  )}

                  {/* Superadmin actions */}
                  {isSuperadmin && (
                    <>
                      {req.status === 'submitted' && (
                        <button onClick={() => patchRequirement(req.id, { status: 'in_review' })} disabled={actionLoading} style={primaryBtn}>
                          → Mark In Review
                        </button>
                      )}
                      {req.status === 'in_review' && (
                        <button onClick={() => setShowQuoteForm(true)} disabled={actionLoading} style={primaryBtn}>
                          $ Add Quote
                        </button>
                      )}
                      {req.status === 'approved' && (
                        <button onClick={() => patchRequirement(req.id, { status: 'in_development' })} disabled={actionLoading} style={primaryBtn}>
                          → Start Development
                        </button>
                      )}
                      {req.status === 'in_development' && (
                        <button onClick={() => patchRequirement(req.id, { status: 'complete' })} disabled={actionLoading} style={{ ...primaryBtn, background: '#0A5C46' }}>
                          ✓ Mark Complete
                        </button>
                      )}
                      {!['complete', 'rejected'].includes(req.status) && (
                        <button
                          onClick={() => patchRequirement(req.id, { status: 'rejected' })}
                          disabled={actionLoading}
                          style={{ ...secondaryBtn, color: '#A32D2D' }}
                        >
                          ✕ Reject
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Quote form (admin) */}
                {showQuoteForm && isSuperadmin && (
                  <div style={{ ...card, border: '1px solid rgba(10,92,70,0.25)', background: 'rgba(10,92,70,0.03)' }}>
                    <label style={labelStyle}>Add Quote</label>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--slate)', marginBottom: 5, textTransform: 'uppercase' }}>Amount (NZD)</div>
                        <input
                          type="number" placeholder="e.g. 2500"
                          value={quoteInput}
                          onChange={e => setQuoteInput(e.target.value)}
                          style={{ ...inputStyle, width: '100%' }}
                          onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--fog)')}
                        />
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--slate)', marginBottom: 5, textTransform: 'uppercase' }}>Note to customer (optional)</div>
                    <textarea
                      placeholder="e.g. This includes design, development, and testing. Deployment is a separate fixed fee of $500."
                      value={quoteNote}
                      onChange={e => setQuoteNote(e.target.value)}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', width: '100%', marginBottom: 12 }}
                      onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--fog)')}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={submitQuote} disabled={!quoteInput || actionLoading} style={primaryBtn}>
                        Send Quote →
                      </button>
                      <button onClick={() => setShowQuoteForm(false)} style={secondaryBtn}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)', letterSpacing: '0.08em' }}>
                  Created {new Date(req.createdAt).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })}
                  {req.updatedAt !== req.createdAt && ` · Updated ${new Date(req.updatedAt).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })}`}
                </p>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Style constants ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--white)', border: '1px solid var(--fog)',
  borderRadius: 10, padding: '16px 18px',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)',
  marginBottom: 8,
}

const specLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--cream)', border: '1px solid var(--fog)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13,
  fontFamily: 'var(--font-body)', color: 'var(--ink)', outline: 'none',
  boxSizing: 'border-box' as const,
}

const selectStyle: React.CSSProperties = {
  background: 'var(--white)', border: '1px solid var(--fog)',
  borderRadius: 8, padding: '7px 10px', fontSize: 12,
  fontFamily: 'var(--font-body)', color: 'var(--ink)', outline: 'none',
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--forest)', color: 'var(--white)',
  border: 'none', borderRadius: 8, padding: '9px 18px',
  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
}

const secondaryBtn: React.CSSProperties = {
  background: 'var(--fog)', color: 'var(--ink)',
  border: 'none', borderRadius: 8, padding: '9px 16px',
  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13,
}

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--slate)', fontSize: 18, padding: '4px 8px', lineHeight: 1,
}

function complexityBg(c: string) {
  return c === 'Simple' ? 'rgba(26,146,114,0.08)' : c === 'Medium' ? 'rgba(200,149,42,0.08)' : 'rgba(163,45,45,0.06)'
}
function complexityColor(c: string) {
  return c === 'Simple' ? '#0F6E56' : c === 'Medium' ? '#C8952A' : '#A32D2D'
}
function complexityBorder(c: string) {
  return c === 'Simple' ? 'rgba(26,146,114,0.25)' : c === 'Medium' ? 'rgba(200,149,42,0.25)' : 'rgba(163,45,45,0.2)'
}
