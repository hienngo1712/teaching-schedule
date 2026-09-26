-- Ra mắt phân gói (spec I mục 7.2): Miss Ly (id 1, Suiuoi) và qa_test (id 4) nhận Pro 1 năm
-- Khớp cả cặp id + username: DB khác production không có cặp này nên cập nhật 0 dòng
-- Hạn = 00:00 giờ VN cùng ngày năm sau, đổi về timestamp UTC như cột DateTime của Prisma
UPDATE "users" SET "plan" = 'pro',
  "plan_expires_at" = ((date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '1 year') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'UTC'
WHERE ("id", "username") IN ((4, 'qa_test'), (1, 'Suiuoi'));

INSERT INTO "plan_orders" ("user_id", "plan", "amount", "status", "source", "granted_until", "note", "decided_by", "decided_at", "created_at")
SELECT "id", 'pro', 0, 'approved', 'admin', "plan_expires_at", 'Tặng khi ra mắt phân gói', 'migration', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
FROM "users" WHERE ("id", "username") IN ((4, 'qa_test'), (1, 'Suiuoi'));
