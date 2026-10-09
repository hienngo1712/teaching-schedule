# AH — payOS học phí tự đánh dấu (GĐ2) — Design

Ngày: 2026-10-09 · Người duyệt thiết kế: chủ app (chat 2026-10-09) · Nền: AG (payOS mua gói, v0.16.0)

## 1. Mục tiêu

Giáo viên gói Pro nối tài khoản payOS **của chính họ**. Phiếu báo học phí (ảnh + link phụ huynh) hiện QR payOS đúng số đang nợ. Phụ huynh chuyển xong → app tự ghi khoản thu (chia FIFO như thu tay) → tháng đủ tiền thành "Đã đóng đủ", huy hiệu phiếu hiện "PH đã chuyển X đ lúc HH:mm ngày d/M". Giáo viên không phải rà sao kê đánh dấu tay.

Không gom tiền về tài khoản chủ app: tiền đi thẳng từ phụ huynh vào tài khoản ngân hàng giáo viên (payOS chỉ báo tin).

## 2. Ngoài phạm vi

- Không đổi luồng mua gói của AG (kênh "Lịch dạy" của chủ app).
- Không tự đánh dấu cho VietQR thường (không có tín hiệu tiền vào).
- Không xử lý hoàn tiền; tiền dư hiện như dư hiện nay, giáo viên tự lo.
- Không thống kê quota payOS trong app.

## 3. Dữ liệu (Prisma)

```prisma
// Khoá payOS của giáo viên (spec AH). clientId/apiKey/checksumKey mã hoá qua ENCRYPTED_FIELDS.
model TeacherPayos {
  userId      Int      @id @map("user_id")
  clientId    String   @map("client_id")
  apiKey      String   @map("api_key")
  checksumKey String   @map("checksum_key")
  // Đường webhook riêng /api/payos/tuition/<hookId>; không bí mật, chữ ký mới là thứ bảo vệ.
  hookId      String   @unique @map("hook_id") @db.VarChar(43)
  connectedAt DateTime @default(now()) @map("connected_at")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("teacher_payos")
}

// Mỗi QR payOS phát cho 1 HS. orderCode gửi payOS = id.
model TuitionPayLink {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  studentId   Int       @map("student_id")
  // Tháng neo để chia FIFO khi tiền vào: tháng đã học xong mới nhất ≤ tháng của phiếu.
  year        Int
  month       Int
  amount      Int
  status      String    @default("active") @db.VarChar(10) // active | cancelled | paid
  payosLinkId String    @map("payos_link_id") @db.VarChar(64)
  qrCode      String    @map("qr_code") @db.Text
  checkoutUrl String    @map("checkout_url") @db.Text
  bankBin     String?   @map("bank_bin") @db.VarChar(8)
  accountNumber String? @map("account_number")   // thêm vào ENCRYPTED_FIELDS
  accountName   String? @map("account_name")     // thêm vào ENCRYPTED_FIELDS
  createdAt   DateTime  @default(now()) @map("created_at")
  payments    TuitionPayLinkPayment[]
  student     Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@index([studentId, status])
  @@map("tuition_pay_links")
}

// Mỗi giao dịch payOS 1 dòng: chống ghi 2 lần khi payOS gửi lại (bài học review AG).
model TuitionPayLinkPayment {
  id        Int      @id @default(autoincrement())
  linkId    Int      @map("link_id")
  reference String   @unique @db.VarChar(64)
  amount    Int
  paidAt    DateTime @map("paid_at")
  batchId   String   @map("batch_id") @db.VarChar(36) // đợt Payment đã ghi
  createdAt DateTime @default(now()) @map("created_at")
  link      TuitionPayLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  @@map("tuition_pay_link_payments")
}
```

`MonthlyTuition` thêm `payosPaidAt DateTime?`, `payosPaidAmount Int?` (ghi ở **tháng neo**, cộng dồn số tiền, giờ = lần chuyển gần nhất) để huy hiệu/sheet đọc thẳng.

Lưu ý mã hoá: `ENCRYPTED_FIELDS` đi theo **tên khoá** → `accountNumber`/`accountName` trùng tên với User (đang mã hoá) là đúng quyết định; thêm `TeacherPayos: ["clientId","apiKey","checksumKey"]`, `TuitionPayLink: ["accountNumber","accountName"]`. Test DMMF hiện có phải xanh.

Migration tạo bằng `prisma migrate diff` như AG, chỉ `migrate deploy` lên DB test.

## 4. Cài payOS (giáo viên)

### 4.1 Server — `payos-teacher.service.ts`, router `payos` (mới)

- `status` (query, protected): `{ connected: boolean, connectedAt, featureUnlocked: boolean }`. **Không bao giờ trả khoá** ra client, kể cả che.
- `connect({ clientId, apiKey, checksumKey })` (mutation, protected, cần Pro):
  1. Không Pro (`hasFeature(effectivePlan, "payosTuition")` false) → FORBIDDEN.
  2. Trim; rỗng → BAD_REQUEST. `clientId === process.env.PAYOS_CLIENT_ID` → BAD_REQUEST "Đây là khoá kênh mua gói của app, hãy tạo kênh payOS riêng" (dán vào sẽ ghi đè webhook mua gói).
  3. Sinh `hookId` (32 byte base64url; nếu đã có bản ghi thì giữ hookId cũ).
  4. Gọi payOS `POST {base}/confirm-webhook` body `{ webhookUrl: "<origin>/api/payos/tuition/<hookId>" }` với header x-client-id/x-api-key của giáo viên. payOS sẽ POST thử vào URL đó và phải nhận 200 (§6 xử lý). Lỗi (khoá sai, mạng) → BAD_REQUEST "Không kết nối được payOS, kiểm tra lại 3 khoá" — **không lưu**.
  5. Upsert `TeacherPayos`. `origin` lấy từ tRPC ctx như AG.
- `disconnect` (mutation, protected, KHÔNG cần Pro — hết Pro vẫn ngắt được): huỷ mọi link `active` của giáo viên bằng khoá của họ (lỗi chỉ log), đánh dấu `cancelled`, xoá `TeacherPayos`.
- `payos.ts`: hàm hiện có nhận `PayosConfig` nên dùng lại; thêm `confirmWebhook(cfg, url)`; `createPaymentLink` trả thêm `bin`, `accountNumber`, `accountName` (có trong data payOS, thiếu thì null). Hàm dựng cfg từ bản ghi giáo viên: `teacherPayosConfig(row)` (baseUrl theo `PAYOS_API_BASE` như AG để e2e trỏ mock).
- `plans.ts`: thêm feature `payosTuition: "pro"` (+ nhãn trong `feature-labels.ts`).
- Middleware matcher: đổi `api/payos/webhook` thành `api/payos/` (bỏ qua cả webhook học phí).
- Backup Excel/xuất dữ liệu: không xuất khoá payOS. Xoá tài khoản: cascade.

### 4.2 UI — `PayosTuitionCard` trong `/settings` (dưới `BankAccountCard`)

Mobile-first 375px. Nội dung:

- Tiêu đề "Tự đánh dấu học phí bằng payOS" + nhãn Pro.
- Khối lợi ích nổi bật (nền nhấn): "Phụ huynh quét QR trên phiếu, tiền vào là app tự ghi khoản thu và đánh dấu đã đóng — không phải rà sao kê rồi đánh dấu tay."
- Ghi chú chi phí, **đúng nguyên văn**: "Dùng payOS: 100 giao dịch miễn phí trọn đời + 500 miễn phí trong 6 tháng; muốn nhiều hơn (1.000 giao dịch/năm) phải mua gói Pro của payOS ~2.000đ/giao dịch ≈ 2 triệu/năm. Không cần tự đánh dấu thì cứ dùng VietQR miễn phí trọn đời như bình thường."
- Lời nhắn: "Muốn cài payOS, làm theo **hướng dẫn** (link `/guide#payos-hoc-phi`) hoặc liên hệ trực tiếp admin:" + `ContactOwner`.
- Không Pro: thân thẻ (lợi ích, chi phí, hướng dẫn, liên hệ) vẫn hiện; form bị thay bằng `LockedSection`/nút "Mở khoá gói Pro" (dùng lại thành phần khoá có sẵn, dẫn `/plan?buy=1`).
- Pro, chưa nối: 3 ô (Client ID, API Key, Checksum Key; `type=password` + nút hiện), nút "Kết nối". Đang gửi: nút disabled + spinner. Lỗi: hiện message server dưới form.
- Đã nối: "Đã kết nối payOS từ <d/M/yyyy>", nút "Ngắt kết nối" (hỏi xác nhận bằng dialog của app, không `confirm()` trình duyệt). Hết Pro mà còn nối: hiện "Tạm dừng — gói Pro đã hết, phiếu dùng VietQR" + vẫn có nút Ngắt.
- Cần tài khoản ngân hàng VietQR? Không bắt buộc với payOS (payOS dùng TK liên kết của họ).

## 5. QR payOS trên phiếu

Trong `getTuitionNotice` (dùng cho cả sheet giáo viên, ảnh phiếu, trang `/p/<token>`):

- Điều kiện dùng payOS: giáo viên có `TeacherPayos` **và** đang có feature `payosTuition` **và** `remaining > 0`. Ngược lại giữ VietQR như cũ.
- `ensureTuitionPayLink(db, userId, studentId, anchor, remaining)`:
  - Có link `active` cùng HS và **cùng amount** → dùng lại (không gọi payOS). Lý do: payOS có thể tính quota theo đơn tạo; mở phiếu nhiều lần không được tốn đơn.
  - Có link `active` khác amount → huỷ trên payOS (lỗi chỉ log) + `cancelled`, rồi tạo mới.
  - Tạo: insert dòng trước lấy `id` làm `orderCode`, gọi `createPaymentLink` (description `HP ${id}` — ≤ 9 ký tự cho ngân hàng chưa liên kết, returnUrl/cancelUrl = origin + `/p/<token>` nếu có token, không thì origin), lưu linkId/qr/checkoutUrl/bank. Lỗi payOS → xoá dòng nháp, **rơi về VietQR** (không ném lỗi).
  - Chạy dưới advisory lock theo `studentId` để 2 lần mở phiếu cùng lúc không tạo 2 link.
  - Tháng neo: tháng của phiếu nếu đã học xong, không thì tháng trước đó (khớp quy tắc `recordPayment` cấm ghi tháng đang học).
- `getTuitionNotice` vốn "chỉ đọc"; ngoại lệ này được phép vì chỉ ghi bảng link. Origin: thêm tham số tuỳ chọn `origin` truyền từ router (tRPC ctx) và từ trang `/p/[token]` (headers). Không có origin → không tạo payOS (VietQR).
- `TuitionNoticeDTO.qr` thêm `provider: "vietqr" | "payos"` và `checkoutUrl: string | null`. Với payOS: `payload = qrCode`, `bankShortName` từ `findBank(bin)` (không thấy → "payOS"), `accountNumber/accountName` từ payOS, `content = "HP <id>"`, `amount = remaining`.
- UI: phiếu/ảnh phiếu vẽ QR như cũ từ `payload`; thêm dòng nhỏ "Quét để trả — tự xác nhận khi tiền vào" khi provider payos. Trang phụ huynh: thêm nút "Mở trang thanh toán" (checkoutUrl, tab mới) khi payos.

## 6. Webhook học phí — `src/app/api/payos/tuition/[hookId]/route.ts`

Node runtime, cùng khuôn route AG (JSON hỏng → 400; status từ service; ném lỗi → 500). Service `handleTuitionWebhook(db, hookId, body)`:

1. Tìm `TeacherPayos` theo hookId; không có → 404 (payOS thôi gửi; giáo viên đã ngắt).
2. Verify chữ ký bằng `checksumKey` của giáo viên → sai 401.
3. `data.code !== "00"` hoặc không có link khớp `orderCode` thuộc đúng giáo viên **và** `paymentLinkId` khớp → 200 bỏ qua (gồm giao dịch thử orderCode 123 lúc confirm-webhook).
4. Trong 1 transaction (giữ khoá HS như `recordPayment`):
   - `reference` đã có trong `TuitionPayLinkPayment` → 200 "gửi lặp".
   - Ghi khoản thu bằng lõi FIFO hiện có (`ensureLedgerMonths` + `writeAllocation`, tách hàm dùng chung nếu cần, **không** đổi hành vi `recordPayment`): `method: "payos"`, `paidAt` = ngày VN của `transactionDateTime` (hỏng → hôm nay), note `payOS · <reference>`, neo tháng của link. Ghi **kể cả** khi link đã `cancelled`, giáo viên đã hết Pro, hay HS đã đủ tiền (tiền thật đã vào TK → thành dư như hiện nay).
   - Insert `TuitionPayLinkPayment` (batchId), link → `paid` nếu đang `active`.
   - `MonthlyTuition` tháng neo: `payosPaidAmount += amount`, `payosPaidAt = paidAt có giờ`.
   - HS đã bị xoá (mềm) → 200 bỏ qua, log cảnh báo (minor, giống AG).
5. `Payment.method` varchar(10): thêm "payos". `PAYMENT_METHODS` (schema nhập tay) **giữ nguyên** `cash|transfer` — giáo viên không tự chọn payos. Nơi hiển thị phương thức (danh sách đợt thu, thùng rác, báo cáo, xuất Excel) hiển thị "payOS". Giáo viên vẫn sửa/xoá đợt payOS như đợt thường; xoá đợt không xoá `TuitionPayLinkPayment` (payOS gửi lại cũng không ghi lại — đúng ý: giáo viên đã chủ động xoá).

## 7. Hiển thị "PH đã chuyển"

- `getMonthlyTuitionStatus` item thêm `payosPaidAt`, `payosPaidAmount` (đọc snapshot tháng).
- `TuitionNoticeBadge`: có `payosPaidAt` → dòng xanh "PH đã chuyển {amount} lúc {HH:mm} ngày {d/M}" (giờ VN), đặt cùng/thay chỗ cảnh báo "đã gửi phiếu N ngày" (đã trả thì không nhắc nhở nữa nếu hết nợ).
- `TuitionDetailSheet`: cùng dòng đó ở đầu phần khoản thu; đợt thu payOS có nhãn "payOS".
- i18n vi/en đủ khoá mới.

## 8. Hướng dẫn (`/guide`, mục id `payos-hoc-phi`, sau "Tài khoản nhận học phí")

Bước (chữ ngắn, giọng hiện có):
1. Mục này chỉ cho gói Pro; giải thích lợi ích + ghi chú chi phí nguyên văn §4.2.
2. Đăng ký tại payos.vn, xác thực danh tính theo hướng dẫn của payOS (chỉ chữ).
3. Liên kết tài khoản ngân hàng nhận học phí (chỉ chữ; nên chọn ngân hàng payOS hỗ trợ liên kết).
4. Tạo **kênh thanh toán riêng** cho học phí — ảnh `payos-tao-kenh`.
5. Kênh vừa tạo trong danh sách — ảnh `payos-ds-kenh`.
6. Mở kênh → tab **Thông tin tích hợp** → chép Client ID, API Key, Checksum Key — ảnh `payos-khoa` (khoá đã che). Dặn: **không bấm nút ↻ cạnh Checksum Key** (đổi khoá → app mất kết nối); **không cần tự điền webhook**, app tự cài.
7. Trong app: Cài đặt → thẻ payOS → dán 3 khoá → Kết nối — ảnh app `cai-payos` (chụp tự động).
8. Gửi phiếu như thường; phụ huynh quét QR — ảnh app `phieu-payos`.
9. Tiền vào: huy hiệu "PH đã chuyển…" — ảnh app `da-chuyen-payos`.
Mẹo: "Cần hỗ trợ? Gọi/Zalo/Facebook" (ContactOwner sẵn ở "Cần hỗ trợ?").

Ảnh:
- 3 ảnh payOS (`payos-tao-kenh`, `payos-ds-kenh`, `payos-khoa`) do **chủ app chụp trên điện thoại** gửi vào chat; Claude che khoá/số TK rồi lưu `public/guide/<shot>-mobile.jpg` và chép y nguyên sang `-desktop.jpg` (trang payOS không chụp desktop). Không chụp tự động.
- 3 ảnh app chụp bằng `guide-shots.spec.ts` (mock payOS, cần dữ liệu link payOS + payosPaidAt giả trong seed của spec).
- Đếm `GUIDE_SHOTS`/test guide-content cập nhật; dựng lại docx như AG.

## 9. Trường hợp biên (đã chốt)

| Tình huống | Hành vi |
|---|---|
| Mở phiếu nhiều lần, số nợ không đổi | Dùng lại 1 link, không gọi payOS |
| Giáo viên ghi tiền mặt rồi mở lại phiếu | Số nợ đổi → huỷ link cũ, tạo link mới |
| PH quét QR cũ (link đã huỷ nhưng ngân hàng vẫn chuyển) / trả sau khi GV đã thu tay | Vẫn ghi, thành tiền dư như hiện nay |
| payOS gửi lại cùng giao dịch | Không ghi lần 2 (reference unique) |
| Giao dịch thử khi confirm-webhook | 200, không ghi gì |
| Hết Pro | Phiếu về VietQR; tiền vào link cũ vẫn ghi |
| Ngắt kết nối | Huỷ link active; webhook trả 404 |
| Dán khoá kênh mua gói của app | Từ chối |
| payOS lỗi khi tạo link | Phiếu dùng VietQR, không báo lỗi |
| Không có tài khoản VietQR, payOS cũng lỗi | `qr = null` như hiện nay (phiếu không QR) |

## 10. Kiểm thử

- Unit: chữ ký/confirmWebhook (mock fetch), plans feature, badge hiển thị giờ VN, card (khoá/không khoá/đã nối/hết Pro).
- Integration (DB test): connect (sai khoá không lưu, khoá app bị chặn, không Pro FORBIDDEN), disconnect huỷ link; ensureTuitionPayLink (dùng lại/huỷ-tạo/lỗi về VietQR/song song 1 link); webhook (đủ → đã đóng đủ, FIFO nhiều tháng, gửi lặp, hookId lạ 404, chữ ký sai 401, giao dịch thử 200, link cancelled vẫn ghi, hết Pro vẫn ghi, ngày hỏng).
- E2e 375 + 1280 (mock payOS cổng 4010 mở rộng `confirm-webhook`): GV Pro kết nối → mở phiếu thấy QR payOS → giả webhook → huy hiệu "PH đã chuyển" + tháng Đã đóng đủ; GV Plus thấy thẻ khoá. Chụp ảnh 375 xem bằng mắt.
- Version: minor → 0.17.0.
