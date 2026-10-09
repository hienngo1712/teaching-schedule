-- DropIndex
DROP INDEX "tuition_pay_link_payments_reference_key";

-- CreateIndex
CREATE UNIQUE INDEX "tuition_pay_link_payments_link_id_reference_key" ON "tuition_pay_link_payments"("link_id", "reference");

