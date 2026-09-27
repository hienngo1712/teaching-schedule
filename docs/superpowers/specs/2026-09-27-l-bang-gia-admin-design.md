# L — Màn Bảng giá cho admin (giá Plus/Pro đổi được, lưu lịch sử)

> Phần L, làm sau J (spec `2026-09-27-j-admin-rieng-va-popup-mua-goi-design.md`, đã live ở main `00eace1`). Nghiệp vụ gói theo I (`2026-09-26-i-phan-goi-design.md`). Có **1 migration** (thêm bảng, không destructive). **Không** đổi kỳ, ưu đãi tặng tháng, luật D6/D7/D14, luồng duyệt đơn.

## 1. Bối cảnh

Hiện trạng (đã đọc code):

- Giá viết cứng ở `src/lib/plans.ts`: `PLAN_PRICES = { plus: { month: 49000, year: 490000, "2year": 980000 }, pro: { month: 99000, year: 990000, "2year": 1980000 } }`. Ghi chú của `PERIOD_DAYS` nhắc "99.000/30, 990.000/365".
- Chỗ dùng `PLAN_PRICES` (grep toàn `src/`):
  - `src/server/services/plan.service.ts` → `createOrder`: `const amount = PLAN_PRICES[input.plan][input.period]`, tính **ngoài** transaction (trước `pg_advisory_xact_lock(userId)`), rồi ghi vào `plan_orders.amount`.
  - `src/lib/plans.ts` → `computeUpgradeCredit(u, lastPlusOrder, targetPeriod, now)`: `remainingValue` tính theo `lastPlusOrder.amount` (**tiền đã trả** của đơn Plus duyệt gần nhất, `findLastPlusOrder`), nhưng `creditDays = floor(remainingValue × PERIOD_DAYS[targetPeriod] / PLAN_PRICES.pro[targetPeriod])` dùng **giá Pro hiện hành**.
  - `computeUpgradeCredit` được gọi ở server trong `computeApproval` (`plan-admin.service.ts`) **lúc admin duyệt** (cả khi dựng `preview` trong `getAdminOverview`), và ở client trong `PlanPurchaseDialog` (xem trước).
  - `src/components/plan/PlanPurchaseDialog.tsx`: giá tháng trên thẻ gói (dòng 139), giá từng kỳ (194), `price` cho panel Đơn hàng/Tổng tiền (76, 215, 228).
  - `src/components/plan/PlanCompare.tsx`: giá tháng/năm/2 năm của thẻ Plus, Pro (73, 77, 81).
  - `src/lib/schemas/plan.ts`: **chỉ là ghi chú** ("tiền lấy từ PLAN_PRICES ở server"), không dùng hằng số.
  - `tests/unit/lib/plans.test.ts` kiểm `PLAN_PRICES` và các ví dụ `computeUpgradeCredit`.
- **Không** in giá: `RenewOffer.tsx` (chỉ số tháng tặng), `UpgradeDialog.tsx`, `PlanBanner.tsx`, `LockBadge.tsx`, `vi.json`/`en.json` (không có chuỗi chứa số tiền gói). Các chỗ `formatCurrency(o.amount)` (`plan/page.tsx` lịch sử đơn, `PendingOrderCard`, `AdminPendingOrders`, `AdminOrderHistory`) in `amount` **đã lưu trong đơn** → không bị ảnh hưởng khi đổi giá.
- `computeBonusMonths` và `renewOffer` không dùng giá. Nhãn "Tiết kiệm 2 tháng" (`plan_save_2_months`) và "Tặng 2 tháng" (`TWO_YEAR_BONUS_MONTHS`) đúng miễn giá năm = tháng × 10, 2 năm = tháng × 20.
- Khu quản trị (J): `src/app/(admin)/admin/{orders,accounts,history}/page.tsx`, nav trong `src/components/admin/admin-nav.ts` (`ADMIN_NAV_ITEMS`, mỗi mục `href`, `labelKey`, `shortKey`, `icon`), `AdminSidebar`, `AdminTabBar` (`grid-cols-3`). Router `src/server/trpc/routers/admin.ts` dùng `adminProcedure`; tên admin lấy `ctx.session.user.username` (như `decidedBy`).
- `plan.me` (`getMyPlan`) là query client dùng chung qua `usePlan()` (`staleTime` 60 s ở `TRPCProvider`); `MutationCache` tự invalidate sau mutation. tRPC **không có transformer**: `Date` về client là chuỗi ISO.
- Test: `tests/setup.ts` xóa `planOrder`, `user`… trước khi seed, **không** biết bảng mới; build Vercel chạy `prisma migrate deploy`.

## 2. Mục tiêu và tiêu chí hoàn thành

- Admin có màn **Bảng giá** `/admin/prices` (mục thứ 4 trong sidebar và tab bar): sửa giá tháng Plus và Pro; giá năm/2 năm tự tính (×10, ×20) và hiện xem trước khi đang gõ; bấm Lưu → AlertDialog nêu giá cũ → mới của cả 3 kỳ → Xác nhận → có hiệu lực ngay.
- Có lịch sử đổi giá (ai, lúc nào, gói, giá tháng cũ → mới) hiện trên cùng màn.
- `/plan` (`PlanCompare`) và popup mua gói hiện giá mới ngay lần tải/refetch kế tiếp; `plan.createOrder` tính `amount` theo giá trong DB.
- Đơn **đang chờ** giữ nguyên `amount` và QR; đơn đã duyệt không đổi; quy đổi Plus→Pro vẫn tính theo tiền đã trả của đơn Plus.
- Giáo viên đang mở popup lúc admin đổi giá: bấm Tạo đơn → không tạo đơn với giá khác giá đang thấy; thấy thông báo "Giá gói vừa thay đổi" và giá mới.
- Giáo viên gọi `admin.prices` / `admin.updatePrices` → `FORBIDDEN`.
- Mobile 390px không tràn ngang; nút ≥44px. `pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch; `theme-legacy-colors` pass.

## 3. Quyết định đã chốt (người dùng)

| # | Nội dung |
|---|---|
| L1 | Admin sửa **giá tháng** Plus và Pro. Giá năm = tháng × 10, giá 2 năm = tháng × 20, tự tính, không nhập tay. Xem trước giá năm/2 năm khi đang nhập |
| L2 | Hiệu lực **ngay khi bấm Lưu** |
| L3 | Lưu lịch sử đổi giá: ai đổi, lúc nào, gói, từ bao nhiêu → bao nhiêu; hiện trên màn Bảng giá |
| L4 | Đơn đang chờ giữ nguyên số tiền lúc tạo (QR không đổi). Người đã mua không bị ảnh hưởng |
| L5 | Giá sẽ đổi thường xuyên (tăng/giảm) → không làm lịch hẹn giờ, không làm "chương trình khuyến mãi" riêng; mỗi lần đổi là 1 lần Lưu |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| Q1 | Mô hình dữ liệu | **1 bảng lịch sử append-only** `plan_price_changes` (`id`, `plan`, `month_price`, `previous_month_price` nullable, `changed_by`, `created_at`). Giá hiện hành của 1 gói = dòng mới nhất (`created_at desc, id desc`) của gói đó. Không có bảng "giá hiện hành" riêng | 1 nguồn duy nhất, không thể lệch giữa "bảng giá" và "lịch sử"; ghi 1 lệnh INSERT; vài chục dòng/năm nên đọc bản mới nhất rẻ (có index). Lưu sẵn `previous_month_price` để màn lịch sử không phải tính LAG và vẫn đúng nếu sau này xóa bớt dòng cũ |
| Q2 | Chỉ lưu giá tháng hay cả 3 kỳ | Chỉ lưu `month_price`; năm/2 năm tính bằng `PERIOD_PRICE_FACTOR = { month: 1, year: 10, "2year": 20 }` | Đúng L1; không thể có dữ liệu giá năm lệch hệ số |
| Q3 | Dữ liệu ban đầu | Migration INSERT 2 dòng: `('plus', 49000, NULL, 'migration')`, `('pro', 99000, NULL, 'migration')` | Prod có giá ngay sau `migrate deploy`, trùng giá đang bán |
| Q4 | Thiếu dòng của 1 gói (DB dựng bằng `db push`, bảng bị xóa tay…) | **Fallback** về hằng số `DEFAULT_MONTH_PRICES = { plus: 49000, pro: 99000 }` trong `plans.ts` + `console.warn` 1 dòng | Không để `createOrder`/`/plan` vỡ 500 vì thiếu dữ liệu cấu hình; migration đã seed nên prod không đi nhánh này |
| Q5 | Nguồn giá cho client | Thêm field `prices: PlanPrices` (đủ 3 kỳ, đã nhân hệ số) vào output `plan.me`. `PlanCompare`, `PlanPurchaseDialog` đọc `me.prices` | Hai component đều đã có `me`; không thêm query/round-trip; cùng 1 hàm server tính giá nên xem trước khớp server |
| Q6 | Admin đổi giá khi giáo viên đang mở popup | `createOrderSchema` thêm `expectedAmount` (số nguyên dương, **optional**). Client luôn gửi `me.prices[plan][period]` đang hiển thị. Server tính `amount` từ DB; `expectedAmount` có và khác `amount` → `TRPCError CONFLICT` "Giá gói vừa thay đổi, vui lòng xem lại giá mới", **không** tạo đơn, **không** hủy đơn chờ cũ. Client bắt lỗi → toast + `utils.plan.me.invalidate()`, giữ popup ở bước chọn | Giáo viên không bao giờ nhận QR với số tiền khác số vừa thấy. `expectedAmount` chỉ để so, **không** dùng làm số tiền (giữ nguyên tắc I-6.4). Optional để tab còn JS cũ lúc deploy vẫn tạo đơn được (theo giá mới) thay vì lỗi validate |
| Q7 | Đọc giá trong `createOrder` ở đâu | Chuyển việc tính `amount` vào **trong** `db.$transaction`, **sau** `pg_advisory_xact_lock(userId)`, đọc bằng `tx` | Giá và việc tạo đơn cùng 1 transaction; đơn luôn mang giá đã commit tại thời điểm tạo (xem Q8) |
| Q8 | Race đổi giá vs tạo đơn | Chấp nhận thứ tự commit: transaction tạo đơn đọc giá trước khi lệnh INSERT giá commit → đơn giá cũ; đọc sau → giá mới (và nếu client gửi giá cũ thì Q6 trả CONFLICT). Không khóa chung giữa 2 luồng | READ COMMITTED đủ: "hiệu lực khi bấm Lưu" = lúc commit. Khóa toàn cục mỗi lần tạo đơn là thừa với vài chục tài khoản |
| Q9 | 2 admin (hoặc 2 tab) Lưu cùng lúc | `admin.updatePrices` nhận thêm `expected: { plus, pro }` (giá tháng admin đang thấy). Trong transaction: `pg_advisory_xact_lock(<hằng số>, 0)` (dạng 2 tham số int, **không trùng** không gian khóa 1 tham số bigint theo `userId` của `createOrder`/`approveOrder`), đọc giá hiện hành, khác `expected` → `CONFLICT` "Bảng giá vừa được đổi ở nơi khác, tải lại để xem" | Lịch sử luôn đúng chuỗi cũ → mới; không ghi đè im lặng |
| Q10 | Quy đổi Plus→Pro (D7) sau khi đổi giá | Đổi chữ ký `computeUpgradeCredit(u, lastPlusOrder, targetPeriod, targetPrice, now)`: `creditDays = floor(remainingValue × PERIOD_DAYS[targetPeriod] / targetPrice)`; `targetPrice ≤ 0` → 0 ngày. Server (`computeApproval`) truyền **`order.amount`** của đơn Pro đang duyệt; client truyền `me.prices.pro[period]` (bằng số sẽ ghi vào đơn) | Đúng chữ D7 ("đơn giá ngày của gói Pro **đang mua**"). `remainingValue` vốn đã theo tiền Plus đã trả → người đã mua không thiệt. Dùng `order.amount` thay giá hiện hành để đơn chờ duyệt không đổi số ngày quy đổi khi admin đổi giá giữa lúc tạo và lúc duyệt (khớp L4) |
| Q11 | `computeBonusMonths`, `renewOffer`, `TWO_YEAR_BONUS_MONTHS`, nhãn "Tiết kiệm 2 tháng" | Giữ nguyên | Không phụ thuộc giá; hệ số ×10 cố định nên "tiết kiệm 2 tháng" luôn đúng |
| Q12 | Giới hạn giá tháng | Số nguyên (đồng), **KHÔNG bắt buộc chẵn nghìn** (người dùng chốt 2026-09-27: cho giá lẻ kiểu 49.900 đánh vào tâm lý), **10.000 ≤ giá ≤ 1.000.000** | Chặn gõ nhầm thừa/thiếu số 0; ×20 tối đa 20.000.000 vẫn vừa `Int` và vừa hạn mức chuyển khoản thường |
| Q13 | Pro phải đắt hơn Plus? | **Có**: giá tháng Pro > giá tháng Plus (kiểm ở cả zod `refine` và server sau khi gộp giá cũ của gói không đổi) | D7 (quy đổi Plus → Pro, chặn đặt Plus khi còn Pro) giả định Pro cao cấp và đắt hơn; Pro rẻ hơn làm quy đổi cho ra nhiều ngày Pro hơn tiền đã trả |
| Q14 | Form gửi gì | Luôn gửi cả 2 giá `{ plus, pro }` + `expected`. Server chỉ INSERT dòng cho gói **có đổi**; không gói nào đổi → `BAD_REQUEST` "Giá chưa thay đổi" (client đã khóa nút Lưu trong trường hợp này) | 1 lần Lưu = 1 transaction; lịch sử không có dòng rác |
| Q15 | Lịch sử hiển thị | 50 dòng mới nhất, gồm cả 2 dòng seed (hiện "Giá ban đầu", người đổi "migration"). Chưa phân trang | Giá đổi vài lần/tháng; 50 dòng đủ vài năm |
| Q16 | Vị trí trong nav | Mục thứ 4 `ADMIN_NAV_ITEMS`: `{ href: "/admin/prices", labelKey: "admin_prices", shortKey: "admin_tab_prices", icon: Tags }`; `AdminTabBar` đổi `grid-cols-3` → `grid-cols-4` | 4 tab × ~97px ở 390px vẫn đủ chữ ngắn "Bảng giá" |
| Q17 | Đơn giá trên đơn Pro 0đ / đơn admin đặt tay | Không liên quan: `adminSetPlan` không qua `computeApproval`; đơn Plus 0đ (tặng) vẫn quy đổi 0 ngày như I | Giữ hành vi I |

## 5. Phạm vi

### Trong phạm vi
- Bảng `plan_price_changes` + migration có seed.
- `src/lib/plans.ts`: bỏ `PLAN_PRICES`; thêm `DEFAULT_MONTH_PRICES`, `PERIOD_PRICE_FACTOR`, type `PlanPrices`, `pricesFromMonthly()`; đổi chữ ký `computeUpgradeCredit`.
- Service MỚI `src/server/services/plan-price.service.ts`: đọc giá hiện hành, lịch sử, cập nhật giá.
- `createOrder` (đọc giá DB trong transaction, `expectedAmount`), `getMyPlan` (`prices`), `computeApproval`/`approveOrder`/`getAdminOverview` (truyền `order.amount`).
- Router admin: `prices`, `updatePrices`. Schema zod MỚI.
- UI: trang `/admin/prices`, component `AdminPrices.tsx`, nav 4 mục; `PlanCompare`, `PlanPurchaseDialog` đọc `me.prices` và xử lý CONFLICT.
- i18n vi/en; test unit/integration/e2e.

### Ngoài phạm vi (YAGNI)
- Hẹn giờ đổi giá, giá theo khoảng ngày, mã giảm giá, giá riêng từng tài khoản.
- Nhập tay giá năm/2 năm; đổi hệ số ×10/×20; đổi số tháng tặng.
- Sửa số tiền đơn đang chờ khi đổi giá (L4: giữ nguyên).
- Thông báo cho giáo viên khi giá đổi.
- Hoàn tác 1 lần đổi giá (muốn quay lại thì Lưu giá cũ, lịch sử ghi thêm dòng).

## 6. Dữ liệu / migration

### 6.1 Prisma (`prisma/schema.prisma`, model MỚI)

```prisma
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
```

Không FK tới `users` (giống `plan_orders.decided_by` lưu username dạng chuỗi): đổi/xóa tài khoản admin không làm mất lịch sử.

### 6.2 Migration

Thư mục MỚI `prisma/migrations/<timestamp>_add_plan_prices/migration.sql`, sinh bằng `pnpm db:migrate:dev` trên DB test local rồi **thêm tay** phần seed cuối file:

```sql
-- Giá đang bán lúc ra mắt màn Bảng giá (spec L Q3); dòng seed không có giá cũ.
INSERT INTO "plan_price_changes" ("plan", "month_price", "previous_month_price", "changed_by", "created_at")
VALUES ('plus', 49000, NULL, 'migration', now() AT TIME ZONE 'UTC'),
       ('pro',  99000, NULL, 'migration', now() AT TIME ZONE 'UTC');
```

Chỉ `CREATE TABLE` + `CREATE INDEX` + `INSERT`: không đụng bảng cũ, chạy lại trên DB rỗng vẫn đúng. `now() AT TIME ZONE 'UTC'` theo đúng cách migration `launch_plan_grants` ghi cột `DateTime` của Prisma.

### 6.3 Dữ liệu cũ

`plan_orders.amount` giữ nguyên, không backfill. Đơn chờ, đơn đã duyệt, lịch sử đơn không đổi.

## 7. Backend

### 7.1 `src/lib/plans.ts`

- Xóa `PLAN_PRICES`. Thêm:
  - `export type PlanPrices = Record<PaidPlan, Record<Period, number>>`
  - `export const DEFAULT_MONTH_PRICES: Record<PaidPlan, number> = { plus: 49000, pro: 99000 }` (ghi chú: chỉ dùng khi DB thiếu dòng giá, spec L Q4).
  - `export const PERIOD_PRICE_FACTOR: Record<Period, number> = { month: 1, year: 10, "2year": 20 }` (ghi chú: năm = 10 tháng nên nhãn "Tiết kiệm 2 tháng" đúng).
  - `export function pricesFromMonthly(m: Record<PaidPlan, number>): PlanPrices`.
- Sửa ghi chú `PERIOD_DAYS`: "đơn giá ngày = giá kỳ / số ngày" (bỏ số cụ thể).
- `computeUpgradeCredit(u, lastPlusOrder, targetPeriod, targetPrice, now)`: thêm điều kiện `targetPrice <= 0 → none`; mẫu số là `targetPrice`. Ghi chú: "targetPrice = số tiền của đơn Pro đang mua (server: order.amount), spec L Q10".

### 7.2 `src/server/services/plan-price.service.ts` (MỚI)

```ts
getMonthlyPrices(db: Db): Promise<Record<PaidPlan, number>>
getPlanPrices(db: Db): Promise<PlanPrices>            // pricesFromMonthly(await getMonthlyPrices(db))
getPriceHistory(db: Db): Promise<PriceChangeRow[]>   // 50 dòng, createdAt desc, id desc
updatePrices(db: PrismaClient, admin: string, input: UpdatePricesInput): Promise<{ changed: PaidPlan[] }>
```

- `getMonthlyPrices`: với mỗi gói `plus`, `pro`: `planPriceChange.findFirst({ where: { plan }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { monthPrice: true } })` (2 truy vấn song song qua `Promise.all`, dùng được với `tx`). Thiếu → `DEFAULT_MONTH_PRICES[plan]` + `console.warn("[plan-price] thiếu giá <plan>, dùng mặc định")`.
- `updatePrices` (trong `db.$transaction`):
  1. `SELECT pg_advisory_xact_lock(<PRICE_LOCK_CLASS>, 0)` — hằng số int 32-bit đặt tên trong file (vd `PRICE_LOCK_CLASS = 7401`), ghi chú: dạng 2 tham số không đụng khóa theo `userId`.
  2. `current = await getMonthlyPrices(tx)`; `current.plus !== input.expected.plus || current.pro !== input.expected.pro` → `CONFLICT` "Bảng giá vừa được đổi ở nơi khác, tải lại để xem".
  3. `changed = PAID_PLANS.filter(p => input.prices[p] !== current[p])`; rỗng → `BAD_REQUEST` "Giá chưa thay đổi".
  4. Kiểm lại Q13 trên giá sau cùng (`input.prices.pro > input.prices.plus`) → `BAD_REQUEST` "Giá Pro phải cao hơn giá Plus".
  5. `planPriceChange.createMany` cho từng gói trong `changed` với `previousMonthPrice = current[p]`, `changedBy = admin`.
  6. Sau transaction: `console.info("[admin] <admin> đổi giá plus 49000→59000, pro …")` (cùng kiểu log `approveOrder`).

### 7.3 `src/server/services/plan.service.ts`

- `createOrder`: bỏ dòng `const amount = PLAN_PRICES[...]` ngoài transaction. Trong callback transaction, **sau** `pg_advisory_xact_lock(userId)` và **trước** `updateMany` hủy đơn chờ:
  ```ts
  const amount = (await getPlanPrices(tx))[input.plan][input.period]
  if (input.expectedAmount !== undefined && input.expectedAmount !== amount) {
    throw new TRPCError({ code: "CONFLICT", message: "Giá gói vừa thay đổi, vui lòng xem lại giá mới" })
  }
  ```
  Ghi chú 1 dòng: "Đọc giá trong transaction: đơn mang giá đã commit lúc tạo (spec L Q7/Q8)". Vòng thử lại khi trùng mã giữ nguyên (lần thử 2 đọc lại giá, không sao).
- `getMyPlan`: thêm `getPlanPrices(db)` vào `Promise.all`, trả `prices`.

### 7.4 `src/server/services/plan-admin.service.ts`

- `computeApproval(db, order, now)`: kiểu `order` thêm `amount: number`; gọi `computeUpgradeCredit(user, lastPlus, order.period, order.amount, now)`.
- `approveOrder`: `findUniqueOrThrow` select thêm `amount: true`.
- `getAdminOverview`: select `pending` đã có `amount` → truyền thẳng, không đổi gì khác.

### 7.5 Schema zod (`src/lib/schemas/plan.ts`)

- `createOrderSchema` thêm `expectedAmount: z.number().int().positive().optional()`. Sửa ghi chú: "Tiền lấy từ bảng giá DB ở server; expectedAmount chỉ để phát hiện giá vừa đổi (spec L Q6)".
- MỚI:
  ```ts
  const monthPrice = z.number().int().min(10000).max(1000000)
  const pricePair = z.object({ plus: monthPrice, pro: monthPrice })
  export const updatePricesSchema = z
    .object({ prices: pricePair, expected: z.object({ plus: z.number().int(), pro: z.number().int() }) })
    .refine((d) => d.prices.pro > d.prices.plus, { message: "Giá Pro phải cao hơn giá Plus", path: ["prices", "pro"] })
  export type UpdatePricesInput = z.infer<typeof updatePricesSchema>
  ```
  `expected` không giới hạn khoảng: giá hiện hành có thể là giá cũ nằm ngoài khoảng mới (vd fallback).

### 7.6 Router `src/server/trpc/routers/admin.ts`

- `prices: adminProcedure.query(async ({ ctx }) => ({ monthly: await getMonthlyPrices(ctx.db), history: await getPriceHistory(ctx.db) }))`.
- `updatePrices: adminProcedure.input(updatePricesSchema).mutation(({ ctx, input }) => updatePrices(ctx.db, ctx.session.user.username, input))`.

## 8. Giao diện

Màu theo A3: nhấn `primary` (#0F766E), trung tính slate, cảnh báo amber. Không indigo/violet/purple. Vùng chạm `h-11 md:h-10` (nút chính `h-12`).

### 8.1 Nav

- `admin-nav.ts`: thêm mục thứ 4 (Q16), import `Tags` từ `lucide-react`.
- `AdminTabBar.tsx`: `grid-cols-3` → `grid-cols-4`.
- File MỚI `src/app/(admin)/admin/prices/page.tsx`: `return <AdminPrices />` (cùng kiểu `history/page.tsx`).

### 8.2 Màn Bảng giá `src/components/admin/AdminPrices.tsx` (MỚI, client)

`PageHeader` tiêu đề `admin_prices`. Query `trpc.admin.prices.useQuery()`; đang tải → `Skeleton`.

**Khối Giá hiện hành / sửa giá** (`data-testid="admin-prices-form"`, thẻ bo góc viền slate-200):
- Desktop (`md:`) 2 cột Plus | Pro; mobile xếp dọc, Pro trên Plus (P11).
- Mỗi gói (`data-testid="price-{plan}"`): tên gói; nhãn `admin_price_month` "Giá tháng"; `CurrencyInput` (`src/components/ui/currency-input.tsx`, có sẵn) `inputMode="numeric"`, `h-11`, `aria-label` "Giá tháng {Plus|Pro}"; ngay dưới là xem trước (cập nhật khi gõ, không cần Lưu):
  - "12 tháng: {formatCurrency(v × 10)}"
  - "24 tháng: {formatCurrency(v × 20)}"
  - Giá đang khác giá hiện hành → dòng nhỏ slate "Hiện tại: {formatCurrency(cũ)}/tháng".
- Lỗi tại chỗ (chữ đỏ `text-destructive` nhỏ dưới ô, dùng chung luật với zod ở 7.5 bằng cách import `updatePricesSchema`/`monthPrice` phía client): trống, < 10.000, > 1.000.000, không phải số nguyên, Pro ≤ Plus (hiện dưới ô Pro).
- Nút `admin_price_save` "Lưu bảng giá" `h-12 w-full md:w-auto`, `disabled` khi có lỗi, khi không gói nào đổi, hoặc đang gửi.

**AlertDialog xác nhận** (`data-testid="price-confirm"`): tiêu đề `admin_price_confirm_title` "Đổi bảng giá?". Nội dung: với mỗi gói **có đổi**, 1 bảng nhỏ 3 dòng (1 tháng / 12 tháng / 24 tháng) cột "Giá cũ" → "Giá mới" (giá mới in đậm). Dòng chú thích `admin_price_confirm_note`: "Áp dụng ngay cho đơn tạo mới. Đơn đang chờ và gói đã mua giữ nguyên số tiền." Nút Hủy / "Xác nhận đổi giá" (`h-11`). Xác nhận → `updatePrices.mutate({ prices, expected: data.monthly })` → toast `admin_price_saved` "Đã cập nhật bảng giá", cache `admin.prices` tự invalidate. Lỗi `CONFLICT` → toast message server + `utils.admin.prices.invalidate()` (form nạp lại giá mới, giữ nguyên số admin đang gõ nếu khác giá mới? → **không**, nạp lại giá mới cho đơn giản; admin gõ lại).

Form khởi tạo state từ `data.monthly` khi dữ liệu về lần đầu và mỗi khi `data.monthly` đổi sau khi Lưu thành công.

**Khối Lịch sử đổi giá** (`admin_price_history`), `ResponsiveList` như `AdminOrderHistory`:
- Cột desktop: Thời gian (`formatDate` + giờ phút, giờ VN), Gói, Giá tháng (`{cũ} → {mới}`; `previousMonthPrice === null` → "Giá ban đầu {mới}"), Người đổi.
- Thẻ mobile `data-testid="price-history-card"`: dòng 1 "{Gói} · {cũ} → {mới}", dòng 2 "{người đổi} · {thời gian}". Tăng giá/giảm giá không tô màu (tránh gợi ý đúng/sai).
- Trống (chỉ khi fallback) → `admin_price_no_history`.

### 8.3 `/plan` và popup

- `PlanCompare.tsx`: bỏ import `PLAN_PRICES`; dùng `me.prices[plan].month / .year / ["2year"]`. Không đổi layout.
- `PlanPurchaseDialog.tsx`: bỏ `PLAN_PRICES`; `const prices = me.prices`; thay 3 chỗ in giá + `price`. `computeUpgradeCredit(fields, me.plusCreditOrder, choice.period, prices.pro[choice.period], now)`. `create.mutate({ ...choice, expectedAmount: price })`. `onError`: `e.data?.code === "CONFLICT"` → toast `plan_price_changed` "Giá gói vừa thay đổi, đã cập nhật giá mới. Vui lòng xem lại trước khi tạo đơn." + `utils.plan.me.invalidate()`; lỗi khác giữ `toast.error(e.message)`. Popup giữ bước chọn, không đóng.
- Không đổi `PendingOrderCard`, `RenewOffer`, `UpgradeDialog`, lịch sử đơn ở `/plan` (in `amount` đã lưu).

## 9. i18n

Thêm vào `vi.json` và `en.json` (cùng bộ key, không gạch dài):

| Key | vi | en |
|---|---|---|
| `admin_prices` | Bảng giá | Pricing |
| `admin_tab_prices` | Bảng giá | Pricing |
| `admin_price_month` | Giá tháng | Monthly price |
| `admin_price_current` | Hiện tại: {amount}/tháng | Current: {amount}/month |
| `admin_price_preview_year` | 12 tháng: {amount} | 12 months: {amount} |
| `admin_price_preview_2year` | 24 tháng: {amount} | 24 months: {amount} |
| `admin_price_save` | Lưu bảng giá | Save pricing |
| `admin_price_confirm_title` | Đổi bảng giá? | Change pricing? |
| `admin_price_confirm_note` | Áp dụng ngay cho đơn tạo mới. Đơn đang chờ và gói đã mua giữ nguyên số tiền. | Applies to new orders right away. Pending orders and purchased plans keep their amount. |
| `admin_price_confirm` | Xác nhận đổi giá | Confirm |
| `admin_price_old` / `admin_price_new` | Giá cũ / Giá mới | Old / New |
| `admin_price_saved` | Đã cập nhật bảng giá | Pricing updated |
| `admin_price_history` | Lịch sử đổi giá | Price history |
| `admin_price_initial` | Giá ban đầu | Initial price |
| `admin_price_changed_by` | Người đổi | Changed by |
| `admin_price_no_history` | Chưa có lịch sử đổi giá | No price changes yet |
| `admin_price_err_range` | Giá tháng từ 10.000 đến 1.000.000 | Monthly price must be 10,000 to 1,000,000 |
| `admin_price_err_order` | Giá Pro phải cao hơn giá Plus | Pro must cost more than Plus |
| `plan_price_changed` | Giá gói vừa thay đổi, đã cập nhật giá mới. Vui lòng xem lại trước khi tạo đơn. | Prices just changed and have been updated. Please review before creating the order. |

Dùng lại: `plan_period_1m`, `plan_period_12m`, `plan_period_24m`, `admin_col_plan`, `cancel`.

## 10. Kiểm thử

Chỉ chạy trên `.env.test` (Postgres local Docker). DB test phải `migrate` để có bảng + 2 dòng seed.

### Unit (`tests/unit/lib/plans.test.ts`, sửa)
- Bỏ test `PLAN_PRICES`; thêm `pricesFromMonthly({ plus: 49000, pro: 99000 })` = đúng bảng cũ (490.000 / 980.000 / 990.000 / 1.980.000) và `pricesFromMonthly({ plus: 59000, pro: 129000 })`.
- `computeUpgradeCredit`: các ví dụ cũ truyền thêm `targetPrice` = giá Pro cũ (990.000 / 99.000) → kết quả **y như cũ** (bảo đảm D7 không đổi khi giá không đổi). Thêm: cùng đơn Plus 490.000 còn 304 ngày, `targetPrice` 1.290.000 (Pro năm giá mới) → `remainingValue` 408.110 không đổi, `creditDays = floor(408110 × 365 / 1290000) = 115`; `targetPrice = 0` → 0 ngày.
- `tests/unit/lib/schemas` (hoặc trong file test schema hiện có): `updatePricesSchema` — 49.900 hợp lệ (giá lẻ); 49.900,5 lỗi số nguyên; 9.000, 1.001.000 lỗi khoảng; Pro = Plus lỗi; hợp lệ pass.
- `tests/unit/components/PlanPurchaseDialog.test.tsx`: fixture `me` thêm `prices`; kiểm giá hiển thị theo `me.prices` (vd plus tháng 59.000 → thẻ kỳ Năm 590.000); `createOrder` được gọi với `expectedAmount`.

### Integration
- `tests/integration/plan-prices.test.ts` (MỚI). `afterEach` xóa dòng `changedBy` bắt đầu bằng `admin_test`/tên test và **đưa giá về 49.000/99.000** (xóa mọi dòng không phải `migration`), để test khác không lệch giá.
  - `admin.prices` với giáo viên → `FORBIDDEN`; `admin.updatePrices` với giáo viên → `FORBIDDEN`.
  - Admin → `monthly` = 49.000/99.000, `history` có 2 dòng `migration`.
  - Đổi Plus 59.000 (Pro giữ) → 1 dòng mới `previousMonthPrice` 49.000, `changedBy` = username admin; `plan.me.prices.plus` = 59.000/590.000/1.180.000.
  - `expected` sai → `CONFLICT`, không có dòng mới. Không đổi gì → `BAD_REQUEST`. Pro ≤ Plus → `BAD_REQUEST`.
  - Xóa hết dòng của `pro` (trong test) → `getMonthlyPrices` trả 99.000 (fallback).
- `tests/integration/plan-orders.test.ts` (thêm):
  - **Đổi giá khi có đơn chờ**: teacher tạo đơn Plus năm (490.000) → admin đổi Plus 59.000 → `plan.me.pendingOrder.amount` vẫn 490.000, QR payload chứa 490000; admin duyệt → đơn `approved` amount 490.000.
  - **Tạo đơn sau khi đổi giá**: không `expectedAmount` → amount 590.000; `expectedAmount` 490.000 → `CONFLICT`, đơn chờ cũ **vẫn pending** (không bị hủy).
  - **Quy đổi Plus→Pro sau khi đổi giá**: user Plus có đơn Plus approved 490.000; tạo đơn Pro năm ở giá 990.000; admin đổi Pro 129.000 rồi duyệt → `creditDays` tính theo 990.000 (bằng số của `computeUpgradeCredit(..., 990000, now)`), đơn giữ 990.000.
  - **Race**: `Promise.all([createOrder, updatePrices])` lặp vài lần → mọi đơn tạo ra có `amount` ∈ {giá cũ, giá mới} của đúng kỳ, và nếu có `expectedAmount` thì `amount === expectedAmount`.
- `tests/integration/admin.test.ts`: `computeApproval`/`overview.preview` vẫn đúng với chữ ký mới (chạy lại).
- `tests/integration/plan-price-migration.test.ts` (MỚI, kiểu `plan-launch-migration.test.ts`): đọc `migration.sql` của `_add_plan_prices`, kiểm có đúng câu INSERT 49000/99000 với `previous_month_price` NULL.

### E2E
- `tests/e2e/admin-prices.spec.ts` (MỚI). `afterEach`/`afterAll` đưa giá về 49.000/99.000 qua `db.planPriceChange.deleteMany({ where: { changedBy: { not: "migration" } } })`.
  - 1280px: admin mở `/admin/prices` từ sidebar; thấy Plus 49.000, Pro 99.000, xem trước 490.000/980.000; gõ Plus 59000 → xem trước đổi ngay 590.000 / 1.180.000 (chưa Lưu); gõ 59900 → hợp lệ, xem trước 599.000 / 1.198.000; gõ 9000 → lỗi khoảng, nút Lưu khóa; gõ Pro 50000 → lỗi Pro > Plus; sửa lại hợp lệ → Lưu → `price-confirm` hiện đủ 3 kỳ cũ → mới của Plus, không có Pro → Xác nhận → toast, lịch sử có dòng "Plus · 49.000 → 59.000" với `admin_test`.
  - Sau đó `teacher_std` mở `/plan`: thẻ Plus 59.000/590.000/1.180.000; popup chọn Plus năm → `purchase-summary` 590.000.
  - **Giá đổi khi popup đang mở**: `teacher_std` mở popup (Plus năm 490.000) → đổi giá qua DB (thêm dòng Plus 59.000) → bấm Tạo đơn → toast "Giá gói vừa thay đổi…", `purchase-summary` chuyển 590.000, chưa có `pending-order`; bấm Tạo đơn lần nữa → QR với 590.000.
  - 390px: tab bar admin 4 tab ≥44px, không tràn ngang; form xếp dọc Pro trên Plus; ô nhập, nút Lưu, nút trong AlertDialog ≥44px; lịch sử dạng thẻ `price-history-card`.
- `admin.spec.ts`: dòng `await expect(tabs.getByRole('link')).toHaveCount(3)` (test "route giáo viên → /admin/orders…") → sửa `4`. `plan.spec.ts`, `renew-offer.spec.ts`: chạy lại (giá mặc định không đổi nên số 490.000 giữ nguyên).

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build`, `theme-legacy-colors` sạch.

## 11. Review Focus

1. **Đổi giá khi có đơn chờ**: `amount` và QR của đơn chờ không đổi; `approveOrder` không đọc bảng giá để tính tiền.
2. **Quy đổi Plus→Pro sau khi đổi giá**: `remainingValue` theo `amount` đơn Plus đã trả; mẫu số là `order.amount` của đơn Pro (server) — không còn chỗ nào đọc giá Pro hiện hành trong `computeApproval`.
3. **Race đổi giá vs tạo đơn**: giá đọc bằng `tx` sau advisory lock; `expectedAmount` lệch → không tạo đơn và **không** hủy đơn chờ cũ (kiểm thứ tự: so giá trước `updateMany`).
4. **2 admin Lưu cùng lúc**: khóa 2 tham số + `expected`; lịch sử liền mạch cũ → mới.
5. Không còn import `PLAN_PRICES` (grep), không còn số 49000/99000 ngoài `DEFAULT_MONTH_PRICES`, migration và test.
6. Mọi procedure mới là `adminProcedure`; `changedBy` lấy từ session, không từ input.
7. Xem trước client dùng đúng `me.prices` + cùng hàm `plans.ts` như server.

## 12. Triển khai

1. **Backup Neon trước khi deploy**: tạo branch "Branch from current" trên project Neon prod (đặt tên kiểu `backup-before-L-plan-prices-2026-09-xx`), ghi lại tên branch để rollback (CLAUDE.md mục Production Data Safety, ý 8).
2. Merge vào `main` → Vercel build chạy `prisma generate && prisma migrate deploy && next build`: migration tạo bảng + seed 49.000/99.000. Không chạy lệnh DB tay lên prod.
3. Kiểm prod bằng `hien_admin`: `/admin/prices` hiện 49.000/99.000 + 2 dòng "Giá ban đầu". **Không** đổi giá thật để thử nếu người dùng chưa muốn đổi (nếu thử: đổi rồi Lưu lại giá cũ, lịch sử sẽ có 2 dòng).
4. Kiểm `qa_test` (id 4): `/plan` hiện đúng giá; không tạo đơn trên tài khoản khác.
5. Rollback: code cũ không đọc bảng mới nên revert commit là đủ; bảng thừa không gây hại (không cần xóa).

## 13. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| DB test/dev dựng bằng `db push` không có dòng seed | Fallback Q4 → giá mặc định; test integration riêng cho fallback |
| Test đổi giá làm lệch test khác (e2e chạy tuần tự trên cùng DB) | Mọi test đổi giá dọn về 49.000/99.000 trong `afterEach`; `tests/setup.ts` **không** xóa bảng giá (giữ seed migration) |
| Tab giáo viên còn JS cũ lúc deploy (không gửi `expectedAmount`) | Field optional: đơn tạo theo giá DB mới; popup cũ có thể hiện giá cũ tới khi tải lại (chỉ trong lúc deploy, chấp nhận) |
| `plan.me` cache 60 s hiện giá cũ | CONFLICT ở Q6 chặn tạo đơn sai giá và tự refetch |
| Khóa advisory trùng không gian với khóa `userId` | Dùng dạng 2 tham số int (không gian khóa riêng của Postgres) |
| Admin gõ nhầm giá (thừa/thiếu số 0) | Khoảng 10.000–1.000.000 + AlertDialog nêu đủ 3 kỳ cũ → mới |
| Bỏ `PLAN_PRICES` làm vỡ import sót | Grep + `next build` + `tsc` bắt |

## 14. Câu hỏi thật sự cần người dùng

1. ~~Q13~~ — ĐÃ CHỐT 2026-09-27: giá Pro bắt buộc cao hơn Plus. (Câu hỏi gốc: **Bắt buộc giá Pro > giá Plus?**) Spec chọn **có** (bảo vệ luật quy đổi D7). Nếu có lúc muốn khuyến mãi Pro bằng/rẻ hơn Plus thì phải bỏ luật này (và chấp nhận quy đổi Plus → Pro cho nhiều ngày hơn).
2. ~~Q12~~ — ĐÃ CHỐT: cho nhập giá lẻ (không bắt buộc chẵn nghìn), khoảng 10.000–1.000.000đ/tháng.

## 15. Bổ sung (người dùng chốt 2026-09-27): số ngày dùng thử Pro cấu hình được

Hiện `TRIAL_DAYS = 60` viết cứng (`src/lib/plans.ts:22`); lúc đăng ký `trialEndsAt = vnStartOfDay(createdAt) + TRIAL_DAYS` (`src/lib/plans.ts:~203`). `trialEndsAt` đã lưu theo từng user.

- **T1 — Mặc định cho tài khoản mới:** màn `/admin/prices` có thêm ô "Số ngày dùng thử Pro" (số nguyên, gợi ý 0–365; 0 = không dùng thử). Lưu cùng cơ chế lịch sử chỉ thêm dòng như giá (bảng cấu hình/lịch sử riêng hoặc gộp — plan tự chọn, giải thích; migration seed 60). Đăng ký (`register`) đọc số ngày từ DB, thiếu dòng thì fallback 60 + `console.warn`.
- **T2 — Phạm vi đổi mặc định:** CHỈ áp cho tài khoản đăng ký SAU khi lưu. Người đang dùng thử giữ `trialEndsAt` cũ.
- **T3 — Chỉnh riêng từng người:** màn `/admin/accounts` có thao tác "Đặt số ngày dùng thử" cho 1 tài khoản (vd 90, 120). Server: `trialEndsAt = addDays(vnStartOfDay(user.createdAt), N)` — **tính từ ngày tạo tài khoản** (đã dùng 50 ngày, đặt 120 → còn 70). Nếu kết quả ở tương lai thì trial bật lại dù đã hết; nếu ở quá khứ thì coi như hết trial. Chỉ `adminProcedure`; ghi lại ai đặt, lúc nào, số ngày cũ → mới (hiện trong dialog hoặc lịch sử). Không đụng `plan`/`planExpiresAt` (gói trả phí giữ nguyên; `effectivePlan` vẫn lấy cái có hiệu lực).
- UI dialog xác nhận nêu rõ hạn dùng thử mới (dd/mm/yyyy) trước khi lưu; admin (tài khoản trong ADMIN_USERNAMES) không cần thao tác này.
- Test: unit tính hạn từ createdAt; integration register dùng số ngày DB (đổi 60→90 chỉ ảnh hưởng tài khoản tạo sau), đặt riêng 120 cho user đã hết trial → trial bật lại, FORBIDDEN với giáo viên; e2e admin đặt số ngày cho 1 tài khoản thấy hạn mới. Test đổi mặc định phải trả về 60 sau khi chạy.
