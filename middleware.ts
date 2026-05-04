import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = (req as any).nextauth?.token
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin') ||
                         req.nextUrl.pathname.startsWith('/api/admin')
    if (isAdminRoute && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized({ token }) {
        return !!token?.tenantId
      },
    },
  },
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/query',
    '/api/admin/:path*',
  ],
}
