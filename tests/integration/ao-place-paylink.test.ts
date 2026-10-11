// Spec AO §2–4: QR payOS cho phiếu nơi dạy (GV Pro đã nối payOS). Mock fetch như test AH, không gọi payOS thật.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { addDays } from "@/lib/plans"
import { getPlaceNotice } from "@/server/services/place-notice.service"
import { PLACE_ORDER_OFFSET } from "@/server/services/place-paylink.service"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const OPTS = { origin: "http://localhost:3000" }

let userId = 0
let placeId = 0
let original: { plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null }
let created = 0
let cancelled: string[] = []
let failCreate = false

function mockPayos() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.endsWith("/v2/payment-requests")) {
      if (failCreate) return new Response(JSON.stringify({ code: "20", desc: "lỗi" }))
      created++
      const b = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ code: "00", data: { paymentLinkId: `pl-${b.orderCode}`, qrCode: `QR${b.orderCode}`, checkoutUrl: `https://pay/${b.orderCode}`, bin: "970422", accountNumber: "0001", accountName: "GV A" } }))
    }
    if (url.endsWith("/cancel")) cancelled.push(decodeURIComponent(url.split("/").at(-2)!))
    return new Response(JSON.stringify({ code: "00", data: {} }))
  })
}

async function clean() {
  await db.placePayLink.deleteMany()
  await db.teacherPayos.deleteMany()
  await db.placeMonthNotice.deleteMany()
  await db.placePayment.deleteMany()
  await db.placeRateChange.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.teachingPlace.deleteMany()
}

async function addSession(date: string) {
  const subject = await db.subject.findFirstOrThrow({ where: { userId } })
  await db.teachingSession.create({
    data: { userId, placeId, subjectId: subject.id, sessionDate: day(date), startTime: time("08:00"), endTime: time("09:30") },
  })
}

const notice = () => getPlaceNotice(db, userId, placeId, 2026, 10, OPTS)
const links = () => db.placePayLink.findMany({ where: { placeId }, orderBy: { id: "asc" } })

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  userId = u.id
  original = { plan: u.plan, planExpiresAt: u.planExpiresAt, trialEndsAt: u.trialEndsAt }
})
beforeEach(async () => {
  await clean()
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5, 0, 0))) // 20/10/2026
  created = 0
  cancelled = []
  failCreate = false
  await db.user.update({
    where: { id: userId },
    data: { plan: "pro", planExpiresAt: addDays(new Date(), 30), trialEndsAt: null, bankBin: "970436", bankAccountNumber: "0123456789", bankAccountName: "NGUYEN THU HA" },
  })
  const caller = await getAuthedCaller()
  placeId = (await caller.place.create({ name: "TT Ánh Dương", kind: "center", color: "#0891B2", billing: "per_session" }))!.id
  await caller.placeRate.set({ placeId, unit: "hour", amount: 185000, fromYear: 2026, fromMonth: 10 })
  await addSession("2026-10-05")
  await addSession("2026-10-12")
  await caller.placePayment.create({ placeId, year: 2026, month: 10, amount: 100000, receivedAt: "2026-10-15" })
  await db.teacherPayos.create({ data: { userId, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: "H".repeat(43) } })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
afterAll(async () => {
  await clean()
  await db.user.update({ where: { id: userId }, data: { ...original, bankBin: null, bankAccountNumber: null, bankAccountName: null } })
})

describe("AO: QR payOS cho phiếu nơi dạy", () => {
  it("Pro + đã nối payOS: tạo link orderCode = PLACE_ORDER_OFFSET + id, phiếu có QR payOS + checkoutUrl", async () => {
    const f = mockPayos()
    const n = await notice()
    const [link] = await links()
    expect(link).toMatchObject({ userId, year: 2026, month: 10, amount: 455000, status: "active", payosLinkId: `pl-${PLACE_ORDER_OFFSET + link.id}` })
    const body = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))
    expect(body).toMatchObject({ orderCode: PLACE_ORDER_OFFSET + link.id, amount: 455000, returnUrl: expect.stringContaining("http://localhost:3000") })
    expect(n.qr).toMatchObject({ provider: "payos", payload: `QR${PLACE_ORDER_OFFSET + link.id}`, amount: 455000, checkoutUrl: `https://pay/${PLACE_ORDER_OFFSET + link.id}` })
    expect(n.bank).toMatchObject({ accountNumber: "0001", accountName: "GV A" })
    expect(n.payosFailed).toBe(false)
  })

  it("mở lại cùng số tiền: dùng lại link, không gọi payOS lần 2", async () => {
    mockPayos()
    await notice()
    await notice()
    expect(created).toBe(1)
    expect(await links()).toHaveLength(1)
  })

  it("đổi số tiền: link cũ cancelled (gọi payOS cancel), link mới tạo", async () => {
    mockPayos()
    await notice()
    const caller = await getAuthedCaller()
    await caller.placePayment.create({ placeId, year: 2026, month: 10, amount: 55000, receivedAt: "2026-10-16" })
    const n = await notice()
    const [old, cur] = await links()
    expect(old).toMatchObject({ status: "cancelled", amount: 455000 })
    expect(cur).toMatchObject({ status: "active", amount: 400000 })
    expect(cancelled).toEqual([old.payosLinkId])
    expect(n.qr).toMatchObject({ provider: "payos", amount: 400000 })
  })

  it("lỗi payOS khi tạo: phiếu rơi về VietQR, báo payosFailed, không để lại link nháp", async () => {
    mockPayos()
    failCreate = true
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const n = await notice()
    expect(n.qr).toMatchObject({ provider: "vietqr", amount: 455000 })
    expect(n.bank).toMatchObject({ accountNumber: "0123456789" })
    expect(n.payosFailed).toBe(true)
    expect(await links()).toHaveLength(0)
  })

  it("không Pro (Plus): không gọi payOS, không tạo link, phiếu VietQR", async () => {
    const f = mockPayos()
    await db.user.update({ where: { id: userId }, data: { plan: "plus" } })
    const n = await notice()
    expect(f).not.toHaveBeenCalled()
    expect(await links()).toHaveLength(0)
    expect(n.qr).toMatchObject({ provider: "vietqr" })
    expect(n.payosFailed).toBe(false)
  })

  it("[RF 5] còn phải trả về 0 (nhận đủ bằng tay): huỷ link active, không tạo link, không QR", async () => {
    mockPayos()
    await notice()
    const caller = await getAuthedCaller()
    await caller.placePayment.create({ placeId, year: 2026, month: 10, amount: 455000, receivedAt: "2026-10-16" })
    const n = await notice()
    const all = await links()
    expect(all).toHaveLength(1)
    expect(all[0].status).toBe("cancelled")
    expect(cancelled).toEqual([all[0].payosLinkId])
    expect(created).toBe(1)
    expect(n.remaining).toBe(0)
    expect(n.qr).toBeNull()
  })

  it("không có origin (đánh dấu đã gửi): không gọi payOS", async () => {
    const f = mockPayos()
    await getPlaceNotice(db, userId, placeId, 2026, 10)
    expect(f).not.toHaveBeenCalled()
  })
})
