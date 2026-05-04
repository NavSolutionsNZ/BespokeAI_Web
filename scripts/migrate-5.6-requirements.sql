-- Stage 5.6: Requirements Builder
-- Run this SQL in Vercel Postgres (Dashboard → Query) or via psql

CREATE TABLE IF NOT EXISTS "Requirement" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "bcArea"          TEXT NOT NULL,
  "priority"        TEXT NOT NULL,
  "aiSpec"          TEXT,
  "status"          TEXT NOT NULL DEFAULT 'draft',
  "quote"           DECIMAL(10,2),
  "quoteApprovedAt" TIMESTAMP(3),
  "consultantNote"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Requirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Requirement_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Requirement_tenantId_idx" ON "Requirement"("tenantId");
CREATE INDEX IF NOT EXISTS "Requirement_userId_idx"   ON "Requirement"("userId");
CREATE INDEX IF NOT EXISTS "Requirement_status_idx"   ON "Requirement"("status");

-- Auto-update updatedAt trigger
CREATE OR REPLACE FUNCTION update_requirement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_requirement_updated_at ON "Requirement";
CREATE TRIGGER set_requirement_updated_at
  BEFORE UPDATE ON "Requirement"
  FOR EACH ROW
  EXECUTE PROCEDURE update_requirement_updated_at();
