-- AlterTable
ALTER TABLE "monthly_tuition" ADD COLUMN     "current_month_fee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "present_sessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "previous_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_amount_due" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_sessions" INTEGER NOT NULL DEFAULT 0;
