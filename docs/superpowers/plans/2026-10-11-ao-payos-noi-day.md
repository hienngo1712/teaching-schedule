# AO — payOS cho phiếu nơi dạy: Implementation Plan

> **For agentic workers:** superpowers:executing-plans. Test trước → code → test liên quan → commit.

**Goal:** GV Pro đã nối payOS: phiếu nơi dạy có QR payOS; tiền vào thì tự ghi "Đã nhận" và chuông báo tiền có thông báo.

**Architecture:**
- Bảng `place_pay_links` + `place_pay_link_payments`.
- `orderCode = PLACE_ORDER_OFFSET + id`.
- Webhook payOS học phí hiện có rẽ nhánh theo orderCode.
- `payosNotice.list` gộp 2 nguồn.

**Spec:** `docs/superpowers/specs/2026-10-11-ao-payos-noi-day-design.md`. Đọc kèm spec AH + AI và các service payOS hiện có.

**Nhánh:** `feat/ao-payos-noi-day` từ `main` sau khi AN đã merge.

## Global Constraints

- Không đổi hành vi payOS của HS. Toàn bộ test payOS HS / AI hiện có phải xanh, không sửa kỳ vọng.
- Chống ghi 2 lần: `@@unique([linkId, reference])`, transaction.
- Chỉ nhận khi `paymentLinkId` khớp link.
- Khoá payOS không bao giờ log / in.
- e2e mock payOS như e2e AH / AI, **không** gọi payOS thật.
- Version **0.23.0**. Commit `[AO] ...`. Migration chỉ DB test. Khoá test.

## Review Focus

1. Webhook giao dịch thử của payOS (orderCode nhỏ, ví dụ 123) không bị hiểu là nơi dạy.
2. Hai webhook cùng reference đến song song: chỉ 1 PlacePayment (dựa vào unique + bắt lỗi P2002).
3. GV hết Pro sau khi đã phát QR: tiền vẫn ghi nhận, nhưng mở phiếu mới thì là VietQR.
4. Chuông: 15 khoản HS + 10 khoản nơi dạy → hiện đúng 20 mới nhất, số chưa đọc đếm cả 25.
5. Số tiền phiếu giảm về 0 (đã nhận đủ bằng tay): link active bị huỷ, không phát QR.

---

### Task 1: Schema + tạo link payOS cho phiếu nơi dạy

**Files:**
- `schema.prisma` + migration
- Create: `src/server/services/place-paylink.service.ts` (mô phỏng `tuition-paylink.service.ts`: tạo / dùng lại / huỷ khi đổi số tiền, rơi về VietQR khi lỗi)
- `place-notice.service.ts` (`getPlaceNotice` / `getPublicPlaceNotice` trả `payos?: { qrCode, checkoutUrl }`)
- `FEATURE_PLAN.payosPlace: pro`
- Test integration (mock payOS client như test AH)

- [ ] **RED:**
  - Pro + nối payOS → tạo link `orderCode = offset + id`
  - mở lại cùng số tiền → dùng lại
  - đổi số tiền → cũ `cancelled`, mới tạo
  - lỗi payOS → không có `payos`, phiếu vẫn trả
  - không Pro → không tạo
  - **[RF 5]** remaining 0 → huỷ active, không tạo
- [ ] code → GREEN → Commit `[AO] Tạo QR payOS cho phiếu nơi dạy`

### Task 2: Webhook rẽ nhánh + ghi Đã nhận

**Files:**
- `tuition-payos-webhook.service.ts` (rẽ theo `orderCode ≥ PLACE_ORDER_OFFSET`)
- `place-paylink.service.ts` `handlePlacePayment`
- Test integration

- [ ] **RED:**
  - webhook hợp lệ → PlacePayment `source=payos` + link paid khi đủ
  - A, B, A → tổng đúng
  - song song cùng reference → 1 dòng **[RF 2]**
  - `paymentLinkId` lệch → bỏ qua
  - orderCode 123 → luồng HS như cũ **[RF 1]**
  - GV hết Pro → vẫn ghi **[RF 3]**
  - chạy lại toàn bộ test webhook HS → xanh
- [ ] code → GREEN → Commit `[AO] Webhook payOS ghi Đã nhận cho nơi dạy`

### Task 3: Trang người trả + chuông báo tiền

**Files:**
- `PayerView.tsx` (QR payOS + "Mở trang thanh toán")
- `PlaceNoticeDialog.tsx` (QR payOS)
- `payos-notice.service.ts` (gộp nguồn, vẫn giới hạn 20, đếm chưa đọc 2 nguồn)
- `PayosNoticeList` (dòng nơi dạy, link `/timesheet?tab=income&year=&month=&placeId=`)
- `IncomeTab` (mở sheet theo query)
- Test unit / integration + e2e

- [ ] **RED:**
  - list gộp sắp theo `createdAt`
  - 15 + 10 → 20 dòng, unread 25 **[RF 4]**
  - bấm dòng nơi dạy → đúng URL, sheet mở
- [ ] code → GREEN → **e2e** `tests/e2e/ao-payos-noi-day.spec.ts`: mở phiếu có QR payOS → gửi webhook giả có chữ ký → Thu nhập "Đã nhận đủ" + chuông có dòng → Commit `[AO] Trang người trả và chuông có tiền nơi dạy`

### Task 4: Phát hành 0.23.0

- [ ] version 0.23.0 + "Có gì mới".
- [ ] full vitest + full e2e.
- [ ] Commit `[AO] Phát hành 0.23.0`. Báo cáo `bao-cao-AO.md`. `DONE AO`. Không merge.
