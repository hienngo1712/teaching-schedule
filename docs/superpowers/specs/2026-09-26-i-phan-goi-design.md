# I — Phân gói Standard / Plus / Pro

> Phần I, làm sau H (spec `2026-09-26-h-them-cap-3-design.md`), giả định H đã merge (lớp 1–12, `report.monthlySummary.grade` là `max(12)`). Đụng tới B (payment), C (phiếu báo), D (cảnh báo), E (nhập Excel), G (link phụ huynh) chỉ ở chỗ chặn quyền, không đổi nghiệp vụ của chúng.

## 1. Bối cảnh

App đang cho mọi tài khoản dùng đủ tính năng. Chủ app muốn thu phí theo 3 gói, thu tiền bằng chuyển khoản thủ công (VietQR tới tài khoản chủ app), admin tự bật gói. Hiện:

- `User` (`prisma/schema.prisma`) không có trường gói/hạn; không có khái niệm admin.
- Mọi procedure dùng `protectedProcedure` (`src/server/trpc/index.ts`), chỉ kiểm đăng nhập.
- JWT (`src/server/auth.config.ts`) chỉ mang `userId/username/fullName`, sống 8 giờ, nên gói **không** được đặt trong token (đổi gói phải có hiệu lực ngay).
- Đã có sẵn đồ dùng lại được: `buildVietQrPayload` (`src/lib/vietqr.ts`), `findBank` (`src/lib/vn-banks.ts`), `toDataURL` của `qrcode` (cách làm trong `TuitionNoticeCard.tsx`), `vnDateParts` (`src/lib/utils.ts`), `formatVnDate` (`src/lib/payment-notes.ts`).

## 2. Mục tiêu và tiêu chí hoàn thành

- Mỗi tài khoản có **gói hiệu lực** tính từ DB theo giờ VN; server chặn đúng từng procedure theo bảng mục 6.3, UI khóa đúng chỗ theo mục 5.4.
- Tài khoản đăng ký mới được 60 ngày Pro; hết hạn tự về Standard, không mất dữ liệu.
- Giới hạn HS đang học (`Student.isActive = true`): Standard 10, Plus 40, Pro không giới hạn.
- Giáo viên tự chọn gói + kỳ hạn ở trang **Gói của tôi**, nhận mã VietQR với nội dung chuyển khoản định danh; admin xác nhận ở `/admin`, gói bật ngay.
- Sau deploy: Miss Ly và `qa_test` (id=4) là Pro 1 năm; 2 tài khoản còn lại là Standard.
- `pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch; `theme-legacy-colors` pass.

## 3. Quyết định đã chốt (người dùng)

| # | Nội dung |
|---|---|
| P1 | Standard miễn phí, ≤10 HS đang học. Plus 49.000đ/tháng, 490.000đ/năm, ≤40 HS. Pro 99.000đ/tháng, 990.000đ/năm, không giới hạn. **Thêm kỳ 2 năm** (người dùng chốt 2026-09-26): Plus 980.000đ, Pro 1.980.000đ (gấp đôi giá năm), tặng thêm 2 tháng. |
| P2 | Tài khoản mới: 60 ngày Pro dùng thử, hết hạn về Standard, giữ dữ liệu. |
| P3 | Bậc thang: gói trên có đủ gói dưới. Standard: lịch dạy, ca bù, điểm danh, HS, môn, tự lên lớp, tính học phí (xem số tiền), thẻ số liệu Tổng quan, sao lưu Excel. Plus thêm: ghi nhận thu + lịch sử thu (B), phiếu báo + VietQR (C), báo cáo theo tháng. Pro thêm: link phụ huynh (G), "Cần chú ý" ở Tổng quan (D), nhập HS từ Excel (E), báo cáo năm / lọc theo khối. |
| P4 | Thu tiền: chuyển khoản thủ công vào TK chủ app, admin xác nhận và bật gói. Chưa có cổng thanh toán. |
| P5 | Tài khoản cũ: Miss Ly (id=1, username `Suiuoi`) + `qa_test` (id=4) → Pro 1 năm từ ngày ra mắt; còn lại (id=2 `teacher`, id=3 `ngominhnhat`, đều 0 HS đang học — đã kiểm chỉ đọc trên prod 2026-09-26) → Standard. |
| P6 | Admin là **một tài khoản riêng** chỉ để quản trị: người dùng tự đăng ký rồi đặt username vào env `ADMIN_USERNAMES` trên Vercel. Tài khoản admin không cần gói. |
| P7 | Tất toán/ghi chú tháng (`updateSettlement`) thuộc Plus; báo cáo Năm / Khoảng nhiều tháng / lọc khối thuộc Pro (duyệt D10 và mục 6.3). |
| P8 | Link phụ huynh khi chủ TK hết Pro: tạm khóa (404), gia hạn là link cũ sống lại (duyệt D9). |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| D1 | Lưu gói ở đâu | 3 cột trên `users` (`plan`, `plan_expires_at`, `trial_ends_at`) + 1 bảng `plan_orders` làm cả yêu cầu thanh toán, lịch sử lẫn nhật ký admin | Đọc gói chỉ cần 1 dòng user; không cần bảng subscription riêng cho 4–vài chục tài khoản |
| D2 | Kiểu cột gói/trạng thái | `VARCHAR` + hằng TS (giống `TeachingSession.status`, `Payment.method`), không dùng enum Postgres | Theo kiểu sẵn có của repo |
| D3 | Mốc hạn | Mọi hạn lưu là **00:00 giờ VN của ngày ngay sau ngày dùng cuối**. Hiển thị "Dùng đến hết ngày dd/mm/yyyy" = ngày VN của `(hạn − 1ms)` | Không lệch ngày khi cộng dồn; hiển thị gọn |
| D4 | Dùng thử 60 ngày tính thế nào | `trialEndsAt = đầu ngày VN lúc đăng ký + 60 ngày` (ngày đăng ký là ngày 1). Gán trong `registerUser`, không dùng default DB | Dễ test; tài khoản cũ không bị gán nhầm |
| D5 | Trial và gói trả phí chồng nhau | Gói hiệu lực = gói **cao hơn** trong (gói trả phí còn hạn, Pro nếu trial còn hạn) | Mua Plus trong lúc dùng thử không bị tụt xuống Plus ngay |
| D6 | Mua/gia hạn: ngày bắt đầu | Mốc = muộn nhất trong: đầu ngày VN hôm nay; `trialEndsAt` nếu trial còn hạn; `planExpiresAt` nếu **cùng gói** còn hạn. Hạn mới = mốc + 1 tháng/1 năm (lịch VN, 31/1 + 1 tháng = 28 hoặc 29/2) | Cộng dồn khi gia hạn; không mất ngày dùng thử |
| D7 | Đổi gói giữa kỳ (**người dùng chốt quy đổi**) | Plus → Pro khi Plus trả phí còn hạn: **quy đổi phần tiền Plus còn lại sang ngày Pro**. `giá trị còn lại = số tiền đơn Plus đang hiệu lực × số ngày Plus còn lại / tổng số ngày của đơn đó`; `ngày Pro cộng thêm = floor(giá trị còn lại / đơn giá ngày của gói Pro đang mua)`, với đơn giá ngày = 99.000/30 (Pro tháng) hoặc 990.000/365 (Pro năm). Hạn Pro mới = đầu ngày VN hôm nay + kỳ Pro vừa mua + ngày quy đổi; hạn Plus kết thúc hôm nay. Ví dụ: Plus năm 490.000đ, đã dùng 61 ngày, còn 304/365 ngày → còn 408.110đ → mua Pro năm: +150 ngày (hạn = hôm nay + 1 năm + 150 ngày); mua Pro tháng: +123 ngày. Đơn Plus được tặng (số tiền 0) → quy đổi 0 ngày. Hàm thuần `computeUpgradeCredit()` trong `src/lib/plans.ts`, dùng chung client (xem trước) và server (tính khi admin duyệt, lưu `credit_days` vào đơn). Pro → Plus khi Pro trả phí còn hạn: **không cho đặt** (nút khóa, ghi "Gói Pro còn hạn tới …") | Người dùng yêu cầu không mất tiền đã trả; tính lại lúc duyệt vì ngày duyệt có thể khác ngày đặt |
| D8 | Hạ gói mà HS đang học vượt giới hạn | Giữ nguyên dữ liệu và trạng thái. HS đang học vẫn xem/sửa/điểm danh/thêm vào ca/tính học phí bình thường. Chỉ chặn **tạo HS đang học mới** và **bật lại HS đã nghỉ** cho tới khi số HS đang học < giới hạn. Tạo HS với "Đang học" tắt vẫn được | Không làm gián đoạn dạy giữa tháng; không tự tắt HS nào (tự tắt dễ sai HS, khó hoàn tác) |
| D9 | Link phụ huynh khi chủ TK hết Pro | `/p/[token]` trả 404 như token sai; token **giữ nguyên** trong DB, gia hạn Pro là link sống lại. `disableParentLink` luôn cho dùng ở mọi gói | Không lộ lý do ra ngoài; tắt link là việc bảo vệ riêng tư, không được khóa |
| D10 | "Báo cáo theo tháng" vs "báo cáo năm" | Plus: `report.monthlySummary`/`report.student` cho **đúng 1 tháng**, không lọc lớp. Pro: nhiều tháng (Năm hoặc Khoảng) hoặc có `grade` | Khớp 3 lựa chọn Tháng/Năm/Khoảng của `ReportPeriodPicker` |
| D11 | Admin là ai | Env `ADMIN_USERNAMES` (danh sách username, cách nhau dấu phẩy, so khớp chính xác sau trim). Không thêm cột role | 1 admin, không cần UI phân quyền; đổi admin không cần migration |
| D12 | TK nhận tiền của chủ app | Env `PLAN_BANK_BIN`, `PLAN_BANK_ACCOUNT_NUMBER`, `PLAN_BANK_ACCOUNT_NAME`. Thiếu env → trang Gói hiện "Chưa mở thanh toán" và `plan.createOrder` trả lỗi | Không lưu TK chủ app vào DB của 1 giáo viên |
| D13 | Nội dung chuyển khoản | `SM <mã đơn>`; mã đơn 6 ký tự từ bảng `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (bỏ 0/O/1/I/L), sinh bằng `crypto.randomBytes`, unique | Ngắn, gõ tay được, không lộ username |
| D14 | Số đơn chờ | Mỗi tài khoản tối đa 1 đơn `pending`; tạo đơn mới tự hủy đơn chờ cũ (`cancelled`). Đơn chờ không tự hết hạn; admin từ chối nếu cần | Đơn giản, tránh admin đối chiếu nhầm đơn |
| D15 | Lỗi thiếu gói | `TRPCError` `FORBIDDEN` + `cause: new PlanRequiredError("plus"\|"pro")`; `errorFormatter` thêm `data.planRequired`. Client: `MutationCache.onError` trong `TRPCProvider` thấy `planRequired` thì mở `UpgradeDialog` (mục 8.4) | 1 chỗ xử lý cho mọi mutation |
| P9 | Ưu đãi gia hạn sớm (người dùng chốt) | Xem mục 6.6. Không cộng dồn với 2 tháng tặng sẵn của kỳ 2 năm; chỉ áp khi đang có gói **trả phí** còn hạn và mua kỳ năm/2 năm cùng gói hoặc Plus→Pro; kỳ tháng không tặng; đang dùng thử mua gói không tính là gia hạn sớm | |
| P10 | Popup nhắc gia hạn (người dùng chốt) | Xem mục 8.6 | |
| P12 | Khóa UI (người dùng chốt) | Giao diện mọi gói giống Pro; tính năng không đủ gói có ổ khóa, bấm → popup nâng cấp (mục 8.4) | |
| P11 | Trang gói gợi ý Pro (người dùng chốt) | Mặc định chọn Pro, thẻ Pro nổi bật; tính năng liệt kê bậc thang không lặp (mục 8.2) | |
| D16 | Tên đường dẫn | Trang gói `/plan`, trang admin `/admin` (cả 2 trong nhóm `(app)`, middleware đã bắt đăng nhập) | |

## 5. Phạm vi

### Trong phạm vi
- Migration schema + migration dữ liệu ra mắt (mục 7).
- `src/lib/plans.ts` (MỚI, thuần), `plan.service.ts` (MỚI), router `plan` + `admin` (MỚI), chặn procedure theo mục 6.3.
- Trang `/plan`, `/admin`, banner nhắc hạn, khóa UI theo mục 5.4, i18n vi/en.
- Sửa `tests/setup.ts` seed `teacher`, `teacher2` thành Pro (`planExpiresAt` năm 2099) để test cũ giữ nguyên; thêm user `teacher_std` (Standard) và `admin_test`.

### Ngoài phạm vi (YAGNI)
- Cổng thanh toán tự động, webhook ngân hàng, tự đối soát sao kê.
- Hóa đơn VAT/hóa đơn điện tử, hoàn tiền, mã giảm giá, tính tiền theo tỷ lệ khi đổi gói.
- Email/Zalo nhắc hạn (chỉ banner trong app).
- Cột role, nhiều cấp admin, sửa/xóa tài khoản từ trang admin.
- Chặn `session.getMonth` nhiều tháng (dữ liệu này Standard vẫn xem được qua lịch từng tháng).

## 6. Backend

### 6.1 `src/lib/plans.ts` (MỚI, thuần, dùng được ở client)
- `PLANS = ["standard", "plus", "pro"] as const`, `type Plan`, `PLAN_RANK`.
- `PLAN_PRICES = { plus: { month: 49000, year: 490000 }, pro: { month: 99000, year: 990000 } }`.
- `STUDENT_LIMITS = { standard: 10, plus: 40, pro: null }`.
- `FEATURE_PLAN = { payments: "plus", tuitionNotice: "plus", monthlyReport: "plus", parentLink: "pro", dashboardAlerts: "pro", studentImport: "pro", multiMonthReport: "pro" }`.
- `vnStartOfDay(d: Date): Date` = `Date.UTC(y, m−1, d) − 7h` từ `vnDateParts(d)`.
- `effectivePlan(u: { plan, planExpiresAt, trialEndsAt }, now): { plan: Plan; source: "paid" | "trial" | "free"; expiresAt: Date | null }` theo D5. Gói trả phí còn hạn khi `planExpiresAt > now`; trial còn hạn khi `trialEndsAt > now`. Hòa hạng (Pro trả phí + trial) → `source: "paid"`.
- `hasFeature(plan, feature)`, `studentLimit(plan)`.
- `computeNewExpiry(u, orderPlan, period, now): Date` theo D6.
- `trialEndFor(createdAt): Date` theo D4.
- `daysLeft(expiresAt, now)` = số ngày VN còn lại, tính cả hôm nay.

### 6.2 `src/server/services/plan.service.ts` (MỚI)
- `getUserPlan(db, userId)`: đọc 3 cột + `effectivePlan(…, new Date())`.
- `assertFeature(db, userId, feature)`: thiếu gói → lỗi D15, message "Tính năng này cần gói Plus" / "… gói Pro".
- `assertCanActivateStudents(db, userId, n)`: nếu có giới hạn và `count(isActive) + n > limit` → `FORBIDDEN` + `planRequired` = gói nhỏ nhất đủ chỗ; message "Gói Standard tối đa 10 học sinh đang học (hiện có 12)".
- `createOrder`, `cancelOrder`, `getMyPlan` (cho `plan.me`), và các hàm admin ở 6.5.
- `PlanRequiredError extends Error { plan }` đặt ở đây; `errorFormatter` trong `src/server/trpc/index.ts` đọc `error.cause instanceof PlanRequiredError`.

### 6.3 Chặn theo procedure
Thêm vào `src/server/trpc/index.ts`: `planProcedure(feature) = protectedProcedure.use(mw gọi assertFeature)`. Tốn thêm 1 query đọc user, chỉ ở các procedure dưới.

| Router.procedure | Chặn |
|---|---|
| `payment.list/create/update/delete` | `payments` (Plus) |
| `tuition.updateSettlement` (tất toán + ghi chú, nằm trong luồng thu tiền) | `payments` (Plus) |
| `tuition.getNotice` | `tuitionNotice` (Plus) |
| `report.monthlySummary`, `report.student` | Trong procedure: có `toYear/toMonth` khác tháng đầu, hoặc có `grade` → `multiMonthReport` (Pro); còn lại `monthlyReport` (Plus) |
| `report.alerts` | `dashboardAlerts` (Pro) |
| `student.importCheck`, `student.importMany` | `studentImport` (Pro) |
| `student.generateParentLink` | `parentLink` (Pro) |
| `student.create` (khi `isActive` true) | `assertCanActivateStudents(…, 1)` trong `createStudent` |
| `student.update` (`data.isActive === true` và HS đang nghỉ) | `assertCanActivateStudents(…, 1)` trong `updateStudent` |
| `importStudents` | `assertCanActivateStudents(…, rows.length)` (Pro không giới hạn nên hiện luôn qua; giữ để đúng quy tắc nếu sau này hạ E xuống gói thấp) |

Không chặn: `auth.*`, `health.*`, `subject.*`, `session.*`, `attendance.*`, `student.list/delete/upgradeAllClasses/getUpgradeLogThisYear/disableParentLink`, `tuition.getMonthlyStatus/getMonthlyStatusReadOnly`, `report.dashboard`, `settings.*`, `/api/backup`.

`getParentView` (`parent-link.service.ts`): select thêm `plan, planExpiresAt, trialEndsAt` của user; không phải Pro hiệu lực → `return null` (D9).

`registerUser` (`user.service.ts`): `data` thêm `trialEndsAt: trialEndFor(new Date())`.

Đếm HS không khóa dòng → 2 request tạo HS đồng thời có thể vượt 1 HS. Chấp nhận (mục 10).

### 6.4 Router `plan` (MỚI, `src/server/trpc/routers/plan.ts`)
- `me` (query): `{ plan, source, expiresAt, trialEndsAt, activeStudents, studentLimit, pendingOrder, orders (10 đơn gần nhất), paymentReady, isAdmin }`. `pendingOrder` kèm `qr` dựng giống `tuition-notice.service.ts` (`findBank` + `buildVietQrPayload({ bin, accountNumber, amount, content })`) từ env D12.
- `createOrder` (mutation, input `{ plan: "plus"|"pro", period: "month"|"year"|"2year" }`): tiền lấy từ `PLAN_PRICES`, không nhận từ client; áp D7 (Pro trả phí còn hạn mà đặt Plus → `BAD_REQUEST`); hủy đơn chờ cũ; tạo đơn mới với mã D13 (trùng unique → thử lại 1 lần như `generateParentLink`).
- `cancelOrder` (mutation, input `{ id }`): chỉ đơn `pending` của chính mình.

### 6.5 Router `admin` (MỚI) + `adminProcedure`
`adminProcedure = protectedProcedure.use(mw)`: `ctx.session.user.username` không nằm trong `ADMIN_USERNAMES` → `FORBIDDEN`. Mọi thao tác ghi đi qua `plan_orders` (có `decidedBy`, `decidedAt`) và `console.info("[admin] …")`.
- `overview` (query): danh sách user (`id, username, fullName, createdAt, lastLoginAt`, số HS đang học, gói hiệu lực, nguồn, hạn) + danh sách đơn `pending` (mới nhất trước).
- `approveOrder({ id })`: trong transaction: `updateMany where { id, status: "pending" }` → nếu `count = 0` trả `CONFLICT` (chống bấm 2 lần); tính `computeNewExpiry`; cập nhật `users.plan`, `plan_expires_at`; ghi `grantedUntil` vào đơn.
- `rejectOrder({ id, note? })`.
- `setPlan({ userId, plan, lastDay?: "YYYY-MM-DD", note })`: đặt thẳng gói (tặng, bù ngày, sửa sai). `plan = "standard"` → `plan_expires_at = null`; còn lại hạn = `vnStartOfDay(lastDay) + 1 ngày`. Tạo 1 dòng `plan_orders` `source = "admin"`, `status = "approved"`, `amount = 0`, `note` bắt buộc. Không đụng `trialEndsAt` (đặt Standard khi trial còn hạn thì vẫn hiện Pro tới hết trial; UI admin ghi rõ).

## 7. Dữ liệu và migration

### 7.1 Schema (migration `…_add_plans`)
`User` thêm:
- `plan String @default("standard") @map("plan") @db.VarChar(10)`
- `planExpiresAt DateTime? @map("plan_expires_at")`
- `trialEndsAt DateTime? @map("trial_ends_at")`
- quan hệ `planOrders PlanOrder[]`

Bảng MỚI `PlanOrder` (`@@map("plan_orders")`): `id`, `userId` (FK users), `plan VarChar(10)`, `period VarChar(5)?` ("month"/"year"/"2year", null khi admin đặt tay), `bonusMonths Int @default(0)` (số tháng tặng chốt lúc tạo đơn theo 6.6), `creditDays Int @default(0)` (ngày quy đổi D7, tính lúc duyệt), `amount Int`, `code VarChar(8)? @unique` (null khi admin đặt tay), `status VarChar(10)` ("pending"/"approved"/"rejected"/"cancelled"), `source VarChar(10) @default("user")` ("user"/"admin"), `grantedUntil DateTime?`, `note String?`, `decidedBy VarChar(50)?`, `decidedAt DateTime?`, `createdAt`. Index `[userId, createdAt]`, `[status]`.

Thêm cột có default hằng + cột nullable → không khóa bảng lâu, tài khoản cũ nhận `plan = 'standard'`, `trial_ends_at = NULL` (không được dùng thử, đúng P5).

### 7.2 Migration dữ liệu ra mắt (migration `…_launch_plan_grants`, SQL tay)
Miss Ly = id 1, username `Suiuoi` (đã xác nhận). SQL khớp cả id lẫn username (DB test/local không có user nào trùng cặp đó → 0 dòng, an toàn):
```sql
UPDATE "users" SET "plan" = 'pro',
  "plan_expires_at" = ((date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '1 year') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'UTC'
WHERE ("id", "username") IN ((4, 'qa_test'), (1, 'Suiuoi'));
INSERT INTO "plan_orders" ("user_id","plan","amount","status","source","granted_until","note","decided_by","decided_at","created_at")
SELECT "id",'pro',0,'approved','admin',"plan_expires_at",'Tặng khi ra mắt phân gói','migration',now(),now()
FROM "users" WHERE ("id", "username") IN ((4, 'qa_test'), (1, 'Suiuoi'));
```
(Cột `DateTime` của Prisma là `timestamp(3)` lưu giờ UTC không múi → cần chuyển `AT TIME ZONE 'UTC'` cuối. Plan phải kiểm biểu thức này trên DB test bằng 1 user giả trước.) "Ngày ra mắt" = ngày migration chạy trên prod; hạn = 00:00 VN cùng ngày năm sau → dùng đến hết ngày trước đó (đủ 1 năm theo D3).

### 7.3 An toàn khi chạy trên prod
1. Trước merge: tạo Neon backup branch từ prod (`backup-truoc-i-phan-goi`).
2. Chạy (chỉ đọc) trên prod, lưu kết quả: `SELECT id, username, created_at FROM users ORDER BY id;` và `SELECT user_id, count(*) FROM students WHERE is_active GROUP BY user_id;` → biết trước 2 tài khoản về Standard có vượt 10 HS không (nếu có, báo người dùng quyết định trước khi deploy).
3. Deploy (build chạy `prisma migrate deploy`).
4. Sau deploy: `SELECT id, username, plan, plan_expires_at, trial_ends_at FROM users ORDER BY id;` phải có đúng 2 dòng `pro` và 2 dòng `standard`, `trial_ends_at` toàn NULL; `SELECT count(*) FROM plan_orders;` = 2; số HS/số payment không đổi so với bước 2.
5. Khoảng hở nhỏ: user đăng ký trong lúc build (code cũ) sẽ không có trial → admin dùng `setPlan` bù.

## 8. Giao diện

Màu theo A3: nhấn `primary` (#0F766E); nhãn gói dùng viền/chữ `primary` trên nền trắng; cảnh báo hết hạn dùng amber, đã hết hạn dùng slate. Không indigo/violet/purple. Vùng chạm `h-11 md:h-10`.

### 8.1 Dùng chung (MỚI)
- `usePlan()` (`src/hooks/usePlan.ts`): bọc `trpc.plan.me`, trả thêm `has(feature)`.
- `PlanBadge` (`src/components/plan/PlanBadge.tsx`): pill nhỏ "Plus"/"Pro".
- `UpgradeCard` (`src/components/plan/UpgradeCard.tsx`): khung tên tính năng + "Có ở gói {Plus|Pro}" + nút "Xem gói" (link `/plan`).
- `PlanBanner` (`src/components/plan/PlanBanner.tsx`), đặt trong `AppLayout` ngay đầu `<main>`.

### 8.2 Trang `/plan` (Gói của tôi)
Lối vào: thêm `{ href: "/plan", labelKey: "my_plan", icon: Crown }` vào `MANAGE_ITEMS` (sidebar Quản lý) và `MORE_ITEMS` (sheet Thêm, kèm `descKey`) trong `nav-items.ts`.
1. **Gói hiện tại**: tên gói + nhãn nguồn (Dùng thử / Đã mua / Miễn phí), "Dùng đến hết ngày …" (nếu có hạn), "Học sinh đang học: 12/40" (Pro: "12, không giới hạn").
2. **So sánh 3 gói** (P11, người dùng chốt): desktop 3 cột **Standard → Plus → Pro** từ trái sang phải (giống trang gói Free/Pro/Max của Claude); mobile xếp dọc **ngược lại: Pro → Plus → Standard** từ trên xuống (dùng `order-*` responsive trên cùng 1 danh sách, không render 2 lần). Mỗi thẻ: giá tháng/năm/2 năm (năm ghi "tiết kiệm 2 tháng", 2 năm ghi "tặng 2 tháng"), giới hạn HS, tính năng **không lặp lại**:
   - Standard: liệt kê đủ tính năng Standard (P3).
   - Plus: dòng đầu "Mọi thứ của Standard, thêm:" rồi CHỈ các tính năng Plus mới.
   - Pro: dòng đầu "Mọi thứ của Plus, thêm:" rồi CHỈ các tính năng Pro mới + "Không giới hạn học sinh".
   Danh sách lấy từ 1 nguồn duy nhất trong `src/lib/plans.ts` (mỗi tính năng gắn gói nhỏ nhất có nó) để thẻ và chặn quyền không lệch nhau; unit test khẳng định không tính năng nào xuất hiện ở 2 thẻ.
   - **Pro nổi bật**: nhãn "Khuyên dùng", viền 2px màu nhấn `primary`, nền nhạt `bg-primary/[0.04]`, nút CTA đặc màu nhấn; desktop thẻ Pro cao hơn/nhô lên nhẹ. Plus và Standard viền 1px thường, nút viền (outline). Không dùng màu ngoài hệ A3.
   - Thẻ gói hiện tại có nhãn "Đang dùng" (không đổi viền để không tranh với Pro).
3. **Nâng cấp / gia hạn**: chọn Plus/Pro + Tháng/Năm/2 năm (nhóm nút). **Mặc định chọn sẵn Pro** (kỳ Năm) mọi lúc, kể cả khi đang Plus; người dùng vẫn tự chọn Plus được (trừ trường hợp D7 Pro còn hạn). Bấm CTA trên thẻ nào thì chọn sẵn gói đó. hiện số tiền và "Hạn mới dự kiến: …" (tính bằng `computeNewExpiry` ở client). Trường hợp D7: Plus → Pro hiện "Phần Plus còn lại (≈ X đ) được quy đổi thành +N ngày Pro" (số tính lại khi admin duyệt); Pro còn hạn thì nút Plus khóa. Nút "Tạo mã chuyển khoản" → `plan.createOrder`.
4. **Đơn chờ xác nhận**: ảnh QR (`toDataURL`), ngân hàng, STK, chủ TK, số tiền, nội dung `SM XXXXXX` (mỗi dòng có nút sao chép), trạng thái "Chờ xác nhận", ghi chú "Ghi đúng nội dung chuyển khoản. Gói được bật sau khi chủ app xác nhận.", nút "Hủy yêu cầu". `paymentReady = false` → thay bằng dòng "Chưa mở thanh toán".
5. **Lịch sử**: tối đa 10 đơn (ngày, gói, kỳ, số tiền, trạng thái).
6. Admin (`isAdmin`): link "Trang quản trị" cuối trang. Không thêm vào nav.

### 8.3 Trang `/admin`
`page.tsx` là server component: `auth()` + kiểm `ADMIN_USERNAMES`, không phải admin → `notFound()`; nội dung là client component gọi `admin.overview`.
- **Chờ xác nhận**: `ResponsiveList` các đơn pending: tài khoản, gói, kỳ, số tiền, mã, ngày tạo; nút "Xác nhận" (hộp xác nhận ghi hạn mới) và "Từ chối".
- **Tài khoản**: `ResponsiveList` mọi user: username, họ tên, ngày tạo, lần đăng nhập cuối, HS đang học, gói hiệu lực + nguồn, hạn; menu "Đặt gói" → dialog chọn gói, ngày dùng cuối, ghi chú (bắt buộc).

### 8.4 Khóa UI theo gói (P12, người dùng chốt)
**Nguyên tắc:** giao diện của mọi gói **giống hệt Pro**: không ẩn menu, nút, mục nào. Tính năng gói hiện tại không dùng được thì hiện **biểu tượng khóa** + `PlanBadge` ("Plus"/"Pro"); **bấm vào** thì không chạy chức năng mà mở `UpgradeDialog` (MỚI, `src/components/plan/UpgradeDialog.tsx`):
- Tính năng Plus: "Nâng lên gói Plus hoặc Pro để sử dụng tính năng này." Tính năng Pro: "Nâng lên gói Pro để sử dụng tính năng này."
- Nút "Xem gói" (đặc, màu nhấn) → `/plan`, nút "Để sau".
- Một hook dùng chung `useFeatureGate(feature)` trả `{ locked, requiredPlan, openUpgrade }`; component chỉ cần bọc handler. Query của tính năng bị khóa **không gọi** (`enabled: !locked`) để không nhận lỗi FORBIDDEN.

| Nơi | Chưa đủ gói thì |
|---|---|
| Sidebar / sheet "Thêm": mục **Báo cáo** (Standard) | Vẫn hiện, có ổ khóa; bấm → `UpgradeDialog` (Plus), không điều hướng. Vào thẳng URL `/reports` → trang hiện khung báo cáo mờ + `UpgradeDialog` |
| `/reports` (Plus) | Nút "Năm"/"Khoảng" và ô lọc lớp hiện đủ, có ổ khóa; bấm → `UpgradeDialog` (Pro) |
| `tuition/page.tsx`, `TuitionDetailSheet` (Standard) | Nút "Ghi nhận", "Thêm lần thu", tất toán/ghi chú, nút phiếu báo vẫn hiện, có ổ khóa; bấm → `UpgradeDialog` (Plus). Phần tính tiền vẫn xem bình thường; khối lịch sử thu hiện trạng thái khóa (không gọi `payment.list`) |
| `DashboardAlerts` (chưa Pro) | Thẻ "Cần chú ý" vẫn hiện khung 3 nhóm, nội dung mờ + ổ khóa; bấm → `UpgradeDialog` (Pro). Không gọi `report.alerts` |
| Nút nhập Excel, menu "Link phụ huynh" (chưa Pro) | Hiện, có ổ khóa; bấm → `UpgradeDialog` (Pro). HS đã có link: vẫn mở được `ParentLinkDialog` để **tắt** link; nút tạo/tạo lại có ổ khóa |
| Thêm HS khi đã đủ giới hạn | Nút "Thêm học sinh" vẫn hiện; bấm → `UpgradeDialog` với nội dung giới hạn ("Gói Standard tối đa 10 học sinh đang học. Nâng lên Plus (40) hoặc Pro (không giới hạn)."). Bật lại HS đã nghỉ cũng vậy |
| `students/page.tsx` khi vượt/chạm giới hạn | Dải thông báo "12/10 học sinh đang học…" + link `/plan` |
| Lỗi FORBIDDEN `planRequired` từ server (lọt qua UI) | Mở cùng `UpgradeDialog` thay cho toast (D15 đổi theo) |

E2E bắt buộc: tài khoản `teacher_std` thấy đủ menu như Pro; bấm Báo cáo / Ghi nhận / Link phụ huynh đều mở `UpgradeDialog` đúng chữ Plus hoặc Pro; không có request FORBIDDEN nào trong lúc duyệt trang.

### 6.6 Ưu đãi (P1 kỳ 2 năm, P9 gia hạn sớm) — hàm thuần `computeBonusMonths(u, orderPlan, period, now)` trong `src/lib/plans.ts`
- `daysLeft` = số ngày VN từ đầu ngày hôm nay tới `planExpiresAt` của gói **trả phí** đang hiệu lực (ngày dùng cuối = 1). Không có gói trả phí còn hạn → `daysLeft = null`.
- Bảng tặng (tháng lịch VN, cộng sau kỳ mua + ngày quy đổi D7):

| Trường hợp | Kỳ tháng | Kỳ 1 năm | Kỳ 2 năm |
|---|---|---|---|
| Mua mới / đang dùng thử / đã hết hạn (`daysLeft` null) | 0 | 0 | +2 |
| Gia hạn sớm, còn 31–60 ngày | 0 | +2 | +4 |
| Gia hạn sớm, còn 1–30 ngày | 0 | +1 | +2 |
| Còn > 60 ngày | 0 | 0 | +2 |

- "Gia hạn sớm" = cùng gói, hoặc Plus → Pro (khi đó vẫn áp D7 quy đổi). Không cộng dồn: kỳ 2 năm gia hạn sớm lấy +4/+2 thay cho +2.
- **Chốt lúc tạo đơn**: `bonusMonths` tính theo `now` = lúc `createOrder` và lưu vào đơn, để giáo viên thấy ưu đãi nào thì được đúng ưu đãi đó dù admin duyệt muộn. `creditDays` (D7) vẫn tính lúc duyệt.
- Hạn mới = mốc D6 + kỳ mua + `creditDays` + `bonusMonths`.
- Test bắt buộc: biên 61/60/31/30/1/0 ngày; kỳ tháng luôn 0; 2 năm không cộng dồn; đang trial mua 2 năm = +2; Plus→Pro năm còn 45 ngày = +2 tháng và có creditDays.

### 8.5 Banner nhắc hạn (`PlanBanner`)
- Trial còn 1–7 ngày: "Dùng thử Pro còn {n} ngày. Sau đó tài khoản về gói Standard, dữ liệu giữ nguyên." + "Xem gói".
- Gói trả phí còn 1–7 ngày: "Gói {plan} hết hạn sau {n} ngày." + "Gia hạn".
- Đã hết hạn trong 7 ngày qua (trial hoặc trả phí) và đang Standard: "Gói {plan} đã hết hạn, tài khoản đã về Standard." Có nút đóng; nhớ đã đóng bằng `localStorage` theo mốc hạn (bọc try/catch).
- Có đơn chờ thì không hiện banner nhắc (tránh 2 thông báo).
- Khi popup 8.6 đang áp dụng (gói trả phí còn ≤ 60 ngày) thì banner 1–7 ngày của gói trả phí nhường cho popup + nút header, không hiện trùng.

### 8.6 Popup nhắc gia hạn sớm (P10) — `RenewOfferDialog` + nút header
- Điều kiện: gói trả phí còn 1–60 ngày và không có đơn chờ.
- Hiện **giữa màn hình** (Dialog), **mỗi ngày 1 lần**: nhớ ngày VN đã hiện bằng `localStorage` (bọc try/catch; lỗi storage thì coi như chưa hiện). Nội dung: còn {n} ngày; ưu đãi hiện tại theo 6.6 (vd "Gia hạn 2 năm tặng 4 tháng, 1 năm tặng 2 tháng"); mốc ưu đãi giảm ("Sau ngày dd/mm ưu đãi giảm còn …" khi còn 31–60; "Hết hạn rồi mới gia hạn sẽ không còn ưu đãi" khi còn 1–30). Nút "Gia hạn ngay" → `/plan`, nút "Để sau".
- Sau khi đóng: `AppHeader` hiện nút hành động **"Gia hạn"** (màu nhấn, cạnh nút ngôn ngữ; mobile chỉ icon + aria-label, ≥44px) để mở lại popup bất cứ lúc nào. Nút hiện suốt thời gian điều kiện còn đúng.
- Dùng thử còn ≤ 7 ngày: vẫn dùng banner 8.5 (không có ưu đãi, không popup).
- i18n vi/en cho toàn bộ chữ; màu theo A3.

## 9. i18n

Thêm vào `vi.json` và `en.json` (cùng bộ key). Dò key có sẵn trước (`settings`, `cancel`, `save`, `month`, `year`, …). Không dùng gạch dài. Lỗi server giữ tiếng Việt như service khác.

| Key | vi | en |
|---|---|---|
| `my_plan` / `more_plan_desc` | Gói của tôi / Gói hiện tại, nâng cấp, gia hạn | My plan / Current plan, upgrade, renew |
| `plan_standard` / `plan_plus` / `plan_pro` | Standard / Plus / Pro | Standard / Plus / Pro |
| `plan_source_trial` / `_paid` / `_free` | Dùng thử / Đã mua / Miễn phí | Trial / Paid / Free |
| `plan_valid_until` | Dùng đến hết ngày {date} | Valid through {date} |
| `plan_students_usage` | Học sinh đang học: {count}/{limit} | Active students: {count}/{limit} |
| `plan_unlimited` | Không giới hạn | Unlimited |
| `plan_per_month` / `plan_per_year` / `plan_save_2_months` | /tháng / /năm / Tiết kiệm 2 tháng | /month / /year / Save 2 months |
| `plan_includes_below` | Mọi thứ của gói {plan}, thêm: | Everything in {plan}, plus: |
| `plan_create_order` / `plan_new_expiry` | Tạo mã chuyển khoản / Hạn mới dự kiến: {date} | Create transfer code / New expiry: {date} |
| `plan_pending` / `plan_cancel_order` / `plan_pending_hint` | Chờ xác nhận / Hủy yêu cầu / Ghi đúng nội dung chuyển khoản. Gói được bật sau khi chủ app xác nhận. | Pending / Cancel request / Use the exact transfer note. Your plan turns on once confirmed. |
| `plan_switch_warning` / `plan_downgrade_blocked` | Phần còn lại của gói Plus không được cộng sang Pro / Gói Pro còn hạn tới {date} | Remaining Plus time is not carried over to Pro / Pro is active until {date} |
| `plan_payment_not_ready` | Chưa mở thanh toán | Payments are not open yet |
| `plan_available_in` / `plan_view_plans` | Có ở gói {plan} / Xem gói | Available on {plan} / View plans |
| `plan_over_limit` | {count}/{limit} học sinh đang học. Gói {plan} không thêm được học sinh mới. | {count}/{limit} active students. {plan} can't add more students. |
| `plan_trial_ending` / `plan_expiring` / `plan_expired` | (theo 8.5) | (theo 8.5) |
| `admin_page` / `admin_pending_orders` / `admin_accounts` / `admin_approve` / `admin_reject` / `admin_set_plan` / `admin_last_day` / `admin_note` | Quản trị / Chờ xác nhận / Tài khoản / Xác nhận / Từ chối / Đặt gói / Ngày dùng cuối / Ghi chú | Admin / Pending / Accounts / Approve / Reject / Set plan / Last day / Note |
| tên tính năng trong bảng so sánh (`plan_feat_*`) | theo P3 | theo P3 |

## 10. Kiểm thử

Chỉ chạy trên `.env.test` (Postgres local). `tests/setup.ts`: `teacher`, `teacher2` Pro tới 2099; thêm `teacher_std` (Standard, không trial) và `admin_test`; test set `process.env.ADMIN_USERNAMES = "admin_test"` và env ngân hàng giả.

### Unit (`tests/unit/lib/plans.test.ts`)
- `effectivePlan`: không gì → standard/free; trial còn hạn → pro/trial; trial hết + Plus còn hạn → plus/paid; Plus còn hạn + trial còn hạn → pro/trial; Pro còn hạn + trial → pro/paid; đúng mốc hạn (`now = expiresAt`) → đã hết.
- Mốc giờ VN: `now` 23:30 VN ngày cuối vẫn còn hạn; 00:00 VN hôm sau hết hạn.
- `computeNewExpiry`: mua mới (từ đầu ngày VN hôm nay), gia hạn cùng gói còn hạn (cộng dồn), mua trong trial (tính từ `trialEndsAt`), Plus → Pro (từ hôm nay), 31/1 + 1 tháng, + 1 năm từ 29/2.
- `trialEndFor`, `daysLeft`, `studentLimit`, `hasFeature` (bậc thang).

### Integration (`tests/integration/plan-gating.test.ts`, `plan-orders.test.ts`, `admin.test.ts`)
- Bảng các procedure mục 6.3: `teacher_std` → `FORBIDDEN` và `data.planRequired` đúng gói; user Plus → qua các procedure Plus, bị chặn Pro (kể cả `monthlySummary` có `toMonth` khác hoặc có `grade`); `teacher` Pro → qua hết.
- `disableParentLink` qua ở Standard. `getParentView` trả null khi chủ TK Standard, trả lại dữ liệu sau khi đặt Pro (cùng token).
- Giới hạn HS: Standard có 10 HS đang học → `create` bị chặn, `create` với `isActive:false` qua, bật lại HS nghỉ bị chặn; sửa HS đang học khác vẫn qua; điểm danh vẫn qua. Có 12 HS (hạ gói) → vẫn list/điểm danh được.
- `registerUser` gán `trialEndsAt` đúng 60 ngày.
- Đơn: tạo đơn → pending, số tiền theo bảng giá (client không gửi tiền); tạo đơn thứ 2 → đơn 1 `cancelled`; Pro trả phí còn hạn đặt Plus → `BAD_REQUEST`; hủy đơn người khác → lỗi; thiếu env ngân hàng → lỗi.
- Admin: user thường gọi `admin.*` → `FORBIDDEN`; duyệt đơn → user có gói + hạn đúng, `decidedBy`; duyệt lần 2 → `CONFLICT`; gia hạn cộng dồn; `setPlan` tạo dòng log `source = "admin"`, thiếu `note` → lỗi.
- Test cũ (payment, notice, alerts, import, parent-link, report) vẫn pass nhờ seed Pro.

### E2E (390×844)
- `plan.spec.ts`: `teacher_std` mở sheet Thêm → "Gói của tôi" → thấy Standard, bảng 3 gói → chọn Plus + Năm → tạo mã → thấy QR, nội dung `SM …`, "Chờ xác nhận" → hủy. Không cuộn ngang, nút ≥44px.
- `admin.spec.ts`: `teacher_std` tạo đơn; đăng nhập `admin_test` → `/admin` → xác nhận; `teacher_std` đăng nhập lại thấy Plus + hạn. `teacher` vào `/admin` → 404.
- `plan-locks.spec.ts`: `teacher_std` thấy `UpgradeCard` ở `/reports`, trong sheet học phí, thẻ "Cần chú ý" khóa, nhãn Pro ở nút nhập Excel.

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch.

## 11. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| 2 tài khoản cũ về Standard mất ngay ghi nhận thu/phiếu báo/báo cáo | Dữ liệu giữ nguyên, số tiền vẫn xem ở trang Học phí; người dùng báo trước cho họ; admin có `setPlan` để tặng thêm |
| Tài khoản cũ đang > 10 HS đang học | Kiểm ở 7.3 bước 2; D8 giữ nguyên HS hiện có |
| Biểu thức ngày trong SQL ra mắt lệch múi giờ | Kiểm trên DB test trước; bước 4 của 7.3 đối chiếu `plan_expires_at` (phải là `…T17:00:00` UTC) |
| Nhầm id/username Miss Ly | SQL khớp cặp id + username do người dùng xác nhận; sai thì 0 dòng, admin sửa bằng `setPlan` |
| Quên chặn 1 procedure hoặc khóa UI nhưng server không chặn | Test integration dạng bảng theo mục 6.3; server là chốt chặn thật, UI chỉ để dễ hiểu |
| Người dùng chuyển khoản sai nội dung | Admin đối chiếu theo số tiền + thời điểm, dùng `setPlan` với ghi chú |
| Đếm HS không khóa → vượt giới hạn 1 HS khi bấm đồng thời | Chấp nhận; không ảnh hưởng dữ liệu |
| Lộ quyền admin | Kiểm ở server (`adminProcedure` + `notFound()` ở page), không dựa vào ẩn link; mọi thao tác có dòng `plan_orders` |
| Thêm 1 query đọc user ở procedure bị chặn | Chỉ vài procedure, 1 dòng theo khóa chính; `plan.me` cache 60s như query khác |
