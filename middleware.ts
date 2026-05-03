import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Could add role-based guards here if needed
    return NextResponse.next()
  },
  {
    pages: {
      signIn: '/login',
    },
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
    '/api/query',
    // Add more protected routes here
  ],
}
