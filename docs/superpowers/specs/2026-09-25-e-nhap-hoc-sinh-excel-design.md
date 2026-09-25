# E — Nhập học sinh từ Excel

> Phần E trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0. Không phụ thuộc phần nào khác; dùng lại khối UI của A1 (`PageHeader`, vùng chạm `h-11 md:h-10`).

## 1. Bối cảnh

Đầu năm học hoặc khi mới dùng app, giáo viên phải thêm từng học sinh qua `StudentFormDialog` (mỗi em 6 ô). Danh sách thường đã có sẵn trong Excel/Zalo.

Hiện trạng liên quan:

- Model `Student`: `fullName` (≤100), `grade` (SmallInt), `parentName?` (≤100), `parentPhone?` (≤15), `tuitionFee` (Int, mặc định 0), `notes?`, `isActive` (mặc định true). Không có ràng buộc unique nào trên tên.
- `studentCreateSchema` (`src/lib/schemas/student.ts`): tên 2–100 ký tự (trim), lớp 1–9, SĐT theo `phoneRegex` `^(0|\+84)[0-9]{8,9}$` (chuỗi rỗng → không có), tên PH ≤100, ghi chú ≤1000, học phí số nguyên ≥0.
- `createStudent` (`student.service.ts`) tạo 1 em; router `student.*` ở `src/server/trpc/routers/student.ts`.
- Thư viện Excel: `exceljs` (^4.4.0) + `file-saver` đã có, dùng ở client trong `src/hooks/useExcelExport.ts`. Không thêm thư viện mới.
- `TRPCProvider` tự `invalidateQueries()` sau mọi mutation thành công → danh sách tự làm mới, không cần invalidate tay.

## 2. Mục tiêu và tiêu chí hoàn thành

Trên điện thoại (390px) và desktop, giáo viên làm được:

1. Tải file mẫu `.xlsx` từ màn Học sinh.
2. Chọn file đã điền → thấy bảng xem trước: dòng hợp lệ, dòng lỗi (kèm lý do theo từng ô), dòng trùng (kèm HS đang có bị trùng).
3. Dòng lỗi không nhập được; dòng trùng mặc định bỏ qua, tick được để vẫn nhập.
4. Bấm **Nhập N học sinh** → tất cả N em được tạo, hoặc không em nào (lỗi thì báo, dữ liệu không đổi).

Đo được: file 300 dòng hợp lệ nhập xong trong 1 lần bấm; nhập lại đúng file đó lần 2 → mọi dòng hiện "trùng", mặc định không tạo thêm em nào.

## 3. Quyết định đã chốt (người dùng)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Luồng | Tải mẫu → chọn file → xem trước (đánh dấu lỗi, trùng) → bấm xác nhận mới nhập. |
| Q2 | Thế nào là trùng | Cùng họ tên (không phân biệt hoa thường, bỏ khoảng trắng thừa) **và** cùng lớp với HS đã có. Dòng trùng mặc định bỏ qua, tick để vẫn nhập. |
| Q3 | Cột | Họ tên, Lớp, Tên phụ huynh, SĐT phụ huynh, Học phí/buổi, Ghi chú. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| D1 | Đọc file ở đâu | **Client** (exceljs trong trình duyệt). Server chỉ nhận JSON các dòng đã đọc. | File không đi qua Vercel Function → không đụng giới hạn body 4,5MB, không phải thêm route upload multipart. exceljs đã chạy ở client sẵn. Server **vẫn validate lại** bằng `studentCreateSchema` nên client không qua mặt được. |
| D2 | Giới hạn | Tối đa **500 dòng dữ liệu**, file ≤ **2MB**. | 500 dòng JSON ≈ 150KB, xa giới hạn 4,5MB; 1 giáo viên dạy kèm không có 500 em. Quá giới hạn → báo lỗi, không xem trước. |
| D3 | Trùng với HS đã ngừng học | **Có tính**, nhãn "trùng với HS đã nghỉ". | Em quay lại học thì nên bật lại hồ sơ cũ (giữ lịch sử học phí) thay vì tạo bản thứ hai. Vẫn tick để nhập được. |
| D4 | Trùng trong chính file | Có tính: dòng sau trùng dòng trước (cùng khóa tên + lớp) → "trùng dòng X trong file", mặc định bỏ qua. | Tránh dán 2 lần cùng một em. |
| D5 | So khớp tên | Chuẩn hóa: `normalize("NFC")` → trim → gộp khoảng trắng → `toLocaleLowerCase("vi")`. **Giữ dấu** ("An" ≠ "Ân"). | Excel trên Mac/copy từ web có thể ra dạng NFD, nhìn giống nhưng so khác. Bỏ dấu sẽ gộp nhầm tên khác nhau. |
| D6 | Tất cả hoặc không | Server kiểm tra lại toàn bộ rồi mới ghi, trong 1 `db.$transaction`; có 1 dòng sai → không ghi dòng nào. | Theo yêu cầu. |
| D7 | Chống nhập 2 lần | Lúc ghi, server **kiểm tra trùng lại**; dòng trùng mà client không đánh dấu `allowDuplicate` → hủy cả lô, báo "Danh sách đã thay đổi, hãy chọn lại file". | Bấm 2 lần / mạng chập chờn rồi thử lại không sinh bản sao. |
| D8 | Trạng thái HS nhập vào | Luôn `isActive = true`. Không có cột trạng thái. | YAGNI. |
| D9 | Lối vào | Nút **Nhập Excel** trong `PageHeader` của `StudentList`, cạnh "Thêm học sinh". Mobile chỉ hiện icon (giống `UpgradeAllClassesButton`). | Không thêm màn mới. |

## 5. Phạm vi

### Trong phạm vi
- Nút + dialog nhập (MỚI `src/components/students/ImportStudentsDialog.tsx`).
- Hàm thuần đọc/chuẩn hóa dòng (MỚI `src/lib/student-import.ts`), dùng chung client/server.
- Tạo file mẫu ở client.
- Procedure MỚI `student.importCheck`, `student.importMany`.
- i18n vi/en.

### Ngoài phạm vi (YAGNI)
- File `.xls` (Excel 97), `.csv`, Google Sheets link. Chỉ `.xlsx`.
- Cập nhật HS đã có từ file (upsert), gộp hồ sơ trùng, bật lại HS đã nghỉ tự động.
- Gán HS vào ca dạy / môn khi nhập.
- Sửa dữ liệu ngay trong bảng xem trước (sai thì sửa file rồi chọn lại).
- Migration DB: không cần.

## 6. Giao diện

### 6.1 Lối vào (`StudentList`)
Thêm nút **Nhập Excel** (icon `FileSpreadsheet` màu xanh như `ExportExcelButton`, `variant="outline"`, `h-11 px-3 md:h-10 md:px-4`) vào `actions` của `PageHeader`, giữa `UpgradeAllClassesButton` và "Thêm học sinh". Dưới `sm` chỉ hiện icon, `aria-label` = "Nhập Excel". Bấm → mở `ImportStudentsDialog`.

### 6.2 Dialog — bước 1: chọn file
Dialog toàn màn hình ở mobile, `sm:max-w-3xl` ở desktop (cùng kiểu class với `StudentFormDialog`).
- Đoạn hướng dẫn 1 dòng: "Tải file mẫu, điền mỗi học sinh 1 dòng, rồi chọn file để xem trước."
- Nút **Tải file mẫu** → tạo `mau-nhap-hoc-sinh.xlsx` (xem 6.4).
- Nút **Chọn file** (`<input type="file" accept=".xlsx">` ẩn, nút `h-11` kích hoạt).
- Lỗi đọc file hiện ngay dưới nút: không phải xlsx / hỏng, >2MB, sai mẫu (tiêu đề cột không khớp), không có dòng dữ liệu, >500 dòng.
- Đang đọc: nút hiện `Loader2` quay, khóa nút.

### 6.3 Dialog — bước 2: xem trước
- Dòng tóm tắt: "{ok} hợp lệ · {dup} trùng · {err} lỗi".
- Danh sách dòng, **cùng markup thẻ cho mobile và desktop** (dialog hẹp, bảng 7 cột sẽ tràn): mỗi thẻ `rounded-lg border p-3`:
  - Dòng đầu: "Dòng {rowNumber}" (số dòng thật trong Excel) + họ tên + "Lớp {grade}".
  - Dòng phụ: tên PH · SĐT · học phí (`formatCurrency`) · ghi chú (`truncate`).
  - **Lỗi**: viền/nền đỏ nhạt, liệt kê lý do theo ô ("Lớp phải là số từ 1 đến 9", …). Không có ô tick.
  - **Trùng**: viền vàng, lý do "Trùng với {fullName} (lớp {grade})" / "… đã nghỉ" / "Trùng dòng {n} trong file"; có `Checkbox` **Vẫn nhập** (vùng chạm ≥44px), mặc định bỏ tick.
  - **Hợp lệ**: không đánh dấu thêm.
- Thứ tự: lỗi trước, rồi trùng, rồi hợp lệ (để thấy chỗ cần xử lý ngay).
- Chân dialog (dính đáy ở mobile): **Chọn file khác** (về bước 1), **Nhập {n} học sinh** (`w-full sm:w-auto`, disabled khi n = 0 hoặc đang gửi). n = số hợp lệ + số trùng đã tick.
- Thành công → toast "Đã nhập {n} học sinh", đóng dialog. Lỗi server → toast lỗi, giữ nguyên bước 2.

### 6.4 File mẫu
Tạo ở client bằng exceljs (dùng `import("exceljs")` động để không làm nặng trang Học sinh khi chưa dùng) + `saveAs` của `file-saver`.
- Sheet 1 "Hoc sinh": dòng 1 là tiêu đề 6 cột theo thứ tự: **Họ tên***, **Lớp***, Tên phụ huynh, SĐT phụ huynh, Học phí/buổi, Ghi chú. In đậm, nền `headerBg` như `useExcelExport`. Cột SĐT đặt `numFmt = "@"` (text) để Excel không nuốt số 0 đầu. Không có dòng ví dụ (tránh bị nhập nhầm).
- Sheet 2 "Huong dan": mỗi cột 1 dòng giải thích (bắt buộc?, định dạng, ví dụ).
- Tiêu đề cột luôn là tiếng Việt bất kể ngôn ngữ giao diện (1 mẫu duy nhất, parser chỉ cần 1 bộ nhãn).

## 7. Đọc file và chuẩn hóa (`src/lib/student-import.ts` — MỚI)

Tách phần đụng exceljs (chỉ ở dialog) khỏi phần thuần (test được bằng Vitest, không cần file thật):

- `IMPORT_COLUMNS` — 6 nhãn tiêu đề + field tương ứng: `fullName`, `grade`, `parentName`, `parentPhone`, `tuitionFee`, `notes`.
- `MAX_IMPORT_ROWS = 500`, `MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024`.
- `nameKey(fullName, grade)` → chuỗi khóa theo D5, dùng chung cho client (trùng trong file) và server (trùng với DB).
- `cellToText(value)` — ô exceljs có thể là số, chuỗi, `Date`, `{ richText }`, `{ result }` (công thức), `{ text }` (hyperlink), null → trả chuỗi đã trim.
- `parseImportRows(rows: { rowNumber: number; cells: unknown[] }[])` → `{ rowNumber, input, errors }[]`:
  - Bỏ qua dòng mà cả 6 ô rỗng.
  - `grade`: chấp nhận `5`, `"5"`, `"Lớp 5"` (không phân biệt hoa thường) → số.
  - `parentPhone`: bỏ khoảng trắng, dấu chấm, gạch; nếu ô là **số** 9 chữ số → thêm `0` đầu (Excel đã bỏ).
  - `tuitionFee`: số, hoặc chuỗi kiểu `150.000` / `150,000` / `150000đ` → bỏ ký tự không phải số → số nguyên VND. Rỗng → 0.
  - Chạy `studentCreateSchema.safeParse(input)`; `errors` = danh sách **tên field** lỗi (lấy từ `issue.path[0]`), không dùng message Zod (message mặc định của `min/max` là tiếng Anh). UI dịch bằng key `import_err_<field>`.
- Kiểm tra tiêu đề: dòng 1 phải khớp `IMPORT_COLUMNS` (so bằng chuẩn hóa D5); không khớp → lỗi "File không đúng mẫu".

Dialog: `file.arrayBuffer()` → `workbook.xlsx.load` → sheet đầu tiên → dựng `rows` (bỏ dòng 1) → `parseImportRows` → đánh dấu trùng trong file bằng `nameKey` → gọi `student.importCheck` với các dòng hợp lệ để lấy trùng DB.

## 8. Backend

Không đổi schema, không migration.

### 8.1 Schema (`src/lib/schemas/student.ts`)
- MỚI `studentImportCheckSchema = z.object({ rows: z.array(z.object({ fullName: z.string().max(100), grade: z.number().int() })).max(500) })`.
- MỚI `studentImportSchema = z.object({ rows: z.array(studentCreateSchema.omit({ isActive: true }).extend({ allowDuplicate: z.boolean().default(false) })).min(1).max(500) })`. Zod từ chối cả request nếu 1 dòng sai → đúng "tất cả hoặc không".

### 8.2 `checkImportDuplicates(db, userId, rows)` — MỚI trong `student.service.ts`
- 1 truy vấn: `db.student.findMany({ where: { userId, grade: { in: grades } }, select: { id, fullName, grade, isActive } })` (gồm cả HS đã nghỉ theo D3).
- Dựng map `nameKey → student`; trả `{ matches: Array<{ id, fullName, grade, isActive } | null> }` theo đúng thứ tự `rows`.
- Router: `importCheck: protectedProcedure.input(studentImportCheckSchema).mutation(...)` (mutation để input đi trong body POST, không nhét 500 dòng vào URL GET).

### 8.3 `importStudents(db, userId, rows)` — MỚI
Trong 1 `db.$transaction(async (tx) => …)`:
1. Tìm trùng lại như 8.2 bằng `tx`, **cộng cả trùng trong lô** (dòng sau cùng khóa với dòng trước).
2. Có dòng trùng mà `allowDuplicate = false` → `TRPCError CONFLICT` "Danh sách đã thay đổi, hãy chọn lại file để kiểm tra." (không ghi gì).
3. `tx.student.createMany({ data: rows.map(r => ({ userId, fullName, grade, parentPhone ?? null, parentName ?? null, notes ?? null, tuitionFee, isActive: true })) })` — ánh xạ field giống `createStudent`.
4. Trả `{ created: count }`.

Router: `importMany: protectedProcedure.input(studentImportSchema).mutation(...)`. `userId` luôn lấy từ `ctx.userId`, không nhận từ client (multi-tenant).

### 8.4 Giữ nguyên
`createStudent`, `student.create`, `listStudents`, `StudentFormDialog`.

## 9. i18n

Thêm vào cả `vi.json` và `en.json` (số key 2 file bằng nhau). Dò key có sẵn trước (`cancel`, `grade`, `full_name`, `parent_phone`, `parent_name`, `tuition_fee`, `export_excel`, …) để dùng lại.

| Key | vi | en |
|---|---|---|
| `import_excel` | Nhập Excel | Import Excel |
| `import_students_title` | Nhập học sinh từ Excel | Import students from Excel |
| `import_hint` | Tải file mẫu, điền mỗi học sinh 1 dòng, rồi chọn file để xem trước. | Download the template, fill one student per row, then choose the file to preview. |
| `download_template` | Tải file mẫu | Download template |
| `choose_file` | Chọn file | Choose file |
| `choose_other_file` | Chọn file khác | Choose another file |
| `import_summary` | {ok} hợp lệ · {dup} trùng · {err} lỗi | {ok} valid · {dup} duplicate · {err} errors |
| `import_row` | Dòng {n} | Row {n} |
| `import_dup_existing` | Trùng với {name} (lớp {grade}) | Matches {name} (grade {grade}) |
| `import_dup_inactive` | Trùng với {name} (lớp {grade}, đã nghỉ) | Matches {name} (grade {grade}, inactive) |
| `import_dup_in_file` | Trùng dòng {n} trong file | Same as row {n} in file |
| `import_anyway` | Vẫn nhập | Import anyway |
| `import_submit` | Nhập {n} học sinh | Import {n} students |
| `import_success` | Đã nhập {n} học sinh | Imported {n} students |
| `import_err_file` | Không đọc được file. Hãy chọn file .xlsx. | Cannot read file. Please choose an .xlsx file. |
| `import_err_size` | File quá 2MB | File exceeds 2MB |
| `import_err_template` | File không đúng mẫu. Hãy tải file mẫu. | File doesn't match the template. Please download it. |
| `import_err_empty` | File không có dòng dữ liệu | File has no data rows |
| `import_err_too_many` | Tối đa 500 học sinh mỗi lần | At most 500 students per import |
| `import_err_fullName` | Họ tên phải từ 2 đến 100 ký tự | Name must be 2–100 characters |
| `import_err_grade` | Lớp phải là số từ 1 đến 9 | Grade must be a number from 1 to 9 |
| `import_err_parentPhone` | SĐT không hợp lệ | Invalid phone number |
| `import_err_parentName` | Tên phụ huynh tối đa 100 ký tự | Parent name max 100 characters |
| `import_err_tuitionFee` | Học phí phải là số không âm | Fee must be a non-negative number |
| `import_err_notes` | Ghi chú tối đa 1000 ký tự | Notes max 1000 characters |

Thông báo lỗi từ server (`CONFLICT`) giữ tiếng Việt như các service khác. Chuỗi mới không dùng dấu gạch dài trong câu tiếng Việt.

## 10. Kiểm thử

### Unit (`tests/unit/lib/student-import.test.ts` — MỚI)
- `nameKey`: hoa/thường, khoảng trắng thừa, NFD vs NFC cho cùng khóa; "An" và "Ân" khác khóa; khác lớp → khác khóa.
- `cellToText`: số, richText, công thức `{ result }`, hyperlink, null.
- `parseImportRows`: dòng rỗng bị bỏ; `"Lớp 5"` → 5; SĐT số `912345678` → `"0912345678"`; `"150.000"` → 150000; học phí rỗng → 0; lớp 10 → lỗi `grade`; tên 1 ký tự → lỗi `fullName`; nhiều lỗi 1 dòng → đủ các field.

### Integration (`tests/integration/student-import.test.ts` — MỚI, qua `getAuthedCaller`)
- `importMany` 3 dòng hợp lệ → `created: 3`, `student.list` có đủ, `isActive = true`, field đúng.
- 1 dòng sai trong lô (lớp 0 / SĐT sai) → lỗi validate, **số HS trong DB không đổi**.
- `importCheck` nhận ra trùng HS đang học và HS đã nghỉ (`softDeleteStudent` trước), khác lớp thì không trùng.
- `importMany` có dòng trùng DB, `allowDuplicate` false → `CONFLICT`, DB không đổi; `true` → tạo được.
- Hai dòng cùng khóa trong lô, dòng 2 không `allowDuplicate` → `CONFLICT`.
- Gọi `importMany` 2 lần cùng dữ liệu → lần 2 `CONFLICT` (chống nhập 2 lần).
- Multi-tenant: HS của user khác cùng tên + lớp **không** tính là trùng.
- 501 dòng → bị từ chối.

### E2E (`tests/e2e/students-import.spec.ts` — MỚI, 390×844)
Màn Học sinh → bấm icon Nhập Excel → Tải file mẫu (bắt event `download`) → `setInputFiles` một file dựng sẵn bằng exceljs trong test (2 dòng hợp lệ tên `E2E-<random>`, 1 dòng lớp 12) → thấy tóm tắt "2 hợp lệ · 0 trùng · 1 lỗi" và lý do lớp → Nhập 2 học sinh → toast, tìm thấy 2 em trong danh sách → mở lại, chọn đúng file đó → 2 dòng hiện trùng, nút nhập disabled.

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch. An toàn dữ liệu như A1/A2: test chỉ chạy trên `.env.test`, không chạy `pnpm build` ở local.

## 11. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Excel nuốt số 0 đầu SĐT, đổi học phí thành chuỗi có dấu chấm | Mẫu đặt cột SĐT dạng text; parser bù `0` cho số 9 chữ số và bỏ ký tự thừa ở học phí; dòng vẫn sai thì hiện lỗi ô |
| Tên cùng chữ nhưng khác mã Unicode (NFD) lọt qua kiểm tra trùng | `nameKey` chuẩn hóa NFC; có unit test |
| exceljs (~1MB) làm nặng trang Học sinh | `import("exceljs")` động chỉ khi mở dialog/tải mẫu |
| Nhập nhầm cả lô sai | Bắt buộc xem trước + bấm xác nhận; nếu đã nhập, xóa từng em như hiện nay (không làm "hoàn tác lô" – YAGNI) |
| Validate client và server lệch nhau | Cả hai dùng chung `studentCreateSchema` và `nameKey`; server là nơi quyết định cuối |
| `createMany` 500 dòng vượt timeout transaction mặc định (5s) | 1 câu INSERT nhiều giá trị + 1 SELECT, dưới 1s với 500 dòng; nếu cần, đặt `timeout` như `bulkCreateSessions` |
