-- CreateTable
CREATE TABLE "place_share_links" (
    "place_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_share_links_pkey" PRIMARY KEY ("place_id")
);

-- CreateTable
CREATE TABLE "place_month_notices" (
    "place_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "sent_amount" INTEGER NOT NULL,

    CONSTRAINT "place_month_notices_pkey" PRIMARY KEY ("place_id","year","month")
);

-- CreateIndex
CREATE UNIQUE INDEX "place_share_links_token_hash_key" ON "place_share_links"("token_hash");

-- AddForeignKey
ALTER TABLE "place_share_links" ADD CONSTRAINT "place_share_links_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_month_notices" ADD CONSTRAINT "place_month_notices_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "teaching_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

