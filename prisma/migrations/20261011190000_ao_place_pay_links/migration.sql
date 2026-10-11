-- CreateTable
CREATE TABLE "place_pay_links" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "place_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'active',
    "payos_link_id" VARCHAR(64) NOT NULL,
    "qr_code" TEXT NOT NULL,
    "checkout_url" TEXT NOT NULL,
    "bank_bin" VARCHAR(8),
    "account_number" TEXT,
    "account_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_pay_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_pay_link_payments" (
    "id" SERIAL NOT NULL,
    "link_id" INTEGER NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "place_payment_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_pay_link_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "place_pay_links_place_id_year_month_status_idx" ON "place_pay_links"("place_id", "year", "month", "status");

-- CreateIndex
CREATE INDEX "place_pay_links_user_id_idx" ON "place_pay_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "place_pay_link_payments_link_id_reference_key" ON "place_pay_link_payments"("link_id", "reference");

-- AddForeignKey
ALTER TABLE "place_pay_links" ADD CONSTRAINT "place_pay_links_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_pay_link_payments" ADD CONSTRAINT "place_pay_link_payments_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "place_pay_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

