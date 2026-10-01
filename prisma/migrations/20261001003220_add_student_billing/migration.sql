-- AlterTable
ALTER TABLE "students" ADD COLUMN     "billing_mode" VARCHAR(20) NOT NULL DEFAULT 'per_session',
ADD COLUMN     "monthly_fee" INTEGER NOT NULL DEFAULT 0;

-- Constraints on students
ALTER TABLE "students" ADD CONSTRAINT "students_billing_mode_check" CHECK ("billing_mode" IN ('per_session', 'monthly'));
ALTER TABLE "students" ADD CONSTRAINT "students_monthly_fee_check" CHECK ("monthly_fee" >= 0);

-- CreateTable
CREATE TABLE "student_billing_changes" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "from_key" INTEGER NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "monthly_fee" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_billing_changes_pkey" PRIMARY KEY ("id")
);

-- Constraints on student_billing_changes
ALTER TABLE "student_billing_changes" ADD CONSTRAINT "student_billing_changes_mode_check" CHECK ("mode" IN ('per_session', 'monthly'));
ALTER TABLE "student_billing_changes" ADD CONSTRAINT "student_billing_changes_monthly_fee_check" CHECK ("monthly_fee" >= 0);

-- CreateIndex
CREATE INDEX "student_billing_changes_student_id_idx" ON "student_billing_changes"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_billing_changes_student_id_from_key_key" ON "student_billing_changes"("student_id", "from_key");

-- AddForeignKey
ALTER TABLE "student_billing_changes" ADD CONSTRAINT "student_billing_changes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
