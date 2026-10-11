-- AQ: mốc xoá vĩnh viễn tài khoản (bia mộ ẩn danh giữ đơn mua gói).
ALTER TABLE "users" ADD COLUMN "purged_at" TIMESTAMP(3);
