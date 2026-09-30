# T — Học phí theo tháng (trọn gói) bên cạnh theo buổi

> Ngày: 2026-10-01 · Người duyệt: chủ ứng dụng (design đã duyệt trong chat 30/9) · Phiên bản: **0.9.0** (minor, có migration → backup Neon trước merge; mọi người đăng nhập lại 1 lần).
> Làm SAU S (0.8.1). Phần V (đánh dấu đã gửi phiếu) spec riêng, làm sau T.

## 1. Vấn đề

Hiện học phí chỉ tính **theo buổi**: mỗi buổi có mặt/đi muộn cộng `session_students.fee` (chụp từ `students.tuition_fee` lúc xếp ca). Nhiều giáo viên thu **trọn tháng** (vd 400k/tháng) bất kể tháng đó 8 hay 9 buổi, HS đi đủ hay không. Họ vẫn điểm danh bình thường để phụ huynh xem con đi học bao nhiêu buổi qua link phụ huynh.

## 2. Quyết định đã chốt với người dùng

| # | Câu hỏi | Chốt |
|---|---|---|
| T1 | Áp dụng ở mức nào | **Từng học sinh** chọn "Theo buổi" hoặc "Trọn tháng" |
| T2 | Tháng nào tính tiền (trọn tháng) | Tháng có **≥ 1 ca xếp cho HS** (ca chưa xoá, chưa huỷ; kể cả vắng / chưa điểm danh) → thu đủ mức tháng. Không có ca nào → 0đ |
| T3 | HS vào/nghỉ giữa tháng | **Thu trọn**, không chia theo ngày. Cần giảm → GV dùng Tất toán/miễn giảm có sẵn |
| T4 | Đổi cách thu / mức tiền | Áp dụng **từ tháng hiện tại (giờ VN) trở đi**; tháng trước giữ nguyên |
| T5 | Gói | **Mọi gói**, kể cả Standard |

## 3. Dữ liệu (migration `add_student_billing`)

**Bảng mới `student_billing_changes`** (lịch sử cách thu — nguồn sự thật khi tính 1 tháng bất kỳ):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | serial PK | |
| student_id | int FK → students (cascade) | |
| from_key | int | `year*12 + month-1` của tháng bắt đầu hiệu lực; **0 = từ đầu** |
| mode | varchar(20) `per_session` \| `monthly` | chuỗi như `attendance` (repo không dùng enum Postgres); zod kiểm giá trị |
| monthly_fee | int ≥ 0 | 0 khi `per_session` |
| created_at | timestamptz default now() | |

Unique `(student_id, from_key)`. Index `(student_id)`.

**Bảng `students` thêm:** `billing_mode varchar(20) NOT NULL DEFAULT 'per_session'`, `monthly_fee int NOT NULL DEFAULT 0` — giá trị **hiện tại** để hiển thị danh sách/form nhanh; luôn khớp dòng lịch sử mới nhất.

Không backfill: HS cũ không có dòng lịch sử = theo buổi (đúng như trước). Không mã hoá (không phải dữ liệu cá nhân).

**Quy tắc ghi lịch sử** (trong cùng transaction với tạo/sửa HS):
- **Tạo HS** với "Trọn tháng" → 1 dòng `from_key = 0` (áp cho mọi tháng, kể cả ca xếp lùi ngày). Tạo "Theo buổi" → không ghi dòng nào.
- **Sửa HS** mà `(mode, monthly_fee)` khác giá trị hiện tại → upsert dòng `from_key = tháng VN hiện tại` (đổi nhiều lần trong 1 tháng thì ghi đè dòng tháng đó). Nếu sau upsert dòng này giống hệt dòng liền trước → xoá dòng này (tránh lịch sử rác khi đổi qua đổi lại).
- Đổi `tuition_fee` (giá/buổi) giữ nguyên hành vi cũ (chỉ ảnh hưởng ca xếp sau).

**Tra cứu:** `resolveBilling(changes, key)` = dòng có `from_key` lớn nhất ≤ key; không có → `{ mode: "per_session", monthlyFee: 0 }`.

## 4. Cách tính

### 4.1 Học phí 1 tháng của 1 HS (tuition.service)
- Theo buổi: như cũ — Σ `fee` các link có mặt/đi muộn.
- Trọn tháng: `currentMonthFee = monthlyFee` nếu tháng có ≥ 1 link (ca `isDeleted=false`, `status != cancelled`, bất kỳ trạng thái điểm danh), ngược lại 0.
- `totalSessions`, `presentSessions` đếm như cũ (để hiển thị "Đã học 7/8 buổi").
- Nợ chuyển tháng (`computeClosingBalances`, hotfix 0.7.1) dùng **cùng** hàm tính fee tháng: truy vấn lịch sử lấy mọi link sống không huỷ (kèm attendance) thay vì chỉ có mặt/đi muộn, rồi mỗi tháng áp `resolveBilling`.
- Snapshot `monthly_tuition` ghi như cũ (`currentMonthFee` = số tính ra).
- Tất toán, các lần thu, trả dư chuyển sang: không đổi.

### 4.2 Báo cáo & Tổng quan (report.service)
Với HS trọn tháng, trong mỗi (HS, tháng) của kỳ báo cáo:
- **Dự kiến** (`expectedRevenue`): cộng `monthlyFee` 1 lần nếu có ≥ 1 link trong tháng (thay cho Σ fee các link).
- **Doanh thu** (`totalRevenue`): cộng `monthlyFee` 1 lần nếu có ≥ 1 link **đã điểm danh** (khác `pending`) trong tháng — tháng đã bắt đầu học.
- Lọc theo khối: HS trọn tháng tính vào khối nếu có link đúng khối trong tháng đó (như cách đang lọc).
- Tỷ lệ điểm danh, số buổi, số HS: không đổi.
- Áp dụng cho `getMonthlySummary`, `getDashboardStats`, `getStudentReport`. HS đã xoá vẫn tính như R8 (dùng `HISTORY_LINK`).
- Một hàm dùng chung `revenueForLinks(links, billingByStudent)` để 3 chỗ không lệch nhau.

### 4.3 Link phụ huynh, phiếu báo, sheet học phí
Đều đọc từ `getMonthlyTuitionStatus` → tự đúng số. Thêm vào `TuitionStatusDTO`: `billingMode`, `monthlyFee` để hiển thị.

## 5. Giao diện

- **Form HS** (`StudentFormDialog`): công tắc 2 nút **[Theo buổi | Trọn tháng]** ngay trên ô tiền. Ô tiền đổi nhãn "Học phí/buổi" ↔ "Học phí/tháng" và giá trị tương ứng (`tuitionFee` ↔ `monthlyFee`; đổi qua lại không mất số đã nhập). Sửa HS đang học mà đổi cách thu/mức tháng → dòng ghi chú xám: "Áp dụng từ tháng {m}/{y}; các tháng trước giữ nguyên."
- **Danh sách HS**: cột/ô học phí hiện `400.000đ/tháng` hoặc `50.000đ/buổi`.
- **Điểm danh** (`AttendancePanel`): HS trọn tháng không hiện ô sửa phí/buổi, thay bằng nhãn "Trọn tháng".
- **Sheet học phí + phiếu báo QR + trang phụ huynh**: dòng học phí tháng ghi **"Học phí tháng (trọn gói): 400.000đ · Đã học 7/8 buổi"**; danh sách từng buổi giữ nguyên (không hiện tiền từng buổi cho HS trọn tháng).
- **Nhập Excel**: thêm cột tuỳ chọn **"Cách thu"** (`buổi`/`tháng`, không dấu/không phân biệt hoa thường; bỏ trống = buổi). Cột "Học phí" hiện có là mức theo cách thu đó. File mẫu thêm cột này.
- **Sao lưu Excel**: sheet Học sinh thêm "Cách thu", "Học phí tháng"; sheet mới "Lịch sử cách thu" (HS, từ tháng, cách thu, mức).
- Tiếng Anh đầy đủ.

## 6. Không làm
- Chia tiền theo ngày khi vào/nghỉ giữa tháng.
- Cách thu theo môn hoặc theo giáo viên.
- Tự đổi cách thu các tháng đã qua.

## 7. Review focus / ca dễ sai
1. Đổi theo buổi → trọn tháng giữa tháng 10: tháng 9 giữ số cũ (theo buổi), tháng 10 = mức tháng, nợ chuyển sang tháng 11 đúng.
2. HS trọn tháng vắng hết tháng vẫn thu đủ; tháng không có ca (nghỉ hè) 0đ, không sinh nợ.
3. Ca đã huỷ / đã xoá không làm tháng "có ca".
4. Báo cáo khoảng nhiều tháng + lọc khối: HS trọn tháng cộng đúng 1 lần mỗi tháng.
5. Tạo HS trọn tháng rồi xếp ca lùi về tháng trước: tháng đó cũng trọn tháng (`from_key = 0`).
6. Đổi qua đổi lại trong cùng tháng không sinh nhiều dòng lịch sử.
7. Xoá mềm / dọn HS (R): lịch sử cách thu giữ nguyên (tiền báo cáo vẫn đúng); purge không xoá bảng này.

## 8. Kiểm thử
- Unit: `resolveBilling`, fee tháng trọn gói, `revenueForLinks`.
- Integration: các ca ở mục 7; `computeClosingBalances` với HS trọn tháng; báo cáo tháng + khoảng + khối; phiếu báo/link phụ huynh trả `billingMode`; import cột "Cách thu"; backup có cột mới.
- Component: form đổi công tắc giữ số; AttendancePanel nhãn "Trọn tháng".
- E2E: tạo HS trọn tháng 400k → xếp 2 ca, điểm danh 1 có mặt 1 vắng → Học phí hiện 400.000 · Đã học 1/2 → phiếu báo hiện "trọn gói".
- Hồi quy full.
