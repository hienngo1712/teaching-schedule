# C — Phiếu báo học phí + QR VietQR

> Phần C trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0. Phụ thuộc **B** (`2026-09-25-b-lich-su-thu-tien-design.md`, chưa code): chỉ dùng interface ở mục 11 của B. G (link phụ huynh) sẽ dùng lại phần hiển thị phiếu (mục 11).

## 1. Bối cảnh

Cuối tháng giáo viên phải tự nhắn cho từng phụ huynh: số buổi, học phí, nợ cũ, đã đóng, còn lại, số tài khoản. Số liệu đã có đủ trong app (`getMonthlyTuitionStatus` trong `src/server/services/tuition.service.ts`; lần thu lấy từ `listPayments` sau B) nhưng không xuất ra được dạng gửi Zalo. Chuyển khoản hay sai số tiền hoặc thiếu nội dung, giáo viên khó đối chiếu.

Hiện trạng liên quan:
- Trang `/tuition` (`src/app/(app)/tuition/page.tsx`): `ResponsiveList` với bảng desktop (cột hành động có nút "Ghi nhận") và thẻ mobile; bấm mở `TuitionDetailSheet`.
- `html2canvas` đã có trong `package.json`, đang dùng ở `src/hooks/useExport.ts` (chụp DOM → PNG, có sẵn các mẹo `onclone` cho `rounded-full`, `inline-flex`). `file-saver` đã có.
- Chưa có thư viện vẽ QR. Chưa có trang Cài đặt; menu avatar (`src/components/layout/AppHeader.tsx`) có "Môn học", "Đổi mật khẩu", "Đăng xuất".
- `User` chưa có trường ngân hàng. `removeVietnameseTones` (`src/lib/utils.ts`) bỏ dấu nhưng đổi dấu cách thành `_`.

## 2. Mục tiêu và tiêu chí hoàn thành

Trên điện thoại (390px), từ màn Học phí, giáo viên bấm "Phiếu báo" cho 1 học sinh/tháng → thấy bản xem trước → **Chia sẻ** (mở bảng chia sẻ của máy, chọn Zalo) hoặc **Tải ảnh** → nhận 1 file PNG:
- Số trên phiếu khớp đúng sheet chi tiết (Tổng phải đóng, Đã trả, Còn lại) của cùng tháng.
- Còn phải trả > 0 và đã cài ngân hàng: có mã QR; quét bằng app ngân hàng VN hiện đúng ngân hàng, số tài khoản, số tiền, nội dung chuyển khoản.
- Tiếng Việt có dấu hiển thị đúng trong ảnh.
- Mở phiếu **không ghi gì vào DB**.

## 3. Quyết định đã chốt (người dùng)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Dạng phiếu | Ảnh PNG. Chia sẻ bằng Web Share API (file) nếu máy hỗ trợ, không thì tải file. |
| Q2 | Nội dung | Tên HS, lớp, tháng; số buổi có mặt, học phí/buổi, danh sách ngày có mặt; nợ tháng trước; đã trả (liệt kê các lần thu); còn phải trả; QR VietQR đúng số còn lại, nội dung gợi ý không dấu, giới hạn độ dài. Còn phải trả ≤ 0 → không có QR, ghi "Đã thanh toán đủ" / trả dư. |
| Q3 | Thông tin ngân hàng | Trang **Cài đặt** MỚI trong menu avatar: ngân hàng (chọn từ danh sách có mã BIN), số TK, tên chủ TK; lưu DB theo user. Chưa cài → phiếu vẫn tạo được, không QR, nhắc đi Cài đặt. |
| Q4 | Tạo QR | Trong app theo chuẩn VietQR/EMVCo (NAPAS), không gọi dịch vụ ngoài. Có unit test với payload mẫu. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Vấn đề | Chọn | Lý do |
|---|---|---|---|
| S1 | Tạo ảnh ở đâu | **Client, `html2canvas`** (đã có) chụp component phiếu. Không dùng `next/og`. | `next/og` (satori) chỉ vẽ bằng font TTF nạp tay, thiếu glyph là ra ô vuông, không có font dự phòng; phải tự nạp font có tiếng Việt và viết lại CSS. `html2canvas` vẽ chữ bằng canvas của trình duyệt, dùng cùng font + font dự phòng như trên màn hình → chữ có dấu hiện như người dùng đang thấy. Không thêm thư viện. |
| S2 | Lưu ngân hàng | **3 cột nullable trên `User`**: `bankBin`, `bankAccountNumber`, `bankAccountName`. | 1 user = 1 tài khoản; không cần bảng mới. Migration chỉ `ADD COLUMN` nullable. |
| S3 | Danh sách ngân hàng | Hằng tĩnh `VN_BANKS` (~25 ngân hàng phổ biến) trong code. | Không gọi API ngoài lúc chạy. Thêm ngân hàng = sửa 1 file. |
| S4 | Payload QR tạo ở đâu | **Server** (trong DTO phiếu), client chỉ vẽ ảnh QR. | G dùng lại DTO y nguyên; logic tiền + CRC nằm 1 chỗ, test được bằng unit + integration. |
| S5 | Thư viện vẽ QR | Thêm **`qrcode`** (+ `@types/qrcode` dev), dùng `QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 })` → `<img>`. | Phổ biến nhất, bản browser nhẹ, ra PNG data URL: `html2canvas` vẽ ảnh PNG ổn định (SVG trong canvas có lỗi trên Safari cũ). |
| S6 | Tag 59/60 (tên/thành phố) | **Không đưa vào payload.** | Chuẩn VietQR cho chuyển khoản nhanh (QRIBFTTA) không bắt buộc; app ngân hàng tự tra tên chủ TK. Ít trường = ít chỗ sai. |
| S7 | Nội dung chuyển khoản | `HP T{tháng} {Tên HS không dấu}`, chỉ `[A-Za-z0-9 ]`, cắt tối đa **25 ký tự**. | 25 là giới hạn an toàn cho mọi ngân hàng. Tên dài bị cắt vẫn nhận ra được. |
| S8 | "Còn phải trả" | `isFullPaid` → 0 (ghi "Đã tất toán"); ngược lại `max(0, totalAmountDue - paidAmount)`. Trả dư = `paidAmount - max(0, totalAmountDue)` khi > 0 và không tất toán. | Khớp cách sheet chi tiết của B (mục 6.2) và `getMonthlyOutstanding` đang tính. |
| S9 | "Học phí/buổi" | Nếu mọi buổi có mặt cùng `SessionStudent.fee` → 1 dòng "Học phí/buổi: X". Khác nhau → mỗi ngày ghi kèm số tiền. | Phí lưu theo từng buổi, có thể khác nhau; không bịa 1 con số. |
| S10 | Ngôn ngữ phiếu | Theo ngôn ngữ giao diện (`t()`), như mọi chuỗi khác. | Giữ quy ước i18n; giáo viên dùng tiếng Việt thì phiếu tiếng Việt. |
| S11 | iOS chặn `navigator.share` sau tác vụ bất đồng bộ | Tạo sẵn ảnh (Blob) ngay khi xem trước đã vẽ xong QR; nút Chia sẻ/Tải ảnh chỉ bật khi có Blob, bấm là gọi ngay. `NotAllowedError` → tải file. | Safari mất "user activation" nếu chụp ảnh xong mới gọi `share`. |

## 5. Phạm vi

### Trong phạm vi
- Migration 3 cột ngân hàng trên `users`; trang `/settings`; router `settings.*`.
- `src/lib/vietqr.ts` (payload EMVCo + CRC), `src/lib/vn-banks.ts`.
- Service + query `tuition.getNotice`; component phiếu + dialog xem trước; nút "Phiếu báo" ở 3 chỗ.
- i18n, test.

### Ngoài phạm vi (YAGNI)
- Tự đối soát chuyển khoản / webhook ngân hàng; nút "đã nhận chuyển khoản" (nếu làm sau phải qua `createPayment` của B).
- Phiếu hàng loạt cho cả lớp, gửi thẳng Zalo qua API, PDF.
- Logo ngân hàng, logo giáo viên, tuỳ biến mẫu phiếu.
- Nhiều tài khoản ngân hàng / user.
- Lưu lịch sử phiếu đã gửi.

## 6. Giao diện

### 6.1 Lối vào "Phiếu báo" (icon `Receipt`)
- **Thẻ mobile** (`renderCard`): hàng dưới cùng, cạnh nút "Ghi nhận", thêm nút outline chỉ icon `size-11`, `aria-label` = "Phiếu báo". `stopPropagation` như `payButton`.
- **Bảng desktop**: cột hành động thêm nút icon `size-9` trước "Ghi nhận" (tăng `w-[130px]` → `w-[180px]`).
- **`TuitionDetailSheet`** (bản B): nút outline "Phiếu báo" ở footer, bên trái nút Lưu, `h-11 md:h-10`.
- Cả 3 mở `TuitionNoticeDialog` với `{ studentId, year, month }`. Mở từ sheet thì dialog chồng lên sheet.

### 6.2 `TuitionNoticeDialog` (MỚI, `src/components/tuition/TuitionNoticeDialog.tsx`)
Dialog desktop / Sheet mobile (giống `TuitionDetailSheet`, dùng `useMediaQuery`).
- Gọi `trpc.tuition.getNotice.useQuery`. Đang tải: skeleton khung phiếu. Lỗi: `load_error` + `retry`.
- Thân: `TuitionNoticeCard` căn giữa, cuộn dọc được.
- Nếu `notice.bankConfigured === false` và còn phải trả > 0: khung nhắc (ngoài phiếu, không vào ảnh) "Chưa cài tài khoản ngân hàng nên phiếu chưa có mã QR." + link "Mở Cài đặt" → `/settings`.
- Khi `TuitionNoticeCard` báo sẵn sàng (`onReady`, sau khi ảnh QR tải xong hoặc không có QR): gọi `elementToPngBlob` → giữ Blob trong state.
- Footer: **Chia sẻ** (icon `Share2`, chỉ hiện khi `canShareFiles()`), **Tải ảnh** (icon `Download`). Cả hai `h-11 md:h-10`, `disabled` khi chưa có Blob (kèm spinner nhỏ).
- Tên file: `phieu-bao-hoc-phi-T{m}-{yyyy}-{Ten_HS}.png` (dùng `removeVietnameseTones`).

### 6.3 `TuitionNoticeCard` (MỚI, `src/components/tuition/TuitionNoticeCard.tsx`)
Thuần hiển thị, props `{ notice: TuitionNoticeDTO; onReady?: () => void }`, `forwardRef` tới khung ngoài để chụp. Rộng cố định `360px`, nền trắng, chữ `slate-900`, chỉ dùng block/grid đơn giản; **không** dùng `rounded-full`, `inline-flex`, `shadow` (các chỗ `html2canvas` hay vẽ sai, xem `useExport.ts`). Chụp `scale: 2` → ảnh ~720px ngang.

Từ trên xuống:
1. "PHIẾU BÁO HỌC PHÍ THÁNG {m}/{yyyy}".
2. Học sinh: `{fullName}` · Lớp `{grade}`.
3. Buổi học: "Số buổi có mặt: {presentSessions}"; học phí/buổi theo S9; "Ngày học: 02/09, 04/09, …" (dd/mm, xuống dòng tự nhiên). Buổi "muộn" tính là có mặt (như `calcStudentTuition`).
4. Bảng tiền, số căn phải:
   - Học phí tháng `{currentMonthFee}`.
   - `previousBalance > 0`: "Nợ tháng trước"; `< 0`: "Dư tháng trước" (số âm); `= 0`: ẩn dòng.
   - **Tổng phải đóng** `{totalAmountDue}`.
   - Đã trả `{paidAmount}`, ngay dưới là từng lần thu (chữ nhỏ): `dd/mm/yyyy · Tiền mặt|Chuyển khoản · {amount}`. Không có lần thu → ẩn phần liệt kê.
   - **Còn phải trả** `{remaining}` (chữ lớn, đậm).
5. Khối thanh toán:
   - `remaining > 0` và có `qr`: ảnh QR 200×200 CSS px; bên cạnh/dưới: tên ngân hàng (`shortName`), số TK, chủ TK, số tiền, "Nội dung: {content}".
   - `remaining > 0`, không `qr`: không có khối này.
   - `remaining = 0`, `isFullPaid` và `totalAmountDue > paidAmount`: "Đã tất toán".
   - `remaining = 0`, còn lại: "Đã thanh toán đủ"; nếu `overpaid > 0` thêm "Trả dư {overpaid}, sẽ trừ vào tháng sau".
6. Chân: "Giáo viên: {teacherName}" · "Ngày lập: {formatVnDate(new Date())}".

Tiền dùng `formatCurrency`; ngày lần thu dùng `formatDate` (chuỗi `YYYY-MM-DD` đọc theo UTC).

### 6.4 Trang `/settings` (MỚI, `src/app/(app)/settings/page.tsx`)
- Menu avatar: mục **"Cài đặt"** (icon `Settings`) ngay dưới "Môn học", link `/settings`.
- `PageHeader` "Cài đặt". 1 thẻ "Tài khoản nhận học phí" (`max-w-xl`), mô tả "Dùng để tạo mã QR trên phiếu báo học phí".
- Trường: **Ngân hàng** (`Select`, mục hiển thị `{shortName} - {name}`, sắp theo `shortName`), **Số tài khoản** (`inputMode="numeric"`), **Tên chủ tài khoản** (tự viết hoa khi rời ô). 3 trường cùng bắt buộc khi Lưu.
- Nút **Lưu** (`w-full sm:w-auto`, `h-11 md:h-10`) → toast "Đã lưu tài khoản ngân hàng". Nút **Xoá thông tin** (chỉ hiện khi đã có) → AlertDialog xác nhận → lưu `null` cả 3.
- Loading: skeleton; lỗi: `load_error` + `retry`.

## 7. Backend

### 7.1 `src/lib/vietqr.ts` (MỚI, thuần, không import server)
- `crc16Ccitt(s: string): string` — CRC-16/CCITT-FALSE (đa thức `0x1021`, khởi tạo `0xFFFF`, không đảo bit, không XOR cuối), trả 4 ký tự hex **viết hoa**.
- `tlv(id, value)` = `id` + độ dài 2 chữ số thập phân + `value` (ném lỗi nếu độ dài > 99).
- `buildTransferContent(fullName, month)`: theo S7 (bỏ dấu, đổi `đ/Đ`, lọc ký tự, gộp khoảng trắng, cắt 25, `trimEnd`).
- `buildVietQrPayload({ bin, accountNumber, amount, content })` (`amount` nguyên ≥ 1):

| Tag | Giá trị | Ghi chú |
|---|---|---|
| `00` | `01` | Payload format indicator |
| `01` | `12` | QR động (có số tiền) |
| `38` | `00`=`A000000727` · `01`=( `00`=BIN 6 số · `01`=số TK ) · `02`=`QRIBFTTA` | Merchant account info NAPAS, chuyển nhanh đến **tài khoản** |
| `53` | `704` | VND |
| `54` | `String(amount)` | Số nguyên, không dấu phân cách |
| `58` | `VN` | |
| `62` | `08`=content | Additional data, purpose of transaction |
| `63` | CRC | Tính trên toàn chuỗi **kể cả** `"6304"` |

Payload mẫu (dùng làm unit test): BIN `970436`, TK `0011001234567`, `850000`, nội dung `HP T9 Nguyen Van A`:
```
00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA530370454068500005802VN62220818HP T9 Nguyen Van A63041DD5
```
(CRC tính bằng hàm trên; hàm đã đúng với giá trị kiểm chuẩn `crc16("123456789") = "29B1"`.) Trước khi merge: tạo QR từ payload này với 1 TK thật của giáo viên, quét bằng ít nhất 2 app ngân hàng, ghi kết quả vào PR.

### 7.2 `src/lib/vn-banks.ts` (MỚI)
`VN_BANKS: { bin: string; shortName: string; name: string }[]`, gồm ít nhất: Vietcombank 970436, VietinBank 970415, BIDV 970418, Agribank 970405, Techcombank 970407, MB 970422, ACB 970416, VPBank 970432, TPBank 970423, Sacombank 970403, VIB 970441, SHB 970443, HDBank 970437, OCB 970448, MSB 970426, SeABank 970440, Eximbank 970431, LPBank 970449, Nam A Bank 970428, Bac A Bank 970409, ABBANK 970425, PVcomBank 970412, Kienlongbank 970452, BVBank 970454, NCB 970419. Lúc code đối chiếu lại với danh sách NAPAS/VietQR công bố (chỉ tra khi viết code, app không gọi). `findBank(bin)`.

### 7.3 Schema zod
- MỚI `src/lib/schemas/settings.ts`: `bankAccountSchema` = `{ bankBin: string thuộc VN_BANKS, bankAccountNumber: /^[A-Za-z0-9]{4,19}$/, bankAccountName: string trim 1–50 }`; `updateBankAccountSchema` = `bankAccountSchema.nullable()` (`null` = xoá).
- `src/lib/schemas/tuition.ts`: thêm `tuitionNoticeSchema` = `{ studentId: int dương, year, month: 1–12 }`.

### 7.4 Service
- MỚI `src/server/services/settings.service.ts`: `getBankAccount(db, userId)` → `{ bankBin, bankAccountNumber, bankAccountName } | null` (null khi thiếu bất kỳ trường nào); `updateBankAccount(db, userId, input)` ghi 3 cột (hoặc `null` cả 3).
- MỚI `src/server/services/tuition-notice.service.ts`: `getTuitionNotice(db, userId, { studentId, year, month }): Promise<TuitionNoticeDTO>`, **chỉ đọc**:
  1. `getMonthlyTuitionStatus(db, userId, { studentId, year, month, status: "all", page: 1, limit: 1 }, false)`; `items` rỗng → `NOT_FOUND` (đã lọc `userId` → chặn HS của user khác).
  2. Ngày có mặt: `sessionStudent.findMany` cùng điều kiện với `currentAttendance` trong `getMonthlyTuitionStatus` (`studentId`, `session.userId`, khoảng tháng, `status != "cancelled"`) + `attendance in [present, late]`, sắp theo `session.sessionDate`; map `{ date: "YYYY-MM-DD", fee }`.
  3. `listPayments(db, userId, { studentId, year, month })` (B).
  4. `getBankAccount`, `user.fullName ?? username`.
  5. Tính `remaining`, `overpaid` (S8); `content = buildTransferContent`; `qr` = payload + thông tin TK khi `remaining > 0` và có ngân hàng, ngược lại `null`.

`TuitionNoticeDTO` (MỚI, `src/lib/types/models.ts`):
```ts
{
  studentId, fullName, grade, year, month,
  presentSessions, currentMonthFee, previousBalance, totalAmountDue, paidAmount, isFullPaid,
  presentDates: { date: string; fee: number }[],
  payments: PaymentDTO[],
  remaining: number, overpaid: number,
  teacherName: string,
  bankConfigured: boolean,
  qr: { payload: string; bankShortName: string; accountNumber: string; accountName: string; amount: number; content: string } | null
}
```

### 7.5 Router
- `tuition.ts`: thêm `getNotice: protectedProcedure.input(tuitionNoticeSchema).query(...)`.
- MỚI `src/server/trpc/routers/settings.ts`: `settings.getBankAccount` (query), `settings.updateBankAccount` (mutation); đăng ký `settings: settingsRouter` trong `root.ts`.

### 7.6 Client helper `src/lib/share-image.ts` (MỚI)
- `elementToPngBlob(el)`: `html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false })` → `canvas.toBlob("image/png")`.
- `canShareFiles()`: `navigator.canShare?.({ files: [new File([""], "x.png", { type: "image/png" })] }) === true`.
- `shareOrDownloadPng(blob, filename, title)`: có `canShareFiles` → `navigator.share({ files: [file], title })`; `AbortError` (người dùng huỷ) → im lặng; `NotAllowedError`/lỗi khác → `saveAs(blob, filename)` (`file-saver`).

`useExport.ts` giữ nguyên.

## 8. Dữ liệu và migration

`prisma/schema.prisma`, model `User` thêm:
```prisma
bankBin           String? @map("bank_bin") @db.VarChar(8)
bankAccountNumber String? @map("bank_account_number") @db.VarChar(19)
bankAccountName   String? @map("bank_account_name") @db.VarChar(50)
```
Migration `prisma/migrations/<timestamp>_add_user_bank_account/migration.sql` sinh bằng `prisma migrate dev --create-only` trên DB test/dev, nội dung chỉ gồm `ALTER TABLE "users" ADD COLUMN ... ` 3 cột nullable, không default. Không sửa/xoá dữ liệu → chạy thẳng bằng `prisma migrate deploy`, bản code cũ vẫn chạy được trong lúc build.

Kiểm tra (chỉ đọc), trước và sau:
```sql
SELECT COUNT(*) FROM "users";                       -- trước = sau
SELECT COUNT(*) FROM "users" WHERE "bank_bin" IS NOT NULL
  OR "bank_account_number" IS NOT NULL OR "bank_account_name" IS NOT NULL;  -- sau = 0
```
Thử trước trên Neon branch "Branch from current" như B.

## 9. i18n

Thêm vào cả `vi.json` và `en.json` (số key bằng nhau). Grep key sẵn có trước (`grade`, `cancel`, `save`, `load_error`, `retry`, `method_cash`, `method_transfer`, `paid_total` của B…) để dùng lại.

| Key | vi | en |
|---|---|---|
| `tuition_notice` | Phiếu báo | Tuition notice |
| `tuition_notice_title` | PHIẾU BÁO HỌC PHÍ THÁNG | TUITION NOTICE FOR |
| `notice_student` | Học sinh | Student |
| `notice_present_sessions` | Số buổi có mặt | Sessions attended |
| `notice_fee_per_session` | Học phí/buổi | Fee per session |
| `notice_dates` | Ngày học | Dates |
| `notice_month_fee` | Học phí tháng | Month fee |
| `notice_prev_debt` | Nợ tháng trước | Previous balance due |
| `notice_prev_credit` | Dư tháng trước | Previous credit |
| `notice_remaining` | Còn phải trả | Amount due |
| `notice_paid_in_full` | Đã thanh toán đủ | Paid in full |
| `notice_settled` | Đã tất toán | Settled |
| `notice_overpaid` | Trả dư {amount}, sẽ trừ vào tháng sau | Overpaid {amount}, carried to next month |
| `notice_transfer_content` | Nội dung | Transfer note |
| `notice_teacher` | Giáo viên | Teacher |
| `notice_issued` | Ngày lập | Issued |
| `notice_no_bank` | Chưa cài tài khoản ngân hàng nên phiếu chưa có mã QR. | No bank account set, so the notice has no QR code. |
| `open_settings` | Mở Cài đặt | Open settings |
| `share` | Chia sẻ | Share |
| `download_image` | Tải ảnh | Download image |
| `settings` | Cài đặt | Settings |
| `bank_account_section` | Tài khoản nhận học phí | Tuition bank account |
| `bank_account_desc` | Dùng để tạo mã QR trên phiếu báo học phí | Used for the QR code on tuition notices |
| `bank` | Ngân hàng | Bank |
| `account_number` | Số tài khoản | Account number |
| `account_name` | Tên chủ tài khoản | Account holder |
| `bank_saved` | Đã lưu tài khoản ngân hàng | Bank account saved |
| `clear_bank` | Xoá thông tin | Clear |
| `clear_bank_confirm` | Xoá thông tin tài khoản? Phiếu báo sẽ không còn mã QR. | Clear bank details? Notices will no longer have a QR code. |

Thông báo lỗi server giữ tiếng Việt. Không dùng dấu gạch dài.

## 10. Kiểm thử

### Unit
- MỚI `tests/unit/lib/vietqr.test.ts`: `crc16Ccitt("123456789") === "29B1"`; `buildVietQrPayload` cho mẫu mục 7.1 đúng **từng ký tự**; đổi `amount` → CRC đổi; `tlv` độ dài 2 chữ số; `buildTransferContent("Nguyễn Văn Đạt", 9) === "HP T9 Nguyen Van Dat"`, tên rất dài → ≤ 25 ký tự, không ký tự ngoài `[A-Za-z0-9 ]`, không có khoảng trắng cuối.
- MỚI `tests/unit/schemas/settings.schema.test.ts`: BIN ngoài `VN_BANKS`, số TK có dấu cách/quá 19 ký tự, tên rỗng → lỗi; `null` hợp lệ.

### Integration
- MỚI `tests/integration/tuition-notice.test.ts`:
  - HS có 3 buổi có mặt + 1 muộn + 1 vắng + 1 ca huỷ → `presentDates` 4 ngày đúng thứ tự; tổng `fee` = `currentMonthFee`; mọi số tiền = `tuition.getMonthlyStatus` cùng tháng.
  - Có nợ tháng trước + 2 lần thu (`payment.create` của B) → `previousBalance`, `payments` (2 dòng), `paidAmount`, `remaining` đúng.
  - Chưa cài ngân hàng → `bankConfigured=false`, `qr=null`. Cài rồi, còn nợ → `qr.amount = remaining`, `payload` chứa `54` + số tiền, 4 ký tự cuối = `crc16Ccitt` phần trước.
  - Trả đủ → `qr=null`, `remaining=0`; trả dư → `overpaid` đúng; `isFullPaid` với còn thiếu → `remaining=0`, `qr=null`.
  - Tháng chưa từng mở: gọi `getNotice` → số `monthlyTuition` trong DB không đổi (chỉ đọc).
  - User khác → `NOT_FOUND`.
- MỚI `tests/integration/settings.test.ts`: chưa cài → `null`; lưu → đọc lại đúng; lưu `null` → `null`; BIN sai → `BAD_REQUEST`; user khác không thấy của nhau.

### E2E (`tests/e2e/tuition-notice.spec.ts`, MỚI, 390×844)
`addInitScript` xoá `navigator.share`/`canShare` để đi nhánh tải file. Menu avatar → Cài đặt → chọn Vietcombank, nhập TK, tên → Lưu → toast. Tạo HS + 2 ca có mặt tháng hiện tại → `/tuition` → nút "Phiếu báo" trên thẻ → thấy tên HS, "Còn phải trả", ảnh QR (`img` có `src` bắt đầu `data:image/png`) → "Tải ảnh" → sự kiện `download` có tên đuôi `.png`, kích thước > 0. Mở lại từ sheet chi tiết → cùng phiếu. Xoá thông tin ngân hàng → phiếu hiện dòng nhắc + link Cài đặt, không có QR. Kiểm không tràn ngang, nút ≥ 44px.

### Kiểm tay (ghi vào PR)
Trên iPhone Safari và Android Chrome: Chia sẻ → Zalo nhận ảnh; chữ có dấu đúng; quét QR bằng 2 app ngân hàng thấy đúng TK, số tiền, nội dung.

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch. Test chỉ chạy trên `.env.test`.

## 11. Interface cho các phần sau

| Tên | Loại | Dùng bởi |
|---|---|---|
| `TuitionNoticeCard` (`{ notice, onReady? }`, `forwardRef`) | component thuần hiển thị, không gọi tRPC, không phụ thuộc đăng nhập | G (trang phụ huynh render trực tiếp) |
| `TuitionNoticeDTO` | type, `src/lib/types/models.ts` | G |
| `getTuitionNotice(db, userId, { studentId, year, month })` | service chỉ đọc | G (sau khi đổi token → `userId` + `studentId`) |
| `buildVietQrPayload`, `buildTransferContent`, `crc16Ccitt` | `src/lib/vietqr.ts` | G, D (nếu nhắc nợ kèm QR) |
| `elementToPngBlob`, `shareOrDownloadPng`, `canShareFiles` | `src/lib/share-image.ts` | G, phần nào cần xuất ảnh |
| `getBankAccount(db, userId)`, `VN_BANKS`, `findBank` | service / hằng | G |

## 12. Phụ thuộc / yêu cầu với B

- Cần có sẵn: `listPayments` (trả `PaymentDTO[]`, `paidAt` dạng `YYYY-MM-DD`, sắp mới nhất trước), `PaymentDTO`, `payment.create` (dùng trong test), sheet `TuitionDetailSheet` bản B (để thêm nút ở footer).
- C chỉ đọc `paidAmount`, không ghi gì vào `MonthlyTuition`/`Payment`.
- Nếu B đổi thứ tự `listPayments`, phiếu vẫn in theo thứ tự trả về; không yêu cầu B đổi gì thêm.
- Code C **sau** khi B đã merge vào `main`.

## 13. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Payload sai → quét ra sai TK/số tiền | Unit test so từng ký tự + CRC chuẩn; integration kiểm `54` = `remaining`; bắt buộc quét thật bằng 2 app trước merge |
| BIN trong `VN_BANKS` sai | Đối chiếu danh sách NAPAS khi code; lỗi chỉ ảnh hưởng 1 ngân hàng, sửa 1 dòng |
| `html2canvas` vẽ lệch (bo góc, flex, dialog đang cuộn) | Card chỉ dùng block/grid, không `rounded-full`/`inline-flex`/shadow; kiểm ảnh tải về trong E2E và kiểm tay trên 2 máy thật |
| Font Geist thiếu glyph tiếng Việt | Canvas dùng font dự phòng giống màn hình; kiểm tay chữ "Nguyễn Thị Hường" trong ảnh |
| iOS chặn chia sẻ | Tạo Blob trước khi bấm (S11); lỗi → tải file |
| Số trên phiếu lệch màn Học phí | Dùng chung `getMonthlyTuitionStatus`; test so với `getMonthlyStatus` |
| Lộ số TK | Đây là thông tin nhận tiền, vốn để gửi phụ huynh; chỉ trả qua `protectedProcedure` của chính user (G tự quyết định khi làm link công khai) |
