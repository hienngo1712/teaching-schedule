# Excel Export: Thêm Section Học Phí cho Báo Cáo 1 Học Sinh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi xuất Excel cho 1 học sinh (nút `export_student`), file Excel hiển thị thêm block "HỌC PHÍ THÁNG X" ở phần header (trước bảng điểm danh), gồm: học phí/buổi, học phí tháng này, nợ tháng trước, và tổng cần đóng.

**Architecture:**
- Backend: thêm `studentId?: number` vào `monthlyTuitionFilterSchema` + update `getMonthlyTuitionStatus` service để filter theo studentId (bypass grade/isActive filter khi có studentId).
- Frontend: `ExportExcelButton` thêm `trpc.tuition.getMonthlyStatus.useQuery` triggered bởi `selectedStudentId`; `useExcelExport.exportStudentSchedule` nhận thêm param `tuitionInfo?` và render block học phí trước bảng điểm danh bằng cách shift row index động.

**Tech Stack:** tRPC v11, Zod, ExcelJS, Prisma, Vitest (integration tests).

---

## File Structure

**Modified:**
- `src/lib/schemas/tuition.ts` — thêm `studentId` optional vào `monthlyTuitionFilterSchema`
- `src/server/services/tuition.service.ts` — destructure `studentId` từ filter, thêm vào where clause của `db.student.findMany`
- `src/hooks/useExcelExport.ts` — cập nhật signature `exportStudentSchedule` nhận thêm `tuitionInfo?`, render tuition block với dynamic row offset
- `src/components/reports/ExportExcelButton.tsx` — thêm `trpc.tuition.getMonthlyStatus.useQuery`, truyền `tuitionInfo` vào `exportStudentSchedule`

**Test modified:**
- `tests/integration/tuition.test.ts` — thêm test cases cho `studentId` filter

---

## Task 1: Mở rộng Zod schema tuition với `studentId`

**Files:**
- Modify: `src/lib/schemas/tuition.ts`

- [ ] **Step 1.1: Thêm `studentId` vào `monthlyTuitionFilterSchema`**

Mở file `src/lib/schemas/tuition.ts`, thêm field `studentId` vào schema:

```typescript
// src/lib/schemas/tuition.ts
import { z } from "zod"
import { paginationSchema } from "./common"

export const monthlyTuitionFilterSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  grade: z.number().int().min(1).max(9).optional(),
  search: z.string().optional(),
  studentId: z.number().int().positive().optional(),   // ← mới
  status: z.enum(["all", "fully_paid", "paid_this_month", "partial", "unpaid"]).optional(),
}).merge(paginationSchema)

export type MonthlyTuitionFilterInput = z.infer<typeof monthlyTuitionFilterSchema>

export const updatePaymentSchema = z.object({
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  paidAmount: z.number().int().min(0),
  isFullPaid: z.boolean(),
  notes: z.string().optional().nullable(),
})

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
```

- [ ] **Step 1.2: Commit schema change**

```bash
git add src/lib/schemas/tuition.ts
git commit -m "feat(schema): add optional studentId filter to monthlyTuitionFilterSchema"
```

---

## Task 2: Update tuition service để filter theo `studentId`

**Files:**
- Modify: `src/server/services/tuition.service.ts` (dòng 65–94)

**Ngữ cảnh:** Hàm `getMonthlyTuitionStatus` hiện tại build `where` clause cho `db.student.findMany` theo logic:
- Nếu có `grade` → filter theo `sessionStudents.grade` (không lọc `isActive`)
- Nếu không có `grade` → filter `isActive: true`

Ta thêm ưu tiên `studentId`: nếu có `studentId`, chỉ tìm đúng student đó (bỏ qua `grade`/`isActive`).

- [ ] **Step 2.1: Destructure `studentId` từ filter và cập nhật where clause**

Sửa phần `const { year, month, ... } = filter` và `db.student.findMany`:

```typescript
// src/server/services/tuition.service.ts
// Thay dòng 70:
const { year, month, grade, search, status, page, limit } = filter
// Thành:
const { year, month, grade, search, studentId, status, page, limit } = filter
```

Tiếp theo, sửa where clause trong `db.student.findMany` (dòng 73–94):

```typescript
const students = await db.student.findMany({
  where: {
    userId,
    // studentId có ưu tiên cao nhất — bypass cả grade lẫn isActive filter
    ...(studentId
      ? { id: studentId }
      : grade
      ? {
          sessionStudents: {
            some: {
              grade,
              session: {
                sessionDate: {
                  gte: new Date(Date.UTC(year, month - 1, 1)),
                  lt: new Date(Date.UTC(year, month, 1)),
                },
              },
            },
          },
        }
      : { isActive: true }),
    ...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),
  },
  orderBy: [{ grade: "asc" }, { fullName: "asc" }],
})
```

- [ ] **Step 2.2: Commit service change**

```bash
git add src/server/services/tuition.service.ts
git commit -m "feat(tuition): support studentId filter in getMonthlyTuitionStatus"
```

---

## Task 3: Viết và chạy integration tests cho `studentId` filter

**Files:**
- Modify: `tests/integration/tuition.test.ts`

**Setup pattern:** Xem các test hiện tại trong file để biết cách dùng `getAuthedCaller()`, tạo student, session, attendance.

- [ ] **Step 3.1: Thêm test case — `studentId` filter trả về đúng 1 học sinh**

Thêm vào cuối `describe("Tuition Management", ...)` block:

```typescript
it("✓ getMonthlyStatus với studentId → chỉ trả về đúng học sinh đó", async () => {
  const caller = await getAuthedCaller()
  const subjects = await caller.subject.list({})
  const subjectId = subjects[0].id

  // Tạo 2 học sinh
  const studentA = await caller.student.create({ fullName: "Trần Thị B", grade: 2, tuitionFee: 120000 })
  const studentB = await caller.student.create({ fullName: "Lê Văn C", grade: 4, tuitionFee: 80000 })

  // Tạo session tháng 5/2026 và assign cả 2
  const session = await caller.session.create({
    sessionDate: "2026-05-10",
    startTime: "08:00",
    endTime: "09:30",
    subjectId,
  })
  await caller.session.addStudents({ sessionId: session.id, studentIds: [studentA.id, studentB.id] })
  await caller.attendance.mark({ sessionId: session.id, studentId: studentA.id, status: "present" })
  await caller.attendance.mark({ sessionId: session.id, studentId: studentB.id, status: "present" })

  // Query chỉ lấy studentA
  const result = await caller.tuition.getMonthlyStatus({
    year: 2026,
    month: 5,
    studentId: studentA.id,
  })

  expect(result.items).toHaveLength(1)
  expect(result.items[0].studentId).toBe(studentA.id)
  expect(result.items[0].fullName).toBe("Trần Thị B")
  expect(result.items[0].totalExpected).toBe(120000) // 1 buổi × 120,000
})
```

- [ ] **Step 3.2: Thêm test case — `studentId` filter khi student không có session trong tháng**

```typescript
it("✓ getMonthlyStatus với studentId không có session trong tháng → totalExpected = 0", async () => {
  const caller = await getAuthedCaller()

  const student = await caller.student.create({ fullName: "Phạm Văn D", grade: 3, tuitionFee: 100000 })

  // Không tạo session nào cho tháng 5/2026
  const result = await caller.tuition.getMonthlyStatus({
    year: 2026,
    month: 5,
    studentId: student.id,
  })

  expect(result.items).toHaveLength(1)
  expect(result.items[0].studentId).toBe(student.id)
  expect(result.items[0].totalExpected).toBe(0)
  expect(result.items[0].previousBalance).toBe(0)
  expect(result.items[0].totalAmountDue).toBe(0)
})
```

- [ ] **Step 3.3: Thêm test case — `studentId` filter kết hợp `previousBalance`**

```typescript
it("✓ getMonthlyStatus với studentId có nợ tháng trước → previousBalance tính đúng", async () => {
  const caller = await getAuthedCaller()
  const subjects = await caller.subject.list({})
  const subjectId = subjects[0].id

  const student = await caller.student.create({ fullName: "Ngô Thị E", grade: 5, tuitionFee: 150000 })

  // Tạo session tháng 4/2026 → có mặt → fee = 150,000
  const sessionApr = await caller.session.create({
    sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId,
  })
  await caller.session.addStudents({ sessionId: sessionApr.id, studentIds: [student.id] })
  await caller.attendance.mark({ sessionId: sessionApr.id, studentId: student.id, status: "present" })

  // Snapshot tháng 4 với paidAmount = 0 (chưa đóng)
  // getMonthlyStatus tháng 4 trước để tạo snapshot
  await caller.tuition.getMonthlyStatus({ year: 2026, month: 4, studentId: student.id })

  // Query tháng 5 → previousBalance phải = 150,000
  const result = await caller.tuition.getMonthlyStatus({
    year: 2026,
    month: 5,
    studentId: student.id,
  })

  expect(result.items[0].previousBalance).toBe(150000)
  expect(result.items[0].totalAmountDue).toBe(150000) // chưa có session tháng 5
})
```

- [ ] **Step 3.4: Chạy integration tests**

```bash
pnpm test:integration -- tests/integration/tuition.test.ts
```

Expected output: tất cả test PASS (kể cả test cũ).

- [ ] **Step 3.5: Commit tests**

```bash
git add tests/integration/tuition.test.ts
git commit -m "test(tuition): add integration tests for studentId filter"
```

---

## Task 4: Cập nhật `useExcelExport` — thêm tuition block vào Excel

**Files:**
- Modify: `src/hooks/useExcelExport.ts`

**Ngữ cảnh layout hiện tại của `exportStudentSchedule`:**
```
Row 1  : "BÁO CÁO LỊCH HỌC CÁ NHÂN"
Row 2  : "Học sinh: X | Lớp: X"
Row 3  : "Kỳ báo cáo: X | Ngày xuất: X"
Row 4  : (trống — tồn tại do hardcode const headerRow = sheet.getRow(5))
Row 5  : Header row (STT, Ngày, Thứ, Giờ, Điểm danh, Ghi chú)
Row 6+ : Data rows
Last   : Summary line
```

**Layout sau khi có tuition block (khi `tuitionInfo` được truyền vào):**
```
Row 1  : "BÁO CÁO LỊCH HỌC CÁ NHÂN"
Row 2  : "Học sinh: X | Lớp: X"
Row 3  : "Kỳ báo cáo: X | Ngày xuất: X"
Row 4  : (blank separator)
Row 5  : "─── HỌC PHÍ THÁNG 5/2026 ───" (section header)
Row 6  : label "Học phí/buổi"   | value "120.000 đ"
Row 7  : label "Học phí tháng này" | value "840.000 đ"
Row 8  : label "Nợ tháng trước"  | value "0 đ"
Row 9  : label "TỔNG CẦN ĐÓNG"  | value "840.000 đ" (bold, yellow bg)
Row 10 : (blank separator)
Row 11 : Header row (STT, Ngày, Thứ, Giờ, Điểm danh, Ghi chú)
Row 12+: Data rows
Last   : Summary line
```

Khi không có `tuitionInfo` (undefined), layout giữ nguyên như cũ (backward-compatible).

- [ ] **Step 4.1: Cập nhật import và type cho `exportStudentSchedule`**

Thêm import `formatCurrency` ở đầu file:

```typescript
// src/hooks/useExcelExport.ts — đầu file, update dòng import utils
import { formatDate, formatDayOfWeek, removeVietnameseTones, formatCurrency } from "@/lib/utils"
```

- [ ] **Step 4.2: Cập nhật signature `exportStudentSchedule`**

Thay phần khai báo function (từ dòng 96):

```typescript
// Chế độ 2: Lịch 1 học sinh
const exportStudentSchedule = async (
  student: { fullName: string; grade: number },
  sessions: SessionDTO[],
  summary: { total: number; present: number; absent: number; late: number; rate: number },
  period: string,
  tuitionInfo?: {
    tuitionFeePerSession: number   // student.tuitionFee (mặc định/buổi)
    currentMonthFee: number        // TuitionStatusDTO.totalExpected
    previousBalance: number        // TuitionStatusDTO.previousBalance
    totalAmountDue: number         // TuitionStatusDTO.totalAmountDue
  }
) => {
```

- [ ] **Step 4.3: Thêm tuition block và dynamic row offset**

Thay toàn bộ body function `exportStudentSchedule` (từ sau `setIsExporting(true)` tới trước `finally`):

```typescript
  setIsExporting(true)
  try {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(student.fullName)

    sheet.getCell("A1").value = "BÁO CÁO LỊCH HỌC CÁ NHÂN"
    sheet.getCell("A1").font = { size: 16, bold: true }

    sheet.getCell("A2").value = `Học sinh: ${student.fullName} | Lớp: ${student.grade}`
    sheet.getCell("A3").value = `Kỳ báo cáo: ${period} | Ngày xuất: ${formatDate(new Date())}`

    // --- Tuition block (rows 5–9, chỉ khi có tuitionInfo) ---
    let headerRowIdx = 5 // default khi không có tuition block

    if (tuitionInfo) {
      headerRowIdx = 11 // header bảng điểm danh dịch xuống

      // Row 5: Section title
      const tuitionTitleCell = sheet.getCell("A5")
      tuitionTitleCell.value = `─── HỌC PHÍ ${period.toUpperCase()} ───`
      tuitionTitleCell.font = { bold: true, size: 12 }

      // Row 6: Học phí/buổi
      sheet.getCell("A6").value = "Học phí/buổi"
      sheet.getCell("B6").value = formatCurrency(tuitionInfo.tuitionFeePerSession)
      sheet.getCell("B6").alignment = { horizontal: "right" }

      // Row 7: Học phí tháng này
      sheet.getCell("A7").value = "Học phí tháng này"
      sheet.getCell("B7").value = formatCurrency(tuitionInfo.currentMonthFee)
      sheet.getCell("B7").alignment = { horizontal: "right" }

      // Row 8: Nợ tháng trước
      sheet.getCell("A8").value = "Nợ tháng trước"
      sheet.getCell("B8").value = formatCurrency(tuitionInfo.previousBalance)
      sheet.getCell("B8").alignment = { horizontal: "right" }
      if (tuitionInfo.previousBalance > 0) {
        sheet.getCell("B8").font = { color: { argb: EXCEL_COLORS.absent }, bold: true }
      }

      // Row 9: TỔNG CẦN ĐÓNG (highlighted)
      const totalLabelCell = sheet.getCell("A9")
      const totalValueCell = sheet.getCell("B9")
      totalLabelCell.value = "TỔNG CẦN ĐÓNG"
      totalLabelCell.font = { bold: true, size: 12 }
      totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } } // yellow-100
      totalValueCell.value = formatCurrency(tuitionInfo.totalAmountDue)
      totalValueCell.font = { bold: true, size: 12, color: { argb: "FF856404" } } // amber-800
      totalValueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } }
      totalValueCell.alignment = { horizontal: "right" }

      // Row 10: blank separator — không cần set, chỉ skip
    }

    // --- Bảng điểm danh ---
    const headerRow = sheet.getRow(headerRowIdx)
    headerRow.values = ["STT", "Ngày", "Thứ", "Giờ", "Điểm danh", "Ghi chú"]
    headerRow.font = { bold: true, color: { argb: EXCEL_COLORS.white } }
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.primary } }
    })

    sessions.forEach((s, i) => {
      const st = s.students.find(ss => ss.fullName === student.fullName)
      const row = sheet.getRow(headerRowIdx + 1 + i)
      row.values = [
        i + 1,
        formatDate(s.sessionDate),
        formatDayOfWeek(s.sessionDate),
        `${s.startTime}-${s.endTime}`,
        st ? ATTENDANCE_LABEL[st.attendance as keyof typeof ATTENDANCE_LABEL] : "N/A",
        st?.note || ""
      ]

      const attendanceCell = row.getCell(5)
      if (st?.attendance === ATTENDANCE_STATUS.PRESENT) attendanceCell.font = { color: { argb: EXCEL_COLORS.present } }
      if (st?.attendance === ATTENDANCE_STATUS.ABSENT) attendanceCell.font = { color: { argb: EXCEL_COLORS.absent } }
      if (st?.attendance === ATTENDANCE_STATUS.LATE) attendanceCell.font = { color: { argb: EXCEL_COLORS.late } }
    })

    const lastRowIdx = headerRowIdx + 1 + sessions.length + 1
    sheet.getCell(`A${lastRowIdx}`).value = `Tổng: ${summary.total} | Có mặt: ${summary.present} | Vắng: ${summary.absent} | Muộn: ${summary.late} | Tỉ lệ: ${summary.rate}%`
    sheet.getCell(`A${lastRowIdx}`).font = { bold: true }

    sheet.columns.forEach(col => col.width = 15)
    sheet.getColumn(6).width = 30
    sheet.getColumn(2).width = 12  // Ngày
    sheet.getColumn(1).width = 6   // STT

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = removeVietnameseTones(`LichHoc_${student.fullName}_${period}`)
    saveAs(new Blob([buffer]), `${filename}.xlsx`)
  } finally {
    setIsExporting(false)
  }
```

- [ ] **Step 4.4: Commit hook changes**

```bash
git add src/hooks/useExcelExport.ts
git commit -m "feat(excel): add tuition block to student schedule export"
```

---

## Task 5: Cập nhật `ExportExcelButton` — fetch và truyền tuition data

**Files:**
- Modify: `src/components/reports/ExportExcelButton.tsx`

**Ngữ cảnh:**
- `ExportExcelButton` đã dùng hooks `useCalendar`, `useFilters` internally — pattern này nhất quán với việc thêm tRPC query.
- `trpc.tuition.getMonthlyStatus` trả về `PaginatedResponse<TuitionStatusDTO>` — lấy `items[0]` cho học sinh duy nhất.
- Query chỉ enabled khi `selectedStudentId` tồn tại.
- `StudentDTO` có field `tuitionFee` (default fee/buổi của học sinh).

- [ ] **Step 5.1: Thêm tRPC query cho tuition data**

Thêm vào phần import và body của component:

```typescript
// src/components/reports/ExportExcelButton.tsx
"use client"

import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useExcelExport } from "@/hooks/useExcelExport"
import { useCalendar } from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import type { SessionDTO, StudentDTO } from "@/lib/types/models"
import { useSession } from "next-auth/react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"   // ← thêm import trpc

interface ExportExcelButtonProps {
  sessions: SessionDTO[]
  students?: StudentDTO[]
}

export function ExportExcelButton({ sessions, students = [] }: ExportExcelButtonProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { isExporting, exportMonthlySchedule, exportStudentSchedule, exportGradeReport, exportAttendanceSummary } = useExcelExport()
  const { year, month } = useCalendar()
  const { selectedGrade, selectedStudentId } = useFilters()

  // Fetch tuition data cho học sinh đang được chọn
  const { data: tuitionData } = trpc.tuition.getMonthlyStatus.useQuery(
    { year, month, studentId: selectedStudentId ?? undefined },
    { enabled: !!selectedStudentId }
  )

  function handleExportStudent() {
    if (!selectedStudentId) return
    const studentSessions = sessions.filter(s =>
      s.students.some(st => st.studentId === selectedStudentId)
    )
    const studentInfo = students.find(s => s.id === selectedStudentId)
    const { present, absent, late } = studentSessions.reduce(
      (acc, s) => {
        const att = s.students.find(st => st.studentId === selectedStudentId)?.attendance
        if (att === ATTENDANCE_STATUS.PRESENT) acc.present++
        else if (att === ATTENDANCE_STATUS.ABSENT) acc.absent++
        else if (att === ATTENDANCE_STATUS.LATE) acc.late++
        return acc
      },
      { present: 0, absent: 0, late: 0 }
    )
    const total = studentSessions.length
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    // Build tuitionInfo nếu đã fetch xong
    const studentTuition = tuitionData?.items?.[0]
    const tuitionInfo = studentTuition
      ? {
          tuitionFeePerSession: studentInfo?.tuitionFee ?? 0,
          currentMonthFee: studentTuition.totalExpected,
          previousBalance: studentTuition.previousBalance,
          totalAmountDue: studentTuition.totalAmountDue,
        }
      : undefined

    exportStudentSchedule(
      { fullName: studentInfo?.fullName || t("student"), grade: studentInfo?.grade || 0 },
      studentSessions,
      { total, present, absent, late, rate },
      `${t("month")} ${month}/${year}`,
      tuitionInfo  // ← truyền thêm
    )
  }

  const teacherName = session?.user?.fullName || t("teacher_fallback")

  const displayStudents = selectedGrade
    ? students.filter(s => s.grade === selectedGrade)
    : students

  const displaySessions = selectedGrade
    ? sessions.filter(s => s.students.some(st => st.grade === selectedGrade))
    : sessions

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
          )}
          {t("export_excel")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("export_options")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => exportMonthlySchedule(displaySessions, year, month, teacherName)}>
          📅 {t("export_monthly")} {selectedGrade ? `(${t("grade")} ${selectedGrade})` : ""}
        </DropdownMenuItem>

        {selectedStudentId && (
          <DropdownMenuItem onClick={handleExportStudent}>
            👤 {t("export_student")}
          </DropdownMenuItem>
        )}

        {selectedGrade && (
          <DropdownMenuItem onClick={() => exportGradeReport(selectedGrade, students, sessions, year, month)}>
            🏫 {t("export_by_grade")} {selectedGrade}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => exportAttendanceSummary(displayStudents, displaySessions, year, month)}>
          📊 {t("export_attendance")} {selectedGrade ? `(${t("grade")} ${selectedGrade})` : ""}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 5.2: Commit component changes**

```bash
git add src/components/reports/ExportExcelButton.tsx
git commit -m "feat(reports): pass tuition data to student Excel export"
```

---

## Task 6: Manual verification — chạy app và kiểm tra file Excel

- [ ] **Step 6.1: Chạy dev server**

```bash
pnpm dev
```

- [ ] **Step 6.2: Kiểm tra flow xuất Excel**

1. Mở `http://localhost:3000/reports`
2. Chọn tháng/năm có dữ liệu điểm danh
3. Chọn 1 học sinh trong dropdown
4. Click "Xuất Excel" → "👤 Lịch 1 học sinh"
5. Mở file `.xlsx` download được

**Kiểm tra trong file Excel:**
- [ ] Rows 1–3: header info (tên học sinh, kỳ báo cáo) ✓
- [ ] Row 5: tiêu đề section "─── HỌC PHÍ THÁNG X/YYYY ───" ✓
- [ ] Row 6: "Học phí/buổi" | giá trị đúng (VD: "120.000 đ") ✓
- [ ] Row 7: "Học phí tháng này" | tổng = số buổi tính phí × học phí/buổi ✓
- [ ] Row 8: "Nợ tháng trước" | đỏ nếu > 0 ✓
- [ ] Row 9: "TỔNG CẦN ĐÓNG" | nền vàng, chữ đậm ✓
- [ ] Row 11: header bảng điểm danh ✓
- [ ] Row 12+: danh sách buổi học ✓
- [ ] Dòng cuối: tổng kết điểm danh ✓

- [ ] **Step 6.3: Kiểm tra backward compatibility — học sinh KHÔNG có tuition data**

Nếu tháng được chọn chưa từng được fetch tuition (chưa có snapshot), tuition query vẫn trả về items với `totalExpected = 0`. Kiểm tra file Excel vẫn render đúng (TỔNG CẦN ĐÓNG = 0 đ).

- [ ] **Step 6.4: Kiểm tra trường hợp không có `selectedStudentId` (export_monthly)**

Export lịch tháng (không chọn học sinh) → Excel không bị ảnh hưởng, không có block học phí. ✓

---

## Edge Cases & Potential Issues

| Tình huống | Xử lý |
|-----------|-------|
| `tuitionData` chưa load khi user click export | `tuitionInfo = undefined` → export không có block học phí (graceful fallback) |
| Học sinh có `tuitionFee = 0` | Block học phí vẫn hiện, tất cả giá trị = "0 đ" |
| `previousBalance < 0` (đã trả dư) | Hiển thị số âm, không tô đỏ (điều kiện `> 0`) |
| `totalAmountDue = 0` | Block học phí vẫn hiện đúng |
| Student bị inactive (isActive = false) | `studentId` filter bypass `isActive` → vẫn tìm được, hiển thị đúng |
| Nhiều học sinh cùng tên | `items[0]` theo `studentId` filter → chỉ trả về đúng 1 người theo ID |
| `month` period string trong tên file | `removeVietnameseTones` xử lý ký tự đặc biệt |

---

## Checklist tổng kết trước commit cuối

- [ ] `pnpm build` — không có TypeScript error
- [ ] `pnpm test:integration -- tests/integration/tuition.test.ts` — tất cả pass
- [ ] File Excel download được và có đầy đủ block học phí
- [ ] Backward compatibility: export không chọn student vẫn hoạt động bình thường
