-- 2 cột thêm ở 20261009052738_payos_tuition cùng nhánh AH, chưa từng có dữ liệu prod: 'PH đã chuyển' chuyển sang tính lúc đọc.
-- AlterTable
ALTER TABLE "monthly_tuition" DROP COLUMN "payos_paid_amount",
DROP COLUMN "payos_paid_at";

