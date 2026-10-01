# CLAUDE.md — Teaching Schedule Manager

> **Dành cho Claude Code AI:** File này là **index ngắn gọn**. Trước khi bắt đầu bất kỳ sub-phase nào, hãy đọc đúng file doc liên quan trong `docs/`. KHÔNG cần đọc hết tất cả docs ngay từ đầu.

---

## Tổng quan nhanh

Ứng dụng quản lý lịch dạy học cho giáo viên (nhiều tài khoản, mỗi tài khoản 1 giáo viên, có phân gói). Học sinh lớp 1–12. Deploy trên **Vercel** + **Neon PostgreSQL**.

**Stack:** Next.js 15 (App Router) · TypeScript · tRPC v11 · Prisma · NextAuth.js v5 · shadcn/ui · TailwindCSS 3.4 · Vitest · Playwright

---

## Cấu trúc docs/

| File | Nội dung | Đọc khi nào |
|------|----------|-------------|
| `docs/01-overview.md` | Nghiệp vụ, tech stack, cấu trúc thư mục dự án, package.json | Lần đầu setup, khi cần tra cứu tổng thể |
| `docs/02-database.md` | Prisma schema ban đầu, seed data, DB conventions (schema hiện hành: `prisma/schema.prisma`) | Tra cứu quy ước DB |
| `docs/03-api.md` | tRPC routers chi tiết: input/output, Zod schemas, services | Mỗi lần code backend (Phase 2–8) |
| `docs/04-frontend.md` | Spec từng component, hooks, styles, routing | Mỗi lần code UI (Phase 1–8) |
| `docs/05-deploy.md` | Vercel + Neon setup step-by-step, env vars, workflow CI/CD | Phase 0, Phase 1 Sub 1.6, troubleshooting |
| `docs/06-testing.md` | Vitest config, Playwright config, test helpers, toàn bộ test cases | Phase 1 Sub 1.5, trước mỗi commit |
| `docs/07-phases.md` | 9 phases × sub-phases ban đầu với checklist từng task | Tra cứu lịch sử dựng dự án |
| `docs/08-review.md` | Review checklist 2 lần, quy tắc code, final acceptance checklist | Sau mỗi sub-phase hoàn thành |
| `docs/superpowers/specs/`, `docs/superpowers/plans/` | Spec + plan từng phần | Trước khi code phần mới |

---

## Quy tắc làm việc

Phần mới đi theo spec + plan trong `docs/superpowers/` (duyệt spec → plan → code + test → review → merge). `docs/01–08` là tài liệu nền, đọc phần liên quan khi cần.

---

## 🚨 PRODUCTION DATA SAFETY (RULE TUYỆT ĐỐI)

> **Sự cố 2026-05-23:** Production DB bị wipe do `tests/setup.ts` chạy `deleteMany()` lên endpoint production. Restore từ Neon PITR. Tuyệt đối không tái diễn.

**Trước khi chạy bất kỳ lệnh nào tương tác DB (test, seed, migrate, db:push, db:reset), MỌI AI agent / developer PHẢI:**

1. **Đọc kỹ `docs/coding-rule.md` §6.1** (RULE BẤT KHẢ XÂM PHẠM — Bảo vệ Production Data) trước khi action.
2. **Verify endpoint:** so sánh `.env` (production) và `.env.test` DATABASE_URL — phải KHÁC nhau.
3. **`pnpm test` / `pnpm test:integration` / `pnpm exec playwright test`** chỉ được chạy khi:
   - `.env.test` tồn tại VÀ trỏ vào test branch riêng (khác endpoint `.env`).
   - `tests/env-setup.ts` là `setupFiles[0]` trong `vitest.config.ts`.
   - Không sửa `tests/setup.ts` thành nơi load env trực tiếp (vì ES module import hoisting).
4. **`pnpm db:reset` / `prisma migrate reset` / `prisma db push --force-reset`** TUYỆT ĐỐI CẤM trên `.env` (production). Chỉ chạy trên test/dev branches.
5. **Migration destructive** (drop column/table, rename) phải qua 2-step migration (deploy backward-compatible code trước → backfill → deploy drop sau).
6. **Vercel build pipeline** chỉ chứa `prisma generate && prisma migrate deploy && next build`. KHÔNG được có `pnpm test`, `migrate reset`, `db push`.
7. **Mô tả intent rõ ràng** trước action destructive: agent phải nói trước action (vd "tôi sẽ chạy `prisma migrate deploy` lên `.env` production") và CHỜ user confirm.
8. **Backup trước migration phức tạp:** dùng Neon "Branch from current" để snapshot trước, có thể rollback nếu lỗi.

**Vi phạm các rule trên → STOP NGAY và escalate cho user.**

---

## Bắt đầu từ đâu?

```
Lần đầu tiên:  đọc docs/01-overview.md
Đang làm phần mới: đọc spec + plan tương ứng trong docs/superpowers/
Đang fix bug:  đọc docs/03-api.md hoặc docs/04-frontend.md tùy loại bug
```
