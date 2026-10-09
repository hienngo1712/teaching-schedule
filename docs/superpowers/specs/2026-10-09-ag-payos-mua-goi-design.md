# AG — payOS: mua gói tự kích hoạt + khối "Liên hệ chủ app"

Ngày: 2026-10-09 · Bản phát hành: 0.16.0 · Giai đoạn 1/2 của payOS (GĐ2 = học phí tự đánh dấu, chỉ gói Pro, spec riêng).

## 1. Mục tiêu

- Người mua gói **tự chọn** cách thanh toán:
  - **Kích hoạt ngay (payOS)** — quét QR, tiền vào là gói bật, không chờ admin.
  - **Chuyển khoản, admin duyệt (VietQR)** — như hiện nay.
- Mọi chỗ cần "báo admin" có khối **Liên hệ chủ app** (Gọi / Zalo / Facebook); admin tự sửa SĐT và link Facebook, không phải sửa code.

Ngoài phạm vi: học phí qua payOS (GĐ2), hoàn tiền, đối soát tự động giao dịch không qua link payOS.

## 2. Cấu hình

- Env (Vercel, chủ app tự dán, không bao giờ in ra log): `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
- `payosReady` = đủ 3 biến **và** `getPlanBankAccount()` có (VietQR vẫn là đường dự phòng).
- Chưa đủ env → không hiện lựa chọn payOS; luồng y như 0.15.x.
- `.env.test` có bộ khoá giả để test ký/kiểm chữ ký; test không gọi API payOS thật (mock `fetch`).

## 3. Dữ liệu

`PlanOrder` thêm cột (nullable, migration thêm cột, không đụng dữ liệu cũ):

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `method` | `VarChar(8)` default `'vietqr'` | `'payos'` \| `'vietqr'` |
| `payosLinkId` | `VarChar(64)?` | `paymentLinkId` payOS trả về |
| `payosQr` | `Text?` | chuỗi EMV QR payOS trả về (vẽ bằng thư viện `qrcode` sẵn có) |
| `payosCheckoutUrl` | `Text?` | link trang thanh toán payOS (nút "Mở trang thanh toán") |
| `paidAmount` | `Int?` | số tiền webhook báo đã nhận |
| `paidAt` | `DateTime?` | `transactionDateTime` của webhook |
| `payosRef` | `VarChar(64)?` `@unique` | `reference` giao dịch — chặn xử lý trùng |

Bảng mới `ContactChange` (mẫu `PlanPriceChange`: dòng mới nhất là hiện hành, không FK):
`id, phone VarChar(15), facebookUrl Text?, changedBy VarChar(50), createdAt`.

## 4. Luồng mua gói

### 4.1 Chọn cách thanh toán (PlanPurchaseDialog, bước chọn gói)

Khi `payosReady`, dưới phần chọn gói/kỳ có nhóm radio (mobile: 2 thẻ xếp dọc, mỗi thẻ cao ≥ 44px):

- **Kích hoạt ngay sau khi chuyển khoản** *(chọn sẵn)* — "Quét QR payOS, gói bật trong vài giây."
- **Chuyển khoản, chờ admin duyệt** — "Chuyển khoản VietQR như thường, báo admin để được duyệt."

Không `payosReady` → không hiện nhóm này, `method = 'vietqr'`.

### 4.2 Tạo đơn (`plan.createOrder` nhận thêm `method`)

- Tạo `PlanOrder` như cũ (mã `code` 6 ký tự, chặn giá đổi, v.v.).
- `method = 'payos'`: gọi `POST https://api-merchant.payos.vn/v2/payment-requests`:
  - `orderCode` = `order.id`; `amount` = `order.amount`; `description` = `SM ${code}` (đúng 9 ký tự — giới hạn của ngân hàng chưa liên kết);
  - `returnUrl` = `cancelUrl` = `${origin}/plan`, `origin` lấy từ request trong tRPC context (`opts.req.url`; dự án không có env APP_URL); `expiredAt` = `createdAt + ORDER_TTL_DAYS` (Unix giây);
  - `signature` = HMAC-SHA256(hex, Checksum Key) của `amount=…&cancelUrl=…&description=…&orderCode=…&returnUrl=…`.
  - Thành công → lưu `payosLinkId`, `payosQr`, `payosCheckoutUrl`.
  - Lỗi/timeout (5s) → **đổi đơn sang `method='vietqr'`**, trả cờ `payosFailed` → UI toast "Chưa tạo được QR tự kích hoạt, dùng chuyển khoản thường" và hiện thẻ VietQR.
- Gọi payOS **ngoài** transaction tạo đơn (không giữ transaction khi chờ mạng).

### 4.3 Thẻ đơn đang chờ (PendingOrderCard)

- `payos`: QR từ `payosQr` + số tiền + nội dung `SM ABC123` + nút "Mở trang thanh toán" (`payosCheckoutUrl`, tab mới). Dòng nhắc: "Quét QR để thanh toán — gói bật ngay khi tiền vào." Trang tự refetch `plan.me` mỗi 5s khi đang có đơn payOS chờ (dừng khi đơn hết chờ hoặc rời trang) → gói bật là thẻ đổi sang "Đã kích hoạt".
- `vietqr`: như hiện nay + dòng "Chuyển khoản xong, báo admin để được duyệt:" + khối Liên hệ chủ app.
- Cả hai: nút Huỷ đơn như cũ. Muốn đổi cách thanh toán → huỷ rồi đặt lại (không thêm nút đổi).
- Huỷ đơn payOS (người dùng huỷ, hoặc đơn bị chốt `expired`/`rejected`) → gọi `POST /v2/payment-requests/{payosLinkId}/cancel` để QR cũ không thanh toán được nữa. Gọi sau khi DB đã đổi trạng thái; lỗi chỉ log, không chặn huỷ (link vẫn tự hết hạn theo `expiredAt`).

## 5. Webhook `POST /api/payos/webhook`

Route handler Next.js (Node runtime), không cần đăng nhập.

1. Parse JSON; thiếu `data`/`signature` → 400.
2. Kiểm chữ ký: sắp xếp khoá của `data` theo alphabet, nối `key=value` bằng `&` (giá trị `null`/`undefined` → chuỗi rỗng, giữ nguyên số/chuỗi khác), HMAC-SHA256 hex bằng Checksum Key, so `timingSafeEqual`. Sai → 401, không đụng DB.
3. `orderCode` không khớp đơn nào (gồm cả giao dịch thử khi payOS xác nhận URL webhook) → 200 `{ ok: true }`.
4. `payosRef` đã có → 200 (gửi lặp, không làm gì).
5. Trong 1 transaction, khoá dòng đơn (`SELECT … FOR UPDATE`), ghi `paidAmount`, `paidAt`, `payosRef`, rồi:

| Trạng thái đơn | `amount` đủ (≥ đơn) | thiếu |
|---|---|---|
| `pending` | **kích hoạt** (dư vẫn kích hoạt, admin thấy số đã nhận) | giữ `pending`, ghi số đã nhận → **cần admin xử lý** |
| `expired` / `cancelled` / `rejected` | **không bật**, ghi số đã nhận → **cần admin xử lý** | như bên trái |
| `approved` | không làm gì thêm (trả 2 lần → admin thấy số đã nhận trong lịch sử) | – |

Lý do không tự bật đơn đã hết hạn/huỷ/từ chối: người dùng có thể đã trả đơn mới (trả 2 lần → cần hoàn), đổi ý sang gói/kỳ khác, hoặc giá đã đổi. Ca này hiếm vì link bị huỷ/hết hạn cùng đơn, nên để admin quyết.

- "Kích hoạt" = tái dùng lõi của `approveOrder` (tách hàm nhận `tx` + `decidedBy`), `decidedBy = 'payos'`. Không nhân đôi logic tính ngày / quy đổi Plus→Pro.
6. Lỗi DB → 500 (payOS gửi lại sau); log ngắn `[payos] đơn <id>: <kết quả>` không kèm khoá hay thông tin tài khoản.

## 6. Admin

- Danh sách đơn chờ / lịch sử: nhãn "payOS" hoặc "VietQR"; người duyệt `payos` hiện "Tự kích hoạt (payOS)".
- **Đơn cần admin xử lý** = `paidAmount` có và đơn chưa `approved` (đang chờ mà thiếu tiền, hoặc hết hạn/huỷ/từ chối mà vẫn nhận tiền):
  - hiện **trên cùng** trang đơn chờ (kể cả đơn không còn `pending`), viền/nhãn đỏ, câu dạng: "Đã chuyển 99.000 đ lúc 20:15 09/10 nhưng đơn đã hết hạn. Duyệt?" / "…nhưng còn thiếu 20.000 đ. Duyệt?";
  - 2 nút: **Duyệt** (bật gói như duyệt tay, cho cả đơn `expired`/`cancelled`/`rejected`) và **Từ chối** (đơn thành `rejected`, ghi chú "đã nhận tiền — chủ app tự hoàn"); xử lý xong thì rời nhóm này;
  - được tính vào số đếm "cần xử lý" của admin (badge đơn chờ).
- Nút duyệt tay / từ chối giữ nguyên cho đơn VietQR (app không biết tiền vào, admin tự kiểm sao kê).
- Trang `/admin/prices` thêm thẻ **Liên hệ hỗ trợ**: ô SĐT (chỉ số, 9–11 chữ số, bắt đầu bằng 0) + ô link Facebook (phải là `https://` và host `facebook.com`/`www.facebook.com`/`m.facebook.com`/`fb.com`, cho để trống) + nút Lưu; dưới là 5 lần sửa gần nhất.

## 7. Khối "Liên hệ chủ app" (`ContactOwner`)

- Đọc qua tRPC public `contact.get` → `{ phone, facebookUrl } | null`. Chưa cài → ẩn khối (trang Quyền riêng tư dùng chữ dự phòng `PRIVACY_CONTACT` như cũ).
- Nút: **Gọi** (`tel:`), **Zalo** (`https://zalo.me/<phone>`, tab mới), **Facebook** (tab mới; ẩn nếu trống). Mỗi nút ≥ 44px trên mobile, hiện kèm số điện thoại dạng chữ (theo quy tắc không tin `tel:` 100%).
- Đặt ở: thẻ đơn VietQR đang chờ; trang Quyền riêng tư (mục xoá dữ liệu/tài khoản); cuối `/guide` mục "Cần hỗ trợ?". (GĐ2 dùng lại ở thẻ cài payOS.)

## 8. Bản phát hành 0.16.0

`RELEASES` mục mới, `notify: true`: "Mua gói kích hoạt ngay" (chọn payOS khi mua gói, gói bật ngay khi tiền vào) + "Liên hệ chủ app" (gọi/Zalo/Facebook ngay trong app). Guide: cập nhật mục mua gói (2 cách thanh toán) + chụp lại ảnh liên quan.

## 9. Kiểm thử

- Unit: ký link (khớp ví dụ trong tài liệu payOS), kiểm chữ ký webhook (đúng / sai / khoá thiếu / giá trị null), validate SĐT & Facebook.
- Service/integration (DB test): createOrder payos thành công / payOS lỗi → vietqr; webhook: pending đủ tiền → gói bật + `decidedBy='payos'`; dư tiền → bật; gửi lặp → không cộng ngày 2 lần; thiếu tiền → chờ + vào nhóm cần xử lý; expired/cancelled/rejected đủ tiền → không bật + vào nhóm cần xử lý; admin duyệt đơn expired có tiền → gói bật; orderCode lạ → 200; chữ ký sai → 401; huỷ đơn payOS → gọi API huỷ link (mock), lỗi API không chặn huỷ.
- e2e admin: đơn hết hạn có tiền nằm trên cùng, bấm Duyệt → gói bật.
- e2e (375px + 1280px): mua gói chọn payOS → thẻ QR payOS; test tự POST webhook có chữ ký (khoá giả) → thẻ đổi "Đã kích hoạt", badge gói đổi; chọn VietQR → thẻ có khối Liên hệ; admin sửa liên hệ → hiện ở /guide. **Chụp ảnh 375px và tự xem** thẻ chọn cách thanh toán, thẻ QR payOS, khối Liên hệ.

## 10. Việc chủ app làm sau khi merge

1. Vercel → Environment Variables: dán 3 khoá payOS (Production), redeploy.
2. my.payos.vn → Kênh thanh toán → điền Webhook URL `https://<domain>/api/payos/webhook` → payOS tự gửi giao dịch thử để xác nhận.
3. `/admin/prices` → nhập SĐT 0979479550 và link Facebook.
4. Mua thử 1 gói bằng tài khoản QA (id 4) chọn payOS → kiểm gói bật ngay. Chỉ nhận gói PIONEER-500 của payOS khi bắt đầu dùng thật.
