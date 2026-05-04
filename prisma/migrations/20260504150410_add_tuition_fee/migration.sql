-- AlterTable
ALTER TABLE "session_students" ADD COLUMN     "fee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "tuition_fee" INTEGER NOT NULL DEFAULT 0;
