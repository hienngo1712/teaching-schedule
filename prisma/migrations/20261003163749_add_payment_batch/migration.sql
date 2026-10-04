-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "batch_id" VARCHAR(36);

-- CreateIndex
CREATE INDEX "payments_batch_id_idx" ON "payments"("batch_id");
