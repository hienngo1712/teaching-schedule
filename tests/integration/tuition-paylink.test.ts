import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { addDays } from "@/lib/plans"
import { vnDateParts } from "@/lib/utils"
import { getTuitionNotice } from "@/server/services/tuition-notice.service"
import { anchorMonth } from "@/server/services/tuition-paylink.service"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

let caller: Caller
let userId = 0
let studentId = 0
let original: { plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null }
let nextHour = 7

async function cleanup() {
  await db.tuitionPayLink.deleteMany()
  await db.teacherPayos.deleteMany()
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } })
}

async function addSession(date: string, fee = 100000) {
  const [subject] = await caller.subject.list({})
  const h = String(nextHour++).padStart(2, "0")
  const s = await caller.session.create({ sessionDate: date, startTime: `${h}:00`, endTime: `${h}:45`, subjectId: subject.id })
  await caller.session.addStudents({ sessionId: s.id, studentIds: [studentId] })
  await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId, attendance: ATTENDANCE_STATUS.PRESENT, fee }] })
}

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

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  userId = u.id
  original = { plan: u.plan, planExpiresAt: u.planExpiresAt, trialEndsAt: u.trialEndsAt }
})
beforeEach(async () => {
  await cleanup()
  nextHour = 7
  created = 0
  await db.user.update({ where: { id: userId }, data: { plan: "pro", planExpiresAt: addDays(new Date(), 30) } })
  caller = await getAuthedCaller("teacher")
  studentId = (await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "Trần Thị Bé", grade: 5, tuitionFee: 100000 })).id
  await addSession("2026-08-10")
  await addSession("2026-08-17")
  await db.teacherPayos.create({ data: { userId, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: "H".repeat(43) } })
})
afterEach(() => {
  vi.restoreAllMocks()
})
afterAll(async () => {
  await cleanup()
  await db.user.update({ where: { id: userId }, data: original })
})

describe("QR payOS trên phiếu (spec AH §5)", () => {
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
  it("số nợ đổi: tạo link 150.000 nhưng KHÔNG huỷ link cũ (QR trên ảnh đã gửi vẫn trả được)", async () => {
    const f = mockPayos()
    await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
    await caller.payment.create({ studentId, year: 2026, month: 8, amount: 50000, paidAt: "2026-09-01", method: "cash" })
    const b = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
    expect(b.qr).toMatchObject({ provider: "payos", amount: 150000 })
    expect(f.mock.calls.some(([u]) => String(u).endsWith("/cancel"))).toBe(false)
    expect(await db.tuitionPayLink.count({ where: { studentId, status: "active" } })).toBe(2)
  })
  it("xem xen kẽ 2 số tiền (phiếu tháng 8 / tháng 9): mỗi số chỉ tạo 1 link, không tạo lại", async () => {
    mockPayos(); created = 0
    await addSession("2026-09-07")
    for (let i = 0; i < 2; i++) {
      await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
      await getTuitionNotice(db, userId, { studentId, year: 2026, month: 9 }, OPTS)
    }
    expect(created).toBe(2)
  })
  it("link cùng số tiền nhưng khác tháng neo → không dùng lại", async () => {
    mockPayos(); created = 0
    await db.tuitionPayLink.create({ data: { userId, studentId, year: 2026, month: 6, amount: 200000, payosLinkId: "pl-cu", qrCode: "q", checkoutUrl: "c" } })
    const n = await getTuitionNotice(db, userId, { studentId, year: 2026, month: 8 }, OPTS)
    expect(created).toBe(1)
    expect(n.qr!.payload).not.toBe("q")
  })
  it("phiếu mở từ phía giáo viên: PH trả xong về trang công khai /da-thanh-toan (không phải trang đăng nhập)", async () => {
    const f = mockPayos()
    await caller.tuition.getNotice({ studentId, year: 2026, month: 8 })
    const body = JSON.parse(String((f.mock.calls.find(([u]) => String(u).endsWith("/v2/payment-requests"))![1] as RequestInit).body))
    expect(body.returnUrl).toBe("http://localhost:3000/da-thanh-toan")
    expect(body.cancelUrl).toBe("http://localhost:3000/da-thanh-toan")
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
})
