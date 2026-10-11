# AQ — Admin xoá vĩnh viễn tài khoản đã xoá (0.25.0)

## 1. Bối cảnh

`/admin/accounts` có tab **Đã xoá**: tài khoản bị admin xoá mềm (`users.is_deleted`, `deleted_at`, `deleted_by`), chỉ có nút **Khôi phục**. Dữ liệu của tài khoản (học sinh, ca, học phí, nơi dạy, khoá payOS...) vẫn nằm trong DB mãi.

Người dùng muốn có nút **Xoá vĩnh viễn** như Thùng rác, để DB nhẹ hơn và không giữ dữ liệu cá nhân không cần thiết.

## 2. Quyết định đã chốt (người dùng, 2026-10-11)

1. **Giữ đơn mua gói, ẩn danh:** `plan_orders` + `plan_order_payments` của tài khoản giữ lại để báo cáo Doanh thu admin không hụt. Toàn bộ dữ liệu dạy học và dữ liệu cá nhân của giáo viên bị xoá.
2. **Chờ 30 ngày:** chỉ tài khoản nằm trong Đã xoá ≥ 30 ngày (`deleted_at` ≤ now − 30 ngày) mới có nút. Trước đó nút ẩn, có dòng "Xoá vĩnh viễn được từ <ngày>".
3. **Xác nhận:** hộp xác nhận phải gõ đúng tên đăng nhập mới bật nút đỏ **Xoá vĩnh viễn**.
4. Đợt riêng sau AP.

## 3. Cách làm: giữ "bia mộ" user

Bảng `plan_orders.user_id` tham chiếu `users` không cascade. Để giữ đơn mà không đổi khoá ngoại, giữ lại **1 dòng `users` đã ẩn danh**:

- `username` → `deleted_<id>`, nhả tên cho người khác đăng ký.
- `full_name` → `TK đã xoá #<id>`.
- `password_hash` → chuỗi ngẫu nhiên không đăng nhập được.
- Mọi trường cá nhân khác (email/sđt/ngân hàng/... nếu có trong `users`) → null.
- `session_version` tăng.
- Thêm cột mới **`purged_at TIMESTAMP NULL`** (migration duy nhất của AQ).
- `purged_at` có giá trị:
  - không hiện trong tab Đã xoá, không khôi phục được
  - không tính trong mọi số đếm tài khoản ở Tổng quan admin (đã loại `is_deleted` thì giữ nguyên)
  - tên hiển thị trong Doanh thu / Lịch sử đơn là `TK đã xoá #<id>`

## 4. Dữ liệu bị xoá

Trong 1 transaction (timeout đủ dài như `TX_OPTIONS`), xoá theo thứ tự con → cha mọi dòng thuộc user:

- **Dạy học:**
  - payments → monthly_tuitions → student_billing_changes, student_place_changes, session_students, tuition_pay_link_payments → tuition_pay_links → teaching_sessions → students → subjects
  - class_upgrade_logs
- **Nơi dạy (cascade từ teaching_places):** place_billing_changes, place_rate_changes, place_payments, place_share_links, place_month_notices, place_pay_link_payments, place_pay_links.
- **Cá nhân / phiên:** teacher_payos (khoá payOS), user_activity_days, consent_records, login_attempts (theo user_id), security_events của user, feedback, chat_conversations (+ messages).

**Giữ lại:**
- `plan_orders`, `plan_order_payments`
- log do admin tạo: `password_reset_logs`, `trial_day_changes` (bảng chỉ có user_id, không có dữ liệu cá nhân ngoài id)

**Bắt buộc:** executor liệt kê **mọi model trong `schema.prisma` có `userId` hoặc quan hệ tới User / Student / TeachingPlace**, ghi bảng phân loại "xoá / giữ" trong báo cáo. Model nào spec chưa nhắc tới → **STOP** hỏi Claude, không tự quyết.

Trước khi xoá: huỷ webhook payOS / link payOS đang active nếu có API huỷ (như khi ngắt kết nối payOS). Lỗi gọi payOS không chặn việc xoá, chỉ ghi log không chứa khoá.

## 5. API

`admin.purgeUser({ userId, confirmUsername })`, adminProcedure:
- User không tồn tại / chưa `is_deleted` / đã `purged_at` → NOT_FOUND.
- Chưa đủ 30 ngày → BAD_REQUEST `purge_too_early`.
- `confirmUsername` khác username hiện tại → BAD_REQUEST `purge_confirm_mismatch`.
- Không cho xoá chính admin đang đăng nhập / tài khoản role admin → FORBIDDEN.
- Thành công: trả số dòng đã xoá theo nhóm; `console.info` chỉ ghi id + số dòng (không tên, không PII).
- Ghi 1 dòng log admin (bảng log sẵn có nếu phù hợp, ví dụ security_events loại `admin_purge_user` với actor = admin, target id). Không có bảng phù hợp thì chỉ `console.info`.

`admin.deletedUsers` trả thêm `purgeAvailableAt` (= deletedAt + 30 ngày) và loại các dòng `purged_at`.

## 6. Giao diện

Tab **Đã xoá** (bảng desktop + thẻ mobile):
- Cạnh **Khôi phục**: nút đỏ viền **Xoá vĩnh viễn** khi đã đủ 30 ngày. Chưa đủ thì dòng chữ nhỏ "Xoá vĩnh viễn được từ dd/MM/yyyy".
- Hộp xác nhận (AlertDialog như `DeleteAccountDialog`):
  - Tiêu đề: "Xoá vĩnh viễn <username>?"
  - Mô tả: xoá toàn bộ học sinh, lịch, học phí, nơi dạy, khoá payOS; không khôi phục được; đơn mua gói giữ lại dạng "TK đã xoá".
  - Ô nhập "Gõ <username> để xác nhận".
  - Nút đỏ chỉ bật khi gõ khớp.
- Thành công: toast "Đã xoá vĩnh viễn"; danh sách tự bỏ dòng; tab Đã xoá giảm số.
- Mobile 375 trước. vi + en.

## 7. Hướng dẫn (luật mới)

Mục Hướng dẫn sử dụng hiện chỉ cho giáo viên; admin không có hướng dẫn trong `/guide`. Theo luật "tính năng mới kèm hướng dẫn":
- Ghi rõ cách dùng trong "Có gì mới" phần admin, nếu releases có phân loại admin.
- Thêm 1 đoạn vào `docs/` admin, nếu có.
- Không chụp ảnh `/guide`.
- Plan ghi rõ quyết định này để review không coi là thiếu.

## 8. Kiểm thử

- **Integration:**
  - TK đủ 30 ngày, có đủ loại dữ liệu (HS, ca, học phí, payOS HS, nơi dạy + payments + pay links, chat, feedback, đơn mua gói đã trả) → purge.
  - Sau purge: mọi bảng "xoá" không còn dòng của user; plan_orders còn nguyên số tiền; user là bia mộ (`username = deleted_<id>`, `purged_at` có giá trị); Doanh thu admin tổng không đổi.
  - Lỗi: chưa đủ 30 ngày, gõ sai tên, TK chưa xoá mềm, TK admin, user không phải admin gọi → lỗi đúng mã.
  - Đăng ký mới bằng username cũ → thành công.
  - Chạy purge 2 lần → lần 2 NOT_FOUND, không lỗi 500.
- **Unit UI:** nút ẩn khi chưa đủ 30 ngày; nút đỏ chỉ bật khi gõ khớp.
- **e2e:** admin purge 1 TK đủ ngày (seed `deleted_at` lùi 31 ngày) ở 375 → dòng biến mất, Doanh thu không đổi.
