# AB — Form cho phụ huynh điền + Hòm thư góp ý

> Ngày: 2026-10-06 · Người yêu cầu: chủ ứng dụng · Phiên bản: **0.13.0** (minor, **có migration**: bảng `feedbacks` + 1 cột trên `users`).
> Người dùng duyệt hướng ngày 2026-10-06: phần 1 chọn **Google Form mẫu** (không làm form trong app, không gọi Google API); phần 2 chọn **mục trên menu + tự hỏi 1 lần**.

## 1. Mục tiêu

- Thầy cô mới có danh sách học sinh nhanh: gửi 1 link Google Form cho phụ huynh/học sinh điền, tải câu trả lời về `.xlsx`, nhập thẳng vào màn Học sinh **không phải sửa file**.
- Chủ app lấy được phản hồi: điểm 1–5 sao + "cần thêm gì, sửa gì", xem tập trung ở trang admin.

## 2. Phần 1 — Google Form mẫu

### 2.1 Form mẫu (chủ app tự tạo 1 lần bằng tài khoản Google của mình)
Claude không tạo được Google Form. Chủ app tạo đúng như sau rồi gửi link cho Claude:

| # | Câu hỏi (tiêu đề **gõ đúng từng chữ**) | Loại | Bắt buộc |
|---|---|---|---|
| 1 | `Họ tên` | Trả lời ngắn | Có |
| 2 | `Lớp` | Menu thả xuống: `1` … `12` | Có |
| 3 | `Tên phụ huynh` | Trả lời ngắn | Không |
| 4 | `SĐT phụ huynh` | Trả lời ngắn, xác thực biểu thức `^0\d{9}$`, báo lỗi "SĐT 10 số, bắt đầu bằng 0" | Không |
| 5 | `Ghi chú` | Đoạn | Không |

- Tiêu đề form: "Thông tin học sinh". Mô tả: "Phụ huynh/học sinh điền giúp thầy cô thông tin để lập danh sách lớp."
- Cài đặt: **không** thu thập email, không giới hạn 1 lần trả lời (khỏi bắt đăng nhập Google).
- Chia sẻ (Drive): "Bất kỳ ai có đường liên kết" quyền **Người xem**. Link tạo bản sao = `https://docs.google.com/forms/d/<ID>/copy`.
- `<ID>` để trong code là hằng `GOOGLE_FORM_TEMPLATE_ID` (`src/lib/student-import.ts`). Đây không phải bí mật.
- **Plan chờ ID này.** Chưa có ID thì không merge.

### 2.2 Đọc file câu trả lời
File Google tải về: hàng 1 = `Dấu thời gian` (tiếng Anh: `Timestamp`) + tiêu đề câu hỏi. Thầy cô có thể đã thêm câu hỏi riêng hoặc xoá cột `Dấu thời gian`.

- Giữ nguyên `parseImportHeader` cho mẫu của app. **Khi không khớp mẫu**, thử đọc **theo tên cột** (bỏ dấu, không phân biệt hoa thường, bỏ `*` cuối như hàm cũ):

| Trường | Tên cột nhận |
|---|---|
| fullName | `ho ten`, `ho ten hoc sinh`, `ho va ten` |
| grade | `lop` |
| parentName | `ten phu huynh` |
| parentPhone | `sdt phu huynh`, `so dien thoai phu huynh` |
| tuitionFee | `hoc phi`, `hoc phi/buoi` |
| billingMode | `cach thu` |
| notes | `ghi chu` |

- Đủ điều kiện khi có cột **Họ tên** và **Lớp**. Thiếu 1 trong 2 thì báo lỗi "sai mẫu" như cũ.
- Cột khác (`Dấu thời gian`, câu hỏi thầy cô tự thêm) **bỏ qua**. Hai cột trùng tên thì lấy cột đầu.
- Thiếu cột Học phí thì học phí = 0. Thiếu cột Cách thu thì tính theo buổi. Đúng mặc định của `studentCreateSchema`.
- Dòng trống, dòng trùng, quá 500 dòng: đi qua đúng các luật đang có (phần xem trước báo trùng, kể cả phụ huynh gửi 2 lần).
- Ô `Lớp` dạng `"5"` hoặc `5` hay `Lớp 5` đều qua `parseGrade`. SĐT bị Google Sheets đổi thành số mất số 0 đầu thì `parsePhone` đã tự thêm lại.
- Xem trước có ít nhất 1 dòng mà file **không có cột Học phí** thì hiện 1 dòng nhắc: "File không có học phí, học sinh sẽ có học phí 0đ. Sửa trong hồ sơ học sinh sau khi nhập."

### 2.3 Giao diện
- `ImportStudentsDialog`: dưới nút "Tải file mẫu" thêm khối **"Chưa có danh sách? Nhờ phụ huynh điền"**, gồm:
  - Nút **Tạo Google Form**: link mở tab mới tới URL `/copy`, có chữ ẩn "(mở tab mới)" cho trình đọc màn hình.
  - 3 bước ngắn: (1) Bấm **Tạo bản sao** rồi **Gửi** link cho phụ huynh. (2) Đủ câu trả lời thì vào tab **Câu trả lời**, chọn **Liên kết với Trang tính**, rồi **Tệp → Tải xuống → Microsoft Excel (.xlsx)**. (3) Chọn file đó ở ô bên dưới.
  - Link "Xem hướng dẫn chi tiết" tới `/guide#nhap-excel`.
- `guide-content.ts` mục `nhap-excel`: thêm các bước trên (chữ, không chụp ảnh giao diện Google), rồi chạy lại `pnpm guide:docx`.

## 3. Phần 2 — Hòm thư góp ý

### 3.1 Dữ liệu (migration)
```prisma
// Góp ý của giáo viên (spec AB). CASCADE để tests/setup.ts xoá users không vỡ.
model Feedback {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  rating     Int      // 1–5
  message    String?  @db.VarChar(1000)
  page       String   @db.VarChar(100)
  appVersion String   @map("app_version") @db.VarChar(20)
  createdAt  DateTime @default(now()) @map("created_at")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([userId, createdAt])
  @@map("feedbacks")
}
```
- `users.feedbackPromptAt DateTime? @map("feedback_prompt_at")`: lúc đã tự hỏi (gửi hay đóng đều tính). Khác null thì không bao giờ tự hỏi nữa.

### 3.2 API (router mới `feedback`)
- `feedback.submit({ rating: 1..5 int, message?: string ≤1000, page: string ≤100 })`: chỉ giáo viên, admin bị từ chối (FORBIDDEN).
  - `message` trim, rỗng thì lưu null. `appVersion` lấy từ server (`package.json`), không tin client.
  - **Giới hạn 5 lần/24 giờ/tài khoản.** Quá thì báo TOO_MANY_REQUESTS, giao diện hiện "Thầy cô đã gửi nhiều góp ý hôm nay, mai gửi tiếp nhé".
  - Đồng thời đặt `feedbackPromptAt = now()` nếu đang null.
- `feedback.promptStatus`: trả `{ shouldPrompt }`. `shouldPrompt` = true khi đủ cả 4: không phải admin; `feedbackPromptAt` null; chưa có góp ý nào; có **≥ 7 ngày dùng app** (đếm `UserActivityDay`).
- `feedback.dismissPrompt`: đặt `feedbackPromptAt = now()` nếu đang null.
- `admin.feedbackList({ cursor? })`: 50 dòng mới nhất mỗi trang (username, họ tên, sao, nội dung, trang, bản, thời gian), kèm tổng số, **điểm trung bình** (1 chữ số thập phân) và số lượng theo từng mức sao.

### 3.3 Giao diện giáo viên
- Menu avatar (`AppHeader`, có cả trên mobile) thêm mục **"Góp ý"**, đặt cạnh "Hướng dẫn sử dụng". Admin không thấy.
- Hộp **Góp ý cho app**:
  - 5 ngôi sao: nút bấm, `role="radiogroup"`, dùng được bàn phím (mũi tên trái/phải), nhãn "1 sao" … "5 sao". Bắt buộc chọn, chưa chọn thì nút Gửi bị tắt.
  - Ô "Cần thêm gì, sửa gì? (không bắt buộc)", tối đa 1000 ký tự, có bộ đếm.
  - Nút Gửi. Thành công thì đóng hộp và báo "Cảm ơn thầy cô đã góp ý!".
  - `page` = `pathname` lúc mở hộp.
- **Tự hỏi 1 lần:**
  - Chỉ trên `/dashboard`, khi `shouldPrompt` và **không** đang có "Có gì mới" chưa xem (tránh 2 hộp chồng nhau). Mở đúng hộp trên, tiêu đề phụ "Thầy cô thấy app thế nào?".
  - Có nút **Để sau**. Đóng bằng cách nào (Để sau, X, Esc, bấm ra ngoài) cũng gọi `dismissPrompt`, sẽ không hỏi lại.
- i18n vi + en cho mọi chữ mới.

### 3.4 Giao diện admin
- `/admin/feedback`, mục nav **"Góp ý"** (icon `MessageSquare`), thêm vào `ADMIN_NAV_ITEMS`.
- Đầu trang: điểm trung bình, tổng số góp ý, thanh đếm 5→1 sao.
- Danh sách: thẻ mỗi góp ý (sao, nội dung giữ xuống dòng, tài khoản, trang, bản, giờ VN), nút "Xem thêm" để tải trang tiếp.
- Nội dung hiện dạng chữ thường (React tự escape), không render HTML.

## 4. Ngoài phạm vi
- Không tự lấy câu trả lời từ Google (OAuth/API). Không có form đăng ký trong app.
- Không trả lời góp ý trong app, không gửi email báo admin, không đánh dấu đã đọc.

## 5. Kiểm thử
- **Unit parser:**
  - file kiểu Google (có `Dấu thời gian`/`Timestamp`, có cột lạ, cột đổi thứ tự) đọc đúng;
  - thiếu Họ tên hoặc Lớp thì báo sai mẫu;
  - mẫu cũ của app vẫn qua y như trước;
  - SĐT dạng số 9 chữ số thì thêm số 0;
  - không cột Học phí thì học phí = 0 và có cờ hiện dòng nhắc.
- **Integration `feedback`:**
  - submit hợp lệ, trim, message rỗng thì null;
  - rating 0/6/1.5 bị từ chối;
  - admin bị FORBIDDEN;
  - lần thứ 6 trong 24h bị TOO_MANY_REQUESTS;
  - `promptStatus` đúng ở 4 điều kiện;
  - `dismissPrompt` chỉ đặt 1 lần;
  - `feedbackList` phân trang, tính trung bình và đếm sao.
- **Component:**
  - hộp sao (bàn phím, Gửi bị tắt khi chưa chọn);
  - tự hỏi không bật khi có "Có gì mới" chưa xem;
  - mục menu ẩn với admin;
  - khối Google Form trong dialog nhập có link `/copy`, `target=_blank`.
- **e2e:**
  - nhập file kiểu Google (fixture tạo bằng exceljs trong test) ra đúng học sinh;
  - gửi góp ý từ menu rồi admin thấy trong `/admin/feedback`.
- `RELEASES` 0.13.0 (notify: true, guideId `nhap-excel`), `package.json` 0.13.0.
