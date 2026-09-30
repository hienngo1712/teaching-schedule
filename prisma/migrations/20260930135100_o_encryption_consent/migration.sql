-- AlterTable
ALTER TABLE "students" ADD COLUMN     "parent_link_token_hash" VARCHAR(64),
ALTER COLUMN "full_name" SET DATA TYPE TEXT,
ALTER COLUMN "parent_phone" SET DATA TYPE TEXT,
ALTER COLUMN "parent_name" SET DATA TYPE TEXT,
ALTER COLUMN "parent_link_token" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "full_name" SET DATA TYPE TEXT,
ALTER COLUMN "bank_account_name" SET DATA TYPE TEXT,
ALTER COLUMN "bank_account_number" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "consent_records" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "text_version" VARCHAR(20) NOT NULL,
    "student_id" INTEGER,
    "item_count" INTEGER NOT NULL DEFAULT 1,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event" VARCHAR(30) NOT NULL,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_records_user_id_created_at_idx" ON "consent_records"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at");

-- Link phụ huynh đã tạo trước O vẫn mở được ngay sau deploy (spec O 6.5).
UPDATE "students"
SET "parent_link_token_hash" = encode(sha256(convert_to("parent_link_token", 'UTF8')), 'hex')
WHERE "parent_link_token" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "students_parent_link_token_hash_key" ON "students"("parent_link_token_hash");
