-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "monthly_tuition_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" DATE NOT NULL,
    "method" VARCHAR(10) NOT NULL DEFAULT 'cash',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_monthly_tuition_id_idx" ON "payments"("monthly_tuition_id");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_monthly_tuition_id_fkey" FOREIGN KEY ("monthly_tuition_id") REFERENCES "monthly_tuition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chuyển dữ liệu cũ: mỗi tháng đã trả > 0 thành 1 lần thu. updated_at lưu UTC → cộng 7h lấy ngày VN.
INSERT INTO "payments" ("monthly_tuition_id", "amount", "paid_at", "method", "note", "created_at", "updated_at")
SELECT "id", "paid_amount", ("updated_at" + INTERVAL '7 hours')::date, 'cash', 'Chuyển từ dữ liệu cũ',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "monthly_tuition" WHERE "paid_amount" > 0;
