# AN — Phiếu báo theo nơi dạy + trang người trả + Chuyên cần + Thu nhập 12 tháng

**Ngày:** 2026-10-11 · **Version:** 0.22.0 · **Có migration** (backup Neon trước merge) · **Bên code:** Claude-OTD · **Cần AM đã merge**

**Mẫu UI:** `.superpowers/mockups/aj/`
- 12 (phiếu báo theo nơi), 13 (trang người trả)
- 09a / 09b (chuyên cần)
- 10 (biểu đồ 12 tháng)
- 08 / 10 (nút Phiếu báo)

Dựng theo `TuitionNoticeCard`, `ParentView`, trang Báo cáo (bảng "Đồng bộ UI" trong `bao-cao-AJ.md`).

## 1. Phiếu báo theo nơi dạy (Plus)

Nơi `per_session` có đơn giá (gia đình nhà kèm, nhóm gia sư, trung tâm) có thể nhận **1 phiếu / tháng**.

**Nội dung phiếu**, dựng như `TuitionNoticeCard`:
- tiêu đề "Phiếu báo dạy kèm tháng M/YYYY"
- "Gửi: <tên nơi>", GV, môn (các môn của ca trong tháng), ngày lập
- danh sách ngày đã dạy (ghi "(bù)" với ca bù), dòng "Không tính: dd/mm (huỷ)"
- số ca, số giờ, đơn giá, thành tiền, đã nhận, **còn phải trả**
- VietQR bằng tài khoản ngân hàng GV (cùng cách tạo QR của phiếu học phí). Nội dung chuyển khoản: `GV <tên ngắn> T<M> <tên nơi không dấu>`, cắt ≤ 25 ký tự như quy tắc phiếu HS.
- GV chưa nhập ngân hàng → phiếu không có QR, có link "Thêm tài khoản ngân hàng" tới Cài đặt.

**Mở phiếu:** nút "Phiếu báo" ở dòng Thu nhập và ở sheet chi tiết. Phiếu mở trong hộp với các thao tác:
- **Sao chép link gửi**
- **Tải ảnh phiếu** (cách chụp hiện có)
- **Đánh dấu đã gửi**, kèm tự đánh dấu khi bấm sao chép/tải ảnh, giống spec V của phiếu HS

**Dữ liệu:**

```prisma
// Link công khai cho người trả của 1 nơi dạy (như link phụ huynh: lưu hash để tra, token thật mã hoá).
model PlaceShareLink {
  placeId   Int      @id @map("place_id")
  token     String   @map("token")                 // thêm vào ENCRYPTED_FIELDS
  tokenHash String   @unique @map("token_hash") @db.VarChar(64)
  createdAt DateTime @default(now()) @map("created_at")
  place     TeachingPlace @relation(fields: [placeId], references: [id], onDelete: Cascade)
  @@map("place_share_links")
}

// Đánh dấu đã gửi phiếu theo tháng (giống MonthlyTuition.noticeSentAt/noticeSentAmount).
model PlaceMonthNotice {
  placeId    Int      @map("place_id")
  year       Int
  month      Int
  sentAt     DateTime @map("sent_at")
  sentAmount Int      @map("sent_amount")
  place      TeachingPlace @relation(fields: [placeId], references: [id], onDelete: Cascade)
  @@id([placeId, year, month])
  @@map("place_month_notices")
}
```

- Token sinh như `parent-token.ts` (256-bit, regex, hash SHA-256).
- Link dạng `/n/<token>?thang=YYYY-MM`.
- Có nút "Tắt link / Tạo link mới" trong menu ⋯ của nơi dạy.
- Số tiền đổi sau khi gửi → nhãn "Số tiền đã đổi", như phiếu HS.

## 2. Trang người trả `/n/<token>` (công khai, chỉ đọc, mẫu 13)

- Dựng theo `ParentView`:
  - thanh tháng, tối đa 6 tháng về trước như trang PH
  - phiếu (QR) lên đầu trên điện thoại
  - laptop lưới 2 cột: trái "Chi tiết ca đã dạy", phải phiếu
- Nút "Mở trang thanh toán" chỉ có ở AO (payOS). AN chỉ có QR VietQR.
- **Không lộ thông tin HS:** mỗi ca chỉ ghi ngày, giờ, môn, số giờ, **số HS có mặt**. Không có tên HS.
- **Trả 404 như token sai** trong các trường hợp:
  - token sai
  - nơi đã xoá
  - nơi không còn `per_session`
  - tài khoản GV bị khoá/xoá
  - GV hết gói Plus (giống quy tắc D9 của link PH: gia hạn là sống lại)
- Không ghi DB, chỉ đọc.
- `robots: noindex`.

## 3. Chuyên cần (mẫu 09a / 09b)

- **Route `/attendance`**, nav "Chuyên cần":
  - Hiện cho **mọi user ở gói Plus+**.
  - Standard thấy mục khoá ở menu "Thêm".
  - User có `hasPerStudent` thì đặt trong "Thêm". User chỉ `per_session` thì nằm ở tab chính thay Báo cáo.
- **Thanh:**
  - Bộ lọc: nơi dạy (khi ≥ 2 nơi), lớp (khoá Pro như Báo cáo)
  - kỳ: `ReportPeriodPicker` có Tháng / **Năm học**
  - Xuất Excel (giữ ngoài như Báo cáo)
- **Tháng (Plus):**
  - StatCard: tỉ lệ đi học trung bình, số buổi có mặt, vắng, muộn
  - bảng từng HS: buổi có mặt / tổng, thanh tỉ lệ, vắng, muộn
- **Năm học (Pro):**
  - Năm học = T9 năm N → T5 năm N+1 (chọn "2026–2027")
  - mỗi HS 1 dải 9 ô màu theo tỉ lệ từng tháng (mẫu 09b) + tỉ lệ cả năm
- **Cách tính:**
  - Chỉ ca không huỷ, đã điểm danh (khác `pending`).
  - Có mặt = present + late (giống `attendanceRate` hiện có). Vắng = absent. Muộn đếm riêng.
- **Gói:** chuyên cần tháng Plus, năm học + lọc khối Pro. Thêm vào `FEATURE_PLAN`: `attendanceMonth: plus`, `attendanceYear: pro`.

## 4. Thu nhập 12 tháng (Pro, mẫu 10)

- Ở tab Thu nhập, dưới bảng có thẻ **"12 tháng gần nhất"**:
  - biểu đồ cột (dùng lại component BarChart của admin Doanh thu)
  - mỗi tháng 2 phần chồng: học phí đã thu (khi `hasPerStudent`) + nơi dạy đã nhận
  - tooltip số
- Standard/Plus thấy thẻ khoá.
- Thêm `FEATURE_PLAN.income12m: pro`.

## 5. Báo cáo lọc theo nơi học

Trang Báo cáo: Bộ lọc thêm "Nơi học" (khi ≥ 2 nơi `per_student`). `report.monthlySummary` / số liệu nhận thêm `placeId?` lọc HS theo `Student.placeId`.

## 6. Test chính

- **Phiếu nơi dạy:**
  - số tiền = thu nhập dự kiến − đã nhận
  - liệt kê đúng ngày, ca bù, ca huỷ
  - không ngân hàng → không QR
  - nội dung CK ≤ 25 ký tự, không dấu
- **Link người trả:**
  - token sai / nơi xoá / không còn `per_session` / GV hết Plus → 404
  - trang không chứa tên HS (test kiểm text trang không có `fullName` của HS mẫu)
  - tháng ngoài khoảng → về tháng hiện tại
- **Đánh dấu đã gửi** + nhãn "Số tiền đã đổi".
- **Chuyên cần:**
  - tỉ lệ đúng (present + late)
  - ca huỷ / pending không tính
  - năm học T9–T5 qua năm
  - Standard bị chặn (FORBIDDEN), Plus không xem được năm
- **12 tháng:** số khớp tổng tháng; Plus bị chặn.
- **Báo cáo** lọc nơi học đúng.
- **e2e:** tạo phiếu nơi dạy → sao chép link → mở `/n/<token>` ở trang mới thấy QR và số tiền, không có tên HS.
- Ảnh 375/1280, tự xem.
