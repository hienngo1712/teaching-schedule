# 10 — Quản lý đóng tiền học phí theo tháng

## Mục tiêu
Cung cấp công cụ để giáo viên theo dõi xem học sinh nào đã đóng đủ tiền học trong tháng, số tiền đã đóng thực tế và các ghi chú liên quan.

## 1. Cấu trúc Dữ liệu (Prisma)

### Model `MonthlyTuition`
Lưu trữ thông tin đóng tiền của từng học sinh theo từng tháng.

```prisma
model MonthlyTuition {
  id          Int      @id @default(autoincrement())
  studentId   Int      @map("student_id")
  year        Int
  month       Int
  paidAmount  Int      @default(0) @map("paid_amount")
  isFullPaid  Boolean  @default(false) @map("is_full_paid")
  notes       String?  @db.Text
  updatedAt   DateTime @updatedAt @map("updated_at")

  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, year, month])
  @@index([year, month])
  @@map("monthly_tuition")
}
```

## 2. Logic Nghiệp vụ (Backend)

### Tuition Service (`src/server/services/tuition.service.ts`)
- `getMonthlyTuitionStatus`: 
    - Lấy danh sách học sinh (active).
    - Tính `totalExpected` (tổng `fee` các buổi `PRESENT`/`LATE` trong tháng).
    - Lấy `paidAmount` và `isFullPaid` từ bảng `MonthlyTuition`.
    - Trả về danh sách tổng hợp.
- `updatePayment`:
    - Upsert vào bảng `MonthlyTuition`.
    - Cho phép cập nhật `paidAmount`, `isFullPaid`, `notes`.

### tRPC Router (`src/server/trpc/routers/tuition.ts`)
- `tuition.getMonthlyStatus` (protectedProcedure)
- `tuition.updatePayment` (protectedProcedure)

## 3. Giao diện Người dùng (Frontend)

### Trang Quản lý Học phí (`/reports/tuition`)
- Bộ lọc: Tháng/Năm, Khối lớp, Tên học sinh.
- Bảng hiển thị:
    - STT | Họ tên | Lớp | Tổng buổi học | Tổng tiền | Đã đóng | Trạng thái | Hành động
- Trạng thái: 
    - `Đã đóng đủ` (Badge xanh)
    - `Chưa đóng đủ` (Badge vàng)
    - `Chưa đóng` (Badge đỏ)

### Dialog Ghi nhận Đóng tiền
- Hiển thị số tiền dự kiến.
- Input nhập `paidAmount`.
- Checkbox `isFullPaid`.
- Textarea `notes`.
- Nút "Đóng đủ nhanh": Tự động set `paidAmount` = `totalExpected` và `isFullPaid` = `true`.

## 4. Kế hoạch Triển khai (Phases)

### Sub 10.1 — Migration & DB Update
- Thêm model `MonthlyTuition` vào `schema.prisma`.
- Chạy `prisma migrate dev`.
- Cập nhật `Student` model relation.

### Sub 10.2 — Backend Service & Router
- Tạo `tuition.service.ts` với logic tính toán học phí.
- Tạo `tuitionRouter` và đăng ký vào `root.ts`.
- Viết integration tests cho logic tính tiền và upsert.

### Sub 10.3 — Frontend UI: Trang danh sách
- Tạo trang `/reports/tuition`.
- Hiển thị bảng dữ liệu với các bộ lọc.
- Xử lý trạng thái loading/empty.

### Sub 10.4 — Frontend UI: Dialog & Actions
- Tạo `PaymentDialog`.
- Tích hợp mutation cập nhật tiền học.
- Thêm các phím tắt (nút Đóng đủ nhanh).

### Sub 10.5 — Bổ sung Dashboard & Student Detail
- Hiển thị tóm tắt nợ phí trên Dashboard.
- Thêm tab "Lịch sử học phí" trong chi tiết học sinh.
