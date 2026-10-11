# AN — Phiếu báo nơi dạy + trang người trả + Chuyên cần + 12 tháng: Implementation Plan

> **For agentic workers:** superpowers:executing-plans. Test trước → code → test liên quan → commit.

**Goal:** Phiếu báo + VietQR theo nơi dạy, có link công khai cho người trả. Màn Chuyên cần tháng/năm học. Biểu đồ thu nhập 12 tháng. Báo cáo lọc nơi học.

**Architecture:**
- Bảng `place_share_links` (token hash + mã hoá như link PH) và `place_month_notices`.
- Route công khai `/n/[token]`.
- Router `placeNotice`, `attendanceReport`, `income.last12`.

**Spec:** `docs/superpowers/specs/2026-10-11-an-phieu-noi-day-chuyen-can-design.md`. Mẫu `.superpowers/mockups/aj/` 09a, 09b, 10, 12, 13.

**Nhánh:** `feat/an-phieu-noi-day` từ `main` sau khi AM đã merge.

## Global Constraints

- Trang người trả **không bao giờ** chứa tên HS. Chỉ đọc. `noindex`.
- 404 khi:
  - token sai
  - nơi xoá
  - nơi không còn `per_session`
  - GV khoá/xoá
  - GV hết Plus
- Nội dung CK không dấu, ≤ 25 ký tự (dùng lại hàm của phiếu HS).
- **Gói:**
  - Phiếu nơi dạy: Plus.
  - Chuyên cần tháng: Plus.
  - Năm học + lọc khối: Pro.
  - 12 tháng: Pro.
- Năm học = T9 → T5 năm sau.
- Version **0.22.0**. Commit `[AN] ...`. Migration chỉ DB test. Khoá test. Mobile-first. vi + en.

## Review Focus

1. Tháng có 0 ca đã dạy hoặc nơi chưa có đơn giá: không cho mở phiếu (nút disable + lý do), link công khai tháng đó hiện "Chưa có phiếu".
2. GV đổi tên nơi / đổi tài khoản ngân hàng sau khi gửi link: trang người trả hiện thông tin mới. Nhãn "Số tiền đã đổi" chỉ theo số tiền.
3. Tạo link mới: link cũ 404 ngay.
4. Chuyên cần HS đã nghỉ/đã xoá: tháng cũ vẫn có trong bảng như Báo cáo hiện tính HS đã xoá (spec R8).
5. Năm học qua tháng 12 → tháng 1: không lệch năm.

---

### Task 1: Schema + token + phiếu nơi dạy (service)

**Files:**
- `schema.prisma` (PlaceShareLink, PlaceMonthNotice) + migration
- `ENCRYPTED_FIELDS` thêm `PlaceShareLink: ["token"]`
- Create: `src/server/services/place-notice.service.ts`
- Tái dùng `parent-token.ts` (sinh / regex / hash), có thể tách hàm chung nếu cần
- Test: `tests/integration/an-place-notice.test.ts`

**Produces:**
- `getPlaceNotice(db, userId, placeId, year, month)` → `{ place, teacherName, subjects, doneDates: {date, isMakeup}[], cancelledDates, doneCount, doneHours, rate, expected, received, remaining, bank?, transferContent, sentAt?, sentAmount?, amountChanged }`
- `ensurePlaceShareLink(db, userId, placeId)` → `{ url }`
- `rotatePlaceShareLink` / `disablePlaceShareLink`
- `markPlaceNoticeSent(db, userId, placeId, year, month)`

- [ ] **RED:**
  - số liệu khớp `income.detail` (AM)
  - không ngân hàng → `bank` undefined
  - nội dung CK ≤ 25, không dấu
  - mark sent rồi thêm 1 ca → `amountChanged`
  - **[RF 1]** 0 ca / chưa đơn giá → lỗi BAD_REQUEST `notice_empty`
- [ ] code → GREEN → Commit `[AN] Phiếu báo theo nơi dạy (service)`

### Task 2: Trang người trả `/n/[token]`

**Files:**
- Create: `src/app/n/[token]/page.tsx` (server component như trang `/p/[token]`)
- `getPublicPlaceNotice(db, token, thang?)` trong `place-notice.service.ts`
- Create: `src/components/place-notice/PayerView.tsx` (dựng theo `ParentView`)
- Test integration + e2e

- [ ] **RED:**
  - 5 trường hợp 404
  - text DTO / trang không có tên HS
  - tháng ngoài khoảng 6 tháng → tháng hiện tại
  - **[RF 3]** rotate → token cũ 404
  - **[RF 2]** đổi tên nơi → trang có tên mới
- [ ] code → GREEN → ảnh 13 (375/1280) → Commit `[AN] Trang người trả xem phiếu nơi dạy`

### Task 3: UI phiếu nơi dạy trong Thu nhập

**Files:**
- Create: `src/components/place-notice/PlaceNoticeDialog.tsx` (dựng theo `TuitionNoticeCard` + thao tác: Sao chép link / Tải ảnh / Đánh dấu đã gửi; tự đánh dấu khi copy/tải như spec V)
- Modify: `IncomeTab.tsx` (nút Phiếu báo, nhãn "Đã gửi" / "Số tiền đã đổi"), `IncomeDetailSheet.tsx`
- Modify: menu ⋯ của nơi dạy: "Tạo link mới", "Tắt link"
- Router `placeNotice.get / link / rotate / disable / markSent`; `FEATURE_PLAN.placeNotice: plus`
- Test unit + e2e

- [ ] **RED:**
  - dialog render đủ dòng
  - sao chép link gọi `markSent`
  - Standard bấm → UpgradeDialog
  - nút disable khi 0 ca **[RF 1]**
- [ ] code → GREEN → **e2e:** tạo phiếu → sao chép link → mở `/n/...` thấy QR + số tiền, không tên HS → ảnh 12 → Commit `[AN] Phiếu báo nơi dạy trong Thu nhập`

### Task 4: Chuyên cần

**Files:**
- Create: `src/server/services/attendance-report.service.ts`, router `attendanceReport.month / schoolYear`
- Create: `src/app/(app)/attendance/page.tsx`, `src/components/attendance-report/*`
- `ReportPeriodPicker` thêm chế độ "Năm học" (prop bật / tắt)
- `nav-items` (Chuyên cần: "Thêm" khi `hasPerStudent`, tab chính khi chỉ `perSession`)
- `FEATURE_PLAN.attendanceMonth: plus`, `attendanceYear: pro`
- Test

- [ ] **RED:**
  - tỉ lệ = (present + late) / đã điểm danh
  - huỷ / pending không tính
  - HS đã xoá vẫn có ở tháng cũ **[RF 4]**
  - năm học 2026–2027 gồm T9/2026 → T5/2027 **[RF 5]**
  - Standard → FORBIDDEN
  - Plus gọi `schoolYear` → FORBIDDEN
  - lọc nơi / lớp
- [ ] code → GREEN → ảnh 09a, 09b → Commit `[AN] Màn Chuyên cần`

### Task 5: Thu nhập 12 tháng + Báo cáo lọc nơi học

**Files:**
- `income.last12` (học phí đã thu từ `monthlyTuition.paidAmount` + `PlacePayment` theo tháng)
- `IncomeTab` thẻ biểu đồ (dùng lại BarChart admin Doanh thu)
- `FEATURE_PLAN.income12m: pro`
- `report.monthlySummary` / dữ liệu Báo cáo nhận `placeId?`; `reports/page.tsx` Bộ lọc Nơi học
- Test

- [ ] **RED:**
  - 12 phần tử đúng thứ tự, số khớp
  - Plus → FORBIDDEN
  - Báo cáo lọc nơi chỉ tính HS nơi đó
- [ ] code → GREEN → ảnh 10 → Commit `[AN] Thu nhập 12 tháng và Báo cáo lọc nơi học`

### Task 6: Phát hành 0.22.0

- [ ] version 0.22.0 + "Có gì mới".
- [ ] full vitest + full e2e + guide-shots.
- [ ] Commit `[AN] Phát hành 0.22.0`. Báo cáo `bao-cao-AN.md`. `DONE AN`. Không merge.
