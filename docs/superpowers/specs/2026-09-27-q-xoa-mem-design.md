# Q — Xoá mềm toàn app, Thùng rác giáo viên, admin xoá/khôi phục tài khoản

> Phần Q. Thứ tự merge: P (`0.4.1`, thêm menu "Hành động" ở `/admin/accounts`) → **Q (`0.5.0`)** → K (`0.6.0`) → O (`0.7.0`). Spec đọc code trên `main` = `86b37ff` (v0.4.0, N đã merge, P chưa code). Có **1 migration** (thêm cột, không destructive). Nâng minor → mọi người đăng nhập lại 1 lần (epoch `0.5`, xem `src/lib/session-policy.ts`).

## 1. Bối cảnh (đã đọc code)

- Prisma `5.22` (`findUnique` nhận thêm field không unique trong `where` từ 5.0), Postgres. `src/server/db.ts` đã bọc client bằng `$extends({ query: { $allOperations } })` để log query chậm; test dùng chính `db` này (`tests/helpers/trpc.ts`, `tests/setup.ts`).
- `tests/setup.ts` mỗi file test `deleteMany()` lần lượt `sessionStudent → teachingSession → payment → student → classUpgradeLog → subject → loginAttempt → planOrder → user` rồi seed `teacher`, `teacher2`, `teacher_std`, `admin_test`.
- Raw SQL chạm bảng có thể xoá mềm: `checkOverlap` (`SELECT … FROM teaching_sessions`), `bulkDeleteFutureSessions` (`DELETE FROM teaching_sessions`), `bulkUpdateFutureSessions` (`SELECT id … FROM teaching_sessions`), `lockMonth` (`SELECT … monthly_tuition FOR UPDATE`, không cần lọc), advisory lock (không cần lọc).
- Ràng buộc unique hiện có: `users.username`, `subjects(user_id, name)`, `students.parent_link_token`, `monthly_tuition(student_id, year, month)`, `session_students(session_id, student_id)`, `class_upgrade_logs(user_id, year)`, `plan_orders.code`. **Ca dạy không có unique theo giờ** — trùng giờ kiểm ở ứng dụng (`checkOverlap`, kiểm trùng trong bộ nhớ ở `bulkCreate*`, `session-copy`).
- Học sinh: menu "Xoá" ở `StudentList.tsx` gọi `student.delete` → `softDeleteStudent` = **cho nghỉ** (`isActive = false`) + **xoá cứng** link `session_students` của các ca chưa kết thúc. Form sửa HS có ô "Trạng thái" (Đang học / Đã nghỉ) = cho nghỉ nhưng **không** gỡ ca. `upgradeAllClasses` cho HS lớp 12 nghỉ (P5 sẽ gỡ HS đó khỏi ca chưa kết thúc).
- Môn học: UI chỉ có "Ẩn"/"Hiện lại" (`isActive`). `subject.delete` (`softDeleteSubject` = `isActive=false`, chặn khi môn có ca) **không có UI nào gọi**.
- Lần thu (`Payment`): `deletePayment` xoá cứng + `syncPaidAmount` (aggregate, hàm duy nhất ghi `paidAmount`).
- Admin: `/admin/accounts` (`AdminAccounts.tsx`) đang 3 nút rời; P9 đổi thành 1 nút menu "Hành động" (`data-testid="admin-user-actions"`, item Đặt gói / Đặt dùng thử / Reset mật khẩu, dialog render ngoài menu theo state) + phân trang client 20/trang.
- Phiên (N): `getSessionUserState(userId, sessionVersion)` trong `src/server/auth-credentials.ts` chạy mỗi `auth()` Node (`nodeJwt`); `authorizeCredentials` trả `null` khi `!user || !user.isActive` (ghi `loginAttempt` thất bại, không chạy bcrypt).
- Trang phụ huynh `/p/<token>`: `getParentView` tra `student.parentLinkToken`, chặn khi `!student.user.isActive` hoặc chủ TK hết Pro.

## 2. Mục tiêu và tiêu chí hoàn thành

- Mọi thao tác "Xoá" mà giáo viên/admin bấm trong app đều **xoá mềm** (đánh dấu `isDeleted`), lấy lại được.
- Giáo viên có màn **Thùng rác** `/trash`: xem ca dạy / học sinh / lần thu / môn học đã xoá (lọc theo loại, phân trang), **Khôi phục** từng mục; xung đột (trùng giờ, môn/HS cha đang ở thùng rác, vượt giới hạn gói…) → báo lý do, không khôi phục.
- Bản ghi đã xoá **không xuất hiện ở bất kỳ đâu** ngoài Thùng rác: danh sách, lịch, chi tiết ca, điểm danh, học phí, phiếu báo, báo cáo, Tổng quan + cảnh báo, sao lưu Excel, trang phụ huynh, kiểm trùng giờ, chép lịch tháng, giới hạn số HS của gói.
- Admin: menu "Hành động" có **Xoá tài khoản** (không có ở dòng admin) + AlertDialog nêu tên đăng nhập. Tài khoản bị xoá: bị đá mọi phiên ngay, không đăng nhập được (thông báo chung như sai mật khẩu), link phụ huynh ngừng hoạt động, tên đăng nhập vẫn bị giữ. Tab **Đã xoá** + nút **Khôi phục** → đăng nhập lại được, dữ liệu nguyên vẹn.
- `pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec tsc --noEmit`, `pnpm exec next build` (DB test) sạch; `package.json` `0.5.0`.

## 3. Kiểm kê mọi chức năng xoá

| # | Chức năng (UI → API → service) | Hiện tại | Trong Q | Ảnh hưởng |
|---|---|---|---|---|
| X1 | Xoá ca lẻ (`SessionDetailDialog` → `session.delete` → `deleteSession`) | Xoá cứng, cascade `session_students` (mất điểm danh) | `isDeleted=true, deletedAt=now()`; `session_students` giữ nguyên | Buổi không tính học phí/báo cáo; khôi phục → tính lại (mục 6) |
| X2 | Xoá ca lặp tương lai (checkbox "xoá cả chuỗi" → `session.deleteFuture` → `bulkDeleteFutureSessions`) | Raw `DELETE` | Raw `UPDATE … SET is_deleted = true, deleted_at = now() … AND is_deleted = false` (một lệnh → cùng `deleted_at`) | Như X1, từng ca khôi phục riêng trong Thùng rác |
| X3 | "Khôi phục ca đã huỷ" (`session.restore` → `restoreSession`) xoá các ca bù | `deleteMany` cứng | `updateMany` xoá mềm ca bù | Ca bù vào Thùng rác; khôi phục ca bù bị chặn khi ca gốc không còn chờ bù (mục 7) |
| X4 | Xoá học sinh (`StudentList` "Xoá" → `student.delete` → `softDeleteStudent`) | Thực chất **cho nghỉ** + xoá cứng link ca chưa dạy | Tách 2 việc: **"Cho nghỉ"** (menu mới, `student.deactivate` = thân hàm cũ, đổi tên `deactivateStudent`) và **"Xoá"** = `isDeleted` (không đụng `session_students`, không đụng `isActive`) | Xem mục 5 (nghỉ vs xoá) |
| X5 | Xoá lần thu (`TuitionDetailSheet` → `payment.delete` → `deletePayment`) | Xoá cứng + `syncPaidAmount` | `isDeleted=true` + `syncPaidAmount` (đã lọc `isDeleted:false`) trong cùng transaction khoá tháng | `paidAmount` giảm ngay; khôi phục cộng lại ngay |
| X6 | Xoá môn (`subject.delete` → `softDeleteSubject`) | `isActive=false`, không có UI | Thêm item **"Xoá"** ở menu `SubjectList`; service = `isDeleted=true`; chặn: môn mặc định, môn còn ca (chưa xoá), môn đang hiện cuối cùng | Môn biến khỏi mọi chỗ chọn môn; "Ẩn" giữ nguyên nghĩa cũ |
| X7 | Admin xoá tài khoản | Không có | `users.isDeleted=true, deletedAt, deletedBy, sessionVersion+1` | Mục 8 |
| — | Gỡ HS khỏi ca (`AttendancePanel` → `session.removeStudent`; sửa ca/sửa chuỗi bỏ chọn HS → `syncSessionStudents`) | Xoá cứng link | **Giữ xoá cứng** (sửa danh sách lớp, không phải "xoá dữ liệu"; link không có thùng rác riêng). Người dùng chốt U1 | Như hiện tại |
| — | Huỷ đơn mua gói (`plan.cancelOrder`), admin từ chối đơn | Đổi `status` | Giữ (đã là trạng thái, đơn còn trong lịch sử) | Không |
| — | Tắt link phụ huynh (`disableParentLink`) | `parentLinkToken=null` | Giữ (thu hồi quyền truy cập, không mất dữ liệu; tạo lại link mới được) | Không |
| — | Ca "Huỷ" (cancel + ca bù) | `status=cancelled` | Giữ (nghiệp vụ, không phải xoá) | Không |
| — | Script `user:deactivate`, `reset-password` (xoá log đăng nhập) | Tay, ngoài app | Giữ | Không |
| — | `MonthlyTuition`, `ClassUpgradeLog`, log admin | Không có chức năng xoá | Không cần cột mới | — |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| Q1 | Lọc bản ghi đã xoá: extension hay sửa từng query | **Kết hợp**: (a) query extension trong `src/server/db.ts` tự thêm `isDeleted: false` vào `where` cho **thao tác đọc cấp cao nhất** (`findMany/findFirst(OrThrow)/findUnique(OrThrow)/count/aggregate/groupBy`) của 4 model `Student, Subject, TeachingSession, Payment`, bỏ qua khi `where` đã có khoá `isDeleted`; (b) **sửa tay** mọi chỗ extension không phủ: lọc quan hệ (`include`/`select` danh sách, `_count`, `some/none/every`, lọc qua quan hệ `session: {…}`/`student: {…}`), raw SQL, `updateMany` nghiệp vụ | Chỉ sửa tay thì ~70 truy vấn cấp cao, quên 1 chỗ là lộ dữ liệu; chỉ extension thì không phủ quan hệ/raw SQL (bẫy lớn nhất: `include sessionStudents`, `some/none`). Extension làm lưới an toàn, đặc biệt các lệnh `findUnique({ id })` kiểm quyền → bản đã xoá thành `NOT_FOUND`, không sửa được |
| Q1a | Model `User` có vào extension không | **Không**. Kiểm `isDeleted` tay ở: đăng nhập, `getSessionUserState`, trang phụ huynh, admin | Đăng ký phải thấy username đã xoá để giữ tên; admin cần đọc tài khoản đã xoá |
| Q1b | Đọc bản đã xoá (Thùng rác, test) | Truyền `isDeleted: true`; đọc cả hai: hằng `WITH_DELETED = { isDeleted: undefined }` | Có khoá `isDeleted` → extension không đè; Prisma bỏ qua field `undefined` nên đọc cả hai (`BoolFilter` không có `in`) |
| Q1c | Ghi (`update/updateMany/delete/deleteMany/upsert/create*`) | Extension **không** đụng | `tests/setup.ts` `deleteMany()` phải xoá sạch cả bản đã xoá; khôi phục = `update` bản đã xoá |
| Q2 | Unique bị ảnh hưởng | **Không dùng partial unique index.** `username`: giữ unique (chủ đích giữ tên). `subjects(user_id, name)`: giữ unique; tạo/đổi tên trùng môn trong thùng rác → báo "Môn này đang ở Thùng rác. Hãy khôi phục trong Thùng rác." (cùng kiểu thông báo môn đang ẩn sẵn có). Ca dạy/HS không có unique | Prisma 5.22 không mô tả được partial index trong schema → mọi `migrate dev` sau này sinh `DROP INDEX` cho index đó (drift), dễ bị áp nhầm. Giữ unique còn làm khôi phục môn không bao giờ xung đột tên |
| Q3 | HS nghỉ vs HS xoá | 2 khái niệm riêng: **Đã nghỉ** (`isActive=false`) = nghiệp vụ, vẫn hiện ở lọc "Đã nghỉ", vẫn có học phí/nợ/báo cáo, không tính giới hạn gói. **Đã xoá** (`isDeleted=true`) = nhập nhầm / không muốn thấy nữa, biến khỏi mọi nơi, chỉ còn ở Thùng rác. Menu HS: "Cho nghỉ" (chỉ hiện với HS đang học) + "Xoá" | Hôm nay "Xoá" thực chất là "nghỉ" và dialog ghi "Dữ liệu lịch sử vẫn được giữ lại" — giữ đúng hành vi đó dưới tên đúng; "Xoá" thật để dọn HS nhập nhầm |
| Q4 | Xoá HS có động tới ca/điểm danh | **Không** (giữ `session_students`, `isActive`, `parentLinkToken`) | Khôi phục trả lại đúng như cũ. Mọi đọc qua quan hệ đã lọc `student.isDeleted=false` (Q1b) |
| Q5 | Học phí khi xoá/khôi phục | Mục 6 | — |
| Q6 | Đăng nhập tài khoản đã xoá | Cùng nhánh với "không có user / bị khoá": ghi `loginAttempt` thất bại, trả `null` → câu chung "Tên đăng nhập hoặc mật khẩu không đúng" | Không lộ tài khoản tồn tại (đăng ký vẫn báo "Tên đăng nhập đã tồn tại" như mọi tên đã có — không tránh được khi giữ tên) |
| Q7 | Đá phiên | Xoá: `sessionVersion: { increment: 1 }` **và** `getSessionUserState` trả `null` khi `isDeleted` | Hai lớp; khôi phục không giảm version nên token cũ vẫn chết, phải đăng nhập lại |
| Q8 | Link phụ huynh | `getParentView`: `student.user.isDeleted` → `null` (404); HS đã xoá → extension làm `findUnique` trả `null`. Token giữ nguyên → khôi phục là link sống lại | Giống luật "hết Pro thì link tạm 404" (spec G D9) |
| Q9 | Đơn gói của tài khoản đã xoá | Ẩn khỏi "Đơn chờ" (`user: { isDeleted: false }`), `approveOrder`/`adminSetPlan`/`resetPassword`/`setUserTrial` với user đã xoá → `NOT_FOUND "Không tìm thấy tài khoản"`. Lịch sử đơn vẫn hiện | Tránh cấp gói cho tài khoản đã xoá; lịch sử là đối soát tiền |
| Q10 | Chỗ đặt "Tài khoản đã xoá" | 2 tab trên `/admin/accounts`: "Đang dùng" / "Đã xoá (n)" (`role="tablist"`). Tab Đã xoá: tên đăng nhập, họ tên, xoá lúc, người xoá, nút "Khôi phục" (không cần xác nhận — không phá gì) | Không thêm mục điều hướng admin |
| Q11 | Chỗ đặt Thùng rác giáo viên | `MANAGE_ITEMS` (sidebar nhóm Quản lý) + `MORE_ITEMS` (tab Thêm mobile), mục cuối, icon `Trash2`, route `/trash` | Cùng chỗ các màn quản lý; menu avatar đã chật |
| Q12 | Gói | Mọi gói (kể cả Standard); lần thu trong thùng rác hiện + khôi phục được kể cả khi gói không còn tính năng `payments` | Khôi phục là bảo toàn dữ liệu, không phải tính năng bán |
| Q13 | Tự dọn vĩnh viễn | **Không** trong Q; không có nút "Xoá vĩnh viễn" | Người dùng chốt U2: làm ở **phần R** riêng sau O |
| Q14 | Cột | `isDeleted Boolean @default(false)` + `deletedAt DateTime?` cho `students, subjects, teaching_sessions, payments`; `users` thêm `deletedBy String? @db.VarChar(50)`. Không thêm index | Trong một tài khoản dữ liệu nhỏ; index hiện có (`user_id, session_date` …) vẫn dùng được. `deletedBy` chỉ cần ở users (bảng khác chỉ chủ TK xoá được) |
| Q15 | Khôi phục cả đợt "xoá chuỗi" | Không trong Q (khôi phục từng mục); các ca của một đợt có cùng `deletedAt` nên làm sau dễ | Người dùng chốt U3: để sau |
| Q16 | Phân trang Thùng rác | Server, 20/trang, sắp `deletedAt desc, id desc`; lọc 1 loại mỗi lần, có đếm từng loại | Theo mẫu màn Học sinh |

## 5. Học sinh: nghỉ vs xoá (chi tiết)

| | Đang học | Đã nghỉ (`isActive=false`) | Đã xoá (`isDeleted=true`) |
|---|---|---|---|
| Danh sách HS | Có | Lọc "Đã nghỉ"/"Tất cả" | Không (chỉ Thùng rác) |
| Chọn vào ca mới | Có | Không | Không |
| Ca đã có | Có | Ca chưa dạy bị gỡ khi bấm "Cho nghỉ" (hành vi cũ) | Link giữ nguyên nhưng không hiện ở đâu |
| Học phí / nợ / Tổng quan / báo cáo | Có | Có (P1 hiện nợ HS nghỉ) | Không |
| Giới hạn số HS của gói | Tính | Không tính | Không tính; khôi phục HS đang học phải còn chỗ (`assertCanActivateStudents`) |
| Link phụ huynh | Sống | Sống | 404; khôi phục là sống lại |
| Nâng lớp hàng năm | Có | Không | Không (`updateMany` thêm `isDeleted:false`) |
| Nhập Excel kiểm trùng | Trùng | Trùng (spec E D3) | Không coi là trùng |

## 5b. Cảnh báo khi xoá HS còn nợ (người dùng chốt U5)

- Bấm "Xoá" ở menu HS → client gọi `tuition.getMonthlyStatusReadOnly({ studentId, year, month, status: "all", page: 1, limit: 1 })` với **tháng hiện tại theo giờ VN**. Đây là đường đọc có sẵn, không ghi DB, cùng hàm tính với màn Học phí/Tổng quan. Số nợ = `isFullPaid ? 0 : max(0, totalAmountDue - paidAmount)` (đúng công thức `getMonthlyOutstanding`, đã gồm nợ lũy kế các tháng trước).
- Nợ > 0 → AlertDialog cảnh báo: tiêu đề "Xóa học sinh?", nội dung "Học sinh {tên} còn nợ {X}. Xoá sẽ ẩn học sinh khỏi Học phí, Tổng quan và báo cáo. Muốn cho nghỉ thì chọn Cho nghỉ." (X theo `formatCurrency`, vd `350.000 đ`). 3 nút: "Hủy", **"Cho nghỉ thay"** (outline, gọi `student.deactivate`, chỉ hiện khi HS đang học), "Xóa" (đỏ, gọi `student.delete`).
- Nợ = 0 hoặc HS không có dòng học phí → hộp xác nhận thường (chữ `delete_student_desc`).
- Đang tải số nợ → nút "Xóa" `disabled`, chữ "Đang kiểm tra…". Tải lỗi → hộp thường, vẫn cho xoá (không chặn vì lỗi mạng).
- Mọi gói gọi được (`getMonthlyStatusReadOnly` là `protectedProcedure`).

## 6. Học phí khi xoá / khôi phục

Nguyên tắc: **bản đã xoá coi như không tồn tại**; không ghi thêm gì lúc xoá ngoài cờ (trừ `paidAmount` của lần thu).

- **Xoá / khôi phục ca:** điểm danh của ca không còn tính (`totalSessions`, `presentSessions`, `currentMonthFee`) vì mọi truy vấn điểm danh lọc `session.isDeleted=false`. Snapshot `monthly_tuition` được tính lại ở lần đọc kế tiếp của màn Học phí (cơ chế `needsUpsert` sẵn có, kể cả tháng quá khứ) — giống hệt khi sửa điểm danh hôm nay. Tiền đã thu không đổi → có thể thành trả dư (số âm carry sang tháng sau như luật hiện có). Khôi phục → tính lại y như vậy.
- **Xoá / khôi phục lần thu:** `syncPaidAmount` chạy ngay trong transaction khoá tháng (`lockMonth`); aggregate lọc `isDeleted:false`.
- **Xoá HS:** HS biến khỏi Học phí/Tổng quan/Báo cáo; doanh thu và tiền đã thu của HS không cộng vào số tổng (báo cáo tháng cũ có thể giảm — đúng nghĩa "như chưa từng có"). Snapshot/Payment của HS không bị ghi. Khôi phục → hiện lại, số tính lại ở lần đọc.
- **Không cho** ghi tiền/tất toán/điểm danh cho HS/ca/lần thu đã xoá: các lệnh kiểm quyền `findUnique` trả `null` (extension) → `NOT_FOUND`.
- Báo cáo/Tổng quan đọc `monthly_tuition` qua quan hệ `student` → thêm `student: { userId, isDeleted: false }`.

## 7. Thùng rác giáo viên

- tRPC `trash` (router MỚI, `protectedProcedure`):
  - `trash.counts` → `{ session: number; student: number; payment: number; subject: number }`.
  - `trash.list({ type, page, limit })` → `{ items: TrashItemDTO[]; totalCount; totalPages }`, `TrashItemDTO` là union theo `type`, server trả field thô, client format (i18n, giờ VN): `session { sessionDate "YYYY-MM-DD", startTime "HH:mm", endTime, subjectName, title, isMakeup }`, `student { fullName, grade }`, `payment { amount, paidAt "YYYY-MM-DD", studentName, year, month }`, `subject { name, color }`; mọi loại có `id`, `deletedAt`.
  - `trash.restore({ type, id })` → `{ success: true }`; xung đột ném `TRPCError CONFLICT` với câu tiếng Việt.
- Luật khôi phục:
  - **Ca:** môn đang xoá → `CONFLICT "Môn {tên} đang ở Thùng rác. Hãy khôi phục môn trước."`; ca không huỷ → `checkOverlap` (câu "Trùng giờ với … đã có trong ngày này" sẵn có); ca là ca bù (`makeupOfId`) mà ca gốc đã xoá / không còn `cancelled` / đã có ca bù khác chưa xoá → `CONFLICT "Ca gốc không còn chờ ca bù nên không khôi phục được ca bù này."`.
  - **HS:** `isActive=true` → `assertCanActivateStudents(db, userId, 1)` (lỗi giới hạn gói sẵn có).
  - **Lần thu:** HS của lần thu đang xoá → `CONFLICT "Học sinh {tên} đang ở Thùng rác. Hãy khôi phục học sinh trước."`; khoá tháng + `syncPaidAmount`.
  - **Môn:** không có xung đột (tên vẫn được giữ, Q2).
  - Mục không thuộc user / không ở thùng rác → `NOT_FOUND`.
- UI `/trash`: tiêu đề "Thùng rác", dòng phụ "Mục đã xoá nằm ở đây cho tới khi bạn khôi phục. Không tự xoá."; hàng chip lọc 4 loại kèm số (chip ≥44px mobile, chọn = `primary`); `ResponsiveList` (bảng desktop, thẻ mobile); mỗi mục: nội dung chính, dòng phụ, "Xoá lúc dd/mm/yyyy HH:mm" (giờ VN), nút outline "Khôi phục" (`h-11 md:h-9`, icon `RotateCcw`); thành công → toast "Đã khôi phục"; lỗi → toast lỗi server. Trống → "Thùng rác trống". `DataTablePagination` khi > 20.
  - Ca: "T2 29/09/2025 · 18:00–19:30 · Toán" + tiêu đề ca/“Ca bù” nếu có; HS: "Nguyễn Văn A · Lớp 7"; Lần thu: "500.000 ₫ · Nguyễn Văn A" + "Thu ngày dd/mm/yyyy · tháng m/yyyy"; Môn: chấm màu + tên.

## 8. Admin xoá / khôi phục tài khoản

- `admin.deleteUser({ userId })`: không thấy / đã xoá → `NOT_FOUND`; admin (`isAdminUsername`) → `FORBIDDEN "Không xoá được tài khoản quản trị"`; `update { isDeleted: true, deletedAt: now, deletedBy: admin, sessionVersion: { increment: 1 } }` dùng `updateMany where { id, isDeleted: false }` (bấm 2 lần → lần 2 `NOT_FOUND`); `console.info("[admin] … xoá tài khoản …")`.
- `admin.restoreUser({ userId })`: `updateMany where { id, isDeleted: true }` → `{ isDeleted: false, deletedAt: null, deletedBy: null }`; count 0 → `NOT_FOUND`; log.
- `admin.deletedUsers` → `[{ id, username, fullName, deletedAt, deletedBy }]` sắp `deletedAt desc`.
- `admin.overview.users` + `pendingOrders` lọc `isDeleted:false`; guard NOT_FOUND ở `approveOrder`, `adminSetPlan`, `adminResetPassword`, `setUserTrialDays`.
- Menu "Hành động" (của P): thêm item cuối "Xoá tài khoản" (`Trash2`, `text-red-600`, `min-h-11 md:min-h-0`), chỉ dòng không phải admin; `DeleteAccountDialog` (AlertDialog) tiêu đề "Xoá tài khoản {username}?", nội dung "Tài khoản bị đăng xuất ngay, không đăng nhập được và link phụ huynh ngừng hoạt động. Dữ liệu giữ nguyên, khôi phục được ở tab Đã xoá."; nút đỏ "Xoá tài khoản".
- Ghi chú cho K (Tổng quan/Doanh thu admin): mọi số đếm tài khoản / học sinh / doanh thu theo tài khoản **lọc `users.is_deleted = false`**; đơn đã duyệt của tài khoản đã xoá vẫn là tiền đã thu (K tự quyết có tách không).

## 9. Phạm vi

### Trong phạm vi
Migration + schema; `src/server/soft-delete.ts` (MỚI, hằng + hàm lọc thuần); extension `db.ts`; sửa lọc ở `session.service`, `attendance.service`, `tuition.service`, `payment.service`, `report.service`, `backup.service`, `parent-link.service`, `tuition-notice.service`, `student.service`, `subject.service`, `plan-admin.service`, `password-reset.service`, `trial.service`, `auth-credentials.ts`; `trash.service.ts` + router `trash` (MỚI); admin router 3 procedure; UI: `StudentList` (Cho nghỉ + Xoá), `SubjectList` (Xoá), chữ dialog xoá ca/lần thu, `AdminAccounts` (tab + item Xoá), `DeleteAccountDialog`, `/trash` + `TrashList`, nav; i18n; test; `0.5.0`.

### Ngoài phạm vi
- **→ phần R** (làm riêng sau O, người dùng chốt U2): xoá vĩnh viễn, tự dọn thùng rác sau N ngày, nút "Xoá vĩnh viễn".
- Khôi phục cả đợt xoá chuỗi (U3: để sau); thùng rác cho link HS–ca (U1: không làm); admin xem dữ liệu tài khoản đã xoá (U4: không làm); index mới; `scripts/list-users.ts` hiện cột xoá.

## 10. Kiểm thử

- **Unit:** `tests/unit/server/soft-delete.test.ts` (hàm `withLiveFilter`: thêm cờ cho 4 model × thao tác đọc; không thêm khi `where` có `isDeleted`; không đụng `User`, không đụng thao tác ghi; `where` rỗng/undefined). Nav items. `TrashList`, `DeleteAccountDialog`, `AdminAccounts` (tab Đã xoá, item Xoá chỉ ở dòng giáo viên).
- **Integration:** migration SQL; mỗi service: xoá → biến khỏi danh sách/lịch/học phí/báo cáo/Tổng quan/backup/phụ huynh/kiểm trùng/chép lịch; ghi lên bản đã xoá → `NOT_FOUND`; khôi phục + từng xung đột; học phí tính lại sau xoá/khôi phục ca và lần thu; `syncSessionStudents` không xoá cứng link của HS đã xoá; admin xoá → `getSessionUserState` null, `authorizeCredentials` null, `registerUser` cùng tên báo trùng, phụ huynh 404, khôi phục → đăng nhập lại được; teacher gọi admin → FORBIDDEN; xoá admin → FORBIDDEN.
- **E2E:** xoá ca → Thùng rác → khôi phục → ca về lịch; xoá HS → khôi phục; admin xoá `teacher_std`-clone (user do test tạo) → context kia bị về `/login?expired=1`, đăng nhập báo sai → tab Đã xoá → Khôi phục → đăng nhập được. Mobile 390px không tràn, nút ≥44px. Sửa e2e cũ dùng "Xóa" HS (`students.spec.ts`, `mobile.spec.ts`, `tuition-mobile-en.spec.ts`) và dọn dữ liệu qua `student.delete` (giờ vào thùng rác — vẫn đúng mục đích dọn).

## 11. Rủi ro

| # | Rủi ro | Xử lý |
|---|---|---|
| R1 | Quên lọc ở truy vấn quan hệ / raw SQL → bản đã xoá lộ ra (vd HS đã xoá vẫn hiện trong ca, ca đã xoá vẫn tính tiền) | Extension phủ cấp cao; bảng "điểm cần sửa tay" trong plan + test integration từng màn; lệnh grep quét ở task cuối |
| R2 | Extension làm test cũ đọc bản đã xoá bị `null` | Chủ đích (test "xoá xong không còn" vẫn xanh); test cần đọc bản đã xoá dùng `isDeleted: true` |
| R3 | `syncSessionStudents` (sửa ca) xoá cứng link HS đã xoá → khôi phục HS mất ca | Lọc `student.isDeleted=false` ở cả `findMany` lẫn `deleteMany` trong hàm này (test riêng) |
| R4 | Đổi nghĩa nút "Xoá" HS: giáo viên quen "Xoá = nghỉ" bấm Xoá → HS còn nợ biến khỏi Học phí | Menu có "Cho nghỉ" riêng; dialog Xoá ghi rõ "biến khỏi lịch, học phí, báo cáo; khôi phục trong Thùng rác"; toast có chữ Thùng rác |
| R5 | Báo cáo tháng cũ đổi số khi xoá HS/ca | Chủ đích (mục 6); ghi vào ghi chú phát hành |
| R6 | Thùng rác phình vô hạn | Dữ liệu nhỏ; xoá vĩnh viễn làm ở phần R |
| R7 | Nâng `0.5.0` → mọi người đăng nhập lại 1 lần | Báo trước người dùng |

## 12. Migration

`prisma/migrations/<ts>_add_soft_delete/migration.sql` (Prisma sinh trên DB test), chỉ gồm:

```sql
ALTER TABLE "payments" ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subjects" ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "teaching_sessions" ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "deleted_by" VARCHAR(50), ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
```

Không destructive; `DEFAULT false` tự backfill (Postgres ≥ 11 không ghi lại bảng). Không `UPDATE`, không index, không đổi unique.

**Trước merge:** backup Neon (Branch from current, tên `backup-before-Q-soft-delete-<ngày>`); Vercel build tự `prisma migrate deploy`. Rollback: revert merge (code cũ không đọc cột mới; **nhưng** bản ghi đã xoá mềm lúc Q chạy sẽ hiện lại ở code cũ — ghi rõ khi rollback).

## 13. Người dùng đã chốt (2026-09-27)

| # | Câu hỏi | Chốt |
|---|---|---|
| U1 | Gỡ HS khỏi ca (và bỏ chọn HS khi sửa ca) có vào thùng rác? | Không (giữ xoá cứng link) |
| U2 | Xoá vĩnh viễn / tự dọn? | Không trong Q → **phần R** riêng, làm sau O |
| U3 | Khôi phục cả đợt "xoá chuỗi ca"? | Để sau |
| U4 | Admin xem dữ liệu tài khoản đã xoá? | Không |
| U5 | Nút học sinh | Tách "Cho nghỉ" + "Xoá" (mục 5), thêm cảnh báo khi HS còn nợ (mục 5b) |

Thực thi: các task do agent Antigravity "Gehihi" code theo plan (đọc `GEMINI.md`); plan phải tự chứa mọi ràng buộc an toàn.
