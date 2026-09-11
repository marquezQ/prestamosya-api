-- Recalcula y restaura los desgloses históricos en VPS donde interest_paid y capital_paid quedaron en 0
UPDATE "payment_installments" pi
SET 
  "interest_paid" = LEAST(p.amount, i.interest_amount),
  "capital_paid" = GREATEST(0, p.amount - LEAST(p.amount, i.interest_amount)),
  "interest_discounted" = p.discount_amount
FROM "payments" p
JOIN "installments" i ON i.id = pi.installment_id
WHERE pi.payment_id = p.id
  AND pi.interest_paid = 0 
  AND pi.capital_paid = 0
  AND p.amount > 0;
