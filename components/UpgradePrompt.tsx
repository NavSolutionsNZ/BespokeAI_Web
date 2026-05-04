'use client'

import { Lock, ArrowRight } from 'lucide-react'

interface Props {
  reason: 'trial_expired' | 'unknown' | string
  trialEndsAt?: string | null
}

export function UpgradePrompt({ reason, trialEndsAt }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 px-8 text-center">
      <div
        className="rounded-2xl p-10 max-w-md w-full shadow-xl"
        style={{
          background: '#0c1610',
          border: '1px solid rgba(200, 149, 42, 0.25)',
        }}
      >
        {/* Icon */}
        <div
          className="flex items-center justify-center w-14 h-14 rounded-full mx-auto mb-6"
          style={{
            background: 'rgba(200, 149, 42, 0.08)',
            border: '1px solid rgba(200, 149, 42, 0.2)',
          }}
        >
          <Lock size={22} style={{ color: '#C8952A' }} />
        </div>

        {/* Heading */}
        <h2
          className="text-2xl font-semibold mb-2"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: '#F4EFE4' }}
        >
          {reason === 'trial_expired' ? 'Your trial has ended' : 'Access restricted'}
        </h2>

        {reason === 'trial_expired' && trialEndsAt && (
          <p className="text-sm mb-1" style={{ color: '#8a9a8e' }}>
            Trial expired{' '}
            {new Date(trialEndsAt).toLocaleDateString('en-NZ', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}

        <p className="text-sm mt-2 mb-8" style={{ color: '#8a9a8e' }}>
          Upgrade to a paid plan to continue using the BespoxAI CFO Assistant
          and all connected Business Central data.
        </p>

        {/* CTA */}
        <a
          href="mailto:hello@bespox.com?subject=BespoxAI%20Upgrade%20Request"
          className="inline-flex items-center justify-center gap-2 w-full font-semibold px-6 py-3 rounded-lg transition-colors"
          style={{
            background: '#C8952A',
            color: '#040E09',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#d9a63b')}
          onMouseLeave={e => (e.currentTarget.style.background = '#C8952A')}
        >
          Contact us to upgrade <ArrowRight size={16} />
        </a>

        <p className="text-xs mt-4" style={{ color: '#4a5a4e' }}>
          Or email{' '}
          <span style={{ color: '#8a9a8e' }}>hello@bespox.com</span>
        </p>
      </div>
    </div>
  )
}
