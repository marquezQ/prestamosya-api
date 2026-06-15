-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'collector');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BOB', 'USD');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('daily', 'weekly', 'monthly', 'custom');

-- CreateEnum
CREATE TYPE "LoanMode" AS ENUM ('automatic', 'manual');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED', 'REFINANCED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'transfer', 'qr');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('NO_LOAN', 'CURRENT', 'DELINQUENT');

-- CreateEnum
CREATE TYPE "GuaranteeType" AS ENUM ('VEHICLE', 'REAL_ESTATE', 'FURNITURE', 'OTHER');

-- CreateEnum
CREATE TYPE "GuaranteeStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'RELEASED');

-- CreateEnum
CREATE TYPE "GuaranteeLinkStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateEnum
CREATE TYPE "RefinanceType" AS ENUM ('EXTEND_TERM', 'ADDITIONAL_AMOUNT', 'NEW_RATE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_config" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_name" VARCHAR(150),
    "primary_currency" "Currency" NOT NULL DEFAULT 'BOB',
    "exchange_rate" DECIMAL(10,4) NOT NULL DEFAULT 6.96,
    "default_interest_rate" DECIMAL(5,2),
    "default_period_type" "PeriodType",
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "id_number" VARCHAR(20) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "phone_alt" VARCHAR(20),
    "address" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "status" "ClientStatus" NOT NULL DEFAULT 'NO_LOAN',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarantees" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "GuaranteeType" NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_value" DECIMAL(12,2),
    "status" "GuaranteeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guarantees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarantee_photos" (
    "id" TEXT NOT NULL,
    "guarantee_id" TEXT NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guarantee_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "mode" "LoanMode" NOT NULL,
    "capital_amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'BOB',
    "interest_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "period_type" "PeriodType",
    "total_installments" INTEGER NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "total_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstanding_balance" DECIMAL(12,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE NOT NULL,
    "first_due_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_guarantees" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "guarantee_id" TEXT NOT NULL,
    "status" "GuaranteeLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "loan_guarantees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "capital_amount" DECIMAL(12,2) NOT NULL,
    "interest_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "days_overdue" INTEGER NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "registered_by" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "notes" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_installments" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "installment_id" TEXT NOT NULL,
    "amount_applied" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_refinances" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "refinance_type" "RefinanceType" NOT NULL,
    "previous_balance" DECIMAL(12,2) NOT NULL,
    "previous_installments" INTEGER NOT NULL,
    "previous_rate" DECIMAL(5,2) NOT NULL,
    "additional_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_delivered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "new_rate" DECIMAL(5,2) NOT NULL,
    "new_installments" INTEGER NOT NULL,
    "new_total_amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_refinances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "business_config_user_id_key" ON "business_config"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_number_key" ON "clients"("id_number");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_full_name_idx" ON "clients"("full_name");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_latitude_longitude_idx" ON "clients"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "guarantees_client_id_idx" ON "guarantees"("client_id");

-- CreateIndex
CREATE INDEX "guarantees_status_idx" ON "guarantees"("status");

-- CreateIndex
CREATE INDEX "loans_client_id_idx" ON "loans"("client_id");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loans_client_id_status_idx" ON "loans"("client_id", "status");

-- CreateIndex
CREATE INDEX "loan_guarantees_loan_id_idx" ON "loan_guarantees"("loan_id");

-- CreateIndex
CREATE INDEX "loan_guarantees_guarantee_id_idx" ON "loan_guarantees"("guarantee_id");

-- CreateIndex
CREATE INDEX "installments_loan_id_idx" ON "installments"("loan_id");

-- CreateIndex
CREATE INDEX "installments_due_date_idx" ON "installments"("due_date");

-- CreateIndex
CREATE INDEX "installments_status_idx" ON "installments"("status");

-- CreateIndex
CREATE INDEX "installments_due_date_status_idx" ON "installments"("due_date", "status");

-- CreateIndex
CREATE INDEX "payments_loan_id_idx" ON "payments"("loan_id");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "payments_voided_idx" ON "payments"("voided");

-- CreateIndex
CREATE INDEX "payment_installments_payment_id_idx" ON "payment_installments"("payment_id");

-- CreateIndex
CREATE INDEX "payment_installments_installment_id_idx" ON "payment_installments"("installment_id");

-- CreateIndex
CREATE INDEX "loan_refinances_loan_id_idx" ON "loan_refinances"("loan_id");

-- AddForeignKey
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_config" ADD CONSTRAINT "business_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantee_photos" ADD CONSTRAINT "guarantee_photos_guarantee_id_fkey" FOREIGN KEY ("guarantee_id") REFERENCES "guarantees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_guarantees" ADD CONSTRAINT "loan_guarantees_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_guarantees" ADD CONSTRAINT "loan_guarantees_guarantee_id_fkey" FOREIGN KEY ("guarantee_id") REFERENCES "guarantees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_refinances" ADD CONSTRAINT "loan_refinances_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
