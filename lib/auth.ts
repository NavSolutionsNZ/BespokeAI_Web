import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

export const authOptions: NextAuthOptions = {
  // We use JWT sessions — no DB session rows needed
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { tenant: { select: { id: true, name: true, active: true } } },
        })

        if (!user || !user.tenant.active) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, `user` is populated — stamp tenant into token
      if (user) {
        token.tenantId = (user as any).tenantId
        token.tenantName = (user as any).tenantName
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).tenantId = token.tenantId
        ;(session.user as any).tenantName = token.tenantName
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
}
