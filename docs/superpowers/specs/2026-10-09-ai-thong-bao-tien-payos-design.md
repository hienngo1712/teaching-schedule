# AI — Thông báo "phụ huynh đã chuyển" (payOS) — Design

Ngày: 2026-10-09 · Duyệt hướng: chủ app (chat 2026-10-09, chọn "mức 1") · Nền: AH (0.17.0)

## 1. Vấn đề

Sau AH, tiền payOS vào là app tự ghi, nhưng giáo viên không được báo. Phải tự mở (hoặc F5) trang Học phí mới thấy "Đã đóng đủ / PH đã chuyển". Giáo viên cần biết **khoản tiền vừa vào là của học sinh nào**, ngay khi đang dùng app.

## 2. Phạm vi

Có:
- Chuông 🔔 ở thanh trên cùng (giáo viên), chấm/số chưa đọc, bấm mở danh sách "PH của {tên HS} đã chuyển {số tiền} lúc {HH:mm} ngày {d/M}"; bấm 1 dòng → mở thẳng học sinh đó ở trang Học phí (deep link có sẵn `/tuition?year=&month=&studentId=`).
- App đang mở tự hỏi server ~30 giây/lần (chỉ khi tab đang hiện) + khi quay lại tab → có khoản mới thì **toast** ngay và tự làm mới dữ liệu học phí (không cần F5).
- Mở app lần đầu trong phiên mà có khoản chưa xem → 1 toast tóm tắt "Có N khoản tiền mới qua payOS".

Không có (để sau): thông báo đẩy về điện thoại khi không mở app; mục "Tiền vừa nhận" ở Tổng quan; thông báo cho tiền mặt/chuyển khoản tay; xoá từng thông báo.

## 3. Dữ liệu

- Nguồn thông báo = bảng có sẵn `TuitionPayLinkPayment` (mỗi giao dịch payOS 1 dòng), lọc theo `link.userId`, **chỉ đợt thu còn sống** (Payment cùng `batchId`, `isDeleted=false`) — cùng quy tắc với "PH đã chuyển" (AH). Không thêm bảng.
- `User` thêm cột `payosSeenAt DateTime? @map("payos_seen_at")`: mốc giáo viên mở chuông gần nhất. Chưa đọc = `createdAt > payosSeenAt` (null → mọi dòng là chưa đọc).
- Migration chỉ thêm 1 cột nullable.

## 4. Server — router `payosNotice`

- `list` (query, protected): `{ enabled: boolean, unread: number, items: Item[] }`
  - `enabled` = giáo viên đang có `TeacherPayos` **hoặc** có ít nhất 1 thông báo (đã ngắt vẫn xem được lịch sử). `enabled=false` → `unread 0, items []`, client ẩn chuông và không hỏi lại.
  - `items`: 20 dòng mới nhất (`createdAt desc`), mỗi dòng `{ id, studentId, studentName, amount, paidAt, year, month, createdAt, unread }`. `year/month` = tháng neo của link (đúng tháng app đã ghi tiền → deep link mở đúng sheet). HS đã xoá mềm vẫn hiện tên, nhưng client không tạo link (HS không còn trong danh sách học phí).
  - `unread`: đếm toàn bộ (không giới hạn 20) dòng chưa đọc còn sống.
  - Tên HS mã hoá: đọc qua Prisma (giải mã tự động), không lọc/sắp DB theo tên.
- `markSeen({ upTo: string /* ISO createdAt mới nhất client đã thấy */ })` (mutation): `payosSeenAt = max(payosSeenAt, upTo)`, không lùi; `upTo` ở tương lai (> now + 1 phút) → dùng now. Lý do dùng `upTo` thay vì `now()`: khoản vào đúng lúc đang mở chuông không bị đánh dấu đã đọc oan.
- Không chặn theo gói: hết Pro vẫn xem được lịch sử thông báo (tiền vào link cũ vẫn ghi theo AH).

## 5. Client — `PayosBell` (trong `AppHeader`, chỉ giáo viên, đặt trước `WhatsNew`)

- Query `payosNotice.list`: `refetchInterval: data?.enabled === false ? false : 30_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true` (ghi đè mặc định false của TRPCProvider chỉ cho query này).
- `enabled=false` → render null.
- Nút: `Button variant="outline" size="icon"` `size-11 md:size-10`, icon `Bell`, `aria-label` "Thông báo tiền học"; chưa đọc > 0 → huy hiệu số (`min-w-5 h-5 rounded-full bg-red-600 text-white text-[11px]`, >9 hiện "9+") góc trên phải.
- Mở: desktop `Popover` (rộng `w-80`), mobile `Sheet` từ dưới (giống `WhatsNew`). Tiêu đề "Tiền học qua payOS". Danh sách: mỗi dòng 1 nút/link cao ≥ 44px: dòng 1 "PH của **{tên}** đã chuyển **{số tiền}**", dòng 2 nhỏ "{HH:mm} ngày {d/M} · Học phí tháng {M}"; chưa đọc có chấm teal bên trái + nền `bg-primary/5`. Rỗng: "Chưa có khoản nào. Khi phụ huynh quét QR payOS trên phiếu, tiền vào sẽ hiện ở đây." Cuối danh sách (khi đủ 20): "Chỉ hiện 20 khoản gần nhất".
- Mở chuông → `markSeen({ upTo: items[0].createdAt })` (nếu có items và unread > 0), cập nhật cache để huy hiệu tắt ngay; chấm "chưa đọc" trong danh sách giữ nguyên tới khi đóng (để giáo viên còn thấy dòng nào mới).
- Bấm dòng → `router.push("/tuition?year={y}&month={m}&studentId={id}")`, đóng chuông.
- **Toast khi có khoản mới** (so với lần tải trước trong phiên, theo `createdAt` lớn nhất đã biết):
  - Lần tải đầu của phiên: không toast từng dòng; nếu `unread > 0` → 1 toast "Có {N} khoản tiền mới qua payOS" + nút "Xem" (mở chuông).
  - Các lần sau: mỗi dòng mới (tối đa 3; nhiều hơn → 1 toast "Có {N} khoản tiền mới qua payOS") → `toast.success("PH của {tên} đã chuyển {số tiền}")` + nút "Xem" (deep link như bấm dòng).
  - Có dòng mới → `utils.tuition.invalidate()`, `utils.payment.invalidate()`, `utils.report.invalidate()` (Tổng quan đọc từ các router này) để trang đang mở tự cập nhật.
  - Đang chạy tour (`useTourActive()`) → hoãn toast tới khi tour tắt (không mất).
- Không âm thanh, không thông báo trình duyệt (Notification API) ở mức này.

## 6. Hướng dẫn + phát hành

- Guide mục `payos-hoc-phi`: bước "Tiền vào…" thêm câu "Chuông 🔔 trên cùng báo ngay khoản vừa vào và của học sinh nào; bấm để mở học sinh đó." Ảnh `da-chuyen-payos` giữ nguyên (không bắt buộc chụp lại); thêm ảnh mới `chuong-payos` (chuông mở có 1 dòng) chụp bằng guide-shots.
- `releases.ts` mục 0.18.0: "Chuông báo khi phụ huynh chuyển tiền qua payOS, không cần tải lại trang."
- Version 0.18.0.

## 7. Trường hợp biên

| Tình huống | Hành vi |
|---|---|
| Giáo viên chưa nối payOS, chưa từng có thông báo | Không có chuông, không hỏi server định kỳ |
| Đã ngắt payOS nhưng có lịch sử | Chuông vẫn hiện, xem được; vẫn hỏi định kỳ (tiền vào link cũ trước khi ngắt có thể tới trễ) |
| Xoá đợt thu payOS | Dòng biến mất khỏi danh sách và khỏi số chưa đọc |
| Khoản vào đúng lúc đang mở chuông | Không bị đánh dấu đã đọc (markSeen theo `upTo`) |
| 2 tab cùng mở | Mỗi tab toast riêng (chấp nhận); đánh dấu đọc ở tab này, tab kia cập nhật ở lần hỏi sau |
| Tab ẩn | Không hỏi; quay lại tab → hỏi ngay → toast nếu có mới |
| HS đã xoá mềm | Dòng vẫn hiện tên, không bấm mở được (hiện dạng chữ, không link) |
| Admin | Không có chuông |

## 8. Kiểm thử

- Integration: list (enabled theo TeacherPayos/lịch sử; chỉ đợt còn sống; 20 dòng; unread đếm hết; chỉ của mình — GV khác không thấy), markSeen (không lùi, upTo tương lai → now, khoản mới hơn upTo vẫn chưa đọc).
- Unit `PayosBell`: ẩn khi enabled false; huy hiệu số/9+; mở → markSeen với createdAt mới nhất; bấm dòng → push đúng URL; toast lần đầu tóm tắt; lần sau toast từng dòng + invalidate; >3 dòng → 1 toast tóm tắt; đang tour → hoãn.
- E2e 375 + 1280: GV Pro đã nối, đang mở `/dashboard`; giả webhook → trong ≤ 40s thấy toast "PH của … đã chuyển …" không F5; chuông có số 1; mở chuông → số tắt; bấm dòng → `/tuition` mở sheet đúng HS. Chụp + xem ảnh 375 (header không tràn với thêm 1 nút).
