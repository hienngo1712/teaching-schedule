# Dọn code chết & vệ sinh kỹ thuật (Nhóm B + C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa sạch code chết và vá các lỗi vệ sinh kỹ thuật đã xác định trong đợt review 17/09/2026, để diff về sau không còn lẫn nhiễu và test suite không còn lỗ hổng âm thầm.

**Architecture:** Không đổi schema DB, không đổi hành vi nghiệp vụ mà người dùng nhìn thấy — TRỪ Task 9 (đồng bộ bộ lọc trạng thái phía server với badge phía client) và Task 10 (bỏ ghi snapshot trên đường chỉ-đọc). Mỗi task độc lập, chạm vào tập file rời nhau nên có thể giao cho các agent khác nhau chạy song song sau khi Task 1 xong.

**Tech Stack:** Next.js 14 App Router, tRPC 11, Prisma 5, Zod, vitest 4 (+ @testing-library/react, jsdom đã cài sẵn), pnpm.

## Global Constraints

- Ngôn ngữ: tên biến/hàm/file bằng **tiếng Anh**; comment và message UI/toast/log bằng **tiếng Việt** (`docs/coding-rule.md` §1).
- Tuyệt đối không dùng `any` để ép kiểu. Dùng `z.infer`, `RouterInputs`, `RouterOutputs`.
- Logic nghiệp vụ nằm ở `src/server/services/`; router tRPC chỉ gọi service.
- DTO dùng chung đặt ở `src/lib/types/models.ts`.
- Cột số trong Table phải căn phải (`text-right`).
- Không commit `.env`, `.env.test`.
- Mọi task phải kết thúc bằng: `npx tsc --noEmit` sạch **và** `npx next lint` sạch.
- Lệnh test: `pnpm test` (toàn bộ), `pnpm test:unit` (chỉ unit, không cần DB), `pnpm test:integration` (cần DB test).
- **CẢNH BÁO:** integration test dùng CHUNG một database test và `tests/setup.ts` xóa sạch bảng trong `beforeAll`. **Không bao giờ chạy hai tiến trình vitest cùng lúc** — sẽ ra lỗi FK `P2003` giả. Chạy tuần tự.
- Integration test có nhiều round-trip tới DB remote → truyền timeout cho `it(...)`, ví dụ `}, 60000)`. (Task 1 nâng trần chung lên 60s; các task sau Task 1 vẫn có thể ghi rõ cho dễ đọc.)
- Nhánh làm việc: tạo nhánh mới từ `main`, KHÔNG commit thẳng lên `main`.

---

## Bối cảnh: kết quả review 17/09/2026

Nhóm A (8 lỗi logic) đã được sửa ở nhánh `fix/group-a-logic-bugs`. Plan này xử lý phần còn lại.

**Nhóm B — code chết:**

| # | Thứ | Vị trí | Bằng chứng |
|---|-----|--------|-----------|
| B1 | `PaymentDialog.tsx` (267 dòng) | `src/components/tuition/PaymentDialog.tsx` | `grep -rn "PaymentDialog" src` chỉ khớp chính nó. Bản cũ của `TuitionDetailSheet`, còn dùng công thức lỗi thời `totalExpected + previousBalance` thay cho `totalAmountDue`. |
| B2 | `NAV_ITEMS`, `LEVEL`, `SESSION_STATUS` | `src/lib/constants.ts:40,3,24` | 0 tham chiếu. `NAV_ITEMS` còn **thiếu `/tuition`** → nếu ai đó dùng lại sẽ mất menu. `AppSidebar` tự định nghĩa bản riêng. |
| B3 | `timingProcedure` | `src/server/trpc/index.ts:62` | Export, 0 nơi dùng. `protectedProcedure` (dòng 77) đã tự gắn `loggerMiddleware`. |
| B4 | `byGrade` | `src/server/services/report.service.ts:144-157` | Tính O(n²) mỗi request `report.monthlySummary`, không client nào đọc (`grep -rn "byGrade" src --include=*.tsx` → rỗng). |
| B5 | `getMonthlyOutstanding` trả thừa `totalDue`, `totalPaid`, `studentCount` | `src/server/services/tuition.service.ts:384,414` | Cả 2 caller (`getDashboardStats`, `getMonthlySummary`) chỉ destructure `totalOutstanding`. |
| B6 | `getStudentReport` trả nguyên object `student` của Prisma | `src/server/services/report.service.ts:65` | Gồm `userId`, `notes`, `parentPhone`, `parentName` — UI chỉ dùng `fullName`. Lộ dữ liệu phụ huynh ra client không cần thiết. |
| B7 | `ui/switch.tsx`, `ui/tooltip.tsx` | `src/components/ui/` | Boilerplate shadcn, 0 import. Kéo theo `@radix-ui/react-switch`, `@radix-ui/react-tooltip`. |
| B8 | Dependency thừa | `package.json` | `ws`, `@neondatabase/serverless`, `@prisma/adapter-neon` — `src/server/db.ts` dùng `PrismaClient` thuần, không còn Neon adapter. `shadcn` nằm ở `dependencies`. |
| B9 | 12 key i18n không dùng | `src/language/vi.json`, `en.json` | `this_week`, `tuition_with_colon`, `save_changes`, `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`, `total_this_month`, `total_last_month`. |
| B10 | Tham số `studentId` của `calcStudentTuition` | `src/server/services/tuition.service.ts:11` | Không được đụng tới trong thân hàm. |

**Nhóm C — vệ sinh:**

| # | Vấn đề | Vị trí |
|---|--------|--------|
| C1 | `tests/unit/hooks/useCalendar.test.ts` **không bao giờ chạy** — vitest không parse được `.tsx` (`LanguageProvider`) vì thiếu cấu hình JSX. Suite báo "0 test" nhưng vẫn đỏ 1 file. | `vitest.config.ts` |
| C1b | `tests/integration/student-delete-schedule-sync.test.ts` **đỏ chập chờn** vì `testTimeout` mặc định 5s trong khi DB test là Neon remote. Chạy riêng file này: 4 failed / 2 passed, toàn bộ là `Test timed out in 5000ms`, không có assertion nào sai. Đã xác nhận lỗi này có sẵn trên `main`, không do đợt sửa nhóm A. | `vitest.config.ts` |
| C2 | `db.ts` gọi `$extends` lên chính instance đã extend khi HMR → log slow-query nhân đôi ở dev. | `src/server/db.ts:7-27` |
| C3 | Invalidate/refetch thủ công thừa — `TRPCProvider` đã có `MutationCache.onSuccess → invalidateQueries()` toàn cục. | `AttendancePanel.tsx:58`, `app/(app)/tuition/page.tsx` (`onSuccess={() => query.refetch()}`) |
| C4 | `await assertOwnership(...)` — hàm sync trả `void`; `await` phá type-narrowing của assertion signature. | `src/server/services/tuition.service.ts` (trong `updateTuitionPayment`) |
| C5 | Header cột "Học phí" căn trái trong khi cell `text-right` — sai `docs/coding-rule.md` §4. | `src/components/students/StudentList.tsx` |
| C6 | Bộ lọc `status` phía server lệch với badge phía client: server xếp HS trả dư vào nhóm `fully_paid`, nhưng badge hiện "Trả dư". | `src/server/services/tuition.service.ts` (nhánh `status` trong `getMonthlyTuitionStatus`) |
| C7 | `TuitionStatusCard` gọi `tuition.getMonthlyStatus` với `persist=true` từ màn Báo cáo chỉ-đọc → ghi snapshot khi chỉ xem. | `src/components/students/StudentScheduleView.tsx`, `src/server/trpc/routers/tuition.ts` |

---

## File Structure

| File | Trách nhiệm | Thao tác | Task |
|---|---|---|---|
| `vitest.config.ts` | Bật JSX transform + môi trường jsdom cho test `.tsx`/hook. | Modify | 1 |
| `src/components/tuition/PaymentDialog.tsx` | — | **Delete** | 2 |
| `src/lib/constants.ts` | Hằng số dùng chung. | Modify | 3 |
| `src/server/trpc/index.ts` | Khởi tạo tRPC. | Modify | 3 |
| `src/server/services/report.service.ts` | Bỏ `byGrade`, thu hẹp `student`. | Modify | 4 |
| `tests/integration/report.test.ts` | Cập nhật assertion theo API đã thu gọn. | Modify | 4 |
| `src/lib/types/models.ts` | Thêm `StudentReportInfo`. | Modify | 4 |
| `src/server/services/tuition.service.ts` | Bỏ field thừa, bỏ param chết, sửa `await`, đồng bộ filter. | Modify | 5, 8 |
| `src/components/ui/switch.tsx`, `ui/tooltip.tsx` | — | **Delete** | 6 |
| `package.json` | Gỡ dependency thừa. | Modify | 6 |
| `src/language/vi.json`, `en.json` | Gỡ key chết. | Modify | 7 |
| `src/server/db.ts` | Sửa double-`$extends`. | Modify | 8 |
| `src/components/sessions/AttendancePanel.tsx` | Bỏ invalidate thừa. | Modify | 8 |
| `src/app/(app)/tuition/page.tsx` | Bỏ refetch thừa. | Modify | 8 |
| `src/components/students/StudentList.tsx` | Căn phải header. | Modify | 8 |
| `tests/unit/lib/tuition-status.test.ts` | Bổ sung test cho filter server. | Modify | 9 |
| `src/server/trpc/routers/tuition.ts` | Thêm procedure chỉ-đọc. | Modify | 10 |
| `src/components/students/StudentScheduleView.tsx` | Dùng procedure chỉ-đọc. | Modify | 10 |

**Không đụng tới:** `prisma/schema.prisma`, `src/middleware.ts`, `src/server/auth*.ts`, `scripts/`, `src/components/tuition/TuitionStatusBadge.tsx`, `src/lib/tuition-status.ts`.

**Thứ tự:** Task 1 phải xong trước (mở khóa test cho component). Task 2–10 độc lập với nhau, giao song song được.

---

### Task 1: Sửa cấu hình vitest — JSX + timeout

**Files:**
- Modify: `vitest.config.ts`
- Test: `tests/unit/hooks/useCalendar.test.ts` (đã tồn tại, hiện không chạy được)
- Test: `tests/integration/student-delete-schedule-sync.test.ts` (đã tồn tại, đỏ vì timeout)

**Interfaces:**
- Consumes: không có.
- Produces: từ task này trở đi, file test có thể import module `.tsx`. Task khác dựa vào điều này để viết test component.

**Trạng thái xuất phát (đo ngày 17/09/2026, `pnpm test` trên nhánh nhóm A):**
`Test Files 2 failed | 32 passed (34)`, `Tests 1 failed | 248 passed (249)`.
Hai file đỏ chính là C1 và C1b. Task này phải đưa cả hai về xanh.

**Nguyên nhân:** `tsconfig.json` đặt `"jsx": "preserve"` (đúng cho Next.js). Vitest dùng esbuild và kế thừa cấu hình đó, nên gặp `.tsx` thì không parse được. `useCalendar.ts` import `LanguageProvider.tsx` → cả file test chết theo. Lỗi hiện tại:

```
Error: Failed to parse source for import analysis because the content contains
invalid JS syntax. If you use tsconfig.json, make sure to not set jsx to preserve.
File: src/components/providers/LanguageProvider.tsx
```

- [ ] **Step 1: Chạy test để xác nhận nó đang hỏng**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/unit/hooks/useCalendar.test.ts`

Expected: FAIL — `Test Files 1 failed`, `(0 test)`, thông báo "invalid JS syntax".

- [ ] **Step 2: Thêm cấu hình JSX vào vitest.config.ts**

Thêm khối `esbuild` ở cấp cao nhất của `defineConfig` (ngang hàng với `test` và `resolve`):

```ts
export default defineConfig({
  // Vitest dùng esbuild, mà tsconfig đặt jsx:"preserve" cho Next.js nên esbuild
  // không parse được .tsx. Ghi đè ở đây để test import được component/provider
  // (vd: useCalendar.ts import LanguageProvider.tsx).
  esbuild: {
    jsx: "automatic",
  },
  test: {
    // ... giữ nguyên toàn bộ cấu hình hiện có
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
```

- [ ] **Step 3: Đổi environment sang jsdom cho nhánh unit**

`environment: "node"` hiện tại khiến `LanguageProvider` chạm `localStorage`/`document` sẽ nổ. Thêm `environmentMatchGlobs` vào trong khối `test`, ngay dưới dòng `environment: "node"`:

```ts
    environment: "node",
    // Test unit chạm tới component/hook React cần DOM; integration vẫn dùng node
    // cho nhẹ và nhanh.
    environmentMatchGlobs: [
      ["tests/unit/**", "jsdom"],
    ],
```

- [ ] **Step 4: Chạy lại để xác nhận file test đã chạy**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/unit/hooks/useCalendar.test.ts`

Expected: PASS, và số test **lớn hơn 0** (file này có sẵn các case về lưới lịch tháng 4/2026, tháng 2/2026).

- [ ] **Step 5: Xác nhận lỗi timeout C1b tái hiện được**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/integration/student-delete-schedule-sync.test.ts`

Expected: FAIL — khoảng `4 failed | 2 passed`, mọi lỗi đều là `Test timed out in 5000ms`, **không có assertion nào sai**. Nếu thấy assertion sai (số liệu lệch) thì đó là lỗi khác — DỪNG và báo lại, đừng nới timeout để giấu nó.

- [ ] **Step 6: Nâng `testTimeout` lên mức hợp với DB remote**

Thêm vào trong khối `test` của `vitest.config.ts`, ngay dưới `environmentMatchGlobs`:

```ts
    // DB test là Neon remote: một test integration có hàng chục round-trip nên
    // 5s mặc định không đủ và gây đỏ chập chờn (vd
    // student-delete-schedule-sync.test.ts). Nâng trần chung thay vì rải
    // `}, 60000)` ở từng test.
    testTimeout: 60000,
    hookTimeout: 60000,
```

- [ ] **Step 7: Chạy lại file integration đó để xác nhận xanh**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/integration/student-delete-schedule-sync.test.ts`

Expected: PASS cả 6 test.

- [ ] **Step 8: Chạy toàn bộ unit để chắc jsdom không phá test cũ**

Run: `pnpm test:unit`

Expected: PASS toàn bộ, `Test Files` không còn dòng `failed` nào.

- [ ] **Step 9: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch.

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts
git commit -m "fix(test): bật JSX transform + jsdom, nâng testTimeout cho DB remote"
```

---

### Task 2: Xóa `PaymentDialog.tsx`

**Files:**
- Delete: `src/components/tuition/PaymentDialog.tsx`

**Interfaces:**
- Consumes: không có.
- Produces: không có.

**Vì sao xóa được:** `TuitionDetailSheet.tsx` đã thay thế hoàn toàn nó (trang Học phí chỉ import `TuitionDetailSheet`). `PaymentDialog` còn tự tính `Math.max(0, data.totalExpected + data.previousBalance)` trong khi DTO đã có sẵn `totalAmountDue` — giữ lại chỉ tạo rủi ro ai đó copy nhầm công thức cũ.

- [ ] **Step 1: Xác nhận không file nào import**

Run: `grep -rn "PaymentDialog" src tests --include=*.ts --include=*.tsx`

Expected: chỉ ra các dòng nằm TRONG chính `src/components/tuition/PaymentDialog.tsx`. Nếu có bất kỳ file nào khác — **DỪNG**, báo lại, không xóa.

- [ ] **Step 2: Xóa file**

```bash
git rm src/components/tuition/PaymentDialog.tsx
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch (nếu đỏ, tức là có import ẩn — hoàn tác và báo lại).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: xóa PaymentDialog.tsx (code chết, đã bị TuitionDetailSheet thay thế)"
```

---

### Task 3: Gỡ export chết ở `constants.ts` và `trpc/index.ts`

**Files:**
- Modify: `src/lib/constants.ts` (xóa `LEVEL` ở `:3`, `SESSION_STATUS` ở `:24`, `NAV_ITEMS` ở `:40`)
- Modify: `src/server/trpc/index.ts` (xóa `timingProcedure` ở `:62`)

**Interfaces:**
- Consumes: không có.
- Produces: không có.

- [ ] **Step 1: Xác nhận cả 4 đều không có nơi dùng**

```bash
for s in LEVEL SESSION_STATUS NAV_ITEMS timingProcedure; do
  echo "== $s"
  grep -rn "\b$s\b" src tests scripts prisma --include=*.ts --include=*.tsx
done
```

Expected:
- `LEVEL`: chỉ dòng khai báo `src/lib/constants.ts:3`. **Lưu ý:** đừng nhầm với `ATTENDANCE_LABEL`/`ATTENDANCE_STATUS` — dùng `\b` như trên để khớp đúng từ.
- `SESSION_STATUS`: chỉ dòng khai báo `:24`.
- `NAV_ITEMS`: dòng khai báo `:40` và **bản định nghĩa riêng bên trong `src/components/layout/AppSidebar.tsx`** (biến local, giữ nguyên, không đụng).
- `timingProcedure`: chỉ dòng khai báo `src/server/trpc/index.ts:62`.

Nếu khác — DỪNG, báo lại.

- [ ] **Step 2: Xóa 3 hằng số trong `src/lib/constants.ts`**

Xóa nguyên khối:

```ts
export const LEVEL = {
  TIEU_HOC: "tieu_hoc",
  THCS: "thcs",
} as const
```

```ts
export const SESSION_STATUS = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const
```

```ts
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: "LayoutDashboard" },
  { href: "/calendar", label: "Lịch dạy", icon: "CalendarDays" },
  { href: "/students", label: "Học sinh", icon: "Users" },
  { href: "/reports", label: "Báo cáo", icon: "BarChart3" },
] as const
```

Giữ nguyên `GRADES`, `ATTENDANCE_STATUS`, `ATTENDANCE_LABEL`, `DAY_NAMES`, `COLORS`.

- [ ] **Step 3: Xóa `timingProcedure` trong `src/server/trpc/index.ts`**

Xóa dòng:

```ts
export const timingProcedure = t.procedure.use(loggerMiddleware)
```

**Giữ lại** `const loggerMiddleware = ...` — `protectedProcedure` ở dòng 77 vẫn dùng nó.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch.

- [ ] **Step 5: Chạy unit test**

Run: `pnpm test:unit`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.ts src/server/trpc/index.ts
git commit -m "chore: gỡ LEVEL, SESSION_STATUS, NAV_ITEMS, timingProcedure (0 tham chiếu)"
```

---

### Task 4: Thu gọn `report.service.ts` — bỏ `byGrade`, thu hẹp `student`

**Files:**
- Modify: `src/server/services/report.service.ts`
- Modify: `src/lib/types/models.ts`
- Modify: `tests/integration/report.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `report.monthlySummary` **không còn** field `byGrade`.
  - `report.student` trả `student: StudentReportInfo` thay vì nguyên record Prisma.
  - Type mới trong `src/lib/types/models.ts`:
    ```ts
    export type StudentReportInfo = {
      id: number
      fullName: string
      grade: number
      level: SchoolLevel
    }
    ```

**Quyết định & đánh đổi:** `byGrade` được test phủ (`report.test.ts:87-88`) nhưng **không client nào đọc** — đây là code chết có test, xóa cả hai. `summary` của `getStudentReport` **GIỮ NGUYÊN**: tuy UI hiện không dùng (StudentScheduleView tự tính lại), nó được 4 test phủ và là hợp đồng API hợp lệ; gộp hai bản tính trùng nhau là việc riêng, không nhét vào task dọn dẹp này.

- [ ] **Step 1: Sửa test trước — bỏ assertion `byGrade`**

Trong `tests/integration/report.test.ts`, ở test `"report.monthlySummary → trả tổng hợp"`, xóa 2 dòng:

```ts
    expect(summary.byGrade).toHaveLength(9)
    expect(summary.byGrade.find((g: any) => g.grade === 3).sessionCount).toBeGreaterThanOrEqual(2)
```

Thay bằng assertion vào field thực sự có người dùng:

```ts
    expect(summary.totalStudents).toBeGreaterThanOrEqual(1)
    expect(summary.overallAttendanceRate).toBeGreaterThanOrEqual(0)
```

- [ ] **Step 2: Thêm assertion cho `student` đã thu hẹp**

Trong cùng file, ở test `"report.student → trả sessions + summary đúng"`, thêm ngay sau dòng `expect(report.student.fullName).toBe("HS Báo Cáo")`:

```ts
    // student chỉ còn field UI cần — không rò userId / thông tin phụ huynh ra client
    expect(Object.keys(report.student).sort()).toEqual(["fullName", "grade", "id", "level"])
```

- [ ] **Step 3: Chạy test để xác nhận nó fail**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/integration/report.test.ts`

Expected: FAIL ở assertion `Object.keys(...)` (hiện `student` còn có `userId`, `parentPhone`, `parentName`, `notes`, `isActive`, `tuitionFee`, `createdAt`, `updatedAt`).

- [ ] **Step 4: Thêm type `StudentReportInfo`**

Trong `src/lib/types/models.ts`, thêm ngay dưới `export type SchoolLevel = ...`:

```ts
/**
 * Thông tin học sinh tối thiểu cho màn Báo cáo. Cố ý KHÔNG trả nguyên record
 * Prisma: userId và thông tin phụ huynh không có lý do gì để đi ra client.
 */
export type StudentReportInfo = {
  id: number
  fullName: string
  grade: number
  level: SchoolLevel
}
```

- [ ] **Step 5: Thu hẹp `student` trong `getStudentReport`**

Trong `src/server/services/report.service.ts`, sửa phần return của `getStudentReport` (khoảng dòng 64-68). Thay `student,` bằng:

```ts
    student: {
      id: student.id,
      fullName: student.fullName,
      grade: student.grade,
      level: getLevel(student.grade),
    },
```

Thêm import ở đầu file (gộp vào dòng import `@/lib/utils` đã có):

```ts
import { calcAttendanceRate, getLevel, vnDateParts } from "@/lib/utils"
```

- [ ] **Step 6: Xóa khối `byGrade`**

Trong `getMonthlySummary`, xóa nguyên khối tính (khoảng dòng 144-157):

```ts
  // By Grade
  const byGrade = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => {
    const gradeSessions = sessions.filter(s => s.sessionStudents.some(st => st.grade === g))
    const gradeStudentIds = new Set<number>()
    for (const s of sessions) {
      for (const st of s.sessionStudents) {
        if (st.grade === g) gradeStudentIds.add(st.studentId)
      }
    }
    return {
      grade: g,
      sessionCount: gradeSessions.length,
      studentCount: gradeStudentIds.size,
    }
  })
```

Và xóa dòng `byGrade,` trong object return (khoảng dòng 221).

Sửa luôn comment ở dòng ~132 đang nhắc tới `byGrade`: đổi cụm `"so it ties out with byGrade/revenue below"` thành `"so it ties out with revenue below"`.

- [ ] **Step 7: Chạy test để xác nhận pass**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/integration/report.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch. `reports/page.tsx` không dùng `byGrade` nên không cần sửa.

- [ ] **Step 9: Commit**

```bash
git add src/server/services/report.service.ts src/lib/types/models.ts tests/integration/report.test.ts
git commit -m "refactor(report): bỏ byGrade không ai dùng, thu hẹp student trả về của report.student"
```

---

### Task 5: Thu gọn `getMonthlyOutstanding` + bỏ param chết `calcStudentTuition`

**Files:**
- Modify: `src/server/services/tuition.service.ts`

**Interfaces:**
- Consumes: không có.
- Produces: `getMonthlyOutstanding` đổi chữ ký thành:
  ```ts
  export async function getMonthlyOutstanding(
    db: PrismaClient,
    userId: number,
    params: { year: number; month: number; grade?: number }
  ): Promise<{ totalOutstanding: number }>
  ```

- [ ] **Step 1: Xác nhận không ai dùng 3 field kia**

Run: `grep -rn "totalDue\|studentCount" src/server tests --include=*.ts`

Expected: `totalDue` và `studentCount` chỉ xuất hiện bên trong `getMonthlyOutstanding` (`tuition.service.ts` khoảng `:384`, `:405-414`). `studentCount` cũng có ở `SessionListDTO` (`models.ts`) và các component — **khác nhau, không đụng**. Nếu có caller nào destructure `totalDue`/`totalPaid`/`studentCount` từ `getMonthlyOutstanding` — DỪNG, báo lại.

- [ ] **Step 2: Thu gọn kiểu trả về**

Trong `src/server/services/tuition.service.ts`, sửa chữ ký (khoảng `:384`):

```ts
): Promise<{ totalOutstanding: number }> {
```

- [ ] **Step 3: Bỏ phần tích lũy thừa**

Thay vòng lặp cuối hàm:

```ts
  let totalOutstanding = 0
  let totalDue = 0
  let totalPaid = 0
  for (const it of items) {
    totalDue += Math.max(0, it.totalAmountDue)
    totalPaid += it.paidAmount
    // isFullPaid = tất toán tháng cuối kỳ → không còn nợ dương (khớp carry-over)
    totalOutstanding += it.isFullPaid ? 0 : Math.max(0, it.totalAmountDue - it.paidAmount)
  }

  return { totalOutstanding, totalDue, totalPaid, studentCount: items.length }
```

bằng:

```ts
  let totalOutstanding = 0
  for (const it of items) {
    // isFullPaid = tất toán tháng cuối kỳ → không còn nợ dương (khớp carry-over)
    totalOutstanding += it.isFullPaid ? 0 : Math.max(0, it.totalAmountDue - it.paidAmount)
  }

  return { totalOutstanding }
```

- [ ] **Step 4: Bỏ param `studentId` không dùng của `calcStudentTuition`**

Ở đầu file (`:11-17`), xóa dòng `studentId: number,` khỏi danh sách tham số. Chữ ký còn:

```ts
function calcStudentTuition(
  attendance: AttendanceRecord[],
  snapshot: MonthlyTuition | undefined,
  prevSnapshot: MonthlyTuition | undefined,
  historicalBalance: number,
): {
```

Và sửa nơi gọi (trong `getMonthlyTuitionStatus`, khoảng `:201-204`), bỏ `student.id` ở đầu:

```ts
      calcStudentTuition(attendance, snapshot, prevSnapshot, historicalBalances[student.id] ?? 0)
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch.

- [ ] **Step 6: Chạy integration test học phí + dashboard**

Run (tuần tự, KHÔNG song song):

```bash
npx cross-env NODE_ENV=test npx vitest run tests/integration/tuition.test.ts tests/integration/tuition-report-consistency.test.ts tests/integration/group-b-financial.test.ts
```

Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add src/server/services/tuition.service.ts
git commit -m "refactor(tuition): getMonthlyOutstanding chỉ trả totalOutstanding, bỏ param studentId chết"
```

---

### Task 6: Xóa UI component & dependency không dùng

**Files:**
- Delete: `src/components/ui/switch.tsx`, `src/components/ui/tooltip.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: không có.
- Produces: không có.

- [ ] **Step 1: Xác nhận 2 component không ai import**

```bash
grep -rn "components/ui/switch\|components/ui/tooltip" src tests --include=*.ts --include=*.tsx
```

Expected: rỗng. Nếu có — DỪNG.

- [ ] **Step 2: Xác nhận 4 package không ai import**

```bash
for p in ws @neondatabase/serverless @prisma/adapter-neon shadcn; do
  echo "== $p"
  grep -rn "from \"$p\"\|require(\"$p\")\|from \"$p/" src scripts prisma tests --include=*.ts --include=*.tsx
done
```

Expected: rỗng cả 4. Lưu ý `src/server/db.ts` dùng `PrismaClient` thuần, không dùng Neon adapter. Nếu có kết quả — DỪNG, báo lại.

- [ ] **Step 3: Xóa 2 file component**

```bash
git rm src/components/ui/switch.tsx src/components/ui/tooltip.tsx
```

- [ ] **Step 4: Gỡ dependency**

```bash
pnpm remove @radix-ui/react-switch @radix-ui/react-tooltip ws @neondatabase/serverless @prisma/adapter-neon shadcn @types/ws
```

**Lưu ý:** `@types/ws` cũng gỡ theo vì chỉ tồn tại cho `ws`. Nếu `pnpm remove` báo package không có trong `dependencies`, bỏ tên đó ra khỏi lệnh rồi chạy lại phần còn lại.

- [ ] **Step 5: Kiểm tra `pnpm.onlyBuiltDependencies` trong `package.json`**

Khối này hiện liệt kê `["@prisma/client", "@prisma/engines", "prisma", "bcrypt", "esbuild"]`. Giữ nguyên — không liên quan tới các package vừa gỡ. (`bcrypt` ở đây là dư thừa vì dự án dùng `bcryptjs`, nhưng đó là cấu hình build vô hại, **không đụng** trong task này.)

- [ ] **Step 6: Build lại để chắc không gãy**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch.

- [ ] **Step 7: Chạy unit test**

Run: `pnpm test:unit`
Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add -A package.json pnpm-lock.yaml src/components/ui
git commit -m "chore: xóa ui/switch, ui/tooltip và 5 dependency không dùng (ws, neon adapter, shadcn)"
```

---

### Task 7: Gỡ 12 key i18n chết

**Files:**
- Modify: `src/language/vi.json`
- Modify: `src/language/en.json`

**Interfaces:**
- Consumes: không có.
- Produces: không có.

**Bất biến bắt buộc giữ:** hai file phải luôn có **cùng tập key** (hiện 296/296).

- [ ] **Step 1: Xác nhận lại danh sách key chết**

Chạy script quét (dò mọi lời gọi `t("...")` trong `src/`):

```bash
node -e "
const vi=require('./src/language/vi.json');
const fs=require('fs'),path=require('path');
let src='';
function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else if(/\.(ts|tsx)\$/.test(f.name))src+=fs.readFileSync(p,'utf8');}}
walk('src');
const used=new Set([...src.matchAll(/\bt\(\s*[\"'\`]([^\"'\`]+)[\"'\`]/g)].map(m=>m[1]));
console.log(Object.keys(vi).filter(k=>!used.has(k)).join('\n'));
"
```

Expected — đúng 12 key:
```
this_week
tuition_with_colon
save_changes
mon
tue
wed
thu
fri
sat
sun
total_this_month
total_last_month
```

Nếu danh sách khác (vd task khác vừa thêm/bớt key), dùng **kết quả thực tế của script**, không dùng danh sách cứng ở trên.

- [ ] **Step 2: Xóa đúng 12 key đó khỏi cả hai file**

Xóa thủ công từng dòng trong `src/language/vi.json` và `src/language/en.json`. Giữ JSON hợp lệ (không để dấu phẩy thừa ở cuối object).

- [ ] **Step 3: Xác nhận parity + JSON hợp lệ**

```bash
node -e "
const vi=require('./src/language/vi.json'), en=require('./src/language/en.json');
const kv=Object.keys(vi), ke=Object.keys(en);
console.log('vi',kv.length,'en',ke.length);
console.log('thiếu ở en:',kv.filter(k=>!(k in en)));
console.log('thiếu ở vi:',ke.filter(k=>!(k in vi)));
"
```

Expected: `vi 284 en 284`, cả hai mảng thiếu đều rỗng.

- [ ] **Step 4: Xác nhận không key nào đang dùng bị xóa nhầm**

```bash
node -e "
const vi=require('./src/language/vi.json');
const fs=require('fs'),path=require('path');
let src='';
function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else if(/\.(ts|tsx)\$/.test(f.name))src+=fs.readFileSync(p,'utf8');}}
walk('src');
const used=[...new Set([...src.matchAll(/\bt\(\s*[\"'\`]([^\"'\`]+)[\"'\`]/g)].map(m=>m[1]))];
const missing=used.filter(k=>!(k in vi));
console.log('dùng nhưng không có key:',missing);
if(missing.length) process.exit(1);
"
```

Expected: mảng rỗng, exit 0.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch (`Translations = typeof vi` nên key thiếu sẽ lộ ra ở đây).

- [ ] **Step 6: Commit**

```bash
git add src/language/vi.json src/language/en.json
git commit -m "chore(i18n): gỡ 12 key không còn dùng, giữ parity vi/en"
```

---

### Task 8: Vá vệ sinh lặt vặt (C2–C5)

**Files:**
- Modify: `src/server/db.ts`
- Modify: `src/server/services/tuition.service.ts`
- Modify: `src/components/sessions/AttendancePanel.tsx`
- Modify: `src/app/(app)/tuition/page.tsx`
- Modify: `src/components/students/StudentList.tsx`

**Interfaces:**
- Consumes: không có.
- Produces: không có (thuần nội bộ).

- [ ] **Step 1: Sửa double-`$extends` trong `src/server/db.ts` (C2)**

Hiện tại `$extends` được áp lên cả instance đã cache, nên mỗi lần HMR ở dev lại bọc thêm một lớp → log slow-query in ra nhiều lần. Thay toàn bộ thân file bằng:

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    // Bỏ "query" log để tránh I/O stdout chậm 5–20ms mỗi query.
    log: ["error", "warn"],
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now()
        const result = await query(args)
        const duration = Date.now() - start
        if (duration > 100) { // Chỉ log các query chậm > 100ms để tránh noise
          console.log(`[Prisma] ${model}.${operation} - ${duration}ms`)
        }
        return result
      },
    },
  }) as unknown as PrismaClient
}

// $extends CHỈ áp một lần lúc tạo. Trước đây nó được gọi lại trên chính instance
// đã cache ở global, nên mỗi lần HMR lại bọc thêm một lớp middleware và log
// slow-query bị nhân lên.
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

- [ ] **Step 2: Bỏ `await` thừa trên `assertOwnership` (C4)**

Trong `src/server/services/tuition.service.ts`, hàm `updateTuitionPayment`, sửa:

```ts
  await assertOwnership(student, userId)
```

thành:

```ts
  assertOwnership(student, userId)
```

`assertOwnership` là hàm đồng bộ dùng assertion signature (`asserts record is ...`); gọi qua `await` làm TypeScript mất khả năng thu hẹp kiểu.

- [ ] **Step 3: Bỏ invalidate thủ công thừa trong `AttendancePanel.tsx` (C3)**

Trong `removeStudentMutation.onSuccess`, xóa 2 dòng:

```ts
      // Refetch danh sách điểm danh để HS vừa gỡ biến mất ngay (tránh stale).
      utils.attendance.get.invalidate({ sessionId })
```

Sau khi xóa, nếu biến `utils` không còn chỗ dùng nào khác trong file, xóa luôn dòng khai báo:

```ts
  const utils = trpc.useUtils()
```

Lý do: `TRPCProvider` đã cấu hình `MutationCache.onSuccess → client.invalidateQueries()` làm mới TOÀN BỘ query sau mọi mutation.

- [ ] **Step 4: Bỏ refetch thủ công thừa ở trang Học phí (C3)**

Trong `src/app/(app)/tuition/page.tsx`, ở phần render `<TuitionDetailSheet ... />`, đổi:

```tsx
        onSuccess={() => query.refetch()}
```

thành:

```tsx
        onSuccess={() => {}}
```

**Lưu ý:** prop `onSuccess` là bắt buộc theo `TuitionDetailSheetProps` và vẫn được dùng để đóng sheet ở phía component — giữ prop, chỉ bỏ refetch.

- [ ] **Step 5: Căn phải header cột "Học phí" (C5)**

Trong `src/components/students/StudentList.tsx`, đổi:

```tsx
                <TableHead className="w-32">{t("tuition_fee")}</TableHead>
```

thành:

```tsx
                <TableHead className="w-32 text-right">{t("tuition_fee")}</TableHead>
```

(Cell tương ứng đã là `text-right`; `docs/coding-rule.md` §4 yêu cầu cột số căn phải.)

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch.

- [ ] **Step 7: Chạy test**

Run: `pnpm test:unit`, rồi (tuần tự) `npx cross-env NODE_ENV=test npx vitest run tests/integration/attendance.test.ts tests/integration/tuition.test.ts`

Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add src/server/db.ts src/server/services/tuition.service.ts src/components/sessions/AttendancePanel.tsx "src/app/(app)/tuition/page.tsx" src/components/students/StudentList.tsx
git commit -m "chore: sửa double-\$extends prisma, bỏ invalidate/await thừa, căn phải header học phí"
```

---

### Task 9: Đồng bộ bộ lọc `status` phía server với badge phía client (C6)

**Files:**
- Modify: `src/server/services/tuition.service.ts` (nhánh `status` trong `getMonthlyTuitionStatus`)
- Modify: `tests/unit/lib/tuition-status.test.ts`
- Create: `tests/integration/tuition-status-filter.test.ts`

**Interfaces:**
- Consumes: `getTuitionBadgeStatus(item)` và type `TuitionStatusInput` từ `src/lib/tuition-status.ts` (đã tồn tại từ nhánh nhóm A). Chữ ký:
  ```ts
  export function getTuitionBadgeStatus(item: TuitionStatusInput): TuitionBadgeStatus
  export type TuitionBadgeStatus =
    | "overpaid" | "settled_waived" | "fully_paid"
    | "paid_this_month" | "partial" | "unpaid" | "no_sessions"
  ```
- Produces: bộ lọc server dùng chung hàm trên → filter và badge không thể lệch nhau.

**Vấn đề:** dropdown "Trạng thái" lọc ở server bằng một bản chép tay của logic badge. Bản server xếp HS **trả dư** vào nhóm `fully_paid`, còn badge lại hiện "Trả dư" — chọn "Đóng đủ" ra cả HS mà danh sách ghi là "Trả dư". Đây là bản sao thứ ba của cùng một logic (bản trang Học phí và bản màn Báo cáo đã được gộp ở nhánh nhóm A).

**Quyết định:** giữ nguyên **ý nghĩa** các lựa chọn trong dropdown (`fully_paid` vẫn bao gồm cả HS trả dư và HS được miễn/giảm — vì với giáo viên thì cả ba đều là "xong tháng này"), nhưng suy ra từ một nguồn duy nhất.

- [ ] **Step 1: Viết unit test cho mapping filter → trạng thái**

Trước hết sửa dòng import có sẵn ở **đầu** `tests/unit/lib/tuition-status.test.ts` thành:

```ts
import {
  getTuitionBadgeStatus,
  matchesTuitionStatusFilter,
  type TuitionStatusInput,
} from "@/lib/tuition-status"
```

(Đừng thêm `import` ở giữa file — eslint `import/first` sẽ báo lỗi.)

Rồi thêm khối sau vào **cuối** file. Nó dùng lại helper `item()` đã khai báo sẵn ở đầu file:

```ts
describe("matchesTuitionStatusFilter", () => {
  const overpaid = item({ paidAmount: 250000, totalExpected: 200000, totalAmountDue: 200000 })
  const waived = item({ paidAmount: 150000, isFullPaid: true, totalExpected: 200000, totalAmountDue: 200000 })
  const exact = item({ paidAmount: 200000, totalExpected: 200000, totalAmountDue: 200000 })
  const partial = item({ paidAmount: 50000, totalExpected: 200000, totalAmountDue: 200000 })
  const unpaid = item({ totalExpected: 200000, totalAmountDue: 200000 })
  const thisMonth = item({ paidAmount: 200000, totalExpected: 200000, previousBalance: 100000, totalAmountDue: 300000 })

  it("'all' khớp mọi trạng thái", () => {
    for (const i of [overpaid, waived, exact, partial, unpaid, thisMonth]) {
      expect(matchesTuitionStatusFilter(i, "all")).toBe(true)
    }
  })

  it("'fully_paid' gồm trả đủ, trả dư và miễn/giảm", () => {
    expect(matchesTuitionStatusFilter(exact, "fully_paid")).toBe(true)
    expect(matchesTuitionStatusFilter(overpaid, "fully_paid")).toBe(true)
    expect(matchesTuitionStatusFilter(waived, "fully_paid")).toBe(true)
    expect(matchesTuitionStatusFilter(partial, "fully_paid")).toBe(false)
    expect(matchesTuitionStatusFilter(unpaid, "fully_paid")).toBe(false)
  })

  it("'partial' loại trừ nhóm đã xong và nhóm đóng đủ tháng này", () => {
    expect(matchesTuitionStatusFilter(partial, "partial")).toBe(true)
    expect(matchesTuitionStatusFilter(thisMonth, "partial")).toBe(false)
    expect(matchesTuitionStatusFilter(overpaid, "partial")).toBe(false)
  })

  it("'unpaid' chỉ gồm HS chưa đóng đồng nào mà đang nợ", () => {
    expect(matchesTuitionStatusFilter(unpaid, "unpaid")).toBe(true)
    expect(matchesTuitionStatusFilter(partial, "unpaid")).toBe(false)
  })

  it("'paid_this_month' chỉ gồm HS đóng đủ tháng này nhưng còn nợ cũ", () => {
    expect(matchesTuitionStatusFilter(thisMonth, "paid_this_month")).toBe(true)
    expect(matchesTuitionStatusFilter(exact, "paid_this_month")).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/unit/lib/tuition-status.test.ts`
Expected: FAIL — `matchesTuitionStatusFilter` chưa tồn tại.

- [ ] **Step 3: Thêm `matchesTuitionStatusFilter` vào `src/lib/tuition-status.ts`**

Thêm vào cuối file:

```ts
export type TuitionStatusFilter =
  | "all" | "fully_paid" | "paid_this_month" | "partial" | "unpaid"

/**
 * Ánh xạ lựa chọn trong dropdown "Trạng thái" sang trạng thái badge. Suy ra từ
 * getTuitionBadgeStatus thay vì chép lại điều kiện — trước đây bản ở server xếp
 * HS trả dư vào 'fully_paid' trong khi badge hiện "Trả dư", nên chọn "Đóng đủ"
 * lại ra những dòng ghi là "Trả dư".
 *
 * 'fully_paid' CỐ Ý gộp cả trả dư và miễn/giảm: với giáo viên thì cả ba đều là
 * "tháng này xong rồi".
 */
export function matchesTuitionStatusFilter(
  item: TuitionStatusInput,
  filter: TuitionStatusFilter | undefined
): boolean {
  if (!filter || filter === "all") return true

  const status = getTuitionBadgeStatus(item)
  switch (filter) {
    case "fully_paid":
      return status === "fully_paid" || status === "overpaid" || status === "settled_waived"
    case "paid_this_month":
      return status === "paid_this_month"
    case "partial":
      return status === "partial"
    case "unpaid":
      return status === "unpaid"
  }
}
```

- [ ] **Step 4: Chạy unit test để xác nhận pass**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/unit/lib/tuition-status.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Thay khối lọc chép tay ở service**

Trong `src/server/services/tuition.service.ts`, `getMonthlyTuitionStatus`, thay toàn bộ khối bắt đầu bằng `// 7. Lọc theo status` (từ `let filteredResults = results` tới hết `}` đóng của `if (status && status !== "all") {`) bằng:

```ts
  // 7. Lọc theo status — dùng CHUNG helper với badge phía client để hai bên
  // không thể lệch nhau (xem lib/tuition-status).
  const filteredResults =
    status && status !== "all"
      ? results.filter(item => matchesTuitionStatusFilter(item, status))
      : results
```

Thêm import ở đầu file:

```ts
import { matchesTuitionStatusFilter } from "@/lib/tuition-status"
```

- [ ] **Step 6: Viết integration test cho bộ lọc**

Tạo `tests/integration/tuition-status-filter.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

/**
 * Bộ lọc "Trạng thái" phải trả về đúng những dòng mà badge hiển thị cùng nhóm.
 * Trước đây filter server là bản chép tay, xếp HS trả dư vào 'fully_paid' trong
 * khi badge ghi "Trả dư".
 */
describe("Tuition — bộ lọc trạng thái khớp badge", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("lọc 'unpaid' không trả về HS đã đóng một phần", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const paid = await caller.student.create({ fullName: "HS Đóng Một Phần", grade: 4, tuitionFee: 100000 })
    const owing = await caller.student.create({ fullName: "HS Chưa Đóng", grade: 4, tuitionFee: 100000 })

    const s = await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [paid.id, owing.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [
        { studentId: paid.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 },
        { studentId: owing.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 },
      ],
    })
    await caller.tuition.updatePayment({
      studentId: paid.id, year: 2026, month: 5, paidAmount: 40000, isFullPaid: false,
    })

    const res = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 5, status: "unpaid", limit: 100,
    })

    const names = res.items.map(i => i.fullName)
    expect(names).toContain("HS Chưa Đóng")
    expect(names).not.toContain("HS Đóng Một Phần")
  }, 60000)

  it("lọc 'fully_paid' bao gồm cả HS trả dư", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const over = await caller.student.create({ fullName: "HS Trả Dư", grade: 5, tuitionFee: 100000 })

    const s = await caller.session.create({
      sessionDate: "2026-05-11", startTime: "10:00", endTime: "11:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [over.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: over.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })
    await caller.tuition.updatePayment({
      studentId: over.id, year: 2026, month: 5, paidAmount: 150000, isFullPaid: false,
    })

    const res = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 5, status: "fully_paid", limit: 100,
    })

    expect(res.items.map(i => i.fullName)).toContain("HS Trả Dư")
  }, 60000)
})
```

- [ ] **Step 7: Chạy integration test**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/integration/tuition-status-filter.test.ts`
Expected: PASS cả 2 test.

- [ ] **Step 8: Chạy lại các test học phí cũ để chắc không đổi hành vi ngoài ý muốn**

Run (tuần tự): `npx cross-env NODE_ENV=test npx vitest run tests/integration/tuition.test.ts tests/integration/tuition-fullpaid-settlement.test.ts tests/integration/tuition-payment-cancel.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 9: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch.

- [ ] **Step 10: Commit**

```bash
git add src/lib/tuition-status.ts src/server/services/tuition.service.ts tests/unit/lib/tuition-status.test.ts tests/integration/tuition-status-filter.test.ts
git commit -m "fix(tuition): bộ lọc trạng thái dùng chung logic với badge, gộp bản chép thứ ba"
```

---

### Task 10: Đường chỉ-đọc không ghi snapshot (C7)

**Files:**
- Modify: `src/server/trpc/routers/tuition.ts`
- Modify: `src/components/students/StudentScheduleView.tsx`

**Interfaces:**
- Consumes: `getMonthlyTuitionStatus(db, userId, filter, persist)` từ `src/server/services/tuition.service.ts` — tham số thứ 4 `persist` mặc định `true`.
- Produces: procedure mới `tuition.getMonthlyStatusReadOnly` với **cùng input schema** (`monthlyTuitionFilterSchema`) và **cùng kiểu trả về** như `tuition.getMonthlyStatus`.

**Vấn đề:** `TuitionStatusCard` trong màn Báo cáo chỉ hiển thị, nhưng gọi `tuition.getMonthlyStatus` (persist mặc định `true`) nên mỗi lần xem báo cáo lại ghi/cập nhật hàng loạt row `MonthlyTuition`. Service đã có sẵn cờ `persist` cho đúng trường hợp này (`getMonthlyOutstanding` dùng `false`), chỉ là router chưa expose ra.

- [ ] **Step 1: Thêm procedure chỉ-đọc**

Trong `src/server/trpc/routers/tuition.ts`, thêm vào trong `createTRPCRouter({...})`, ngay dưới `getMonthlyStatus`:

```ts
  // Bản CHỈ ĐỌC cho màn báo cáo / thẻ tóm tắt: tính đủ trong bộ nhớ nhưng không
  // materialize snapshot. Tránh việc chỉ mở xem báo cáo cũng ghi hàng loạt row
  // MonthlyTuition.
  getMonthlyStatusReadOnly: protectedProcedure
    .input(monthlyTuitionFilterSchema)
    .query(({ ctx, input }) => getMonthlyTuitionStatus(ctx.db, ctx.userId, input, false)),
```

- [ ] **Step 2: Đổi `TuitionStatusCard` sang procedure mới**

Trong `src/components/students/StudentScheduleView.tsx`, trong component `TuitionStatusCard`, đổi:

```ts
  const { data: statusList, isLoading } = trpc.tuition.getMonthlyStatus.useQuery({
```

thành:

```ts
  const { data: statusList, isLoading } = trpc.tuition.getMonthlyStatusReadOnly.useQuery({
```

- [ ] **Step 3: Thu hẹp luôn query cho đúng HS đang xem**

Cùng chỗ đó, hiện query lấy `limit: 1000` rồi `.find()` ở client. Truyền thẳng `studentId` để server chỉ trả 1 dòng:

```ts
  const { data: statusList, isLoading } = trpc.tuition.getMonthlyStatusReadOnly.useQuery({
    year,
    month,
    studentId,
    limit: 1,
  })

  const status = statusList?.items[0]
```

Xóa dòng cũ `const status = statusList?.items.find(s => s.studentId === studentId)`.

- [ ] **Step 4: Viết integration test xác nhận không ghi snapshot**

Tạo `tests/integration/tuition-readonly-no-write.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

describe("tuition.getMonthlyStatusReadOnly", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("trả đúng số tiền nhưng KHÔNG tạo row MonthlyTuition", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({
      fullName: "HS Chỉ Xem", grade: 7, tuitionFee: 100000,
    })
    const s = await caller.session.create({
      sessionDate: "2026-05-12", startTime: "14:00", endTime: "15:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })

    const res = await caller.tuition.getMonthlyStatusReadOnly({
      year: 2026, month: 5, studentId: student.id, limit: 1,
    })

    expect(res.items[0].totalExpected).toBe(100000)
    expect(res.items[0].totalAmountDue).toBe(100000)

    const rows = await db.monthlyTuition.count({ where: { studentId: student.id } })
    expect(rows).toBe(0)
  }, 60000)

  it("bản có persist (getMonthlyStatus) VẪN tạo row — không đổi hành vi trang Học phí", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({
      fullName: "HS Trang Học Phí", grade: 7, tuitionFee: 100000,
    })
    const s = await caller.session.create({
      sessionDate: "2026-05-13", startTime: "14:00", endTime: "15:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })

    await caller.tuition.getMonthlyStatus({
      year: 2026, month: 5, studentId: student.id, limit: 1,
    })

    const rows = await db.monthlyTuition.count({ where: { studentId: student.id } })
    expect(rows).toBe(1)
  }, 60000)
})
```

- [ ] **Step 5: Chạy test**

Run: `npx cross-env NODE_ENV=test npx vitest run tests/integration/tuition-readonly-no-write.test.ts`
Expected: PASS cả 2 test.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: cả hai sạch.

- [ ] **Step 7: Commit**

```bash
git add src/server/trpc/routers/tuition.ts src/components/students/StudentScheduleView.tsx tests/integration/tuition-readonly-no-write.test.ts
git commit -m "perf(tuition): thẻ học phí ở Báo cáo dùng procedure chỉ-đọc, không ghi snapshot"
```

---

## Kiểm tra cuối cùng (chạy sau khi TẤT CẢ task xong)

- [ ] **Step 1: Chạy toàn bộ test suite MỘT LẦN, tuần tự**

Run: `pnpm test`

Expected: `Test Files` không có dòng `failed`. Mốc so sánh trước khi bắt đầu plan này: `2 failed | 32 passed (34)` file, `1 failed | 248 passed (249)` test — sau khi xong phải là **0 failed**, và tổng số test phải **tăng** (Task 1 mở khóa `useCalendar.test.ts`, Task 9 và 10 thêm test mới).

Nếu gặp lỗi Prisma `P2003` trên `monthly_tuition_student_id_fkey` — gần như chắc chắn là do có tiến trình vitest khác đang chạy song song trên cùng DB test; dừng hết rồi chạy lại.

- [ ] **Step 2: Build production**

Run: `npx next build`

Expected: build thành công. (Lưu ý script `pnpm build` có kèm `prisma migrate deploy` — chỉ chạy `npx next build` nếu không muốn đụng DB.)

- [ ] **Step 3: Xác nhận không còn code chết nào sót**

```bash
npx next lint
grep -rn "PaymentDialog\|timingProcedure\|SESSION_STATUS\|byGrade" src tests --include=*.ts --include=*.tsx
```

Expected: lint sạch, grep rỗng.

---

## Phụ lục: những thứ CỐ Ý không đụng tới

Ghi lại để lần review sau không đề xuất lại:

| Thứ | Lý do giữ |
|---|---|
| `getStudentReport().summary` | Không UI nào dùng, nhưng có 4 integration test phủ và là hợp đồng API hợp lệ. Việc gộp nó với bản tính trùng ở `StudentScheduleView` là refactor riêng, không nhét vào đợt dọn dẹp. |
| Trạng thái `late` trong backend | Panel điểm danh chỉ còn 2 nút nên không tạo bản ghi mới, nhưng dữ liệu `late` cũ trong DB vẫn phải tính đúng. Chủ dự án đã chốt: giữ backend, chỉ ẩn ô hiển thị khi rỗng (đã làm ở nhánh nhóm A). |
| `bcrypt` trong `pnpm.onlyBuiltDependencies` | Dự án dùng `bcryptjs`, mục này thừa nhưng vô hại; đụng vào cấu hình build có rủi ro không tương xứng lợi ích. |
| `NAV_ITEMS` local trong `AppSidebar.tsx` | Là bản đang hoạt động (có `/tuition`, có i18n). Chỉ xóa bản chết trong `constants.ts`. |
| `formatToday()` dùng giờ local | Đúng — đây là mốc "ngày xuất file" chạy ở client, khác với mốc nghiệp vụ phía server (đã xử lý bằng `vnDateParts` ở nhánh nhóm A). |
| `src/components/ui/*` còn lại | Đều có ít nhất 1 nơi import. |
