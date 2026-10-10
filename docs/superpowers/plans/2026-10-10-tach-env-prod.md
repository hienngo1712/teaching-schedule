# Tách chuỗi kết nối DB production khỏi máy (kế hoạch ngắn)

**Mục tiêu:** trên máy dev không còn file nào tự động trỏ vào DB production. Lệnh gõ nhầm (`prisma`, `pnpm dev`, script) chỉ chạm DB test Docker.

## Hiện trạng (đã kiểm 2026-10-10)

- `.env` chỉ có `DATABASE_URL` + `DIRECT_URL` của Neon prod, **không có khoá mã hoá** (khoá prod chỉ nằm trên Vercel).
  Nếu lộ file này thì lộ DB nhưng các trường mã hoá vẫn là bản mã.
- Prisma CLI và Next tự đọc `.env`, nên gõ nhầm lệnh là chạm prod.
- Lỗ hổng phụ: `scripts/db-reset-safe.ts`, `prisma/seed.ts`, `scripts/activate-default-subjects.ts` nhận diện prod bằng cách **đọc `.env`**.
  Nếu bỏ `.env` thì các guard này lặng lẽ cho chạy, nên phải sửa guard **trước khi** dời file.
- `pnpm test` / Playwright dùng `.env.test` (localhost:5433), không phụ thuộc `.env`.

## Các bước

1. **Guard không phụ thuộc `.env`**: tạo `scripts/prod-hosts.ts` chứa host Neon prod. Host là tên máy chủ, không phải bí mật.
   Ba script trên chặn khi `DATABASE_URL` trùng host này, có hay không có `.env`.
   → kiểm: unit test cho thấy guard chặn URL prod khi không có `.env`.
2. **Dời file**: chép `.env` ra ngoài repo (vd `D:\secrets\student-manager\prod.env`, hoặc cất vào trình quản lý mật khẩu).
   `.env` trong repo thay bằng nội dung trỏ DB test Docker.
   → kiểm: `npx prisma migrate status` báo localhost:5433.
3. **Khi cần đọc prod** (thống kê như 2026-10-09): chạy tường minh `node --env-file=D:\secrets\...\prod.env script`. Script tự in host trước khi chạy.
4. **Đổi mật khẩu DB trên Neon** (người dùng tự làm), cập nhật `DATABASE_URL`/`DIRECT_URL` trên Vercel rồi redeploy.
   Mật khẩu cũ đã nằm trong `.env` mà agent AI và công cụ đọc được.
5. **Cập nhật ghi chú**:
   - `docs/CLAUDE.md` mục PRODUCTION DATA SAFETY và `docs/coding-rule.md` §6.1 đang ghi "`.env` (production)". Sửa thành "file prod ngoài repo" + host guard.
   - Sửa memory theo.
6. → kiểm cuối: `pnpm test` xanh; `pnpm db:reset` với URL prod bị chặn; Vercel deploy chạy bình thường.

**Không đụng:** code app, schema, Vercel env (trừ bước 4).
**Bump version:** patch (chỉ script).
