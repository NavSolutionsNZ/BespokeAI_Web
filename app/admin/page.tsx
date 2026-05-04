'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string; name: string; tunnelSubdomain: string
  bcInstance: string; bcCompany: string; active: boolean
  createdAt: string
  _count: { users: number; queryLogs: number }
}

interface User {
  id: string; email: string; name: string; role: string
  tenantId: string; createdAt: string
  tenant: { name: string; active: boolean }
  _count: { queryLogs: number }
}

interface Stats {
  totalQueries: number; todayQueries: number
  tenants: any[]; topEntities: { entity: string; _count: { entity: number } }[]
}

type Tab = 'overview' | 'tenants' | 'users' | 'entities'

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [tab, setTab]           = useState<Tab>('overview')
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [users, setUsers]       = useState<User[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)

  // New tenant form
  const [showNewTenant, setShowNewTenant]         = useState(false)
  const [tenantForm, setTenantForm]               = useState({ name: '', tunnelSubdomain: '', bcInstance: 'GWM_Dev', bcCompany: 'GWM' })
  const [newTenantResult, setNewTenantResult]     = useState<{ apiKey: string; name: string } | null>(null)

  // New user form
  const [showNewUser, setShowNewUser]             = useState(false)
  const [userForm, setUserForm]                   = useState({ email: '', name: '', role: 'user', tenantId: '' })
  const [newUserResult, setNewUserResult]         = useState<{ email: string; tempPassword: string } | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Entity discovery state
  const [discoverTenantId, setDiscoverTenantId]   = useState('')
  const [discovering, setDiscovering]             = useState(false)
  const [discoveryResult, setDiscoveryResult]     = useState<any>(null)
  const [togglingEntity, setTogglingEntity]       = useState('')

  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/dashboard')
  }, [user, router])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/tenants').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/stats').then(r => r.json()),
    ]).then(([t, u, s]) => {
      setTenants(t.tenants ?? [])
      setUsers(u.users ?? [])
      setStats(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function toggleTenant(id: string, active: boolean) {
    await fetch(`/api/admin/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    setTenants(prev => prev.map(t => t.id === id ? { ...t, active: !active } : t))
  }

  async function discoverEntities(tenantId: string) {
    setDiscovering(true); setDiscoveryResult(null); setDiscoverTenantId(tenantId)
    const res  = await fetch(`/api/admin/discover/${tenantId}`)
    const data = await res.json()
    setDiscoveryResult(data)
    setDiscovering(false)
  }

  async function toggleEntity(tenantId: string, entity: string, enabled: boolean) {
    setTogglingEntity(entity)
    await fetch(`/api/admin/entities/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, enabled }),
    })
    if (discoveryResult) {
      setDiscoveryResult((prev: any) => ({
        ...prev,
        available: prev.available.map((e: any) =>
          e.name === entity ? { ...e, enabled } : e
        ),
      }))
    }
    setTogglingEntity('')
  }

  async function createTenant() {
    setSaving(true); setError('')
    const res  = await fetch('/api/admin/tenants', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenantForm),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setTenants(prev => [...prev, { ...data.tenant, _count: { users: 0, queryLogs: 0 } }])
    setNewTenantResult({ apiKey: data.apiKey, name: data.tenant.name })
    setTenantForm({ name: '', tunnelSubdomain: '', bcInstance: 'GWM_Dev', bcCompany: 'GWM' })
    setShowNewTenant(false)
    setSaving(false)
  }

  async function createUser() {
    setSaving(true); setError('')
    const res  = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    const tenant = tenants.find(t => t.id === userForm.tenantId)
    setUsers(prev => [...prev, { ...data.user, tenant: { name: tenant?.name ?? '', active: true }, _count: { queryLogs: 0 } }])
    setNewUserResult({ email: data.user.email, tempPassword: data.tempPassword })
    setUserForm({ email: '', name: '', role: 'user', tenantId: '' })
    setShowNewUser(false)
    setSaving(false)
  }

  const initials = (user?.name ?? 'A').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)', letterSpacing: '0.1em' }}>
      LOADING…
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: 'var(--ink)', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--cream)', letterSpacing: '-0.3px' }}>Bespox</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 17, color: 'var(--amber)', letterSpacing: '0.04em', marginLeft: 3 }}>AI</span>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(200,149,42,0.7)' }}>
            Admin Portal
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {([['overview', 'Overview'], ['tenants', 'Tenants'], ['users', 'Users'], ['entities', 'Entities']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8, marginBottom: 2, border: 'none',
              background: tab === id ? 'rgba(200,149,42,0.15)' : 'transparent',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
              onMouseEnter={e => { if (tab !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (tab !== id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: tab === id ? 600 : 400, color: tab === id ? 'var(--amber)' : 'rgba(214,217,212,0.7)', textAlign: 'left' }}>
                {label}
              </span>
              {id === 'tenants' && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(214,217,212,0.3)' }}>{tenants.length}</span>}
              {id === 'users'   && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(214,217,212,0.3)' }}>{users.length}</span>}
            </button>
          ))}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => router.push('/dashboard')} style={{
              width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(214,217,212,0.5)',
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(214,217,212,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(214,217,212,0.5)')}
            >
              ← CFO Assistant
            </button>
          </div>
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--amber), #8B6914)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--ink)', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(214,217,212,0.3)', fontSize: 14, padding: 4 }}>⎋</button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cream)' }}>
        <header style={{ padding: '0 32px', height: 60, flexShrink: 0, background: 'var(--white)', borderBottom: '1px solid var(--fog)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, color: 'var(--ink)' }}>
            {tab === 'overview' ? 'Overview' : tab === 'tenants' ? 'Tenants' : tab === 'users' ? 'Users' : 'Entities'}
          </h1>
          <div style={{ display: 'flex', gap: 10 }}>
            {tab === 'tenants' && (
              <button onClick={() => { setShowNewTenant(true); setError('') }} style={btnStyle}>
                + New Tenant
              </button>
            )}
            {tab === 'users' && (
              <button onClick={() => { setShowNewUser(true); setError('') }} style={btnStyle}>
                + Invite User
              </button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

          {/* ── Temp credential banners ──────────────────────────────────── */}
          {newTenantResult && (
            <CredentialBanner
              title={`Tenant "${newTenantResult.name}" created`}
              label="BCAgent API Key — copy now, not shown again:"
              value={newTenantResult.apiKey}
              onDismiss={() => setNewTenantResult(null)}
            />
          )}
          {newUserResult && (
            <CredentialBanner
              title={`User ${newUserResult.email} invited`}
              label="Temporary password — share with the user:"
              value={newUserResult.tempPassword}
              onDismiss={() => setNewUserResult(null)}
            />
          )}

          {/* ── Overview tab ─────────────────────────────────────────────── */}
          {tab === 'overview' && stats && (
            <div style={{ maxWidth: 800 }}>
              {/* KPI row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total queries', value: stats.totalQueries.toLocaleString() },
                  { label: 'Queries today', value: stats.todayQueries.toLocaleString() },
                  { label: 'Active tenants', value: stats.tenants.filter((t: any) => t.active).length.toString() },
                  { label: 'Total users', value: users.length.toString() },
                ].map((kpi, i) => (
                  <div key={i} style={{ flex: '1 1 150px', background: i === 0 ? 'var(--forest)' : 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: i === 0 ? 'rgba(214,217,212,0.5)' : 'var(--slate)', marginBottom: 6 }}>{kpi.label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: i === 0 ? 'var(--cream)' : 'var(--ink)', lineHeight: 1 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Per-tenant usage */}
              <SectionHead>Usage by tenant</SectionHead>
              <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fog)' }}>
                      {['Tenant', 'Status', 'Users', 'Queries', 'Last query'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.tenants.map((t: any) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--fog)' }}>
                        <td style={tdStyle}>{t.name}</td>
                        <td style={tdStyle}><StatusPill active={t.active} /></td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t._count.users}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t._count.queryLogs}</td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)' }}>
                          {t.queryLogs[0] ? new Date(t.queryLogs[0].createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top entities */}
              {stats.topEntities.length > 0 && (
                <>
                  <SectionHead style={{ marginTop: 28 }}>Most queried entities</SectionHead>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {stats.topEntities.map((e: any) => (
                      <div key={e.entity} style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--forest)' }}>{e.entity}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>{e._count.entity}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tenants tab ───────────────────────────────────────────────── */}
          {tab === 'tenants' && (
            <div style={{ maxWidth: 860 }}>
              {showNewTenant && (
                <FormCard title="New tenant" onCancel={() => setShowNewTenant(false)} onSave={createTenant} saving={saving} error={error}>
                  <FormRow label="Tenant name"><input style={inputStyle} value={tenantForm.name} onChange={e => setTenantForm(f => ({ ...f, name: e.target.value }))} placeholder="GWM Dealership" /></FormRow>
                  <FormRow label="Tunnel subdomain"><input style={inputStyle} value={tenantForm.tunnelSubdomain} onChange={e => setTenantForm(f => ({ ...f, tunnelSubdomain: e.target.value }))} placeholder="gwmdev" /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 4, display: 'block' }}>→ {tenantForm.tunnelSubdomain || 'subdomain'}-agent.bespoxai.com</span></FormRow>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <FormRow label="BC instance" style={{ flex: 1 }}><input style={inputStyle} value={tenantForm.bcInstance} onChange={e => setTenantForm(f => ({ ...f, bcInstance: e.target.value }))} /></FormRow>
                    <FormRow label="BC company" style={{ flex: 1 }}><input style={inputStyle} value={tenantForm.bcCompany} onChange={e => setTenantForm(f => ({ ...f, bcCompany: e.target.value }))} /></FormRow>
                  </div>
                </FormCard>
              )}

              <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fog)' }}>
                      {['Tenant', 'Subdomain', 'BC Instance', 'Users', 'Queries', 'Status', ''].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--fog)', opacity: t.active ? 1 : 0.5 }}>
                        <td style={tdStyle}><span style={{ fontWeight: 500 }}>{t.name}</span></td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{t.tunnelSubdomain}</td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{t.bcInstance}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t._count.users}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t._count.queryLogs}</td>
                        <td style={tdStyle}><StatusPill active={t.active} /></td>
                        <td style={tdStyle}>
                          <button onClick={() => toggleTenant(t.id, t.active)} style={{ ...ghostBtn, color: t.active ? '#A32D2D' : 'var(--forest)' }}>
                            {t.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Users tab ─────────────────────────────────────────────────── */}
          {tab === 'users' && (
            <div style={{ maxWidth: 860 }}>
              {showNewUser && (
                <FormCard title="Invite user" onCancel={() => setShowNewUser(false)} onSave={createUser} saving={saving} error={error}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <FormRow label="Email" style={{ flex: 1 }}><input style={inputStyle} type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="user@company.com" /></FormRow>
                    <FormRow label="Name" style={{ flex: 1 }}><input style={inputStyle} value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></FormRow>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <FormRow label="Tenant" style={{ flex: 2 }}>
                      <select style={inputStyle} value={userForm.tenantId} onChange={e => setUserForm(f => ({ ...f, tenantId: e.target.value }))}>
                        <option value="">Select tenant…</option>
                        {tenants.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </FormRow>
                    <FormRow label="Role" style={{ flex: 1 }}>
                      <select style={inputStyle} value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </FormRow>
                  </div>
                </FormCard>
              )}

              <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fog)' }}>
                      {['User', 'Email', 'Tenant', 'Role', 'Queries', 'Joined'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--fog)' }}>
                        <td style={tdStyle}><span style={{ fontWeight: 500 }}>{u.name || '—'}</span></td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{u.email}</td>
                        <td style={tdStyle}>{u.tenant.name}</td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: u.role === 'admin' ? 'rgba(200,149,42,0.12)' : 'rgba(26,146,114,0.08)', color: u.role === 'admin' ? 'var(--amber)' : 'var(--forest)', border: `1px solid ${u.role === 'admin' ? 'rgba(200,149,42,0.3)' : 'rgba(26,146,114,0.2)'}` }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{u._count.queryLogs}</td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)' }}>
                          {new Date(u.createdAt).toLocaleDateString([], { dateStyle: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        {/* ── Entities tab ──────────────────────────────────────────────── */}
          {tab === 'entities' && (
            <div style={{ maxWidth: 860 }}>
              {/* Tenant selector */}
              <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 8 }}>Select tenant to scan</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <select style={{ ...inputStyle, flex: 1 }} value={discoverTenantId} onChange={e => setDiscoverTenantId(e.target.value)}>
                    <option value="">Choose a tenant…</option>
                    {tenants.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={() => discoverTenantId && discoverEntities(discoverTenantId)} disabled={!discoverTenantId || discovering} style={{ ...btnStyle, flexShrink: 0, opacity: (!discoverTenantId || discovering) ? 0.6 : 1 }}>
                    {discovering ? 'Scanning…' : 'Scan BC'}
                  </button>
                </div>
                {discoveryResult?.fetchError && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#A32D2D', marginTop: 10 }}>⚠ Could not reach BCAgent: {discoveryResult.fetchError}</p>
                )}
              </div>

              {discoveryResult && !discoveryResult.fetchError && (
                <>
                  {/* Summary */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Available in BC', value: discoveryResult.available?.length ?? 0, color: 'var(--forest)' },
                      { label: 'Missing from BC', value: discoveryResult.missing?.length ?? 0, color: 'var(--amber)' },
                      { label: 'Uncatalogued', value: discoveryResult.uncatalogued?.length ?? 0, color: 'var(--slate)' },
                      { label: 'Total in BC', value: discoveryResult.totalInBC ?? 0, color: 'var(--ink)' },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: '1 1 120px', background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Available entities — toggleable */}
                  {discoveryResult.available?.length > 0 && (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 10 }}>Available in this BC — toggle to enable/disable for AI planner</div>
                      <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead><tr style={{ borderBottom: '1px solid var(--fog)' }}>
                            {['Entity', 'Description', 'Enabled'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {discoveryResult.available.map((e: any) => (
                              <tr key={e.name} style={{ borderBottom: '1px solid var(--fog)', opacity: e.enabled ? 1 : 0.55 }}>
                                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500 }}>{e.name}</td>
                                <td style={{ ...tdStyle, fontSize: 12, color: 'var(--slate)', maxWidth: 360 }}>{e.description.split('—')[0].trim()}</td>
                                <td style={tdStyle}>
                                  <button
                                    disabled={togglingEntity === e.name}
                                    onClick={() => toggleEntity(discoverTenantId, e.name, !e.enabled)}
                                    style={{ ...ghostBtn, color: e.enabled ? 'var(--forest)' : 'var(--slate)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                                  >
                                    {togglingEntity === e.name ? '…' : e.enabled ? '● On' : '○ Off'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Uncatalogued entities */}
                  {discoveryResult.uncatalogued?.length > 0 && (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 10 }}>Published in BC but not yet in BespoxAI catalogue</div>
                      <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead><tr style={{ borderBottom: '1px solid var(--fog)' }}>
                            {['Entity name', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {discoveryResult.uncatalogued.map((e: any) => (
                              <tr key={e.name} style={{ borderBottom: '1px solid var(--fog)' }}>
                                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{e.name}</td>
                                <td style={{ ...tdStyle, fontSize: 12, color: 'var(--slate)' }}>Use /api/bc-test?entity={e.name} to inspect fields</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Missing entities */}
                  {discoveryResult.missing?.length > 0 && (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 10 }}>In BespoxAI catalogue but not published in this BC</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {discoveryResult.missing.map((e: any) => (
                          <span key={e.name} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', borderRadius: 6, background: 'rgba(163,45,45,0.06)', border: '1px solid rgba(163,45,45,0.15)', color: '#A32D2D' }}>{e.name}</span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  background: 'var(--forest)', color: 'var(--white)', border: 'none',
  borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
}

const ghostBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
  padding: '4px 8px',
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left',
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--slate)',
  background: 'var(--parchment)', fontWeight: 400,
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px', color: 'var(--ink)',
  borderBottom: '1px solid var(--fog)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--cream)', border: '1px solid var(--fog)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-body)',
  color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '2px 8px', borderRadius: 8,
      background: active ? 'rgba(26,146,114,0.08)' : 'rgba(163,45,45,0.06)',
      color: active ? 'var(--forest)' : '#A32D2D',
      border: `1px solid ${active ? 'rgba(26,146,114,0.2)' : 'rgba(163,45,45,0.2)'}`,
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function SectionHead({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 12, ...style }}>
      {children}
    </div>
  )
}

function FormRow({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--slate)' }}>{label}</label>
      {children}
    </div>
  )
}

function FormCard({ title, children, onCancel, onSave, saving, error }: { title: string; children: React.ReactNode; onCancel: () => void; onSave: () => void; saving: boolean; error: string }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--fog)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--ink)', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
      {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#A32D2D', marginTop: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onSave} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Create'}</button>
        <button onClick={onCancel} style={{ ...btnStyle, background: 'var(--fog)', color: 'var(--ink)' }}>Cancel</button>
      </div>
    </div>
  )
}

function CredentialBanner({ title, label, value, onDismiss }: { title: string; label: string; value: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ background: 'rgba(200,149,42,0.08)', border: '1px solid rgba(200,149,42,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{title}</span>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)', fontSize: 16, lineHeight: 1 }}>✕</button>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <code style={{ flex: 1, background: 'var(--parchment)', padding: '8px 12px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', wordBreak: 'break-all' }}>{value}</code>
        <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ ...btnStyle, flexShrink: 0, fontSize: 12 }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
