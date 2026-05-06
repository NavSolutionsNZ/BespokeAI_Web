'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token  = searchParams.get('token')  ?? ''
  const email  = searchParams.get('email')  ?? ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)

  if (!token || !email) {
    return (
      <div style={{ textAlign:'center', padding:'60px 24px' }}>
        <p style={{ fontFamily:'var(--font-body)', color:'#A32D2D', fontSize:14 }}>Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" style={{ color:'var(--forest)', fontFamily:'var(--font-body)', fontSize:13, marginTop:12, display:'inline-block' }}>Request new link →</Link>
      </div>
    )
  }

  async function handleSubmit() {
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background:'var(--white)', border:'1px solid var(--fog)', borderRadius:16, padding:'36px 32px 32px', boxShadow:'0 4px 40px rgba(4,14,9,0.06)' }}>
      {success ? (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:300, color:'var(--ink)', marginBottom:12 }}>Password updated</h2>
          <p style={{ fontFamily:'var(--font-body)', fontSize:14, color:'var(--slate)', lineHeight:1.65 }}>
            Your password has been reset. Redirecting you to sign in…
          </p>
        </div>
      ) : (
        <>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:300, fontSize:26, color:'var(--ink)', marginBottom:8, lineHeight:1.1 }}>
            Choose a new <em style={{ color:'var(--emerald)', fontStyle:'italic' }}>password</em>
          </h1>
          <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--slate)', marginBottom:28, lineHeight:1.5 }}>
            For <strong>{email}</strong>. Minimum 8 characters.
          </p>

          {error && (
            <div style={{ background:'rgba(163,45,45,0.06)', border:'1px solid rgba(163,45,45,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:20, fontFamily:'var(--font-body)', fontSize:13, color:'#A32D2D' }}>
              {error}
            </div>
          )}

          {[
            { label:'New password',     value:password, set:setPassword },
            { label:'Confirm password', value:confirm,  set:setConfirm  },
          ].map(({ label, value, set }) => (
            <div key={label} style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:9, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--slate)', marginBottom:8 }}>
                {label}
              </label>
              <input
                type="password"
                value={value}
                onChange={e => set(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••"
                style={{ width:'100%', padding:'11px 14px', background:'var(--cream)', border:'1px solid var(--fog)', borderRadius:8, fontFamily:'var(--font-body)', fontSize:14, color:'var(--ink)', outline:'none', boxSizing:'border-box' }}
                onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--fog)')}
              />
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={loading || !password || !confirm}
            style={{ width:'100%', marginTop:12, padding:'13px', background: loading || !password || !confirm ? 'var(--fog)' : 'var(--forest)', color: loading || !password || !confirm ? 'var(--slate)' : 'var(--white)', border:'none', borderRadius:8, cursor: loading || !password || !confirm ? 'not-allowed' : 'pointer', fontFamily:'var(--font-body)', fontSize:14, fontWeight:600, transition:'background 0.15s' }}
            onMouseEnter={e => { if (!loading && password && confirm) (e.currentTarget.style.background = 'var(--emerald)') }}
            onMouseLeave={e => { if (!loading && password && confirm) (e.currentTarget.style.background = 'var(--forest)') }}
          >
            {loading ? 'Updating…' : 'Set new password →'}
          </button>
        </>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--cream)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative', overflow:'hidden' }}>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.4, pointerEvents:'none' }}>
        <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--fog)" strokeWidth="0.5" />
        </pattern></defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'baseline', marginBottom:10 }}>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:500, fontSize:32, color:'var(--ink)', letterSpacing:'-0.3px' }}>Bespox</span>
            <span style={{ fontFamily:'var(--font-mono)', fontWeight:500, fontSize:24, color:'var(--forest)', letterSpacing:'0.04em', marginLeft:4 }}>AI</span>
          </div>
        </div>
        <Suspense fallback={<div style={{ background:'var(--white)', borderRadius:16, padding:'48px', border:'1px solid var(--fog)' }} />}>
          <ResetPasswordForm />
        </Suspense>
        <p style={{ textAlign:'center', marginTop:20, fontFamily:'var(--font-body)', fontSize:13, color:'var(--slate)' }}>
          <Link href="/login" style={{ color:'var(--forest)', textDecoration:'none', fontWeight:500 }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
