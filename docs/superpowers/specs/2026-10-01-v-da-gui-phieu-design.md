# V — Đánh dấu "đã gửi phiếu học phí"

> Ngày: 2026-10-01 · Người duyệt: chủ ứng dụng (chốt trong chat 30/9: phương án A) · Phiên bản: **0.9.1** (patch, có migration → backup Neon trước merge).
> Làm SAU T (0.9.0) vì dùng chung sheet/danh sách học phí và số tiền phải đóng.

## 1. Vấn đề
Cuối tháng GV gửi phiếu học phí cho từng phụ huynh, rồi phải tự nhớ/soát lại em nào đã gửi, tốn thời gian.

## 2. Chốt với người dùng
- **Tự động + bấm tay:** bấm **Chia sẻ** (thành công, không phải tự đóng bảng) / **Tải ảnh** / mở **Lưu ảnh** (S3) trên phiếu báo → tự đánh dấu "Đã gửi". Có nút bấm tay để đánh dấu / bỏ dấu (gửi kiểu khác: đọc qua điện thoại, nhắn tay).
- **Bộ lọc "Phiếu báo"** trên màn Học phí.
- **Nhãn cam "Đã gửi · số tiền đã đổi"** khi số phải đóng thay đổi sau lúc gửi (điểm danh thêm, sửa giá, thu thêm tiền…) → biết cần gửi lại.

## 3. Dữ liệu (migration `add_notice_sent`)
Bảng `monthly_tuition` thêm:
- `notice_sent_at timestamptz NULL` — lần đánh dấu gần nhất.
- `notice_sent_amount int NULL` — **số còn phải đóng** (`max(0, totalAmountDue - paidAmount)`, đúng số in trên phiếu) tại lúc đánh dấu.

Không mã hoá (không phải dữ liệu cá nhân).

## 4. Server
- Mutation `tuition.setNoticeSent({ studentId, year, month, sent: boolean })`:
  - `ensureMonthlyTuition` (đã có) → kiểm quyền sở hữu, có dòng tháng với carry-over đúng.
  - `sent = true`: `notice_sent_at = now()`, `notice_sent_amount` = số còn phải đóng **server tự tính** qua `getMonthlyTuitionStatus(..., persist=false, [studentId])` (không tin số từ client).
  - `sent = false`: cả hai về `NULL`.
  - Trả `{ noticeSentAt, noticeSentAmount }`.
- `TuitionStatusDTO` thêm `noticeSentAt: string | null`, `noticeSentAmount: number | null`, và trường suy ra `noticeStatus: "none" | "sent" | "changed"`:
  - `none`: chưa đánh dấu.
  - `sent`: đã đánh dấu và số còn phải đóng hiện tại **bằng** `notice_sent_amount`.
  - `changed`: đã đánh dấu nhưng số còn phải đóng hiện tại **khác** `notice_sent_amount`.
- Bộ lọc mới `noticeFilter?: "all" | "unsent" | "sent"` cho `getMonthlyStatus`:
  - `unsent` = `noticeStatus ∈ {none, changed}` **và** còn phải đóng > 0 (em đã đóng đủ thì không cần phiếu).
  - `sent` = `noticeStatus = sent`.
  - Lọc trong bộ nhớ như bộ lọc trạng thái hiện có (`matchesTuitionStatusFilter`), trước phân trang.

## 5. Giao diện
- **Phiếu báo** (`TuitionNoticeDialog`): sau Chia sẻ thành công / Tải ảnh / mở Lưu ảnh → gọi `setNoticeSent(sent: true)` → toast "Đã đánh dấu đã gửi phiếu" có nút **Hoàn tác** (gọi `sent: false`). Đã đánh dấu rồi mà gửi lại → cập nhật thời điểm + số tiền (hết nhãn cam). Lỗi mạng → toast lỗi nhẹ, không chặn việc chia sẻ.
- **Danh sách Học phí** (thẻ mobile + bảng desktop): cạnh trạng thái đóng tiền thêm nhãn nhỏ:
  - `sent` → xanh "Đã gửi 30/9" (ngày theo giờ VN).
  - `changed` → cam "Đã gửi · số tiền đã đổi".
  - `none` → không hiện.
- **Sheet học phí của 1 HS**: dòng "Phiếu báo: Đã gửi 30/9 lúc 20:15" + nút **"Đánh dấu đã gửi" / "Bỏ đánh dấu"** (≥ 44px mobile).
- **Bộ lọc** trong `FilterBar` (desktop hàng bộ lọc, mobile sheet "Lọc"): select "Phiếu báo" — Tất cả / Chưa gửi / Đã gửi. Tính vào số bộ lọc đang bật.
- Tiếng Anh đầy đủ.
- Gói: đánh dấu tay dùng được mọi gói; tự đánh dấu chỉ xảy ra khi dùng phiếu báo (theo quyền gói của phiếu báo hiện có).

## 6. Không làm
- Gửi phiếu tự động qua Zalo/SMS.
- Lịch sử nhiều lần gửi (chỉ giữ lần gần nhất).

## 7. Review focus
1. Chia sẻ bị người dùng tự đóng (AbortError) → **không** đánh dấu.
2. Sau khi gửi, điểm danh thêm buổi / thu thêm tiền → `changed`; gửi lại → `sent`.
3. Em đã đóng đủ không lọt vào "Chưa gửi".
4. Tháng chưa có dòng `monthly_tuition` → đánh dấu tạo dòng đúng carry-over (qua `ensureMonthlyTuition`), không tạo dòng trần.
5. Không đánh dấu được HS của giáo viên khác (NOT_FOUND).

## 8. Kiểm thử
- Integration: `setNoticeSent` true/false; `noticeStatus` none/sent/changed; lọc unsent/sent (có em đã đóng đủ); HS người khác → NOT_FOUND; tháng chưa có dòng.
- Component: TuitionNoticeDialog gọi mutation sau Tải ảnh / Chia sẻ thành công, không gọi khi AbortError; Hoàn tác gọi `sent: false`; nhãn trong danh sách.
- E2E: mở phiếu báo → Tải ảnh → danh sách hiện "Đã gửi"; lọc "Chưa gửi" không còn em đó; điểm danh thêm buổi → nhãn cam.
- Hồi quy full.
