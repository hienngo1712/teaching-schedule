-- AlterTable
ALTER TABLE "students" ADD COLUMN     "place_id" INTEGER;

-- AlterTable
ALTER TABLE "teaching_sessions" ADD COLUMN     "place_id" INTEGER;

-- CreateTable
CREATE TABLE "teaching_places" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_billing_changes" (
    "id" SERIAL NOT NULL,
    "place_id" INTEGER NOT NULL,
    "from_key" INTEGER NOT NULL,
    "billing" VARCHAR(12) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_billing_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_place_changes" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "from_key" INTEGER NOT NULL,
    "place_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_place_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teaching_places_user_id_is_deleted_sort_order_idx" ON "teaching_places"("user_id", "is_deleted", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_places_user_id_name_key" ON "teaching_places"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "place_billing_changes_place_id_from_key_key" ON "place_billing_changes"("place_id", "from_key");

-- CreateIndex
CREATE UNIQUE INDEX "student_place_changes_student_id_from_key_key" ON "student_place_changes"("student_id", "from_key");

-- CreateIndex
CREATE INDEX "students_place_id_idx" ON "students"("place_id");

-- CreateIndex
CREATE INDEX "teaching_sessions_user_id_place_id_session_date_idx" ON "teaching_sessions"("user_id", "place_id", "session_date");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_places" ADD CONSTRAINT "teaching_places_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_billing_changes" ADD CONSTRAINT "place_billing_changes_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_place_changes" ADD CONSTRAINT "student_place_changes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_place_changes" ADD CONSTRAINT "student_place_changes_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- BACKFILL (spec AL §2): mỗi user chưa có nơi dạy được tạo "Lớp tại nhà" (home, per_student, màu đầu bảng Môn học),
-- rồi gán mọi HS/ca chưa có nơi vào nơi đó + lịch sử nơi học from_key 0. Chạy lại không tạo trùng (test al-migration-backfill đọc phần dưới mốc này).
INSERT INTO "teaching_places" ("user_id", "name", "kind", "color", "sort_order")
SELECT u."id", 'Lớp tại nhà', 'home', '#4F46E5', 0 FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "teaching_places" p WHERE p."user_id" = u."id");

INSERT INTO "place_billing_changes" ("place_id", "from_key", "billing")
SELECT p."id", 0, 'per_student' FROM "teaching_places" p
WHERE NOT EXISTS (SELECT 1 FROM "place_billing_changes" b WHERE b."place_id" = p."id");

UPDATE "students" s SET "place_id" = p."id"
FROM "teaching_places" p
WHERE s."place_id" IS NULL AND p."user_id" = s."user_id" AND p."is_deleted" = false
  AND p."id" = (SELECT MIN(p2."id") FROM "teaching_places" p2 WHERE p2."user_id" = s."user_id" AND p2."is_deleted" = false);

UPDATE "teaching_sessions" t SET "place_id" = p."id"
FROM "teaching_places" p
WHERE t."place_id" IS NULL AND p."user_id" = t."user_id" AND p."is_deleted" = false
  AND p."id" = (SELECT MIN(p2."id") FROM "teaching_places" p2 WHERE p2."user_id" = t."user_id" AND p2."is_deleted" = false);

INSERT INTO "student_place_changes" ("student_id", "from_key", "place_id")
SELECT s."id", 0, s."place_id" FROM "students" s
WHERE s."place_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "student_place_changes" c WHERE c."student_id" = s."id");
