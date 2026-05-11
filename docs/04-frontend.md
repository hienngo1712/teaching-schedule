# 04 — Frontend: Components & Hooks

## Routing

```
/login          → public
/               → redirect /dashboard
/dashboard      → auth required — TRANG CHÍNH
/calendar       → auth required — quản lý lịch dạy
/students       → auth required — quản lý HS
/tuition        → auth required — quản lý đóng học phí
/reports        → auth required — báo cáo + export
```

---

## Layout

### AppLayout.tsx
- Sidebar trái 240px (collapsible trên mobile)
- Main content chiếm phần còn lại
- Wrap tất cả trang authenticated

### AppSidebar.tsx
```
Icon + Label (lucide-react icons):
  LayoutDashboard  → Tổng quan        /dashboard
  CalendarDays     → Lịch dạy         /calendar
  Users            → Học sinh         /students
  Wallet           → Học phí          /tuition
  BarChart3        → Báo cáo          /reports
```
- Active item highlight indigo-600
- Mobile: ẩn sidebar, hiện hamburger button

### AppHeader.tsx
- "Xin chào, [fullName]"
- Language Switcher: Nút chuyển đổi VI/EN sử dụng `DropdownMenu`
- Avatar initials (2 chữ cái đầu tên)
- Button Logout → signOut() → redirect /login

---

## Calendar Page (`/calendar`)

### Layout tổng thể
```
┌────────────────────────────────────────────────────────┐
│ FilterBar                                               │
│ [Lớp ▼] [Tên HS: ___] [◄ Tháng 4/2026 ►]            │
│ [+ Tạo ca]  [+ Lịch lặp]  [📥 Xuất Excel ▼]          │
├────────────────────────────────────────────────────────┤
│ MonthCalendar                                          │
│ T2   T3   T4   T5   T6   T7   CN                      │
│ ──   01   02   03   04   05   06                       │
│       ·   8:00      14:00 ·   9:00                    │
│           NhómA     Lớp7      L1-2                    │
│           3 HS      5 HS      4 HS                    │
│ 07   08   09   ...                                    │
└────────────────────────────────────────────────────────┘
[StudentScheduleView — chỉ hiện khi filter 1 HS cụ thể]
```

### Hành vi
- Load `session.getMonth` khi mount + khi filter thay đổi
- Click ô ngày trống → `SessionFormDialog` (pre-fill ngày)
- Click SessionCard → `SessionDetailDialog`
- Filter thay đổi → TanStack Query auto refetch

### Best Practices cho Component Types
- Ưu tiên sử dụng `RouterOutputs` để định nghĩa kiểu dữ liệu cho props và state.
- Ví dụ: `type StudentRow = RouterOutputs["student"]["list"]["items"][number]`.
- Việc này giúp component luôn đồng bộ với dữ liệu thực tế trả về từ API.

---

## Components

### MonthCalendar.tsx
- Grid 7 cột (T2 → CN), tuần bắt đầu từ Thứ Hai
- Dùng `useCalendar()` hook để tạo grid cells
- Mỗi cell = `CalendarDayCell`
- **Responsive Mobile (< 768px):**
  - Hiển thị bộ lịch dạng grid thu nhỏ (mini grid).
  - Mỗi ô ngày có 1 dấu chấm nhỏ phía dưới nếu ngày đó có lịch dạy.
  - Khi click vào một ngày:
    - Highlight ngày được chọn.
    - Hiển thị danh sách các ca dạy của riêng ngày đó ở ngay phía dưới bộ lịch.
    - Nếu không có lịch: Hiển thị "Ngày ... bạn ko có lịch dạy nào".

### CalendarDayCell.tsx
- Hiển thị số ngày (góc trên trái)
- Ô hôm nay: bg-indigo-50, ring-1 ring-indigo-400
- Ô ngoài tháng: opacity-30
- Liệt kê SessionCard theo giờ

### SessionCard.tsx
- Border-left 3px màu theo cấp:
  - Tiểu học (lớp 1–5): border-blue-500
  - THCS (lớp 6–9): border-emerald-500
- Nội dung: `08:00–09:30 · Nhóm A · 3 HS`
- Hover: translateY(-1px) + shadow
- Click → callback mở detail dialog

### SessionFormDialog.tsx (tạo + sửa)
```
Fields (React Hook Form + Zod):
  - sessionDate: shadcn Calendar Popover (pre-fill khi click ô ngày)
  - startTime: <Input type="time">
  - endTime: <Input type="time"> — validate > startTime
  - subjectId: Select (fetch subject.list, hiển thị name + color dot)
               Default: subject có isDefault=true
  - title: Input optional
  - notes: Textarea optional

Phần dưới: StudentPicker (chọn HS gán vào ca)

Submit:
  - Create: session.create.mutate() → invalidate getMonth → dialog đóng
  - Edit: session.update.mutate() → invalidate getMonth → dialog đóng
  - Edit (Future): session.updateFuture.mutate() → cập nhật chuỗi ca dạy lặp
  - Error CONFLICT: Toast đỏ "Trùng giờ với [ca khác]" — KHÔNG đóng dialog
  - Toast thành công: "Tạo ca dạy thành công" / "Cập nhật thành công"

Checkbox "Áp dụng cho các ca dạy lặp trong tương lai" khi ở chế độ Edit.
```

### SessionDetailDialog.tsx
```
Header: [Ngày] [Giờ] [Tiêu đề] [Trạng thái Badge]

Bảng HS (shadcn Table):
  STT | Tên | Lớp | Điểm danh (Select) | Học phí (Input) | Ghi chú (Input)
  Select options: Có mặt / Vắng / Muộn / Chưa điểm danh

Actions row (DropdownMenu):
  [Sửa ca] [Thêm HS] [Nhân bản] [Xóa ca (confirm)]

Footer:
  [Điểm danh tất cả: Có mặt] (quick button)
  [Lưu điểm danh] → attendance.update.mutate()

Tính năng mới:
  - Xóa chuỗi ca dạy: Alert dialog có checkbox "Xóa cả các ca dạy lặp trong tương lai".
  - Nhân bản: Chọn ngày cụ thể để copy thông tin ca dạy.
  - Thêm HS định kỳ: Thêm học sinh vào tất cả các ca cùng khung giờ & thứ này trong tương lai.
```

### StudentPicker.tsx
```
Props: value (selectedIds), onChange, sessionId?

UI:
  Input search tên (debounced 300ms)
  Select lọc lớp
  Checkbox list (scrollable max-h-48)
  HS đã gán: checked

Behavior:
  - Fetch student.list on open
  - Filter client-side sau khi fetch
  - Reset filter khi dialog đóng
```

### AttendancePanel.tsx
```
Props: sessionId, students: SessionStudent[]

UI:
  Mỗi HS 1 row: Avatar | Tên | Lớp | Select attendance | Input fee | Input note
  Select: "Có mặt" (green) / "Vắng" (red) / "Muộn" (amber) / "Chưa" (gray)

Actions:
  [✓ Tất cả có mặt] → set all to "present"
  [Lưu điểm danh] → attendance.update.mutate({ sessionId, attendances })
  Toast sau khi lưu
```

### BulkCreateDialog.tsx
```
Fields:
  Checkbox group weekdays: [T2] [T3] [T4] [T5] [T6] [T7] [CN]
  startTime, endTime (time inputs)
  title (optional)
  subject (default "Tiếng Anh")
  startDate, endDate (date range picker)
  StudentPicker (optional — gán HS cho tất cả ca)

Preview section:
  Hiện danh sách ngày sẽ được tạo (computed realtime)
  "Sẽ tạo X ca: [01/04 T2], [03/04 T4], ..."

Submit:
  session.bulkCreate.mutate()
  Toast: "Đã tạo X ca dạy thành công"
  invalidate getMonth → calendar refresh
```

### StudentScheduleView.tsx
```
Hiển thị khi: selectedStudentId !== null trong useFilters

Header section (trong export area):
  "LỊCH HỌC CÁ NHÂN"
  Học sinh: [Tên] | Lớp: [N] | Tháng: [M/YYYY]

Table:
  STT | Ngày | Thứ | Giờ | Điểm danh | Học phí | Ghi chú
  Điểm danh colored: ✅ Có mặt / ❌ Vắng / ⏰ Muộn / ⏳ Sắp tới

Footer (trong export area):
  Tổng kết: X/Y buổi đã học (Z%) | Tổng tiền: [VNĐ]
  GV: [fullName] | Ngày xuất: [date]

Buttons (NGOÀI export area):
  [📸 Chụp lịch] → useExport.captureElement(exportRef)
  [📥 Xuất Excel ▼] → ExportExcelButton

ref={exportRef}: chỉ bao export area (không include buttons)
```

### StudentList.tsx
```
shadcn Table columns:
  STT | Họ và tên | Lớp | Cấp (Badge) | SĐT PH | Tên PH | Trạng thái | Actions

Badge cấp: blue "Tiểu học" (lớp 1–5) / green "THCS" (lớp 6–9)
Badge trạng thái: green "Đang học" / gray "Đã nghỉ"

Actions (DropdownMenu):
  Sửa | Xem lịch (→ filter calendar) | Xóa (confirm)

Filter row phía trên:
  Select lớp + Input tìm tên + [+ Thêm học sinh]

Empty state: "Chưa có học sinh nào. Nhấn + Thêm học sinh để bắt đầu."
Loading: Skeleton rows
```

### StudentFormDialog.tsx
```
Props: mode ("create" | "edit"), student? (khi edit)

Fields (React Hook Form + Zod studentCreateSchema):
  fullName (required)
  grade (Select 1–9)
  tuitionFee (Number - Học phí mỗi buổi)
  parentPhone (optional, validate SĐT Việt Nam)
  parentName (optional)
  notes (Textarea optional)

Submit:
  Create: student.create.mutate()
  Edit: student.update.mutate()
  Toast + invalidate student.list
```

### FilterBar.tsx
```
Left group:
  Select "Tất cả lớp" / "Lớp 1" ... "Lớp 9"
  Input "Tìm tên học sinh..." (debounced 400ms)
  [◄] "Tháng 4 / 2026" [►] (navigate calendar)

Right group:
  [+ Tạo ca dạy] (opens SessionFormDialog)
  [+ Lịch lặp] (opens BulkCreateDialog)
  ExportExcelButton

Badge "Đang lọc: Lớp 3" khi có filter active
Button [✕ Xóa bộ lọc] khi hasActiveFilter
```

### ExportExcelButton.tsx
```
shadcn DropdownMenu:
  [📥 Xuất Excel ▼]
    📅 Xuất lịch tháng           ← luôn hiện
    👤 Xuất lịch [Tên HS]        ← hiện khi selectedStudentId != null
    🏫 Xuất theo lớp [N]         ← hiện khi selectedGrade != null
    📊 Xuất tổng hợp             ← luôn hiện

Loading spinner trên button khi isExporting
Toast sau khi xuất xong / fail
```

### DataTablePagination.tsx
```
UI:
  - Hiển thị: "Hiển thị [X]-[Y] trong [Z] bản ghi"
  - Select: Số dòng mỗi trang (5, 10, 20, 50). Mặc định là **5**.
  - Buttons: First, Prev, Next, Last page

Props:
  - table structure info (currentPage, pageSize, totalItems, totalPages)
  - callback functions (setCurrentPage, setPageSize)

Style: Sticky bottom-0, bg-white, border-t
```

### StudentReport.tsx (trong ReportsView)
```
Props: studentId, period, year, month?

Fetch: report.student.useQuery(...)

Hiển thị:
  Header: tên, lớp, kỳ báo cáo
  Bảng sessions (giống StudentScheduleView)
  Summary cards: Tổng | Có mặt | Vắng | Muộn | Tỉ lệ %
  ExportButton (PNG) + ExportExcelButton
```

### TuitionPage.tsx (`/tuition`)
```
UI:
  - Bộ lọc: Tháng/Năm, Lớp, Tìm tên học sinh
  - Bảng học phí:
      STT | Họ và tên | Lớp | Số buổi | Dự kiến | Đã đóng | Trạng thái | Hành động
  - Trạng thái (Badge):
      Đã đóng đủ (Green) | Chưa đóng đủ (Yellow) | Chưa đóng (Red)
  - Phân trang (DataTablePagination) ghim dưới đáy

Hành động:
  - [Ghi nhận]: Mở PaymentDialog
```

### PaymentDialog.tsx
```
UI:
  - Thông tin: Học phí tháng, Nợ cũ, Tổng cần đóng
  - Input: Số tiền đóng (paidAmount)
  - Nút nhanh: [Đóng đủ], [Đóng đủ + Bù nợ]
  - Checkbox: [Đánh dấu đã đóng đủ]
  - Textarea: Ghi chú

Hành động:
  - Update: tuition.updatePayment.mutate()
```

---

## Custom Hooks

### useCalendar.ts
```typescript
// State:
//   currentYear: number
//   currentMonth: number (1–12)
//
// Computed:
//   calendarGrid: CalendarCell[]
//     CalendarCell: { date: string, dayNumber: number, isCurrentMonth: boolean, sessions: Session[] }
//   monthLabel: "Tháng 4 / 2026"
//   daysOfWeek: ["T2","T3","T4","T5","T6","T7","CN"]
//
// Methods:
//   prevMonth()
//   nextMonth()
//   goToMonth(year, month)
//
// Logic grid:
//   - Tháng bắt đầu từ thứ mấy?
//   - Điền ô trống cho T2–(thứ đó - 1)
//   - Điền ngày 1..N
//   - Điền ô trống cuối cho đủ 35 hoặc 42 cells
//   - Map sessions vào đúng cell theo sessionDate
```

### useFilters.ts
```typescript
// State (sync 2 chiều với URL searchParams):
//   selectedGrade: number | null
//   searchStudentName: string
//   selectedStudentId: number | null
//
// Computed:
//   filterParams: { grade?, studentName? }  (dùng truyền vào tRPC query)
//   hasActiveFilter: boolean
//
// Methods:
//   setGrade(grade: number | null)
//   setSearch(name: string)
//   setStudentId(id: number | null)
//   resetFilters()
//
// URL sync: grade=3&studentName=an trong URL
```

### useExport.ts
```typescript
// State:
//   isCapturing: boolean
//
// Methods:
//   captureElement(element: HTMLElement, filename: string): Promise<void>
//     1. Set isCapturing = true
//     2. Add class "exporting" vào element
//     3. html2canvas(element, { scale: 2, useCORS: true })
//     4. canvas.toBlob() → download
//     5. Remove class "exporting"
//     6. Set isCapturing = false
```

### useTranslation (LanguageProvider)
```typescript
// Hook để truy cập đa ngôn ngữ:
//   const { t, language, setLanguage } = useTranslation()
//
// Methods:
//   t(key): Lấy bản dịch theo key (đã định nghĩa trong vi.json/en.json)
//   setLanguage(lang): Chuyển đổi giữa "vi" và "en"
```

### useExcelExport.ts
```typescript
// State:
//   isExporting: boolean
//
// 4 Export functions (ExcelJS + file-saver, chạy hoàn toàn client-side):

// Chế độ 1: Lịch tháng dạng calendar grid
exportMonthlySchedule(sessions, year, month, teacherName): Promise<void>
  // Sheet: "Lịch tháng M/YYYY"
  // Row 1 merge: "LỊCH DẠY HỌC - THÁNG M/YYYY"
  // Row 2 merge: "Giáo viên: [Tên] | Ngày xuất: DD/MM/YYYY"
  // Row 4: header T2–CN (fill indigo, font white)
  // Rows 5+: calendar grid (mỗi ô: DD/MM\nHH:mm-HH:mm\nTitle\nTên HS)
  // Row cuối: "Tổng: X ca | Y HS | Tỉ lệ: Z%"

// Chế độ 2: Lịch 1 học sinh
exportStudentSchedule(student, sessions, summary, period): Promise<void>
  // Sheet: "[Tên HS] - Lớp N"
  // Header info HS (4 rows)
  // Table: STT | Ngày | Thứ | Giờ | Điểm danh | Ghi chú
  // Điểm danh: conditional fill (green/red/amber/gray)
  // Alternating row colors
  // Footer: Tổng kết + Ngày xuất

// Chế độ 3: Báo cáo theo lớp (cross-tab)
exportGradeReport(grade, students, sessions, year, month): Promise<void>
  // Sheet: "Lớp N - TM/YYYY"
  // Header 3-row: ngày | thứ | giờ (merge vertical)
  // Rows: mỗi HS 1 row, mỗi ca 1 cột
  // Ký hiệu: ✓ present | ✗ absent | M late | - pending
  // Cột Tổng: "X/Y" | Cột Tỉ lệ: "Z%" (conditional color)
  // Freeze panes: 3 cột đầu + header row
  // Auto-filter header row

// Chế độ 4: Tổng hợp điểm danh (multi-sheet)
exportAttendanceSummary(students, sessions, year, month): Promise<void>
  // Sheet "Tổng hợp": bảng tất cả HS, sort theo lớp+tên
  // Sheet "Lớp N": mỗi lớp có HS → 1 sheet (giống chế độ 3)
  // Sheet "Thống kê": bảng theo lớp (Lớp | Số HS | Số buổi | Tỉ lệ TB)

// Common config cho tất cả:
// - pageSetup: A4 landscape, fitToPage, margins 0.5
// - font: Arial, size 10 data / 11 header / 16 title
// - header fill: #4F46E5 (indigo-600), font white
// - border: thin #D1D5DB tất cả cells
// - auto-width: min 8, max 30 chars
// - filename: không dấu tiếng Việt, format "{Type}_{Detail}_{Period}.xlsx"
```

---

## Styles (globals.css)

```css
/* === CALENDAR === */
.calendar-grid {
  @apply grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden;
}
.calendar-day-cell {
  @apply min-h-[120px] p-2 bg-white flex flex-col gap-1;
}
.calendar-day-cell--today {
  @apply bg-indigo-50 ring-1 ring-inset ring-indigo-400;
}
.calendar-day-cell--outside {
  @apply bg-gray-50 opacity-40;
}
.session-card {
  @apply border-l-[3px] rounded px-1.5 py-1 text-xs cursor-pointer
         transition-transform hover:-translate-y-px hover:shadow-sm;
}
.session-card--tieu-hoc { @apply border-blue-500 bg-blue-50; }
.session-card--thcs     { @apply border-emerald-500 bg-emerald-50; }

/* Mobile: list view */
@media (max-width: 768px) {
  .calendar-grid { @apply grid-cols-1 gap-0; }
  .calendar-day-cell { @apply min-h-0 border-b border-gray-100; }
  .calendar-day-cell--outside { @apply hidden; }
}

/* === EXPORT PNG === */
.exporting .btn-action    { @apply hidden !important; }
.exporting .export-hide   { @apply hidden !important; }
.exporting                { @apply bg-white p-6 !important; }
.export-header            { @apply hidden; }
.export-footer            { @apply hidden; }
.exporting .export-header { @apply block; }
.exporting .export-footer { @apply block; }
```
