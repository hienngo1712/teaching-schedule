-- CreateTable
CREATE TABLE "monthly_tuition" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "is_full_paid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_tuition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_tuition_year_month_idx" ON "monthly_tuition"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_tuition_student_id_year_month_key" ON "monthly_tuition"("student_id", "year", "month");

-- AddForeignKey
ALTER TABLE "monthly_tuition" ADD CONSTRAINT "monthly_tuition_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
