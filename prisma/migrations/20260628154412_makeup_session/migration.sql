-- AlterTable
ALTER TABLE "teaching_sessions" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "makeup_of_id" INTEGER;

-- CreateIndex
CREATE INDEX "teaching_sessions_makeup_of_id_idx" ON "teaching_sessions"("makeup_of_id");

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_makeup_of_id_fkey" FOREIGN KEY ("makeup_of_id") REFERENCES "teaching_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
