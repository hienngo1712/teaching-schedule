# J — Khu quản trị riêng cho admin, popup mua gói, nhãn gói cạnh logo

> Phần J, làm sau I (spec `2026-09-26-i-phan-goi-design.md`, đã live ở main `f2c8b88`). Chỉ chỉnh UI và điều hướng. **Không** đổi logic tính tiền/ngày của I (dùng lại nguyên `src/lib/plans.ts`), **không** migration.

## 1. Bối cảnh

Sau I, hiện trạng (đã đọc code):

- Trang admin là `src/app/(app)/admin/page.tsx`, nằm chung nhóm `(app)` nên dùng `AppLayout` của giáo viên (sidebar Tổng quan/Lịch/Học sinh/Học phí/Báo cáo + Môn học/Cài đặt/Gói của tôi, `PlanBanner`, `RenewOffer`, `UpgradeDialog`). Chặn bằng `isAdminUsername()` + `notFound()` ở page; router `admin.*` chặn bằng `adminProcedure` (`src/server/trpc/index.ts`).
- Tài khoản admin (`ADMIN_USERNAMES`, prod là `hien_admin`) đăng nhập xong vào `/dashboard` như giáo viên (`LoginForm.tsx` mặc định `callbackUrl = "/dashboard"`, `src/app/page.tsx` redirect `/dashboard`). Lối vào admin duy nhất là link `admin-link` cuối trang `/plan`.
- `isAdminUsername()` nằm trong `src/server/services/plan.service.ts` (file này import Prisma/TRPC) nên middleware Edge (`src/middleware.ts`, chỉ dùng `authConfig`) không import được.
- `AdminPanel.tsx` gộp 2 khối trên 1 trang: Chờ xác nhận + Tài khoản. `getAdminOverview()` (`plan-admin.service.ts`) trả `users` + `pendingOrders`; chưa có query lịch sử đơn.
- Trang `/plan`: thẻ `current-plan` (Gói hiện tại), `PlanCompare` (3 thẻ, `md:items-start`, thẻ Pro `md:-mt-2 md:pb-7` nên 3 thẻ lệch cao), `PendingOrderCard`, `PlanCheckout` (khối inline "Nâng cấp hoặc gia hạn"), lịch sử đơn, link admin.
- Menu avatar trong `AppHeader.tsx`: Sao lưu dữ liệu, Đổi mật khẩu, Đăng xuất. Header mobile **không có logo** (chỉ "Xin chào, …"); logo "Lịch dạy" chỉ có ở `AppSidebar.tsx` (desktop).

## 2. Mục tiêu và tiêu chí hoàn thành

- Admin đăng nhập → vào thẳng `/admin/orders`. Admin gõ bất kỳ route giáo viên (`/dashboard`, `/students`, `/plan`, `/`, …) → bị chuyển về `/admin/orders` (chặn ở middleware **và** ở layout server của `(app)`).
- Giáo viên vào `/admin` hoặc `/admin/*` → 404 như hiện nay.
- Khu quản trị có layout riêng: sidebar/tab bar riêng 3 mục (Đơn chờ xác nhận, Tài khoản & gói, Lịch sử đơn), không có menu giáo viên, không gọi `plan.me`, không `PlanBanner`/`RenewOffer`/`UpgradeDialog`.
- Menu avatar của admin: Quản trị, Đổi mật khẩu, Đăng xuất (không có Sao lưu dữ liệu).
- `/plan`: 3 thẻ gói cao bằng nhau ở desktop, nút CTA dính đáy; không còn thẻ "Gói hiện tại" và khối inline "Nâng cấp hoặc gia hạn"; CTA thẻ Plus/Pro mở popup mua gói (chọn gói + thời hạn + panel Đơn hàng → Tạo đơn → mã VietQR ngay trong popup).
- Sidebar giáo viên có nhãn gói hiệu lực cạnh chữ "Lịch dạy".
- Mobile 390px không tràn ngang (cả popup). `pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch; `theme-legacy-colors` pass.

## 3. Quyết định đã chốt (người dùng)

| # | Nội dung |
|---|---|
| J1 | Admin chỉ để quản lý gói, không dùng chức năng giáo viên. Path + UI riêng, điều hướng riêng. Admin vào route giáo viên → về khu quản trị; giáo viên vào khu quản trị → 404. Chặn ở server, không chỉ ẩn link. |
| J2 | Menu avatar của admin có mục "Quản trị"; bỏ mục không liên quan. |
| J3a | 3 thẻ gói cao bằng nhau, CTA dính đáy thẻ. |
| J3b | Bỏ thẻ "Gói hiện tại"; gói hiện tại thể hiện qua nhãn "Đang dùng" (+ hạn dùng nếu có) trên thẻ. |
| J3c | Bỏ khối inline "Nâng cấp hoặc gia hạn"; CTA "Chọn gói Plus/Pro" mở popup mua gói theo mẫu "Gia hạn bản quyền" (thẻ gói chọn bằng radio, mục THỜI HẠN, panel Đơn hàng, nút Tạo đơn, bước sau hiện VietQR). Pro chọn sẵn kỳ Năm (P11); D7 vẫn áp. Mobile: toàn màn hình, panel Đơn hàng xếp dưới. |
| J4 | Nhãn gói nhỏ cạnh logo "Lịch dạy"; Standard trung tính; màu A3 (#0F766E), không indigo/violet/purple. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| Q1 | Cấu trúc route admin | Nhóm route MỚI `src/app/(admin)/admin/` với `layout.tsx` riêng; `/admin` → redirect `/admin/orders`; 3 trang `/admin/orders`, `/admin/accounts`, `/admin/history`. Xóa `src/app/(app)/admin/` | Tách hẳn khỏi `AppLayout` giáo viên; URL `/admin` cũ vẫn dùng được |
| Q2 | 3 màn quản trị | Đơn chờ xác nhận (`admin.overview.pendingOrders`), Tài khoản & gói (`admin.overview.users` + Đặt gói), Lịch sử đơn (query MỚI `admin.orderHistory`, chỉ đọc) | Khớp `admin.*` hiện có; lịch sử cần để đối soát chuyển khoản sai nội dung (rủi ro I-11) |
| Q3 | Chặn ở đâu | (1) `authorized` callback trong `authConfig` (middleware Edge): admin + path không bắt đầu `/admin` → redirect `/admin/orders`. (2) `src/app/(app)/layout.tsx`: admin → `redirect("/admin/orders")` (lưới an toàn nếu middleware bị bỏ qua). (3) `src/app/(admin)/admin/layout.tsx`: không phải admin → `notFound()` | Middleware không trả được trang 404 đẹp, nên 404 để layout làm như hiện nay |
| Q4 | `isAdminUsername` cho Edge | Chuyển thân hàm sang file MỚI `src/lib/admin.ts` (thuần, chỉ đọc `process.env.ADMIN_USERNAMES`); `plan.service.ts` import lại và giữ `export { isAdminUsername }` để không đổi chỗ gọi cũ | `plan.service.ts` kéo Prisma, không chạy được ở Edge |
| Q5 | tRPC giáo viên khi gọi bằng phiên admin | Không chặn thêm | Admin không có UI tới đó; dữ liệu theo `userId` của chính admin nên không lộ gì. Tránh sửa hàng chục procedure (YAGNI) |
| Q6 | `/api/backup` với admin | Để luật middleware chung áp luôn (admin gọi → redirect `/admin/orders`); bỏ mục Sao lưu dữ liệu khỏi menu admin | Sao lưu là dữ liệu giáo viên; admin không có dữ liệu cần sao lưu |
| Q7 | Menu avatar admin | Quản trị (→ `/admin/orders`), Đổi mật khẩu, Đăng xuất | Đổi mật khẩu vẫn cần cho tài khoản admin |
| Q8 | Header khu quản trị | Dùng lại `AppHeader` với prop MỚI `variant?: "teacher" \| "admin"` (mặc định `teacher`): `admin` ẩn `RenewOffer` và Sao lưu, thêm mục Quản trị. Nút ngôn ngữ giữ nguyên | Không nhân bản header; khác biệt chỉ 3 chỗ |
| Q9 | Điều hướng mobile khu quản trị | Tab bar đáy MỚI 3 tab (`AdminTabBar`), cùng kiểu `BottomTabBar` | Giữ thói quen mobile-first của app |
| Q10 | Standard trong popup | **Không hiện**. Popup chỉ có Plus và Pro | Standard miễn phí, không có gì để mua; thẻ không chọn được chỉ gây nhiễu |
| Q11 | Nhãn ưu đãi của kỳ | Ghi **đúng số** tháng tặng tính cho hôm nay bằng `computeBonusMonths(fields, plan, period, now)` ("Tặng 4 tháng"), không ghi "tối đa". Kỳ Năm không có tặng → nhãn "Tiết kiệm 2 tháng" (key có sẵn `plan_save_2_months`). Kỳ Tháng không nhãn | Số chốt lúc tạo đơn (I-6.6) nên ghi đúng số là chính xác nhất |
| Q12 | Dòng "Tối đa N tháng sử dụng" | N = `PERIOD_MONTHS[period] + bonus`. Ngày quy đổi D7 không cộng vào N, chỉ hiện ở panel Đơn hàng | Quy đổi tính bằng ngày và tính lại lúc duyệt |
| Q13 | Đơn đang chờ | Vẫn hiện `PendingOrderCard` trên `/plan` (trên bảng 3 gói). Trong popup, nếu đã có đơn chờ thì panel Đơn hàng ghi "Tạo đơn mới sẽ hủy đơn đang chờ" (D14) | Quét lại/hủy không cần mở popup |
| Q14 | Chỗ hiện gói hiện tại sau khi bỏ thẻ | Trên thẻ gói đang dùng: nhãn "Đang dùng" (trial: "Dùng thử"), dưới giá thêm dòng "Dùng đến hết ngày dd/mm/yyyy" (nếu `me.expiresAt`) và "Đang có {n} học sinh đang học" | Không mất thông tin số HS đang có so với thẻ cũ |
| Q15 | "Gia hạn ngay" trong `RenewOffer` | Link đổi thành `/plan?buy=1`: trang `/plan` thấy `buy=1` thì tự mở popup (Pro + Năm theo P11), rồi xóa param bằng `router.replace("/plan")` | Không còn khối checkout inline để cuộn tới; tránh bắt bấm thêm 1 lần |
| Q16 | Nhãn gói cạnh logo | Component MỚI `CurrentPlanBadge`: Standard viền/chữ slate; Plus viền + chữ `primary` nền trắng; Pro nền `primary` chữ trắng; trial = Pro + icon `Clock` 12px, `aria-label`/`title` "Pro dùng thử". Chỉ hiện khi `usePlan().ready`. Không bấm được | Sidebar rộng 232px, chữ "Pro · Dùng thử" dễ tràn; icon đủ nhận biết |
| Q17 | Nhãn trên header mobile | Không thêm (header mobile không có logo) | Đúng điều kiện "nếu có logo"; tránh chật header 390px |
| Q18 | Field `plan.me.isAdmin` | Giữ nguyên (integration test `plan-orders.test.ts` đang dùng); chỉ bỏ link `admin-link` ở `/plan` | Admin không còn tới `/plan`; đổi API không cần thiết |

## 5. Phạm vi

### Trong phạm vi
- Khu quản trị: nhóm route `(admin)`, `AdminLayout`, `AdminSidebar`, `AdminTabBar`, tách `AdminPanel` thành 3 màn, query `admin.orderHistory`.
- Chặn route ở middleware (`authConfig.authorized`) + layout server `(app)` và `(admin)`; `src/lib/admin.ts`.
- `AppHeader` prop `variant`; menu avatar admin.
- `/plan`: sửa `PlanCompare` (cao bằng nhau, thông tin gói đang dùng), bỏ thẻ `current-plan`, bỏ `PlanCheckout`, thêm `PlanPurchaseDialog`, `?buy=1`.
- `CurrentPlanBadge` trong `AppSidebar`.
- i18n vi/en; cập nhật e2e `plan.spec`, `admin.spec`, `plan-locks`, `renew-offer`; test mới cho chặn route.

### Ngoài phạm vi (YAGNI)
- Đổi giá, kỳ, ưu đãi, quy đổi, luật duyệt đơn (giữ nguyên I).
- Chặn tRPC giáo viên theo vai trò admin (Q5); cột role trong DB.
- Tìm kiếm/lọc/phân trang ở màn quản trị (vài chục tài khoản); sửa/xóa tài khoản.
- Nhãn gói ở header mobile (Q17); dashboard số liệu doanh thu cho admin.

## 6. Giao diện

Màu theo A3: nhấn `primary` (#0F766E), trung tính slate, chờ duyệt amber. Không indigo/violet/purple. Vùng chạm `h-11 md:h-10`.

### 6.1 Khu quản trị

**File:**
- `src/app/(admin)/admin/layout.tsx` (MỚI, server): `auth()`; `!isAdminUsername(session?.user?.username)` → `notFound()`; bọc `SessionProvider` (như `(app)/layout.tsx`) + `AdminLayout`.
- `src/app/(admin)/admin/page.tsx` (MỚI): `redirect("/admin/orders")`.
- `src/app/(admin)/admin/orders/page.tsx`, `accounts/page.tsx`, `history/page.tsx` (MỚI): mỗi trang render 1 component client tương ứng.
- Xóa `src/app/(app)/admin/page.tsx`.
- `src/components/admin/AdminLayout.tsx` (MỚI): khung giống `AppLayout` (`h-[100dvh]`, sidebar desktop, `<main>` cuộn, chừa chỗ tab bar mobile) nhưng dùng `AdminSidebar`, `AppHeader variant="admin"`, `AdminTabBar`. Không có `PlanBanner`, `UpgradeDialog`.
- `src/components/admin/admin-nav.ts` (MỚI): `ADMIN_NAV_ITEMS` = `[{ href: "/admin/orders", labelKey: "admin_pending_orders", icon: Inbox }, { href: "/admin/accounts", labelKey: "admin_accounts_plans", icon: Users }, { href: "/admin/history", labelKey: "admin_order_history", icon: History }]`; active dùng lại `isNavActive` của `nav-items.ts`.
- `src/components/admin/AdminSidebar.tsx` (MỚI): cùng khung `AppSidebar` (logo `GraduationCap` + "Lịch dạy"), cạnh logo nhãn "Quản trị" (pill slate, không phải nhãn gói), 1 nhóm nav 3 mục, dòng version cuối. Mục "Đơn chờ xác nhận" có số đếm đơn chờ (lấy `admin.overview`, cùng query cache với màn Đơn chờ, không thêm request).
- `src/components/admin/AdminTabBar.tsx` (MỚI): `md:hidden`, `grid-cols-3`, kiểu `tabClass`/`ActiveBar` như `BottomTabBar` (chép phần nhỏ đó, không trích chung để không đụng `BottomTabBar`), nhãn ngắn: "Đơn chờ" / "Tài khoản" / "Lịch sử".
- `AdminPanel.tsx` tách thành (MỚI) `AdminPendingOrders.tsx` (khối Chờ xác nhận + 2 `AlertDialog` Xác nhận/Từ chối, giữ nguyên logic và `data-testid="pending-order-card"`), `AdminAccounts.tsx` (khối Tài khoản + `SetPlanDialog`, giữ `data-testid="admin-user-card"`), `AdminOrderHistory.tsx`. Xóa `AdminPanel.tsx`. Mỗi màn có `PageHeader` với tiêu đề của mục nav.
- **Lịch sử đơn**: `ResponsiveList` gọi `admin.orderHistory`; cột: ngày tạo, tài khoản, gói, kỳ (`plan_order_by_admin` khi đơn admin đặt tay), số tiền, mã, trạng thái (`plan_status_*` có sẵn), hạn cấp (`grantedUntil` qua `formatValidUntil`), người duyệt + ngày duyệt, ghi chú. Thẻ mobile `data-testid="admin-history-card"`. Không có thao tác.

### 6.2 Header và menu avatar

`AppHeader({ variant = "teacher" })`:
- `teacher`: như hiện nay.
- `admin`: không render `RenewOffer`; menu avatar = **Quản trị** (icon `ShieldCheck`, `Link` tới `/admin/orders`), **Đổi mật khẩu**, phân cách, **Đăng xuất**. `useBackupDownload` không gửi request khi mount (chỉ `fetch` lúc bấm) nên vẫn gọi hook, chỉ không render mục Sao lưu.

### 6.3 Trang `/plan`

Thứ tự: `PageHeader` → `PendingOrderCard` (nếu có) → `PlanCompare` → Lịch sử đơn. Bỏ section `current-plan`, bỏ `PlanCheckout` (xóa file `PlanCheckout.tsx` và type `PlanChoice` chuyển sang `PlanPurchaseDialog`), bỏ link `admin-link`, bỏ key i18n không còn dùng (`plan_current`, `plan_upgrade_title`, `plan_create_order`, `plan_amount` nếu không còn chỗ nào dùng — dò bằng grep trước khi xóa).

**`PlanCompare`** (sửa):
- Lưới desktop: `md:grid-cols-3 md:items-stretch` (bỏ `md:items-start`); thẻ Pro bỏ `md:-mt-2 md:pb-7` (giữ viền 2px + nền nhạt + nhãn "Khuyên dùng"). Thẻ là `flex flex-col`, CTA giữ `mt-auto` nên dính đáy. Thẻ Standard không có CTA (giữ như cũ); chiều cao vẫn bằng 2 thẻ kia nhờ `items-stretch`.
- Props MỚI: `me` (thay `current`) để đọc `me.plan`, `me.source`, `me.expiresAt`, `me.activeStudents`. Thẻ gói đang dùng: nhãn `plan_in_use` ("Đang dùng"), hoặc `plan_source_trial` ("Dùng thử") khi `source === "trial"`; ngay dưới khối giá: `plan_valid_until` (nếu có hạn) và `plan_active_now` MỚI "Đang có {count} học sinh đang học".
- CTA "Chọn gói {plan}" gọi `onChoose(plan)` → trang mở `PlanPurchaseDialog` với gói đó, kỳ Năm. Plus vẫn `disabled` khi `plusBlocked` (D7).
- Mobile giữ thứ tự Pro → Plus → Standard (`CARD_ORDER`), không đặt chiều cao bằng nhau (xếp dọc).

**`?buy=1`**: `page.tsx` đọc `useSearchParams()`; có `buy=1` và `me` đã tải → mở popup (Pro, Năm), rồi `router.replace("/plan")`. `RenewOffer` đổi `href="/plan"` thành `href="/plan?buy=1"`. (`useSearchParams` cần bọc `Suspense` theo Next 15 nếu build báo.)

### 6.4 Popup mua gói `PlanPurchaseDialog` (MỚI, `src/components/plan/PlanPurchaseDialog.tsx`)

Props: `{ open, onOpenChange, me, fields, initialPlan: PaidPlan }`. State `choice: { plan, period }` khởi tạo `{ plan: initialPlan, period: "year" }` mỗi lần mở (P11); `step: "choose" | "pay"`. Dùng `Dialog` shadcn, `data-testid="plan-purchase"`, tiêu đề `plan_purchase_title` MỚI "Mua / gia hạn gói".

Kích thước: mobile toàn màn hình `h-[100dvh] w-full max-w-none rounded-none overflow-y-auto`; desktop `md:h-auto md:max-h-[90dvh] md:max-w-4xl md:rounded-xl`. Nút đóng (X) ≥44px.

**Bước `choose`** — desktop 2 cột `md:grid md:grid-cols-[1fr_320px] md:gap-6`; mobile xếp dọc, panel Đơn hàng ở dưới.

Cột trái:
1. Nhóm gói `role="radiogroup"` (aria-label "Gói"), 2 thẻ Plus, Pro (desktop cạnh nhau Plus → Pro; mobile Pro trên Plus, hợp P11). Mỗi thẻ là `button role="radio" aria-checked`, `data-testid="purchase-plan-{plan}"`:
   - Chấm radio + tên gói; Pro có nhãn "Khuyên dùng" (pill nền `primary`).
   - Giá tháng: `formatCurrency(PLAN_PRICES[plan].month)` + `plan_per_month`.
   - Mô tả ngắn `plan_desc_plus` / `plan_desc_pro` (MỚI).
   - `plan_includes_below` ("Mọi thứ của gói {Standard|Plus}, thêm:") + `featuresAddedIn(plan)` với icon `Check` (cùng `FEATURE_LABEL_KEY` như `PlanCompare`); Plus thêm `plan_student_limit`.
   - Đang chọn: viền 2px `primary` + nền `bg-primary/[0.04]`; không chọn: viền 1px slate-200.
   - Plus bị D7 (`orderBlockedUntil(fields, "plus", now) !== null`): `disabled`, mờ, dòng `plan_downgrade_blocked` (có sẵn).
2. Mục **THỜI HẠN** (`plan_duration` MỚI, chữ nhỏ in hoa), `role="radiogroup"`, 3 thẻ theo `PERIODS` (desktop `md:grid-cols-3`, mobile xếp dọc), mỗi thẻ `role="radio"`, `data-testid="purchase-period-{period}"`:
   - Tên kỳ `plan_period_1m` / `plan_period_12m` / `plan_period_24m` (MỚI: "1 tháng" / "12 tháng" / "24 tháng").
   - Giá kỳ của gói đang chọn `PLAN_PRICES[choice.plan][period]`.
   - Nhãn ưu đãi (Q11): `b = computeBonusMonths(fields, choice.plan, period, now)`; `b > 0` → pill `plan_bonus_months` ("Tặng {n} tháng"); `b = 0` và `period === "year"` → `plan_save_2_months`; còn lại không nhãn.
   - Dòng phụ `plan_max_months` MỚI "Tối đa {n} tháng sử dụng nếu mua ngay hôm nay", `n = PERIOD_MONTHS[period] + b` (Q12).
   - Đang chọn: viền 2px `primary`.

Cột phải — panel **Đơn hàng** (`plan_order_summary` MỚI, `data-testid="purchase-summary"`, nền slate-50, bo góc; desktop `md:sticky md:top-0`):
- "{Plan} · {tên kỳ}" và giá kỳ.
- Tặng (nếu `bonus > 0`): `plan_bonus_months`.
- Quy đổi (chỉ khi `choice.plan === "pro"`): `credit = computeUpgradeCredit(fields, me.plusCreditOrder, choice.period, now)`; `credit.creditDays > 0` → `plan_upgrade_credit` (có sẵn) + chú thích `plan_credit_recalc` MỚI "Số ngày quy đổi tính lại khi xác nhận".
- Hạn mới dự kiến: `addDays(computeNewExpiry(fields, choice.plan, choice.period, now, bonus), credit?.creditDays ?? 0)` qua `formatValidUntil` — **đúng công thức đang có trong `PlanCheckout`**, chuyển nguyên sang.
- Kẻ ngang; `plan_total` MỚI "Tổng tiền thanh toán" + số tiền `text-2xl font-semibold` = `PLAN_PRICES[choice.plan][choice.period]`.
- Có `me.pendingOrder`: dòng amber nhỏ `plan_replace_pending` MỚI "Tạo đơn mới sẽ hủy đơn đang chờ".
- `!me.paymentReady`: dòng `plan_payment_not_ready`, nút khóa.
- Nút lớn `plan_create_order_short` MỚI "Tạo đơn", `h-12 w-full` → `trpc.plan.createOrder.mutate(choice)`; thành công → toast `plan_order_created` + `step = "pay"` (cache tự invalidate nhờ `MutationCache` trong `TRPCProvider`).

**Bước `pay`**: render `PendingOrderCard` với `me.pendingOrder` (chưa refetch xong thì `Skeleton`): QR, ngân hàng, STK, chủ TK, số tiền, `SM XXXXXX`, nút sao chép, Hủy yêu cầu. Cuối là nút `plan_done` MỚI "Xong" đóng popup. Hủy yêu cầu trong popup → đóng popup. `PendingOrderCard` chỉ thêm prop `className?` nếu cần bỏ viền trong popup.

Server (`plan.createOrder`) vẫn là chốt chặn giá, D7, D14; popup chỉ xem trước.

### 6.5 Nhãn gói cạnh logo `CurrentPlanBadge` (MỚI, `src/components/plan/CurrentPlanBadge.tsx`)
- Đọc `usePlan()`; `!ready` → `null`. Chữ `PLAN_LABEL[me.plan]`, `data-testid="current-plan-badge"`.
- Pill `rounded-full px-1.5 text-[10px] font-semibold leading-4`: Standard `border border-slate-300 bg-white text-slate-600`; Plus `border border-primary bg-white text-primary`; Pro `bg-primary text-primary-foreground`.
- Trial (`me.source === "trial"`): như Pro + icon `Clock` `size-3` phía trước; `title` và `aria-label` = `plan_badge_trial` MỚI "Pro dùng thử".
- Đặt trong khối logo của `AppSidebar`, ngay sau chữ "Lịch dạy". `PlanBadge` (dùng cho `LockBadge`) giữ nguyên.

## 7. Backend

- `src/lib/admin.ts` (MỚI): `isAdminUsername(username?: string | null): boolean`, chép nguyên thân hàm hiện tại. `plan.service.ts` bỏ thân hàm, `import { isAdminUsername } from "@/lib/admin"` + `export { isAdminUsername }` (giữ chỗ gọi trong `trpc/index.ts`, `getMyPlan`).
- `src/server/auth.config.ts`, `callbacks.authorized({ auth, request })`: `!auth?.user` → `false` (giữ ghi chú GHSA); admin và path không thuộc khu quản trị (`!(pathname === "/admin" || pathname.startsWith("/admin/"))`) → `return Response.redirect(new URL("/admin/orders", request.nextUrl))`; còn lại `true`. `ADMIN_USERNAMES` đọc được ở Edge runtime (Vercel và `next dev`; Playwright đã đặt env trong `playwright.config.ts`). Matcher giữ nguyên: `/login`, `/register`, `/p/`, `/api/trpc`, `/api/auth` không qua middleware.
- `src/app/(app)/layout.tsx`: sau `auth()`, admin → `redirect("/admin/orders")`.
- `src/app/login/page.tsx`: phiên đã đăng nhập → `redirect(isAdminUsername(...) ? "/admin/orders" : "/dashboard")`. `LoginForm` giữ `callbackUrl` mặc định `/dashboard`; middleware chuyển tiếp admin.
- Query MỚI `admin.orderHistory` (`adminProcedure`, không input) → `getOrderHistory(db)` MỚI trong `plan-admin.service.ts`: `planOrder.findMany({ where: { status: { not: "pending" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id, code, plan, period, amount, bonusMonths, creditDays, status, source, grantedUntil, note, decidedBy, decidedAt, createdAt, user: { select: { username, fullName } } } })`, trả phẳng `username`, `fullName`.
- Không đổi `src/lib/plans.ts`, `createOrder`, `cancelOrder`, `approveOrder`, `rejectOrder`, `adminSetPlan`.

## 8. Dữ liệu / migration

Không có. Không đổi `prisma/schema.prisma`.

## 9. i18n

Thêm vào `vi.json` và `en.json` (cùng bộ key, không gạch dài):

| Key | vi | en |
|---|---|---|
| `admin_accounts_plans` | Tài khoản & gói | Accounts & plans |
| `admin_order_history` | Lịch sử đơn | Order history |
| `admin_tab_orders` / `admin_tab_accounts` / `admin_tab_history` | Đơn chờ / Tài khoản / Lịch sử | Pending / Accounts / History |
| `admin_badge` | Quản trị | Admin |
| `admin_col_status` / `admin_col_granted` / `admin_col_decided` | Trạng thái / Hạn cấp / Người duyệt | Status / Granted until / Decided by |
| `admin_no_history` | Chưa có đơn nào | No orders yet |
| `plan_purchase_title` | Mua / gia hạn gói | Buy / renew plan |
| `plan_desc_plus` | Cho lớp vừa: thu tiền, phiếu báo, báo cáo tháng | For growing classes: payments, notices, monthly reports |
| `plan_desc_pro` | Đầy đủ nhất: link phụ huynh, cảnh báo, báo cáo năm | Everything: parent links, alerts, yearly reports |
| `plan_duration` | Thời hạn | Duration |
| `plan_period_1m` / `plan_period_12m` / `plan_period_24m` | 1 tháng / 12 tháng / 24 tháng | 1 month / 12 months / 24 months |
| `plan_max_months` | Tối đa {n} tháng sử dụng nếu mua ngay hôm nay | Up to {n} months if you buy today |
| `plan_order_summary` | Đơn hàng | Order |
| `plan_credit_recalc` | Số ngày quy đổi tính lại khi xác nhận | Credit days are recalculated on approval |
| `plan_total` | Tổng tiền thanh toán | Total |
| `plan_replace_pending` | Tạo đơn mới sẽ hủy đơn đang chờ | A new order cancels the pending one |
| `plan_create_order_short` | Tạo đơn | Create order |
| `plan_done` | Xong | Done |
| `plan_badge_trial` | Pro dùng thử | Pro trial |
| `plan_active_now` | Đang có {count} học sinh đang học | {count} active students now |

Dùng lại: `admin_pending_orders`, `admin_page`, `plan_in_use`, `plan_source_trial`, `plan_valid_until`, `plan_bonus_months`, `plan_save_2_months`, `plan_upgrade_credit`, `plan_downgrade_blocked`, `plan_payment_not_ready`, `plan_order_created`, `plan_recommended`, `plan_includes_below`, `plan_student_limit`, `plan_per_month`, `plan_status_*`, `plan_order_by_admin`.

Xóa (không còn chỗ dùng sau J — grep lại trước khi xóa): `plan_current`, `plan_students_usage`, `plan_students_unlimited`, `plan_upgrade_title`, `plan_amount`, `plan_create_order`, `admin_link`.

## 10. Kiểm thử

Chỉ chạy trên `.env.test` (Postgres local). Seed có sẵn `admin_test`, `teacher_std`, `teacher`; `playwright.config.ts` đã đặt `ADMIN_USERNAMES=admin_test`.

### Unit
- `tests/unit/lib/admin.test.ts` (MỚI): `isAdminUsername` trim, khớp chính xác, env rỗng/thiếu → false, `null`/`""` → false.
- `tests/unit/lib/plans.test.ts`: không đổi (logic giữ nguyên).

### Integration (`tests/integration/admin.test.ts`)
- `admin.orderHistory`: user thường → `FORBIDDEN`; admin → chỉ đơn không `pending`, mới nhất trước, có `username`, tối đa 100.
- `plan-orders.test.ts` giữ nguyên (vẫn kiểm `plan.me.isAdmin`).

### E2E
- `admin.spec.ts` (sửa):
  - `loginAs('admin_test')` chờ URL `/admin/orders` (không còn `/dashboard`).
  - Luồng duyệt đơn: `teacher_std` tạo đơn qua **popup** (`plan-card-plus` → "Chọn gói Plus" → `purchase-period-month` → "Tạo đơn" → thấy `pending-order` trong popup, lấy mã `SM …`); admin ở `/admin/orders` duyệt; kiểm `admin-user-card` ở `/admin/accounts` hiện Plus; `teacher_std` mở `/plan` thấy thẻ Plus có "Đang dùng" + "Dùng đến hết ngày" (thay cho `current-plan`).
  - Từ chối: giữ như cũ, ở `/admin/orders`; sau đó `/admin/history` có thẻ `admin-history-card` chứa mã với "Bị từ chối".
  - Chặn route: admin vào `/dashboard`, `/students`, `/plan`, `/` → URL cuối `/admin/orders`; `/admin` → `/admin/orders`. Không thấy chữ "Tổng quan"/"Học phí" trong nav; tab bar admin có 3 tab ≥44px; menu avatar có "Quản trị", "Đổi mật khẩu", "Đăng xuất" và **không** có "Sao lưu dữ liệu". Không tràn ngang ở 390px.
  - `teacher` vào `/admin`, `/admin/orders`, `/admin/history` → 404. Bỏ test `admin-link`.
- `plan.spec.ts` (sửa, 390px): vào từ sheet Thêm; không còn `current-plan`, không còn `plan-checkout`; thẻ Standard có "Đang dùng" và "Đang có … học sinh đang học"; thứ tự Pro → Plus → Standard giữ nguyên. Bấm "Chọn gói Pro" → `plan-purchase` hiện, `purchase-plan-pro` `aria-checked=true`, `purchase-period-year` `aria-checked=true`, `purchase-summary` chứa 990.000; chọn Plus → 490.000; chọn 24 tháng → 980.000, "Tặng 2 tháng", "Tối đa 26 tháng"; chọn 12 tháng → "Tạo đơn" → trong popup thấy `pending-order` với "Chờ xác nhận", `SM …`, 490.000, ảnh VietQR; mọi nút trong popup ≥44px; không tràn ngang; "Xong" → trang có `pending-order`; Hủy yêu cầu → lịch sử "Đã hủy".
- `plan.spec.ts` (sửa, 1280px): x tăng dần Standard → Plus → Pro; **3 thẻ cùng chiều cao** (chênh `boundingBox().height` ≤ 1px) và đáy nút CTA Plus/Pro bằng nhau; bấm "Chọn gói Plus" → popup chọn sẵn Plus; panel Đơn hàng nằm bên phải cột chọn gói (x lớn hơn).
- `plan.spec.ts` (MỚI, 1280px): sidebar có `current-plan-badge` "Standard" cho `teacher_std`, "Pro" cho `teacher`; đặt `teacher_std` trial (DB) → badge có `aria-label` "Pro dùng thử".
- `renew-offer.spec.ts` (sửa): bấm "Gia hạn ngay" → URL `/plan` (không còn `buy=1` sau replace) và `plan-purchase` tự mở với Pro + 12 tháng; phần còn lại giữ.
- `plan-locks.spec.ts`: không đụng `current-plan`/`plan-checkout` (đã grep) → chạy lại để xác nhận vẫn pass; nếu `UpgradeDialog` → "Xem gói" dẫn tới `/plan` thì kiểm vẫn đúng.

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build`, `theme-legacy-colors` sạch.

## 11. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Middleware Edge không đọc được `ADMIN_USERNAMES` (env thiếu ở môi trường Edge) | Lưới thứ 2 ở `(app)/layout.tsx` vẫn chuyển admin về `/admin/orders`; e2e kiểm chặn route |
| Vòng redirect (admin ↔ `/admin`) | Luật chỉ chuyển khi path **không** thuộc khu quản trị; `(admin)/layout` chỉ `notFound()` cho người không phải admin, không redirect |
| Route khác bắt đầu bằng chữ `admin` (vd `/administration`) bị coi là khu quản trị | Dùng điều kiện chặt `=== "/admin"` hoặc `startsWith("/admin/")` (mục 7), không dùng `startsWith("/admin")` |
| Popup toàn màn hình 390px tràn ngang do 2 cột/thẻ kỳ | Mobile xếp dọc, `min-w-0`, e2e đo `scrollWidth` khi popup mở |
| Xem trước trong popup lệch với server | Dùng đúng hàm `plans.ts` như `PlanCheckout` cũ; tiền và ngày chốt ở server (I) |
| Admin đang đăng nhập lúc deploy còn ở trang giáo viên | Lần điều hướng/tải lại kế tiếp middleware chuyển về `/admin/orders` |
| Xóa `AdminPanel`/`PlanCheckout` làm vỡ import khác | Grep trước khi xóa; `next build` bắt |
