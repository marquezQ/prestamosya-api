-- Corregir cualquier sobre-asignación de capital en pagos históricos donde la suma de links excedía el monto del pago
WITH payment_totals AS (
  SELECT 
    payment_id,
    SUM(interest_paid + capital_paid) AS total_applied
  FROM payment_installments
  GROUP BY payment_id
)
UPDATE payment_installments pi
SET capital_paid = GREATEST(0, pi.capital_paid - (pt.total_applied - p.amount))
FROM payment_totals pt
JOIN payments p ON p.id = pt.payment_id
WHERE pi.payment_id = pt.payment_id
  AND pt.total_applied > p.amount
  AND p.amount > 0;
