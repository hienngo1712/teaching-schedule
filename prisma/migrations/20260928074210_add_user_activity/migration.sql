-- AlterTable
ALTER TABLE "users" ADD COLUMN     "admin_seen_at" TIMESTAMP(3),
ADD COLUMN     "last_active_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_activity_days" (
    "user_id" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_activity_days_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "user_activity_days_day_idx" ON "user_activity_days"("day");

-- AddForeignKey
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Có số Active 24h / "Standard sau dùng thử" ngay khi lên (spec K B8); chỉ ghi vào cột vừa thêm.
UPDATE "users" SET "last_active_at" = "last_login_at" WHERE "last_active_at" IS NULL;

-- Tài khoản có sẵn lúc triển khai coi như admin đã xem (spec K R6), danh sách "Tài khoản mới" không ngập tài khoản cũ.
UPDATE "users" SET "admin_seen_at" = now() AT TIME ZONE 'UTC' WHERE "admin_seen_at" IS NULL;
