# CLAUDE.md — Teaching Schedule Manager

> **Dành cho Claude Code AI:** File này là **index ngắn gọn**. Trước khi bắt đầu bất kỳ sub-phase nào, hãy đọc đúng file doc liên quan trong `docs/`. KHÔNG cần đọc hết tất cả docs ngay từ đầu.

---

## Tổng quan nhanh

Ứng dụng quản lý lịch dạy học cá nhân cho **1 giáo viên**. Học sinh lớp 1–9. Deploy trên **Vercel** + **Neon PostgreSQL**.

**Stack:** Next.js 14 (App Router) · TypeScript · tRPC v11 · Prisma · NextAuth.js v5 · shadcn/ui · TailwindCSS 4 · Vitest · Playwright

---

## Cấu trúc docs/

| File | Nội dung | Đọc khi nào |
|------|----------|-------------|
| `docs/01-overview.md` | Nghiệp vụ, tech stack, cấu trúc thư mục dự án, package.json | Lần đầu setup, khi cần tra cứu tổng thể |
| `docs/02-database.md` | Prisma schema đầy đủ (4 models), seed data, DB conventions | Phase 1 Sub 1.2 — setup DB |
| `docs/03-api.md` | tRPC routers chi tiết: input/output, Zod schemas, services | Mỗi lần code backend (Phase 2–8) |
| `docs/04-frontend.md` | Spec từng component, hooks, styles, routing | Mỗi lần code UI (Phase 1–8) |
| `docs/05-deploy.md` | Vercel + Neon setup step-by-step, env vars, workflow CI/CD | Phase 0, Phase 1 Sub 1.6, troubleshooting |
| `docs/06-testing.md` | Vitest config, Playwright config, test helpers, toàn bộ test cases | Phase 1 Sub 1.5, trước mỗi commit |
| `docs/07-phases.md` | 9 phases × sub-phases đầy đủ với checklist từng task | **Đọc đầu mỗi phiên làm việc** |
| `docs/08-review.md` | Review checklist 2 lần, quy tắc code, final acceptance checklist | Sau mỗi sub-phase hoàn thành |

---

## Quy tắc làm việc (BẮT BUỘC)

```
1. Mỗi phiên làm việc = 1 sub-phase duy nhất
2. Bắt đầu phiên → đọc docs liên quan → code → test → review 2 lần → commit
3. KHÔNG sang sub-phase tiếp khi chưa pass review
4. Thứ tự: docs/07-phases.md → biết làm gì → docs tương ứng → biết làm thế nào
```

---

## Bắt đầu từ đâu?

```
Lần đầu tiên:  đọc docs/01-overview.md  →  docs/07-phases.md (Phase 0)
Đang giữa chừng: đọc docs/07-phases.md → tìm sub-phase tiếp → đọc doc liên quan
Đang fix bug:  đọc docs/03-api.md hoặc docs/04-frontend.md tùy loại bug
```
