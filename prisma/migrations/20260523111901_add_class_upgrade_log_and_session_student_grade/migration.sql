/*
  Warnings:

  - Added the required column `grade` to the `session_students` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable (safe 3-step backfill: add nullable, populate from students.grade, then set NOT NULL)
ALTER TABLE "session_students" ADD COLUMN "grade" SMALLINT;
UPDATE "session_students" ss
  SET "grade" = s."grade"
  FROM "students" s
  WHERE ss."student_id" = s."id";
ALTER TABLE "session_students" ALTER COLUMN "grade" SET NOT NULL;

-- CreateTable
CREATE TABLE "class_upgrade_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" VARCHAR(10) NOT NULL,
    "upgraded_count" INTEGER NOT NULL DEFAULT 0,
    "deactivated_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "class_upgrade_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_upgrade_logs_user_id_idx" ON "class_upgrade_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_upgrade_logs_user_id_year_key" ON "class_upgrade_logs"("user_id", "year");

-- CreateIndex
CREATE INDEX "session_students_grade_idx" ON "session_students"("grade");

-- AddForeignKey
ALTER TABLE "class_upgrade_logs" ADD CONSTRAINT "class_upgrade_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
