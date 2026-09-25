-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bank_account_name" VARCHAR(50),
ADD COLUMN     "bank_account_number" VARCHAR(19),
ADD COLUMN     "bank_bin" VARCHAR(8);
