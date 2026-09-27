# J — Khu quản trị riêng, popup mua gói, nhãn gói cạnh logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin (env `ADMIN_USERNAMES`) có khu `/admin/*` riêng (layout, sidebar, tab bar, 3 màn Đơn chờ / Tài khoản & gói / Lịch sử đơn) và bị chặn khỏi mọi route giáo viên; giáo viên vào `/admin*` → 404; trang `/plan` bỏ thẻ "Gói hiện tại" + khối checkout inline, 3 thẻ gói cao bằng nhau, CTA mở popup mua gói (chọn gói/thời hạn/Đơn hàng → Tạo đơn → VietQR trong popup); sidebar giáo viên có nhãn gói cạnh chữ "Lịch dạy".

**Architecture:** `isAdminUsername` chuyển sang `src/lib/admin.ts` (thuần) để middleware Edge (`authConfig.callbacks.authorized`) dùng được: admin + path ngoài `/admin` → `Response.redirect("/admin/orders")`. Lưới thứ 2 ở `src/app/(app)/layout.tsx` (`redirect`), 404 ở `src/app/(admin)/admin/layout.tsx` (`notFound`). Khu quản trị là nhóm route mới `(admin)` với `AdminLayout` (dùng lại `AppHeader variant="admin"`), 3 màn tách từ `AdminPanel`, query mới `admin.orderHistory`. Trang `/plan` dùng `PlanPurchaseDialog` (mọi phép tính giữ nguyên hàm của `src/lib/plans.ts`, chuyển nguyên từ `PlanCheckout`), `?buy=1` tự mở popup. Không migration, không đổi logic tiền/ngày của I.

**Tech Stack:** Next.js 15.5 App Router, React 19, tRPC v11 (không transformer: `Date` về client là chuỗi ISO), Prisma 5 + PostgreSQL, NextAuth v5 (JWT, `authorized` callback trong middleware Edge), Tailwind 3.4, shadcn/ui (Radix Dialog/DropdownMenu), sonner, `qrcode`, Vitest 4 (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-j-admin-rieng-va-popup-mua-goi-design.md` (J1–J4 người dùng chốt; Q1–Q18 người dùng đã duyệt giữ nguyên; người dùng xác nhận làm đủ 3 màn admin gồm Lịch sử đơn + `admin.orderHistory`, popup ẩn Standard). Code của I đang ở `main` (`f2c8b88`). Chỗ plan lệch spec ghi ở mục "Điều chỉnh so với spec".

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh chạm DB (kể cả `pnpm test`, `pnpm exec playwright test`) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, Neon, host `ep-polished-voice…`) KHÁC `.env.test` (Postgres local Docker `student-test-pg`, `localhost:5433`). **Không bao giờ sửa/ghi `.env`**, chỉ đọc host để so sánh. Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người dùng.
- **CẤM:** `db:reset`, `prisma migrate reset`, `prisma migrate dev`, `db push` (mọi dạng, kể cả `--force-reset`), `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`, `git stash`. Build kiểm tra bằng `pnpm exec next build`.
- **Không migration:** spec J không đổi `prisma/schema.prisma`, không tạo thư mục trong `prisma/migrations/`.
- Không đổi logic I: `src/lib/plans.ts`, `createOrder`, `cancelOrder`, `approveOrder`, `rejectOrder`, `adminSetPlan`, `getMyPlan` giữ nguyên hành vi (chỉ được đổi chỗ import `isAdminUsername`). Field `plan.me.isAdmin` giữ nguyên (Q18).
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **E2E:** `pnpm exec playwright test <file>` (cổng 3000, `playwright.config.ts` tự khởi `pnpm dev` với DB `.env.test`, đã đặt `ADMIN_USERNAMES=admin_test` + ngân hàng giả; `reuseExistingServer: false`). Cổng 3000 bận → không tắt tiến trình đó, DỪNG và báo người dùng. E2E dùng dữ liệu seed của lượt `pnpm test` gần nhất → trước lượt e2e đầu tiên của mỗi task chạy `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed + kiểm seed gói). E2E ghi DB bằng Prisma trực tiếp phải kiểm `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` (đã có trong `beforeAll` các file) và trả `teacher_std` về Standard + xóa đơn của nó ở `afterAll`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. `ResponsiveList` render cả bảng (`hidden md:block`) lẫn thẻ (`md:hidden`) → ở 390px dùng test id của thẻ, ở 1280px lọc phần tử visible.
- Tài khoản seed DB test (mật khẩu `teacher123`): `teacher`, `teacher2` (Pro tới 2099), `teacher_std` (Standard, không trial, fullName "Giáo viên Standard"), `admin_test` (Standard, fullName "Quản trị Test", là admin trong test/e2e). Không nhập mật khẩu/credential nào khác vào trình duyệt; không ghi dữ liệu trên production.
- i18n: `src/language/vi.json` và `en.json` cùng bộ key (`LanguageProvider` gõ `Record<Language, typeof vi>` nên `tsc` bắt thiếu key ở `en`). Chuỗi mới không dùng gạch dài (—, –). Thay biến bằng `.replace("{x}", ...)` như code sẵn có. Key bỏ đi chỉ xóa sau khi `grep` không còn chỗ dùng.
- Màu (A3): nhấn `primary` (#0F766E), trung tính slate, chờ duyệt amber. **Không** indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts` phải pass, không sửa file đó). Vùng chạm ≥44px trên mobile: `h-11 md:h-10` (nút icon `size-11 md:size-10`).
- `tests/unit/next15-contract.test.ts` cấm định danh `params`/`searchParams` (có ranh giới từ) trong mọi `page.tsx`/`layout.tsx` → đặt tên biến khác (vd `query`).
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy; không mô tả lại code.
- Làm trên nhánh `feat/j-admin-rieng` (tạo ở Task 1 từ `main` mới nhất). **Không commit lên `main`. Agent thực hiện task KHÔNG merge, KHÔNG push.** Không đụng file untracked của người khác trong `.superpowers/`.
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit (chỉ `git add` đúng file của task). Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Code lệch plan (vì code thật khác mô tả) → theo code thật, giữ đúng hành vi spec, ghi lại trong báo cáo task.

## Điều chỉnh so với spec

1. **Không thêm key `plan_credit_recalc`:** key có sẵn `plan_upgrade_credit` đã kết thúc bằng "Số ngày được tính lại khi chủ app xác nhận." — thêm dòng riêng sẽ lặp câu. Panel Đơn hàng chỉ in `plan_upgrade_credit`. "Hạn mới dự kiến" dùng lại key có sẵn `plan_new_expiry`.
2. **`PendingOrderCard` thêm prop `onCancelled?: () => void`** (spec chỉ nói `className?` nếu cần): để "Hủy yêu cầu trong popup → đóng popup". Không thêm `className` (giữ viền amber trong popup).
3. **Bước `pay`:** popup nhớ `id` đơn vừa tạo (`createOrder` trả `{ id, code, bonusMonths }`); chỉ hiện `PendingOrderCard` khi `me.pendingOrder?.id === id` đó, còn lại `Skeleton` → không bao giờ hiện QR của đơn cũ trong lúc chờ refetch. Không có state `step` riêng (suy từ `createdId !== null`).
4. **Reset lựa chọn mỗi lần mở:** trang `/plan` mount popup có điều kiện (`{purchasePlan && <PlanPurchaseDialog open … />}`) nên state `choice` khởi tạo lại `{ plan: initialPlan, period: "year" }` mỗi lần mở; không cần effect reset.
5. **`admin-nav.ts` thêm `shortKey`** (nhãn ngắn cho `AdminTabBar`: `admin_tab_*`). Helper chung MỚI `src/components/admin/admin-format.ts` (`SOURCE_KEY`, `periodKey`, `dateOrDash`) cho 3 màn admin, thay cho các hàm nội bộ của `AdminPanel`.
6. **Xóa thêm key `admin_accounts`** (chỉ `AdminPanel` dùng; màn mới dùng `admin_accounts_plans`). Ngoài ra xóa đúng danh sách spec mục 9.
7. **`useSearchParams()` gán vào biến `query`** vì `tests/unit/next15-contract.test.ts` cấm định danh `searchParams` trong `page.tsx`. Trang `/plan` đã động (layout `(app)` gọi `auth()`) nên không cần `Suspense`; nếu `next build` vẫn báo thiếu Suspense thì Task 5 có bước bọc.
8. **Test lưới an toàn server:** thêm `tests/unit/layout/admin-redirect.test.ts` (mock `auth`/`redirect`) kiểm `(app)/layout` và `login/page` chuyển admin về `/admin/orders` độc lập với middleware (spec chỉ có e2e, mà e2e không phân biệt được lớp nào chặn).
9. **`CurrentPlanBadge` trả `null` khi `!me`** (bao cả `!ready`; mock `usePlan` trong test cũ trả `ready: true, me: undefined`). Pro thêm `border border-primary` để cao bằng Standard/Plus (có viền).
10. **Lịch sử đơn:** cột "Ghi chú" dùng lại key `admin_note`; trạng thái map `plan_status_approved|rejected|cancelled` (đơn `pending` không có trong lịch sử).
11. **Số đơn chờ trên sidebar admin** là pill amber `data-testid="admin-pending-count"`, chỉ hiện khi > 0.
12. **E2E `admin.spec.ts` được sửa ở nhiều task** (T2 viết lại theo URL mới, T3 thêm chặn route, T4 bỏ `current-plan`, T5 tạo đơn qua popup) vì mỗi task làm đỏ đúng phần đó; mỗi task ghi rõ đoạn thay.
13. Spec J đang untracked trên `main` → Task 1 commit spec + plan lên nhánh feature trước khi code. Plan có 7 task.

## Review Focus

1. **Vòng redirect / biên path khu quản trị:** admin vào `/admin`, `/admin/orders` phải cho qua (không vòng); `/administration`, `/adminx`, `/api/backup` phải bị chuyển về `/admin/orders`; giáo viên vào `/admin/*` được middleware cho qua để layout trả 404. Pin: unit Task 3 `tests/unit/auth-authorized.test.ts`.
2. **Middleware bị bỏ qua / Edge không đọc được env:** `(app)/layout` và `login/page` vẫn chuyển admin về `/admin/orders`, giáo viên không bị ảnh hưởng. Pin: unit Task 3 `tests/unit/layout/admin-redirect.test.ts`.
3. **Popup xem trước lệch server khi gia hạn sớm:** Plus còn 45 ngày → 12 tháng "Tặng 2 tháng" + "Tối đa 14 tháng", 24 tháng "Tặng 4 tháng" + "Tối đa 28 tháng"; lên Pro năm hiện "+22 ngày Pro"; Pro trả phí còn hạn → thẻ Plus khóa. Pin: unit Task 5 `tests/unit/components/PlanPurchaseDialog.test.tsx`.
4. **Bước thanh toán lúc refetch chậm / hủy trong popup:** vừa tạo đơn mà `me.pendingOrder` còn là đơn cũ → Skeleton, không hiện QR đơn cũ; Hủy yêu cầu trong popup → popup đóng. Pin: unit Task 5 cùng file trên.
5. **390px khi popup mở:** không tràn ngang, nút đóng (X) và mọi nút trong popup ≥44px, panel Đơn hàng xếp dưới; admin không có response nào tới `plan.me`. Pin: e2e Task 5 `tests/e2e/plan.spec.ts` + Task 3 `tests/e2e/admin.spec.ts`.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `src/lib/admin.ts` | Mới | `isAdminUsername` thuần (Edge dùng được) | 1 |
| `src/server/services/plan.service.ts` | Sửa | Bỏ thân `isAdminUsername`, import + re-export từ `@/lib/admin` | 1 |
| `src/server/services/plan-admin.service.ts` | Sửa | `getOrderHistory(db)` | 1 |
| `src/server/trpc/routers/admin.ts` | Sửa | `admin.orderHistory` | 1 |
| `tests/unit/lib/admin.test.ts` | Mới | Unit `isAdminUsername` | 1 |
| `tests/integration/admin.test.ts` | Sửa | `admin.orderHistory` quyền + dữ liệu | 1 |
| `src/components/admin/admin-format.ts` | Mới | `SOURCE_KEY`, `periodKey`, `dateOrDash` | 2 |
| `src/components/admin/admin-nav.ts` | Mới | `ADMIN_NAV_ITEMS` | 2 |
| `src/components/admin/AdminSidebar.tsx`, `AdminTabBar.tsx`, `AdminLayout.tsx` | Mới | Khung khu quản trị | 2 |
| `src/components/admin/AdminPendingOrders.tsx`, `AdminAccounts.tsx`, `AdminOrderHistory.tsx` | Mới | 3 màn (tách từ `AdminPanel`) | 2 |
| `src/components/admin/AdminPanel.tsx` | Xóa | | 2 |
| `src/app/(admin)/admin/layout.tsx`, `page.tsx`, `orders/page.tsx`, `accounts/page.tsx`, `history/page.tsx` | Mới | Route khu quản trị, 404 cho người thường | 2 |
| `src/app/(app)/admin/page.tsx` | Xóa | | 2 |
| `src/components/layout/AppHeader.tsx` | Sửa | Prop `variant`, menu admin | 2 |
| `src/language/vi.json`, `en.json` | Sửa | Key admin (T2), `/plan` (T4), popup (T5), badge (T6) | 2, 4, 5, 6 |
| `tests/unit/components/AdminNav.test.tsx`, `AppHeader.test.tsx` | Mới | Sidebar/tab bar admin, menu theo variant | 2 |
| `tests/e2e/admin.spec.ts` | Sửa | Luồng admin mới, chặn route | 2, 3, 4, 5 |
| `src/server/auth.config.ts` | Sửa | `authorized`: admin ngoài `/admin` → redirect | 3 |
| `src/app/(app)/layout.tsx`, `src/app/login/page.tsx` | Sửa | Lưới an toàn: admin → `/admin/orders` | 3 |
| `tests/unit/auth-authorized.test.ts` | Sửa | Luật redirect | 3 |
| `tests/unit/layout/admin-redirect.test.ts` | Mới | Layout/login chuyển admin | 3 |
| `src/components/plan/PlanCompare.tsx` | Sửa | Cao bằng nhau, prop `me`, "Đang dùng" + hạn + số HS | 4 |
| `src/app/(app)/plan/page.tsx` | Sửa | Bỏ `current-plan`, `admin-link` (T4); popup + `?buy=1`, bỏ checkout (T5) | 4, 5 |
| `tests/unit/components/PlanCompare.test.tsx` | Mới | Thẻ đang dùng, CTA | 4 |
| `tests/e2e/plan.spec.ts` | Sửa | Trang gói mới (T4), popup (T5), badge (T6) | 4, 5, 6 |
| `src/components/plan/PlanPurchaseDialog.tsx` | Mới | Popup mua gói | 5 |
| `src/components/plan/PlanCheckout.tsx` | Xóa | | 5 |
| `src/components/plan/PendingOrderCard.tsx` | Sửa | Prop `onCancelled?` | 5 |
| `src/components/plan/RenewOffer.tsx` | Sửa | `href="/plan?buy=1"` | 5 |
| `tests/unit/components/PlanPurchaseDialog.test.tsx` | Mới | Popup | 5 |
| `tests/e2e/renew-offer.spec.ts` | Sửa | "Gia hạn ngay" mở popup | 5 |
| `src/components/plan/CurrentPlanBadge.tsx` | Mới | Nhãn gói cạnh logo | 6 |
| `src/components/layout/AppSidebar.tsx` | Sửa | Gắn `CurrentPlanBadge` | 6 |
| `tests/unit/components/CurrentPlanBadge.test.tsx` | Mới | Kiểu nhãn theo gói | 6 |
| `tests/unit/components/AppSidebar.test.tsx` | Sửa | Nhãn cạnh logo | 6 |

Thứ tự bắt buộc (tuần tự, mỗi task 1 agent mới): Task 1 → 2 → … → 7. Task 2 cần `admin.orderHistory` (T1); Task 3 cần khu `/admin/orders` (T2) để redirect không ra 404; Task 4–5 sửa lại các dòng `admin.spec.ts` do T2/T3 viết; Task 6 độc lập với 4–5 nhưng sửa `plan.spec.ts` sau T5.

---

### Task 1: Nhánh, `src/lib/admin.ts`, query `admin.orderHistory`

**Đọc trước:** Global Constraints; spec mục 4 (Q2, Q4), 7 (đoạn `src/lib/admin.ts` và `admin.orderHistory`), 10 (Unit, Integration); `docs/coding-rule.md` §6.1; `src/server/services/plan.service.ts` (hàm `isAdminUsername` dòng ~78); `src/server/services/plan-admin.service.ts`; `src/server/trpc/routers/admin.ts`; `tests/integration/admin.test.ts`.

**Files:**
- Create: `src/lib/admin.ts`
- Modify: `src/server/services/plan.service.ts` (xóa thân `isAdminUsername`, thêm import + re-export)
- Modify: `src/server/services/plan-admin.service.ts` (thêm `getOrderHistory` cuối file)
- Modify: `src/server/trpc/routers/admin.ts`
- Test (Mới): `tests/unit/lib/admin.test.ts`
- Test (Sửa): `tests/integration/admin.test.ts`

**Interfaces:**
- Consumes: `adminProcedure` (`src/server/trpc/index.ts`), `db.planOrder` (model `PlanOrder` của I: `id, userId, plan, period (string|null), amount, code (string|null), status ("pending"|"approved"|"rejected"|"cancelled"), source ("user"|"admin"), bonusMonths, creditDays, grantedUntil, note, decidedBy, decidedAt, createdAt`).
- Produces:
  - `isAdminUsername(username?: string | null): boolean` từ `@/lib/admin` (và vẫn export từ `@/server/services/plan.service`).
  - `getOrderHistory(db: PrismaClient): Promise<Array<{ id: number; code: string | null; plan: string; period: string | null; amount: number; bonusMonths: number; creditDays: number; status: string; source: string; grantedUntil: Date | null; note: string | null; decidedBy: string | null; decidedAt: Date | null; createdAt: Date; username: string; fullName: string | null }>>` — chỉ đơn `status !== "pending"`, `createdAt desc, id desc`, tối đa 100.
  - tRPC `admin.orderHistory` (query, không input) → kết quả trên. Client nhận `RouterOutputs["admin"]["orderHistory"]` (các `Date` thành `string`).

- [ ] **Step 0: Tạo nhánh, commit spec + plan**

```bash
git checkout main
git pull --ff-only
git status --short
git checkout -b feat/j-admin-rieng
git add docs/superpowers/specs/2026-09-27-j-admin-rieng-va-popup-mua-goi-design.md docs/superpowers/plans/2026-09-27-j-admin-rieng-va-popup-mua-goi.md
git commit -m "docs(j): spec + plan khu quản trị riêng, popup mua gói, nhãn gói

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
Expected: `git status --short` trước khi tạo nhánh chỉ có 2 file untracked trên (có thêm file khác của người dùng thì kệ, KHÔNG add). Nhánh `feat/j-admin-rieng` đã có → `git checkout feat/j-admin-rieng`, bỏ commit docs nếu đã có. Chỉ `git add` đúng 2 file.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG, báo người dùng.

- [ ] **Step 2: Viết unit test `isAdminUsername` (RED)**

Tạo `tests/unit/lib/admin.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest"
import { isAdminUsername } from "@/lib/admin"

const original = process.env.ADMIN_USERNAMES

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_USERNAMES
  else process.env.ADMIN_USERNAMES = original
})

describe("isAdminUsername", () => {
  it("khớp chính xác từng tên sau khi trim, phân biệt hoa thường", () => {
    process.env.ADMIN_USERNAMES = " admin_test , hien_admin "
    expect(isAdminUsername("admin_test")).toBe(true)
    expect(isAdminUsername("hien_admin")).toBe(true)
    expect(isAdminUsername("admin")).toBe(false)
    expect(isAdminUsername("Admin_test")).toBe(false)
    expect(isAdminUsername(" admin_test")).toBe(false)
  })

  it("env thiếu hoặc rỗng → false", () => {
    delete process.env.ADMIN_USERNAMES
    expect(isAdminUsername("admin_test")).toBe(false)
    process.env.ADMIN_USERNAMES = ""
    expect(isAdminUsername("admin_test")).toBe(false)
  })

  it("username null/undefined/rỗng → false, kể cả env có dấu phẩy thừa", () => {
    process.env.ADMIN_USERNAMES = "a,,b,"
    expect(isAdminUsername("")).toBe(false)
    expect(isAdminUsername(null)).toBe(false)
    expect(isAdminUsername(undefined)).toBe(false)
    expect(isAdminUsername("b")).toBe(true)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/admin.test.ts`
Expected: FAIL — không resolve được `@/lib/admin` (Failed to resolve import / Cannot find module).

- [ ] **Step 4: Tạo `src/lib/admin.ts` và đổi `plan.service.ts`**

`src/lib/admin.ts`:
```ts
// Thuần, không kéo Prisma: middleware Edge (auth.config.ts) và layout server cùng dùng.
export function isAdminUsername(username?: string | null): boolean {
  if (!username) return false
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(username)
}
```

Trong `src/server/services/plan.service.ts`:
- Xóa nguyên hàm `export function isAdminUsername(...) { ... }` (khối 8 dòng ngay trên ghi chú `// D12: TK nhận tiền của chủ app…`).
- Thêm vào nhóm import ở đầu file (ngay sau `import { findBank } from "@/lib/vn-banks"`):
```ts
import { isAdminUsername } from "@/lib/admin"
```
- Ngay sau dòng `export type Db = PrismaClient | Prisma.TransactionClient` thêm:
```ts
// Giữ export cũ để trpc/index.ts và getMyPlan không phải đổi chỗ import.
export { isAdminUsername }
```

- [ ] **Step 5: Chạy test, xác nhận pass (và `plan.me.isAdmin` không vỡ)**

Run: `pnpm test tests/unit/lib/admin.test.ts`
Expected: PASS 3 test.
Run: `pnpm test tests/integration/plan-orders.test.ts`
Expected: PASS (có test `plan.me().isAdmin` với `" admin_test , khac "`).

- [ ] **Step 6: Viết integration test `admin.orderHistory` (RED)**

Trong `tests/integration/admin.test.ts`, test `"user thường → FORBIDDEN; admin nhưng env không có tên → FORBIDDEN"`: thêm 1 dòng ngay sau dòng `await expect(c.admin.setPlan(...)).rejects...`:
```ts
    await expect(c.admin.orderHistory()).rejects.toMatchObject({ code: "FORBIDDEN" })
```

Thêm `describe` mới ở CUỐI file:
```ts
describe("admin.orderHistory", () => {
  it("chỉ đơn đã xử lý (không pending), mới nhất trước, kèm username/fullName, tối đa 100", async () => {
    // createdAt ở tương lai để chắc là đơn mới nhất DB test (file test khác có thể còn để lại đơn); reset() xóa hết sau đó.
    const future = Date.now() + 24 * 60 * 60 * 1000
    await db.planOrder.createMany({
      data: Array.from({ length: 101 }, (_, i) => ({
        userId,
        plan: "plus",
        period: "month",
        amount: 49000,
        status: "cancelled",
        createdAt: new Date(future + i * 1000),
      })),
    })
    const newest = await db.planOrder.create({
      data: {
        userId,
        plan: "pro",
        period: "year",
        amount: 990000,
        code: "HSTRY2",
        status: "rejected",
        note: "Sai nội dung",
        decidedBy: "admin_test",
        decidedAt: new Date(),
        createdAt: new Date(future + 200_000),
      },
    })
    const pending = await db.planOrder.create({
      data: { userId, plan: "plus", period: "year", amount: 490000, status: "pending", createdAt: new Date(future + 300_000) },
    })

    const rows = await (await getAuthedCaller("admin_test")).admin.orderHistory()

    expect(rows).toHaveLength(100)
    expect(rows.some((r) => r.id === pending.id)).toBe(false)
    expect(rows.every((r) => r.status !== "pending")).toBe(true)
    expect(rows[0]).toMatchObject({
      id: newest.id,
      code: "HSTRY2",
      plan: "pro",
      period: "year",
      amount: 990000,
      status: "rejected",
      source: "user",
      bonusMonths: 0,
      creditDays: 0,
      grantedUntil: null,
      note: "Sai nội dung",
      decidedBy: "admin_test",
      username: "teacher_std",
      fullName: "Giáo viên Standard",
    })
    expect(rows[0]).not.toHaveProperty("user")
    const times = rows.map((r) => r.createdAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})
```

- [ ] **Step 7: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/admin.test.ts`
Expected: FAIL ở 2 test: `c.admin.orderHistory is not a function` (hoặc lỗi tRPC "No procedure found"); các test cũ vẫn PASS.

- [ ] **Step 8: Cài `getOrderHistory` + procedure**

Cuối `src/server/services/plan-admin.service.ts`:
```ts
// Lịch sử để đối soát chuyển khoản sai nội dung (spec I-11). Vài chục tài khoản nên 100 đơn gần nhất là đủ, chưa phân trang.
export async function getOrderHistory(db: PrismaClient) {
  const rows = await db.planOrder.findMany({
    where: { status: { not: "pending" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      code: true,
      plan: true,
      period: true,
      amount: true,
      bonusMonths: true,
      creditDays: true,
      status: true,
      source: true,
      grantedUntil: true,
      note: true,
      decidedBy: true,
      decidedAt: true,
      createdAt: true,
      user: { select: { username: true, fullName: true } },
    },
  })
  return rows.map(({ user, ...o }) => ({ ...o, username: user.username, fullName: user.fullName }))
}
```

`src/server/trpc/routers/admin.ts` — sửa import và thêm procedure ngay sau `overview`:
```ts
import { adminSetPlan, approveOrder, getAdminOverview, getOrderHistory, rejectOrder } from "@/server/services/plan-admin.service"
```
```ts
  orderHistory: adminProcedure.query(({ ctx }) => getOrderHistory(ctx.db)),
```

- [ ] **Step 9: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/admin.test.ts`
Expected: PASS toàn bộ (gồm 2 thay đổi mới).

- [ ] **Step 10: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: không lỗi.

- [ ] **Step 11: Commit**

```bash
git add src/lib/admin.ts src/server/services/plan.service.ts src/server/services/plan-admin.service.ts src/server/trpc/routers/admin.ts tests/unit/lib/admin.test.ts tests/integration/admin.test.ts
git commit -m "feat(j): tách isAdminUsername sang lib/admin + query admin.orderHistory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Khu quản trị `(admin)` — layout, sidebar, tab bar, 3 màn, header `variant="admin"`

**Đọc trước:** Global Constraints; spec mục 4 (Q1, Q2, Q7, Q8, Q9), 6.1, 6.2, 9 (các key `admin_*`); `src/components/admin/AdminPanel.tsx` (toàn bộ, sẽ tách ra rồi xóa); `src/components/admin/SetPlanDialog.tsx` (props `{ user, onClose }`); `src/components/layout/AppLayout.tsx`, `AppSidebar.tsx`, `BottomTabBar.tsx`, `AppHeader.tsx`, `nav-items.ts` (`isNavActive`); `src/app/(app)/layout.tsx`, `src/app/(app)/admin/page.tsx`; `tests/unit/components/BottomTabBar.test.tsx` (mẫu mock `next/navigation`); `tests/e2e/admin.spec.ts`.

**Files:**
- Create: `src/components/admin/admin-format.ts`, `src/components/admin/admin-nav.ts`
- Create: `src/components/admin/AdminSidebar.tsx`, `src/components/admin/AdminTabBar.tsx`, `src/components/admin/AdminLayout.tsx`
- Create: `src/components/admin/AdminPendingOrders.tsx`, `src/components/admin/AdminAccounts.tsx`, `src/components/admin/AdminOrderHistory.tsx`
- Create: `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/orders/page.tsx`, `src/app/(admin)/admin/accounts/page.tsx`, `src/app/(admin)/admin/history/page.tsx`
- Delete: `src/app/(app)/admin/page.tsx`, `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/layout/AppHeader.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/components/AdminNav.test.tsx`, `tests/unit/components/AppHeader.test.tsx`
- Test (Sửa, viết lại cả file): `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `isAdminUsername` từ `@/lib/admin` (Task 1); tRPC `admin.overview` (có sẵn: `{ users: UserRow[]; pendingOrders: PendingRow[] }`), `admin.orderHistory` (Task 1), `admin.approveOrder`, `admin.rejectOrder`; `SetPlanDialog({ user, onClose })`; `isNavActive(pathname, href)` từ `@/components/layout/nav-items`; `SessionProvider` từ `@/components/providers/SessionProvider`.
- Produces:
  - `AppHeader({ variant?: "teacher" | "admin" })` — `admin`: không render `RenewOffer`, menu avatar = Quản trị (`Link` `/admin/orders`) / Đổi mật khẩu / Đăng xuất.
  - `ADMIN_NAV_ITEMS: { href: string; labelKey: keyof typeof vi; shortKey: keyof typeof vi; icon: LucideIcon }[]` (3 mục `/admin/orders`, `/admin/accounts`, `/admin/history`).
  - `AdminLayout({ children })`, `AdminSidebar()`, `AdminTabBar()`, `AdminPendingOrders()`, `AdminAccounts()`, `AdminOrderHistory()`.
  - `SOURCE_KEY`, `periodKey(p: string | null): keyof typeof vi`, `dateOrDash(d: string | null): string` từ `@/components/admin/admin-format`.
  - Route: `/admin` → redirect `/admin/orders`; `/admin/orders|accounts|history`; người không phải admin → 404.
  - Test id: `pending-order-card`, `admin-user-card` (giữ), `admin-history-card`, `admin-pending-count` (mới).
  - Key i18n mới: `admin_accounts_plans`, `admin_order_history`, `admin_tab_orders`, `admin_tab_accounts`, `admin_tab_history`, `admin_badge`, `admin_col_status`, `admin_col_granted`, `admin_col_decided`, `admin_no_history`. Xóa `admin_accounts`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Thêm key i18n**

`src/language/vi.json`: xóa dòng `"admin_accounts": "Tài khoản",`. Đổi dòng cuối `"admin_cannot_approve": "Không duyệt được: tài khoản đang có gói Pro còn hạn"` thành (thêm dấu phẩy + 10 key, giữ `}` đóng file):
```json
  "admin_cannot_approve": "Không duyệt được: tài khoản đang có gói Pro còn hạn",
  "admin_accounts_plans": "Tài khoản & gói",
  "admin_order_history": "Lịch sử đơn",
  "admin_tab_orders": "Đơn chờ",
  "admin_tab_accounts": "Tài khoản",
  "admin_tab_history": "Lịch sử",
  "admin_badge": "Quản trị",
  "admin_col_status": "Trạng thái",
  "admin_col_granted": "Hạn cấp",
  "admin_col_decided": "Người duyệt",
  "admin_no_history": "Chưa có đơn nào"
```

`src/language/en.json`: xóa dòng `"admin_accounts": "Accounts",`. Đổi dòng cuối `"admin_cannot_approve": "Cannot approve: the account has an active Pro plan"` thành:
```json
  "admin_cannot_approve": "Cannot approve: the account has an active Pro plan",
  "admin_accounts_plans": "Accounts & plans",
  "admin_order_history": "Order history",
  "admin_tab_orders": "Pending",
  "admin_tab_accounts": "Accounts",
  "admin_tab_history": "History",
  "admin_badge": "Admin",
  "admin_col_status": "Status",
  "admin_col_granted": "Granted until",
  "admin_col_decided": "Decided by",
  "admin_no_history": "No orders yet"
```
Kiểm: `grep -rn "admin_accounts\"" src` chỉ còn trong `AdminPanel.tsx` (sẽ xóa ở Step 8).

- [ ] **Step 3: Viết unit test sidebar/tab bar admin (RED)**

Tạo `tests/unit/components/AdminNav.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { AdminTabBar } from "@/components/admin/AdminTabBar"

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))
const overview = vi.hoisted(() => ({ data: undefined as undefined | { pendingOrders: { id: number }[]; users: never[] } }))
vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { overview: { useQuery: () => ({ data: overview.data }) } } },
}))

beforeEach(() => {
  overview.data = undefined
})

function renderVi(ui: React.ReactNode) {
  return render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)
}

describe("AdminSidebar", () => {
  it("logo Lịch dạy + nhãn Quản trị; đúng 3 mục admin, mục đang mở aria-current; số đơn chờ; không có mục giáo viên", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/history")
    overview.data = { pendingOrders: [{ id: 1 }, { id: 2 }], users: [] }
    renderVi(<AdminSidebar />)
    expect(screen.getByText("Lịch dạy")).toBeTruthy()
    expect(screen.getByText("Quản trị")).toBeTruthy()
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/admin/orders",
      "/admin/accounts",
      "/admin/history",
    ])
    expect(screen.getByRole("link", { name: "Lịch sử đơn" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: /Tài khoản & gói/ }).getAttribute("aria-current")).toBeNull()
    expect(screen.getByTestId("admin-pending-count").textContent).toBe("2")
    expect(screen.queryByText("Tổng quan")).toBeNull()
    expect(screen.queryByText("Học phí")).toBeNull()
  })

  it("0 đơn chờ hoặc chưa tải → không hiện số", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/orders")
    renderVi(<AdminSidebar />)
    expect(screen.queryByTestId("admin-pending-count")).toBeNull()
  })
})

describe("AdminTabBar", () => {
  it("3 tab nhãn ngắn, tab đang mở aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/accounts")
    renderVi(<AdminTabBar />)
    const links = screen.getAllByRole("link")
    expect(links.map((l) => [l.getAttribute("href"), l.textContent])).toEqual([
      ["/admin/orders", "Đơn chờ"],
      ["/admin/accounts", "Tài khoản"],
      ["/admin/history", "Lịch sử"],
    ])
    expect(screen.getByRole("link", { name: "Tài khoản" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" }).className).toContain("md:hidden")
  })
})
```

- [ ] **Step 4: Viết unit test `AppHeader` theo variant (RED)**

Tạo `tests/unit/components/AppHeader.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppHeader } from "@/components/layout/AppHeader"

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { username: "admin_test", fullName: "Quản trị Test" } } }),
  signOut: vi.fn(),
}))
vi.mock("@/hooks/useBackupDownload", () => ({ useBackupDownload: () => ({ download: vi.fn(), isDownloading: false }) }))
vi.mock("@/components/plan/RenewOffer", () => ({ RenewOffer: () => <div data-testid="renew-offer-slot" /> }))
vi.mock("@/components/layout/ChangePasswordDialog", () => ({
  ChangePasswordDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))

function renderHeader(variant?: "teacher" | "admin") {
  render(
    <LanguageProvider forcedLanguage="vi">
      <AppHeader variant={variant} />
    </LanguageProvider>
  )
  // Radix DropdownMenu mở bằng phím Enter trên trigger (jsdom không có PointerEvent đầy đủ).
  fireEvent.keyDown(screen.getByRole("button", { name: "Mở menu tài khoản" }), { key: "Enter" })
}

describe("AppHeader", () => {
  it("mặc định (giáo viên): có RenewOffer; menu Sao lưu dữ liệu, Đổi mật khẩu, Đăng xuất; không có Quản trị", async () => {
    renderHeader()
    expect(screen.getByTestId("renew-offer-slot")).toBeTruthy()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Sao lưu dữ liệu", "Đổi mật khẩu", "Đăng xuất"])
  })

  it("admin: không RenewOffer; menu Quản trị (link /admin/orders), Đổi mật khẩu, Đăng xuất; không Sao lưu", async () => {
    renderHeader("admin")
    expect(screen.queryByTestId("renew-offer-slot")).toBeNull()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Quản trị", "Đổi mật khẩu", "Đăng xuất"])
    expect(screen.getByRole("menuitem", { name: "Quản trị" }).getAttribute("href")).toBe("/admin/orders")
  })
})
```
Nếu khi chạy (Step 6) jsdom báo `ResizeObserver is not defined`, thêm ngay dưới các `vi.mock`:
```tsx
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
```

- [ ] **Step 5: Chạy 2 test, xác nhận fail**

Run: `pnpm test tests/unit/components/AdminNav.test.tsx`
Expected: FAIL — không resolve được `@/components/admin/AdminSidebar`.
Run: `pnpm test tests/unit/components/AppHeader.test.tsx`
Expected: test mặc định PASS; test admin FAIL (vẫn thấy `renew-offer-slot` và "Sao lưu dữ liệu").

- [ ] **Step 6: `AppHeader` prop `variant`**

Sửa `src/components/layout/AppHeader.tsx`:
- Import: thêm `import Link from "next/link"` dưới dòng `"use client"`; đổi dòng icon thành `import { DatabaseBackup, KeyRound, LogOut, Languages, ShieldCheck } from "lucide-react"`.
- Chữ ký: `export function AppHeader({ variant = "teacher" }: { variant?: "teacher" | "admin" }) {` và ngay dưới thêm `const admin = variant === "admin"`.
- Thay `<RenewOffer />` bằng:
```tsx
        {/* Admin không dùng gói: không gọi plan.me, không nhắc gia hạn. */}
        {!admin && <RenewOffer />}
```
- Thay khối `<DropdownMenuItem onSelect={backup.download} …>…</DropdownMenuItem>` (Sao lưu) bằng:
```tsx
            {admin ? (
              <DropdownMenuItem asChild>
                <Link href="/admin/orders">
                  <ShieldCheck className="size-4 mr-2" />
                  {t("admin_page")}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={backup.download} disabled={backup.isDownloading}>
                <DatabaseBackup className="size-4 mr-2" />
                {t("backup_data")}
              </DropdownMenuItem>
            )}
```
`useBackupDownload()` vẫn gọi ở cả 2 variant (hook chỉ `fetch` khi bấm, không gửi request lúc mount).

Run: `pnpm test tests/unit/components/AppHeader.test.tsx`
Expected: PASS 2 test.

- [ ] **Step 7: Tạo `admin-format.ts`, `admin-nav.ts`, `AdminSidebar`, `AdminTabBar`, `AdminLayout`**

`src/components/admin/admin-format.ts`:
```ts
import type vi from "@/language/vi.json"
import { isPeriod } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"

export const SOURCE_KEY = { trial: "plan_source_trial", paid: "plan_source_paid", free: "plan_source_free" } as const

// Đơn admin đặt tay (setPlan) không có kỳ: period = null.
export function periodKey(p: string | null): keyof typeof vi {
  if (!isPeriod(p)) return "plan_order_by_admin"
  return p === "2year" ? "plan_period_2year" : p
}

export function dateOrDash(d: string | null): string {
  return d ? formatVnDate(new Date(d)) : "-"
}
```

`src/components/admin/admin-nav.ts`:
```ts
import { History, Inbox, Users, type LucideIcon } from "lucide-react"
import type vi from "@/language/vi.json"

export type AdminNavItem = { href: string; labelKey: keyof typeof vi; shortKey: keyof typeof vi; icon: LucideIcon }

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/orders", labelKey: "admin_pending_orders", shortKey: "admin_tab_orders", icon: Inbox },
  { href: "/admin/accounts", labelKey: "admin_accounts_plans", shortKey: "admin_tab_accounts", icon: Users },
  { href: "/admin/history", labelKey: "admin_order_history", shortKey: "admin_tab_history", icon: History },
]
```

`src/components/admin/AdminSidebar.tsx`:
```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { isNavActive } from "@/components/layout/nav-items"
import { ADMIN_NAV_ITEMS } from "./admin-nav"

export function AdminSidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  // Cùng query key với màn Đơn chờ nên dùng chung cache React Query, không thêm request.
  const pendingCount = trpc.admin.overview.useQuery().data?.pendingOrders.length ?? 0

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-7 border-r bg-white px-3.5 py-5">
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex size-8 items-center justify-center rounded-[9px] bg-primary">
          <GraduationCap className="size-[18px] text-white" />
        </span>
        <span className="text-base font-semibold text-foreground">{t("calendar")}</span>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-1.5 text-[10px] font-semibold leading-4 text-slate-600">
          {t("admin_badge")}
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                active
                  ? "bg-primary/[0.08] font-semibold text-primary"
                  : "font-medium text-[#4B5563] hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {item.href === "/admin/orders" && pendingCount > 0 && (
                <span
                  data-testid="admin-pending-count"
                  className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold leading-5 text-amber-800"
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-1 font-mono text-[11px] leading-tight text-muted-foreground">
        <div>
          v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_BUILD_SHA}
        </div>
        <div>{process.env.NEXT_PUBLIC_BUILD_TIME}</div>
      </div>
    </aside>
  )
}
```

`src/components/admin/AdminTabBar.tsx`:
```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { isNavActive } from "@/components/layout/nav-items"
import { ADMIN_NAV_ITEMS } from "./admin-nav"

// Chép kiểu tab của BottomTabBar thay vì trích chung, để không đụng tab bar giáo viên.
function tabClass(active: boolean) {
  return cn(
    "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]",
    active ? "font-semibold text-primary" : "font-medium text-muted-foreground"
  )
}

function ActiveBar() {
  return <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-5 -translate-x-1/2 rounded-full bg-primary" />
}

export function AdminTabBar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t("main_navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-3">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {active && <ActiveBar />}
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">{t(item.shortKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

`src/components/admin/AdminLayout.tsx`:
```tsx
"use client"

import { AppHeader } from "@/components/layout/AppHeader"
import { AdminSidebar } from "./AdminSidebar"
import { AdminTabBar } from "./AdminTabBar"

// Không có PlanBanner/UpgradeDialog/RenewOffer: admin không có gói, không gọi plan.me (spec J mục 2).
export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-page">
      <div className="hidden h-full bg-white md:flex">
        <AdminSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader variant="admin" />
        {/* Mobile chừa chỗ tab bar (56px) + safe-area */}
        <main className="relative flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-10">
          {children}
        </main>
      </div>

      <AdminTabBar />
    </div>
  )
}
```

Run: `pnpm test tests/unit/components/AdminNav.test.tsx`
Expected: PASS 3 test.

- [ ] **Step 8: Tách `AdminPanel` thành 3 màn, xóa `AdminPanel`**

`src/components/admin/AdminPendingOrders.tsx` (logic duyệt/từ chối chuyển nguyên từ `AdminPanel`):
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { formatValidUntil, planLabel } from "@/lib/plans"
import { formatCurrency } from "@/lib/utils"
import { dateOrDash, periodKey } from "./admin-format"

type PendingRow = RouterOutputs["admin"]["overview"]["pendingOrders"][number]

export function AdminPendingOrders() {
  const { t } = useTranslation()
  const query = trpc.admin.overview.useQuery()
  const [confirm, setConfirm] = useState<PendingRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingRow | null>(null)

  const approve = trpc.admin.approveOrder.useMutation({
    onSuccess: () => {
      toast.success(t("admin_approved"))
      setConfirm(null)
    },
    onError: (e) => toast.error(e.message),
  })
  const reject = trpc.admin.rejectOrder.useMutation({
    onSuccess: () => {
      toast.success(t("admin_rejected"))
      setRejectTarget(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const orderActions = (o: PendingRow) => (
    <div className="flex gap-2">
      <Button
        type="button"
        className="h-11 md:h-9"
        onClick={() => (o.preview ? setConfirm(o) : toast.error(t("admin_cannot_approve")))}
      >
        {t("admin_approve")}
      </Button>
      <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setRejectTarget(o)}>
        {t("admin_reject")}
      </Button>
    </div>
  )

  const columns: Column<PendingRow>[] = [
    { header: t("username"), cell: (o) => <span className="font-medium">{o.username}</span> },
    { header: t("admin_col_plan"), cell: (o) => planLabel(o.plan) },
    { header: t("admin_col_period"), cell: (o) => t(periodKey(o.period)) },
    { header: t("payment_amount"), cell: (o) => formatCurrency(o.amount), className: "whitespace-nowrap text-right" },
    { header: t("admin_col_code"), cell: (o) => <span className="font-mono">{o.code}</span> },
    { header: t("admin_col_created"), cell: (o) => dateOrDash(o.createdAt) },
    { header: <span className="sr-only">{t("actions")}</span>, cell: orderActions },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_pending_orders")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.pendingOrders ?? []}
        getKey={(o) => o.id}
        columns={columns}
        emptyText={t("admin_no_pending")}
        renderCard={(o) => (
          <div data-testid="pending-order-card" className="space-y-2 rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{o.username}</p>
                <p className="text-sm text-slate-500">
                  {planLabel(o.plan)} · {t(periodKey(o.period))} · {formatCurrency(o.amount)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm">{o.code}</span>
            </div>
            <p className="text-xs text-slate-500">{dateOrDash(o.createdAt)}</p>
            {orderActions(o)}
          </div>
        )}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_approve")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.preview &&
                `${t("admin_approve_confirm")
                  .replace("{code}", confirm.code ?? "")
                  .replace("{plan}", planLabel(confirm.plan))
                  .replace("{date}", formatValidUntil(new Date(confirm.preview.grantedUntil)))}${
                  confirm.preview.creditDays > 0
                    ? ` ${t("admin_credit_days").replace("{days}", String(confirm.preview.creditDays))}`
                    : ""
                }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approve.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={approve.isPending}
              onClick={(e) => {
                // Giữ hộp mở tới khi mutation xong (onSuccess tự đóng).
                e.preventDefault()
                if (confirm) approve.mutate({ id: confirm.id })
              }}
            >
              {t("admin_approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_reject")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin_reject_confirm").replace("{code}", rejectTarget?.code ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reject.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={reject.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (rejectTarget) reject.mutate({ id: rejectTarget.id })
              }}
            >
              {t("admin_reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

`src/components/admin/AdminAccounts.tsx`:
```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { PLAN_LABEL, formatValidUntil } from "@/lib/plans"
import { SetPlanDialog } from "./SetPlanDialog"
import { SOURCE_KEY, dateOrDash } from "./admin-format"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

export function AdminAccounts() {
  const { t } = useTranslation()
  const query = trpc.admin.overview.useQuery()
  const [setPlanFor, setSetPlanFor] = useState<UserRow | null>(null)

  const planCell = (u: UserRow) => `${PLAN_LABEL[u.plan]} · ${t(SOURCE_KEY[u.source])}`
  const expiry = (u: UserRow) => (u.expiresAt ? formatValidUntil(new Date(u.expiresAt)) : "-")
  const setPlanButton = (u: UserRow) => (
    <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setSetPlanFor(u)}>
      {t("admin_set_plan")}
    </Button>
  )

  const columns: Column<UserRow>[] = [
    { header: t("username"), cell: (u) => <span className="font-medium">{u.username}</span> },
    { header: t("full_name"), cell: (u) => u.fullName ?? "-" },
    { header: t("admin_col_created"), cell: (u) => dateOrDash(u.createdAt) },
    { header: t("admin_col_last_login"), cell: (u) => dateOrDash(u.lastLoginAt) },
    { header: t("admin_col_students"), cell: (u) => u.activeStudents, className: "text-right" },
    { header: t("admin_col_plan"), cell: planCell },
    { header: t("admin_col_expiry"), cell: expiry },
    { header: <span className="sr-only">{t("actions")}</span>, cell: setPlanButton },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_accounts_plans")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data?.users ?? []}
        getKey={(u) => u.id}
        columns={columns}
        emptyText="-"
        renderCard={(u) => (
          <div data-testid="admin-user-card" className="space-y-2 rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{u.username}</p>
                <p className="truncate text-sm text-slate-500">{u.fullName ?? "-"}</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-primary">{planCell(u)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {t("admin_col_expiry")}: {expiry(u)} · {t("admin_col_students")}: {u.activeStudents} · {t("admin_col_last_login")}: {dateOrDash(u.lastLoginAt)}
            </p>
            {setPlanButton(u)}
          </div>
        )}
      />

      {setPlanFor && <SetPlanDialog key={setPlanFor.id} user={setPlanFor} onClose={() => setSetPlanFor(null)} />}
    </div>
  )
}
```

`src/components/admin/AdminOrderHistory.tsx`:
```tsx
"use client"

import { PageHeader } from "@/components/common/PageHeader"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { formatValidUntil, planLabel } from "@/lib/plans"
import { formatCurrency } from "@/lib/utils"
import { dateOrDash, periodKey } from "./admin-format"

type Row = RouterOutputs["admin"]["orderHistory"][number]

const STATUS_KEY = {
  approved: "plan_status_approved",
  rejected: "plan_status_rejected",
  cancelled: "plan_status_cancelled",
} as const

export function AdminOrderHistory() {
  const { t } = useTranslation()
  const query = trpc.admin.orderHistory.useQuery()

  const status = (s: string) => (s in STATUS_KEY ? t(STATUS_KEY[s as keyof typeof STATUS_KEY]) : s)
  const granted = (o: Row) => (o.grantedUntil ? formatValidUntil(new Date(o.grantedUntil)) : "-")
  const decided = (o: Row) => `${o.decidedBy ?? "-"} · ${dateOrDash(o.decidedAt)}`

  const columns: Column<Row>[] = [
    { header: t("admin_col_created"), cell: (o) => dateOrDash(o.createdAt) },
    { header: t("username"), cell: (o) => <span className="font-medium">{o.username}</span> },
    { header: t("admin_col_plan"), cell: (o) => planLabel(o.plan) },
    { header: t("admin_col_period"), cell: (o) => t(periodKey(o.period)) },
    { header: t("payment_amount"), cell: (o) => formatCurrency(o.amount), className: "whitespace-nowrap text-right" },
    { header: t("admin_col_code"), cell: (o) => <span className="font-mono">{o.code ?? "-"}</span> },
    { header: t("admin_col_status"), cell: (o) => status(o.status) },
    { header: t("admin_col_granted"), cell: granted },
    { header: t("admin_col_decided"), cell: decided },
    { header: t("admin_note"), cell: (o) => o.note ?? "-" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_order_history")} />

      <ResponsiveList
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={query.data ?? []}
        getKey={(o) => o.id}
        columns={columns}
        emptyText={t("admin_no_history")}
        renderCard={(o) => (
          <div data-testid="admin-history-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{o.username}</p>
                <p className="text-slate-500">
                  {planLabel(o.plan)} · {t(periodKey(o.period))} · {formatCurrency(o.amount)}
                </p>
              </div>
              <span className="shrink-0 font-mono">{o.code ?? "-"}</span>
            </div>
            <p className="font-medium text-foreground">{status(o.status)}</p>
            <p className="text-xs text-slate-500">
              {t("admin_col_created")}: {dateOrDash(o.createdAt)} · {t("admin_col_granted")}: {granted(o)}
            </p>
            <p className="text-xs text-slate-500">
              {t("admin_col_decided")}: {decided(o)}
            </p>
            {o.note && (
              <p className="break-words text-xs text-slate-500">
                {t("admin_note")}: {o.note}
              </p>
            )}
          </div>
        )}
      />
    </div>
  )
}
```

Xóa file cũ:
```bash
git rm src/components/admin/AdminPanel.tsx "src/app/(app)/admin/page.tsx"
grep -rn "AdminPanel\|admin_accounts\"" src tests
```
Expected: `grep` không in gì.

- [ ] **Step 9: Route nhóm `(admin)`**

`src/app/(admin)/admin/layout.tsx`:
```tsx
import { notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { isAdminUsername } from "@/lib/admin"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { AdminLayout } from "@/components/admin/AdminLayout"

export default async function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  // 404 như trang không tồn tại để không lộ có khu quản trị; router admin.* tự chặn thêm bằng adminProcedure.
  if (!isAdminUsername(session?.user?.username)) notFound()
  return (
    <SessionProvider session={session}>
      <AdminLayout>{children}</AdminLayout>
    </SessionProvider>
  )
}
```

`src/app/(admin)/admin/page.tsx`:
```tsx
import { redirect } from "next/navigation"

export default function AdminIndexPage() {
  redirect("/admin/orders")
}
```

`src/app/(admin)/admin/orders/page.tsx`:
```tsx
import { AdminPendingOrders } from "@/components/admin/AdminPendingOrders"

export default function AdminOrdersPage() {
  return <AdminPendingOrders />
}
```

`src/app/(admin)/admin/accounts/page.tsx`:
```tsx
import { AdminAccounts } from "@/components/admin/AdminAccounts"

export default function AdminAccountsPage() {
  return <AdminAccounts />
}
```

`src/app/(admin)/admin/history/page.tsx`:
```tsx
import { AdminOrderHistory } from "@/components/admin/AdminOrderHistory"

export default function AdminHistoryPage() {
  return <AdminOrderHistory />
}
```

Run:
```bash
pnpm test tests/unit/next15-contract.test.ts
pnpm test tests/unit/theme-legacy-colors.test.ts
```
Expected: PASS cả 2 (không page/layout mới nào có định danh `params`/`searchParams`; không màu cấm).

- [ ] **Step 10: Viết lại `tests/e2e/admin.spec.ts` theo URL mới**

Thay TOÀN BỘ nội dung file (luồng tạo đơn vẫn qua `plan-checkout` cũ; Task 5 đổi sang popup; Task 3 đổi đích đăng nhập admin):
```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const CODE_RE = /SM ([ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6})/;

async function loginAs(browser: Browser, username: string, viewport = MOBILE): Promise<Page> {
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
  await expect(page).toHaveURL(/.*dashboard/);
  return page;
}

async function createPendingForStd(prefix: string) {
  const std = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
  const code = prefix + Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  const order = await db.planOrder.create({ data: { userId: std.id, plan: 'plus', period: 'month', amount: 49000, code, status: 'pending' } });
  return { code, order };
}

async function resetStd() {
  await db.planOrder.deleteMany({ where: { user: { username: 'teacher_std' } } });
  await db.user.update({ where: { username: 'teacher_std' }, data: { plan: 'standard', planExpiresAt: null, trialEndsAt: null } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await resetStd();
});

test.afterAll(async () => {
  await resetStd();
  await db.$disconnect();
});

test('teacher_std tạo đơn Plus tháng → admin_test xác nhận ở /admin/orders → Tài khoản & gói, Lịch sử đơn cập nhật', async ({ browser }) => {
  const std = await loginAs(browser, 'teacher_std');
  await std.goto('/plan');
  const checkout = std.getByTestId('plan-checkout');
  await checkout.getByRole('button', { name: 'Plus', exact: true }).click();
  await checkout.getByRole('button', { name: 'Tháng', exact: true }).click();
  await checkout.getByRole('button', { name: 'Tạo mã chuyển khoản' }).click();
  const pending = std.getByTestId('pending-order');
  await expect(pending).toBeVisible();
  const code = ((await pending.textContent()) ?? '').match(CODE_RE)![1];
  await std.context().close();

  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/admin/orders');
  await expect(admin.getByRole('heading', { level: 1, name: 'Chờ xác nhận' })).toBeVisible();
  const card = admin.getByTestId('pending-order-card').filter({ hasText: code });
  await expect(card).toBeVisible();
  await expect(card).toContainText('teacher_std');
  await expect(card).toContainText('49.000');
  await card.getByRole('button', { name: 'Xác nhận' }).click();
  const confirm = admin.getByRole('alertdialog');
  await expect(confirm).toContainText(code);
  await expect(confirm).toContainText('Gói Plus dùng đến hết ngày');
  await confirm.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(admin.getByText('Đã xác nhận đơn')).toBeVisible();
  await expect(card).toHaveCount(0);

  await admin.goto('/admin/accounts');
  await expect(admin.getByRole('heading', { level: 1, name: 'Tài khoản & gói' })).toBeVisible();
  await expect(admin.getByTestId('admin-user-card').filter({ hasText: 'teacher_std' })).toContainText('Plus');

  await admin.goto('/admin/history');
  const hist = admin.getByTestId('admin-history-card').filter({ hasText: code });
  await expect(hist).toContainText('Đã xác nhận');
  await expect(hist).toContainText('admin_test');
  await expect(hist).toContainText('Hạn cấp');
  await admin.context().close();

  const std2 = await loginAs(browser, 'teacher_std');
  await std2.goto('/plan');
  const current = std2.getByTestId('current-plan');
  await expect(current).toContainText('Plus');
  await expect(current).toContainText('Đã mua');
  await expect(current).toContainText('Dùng đến hết ngày');
  await std2.context().close();
});

test('/admin → /admin/orders; teacher vào /admin, /admin/orders, /admin/accounts, /admin/history → 404', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/admin');
  await expect(admin).toHaveURL(/\/admin\/orders$/);
  await admin.context().close();

  const teacher = await loginAs(browser, 'teacher');
  for (const path of ['/admin', '/admin/orders', '/admin/accounts', '/admin/history']) {
    const res = await teacher.goto(path);
    expect(res!.status(), path).toBe(404);
  }
  await teacher.context().close();
});

test('admin_test thấy link Trang quản trị ở /plan', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/plan');
  await expect(admin.getByTestId('admin-link')).toBeVisible();
  await admin.context().close();
});

test('admin bấm Từ chối → hộp xác nhận; Hủy thì đơn vẫn chờ, xác nhận thì bị từ chối và vào Lịch sử đơn', async ({ browser }) => {
  const { code, order } = await createPendingForStd('RJ');

  const admin = await loginAs(browser, 'admin_test');
  await admin.goto('/admin/orders');
  const card = admin.getByTestId('pending-order-card').filter({ hasText: code });
  await card.getByRole('button', { name: 'Từ chối' }).click();
  const confirm = admin.getByRole('alertdialog');
  await expect(confirm).toContainText(code);
  await confirm.getByRole('button', { name: 'Hủy' }).click();
  await expect(confirm).toBeHidden();
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('pending');

  await card.getByRole('button', { name: 'Từ chối' }).click();
  await confirm.getByRole('button', { name: 'Từ chối' }).click();
  await expect(admin.getByText('Đã từ chối đơn')).toBeVisible();
  await expect(card).toHaveCount(0);
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('rejected');

  await admin.goto('/admin/history');
  await expect(admin.getByTestId('admin-history-card').filter({ hasText: code })).toContainText('Bị từ chối');
  await admin.context().close();
});

test('desktop: sidebar khu quản trị 3 mục, nhãn Quản trị, số đơn chờ; không có mục giáo viên', async ({ browser }) => {
  await createPendingForStd('SB');
  const admin = await loginAs(browser, 'admin_test', DESKTOP);
  await admin.goto('/admin/orders');
  const aside = admin.locator('aside');
  await expect(aside.getByText('Quản trị', { exact: true })).toBeVisible();
  expect(await aside.getByRole('link').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
    '/admin/orders',
    '/admin/accounts',
    '/admin/history',
  ]);
  await expect(aside).not.toContainText('Tổng quan');
  await expect(aside).not.toContainText('Học phí');
  const pendingCount = await db.planOrder.count({ where: { status: 'pending' } });
  await expect(aside.getByTestId('admin-pending-count')).toHaveText(String(pendingCount));
  await aside.getByRole('link', { name: 'Lịch sử đơn' }).click();
  await expect(admin).toHaveURL(/\/admin\/history$/);
  await expect(aside.getByRole('link', { name: 'Lịch sử đơn' })).toHaveAttribute('aria-current', 'page');
  await admin.context().close();
});
```

- [ ] **Step 11: Chạy e2e admin**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin.spec.ts
```
Expected: lệnh 1 PASS (nạp lại seed); lệnh 2 `5 passed`. Test 404 trả 200 thay vì 404 → kiểm `(admin)/admin/layout.tsx` có `notFound()` và `src/app/(app)/admin/page.tsx` đã bị xóa.

- [ ] **Step 12: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: không lỗi.

- [ ] **Step 13: Commit**

```bash
git add src/components/admin "src/app/(admin)" src/components/layout/AppHeader.tsx src/language/vi.json src/language/en.json tests/unit/components/AdminNav.test.tsx tests/unit/components/AppHeader.test.tsx tests/e2e/admin.spec.ts
git commit -m "feat(j): khu quản trị riêng - layout, sidebar, tab bar, 3 màn, header variant admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
(2 file xóa đã được `git rm` stage ở Step 8, không `git add` lại.) Expected: `git status --short` sau commit không còn file của task.

---

### Task 3: Chặn route — middleware `authorized`, lưới an toàn `(app)/layout` + `/login`, e2e chặn route

**Đọc trước:** Global Constraints; spec mục 2, 4 (Q3, Q5, Q6), 7 (đoạn `auth.config.ts`, `(app)/layout.tsx`, `login/page.tsx`), 11 (Rủi ro: vòng redirect, `/administration`); `src/server/auth.config.ts`; `src/middleware.ts` (matcher, KHÔNG sửa); `src/app/(app)/layout.tsx`; `src/app/login/page.tsx`, `src/app/login/LoginForm.tsx` (`callbackUrl` mặc định `/dashboard`, KHÔNG sửa); `tests/unit/auth-authorized.test.ts`; `tests/e2e/admin.spec.ts` (bản Task 2).

**Files:**
- Modify: `src/server/auth.config.ts` (`callbacks.authorized`)
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/login/page.tsx`
- Test (Sửa, viết lại cả file): `tests/unit/auth-authorized.test.ts`
- Test (Mới): `tests/unit/layout/admin-redirect.test.ts`
- Test (Sửa): `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `isAdminUsername` từ `@/lib/admin` (Task 1); route `/admin/orders` (Task 2).
- Produces: `authConfig.callbacks.authorized({ auth, request })` trả `false` (chưa đăng nhập), `Response` 302 `Location: <origin>/admin/orders` (admin + path không phải `/admin` và không bắt đầu `/admin/`), còn lại `true`. `(app)/layout` và `/login` gọi `redirect("/admin/orders")` cho admin.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Viết lại unit test `authorized` (RED)**

Thay toàn bộ `tests/unit/auth-authorized.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { authConfig } from "@/server/auth.config"

const authorized = authConfig.callbacks.authorized
const original = process.env.ADMIN_USERNAMES
const ADMIN = { user: { id: "9", username: "admin_test" }, expires: "" }
const TEACHER = { user: { id: "1", username: "teacher" }, expires: "" }

function call(auth: unknown, path = "/dashboard") {
  return authorized({ auth, request: { nextUrl: new URL(path, "http://localhost:3000") } } as unknown as Parameters<typeof authorized>[0])
}

beforeEach(() => {
  process.env.ADMIN_USERNAMES = "admin_test"
})
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_USERNAMES
  else process.env.ADMIN_USERNAMES = original
})

// GHSA-8fpg-xm3f-6cx3: khi cấu hình lỗi, `auth` là object chứa error nhưng
// không có `user` — check kiểu `!!auth` sẽ cho qua.
describe("authConfig.callbacks.authorized", () => {
  it("cho qua khi có user", () => {
    expect(call(TEACHER)).toBe(true)
  })

  it("chặn khi chưa đăng nhập", () => {
    expect(call(null)).toBe(false)
  })

  it("chặn khi auth là object lỗi, không có user", () => {
    expect(call({ error: "Configuration" })).toBe(false)
  })

  it("admin vào route ngoài khu quản trị (kể cả /administration, /api/backup) → 302 về /admin/orders", () => {
    for (const path of ["/", "/dashboard", "/students/5", "/plan", "/api/backup", "/administration", "/adminx"]) {
      const res = call(ADMIN, path)
      expect(res, path).toBeInstanceOf(Response)
      expect((res as Response).status, path).toBe(302)
      expect((res as Response).headers.get("location"), path).toBe("http://localhost:3000/admin/orders")
    }
  })

  it("admin trong khu quản trị → cho qua, không vòng redirect", () => {
    for (const path of ["/admin", "/admin/orders", "/admin/accounts", "/admin/history"]) {
      expect(call(ADMIN, path), path).toBe(true)
    }
  })

  it("giáo viên vào /admin/* → cho qua để layout trả 404; env thiếu thì admin_test là người thường", () => {
    for (const path of ["/admin", "/admin/orders", "/dashboard"]) {
      expect(call(TEACHER, path), path).toBe(true)
    }
    delete process.env.ADMIN_USERNAMES
    expect(call(ADMIN, "/dashboard")).toBe(true)
  })
})
```

- [ ] **Step 3: Viết unit test lưới an toàn server (RED)**

Tạo `tests/unit/layout/admin-redirect.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; username: string; fullName: string | null }; expires: string },
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock("@/server/auth", () => ({ auth: async () => mocks.session }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/providers/SessionProvider", () => ({ SessionProvider: ({ children }: { children: unknown }) => children }))
vi.mock("@/app/login/LoginForm", () => ({ LoginForm: () => null }))
vi.mock("@/app/login/LoginHeader", () => ({ LoginHeader: () => null }))

import AppGroupLayout from "@/app/(app)/layout"
import LoginPage from "@/app/login/page"

const original = process.env.ADMIN_USERNAMES
const as = (username: string) => ({ user: { id: "1", username, fullName: null }, expires: "" })

beforeEach(() => {
  process.env.ADMIN_USERNAMES = "admin_test"
  mocks.redirect.mockClear()
})
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_USERNAMES
  else process.env.ADMIN_USERNAMES = original
})

// Lớp 2 (spec J Q3): middleware bị bỏ qua hoặc Edge thiếu env thì server vẫn chuyển admin.
describe("(app)/layout", () => {
  it("admin → redirect /admin/orders", async () => {
    mocks.session = as("admin_test")
    await expect(AppGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /admin/orders")
  })

  it("giáo viên → render bình thường, không redirect", async () => {
    mocks.session = as("teacher")
    await expect(AppGroupLayout({ children: "x" })).resolves.toBeTruthy()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})

describe("/login khi đã đăng nhập", () => {
  it("admin → /admin/orders, giáo viên → /dashboard", async () => {
    mocks.session = as("admin_test")
    await expect(LoginPage()).rejects.toThrow("REDIRECT /admin/orders")
    mocks.session = as("teacher")
    await expect(LoginPage()).rejects.toThrow("REDIRECT /dashboard")
  })
})
```

- [ ] **Step 4: Chạy 2 test, xác nhận fail**

Run: `pnpm test tests/unit/auth-authorized.test.ts`
Expected: FAIL 2 test (admin ngoài khu quản trị nhận `true` thay vì `Response`); các test khác PASS.
Run: `pnpm test tests/unit/layout/admin-redirect.test.ts`
Expected: FAIL — layout admin resolve thay vì throw; login admin throw `REDIRECT /dashboard`.

- [ ] **Step 5: Cài `authorized`**

Trong `src/server/auth.config.ts`: thêm dưới dòng `import type { NextAuthConfig, DefaultSession } from "next-auth"`:
```ts
import { isAdminUsername } from "@/lib/admin"
```
Thay callback `authorized`:
```ts
    authorized({ auth, request }) {
      // Phải kiểm tới `user`: khi cấu hình lỗi, `auth` là object chứa error nên
      // vẫn truthy (GHSA-8fpg-xm3f-6cx3) → `!!auth` sẽ cho qua.
      if (!auth?.user) return false
      // J1: admin chỉ dùng khu quản trị. So chặt để "/administration" không bị coi là khu quản trị.
      const { pathname } = request.nextUrl
      const inAdminArea = pathname === "/admin" || pathname.startsWith("/admin/")
      if (isAdminUsername(auth.user.username) && !inAdminArea) {
        return Response.redirect(new URL("/admin/orders", request.nextUrl.origin))
      }
      return true
    },
```
(`@/lib/admin` thuần, không kéo Prisma/bcrypt → vẫn Edge-safe như ghi chú đầu file.)

- [ ] **Step 6: Lưới an toàn `(app)/layout` và `/login`**

`src/app/(app)/layout.tsx` — thêm import và 2 dòng sau `const session = await auth()`:
```tsx
import { redirect } from "next/navigation"
import { isAdminUsername } from "@/lib/admin"
```
```tsx
  // Lưới thứ 2 nếu middleware bị bỏ qua: admin không dùng màn giáo viên (spec J Q3).
  if (isAdminUsername(session?.user?.username)) redirect("/admin/orders")
```

`src/app/login/page.tsx` — thêm `import { isAdminUsername } from "@/lib/admin"`; thay `redirect("/dashboard")` bằng:
```tsx
    redirect(isAdminUsername(session.user.username) ? "/admin/orders" : "/dashboard")
```

- [ ] **Step 7: Chạy unit, xác nhận pass**

Run:
```bash
pnpm test tests/unit/auth-authorized.test.ts
pnpm test tests/unit/layout/admin-redirect.test.ts
pnpm test tests/unit/middleware-matcher.test.ts
```
Expected: PASS cả 3 (matcher không đổi).

- [ ] **Step 8: Sửa `tests/e2e/admin.spec.ts`**

1. Trong `loginAs`, thay dòng `await expect(page).toHaveURL(/.*dashboard/);` bằng:
```ts
  // Admin bị middleware chuyển thẳng về khu quản trị (spec J Q3).
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/orders$/ : /.*dashboard/);
```
2. Xóa nguyên test `'admin_test thấy link Trang quản trị ở /plan'` (admin không còn vào được `/plan`).
3. Thêm test mới ở cuối file:
```ts
test('admin_test: route giáo viên → /admin/orders; tab bar và menu avatar chỉ của khu quản trị; không gọi plan.me; không tràn ngang', async ({ browser }) => {
  const admin = await loginAs(browser, 'admin_test');
  const planMe: string[] = [];
  admin.on('request', (r) => {
    if (r.url().includes('plan.me')) planMe.push(r.url());
  });

  for (const path of ['/dashboard', '/students', '/plan', '/', '/admin', '/api/backup']) {
    await admin.goto(path);
    await expect(admin, path).toHaveURL(/\/admin\/orders$/);
  }
  await expect(admin.getByRole('heading', { level: 1, name: 'Chờ xác nhận' })).toBeVisible();
  await expect(admin.getByRole('banner').getByRole('button', { name: 'Gia hạn' })).toHaveCount(0);

  const tabs = admin.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(tabs.getByRole('link')).toHaveCount(3);
  for (const link of await tabs.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(tabs).not.toContainText('Tổng quan');
  await expect(tabs).not.toContainText('Học phí');
  await tabs.getByRole('link', { name: 'Lịch sử' }).click();
  await expect(admin).toHaveURL(/\/admin\/history$/);

  await admin.getByRole('button', { name: 'Mở menu tài khoản' }).click();
  const menu = admin.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Quản trị', 'Đổi mật khẩu', 'Đăng xuất']);
  await menu.getByRole('menuitem', { name: 'Quản trị' }).click();
  await expect(admin).toHaveURL(/\/admin\/orders$/);

  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(planMe).toEqual([]);
  await admin.context().close();
});
```

- [ ] **Step 9: Chạy e2e**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin.spec.ts tests/e2e/auth.spec.ts
```
Expected: lệnh 1 PASS; lệnh 2 toàn bộ passed (`admin.spec` 5 test, `auth.spec` không đổi). Admin đăng nhập mà URL dừng ở `/dashboard` → middleware chưa đọc được `ADMIN_USERNAMES` (kiểm `playwright.config.ts` `webServer.env`), lưới `(app)/layout` phải vẫn chuyển được; nếu vẫn dừng thì báo lỗi.

- [ ] **Step 10: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: không lỗi.

- [ ] **Step 11: Commit**

```bash
git add src/server/auth.config.ts "src/app/(app)/layout.tsx" src/app/login/page.tsx tests/unit/auth-authorized.test.ts tests/unit/layout/admin-redirect.test.ts tests/e2e/admin.spec.ts
git commit -m "feat(j): chặn admin khỏi route giáo viên ở middleware + layout, login admin vào /admin/orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: `/plan` — 3 thẻ cao bằng nhau, bỏ thẻ "Gói hiện tại", thông tin gói đang dùng trên thẻ

**Đọc trước:** Global Constraints; spec mục 3 (J3a, J3b), 4 (Q14, Q18), 6.3 (đoạn `PlanCompare` và thứ tự trang), 9 (key `plan_active_now`, danh sách xóa); `src/components/plan/PlanCompare.tsx`; `src/app/(app)/plan/page.tsx`; `tests/e2e/plan.spec.ts`; `tests/e2e/admin.spec.ts` (bản Task 3, đoạn `std2` cuối test đầu).

**Files:**
- Modify: `src/components/plan/PlanCompare.tsx` (viết lại cả file)
- Modify: `src/app/(app)/plan/page.tsx` (viết lại cả file)
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/components/PlanCompare.test.tsx`
- Test (Sửa): `tests/e2e/plan.spec.ts`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `RouterOutputs["plan"]["me"]` (field dùng: `plan: Plan`, `source: "paid"|"trial"|"free"`, `expiresAt: string | null`, `activeStudents: number`, `pendingOrder`, `paymentReady`, `orders`); `usePlan()` → `{ me, fields }`; `PlanCheckout` + `PlanChoice` (vẫn còn tới Task 5).
- Produces: `PlanCompare({ me, plusBlocked, onChoose }: { me: RouterOutputs["plan"]["me"]; plusBlocked: boolean; onChoose: (plan: PaidPlan) => void })` (bỏ prop `current`). Thẻ đang dùng: nhãn "Đang dùng" (trial: "Dùng thử"), dòng "Dùng đến hết ngày …" (nếu `me.expiresAt`), "Đang có {count} học sinh đang học". Test id `plan-card-{plan}` giữ nguyên; `current-plan`, `admin-link` bị bỏ. Key mới `plan_active_now`; xóa `plan_current`, `plan_students_usage`, `plan_students_unlimited`, `admin_link`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Viết unit test `PlanCompare` (RED)**

Tạo `tests/unit/components/PlanCompare.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PlanCompare } from "@/components/plan/PlanCompare"

type Me = RouterOutputs["plan"]["me"]

function makeMe(over: Partial<Me> = {}): Me {
  return {
    plan: "standard",
    source: "free",
    expiresAt: null,
    paidPlan: "standard",
    planExpiresAt: null,
    trialEndsAt: null,
    activeStudents: 3,
    studentLimit: 10,
    plusCreditOrder: null,
    pendingOrder: null,
    orders: [],
    paymentReady: true,
    isAdmin: false,
    ...over,
  } as Me
}

function renderCompare(me: Me, plusBlocked = false) {
  const onChoose = vi.fn()
  render(
    <LanguageProvider forcedLanguage="vi">
      <PlanCompare me={me} plusBlocked={plusBlocked} onChoose={onChoose} />
    </LanguageProvider>
  )
  return onChoose
}

describe("PlanCompare", () => {
  it("Standard miễn phí: thẻ Standard có Đang dùng + số HS, không có dòng hạn; thẻ khác không có Đang dùng", () => {
    renderCompare(makeMe({ activeStudents: 3 }))
    const std = screen.getByTestId("plan-card-standard")
    expect(std.textContent).toContain("Đang dùng")
    expect(std.textContent).toContain("Đang có 3 học sinh đang học")
    expect(std.textContent).not.toContain("Dùng đến hết ngày")
    expect(screen.getByTestId("plan-card-plus").textContent).not.toContain("Đang dùng")
    expect(screen.getByTestId("plan-card-pro").textContent).not.toContain("Đang dùng")
  })

  it("dùng thử Pro: thẻ Pro có nhãn Dùng thử + Dùng đến hết ngày", () => {
    renderCompare(makeMe({ plan: "pro", source: "trial", expiresAt: "2026-11-01T17:00:00.000Z", activeStudents: 12 }))
    const pro = screen.getByTestId("plan-card-pro")
    expect(pro.textContent).toContain("Dùng thử")
    expect(pro.textContent).toContain("Dùng đến hết ngày 01/11/2026")
    expect(pro.textContent).toContain("Đang có 12 học sinh đang học")
    expect(screen.getByTestId("plan-card-standard").textContent).not.toContain("Đang dùng")
  })

  it("CTA: Chọn gói Pro gọi onChoose('pro'); Plus bị D7 thì CTA khóa; Standard không có CTA", () => {
    const onChoose = renderCompare(makeMe(), true)
    fireEvent.click(screen.getByRole("button", { name: "Chọn gói Pro" }))
    expect(onChoose).toHaveBeenCalledWith("pro")
    expect((screen.getByRole("button", { name: "Chọn gói Plus" }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(screen.getByTestId("plan-card-standard")).queryByRole("button")).toBeNull()
  })

  it("desktop: lưới items-stretch, thẻ Pro không còn nhô lên", () => {
    renderCompare(makeMe())
    const pro = screen.getByTestId("plan-card-pro")
    expect(pro.parentElement!.className).toContain("md:items-stretch")
    expect(pro.parentElement!.className).not.toContain("md:items-start")
    expect(pro.className).not.toContain("md:-mt-2")
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/components/PlanCompare.test.tsx`
Expected: FAIL (component chưa nhận prop `me`: không có "Đang có … học sinh", lưới còn `md:items-start`).

- [ ] **Step 4: Thêm/xóa key i18n**

`src/language/vi.json`: xóa 3 dòng `"plan_current": …`, `"plan_students_usage": …`, `"plan_students_unlimited": …` và dòng `"admin_link": "Trang quản trị",`; ngay sau dòng `"plan_in_use": "Đang dùng",` thêm:
```json
  "plan_active_now": "Đang có {count} học sinh đang học",
```
`src/language/en.json`: xóa 4 key cùng tên; ngay sau dòng `"plan_in_use": "Current",` thêm:
```json
  "plan_active_now": "{count} active students now",
```

- [ ] **Step 5: Viết lại `PlanCompare.tsx`**

```tsx
"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type { RouterOutputs } from "@/lib/trpc"
import { FEATURE_LABEL_KEY } from "./feature-labels"
import {
  PLANS,
  PLAN_LABEL,
  PLAN_PRICES,
  STUDENT_LIMITS,
  TWO_YEAR_BONUS_MONTHS,
  featuresAddedIn,
  formatValidUntil,
  type PaidPlan,
  type Plan,
} from "@/lib/plans"
import { cn, formatCurrency } from "@/lib/utils"

// P11: desktop Standard → Plus → Pro (trái sang phải), mobile Pro → Plus → Standard (trên xuống).
const CARD_ORDER: Record<Plan, string> = {
  standard: "order-3 md:order-1",
  plus: "order-2",
  pro: "order-1 md:order-3",
}
const BELOW: Record<Plan, Plan | null> = { standard: null, plus: "standard", pro: "plus" }

type Me = RouterOutputs["plan"]["me"]
type Props = { me: Me; plusBlocked: boolean; onChoose: (plan: PaidPlan) => void }

export function PlanCompare({ me, plusBlocked, onChoose }: Props) {
  const { t } = useTranslation()
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t("plan_compare")}</h2>
      {/* J3a: items-stretch để 3 thẻ cao bằng nhau, CTA mt-auto dính đáy. */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:items-stretch md:gap-4">
        {PLANS.map((plan) => {
          const pro = plan === "pro"
          const below = BELOW[plan]
          const limit = STUDENT_LIMITS[plan]
          const inUse = me.plan === plan
          return (
            <article
              key={plan}
              data-testid={`plan-card-${plan}`}
              className={cn(
                "flex flex-col gap-3 rounded-xl p-4 md:p-5",
                CARD_ORDER[plan],
                pro ? "border-2 border-primary bg-primary/[0.04]" : "border border-slate-200 bg-white"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{PLAN_LABEL[plan]}</h3>
                {pro && (
                  <span className="rounded-full bg-primary px-2 text-xs font-medium leading-5 text-primary-foreground">
                    {t("plan_recommended")}
                  </span>
                )}
                {inUse && (
                  <span className="rounded-full border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-600">
                    {t(me.source === "trial" ? "plan_source_trial" : "plan_in_use")}
                  </span>
                )}
              </div>

              {plan === "standard" ? (
                <p className="text-2xl font-semibold text-foreground">{t("plan_source_free")}</p>
              ) : (
                <div className="space-y-0.5 text-sm text-slate-600">
                  <p>
                    <span className="text-2xl font-semibold text-foreground">{formatCurrency(PLAN_PRICES[plan].month)}</span>
                    {t("plan_per_month")}
                  </p>
                  <p>
                    {formatCurrency(PLAN_PRICES[plan].year)}
                    {t("plan_per_year")} · {t("plan_save_2_months")}
                  </p>
                  <p>
                    {formatCurrency(PLAN_PRICES[plan]["2year"])}
                    {t("plan_per_2years")} · {t("plan_bonus_months").replace("{n}", String(TWO_YEAR_BONUS_MONTHS))}
                  </p>
                </div>
              )}

              {/* Q14: thay cho thẻ "Gói hiện tại" đã bỏ. */}
              {inUse && (
                <div className="space-y-0.5 text-sm font-medium text-foreground">
                  {me.expiresAt && <p>{t("plan_valid_until").replace("{date}", formatValidUntil(new Date(me.expiresAt)))}</p>}
                  <p>{t("plan_active_now").replace("{count}", String(me.activeStudents))}</p>
                </div>
              )}

              {limit !== null && (
                <p className="text-sm font-medium text-foreground">{t("plan_student_limit").replace("{n}", String(limit))}</p>
              )}

              <ul className="space-y-1.5 text-sm text-slate-700">
                {below && <li className="font-medium">{t("plan_includes_below").replace("{plan}", PLAN_LABEL[below])}</li>}
                {featuresAddedIn(plan).map((id) => (
                  <li key={id} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{t(FEATURE_LABEL_KEY[id])}</span>
                  </li>
                ))}
              </ul>

              {plan !== "standard" && (
                <Button
                  type="button"
                  variant={pro ? "default" : "outline"}
                  className="mt-auto h-11 md:h-10"
                  disabled={plan === "plus" && plusBlocked}
                  onClick={() => onChoose(plan)}
                >
                  {t("plan_choose").replace("{plan}", PLAN_LABEL[plan])}
                </Button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Viết lại `src/app/(app)/plan/page.tsx`**

(Thứ tự mới: PageHeader → đơn chờ → bảng gói → checkout cũ (bỏ ở Task 5) → lịch sử. Bỏ `current-plan` và `admin-link`.)
```tsx
"use client"

import { useState } from "react"
import { PageHeader } from "@/components/common/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PlanCompare } from "@/components/plan/PlanCompare"
import { PlanCheckout, type PlanChoice } from "@/components/plan/PlanCheckout"
import { PendingOrderCard } from "@/components/plan/PendingOrderCard"
import { isPeriod, orderBlockedUntil, planLabel } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"
import { formatCurrency } from "@/lib/utils"

const STATUS_KEY = {
  pending: "plan_pending",
  approved: "plan_status_approved",
  rejected: "plan_status_rejected",
  cancelled: "plan_status_cancelled",
} as const

export default function PlanPage() {
  const { t } = useTranslation()
  const { me, fields } = usePlan()
  // P11: luôn chọn sẵn Pro, kỳ Năm.
  const [choice, setChoice] = useState<PlanChoice>({ plan: "pro", period: "year" })

  if (!me || !fields) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={t("my_plan")} />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const plusBlocked = orderBlockedUntil(fields, "plus", new Date()) !== null
  const periodText = (p: string | null) =>
    !isPeriod(p) ? t("plan_order_by_admin") : p === "2year" ? t("plan_period_2year") : p === "month" ? t("month") : t("year")

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("my_plan")} />

      {me.pendingOrder && <PendingOrderCard order={me.pendingOrder} paymentReady={me.paymentReady} />}

      <PlanCompare
        me={me}
        plusBlocked={plusBlocked}
        onChoose={(plan) => {
          setChoice((c) => ({ ...c, plan }))
          document.getElementById("plan-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }}
      />

      <PlanCheckout me={me} fields={fields} choice={choice} onChange={setChoice} />

      <section data-testid="plan-history" className="space-y-2 rounded-xl border bg-white p-4 md:p-6">
        <h2 className="text-base font-semibold text-foreground">{t("plan_history")}</h2>
        {me.orders.length === 0 ? (
          <p className="text-sm text-slate-500">{t("plan_no_orders")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {me.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="text-slate-500">{formatVnDate(new Date(o.createdAt))}</span>
                <span className="font-medium text-foreground">
                  {planLabel(o.plan)} · {periodText(o.period)}
                </span>
                <span className="text-slate-600">{formatCurrency(o.amount)}</span>
                <span className="ml-auto text-slate-600">
                  {o.status in STATUS_KEY ? t(STATUS_KEY[o.status as keyof typeof STATUS_KEY]) : o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

Kiểm:
```bash
grep -rn "plan_current\|plan_students_usage\|plan_students_unlimited\|admin_link\|admin-link\|current={" src tests
```
Expected: không in gì (key đã xóa ở cả 2 file JSON).

- [ ] **Step 7: Chạy unit, xác nhận pass**

Run: `pnpm test tests/unit/components/PlanCompare.test.tsx`
Expected: PASS 4 test.

- [ ] **Step 8: Sửa e2e**

`tests/e2e/plan.spec.ts`, test mobile `'Standard: vào từ sheet Thêm…'`: thay 4 dòng
```ts
    const current = page.getByTestId('current-plan');
    await expect(current).toContainText('Standard');
    await expect(current).toContainText('Miễn phí');
    await expect(current).toContainText(/Học sinh đang học: \d+\/10/);
```
bằng:
```ts
    // J3b: không còn thẻ Gói hiện tại; gói đang dùng hiện trên thẻ gói.
    await expect(page.getByTestId('current-plan')).toHaveCount(0);
    const stdCard = page.getByTestId('plan-card-standard');
    await expect(stdCard).toContainText('Đang dùng');
    await expect(stdCard).toContainText(/Đang có \d+ học sinh đang học/);
```
Test desktop `'desktop: Standard bên trái, Pro bên phải…'`: ngay sau dòng `expect(await x('plan-card-plus')).toBeLessThan(await x('plan-card-pro'));` thêm:
```ts
    // J3a: 3 thẻ cao bằng nhau, CTA Plus/Pro cùng mép dưới.
    const heights = await Promise.all(
      ['plan-card-standard', 'plan-card-plus', 'plan-card-pro'].map(async (id) => (await page.getByTestId(id).boundingBox())!.height)
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    const ctaBottom = async (plan: string, name: string) => {
      const b = (await page.getByTestId(`plan-card-${plan}`).getByRole('button', { name }).boundingBox())!;
      return b.y + b.height;
    };
    expect(Math.abs((await ctaBottom('plus', 'Chọn gói Plus')) - (await ctaBottom('pro', 'Chọn gói Pro')))).toBeLessThanOrEqual(1);
```

`tests/e2e/admin.spec.ts`, cuối test đầu tiên: thay 4 dòng
```ts
  const current = std2.getByTestId('current-plan');
  await expect(current).toContainText('Plus');
  await expect(current).toContainText('Đã mua');
  await expect(current).toContainText('Dùng đến hết ngày');
```
bằng:
```ts
  const plusCard = std2.getByTestId('plan-card-plus');
  await expect(plusCard).toContainText('Đang dùng');
  await expect(plusCard).toContainText('Dùng đến hết ngày');
  await expect(std2.getByTestId('current-plan')).toHaveCount(0);
```

- [ ] **Step 9: Chạy e2e**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/plan.spec.ts tests/e2e/admin.spec.ts
```
Expected: lệnh 1 PASS; lệnh 2 toàn bộ passed (`plan.spec` 2, `admin.spec` 5).

- [ ] **Step 10: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: không lỗi.

- [ ] **Step 11: Commit**

```bash
git add src/components/plan/PlanCompare.tsx "src/app/(app)/plan/page.tsx" src/language/vi.json src/language/en.json tests/unit/components/PlanCompare.test.tsx tests/e2e/plan.spec.ts tests/e2e/admin.spec.ts
git commit -m "feat(j): trang gói - 3 thẻ cao bằng nhau, bỏ thẻ Gói hiện tại, thông tin gói đang dùng trên thẻ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: Popup mua gói `PlanPurchaseDialog`, `?buy=1`, bỏ `PlanCheckout`

**Đọc trước:** Global Constraints; mục "Điều chỉnh so với spec" 1–4, 7; spec mục 3 (J3c), 4 (Q10–Q13, Q15), 6.3 (đoạn `?buy=1`), 6.4 (toàn bộ), 9 (key popup, danh sách xóa); `src/components/plan/PlanCheckout.tsx` (công thức xem trước phải chuyển NGUYÊN sang popup rồi xóa file); `src/components/plan/PendingOrderCard.tsx`; `src/components/plan/RenewOffer.tsx`; `src/components/plan/feature-labels.ts`; `src/components/ui/dialog.tsx` (nút Close mặc định `absolute right-4 top-4`, icon 16px — phải nới ≥44px); `src/app/(app)/plan/page.tsx` (bản Task 4); `tests/e2e/plan.spec.ts`, `tests/e2e/renew-offer.spec.ts`, `tests/e2e/admin.spec.ts` (bản Task 4); `tests/unit/next15-contract.test.ts`.

**Files:**
- Create: `src/components/plan/PlanPurchaseDialog.tsx`
- Delete: `src/components/plan/PlanCheckout.tsx`
- Modify: `src/components/plan/PendingOrderCard.tsx` (prop `onCancelled?`)
- Modify: `src/components/plan/RenewOffer.tsx` (1 dòng `href`)
- Modify: `src/app/(app)/plan/page.tsx` (viết lại cả file)
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/components/PlanPurchaseDialog.test.tsx`
- Test (Sửa): `tests/e2e/plan.spec.ts`, `tests/e2e/renew-offer.spec.ts`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `PlanCompare({ me, plusBlocked, onChoose })` (Task 4); `usePlan()` → `{ me, fields }`; từ `@/lib/plans`: `PERIODS`, `PERIOD_MONTHS`, `PLAN_LABEL`, `PLAN_PRICES`, `STUDENT_LIMITS`, `addDays`, `computeBonusMonths(fields, plan, period, now)`, `computeNewExpiry(fields, plan, period, now, extraMonths)`, `computeUpgradeCredit(fields, me.plusCreditOrder, period, now) → { remainingValue, creditDays }`, `featuresAddedIn`, `formatValidUntil`, `orderBlockedUntil(fields, "plus", now) → Date | null`, types `PaidPlan`, `Period`, `PlanFields`; tRPC `plan.createOrder` (input `{ plan, period }`, trả `{ id, code, bonusMonths }`), `plan.cancelOrder`; `FEATURE_LABEL_KEY`.
- Produces:
  - `export type PlanChoice = { plan: PaidPlan; period: Period }` (chuyển từ `PlanCheckout`).
  - `PlanPurchaseDialog({ open, onOpenChange, me, fields, initialPlan }: { open: boolean; onOpenChange: (open: boolean) => void; me: RouterOutputs["plan"]["me"]; fields: PlanFields; initialPlan: PaidPlan })`.
  - `PendingOrderCard({ order, paymentReady, onCancelled? })`.
  - Test id: `plan-purchase` (DialogContent), `purchase-plan-plus|pro`, `purchase-period-month|year|2year` (đều `role="radio"` + `aria-checked`), `purchase-summary`. Trong popup vẫn dùng `pending-order` của `PendingOrderCard`.
  - Key mới: `plan_purchase_title`, `plan_desc_plus`, `plan_desc_pro`, `plan_duration`, `plan_period_1m`, `plan_period_12m`, `plan_period_24m`, `plan_max_months`, `plan_order_summary`, `plan_total`, `plan_replace_pending`, `plan_create_order_short`, `plan_done`. Xóa `plan_upgrade_title`, `plan_amount`, `plan_create_order`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Thêm key i18n popup**

`src/language/vi.json`: ngay sau dòng `"plan_new_expiry": "Hạn mới dự kiến: {date}",` thêm:
```json
  "plan_purchase_title": "Mua / gia hạn gói",
  "plan_desc_plus": "Cho lớp vừa: thu tiền, phiếu báo, báo cáo tháng",
  "plan_desc_pro": "Đầy đủ nhất: link phụ huynh, cảnh báo, báo cáo năm",
  "plan_duration": "Thời hạn",
  "plan_period_1m": "1 tháng",
  "plan_period_12m": "12 tháng",
  "plan_period_24m": "24 tháng",
  "plan_max_months": "Tối đa {n} tháng sử dụng nếu mua ngay hôm nay",
  "plan_order_summary": "Đơn hàng",
  "plan_total": "Tổng tiền thanh toán",
  "plan_replace_pending": "Tạo đơn mới sẽ hủy đơn đang chờ",
  "plan_create_order_short": "Tạo đơn",
  "plan_done": "Xong",
```
`src/language/en.json`: ngay sau dòng `"plan_new_expiry": "New expiry: {date}",` thêm:
```json
  "plan_purchase_title": "Buy / renew plan",
  "plan_desc_plus": "For growing classes: payments, notices, monthly reports",
  "plan_desc_pro": "Everything: parent links, alerts, yearly reports",
  "plan_duration": "Duration",
  "plan_period_1m": "1 month",
  "plan_period_12m": "12 months",
  "plan_period_24m": "24 months",
  "plan_max_months": "Up to {n} months if you buy today",
  "plan_order_summary": "Order",
  "plan_total": "Total",
  "plan_replace_pending": "A new order cancels the pending one",
  "plan_create_order_short": "Create order",
  "plan_done": "Done",
```
(Chưa xóa 3 key cũ ở bước này — `PlanCheckout` còn dùng; xóa ở Step 8.)

- [ ] **Step 3: Viết unit test popup (RED)**

Tạo `tests/unit/components/PlanPurchaseDialog.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ComponentProps } from "react"
import { act, render, screen, fireEvent } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PlanPurchaseDialog } from "@/components/plan/PlanPurchaseDialog"
import { addDays, vnStartOfDay, type PlanFields } from "@/lib/plans"

type Me = RouterOutputs["plan"]["me"]
type CreateOpts = { onSuccess?: (res: { id: number; code: string; bonusMonths: number }) => void }

const mut = vi.hoisted(() => ({ create: vi.fn(), createOpts: null as null | CreateOpts }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
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

const STD: PlanFields = { plan: "standard", planExpiresAt: null, trialEndsAt: null }
const FAR = new Date("2099-12-31T17:00:00.000Z")

function makeMe(over: Partial<Me> = {}): Me {
  return {
    plan: "standard",
    source: "free",
    expiresAt: null,
    paidPlan: "standard",
    planExpiresAt: null,
    trialEndsAt: null,
    activeStudents: 3,
    studentLimit: 10,
    plusCreditOrder: null,
    pendingOrder: null,
    orders: [],
    paymentReady: true,
    isAdmin: false,
    ...over,
  } as Me
}

function pendingOrder(id: number, code: string) {
  return {
    id,
    code,
    plan: "plus",
    period: "year",
    amount: 490000,
    bonusMonths: 0,
    createdAt: new Date().toISOString(),
    transferContent: `SM ${code}`,
    qr: { payload: "000201010212", bankShortName: "Vietcombank", accountNumber: "0123456789", accountName: "CHU APP TEST" },
  } as NonNullable<Me["pendingOrder"]>
}

type Props = ComponentProps<typeof PlanPurchaseDialog>

function renderDialog(over: Partial<Props> = {}) {
  const props: Props = { open: true, onOpenChange: vi.fn(), me: makeMe(), fields: STD, initialPlan: "pro", ...over }
  const ui = (p: Props) => (
    <LanguageProvider forcedLanguage="vi">
      <PlanPurchaseDialog {...p} />
    </LanguageProvider>
  )
  const view = render(ui(props))
  return { props, rerender: (next: Partial<Props>) => view.rerender(ui({ ...props, ...next })) }
}

const text = (id: string) => screen.getByTestId(id).textContent ?? ""
const checked = (id: string) => screen.getByTestId(id).getAttribute("aria-checked")

beforeEach(() => {
  vi.clearAllMocks()
  mut.createOpts = null
})

describe("PlanPurchaseDialog", () => {
  it("mở: gói bấm + 12 tháng chọn sẵn; chỉ Plus/Pro; nhãn ưu đãi và Tối đa N tháng theo từng kỳ (mua mới)", () => {
    renderDialog()
    expect(screen.getByText("Mua / gia hạn gói")).toBeTruthy()
    expect(checked("purchase-plan-pro")).toBe("true")
    expect(checked("purchase-plan-plus")).toBe("false")
    expect(checked("purchase-period-year")).toBe("true")
    expect(screen.queryByTestId("purchase-plan-standard")).toBeNull()
    expect(text("purchase-plan-pro")).toContain("Khuyên dùng")
    expect(text("purchase-plan-pro")).toContain("Mọi thứ của gói Plus, thêm:")
    expect(text("purchase-plan-plus")).toContain("Tối đa 40 học sinh đang học")
    expect(text("purchase-period-month")).toContain("Tối đa 1 tháng sử dụng")
    expect(text("purchase-period-month")).not.toMatch(/Tặng|Tiết kiệm/)
    expect(text("purchase-period-year")).toContain("Tiết kiệm 2 tháng")
    expect(text("purchase-period-year")).toContain("Tối đa 12 tháng")
    expect(text("purchase-period-2year")).toContain("Tặng 2 tháng")
    expect(text("purchase-period-2year")).toContain("Tối đa 26 tháng")
    expect(text("purchase-summary")).toContain("Pro · 12 tháng")
    expect(text("purchase-summary")).toContain("990.000")
    expect(text("purchase-summary")).toContain("Tổng tiền thanh toán")
  })

  it("chọn Plus + 24 tháng → tổng 980.000 + Tặng 2 tháng; Tạo đơn gửi đúng lựa chọn", () => {
    renderDialog()
    fireEvent.click(screen.getByTestId("purchase-plan-plus"))
    fireEvent.click(screen.getByTestId("purchase-period-2year"))
    expect(checked("purchase-plan-plus")).toBe("true")
    expect(checked("purchase-period-2year")).toBe("true")
    expect(text("purchase-summary")).toContain("980.000")
    expect(text("purchase-summary")).toContain("Tặng 2 tháng")
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    expect(mut.create).toHaveBeenCalledWith({ plan: "plus", period: "2year" })
  })

  it("gia hạn sớm Plus còn 45 ngày: 12 tháng Tặng 2 / Tối đa 14, 24 tháng Tặng 4 / Tối đa 28; lên Pro năm có +22 ngày quy đổi", () => {
    const fields: PlanFields = { plan: "plus", planExpiresAt: addDays(vnStartOfDay(new Date()), 45), trialEndsAt: null }
    const me = makeMe({ plan: "plus", source: "paid", paidPlan: "plus", plusCreditOrder: { amount: 490000, period: "year", bonusMonths: 0 } })
    renderDialog({ me, fields, initialPlan: "plus" })
    expect(text("purchase-period-year")).toContain("Tặng 2 tháng")
    expect(text("purchase-period-year")).toContain("Tối đa 14 tháng")
    expect(text("purchase-period-2year")).toContain("Tặng 4 tháng")
    expect(text("purchase-period-2year")).toContain("Tối đa 28 tháng")
    expect(text("purchase-summary")).not.toContain("ngày Pro")
    fireEvent.click(screen.getByTestId("purchase-plan-pro"))
    expect(text("purchase-summary")).toContain("+22 ngày Pro")
  })

  it("D7: Pro trả phí còn hạn → thẻ Plus khóa, ghi Gói Pro còn hạn tới", () => {
    const fields: PlanFields = { plan: "pro", planExpiresAt: FAR, trialEndsAt: null }
    renderDialog({ me: makeMe({ plan: "pro", source: "paid", paidPlan: "pro" }), fields })
    expect((screen.getByTestId("purchase-plan-plus") as HTMLButtonElement).disabled).toBe(true)
    expect(text("purchase-plan-plus")).toContain("Gói Pro còn hạn tới")
  })

  it("có đơn chờ → nhắc hủy đơn cũ; chưa mở thanh toán → nút Tạo đơn khóa", () => {
    renderDialog({ me: makeMe({ pendingOrder: pendingOrder(1, "OLDOLD"), paymentReady: false }) })
    expect(text("purchase-summary")).toContain("Tạo đơn mới sẽ hủy đơn đang chờ")
    expect(text("purchase-summary")).toContain("Chưa mở thanh toán")
    expect((screen.getByRole("button", { name: "Tạo đơn" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("tạo đơn xong: chờ refetch thì Skeleton (không hiện đơn cũ); đơn mới về thì hiện QR; Xong đóng popup", async () => {
    const { props, rerender } = renderDialog({ me: makeMe({ pendingOrder: pendingOrder(1, "OLDOLD") }) })
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onSuccess!({ id: 5, code: "NEWNEW", bonusMonths: 0 }))
    expect(screen.queryByTestId("purchase-summary")).toBeNull()
    expect(screen.queryByTestId("pending-order")).toBeNull()
    expect(screen.queryByText(/OLDOLD/)).toBeNull()

    rerender({ me: makeMe({ pendingOrder: pendingOrder(5, "NEWNEW") }) })
    expect((await screen.findByTestId("pending-order")).textContent).toContain("SM NEWNEW")
    fireEvent.click(screen.getByRole("button", { name: "Xong" }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("Hủy yêu cầu trong popup → đóng popup", async () => {
    const { props, rerender } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Tạo đơn" }))
    act(() => mut.createOpts!.onSuccess!({ id: 7, code: "CANCEL", bonusMonths: 0 }))
    rerender({ me: makeMe({ pendingOrder: pendingOrder(7, "CANCEL") }) })
    fireEvent.click(await screen.findByRole("button", { name: "Hủy yêu cầu" }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 4: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx`
Expected: FAIL — không resolve được `@/components/plan/PlanPurchaseDialog`.

- [ ] **Step 5: `PendingOrderCard` thêm `onCancelled`**

Trong `src/components/plan/PendingOrderCard.tsx`: đổi chữ ký thành
```tsx
export function PendingOrderCard({
  order,
  paymentReady,
  onCancelled,
}: {
  order: Order
  paymentReady: boolean
  onCancelled?: () => void
}) {
```
và `onSuccess` của `cancel` thành:
```tsx
    onSuccess: () => {
      toast.success(t("plan_order_cancelled"))
      onCancelled?.()
    },
```

- [ ] **Step 6: Tạo `PlanPurchaseDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import {
  PERIODS,
  PERIOD_MONTHS,
  PLAN_LABEL,
  PLAN_PRICES,
  STUDENT_LIMITS,
  addDays,
  computeBonusMonths,
  computeNewExpiry,
  computeUpgradeCredit,
  featuresAddedIn,
  formatValidUntil,
  orderBlockedUntil,
  type PaidPlan,
  type Period,
  type PlanFields,
} from "@/lib/plans"
import { cn, formatCurrency } from "@/lib/utils"
import { FEATURE_LABEL_KEY } from "./feature-labels"
import { PendingOrderCard } from "./PendingOrderCard"

export type PlanChoice = { plan: PaidPlan; period: Period }
type Me = RouterOutputs["plan"]["me"]
type Props = { open: boolean; onOpenChange: (open: boolean) => void; me: Me; fields: PlanFields; initialPlan: PaidPlan }

const PAID_PLANS: PaidPlan[] = ["plus", "pro"]
// P11: mobile Pro trên Plus; desktop Plus → Pro (trái sang phải).
const PLAN_ORDER: Record<PaidPlan, string> = { plus: "order-2 md:order-1", pro: "order-1 md:order-2" }
const BELOW: Record<PaidPlan, "standard" | "plus"> = { plus: "standard", pro: "plus" }
const DESC_KEY = { plus: "plan_desc_plus", pro: "plan_desc_pro" } as const
const PERIOD_KEY = { month: "plan_period_1m", year: "plan_period_12m", "2year": "plan_period_24m" } as const

const optionClass = (selected: boolean) =>
  cn(
    "flex min-w-0 flex-col gap-2 rounded-xl p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    selected ? "border-2 border-primary bg-primary/[0.04]" : "border border-slate-200 bg-white hover:bg-slate-50"
  )

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-primary" : "border-slate-300"
      )}
    >
      {selected && <span className="size-2 rounded-full bg-primary" />}
    </span>
  )
}

export function PlanPurchaseDialog({ open, onOpenChange, me, fields, initialPlan }: Props) {
  const { t } = useTranslation()
  // P11: kỳ Năm chọn sẵn; trang mount lại dialog mỗi lần mở nên state tự về mặc định.
  const [choice, setChoice] = useState<PlanChoice>({ plan: initialPlan, period: "year" })
  const [createdId, setCreatedId] = useState<number | null>(null)

  const now = new Date()
  const plusBlockedUntil = orderBlockedUntil(fields, "plus", now)
  const bonusOf = (period: Period) => computeBonusMonths(fields, choice.plan, period, now)
  // Xem trước giống PlanCheckout cũ: ưu đãi chốt lúc tạo đơn, ngày quy đổi tính lại lúc admin duyệt (server là chuẩn).
  const bonus = bonusOf(choice.period)
  const credit = choice.plan === "pro" ? computeUpgradeCredit(fields, me.plusCreditOrder, choice.period, now) : null
  const newExpiry = addDays(computeNewExpiry(fields, choice.plan, choice.period, now, bonus), credit?.creditDays ?? 0)
  const price = PLAN_PRICES[choice.plan][choice.period]

  const create = trpc.plan.createOrder.useMutation({
    onSuccess: (res) => {
      toast.success(t("plan_order_created"))
      setCreatedId(res.id)
    },
    onError: (e) => toast.error(e.message),
  })

  // Chỉ hiện đơn vừa tạo: lúc chưa refetch xong, me.pendingOrder có thể còn là đơn cũ (đã bị hủy ở server).
  const createdOrder = createdId !== null && me.pendingOrder?.id === createdId ? me.pendingOrder : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="plan-purchase"
        aria-describedby={undefined}
        className="h-[100dvh] w-full max-w-none content-start gap-5 overflow-y-auto rounded-none p-4 sm:rounded-none md:h-auto md:max-h-[90dvh] md:max-w-4xl md:rounded-xl md:p-6 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
      >
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{t("plan_purchase_title")}</DialogTitle>
        </DialogHeader>

        {createdId !== null ? (
          <div className="space-y-4">
            {createdOrder ? (
              <PendingOrderCard order={createdOrder} paymentReady={me.paymentReady} onCancelled={() => onOpenChange(false)} />
            ) : (
              <Skeleton className="h-64 w-full rounded-xl" />
            )}
            <Button type="button" className="h-12 w-full" onClick={() => onOpenChange(false)}>
              {t("plan_done")}
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6 md:grid md:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-5">
              <div role="radiogroup" aria-label={t("admin_col_plan")} className="flex flex-col gap-3 md:grid md:grid-cols-2">
                {PAID_PLANS.map((plan) => {
                  const selected = choice.plan === plan
                  const blocked = plan === "plus" && plusBlockedUntil !== null
                  return (
                    <button
                      key={plan}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={blocked}
                      data-testid={`purchase-plan-${plan}`}
                      onClick={() => setChoice((c) => ({ ...c, plan }))}
                      className={cn(optionClass(selected), PLAN_ORDER[plan])}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <RadioDot selected={selected} />
                        <span className="text-lg font-semibold text-foreground">{PLAN_LABEL[plan]}</span>
                        {plan === "pro" && (
                          <span className="rounded-full bg-primary px-2 text-xs font-medium leading-5 text-primary-foreground">
                            {t("plan_recommended")}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-slate-600">
                        <span className="text-xl font-semibold text-foreground">{formatCurrency(PLAN_PRICES[plan].month)}</span>
                        {t("plan_per_month")}
                      </span>
                      <span className="text-sm text-slate-600">{t(DESC_KEY[plan])}</span>
                      <span className="space-y-1 text-sm text-slate-700">
                        <span className="block font-medium">{t("plan_includes_below").replace("{plan}", PLAN_LABEL[BELOW[plan]])}</span>
                        {featuresAddedIn(plan).map((id) => (
                          <span key={id} className="flex gap-2">
                            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{t(FEATURE_LABEL_KEY[id])}</span>
                          </span>
                        ))}
                        {plan === "plus" && (
                          <span className="block font-medium">
                            {t("plan_student_limit").replace("{n}", String(STUDENT_LIMITS.plus))}
                          </span>
                        )}
                      </span>
                      {blocked && plusBlockedUntil && (
                        <span className="text-xs text-slate-500">
                          {t("plan_downgrade_blocked").replace("{date}", formatValidUntil(plusBlockedUntil))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("plan_duration")}</p>
                <div role="radiogroup" aria-label={t("plan_duration")} className="flex flex-col gap-2 md:grid md:grid-cols-3">
                  {PERIODS.map((period) => {
                    const selected = choice.period === period
                    const b = bonusOf(period)
                    // Q11: ghi đúng số tháng tặng hôm nay; năm không tặng thì nhắc tiết kiệm 2 tháng.
                    const tag = b > 0 ? t("plan_bonus_months").replace("{n}", String(b)) : period === "year" ? t("plan_save_2_months") : null
                    return (
                      <button
                        key={period}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-testid={`purchase-period-${period}`}
                        onClick={() => setChoice((c) => ({ ...c, period }))}
                        className={cn(optionClass(selected), "gap-1 p-3")}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-semibold text-foreground">
                            <RadioDot selected={selected} />
                            {t(PERIOD_KEY[period])}
                          </span>
                          {tag && (
                            <span className="rounded-full bg-primary/10 px-2 text-xs font-medium leading-5 text-primary">{tag}</span>
                          )}
                        </span>
                        <span className="text-lg font-semibold text-foreground">{formatCurrency(PLAN_PRICES[choice.plan][period])}</span>
                        {/* Q12: ngày quy đổi D7 không cộng vào N, chỉ hiện ở Đơn hàng. */}
                        <span className="text-xs text-slate-500">
                          {t("plan_max_months").replace("{n}", String(PERIOD_MONTHS[period] + b))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <aside
              data-testid="purchase-summary"
              className="min-w-0 space-y-3 rounded-xl bg-slate-50 p-4 md:sticky md:top-0 md:self-start"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("plan_order_summary")}</p>
              <div className="flex items-start justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {PLAN_LABEL[choice.plan]} · {t(PERIOD_KEY[choice.period])}
                </span>
                <span className="shrink-0">{formatCurrency(price)}</span>
              </div>
              {bonus > 0 && <p className="text-sm font-medium text-primary">{t("plan_bonus_months").replace("{n}", String(bonus))}</p>}
              {credit && credit.creditDays > 0 && (
                <p className="text-sm text-slate-600">
                  {t("plan_upgrade_credit")
                    .replace("{amount}", formatCurrency(credit.remainingValue))
                    .replace("{days}", String(credit.creditDays))}
                </p>
              )}
              <p className="text-sm text-slate-600">{t("plan_new_expiry").replace("{date}", formatValidUntil(newExpiry))}</p>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-sm text-slate-600">{t("plan_total")}</p>
                <p className="text-2xl font-semibold text-foreground">{formatCurrency(price)}</p>
              </div>
              {/* D14: server tự hủy đơn chờ cũ khi tạo đơn mới. */}
              {me.pendingOrder && <p className="text-xs font-medium text-amber-800">{t("plan_replace_pending")}</p>}
              {!me.paymentReady && <p className="text-sm text-slate-500">{t("plan_payment_not_ready")}</p>}
              <Button
                type="button"
                className="h-12 w-full"
                disabled={!me.paymentReady || create.isPending}
                onClick={() => create.mutate(choice)}
              >
                {t("plan_create_order_short")}
              </Button>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

Run: `pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx`
Expected: PASS 7 test.

- [ ] **Step 7: Trang `/plan` dùng popup + `?buy=1`; `RenewOffer`**

Thay toàn bộ `src/app/(app)/plan/page.tsx`:
```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/common/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PlanCompare } from "@/components/plan/PlanCompare"
import { PlanPurchaseDialog } from "@/components/plan/PlanPurchaseDialog"
import { PendingOrderCard } from "@/components/plan/PendingOrderCard"
import { isPeriod, orderBlockedUntil, planLabel, type PaidPlan } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"
import { formatCurrency } from "@/lib/utils"

const STATUS_KEY = {
  pending: "plan_pending",
  approved: "plan_status_approved",
  rejected: "plan_status_rejected",
  cancelled: "plan_status_cancelled",
} as const

export default function PlanPage() {
  const { t } = useTranslation()
  const { me, fields } = usePlan()
  const router = useRouter()
  // Không đặt tên biến là "searchParams": tests/unit/next15-contract.test.ts cấm định danh đó trong page.tsx.
  const query = useSearchParams()
  const wantsBuy = query.get("buy") === "1"
  const loaded = me !== undefined
  const [purchasePlan, setPurchasePlan] = useState<PaidPlan | null>(null)

  useEffect(() => {
    // Q15: "Gia hạn ngay" dẫn tới /plan?buy=1 → tự mở popup Pro (kỳ Năm), bỏ param để tải lại không mở lại.
    if (!wantsBuy || !loaded) return
    setPurchasePlan("pro")
    router.replace("/plan")
  }, [wantsBuy, loaded, router])

  if (!me || !fields) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={t("my_plan")} />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const plusBlocked = orderBlockedUntil(fields, "plus", new Date()) !== null
  const periodText = (p: string | null) =>
    !isPeriod(p) ? t("plan_order_by_admin") : p === "2year" ? t("plan_period_2year") : p === "month" ? t("month") : t("year")

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("my_plan")} />

      {me.pendingOrder && <PendingOrderCard order={me.pendingOrder} paymentReady={me.paymentReady} />}

      <PlanCompare me={me} plusBlocked={plusBlocked} onChoose={setPurchasePlan} />

      <section data-testid="plan-history" className="space-y-2 rounded-xl border bg-white p-4 md:p-6">
        <h2 className="text-base font-semibold text-foreground">{t("plan_history")}</h2>
        {me.orders.length === 0 ? (
          <p className="text-sm text-slate-500">{t("plan_no_orders")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {me.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="text-slate-500">{formatVnDate(new Date(o.createdAt))}</span>
                <span className="font-medium text-foreground">
                  {planLabel(o.plan)} · {periodText(o.period)}
                </span>
                <span className="text-slate-600">{formatCurrency(o.amount)}</span>
                <span className="ml-auto text-slate-600">
                  {o.status in STATUS_KEY ? t(STATUS_KEY[o.status as keyof typeof STATUS_KEY]) : o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mount mỗi lần mở để lựa chọn về gói vừa bấm + kỳ Năm (P11). */}
      {purchasePlan && (
        <PlanPurchaseDialog
          open
          onOpenChange={(open) => {
            if (!open) setPurchasePlan(null)
          }}
          me={me}
          fields={fields}
          initialPlan={purchasePlan}
        />
      )}
    </div>
  )
}
```

`src/components/plan/RenewOffer.tsx`: trong nút "Gia hạn ngay" đổi `<Link href="/plan" onClick={() => setOpen(false)}>` thành:
```tsx
              <Link href="/plan?buy=1" onClick={() => setOpen(false)}>
```

- [ ] **Step 8: Xóa `PlanCheckout` và key cũ**

```bash
git rm src/components/plan/PlanCheckout.tsx
```
Trong `vi.json` và `en.json` xóa 3 dòng `"plan_upgrade_title": …`, `"plan_amount": …`, `"plan_create_order": …` (giữ `plan_create_order_short`, `plan_order_created`).
Run:
```bash
grep -rn "PlanCheckout\|plan-checkout\|plan_upgrade_title\|plan_amount\|\"plan_create_order\"\|t(\"plan_create_order\")" src tests
```
Expected: chỉ còn các dòng trong `tests/e2e/*.spec.ts` sẽ sửa ở Step 9 (`plan.spec.ts`, `admin.spec.ts`); `src/` không còn gì.

- [ ] **Step 9: Sửa e2e**

`tests/e2e/plan.spec.ts`:
1. Thêm hằng dưới `const db = new PrismaClient();`:
```ts
const CODE_RE = /SM [ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}/;
```
2. Test mobile: đổi tên thành `'Standard: vào từ sheet Thêm, thẻ Pro đứng đầu, popup chọn sẵn Pro + 12 tháng, tạo mã Plus năm trong popup rồi hủy'`. Giữ nguyên phần từ đầu tới hết dòng `await expect(page.getByTestId('plan-card-pro')).toContainText('Không giới hạn học sinh');`. Thay toàn bộ phần còn lại của test (từ `const checkout = page.getByTestId('plan-checkout');` tới trước `});` đóng test) bằng:
```ts
    await expect(page.getByTestId('plan-checkout')).toHaveCount(0);

    await page.getByTestId('plan-card-pro').getByRole('button', { name: 'Chọn gói Pro' }).click();
    const popup = page.getByTestId('plan-purchase');
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId('purchase-plan-pro')).toHaveAttribute('aria-checked', 'true');
    await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
    const summary = popup.getByTestId('purchase-summary');
    await expect(summary).toContainText('990.000');

    await popup.getByTestId('purchase-plan-plus').click();
    await expect(summary).toContainText('490.000');
    await popup.getByTestId('purchase-period-2year').click();
    await expect(summary).toContainText('980.000');
    await expect(summary).toContainText('Tặng 2 tháng');
    await expect(popup.getByTestId('purchase-period-2year')).toContainText('Tối đa 26 tháng');
    await popup.getByTestId('purchase-period-year').click();
    await expect(summary).toContainText('490.000');

    // Mobile: toàn màn hình, panel Đơn hàng xếp dưới cột chọn kỳ.
    const popupBox = (await popup.boundingBox())!;
    expect(popupBox.width).toBeGreaterThanOrEqual(389);
    expect((await summary.boundingBox())!.y).toBeGreaterThan((await popup.getByTestId('purchase-period-2year').boundingBox())!.y);

    const allButtonsTall = async () => {
      for (const b of await popup.getByRole('button').all()) {
        expect((await b.boundingBox())!.height, (await b.textContent()) ?? '').toBeGreaterThanOrEqual(44);
      }
    };
    const noOverflow = async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    };
    await allButtonsTall();
    await noOverflow();

    await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
    const pending = popup.getByTestId('pending-order');
    await expect(pending).toBeVisible();
    await expect(pending).toContainText('Chờ xác nhận');
    await expect(pending).toContainText(CODE_RE);
    await expect(pending).toContainText('490.000');
    await expect(pending.getByRole('img', { name: 'VietQR' })).toBeVisible();
    await allButtonsTall();
    await noOverflow();

    await popup.getByRole('button', { name: 'Xong' }).click();
    await expect(popup).toBeHidden();
    const pagePending = page.getByTestId('pending-order');
    await expect(pagePending).toBeVisible();
    await pagePending.getByRole('button', { name: 'Hủy yêu cầu' }).click();
    await expect(pagePending).toBeHidden();
    await expect(page.getByTestId('plan-history')).toContainText('Đã hủy');
```
3. Test desktop: đổi tên thành `'desktop: Standard trái, Pro phải, 3 thẻ cao bằng nhau; Chọn gói Plus mở popup chọn sẵn Plus, Đơn hàng bên phải'`; thay 2 dòng cuối (bấm "Chọn gói Plus" + `expect(... plan-checkout ...)`) bằng:
```ts
    await page.getByTestId('plan-card-plus').getByRole('button', { name: 'Chọn gói Plus' }).click();
    const popup = page.getByTestId('plan-purchase');
    await expect(popup.getByTestId('purchase-plan-plus')).toHaveAttribute('aria-checked', 'true');
    await expect(popup.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
    const plusBox = (await popup.getByTestId('purchase-plan-plus').boundingBox())!;
    const proBox = (await popup.getByTestId('purchase-plan-pro').boundingBox())!;
    const summaryBox = (await popup.getByTestId('purchase-summary').boundingBox())!;
    expect(plusBox.x).toBeLessThan(proBox.x);
    expect(summaryBox.x).toBeGreaterThan(proBox.x + proBox.width - 1);
```

`tests/e2e/renew-offer.spec.ts`, test `'Plus còn 45 ngày…'`: thay 3 dòng
```ts
  await dialog.getByRole('link', { name: 'Gia hạn ngay' }).click();
  await expect(page).toHaveURL(/\/plan/);
  await expect(dialog).toBeHidden();
```
bằng:
```ts
  await dialog.getByRole('link', { name: 'Gia hạn ngay' }).click();
  // Q15: /plan?buy=1 tự mở popup Pro + 12 tháng rồi bỏ param.
  const purchase = page.getByTestId('plan-purchase');
  await expect(purchase).toBeVisible();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(purchase.getByTestId('purchase-plan-pro')).toHaveAttribute('aria-checked', 'true');
  await expect(purchase.getByTestId('purchase-period-year')).toHaveAttribute('aria-checked', 'true');
  await expect(dialog).toBeHidden();
```

`tests/e2e/admin.spec.ts`, test đầu tiên: thay 7 dòng
```ts
  await std.goto('/plan');
  const checkout = std.getByTestId('plan-checkout');
  await checkout.getByRole('button', { name: 'Plus', exact: true }).click();
  await checkout.getByRole('button', { name: 'Tháng', exact: true }).click();
  await checkout.getByRole('button', { name: 'Tạo mã chuyển khoản' }).click();
  const pending = std.getByTestId('pending-order');
  await expect(pending).toBeVisible();
```
bằng:
```ts
  await std.goto('/plan');
  await std.getByTestId('plan-card-plus').getByRole('button', { name: 'Chọn gói Plus' }).click();
  const popup = std.getByTestId('plan-purchase');
  await popup.getByTestId('purchase-period-month').click();
  await popup.getByRole('button', { name: 'Tạo đơn', exact: true }).click();
  const pending = popup.getByTestId('pending-order');
  await expect(pending).toBeVisible();
```

Run:
```bash
grep -rn "plan-checkout\|Tạo mã chuyển khoản" tests
```
Expected: chỉ còn dòng `toHaveCount(0)` của `plan-checkout` trong `plan.spec.ts`.

- [ ] **Step 10: Chạy test**

Run:
```bash
pnpm test tests/unit/components/PlanPurchaseDialog.test.tsx
pnpm test tests/unit/components/PlanCompare.test.tsx
pnpm test tests/unit/next15-contract.test.ts
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/plan.spec.ts tests/e2e/renew-offer.spec.ts tests/e2e/admin.spec.ts
```
Expected: 4 lệnh `pnpm test` PASS; e2e toàn bộ passed (`plan.spec` 2, `renew-offer.spec` 4, `admin.spec` 5). Nút đóng popup < 44px → kiểm class `[&>button]:size-11` trên `DialogContent`.

- [ ] **Step 11: tsc + lint + build nhanh trang `/plan`**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm exec next build
```
Expected: sạch; build thành công. Nếu build báo `useSearchParams() should be wrapped in a suspense boundary at page "/plan"`: đổi tên hàm hiện tại thành `function PlanPageInner()` (bỏ `export default`), thêm `import { Suspense } from "react"` (gộp vào import `react` sẵn có) và cuối file:
```tsx
// Next 15 cần Suspense quanh useSearchParams khi trang được prerender.
export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanPageInner />
    </Suspense>
  )
}
```
rồi chạy lại `pnpm exec next build` + e2e `plan.spec.ts`.

- [ ] **Step 12: Commit**

```bash
git add src/components/plan/PlanPurchaseDialog.tsx src/components/plan/PendingOrderCard.tsx src/components/plan/RenewOffer.tsx "src/app/(app)/plan/page.tsx" src/language/vi.json src/language/en.json tests/unit/components/PlanPurchaseDialog.test.tsx tests/e2e/plan.spec.ts tests/e2e/renew-offer.spec.ts tests/e2e/admin.spec.ts
```
(`PlanCheckout.tsx` đã được `git rm` stage ở Step 8, không `git add` lại.)
```bash
git commit -m "feat(j): popup mua gói - chọn gói/thời hạn/Đơn hàng, VietQR trong popup, ?buy=1 từ Gia hạn ngay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: Nhãn gói cạnh logo `CurrentPlanBadge`

**Đọc trước:** Global Constraints; mục "Điều chỉnh so với spec" 9; spec mục 3 (J4), 4 (Q16, Q17), 6.5; `src/components/layout/AppSidebar.tsx` (khối logo); `src/hooks/usePlan.ts`; `src/components/plan/PlanBadge.tsx` (KHÔNG sửa); `tests/unit/components/AppSidebar.test.tsx`; `tests/e2e/plan.spec.ts` (bản Task 5, hàm `login`, `resetStd`).

**Files:**
- Create: `src/components/plan/CurrentPlanBadge.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/components/CurrentPlanBadge.test.tsx`
- Test (Sửa): `tests/unit/components/AppSidebar.test.tsx`, `tests/e2e/plan.spec.ts`

**Interfaces:**
- Consumes: `usePlan()` → `{ me }` với `me.plan: Plan`, `me.source: "paid" | "trial" | "free"`; `PLAN_LABEL`.
- Produces: `CurrentPlanBadge()` — `null` khi `!me`; `<span data-testid="current-plan-badge">` chữ `PLAN_LABEL[me.plan]`; trial: icon `Clock` + `title`/`aria-label` "Pro dùng thử". Key mới `plan_badge_trial`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Thêm key**

`vi.json`: ngay sau dòng `"plan_done": "Xong",` thêm `  "plan_badge_trial": "Pro dùng thử",`.
`en.json`: ngay sau dòng `"plan_done": "Done",` thêm `  "plan_badge_trial": "Pro trial",`.

- [ ] **Step 3: Viết unit test (RED)**

Tạo `tests/unit/components/CurrentPlanBadge.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CurrentPlanBadge } from "@/components/plan/CurrentPlanBadge"

const mockPlan = vi.hoisted(() => ({ me: undefined as undefined | { plan: string; source: string } }))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: mockPlan.me, ready: mockPlan.me !== undefined, fields: null, has: () => true }),
}))

beforeEach(() => {
  mockPlan.me = undefined
})

function renderBadge() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <CurrentPlanBadge />
    </LanguageProvider>
  )
  return screen.queryByTestId("current-plan-badge")
}

describe("CurrentPlanBadge", () => {
  it("chưa tải gói → không render", () => {
    expect(renderBadge()).toBeNull()
  })

  it("Standard: viền + chữ slate, không aria-label", () => {
    mockPlan.me = { plan: "standard", source: "free" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Standard")
    expect(badge.className).toContain("border-slate-300")
    expect(badge.className).toContain("text-slate-600")
    expect(badge.getAttribute("aria-label")).toBeNull()
  })

  it("Plus: viền + chữ primary nền trắng", () => {
    mockPlan.me = { plan: "plus", source: "paid" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Plus")
    expect(badge.className).toContain("border-primary")
    expect(badge.className).toContain("bg-white")
    expect(badge.className).toContain("text-primary")
  })

  it("Pro trả phí: nền primary chữ trắng, không icon", () => {
    mockPlan.me = { plan: "pro", source: "paid" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Pro")
    expect(badge.className).toContain("bg-primary")
    expect(badge.className).toContain("text-primary-foreground")
    expect(badge.querySelector("svg")).toBeNull()
  })

  it("Pro dùng thử: icon đồng hồ + aria-label/title Pro dùng thử", () => {
    mockPlan.me = { plan: "pro", source: "trial" }
    const badge = renderBadge()!
    expect(badge.textContent).toBe("Pro")
    expect(badge.querySelector("svg")).not.toBeNull()
    expect(badge.getAttribute("aria-label")).toBe("Pro dùng thử")
    expect(badge.getAttribute("title")).toBe("Pro dùng thử")
  })
})
```

Trong `tests/unit/components/AppSidebar.test.tsx`:
- Đổi `const mockPlan = vi.hoisted(() => ({ allow: true }))` thành:
```tsx
const mockPlan = vi.hoisted(() => ({ allow: true, me: undefined as undefined | { plan: string; source: string } }))
```
- Trong `vi.mock("@/hooks/usePlan", …)` đổi `me: undefined` thành `me: mockPlan.me`.
- Trong `beforeEach` thêm `mockPlan.me = undefined`.
- Thêm test cuối `describe`:
```tsx
  it("nhãn gói hiệu lực nằm ngay sau chữ Lịch dạy ở logo", () => {
    mockPlan.me = { plan: "plus", source: "paid" }
    render(
      <LanguageProvider forcedLanguage="vi">
        <AppSidebar />
      </LanguageProvider>
    )
    const badge = screen.getByTestId("current-plan-badge")
    expect(badge.textContent).toBe("Plus")
    expect(badge.previousElementSibling?.textContent).toBe("Lịch dạy")
  })
```

- [ ] **Step 4: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/components/CurrentPlanBadge.test.tsx`
Expected: FAIL — không resolve được `@/components/plan/CurrentPlanBadge`.
Run: `pnpm test tests/unit/components/AppSidebar.test.tsx`
Expected: 2 test cũ PASS, test mới FAIL (không có `current-plan-badge`).

- [ ] **Step 5: Cài `CurrentPlanBadge` + gắn vào sidebar**

`src/components/plan/CurrentPlanBadge.tsx`:
```tsx
"use client"

import { Clock } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PLAN_LABEL, type Plan } from "@/lib/plans"
import { cn } from "@/lib/utils"

// J4: Standard trung tính; Pro có viền cùng màu nền để cao bằng 2 kiểu có viền.
const STYLE: Record<Plan, string> = {
  standard: "border-slate-300 bg-white text-slate-600",
  plus: "border-primary bg-white text-primary",
  pro: "border-primary bg-primary text-primary-foreground",
}

export function CurrentPlanBadge() {
  const { t } = useTranslation()
  const { me } = usePlan()
  if (!me) return null
  // Q16: sidebar 232px không đủ chỗ cho "Pro · Dùng thử" → icon đồng hồ + nhãn đọc màn hình.
  const trialLabel = me.source === "trial" ? t("plan_badge_trial") : undefined
  return (
    <span
      data-testid="current-plan-badge"
      title={trialLabel}
      aria-label={trialLabel}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 text-[10px] font-semibold leading-4",
        STYLE[me.plan]
      )}
    >
      {trialLabel && <Clock aria-hidden className="size-3" />}
      {PLAN_LABEL[me.plan]}
    </span>
  )
}
```

`src/components/layout/AppSidebar.tsx`: thêm `import { CurrentPlanBadge } from "@/components/plan/CurrentPlanBadge"` vào nhóm import; trong khối logo, ngay sau dòng `<span className="text-base font-semibold text-foreground">{t("calendar")}</span>` thêm:
```tsx
        <CurrentPlanBadge />
```
(Header mobile không thêm nhãn — Q17.)

- [ ] **Step 6: Chạy unit, xác nhận pass**

Run:
```bash
pnpm test tests/unit/components/CurrentPlanBadge.test.tsx
pnpm test tests/unit/components/AppSidebar.test.tsx
pnpm test tests/unit/theme-legacy-colors.test.ts
```
Expected: PASS cả 3 (5 + 3 test + theme).

- [ ] **Step 7: E2E nhãn gói**

Thêm vào CUỐI `tests/e2e/plan.spec.ts`:
```ts
test.describe('Nhãn gói cạnh logo (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('teacher_std: Standard; khi dùng thử: Pro + aria-label Pro dùng thử; teacher: Pro', async ({ page, browser }) => {
    await login(page, 'teacher_std');
    const badge = page.locator('aside').getByTestId('current-plan-badge');
    await expect(badge).toHaveText('Standard');

    await db.user.update({ where: { username: 'teacher_std' }, data: { trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) } });
    await page.reload();
    await expect(badge).toHaveText('Pro');
    await expect(badge).toHaveAttribute('aria-label', 'Pro dùng thử');
    await resetStd();

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const other = await context.newPage();
    await login(other, 'teacher');
    await expect(other.locator('aside').getByTestId('current-plan-badge')).toHaveText('Pro');
    await context.close();
  });
});
```

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/plan.spec.ts tests/e2e/layout-desktop.spec.ts
```
Expected: lệnh 1 PASS; lệnh 2 toàn bộ passed (`plan.spec` 3 test).

- [ ] **Step 8: tsc + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: không lỗi.

- [ ] **Step 9: Commit**

```bash
git add src/components/plan/CurrentPlanBadge.tsx src/components/layout/AppSidebar.tsx src/language/vi.json src/language/en.json tests/unit/components/CurrentPlanBadge.test.tsx tests/unit/components/AppSidebar.test.tsx tests/e2e/plan.spec.ts
git commit -m "feat(j): nhãn gói hiệu lực cạnh logo Lịch dạy ở sidebar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 7: Kiểm chứng cuối + kiểm tra tay cho người dùng

**Đọc trước:** Global Constraints; spec mục 2 (tiêu chí hoàn thành), 10 (Chung), 11; `docs/coding-rule.md` §6.1. Xác nhận đang ở nhánh `feat/j-admin-rieng` và `git log --oneline main..HEAD` có 7 commit (docs + Task 1–6).

**Files:** không sửa code (chỉ sửa nếu kiểm chứng lộ lỗi; mỗi sửa phải có test tái hiện trước, commit riêng với message `fix(j): …`).

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
grep -rnE "AdminPanel|PlanCheckout|admin-link|admin_link|plan_current|plan_upgrade_title|plan_amount|\"plan_create_order\"|plan_students_usage|plan_students_unlimited|\"admin_accounts\"" src tests
grep -rnE "['\"](current-plan|plan-checkout)['\"]" src tests
grep -rn "indigo-\|violet-\|purple-" src/components/admin src/components/plan "src/app/(admin)" "src/app/(app)/plan"
grep -rnP "[—–]" src/components/admin src/components/plan/PlanPurchaseDialog.tsx src/components/plan/CurrentPlanBadge.tsx "src/app/(admin)"
git diff main..HEAD -- src/language | grep -P "^\+.*[—–]"
node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(JSON.stringify([a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k))]))"
git diff --stat main..HEAD -- prisma/
ls "src/app/(app)/admin" 2>&1
```
Expected: lệnh 1 không in gì; lệnh 2 chỉ in các dòng `toHaveCount(0)` trong `tests/e2e/plan.spec.ts` / `admin.spec.ts`; lệnh 3, 4, 5 không in gì; lệnh 6 in `[[],[]]`; lệnh 7 không in gì (không migration); lệnh 8 báo không tồn tại.

- [ ] **Step 3: Toàn bộ unit + integration**

Run: `pnpm test` (~10–15 phút, không chạy song song lệnh test khác)
Expected: toàn bộ PASS, gồm `theme-legacy-colors`, `next15-contract`, `auth-authorized`, `middleware-matcher`, `admin-redirect`, `admin` (unit + integration), `plan-orders`, `PlanPurchaseDialog`, `PlanCompare`, `CurrentPlanBadge`, `AdminNav`, `AppHeader`, `AppSidebar`.

- [ ] **Step 4: E2E toàn bộ**

Run: `pnpm exec playwright test`
Expected: tất cả passed (`upgrade-class` có thể `skipped` nếu DB test đã nâng lớp năm nay — chấp nhận). File nào fail: chạy lại riêng file đó 1 lần để loại chập chờn; vẫn fail → sửa theo quy tắc ở mục Files, ghi vào báo cáo. Riêng `plan-locks.spec.ts` phải pass mà không sửa (không dùng `current-plan`/`plan-checkout`).

- [ ] **Step 5: Lint + tsc + build**

Run:
```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec next build
```
Expected: sạch; build thành công, danh sách route có `/admin`, `/admin/orders`, `/admin/accounts`, `/admin/history`, `/plan`, không còn route admin trong nhóm `(app)`. KHÔNG chạy `pnpm build`.

- [ ] **Step 6: Báo cáo cho người điều phối (không merge, không push)**

Gồm: kết quả Step 2–5, `git log --oneline main..HEAD`, mọi chỗ code lệch plan (kèm lý do), và danh sách kiểm tra tay ở Step 7.

- [ ] **Step 7: Kiểm tra tay cho người dùng (sau khi merge + Vercel deploy; agent KHÔNG làm)**

1. **Env:** Vercel Production đã có `ADMIN_USERNAMES` (từ I). Middleware Edge đọc env lúc chạy; đổi env phải redeploy. Không có migration: log build không có dòng `Applying migration`.
2. **Tài khoản admin (người dùng tự đăng nhập, vd `hien_admin`):** đăng nhập → vào thẳng `/admin/orders`; gõ `/dashboard`, `/plan`, `/students`, `/` → về `/admin/orders`; sidebar desktop 3 mục + nhãn "Quản trị", không có Tổng quan/Học phí; mobile có tab bar 3 tab; menu avatar chỉ có Quản trị, Đổi mật khẩu, Đăng xuất; không có nút "Gia hạn"; màn Lịch sử đơn thấy 2 đơn "Chủ app đặt" của đợt ra mắt I; Tài khoản & gói vẫn "Đặt gói" được (chỉ bấm khi thật sự cần).
3. **Tài khoản `qa_test` (id 4, người dùng tự đăng nhập):** `/admin`, `/admin/orders` → 404; sidebar desktop có nhãn "Pro" cạnh "Lịch dạy"; `/plan` desktop 3 thẻ cao bằng nhau, nút Chọn gói Plus/Pro cùng mép dưới; thẻ Pro có "Đang dùng", "Dùng đến hết ngày …", "Đang có … học sinh đang học"; không còn thẻ "Gói hiện tại" và khối "Nâng cấp hoặc gia hạn"; bấm "Chọn gói Pro" → popup chọn sẵn Pro + 12 tháng, đổi gói/kỳ thấy tiền đổi đúng; trên điện thoại popup toàn màn hình, không kéo ngang được, nút X bấm dễ. **Không bấm "Tạo đơn"** nếu không định chuyển tiền thật (lỡ bấm thì "Hủy yêu cầu").
4. Đăng xuất rồi đăng nhập lại cả 2 tài khoản trên 1 trình duyệt: không bị kẹt vòng chuyển trang.

---

## Self-Review (người viết plan đã chạy)

- **Phủ spec:** mục 2 (T2, T3, T4, T5, T6, T7), Q1–Q2 (T1, T2), Q3–Q6 (T3), Q7–Q8 (T2), Q9 (T2), Q10–Q13 (T5), Q14 (T4), Q15 (T5), Q16–Q17 (T6), Q18 (T1 kiểm `plan-orders`, T4 bỏ `admin-link`), 6.1 (T2), 6.2 (T2), 6.3 (T4, T5), 6.4 (T5), 6.5 (T6), 7 (T1, T3), 8 (không migration, T7 kiểm), 9 (T2, T4, T5, T6; `plan_credit_recalc` bỏ có lý do), 10 (unit/integration/e2e từng task), 11 (Review Focus 1–2, T3).
- **Placeholder:** không có TBD/TODO; mọi bước code có code đầy đủ; bước điều kiện (ResizeObserver, Suspense) có code sẵn.
- **Nhất quán tên:** `isAdminUsername`, `getOrderHistory`, `admin.orderHistory`, `ADMIN_NAV_ITEMS` (`labelKey`, `shortKey`), `periodKey`, `dateOrDash`, `SOURCE_KEY`, `PlanChoice`, `PlanPurchaseDialog` props, `onCancelled`, test id `plan-purchase`/`purchase-plan-*`/`purchase-period-*`/`purchase-summary`/`admin-history-card`/`admin-pending-count`/`current-plan-badge` dùng giống nhau ở mọi task.
