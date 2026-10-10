# AM — Bảng công + Thu nhập + Đã nhận tiền: Implementation Plan

> **For agentic workers:** superpowers:executing-plans. Test trước → code → test liên quan → commit.

**Goal:**
- Nơi dạy tính theo ca/giờ có Bảng công (ca, giờ), Thu nhập dự kiến khi có đơn giá, và Đã nhận tiền.
- Tổng quan có thẻ Thu nhập / Giờ dạy và nhóm "Nơi dạy còn thiếu tiền".

**Architecture:**
- Bảng `place_rate_changes` + `place_payments`.
- Hàm thuần `timesheet.service.ts` tính ca/giờ/tiền.
- Router `timesheet`, `income`, `placeRate`, `placePayment`.
- Route `/timesheet` có 2 tab.

**Spec:** `docs/superpowers/specs/2026-10-11-am-bang-cong-thu-nhap-design.md`. Mẫu `.superpowers/mockups/aj/` 04, 07a, 08, 10, 10s.

**Nhánh:** `feat/am-bang-cong` từ `main` sau khi AL đã merge.

## Global Constraints

- Không có đơn giá → không hiện tiền cho nơi đó. Không bắt buộc nhập.
- Ca đã dạy = không huỷ và ngày ≤ hôm nay (VN). Ca bù tính công. Ca huỷ không tính.
- Giờ = phút / 60, 2 chữ số. Đơn giá theo tháng (fromKey), không theo ngày.
- Ảnh/Excel Bảng công mặc định **không** kèm tiền.
- **Gói:**
  - Bảng công: Plus.
  - Xem thu nhập dự kiến: Standard.
  - Ghi nhận đã nhận + lịch sử: Plus.
  - Nhóm cảnh báo thiếu tiền: Pro.
- Version **0.21.0**. Commit `[AM] ...`. Migration chỉ DB test. Khoá test. Mobile-first. vi + en.

## Review Focus

1. Ca 23:30–00:30 hoặc giờ kết thúc ≤ giờ bắt đầu (dữ liệu lạ): giờ không âm (kẹp 0) và không làm sập trang.
2. Tháng đổi đơn giá: tháng trước dùng giá cũ, tháng sau giá mới; sửa "áp dụng từ" về tháng trước thì tháng đó đổi theo.
3. Xoá một lần nhận: trạng thái và nhóm cảnh báo cập nhật đúng.
4. User có `per_session` nhưng không có `per_student`: thẻ Thu nhập chỉ có dòng "Nơi dạy", tab bar mobile có Bảng công.
5. Nơi dạy bị xoá mềm: không hiện trong Bảng công/Thu nhập tháng mới, nhưng tháng cũ có ca của nơi đó vẫn tính đúng ở "Tất cả nơi".

---

### Task 1: Schema + hàm tính thuần

**Files:**
- `prisma/schema.prisma` (PlaceRateChange, PlacePayment, quan hệ TeachingPlace)
- migration `<ts>_am_place_rates_payments`
- `src/server/crypto/prisma-encryption.ts`: `ENCRYPTED_FIELDS` thêm `PlacePayment: ["note"]`
- Create: `src/server/services/timesheet.service.ts`
- Test: `tests/unit/server/timesheet.test.ts`

**Produces:**
- `sessionHours(start: Date, end: Date): number`
- `classifySession(s, todayKey): "done" | "upcoming" | "cancelled"`
- `resolveRate(changes, key): { unit: "session" | "hour"; amount: number } | null`
- `computeIncome({ doneCount, doneHours, rate }): number | null`
- `incomeStatus(expected: number | null, received: number): "none" | "unpaid" | "partial" | "paid"`

- [ ] **Step 1: Unit RED:**
  - 90 phút = 1.5
  - ranh giới hôm nay
  - cancelled
  - không rate → null
  - theo giờ round
  - nhận dư → "paid" + phần dư tính ở UI
  - **[RF 1]** end ≤ start → 0
- [ ] **Step 2:** schema + migration (áp DB test) + hàm → GREEN.
- [ ] **Step 3: Commit** `[AM] Bảng đơn giá, tiền đã nhận và hàm tính công`

### Task 2: Router timesheet / income / placeRate / placePayment

**Files:**
- `src/server/trpc/routers/timesheet.ts` (gồm cả income, hoặc file riêng; theo cách tổ chức router hiện có)
- `src/server/services/timesheet.service.ts` (thêm phần đọc DB)
- `place.ts` router: `rate.set`, `rate.history`
- `FEATURE_PLAN` thêm `timesheet: plus`, `placePayments: plus`
- Test: `tests/integration/am-timesheet.test.ts`

**Produces:**
- `timesheet.month({ placeId?: number, year, month })` trả về:
  - `{ place?, stats: { doneCount, doneHours, makeupCount, cancelledCount, cancelledHours, scheduledCount }, sessions: [...], unassignedCount }`
  - `sessions` mỗi phần tử: `{ id, date, start, end, hours, subject, presentCount, totalCount, kind, isMakeup, cancelReason? }`
- `income.month({ year, month })` → `[{ placeId, name, color, unit, amount, doneCount, doneHours, expected, received, status }]`, chỉ nơi `per_session` có rate.
- `income.detail({ placeId, year, month })` → diễn giải theo từng mức giá + `payments`.
- `placeRate.set({ placeId, unit, amount, fromYear, fromMonth })`, `placeRate.history({ placeId })`.
- `placePayment.create({ placeId, year, month, amount, receivedAt, note? })`, `placePayment.delete({ id })`.

- [ ] **Step 1: Integration RED:**
  - dữ liệu 2 ca đã qua (1,5 giờ) + 1 ca mai + 1 ca huỷ ở nơi theo giờ 185k → done 2 / 3 giờ / expected 555k
  - đổi giá từ tháng sau **[RF 2]**
  - ghi nhận 500k → partial; xoá → unpaid **[RF 3]**
  - nơi user khác → NOT_FOUND
  - Standard gọi `timesheet.month` / `placePayment.create` → FORBIDDEN; `income.month` thì được
  - nơi xoá mềm: tháng cũ vẫn có trong "Tất cả" **[RF 5]**
- [ ] **Step 2:** code → GREEN.
- [ ] **Step 3: Commit** `[AM] API bảng công, thu nhập, đơn giá, đã nhận`

### Task 3: Trang /timesheet (Bảng công + Thu nhập)

**Files:**
- Create: `src/app/(app)/timesheet/page.tsx`
- Create: `src/components/timesheet/TimesheetTab.tsx`, `IncomeTab.tsx`, `IncomeDetailSheet.tsx`, `PlacePaymentDialog.tsx`, `TimesheetExport.tsx` (Excel + ảnh, công tắc "Kèm số tiền")
- Modify: `nav-items.ts` (Bảng công `requires: "perSession"`, icon `ClipboardList`), BottomTabBar (thay Báo cáo khi `!hasPerStudent`) **[RF 4]**
- Test: unit 2 tab + dialog; e2e

- [ ] **Step 1: Unit RED:**
  - TimesheetTab render 4 StatCard đúng số
  - nhãn ca bù/huỷ
  - dòng "X ca chưa gắn nơi dạy" khi `unassignedCount > 0`
  - IncomeTab: không có nơi có rate → empty state + nút
  - PlacePaymentDialog: mặc định = còn thiếu
  - Excel mặc định không có cột tiền
- [ ] **Step 2:** code (dựng theo trang Báo cáo / Học phí / TuitionDetailSheet / PaymentFormDialog như spec) → GREEN.
- [ ] **Step 3: e2e** `tests/e2e/am-bang-cong.spec.ts`: theo kịch bản spec §6.
- [ ] **Step 4:** ảnh 08, 10, 10s ở 375/1280, tự xem.
- [ ] **Step 5: Commit** `[AM] Trang Bảng công và Thu nhập`

### Task 4: Đơn giá trong form Nơi dạy

**Files:** `PlaceFormDialog.tsx`, `PlaceList.tsx` (dòng phụ có đơn giá, link "Lịch sử đơn giá"), test unit.

- [ ] **Step 1: RED:**
  - Form nơi `per_session` có khối Đơn giá; nơi `per_student` không có.
  - Nơi có ca thì hiện "Áp dụng từ tháng".
  - Lưu gọi `placeRate.set` đúng tháng.
- [ ] **Step 2:** code → GREEN. **Step 3:** ảnh 07a, tự xem.
- [ ] **Step 4: Commit** `[AM] Đơn giá trong form Nơi dạy`

### Task 5: Tổng quan

**Files:**
- `report.service.ts` `getDashboardStats` thêm `placeIncomeMonth`, `placeReceivedMonth`, `teachingHoursMonth`
- `getDashboardAlerts` thêm nhóm `placeShortfall` (tháng trước)
- `dashboard/page.tsx`, `DashboardAlerts.tsx`
- Test integration + unit

- [ ] **Step 1: RED:**
  - thu nhập = học phí đã dạy + nơi
  - user chỉ `per_student` không có thẻ Thu nhập
  - thẻ Giờ dạy khi `hasPerSession`
  - nhóm thiếu tiền chỉ Pro, đúng số còn thiếu tháng trước
- [ ] **Step 2:** code → GREEN. **Step 3:** ảnh 04 (hỗn hợp) + 04b, tự xem.
- [ ] **Step 4: Commit** `[AM] Tổng quan có thu nhập nơi dạy và giờ dạy`

### Task 6: Phát hành 0.21.0

- [ ] version 0.21.0 + "Có gì mới" (Bảng công, Thu nhập theo nơi dạy, Đã nhận tiền).
- [ ] full vitest + full e2e + guide-shots nếu có màn đổi.
- [ ] Commit `[AM] Phát hành 0.21.0`. Báo cáo `bao-cao-AM.md`. `DONE AM`. Không merge.
