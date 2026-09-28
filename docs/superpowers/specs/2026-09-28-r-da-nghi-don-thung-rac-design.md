# R — "Đã nghỉ" / Xoá rõ ràng, Dọn Thùng rác, tiền của HS đã xoá vẫn tính — Design

> Ngày: 2026-09-28 · Version đích: **0.7.0** (O lùi thành 0.8.0) · Thứ tự: K → **R** → O
> Nền: Q (xoá mềm + Thùng rác, v0.5.0) đã lên prod. R sửa lại chỗ người dùng thấy khó hiểu và thêm xoá vĩnh viễn.

## 1. Vấn đề (người dùng báo 2026-09-28)

1. Menu HS có "Cho nghỉ" và "Xoá" đứng cạnh nhau, hộp thoại Xoá HS còn nợ lại có thêm nút "Cho nghỉ thay" → giáo viên không hiểu khác nhau thế nào, dễ bấm nhầm.
2. Thùng rác chỉ có Khôi phục, không dọn được.
3. (Phát hiện khi brainstorm) Q ẩn tiền của HS đã xoá khỏi Báo cáo/Tổng quan → "Đã thu" các tháng cũ bị hụt, tổng kết cuối năm lệch. Tiền đã thu là tiền thật, phải luôn được tính.

## 2. Quyết định đã chốt với người dùng

| # | Chủ đề | Chốt |
|---|---|---|
| R1 | Tên hành động | "Cho nghỉ" → **"Đã nghỉ"** (khớp nhãn trạng thái). Chiều ngược: **"Học lại"**. Mỗi mục menu có 1 dòng mô tả. |
| R2 | Khi nào được Xoá HS | Chỉ khi HS **"sạch"**: (a) **chưa có dữ liệu học** — chưa từng có buổi `present`/`late` ở ca còn sống và không có lần thu còn sống; HOẶC (b) **đã nghỉ và hết nợ**. Server chặn đúng quy tắc này. |
| R3 | Nút "Cho nghỉ thay" | **Bỏ hẳn**, cùng câu cảnh báo nợ `delete_student_debt_desc`. |
| R4 | Dọn Thùng rác | Nút **"Dọn tab này (N)"** mỗi tab + **"Dọn sạch thùng rác"** đầu trang. Không xoá lẻ từng mục. Popup xác nhận (không bắt gõ chữ). |
| R5 | Dọn HS | **Ẩn danh, không xoá cứng**: tên → "Học sinh đã xoá", `parentPhone`/`parentName`/`notes` → null, `parentLinkToken` → null, ghi `purgedAt`. Giữ lần thu, học phí, điểm danh. |
| R6 | Dọn Ca / Lần thu | **Xoá cứng** (đã không được tính tiền từ lúc vào Thùng rác). |
| R7 | Dọn Môn | Xoá cứng nếu không còn ca nào (kể cả ca đã xoá) dùng môn; còn thì giữ, ghi `purgedAt` (ẩn vĩnh viễn). |
| R8 | Tiền của HS đã xoá | Số liệu lịch sử ở **Báo cáo (tổng kỳ)** và **Tổng quan** tính cả HS đã xoá (còn trong Thùng rác hay đã dọn): Đã thu, Học phí đã dạy, Học phí dự kiến, Tỉ lệ điểm danh, số HS đã học trong kỳ. **Không** hiện HS đã xoá ở: danh sách HS, màn Học phí, ô chọn HS trong Báo cáo, Cần chú ý, lịch/điểm danh. Còn nợ vẫn bỏ HS đã xoá (theo R2 họ không còn nợ). |
| R9 | Thứ tự | Sau K, trước O. |

## 3. Menu học sinh (UI)

`StudentList` → menu "…" mỗi dòng (desktop + card mobile), thứ tự:

1. Xem lịch · Link phụ huynh · Sửa (giữ nguyên)
2. HS đang học: **Đã nghỉ** — mô tả `mark_dropped_hint`: "Đã nghỉ hoặc sắp nghỉ. Giữ học phí, nợ, lịch sử; gỡ khỏi các ca sắp tới."
3. HS đã nghỉ: **Học lại** — mô tả `mark_back_hint`: "Chuyển về Đang học. Không tự thêm lại vào các ca." Gọi `student.update({ id, data: { isActive: true } })` (đã có kiểm giới hạn gói).
4. **Xoá học sinh** (chữ đỏ) — mô tả `delete_student_hint`: "Chỉ dùng khi nhập nhầm hoặc trùng."

Mục menu có 2 dòng: dòng tên + dòng mô tả `text-xs text-slate-500`, vùng chạm ≥ 44px trên mobile.

Hộp thoại "Đã nghỉ" (đổi chữ, giữ luồng `student.deactivate`): tiêu đề "Đánh dấu học sinh đã nghỉ?", nội dung "{tên} chuyển sang Đã nghỉ và được gỡ khỏi các ca chưa dạy. Học phí, nợ và lịch sử vẫn giữ." Nút "Đã nghỉ". Toast "Đã chuyển học sinh sang Đã nghỉ".

### Hộp thoại Xoá (viết lại `DeleteStudentDialog`)

Mở ra gọi query mới `student.deleteCheck({ id })` → `{ allowed: true } | { allowed: false, reason: "active_with_data" } | { allowed: false, reason: "debt", debt: number }`.

- Đang kiểm: nút Xoá disabled, chữ "Đang kiểm tra…".
- `allowed`: "Xoá học sinh {tên}? Học sinh sẽ vào Thùng rác, khôi phục được. Tiền đã thu vẫn được giữ trong Báo cáo." Nút [Hủy] [Xoá] (đỏ).
- `active_with_data`: "Không xoá được: {tên} đang học và đã có buổi học hoặc lần thu. Nếu học sinh đã nghỉ, hãy chọn **Đã nghỉ** trong menu." Chỉ nút [Đóng].
- `debt`: "Không xoá được: {tên} còn nợ {số tiền}. Thu hết nợ trước khi xoá." Chỉ nút [Đóng].
- Lỗi query: hiện lỗi + [Thử lại].

> Điều chỉnh so với lúc brainstorm: lý do chặn hiện **trong hộp thoại** (mở từ mục Xoá) thay vì làm mờ mục menu, vì biết "còn nợ" cần tính học phí từng HS — tính cho cả danh sách mỗi lần mở trang là quá nặng. Giáo viên vẫn thấy lý do trước khi có thể xoá.

## 4. Quy tắc Xoá HS (server)

`softDeleteStudent` gọi `assertStudentDeletable(db, userId, student)` trước khi ghi; `student.deleteCheck` dùng cùng hàm (không ném, trả kết quả).

```
hasData = tồn tại sessionStudent(studentId, attendance ∈ {present, late}, session.isDeleted = false)
       OR tồn tại payment(isDeleted = false, monthlyTuition.studentId = id)
nếu !hasData → allowed
nếu student.isActive → active_with_data
debt = nợ lũy kế tới tháng VN hiện tại (getMonthlyTuitionStatus persist=false, onlyStudentIds=[id]) → max(0, totalAmountDue − paidAmount) nếu !isFullPaid
debt > 0 → debt ; ngược lại allowed
```

`softDeleteStudent` bị chặn → `BAD_REQUEST` với câu tiếng Việt như hộp thoại (không có HTML).

## 5. Dọn Thùng rác

### API
- `trash.purge({ type })` — dọn 1 loại; `trash.purgeAll()` — dọn cả 4 (thứ tự: lần thu → ca → HS → môn). Trả `{ purged: Record<TrashType, number> }`. Mọi gói đều dùng được (như Q12).
- Ghi log `console.info("[trash] user <id> dọn <type>: <n>")`, không ghi nội dung.

### Từng loại (trong 1 transaction mỗi loại, chỉ của `userId`, chỉ `isDeleted = true` và `purgedAt = null`)
- **payment**: `deleteMany` các lần thu đã xoá của HS thuộc user. `paidAmount` không đổi (đã loại từ lúc xoá mềm).
- **session**: `deleteMany` ca đã xoá. `session_students` xoá theo (Cascade); ca bù trỏ tới có `makeupOfId` → null (SetNull, sẵn có).
- **student**: `updateMany` ẩn danh (R5) + `purgedAt = now`. Vẫn `isDeleted = true`.
- **subject**: môn đã xoá không còn ca nào (`sessions: { none: {} }`, kể cả ca đã xoá — lọc tay, extension không phủ `none`) → `deleteMany`; còn lại → `purgedAt = now`.

### Hiển thị sau khi dọn
- `trash.counts`/`trash.list` bỏ HS và môn có `purgedAt`. Khôi phục HS/môn đã dọn → `NOT_FOUND`.
- Lần thu đã xoá của HS đã dọn vẫn nằm tab Lần thu, tên hiện "Học sinh đã xoá"; khôi phục → CONFLICT như cũ (HS đang xoá).
- Ca đã xoá có HS đã dọn: hiện bình thường (tab ca không hiện tên HS).

### UI
- `PageHeader` actions: nút outline đỏ **"Dọn sạch thùng rác"** (disabled khi tổng = 0).
- Trên danh sách, bên phải hàng chip: nút **"Dọn tab này ({n})"** (disabled khi n = 0).
- Popup `AlertDialog` chung:
  - Tiêu đề: "Xoá vĩnh viễn {n} mục?" (dọn tab: "Xoá vĩnh viễn {n} {loại}?")
  - Nội dung: "Lưu ý: dữ liệu đã xoá khỏi Thùng rác sẽ vĩnh viễn không lấy lại được. Bạn chắc chắn muốn xoá?" Với HS thêm dòng: "Tiền đã thu của học sinh vẫn được giữ trong Báo cáo."
  - Nút [Hủy] [Xoá vĩnh viễn] (đỏ). Đang chạy: nút disabled, không đóng được bằng Esc/click ngoài.
- Xong: toast "Đã dọn {n} mục", về trang 1, invalidate counts + list.
- Sửa kèm (minor của Q): pagination hiện khi `totalCount > 20` (không phụ thuộc pageSize đang chọn); trang hiện tại > totalPages sau khôi phục/dọn → lùi về trang cuối có dữ liệu.
- `trash_hint` đổi: "Mục đã xoá nằm ở đây cho tới khi bạn khôi phục hoặc dọn."

## 6. Tiền của HS đã xoá (R8)

- Thêm hằng `HISTORY_LINK = {}` trong `src/server/soft-delete.ts`, chú thích: dùng cho số liệu tiền/điểm danh lịch sử — tính cả HS đã xoá.
- `getMonthlySummary`: `sessionStudents` của ca dùng `HISTORY_LINK` thay `LIVE_LINK` (cả `some` khi lọc grade); `monthlyTuitions` bỏ `student.isDeleted: false` (cả nhánh grade: bỏ ở `student`, giữ `session.isDeleted: false`). `totalOutstanding` giữ nguyên.
- `getDashboardStats`: `sessionsThisMonth.include.sessionStudents` dùng `HISTORY_LINK`; `paidAgg` bỏ `student.isDeleted: false`. `totalStudents` (HS đang học) giữ nguyên.
- Không đổi: `getStudentReport`, `getMonthlyTuitionStatus`, `getDashboardAlerts`, ô chọn HS, backup Excel, trang phụ huynh.

## 7. Dữ liệu

Migration `add_purged_at`: `students.purged_at TIMESTAMP(3) NULL`, `subjects.purged_at TIMESTAMP(3) NULL`. Chỉ thêm cột.

## 8. i18n (vi + en cùng key)

Đổi: `deactivate` "Đã nghỉ"/"Mark as dropped"; `deactivate_student`, `deactivate_student_desc`, `deactivate_success`, `trash_hint`, `delete_student_desc`.
Xoá: `deactivate_instead`, `delete_student_debt_desc`.
Thêm: `mark_dropped_hint`, `mark_back`, `mark_back_hint`, `mark_back_success`, `delete_student_hint`, `delete_blocked_active`, `delete_blocked_debt`, `close`(nếu chưa có), `purge_all`, `purge_tab`, `purge_title_all`, `purge_title_tab`, `purge_warning`, `purge_student_note`, `purge_confirm`, `purge_success`, `deleted_student_name`.

## 9. Kiểm thử

- **Integration** `tests/integration/student-delete-rules.test.ts`: HS mới không dữ liệu → xoá được; HS có buổi present đang học → BAD_REQUEST + deleteCheck `active_with_data`; đã nghỉ còn nợ → `debt` với đúng số; đã nghỉ hết nợ → xoá được; chỉ có lần thu đã xoá → coi như không dữ liệu; `absent` không tính là dữ liệu.
- **Integration** `tests/integration/trash-purge.test.ts`: dọn từng loại + dọn sạch; HS ẩn danh giữ payments/monthly_tuition/session_students; link phụ huynh chết; HS/môn đã dọn không còn trong counts/list và khôi phục → NOT_FOUND; môn còn ca → purgedAt, môn không ca → mất hẳn; chỉ dọn của mình; dọn rỗng → 0.
- **Integration** `tests/integration/report-deleted-students.test.ts`: HS có buổi present + lần thu tháng trước, cho nghỉ + hết nợ + xoá → `getMonthlySummary` (totalPaid, totalRevenue, totalStudents) và `getDashboardStats` (totalPaidMonth, totalRevenueMonth) bằng số trước khi xoá; sau khi dọn vẫn bằng; `totalOutstanding` không đổi.
- **Unit** `DeleteStudentDialog` (3 trạng thái, không còn nút "Cho nghỉ thay"), `TrashList` (nút dọn, popup, disabled khi 0), menu `StudentList` (Đã nghỉ/Học lại/Xoá + mô tả).
- **E2E** `tests/e2e/trash-purge.spec.ts` (desktop + 390px): xoá HS sạch → dọn tab HS → popup → hết trong Thùng rác; HS đang học có dữ liệu → hộp thoại báo không xoá được.

## 10. Review Focus

1. HS đã nghỉ, hết nợ tháng này nhưng còn nợ tháng trước (carry-over) → phải bị chặn (`debt` lấy nợ lũy kế).
2. Dọn HS rồi mở Báo cáo tháng cũ → số không đổi; trang phụ huynh bằng link cũ → 404.
3. Dọn môn đang được ca đã xoá (chưa dọn) dùng → không lỗi khoá ngoại (giữ `purgedAt`), dọn tiếp tab ca rồi dọn môn lần nữa → môn không còn hiện (đã purgedAt, không cần xoá cứng lại).
4. Hai tab cùng bấm Dọn → lần 2 trả 0, không lỗi.
5. Giáo viên khác không dọn/không thấy được dữ liệu của mình.

## 11. Ngoài phạm vi

Xoá vĩnh viễn tài khoản giáo viên (admin); tự dọn theo thời gian (cron); xoá lẻ từng mục; hiện "Học sinh đã xoá" thành dòng riêng trong bảng Báo cáo (chỉ tính vào tổng).
