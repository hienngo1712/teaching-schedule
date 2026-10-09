-- CreateTable
CREATE TABLE "plan_order_payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_order_payments_reference_key" ON "plan_order_payments"("reference");

-- CreateIndex
CREATE INDEX "plan_order_payments_order_id_idx" ON "plan_order_payments"("order_id");

-- AddForeignKey
ALTER TABLE "plan_order_payments" ADD CONSTRAINT "plan_order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "plan_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

