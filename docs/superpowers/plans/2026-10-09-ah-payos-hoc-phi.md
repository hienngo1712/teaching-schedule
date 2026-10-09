# AH — payOS học phí tự đánh dấu (GĐ2, 0.17.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên Pro dán 3 khoá payOS của họ vào Cài đặt (app tự đăng ký webhook); phiếu báo học phí hiện QR payOS đúng số nợ; tiền vào → webhook riêng của giáo viên tự ghi khoản thu FIFO, tháng đủ tiền thành Đã đóng đủ, huy hiệu hiện "PH đã chuyển X lúc HH:mm ngày d/M". Phát hành `0.17.0`.

**Architecture:** `payos.ts` (sẵn có, nhận `PayosConfig`) thêm `confirmWebhook` + trả thêm thông tin TK. `payos-teacher.service.ts` (kết nối/ngắt, dựng cfg từ bản ghi giáo viên). `tuition-paylink.service.ts` (tạo/dùng lại link cho phiếu). `tuition-payos-webhook.service.ts` (ghi khoản thu qua lõi FIFO tách từ `recordPayment`). Route `/api/payos/tuition/[hookId]` mỏng như route AG.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma 5 (1 migration chỉ thêm), `node:crypto`, Vitest, Playwright. Không cài thư viện.

**Spec:** `docs/superpowers/specs/2026-10-09-ah-payos-hoc-phi-design.md` (đọc HẾT trước Task 1). Tham khảo cách AG làm: `src/server/payos.ts`, `src/server/services/payos-order.service.ts`, `tests/integration/payos-webhook.test.ts`.

## Global Constraints

**Nhánh, version**
- Nhánh `feat/ah-payos-hoc-phi` (Claude tạo sẵn, đã có spec + plan). Version cuối `0.17.0`. Không cài/nâng thư viện.

**Migration và an toàn DB**
- **Migration chỉ thêm** (Task 1): 3 bảng mới + 2 cột nullable ở `monthly_tuition`. Không DROP/RENAME/ALTER cột cũ.
- Tạo SQL bằng (sau `set -a; . ./.env.test; set +a` và kiểm `DATABASE_URL` chứa `localhost:5433`):
  `pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<YYYYMMDDHHmmss>_payos_tuition/migration.sql`
  đọc SQL (chỉ CREATE TABLE / ADD COLUMN / CREATE INDEX / ADD CONSTRAINT), rồi `pnpm exec prisma migrate deploy` (dòng Datasource phải in `localhost:5433`), rồi `pnpm exec prisma generate`.
- Không áp prod (Vercel tự `migrate deploy`). Prisma đòi reset / báo drift → DỪNG, báo Claude.
- Chỉ `.env.test`. Cấm `db:reset` / `migrate reset` / `db push` / `pnpm db:migrate:*`. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.

**payOS**
- Khoá giáo viên **không bao giờ** log, không trả ra client (kể cả che), không xuất Excel. Không log chữ ký, số TK.
- Test **không gọi payOS thật**: unit/integration `vi.spyOn(globalThis, "fetch")`; e2e + guide-shots dùng mock server cổng 4010 (`tests/e2e/payos-mock-server.mjs`, mở rộng ở Task 2).
- Khoá giả giáo viên dùng trong mọi test: `clientId: "t-client"`, `apiKey: "t-api"`, `checksumKey: "t-checksum"`. Khoá app (env) giữ như AG: `PAYOS_CLIENT_ID=test-client`…
- `PAYOS_API_BASE` (env) áp cho cả cfg giáo viên (để e2e trỏ mock).
- `description` link học phí = `HP ${link.id}`; `orderCode` = `link.id`.

**Chạy lệnh**
- Không `pnpm build` / `pnpm dev` (e2e tự bật server). Người dùng ĐÃ ĐỒNG Ý cho Task 9 chạy `pnpm exec playwright test -c playwright.guide-shots.config.ts` + `pnpm guide:docx`.
- Test 3 tầng: mỗi task chỉ test của task + `pnpm exec tsc --noEmit` + `pnpm lint`; full `pnpm test` + full e2e 2 nửa **chỉ 1 lần ở Task 10**.
- Khoá test `D:\APINODEJS\student-managerment\.superpowers\test-lock.txt` bắt buộc trước mọi `pnpm test …` / `pnpm exec playwright test …`.
- e2e: RAM ≥ 3000 MB, foreground, seed trước bằng `pnpm test tests/integration/plan-launch-migration.test.ts`, chỉ dừng PID mình tạo (cả mock 4010), tắt dev server cổng 3000 khi xong.

**Chữ và giao diện**
- **Mobile-first bắt buộc**: 375px trước; vùng chạm ≥ 44px (`h-11 md:h-9|10`); không tràn ngang; chụp 375px và **tự mở xem**, ghi nhận xét từng ảnh vào ledger (Task 7, 8, 10).
- Chữ mới qua i18n `vi.json` + `en.json` cùng bộ key. Không gạch dài (—, –) trong chữ hiển thị. Màu teal `primary`/slate/amber/red/emerald có sẵn, không indigo/violet/purple.
- Ghi chú chi phí payOS **đúng nguyên văn** (vi): `Dùng payOS: 100 giao dịch miễn phí trọn đời + 500 miễn phí trong 6 tháng; muốn nhiều hơn (1.000 giao dịch/năm) phải mua gói Pro của payOS ~2.000đ/giao dịch ≈ 2 triệu/năm. Không cần tự đánh dấu thì cứ dùng VietQR miễn phí trọn đời như bình thường.`

**Commit**
- Commit 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do.
- Mỗi task: test của task xanh + tsc + lint sạch → commit → ledger `.superpowers/sdd/2026-10-09-ah-payos-hoc-phi/progress.md`.
- **Không xoá / nới test cũ để qua.** Đổi kỳ vọng test cũ chỉ khi đúng hành vi mới, ghi Ruling.

## Review Focus

1. **Mở phiếu 2 lần cùng lúc (sheet + trang phụ huynh)** → tạo 2 link payOS, tốn 2 đơn. Test: Task 4 "2 lần gọi song song chỉ 1 link".
2. **Phụ huynh trả QR cũ sau khi giáo viên đã ghi tiền mặt** → tiền phải được ghi (thành dư), không được bỏ. Test: Task 5 "link cancelled vẫn ghi".
3. **Giáo viên dán khoá kênh mua gói của app** → ghi đè webhook mua gói, hỏng GĐ1. Test: Task 3 "khoá app bị chặn, không gọi payOS".
4. **Webhook của giáo viên A mang orderCode của link giáo viên B** (hookId A, ký bằng khoá A) → không được ghi tiền cho HS của B. Test: Task 5 "link thuộc giáo viên khác → 200 bỏ qua".
5. **Hết Pro giữa chừng** → phiếu về VietQR nhưng tiền vào link cũ vẫn ghi. Test: Task 4 "hết Pro → VietQR" + Task 5 "hết Pro vẫn ghi".

## Bên thực thi

- **Claude-OTD làm Task 1 → 10**, tuần tự, ở `D:\APINODEJS\student-managerment`, nhánh `feat/ah-payos-hoc-phi` (đã checkout). Luật: `.superpowers/claude-otd/CLAUDE-OTD.md`. Ledger: `.superpowers/sdd/2026-10-09-ah-payos-hoc-phi/progress.md`.
- 3 ảnh trang payOS (`payos-tao-kenh`, `payos-ds-kenh`, `payos-khoa`) **không thuộc plan này**: người dùng chụp, Claude che khoá và thêm sau. Task 9 viết các bước đó dạng chữ (không `shot`).

---

### Task 1: Schema + migration + mã hoá

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_payos_tuition/migration.sql`
- Modify: `src/server/crypto/prisma-encryption.ts` (`ENCRYPTED_FIELDS`)
- Modify: `tests/setup.ts` (xoá bảng mới trước `student`/`user`)
- Test: test DMMF mã hoá có sẵn (`grep -rl ENCRYPTED_FIELDS tests`) + `tests/integration/payos-tuition-schema.test.ts`

**Interfaces:**
- Produces: `db.teacherPayos` `{ userId, clientId, apiKey, checksumKey, hookId, connectedAt }`; `db.tuitionPayLink` `{ id, userId, studentId, year, month, amount, status: "active"|"cancelled"|"paid", payosLinkId, qrCode, checkoutUrl, bankBin, accountNumber, accountName, createdAt }`; `db.tuitionPayLinkPayment` `{ id, linkId, reference @unique, amount, paidAt, batchId, createdAt }`; `MonthlyTuition.payosPaidAt: Date|null`, `payosPaidAmount: number|null`.

- [ ] **Step 1: Viết test hỏng** `tests/integration/payos-tuition-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { db } from "@/server/db"

describe("schema AH", () => {
  it("khoá payOS giáo viên lưu dạng mã hoá, đọc ra chuỗi gốc", async () => {
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.teacherPayos.upsert({
      where: { userId: u.id },
      update: { clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: "h".repeat(43) },
      create: { userId: u.id, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: "h".repeat(43) },
    })
    const raw = await db.$queryRaw<{ api_key: string; checksum_key: string }[]>`SELECT api_key, checksum_key FROM teacher_payos WHERE user_id = ${u.id}`
    expect(raw[0].api_key).not.toBe("t-api")
    expect(raw[0].checksum_key).not.toBe("t-checksum")
    expect((await db.teacherPayos.findUniqueOrThrow({ where: { userId: u.id } })).checksumKey).toBe("t-checksum")
    await db.teacherPayos.delete({ where: { userId: u.id } })
  })
})
```

- [ ] **Step 2: Chạy, thấy hỏng.** `pnpm test tests/integration/payos-tuition-schema.test.ts` → Expected: FAIL (`db.teacherPayos` undefined / lỗi TS).

- [ ] **Step 3: Sửa schema.** Thêm đúng 3 model của spec §3 (copy nguyên khối, giữ ghi chú). Thêm quan hệ ngược: `User` thêm `teacherPayos TeacherPayos?`; `Student` thêm `payLinks TuitionPayLink[]`. `MonthlyTuition` thêm (sau `noticeSentAmount`):

```prisma
  // Lần PH chuyển qua payOS gần nhất ở tháng neo (spec AH §3): huy hiệu đọc thẳng.
  payosPaidAt      DateTime? @map("payos_paid_at")
  payosPaidAmount  Int?      @map("payos_paid_amount")
```

- [ ] **Step 4: Mã hoá.** Trong `ENCRYPTED_FIELDS` thêm:

```ts
  TeacherPayos: ["clientId", "apiKey", "checksumKey"],
  TuitionPayLink: ["accountNumber", "accountName"],
```

- [ ] **Step 5: tests/setup.ts.** Trước `await db.payment.deleteMany()` thêm `await db.tuitionPayLinkPayment.deleteMany()` và `await db.tuitionPayLink.deleteMany()`; trước `await db.user.deleteMany()` thêm `await db.teacherPayos.deleteMany()`.

- [ ] **Step 6: Migration** theo Global Constraints (tên `payos_tuition`), đọc SQL, `migrate deploy` lên DB test, `prisma generate`.

- [ ] **Step 7: Chạy lại.** `pnpm test tests/integration/payos-tuition-schema.test.ts` + test DMMF mã hoá → Expected: PASS. `pnpm exec tsc --noEmit`, `pnpm lint` sạch.

- [ ] **Step 8: Commit** `feat(ah): schema payOS học phí + mã hoá khoá giáo viên`.

---

### Task 2: `payos.ts` — confirmWebhook, thông tin TK, feature `payosTuition`, mock server

**Files:**
- Modify: `src/server/payos.ts`
- Modify: `src/lib/plans.ts` (`FEATURE_PLAN`, `PLAN_FEATURES`), `src/components/plan/feature-labels.ts`, `src/language/vi.json`, `src/language/en.json`
- Modify: `tests/e2e/payos-mock-server.mjs`
- Test: `tests/unit/server/payos.test.ts` (thêm case), `tests/unit/lib/plans.test.ts` (nếu có test đếm PLAN_FEATURES thì cập nhật + Ruling)

**Interfaces:**
- Produces: `confirmWebhook(cfg: PayosConfig, webhookUrl: string): Promise<void>`; `createPaymentLink` trả `{ paymentLinkId, qrCode, checkoutUrl, bin: string|null, accountNumber: string|null, accountName: string|null }`; `payosBaseUrl(): string`; feature `"payosTuition"` (gói `pro`).

- [ ] **Step 1: Test hỏng** (thêm vào `tests/unit/server/payos.test.ts`):

```ts
it("confirmWebhook gửi webhookUrl kèm khoá giáo viên", async () => {
  const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "00", data: {} })))
  const cfg = { clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", baseUrl: "http://x" }
  await confirmWebhook(cfg, "https://app/api/payos/tuition/abc")
  const [url, init] = f.mock.calls[0] as [string, RequestInit]
  expect(url).toBe("http://x/confirm-webhook")
  expect(JSON.parse(String(init.body))).toEqual({ webhookUrl: "https://app/api/payos/tuition/abc" })
  expect((init.headers as Record<string, string>)["x-client-id"]).toBe("t-client")
  f.mockRestore()
})
it("confirmWebhook ném lỗi khi payOS trả code khác 00", async () => {
  const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "20", desc: "Webhook url invalid" })))
  await expect(confirmWebhook({ clientId: "a", apiKey: "b", checksumKey: "c", baseUrl: "http://x" }, "u")).rejects.toThrow()
  f.mockRestore()
})
it("createPaymentLink trả thêm bin/accountNumber/accountName (thiếu thì null)", async () => {
  const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
    code: "00", data: { paymentLinkId: "pl", qrCode: "qr", checkoutUrl: "https://c", bin: "970422", accountNumber: "0001", accountName: "GV A" },
  })))
  const r = await createPaymentLink({ clientId: "a", apiKey: "b", checksumKey: "c", baseUrl: "http://x" },
    { orderCode: 1, amount: 1000, description: "HP 1", returnUrl: "https://r", cancelUrl: "https://r", expiredAt: 2000000000 })
  expect(r).toMatchObject({ bin: "970422", accountNumber: "0001", accountName: "GV A" })
  f.mockRestore()
})
```

- [ ] **Step 2: Chạy** `pnpm test tests/unit/server/payos.test.ts` → Expected: FAIL (`confirmWebhook` không tồn tại).

- [ ] **Step 3: Code.** Trong `payos.ts`:

```ts
export function payosBaseUrl(): string {
  return process.env.PAYOS_API_BASE?.trim() || DEFAULT_BASE
}
```
Sửa `getPayosConfig` dùng `baseUrl: payosBaseUrl()`. Sửa `createPaymentLink`:

```ts
  const d = json.data as { paymentLinkId?: string; qrCode?: string; checkoutUrl?: string; bin?: string; accountNumber?: string; accountName?: string } | undefined
  if (!d?.paymentLinkId || !d.qrCode || !d.checkoutUrl) throw new Error("payOS thiếu dữ liệu link")
  return { paymentLinkId: d.paymentLinkId, qrCode: d.qrCode, checkoutUrl: d.checkoutUrl, bin: d.bin ?? null, accountNumber: d.accountNumber ?? null, accountName: d.accountName ?? null }
```
Thêm:

```ts
// payOS POST thử vào URL rồi mới nhận; khoá sai/URL không trả 200 → ném lỗi.
export async function confirmWebhook(cfg: PayosConfig, webhookUrl: string): Promise<void> {
  await call(cfg, "/confirm-webhook", { webhookUrl })
}
```

- [ ] **Step 4: Feature.** `FEATURE_PLAN` thêm `payosTuition: "pro",`; `PLAN_FEATURES` thêm `{ id: "payosTuition", plan: FEATURE_PLAN.payosTuition },` sau `multiMonthReport`; `feature-labels.ts` thêm `payosTuition: "plan_feat_payos_tuition",`; i18n vi `"plan_feat_payos_tuition": "Tự đánh dấu học phí qua payOS"`, en `"Auto-mark tuition via payOS"`.

- [ ] **Step 5: Mock server.** Trong `payos-mock-server.mjs`: nhánh `/v2/payment-requests` thêm vào `data`: `bin: "970422", accountNumber: "0001234567", accountName: "GIAO VIEN TEST"`; thêm nhánh trước `/health`:

```js
    if (req.url === "/confirm-webhook") return res.end(JSON.stringify({ code: "00", data: {} }))
```

- [ ] **Step 6: Chạy** test payos + test plans/feature-labels liên quan (`pnpm test tests/unit/lib/plans tests/unit/server/payos.test.ts`) → PASS. tsc, lint sạch.

- [ ] **Step 7: Commit** `feat(ah): payOS confirmWebhook, thông tin TK link, tính năng payosTuition`.

---

### Task 3: Kết nối / ngắt payOS của giáo viên (service + router + middleware)

**Files:**
- Create: `src/server/services/payos-teacher.service.ts`
- Create: `src/lib/schemas/payos.ts`
- Create: `src/server/trpc/routers/payos.ts`; Modify: router gốc (file gộp các router, `grep -rn "contact:" src/server/trpc`) thêm `payos: payosRouter`
- Modify: `src/middleware.ts` (matcher `api/payos/webhook` → `api/payos/`)
- Test: `tests/integration/payos-teacher.test.ts`

**Interfaces:**
- Consumes: `confirmWebhook`, `cancelPaymentLink`, `payosBaseUrl` (Task 2); `db.teacherPayos`, `db.tuitionPayLink` (Task 1).
- Produces:
  - `teacherPayosConfig(row: { clientId: string; apiKey: string; checksumKey: string }): PayosConfig`
  - `getTeacherPayosStatus(db, userId): Promise<{ connected: boolean; connectedAt: Date | null; featureUnlocked: boolean }>`
  - `connectTeacherPayos(db, userId, input: { clientId: string; apiKey: string; checksumKey: string }, origin: string | null | undefined): Promise<{ connectedAt: Date }>`
  - `disconnectTeacherPayos(db, userId): Promise<{ success: true }>`
  - `activeTeacherPayos(db, userId, now = new Date()): Promise<PayosConfig | null>` — có bản ghi **và** đang có feature `payosTuition`.
  - tRPC: `payos.status` (query), `payos.connect` (mutation), `payos.disconnect` (mutation).

- [ ] **Step 1: Test hỏng** `tests/integration/payos-teacher.test.ts` (dùng `getAuthedCaller("teacher")`; trong `beforeEach` đặt user `teacher` thành Pro: `plan: "pro", planExpiresAt: addDays(new Date(), 30)`, xoá `teacherPayos`/`tuitionPayLink` của user; `process.env.PAYOS_CLIENT_ID = "test-client"`; `afterEach` `vi.restoreAllMocks()` và trả plan về như cũ). Các case:

```ts
const KEYS = { clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum" }
const ok = () => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "00", data: {} })))

it("kết nối: gọi confirm-webhook đúng URL theo hookId rồi lưu", async () => {
  const f = ok()
  const caller = await getAuthedCaller("teacher")
  await caller.payos.connect(KEYS)
  const row = await db.teacherPayos.findUniqueOrThrow({ where: { userId } })
  const [url, init] = f.mock.calls[0] as [string, RequestInit]
  expect(url).toMatch(/\/confirm-webhook$/)
  expect(JSON.parse(String(init.body)).webhookUrl).toBe(`http://localhost:3000/api/payos/tuition/${row.hookId}`)
  expect(row.hookId).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(await caller.payos.status()).toMatchObject({ connected: true, featureUnlocked: true })
})
it("payOS từ chối khoá → BAD_REQUEST, không lưu", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "401", desc: "x" })))
  const caller = await getAuthedCaller("teacher")
  await expect(caller.payos.connect(KEYS)).rejects.toMatchObject({ code: "BAD_REQUEST" })
  expect(await db.teacherPayos.findUnique({ where: { userId } })).toBeNull()
})
it("khoá kênh mua gói của app bị chặn, không gọi payOS", async () => {
  const f = ok()
  const caller = await getAuthedCaller("teacher")
  await expect(caller.payos.connect({ ...KEYS, clientId: "test-client" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  expect(f).not.toHaveBeenCalled()
})
it("không Pro → FORBIDDEN", async () => {
  await db.user.update({ where: { id: userId }, data: { plan: "plus" } })
  const caller = await getAuthedCaller("teacher")
  await expect(caller.payos.connect(KEYS)).rejects.toMatchObject({ code: "FORBIDDEN" })
})
it("kết nối lại giữ hookId cũ", async () => {
  ok()
  const caller = await getAuthedCaller("teacher")
  await caller.payos.connect(KEYS)
  const h1 = (await db.teacherPayos.findUniqueOrThrow({ where: { userId } })).hookId
  await caller.payos.connect({ ...KEYS, apiKey: "t-api-2" })
  expect((await db.teacherPayos.findUniqueOrThrow({ where: { userId } })).hookId).toBe(h1)
})
it("ngắt: huỷ link active trên payOS, đánh dấu cancelled, xoá khoá; hết Pro vẫn ngắt được", async () => {
  const f = ok()
  const caller = await getAuthedCaller("teacher")
  await caller.payos.connect(KEYS)
  const st = await db.student.create({ data: { userId, fullName: "HS", grade: 5 } }) // điền đủ trường bắt buộc theo schema Student
  const link = await db.tuitionPayLink.create({ data: { userId, studentId: st.id, year: 2026, month: 9, amount: 100000, payosLinkId: "pl-1", qrCode: "q", checkoutUrl: "c" } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null } })
  await caller.payos.disconnect()
  expect(f.mock.calls.some(([u]) => String(u).endsWith("/v2/payment-requests/pl-1/cancel"))).toBe(true)
  expect((await db.tuitionPayLink.findUniqueOrThrow({ where: { id: link.id } })).status).toBe("cancelled")
  expect(await db.teacherPayos.findUnique({ where: { userId } })).toBeNull()
})
it("status không bao giờ chứa khoá", async () => {
  ok()
  const caller = await getAuthedCaller("teacher")
  await caller.payos.connect(KEYS)
  expect(JSON.stringify(await caller.payos.status())).not.toMatch(/t-api|t-checksum|t-client/)
})
```
Ghi chú: `tests/helpers/trpc.ts` hiện chưa có `origin` trong ctx → thêm `origin: "http://localhost:3000",` vào ctx của `getAuthedCaller` (thuộc Files của task này) để test khớp URL.

- [ ] **Step 2: Chạy** → Expected: FAIL (`caller.payos` undefined).

- [ ] **Step 3: Schema** `src/lib/schemas/payos.ts`:

```ts
import { z } from "zod"

const key = z.string().trim().min(1).max(200)
export const payosConnectSchema = z.object({ clientId: key, apiKey: key, checksumKey: key })
export type PayosConnectInput = z.infer<typeof payosConnectSchema>
```

- [ ] **Step 4: Service** `payos-teacher.service.ts`:

```ts
import { randomBytes } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { cancelPaymentLink, confirmWebhook, payosBaseUrl, type PayosConfig } from "@/server/payos"
import { effectivePlan, hasFeature } from "@/lib/plans"
import type { PayosConnectInput } from "@/lib/schemas/payos"

export function teacherPayosConfig(row: { clientId: string; apiKey: string; checksumKey: string }): PayosConfig {
  return { clientId: row.clientId, apiKey: row.apiKey, checksumKey: row.checksumKey, baseUrl: payosBaseUrl() }
}

async function unlocked(db: PrismaClient, userId: number, now: Date) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, planExpiresAt: true, trialEndsAt: true } })
  return hasFeature(effectivePlan(u, now).plan, "payosTuition")
}

export async function getTeacherPayosStatus(db: PrismaClient, userId: number) {
  const row = await db.teacherPayos.findUnique({ where: { userId }, select: { connectedAt: true } })
  return { connected: row !== null, connectedAt: row?.connectedAt ?? null, featureUnlocked: await unlocked(db, userId, new Date()) }
}

export async function activeTeacherPayos(db: PrismaClient, userId: number, now = new Date()): Promise<PayosConfig | null> {
  const row = await db.teacherPayos.findUnique({ where: { userId } })
  if (!row || !(await unlocked(db, userId, now))) return null
  return teacherPayosConfig(row)
}

export async function connectTeacherPayos(db: PrismaClient, userId: number, input: PayosConnectInput, origin: string | null | undefined) {
  if (!(await unlocked(db, userId, new Date()))) throw new TRPCError({ code: "FORBIDDEN" })
  // Dán khoá kênh mua gói thì confirm-webhook ghi đè webhook mua gói của app.
  if (input.clientId === process.env.PAYOS_CLIENT_ID?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Đây là khoá kênh mua gói của app, hãy tạo kênh payOS riêng" })
  }
  if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "Không xác định được địa chỉ app" })
  const existing = await db.teacherPayos.findUnique({ where: { userId }, select: { hookId: true } })
  const hookId = existing?.hookId ?? randomBytes(32).toString("base64url")
  try {
    await confirmWebhook(teacherPayosConfig(input), `${origin}/api/payos/tuition/${hookId}`)
  } catch (e) {
    console.warn(`[payos] GV ${userId} kết nối lỗi: ${e instanceof Error ? e.message : "?"}`)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Không kết nối được payOS, kiểm tra lại 3 khoá" })
  }
  const row = await db.teacherPayos.upsert({
    where: { userId },
    update: { ...input, connectedAt: new Date() },
    create: { userId, ...input, hookId },
    select: { connectedAt: true },
  })
  return { connectedAt: row.connectedAt }
}

export async function disconnectTeacherPayos(db: PrismaClient, userId: number) {
  const row = await db.teacherPayos.findUnique({ where: { userId } })
  if (!row) return { success: true as const }
  const links = await db.tuitionPayLink.findMany({ where: { userId, status: "active" }, select: { id: true, payosLinkId: true } })
  for (const l of links) {
    try {
      await cancelPaymentLink(teacherPayosConfig(row), l.payosLinkId)
    } catch (e) {
      console.warn(`[payos] huỷ link HP lỗi: ${e instanceof Error ? e.message : "?"}`)
    }
  }
  await db.tuitionPayLink.updateMany({ where: { userId, status: "active" }, data: { status: "cancelled" } })
  await db.teacherPayos.delete({ where: { userId } })
  return { success: true as const }
}
```

- [ ] **Step 5: Router** `routers/payos.ts`:

```ts
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { payosConnectSchema } from "@/lib/schemas/payos"
import { connectTeacherPayos, disconnectTeacherPayos, getTeacherPayosStatus } from "@/server/services/payos-teacher.service"

export const payosRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) => getTeacherPayosStatus(ctx.db, ctx.userId)),
  connect: protectedProcedure.input(payosConnectSchema).mutation(({ ctx, input }) => connectTeacherPayos(ctx.db, ctx.userId, input, ctx.origin)),
  // Không chặn theo gói: hết Pro vẫn phải ngắt được.
  disconnect: protectedProcedure.mutation(({ ctx }) => disconnectTeacherPayos(ctx.db, ctx.userId)),
})
```
Gắn vào router gốc. Middleware: thay `api/payos/webhook` bằng `api/payos/` trong matcher (nếu có test matcher thì cập nhật, Ruling).

- [ ] **Step 6: Chạy** `pnpm test tests/integration/payos-teacher.test.ts` → PASS. tsc, lint sạch. Nếu `tests/unit/next15-contract*.test.ts` có allow-list file gọi `fetch`, thêm file mới chỉ khi nó gọi fetch (service này không gọi trực tiếp).

- [ ] **Step 7: Commit** `feat(ah): giáo viên kết nối/ngắt payOS, tự đăng ký webhook`.

---

### Task 4: QR payOS trên phiếu (`ensureTuitionPayLink` + `getTuitionNotice`)

**Files:**
- Create: `src/server/services/tuition-paylink.service.ts`
- Modify: `src/server/services/tuition-notice.service.ts`, `src/lib/types/models.ts` (`TuitionNoticeDTO.qr`), `src/server/trpc/routers/tuition.ts` (`getNotice` truyền `ctx.origin`), `src/server/services/parent-link.service.ts` (`getParentView` nhận `origin`), `src/app/p/[token]/page.tsx` (lấy origin từ `headers()`)
- Test: `tests/integration/tuition-paylink.test.ts`; test cũ `tuition-notice.test.ts`, `parent-link.test.ts` phải xanh (thêm `provider: "vietqr", checkoutUrl: null` vào kỳ vọng nếu so khớp nguyên `qr` → Ruling)

**Interfaces:**
- Consumes: `activeTeacherPayos`, `teacherPayosConfig` (Task 3); `createPaymentLink`, `cancelPaymentLink` (Task 2).
- Produces:
  - `ensureTuitionPayLink(db, userId, studentId, notice: { year: number; month: number }, amount: number, opts: { origin: string; returnPath: string }): Promise<{ id: number; qrCode: string; checkoutUrl: string; bankBin: string | null; accountNumber: string | null; accountName: string | null } | null>` — null = dùng VietQR.
  - `anchorMonth(year, month): { year, month }` — tháng phiếu nếu đã học xong, không thì tháng trước.
  - `getTuitionNotice(db, userId, input, opts?: { origin?: string | null; returnPath?: string })`.
  - `getParentView(db, token, thang, origin?: string | null)`.
  - `TuitionNoticeDTO.qr` thêm `provider: "vietqr" | "payos"`, `checkoutUrl: string | null`.

- [ ] **Step 1: Test hỏng** `tests/integration/tuition-paylink.test.ts`. Dựng HS + ca học tháng **đã qua** (vd 2026-08, có mặt 2 buổi × 100.000 = 200.000) bằng caller như `tuition-notice.test.ts`; user `teacher` Pro; tạo `teacherPayos` trực tiếp bằng `db` (khoá giả). Mock fetch theo URL:

```ts
let created = 0
function mockPayos() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.endsWith("/v2/payment-requests")) {
      created++
      const b = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ code: "00", data: { paymentLinkId: `pl-${b.orderCode}`, qrCode: `QR${b.orderCode}`, checkoutUrl: `https://pay/${b.orderCode}`, bin: "970422", accountNumber: "0001", accountName: "GV A" } }))
    }
    return new Response(JSON.stringify({ code: "00", data: {} }))
  })
}
const OPTS = { origin: "http://localhost:3000" }
```
Cases:

```ts
it("GV Pro đã nối: phiếu dùng QR payOS đúng số nợ, nội dung HP <id>", async () => {
  const f = mockPayos()
  const n = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  expect(n.qr).toMatchObject({ provider: "payos", amount: 200000, accountNumber: "0001", checkoutUrl: expect.stringContaining("https://pay/") })
  expect(n.qr!.content).toMatch(/^HP \d+$/)
  const body = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))
  expect(body).toMatchObject({ amount: 200000, description: n.qr!.content })
})
it("mở lại cùng số nợ: dùng lại link, không gọi payOS lần 2", async () => {
  mockPayos(); created = 0
  await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  expect(created).toBe(1)
})
it("số nợ đổi (đã thu 50.000 tiền mặt): huỷ link cũ, tạo link 150.000", async () => {
  const f = mockPayos()
  const a = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  await caller.payment.create({ studentId, year: 2026, month: 8, amount: 50000, paidAt: "2026-09-01", method: "cash" })
  const b = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  expect(b.qr).toMatchObject({ provider: "payos", amount: 150000 })
  expect(f.mock.calls.some(([u]) => String(u).includes(`/pl-${a.qr!.content.slice(3)}/cancel`))).toBe(true)
  expect(await db.tuitionPayLink.count({ where: { studentId, status: "active" } })).toBe(1)
})
it("2 lần gọi song song chỉ 1 link", async () => {
  mockPayos(); created = 0
  await Promise.all([1, 2].map(() => getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)))
  expect(created).toBe(1)
  expect(await db.tuitionPayLink.count({ where: { studentId } })).toBe(1)
})
it("payOS lỗi → VietQR, không để lại dòng nháp", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"))
  await db.user.update({ where: { id: userId }, data: { bankBin: "970436", bankAccountNumber: "0011001234567", bankAccountName: "NGUYEN VAN A" } })
  const n = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  expect(n.qr).toMatchObject({ provider: "vietqr", checkoutUrl: null })
  expect(await db.tuitionPayLink.count({ where: { studentId } })).toBe(0)
})
it("hết Pro → VietQR, không gọi payOS", async () => {
  const f = mockPayos()
  await db.user.update({ where: { id: userId }, data: { plan: "plus", bankBin: "970436", bankAccountNumber: "0011001234567", bankAccountName: "NGUYEN VAN A" } })
  const n = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  expect(n.qr?.provider).toBe("vietqr")
  expect(f).not.toHaveBeenCalled()
})
it("không có origin (vd báo cáo) → không tạo link payOS", async () => {
  const f = mockPayos()
  await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 })
  expect(f).not.toHaveBeenCalled()
})
it("đã đóng đủ → qr null, không tạo link", async () => {
  const f = mockPayos()
  await caller.payment.create({ studentId, year: 2026, month: 8, amount: 200000, paidAt: "2026-09-01", method: "cash" })
  const n = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
  expect(n.qr).toBeNull()
  expect(f).not.toHaveBeenCalled()
})
it("anchorMonth: tháng đang học → tháng trước; tháng đã qua → giữ", () => {
  // dùng tháng hiện tại theo giờ VN; isInProgressMonth là nguồn sự thật
  const now = vnDateParts()
  expect(anchorMonth(now.year, now.month)).toEqual(now.month === 1 ? { year: now.year - 1, month: 12 } : { year: now.year, month: now.month - 1 })
  expect(anchorMonth(2026, 8)).toEqual({ year: 2026, month: 8 })
})
```

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: Service** `tuition-paylink.service.ts`:

```ts
import type { PrismaClient } from "@prisma/client"
import { cancelPaymentLink, createPaymentLink } from "@/server/payos"
import { activeTeacherPayos } from "./payos-teacher.service"
import { isInProgressMonth } from "@/lib/tuition-display"
import { TX_OPTIONS } from "./payment.service"

// Khoá riêng (2 số, ns 8) để 2 lần mở phiếu cùng lúc không tạo 2 link; ns 7 là khoá ghi tiền của payment.service.
const LINK_LOCK_NS = 8
// payOS bắt expiredAt; QR trên ảnh phiếu có thể quét muộn nên để 1 năm.
const LINK_TTL_SECONDS = 365 * 24 * 3600

export function anchorMonth(year: number, month: number) {
  if (!isInProgressMonth(year, month)) return { year, month }
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export async function ensureTuitionPayLink(
  db: PrismaClient, userId: number, studentId: number,
  notice: { year: number; month: number }, amount: number,
  opts: { origin: string; returnPath: string }
) {
  const cfg = await activeTeacherPayos(db, userId)
  if (!cfg || amount <= 0) return null
  const anchor = anchorMonth(notice.year, notice.month)
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LINK_LOCK_NS}::int, ${studentId}::int)`
      const active = await tx.tuitionPayLink.findFirst({ where: { studentId, status: "active" }, orderBy: { id: "desc" } })
      if (active && active.amount === amount) return active
      if (active) {
        await cancelPaymentLink(cfg, active.payosLinkId).catch((e) => console.warn(`[payos] huỷ link HP lỗi: ${e instanceof Error ? e.message : "?"}`))
        await tx.tuitionPayLink.update({ where: { id: active.id }, data: { status: "cancelled" } })
      }
      const draft = await tx.tuitionPayLink.create({
        data: { userId, studentId, year: anchor.year, month: anchor.month, amount, payosLinkId: "", qrCode: "", checkoutUrl: "" },
      })
      const url = `${opts.origin}${opts.returnPath}`
      const r = await createPaymentLink(cfg, {
        orderCode: draft.id, amount, description: `HP ${draft.id}`, returnUrl: url, cancelUrl: url,
        expiredAt: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
      })
      return tx.tuitionPayLink.update({
        where: { id: draft.id },
        data: { payosLinkId: r.paymentLinkId, qrCode: r.qrCode, checkoutUrl: r.checkoutUrl, bankBin: r.bin, accountNumber: r.accountNumber, accountName: r.accountName },
      })
    }, TX_OPTIONS)
  } catch (e) {
    // Lỗi payOS rollback cả dòng nháp → phiếu rơi về VietQR.
    console.warn(`[payos] tạo link HP lỗi: ${e instanceof Error ? e.message : "?"}`)
    return null
  }
}
```
Lưu ý: gọi payOS trong transaction là cố ý (giữ khoá để không tạo trùng); `createPaymentLink` timeout 5s < `TX_OPTIONS.timeout` 10s. Nếu `TX_OPTIONS` import gây vòng import thì chép hằng `{ maxWait: 10_000, timeout: 10_000 }` (Ruling).

- [ ] **Step 4: `getTuitionNotice`.** Thêm tham số thứ 4 `opts: { origin?: string | null; returnPath?: string } = {}`. Sau khi tính `remaining`, trước khi dựng `qr` VietQR:

```ts
  const payLink = opts.origin && remaining > 0
    ? await ensureTuitionPayLink(db, userId, studentId, { year, month }, remaining, { origin: opts.origin, returnPath: opts.returnPath ?? "/" })
    : null
  const qr = payLink
    ? {
        provider: "payos" as const,
        payload: payLink.qrCode,
        bankShortName: (payLink.bankBin && findBank(payLink.bankBin)?.shortName) || "payOS",
        accountNumber: payLink.accountNumber ?? "",
        accountName: payLink.accountName ?? "",
        amount: remaining,
        content: `HP ${payLink.id}`,
        checkoutUrl: payLink.checkoutUrl,
      }
    : /* nhánh VietQR cũ, thêm */ { provider: "vietqr" as const, checkoutUrl: null, ...cũ }   // giữ nguyên điều kiện bank && bankInfo && remaining > 0, ngoài ra null
```
Đổi ghi chú đầu hàm: "Chỉ đọc MonthlyTuition/Payment; có origin thì có thể ghi bảng tuition_pay_links (spec AH §5)." `bankConfigured` giữ nghĩa cũ. Cập nhật `TuitionNoticeDTO.qr` trong `models.ts` thêm `provider: "vietqr" | "payos"` và `checkoutUrl: string | null`.

- [ ] **Step 5: Truyền origin.** Router `getNotice`: `getTuitionNotice(ctx.db, ctx.userId, input, { origin: ctx.origin, returnPath: "/tuition" })`. `getParentView(db, token, thang, origin?)` truyền `{ origin, returnPath: \`/p/${token}\` }`. `src/app/p/[token]/page.tsx`:

```ts
import { headers } from "next/headers"
// ...
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const origin = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : null
  const view = await getParentView(db, token, typeof thang === "string" ? thang : undefined, origin)
```
Các nơi khác gọi `getTuitionNotice` (grep) giữ nguyên = không origin = không tạo link.

- [ ] **Step 6: Chạy** `pnpm test tests/integration/tuition-paylink.test.ts tests/integration/tuition-notice.test.ts tests/integration/parent-link.test.ts` → PASS. tsc (sửa mọi nơi dùng `notice.qr` cho đúng kiểu), lint sạch.

- [ ] **Step 7: Commit** `feat(ah): phiếu học phí dùng QR payOS của giáo viên, dùng lại link khi số nợ không đổi`.

---

### Task 5: Webhook học phí — ghi khoản thu tự động

**Files:**
- Modify: `src/server/services/payment.service.ts` (tách lõi, thêm `method` vào `writeAllocation`)
- Create: `src/server/services/tuition-payos-webhook.service.ts`
- Create: `src/app/api/payos/tuition/[hookId]/route.ts`
- Modify: `src/lib/types/models.ts` (`PaymentDTO.method` thêm `"payos"`), `src/lib/schemas/payment.ts` (thêm `export type StoredPaymentMethod = PaymentMethod | "payos"`; **không** thêm vào `PAYMENT_METHODS`)
- Test: `tests/integration/tuition-payos-webhook.test.ts`; test payment cũ phải xanh

**Interfaces:**
- Consumes: `db.teacherPayos`, `db.tuitionPayLink`, `db.tuitionPayLinkPayment`, `MonthlyTuition.payosPaid*` (Task 1); `verifyWebhookSignature`, `parsePayosDateTime` (payos.ts).
- Produces:
  - `recordPaymentFromPayos(db, userId, studentId, anchor: { year; month }, amount, meta: { paidAt: string; note: string }, inTx: (tx, batchId) => Promise<void>): Promise<{ batchId: string }>` trong payment.service (ensure ngoài tx, rồi 1 transaction: khoá HS → `writeAllocation(..., method "payos")` → `inTx(tx, batchId)`).
  - `handleTuitionWebhook(db, hookId: string, body: unknown): Promise<{ status: 200 | 400 | 401 | 404; note?: string }>`.

- [ ] **Step 1: Test hỏng** `tests/integration/tuition-payos-webhook.test.ts`. Dựng như Task 4 (HS, tháng 2026-08 nợ 200.000, GV `teacher` Pro + `teacherPayos` hookId `"H".repeat(43)` khoá `t-checksum`), tạo link trực tiếp:

```ts
async function makeLink(over: Partial<{ amount: number; status: string; userId: number; studentId: number }> = {}) {
  return db.tuitionPayLink.create({ data: { userId: over.userId ?? userId, studentId: over.studentId ?? studentId, year: 2026, month: 8, amount: over.amount ?? 200000, status: over.status ?? "active", payosLinkId: `pl-${Math.random()}`, qrCode: "q", checkoutUrl: "c" } })
}
function payload(l: { id: number; payosLinkId: string }, amount: number, reference = `R${l.id}-${amount}`, key = "t-checksum", transactionDateTime = "2026-10-09 14:32:00") {
  const data = { orderCode: l.id, amount, description: `HP ${l.id}`, accountNumber: "0001", reference, transactionDateTime, currency: "VND", paymentLinkId: l.payosLinkId, code: "00", desc: "success", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "" }
  return { code: "00", desc: "success", success: true, data, signature: signWebhookData(key, data) }
}
const HOOK = "H".repeat(43)
```
Cases:

```ts
it("đủ tiền → ghi khoản thu payOS, tháng Đã đóng đủ, link paid, ghi payosPaidAt/Amount", async () => {
  const l = await makeLink()
  expect(await handleTuitionWebhook(db, HOOK, payload(l, 200000))).toMatchObject({ status: 200 })
  const mt = await db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId, year: 2026, month: 8 } } })
  expect(mt).toMatchObject({ paidAmount: 200000, payosPaidAmount: 200000 })
  expect(mt.payosPaidAt?.toISOString()).toBe("2026-10-09T07:32:00.000Z")
  const p = await db.payment.findFirstOrThrow({ where: { monthlyTuitionId: mt.id } })
  expect(p).toMatchObject({ method: "payos", amount: 200000 })
  expect(p.paidAt.toISOString().slice(0, 10)).toBe("2026-10-09")
  expect((await db.tuitionPayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("paid")
  const n = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 })
  expect(n.remaining).toBe(0)
})
it("chia FIFO: nợ tháng 7 (100.000) + tháng 8 → trả tháng 7 trước", async () => { /* thêm 1 buổi tháng 7, link 300.000, kiểm 2 dòng Payment 7→100.000, 8→200.000 cùng batchId */ })
it("gửi lặp cùng reference → không ghi lần 2", async () => {
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  expect(await handleTuitionWebhook(db, HOOK, payload(l, 200000))).toMatchObject({ status: 200 })
  expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
})
it("hookId lạ → 404; chữ ký sai → 401; JSON thiếu data → 400", async () => {
  const l = await makeLink()
  expect((await handleTuitionWebhook(db, "x".repeat(43), payload(l, 200000))).status).toBe(404)
  expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000, "R", "khoa-sai"))).status).toBe(401)
  expect((await handleTuitionWebhook(db, HOOK, { foo: 1 })).status).toBe(400)
})
it("giao dịch thử (orderCode 123, paymentLinkId không khớp) → 200, không ghi", async () => {
  const data = { orderCode: 123, amount: 3000, description: "VQRIO123", accountNumber: "12345678", reference: "TF230204212323", transactionDateTime: "2023-02-04 18:25:00", currency: "VND", paymentLinkId: "124c33293c43417ab7879e14c8d9eb18", code: "00", desc: "Thành công", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: "", counterAccountNumber: "", virtualAccountName: "", virtualAccountNumber: "" }
  const r = await handleTuitionWebhook(db, HOOK, { code: "00", desc: "success", success: true, data, signature: signWebhookData("t-checksum", data) })
  expect(r.status).toBe(200)
  expect(await db.payment.count()).toBe(0)
})
it("data.code khác 00 → 200, không ghi", async () => { /* payload rồi sửa data.code = "01", ký lại */ })
it("link thuộc giáo viên khác → 200 bỏ qua", async () => {
  const other = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
  const st2 = await db.student.create({ data: { userId: other.id, fullName: "HS khác", grade: 5 } }) // đủ trường bắt buộc
  const l = await makeLink({ userId: other.id, studentId: st2.id })
  expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000))).status).toBe(200)
  expect(await db.payment.count()).toBe(0)
})
it("link cancelled (PH quét QR cũ) vẫn ghi, thành tiền dư nếu đã đủ", async () => {
  await caller.payment.create({ studentId, year: 2026, month: 8, amount: 200000, paidAt: "2026-09-01", method: "cash" })
  const l = await makeLink({ status: "cancelled" })
  expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000))).status).toBe(200)
  expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
  expect((await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 })).overpaid).toBeGreaterThanOrEqual(0) // kiểm thêm paidAmount 400.000 trên các tháng
  expect((await db.tuitionPayLink.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("cancelled")
})
it("hết Pro vẫn ghi", async () => {
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null } })
  const l = await makeLink()
  await handleTuitionWebhook(db, HOOK, payload(l, 200000))
  expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
})
it("ngày giao dịch hỏng → ghi với giờ nhận, không lỗi", async () => {
  const l = await makeLink()
  expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000, "RB", "t-checksum", "rác"))).status).toBe(200)
  expect(await db.payment.count({ where: { method: "payos" } })).toBe(1)
})
it("HS đã xoá mềm → 200 bỏ qua", async () => {
  const l = await makeLink()
  await db.student.update({ where: { id: studentId }, data: { isDeleted: true, deletedAt: new Date() } })
  expect((await handleTuitionWebhook(db, HOOK, payload(l, 200000))).status).toBe(200)
  expect(await db.payment.count()).toBe(0)
})
it("2 giao dịch khác reference cộng dồn payosPaidAmount", async () => { /* link 200.000, 2 payload reference khác nhau 100.000 + 100.000 → payosPaidAmount 200000 */ })
it("không còn bất biến lệch paidAmount", async () => { /* sau các ghi ở trên: expect(await findPaidAmountMismatches()).toEqual([]) */ })
```
Viết đủ thân các case có ghi chú `/* … */` theo đúng mô tả trong ghi chú.

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: payment.service.** `writeAllocation` meta thêm `method?: StoredPaymentMethod` và dùng `method: meta.method ?? "cash"` thay cho `"cash"` cứng. Thêm (cạnh `recordPayment`, không đổi `recordPayment`):

```ts
// Lõi FIFO cho tiền payOS (spec AH §6): không chặn tháng đang học vì neo đã là tháng đã học xong.
export async function recordPaymentFromPayos(
  db: PrismaClient, userId: number, studentId: number,
  anchor: { year: number; month: number }, amount: number,
  meta: { paidAt: string; note: string },
  inTx: (tx: Prisma.TransactionClient, batchId: string) => Promise<void>
): Promise<{ batchId: string }> {
  await ensureMonthlyTuition(db, userId, studentId, anchor.year, anchor.month)
  await ensureLedgerMonths(db, userId, studentId, anchor.year, anchor.month, amount)
  const batchId = randomUUID()
  await db.$transaction(async (tx) => {
    await lockStudentPayments(tx, studentId)
    await writeAllocation(tx, userId, studentId, anchor, amount, { batchId, paidAt: meta.paidAt, note: meta.note, method: "payos" })
    await inTx(tx, batchId)
  }, TX_OPTIONS)
  return { batchId }
}
```

- [ ] **Step 4: Service webhook** `tuition-payos-webhook.service.ts`:

```ts
import { Prisma, type PrismaClient } from "@prisma/client"
import { parsePayosDateTime, verifyWebhookSignature } from "@/server/payos"
import { recordPaymentFromPayos } from "./payment.service"
import { vnTodayIso } from "@/lib/payment-summary"

type Data = { orderCode?: unknown; amount?: unknown; reference?: unknown; transactionDateTime?: unknown; paymentLinkId?: unknown; code?: unknown }

export async function handleTuitionWebhook(db: PrismaClient, hookId: string, body: unknown): Promise<{ status: 200 | 400 | 401 | 404; note?: string }> {
  const b = body as { data?: Data & Record<string, unknown>; signature?: unknown } | null
  if (!b || typeof b.data !== "object" || b.data === null || typeof b.signature !== "string") return { status: 400 }
  const teacher = await db.teacherPayos.findUnique({ where: { hookId } })
  if (!teacher) return { status: 404 }
  if (!verifyWebhookSignature(teacher.checksumKey, b.data, b.signature)) return { status: 401 }
  const d = b.data
  if (d.code !== "00" || typeof d.orderCode !== "number" || typeof d.amount !== "number" || typeof d.reference !== "string") return { status: 200, note: "bỏ qua" }
  // Giao dịch thử lúc confirm-webhook (orderCode 123) hay link của GV khác: không khớp thì bỏ qua.
  const link = await db.tuitionPayLink.findUnique({ where: { id: d.orderCode }, include: { student: { select: { isDeleted: true } } } })
  if (!link || link.userId !== teacher.userId || link.payosLinkId !== d.paymentLinkId) return { status: 200, note: "không khớp" }
  if (link.student.isDeleted) {
    console.warn(`[payos] tiền HP vào HS đã xoá, link ${link.id}`)
    return { status: 200, note: "HS đã xoá" }
  }
  if (await db.tuitionPayLinkPayment.findUnique({ where: { reference: d.reference }, select: { id: true } })) return { status: 200, note: "gửi lặp" }
  const parsed = typeof d.transactionDateTime === "string" ? parsePayosDateTime(d.transactionDateTime) : null
  // Ngày hỏng mà ném lỗi thì payOS gửi lại mãi, tiền không bao giờ được ghi: lấy giờ nhận.
  const paidAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date()
  const reference = d.reference
  const amount = d.amount
  try {
    await recordPaymentFromPayos(db, link.userId, link.studentId, { year: link.year, month: link.month }, amount,
      { paidAt: vnTodayIso(paidAt), note: `payOS · ${reference}` },
      async (tx, batchId) => {
        await tx.tuitionPayLinkPayment.create({ data: { linkId: link.id, reference, amount, paidAt, batchId } })
        if (link.status === "active") await tx.tuitionPayLink.update({ where: { id: link.id }, data: { status: "paid" } })
        await tx.monthlyTuition.update({
          where: { studentId_year_month: { studentId: link.studentId, year: link.year, month: link.month } },
          data: { payosPaidAt: paidAt, payosPaidAmount: { increment: amount } },
        })
      })
  } catch (e) {
    // 2 lần gửi cùng lúc: lần sau đụng unique reference → coi như gửi lặp.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: 200, note: "gửi lặp" }
    throw e
  }
  return { status: 200, note: "đã ghi" }
}
```
Lưu ý `payosPaidAmount: { increment }` trên cột null: Postgres `NULL + x = NULL`. Dùng: đọc giá trị trong tx (`findUniqueOrThrow` select `payosPaidAmount`) rồi set `(cur ?? 0) + amount`. Test "cộng dồn" phải bắt được lỗi này.

- [ ] **Step 5: Route** `src/app/api/payos/tuition/[hookId]/route.ts`:

```ts
import { db } from "@/server/db"
import { handleTuitionWebhook } from "@/server/services/tuition-payos-webhook.service"

export const runtime = "nodejs"

export async function POST(req: Request, ctx: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
  try {
    const { status } = await handleTuitionWebhook(db, hookId, body)
    return Response.json({ ok: status === 200 }, { status })
  } catch (e) {
    console.error(`[payos] webhook HP lỗi: ${e instanceof Error ? e.message : "?"}`)
    return Response.json({ ok: false }, { status: 500 })
  }
}
```

- [ ] **Step 6: Chạy** `pnpm test tests/integration/tuition-payos-webhook.test.ts tests/integration/payment*.test.ts` → PASS. tsc, lint sạch.

- [ ] **Step 7: Commit** `feat(ah): webhook payOS học phí tự ghi khoản thu FIFO`.

---

### Task 6: Hiển thị "PH đã chuyển" + nhãn payOS ở đợt thu

**Files:**
- Modify: `src/server/services/tuition.service.ts` (item thêm `payosPaidAt`, `payosPaidAmount` ở cả 2 chỗ dựng item, dòng ~286–315 và ~395–405), `src/lib/types/models.ts` (kiểu item tháng)
- Modify: `src/server/services/payment.service.ts` (`listBatches` thêm `method` vào `PaymentBatchDTO`), `models.ts` (`PaymentBatchDTO.method: StoredPaymentMethod`)
- Modify: `src/components/tuition/TuitionNoticeBadge.tsx`, `src/components/tuition/TuitionDetailSheet.tsx`, i18n
- Test: `tests/unit/components/TuitionNoticeBadge.test.tsx` (tạo nếu chưa có), `tests/integration/tuition-payos-webhook.test.ts` (thêm 1 case đọc qua `getMonthlyTuitionStatus`)

**Interfaces:**
- Consumes: `MonthlyTuition.payosPaidAt/payosPaidAmount` (Task 1, ghi ở Task 5).
- Produces: item tháng có `payosPaidAt: Date | null`, `payosPaidAmount: number | null`; `PaymentBatchDTO.method`.

- [ ] **Step 1: Test hỏng.** Unit badge (jsdom, `LanguageProvider forcedLanguage="vi"`):

```tsx
it("có payosPaidAt → dòng xanh 'PH đã chuyển 200.000 đ lúc 14:32 ngày 9/10' thay nhắc đã gửi phiếu", () => {
  render(<LanguageProvider forcedLanguage="vi"><TuitionNoticeBadge item={{ noticeStatus: "sent", noticeSentAt: "2026-10-01T03:00:00Z", due: 0, payosPaidAt: "2026-10-09T07:32:00.000Z", payosPaidAmount: 200000 }} /></LanguageProvider>)
  expect(screen.getByText(/PH đã chuyển 200\.000/)).toBeTruthy()
  expect(screen.getByText(/14:32 ngày 9\/10/)).toBeTruthy()
  expect(screen.queryByText(/đã gửi/i)).toBeNull()
})
it("noticeStatus none nhưng có payosPaidAt vẫn hiện dòng đã chuyển", () => { /* noticeStatus: "none" + payosPaid* → vẫn thấy "PH đã chuyển" */ })
it("còn nợ sau khi PH chuyển (chuyển thiếu/ nợ mới) → hiện cả dòng đã chuyển, nhắc nợ giữ như cũ", () => { /* due: 50000, noticeStatus "sent" → thấy cả "PH đã chuyển" và nhãn notice_sent_age */ })
```
Định dạng tiền dùng `formatCurrency` sẵn có (khớp chuỗi thật nó in ra; nếu nó in "200.000 ₫" thì sửa regex test cho khớp, Ruling).
Integration: sau webhook, `getMonthlyTuitionStatus(db, userId, { year: 2026, month: 8, status: "all", page: 1, limit: 10 })` item có `payosPaidAmount: 200000`; `listBatches` trả `method: "payos"`.

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: Code.** `tuition.service`: `payosPaidAt: snapshot?.payosPaidAt ?? null, payosPaidAmount: snapshot?.payosPaidAmount ?? null` (kiểm snapshot select có 2 cột; nếu select tường minh thì thêm). `listBatches`: nhóm lấy `method: p.method as StoredPaymentMethod` (dòng đầu của đợt). Badge:

```tsx
  // PH đã chuyển qua payOS (spec AH §7): hiện trước, đã hết nợ thì không nhắc gửi phiếu nữa.
  const paidLine = item.payosPaidAt && item.payosPaidAmount ? (
    <Badge variant="outline" className={`border-none bg-emerald-50 text-emerald-700 text-xs font-normal hover:bg-emerald-50 ${className ?? ""}`}>
      {t("payos_parent_paid")
        .replace("{amount}", formatCurrency(item.payosPaidAmount))
        .replace("{time}", dayjs(item.payosPaidAt).tz("Asia/Ho_Chi_Minh").format("HH:mm"))
        .replace("{d}", dayjs(item.payosPaidAt).tz("Asia/Ho_Chi_Minh").format("D/M"))}
    </Badge>
  ) : null
  const hasDue = item.due !== undefined && item.due > 0
  if (paidLine && !hasDue) return paidLine
```
và khi còn nợ: trả `<>{paidLine}{nhãn cũ}</>` (bọc `span` `inline-flex flex-wrap gap-1` để mobile xuống dòng gọn). Prop item thêm `payosPaidAt?: Date | string | null; payosPaidAmount?: number | null`; bỏ điều kiện `noticeStatus === "none" → null` khi có paidLine.
i18n: vi `"payos_parent_paid": "PH đã chuyển {amount} lúc {time} ngày {d}"`, en `"Parent paid {amount} at {time} on {d}"`; `"payment_method_payos": "payOS"`.
`TuitionDetailSheet`: đầu phần khoản thu hiện `TuitionNoticeBadge`-style dòng đã chuyển (dùng lại component với item tháng đang mở); mỗi `payment-row` có `b.method === "payos"` thêm nhãn nhỏ `payOS` (`rounded bg-primary/10 px-1.5 text-xs text-primary`).

- [ ] **Step 4: Chạy** test badge + integration → PASS; test cũ của badge/sheet/tuition xanh. tsc, lint.

- [ ] **Step 5: Commit** `feat(ah): huy hiệu "PH đã chuyển" và nhãn payOS ở đợt thu`.

---

### Task 7: Thẻ cài payOS trong Cài đặt

**Files:**
- Create: `src/components/settings/PayosTuitionCard.tsx`
- Modify: `src/app/(app)/settings/page.tsx` (thêm `<PayosTuitionCard />` dưới `BankAccountCard`), i18n
- Test: `tests/unit/components/PayosTuitionCard.test.tsx`

**Interfaces:**
- Consumes: `trpc.payos.status/connect/disconnect` (Task 3); `ContactOwner` (`src/components/common/ContactOwner.tsx`); `LockedSection` (`src/components/plan/LockedSection.tsx`).
- Produces: `PayosTuitionCard` (không prop), `data-testid="payos-card"`.

- [ ] **Step 1: Test hỏng** (mock `@/lib/trpc` như `AdminOrderHistory.test.tsx`; mock `ContactOwner` thành `<div>contact</div>`):

```tsx
it("chưa Pro: thấy lợi ích, ghi chú chi phí nguyên văn, link hướng dẫn, liên hệ; form bị khoá", () => {
  status = { connected: false, connectedAt: null, featureUnlocked: false }
  renderCard()
  expect(screen.getByText(/không phải rà sao kê/)).toBeTruthy()
  expect(screen.getByText(/100 giao dịch miễn phí trọn đời \+ 500 miễn phí trong 6 tháng/)).toBeTruthy()
  expect(screen.getByRole("link", { name: /hướng dẫn/i }).getAttribute("href")).toBe("/guide#payos-hoc-phi")
  expect(screen.getByText("contact")).toBeTruthy()
  expect(screen.getByTestId("locked-section")).toBeTruthy()
})
it("Pro chưa nối: 3 ô khoá + nút Kết nối gọi connect với giá trị đã nhập", async () => { /* gõ 3 ô (label Client ID/API Key/Checksum Key), bấm Kết nối → connect.mutate nhận { clientId, apiKey, checksumKey } */ })
it("lỗi server hiện dưới form", () => { /* connect error message "Không kết nối được payOS, kiểm tra lại 3 khoá" → thấy chữ đó */ })
it("đã nối: hiện 'Đã kết nối payOS từ 9/10/2026', không có ô khoá, có nút Ngắt kết nối", () => { /* connected true, connectedAt "2026-10-09T03:00:00Z" */ })
it("đã nối nhưng hết Pro: hiện 'Tạm dừng' và vẫn có nút Ngắt kết nối", () => { /* connected true, featureUnlocked false */ })
```

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: Component.** Bố cục giống `BankAccountCard` (đọc file đó, dùng cùng Card/Input/Button/Label). Thứ tự: tiêu đề + `PlanBadge plan="pro"` → khối lợi ích (`rounded-lg bg-primary/5 p-3 text-sm`) → ghi chú chi phí (`text-xs text-slate-600`) → lời nhắn + `<Link href="/guide#payos-hoc-phi">` + `<ContactOwner />` → phần trạng thái:
  - `!featureUnlocked && !connected`: `<LockedSection plan="pro" label={t("payos_unlock_pro")}>` bọc form giả (3 ô disabled).
  - `featureUnlocked && !connected`: form 3 ô `type="password"` có nút hiện/ẩn (icon `Eye`/`EyeOff`, `aria-label`), nút `t("payos_connect")` `h-11 md:h-10 w-full md:w-auto`, disabled + `Loader2` khi pending; lỗi `connect.error?.message` ở `text-sm text-red-600`. Thành công: `toast.success`, invalidate `payos.status`, xoá ô.
  - `connected`: `t("payos_connected_since").replace("{d}", dayjs(connectedAt).tz("Asia/Ho_Chi_Minh").format("D/M/YYYY"))`; nếu `!featureUnlocked` thêm dòng amber `t("payos_paused")`; nút `t("payos_disconnect")` (variant outline, đỏ) mở dialog xác nhận của app (dùng component dialog có sẵn như `ConfirmDialog` nếu có — `grep -rl "ConfirmDialog\|AlertDialog" src/components`), không dùng `window.confirm`.
  i18n vi (en dịch tương ứng):
  - `payos_card_title`: "Tự đánh dấu học phí bằng payOS"
  - `payos_benefit`: "Phụ huynh quét QR trên phiếu, tiền vào là app tự ghi khoản thu và đánh dấu đã đóng, không phải rà sao kê rồi đánh dấu tay."
  - `payos_cost_note`: (nguyên văn Global Constraints)
  - `payos_help`: "Muốn cài payOS, làm theo {guide} hoặc liên hệ trực tiếp admin:" (thay `{guide}` bằng link chữ `payos_guide_link` = "hướng dẫn")
  - `payos_unlock_pro`: "Mở khoá gói Pro"
  - `payos_client_id`: "Client ID", `payos_api_key`: "API Key", `payos_checksum_key`: "Checksum Key"
  - `payos_connect`: "Kết nối", `payos_connected_ok`: "Đã kết nối payOS"
  - `payos_connected_since`: "Đã kết nối payOS từ {d}"
  - `payos_paused`: "Tạm dừng: gói Pro đã hết, phiếu dùng VietQR"
  - `payos_disconnect`: "Ngắt kết nối", `payos_disconnect_confirm`: "Ngắt kết nối payOS? QR payOS đang gửi sẽ bị huỷ, phiếu quay về VietQR."

- [ ] **Step 4: Chạy** test card → PASS. tsc, lint.

- [ ] **Step 5: Ảnh 375px.** Viết tạm 1 spec Playwright **không commit** hoặc dùng e2e Task 10 sau; ở task này chỉ cần test xanh. (Ảnh chụp và xem ở Task 10.)

- [ ] **Step 6: Commit** `feat(ah): thẻ cài payOS trong Cài đặt (khoá với gói dưới Pro)`.

---

### Task 8: Phiếu + trang phụ huynh hiển thị QR payOS

**Files:**
- Modify: `src/components/tuition/TuitionNoticeCard.tsx` (2 nhánh QR: thêm dòng gợi ý khi `notice.qr.provider === "payos"`; `alt` = "payOS" khi payos)
- Modify: `src/components/parent/ParentView.tsx` (hoặc nơi hiện phiếu trong trang PH — `grep -rn "TuitionNoticeCard" src/components/parent`): nút "Mở trang thanh toán" khi `qr.checkoutUrl`
- Modify: i18n
- Test: `tests/unit/components/TuitionNoticeCard*.test.tsx` (thêm case; tạo file nếu chưa có), test ParentView có sẵn (thêm case)

**Interfaces:**
- Consumes: `TuitionNoticeDTO.qr.provider/checkoutUrl` (Task 4).

- [ ] **Step 1: Test hỏng.**

```tsx
it("QR payOS: hiện dòng 'Quét để trả, tự xác nhận khi tiền vào'", () => { /* render card với notice.qr = { provider: "payos", payload: "QR1", bankShortName: "MB", accountNumber: "0001", accountName: "GV A", amount: 200000, content: "HP 1", checkoutUrl: "https://pay/1" } → thấy chữ payos_scan_hint */ })
it("QR VietQR: không có dòng gợi ý payOS", () => { /* provider vietqr → queryByText null */ })
it("trang PH: có nút 'Mở trang thanh toán' trỏ checkoutUrl, mở tab mới", () => { /* getByRole("link", { name: /Mở trang thanh toán/ }) href = "https://pay/1", target="_blank", rel chứa noopener */ })
```

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: Code.** i18n vi `"payos_scan_hint": "Quét để trả, tự xác nhận khi tiền vào"`, `"payos_open_checkout": "Mở trang thanh toán"`; en tương ứng. Dòng gợi ý `text-xs text-emerald-700` dưới khối thông tin TK (cả 2 nhánh bố cục). Nút trang PH: `<a href={qr.checkoutUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white md:w-auto">`. Ảnh phiếu (html2canvas) không cần nút.

- [ ] **Step 4: Chạy** → PASS; test cũ phiếu/ảnh phiếu/trang PH xanh. tsc, lint.

- [ ] **Step 5: Commit** `feat(ah): phiếu và trang phụ huynh hiển thị QR payOS`.

---

### Task 9: Hướng dẫn `/guide` mục payOS + ảnh app

**Files:**
- Modify: `src/lib/guide-content.ts` (mục mới `payos-hoc-phi` ngay sau `tai-khoan-ngan-hang`)
- Modify: `tests/guide-shots/guide-shots.spec.ts`, `tests/guide-shots/demo-data.ts`, `playwright.guide-shots.config.ts` (webServer thành mảng thêm mock 4010 như `playwright.config.ts`)
- Modify: `tests/unit/lib/guide-content.test.ts` (số shot 25 → 28)
- Output: `public/guide/{cai-payos,phieu-payos,da-chuyen-payos}-{mobile,desktop}.jpg`, file docx (lệnh `pnpm guide:docx`)

**Interfaces:**
- Consumes: thẻ `payos-card` (Task 7), phiếu payOS (Task 8), badge (Task 6).

- [ ] **Step 1: Test hỏng.** `guide-content.test.ts`: đổi `toBe(25)` → `toBe(28)` (tên test "có 28 shot…") và thêm:

```ts
it("có mục payos-hoc-phi với ghi chú chi phí nguyên văn", () => {
  const s = GUIDE_SECTIONS.find((x) => x.id === "payos-hoc-phi")!
  expect(JSON.stringify(s)).toContain("100 giao dịch miễn phí trọn đời + 500 miễn phí trong 6 tháng")
})
```
(dùng đúng tên export danh sách mục trong `guide-content.ts`).

- [ ] **Step 2: Chạy** → FAIL.

- [ ] **Step 3: Nội dung.** Mục:

```ts
  {
    id: "payos-hoc-phi",
    title: "Tự đánh dấu học phí bằng payOS (gói Pro)",
    intro: "Phụ huynh quét QR payOS trên phiếu, tiền vào là app tự ghi khoản thu và đánh dấu **Đã đóng đủ**, không phải rà sao kê rồi đánh dấu tay. Dùng payOS: 100 giao dịch miễn phí trọn đời + 500 miễn phí trong 6 tháng; muốn nhiều hơn (1.000 giao dịch/năm) phải mua gói Pro của payOS ~2.000đ/giao dịch ≈ 2 triệu/năm. Không cần tự đánh dấu thì cứ dùng VietQR miễn phí trọn đời như bình thường.",
    steps: [
      "Đăng ký tài khoản tại **payos.vn** và xác thực danh tính theo hướng dẫn của payOS.",
      "Liên kết tài khoản ngân hàng nhận học phí (nên chọn ngân hàng payOS hỗ trợ liên kết).",
      "Tạo một **kênh thanh toán riêng** cho học phí.",
      "Kênh vừa tạo hiện trong danh sách kênh.",
      "Mở kênh, vào tab **Thông tin tích hợp**, chép **Client ID**, **API Key**, **Checksum Key**. Không bấm nút ↻ cạnh Checksum Key (đổi khoá làm app mất kết nối). Không cần tự điền webhook, app tự cài.",
      { text: "Trong app: **Cài đặt**, thẻ **Tự đánh dấu học phí bằng payOS**, dán 3 khoá rồi bấm **Kết nối**.", shot: "cai-payos" },
      { text: "Gửi phiếu như thường: phiếu có QR payOS đúng số đang nợ, phụ huynh quét để trả.", shot: "phieu-payos" },
      { text: "Tiền vào: tháng tự thành **Đã đóng đủ**, huy hiệu hiện **PH đã chuyển … lúc … ngày …**.", shot: "da-chuyen-payos" },
    ],
    tips: ["Cần hỗ trợ cài payOS? Gọi, nhắn Zalo hoặc Facebook cho admin ở mục **Cần hỗ trợ?** cuối trang."],
  },
```

- [ ] **Step 4: Ảnh app.** `demo-data.ts`: thêm `setDemoPayos()` — đặt user demo Pro (nếu chưa), tạo `teacherPayos` (khoá giả `t-client/t-api/t-checksum`, hookId cố định), và sau khi chụp `phieu-payos` ghi 1 lần thu payOS bằng cách gọi `handleTuitionWebhook` với payload ký bằng `t-checksum` cho link vừa tạo (import service trực tiếp như các hàm seed khác dùng `db`); `cleanupDemo` xoá `teacherPayos` + `tuitionPayLink` của user demo. Spec thêm 3 shot sau shot `tai-khoan-ngan-hang` (đúng thứ tự mục):
  - `cai-payos`: xoá `teacherPayos` trước, `page.goto("/settings")`, `mark(page.getByTestId("payos-card"))`, `shot`.
  - `phieu-payos`: `setDemoPayos()`, mở phiếu HS demo có nợ ở `/tuition` (theo cách shot phiếu cũ làm), `mark` khối QR, `shot`.
  - `da-chuyen-payos`: ghi webhook như trên, reload `/tuition`, `mark` huy hiệu "PH đã chuyển", `shot`.
  Config guide-shots: `webServer` thành mảng `[mock 4010 (giống playwright.config.ts), dev server]`.

- [ ] **Step 5: Chạy** `pnpm test tests/unit/lib/guide-content.test.ts` → PASS; rồi (khoá test, RAM ≥ 3000 MB) `pnpm exec playwright test -c playwright.guide-shots.config.ts` → PASS; **mở xem** 6 ảnh mới (mobile + desktop), ghi nhận xét ledger; `pnpm guide:docx`.

- [ ] **Step 6: Commit** `docs(ah): hướng dẫn cài payOS tự đánh dấu học phí + ảnh app`.

---

### Task 10: e2e, ảnh 375px, phát hành 0.17.0, full test

**Files:**
- Create: `tests/e2e/ah-payos-hoc-phi.spec.ts`
- Modify: `.superpowers/sdd/2026-10-03-y-thu-hoc-phi/half2.txt` (thêm tên spec vào cuối dòng duy nhất, cách bằng 1 dấu cách, giữ 1 dòng)
- Modify: `package.json` (`version` → `0.17.0`), `src/lib/releases.ts` (thêm mục 0.17.0 theo khuôn mục 0.16.0: "Giáo viên gói Pro nối payOS: phụ huynh quét QR trên phiếu, tiền vào app tự đánh dấu đã đóng.")

- [ ] **Step 1: e2e** (vòng lặp 375 và 1280 như `ad-tour.spec.ts`; đăng nhập giáo viên Pro theo cách `ag-payos.spec.ts` làm; dọn dữ liệu cuối test):
  1. GV Pro vào `/settings`, thẻ `payos-card` hiện; điền 3 khoá giả, bấm Kết nối → thấy "Đã kết nối payOS từ".
  2. Tạo HS + 1 buổi có mặt tháng trước (qua API/`db` như spec cũ), mở phiếu ở `/tuition` → QR có dòng "Quét để trả, tự xác nhận khi tiền vào", nội dung bắt đầu "HP ".
  3. Gửi webhook giả: `request.post("/api/payos/tuition/<hookId>", { data: payload ký bằng khoá giả })` (đọc hookId + link từ `db`) → 200; reload `/tuition` → thấy "PH đã chuyển" và tháng ở trạng thái Đã đóng đủ.
  4. GV Plus vào `/settings` → thấy `locked-section` trong thẻ payOS và chữ "Mở khoá gói Pro".
  5. Mỗi kích thước chụp `test-results/ah-<bước>-<w>.png` sau bước 1, 2, 3, 4.

- [ ] **Step 2: Chạy** `pnpm exec playwright test tests/e2e/ah-payos-hoc-phi.spec.ts` (khoá test, seed trước) → PASS. **Mở xem từng ảnh 375px**: không tràn ngang, nút ≥ 44px, chữ không bị cắt, khối chi phí đọc được; ghi nhận xét từng ảnh vào ledger. Lỗi giao diện → sửa ở task gốc (commit `fix(ah): …`), chạy lại.

- [ ] **Step 3: Version + Có gì mới**, commit `chore: phat hanh 0.17.0`.

- [ ] **Step 4: Full test 1 lần.** `pnpm test` (toàn bộ) → PASS; e2e 2 nửa theo `half1.txt` / `half2.txt` → PASS. Ghi số lượng vào ledger. Đỏ do test cũ kỳ vọng hành vi cũ đúng nghĩa đổi → sửa + Ruling; đỏ khác → systematic-debugging.

- [ ] **Step 5:** Ghi `DONE AH` lên kênh `.superpowers/gehihi/kenh.md` + báo cáo `.superpowers/claude-otd/bao-cao-AH.md` (tóm tắt, Ruling, nhận xét ảnh, câu hỏi) rồi dừng.
