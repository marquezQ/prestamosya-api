-- CreateEnum
CREATE TYPE "LoanScheduleType" AS ENUM ('EQUAL_INSTALLMENTS', 'INTEREST_ONLY');

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "schedule_type" "LoanScheduleType" NOT NULL DEFAULT 'EQUAL_INSTALLMENTS';
