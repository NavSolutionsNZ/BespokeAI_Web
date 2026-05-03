/**
 * Create a tenant + admin user. Run once after schema migration:
 *   npx ts-node scripts/create-tenant.ts
 *
 * Or with tsx:
 *   npx tsx scripts/create-tenant.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  // ── Edit these values ──────────────────────────────────────────────────────
  const TENANT_NAME       = 'GWM Dev'
  const TUNNEL_SUBDOMAIN  = 'gwmdev'           // → gwmdev-agent.bespoxai.com
  const BC_INSTANCE       = 'GWM_Dev'
  const BC_COMPANY        = 'GWM'
  const AGENT_API_KEY     = 'Xh11SG474IAy/zmNHSKCj4eRmphOSekSjAFaj1j/ccA='  // from agent.config.json

  const ADMIN_EMAIL       = 'admin@gwm.co.nz'  // ← change this
  const ADMIN_PASSWORD    = 'ChangeMe123!'       // ← change this
  const ADMIN_NAME        = 'GWM Admin'
  // ──────────────────────────────────────────────────────────────────────────

  console.log(`Creating tenant: ${TENANT_NAME} (${TUNNEL_SUBDOMAIN})...`)

  const tenant = await prisma.tenant.upsert({
    where: { tunnelSubdomain: TUNNEL_SUBDOMAIN },
    update: { apiKey: AGENT_API_KEY, bcInstance: BC_INSTANCE, bcCompany: BC_COMPANY },
    create: {
      name: TENANT_NAME,
      tunnelSubdomain: TUNNEL_SUBDOMAIN,
      bcInstance: BC_INSTANCE,
      bcCompany: BC_COMPANY,
      apiKey: AGENT_API_KEY,
    },
  })
  console.log(`  Tenant id: ${tenant.id}`)

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: hash },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hash,
      role: 'admin',
      tenantId: tenant.id,
    },
  })
  console.log(`  User created: ${user.email} (id: ${user.id})`)
  console.log('\nDone. You can now sign in at /login.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
