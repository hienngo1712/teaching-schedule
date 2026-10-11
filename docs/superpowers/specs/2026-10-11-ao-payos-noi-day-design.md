# AO — payOS tự đánh dấu "Đã nhận" cho phiếu nơi dạy

**Ngày:** 2026-10-11 · **Version:** 0.23.0 · **Có migration** (backup Neon trước merge) · **Bên code:** Claude-OTD · **Cần AN đã merge**

**Dựa trên:**
- luồng payOS học phí đã chạy: spec AH (`tuition-paylink.service.ts`, `tuition-payos-webhook.service.ts`, `payos-paid.service.ts`)
- chuông báo tiền AI (`payos-notice.service.ts`)

Chỉ mở rộng, không đổi luồng HS.

## 1. Mục tiêu

GV gói **Pro** đã nối payOS (thẻ payOS trong Cài đặt, dùng chung kết nối cho HS và nơi dạy):
- Phiếu báo nơi dạy có **QR payOS** thay VietQR thường, kèm nút "Mở trang thanh toán" ở trang người trả.
- Người trả quét và chuyển xong thì app **tự ghi "Đã nhận"** cho nơi đó, tháng đó, và chuông báo tiền hiện thông báo.

GV không Pro hoặc chưa nối payOS → phiếu dùng VietQR như AN.

## 2. Dữ liệu

```prisma
// Mỗi QR payOS phát cho 1 phiếu nơi dạy/tháng. orderCode gửi payOS = PLACE_ORDER_OFFSET + id
// để không trùng TuitionPayLink.id (cùng một tài khoản payOS của GV).
model PlacePayLink {
  id            Int      @id @default(autoincrement())
  userId        Int      @map("user_id")
  placeId       Int      @map("place_id")
  year          Int
  month         Int
  amount        Int
  status        String   @default("active") @db.VarChar(10) // active | cancelled | paid
  payosLinkId   String   @map("payos_link_id") @db.VarChar(64)
  qrCode        String   @map("qr_code") @db.Text
  checkoutUrl   String   @map("checkout_url") @db.Text
  createdAt     DateTime @default(now()) @map("created_at")
  place         TeachingPlace @relation(fields: [placeId], references: [id], onDelete: Cascade)
  payments      PlacePayLinkPayment[]
  @@index([placeId, year, month, status])
  @@index([userId])
  @@map("place_pay_links")
}

model PlacePayLinkPayment {
  id             Int      @id @default(autoincrement())
  linkId         Int      @map("link_id")
  reference      String   @db.VarChar(64)
  amount         Int
  paidAt         DateTime @map("paid_at")
  placePaymentId Int      @map("place_payment_id")   // dòng PlacePayment đã ghi
  createdAt      DateTime @default(now()) @map("created_at")
  link           PlacePayLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  @@unique([linkId, reference])
  @@map("place_pay_link_payments")
}
```

`PLACE_ORDER_OFFSET = 1_000_000_000` (hằng số). Ghi chú trong code: TuitionPayLink.id không bao giờ chạm mức này, payOS cho orderCode tới 2^53.

## 3. Luồng

1. **Mở phiếu nơi dạy** (Pro + đã nối payOS + còn phải trả > 0):
   - Tạo hoặc dùng lại link `active` cùng nơi/tháng/số tiền.
   - Số tiền đổi → huỷ link cũ (`cancelled`, gọi payOS cancel như luồng HS) rồi tạo link mới.
   - Lỗi payOS → phiếu rơi về VietQR và báo nhẹ "Chưa tạo được QR payOS".
2. **Webhook** `/api/payos/tuition/<hookId>` (route hiện có):
   - Sau khi kiểm chữ ký như cũ, nếu `orderCode ≥ PLACE_ORDER_OFFSET` thì chuyển sang `handlePlacePayment`, còn lại giữ luồng HS.
   - Chỉ nhận khi `paymentLinkId` khớp link: chống giao dịch thử orderCode 123, bài học AG.
   - Trong 1 transaction:
     - tạo `PlacePayLinkPayment`, trùng `(linkId, reference)` thì bỏ qua: chống payOS gửi lại
     - tạo `PlacePayment{source:"payos", amount, receivedAt = ngày VN của giao dịch, note:"payOS <reference>"}`
     - link thành `paid` khi tổng ≥ amount
   - Trả 200 cho mọi trường hợp đã xử lý hoặc bỏ qua, giống luồng hiện có.
3. **Trang người trả:** có QR payOS + nút "Mở trang thanh toán" (`checkoutUrl`). Nhận rồi thì phiếu ghi "Đã nhận đủ".
4. **Chuông báo tiền** (`payosNotice.list`):
   - Gộp thêm các `PlacePayLinkPayment` mới.
   - Dòng hiện "<tên nơi> · Tháng M · +X đ". Bấm mở Thu nhập tháng M, sheet nơi đó.
   - Đếm chưa đọc theo cùng mốc `payosSeenAt`.
   - Vẫn chỉ đọc tối đa 20 dòng mới nhất (gộp 2 nguồn, sắp theo `createdAt`).
5. **Xoá tay** dòng PlacePayment nguồn payOS: cho xoá như Payment hiện có. Webhook gửi lại cùng reference thì không ghi lại (đã có dòng PlacePayLinkPayment).

## 4. Gói

`FEATURE_PLAN.payosPlace: pro`. Hết Pro: link `active` vẫn nhận tiền đã quét (không mất tiền), nhưng không tạo link mới.

## 5. Test chính

- **orderCode:**
  - ≥ offset → luồng nơi dạy
  - < offset → luồng HS không đổi (chạy lại test payOS HS hiện có)
- Chữ ký sai → bỏ qua.
- `paymentLinkId` lệch → bỏ qua.
- **Gửi lại cùng reference** 2 lần → chỉ 1 PlacePayment.
- **Nhận 2 đợt** (A, B, A) → tổng đúng, link `paid` khi đủ.
- **Đổi số tiền** → link cũ `cancelled`, link mới tạo.
- **Lỗi payOS** khi tạo → phiếu VietQR.
- **Chuông:** gộp 2 nguồn, chưa đọc đúng, chỉ 20 dòng.
- **Không Pro** → không tạo link.
- **e2e** (mock payOS như e2e AH/AI): mở phiếu nơi dạy có QR payOS → gửi webhook giả → Thu nhập "Đã nhận đủ" + chuông có thông báo.
