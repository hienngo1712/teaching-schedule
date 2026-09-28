# K — Tổng quan + Doanh thu + báo tài khoản mới cho admin (thẻ số, xu hướng tài khoản, ghi hoạt động theo ngày, doanh thu theo tháng)

> Phần K. Thứ tự người dùng chốt: **P → Q → K → O**. P (`2026-09-27-p-sua-backlog-design.md`, v0.4.1: đơn chờ hết hạn 7 ngày `status = 'expired'`, `admin.pendingCount` dùng chung cho `AdminSidebar` + `AdminTabBar` với chấm số `admin-tab-pending-count`, màn Tài khoản admin có menu Hành động + phân trang) và Q (`2026-09-27-q-xoa-mem-design.md`, xóa mềm toàn app: `users.isDeleted`, thùng rác) merge TRƯỚC K. Nghiệp vụ gói theo I, khu admin theo J, bảng giá/dùng thử theo L, phiên đăng nhập theo N. Có **1 migration** (thêm bảng + 2 cột, không destructive) → **backup Neon trước khi merge**. Không đổi luồng tạo/duyệt đơn, không đổi luật gói. Version **0.6.0**.

Ba phần trong khu admin:
- **Tổng quan** `/admin/overview` (mục nav đầu tiên, trang chủ khu admin): hàng thẻ số + biểu đồ "Xu hướng tài khoản" 7/14/30 ngày.
- **Doanh thu** `/admin/revenue` (mục nav cuối): lọc tháng/khoảng/năm, tổng, tách loại đơn/gói/kỳ, bảng từng tháng, biểu đồ cột.
- **Báo tài khoản mới** trên màn Chờ xác nhận `/admin/orders`: danh sách tài khoản đăng ký mà admin chưa xem (không chặn sử dụng: đăng ký xong dùng ngay).

**Tài khoản đã xóa mềm (Q, `isDeleted`) bị bỏ qua ở mọi số liệu TÀI KHOẢN của K** (thẻ, xu hướng, danh sách tài khoản mới). **Doanh thu VẪN TÍNH đơn của tài khoản đã xóa mềm** (tiền đã nhận; người dùng chốt) và không ghi hoạt động. Tên field/cột thật và helper lọc (nếu Q có) phải đối chiếu code sau Q.

## 1. Bối cảnh

Hiện trạng (đã đọc code ở `main` `86b37ff`, v0.4.0, trước P):

- **`users`** (`prisma/schema.prisma`, model `User`): `id`, `username`, `isActive`, `lastLoginAt` (cập nhật trong `authorizeCredentials` mỗi lần đăng nhập thành công), `createdAt`, `plan`, `planExpiresAt`, `trialEndsAt`, `sessionVersion`, `mustChangePassword`, `updatedAt` (`@updatedAt`). Chưa có gì ghi "lần cuối dùng app".
- **Phiên (N):** "Ghi nhớ đăng nhập" 30 ngày → đếm lượt đăng nhập sẽ rất thấp so với số người thực dùng. `auth()` phía Node dùng callback `nodeJwt` (`src/server/auth-node-callbacks.ts`) → mỗi request đã đăng nhập gọi `getSessionUserState(userId, sessionVersion)` (`src/server/auth-credentials.ts`) đọc `users` (`isActive`, `sessionVersion`, `mustChangePassword`). `auth()` chạy ở layout `(app)`, layout `(admin)`, context tRPC, route backup. Middleware Edge không dùng Prisma.
- **Admin:** `isAdminUsername(username)` (`src/lib/admin.ts`, thuần, Edge dùng được) đọc `ADMIN_USERNAMES`. Admin là tài khoản thường trong `users`.
- **Trang chủ khu admin** hiện là `/admin/orders`, viết cứng ở 5 chỗ: `src/app/(admin)/admin/page.tsx` (`redirect`), `src/app/(app)/layout.tsx` (admin vào route giáo viên), `src/app/login/page.tsx`, `src/server/auth.config.ts` (middleware, `Response.redirect`), `src/components/layout/AppHeader.tsx` (menu "Quản trị"). Test kiểm: `tests/unit/auth-authorized.test.ts`, `tests/unit/layout/admin-redirect.test.ts`, `tests/unit/components/AppHeader.test.tsx`, các e2e `loginAs` chờ `/admin\/orders$/` (`admin*.spec.ts`).
- **`plan_orders`** (model `PlanOrder`): `period` null với đơn admin đặt tay; `status` ∈ `pending | approved | rejected | cancelled` (+ trạng thái hết hạn của P); `source` ∈ `user` (mặc định, giáo viên tự tạo) `| admin` (`adminSetPlan` 0đ và 2 dòng migration `launch_plan_grants` 0đ, `decided_by 'migration'`); `creditDays > 0` chỉ khi Pro nâng cấp có quy đổi (D7); `decidedAt` ghi lúc duyệt/từ chối.
- **Khu admin:** `src/app/(admin)/admin/{orders,accounts,history,prices}/page.tsx` (mỗi page `return <AdminX />`), `admin-nav.ts` (`ADMIN_NAV_ITEMS` 4 mục), `AdminSidebar` (badge số đơn chờ ở mục `/admin/orders` từ `admin.overview`), `AdminTabBar` (`grid-cols-4`), `admin-format.ts` (`dateOrDash`, `dateTimeVn`, `periodKey`). Router `admin` (`adminProcedure`); tên `admin.overview` **đã dùng** cho dữ liệu màn Đơn chờ/Tài khoản (`getAdminOverview`) → procedure mới không dùng tên này.
- `src/lib/utils.ts`: `vnDateParts`, `formatCurrency` (`"490.000 đ"`), `formatTime` (đọc giờ UTC). `src/lib/plans.ts`: `effectivePlan`, `isPaidPlan`, `isPeriod`, `vnStartOfDay`, `addDays`.
- `package.json`: **không có thư viện biểu đồ**. Có `lucide-react` 1.11 (`LayoutDashboard`, `ChartColumn`).
- `tests/setup.ts` xóa `users` mỗi lượt test (`db.user.deleteMany()`), không biết bảng mới → FK từ bảng mới tới `users` phải `ON DELETE CASCADE` (RESTRICT sẽ làm vỡ setup; không sửa `tests/setup.ts`).
- tRPC không transformer: `Date` về client là chuỗi ISO.

## 2. Mục tiêu và tiêu chí hoàn thành

- Admin đăng nhập → vào `/admin/overview`; `/admin` và mọi chỗ đang về `/admin/orders` đổi về `/admin/overview`. Nav 6 mục: Tổng quan, Đơn chờ, Tài khoản, Lịch sử, Bảng giá, Doanh thu.
- **Tổng quan:** 9 thẻ số (mục 4, nhóm A) có dòng "Cập nhật lúc dd/mm HH:mm" (giờ VN); thẻ Chờ duyệt bấm được → `/admin/orders`, > 0 thì cảnh báo amber. Biểu đồ "Xu hướng tài khoản" với nút 7 / 14 / 30 ngày, 4 thẻ phụ, cột đôi Tài khoản mới / Quay lại theo ngày VN, cột hôm nay mờ.
- **Ghi hoạt động:** mỗi tài khoản giáo viên có request đã đăng nhập trong 1 ngày VN → 1 dòng `user_activity_days`; `users.last_active_at` cập nhật tối đa ~1 lần/giờ; không ghi admin; lỗi ghi không chặn request.
- **Doanh thu:** như mục 4 nhóm C.
- **Tài khoản mới:** màn Chờ xác nhận có mục "Tài khoản mới" (chưa xem): Đã xem / Đặt gói / Đặt dùng thử từng dòng, "Đánh dấu tất cả đã xem"; sidebar có thêm số tài khoản mới, tab bar mobile có chấm; thẻ Chờ duyệt ở Tổng quan có dòng phụ "N tài khoản mới chưa xem".
- Giáo viên gọi `admin.stats` / `admin.accountTrend` / `admin.revenue` / `admin.newAccounts` / `admin.markAccountsSeen` → `FORBIDDEN`.
- Tài khoản đã xóa mềm không xuất hiện trong thẻ, xu hướng, tài khoản mới; doanh thu vẫn giữ đơn của họ.
- Mobile 390px không tràn ngang; nút/ô chọn ≥44px; tab bar 6 tab không tràn. `pnpm lint`, `tsc`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch; `theme-legacy-colors` pass.

## 3. Quyết định đã chốt (người dùng)

| # | Nội dung |
|---|---|
| K1 | Màn "Doanh thu" là mục nav mới trong khu admin |
| K2 | Doanh thu lọc theo tháng, khoảng tháng, hoặc năm |
| K3 | Doanh thu có số tổng, bảng từng tháng, biểu đồ cột theo tháng |
| K4 | Doanh thu tách đơn mới / gia hạn, theo gói Plus/Pro, theo kỳ tháng / 1 năm / 2 năm |
| K5 | Doanh thu chỉ cộng đơn đã duyệt, theo ngày duyệt (`decidedAt`) giờ VN. Bỏ đơn từ chối / hủy / hết hạn / admin đặt tay 0đ / dòng migration |
| K6 | Tổng tiền là số nguyên đồng, hiển thị kiểu VN |
| K7 | Màn **Tổng quan** là trang đầu khu admin, mục nav đầu tiên |
| K8 | Thẻ số: Tổng tài khoản (không tính admin), Đang hoạt động (`isActive`), Chờ duyệt (= đơn mua gói đang chờ; bấm → `/admin/orders`; > 0 cảnh báo), Active 24h, Active 7 ngày, Đang trả phí (tách Plus/Pro, còn hạn), Đang dùng thử (còn hạn), Sắp hết hạn ≤ 30 ngày (trả phí hoặc dùng thử), Standard sau dùng thử (hết dùng thử, không có gói trả phí còn hạn, vẫn còn hoạt động). Có dòng "Cập nhật lúc" |
| K9 | Thẻ viền trên màu theo nhóm, bảng màu A3 (#0F766E + amber/red cảnh báo), không indigo/violet |
| K10 | Biểu đồ "Xu hướng tài khoản": nút 7/14/30 ngày; 4 thẻ phụ (Tài khoản mới, Trung bình/ngày, Lượt quay lại, Ngày đông người mới nhất); cột đôi Tài khoản mới / Tài khoản cũ quay lại theo ngày; cột hôm nay mờ; "Quay lại" = có hoạt động lại (không chỉ đăng nhập). Dùng chung component biểu đồ cột với Doanh thu |
| K11 | **Có migration**: bảng `user_activity_days(user_id, day DATE, first_seen_at)` unique (user_id, day) + cột `users.last_active_at`. Ghi phía Node khi có request đã đăng nhập, có throttle, `INSERT … ON CONFLICT DO NOTHING`, không tính admin, ghi lỗi không chặn request (log warn). Tài khoản đăng ký hôm nay là "mới", không "quay lại". Số liệu chỉ có từ lúc triển khai (ghi rõ trên UI). Ngày theo giờ VN |
| K12 | Active 24h theo `last_active_at`; Active 7 ngày = số tài khoản khác nhau trong `user_activity_days` 7 ngày VN gần nhất |
| K13 | Version **0.6.0**. Thứ tự P → Q → K → O |
| K14 | Báo tài khoản mới đăng ký về admin, **không** chặn sử dụng. Mục "Tài khoản mới" ở màn Chờ xác nhận: username, họ tên, ngày giờ đăng ký, gói hiện tại; mỗi dòng "Đã xem", lối tắt Đặt gói / Đặt dùng thử (dialog có sẵn; đặt xong tự đánh dấu đã xem); "Đánh dấu tất cả đã xem". Không tính admin |
| K15 | Lưu bằng cột `users.admin_seen_at TIMESTAMP NULL`, gộp migration của K; backfill mọi tài khoản đã có lúc triển khai = đã xem. `admin.newAccounts`, `admin.markAccountsSeen({ userIds } \| { all: true })`; `setPlan`/`setUserTrial` tự đặt `admin_seen_at` nếu null. Số chưa xem hiện ở sidebar/tab bar (cộng hoặc tách, người viết spec chọn); thẻ Chờ duyệt: số đơn chờ + dòng phụ "N tài khoản mới chưa xem" |
| K16 | Thẻ Tổng quan, xu hướng, Tài khoản mới bỏ qua tài khoản đã xóa mềm (Q). **Doanh thu vẫn tính đơn của tài khoản đã xóa mềm**: xóa tài khoản không làm doanh thu quá khứ thay đổi (người dùng chốt) |
| K17 | Số ngày dùng thử mặc định người dùng sẽ tự đặt (có thể 0) qua `/admin/prices`: K không được giả định 60 |

## 4. Quyết định do người viết spec chọn (cần duyệt)

### Nhóm A — Thẻ số Tổng quan

Mọi thẻ **không tính admin** (`isAdminUsername`, đọc lúc truy vấn) và **không tính tài khoản đã xóa mềm** (`isDeleted = true`, Q; kể cả thẻ Tổng tài khoản). "Còn hạn" = mốc > `now`.

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| A1 | Tổng tài khoản | Mọi `users` không phải admin, **kể cả bị khóa** | "Đã đăng ký" |
| A2 | Đang hoạt động | `isActive = true` | Đúng yêu cầu; khác "Active 24h/7 ngày" (có dùng app) |
| A3 | Các thẻ gói (Trả phí, Dùng thử, Sắp hết hạn, Standard sau dùng thử) có tính tài khoản bị khóa không | **Không**: chỉ `isActive = true` | Tài khoản khóa không dùng được app, đếm vào "đang trả phí" gây hiểu nhầm |
| A4 | Đang trả phí | `plan ∈ {plus, pro}` và `planExpiresAt > now`, tách theo `plan`. **Tính cả** khi đang có dùng thử song song | Người đã trả tiền và gói còn hạn. `effectivePlan` hiện Plus + dùng thử là "trial Pro" (D5), nhưng về tiền họ là người trả phí |
| A5 | Đang dùng thử | `trialEndsAt > now` và **không** có gói trả phí còn hạn | Tách rời A4 để 2 thẻ không đếm trùng |
| A6 | Sắp hết hạn ≤ 30 ngày | Trả phí còn hạn có `planExpiresAt ≤ now + 30 ngày` **cộng** dùng thử (theo A5) có `trialEndsAt ≤ now + 30 ngày`. Thẻ hiện tổng, dòng nhỏ "x trả phí · y dùng thử". > 0 → viền amber | Plus trả phí có dùng thử sắp hết không bị tụt về free nên không tính |
| A7 | "Còn hoạt động" cho thẻ Standard sau dùng thử | `last_active_at ≥ now − 30 ngày` | 30 ngày khớp phiên "Ghi nhớ" (N) và mốc "Sắp hết hạn"; người bỏ app hơn 30 ngày không còn là khách cần chăm sóc |
| A8 | Standard sau dùng thử | `isActive`, `trialEndsAt` khác null và `≤ now`, không có gói trả phí còn hạn, còn hoạt động (A7). **Gồm cả** người từng trả phí đã hết hạn | Đúng định nghĩa người dùng ("hết dùng thử, vẫn dùng bản free"). Tài khoản `trialEndsAt = null` (tạo trước I, hoặc dùng thử 0 ngày) không tính: chưa từng dùng thử |
| A9 | Chờ duyệt | Số đơn chờ = `getPendingCount(db)` của P (expire đơn quá 7 ngày rồi đếm `pending`), dòng phụ "N tài khoản mới chưa xem" khi N > 0 (nhóm R). Viền amber khi có đơn chờ | Cùng hàm với badge sidebar/tab bar → không lệch |
| A10 | Active 24h | `last_active_at ≥ now − 24h` | Cửa sổ trượt 24h; độ chính xác ≤ 1 giờ do throttle (B2) |
| A11 | Active 7 ngày | `COUNT(DISTINCT user_id)` trong `user_activity_days` có `day ≥ hôm nay VN − 6` (7 ngày VN gồm hôm nay) | Đúng K12; nhất quán với biểu đồ theo ngày VN. Ghi rõ trên thẻ: "7 ngày gần nhất (giờ VN)" |
| A12 | Nguồn tính thẻ | 1 truy vấn `users` (7 cột, vài chục–vài trăm dòng) → hàm thuần `computeAccountCards`; Active 7 ngày 1 câu SQL `COUNT(DISTINCT)`; Chờ duyệt 1 `count` | Luật gói (A4–A8) phải khớp `plans.ts`, viết 1 lần trong hàm thuần test được; số tài khoản nhỏ nên đọc hết users rẻ hơn 6 câu `count` với điều kiện lồng |
| A13 | "Cập nhật lúc" | `updatedAt` = giờ server lúc tính, hiện `dd/mm HH:mm` giờ VN. Không nút làm mới (react-query tự refetch khi quay lại tab) | Đủ cho admin biết số liệu mới cỡ nào |
| A14 | Màu viền trên | Nhóm Tài khoản (Tổng, Đang hoạt động): `border-t-primary`; nhóm Hoạt động (Active 24h, 7 ngày, Standard sau dùng thử): `border-t-teal-400`; nhóm Gói (Trả phí, Dùng thử): `border-t-emerald-600`; cảnh báo (Chờ duyệt > 0, Sắp hết hạn > 0): `border-t-amber-500` + số `text-amber-700`; Chờ duyệt = 0 / Sắp hết hạn = 0: `border-t-slate-300` | Theo A3; không indigo/violet/purple. Đỏ chỉ dùng cho lỗi, không cho số liệu |

### Nhóm B — Ghi hoạt động theo ngày

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| B1 | Ghi ở đâu | Trong `nodeJwt`, **sau** khi `getSessionUserState` xác nhận phiên hợp lệ. `getSessionUserState` select thêm `username`, `lastActiveAt` và trả thêm 2 trường này (không thêm truy vấn đọc) | `auth()` Node đã tra `users` mỗi request (N Q11); tận dụng dòng đã đọc để quyết định có ghi hay không → request thường không tốn thêm truy vấn nào |
| B2 | Throttle | Ghi khi `last_active_at` null, **hoặc** cách `now` ≥ 1 giờ (`ACTIVITY_TOUCH_MS`), **hoặc** khác ngày VN với `now`. Mỗi lần ghi: `INSERT INTO user_activity_days … ON CONFLICT (user_id, day) DO NOTHING` (Prisma `createMany({ skipDuplicates: true })`) + `UPDATE users SET last_active_at = now` (raw, để **không** đụng `updated_at`), cùng 1 `$transaction` | Không lưu mốc trong JWT: token đổi trong `auth()` ở Server Component không ghi lại cookie được, và middleware Edge không chạy `nodeJwt`. So `last_active_at` từ DB thì luôn đúng. 1 giờ giữ Active 24h chính xác ≤ 1 giờ mà mỗi người chỉ ≤ 24 lần ghi/ngày. Điều kiện "khác ngày" để 23:50 rồi 00:10 vẫn có dòng cho ngày mới |
| B3 | Không ghi admin | `isAdminUsername(username)` → bỏ qua (không ghi cả `last_active_at`) | Đúng K11 |
| B4 | Lỗi ghi | `try/catch`, `console.warn("[activity] …")`, `nodeJwt` vẫn trả token | Không chặn request (K11). Có `await` (không bắn-rồi-quên) vì hàm serverless có thể bị dừng sau khi trả response |
| B5 | Vừa đăng nhập (`params.user`) | Không ghi ở lượt đó (nhánh này không tra DB); request kế tiếp (redirect về dashboard) ghi | Giữ đúng tối ưu của N |
| B6 | Request công khai (link phụ huynh, `/login`) | Không ghi | Không có phiên |
| B7 | Bảng `user_activity_days` | `user_id INT` FK `users(id)` **ON DELETE CASCADE**, `day DATE` (ngày VN), `first_seen_at TIMESTAMP(3)`; PK `(user_id, day)`; index `(day)` | CASCADE để `tests/setup.ts` xóa users không vỡ và xóa tài khoản kéo theo dữ liệu hoạt động (vô nghĩa khi mất user). PK kép thay cho `id` + unique: không cần id riêng. Index `day` cho truy vấn theo khoảng ngày |
| B8 | Cột `users.last_active_at` | `TIMESTAMP(3)` nullable. Migration **backfill** `last_active_at = last_login_at` | Active 24h và "Standard sau dùng thử" có số hợp lý ngay khi lên, thay vì 0 tới khi mọi người quay lại. Chỉ ghi vào cột mới, không đổi dữ liệu cũ |
| B9 | Không backfill `user_activity_days` | Bảng bắt đầu rỗng; `trackingSince` = `MIN(day)` | Dựng ngày hoạt động từ `last_login_at` sẽ sai (chỉ 1 ngày/người). UI ghi rõ "Lượt quay lại được ghi từ dd/mm/yyyy" |
| B10 | Ngày VN cho cột DATE | `vnDayDate(now) = new Date(Date.UTC(y, m − 1, d))` với `y/m/d = vnDateParts(now)`; chuỗi ngày `vnDayKey(now) = "YYYY-MM-DD"` | Prisma gửi `Date` cho cột `@db.Date` theo phần ngày UTC; nửa đêm UTC của ngày VN giữ đúng ngày |

### Nhóm R — Báo tài khoản mới (admin_seen_at)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| R1 | "Tài khoản mới chưa xem" | `adminSeenAt IS NULL` **và** không phải admin **và** `isDeleted = false`. Sắp `createdAt desc, id desc`, trả tối đa 100 dòng + `total` | Vài chục tài khoản; 100 dòng đủ, `total` cho badge |
| R2 | Mỗi dòng hiện gì | username, họ tên, ngày giờ đăng ký (`dateTimeVn`, giờ VN), gói hiện tại (`effectivePlan`: nhãn gói + nguồn Dùng thử/Trả phí/Miễn phí) | Đúng K14. Không giả định số ngày dùng thử (K17): hiện đúng cái đang có |
| R3 | Lối tắt Đặt gói / Đặt dùng thử | Mở **đúng** `SetPlanDialog` / `TrialDaysDialog` có sẵn. 2 dialog nhận `user: RouterOutputs["admin"]["overview"]["users"][number]`; màn Chờ xác nhận đã gọi `admin.overview` nên tra dòng user theo `id` trong `overview.users` rồi truyền vào (không đổi prop dialog) | Không nhân bản dialog, không thêm query |
| R4 | Tự đánh dấu đã xem khi đặt gói/dùng thử | Server: `adminSetPlan` và `setUserTrialDays` chạy thêm `user.updateMany({ where: { id, adminSeenAt: null }, data: { adminSeenAt: now } })` trong cùng transaction | Đúng K15; làm ở server để mọi đường gọi (cả màn Tài khoản) đều tính là đã xem |
| R5 | `admin.markAccountsSeen` | Input `{ userIds: number[] (1..200 phần tử) } \| { all: true }`. `updateMany where adminSeenAt IS NULL [AND id IN userIds]` → `{ count }`. `all` chỉ đánh dấu các dòng đang chưa xem (không đụng dòng đã xem) | Idempotent: bấm 2 lần không đổi mốc đã xem |
| R6 | Migration | Cột `admin_seen_at TIMESTAMP(3)` nullable; backfill `UPDATE users SET admin_seen_at = now() AT TIME ZONE 'UTC' WHERE admin_seen_at IS NULL` | K15; cùng cách ghi thời điểm như `launch_plan_grants` |
| R7 | Badge: cộng hay tách | **Tách.** Sidebar mục Chờ xác nhận: pill amber = số đơn chờ (của P, giữ nguyên) + pill teal viền = số tài khoản mới (`data-testid="admin-new-accounts-count"`), mỗi pill có `aria-label` riêng. Tab bar mobile: giữ chấm số đơn chờ của P; thêm **chấm tròn không số** màu teal (`data-testid="admin-tab-new-dot"`) khi có tài khoản mới | Hai việc khác mức độ gấp (đơn chờ = tiền, cần xử lý; tài khoản mới = để biết). Cộng lại làm admin tưởng có đơn chờ. Tab bar 6 mục chỉ ~65px/tab nên chỉ thêm chấm |
| R8 | Nguồn số cho badge | Mở rộng `admin.pendingCount` của P: trả `{ count, newAccounts }` (thêm 1 `count` users) | 1 request nhẹ dùng chung sidebar + tab bar như P; không thêm query thứ 2 mỗi trang admin |
| R9 | Vị trí trên màn Chờ xác nhận | Khối "Tài khoản mới" **dưới** danh sách đơn chờ (đơn chờ gấp hơn), tiêu đề + số, nút "Đánh dấu tất cả đã xem" (AlertDialog xác nhận khi > 1 dòng). `ResponsiveList`, thẻ mobile `new-account-card`. Trống → "Không có tài khoản mới" | Không làm lệch bố cục đơn chờ hiện có |
| R10 | Tài khoản tạo bằng script (`user:create`) | Cũng hiện (adminSeenAt null) | Đúng nghĩa "tài khoản mới" |

### Nhóm T — Xu hướng tài khoản

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| T1 | Dải ngày | N ∈ {7, 14, 30} ngày VN **gồm hôm nay** (`lastNDays(now, n)`); mặc định 7 | Hôm nay là cột cuối, hiện mờ (K10) |
| T2 | Tài khoản mới/ngày | Số `users` (không admin) có ngày VN của `created_at` = ngày đó. SQL `GROUP BY to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')` | Có dữ liệu cho cả quá khứ (không phụ thuộc bảng mới) |
| T3 | Quay lại/ngày | Số dòng `user_activity_days` ngày đó của user không admin **và** ngày ≠ ngày VN tạo tài khoản của user đó. SQL `JOIN users … GROUP BY day` | Đúng K11 (đăng ký hôm nay là "mới"). 1 user tối đa 1 dòng/ngày nên đếm dòng = đếm người |
| T4 | 4 thẻ phụ | **Tài khoản mới** = tổng T2 trong dải; **Trung bình/ngày** = tổng mới / N, làm tròn 1 chữ số thập phân (hiện kiểu VN "0,4"); **Lượt quay lại** = tổng T3 trong dải (lượt người-ngày); **Ngày đông người mới nhất** = ngày có nhiều tài khoản mới nhất, hòa thì lấy ngày **gần đây hơn**, hiện "dd/mm · n tài khoản"; không có ai mới → "-" | "Mới nhất" hiểu là "gần nhất" khi hòa |
| T5 | Trước mốc ghi | `trackingSince` = `MIN(day)` của bảng (null nếu rỗng). Ngày đầu dải < `trackingSince` hoặc null → dòng chú thích amber nhạt "Lượt quay lại được ghi từ dd/mm/yyyy" / "Chưa có dữ liệu hoạt động" | Đúng K11 |
| T6 | Biểu đồ | Component chung `BarChart` (C9) chế độ `grouped`: mỗi ngày 2 cột (mới `bg-primary`, quay lại `bg-teal-300`); cột hôm nay `opacity-50` + chú thích "Hôm nay (chưa hết ngày)"; nhãn trục X `dd/mm`; tất cả 0 → "Chưa có số liệu trong khoảng này" | K10 |
| T7 | Procedure | `admin.stats` (thẻ) và `admin.accountTrend({ days })` (xu hướng) tách riêng | Đổi 7/14/30 chỉ tải lại xu hướng |

### Nhóm C — Doanh thu

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| C1 | Đơn nào được cộng | `status = "approved"` **và** `source = "user"` **và** `amount > 0` **và** `plan ∈ {plus, pro}` **và** `period ∈ {month, year, 2year}` **và** `decidedAt` khác null. **Không** lọc tài khoản đã xóa mềm (K16: tiền đã nhận, doanh thu quá khứ không đổi khi xóa tài khoản) | `source = "user"` loại `adminSetPlan` lẫn 2 dòng migration (đều `source "admin"`, 0đ). Lọc `plan`/`period` vì cột VARCHAR: giá trị lạ không làm vỡ phép chia nhóm |
| C2 | Gom tháng theo giờ nào | Tháng của `vnDateParts(decidedAt)`; biên tháng `vnMonthStart(y, m) = Date.UTC(y, m − 1, 1) − 7h` | Duyệt 23:30 ngày 31/10 giờ VN (16:30 UTC) vào tháng 10 |
| C3 | **Đơn mới** / **gia hạn** | Xét các đơn được cộng (C1) của cùng `userId`, xếp `decidedAt` rồi `id`. Đơn đầu tiên = **mới**; các đơn sau = **gia hạn** (trừ nâng cấp, C4). Xét **toàn bộ lịch sử** (cả đơn trước khoảng lọc) | "Mới" = lần đầu trả tiền; có sẵn dữ liệu, không cần cột mới. Cách "còn gói lúc duyệt thì là gia hạn" cần `planExpiresAt` tại thời điểm duyệt → không lưu |
| C4 | Đơn Plus→Pro có quy đổi | **Mặc định đề xuất: nhóm riêng "Nâng cấp"** = đơn Pro có `creditDays > 0`, ưu tiên trên C3. **CÂU HỎI** (mục 14) | `creditDays > 0` là dấu vết chắc chắn duy nhất của nâng cấp (D7). Tách riêng vẫn cộng tay được, gộp sẵn thì mất thông tin. Tiền cộng là `amount` đầy đủ (quy đổi là ngày, không phải tiền) |
| C5 | Trường hợp lẻ | (a) Từng được tặng gói 0đ rồi mua lần đầu → **mới**. (b) Plus hết hạn rồi mua Pro (`creditDays = 0`) → **gia hạn**. (c) Plus còn hạn nhưng đơn Plus gần nhất 0đ → `creditDays = 0` → theo C3. (d) Cùng `decidedAt` → `id` nhỏ hơn trước. (e) Mua lần đầu là Pro có quy đổi không thể xảy ra | Test chốt |
| C6 | Tính ở đâu | Service đọc **mọi đơn được cộng có `decidedAt` < cuối khoảng** (1 truy vấn, 7 cột) → hàm thuần `buildRevenueReport` (`src/lib/revenue.ts`) | Vài trăm đơn/năm; cần đơn trước khoảng để phân loại; không `groupBy` SQL vì phân loại theo thứ tự từng user |
| C7 | Giới hạn khoảng | Tháng 1..12, năm 2020..2100; `to ≥ from`; tối đa **36 tháng**. Sai → `BAD_REQUEST`; client chặn trước, hiện lỗi tại chỗ, ẩn số liệu, không gọi query | Chặn gửi mảng tháng khổng lồ |
| C8 | Năm trong ô chọn | `REVENUE_FIRST_YEAR = 2026` → năm hiện tại giờ VN | Không có đơn trước 2026 |
| C9 | Biểu đồ | **Div/CSS thuần, không thêm thư viện.** Component chung `BarChart` (`stacked` cho Doanh thu, `grouped` cho Xu hướng). Doanh thu: cột chồng mới `bg-primary`, gia hạn `bg-teal-300`, nâng cấp `bg-amber-400`; `aria-label` "Tháng 10/2026: 1.470.000 đ"; nhãn X "10/26"; giá trị lớn nhất ở đỉnh; khung `overflow-x-auto`, cột `min-w-[20px]` | recharts ~100 KB gzip + d3 cho 2 biểu đồ cột là thừa; div theo % chiều cao ~80 dòng, test được bằng style height. Bảng từng tháng là bản dễ đọc cho trình đọc màn hình |
| C10 | Biểu đồ khi 1 tháng | Ẩn; tổng 0 → "Chưa có doanh thu trong khoảng này" | 1 cột không nói gì thêm |
| C11 | Trạng thái lọc | `useState`, không lên URL | `page.tsx` cấm `searchParams` (`next15-contract`) |
| C12 | Xuất Excel, danh sách đơn trong tháng | Ngoài phạm vi | Không yêu cầu; đã có màn Lịch sử đơn |

### Nhóm N — Nav và trang chủ admin

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| N1 | Thứ tự nav | Tổng quan (`/admin/overview`, `LayoutDashboard`), Đơn chờ, Tài khoản, Lịch sử, Bảng giá, Doanh thu (`/admin/revenue`, `ChartColumn`). `AdminTabBar` `grid-cols-6` | K7; Doanh thu cạnh Bảng giá (cùng chủ đề tiền) |
| N2 | Trang chủ admin | Hằng `ADMIN_HOME = "/admin/overview"` trong `src/lib/admin.ts` (thuần, Edge dùng được); thay 5 chỗ viết cứng `/admin/orders` ở mục 1 | 1 nguồn, không sót |
| N3 | Tab bar 6 mục ở 390px | 65px/tab, chữ 11px `truncate` sẵn; nhãn ngắn: Tổng quan, Đơn chờ, Tài khoản, Lịch sử, Bảng giá, Doanh thu | Đủ chỗ (≤ 9 ký tự), vùng chạm cao 56px |

## 5. Phạm vi

### Trong phạm vi
- Migration `add_user_activity`: bảng `user_activity_days`, cột `users.last_active_at` + backfill, cột `users.admin_seen_at` + backfill.
- `src/lib/activity.ts` (thuần), `src/server/services/activity.service.ts`; sửa `getSessionUserState`, `nodeJwt`.
- `src/lib/admin-stats.ts` (thuần: thẻ, dải ngày, xu hướng), `src/server/services/admin-stats.service.ts` (thẻ, xu hướng, tài khoản mới).
- `src/lib/revenue.ts` (thuần), `src/server/services/revenue.service.ts`.
- `src/lib/schemas/plan.ts`: `revenueQuerySchema`, `accountTrendSchema`, `markAccountsSeenSchema`.
- Router admin: `stats`, `accountTrend`, `revenue`, `newAccounts`, `markAccountsSeen`; mở rộng `pendingCount` (P) thêm `newAccounts`; `adminSetPlan`/`setUserTrialDays` tự đánh dấu đã xem.
- `ADMIN_HOME` + 5 chỗ chuyển hướng; nav 6 mục.
- UI: `/admin/overview` (`AdminOverview.tsx`, `AccountTrend.tsx`), `/admin/revenue` (`AdminRevenue.tsx`), `BarChart.tsx` dùng chung; khối `NewAccounts.tsx` trong `AdminPendingOrders`; pill/chấm tài khoản mới ở `AdminSidebar`/`AdminTabBar`.
- i18n vi/en; test unit/integration/e2e; version 0.6.0.

### Ngoài phạm vi (YAGNI)
- Xuất Excel/CSV, so sánh cùng kỳ, % tăng trưởng, doanh thu theo tài khoản, doanh thu dự kiến.
- Biểu đồ giờ trong ngày, bản đồ nhiệt, danh sách "ai hoạt động hôm nay".
- Duyệt/chặn tài khoản mới (K14: chỉ báo, không chặn). Email/thông báo đẩy khi có tài khoản mới.
- Dọn dữ liệu `user_activity_days` cũ (vài chục người × 365 ngày/năm là nhỏ).
- Lưu bộ lọc lên URL; nút làm mới.

## 6. Dữ liệu / migration

### 6.1 Prisma

```prisma
model User {
  // ... giữ nguyên các field
  lastActiveAt  DateTime?  @map("last_active_at")
  adminSeenAt   DateTime?  @map("admin_seen_at")
  activityDays  UserActivityDay[]
}

// 1 dòng / tài khoản / ngày VN có dùng app (spec K B7). CASCADE để xóa user (tests/setup.ts) không vỡ.
model UserActivityDay {
  userId      Int      @map("user_id")
  day         DateTime @db.Date
  firstSeenAt DateTime @map("first_seen_at")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, day])
  @@index([day])
  @@map("user_activity_days")
}
```

### 6.2 Migration

`prisma/migrations/<ts>_add_user_activity/migration.sql`, sinh bằng `prisma migrate dev --create-only` trên DB test local, **thêm tay** backfill cuối file:

```sql
-- Có số Active 24h / "Standard sau dùng thử" ngay khi lên (spec K B8); chỉ ghi vào cột mới.
UPDATE "users" SET "last_active_at" = "last_login_at" WHERE "last_active_at" IS NULL;
-- Tài khoản có sẵn lúc triển khai coi như admin đã xem (spec K R6), danh sách "Tài khoản mới" không ngập tài khoản cũ.
UPDATE "users" SET "admin_seen_at" = now() AT TIME ZONE 'UTC' WHERE "admin_seen_at" IS NULL;
```

Chỉ `ALTER TABLE "users" ADD COLUMN` (2 cột nullable), `CREATE TABLE`, `CREATE INDEX`, `ADD CONSTRAINT … FOREIGN KEY … ON DELETE CASCADE`, và 2 `UPDATE` vào 2 cột vừa thêm. Không destructive; chạy lại trên DB rỗng vẫn đúng.

## 7. Backend

### 7.1 `src/lib/activity.ts` (MỚI, thuần)

```ts
export const ACTIVITY_TOUCH_MS = 60 * 60 * 1000
export function vnDayKey(d: Date): string          // "YYYY-MM-DD" theo giờ VN
export function vnDayDate(d: Date): Date           // Date.UTC(y, m-1, d) cho cột DATE
export function shouldTouch(lastActiveAt: Date | null, now: Date): boolean
```

### 7.2 `src/server/services/activity.service.ts` (MỚI)

```ts
export async function touchActivity(db: PrismaClient, u: { id: number; username: string; lastActiveAt: Date | null }, now: Date): Promise<void>
```
Admin hoặc `!shouldTouch` → return. Ngược lại `db.$transaction([ db.userActivityDay.createMany({ data: [{ userId, day: vnDayDate(now), firstSeenAt: now }], skipDuplicates: true }), db.$executeRaw\`UPDATE "users" SET "last_active_at" = ${now} WHERE "id" = ${u.id}\` ])` trong `try/catch` → `console.warn`.

### 7.3 `getSessionUserState` / `nodeJwt`

- `getSessionUserState`: select thêm `username`, `lastActiveAt`; trả `{ mustChangePassword, username, lastActiveAt }`.
- `nodeJwt`: sau khi có `state`, `await touchActivity(db, { id: Number(t.userId), username: state.username, lastActiveAt: state.lastActiveAt }, new Date())`, rồi như cũ.

### 7.4 `src/lib/admin-stats.ts` (MỚI, thuần)

```ts
export const EXPIRING_DAYS = 30
export const STILL_ACTIVE_DAYS = 30
export const TREND_RANGES = [7, 14, 30] as const
export type StatUser = { isActive: boolean; plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null; lastActiveAt: Date | null }
export type AccountCards = {
  totalAccounts: number; activeAccounts: number; active24h: number
  paying: { plus: number; pro: number }; trial: number
  expiringSoon: { paid: number; trial: number }; standardAfterTrial: number
}
export function computeAccountCards(users: StatUser[], now: Date): AccountCards   // users đã loại admin
export type DayCount = { day: string; count: number }
export type TrendDay = { day: string; newAccounts: number; returning: number; isToday: boolean }
export type AccountTrend = {
  days: TrendDay[]
  totals: { newAccounts: number; avgPerDay: number; returning: number; busiestDay: DayCount | null }
  trackingSince: string | null
}
export function lastNDays(now: Date, n: number): string[]          // cũ → mới, phần tử cuối = hôm nay VN
export function buildAccountTrend(days: string[], newRows: DayCount[], returningRows: DayCount[], trackingSince: string | null): AccountTrend
```

### 7.5 `src/server/services/admin-stats.service.ts` (MỚI)

```ts
export type AdminStats = AccountCards & { active7d: number; pendingOrders: number; updatedAt: Date }
export async function getAdminStats(db: PrismaClient, now?: Date): Promise<AdminStats>
export async function getAccountTrend(db: PrismaClient, days: 7 | 14 | 30, now?: Date): Promise<AccountTrend>
```
- Danh sách admin: `adminUsernames()` (MỚI trong `src/lib/admin.ts`, tách từ `isAdminUsername`), truyền vào SQL dạng `text[]` (`NOT (u.username = ANY(${admins}::text[]))`, mảng rỗng vẫn đúng).
- Mọi truy vấn lọc `isDeleted = false` (Prisma) / `u.is_deleted = false` (SQL) — tên thật theo Q.
- `getAdminStats`: `findMany` users (5 cột + `username`, `where isDeleted false`) → lọc admin → `computeAccountCards`; Active 7 ngày: `SELECT COUNT(DISTINCT a.user_id)::int … WHERE a.day >= ${start}::date AND NOT admin AND NOT deleted`; Chờ duyệt: `getPendingCount(db)` của P; thêm `newAccounts` (R1 đếm).
- `getAccountTrend`: 2 câu `$queryRaw` T2/T3 (trả `day` dạng chuỗi `to_char`), `trackingSince` = `SELECT to_char(MIN(day), 'YYYY-MM-DD')` → `buildAccountTrend`.
- Tài khoản mới (file riêng `src/server/services/new-accounts.service.ts` để `plan-admin.service.ts` và `admin-stats.service.ts` cùng dùng mà không import vòng): `newAccountsWhere()` (điều kiện R1), `countNewAccounts(db)`, `getNewAccounts(db): Promise<{ items: NewAccountRow[]; total: number }>` (`NewAccountRow = { id, username, fullName, createdAt, plan, source }` với `plan/source` từ `effectivePlan`), `markAccountsSeen(db, admin, input): Promise<{ count }>` (R5, log `console.info`).

### 7.5b Sửa service sẵn có (R4, R8)

- `adminSetPlan` (`plan-admin.service.ts`) và `setUserTrialDays` (`trial.service.ts`): trong transaction thêm `tx.user.updateMany({ where: { id: input.userId, adminSeenAt: null }, data: { adminSeenAt: new Date() } })`.
- `getPendingCount` (P): trả `{ count, newAccounts: await countNewAccounts(db) }`.

### 7.6 Doanh thu

`src/lib/revenue.ts` (thuần): `YearMonth`, `RevenueKind`, `REVENUE_KINDS`, `RevenueBucket`, `RevenueStats`, `RevenueMonth`, `RevenueReport`, `RevenueOrder`, `RevenueFilter`, `REVENUE_MAX_MONTHS = 36`, `REVENUE_FIRST_YEAR = 2026`, `vnMonthStart`, `monthIndex`, `nextMonth`, `monthsBetween`, `filterToRange`, `rangeError`, `emptyStats`, `classifyOrders`, `buildRevenueReport`. `src/server/services/revenue.service.ts`: `getRevenue(db, input)` (C1, C6).

### 7.7 Schema zod (`src/lib/schemas/plan.ts`)

```ts
export const revenueQuerySchema = z.object({ from: yearMonth, to: yearMonth }).refine(/* C7 thứ tự */).refine(/* C7 ≤ 36 tháng */)
export const accountTrendSchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]) })
export const markAccountsSeenSchema = z.union([
  z.object({ userIds: z.array(z.number().int().positive()).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
])
```

### 7.8 Router

```ts
stats: adminProcedure.query(({ ctx }) => getAdminStats(ctx.db)),
accountTrend: adminProcedure.input(accountTrendSchema).query(({ ctx, input }) => getAccountTrend(ctx.db, input.days)),
revenue: adminProcedure.input(revenueQuerySchema).query(({ ctx, input }) => getRevenue(ctx.db, input)),
newAccounts: adminProcedure.query(({ ctx }) => getNewAccounts(ctx.db)),
markAccountsSeen: adminProcedure.input(markAccountsSeenSchema).mutation(({ ctx, input }) => markAccountsSeen(ctx.db, ctx.session.user.username, input)),
```

## 8. Giao diện

Màu theo A3: nhấn `primary` (#0F766E), trung tính slate, phụ teal/emerald, cảnh báo amber. Không indigo/violet/purple. Vùng chạm `h-11 md:h-10`.

### 8.1 Nav + trang chủ
- `admin-nav.ts` 6 mục (N1); `AdminTabBar` `grid-cols-6`; badge số đơn chờ của P giữ nguyên ở mục Đơn chờ.
- `ADMIN_HOME` thay 5 chỗ (N2). Trang `src/app/(admin)/admin/overview/page.tsx`, `src/app/(admin)/admin/revenue/page.tsx` (mỗi file `return <X />`).

### 8.2 Tổng quan `src/components/admin/AdminOverview.tsx`

`PageHeader` `admin_overview`, mô tả `admin_updated_at` "Cập nhật lúc {time}" (`dd/mm HH:mm` giờ VN từ `stats.updatedAt`).

**Lưới thẻ** (`data-testid="overview-cards"`, `grid-cols-2 md:grid-cols-3 xl:grid-cols-5`), mỗi thẻ `data-testid="card-{id}"`, viền trên 4px theo A14, số to, nhãn, dòng phụ:
| id | Nhãn | Số | Dòng phụ |
|---|---|---|---|
| `total` | Tổng tài khoản | `totalAccounts` | "Không tính admin" |
| `active` | Đang hoạt động | `activeAccounts` | "Chưa bị khóa" |
| `pending` | Chờ duyệt | `pendingOrders` | > 0: "Cần xác nhận chuyển khoản"; = 0: "Không có đơn chờ"; thêm dòng "{n} tài khoản mới chưa xem" khi `newAccounts` > 0. **Cả thẻ là `Link` tới `/admin/orders`** |
| `active24h` | Active 24h | `active24h` | "Dùng app trong 24 giờ qua" |
| `active7d` | Active 7 ngày | `active7d` | "7 ngày gần nhất (giờ VN)" |
| `paying` | Đang trả phí | `plus + pro` | "Plus {a} · Pro {b}" |
| `trial` | Đang dùng thử | `trial` | "Pro dùng thử còn hạn" |
| `expiring` | Sắp hết hạn | `paid + trial` | "{a} trả phí · {b} dùng thử · ≤ 30 ngày" |
| `std-after-trial` | Standard sau dùng thử | `standardAfterTrial` | "Hết dùng thử, còn dùng trong 30 ngày" |

Đang tải → `Skeleton` 9 ô; lỗi → dòng lỗi + nút Thử lại.

**Xu hướng tài khoản** `src/components/admin/AccountTrend.tsx` (`data-testid="account-trend"`): tiêu đề `admin_trend_title`; `radiogroup` 3 nút "7 ngày / 14 ngày / 30 ngày" (`h-11 md:h-10`); 4 thẻ phụ (`trend-new`, `trend-avg`, `trend-returning`, `trend-busiest`); `BarChart` grouped (T6); chú thích: "Tài khoản mới", "Quay lại", "Hôm nay (chưa hết ngày)"; dòng giải thích `admin_trend_returning_note` "Quay lại = tài khoản cũ có dùng app trong ngày (không chỉ đăng nhập; phiên được ghi nhớ 30 ngày)"; chú thích T5 nếu có.

### 8.3 Doanh thu `src/components/admin/AdminRevenue.tsx`

- `PageHeader` `admin_revenue`.
- **Bộ lọc** (`revenue-filter`): `radiogroup` Tháng / Khoảng / Năm (`h-11 md:h-10`); ô chọn tháng/năm (`Select`, trigger `h-11 md:h-10`, `aria-label` riêng); mặc định Năm hiện tại VN; Tháng = tháng hiện tại; Khoảng = T1 → tháng hiện tại (năm hiện tại) hoặc T12 (năm cũ). Lỗi C7 → chữ `text-destructive` (`revenue-error`), ẩn số liệu, không gọi query. Dòng chú thích `admin_revenue_note`.
- **Tổng** (`revenue-summary`): Tổng doanh thu (`revenue-total`, tiền + "{n} đơn"), Đơn mới / Gia hạn / Nâng cấp (`revenue-kind-*`); 2 thẻ "Theo gói" (`revenue-plan-*`) và "Theo kỳ" (`revenue-period-*`).
- **Biểu đồ** (`revenue-chart`): `BarChart` stacked (C9, C10).
- **Bảng từng tháng** `ResponsiveList`: cột Tháng (`MM/YYYY`), Số đơn, Đơn mới, Gia hạn, Nâng cấp, Plus, Pro, Tổng; thẻ mobile `revenue-month-card`.

### 8.3b Tài khoản mới `src/components/admin/NewAccounts.tsx` (MỚI), gắn cuối `AdminPendingOrders`

- Props `{ users: OverviewUser[] }` (danh sách `overview.users` mà `AdminPendingOrders` đã tải, để tra dòng truyền cho dialog). Query `admin.newAccounts`.
- Tiêu đề `admin_new_accounts` "Tài khoản mới" + số `total`; nút `admin_new_accounts_seen_all` "Đánh dấu tất cả đã xem" (`h-11 md:h-10`, ẩn khi 0; > 1 dòng → AlertDialog xác nhận).
- `ResponsiveList`: cột Tên đăng nhập, Họ tên, Đăng ký lúc (`dateTimeVn`), Gói hiện tại (`planLabel` + nguồn), Hành động (3 nút `h-11 md:h-10`: "Đã xem", "Đặt gói", "Đặt dùng thử"). Thẻ mobile `data-testid="new-account-card"`. Trống → `admin_new_accounts_empty` "Không có tài khoản mới".
- "Đặt gói" / "Đặt dùng thử" mở `SetPlanDialog` / `TrialDaysDialog` với dòng tra được trong `users`; không tra được (dữ liệu overview cũ) → nút khóa. Đặt xong, server đã đánh dấu đã xem (R4), cache tự invalidate.
- `AdminSidebar`: cạnh pill đơn chờ của P, pill `admin-new-accounts-count` (viền `border-primary`, chữ `text-primary`) khi `newAccounts > 0`, `aria-label` "{n} tài khoản mới chưa xem". `AdminTabBar`: chấm `admin-tab-new-dot` (`size-2 rounded-full bg-teal-500`) ở góc icon Chờ xác nhận (phía đối diện chấm số của P), có `sr-only` text.

### 8.4 `src/components/admin/BarChart.tsx` (MỚI, dùng chung)

```ts
export type BarSegment = { key: string; value: number; className: string }
export type ChartBar = { key: string; label: string; ariaLabel: string; segments: BarSegment[]; faded?: boolean }
export type ChartLegend = { key: string; label: string; className: string }
export function BarChart(props: { bars: ChartBar[]; layout: "stacked" | "grouped"; legend: ChartLegend[]; formatMax: (n: number) => string; emptyText: string; testId: string }): JSX.Element
```
`stacked`: max = max tổng cột, đoạn xếp chồng cao `value/max`. `grouped`: max = max từng giá trị, các đoạn đứng cạnh nhau. Mỗi cột `data-testid="chart-bar"`, `data-key`, `role="img"`, `aria-label`, `title`, `faded` → `opacity-50` + `data-faded="true"`; đoạn `data-seg={key}` (đoạn 0 không vẽ). Tất cả 0 → `emptyText`.

## 9. i18n

Thêm vào `vi.json` và `en.json` (cùng bộ key, không gạch dài). Danh sách đầy đủ trong plan (Task 4, 5, 6). Nhóm: `admin_overview`, `admin_tab_overview`, `admin_updated_at`, `admin_card_*`, `admin_trend_*`, `admin_new_accounts*`, `admin_revenue*`, `admin_tab_revenue`, `admin_chart_empty`.

## 10. Kiểm thử

Chỉ chạy trên `.env.test` (Postgres local Docker). DB test phải `migrate deploy` migration mới.

### Unit
- `tests/unit/lib/activity.test.ts`: `vnDayKey`/`vnDayDate` biên 16:59/17:00 UTC; `shouldTouch` (null, 59 phút, 60 phút, khác ngày VN dù < 1 giờ).
- `tests/unit/lib/admin-stats.test.ts`: `computeAccountCards` (A1–A8: khóa, trả phí + dùng thử, dùng thử không trả phí, sắp hết hạn biên 30 ngày, Standard sau dùng thử biên 30 ngày hoạt động, `trialEndsAt` null); `lastNDays` qua tháng/năm; `buildAccountTrend` (điền 0, `isToday` cột cuối, trung bình làm tròn, ngày đông nhất hòa lấy gần hơn, không ai mới → null).
- `tests/unit/lib/revenue.test.ts`, `tests/unit/schemas/plan.schema.test.ts` (`revenueQuerySchema`, `accountTrendSchema`).
- `tests/unit/components/BarChart.test.tsx` (stacked/grouped chiều cao, faded, trống), `AdminOverview.test.tsx`, `AccountTrend.test.tsx`, `AdminRevenue.test.tsx`, `AdminNav.test.tsx` (6 mục, `grid-cols-6`).
- Sửa kỳ vọng `/admin/orders` → `/admin/overview`: `auth-authorized.test.ts`, `layout/admin-redirect.test.ts`, `AppHeader.test.tsx`.

### Integration
- `tests/integration/activity.test.ts`: `nodeJwt` với token `teacher_std` → 1 dòng hôm nay + `last_active_at`; gọi lại ngay → không ghi thêm (throttle), `updated_at` không đổi; `last_active_at` lùi 2 giờ → ghi lại, vẫn 1 dòng (ON CONFLICT); `last_active_at` hôm qua 23:50 VN → thêm dòng hôm nay; admin → không ghi; ghi lỗi (mock `touchActivity` ném / `db.$transaction` ném) → `nodeJwt` vẫn trả token.
- `tests/integration/user-activity-migration.test.ts`: SQL chỉ `ADD COLUMN`/`CREATE`/`INDEX`/FK CASCADE/`UPDATE … last_active_at = last_login_at`; không `DROP`/`DELETE`/`TRUNCATE`.
- `tests/integration/admin-stats.test.ts`: FORBIDDEN với giáo viên (cả 2 procedure); tạo user giả `stat_fake_*` với trạng thái cụ thể → **chênh lệch** các thẻ trước/sau đúng; xu hướng: user giả tạo hôm qua/hôm nay + dòng hoạt động → cột đúng, đăng ký hôm nay có hoạt động hôm nay chỉ là "mới"; admin không tính.
- `tests/integration/revenue.test.ts`: như cũ (FORBIDDEN, BAD_REQUEST, số liệu năm 2025 với đơn trước khoảng) + xóa mềm tài khoản có đơn đã duyệt → doanh thu KHÔNG đổi (K16).
- `tests/integration/new-accounts.test.ts`: `auth.register` → xuất hiện trong `admin.newAccounts`, `pendingCount.newAccounts` +1; `markAccountsSeen({ userIds })` → biến mất; `{ all: true }` → rỗng, gọi lại count 0; tài khoản cũ sau câu backfill của migration (chạy câu SQL từ file migration, giới hạn vào user giả) không hiện; admin không hiện; đã xóa mềm không hiện; `setPlan` / `setUserTrial` tự đánh dấu đã xem; giáo viên gọi → FORBIDDEN. Không giả định số ngày dùng thử mặc định (K17).
- Mọi test thẻ/xu hướng: user giả đã xóa mềm không làm đổi số.
- `tests/integration/session-validity.test.ts`: `toEqual` → `toMatchObject` (shape mới của `getSessionUserState`).

### E2E
- `tests/e2e/admin-overview.spec.ts`: admin đăng nhập vào `/admin/overview`; 9 thẻ có số; thẻ Chờ duyệt bấm → `/admin/orders`; teacher_std đăng nhập rồi admin tải lại → Active 24h ≥ 1; seed 1 dòng hoạt động hôm qua cho `teacher_std` → cột hôm qua có "quay lại" ≥ 1; đổi 7/14/30 → 7/14/30 cột, cột cuối `data-faded`; 390px: 6 tab ≥44px không tràn, thẻ 2 cột, nút 7/14/30 ≥44px.
- `tests/e2e/admin-revenue.spec.ts`: như cũ (seed T1–T6/2026 cho `teacher_std`).
- `tests/e2e/admin-new-accounts.spec.ts`: đăng ký tài khoản mới qua `/register` → admin mở `/admin/orders` thấy ở "Tài khoản mới" (sidebar có pill số) → "Đã xem" → dòng biến mất; tài khoản thứ 2 → "Đặt dùng thử" mở dialog có sẵn → lưu → biến mất; 390px: thẻ `new-account-card`, nút ≥44px, chấm `admin-tab-new-dot`.
- Sửa `loginAs` của admin (`/admin\/orders$/` → `/admin\/overview$/`) ở mọi `tests/e2e/admin*.spec.ts`; `admin.spec.ts` test "/admin → /admin/orders" → overview và thêm `/admin/overview`, `/admin/revenue` vào danh sách 404 của giáo viên; số tab 4 → 6.

## 11. Review Focus

1. Ghi hoạt động không bao giờ làm hỏng request (DB lỗi, race 2 request cùng lúc → ON CONFLICT).
2. Ngày VN ở mọi nơi: cột DATE, `to_char(... AT TIME ZONE 'Asia/Ho_Chi_Minh')`, biên tháng doanh thu.
3. Admin không lọt vào bất kỳ số nào (thẻ, xu hướng, không ghi hoạt động).
4. Thẻ gói không đếm trùng (Trả phí vs Dùng thử) và khớp `plans.ts`.
5. Doanh thu: phân loại xét cả đơn trước khoảng; tổng các nhóm khớp `total`.
6. Mọi procedure mới `adminProcedure`; `ADMIN_HOME` thay đủ 5 chỗ.
7. Tài khoản đã xóa mềm (Q) không lọt vào thẻ, xu hướng, tài khoản mới; doanh thu KHÔNG lọc xóa mềm.
8. Backfill `admin_seen_at` chỉ chạm tài khoản có sẵn lúc migration; tài khoản đăng ký sau vẫn null.

## 12. Triển khai

1. **Backup Neon trước khi merge**: "Branch from current" trên project prod, tên kiểu `backup-before-K-overview-2026-09-xx`, ghi lại để rollback.
2. Merge `main` (sau P, Q) → Vercel build chạy `prisma migrate deploy`: thêm 2 cột + bảng + backfill. Không chạy lệnh DB tay lên prod.
3. Version **0.6.0** (minor): theo N, mọi người đăng nhập lại 1 lần (lượt đăng nhập lại đó cũng bắt đầu ghi hoạt động).
4. Kiểm prod bằng `hien_admin`: đăng nhập vào `/admin/overview`; thẻ số hợp lý (Tổng tài khoản khớp màn Tài khoản & gói trừ admin); biểu đồ có chú thích "Lượt quay lại được ghi từ <ngày triển khai>"; `/admin/revenue` Năm 2026 khớp tổng tay các đơn đã duyệt có tiền.
5. Rollback: revert merge; cột/bảng thừa không gây hại (code cũ không đọc).

## 13. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Thêm ghi DB vào đường `auth()` mỗi request | Throttle B2: request thường 0 truy vấn thêm; ghi ≤ 1 lần/giờ/người; lỗi chỉ warn |
| `getSessionUserState` đổi shape làm vỡ test N | Chỉ thêm trường; sửa `session-validity.test.ts` sang `toMatchObject` |
| `user.update` bump `updated_at` | Dùng raw `UPDATE` chỉ cột `last_active_at` |
| FK làm vỡ `tests/setup.ts` | `ON DELETE CASCADE` |
| P đổi nav/tab bar/đếm đơn chờ | Task nav đối chiếu code sau P; thẻ Chờ duyệt dùng cùng điều kiện đếm của P |
| Tab bar 6 mục chật ở 390px | e2e kiểm không tràn, mỗi tab ≥44px; nhãn ngắn |
| Dữ liệu hoạt động trống lúc mới lên | Backfill `last_active_at`; UI ghi mốc bắt đầu ghi |
| Nâng 0.6.0 làm mọi người đăng nhập lại | Đúng cơ chế N; báo người dùng |
| Q chưa có / đặt tên field khác `isDeleted` | Task 1 dừng nếu Q chưa merge; mọi chỗ lọc đối chiếu code thật sau Q, ghi Ruling |
| Seed test tạo lại users mỗi lượt → `admin_seen_at` null → danh sách "Tài khoản mới" trên DB test luôn có tài khoản seed | Test chỉ kiểm tài khoản mình tạo (theo username), không đếm tuyệt đối; selector e2e màn đơn chờ phải phân vùng (`within`) |
| Xóa mềm tài khoản làm lệch đối soát doanh thu | Doanh thu không lọc xóa mềm (K16): số quá khứ cố định |

## 14. Câu hỏi người dùng — ĐÃ CHỐT 2026-09-27

1. C4: đơn Plus→Pro có quy đổi → nhóm riêng **"Nâng cấp"**.
2. C3: "Đơn mới" = lần đầu tài khoản trả tiền (giữ mặc định).
3. A7: "Còn hoạt động" = dùng app trong **30 ngày**.
4. A4: Plus trả phí + dùng thử Pro song song → tính "Đang trả phí" (giữ mặc định).
5. B8: backfill `last_active_at = last_login_at` (giữ mặc định).
6. R7: sidebar **2 số riêng**; tab bar số đơn chờ + chấm tài khoản mới.
7. K16: doanh thu **vẫn tính** đơn của tài khoản đã xóa mềm; chỉ số liệu tài khoản bỏ qua `isDeleted`.

## 15. Bổ sung 2026-09-28 — căn hàng bộ lọc

Người dùng báo (ảnh màn Học sinh, Học phí, Báo cáo): tiêu đề + nút hành động ở hàng trên (nút sát phải), hàng bộ lọc ở dưới dồn hết sang trái → lệch "trái thấp, phải cao".
- Desktop (`md:`+): cụm ô chọn của `FilterBar` (dùng chung 3 màn) đẩy sát mép phải, thẳng mép với nút hành động và bảng; ô tìm kiếm vẫn bên trái. Báo cáo không có ô tìm kiếm → 2 ô chọn nằm sát phải.
- Mobile giữ nguyên (ô tìm kiếm + nút "Lọc" mở sheet).
- Kiểm bằng e2e ở 1280px: mép phải ô chọn cuối cách mép phải hàng tiêu đề ≤ 2px trên cả 3 màn. Plan K Task 6b.
