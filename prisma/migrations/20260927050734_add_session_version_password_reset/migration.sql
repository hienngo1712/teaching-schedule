-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "password_reset_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reset_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_logs_user_id_created_at_idx" ON "password_reset_logs"("user_id", "created_at");
