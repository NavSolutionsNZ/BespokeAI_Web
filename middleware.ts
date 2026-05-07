import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token    = (req as any).nextauth?.token
    const role     = token?.role as string | undefined
    const pathname = req.nextUrl.pathname
    const isApi    = pathname.startsWith('/api/')

    const isAdminRoute    = pathname.startsWith('/admin')    || pathname.startsWith('/api/admin')
    const isSettingsRoute = pathname.startsWith('/settings') || pathname.startsWith('/api/settings')

    // /admin — superadmin only
    if (isAdminRoute && role !== 'superadmin') {
      if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // /settings — tenant_admin or superadmin
    if (isSettingsRoute && role !== 'tenant_admin' && role !== 'superadmin') {
      if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized({ token, req }) {
        const pathname = req.nextUrl.pathname
        // Public routes — no auth required
        if (
          pathname.startsWith('/demo')                     ||
          pathname.startsWith('/api/demo')                 ||
          pathname.startsWith('/signup')                   ||
          pathname.startsWith('/api/signup')               ||
          pathname.startsWith('/forgot-password')          ||
          pathname.startsWith('/reset-password')           ||
          pathname.startsWith('/api/auth/forgot-password') ||
          pathname.startsWith('/api/auth/reset-password')  ||
          pathname.startsWith('/api/webhooks/stripe')
        ) return true
        return !!token?.tenantId
      },
    },
  },
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/onboarding',
    '/admin',
    '/admin/:path*',
    '/settings/:path*',
    '/demo/:path*',
    '/signup/:path*',
    '/api/query',
    '/api/onboarding',
    '/api/admin/:path*',
    '/api/settings/:path*',
    '/api/demo/:path*',
    '/api/signup/:path*',
    '/api/signup',
    '/api/webhooks/stripe',
    '/billing/:path*',
    '/api/billing/:path*',
  ],
}
