# AQ — Admin xoá vĩnh viễn tài khoản: Implementation Plan

> **For agentic workers:** superpowers:executing-plans. Test trước → code → test liên quan → commit.

**Goal:** tab Đã xoá ở `/admin/accounts` có nút **Xoá vĩnh viễn** cho tài khoản đã xoá ≥ 30 ngày. Xoá sạch dữ liệu dạy học và cá nhân, giữ đơn mua gói gắn với "bia mộ" user ẩn danh.

**Spec:** `docs/superpowers/specs/2026-10-11-aq-xoa-vinh-vien-tai-khoan-design.md`.

**Nhánh:** `feat/aq-xoa-vinh-vien` từ `feat/ap-huong-dan` (nhánh chồng, AP chưa merge). Commit đầu `[AQ] Spec và plan`.

## Global Constraints

- Migration duy nhất: `users.purged_at TIMESTAMP NULL`. Chỉ áp DB test 5433.
- Xoá trong 1 transaction; lỗi giữa chừng thì không mất gì.
- Không log PII hay khoá payOS. Log chỉ id + số dòng.
- Model chưa phân loại trong spec §4 → **STOP**, không tự quyết.
- Mobile-first, vi + en. Test 3 tầng. Version **0.25.0**. Commit `[AQ] ...`. Không merge, không push.

## Review Focus

1. Không sót bảng: sau purge, quét mọi model có userId / studentId / placeId của user → 0 dòng (trừ plan_orders, plan_order_payments, log admin).
2. Doanh thu admin (tổng + theo tháng) và Lịch sử đơn trước = sau; tên hiển thị "TK đã xoá #id".
3. Webhook payOS đến sau khi purge (link HS / nơi dạy đã xoá) → 200 "không khớp", không lỗi 500.
4. Số đếm Tổng quan admin (Tổng TK, Đang hoạt động, Đang trả phí...) không tính bia mộ.
5. Admin gõ tên có khoảng trắng thừa / khác hoa thường → so khớp chính xác (không trim hoa thường), nút không bật.

---

### Task 1: Migration + service purge

**Files:**
- `prisma/schema.prisma` (`User.purgedAt`) + migration
- Create: `src/server/services/admin-purge.service.ts` (`purgeUser(db, adminId, userId, confirmUsername)`)
- Test: `tests/integration/aq-purge-user.test.ts`

**Steps:**
- [ ] Liệt kê mọi model liên quan user (spec §4). Ghi bảng xoá / giữ vào ledger. Có model lạ → STOP.
- [ ] **RED:** các ca ở spec §8 phần integration, gồm **[RF 1]** quét 0 dòng, **[RF 2]** doanh thu bằng nhau, **[RF 3]** webhook sau purge, **[RF 5]** so khớp chính xác.
- [ ] Code → GREEN → tsc + lint → Commit `[AQ] Xoá vĩnh viễn tài khoản giữ đơn mua gói`

### Task 2: Router + danh sách Đã xoá + số đếm admin

**Files:**
- `src/server/trpc/routers/admin.ts`: `purgeUser`; `deletedUsers` thêm `purgeAvailableAt`, loại `purgedAt`
- Service danh sách / overview / doanh thu admin: loại bia mộ khỏi số đếm, tên "TK đã xoá #id"
- Test integration router: quyền admin, FORBIDDEN với user thường, **[RF 4]**

**Steps:**
- [ ] RED → code → GREEN → Commit `[AQ] API xoá vĩnh viễn và danh sách Đã xoá`

### Task 3: UI tab Đã xoá + hộp xác nhận

**Files:**
- `src/components/admin/AdminAccounts.tsx`
- Create: `src/components/admin/PurgeAccountDialog.tsx`
- `vi.json` / `en.json`
- Test unit + e2e `tests/e2e/aq-xoa-vinh-vien.spec.ts`

**Steps:**
- [ ] **RED unit:**
  - chưa đủ 30 ngày → không có nút, có dòng "Xoá vĩnh viễn được từ"
  - nút đỏ chỉ bật khi gõ khớp
- [ ] Code → GREEN.
- [ ] **e2e** 375 + 1280: seed TK `deleted_at` lùi 31 ngày → purge → dòng mất, số tab giảm.
- [ ] Ảnh 375 / 1280 tab Đã xoá + hộp xác nhận, tự xem.
- [ ] Commit `[AQ] Nút Xoá vĩnh viễn trong tab Đã xoá`

### Task 4: Phát hành 0.25.0

- [ ] version 0.25.0 + "Có gì mới" (phần admin nếu có phân loại; spec §7 — không thêm mục `/guide` vì admin không có hướng dẫn trong `/guide`).
- [ ] Xoá `.next`, full vitest + full e2e.
- [ ] Commit `[AQ] Phát hành 0.25.0`. Báo cáo `bao-cao-AQ.md` (gồm bảng phân loại model). `DONE AQ`. Không merge, không push.
