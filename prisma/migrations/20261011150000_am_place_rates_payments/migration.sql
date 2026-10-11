-- CreateTable
CREATE TABLE "place_rate_changes" (
    "id" SERIAL NOT NULL,
    "place_id" INTEGER NOT NULL,
    "from_key" INTEGER NOT NULL,
    "unit" VARCHAR(8) NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_rate_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_payments" (
    "id" SERIAL NOT NULL,
    "place_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "received_at" DATE NOT NULL,
    "note" TEXT,
    "source" VARCHAR(8) NOT NULL DEFAULT 'manual',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "place_rate_changes_place_id_from_key_key" ON "place_rate_changes"("place_id", "from_key");

-- CreateIndex
CREATE INDEX "place_payments_place_id_year_month_idx" ON "place_payments"("place_id", "year", "month");

-- AddForeignKey
ALTER TABLE "place_rate_changes" ADD CONSTRAINT "place_rate_changes_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_payments" ADD CONSTRAINT "place_payments_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

