# K — Tổng quan + Doanh thu cho admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khu admin có trang chủ **Tổng quan** `/admin/overview` (9 thẻ số + biểu đồ "Xu hướng tài khoản" 7/14/30 ngày dựa trên dữ liệu hoạt động theo ngày mới ghi), mục **Tài khoản mới** (chưa xem) trên màn Chờ xác nhận `/admin/orders`, và màn **Doanh thu** `/admin/revenue` (lọc tháng/khoảng/năm, tổng, mới/gia hạn/nâng cấp, gói, kỳ, bảng từng tháng, biểu đồ cột). Số liệu tài khoản bỏ qua admin và tài khoản đã xóa mềm (Q); doanh thu vẫn tính đơn của tài khoản đã xóa mềm.

**Architecture:** 1 migration thêm `users.last_active_at` (backfill từ `last_login_at`), `users.admin_seen_at` (backfill = lúc migration) và bảng `user_activity_days` (PK `(user_id, day)`, FK CASCADE). `nodeJwt` (auth() phía Node, đã đọc `users` mỗi request từ N) gọi `touchActivity` khi `last_active_at` cũ hơn 1 giờ hoặc khác ngày VN: `INSERT … ON CONFLICT DO NOTHING` + `UPDATE last_active_at` raw, bỏ qua admin, lỗi chỉ warn. Số liệu tính bằng hàm thuần (`src/lib/admin-stats.ts`, `src/lib/revenue.ts`) sau vài truy vấn gọn (`findMany` users, `$queryRaw` GROUP BY ngày VN, `findMany` đơn đã duyệt). Router `admin.stats`, `admin.accountTrend`, `admin.revenue`, `admin.newAccounts`, `admin.markAccountsSeen` (`adminProcedure`); `admin.pendingCount` của P trả thêm `newAccounts` cho pill sidebar / chấm tab bar; `setPlan`/`setUserTrial` tự đánh dấu đã xem. UI client dùng chung `BarChart` vẽ bằng div/CSS (không thêm thư viện). Trang chủ admin gom về hằng `ADMIN_HOME`.

**Tech Stack:** Next.js 15.5 App Router, React 19, tRPC v11 (không transformer: `Date` về client là chuỗi ISO), Prisma 5.22 + PostgreSQL, NextAuth v5, zod 3.25, Tailwind 3.4, shadcn/ui (Radix Select), lucide-react 1.11 (`LayoutDashboard`, `ChartColumn`), Vitest 4 (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-k-tong-quan-doanh-thu-admin-design.md` (K1–K17 người dùng chốt; nhóm A, B, R, T, C, N người viết spec chọn; mục 14 câu hỏi mở — plan theo mặc định đề xuất: tách nhóm "Nâng cấp", "mới" = lần đầu trả tiền, "còn hoạt động" = 30 ngày, Plus trả phí + dùng thử tính "Đang trả phí", backfill `last_active_at`, số tài khoản mới hiện tách khỏi số đơn chờ). Plan viết theo `main` `86b37ff` (v0.4.0, TRƯỚC P và Q). Thứ tự: **P → Q → K → O**. P (`fix/p-sua-backlog`, v0.4.1: `status = 'expired'`, `admin.pendingCount` → `getPendingCount(db)` dùng chung `AdminSidebar` + `AdminTabBar` (chấm số `admin-tab-pending-count`), màn Tài khoản có menu Hành động + phân trang, `setUserTrialDays` chặn admin) và Q (xóa mềm: `users.isDeleted`, thùng rác; spec `2026-09-27-q-xoa-mem-design.md`) merge vào `main` TRƯỚC K. Mọi mô tả file dùng chung trong plan này phải đối chiếu code thật sau P và Q; lệch thì theo code thật, giữ đúng hành vi spec K, ghi "Ruling: …" trong báo cáo task.

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh chạm DB (kể cả `pnpm test`, `pnpm exec playwright test`, lệnh `prisma`) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, Neon, host `ep-polished-voice…`) KHÁC `.env.test` (Postgres local Docker `student-test-pg`, `localhost:5433`). **Không bao giờ sửa/ghi `.env`**, chỉ đọc host để so sánh. Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người dùng.
- **Migration:** tạo bằng `prisma migrate dev --create-only --name add_user_activity` trong subshell Bash chỉ nạp `DATABASE_URL`/`DIRECT_URL` của `.env.test` và có chốt `localhost:5433`; đọc lại SQL; áp bằng `prisma migrate deploy` lên DB test, kiểm dòng `Datasource "db": ... at "localhost:5433"`. KHÔNG áp lên prod (prod tự `prisma migrate deploy` khi Vercel build sau merge). Migration không destructive (chỉ `ADD COLUMN` nullable, `CREATE TABLE`, `CREATE INDEX`, FK `ON DELETE CASCADE`, 1 `UPDATE` vào cột vừa thêm). Prisma đòi reset → DỪNG, không đồng ý, báo người dùng.
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push` (mọi dạng, kể cả `--force-reset`), `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`, `git stash`. Build kiểm tra bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị `.env.test`.
- **Không sửa `tests/setup.ts`.** Bảng mới có FK `ON DELETE CASCADE` nên `db.user.deleteMany()` trong setup vẫn chạy.
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **E2E:** `pnpm exec playwright test <file>` (cổng 3000, `playwright.config.ts` tự khởi server với DB `.env.test`, đã đặt `ADMIN_USERNAMES=admin_test`). Cổng 3000 bận → không tắt tiến trình đó, DỪNG và báo người dùng. Trước lượt e2e đầu tiên của mỗi task chạy `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed). E2E ghi DB bằng Prisma trực tiếp phải kiểm `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` trong `beforeAll` và dọn ở `afterAll`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. Đo kích thước phần tử trong dialog/popover thì chờ animation xong (`await el.evaluate(e => Promise.all(e.getAnimations({ subtree: true }).map(a => a.finished)))`). `ResponsiveList` render cả bảng (`hidden md:block`) lẫn thẻ (`md:hidden`) → ở 390px dùng test id của thẻ, ở 1280px dùng `getByRole('row')`.
- Tài khoản seed DB test (mật khẩu `teacher123`): `teacher`, `teacher2`, `teacher_std`, `admin_test` (admin trong test/e2e). Không nhập credential nào khác vào trình duyệt; không ghi dữ liệu trên production.
- **Giờ VN UTC+7:** ngày/tháng luôn qua `vnDateParts`/`vnDayKey`/`vnMonthStart`; SQL dùng `(col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'`; tham số thời điểm trong `$queryRaw`/`$executeRaw` truyền `iso::timestamp` (không phụ thuộc TimeZone của phiên Postgres). Không dùng `getMonth()`/`getDate()` theo giờ máy.
- i18n: `src/language/vi.json` và `en.json` cùng bộ key (`tsc` bắt thiếu key ở `en`). Chuỗi mới không dùng gạch dài (—, –). Thay biến bằng `.replace("{x}", ...)`.
- Màu (A3): nhấn `primary` (#0F766E), trung tính slate, phụ `teal-300/400`, `emerald-600`, cảnh báo `amber-400/500/700`, lỗi `text-destructive`. **Không** indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts` phải pass). Vùng chạm ≥44px trên mobile: `h-11 md:h-10`.
- Bảng dùng `ResponsiveList` (`src/components/common/ResponsiveList.tsx`) như các màn admin khác.
- `tests/unit/next15-contract.test.ts` đỏ nếu `page.tsx`/`layout.tsx` có định danh `searchParams`/`params` (kể cả trong comment).
- Mọi procedure mới qua `adminProcedure`. Tên `admin.overview` đã dùng (màn Đơn chờ) → procedure mới tên `stats`, `accountTrend`, `revenue`, `newAccounts`, `markAccountsSeen`.
- **Xóa mềm (Q):** theo spec Q (Q1a) model `User` **không** nằm trong query extension tự lọc của Q, và raw SQL không bao giờ được lọc tự động → K phải lọc tay. **Doanh thu KHÔNG lọc xóa mềm** (người dùng chốt: tiền đã nhận, doanh thu quá khứ không đổi khi xóa tài khoản). Mọi truy vấn số liệu TÀI KHOẢN của K (thẻ, xu hướng, tài khoản mới) lọc tài khoản chưa xóa: Prisma `isDeleted: false` (hoặc `user: { isDeleted: false }` khi đi từ `planOrder`), SQL `u.is_deleted = false`. Tên field/cột thật, và helper lọc nếu Q có (vd `notDeleted`), lấy từ code sau Q — lệch thì theo code thật, ghi Ruling. Test tạo user giả đã xóa mềm bằng đúng cách Q đánh dấu (đặt field trực tiếp bằng Prisma).
- **Không giả định số ngày dùng thử mặc định** (người dùng sẽ tự đặt, có thể 0): test cần trạng thái dùng thử thì tự đặt `trialEndsAt`.
- DB test: `tests/setup.ts` tạo lại users mỗi lượt nên tài khoản seed có `admin_seen_at = null` (hiện trong "Tài khoản mới"). Test chỉ kiểm tài khoản do chính test tạo (theo username / chênh lệch trước-sau), không đếm tuyệt đối; selector e2e ở `/admin/orders` phải phân vùng bằng `within`/test id.
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy; không mô tả lại code.
- `core.autocrlf=true`: giữ kiểu xuống dòng sẵn có của file, không đổi hàng loạt CRLF/LF.
- Làm trên nhánh `feat/k-doanh-thu` (tạo ở Task 1 từ `main` mới nhất SAU KHI P **và Q** đã merge). **Không commit lên `main`. Agent thực hiện task KHÔNG merge, KHÔNG push.** Không đụng file untracked khác của người dùng.
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit (chỉ `git add` đúng file của task). Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Code lệch plan (vì code thật khác mô tả, nhất là sau P và Q) → theo code thật, giữ đúng hành vi spec, ghi "Ruling: …" trong báo cáo task.

## Điều chỉnh so với spec

1. Nhánh giữ tên `feat/k-doanh-thu` (đã báo người điều phối trước khi K mở rộng).
2. Nav thêm dần: Task 4 thêm "Tổng quan" (5 mục, `grid-cols-5`), Task 6 thêm "Doanh thu" (6 mục, `grid-cols-6`) — để mỗi task chỉ có link tới trang đã tồn tại. Số tab trong test cập nhật theo từng task.
3. E2E Doanh thu chế độ Năm chỉ kiểm **từng dòng tháng** T3–T6/2026; tổng chỉ kiểm ở Khoảng T1→T6/2026 (DB test dùng chung; T1–T6/2026 chỉ có đơn test tự seed). E2E Tổng quan kiểm số tương đối (≥ 1) vì số tài khoản của DB test phụ thuộc file test khác; số chính xác kiểm ở integration bằng **chênh lệch trước/sau** với user giả `stat_fake_*`.
4. Component test không thao tác Radix `Select` trong jsdom (không ổn định); lỗi khoảng doanh thu kiểm ở unit `rangeError` và e2e.
5. Thêm `adminUsernames()` vào `src/lib/admin.ts` (tách từ `isAdminUsername`, dùng cho SQL `text[]`), `fillMonth` và `shortDateTimeVn` vào `admin-format.ts`.
6. Plan **7 task** (vượt khung 4–6 ban đầu vì K mở rộng thêm Tổng quan + ghi hoạt động + Tài khoản mới): mỗi task vẫn là 1 khối review được riêng.
7. `countNewAccounts` (đếm R1) nằm ở Task 3 vì thẻ Chờ duyệt cần; phần còn lại của Tài khoản mới (danh sách, đánh dấu, `pendingCount`, tự đánh dấu khi đặt gói, UI) ở Task 5.

## Review Focus

1. **Postgres/DB lỗi hoặc 2 request cùng lúc khi ghi hoạt động:** request vẫn chạy (token trả về), chỉ 1 dòng/ngày. Pin: integration Task 1 `tests/integration/activity.test.ts` ("ghi lỗi không chặn", "gọi 2 lần song song").
2. **23:50 rồi 00:10 giờ VN (chưa tới 1 giờ):** vẫn có dòng cho ngày mới. Pin: unit Task 1 `shouldTouch` + integration Task 1.
3. **Tài khoản đăng ký hôm nay và dùng app hôm nay:** chỉ tính "Tài khoản mới", không tính "Quay lại". Pin: integration Task 3 `tests/integration/admin-stats.test.ts`.
4. **User có đơn trả tiền TRƯỚC khoảng lọc doanh thu / đơn 0đ đứng trước:** phân loại gia hạn/mới đúng. Pin: unit + integration Task 2.
5. **Admin hoặc tài khoản đã xóa mềm lọt vào số liệu tài khoản** (thẻ, xu hướng, tài khoản mới): không bao giờ; ngược lại **doanh thu giữ nguyên** khi xóa mềm tài khoản có đơn. Pin: integration Task 1 ("admin không ghi"), Task 2 ("xóa mềm → doanh thu KHÔNG đổi"), Task 3 ("admin, đã xóa mềm không tính"), Task 5 ("không hiện admin / đã xóa mềm").

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `prisma/schema.prisma` | Sửa | `User.lastActiveAt`, `User.adminSeenAt`, `User.activityDays`, model `UserActivityDay` | 1 |
| `prisma/migrations/<ts>_add_user_activity/migration.sql` | Mới | 2 cột + bảng + index + FK CASCADE + 2 backfill | 1 |
| `src/lib/activity.ts` | Mới | `ACTIVITY_TOUCH_MS`, `vnDayKey`, `vnDayDate`, `shouldTouch` | 1 |
| `src/server/services/activity.service.ts` | Mới | `touchActivity` | 1 |
| `src/server/auth-credentials.ts` | Sửa | `getSessionUserState` trả thêm `username`, `lastActiveAt` | 1 |
| `src/server/auth-node-callbacks.ts` | Sửa | `nodeJwt` gọi `touchActivity` | 1 |
| `tests/unit/lib/activity.test.ts` | Mới | Hàm thuần hoạt động | 1 |
| `tests/integration/user-activity-migration.test.ts` | Mới | SQL migration | 1 |
| `tests/integration/activity.test.ts` | Mới | Ghi hoạt động qua `nodeJwt` | 1 |
| `tests/integration/session-validity.test.ts` | Sửa | `toMatchObject` | 1 |
| `src/lib/revenue.ts` | Mới | Doanh thu thuần | 2 |
| `src/lib/schemas/plan.ts` | Sửa | `revenueQuerySchema` (T2), `accountTrendSchema` (T3), `markAccountsSeenSchema` (T5) | 2, 3, 5 |
| `src/server/services/revenue.service.ts` | Mới | `getRevenue` | 2 |
| `src/server/trpc/routers/admin.ts` | Sửa | `revenue` (T2), `stats`, `accountTrend` (T3), `newAccounts`, `markAccountsSeen` (T5) | 2, 3, 5 |
| `tests/unit/lib/revenue.test.ts`, `tests/integration/revenue.test.ts` | Mới | Doanh thu | 2 |
| `tests/unit/schemas/plan.schema.test.ts` | Sửa | 3 schema mới | 2, 3, 5 |
| `src/lib/admin.ts` | Sửa | `adminUsernames` (T3), `ADMIN_HOME` (T4) | 3, 4 |
| `src/lib/admin-stats.ts` | Mới | Thẻ, dải ngày, xu hướng | 3 |
| `src/server/services/admin-stats.service.ts` | Mới | `getAdminStats`, `getAccountTrend` | 3 |
| `src/server/services/new-accounts.service.ts` | Mới | `newAccountsWhere`, `countNewAccounts` (T3); `getNewAccounts`, `markAccountsSeen` (T5) | 3, 5 |
| `tests/unit/lib/admin-stats.test.ts`, `tests/integration/admin-stats.test.ts` | Mới | Tổng quan | 3 |
| `src/app/(admin)/admin/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/login/page.tsx`, `src/server/auth.config.ts`, `src/components/layout/AppHeader.tsx` | Sửa | Dùng `ADMIN_HOME` | 4 |
| `src/components/admin/admin-nav.ts` | Sửa | Tổng quan (T4), Doanh thu (T6) | 4, 6 |
| `src/components/admin/AdminTabBar.tsx` | Sửa | `grid-cols-5` (T4), chấm tài khoản mới (T5), `grid-cols-6` (T6) | 4, 5, 6 |
| `src/components/admin/AdminSidebar.tsx` | Sửa | Pill tài khoản mới | 5 |
| `src/components/admin/admin-format.ts` | Sửa | `shortDateTimeVn` (T4), `fillMonth` (T6) | 4, 6 |
| `src/components/admin/BarChart.tsx` | Mới | Biểu đồ cột chung | 4 |
| `src/components/admin/AdminOverview.tsx`, `AccountTrend.tsx` | Mới | Màn Tổng quan (T4); dòng phụ tài khoản mới ở thẻ Chờ duyệt có ngay T4 | 4 |
| `src/app/(admin)/admin/overview/page.tsx` | Mới | Route | 4 |
| `src/server/services/plan-admin.service.ts`, `src/server/services/trial.service.ts` | Sửa | Tự đánh dấu đã xem khi đặt gói/dùng thử | 5 |
| service `getPendingCount` của P (vị trí thật sau P) | Sửa | Trả thêm `newAccounts` | 5 |
| `src/components/admin/NewAccounts.tsx` | Mới | Khối Tài khoản mới | 5 |
| `src/components/admin/AdminPendingOrders.tsx` | Sửa | Gắn `NewAccounts` | 5 |
| `tests/integration/new-accounts.test.ts`, `tests/unit/components/NewAccounts.test.tsx`, `tests/e2e/admin-new-accounts.spec.ts` | Mới | Tài khoản mới | 5 |
| `src/components/admin/AdminRevenue.tsx`, `src/app/(admin)/admin/revenue/page.tsx` | Mới | Màn Doanh thu | 6 |
| `src/language/vi.json`, `en.json` | Sửa | Key tổng quan (T4), tài khoản mới (T5), doanh thu (T6) | 4, 5, 6 |
| `tests/unit/components/BarChart.test.tsx`, `AdminOverview.test.tsx`, `AccountTrend.test.tsx` | Mới | UI Tổng quan | 4 |
| `tests/unit/components/AdminRevenue.test.tsx` | Mới | UI Doanh thu | 6 |
| `tests/unit/components/AdminNav.test.tsx` | Sửa | 5 mục (T4), pill/chấm (T5), 6 mục (T6) | 4, 5, 6 |
| `tests/unit/auth-authorized.test.ts`, `tests/unit/layout/admin-redirect.test.ts`, `tests/unit/components/AppHeader.test.tsx` | Sửa | `/admin/overview` | 4 |
| `tests/e2e/admin-overview.spec.ts` | Mới | E2E Tổng quan | 4 |
| `tests/e2e/admin-revenue.spec.ts` | Mới | E2E Doanh thu | 6 |
| `tests/e2e/admin*.spec.ts` (có sẵn) | Sửa | Đích sau đăng nhập, số tab, danh sách 404 | 4, 6 |
| `package.json` | Sửa | version 0.6.0 | 7 |

Thứ tự bắt buộc (tuần tự, mỗi task 1 agent mới): Task 1 → 2 → 3 → 4 → 5 → 6 → 7. T3 cần `vnDayKey` + bảng hoạt động (T1); T4 cần `admin.stats`/`accountTrend` (T3); T5 cần cột `admin_seen_at` (T1), `newAccountsWhere`/`countNewAccounts` (T3), màn đơn chờ sau T4; T6 cần `admin.revenue` (T2), `BarChart` + nav 5 mục (T4).

---

### Task 1: Nhánh sau P + Q, commit spec + plan; migration (hoạt động + `admin_seen_at`) + ghi hoạt động trong `nodeJwt`

**Đọc trước:** Global Constraints; spec mục 1, 4 nhóm B và R6, 6, 7.1–7.3, 10 (phần activity); `docs/coding-rule.md` §6.1; `prisma/schema.prisma` (model `User` — đã có field xóa mềm của Q —, cuối file); cách Q chặn đăng nhập tài khoản đã xóa mềm trong `getSessionUserState`/`authorizeCredentials` (nếu có); `prisma/migrations/20260926144238_launch_plan_grants/migration.sql`; `src/server/auth-credentials.ts` (`getSessionUserState`, dòng ~135–155); `src/server/auth-node-callbacks.ts`; `src/lib/admin.ts`; `src/lib/utils.ts` (`vnDateParts`); `tests/integration/session-validity.test.ts` (dòng 1–50: cách dựng `token`, `call`); `tests/integration/plan-settings-migration.test.ts` (kiểu test đọc SQL).

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_user_activity/migration.sql`
- Create: `src/lib/activity.ts`, `src/server/services/activity.service.ts`
- Modify: `src/server/auth-credentials.ts`, `src/server/auth-node-callbacks.ts`
- Test (Mới): `tests/unit/lib/activity.test.ts`, `tests/integration/user-activity-migration.test.ts`, `tests/integration/activity.test.ts`
- Test (Sửa): `tests/integration/session-validity.test.ts`

**Interfaces:**
- Consumes: `vnDateParts` (`@/lib/utils`), `isAdminUsername` (`@/lib/admin`), `db` (`@/server/db`).
- Produces:
  - Prisma: `User.lastActiveAt: Date | null`; `User.adminSeenAt: Date | null` (null = admin chưa xem, dùng ở Task 3, 5); `db.userActivityDay` (`userId: number`, `day: Date` (cột DATE, nửa đêm UTC của ngày VN), `firstSeenAt: Date`), khóa `userId_day`.
  - `src/lib/activity.ts`: `ACTIVITY_TOUCH_MS = 3_600_000`; `vnDayKey(d: Date): string` (`"YYYY-MM-DD"` giờ VN); `vnDayDate(d: Date): Date`; `shouldTouch(lastActiveAt: Date | null, now: Date): boolean`.
  - `src/server/services/activity.service.ts`: `touchActivity(db: PrismaClient, u: { id: number; username: string; lastActiveAt: Date | null }, now: Date): Promise<void>` (không bao giờ ném).
  - `getSessionUserState(userId, sessionVersion): Promise<{ mustChangePassword: boolean; username: string; lastActiveAt: Date | null } | null>`.

- [ ] **Step 0: Kiểm P và Q đã merge, tạo nhánh, commit spec + plan**

```bash
git checkout main
git pull --ff-only
git log --oneline -25 main
grep -n '"version"' package.json
grep -n "isDeleted\|is_deleted" prisma/schema.prisma
git status --short
```
Expected: `git log` có commit merge của P (`fix/p-sua-backlog` / "(p)") **và** của Q (xóa mềm, "(q)"); `schema.prisma` có field xóa mềm của Q trên `User`; `package.json` là `"version": "0.5.0"` (Q, spec Q dòng 3; khác thì ghi lại số thật vào báo cáo). **Thiếu P hoặc Q → DỪNG, báo người điều phối "P/Q chưa merge vào main", không làm gì thêm.** Field xóa mềm tên khác `isDeleted` → ghi Ruling, mọi task sau dùng tên thật. `git status --short` có 2 file untracked của K (file untracked khác của người dùng thì kệ, KHÔNG add).

```bash
git checkout -b feat/k-doanh-thu
git add docs/superpowers/specs/2026-09-27-k-tong-quan-doanh-thu-admin-design.md docs/superpowers/plans/2026-09-27-k-tong-quan-doanh-thu-admin.md
git commit -m "docs(k): spec + plan Tổng quan + Doanh thu admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
Expected: commit chỉ có 2 file. Nhánh đã có → `git checkout feat/k-doanh-thu`, bỏ commit docs nếu đã có.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG, báo người dùng.

- [ ] **Step 2: Unit test hàm thuần (RED)**

Tạo `tests/unit/lib/activity.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { ACTIVITY_TOUCH_MS, shouldTouch, vnDayDate, vnDayKey } from "@/lib/activity"

describe("ngày VN cho hoạt động (spec K B10)", () => {
  it("16:59 UTC còn ngày cũ, 17:00 UTC sang ngày mới giờ VN", () => {
    expect(vnDayKey(new Date("2026-10-31T16:59:00Z"))).toBe("2026-10-31")
    expect(vnDayKey(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11-01")
    expect(vnDayKey(new Date("2026-12-31T17:30:00Z"))).toBe("2027-01-01")
  })
  it("vnDayDate = nửa đêm UTC của ngày VN (cho cột DATE)", () => {
    expect(vnDayDate(new Date("2026-10-31T17:00:00Z"))).toEqual(new Date("2026-11-01T00:00:00.000Z"))
    expect(vnDayDate(new Date("2026-11-01T03:00:00Z"))).toEqual(new Date("2026-11-01T00:00:00.000Z"))
  })
})

describe("shouldTouch (spec K B2)", () => {
  const now = new Date("2026-11-01T05:00:00Z") // 12:00 VN
  it("chưa từng ghi → ghi", () => {
    expect(shouldTouch(null, now)).toBe(true)
  })
  it("59 phút trước cùng ngày → không; 60 phút → ghi", () => {
    expect(shouldTouch(new Date(now.getTime() - ACTIVITY_TOUCH_MS + 60_000), now)).toBe(false)
    expect(shouldTouch(new Date(now.getTime() - ACTIVITY_TOUCH_MS), now)).toBe(true)
  })
  it("23:50 VN hôm trước → 00:10 VN hôm nay (20 phút) vẫn ghi vì khác ngày", () => {
    const last = new Date("2026-10-31T16:50:00Z")
    const at = new Date("2026-10-31T17:10:00Z")
    expect(shouldTouch(last, at)).toBe(true)
  })
})
```

Run: `pnpm test tests/unit/lib/activity.test.ts`
Expected: FAIL — không resolve `@/lib/activity`.

- [ ] **Step 3: Viết `src/lib/activity.ts`**

```ts
// Thuần: ngày VN cho dữ liệu hoạt động (spec K nhóm B).
import { vnDateParts } from "@/lib/utils"

// ≤ 1 lần ghi/giờ/người nhưng Active 24h vẫn chính xác tới 1 giờ (spec K B2).
export const ACTIVITY_TOUCH_MS = 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, "0")

export function vnDayKey(d: Date): string {
  const { year, month, day } = vnDateParts(d)
  return `${year}-${pad(month)}-${pad(day)}`
}

// Prisma ghi cột @db.Date theo phần ngày UTC: nửa đêm UTC giữ đúng ngày VN.
export function vnDayDate(d: Date): Date {
  const { year, month, day } = vnDateParts(d)
  return new Date(Date.UTC(year, month - 1, day))
}

export function shouldTouch(lastActiveAt: Date | null, now: Date): boolean {
  if (!lastActiveAt) return true
  if (now.getTime() - lastActiveAt.getTime() >= ACTIVITY_TOUCH_MS) return true
  return vnDayKey(lastActiveAt) !== vnDayKey(now)
}
```

Run: `pnpm test tests/unit/lib/activity.test.ts`
Expected: PASS (5 test).

- [ ] **Step 4: Sửa `prisma/schema.prisma`**

Trong model `User`, ngay dưới `lastLoginAt`:
```prisma
  // Lần cuối dùng app (cập nhật ≤ 1 lần/giờ ở nodeJwt), khác lastLoginAt vì phiên ghi nhớ 30 ngày (spec K B2).
  lastActiveAt  DateTime?         @map("last_active_at")
  // null = admin chưa xem tài khoản mới này (spec K nhóm R).
  adminSeenAt   DateTime?         @map("admin_seen_at")
```
và trong danh sách quan hệ của `User` (cạnh `planOrders`): `activityDays  UserActivityDay[]`.

Cuối file:
```prisma
// 1 dòng / tài khoản / ngày VN có dùng app (spec K B7). CASCADE để tests/setup.ts xóa users không vỡ.
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

- [ ] **Step 5: Tạo migration trên DB test (chưa áp)**

Run (Bash):
```bash
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  case "$DIRECT_URL" in *localhost:5433*) ;; *) echo "DỪNG: DIRECT_URL không phải DB test"; exit 1;; esac
  pnpm exec prisma migrate dev --create-only --name add_user_activity
)
ls prisma/migrations | grep _add_user_activity
cat prisma/migrations/*_add_user_activity/migration.sql
```
Expected: `Datasource "db": PostgreSQL database ... at "localhost:5433"` và `Prisma Migrate created the following migration without applying it ..._add_user_activity`. Timestamp thư mục lớn hơn mọi migration sẵn có (kể cả của P nếu P có). SQL chỉ gồm (khoảng trắng có thể khác): `ALTER TABLE "users" ADD COLUMN "admin_seen_at" TIMESTAMP(3), ADD COLUMN "last_active_at" TIMESTAMP(3);` (thứ tự/tách câu có thể khác), `CREATE TABLE "user_activity_days" ("user_id" INTEGER NOT NULL, "day" DATE NOT NULL, "first_seen_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "user_activity_days_pkey" PRIMARY KEY ("user_id","day"));`, `CREATE INDEX "user_activity_days_day_idx" ON "user_activity_days"("day");`, `ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`. Có `DROP`/`DELETE`/đụng cột khác → DỪNG, báo người dùng (schema lệch DB test). Prisma đòi reset → DỪNG.

Thêm tay cuối `migration.sql`:
```sql

-- Có số Active 24h / "Standard sau dùng thử" ngay khi lên (spec K B8); chỉ ghi vào cột vừa thêm.
UPDATE "users" SET "last_active_at" = "last_login_at" WHERE "last_active_at" IS NULL;

-- Tài khoản có sẵn lúc triển khai coi như admin đã xem (spec K R6), danh sách "Tài khoản mới" không ngập tài khoản cũ.
UPDATE "users" SET "admin_seen_at" = now() AT TIME ZONE 'UTC' WHERE "admin_seen_at" IS NULL;
```

- [ ] **Step 6: Test migration (RED → áp → GREEN)**

Tạo `tests/integration/user-activity-migration.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

// Đọc đúng SQL sẽ chạy trên production khi Vercel build.
function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_user_activity"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

describe("Migration add_user_activity", () => {
  it("chỉ thêm cột/bảng/index/FK CASCADE + backfill vào cột mới", () => {
    const sql = migrationSql()
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i)
    expect(sql).toMatch(/ADD COLUMN\s+"last_active_at" TIMESTAMP\(3\)/)
    expect(sql).toMatch(/ADD COLUMN\s+"admin_seen_at" TIMESTAMP\(3\)/)
    expect(sql).toContain('CREATE TABLE "user_activity_days"')
    expect(sql).toMatch(/ON DELETE CASCADE/)
    const updates = sql.match(/^UPDATE .*$/gim) ?? []
    expect(updates).toEqual([
      'UPDATE "users" SET "last_active_at" = "last_login_at" WHERE "last_active_at" IS NULL;',
      `UPDATE "users" SET "admin_seen_at" = now() AT TIME ZONE 'UTC' WHERE "admin_seen_at" IS NULL;`,
    ])
  })

  it("DB test đã áp: đọc được 2 cột và bảng mới", async () => {
    await expect(db.user.findFirst({ select: { lastActiveAt: true, adminSeenAt: true } })).resolves.toBeDefined()
    await expect(db.userActivityDay.count()).resolves.toBeGreaterThanOrEqual(0)
  })
})
```
(Task 5 dùng lại câu backfill `admin_seen_at` từ file này để test "tài khoản cũ không hiện".)
Run: `pnpm test tests/integration/user-activity-migration.test.ts`
Expected: FAIL ở test 2 (cột/bảng chưa có trên DB test; hoặc lỗi kiểu Prisma client cũ).

Áp lên DB test + generate:
```bash
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  pnpm exec prisma migrate status
  pnpm exec prisma migrate deploy
)
pnpm exec prisma generate
```
Expected: `migrate status` in `... at "localhost:5433"` và đúng 1 migration chưa áp (`..._add_user_activity`); `migrate deploy` in `Applying migration ..._add_user_activity` và `All migrations have been successfully applied`. Host khác → DỪNG. `prisma generate` lỗi `EPERM` → tắt tiến trình node/next của chính mình rồi chạy lại; vẫn lỗi → DỪNG, báo người dùng.

Run: `pnpm test tests/integration/user-activity-migration.test.ts`
Expected: PASS (2 test).

- [ ] **Step 7: Integration test ghi hoạt động (RED)**

Tạo `tests/integration/activity.test.ts`:
```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { nodeJwt } from "@/server/auth-node-callbacks"
import { currentEpoch } from "@/lib/session-policy"
import { vnDayDate } from "@/lib/activity"

type P = Parameters<typeof nodeJwt>[0]
let stdId = 0
let adminId = 0

const token = (userId: number, username: string) => ({
  userId: String(userId),
  username,
  fullName: null,
  remember: false,
  epoch: currentEpoch(),
  sessionVersion: 0,
  mustChangePassword: false,
  iat: Math.floor(Date.now() / 1000) - 60,
})
const call = (userId: number, username: string) => nodeJwt({ token: token(userId, username) } as unknown as P)
const rows = (userId: number) => db.userActivityDay.findMany({ where: { userId }, orderBy: { day: "asc" } })

async function reset() {
  await db.userActivityDay.deleteMany({ where: { userId: { in: [stdId, adminId] } } })
  await db.user.updateMany({ where: { id: { in: [stdId, adminId] } }, data: { lastActiveAt: null } })
}

beforeAll(async () => {
  stdId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
  adminId = (await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })).id
})
beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  vi.restoreAllMocks()
  await reset()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  vi.restoreAllMocks()
  await reset()
})

describe("ghi hoạt động qua nodeJwt (spec K nhóm B)", () => {
  it("lần đầu → 1 dòng hôm nay + last_active_at; gọi lại ngay → không ghi thêm, updated_at không đổi", async () => {
    expect(await call(stdId, "teacher_std")).not.toBeNull()
    const r1 = await rows(stdId)
    expect(r1).toHaveLength(1)
    expect(r1[0].day).toEqual(vnDayDate(new Date()))
    const u1 = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    expect(Math.abs(u1.lastActiveAt!.getTime() - Date.now())).toBeLessThan(10_000)

    await call(stdId, "teacher_std")
    const u2 = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    expect(await rows(stdId)).toHaveLength(1)
    expect(u2.lastActiveAt).toEqual(u1.lastActiveAt)
    expect(u2.updatedAt).toEqual(u1.updatedAt)
  })

  it("last_active_at lùi 2 giờ (cùng ngày) → cập nhật mốc, vẫn 1 dòng (ON CONFLICT DO NOTHING)", async () => {
    await call(stdId, "teacher_std")
    const before = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    const twoHoursAgo = new Date(before.lastActiveAt!.getTime() - 2 * 60 * 60 * 1000)
    await db.user.update({ where: { id: stdId }, data: { lastActiveAt: twoHoursAgo } })
    await call(stdId, "teacher_std")
    const after = await db.user.findUniqueOrThrow({ where: { id: stdId } })
    expect(after.lastActiveAt!.getTime()).toBeGreaterThan(twoHoursAgo.getTime() + 60 * 60 * 1000)
    // Nếu 2 giờ trước là hôm qua giờ VN (chạy test lúc 00:00–02:00 VN) thì có thêm dòng hôm qua? Không: chỉ ghi ngày của now.
    expect((await rows(stdId)).map((r) => r.day)).toEqual([vnDayDate(new Date())])
  })

  it("last_active_at là hôm qua → thêm dòng hôm nay", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await db.userActivityDay.create({ data: { userId: stdId, day: vnDayDate(yesterday), firstSeenAt: yesterday } })
    await db.user.update({ where: { id: stdId }, data: { lastActiveAt: yesterday } })
    await call(stdId, "teacher_std")
    expect((await rows(stdId)).map((r) => r.day)).toEqual([vnDayDate(yesterday), vnDayDate(new Date())])
  })

  it("gọi 2 lần song song → vẫn 1 dòng, không lỗi", async () => {
    const res = await Promise.all([call(stdId, "teacher_std"), call(stdId, "teacher_std")])
    expect(res.every((t) => t !== null)).toBe(true)
    expect(await rows(stdId)).toHaveLength(1)
  })

  it("admin → không ghi gì", async () => {
    expect(await call(adminId, "admin_test")).not.toBeNull()
    expect(await rows(adminId)).toHaveLength(0)
    expect((await db.user.findUniqueOrThrow({ where: { id: adminId } })).lastActiveAt).toBeNull()
  })

  it("ghi lỗi → nodeJwt vẫn trả token, chỉ console.warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("boom"))
    const t = await call(stdId, "teacher_std")
    expect(t).not.toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(await rows(stdId)).toHaveLength(0)
  })
})
```

Run: `pnpm test tests/integration/activity.test.ts`
Expected: FAIL — test 1 thấy 0 dòng (chưa ghi).

- [ ] **Step 8: Viết `touchActivity` và nối vào `nodeJwt`**

Tạo `src/server/services/activity.service.ts`:
```ts
import type { PrismaClient } from "@prisma/client"
import { isAdminUsername } from "@/lib/admin"
import { shouldTouch, vnDayDate } from "@/lib/activity"

// Gọi mỗi request đã đăng nhập (nodeJwt): phần lớn request return ngay, không tốn truy vấn (spec K B1–B4).
export async function touchActivity(
  db: PrismaClient,
  u: { id: number; username: string; lastActiveAt: Date | null },
  now: Date
): Promise<void> {
  if (isAdminUsername(u.username) || !shouldTouch(u.lastActiveAt, now)) return
  try {
    await db.$transaction([
      db.userActivityDay.createMany({ data: [{ userId: u.id, day: vnDayDate(now), firstSeenAt: now }], skipDuplicates: true }),
      // Raw để không bump updated_at; ::timestamp để không phụ thuộc TimeZone của phiên Postgres.
      db.$executeRaw`UPDATE "users" SET "last_active_at" = ${now.toISOString()}::timestamp WHERE "id" = ${u.id}`,
    ])
  } catch (e) {
    console.warn(`[activity] không ghi được hoạt động user ${u.id}`, e)
  }
}
```

`src/server/auth-credentials.ts` → `getSessionUserState`: đổi kiểu trả về thành `Promise<{ mustChangePassword: boolean; username: string; lastActiveAt: Date | null } | null>`, `select` thêm `username: true, lastActiveAt: true`, dòng cuối `return { mustChangePassword: u.mustChangePassword, username: u.username, lastActiveAt: u.lastActiveAt }`. Không đổi gì khác.

`src/server/auth-node-callbacks.ts`: thêm import `import { db } from "@/server/db"` và `import { touchActivity } from "@/server/services/activity.service"`; ngay sau `if (!state) return null`:
```ts
  await touchActivity(db, { id: Number(t.userId), username: state.username, lastActiveAt: state.lastActiveAt }, new Date())
```

`tests/integration/session-validity.test.ts`: 2 dòng `expect(await getSessionUserState(teacherId, 0)).toEqual({ mustChangePassword: … })` → `.toMatchObject({ mustChangePassword: … })`.

- [ ] **Step 9: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/activity.test.ts`
Expected: PASS (6 test). Nếu `vi.spyOn(db, "$transaction")` không bắt được (client Prisma dùng proxy) → mock `touchActivity`-level bằng cách `vi.spyOn(db.userActivityDay, "createMany").mockImplementationOnce(() => { throw new Error("boom") })`, ghi Ruling.
Run: `pnpm test tests/integration/session-validity.test.ts`
Expected: PASS.
Run: `pnpm test tests/integration/password-reset.test.ts`
Expected: PASS.
Run: `pnpm test tests/unit/auth-jwt.test.ts`
Expected: PASS.

- [ ] **Step 10: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit
pnpm lint
git add prisma/schema.prisma prisma/migrations/*_add_user_activity src/lib/activity.ts src/server/services/activity.service.ts src/server/auth-credentials.ts src/server/auth-node-callbacks.ts tests/unit/lib/activity.test.ts tests/integration/user-activity-migration.test.ts tests/integration/activity.test.ts tests/integration/session-validity.test.ts
git commit -m "feat(k): ghi hoạt động theo ngày VN (user_activity_days, users.last_active_at) trong nodeJwt, throttle 1 giờ, bỏ qua admin; cột users.admin_seen_at

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Doanh thu phía server (hàm thuần, schema, service, `admin.revenue`)

**Đọc trước:** Global Constraints; spec mục 4 nhóm C, 7.6–7.8, 10 (revenue); `src/lib/plans.ts` dòng 1–30 và `isPaidPlan`/`isPeriod`; `src/lib/utils.ts` (`vnDateParts`); `src/lib/schemas/plan.ts`; `tests/unit/schemas/plan.schema.test.ts` (import đầu file); `src/server/trpc/routers/admin.ts` (đối chiếu sau P, Q); `src/server/services/plan.service.ts` dòng 1–30 (type `Db`); `tests/integration/admin.test.ts` dòng 1–40; field xóa mềm của Q trên `User` (tên thật; chỉ dùng trong test — doanh thu KHÔNG lọc xóa mềm, K16).

**Files:**
- Create: `src/lib/revenue.ts`, `src/server/services/revenue.service.ts`
- Modify: `src/lib/schemas/plan.ts`, `src/server/trpc/routers/admin.ts`
- Test (Mới): `tests/unit/lib/revenue.test.ts`, `tests/integration/revenue.test.ts`
- Test (Sửa): `tests/unit/schemas/plan.schema.test.ts`

**Interfaces:**
- Consumes: `isPaidPlan`, `isPeriod`, `PERIODS`, `type PaidPlan`, `type Period` (`@/lib/plans`); `vnDateParts` (`@/lib/utils`); `type Db` (`./plan.service`).
- Produces (`src/lib/revenue.ts`):
  - `type YearMonth = { year: number; month: number }`
  - `type RevenueKind = "new" | "renew" | "upgrade"`; `REVENUE_KINDS: readonly RevenueKind[]`
  - `type RevenueBucket = { amount: number; count: number }`
  - `type RevenueStats = { total: RevenueBucket; byKind: Record<RevenueKind, RevenueBucket>; byPlan: Record<PaidPlan, RevenueBucket>; byPeriod: Record<Period, RevenueBucket> }`
  - `type RevenueMonth = YearMonth & RevenueStats`; `type RevenueReport = { months: RevenueMonth[]; summary: RevenueStats }`
  - `type RevenueOrder = { id: number; userId: number; plan: string; period: string | null; amount: number; creditDays: number; decidedAt: Date }`
  - `type RevenueFilter = { mode: "month"; year: number; month: number } | { mode: "range"; from: YearMonth; to: YearMonth } | { mode: "year"; year: number }`
  - `REVENUE_MAX_MONTHS = 36`, `REVENUE_FIRST_YEAR = 2026`
  - `vnMonthStart(ym): Date`, `monthIndex(ym): number`, `nextMonth(ym): YearMonth`, `monthsBetween(from, to): YearMonth[]`, `filterToRange(f): { from; to }`, `rangeError(from, to): "order" | "too_long" | null`, `emptyStats(): RevenueStats`, `classifyOrders(orders): Map<number, RevenueKind>`, `buildRevenueReport(orders, from, to): RevenueReport`
- Produces (schema): `revenueQuerySchema`, `type RevenueQueryInput`.
- Produces (server): `getRevenue(db: Db, input: RevenueQueryInput): Promise<RevenueReport>`; tRPC `admin.revenue` (input `{ from, to }`, output `RevenueReport`, không có `Date`).

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Unit test hàm thuần + schema (RED)**

Tạo `tests/unit/lib/revenue.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import {
  buildRevenueReport,
  classifyOrders,
  filterToRange,
  monthsBetween,
  nextMonth,
  rangeError,
  vnMonthStart,
  type RevenueOrder,
  type RevenueStats,
} from "@/lib/revenue"

let seq = 0
function order(p: Partial<RevenueOrder> & { decidedAt: string }): RevenueOrder {
  seq += 1
  return { id: seq, userId: 1, plan: "plus", period: "month", amount: 49000, creditDays: 0, ...p, decidedAt: new Date(p.decidedAt) }
}
const sum = (r: Record<string, { amount: number; count: number }>) =>
  Object.values(r).reduce((a, b) => ({ amount: a.amount + b.amount, count: a.count + b.count }), { amount: 0, count: 0 })

describe("biên tháng giờ VN", () => {
  it("vnMonthStart = 00:00 ngày 1 giờ VN (17:00 UTC hôm trước)", () => {
    expect(vnMonthStart({ year: 2026, month: 10 })).toEqual(new Date("2026-09-30T17:00:00.000Z"))
    expect(vnMonthStart({ year: 2027, month: 1 })).toEqual(new Date("2026-12-31T17:00:00.000Z"))
  })
  it("nextMonth qua năm; monthsBetween gồm 2 đầu", () => {
    expect(nextMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 })
    expect(monthsBetween({ year: 2026, month: 11 }, { year: 2027, month: 2 })).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ])
    expect(monthsBetween({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toEqual([{ year: 2026, month: 5 }])
  })
})

describe("filterToRange / rangeError (spec K C7)", () => {
  it("3 chế độ", () => {
    expect(filterToRange({ mode: "month", year: 2026, month: 10 })).toEqual({ from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } })
    expect(filterToRange({ mode: "year", year: 2026 })).toEqual({ from: { year: 2026, month: 1 }, to: { year: 2026, month: 12 } })
    const from = { year: 2026, month: 3 }
    const to = { year: 2027, month: 2 }
    expect(filterToRange({ mode: "range", from, to })).toEqual({ from, to })
  })
  it("ngược → order; đúng 36 tháng → null; 37 → too_long", () => {
    expect(rangeError({ year: 2026, month: 5 }, { year: 2026, month: 3 })).toBe("order")
    expect(rangeError({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBeNull()
    expect(rangeError({ year: 2026, month: 1 }, { year: 2028, month: 12 })).toBeNull()
    expect(rangeError({ year: 2026, month: 1 }, { year: 2029, month: 1 })).toBe("too_long")
  })
})

describe("classifyOrders (spec K C3–C5)", () => {
  it("mới → gia hạn → nâng cấp (Pro có creditDays) → gia hạn; user khác độc lập", () => {
    const a1 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const a2 = order({ decidedAt: "2026-02-05T03:00:00Z", period: "year", amount: 490000 })
    const a3 = order({ decidedAt: "2026-03-05T03:00:00Z", plan: "pro", period: "year", amount: 990000, creditDays: 120 })
    const a4 = order({ decidedAt: "2026-04-05T03:00:00Z", plan: "pro", period: "month", amount: 99000 })
    const b1 = order({ userId: 2, decidedAt: "2026-02-10T03:00:00Z", plan: "pro", period: "month", amount: 99000 })
    const k = classifyOrders([a4, b1, a3, a1, a2])
    expect([k.get(a1.id), k.get(a2.id), k.get(a3.id), k.get(a4.id), k.get(b1.id)]).toEqual(["new", "renew", "upgrade", "renew", "new"])
  })
  it("Pro không quy đổi (creditDays 0) sau khi Plus hết hạn → gia hạn", () => {
    const a1 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const a2 = order({ decidedAt: "2026-03-05T03:00:00Z", plan: "pro", period: "year", amount: 990000 })
    expect(classifyOrders([a1, a2]).get(a2.id)).toBe("renew")
  })
  it("cùng decidedAt → id nhỏ hơn là đơn trước", () => {
    const a1 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const a2 = order({ decidedAt: "2026-01-05T03:00:00Z" })
    const k = classifyOrders([a2, a1])
    expect([k.get(a1.id), k.get(a2.id)]).toEqual(["new", "renew"])
  })
  it("đơn 0đ / plan lạ / period null bị bỏ và không tính là đã mua", () => {
    const gift = order({ decidedAt: "2026-01-01T03:00:00Z", plan: "pro", period: null, amount: 0 })
    const zero = order({ decidedAt: "2026-01-02T03:00:00Z", amount: 0 })
    const odd = order({ decidedAt: "2026-01-03T03:00:00Z", plan: "gold" })
    const first = order({ decidedAt: "2026-02-01T03:00:00Z" })
    const k = classifyOrders([gift, zero, odd, first])
    expect(k.has(gift.id) || k.has(zero.id) || k.has(odd.id)).toBe(false)
    expect(k.get(first.id)).toBe("new")
  })
})

describe("buildRevenueReport", () => {
  const range = { from: { year: 2026, month: 10 }, to: { year: 2026, month: 12 } }

  it("biên tháng: 23:30 ngày 31/10 giờ VN vào tháng 10, 00:10 ngày 1/11 giờ VN vào tháng 11", () => {
    const r = buildRevenueReport(
      [
        order({ userId: 1, decidedAt: "2026-10-31T16:30:00Z" }),
        order({ userId: 2, decidedAt: "2026-10-31T17:10:00Z", plan: "pro", amount: 99000 }),
      ],
      range.from,
      range.to
    )
    expect(r.months.map((m) => [m.month, m.total.amount, m.total.count])).toEqual([
      [10, 49000, 1],
      [11, 99000, 1],
      [12, 0, 0],
    ])
  })

  it("đơn trước khoảng không cộng nhưng làm đơn trong khoảng thành gia hạn; đơn sau khoảng bỏ", () => {
    const r = buildRevenueReport(
      [
        order({ decidedAt: "2026-09-15T03:00:00Z" }),
        order({ decidedAt: "2026-10-15T03:00:00Z", period: "year", amount: 490000 }),
        order({ decidedAt: "2027-01-02T03:00:00Z" }),
      ],
      range.from,
      range.to
    )
    expect(r.summary.total).toEqual({ amount: 490000, count: 1 })
    expect(r.summary.byKind.renew).toEqual({ amount: 490000, count: 1 })
    expect(r.summary.byKind.new).toEqual({ amount: 0, count: 0 })
    expect(r.months).toHaveLength(3)
  })

  it("tổng các nhóm khớp total; summary = cộng các tháng", () => {
    const r = buildRevenueReport(
      [
        order({ userId: 1, decidedAt: "2026-10-05T03:00:00Z" }),
        order({ userId: 1, decidedAt: "2026-11-05T03:00:00Z", plan: "pro", period: "year", amount: 990000, creditDays: 30 }),
        order({ userId: 2, decidedAt: "2026-11-06T03:00:00Z", plan: "pro", period: "2year", amount: 1980000 }),
        order({ userId: 2, decidedAt: "2026-12-06T03:00:00Z", period: "year", amount: 490000 }),
      ],
      range.from,
      range.to
    )
    const s: RevenueStats = r.summary
    expect(s.total).toEqual({ amount: 3509000, count: 4 })
    for (const part of [s.byKind, s.byPlan, s.byPeriod]) expect(sum(part)).toEqual(s.total)
    expect(s.byKind).toEqual({ new: { amount: 2029000, count: 2 }, renew: { amount: 490000, count: 1 }, upgrade: { amount: 990000, count: 1 } })
    expect(s.byPlan).toEqual({ plus: { amount: 539000, count: 2 }, pro: { amount: 2970000, count: 2 } })
    expect(s.byPeriod).toEqual({ month: { amount: 49000, count: 1 }, year: { amount: 1480000, count: 2 }, "2year": { amount: 1980000, count: 1 } })
    expect(sum(Object.fromEntries(r.months.map((m) => [m.month, m.total])))).toEqual(s.total)
  })
})
```

`tests/unit/schemas/plan.schema.test.ts`: thêm `revenueQuerySchema` vào import từ `@/lib/schemas/plan` (thứ tự chữ cái), thêm cuối file:
```ts
describe("revenueQuerySchema (spec K C7)", () => {
  const ym = (year: number, month: number) => ({ year, month })
  it("hợp lệ: 1 tháng, 36 tháng", () => {
    expect(revenueQuerySchema.safeParse({ from: ym(2026, 10), to: ym(2026, 10) }).success).toBe(true)
    expect(revenueQuerySchema.safeParse({ from: ym(2026, 1), to: ym(2028, 12) }).success).toBe(true)
  })
  it("lỗi: tháng 13, tháng 0, năm 2019, số lẻ, ngược, 37 tháng", () => {
    for (const bad of [
      { from: ym(2026, 13), to: ym(2026, 13) },
      { from: ym(2026, 0), to: ym(2026, 1) },
      { from: ym(2019, 1), to: ym(2019, 2) },
      { from: ym(2026, 1.5), to: ym(2026, 2) },
      { from: ym(2026, 5), to: ym(2026, 3) },
      { from: ym(2026, 1), to: ym(2029, 1) },
    ]) {
      expect(revenueQuerySchema.safeParse(bad).success).toBe(false)
    }
  })
})
```

Run: `pnpm test tests/unit/lib/revenue.test.ts` → Expected: FAIL (không resolve `@/lib/revenue`).
Run: `pnpm test tests/unit/schemas/plan.schema.test.ts` → Expected: FAIL (`revenueQuerySchema` undefined).

- [ ] **Step 3: Viết `src/lib/revenue.ts`**

```ts
// Thuần, dùng chung client/server: doanh thu gói theo tháng của ngày duyệt giờ VN (spec K nhóm C).
import { isPaidPlan, isPeriod, type PaidPlan, type Period } from "@/lib/plans"
import { vnDateParts } from "@/lib/utils"

export type YearMonth = { year: number; month: number }
export type RevenueKind = "new" | "renew" | "upgrade"
export const REVENUE_KINDS: readonly RevenueKind[] = ["new", "renew", "upgrade"]
export type RevenueBucket = { amount: number; count: number }
export type RevenueStats = {
  total: RevenueBucket
  byKind: Record<RevenueKind, RevenueBucket>
  byPlan: Record<PaidPlan, RevenueBucket>
  byPeriod: Record<Period, RevenueBucket>
}
export type RevenueMonth = YearMonth & RevenueStats
export type RevenueReport = { months: RevenueMonth[]; summary: RevenueStats }
export type RevenueOrder = {
  id: number
  userId: number
  plan: string
  period: string | null
  amount: number
  creditDays: number
  decidedAt: Date
}
export type RevenueFilter =
  | { mode: "month"; year: number; month: number }
  | { mode: "range"; from: YearMonth; to: YearMonth }
  | { mode: "year"; year: number }

export const REVENUE_MAX_MONTHS = 36
// Năm ra mắt phân gói: không có đơn trước đó.
export const REVENUE_FIRST_YEAR = 2026

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export function vnMonthStart({ year, month }: YearMonth): Date {
  return new Date(Date.UTC(year, month - 1, 1) - VN_OFFSET_MS)
}

export function monthIndex({ year, month }: YearMonth): number {
  return year * 12 + month - 1
}

function fromIndex(i: number): YearMonth {
  return { year: Math.floor(i / 12), month: (i % 12) + 1 }
}

export function nextMonth(ym: YearMonth): YearMonth {
  return fromIndex(monthIndex(ym) + 1)
}

export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  const out: YearMonth[] = []
  for (let i = monthIndex(from); i <= monthIndex(to); i++) out.push(fromIndex(i))
  return out
}

export function filterToRange(f: RevenueFilter): { from: YearMonth; to: YearMonth } {
  if (f.mode === "month") return { from: { year: f.year, month: f.month }, to: { year: f.year, month: f.month } }
  if (f.mode === "year") return { from: { year: f.year, month: 1 }, to: { year: f.year, month: 12 } }
  return { from: f.from, to: f.to }
}

export function rangeError(from: YearMonth, to: YearMonth): "order" | "too_long" | null {
  const span = monthIndex(to) - monthIndex(from) + 1
  if (span < 1) return "order"
  return span > REVENUE_MAX_MONTHS ? "too_long" : null
}

const bucket = (): RevenueBucket => ({ amount: 0, count: 0 })

export function emptyStats(): RevenueStats {
  return {
    total: bucket(),
    byKind: { new: bucket(), renew: bucket(), upgrade: bucket() },
    byPlan: { plus: bucket(), pro: bucket() },
    byPeriod: { month: bucket(), year: bucket(), "2year": bucket() },
  }
}

type CountedOrder = RevenueOrder & { plan: PaidPlan; period: Period }

// Cột plan/period là VARCHAR: giá trị lạ hoặc đơn 0đ (tặng, admin đặt tay) không cộng và không tính là "đã mua".
function isCounted(o: RevenueOrder): o is CountedOrder {
  return o.amount > 0 && isPaidPlan(o.plan) && isPeriod(o.period)
}

export function classifyOrders(orders: RevenueOrder[]): Map<number, RevenueKind> {
  const kinds = new Map<number, RevenueKind>()
  const paidUsers = new Set<number>()
  const sorted = orders.filter(isCounted).sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime() || a.id - b.id)
  for (const o of sorted) {
    // creditDays > 0 chỉ có khi Plus trả phí còn hạn lên Pro (D7) → nhóm Nâng cấp riêng (spec K C4).
    kinds.set(o.id, o.plan === "pro" && o.creditDays > 0 ? "upgrade" : paidUsers.has(o.userId) ? "renew" : "new")
    paidUsers.add(o.userId)
  }
  return kinds
}

function addTo(s: RevenueStats, o: CountedOrder, kind: RevenueKind) {
  for (const b of [s.total, s.byKind[kind], s.byPlan[o.plan], s.byPeriod[o.period]]) {
    b.amount += o.amount
    b.count += 1
  }
}

// orders phải gồm cả đơn TRƯỚC khoảng để phân loại mới/gia hạn đúng (spec K C3, C6).
export function buildRevenueReport(orders: RevenueOrder[], from: YearMonth, to: YearMonth): RevenueReport {
  const kinds = classifyOrders(orders)
  const months: RevenueMonth[] = monthsBetween(from, to).map((ym) => ({ ...ym, ...emptyStats() }))
  const summary = emptyStats()
  const start = monthIndex(from)
  for (const o of orders) {
    const kind = kinds.get(o.id)
    if (!kind || !isCounted(o)) continue
    const { year, month } = vnDateParts(o.decidedAt)
    const row = months[monthIndex({ year, month }) - start]
    if (!row) continue
    addTo(row, o, kind)
    addTo(summary, o, kind)
  }
  return { months, summary }
}
```

- [ ] **Step 4: Schema cuối `src/lib/schemas/plan.ts`**

Thêm import `import { rangeError } from "@/lib/revenue"` cạnh các import sẵn có. Cuối file:
```ts
const yearMonthSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})
export const revenueQuerySchema = z
  .object({ from: yearMonthSchema, to: yearMonthSchema })
  .refine((d) => rangeError(d.from, d.to) !== "order", { message: "Tháng kết thúc phải sau tháng bắt đầu", path: ["to"] })
  .refine((d) => rangeError(d.from, d.to) !== "too_long", { message: "Tối đa 36 tháng", path: ["to"] })
export type RevenueQueryInput = z.infer<typeof revenueQuerySchema>
```
(`src/lib/revenue.ts` không import `schemas/plan` nên không có vòng import.)

Run: `pnpm test tests/unit/lib/revenue.test.ts` → Expected: PASS.
Run: `pnpm test tests/unit/schemas/plan.schema.test.ts` → Expected: PASS (cả test cũ).

- [ ] **Step 5: Integration test (RED)**

Tạo `tests/integration/revenue.test.ts`:
```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const USERS = ["teacher_std", "admin_test"]
let a = 0
let b = 0

async function reset() {
  await db.planOrder.deleteMany({ where: { user: { username: { in: USERS } } } })
}

type Seed = { userId: number; plan: string; period: string | null; amount: number; status: string; source?: string; creditDays?: number; decidedAt: string | null }
async function seed(rows: Seed[]) {
  for (const r of rows) {
    await db.planOrder.create({
      data: {
        userId: r.userId,
        plan: r.plan,
        period: r.period,
        amount: r.amount,
        status: r.status,
        source: r.source ?? "user",
        creditDays: r.creditDays ?? 0,
        decidedAt: r.decidedAt ? new Date(r.decidedAt) : null,
        decidedBy: r.decidedAt ? "admin_test" : null,
      },
    })
  }
}

beforeAll(async () => {
  a = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
  b = (await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })).id
})
beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await reset()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await reset()
})

describe("admin.revenue — quyền và kiểm tra khoảng", () => {
  it("giáo viên → FORBIDDEN", async () => {
    const c = await getAuthedCaller("teacher_std")
    await expect(c.admin.revenue({ from: { year: 2025, month: 1 }, to: { year: 2025, month: 3 } })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
  it("khoảng ngược / quá 36 tháng → BAD_REQUEST", async () => {
    const c = await getAuthedCaller("admin_test")
    await expect(c.admin.revenue({ from: { year: 2025, month: 5 }, to: { year: 2025, month: 3 } })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(c.admin.revenue({ from: { year: 2025, month: 1 }, to: { year: 2028, month: 1 } })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("admin.revenue — số liệu (spec K C1–C5)", () => {
  it("chỉ cộng đơn user đã duyệt có tiền, theo tháng giờ VN; phân loại xét cả đơn trước khoảng", async () => {
    await seed([
      // 23:59 ngày 31/12/2024 giờ VN: ngoài khoảng, làm các đơn 2025 của A thành gia hạn.
      { userId: a, plan: "plus", period: "month", amount: 49000, status: "approved", decidedAt: "2024-12-31T16:59:00Z" },
      { userId: a, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: "2025-01-31T16:30:00Z" },
      { userId: a, plan: "pro", period: "year", amount: 990000, status: "approved", creditDays: 100, decidedAt: "2025-02-10T03:00:00Z" },
      { userId: a, plan: "pro", period: "2year", amount: 1980000, status: "approved", decidedAt: "2025-03-01T00:00:00Z" },
      // B: đơn admin tặng 0đ trước, không làm đơn có tiền đầu tiên thành gia hạn.
      { userId: b, plan: "pro", period: null, amount: 0, status: "approved", source: "admin", decidedAt: "2025-01-05T03:00:00Z" },
      // 00:10 ngày 1/2 giờ VN → tháng 2.
      { userId: b, plan: "plus", period: "month", amount: 49000, status: "approved", decidedAt: "2025-01-31T17:10:00Z" },
      { userId: b, plan: "pro", period: "month", amount: 99000, status: "rejected", decidedAt: "2025-02-11T03:00:00Z" },
      { userId: b, plan: "pro", period: "year", amount: 990000, status: "cancelled", decidedAt: null },
      { userId: b, plan: "pro", period: "year", amount: 990000, status: "pending", decidedAt: null },
    ])
    const r = await (await getAuthedCaller("admin_test")).admin.revenue({ from: { year: 2025, month: 1 }, to: { year: 2025, month: 3 } })

    expect(r.months.map((m) => [m.month, m.total.amount, m.total.count])).toEqual([
      [1, 490000, 1],
      [2, 1039000, 2],
      [3, 1980000, 1],
    ])
    expect(r.months[1].byKind).toEqual({ new: { amount: 49000, count: 1 }, renew: { amount: 0, count: 0 }, upgrade: { amount: 990000, count: 1 } })
    expect(r.summary.total).toEqual({ amount: 3509000, count: 4 })
    expect(r.summary.byKind).toEqual({ new: { amount: 49000, count: 1 }, renew: { amount: 2470000, count: 2 }, upgrade: { amount: 990000, count: 1 } })
    expect(r.summary.byPlan).toEqual({ plus: { amount: 539000, count: 2 }, pro: { amount: 2970000, count: 2 } })
    expect(r.summary.byPeriod).toEqual({ month: { amount: 49000, count: 1 }, year: { amount: 1480000, count: 2 }, "2year": { amount: 1980000, count: 1 } })
  })

  it("xóa mềm tài khoản có đơn đã duyệt → doanh thu KHÔNG đổi (spec K K16)", async () => {
    await seed([{ userId: a, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: "2025-05-10T03:00:00Z" }])
    const admin = await getAuthedCaller("admin_test")
    const range = { from: { year: 2025, month: 5 }, to: { year: 2025, month: 5 } }
    const before = await admin.admin.revenue(range)
    expect(before.summary.total).toEqual({ amount: 490000, count: 1 })
    await db.user.update({ where: { id: a }, data: { isDeleted: true } })
    try {
      expect(await admin.admin.revenue(range)).toEqual(before)
    } finally {
      await db.user.update({ where: { id: a }, data: { isDeleted: false } })
    }
  })

  it("khoảng không có đơn → mọi tháng 0đ, vẫn đủ dòng", async () => {
    const r = await (await getAuthedCaller("admin_test")).admin.revenue({ from: { year: 2025, month: 11 }, to: { year: 2026, month: 2 } })
    expect(r.months.map((m) => [m.year, m.month, m.total.amount])).toEqual([
      [2025, 11, 0],
      [2025, 12, 0],
      [2026, 1, 0],
      [2026, 2, 0],
    ])
    expect(r.summary.total).toEqual({ amount: 0, count: 0 })
  })
})
```
Nếu test "không có đơn" đỏ vì đơn của file test khác sót lại trong T11/2025–T2/2026 → đổi sang khoảng 2023, ghi Ruling.

Run: `pnpm test tests/integration/revenue.test.ts`
Expected: FAIL — `c.admin.revenue is not a function`.

- [ ] **Step 6: Service + router**

Tạo `src/server/services/revenue.service.ts`:
```ts
import { PERIODS } from "@/lib/plans"
import { buildRevenueReport, nextMonth, vnMonthStart, type RevenueReport } from "@/lib/revenue"
import type { RevenueQueryInput } from "@/lib/schemas/plan"
import type { Db } from "./plan.service"

// Lấy cả đơn trước khoảng lọc để phân loại mới/gia hạn (spec K C6); vài trăm đơn/năm nên gom trong JS.
export async function getRevenue(db: Db, input: RevenueQueryInput): Promise<RevenueReport> {
  const rows = await db.planOrder.findMany({
    where: {
      status: "approved",
      source: "user",
      amount: { gt: 0 },
      plan: { in: ["plus", "pro"] },
      period: { in: [...PERIODS] },
      // Không lọc tài khoản đã xóa mềm: tiền đã nhận, doanh thu quá khứ không đổi (spec K K16).
      decidedAt: { not: null, lt: vnMonthStart(nextMonth(input.to)) },
    },
    select: { id: true, userId: true, plan: true, period: true, amount: true, creditDays: true, decidedAt: true },
  })
  const orders = rows.flatMap((r) => (r.decidedAt ? [{ ...r, decidedAt: r.decidedAt }] : []))
  return buildRevenueReport(orders, input.from, input.to)
}
```

`src/server/trpc/routers/admin.ts` (đối chiếu sau P): thêm `revenueQuerySchema` vào import từ `@/lib/schemas/plan`, `import { getRevenue } from "@/server/services/revenue.service"`, và ngay sau `orderHistory`:
```ts
  revenue: adminProcedure.input(revenueQuerySchema).query(({ ctx, input }) => getRevenue(ctx.db, input)),
```

Run: `pnpm test tests/integration/revenue.test.ts` → Expected: PASS (5 test).
Run: `pnpm test tests/integration/admin.test.ts` → Expected: PASS.

- [ ] **Step 7: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit
pnpm lint
git add src/lib/revenue.ts src/lib/schemas/plan.ts src/server/services/revenue.service.ts src/server/trpc/routers/admin.ts tests/unit/lib/revenue.test.ts tests/unit/schemas/plan.schema.test.ts tests/integration/revenue.test.ts
git commit -m "feat(k): admin.revenue (đơn user đã duyệt có tiền, theo tháng ngày duyệt giờ VN, mới/gia hạn/nâng cấp, gói, kỳ)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Tổng quan phía server (thẻ số, xu hướng tài khoản, đếm tài khoản mới, `admin.stats`, `admin.accountTrend`)

**Đọc trước:** Global Constraints; spec mục 4 nhóm A, R1 và T, 7.4, 7.5, 7.7, 7.8, 10 (admin-stats); `src/lib/activity.ts` (Task 1); `src/lib/admin.ts`; `src/lib/plans.ts` (`isPaidPlan`, `effectivePlan`); `src/server/services/plan-admin.service.ts` (`getAdminOverview`) và **`getPendingCount(db)` của P** (vị trí thật: grep `getPendingCount`); field xóa mềm của Q và cột SQL tương ứng (grep `@map("is_deleted")` hoặc tên thật); `src/server/trpc/routers/admin.ts`.

**Files:**
- Modify: `src/lib/admin.ts` (thêm `adminUsernames`)
- Create: `src/lib/admin-stats.ts`, `src/server/services/new-accounts.service.ts`, `src/server/services/admin-stats.service.ts`
- Modify: `src/lib/schemas/plan.ts` (thêm `accountTrendSchema`), `src/server/trpc/routers/admin.ts`
- Test (Mới): `tests/unit/lib/admin-stats.test.ts`, `tests/integration/admin-stats.test.ts`
- Test (Sửa): `tests/unit/schemas/plan.schema.test.ts`, `tests/unit/lib/admin.test.ts`

**Interfaces:**
- Consumes: `vnDayKey` (`@/lib/activity`), `isPaidPlan` (`@/lib/plans`), `vnDateParts` (`@/lib/utils`), `db.userActivityDay` (Task 1).
- Produces:
  - `src/lib/admin.ts`: `adminUsernames(): string[]` (`isAdminUsername` dùng lại hàm này).
  - `src/lib/admin-stats.ts`: `EXPIRING_DAYS = 30`, `STILL_ACTIVE_DAYS = 30`, `TREND_RANGES = [7, 14, 30] as const`, `type TrendRange = 7 | 14 | 30`, `type StatUser = { isActive: boolean; plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null; lastActiveAt: Date | null }`, `type AccountCards = { totalAccounts: number; activeAccounts: number; active24h: number; paying: { plus: number; pro: number }; trial: number; expiringSoon: { paid: number; trial: number }; standardAfterTrial: number }`, `computeAccountCards(users: StatUser[], now: Date): AccountCards`, `type DayCount = { day: string; count: number }`, `type TrendDay = { day: string; newAccounts: number; returning: number; isToday: boolean }`, `type AccountTrend = { days: TrendDay[]; totals: { newAccounts: number; avgPerDay: number; returning: number; busiestDay: DayCount | null }; trackingSince: string | null }`, `lastNDays(now: Date, n: number): string[]`, `buildAccountTrend(days: string[], newRows: DayCount[], returningRows: DayCount[], trackingSince: string | null): AccountTrend`.
  - `src/server/services/admin-stats.service.ts`: `type AdminStats = AccountCards & { active7d: number; pendingOrders: number; newAccounts: number; updatedAt: Date }`, `getAdminStats(db: PrismaClient, now?: Date): Promise<AdminStats>`, `getAccountTrend(db: PrismaClient, days: TrendRange, now?: Date): Promise<AccountTrend>`.
  - `src/server/services/new-accounts.service.ts` (MỚI): `newAccountsWhere(): Prisma.UserWhereInput` (R1: `adminSeenAt: null`, không admin, chưa xóa mềm), `countNewAccounts(db: Db): Promise<number>`.
  - Schema: `accountTrendSchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]) })`.
  - tRPC: `admin.stats` (output `AdminStats`, `updatedAt` về client là chuỗi ISO), `admin.accountTrend({ days })` (output `AccountTrend`).

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Unit test (RED)**

`tests/unit/lib/admin.test.ts`: thêm (import `adminUsernames`):
```ts
describe("adminUsernames", () => {
  it("tách, bỏ khoảng trắng và phần tử rỗng; không có env → []", () => {
    process.env.ADMIN_USERNAMES = " a , b,,"
    expect(adminUsernames()).toEqual(["a", "b"])
    delete process.env.ADMIN_USERNAMES
    expect(adminUsernames()).toEqual([])
  })
})
```

Tạo `tests/unit/lib/admin-stats.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { buildAccountTrend, computeAccountCards, lastNDays, type StatUser } from "@/lib/admin-stats"

const NOW = new Date("2026-11-15T05:00:00Z") // 12:00 VN 15/11/2026
const DAY = 24 * 60 * 60 * 1000
const at = (days: number) => new Date(NOW.getTime() + days * DAY)
const user = (p: Partial<StatUser> = {}): StatUser => ({
  isActive: true, plan: "standard", planExpiresAt: null, trialEndsAt: null, lastActiveAt: null, ...p,
})

describe("computeAccountCards (spec K A1–A10)", () => {
  it("tổng gồm cả tài khoản khóa; thẻ gói bỏ tài khoản khóa", () => {
    const c = computeAccountCards(
      [user(), user({ isActive: false, plan: "pro", planExpiresAt: at(100) }), user({ isActive: false, trialEndsAt: at(5) })],
      NOW
    )
    expect(c.totalAccounts).toBe(3)
    expect(c.activeAccounts).toBe(1)
    expect(c.paying).toEqual({ plus: 0, pro: 0 })
    expect(c.trial).toBe(0)
  })

  it("trả phí còn hạn tách Plus/Pro, tính cả khi đang dùng thử song song; hết hạn không tính", () => {
    const c = computeAccountCards(
      [
        user({ plan: "plus", planExpiresAt: at(100), trialEndsAt: at(10) }),
        user({ plan: "pro", planExpiresAt: at(200) }),
        user({ plan: "pro", planExpiresAt: at(-1) }),
      ],
      NOW
    )
    expect(c.paying).toEqual({ plus: 1, pro: 1 })
    expect(c.trial).toBe(0)
  })

  it("dùng thử còn hạn không có gói trả phí → Đang dùng thử", () => {
    expect(computeAccountCards([user({ trialEndsAt: at(20) }), user({ trialEndsAt: at(-1) })], NOW).trial).toBe(1)
  })

  it("sắp hết hạn: biên đúng 30 ngày tính, 30 ngày + 1 phút không; Plus + dùng thử sắp hết không tính dùng thử", () => {
    const c = computeAccountCards(
      [
        user({ plan: "plus", planExpiresAt: at(30) }),
        user({ plan: "pro", planExpiresAt: new Date(at(30).getTime() + 60_000) }),
        user({ trialEndsAt: at(3) }),
        user({ plan: "plus", planExpiresAt: at(300), trialEndsAt: at(3) }),
      ],
      NOW
    )
    expect(c.expiringSoon).toEqual({ paid: 1, trial: 1 })
  })

  it("Standard sau dùng thử: hết dùng thử, không trả phí, dùng app trong 30 ngày; trialEndsAt null không tính", () => {
    const c = computeAccountCards(
      [
        user({ trialEndsAt: at(-10), lastActiveAt: at(-30) }),
        user({ trialEndsAt: at(-10), lastActiveAt: new Date(at(-30).getTime() - 60_000) }),
        user({ trialEndsAt: at(-10), lastActiveAt: at(-1), plan: "plus", planExpiresAt: at(-2) }),
        user({ trialEndsAt: null, lastActiveAt: at(-1) }),
        user({ trialEndsAt: at(-10), lastActiveAt: at(-1), plan: "plus", planExpiresAt: at(50) }),
        user({ trialEndsAt: at(-10), lastActiveAt: at(-1), isActive: false }),
      ],
      NOW
    )
    expect(c.standardAfterTrial).toBe(2)
  })

  it("Active 24h theo lastActiveAt, biên đúng 24 giờ", () => {
    const c = computeAccountCards(
      [user({ lastActiveAt: at(-1) }), user({ lastActiveAt: new Date(at(-1).getTime() - 60_000) }), user({ lastActiveAt: null })],
      NOW
    )
    expect(c.active24h).toBe(1)
  })
})

describe("lastNDays", () => {
  it("cũ → mới, phần tử cuối là hôm nay giờ VN, qua tháng/năm", () => {
    expect(lastNDays(new Date("2026-11-30T17:30:00Z"), 3)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"])
    expect(lastNDays(new Date("2027-01-01T01:00:00Z"), 2)).toEqual(["2026-12-31", "2027-01-01"])
    expect(lastNDays(NOW, 30)).toHaveLength(30)
  })
})

describe("buildAccountTrend (spec K T1–T5)", () => {
  const days = ["2026-11-13", "2026-11-14", "2026-11-15"]
  it("điền 0, cột cuối isToday, tổng, trung bình 1 chữ số, ngày đông nhất hòa lấy ngày gần hơn", () => {
    const t = buildAccountTrend(
      days,
      [{ day: "2026-11-13", count: 2 }, { day: "2026-11-15", count: 2 }],
      [{ day: "2026-11-14", count: 5 }],
      "2026-11-01"
    )
    expect(t.days).toEqual([
      { day: "2026-11-13", newAccounts: 2, returning: 0, isToday: false },
      { day: "2026-11-14", newAccounts: 0, returning: 5, isToday: false },
      { day: "2026-11-15", newAccounts: 2, returning: 0, isToday: true },
    ])
    expect(t.totals).toEqual({ newAccounts: 4, avgPerDay: 1.3, returning: 5, busiestDay: { day: "2026-11-15", count: 2 } })
    expect(t.trackingSince).toBe("2026-11-01")
  })
  it("không có tài khoản mới → busiestDay null, trung bình 0", () => {
    const t = buildAccountTrend(days, [], [], null)
    expect(t.totals).toEqual({ newAccounts: 0, avgPerDay: 0, returning: 0, busiestDay: null })
    expect(t.trackingSince).toBeNull()
  })
})
```

`tests/unit/schemas/plan.schema.test.ts`: thêm `accountTrendSchema` vào import, thêm:
```ts
describe("accountTrendSchema (spec K T1)", () => {
  it("chỉ nhận 7, 14, 30", () => {
    for (const days of [7, 14, 30]) expect(accountTrendSchema.safeParse({ days }).success).toBe(true)
    for (const days of [0, 1, 15, 31, "7"]) expect(accountTrendSchema.safeParse({ days }).success).toBe(false)
  })
})
```

Run: `pnpm test tests/unit/lib/admin-stats.test.ts` → Expected: FAIL (không resolve `@/lib/admin-stats`).
Run: `pnpm test tests/unit/lib/admin.test.ts` → Expected: FAIL (`adminUsernames` không có).
Run: `pnpm test tests/unit/schemas/plan.schema.test.ts` → Expected: FAIL (`accountTrendSchema` undefined).

- [ ] **Step 3: `adminUsernames`, `src/lib/admin-stats.ts`, schema**

`src/lib/admin.ts`:
```ts
// Thuần, không kéo Prisma: middleware Edge (auth.config.ts) và layout server cùng dùng.
export function adminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAdminUsername(username?: string | null): boolean {
  if (!username) return false
  return adminUsernames().includes(username)
}
```
(giữ nguyên dòng ghi chú đầu file có sẵn, chỉ tách hàm.)

Tạo `src/lib/admin-stats.ts`:
```ts
// Thuần: số liệu màn Tổng quan admin (spec K nhóm A, T). users truyền vào đã loại admin.
import { vnDayKey } from "@/lib/activity"
import { isPaidPlan } from "@/lib/plans"

export const EXPIRING_DAYS = 30
// "Còn hoạt động" cho thẻ Standard sau dùng thử: khớp phiên ghi nhớ 30 ngày (spec K A7).
export const STILL_ACTIVE_DAYS = 30
export const TREND_RANGES = [7, 14, 30] as const
export type TrendRange = (typeof TREND_RANGES)[number]

export type StatUser = { isActive: boolean; plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null; lastActiveAt: Date | null }
export type AccountCards = {
  totalAccounts: number
  activeAccounts: number
  active24h: number
  paying: { plus: number; pro: number }
  trial: number
  expiringSoon: { paid: number; trial: number }
  standardAfterTrial: number
}
export type DayCount = { day: string; count: number }
export type TrendDay = { day: string; newAccounts: number; returning: number; isToday: boolean }
export type AccountTrend = {
  days: TrendDay[]
  totals: { newAccounts: number; avgPerDay: number; returning: number; busiestDay: DayCount | null }
  trackingSince: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export function computeAccountCards(users: StatUser[], now: Date): AccountCards {
  const c: AccountCards = {
    totalAccounts: users.length,
    activeAccounts: 0,
    active24h: 0,
    paying: { plus: 0, pro: 0 },
    trial: 0,
    expiringSoon: { paid: 0, trial: 0 },
    standardAfterTrial: 0,
  }
  const t = now.getTime()
  const soon = t + EXPIRING_DAYS * DAY_MS
  for (const u of users) {
    if (u.lastActiveAt && u.lastActiveAt.getTime() >= t - DAY_MS) c.active24h++
    // Tài khoản khóa không dùng được app: không tính vào các thẻ gói (spec K A3).
    if (!u.isActive) continue
    c.activeAccounts++
    const plan = u.plan
    if (isPaidPlan(plan) && u.planExpiresAt && u.planExpiresAt.getTime() > t) {
      c.paying[plan]++
      if (u.planExpiresAt.getTime() <= soon) c.expiringSoon.paid++
      continue
    }
    if (u.trialEndsAt && u.trialEndsAt.getTime() > t) {
      c.trial++
      if (u.trialEndsAt.getTime() <= soon) c.expiringSoon.trial++
      continue
    }
    if (u.trialEndsAt && u.lastActiveAt && u.lastActiveAt.getTime() >= t - STILL_ACTIVE_DAYS * DAY_MS) c.standardAfterTrial++
  }
  return c
}

export function lastNDays(now: Date, n: number): string[] {
  const [y, m, d] = vnDayKey(now).split("-").map(Number)
  const base = Date.UTC(y, m - 1, d)
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10))
}

export function buildAccountTrend(days: string[], newRows: DayCount[], returningRows: DayCount[], trackingSince: string | null): AccountTrend {
  const fresh = new Map(newRows.map((r) => [r.day, r.count]))
  const back = new Map(returningRows.map((r) => [r.day, r.count]))
  const out = days.map((day, i) => ({ day, newAccounts: fresh.get(day) ?? 0, returning: back.get(day) ?? 0, isToday: i === days.length - 1 }))
  let busiestDay: DayCount | null = null
  // Duyệt cũ → mới với >=: hòa thì lấy ngày gần hơn (spec K T4).
  for (const d of out) if (d.newAccounts > 0 && (!busiestDay || d.newAccounts >= busiestDay.count)) busiestDay = { day: d.day, count: d.newAccounts }
  const newAccounts = out.reduce((s, d) => s + d.newAccounts, 0)
  return {
    days: out,
    totals: {
      newAccounts,
      avgPerDay: days.length ? Math.round((newAccounts / days.length) * 10) / 10 : 0,
      returning: out.reduce((s, d) => s + d.returning, 0),
      busiestDay,
    },
    trackingSince,
  }
}
```

`src/lib/schemas/plan.ts` cuối file:
```ts
export const accountTrendSchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]) })
```

Run 3 lệnh test ở Step 2 → Expected: PASS hết.

- [ ] **Step 4: Integration test (RED)**

Tạo `tests/integration/admin-stats.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDayDate, vnDayKey } from "@/lib/activity"

const FAKE = "stat_fake_"
const DAY = 24 * 60 * 60 * 1000
let hash = ""

async function cleanup() {
  // user_activity_days xóa theo CASCADE.
  await db.user.deleteMany({ where: { username: { startsWith: FAKE } } })
}
async function fake(name: string, data: Record<string, unknown> = {}) {
  hash ||= await bcrypt.hash("x", 4)
  return db.user.create({ data: { username: FAKE + name, passwordHash: hash, ...data } })
}

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = `admin_test,${FAKE}admin`
  await cleanup()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await cleanup()
})

describe("admin.stats / admin.accountTrend — quyền", () => {
  it("giáo viên → FORBIDDEN", async () => {
    const c = await getAuthedCaller("teacher_std")
    await expect(c.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(c.admin.accountTrend({ days: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

describe("admin.stats — chênh lệch trước/sau khi thêm user giả (spec K nhóm A)", () => {
  it("mỗi thẻ tăng đúng theo trạng thái user giả; admin không tính", async () => {
    const admin = await getAuthedCaller("admin_test")
    const before = await admin.admin.stats()
    const now = Date.now()
    await fake("plus", { plan: "plus", planExpiresAt: new Date(now + 10 * DAY), lastActiveAt: new Date(now - 60_000) })
    await fake("pro", { plan: "pro", planExpiresAt: new Date(now + 200 * DAY) })
    await fake("trial", { trialEndsAt: new Date(now + 5 * DAY) })
    await fake("std", { trialEndsAt: new Date(now - 5 * DAY), lastActiveAt: new Date(now - 3 * DAY) })
    await fake("locked", { isActive: false, plan: "pro", planExpiresAt: new Date(now + 100 * DAY) })
    // Đã xóa mềm (Q): không vào bất kỳ thẻ nào, kể cả hoạt động.
    const gone = await fake("deleted", { isDeleted: true, plan: "pro", planExpiresAt: new Date(now + 5 * DAY), lastActiveAt: new Date(now) })
    await db.userActivityDay.create({ data: { userId: gone.id, day: vnDayDate(new Date()), firstSeenAt: new Date() } })
    const adm = await fake("admin", { plan: "pro", planExpiresAt: new Date(now + 100 * DAY), lastActiveAt: new Date(now) })
    await db.userActivityDay.create({ data: { userId: adm.id, day: vnDayDate(new Date()), firstSeenAt: new Date() } })
    const std = await db.user.findUniqueOrThrow({ where: { username: FAKE + "std" } })
    await db.userActivityDay.create({ data: { userId: std.id, day: vnDayDate(new Date(now - 3 * DAY)), firstSeenAt: new Date(now - 3 * DAY) } })

    const after = await admin.admin.stats()
    expect(after.totalAccounts - before.totalAccounts).toBe(5)
    expect(after.activeAccounts - before.activeAccounts).toBe(4)
    expect(after.paying.plus - before.paying.plus).toBe(1)
    expect(after.paying.pro - before.paying.pro).toBe(1)
    expect(after.trial - before.trial).toBe(1)
    expect(after.expiringSoon.paid - before.expiringSoon.paid).toBe(1)
    expect(after.expiringSoon.trial - before.expiringSoon.trial).toBe(1)
    expect(after.standardAfterTrial - before.standardAfterTrial).toBe(1)
    expect(after.active24h - before.active24h).toBe(1)
    expect(after.active7d - before.active7d).toBe(1)
    // User giả mới tạo có adminSeenAt null: plus, pro, trial, std, locked → +5; deleted và admin không tính (R1).
    expect(after.newAccounts - before.newAccounts).toBe(5)
    expect(typeof after.updatedAt === "string" || after.updatedAt instanceof Date).toBe(true)
  })

  it("Chờ duyệt đếm đơn đang chờ", async () => {
    const admin = await getAuthedCaller("admin_test")
    const before = await admin.admin.stats()
    const u = await fake("buyer")
    await db.planOrder.create({ data: { userId: u.id, plan: "plus", period: "month", amount: 49000, code: "SFK00001", status: "pending" } })
    const after = await admin.admin.stats()
    expect(after.pendingOrders - before.pendingOrders).toBe(1)
    await db.planOrder.deleteMany({ where: { userId: u.id } })
  })
})

describe("admin.accountTrend (spec K nhóm T)", () => {
  it("mới theo ngày tạo VN; quay lại = hoạt động ngày khác ngày tạo; đăng ký hôm nay + dùng hôm nay chỉ là mới; admin không tính", async () => {
    const admin = await getAuthedCaller("admin_test")
    const now = new Date()
    const yesterday = new Date(now.getTime() - DAY)
    const today = vnDayKey(now)
    const yKey = vnDayKey(yesterday)
    const before = await admin.admin.accountTrend({ days: 7 })
    const pick = (t: typeof before, day: string) => t.days.find((d) => d.day === day)!

    const old = await fake("old", { createdAt: new Date(now.getTime() - 20 * DAY) })
    await db.userActivityDay.createMany({
      data: [
        { userId: old.id, day: vnDayDate(yesterday), firstSeenAt: yesterday },
        { userId: old.id, day: vnDayDate(now), firstSeenAt: now },
      ],
    })
    const fresh = await fake("fresh")
    await db.userActivityDay.create({ data: { userId: fresh.id, day: vnDayDate(now), firstSeenAt: now } })
    const adm = await fake("admin", { createdAt: new Date(now.getTime() - 20 * DAY) })
    await db.userActivityDay.create({ data: { userId: adm.id, day: vnDayDate(now), firstSeenAt: now } })
    // Đã xóa mềm: không tính mới, không tính quay lại.
    const gone = await fake("deleted2", { isDeleted: true, createdAt: new Date(now.getTime() - 20 * DAY) })
    await db.userActivityDay.create({ data: { userId: gone.id, day: vnDayDate(now), firstSeenAt: now } })
    await fake("deleted3", { isDeleted: true })

    const after = await admin.admin.accountTrend({ days: 7 })
    expect(after.days).toHaveLength(7)
    expect(after.days[6]).toMatchObject({ day: today, isToday: true })
    expect(pick(after, today).newAccounts - pick(before, today).newAccounts).toBe(1)
    expect(pick(after, today).returning - pick(before, today).returning).toBe(1)
    expect(pick(after, yKey).returning - pick(before, yKey).returning).toBe(1)
    expect(after.trackingSince! <= yKey).toBe(true)
    expect((await admin.admin.accountTrend({ days: 30 })).days).toHaveLength(30)
  })
})
```
Lưu ý: nếu cột `code` của đơn cần 8 ký tự theo luật riêng / đụng unique với đơn khác → đổi mã, ghi Ruling. Nếu sau P "đơn chờ" loại đơn quá 7 ngày thì đơn vừa tạo vẫn được đếm (mới tạo).

Run: `pnpm test tests/integration/admin-stats.test.ts`
Expected: FAIL — `c.admin.stats is not a function`.

- [ ] **Step 5: Service + router**

Tạo `src/server/services/new-accounts.service.ts` (file riêng để `plan-admin.service.ts` — nơi có `getPendingCount` của P — và `admin-stats.service.ts` cùng import mà không vòng; Task 5 thêm phần còn lại vào đây):
```ts
import type { Prisma } from "@prisma/client"
import { adminUsernames } from "@/lib/admin"
import type { Db } from "./plan.service"

// Tài khoản mới admin chưa xem (spec K R1): không admin, chưa xóa mềm (Q).
export function newAccountsWhere(): Prisma.UserWhereInput {
  return { adminSeenAt: null, isDeleted: false, username: { notIn: adminUsernames() } }
}

export function countNewAccounts(db: Db): Promise<number> {
  return db.user.count({ where: newAccountsWhere() })
}
```

Tạo `src/server/services/admin-stats.service.ts`:
```ts
import type { PrismaClient } from "@prisma/client"
import { adminUsernames } from "@/lib/admin"
import { buildAccountTrend, computeAccountCards, lastNDays, type AccountCards, type AccountTrend, type DayCount, type TrendRange } from "@/lib/admin-stats"
import { getPendingCount } from "./plan-admin.service" // vị trí thật của getPendingCount theo P
import { countNewAccounts } from "./new-accounts.service"

export type AdminStats = AccountCards & { active7d: number; pendingOrders: number; newAccounts: number; updatedAt: Date }

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
// Mốc 00:00 giờ VN của ngày "YYYY-MM-DD", dạng chuỗi để ::timestamp không phụ thuộc TimeZone phiên Postgres.
const vnDayStartIso = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - VN_OFFSET_MS).toISOString()

export async function getAdminStats(db: PrismaClient, now = new Date()): Promise<AdminStats> {
  const admins = adminUsernames()
  const start7 = lastNDays(now, 7)[0]
  const [users, active7, pending, newAccounts] = await Promise.all([
    db.user.findMany({
      where: { isDeleted: false },
      select: { username: true, isActive: true, plan: true, planExpiresAt: true, trialEndsAt: true, lastActiveAt: true },
    }),
    db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT a.user_id)::int AS count
      FROM user_activity_days a JOIN users u ON u.id = a.user_id
      WHERE a.day >= ${start7}::date AND u.is_deleted = false AND NOT (u.username = ANY(${admins}::text[]))`,
    // Cùng hàm với badge số đơn chờ ở sidebar/tab bar (spec K A9).
    getPendingCount(db),
    countNewAccounts(db),
  ])
  const cards = computeAccountCards(users.filter((u) => !admins.includes(u.username)), now)
  return { ...cards, active7d: active7[0]?.count ?? 0, pendingOrders: pending.count, newAccounts, updatedAt: now }
}

export async function getAccountTrend(db: PrismaClient, days: TrendRange, now = new Date()): Promise<AccountTrend> {
  const admins = adminUsernames()
  const list = lastNDays(now, days)
  const [newRows, returningRows, since] = await Promise.all([
    db.$queryRaw<DayCount[]>`
      SELECT to_char((u.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM users u
      WHERE u.created_at >= ${vnDayStartIso(list[0])}::timestamp AND u.is_deleted = false AND NOT (u.username = ANY(${admins}::text[]))
      GROUP BY 1`,
    // Ngày đăng ký tính là "mới", không tính "quay lại" (spec K T3).
    db.$queryRaw<DayCount[]>`
      SELECT to_char(a.day, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM user_activity_days a JOIN users u ON u.id = a.user_id
      WHERE a.day >= ${list[0]}::date
        AND u.is_deleted = false
        AND NOT (u.username = ANY(${admins}::text[]))
        AND a.day <> ((u.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      GROUP BY 1`,
    db.$queryRaw<{ since: string | null }[]>`SELECT to_char(MIN(day), 'YYYY-MM-DD') AS since FROM user_activity_days`,
  ])
  return buildAccountTrend(list, newRows, returningRows, since[0]?.since ?? null)
}
```
Đối chiếu sau P/Q: `getPendingCount` import từ đúng file của P (P mô tả `getPendingCount(db)` trả `{ count }`, có expire đơn quá 7 ngày; nếu nó nhận `PrismaClient` mà `db` ở đây cũng là `PrismaClient` thì khớp). Không có `getPendingCount` → `db.planOrder.count({ where: { status: "pending" } })`, ghi Ruling. Tên field/cột xóa mềm (`isDeleted` / `is_deleted`) theo Q; Q có helper lọc thì dùng helper, ghi Ruling.
`src/server/trpc/routers/admin.ts`: import `accountTrendSchema` (từ `@/lib/schemas/plan`) và `getAccountTrend`, `getAdminStats` (từ `@/server/services/admin-stats.service`); thêm ngay trước `revenue`:
```ts
  stats: adminProcedure.query(({ ctx }) => getAdminStats(ctx.db)),
  accountTrend: adminProcedure.input(accountTrendSchema).query(({ ctx, input }) => getAccountTrend(ctx.db, input.days)),
```

Run: `pnpm test tests/integration/admin-stats.test.ts` → Expected: PASS (4 test).
Run: `pnpm test tests/integration/admin.test.ts` → Expected: PASS.

- [ ] **Step 6: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit
pnpm lint
git add src/lib/admin.ts src/lib/admin-stats.ts src/lib/schemas/plan.ts src/server/services/new-accounts.service.ts src/server/services/admin-stats.service.ts src/server/trpc/routers/admin.ts tests/unit/lib/admin.test.ts tests/unit/lib/admin-stats.test.ts tests/unit/schemas/plan.schema.test.ts tests/integration/admin-stats.test.ts
git commit -m "feat(k): admin.stats (9 thẻ số + số tài khoản mới, bỏ admin và tài khoản đã xóa mềm) và admin.accountTrend (mới/quay lại theo ngày VN, 7/14/30 ngày)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: Trang chủ admin `/admin/overview` (ADMIN_HOME, nav, BarChart chung, thẻ số, xu hướng) + e2e

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" mục 2–4; spec mục 4 nhóm A (A13, A14), T (T4–T6), N, 8.1, 8.2, 8.4, 10 (UI + e2e Tổng quan); `src/components/admin/admin-nav.ts`, `AdminTabBar.tsx`, `AdminSidebar.tsx` (**đối chiếu sau P**, không đụng phần badge); `src/components/admin/admin-format.ts`; `src/components/admin/AdminOrderHistory.tsx`; `src/components/common/PageHeader.tsx`; `src/components/ui/skeleton.tsx`; 5 file chuyển hướng: `src/app/(admin)/admin/page.tsx`, `src/app/(app)/layout.tsx` (dòng `redirect("/admin/orders")`), `src/app/login/page.tsx`, `src/server/auth.config.ts` (dòng `Response.redirect(new URL("/admin/orders", …))`), `src/components/layout/AppHeader.tsx` (`<Link href="/admin/orders">`); test: `tests/unit/auth-authorized.test.ts`, `tests/unit/layout/admin-redirect.test.ts`, `tests/unit/components/AppHeader.test.tsx`, `tests/unit/components/AdminNav.test.tsx`, `tests/unit/components/AdminPrices.test.tsx` dòng 1–50 (cách mock `@/lib/trpc`), `tests/e2e/admin-prices.spec.ts` dòng 1–60 (`loginAs`).

**Files:**
- Modify: `src/lib/admin.ts` (`ADMIN_HOME`), 5 file chuyển hướng ở trên
- Modify: `src/components/admin/admin-nav.ts`, `AdminTabBar.tsx`, `admin-format.ts`
- Create: `src/components/admin/BarChart.tsx`, `AdminOverview.tsx`, `AccountTrend.tsx`, `src/app/(admin)/admin/overview/page.tsx`
- Modify: `src/language/vi.json`, `en.json`
- Test (Mới): `tests/unit/components/BarChart.test.tsx`, `AdminOverview.test.tsx`, `AccountTrend.test.tsx`, `tests/e2e/admin-overview.spec.ts`
- Test (Sửa): `tests/unit/components/AdminNav.test.tsx`, `tests/unit/auth-authorized.test.ts`, `tests/unit/layout/admin-redirect.test.ts`, `tests/unit/components/AppHeader.test.tsx`, mọi `tests/e2e/admin*.spec.ts` có sẵn

**Interfaces:**
- Consumes: `trpc.admin.stats.useQuery()`, `trpc.admin.accountTrend.useQuery({ days })` (Task 3); `TREND_RANGES`, `type TrendRange`, `buildAccountTrend` (test) (`@/lib/admin-stats`); `formatVnDate` (`@/lib/payment-notes`), `formatTime` (`@/lib/utils`).
- Produces:
  - `src/lib/admin.ts`: `export const ADMIN_HOME = "/admin/overview"`.
  - `src/components/admin/BarChart.tsx`: `type BarSegment = { key: string; value: number; className: string }`, `type ChartBar = { key: string; label: string; ariaLabel: string; segments: BarSegment[]; faded?: boolean }`, `type ChartLegend = { key: string; label: string; className: string }`, `BarChart(props: { bars: ChartBar[]; layout: "stacked" | "grouped"; legend: ChartLegend[]; formatMax: (n: number) => string; emptyText: string; testId: string })`. Cột `data-testid="chart-bar"`, `data-key`, `data-faded="true"` khi mờ; đoạn `data-seg`.
  - `admin-format.ts`: `shortDateTimeVn(iso: string): string` (`"dd/mm HH:mm"` giờ VN).
  - `AdminOverview()`, `AccountTrend()`; test id `overview-cards`, `card-{total|active|pending|active24h|active7d|paying|trial|expiring|std-after-trial}`, `account-trend`, `trend-{new|avg|returning|busiest}`, `trend-chart`.
  - Key i18n nhóm Tổng quan (Step 4) + `admin_chart_empty`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Sửa test chuyển hướng + nav, viết test component (RED)**

Chuyển hướng (đối chiếu từng file, chỉ đổi đích):
- `tests/unit/auth-authorized.test.ts`: `"http://localhost:3000/admin/orders"` → `"http://localhost:3000/admin/overview"` (tên test "302 về /admin/orders" → "/admin/overview"); danh sách path admin được vào (`["/admin", "/admin/orders", …]`) thêm `"/admin/overview"`.
- `tests/unit/layout/admin-redirect.test.ts`: `"REDIRECT /admin/orders"` → `"REDIRECT /admin/overview"` (2 chỗ, cả tên test).
- `tests/unit/components/AppHeader.test.tsx`: link menu "Quản trị" `"/admin/orders"` → `"/admin/overview"`.

`tests/unit/components/AdminNav.test.tsx`: mảng href sidebar thêm `"/admin/overview"` **đầu** mảng; mảng tab bar thêm `["/admin/overview", "Tổng quan"]` đầu mảng (nếu sau P `textContent` có số đơn chờ thì giữ kiểu P đang kiểm, ghi Ruling); `grid-cols-4` → `grid-cols-5`; "4 mục" → "5 mục".

Tạo `tests/unit/components/BarChart.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BarChart, type ChartBar } from "@/components/admin/BarChart"

const bar = (key: string, values: Record<string, number>, faded = false): ChartBar => ({
  key,
  label: key,
  ariaLabel: `${key}: ${Object.values(values).join("+")}`,
  faded,
  segments: Object.entries(values).map(([k, v]) => ({ key: k, value: v, className: `bg-${k}` })),
})
const LEGEND = [{ key: "a", label: "A", className: "bg-primary" }]
const seg = (i: number, key: string) =>
  screen.getAllByTestId("chart-bar")[i].querySelector<HTMLElement>(`[data-seg="${key}"]`)?.style.height

describe("BarChart (spec K 8.4)", () => {
  it("stacked: max theo tổng cột; đoạn 0 không vẽ", () => {
    render(<BarChart testId="c" layout="stacked" legend={LEGEND} formatMax={String} emptyText="trống" bars={[bar("m1", { a: 60, b: 40 }), bar("m2", { a: 50, b: 0 })]} />)
    expect(seg(0, "a")).toBe("60%")
    expect(seg(0, "b")).toBe("40%")
    expect(seg(1, "a")).toBe("50%")
    expect(seg(1, "b")).toBeUndefined()
    expect(screen.getByText("100")).toBeTruthy()
  })
  it("grouped: max theo giá trị lớn nhất; cột mờ có data-faded", () => {
    render(<BarChart testId="c" layout="grouped" legend={LEGEND} formatMax={String} emptyText="trống" bars={[bar("d1", { a: 4, b: 2 }), bar("d2", { a: 1, b: 0 }, true)]} />)
    expect(seg(0, "a")).toBe("100%")
    expect(seg(0, "b")).toBe("50%")
    expect(seg(1, "a")).toBe("25%")
    const bars = screen.getAllByTestId("chart-bar")
    expect(bars[1].getAttribute("data-faded")).toBe("true")
    expect(bars[0].getAttribute("data-faded")).toBeNull()
    expect(screen.getByRole("img", { name: "d1: 4+2" })).toBeTruthy()
  })
  it("tất cả 0 → emptyText, không cột", () => {
    render(<BarChart testId="c" layout="grouped" legend={LEGEND} formatMax={String} emptyText="trống" bars={[bar("d1", { a: 0 })]} />)
    expect(screen.getByText("trống")).toBeTruthy()
    expect(screen.queryAllByTestId("chart-bar")).toHaveLength(0)
  })
})
```

Tạo `tests/unit/components/AccountTrend.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AccountTrend } from "@/components/admin/AccountTrend"
import { buildAccountTrend } from "@/lib/admin-stats"

const h = vi.hoisted(() => ({ inputs: [] as { days: number }[], data: undefined as unknown }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      accountTrend: {
        useQuery: (input: { days: number }) => {
          h.inputs.push(input)
          return { data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }
        },
      },
    },
  },
}))

const DAYS = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]
const TREND = buildAccountTrend(
  DAYS,
  [{ day: "2026-11-10", count: 3 }, { day: "2026-11-15", count: 1 }],
  [{ day: "2026-11-14", count: 5 }, { day: "2026-11-15", count: 2 }],
  "2026-11-12"
)
function renderTrend() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AccountTrend />
    </LanguageProvider>
  )
}

beforeEach(() => {
  h.inputs = []
  h.data = undefined
})

describe("AccountTrend (spec K T1–T6)", () => {
  it("mặc định 7 ngày; bấm 14 ngày / 30 ngày đổi input", () => {
    renderTrend()
    expect(h.inputs.at(-1)).toEqual({ days: 7 })
    expect(screen.getByRole("radio", { name: "7 ngày" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(screen.getByRole("radio", { name: "14 ngày" }))
    expect(h.inputs.at(-1)).toEqual({ days: 14 })
    fireEvent.click(screen.getByRole("radio", { name: "30 ngày" }))
    expect(h.inputs.at(-1)).toEqual({ days: 30 })
    expect(screen.getByRole("radio", { name: "30 ngày" }).className).toContain("h-11")
  })
  it("4 thẻ phụ, 7 cột, cột cuối mờ, nhãn cột, chú thích mốc ghi", () => {
    h.data = TREND
    renderTrend()
    expect(screen.getByTestId("trend-new").textContent).toContain("4")
    expect(screen.getByTestId("trend-avg").textContent).toContain("0,6")
    expect(screen.getByTestId("trend-returning").textContent).toContain("7")
    expect(screen.getByTestId("trend-busiest").textContent).toContain("10/11 · 3 tài khoản")
    const bars = screen.getAllByTestId("chart-bar")
    expect(bars).toHaveLength(7)
    expect(bars[6].getAttribute("data-faded")).toBe("true")
    expect(screen.getByRole("img", { name: "14/11: 0 tài khoản mới, 5 quay lại" })).toBeTruthy()
    expect(screen.getByText("Lượt quay lại được ghi từ 12/11/2026")).toBeTruthy()
    expect(screen.getByText("Hôm nay (chưa hết ngày)")).toBeTruthy()
  })
})
```

Tạo `tests/unit/components/AdminOverview.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminOverview } from "@/components/admin/AdminOverview"

const h = vi.hoisted(() => ({ stats: undefined as unknown }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      stats: { useQuery: () => ({ data: h.stats, isPending: h.stats === undefined, isError: false, refetch: vi.fn() }) },
      accountTrend: { useQuery: () => ({ data: undefined, isPending: true, isError: false, refetch: vi.fn() }) },
    },
  },
}))

const STATS = {
  totalAccounts: 42, activeAccounts: 40, active24h: 7, active7d: 15,
  paying: { plus: 5, pro: 3 }, trial: 9, expiringSoon: { paid: 2, trial: 1 }, standardAfterTrial: 6,
  pendingOrders: 2, newAccounts: 3, updatedAt: "2026-11-15T05:07:00.000Z",
}
function renderOverview() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminOverview />
    </LanguageProvider>
  )
}
beforeEach(() => {
  h.stats = undefined
})

describe("AdminOverview (spec K 8.2)", () => {
  it("9 thẻ đúng số và dòng phụ; cập nhật lúc giờ VN", () => {
    h.stats = STATS
    renderOverview()
    const text = (id: string) => screen.getByTestId(`card-${id}`).textContent ?? ""
    expect(text("total")).toContain("42")
    expect(text("active")).toContain("40")
    expect(text("active24h")).toContain("7")
    expect(text("active7d")).toContain("15")
    expect(text("paying")).toContain("8")
    expect(text("paying")).toContain("Plus 5 · Pro 3")
    expect(text("trial")).toContain("9")
    expect(text("expiring")).toContain("3")
    expect(text("expiring")).toContain("2 trả phí · 1 dùng thử")
    expect(text("std-after-trial")).toContain("6")
    expect(screen.getByText("Cập nhật lúc 15/11 12:07")).toBeTruthy()
  })
  it("Chờ duyệt > 0: là link tới /admin/orders, viền amber", () => {
    h.stats = STATS
    renderOverview()
    const card = screen.getByTestId("card-pending")
    expect(card.closest("a")?.getAttribute("href")).toBe("/admin/orders")
    expect(card.className).toContain("border-t-amber-500")
    expect(card.textContent).toContain("3 tài khoản mới chưa xem")
  })
  it("Chờ duyệt = 0: viền slate, dòng 'Không có đơn chờ'; 0 tài khoản mới thì không có dòng tài khoản mới", () => {
    h.stats = { ...STATS, pendingOrders: 0, newAccounts: 0, expiringSoon: { paid: 0, trial: 0 } }
    renderOverview()
    const card = screen.getByTestId("card-pending")
    expect(card.className).toContain("border-t-slate-300")
    expect(card.textContent).toContain("Không có đơn chờ")
    expect(card.textContent).not.toContain("tài khoản mới")
    expect(screen.getByTestId("card-expiring").className).toContain("border-t-slate-300")
  })
})
```

Run lần lượt (từng lệnh):
`pnpm test tests/unit/components/BarChart.test.tsx`, `pnpm test tests/unit/components/AccountTrend.test.tsx`, `pnpm test tests/unit/components/AdminOverview.test.tsx` → Expected: FAIL (không resolve component).
`pnpm test tests/unit/components/AdminNav.test.tsx`, `pnpm test tests/unit/auth-authorized.test.ts`, `pnpm test tests/unit/layout/admin-redirect.test.ts`, `pnpm test tests/unit/components/AppHeader.test.tsx` → Expected: FAIL (vẫn `/admin/orders`, 4 mục).

- [ ] **Step 3: `ADMIN_HOME` + 5 chỗ chuyển hướng**

`src/lib/admin.ts` thêm:
```ts
// Trang chủ khu admin (spec K N2): mọi chuyển hướng admin dùng hằng này.
export const ADMIN_HOME = "/admin/overview"
```
Thay chuỗi `"/admin/orders"` bằng `ADMIN_HOME` (import từ `@/lib/admin`) đúng ở: `src/app/(admin)/admin/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/login/page.tsx`, `src/server/auth.config.ts`, `src/components/layout/AppHeader.tsx`. **Không** đổi `/admin/orders` trong `admin-nav.ts`, `AdminSidebar.tsx` (badge). Kiểm lại: `grep -rn '"/admin/orders"' src` chỉ còn `admin-nav.ts`, `AdminSidebar.tsx` (và file của P nếu P thêm chỗ dùng đúng nghĩa "màn đơn chờ" — giữ, ghi Ruling).

- [ ] **Step 4: i18n nhóm Tổng quan**

Thêm vào `src/language/vi.json` và `en.json` (cùng vị trí, sau nhóm `admin_price_*`/`admin_trial_*`):

| Key | vi | en |
|---|---|---|
| `admin_overview` | Tổng quan | Overview |
| `admin_tab_overview` | Tổng quan | Overview |
| `admin_updated_at` | Cập nhật lúc {time} | Updated {time} |
| `admin_card_total` | Tổng tài khoản | Total accounts |
| `admin_card_total_hint` | Không tính admin | Excluding admins |
| `admin_card_active` | Đang hoạt động | Active accounts |
| `admin_card_active_hint` | Chưa bị khóa | Not locked |
| `admin_card_pending` | Chờ duyệt | Pending |
| `admin_card_pending_hint` | Cần xác nhận chuyển khoản | Payments to confirm |
| `admin_card_pending_none` | Không có đơn chờ | No pending orders |
| `admin_card_pending_new` | {n} tài khoản mới chưa xem | {n} new accounts not reviewed |
| `admin_card_active24h` | Active 24h | Active 24h |
| `admin_card_active24h_hint` | Dùng app trong 24 giờ qua | Used the app in the last 24 hours |
| `admin_card_active7d` | Active 7 ngày | Active 7 days |
| `admin_card_active7d_hint` | 7 ngày gần nhất (giờ VN) | Last 7 days (Vietnam time) |
| `admin_card_paying` | Đang trả phí | Paying |
| `admin_card_paying_hint` | Plus {plus} · Pro {pro} | Plus {plus} · Pro {pro} |
| `admin_card_trial` | Đang dùng thử | On trial |
| `admin_card_trial_hint` | Pro dùng thử còn hạn | Active Pro trial |
| `admin_card_expiring` | Sắp hết hạn | Expiring soon |
| `admin_card_expiring_hint` | {paid} trả phí · {trial} dùng thử · trong 30 ngày | {paid} paid · {trial} trial · within 30 days |
| `admin_card_std_after_trial` | Standard sau dùng thử | Standard after trial |
| `admin_card_std_after_trial_hint` | Hết dùng thử, có dùng app trong 30 ngày | Trial ended, used the app in the last 30 days |
| `admin_trend_title` | Xu hướng tài khoản | Account trend |
| `admin_trend_days` | {n} ngày | {n} days |
| `admin_trend_new` | Tài khoản mới | New accounts |
| `admin_trend_avg` | Trung bình/ngày | Average per day |
| `admin_trend_returning` | Lượt quay lại | Returning visits |
| `admin_trend_busiest` | Ngày đông người mới nhất | Busiest signup day |
| `admin_trend_busiest_value` | {date} · {n} tài khoản | {date} · {n} accounts |
| `admin_trend_legend_returning` | Quay lại | Returning |
| `admin_trend_legend_today` | Hôm nay (chưa hết ngày) | Today (in progress) |
| `admin_trend_bar_label` | {date}: {new} tài khoản mới, {ret} quay lại | {date}: {new} new, {ret} returning |
| `admin_trend_returning_note` | Quay lại = tài khoản cũ có dùng app trong ngày (không chỉ đăng nhập, vì phiên được ghi nhớ 30 ngày). | Returning = existing accounts that used the app that day (not just signed in, since sessions last 30 days). |
| `admin_trend_tracking_since` | Lượt quay lại được ghi từ {date} | Returning visits recorded since {date} |
| `admin_trend_no_tracking` | Chưa có dữ liệu hoạt động | No activity data yet |
| `admin_chart_empty` | Chưa có số liệu trong khoảng này | No data in this period |

Dùng lại `load_error`, `retry` (kiểm tồn tại bằng grep).

- [ ] **Step 5: Nav + `shortDateTimeVn` + page**

`admin-nav.ts` (đối chiếu sau P): import thêm `LayoutDashboard`; thêm **đầu** `ADMIN_NAV_ITEMS`:
```ts
  { href: "/admin/overview", labelKey: "admin_overview", shortKey: "admin_tab_overview", icon: LayoutDashboard },
```
`AdminTabBar.tsx`: `grid-cols-4` → `grid-cols-5`.

`admin-format.ts` thêm cuối:
```ts
// "dd/mm HH:mm" giờ VN cho dòng "Cập nhật lúc".
export function shortDateTimeVn(d: string): string {
  const date = new Date(d)
  return `${formatVnDate(date).slice(0, 5)} ${formatTime(new Date(date.getTime() + 7 * 60 * 60 * 1000))}`
}
```

Tạo `src/app/(admin)/admin/overview/page.tsx`:
```tsx
import { AdminOverview } from "@/components/admin/AdminOverview"

export default function AdminOverviewPage() {
  return <AdminOverview />
}
```

- [ ] **Step 6: `BarChart.tsx`**

```tsx
"use client"

import { cn } from "@/lib/utils"

export type BarSegment = { key: string; value: number; className: string }
export type ChartBar = { key: string; label: string; ariaLabel: string; segments: BarSegment[]; faded?: boolean }
export type ChartLegend = { key: string; label: string; className: string }

type Props = {
  bars: ChartBar[]
  layout: "stacked" | "grouped"
  legend: ChartLegend[]
  formatMax: (n: number) => string
  emptyText: string
  testId: string
}

// Vẽ bằng div theo % chiều cao, không thêm thư viện biểu đồ (spec K C9). stacked: segments xếp trên → dưới.
export function BarChart({ bars, layout, legend, formatMax, emptyText, testId }: Props) {
  const heights = bars.map((b) =>
    layout === "stacked" ? b.segments.reduce((s, x) => s + x.value, 0) : Math.max(0, ...b.segments.map((x) => x.value))
  )
  const max = Math.max(0, ...heights)
  if (max === 0) {
    return (
      <p data-testid={testId} className="text-sm text-slate-500">
        {emptyText}
      </p>
    )
  }
  const minWidth = bars.length * (layout === "grouped" ? 28 : 24)

  return (
    <div data-testid={testId} className="space-y-3">
      <p className="text-xs text-slate-500">{formatMax(max)}</p>
      <div className="overflow-x-auto">
        <div className="flex h-48 items-end gap-1 border-b border-slate-200" style={{ minWidth }}>
          {bars.map((b) => (
            <div
              key={b.key}
              data-testid="chart-bar"
              data-key={b.key}
              data-faded={b.faded ? "true" : undefined}
              role="img"
              aria-label={b.ariaLabel}
              title={b.ariaLabel}
              className={cn(
                "flex h-full min-w-[20px] flex-1",
                layout === "stacked" ? "flex-col justify-end" : "items-end justify-center gap-0.5",
                b.faded && "opacity-50"
              )}
            >
              {b.segments
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div
                    key={s.key}
                    data-seg={s.key}
                    className={cn(s.className, layout === "grouped" && "w-1/2 max-w-3 rounded-t-sm")}
                    style={{ height: `${(s.value / max) * 100}%` }}
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1" style={{ minWidth }}>
          {bars.map((b) => (
            <span key={b.key} className="min-w-[20px] flex-1 text-center text-[10px] text-slate-500">
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-4 text-xs text-slate-600">
        {legend.map((l) => (
          <li key={l.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-3 rounded-sm", l.className)} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
```
Nếu `(60 / 100) * 100` ra số lẻ dấu phẩy động khác `"60%"` trong jsdom → giữ công thức, sửa test sang `parseFloat(...)` + `toBeCloseTo`, ghi Ruling.

- [ ] **Step 7: `AccountTrend.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { TREND_RANGES, type TrendRange } from "@/lib/admin-stats"
import { cn } from "@/lib/utils"
import { BarChart } from "./BarChart"

const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const dmy = (day: string) => `${dm(day)}/${day.slice(0, 4)}`

export function AccountTrend() {
  const { t } = useTranslation()
  const [days, setDays] = useState<TrendRange>(7)
  const query = trpc.admin.accountTrend.useQuery({ days })
  const data = query.data

  const mini = (id: string, label: string, value: string) => (
    <div data-testid={`trend-${id}`} className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )

  return (
    <section data-testid="account-trend" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("admin_trend_title")}</h2>
        <div role="radiogroup" aria-label={t("admin_trend_title")} className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
          {TREND_RANGES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={days === n}
              onClick={() => setDays(n)}
              className={cn(
                "h-11 rounded-md px-3 text-sm font-semibold md:h-10",
                days === n ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t("admin_trend_days").replace("{n}", String(n))}
            </button>
          ))}
        </div>
      </div>

      {query.isError ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{t("load_error")}</p>
          <Button variant="outline" className="h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !data ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {mini("new", t("admin_trend_new"), String(data.totals.newAccounts))}
            {mini("avg", t("admin_trend_avg"), data.totals.avgPerDay.toLocaleString("vi-VN"))}
            {mini("returning", t("admin_trend_returning"), String(data.totals.returning))}
            {mini(
              "busiest",
              t("admin_trend_busiest"),
              data.totals.busiestDay
                ? t("admin_trend_busiest_value").replace("{date}", dm(data.totals.busiestDay.day)).replace("{n}", String(data.totals.busiestDay.count))
                : "-"
            )}
          </div>
          <BarChart
            testId="trend-chart"
            layout="grouped"
            formatMax={String}
            emptyText={t("admin_chart_empty")}
            legend={[
              { key: "new", label: t("admin_trend_new"), className: "bg-primary" },
              { key: "returning", label: t("admin_trend_legend_returning"), className: "bg-teal-300" },
              { key: "today", label: t("admin_trend_legend_today"), className: "bg-primary opacity-50" },
            ]}
            bars={data.days.map((d) => ({
              key: d.day,
              label: dm(d.day),
              faded: d.isToday,
              ariaLabel: t("admin_trend_bar_label")
                .replace("{date}", dm(d.day))
                .replace("{new}", String(d.newAccounts))
                .replace("{ret}", String(d.returning)),
              segments: [
                { key: "new", value: d.newAccounts, className: "bg-primary" },
                { key: "returning", value: d.returning, className: "bg-teal-300" },
              ],
            }))}
          />
          <p className="text-xs text-slate-500">{t("admin_trend_returning_note")}</p>
          {/* Số liệu quay lại chỉ có từ lúc triển khai K (spec K T5). */}
          {(!data.trackingSince || data.trackingSince > data.days[0].day) && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {data.trackingSince
                ? t("admin_trend_tracking_since").replace("{date}", dmy(data.trackingSince))
                : t("admin_trend_no_tracking")}
            </p>
          )}
        </>
      )}
    </section>
  )
}
```
Nếu `TREND_RANGES.map` báo kiểu `n` không gán được cho `TrendRange` → `(TREND_RANGES as readonly TrendRange[])`, ghi Ruling. Nếu hàm `t` không nhận `load_error`/`retry` (key khác tên) → dùng key đúng như `AdminOrderHistory`.

- [ ] **Step 8: `AdminOverview.tsx`**

```tsx
"use client"

import Link from "next/link"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { shortDateTimeVn } from "./admin-format"
import { AccountTrend } from "./AccountTrend"

// Viền trên theo nhóm, bảng màu A3 (spec K A14); amber chỉ khi cần admin xử lý.
const TONE = {
  primary: "border-t-primary",
  teal: "border-t-teal-400",
  emerald: "border-t-emerald-600",
  warn: "border-t-amber-500",
  muted: "border-t-slate-300",
} as const
type Tone = keyof typeof TONE

function StatCard({ id, label, value, hint, extra, tone, href }: { id: string; label: string; value: number; hint: string; extra?: string; tone: Tone; href?: string }) {
  const card = (
    <div data-testid={`card-${id}`} className={cn("h-full rounded-lg border border-slate-200 border-t-4 bg-white p-4", TONE[tone])}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("text-2xl font-bold", tone === "warn" ? "text-amber-700" : "text-foreground")}>{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      {extra && <p className="text-xs font-medium text-primary">{extra}</p>}
    </div>
  )
  return href ? (
    <Link href={href} className="block min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  ) : (
    card
  )
}

export function AdminOverview() {
  const { t } = useTranslation()
  const query = trpc.admin.stats.useQuery()
  const s = query.data

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_overview")}
        description={s ? t("admin_updated_at").replace("{time}", shortDateTimeVn(String(s.updatedAt))) : undefined}
      />

      {query.isError ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{t("load_error")}</p>
          <Button variant="outline" className="h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div data-testid="overview-cards" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard id="total" tone="primary" label={t("admin_card_total")} value={s.totalAccounts} hint={t("admin_card_total_hint")} />
          <StatCard id="active" tone="primary" label={t("admin_card_active")} value={s.activeAccounts} hint={t("admin_card_active_hint")} />
          <StatCard
            id="pending"
            href="/admin/orders"
            tone={s.pendingOrders > 0 ? "warn" : "muted"}
            label={t("admin_card_pending")}
            value={s.pendingOrders}
            hint={t(s.pendingOrders > 0 ? "admin_card_pending_hint" : "admin_card_pending_none")}
            extra={s.newAccounts > 0 ? t("admin_card_pending_new").replace("{n}", String(s.newAccounts)) : undefined}
          />
          <StatCard id="active24h" tone="teal" label={t("admin_card_active24h")} value={s.active24h} hint={t("admin_card_active24h_hint")} />
          <StatCard id="active7d" tone="teal" label={t("admin_card_active7d")} value={s.active7d} hint={t("admin_card_active7d_hint")} />
          <StatCard
            id="paying"
            tone="emerald"
            label={t("admin_card_paying")}
            value={s.paying.plus + s.paying.pro}
            hint={t("admin_card_paying_hint").replace("{plus}", String(s.paying.plus)).replace("{pro}", String(s.paying.pro))}
          />
          <StatCard id="trial" tone="emerald" label={t("admin_card_trial")} value={s.trial} hint={t("admin_card_trial_hint")} />
          <StatCard
            id="expiring"
            tone={s.expiringSoon.paid + s.expiringSoon.trial > 0 ? "warn" : "muted"}
            label={t("admin_card_expiring")}
            value={s.expiringSoon.paid + s.expiringSoon.trial}
            hint={t("admin_card_expiring_hint").replace("{paid}", String(s.expiringSoon.paid)).replace("{trial}", String(s.expiringSoon.trial))}
          />
          <StatCard id="std-after-trial" tone="teal" label={t("admin_card_std_after_trial")} value={s.standardAfterTrial} hint={t("admin_card_std_after_trial_hint")} />
        </div>
      )}

      <AccountTrend />
    </div>
  )
}
```
Nếu `PageHeader` không có prop `description` kiểu string → đặt dòng "Cập nhật lúc" thành `<p className="text-xs text-slate-500">` ngay dưới `PageHeader`, ghi Ruling. Test kiểm class `border-t-amber-500` trên phần tử `card-pending`.

- [ ] **Step 9: Chạy unit test, xác nhận pass**

Chạy lần lượt: `pnpm test tests/unit/components/BarChart.test.tsx`, `pnpm test tests/unit/components/AccountTrend.test.tsx`, `pnpm test tests/unit/components/AdminOverview.test.tsx`, `pnpm test tests/unit/components/AdminNav.test.tsx`, `pnpm test tests/unit/auth-authorized.test.ts`, `pnpm test tests/unit/layout/admin-redirect.test.ts`, `pnpm test tests/unit/components/AppHeader.test.tsx`, `pnpm test tests/unit/next15-contract.test.ts`, `pnpm test tests/unit/theme-legacy-colors.test.ts`.
Expected: PASS hết.

- [ ] **Step 10: Sửa e2e có sẵn**

Run: `grep -rn "admin\\\\/orders\\$\|/admin → /admin/orders\|toHaveCount(4)" tests/e2e`
Với mỗi `tests/e2e/admin*.spec.ts` (đối chiếu sau P):
- Đích sau đăng nhập của admin trong `loginAs`: `/\/admin\/orders$/` → `/\/admin\/overview$/`.
- `admin.spec.ts` test "/admin → /admin/orders; teacher vào … → 404": admin vào `/admin` → chờ `/\/admin\/overview$/` (sửa cả tên test); danh sách path giáo viên phải 404 thêm `'/admin/overview'`.
- Test "route giáo viên → /admin/orders" (admin vào route giáo viên): đích → `/admin/overview` (sửa cả tên test).
- Số tab: `toHaveCount(4)` → `toHaveCount(5)`.
- Chỗ nào test đang **đứng ở** `/admin/orders` sau khi đăng nhập mà không `goto` (vd chờ thấy đơn chờ ngay) → thêm `await admin.goto('/admin/orders')`, ghi Ruling.

- [ ] **Step 11: E2E `tests/e2e/admin-overview.spec.ts`**

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const DAY = 24 * 60 * 60 * 1000;

async function loginAs(browser: Browser, username: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/overview$/ : /.*dashboard/);
  return page;
}

// Nửa đêm UTC của ngày VN (cột DATE), như vnDayDate.
function vnDay(d: Date): Date {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}
const dm = (d: Date) => {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
};
const num = async (page: Page, id: string) => Number((await page.getByTestId(`card-${id}`).locator('p').nth(1).textContent())?.trim());

let stdId = 0;
test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  stdId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).id;
  await db.userActivityDay.deleteMany({ where: { userId: stdId } });
  const y = new Date(Date.now() - DAY);
  await db.userActivityDay.create({ data: { userId: stdId, day: vnDay(y), firstSeenAt: y } });
});

test.afterAll(async () => {
  await db.userActivityDay.deleteMany({ where: { userId: stdId } });
  await db.user.update({ where: { id: stdId }, data: { lastActiveAt: null } });
  await db.$disconnect();
});

test('desktop: admin vào /admin/overview; 9 thẻ; teacher_std dùng app → Active 24h ≥ 1; cột hôm qua có quay lại; 7/14/30; thẻ Chờ duyệt → /admin/orders', async ({ browser }) => {
  const teacher = await loginAs(browser, 'teacher_std', DESKTOP);
  await teacher.goto('/students');
  await teacher.context().close();

  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await expect(admin.locator('aside').getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
  const cards = admin.getByTestId('overview-cards');
  for (const id of ['total', 'active', 'pending', 'active24h', 'active7d', 'paying', 'trial', 'expiring', 'std-after-trial']) {
    await expect(cards.getByTestId(`card-${id}`)).toBeVisible();
    expect(Number.isInteger(await num(admin, id))).toBe(true);
  }
  expect(await num(admin, 'active24h')).toBeGreaterThanOrEqual(1);
  expect(await num(admin, 'active7d')).toBeGreaterThanOrEqual(1);
  await expect(admin.getByText(/^Cập nhật lúc \d{2}\/\d{2} \d{2}:\d{2}$/)).toBeVisible();

  const chart = admin.getByTestId('trend-chart');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(7);
  await expect(chart.getByTestId('chart-bar').last()).toHaveAttribute('data-faded', 'true');
  await expect(chart.getByRole('img', { name: new RegExp(`^${dm(new Date(Date.now() - DAY))}: \\d+ tài khoản mới, [1-9]\\d* quay lại$`) })).toBeVisible();

  await admin.getByRole('radio', { name: '14 ngày' }).click();
  await expect(chart.getByTestId('chart-bar')).toHaveCount(14);
  await admin.getByRole('radio', { name: '30 ngày' }).click();
  await expect(chart.getByTestId('chart-bar')).toHaveCount(30);
  await expect(chart.getByTestId('chart-bar').last()).toHaveAttribute('data-faded', 'true');

  await admin.getByTestId('card-pending').click();
  await expect(admin).toHaveURL(/\/admin\/orders$/);
  await admin.context().close();
});

test('390px: tab bar 5 tab ≥44px, không tràn ngang, thẻ 2 cột, nút 7/14/30 ≥44px', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test', MOBILE);
  const tabs = admin.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(5);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(tabs.getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');

  const a = (await admin.getByTestId('card-total').boundingBox())!;
  const b = (await admin.getByTestId('card-active').boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x);

  for (const name of ['7 ngày', '14 ngày', '30 ngày']) {
    expect((await admin.getByRole('radio', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await admin.getByRole('radio', { name: '30 ngày' }).click();
  await expect(admin.getByTestId('trend-chart').getByTestId('chart-bar')).toHaveCount(30);
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await admin.context().close();
});
```
Nếu thẻ `p` thứ 2 không phải số (cấu trúc thẻ khác) → đọc số bằng `data-testid` phụ hoặc regex trên `textContent`, ghi Ruling. Nếu teacher_std được tạo lại hôm nay và dòng hôm qua bị tính "quay lại" (đúng luật: ngày ≠ ngày tạo) thì kiểm vẫn xanh.

- [ ] **Step 12: Chạy e2e**

```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin-overview.spec.ts
pnpm exec playwright test tests/e2e/admin.spec.ts
pnpm exec playwright test tests/e2e/admin-prices.spec.ts
pnpm exec playwright test tests/e2e/admin-trial.spec.ts
pnpm exec playwright test tests/e2e/admin-reset-password.spec.ts
pnpm exec playwright test tests/e2e/auth.spec.ts
```
Expected: tất cả passed (cùng các file `admin*.spec.ts` khác nếu P thêm).

- [ ] **Step 13: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit
pnpm lint
git add src/lib/admin.ts "src/app/(admin)/admin/page.tsx" "src/app/(app)/layout.tsx" src/app/login/page.tsx src/server/auth.config.ts src/components/layout/AppHeader.tsx src/components/admin/admin-nav.ts src/components/admin/AdminTabBar.tsx src/components/admin/admin-format.ts src/components/admin/BarChart.tsx src/components/admin/AdminOverview.tsx src/components/admin/AccountTrend.tsx "src/app/(admin)/admin/overview/page.tsx" src/language/vi.json src/language/en.json tests/unit/components/BarChart.test.tsx tests/unit/components/AdminOverview.test.tsx tests/unit/components/AccountTrend.test.tsx tests/unit/components/AdminNav.test.tsx tests/unit/auth-authorized.test.ts tests/unit/layout/admin-redirect.test.ts tests/unit/components/AppHeader.test.tsx tests/e2e/
git status --short
git commit -m "feat(k): trang chủ admin /admin/overview (9 thẻ số, xu hướng tài khoản 7/14/30 ngày, BarChart dùng chung), ADMIN_HOME

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
Expected: `git status --short` trước commit chỉ có file của task (`tests/e2e/` chỉ gồm `admin-overview.spec.ts` mới và các `admin*.spec.ts`/`auth.spec.ts` vừa sửa; file e2e khác thay đổi ngoài ý muốn → bỏ ra, không add).

---

### Task 5: Tài khoản mới trên màn Chờ xác nhận (API, tự đánh dấu khi đặt gói, pill sidebar, chấm tab bar) + e2e

**Đọc trước:** Global Constraints; spec mục 4 nhóm R, 7.5 (tài khoản mới), 7.5b, 7.7, 7.8, 8.3b, 10 (new-accounts); `src/server/services/new-accounts.service.ts` (Task 3); **code sau P**: `getPendingCount` + procedure `admin.pendingCount`, `AdminSidebar.tsx`, `AdminTabBar.tsx` (chấm `admin-tab-pending-count`), `AdminPendingOrders.tsx`, `tests/unit/components/AdminNav.test.tsx` (cách mock `pendingCount`); `src/server/services/plan-admin.service.ts` (`adminSetPlan`); `src/server/services/trial.service.ts` (`setUserTrialDays`); `src/components/admin/SetPlanDialog.tsx`, `TrialDaysDialog.tsx` (prop `user: RouterOutputs["admin"]["overview"]["users"][number]`, `onClose`); `src/components/admin/admin-format.ts` (`dateTimeVn`, `SOURCE_KEY`); `tests/integration/register.test.ts` (cách gọi `publicCaller.auth.register`); `src/app/register/RegisterForm.tsx` (ô `name="username"|"fullName"|"password"`, thành công → `/login`); field xóa mềm của Q.

**Files:**
- Modify: `src/server/services/new-accounts.service.ts`, `src/lib/schemas/plan.ts`, `src/server/trpc/routers/admin.ts`, `src/server/services/plan-admin.service.ts` (`adminSetPlan`), `src/server/services/trial.service.ts` (`setUserTrialDays`), file chứa `getPendingCount` (P)
- Create: `src/components/admin/NewAccounts.tsx`
- Modify: `src/components/admin/AdminPendingOrders.tsx`, `AdminSidebar.tsx`, `AdminTabBar.tsx`, `src/language/vi.json`, `en.json`
- Test (Mới): `tests/integration/new-accounts.test.ts`, `tests/unit/components/NewAccounts.test.tsx`, `tests/e2e/admin-new-accounts.spec.ts`
- Test (Sửa): `tests/unit/schemas/plan.schema.test.ts`, `tests/unit/components/AdminNav.test.tsx`, test của P kiểm `pendingCount` bằng `toEqual({ count })` (nếu có → `toMatchObject`)

**Interfaces:**
- Consumes: `newAccountsWhere`, `countNewAccounts` (Task 3); `effectivePlan`, `planLabel` (`@/lib/plans`); `SetPlanDialog`, `TrialDaysDialog`; `dateTimeVn`, `SOURCE_KEY` (`./admin-format`).
- Produces:
  - `new-accounts.service.ts`: `type NewAccountRow = { id: number; username: string; fullName: string | null; createdAt: Date; plan: Plan; source: PlanSource }`; `getNewAccounts(db: Db, now?: Date): Promise<{ items: NewAccountRow[]; total: number }>` (100 dòng, `createdAt desc, id desc`); `markAccountsSeen(db: PrismaClient, admin: string, input: MarkAccountsSeenInput): Promise<{ count: number }>`; `markSeenIfNew(tx: Db, userId: number, now: Date): Promise<void>`.
  - Schema: `markAccountsSeenSchema` (`{ userIds: number[] (1..200) } | { all: true }`), `type MarkAccountsSeenInput`.
  - tRPC: `admin.newAccounts` (query), `admin.markAccountsSeen` (mutation), `admin.pendingCount` trả `{ count: number; newAccounts: number }`.
  - UI: `NewAccounts({ users }: { users: RouterOutputs["admin"]["overview"]["users"] })`; test id `new-accounts`, `new-account-card`, `admin-new-accounts-count` (sidebar), `admin-tab-new-dot` (tab bar).

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Test schema + integration (RED)**

`tests/unit/schemas/plan.schema.test.ts`: thêm `markAccountsSeenSchema` vào import, thêm:
```ts
describe("markAccountsSeenSchema (spec K R5)", () => {
  it("nhận { userIds } 1..200 phần tử hoặc { all: true }", () => {
    expect(markAccountsSeenSchema.safeParse({ userIds: [1, 2] }).success).toBe(true)
    expect(markAccountsSeenSchema.safeParse({ all: true }).success).toBe(true)
    for (const bad of [{ userIds: [] }, { userIds: Array.from({ length: 201 }, (_, i) => i + 1) }, { userIds: [0] }, { all: false }, {}]) {
      expect(markAccountsSeenSchema.safeParse(bad).success).toBe(false)
    }
  })
})
```

Tạo `tests/integration/new-accounts.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"

const FAKE = "nacc_fake_"
const PASSWORD = "matkhau-test-123"

async function cleanup() {
  const ids = (await db.user.findMany({ where: { username: { startsWith: FAKE } }, select: { id: true } })).map((u) => u.id)
  if (ids.length === 0) return
  // registerUser seed môn học mặc định; bảng con có FK RESTRICT phải xóa trước (thêm bảng của Q nếu có, ghi Ruling).
  await db.planOrder.deleteMany({ where: { userId: { in: ids } } })
  await db.trialDayChange.deleteMany({ where: { userId: { in: ids } } })
  await db.subject.deleteMany({ where: { userId: { in: ids } } })
  await db.classUpgradeLog.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
}
async function register(name: string) {
  await publicCaller.auth.register({ username: FAKE + name, password: PASSWORD, fullName: "Tài khoản " + name })
  return db.user.findUniqueOrThrow({ where: { username: FAKE + name } })
}
const names = async () => (await (await getAuthedCaller("admin_test")).admin.newAccounts()).items.map((i) => i.username)

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = `admin_test,${FAKE}admin`
  await cleanup()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await cleanup()
})

describe("admin.newAccounts / markAccountsSeen (spec K nhóm R)", () => {
  it("giáo viên → FORBIDDEN", async () => {
    const c = await getAuthedCaller("teacher_std")
    await expect(c.admin.newAccounts()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(c.admin.markAccountsSeen({ all: true })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("đăng ký → xuất hiện đầu danh sách, pendingCount.newAccounts +1; đánh dấu đã xem → biến mất, gọi lại không đổi mốc", async () => {
    const admin = await getAuthedCaller("admin_test")
    const before = await admin.admin.pendingCount()
    const u = await register("a")
    const list = await admin.admin.newAccounts()
    expect(list.items[0]).toMatchObject({ id: u.id, username: FAKE + "a", fullName: "Tài khoản a" })
    expect(typeof list.items[0].plan).toBe("string")
    expect((await admin.admin.pendingCount()).newAccounts - before.newAccounts).toBe(1)

    expect(await admin.admin.markAccountsSeen({ userIds: [u.id] })).toEqual({ count: 1 })
    expect(await names()).not.toContain(FAKE + "a")
    const seenAt = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).adminSeenAt
    expect(seenAt).not.toBeNull()
    expect(await admin.admin.markAccountsSeen({ userIds: [u.id] })).toEqual({ count: 0 })
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).adminSeenAt).toEqual(seenAt)
  })

  it("{ all: true } → danh sách rỗng, count lần 2 = 0", async () => {
    await register("b")
    await register("c")
    const admin = await getAuthedCaller("admin_test")
    const r = await admin.admin.markAccountsSeen({ all: true })
    expect(r.count).toBeGreaterThanOrEqual(2)
    expect((await admin.admin.newAccounts()).total).toBe(0)
    expect(await admin.admin.markAccountsSeen({ all: true })).toEqual({ count: 0 })
  })

  it("không hiện admin và tài khoản đã xóa mềm", async () => {
    await register("admin")
    const gone = await register("gone")
    await db.user.update({ where: { id: gone.id }, data: { isDeleted: true } })
    const list = await names()
    expect(list).not.toContain(FAKE + "admin")
    expect(list).not.toContain(FAKE + "gone")
  })

  it("câu backfill của migration làm tài khoản có sẵn thành đã xem", async () => {
    const old = await register("old")
    expect(await names()).toContain(FAKE + "old")
    const dir = join(process.cwd(), "prisma", "migrations")
    const sql = readFileSync(join(dir, readdirSync(dir).find((d) => d.endsWith("_add_user_activity"))!, "migration.sql"), "utf8")
    const backfill = sql.match(/^UPDATE "users" SET "admin_seen_at" = .*;$/m)![0]
    // Giới hạn vào user giả để không đụng tài khoản seed.
    await db.$executeRawUnsafe(backfill.replace(/;$/, ` AND "id" = ${old.id};`))
    expect(await names()).not.toContain(FAKE + "old")
  })

  it("setPlan / setUserTrial tự đánh dấu đã xem", async () => {
    const p = await register("plan")
    const t = await register("trial")
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.setPlan({ userId: p.id, plan: "standard", note: "test K" })
    await admin.admin.setUserTrial({ userId: t.id, days: 30 })
    const list = await names()
    expect(list).not.toContain(FAKE + "plan")
    expect(list).not.toContain(FAKE + "trial")
  })
})
```
Nếu `setPlanSchema` sau P/L đòi field khác cho `standard` → theo schema thật, ghi Ruling. Nếu `auth.register` có giới hạn tần suất theo IP làm test thứ n bị chặn → đặt `ip` khác nhau hoặc dùng `registerUser(db, …)` trực tiếp, ghi Ruling.

Run: `pnpm test tests/unit/schemas/plan.schema.test.ts` → Expected: FAIL (`markAccountsSeenSchema` undefined).
Run: `pnpm test tests/integration/new-accounts.test.ts` → Expected: FAIL (`admin.newAccounts is not a function`).

- [ ] **Step 3: Server**

`src/lib/schemas/plan.ts` cuối file:
```ts
export const markAccountsSeenSchema = z.union([
  z.object({ userIds: z.array(z.number().int().positive()).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
])
export type MarkAccountsSeenInput = z.infer<typeof markAccountsSeenSchema>
```

`src/server/services/new-accounts.service.ts` thêm (gộp import với import sẵn có của file):
```ts
import type { Prisma, PrismaClient } from "@prisma/client"
import { effectivePlan, type Plan, type PlanSource } from "@/lib/plans"
import type { MarkAccountsSeenInput } from "@/lib/schemas/plan"

export type NewAccountRow = { id: number; username: string; fullName: string | null; createdAt: Date; plan: Plan; source: PlanSource }

export async function getNewAccounts(db: Db, now = new Date()): Promise<{ items: NewAccountRow[]; total: number }> {
  const where = newAccountsWhere()
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: { id: true, username: true, fullName: true, createdAt: true, plan: true, planExpiresAt: true, trialEndsAt: true },
    }),
    db.user.count({ where }),
  ])
  return {
    items: rows.map(({ plan, planExpiresAt, trialEndsAt, ...u }) => {
      const eff = effectivePlan({ plan, planExpiresAt, trialEndsAt }, now)
      return { ...u, plan: eff.plan, source: eff.source }
    }),
    total,
  }
}

// Chỉ đánh dấu dòng đang null: bấm 2 lần không đổi mốc đã xem (spec K R5).
export async function markAccountsSeen(db: PrismaClient, admin: string, input: MarkAccountsSeenInput): Promise<{ count: number }> {
  const where: Prisma.UserWhereInput = "all" in input ? newAccountsWhere() : { ...newAccountsWhere(), id: { in: input.userIds } }
  const { count } = await db.user.updateMany({ where, data: { adminSeenAt: new Date() } })
  console.info(`[admin] ${admin} đánh dấu đã xem ${count} tài khoản mới`)
  return { count }
}

// Đặt gói / dùng thử cho tài khoản là đã xem nó (spec K R4).
export async function markSeenIfNew(tx: Db, userId: number, now: Date): Promise<void> {
  await tx.user.updateMany({ where: { id: userId, adminSeenAt: null }, data: { adminSeenAt: now } })
}
```

`adminSetPlan` (`plan-admin.service.ts`, đối chiếu sau P): trong callback `db.$transaction`, sau `tx.user.update(...)`: `await markSeenIfNew(tx, input.userId, new Date())`. `setUserTrialDays` (`trial.service.ts`): trong transaction, sau `tx.user.update(...)`: `await markSeenIfNew(tx, input.userId, new Date())`. Import `markSeenIfNew` từ `./new-accounts.service`.

`getPendingCount` (P): trả `{ count, newAccounts: await countNewAccounts(db) }` (chạy song song với đếm đơn bằng `Promise.all` nếu tiện). Kiểu trả về cập nhật theo. Test của P đang `toEqual({ count: … })` → đổi `toMatchObject`, ghi Ruling.

Router (`admin.ts`): import `markAccountsSeenSchema`, `getNewAccounts`, `markAccountsSeen`; thêm:
```ts
  newAccounts: adminProcedure.query(({ ctx }) => getNewAccounts(ctx.db)),
  markAccountsSeen: adminProcedure
    .input(markAccountsSeenSchema)
    .mutation(({ ctx, input }) => markAccountsSeen(ctx.db, ctx.session.user.username, input)),
```

Run: `pnpm test tests/unit/schemas/plan.schema.test.ts` → PASS. `pnpm test tests/integration/new-accounts.test.ts` → PASS (6 test). `pnpm test tests/integration/admin.test.ts` → PASS. `pnpm test tests/integration/trial-days.test.ts` → PASS. Chạy lại file integration của P có kiểm `pendingCount` (grep `pendingCount` trong `tests/integration`) → PASS.

- [ ] **Step 4: Test UI (RED)**

`tests/unit/components/AdminNav.test.tsx` (đối chiếu mock `pendingCount` của P): mock trả thêm `newAccounts`; thêm ca:
```tsx
  it("có tài khoản mới: sidebar thêm pill số riêng, tab bar thêm chấm; 0 thì không có", () => {
    // Gán dữ liệu mock pendingCount theo cách P đang làm, vd h.pending = { count: 2, newAccounts: 3 }.
    vi.mocked(usePathname).mockReturnValue("/admin/orders")
    renderVi(<AdminSidebar />)
    expect(screen.getByTestId("admin-new-accounts-count").textContent).toBe("3")
    expect(screen.getByTestId("admin-new-accounts-count").getAttribute("aria-label")).toBe("3 tài khoản mới chưa xem")
    cleanup()
    renderVi(<AdminTabBar />)
    expect(screen.getByTestId("admin-tab-new-dot")).toBeTruthy()
    expect(screen.getByTestId("admin-tab-pending-count").textContent).toBe("2")
  })
```
(và 1 ca `newAccounts: 0` → `queryByTestId("admin-new-accounts-count")`, `queryByTestId("admin-tab-new-dot")` đều null). Import `cleanup` từ `@testing-library/react`.

Tạo `tests/unit/components/NewAccounts.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { NewAccounts } from "@/components/admin/NewAccounts"

const h = vi.hoisted(() => ({ data: undefined as unknown, mutate: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/admin/SetPlanDialog", () => ({ SetPlanDialog: ({ user }: { user: { username: string } }) => <div data-testid="set-plan-dialog">{user.username}</div> }))
vi.mock("@/components/admin/TrialDaysDialog", () => ({ TrialDaysDialog: ({ user }: { user: { username: string } }) => <div data-testid="trial-dialog">{user.username}</div> }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      newAccounts: { useQuery: () => ({ data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }) },
      markAccountsSeen: { useMutation: () => ({ mutate: h.mutate, isPending: false }) },
    },
  },
}))

const ITEMS = [
  { id: 11, username: "gv_moi", fullName: "Cô Mới", createdAt: "2026-11-15T02:30:00.000Z", plan: "standard", source: "free" },
  { id: 12, username: "gv_moi2", fullName: null, createdAt: "2026-11-14T10:00:00.000Z", plan: "pro", source: "trial" },
]
const USERS = [
  { id: 11, username: "gv_moi", fullName: "Cô Mới", createdAt: "2026-11-15T02:30:00.000Z", lastLoginAt: null, activeStudents: 0, plan: "standard", source: "free", expiresAt: null, trialEndsAt: null, isAdmin: false },
]
function renderIt() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <NewAccounts users={USERS as never} />
    </LanguageProvider>
  )
}
beforeEach(() => {
  h.data = undefined
  h.mutate.mockReset()
})

describe("NewAccounts (spec K 8.3b)", () => {
  it("liệt kê thẻ, giờ VN, gói hiện tại; Đã xem gọi markAccountsSeen({ userIds: [id] })", () => {
    h.data = { items: ITEMS, total: 2 }
    renderIt()
    const cards = screen.getAllByTestId("new-account-card")
    expect(cards).toHaveLength(2)
    expect(cards[0].textContent).toContain("gv_moi")
    expect(cards[0].textContent).toContain("Cô Mới")
    expect(cards[0].textContent).toContain("15/11/2026 09:30")
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Đã xem" }))
    expect(h.mutate).toHaveBeenCalledWith({ userIds: [11] })
  })
  it("Đặt gói / Đặt dùng thử mở đúng dialog với dòng user tra trong overview; không tra được → nút khóa", () => {
    h.data = { items: ITEMS, total: 2 }
    renderIt()
    const cards = screen.getAllByTestId("new-account-card")
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Đặt gói" }))
    expect(screen.getByTestId("set-plan-dialog").textContent).toBe("gv_moi")
    expect((within(cards[1]).getByRole("button", { name: "Đặt dùng thử" }) as HTMLButtonElement).disabled).toBe(true)
  })
  it("nút Đã xem cao ≥44px mobile (h-11); trống → 'Không có tài khoản mới', không có nút đánh dấu tất cả", () => {
    h.data = { items: ITEMS.slice(0, 1), total: 1 }
    renderIt()
    expect(within(screen.getByTestId("new-account-card")).getByRole("button", { name: "Đã xem" }).className).toContain("h-11")
    h.data = { items: [], total: 0 }
    renderIt()
    expect(screen.getAllByText("Không có tài khoản mới").length).toBeGreaterThan(0)
  })
})
```
`ResponsiveList` render cả bảng lẫn thẻ trong jsdom → chỉ kiểm trong `new-account-card`.

Run: `pnpm test tests/unit/components/NewAccounts.test.tsx`, `pnpm test tests/unit/components/AdminNav.test.tsx` → Expected: FAIL.

- [ ] **Step 5: i18n + UI**

Thêm vào `vi.json`/`en.json`:

| Key | vi | en |
|---|---|---|
| `admin_new_accounts` | Tài khoản mới | New accounts |
| `admin_new_accounts_hint` | Đăng ký gần đây, bạn chưa xem. Tài khoản đã dùng được ngay. | Recent sign-ups you have not reviewed. They can already use the app. |
| `admin_new_accounts_seen` | Đã xem | Mark seen |
| `admin_new_accounts_seen_all` | Đánh dấu tất cả đã xem | Mark all as seen |
| `admin_new_accounts_seen_all_confirm` | Đánh dấu {n} tài khoản là đã xem? | Mark {n} accounts as seen? |
| `admin_new_accounts_set_plan` | Đặt gói | Set plan |
| `admin_new_accounts_set_trial` | Đặt dùng thử | Set trial |
| `admin_new_accounts_registered` | Đăng ký lúc | Signed up |
| `admin_new_accounts_current_plan` | Gói hiện tại | Current plan |
| `admin_new_accounts_empty` | Không có tài khoản mới | No new accounts |
| `admin_new_accounts_count_label` | {n} tài khoản mới chưa xem | {n} new accounts not reviewed |
| `admin_new_accounts_marked` | Đã đánh dấu đã xem | Marked as seen |

Nếu nhãn nút "Đặt gói"/"Đặt dùng thử" đã có key sẵn ở màn Tài khoản (sau P) thì dùng lại key đó, ghi Ruling (test theo đúng chữ hiển thị).

Tạo `src/components/admin/NewAccounts.tsx`:
```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { planLabel } from "@/lib/plans"
import { SOURCE_KEY, dateTimeVn } from "./admin-format"
import { SetPlanDialog } from "./SetPlanDialog"
import { TrialDaysDialog } from "./TrialDaysDialog"

type OverviewUser = RouterOutputs["admin"]["overview"]["users"][number]
type Row = RouterOutputs["admin"]["newAccounts"]["items"][number]

// Báo tài khoản mới, không chặn sử dụng (spec K K14). Dialog dùng lại dòng user của admin.overview (spec K R3).
export function NewAccounts({ users }: { users: OverviewUser[] }) {
  const { t } = useTranslation()
  const query = trpc.admin.newAccounts.useQuery()
  const mark = trpc.admin.markAccountsSeen.useMutation({
    onSuccess: () => toast.success(t("admin_new_accounts_marked")),
    onError: (e) => toast.error(e.message),
  })
  const [planFor, setPlanFor] = useState<OverviewUser | null>(null)
  const [trialFor, setTrialFor] = useState<OverviewUser | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const total = query.data?.total ?? 0
  const userOf = (r: Row) => users.find((u) => u.id === r.id) ?? null
  const planText = (r: Row) => `${planLabel(r.plan)} · ${t(SOURCE_KEY[r.source])}`

  const actions = (r: Row) => {
    const u = userOf(r)
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-11 md:h-9" onClick={() => mark.mutate({ userIds: [r.id] })} disabled={mark.isPending}>
          {t("admin_new_accounts_seen")}
        </Button>
        <Button size="sm" variant="outline" className="h-11 md:h-9" disabled={!u} onClick={() => u && setPlanFor(u)}>
          {t("admin_new_accounts_set_plan")}
        </Button>
        <Button size="sm" variant="outline" className="h-11 md:h-9" disabled={!u} onClick={() => u && setTrialFor(u)}>
          {t("admin_new_accounts_set_trial")}
        </Button>
      </div>
    )
  }

  const columns: Column<Row>[] = [
    { header: t("username"), cell: (r) => <span className="font-medium">{r.username}</span> },
    { header: t("full_name"), cell: (r) => r.fullName ?? "-" },
    { header: t("admin_new_accounts_registered"), cell: (r) => dateTimeVn(String(r.createdAt)) },
    { header: t("admin_new_accounts_current_plan"), cell: planText },
    { header: "", cell: actions },
  ]

  return (
    <section data-testid="new-accounts" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {t("admin_new_accounts")} {total > 0 && <span className="text-primary">({total})</span>}
          </h2>
          <p className="text-xs text-slate-500">{t("admin_new_accounts_hint")}</p>
        </div>
        {total > 0 && (
          <Button
            variant="outline"
            className="h-11 md:h-10"
            disabled={mark.isPending}
            onClick={() => (total > 1 ? setConfirmAll(true) : mark.mutate({ all: true }))}
          >
            {t("admin_new_accounts_seen_all")}
          </Button>
        )}
      </div>
      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.items ?? []}
        getKey={(r) => r.id}
        columns={columns}
        emptyText={t("admin_new_accounts_empty")}
        renderCard={(r) => (
          <div data-testid="new-account-card" className="space-y-2 rounded-lg border bg-white p-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{r.username}</p>
              <p className="text-slate-500">{r.fullName ?? "-"}</p>
            </div>
            <p className="text-xs text-slate-500">
              {t("admin_new_accounts_registered")}: {dateTimeVn(String(r.createdAt))} · {planText(r)}
            </p>
            {actions(r)}
          </div>
        )}
      />

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_new_accounts_seen_all_confirm").replace("{n}", String(total))}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-10">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction className="h-11 md:h-10" onClick={() => mark.mutate({ all: true })}>
              {t("admin_new_accounts_seen_all")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {planFor && <SetPlanDialog key={planFor.id} user={planFor} onClose={() => setPlanFor(null)} />}
      {trialFor && <TrialDaysDialog key={trialFor.id} user={trialFor} onClose={() => setTrialFor(null)} />}
    </section>
  )
}
```
Kiểm key `username`, `full_name`, `cancel`, `load_error`, `retry` có trong `vi.json` (grep); thiếu → dùng key đúng tên như `AdminAccounts.tsx`, ghi Ruling. `SOURCE_KEY` phải có đủ `trial|paid|free`.

`AdminPendingOrders.tsx` (đối chiếu sau P): ngay trước thẻ đóng của khối gốc, sau danh sách đơn chờ: `<NewAccounts users={query.data?.users ?? []} />` (import `./NewAccounts`). Không đổi phần đơn chờ.

`AdminSidebar.tsx` (sau P, đang dùng `trpc.admin.pendingCount.useQuery()`): cạnh pill số đơn chờ ở mục `/admin/orders`, thêm:
```tsx
{item.href === "/admin/orders" && newAccounts > 0 && (
  <span
    data-testid="admin-new-accounts-count"
    aria-label={t("admin_new_accounts_count_label").replace("{n}", String(newAccounts))}
    className="ml-1 rounded-full border border-primary px-1.5 text-xs font-semibold text-primary"
  >
    {newAccounts}
  </span>
)}
```
với `const newAccounts = pending.data?.newAccounts ?? 0` (tên biến query theo code P).

`AdminTabBar.tsx` (sau P): trong `Link` của tab `/admin/orders`, góc icon đối diện chấm số của P:
```tsx
{item.href === "/admin/orders" && newAccounts > 0 && (
  <span data-testid="admin-tab-new-dot" className="absolute left-[calc(50%-14px)] top-2 size-2 rounded-full bg-teal-500">
    <span className="sr-only">{t("admin_new_accounts_count_label").replace("{n}", String(newAccounts))}</span>
  </span>
)}
```
(vị trí tuyệt đối chỉnh theo cách P đặt chấm số; không đè lên nhau.)

Run: `pnpm test tests/unit/components/NewAccounts.test.tsx` → PASS (3 test). `pnpm test tests/unit/components/AdminNav.test.tsx` → PASS. `pnpm test tests/unit/theme-legacy-colors.test.ts` → PASS. Chạy lại unit test của `AdminPendingOrders` nếu P có (grep) → PASS; nếu nó mock `trpc` không có `newAccounts` → thêm vào mock, ghi Ruling.

- [ ] **Step 6: E2E `tests/e2e/admin-new-accounts.spec.ts`**

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const PREFIX = 'k_new_';
const PASSWORD = 'matkhau-e2e-123';

async function newPage(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  return page;
}
async function loginAdmin(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const page = await newPage(browser, viewport);
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin_test');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/overview$/);
  return page;
}
async function registerViaForm(browser: Browser, username: string) {
  const page = await newPage(browser, DESKTOP);
  await page.goto('/register');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="fullName"]', 'GV ' + username);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login/);
  await page.context().close();
}
async function cleanup() {
  const ids = (await db.user.findMany({ where: { username: { startsWith: PREFIX } }, select: { id: true } })).map((u) => u.id);
  if (ids.length === 0) return;
  await db.planOrder.deleteMany({ where: { userId: { in: ids } } });
  await db.trialDayChange.deleteMany({ where: { userId: { in: ids } } });
  await db.subject.deleteMany({ where: { userId: { in: ids } } });
  await db.classUpgradeLog.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

const stamp = Date.now().toString().slice(-6);
const U1 = `${PREFIX}${stamp}a`;
const U2 = `${PREFIX}${stamp}b`;

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
});
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test('desktop: đăng ký → admin thấy ở Chờ xác nhận (pill sidebar) → Đã xem; tài khoản 2 → Đặt dùng thử → biến mất', async ({ browser }) => {
  await registerViaForm(browser, U1);
  await registerViaForm(browser, U2);
  const admin = await loginAdmin(browser, DESKTOP);
  await expect(admin.locator('aside').getByTestId('admin-new-accounts-count')).toBeVisible();
  await admin.goto('/admin/orders');
  const section = admin.getByTestId('new-accounts');
  const row1 = section.getByRole('row', { name: new RegExp(U1) });
  await expect(row1).toContainText('GV ' + U1);
  await row1.getByRole('button', { name: 'Đã xem' }).click();
  await expect(section.getByRole('row', { name: new RegExp(U1) })).toHaveCount(0);

  const row2 = section.getByRole('row', { name: new RegExp(U2) });
  await row2.getByRole('button', { name: 'Đặt dùng thử' }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').first().fill('30');
  await dialog.getByRole('button', { name: /Lưu/ }).click();
  await expect(section.getByRole('row', { name: new RegExp(U2) })).toHaveCount(0);
  await admin.context().close();
});

test('390px: thẻ new-account-card, nút ≥44px, chấm ở tab bar, Đã xem', async ({ browser }) => {
  const u3 = `${PREFIX}${stamp}c`;
  await registerViaForm(browser, u3);
  const admin = await loginAdmin(browser, MOBILE);
  await expect(admin.getByTestId('admin-tab-new-dot')).toBeAttached();
  await admin.goto('/admin/orders');
  const card = admin.getByTestId('new-account-card').filter({ hasText: u3 });
  await expect(card).toBeVisible();
  for (const name of ['Đã xem', 'Đặt gói', 'Đặt dùng thử']) {
    expect((await card.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await card.getByRole('button', { name: 'Đã xem' }).click();
  await expect(admin.getByTestId('new-account-card').filter({ hasText: u3 })).toHaveCount(0);
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await admin.context().close();
});
```
Ghi chú: DB test có tài khoản seed chưa xem (Global Constraints) nên không kiểm số tuyệt đối. Ô nhập / nút Lưu của `TrialDaysDialog` theo code thật (label, tên nút) — chỉnh selector, ghi Ruling; dialog có animation → chờ `getAnimations()` trước khi đo. Nếu `/register` bị giới hạn tần suất khi chạy nhiều lượt → tạo user bằng Prisma cho tài khoản 2, 3, ghi Ruling.

- [ ] **Step 7: Chạy e2e**

```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin-new-accounts.spec.ts
pnpm exec playwright test tests/e2e/admin.spec.ts
pnpm exec playwright test tests/e2e/admin-overview.spec.ts
```
Expected: tất cả passed. `admin.spec.ts` đỏ vì selector ở `/admin/orders` bắt nhầm bảng "Tài khoản mới" (vd `getByRole('row')`, nút "Xác nhận") → phân vùng selector về khối đơn chờ, ghi Ruling.

- [ ] **Step 8: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit
pnpm lint
git add src/server/services/new-accounts.service.ts src/lib/schemas/plan.ts src/server/trpc/routers/admin.ts src/server/services/plan-admin.service.ts src/server/services/trial.service.ts src/components/admin/NewAccounts.tsx src/components/admin/AdminPendingOrders.tsx src/components/admin/AdminSidebar.tsx src/components/admin/AdminTabBar.tsx src/language/vi.json src/language/en.json tests/integration/new-accounts.test.ts tests/unit/components/NewAccounts.test.tsx tests/unit/components/AdminNav.test.tsx tests/unit/schemas/plan.schema.test.ts tests/e2e/admin-new-accounts.spec.ts
git status --short
git commit -m "feat(k): báo tài khoản mới ở màn Chờ xác nhận (admin_seen_at, Đã xem / Đặt gói / Đặt dùng thử, pill sidebar, chấm tab bar)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
Expected: `git status --short` còn file đã sửa của task (file chứa `getPendingCount` nếu khác `plan-admin.service.ts`, test của P vừa đổi `toMatchObject`, `tests/e2e/admin.spec.ts` nếu phải phân vùng selector) → `git add` thêm đúng các file đó rồi commit.

---

### Task 6: Màn Doanh thu `/admin/revenue` (bộ lọc, tổng, biểu đồ, bảng) + nav 6 mục + e2e

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" mục 3, 4; spec mục 4 nhóm C (C7–C11), 8.3, 9, 10 (UI + e2e Doanh thu); `src/lib/revenue.ts` (Task 2); `src/components/admin/BarChart.tsx`, `AdminOverview.tsx` (Task 4, kiểu radiogroup/thẻ); `src/components/admin/AdminOrderHistory.tsx`; `src/components/ui/select.tsx`; `src/components/admin/admin-nav.ts`, `AdminTabBar.tsx`; `tests/unit/components/AdminNav.test.tsx`; `tests/e2e/admin-overview.spec.ts` (Task 4, `loginAs`).

**Files:**
- Modify: `src/components/admin/admin-nav.ts`, `AdminTabBar.tsx`, `admin-format.ts`
- Create: `src/components/admin/AdminRevenue.tsx`, `src/app/(admin)/admin/revenue/page.tsx`
- Modify: `src/language/vi.json`, `en.json`
- Test (Mới): `tests/unit/components/AdminRevenue.test.tsx`, `tests/e2e/admin-revenue.spec.ts`
- Test (Sửa): `tests/unit/components/AdminNav.test.tsx`, `tests/e2e/admin*.spec.ts` (số tab 5 → 6, danh sách 404)

**Interfaces:**
- Consumes: `trpc.admin.revenue.useQuery(range, { enabled })` (Task 2); `filterToRange`, `rangeError`, `monthIndex`, `REVENUE_FIRST_YEAR`, `REVENUE_KINDS`, `buildRevenueReport` (test), `type RevenueBucket`, `type RevenueFilter`, `type RevenueKind`, `type RevenueMonth`, `type YearMonth` (`@/lib/revenue`); `BarChart` (Task 4); `vnDateParts`, `formatCurrency`, `cn` (`@/lib/utils`).
- Produces: `fillMonth(template: string, ym: { year: number; month: number }): string` trong `admin-format.ts`; `AdminRevenue()`; test id `revenue-filter`, `revenue-error`, `revenue-summary`, `revenue-total`, `revenue-kind-{new|renew|upgrade}`, `revenue-plan-{plus|pro}`, `revenue-period-{month|year|2year}`, `revenue-chart`, `revenue-month-card`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Test (RED)**

`tests/unit/components/AdminNav.test.tsx`: thêm `"/admin/revenue"` **cuối** mảng href sidebar, `["/admin/revenue", "Doanh thu"]` cuối mảng tab bar; `grid-cols-5` → `grid-cols-6`; "5 mục" → "6 mục".

Tạo `tests/unit/components/AdminRevenue.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminRevenue } from "@/components/admin/AdminRevenue"
import { buildRevenueReport, type RevenueOrder, type RevenueReport } from "@/lib/revenue"

type Call = { input: { from: { year: number; month: number }; to: { year: number; month: number } }; opts?: { enabled?: boolean } }
const h = vi.hoisted(() => ({ calls: [] as Call[], data: undefined as unknown }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      revenue: {
        useQuery: (input: Call["input"], opts?: Call["opts"]) => {
          h.calls.push({ input, opts })
          return { data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }
        },
      },
    },
  },
}))

const o = (p: Partial<RevenueOrder> & { id: number; decidedAt: string }): RevenueOrder => ({
  userId: 1, plan: "plus", period: "month", amount: 49000, creditDays: 0, ...p, decidedAt: new Date(p.decidedAt),
})
const REPORT: RevenueReport = buildRevenueReport(
  [
    o({ id: 1, decidedAt: "2026-03-10T03:00:00Z" }),
    o({ id: 2, decidedAt: "2026-04-15T03:00:00Z", period: "year", amount: 490000 }),
    o({ id: 3, decidedAt: "2026-05-20T03:00:00Z", plan: "pro", period: "year", amount: 990000, creditDays: 120 }),
    o({ id: 4, decidedAt: "2026-06-30T16:30:00Z", plan: "pro", period: "month", amount: 99000 }),
  ],
  { year: 2026, month: 1 },
  { year: 2026, month: 12 }
)

function renderRevenue() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminRevenue />
    </LanguageProvider>
  )
}
const last = () => h.calls[h.calls.length - 1]

beforeEach(() => {
  h.calls = []
  h.data = undefined
  vi.useFakeTimers({ toFake: ["Date"] })
  // 12:00 ngày 15/10/2026 giờ VN.
  vi.setSystemTime(new Date("2026-10-15T05:00:00.000Z"))
})
afterEach(() => {
  vi.useRealTimers()
})

describe("AdminRevenue — bộ lọc (spec K 8.3)", () => {
  it("mặc định: Năm hiện tại giờ VN → T1..T12/2026, query bật", () => {
    renderRevenue()
    expect(screen.getByRole("radio", { name: "Năm" }).getAttribute("aria-checked")).toBe("true")
    expect(last().input).toEqual({ from: { year: 2026, month: 1 }, to: { year: 2026, month: 12 } })
    expect(last().opts?.enabled).toBe(true)
  })
  it("bấm Tháng → tháng hiện tại; bấm Khoảng → T1 đến tháng hiện tại", () => {
    renderRevenue()
    fireEvent.click(screen.getByRole("radio", { name: "Tháng" }))
    expect(last().input).toEqual({ from: { year: 2026, month: 10 }, to: { year: 2026, month: 10 } })
    fireEvent.click(screen.getByRole("radio", { name: "Khoảng" }))
    expect(last().input).toEqual({ from: { year: 2026, month: 1 }, to: { year: 2026, month: 10 } })
  })
  it("nút chế độ cao ≥44px trên mobile (class h-11)", () => {
    renderRevenue()
    for (const name of ["Tháng", "Khoảng", "Năm"]) expect(screen.getByRole("radio", { name }).className).toContain("h-11")
  })
})

describe("AdminRevenue — số liệu", () => {
  it("tổng, 3 nhóm loại đơn, theo gói, theo kỳ", () => {
    h.data = REPORT
    renderRevenue()
    const s = screen.getByTestId("revenue-summary")
    expect(within(s).getByTestId("revenue-total").textContent).toContain("1.628.000 đ")
    expect(within(s).getByTestId("revenue-total").textContent).toContain("4 đơn")
    expect(within(s).getByTestId("revenue-kind-new").textContent).toContain("49.000 đ")
    expect(within(s).getByTestId("revenue-kind-renew").textContent).toContain("589.000 đ")
    expect(within(s).getByTestId("revenue-kind-upgrade").textContent).toContain("990.000 đ")
    expect(within(s).getByTestId("revenue-plan-plus").textContent).toContain("539.000 đ")
    expect(within(s).getByTestId("revenue-plan-pro").textContent).toContain("1.089.000 đ")
    expect(within(s).getByTestId("revenue-period-year").textContent).toContain("1.480.000 đ")
    expect(within(s).getByTestId("revenue-period-2year").textContent).toContain("0 đ")
  })
  it("bảng từng tháng: đủ 12 thẻ, thẻ tháng 6 có tổng 99.000", () => {
    h.data = REPORT
    renderRevenue()
    const cards = screen.getAllByTestId("revenue-month-card")
    expect(cards).toHaveLength(12)
    expect(cards[5].textContent).toContain("Tháng 6/2026")
    expect(cards[5].textContent).toContain("99.000 đ")
  })
  it("chế độ Năm có biểu đồ 12 cột (aria-label tiền VN); chế độ Tháng (1 tháng) không có biểu đồ", () => {
    h.data = REPORT
    renderRevenue()
    const chart = screen.getByTestId("revenue-chart")
    expect(within(chart).getAllByTestId("chart-bar")).toHaveLength(12)
    expect(within(chart).getByRole("img", { name: "Tháng 5/2026: 990.000 đ" })).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "Tháng" }))
    expect(screen.queryByTestId("revenue-chart")).toBeNull()
  })
})
```

Run: `pnpm test tests/unit/components/AdminNav.test.tsx` → Expected: FAIL.
Run: `pnpm test tests/unit/components/AdminRevenue.test.tsx` → Expected: FAIL (không resolve component).

- [ ] **Step 3: i18n nhóm Doanh thu**

Thêm vào `vi.json` và `en.json` (cùng vị trí, sau nhóm Tổng quan):

| Key | vi | en |
|---|---|---|
| `admin_revenue` | Doanh thu | Revenue |
| `admin_tab_revenue` | Doanh thu | Revenue |
| `admin_revenue_total` | Tổng doanh thu | Total revenue |
| `admin_revenue_orders` | {n} đơn | {n} orders |
| `admin_revenue_new` | Đơn mới | New |
| `admin_revenue_renew` | Gia hạn | Renewals |
| `admin_revenue_upgrade` | Nâng cấp | Upgrades |
| `admin_revenue_by_plan` | Theo gói | By plan |
| `admin_revenue_by_period` | Theo kỳ | By period |
| `admin_revenue_chart` | Doanh thu theo tháng | Revenue by month |
| `admin_revenue_by_month` | Chi tiết từng tháng | Monthly breakdown |
| `admin_revenue_month_label` | Tháng {m}/{y} | {m}/{y} |
| `admin_revenue_col_month` | Tháng | Month |
| `admin_revenue_col_count` | Số đơn | Orders |
| `admin_revenue_from_month` | Từ tháng | From month |
| `admin_revenue_from_year` | Từ năm | From year |
| `admin_revenue_to_month` | Đến tháng | To month |
| `admin_revenue_to_year` | Đến năm | To year |
| `admin_revenue_pick_month` | Chọn tháng | Month |
| `admin_revenue_pick_year` | Chọn năm | Year |
| `admin_revenue_empty` | Chưa có doanh thu trong khoảng này | No revenue in this period |
| `admin_revenue_err_order` | Tháng kết thúc phải sau tháng bắt đầu | End month must be after start month |
| `admin_revenue_err_long` | Tối đa 36 tháng | Up to 36 months |
| `admin_revenue_note` | Chỉ tính đơn đã duyệt, theo ngày duyệt. Không tính gói admin đặt tay. | Approved orders only, by approval date. Plans set by admin are excluded. |

Key có sẵn dùng lại (grep kiểm tồn tại): `month`, `year`, `range`, `report_type`, `plan_period_1m`, `plan_period_12m`, `plan_period_24m`, `load_error`, `retry`.

- [ ] **Step 4: Nav + `fillMonth` + page**

`admin-nav.ts`: import thêm `ChartColumn`; thêm **cuối** `ADMIN_NAV_ITEMS`:
```ts
  { href: "/admin/revenue", labelKey: "admin_revenue", shortKey: "admin_tab_revenue", icon: ChartColumn },
```
`AdminTabBar.tsx`: `grid-cols-5` → `grid-cols-6`.

`admin-format.ts` thêm cuối:
```ts
export function fillMonth(template: string, { year, month }: { year: number; month: number }): string {
  return template.replace("{m}", String(month)).replace("{y}", String(year))
}
```

Tạo `src/app/(admin)/admin/revenue/page.tsx`:
```tsx
import { AdminRevenue } from "@/components/admin/AdminRevenue"

export default function AdminRevenuePage() {
  return <AdminRevenue />
}
```

- [ ] **Step 5: `src/components/admin/AdminRevenue.tsx`**

```tsx
"use client"

import { useState } from "react"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { trpc } from "@/lib/trpc"
import {
  REVENUE_FIRST_YEAR,
  REVENUE_KINDS,
  filterToRange,
  monthIndex,
  rangeError,
  type RevenueBucket,
  type RevenueFilter,
  type RevenueMonth,
  type YearMonth,
} from "@/lib/revenue"
import { cn, formatCurrency, vnDateParts } from "@/lib/utils"
import { fillMonth } from "./admin-format"
import { BarChart } from "./BarChart"

type Mode = RevenueFilter["mode"]
const MODES: Mode[] = ["month", "range", "year"]
const MODE_KEY = { month: "month", range: "range", year: "year" } as const
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const KIND_KEY = { new: "admin_revenue_new", renew: "admin_revenue_renew", upgrade: "admin_revenue_upgrade" } as const
const PERIOD_KEY = { month: "plan_period_1m", year: "plan_period_12m", "2year": "plan_period_24m" } as const
// Thứ tự trên → dưới trong cột chồng: nâng cấp, gia hạn, đơn mới (đáy) (spec K C9).
const SEGMENTS = [
  { kind: "upgrade", className: "bg-amber-400" },
  { kind: "renew", className: "bg-teal-300" },
  { kind: "new", className: "bg-primary" },
] as const

function Picker({ label, value, options, render, onChange }: {
  label: string
  value: number
  options: number[]
  render: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger aria-label={label} className="h-11 border-slate-200 md:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-slate-200 bg-white">
        {options.map((v) => (
          <SelectItem key={v} value={String(v)}>
            {render(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AdminRevenue() {
  const { t } = useTranslation()
  const now = vnDateParts(new Date())
  const years = Array.from({ length: Math.max(1, now.year - REVENUE_FIRST_YEAR + 1) }, (_, i) => REVENUE_FIRST_YEAR + i)
  const [mode, setMode] = useState<Mode>("year")
  // from dùng chung cho chế độ Tháng (tháng đang chọn) và Năm (from.year).
  const [from, setFrom] = useState<YearMonth>({ year: now.year, month: now.month })
  const [to, setTo] = useState<YearMonth>({ year: now.year, month: now.month })

  const filter: RevenueFilter =
    mode === "month" ? { mode, ...from } : mode === "year" ? { mode, year: from.year } : { mode, from, to }
  const range = filterToRange(filter)
  const error = rangeError(range.from, range.to)
  const query = trpc.admin.revenue.useQuery(range, { enabled: error === null })
  const data = error ? undefined : query.data

  const pickMode = (m: Mode) => {
    if (m === "range" && mode !== "range") {
      setFrom({ year: from.year, month: 1 })
      setTo({ year: from.year, month: from.year === now.year ? now.month : 12 })
    }
    setMode(m)
  }
  const monthText = (m: number) => `${t("month")} ${m}`
  const money = (b: RevenueBucket) => formatCurrency(b.amount)
  const orders = (b: RevenueBucket) => t("admin_revenue_orders").replace("{n}", String(b.count))
  const monthLabel = (m: YearMonth) => fillMonth(t("admin_revenue_month_label"), m)

  const columns: Column<RevenueMonth>[] = [
    { header: t("admin_revenue_col_month"), cell: (m) => `${String(m.month).padStart(2, "0")}/${m.year}` },
    { header: t("admin_revenue_col_count"), cell: (m) => m.total.count, className: "text-right" },
    ...REVENUE_KINDS.map((k) => ({
      header: t(KIND_KEY[k]),
      cell: (m: RevenueMonth) => money(m.byKind[k]),
      className: "whitespace-nowrap text-right",
    })),
    { header: "Plus", cell: (m) => money(m.byPlan.plus), className: "whitespace-nowrap text-right" },
    { header: "Pro", cell: (m) => money(m.byPlan.pro), className: "whitespace-nowrap text-right" },
    { header: t("admin_revenue_total"), cell: (m) => <span className="font-semibold">{money(m.total)}</span>, className: "whitespace-nowrap text-right" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_revenue")} />

      <div data-testid="revenue-filter" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div role="radiogroup" aria-label={t("report_type")} className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 md:max-w-sm">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => pickMode(m)}
              className={cn(
                "h-11 rounded-md text-sm font-semibold md:h-10",
                mode === m ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t(MODE_KEY[m])}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 md:max-w-xl md:grid-cols-4">
          {mode !== "year" && (
            <Picker
              label={mode === "range" ? t("admin_revenue_from_month") : t("admin_revenue_pick_month")}
              value={from.month}
              options={MONTHS}
              render={monthText}
              onChange={(month) => setFrom({ ...from, month })}
            />
          )}
          <Picker
            label={mode === "range" ? t("admin_revenue_from_year") : t("admin_revenue_pick_year")}
            value={from.year}
            options={years}
            render={String}
            onChange={(year) => setFrom({ ...from, year })}
          />
          {mode === "range" && (
            <>
              <Picker label={t("admin_revenue_to_month")} value={to.month} options={MONTHS} render={monthText} onChange={(month) => setTo({ ...to, month })} />
              <Picker label={t("admin_revenue_to_year")} value={to.year} options={years} render={String} onChange={(year) => setTo({ ...to, year })} />
            </>
          )}
        </div>
        {error && (
          <p data-testid="revenue-error" className="text-sm text-destructive">
            {t(error === "order" ? "admin_revenue_err_order" : "admin_revenue_err_long")}
          </p>
        )}
        <p className="text-xs text-slate-500">{t("admin_revenue_note")}</p>
      </div>

      {!error && (
        <>
          {data && (
            <div data-testid="revenue-summary" className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div data-testid="revenue-total" className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{t("admin_revenue_total")}</p>
                  <p className="text-xl font-bold text-primary">{money(data.summary.total)}</p>
                  <p className="text-xs text-slate-500">{orders(data.summary.total)}</p>
                </div>
                {REVENUE_KINDS.map((k) => (
                  <div key={k} data-testid={`revenue-kind-${k}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">{t(KIND_KEY[k])}</p>
                    <p className="text-lg font-semibold text-foreground">{money(data.summary.byKind[k])}</p>
                    <p className="text-xs text-slate-500">{orders(data.summary.byKind[k])}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <p className="mb-2 font-semibold">{t("admin_revenue_by_plan")}</p>
                  {(["plus", "pro"] as const).map((p) => (
                    <p key={p} data-testid={`revenue-plan-${p}`} className="flex justify-between gap-2 py-1">
                      <span>{p === "plus" ? "Plus" : "Pro"} · {orders(data.summary.byPlan[p])}</span>
                      <span className="font-medium">{money(data.summary.byPlan[p])}</span>
                    </p>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <p className="mb-2 font-semibold">{t("admin_revenue_by_period")}</p>
                  {(["month", "year", "2year"] as const).map((p) => (
                    <p key={p} data-testid={`revenue-period-${p}`} className="flex justify-between gap-2 py-1">
                      <span>{t(PERIOD_KEY[p])} · {orders(data.summary.byPeriod[p])}</span>
                      <span className="font-medium">{money(data.summary.byPeriod[p])}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Khoảng 1 tháng thì 1 cột không nói gì thêm so với số tổng (spec K C10). */}
          {data && monthIndex(range.from) !== monthIndex(range.to) && (
            <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">{t("admin_revenue_chart")}</h2>
              <BarChart
                testId="revenue-chart"
                layout="stacked"
                formatMax={formatCurrency}
                emptyText={t("admin_revenue_empty")}
                legend={[...SEGMENTS].reverse().map((s) => ({ key: s.kind, label: t(KIND_KEY[s.kind]), className: s.className }))}
                bars={data.months.map((m) => ({
                  key: `${m.year}-${String(m.month).padStart(2, "0")}`,
                  label: `${m.month}/${String(m.year).slice(2)}`,
                  ariaLabel: `${monthLabel(m)}: ${money(m.total)}`,
                  segments: SEGMENTS.map((s) => ({ key: s.kind, value: m.byKind[s.kind].amount, className: s.className })),
                }))}
              />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("admin_revenue_by_month")}</h2>
            <ResponsiveList
              isLoading={query.isPending}
              isError={query.isError}
              onRetry={() => query.refetch()}
              errorText={t("load_error")}
              retryText={t("retry")}
              items={data?.months ?? []}
              getKey={(m) => `${m.year}-${m.month}`}
              columns={columns}
              emptyText={t("admin_revenue_empty")}
              renderCard={(m) => (
                <div data-testid="revenue-month-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{monthLabel(m)}</p>
                    <p className="font-semibold text-foreground">{money(m.total)}</p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {t("admin_revenue_new")} {money(m.byKind.new)} · {t("admin_revenue_renew")} {money(m.byKind.renew)} · {t("admin_revenue_upgrade")} {money(m.byKind.upgrade)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Plus {money(m.byPlan.plus)} · Pro {money(m.byPlan.pro)} · {orders(m.total)}
                  </p>
                </div>
              )}
            />
          </section>
        </>
      )}
    </div>
  )
}
```
Nếu `formatCurrency` không gán được cho `(n: number) => string` (kiểu tham số `number | undefined | null`) → dùng `(n) => formatCurrency(n)`, ghi Ruling. Nếu `vnDateParts` không ở `@/lib/utils` sau P → import đúng chỗ, ghi Ruling.

- [ ] **Step 6: Chạy unit test, xác nhận pass**

Chạy lần lượt: `pnpm test tests/unit/components/AdminRevenue.test.tsx` (Expected: PASS 6 test), `pnpm test tests/unit/components/AdminNav.test.tsx`, `pnpm test tests/unit/next15-contract.test.ts`, `pnpm test tests/unit/theme-legacy-colors.test.ts` (Expected: PASS).

- [ ] **Step 7: Sửa e2e có sẵn (số tab, danh sách 404)**

Mọi `tests/e2e/admin*.spec.ts` (kể cả `admin-overview.spec.ts` của Task 4): `toHaveCount(5)` của tab bar → `toHaveCount(6)`, tên test "5 tab" → "6 tab". `admin.spec.ts`: danh sách path giáo viên phải 404 thêm `'/admin/revenue'`.

- [ ] **Step 8: E2E `tests/e2e/admin-revenue.spec.ts`**

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function loginAs(browser: Browser, username: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/overview$/);
  return page;
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
}

// T1–T6/2026 trước ngày ra mắt gói: chỉ có đơn test tự seed (Điều chỉnh so với spec mục 3).
async function seedOrders() {
  const userId = (await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } })).id;
  const rows = [
    { plan: 'plus', period: 'month', amount: 49000, status: 'approved', source: 'user', creditDays: 0, decidedAt: '2026-03-10T03:00:00Z' },
    { plan: 'plus', period: 'year', amount: 490000, status: 'approved', source: 'user', creditDays: 0, decidedAt: '2026-04-15T03:00:00Z' },
    { plan: 'pro', period: 'year', amount: 990000, status: 'approved', source: 'user', creditDays: 120, decidedAt: '2026-05-20T03:00:00Z' },
    // 23:30 ngày 30/6 giờ VN → tháng 6.
    { plan: 'pro', period: 'month', amount: 99000, status: 'approved', source: 'user', creditDays: 0, decidedAt: '2026-06-30T16:30:00Z' },
    { plan: 'pro', period: 'month', amount: 99000, status: 'rejected', source: 'user', creditDays: 0, decidedAt: '2026-05-21T03:00:00Z' },
    { plan: 'pro', period: null, amount: 0, status: 'approved', source: 'admin', creditDays: 0, decidedAt: '2026-04-01T03:00:00Z' },
  ];
  for (const r of rows) {
    await db.planOrder.create({ data: { userId, ...r, decidedAt: new Date(r.decidedAt), decidedBy: 'admin_test' } });
  }
}

async function pick(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetStd();
  await seedOrders();
});

test.afterAll(async () => {
  await resetStd();
  await db.$disconnect();
});

test('desktop: sidebar → Doanh thu; Năm/Khoảng/Tháng đúng số, biểu đồ, lỗi khoảng ngược', async ({ browser }) => {
  const page = await loginAs(browser, 'admin_test', DESKTOP);
  await page.locator('aside').getByRole('link', { name: 'Doanh thu' }).click();
  await expect(page).toHaveURL(/\/admin\/revenue$/);

  await page.getByRole('radio', { name: 'Năm' }).click();
  await pick(page, 'Chọn năm', '2026');
  await expect(page.locator('tr', { hasText: '03/2026' })).toContainText('49.000 đ');
  await expect(page.locator('tr', { hasText: '04/2026' })).toContainText('490.000 đ');
  await expect(page.locator('tr', { hasText: '05/2026' })).toContainText('990.000 đ');
  await expect(page.locator('tr', { hasText: '06/2026' })).toContainText('99.000 đ');
  const chart = page.getByTestId('revenue-chart');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(12);

  await page.getByRole('radio', { name: 'Khoảng' }).click();
  await pick(page, 'Từ tháng', 'Tháng 1');
  await pick(page, 'Từ năm', '2026');
  await pick(page, 'Đến tháng', 'Tháng 6');
  await pick(page, 'Đến năm', '2026');
  const summary = page.getByTestId('revenue-summary');
  await expect(summary.getByTestId('revenue-total')).toContainText('1.628.000 đ');
  await expect(summary.getByTestId('revenue-total')).toContainText('4 đơn');
  await expect(summary.getByTestId('revenue-kind-new')).toContainText('49.000 đ');
  await expect(summary.getByTestId('revenue-kind-renew')).toContainText('589.000 đ');
  await expect(summary.getByTestId('revenue-kind-upgrade')).toContainText('990.000 đ');
  await expect(summary.getByTestId('revenue-plan-pro')).toContainText('1.089.000 đ');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(6);

  await pick(page, 'Từ tháng', 'Tháng 3');
  await pick(page, 'Đến tháng', 'Tháng 5');
  await expect(summary.getByTestId('revenue-total')).toContainText('1.529.000 đ');
  await expect(chart.getByTestId('chart-bar')).toHaveCount(3);

  await pick(page, 'Từ tháng', 'Tháng 5');
  await pick(page, 'Đến tháng', 'Tháng 3');
  await expect(page.getByTestId('revenue-error')).toHaveText('Tháng kết thúc phải sau tháng bắt đầu');
  await expect(page.getByTestId('revenue-summary')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Tháng' }).click();
  await pick(page, 'Chọn tháng', 'Tháng 6');
  await pick(page, 'Chọn năm', '2026');
  await expect(summary.getByTestId('revenue-total')).toContainText('99.000 đ');
  await expect(summary.getByTestId('revenue-kind-renew')).toContainText('99.000 đ');
  await expect(page.getByTestId('revenue-chart')).toHaveCount(0);
  await page.context().close();
});

test('390px: tab bar 6 tab ≥44px, không tràn ngang, nút/ô chọn ≥44px, bảng dạng thẻ', async ({ browser }) => {
  const page = await loginAs(browser, 'admin_test', MOBILE);
  const tabs = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(6);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await tabs.getByRole('link', { name: 'Doanh thu' }).click();
  await expect(page).toHaveURL(/\/admin\/revenue$/);

  await page.getByRole('radio', { name: 'Khoảng' }).click();
  await pick(page, 'Từ tháng', 'Tháng 1');
  await pick(page, 'Từ năm', '2026');
  await pick(page, 'Đến tháng', 'Tháng 6');
  await pick(page, 'Đến năm', '2026');
  await expect(page.getByTestId('revenue-total')).toContainText('1.628.000 đ');

  for (const name of ['Tháng', 'Khoảng', 'Năm']) {
    expect((await page.getByRole('radio', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  for (const combo of await page.getByRole('combobox').all()) {
    expect((await combo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const cards = page.getByTestId('revenue-month-card');
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(5)).toContainText('Tháng 6/2026');
  await expect(cards.nth(5)).toContainText('99.000 đ');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.context().close();
});
```

- [ ] **Step 9: Chạy e2e**

```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin-revenue.spec.ts
pnpm exec playwright test tests/e2e/admin-overview.spec.ts
pnpm exec playwright test tests/e2e/admin.spec.ts
pnpm exec playwright test tests/e2e/admin-prices.spec.ts
```
Expected: tất cả passed (cùng các `admin*.spec.ts` khác vừa sửa số tab).

- [ ] **Step 10: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit
pnpm lint
git add src/components/admin/admin-nav.ts src/components/admin/AdminTabBar.tsx src/components/admin/admin-format.ts src/components/admin/AdminRevenue.tsx "src/app/(admin)/admin/revenue/page.tsx" src/language/vi.json src/language/en.json tests/unit/components/AdminRevenue.test.tsx tests/unit/components/AdminNav.test.tsx tests/e2e/
git status --short
git commit -m "feat(k): màn Doanh thu /admin/revenue (lọc tháng/khoảng/năm, tổng, mới/gia hạn/nâng cấp, gói, kỳ, biểu đồ, bảng), nav 6 mục

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
Expected: `git status --short` trước commit chỉ có file của task.

---

### Task 7: Kiểm chứng cuối, nâng version 0.6.0, danh sách kiểm tra tay (không merge, không push)

**Đọc trước:** Global Constraints; spec mục 2, 11, 12, 13, 14; "Điều chỉnh so với spec"; `git log --oneline main..HEAD` (1 commit docs + 6 commit Task 1–6).

**Files:**
- Modify: `package.json` (chỉ dòng `"version"`)
- Chỉ sửa file của Task 1–6 nếu kiểm chứng phát hiện lỗi (mỗi sửa: test tái hiện → sửa → commit riêng `fix(k): …`, ghi vào báo cáo).

**Interfaces:**
- Consumes: toàn bộ Task 1–6.
- Produces: `package.json` `"version": "0.6.0"`; báo cáo cho người điều phối.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…`, `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Quét sót**

Run (Bash):
```bash
git diff --stat main..HEAD -- prisma/ tests/setup.ts package.json
git diff main..HEAD -- prisma/migrations | grep -E "^\+" | grep -iE "DROP|TRUNCATE|DELETE"
grep -rn '"/admin/orders"' src
grep -rn "indigo-\|violet-\|purple-" src/components/admin "src/app/(admin)"
grep -rnP "[—–]" src/lib/activity.ts src/lib/admin-stats.ts src/lib/revenue.ts src/server/services/activity.service.ts src/server/services/admin-stats.service.ts src/server/services/revenue.service.ts src/components/admin/BarChart.tsx src/components/admin/AdminOverview.tsx src/components/admin/AccountTrend.tsx src/components/admin/AdminRevenue.tsx src/components/admin/NewAccounts.tsx src/server/services/new-accounts.service.ts
git diff main..HEAD -- src/language | grep -P "^\+.*[—–]"
node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(JSON.stringify([a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k))]))"
grep -nE "^\s+(stats|accountTrend|revenue|newAccounts|markAccountsSeen):" src/server/trpc/routers/admin.ts
grep -rln "isDeleted\|is_deleted" src/server/services/admin-stats.service.ts src/server/services/new-accounts.service.ts
grep -n "isDeleted\|is_deleted" src/server/services/revenue.service.ts
grep -rn "searchParams\|params" "src/app/(admin)/admin/overview/page.tsx" "src/app/(admin)/admin/revenue/page.tsx"
grep -n "recharts\|chart.js\|\"d3" package.json
```
Expected: lệnh 1 chỉ có `prisma/schema.prisma` và 1 thư mục `*_add_user_activity` (không `tests/setup.ts`, chưa có `package.json`); lệnh 2 không in gì; lệnh 3 chỉ còn `admin-nav.ts`, `AdminSidebar.tsx` (và chỗ P dùng đúng nghĩa màn đơn chờ, đã ghi Ruling ở Task 4); lệnh 4–6 không in gì; lệnh 7 in `[[],[]]`; lệnh 8 in 5 dòng (có thể xuống dòng ở `markAccountsSeen`: kiểm dòng kế tiếp), đều `adminProcedure`; lệnh 9 in cả 2 file (lọc xóa mềm, tên thật theo Q); lệnh 10 không in gì (doanh thu KHÔNG lọc xóa mềm, K16); lệnh 11, 12 không in gì.

- [ ] **Step 3: Nâng version 0.6.0**

`package.json`: `"version": "0.5.0"` (Q) → `"version": "0.6.0"` (bất kể số sau Q là gì, miễn nhỏ hơn 0.6.0; lớn hơn hoặc bằng → DỪNG, báo người điều phối). Không sửa dòng nào khác.

- [ ] **Step 4: Toàn bộ unit + integration**

Run: `pnpm test` (~10–15 phút, không chạy song song lệnh test khác)
Expected: toàn bộ PASS, gồm `activity` (unit + integration), `user-activity-migration`, `session-validity`, `password-reset`, `revenue`, `admin-stats`, `new-accounts`, `plan.schema`, `admin` (unit + integration), `BarChart`, `AdminOverview`, `AccountTrend`, `NewAccounts`, `AdminRevenue`, `AdminNav`, `trial-days`, `auth-authorized`, `admin-redirect`, `AppHeader`, `theme-legacy-colors`, `next15-contract`, test phiên/version của N (`session-policy`, `auth-jwt`: nếu có test đọc version cố định thì cập nhật theo 0.6.0, ghi Ruling).

- [ ] **Step 5: E2E toàn bộ**

```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test
```
Expected: tất cả passed (`upgrade-class` có thể `skipped` nếu DB test đã nâng lớp năm nay — chấp nhận). File nào fail: chạy lại riêng file đó 1 lần để loại chập chờn; vẫn fail → sửa theo quy tắc ở mục Files, ghi vào báo cáo.

- [ ] **Step 6: Lint + tsc + build (DB test)**

Run (Bash):
```bash
pnpm lint
pnpm exec tsc --noEmit
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  pnpm exec next build
)
```
Expected: sạch; build thành công, danh sách route có `/admin/overview`, `/admin/revenue` cùng `/admin/orders`, `/admin/accounts`, `/admin/history`, `/admin/prices`. KHÔNG chạy `pnpm build` (có `prisma migrate deploy` lên `.env` production).

- [ ] **Step 7: Commit version**

```bash
git add package.json
git commit -m "chore(k): nâng version 0.6.0 (epoch 0.6, mọi người đăng nhập lại 1 lần khi K lên)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 8: Báo cáo cho người điều phối (không merge, không push)**

Gồm: kết quả Step 2–6, `git log --oneline main..HEAD`, mọi Ruling (kèm lý do), danh sách kiểm tra tay ở Step 9, và nhắc: **K có migration `add_user_activity` → trước khi merge người điều phối tạo backup Neon** (Neon console → project production → "Branch from current", tên kiểu `backup-before-K-overview-2026-09-xx`, ghi lại tên để rollback); 0.6.0 làm mọi người đăng nhập lại 1 lần (cơ chế N).

- [ ] **Step 9: Kiểm tra tay cho người dùng (sau khi merge + Vercel deploy; agent KHÔNG làm)**

1. **Backup trước merge:** đã có branch Neon `backup-before-K-overview-…`.
2. **Log build Vercel:** có `Applying migration ..._add_user_activity` và `All migrations have been successfully applied`; thấy `Resetting` / `rolled back` → rollback ngay (khôi phục từ branch backup). Không chạy lệnh DB tay lên prod.
3. **Tài khoản admin (người dùng tự đăng nhập, vd `hien_admin`):** bị yêu cầu đăng nhập lại 1 lần; sau đăng nhập vào `/admin/overview`. Sidebar 6 mục, tab bar mobile 6 tab không tràn, badge số đơn chờ (P) vẫn ở mục Đơn chờ. Thẻ Tổng tài khoản = số tài khoản ở màn Tài khoản & gói trừ admin; Chờ duyệt = badge; bấm thẻ Chờ duyệt về `/admin/orders`. Biểu đồ xu hướng có dòng "Lượt quay lại được ghi từ <ngày triển khai>"; đổi 7/14/30 ngày; cột hôm nay mờ.
4. **Tài khoản `qa_test` (id 4):** dùng app bình thường (vào vài trang) → vài phút sau admin tải lại Tổng quan: Active 24h tăng, cột hôm nay có "quay lại" (nếu `qa_test` không đăng ký hôm nay). `/admin/overview`, `/admin/revenue` với `qa_test` → 404 như các màn admin khác. Không tạo đơn trên tài khoản khác.
5. **Tài khoản mới:** ngay sau deploy danh sách "Tài khoản mới" ở `/admin/orders` **trống** (backfill coi tài khoản cũ là đã xem), sidebar không có pill tài khoản mới. Khi có người đăng ký thật: thấy dòng + pill số + chấm ở tab bar mobile + dòng phụ ở thẻ Chờ duyệt; bấm "Đã xem" thì biến mất. Không tự đăng ký tài khoản thử trên prod nếu người dùng chưa muốn (nếu thử: xóa mềm tài khoản đó qua thùng rác của Q sau khi kiểm).
6. **Xóa mềm:** tài khoản trong thùng rác (Q) không tính ở thẻ Tổng tài khoản; khôi phục thì tính lại. Doanh thu không đổi khi xóa/khôi phục tài khoản.
7. `/admin/revenue` mặc định Năm hiện tại; tổng năm 2026 bằng tổng tay các đơn **Đã duyệt** có tiền ở màn Lịch sử đơn (bỏ "Admin đặt" 0đ, đơn từ chối/hủy/hết hạn). Đổi Tháng / Khoảng / Năm thấy số và biểu đồ đổi; khoảng ngược thấy lỗi đỏ. Trên điện thoại bảng dạng thẻ, biểu đồ cuộn ngang trong khung.
8. **Rollback:** revert merge; cột/bảng thừa không gây hại (code cũ không đọc).
