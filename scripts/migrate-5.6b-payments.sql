-- Stage 5.6 patch: Payment tracking fields
-- Run in Vercel Postgres Dashboard → Storage → Query

ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositAmount"  DECIMAL(10,2);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "depositPaidAt"  TIMESTAMP(3);
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "balancePaidAt"  TIMESTAMP(3);

-- Note: status column is TEXT so new status values work without migration
-- New statuses: deposit_required | deposit_paid | complete_pending_payment | fully_paid
-- Replaces: approved | complete (old records with these values still display correctly)
