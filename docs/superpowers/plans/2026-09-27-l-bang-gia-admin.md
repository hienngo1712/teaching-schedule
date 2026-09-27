# L — Màn Bảng giá cho admin (giá Plus/Pro đổi được, lưu lịch sử) + số ngày dùng thử cấu hình được — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin sửa giá tháng Plus/Pro ở `/admin/prices` (năm ×10, 2 năm ×20, xem trước, xác nhận, lịch sử append-only), giá có hiệu lực ngay cho đơn tạo mới (đơn chờ/đã duyệt giữ nguyên, quy đổi Plus→Pro theo `order.amount`); giáo viên đang mở popup không bao giờ nhận QR khác giá đang thấy; số ngày dùng thử Pro mặc định sửa được (chỉ áp tài khoản đăng ký sau) và admin đặt riêng số ngày dùng thử cho từng tài khoản (tính từ ngày tạo tài khoản).

**Architecture:** 1 migration thêm 2 bảng append-only `plan_price_changes` (giá hiện hành = dòng mới nhất của gói) và `trial_day_changes` (`user_id NULL` = mặc định cho tài khoản mới, có `user_id` = lần admin đặt riêng), có seed 49.000/99.000/60. Service mới `plan-price.service.ts` (đọc giá, lịch sử, `updatePrices` có khóa advisory 2 tham số + `expected`) và `trial.service.ts`. `createOrder` đọc giá bằng `tx` sau khóa `userId`, so `expectedAmount` trước khi hủy đơn chờ cũ. `plan.me` trả thêm `prices` để `PlanCompare`/`PlanPurchaseDialog` hiện đúng giá server. UI admin thêm mục thứ 4 "Bảng giá" (form giá + form dùng thử mặc định) và nút "Đặt dùng thử" ở màn Tài khoản & gói.

**Tech Stack:** Next.js 15.5 App Router, React 19, tRPC v11 (không transformer: `Date` về client là chuỗi ISO), Prisma 5.22 + PostgreSQL, NextAuth v5, zod 3.25, Tailwind 3.4, shadcn/ui (Radix AlertDialog/Dialog), sonner, lucide-react (`Tags`), Vitest 4 (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-l-bang-gia-admin-design.md` (L1–L5 người dùng chốt; Q12 đã chốt: giá lẻ được, 10.000–1.000.000đ/tháng; Q13 giữ CÓ: Pro > Plus; các Q khác giữ nguyên; mục 15 T1–T3 người dùng chốt thêm 2026-09-27: số ngày dùng thử cấu hình được). Code J đang ở `main` (`00eace1`). Chỗ plan lệch spec ghi ở mục "Điều chỉnh so với spec".

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh chạm DB (kể cả `pnpm test`, `pnpm exec playwright test`, lệnh `prisma`) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, Neon, host `ep-polished-voice…`) KHÁC `.env.test` (Postgres local Docker `student-test-pg`, `localhost:5433`). **Không bao giờ sửa/ghi `.env`**, chỉ đọc host để so sánh. Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người dùng.
- **Migration:** tạo bằng `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name <x>` (trong Bash, subshell chỉ nạp 2 biến của `.env.test` và có chốt `localhost:5433`), đọc lại SQL, áp bằng `... pnpm exec prisma migrate deploy` lên DB test, kiểm dòng `Datasource "db": ... at "localhost:5433"`. KHÔNG áp lên prod (prod tự `prisma migrate deploy` khi Vercel build sau merge). Migration không destructive (chỉ `CREATE TABLE`, `CREATE INDEX`, `INSERT`).
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push` (mọi dạng, kể cả `--force-reset`), `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`, `git stash`. Build kiểm tra bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị `.env.test`.
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **`tests/setup.ts` KHÔNG xóa `plan_price_changes` / `trial_day_changes`** (giữ dòng seed của migration, không sửa `tests/setup.ts`). Mọi test đổi giá / số ngày dùng thử phải tự dọn: `deleteMany({ where: { changedBy: { not: "migration" } } })` để giá về 49.000/99.000 và mặc định dùng thử về 60 cho test khác.
- **E2E:** `pnpm exec playwright test <file>` (cổng 3000, `playwright.config.ts` tự khởi `pnpm dev` với DB `.env.test`, đã đặt `ADMIN_USERNAMES=admin_test` + ngân hàng giả; `reuseExistingServer: false`). Cổng 3000 bận → không tắt tiến trình đó, DỪNG và báo người dùng. Trước lượt e2e đầu tiên của mỗi task chạy `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed). E2E ghi DB bằng Prisma trực tiếp phải kiểm `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` trong `beforeAll`, trả `teacher_std` về Standard + xóa đơn của nó và dọn dòng giá/dùng thử không phải `migration` ở `afterAll`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. `ResponsiveList` render cả bảng (`hidden md:block`) lẫn thẻ (`md:hidden`) → ở 390px dùng test id của thẻ, ở 1280px dùng `getByRole('row')`.
- Tài khoản seed DB test (mật khẩu `teacher123`): `teacher`, `teacher2` (Pro tới 2099), `teacher_std` (Standard, không trial), `admin_test` (Standard, là admin trong test/e2e). Không nhập mật khẩu/credential nào khác vào trình duyệt; không ghi dữ liệu trên production.
- i18n: `src/language/vi.json` và `en.json` cùng bộ key (`tsc` bắt thiếu key ở `en`). Chuỗi mới không dùng gạch dài (—, –). Thay biến bằng `.replace("{x}", ...)`.
- Màu (A3): nhấn `primary` (#0F766E), trung tính slate, lỗi `text-destructive`. **Không** indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts` phải pass). Vùng chạm ≥44px trên mobile: `h-11 md:h-10` (nút chính `h-12`).
- `tests/unit/next15-contract.test.ts` đỏ nếu `page.tsx`/`layout.tsx` có định danh `searchParams`/`params` (kể cả trong comment).
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy; không mô tả lại code.
- Làm trên nhánh `feat/l-bang-gia` (tạo ở Task 1 từ `main` mới nhất). **Không commit lên `main`. Agent thực hiện task KHÔNG merge, KHÔNG push.** Không đụng file untracked khác (vd `docs/superpowers/specs/2026-09-27-m-lap-lich-thang-design.md`).
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit (chỉ `git add` đúng file của task). Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Code lệch plan (vì code thật khác mô tả) → theo code thật, giữ đúng hành vi spec, ghi lại trong báo cáo task.

## Điều chỉnh so với spec

1. **Migration tên `add_plan_settings`** (spec: `_add_plan_prices`) vì gộp luôn bảng dùng thử của mục 15 vào cùng 1 migration; test migration là `tests/integration/plan-settings-migration.test.ts` (spec: `plan-price-migration.test.ts`).
2. **Mục 15 dùng bảng riêng `trial_day_changes`** (`user_id` nullable, `days`, `previous_days`, `changed_by`, `created_at`): `user_id NULL` = mặc định cho tài khoản mới, có `user_id` = lần admin đặt riêng. Không gộp vào `plan_price_changes` vì cột `plan`/`month_price` sai nghĩa với "số ngày"; 1 bảng cho cả mặc định lẫn đặt riêng để chỉ có 1 cơ chế lịch sử. Không FK tới `users` (giống `changed_by`): `tests/setup.ts` xóa `users` mỗi lượt, FK RESTRICT sẽ làm vỡ setup.
3. **0 ngày dùng thử → `trialEndsAt = null`** (cả mặc định lẫn đặt riêng), không lưu mốc quá khứ: `planBanner` hiện banner "hết dùng thử" 7 ngày cho mốc vừa qua, tài khoản "không dùng thử" không được thấy banner đó. `trialEndFor(createdAt, days): Date | null` đổi chữ ký; hằng `TRIAL_DAYS` đổi tên `DEFAULT_TRIAL_DAYS` (chỉ còn là fallback).
4. **Khoảng số ngày:** mặc định 0–365 (spec gợi ý); đặt riêng 0–3650 vì tính từ ngày tạo tài khoản (tài khoản tạo 2 năm trước muốn thêm 30 ngày cần ~760).
5. **Form dùng thử mặc định là thẻ riêng, nút Lưu + mutation riêng** (`admin.updateTrialDays`), không chung nút "Lưu bảng giá": 2 cấu hình độc lập, lỗi/CONFLICT của cái này không chặn cái kia. Trang `/admin/prices` render `<AdminPrices />` rồi `<TrialDaysForm />` (spec: chỉ `<AdminPrices />`).
6. **Đặt dùng thử riêng từng người:** 1 `Dialog` (không thêm AlertDialog thứ 2) hiện hạn mới dd/mm/yyyy + còn bao nhiêu ngày TRƯỚC khi bấm Lưu (đúng yêu cầu "dialog xác nhận nêu rõ hạn mới"); lịch sử đặt riêng hiện 5 lần gần nhất trong dialog (query `admin.userTrialChanges`). Nút ẩn với tài khoản admin: `admin.overview.users[]` thêm `isAdmin`.
7. **Test fallback giá chạy trong transaction rồi rollback** (spec: xóa hết dòng `pro`): xóa thật sẽ mất dòng seed `migration` mà test khác cần.
8. **Thêm key `admin_price_time` ("Thời gian")** cho cột thời gian của lịch sử: không có key sẵn đúng nghĩa (`time` = "Giờ học", `admin_col_created` = "Ngày tạo").
9. **Thêm unit test component** `AdminPrices.test.tsx`, `TrialDaysForm.test.tsx`, `TrialDaysDialog.test.tsx` (spec chỉ có e2e) để có RED→GREEN nhanh cho luật lỗi tại chỗ.
10. **`PLAN_PRICES` xóa ở Task 4** (lúc đổi client), không phải Task 2: Task 2 đổi chữ ký `computeUpgradeCredit` và tạm truyền `PLAN_PRICES.pro[period]` ở `PlanPurchaseDialog` để task nào cũng `tsc` sạch.
11. **E2E "giá đổi khi popup đang mở" nằm ở `tests/e2e/plan.spec.ts`** (Task 4, cùng task sửa popup), không ở `admin-prices.spec.ts`.
12. `monthPriceSchema`, `trialDaysSchema`, `userTrialDaysSchema` export từ `src/lib/schemas/plan.ts` để client dùng chung luật với server.
13. Khóa advisory: `SETTINGS_LOCK_CLASS = 7401` (export từ `plan-price.service.ts`), khóa thứ 2 = `0` cho giá, `1` cho dùng thử mặc định. Tham số cast `::int` để Postgres chọn đúng hàm 2 tham số int.
14. Spec L đang untracked trên `main` → Task 1 commit spec + plan lên nhánh feature trước khi code. Plan có 7 task.

## Review Focus

1. **Admin gõ giá kiểu Việt Nam có dấu chấm ("59.000"):** `CurrencyInput` dùng `parseInt` nên thành 59 → phải hiện lỗi khoảng và khóa nút Lưu, tuyệt đối không lưu 59đ. Pin: unit Task 5 `tests/unit/components/AdminPrices.test.tsx` ("gõ 59.000 có dấu chấm").
2. **Bấm "Xác nhận đổi giá" 2 lần / 2 tab cùng `expected`:** đúng 1 lần thành công, lần kia `CONFLICT`, lịch sử chỉ thêm 1 dòng (không ghi đè im lặng). Pin: integration Task 3 `tests/integration/plan-prices.test.ts` ("2 lần Lưu cùng lúc").
3. **Số ngày dùng thử = 0** (mặc định hoặc đặt riêng): `trialEndsAt = null`, `planBanner` trả `null` (không có banner "Dùng thử Pro đã hết"). Pin: unit Task 6 `tests/unit/lib/plans.test.ts` + integration Task 6 `tests/integration/trial-days.test.ts` ("mặc định 0").
4. **Tài khoản cũ (tạo trước I, `trialEndsAt = null`) đặt số ngày mà hạn rơi vào quá khứ:** không bật dùng thử, `previousDays = null`, dialog báo "Hạn này đã qua"; tài khoản đang có gói trả phí giữ nguyên `plan`/`planExpiresAt`. Pin: unit Task 6 `tests/unit/components/TrialDaysDialog.test.tsx` + integration Task 6 `tests/integration/trial-days.test.ts`.
5. **Giáo viên Plus còn hạn đang mở popup chọn Pro khi giá Pro đổi:** sau khi `plan.me` nạp lại, số "+N ngày Pro" xem trước tính theo giá Pro mới (bằng `amount` đơn sẽ tạo): Plus năm còn 45 ngày → Pro năm 990.000 "+22 ngày Pro", Pro năm 1.290.000 "+17 ngày Pro". Pin: unit Task 4 `tests/unit/components/PlanPurchaseDialog.test.tsx`.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `prisma/schema.prisma` | Sửa | Model `PlanPriceChange`, `TrialDayChange` | 1 |
| `prisma/migrations/<ts>_add_plan_settings/migration.sql` | Mới | 2 bảng + index + seed 49.000/99.000/60 | 1 |
| `src/lib/plans.ts` | Sửa | `PlanPrices`, `DEFAULT_MONTH_PRICES`, `PERIOD_PRICE_FACTOR`, `pricesFromMonthly` (T1); `computeUpgradeCredit(..., targetPrice, now)` (T2); xóa `PLAN_PRICES` (T4); `DEFAULT_TRIAL_DAYS`, `trialEndFor(createdAt, days)`, `trialDaysOf` (T6) | 1, 2, 4, 6 |
| `src/server/services/plan-price.service.ts` | Mới | Đọc giá/lịch sử (T1), `updatePrices`, `SETTINGS_LOCK_CLASS` (T3) | 1, 3 |
| `tests/integration/plan-settings-migration.test.ts` | Mới | SQL migration + seed đã áp | 1 |
| `tests/integration/plan-prices.test.ts` | Mới | Service đọc giá (T1), admin API giá (T3) | 1, 3 |
| `tests/unit/lib/plans.test.ts` | Sửa | `pricesFromMonthly` (T1), `computeUpgradeCredit` (T2), bỏ `PLAN_PRICES` (T4), dùng thử (T6) | 1, 2, 4, 6 |
| `src/server/services/plan.service.ts` | Sửa | `createOrder` đọc giá DB + `expectedAmount`; `getMyPlan.prices` | 2 |
| `src/server/services/plan-admin.service.ts` | Sửa | `computeApproval` dùng `order.amount` (T2); overview `isAdmin` (T6) | 2, 6 |
| `src/lib/schemas/plan.ts` | Sửa | `expectedAmount` (T2); `monthPriceSchema`, `updatePricesSchema` (T3); schema dùng thử (T6) | 2, 3, 6 |
| `src/components/plan/PlanPurchaseDialog.tsx` | Sửa | Tạm `PLAN_PRICES.pro` (T2); `me.prices`, `expectedAmount`, CONFLICT (T4) | 2, 4 |
| `tests/unit/schemas/plan.schema.test.ts` | Mới | `createOrderSchema` (T2), `updatePricesSchema` (T3), schema dùng thử (T6) | 2, 3, 6 |
| `tests/integration/plan-orders.test.ts` | Sửa | Giá DB, CONFLICT, đơn chờ, quy đổi (T2); race (T3) | 2, 3 |
| `src/server/trpc/routers/admin.ts` | Sửa | `prices`, `updatePrices` (T3); `trialSettings`, `updateTrialDays`, `setUserTrial`, `userTrialChanges` (T6) | 3, 6 |
| `src/components/plan/PlanCompare.tsx` | Sửa | Giá từ `me.prices` | 4 |
| `src/language/vi.json`, `en.json` | Sửa | `plan_price_changed` (T4), `admin_price*` (T5), `admin_trial*` (T6) | 4, 5, 6 |
| `tests/unit/components/PlanPurchaseDialog.test.tsx`, `PlanCompare.test.tsx` | Sửa | Fixture `prices`, giá theo `me.prices`, CONFLICT | 4 |
| `tests/e2e/plan.spec.ts` | Sửa | Giá đổi khi popup đang mở | 4 |
| `src/components/admin/admin-nav.ts`, `AdminTabBar.tsx` | Sửa | Mục thứ 4 "Bảng giá", `grid-cols-4` | 5 |
| `src/components/admin/admin-format.ts` | Sửa | `dateTimeVn` | 5 |
| `src/components/admin/AdminPrices.tsx` | Mới | Form giá + xác nhận + lịch sử giá | 5 |
| `src/app/(admin)/admin/prices/page.tsx` | Mới | Route `/admin/prices` (T5), thêm `TrialDaysForm` (T6) | 5, 6 |
| `tests/unit/components/AdminPrices.test.tsx` | Mới | Form giá | 5 |
| `tests/unit/components/AdminNav.test.tsx` | Sửa | 4 mục | 5 |
| `tests/e2e/admin-prices.spec.ts` | Mới | Luồng đổi giá desktop + 390px | 5 |
| `tests/e2e/admin.spec.ts` | Sửa | 4 mục nav, 404 `/admin/prices` | 5 |
| `src/server/services/trial.service.ts` | Mới | Dùng thử mặc định + đặt riêng | 6 |
| `src/server/services/user.service.ts` | Sửa | Đăng ký đọc số ngày DB | 6 |
| `src/components/admin/TrialDaysForm.tsx` | Mới | Thẻ dùng thử mặc định + lịch sử | 6 |
| `src/components/admin/TrialDaysDialog.tsx` | Mới | Đặt dùng thử 1 tài khoản | 6 |
| `src/components/admin/AdminAccounts.tsx` | Sửa | Nút "Đặt dùng thử" | 6 |
| `tests/integration/trial-days.test.ts` | Mới | Admin API dùng thử + đăng ký | 6 |
| `tests/integration/register.test.ts` | Sửa | `trialEndFor(before, 60)` | 6 |
| `tests/unit/components/TrialDaysForm.test.tsx`, `TrialDaysDialog.test.tsx` | Mới | UI dùng thử | 6 |
| `tests/e2e/admin-trial.spec.ts` | Mới | Đặt dùng thử 1 tài khoản, giáo viên thấy hạn mới | 6 |

Thứ tự bắt buộc (tuần tự, mỗi task 1 agent mới): Task 1 → 2 → … → 7. T2 cần `getPlanPrices` (T1); T3 cần `getMonthlyPrices` (T1) và `plan.me.prices` (T2); T4 cần `plan.me.prices` (T2); T5 cần `admin.prices`/`updatePrices` (T3); T6 cần bảng `trial_day_changes` (T1), `SETTINGS_LOCK_CLASS` (T3), `dateTimeVn` + trang `/admin/prices` (T5).

---
### Task 1: Nhánh, migration 2 bảng (giá + dùng thử), hàm giá thuần, đọc giá từ DB

**Đọc trước:** Global Constraints; spec mục 4 (Q1–Q4, Q15), 6, 7.1 (phần thêm hằng/hàm, CHƯA đổi `computeUpgradeCredit`), 7.2 (3 hàm đọc), 10 (Unit `pricesFromMonthly`, Integration fallback + migration), 15 (chỉ phần bảng/seed 60); `docs/coding-rule.md` §6.1; `prisma/schema.prisma` (model `PlanOrder` cuối file); `prisma/migrations/20260926144238_launch_plan_grants/migration.sql` (cách ghi `now() AT TIME ZONE 'UTC'`); `src/lib/plans.ts` dòng 1–25; `src/server/services/plan.service.ts` dòng 1–30 (type `Db`); `tests/integration/plan-launch-migration.test.ts` (kiểu test đọc SQL).

**Files:**
- Modify: `prisma/schema.prisma` (thêm 2 model cuối file)
- Create: `prisma/migrations/<ts>_add_plan_settings/migration.sql` (Prisma sinh + thêm tay seed)
- Modify: `src/lib/plans.ts` (thêm ngay dưới `PLAN_PRICES`, KHÔNG xóa `PLAN_PRICES`)
- Create: `src/server/services/plan-price.service.ts`
- Test (Mới): `tests/integration/plan-settings-migration.test.ts`, `tests/integration/plan-prices.test.ts`
- Test (Sửa): `tests/unit/lib/plans.test.ts`

**Interfaces:**
- Consumes: type `Db = PrismaClient | Prisma.TransactionClient` từ `src/server/services/plan.service.ts`; `PaidPlan`, `Period` từ `src/lib/plans.ts`.
- Produces:
  - Prisma: `db.planPriceChange` (`id: number, plan: string, monthPrice: number, previousMonthPrice: number | null, changedBy: string, createdAt: Date`), `db.trialDayChange` (`id: number, userId: number | null, days: number, previousDays: number | null, changedBy: string, createdAt: Date`).
  - `src/lib/plans.ts`: `type PlanPrices = Record<PaidPlan, Record<Period, number>>`; `DEFAULT_MONTH_PRICES: Record<PaidPlan, number>` (`{ plus: 49000, pro: 99000 }`); `PERIOD_PRICE_FACTOR: Record<Period, number>` (`{ month: 1, year: 10, "2year": 20 }`); `pricesFromMonthly(m: Record<PaidPlan, number>): PlanPrices`.
  - `src/server/services/plan-price.service.ts`: `getMonthlyPrices(db: Db): Promise<Record<PaidPlan, number>>`; `getPlanPrices(db: Db): Promise<PlanPrices>`; `type PriceChangeRow = { id: number; plan: string; monthPrice: number; previousMonthPrice: number | null; changedBy: string; createdAt: Date }`; `getPriceHistory(db: Db): Promise<PriceChangeRow[]>` (50 dòng, `createdAt desc, id desc`).

- [ ] **Step 0: Tạo nhánh, commit spec + plan**

```bash
git checkout main
git pull --ff-only
git status --short
git checkout -b feat/l-bang-gia
git add docs/superpowers/specs/2026-09-27-l-bang-gia-admin-design.md docs/superpowers/plans/2026-09-27-l-bang-gia-admin.md
git commit -m "docs(l): spec + plan màn Bảng giá admin, số ngày dùng thử cấu hình được

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
Expected: `git status --short` trước khi tạo nhánh có 2 file untracked của L (có thêm `docs/superpowers/specs/2026-09-27-m-lap-lich-thang-design.md` hay file khác của người dùng thì kệ, KHÔNG add). Nhánh `feat/l-bang-gia` đã có → `git checkout feat/l-bang-gia`, bỏ commit docs nếu đã có. Chỉ `git add` đúng 2 file.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG, báo người dùng.

- [ ] **Step 2: Viết unit test `pricesFromMonthly` (RED)**

Trong `tests/unit/lib/plans.test.ts`, thêm `PERIOD_PRICE_FACTOR,` và `pricesFromMonthly,` vào khối import từ `@/lib/plans` (thứ tự theo chữ cái như các tên sẵn có). Thêm describe mới ngay SAU `describe("giá", …)` (giữ nguyên describe "giá" cũ, Task 4 mới xóa):
```ts
describe("pricesFromMonthly (spec L Q2)", () => {
  it("giá seed 49.000/99.000 → đúng bảng giá cũ", () => {
    expect(pricesFromMonthly({ plus: 49000, pro: 99000 })).toEqual({
      plus: { month: 49000, year: 490000, "2year": 980000 },
      pro: { month: 99000, year: 990000, "2year": 1980000 },
    })
  })
  it("giá mới và giá lẻ: năm ×10, 2 năm ×20", () => {
    expect(pricesFromMonthly({ plus: 59000, pro: 129000 })).toEqual({
      plus: { month: 59000, year: 590000, "2year": 1180000 },
      pro: { month: 129000, year: 1290000, "2year": 2580000 },
    })
    expect(pricesFromMonthly({ plus: 49900, pro: 99900 }).plus).toEqual({ month: 49900, year: 499000, "2year": 998000 })
    expect(PERIOD_PRICE_FACTOR).toEqual({ month: 1, year: 10, "2year": 20 })
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: FAIL — `pricesFromMonthly is not a function` (hoặc `PERIOD_PRICE_FACTOR` undefined).

- [ ] **Step 4: Thêm hằng/hàm giá vào `src/lib/plans.ts`**

Ngay dưới khối `PLAN_PRICES` (dòng 14–17), thêm:
```ts
export type PlanPrices = Record<PaidPlan, Record<Period, number>>
// Chỉ dùng khi DB thiếu dòng giá (spec L Q4); giá thật nằm ở bảng plan_price_changes.
export const DEFAULT_MONTH_PRICES: Record<PaidPlan, number> = { plus: 49000, pro: 99000 }
// Năm = 10 tháng nên nhãn "Tiết kiệm 2 tháng" luôn đúng (spec L Q2).
export const PERIOD_PRICE_FACTOR: Record<Period, number> = { month: 1, year: 10, "2year": 20 }

export function pricesFromMonthly(m: Record<PaidPlan, number>): PlanPrices {
  const periods = (v: number) => ({
    month: v * PERIOD_PRICE_FACTOR.month,
    year: v * PERIOD_PRICE_FACTOR.year,
    "2year": v * PERIOD_PRICE_FACTOR["2year"],
  })
  return { plus: periods(m.plus), pro: periods(m.pro) }
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: PASS toàn file.

- [ ] **Step 6: Thêm 2 model vào `prisma/schema.prisma`**

Thêm cuối file (sau model `PlanOrder`):
```prisma
// Giá hiện hành của 1 gói = dòng mới nhất (spec L Q1). Không FK tới users: xóa tài khoản admin không mất lịch sử.
model PlanPriceChange {
  id                 Int      @id @default(autoincrement())
  plan               String   @db.VarChar(10)
  monthPrice         Int      @map("month_price")
  previousMonthPrice Int?     @map("previous_month_price")
  changedBy          String   @map("changed_by") @db.VarChar(50)
  createdAt          DateTime @default(now()) @map("created_at")

  @@index([plan, createdAt])
  @@map("plan_price_changes")
}

// userId null = số ngày mặc định cho tài khoản đăng ký sau; có userId = lần admin đặt riêng (spec L mục 15).
// Không FK: tests/setup.ts xóa users mỗi lượt, FK RESTRICT sẽ chặn.
model TrialDayChange {
  id           Int      @id @default(autoincrement())
  userId       Int?     @map("user_id")
  days         Int
  previousDays Int?     @map("previous_days")
  changedBy    String   @map("changed_by") @db.VarChar(50)
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@map("trial_day_changes")
}
```

- [ ] **Step 7: Sinh migration trên DB test (Bash, không kết nối DB prod)**

```bash
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  case "$DIRECT_URL" in *localhost:5433*) ;; *) echo "DỪNG: DIRECT_URL không phải DB test"; exit 1;; esac
  pnpm exec prisma migrate dev --create-only --name add_plan_settings
)
ls prisma/migrations | grep _add_plan_settings
cat prisma/migrations/*_add_plan_settings/migration.sql
```
Expected: in `Datasource "db": PostgreSQL database "student_test"... at "localhost:5433"` và `Prisma Migrate created the following migration without applying it ..._add_plan_settings`. Thư mục mới có timestamp > `20260926144238`. SQL chỉ gồm (khoảng trắng có thể khác):
```sql
-- CreateTable
CREATE TABLE "plan_price_changes" (
    "id" SERIAL NOT NULL,
    "plan" VARCHAR(10) NOT NULL,
    "month_price" INTEGER NOT NULL,
    "previous_month_price" INTEGER,
    "changed_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_day_changes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "days" INTEGER NOT NULL,
    "previous_days" INTEGER,
    "changed_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_day_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_price_changes_plan_created_at_idx" ON "plan_price_changes"("plan", "created_at");

-- CreateIndex
CREATE INDEX "trial_day_changes_user_id_created_at_idx" ON "trial_day_changes"("user_id", "created_at");
```
DỪNG ngay, báo người dùng, KHÔNG đồng ý đề nghị nào nếu: Prisma báo drift / "We need to reset" / hỏi xác nhận; SQL có `DROP`, `ALTER`, bảng khác. Riêng khi lỗi chỉ vì không tạo được shadow database (thiếu quyền `CREATEDB`) hoặc báo môi trường "non-interactive": xóa thư mục migration rỗng (nếu có) rồi dùng cách của plan I (không cần shadow DB, không kết nối DB):
```bash
git show main:prisma/schema.prisma > .superpowers/l-schema-before.prisma
ts=$(date -u +%Y%m%d%H%M%S); mkdir -p "prisma/migrations/${ts}_add_plan_settings"
pnpm exec prisma migrate diff --from-schema-datamodel .superpowers/l-schema-before.prisma --to-schema-datamodel prisma/schema.prisma --script > "prisma/migrations/${ts}_add_plan_settings/migration.sql"
rm .superpowers/l-schema-before.prisma
cat prisma/migrations/*_add_plan_settings/migration.sql
```
(cùng Expected SQL như trên; chạy trong Bash, không PowerShell vì `>` của PowerShell ghi UTF-16.)

- [ ] **Step 8: Thêm tay seed cuối migration**

Mở `prisma/migrations/<ts>_add_plan_settings/migration.sql` bằng Edit, thêm cuối file (UTF-8, không BOM; ghi chú KHÔNG chứa dấu `;` theo quy ước của `launch_plan_grants`):
```sql

-- Giá đang bán và số ngày dùng thử lúc ra mắt màn Bảng giá (spec L Q3, mục 15), dòng seed không có giá trị cũ
INSERT INTO "plan_price_changes" ("plan", "month_price", "previous_month_price", "changed_by", "created_at")
VALUES ('plus', 49000, NULL, 'migration', now() AT TIME ZONE 'UTC'),
       ('pro',  99000, NULL, 'migration', now() AT TIME ZONE 'UTC');

INSERT INTO "trial_day_changes" ("user_id", "days", "previous_days", "changed_by", "created_at")
VALUES (NULL, 60, NULL, 'migration', now() AT TIME ZONE 'UTC');
```
Run (Bash): `file prisma/migrations/*_add_plan_settings/migration.sql`
Expected: `UTF-8 Unicode text` (hoặc ASCII), không `UTF-16`, không `with BOM`.

- [ ] **Step 9: Viết test migration (RED — chưa áp migration)**

Tạo `tests/integration/plan-settings-migration.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

// Đọc đúng SQL sẽ chạy trên production khi Vercel build.
function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_plan_settings"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

describe("Migration add_plan_settings", () => {
  it("chỉ tạo bảng/index và seed, không đụng bảng cũ", () => {
    const sql = migrationSql()
    expect(sql).not.toMatch(/\b(DROP|ALTER|TRUNCATE|DELETE|UPDATE)\b/i)
    expect(sql).toContain('CREATE TABLE "plan_price_changes"')
    expect(sql).toContain('CREATE TABLE "trial_day_changes"')
    expect(sql).toMatch(/\('plus',\s*49000,\s*NULL,\s*'migration'/)
    expect(sql).toMatch(/\('pro',\s*99000,\s*NULL,\s*'migration'/)
    expect(sql).toMatch(/\(NULL,\s*60,\s*NULL,\s*'migration'/)
  })

  it("DB test đã áp: đúng 2 dòng giá seed và 1 dòng dùng thử mặc định seed", async () => {
    const prices = await db.planPriceChange.findMany({
      where: { changedBy: "migration" },
      orderBy: { plan: "asc" },
      select: { plan: true, monthPrice: true, previousMonthPrice: true },
    })
    expect(prices).toEqual([
      { plan: "plus", monthPrice: 49000, previousMonthPrice: null },
      { plan: "pro", monthPrice: 99000, previousMonthPrice: null },
    ])
    const trial = await db.trialDayChange.findMany({
      where: { changedBy: "migration" },
      select: { userId: true, days: true, previousDays: true },
    })
    expect(trial).toEqual([{ userId: null, days: 60, previousDays: null }])
  })
})
```

Run: `pnpm test tests/integration/plan-settings-migration.test.ts`
Expected: test 1 PASS; test 2 FAIL (`db.planPriceChange` undefined hoặc `relation "plan_price_changes" does not exist`) vì chưa generate/áp migration.

- [ ] **Step 10: Áp migration lên DB test + generate client**

```bash
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  pnpm exec prisma migrate status
  pnpm exec prisma migrate deploy
)
pnpm exec prisma generate
```
Expected: `migrate status` in `Datasource "db": PostgreSQL database "student_test" ... at "localhost:5433"` và đúng 1 migration chưa áp (`..._add_plan_settings`); `migrate deploy` in `Applying migration ..._add_plan_settings` và `All migrations have been successfully applied`. Host khác `localhost:5433` → DỪNG. Prisma đòi reset → DỪNG, không đồng ý, báo người dùng. `prisma generate` lỗi `EPERM` (engine bị khóa) → tắt tiến trình node/next của chính mình rồi chạy lại; vẫn lỗi → DỪNG, báo người dùng.

Run: `pnpm test tests/integration/plan-settings-migration.test.ts`
Expected: PASS cả 2 test.

- [ ] **Step 11: Viết integration test đọc giá (RED)**

Tạo `tests/integration/plan-prices.test.ts`:
```ts
import { describe, it, expect, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getMonthlyPrices, getPlanPrices, getPriceHistory } from "@/server/services/plan-price.service"

// tests/setup.ts không xóa bảng giá: dọn dòng test để giá về 49.000/99.000 cho file khác.
async function resetPrices() {
  await db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await resetPrices()
})

describe("plan-price.service (đọc)", () => {
  it("giá seed 49.000/99.000, đủ 3 kỳ", async () => {
    expect(await getMonthlyPrices(db)).toEqual({ plus: 49000, pro: 99000 })
    expect(await getPlanPrices(db)).toEqual({
      plus: { month: 49000, year: 490000, "2year": 980000 },
      pro: { month: 99000, year: 990000, "2year": 1980000 },
    })
  })

  it("giá hiện hành = dòng mới nhất của từng gói; lịch sử mới nhất trước, gồm dòng seed", async () => {
    await db.planPriceChange.create({ data: { plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "price_test" } })
    await db.planPriceChange.create({ data: { plan: "plus", monthPrice: 59900, previousMonthPrice: 59000, changedBy: "price_test" } })
    expect(await getMonthlyPrices(db)).toEqual({ plus: 59900, pro: 99000 })
    const history = await getPriceHistory(db)
    expect(history.slice(0, 2).map((r) => [r.plan, r.previousMonthPrice, r.monthPrice, r.changedBy])).toEqual([
      ["plus", 59000, 59900, "price_test"],
      ["plus", 49000, 59000, "price_test"],
    ])
    expect(history.filter((r) => r.changedBy === "migration")).toHaveLength(2)
    expect(history[0].createdAt).toBeInstanceOf(Date)
  })

  it("thiếu dòng của 1 gói → giá mặc định + console.warn (trong transaction rồi rollback để giữ dòng seed)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(
      db.$transaction(async (tx) => {
        await tx.planPriceChange.create({ data: { plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "price_test" } })
        await tx.planPriceChange.deleteMany({ where: { plan: "pro" } })
        expect(await getMonthlyPrices(tx)).toEqual({ plus: 59000, pro: 99000 })
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")
    expect(warn).toHaveBeenCalledWith("[plan-price] thiếu giá pro, dùng mặc định")
    expect(await db.planPriceChange.count({ where: { plan: "pro", changedBy: "migration" } })).toBe(1)
  })
})
```

Run: `pnpm test tests/integration/plan-prices.test.ts`
Expected: FAIL — không resolve được `@/server/services/plan-price.service`.

- [ ] **Step 12: Tạo `src/server/services/plan-price.service.ts`**

```ts
import { DEFAULT_MONTH_PRICES, pricesFromMonthly, type PaidPlan, type PlanPrices } from "@/lib/plans"
import type { Db } from "./plan.service"

const PAID_PLANS: PaidPlan[] = ["plus", "pro"]

async function latestMonthPrice(db: Db, plan: PaidPlan): Promise<number> {
  const row = await db.planPriceChange.findFirst({
    where: { plan },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { monthPrice: true },
  })
  if (row) return row.monthPrice
  // DB dựng thiếu seed (db push, xóa tay): vẫn bán theo giá mặc định thay vì lỗi 500 (spec L Q4).
  console.warn(`[plan-price] thiếu giá ${plan}, dùng mặc định`)
  return DEFAULT_MONTH_PRICES[plan]
}

// Nhận cả tx để createOrder đọc giá trong cùng transaction tạo đơn.
export async function getMonthlyPrices(db: Db): Promise<Record<PaidPlan, number>> {
  const [plus, pro] = await Promise.all(PAID_PLANS.map((p) => latestMonthPrice(db, p)))
  return { plus, pro }
}

export async function getPlanPrices(db: Db): Promise<PlanPrices> {
  return pricesFromMonthly(await getMonthlyPrices(db))
}

export type PriceChangeRow = {
  id: number
  plan: string
  monthPrice: number
  previousMonthPrice: number | null
  changedBy: string
  createdAt: Date
}

// Giá đổi vài lần/tháng nên 50 dòng đủ vài năm, chưa phân trang (spec L Q15).
export async function getPriceHistory(db: Db): Promise<PriceChangeRow[]> {
  return db.planPriceChange.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, plan: true, monthPrice: true, previousMonthPrice: true, changedBy: true, createdAt: true },
  })
}
```
`import type { Db }` là import chỉ kiểu → không tạo vòng import lúc chạy khi Task 2 cho `plan.service.ts` import `getPlanPrices`.

- [ ] **Step 13: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/plan-prices.test.ts`
Expected: PASS 3 test.

Run: `pnpm test tests/integration/plan-settings-migration.test.ts`
Expected: PASS (dòng seed vẫn còn sau test fallback).

- [ ] **Step 14: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: sạch.

- [ ] **Step 15: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/*_add_plan_settings/migration.sql src/lib/plans.ts src/server/services/plan-price.service.ts tests/unit/lib/plans.test.ts tests/integration/plan-settings-migration.test.ts tests/integration/plan-prices.test.ts
git commit -m "feat(l): bảng giá + số ngày dùng thử trong DB (migration có seed), đọc giá hiện hành

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Đơn hàng đọc giá DB — `createOrder` (+ `expectedAmount`), `plan.me.prices`, quy đổi theo `order.amount`

**Đọc trước:** Global Constraints; spec mục 4 (Q5–Q8, Q10, Q17), 7.1 (đoạn `computeUpgradeCredit`, ghi chú `PERIOD_DAYS`), 7.3, 7.4, 7.5 (đoạn `createOrderSchema`), 10 (Unit `computeUpgradeCredit`; Integration `plan-orders.test.ts` trừ ý Race), 11 (ý 1–3); `src/lib/plans.ts` dòng 14–20, 183–200; `src/server/services/plan.service.ts` (`getMyPlan`, `createOrder`); `src/server/services/plan-admin.service.ts` dòng 16–30, 84–110; `src/lib/schemas/plan.ts`; `src/components/plan/PlanPurchaseDialog.tsx` dòng 69–76; `tests/unit/lib/plans.test.ts` dòng 230–282; `tests/integration/plan-orders.test.ts`; `tests/integration/admin.test.ts` dòng 85–106.

**Files:**
- Modify: `src/lib/plans.ts` (ghi chú `PERIOD_DAYS`, chữ ký `computeUpgradeCredit`)
- Modify: `src/lib/schemas/plan.ts` (`expectedAmount`)
- Modify: `src/server/services/plan.service.ts` (`createOrder`, `getMyPlan`)
- Modify: `src/server/services/plan-admin.service.ts` (`computeApproval`, `approveOrder`)
- Modify: `src/components/plan/PlanPurchaseDialog.tsx` (1 dòng gọi `computeUpgradeCredit`, tạm dùng `PLAN_PRICES`)
- Test (Sửa): `tests/unit/lib/plans.test.ts`, `tests/integration/plan-orders.test.ts`
- Test (Mới): `tests/unit/schemas/plan.schema.test.ts`

**Interfaces:**
- Consumes (Task 1): `getPlanPrices(db: Db): Promise<PlanPrices>` từ `@/server/services/plan-price.service`; `db.planPriceChange`.
- Produces:
  - `computeUpgradeCredit(u: PlanFields, lastPlusOrder: CreditOrder | null, targetPeriod: Period, targetPrice: number, now: Date): { remainingValue: number; creditDays: number }`.
  - `createOrderSchema` = `{ plan: "plus" | "pro"; period: Period; expectedAmount?: number }` (nguyên dương, tùy chọn). `CreateOrderInput` theo đó.
  - `plan.createOrder`: `expectedAmount` có và khác giá DB → `TRPCError { code: "CONFLICT", message: "Giá gói vừa thay đổi, vui lòng xem lại giá mới" }`, không tạo đơn, không hủy đơn chờ cũ.
  - `plan.me` trả thêm `prices: PlanPrices` (client nhận `RouterOutputs["plan"]["me"]["prices"]`, cùng dạng `{ plus: { month, year, "2year" }, pro: {…} }`).
  - `computeApproval(db, order: { userId: number; plan: string; period: string | null; bonusMonths: number; amount: number }, now)`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Sửa unit test `computeUpgradeCredit` (RED)**

Trong `tests/unit/lib/plans.test.ts`:

a) Test "Plus → Pro năm còn 45 ngày" (trong `describe("paidDaysLeft / computeBonusMonths (spec 6.6)")`), thay dòng gọi `computeUpgradeCredit` bằng:
```ts
    expect(computeUpgradeCredit(x, { amount: 490000, period: "year", bonusMonths: 0 }, "year", 990000, NOW)).toEqual({ remainingValue: 60411, creditDays: 22 })
```

b) Thay TOÀN BỘ `describe("computeUpgradeCredit (D7 quy đổi)", …)` bằng:
```ts
describe("computeUpgradeCredit (D7 quy đổi)", () => {
  // Plus năm mua 01/01/2026 → hạn 01/01/2027. Ngày 03/03/2026 đã dùng 61 ngày, còn 304/365.
  const plusYear = u({ plan: "plus", planExpiresAt: vn("2027-01-01T00:00") })
  const now = vn("2026-03-03T10:00")
  const order = { amount: 490000, period: "year", bonusMonths: 0 }

  it("ví dụ spec: còn 408.110đ → Pro năm +150 ngày, Pro tháng +123 ngày (Pro 2 năm cùng đơn giá năm)", () => {
    expect(computeUpgradeCredit(plusYear, order, "year", 990000, now)).toEqual({ remainingValue: 408110, creditDays: 150 })
    expect(computeUpgradeCredit(plusYear, order, "month", 99000, now)).toEqual({ remainingValue: 408110, creditDays: 123 })
    expect(computeUpgradeCredit(plusYear, order, "2year", 1980000, now)).toEqual({ remainingValue: 408110, creditDays: 150 })
  })
  it("spec L Q10: mẫu số là tiền đơn Pro đang mua; Pro năm giá mới 1.290.000 → +115 ngày, tiền Plus còn lại không đổi", () => {
    expect(computeUpgradeCredit(plusYear, order, "year", 1290000, now)).toEqual({ remainingValue: 408110, creditDays: 115 })
  })
  it("targetPrice ≤ 0 → 0 ngày (không chia cho 0)", () => {
    expect(computeUpgradeCredit(plusYear, order, "year", 0, now)).toEqual({ remainingValue: 0, creditDays: 0 })
  })
  it("Plus tháng 49.000đ còn 10 ngày → Pro tháng +4 ngày (làm tròn xuống)", () => {
    expect(computeUpgradeCredit(paidLeft("plus", 10), { amount: 49000, period: "month", bonusMonths: 0 }, "month", 99000, NOW)).toEqual({ remainingValue: 16333, creditDays: 4 })
  })
  it("đơn tặng 0đ hoặc admin đặt tay (period null) → 0 ngày", () => {
    expect(computeUpgradeCredit(plusYear, { amount: 0, period: "year", bonusMonths: 0 }, "year", 990000, now)).toEqual({ remainingValue: 0, creditDays: 0 })
    expect(computeUpgradeCredit(plusYear, { amount: 490000, period: null, bonusMonths: 0 }, "year", 990000, now)).toEqual({ remainingValue: 0, creditDays: 0 })
    expect(computeUpgradeCredit(plusYear, null, "year", 990000, now)).toEqual({ remainingValue: 0, creditDays: 0 })
  })
  it("Plus mua trong trial (còn 400 ngày) → chặn trên bằng cả kỳ: không vượt số tiền đã trả", () => {
    expect(computeUpgradeCredit(paidLeft("plus", 400), order, "year", 990000, NOW)).toEqual({ remainingValue: 490000, creditDays: 180 })
  })
  it("Plus 2 năm có +2 tháng tặng, đã dùng 60 ngày → tổng ngày tính cả tháng tặng, không quy đổi đủ 980.000đ", () => {
    // Mua 01/01/2026, hạn 01/03/2028 (26 tháng = 790 ngày); 02/03/2026 còn 730 ngày trên 730 + 61.
    const x = u({ plan: "plus", planExpiresAt: vn("2028-03-01T00:00") })
    const r = computeUpgradeCredit(x, { amount: 980000, period: "2year", bonusMonths: 2 }, "year", 990000, vn("2026-03-02T10:00"))
    expect(r.remainingValue).toBe(Math.round((980000 * 730) / 791))
    expect(r.remainingValue).toBeLessThan(980000)
  })
  it("Plus năm gia hạn sớm +2 tháng, đã dùng 60 ngày → chia cho 365 + 61 ngày", () => {
    const x = u({ plan: "plus", planExpiresAt: vn("2027-03-01T00:00") })
    const r = computeUpgradeCredit(x, { amount: 490000, period: "year", bonusMonths: 2 }, "year", 990000, vn("2026-03-02T10:00"))
    expect(r.remainingValue).toBe(Math.round((490000 * 364) / 426))
  })
  it("Plus đã hết hạn hoặc đang là Pro → 0", () => {
    expect(computeUpgradeCredit(u({ plan: "plus", planExpiresAt: vn("2026-03-01T00:00") }), order, "year", 990000, now).creditDays).toBe(0)
    expect(computeUpgradeCredit(u({ plan: "pro", planExpiresAt: vn("2027-01-01T00:00") }), order, "year", 990000, now).creditDays).toBe(0)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: FAIL — test "spec L Q10" nhận `creditDays: 150` thay vì 115 (hàm cũ lấy `now` ở vị trí thứ 4 và giá cố định), các test khác có thể lỗi `now` sai kiểu.

- [ ] **Step 4: Đổi `computeUpgradeCredit` và ghi chú `PERIOD_DAYS` trong `src/lib/plans.ts`**

Ghi chú của `PERIOD_DAYS` đổi thành:
```ts
// Số ngày danh nghĩa 1 kỳ cho quy đổi D7: đơn giá ngày = giá kỳ / số ngày.
```

Thay hàm `computeUpgradeCredit` bằng:
```ts
// D7: phần tiền Plus còn lại đổi thành ngày Pro. Chặn trên bằng cả kỳ để Plus mua trong trial không quy đổi vượt số tiền đã trả.
// targetPrice = số tiền đơn Pro đang mua (server: order.amount) để đổi giá giữa lúc tạo và lúc duyệt không đổi số ngày (spec L Q10).
export function computeUpgradeCredit(
  u: PlanFields,
  lastPlusOrder: CreditOrder | null,
  targetPeriod: Period,
  targetPrice: number,
  now: Date
): { remainingValue: number; creditDays: number } {
  const none = { remainingValue: 0, creditDays: 0 }
  if (u.plan !== "plus" || !u.planExpiresAt || u.planExpiresAt <= now) return none
  if (!lastPlusOrder || lastPlusOrder.amount <= 0 || !isPeriod(lastPlusOrder.period) || targetPrice <= 0) return none
  // Tháng tặng nằm trong số ngày đơn đã mua, không tính thì dùng hết phần tặng rồi vẫn quy đổi đủ tiền.
  const totalDays = PERIOD_DAYS[lastPlusOrder.period] + Math.round((lastPlusOrder.bonusMonths * 365) / 12)
  const left = Math.round((u.planExpiresAt.getTime() - vnStartOfDay(now).getTime()) / DAY_MS)
  const remainingDays = Math.min(totalDays, left)
  const remainingValue = Math.round((lastPlusOrder.amount * remainingDays) / totalDays)
  const creditDays = Math.floor((remainingValue * PERIOD_DAYS[targetPeriod]) / targetPrice)
  return { remainingValue, creditDays }
}
```

- [ ] **Step 5: Sửa 2 chỗ gọi để `tsc` sạch**

`src/server/services/plan-admin.service.ts` — `computeApproval`: kiểu `order` thêm `amount: number`, và lời gọi:
```ts
export async function computeApproval(
  db: Db,
  order: { userId: number; plan: string; period: string | null; bonusMonths: number; amount: number },
  now: Date
): Promise<{ grantedUntil: Date; creditDays: number } | null> {
  if (!isPaidPlan(order.plan) || !isPeriod(order.period)) return null
  const user = await db.user.findUniqueOrThrow({ where: { id: order.userId }, select: PLAN_SELECT })
  if (orderBlockedUntil(user, order.plan, now)) return null
  // Mẫu số là tiền đơn Pro đang duyệt, không đọc bảng giá hiện hành (spec L Q10, L4).
  const creditDays =
    order.plan === "pro"
      ? computeUpgradeCredit(user, await findLastPlusOrder(db, order.userId), order.period, order.amount, now).creditDays
      : 0
  const grantedUntil = addDays(computeNewExpiry(user, order.plan, order.period, now, order.bonusMonths), creditDays)
  return { grantedUntil, creditDays }
}
```
Trong `approveOrder`, `findUniqueOrThrow` select thêm `amount: true`:
```ts
      select: { userId: true, plan: true, period: true, bonusMonths: true, amount: true },
```
(`getAdminOverview` đã select `amount` cho `pending` → giữ nguyên.)

`src/components/plan/PlanPurchaseDialog.tsx` dòng 74, tạm giữ giá hằng số (Task 4 đổi sang `me.prices`):
```ts
  const credit =
    choice.plan === "pro" ? computeUpgradeCredit(fields, me.plusCreditOrder, choice.period, PLAN_PRICES.pro[choice.period], now) : null
```

- [ ] **Step 6: Chạy unit test, xác nhận pass**

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: PASS toàn file.

- [ ] **Step 7: Viết unit test schema (RED)**

Tạo `tests/unit/schemas/plan.schema.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { createOrderSchema } from "@/lib/schemas/plan"

describe("createOrderSchema (spec L Q6)", () => {
  it("expectedAmount tùy chọn; có thì giữ nguyên số", () => {
    expect(createOrderSchema.parse({ plan: "plus", period: "year" }).expectedAmount).toBeUndefined()
    expect(createOrderSchema.parse({ plan: "plus", period: "year", expectedAmount: 490000 }).expectedAmount).toBe(490000)
  })
  it("expectedAmount phải nguyên dương", () => {
    for (const bad of [0, -1, 1.5]) {
      expect(createOrderSchema.safeParse({ plan: "plus", period: "year", expectedAmount: bad }).success).toBe(false)
    }
  })
})
```

Run: `pnpm test tests/unit/schemas/plan.schema.test.ts`
Expected: FAIL — `expectedAmount` bị zod bỏ (`toBe(490000)` nhận `undefined`), `safeParse` với số xấu trả `success: true`.

- [ ] **Step 8: Thêm `expectedAmount` vào `src/lib/schemas/plan.ts`**

Thay ghi chú + `createOrderSchema`:
```ts
// Tiền lấy từ bảng giá DB ở server; expectedAmount chỉ để phát hiện giá vừa đổi, không bao giờ dùng làm số tiền (spec L Q6, I 6.4).
// Tùy chọn để tab còn JS cũ lúc deploy vẫn tạo đơn được theo giá mới.
export const createOrderSchema = z.object({
  plan: z.enum(["plus", "pro"]),
  period: z.enum(PERIODS),
  expectedAmount: z.number().int().positive().optional(),
})
```

Run: `pnpm test tests/unit/schemas/plan.schema.test.ts`
Expected: PASS.

- [ ] **Step 9: Viết integration test giá DB cho đơn (RED)**

Trong `tests/integration/plan-orders.test.ts`:

a) Hàm `reset()` thêm dòng đầu (dọn giá về 49.000/99.000):
```ts
  // tests/setup.ts không xóa bảng giá: dòng giá test thêm phải xóa để file khác thấy 49.000/99.000.
  await db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })
```

b) Thêm cuối file:
```ts
describe("giá từ DB (spec L)", () => {
  const addPrice = (plan: "plus" | "pro", monthPrice: number, previousMonthPrice: number) =>
    db.planPriceChange.create({ data: { plan, monthPrice, previousMonthPrice, changedBy: "price_test" } })

  it("plan.me.prices theo bảng giá DB, đổi giá thấy ngay", async () => {
    const c = await getAuthedCaller("teacher_std")
    expect((await c.plan.me()).prices).toEqual({
      plus: { month: 49000, year: 490000, "2year": 980000 },
      pro: { month: 99000, year: 990000, "2year": 1980000 },
    })
    await addPrice("plus", 59000, 49000)
    expect((await c.plan.me()).prices.plus).toEqual({ month: 59000, year: 590000, "2year": 1180000 })
  })

  it("tạo đơn sau khi đổi giá: không gửi expectedAmount → giá mới; expectedAmount khớp → tạo được", async () => {
    await addPrice("plus", 59000, 49000)
    const c = await getAuthedCaller("teacher_std")
    const a = await c.plan.createOrder({ plan: "plus", period: "year" })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: a.id } })).amount).toBe(590000)
    const b = await c.plan.createOrder({ plan: "plus", period: "month", expectedAmount: 59000 })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: b.id } })).amount).toBe(59000)
  })

  it("expectedAmount lệch giá DB → CONFLICT, không tạo đơn, đơn chờ cũ vẫn pending", async () => {
    const c = await getAuthedCaller("teacher_std")
    const old = await c.plan.createOrder({ plan: "pro", period: "month", expectedAmount: 99000 })
    await addPrice("plus", 59000, 49000)
    await expect(c.plan.createOrder({ plan: "plus", period: "year", expectedAmount: 490000 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Giá gói vừa thay đổi, vui lòng xem lại giá mới",
    })
    expect((await db.planOrder.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("pending")
    expect(await db.planOrder.count({ where: { userId } })).toBe(1)
  })

  it("đổi giá khi có đơn chờ: amount và QR giữ nguyên, duyệt vẫn 490.000", async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    const c = await getAuthedCaller("teacher_std")
    const { id } = await c.plan.createOrder({ plan: "plus", period: "year", expectedAmount: 490000 })
    await addPrice("plus", 59000, 49000)
    const me = await c.plan.me()
    expect(me.pendingOrder).toMatchObject({ id, amount: 490000 })
    // Tag 54 của VietQR = số tiền, độ dài 06.
    expect(me.pendingOrder?.qr?.payload).toContain("5406490000")
    await (await getAuthedCaller("admin_test")).admin.approveOrder({ id })
    expect(await db.planOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "approved", amount: 490000 })
  })

  it("quy đổi Plus→Pro: mẫu số là amount đơn Pro (990.000) dù giá Pro đổi 129.000 trước lúc duyệt", async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    const today = vnStartOfDay(new Date())
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: addDays(today, 304) } })
    await db.planOrder.create({ data: { userId, plan: "plus", period: "year", amount: 490000, status: "approved", decidedAt: new Date() } })
    const { id } = await (await getAuthedCaller("teacher_std")).plan.createOrder({ plan: "pro", period: "year" })
    await addPrice("pro", 129000, 99000)
    const res = await (await getAuthedCaller("admin_test")).admin.approveOrder({ id })
    // floor(408.110 × 365 / 990.000) = 150; nếu đọc giá mới 1.290.000 sẽ ra 115.
    expect(res.creditDays).toBe(150)
    expect((await db.planOrder.findUniqueOrThrow({ where: { id } })).amount).toBe(990000)
  })
})
```

Run: `pnpm test tests/integration/plan-orders.test.ts`
Expected: FAIL — `prices` undefined trong `plan.me`; đơn sau đổi giá vẫn 490.000 (giá hằng số); không có CONFLICT.

- [ ] **Step 10: Sửa `src/server/services/plan.service.ts`**

a) Import: bỏ `PLAN_PRICES` khỏi khối import `@/lib/plans`; thêm dòng:
```ts
import { getPlanPrices } from "./plan-price.service"
```

b) `getMyPlan`: thêm `getPlanPrices(db)` vào `Promise.all` và trả `prices`:
```ts
  const [fields, activeStudents, orders, pending, lastPlus, prices] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: PLAN_SELECT }),
    db.student.count({ where: { userId, isActive: true } }),
    db.planOrder.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, select: ORDER_SELECT }),
    db.planOrder.findFirst({ where: { userId, status: "pending" }, orderBy: { id: "desc" }, select: ORDER_SELECT }),
    findLastPlusOrder(db, userId),
    getPlanPrices(db),
  ])
```
và trong object trả về, thêm ngay sau `studentLimit: studentLimit(eff.plan),`:
```ts
    // Client hiện giá và gửi lại expectedAmount từ đây, cùng hàm tính với createOrder (spec L Q5).
    prices,
```

c) `createOrder`: xóa dòng `const amount = PLAN_PRICES[input.plan][input.period]`. Trong callback transaction, ngay sau dòng `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(${BigInt(userId)})\`` và TRƯỚC `// D14: …`, thêm:
```ts
        // Đọc giá trong transaction: đơn mang giá đã commit lúc tạo (spec L Q7/Q8). So trước khi hủy đơn chờ cũ.
        const amount = (await getPlanPrices(tx))[input.plan][input.period]
        if (input.expectedAmount !== undefined && input.expectedAmount !== amount) {
          throw new TRPCError({ code: "CONFLICT", message: "Giá gói vừa thay đổi, vui lòng xem lại giá mới" })
        }
```
Vòng thử lại khi trùng mã giữ nguyên (lần thử 2 đọc lại giá, không sao; `CONFLICT` không phải P2002 nên ném thẳng).

- [ ] **Step 11: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/plan-orders.test.ts`
Expected: PASS toàn file (gồm test cũ "client gửi thêm amount → bị bỏ qua").

Run: `pnpm test tests/integration/admin.test.ts`
Expected: PASS (quy đổi +150 / +22 ngày, preview overview vẫn đúng với chữ ký mới).

Run: `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx`
Expected: PASS (popup chưa đổi hành vi).

- [ ] **Step 12: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: sạch. Run (Bash): `grep -rn "PLAN_PRICES" src` → chỉ còn `src/lib/plans.ts`, `src/components/plan/PlanCompare.tsx`, `src/components/plan/PlanPurchaseDialog.tsx` (Task 4 xóa) và ghi chú cũ trong `src/lib/schemas/plan.ts` đã biến mất.

- [ ] **Step 13: Commit**

```bash
git add src/lib/plans.ts src/lib/schemas/plan.ts src/server/services/plan.service.ts src/server/services/plan-admin.service.ts src/components/plan/PlanPurchaseDialog.tsx tests/unit/lib/plans.test.ts tests/unit/schemas/plan.schema.test.ts tests/integration/plan-orders.test.ts
git commit -m "feat(l): đơn hàng đọc giá DB trong transaction, expectedAmount chống lệch giá, quy đổi theo tiền đơn Pro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: API admin đổi giá — `updatePricesSchema`, `updatePrices` (khóa + `expected`), `admin.prices` / `admin.updatePrices`

**Đọc trước:** Global Constraints; spec mục 4 (Q9, Q12–Q14), 7.2 (`updatePrices`), 7.5 (`updatePricesSchema`), 7.6, 10 (Integration `plan-prices.test.ts`, ý Race của `plan-orders.test.ts`, Unit schema), 11 (ý 4, 6); `src/server/services/plan-price.service.ts` (Task 1); `src/server/services/plan-admin.service.ts` (`approveOrder`: kiểu log `console.info`); `src/server/trpc/routers/admin.ts`; `src/lib/schemas/plan.ts`; `tests/integration/plan-prices.test.ts` (Task 1); `tests/integration/admin.test.ts` dòng 1–38 (cách đặt `ADMIN_USERNAMES`).

**Files:**
- Modify: `src/lib/schemas/plan.ts` (thêm `monthPriceSchema`, `updatePricesSchema`, `UpdatePricesInput`)
- Modify: `src/server/services/plan-price.service.ts` (thêm `SETTINGS_LOCK_CLASS`, `updatePrices`)
- Modify: `src/server/trpc/routers/admin.ts` (`prices`, `updatePrices`)
- Test (Sửa): `tests/unit/schemas/plan.schema.test.ts`, `tests/integration/plan-prices.test.ts`, `tests/integration/plan-orders.test.ts`

**Interfaces:**
- Consumes (Task 1): `getMonthlyPrices(db: Db)`, `getPriceHistory(db: Db)`; (Task 2): `plan.me.prices`, `createOrder({ …, expectedAmount })`.
- Produces:
  - `monthPriceSchema = z.number().int().min(10000).max(1000000)` (export, client Task 5 dùng).
  - `updatePricesSchema`: `{ prices: { plus: number; pro: number }; expected: { plus: number; pro: number } }`, refine `prices.pro > prices.plus` (message "Giá Pro phải cao hơn giá Plus", path `["prices", "pro"]`). `type UpdatePricesInput`.
  - `SETTINGS_LOCK_CLASS = 7401` (export; Task 6 dùng khóa `(7401, 1)`).
  - `updatePrices(db: PrismaClient, admin: string, input: UpdatePricesInput): Promise<{ changed: PaidPlan[] }>` — lỗi: `CONFLICT` "Bảng giá vừa được đổi ở nơi khác, tải lại để xem"; `BAD_REQUEST` "Giá chưa thay đổi"; `BAD_REQUEST` "Giá Pro phải cao hơn giá Plus".
  - tRPC `admin.prices` (query) → `{ monthly: { plus: number; pro: number }; history: PriceChangeRow[] }` (client: `createdAt` là `string`); `admin.updatePrices` (mutation, input `updatePricesSchema`) → `{ changed: ("plus" | "pro")[] }`. Cả 2 là `adminProcedure`; `changedBy` lấy `ctx.session.user.username`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Unit test schema (RED)**

Trong `tests/unit/schemas/plan.schema.test.ts`, đổi dòng import thành `import { createOrderSchema, updatePricesSchema } from "@/lib/schemas/plan"` và thêm cuối file:
```ts
describe("updatePricesSchema (spec L Q12, Q13)", () => {
  const expected = { plus: 49000, pro: 99000 }
  const ok = (plus: number, pro: number) => updatePricesSchema.safeParse({ prices: { plus, pro }, expected }).success

  it("giá lẻ 49.900 hợp lệ (không bắt buộc chẵn nghìn); biên 10.000 và 1.000.000 hợp lệ", () => {
    expect(ok(49900, 99000)).toBe(true)
    expect(ok(10000, 1000000)).toBe(true)
  })
  it("không nguyên hoặc ngoài 10.000–1.000.000 → lỗi", () => {
    expect(ok(49900.5, 99000)).toBe(false)
    expect(ok(9000, 99000)).toBe(false)
    expect(ok(49000, 1001000)).toBe(false)
  })
  it("Pro phải cao hơn Plus: bằng nhau hoặc thấp hơn → lỗi ở prices.pro", () => {
    const r = updatePricesSchema.safeParse({ prices: { plus: 99000, pro: 99000 }, expected })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]).toMatchObject({ message: "Giá Pro phải cao hơn giá Plus", path: ["prices", "pro"] })
    expect(ok(99000, 50000)).toBe(false)
  })
  it("expected không giới hạn khoảng (giá hiện hành có thể là giá cũ ngoài khoảng)", () => {
    expect(updatePricesSchema.safeParse({ prices: { plus: 49000, pro: 99000 }, expected: { plus: 5000, pro: 99000 } }).success).toBe(true)
  })
})
```

Run: `pnpm test tests/unit/schemas/plan.schema.test.ts`
Expected: FAIL — `updatePricesSchema` undefined (`Cannot read properties of undefined (reading 'safeParse')`).

- [ ] **Step 3: Thêm schema vào `src/lib/schemas/plan.ts`**

Thêm ngay dưới `createOrderSchema`:
```ts
// Giá lẻ được phép (người dùng chốt Q12); khoảng chỉ để chặn gõ thừa/thiếu số 0. ×20 tối đa 20 triệu vẫn vừa Int.
export const monthPriceSchema = z.number().int().min(10000).max(1000000)

export const updatePricesSchema = z
  .object({
    prices: z.object({ plus: monthPriceSchema, pro: monthPriceSchema }),
    // Giá admin đang thấy, để phát hiện bảng giá vừa đổi ở tab khác; không giới hạn khoảng.
    expected: z.object({ plus: z.number().int(), pro: z.number().int() }),
  })
  // D7 (quy đổi, chặn Plus khi còn Pro) giả định Pro đắt hơn (spec L Q13).
  .refine((d) => d.prices.pro > d.prices.plus, { message: "Giá Pro phải cao hơn giá Plus", path: ["prices", "pro"] })
```
và cuối file thêm:
```ts
export type UpdatePricesInput = z.infer<typeof updatePricesSchema>
```

Run: `pnpm test tests/unit/schemas/plan.schema.test.ts`
Expected: PASS.

- [ ] **Step 4: Integration test admin API giá (RED)**

Trong `tests/integration/plan-prices.test.ts`:

a) Sửa import đầu file thành:
```ts
import { describe, it, expect, afterEach, afterAll, beforeEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { getMonthlyPrices, getPlanPrices, getPriceHistory, updatePrices } from "@/server/services/plan-price.service"
```

b) Thêm ngay dưới khối `afterEach` hiện có:
```ts
beforeEach(() => {
  process.env.ADMIN_USERNAMES = "admin_test"
})
afterAll(() => {
  delete process.env.ADMIN_USERNAMES
})
```

c) Thêm cuối file:
```ts
describe("admin.prices / admin.updatePrices", () => {
  const expected = { plus: 49000, pro: 99000 }
  const testRows = () => db.planPriceChange.findMany({ where: { changedBy: { not: "migration" } }, orderBy: { id: "asc" } })

  it("giáo viên → FORBIDDEN cả 2 procedure", async () => {
    const t = await getAuthedCaller("teacher_std")
    await expect(t.admin.prices()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected })).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(await testRows()).toHaveLength(0)
  })

  it("admin xem: monthly 49.000/99.000, lịch sử có 2 dòng seed", async () => {
    const r = await (await getAuthedCaller("admin_test")).admin.prices()
    expect(r.monthly).toEqual(expected)
    const seed = r.history.filter((h) => h.changedBy === "migration").map((h) => [h.plan, h.monthPrice, h.previousMonthPrice])
    expect(seed.sort()).toEqual([
      ["plus", 49000, null],
      ["pro", 99000, null],
    ])
  })

  it("đổi Plus 59.000 (Pro giữ) → 1 dòng, changedBy từ session; plan.me thấy giá mới", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected })).resolves.toEqual({ changed: ["plus"] })
    const rows = await testRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "admin_test" })
    expect((await (await getAuthedCaller("teacher_std")).plan.me()).prices.plus).toEqual({ month: 59000, year: 590000, "2year": 1180000 })
    expect((await admin.admin.prices()).monthly).toEqual({ plus: 59000, pro: 99000 })
  })

  it("giá lẻ, đổi cả 2 gói → 2 dòng cùng lần Lưu", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: { plus: 49900, pro: 129000 }, expected })).resolves.toEqual({ changed: ["plus", "pro"] })
    expect((await testRows()).map((r) => [r.plan, r.previousMonthPrice, r.monthPrice])).toEqual([
      ["plus", 49000, 49900],
      ["pro", 99000, 129000],
    ])
  })

  it("expected sai → CONFLICT, không thêm dòng", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected: { plus: 45000, pro: 99000 } })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Bảng giá vừa được đổi ở nơi khác, tải lại để xem",
    })
    expect(await testRows()).toHaveLength(0)
  })

  it("không đổi gì → BAD_REQUEST Giá chưa thay đổi", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updatePrices({ prices: expected, expected })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Giá chưa thay đổi" })
    expect(await testRows()).toHaveLength(0)
  })

  it("ngoài khoảng / không nguyên / Pro ≤ Plus → BAD_REQUEST (zod); service tự chặn Pro ≤ Plus khi bỏ qua zod", async () => {
    const admin = await getAuthedCaller("admin_test")
    for (const prices of [{ plus: 9000, pro: 99000 }, { plus: 49000, pro: 1001000 }, { plus: 49900.5, pro: 99000 }, { plus: 99000, pro: 99000 }]) {
      await expect(admin.admin.updatePrices({ prices, expected })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    }
    await expect(updatePrices(db, "admin_test", { prices: { plus: 99000, pro: 99000 }, expected })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Giá Pro phải cao hơn giá Plus",
    })
    expect(await testRows()).toHaveLength(0)
  })

  it("Review Focus 2: 2 lần Lưu cùng lúc cùng expected → đúng 1 thành công, lần kia CONFLICT, lịch sử 1 dòng", async () => {
    const admin = await getAuthedCaller("admin_test")
    const input = { prices: { plus: 59000, pro: 99000 }, expected }
    const results = await Promise.allSettled([admin.admin.updatePrices(input), admin.admin.updatePrices(input)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: "CONFLICT" })
    expect(await testRows()).toHaveLength(1)
  })
})
```

Run: `pnpm test tests/integration/plan-prices.test.ts`
Expected: FAIL — `updatePrices` không được export; `admin.prices` không phải hàm.

- [ ] **Step 5: Thêm `updatePrices` vào `src/server/services/plan-price.service.ts`**

Thêm import đầu file:
```ts
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import type { UpdatePricesInput } from "@/lib/schemas/plan"
```
Thêm cuối file:
```ts
// Khóa 2 tham số int ở không gian khóa riêng của Postgres, không đụng khóa 1 tham số theo userId (createOrder/approveOrder).
// Khóa thứ 2: 0 = bảng giá, 1 = số ngày dùng thử mặc định.
export const SETTINGS_LOCK_CLASS = 7401
const PRICE_LOCK_KEY = 0

export async function updatePrices(db: PrismaClient, admin: string, input: UpdatePricesInput): Promise<{ changed: PaidPlan[] }> {
  const { changed, current } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETTINGS_LOCK_CLASS}::int, ${PRICE_LOCK_KEY}::int)`
    const current = await getMonthlyPrices(tx)
    // So với giá admin đang thấy: 2 tab/2 admin Lưu cùng lúc thì lần sau bị chặn, lịch sử luôn liền mạch cũ → mới (spec L Q9).
    if (current.plus !== input.expected.plus || current.pro !== input.expected.pro) {
      throw new TRPCError({ code: "CONFLICT", message: "Bảng giá vừa được đổi ở nơi khác, tải lại để xem" })
    }
    const changed = PAID_PLANS.filter((p) => input.prices[p] !== current[p])
    if (changed.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Giá chưa thay đổi" })
    if (input.prices.pro <= input.prices.plus) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Giá Pro phải cao hơn giá Plus" })
    }
    await tx.planPriceChange.createMany({
      data: changed.map((plan) => ({ plan, monthPrice: input.prices[plan], previousMonthPrice: current[plan], changedBy: admin })),
    })
    return { changed, current }
  })
  console.info(`[admin] ${admin} đổi giá ${changed.map((p) => `${p} ${current[p]}→${input.prices[p]}`).join(", ")}`)
  return { changed }
}
```

- [ ] **Step 6: Thêm procedure vào `src/server/trpc/routers/admin.ts`**

Thay nội dung file bằng:
```ts
import { adminProcedure, createTRPCRouter } from "@/server/trpc"
import { orderIdSchema, rejectOrderSchema, setPlanSchema, updatePricesSchema } from "@/lib/schemas/plan"
import { adminSetPlan, approveOrder, getAdminOverview, getOrderHistory, rejectOrder } from "@/server/services/plan-admin.service"
import { getMonthlyPrices, getPriceHistory, updatePrices } from "@/server/services/plan-price.service"

export const adminRouter = createTRPCRouter({
  overview: adminProcedure.query(({ ctx }) => getAdminOverview(ctx.db)),
  orderHistory: adminProcedure.query(({ ctx }) => getOrderHistory(ctx.db)),

  prices: adminProcedure.query(async ({ ctx }) => {
    const [monthly, history] = await Promise.all([getMonthlyPrices(ctx.db), getPriceHistory(ctx.db)])
    return { monthly, history }
  }),

  approveOrder: adminProcedure
    .input(orderIdSchema)
    .mutation(({ ctx, input }) => approveOrder(ctx.db, ctx.session.user.username, input.id)),

  rejectOrder: adminProcedure
    .input(rejectOrderSchema)
    .mutation(({ ctx, input }) => rejectOrder(ctx.db, ctx.session.user.username, input.id, input.note)),

  setPlan: adminProcedure
    .input(setPlanSchema)
    .mutation(({ ctx, input }) => adminSetPlan(ctx.db, ctx.session.user.username, input)),

  updatePrices: adminProcedure
    .input(updatePricesSchema)
    .mutation(({ ctx, input }) => updatePrices(ctx.db, ctx.session.user.username, input)),
})
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/plan-prices.test.ts`
Expected: PASS toàn file (3 test đọc của Task 1 + 8 test mới). Lỗi `function pg_advisory_xact_lock(bigint, bigint) does not exist` → kiểm lại đã cast `::int` cả 2 tham số.

- [ ] **Step 8: Test race tạo đơn vs đổi giá (spec 10, `plan-orders.test.ts`)**

Thêm vào cuối `describe("giá từ DB (spec L)", …)` trong `tests/integration/plan-orders.test.ts`:
```ts
  it("race: tạo đơn (expectedAmount giá cũ) song song admin đổi giá → đơn luôn đúng giá đã thấy, nếu không thì CONFLICT và không có đơn", async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    const teacher = await getAuthedCaller("teacher_std")
    const admin = await getAuthedCaller("admin_test")
    for (let i = 0; i < 5; i++) {
      await db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })
      await db.planOrder.deleteMany({ where: { userId } })
      const [order, update] = await Promise.allSettled([
        teacher.plan.createOrder({ plan: "plus", period: "year", expectedAmount: 490000 }),
        admin.admin.updatePrices({ prices: { plus: 59000, pro: 99000 }, expected: { plus: 49000, pro: 99000 } }),
      ])
      expect(update.status).toBe("fulfilled")
      if (order.status === "fulfilled") {
        expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.value.id } })).amount).toBe(490000)
      } else {
        expect(order.reason).toMatchObject({ code: "CONFLICT" })
        expect(await db.planOrder.count({ where: { userId } })).toBe(0)
      }
    }
  })
```

Run: `pnpm test tests/integration/plan-orders.test.ts`
Expected: PASS toàn file (không deadlock: 2 luồng dùng 2 không gian khóa khác nhau).

- [ ] **Step 9: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: sạch.

- [ ] **Step 10: Commit**

```bash
git add src/lib/schemas/plan.ts src/server/services/plan-price.service.ts src/server/trpc/routers/admin.ts tests/unit/schemas/plan.schema.test.ts tests/integration/plan-prices.test.ts tests/integration/plan-orders.test.ts
git commit -m "feat(l): API admin xem/đổi bảng giá (khóa advisory, expected chống ghi đè, Pro > Plus)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: `/plan` và popup đọc `me.prices`, gửi `expectedAmount`, xử lý CONFLICT; xóa `PLAN_PRICES`

**Đọc trước:** Global Constraints; spec mục 4 (Q5, Q6), 8.3, 9 (key `plan_price_changed`), 10 (Unit `PlanPurchaseDialog.test.tsx`; E2E ý "Giá đổi khi popup đang mở"), 11 (ý 5, 7); `src/components/plan/PlanPurchaseDialog.tsx`; `src/components/plan/PlanCompare.tsx`; `src/components/sessions/SessionFormDialog.tsx` dòng 135–175 (mẫu `err.data?.code === "CONFLICT"`); `tests/unit/components/PlanPurchaseDialog.test.tsx`; `tests/unit/components/PlanCompare.test.tsx`; `tests/e2e/plan.spec.ts` dòng 1–45 (helper `login`, `resetStd`).

**Files:**
- Modify: `src/components/plan/PlanPurchaseDialog.tsx`
- Modify: `src/components/plan/PlanCompare.tsx`
- Modify: `src/lib/plans.ts` (xóa `PLAN_PRICES`)
- Modify: `src/language/vi.json`, `src/language/en.json` (key `plan_price_changed`)
- Test (Sửa): `tests/unit/components/PlanPurchaseDialog.test.tsx`, `tests/unit/components/PlanCompare.test.tsx`, `tests/unit/lib/plans.test.ts`, `tests/e2e/plan.spec.ts`

**Interfaces:**
- Consumes (Task 2): `RouterOutputs["plan"]["me"]["prices"]` (`PlanPrices`); `computeUpgradeCredit(u, lastPlusOrder, targetPeriod, targetPrice, now)`; `plan.createOrder` nhận `expectedAmount`, trả `CONFLICT` khi giá lệch. (Task 1): `pricesFromMonthly`.
- Produces: `PlanPurchaseDialog` gọi `create.mutate({ plan, period, expectedAmount })`; khi `CONFLICT` → `toast.error(t("plan_price_changed"))` + `trpc.useUtils().plan.me.invalidate()`, popup giữ bước chọn. `PLAN_PRICES` không còn tồn tại.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Sửa fixture + viết unit test popup (RED)**

Trong `tests/unit/components/PlanPurchaseDialog.test.tsx`:

a) Import: đổi `import { addDays, vnStartOfDay, type PlanFields } from "@/lib/plans"` thành
```ts
import { addDays, pricesFromMonthly, vnStartOfDay, type PlanFields } from "@/lib/plans"
import { toast } from "sonner"
```

b) Thay khối từ dòng `type CreateOpts = …` tới hết `vi.mock("@/lib/trpc", …)` (gồm cả 2 dòng `vi.mock("sonner")`, `vi.mock("qrcode")` nằm giữa) bằng:
```ts
type CreateOpts = {
  onSuccess?: (res: { id: number; code: string; bonusMonths: number }) => void
  onError?: (e: { message: string; data?: { code?: string } | null }) => void
}

const mut = vi.hoisted(() => ({ create: vi.fn(), createOpts: null as null | CreateOpts, invalidate: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ plan: { me: { invalidate: mut.invalidate } } }),
    plan: {
      createOrder: {
        useMutation: (opts: CreateOpts) => {
          mut.createOpts = opts
          return { mutate: mut.create, isPending: false }
        },
      },
      cancelOrder: {
        useMutation: (opts: { onSuccess?: () => void }) => ({ mutate: () => opts.onSuccess?.(), isPending: false }),
      },
    },
  },
}))
```

c) Trong `makeMe`, thêm ngay sau `isAdmin: false,`:
```ts
    prices: pricesFromMonthly({ plus: 49000, pro: 99000 }),
```

d) Test "chọn Plus + 24 tháng …": đổi dòng cuối thành
```ts
    expect(mut.create).toHaveBeenCalledWith({ plan: "plus", period: "2year", expectedAmount: 980000 })
```

e) Thêm cuối `describe("PlanPurchaseDialog", …)`:
```ts
  it("giá theo me.prices: Plus 59.000 → 12 tháng 590.000; Tạo đơn gửi expectedAmount đang hiện", () => {
    renderDialog({ me: makeMe({ prices: pricesFromMonthly({ plus: 59000, pro: 129000 }) }), initialPlan: "plus" })
    expect(text("purchase-plan-plus")).toContain("59.000")
    expect(text("purchase-plan-pro")).toContain("129.000")
    expect(text("purchase-period-year")).toContain("590.000")
    expect(text("purchase-period-2year")).toContain("1.180.000")
    expect(text("purchase-summary")).toContain("590.000")
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    expect(mut.create).toHaveBeenCalledWith({ plan: "plus", period: "year", expectedAmount: 590000 })
  })

  it("server báo CONFLICT (giá vừa đổi) → toast giá đổi + nạp lại plan.me, popup giữ bước chọn", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onError!({ message: "Giá gói vừa thay đổi, vui lòng xem lại giá mới", data: { code: "CONFLICT" } }))
    expect(toast.error).toHaveBeenCalledWith("Giá gói vừa thay đổi, đã cập nhật giá mới. Vui lòng xem lại trước khi tạo đơn.")
    expect(mut.invalidate).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("purchase-summary")).toBeTruthy()
  })

  it("lỗi khác → toast đúng message server, không nạp lại plan.me", () => {
    renderDialog()
    act(() => mut.createOpts!.onError!({ message: "Chưa mở thanh toán", data: { code: "PRECONDITION_FAILED" } }))
    expect(toast.error).toHaveBeenCalledWith("Chưa mở thanh toán")
    expect(mut.invalidate).not.toHaveBeenCalled()
  })

  it("Review Focus 5: Plus còn 45 ngày chọn Pro năm; giá Pro đổi 129.000 → xem trước +17 ngày Pro theo giá đơn sẽ tạo", () => {
    const fields: PlanFields = { plan: "plus", planExpiresAt: addDays(vnStartOfDay(new Date()), 45), trialEndsAt: null }
    const me = makeMe({ plan: "plus", source: "paid", paidPlan: "plus", plusCreditOrder: { amount: 490000, period: "year", bonusMonths: 0 } })
    const { rerender } = renderDialog({ me, fields, initialPlan: "pro" })
    expect(text("purchase-summary")).toContain("+22 ngày Pro")
    rerender({ me: { ...me, prices: pricesFromMonthly({ plus: 49000, pro: 129000 }) } })
    // floor(60.411 × 365 / 1.290.000) = 17
    expect(text("purchase-summary")).toContain("+17 ngày Pro")
    expect(text("purchase-summary")).toContain("1.290.000")
  })
```

Run: `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx`
Expected: FAIL — 4 test mới/sửa đỏ: giá vẫn 49.000 (hằng số), `mutate` thiếu `expectedAmount`, CONFLICT gọi `toast.error(e.message)` và không `invalidate`.

- [ ] **Step 3: Thêm key i18n**

`src/language/vi.json` — thêm ngay sau dòng `"plan_order_created": …`:
```json
  "plan_price_changed": "Giá gói vừa thay đổi, đã cập nhật giá mới. Vui lòng xem lại trước khi tạo đơn.",
```
`src/language/en.json` — cùng vị trí:
```json
  "plan_price_changed": "Prices just changed and have been updated. Please review before creating the order.",
```

- [ ] **Step 4: Sửa `src/components/plan/PlanPurchaseDialog.tsx`**

a) Bỏ `PLAN_PRICES,` khỏi khối import `@/lib/plans`.

b) Thay đoạn từ `const credit = …` tới hết `const create = trpc.plan.createOrder.useMutation({ … })` bằng:
```tsx
  const prices = me.prices
  const price = prices[choice.plan][choice.period]
  const credit =
    choice.plan === "pro" ? computeUpgradeCredit(fields, me.plusCreditOrder, choice.period, prices.pro[choice.period], now) : null
  const newExpiry = addDays(computeNewExpiry(fields, choice.plan, choice.period, now, bonus), credit?.creditDays ?? 0)

  const utils = trpc.useUtils()
  const create = trpc.plan.createOrder.useMutation({
    onSuccess: (res) => {
      toast.success(t("plan_order_created"))
      setCreatedId(res.id)
    },
    onError: (e) => {
      // Admin vừa đổi giá: server không tạo đơn; nạp lại giá, giữ popup ở bước chọn (spec L Q6).
      if (e.data?.code === "CONFLICT") {
        toast.error(t("plan_price_changed"))
        void utils.plan.me.invalidate()
        return
      }
      toast.error(e.message)
    },
  })
```
(dòng `const newExpiry = …` và `const price = …` cũ bị thay thế trong đoạn trên — không để trùng khai báo.)

c) Giá tháng trên thẻ gói: thay `formatCurrency(PLAN_PRICES[plan].month)` bằng `formatCurrency(prices[plan].month)`.

d) Giá từng kỳ: thay `formatCurrency(PLAN_PRICES[choice.plan][period])` bằng `formatCurrency(prices[choice.plan][period])`.

e) Nút Tạo đơn: thay `onClick={() => create.mutate(choice)}` bằng
```tsx
                onClick={() => create.mutate({ ...choice, expectedAmount: price })}
```

Run: `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx`
Expected: PASS toàn file.

- [ ] **Step 5: Unit test `PlanCompare` (RED)**

Trong `tests/unit/components/PlanCompare.test.tsx`: thêm import `import { pricesFromMonthly } from "@/lib/plans"`; trong `makeMe` thêm sau `isAdmin: false,`:
```ts
    prices: pricesFromMonthly({ plus: 49000, pro: 99000 }),
```
Thêm cuối `describe("PlanCompare", …)`:
```tsx
  it("giá thẻ Plus/Pro lấy từ me.prices (tháng, năm, 2 năm)", () => {
    renderCompare(makeMe({ prices: pricesFromMonthly({ plus: 59000, pro: 129000 }) }))
    const plus = screen.getByTestId("plan-card-plus").textContent ?? ""
    expect(plus).toContain("59.000")
    expect(plus).toContain("590.000")
    expect(plus).toContain("1.180.000")
    const pro = screen.getByTestId("plan-card-pro").textContent ?? ""
    expect(pro).toContain("129.000")
    expect(pro).toContain("1.290.000")
    expect(pro).toContain("2.580.000")
  })
```

Run: `pnpm test tests/unit/components/PlanCompare.test.tsx`
Expected: FAIL — thẻ Plus vẫn "49.000".

- [ ] **Step 6: Sửa `src/components/plan/PlanCompare.tsx`**

Bỏ `PLAN_PRICES,` khỏi import. Trong khối giá (nhánh `plan !== "standard"`), thay 3 chỗ `PLAN_PRICES[plan]` bằng `me.prices[plan]`:
```tsx
                  <p>
                    <span className="text-2xl font-semibold text-foreground">{formatCurrency(me.prices[plan].month)}</span>
                    {t("plan_per_month")}
                  </p>
                  <p>
                    {formatCurrency(me.prices[plan].year)}
                    {t("plan_per_year")} · {t("plan_save_2_months")}
                  </p>
                  <p>
                    {formatCurrency(me.prices[plan]["2year"])}
                    {t("plan_per_2years")} · {t("plan_bonus_months").replace("{n}", String(TWO_YEAR_BONUS_MONTHS))}
                  </p>
```

Run: `pnpm test tests/unit/components/PlanCompare.test.tsx`
Expected: PASS.

- [ ] **Step 7: Xóa `PLAN_PRICES`**

`src/lib/plans.ts`: xóa khối `export const PLAN_PRICES … }` (4 dòng). `tests/unit/lib/plans.test.ts`: xóa `PLAN_PRICES,` khỏi import và xóa cả `describe("giá", …)` (test hằng số cũ; `describe("pricesFromMonthly (spec L Q2)")` của Task 1 thay thế).

Run (Bash):
```bash
grep -rn "PLAN_PRICES" src tests
grep -rnE "\b(49000|99000|490000|990000)\b" src
```
Expected: lệnh 1 không in gì; lệnh 2 chỉ in dòng `DEFAULT_MONTH_PRICES` trong `src/lib/plans.ts`.

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: PASS.

- [ ] **Step 8: E2E giá đổi khi popup đang mở (RED rồi GREEN ngay vì code đã xong — chạy để xác nhận)**

Thêm cuối `tests/e2e/plan.spec.ts`:
```ts
test.describe('Giá đổi khi popup đang mở (spec L Q6, 1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // tests/setup.ts không xóa bảng giá: dọn để file e2e khác thấy 49.000/99.000.
  const resetPrices = () => db.planPriceChange.deleteMany({ where: { changedBy: { not: 'migration' } } });
  test.beforeEach(async () => {
    await resetPrices();
    await resetStd();
  });
  test.afterEach(async () => {
    await resetPrices();
    await resetStd();
  });

  test('bấm Tạo đơn sau khi admin đổi giá → báo giá đổi, hiện giá mới, chưa tạo đơn; bấm lại → QR theo giá mới', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.goto('/plan');
    await page.getByTestId('plan-card-plus').getByRole('button', { name: 'Chọn gói Plus' }).click();
    const popup = page.getByTestId('plan-purchase');
    const summary = popup.getByTestId('purchase-summary');
    await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
    await expect(summary).toContainText('490.000');

    await db.planPriceChange.create({ data: { plan: 'plus', monthPrice: 59000, previousMonthPrice: 49000, changedBy: 'e2e_price' } });
    await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
    await expect(page.getByText('Giá gói vừa thay đổi, đã cập nhật giá mới. Vui lòng xem lại trước khi tạo đơn.')).toBeVisible();
    await expect(summary).toContainText('590.000');
    await expect(popup.getByTestId('pending-order')).toHaveCount(0);
    expect(await db.planOrder.count({ where: { user: { username: 'teacher_std' } } })).toBe(0);

    await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
    const pending = popup.getByTestId('pending-order');
    await expect(pending).toBeVisible();
    await expect(pending).toContainText('590.000');
  });
});
```

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/plan.spec.ts
```
Expected: seed PASS; e2e toàn bộ `plan.spec.ts` passed (các test cũ vẫn thấy 490.000/990.000 vì giá DB = seed).

Run: `pnpm exec playwright test tests/e2e/renew-offer.spec.ts tests/e2e/plan-locks.spec.ts`
Expected: passed (không sửa).

- [ ] **Step 9: tsc + lint + theme**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test tests/unit/theme-legacy-colors.test.ts
```
Expected: sạch / PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/plan/PlanPurchaseDialog.tsx src/components/plan/PlanCompare.tsx src/lib/plans.ts src/language/vi.json src/language/en.json tests/unit/components/PlanPurchaseDialog.test.tsx tests/unit/components/PlanCompare.test.tsx tests/unit/lib/plans.test.ts tests/e2e/plan.spec.ts
git commit -m "feat(l): /plan và popup mua gói hiện giá từ DB, gửi expectedAmount, báo giá vừa đổi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: Màn `/admin/prices` — nav 4 mục, form giá (xem trước, lỗi tại chỗ, xác nhận), lịch sử đổi giá

**Đọc trước:** Global Constraints; spec mục 2, 4 (Q15, Q16), 8.1, 8.2, 9, 10 (E2E `admin-prices.spec.ts`, `admin.spec.ts`), 11 (ý 7); `src/components/admin/admin-nav.ts`; `src/components/admin/AdminTabBar.tsx`; `src/components/admin/AdminSidebar.tsx`; `src/components/admin/AdminOrderHistory.tsx` (mẫu `ResponsiveList`); `src/components/admin/AdminPendingOrders.tsx` (mẫu `AlertDialog`); `src/components/admin/admin-format.ts`; `src/components/ui/currency-input.tsx` (hiển thị `toLocaleString("en-US")`, parse bằng `parseInt` sau khi bỏ dấu phẩy); `src/app/(admin)/admin/history/page.tsx`; `tests/unit/components/AdminNav.test.tsx`; `tests/e2e/admin.spec.ts`.

**Files:**
- Modify: `src/language/vi.json`, `src/language/en.json` (key `admin_price*`, `admin_prices`, `admin_tab_prices`)
- Modify: `src/components/admin/admin-nav.ts`, `src/components/admin/AdminTabBar.tsx`
- Modify: `src/components/admin/admin-format.ts` (thêm `dateTimeVn`)
- Create: `src/components/admin/AdminPrices.tsx`
- Create: `src/app/(admin)/admin/prices/page.tsx`
- Test (Mới): `tests/unit/components/AdminPrices.test.tsx`, `tests/e2e/admin-prices.spec.ts`
- Test (Sửa): `tests/unit/components/AdminNav.test.tsx`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes (Task 3): tRPC `admin.prices` → `{ monthly: { plus: number; pro: number }; history: { id: number; plan: string; monthPrice: number; previousMonthPrice: number | null; changedBy: string; createdAt: string }[] }`; `admin.updatePrices({ prices, expected })`; `monthPriceSchema` từ `@/lib/schemas/plan`. (Task 1): `pricesFromMonthly`, `PERIOD_PRICE_FACTOR`.
- Produces:
  - `dateTimeVn(d: string): string` trong `src/components/admin/admin-format.ts` ("dd/mm/yyyy HH:mm" giờ VN) — Task 6 dùng.
  - Component `AdminPrices` (không prop). Test id: `admin-prices-form`, `price-plus`, `price-pro`, `price-confirm`, `price-history-card`. Ô nhập `aria-label` "Giá tháng Plus" / "Giá tháng Pro".
  - Route `/admin/prices` (`src/app/(admin)/admin/prices/page.tsx`, default export `AdminPricesPage`) — Task 6 thêm `TrialDaysForm` vào trang này.
  - `ADMIN_NAV_ITEMS[3] = { href: "/admin/prices", labelKey: "admin_prices", shortKey: "admin_tab_prices", icon: Tags }`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Thêm key i18n**

`src/language/vi.json`: dòng cuối hiện là `  "admin_no_history": "Chưa có đơn nào"` → thêm dấu phẩy cuối dòng đó và chèn ngay sau (trước `}`):
```json
  "admin_prices": "Bảng giá",
  "admin_tab_prices": "Bảng giá",
  "admin_price_month": "Giá tháng",
  "admin_price_current": "Hiện tại: {amount}/tháng",
  "admin_price_preview_year": "12 tháng: {amount}",
  "admin_price_preview_2year": "24 tháng: {amount}",
  "admin_price_save": "Lưu bảng giá",
  "admin_price_confirm_title": "Đổi bảng giá?",
  "admin_price_confirm_note": "Áp dụng ngay cho đơn tạo mới. Đơn đang chờ và gói đã mua giữ nguyên số tiền.",
  "admin_price_confirm": "Xác nhận đổi giá",
  "admin_price_old": "Giá cũ",
  "admin_price_new": "Giá mới",
  "admin_price_saved": "Đã cập nhật bảng giá",
  "admin_price_history": "Lịch sử đổi giá",
  "admin_price_initial": "Giá ban đầu",
  "admin_price_changed_by": "Người đổi",
  "admin_price_time": "Thời gian",
  "admin_price_no_history": "Chưa có lịch sử đổi giá",
  "admin_price_err_range": "Giá tháng từ 10.000 đến 1.000.000",
  "admin_price_err_order": "Giá Pro phải cao hơn giá Plus"
```
`src/language/en.json`: dòng cuối `  "admin_no_history": "No orders yet"` → thêm dấu phẩy và chèn:
```json
  "admin_prices": "Pricing",
  "admin_tab_prices": "Pricing",
  "admin_price_month": "Monthly price",
  "admin_price_current": "Current: {amount}/month",
  "admin_price_preview_year": "12 months: {amount}",
  "admin_price_preview_2year": "24 months: {amount}",
  "admin_price_save": "Save pricing",
  "admin_price_confirm_title": "Change pricing?",
  "admin_price_confirm_note": "Applies to new orders right away. Pending orders and purchased plans keep their amount.",
  "admin_price_confirm": "Confirm",
  "admin_price_old": "Old",
  "admin_price_new": "New",
  "admin_price_saved": "Pricing updated",
  "admin_price_history": "Price history",
  "admin_price_initial": "Initial price",
  "admin_price_changed_by": "Changed by",
  "admin_price_time": "Time",
  "admin_price_no_history": "No price changes yet",
  "admin_price_err_range": "Monthly price must be 10,000 to 1,000,000",
  "admin_price_err_order": "Pro must cost more than Plus"
```
Run (Bash):
```bash
node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(JSON.stringify([a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k))]))"
```
Expected: `[[],[]]`.

- [ ] **Step 3: Sửa test nav (RED)**

Trong `tests/unit/components/AdminNav.test.tsx`:
- Test `AdminSidebar` đầu tiên: tên test đổi "đúng 3 mục admin" → "đúng 4 mục admin"; mảng href đổi thành:
```tsx
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/admin/orders",
      "/admin/accounts",
      "/admin/history",
      "/admin/prices",
    ])
```
  và thêm sau dòng `expect(screen.getByRole("link", { name: /Tài khoản & gói/ })…`:
```tsx
    expect(screen.getByRole("link", { name: "Bảng giá" }).getAttribute("aria-current")).toBeNull()
```
- Test `AdminTabBar`: tên "3 tab nhãn ngắn" → "4 tab nhãn ngắn"; mảng đổi thành:
```tsx
    expect(links.map((l) => [l.getAttribute("href"), l.textContent])).toEqual([
      ["/admin/orders", "Đơn chờ"],
      ["/admin/accounts", "Tài khoản"],
      ["/admin/history", "Lịch sử"],
      ["/admin/prices", "Bảng giá"],
    ])
```
  và thêm cuối test:
```tsx
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).querySelector("ul")?.className).toContain("grid-cols-4")
```

Run: `pnpm test tests/unit/components/AdminNav.test.tsx`
Expected: FAIL — chỉ có 3 link, không có `grid-cols-4`.

- [ ] **Step 4: Thêm mục nav**

`src/components/admin/admin-nav.ts`:
```ts
import { History, Inbox, Tags, Users, type LucideIcon } from "lucide-react"
import type vi from "@/language/vi.json"

export type AdminNavItem = { href: string; labelKey: keyof typeof vi; shortKey: keyof typeof vi; icon: LucideIcon }

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/orders", labelKey: "admin_pending_orders", shortKey: "admin_tab_orders", icon: Inbox },
  { href: "/admin/accounts", labelKey: "admin_accounts_plans", shortKey: "admin_tab_accounts", icon: Users },
  { href: "/admin/history", labelKey: "admin_order_history", shortKey: "admin_tab_history", icon: History },
  { href: "/admin/prices", labelKey: "admin_prices", shortKey: "admin_tab_prices", icon: Tags },
]
```
`src/components/admin/AdminTabBar.tsx`: `<ul className="grid grid-cols-3">` → `<ul className="grid grid-cols-4">`.

Run: `pnpm test tests/unit/components/AdminNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Unit test `AdminPrices` (RED)**

Tạo `tests/unit/components/AdminPrices.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { toast } from "sonner"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminPrices } from "@/components/admin/AdminPrices"

type MutOpts = { onSuccess?: () => void; onError?: (e: { message: string; data?: { code?: string } | null }) => void }

const h = vi.hoisted(() => ({ mutate: vi.fn(), opts: null as null | MutOpts, invalidate: vi.fn(), data: undefined as unknown }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { prices: { invalidate: h.invalidate } } }),
    admin: {
      prices: { useQuery: () => ({ data: h.data, isPending: h.data === undefined, isError: false, refetch: vi.fn() }) },
      updatePrices: {
        useMutation: (opts: MutOpts) => {
          h.opts = opts
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

const DATA = {
  monthly: { plus: 49000, pro: 99000 },
  history: [
    { id: 3, plan: "plus", monthPrice: 59000, previousMonthPrice: 49000, changedBy: "admin_test", createdAt: "2026-09-27T03:05:00.000Z" },
    { id: 1, plan: "plus", monthPrice: 49000, previousMonthPrice: null, changedBy: "migration", createdAt: "2026-09-27T01:00:00.000Z" },
  ],
}

function renderPrices() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AdminPrices />
    </LanguageProvider>
  )
}
const plusInput = () => screen.getByRole("textbox", { name: "Giá tháng Plus" }) as HTMLInputElement
const proInput = () => screen.getByRole("textbox", { name: "Giá tháng Pro" }) as HTMLInputElement
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const saveButton = () => screen.getByRole("button", { name: "Lưu bảng giá" }) as HTMLButtonElement
const block = (plan: "plus" | "pro") => screen.getByTestId(`price-${plan}`).textContent ?? ""

beforeEach(() => {
  vi.clearAllMocks()
  h.opts = null
  h.data = DATA
})

describe("AdminPrices", () => {
  it("hiện giá hiện hành + xem trước 12/24 tháng; chưa đổi thì nút Lưu khóa", () => {
    renderPrices()
    expect(screen.getByRole("heading", { level: 1, name: "Bảng giá" })).toBeTruthy()
    expect(plusInput().value).toBe("49,000")
    expect(proInput().value).toBe("99,000")
    expect(block("plus")).toContain("12 tháng: 490.000 đ")
    expect(block("plus")).toContain("24 tháng: 980.000 đ")
    expect(block("pro")).toContain("12 tháng: 990.000 đ")
    expect(block("plus")).not.toContain("Hiện tại")
    expect(saveButton().disabled).toBe(true)
  })

  it("gõ 59000 → xem trước đổi ngay (chưa Lưu), hiện giá hiện tại, nút Lưu bật", () => {
    renderPrices()
    type(plusInput(), "59000")
    expect(block("plus")).toContain("12 tháng: 590.000 đ")
    expect(block("plus")).toContain("24 tháng: 1.180.000 đ")
    expect(block("plus")).toContain("Hiện tại: 49.000 đ/tháng")
    expect(saveButton().disabled).toBe(false)
  })

  it("Review Focus 1: gõ 59.000 có dấu chấm → thành 59, báo lỗi khoảng, nút Lưu khóa; để trống cũng lỗi", () => {
    renderPrices()
    type(plusInput(), "59.000")
    expect(plusInput().value).toBe("59")
    expect(block("plus")).toContain("Giá tháng từ 10.000 đến 1.000.000")
    expect(saveButton().disabled).toBe(true)
    type(plusInput(), "")
    expect(block("plus")).toContain("Giá tháng từ 10.000 đến 1.000.000")
    expect(saveButton().disabled).toBe(true)
  })

  it("giá lẻ 59900 hợp lệ; Pro ≤ Plus → lỗi dưới ô Pro, nút Lưu khóa", () => {
    renderPrices()
    type(plusInput(), "59900")
    expect(block("plus")).toContain("12 tháng: 599.000 đ")
    expect(saveButton().disabled).toBe(false)
    type(proInput(), "50000")
    expect(block("pro")).toContain("Giá Pro phải cao hơn giá Plus")
    expect(block("plus")).not.toContain("Giá Pro phải cao hơn giá Plus")
    expect(saveButton().disabled).toBe(true)
  })

  it("Lưu → hộp xác nhận chỉ có gói đổi, đủ 3 kỳ cũ → mới; Xác nhận gửi prices + expected", () => {
    renderPrices()
    type(plusInput(), "59000")
    fireEvent.click(saveButton())
    const confirm = screen.getByTestId("price-confirm")
    const txt = confirm.textContent ?? ""
    expect(txt).toContain("Đổi bảng giá?")
    for (const s of ["49.000 đ", "59.000 đ", "490.000 đ", "590.000 đ", "980.000 đ", "1.180.000 đ"]) expect(txt).toContain(s)
    expect(txt).not.toContain("Pro")
    expect(txt).toContain("Đơn đang chờ và gói đã mua giữ nguyên số tiền")
    fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận đổi giá" }))
    expect(h.mutate).toHaveBeenCalledWith({ prices: { plus: 59000, pro: 99000 }, expected: { plus: 49000, pro: 99000 } })
  })

  it("lỗi CONFLICT → toast message server + nạp lại bảng giá; lỗi khác không nạp lại", () => {
    renderPrices()
    act(() => h.opts!.onError!({ message: "Bảng giá vừa được đổi ở nơi khác, tải lại để xem", data: { code: "CONFLICT" } }))
    expect(toast.error).toHaveBeenCalledWith("Bảng giá vừa được đổi ở nơi khác, tải lại để xem")
    expect(h.invalidate).toHaveBeenCalledTimes(1)
    act(() => h.opts!.onError!({ message: "Giá chưa thay đổi", data: { code: "BAD_REQUEST" } }))
    expect(h.invalidate).toHaveBeenCalledTimes(1)
  })

  it("lịch sử: thẻ ghi gói, cũ → mới, người đổi, giờ VN; dòng seed ghi Giá ban đầu", () => {
    renderPrices()
    const cards = screen.getAllByTestId("price-history-card").map((c) => c.textContent)
    expect(cards[0]).toContain("Plus · 49.000 đ → 59.000 đ")
    expect(cards[0]).toContain("admin_test · 27/09/2026 10:05")
    expect(cards[1]).toContain("Plus · Giá ban đầu 49.000 đ")
    expect(cards[1]).toContain("migration")
  })
})
```

Run: `pnpm test tests/unit/components/AdminPrices.test.tsx`
Expected: FAIL — không resolve được `@/components/admin/AdminPrices`.

- [ ] **Step 6: Thêm `dateTimeVn` vào `src/components/admin/admin-format.ts`**

Thêm import `import { formatTime } from "@/lib/utils"` và cuối file:
```ts
// Giờ VN (UTC+7) cho lịch sử cấu hình: server chạy UTC, formatTime đọc giờ UTC nên cộng 7 giờ trước.
export function dateTimeVn(d: string): string {
  const date = new Date(d)
  return `${formatVnDate(date)} ${formatTime(new Date(date.getTime() + 7 * 60 * 60 * 1000))}`
}
```

- [ ] **Step 7: Tạo `src/components/admin/AdminPrices.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PERIODS, PERIOD_PRICE_FACTOR, PLAN_LABEL, planLabel, pricesFromMonthly, type PaidPlan } from "@/lib/plans"
import { monthPriceSchema } from "@/lib/schemas/plan"
import { cn, formatCurrency } from "@/lib/utils"
import { dateTimeVn } from "./admin-format"

type Monthly = Record<PaidPlan, number>
type HistoryRow = RouterOutputs["admin"]["prices"]["history"][number]

const PAID_PLANS: PaidPlan[] = ["plus", "pro"]
// P11: mobile Pro trên Plus; desktop Plus → Pro.
const PLAN_ORDER: Record<PaidPlan, string> = { plus: "order-2 md:order-1", pro: "order-1 md:order-2" }
const PERIOD_KEY = { month: "plan_period_1m", year: "plan_period_12m", "2year": "plan_period_24m" } as const

export function AdminPrices() {
  const { t } = useTranslation()
  const query = trpc.admin.prices.useQuery()
  const monthly = query.data?.monthly

  const change = (r: HistoryRow) =>
    r.previousMonthPrice === null
      ? `${t("admin_price_initial")} ${formatCurrency(r.monthPrice)}`
      : `${formatCurrency(r.previousMonthPrice)} → ${formatCurrency(r.monthPrice)}`

  const columns: Column<HistoryRow>[] = [
    { header: t("admin_price_time"), cell: (r) => dateTimeVn(r.createdAt) },
    { header: t("admin_col_plan"), cell: (r) => planLabel(r.plan) },
    { header: t("admin_price_month"), cell: change },
    { header: t("admin_price_changed_by"), cell: (r) => r.changedBy },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_prices")} />

      {monthly ? (
        // key theo giá hiện hành: Lưu xong hoặc CONFLICT nạp giá mới thì form khởi tạo lại từ giá đó.
        <PriceForm key={`${monthly.plus}-${monthly.pro}`} monthly={monthly} />
      ) : (
        query.isPending && <Skeleton className="h-64 w-full rounded-xl" />
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t("admin_price_history")}</h2>
        <ResponsiveList
          isLoading={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
          errorText={t("load_error")}
          retryText={t("retry")}
          items={query.data?.history ?? []}
          getKey={(r) => r.id}
          columns={columns}
          emptyText={t("admin_price_no_history")}
          renderCard={(r) => (
            <div data-testid="price-history-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
              <p className="font-medium text-foreground">
                {planLabel(r.plan)} · {change(r)}
              </p>
              <p className="text-xs text-slate-500">
                {r.changedBy} · {dateTimeVn(r.createdAt)}
              </p>
            </div>
          )}
        />
      </section>
    </div>
  )
}

function PriceForm({ monthly }: { monthly: Monthly }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [draft, setDraft] = useState<Record<PaidPlan, number | undefined>>(monthly)
  const [confirming, setConfirming] = useState(false)
  const update = trpc.admin.updatePrices.useMutation({
    onSuccess: () => {
      toast.success(t("admin_price_saved"))
      setConfirming(false)
    },
    onError: (e) => {
      toast.error(e.message)
      setConfirming(false)
      // Bảng giá vừa đổi ở tab/admin khác: nạp giá mới, admin gõ lại (spec L 8.2).
      if (e.data?.code === "CONFLICT") void utils.admin.prices.invalidate()
    },
  })

  const rangeError = (p: PaidPlan) => !monthPriceSchema.safeParse(draft[p]).success
  const orderError = !rangeError("plus") && !rangeError("pro") && (draft.pro ?? 0) <= (draft.plus ?? 0)
  const changed = PAID_PLANS.filter((p) => draft[p] !== monthly[p])
  const canSave = !rangeError("plus") && !rangeError("pro") && !orderError && changed.length > 0 && !update.isPending
  // canSave bảo đảm 2 giá đã có khi mở hộp xác nhận.
  const next = { plus: draft.plus ?? 0, pro: draft.pro ?? 0 }
  const oldPrices = pricesFromMonthly(monthly)
  const newPrices = pricesFromMonthly(next)

  return (
    <div data-testid="admin-prices-form" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
        {PAID_PLANS.map((plan) => {
          const v = draft[plan]
          return (
            <div key={plan} data-testid={`price-${plan}`} className={cn("min-w-0 space-y-2", PLAN_ORDER[plan])}>
              <p className="text-lg font-semibold text-foreground">{PLAN_LABEL[plan]}</p>
              <p className="text-sm text-slate-600">{t("admin_price_month")}</p>
              <CurrencyInput
                aria-label={`${t("admin_price_month")} ${PLAN_LABEL[plan]}`}
                value={v}
                onChange={(n) => setDraft((d) => ({ ...d, [plan]: n }))}
                className="h-11 md:h-10"
              />
              {rangeError(plan) && <p className="text-xs text-destructive">{t("admin_price_err_range")}</p>}
              {plan === "pro" && orderError && <p className="text-xs text-destructive">{t("admin_price_err_order")}</p>}
              {v !== undefined && (
                <div className="space-y-0.5 text-sm text-slate-600">
                  <p>{t("admin_price_preview_year").replace("{amount}", formatCurrency(v * PERIOD_PRICE_FACTOR.year))}</p>
                  <p>{t("admin_price_preview_2year").replace("{amount}", formatCurrency(v * PERIOD_PRICE_FACTOR["2year"]))}</p>
                </div>
              )}
              {v !== monthly[plan] && (
                <p className="text-xs text-slate-500">{t("admin_price_current").replace("{amount}", formatCurrency(monthly[plan]))}</p>
              )}
            </div>
          )
        })}
      </div>

      <Button type="button" className="h-12 w-full md:w-auto" disabled={!canSave} onClick={() => setConfirming(true)}>
        {t("admin_price_save")}
      </Button>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent data-testid="price-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_price_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin_price_confirm_note")}</AlertDialogDescription>
          </AlertDialogHeader>
          {changed.map((plan) => (
            <table key={plan} className="w-full text-sm">
              <caption className="pb-1 text-left font-semibold text-foreground">{PLAN_LABEL[plan]}</caption>
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left font-normal">
                    <span className="sr-only">{t("admin_col_period")}</span>
                  </th>
                  <th className="text-right font-normal">{t("admin_price_old")}</th>
                  <th className="text-right font-normal">{t("admin_price_new")}</th>
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="py-1">{t(PERIOD_KEY[period])}</td>
                    <td className="py-1 text-right text-slate-500">{formatCurrency(oldPrices[plan][period])}</td>
                    <td className="py-1 text-right font-semibold text-foreground">{formatCurrency(newPrices[plan][period])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-10" disabled={update.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 md:h-10"
              disabled={update.isPending}
              onClick={(e) => {
                // Giữ hộp mở tới khi mutation xong (onSuccess/onError tự đóng).
                e.preventDefault()
                update.mutate({ prices: next, expected: monthly })
              }}
            >
              {t("admin_price_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 8: Tạo route `src/app/(admin)/admin/prices/page.tsx`**

```tsx
import { AdminPrices } from "@/components/admin/AdminPrices"

export default function AdminPricesPage() {
  return <AdminPrices />
}
```

- [ ] **Step 9: Chạy unit test, xác nhận pass**

Run: `pnpm test tests/unit/components/AdminPrices.test.tsx`
Expected: PASS 7 test.

Run: `pnpm test tests/unit/next15-contract.test.ts`
Expected: PASS.

- [ ] **Step 10: Sửa `tests/e2e/admin.spec.ts`**

a) Test `'/admin → /admin/orders; teacher vào …'`: tên test thêm `/admin/prices`; mảng path đổi thành `['/admin', '/admin/orders', '/admin/accounts', '/admin/history', '/admin/prices']`.

b) Test `'desktop: sidebar khu quản trị 3 mục …'`: tên đổi "3 mục" → "4 mục"; mảng href đổi thành:
```ts
  expect(await aside.getByRole('link').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
    '/admin/orders',
    '/admin/accounts',
    '/admin/history',
    '/admin/prices',
  ]);
```

c) Test `'admin_test: route giáo viên → /admin/orders; tab bar …'`: `await expect(tabs.getByRole('link')).toHaveCount(3);` → `toHaveCount(4)`.

- [ ] **Step 11: Viết e2e `tests/e2e/admin-prices.spec.ts`**

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
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/orders$/ : /.*dashboard/);
  return page;
}

// tests/setup.ts không xóa bảng giá: dọn dòng test để file e2e khác thấy 49.000/99.000.
async function resetPrices() {
  await db.planPriceChange.deleteMany({ where: { changedBy: { not: 'migration' } } });
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetPrices();
  await resetStd();
});

test.afterEach(async () => {
  await resetPrices();
});

test.afterAll(async () => {
  await resetPrices();
  await resetStd();
  await db.$disconnect();
});

test('desktop: admin sửa giá Plus (xem trước, lỗi tại chỗ, xác nhận) → lịch sử; giáo viên thấy giá mới ở /plan và popup', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await admin.locator('aside').getByRole('link', { name: 'Bảng giá' }).click();
  await expect(admin).toHaveURL(/\/admin\/prices$/);
  await expect(admin.getByRole('heading', { level: 1, name: 'Bảng giá' })).toBeVisible();

  const form = admin.getByTestId('admin-prices-form');
  const plus = form.getByTestId('price-plus');
  const pro = form.getByTestId('price-pro');
  const plusInput = plus.getByRole('textbox', { name: 'Giá tháng Plus' });
  const proInput = pro.getByRole('textbox', { name: 'Giá tháng Pro' });
  const save = form.getByRole('button', { name: 'Lưu bảng giá' });
  await expect(plusInput).toHaveValue('49,000');
  await expect(proInput).toHaveValue('99,000');
  await expect(plus).toContainText('12 tháng: 490.000 đ');
  await expect(plus).toContainText('24 tháng: 980.000 đ');
  await expect(save).toBeDisabled();

  await plusInput.fill('59000');
  await expect(plus).toContainText('12 tháng: 590.000 đ');
  await expect(plus).toContainText('24 tháng: 1.180.000 đ');
  await expect(plus).toContainText('Hiện tại: 49.000 đ/tháng');
  await plusInput.fill('59900');
  await expect(plus).toContainText('12 tháng: 599.000 đ');
  await expect(plus).toContainText('24 tháng: 1.198.000 đ');
  await expect(save).toBeEnabled();
  await plusInput.fill('9000');
  await expect(plus).toContainText('Giá tháng từ 10.000 đến 1.000.000');
  await expect(save).toBeDisabled();
  await plusInput.fill('59000');
  await proInput.fill('50000');
  await expect(pro).toContainText('Giá Pro phải cao hơn giá Plus');
  await expect(save).toBeDisabled();
  await proInput.fill('99000');
  await expect(save).toBeEnabled();

  await save.click();
  const confirm = admin.getByTestId('price-confirm');
  await expect(confirm).toContainText('Đổi bảng giá?');
  for (const s of ['49.000 đ', '59.000 đ', '490.000 đ', '590.000 đ', '980.000 đ', '1.180.000 đ']) await expect(confirm).toContainText(s);
  await expect(confirm).not.toContainText('Pro');
  await confirm.getByRole('button', { name: 'Xác nhận đổi giá' }).click();
  await expect(admin.getByText('Đã cập nhật bảng giá')).toBeVisible();
  await expect(confirm).toBeHidden();
  await expect(plusInput).toHaveValue('59,000');
  await expect(save).toBeDisabled();
  const row = admin.getByRole('row').filter({ hasText: 'admin_test' }).first();
  await expect(row).toContainText('Plus');
  await expect(row).toContainText('49.000 đ → 59.000 đ');
  expect(await db.planPriceChange.count({ where: { changedBy: 'admin_test' } })).toBe(1);
  await admin.context().close();

  const std = await loginAs(browser, 'teacher_std', DESKTOP);
  await std.goto('/plan');
  const card = std.getByTestId('plan-card-plus');
  await expect(card).toContainText('59.000 đ');
  await expect(card).toContainText('590.000 đ');
  await expect(card).toContainText('1.180.000 đ');
  await card.getByRole('button', { name: 'Chọn gói Plus' }).click();
  const popup = std.getByTestId('plan-purchase');
  await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
  await expect(popup.getByTestId('purchase-summary')).toContainText('590.000 đ');
  await std.context().close();
});

test('390px: tab bar 4 tab ≥44px, form Pro trên Plus, ô/nút ≥44px, lịch sử dạng thẻ, không tràn ngang', async ({ browser }) => {
  await db.planPriceChange.create({ data: { plan: 'plus', monthPrice: 59000, previousMonthPrice: 49000, changedBy: 'e2e_price' } });
  const admin = await loginAs(browser, 'admin_test', MOBILE);
  const tabs = admin.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(4);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await tabs.getByRole('link', { name: 'Bảng giá' }).click();
  await expect(admin).toHaveURL(/\/admin\/prices$/);

  const y = async (id: string) => (await admin.getByTestId(id).boundingBox())!.y;
  expect(await y('price-pro')).toBeLessThan(await y('price-plus'));
  const plusInput = admin.getByRole('textbox', { name: 'Giá tháng Plus' });
  await expect(plusInput).toHaveValue('59,000');
  for (const box of [plusInput, admin.getByRole('textbox', { name: 'Giá tháng Pro' })]) {
    expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(admin.getByTestId('price-history-card').filter({ hasText: 'e2e_price' })).toContainText('Plus · 49.000 đ → 59.000 đ');

  await plusInput.fill('69000');
  const save = admin.getByRole('button', { name: 'Lưu bảng giá' });
  expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await save.click();
  const confirm = admin.getByTestId('price-confirm');
  for (const b of await confirm.getByRole('button').all()) {
    expect((await b.boundingBox())!.height, (await b.textContent()) ?? '').toBeGreaterThanOrEqual(44);
  }
  await confirm.getByRole('button', { name: 'Hủy' }).click();
  await expect(confirm).toBeHidden();
  expect(await db.planPriceChange.count({ where: { plan: 'plus', monthPrice: 69000 } })).toBe(0);

  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await admin.context().close();
});
```

- [ ] **Step 12: Chạy e2e**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin-prices.spec.ts tests/e2e/admin.spec.ts
```
Expected: seed PASS; e2e tất cả passed.

- [ ] **Step 13: tsc + lint + theme**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test tests/unit/theme-legacy-colors.test.ts
```
Expected: sạch / PASS.

- [ ] **Step 14: Commit**

```bash
git add src/language/vi.json src/language/en.json src/components/admin/admin-nav.ts src/components/admin/AdminTabBar.tsx src/components/admin/admin-format.ts src/components/admin/AdminPrices.tsx "src/app/(admin)/admin/prices/page.tsx" tests/unit/components/AdminPrices.test.tsx tests/unit/components/AdminNav.test.tsx tests/e2e/admin-prices.spec.ts tests/e2e/admin.spec.ts
git commit -m "feat(l): màn Bảng giá admin (xem trước, lỗi tại chỗ, xác nhận cũ → mới, lịch sử), nav 4 mục

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: Số ngày dùng thử cấu hình được — mặc định cho tài khoản mới (`/admin/prices`) + đặt riêng từng tài khoản (`/admin/accounts`)

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 2–6; spec mục 15 (T1–T3, UI, Test); `src/lib/plans.ts` (`TRIAL_DAYS`, `trialEndFor`, `daysLeft`, `planBanner`, `effectivePlan`); `src/server/services/user.service.ts`; `src/server/services/plan-price.service.ts` (`SETTINGS_LOCK_CLASS`, mẫu `updatePrices`); `src/server/services/plan-admin.service.ts` (`getAdminOverview`); `src/server/trpc/routers/admin.ts`; `src/components/admin/AdminAccounts.tsx`, `SetPlanDialog.tsx` (mẫu Dialog); `src/components/admin/AdminPrices.tsx` + `admin-format.ts` (Task 5, mẫu form/lịch sử, `dateTimeVn`); `src/app/(admin)/admin/prices/page.tsx`; `tests/integration/register.test.ts`; `tests/unit/lib/plans.test.ts` dòng 284–300.

**Files:**
- Modify: `src/lib/plans.ts` (`DEFAULT_TRIAL_DAYS`, `trialEndFor(createdAt, days)`, `trialDaysOf`)
- Modify: `src/lib/schemas/plan.ts` (schema dùng thử)
- Create: `src/server/services/trial.service.ts`
- Modify: `src/server/services/user.service.ts` (đăng ký đọc số ngày DB)
- Modify: `src/server/services/plan-admin.service.ts` (`overview.users[].isAdmin`)
- Modify: `src/server/trpc/routers/admin.ts` (4 procedure)
- Modify: `src/language/vi.json`, `src/language/en.json` (key `admin_trial*`, `admin_set_trial`)
- Create: `src/components/admin/TrialDaysForm.tsx`, `src/components/admin/TrialDaysDialog.tsx`
- Modify: `src/components/admin/AdminAccounts.tsx`, `src/app/(admin)/admin/prices/page.tsx`
- Test (Sửa): `tests/unit/lib/plans.test.ts`, `tests/unit/schemas/plan.schema.test.ts`, `tests/integration/register.test.ts`
- Test (Mới): `tests/integration/trial-days.test.ts`, `tests/unit/components/TrialDaysForm.test.tsx`, `tests/unit/components/TrialDaysDialog.test.tsx`, `tests/e2e/admin-trial.spec.ts`

**Interfaces:**
- Consumes: `db.trialDayChange` (Task 1); `SETTINGS_LOCK_CLASS` từ `@/server/services/plan-price.service` (Task 3); `dateTimeVn(d: string)`, `dateOrDash(d: string | null)` từ `./admin-format` (Task 5); key `admin_price_time`, `admin_price_changed_by`, `admin_col_created`, `cancel`, `save`, `confirm` (có sẵn / Task 5); trang `/admin/prices` (Task 5).
- Produces:
  - `src/lib/plans.ts`: `DEFAULT_TRIAL_DAYS = 60` (thay `TRIAL_DAYS`); `trialEndFor(createdAt: Date, days: number): Date | null` (`days <= 0` → `null`); `trialDaysOf(createdAt: Date, trialEndsAt: Date | null): number | null`.
  - `src/lib/schemas/plan.ts`: `trialDaysSchema` (int 0–365), `userTrialDaysSchema` (int 0–3650), `updateTrialDaysSchema` (`{ days, expected }`), `setUserTrialSchema` (`{ userId, days }`), `userIdSchema` (`{ userId }`); type `UpdateTrialDaysInput`, `SetUserTrialInput`.
  - `src/server/services/trial.service.ts`: `getDefaultTrialDays(db: Db): Promise<number>`; `getTrialHistory(db: Db)`; `updateDefaultTrialDays(db: PrismaClient, admin: string, input: UpdateTrialDaysInput): Promise<{ days: number }>`; `setUserTrialDays(db: PrismaClient, admin: string, input: SetUserTrialInput): Promise<{ trialEndsAt: Date | null }>`; `getUserTrialChanges(db: Db, userId: number)`. Dòng lịch sử: `{ id: number; days: number; previousDays: number | null; changedBy: string; createdAt: Date }`.
  - tRPC (đều `adminProcedure`): `admin.trialSettings` → `{ days: number; history: Row[] }`; `admin.updateTrialDays(updateTrialDaysSchema)` → `{ days }`; `admin.setUserTrial(setUserTrialSchema)` → `{ trialEndsAt: Date | null }`; `admin.userTrialChanges(userIdSchema)` → `Row[]` (5 dòng).
  - `admin.overview.users[]` thêm `isAdmin: boolean`.
  - Test id: `trial-days-form`, `trial-confirm`, `trial-history-card`, `trial-preview`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Unit test hàm dùng thử (RED)**

Trong `tests/unit/lib/plans.test.ts`: thêm `trialDaysOf,` vào import từ `@/lib/plans`. Trong `describe("trialEndFor / daysLeft / formatValidUntil / expiryFromLastDay")`, 2 dòng `trialEndFor(vn(...))` đổi thành có tham số 60:
```ts
    expect(iso(trialEndFor(vn("2026-09-26T23:59"), 60))).toBe(iso(vn("2026-11-25T00:00")))
    expect(iso(trialEndFor(vn("2026-09-26T00:30"), 60))).toBe(iso(vn("2026-11-25T00:00")))
```
Thêm describe mới ngay sau describe đó:
```ts
describe("trialEndFor / trialDaysOf (spec L mục 15)", () => {
  it("tính từ đầu ngày VN của ngày tạo tài khoản; 00:30 VN (UTC còn hôm trước) vẫn là ngày VN đó", () => {
    expect(iso(trialEndFor(vn("2026-08-07T09:00"), 120))).toBe(iso(vn("2026-12-05T00:00")))
    expect(iso(trialEndFor(vn("2026-08-07T00:30"), 120))).toBe(iso(vn("2026-12-05T00:00")))
  })
  it("Review Focus 3: 0 ngày → null, không có banner hết dùng thử", () => {
    expect(trialEndFor(NOW, 0)).toBeNull()
    expect(planBanner(u({ trialEndsAt: trialEndFor(NOW, 0) }), NOW, false)).toBeNull()
  })
  it("trialDaysOf là nghịch của trialEndFor; chưa có dùng thử → null", () => {
    const created = vn("2026-08-07T09:00")
    expect(trialDaysOf(created, trialEndFor(created, 120))).toBe(120)
    expect(trialDaysOf(created, trialEndFor(created, 60))).toBe(60)
    expect(trialDaysOf(created, null)).toBeNull()
  })
  it("đã dùng 50 ngày, đặt 120 → còn 70 ngày", () => {
    expect(daysLeft(trialEndFor(addDays(NOW, -50), 120)!, NOW)).toBe(70)
  })
})
```

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: FAIL — `trialDaysOf is not a function`; `trialEndFor(NOW, 0)` trả Date thay vì null; 120 ngày ra 60 ngày (tham số thứ 2 bị bỏ qua).

- [ ] **Step 3: Sửa `src/lib/plans.ts`**

Thay dòng `export const TRIAL_DAYS = 60` bằng:
```ts
// Chỉ dùng khi DB thiếu dòng số ngày dùng thử mặc định (spec L mục 15); số thật ở bảng trial_day_changes.
export const DEFAULT_TRIAL_DAYS = 60
```
Thay hàm `trialEndFor` bằng:
```ts
// Hạn dùng thử tính từ đầu ngày VN của ngày tạo tài khoản (spec L mục 15 T3).
// 0 ngày = không dùng thử: trả null, lưu mốc quá khứ sẽ hiện banner "hết dùng thử" oan.
export function trialEndFor(createdAt: Date, days: number): Date | null {
  return days > 0 ? addDays(vnStartOfDay(createdAt), days) : null
}

// Số ngày dùng thử đang có của tài khoản, để dialog admin hiện "cũ → mới".
export function trialDaysOf(createdAt: Date, trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null
  return Math.round((trialEndsAt.getTime() - vnStartOfDay(createdAt).getTime()) / DAY_MS)
}
```
Run (Bash): `grep -rn "TRIAL_DAYS\b" src tests | grep -v DEFAULT_TRIAL_DAYS` → không in gì.

Run: `pnpm test tests/unit/lib/plans.test.ts`
Expected: PASS. (`pnpm exec tsc --noEmit` lúc này báo lỗi ở `user.service.ts` và `register.test.ts` — sửa ở Step 7.)

- [ ] **Step 4: Unit test schema dùng thử (RED) + schema**

Trong `tests/unit/schemas/plan.schema.test.ts`, đổi import thành `import { createOrderSchema, setUserTrialSchema, updatePricesSchema, updateTrialDaysSchema } from "@/lib/schemas/plan"` và thêm cuối file:
```ts
describe("schema số ngày dùng thử (spec L mục 15)", () => {
  it("mặc định: nguyên 0–365, expected không giới hạn", () => {
    for (const days of [0, 60, 365]) expect(updateTrialDaysSchema.safeParse({ days, expected: 60 }).success).toBe(true)
    for (const days of [-1, 366, 1.5]) expect(updateTrialDaysSchema.safeParse({ days, expected: 60 }).success).toBe(false)
    expect(updateTrialDaysSchema.safeParse({ days: 90, expected: 1000 }).success).toBe(true)
  })
  it("đặt riêng: nguyên 0–3650, userId nguyên dương", () => {
    expect(setUserTrialSchema.safeParse({ userId: 1, days: 3650 }).success).toBe(true)
    expect(setUserTrialSchema.safeParse({ userId: 1, days: 3651 }).success).toBe(false)
    expect(setUserTrialSchema.safeParse({ userId: 0, days: 90 }).success).toBe(false)
  })
})
```
Run: `pnpm test tests/unit/schemas/plan.schema.test.ts` → FAIL (`updateTrialDaysSchema` undefined).

Thêm vào `src/lib/schemas/plan.ts` (dưới `updatePricesSchema`):
```ts
// Mặc định cho tài khoản đăng ký sau, 0 = không dùng thử (spec L mục 15 T1).
export const trialDaysSchema = z.number().int().min(0).max(365)
// Đặt riêng tính từ ngày tạo tài khoản nên tài khoản cũ cần số lớn hơn 365.
export const userTrialDaysSchema = z.number().int().min(0).max(3650)

export const updateTrialDaysSchema = z.object({ days: trialDaysSchema, expected: z.number().int() })
export const userIdSchema = z.object({ userId: z.number().int().positive() })
export const setUserTrialSchema = userIdSchema.extend({ days: userTrialDaysSchema })
```
và cuối file:
```ts
export type UpdateTrialDaysInput = z.infer<typeof updateTrialDaysSchema>
export type SetUserTrialInput = z.infer<typeof setUserTrialSchema>
```
Run: `pnpm test tests/unit/schemas/plan.schema.test.ts` → PASS.

- [ ] **Step 5: Integration test dùng thử (RED)**

Tạo `tests/integration/trial-days.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { addDays, daysLeft, effectivePlan, planBanner, trialEndFor, vnStartOfDay } from "@/lib/plans"

const FAKE = "trial_test_"
const FAR = new Date("2099-12-31T17:00:00.000Z")
const PASSWORD = "Password123!"

async function reset() {
  // tests/setup.ts không xóa bảng này: trả mặc định về 60 (chỉ giữ dòng seed migration).
  await db.trialDayChange.deleteMany({ where: { changedBy: { not: "migration" } } })
  await db.subject.deleteMany({ where: { user: { username: { startsWith: FAKE } } } })
  await db.user.deleteMany({ where: { username: { startsWith: FAKE } } })
}

async function makeUser(suffix: string, createdDaysAgo: number, trialDays: number | null, extra: { plan?: string; planExpiresAt?: Date } = {}) {
  const createdAt = addDays(new Date(), -createdDaysAgo)
  return db.user.create({
    data: {
      username: `${FAKE}${suffix}`,
      passwordHash: "x",
      createdAt,
      trialEndsAt: trialDays === null ? null : trialEndFor(createdAt, trialDays),
      ...extra,
    },
  })
}

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await reset()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await reset()
})

describe("admin.* dùng thử — quyền", () => {
  it("giáo viên → FORBIDDEN cả 4 procedure, không ghi gì", async () => {
    const t = await getAuthedCaller("teacher_std")
    const std = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    await expect(t.admin.trialSettings()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.updateTrialDays({ days: 90, expected: 60 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.setUserTrial({ userId: std.id, days: 120 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(t.admin.userTrialChanges({ userId: std.id })).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(await db.trialDayChange.count({ where: { changedBy: { not: "migration" } } })).toBe(0)
  })
})

describe("số ngày dùng thử mặc định (T1, T2)", () => {
  it("admin xem: 60 ngày, lịch sử có dòng seed", async () => {
    const s = await (await getAuthedCaller("admin_test")).admin.trialSettings()
    expect(s.days).toBe(60)
    expect(s.history.map((h) => [h.days, h.previousDays, h.changedBy])).toContainEqual([60, null, "migration"])
  })

  it("đổi 60 → 90: tài khoản đăng ký sau nhận 90 ngày, tài khoản đang dùng thử giữ hạn cũ", async () => {
    const admin = await getAuthedCaller("admin_test")
    const old = await makeUser("old", 5, 60)
    await expect(admin.admin.updateTrialDays({ days: 90, expected: 60 })).resolves.toEqual({ days: 90 })
    const before = new Date()
    await publicCaller.auth.register({ username: `${FAKE}reg90`, password: PASSWORD })
    const reg = await db.user.findUniqueOrThrow({ where: { username: `${FAKE}reg90` } })
    expect(reg.trialEndsAt?.toISOString()).toBe(trialEndFor(before, 90)?.toISOString())
    expect((await db.user.findUniqueOrThrow({ where: { id: old.id } })).trialEndsAt?.toISOString()).toBe(
      trialEndFor(old.createdAt, 60)?.toISOString()
    )
    const s = await admin.admin.trialSettings()
    expect(s.days).toBe(90)
    expect(s.history[0]).toMatchObject({ days: 90, previousDays: 60, changedBy: "admin_test" })
  })

  it("Review Focus 3: mặc định 0 → tài khoản mới không dùng thử (trialEndsAt null), không có banner", async () => {
    await (await getAuthedCaller("admin_test")).admin.updateTrialDays({ days: 0, expected: 60 })
    await publicCaller.auth.register({ username: `${FAKE}reg0`, password: PASSWORD })
    const reg = await db.user.findUniqueOrThrow({ where: { username: `${FAKE}reg0` } })
    expect(reg.trialEndsAt).toBeNull()
    expect(effectivePlan(reg, new Date()).plan).toBe("standard")
    expect(planBanner(reg, new Date(), false)).toBeNull()
  })

  it("expected sai → CONFLICT; không đổi → BAD_REQUEST; ngoài 0–365 / không nguyên → BAD_REQUEST; không ghi dòng", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.updateTrialDays({ days: 90, expected: 45 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Số ngày dùng thử vừa được đổi ở nơi khác, tải lại để xem",
    })
    await expect(admin.admin.updateTrialDays({ days: 60, expected: 60 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Số ngày dùng thử chưa thay đổi",
    })
    for (const days of [-1, 366, 1.5]) {
      await expect(admin.admin.updateTrialDays({ days, expected: 60 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    }
    expect(await db.trialDayChange.count({ where: { changedBy: { not: "migration" } } })).toBe(0)
  })
})

describe("đặt riêng từng tài khoản (T3)", () => {
  it("đã dùng 50 ngày, đặt 120 → hạn = đầu ngày tạo + 120, còn 70 ngày; ghi lịch sử 60 → 120; mặc định không đổi", async () => {
    const admin = await getAuthedCaller("admin_test")
    const u = await makeUser("u50", 50, 60)
    const res = await admin.admin.setUserTrial({ userId: u.id, days: 120 })
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(after.trialEndsAt?.toISOString()).toBe(addDays(vnStartOfDay(u.createdAt), 120).toISOString())
    expect(res.trialEndsAt).toEqual(after.trialEndsAt)
    expect(daysLeft(after.trialEndsAt!, new Date())).toBe(70)
    const changes = await admin.admin.userTrialChanges({ userId: u.id })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ days: 120, previousDays: 60, changedBy: "admin_test" })
    expect((await admin.admin.trialSettings()).days).toBe(60)
  })

  it("trial đã hết → đặt 120 thì bật lại (Pro dùng thử); đặt 30 (mốc quá khứ) thì hết dùng thử", async () => {
    const admin = await getAuthedCaller("admin_test")
    const u = await makeUser("expired", 100, 60)
    expect(effectivePlan(u, new Date()).source).toBe("free")
    await admin.admin.setUserTrial({ userId: u.id, days: 120 })
    const on = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(effectivePlan(on, new Date())).toMatchObject({ plan: "pro", source: "trial" })
    expect(daysLeft(on.trialEndsAt!, new Date())).toBe(20)
    await admin.admin.setUserTrial({ userId: u.id, days: 30 })
    const off = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(off.trialEndsAt!.getTime()).toBeLessThan(Date.now())
    expect(effectivePlan(off, new Date()).source).toBe("free")
  })

  it("không đụng gói trả phí: Pro tới 2099 giữ nguyên plan/planExpiresAt", async () => {
    const u = await makeUser("paid", 100, 60, { plan: "pro", planExpiresAt: FAR })
    await (await getAuthedCaller("admin_test")).admin.setUserTrial({ userId: u.id, days: 120 })
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(after.plan).toBe("pro")
    expect(after.planExpiresAt).toEqual(FAR)
  })

  it("Review Focus 4: tài khoản cũ (chưa có dùng thử, tạo 400 ngày trước) đặt 90 → mốc quá khứ, không dùng thử, số ngày cũ null; đặt 0 → null", async () => {
    const admin = await getAuthedCaller("admin_test")
    const u = await makeUser("legacy", 400, null)
    await admin.admin.setUserTrial({ userId: u.id, days: 90 })
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(after.trialEndsAt!.getTime()).toBeLessThan(Date.now())
    expect(effectivePlan(after, new Date()).plan).toBe("standard")
    expect((await admin.admin.userTrialChanges({ userId: u.id }))[0]).toMatchObject({ days: 90, previousDays: null })
    await admin.admin.setUserTrial({ userId: u.id, days: 0 })
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).trialEndsAt).toBeNull()
  })

  it("user không tồn tại → NOT_FOUND; số ngày > 3650 → BAD_REQUEST", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.setUserTrial({ userId: 999999, days: 90 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    const u = await makeUser("range", 10, 60)
    await expect(admin.admin.setUserTrial({ userId: u.id, days: 3651 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})
```

Run: `pnpm test tests/integration/trial-days.test.ts`
Expected: FAIL — `admin.trialSettings` không phải hàm (và lỗi kiểu ở `trialEndFor` của `user.service.ts` nếu Vitest báo).

- [ ] **Step 6: Tạo `src/server/services/trial.service.ts`**

```ts
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { DEFAULT_TRIAL_DAYS, trialDaysOf, trialEndFor } from "@/lib/plans"
import type { SetUserTrialInput, UpdateTrialDaysInput } from "@/lib/schemas/plan"
import type { Db } from "./plan.service"
import { SETTINGS_LOCK_CLASS } from "./plan-price.service"

const TRIAL_LOCK_KEY = 1
const CHANGE_SELECT = { id: true, days: true, previousDays: true, changedBy: true, createdAt: true } as const

export async function getDefaultTrialDays(db: Db): Promise<number> {
  const row = await db.trialDayChange.findFirst({
    where: { userId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { days: true },
  })
  if (row) return row.days
  // Thiếu seed thì vẫn cho đăng ký với số ngày cũ thay vì lỗi 500 (spec L mục 15 T1).
  console.warn(`[trial] thiếu số ngày dùng thử mặc định, dùng ${DEFAULT_TRIAL_DAYS}`)
  return DEFAULT_TRIAL_DAYS
}

export async function getTrialHistory(db: Db) {
  return db.trialDayChange.findMany({
    where: { userId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: CHANGE_SELECT,
  })
}

// Chỉ áp cho tài khoản đăng ký sau khi lưu; người đang dùng thử giữ trialEndsAt cũ (spec L mục 15 T2).
export async function updateDefaultTrialDays(db: PrismaClient, admin: string, input: UpdateTrialDaysInput): Promise<{ days: number }> {
  const previous = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETTINGS_LOCK_CLASS}::int, ${TRIAL_LOCK_KEY}::int)`
    const current = await getDefaultTrialDays(tx)
    if (current !== input.expected) {
      throw new TRPCError({ code: "CONFLICT", message: "Số ngày dùng thử vừa được đổi ở nơi khác, tải lại để xem" })
    }
    if (input.days === current) throw new TRPCError({ code: "BAD_REQUEST", message: "Số ngày dùng thử chưa thay đổi" })
    await tx.trialDayChange.create({ data: { userId: null, days: input.days, previousDays: current, changedBy: admin } })
    return current
  })
  console.info(`[admin] ${admin} đổi số ngày dùng thử mặc định ${previous}→${input.days}`)
  return { days: input.days }
}

// Tính từ ngày tạo tài khoản; không đụng plan/planExpiresAt, effectivePlan tự lấy gói có hiệu lực (spec L mục 15 T3).
export async function setUserTrialDays(db: PrismaClient, admin: string, input: SetUserTrialInput): Promise<{ trialEndsAt: Date | null }> {
  const trialEndsAt = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { createdAt: true, trialEndsAt: true } })
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
    const next = trialEndFor(user.createdAt, input.days)
    await tx.user.update({ where: { id: input.userId }, data: { trialEndsAt: next } })
    await tx.trialDayChange.create({
      data: { userId: input.userId, days: input.days, previousDays: trialDaysOf(user.createdAt, user.trialEndsAt), changedBy: admin },
    })
    return next
  })
  console.info(`[admin] ${admin} đặt ${input.days} ngày dùng thử cho user ${input.userId}`)
  return { trialEndsAt }
}

export async function getUserTrialChanges(db: Db, userId: number) {
  return db.trialDayChange.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: CHANGE_SELECT,
  })
}
```

- [ ] **Step 7: Đăng ký đọc số ngày DB; overview `isAdmin`; router; test đăng ký cũ**

`src/server/services/user.service.ts`: thêm import `import { getDefaultTrialDays } from "./trial.service"`. Ngay trước `let user`, thêm `const trialDays = await getDefaultTrialDays(db)`. Dòng `trialEndsAt` trong `db.user.create` đổi thành:
```ts
        // D4: gán ở đây (không dùng default DB) để tài khoản cũ không bị gán nhầm dùng thử.
        // Số ngày đọc lúc đăng ký: đổi mặc định chỉ ảnh hưởng tài khoản tạo sau (spec L mục 15 T2).
        trialEndsAt: trialEndFor(new Date(), trialDays),
```

`src/server/services/plan-admin.service.ts`: thêm `import { isAdminUsername } from "@/lib/admin"`; trong `getAdminOverview`, object user trả về thêm sau `trialEndsAt: u.trialEndsAt,`:
```ts
        // Admin không dùng gói nên UI ẩn nút đặt dùng thử (spec L mục 15).
        isAdmin: isAdminUsername(u.username),
```

`src/server/trpc/routers/admin.ts`: import schema thêm `setUserTrialSchema, updateTrialDaysSchema, userIdSchema`; thêm dòng
```ts
import { getDefaultTrialDays, getTrialHistory, getUserTrialChanges, setUserTrialDays, updateDefaultTrialDays } from "@/server/services/trial.service"
```
và thêm vào router (sau `updatePrices`):
```ts
  trialSettings: adminProcedure.query(async ({ ctx }) => {
    const [days, history] = await Promise.all([getDefaultTrialDays(ctx.db), getTrialHistory(ctx.db)])
    return { days, history }
  }),

  updateTrialDays: adminProcedure
    .input(updateTrialDaysSchema)
    .mutation(({ ctx, input }) => updateDefaultTrialDays(ctx.db, ctx.session.user.username, input)),

  setUserTrial: adminProcedure
    .input(setUserTrialSchema)
    .mutation(({ ctx, input }) => setUserTrialDays(ctx.db, ctx.session.user.username, input)),

  userTrialChanges: adminProcedure.input(userIdSchema).query(({ ctx, input }) => getUserTrialChanges(ctx.db, input.userId)),
```

`tests/integration/register.test.ts` dòng so `trialEndsAt` đổi thành:
```ts
    expect(u.trialEndsAt?.toISOString()).toBe(trialEndFor(before, 60)?.toISOString())
```

Run:
```bash
pnpm test tests/integration/trial-days.test.ts
pnpm test tests/integration/register.test.ts
pnpm test tests/integration/admin.test.ts
```
Expected: PASS cả 3 file.

- [ ] **Step 8: Key i18n**

`src/language/vi.json`: dòng cuối (sau Task 5) là `  "admin_price_err_order": "Giá Pro phải cao hơn giá Plus"` → thêm dấu phẩy và chèn:
```json
  "admin_trial_default": "Dùng thử Pro cho tài khoản mới",
  "admin_trial_days": "Số ngày dùng thử",
  "admin_trial_default_note": "0 = không dùng thử. Chỉ áp cho tài khoản đăng ký sau khi lưu, người đang dùng thử giữ hạn cũ.",
  "admin_trial_err_range": "Số ngày từ 0 đến 365",
  "admin_trial_save": "Lưu số ngày",
  "admin_trial_confirm_title": "Đổi số ngày dùng thử?",
  "admin_trial_change": "{old} → {new} ngày",
  "admin_trial_initial": "Ban đầu {n} ngày",
  "admin_trial_saved": "Đã cập nhật số ngày dùng thử",
  "admin_trial_history": "Lịch sử số ngày dùng thử",
  "admin_trial_no_history": "Chưa có lịch sử",
  "admin_set_trial": "Đặt dùng thử",
  "admin_trial_user_label": "Số ngày dùng thử (tính từ ngày tạo tài khoản)",
  "admin_trial_current": "Hiện tại: {n} ngày, dùng đến hết ngày {date}",
  "admin_trial_none": "Chưa có dùng thử",
  "admin_trial_new_until": "Hạn dùng thử mới: dùng đến hết ngày {date}",
  "admin_trial_days_left": "Còn {n} ngày dùng thử",
  "admin_trial_expired": "Hạn này đã qua, tài khoản không còn dùng thử",
  "admin_trial_off": "Không dùng thử",
  "admin_trial_err_user_range": "Số ngày từ 0 đến 3650",
  "admin_trial_set": "Đã đặt số ngày dùng thử",
  "admin_trial_recent": "Lần đặt gần đây"
```
`src/language/en.json`: dòng cuối `  "admin_price_err_order": "Pro must cost more than Plus"` → thêm dấu phẩy và chèn:
```json
  "admin_trial_default": "Pro trial for new accounts",
  "admin_trial_days": "Trial days",
  "admin_trial_default_note": "0 = no trial. Applies only to accounts registered after saving; current trials keep their end date.",
  "admin_trial_err_range": "Days must be 0 to 365",
  "admin_trial_save": "Save days",
  "admin_trial_confirm_title": "Change trial days?",
  "admin_trial_change": "{old} → {new} days",
  "admin_trial_initial": "Initial {n} days",
  "admin_trial_saved": "Trial days updated",
  "admin_trial_history": "Trial days history",
  "admin_trial_no_history": "No history yet",
  "admin_set_trial": "Set trial",
  "admin_trial_user_label": "Trial days (from account creation)",
  "admin_trial_current": "Current: {n} days, until end of {date}",
  "admin_trial_none": "No trial",
  "admin_trial_new_until": "New trial end: until end of {date}",
  "admin_trial_days_left": "{n} trial days left",
  "admin_trial_expired": "This date has passed, no active trial",
  "admin_trial_off": "No trial",
  "admin_trial_err_user_range": "Days must be 0 to 3650",
  "admin_trial_set": "Trial days set",
  "admin_trial_recent": "Recent changes"
```
Run (Bash): lệnh `node -e …` so key của Task 5 Step 2 → Expected `[[],[]]`.

- [ ] **Step 9: Unit test `TrialDaysForm` (RED)**

Tạo `tests/unit/components/TrialDaysForm.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TrialDaysForm } from "@/components/admin/TrialDaysForm"

type MutOpts = { onSuccess?: () => void; onError?: (e: { message: string; data?: { code?: string } | null }) => void }

const h = vi.hoisted(() => ({ mutate: vi.fn(), opts: null as null | MutOpts, invalidate: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { trialSettings: { invalidate: h.invalidate } } }),
    admin: {
      trialSettings: {
        useQuery: () => ({
          data: {
            days: 60,
            history: [
              { id: 2, days: 60, previousDays: 90, changedBy: "admin_test", createdAt: "2026-09-27T03:05:00.000Z" },
              { id: 1, days: 90, previousDays: null, changedBy: "migration", createdAt: "2026-09-27T01:00:00.000Z" },
            ],
          },
          isPending: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      updateTrialDays: {
        useMutation: (opts: MutOpts) => {
          h.opts = opts
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

function renderForm() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <TrialDaysForm />
    </LanguageProvider>
  )
}
const input = () => screen.getByRole("textbox", { name: "Số ngày dùng thử" }) as HTMLInputElement
const save = () => screen.getByRole("button", { name: "Lưu số ngày" }) as HTMLButtonElement
const form = () => screen.getByTestId("trial-days-form").textContent ?? ""

beforeEach(() => {
  vi.clearAllMocks()
  h.opts = null
})

describe("TrialDaysForm", () => {
  it("hiện số ngày hiện hành, ghi chú chỉ áp tài khoản mới; chưa đổi thì Lưu khóa; lịch sử cũ → mới", () => {
    renderForm()
    expect(input().value).toBe("60")
    expect(form()).toContain("Chỉ áp cho tài khoản đăng ký sau khi lưu")
    expect(save().disabled).toBe(true)
    const cards = screen.getAllByTestId("trial-history-card").map((c) => c.textContent)
    expect(cards[0]).toContain("90 → 60 ngày")
    expect(cards[0]).toContain("admin_test · 27/09/2026 10:05")
    expect(cards[1]).toContain("Ban đầu 90 ngày")
  })

  it("ngoài 0–365 hoặc trống → lỗi, Lưu khóa; 0 hợp lệ", () => {
    renderForm()
    fireEvent.change(input(), { target: { value: "400" } })
    expect(form()).toContain("Số ngày từ 0 đến 365")
    expect(save().disabled).toBe(true)
    fireEvent.change(input(), { target: { value: "" } })
    expect(save().disabled).toBe(true)
    fireEvent.change(input(), { target: { value: "0" } })
    expect(form()).not.toContain("Số ngày từ 0 đến 365")
    expect(save().disabled).toBe(false)
  })

  it("gõ 90 → Lưu → hộp xác nhận 60 → 90 ngày → Xác nhận gửi days + expected", () => {
    renderForm()
    fireEvent.change(input(), { target: { value: "90" } })
    fireEvent.click(save())
    const confirm = screen.getByTestId("trial-confirm")
    expect(confirm.textContent).toContain("Đổi số ngày dùng thử?")
    expect(confirm.textContent).toContain("60 → 90 ngày")
    fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận" }))
    expect(h.mutate).toHaveBeenCalledWith({ days: 90, expected: 60 })
  })

  it("CONFLICT → nạp lại cấu hình", () => {
    renderForm()
    act(() => h.opts!.onError!({ message: "Số ngày dùng thử vừa được đổi ở nơi khác, tải lại để xem", data: { code: "CONFLICT" } }))
    expect(h.invalidate).toHaveBeenCalledTimes(1)
  })
})
```

Run: `pnpm test tests/unit/components/TrialDaysForm.test.tsx`
Expected: FAIL — không resolve được `@/components/admin/TrialDaysForm`.

- [ ] **Step 10: Tạo `src/components/admin/TrialDaysForm.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { trialDaysSchema } from "@/lib/schemas/plan"
import { dateTimeVn } from "./admin-format"

type Row = RouterOutputs["admin"]["trialSettings"]["history"][number]

export function TrialDaysForm() {
  const { t } = useTranslation()
  const query = trpc.admin.trialSettings.useQuery()
  const days = query.data?.days

  const change = (r: Row) =>
    r.previousDays === null
      ? t("admin_trial_initial").replace("{n}", String(r.days))
      : t("admin_trial_change").replace("{old}", String(r.previousDays)).replace("{new}", String(r.days))

  const columns: Column<Row>[] = [
    { header: t("admin_price_time"), cell: (r) => dateTimeVn(r.createdAt) },
    { header: t("admin_trial_days"), cell: change },
    { header: t("admin_price_changed_by"), cell: (r) => r.changedBy },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">{t("admin_trial_default")}</h2>
      {days !== undefined ? (
        // key theo số hiện hành: Lưu xong hoặc CONFLICT nạp số mới thì ô nhập khởi tạo lại.
        <TrialInput key={days} current={days} />
      ) : (
        query.isPending && <Skeleton className="h-32 w-full rounded-xl" />
      )}
      <h3 className="text-sm font-semibold text-foreground">{t("admin_trial_history")}</h3>
      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.history ?? []}
        getKey={(r) => r.id}
        columns={columns}
        emptyText={t("admin_trial_no_history")}
        renderCard={(r) => (
          <div data-testid="trial-history-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
            <p className="font-medium text-foreground">{change(r)}</p>
            <p className="text-xs text-slate-500">
              {r.changedBy} · {dateTimeVn(r.createdAt)}
            </p>
          </div>
        )}
      />
    </section>
  )
}

function TrialInput({ current }: { current: number }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [days, setDays] = useState<number | undefined>(current)
  const [confirming, setConfirming] = useState(false)
  const update = trpc.admin.updateTrialDays.useMutation({
    onSuccess: () => {
      toast.success(t("admin_trial_saved"))
      setConfirming(false)
    },
    onError: (e) => {
      toast.error(e.message)
      setConfirming(false)
      if (e.data?.code === "CONFLICT") void utils.admin.trialSettings.invalidate()
    },
  })

  const invalid = !trialDaysSchema.safeParse(days).success
  const canSave = !invalid && days !== current && !update.isPending

  return (
    <div data-testid="trial-days-form" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <p className="text-sm text-slate-600">{t("admin_trial_days")}</p>
      <CurrencyInput aria-label={t("admin_trial_days")} value={days} onChange={setDays} className="h-11 md:h-10 md:max-w-40" />
      {invalid && <p className="text-xs text-destructive">{t("admin_trial_err_range")}</p>}
      <p className="text-xs text-slate-500">{t("admin_trial_default_note")}</p>
      <Button type="button" className="h-12 w-full md:w-auto" disabled={!canSave} onClick={() => setConfirming(true)}>
        {t("admin_trial_save")}
      </Button>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent data-testid="trial-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_trial_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {`${t("admin_trial_change").replace("{old}", String(current)).replace("{new}", String(days ?? 0))}. ${t("admin_trial_default_note")}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-10" disabled={update.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 md:h-10"
              disabled={update.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (days !== undefined) update.mutate({ days, expected: current })
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

Run: `pnpm test tests/unit/components/TrialDaysForm.test.tsx`
Expected: PASS.

- [ ] **Step 11: Unit test `TrialDaysDialog` (RED)**

Tạo `tests/unit/components/TrialDaysDialog.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TrialDaysDialog } from "@/components/admin/TrialDaysDialog"
import { addDays, formatValidUntil, trialEndFor } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]
type Change = { id: number; days: number; previousDays: number | null; changedBy: string; createdAt: string }

const h = vi.hoisted(() => ({ mutate: vi.fn(), onSuccess: null as null | (() => void), changes: [] as Change[] }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      userTrialChanges: { useQuery: () => ({ data: h.changes }) },
      setUserTrial: {
        useMutation: (opts: { onSuccess?: () => void }) => {
          h.onSuccess = opts.onSuccess ?? null
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

const created50 = addDays(new Date(), -50)

function row(over: Partial<UserRow> = {}): UserRow {
  return {
    id: 7,
    username: "gv_a",
    fullName: null,
    createdAt: created50.toISOString(),
    lastLoginAt: null,
    activeStudents: 0,
    plan: "pro",
    source: "trial",
    expiresAt: null,
    trialEndsAt: trialEndFor(created50, 60)!.toISOString(),
    isAdmin: false,
    ...over,
  } as UserRow
}

function renderDialog(user: UserRow, onClose = vi.fn()) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <TrialDaysDialog user={user} onClose={onClose} />
    </LanguageProvider>
  )
  return onClose
}
const input = () => screen.getByRole("textbox", { name: "Số ngày dùng thử (tính từ ngày tạo tài khoản)" }) as HTMLInputElement
const saveBtn = () => screen.getByRole("button", { name: "Lưu" }) as HTMLButtonElement
const dialogText = () => screen.getByRole("dialog").textContent ?? ""

beforeEach(() => {
  vi.clearAllMocks()
  h.changes = []
  h.onSuccess = null
})

describe("TrialDaysDialog", () => {
  it("hiện ngày tạo + số ngày hiện tại; gõ 120 → hạn mới dd/mm/yyyy + còn 70 ngày; Lưu gửi userId + days", () => {
    renderDialog(row())
    expect(dialogText()).toContain(`Ngày tạo: ${formatVnDate(created50)}`)
    expect(dialogText()).toContain(`Hiện tại: 60 ngày, dùng đến hết ngày ${formatValidUntil(trialEndFor(created50, 60)!)}`)
    expect(input().value).toBe("60")
    expect(saveBtn().disabled).toBe(true)
    fireEvent.change(input(), { target: { value: "120" } })
    const preview = screen.getByTestId("trial-preview").textContent ?? ""
    expect(preview).toContain(`Hạn dùng thử mới: dùng đến hết ngày ${formatValidUntil(trialEndFor(created50, 120)!)}`)
    expect(preview).toContain("Còn 70 ngày dùng thử")
    fireEvent.click(saveBtn())
    expect(h.mutate).toHaveBeenCalledWith({ userId: 7, days: 120 })
  })

  it("Review Focus 4: tài khoản cũ chưa có dùng thử, tạo 400 ngày trước; gõ 90 → báo hạn đã qua, vẫn cho Lưu", () => {
    renderDialog(row({ createdAt: addDays(new Date(), -400).toISOString(), trialEndsAt: null }))
    expect(dialogText()).toContain("Chưa có dùng thử")
    expect(input().value).toBe("")
    expect(screen.queryByTestId("trial-preview")).toBeNull()
    fireEvent.change(input(), { target: { value: "90" } })
    expect(screen.getByTestId("trial-preview").textContent).toContain("Hạn này đã qua, tài khoản không còn dùng thử")
    expect(saveBtn().disabled).toBe(false)
  })

  it("0 → Không dùng thử; 4000 → lỗi khoảng, Lưu khóa", () => {
    renderDialog(row())
    fireEvent.change(input(), { target: { value: "0" } })
    expect(screen.getByTestId("trial-preview").textContent).toContain("Không dùng thử")
    fireEvent.change(input(), { target: { value: "4000" } })
    expect(dialogText()).toContain("Số ngày từ 0 đến 3650")
    expect(saveBtn().disabled).toBe(true)
  })

  it("lần đặt gần đây hiện ai, lúc nào, cũ → mới; Lưu xong → toast + đóng", () => {
    h.changes = [{ id: 1, days: 120, previousDays: 60, changedBy: "admin_test", createdAt: "2026-09-27T03:05:00.000Z" }]
    const onClose = renderDialog(row())
    expect(dialogText()).toContain("admin_test · 27/09/2026 10:05 · 60 → 120 ngày")
    act(() => h.onSuccess!())
    expect(toast.success).toHaveBeenCalledWith("Đã đặt số ngày dùng thử")
    expect(onClose).toHaveBeenCalled()
  })
})
```

Run: `pnpm test tests/unit/components/TrialDaysDialog.test.tsx`
Expected: FAIL — không resolve được `@/components/admin/TrialDaysDialog`.

- [ ] **Step 12: Tạo `src/components/admin/TrialDaysDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { daysLeft, formatValidUntil, trialDaysOf, trialEndFor } from "@/lib/plans"
import { userTrialDaysSchema } from "@/lib/schemas/plan"
import { dateOrDash, dateTimeVn } from "./admin-format"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

// Xem trước bằng cùng hàm với server: hạn = đầu ngày VN của ngày tạo tài khoản + N ngày (spec L mục 15 T3).
export function TrialDaysDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation()
  const createdAt = new Date(user.createdAt)
  const currentEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null
  const currentDays = trialDaysOf(createdAt, currentEnd)
  const [days, setDays] = useState<number | undefined>(currentDays ?? undefined)
  const changes = trpc.admin.userTrialChanges.useQuery({ userId: user.id })
  const mut = trpc.admin.setUserTrial.useMutation({
    onSuccess: () => {
      toast.success(t("admin_trial_set"))
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const now = new Date()
  const valid = userTrialDaysSchema.safeParse(days).success
  const newEnd = valid && days !== undefined ? trialEndFor(createdAt, days) : null
  const canSave = valid && days !== currentDays && !mut.isPending
  const change = (prev: number | null, next: number) =>
    t("admin_trial_change").replace("{old}", prev === null ? "-" : String(prev)).replace("{new}", String(next))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{`${t("admin_set_trial")} · ${user.username}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            {t("admin_col_created")}: {dateOrDash(user.createdAt)}
          </p>
          <p className="text-slate-600">
            {currentDays !== null && currentEnd
              ? t("admin_trial_current").replace("{n}", String(currentDays)).replace("{date}", formatValidUntil(currentEnd))
              : t("admin_trial_none")}
          </p>
          <div className="space-y-2">
            <p className="font-medium text-foreground">{t("admin_trial_user_label")}</p>
            <CurrencyInput aria-label={t("admin_trial_user_label")} value={days} onChange={setDays} className="h-11 md:h-10" />
            {days !== undefined && !valid && <p className="text-xs text-destructive">{t("admin_trial_err_user_range")}</p>}
          </div>
          {valid && (
            <p data-testid="trial-preview" className="font-medium text-foreground">
              {newEnd === null
                ? t("admin_trial_off")
                : `${t("admin_trial_new_until").replace("{date}", formatValidUntil(newEnd))} · ${
                    newEnd > now ? t("admin_trial_days_left").replace("{n}", String(daysLeft(newEnd, now))) : t("admin_trial_expired")
                  }`}
            </p>
          )}
          {changes.data && changes.data.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("admin_trial_recent")}</p>
              <ul className="space-y-0.5 text-xs text-slate-500">
                {changes.data.map((c) => (
                  <li key={c.id}>{`${c.changedBy} · ${dateTimeVn(c.createdAt)} · ${change(c.previousDays, c.days)}`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 md:h-10"
            disabled={!canSave}
            onClick={() => days !== undefined && mut.mutate({ userId: user.id, days })}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Run: `pnpm test tests/unit/components/TrialDaysDialog.test.tsx`
Expected: PASS.

- [ ] **Step 13: Gắn vào `AdminAccounts` và trang `/admin/prices`**

`src/components/admin/AdminAccounts.tsx`:
- Thêm import `import { TrialDaysDialog } from "./TrialDaysDialog"`.
- Dưới `const [setPlanFor, setSetPlanFor] = …` thêm `const [trialFor, setTrialFor] = useState<UserRow | null>(null)`.
- Dưới hàm `setPlanButton`, thêm:
```tsx
  const actions = (u: UserRow) => (
    <div className="flex flex-wrap gap-2">
      {setPlanButton(u)}
      {/* Admin không dùng gói nên không cần đặt dùng thử (spec L mục 15). */}
      {!u.isAdmin && (
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setTrialFor(u)}>
          {t("admin_set_trial")}
        </Button>
      )}
    </div>
  )
```
- Cột cuối `cell: setPlanButton` → `cell: actions`; trong `renderCard`, `{setPlanButton(u)}` → `{actions(u)}`.
- Dưới dòng `{setPlanFor && <SetPlanDialog … />}` thêm:
```tsx
      {trialFor && <TrialDaysDialog key={trialFor.id} user={trialFor} onClose={() => setTrialFor(null)} />}
```

`src/app/(admin)/admin/prices/page.tsx` thay bằng:
```tsx
import { AdminPrices } from "@/components/admin/AdminPrices"
import { TrialDaysForm } from "@/components/admin/TrialDaysForm"

export default function AdminPricesPage() {
  return (
    <div className="space-y-8">
      <AdminPrices />
      <TrialDaysForm />
    </div>
  )
}
```

Run:
```bash
pnpm exec tsc --noEmit
pnpm test tests/unit/next15-contract.test.ts
```
Expected: sạch / PASS.

- [ ] **Step 14: E2E `tests/e2e/admin-trial.spec.ts`**

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const DAY = 86_400_000;
const VN = 7 * 3_600_000;
// Chép logic vnStartOfDay / formatVnDate để e2e không import code src.
const vnStart = (d: Date) => new Date(Math.floor((d.getTime() + VN) / DAY) * DAY - VN);
const vnDate = (d: Date) => {
  const v = new Date(d.getTime() + VN);
  return `${String(v.getUTCDate()).padStart(2, '0')}/${String(v.getUTCMonth() + 1).padStart(2, '0')}/${v.getUTCFullYear()}`;
};

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
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/orders$/ : /.*dashboard/);
  return page;
}

// tests/setup.ts không xóa bảng này: dọn để mặc định về 60 cho file khác.
async function resetTrial() {
  await db.trialDayChange.deleteMany({ where: { changedBy: { not: 'migration' } } });
}
async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetTrial();
  await resetStd();
});

test.afterAll(async () => {
  await resetTrial();
  await resetStd();
  await db.$disconnect();
});

test('desktop: thẻ dùng thử mặc định 60 ngày; admin đặt 120 ngày cho teacher_std → hạn mới, giáo viên thấy Pro dùng thử', async ({ browser }) => {
  const std = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
  const end = new Date(vnStart(std.createdAt).getTime() + 120 * DAY);
  const lastDay = vnDate(new Date(end.getTime() - 1));
  const left = Math.round((vnStart(new Date(end.getTime() - 1)).getTime() - vnStart(new Date()).getTime()) / DAY) + 1;
  expect(left).toBeGreaterThan(0);

  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await admin.goto('/admin/prices');
  await expect(admin.getByTestId('trial-days-form').getByRole('textbox', { name: 'Số ngày dùng thử' })).toHaveValue('60');
  await expect(admin.getByRole('row').filter({ hasText: 'Ban đầu 60 ngày' })).toHaveCount(1);

  await admin.goto('/admin/accounts');
  await expect(admin.getByRole('row').filter({ hasText: 'admin_test' }).getByRole('button', { name: 'Đặt dùng thử' })).toHaveCount(0);
  await admin.getByRole('row').filter({ hasText: 'teacher_std' }).getByRole('button', { name: 'Đặt dùng thử' }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog).toContainText('Chưa có dùng thử');
  await dialog.getByRole('textbox', { name: 'Số ngày dùng thử (tính từ ngày tạo tài khoản)' }).fill('120');
  const preview = dialog.getByTestId('trial-preview');
  await expect(preview).toContainText(`Hạn dùng thử mới: dùng đến hết ngày ${lastDay}`);
  await expect(preview).toContainText(`Còn ${left} ngày dùng thử`);
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(admin.getByText('Đã đặt số ngày dùng thử')).toBeVisible();
  await expect(dialog).toBeHidden();
  expect((await db.user.findUniqueOrThrow({ where: { id: std.id } })).trialEndsAt?.toISOString()).toBe(end.toISOString());
  await admin.context().close();

  const teacher = await loginAs(browser, 'teacher_std', DESKTOP);
  await teacher.goto('/plan');
  const pro = teacher.getByTestId('plan-card-pro');
  await expect(pro).toContainText('Dùng thử');
  await expect(pro).toContainText(`Dùng đến hết ngày ${lastDay}`);
  await teacher.context().close();
});

test('390px: nút Đặt dùng thử ≥44px (không có ở thẻ admin), dialog không tràn ngang, nút Hủy/Lưu ≥44px', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test', MOBILE);
  await admin.goto('/admin/accounts');
  await expect(admin.getByTestId('admin-user-card').filter({ hasText: 'admin_test' }).getByRole('button', { name: 'Đặt dùng thử' })).toHaveCount(0);
  const btn = admin.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' }).getByRole('button', { name: 'Đặt dùng thử' });
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await btn.click();
  const dialog = admin.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Số ngày dùng thử (tính từ ngày tạo tài khoản)' }).fill('0');
  await expect(dialog.getByTestId('trial-preview')).toContainText('Không dùng thử');
  for (const name of ['Hủy', 'Lưu']) {
    expect((await dialog.getByRole('button', { name, exact: true }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
  }
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).toBeHidden();
  await admin.context().close();
});
```

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin-trial.spec.ts tests/e2e/admin-prices.spec.ts tests/e2e/admin.spec.ts
```
Expected: seed PASS; e2e tất cả passed.

- [ ] **Step 15: tsc + lint + theme + test liên quan**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test tests/unit/theme-legacy-colors.test.ts
pnpm test tests/unit/components/AdminPrices.test.tsx
```
Expected: sạch / PASS.

- [ ] **Step 16: Commit**

```bash
git add src/lib/plans.ts src/lib/schemas/plan.ts src/server/services/trial.service.ts src/server/services/user.service.ts src/server/services/plan-admin.service.ts src/server/trpc/routers/admin.ts src/language/vi.json src/language/en.json src/components/admin/TrialDaysForm.tsx src/components/admin/TrialDaysDialog.tsx src/components/admin/AdminAccounts.tsx "src/app/(admin)/admin/prices/page.tsx" tests/unit/lib/plans.test.ts tests/unit/schemas/plan.schema.test.ts tests/integration/register.test.ts tests/integration/trial-days.test.ts tests/unit/components/TrialDaysForm.test.tsx tests/unit/components/TrialDaysDialog.test.tsx tests/e2e/admin-trial.spec.ts
git commit -m "feat(l): số ngày dùng thử Pro cấu hình được (mặc định cho tài khoản mới, đặt riêng từng tài khoản)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 7: Kiểm chứng cuối + danh sách kiểm tra tay (không merge, không push)

**Đọc trước:** Global Constraints; spec mục 2, 11, 12, 13, 15; "Điều chỉnh so với spec"; `git log --oneline main..HEAD` (6 commit của Task 1–6 + 1 commit docs).

**Files:**
- Không tạo file mới. Chỉ sửa file của Task 1–6 nếu bước kiểm chứng phát hiện lỗi (mỗi sửa: test tái hiện → sửa → commit riêng `fix(l): …`, ghi vào báo cáo).

**Interfaces:**
- Consumes: toàn bộ Task 1–6.
- Produces: báo cáo cho người điều phối.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Quét sót**

Run (Bash):
```bash
grep -rn "PLAN_PRICES\|\bTRIAL_DAYS\b" src tests | grep -v DEFAULT_TRIAL_DAYS
grep -rnE "\b(49000|99000|490000|990000|980000|1980000)\b" src
grep -rn "indigo-\|violet-\|purple-" src/components/admin src/components/plan "src/app/(admin)"
grep -rnP "[—–]" src/components/admin/AdminPrices.tsx src/components/admin/TrialDaysForm.tsx src/components/admin/TrialDaysDialog.tsx src/server/services/plan-price.service.ts src/server/services/trial.service.ts
git diff main..HEAD -- src/language | grep -P "^\+.*[—–]"
node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(JSON.stringify([a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k))]))"
git diff main..HEAD -- prisma/migrations | grep -E "^\+" | grep -iE "DROP|ALTER|TRUNCATE|DELETE|UPDATE"
git diff --stat main..HEAD -- prisma/ tests/setup.ts
grep -cE "^\s+\w+: adminProcedure" src/server/trpc/routers/admin.ts
grep -rn "input\.\(admin\|changedBy\)" src/server/trpc/routers/admin.ts
```
Expected: lệnh 1 không in gì; lệnh 2 chỉ in dòng `DEFAULT_MONTH_PRICES` trong `src/lib/plans.ts`; lệnh 3, 4, 5 không in gì; lệnh 6 in `[[],[]]`; lệnh 7 không in gì; lệnh 8 chỉ có `prisma/schema.prisma` và 1 thư mục `*_add_plan_settings` (không có `tests/setup.ts`); lệnh 9 in `11` (mọi procedure admin: overview, orderHistory, prices, approveOrder, rejectOrder, setPlan, updatePrices, trialSettings, updateTrialDays, setUserTrial, userTrialChanges); lệnh 10 không in gì (`changedBy` lấy từ session).

- [ ] **Step 3: Toàn bộ unit + integration**

Run: `pnpm test` (~10–15 phút, không chạy song song lệnh test khác)
Expected: toàn bộ PASS, gồm `plans`, `plan.schema`, `plan-settings-migration`, `plan-prices`, `plan-orders`, `admin` (integration), `trial-days`, `register`, `AdminPrices`, `TrialDaysForm`, `TrialDaysDialog`, `AdminNav`, `PlanPurchaseDialog`, `PlanCompare`, `theme-legacy-colors`, `next15-contract`.

Sau khi chạy, xác nhận dữ liệu cấu hình về mặc định (test nào quên dọn thì các test dưới đây đỏ):
```bash
pnpm test tests/integration/plan-prices.test.ts
pnpm test tests/integration/register.test.ts
```
Expected: PASS cả 2 (test đầu "giá seed 49.000/99.000" của `plan-prices` chỉ xanh khi không còn dòng giá sót; test dùng thử 60 ngày của `register` chỉ xanh khi mặc định dùng thử đã về 60).

- [ ] **Step 4: E2E toàn bộ**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test
```
Expected: tất cả passed (`upgrade-class` có thể `skipped` nếu DB test đã nâng lớp năm nay — chấp nhận). File nào fail: chạy lại riêng file đó 1 lần để loại chập chờn; vẫn fail → sửa theo quy tắc ở mục Files, ghi vào báo cáo. `plan.spec.ts`, `renew-offer.spec.ts`, `plan-locks.spec.ts` phải thấy giá 490.000/990.000 (giá seed) — nếu thấy giá khác nghĩa là file e2e nào đó không dọn `plan_price_changes`.

- [ ] **Step 5: Lint + tsc + build (DB test)**

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
Expected: sạch; build thành công, danh sách route có `/admin/prices` cùng `/admin/orders`, `/admin/accounts`, `/admin/history`. KHÔNG chạy `pnpm build` (có `prisma migrate deploy` lên `.env` production).

- [ ] **Step 6: Báo cáo cho người điều phối (không merge, không push)**

Gồm: kết quả Step 2–5, `git log --oneline main..HEAD`, mọi chỗ code lệch plan (kèm lý do), danh sách kiểm tra tay ở Step 7, và nhắc: **trước khi merge, người điều phối tạo backup Neon** (Neon console → project production → "Branch from current", đặt tên kiểu `backup-before-L-plan-prices-2026-09-xx`, ghi lại tên để rollback).

- [ ] **Step 7: Kiểm tra tay cho người dùng (sau khi merge + Vercel deploy; agent KHÔNG làm)**

1. **Backup trước merge:** đã có branch Neon `backup-before-L-plan-prices-…` (người điều phối tạo).
2. **Log build Vercel:** có `Applying migration ..._add_plan_settings` và `All migrations have been successfully applied`; thấy `Resetting` / `rolled back` → rollback ngay (khôi phục từ branch backup). Không chạy lệnh DB tay lên prod.
3. **Tài khoản admin (người dùng tự đăng nhập, vd `hien_admin`):** sidebar desktop có 4 mục, mobile tab bar 4 tab (Đơn chờ, Tài khoản, Lịch sử, Bảng giá) không tràn; `/admin/prices` hiện Plus 49.000, Pro 99.000, xem trước 490.000/980.000 và 990.000/1.980.000, lịch sử 2 dòng "Giá ban đầu" người đổi "migration"; thẻ "Dùng thử Pro cho tài khoản mới" hiện 60 và lịch sử "Ban đầu 60 ngày". **Không** đổi giá / số ngày thật để thử nếu người dùng chưa muốn (nếu thử: đổi rồi Lưu lại giá cũ, lịch sử sẽ có 2 dòng). Màn Tài khoản & gói: mỗi tài khoản giáo viên có nút "Đặt dùng thử", dòng tài khoản admin không có; mở dialog thấy ngày tạo, số ngày hiện tại, gõ số khác thấy hạn mới — bấm Hủy nếu không định đổi thật.
4. **Tài khoản `qa_test` (id 4, người dùng tự đăng nhập):** `/plan` hiện đúng giá 49.000/99.000 (năm 490.000/990.000, 2 năm 980.000/1.980.000); popup mua gói hiện cùng giá. **Không bấm "Tạo đơn"** nếu không định chuyển tiền thật (lỡ bấm thì "Hủy yêu cầu"). Không tạo đơn trên tài khoản khác.
5. **Rollback:** code cũ không đọc 2 bảng mới nên revert commit merge là đủ; bảng thừa không gây hại (không cần xóa).

---

## Self-Review (người viết plan đã chạy)

- **Phủ spec:** mục 2 (T3 FORBIDDEN, T4 popup/CONFLICT, T5 màn + mobile, T7 lint/test/build); L1 (T5 form tháng + xem trước), L2 (T3 ghi ngay), L3 (T1 bảng, T3 ghi, T5 hiện lịch sử), L4 (T2 test đơn chờ + QR, quy đổi theo `order.amount`), L5 (không hẹn giờ); Q1–Q4 (T1), Q5 (T2 `prices`, T4 client), Q6 (T2 server, T4 client), Q7–Q8 (T2 đọc bằng `tx`, T3 race), Q9 (T3 khóa + `expected`, test 2 lần Lưu), Q10 (T2), Q11 (không đổi), Q12–Q13 (T3 zod + service, T5 lỗi tại chỗ), Q14 (T3 `changed`, `BAD_REQUEST`), Q15 (T1 `take: 50`, T5 "Giá ban đầu"), Q16 (T5), Q17 (không đổi `adminSetPlan`); 6.1–6.3 (T1); 7.1 (T1, T2, T4), 7.2 (T1, T3), 7.3 (T2), 7.4 (T2), 7.5 (T2, T3), 7.6 (T3); 8.1–8.2 (T5), 8.3 (T4); 9 (T4, T5; thêm `admin_price_time` có lý do); 10 (từng task; test fallback đổi sang rollback có lý do); 11 ý 1–7 (T2, T3, T4, T7 Step 2); 12 (T7 Step 6–7); 15 T1–T3 + UI + Test (T1 bảng/seed 60, T6).
- **Placeholder:** không có TBD/TODO; mọi bước code có code đầy đủ; bước điều kiện (fallback `migrate diff` khi không tạo được shadow DB) có lệnh sẵn.
- **Nhất quán tên:** `PlanPrices`, `DEFAULT_MONTH_PRICES`, `PERIOD_PRICE_FACTOR`, `pricesFromMonthly`, `getMonthlyPrices`, `getPlanPrices`, `getPriceHistory`, `updatePrices`, `SETTINGS_LOCK_CLASS`, `monthPriceSchema`, `updatePricesSchema`, `expectedAmount`, `DEFAULT_TRIAL_DAYS`, `trialEndFor(createdAt, days)`, `trialDaysOf`, `trialDaysSchema`, `userTrialDaysSchema`, `updateTrialDaysSchema`, `setUserTrialSchema`, `userIdSchema`, `getDefaultTrialDays`, `getTrialHistory`, `updateDefaultTrialDays`, `setUserTrialDays`, `getUserTrialChanges`, `dateTimeVn`, tRPC `admin.prices|updatePrices|trialSettings|updateTrialDays|setUserTrial|userTrialChanges`, test id `admin-prices-form`/`price-plus`/`price-pro`/`price-confirm`/`price-history-card`/`trial-days-form`/`trial-confirm`/`trial-history-card`/`trial-preview` dùng giống nhau ở mọi task.
- **Review Focus:** 5 dòng, mỗi dòng có test ở task sở hữu code (T5 AdminPrices "gõ 59.000", T3 "2 lần Lưu cùng lúc", T6 plans + trial-days "mặc định 0", T6 TrialDaysDialog + trial-days "tài khoản cũ", T4 PlanPurchaseDialog "+17 ngày Pro").
