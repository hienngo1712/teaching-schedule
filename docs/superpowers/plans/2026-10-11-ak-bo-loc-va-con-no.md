# AK — Gọn thanh lọc + thẻ "Còn nợ" tách tháng: Implementation Plan

> **For agentic workers:** dùng superpowers:executing-plans, làm task theo thứ tự, RED → GREEN. Bước có `- [ ]`.

**Goal:**
- Thẻ "Còn nợ" ở Tổng quan ghi riêng nợ tháng này và nợ các tháng trước.
- Mọi thanh lọc dùng chung 1 pattern gọn: 1 hàng ở 1280px, tối đa 2 hàng ở 375px.

**Architecture:**
- Phần Còn nợ: thêm 1 số vào `getMonthlyOutstanding` → `getDashboardStats` → thẻ Tổng quan.
- Phần thanh lọc: nâng `FilterBar` (thêm popover Bộ lọc trên laptop, hàng chip, menu ⋯, ô ngoài + kỳ). Áp cho Học phí, Học sinh, Báo cáo, Lịch (bỏ CalendarToolbar tự vẽ), Thùng rác.

**Tech Stack:** Next.js 15, tRPC v11, shadcn/ui (Popover, Sheet, DropdownMenu), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-ak-bo-loc-va-con-no-design.md`.
Đọc kèm: `.superpowers/claude-otd/bao-cao-AK.md` và mẫu `.superpowers/mockups/ak-bo-loc/` (00-pattern, 01–03 trước/sau).

**Bên code:** Claude-OTD, worktree `D:\APINODEJS\student-managerment-otd`, nhánh `feat/ak-bo-loc` từ `main` mới nhất.

## Global Constraints

- Không migration. Không đổi input/output API lọc. Chỉ thêm trường `unpaidPrevMonths` vào `report.dashboard`.
- Lọc ra đúng kết quả như trước, chỉ đổi chỗ đặt.
- Không nhớ bộ lọc giữa các lần vào trang (giữ như hiện nay).
- Chọn trong Bộ lọc là **áp dụng ngay**.
- Học phí giữ **Trạng thái** ngoài thanh.
- Lịch: **Tạo ca dạy ▾** gồm Lịch lặp + Chép lịch tháng.
- Xuất Excel vào **⋯**, riêng **Báo cáo giữ ngoài**.
- Mobile-first: nút ≥ 44px trên điện thoại (`h-11 md:h-10`), không cuộn ngang, không chữ gãy dòng.
- Giữ khoá gói (LockBadge, `useFeatureGate().guard`) y như cũ.
- Chữ mới có đủ cả `vi.json` và `en.json`. Ghi chú code tiếng Việt, 1–2 dòng.
- Version **0.19.0**. Commit 1 dòng, không body, không Co-Authored-By.
- Khoá test `.superpowers/test-lock.txt` cho mọi lần chạy vitest/playwright. e2e cần RAM ≥ 3000 MB.

## Review Focus

1. Có lọc ở Bộ lọc rồi thu nhỏ cửa sổ từ laptop xuống điện thoại: số "(n)" và chip vẫn đúng, không render `filters` 2 lần cùng lúc (popover và sheet không cùng mở).
2. Báo cáo chế độ "Khoảng" ở 360px: nhãn kỳ rút gọn, không tràn ngang.
3. Lịch: Standard bấm "Chép lịch tháng" trong menu ▾ vẫn mở UpgradeDialog (gate), không mở hộp chép.
4. Thùng rác: "Dọn tab này" / "Dọn sạch" trong ⋯ vẫn hỏi xác nhận như cũ, và tab "N" trong menu đúng số.
5. Thẻ Còn nợ khi HS có dư trả trước (`previousBalance < 0`): "Các tháng trước" = 0, không âm.

Mỗi dòng có test ở task sở hữu (đánh dấu **[RF n]**).

---

### Task 1: Thẻ "Còn nợ" tách tháng

**Files:**
- Modify: `src/server/services/tuition.service.ts` (`getMonthlyOutstanding`), `src/server/services/report.service.ts` (`getDashboardStats`)
- Modify: `src/app/(app)/dashboard/page.tsx`, `src/language/vi.json`, `src/language/en.json`
- Create: `tests/integration/dashboard-unpaid-split.test.ts`
- Modify: `tests/unit/components/DashboardPage.test.tsx`

**Interfaces:**
- Produces:
  - `getMonthlyOutstanding(...) → { totalOutstanding: number; previousOutstanding: number }`
  - `report.dashboard` thêm `unpaidPrevMonths: number`

- [ ] **Step 1: Viết test integration (RED)** `tests/integration/dashboard-unpaid-split.test.ts`:

```ts
import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

function months() {
  const v = new Date(Date.now() + 7 * 3600_000)
  const y = v.getUTCFullYear()
  const m = v.getUTCMonth() + 1
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const d = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-10`
  return { y, m, py, pm, day: d(y, m), pday: d(py, pm) }
}

describe("Tổng quan: Còn nợ tách tháng này / các tháng trước", () => {
  beforeEach(clean)
  afterEach(() => vi.useRealTimers())

  async function setup() {
    const t = months()
    vi.setSystemTime(new Date(Date.UTC(t.y, t.m - 1, 15, 12, 0, 0)))
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Nợ", grade: 6, tuitionFee: 200_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    for (const date of [t.pday, t.day]) {
      const s = await caller.session.create({ sessionDate: date, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id] })
      await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    }
    return { t, caller, st }
  }

  it("chưa thu gì: 200k tháng trước + 200k tháng này", async () => {
    const { caller } = await setup()
    expect(await caller.report.dashboard()).toMatchObject({ totalUnpaidMonth: 400_000, unpaidPrevMonths: 200_000 })
  })

  it("thu 300k trong tháng này: trả nợ cũ trước, còn 100k của tháng này", async () => {
    const { t, caller, st } = await setup()
    await caller.payment.create({ studentId: st.id, year: t.y, month: t.m, amount: 300_000, paidAt: t.day, method: "cash" })
    expect(await caller.report.dashboard()).toMatchObject({ totalUnpaidMonth: 100_000, unpaidPrevMonths: 0 })
  })

  // [RF 5] dư trả trước tháng cũ không làm "các tháng trước" âm
  it("tháng trước trả dư: nợ cũ 0, không âm", async () => {
    const { t, caller, st } = await setup()
    await caller.payment.create({ studentId: st.id, year: t.py, month: t.pm, amount: 300_000, paidAt: t.pday, method: "cash" })
    expect(await caller.report.dashboard()).toMatchObject({ totalUnpaidMonth: 100_000, unpaidPrevMonths: 0 })
  })
})
```

- [ ] **Step 2: Chạy:** `npx cross-env NODE_ENV=test vitest run tests/integration/dashboard-unpaid-split.test.ts`
  - Expected: FAIL, vì thiếu `unpaidPrevMonths` (`totalUnpaidMonth` khớp).
  - Nếu test thứ 3 lệch tổng (app không cho trả dư như vậy): ghi Ruling. Chỉnh số tiền sao cho vẫn có `previousBalance < 0`, không bỏ test.

- [ ] **Step 3: Sửa `getMonthlyOutstanding`** (`tuition.service.ts`):
  - Kiểu trả về: `Promise<{ totalOutstanding: number; previousOutstanding: number }>`
  - Vòng lặp:

```ts
  let totalOutstanding = 0
  let previousOutstanding = 0
  for (const it of items) {
    // isFullPaid = tất toán tháng cuối kỳ → không còn nợ dương (khớp carry-over)
    const owed = it.isFullPaid ? 0 : Math.max(0, it.totalAmountDue - it.paidAmount)
    totalOutstanding += owed
    // Tiền thu trừ nợ cũ trước (FIFO như spec Y), phần còn lại mới là nợ tháng này.
    previousOutstanding += Math.min(owed, Math.max(0, it.previousBalance - it.paidAmount))
  }

  return { totalOutstanding, previousOutstanding }
```

  - Trong `getDashboardStats` (`report.service.ts`), object trả về thêm `unpaidPrevMonths: outstanding.previousOutstanding,` ngay sau `totalUnpaidMonth`.

- [ ] **Step 4: Chạy lại** → PASS 3/3.

- [ ] **Step 5: Test unit (RED)** trong `tests/unit/components/DashboardPage.test.tsx`:
  - Thêm `unpaidPrevMonths: 150000,` vào `stats`.
  - Thêm test:

```tsx
  it("Còn nợ ghi riêng nợ tháng này và nợ các tháng trước", () => {
    renderPage()
    const card = valueOf("Còn nợ").closest('[data-testid="stat-card"]') as HTMLElement
    expect(card.textContent).toMatch(/Tháng này\s*250\.000\s*đ/)
    expect(card.textContent).toMatch(/Các tháng trước\s*150\.000\s*đ/)
  })
```

  - Chạy `npx cross-env NODE_ENV=test vitest run tests/unit/components/DashboardPage.test.tsx` → FAIL đúng test mới.

- [ ] **Step 6: Sửa UI.**
  - `dashboard/page.tsx`, thẻ "Còn nợ": `hint={t("hint_outstanding")}` thay bằng:

```tsx
          hint={
            stats && (
              <>
                {/* Thẻ 2 cột ở 375px hẹp: xuống dòng giữa nhãn và số, không gãy số tiền. */}
                <p>{t("unpaid_this_month_part")} <span className="whitespace-nowrap">{money(stats.totalUnpaidMonth - stats.unpaidPrevMonths)}</span></p>
                <p>{t("unpaid_prev_months_part")} <span className="whitespace-nowrap">{money(stats.unpaidPrevMonths)}</span></p>
              </>
            )
          }
```

  - `vi.json`: thêm sau `hint_outstanding`:
    - `"unpaid_this_month_part": "Tháng này"`
    - `"unpaid_prev_months_part": "Các tháng trước"`
  - `en.json`: `"This month"` / `"Earlier months"`.
  - Giữ khoá `hint_outstanding`, vì trang Báo cáo còn dùng.

- [ ] **Step 7:** chạy 2 file test trên + `tests/integration/report*.test.ts tests/integration/group-b-financial.test.ts` → PASS. Chạy `npx tsc --noEmit -p .` → sạch.
- [ ] **Step 8: Commit:** `[AK] Thẻ Còn nợ tách tháng này và các tháng trước`

---

### Task 2: Nâng `FilterBar`

**Files:**
- Modify: `src/components/common/FilterBar.tsx`
- Create: `tests/unit/components/FilterBar.test.tsx` (nếu đã có file test FilterBar thì thêm vào đó)
- Modify: `src/language/vi.json`, `en.json`. Khoá mới:
  - `filter_clear_all`: "Xoá lọc" / "Clear filters"
  - `filter_done`: "Xong" / "Done"
  - `more_actions`: "Thêm thao tác" / "More actions"
  - Dùng lại khoá `filter` sẵn có.

**Interfaces (Produces, các task sau dùng đúng tên này):**

```ts
export type FilterChip = { key: string; label: string; onRemove: () => void }
export type MoreAction = { key: string; label: string; icon?: React.ReactNode; onSelect: () => void; locked?: React.ReactNode }
type Props = {
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  primaryFilter?: React.ReactNode   // tối đa 1 ô hay dùng, luôn ngoài thanh
  filters?: React.ReactNode         // vào nút "Bộ lọc"
  activeChips?: FilterChip[]        // n = activeChips.length
  onClearAll?: () => void
  period?: React.ReactNode          // bước tháng / kỳ báo cáo
  actions?: React.ReactNode         // nút ngoài (chỉ ngoại lệ: Xuất Excel ở Báo cáo)
  moreActions?: MoreAction[]        // menu ⋯
  activeCount?: number              // CŨ: giữ để không vỡ chỗ chưa chuyển; ưu tiên activeChips nếu có
}
```

**Hành vi:**
- **Thanh:** `flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 md:p-4`. Thứ tự từ trái: search (`flex-1 min-w-0 md:max-w-72`) · primaryFilter · nút Bộ lọc · period · actions · ⋯ (đẩy phải bằng `md:ml-auto` cho cụm period/actions/⋯).
- **Nút "Bộ lọc":**
  - Có icon `SlidersHorizontal`, nhãn `t("filter")` + ` (n)` khi n > 0, `h-11 md:h-10`.
  - **md trở lên:** `Popover` (`w-80`, `align="end"`) chứa `filters` dạng cột (`flex flex-col gap-3`, ép Select `w-full`). Dưới cùng có nút "Xoá lọc" (ẩn khi n = 0).
  - **Dưới md:** `Sheet side="bottom"` giữ cấu trúc hiện có. Thêm hàng dưới: "Xoá lọc" (khi n > 0) + nút chính "Xong" đóng sheet.
  - Chỉ mount 1 trong 2, dùng `useMediaQuery("(min-width: 768px)")` (đã có ở `src/hooks/useMediaQuery`). Như vậy `filters` không render 2 lần **[RF 1]**.
- **Hàng chip:**
  - Khi `activeChips.length > 0`, hiện dưới thanh (trong cùng khung, `mt-2 flex flex-wrap gap-2`).
  - Mỗi chip là `Badge` hoặc nút outline nhỏ, có `aria-label="Bỏ lọc <label>"`, nút ✕ gọi `onRemove`. Vùng chạm ≥ 44px trên điện thoại: dùng `min-h-11 md:min-h-8`.
  - Cuối hàng có nút ghost "Xoá lọc" gọi `onClearAll`.
- **⋯:**
  - `DropdownMenu`, trigger là nút icon `MoreHorizontal`, `size-11 md:size-10`, `aria-label={t("more_actions")}`.
  - Mỗi item gọi `onSelect`. Có `locked` thì hiện LockBadge cạnh nhãn (gate do nơi gọi xử lý trong `onSelect`).
- Không truyền prop mới nào thì giữ hành vi cũ. Các chỗ cũ chưa chuyển vẫn chạy.

- [ ] **Step 1: Viết test unit (RED)** `FilterBar.test.tsx` (jsdom, bọc `LanguageProvider forcedLanguage="vi"`, mock `useMediaQuery` trả true/false theo từng test):
  1. Laptop: bấm "Bộ lọc (2)" (truyền 2 chip) → thấy nội dung `filters` trong popover. Bấm "Xoá lọc" → `onClearAll` được gọi 1 lần.
  2. Điện thoại: bấm "Bộ lọc" → sheet mở có nút "Xong". Bấm "Xong" → nội dung `filters` biến mất.
  3. Chip: render 2 chip, bấm nút `Bỏ lọc Lớp 5` → `onRemove` của chip đó được gọi. Không có chip → không có hàng chip.
  4. ⋯: bấm "Thêm thao tác" → bấm "Xuất Excel" → `onSelect` được gọi.
  5. Tương thích: chỉ truyền `search` + `filters` + `activeCount={1}` như cũ → nút ghi "Bộ lọc (1)".
  6. **[RF 1]** Laptop, popover mở rồi đổi `useMediaQuery` sang false + rerender: nội dung `filters` xuất hiện tối đa 1 lần (`getAllByText(...).length <= 1`).

  Lưu ý: Radix Popover/Dropdown trong jsdom cần `pointer events`. Theo cách các test khác trong repo đang mở Select/Dropdown (tìm `userEvent.setup` / `hasPointerCapture`).
- [ ] **Step 2: Chạy** `npx cross-env NODE_ENV=test vitest run tests/unit/components/FilterBar.test.tsx` → FAIL.
- [ ] **Step 3:** viết lại `FilterBar.tsx` theo hành vi trên. Nếu repo chưa có `components/ui/popover` hay `dropdown-menu` thì dùng cái đã có (PayosBell dùng Popover, nên Popover chắc chắn có).
- [ ] **Step 4:** chạy lại → PASS. Chạy `tests/unit` các trang dùng FilterBar (tuition, reports, StudentList) → vẫn PASS (chưa đổi trang).
- [ ] **Step 5: Commit:** `[AK] FilterBar thêm Bộ lọc popover, chip, menu thêm thao tác`

---

### Task 3: Học phí + Học sinh dùng FilterBar mới

**Files:**
- Modify: `src/app/(app)/tuition/page.tsx` (khối `<FilterBar` ~dòng 225)
- Modify: `src/components/students/StudentList.tsx` (khối `<FilterBar` ~dòng 223), có thể cả trang `src/app/(app)/students/page.tsx` nếu PageHeader nằm ở đó
- Test: unit sẵn có của 2 trang + e2e liên quan (tìm `tests/e2e/*tuition*`, `*student*`)

**Consumes:** `FilterBar` props của Task 2.

**Học phí:**
- `search` như cũ.
- `primaryFilter` = Select **Trạng thái** (giữ `w-[170px]`, điện thoại `w-full` hoặc `flex-1`).
- `filters` = Select Phiếu báo + Select Lớp.
- `period` = khối bước tháng (giữ `data-tour="tuition-month"`).
- `activeChips`: mỗi Select trong Bộ lọc đang khác "all" thì có 1 chip, nhãn là chữ của mục đang chọn, ví dụ "Lớp 5", "Chưa gửi phiếu". `onRemove` đặt về "all".
- `onClearAll` đặt Phiếu báo + Lớp về all. **Không** đụng Trạng thái và tìm.
- Bỏ `activeCount`.

**Học sinh:**
- `filters` = Lớp + Trạng thái. Chip tương tự.
- **Thêm học sinh ▾** (`AddStudentSplitButton`) chuyển lên PageHeader của trang Học sinh (prop `actions`/children của PageHeader, xem `src/components/common/PageHeader.tsx`). Giữ nguyên `onAdd`, `onImport`, `addLockPlan`.
- `UpgradeAllClassesButton` → mục ⋯ "Nâng lớp hàng loạt". Nút này đang tự mở hộp riêng: tách phần mở hộp ra để `onSelect` mở được, giữ hộp xác nhận cũ.
  - Nếu tách không gọn: ghi Ruling. Có thể để `UpgradeAllClassesButton` render dạng `DropdownMenuItem` qua prop `asMenuItem`.

- [ ] **Step 1 (RED):** thêm test unit hoặc e2e cho từng trang:
  - (a) Học phí: chọn Lớp 5 trong Bộ lọc → hiện chip "Lớp 5", danh sách lọc đúng. Bấm ✕ trên chip → bỏ lọc. Trạng thái vẫn ở ngoài thanh.
  - (b) Học sinh: nút "Thêm học sinh" nằm trong header trang. "Nâng lớp hàng loạt" nằm trong ⋯ và mở được hộp xác nhận cũ.

  Chạy → FAIL.
- [ ] **Step 2:** sửa 2 trang. **Step 3:** test trang + e2e liên quan → PASS. Test cũ đổi kỳ vọng chỉ khi đúng hành vi mới (ghi Ruling).
- [ ] **Step 4: Ảnh** 375 + 1280 trước/sau cả 2 trang vào `.superpowers/mockups/ak-bo-loc/that/`. Tự xem: 1280 một hàng, 375 ≤ 2 hàng, không cuộn ngang.
- [ ] **Step 5: Commit:** `[AK] Học phí và Học sinh dùng thanh lọc mới`

---

### Task 4: Báo cáo dùng FilterBar mới

**Files:**
- Modify: `src/app/(app)/reports/page.tsx` (khối `<FilterBar` ~dòng 139)
- Modify: `src/components/reports/ReportPeriodPicker.tsx` (nhãn khoảng rút gọn)
- Có thể: `src/components/reports/ExportExcelButton.tsx`

**Báo cáo:**
- `filters` = Lớp (hoặc nút khoá `multiGate` như cũ) + Học sinh.
- `period` = `ReportPeriodPicker`.
- `actions` = `ExportExcelButton`: ngoại lệ, giữ ngoài. Điện thoại dùng `iconOnly` đã có, kèm `aria-label`.
- Chip cho Lớp / Học sinh khi đang chọn.
- `ReportPeriodPicker`: nhãn chế độ Khoảng rút gọn dạng `T1–T3/2026` (khác năm thì `T11/2025–T2/2026`). Trigger `min-w-0 max-w-full truncate`, bỏ `min-w-[200px]` gây tràn **[RF 2]**.

- [ ] **Step 1 (RED):**
  - Unit `ReportPeriodPicker`: khoảng 1–3/2026 → nhãn `T1–T3/2026`; khoảng 11/2025–2/2026 → `T11/2025–T2/2026`.
  - Unit/e2e Báo cáo: lọc lớp qua Bộ lọc ra đúng số liệu như trước, có chip.
- [ ] **Step 2:** sửa. **Step 3:** PASS + test Báo cáo cũ.
- [ ] **Step 4: Ảnh** 360, 375 (chế độ Khoảng) và 1280, tự xem không tràn **[RF 2]**.
- [ ] **Step 5: Commit:** `[AK] Báo cáo dùng thanh lọc mới, nhãn khoảng rút gọn`

---

### Task 5: Lịch: CalendarToolbar sang FilterBar + Tạo ca dạy ▾

**Files:**
- Modify: `src/components/calendar/CalendarToolbar.tsx`: viết lại bên trong bằng `FilterBar`, giữ tên export và props để trang không vỡ, **hoặc** thay ở trang. Chọn cách ít đụng nhất, ghi Ruling.
- Create: `src/components/calendar/CreateSessionSplitButton.tsx`, mô phỏng `src/components/students/AddStudentSplitButton.tsx`
- Modify: trang Lịch `src/app/(app)/calendar/page.tsx`, đưa nút lên PageHeader
- Test: unit/e2e Lịch sẵn có (tìm `copy-month-button`, `session-add`, `bulk`)

**Lịch:**
- `search` = ô tìm HS (giữ debounce `useDebouncedSearch`, giữ nút ✕ xoá chữ).
- `filters` = Select Lớp.
- `activeChips` = chip "Lớp N" khi chọn lớp. Ô tìm có chữ thì có thêm chip `"<chữ>"`.
- `onClearAll` = `resetFilters`. **Bỏ** nút "Xóa bộ lọc" cũ.
- `period` = bước tháng (`prevMonth`/`nextMonth`/`monthLabel`).
- `moreActions` = [Xuất Excel]. `ExportExcelButton` đang là nút tự xuất: tách hàm xuất hoặc thêm prop render dạng menu item. Ghi Ruling nếu cần.
- **CreateSessionSplitButton** ở PageHeader:
  - Nút chính "Tạo ca dạy" (`onCreateClick`) giữ `data-tour="session-add"`.
  - ▾ mở menu gồm:
    - "Lịch lặp" (`onBulkCreateClick`)
    - "Chép lịch tháng" (`copyGate.guard(onCopyMonthClick)`, hiện LockBadge khi khoá, giữ `data-testid="copy-month-button"` trên item)
  - **[RF 3]**: Standard bấm vẫn mở UpgradeDialog.
- Tour (`src/lib/tours.ts`) có bước trỏ `session-add` hoặc nút trong toolbar: kiểm selector còn đúng. Nút nào chuyển vào menu thì cập nhật bước tour (ghi Ruling).

- [ ] **Step 1 (RED):**
  - (a) Bấm ▾ cạnh "Tạo ca dạy" → thấy "Lịch lặp" và "Chép lịch tháng".
  - (b) Tài khoản Standard bấm "Chép lịch tháng" → mở hộp nâng gói **[RF 3]**.
  - (c) Chọn Lớp 5 → chip "Lớp 5". Bấm "Xoá lọc" → lịch về tất cả.
  - (d) ⋯ → Xuất Excel gọi xuất.
- [ ] **Step 2:** sửa. **Step 3:** PASS + e2e Lịch cũ + test tour.
- [ ] **Step 4: Ảnh** 375 + 1280 trước/sau, cả lúc đang lọc. Tự xem: 1280 một hàng, 375 ≤ 2 hàng.
- [ ] **Step 5: Commit:** `[AK] Lịch dùng thanh lọc mới, Tạo ca dạy có menu`

---

### Task 6: Thùng rác

**Files:**
- Modify: `src/components/trash/TrashList.tsx` (và trang `src/app/(app)/trash/page.tsx` nếu nút "Dọn sạch" nằm ở PageHeader)

**Thùng rác:**
- 4 tab: điện thoại 1 hàng `flex overflow-x-auto` (tab `shrink-0 whitespace-nowrap`, không bóp chữ). Desktop như cũ.
- "Dọn tab này (N)" và "Dọn sạch thùng rác" vào 1 nút ⋯ cạnh hàng tab (DropdownMenu). Bấm vẫn mở **đúng hộp xác nhận cũ**. Số N đúng tab đang chọn. Tab rỗng thì mục bị disable như nút cũ **[RF 4]**.
- Bỏ nút "Dọn sạch" khỏi PageHeader.

- [ ] **Step 1 (RED):** test: mở ⋯ → "Dọn tab này (N)" đúng N → bấm → hộp xác nhận cũ hiện (chưa xoá). Tab rỗng → mục disable.
- [ ] **Step 2–3:** sửa, PASS + test Thùng rác cũ.
- [ ] **Step 4: Ảnh** 375 + 1280 trước/sau, tự xem.
- [ ] **Step 5: Commit:** `[AK] Thùng rác gom nút dọn vào menu, tab cuộn ngang`

---

### Task 7: Phát hành 0.19.0 + kiểm toàn bộ

- [ ] **Step 1:** `package.json` version → `0.19.0`. Thêm mục "Có gì mới" theo cách các bản trước làm (tìm file releases đã sửa ở commit `8079c3f`). Nội dung 2 dòng:
  - "Thanh lọc gọn hơn: lọc ít dùng nằm trong nút Bộ lọc"
  - "Thẻ Còn nợ ghi riêng nợ tháng này và các tháng trước"
- [ ] **Step 2:** full vitest `npx cross-env NODE_ENV=test vitest run` → 100% PASS.
- [ ] **Step 3:** full e2e chia 2 nửa như các lần trước, foreground, mỗi nửa ≤ 10 phút → PASS.
- [ ] **Step 4:** guide-shots nếu ảnh hướng dẫn có các màn đổi (Lịch, Học phí, Học sinh, Báo cáo): chạy lại theo cách AI đã làm + `pnpm guide:docx`. Ghi Ruling nếu bỏ qua.
- [ ] **Step 5: Commit:** `[AK] Phát hành 0.19.0`
- [ ] **Step 6:** báo cáo `.superpowers/claude-otd/bao-cao-AK2.md` gồm:
  - test
  - ảnh trước/sau từng màn (đường dẫn)
  - Ruling
  - câu hỏi

  Ghi `DONE AK` lên kênh. **Không merge, không push.**
