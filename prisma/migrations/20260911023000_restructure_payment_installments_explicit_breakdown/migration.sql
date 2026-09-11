-- AlterTable: Restructure payment_installments to explicit banking breakdown
ALTER TABLE "payment_installments" ADD COLUMN "interest_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payment_installments" ADD COLUMN "capital_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payment_installments" ADD COLUMN "interest_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payment_installments" ADD COLUMN "capital_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "payment_installments" DROP COLUMN IF EXISTS "amount_applied";
ALTER TABLE "payment_installments" DROP COLUMN IF EXISTS "discount_applied";
