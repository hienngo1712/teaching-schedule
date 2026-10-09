-- AlterTable
ALTER TABLE "plan_orders" ADD COLUMN     "method" VARCHAR(8) NOT NULL DEFAULT 'vietqr',
ADD COLUMN     "paid_amount" INTEGER,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "paid_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "payos_checkout_url" TEXT,
ADD COLUMN     "payos_link_id" VARCHAR(64),
ADD COLUMN     "payos_qr" TEXT,
ADD COLUMN     "payos_ref" VARCHAR(64);

-- CreateTable
CREATE TABLE "contact_changes" (
    "id" SERIAL NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "facebook_url" TEXT,
    "changed_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_changes_created_at_idx" ON "contact_changes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plan_orders_payos_ref_key" ON "plan_orders"("payos_ref");
