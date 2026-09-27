# M — Chép lịch dạy sang các tháng sau bằng 1 thao tác (theo lịch gốc)

> Phần M. Làm độc lập với K/L. Các câu hỏi U1–U5 đã được người dùng chốt ngày 2026-09-27 (mục 15). Chỉ thêm 1 luồng mới ở màn Lịch dạy + 1 feature gói `copyMonth` (Plus); **không** đổi luồng "Lịch lặp" (`BulkCreateDialog`), ca bù, điểm danh, học phí. **Không** migration.

## 1. Bối cảnh

Hiện trạng (đã đọc code):

- **Không có khái niệm lịch lặp/mẫu tuần trong DB.** `TeachingSession` (`prisma/schema.prisma`) là từng ca độc lập: `sessionDate` (`@db.Date`), `startTime`/`endTime` (`@db.Time(0)`), `subjectId`, `title`, `notes`, `status` (`scheduled` | `cancelled`), `cancelReason`, `cancelledAt`, `makeupOfId` (tự tham chiếu, `onDelete: SetNull`). Học sinh của ca nằm ở `SessionStudent` (`attendance` mặc định `pending`, `fee` và `grade` là **ảnh chụp** lúc thêm HS).
- **"Lớp" không phải 1 bảng.** Một "lớp" trong đầu giáo viên = 1 khung giờ lặp hằng tuần với cùng môn + cùng nhóm HS. Code hiện đã ngầm dùng khóa này: `bulkDeleteFutureSessions` / `bulkUpdateFutureSessions` (`src/server/services/session.service.ts`) nhận diện "chuỗi ca" bằng `subject_id + start_time + end_time + EXTRACT(DOW)`.
- **Lịch lặp hiện có** (`BulkCreateDialog` ← nút "Lịch lặp" trong `CalendarToolbar.tsx`; `session.bulkCreate` + `session.checkBulkConflicts`): tạo **1 chuỗi** (1 môn, 1 khung giờ, nhiều thứ) trong khoảng ngày. 8 lớp → phải mở dialog 8 lần mỗi tháng. Đây là nỗi đau người dùng nêu. (File `docs/09-bulk-session-management.md` được nhắc trong yêu cầu **không tồn tại**; tài liệu bulk nằm rải ở `docs/03-api.md`, `docs/04-frontend.md`.)
- **Ca bù** (`createMakeupSession`): ca gốc chuyển `status = "cancelled"` (giữ nguyên ngày/giờ/HS), ca bù là ca mới với `makeupOfId = id ca gốc`, ngày/giờ bất kỳ. `restoreSession` xóa ca bù và trả ca gốc về `scheduled`. Ca bị xóa hẳn (`deleteSession`) thì mất khỏi DB.
- **Trùng giờ**: `checkOverlap` bỏ qua ca `cancelled`. Nhưng `bulkCreateSessions`/`checkBulkCreateConflicts` lại **tính cả ca `cancelled`** là trùng (không lọc `status`) — không nhất quán (xem mục 14).
- **Học phí** (`calcStudentTuition`, `tuition.service.ts`): chỉ cộng `fee` của HS `present`/`late`; ca `cancelled` bị loại. `totalSessions` = số dòng `SessionStudent` của ca không huỷ trong tháng, **kể cả `pending`**.
- **Ngày/giờ**: `sessionDate` lưu `Date.UTC(y, m-1, d)` (ngày trần, không múi giờ), thứ trong tuần lấy bằng `getUTCDay()`; giờ lưu dạng giờ tường VN trong thành phần UTC (`parseTimeToDate`). "Hôm nay VN" có sẵn `vnDateParts()` (`src/lib/utils.ts`).
- **Gói**: `PLAN_FEATURES` (`src/lib/plans.ts`) xếp `schedule` vào Standard. Chặn server bằng `planProcedure(feature)` / `assertFeature`; client bằng `useFeatureGate` + `LockBadge` + `UpgradeDialog` (khóa chứ không ẩn). Nhãn tính năng ở `src/components/plan/feature-labels.ts` (`FEATURE_LABEL_KEY`).
- Khóa chống chạy song song theo user đã có tiền lệ: `pg_advisory_xact_lock(BigInt(userId))` trong `plan.service.ts`, `plan-admin.service.ts`, `student.service.ts`.

## 2. Mục tiêu và tiêu chí hoàn thành

- Ở màn Lịch dạy có nút **"Chép lịch tháng"** (desktop + mobile 390px, ≥44px). Bấm → chọn tháng nguồn + các tháng đích (1–3 tháng liên tiếp) → **xem trước** → xác nhận → tạo toàn bộ ca trong 1 lần.
- Ca được tạo theo **lịch gốc** của tháng nguồn: ca bị huỷ vẫn được tính là lịch gốc (tháng sau vẫn có); ca bù **không** được chép.
- Chạy lại lần 2 (hoặc tháng đích đã có ca tạo tay) **không** tạo trùng: ca đã có bị bỏ qua, báo số lượng.
- Ví dụ chuẩn: tháng 9 có 8 lớp (~65 ca, trong đó vài ca huỷ + bù) → chọn "Tháng 10 → Tháng 12" → xem trước ~195 ca → bấm Tạo → 3 tháng có đủ ca theo khung tuần gốc, HS đã nghỉ không bị gán.
- Chỉ gói Plus/Pro dùng được. Standard vẫn thấy nút, có ổ khóa, bấm mở `UpgradeDialog`; server chặn cả xem trước lẫn tạo. Bảng tính năng `/plan` thẻ Plus có dòng mới.
- Mobile 390px không tràn ngang (cả dialog). `pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch; `theme-legacy-colors` pass.

## 3. Yêu cầu người dùng (nguyên ý)

| # | Nội dung |
|---|---|
| M1 | Lặp lại lịch cả tháng bằng 1 thao tác (vd 8 lớp, 60–70 ca/tháng). |
| M2 | Ưu tiên **lịch gốc**: ca nghỉ/huỷ rồi dạy bù sang hôm khác → tháng sau vẫn theo lịch gốc (không chép ca bù, không bỏ ca vì tháng trước bị huỷ). |
| M3 | Tạo **nhiều tháng tiếp theo cùng lúc** (vd tháng 9 ổn → tạo luôn 10–12). |

## 4. "Lịch gốc" suy ra thế nào

### 4.1 So sánh phương án

| Phương án | Mô tả | Ưu | Nhược |
|---|---|---|---|
| **A. Suy từ tháng nguồn (chọn)** | Mỗi lần chép, đọc ca của tháng nguồn, nhóm thành "mẫu tuần", sinh ca cho tháng đích | Không migration; dùng được ngay với dữ liệu cũ; khớp khóa chuỗi ca mà code đã dùng (`subject + giờ + DOW`); giáo viên chỉnh tháng nguồn là chỉnh "mẫu" | Phải đoán với ca lẻ / lịch đổi giữa tháng → cần bước xem trước cho người dùng bỏ chọn |
| B. Bảng "mẫu lịch tuần" mới (`ScheduleTemplate` + HS) | Giáo viên lưu mẫu 1 lần, chép bao nhiêu tháng cũng được | Chính xác tuyệt đối, không phải đoán | Cần migration + backup Neon; thêm màn quản lý mẫu; mẫu và ca thật lệch nhau khi giáo viên sửa ca (đổi HS, đổi giờ) mà quên sửa mẫu — lỗi âm thầm; nhiều việc hơn hẳn |
| C. Chép nguyên ngày theo số ngày (15/9 → 15/10) | Copy từng ca sang cùng ngày tháng sau | Đơn giản nhất | Sai thứ trong tuần (lịch dạy thêm theo thứ); vỡ với ngày 31/tháng 2; chép cả ca bù — trái M2 |

**Chọn A.** Lý do: đúng M2 (loại ca bù bằng `makeupOfId`, giữ ca huỷ vì ca gốc vẫn nằm đúng slot), không migration, và bước xem trước có ô chọn từng mẫu xử lý được các trường hợp đoán sai. Nếu sau này cần mẫu cố định, B có thể xây trên cùng hàm sinh ca của A.

### 4.2 Thuật toán `deriveWeeklyPatterns` (thuần, `src/lib/copy-month.ts`)

Đầu vào: mọi ca của user có `sessionDate` trong tháng nguồn (ngày 1 → ngày cuối), kèm `sessionStudents.studentId`.

1. **Loại ca bù**: bỏ ca có `makeupOfId !== null`.
2. **Giữ ca huỷ**: ca `status = "cancelled"` vẫn tính (ca gốc nằm đúng slot lịch gốc). Không phân biệt huỷ có bù hay không bù.
3. **Khóa mẫu** `key = "${weekday}|${HH:mm start}|${HH:mm end}|${subjectId}"`, `weekday` = `(getUTCDay() + 6) % 7` (0 = T2 … 6 = CN, cùng quy ước `bulkCreate`).
4. Mỗi mẫu gom: `occurrences` (ngày, sắp tăng), `count`, `lastDate`, `latest` = lần xuất hiện **muộn nhất** (kể cả ca huỷ). Lấy từ `latest`: `title`, danh sách `studentIds`. **Không** lấy `notes` (Q6).
5. **Phân loại** (`lastDay` = ngày cuối tháng nguồn; "cửa sổ cuối tháng" = 14 ngày cuối, tức `lastDate.day ≥ lastDay − 13`):

| `kind` | Điều kiện (xét theo thứ tự) | Mặc định chọn | Nhãn trong xem trước |
|---|---|---|---|
| `single` | `count === 1` | Không | "Chỉ 1 buổi trong tháng" |
| `stopped` | `lastDate` trước cửa sổ cuối tháng | Không | "Không còn dạy sau dd/mm" |
| `biweekly` | `count ≥ 2` và mọi khoảng cách giữa 2 lần liên tiếp ≥ 14 ngày | Không | "Có vẻ dạy cách tuần — chỉ chép được hằng tuần" |
| `regular` | còn lại | **Có** | — |

6. Sau khi đối chiếu HS (mục 4.4): nếu `latest` có HS nhưng **tất cả** đã nghỉ → `kind = "no_students"`, mặc định không chọn, nhãn "Tất cả HS đã nghỉ". Ca gốc không có HS nào (được phép, như `bulkCreate` không `studentIds`) giữ nguyên loại.

Sắp xếp kết quả: `weekday`, rồi `startTime`.

### 4.3 Trường hợp lẻ

| Tình huống | Kết quả theo thuật toán |
|---|---|
| Ca huỷ + bù sang hôm khác | Ca gốc (huỷ) vẫn góp vào mẫu → tháng sau có đủ; ca bù bị loại (bước 1) |
| Ca huỷ **không** bù (ca bù đã bị xóa) | Vẫn tính (bước 2) |
| Ca bù mà ca gốc đã bị xóa (`makeupOfId` về `null` do `SetNull`) | Trông như ca thường, thường chỉ 1 lần → `single`, mặc định bỏ |
| Ca bị xóa hẳn (không huỷ) | Mẫu ít lần hơn; vẫn `regular` nếu còn ≥ 2 lần và còn trong cửa sổ cuối tháng |
| Ca học thêm lẻ / `duplicateSession` | `single`, mặc định bỏ |
| Lịch đổi giữa tháng (T3 17:00 tuần 1–2 → T5 17:00 tuần 3–4) | T3 = `stopped` (bỏ), T5 = `regular` (chọn) |
| Đổi giờ cùng thứ (17–19 → 18–20 từ tuần 3) | Hai khóa khác nhau; mẫu cũ `stopped`, mẫu mới `regular` |
| Đổi HS giữa tháng (thêm 1 HS từ tuần 3) | Cùng khóa; lấy danh sách HS của lần muộn nhất |
| Lớp mới mở tuần cuối (1 buổi) | `single` → mặc định bỏ, người dùng tự tích |
| Lớp cách tuần | `biweekly` → mặc định bỏ, có cảnh báo (M không hỗ trợ cách tuần) |
| Mẫu `stopped` và mẫu mới cùng thứ, giờ chồng nhau, người dùng tích cả hai | Mẫu sắp trước được tạo, mẫu sau bị tính "xung đột giờ" (mục 5.2) |

### 4.4 Học sinh trong ca mới

- Lấy `studentIds` của `latest`, lọc lại `student.findMany({ where: { id: { in }, userId, isActive: true } })`.
- HS `isActive = false` bị bỏ; xem trước ghi "Bỏ {n} HS đã nghỉ" trên mẫu đó.
- `fee` = `student.tuitionFee` **hiện tại**, `grade` = `student.grade` **hiện tại** (cùng cách `bulkCreateSessions`, `duplicateSession`). Nhờ vậy HS đã lên lớp/đổi khối, đổi học phí thì ca mới dùng số mới.

## 5. Sinh ca cho tháng đích (`planMonthCopy`, thuần, cùng file)

### 5.1 Tháng đích và ngày

- Tháng đích = `months` tháng liên tiếp bắt đầu từ `from` (`from` > tháng nguồn, `from` ≤ nguồn + 12, `months` 1..3).
- Với mỗi mẫu được chọn và mỗi tháng đích: duyệt **mọi ngày thật** của tháng (`new Date(Date.UTC(y, m, 0)).getUTCDate()`), lấy ngày có `weekday` khớp. Sinh theo thứ nên không bao giờ gặp ngày 31/tháng 2 không tồn tại; số buổi mỗi tháng có thể là 4 hoặc 5 (xem trước hiện đúng số).
- Ngày **trước hôm nay giờ VN** (`vnDateParts(now)`) bị bỏ, đếm `past` (Q5). Hôm nay vẫn tạo.

### 5.2 Trùng lặp và xung đột (idempotent, không hỏi)

Đọc mọi ca (mọi `status`) của user trong khoảng tháng đích. Với mỗi ca ứng viên theo thứ tự (ngày, giờ bắt đầu, key):

1. **`existing`**: đã có ca cùng `sessionDate + startTime + endTime` (bất kể môn, bất kể `status`) → bỏ qua. Bao gồm ca đã chép lần trước rồi bị giáo viên huỷ → chạy lại không "hồi sinh".
2. **`conflict`**: chồng giờ (`start < end' && end > start'`) với ca **không huỷ** đã có, hoặc với ứng viên đã nhận trước đó → bỏ qua, ghi lại (ngày, nhãn ca bị chồng như `checkBulkCreateConflicts`: `"title" (môn)` hoặc `Lớp {môn} (HH:mm–HH:mm)`). Ca huỷ khác giờ không chặn (khớp `checkOverlap`).
3. Còn lại → `create`.

Không hỏi từng ca: bỏ qua là hành vi an toàn và lặp lại được; người dùng thấy số `existing`/`conflict` ở xem trước trước khi bấm.

## 6. Quyết định tôi tự chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| Q1 | Nguồn lịch gốc | Suy từ tháng nguồn (phương án A) | Mục 4.1 |
| Q2 | Khóa mẫu | `weekday + startTime + endTime + subjectId` | Trùng khóa chuỗi ca `bulkDeleteFuture`/`bulkUpdateFuture` đang dùng; `checkOverlap` bảo đảm mỗi slot 1 ca không huỷ nên không cần thêm HS vào khóa |
| Q3 | Mẫu lẻ | Phân loại `regular` / `single` / `stopped` / `biweekly` / `no_students`; chỉ `regular` chọn sẵn; mọi mẫu đều hiện trong xem trước với ô chọn | Đoán sai thì người dùng sửa được bằng 1 chạm, không phải xóa ca sau |
| Q4 | Cửa sổ "còn dạy" | 14 ngày cuối tháng nguồn | Chịu được 1 tuần nghỉ (ca bị xóa) ở cuối tháng mà vẫn loại được lớp đã chuyển giờ từ giữa tháng |
| Q5 | Ngày đã qua trong tháng đích | Bỏ, đếm `past` (người dùng chốt U2) | Ca `pending` ở quá khứ làm bẩn điểm danh/báo cáo; thường người dùng chép trước khi sang tháng |
| Q6 | Chép gì từ ca mẫu | `subjectId`, giờ, `title`, HS đang học. **Không** chép `notes`, trạng thái, lý do huỷ | `notes` hay là ghi chú riêng buổi đó ("ôn chương 3") |
| Q7 | Trùng khi tháng đích đã có ca | Tự bỏ qua (`existing`/`conflict`), không hỏi | Idempotent, chạy 2 lần an toàn; số hiện ở xem trước |
| Q8 | Số tháng tối đa mỗi lần | **3 tháng liên tiếp (người dùng chốt U5)**; `from` tối đa nguồn + 12 | Đúng ví dụ người dùng (tháng 10–12) |
| Q9 | Trần số ca mỗi lần | 300 ca (`COPY_MONTH_MAX_SESSIONS`); vượt → `BAD_REQUEST` "Quá nhiều ca, hãy chọn ít tháng hơn" | 70 ca × 3 tháng = 210, còn dư; giữ transaction ngắn |
| Q10 | Chống bấm 2 lần / chạy song song | UI khóa nút khi `isPending`; server `pg_advisory_xact_lock` theo user **và** tính lại trùng **bên trong** transaction | Hai request song song vẫn không tạo trùng; tiền lệ `plan.service.ts` |
| Q11 | Khóa advisory | Dạng 2 khóa int4: `pg_advisory_xact_lock(${COPY_MONTH_LOCK_NS}::int, ${userId}::int)` | Không dùng chung khóa bigint `userId` với tạo đơn gói / thêm HS (Postgres tách không gian khóa 1×64 và 2×32) |
| Q12 | Xem trước là query hay mutation | `session.copyMonthPreview` là **query** (đọc thuần), nhận `patternKeys?`; đổi ô chọn → gọi lại (debounce 300ms) | Số xung đột giữa các mẫu phụ thuộc lựa chọn; tính ở server để khớp 100% lúc tạo |
| Q13 | Server có tin dữ liệu client không | Không. Mutation chỉ nhận tháng + `patternKeys`, tự đọc lại tháng nguồn và tính lại | Tránh ca giả / userId khác |
| Q14 | Gói | **Chỉ Plus/Pro (người dùng chốt U1)**. Feature MỚI `copyMonth`, gói tối thiểu `plus`. Standard vẫn thấy nút, có ổ khóa, bấm mở `UpgradeDialog` (khóa chứ không ẩn, như phần I) | Mục 9.5 |
| Q15 | Vị trí nút | Nút riêng "Chép lịch tháng" cạnh "Lịch lặp" (không gộp vào menu) | Người dùng than chính việc này; giấu trong menu thì khó thấy |
| Q16 | Tên nút | "Chép lịch tháng" (không dùng "Lặp lịch tháng") | Tránh nhầm với nút "Lịch lặp" (`bulk_schedule`) đang có |
| Q17 | Tháng nguồn mặc định | Tháng đang xem trên lịch; `from` mặc định = nguồn + 1; `months` mặc định 1 | Thao tác thường gặp nhất: đang xem tháng 9, chép sang tháng 10 |
| Q18 | Ngày lễ | Không tự bỏ (code không có dữ liệu ngày lễ). Sau khi tạo, giáo viên huỷ từng ca như hiện nay | Người dùng chốt U3 |
| Q19 | Sau khi tạo | Màn kết quả trong dialog + toast; nút "Xem tháng {from}" chuyển lịch sang tháng đích đầu tiên | Người dùng muốn kiểm tra ngay |
| Q20 | Transaction | 1 `$transaction` interactive, `timeout: 15000`: khóa → đọc lại → tính → `createManyAndReturn` ca → `sessionStudent.createMany` | `bulkCreate` đang dùng 5000ms cho 1 chuỗi; 300 ca + HS qua Neon sin1 cần dư |

## 7. Phạm vi

### Trong phạm vi
- Hàm thuần `src/lib/copy-month.ts`: `targetMonths`, `deriveWeeklyPatterns`, `planMonthCopy`.
- Service MỚI `src/server/services/session-copy.service.ts`: `previewCopyMonth`, `copyMonth`.
- Schema MỚI trong `src/lib/schemas/session.ts`; 2 procedure mới trong `src/server/trpc/routers/session.ts`.
- UI: nút ở `CalendarToolbar.tsx`, dialog MỚI `src/components/sessions/CopyMonthDialog.tsx`, nối ở `MonthCalendar.tsx`.
- Feature gói MỚI `copyMonth` (Plus trở lên) trong `src/lib/plans.ts` + `feature-labels.ts`; bảng tính năng `/plan` tự có dòng mới.
- i18n vi/en; unit + integration + e2e.

### Ngoài phạm vi (YAGNI)
- Bảng "mẫu lịch tuần" lưu trong DB (phương án B).
- Lịch cách tuần / 2 lần mỗi tháng; chọn bỏ từng ngày cụ thể (ngày lễ) trong xem trước (U3 đã chốt: không làm).
- Hoàn tác cả lô sau khi tạo (U4 đã chốt: không có); giáo viên dùng "Xóa các ca tương lai cùng chuỗi" đang có (`session.deleteFuture`).
- Sửa `bulkCreate` tính ca huỷ là trùng; đồng bộ `grade` khi lên lớp hàng loạt (mục 14, chỉ ghi nhận).
- Đổi `BulkCreateDialog`, ca bù, điểm danh, học phí.

## 8. Giao diện

Màu theo A3: nhấn `primary` (#0F766E), trung tính slate, cảnh báo amber, xung đột đỏ nhạt. Không indigo/violet/purple. Vùng chạm `h-11 md:h-10` (≥44px ở mobile).

### 8.1 Nút ở màn Lịch (`CalendarToolbar.tsx`)

- Prop MỚI `onCopyMonthClick: () => void`. Nút `variant="outline"`, icon `CalendarPlus` (lucide), chữ `t("copy_month")` "Chép lịch tháng", `data-testid="copy-month-button"`, class như nút "Lịch lặp" (`h-11 md:h-10`).
- Desktop: đặt ngay sau nút "Lịch lặp" trong nhóm trái của hàng hành động; bố cục còn lại giữ nguyên.
- Mobile 390px: hàng hành động hiện là `flex-wrap` với 3 nút (Xuất Excel, Lịch lặp, Tạo ca dạy) đã gần kín. Dưới `md` đổi khối hành động thành `grid grid-cols-2 gap-2` (từ `md` trở lên giữ `flex` như cũ): hàng 1 = Lịch lặp | Chép lịch tháng; hàng 2 = Xuất Excel | Tạo ca dạy; mỗi nút `w-full md:w-auto`.
- Ghi nhận: `ExportExcelButton` đang `size="sm"` (<44px). Chỉ chỉnh chiều cao (thêm prop `className`) nếu grid làm lệch hàng; không đụng logic.

### 8.2 `CopyMonthDialog` (MỚI, `src/components/sessions/CopyMonthDialog.tsx`)

Props: `{ open, onOpenChange, initialYear, initialMonth, onViewMonth(year, month) }`. `Dialog` shadcn, `data-testid="copy-month-dialog"`, tiêu đề `copy_month_title` "Chép lịch sang tháng sau". Kích thước như popup mua gói của J: mobile `h-[100dvh] w-full max-w-none rounded-none overflow-y-auto`; desktop `md:h-auto md:max-h-[90dvh] md:max-w-2xl md:rounded-xl`. Nút đóng ≥44px. State `step: "setup" | "result"`, reset mỗi lần mở.

**Bước `setup`** (một màn, xem trước tự tải bên dưới):

1. **Tháng nguồn** — `Select` `data-testid="copy-source"`: 12 tháng trước tháng hiện tại (giờ VN) tới tháng hiện tại + 6; mặc định tháng đang xem trên lịch. Dòng phụ `copy_source_hint` "Lấy lịch gốc: ca bị huỷ vẫn tính, ca dạy bù không chép".
2. **Tạo cho** — `Select` "Từ tháng" `data-testid="copy-from"` (nguồn+1 … nguồn+12, mặc định nguồn+1) và nhóm `role="radiogroup"` 3 nút `1 | 2 | 3` tháng (`data-testid="copy-months-{n}"`, ≥44px, đang chọn viền + chữ `primary`). Dòng tóm tắt "Tháng 10/2026 → Tháng 12/2026". Đổi nguồn → `from` tự về nguồn+1.
3. **Xem trước** (`data-testid="copy-preview"`): `trpc.session.copyMonthPreview.useQuery(input, { enabled: open, placeholderData: keepPreviousData })`; `patternKeys` gửi kèm sau khi người dùng đã chạm ô chọn (debounce 300ms). Lần đầu không gửi → server chọn mặc định theo `kind`.
   - Thẻ tổng: chữ lớn "Sẽ tạo **{created}** ca"; dưới là các dòng nhỏ chỉ hiện khi > 0: "{existing} ca đã có, bỏ qua", "{conflict} ca trùng giờ, bỏ qua" (amber), "{past} ngày đã qua, bỏ qua".
   - Theo tháng: mỗi tháng đích 1 dòng "Tháng 10: 64 ca".
   - Danh sách mẫu, nhóm theo thứ (T2 … CN). Mỗi mẫu là 1 hàng `label` bọc `Checkbox` (cả hàng bấm được, `min-h-11`), `data-testid="copy-pattern"`:
     - Dòng 1: "T3 · 17:00–19:00", chấm màu môn + tên môn, `title` nếu có.
     - Dòng 2: "{n} HS" (+ "· bỏ {k} HS đã nghỉ"), số ca mỗi tháng đích ("T10: 4 · T11: 4 · T12: 5").
     - Pill loại cho `single` / `stopped` / `biweekly` / `no_students` (mục 4.2), nền amber-50 chữ amber-800.
     - Có `conflict` → dòng đỏ nhạt "Trùng giờ {k} ca" + nút nhỏ mở danh sách (ngày + ca bị chồng, tối đa 20 dòng).
   - Tháng nguồn không có ca (sau khi loại ca bù) → trạng thái rỗng `copy_empty` "Tháng {month} chưa có ca nào để chép", nút xác nhận khóa.
   - Đang tải lần đầu: `Skeleton`.
4. **Chân dialog** (mobile `sticky bottom-0` nền trắng có viền trên): "Hủy" (outline) + nút chính `bg-primary` `h-11 md:h-10` "Tạo {created} ca" (`copy_confirm`, `data-testid="copy-confirm"`). Khóa khi `created === 0`, đang tải xem trước, hoặc mutation `isPending` (hiện `Loader2`). Không có hộp xác nhận thứ hai (xem trước đã là bước xác nhận).

**Bước `result`** (`data-testid="copy-result"`): icon `CheckCircle2` màu `primary`, "Đã tạo {created} ca", từng tháng "Tháng 10: 64 ca", các dòng bỏ qua như trên. Nút "Xem tháng {from}" → `onViewMonth(from.year, from.month)` (MonthCalendar chuyển tháng qua `useCalendar`) rồi đóng; nút "Đóng". Toast `copy_success`. Lịch tự làm mới nhờ `MutationCache` trong `TRPCProvider`.

Lỗi server (vượt trần, `BAD_REQUEST`) → toast `err.message`, ở lại `setup`, xem trước tự gọi lại.

## 9. Backend

### 9.1 Schema (`src/lib/schemas/session.ts`)

Hình dạng (so sánh tháng bằng `year * 12 + month`):

```ts
const monthRefSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})
export const sessionCopyMonthPreviewSchema = z
  .object({
    source: monthRefSchema,
    from: monthRefSchema,
    months: z.number().int().min(1).max(3),
    patternKeys: z.array(z.string().max(40)).max(200).optional(), // không có = chọn mặc định theo kind
  })
  .refine(/* source < from <= source + 12 */)
export const sessionCopyMonthSchema = /* như trên nhưng patternKeys bắt buộc, min(1) */
```

### 9.2 Hàm thuần (`src/lib/copy-month.ts`, không import Prisma)

- `targetMonths(from, months): { year; month }[]` (cuộn năm).
- `deriveWeeklyPatterns(sessions: SourceSession[], year, month): WeeklyPattern[]` — mục 4.2.
  - `SourceSession = { sessionDate: Date; startTime: string; endTime: string; subjectId: number; title: string | null; status: string; makeupOfId: number | null; studentIds: number[] }` (giờ đã qua `formatTime`).
  - `WeeklyPattern = { key; weekday; startTime; endTime; subjectId; title; studentIds; count; lastDate; kind }`.
- `planMonthCopy({ patterns, selectedKeys, targets, existing, today })` → `{ candidates, perPattern, conflicts, totals }` — mục 5. `existing = { sessionDate; startTime; endTime; status; label }[]`; `today` = ngày VN dạng `Date.UTC`.
- Hằng: `COPY_MONTH_MAX_MONTHS = 3`, `COPY_MONTH_MAX_SESSIONS = 300`, `COPY_MONTH_WINDOW_DAYS = 14`.
- `kind = "no_students"` gán ở service (cần biết HS còn học), hàm thuần nhận thêm `activeStudentIds: Set<number>` để làm việc này — giữ toàn bộ luật phân loại ở 1 chỗ, test được bằng unit.

### 9.3 Service (`src/server/services/session-copy.service.ts`)

- `loadCopyContext(db | tx, userId, input)`:
  1. Ca tháng nguồn: `where: { userId, sessionDate: { gte, lt } }`, `select` `sessionDate, startTime, endTime, subjectId, title, status, makeupOfId, subject { name, color }, sessionStudents { studentId }`.
  2. HS: `student.findMany({ where: { userId, isActive: true, id: { in: allStudentIds } }, select: { id, tuitionFee, grade } })`.
  3. Ca tháng đích (mọi `status`): `select` `sessionDate, startTime, endTime, status, title, subject { name }`.
  4. `today` = `Date.UTC` của `vnDateParts(new Date())`.
- `previewCopyMonth(db, userId, input)` → `{ patterns: PatternPreview[]; months: { year; month; created }[]; totals: { created; existing; conflict; past }; conflicts: ConflictItem[] (≤ 50) }`. `PatternPreview = { key, weekday, startTime, endTime, subject { id, name, color }, title, studentCount, droppedInactive, kind, lastDate, selected, perMonth: { year, month, created, existing, conflict, past }[] }`.
- `copyMonth(db, userId, input)`:
  1. `db.$transaction(async (tx) => { … }, { timeout: 15000 })`.
  2. `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(${COPY_MONTH_LOCK_NS}::int, ${userId}::int)\``.
  3. `loadCopyContext(tx, …)` → `deriveWeeklyPatterns` → `planMonthCopy` với `patternKeys` gửi lên (key không có trong mẫu → bỏ; không còn key hợp lệ → `BAD_REQUEST`).
  4. `candidates.length > COPY_MONTH_MAX_SESSIONS` → `BAD_REQUEST` `copy_too_many` (tiếng Việt như các lỗi service khác) **trước** khi ghi.
  5. `candidates.length === 0` → trả kết quả 0, không ghi.
  6. `tx.teachingSession.createManyAndReturn({ data: candidates.map(c => ({ userId, sessionDate: c.sessionDate, startTime: parseTimeToDate(c.startTime), endTime: parseTimeToDate(c.endTime), subjectId: c.subjectId, title: c.title, notes: null })) })`.
  7. Ghép ca trả về với ứng viên theo `sessionDate + startTime` (duy nhất trong lô vì đã chống chồng giờ), `tx.sessionStudent.createMany({ data })` với `fee = tuitionFee`, `grade` hiện tại.
  8. Trả `{ created, months: [{ year, month, created }], skipped: { existing, conflict, past } }`.
- Phân quyền: mọi truy vấn lọc `ctx.userId`; môn lấy từ chính ca của user nên không cần `assertSubjectOwned`; HS lọc `userId + isActive`. Không nhận `subjectId`/`studentIds` từ client.
- `COPY_MONTH_LOCK_NS` là hằng int trong service, ghi chú 1 dòng: "dạng 2 khóa int4 để không chung khóa bigint userId của plan/student".

### 9.4 Router (`src/server/trpc/routers/session.ts`)

- `copyMonthPreview: planProcedure("copyMonth").input(sessionCopyMonthPreviewSchema).query(({ ctx, input }) => previewCopyMonth(ctx.db, ctx.userId, input))`.
- `copyMonth: planProcedure("copyMonth").input(sessionCopyMonthSchema).mutation(({ ctx, input }) => copyMonth(ctx.db, ctx.userId, input))`.
- `planProcedure` (`src/server/trpc/index.ts`) gọi `assertFeature` → Standard nhận lỗi gói (`PlanRequiredError`) ở **cả** xem trước lẫn mutation.

### 9.5 Chặn theo gói (người dùng chốt U1: chỉ Plus/Pro)

Theo mẫu "khóa chứ không ẩn" của phần I:

- `src/lib/plans.ts`:
  - `FEATURE_PLAN` thêm `copyMonth: "plus"`.
  - `PLAN_FEATURES` thêm `{ id: "copyMonth", plan: FEATURE_PLAN.copyMonth }`, đặt ngay sau dòng `monthlyReport` (nhóm Plus). Nhờ vậy `featuresAddedIn("plus")` có thêm `copyMonth` → thẻ Plus trong bảng so sánh `/plan` (`PlanCompare`) và danh sách "Mọi thứ của gói Standard, thêm:" trong `PlanPurchaseDialog` tự hiện dòng mới; thẻ Pro kế thừa.
- `src/components/plan/feature-labels.ts`: `FEATURE_LABEL_KEY.copyMonth = "plan_feat_copy_month"` (bắt buộc, vì kiểu `Record<PlanFeatureId, …>` sẽ báo lỗi nếu thiếu).
- `CalendarToolbar.tsx`: `const gate = useFeatureGate("copyMonth")`. Nút "Chép lịch tháng" luôn hiện; `gate.locked` → gắn `<LockBadge plan={gate.requiredPlan} />` cạnh chữ; `onClick={gate.guard(onCopyMonthClick)}` → Standard bấm là mở `UpgradeDialog` (gói Plus), không mở `CopyMonthDialog`.
- `CopyMonthDialog`: query xem trước dùng `enabled: open && gate.allowed` — **không** gọi khi chưa biết gói hoặc không đủ gói (tránh `FORBIDDEN` như ghi chú trong `useFeatureGate`).
- Hết hạn gói giữa chừng (dialog đang mở, server trả lỗi gói) → toast lỗi + đóng dialog; lần bấm sau `gate.locked` đã đúng.
- Standard vẫn dùng được "Lịch lặp" (`BulkCreateDialog`) như cũ — không chặn.

## 10. Dữ liệu, migration, học phí

- **Không migration**, không đổi `prisma/schema.prisma` → không cần backup Neon cho M.
- Ca mới: `status = "scheduled"`, `makeupOfId = null`, `cancelReason/cancelledAt = null`, `notes = null`. `SessionStudent.attendance = "pending"` (mặc định DB), `fee`/`grade` = giá trị hiện tại của HS.
- **Học phí**: `currentMonthFee` chỉ cộng HS `present`/`late` → ca mới **không** làm tăng tiền phải thu cho tới khi điểm danh. `totalSessions` (hiện ở `TuitionDetailSheet` dạng "({present}/{total} buổi)") **tăng ngay** vì đếm cả `pending` — giống hệt sau khi dùng "Lịch lặp" hôm nay; snapshot `MonthlyTuition` tháng đích được ghi lại ở lần đọc kế tiếp (`needsUpsert`). Không đổi logic này.
- Tổng quan/báo cáo: chỉ số đếm ca không huỷ của tháng đích (số ca tháng, doanh thu dự kiến ở `report.service.ts`) có thêm ca mới — đúng ý (lịch dự kiến).

## 11. i18n

Thêm vào `src/language/vi.json` và `src/language/en.json` (cùng bộ key, không gạch dài):

| Key | vi | en |
|---|---|---|
| `copy_month` | Chép lịch tháng | Copy month |
| `copy_month_title` | Chép lịch sang tháng sau | Copy schedule to next months |
| `copy_source` | Tháng nguồn | Source month |
| `copy_source_hint` | Lấy lịch gốc: ca bị huỷ vẫn tính, ca dạy bù không chép | Uses the original schedule: cancelled sessions count, make-up sessions are skipped |
| `copy_target` / `copy_from` / `copy_months_count` | Tạo cho / Từ tháng / Số tháng | Create for / From / Months |
| `copy_will_create` | Sẽ tạo {count} ca | {count} sessions will be created |
| `copy_skip_existing` | {count} ca đã có, bỏ qua | {count} already exist, skipped |
| `copy_skip_conflict` | {count} ca trùng giờ, bỏ qua | {count} time conflicts, skipped |
| `copy_skip_past` | {count} ngày đã qua, bỏ qua | {count} past days, skipped |
| `copy_kind_single` | Chỉ 1 buổi trong tháng | Only once this month |
| `copy_kind_stopped` | Không còn dạy sau {date} | Not taught after {date} |
| `copy_kind_biweekly` | Có vẻ dạy cách tuần, chỉ chép được hằng tuần | Looks biweekly, only weekly copy is supported |
| `copy_kind_no_students` | Tất cả HS đã nghỉ | All students inactive |
| `copy_dropped_inactive` | bỏ {count} HS đã nghỉ | {count} inactive students removed |
| `copy_conflict_count` | Trùng giờ {count} ca | {count} time conflicts |
| `copy_empty` | Tháng {month} chưa có ca nào để chép | Month {month} has no sessions to copy |
| `copy_confirm` | Tạo {count} ca | Create {count} sessions |
| `copy_success` | Đã tạo {count} ca | Created {count} sessions |
| `copy_view_month` | Xem tháng {month} | View month {month} |
| `plan_feat_copy_month` | Chép lịch sang tháng sau (tối đa 3 tháng) | Copy schedule to next months (up to 3) |
| `copy_too_many` | Quá nhiều ca, hãy chọn ít tháng hơn | Too many sessions, choose fewer months |

Dùng lại: `cancel`, `close`, `DAY_NAMES`, `month_year_label`, `sessions`.

## 12. Kiểm thử

Chỉ chạy trên `.env.test` (Postgres local Docker `localhost:5433`), theo `docs/coding-rule.md` §6.1. Không chạy trên prod; nếu cần thử prod chỉ dùng `qa_test` (id=4).

### Unit — `tests/unit/lib/copy-month.test.ts` (MỚI)
- `deriveWeeklyPatterns`:
  - 4 tuần đủ T2/T4 → 2 mẫu `regular`, đúng `weekday`, giờ, `count`.
  - Ca huỷ (có ca bù ở thứ khác) vẫn góp vào mẫu gốc; ca bù (`makeupOfId`) không tạo mẫu.
  - Ca huỷ không có ca bù vẫn tính.
  - 1 lần duy nhất → `single`; lịch đổi giữa tháng (T3 tuần 1–2, T5 tuần 3–4) → T3 `stopped`, T5 `regular`.
  - Cách tuần (ngày 2, 16, 30) → `biweekly`; tuần lỡ 1 buổi (1, 8, 22, 29) → `regular`.
  - Đổi HS tuần 3 → `studentIds` + `title` lấy từ lần muộn nhất; kết quả không có `notes`.
  - Toàn HS không còn trong `activeStudentIds` → `no_students`; ca không HS → giữ loại.
  - Tháng 2 (nhuận/không nhuận): cửa sổ 14 ngày tính theo ngày cuối thật.
  - Thứ lấy theo `getUTCDay` của `Date.UTC` — chạy đúng dù TZ máy là `Asia/Ho_Chi_Minh`.
- `planMonthCopy`:
  - Đúng số ngày theo thứ cho tháng 4 vs 5 lần; không sinh ngày ngoài tháng.
  - `existing` cùng slot (kể cả `cancelled`) → `existing`; chồng giờ với ca không huỷ → `conflict` có nhãn; chồng với ca huỷ khác giờ → vẫn tạo.
  - Hai mẫu được chọn chồng giờ cùng thứ → mẫu sau `conflict`.
  - Ngày < `today` → `past`; đúng `today` vẫn tạo.
  - Nhiều tháng qua năm (11/2026 → 1/2027).
  - Chỉ sinh cho `selectedKeys`; không có `selectedKeys` → theo `kind === "regular"`.
- `targetMonths`: cuộn năm, `months` 1..3.
- Schema (`tests/unit/schemas/`): `from ≤ source`, `from > source + 12`, `months = 0/4`, `patternKeys: []` ở mutation → lỗi.

### Integration — `tests/integration/session-copy-month.test.ts` (MỚI)
Dùng tháng xa (vd 1/2030) để không dính `past`.
- Preview mặc định: đúng `patterns`, `selected` theo `kind`, `totals.created`, `perMonth`.
- `copyMonth` 1 tháng: số ca; HS gán đúng; `attendance = "pending"`; `fee`/`grade` = giá trị **hiện tại** (đổi `tuitionFee` sau khi tạo tháng nguồn → ca mới lấy số mới); `notes` null; `status` scheduled; `makeupOfId` null.
- Ca bù ở tháng nguồn không được chép; ca huỷ ở tháng nguồn vẫn có ca tương ứng ở tháng đích.
- HS `isActive = false` bị bỏ; mẫu toàn HS nghỉ → `no_students`, không chọn mặc định.
- **Idempotent**: gọi 2 lần → lần 2 `created = 0`, `skipped.existing` = số lần 1, tổng ca DB không đổi. Huỷ 1 ca đã chép rồi chạy lại → không tạo lại ca đó.
- Tháng đích có ca tạo tay chồng giờ → `conflict`, ca tay giữ nguyên.
- 3 tháng → `months[]` đúng từng tháng; qua năm.
- **Song song**: `Promise.all([copyMonth(x), copyMonth(x)])` → tổng ca = 1 lần.
- Vượt trần (>300) → `BAD_REQUEST`, không có ca nào được tạo.
- Key lạ bị bỏ qua; toàn key lạ → `BAD_REQUEST`.
- **Multi-tenant**: user B chép tháng của mình không kéo ca của user A; ca của A ở tháng đích không làm B bị `existing`/`conflict`; HS của A không lọt vào ca của B.
- **Gói** (thêm vào `tests/integration/plan-gating.test.ts` hoặc file mới): `teacher_std` (Standard) gọi `copyMonthPreview` và `copyMonth` → lỗi gói (`FORBIDDEN`/`PlanRequiredError` như các feature khác), không tạo ca nào; user Plus và Pro (trả phí hoặc trial) → được.
- Unit `tests/unit/lib/plans.test.ts`: `featuresAddedIn("plus")` chứa `copyMonth`; `FEATURE_PLAN.copyMonth === "plus"`.

### E2E — `tests/e2e/copy-month.spec.ts` (MỚI)
Seed qua `tests/helpers/db.ts`: tháng nguồn 1/2030 cho `teacher` có 3 mẫu `regular`, 1 ca huỷ + ca bù, 1 ca `single`. Dọn dữ liệu 2030 ở `afterAll`.
- Người dùng e2e chính là `teacher` (Pro, đủ gói).
- **Desktop 1280px**: vào `/calendar`, tới tháng 1/2030; `copy-month-button` hiện; mở dialog → `copy-source` là tháng đang xem, `copy-from` = tháng 2/2030; `copy-preview` có đủ mẫu, mẫu `single` không tích; chọn `copy-months-3` → "Sẽ tạo" tăng đúng; bấm `copy-confirm` → `copy-result` "Đã tạo"; "Xem tháng" → lịch hiện 2/2030 có ca đúng thứ của ca gốc (kể cả thứ của ca đã huỷ), không có ca ở thứ của ca bù. Mở lại, chạy lại → "Sẽ tạo 0 ca", `copy-confirm` bị khóa, có dòng "… ca đã có, bỏ qua".
- **Mobile 390px**: `copy-month-button`, "Lịch lặp", "Tạo ca dạy" đều cao ≥44px và không chồng nhau; dialog toàn màn hình; mọi nút/ô chọn trong dialog ≥44px; `scrollWidth ≤ 390` khi dialog mở; `copy-confirm` thấy được (sticky) và tạo thành công.
- **Khóa gói**: đăng nhập `teacher_std` (Standard) → nút `copy-month-button` vẫn hiện, có `LockBadge`; bấm → `UpgradeDialog` hiện, `copy-month-dialog` **không** mở; không có request `session.copyMonthPreview` (theo dõi `page.on('request')`). `/plan` thẻ Plus có dòng "Chép lịch sang tháng sau".
- Chạy lại `plan.spec.ts`, `plan-locks.spec.ts` (bảng tính năng có thêm 1 dòng) và `calendar.spec.ts`, `mobile.spec.ts`, `layout-desktop.spec.ts` để chắc bố cục toolbar mới không vỡ selector cũ.

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build`, `theme-legacy-colors` sạch.

## 13. Review Focus

- **Lịch gốc đúng M2**: ca bù bị loại bằng `makeupOfId`, ca huỷ vẫn tính; không có đường nào chép ca bù.
- **Idempotent + song song**: tính trùng **trong** transaction, sau khóa advisory; khóa dạng 2 int4, không chung khóa bigint của `plan.service`/`student.service`.
- **Ngày/múi giờ**: chỉ `Date.UTC` + `getUTCDay`; "hôm nay" qua `vnDateParts`; không dùng giờ máy (`getDate()`, `dayjs()` không UTC) ở server.
- **Chồng giờ**: ca huỷ khác giờ không chặn (khớp `checkOverlap`); cùng slot kể cả huỷ → `existing`.
- **Gói**: cả `copyMonthPreview` và `copyMonth` là `planProcedure("copyMonth")`; client không gọi query khi `!gate.allowed`; Standard thấy nút có khóa (không ẩn).
- **Multi-tenant**: mọi `findMany` có `userId`; HS lọc `userId + isActive`; không nhận `subjectId`/`studentIds` từ client.
- **Transaction**: ca + HS cùng tx; trần 300 kiểm **trước** khi ghi; `timeout` đủ; preview và mutation dùng chung đúng 1 hàm thuần.
- **UI 390px**: grid 2 cột của toolbar không làm lệch nút cũ; dialog không tràn; nút ≥44px; màu `primary`, không indigo/violet.
- **Không đổi hành vi cũ**: `bulkCreate`, `checkBulkConflicts`, ca bù, học phí giữ nguyên.

## 14. Rủi ro và điều bất ngờ trong code

| Rủi ro | Xử lý |
|---|---|
| Đoán sai mẫu (ca lẻ bị chép thành hằng tuần, lớp mới bị bỏ) | Chỉ `regular` chọn sẵn; mọi mẫu hiện kèm nhãn + ô chọn; xem trước bắt buộc trước khi tạo |
| Lớp cách tuần bị chép thành hằng tuần | `biweekly` mặc định bỏ + cảnh báo |
| Chép nhầm nhiều tháng, muốn gỡ | Idempotent nên không nhân đôi; gỡ bằng "Xóa ca tương lai cùng chuỗi" (`session.deleteFuture`) từng lớp. Không có hoàn tác cả lô (U4 đã chốt) |
| Transaction lâu trên Neon sin1 | 1 `createManyAndReturn` + 1 `createMany`; trần 300; `timeout: 15000` |
| **Bất ngờ 1**: `bulkCreateSessions`/`checkBulkCreateConflicts` coi ca `cancelled` là trùng giờ, còn `checkOverlap` thì không | M theo `checkOverlap`. Không sửa `bulkCreate` trong M; đề xuất ghi backlog |
| **Bất ngờ 2**: `upgradeAllClasses` (tự chạy khi đăng nhập từ tháng 7, `routers/auth.ts`) tăng `student.grade` bằng `updateMany` nhưng **không** đồng bộ `SessionStudent.grade` của ca tương lai, và HS lớp 12 bị cho nghỉ vẫn nằm trong ca tương lai (khác `updateStudent`/`softDeleteStudent`) | Chép tháng 6 → 7–9 trước khi lên lớp sẽ mang `grade` cũ + HS lớp 12. "Lịch lặp" đã có vấn đề này từ trước. Ngoài phạm vi M; đề xuất ghi backlog |
| **Bất ngờ 3**: `softDeleteStudent` và đồng bộ `grade` trong `updateStudent` lấy "hôm nay" theo UTC và so `endTime` (giờ tường VN) với `Date.now()` UTC → lệch 7 giờ | Ngoài phạm vi M; đề xuất ghi backlog |
| **Bất ngờ 4**: `docs/09-bulk-session-management.md` được `docs/CLAUDE.md` liệt kê nhưng **không tồn tại** | Spec này không phụ thuộc file đó |
| `ExportExcelButton` `size="sm"` < 44px ở mobile | Chỉ chỉnh chiều cao nếu grid mới làm lệch (mục 8.1) |

## 15. Câu hỏi cho người dùng — ĐÃ CHỐT (2026-09-27)

| # | Câu hỏi | Người dùng chốt |
|---|---|---|
| U1 | Tính năng cho gói nào? | **ĐÃ CHỐT: chỉ Plus/Pro.** Standard thấy nút có ổ khóa, bấm mở `UpgradeDialog`; server `planProcedure("copyMonth")` cho cả xem trước và mutation (mục 9.5) |
| U2 | Ngày đã qua trong tháng đích: bỏ qua hay vẫn tạo? | **ĐÃ CHỐT: bỏ qua** (Q5) |
| U3 | Bỏ ngày lễ ngay trong xem trước, hay huỷ từng ca sau? | **ĐÃ CHỐT: huỷ từng ca sau** (Q18), không làm chọn ngày lễ |
| U4 | Có nút "Hoàn tác lần chép vừa rồi" không? | **ĐÃ CHỐT: không có hoàn tác** |
| U5 | Tối đa bao nhiêu tháng mỗi lần? | **ĐÃ CHỐT: 3 tháng liên tiếp**; trần 300 ca/lần (Q8, Q9) |
