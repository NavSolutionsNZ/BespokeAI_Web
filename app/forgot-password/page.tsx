'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit() {
    if (!email) return
    setLoading(true); setError('')
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative', overflow: 'hidden',
    }}>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.4, pointerEvents:'none' }}>
        <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--fog)" strokeWidth="0.5" />
        </pattern></defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{ position:'absolute', top:28, left:32 }}>
        <Link href="/login" style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--slate)', textDecoration:'none' }}>
          ← Back to sign in
        </Link>
      </div>

      <div style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'baseline', marginBottom:10 }}>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:500, fontSize:32, color:'var(--ink)', letterSpacing:'-0.3px' }}>Bespox</span>
            <span style={{ fontFamily:'var(--font-mono)', fontWeight:500, fontSize:24, color:'var(--forest)', letterSpacing:'0.04em', marginLeft:4 }}>AI</span>
          </div>
        </div>

        <div style={{ background:'var(--white)', border:'1px solid var(--fog)', borderRadius:16, padding:'36px 32px 32px', boxShadow:'0 4px 40px rgba(4,14,9,0.06)' }}>

          {submitted ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📬</div>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:300, color:'var(--ink)', marginBottom:12 }}>Check your inbox</h2>
              <p style={{ fontFamily:'var(--font-body)', fontSize:14, color:'var(--slate)', lineHeight:1.65, marginBottom:24 }}>
                If an account exists for <strong>{email}</strong>, we've sent a password reset link. It expires in 1 hour.
              </p>
              <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--slate)' }}>
                Didn't receive it? Check your spam folder, or{' '}
                <button onClick={() => setSubmitted(false)} style={{ background:'none', border:'none', color:'var(--forest)', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:500, padding:0 }}>
                  try again
                </button>.
              </p>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily:'var(--font-display)', fontWeight:300, fontSize:26, color:'var(--ink)', marginBottom:8, lineHeight:1.1 }}>
                Forgot your <em style={{ color:'var(--emerald)', fontStyle:'italic' }}>password?</em>
              </h1>
              <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--slate)', marginBottom:28, lineHeight:1.5 }}>
                Enter your email and we'll send you a reset link.
              </p>

              {error && (
                <div style={{ background:'rgba(163,45,45,0.06)', border:'1px solid rgba(163,45,45,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:20, fontFamily:'var(--font-body)', fontSize:13, color:'#A32D2D' }}>
                  {error}
                </div>
              )}

              <label style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:9, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--slate)', marginBottom:8 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
                placeholder="you@company.com"
                style={{ width:'100%', padding:'11px 14px', background:'var(--cream)', border:'1px solid var(--fog)', borderRadius:8, fontFamily:'var(--font-body)', fontSize:14, color:'var(--ink)', outline:'none', boxSizing:'border-box', marginBottom:24 }}
                onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--fog)')}
              />

              <button
                onClick={handleSubmit}
                disabled={loading || !email}
                style={{ width:'100%', padding:'13px', background: loading || !email ? 'var(--fog)' : 'var(--forest)', color: loading || !email ? 'var(--slate)' : 'var(--white)', border:'none', borderRadius:8, cursor: loading || !email ? 'not-allowed' : 'pointer', fontFamily:'var(--font-body)', fontSize:14, fontWeight:600, transition:'background 0.15s' }}
                onMouseEnter={e => { if (!loading && email) (e.currentTarget.style.background = 'var(--emerald)') }}
                onMouseLeave={e => { if (!loading && email) (e.currentTarget.style.background = 'var(--forest)') }}
              >
                {loading ? 'Sending…' : 'Send reset link →'}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontFamily:'var(--font-body)', fontSize:13, color:'var(--slate)' }}>
          Remembered it?{' '}
          <Link href="/login" style={{ color:'var(--forest)', textDecoration:'none', fontWeight:500 }}>Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
