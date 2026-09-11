-- AlterTable: add discount_applied to payment_installments
-- Registra cuánto de cada cuota fue cubierto por condonación vs. dinero real.
-- DEFAULT 0 → todos los registros existentes quedan sin descuento aplicado (correcto).
ALTER TABLE "payment_installments" ADD COLUMN "discount_applied" DECIMAL(12,2) NOT NULL DEFAULT 0;
