# D — Cảnh báo trên Dashboard

> Phần D trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0 (ghi phụ thuộc B). Xem mục 4 (S1): thực tế D **không cần B đã code**.

## 1. Bối cảnh

Dashboard (`src/app/(app)/dashboard/page.tsx`) hiện có 8 `StatCard` (số liệu tổng, từ `report.dashboard` → `getDashboardStats` trong `src/server/services/report.service.ts`) và khối `TodaySessions`. Không có chỗ nào chỉ ra **ai / ca nào** cần giáo viên xử lý. Giáo viên phải tự dò màn Học phí xem ai nợ, dò Lịch xem học sinh nào lâu không học.

Hiện trạng liên quan:

- Nợ: `getMonthlyTuitionStatus` (`tuition.service.ts`) tính mỗi HS/tháng `previousBalance` (nợ mang sang, carry-over từ snapshot tháng trước, quy ước `isFullPaid` thì **không** mang nợ dương), `totalAmountDue`, `paidAmount`, `isFullPaid`. Tham số `persist=false` cho đường chỉ đọc. `getMonthlyOutstanding` dùng đúng cách này cho thẻ "Còn nợ".
- Ca huỷ: `TeachingSession.status = "cancelled"`, `cancelledAt`, `makeupOfId` / quan hệ `makeupSessions` (`onDelete: SetNull`). Luồng duy nhất hiện nay để huỷ ca là `createMakeupSession` (huỷ + tạo ca bù trong cùng transaction). Vì vậy ca huỷ **không có** ca bù chỉ xuất hiện khi ca bù bị xoá (`deleteSession`, `bulkDeleteFutureSessions`) hoặc là dữ liệu cũ.
- Ngày VN: `vnDateParts()` trong `src/lib/utils.ts` (file `src/lib/vn-date.ts` không tồn tại; test ở `tests/unit/lib/vn-date.test.ts`). `sessionDate` là `@db.Date` lưu nửa đêm UTC.

## 2. Mục tiêu và tiêu chí hoàn thành

Trên Dashboard (390px và desktop), giáo viên thấy khối "Cần chú ý" gồm tối đa 3 nhóm:

1. **Còn nợ tháng trước**: HS đang học còn nợ các tháng trước; mỗi dòng có tên, lớp, số tiền, số tháng nợ. Bấm → màn Học phí, tháng hiện tại, sheet chi tiết của đúng HS mở sẵn.
2. **Lâu không có ca**: HS đang học không có ca (chưa huỷ) nào từ 14 ngày trước đến 7 ngày tới. Bấm → màn Lịch.
3. **Ca nghỉ chưa xếp bù**: ca đã huỷ, ngày học trong 60 ngày gần đây (hoặc tương lai), không có ca bù. Bấm → mở `SessionDetailDialog` của ca đó ngay trên Dashboard.

Tiêu chí:

- Số tiền ở nhóm 1 khớp màn Học phí: với HS chưa thu đồng nào trong tháng hiện tại, số tiền = đúng cột "Dư nợ tháng trước" (`previousBalance`) trên màn Học phí.
- Mỗi nhóm hiện tối đa 3 dòng, nút "Xem tất cả (n)" mở rộng tại chỗ. Nhóm rỗng thì ẩn; cả 3 rỗng thì ẩn cả khối.
- 1 request, số query cố định (không N+1), không ghi DB.
- Không tràn ngang ở 390px; vùng chạm mỗi dòng ≥44px.

## 3. Quyết định đã chốt (người dùng)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Các loại cảnh báo | Đúng 3 loại: còn nợ tháng trước, lâu không có ca, ca nghỉ chưa xếp bù. |
| Q2 | Nợ | Hiện số tiền + số tháng nợ; bấm sang màn Học phí đúng HS/tháng; phải khớp cách tính của màn Học phí. |
| Q3 | Lâu không có ca | HS đang học, 14 ngày qua và 7 ngày tới không có ca nào; tính theo ngày VN. |
| Q4 | Ca nghỉ chưa bù | Dùng quan hệ makeup sẵn có. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Vấn đề | Chọn | Lý do |
|---|---|---|---|
| S1 | Phụ thuộc B | D **không dùng gì mới của B**. Chỉ đọc `MonthlyTuition.paidAmount` (chỉ đọc, đúng mục 11 spec B) và `getMonthlyTuitionStatus(..., persist=false)`, cả hai đã có sẵn và B giữ nguyên nghĩa. Không dùng `Payment`, `listPaymentsInRange`. | D làm trước hay sau B đều được; B xong thì số vẫn đúng vì `paidAmount = SUM(Payment.amount)`. |
| S2 | Số tiền nhóm 1 | Chỉ xét HS có `previousBalance > 0` và `!isFullPaid` (tháng hiện tại). `amount = min(previousBalance, totalAmountDue - paidAmount)`, hiện nếu `amount > 0`. | Dùng nguyên kết quả của màn Học phí, không tự tính lại. Tiền thu tháng này trừ vào nợ cũ trước (giống carry-over: `paidAmount` trừ vào `totalAmountDue` đã gồm nợ cũ). Tháng này đã tất toán (`isFullPaid`) thì hết nợ, khớp `getMonthlyOutstanding`. |
| S3 | Số tháng nợ | Đọc snapshot `MonthlyTuition` đã lưu của 12 tháng trước. Đếm lùi từ tháng trước các tháng liên tiếp có `!isFullPaid && totalAmountDue - paidAmount > 0`; gặp tháng không thoả hoặc không có dòng thì dừng. `months = max(1, đếm)`; đủ 12 hiện "12+". | 1 query cho mọi HS nợ. Không gọi `getMonthlyTuitionStatus` cho từng tháng (12× query). Chỉ mang tính thông tin: snapshot tháng cũ có thể cũ nếu điểm danh bị sửa sau lần xem cuối (số tiền thì luôn đúng vì lấy từ S2). |
| S4 | Thời điểm | Tháng / ngày hiện tại theo `vnDateParts(now)`. Service nhận `now: Date = new Date()` để test tất định. | Server chạy UTC; theo đúng mẫu `getDashboardStats`. |
| S5 | "Đang học" | `Student.isActive = true` cho cả nhóm 1 và 2. | Theo Q2/Q3. HS đã nghỉ còn nợ không hiện (xem Rủi ro R2). |
| S6 | Cửa sổ nhóm 2 | `sessionDate` từ `hôm nay − 14` đến `hôm nay + 7`, **gồm cả hai đầu**, bỏ ca `cancelled`; ca bù tính là ca. HS mới tạo chưa xếp lịch **có** hiện (đúng là cần xếp lịch). | Đơn giản, không cần ngưỡng theo ngày tạo. |
| S7 | Cửa sổ nhóm 3 | Ca `cancelled`, `makeupSessions` rỗng, `sessionDate >= hôm nay − 60` (gồm cả ca tương lai). Xét theo `sessionDate`, không theo `cancelledAt`. | Cái bị lỡ là buổi học; `sessionDate` có index `[userId, sessionDate]`. Quá 60 ngày tự rơi khỏi danh sách. |
| S8 | "Bỏ qua" cảnh báo | **Không làm** (YAGNI). Muốn tắt nhóm 3: xoá ca huỷ, hoặc Khôi phục rồi "Tạo ca bù" (luồng có sẵn). | Không cần bảng / cột mới. |
| S9 | Số procedure | 1 procedure `report.alerts` (MỚI), tách khỏi `report.dashboard`. | Thẻ số liệu không phải chờ; lỗi cảnh báo không làm hỏng thẻ; test riêng. Chấp nhận tính trạng thái học phí 2 lần (1 trong `getMonthlyOutstanding`), dữ liệu 1 giáo viên nhỏ. |
| S10 | Trạng thái rỗng | Ẩn cả khối, không hiện "mọi thứ ổn". Đang tải: 1 `Skeleton`. Lỗi: ẩn khối. | Dashboard gọn; khối chỉ xuất hiện khi có việc. |
| S11 | Vị trí | Sau các thẻ số liệu (và nút "Xem thêm" mobile), trước `TodaySessions`. | Không chen giữa 2 hàng thẻ trên desktop; vẫn thấy sớm trên mobile vì hàng thẻ phụ ẩn sẵn. |
| S12 | Trả danh sách | Server trả **đủ** danh sách; client cắt 3 dòng. | Số lượng nhỏ; "Xem tất cả" không phải gọi lại. |

## 5. Phạm vi

### Trong phạm vi
- Service `getDashboardAlerts` + procedure `report.alerts` (mục 7).
- Service `getCancelledWithoutMakeup` trong `session.service.ts` (MỚI).
- Component `src/components/dashboard/DashboardAlerts.tsx` (MỚI), gắn vào `dashboard/page.tsx`.
- Màn Học phí: mở sẵn sheet khi URL có `studentId` (mục 6.3).
- i18n, test (mục 8, 9).

### Ngoài phạm vi (YAGNI)
- Bỏ qua / tắt từng cảnh báo, cấu hình ngưỡng 14/7/60 ngày.
- Thông báo đẩy, Zalo, email.
- Nút "Huỷ ca không xếp bù" (luồng huỷ mới) — nếu muốn, làm phần riêng.
- Cảnh báo cho HS đã nghỉ (`isActive = false`).
- Trang riêng liệt kê cảnh báo.

## 6. Giao diện

### 6.1 Vị trí trong `dashboard/page.tsx`
Thứ tự: `PageHeader` → hàng 4 thẻ chính → hàng 4 thẻ phụ + nút "Xem thêm" (mobile) → **`<DashboardAlerts />` (MỚI)** → `<TodaySessions />`.

### 6.2 `DashboardAlerts` (MỚI)
- `trpc.report.alerts.useQuery()`. Đang tải: `Skeleton` cao ~h-24. Lỗi hoặc 3 nhóm rỗng: `return null`.
- Tiêu đề `h2` "Cần chú ý" cùng kiểu với tiêu đề `TodaySessions` (`text-lg font-semibold text-slate-900`).
- Các nhóm: mobile xếp dọc; desktop `md:grid-cols-2 xl:grid-cols-3` (nhóm rỗng không chiếm ô). Mỗi nhóm là 1 `Card`: đầu nhóm = icon lucide + tên + số lượng (`Badge`) + 1 dòng mô tả nhỏ (`text-xs text-slate-500`).
- Mỗi nhóm hiện 3 dòng đầu; còn nữa thì nút ghost `h-11 md:h-10 w-full` "Xem tất cả (n)" / "Thu gọn" (state cục bộ từng nhóm).
- Mỗi dòng cao tối thiểu `min-h-11`, cả dòng bấm được, tên dài `truncate` (không tràn ngang 390px); số tiền `whitespace-nowrap`.

| Nhóm | Icon | Dòng | Bấm |
|---|---|---|---|
| Còn nợ | `Wallet` (đỏ) | `fullName` · Lớp `grade` / bên phải `formatCurrency(amount)`, dưới là "Nợ {n} tháng" | `Link` tới `/tuition?year=Y&month=M&studentName=<fullName>&studentId=<id>` (Y, M lấy từ response) |
| Lâu không có ca | `CalendarX` (cam) | `fullName` · Lớp `grade` | `Link` tới `/calendar` |
| Ca nghỉ chưa bù | `CalendarClock` (tím) | `formatDate(sessionDate)` `formatDayOfWeek` · `startTime` · tên môn / dưới là tên HS nối bằng ", " (`truncate`) | Mở `SessionDetailDialog` (+ `SessionFormDialog` cho nút Sửa), y như cách `TodaySessions` làm |

Thứ tự: nợ theo `amount` giảm dần; lâu không có ca theo `grade`, `fullName`; ca nghỉ theo `sessionDate`, `startTime` tăng dần (cũ nhất trước).

Sau khi Khôi phục / xoá ca trong dialog, `TRPCProvider` tự `invalidateQueries()` → khối cảnh báo tự cập nhật.

### 6.3 Màn Học phí mở sẵn sheet (`src/app/(app)/tuition/page.tsx`)
- `useCalendar` đã đọc `year`/`month`, `useFilters` đã đọc `studentName` (lọc tìm kiếm) và `selectedStudentId` từ URL — không thêm hook.
- MỚI: 1 `useEffect` — khi `selectedStudentId` có và `items` chứa HS đó, gọi `handleOpenDetail(item)` **một lần** (nhớ id đã mở bằng `useRef` để đóng sheet không bị mở lại). Lọc `studentName` bảo đảm HS nằm ở trang 1.
- Đổi khối / trạng thái đã tự xoá `studentId` (`setGrade`, `setStatus` trong `useFilters`).

## 7. Backend

### 7.1 `getCancelledWithoutMakeup(db, userId, { from: Date })` — MỚI, `session.service.ts`
`teachingSession.findMany({ where: { userId, status: "cancelled", sessionDate: { gte: from }, makeupSessions: { none: {} } }, include: { subject: true, sessionStudents: { include: { student: true } } }, orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }] })` → `map(toDTO)`. Đặt ở đây để dùng `toDTO` sẵn có (không export `toDTO`). Trả `SessionDTO[]` nên truyền thẳng vào `SessionDetailDialog` được.

### 7.2 `getDashboardAlerts(db, userId, now = new Date())` — MỚI, `report.service.ts`
1. `{ year, month, day } = vnDateParts(now)`; `today = Date.UTC(year, month-1, day)`; `idleFrom = today − 14 ngày`, `idleTo = today + 7 ngày`, `cancelFrom = today − 60 ngày` (dùng `Date.UTC(y, m-1, day ± n)`, tự tràn tháng đúng).
2. `Promise.all` (1 lượt song song):
   - `getMonthlyTuitionStatus(db, userId, { year, month, status: "all", page: 1, limit: 1_000_000 }, false)` — cùng tham số với `getMonthlyOutstanding`.
   - `student.findMany({ where: { userId, isActive: true }, select: { id: true } })` → tập HS đang học.
   - `student.findMany({ where: { userId, isActive: true, sessionStudents: { none: { session: { userId, status: { not: "cancelled" }, sessionDate: { gte: idleFrom, lte: idleTo } } } } }, select: { id, fullName, grade }, orderBy: [{ grade: "asc" }, { fullName: "asc" }] })` → nhóm 2.
   - `getCancelledWithoutMakeup(db, userId, { from: cancelFrom })` → nhóm 3.
3. Nhóm 1: lọc `items` theo S2 và tập đang học. Nếu có HS nợ: 1 query `monthlyTuition.findMany({ where: { studentId: { in: ids }, OR: [{ year: year-1, month: { gte: month } }, { year, month: { lt: month } }] }, select: { studentId, year, month, totalAmountDue, paidAmount, isFullPaid } })` rồi đếm theo S3 trong bộ nhớ (Map theo `studentId-year-month`).
4. Trả:
```ts
{
  year: number; month: number                 // tháng VN hiện tại, cho link Học phí
  debts: { studentId: number; fullName: string; grade: number; amount: number; months: number }[]
  idleStudents: { studentId: number; fullName: string; grade: number }[]
  unrescheduled: SessionDTO[]
}
```
Tổng: ~7–9 query, 2 lượt round-trip, không ghi DB (`persist=false`).

### 7.3 Router (`src/server/trpc/routers/report.ts`)
`alerts: protectedProcedure.query(({ ctx }) => getDashboardAlerts(ctx.db, ctx.userId))`. Không có input.

### 7.4 Giữ nguyên
`getMonthlyTuitionStatus`, `calcStudentTuition`, `getMonthlyOutstanding`, `getDashboardStats`, `createMakeupSession`, `restoreSession`. Không có migration, không đổi schema.

## 8. i18n
Thêm vào cả `vi.json` và `en.json` (cùng bộ key); dùng lại `grade`, `show_less_stats` ("Thu gọn").

| Key | vi | en |
|---|---|---|
| `alerts_title` | Cần chú ý | Needs attention |
| `alert_debt_title` | Còn nợ tháng trước | Unpaid from previous months |
| `alert_debt_desc` | Học sinh đang học còn nợ học phí cũ | Active students with earlier unpaid tuition |
| `alert_debt_months` | Nợ {n} tháng | {n} month(s) overdue |
| `alert_idle_title` | Lâu không có ca | No recent sessions |
| `alert_idle_desc` | Không có ca trong 14 ngày qua và 7 ngày tới | No sessions in the past 14 or next 7 days |
| `alert_unrescheduled_title` | Ca nghỉ chưa xếp bù | Cancelled, no makeup |
| `alert_unrescheduled_desc` | Ca huỷ trong 60 ngày gần đây chưa có ca bù | Cancelled in the last 60 days without a makeup |
| `alert_view_all` | Xem tất cả ({n}) | View all ({n}) |

"12+" hiển thị bằng cách truyền chuỗi `"12+"` vào `{n}`.

## 9. Kiểm thử

### Integration (`tests/integration/dashboard-alerts.test.ts`, MỚI — gọi `getDashboardAlerts` với `now` cố định, vd `2026-09-25T03:00:00Z`)
- **Khớp màn Học phí**: HS nợ tháng 8 (có mặt, chưa trả), tháng 9 chưa thu → `amount` = `previousBalance` của `tuition.getMonthlyStatus({ year: 2026, month: 9 })` cho HS đó; `months = 1`.
- Thu 1 phần ở tháng 9 → `amount = min(previousBalance, totalAmountDue − paidAmount)`; thu đủ → không còn trong `debts`.
- Tháng 8 `isFullPaid` với nợ dương → không có trong `debts` (carry-over không mang nợ dương).
- Tháng 9 `isFullPaid` → không có trong `debts`.
- Nợ liên tiếp tháng 6, 7, 8 (đã có snapshot) → `months = 3`; tháng 7 đã tất toán → `months = 1`.
- HS `isActive = false` còn nợ / không có ca → không xuất hiện.
- **Lâu không có ca**: ca ngày 11/09 (đúng −14) → không cảnh báo; ca 10/09 → có; ca 02/10 (đúng +7) → không cảnh báo; chỉ có ca `cancelled` trong cửa sổ → có cảnh báo.
- **Ngày VN**: `now = 2026-09-24T18:00:00Z` (= 01:00 25/09 VN) cho cùng kết quả như `now` trong ngày 25/09 VN.
- **Ca nghỉ**: `createMakeupSession` rồi `deleteSession` ca bù → ca gốc có trong `unrescheduled`; còn ca bù → không có; ca huỷ ngày 26/07 (−61) → không có; `restoreSession` → biến mất.
- Không ghi DB: đếm dòng `monthlyTuition` trước/sau gọi bằng nhau (theo mẫu `tuition-readonly-no-write.test.ts`).
- Đa người dùng: dữ liệu của user khác không xuất hiện (theo mẫu `multi-tenant.test.ts`).
- Router: `report.alerts` trả đúng shape.

### Unit
Không cần tách hàm thuần riêng; nếu tách hàm đếm tháng (S3) thì test nó trong `tests/unit/services/`.

### E2E (390×844, thêm vào `tests/e2e/mobile.spec.ts` hoặc file MỚI `tests/e2e/dashboard-alerts.spec.ts`)
- Có HS nợ → khối "Cần chú ý" hiện; bấm dòng nợ → URL `/tuition?...studentId=` và sheet chi tiết của đúng HS mở.
- Nhóm > 3 dòng → "Xem tất cả (n)" mở đủ, "Thu gọn" về 3.
- Không tràn ngang (`expectNoHorizontalScroll`).

### Chung
`pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test` xanh (chạy trên DB test, không phải `.env` production).

## 10. Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | Số tháng nợ (S3) lệch nếu snapshot tháng cũ chưa được tính lại sau khi sửa điểm danh | Chỉ là thông tin phụ; số tiền lấy từ `getMonthlyTuitionStatus` luôn đúng. Mở màn Học phí tháng đó sẽ tự ghi lại snapshot. |
| R2 | HS đã nghỉ (`isActive = false`) còn nợ không hiện ở đâu (màn Học phí cũng chỉ hiện HS đang học hoặc có ca trong tháng) | Đúng Q2 ("đang học"); ghi lại để người dùng quyết có cần phần riêng. |
| R3 | Nhóm 3 gần như luôn rỗng vì luồng huỷ hiện tại luôn tạo ca bù; chỉ có khi ca bù bị xoá (kể cả xoá hàng loạt `bulkDeleteFutureSessions` trúng ca bù) | Vẫn có ích để bắt đúng trường hợp đó; chi phí 1 query. Nếu muốn "Huỷ không bù" thì làm phần riêng. |
| R4 | Tính trạng thái học phí 2 lần mỗi lần mở Dashboard (`report.dashboard` + `report.alerts`) | Dữ liệu 1 giáo viên nhỏ, chạy song song. Nếu chậm, gộp sau khi đo. |
| R5 | Deep link Học phí lọc theo `studentName` có thể khớp nhiều HS trùng tên | Mở sheet theo `studentId`, không theo tên. |
| R6 | Tiêu chí "khớp màn Học phí" bị phá nếu sau này ai đó tự tính nợ ở D | Test integration so sánh trực tiếp với `tuition.getMonthlyStatus`. |
