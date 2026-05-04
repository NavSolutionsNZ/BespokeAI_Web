'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string; name: string; tunnelSubdomain: string; bcInstance: string
  bcCompany: string; active: boolean; country: string; entityConfig: any
  tunnelId: string | null; createdAt: string
}

interface TenantUser {
  id: string; name: string | null; email: string; role: string
  active: boolean; createdAt: string
}

type Tab = 'overview' | 'users' | 'entities' | 'installer'

const COUNTRY_OPTIONS = [
  { code: 'NZ', label: 'New Zealand' }, { code: 'AU', label: 'Australia' },
  { code: 'GB', label: 'United Kingdom' }, { code: 'US', label: 'United States' },
  { code: 'SG', label: 'Singapore' }, { code: 'MY', label: 'Malaysia' },
  { code: 'ID', label: 'Indonesia' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RoleBadge({ role }: { role: string }) {
  const colours: Record<string, { bg: string; color: string; border: string }> = {
    superadmin:   { bg: 'rgba(200,149,42,0.12)', color: 'var(--amber)',  border: 'rgba(200,149,42,0.3)' },
    tenant_admin: { bg: 'rgba(10,92,70,0.10)',   color: 'var(--forest)', border: 'rgba(10,92,70,0.3)' },
    user:         { bg: 'rgba(59,82,73,0.08)',   color: 'var(--slate)',  border: 'rgba(59,82,73,0.2)' },
  }
  const c = colours[role] ?? colours.user
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
      textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6,
      background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {role.replace('_', ' ')}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tab,        setTab]        = useState<Tab>('overview')
  const [tenant,     setTenant]     = useState<Tenant | null>(null)
  const [users,      setUsers]      = useState<TenantUser[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

  // Overview state
  const [country,    setCountry]    = useState('')
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [latencyMs,  setLatencyMs]  = useState<number | null>(null)

  // Installer state
  const [instForm,   setInstForm]   = useState({ bcUsername: '', bcPassword: '', bcPort: '8048', agentPort: '8080' })
  const [instLoading, setInstLoading] = useState(false)

  // Invite state
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'user' })
  const [inviteResult, setInviteResult] = useState<{ tempPassword: string; email: string } | null>(null)

  // Reset password result
  const [resetResult, setResetResult] = useState<{ id: string; tempPassword: string } | null>(null)

  // Entity toggles
  const [entityConfig, setEntityConfig] = useState<Record<string, boolean>>({})
  const [entitySaving, setEntitySaving] = useState(false)

  const role = (session?.user as any)?.role as string

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (role !== 'tenant_admin' && role !== 'superadmin') { router.push('/dashboard'); return }
  }, [status, session, role])

  // ── Load tenant + users ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/settings/users').then(r => r.json()),
    ]).then(([td, ud]) => {
      setTenant(td.tenant ?? null)
      setCountry(td.tenant?.country ?? 'NZ')
      setEntityConfig(td.tenant?.entityConfig ?? {})
      setUsers(ud.users ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [session])

  // ── Health check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const check = async () => {
      const t0 = Date.now()
      try {
        const r = await fetch('/api/health')
        const d = await r.json()
        setLatencyMs(Date.now() - t0)
        setHealthStatus(d.ok ? 'ok' : 'error')
      } catch { setHealthStatus('error') }
    }
    check()
    const iv = setInterval(check, 60000)
    return () => clearInterval(iv)
  }, [session])

  // ── Save country ────────────────────────────────────────────────────────────
  async function saveCountry() {
    setSaving(true)
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country }) })
    setSaving(false)
    showToast(r.ok ? 'Country updated' : 'Failed to update', r.ok)
  }

  // ── Save entity config ──────────────────────────────────────────────────────
  async function saveEntities() {
    setEntitySaving(true)
    const r = await fetch('/api/settings/entities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityConfig }) })
    setEntitySaving(false)
    showToast(r.ok ? 'Entity configuration saved' : 'Failed to save', r.ok)
  }

  // ── Invite user ─────────────────────────────────────────────────────────────
  async function inviteUser() {
    if (!inviteForm.email) return
    const r = await fetch('/api/settings/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteForm.email, name: inviteForm.name, userRole: inviteForm.role }) })
    const d = await r.json()
    if (r.ok) {
      setInviteResult({ tempPassword: d.tempPassword, email: d.user.email })
      setUsers(prev => [...prev, d.user])
      setInviteForm({ email: '', name: '', role: 'user' })
      showToast('User invited')
    } else {
      showToast(d.error ?? 'Failed to invite user', false)
    }
  }

  // ── User actions ─────────────────────────────────────────────────────────────
  async function userAction(id: string, action: 'disable' | 'enable' | 'reset') {
    const r = await fetch(`/api/settings/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    const d = await r.json()
    if (r.ok) {
      if (action === 'reset') setResetResult({ id, tempPassword: d.tempPassword })
      setUsers(prev => prev.map(u => u.id !== id ? u : { ...u, active: action === 'enable' ? true : action === 'disable' ? false : u.active }))
      showToast(action === 'reset' ? 'Password reset' : `User ${action}d`)
    } else showToast(d.error ?? 'Action failed', false)
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    const r = await fetch(`/api/settings/users/${id}`, { method: 'DELETE' })
    if (r.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      showToast('User deleted')
    } else showToast('Failed to delete', false)
  }

  // ── Download installer ──────────────────────────────────────────────────────
  async function downloadInstaller() {
    if (!instForm.bcUsername || !instForm.bcPassword) { showToast('BC username and password required', false); return }
    setInstLoading(true)
    try {
      const r = await fetch('/api/settings/installer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(instForm) })
      if (!r.ok) { showToast('Installer generation failed', false); setInstLoading(false); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'BespoxAI-Installer.zip'; a.click()
      URL.revokeObjectURL(url)
    } catch { showToast('Download failed', false) }
    setInstLoading(false)
  }

  if (loading || status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--slate)', textTransform: 'uppercase' }}>Loading…</div>
      </div>
    )
  }

  const selfId = (session?.user as any)?.id

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, background: toast.ok ? 'var(--forest)' : '#A32D2D', color: '#fff', padding: '10px 18px', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', transition: 'opacity 0.3s' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--fog)', padding: '0 32px', display: 'flex', alignItems: 'center', gap: 20, height: 56, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--forest)', fontWeight: 600 }}>BespoxAI</span>
        <span style={{ color: 'var(--fog)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)' }}>{tenant?.name}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* BC health badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: healthStatus === 'ok' ? 'rgba(26,146,114,0.1)' : healthStatus === 'error' ? 'rgba(163,45,45,0.1)' : 'rgba(59,82,73,0.08)', border: `1px solid ${healthStatus === 'ok' ? 'rgba(26,146,114,0.3)' : healthStatus === 'error' ? 'rgba(163,45,45,0.25)' : 'var(--fog)'}` }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: healthStatus === 'ok' ? 'var(--jade)' : healthStatus === 'error' ? '#A32D2D' : 'var(--fog)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: healthStatus === 'ok' ? 'var(--jade)' : healthStatus === 'error' ? '#A32D2D' : 'var(--slate)' }}>
              {healthStatus === 'ok' ? `BC Connected${latencyMs ? ` · ${latencyMs}ms` : ''}` : healthStatus === 'error' ? 'Agent Offline' : 'Checking…'}
            </span>
          </div>
          <button onClick={() => router.push('/dashboard')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)', background: 'none', border: 'none', cursor: 'pointer' }}>← Dashboard</button>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)', background: 'none', border: '1px solid var(--fog)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', maxWidth: 1100, margin: '0 auto', width: '100%', padding: '40px 24px', gap: 32, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--ink)', marginBottom: 4 }}>Settings</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)', marginBottom: 28 }}>Manage your workspace</div>
          {([ ['overview', '⚙️', 'Overview'], ['users', '👥', 'Users'], ['entities', '📊', 'Data Entities'], ['installer', '⬇️', 'BC Installer'] ] as [Tab, string, string][]).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', borderRadius: 10, marginBottom: 2, background: tab === id ? 'var(--white)' : 'none', border: tab === id ? '1px solid var(--fog)' : '1px solid transparent', cursor: 'pointer', textAlign: 'left', boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}>
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: tab === id ? 'var(--forest)' : 'var(--slate)', fontWeight: tab === id ? 500 : 400 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', marginBottom: 24, fontWeight: 400 }}>Overview</div>

              {/* Connection info card */}
              <div style={{ background: 'var(--white)', borderRadius: 14, padding: '24px 28px', border: '1px solid var(--fog)', marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 16 }}>BC Connection</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                  {[
                    ['Tenant Name',   tenant?.name],
                    ['BC Instance',   tenant?.bcInstance],
                    ['BC Company',    tenant?.bcCompany],
                    ['Agent URL',     `https://${tenant?.tunnelSubdomain}-agent.bespoxai.com`],
                    ['Status',        healthStatus === 'ok' ? `Connected (${latencyMs}ms)` : healthStatus === 'error' ? 'Offline' : 'Checking…'],
                    ['Member Since',  tenant ? relativeTime(tenant.createdAt) : '—'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)' }}>{val ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Country setting */}
              <div style={{ background: 'var(--white)', borderRadius: 14, padding: '24px 28px', border: '1px solid var(--fog)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 16 }}>CFO Context Country</div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)', marginBottom: 16, lineHeight: 1.6 }}>
                  Sets the tax, accounting, and compliance context for AI responses (GST, VAT, local reporting standards).
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select value={country} onChange={e => setCountry(e.target.value)}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', background: 'var(--cream)', border: '1px solid var(--fog)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', outline: 'none' }}>
                    {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <button onClick={saveCountry} disabled={saving}
                    style={{ background: 'var(--forest)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', marginBottom: 24, fontWeight: 400 }}>Users</div>

              {/* Invite form */}
              <div style={{ background: 'var(--white)', borderRadius: 14, padding: '24px 28px', border: '1px solid var(--fog)', marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 16 }}>Invite User</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {[['Email', 'email', 'email'], ['Name (optional)', 'name', 'text']].map(([label, field, type]) => (
                    <div key={field}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 4 }}>{label}</div>
                      <input type={type} value={(inviteForm as any)[field]} onChange={e => setInviteForm(f => ({ ...f, [field]: e.target.value }))}
                        style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', background: 'var(--cream)', border: '1px solid var(--fog)', borderRadius: 8, padding: '7px 12px', outline: 'none', width: 200 }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 4 }}>Role</div>
                    <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                      style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', background: 'var(--cream)', border: '1px solid var(--fog)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', outline: 'none' }}>
                      <option value="user">User</option>
                      <option value="tenant_admin">Tenant Admin</option>
                    </select>
                  </div>
                  <button onClick={inviteUser}
                    style={{ background: 'var(--forest)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                    Invite
                  </button>
                </div>

                {inviteResult && (
                  <div style={{ marginTop: 14, background: 'rgba(26,146,114,0.08)', border: '1px solid rgba(26,146,114,0.25)', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--jade)', marginBottom: 6 }}>User created — share these credentials</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)' }}>
                      Email: <strong>{inviteResult.email}</strong> · Temp password: <strong style={{ fontFamily: 'var(--font-mono)' }}>{inviteResult.tempPassword}</strong>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>This password is shown once — copy it now.</div>
                    <button onClick={() => setInviteResult(null)} style={{ marginTop: 8, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--slate)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
                  </div>
                )}
              </div>

              {/* Reset password result */}
              {resetResult && (
                <div style={{ background: 'rgba(200,149,42,0.08)', border: '1px solid rgba(200,149,42,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 6 }}>Password reset — shown once</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)' }}>
                    New temp password: <strong style={{ fontFamily: 'var(--font-mono)' }}>{resetResult.tempPassword}</strong>
                  </div>
                  <button onClick={() => setResetResult(null)} style={{ marginTop: 6, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--slate)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
                </div>
              )}

              {/* Users table */}
              <div style={{ background: 'var(--white)', borderRadius: 14, border: '1px solid var(--fog)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--parchment)' }}>
                      {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderTop: '1px solid var(--fog)' }}>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)' }}>{u.name || '—'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)' }}>{u.email}</td>
                        <td style={{ padding: '11px 16px' }}><RoleBadge role={u.role} /></td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: u.active ? 'rgba(26,146,114,0.1)' : 'rgba(163,45,45,0.1)', color: u.active ? 'var(--jade)' : '#A32D2D', border: `1px solid ${u.active ? 'rgba(26,146,114,0.25)' : 'rgba(163,45,45,0.2)'}` }}>
                            {u.active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--slate)' }}>{relativeTime(u.createdAt)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          {u.id !== selfId && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => userAction(u.id, u.active ? 'disable' : 'enable')}
                                style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: u.active ? '#A32D2D' : 'var(--jade)', background: 'none', border: `1px solid ${u.active ? 'rgba(163,45,45,0.3)' : 'rgba(26,146,114,0.3)'}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                                {u.active ? 'Disable' : 'Enable'}
                              </button>
                              <button onClick={() => userAction(u.id, 'reset')}
                                style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--slate)', background: 'none', border: '1px solid var(--fog)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                                Reset pw
                              </button>
                              <button onClick={() => deleteUser(u.id)}
                                style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', padding: '3px 4px', cursor: 'pointer' }}>
                                ✕
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Entities ── */}
          {tab === 'entities' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', fontWeight: 400 }}>Data Entities</div>
                <button onClick={saveEntities} disabled={entitySaving}
                  style={{ background: 'var(--forest)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, opacity: entitySaving ? 0.6 : 1 }}>
                  {entitySaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)', marginBottom: 20, lineHeight: 1.6 }}>
                Enable or disable which Business Central entities the AI assistant can query. Disabled entities are hidden from the planner.
              </p>
              <div style={{ background: 'var(--white)', borderRadius: 14, border: '1px solid var(--fog)', overflow: 'hidden' }}>
                {Object.keys(entityConfig).length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)' }}>
                    No entity configuration found. Ask your administrator to run entity discovery.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--parchment)' }}>
                        {['Entity', 'Enabled'].map(h => (
                          <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(entityConfig).sort(([a], [b]) => a.localeCompare(b)).map(([entity, enabled]) => (
                        <tr key={entity} style={{ borderTop: '1px solid var(--fog)' }}>
                          <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{entity}</td>
                          <td style={{ padding: '10px 20px' }}>
                            <button onClick={() => setEntityConfig(c => ({ ...c, [entity]: !enabled }))}
                              style={{ width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: enabled ? 'var(--jade)' : 'var(--fog)', position: 'relative', transition: 'background 0.2s' }}>
                              <div style={{ position: 'absolute', top: 3, left: enabled ? 18 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Installer ── */}
          {tab === 'installer' && (
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, fontWeight: 400 }}>BC Agent Installer</div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--slate)', marginBottom: 24, lineHeight: 1.6 }}>
                Download a pre-configured installer for the BespoxAI BCAgent. Run it on the Windows Server hosting Business Central. It will install the agent, configure the Cloudflare tunnel, and start the service automatically.
              </p>
              <div style={{ background: 'var(--white)', borderRadius: 14, padding: '28px', border: '1px solid var(--fog)', maxWidth: 520 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 20 }}>BC Credentials</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    ['BC Username', 'bcUsername', 'text',     'DOMAIN\\username'],
                    ['BC Password', 'bcPassword', 'password', ''],
                    ['BC OData Port', 'bcPort',   'text',     '8048'],
                    ['Agent Port',   'agentPort', 'text',     '8080'],
                  ].map(([label, field, type, placeholder]) => (
                    <div key={field}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 5 }}>{label}</div>
                      <input type={type} placeholder={placeholder} value={(instForm as any)[field]}
                        onChange={e => setInstForm(f => ({ ...f, [field]: e.target.value }))}
                        style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', background: 'var(--cream)', border: '1px solid var(--fog)', borderRadius: 8, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <button onClick={downloadInstaller} disabled={instLoading}
                  style={{ marginTop: 20, width: '100%', background: 'var(--forest)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, opacity: instLoading ? 0.7 : 1 }}>
                  {instLoading ? 'Generating…' : '⬇ Download Installer (.zip)'}
                </button>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--slate)', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>
                  Credentials are embedded in the installer and not stored by BespoxAI.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
