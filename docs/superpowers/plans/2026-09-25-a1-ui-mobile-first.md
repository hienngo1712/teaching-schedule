# A1 — UI mobile-first Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa UI để dùng tốt trên điện thoại (390px), thống nhất cách trình bày giữa 5 màn, làm rõ nhãn số liệu tiền — không đổi logic nghiệp vụ.

**Architecture:** Thêm thanh tab đáy cho mobile (desktop giữ sidebar), tách 4 khối dùng chung (`PageHeader`, `FilterBar`, `ResponsiveList`, `StatCard`) trong `src/components/common/`, rồi chuyển lần lượt từng màn sang dùng chúng. Chỉ 1 thay đổi backend: `report.dashboard` trả thêm `totalPaidMonth`.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, Prisma, Tailwind 3, shadcn/ui, lucide-react, Vitest (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-a1-ui-mobile-first-design.md`

## Global Constraints

- Giữ nhận diện: không đổi màu chủ đạo (indigo/slate), font Geist, thư viện icon lucide-react, shadcn/ui. Không thêm dependency.
- Không đổi URL/route, không đổi logic tính tiền/điểm danh.
- Breakpoint mobile/desktop: `md` (768px). Viewport kiểm thử mobile: 390×844.
- Vùng chạm tối thiểu 44px trên mobile (`h-11`, `size-11`, `min-h-11`).
- Header bảng chữ thường (không `uppercase`). Bo góc `rounded-lg` (bỏ `rounded-2xl`/`rounded-xl` ở chỗ mình sửa).
- Mặc định 20 dòng/trang ở Học sinh, Học phí.
- Chuỗi UI mới không dùng dấu gạch dài `—` / `–`.
- i18n: mọi chuỗi mới có ở cả `src/language/vi.json` và `src/language/en.json`, số key 2 file bằng nhau.
- Ghi chú trong code: tiếng Việt có dấu, 1-2 dòng, chỉ ghi lý do/bẫy.
- **An toàn dữ liệu production (docs/CLAUDE.md, docs/coding-rule.md §6.1):** trước lần chạy test/e2e đầu tiên, xác nhận `DATABASE_URL` trong `.env.test` KHÁC `.env`. **Không chạy `pnpm build`** ở local — script này gồm `prisma migrate deploy` lên DB của `.env` (production). Kiểm tra build bằng `pnpm exec next build`.
- Làm trên nhánh `feat/a1-ui-mobile-first` (không commit thẳng `main`). Commit message kết thúc bằng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```

## Điều chỉnh so với spec (chốt khi đọc code)

Các điểm dưới đây đơn giản hơn spec mà vẫn đạt mục tiêu; Task 0 cập nhật lại spec cho khớp.

1. **Header mobile** hiện lời chào + ngôn ngữ + avatar, **không** hiện tên màn (tên màn đã có ở `PageHeader`, tránh lặp).
2. **"Nâng lớp hàng loạt"** giữ là nút riêng nhưng trên mobile chỉ hiện icon (có `aria-label`), thay vì đưa vào menu ⋯ — nút có trạng thái disabled + dialog xác nhận, nhét vào dropdown phức tạp hơn nhiều. `PageHeader` vì vậy không cần prop `menu`.
3. **Xóa học sinh khỏi ca** giữ nút thùng rác trong hàng (đã có hộp xác nhận), không thêm menu ⋯.
4. **Nút tạo ca** trên mobile hiện đủ chữ "Tạo ca dạy" (bỏ `hidden sm:inline`) thay vì "+ Tạo ca" — giữ nguyên key i18n và selector e2e.
5. **Thanh phân trang** (`DataTablePagination`) đang `fixed bottom-0` → trên mobile phải đẩy lên trên thanh tab.

## Review Focus

1. **Danh sách dài trên mobile bị thanh tab + thanh phân trang che mất dòng cuối** → dòng cuối vẫn cuộn tới và bấm được. Pin: e2e Task 12 cuộn tới thẻ cuối ở Học sinh và kiểm tra đáy thẻ nằm trên thanh tab.
2. **Tên học sinh rất dài** (> 40 ký tự) → không đẩy vỡ thẻ học sinh và hàng điểm danh (bị `truncate`). Pin: e2e Task 12 tạo HS tên dài rồi kiểm tra không tràn ngang ở màn Học sinh và trong dialog điểm danh.
3. **Ca không có học sinh / ngày hôm nay không có ca** → Dashboard hiện "Hôm nay không có ca dạy", không lỗi. Pin: Task 9 bước kiểm tra trạng thái rỗng bằng unit test `filterTodaySessions`.
4. **Số tiền 9 chữ số** (≥ 100.000.000 đ) trên thẻ thống kê 2 cột ở 390px → không gãy dòng. Pin: Task 4 `StatCard` dùng `whitespace-nowrap` + e2e Task 12 kiểm tra `scrollWidth`.
5. **Mở dialog điểm danh khi đang lọc/đổi tháng rồi lưu** → hành vi lưu không đổi (không động vào mutation). Pin: e2e Task 12 điểm danh + lưu trên mobile, kiểm tra toast thành công.

---

## File Structure

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `src/lib/session-label.ts` | Mới | `getSessionLabel()` — nhãn ca (title rỗng → tên môn) |
| `src/lib/today-sessions.ts` | Mới | `filterTodaySessions()` — lọc ca hôm nay, bỏ ca hủy, sắp theo giờ |
| `src/server/services/report.service.ts` | Sửa | `getDashboardStats` thêm `totalPaidMonth` |
| `src/language/vi.json`, `en.json` | Sửa | Đổi nhãn tiền, thêm key mới, xóa key thừa |
| `src/components/layout/nav-items.ts` | Mới | Mảng nav dùng chung sidebar + tab bar |
| `src/components/layout/BottomTabBar.tsx` | Mới | Thanh tab đáy (mobile) |
| `src/components/layout/AppLayout.tsx` | Sửa | Bỏ drawer, gắn tab bar, `100dvh`, padding đáy |
| `src/components/layout/AppHeader.tsx` | Sửa | Bỏ nút ☰, lời chào hiện cả mobile |
| `src/components/layout/AppSidebar.tsx` | Sửa | Dùng `NAV_ITEMS`, bỏ `onNavigate` |
| `src/components/ui/data-table-pagination.tsx` | Sửa | Mobile đặt trên tab bar |
| `src/components/common/PageHeader.tsx` | Mới | Tiêu đề + mô tả + thao tác |
| `src/components/common/FilterBar.tsx` | Mới | Tìm kiếm + bộ lọc (sheet đáy trên mobile) |
| `src/components/common/StatCard.tsx` | Mới | Thẻ số liệu |
| `src/components/common/ResponsiveList.tsx` | Mới | Bảng (desktop) / thẻ (mobile) + loading/rỗng/lỗi |
| `src/components/sessions/AttendancePanel.tsx` | Sửa | Hàng điểm danh dạng grid co giãn, thanh lưu sticky |
| `src/components/sessions/SessionDetailDialog.tsx` | Sửa | Header không chồng nút đóng, bỏ khoảng trắng |
| `src/components/students/StudentList.tsx` | Sửa | PageHeader + FilterBar + ResponsiveList, 20 dòng |
| `src/components/students/UpgradeAllClassesButton.tsx` | Sửa | Mobile chỉ icon |
| `src/app/(app)/students/page.tsx` | Sửa | Bỏ h1 (PageHeader nằm trong StudentList) |
| `src/app/(app)/tuition/page.tsx` | Sửa | PageHeader + FilterBar + ResponsiveList, 20 dòng |
| `src/components/calendar/SessionListItem.tsx` | Mới | Thẻ ca trong danh sách ngày (tách từ MonthCalendar) |
| `src/components/dashboard/TodaySessions.tsx` | Mới | Khối "Ca dạy hôm nay" |
| `src/app/(app)/dashboard/page.tsx` | Sửa | StatCard, "Xem thêm", TodaySessions |
| `src/app/(app)/reports/page.tsx` | Sửa | PageHeader + FilterBar + StatCard + gợi ý chọn HS |
| `src/components/filters/FilterBar.tsx` → `src/components/calendar/CalendarToolbar.tsx` | Đổi tên + sửa | Thanh công cụ Lịch, nút có chữ |
| `src/components/calendar/MonthCalendar.tsx` | Sửa | Dùng CalendarToolbar, SessionListItem, chú thích màu |
| `src/components/calendar/SessionCard.tsx` | Sửa | Dùng `getSessionLabel` |
| `src/app/(app)/calendar/page.tsx` | Sửa | PageHeader |
| `tests/unit/lib/session-label.test.ts` | Mới | |
| `tests/unit/lib/today-sessions.test.ts` | Mới | |
| `tests/unit/components/ResponsiveList.test.tsx` | Mới | |
| `tests/integration/report.test.ts` | Sửa | Test `totalPaidMonth` |
| `tests/e2e/mobile.spec.ts` | Mới | E2E 390×844 |
| `tests/e2e/*.spec.ts` | Sửa nếu gãy | |

---

### Task 0: Chuẩn bị nhánh + cập nhật spec

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-a1-ui-mobile-first-design.md`

- [ ] **Step 1: Tạo nhánh code từ nhánh spec**

```bash
git checkout docs/spec-a1-ui-mobile
git checkout -b feat/a1-ui-mobile-first
```

- [ ] **Step 2: Cập nhật spec theo mục "Điều chỉnh so với spec"**

Sửa trong spec:
- Mục 4.1 `AppHeader.tsx`: thay "mobile hiện tên màn hiện tại + nút ngôn ngữ + avatar" bằng "hiện lời chào (cả mobile) + nút ngôn ngữ + avatar; tên màn nằm ở `PageHeader`".
- Mục 4.2 `PageHeader`: props còn `title`, `description?`, `actions?`. Bỏ `menu?`.
- Mục 5.1: thay dòng "Xóa học sinh khỏi ca: vào menu ⋯ của thẻ" bằng "Xóa học sinh khỏi ca: giữ nút thùng rác cuối hàng (đã có hộp xác nhận)".
- Mục 5.2: thay "'Nâng lớp hàng loạt' vào menu ⋯" bằng "'Nâng lớp hàng loạt' trên mobile chỉ hiện icon (có `aria-label`), desktop hiện chữ".
- Mục 5.6: thay "nút '+' → '+ Tạo ca'" bằng "nút tạo ca hiện đủ chữ 'Tạo ca dạy' trên mobile".
- Mục 4.1 thêm dòng: "`DataTablePagination` (đang `fixed bottom-0`) trên mobile đặt ngay trên tab bar".

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-25-a1-ui-mobile-first-design.md
git commit -m "docs: chỉnh spec A1 theo kết quả đọc code"
```

---

### Task 1: Sửa bug nhãn ca trống (`getSessionLabel`)

**Files:**
- Create: `src/lib/session-label.ts`
- Create: `tests/unit/lib/session-label.test.ts`
- Modify: `src/components/calendar/SessionCard.tsx:16`

**Interfaces:**
- Produces: `getSessionLabel(session: { title: string | null; subject: { name: string } }): string` — dùng ở Task 9 (`SessionListItem`).

- [ ] **Step 1: Viết test fail**

`tests/unit/lib/session-label.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { getSessionLabel } from "@/lib/session-label"

const subject = { name: "Tiếng Anh" }

describe("getSessionLabel", () => {
  it("title rỗng → tên môn", () => {
    expect(getSessionLabel({ title: "", subject })).toBe("Tiếng Anh")
  })

  it("title chỉ có khoảng trắng → tên môn", () => {
    expect(getSessionLabel({ title: "   ", subject })).toBe("Tiếng Anh")
  })

  it("title null → tên môn", () => {
    expect(getSessionLabel({ title: null, subject })).toBe("Tiếng Anh")
  })

  it("có title → dùng title", () => {
    expect(getSessionLabel({ title: "Nhóm nâng cao", subject })).toBe("Nhóm nâng cao")
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm vitest run tests/unit/lib/session-label.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/session-label"`.

- [ ] **Step 3: Viết code**

`src/lib/session-label.ts`:

```ts
// title có thể là "" (form lưu chuỗi rỗng) — `??` không bắt được, phải dùng trim + ||.
export function getSessionLabel(session: {
  title: string | null
  subject: { name: string }
}): string {
  return session.title?.trim() || session.subject.name
}
```

Trong `src/components/calendar/SessionCard.tsx`, thêm import và thay dòng 16:

```ts
import { getSessionLabel } from "@/lib/session-label"
```

```ts
  const label = getSessionLabel(session)
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm vitest run tests/unit/lib/session-label.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-label.ts tests/unit/lib/session-label.test.ts src/components/calendar/SessionCard.tsx
git commit -m "fix(calendar): thẻ ca hiện tên môn khi title rỗng"
```

---

### Task 2: `report.dashboard` trả `totalPaidMonth`

**Files:**
- Modify: `src/server/services/report.service.ts` (hàm `getDashboardStats`, dòng ~213-278)
- Test: `tests/integration/report.test.ts`

**Interfaces:**
- Produces: `RouterOutputs["report"]["dashboard"]["totalPaidMonth"]: number` — dùng ở Task 9.

- [ ] **Step 1: Viết test fail**

Thêm vào cuối `describe("Report Router", ...)` trong `tests/integration/report.test.ts` (thêm import `vnDateParts` ở đầu file):

```ts
import { vnDateParts } from "@/lib/utils"
```

```ts
  it("dashboard.totalPaidMonth khớp monthlySummary.totalPaid của tháng hiện tại", async () => {
    const { year, month } = vnDateParts()
    await caller.tuition.updatePayment({
      studentId: student.id,
      year,
      month,
      paidAmount: 123000,
      isFullPaid: false,
    })

    const [dash, summary] = await Promise.all([
      caller.report.dashboard(),
      caller.report.monthlySummary({ year, month }),
    ])

    expect(dash.totalPaidMonth).toBeGreaterThanOrEqual(123000)
    expect(dash.totalPaidMonth).toBe(summary.totalPaid)
  })
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm vitest run tests/integration/report.test.ts -t "totalPaidMonth"`
Expected: FAIL — `expected undefined to be greater than or equal to 123000`.

- [ ] **Step 3: Viết code**

Trong `getDashboardStats`, thêm query thứ 5 vào `Promise.all` và trả về:

```ts
  const [totalStudents, sessionsToday, sessionsThisMonth, outstanding, paidAgg] = await Promise.all([
    // ... 4 query cũ giữ nguyên ...

    // Tiền đã ghi nhận trong tháng — cùng nguồn monthlyTuition.paidAmount với Báo cáo
    db.monthlyTuition.aggregate({
      where: { student: { userId }, year: vnYear, month: vnMonth },
      _sum: { paidAmount: true },
    }),
  ])
```

Trong object `return`, thêm:

```ts
    totalPaidMonth: paidAgg._sum.paidAmount ?? 0,
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm vitest run tests/integration/report.test.ts`
Expected: PASS toàn bộ file.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/report.service.ts tests/integration/report.test.ts
git commit -m "feat(report): dashboard trả thêm totalPaidMonth"
```

---

### Task 3: Nhãn số liệu + key i18n mới

**Files:**
- Modify: `src/language/vi.json`, `src/language/en.json`

**Interfaces:**
- Produces các key dùng ở Task 4-11: `filter`, `show_more_stats`, `show_less_stats`, `no_sessions_today`, `select_student_hint`, `load_error`, `retry`, `level_mixed`, `main_navigation`, `per_session`, `hint_expected_fees`, `hint_taught_fees`, `hint_collected`, `hint_outstanding`, `hint_not_yet_counted`.

- [ ] **Step 1: Đổi giá trị key cũ**

| Key | vi | en |
|---|---|---|
| `expected_revenue` | `Học phí dự kiến` | `Expected fees` |
| `revenue_this_month` | `Học phí đã dạy` | `Taught fees` |
| `actual_revenue` | `Học phí đã dạy` | `Taught fees` |
| `collected_amount` | `Đã thu` | `Collected` |
| `unpaid_this_month` | `Còn nợ` | `Outstanding` |
| `uncollected_amount` | `Còn nợ` | `Outstanding` |
| `revenue_shortfall` | `Chưa tính:` | `Not yet counted:` |

- [ ] **Step 2: Thêm key mới (cuối file, trước `}`)**

vi.json:

```json
  "filter": "Lọc",
  "show_more_stats": "Xem thêm",
  "show_less_stats": "Thu gọn",
  "no_sessions_today": "Hôm nay không có ca dạy",
  "select_student_hint": "Chọn một học sinh để xem chi tiết",
  "load_error": "Không tải được dữ liệu",
  "retry": "Thử lại",
  "level_mixed": "Hỗn hợp",
  "main_navigation": "Điều hướng chính",
  "per_session": "/buổi",
  "hint_expected_fees": "Tính theo tất cả ca đã xếp trong tháng",
  "hint_taught_fees": "Buổi có mặt và muộn, chưa phải tiền đã nhận",
  "hint_collected": "Tiền đã ghi nhận trong tháng",
  "hint_outstanding": "Cộng dồn cả các tháng trước",
  "hint_not_yet_counted": "Gồm buổi vắng và buổi chưa diễn ra hoặc chưa điểm danh"
```

en.json:

```json
  "filter": "Filter",
  "show_more_stats": "Show more",
  "show_less_stats": "Show less",
  "no_sessions_today": "No sessions today",
  "select_student_hint": "Select a student to see details",
  "load_error": "Could not load data",
  "retry": "Retry",
  "level_mixed": "Mixed",
  "main_navigation": "Main navigation",
  "per_session": "/session",
  "hint_expected_fees": "All sessions scheduled this month",
  "hint_taught_fees": "Present and late sessions, not money received",
  "hint_collected": "Payments recorded this month",
  "hint_outstanding": "Includes previous months",
  "hint_not_yet_counted": "Absent sessions plus sessions not held or not marked yet"
```

(Key thừa `quick_links`, `manage_calendar`, `manage_students`, `open_menu`, `collected_this_month` sẽ xóa ở Task 4 và Task 9 — ngay khi code thôi dùng chúng.)

- [ ] **Step 3: Kiểm tra JSON hợp lệ và parity**

Run:
```bash
node -e "const vi=require('./src/language/vi.json'),en=require('./src/language/en.json');const a=Object.keys(vi),b=Object.keys(en);const d=[...a.filter(k=>!(k in en)),...b.filter(k=>!(k in vi))];console.log(a.length,b.length,d.length?'LỆCH: '+d:'OK')"
```
Expected: `296 296 OK`

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add src/language/vi.json src/language/en.json
git commit -m "chore(i18n): đổi nhãn tiền cho đúng nghĩa, thêm key cho UI mobile"
```

---

### Task 4: Khối dùng chung (`PageHeader`, `FilterBar`, `StatCard`, `ResponsiveList`)

**Files:**
- Create: `src/components/common/PageHeader.tsx`
- Create: `src/components/common/FilterBar.tsx`
- Create: `src/components/common/StatCard.tsx`
- Create: `src/components/common/ResponsiveList.tsx`
- Test: `tests/unit/components/ResponsiveList.test.tsx`

**Interfaces:**
- Produces:
  - `PageHeader({ title: string; description?: string; actions?: React.ReactNode })`
  - `FilterBar({ search?: { value: string; onChange: (v: string) => void; placeholder: string }; filters?: React.ReactNode; activeCount?: number })`
  - `StatCard({ label: string; value?: string | number; hint?: React.ReactNode; icon?: React.ReactNode; loading?: boolean; valueClassName?: string })`
  - `ResponsiveList<T>({ items: T[]; getKey: (item: T) => React.Key; columns: Column<T>[]; renderCard: (item: T, index: number) => React.ReactNode; onRowClick?: (item: T) => void; isLoading: boolean; isError: boolean; onRetry?: () => void; emptyText: React.ReactNode; errorText: string; retryText: string })`
  - `type Column<T> = { header: React.ReactNode; cell: (item: T, index: number) => React.ReactNode; className?: string }`

- [ ] **Step 1: Viết test fail cho `ResponsiveList`**

`tests/unit/components/ResponsiveList.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"

type Row = { id: number; name: string }
const columns: Column<Row>[] = [{ header: "Tên", cell: (r) => r.name }]
const base = {
  getKey: (r: Row) => r.id,
  columns,
  renderCard: (r: Row) => <div>card-{r.name}</div>,
  emptyText: "Trống",
  errorText: "Lỗi tải",
  retryText: "Thử lại",
}

describe("ResponsiveList", () => {
  it("loading → skeleton, không hiện dữ liệu", () => {
    render(<ResponsiveList {...base} items={[]} isLoading isError={false} />)
    expect(screen.getAllByTestId("list-skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText("Trống")).toBeNull()
  })

  it("rỗng → hiện emptyText", () => {
    render(<ResponsiveList {...base} items={[]} isLoading={false} isError={false} />)
    expect(screen.getByText("Trống")).toBeTruthy()
  })

  it("lỗi → hiện errorText và nút thử lại gọi onRetry", () => {
    const onRetry = vi.fn()
    render(<ResponsiveList {...base} items={[]} isLoading={false} isError onRetry={onRetry} />)
    expect(screen.getByText("Lỗi tải")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("có dữ liệu → render cả hàng bảng và thẻ (CSS quyết định cái nào hiện)", () => {
    const onRowClick = vi.fn()
    render(
      <ResponsiveList {...base} items={[{ id: 1, name: "An" }]} isLoading={false} isError={false} onRowClick={onRowClick} />
    )
    expect(screen.getByRole("cell", { name: "An" })).toBeTruthy()
    expect(screen.getByText("card-An")).toBeTruthy()
    fireEvent.click(screen.getByRole("cell", { name: "An" }))
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: "An" })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm vitest run tests/unit/components/ResponsiveList.test.tsx`
Expected: FAIL — không resolve được `@/components/common/ResponsiveList`.

- [ ] **Step 3: Viết `ResponsiveList`**

`src/components/common/ResponsiveList.tsx`:

```tsx
"use client"

import type { ReactNode, Key } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type Column<T> = {
  header: ReactNode
  cell: (item: T, index: number) => ReactNode
  className?: string
}

type Props<T> = {
  items: T[]
  getKey: (item: T) => Key
  columns: Column<T>[]
  renderCard: (item: T, index: number) => ReactNode
  onRowClick?: (item: T) => void
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
  emptyText: ReactNode
  errorText: string
  retryText: string
}

export function ResponsiveList<T>({
  items,
  getKey,
  columns,
  renderCard,
  onRowClick,
  isLoading,
  isError,
  onRetry,
  emptyText,
  errorText,
  retryText,
}: Props<T>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} data-testid="list-skeleton" className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
        <p className="text-sm text-slate-600">{errorText}</p>
        {onRetry && (
          <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={onRetry}>
            {retryText}
          </Button>
        )}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead key={i} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={getKey(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((c, i) => (
                  <TableCell key={i} className={c.className}>
                    {c.cell(item, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((item, index) => (
          <div key={getKey(item)} data-testid="list-card">
            {renderCard(item, index)}
          </div>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm vitest run tests/unit/components/ResponsiveList.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Viết `PageHeader`**

`src/components/common/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react"

type Props = {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 6: Viết `FilterBar`**

`src/components/common/FilterBar.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  search?: { value: string; onChange: (value: string) => void; placeholder: string }
  filters?: ReactNode
  activeCount?: number
}

export function FilterBar({ search, filters, activeCount = 0 }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      {search && (
        <div className="relative flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            className="h-11 bg-white pl-9 md:h-10"
          />
        </div>
      )}

      {filters && (
        <>
          <div className="hidden items-center gap-2 md:flex">{filters}</div>

          {/* SheetContent chỉ mount khi mở nên `filters` không bị render 2 lần cùng lúc */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 md:hidden">
                <SlidersHorizontal className="mr-2 size-4" />
                {t("filter")}
                {activeCount > 0 && ` (${activeCount})`}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-lg">
              <SheetHeader>
                <SheetTitle>{t("filter")}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-3 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full">
                {filters}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Viết `StatCard`**

`src/components/common/StatCard.tsx`:

```tsx
import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  value?: string | number
  hint?: ReactNode
  icon?: ReactNode
  loading?: boolean
  valueClassName?: string
}

export function StatCard({ label, value, hint, icon, loading, valueClassName }: Props) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          {icon}
        </div>
        {loading || value === undefined ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          // nowrap: số tiền 9 chữ số không được gãy "100.000.000 / đ" ở thẻ 2 cột 390px
          <p className={cn("mt-1 whitespace-nowrap text-lg font-bold text-slate-900 md:text-2xl", valueClassName)}>
            {value}
          </p>
        )}
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 9: Commit**

```bash
git add src/components/common tests/unit/components/ResponsiveList.test.tsx
git commit -m "feat(ui): khối dùng chung PageHeader, FilterBar, StatCard, ResponsiveList"
```

---

### Task 5: Khung app — thanh tab đáy

**Files:**
- Create: `src/components/layout/nav-items.ts`
- Create: `src/components/layout/BottomTabBar.tsx`
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/layout/AppHeader.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/components/ui/data-table-pagination.tsx:44`
- Modify: `src/language/vi.json`, `en.json` (xóa `open_menu`)

**Interfaces:**
- Produces: `NAV_ITEMS: { href: string; labelKey: TranslationKey; icon: LucideIcon }[]`, `isNavActive(pathname: string, href: string): boolean`.

- [ ] **Step 1: Tạo `nav-items.ts`**

`src/components/layout/nav-items.ts`:

```ts
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type vi from "@/language/vi.json"

export const NAV_ITEMS: { href: string; labelKey: keyof typeof vi; icon: LucideIcon }[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { href: "/students", labelKey: "students", icon: Users },
  { href: "/tuition", labelKey: "tuition", icon: Wallet },
  { href: "/reports", labelKey: "reports", icon: BarChart3 },
]

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}
```

- [ ] **Step 2: Sidebar dùng `NAV_ITEMS`, bỏ `onNavigate`**

Trong `src/components/layout/AppSidebar.tsx`:
- Xóa import `LayoutDashboard, CalendarDays, Users, BarChart3, Wallet` và hằng `ICONS`, giữ `GraduationCap`.
- Thêm `import { NAV_ITEMS, isNavActive } from "./nav-items"`.
- Đổi chữ ký `export function AppSidebar()` (bỏ `{ onNavigate }`).
- Xóa mảng `NAV_ITEMS` cục bộ trong hàm.
- Thân vòng lặp:

```tsx
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="size-4" />
              <span>{t(item.labelKey)}</span>
            </Link>
          )
        })}
```

- [ ] **Step 3: Tạo `BottomTabBar`**

`src/components/layout/BottomTabBar.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { NAV_ITEMS, isNavActive } from "./nav-items"

export function BottomTabBar() {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t("main_navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-indigo-700" : "text-slate-500"
                )}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">{t(item.labelKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 4: Sửa `AppLayout`**

Thay toàn bộ `src/components/layout/AppLayout.tsx`:

```tsx
"use client"

import { AppSidebar } from "./AppSidebar"
import { AppHeader } from "./AppHeader"
import { BottomTabBar } from "./BottomTabBar"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // 100dvh: thanh địa chỉ iOS Safari co giãn không làm nhảy layout như h-screen
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
      <div className="hidden h-full bg-white md:flex">
        <AppSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        {/* Mobile chừa chỗ cho tab bar (56px) + thanh phân trang (~44px) + safe-area */}
        <main className="relative flex-1 overflow-y-auto p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-6 md:pb-24">
          {children}
        </main>
      </div>

      <BottomTabBar />
    </div>
  )
}
```

- [ ] **Step 5: Sửa `AppHeader`**

Trong `src/components/layout/AppHeader.tsx`:
- Xóa `type Props`, đổi `export function AppHeader({ onToggleSidebar }: Props)` → `export function AppHeader()`.
- Xóa import `Menu` khỏi lucide.
- Thay khối `<div className="flex items-center gap-2">` đầu tiên (chứa nút ☰ và lời chào) bằng:

```tsx
      <span className="truncate text-sm text-slate-600">
        {t("hello")},{" "}
        <span className="font-medium text-slate-900">{fullName}</span>
      </span>
```

- [ ] **Step 6: Thanh phân trang nằm trên tab bar ở mobile**

Trong `src/components/ui/data-table-pagination.tsx` dòng 44, đổi `"fixed bottom-0 left-0 right-0 md:left-60 z-30 ..."` thành:

```ts
      "fixed left-0 right-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 md:left-60 z-30 flex items-center justify-between px-4 md:px-6 py-1.5 md:py-2 bg-white/95 backdrop-blur-sm border-t border-slate-200 gap-4 md:gap-12",
```

- [ ] **Step 7: Xóa key `open_menu`**

Run: `grep -rn "open_menu" src` → chỉ còn trong 2 file json. Xóa dòng `"open_menu": ...` ở `vi.json` và `en.json`. Chạy lại lệnh parity ở Task 3 Step 3 — Expected: `295 295 OK`.

- [ ] **Step 8: Typecheck, lint, kiểm tra thủ công**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

Run: `pnpm dev`, mở `http://localhost:3000/dashboard` bằng DevTools device mode 390×844:
- Có thanh tab 5 mục ở đáy, bấm từng tab chuyển đúng màn, tab active màu indigo.
- Không còn nút ☰.
- `/students`: thanh phân trang nằm ngay trên thanh tab, không đè nhau.
- Desktop 1440px: sidebar như cũ, không có tab bar.

- [ ] **Step 9: Commit**

```bash
git add src/components/layout src/components/ui/data-table-pagination.tsx src/language
git commit -m "feat(layout): thanh tab đáy cho mobile, bỏ drawer"
```

---

### Task 6: Dialog chi tiết ca + điểm danh trên mobile

**Files:**
- Modify: `src/components/sessions/SessionDetailDialog.tsx:224,233`
- Modify: `src/components/sessions/AttendancePanel.tsx:138-277`

- [ ] **Step 1: Sửa `SessionDetailDialog`**

Dòng 224 — thêm `content-start` (DialogContent là `grid`; ở mobile `h-full` làm các hàng giãn ra thành khoảng trắng lớn):

```tsx
        <DialogContent className="w-full h-full max-w-none content-start sm:h-auto sm:max-w-[600px] sm:max-h-[90vh] overflow-y-auto sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
```

Dòng 233 — `DialogHeader` chừa chỗ cho nút đóng mặc định (`absolute right-4 top-4`):

```tsx
              <DialogHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pr-8">
```

Và `<div className="space-y-1">` ngay dưới đổi thành `<div className="min-w-0 space-y-1">` để tiêu đề dài được `truncate`.

- [ ] **Step 2: Thay bảng điểm danh bằng grid co giãn**

Trong `AttendancePanel.tsx`, thay toàn bộ khối từ `<div className="space-y-4">` (dòng ~138) tới hết thanh nút (trước `<AlertDialog`) bằng:

```tsx
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border bg-white">
        {/* Một markup cho cả 2 cỡ: mobile 2 dòng (tên + nút | học phí, ghi chú, xóa), desktop 1 hàng như bảng cũ */}
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto_auto] gap-x-3 border-b bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 md:grid">
          <span>{t("student")}</span>
          <span>{t("tuition_col")}</span>
          <span>{t("notes")}</span>
          <span>{t("attendance_col")}</span>
          <span className="w-8"><span className="sr-only">{t("remove_from_session")}</span></span>
        </div>

        <div className="divide-y">
          {attendanceData.map((student) => {
            const state = attendances[student.studentId]
            if (!state) return null

            return (
              <div
                key={student.studentId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto_auto] md:py-2"
              >
                <div className="order-1 min-w-0">
                  <div className="truncate font-medium text-slate-900">{student.fullName}</div>
                  <div className="text-xs text-slate-500">{t("grade")} {student.grade}</div>
                </div>

                <div className="order-2 flex gap-2 md:order-4 md:gap-1.5">
                  <button
                    type="button"
                    aria-pressed={state.attendance === "present"}
                    aria-label={ATTENDANCE_LABEL.present}
                    title={ATTENDANCE_LABEL.present}
                    onClick={() => handleToggleStatus(student.studentId, "present")}
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-md border transition-colors md:size-8",
                      state.attendance === "present"
                        ? "border-green-500 bg-green-50 text-green-600"
                        : "border-slate-200 text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Check className="size-5 md:size-4" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    aria-pressed={state.attendance === "absent"}
                    aria-label={ATTENDANCE_LABEL.absent}
                    title={ATTENDANCE_LABEL.absent}
                    onClick={() => handleToggleStatus(student.studentId, "absent")}
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-md border transition-colors md:size-8",
                      state.attendance === "absent"
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-slate-200 text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <X className="size-5 md:size-4" strokeWidth={3} />
                  </button>
                </div>

                {/* md:contents: ở desktop 3 phần tử con thành ô grid riêng, sắp lại bằng order */}
                <div className="order-3 col-span-2 flex items-center gap-2 md:contents">
                  <CurrencyInput
                    value={state.fee}
                    onChange={(val) => handleUpdateFee(student.studentId, val || 0)}
                    className="h-10 w-28 shrink-0 text-sm md:order-2 md:h-8 md:w-full md:text-xs"
                  />
                  <Input
                    placeholder={t("note")}
                    value={state.note}
                    onChange={(e) => handleUpdateNote(student.studentId, e.target.value)}
                    className="h-10 min-w-0 flex-1 text-sm md:order-3 md:h-8 md:text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 text-slate-400 hover:text-red-600 md:order-5 md:size-8"
                    aria-label={t("remove_from_session")}
                    title={t("remove_from_session")}
                    onClick={() =>
                      setStudentToRemove({
                        studentId: student.studentId,
                        fullName: student.fullName,
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dính đáy vùng cuộn của dialog; -mx-6/px-6 khớp padding p-6 của DialogContent */}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-2 border-t bg-white px-6 py-3">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleMarkAllPresent} className="h-11 text-xs text-slate-600 md:h-9">
            <Check className="mr-1 size-3" />
            {t("mark_all_present")}
          </Button>
          <Button variant="outline" onClick={handleMarkAllAbsent} className="h-11 text-xs text-slate-600 md:h-9">
            <X className="mr-1 size-3" />
            {t("mark_all_absent")}
          </Button>
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending} className="h-11 w-full sm:w-auto md:h-9">
          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("save_attendance")}
        </Button>
      </div>
    </div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 4: Kiểm tra thủ công**

`pnpm dev`, device mode 390×844, `/calendar` → chọn ngày có ca → bấm ca:
- Không có thanh cuộn ngang trong dialog.
- Nút ⋮ và nút đóng không chồng nhau.
- Mỗi HS: dòng 1 tên + 2 nút ✓/✕ lớn; dòng 2 học phí, ghi chú, thùng rác.
- Nút "Lưu điểm danh" rộng hết, luôn thấy ở đáy khi cuộn (thêm ≥ 6 HS vào ca để thử cuộn).
- Bấm ✓ rồi Lưu → toast "thành công", dialog đóng.
- Desktop 1440px: bố cục 1 hàng như bảng cũ.

- [ ] **Step 5: Commit**

```bash
git add src/components/sessions/SessionDetailDialog.tsx src/components/sessions/AttendancePanel.tsx
git commit -m "fix(attendance): dialog điểm danh không tràn ngang trên mobile, nút lưu dính đáy"
```

---

### Task 7: Màn Học sinh

**Files:**
- Modify: `src/components/students/StudentList.tsx`
- Modify: `src/components/students/UpgradeAllClassesButton.tsx:48-60`
- Modify: `src/app/(app)/students/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `FilterBar`, `ResponsiveList`, `Column` (Task 4); key `per_session`, `load_error`, `retry`, `filter` (Task 3).

- [ ] **Step 1: Nút nâng lớp chỉ icon trên mobile**

Trong `UpgradeAllClassesButton.tsx`, thay `<Button ...>` đầu tiên bằng:

```tsx
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={alreadyDone || logQuery.isPending}
        title={
          alreadyDone
            ? t("upgrade_all_already_done").replace("{year}", String(currentYear))
            : undefined
        }
        aria-label={t("upgrade_all_button")}
        className="h-11 px-3 md:h-10 md:px-4"
      >
        <ArrowUpCircle className="size-4 sm:mr-2" />
        <span className="hidden sm:inline">{t("upgrade_all_button")}</span>
      </Button>
```

- [ ] **Step 2: Trang chỉ còn `StudentList`**

`src/app/(app)/students/page.tsx`:

```tsx
"use client"

import { StudentList } from "@/components/students/StudentList"

export default function StudentsPage() {
  return <StudentList />
}
```

- [ ] **Step 3: Viết lại phần render của `StudentList`**

Trong `StudentList.tsx`:
- Import: bỏ `Input`, `Skeleton`, các `Table*`; thêm
  ```tsx
  import { Phone } from "lucide-react"
  import { PageHeader } from "@/components/common/PageHeader"
  import { FilterBar } from "@/components/common/FilterBar"
  import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
  ```
- `useState(5)` → `useState(20)` cho `pageSize`.
- Giữ nguyên toàn bộ state, query, mutation, `StudentFormDialog`, `AlertDialog`, `DataTablePagination`.
- Thêm 3 hàm con trong component (trước `return`):

```tsx
  const levelBadge = (s: StudentRow) =>
    s.level === "tieu_hoc" ? (
      <Badge variant="outline" className="whitespace-nowrap border-blue-200 bg-blue-50 text-blue-700">
        {t("primary_school")}
      </Badge>
    ) : (
      <Badge variant="outline" className="whitespace-nowrap border-emerald-200 bg-emerald-50 text-emerald-700">
        {t("secondary_school")}
      </Badge>
    )

  const statusBadge = (s: StudentRow) =>
    s.isActive ? (
      <Badge className="whitespace-nowrap border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
        {t("studying")}
      </Badge>
    ) : (
      <Badge variant="secondary" className="whitespace-nowrap border-red-100 bg-red-50 text-red-600 hover:bg-red-50">
        {t("dropped")}
      </Badge>
    )

  const actionsMenu = (s: StudentRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={t("actions")}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push(`/calendar?studentId=${s.id}`)}>
          <CalendarDays className="mr-2 size-4" />
          {t("view_schedule")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setFormState({ open: true, mode: "edit", student: s })}>
          <Pencil className="mr-2 size-4" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setDeleteTarget(s)}>
          <Trash2 className="mr-2 size-4" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const offset = (currentPage - 1) * pageSize
  const columns: Column<StudentRow>[] = [
    { header: t("stt"), cell: (_, i) => offset + i + 1, className: "w-12 text-center" },
    { header: t("full_name"), cell: (s) => <span className="font-medium">{s.fullName}</span> },
    { header: t("grade"), cell: (s) => s.grade, className: "w-16" },
    { header: t("level"), cell: levelBadge, className: "w-32" },
    { header: t("tuition_fee"), cell: (s) => formatCurrency(s.tuitionFee), className: "w-32 text-right font-medium text-slate-700" },
    { header: t("status"), cell: statusBadge, className: "w-28" },
    { header: t("parent_phone"), cell: (s) => s.parentPhone || "-", className: "text-slate-600" },
    { header: t("parent_name"), cell: (s) => s.parentName || "-", className: "hidden lg:table-cell text-slate-600" },
    { header: <span className="sr-only">{t("actions")}</span>, cell: actionsMenu, className: "w-12" },
  ]

  const activeFilterCount = (selectedGrade !== null ? 1 : 0) + (statusFilter !== "active" ? 1 : 0)
```

- Thay toàn bộ JSX từ `<div className="flex flex-col sm:flex-row ...">` (thanh lọc cũ) tới hết `</div>` của bảng bằng:

```tsx
      <PageHeader
        title={t("students")}
        actions={
          <>
            <UpgradeAllClassesButton />
            <Button onClick={() => setFormState({ open: true, mode: "create" })} className="h-11 md:h-10">
              <UserPlus className="mr-2 size-4" />
              {t("add_student")}
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: localSearch, onChange: setLocalSearch, placeholder: t("search_student") }}
        activeCount={activeFilterCount}
        filters={
          <>
            <Select
              value={selectedGrade === null ? ALL_GRADES_VALUE : String(selectedGrade)}
              onValueChange={(v) => setGrade(v === ALL_GRADES_VALUE ? null : Number(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("all_grades")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GRADES_VALUE}>{t("all_grades")}</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {t("grade")} {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "active" | "inactive" | "all")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("studying")}</SelectItem>
                <SelectItem value="inactive">{t("dropped")}</SelectItem>
                <SelectItem value="all">{t("all_status")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <ResponsiveList
        items={students}
        getKey={(s) => s.id}
        columns={columns}
        isLoading={listQuery.isPending}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        emptyText={
          <>
            {t("no_students_message")}
            {selectedGrade === null && searchStudentName === "" && <> {t("click_add_student_hint")}</>}
          </>
        }
        renderCard={(s) => (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{s.fullName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                  <span>{t("grade")} {s.grade}</span>
                  {levelBadge(s)}
                  {!s.isActive && statusBadge(s)}
                </div>
              </div>
              {actionsMenu(s)}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-slate-900">
                {formatCurrency(s.tuitionFee)}
                <span className="font-normal text-slate-500">{t("per_session")}</span>
              </span>
              {s.parentPhone && (
                <a href={`tel:${s.parentPhone}`} className="inline-flex min-h-11 items-center gap-1.5 text-indigo-700">
                  <Phone className="size-4" />
                  {s.parentPhone}
                </a>
              )}
            </div>
          </div>
        )}
      />
```

(Cột SĐT PH trên desktop giờ hiện từ `md` vì bảng chỉ render ở `md` trở lên.)

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi. Nếu lint báo import thừa (`Input`, `Skeleton`, `Table*`), xóa chúng.

- [ ] **Step 5: Kiểm tra thủ công**

390×844 `/students`: thấy tiêu đề + 2 nút (icon nâng lớp, "Thêm học sinh"), ô tìm + nút "Lọc"; danh sách là thẻ có học phí/buổi và SĐT bấm được; mở "Lọc" → sheet đáy có 2 select full width, chọn lớp → nút đổi thành "Lọc (1)". Desktop: bảng, header chữ thường, 20 dòng/trang.

- [ ] **Step 6: Commit**

```bash
git add src/components/students src/app/\(app\)/students/page.tsx
git commit -m "feat(students): danh sách dạng thẻ trên mobile, dùng khối chung"
```

---

### Task 8: Màn Học phí

**Files:**
- Modify: `src/app/(app)/tuition/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `FilterBar`, `ResponsiveList`, `Column` (Task 4).

- [ ] **Step 1: Viết lại render**

Trong `tuition/page.tsx`:
- Import: bỏ `Search`, `Input`, `Table*`, `Card`, `CardContent`, `Skeleton`; thêm
  ```tsx
  import { PageHeader } from "@/components/common/PageHeader"
  import { FilterBar } from "@/components/common/FilterBar"
  import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
  ```
- `useState(5)` → `useState(20)`.
- Trước `return`, thêm:

```tsx
  const offset = (currentPage - 1) * pageSize
  const payButton = (item: TuitionStatusItem, className?: string) => (
    <Button
      size="sm"
      variant="outline"
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        handleOpenDetail(item)
      }}
    >
      <Wallet className="mr-1.5 size-4" />
      {t("record_payment")}
    </Button>
  )

  const columns: Column<TuitionStatusItem>[] = [
    { header: t("stt"), cell: (_, i) => offset + i + 1, className: "w-[60px] text-center text-slate-400" },
    { header: t("full_name"), cell: (item) => <span className="font-medium text-slate-900">{item.fullName}</span> },
    {
      header: t("grade"),
      cell: (item) => (
        <Badge variant="secondary" className="min-w-[50px] justify-center border-none bg-slate-100 font-medium text-slate-600">
          {item.grade}
        </Badge>
      ),
      className: "w-[80px] text-center",
    },
    { header: t("sessions_count"), cell: (item) => `${item.presentSessions}/${item.totalSessions}`, className: "w-[120px] text-center text-slate-600" },
    { header: t("amount_to_pay"), cell: (item) => formatCurrency(item.totalAmountDue), className: "w-[160px] whitespace-nowrap text-right font-medium text-slate-900" },
    { header: t("status"), cell: (item) => <TuitionStatusBadge item={item} />, className: "w-[160px] text-center" },
    { header: <span className="sr-only">{t("action")}</span>, cell: (item) => payButton(item), className: "w-[130px] text-right" },
  ]

  const activeFilterCount = (selectedGrade ? 1 : 0) + (selectedStatus && selectedStatus !== "all" ? 1 : 0)
```

- Thay toàn bộ JSX từ đầu `<div className="flex flex-col gap-6">` tới trước `<DataTablePagination` bằng:

```tsx
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("manage_tuition")}
        description={t("manage_tuition_desc")}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="size-9">
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-[110px] px-2 text-center text-sm font-semibold">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="size-9">
              <ChevronRight className="size-5" />
            </Button>
          </div>
        }
      />

      <FilterBar
        search={{ value: searchStudentName, onChange: setSearch, placeholder: t("search_student") }}
        activeCount={activeFilterCount}
        filters={
          <>
            <Select value={selectedStatus || "all"} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_status")}</SelectItem>
                <SelectItem value="fully_paid">{t("fully_paid")}</SelectItem>
                <SelectItem value="paid_this_month">{t("paid_this_month")}</SelectItem>
                <SelectItem value="partial">{t("partial_paid")}</SelectItem>
                <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedGrade?.toString() || "all"}
              onValueChange={(v) => setGrade(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("all_grades")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_grades")}</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g.toString()}>
                    {t("grade")} {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <ResponsiveList
        items={items}
        getKey={(item) => item.studentId}
        columns={columns}
        onRowClick={handleOpenDetail}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        emptyText={t("no_students_found")}
        renderCard={(item) => (
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleOpenDetail(item)}
            onKeyDown={(e) => e.key === "Enter" && handleOpenDetail(item)}
            className="rounded-lg border border-slate-200 bg-white p-4 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-slate-900">{item.fullName}</p>
                <Badge variant="secondary" className="mt-1 border-none bg-slate-100 font-medium text-slate-500">
                  {t("grade")} {item.grade}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-1">
                <TuitionStatusBadge item={item} />
                <span className="text-xs text-slate-500">
                  {item.presentSessions}/{item.totalSessions} {t("sessions")}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
              <div>
                <div className="text-xs text-slate-500">{t("amount_to_pay")}</div>
                <div className="whitespace-nowrap text-lg font-medium text-slate-900">
                  {formatCurrency(item.totalAmountDue)}
                </div>
              </div>
              {payButton(item, "h-11")}
            </div>
          </div>
        )}
      />
```

Giữ nguyên `DataTablePagination` và `TuitionDetailSheet` phía sau, và thẻ `</div>` đóng.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 3: Kiểm tra thủ công**

390×844 `/tuition`: tiêu đề + mô tả, bộ chọn tháng ở dưới tiêu đề (wrap), ô tìm + "Lọc", thẻ có nút "Ghi nhận" (bấm mở sheet chi tiết). Desktop: bảng header chữ thường, cột cuối là nút có chữ "Ghi nhận", bấm hàng mở sheet.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/tuition/page.tsx"
git commit -m "refactor(tuition): dùng khối chung, nút Ghi nhận có chữ, 20 dòng/trang"
```

---

### Task 9: Dashboard — thẻ số liệu + "Ca dạy hôm nay"

**Files:**
- Create: `src/lib/today-sessions.ts`
- Create: `tests/unit/lib/today-sessions.test.ts`
- Create: `src/components/calendar/SessionListItem.tsx`
- Create: `src/components/dashboard/TodaySessions.tsx`
- Modify: `src/components/calendar/MonthCalendar.tsx` (danh sách ca mobile, dòng ~245-273)
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/language/vi.json`, `en.json` (xóa key thừa)

**Interfaces:**
- Consumes: `getSessionLabel` (Task 1), `StatCard` (Task 4), `totalPaidMonth` (Task 2).
- Produces: `filterTodaySessions<T extends { sessionDate: Date; status: string; startTime: string }>(sessions: T[], today: string): T[]`; `SessionListItem({ session: SessionListDTO; onClick: (s: SessionListDTO) => void })`.

- [ ] **Step 1: Viết test fail cho `filterTodaySessions`**

`tests/unit/lib/today-sessions.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { filterTodaySessions } from "@/lib/today-sessions"

const s = (date: string, startTime: string, status = "scheduled") => ({
  sessionDate: new Date(`${date}T00:00:00.000Z`),
  startTime,
  status,
})

describe("filterTodaySessions", () => {
  it("chỉ lấy ca của ngày được chọn, sắp theo giờ bắt đầu", () => {
    const result = filterTodaySessions(
      [s("2026-09-25", "20:00"), s("2026-09-24", "08:00"), s("2026-09-25", "15:00")],
      "2026-09-25"
    )
    expect(result.map((x) => x.startTime)).toEqual(["15:00", "20:00"])
  })

  it("bỏ ca đã hủy", () => {
    const result = filterTodaySessions([s("2026-09-25", "15:00", "cancelled")], "2026-09-25")
    expect(result).toEqual([])
  })

  it("không có ca → mảng rỗng", () => {
    expect(filterTodaySessions([], "2026-09-25")).toEqual([])
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm vitest run tests/unit/lib/today-sessions.test.ts`
Expected: FAIL — không resolve `@/lib/today-sessions`.

- [ ] **Step 3: Viết `filterTodaySessions`**

`src/lib/today-sessions.ts`:

```ts
import dayjs from "dayjs"

// So theo ngày lịch như MonthCalendar (dayjs local), bỏ ca hủy để khớp số "Ca dạy hôm nay".
export function filterTodaySessions<T extends { sessionDate: Date; status: string; startTime: string }>(
  sessions: T[],
  today: string
): T[] {
  return sessions
    .filter((s) => s.status !== "cancelled" && dayjs(s.sessionDate).format("YYYY-MM-DD") === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
```

Run: `pnpm vitest run tests/unit/lib/today-sessions.test.ts`
Expected: PASS (3 tests). (Test chạy với TZ máy; `T00:00:00Z` ở UTC+7 vẫn là cùng ngày.)

- [ ] **Step 4: Tách `SessionListItem` từ MonthCalendar**

`src/components/calendar/SessionListItem.tsx`:

```tsx
"use client"

import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getSessionLabel } from "@/lib/session-label"
import type { SessionListDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  session: SessionListDTO
  onClick: (session: SessionListDTO) => void
}

export function SessionListItem({ session, onClick }: Props) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => onClick(session)}
      className="flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-all active:scale-[0.98]"
    >
      <div className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: session.subject.color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-slate-900">{getSessionLabel(session)}</div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-600">
            <Clock className="size-3" />
            {session.startTime} - {session.endTime}
          </div>
          <span className="text-slate-300">|</span>
          <span className="font-medium">{session.studentCount} {t("students")}</span>
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0 text-[10px] font-bold">
        {t("details")}
      </Badge>
    </button>
  )
}
```

Trong `MonthCalendar.tsx`, thay khối `selectedDateSessions.map((s) => (<button ...>...</button>))` bằng:

```tsx
              selectedDateSessions.map((s) => (
                <SessionListItem key={s.id} session={s} onClick={handleSessionClick} />
              ))
```

Thêm `import { SessionListItem } from "./SessionListItem"`; bỏ import `Clock` và `Badge` nếu không còn dùng trong file.

- [ ] **Step 5: Tạo `TodaySessions`**

`src/components/dashboard/TodaySessions.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import dayjs from "dayjs"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { SessionListItem } from "@/components/calendar/SessionListItem"
import { SessionDetailDialog } from "@/components/sessions/SessionDetailDialog"
import { SessionFormDialog } from "@/components/sessions/SessionFormDialog"
import { filterTodaySessions } from "@/lib/today-sessions"
import type { SessionDTO, SessionListDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

type SessionWithDate = Omit<RouterOutputs["session"]["getMonth"][number], "sessionDate"> & { sessionDate: Date }

export function TodaySessions() {
  const { t } = useTranslation()
  const now = dayjs()
  const today = now.format("YYYY-MM-DD")

  const query = trpc.session.getMonth.useQuery({ year: now.year(), month: now.month() + 1 })

  const sessions = useMemo<SessionWithDate[]>(
    () =>
      filterTodaySessions(
        (query.data ?? []).map((s) => ({ ...s, sessionDate: new Date(s.sessionDate) })),
        today
      ),
    [query.data, today]
  )

  const [selected, setSelected] = useState<SessionListDTO | undefined>()
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editing, setEditing] = useState<SessionDTO | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{t("sessions_today")}</h2>

      {query.isPending ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
          {t("no_sessions_today")}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => (
            <SessionListItem
              key={s.id}
              session={s}
              onClick={(session) => {
                setSelected(session)
                setIsDetailOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {selected && (
        <SessionDetailDialog
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          session={selected}
          onEdit={(session) => {
            setIsDetailOpen(false)
            setEditing(session)
            setIsFormOpen(true)
          }}
        />
      )}

      <SessionFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} editingSession={editing} />
    </section>
  )
}
```

- [ ] **Step 6: Viết lại `dashboard/page.tsx`**

Thay toàn bộ file:

```tsx
"use client"

import { useState } from "react"
import { AlertCircle, BarChart3, Banknote, CalendarCheck, CalendarDays, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { StatCard } from "@/components/common/StatCard"
import { TodaySessions } from "@/components/dashboard/TodaySessions"
import { trpc } from "@/lib/trpc"
import { cn, formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.report.dashboard.useQuery()
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)
  const money = (v?: number) => (v === undefined ? undefined : formatCurrency(v))

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard")} />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("sessions_today")}
          value={stats?.sessionsToday}
          loading={isLoading}
          icon={<CalendarDays className="size-4 text-emerald-600" />}
          hint={t("total_sessions_day")}
        />
        <StatCard
          label={t("revenue_this_month")}
          value={money(stats?.totalRevenueMonth)}
          loading={isLoading}
          icon={<Banknote className="size-4 text-cyan-600" />}
          hint={t("hint_taught_fees")}
        />
        <StatCard
          label={t("collected_amount")}
          value={money(stats?.totalPaidMonth)}
          loading={isLoading}
          icon={<Wallet className="size-4 text-green-600" />}
          hint={t("hint_collected")}
        />
        <StatCard
          label={t("unpaid_this_month")}
          value={money(stats?.totalUnpaidMonth)}
          loading={isLoading}
          icon={<AlertCircle className="size-4 text-red-600" />}
          hint={t("hint_outstanding")}
        />
      </div>

      {/* Mobile ẩn 4 số phụ sau nút "Xem thêm"; desktop luôn hiện */}
      <div className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4", !showMore && "hidden md:grid")}>
        <StatCard
          label={t("total_students")}
          value={stats?.totalStudents}
          loading={isLoading}
          icon={<Users className="size-4 text-blue-600" />}
          hint={t("active_students")}
        />
        <StatCard
          label={t("sessions_this_month")}
          value={stats?.totalSessionsMonth}
          loading={isLoading}
          icon={<CalendarCheck className="size-4 text-indigo-600" />}
          hint={t("scheduled_this_month")}
        />
        <StatCard
          label={t("attendance_rate")}
          value={stats ? `${stats.attendanceRate}%` : undefined}
          loading={isLoading}
          icon={<BarChart3 className="size-4 text-orange-600" />}
          hint={t("average_this_month")}
        />
        <StatCard
          label={t("expected_revenue")}
          value={money(stats?.expectedRevenueMonth)}
          loading={isLoading}
          icon={<Banknote className="size-4 text-violet-600" />}
          hint={t("hint_expected_fees")}
        />
      </div>

      <Button variant="ghost" className="h-11 w-full md:hidden" onClick={() => setShowMore((v) => !v)}>
        {showMore ? t("show_less_stats") : t("show_more_stats")}
      </Button>

      <TodaySessions />
    </div>
  )
}
```

- [ ] **Step 7: Xóa key thừa**

Run: `grep -rn "quick_links\|manage_calendar\|manage_students\|collected_this_month" src --include=*.tsx --include=*.ts`
Expected: không còn kết quả. Xóa 4 key này ở `vi.json` và `en.json`. Chạy lệnh parity (Task 3 Step 3) — Expected: `291 291 OK`.

- [ ] **Step 8: Typecheck, lint, test**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm vitest run tests/unit`
Expected: không lỗi, unit pass.

- [ ] **Step 9: Kiểm tra thủ công**

390×844 `/dashboard`: 4 thẻ 2 cột, số tiền không gãy dòng; bấm "Xem thêm" → hiện 4 thẻ phụ, nút đổi "Thu gọn"; khối "Ca dạy hôm nay" liệt kê ca, bấm mở dialog điểm danh; ngày không có ca → "Hôm nay không có ca dạy". Desktop: 8 thẻ 2 hàng, không có nút "Xem thêm". `/calendar` mobile: danh sách ca ngày vẫn như cũ.

- [ ] **Step 10: Commit**

```bash
git add src/lib/today-sessions.ts tests/unit/lib/today-sessions.test.ts src/components/calendar/SessionListItem.tsx src/components/calendar/MonthCalendar.tsx src/components/dashboard "src/app/(app)/dashboard/page.tsx" src/language
git commit -m "feat(dashboard): 4 số chính, nhãn tiền rõ nghĩa, khối Ca dạy hôm nay"
```

---

### Task 10: Màn Báo cáo

**Files:**
- Modify: `src/app/(app)/reports/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `FilterBar`, `StatCard` (Task 4); key `hint_*`, `select_student_hint`, `hint_not_yet_counted` (Task 3).

- [ ] **Step 1: Viết lại render**

- Import: bỏ `Card, CardContent, CardHeader, CardTitle`; thêm
  ```tsx
  import { PageHeader } from "@/components/common/PageHeader"
  import { FilterBar } from "@/components/common/FilterBar"
  import { StatCard } from "@/components/common/StatCard"
  ```
- Giữ nguyên toàn bộ hook/query. Thêm trước `return`:

```tsx
  const money = (v?: number) => (v === undefined ? undefined : formatCurrency(v))
  const activeFilterCount = (gradeFilter ? 1 : 0) + (selectedStudentId ? 1 : 0)
```

- Thay toàn bộ JSX trả về bằng:

```tsx
    <div className="space-y-6">
      <PageHeader
        title={t("reports")}
        actions={
          <>
            <ExportExcelButton sessions={sessions} students={students} />
            <ReportPeriodPicker />
          </>
        }
      />

      <FilterBar
        activeCount={activeFilterCount}
        filters={
          <>
            <Select
              value={gradeFilter?.toString() || "all"}
              onValueChange={(v) => setGradeFilter(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("grade")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_grades")}</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g.toString()}>{t("grade")} {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedStudentId?.toString() || "none"}
              onValueChange={(v) => setSelectedStudentId(v === "none" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("student")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("select_student")}</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {!selectedStudentId ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label={t("student")} value={monthlySummary?.totalStudents} />
            <StatCard
              label={t("attendance_rate")}
              value={monthlySummary ? `${monthlySummary.overallAttendanceRate}%` : undefined}
            />
            <StatCard
              label={t("expected_revenue")}
              value={money(monthlySummary?.expectedRevenue)}
              hint={t("hint_expected_fees")}
              valueClassName="text-indigo-600"
            />
            <StatCard
              label={t("actual_revenue")}
              value={money(monthlySummary?.totalRevenue)}
              valueClassName="text-emerald-600"
              hint={
                <>
                  <p>{t("hint_taught_fees")}</p>
                  {gap > 0 && (
                    <p className="mt-1 text-orange-600">
                      {t("revenue_shortfall")} {formatCurrency(gap)}
                      <span className="block text-slate-500">{t("hint_not_yet_counted")}</span>
                    </p>
                  )}
                </>
              }
            />
            <StatCard
              label={t("collected_amount")}
              value={money(monthlySummary?.totalPaid)}
              hint={t("hint_collected")}
              valueClassName="text-green-600"
            />
            <StatCard
              label={t("uncollected_amount")}
              value={money(monthlySummary?.totalOutstanding)}
              hint={t("hint_outstanding")}
              valueClassName="text-orange-600"
            />
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            {t("select_student_hint")}
          </div>
        </>
      ) : (
        <StudentReport studentId={selectedStudentId} {...queryParams} />
      )}
    </div>
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 3: Kiểm tra thủ công**

390×844 `/reports`: tiêu đề, 2 nút (Xuất Excel, chọn kỳ) wrap dưới tiêu đề, nút "Lọc"; 6 thẻ 2 cột với dòng giải thích; khối "Chọn một học sinh để xem chi tiết". Chọn HS trong sheet → hiện báo cáo HS. Nhãn giống Dashboard: "Học phí dự kiến / Học phí đã dạy / Đã thu / Còn nợ".

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/reports/page.tsx"
git commit -m "feat(reports): dùng khối chung, giải thích số liệu, gợi ý chọn học sinh"
```

---

### Task 11: Màn Lịch — thanh công cụ + chú thích màu

**Files:**
- Rename: `src/components/filters/FilterBar.tsx` → `src/components/calendar/CalendarToolbar.tsx`
- Modify: `src/components/calendar/MonthCalendar.tsx`
- Modify: `src/app/(app)/calendar/page.tsx`

**Interfaces:**
- Produces: `CalendarToolbar` (props giữ nguyên `FilterBarProps` cũ, đổi tên `CalendarToolbarProps`).

- [ ] **Step 1: Đổi tên file và component**

```bash
git mv src/components/filters/FilterBar.tsx src/components/calendar/CalendarToolbar.tsx
```

Trong `CalendarToolbar.tsx`:
- `interface FilterBarProps` → `interface CalendarToolbarProps`; `export function FilterBar(` → `export function CalendarToolbar(`; kiểu tham số `}: CalendarToolbarProps)`.
- Import `ExportExcelButton` đổi `"../reports/ExportExcelButton"` → giữ nguyên (cùng độ sâu `components/calendar` và `components/filters`).
- Hàng nút (div có `border-t border-slate-100`): thêm `flex-wrap` vào className.
- Nút Lịch lặp: `<span className="hidden sm:inline">{t("bulk_schedule")}</span>` → `<span>{t("bulk_schedule")}</span>`.
- Nút Tạo ca: `<span className="hidden sm:inline">{t("create_session")}</span>` → `<span>{t("create_session")}</span>`.

Trong `MonthCalendar.tsx`: `import { FilterBar } from "../filters/FilterBar"` → `import { CalendarToolbar } from "./CalendarToolbar"`; `<FilterBar` → `<CalendarToolbar`.

Run: `ls src/components/filters` — nếu thư mục rỗng thì `rmdir src/components/filters`.

- [ ] **Step 2: Thêm chú thích màu**

Trong `MonthCalendar.tsx`, ngay sau `<CalendarToolbar ... />`, thêm:

```tsx
      {/* Màu viền thẻ ca là cấp học (session-card--tieu-hoc/thcs trong globals.css), không phải màu môn */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <LegendItem className="border-blue-500 bg-blue-50" label={t("primary_school")} />
        <LegendItem className="border-emerald-500 bg-emerald-50" label={t("secondary_school")} />
        <LegendItem className="border-indigo-500 bg-indigo-50" label={t("level_mixed")} />
        <LegendItem className="border-red-300 bg-red-50" label={t("cancelled_label")} />
      </div>
```

Cuối file `MonthCalendar.tsx`, thêm:

```tsx
function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm border-l-[3px]", className)} />
      {label}
    </span>
  )
}
```

- [ ] **Step 3: Trang Lịch dùng `PageHeader`**

`src/app/(app)/calendar/page.tsx`:

```tsx
"use client"

import { MonthCalendar } from "@/components/calendar/MonthCalendar"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function CalendarPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <PageHeader title={t("calendar")} />
      <MonthCalendar />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck, lint, unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm vitest run tests/unit`
Expected: không lỗi. `grep -rn "filters/FilterBar" src tests` → không còn kết quả.

- [ ] **Step 5: Kiểm tra thủ công**

Desktop `/calendar`: thẻ ca hiện "17:00-18:30" + "Tiếng Anh · 3 HS" (không còn "· 3 HS" trơn); dòng chú thích 4 màu phía trên lưới. 390×844: nút "Lịch lặp", "Tạo ca dạy" có chữ, không tràn ngang (wrap nếu thiếu chỗ).

- [ ] **Step 6: Commit**

```bash
git add -A src/components/calendar src/components/filters "src/app/(app)/calendar/page.tsx"
git commit -m "feat(calendar): chú thích màu cấp học, nút có chữ trên mobile, đổi tên CalendarToolbar"
```

---

### Task 12: E2E mobile + sửa e2e cũ + kiểm chứng cuối

**Files:**
- Create: `tests/e2e/mobile.spec.ts`
- Modify (nếu gãy): `tests/e2e/students.spec.ts`, `tests/e2e/calendar.spec.ts`, `tests/e2e/upgrade-class.spec.ts`, `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Viết `mobile.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

const SCREENS = [
  { tab: 'Tổng quan', url: /dashboard/ },
  { tab: 'Lịch dạy', url: /calendar/ },
  { tab: 'Học sinh', url: /students/ },
  { tab: 'Học phí', url: /tuition/ },
  { tab: 'Báo cáo', url: /reports/ },
];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Mobile 390px', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('thanh tab đáy chuyển đủ 5 màn, không màn nào tràn ngang', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav).toBeVisible();
    for (const s of SCREENS) {
      await nav.getByRole('link', { name: s.tab }).click();
      await expect(page).toHaveURL(s.url);
      await expect(nav.getByRole('link', { name: s.tab })).toHaveAttribute('aria-current', 'page');
      await expectNoHorizontalScroll(page);
    }
  });

  // Seed không có học sinh → test tự tạo HS (tên dài để thử truncate), tạo ca gắn HS đó, rồi tự dọn.
  test('thẻ học sinh + điểm danh một ca trên mobile', async ({ page }) => {
    const studentName = `HS tên rất dài để kiểm tra layout mobile ${Date.now()}`;
    const title = `Ca mobile ${Math.floor(Math.random() * 10000)}`;

    // 1. Tạo HS, kiểm tra màn Học sinh dạng thẻ
    await page.goto('/students');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.fill('input[id="fullName"]', studentName);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.locator('button:has-text("Thêm")').last().click();
    await expect(page.getByText('Đã thêm học sinh')).toBeVisible();

    await expect(page.locator('table')).toBeHidden();
    await expect(page.getByText(studentName)).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Thẻ cuối phải cuộn tới được, không bị thanh phân trang + tab bar che
    const lastCard = page.getByTestId('list-card').last();
    await lastCard.scrollIntoViewIfNeeded();
    const cardBox = await lastCard.boundingBox();
    const tabBox = await page.getByRole('navigation', { name: 'Điều hướng chính' }).boundingBox();
    expect(cardBox!.y + cardBox!.height).toBeLessThan(tabBox!.y);

    // 2. Tạo ca hôm nay gắn HS vừa tạo
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Bắt đầu (HH:mm)').fill('1300');
    await form.getByLabel('Kết thúc (HH:mm)').fill('1400');
    await form.getByLabel('Môn học').click();
    await page.getByRole('option').first().click();
    await form.getByPlaceholder('Nhóm nâng cao').fill(title);
    await form.getByLabel(new RegExp(studentName)).click(); // checkbox trong StudentPicker
    await form.getByRole('button', { name: 'Tạo ca dạy' }).click();
    await expect(page.getByText('Tạo ca dạy thành công')).toBeVisible();

    // 3. Mở ca → điểm danh
    await page.getByText(title).first().click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText(studentName)).toBeVisible();

    const dialogOverflow = await detail.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(dialogOverflow).toBeLessThanOrEqual(0);

    const saveBtn = detail.getByRole('button', { name: 'Lưu điểm danh' });
    await expect(saveBtn).toBeInViewport();
    await detail.getByRole('button', { name: 'Có mặt' }).first().click();
    await saveBtn.click();
    await expect(page.getByText('Đã lưu điểm danh')).toBeVisible();

    // 4. Dọn dữ liệu: xóa ca rồi xóa HS
    await page.getByText(title).first().click();
    await page.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
    await expect(page.getByText('Đã xóa ca dạy')).toBeVisible();

    await page.goto('/students');
    await page
      .getByTestId('list-card')
      .filter({ hasText: studentName })
      .getByRole('button', { name: 'Menu hành động' })
      .click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xóa học sinh')).toBeVisible();
  });
});
```

Ghi chú: "Tạo ca dạy" mặc định lấy ngày hôm nay; nếu form yêu cầu chọn ngày, điền ngày hôm nay theo đúng cách `calendar.spec.ts` đang làm. Ca 13:00-14:00 có thể trùng ca có sẵn trên DB test — nếu form cảnh báo trùng giờ, đổi sang giờ ngẫu nhiên như `calendar.spec.ts` (`13 + random(0..4)`).

- [ ] **Step 2: Chạy e2e toàn bộ**

Run: `pnpm exec playwright test`
Expected: tất cả pass. Nếu e2e cũ gãy:
- `students.spec.ts` dòng xóa HS dùng `tr:has-text(...)` — vẫn đúng ở desktop (viewport mặc định Desktop Chrome). Nút ⋯ giờ có `aria-label` "Menu hành động": có thể đổi sang `page.locator('tr', { hasText: 'Học sinh E2E' }).getByRole('button', { name: 'Menu hành động' })`.
- `upgrade-class.spec.ts` tìm nút theo tên "Nâng lớp hàng loạt" — desktop vẫn có chữ, mobile có `aria-label`, nên không cần sửa.
- `calendar.spec.ts` tìm "Tạo ca dạy" — vẫn đúng.

Sửa selector tối thiểu, chạy lại tới khi pass.

- [ ] **Step 3: Chạy toàn bộ kiểm tra**

Run: `pnpm lint && pnpm test && pnpm exec next build`
Expected: lint sạch, toàn bộ unit + integration pass, build thành công. (Không dùng `pnpm build` — xem Global Constraints.)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "test(e2e): kiểm thử mobile 390px (tab bar, thẻ học sinh, điểm danh)"
```

- [ ] **Step 5: Kiểm tra bằng mắt trên preview**

Push nhánh để Vercel tạo preview (hỏi người dùng trước khi push). Trên preview, chụp 5 màn ở 390px và 1440px (dùng Chrome, nhúng iframe 390px nếu cửa sổ không thu nhỏ được), gửi người dùng duyệt. Đối chiếu 5 tiêu chí hoàn thành ở spec mục 9. Chỉ merge sau khi người dùng duyệt ảnh.
