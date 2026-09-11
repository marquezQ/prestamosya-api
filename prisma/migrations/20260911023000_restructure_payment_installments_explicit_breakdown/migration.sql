-- AlterTable: Restructure payment_installments to explicit banking breakdown
ALTER TABLE "payment_installments" ADD COLUMN IF NOT EXISTS "interest_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payment_installments" ADD COLUMN IF NOT EXISTS "capital_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payment_installments" ADD COLUMN IF NOT EXISTS "interest_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payment_installments" ADD COLUMN IF NOT EXISTS "capital_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill historical production data from amount_applied and discount_applied before dropping
UPDATE "payment_installments" AS pi
SET 
  "interest_paid" = LEAST(pi."amount_applied", i."interest_amount"),
  "capital_paid" = GREATEST(0, pi."amount_applied" - LEAST(pi."amount_applied", i."interest_amount")),
  "interest_discounted" = pi."discount_applied"
FROM "installments" AS i
WHERE pi."installment_id" = i."id"
  AND pi."amount_applied" IS NOT NULL;

ALTER TABLE "payment_installments" DROP COLUMN IF EXISTS "amount_applied";
ALTER TABLE "payment_installments" DROP COLUMN IF EXISTS "discount_applied";
