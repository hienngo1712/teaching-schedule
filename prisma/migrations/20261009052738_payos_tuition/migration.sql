-- AlterTable
ALTER TABLE "monthly_tuition" ADD COLUMN     "payos_paid_amount" INTEGER,
ADD COLUMN     "payos_paid_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "teacher_payos" (
    "user_id" INTEGER NOT NULL,
    "client_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "checksum_key" TEXT NOT NULL,
    "hook_id" VARCHAR(43) NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_payos_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "tuition_pay_links" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
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

    CONSTRAINT "tuition_pay_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuition_pay_link_payments" (
    "id" SERIAL NOT NULL,
    "link_id" INTEGER NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "batch_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuition_pay_link_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_payos_hook_id_key" ON "teacher_payos"("hook_id");

-- CreateIndex
CREATE INDEX "tuition_pay_links_student_id_status_idx" ON "tuition_pay_links"("student_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tuition_pay_link_payments_reference_key" ON "tuition_pay_link_payments"("reference");

-- AddForeignKey
ALTER TABLE "teacher_payos" ADD CONSTRAINT "teacher_payos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuition_pay_links" ADD CONSTRAINT "tuition_pay_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuition_pay_link_payments" ADD CONSTRAINT "tuition_pay_link_payments_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "tuition_pay_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
