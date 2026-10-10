# AM — Bảng công + Thu nhập theo nơi dạy + Đã nhận tiền

**Ngày:** 2026-10-11 · **Version:** 0.21.0 · **Có migration** (backup Neon trước merge) · **Bên code:** Claude-OTD · **Cần AL đã merge**

**Mẫu UI:** `.superpowers/mockups/aj/` 04 (thẻ Thu nhập, Cần chú ý), 07a (ô đơn giá), 08 (Bảng công), 10 (Thu nhập), 10s (chi tiết). Thanh lọc dùng `FilterBar` của AK.

## 1. Mục tiêu

Với nơi dạy tính **theo ca/giờ** (`per_session`), giáo viên cần 3 việc:
- Biết tháng này đã dạy bao nhiêu ca, bao nhiêu giờ ở từng nơi (**Bảng công**), để đối chiếu với trung tâm.
- Nếu nhập đơn giá thì biết thu nhập dự kiến (**Thu nhập**).
- Ghi lại tiền đã nhận (**Đã nhận tiền**).

**Không bắt buộc:** nơi chưa nhập đơn giá thì không hiện gì về tiền cho nơi đó (không nhắc, không ô trống bắt buộc).

## 2. Dữ liệu

```prisma
// Đơn giá theo thời gian (fromKey như PlaceBillingChange). amount = 0 hoặc không có dòng = chưa có đơn giá.
model PlaceRateChange {
  id        Int      @id @default(autoincrement())
  placeId   Int      @map("place_id")
  fromKey   Int      @map("from_key")
  unit      String   @db.VarChar(8)    // session | hour
  amount    Int
  createdAt DateTime @default(now()) @map("created_at")
  place     TeachingPlace @relation(fields: [placeId], references: [id], onDelete: Cascade)
  @@unique([placeId, fromKey])
  @@map("place_rate_changes")
}

// Mỗi lần nhận tiền 1 dòng (nhận nhiều đợt được). Xoá mềm như Payment.
model PlacePayment {
  id         Int       @id @default(autoincrement())
  placeId    Int       @map("place_id")
  year       Int
  month      Int
  amount     Int
  receivedAt DateTime  @map("received_at") @db.Date
  note       String?   @db.Text            // thêm vào ENCRYPTED_FIELDS như Payment.note
  source     String    @default("manual") @db.VarChar(8) // manual | payos (AO)
  isDeleted  Boolean   @default(false) @map("is_deleted")
  deletedAt  DateTime? @map("deleted_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  place      TeachingPlace @relation(fields: [placeId], references: [id], onDelete: Cascade)
  @@index([placeId, year, month])
  @@map("place_payments")
}
```

## 3. Cách tính (hàm thuần trong `src/server/services/timesheet.service.ts`)

**Ca tính công** của nơi P trong tháng M: ca có `placeId = P`, `isDeleted = false`, `sessionDate` thuộc tháng M (theo ngày VN). Chia loại:

| Loại | Điều kiện | Tính công? |
|---|---|---|
| **Đã dạy** | `status != cancelled` và `sessionDate ≤ hôm nay` | Có. Gồm cả ca bù (`makeupOfId != null`), đếm riêng "trong đó ca bù" |
| **Sắp dạy** | `status != cancelled` và `sessionDate > hôm nay` | Không, chỉ hiện để biết |
| **Đã huỷ** | `status = cancelled` | Không. Hiện kèm lý do |

**Giờ của ca** = `(endTime − startTime)` tính bằng phút / 60, làm tròn 2 chữ số. Hiển thị bỏ số 0 thừa: "1,5 giờ".

**Thu nhập dự kiến tháng M** = theo đơn giá có hiệu lực tại M (`resolveRate`):
- `unit = session` → số ca đã dạy × amount.
- `unit = hour` → round(tổng giờ đã dạy × amount).

**Số tiền dự kiến của phiếu/thu nhập tháng hiện tại** chỉ tính ca **đã dạy** (≤ hôm nay). Tháng đã qua thì đủ cả tháng.

**Đã nhận** = Σ `PlacePayment.amount` (chưa xoá) của P, tháng M.
**Còn thiếu** = max(0, dự kiến − đã nhận). Nhận dư thì hiện "Nhận dư X đ", không chuyển sang tháng sau. Nơi dạy trả theo tháng, không chạy nợ như học phí, nên làm đơn giản.

**Trạng thái tháng:**
- **Đã nhận đủ:** đã nhận ≥ dự kiến > 0.
- **Nhận một phần:** 0 < đã nhận < dự kiến.
- **Chưa nhận:** đã nhận = 0, dự kiến > 0.
- **Chưa có đơn giá:** không có dòng rate có hiệu lực, hoặc amount = 0.

Dùng lại màu/badge `TuitionStatusBadge`.

## 4. Màn hình

### 4.1 Tab "Bảng công": route `/timesheet`, nav chính sau Học phí
- **Chỉ hiện khi `hasPerSession`** (AL `usePlaceSummary`). Mobile thay chỗ tab Báo cáo trong tab bar nếu user không có `per_student`, còn không thì vào "Thêm". Ghi Ruling nếu tab bar khác.
- Trang có 2 tab segmented: **Bảng công | Thu nhập**.

**Tab Bảng công (mẫu 08):**
- Thanh: Select nơi dạy (`primaryFilter`, chỉ nơi `per_session`, mặc định nơi đầu, có mục "Tất cả nơi") · bước tháng (`period`) · ⋯ (Xuất Excel, Tải ảnh).
- 4 StatCard: Đã dạy (ca · giờ) · Trong đó ca bù · Đã huỷ (không tính công) · Tổng đã xếp.
- Bảng chi tiết từng ca, dựng theo Card "Lịch học cá nhân" của Báo cáo:
  - ngày/thứ · môn · giờ · số giờ · số HS có mặt/tổng · nhãn Đã dạy / Sắp dạy / Đã huỷ / Ca bù
  - mobile dạng thẻ
  - hiện 20 dòng + "Xem thêm"
- Dòng nhắc nếu tháng có ca **chưa gắn nơi dạy** (`placeId null` ở user có ≥ 2 nơi): "X ca chưa gắn nơi dạy". Bấm mở lịch đã lọc tháng đó.
- **Xuất Excel / Tải ảnh:**
  - Nội dung: tên GV, nơi dạy, tháng, bảng ca (ngày, giờ, môn, số giờ, số HS có mặt), tổng ca/giờ.
  - **Mặc định không kèm tiền.** Có công tắc "Kèm số tiền" (tắt sẵn, nhớ trong phiên).
  - Ảnh dùng cách chụp đang có (html-to-image hoặc tương đương mà "Chụp lịch PNG" dùng).
- **Gói:** cả tab Bảng công là **Plus**. Standard thấy bảng mờ + LockedSection như các màn khoá hiện có.

**Tab Thu nhập (mẫu 10, 10s):**
- Thanh: bước tháng · Bộ lọc (trạng thái).
- Dựng theo trang Học phí: mỗi dòng 1 nơi `per_session` có đơn giá. Cột: nơi (chấm màu) · số ca/giờ · đơn giá · dự kiến · đã nhận · trạng thái.
- Nơi chưa có đơn giá **không hiện dòng**. Nếu tất cả đều chưa có thì hiện empty state "Nhập đơn giá ở Nơi dạy để xem thu nhập" + nút mở Nơi dạy.
- Bấm dòng → sheet chi tiết (theo `TuitionDetailSheet`) với 2 tab:
  - **Diễn giải:** ca × đơn giá theo từng đơn giá nếu tháng đổi giá giữa chừng.
  - **Lịch sử nhận:** danh sách lần nhận, xoá được, có xác nhận.
- Nút **"Ghi nhận đã nhận"** mở hộp theo `PaymentFormDialog`: số tiền (mặc định = còn thiếu), ngày nhận (mặc định hôm nay), ghi chú.
- **Gói:**
  - Xem số dự kiến: **Standard**.
  - Ghi nhận đã nhận + lịch sử: **Plus** (Standard bấm thì mở UpgradeDialog).

### 4.2 Nơi dạy: thêm đơn giá (mẫu 07a)
- Form nơi `per_session` có khối **Đơn giá (không bắt buộc)**: segmented Theo ca / Theo giờ + ô số tiền (`CurrencyInput`).
- Nơi đã có ca thì hiện thêm "Áp dụng từ tháng" (mặc định tháng hiện tại, chọn được tháng trước đó tối đa 12 tháng). Lưu thì tạo/ghi đè `PlaceRateChange{fromKey}`.
- Dòng phụ ở danh sách: "Trung tâm · Theo giờ · 185.000 đ/giờ".
- Có link "Lịch sử đơn giá" mở danh sách các mức.

### 4.3 Tổng quan (mẫu 04)
- **Thẻ "Thu nhập tháng này"**, hiện khi có ít nhất 1 nơi có đơn giá **hoặc** `hasPerStudent`:
  - Số chính = học phí đã dạy (`totalRevenueMonth` hiện có) + thu nhập dự kiến các nơi `per_session`.
  - 2 dòng phụ: "Học phí …" (khi `hasPerStudent`) và "Nơi dạy … · đã nhận …" (khi có nơi có đơn giá).
  - User chỉ có `per_student` thì **không thêm thẻ này** (đã có ô Học phí đã dạy).
- Thẻ **"Giờ dạy tháng này"** (tổng giờ đã dạy mọi nơi), hiện khi `hasPerSession`.
- **Cần chú ý** (gói Pro như các nhóm khác): nhóm mới **"Nơi dạy còn thiếu tiền tháng trước"**, gồm nơi có tháng trước còn thiếu > 0. Dòng: tên nơi · số còn thiếu. Bấm mở Thu nhập tháng trước.

## 5. Ngoài phạm vi

Phiếu báo theo nơi + trang người trả + chuyên cần + biểu đồ 12 tháng (AN). payOS theo nơi (AO).

## 6. Test chính

- **Unit `timesheet` (hàm thuần):**
  - chia loại ca đúng ở ranh giới hôm nay
  - giờ ca 90 phút = 1,5
  - theo ca / theo giờ
  - đổi đơn giá giữa tháng: dùng mức có hiệu lực tại tháng (fromKey theo tháng, không theo ngày)
  - không có đơn giá → "Chưa có đơn giá"
  - nhận dư / một phần / đủ
- **Integration router:**
  - `timesheet.month({ placeId?, year, month })`
  - `income.month({ year, month })`
  - `placePayment.create/delete`: chặn nơi của user khác (NOT_FOUND), chặn Standard (FORBIDDEN)
  - `placeRate.set`
- **Tổng quan:** thu nhập = học phí + nơi; nhóm "Nơi dạy còn thiếu tiền" chỉ hiện ở Pro.
- **Ẩn/hiện:** user không có `per_session` không thấy tab Bảng công.
- **Excel:** mặc định không có cột tiền; bật công tắc thì có.
- **e2e:** tạo nơi Trung tâm theo giờ 185.000 → tạo 2 ca 1,5 giờ đã qua → Bảng công 2 ca 3 giờ → Thu nhập 555.000 → ghi nhận 500.000 → "Nhận một phần, còn thiếu 55.000".
- Ảnh 375/1280, tự xem.
