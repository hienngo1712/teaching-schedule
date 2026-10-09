import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { addDays } from "@/lib/plans"

const KEYS = { clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum" }
// Mỗi lần gọi 1 Response mới: body của Response chỉ đọc được 1 lần.
const ok = () => vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ code: "00", data: {} })))
let userId = 0
let original: { plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null }

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  userId = u.id
  original = { plan: u.plan, planExpiresAt: u.planExpiresAt, trialEndsAt: u.trialEndsAt }
})
beforeEach(async () => {
  process.env.PAYOS_CLIENT_ID = "test-client"
  await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 30) } })
  await db.tuitionPayLink.deleteMany({ where: { userId } })
  await db.teacherPayos.deleteMany({ where: { userId } })
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.user.update({ where: { id: userId }, data: original })
})
afterAll(async () => {
  delete process.env.PAYOS_CLIENT_ID
  await db.tuitionPayLink.deleteMany({ where: { userId } })
  await db.teacherPayos.deleteMany({ where: { userId } })
})

describe("payos router (spec AH §4.1)", () => {
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
    const st = await db.student.create({ data: { userId, fullName: "HS", grade: 5 } })
    const link = await db.tuitionPayLink.create({ data: { userId, studentId: st.id, year: 2026, month: 9, amount: 100000, payosLinkId: "pl-1", qrCode: "q", checkoutUrl: "c" } })
    await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null, trialEndsAt: null } })
    await caller.payos.disconnect()
    expect(f.mock.calls.some(([u]) => String(u).endsWith("/v2/payment-requests/pl-1/cancel"))).toBe(true)
    expect((await db.tuitionPayLink.findUniqueOrThrow({ where: { id: link.id } })).status).toBe("cancelled")
    expect(await db.teacherPayos.findUnique({ where: { userId } })).toBeNull()
    await db.student.delete({ where: { id: st.id } })
  })
  it("status không bao giờ chứa khoá", async () => {
    ok()
    const caller = await getAuthedCaller("teacher")
    await caller.payos.connect(KEYS)
    expect(JSON.stringify(await caller.payos.status())).not.toMatch(/t-api|t-checksum|t-client/)
  })
})
