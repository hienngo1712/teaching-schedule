# AG — payOS mua gói tự kích hoạt + Liên hệ chủ app (0.16.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người mua gói chọn "kích hoạt ngay (payOS)" hoặc "chờ admin duyệt (VietQR)"; webhook payOS tự bật gói cho đơn đang chờ đủ tiền, mọi ca lệch đưa lên đầu trang admin; khối Liên hệ chủ app (Gọi/Zalo/Facebook) admin tự sửa. Phát hành `0.16.0`.

**Architecture:** `src/server/payos.ts` (thuần: ký/kiểm chữ ký + 2 lệnh gọi API) → `payos-order.service.ts` (tạo link, huỷ link, xử lý webhook) dùng chung lõi kích hoạt tách từ `approveOrder`. Route `/api/payos/webhook` mỏng. Liên hệ: bảng `ContactChange` (mẫu `PlanPriceChange`) + router `contact` + component `ContactOwner`.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma 5 (1 migration chỉ thêm), `node:crypto`, `qrcode` (có sẵn), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-ag-payos-mua-goi-design.md` (đọc hết trước Task 1).

## Global Constraints

**Nhánh, version**
- Nhánh `feat/ag-payos` từ `main` (main đã có spec + plan). Version cuối `0.16.0`. Không cài/nâng thư viện (dùng `fetch`, `node:crypto`, `qrcode` sẵn có).

**Migration và an toàn DB**
- **Migration chỉ thêm** (Task 1): cột nullable/có default vào `plan_orders`, 1 bảng mới. Không DROP/RENAME/ALTER kiểu cột cũ.
- Tạo bằng `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name payos_plan_orders`, đọc SQL, áp DB test bằng `... pnpm exec prisma migrate deploy` (dòng Datasource phải in `localhost:5433`), rồi `pnpm exec prisma generate`.
- Không áp prod (Vercel tự `migrate deploy`). Prisma đòi reset / báo drift → DỪNG, báo Claude.
- Chỉ `.env.test`. Cấm `db:reset` / `migrate reset` / `db push` / `pnpm db:migrate:*`. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.

**payOS**
- Env: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, tuỳ chọn `PAYOS_API_BASE` (mặc định `https://api-merchant.payos.vn`). **Không bao giờ log khoá, chữ ký, số tài khoản.**
- Test **không gọi payOS thật**: integration mock `globalThis.fetch` (`vi.spyOn`); e2e dùng mock server cổng 4010 (Task 9).
- Khoá giả cho test (dùng ở mọi file test): `PAYOS_CLIENT_ID=test-client`, `PAYOS_API_KEY=test-api-key`, `PAYOS_CHECKSUM_KEY=test-checksum-key`.
- `description` link = `SM ${code}` (9 ký tự). `orderCode` = `order.id`.

**Chạy lệnh**
- Không `pnpm build` / `pnpm dev` (e2e tự bật server qua Playwright).
- Test 3 tầng: mỗi task chỉ test của task + `pnpm exec tsc --noEmit` + `pnpm lint`; full `pnpm test` + full e2e **chỉ 1 lần ở Task 9**.
- Khoá test `D:\APINODEJS\student-managerment\.superpowers\test-lock.txt` bắt buộc trước mọi `pnpm test …` / `pnpm exec playwright test …`.
- e2e: RAM ≥ 3000 MB, foreground, seed trước bằng `pnpm test tests/integration/plan-launch-migration.test.ts`, chỉ dừng PID mình tạo, tắt dev server cổng 3000 và mock 4010 khi xong.

**Chữ và giao diện**
- **Mobile-first bắt buộc**: làm cho 375px trước; vùng chạm ≥ 44px (`h-11 md:h-9|10`); không tràn ngang; chụp ảnh 375px và **tự mở xem** (Task 8, 9).
- Chữ mới qua i18n `vi.json` + `en.json` cùng bộ key. Không gạch dài (—, –) trong chữ hiển thị. Màu teal `primary`/slate/amber/red có sẵn, không indigo/violet/purple.
- `page.tsx` / `layout.tsx` không có định danh `params` / `searchParams` (kể cả comment).

**Commit**
- Commit 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do.
- Mỗi task: test của task xanh + tsc + lint sạch → commit → ledger `.superpowers/sdd/2026-10-09-ag-payos-mua-goi/progress.md`.
- **Không xoá / nới test cũ để qua.** Đổi kỳ vọng test cũ chỉ khi đúng hành vi mới, ghi Ruling.

## Review Focus

1. **Giao dịch thử của payOS (orderCode 123) trùng id đơn thật** → bật/ghi tiền nhầm đơn. Test: Task 3 "paymentLinkId không khớp → bỏ qua".
2. **Webhook gửi lặp / 2 webhook cùng lúc** → gói cộng ngày 2 lần. Test: Task 3 "gửi lặp cùng reference không cộng ngày" + "2 webhook song song chỉ kích hoạt 1 lần".
3. **Đơn quá 7 ngày nhưng chưa bị chốt expired** (chưa ai đọc) nhận tiền → không được tự bật. Test: Task 3 "đơn pending quá TTL nhận đủ tiền → không bật, vào nhóm cần xử lý".
4. **payOS chậm/treo khi tạo đơn** → người dùng kẹt nút. Test: Task 4 "fetch timeout → đơn chuyển vietqr, payosFailed".
5. **Đơn Plus nhận đủ tiền khi tài khoản đang có Pro trả phí** (computeApproval trả null) → webhook không được ném lỗi 500 lặp vô hạn. Test: Task 3 "không duyệt được → 200, vào nhóm cần xử lý".

## Bên thực thi

- **Claude-OTD làm Task 1 → 9**, tuần tự, ở `D:\APINODEJS\student-managerment`, nhánh `feat/ag-payos` (Claude tạo sẵn và checkout). Luật: `.superpowers/claude-otd/CLAUDE-OTD.md`. Ledger: `.superpowers/sdd/2026-10-09-ag-payos-mua-goi/progress.md`.

---

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (model `PlanOrder`, thêm model `ContactChange`)
- Create: `prisma/migrations/<ts>_payos_plan_orders/migration.sql` (Prisma sinh)
- Modify: `tests/setup.ts` (xoá `contactChange` cùng chỗ xoá `planOrder`)

**Interfaces:**
- Produces: `PlanOrder.method: string` (`'vietqr'` mặc định), `payosLinkId`, `payosQr`, `payosCheckoutUrl`, `paidAmount: number|null`, `paidAt: Date|null`, `payosRef: string|null @unique`, `paidReviewedAt: Date|null`; model `ContactChange { id, phone, facebookUrl, changedBy, createdAt }` (`db.contactChange`).

- [ ] **Step 1: Sửa schema.** Thêm vào `model PlanOrder` (trước `user User @relation…`):

```prisma
  // payOS (spec AG): 'payos' | 'vietqr'. Đơn cũ = vietqr.
  method           String    @default("vietqr") @db.VarChar(8)
  payosLinkId      String?   @map("payos_link_id") @db.VarChar(64)
  payosQr          String?   @map("payos_qr") @db.Text
  payosCheckoutUrl String?   @map("payos_checkout_url") @db.Text
  paidAmount       Int?      @map("paid_amount")
  paidAt           DateTime? @map("paid_at")
  payosRef         String?   @unique @map("payos_ref") @db.VarChar(64)
  // Admin đã xử lý đơn có tiền mà không bật gói (Từ chối) → rời nhóm "cần xử lý".
  paidReviewedAt   DateTime? @map("paid_reviewed_at")
```

Thêm model sau `PlanPriceChange`:

```prisma
// Liên hệ chủ app hiện trong app (spec AG §7): dòng mới nhất là hiện hành. Không FK như PlanPriceChange.
model ContactChange {
  id          Int      @id @default(autoincrement())
  phone       String   @db.VarChar(15)
  facebookUrl String?  @map("facebook_url") @db.Text
  changedBy   String   @map("changed_by") @db.VarChar(50)
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("contact_changes")
}
```

- [ ] **Step 2: Migration** theo Global Constraints. SQL chỉ được có: 8 `ALTER TABLE "plan_orders" ADD COLUMN`, `CREATE UNIQUE INDEX "plan_orders_payos_ref_key"`, `CREATE TABLE "contact_changes"`, `CREATE INDEX "contact_changes_created_at_idx"`. Áp DB test, `prisma generate`.

- [ ] **Step 3: tests/setup.ts** — ngay sau dòng `await db.planOrder.deleteMany()` thêm `await db.contactChange.deleteMany()`.

- [ ] **Step 4: Kiểm**: `pnpm exec tsc --noEmit` sạch; khoá test → `pnpm test tests/integration/plan-orders.test.ts` xanh (đơn cũ vẫn chạy, `method` mặc định).

- [ ] **Step 5: Commit** `git add prisma tests/setup.ts && git commit -m "feat(ag): schema payOS cho plan_orders + bảng contact_changes"`

---

### Task 2: `src/server/payos.ts` — ký, kiểm chữ ký, gọi API

**Files:**
- Create: `src/server/payos.ts`
- Test: `tests/unit/server/payos.test.ts`

**Interfaces:**
- Produces:
  - `type PayosConfig = { clientId: string; apiKey: string; checksumKey: string; baseUrl: string }`
  - `getPayosConfig(): PayosConfig | null`
  - `signPaymentRequest(key: string, d: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string }): string`
  - `signWebhookData(key: string, data: Record<string, unknown>): string`
  - `verifyWebhookSignature(key: string, data: Record<string, unknown>, signature: string): boolean`
  - `createPaymentLink(cfg, input: { orderCode: number; amount: number; description: string; returnUrl: string; cancelUrl: string; expiredAt: number }): Promise<{ paymentLinkId: string; qrCode: string; checkoutUrl: string }>` (ném lỗi khi HTTP lỗi, `code !== "00"`, hoặc quá 5s)
  - `cancelPaymentLink(cfg, paymentLinkId: string): Promise<void>` (ném lỗi khi thất bại)
  - `parsePayosDateTime(s: string): Date` — `"2026-10-09 20:15:00"` là giờ VN

- [ ] **Step 1: Test đỏ** `tests/unit/server/payos.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest"
import { createHmac } from "node:crypto"
import {
  cancelPaymentLink, createPaymentLink, getPayosConfig, parsePayosDateTime,
  signPaymentRequest, signWebhookData, verifyWebhookSignature,
} from "@/server/payos"

const KEY = "test-checksum-key"
const h = (s: string) => createHmac("sha256", KEY).update(s).digest("hex")
const cfg = { clientId: "test-client", apiKey: "test-api-key", checksumKey: KEY, baseUrl: "https://payos.test" }

afterEach(() => {
  vi.restoreAllMocks()
  for (const k of ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY", "PAYOS_API_BASE"]) delete process.env[k]
})

describe("getPayosConfig", () => {
  it("thiếu 1 khoá → null; đủ → mặc định base payOS thật, trim", () => {
    process.env.PAYOS_CLIENT_ID = " c "; process.env.PAYOS_API_KEY = "a"
    expect(getPayosConfig()).toBeNull()
    process.env.PAYOS_CHECKSUM_KEY = "k"
    expect(getPayosConfig()).toEqual({ clientId: "c", apiKey: "a", checksumKey: "k", baseUrl: "https://api-merchant.payos.vn" })
    process.env.PAYOS_API_BASE = "http://127.0.0.1:4010"
    expect(getPayosConfig()?.baseUrl).toBe("http://127.0.0.1:4010")
  })
})

describe("chữ ký", () => {
  it("link: đúng thứ tự amount,cancelUrl,description,orderCode,returnUrl", () => {
    const d = { amount: 99000, cancelUrl: "https://x/plan", description: "SM ABC123", orderCode: 42, returnUrl: "https://x/plan" }
    expect(signPaymentRequest(KEY, d)).toBe(h("amount=99000&cancelUrl=https://x/plan&description=SM ABC123&orderCode=42&returnUrl=https://x/plan"))
  })
  it("webhook: sắp xếp khoá, null/undefined thành rỗng", () => {
    const data = { orderCode: 42, amount: 99000, description: "SM ABC123", counterAccountName: null, virtualAccountName: undefined }
    expect(signWebhookData(KEY, data)).toBe(h("amount=99000&counterAccountName=&description=SM ABC123&orderCode=42&virtualAccountName="))
  })
  it("verify: đúng → true; sai 1 ký tự / độ dài khác / khoá khác → false", () => {
    const data = { orderCode: 1, amount: 1000 }
    const sig = signWebhookData(KEY, data)
    expect(verifyWebhookSignature(KEY, data, sig)).toBe(true)
    expect(verifyWebhookSignature(KEY, data, sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a"))).toBe(false)
    expect(verifyWebhookSignature(KEY, data, "abc")).toBe(false)
    expect(verifyWebhookSignature("khac", data, sig)).toBe(false)
  })
})

describe("gọi API", () => {
  it("createPaymentLink gửi header + chữ ký, trả 3 trường", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "00", data: { paymentLinkId: "pl1", qrCode: "000201QR", checkoutUrl: "https://pay.payos.vn/web/pl1" } }), { status: 200 })
    )
    const input = { orderCode: 42, amount: 99000, description: "SM ABC123", returnUrl: "https://x/plan", cancelUrl: "https://x/plan", expiredAt: 1800000000 }
    await expect(createPaymentLink(cfg, input)).resolves.toEqual({ paymentLinkId: "pl1", qrCode: "000201QR", checkoutUrl: "https://pay.payos.vn/web/pl1" })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("https://payos.test/v2/payment-requests")
    expect((init!.headers as Record<string, string>)["x-client-id"]).toBe("test-client")
    expect((init!.headers as Record<string, string>)["x-api-key"]).toBe("test-api-key")
    const body = JSON.parse(init!.body as string)
    expect(body).toMatchObject({ ...input, signature: signPaymentRequest(KEY, input) })
  })
  it("createPaymentLink: code khác 00 → ném lỗi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "231", desc: "Đơn đã tồn tại" }), { status: 200 }))
    await expect(createPaymentLink(cfg, { orderCode: 1, amount: 1, description: "SM A", returnUrl: "r", cancelUrl: "c", expiredAt: 1 })).rejects.toThrow()
  })
  it("cancelPaymentLink gọi đúng URL; HTTP 500 → ném lỗi", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ code: "00" }), { status: 200 }))
    await cancelPaymentLink(cfg, "pl1")
    expect(fetchSpy.mock.calls[0][0]).toBe("https://payos.test/v2/payment-requests/pl1/cancel")
    fetchSpy.mockResolvedValueOnce(new Response("err", { status: 500 }))
    await expect(cancelPaymentLink(cfg, "pl1")).rejects.toThrow()
  })
})

it("parsePayosDateTime: giờ VN", () => {
  expect(parsePayosDateTime("2026-10-09 20:15:00").toISOString()).toBe("2026-10-09T13:15:00.000Z")
})
```

- [ ] **Step 2: Chạy, thấy đỏ** (khoá test) `pnpm test tests/unit/server/payos.test.ts` → FAIL "Cannot find module".

- [ ] **Step 3: Cài đặt** `src/server/payos.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto"

export type PayosConfig = { clientId: string; apiKey: string; checksumKey: string; baseUrl: string }

const DEFAULT_BASE = "https://api-merchant.payos.vn"
const TIMEOUT_MS = 5000

export function getPayosConfig(): PayosConfig | null {
  const clientId = process.env.PAYOS_CLIENT_ID?.trim()
  const apiKey = process.env.PAYOS_API_KEY?.trim()
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim()
  if (!clientId || !apiKey || !checksumKey) return null
  return { clientId, apiKey, checksumKey, baseUrl: process.env.PAYOS_API_BASE?.trim() || DEFAULT_BASE }
}

const hmac = (key: string, s: string) => createHmac("sha256", key).update(s).digest("hex")

export function signPaymentRequest(
  key: string,
  d: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string }
): string {
  return hmac(key, `amount=${d.amount}&cancelUrl=${d.cancelUrl}&description=${d.description}&orderCode=${d.orderCode}&returnUrl=${d.returnUrl}`)
}

// Theo SDK payOS: khoá xếp alphabet, null/undefined (kể cả chuỗi "null") thành rỗng.
export function signWebhookData(key: string, data: Record<string, unknown>): string {
  const s = Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k]
      const empty = v === null || v === undefined || v === "null" || v === "undefined"
      return `${k}=${empty ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)}`
    })
    .join("&")
  return hmac(key, s)
}

export function verifyWebhookSignature(key: string, data: Record<string, unknown>, signature: string): boolean {
  const a = Buffer.from(signWebhookData(key, data))
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function call(cfg: PayosConfig, path: string, body: unknown): Promise<{ code?: string; desc?: string; data?: unknown }> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: { "x-client-id": cfg.clientId, "x-api-key": cfg.apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`payOS HTTP ${res.status}`)
  const json = (await res.json()) as { code?: string; desc?: string; data?: unknown }
  if (json.code !== "00") throw new Error(`payOS ${json.code}: ${json.desc ?? ""}`)
  return json
}

export async function createPaymentLink(
  cfg: PayosConfig,
  input: { orderCode: number; amount: number; description: string; returnUrl: string; cancelUrl: string; expiredAt: number }
): Promise<{ paymentLinkId: string; qrCode: string; checkoutUrl: string }> {
  const json = await call(cfg, "/v2/payment-requests", { ...input, signature: signPaymentRequest(cfg.checksumKey, input) })
  const d = json.data as { paymentLinkId?: string; qrCode?: string; checkoutUrl?: string } | undefined
  if (!d?.paymentLinkId || !d.qrCode || !d.checkoutUrl) throw new Error("payOS thiếu dữ liệu link")
  return { paymentLinkId: d.paymentLinkId, qrCode: d.qrCode, checkoutUrl: d.checkoutUrl }
}

export async function cancelPaymentLink(cfg: PayosConfig, paymentLinkId: string): Promise<void> {
  await call(cfg, `/v2/payment-requests/${encodeURIComponent(paymentLinkId)}/cancel`, { cancellationReason: "Huỷ đơn" })
}

export function parsePayosDateTime(s: string): Date {
  return new Date(`${s.trim().replace(" ", "T")}+07:00`)
}
```

- [ ] **Step 4: Chạy xanh** + tsc + lint.
- [ ] **Step 5: Commit** `git commit -m "feat(ag): thư viện payOS ký, kiểm chữ ký, tạo và huỷ link"`

---

### Task 3: Lõi kích hoạt dùng chung + xử lý webhook

**Files:**
- Modify: `src/server/services/plan-admin.service.ts` (tách `activateOrderInTx`, `approveOrder`/`rejectOrder` nhận đơn có tiền)
- Create: `src/server/services/payos-order.service.ts`
- Test: `tests/integration/payos-webhook.test.ts` (tạo mới); chạy lại `tests/integration/admin.test.ts`

**Interfaces:**
- Consumes: Task 1 cột; Task 2 `getPayosConfig`, `verifyWebhookSignature`, `parsePayosDateTime`, `signWebhookData`.
- Produces:
  - `activateOrderInTx(tx: Prisma.TransactionClient, id: number, decidedBy: string, now: Date, mode: "pending" | "paid"): Promise<{ grantedUntil: Date; creditDays: number; userId: number } | null>` — `null` = không chốt được (trạng thái không hợp lệ hoặc `computeApproval` null; khi null **không ghi gì**, transaction gọi ném/rollback do caller quyết).
  - `isAttention(o: { status: string; paidAmount: number | null; paidReviewedAt: Date | null }): boolean` = `paidAmount !== null && status !== "approved" && paidReviewedAt === null`
  - `handlePayosWebhook(db: PrismaClient, body: unknown): Promise<{ status: 200 | 400 | 401 | 503; result: string }>`

- [ ] **Step 1: Test đỏ** `tests/integration/payos-webhook.test.ts` — dùng `teacher_std`, env ngân hàng như `plan-orders.test.ts`, khoá giả payOS. Helper trong file:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { signWebhookData } from "@/server/payos"
import { handlePayosWebhook } from "@/server/services/payos-order.service"
import { addDays } from "@/lib/plans"

const ENV = {
  PLAN_BANK_BIN: "970436", PLAN_BANK_ACCOUNT_NUMBER: "0123456789", PLAN_BANK_ACCOUNT_NAME: "CHU APP TEST",
  PAYOS_CLIENT_ID: "test-client", PAYOS_API_KEY: "test-api-key", PAYOS_CHECKSUM_KEY: "test-checksum-key",
}
let userId = 0

async function makeOrder(over: Partial<{ status: string; amount: number; createdAt: Date; plan: string; payosLinkId: string }> = {}) {
  return db.planOrder.create({
    data: {
      userId, plan: over.plan ?? "pro", period: "month", amount: over.amount ?? 99000, code: `T${Math.floor(Math.random() * 1e5)}`,
      status: over.status ?? "pending", method: "payos", payosLinkId: over.payosLinkId ?? "pl-x", createdAt: over.createdAt ?? new Date(),
    },
  })
}

function payload(o: { id: number; payosLinkId: string | null }, amount: number, reference = `REF${o.id}-${amount}`) {
  const data = {
    orderCode: o.id, amount, description: "SM ABC123", accountNumber: "0123456789", reference,
    transactionDateTime: "2026-10-09 20:15:00", currency: "VND", paymentLinkId: o.payosLinkId,
    code: "00", desc: "success", counterAccountBankId: "", counterAccountBankName: "", counterAccountName: null,
    counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "",
  }
  return { code: "00", desc: "success", success: true, data, signature: signWebhookData(ENV.PAYOS_CHECKSUM_KEY, data) }
}

beforeAll(async () => { userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id })
beforeEach(async () => {
  Object.assign(process.env, ENV)
  await db.planOrder.deleteMany({ where: { userId } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null, trialEndsAt: null } })
})
afterAll(async () => {
  for (const k of Object.keys(ENV)) delete process.env[k]
  await db.planOrder.deleteMany({ where: { userId } })
  await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null } })
})
```

Các test (mỗi `it` một hành vi):

```ts
it("pending đủ tiền → gói bật, decidedBy payos, ghi paidAmount/paidAt/payosRef", async () => {
  const o = await makeOrder()
  expect(await handlePayosWebhook(db, payload(o, 99000))).toMatchObject({ status: 200 })
  const after = await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })
  expect(after).toMatchObject({ status: "approved", decidedBy: "payos", paidAmount: 99000, payosRef: `REF${o.id}-99000` })
  expect(after.paidAt?.toISOString()).toBe("2026-10-09T13:15:00.000Z")
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("pro")
})
it("dư tiền vẫn bật", async () => {
  const o = await makeOrder()
  await handlePayosWebhook(db, payload(o, 120000))
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("approved")
})
it("gửi lặp cùng reference: không cộng ngày lần 2", async () => {
  const o = await makeOrder()
  await handlePayosWebhook(db, payload(o, 99000))
  const first = (await db.user.findUniqueOrThrow({ where: { id: userId } })).planExpiresAt
  expect(await handlePayosWebhook(db, payload(o, 99000))).toMatchObject({ status: 200 })
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).planExpiresAt).toEqual(first)
})
it("2 webhook song song (cùng reference) chỉ kích hoạt 1 lần", async () => {
  const o = await makeOrder()
  const res = await Promise.all([handlePayosWebhook(db, payload(o, 99000)), handlePayosWebhook(db, payload(o, 99000))])
  expect(res.every((r) => r.status === 200)).toBe(true)
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } })
  expect(u.planExpiresAt!.getTime() - Date.now()).toBeLessThan(40 * 86400_000)
})
it("thiếu tiền → vẫn pending, có paidAmount (cần xử lý)", async () => {
  const o = await makeOrder()
  await handlePayosWebhook(db, payload(o, 50000))
  expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "pending", paidAmount: 50000 })
})
it.each(["expired", "cancelled", "rejected"])("đơn %s nhận đủ tiền → không bật, ghi paidAmount", async (status) => {
  const o = await makeOrder({ status })
  await handlePayosWebhook(db, payload(o, 99000))
  expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status, paidAmount: 99000 })
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("standard")
})
it("đơn pending quá 7 ngày (chưa ai chốt expired) nhận đủ tiền → expired, không bật", async () => {
  const o = await makeOrder({ createdAt: addDays(new Date(), -8) })
  await handlePayosWebhook(db, payload(o, 99000))
  expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "expired", paidAmount: 99000 })
})
it("Plus khi đang có Pro trả phí (không duyệt được) → 200, vẫn pending có tiền", async () => {
  await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 60) } })
  const o = await makeOrder({ plan: "plus", amount: 49000 })
  expect(await handlePayosWebhook(db, payload(o, 49000))).toMatchObject({ status: 200 })
  expect(await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: "pending", paidAmount: 49000 })
})
it("paymentLinkId không khớp (giao dịch thử payOS trùng id) → bỏ qua", async () => {
  const o = await makeOrder({ payosLinkId: "pl-that" })
  expect(await handlePayosWebhook(db, payload({ id: o.id, payosLinkId: "pl-thu" }, 3000))).toMatchObject({ status: 200 })
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: o.id } })).paidAmount).toBeNull()
})
it("orderCode lạ → 200; chữ ký sai → 401; thiếu data → 400; chưa cấu hình → 503", async () => {
  const o = await makeOrder()
  expect((await handlePayosWebhook(db, payload({ id: 999999, payosLinkId: "x" }, 1))).status).toBe(200)
  const bad = payload(o, 99000); bad.signature = "0".repeat(64)
  expect((await handlePayosWebhook(db, bad)).status).toBe(401)
  expect((await handlePayosWebhook(db, { signature: "x" })).status).toBe(400)
  delete process.env.PAYOS_CHECKSUM_KEY
  expect((await handlePayosWebhook(db, payload(o, 99000))).status).toBe(503)
})
```

Thêm vào cùng file khối admin (gọi service trực tiếp):

```ts
import { approveOrder, rejectOrder, getAdminOverview, getPendingCount } from "@/server/services/plan-admin.service"

it("admin duyệt đơn expired có tiền → gói bật; từ chối đơn có tiền → rời nhóm cần xử lý", async () => {
  const a = await makeOrder({ status: "expired", createdAt: addDays(new Date(), -8) })
  await handlePayosWebhook(db, payload(a, 99000))
  let ov = await getAdminOverview(db)
  expect(ov.attentionOrders.map((o) => o.id)).toContain(a.id)
  expect((await getPendingCount(db)).count).toBeGreaterThanOrEqual(1)
  await approveOrder(db, "admin_test", a.id)
  expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("pro")

  const b = await makeOrder({ status: "cancelled" })
  await handlePayosWebhook(db, payload(b, 99000))
  await rejectOrder(db, "admin_test", b.id)
  const rb = await db.planOrder.findUniqueOrThrow({ where: { id: b.id } })
  expect(rb.status).toBe("rejected")
  expect(rb.paidReviewedAt).not.toBeNull()
  ov = await getAdminOverview(db)
  expect(ov.attentionOrders.map((o) => o.id)).not.toContain(b.id)
})
```

- [ ] **Step 2: Chạy đỏ** (khoá test) `pnpm test tests/integration/payos-webhook.test.ts`.

- [ ] **Step 3: Tách lõi trong `plan-admin.service.ts`.** Đổi import đầu file thành `import type { Prisma, PrismaClient } from "@prisma/client"`. Thêm:

```ts
// Đơn có tiền payOS mà chưa bật gói, admin chưa xử lý → nhảy lên đầu trang đơn chờ (spec AG §6).
export function isAttention(o: { status: string; paidAmount: number | null; paidReviewedAt: Date | null }): boolean {
  return o.paidAmount !== null && o.status !== "approved" && o.paidReviewedAt === null
}

// Lõi chung duyệt tay + webhook. "pending": đơn chờ còn hạn. "paid": đơn đã nhận tiền payOS, kể cả hết hạn/huỷ/từ chối.
// Caller giữ khoá advisory theo userId. null = không chốt được, chưa ghi gì.
export async function activateOrderInTx(
  tx: Prisma.TransactionClient,
  id: number,
  decidedBy: string,
  now: Date,
  mode: "pending" | "paid"
): Promise<{ grantedUntil: Date; creditDays: number; userId: number } | null> {
  const order = await tx.planOrder.findUnique({
    where: { id },
    select: { userId: true, plan: true, period: true, bonusMonths: true, amount: true, status: true, createdAt: true, paidAmount: true },
  })
  if (!order) return null
  const ok =
    mode === "pending"
      ? order.status === "pending" && order.createdAt > addDays(now, -ORDER_TTL_DAYS)
      : order.paidAmount !== null && order.status !== "approved"
  if (!ok) return null
  const approval = await computeApproval(tx, order, now)
  if (!approval) return null
  const claimed = await tx.planOrder.updateMany({
    where: { id, status: order.status },
    data: { status: "approved", decidedBy, decidedAt: now, grantedUntil: approval.grantedUntil, creditDays: approval.creditDays },
  })
  if (claimed.count === 0) return null
  await tx.user.update({ where: { id: order.userId }, data: { plan: order.plan, planExpiresAt: approval.grantedUntil } })
  return { ...approval, userId: order.userId }
}
```

Viết lại thân transaction của `approveOrder` (giữ nguyên khoá advisory + kiểm tài khoản đã xoá + đúng các thông báo lỗi cũ):

```ts
    const cur = await tx.planOrder.findUniqueOrThrow({ where: { id }, select: { status: true, paidAmount: true, paidReviewedAt: true } })
    // Đơn có tiền payOS chưa xử lý: admin được duyệt cả khi đã hết hạn/huỷ/từ chối.
    const mode = isAttention(cur) ? "paid" : "pending"
    const done = await activateOrderInTx(tx, id, admin, now, mode)
    if (done) return done
    if (cur.status === "pending") {
      const fresh = await tx.planOrder.findUniqueOrThrow({ where: { id }, select: { createdAt: true } })
      if (fresh.createdAt <= addDays(now, -ORDER_TTL_DAYS)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Đơn đã quá 7 ngày chưa xác nhận nên đã hết hạn. Nếu khách đã chuyển khoản, hãy dùng Đặt gói" })
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản đang có gói Pro còn hạn, không duyệt được đơn Plus" })
    }
    if (mode === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản đang có gói Pro còn hạn, không duyệt được đơn Plus" })
    throw new TRPCError({ code: "CONFLICT", message: "Đơn không còn ở trạng thái chờ" })
```

(Lưu ý: chạy lại `tests/integration/admin.test.ts` — mọi thông báo lỗi cũ phải giữ nguyên. Nếu test cũ đòi đúng thứ tự kiểm khác, sửa code cho khớp test cũ, không sửa test.)

`rejectOrder`:

```ts
export async function rejectOrder(db: PrismaClient, admin: string, id: number, note?: string): Promise<{ success: true }> {
  const now = new Date()
  const cur = await db.planOrder.findUnique({ where: { id }, select: { status: true, paidAmount: true, paidReviewedAt: true, payosLinkId: true } })
  const paid = cur !== null && isAttention(cur)
  const { count } = await db.planOrder.updateMany({
    where: paid ? { id, status: cur.status } : { id, status: "pending" },
    data: {
      status: "rejected",
      note: note || (paid ? "Đã nhận tiền qua payOS, chủ app tự hoàn" : null),
      decidedBy: admin,
      decidedAt: now,
      ...(paid ? { paidReviewedAt: now } : {}),
    },
  })
  if (count === 0) throw new TRPCError({ code: "CONFLICT", message: "Đơn không còn ở trạng thái chờ" })
  console.info(`[admin] ${admin} từ chối đơn ${id}`)
  if (cur?.payosLinkId && !paid) await cancelPayosLinkSafe(cur.payosLinkId)
  return { success: true }
}
```

(`cancelPayosLinkSafe` import từ `@/server/payos`, Step 4.)

`getAdminOverview`: thêm truy vấn thứ 4 trong `Promise.all`:

```ts
    db.planOrder.findMany({
      where: { paidAmount: { not: null }, status: { not: "approved" }, paidReviewedAt: null, user: { isDeleted: false } },
      orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      select: { id: true, code: true, plan: true, period: true, amount: true, bonusMonths: true, createdAt: true, userId: true, status: true, method: true, paidAmount: true, paidAt: true, user: { select: { username: true, fullName: true } } },
    }),
```

Trả thêm `attentionOrders` (map như `pendingOrders` + `status`, `paidAmount`, `paidAt`, `preview`), và **loại các đơn này khỏi `pendingOrders`** (lọc theo id). `pendingOrders` thêm trường `method` vào select. `getPendingCount.count` = số đơn pending **không** có tiền + số `attentionOrders` (2 `count` rồi cộng).

- [ ] **Step 4: `src/server/services/payos-order.service.ts`** (phần webhook + huỷ link; phần tạo link ở Task 4):

```ts
import type { PrismaClient } from "@prisma/client"
import { cancelPaymentLink, getPayosConfig, parsePayosDateTime, verifyWebhookSignature } from "@/server/payos"
import { expireStaleOrders } from "./plan.service"
import { activateOrderInTx } from "./plan-admin.service"

type WebhookData = { orderCode: number; amount: number; reference: string; transactionDateTime: string; paymentLinkId: string }

function readBody(body: unknown): { data: Record<string, unknown>; signature: string } | null {
  if (!body || typeof body !== "object") return null
  const b = body as { data?: unknown; signature?: unknown }
  if (!b.data || typeof b.data !== "object" || typeof b.signature !== "string") return null
  return { data: b.data as Record<string, unknown>, signature: b.signature }
}

export async function handlePayosWebhook(db: PrismaClient, body: unknown): Promise<{ status: 200 | 400 | 401 | 503; result: string }> {
  const cfg = getPayosConfig()
  if (!cfg) return { status: 503, result: "chưa cấu hình" }
  const parsed = readBody(body)
  if (!parsed) return { status: 400, result: "thiếu data" }
  if (!verifyWebhookSignature(cfg.checksumKey, parsed.data, parsed.signature)) return { status: 401, result: "sai chữ ký" }
  const d = parsed.data as unknown as WebhookData
  if (!Number.isInteger(d.orderCode) || !Number.isInteger(d.amount) || typeof d.reference !== "string") return { status: 200, result: "dữ liệu lạ" }

  const owner = await db.planOrder.findUnique({ where: { id: d.orderCode }, select: { userId: true, payosLinkId: true } })
  // Giao dịch thử của payOS (orderCode 123) có thể trùng id đơn thật: chỉ nhận khi đúng link của đơn.
  if (!owner || !owner.payosLinkId || owner.payosLinkId !== d.paymentLinkId) return { status: 200, result: "không khớp đơn" }

  const now = new Date()
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(owner.userId)})`
    await expireStaleOrders(tx, now, owner.userId)
    const order = await tx.planOrder.findUniqueOrThrow({ where: { id: d.orderCode }, select: { status: true, amount: true, payosRef: true, paidAmount: true } })
    if (order.payosRef === d.reference) return "gửi lặp"
    const paidAmount = (order.paidAmount ?? 0) + d.amount
    await tx.planOrder.update({
      where: { id: d.orderCode },
      data: { paidAmount, paidAt: parsePayosDateTime(d.transactionDateTime), payosRef: d.reference },
    })
    if (order.status !== "pending" || paidAmount < order.amount) return `cần xử lý (${order.status}, ${paidAmount}/${order.amount})`
    const done = await activateOrderInTx(tx, d.orderCode, "payos", now, "pending")
    return done ? "đã kích hoạt" : "cần xử lý (không duyệt được)"
  })
  console.info(`[payos] đơn ${d.orderCode}: ${result}`)
  return { status: 200, result }
}

// Đặt trong src/server/payos.ts (không phải file service) để plan-admin/plan.service import không vòng.
// Huỷ link để QR cũ không trả được nữa; lỗi chỉ log (link vẫn tự hết hạn).
export async function cancelPayosLinkSafe(paymentLinkId: string): Promise<void> {
  const cfg = getPayosConfig()
  if (!cfg) return
  try {
    await cancelPaymentLink(cfg, paymentLinkId)
  } catch (e) {
    console.warn(`[payos] huỷ link lỗi: ${e instanceof Error ? e.message : "?"}`)
  }
}
```

Hai webhook song song cùng `reference`: cái sau vào transaction sau khoá advisory, thấy `payosRef` trùng → "gửi lặp". Nếu `@unique` của `payosRef` ném P2002 (reference trùng ở đơn khác) → bắt trong `handlePayosWebhook` trả `{ status: 200, result: "reference trùng" }`.

- [ ] **Step 5: Xanh**: `payos-webhook.test.ts` + `admin.test.ts` + `plan-orders.test.ts`; tsc + lint.
- [ ] **Step 6: Commit** `git commit -m "feat(ag): webhook payOS tự kích hoạt đơn chờ đủ tiền, đơn lệch vào nhóm admin cần xử lý"`

---

### Task 4: Tạo đơn chọn cách thanh toán + link payOS, huỷ link

**Files:**
- Modify: `src/server/trpc/index.ts` (Context thêm `origin?: string | null`; `createTRPCContext` trả `origin: new URL(opts.req.url).origin`)
- Modify: `src/lib/schemas/plan.ts` (`createOrderSchema` thêm `method: z.enum(["payos", "vietqr"]).optional()`)
- Modify: `src/server/services/plan.service.ts` (`createOrder`, `cancelOrder`, `getMyPlan`)
- Modify: `src/server/services/payos-order.service.ts` (thêm `attachPayosLink`)
- Modify: `src/server/trpc/routers/plan.ts`
- Test: `tests/integration/plan-orders-payos.test.ts` (tạo mới); chạy lại `plan-orders.test.ts`

**Interfaces:**
- Consumes: Task 2 `createPaymentLink`, `getPayosConfig`; Task 3 `cancelPayosLinkSafe` (nằm trong `src/server/payos.ts`).
- Produces:
  - `createOrder(db, userId, input, origin?: string | null): Promise<{ id; code; bonusMonths; amount; method: "payos" | "vietqr"; payosFailed: boolean }>`
  - `plan.me` thêm `payosReady: boolean`; `pendingOrder` thêm `method`, `payos: { qr: string; checkoutUrl: string } | null`.
  - `attachPayosLink(db, order: { id: number; code: string; amount: number; createdAt: Date }, origin: string): Promise<boolean>`

- [ ] **Step 1: Test đỏ** `tests/integration/plan-orders-payos.test.ts` (env như Task 3; `getAuthedCaller("teacher_std")`; mock `fetch` bằng `vi.spyOn(globalThis, "fetch")`). Caller test không có `origin` → thêm vào helper? **Không**: test gọi service trực tiếp cho nhánh payOS:

```ts
import { createOrder, cancelOrder, getMyPlan } from "@/server/services/plan.service"
const ORIGIN = "http://localhost:3000"
const okLink = () => new Response(JSON.stringify({ code: "00", data: { paymentLinkId: "pl-1", qrCode: "000201PAYOSQR", checkoutUrl: "https://pay.payos.vn/web/pl-1" } }), { status: 200 })

it("payos thành công: lưu link, me trả payos + payosReady", async () => {
  const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(okLink())
  const r = await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
  expect(r).toMatchObject({ method: "payos", payosFailed: false })
  const body = JSON.parse(f.mock.calls[0][1]!.body as string)
  expect(body).toMatchObject({ orderCode: r.id, amount: r.amount, description: `SM ${r.code}`, returnUrl: `${ORIGIN}/plan`, cancelUrl: `${ORIGIN}/plan` })
  const me = await getMyPlan(db, userId, "teacher_std")
  expect(me.payosReady).toBe(true)
  expect(me.pendingOrder).toMatchObject({ method: "payos", payos: { qr: "000201PAYOSQR", checkoutUrl: "https://pay.payos.vn/web/pl-1" } })
})
it("payOS lỗi/timeout → đơn thành vietqr, payosFailed", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timeout", "TimeoutError"))
  const r = await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
  expect(r).toMatchObject({ method: "vietqr", payosFailed: true })
  expect((await db.planOrder.findUniqueOrThrow({ where: { id: r.id } })).method).toBe("vietqr")
})
it("không gửi method (tab JS cũ) hoặc chưa cấu hình payOS → vietqr, không gọi fetch", async () => {
  const f = vi.spyOn(globalThis, "fetch")
  expect((await createOrder(db, userId, { plan: "pro", period: "month" }, ORIGIN)).method).toBe("vietqr")
  delete process.env.PAYOS_API_KEY
  expect((await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)).method).toBe("vietqr")
  expect(f).not.toHaveBeenCalled()
  expect((await getMyPlan(db, userId, "teacher_std")).payosReady).toBe(false)
})
it("huỷ đơn payOS → gọi API huỷ link; API lỗi vẫn huỷ được", async () => {
  const f = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(okLink())
  const r = await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
  f.mockResolvedValueOnce(new Response("err", { status: 500 }))
  await expect(cancelOrder(db, userId, r.id)).resolves.toEqual({ success: true })
  expect(f.mock.calls[1][0]).toBe("https://api-merchant.payos.vn/v2/payment-requests/pl-1/cancel")
})
it("đơn mới thay đơn payOS cũ → huỷ link cũ", async () => {
  const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(okLink())
  await createOrder(db, userId, { plan: "pro", period: "month", method: "payos" }, ORIGIN)
  await createOrder(db, userId, { plan: "pro", period: "year", method: "vietqr" }, ORIGIN)
  expect(f.mock.calls.some(([u]) => String(u).endsWith("/pl-1/cancel"))).toBe(true)
})
```

(`beforeEach`: `vi.restoreAllMocks()` + env + xoá đơn của user như Task 3.)

- [ ] **Step 2: Chạy đỏ.**

- [ ] **Step 3: Cài đặt.**
  - `payos-order.service.ts` thêm:

```ts
import { ORDER_TTL_DAYS, addDays } from "@/lib/plans"
import { createPaymentLink } from "@/server/payos"

// false = payOS lỗi → caller đổi đơn sang vietqr (không chặn người mua).
export async function attachPayosLink(db: PrismaClient, order: { id: number; code: string; amount: number; createdAt: Date }, origin: string): Promise<boolean> {
  const cfg = getPayosConfig()
  if (!cfg) return false
  try {
    const link = await createPaymentLink(cfg, {
      orderCode: order.id,
      amount: order.amount,
      description: `SM ${order.code}`,
      returnUrl: `${origin}/plan`,
      cancelUrl: `${origin}/plan`,
      expiredAt: Math.floor(addDays(order.createdAt, ORDER_TTL_DAYS).getTime() / 1000),
    })
    await db.planOrder.update({ where: { id: order.id }, data: { payosLinkId: link.paymentLinkId, payosQr: link.qrCode, payosCheckoutUrl: link.checkoutUrl } })
    return true
  } catch (e) {
    console.warn(`[payos] tạo link đơn ${order.id} lỗi: ${e instanceof Error ? e.message : "?"}`)
    return false
  }
}
```

  - `createOrder(db, userId, input, origin?)`: `const wantPayos = input.method === "payos" && getPayosConfig() !== null && !!origin`. Trong transaction, **trước** `updateMany` huỷ đơn chờ cũ: `const replaced = await tx.planOrder.findMany({ where: { userId, status: "pending", payosLinkId: { not: null } }, select: { payosLinkId: true } })`; `create` thêm `method: wantPayos ? "payos" : "vietqr"`, select thêm `createdAt`; transaction trả thêm `replaced` + `createdAt`. Sau transaction:

```ts
    for (const r of res.replaced) await cancelPayosLinkSafe(r.payosLinkId!)
    let method: "payos" | "vietqr" = "vietqr"
    let payosFailed = false
    if (wantPayos) {
      if (await attachPayosLink(db, { id: res.id, code: res.code, amount: res.amount, createdAt: res.createdAt }, origin!)) method = "payos"
      else {
        payosFailed = true
        await db.planOrder.update({ where: { id: res.id }, data: { method: "vietqr" } })
      }
    }
    return { id: res.id, code: res.code, bonusMonths: res.bonusMonths, amount: res.amount, method, payosFailed }
```

  (Giữ vòng thử lại P2002 quanh transaction như cũ; phần sau transaction chạy 1 lần.)
  - `cancelOrder`: đọc `payosLinkId` của đơn trước khi huỷ; huỷ xong `if (link) await cancelPayosLinkSafe(link)`.
  - `getMyPlan`: `ORDER_SELECT` thêm `method: true, payosQr: true, payosCheckoutUrl: true`; `pendingOrder` thêm `method: pending.method`, `payos: pending.method === "payos" && pending.payosQr && pending.payosCheckoutUrl ? { qr: pending.payosQr, checkoutUrl: pending.payosCheckoutUrl } : null`; trả `payosReady: bank !== null && getPayosConfig() !== null`. **Không** đưa `payosQr`/`payosCheckoutUrl` vào mảng `orders` (bỏ khỏi object trước khi trả, hoặc dùng select riêng cho `pending`).
  - Router: `.mutation(({ ctx, input }) => createOrder(ctx.db, ctx.userId, input, ctx.origin))`.
  - Context: `origin?: string | null` và trong `createTRPCContext` trả `origin: new URL(opts.req.url).origin`.

- [ ] **Step 4: Xanh** `plan-orders-payos.test.ts` + `plan-orders.test.ts` + `payos-webhook.test.ts`; tsc + lint.
- [ ] **Step 5: Commit** `git commit -m "feat(ag): tạo đơn chọn payOS hoặc VietQR, tạo và huỷ link payOS"`

---

### Task 5: Route webhook

**Files:**
- Create: `src/app/api/payos/webhook/route.ts`
- Test: `tests/unit/api/payos-webhook-route.test.ts`

**Interfaces:** Consumes Task 3 `handlePayosWebhook`.

- [ ] **Step 1: Test đỏ** (mock service, kiểm route chỉ chuyển mã):

```ts
import { describe, it, expect, vi } from "vitest"
vi.mock("@/server/services/payos-order.service", () => ({ handlePayosWebhook: vi.fn() }))
vi.mock("@/server/db", () => ({ db: {} }))
import { handlePayosWebhook } from "@/server/services/payos-order.service"
import { POST } from "@/app/api/payos/webhook/route"

const req = (body: string) => new Request("http://localhost/api/payos/webhook", { method: "POST", body })

describe("POST /api/payos/webhook", () => {
  it("JSON hỏng → 400, không gọi service", async () => {
    expect((await POST(req("{oops"))).status).toBe(400)
    expect(handlePayosWebhook).not.toHaveBeenCalled()
  })
  it("trả đúng status của service, body không lộ chi tiết", async () => {
    vi.mocked(handlePayosWebhook).mockResolvedValueOnce({ status: 401, result: "sai chữ ký" })
    const r = await POST(req("{}"))
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ ok: false })
    vi.mocked(handlePayosWebhook).mockResolvedValueOnce({ status: 200, result: "đã kích hoạt" })
    expect(await (await POST(req("{}"))).json()).toEqual({ ok: true })
  })
  it("service ném lỗi → 500 (payOS gửi lại sau)", async () => {
    vi.mocked(handlePayosWebhook).mockRejectedValueOnce(new Error("db"))
    expect((await POST(req("{}"))).status).toBe(500)
  })
})
```

- [ ] **Step 2: Đỏ.** **Step 3:**

```ts
import { db } from "@/server/db"
import { handlePayosWebhook } from "@/server/services/payos-order.service"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
  try {
    const { status } = await handlePayosWebhook(db, body)
    return Response.json({ ok: status === 200 }, { status })
  } catch (e) {
    console.error(`[payos] webhook lỗi: ${e instanceof Error ? e.message : "?"}`)
    return Response.json({ ok: false }, { status: 500 })
  }
}
```

Kiểm `src/middleware.ts` (hoặc `auth.config.ts` `authorized`) không chặn `/api/payos/webhook` khi chưa đăng nhập; nếu có danh sách đường công khai thì thêm `/api/payos/webhook` + test tương ứng có sẵn của middleware.

- [ ] **Step 4: Xanh** + tsc + lint. **Step 5: Commit** `git commit -m "feat(ag): route webhook payOS"`

---

### Task 6: Liên hệ chủ app — service, router, form admin

**Files:**
- Create: `src/server/services/contact.service.ts`, `src/server/trpc/routers/contact.ts`, `src/lib/schemas/contact.ts`, `src/components/admin/ContactForm.tsx`
- Modify: `src/server/trpc/root.ts` (thêm `contact`), `src/app/(admin)/admin/prices/page.tsx` (thêm `<ContactForm />` sau `<TrialDaysForm />`), `vi.json`/`en.json`
- Test: `tests/integration/contact.test.ts`, `tests/unit/lib/contact-schema.test.ts`

**Interfaces:**
- Produces: `contact.get` (publicProcedure) → `{ phone: string; facebookUrl: string | null } | null`; `contact.history` (adminProcedure) → 5 dòng mới nhất `{ phone, facebookUrl, changedBy, createdAt }[]`; `contact.update` (adminProcedure, input `{ phone: string; facebookUrl: string }`, `facebookUrl` rỗng = null).

- [ ] **Step 1: Test đỏ schema** `tests/unit/lib/contact-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { contactInputSchema } from "@/lib/schemas/contact"
const ok = (v: object) => contactInputSchema.safeParse(v).success
describe("contactInputSchema", () => {
  it("SĐT: chỉ số, 9–11 chữ số, bắt đầu 0; bỏ khoảng trắng/dấu chấm", () => {
    expect(ok({ phone: "0979479550", facebookUrl: "" })).toBe(true)
    expect(ok({ phone: "0979 479 550", facebookUrl: "" })).toBe(true)
    expect(contactInputSchema.parse({ phone: "0979.479.550", facebookUrl: "" }).phone).toBe("0979479550")
    for (const p of ["979479550", "09794795501234", "09a9479550", ""]) expect(ok({ phone: p, facebookUrl: "" })).toBe(false)
  })
  it("Facebook: https + host facebook.com/www/m/fb.com; rỗng → null", () => {
    expect(ok({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })).toBe(true)
    expect(ok({ phone: "0979479550", facebookUrl: "https://fb.com/x" })).toBe(true)
    for (const u of ["http://facebook.com/x", "https://evil.com/facebook.com", "javascript:alert(1)", "https://facebook.com.evil.com/x"]) {
      expect(ok({ phone: "0979479550", facebookUrl: u })).toBe(false)
    }
    expect(contactInputSchema.parse({ phone: "0979479550", facebookUrl: "  " }).facebookUrl).toBeNull()
  })
})
```

- [ ] **Step 2: Đỏ.** **Step 3:** `src/lib/schemas/contact.ts`:

```ts
import { z } from "zod"

const FB_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com"]

export const contactInputSchema = z.object({
  phone: z
    .string()
    .transform((s) => s.replace(/[\s.]/g, ""))
    .refine((s) => /^0\d{8,10}$/.test(s), { message: "Số điện thoại 9–11 chữ số, bắt đầu bằng 0" }),
  facebookUrl: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .refine((s) => {
      if (s === null) return true
      try {
        const u = new URL(s)
        return u.protocol === "https:" && FB_HOSTS.includes(u.hostname)
      } catch {
        return false
      }
    }, { message: "Link Facebook phải bắt đầu bằng https://facebook.com/" }),
})
export type ContactInput = z.infer<typeof contactInputSchema>
```

(Thông báo lỗi có dấu "–" là chữ hiển thị → đổi thành "Số điện thoại từ 9 đến 11 chữ số, bắt đầu bằng 0".)

- [ ] **Step 4: Test đỏ integration** `tests/integration/contact.test.ts` (`publicCaller`, `getAuthedCaller("admin_test")` với `process.env.ADMIN_USERNAMES = "admin_test"`, `getAuthedCaller("teacher_std")`):

```ts
it("chưa cài → get null; admin lưu → get trả dòng mới nhất; history 5 dòng mới nhất", async () => {
  expect(await publicCaller.contact.get()).toBeNull()
  const admin = await getAuthedCaller("admin_test")
  for (let i = 0; i < 6; i++) await admin.contact.update({ phone: `097947955${i}`, facebookUrl: "" })
  await admin.contact.update({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })
  expect(await publicCaller.contact.get()).toEqual({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })
  const h = await admin.contact.history()
  expect(h).toHaveLength(5)
  expect(h[0]).toMatchObject({ phone: "0979479550", changedBy: "admin_test" })
})
it("giáo viên không sửa được", async () => {
  await expect((await getAuthedCaller("teacher_std")).contact.update({ phone: "0979479550", facebookUrl: "" })).rejects.toThrow()
})
```

- [ ] **Step 5: Cài đặt** service (`getContact(db)` = `findFirst orderBy [{createdAt:"desc"},{id:"desc"}]`, `updateContact(db, admin, input)` = `create`, `getContactHistory(db)` = `take: 5`), router, root. `ContactForm.tsx` theo mẫu `TrialDaysForm.tsx` (Card, 2 `Input` có `<Label>`, `inputMode="tel"` cho SĐT, nút Lưu `h-11 md:h-10`, toast thành công/lỗi, danh sách 5 lần sửa: SĐT · Facebook · người sửa · `dateTimeVn`). i18n key mới: `contact_title` ("Liên hệ hỗ trợ"), `contact_phone` ("Số điện thoại (cũng là Zalo)"), `contact_facebook` ("Link Facebook cá nhân"), `contact_saved` ("Đã lưu liên hệ"), `contact_history` ("Lần sửa gần đây").
- [ ] **Step 6: Xanh** 2 file test + `admin-prices` liên quan nếu có unit; tsc + lint. **Step 7: Commit** `git commit -m "feat(ag): liên hệ chủ app sửa trong admin"`

---

### Task 7: Khối `ContactOwner` + đặt vào 3 chỗ

**Files:**
- Create: `src/components/common/ContactOwner.tsx`
- Modify: `src/components/privacy/PrivacyContent.tsx`, `src/components/guide/GuideContent.tsx`, `vi.json`/`en.json`
- Test: `tests/unit/components/ContactOwner.test.tsx`

**Interfaces:**
- Produces: `<ContactOwner title?: string />` — tự gọi `trpc.contact.get.useQuery()`; chưa cài hoặc đang tải → `null`.

- [ ] **Step 1: Test đỏ** (mock `@/lib/trpc` theo cách các test component khác trong `tests/unit/components` đang mock tRPC — đọc 1 file mẫu trước, vd `TuitionPageMobileCard.test.tsx`):

```tsx
it("có liên hệ: 3 nút đúng href, hiện số điện thoại dạng chữ, link ngoài mở tab mới", () => {
  mockContact({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })
  render(<ContactOwner />)
  expect(screen.getByRole("link", { name: /Gọi/ })).toHaveAttribute("href", "tel:0979479550")
  const zalo = screen.getByRole("link", { name: /Zalo/ })
  expect(zalo).toHaveAttribute("href", "https://zalo.me/0979479550")
  expect(zalo).toHaveAttribute("target", "_blank")
  expect(zalo).toHaveAttribute("rel", "noopener noreferrer")
  expect(screen.getByRole("link", { name: /Facebook/ })).toHaveAttribute("href", "https://www.facebook.com/ngo.quang.hien.657661")
  expect(screen.getByText("0979 479 550")).toBeInTheDocument()
})
it("không có Facebook → ẩn nút Facebook; chưa cài → không render gì", () => {
  mockContact({ phone: "0979479550", facebookUrl: null })
  const { container, rerender } = render(<ContactOwner />)
  expect(screen.queryByRole("link", { name: /Facebook/ })).toBeNull()
  mockContact(null)
  rerender(<ContactOwner />)
  expect(container).toBeEmptyDOMElement()
})
```

- [ ] **Step 2: Đỏ.** **Step 3:** Component:

```tsx
"use client"

import { Phone, MessageCircle, Facebook } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"

const btn = "inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-foreground hover:bg-slate-50 md:h-10"
// 0979479550 → 0979 479 550 cho dễ đọc khi tel:/Zalo không mở được.
const pretty = (p: string) => p.replace(/^(\d{4})(\d{3})(\d+)$/, "$1 $2 $3")

export function ContactOwner({ title }: { title?: string }) {
  const { t } = useTranslation()
  const { data } = trpc.contact.get.useQuery(undefined, { staleTime: 5 * 60_000 })
  if (!data) return null
  return (
    <div data-testid="contact-owner" className="space-y-2">
      <p className="text-sm text-slate-600">
        {title ?? t("contact_owner_title")} <span className="font-medium text-foreground">{pretty(data.phone)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${data.phone}`} className={btn}><Phone aria-hidden className="size-4" />{t("contact_call")}</a>
        <a href={`https://zalo.me/${data.phone}`} target="_blank" rel="noopener noreferrer" className={btn}><MessageCircle aria-hidden className="size-4" />Zalo</a>
        {data.facebookUrl && (
          <a href={data.facebookUrl} target="_blank" rel="noopener noreferrer" className={btn}><Facebook aria-hidden className="size-4" />Facebook</a>
        )}
      </div>
    </div>
  )
}
```

i18n: `contact_owner_title` ("Liên hệ chủ app:"), `contact_call` ("Gọi"), `contact_need_help` ("Cần hỗ trợ?"). (Nếu `lucide-react` bản hiện có không có `Facebook`, dùng `ExternalLink`.)

- [ ] **Step 4: Đặt vào:**
  - `PrivacyContent.tsx`: trong section `privacy_delete_title`, dưới đoạn văn thêm `<ContactOwner />` (chữ `{contact}` giữ `PRIVACY_CONTACT` như cũ để trang vẫn có chữ khi chưa cài).
  - `GuideContent.tsx`: ngay trước `<div className="flex flex-wrap gap-4 border-t pt-4 print:hidden">` thêm `<section className="space-y-2 print:hidden"><h2 className="text-lg font-semibold text-slate-900">{t("contact_need_help")}</h2><ContactOwner /></section>`.
  - Thẻ đơn VietQR: làm ở Task 8.
  - `/guide` và `/privacy` là trang công khai: `contact.get` là publicProcedure nên không lỗi khi chưa đăng nhập; kiểm 2 trang này có `TRPCProvider` (đọc layout); nếu không có, ghi Ruling và đọc qua server component thay vì hook.
- [ ] **Step 5: Xanh** + test sẵn có của Privacy/Guide (`tests/unit/components` liên quan) + tsc + lint. **Step 6: Commit** `git commit -m "feat(ag): khối Liên hệ chủ app ở Quyền riêng tư và Hướng dẫn"`

---

### Task 8: Giao diện mua gói — chọn cách thanh toán, thẻ QR payOS, tự cập nhật

**Files:**
- Modify: `src/components/plan/PlanPurchaseDialog.tsx`, `src/components/plan/PendingOrderCard.tsx`, `src/hooks/usePlan.ts`, `src/components/admin/AdminPendingOrders.tsx`, `vi.json`/`en.json`
- Test: `tests/unit/components/PendingOrderCard.test.tsx` (tạo mới hoặc mở rộng nếu có), `tests/unit/components/PlanPurchaseDialog*.test.tsx` (mở rộng file có sẵn nếu có), `tests/unit/components/AdminPendingOrders*.test.tsx` (nếu có)

**Interfaces:** Consumes Task 4 `me.payosReady`, `pendingOrder.method`, `pendingOrder.payos`, `createOrder` input `method` + output `payosFailed`; Task 3 `overview.attentionOrders`; Task 7 `ContactOwner`.

- [ ] **Step 1: Test đỏ** (viết theo cách mock tRPC của file test sẵn có cạnh đó):
  - PlanPurchaseDialog: `payosReady=true` → có radiogroup "Cách thanh toán" với 2 radio, mặc định chọn "Kích hoạt ngay sau khi chuyển khoản"; bấm Đặt gói gửi `method: "payos"`; chọn radio thứ 2 → gửi `method: "vietqr"`; `payosReady=false` → không có radiogroup, gửi `method: "vietqr"`; kết quả `payosFailed: true` → `toast.error` với chữ `plan_payos_failed`.
  - PendingOrderCard: đơn `method: "payos"` có `payos` → ảnh QR alt "payOS" sinh từ `payos.qr`, link "Mở trang thanh toán" tới `checkoutUrl` `target=_blank`, chữ `plan_payos_hint`, **không** có `ContactOwner`; đơn `vietqr` → chữ `plan_vietqr_report` + `ContactOwner` (mock trả liên hệ).
  - AdminPendingOrders: `attentionOrders` hiện trước `pendingOrders`, `data-testid="attention-order"`, chữ "Đã chuyển 99.000 đ lúc 20:15 09/10 nhưng đơn đã hết hạn. Duyệt?" (hết hạn/huỷ/từ chối/thiếu tiền đúng câu), có nút Duyệt + Từ chối; mỗi đơn có nhãn `payOS`/`VietQR`.

- [ ] **Step 2: Đỏ.** **Step 3: Cài đặt.**
  - **PlanPurchaseDialog**: state `const [method, setMethod] = useState<"payos" | "vietqr">("payos")`. Trong `<aside>` ngay trên nút Đặt gói, khi `me.payosReady`: `<div role="radiogroup" aria-label={t("plan_pay_method")} onKeyDown={handleRadioGroupKeyDown} className="flex flex-col gap-2">` 2 nút `role="radio"` dùng `optionClass` + `RadioDot` (mỗi nút `p-3`, cao ≥ 44px), tiêu đề + 1 dòng mô tả. `create.mutate({ ...choice, expectedAmount: price, method: me.payosReady ? method : "vietqr" })`. `onSuccess`: nếu `res.payosFailed` → `toast.error(t("plan_payos_failed"))` (thay vì `toast.success`).
  - **PendingOrderCard**: QR lấy `order.method === "payos" && order.payos ? order.payos.qr : order.qr?.payload`; alt `"payOS"`/`"VietQR"`. Nhánh payOS: dưới QR hiện số tiền + nội dung (giữ hàng copy cho 2 dòng này), nút `<a href={order.payos.checkoutUrl} target="_blank" rel="noopener noreferrer" className="... h-11 md:h-10">{t("plan_payos_open")}</a>`, chữ `plan_payos_hint` thay `plan_pending_hint`. Nhánh VietQR: giữ nguyên + `<p>{t("plan_vietqr_report")}</p><ContactOwner />`.
  - **usePlan**: `trpc.plan.me.useQuery(undefined, { refetchInterval: (q) => (q.state.data?.pendingOrder?.method === "payos" ? 5000 : false) })` (gói bật → `pendingOrder` null → tự dừng).
  - **PlanPurchaseDialog** đang dùng `trpc.plan.me.useQuery()` riêng: giữ, React Query gộp chung key nên polling của `usePlan` áp cho cả dialog. Khi `createdOrder` biến mất vì đã duyệt (`created !== null` mà `me.pendingOrder` null và `me.orders[0]?.id === created.id && status === "approved"`) → hiện khung xanh `t("plan_payos_activated")` thay vì thẻ lỗi tải.
  - **AdminPendingOrders**: khối `attentionOrders` đặt **trên** `ResponsiveList` (cùng card mobile/desktop: viền `border-red-300 bg-red-50`), câu theo trạng thái:
    - `status==="pending"` → `admin_paid_short`: "Đã chuyển {amount} lúc {time} nhưng còn thiếu {missing}. Duyệt?"
    - `expired`/`cancelled`/`rejected` → `admin_paid_expired` / `admin_paid_cancelled` / `admin_paid_rejected`: "Đã chuyển {amount} lúc {time} nhưng đơn đã hết hạn. Duyệt?" (… "đã huỷ" / "đã bị từ chối").
    - `{time}` = `HH:mm dd/MM` giờ VN (dùng/viết hàm trong `admin-format.ts`, có test).
    - Nút Duyệt mở cùng hộp xác nhận cũ (`preview` có sẵn); Từ chối mở hộp từ chối cũ, mô tả thêm `admin_paid_refund_note` ("Tiền đã vào tài khoản của bạn, nhớ tự hoàn cho khách.").
    - Cột/nhãn `method`: `payOS` / `VietQR` (chữ cố định, không dịch).
  - i18n mới (vi; en dịch tương ứng): `plan_pay_method` "Cách thanh toán"; `plan_pay_payos_title` "Kích hoạt ngay sau khi chuyển khoản"; `plan_pay_payos_desc` "Quét QR payOS, gói bật trong vài giây."; `plan_pay_vietqr_title` "Chuyển khoản, chờ admin duyệt"; `plan_pay_vietqr_desc` "Chuyển khoản VietQR như thường, báo admin để được duyệt."; `plan_payos_hint` "Quét QR để thanh toán, gói bật ngay khi tiền vào."; `plan_payos_open` "Mở trang thanh toán"; `plan_payos_failed` "Chưa tạo được QR tự kích hoạt, dùng chuyển khoản thường."; `plan_payos_activated` "Đã nhận tiền, gói đã được kích hoạt."; `plan_vietqr_report` "Chuyển khoản xong, báo admin để được duyệt:"; các key `admin_paid_*` ở trên.
- [ ] **Step 4: Xanh** các test component + tsc + lint.
- [ ] **Step 5: Ảnh 375px (bắt buộc, tự xem):** dùng e2e Task 9 chụp; ở task này tối thiểu kiểm bằng test rằng 2 radio là cột dọc trên mobile (`flex-col`).
- [ ] **Step 6: Commit** `git commit -m "feat(ag): chọn payOS hoặc VietQR khi mua gói, thẻ QR payOS tự cập nhật, admin thấy đơn cần xử lý"`

---

### Task 9: e2e, ảnh mobile, phát hành 0.16.0, full test

**Files:**
- Create: `tests/e2e/payos-mock-server.mjs`, `tests/e2e/ag-payos.spec.ts`
- Modify: `playwright.config.ts` (webServer thành mảng: thêm mock; env payOS giả), `package.json` (`0.16.0`), `src/lib/releases.ts`, `src/lib/guide-content*` (mục mua gói nếu có câu "chờ admin xác nhận" → nói 2 cách), `public/guide/*` nếu ảnh mục mua gói đổi (chỉ chụp lại khi người dùng đã đồng ý lệnh guide-shots; nếu chưa, ghi Ruling và để Claude hỏi)

**Interfaces:** Consumes mọi task trước.

- [ ] **Step 1: Mock payOS** `tests/e2e/payos-mock-server.mjs` (node thuần, cổng 4010):

```js
// Giả api-merchant.payos.vn cho e2e: tạo link luôn thành công, huỷ link luôn OK.
import { createServer } from "node:http"
createServer((req, res) => {
  let raw = ""
  req.on("data", (c) => (raw += c))
  req.on("end", () => {
    res.setHeader("content-type", "application/json")
    if (req.url === "/v2/payment-requests") {
      const b = JSON.parse(raw || "{}")
      return res.end(JSON.stringify({ code: "00", data: { paymentLinkId: `pl-${b.orderCode}`, qrCode: `00020101021238570010A000000727PAYOS${b.orderCode}`, checkoutUrl: `https://pay.payos.vn/web/pl-${b.orderCode}` } }))
    }
    if (req.url?.endsWith("/cancel")) return res.end(JSON.stringify({ code: "00", data: {} }))
    if (req.url === "/health") return res.end("{}")
    res.statusCode = 404
    res.end("{}")
  })
}).listen(4010, "127.0.0.1")
```

`playwright.config.ts`: `webServer: [ { command: "node tests/e2e/payos-mock-server.mjs", url: "http://127.0.0.1:4010/health", reuseExistingServer: false, timeout: 10000 }, { ...cấu hình cũ, env: { ...cũ, PAYOS_CLIENT_ID: "test-client", PAYOS_API_KEY: "test-api-key", PAYOS_CHECKSUM_KEY: "test-checksum-key", PAYOS_API_BASE: "http://127.0.0.1:4010" } } ]`. Giữ nguyên comment cũ.

- [ ] **Step 2: e2e** `tests/e2e/ag-payos.spec.ts` (serial; user `teacher_std` reset như `plan.spec.ts`; liên hệ ghi thẳng DB `contactChange.create` trong `beforeAll`, xoá ở `afterAll`):
  - Lặp `[{375,812},{1280,800}]`: mở `/plan` → Mua Pro → thấy radiogroup "Cách thanh toán", radio payOS đang chọn → Đặt gói → thẻ `pending-order` có ảnh alt `payOS` + link "Mở trang thanh toán" → **chụp** `.superpowers/sdd/2026-10-09-ag-payos-mua-goi/pay-method-${w}.png` (chụp trước khi đặt) và `payos-card-${w}.png` → test tự ký và `request.post("/api/payos/webhook", { data })` (dùng `signWebhookData` import từ `../../src/server/payos`, `paymentLinkId: pl-<id>`, `amount` = giá) → trong ≤ 10s thấy `plan_payos_activated` hoặc badge gói Pro → `scrollWidth ≤ width`.
  - Chọn VietQR (375px): thẻ có `plan_vietqr_report` + `contact-owner` 3 nút → **chụp** `vietqr-contact-375.png`.
  - Admin (`admin_test`, 375px): tạo đơn `expired` + `paidAmount` thẳng DB → `/admin/orders` thấy `attention-order` **đứng trước** mọi `pending-order-card`, đúng câu "nhưng đơn đã hết hạn" → Duyệt → xác nhận → đơn biến mất, user thành Pro → **chụp** `admin-attention-375.png` (trước khi duyệt).
  - `/guide` (chưa đăng nhập, 375px) có mục "Cần hỗ trợ?" với số `0979 479 550` → **chụp** `guide-contact-375.png`.
  - **Mở xem từng ảnh 375px**, ghi vào ledger 1 dòng/ảnh: thấy gì, có tràn/chữ bị bóp/nút < 44px không.

- [ ] **Step 3: Phát hành.** `package.json` → `0.16.0`. `RELEASES` mục đầu:

```ts
  {
    version: "0.16.0",
    date: "2026-10-09",
    title: "Mua gói kích hoạt ngay",
    summary: "Chọn thanh toán qua payOS để gói bật ngay khi tiền vào, và liên hệ chủ app ngay trong ứng dụng.",
    notify: true,
    items: [
      { kind: "new", title: "Kích hoạt ngay", body: "Khi mua gói, chọn Kích hoạt ngay sau khi chuyển khoản: quét QR payOS, gói bật trong vài giây, không phải chờ duyệt." },
      { kind: "new", title: "Liên hệ chủ app", body: "Gọi, nhắn Zalo hoặc Facebook cho chủ app ngay ở trang Gói, Quyền riêng tư và Hướng dẫn." },
    ],
  },
```

- [ ] **Step 4: Full test** (khoá test): `pnpm test` (toàn bộ) → ghi số pass; e2e 2 nửa như thường lệ (RAM ≥ 3000) gồm `ag-payos.spec.ts`, `plan.spec.ts`, `admin*.spec.ts`, `consent-privacy.spec.ts`, `w-huong-dan-co-gi-moi.spec.ts`. Mọi đỏ phải sửa hoặc STOP báo Claude, không nới test.
- [ ] **Step 5: Commit** `git commit -m "chore: phat hanh 0.16.0"` (e2e + config commit riêng trước: `git commit -m "test(ag): e2e payOS mua gói, đơn cần xử lý, liên hệ"`). Báo xong trên kênh `.superpowers/gehihi/kenh.md` dòng `CLAUDE-OTD → CLAUDE`, kèm danh sách ảnh 375px đã xem và các Ruling.
