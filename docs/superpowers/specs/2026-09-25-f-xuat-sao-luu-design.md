# F — Sao lưu / xuất toàn bộ dữ liệu

> Phần F trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0. **Phụ thuộc B** (`2026-09-25-b-lich-su-thu-tien-design.md`, mục 11): chỉ code F sau khi B đã merge, vì file xuất phải có bảng `Payment`. Không phụ thuộc cứng vào C (xem mục 6.5).

## 1. Bối cảnh

Người dùng: 1 giáo viên dạy kèm, dùng chủ yếu trên điện thoại. Toàn bộ dữ liệu (học sinh, ca dạy, điểm danh, học phí, tiền đã thu) chỉ nằm trên Neon Postgres. Giáo viên không có cách nào tự giữ một bản riêng để lưu trữ, đối chiếu hoặc đem sang công cụ khác.

Hiện trạng liên quan:
- `src/hooks/useExcelExport.ts` dựng file bằng `exceljs` ở **client** từ dữ liệu đang hiển thị (lịch tháng, lịch 1 học sinh, theo lớp, tổng hợp điểm danh). Dữ liệu chỉ trong 1 kỳ, không đủ để sao lưu. Tên sheet và tiêu đề cột ghi cứng tiếng Việt.
- `ExportExcelButton.tsx` / `ExportButton.tsx` (chụp PNG) ở trang Báo cáo: chỉ xuất theo bộ lọc.
- `report.service.ts` chỉ tính số liệu tổng hợp, không trả dữ liệu thô.
- `AppHeader.tsx`: menu avatar có "Môn học" (link `/subjects`), "Đổi mật khẩu", "Đăng xuất". Chưa có trang Cài đặt.
- Vercel Function giới hạn body response **4,5MB**.

## 2. Mục tiêu và tiêu chí hoàn thành

Trên điện thoại (390px), giáo viên mở menu avatar → **Sao lưu dữ liệu** → tải về một file `.xlsx`, mở bằng Excel / Google Sheets đọc được ngay:

- Có đủ 7 sheet dữ liệu (mục 6.3) cộng 1 sheet "Thông tin", số dòng mỗi sheet đúng bằng số bản ghi của user trong DB.
- Chỉ có dữ liệu của user đang đăng nhập. Không có `passwordHash`, không có `LoginAttempt`.
- Cột tiếng Việt, ngày dạng `dd/mm/yyyy` theo giờ VN, tiền là số nguyên, mỗi sheet giữ cột ID để đối chiếu chéo.
- Tên file có ngày giờ VN, ví dụ `SaoLuu_2026-09-25_2130.xlsx`.

## 3. Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Có khôi phục / nhập lại không | **Chỉ xuất.** Không có chức năng khôi phục. |
| Q2 | Định dạng | Một file **Excel nhiều sheet**, người đọc được: Học sinh, Môn học, Ca dạy, Điểm danh, Học phí tháng, Lần thu, Lịch sử lên lớp. Cột tiếng Việt, ngày `dd/mm/yyyy` giờ VN, tiền số nguyên, giữ ID. |
| Q3 | Phạm vi dữ liệu | Chỉ dữ liệu của user đang đăng nhập. Tuyệt đối không xuất `passwordHash`, `LoginAttempt`. |

### Quyết định do người viết spec chọn (cần người dùng duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| D1 | Dựng file ở đâu | **Server**: Route Handler MỚI `GET /api/backup` dựng `.xlsx` bằng `exceljs`, trả thẳng file nhị phân. | Xem ước lượng mục 6.1: JSON thô sau vài năm có thể tới vài MB, đến gần giới hạn 4,5MB; `.xlsx` là zip nên nhỏ hơn khoảng 5–10 lần. Danh sách cột được phép xuất nằm ở một chỗ trên server, test integration kiểm được luôn. Không phải tải `exceljs` (~1MB) xuống điện thoại. tRPC không trả nhị phân nên phải dùng route riêng. |
| D2 | Lối vào | Mục **"Sao lưu dữ liệu"** trong menu avatar, dưới "Môn học". | Chưa có trang Cài đặt. Nếu C làm trang Cài đặt trước thì vẫn giữ trong menu avatar, không chuyển (một lối vào là đủ). |
| D3 | Kiểu ô ngày | Ô **Date thật** của Excel + `numFmt` `dd/mm/yyyy` (hoặc `dd/mm/yyyy hh:mm` cho mốc thời gian), giá trị đã quy về giờ VN. | Hiện đúng `dd/mm/yyyy`, lại lọc/sắp xếp theo ngày được. Chuỗi `dd/mm/yyyy` sắp xếp sai. |
| D4 | Thêm sheet "Thông tin" | Có, đặt đầu tiên: người xuất, thời điểm xuất, số dòng từng sheet, 1 dòng lưu ý. | Mở file biết ngay bản sao lưu lúc nào và có đủ không. |
| D5 | Ngôn ngữ trong file | Tên sheet, tiêu đề cột, nhãn giá trị luôn **tiếng Việt**, không theo ngôn ngữ giao diện. | Giống `useExcelExport` hiện tại; route server không biết ngôn ngữ đang chọn ở client. |
| D6 | Học phí tháng | Xuất **nguyên dạng đang lưu** trong `monthly_tuition`, không tính lại. | Sao lưu là chép dữ liệu, không phải báo cáo. Tính lại sẽ ghi DB (`persist`) hoặc làm file lệch với DB. |
| D7 | Học sinh / môn đã ẩn, ca đã hủy | **Xuất hết**, có cột trạng thái. | Là bản sao lưu toàn bộ. |

## 4. Phạm vi

### Trong phạm vi
- Service MỚI `src/server/services/backup.service.ts`, Route Handler MỚI `src/app/api/backup/route.ts`.
- Hook MỚI `src/hooks/useBackupDownload.ts`, mục menu trong `AppHeader.tsx`.
- i18n vi/en cho chuỗi giao diện mới.

### Ngoài phạm vi (YAGNI)
- Khôi phục / nhập lại, xuất JSON / CSV / SQL, chọn khoảng thời gian hay chọn sheet.
- Sao lưu tự động theo lịch, gửi email, lưu lên Drive.
- Xuất `LoginAttempt`, `passwordHash`, `isActive` / `lastLoginAt` của `User`.
- Không đổi schema, không migration.

## 5. Giao diện

### 5.1 Lối vào
`AppHeader`: menu avatar thêm `DropdownMenuItem` **"Sao lưu dữ liệu"** (icon `DatabaseBackup` của lucide-react), đặt giữa "Môn học" và "Đổi mật khẩu". Có ở cả mobile và desktop.

### 5.2 Hành vi khi bấm
- `onSelect` gọi `download()` của `useBackupDownload`; menu đóng như bình thường.
- Hook dùng `toast.promise` (sonner): đang chạy "Đang tạo file sao lưu…" → xong "Đã tải file sao lưu" / lỗi "Không tạo được file sao lưu. Thử lại sau."
- Đang tải mà bấm lại thì bỏ qua (`isDownloading`), tránh tạo 2 file.
- Hook: `fetch("/api/backup")` → `!res.ok` thì ném lỗi → `res.blob()` → lấy tên file từ header `Content-Disposition` (regex `filename="([^"]+)"`, không có thì dùng `SaoLuu.xlsx`) → `saveAs(blob, name)` của `file-saver` (đã có trong `package.json`).

## 6. Backend

### 6.1 Ước lượng dung lượng (căn cứ cho D1)
Giả định: 50 học sinh, ~15 ca/tuần, ~3 HS/ca, dùng 3 năm.

| Bảng | Số dòng | JSON thô (ước) |
|---|---|---|
| TeachingSession | ~2.300 | ~0,5MB |
| SessionStudent | ~7.000 | ~0,7MB |
| MonthlyTuition | ~1.800 | ~0,4MB |
| Payment | ~2.000 | ~0,3MB |
| Còn lại | < 200 | không đáng kể |

JSON ~2MB sau 3 năm, ~6MB sau 10 năm (vượt 4,5MB). `.xlsx` cùng dữ liệu ước 0,3–0,6MB sau 3 năm, dưới 2MB sau 10 năm. Dựng ~13.000 dòng bằng `exceljs` trên server mất cỡ 1–2 giây, không cần stream.

### 6.2 Route Handler MỚI `src/app/api/backup/route.ts`
- `export const dynamic = "force-dynamic"`; runtime Node (mặc định, vì dùng Prisma và exceljs).
- `GET`: `const session = await auth()` (từ `@/server/auth`). Không có `session?.user?.id` → `401`. `userId = Number(session.user.id)` giống `createTRPCContext`.
- `const wb = await buildBackupWorkbook(db, userId, now)` → `await wb.xlsx.writeBuffer()`.
- Trả `new Response(buffer, { headers })`:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="<backupFileName(now)>"`
  - `Cache-Control: no-store`
- Lỗi bất ngờ → `500`, `console.error` (không trả chi tiết).
- `middleware.ts` không loại trừ `/api/backup` nên chưa đăng nhập đã bị chuyển về `/login` từ middleware; route vẫn tự kiểm `auth()`, không dựa vào middleware.

### 6.3 Service MỚI `src/server/services/backup.service.ts`
- `backupFileName(now: Date): string` → `SaoLuu_YYYY-MM-DD_HHmm.xlsx` theo giờ VN (cộng 7 giờ như `formatVnDate` trong `src/lib/payment-notes.ts`). Tên không dấu, không khoảng trắng.
- `buildBackupWorkbook(db: PrismaClient, userId: number, now: Date): Promise<ExcelJS.Workbook>`.
  - Chạy các `findMany` song song (`Promise.all`), mỗi truy vấn có **`select` liệt kê từng cột**, không `include: { user }`. Lọc theo chủ sở hữu:

| Bảng | Điều kiện | Sắp xếp |
|---|---|---|
| Student | `userId` | `grade`, `fullName`, `id` |
| Subject | `userId` | `sortOrder`, `id` |
| TeachingSession | `userId` (kèm `subject.name`, đếm `sessionStudents`) | `sessionDate`, `startTime`, `id` |
| SessionStudent | `session: { userId }` (kèm `session.sessionDate`, `student.fullName`) | `session.sessionDate`, `session.startTime`, `id` |
| MonthlyTuition | `student: { userId }` (kèm `student.fullName`) | `year`, `month`, `studentId` |
| Payment | `monthlyTuition: { student: { userId } }` (kèm `studentId`, `year`, `month`, `student.fullName` qua `monthlyTuition`) | `paidAt`, `id` |
| ClassUpgradeLog | `userId` | `year` |
| User | `id: userId`, chỉ `select: { username, fullName }` | — |

- Mỗi sheet: dòng 1 là tiêu đề (đậm, nền `FFE0E7FF` như `EXCEL_COLORS.headerBg`), cố định dòng 1 (`views: [{ state: "frozen", ySplit: 1 }]`), bật `autoFilter`, đặt độ rộng cột.
- Quy ước ô:
  - **Ngày** (`@db.Date`: `sessionDate`, `paidAt`): giá trị Date lấy từ DB (đã là 00:00 UTC), `numFmt = "dd/mm/yyyy"`.
  - **Mốc thời gian** (`createdAt`, `updatedAt`, `cancelledAt`, `executedAt`): `new Date(t.getTime() + 7h)`, `numFmt = "dd/mm/yyyy hh:mm"`. Bẫy: exceljs đổi Date sang số theo UTC, nên phải cộng 7 giờ trước khi ghi.
  - **Giờ** (`startTime`, `endTime`, `@db.Time`): chuỗi `HH:mm` qua `formatTime` (`src/lib/utils.ts`).
  - **Tiền**: số nguyên, `numFmt = "#,##0"`.
  - **Có/Không**: chuỗi "Có" / "Không". Rỗng / null → ô trống.
  - **SĐT**: chuỗi, cột `numFmt = "@"` để giữ số 0 đầu.

Cột từng sheet (theo thứ tự, "ID" luôn đầu tiên nếu có):

| Sheet | Cột |
|---|---|
| **Thông tin** (không có bảng) | Hai cột "Mục" / "Giá trị": Tài khoản (`username`), Họ tên (`fullName`), Thời điểm xuất (giờ VN), số dòng từng sheet dữ liệu, 2 dòng Lưu ý: "File chỉ để lưu trữ và đối chiếu. Ứng dụng không nhập lại file này." và "Học phí tháng là số đã lưu; tháng chưa mở trang Học phí có thể chưa có dòng." |
| **Học sinh** | ID, Họ tên, Lớp, Tên phụ huynh, SĐT phụ huynh, Học phí/buổi, Đang học (Có/Không), Ghi chú, Ngày tạo, Cập nhật lần cuối |
| **Môn học** | ID, Tên môn, Màu (hex), Mặc định, Đang dạy, Thứ tự, Ngày tạo |
| **Ca dạy** | ID, Ngày, Thứ (`formatDayOfWeek`), Bắt đầu, Kết thúc, ID môn, Môn, Tiêu đề, Trạng thái, Lý do hủy, Thời điểm hủy, Bù cho ca (ID), Số học sinh, Ghi chú, Ngày tạo |
| **Điểm danh** | ID, ID ca, Ngày ca, ID học sinh, Học sinh, Lớp lúc học (`SessionStudent.grade`), Điểm danh, Học phí buổi (`fee`), Ghi chú |
| **Học phí tháng** | ID, ID học sinh, Học sinh, Năm, Tháng, Tổng buổi, Buổi có mặt, Nợ trước, Học phí tháng, Tổng phải đóng, Đã trả, Đã tất toán, Ghi chú, Cập nhật lần cuối |
| **Lần thu** | ID, ID học phí tháng, ID học sinh, Học sinh, Năm, Tháng, Ngày thu, Số tiền, Hình thức, Ghi chú, Ngày tạo, Cập nhật lần cuối |
| **Lịch sử lên lớp** | ID, Năm học, Thời điểm chạy, Cách chạy, Số HS lên lớp, Số HS cho nghỉ |

Nhãn giá trị:
- Trạng thái ca: `"scheduled"` → "Đã lên lịch", `"cancelled"` → "Đã hủy", giá trị khác giữ nguyên chuỗi gốc.
- Điểm danh: `ATTENDANCE_LABEL` (`src/lib/constants.ts`).
- Hình thức thu: `"cash"` → "Tiền mặt", `"transfer"` → "Chuyển khoản" (`PAYMENT_METHODS` của B), khác giữ nguyên.
- Cách chạy lên lớp: `"auto"` → "Tự động", `"manual"` → "Thủ công".

Sheet trống vẫn tạo, chỉ có dòng tiêu đề.

### 6.4 An toàn dữ liệu
- Chỉ `findMany` (đọc), không ghi DB, không gọi `getMonthlyTuitionStatus`.
- Không truy vấn `loginAttempt`. Bảng `User` chỉ lấy `username`, `fullName`.
- Kiểm chủ sở hữu bằng điều kiện `where` như bảng trên, không nhận `userId` từ client.

### 6.5 Sheet "Cài đặt" (có điều kiện, theo C)
Nếu lúc code F, spec C đã thêm bảng / field cài đặt của user (vd. thông tin ngân hàng cho VietQR) thì thêm sheet **"Cài đặt"** sau "Lịch sử lên lớp", dạng "Mục" / "Giá trị", chỉ gồm các field hiển thị trên trang Cài đặt. Không xuất gì nhạy cảm (`passwordHash`, token, khóa bí mật). Nếu C chưa có thì bỏ qua, không chặn F.

## 7. i18n

Thêm vào cả `vi.json` và `en.json` (số key 2 file bằng nhau). Chỉ chuỗi giao diện; nội dung file Excel ghi cứng tiếng Việt (D5).

| Key | vi | en |
|---|---|---|
| `backup_data` | Sao lưu dữ liệu | Back up data |
| `backup_preparing` | Đang tạo file sao lưu… | Preparing backup file… |
| `backup_done` | Đã tải file sao lưu | Backup file downloaded |
| `backup_error` | Không tạo được file sao lưu. Thử lại sau. | Could not create the backup file. Please try again. |

Dò key sẵn có trước khi thêm để khỏi trùng. Không dùng dấu gạch dài.

## 8. Kiểm thử

### Integration (`tests/integration/backup.test.ts`, MỚI)
Gọi thẳng `buildBackupWorkbook(db, userId, now cố định)`, `writeBuffer()` rồi đọc lại bằng `new ExcelJS.Workbook().xlsx.load(buf)` (kiểm cả vòng ghi/đọc). Dữ liệu tạo qua `getAuthedCaller("teacher")` và `getAuthedCaller("teacher2")` như `multi-tenant.test.ts`: học sinh (có SĐT bắt đầu bằng 0, 1 em đã nghỉ), 1 môn đã ẩn, ca thường + ca đã hủy + ca bù, điểm danh, học phí tháng, lần thu (qua `createPayment` của B).
- Tên và thứ tự sheet đúng mục 6.3; dòng 1 mỗi sheet đúng tiêu đề.
- Số dòng dữ liệu mỗi sheet = số bản ghi của teacher đếm bằng Prisma (`count` với cùng điều kiện).
- Không ô nào trong mọi sheet chứa tên học sinh / môn của teacher2, hay chuỗi `passwordHash` của teacher (đọc từ DB); không có tiêu đề nào chứa "password" / "mật khẩu".
- Ô "Ngày" ở Ca dạy là Date, `numFmt` `dd/mm/yyyy`, đúng ngày của `sessionDate`.
- Mốc thời gian quy giờ VN: cập nhật `createdAt` của 1 học sinh thành `2026-01-01T20:00:00Z` → ô "Ngày tạo" hiện 02/01/2026 03:00.
- Tiền là `number` nguyên; SĐT là chuỗi giữ số 0 đầu.
- Nhãn: ca đã hủy → "Đã hủy", điểm danh `present` → "Có mặt", lần thu `transfer` → "Chuyển khoản".
- User chưa có dữ liệu: đủ sheet, chỉ có dòng tiêu đề, không lỗi.

### Unit
- `backupFileName(new Date("2026-09-25T17:30:00Z"))` → `SaoLuu_2026-09-26_0030.xlsx` (qua nửa đêm giờ VN).
- `src/app/api/backup/route.ts` với `vi.mock("@/server/auth")` trả `null` → status 401.

### E2E (`tests/e2e/backup.spec.ts`, MỚI, 390×844)
Đăng nhập → mở menu avatar → "Sao lưu dữ liệu" → `page.waitForEvent("download")` → `suggestedFilename()` khớp `/^SaoLuu_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/` → đọc file bằng exceljs, có sheet "Học sinh" và "Lần thu" → thấy toast "Đã tải file sao lưu".

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` đều sạch. Test chỉ chạy trên `.env.test`, không chạy `pnpm build` ở local.

## 9. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Lọt dữ liệu user khác / trường nhạy cảm | `select` liệt kê từng cột, `where` theo chủ sở hữu, test integration với 2 user + dò `passwordHash` trong mọi ô |
| Ngày lệch 1 ngày hoặc lệch 7 giờ | Quy ước ô ở mục 6.3, test cụ thể giờ qua nửa đêm |
| Dữ liệu lớn vượt 4,5MB hoặc chậm | Ước lượng mục 6.1: dưới 2MB sau 10 năm. Nếu có ngày vượt thì mới tính stream / tách file, không làm trước |
| `monthly_tuition` có tháng chưa được lưu snapshot | Xuất đúng những gì DB có (D6). Sheet "Thông tin" thêm 1 dòng: "Học phí tháng là số đã lưu; tháng chưa mở trang Học phí có thể chưa có dòng." |
| Code F trước khi B merge | F chờ B; bảng `Payment` và `PAYMENT_METHODS` phải có thật trước khi viết plan F |
| iOS Safari không tải blob | `file-saver` đã được dùng ở các nút xuất Excel hiện tại; E2E chạy Chromium, cần thử tay 1 lần trên iPhone |
