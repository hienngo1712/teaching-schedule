# B — Lịch sử thu tiền (bảng `Payment`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi tháng học phí có danh sách từng lần thu (số tiền, ngày, hình thức, ghi chú) trong bảng mới `Payment`; "Đã trả" = tổng các lần thu; dữ liệu cũ được chép sang mà mọi con số không đổi.

**Architecture:** Thêm model `Payment` + migration chép `paidAmount > 0` cũ thành 1 lần thu. `MonthlyTuition.paidAmount` giữ làm cột tổng hợp, chỉ được ghi bởi `syncPaidAmount` (tính bằng `aggregate`, trong transaction có khoá dòng) nên toàn bộ chỗ đọc cũ (carry-over, báo cáo, badge) giữ nguyên. Router mới `payment.*` + mutation `tuition.updateSettlement` thay `tuition.updatePayment`; `TuitionDetailSheet` viết lại phần thân + dialog mới `PaymentFormDialog`.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, Prisma 5 (PostgreSQL/Neon), Zod 3, Tailwind 3, shadcn/ui, lucide-react, sonner, Vitest 4, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-b-lich-su-thu-tien-design.md`

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh đụng DB, đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` KHÁC `.env.test`. `.env` = PRODUCTION (host `ep-polished-voice…`), `.env.test` = test (host `ep-jolly-dew…`). Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`).
- **CẤM:** `pnpm db:reset`, `prisma migrate reset`, `prisma db push --force-reset`, `pnpm build` (chạy `prisma migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:prod`, `pnpm db:migrate:all`. Kiểm tra build bằng `pnpm exec next build`.
- **Migration:** chỉ tạo/áp trên DB test qua wrapper `.superpowers/prisma-test.cjs` (Task 1 tạo; nạp `DATABASE_URL`/`DIRECT_URL` từ `.env.test`, tự dừng nếu host trùng `.env`). `package.json` không có `dotenv-cli`, nên không dùng `dotenv -e`. Đọc lại SQL trước khi áp. **KHÔNG BAO GIỜ áp lên prod thủ công**: prod tự chạy `prisma migrate deploy` khi Vercel build sau merge. Nếu Prisma đòi reset DB test thì từ chối, dùng đường dự phòng ở Task 1.
- Chạy test 1 file: `pnpm test <đường-dẫn>`. Không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ mất ~10–15 phút.
- **E2E:** cổng 3000 có thể bị project khác chiếm → dùng config tạm git-ignored `.superpowers/pw-3100.config.ts` (Task 4 tạo): import `playwright.config.ts`, đổi port 3100, url kiểm tra `http://127.0.0.1:3100/login`, `reuseExistingServer: true`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. `ResponsiveList` render cả bảng lẫn thẻ → dùng test id `list-card`.
- **i18n:** `src/language/vi.json` và `en.json` phải cùng bộ key. `t()` có kiểu `keyof Translations` → xoá key còn dùng sẽ làm `tsc` đỏ.
- Thông báo lỗi từ service viết tiếng Việt như các service hiện có.
- Ghi chú code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy.
- Vùng chạm ≥ 44px trên mobile (`h-11`, `size-11`), viewport kiểm thử 390×844, breakpoint `md`.
- Mỗi task kết thúc bằng: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit trên nhánh `feat/b-payments`. Không commit lên `main`. **Agent thực hiện task KHÔNG merge, KHÔNG push**: merge/push do người điều phối làm sau review cuối.
- Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Không nhập mật khẩu/credential vào trình duyệt. Không thao tác ghi trên tài khoản production.

## Điều chỉnh so với spec

1. `ensureMonthlyTuition` đặt trong `tuition.service.ts` (cạnh `getMonthlyTuitionStatus`), không đặt trong `payment.service.ts`: `updateSettlement` (tuition.service) và `createPayment` (payment.service) đều cần nó, để ở payment.service sẽ tạo import vòng tuition ↔ payment.
2. `ensureMonthlyTuition` bỏ qua lỗi `P2002` khi 2 request cùng mở 1 tháng mới (upsert snapshot bên trong `getMonthlyTuitionStatus` không nguyên tử). Nếu không làm vậy, test "create song song" của spec §10 sẽ chập chờn.
3. `paidAt`: ngoài `dateRegex` còn kiểm tra ngày có thật (vì spec §10 yêu cầu `"2026-13-01"` → `BAD_REQUEST`, mà `dateRegex` một mình không chặn được).
4. Sheet tự query `tuition.getMonthlyStatus({ studentId, year, month })` để lấy dòng tháng mới nhất: prop `data` là bản chụp lúc mở, còn sheet thì vẫn mở sau mỗi lần thu. Không cần gọi invalidate thủ công vì `TRPCProvider` đã tự `invalidateQueries()` sau mọi mutation (spec §6.3 ghi "invalidate payment.list, tuition, report": được đáp ứng tự động).
5. Lưu tất toán thành công → toast `settlement_saved` + đóng sheet (giữ như hành vi cũ). Spec không nói gì về điểm này.
6. Xoá thêm 2 key mồ côi sau khi viết lại sheet: `keep`, `payment_action`. Giữ `payment_tip_snapshot`, `notes_placeholder` (sheet mới vẫn dùng) và `saving` (còn dùng ở `StudentFormDialog`). Tổng: thêm 18 key, xoá 17 key → 306 → 307.
7. Thêm file hàm thuần `src/lib/payment-summary.ts` (`paymentSummaryLine`, `remainingToFill`, `vnTodayIso`) có unit test, để các quy tắc hiển thị "Còn lại / Trả dư / Miễn giảm" và nút "Số còn lại" được kiểm bằng test.
8. Test migration (`tests/integration/payment-migration.test.ts`) đọc phần INSERT chép dữ liệu ngay trong `migration.sql` rồi chạy lại trên DB test đã seed, qua đó kiểm tra bất biến và ngày giờ VN của chính câu SQL sẽ chạy trên prod.
9. `student.delete` là xoá mềm (`isActive=false`), không cascade. Test "Xoá học sinh → Payment bị xoá theo" dùng `db.student.delete` (xoá cứng) để kiểm FK cascade đúng như spec §8.1 mô tả.
10. Helper test `recordPayment(caller, {...})` (trong `tests/helpers/payment.ts`) thay cho từng lời gọi `tuition.updatePayment` trong 8 file test, giữ nguyên mọi `expect` về số.
11. Thứ tự task: UI mới (Task 4) làm TRƯỚC khi xoá `tuition.updatePayment` (Task 5), vì sheet cũ đang gọi nó và dùng `mergeOverpaidNote`. Từ Task 2 đến Task 4, đường ghi cũ vẫn còn trên nhánh (chưa deploy nên không ảnh hưởng dữ liệu).
12. Không cập nhật `docs/03-api.md` (spec không yêu cầu).

## Review Focus

1. **Bấm Lưu 2 lần / 2 request thu tiền cùng lúc** → `paidAmount` = tổng cả 2, không mất lần nào. Pin: integration `Promise.all` trong Task 2 (tháng chưa mở, gồm cả nhánh P2002).
2. **Sửa 1 lần thu mà không gửi `note`** → ghi chú cũ giữ nguyên (bẫy: transform "rỗng → null" biến `undefined` thành `null`). Pin: unit schema + integration "update chỉ đổi trường được gửi" ở Task 2.
3. **Tháng có tín dụng (`totalAmountDue ≤ 0`) hoặc đã tất toán còn thiếu** → sheet hiện "Còn lại 0 đ" / "Miễn giảm X", không hiện "Trả dư"; nút "Số còn lại" ẩn khi = 0. Pin: unit `paymentSummaryLine`, `remainingToFill` ở Task 3.
4. **Sửa lần thu khi tháng đang trả dư** → "Số còn lại" tính lại sau khi bỏ số cũ của chính lần đang sửa. Pin: unit `remainingToFill(…, editingAmount)` ở Task 3.
5. **Giáo viên thu tiền lúc 0h–7h sáng giờ VN / HS không có ca trong tháng** → ngày mặc định là hôm nay theo giờ VN (không phải UTC); HS nghỉ cả tháng vẫn thu được. Pin: unit `vnTodayIso` ở Task 3; integration "HS không có ca" ở Task 2.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `prisma/schema.prisma` | Sửa | model `Payment`, `MonthlyTuition.payments` | 1 |
| `prisma/migrations/<ts>_add_payments/migration.sql` | Mới | DDL + INSERT chép dữ liệu cũ | 1 |
| `tests/setup.ts` | Sửa | `db.payment.deleteMany()` trước `db.student.deleteMany()` | 1 |
| `tests/helpers/payment.ts` | Mới (T1), sửa (T2) | `findPaidAmountMismatches()`, `recordPayment()` | 1, 2 |
| `tests/integration/payment-migration.test.ts` | Mới | kiểm SQL chép dữ liệu + bất biến | 1 |
| `src/lib/schemas/payment.ts` | Mới | `PAYMENT_METHODS`, 4 schema zod, type | 2 |
| `src/lib/schemas/tuition.ts` | Sửa | thêm `updateSettlementSchema` (T2); xoá `updatePaymentSchema` (T5) | 2, 5 |
| `src/lib/types/models.ts` | Sửa | `PaymentDTO` | 2 |
| `src/server/services/tuition.service.ts` | Sửa | thêm `ensureMonthlyTuition`, `updateSettlement` (T2); xoá `updateTuitionPayment` (T5) | 2, 5 |
| `src/server/services/payment.service.ts` | Mới | `syncPaidAmount`, `listPayments`, `createPayment`, `updatePayment`, `deletePayment` | 2 |
| `src/server/trpc/routers/payment.ts` | Mới | `payment.list/create/update/delete` | 2 |
| `src/server/trpc/root.ts` | Sửa | đăng ký `payment` | 2 |
| `src/server/trpc/routers/tuition.ts` | Sửa | thêm `updateSettlement` (T2); xoá `updatePayment` (T5) | 2, 5 |
| `tests/integration/payment.test.ts` | Mới | integration spec §10 | 2 |
| `tests/unit/schemas/payment.schema.test.ts` | Mới | unit schema | 2 |
| `src/lib/payment-summary.ts` | Mới | `paymentSummaryLine`, `remainingToFill`, `vnTodayIso` | 3 |
| `tests/unit/lib/payment-summary.test.ts` | Mới | | 3 |
| `src/language/vi.json`, `en.json` | Sửa | +18 key (T3), −17 key (T4) | 3, 4 |
| `src/components/tuition/PaymentFormDialog.tsx` | Mới | dialog thêm/sửa lần thu | 4 |
| `src/components/tuition/TuitionDetailSheet.tsx` | Viết lại | bảng tính, lịch sử thu, tất toán | 4 |
| `tests/e2e/tuition-payments.spec.ts` | Mới | E2E 390px | 4 |
| `src/lib/payment-notes.ts` | Sửa | xoá `mergeOverpaidNote`, `buildPaymentAuditNote`; giữ `formatVnDate` | 5 |
| `tests/unit/lib/payment-notes.test.ts` | Sửa | chỉ giữ `formatVnDate` | 5 |
| 8 file `tests/integration/*` (xem Task 5) | Sửa | đổi `tuition.updatePayment` → `recordPayment` / `payment.*` | 5 |

Không đổi: `src/app/(app)/tuition/page.tsx` (props của sheet giữ nguyên), `report.service.ts`, `tuition-status.ts`, `calcStudentTuition`, `getMonthlyTuitionStatus`, `getMonthlyOutstanding`, `TuitionStatusDTO`.

---

### Task 0: Tạo nhánh + kiểm tra an toàn

**Đọc trước:** `docs/coding-rule.md` §6.1; mục Global Constraints ở trên.

- [ ] **Step 1: Tạo nhánh từ `main` mới nhất**

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/b-payments || git checkout feat/b-payments
```

Nếu nhánh đã có sẵn thì chỉ cần checkout, không tạo lại. B không phụ thuộc phần nào khác nên không cần kiểm tra thêm phần phụ thuộc.

- [ ] **Step 2: Xác nhận chưa có Payment (tránh làm lại)**

Run: `grep -n "model Payment" prisma/schema.prisma; ls prisma/migrations | grep add_payments`
Expected: không in gì. Nếu đã có → DỪNG, báo người dùng (có thể B đã làm một phần).

- [ ] **Step 3: Xác nhận DB test khác production**

Run:
```bash
h(){ grep -E "^$2=" "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env DATABASE_URL) test=$(h .env.test DATABASE_URL) | direct env=$(h .env DIRECT_URL) test=$(h .env.test DIRECT_URL)"
```
Expected: host `.env` chứa `ep-polished-voice`, host `.env.test` chứa `ep-jolly-dew`, 2 cặp khác nhau. Nếu giống → DỪNG, báo người dùng.

---

### Task 1: Model `Payment` + migration chép dữ liệu cũ

**Đọc trước:** spec §8 (toàn bộ), §4 S1/S5, §12 dòng 1 và 3; `prisma/schema.prisma` (model `MonthlyTuition`, dòng ~81–101); `tests/setup.ts`; `docs/coding-rule.md` §6.1.

**Files:**
- Create: `.superpowers/prisma-test.cjs` (KHÔNG commit)
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_payments/migration.sql`
- Modify: `tests/setup.ts`
- Create: `tests/helpers/payment.ts`
- Test: `tests/integration/payment-migration.test.ts`

**Interfaces:**
- Produces:
  - Prisma model `Payment { id, monthlyTuitionId, amount, paidAt (@db.Date), method (varchar 10, default "cash"), note?, createdAt, updatedAt, monthlyTuition }`, bảng `payments`; `MonthlyTuition.payments: Payment[]`; client `db.payment`.
  - `findPaidAmountMismatches(): Promise<Array<{ id: number; paid_amount: number; s: bigint }>>` trong `tests/helpers/payment.ts` (truy vấn (C) spec §8.3; rỗng = bất biến đúng).
  - Dòng mở đầu phần chép dữ liệu trong migration.sql bắt đầu bằng đúng chuỗi `-- Chuyển dữ liệu cũ` (test tìm theo chuỗi này).

- [ ] **Step 1: Tạo wrapper chạy prisma trên DB test (không commit)**

Tạo `.superpowers/prisma-test.cjs`:

```js
// KHÔNG commit. Chạy prisma CLI với DATABASE_URL/DIRECT_URL của .env.test; dừng nếu trùng host .env (production).
const fs = require("fs")
const { parse } = require("dotenv")
const { spawnSync } = require("child_process")

const host = (u) => ((u || "").match(/@([^/:?]+)/) || [])[1]
const prod = fs.existsSync(".env") ? parse(fs.readFileSync(".env")) : {}
const test = parse(fs.readFileSync(".env.test"))
for (const k of ["DATABASE_URL", "DIRECT_URL"]) {
  if (!test[k]) {
    console.error(`DỪNG: .env.test thiếu ${k}`)
    process.exit(1)
  }
  if ([prod.DATABASE_URL, prod.DIRECT_URL].map(host).includes(host(test[k]))) {
    console.error(`DỪNG: ${k} của .env.test trùng host production`)
    process.exit(1)
  }
}
console.log(`prisma → DB test: ${host(test.DATABASE_URL)} / ${host(test.DIRECT_URL)}`)
const r = spawnSync("pnpm", ["exec", "prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: test.DATABASE_URL, DIRECT_URL: test.DIRECT_URL },
})
process.exit(r.status ?? 1)
```

Chặn commit nhầm:
```bash
grep -qxF ".superpowers/prisma-test.cjs" .git/info/exclude || echo ".superpowers/prisma-test.cjs" >> .git/info/exclude
grep -qxF ".superpowers/pw-3100.config.ts" .git/info/exclude || echo ".superpowers/pw-3100.config.ts" >> .git/info/exclude
grep -qxF ".superpowers/schema.before.prisma" .git/info/exclude || echo ".superpowers/schema.before.prisma" >> .git/info/exclude
git status --short
```
Expected: `git status` không liệt kê file trong `.superpowers/`.

- [ ] **Step 2: Kiểm tra trạng thái migration của DB test (chỉ đọc)**

Run: `node .superpowers/prisma-test.cjs migrate status`
Expected:
- Dòng đầu wrapper in host chứa `ep-jolly-dew`.
- Dòng Prisma `Datasource "db": PostgreSQL database ... at "ep-jolly-dew..."`. Nếu host in ra chứa `ep-polished-voice` → DỪNG NGAY, báo người dùng.
- `Database schema is up to date!` với 4 migration hiện có. Nếu báo migration pending khác, drift, hoặc DB chưa được quản lý bằng migrate → DỪNG, báo người dùng (không tự sửa DB test).

- [ ] **Step 3: Viết helper bất biến + test fail**

`tests/helpers/payment.ts`:

```ts
import { db } from "@/server/db"

// Truy vấn (C) spec B §8.3: tháng nào có paidAmount lệch tổng Payment. Rỗng = bất biến đúng.
export async function findPaidAmountMismatches() {
  return db.$queryRaw<Array<{ id: number; paid_amount: number; s: bigint }>>`
    SELECT mt."id", mt."paid_amount", COALESCE(SUM(p."amount"), 0) AS s
    FROM "monthly_tuition" mt LEFT JOIN "payments" p ON p."monthly_tuition_id" = mt."id"
    GROUP BY mt."id"
    HAVING mt."paid_amount" <> COALESCE(SUM(p."amount"), 0)`
}
```

`tests/integration/payment-migration.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"
import { findPaidAmountMismatches } from "../helpers/payment"

const MARKER = "-- Chuyển dữ liệu cũ"

// Lấy đúng câu INSERT sẽ chạy trên production để kiểm tra, không chép lại SQL vào test.
function dataCopySql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_payments"))
  expect(found).toHaveLength(1)
  const sql = readFileSync(join(dir, found[0], "migration.sql"), "utf8")
  const start = sql.indexOf(MARKER)
  expect(start).toBeGreaterThan(-1)
  return sql.slice(start)
}

async function seedTuition(studentId: number, month: number, paidAmount: number, updatedAtUtc: string) {
  const mt = await db.monthlyTuition.create({
    data: { studentId, year: 2026, month, paidAmount, totalAmountDue: 300000 },
  })
  // @updatedAt luôn ghi giờ hiện tại → đặt lại bằng SQL để mô phỏng dữ liệu cũ.
  await db.$executeRaw`UPDATE "monthly_tuition" SET "updated_at" = ${updatedAtUtc}::timestamp WHERE "id" = ${mt.id}`
  return mt
}

describe("Migration add_payments — chuyển dữ liệu cũ", () => {
  beforeEach(async () => {
    await db.monthlyTuition.deleteMany() // cascade xoá payments
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
    await db.student.deleteMany()
  })

  it("mỗi tháng paidAmount > 0 thành đúng 1 Payment; số lượng và tổng tiền không đổi; bất biến giữ", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const st = await db.student.create({ data: { userId: user.id, fullName: "HS Dữ Liệu Cũ", grade: 5 } })
    const late = await seedTuition(st.id, 5, 300000, "2026-05-31 18:30:00") // 01:30 ngày 01/06 giờ VN
    const early = await seedTuition(st.id, 4, 150000, "2026-04-10 03:00:00")
    await seedTuition(st.id, 3, 0, "2026-03-10 03:00:00") // chưa trả → không sinh Payment

    // (A) spec §8.3
    const [before] = await db.$queryRaw<Array<{ n: number; total: number }>>`
      SELECT COUNT(*)::int AS n, COALESCE(SUM("paid_amount"), 0)::int AS total
      FROM "monthly_tuition" WHERE "paid_amount" > 0`

    await db.$executeRawUnsafe(dataCopySql())

    // (B) spec §8.3: phải bằng đúng (A)
    const [after] = await db.$queryRaw<Array<{ n: number; total: number }>>`
      SELECT COUNT(*)::int AS n, COALESCE(SUM("amount"), 0)::int AS total FROM "payments"`
    expect(before).toEqual({ n: 2, total: 450000 })
    expect(after).toEqual(before)

    // (C) spec §8.3: 0 dòng lệch
    expect(await findPaidAmountMismatches()).toEqual([])

    const payments = await db.payment.findMany()
    const byMonth = new Map(payments.map((p) => [p.monthlyTuitionId, p]))
    expect(byMonth.get(late.id)!.paidAt.toISOString().slice(0, 10)).toBe("2026-06-01")
    expect(byMonth.get(early.id)!.paidAt.toISOString().slice(0, 10)).toBe("2026-04-10")
    expect(byMonth.get(late.id)!.amount).toBe(300000)
    for (const p of payments) {
      expect(p.method).toBe("cash")
      expect(p.note).toBe("Chuyển từ dữ liệu cũ")
    }
  })

  it("xoá MonthlyTuition → Payment bị xoá theo (FK cascade)", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const st = await db.student.create({ data: { userId: user.id, fullName: "HS Cascade", grade: 5 } })
    await seedTuition(st.id, 5, 100000, "2026-05-10 03:00:00")
    await db.$executeRawUnsafe(dataCopySql())
    expect(await db.payment.count()).toBe(1)

    await db.student.delete({ where: { id: st.id } }) // xoá cứng → cascade MonthlyTuition → Payment
    expect(await db.payment.count()).toBe(0)
  })
})
```

- [ ] **Step 4: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/payment-migration.test.ts`
Expected: FAIL. `expect(found).toHaveLength(1)` nhận 0 (chưa có migration), và/hoặc `db.payment` undefined.

- [ ] **Step 5: Thêm model vào `prisma/schema.prisma`**

Trong `model MonthlyTuition`, thêm dòng ngay sau `student Student @relation(...)`:

```prisma
  payments Payment[]
```

Thêm model mới ngay sau khối `model MonthlyTuition { ... }`:

```prisma
model Payment {
  id               Int            @id @default(autoincrement())
  monthlyTuitionId Int            @map("monthly_tuition_id")
  amount           Int
  paidAt           DateTime       @map("paid_at") @db.Date
  method           String         @default("cash") @db.VarChar(10)
  note             String?        @db.Text
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")
  monthlyTuition   MonthlyTuition @relation(fields: [monthlyTuitionId], references: [id], onDelete: Cascade)

  @@index([monthlyTuitionId])
  @@index([paidAt])
  @@map("payments")
}
```

Run: `pnpm exec prisma format && pnpm exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 6: Sinh DDL migration (chỉ tạo file, không áp)**

Run: `node .superpowers/prisma-test.cjs migrate dev --create-only --name add_payments`
Expected: host in ra là `ep-jolly-dew…`; tạo `prisma/migrations/<timestamp>_add_payments/migration.sql`.

**Dự phòng** (chỉ dùng khi lệnh trên đòi reset DB, báo drift, hoặc lỗi shadow database). TUYỆT ĐỐI không đồng ý reset. Sinh DDL bằng diff giữa 2 file schema (lệnh này không kết nối DB):
```bash
git show main:prisma/schema.prisma > .superpowers/schema.before.prisma
ts=$(date -u +%Y%m%d%H%M%S); mkdir -p "prisma/migrations/${ts}_add_payments"
pnpm exec prisma migrate diff --from-schema-datamodel .superpowers/schema.before.prisma --to-schema-datamodel prisma/schema.prisma --script > "prisma/migrations/${ts}_add_payments/migration.sql"
rm .superpowers/schema.before.prisma
```

- [ ] **Step 7: Đọc lại DDL**

Run: `cat prisma/migrations/*_add_payments/migration.sql`
Expected: nội dung tương đương (đúng tên bảng/cột/index/FK):

```sql
-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "monthly_tuition_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" DATE NOT NULL,
    "method" VARCHAR(10) NOT NULL DEFAULT 'cash',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_monthly_tuition_id_idx" ON "payments"("monthly_tuition_id");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_monthly_tuition_id_fkey" FOREIGN KEY ("monthly_tuition_id") REFERENCES "monthly_tuition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Tuyệt đối không được có `DROP`, `ALTER TABLE "monthly_tuition"` hay thay đổi bảng khác. Nếu có → DỪNG, báo người dùng.

- [ ] **Step 8: Thêm tay phần chép dữ liệu vào CUỐI `migration.sql`**

Thêm nguyên văn (dòng đầu phải bắt đầu bằng `-- Chuyển dữ liệu cũ`):

```sql

-- Chuyển dữ liệu cũ: mỗi tháng đã trả > 0 thành 1 lần thu. updated_at lưu UTC → cộng 7h lấy ngày VN.
INSERT INTO "payments" ("monthly_tuition_id", "amount", "paid_at", "method", "note", "created_at", "updated_at")
SELECT "id", "paid_amount", ("updated_at" + INTERVAL '7 hours')::date, 'cash', 'Chuyển từ dữ liệu cũ',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "monthly_tuition" WHERE "paid_amount" > 0;
```

- [ ] **Step 9: Áp migration lên DB TEST + generate client**

Run: `node .superpowers/prisma-test.cjs migrate deploy`
Expected: host `ep-jolly-dew…`; `Applying migration '<timestamp>_add_payments'`; `All migrations have been successfully applied.`

Run: `pnpm exec prisma generate`
Expected: `Generated Prisma Client`. (Windows báo `EPERM` do file engine bị khoá → tắt tiến trình node/next đang chạy của repo này rồi chạy lại.)

- [ ] **Step 10: `tests/setup.ts` — xoá Payment theo thứ tự FK**

Trong khối `// Reset DB theo thứ tự FK`, thêm 1 dòng ngay trước `await db.student.deleteMany()`:

```ts
    await db.payment.deleteMany() // cascade từ student đã đủ; ghi rõ cho thứ tự FK
```

- [ ] **Step 11: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/payment-migration.test.ts`
Expected: PASS 2/2.

Run: `pnpm test tests/integration/tuition.test.ts tests/integration/report.test.ts`
Expected: PASS (chưa đổi logic nào, chỉ kiểm tra setup mới không làm hỏng test cũ).

- [ ] **Step 12: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 13: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/setup.ts tests/helpers/payment.ts tests/integration/payment-migration.test.ts
git status --short   # xác nhận KHÔNG có file .superpowers/
git commit -m "feat(payment): bảng payments + migration chép paidAmount cũ thành lần thu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Backend — `payment.*`, `tuition.updateSettlement`

**Đọc trước:** spec §4 (S1, S2, S6, S8), §7 (toàn bộ), §10 phần Integration + Unit schema, §11; `src/server/services/tuition.service.ts` (hàm `getMonthlyTuitionStatus`, `updateTuitionPayment`); `src/server/services/_base.service.ts`; `src/server/trpc/routers/tuition.ts`, `subject.ts` (mẫu router); `src/server/trpc/root.ts`; `tests/integration/tuition-payment-snapshot.test.ts` (lý do phải snapshot trước khi ghi tiền).

**Files:**
- Create: `src/lib/schemas/payment.ts`
- Modify: `src/lib/schemas/tuition.ts`
- Modify: `src/lib/types/models.ts`
- Modify: `src/server/services/tuition.service.ts`
- Create: `src/server/services/payment.service.ts`
- Create: `src/server/trpc/routers/payment.ts`
- Modify: `src/server/trpc/root.ts`, `src/server/trpc/routers/tuition.ts`
- Modify: `tests/helpers/payment.ts`
- Test: `tests/integration/payment.test.ts`, `tests/unit/schemas/payment.schema.test.ts`

**Interfaces:**
- Consumes: `db.payment`, `findPaidAmountMismatches()` (Task 1).
- Produces:
  - `src/lib/schemas/payment.ts`: `PAYMENT_METHODS = ["cash", "transfer"] as const`; `type PaymentMethod = "cash" | "transfer"`; `paymentCreateSchema`, `paymentUpdateSchema`, `paymentListSchema`, `paymentDeleteSchema`; types `PaymentCreateInput`, `PaymentUpdateInput`, `PaymentUpdateData`, `PaymentListInput`.
  - `src/lib/schemas/tuition.ts`: `updateSettlementSchema` = `{ studentId, year, month, isFullPaid: boolean, notes?: string | null }`, `UpdateSettlementInput`.
  - `src/lib/types/models.ts`: `interface PaymentDTO { id: number; amount: number; paidAt: string /* YYYY-MM-DD */; method: PaymentMethod; note: string | null }`.
  - `tuition.service.ts`: `ensureMonthlyTuition(db: PrismaClient, userId: number, studentId: number, year: number, month: number): Promise<MonthlyTuition>`; `updateSettlement(db: PrismaClient, userId: number, input: UpdateSettlementInput): Promise<MonthlyTuition>`.
  - `payment.service.ts`: `syncPaidAmount(tx: Prisma.TransactionClient, monthlyTuitionId: number): Promise<number>`; `listPayments(db, userId, { studentId, year, month }): Promise<PaymentDTO[]>`; `createPayment(db, userId, input: PaymentCreateInput): Promise<PaymentDTO>`; `updatePayment(db, userId, id: number, data: PaymentUpdateData): Promise<PaymentDTO>`; `deletePayment(db, userId, id: number): Promise<{ id: number }>`.
  - tRPC: `payment.list({ studentId, year, month })` → `PaymentDTO[]` (paidAt giảm dần, cùng ngày thì id giảm dần); `payment.create({ studentId, year, month, amount, paidAt, method, note? })` → `PaymentDTO`; `payment.update({ id, data: { amount?, paidAt?, method?, note? } })` → `PaymentDTO`; `payment.delete({ id })` → `{ id }`; `tuition.updateSettlement({ studentId, year, month, isFullPaid, notes? })`.
  - `tests/helpers/payment.ts`: `recordPayment(caller, { studentId, year, month, amount, isFullPaid? }): Promise<void>`.

- [ ] **Step 1: Viết unit test schema (fail)**

`tests/unit/schemas/payment.schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { paymentCreateSchema, paymentUpdateSchema } from "@/lib/schemas/payment"

const base = {
  studentId: 1,
  year: 2026,
  month: 5,
  amount: 100000,
  paidAt: "2026-05-12",
  method: "cash" as const,
}

describe("paymentCreateSchema", () => {
  it("✓ hợp lệ, không gửi note → note undefined", () => {
    expect(paymentCreateSchema.parse(base).note).toBeUndefined()
  })

  it("✗ amount < 1 hoặc không nguyên", () => {
    expect(paymentCreateSchema.safeParse({ ...base, amount: 0 }).success).toBe(false)
    expect(paymentCreateSchema.safeParse({ ...base, amount: 1.5 }).success).toBe(false)
    expect(paymentCreateSchema.safeParse({ ...base, amount: 1 }).success).toBe(true)
  })

  it("✗ ngày sai dạng hoặc không có thật", () => {
    for (const paidAt of ["2026-5-12", "12/05/2026", "2026-13-01", "2026-02-30", ""]) {
      expect(paymentCreateSchema.safeParse({ ...base, paidAt }).success).toBe(false)
    }
  })

  it("✗ method ngoài danh sách", () => {
    expect(paymentCreateSchema.safeParse({ ...base, method: "card" }).success).toBe(false)
    expect(paymentCreateSchema.safeParse({ ...base, method: "transfer" }).success).toBe(true)
  })

  it("✓ note rỗng/khoảng trắng → null; có chữ → trim", () => {
    expect(paymentCreateSchema.parse({ ...base, note: "" }).note).toBeNull()
    expect(paymentCreateSchema.parse({ ...base, note: "   " }).note).toBeNull()
    expect(paymentCreateSchema.parse({ ...base, note: "  Mẹ đóng  " }).note).toBe("Mẹ đóng")
  })

  it("✗ note dài hơn 500 ký tự", () => {
    expect(paymentCreateSchema.safeParse({ ...base, note: "a".repeat(501) }).success).toBe(false)
  })
})

describe("paymentUpdateSchema", () => {
  it("không gửi note → undefined (không được xoá ghi chú cũ)", () => {
    expect(paymentUpdateSchema.parse({ id: 1, data: { amount: 5000 } }).data.note).toBeUndefined()
  })

  it("note rỗng → null (xoá ghi chú)", () => {
    expect(paymentUpdateSchema.parse({ id: 1, data: { note: "" } }).data.note).toBeNull()
  })
})
```

- [ ] **Step 2: Viết integration test (fail)**

Thêm vào cuối `tests/helpers/payment.ts`:

```ts
import type { getAuthedCaller } from "./trpc"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

// Thay cho tuition.updatePayment cũ trong test: 1 lần thu (nếu amount > 0) + tất toán (nếu cần).
export async function recordPayment(
  caller: Caller,
  p: { studentId: number; year: number; month: number; amount: number; isFullPaid?: boolean }
) {
  const { studentId, year, month, amount, isFullPaid } = p
  if (amount > 0) {
    await caller.payment.create({
      studentId,
      year,
      month,
      amount,
      method: "cash",
      paidAt: `${year}-${String(month).padStart(2, "0")}-15`,
    })
  }
  if (isFullPaid) {
    await caller.tuition.updateSettlement({ studentId, year, month, isFullPaid: true })
  }
}
```

(Đưa dòng `import type { getAuthedCaller } from "./trpc"` lên đầu file, cạnh import `db`.)

`tests/integration/payment.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { findPaidAmountMismatches } from "../helpers/payment"
import { ATTENDANCE_STATUS } from "@/lib/constants"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function seedStudent(caller: Caller, sessions: Array<{ date: string; fee: number }>) {
  const subjectId = (await caller.subject.list({}))[0].id
  const st = await caller.student.create({ fullName: "HS Thu Tiền", grade: 4, tuitionFee: 100000 })
  for (const s of sessions) {
    const created = await caller.session.create({
      sessionDate: s.date, startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: created.id,
      attendances: [{ studentId: st.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: s.fee }],
    })
  }
  return st
}

async function paidOf(caller: Caller, studentId: number, year: number, month: number) {
  const res = await caller.tuition.getMonthlyStatus({ year, month, studentId })
  return res.items[0]
}

async function expectInvariant() {
  expect(await findPaidAmountMismatches()).toEqual([])
}

const may = { year: 2026, month: 5 }

describe("payment.* — lịch sử thu tiền", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("✓ thêm 2 lần thu → paidAmount = tổng; list trả đúng DTO, note đã trim", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [{ date: "2026-05-10", fee: 500000 }])

    const p1 = await caller.payment.create({ studentId: st.id, ...may, amount: 300000, paidAt: "2026-05-12", method: "cash" })
    const p2 = await caller.payment.create({
      studentId: st.id, ...may, amount: 200000, paidAt: "2026-05-12", method: "transfer", note: "  CK Vietcombank  ",
    })

    expect((await paidOf(caller, st.id, 2026, 5)).paidAmount).toBe(500000)
    const list = await caller.payment.list({ studentId: st.id, ...may })
    expect(list).toEqual([
      { id: p2.id, amount: 200000, paidAt: "2026-05-12", method: "transfer", note: "CK Vietcombank" },
      { id: p1.id, amount: 300000, paidAt: "2026-05-12", method: "cash", note: null },
    ])
    await expectInvariant()
  })

  it("✓ thứ tự: ngày thu mới nhất trước, cùng ngày thì id lớn trước", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [])
    const a = await caller.payment.create({ studentId: st.id, ...may, amount: 1000, paidAt: "2026-05-12", method: "cash" })
    const b = await caller.payment.create({ studentId: st.id, ...may, amount: 2000, paidAt: "2026-05-12", method: "cash" })
    const c = await caller.payment.create({ studentId: st.id, ...may, amount: 3000, paidAt: "2026-05-03", method: "cash" })
    const d = await caller.payment.create({ studentId: st.id, ...may, amount: 4000, paidAt: "2026-05-20", method: "cash" })

    const list = await caller.payment.list({ studentId: st.id, ...may })
    expect(list.map((p) => p.id)).toEqual([d.id, b.id, a.id, c.id])
  })

  it("✓ sửa số tiền → paidAmount đổi; xoá → giảm; xoá hết → 0 và isFullPaid giữ nguyên", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [{ date: "2026-05-10", fee: 500000 }])
    const a = await caller.payment.create({ studentId: st.id, ...may, amount: 300000, paidAt: "2026-05-12", method: "cash" })
    const b = await caller.payment.create({ studentId: st.id, ...may, amount: 200000, paidAt: "2026-05-13", method: "cash" })
    await caller.tuition.updateSettlement({ studentId: st.id, ...may, isFullPaid: true })

    const updated = await caller.payment.update({ id: a.id, data: { amount: 250000 } })
    expect(updated.amount).toBe(250000)
    expect((await paidOf(caller, st.id, 2026, 5)).paidAmount).toBe(450000)
    await expectInvariant()

    await caller.payment.delete({ id: b.id })
    expect((await paidOf(caller, st.id, 2026, 5)).paidAmount).toBe(250000)
    await expectInvariant()

    await caller.payment.delete({ id: a.id })
    const row = await paidOf(caller, st.id, 2026, 5)
    expect(row.paidAmount).toBe(0)
    expect(row.isFullPaid).toBe(true)
    expect(await caller.payment.list({ studentId: st.id, ...may })).toEqual([])
    await expectInvariant()
  })

  it("✓ update chỉ đổi trường được gửi, không xoá ghi chú; note rỗng thì xoá", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [])
    const p = await caller.payment.create({
      studentId: st.id, ...may, amount: 100000, paidAt: "2026-05-12", method: "cash", note: "Mẹ đóng",
    })

    const r1 = await caller.payment.update({ id: p.id, data: { method: "transfer", paidAt: "2026-05-14" } })
    expect(r1).toEqual({ id: p.id, amount: 100000, paidAt: "2026-05-14", method: "transfer", note: "Mẹ đóng" })

    const r2 = await caller.payment.update({ id: p.id, data: { note: "" } })
    expect(r2.note).toBeNull()
  })

  it("✓ thu cho tháng chưa mở → snapshot giữ previousBalance đúng", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [
      { date: "2026-04-10", fee: 150000 },
      { date: "2026-05-10", fee: 100000 },
    ])
    // Không mở tháng 4 và tháng 5 trước khi thu.
    await caller.payment.create({ studentId: st.id, ...may, amount: 200000, paidAt: "2026-05-12", method: "cash" })

    const row = await paidOf(caller, st.id, 2026, 5)
    expect(row.previousBalance).toBe(150000)
    expect(row.totalExpected).toBe(100000)
    expect(row.totalAmountDue).toBe(250000)
    expect(row.paidAmount).toBe(200000)
    await expectInvariant()
  })

  it("✓ carry-over: thu thiếu tháng 7 → tháng 8 còn nợ; thu thêm thành dư → tín dụng âm", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [{ date: "2026-07-10", fee: 500000 }])
    const jul = { year: 2026, month: 7 }

    await caller.payment.create({ studentId: st.id, ...jul, amount: 300000, paidAt: "2026-07-15", method: "cash" })
    expect((await paidOf(caller, st.id, 2026, 8)).previousBalance).toBe(200000)

    await caller.payment.create({ studentId: st.id, ...jul, amount: 400000, paidAt: "2026-07-20", method: "transfer" })
    expect((await paidOf(caller, st.id, 2026, 8)).previousBalance).toBe(-200000)
    await expectInvariant()
  })

  it("✓ 2 lần create song song cho tháng chưa mở → paidAmount = tổng cả 2", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [{ date: "2026-05-10", fee: 500000 }])

    await Promise.all([
      caller.payment.create({ studentId: st.id, ...may, amount: 300000, paidAt: "2026-05-12", method: "cash" }),
      caller.payment.create({ studentId: st.id, ...may, amount: 200000, paidAt: "2026-05-12", method: "cash" }),
    ])

    expect((await paidOf(caller, st.id, 2026, 5)).paidAmount).toBe(500000)
    expect(await caller.payment.list({ studentId: st.id, ...may })).toHaveLength(2)
    await expectInvariant()
  })

  it("✓ HS không có ca trong tháng vẫn thu được (tạo dòng tháng rỗng)", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [])
    await caller.payment.create({ studentId: st.id, year: 2026, month: 9, amount: 50000, paidAt: "2026-09-01", method: "cash" })

    const mt = await db.monthlyTuition.findUniqueOrThrow({
      where: { studentId_year_month: { studentId: st.id, year: 2026, month: 9 } },
    })
    expect(mt.paidAmount).toBe(50000)
    await expectInvariant()
  })

  it("✗ multi-tenant: user khác list/update/delete/create → NOT_FOUND, dữ liệu A không đổi", async () => {
    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")
    const st = await seedStudent(callerA, [])
    const p = await callerA.payment.create({ studentId: st.id, ...may, amount: 100000, paidAt: "2026-05-12", method: "cash" })

    await expect(callerB.payment.list({ studentId: st.id, ...may })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(callerB.payment.update({ id: p.id, data: { amount: 1 } })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(callerB.payment.delete({ id: p.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      callerB.payment.create({ studentId: st.id, ...may, amount: 1, paidAt: "2026-05-12", method: "cash" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const list = await callerA.payment.list({ studentId: st.id, ...may })
    expect(list).toHaveLength(1)
    expect(list[0].amount).toBe(100000)
  })

  it("✗ input sai → BAD_REQUEST, không ghi gì", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [])
    const base = { studentId: st.id, ...may, amount: 100000, paidAt: "2026-05-12", method: "cash" as const }

    await expect(caller.payment.create({ ...base, amount: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(caller.payment.create({ ...base, paidAt: "2026-13-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(caller.payment.create({ ...base, method: "card" as "cash" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.payment.count()).toBe(0)
  })

  it("✓ xoá cứng học sinh → Payment của HS đó bị xoá theo", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [])
    const p = await caller.payment.create({ studentId: st.id, ...may, amount: 100000, paidAt: "2026-05-12", method: "cash" })

    // student.delete của app là xoá mềm; kiểm FK cascade bằng xoá cứng.
    await db.student.delete({ where: { id: st.id } })
    expect(await db.payment.count({ where: { id: p.id } })).toBe(0)
  })
})

describe("tuition.updateSettlement", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("✓ đặt isFullPaid + notes, không chèn ghi vết, không đổi paidAmount; không gửi notes thì giữ", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [{ date: "2026-05-10", fee: 100000 }])
    await caller.payment.create({ studentId: st.id, ...may, amount: 30000, paidAt: "2026-05-12", method: "cash" })

    await caller.tuition.updateSettlement({ studentId: st.id, ...may, isFullPaid: true, notes: "Miễn phần còn lại" })
    let row = await paidOf(caller, st.id, 2026, 5)
    expect(row.isFullPaid).toBe(true)
    expect(row.notes).toBe("Miễn phần còn lại")
    expect(row.paidAmount).toBe(30000)

    await caller.tuition.updateSettlement({ studentId: st.id, ...may, isFullPaid: false })
    row = await paidOf(caller, st.id, 2026, 5)
    expect(row.isFullPaid).toBe(false)
    expect(row.notes).toBe("Miễn phần còn lại")
    await expectInvariant()
  })

  it("✓ tháng chưa mở → snapshot giữ carry-over", async () => {
    const caller = await getAuthedCaller()
    const st = await seedStudent(caller, [
      { date: "2026-04-10", fee: 150000 },
      { date: "2026-05-10", fee: 100000 },
    ])
    await caller.tuition.updateSettlement({ studentId: st.id, ...may, isFullPaid: false, notes: "Hẹn cuối tháng" })

    const row = await paidOf(caller, st.id, 2026, 5)
    expect(row.previousBalance).toBe(150000)
    expect(row.totalAmountDue).toBe(250000)
    expect(row.notes).toBe("Hẹn cuối tháng")
  })

  it("✗ HS của user khác → NOT_FOUND", async () => {
    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")
    const st = await seedStudent(callerA, [])
    await expect(
      callerB.tuition.updateSettlement({ studentId: st.id, ...may, isFullPaid: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/schemas/payment.schema.test.ts tests/integration/payment.test.ts`
Expected: FAIL. Không resolve `@/lib/schemas/payment`; `caller.payment` / `caller.tuition.updateSettlement` undefined.

- [ ] **Step 4: Schema `src/lib/schemas/payment.ts`**

```ts
import { z } from "zod"

export const PAYMENT_METHODS = ["cash", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

// Cùng quy ước "YYYY-MM-DD" với sessionDate; regex không chặn được ngày không có thật (2026-13-01).
const paidAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, "Ngày không hợp lệ")

// undefined giữ nguyên (update không đụng ghi chú); rỗng sau trim → null.
const noteSchema = z
  .string()
  .trim()
  .max(500, "Ghi chú tối đa 500 ký tự")
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v))

const monthKey = {
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
}

const amountSchema = z.number().int().min(1, "Số tiền phải lớn hơn 0")

export const paymentCreateSchema = z.object({
  ...monthKey,
  amount: amountSchema,
  paidAt: paidAtSchema,
  method: z.enum(PAYMENT_METHODS),
  note: noteSchema,
})

export const paymentUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: z.object({
    amount: amountSchema.optional(),
    paidAt: paidAtSchema.optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    note: noteSchema,
  }),
})

export const paymentListSchema = z.object(monthKey)
export const paymentDeleteSchema = z.object({ id: z.number().int().positive() })

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>
export type PaymentUpdateData = PaymentUpdateInput["data"]
export type PaymentListInput = z.infer<typeof paymentListSchema>
```

- [ ] **Step 5: `src/lib/schemas/tuition.ts` — thêm `updateSettlementSchema`**

Thêm vào cuối file (KHÔNG xoá `updatePaymentSchema` ở task này — sheet cũ còn dùng; Task 5 xoá):

```ts
export const updateSettlementSchema = z.object({
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  isFullPaid: z.boolean(),
  notes: z.string().optional().nullable(),
})

export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>
```

- [ ] **Step 6: `PaymentDTO` trong `src/lib/types/models.ts`**

Thêm dòng import ở đầu file (sau import `@prisma/client`):

```ts
import type { PaymentMethod } from "@/lib/schemas/payment"
```

Thêm vào cuối file:

```ts
/**
 * Một lần thu tiền của 1 tháng học phí (spec B §11). paidAt dạng "YYYY-MM-DD".
 */
export interface PaymentDTO {
  id: number
  amount: number
  paidAt: string
  method: PaymentMethod
  note: string | null
}
```

- [ ] **Step 7: `tuition.service.ts` — `ensureMonthlyTuition`, `updateSettlement`**

Đổi dòng import đầu file:

```ts
import { Prisma, type PrismaClient, type MonthlyTuition, type SessionStudent } from "@prisma/client"
```

Đổi dòng import schema:

```ts
import type { MonthlyTuitionFilterInput, UpdatePaymentInput, UpdateSettlementInput } from "@/lib/schemas/tuition"
```

Thêm 2 hàm ngay TRƯỚC `export async function updateTuitionPayment(` (để nguyên `updateTuitionPayment`, Task 5 xoá):

```ts
/**
 * Đảm bảo có dòng MonthlyTuition (kèm carry-over đúng) trước khi ghi tiền/tất toán.
 * Tạo dòng trần sẽ đông cứng previousBalance = 0 và làm mất nợ tháng trước
 * (xem tests/integration/tuition-payment-snapshot.test.ts).
 */
export async function ensureMonthlyTuition(
  db: PrismaClient,
  userId: number,
  studentId: number,
  year: number,
  month: number
): Promise<MonthlyTuition> {
  const student = await db.student.findUnique({ where: { id: studentId } })
  assertOwnership(student, userId)

  try {
    await getMonthlyTuitionStatus(db, userId, { studentId, year, month, status: "all", page: 1, limit: 1 })
  } catch (e) {
    // 2 request cùng mở tháng mới: upsert snapshot không nguyên tử, bên thua gặp P2002 nhưng dòng đã có.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e
  }

  return db.monthlyTuition.upsert({
    where: { studentId_year_month: { studentId, year, month } },
    update: {},
    create: { studentId, year, month },
  })
}

// Tất toán (miễn phần còn lại) + ghi chú tháng; không đụng paidAmount, không ghi vết.
export async function updateSettlement(
  db: PrismaClient,
  userId: number,
  input: UpdateSettlementInput
): Promise<MonthlyTuition> {
  const mt = await ensureMonthlyTuition(db, userId, input.studentId, input.year, input.month)
  return db.monthlyTuition.update({
    where: { id: mt.id },
    data: {
      isFullPaid: input.isFullPaid,
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  })
}
```

- [ ] **Step 8: `src/server/services/payment.service.ts` (MỚI)**

```ts
import type { Payment, Prisma, PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { assertOwnership } from "./_base.service"
import { ensureMonthlyTuition } from "./tuition.service"
import type {
  PaymentCreateInput,
  PaymentListInput,
  PaymentMethod,
  PaymentUpdateData,
} from "@/lib/schemas/payment"
import type { PaymentDTO } from "@/lib/types/models"

function toDTO(p: Payment): PaymentDTO {
  return {
    id: p.id,
    amount: p.amount,
    paidAt: p.paidAt.toISOString().slice(0, 10),
    method: p.method as PaymentMethod,
    note: p.note,
  }
}

/**
 * HÀM DUY NHẤT được ghi MonthlyTuition.paidAmount (ngoài create paidAmount: 0 của snapshot).
 * Tính lại bằng aggregate, không cộng dồn, để không bao giờ lệch tổng Payment.
 */
export async function syncPaidAmount(tx: Prisma.TransactionClient, monthlyTuitionId: number): Promise<number> {
  const { _sum } = await tx.payment.aggregate({ where: { monthlyTuitionId }, _sum: { amount: true } })
  const paidAmount = _sum.amount ?? 0
  await tx.monthlyTuition.update({ where: { id: monthlyTuitionId }, data: { paidAmount } })
  return paidAmount
}

// Khoá dòng tháng: 2 lần ghi cùng lúc phải chờ nhau, nếu không SUM sẽ đọc thiếu lần kia.
async function lockMonth(tx: Prisma.TransactionClient, monthlyTuitionId: number) {
  await tx.$queryRaw`SELECT id FROM monthly_tuition WHERE id = ${monthlyTuitionId} FOR UPDATE`
}

async function findOwnedPayment(db: PrismaClient, userId: number, id: number) {
  const payment = await db.payment.findUnique({
    where: { id },
    include: { monthlyTuition: { select: { student: { select: { userId: true } } } } },
  })
  if (!payment || payment.monthlyTuition.student.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  return payment
}

export async function listPayments(
  db: PrismaClient,
  userId: number,
  { studentId, year, month }: PaymentListInput
): Promise<PaymentDTO[]> {
  const student = await db.student.findUnique({ where: { id: studentId } })
  assertOwnership(student, userId)

  const rows = await db.payment.findMany({
    where: { monthlyTuition: { studentId, year, month } },
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
  })
  return rows.map(toDTO)
}

export async function createPayment(
  db: PrismaClient,
  userId: number,
  input: PaymentCreateInput
): Promise<PaymentDTO> {
  const mt = await ensureMonthlyTuition(db, userId, input.studentId, input.year, input.month)
  const created = await db.$transaction(async (tx) => {
    await lockMonth(tx, mt.id)
    const p = await tx.payment.create({
      data: {
        monthlyTuitionId: mt.id,
        amount: input.amount,
        paidAt: new Date(input.paidAt),
        method: input.method,
        note: input.note ?? null,
      },
    })
    await syncPaidAmount(tx, mt.id)
    return p
  })
  return toDTO(created)
}

// Không cho chuyển sang tháng khác (spec S6): muốn đổi tháng thì xoá rồi thêm lại.
export async function updatePayment(
  db: PrismaClient,
  userId: number,
  id: number,
  data: PaymentUpdateData
): Promise<PaymentDTO> {
  const existing = await findOwnedPayment(db, userId, id)
  const updated = await db.$transaction(async (tx) => {
    await lockMonth(tx, existing.monthlyTuitionId)
    const p = await tx.payment.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.paidAt !== undefined && { paidAt: new Date(data.paidAt) }),
        ...(data.method !== undefined && { method: data.method }),
        ...(data.note !== undefined && { note: data.note }),
      },
    })
    await syncPaidAmount(tx, existing.monthlyTuitionId)
    return p
  })
  return toDTO(updated)
}

export async function deletePayment(db: PrismaClient, userId: number, id: number): Promise<{ id: number }> {
  const existing = await findOwnedPayment(db, userId, id)
  await db.$transaction(async (tx) => {
    await lockMonth(tx, existing.monthlyTuitionId)
    await tx.payment.delete({ where: { id } })
    await syncPaidAmount(tx, existing.monthlyTuitionId)
  })
  return { id }
}
```

- [ ] **Step 9: Router**

`src/server/trpc/routers/payment.ts` (MỚI):

```ts
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import {
  paymentCreateSchema,
  paymentDeleteSchema,
  paymentListSchema,
  paymentUpdateSchema,
} from "@/lib/schemas/payment"
import {
  createPayment,
  deletePayment,
  listPayments,
  updatePayment,
} from "@/server/services/payment.service"

export const paymentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(paymentListSchema)
    .query(({ ctx, input }) => listPayments(ctx.db, ctx.userId, input)),

  create: protectedProcedure
    .input(paymentCreateSchema)
    .mutation(({ ctx, input }) => createPayment(ctx.db, ctx.userId, input)),

  update: protectedProcedure
    .input(paymentUpdateSchema)
    .mutation(({ ctx, input }) => updatePayment(ctx.db, ctx.userId, input.id, input.data)),

  delete: protectedProcedure
    .input(paymentDeleteSchema)
    .mutation(({ ctx, input }) => deletePayment(ctx.db, ctx.userId, input.id)),
})
```

`src/server/trpc/root.ts`: thêm `import { paymentRouter } from "@/server/trpc/routers/payment"` và dòng `payment: paymentRouter,` ngay sau `tuition: tuitionRouter,`.

`src/server/trpc/routers/tuition.ts`: sửa 2 dòng import và thêm procedure (giữ `updatePayment` tới Task 5):

```ts
import { monthlyTuitionFilterSchema, updatePaymentSchema, updateSettlementSchema } from "@/lib/schemas/tuition"
import { getMonthlyTuitionStatus, updateSettlement, updateTuitionPayment } from "@/server/services/tuition.service"
```

```ts
  updateSettlement: protectedProcedure
    .input(updateSettlementSchema)
    .mutation(({ ctx, input }) => updateSettlement(ctx.db, ctx.userId, input)),
```

- [ ] **Step 10: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/schemas/payment.schema.test.ts tests/integration/payment.test.ts`
Expected: PASS (unit 8/8, integration 14/14).

Run: `pnpm test tests/integration/tuition-payment-snapshot.test.ts tests/integration/payment-migration.test.ts`
Expected: PASS (đường cũ vẫn chạy).

- [ ] **Step 11: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 12: Commit**

```bash
git add src/lib/schemas/payment.ts src/lib/schemas/tuition.ts src/lib/types/models.ts src/server/services/tuition.service.ts src/server/services/payment.service.ts src/server/trpc/routers/payment.ts src/server/trpc/root.ts src/server/trpc/routers/tuition.ts tests/helpers/payment.ts tests/integration/payment.test.ts tests/unit/schemas/payment.schema.test.ts
git commit -m "feat(payment): router payment.* và tuition.updateSettlement, paidAmount tính lại trong transaction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: i18n + hàm thuần hiển thị số tiền

**Đọc trước:** spec §6.2 mục 2, §6.3, §9; `src/lib/utils.ts` (`vnDateParts`); `src/lib/tuition-status.ts` (quy ước kẹp `totalAmountDue` âm về 0).

**Files:**
- Create: `src/lib/payment-summary.ts`
- Test: `tests/unit/lib/payment-summary.test.ts`
- Modify: `src/language/vi.json`, `src/language/en.json`

**Interfaces:**
- Produces:
  - `type PaymentSummaryLine = { kind: "remaining" | "overpaid" | "waived"; amount: number }`
  - `paymentSummaryLine(m: { totalAmountDue: number; paidAmount: number; isFullPaid: boolean }): PaymentSummaryLine`
  - `remainingToFill(totalAmountDue: number, paidAmount: number, editingAmount?: number): number`
  - `vnTodayIso(now?: Date): string` → `"YYYY-MM-DD"` theo giờ VN
  - 18 key i18n: `payment_history`, `add_payment`, `add_payment_title`, `edit_payment`, `payment_amount`, `payment_date`, `payment_method`, `method_cash`, `method_transfer`, `fill_remaining`, `paid_total`, `remaining`, `overpaid_amount`, `waived`, `no_payments`, `payment_saved`, `delete_payment_confirm`, `settlement_saved`.

- [ ] **Step 1: Viết unit test (fail)**

`tests/unit/lib/payment-summary.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { paymentSummaryLine, remainingToFill, vnTodayIso } from "@/lib/payment-summary"

describe("paymentSummaryLine", () => {
  it("còn thiếu → remaining", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 300000, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 200000,
    })
  })

  it("trả đủ → remaining 0", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 500000, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 0,
    })
  })

  it("trả dư khi có nợ → overpaid", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 700000, isFullPaid: false })).toEqual({
      kind: "overpaid",
      amount: 200000,
    })
  })

  it("tháng có tín dụng (tổng phải đóng ≤ 0) → remaining 0, không coi là trả dư", () => {
    expect(paymentSummaryLine({ totalAmountDue: -50000, paidAmount: 0, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 0,
    })
    expect(paymentSummaryLine({ totalAmountDue: 0, paidAmount: 10000, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 0,
    })
  })

  it("đã tất toán mà còn thiếu → waived", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 300000, isFullPaid: true })).toEqual({
      kind: "waived",
      amount: 200000,
    })
  })

  it("đã tất toán và trả đủ → remaining 0", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 500000, isFullPaid: true })).toEqual({
      kind: "remaining",
      amount: 0,
    })
  })
})

describe("remainingToFill", () => {
  it("thêm mới: phần còn thiếu", () => {
    expect(remainingToFill(500000, 300000)).toBe(200000)
  })

  it("đã đủ, đã dư, hoặc có tín dụng → 0", () => {
    expect(remainingToFill(500000, 500000)).toBe(0)
    expect(remainingToFill(500000, 700000)).toBe(0)
    expect(remainingToFill(-50000, 0)).toBe(0)
  })

  it("khi sửa: bỏ số cũ của chính lần đang sửa ra khỏi số đã trả", () => {
    // Đã trả 700k (gồm lần đang sửa 400k) cho tổng 500k → điền 200k để vừa đủ.
    expect(remainingToFill(500000, 700000, 400000)).toBe(200000)
  })
})

describe("vnTodayIso", () => {
  it("dùng giờ VN (UTC+7), không dùng giờ UTC của máy", () => {
    // 2026-05-31T18:30Z = 01:30 ngày 01/06 giờ VN
    expect(vnTodayIso(new Date("2026-05-31T18:30:00Z"))).toBe("2026-06-01")
    expect(vnTodayIso(new Date("2026-01-05T03:00:00Z"))).toBe("2026-01-05")
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/payment-summary.test.ts`
Expected: FAIL, không resolve `@/lib/payment-summary`.

- [ ] **Step 3: Viết `src/lib/payment-summary.ts`**

```ts
import { vnDateParts } from "./utils"

export type PaymentSummaryLine = { kind: "remaining" | "overpaid" | "waived"; amount: number }

// Dòng dưới "Đã trả" trong sheet (spec B §6.2). Tổng phải đóng ≤ 0 là tín dụng, không tính trả dư.
export function paymentSummaryLine(m: {
  totalAmountDue: number
  paidAmount: number
  isFullPaid: boolean
}): PaymentSummaryLine {
  if (m.totalAmountDue > 0 && m.paidAmount > m.totalAmountDue) {
    return { kind: "overpaid", amount: m.paidAmount - m.totalAmountDue }
  }
  const remaining = Math.max(0, m.totalAmountDue - m.paidAmount)
  if (m.isFullPaid && remaining > 0) return { kind: "waived", amount: remaining }
  return { kind: "remaining", amount: remaining }
}

// Nút "Số còn lại": khi sửa, số cũ của chính lần đang sửa không tính là đã trả.
export function remainingToFill(totalAmountDue: number, paidAmount: number, editingAmount = 0): number {
  return Math.max(0, totalAmountDue - (paidAmount - editingAmount))
}

export function vnTodayIso(now: Date = new Date()): string {
  const { year, month, day } = vnDateParts(now)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/payment-summary.test.ts`
Expected: PASS 10/10.

- [ ] **Step 5: Thêm 18 key i18n (script giữ thứ tự và kiểu xuống dòng; ném lỗi nếu key đã có)**

```bash
node - <<'EOF'
const fs = require('fs')
const add = {
  vi: {
    payment_history: "Lịch sử thu tiền",
    add_payment: "Thu tiền",
    add_payment_title: "Thu tiền tháng",
    edit_payment: "Sửa lần thu",
    payment_amount: "Số tiền",
    payment_date: "Ngày thu",
    payment_method: "Hình thức",
    method_cash: "Tiền mặt",
    method_transfer: "Chuyển khoản",
    fill_remaining: "Số còn lại",
    paid_total: "Đã trả",
    remaining: "Còn lại",
    overpaid_amount: "Trả dư",
    waived: "Miễn giảm",
    no_payments: "Chưa có lần thu nào",
    payment_saved: "Đã lưu lần thu",
    delete_payment_confirm: "Xoá lần thu {amount} ngày {date}? Số đã trả của tháng sẽ giảm tương ứng.",
    settlement_saved: "Đã lưu tất toán và ghi chú",
  },
  en: {
    payment_history: "Payment history",
    add_payment: "Record payment",
    add_payment_title: "Payment for",
    edit_payment: "Edit payment",
    payment_amount: "Amount",
    payment_date: "Payment date",
    payment_method: "Method",
    method_cash: "Cash",
    method_transfer: "Bank transfer",
    fill_remaining: "Remaining amount",
    paid_total: "Paid",
    remaining: "Remaining",
    overpaid_amount: "Overpaid",
    waived: "Waived",
    no_payments: "No payments yet",
    payment_saved: "Payment saved",
    delete_payment_confirm: "Delete the {amount} payment on {date}? The month's paid total will decrease.",
    settlement_saved: "Settlement and notes saved",
  },
}
for (const l of ['vi', 'en']) {
  const p = `src/language/${l}.json`
  const raw = fs.readFileSync(p, 'utf8')
  const o = JSON.parse(raw)
  for (const [k, v] of Object.entries(add[l])) {
    if (k in o) throw new Error('dup ' + k)
    o[k] = v
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  fs.writeFileSync(p, JSON.stringify(o, null, 2).replace(/\n/g, eol) + (raw.endsWith('\n') ? eol : ''))
}
EOF
```

- [ ] **Step 6: Kiểm tra parity**

Run:
```bash
node -e "const vi=require('./src/language/vi.json'),en=require('./src/language/en.json');const a=Object.keys(vi),b=Object.keys(en);const d=[...a.filter(k=>!(k in en)),...b.filter(k=>!(k in vi))];console.log(a.length,b.length,d.length?'LỆCH: '+d:'OK')"
```
Expected: `324 324 OK` (trước đó 306).

- [ ] **Step 7: Typecheck + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint` → không lỗi.

```bash
git add src/lib/payment-summary.ts tests/unit/lib/payment-summary.test.ts src/language/vi.json src/language/en.json
git commit -m "feat(payment): hàm tính dòng Còn lại/Trả dư/Miễn giảm, key i18n lịch sử thu tiền

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: UI — `PaymentFormDialog` + viết lại `TuitionDetailSheet` + E2E

**Đọc trước:** spec §6 (toàn bộ), §4 S3/S7, §10 phần E2E; file hiện tại `src/components/tuition/TuitionDetailSheet.tsx` (giữ khung Dialog desktop / Sheet mobile, phần đầu và bảng tính); `src/app/(app)/tuition/page.tsx` (cách mở sheet, KHÔNG sửa); `src/components/providers/TRPCProvider.tsx` (tự invalidate mọi query sau mutation); `src/components/subjects/SubjectList.tsx` (mẫu menu ⋯ + AlertDialog); `tests/e2e/mobile.spec.ts` (mẫu tạo HS/ca/điểm danh bằng UI); `playwright.config.ts`.

**Files:**
- Create: `src/components/tuition/PaymentFormDialog.tsx`
- Rewrite: `src/components/tuition/TuitionDetailSheet.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json` (xoá 17 key)
- Create: `.superpowers/pw-3100.config.ts` (KHÔNG commit)
- Test: `tests/e2e/tuition-payments.spec.ts`

**Interfaces:**
- Consumes: `payment.list/create/update/delete`, `tuition.updateSettlement`, `tuition.getMonthlyStatus` (Task 2); `PaymentDTO`, `PAYMENT_METHODS`, `PaymentMethod` (Task 2); `paymentSummaryLine`, `remainingToFill`, `vnTodayIso` (Task 3); key i18n (Task 3).
- Produces: `PaymentFormDialog` props `{ studentId, year, month, totalAmountDue, paidAmount, payment?: PaymentDTO, onClose }`. Test id: `payment-row` (mỗi lần thu), `paid-total` (số Đã trả), `remaining-line` (số Còn lại/Trả dư/Miễn giảm). Props của `TuitionDetailSheet` giữ nguyên `{ open, onOpenChange, data, onSuccess }`.

- [ ] **Step 1: Config Playwright tạm (không commit)**

`.superpowers/pw-3100.config.ts`:

```ts
// KHÔNG commit (đã thêm vào .git/info/exclude ở Task 1). Chạy e2e ở cổng 3100 khi 3000 bận.
import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

const webServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;

export default defineConfig({
  ...base,
  testDir: '../tests/e2e',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    ...webServer!,
    command: 'pnpm exec next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: true,
  },
});
```

Kiểm tra: `grep -c "pw-3100" .git/info/exclude` → `1` (nếu `0` thì thêm dòng `.superpowers/pw-3100.config.ts` vào `.git/info/exclude`).

- [ ] **Step 2: Viết e2e (fail)**

`tests/e2e/tuition-payments.spec.ts`:

```ts
import { test, expect, type Page, type Locator } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test.describe('Lịch sử thu tiền (390px)', () => {
  test.beforeEach(async ({ page }) => {
    // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal { display: none !important; }';
        document.head.appendChild(style);
      });
    });
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('thu 2 lần, sửa, xoá; Đã trả và badge cập nhật', async ({ page }) => {
    const studentName = `HS thu tiền ${Date.now()}`;
    const title = `Ca thu tiền ${Math.floor(Math.random() * 10000)}`;
    const startHour = Math.floor(Math.random() * 5) + 13; // 13:00 tới 17:00, tránh trùng ca có sẵn

    // 1. HS học phí 200.000/buổi
    await page.goto('/students');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.fill('input[id="fullName"]', studentName);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.fill('input[id="tuitionFee"]', '200000');
    await page.locator('button:has-text("Thêm")').last().click();
    await expect(page.getByText('Đã thêm học sinh')).toBeVisible();

    // 2. Ca hôm nay gắn HS, điểm danh Có mặt → tháng này phải đóng 200.000
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Bắt đầu (HH:mm)').fill(`${startHour}00`);
    await form.getByLabel('Kết thúc (HH:mm)').fill(`${startHour + 1}00`);
    await form.getByLabel('Môn học').click();
    await page.getByRole('option').first().click();
    await form.getByPlaceholder('Nhóm nâng cao').fill(title);
    await form.getByLabel(new RegExp(studentName)).click();
    await form.getByRole('button', { name: 'Tạo ca dạy' }).click();
    await expect(page.getByText('Tạo ca dạy thành công')).toBeVisible();

    await page.getByText(title).filter({ visible: true }).first().click();
    const detail = page.getByRole('dialog');
    await detail.getByRole('button', { name: 'Có mặt' }).first().click();
    await detail.getByRole('button', { name: 'Lưu điểm danh' }).click();
    await expect(page.getByText('Đã lưu điểm danh')).toBeVisible();
    await page.keyboard.press('Escape');

    // 3. /tuition → Ghi nhận
    await page.goto('/tuition');
    await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
    const card = page.getByTestId('list-card').filter({ hasText: studentName });
    await card.getByRole('button', { name: 'Ghi nhận' }).click();
    const sheet = page.getByRole('dialog', { name: 'Chi tiết học phí' });
    await expect(sheet.getByText('Chưa có lần thu nào')).toBeVisible();
    await expectNoHorizontalScroll(page);
    const addBtn = sheet.getByRole('button', { name: 'Thu tiền', exact: true });
    await expectTouchTarget(addBtn);

    // 4. Lần 1: 100.000 tiền mặt (mặc định)
    await addBtn.click();
    let payForm = page.getByRole('dialog', { name: /Thu tiền tháng/ });
    await expect(payForm.getByRole('button', { name: 'Tiền mặt' })).toHaveAttribute('aria-pressed', 'true');
    await payForm.getByLabel('Số tiền').fill('100000');
    await payForm.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText(/Đã lưu lần thu/).first()).toBeVisible();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(1);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/100\.000/);
    await expectTouchTarget(sheet.getByTestId('payment-row').first().getByRole('button', { name: 'Menu hành động' }));

    // 5. Lần 2: nút "Số còn lại" (100.000), chuyển khoản
    await sheet.getByRole('button', { name: 'Thu tiền', exact: true }).click();
    payForm = page.getByRole('dialog', { name: /Thu tiền tháng/ });
    await payForm.getByRole('button', { name: /Số còn lại/ }).click();
    await expect(payForm.getByLabel('Số tiền')).toHaveValue('100,000');
    await payForm.getByRole('button', { name: 'Chuyển khoản' }).click();
    await payForm.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(2);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/200\.000/);

    // Badge trên thẻ đổi thành "Đã đóng đủ"
    await page.keyboard.press('Escape');
    await expect(card.getByText('Đã đóng đủ')).toBeVisible();
    await card.getByRole('button', { name: 'Ghi nhận' }).click();

    // 6. Sửa lần 1 (tiền mặt) thành 50.000
    const cashRow = sheet.getByTestId('payment-row').filter({ hasText: 'Tiền mặt' });
    await cashRow.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Sửa' }).click();
    const editForm = page.getByRole('dialog', { name: 'Sửa lần thu' });
    await editForm.getByLabel('Số tiền').fill('50000');
    await editForm.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(sheet.getByTestId('paid-total')).toHaveText(/150\.000/);

    // 7. Xoá lần 2 (chuyển khoản), có xác nhận
    const transferRow = sheet.getByTestId('payment-row').filter({ hasText: 'Chuyển khoản' });
    await transferRow.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(sheet.getByTestId('payment-row')).toHaveCount(1);
    await expect(sheet.getByTestId('paid-total')).toHaveText(/50\.000/);
    await expectNoHorizontalScroll(page);

    // 8. Dọn dữ liệu: xoá ca rồi xoá HS (xoá mềm)
    await page.keyboard.press('Escape');
    await page.goto('/calendar');
    await page.getByText(title).filter({ visible: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
    await expect(page.getByText('Đã xóa ca dạy')).toBeVisible();

    await page.goto('/students');
    const studentCard = page.getByTestId('list-card').filter({ hasText: studentName });
    await studentCard.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Xóa' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByText('Đã xóa học sinh')).toBeVisible();
  });
});
```

Ghi chú: nếu bước 2 lệch UI thật (nhãn, placeholder), hãy đối chiếu `tests/e2e/mobile.spec.ts` (đang pass) và theo đúng nó.

- [ ] **Step 3: Chạy e2e, xác nhận fail**

Chạy `pnpm test tests/integration/payment.test.ts` trước để có seed user `teacher` trên DB test. Sau đó:
Run: `pnpm exec playwright test tests/e2e/tuition-payments.spec.ts` (nếu cổng 3000 bận: `pnpm exec playwright test -c .superpowers/pw-3100.config.ts tuition-payments`)
Expected: FAIL ở bước 3 (sheet cũ không có "Chưa có lần thu nào").

- [ ] **Step 4: `src/components/tuition/PaymentFormDialog.tsx` (MỚI)**

```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"
import { remainingToFill, vnTodayIso } from "@/lib/payment-summary"
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/schemas/payment"
import type { PaymentDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

const METHOD_LABEL = { cash: "method_cash", transfer: "method_transfer" } as const

type Props = {
  studentId: number
  year: number
  month: number
  totalAmountDue: number
  paidAmount: number
  payment?: PaymentDTO
  onClose: () => void
}

// Chỉ mount khi mở (xem TuitionDetailSheet) nên state khởi tạo thẳng từ props.
export function PaymentFormDialog({ studentId, year, month, totalAmountDue, paidAmount, payment, onClose }: Props) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState<number | undefined>(payment?.amount)
  const [paidAt, setPaidAt] = useState(payment?.paidAt ?? vnTodayIso())
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "cash")
  const [note, setNote] = useState(payment?.note ?? "")

  const handlers = {
    onSuccess: (saved: PaymentDTO) => {
      toast.success(`${t("payment_saved")} ${formatCurrency(saved.amount)}`)
      onClose()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  }
  const createMut = trpc.payment.create.useMutation(handlers)
  const updateMut = trpc.payment.update.useMutation(handlers)
  const isPending = createMut.isPending || updateMut.isPending

  const fill = remainingToFill(totalAmountDue, paidAmount, payment?.amount ?? 0)
  const canSave = !!amount && amount >= 1 && paidAt !== "" && !isPending

  const save = () => {
    if (!amount) return
    const data = { amount, paidAt, method, note }
    if (payment) updateMut.mutate({ id: payment.id, data })
    else createMut.mutate({ studentId, year, month, ...data })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {payment ? t("edit_payment") : `${t("add_payment_title")} ${month}/${year}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">{t("payment_amount")}</Label>
            <CurrencyInput
              id="payment-amount"
              inputMode="numeric"
              value={amount}
              onChange={setAmount}
              className="h-11 text-lg md:h-10"
            />
            {fill > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 md:h-9"
                onClick={() => setAmount(fill)}
              >
                {t("fill_remaining")}: {formatCurrency(fill)}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">{t("payment_date")}</Label>
            <Input
              id="payment-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-11 md:h-10"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("payment_method")}</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={method === m ? "default" : "outline"}
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                  className="h-11"
                >
                  {t(METHOD_LABEL[m])}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">{t("notes")}</Label>
            <Textarea
              id="payment-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[72px] text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 w-full sm:w-auto md:h-10">
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave} className="h-11 w-full sm:w-auto md:h-10">
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Viết lại `src/components/tuition/TuitionDetailSheet.tsx` (thay toàn bộ file)**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Calculator,
  History,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react"
import { type RouterOutputs, trpc } from "@/lib/trpc"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { paymentSummaryLine } from "@/lib/payment-summary"
import type { PaymentDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { PaymentFormDialog } from "./PaymentFormDialog"

type TuitionStatus = RouterOutputs["tuition"]["getMonthlyStatus"]["items"][number]
type SheetData = TuitionStatus & { year: number; month: number }

interface TuitionDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: SheetData | null
  onSuccess: () => void
}

export function TuitionDetailSheet({ open, onOpenChange, data, onSuccess }: TuitionDetailSheetProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (!data) return null

  // DialogContent/SheetContent chỉ mount khi mở → state tất toán khởi tạo lại từ data mỗi lần mở.
  const body = (
    <TuitionDetailBody
      data={data}
      onSaved={() => {
        onSuccess()
        onOpenChange(false)
      }}
    />
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("tuition_detail")}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-col overflow-hidden">{body}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[450px] p-0 flex flex-col h-full overflow-hidden gap-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("tuition_detail")}</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col overflow-hidden">{body}</div>
      </SheetContent>
    </Sheet>
  )
}

function TuitionDetailBody({ data, onSaved }: { data: SheetData; onSaved: () => void }) {
  const { t } = useTranslation()
  const { studentId, year, month } = data

  // `data` là bản chụp lúc mở; sheet vẫn mở sau mỗi lần thu nên đọc lại dòng tháng (TRPCProvider tự invalidate).
  const statusQuery = trpc.tuition.getMonthlyStatus.useQuery({ year, month, studentId, page: 1, limit: 1 })
  const row = statusQuery.data?.items[0] ?? data
  const paymentsQuery = trpc.payment.list.useQuery({ studentId, year, month })
  const payments = paymentsQuery.data ?? []

  const [isFullPaid, setIsFullPaid] = useState(data.isFullPaid)
  const [notes, setNotes] = useState(data.notes ?? "")
  const [form, setForm] = useState<{ open: false } | { open: true; payment?: PaymentDTO }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<PaymentDTO | null>(null)

  const settlementMut = trpc.tuition.updateSettlement.useMutation({
    onSuccess: () => {
      toast.success(t("settlement_saved"))
      onSaved()
    },
    onError: (e) => toast.error(e.message),
  })
  const deleteMut = trpc.payment.delete.useMutation({ onError: (e) => toast.error(e.message) })

  const summary = paymentSummaryLine(row)
  const summaryLabel = { remaining: t("remaining"), overpaid: t("overpaid_amount"), waived: t("waived") }[summary.kind]
  const shortfall = Math.max(0, row.totalAmountDue) - row.paidAmount
  const showWaivedWarning = isFullPaid && shortfall > 0
  const dirty = isFullPaid !== row.isFullPaid || notes !== (row.notes ?? "")

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Receipt className="size-5 text-blue-600" />
              {t("tuition_detail")}
            </div>
            <div className="text-sm text-slate-500">
              {t("student")}: <span className="font-medium text-slate-900">{row.fullName}</span> • {t("month")}{" "}
              {month}/{year}
            </div>
          </div>

          {/* Bảng tính */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <Calculator className="size-4" />
              {t("fee_breakdown")}
            </h3>
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("previous_balance_short")}</span>
                <span
                  className={cn(
                    "font-medium",
                    row.previousBalance > 0
                      ? "text-red-600"
                      : row.previousBalance < 0
                      ? "text-green-600"
                      : "text-slate-400"
                  )}
                >
                  {row.previousBalance > 0 ? "+" : ""}
                  {formatCurrency(row.previousBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {t("current_month_fee")} ({row.presentSessions}/{row.totalSessions} {t("sessions")})
                </span>
                <span className="font-medium text-slate-900">+{formatCurrency(row.totalExpected)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{t("total_amount_due")}</span>
                <span className="text-lg font-medium text-slate-900">{formatCurrency(row.totalAmountDue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("paid_total")}</span>
                <span data-testid="paid-total" className="font-medium text-slate-900">
                  {formatCurrency(row.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{summaryLabel}</span>
                <span
                  data-testid="remaining-line"
                  className={cn(
                    "font-medium",
                    summary.kind === "overpaid"
                      ? "text-green-600"
                      : summary.kind === "waived"
                      ? "text-teal-700"
                      : summary.amount > 0
                      ? "text-red-600"
                      : "text-slate-400"
                  )}
                >
                  {formatCurrency(summary.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Lịch sử thu tiền */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                <History className="size-4" />
                {t("payment_history")}
              </h3>
              <Button type="button" onClick={() => setForm({ open: true })} className="h-11 md:h-10">
                <Plus className="mr-1.5 size-4" />
                {t("add_payment")}
              </Button>
            </div>

            {paymentsQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : payments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                {t("no_payments")}
              </p>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li key={p.id} data-testid="payment-row" className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-700">{formatDate(p.paidAt)}</span>
                          <Badge variant="secondary" className="border-none bg-slate-100 font-medium text-slate-600">
                            {p.method === "transfer" ? t("method_transfer") : t("method_cash")}
                          </Badge>
                        </div>
                        {p.note && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.note}</p>}
                      </div>
                      <span className="shrink-0 whitespace-nowrap font-semibold text-slate-900">
                        {formatCurrency(p.amount)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 md:size-9"
                            aria-label={t("actions")}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setForm({ open: true, payment: p })}>
                            <Pencil className="mr-2 size-4" />
                            {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDeleteTarget(p)} className="text-red-600">
                            <Trash2 className="mr-2 size-4" />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tất toán & ghi chú tháng */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <Checkbox
                id="tuition-full-paid"
                checked={isFullPaid}
                onCheckedChange={(v) => setIsFullPaid(v === true)}
              />
              <Label htmlFor="tuition-full-paid" className="text-sm font-medium">
                {t("mark_fully_paid")}
              </Label>
            </div>

            {showWaivedWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-800">
                  {t("settled_waived_warning")} {formatCurrency(shortfall)}. {t("settled_waived_warning_suffix")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tuition-notes" className="text-xs font-bold text-slate-400">
                {t("notes")}
              </Label>
              <Textarea
                id="tuition-notes"
                placeholder={t("notes_placeholder")}
                className="min-h-[80px] text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-4 border-t bg-white p-6">
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-700">{t("payment_tip_snapshot")}</p>
        </div>
        <Button
          type="button"
          className="h-12 w-full rounded-xl font-bold"
          disabled={!dirty || settlementMut.isPending}
          onClick={() => settlementMut.mutate({ studentId, year, month, isFullPaid, notes })}
        >
          {settlementMut.isPending ? t("saving") : t("save")}
        </Button>
      </div>

      {form.open && (
        <PaymentFormDialog
          studentId={studentId}
          year={year}
          month={month}
          totalAmountDue={row.totalAmountDue}
          paidAmount={row.paidAmount}
          payment={form.payment}
          onClose={() => setForm({ open: false })}
        />
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_payment_confirm")
                .replace("{amount}", formatCurrency(deleteTarget?.amount ?? 0))
                .replace("{date}", deleteTarget ? formatDate(deleteTarget.paidAt) : "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) deleteMut.mutate({ id: deleteTarget.id })
                setDeleteTarget(null)
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 6: Xoá 17 key i18n không còn dùng**

Kiểm tra trước (mỗi key phải KHÔNG còn chỗ dùng trong `src`):
```bash
for k in recorded_amount cancel_payment cancel_payment_success cancel_payment_confirm_title cancel_payment_confirm_desc undo undo_success overpaid_note_prefix overpaid_note_suffix pay_current_month pay_full_debt amount_paid update_payment confirm_payment payment_saved_for_month keep payment_action; do echo "$k: $(grep -rln "[\"'\`]$k[\"'\`]" src --include=*.ts --include=*.tsx | tr '\n' ' ')"; done
```
Expected: mọi dòng đều rỗng sau dấu `:`. Key nào còn chỗ dùng → KHÔNG xoá key đó, ghi lại trong báo cáo.

Xoá:
```bash
node - <<'EOF'
const fs = require('fs')
const del = ['recorded_amount','cancel_payment','cancel_payment_success','cancel_payment_confirm_title','cancel_payment_confirm_desc','undo','undo_success','overpaid_note_prefix','overpaid_note_suffix','pay_current_month','pay_full_debt','amount_paid','update_payment','confirm_payment','payment_saved_for_month','keep','payment_action']
for (const l of ['vi', 'en']) {
  const p = `src/language/${l}.json`
  const raw = fs.readFileSync(p, 'utf8')
  const o = JSON.parse(raw)
  for (const k of del) {
    if (!(k in o)) throw new Error('missing ' + k)
    delete o[k]
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  fs.writeFileSync(p, JSON.stringify(o, null, 2).replace(/\n/g, eol) + (raw.endsWith('\n') ? eol : ''))
}
EOF
node -e "const vi=require('./src/language/vi.json'),en=require('./src/language/en.json');const a=Object.keys(vi),b=Object.keys(en);const d=[...a.filter(k=>!(k in en)),...b.filter(k=>!(k in vi))];console.log(a.length,b.length,d.length?'LỆCH: '+d:'OK')"
```
Expected: `307 307 OK`.

- [ ] **Step 7: Typecheck + lint + unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit`
Expected: không lỗi; unit pass (`payment-notes.test.ts` vẫn pass vì `mergeOverpaidNote` chưa bị xoá, Task 5 mới xoá).

- [ ] **Step 8: Chạy e2e, xác nhận pass**

Run (sau khi đã chạy ít nhất 1 lượt `pnpm test ...` để seed DB test): `pnpm exec playwright test tests/e2e/tuition-payments.spec.ts` (hoặc `-c .superpowers/pw-3100.config.ts tuition-payments`)
Expected: PASS 1/1.

Nếu fail vì chọn nhầm dialog (sheet bị `aria-hidden` khi dialog con mở), đổi locator sang `page.getByRole('dialog').last()` cho dialog con, KHÔNG sửa component chỉ để chiều test.

- [ ] **Step 9: Commit**

```bash
git add src/components/tuition/PaymentFormDialog.tsx src/components/tuition/TuitionDetailSheet.tsx src/language/vi.json src/language/en.json tests/e2e/tuition-payments.spec.ts
git status --short   # xác nhận KHÔNG có file .superpowers/
git commit -m "feat(tuition): sheet học phí hiện lịch sử thu tiền, dialog thu/sửa lần thu, lưu tất toán riêng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: Gỡ đường ghi cũ `tuition.updatePayment` + chuyển 8 file test

**Đọc trước:** spec §5 "Trong phạm vi" (dòng xoá), §10 (đoạn "Sửa các test đang gọi `tuition.updatePayment`" và Unit `payment-notes`), §12 dòng cuối (giữ nguyên mọi `expect` về số); `tests/helpers/payment.ts` (`recordPayment` từ Task 2).

Task này xoá mutation mà 8 file test đang gọi, nên phải sửa cả 8 file ngay trong task để suite vẫn xanh.

**Files:**
- Modify: `src/server/trpc/routers/tuition.ts`, `src/server/services/tuition.service.ts`, `src/lib/schemas/tuition.ts`, `src/lib/payment-notes.ts`
- Modify: `tests/unit/lib/payment-notes.test.ts`
- Modify (8 file): `tests/integration/tuition.test.ts`, `tuition-fullpaid-settlement.test.ts`, `tuition-payment-cancel.test.ts`, `tuition-payment-snapshot.test.ts`, `tuition-report-consistency.test.ts`, `tuition-status-filter.test.ts`, `group-b-financial.test.ts`, `report.test.ts`

**Interfaces:**
- Consumes: `recordPayment(caller, { studentId, year, month, amount, isFullPaid? })`, `caller.payment.*`, `caller.tuition.updateSettlement` (Task 2).
- Produces: không còn `tuition.updatePayment`, `updateTuitionPayment`, `updatePaymentSchema`, `UpdatePaymentInput`, `buildPaymentAuditNote`, `mergeOverpaidNote`. `formatVnDate` giữ nguyên trong `src/lib/payment-notes.ts` (C dùng).

- [ ] **Step 1: Xoá code cũ (RED: các test cũ sẽ fail)**

`src/server/trpc/routers/tuition.ts`: xoá procedure `updatePayment: ...` (3 dòng), đổi import thành:
```ts
import { monthlyTuitionFilterSchema, updateSettlementSchema } from "@/lib/schemas/tuition"
import { getMonthlyTuitionStatus, updateSettlement } from "@/server/services/tuition.service"
```

`src/server/services/tuition.service.ts`: xoá toàn bộ hàm `updateTuitionPayment` (từ `export async function updateTuitionPayment(` tới hết `}` trước khối `/** Aggregate outstanding tuition ...`), xoá dòng `import { buildPaymentAuditNote } from "@/lib/payment-notes"`, đổi import schema thành:
```ts
import type { MonthlyTuitionFilterInput, UpdateSettlementInput } from "@/lib/schemas/tuition"
```

`src/lib/schemas/tuition.ts`: xoá khối `export const updatePaymentSchema = ...` và `export type UpdatePaymentInput = ...`.

`src/lib/payment-notes.ts`: xoá hàm `mergeOverpaidNote` (kèm khối `/** ... */` phía trên), hàm `buildPaymentAuditNote` (kèm khối `/** ... */`), và dòng `import { formatCurrency } from "./utils"` (không còn dùng). Chỉ còn `formatVnDate` với ghi chú của nó.

`tests/unit/lib/payment-notes.test.ts`: thay toàn bộ file bằng:
```ts
import { describe, it, expect } from "vitest"
import { formatVnDate } from "@/lib/payment-notes"

describe("formatVnDate", () => {
  it("đổi sang ngày theo giờ VN (UTC+7), không dùng giờ server", () => {
    // 2026-08-01T18:30:00Z = 01:30 ngày 02/08 giờ VN
    expect(formatVnDate(new Date("2026-08-01T18:30:00Z"))).toBe("02/08/2026")
  })
})
```

Run: `pnpm exec tsc --noEmit`
Expected: FAIL. Lỗi `Property 'updatePayment' does not exist` ở đúng 8 file test (31 chỗ gọi). Đây là danh sách phải sửa ở các bước sau.

- [ ] **Step 2: `tests/integration/tuition.test.ts`**

Thêm import: `import { recordPayment } from "../helpers/payment"` (dòng này có thể không cần nếu file không dùng; xem dưới — file này KHÔNG dùng `recordPayment`, bỏ qua import).

Thay nguyên test `it("✓ updatePayment → lưu thông tin đóng tiền", ...)` (dòng ~98–133) bằng:

```ts
  it("✓ payment.create + updateSettlement → lưu thông tin đóng tiền", async () => {
    const caller = await getAuthedCaller()
    const student = await caller.student.create({ fullName: "An", grade: 3 })
    const key = { studentId: student.id, year: 2026, month: 5 }

    await caller.payment.create({ ...key, amount: 150000, paidAt: "2026-05-15", method: "cash" })
    await caller.tuition.updateSettlement({ ...key, isFullPaid: false, notes: "Mới đóng một nửa" })

    const status = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })
    expect(status.items[0].paidAmount).toBe(150000)
    expect(status.items[0].isFullPaid).toBe(false)
    expect(status.items[0].notes).toBe("Mới đóng một nửa")

    // Lần thu thứ 2 cộng dồn; tất toán + ghi chú lưu riêng, không còn dòng ghi vết tự chèn.
    await caller.payment.create({ ...key, amount: 50000, paidAt: "2026-05-20", method: "transfer" })
    await caller.tuition.updateSettlement({ ...key, isFullPaid: true, notes: "Đã đóng đủ" })

    const updatedStatus = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })
    expect(updatedStatus.items[0].paidAmount).toBe(200000)
    expect(updatedStatus.items[0].isFullPaid).toBe(true)
    expect(updatedStatus.items[0].notes).toBe("Đã đóng đủ")
  }, 30_000)
```

Thay nguyên test `it("✗ updatePayment student của user khác → NOT_FOUND", ...)` bằng:

```ts
  it("✗ payment.create / updateSettlement student của user khác → NOT_FOUND", async () => {
    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")
    const sA = await callerA.student.create({ fullName: "HS của A", grade: 3 })

    await expect(
      callerB.payment.create({ studentId: sA.id, year: 2026, month: 5, amount: 100000, paidAt: "2026-05-15", method: "cash" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      callerB.tuition.updateSettlement({ studentId: sA.id, year: 2026, month: 5, isFullPaid: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
```

- [ ] **Step 3: `tests/integration/tuition-payment-cancel.test.ts` (thay toàn bộ file)**

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

/**
 * Đóng nhầm tiền / nhầm tháng phải HỦY được: xoá lần thu và bỏ tất toán thì nợ
 * phải hiện lại đúng ở tháng đó VÀ chuyển đúng sang tháng sau (không bị
 * Math.min(0, residual) của isFullPaid nuốt mất).
 */
describe("Hủy / sửa ghi nhận thanh toán học phí", () => {
  beforeEach(async () => {
    await cleanup()
  })

  async function seedJulyDebt(fee: number) {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const student = await caller.student.create({
      fullName: "HS Đóng Nhầm",
      grade: 5,
      tuitionFee: fee,
    })
    const s = await caller.session.create({
      sessionDate: "2026-07-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subjects[0].id,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee }],
    })
    return { caller, student }
  }

  async function payAndSettleThenCancel(fee: number) {
    const { caller, student } = await seedJulyDebt(fee)
    const key = { studentId: student.id, year: 2026, month: 7 }
    const p = await caller.payment.create({ ...key, amount: fee, paidAt: "2026-07-15", method: "cash" })
    await caller.tuition.updateSettlement({ ...key, isFullPaid: true })
    await caller.payment.delete({ id: p.id })
    await caller.tuition.updateSettlement({ ...key, isFullPaid: false })
    return { caller, student }
  }

  it("hủy thanh toán (xoá lần thu, bỏ tất toán) làm nợ hiện lại trong chính tháng đó", async () => {
    const { caller, student } = await payAndSettleThenCancel(500000)

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].paidAmount).toBe(0)
    expect(july.items[0].isFullPaid).toBe(false)
    expect(july.items[0].totalAmountDue).toBe(500000)
  }, 20000)

  it("hủy thanh toán trả lại nợ cho tháng sau (không bị tất toán nuốt mất)", async () => {
    const { caller, student } = await payAndSettleThenCancel(500000)

    const aug = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })
    expect(aug.items[0].previousBalance).toBe(500000)
  }, 20000)

  it("chuyển tiền đóng nhầm từ tháng 7 sang tháng 8 (xoá rồi thêm lại) cho ra số dư đúng ở cả hai tháng", async () => {
    const { caller, student } = await seedJulyDebt(500000)
    const subjects = await caller.subject.list({})
    const aug = await caller.session.create({
      sessionDate: "2026-08-10", startTime: "08:00", endTime: "09:30", subjectId: subjects[0].id,
    })
    await caller.session.addStudents({ sessionId: aug.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: aug.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 400000 }],
    })

    // Đóng nhầm vào tháng 7
    const wrong = await caller.payment.create({
      studentId: student.id, year: 2026, month: 7, amount: 400000, paidAt: "2026-08-12", method: "cash",
    })
    // Xoá ở tháng 7, thêm lại vào tháng 8
    await caller.payment.delete({ id: wrong.id })
    await caller.payment.create({
      studentId: student.id, year: 2026, month: 8, amount: 400000, paidAt: "2026-08-12", method: "cash",
    })

    const julyView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    const augView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })

    expect(julyView.items[0].paidAmount).toBe(0)
    expect(augView.items[0].previousBalance).toBe(500000) // nợ tháng 7 vẫn còn nguyên
    expect(augView.items[0].totalAmountDue).toBe(900000)  // 500k nợ + 400k tháng 8
    expect(augView.items[0].paidAmount).toBe(400000)
  }, 20000)
})
```

(Đã bỏ 2 test ghi vết notes: "ghi vết dòng audit vào notes khi hủy…" và "KHÔNG ghi vết ở lần ghi nhận đầu tiên", theo spec §10.)

- [ ] **Step 4: 6 file còn lại — thay từng lời gọi bằng `recordPayment`**

Ở mỗi file dưới đây, thêm import `import { recordPayment } from "../helpers/payment"` cạnh import `getAuthedCaller`, rồi thay đúng từng lời gọi. Quy tắc: `caller.tuition.updatePayment({ studentId: S, year: Y, month: M, paidAmount: P, isFullPaid: F })` → `recordPayment(caller, { studentId: S, year: Y, month: M, amount: P, isFullPaid: F })`. Giữ nguyên `await`, tên biến và mọi `expect`.

`tests/integration/tuition-fullpaid-settlement.test.ts` (4 chỗ):
```ts
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 0, isFullPaid: true })
```
```ts
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 150000, isFullPaid: true })
```
```ts
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 30000, isFullPaid: false })
```
```ts
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 0, isFullPaid: true })
```

`tests/integration/tuition-payment-snapshot.test.ts` (1 chỗ):
```ts
    await recordPayment(caller, { studentId: student.id, year: 2026, month: 5, amount: 200000, isFullPaid: false })
```

`tests/integration/tuition-report-consistency.test.ts` (2 chỗ):
```ts
    await recordPayment(caller, { studentId: x.id, year: 2026, month: 5, amount: 50000, isFullPaid: false })
```
```ts
    await recordPayment(caller, { studentId: y.id, year: 2026, month: 5, amount: 300000, isFullPaid: true })
```

`tests/integration/tuition-status-filter.test.ts` (2 chỗ):
```ts
    await recordPayment(caller, { studentId: paid.id, year: 2026, month: 5, amount: 40000, isFullPaid: false })
```
```ts
    await recordPayment(caller, { studentId: over.id, year: 2026, month: 5, amount: 150000, isFullPaid: false })
```

`tests/integration/group-b-financial.test.ts` (6 chỗ, theo thứ tự trong file):
```ts
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 4, amount: 100000, isFullPaid: true })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 100000, isFullPaid: true })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 4, amount: 100000, isFullPaid: true })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 200000, isFullPaid: true })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 4, amount: 150000, isFullPaid: true })
    await recordPayment(caller, { studentId: st.id, year: 2026, month: 5, amount: 60000, isFullPaid: false })
```

`tests/integration/report.test.ts` (1 chỗ, trong test "dashboard.totalPaidMonth khớp…"; ở đây `caller` là biến của `describe`):
```ts
    await recordPayment(caller, { studentId: student.id, year, month, amount: 123000, isFullPaid: false })
```

Nếu ghi chú trong file cũ nhắc `updateTuitionPayment` (vd khối `/** ... */` đầu `tuition-payment-snapshot.test.ts`) thì giữ nguyên: đó là lịch sử lỗi, không sai.

- [ ] **Step 5: Kiểm tra không còn tham chiếu cũ**

Run: `grep -rn "updatePayment\b\|updateTuitionPayment\|updatePaymentSchema\|UpdatePaymentInput\|buildPaymentAuditNote\|mergeOverpaidNote" src tests --include=*.ts --include=*.tsx | grep -v "payment\.update\b"`
Expected: chỉ còn các dòng thuộc `src/server/services/payment.service.ts` (hàm `updatePayment` MỚI), `src/server/trpc/routers/payment.ts`, và ghi chú lịch sử trong `tuition-payment-snapshot.test.ts` (nếu có). Không còn `tuition.updatePayment`.

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Chạy lại 8 file + test payment**

Run (1 lệnh, tuần tự):
```bash
pnpm test tests/integration/tuition.test.ts tests/integration/tuition-fullpaid-settlement.test.ts tests/integration/tuition-payment-cancel.test.ts tests/integration/tuition-payment-snapshot.test.ts tests/integration/tuition-report-consistency.test.ts tests/integration/tuition-status-filter.test.ts tests/integration/group-b-financial.test.ts tests/integration/report.test.ts tests/integration/payment.test.ts tests/unit/lib/payment-notes.test.ts
```
Expected: PASS toàn bộ. Nếu một `expect` về số fail → KHÔNG sửa số trong `expect`; tìm nguyên nhân (thường do quên `isFullPaid` hoặc tháng thu sai) và báo lại nếu không giải thích được.

- [ ] **Step 7: Commit**

```bash
git add src/server/trpc/routers/tuition.ts src/server/services/tuition.service.ts src/lib/schemas/tuition.ts src/lib/payment-notes.ts tests/unit/lib/payment-notes.test.ts tests/integration
git commit -m "refactor(tuition): bỏ tuition.updatePayment và ghi vết notes, test chuyển sang payment.*

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: Kiểm chứng toàn bộ + bàn giao

**Đọc trước:** Global Constraints; spec §8.3, §10 "Chung"; `docs/coding-rule.md` §6.1 mục D.2.

**Files:** không sửa code. Chỉ sửa nếu có lỗi, và mỗi lần sửa là 1 commit riêng.

- [ ] **Step 1: Migration chỉ thêm, không xoá**

Run: `git diff main..HEAD -- prisma/migrations/ | grep -nE "DROP|ALTER TABLE \"monthly_tuition\"|DELETE|UPDATE " || echo "OK: chỉ thêm"`
Expected: `OK: chỉ thêm`.

Run: `node .superpowers/prisma-test.cjs migrate status`
Expected: host `ep-jolly-dew…`, `Database schema is up to date!` (5 migration).

- [ ] **Step 2: Toàn bộ unit + integration**

Run: `pnpm test`
Expected: PASS toàn bộ (~10–15 phút). Không chạy lệnh test nào khác song song.

- [ ] **Step 3: Toàn bộ e2e**

Run: `pnpm exec playwright test` (hoặc `pnpm exec playwright test -c .superpowers/pw-3100.config.ts` nếu cổng 3000 bận)
Expected: toàn bộ pass (upgrade-class có thể skip như trước).

- [ ] **Step 4: Lint, typecheck, build**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm exec next build`
Expected: sạch, build OK. (KHÔNG chạy `pnpm build`.)

- [ ] **Step 5: Dọn và xác nhận cây làm việc**

Run: `git status --short`
Expected: sạch (file trong `.superpowers/` không hiện nhờ `.git/info/exclude`).

- [ ] **Step 6: Bàn giao cho người điều phối (agent KHÔNG merge, KHÔNG push)**

Báo cáo: danh sách commit trên `feat/b-payments`, kết quả các lệnh ở Step 1–4, và chép nguyên mục "Kiểm tra tay cho người dùng" dưới đây vào báo cáo.

---

## Kiểm tra tay cho người dùng (agent KHÔNG chạy các bước này trên production)

Mọi câu SQL dưới đây chỉ đọc. Người dùng tự chạy trong Neon SQL Editor.

**A. Trước khi merge (thử trên bản sao production):**
1. Neon console → project production → tạo branch "Branch from current" (vd `pre-b-payments`). Đây cũng là bản sao lưu để quay lại nếu cần (coding-rule §6.1 D.4).
2. Trên branch đó chạy (A):
   ```sql
   SELECT COUNT(*), COALESCE(SUM("paid_amount"),0) FROM "monthly_tuition" WHERE "paid_amount" > 0;
   ```
   Ghi lại 2 số.
3. Áp migration lên branch (từ máy local, trỏ **connection string của branch**, không phải `.env`):
   `DATABASE_URL=<url-branch> DIRECT_URL=<url-branch-direct> pnpm exec prisma migrate deploy`
4. Trên branch chạy (B), kết quả phải bằng đúng (A):
   ```sql
   SELECT COUNT(*), COALESCE(SUM("amount"),0) FROM "payments";
   ```
5. Trên branch chạy (C), phải ra **0 dòng**:
   ```sql
   SELECT mt."id", mt."paid_amount", COALESCE(SUM(p."amount"),0) AS s
   FROM "monthly_tuition" mt LEFT JOIN "payments" p ON p."monthly_tuition_id" = mt."id"
   GROUP BY mt."id" HAVING mt."paid_amount" <> COALESCE(SUM(p."amount"),0);
   ```
6. Trên app production (chỉ xem, không ghi): chụp lại màn Báo cáo (`Đã thu`, `Còn nợ`) của 2–3 kỳ gần nhất và Dashboard (`Đã thu tháng này`).

**B. Khi merge/deploy:**
7. Không ghi học phí trong lúc Vercel build (bản cũ còn chạy; ghi lúc này có thể làm lệch 1 dòng).
8. Theo dõi log build Vercel: `prisma migrate deploy` phải in `Applying migration ..._add_payments` rồi `All migrations have been successfully applied`. Nếu thấy `Resetting` / `rolled back` → rollback ngay.

**C. Sau deploy (trên production):**
9. Chạy lại (C): phải ra 0 dòng. Dòng nào lệch (do ai đó bấm Lưu ở bản cũ lúc deploy) → vào sheet tháng đó, thêm 1 lần thu bù đúng phần chênh `paid_amount - s`.
10. Chạy lại (B): số lượng/tổng phải ≥ (A) (bằng nếu chưa ai thu thêm).
11. So Báo cáo 2–3 kỳ và Dashboard với ảnh chụp ở bước 6: phải giống hệt từng đồng.
12. Trên điện thoại: mở `/tuition` → Ghi nhận 1 HS đã đóng trước đây → thấy 1 lần thu "Tiền mặt", ghi chú "Chuyển từ dữ liệu cũ", số tiền bằng "Đã trả" cũ. Không cần sửa.
13. Xoá branch Neon `pre-b-payments` khi đã yên tâm (hoặc giữ vài ngày làm bản sao lưu).
