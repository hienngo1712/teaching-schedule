-- AlterTable
ALTER TABLE "users" ADD COLUMN     "plan" VARCHAR(10) NOT NULL DEFAULT 'standard',
ADD COLUMN     "plan_expires_at" TIMESTAMP(3),
ADD COLUMN     "trial_ends_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "plan_orders" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan" VARCHAR(10) NOT NULL,
    "period" VARCHAR(5),
    "amount" INTEGER NOT NULL,
    "code" VARCHAR(8),
    "status" VARCHAR(10) NOT NULL,
    "source" VARCHAR(10) NOT NULL DEFAULT 'user',
    "bonus_months" INTEGER NOT NULL DEFAULT 0,
    "credit_days" INTEGER NOT NULL DEFAULT 0,
    "granted_until" TIMESTAMP(3),
    "note" TEXT,
    "decided_by" VARCHAR(50),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_orders_code_key" ON "plan_orders"("code");

-- CreateIndex
CREATE INDEX "plan_orders_user_id_created_at_idx" ON "plan_orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "plan_orders_status_idx" ON "plan_orders"("status");

-- AddForeignKey
ALTER TABLE "plan_orders" ADD CONSTRAINT "plan_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

