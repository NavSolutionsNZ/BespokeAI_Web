import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token    = (req as any).nextauth?.token
    const role     = token?.role as string | undefined
    const pathname = req.nextUrl.pathname

    const isAdminRoute    = pathname.startsWith('/admin')    || pathname.startsWith('/api/admin')
    const isSettingsRoute = pathname.startsWith('/settings') || pathname.startsWith('/api/settings')

    // /admin — superadmin only
    if (isAdminRoute && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // /settings — tenant_admin or superadmin
    if (isSettingsRoute && role !== 'tenant_admin' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized({ token, req }) {
        const pathname = req.nextUrl.pathname
        // Demo routes are public — no auth required
        if (pathname.startsWith('/demo') || pathname.startsWith('/api/demo')) return true
        return !!token?.tenantId
      },
    },
  },
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/demo/:path*',
    '/api/query',
    '/api/admin/:path*',
    '/api/settings/:path*',
    '/api/demo/:path*',
  ],
}
