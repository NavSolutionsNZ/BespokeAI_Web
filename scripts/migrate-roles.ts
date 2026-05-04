/**
 * Run once to migrate existing 'admin' role users to 'superadmin'.
 * Usage: npx ts-node scripts/migrate-roles.ts
 *        or: npx tsx scripts/migrate-roles.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.user.updateMany({
    where:  { role: 'admin' },
    data:   { role: 'superadmin' },
  })
  console.log(`✅ Migrated ${result.count} user(s) from 'admin' → 'superadmin'`)
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
