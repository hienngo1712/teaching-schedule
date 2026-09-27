-- CreateTable
CREATE TABLE "plan_price_changes" (
    "id" SERIAL NOT NULL,
    "plan" VARCHAR(10) NOT NULL,
    "month_price" INTEGER NOT NULL,
    "previous_month_price" INTEGER,
    "changed_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_day_changes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "days" INTEGER NOT NULL,
    "previous_days" INTEGER,
    "changed_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_day_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_price_changes_plan_created_at_idx" ON "plan_price_changes"("plan", "created_at");

-- CreateIndex
CREATE INDEX "trial_day_changes_user_id_created_at_idx" ON "trial_day_changes"("user_id", "created_at");

-- Giá đang bán và số ngày dùng thử lúc ra mắt màn Bảng giá (spec L Q3, mục 15), dòng seed không có giá trị cũ
INSERT INTO "plan_price_changes" ("plan", "month_price", "previous_month_price", "changed_by", "created_at")
VALUES ('plus', 49000, NULL, 'migration', now() AT TIME ZONE 'UTC'),
       ('pro',  99000, NULL, 'migration', now() AT TIME ZONE 'UTC');

INSERT INTO "trial_day_changes" ("user_id", "days", "previous_days", "changed_by", "created_at")
VALUES (NULL, 60, NULL, 'migration', now() AT TIME ZONE 'UTC');
