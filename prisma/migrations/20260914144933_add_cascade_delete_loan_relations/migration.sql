-- DropForeignKey
ALTER TABLE "installments" DROP CONSTRAINT "installments_loan_id_fkey";

-- DropForeignKey
ALTER TABLE "loan_guarantees" DROP CONSTRAINT "loan_guarantees_loan_id_fkey";

-- DropForeignKey
ALTER TABLE "loan_refinances" DROP CONSTRAINT "loan_refinances_loan_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_installments" DROP CONSTRAINT "payment_installments_installment_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_installments" DROP CONSTRAINT "payment_installments_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_loan_id_fkey";

-- AddForeignKey
ALTER TABLE "loan_guarantees" ADD CONSTRAINT "loan_guarantees_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_refinances" ADD CONSTRAINT "loan_refinances_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
