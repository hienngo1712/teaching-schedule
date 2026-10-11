// Spec AQ: admin xoá vĩnh viễn TK đã xoá mềm ≥ 30 ngày. Xoá dữ liệu dạy học + cá nhân, giữ đơn mua gói gắn "bia mộ" ẩn danh.
// Mock fetch như test AH/AO: không gọi payOS thật.
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { registerUser } from "@/server/services/user.service"
import { getRevenue } from "@/server/services/revenue.service"
import { getAdminStats } from "@/server/services/admin-stats.service"
import { handleTuitionWebhook } from "@/server/services/tuition-payos-webhook.service"
import { signWebhookData } from "@/server/payos"
import { getAuthedCaller } from "../helpers/trpc"

const NAME = "aq_purge"
const HOOK = "q".repeat(43)
const KEY = "aq-checksum"
const DAY = 86_400_000

async function removeAll() {
  const users = await db.user.findMany({ where: { OR: [{ username: NAME }, { username: { startsWith: "deleted_" } }] }, select: { id: true } })
  for (const { id } of users) {
    await db.loginAttempt.deleteMany({ where: { userId: id } })
    await db.securityEvent.deleteMany({ where: { userId: id } })
    await db.consentRecord.deleteMany({ where: { userId: id } })
    await db.planOrder.deleteMany({ where: { userId: id } })
    await db.tuitionPayLink.deleteMany({ where: { userId: id } })
    await db.teachingSession.deleteMany({ where: { userId: id } })
    await db.student.deleteMany({ where: { userId: id } })
    await db.subject.deleteMany({ where: { userId: id } })
    await db.classUpgradeLog.deleteMany({ where: { userId: id } })
    await db.user.delete({ where: { id } })
  }
  await db.loginAttempt.deleteMany({ where: { username: NAME } })
  await db.securityEvent.deleteMany({ where: { event: "admin_purge_user" } })
}

// TK có đủ loại dữ liệu spec §8; deleted_at lùi `daysAgo` ngày.
async function seedUser(daysAgo = 31) {
  const u = await db.user.create({
    data: {
      username: NAME,
      passwordHash: await bcrypt.hash("matkhau-aq-123", 4),
      fullName: "Cô Xoá Hẳn",
      bankBin: "970436",
      bankAccountNumber: "0123456789",
      bankAccountName: "CO XOA HAN",
      plan: "pro",
      planExpiresAt: new Date("2099-12-31T17:00:00.000Z"),
      isDeleted: true,
      deletedAt: new Date(Date.now() - daysAgo * DAY),
      deletedBy: "admin_test",
    },
  })
  const subject = await db.subject.create({ data: { userId: u.id, name: "Toán" } })
  const place = await db.teachingPlace.create({
    data: {
      userId: u.id, name: "TT AQ", kind: "center", color: "#0891B2",
      billingChanges: { create: { fromKey: 0, billing: "per_session" } },
      rateChanges: { create: { fromKey: 0, unit: "session", amount: 150000 } },
      shareLink: { create: { token: "t", tokenHash: "aq".padEnd(64, "0") } },
      monthNotices: { create: { year: 2026, month: 9, sentAt: new Date(), sentAmount: 300000 } },
    },
  })
  const placePayment = await db.placePayment.create({ data: { placeId: place.id, year: 2026, month: 9, amount: 300000, receivedAt: new Date("2026-09-30") } })
  const placeLink = await db.placePayLink.create({
    data: { userId: u.id, placeId: place.id, year: 2026, month: 9, amount: 300000, payosLinkId: "pl-aq", qrCode: "q", checkoutUrl: "https://pay/pl" },
  })
  await db.placePayLinkPayment.create({ data: { linkId: placeLink.id, reference: "AQP1", amount: 100000, paidAt: new Date(), placePaymentId: placePayment.id } })
  const student = await db.student.create({
    data: { userId: u.id, fullName: "HS AQ", grade: 6, placeId: place.id, billingChanges: { create: { fromKey: 0, mode: "per_session" } } },
  })
  await db.studentPlaceChange.create({ data: { studentId: student.id, placeId: place.id, fromKey: 0 } })
  const session = await db.teachingSession.create({
    data: {
      userId: u.id, subjectId: subject.id, placeId: place.id, sessionDate: new Date("2026-09-10"),
      startTime: new Date("1970-01-01T08:00:00.000Z"), endTime: new Date("1970-01-01T09:30:00.000Z"),
      sessionStudents: { create: { studentId: student.id, grade: 6, attendance: "present" } },
    },
  })
  const mt = await db.monthlyTuition.create({ data: { studentId: student.id, year: 2026, month: 9 } })
  await db.payment.create({ data: { monthlyTuitionId: mt.id, amount: 150000, paidAt: new Date("2026-09-30") } })
  const tLink = await db.tuitionPayLink.create({
    data: { userId: u.id, studentId: student.id, year: 2026, month: 10, amount: 150000, payosLinkId: "hp-aq", qrCode: "q", checkoutUrl: "https://pay/hp" },
  })
  await db.tuitionPayLinkPayment.create({ data: { linkId: tLink.id, reference: "AQT1", amount: 1000, paidAt: new Date(), batchId: "aq-batch" } })
  await db.teacherPayos.create({ data: { userId: u.id, clientId: "c", apiKey: "a", checksumKey: KEY, hookId: HOOK } })
  await db.classUpgradeLog.create({ data: { userId: u.id, year: 2026, trigger: "manual" } })
  await db.userActivityDay.create({ data: { userId: u.id, day: new Date("2026-09-01"), firstSeenAt: new Date() } })
  await db.consentRecord.create({ data: { userId: u.id, scope: "student", textVersion: "1", studentId: student.id } })
  await db.loginAttempt.create({ data: { username: NAME, success: true, userId: u.id } })
  // Đăng nhập thử sau khi bị xoá mềm: chỉ có username, không có userId.
  await db.loginAttempt.create({ data: { username: NAME, success: false, userId: null } })
  await db.securityEvent.create({ data: { userId: u.id, event: "backup_download" } })
  await db.feedback.create({ data: { userId: u.id, rating: 5, message: "tốt", page: "/dashboard", appVersion: "0.24.0" } })
  await db.chatConversation.create({ data: { userId: u.id, messages: { create: { fromAdmin: false, senderName: "Cô Xoá Hẳn", body: "xin chào" } } } })
  const order = await db.planOrder.create({
    data: { userId: u.id, plan: "pro", period: "1m", amount: 99000, status: "approved", decidedAt: new Date("2026-09-15T03:00:00.000Z"), paidAmount: 99000, paidAt: new Date("2026-09-15T03:00:00.000Z") },
  })
  await db.planOrderPayment.create({ data: { orderId: order.id, reference: "AQORD1", amount: 99000, paidAt: new Date("2026-09-15T03:00:00.000Z") } })
  return { user: u, studentId: student.id, placeId: place.id, sessionId: session.id, orderId: order.id }
}

// [RF 1] Quét mọi model có userId / studentId / placeId của user (trừ đơn mua gói + log admin).
async function remaining(userId: number, studentId: number, placeId: number, username: string) {
  const byUser = { where: { userId } }
  return {
    subject: await db.subject.count(byUser),
    student: await db.student.count(byUser),
    teachingSession: await db.teachingSession.count(byUser),
    sessionStudent: await db.sessionStudent.count({ where: { studentId } }),
    studentBillingChange: await db.studentBillingChange.count({ where: { studentId } }),
    studentPlaceChange: await db.studentPlaceChange.count({ where: { OR: [{ studentId }, { placeId }] } }),
    monthlyTuition: await db.monthlyTuition.count({ where: { studentId } }),
    payment: await db.payment.count({ where: { monthlyTuition: { studentId } } }),
    classUpgradeLog: await db.classUpgradeLog.count(byUser),
    tuitionPayLink: await db.tuitionPayLink.count(byUser),
    tuitionPayLinkPayment: await db.tuitionPayLinkPayment.count({ where: { link: { userId } } }),
    teachingPlace: await db.teachingPlace.count(byUser),
    placeBillingChange: await db.placeBillingChange.count({ where: { placeId } }),
    placeRateChange: await db.placeRateChange.count({ where: { placeId } }),
    placePayment: await db.placePayment.count({ where: { placeId } }),
    placeShareLink: await db.placeShareLink.count({ where: { placeId } }),
    placeMonthNotice: await db.placeMonthNotice.count({ where: { placeId } }),
    placePayLink: await db.placePayLink.count({ where: { OR: [{ userId }, { placeId }] } }),
    placePayLinkPayment: await db.placePayLinkPayment.count({ where: { link: { placeId } } }),
    teacherPayos: await db.teacherPayos.count(byUser),
    userActivityDay: await db.userActivityDay.count(byUser),
    consentRecord: await db.consentRecord.count({ where: { OR: [{ userId }, { studentId }] } }),
    loginAttempt: await db.loginAttempt.count({ where: { OR: [{ userId }, { username }] } }),
    securityEvent: await db.securityEvent.count(byUser),
    feedback: await db.feedback.count(byUser),
    chatConversation: await db.chatConversation.count(byUser),
    chatMessage: await db.chatMessage.count({ where: { conversation: { userId } } }),
  }
}

let fetchSpy: { mock: { calls: unknown[][] } }
beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ code: "00", desc: "success", data: {} }), { status: 200 }))
  await removeAll()
})
afterAll(async () => {
  await removeAll()
  vi.restoreAllMocks()
  delete process.env.ADMIN_USERNAMES
})

describe("admin.purgeUser (spec AQ)", () => {
  it("[RF 1][RF 2] xoá sạch dữ liệu, giữ đơn mua gói, user thành bia mộ, doanh thu không đổi", async () => {
    const s = await seedUser()
    const range = { from: { year: 2026, month: 9 }, to: { year: 2026, month: 9 } }
    const before = await getRevenue(db, range)
    const statsBefore = await getAdminStats(db)
    const admin = await getAuthedCaller("admin_test")
    const r = await admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })
    expect(r.deleted.students).toBe(1)

    const left = await remaining(s.user.id, s.studentId, s.placeId, NAME)
    expect(Object.entries(left).filter(([, n]) => n > 0)).toEqual([])

    const order = await db.planOrder.findUniqueOrThrow({ where: { id: s.orderId }, include: { payments: true } })
    expect(order.amount).toBe(99000)
    expect(order.payments).toHaveLength(1)
    expect(await getRevenue(db, range)).toEqual(before)
    expect({ ...(await getAdminStats(db)), updatedAt: null }).toEqual({ ...statsBefore, updatedAt: null })

    const tomb = await db.user.findUniqueOrThrow({ where: { id: s.user.id } })
    expect(tomb.username).toBe(`deleted_${s.user.id}`)
    expect(tomb.fullName).toBe(`TK đã xoá #${s.user.id}`)
    expect(tomb.purgedAt).not.toBeNull()
    expect(tomb.isDeleted).toBe(true)
    expect(tomb.bankAccountNumber).toBeNull()
    expect(tomb.bankAccountName).toBeNull()
    expect(tomb.bankBin).toBeNull()
    expect(tomb.sessionVersion).toBe(s.user.sessionVersion + 1)
    expect(await bcrypt.compare("matkhau-aq-123", tomb.passwordHash)).toBe(false)

    // Lịch sử đơn hiện tên bia mộ.
    const history = await admin.admin.orderHistory()
    expect(history.find((o) => o.id === s.orderId)).toMatchObject({ fullName: `TK đã xoá #${s.user.id}` })

    // Huỷ link payOS đang active trước khi xoá (HS + nơi dạy).
    const cancelled = fetchSpy.mock.calls.map(([u]) => String(u)).filter((u: string) => u.includes("/cancel"))
    expect(cancelled.some((u: string) => u.includes("hp-aq"))).toBe(true)
    expect(cancelled.some((u: string) => u.includes("pl-aq"))).toBe(true)
  })

  it("bia mộ: không còn trong Đã xoá, không khôi phục được; đăng ký lại bằng username cũ được", async () => {
    const s = await seedUser()
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })
    expect((await admin.admin.deletedUsers()).some((u) => u.id === s.user.id)).toBe(false)
    await expect(admin.admin.restoreUser({ userId: s.user.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    const fresh = await registerUser(db, { username: NAME, password: "matkhau-moi-123", fullName: "" })
    expect(fresh.username).toBe(NAME)
    expect(fresh.id).not.toBe(s.user.id)
  })

  it("purge 2 lần: lần 2 NOT_FOUND", async () => {
    const s = await seedUser()
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })
    await expect(admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(admin.admin.purgeUser({ userId: s.user.id, confirmUsername: `deleted_${s.user.id}` })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("lỗi: chưa đủ 30 ngày, TK chưa xoá mềm, id lạ, TK admin, giáo viên gọi", async () => {
    const s = await seedUser(29)
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "purge_too_early" })
    await db.user.update({ where: { id: s.user.id }, data: { isDeleted: false, deletedAt: null } })
    await expect(admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(admin.admin.purgeUser({ userId: 99_999_999, confirmUsername: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    const adminUser = await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })
    await expect(admin.admin.purgeUser({ userId: adminUser.id, confirmUsername: "admin_test" })).rejects.toMatchObject({ code: "FORBIDDEN" })
    const teacher = await getAuthedCaller("teacher")
    await expect(teacher.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })).rejects.toMatchObject({ code: "FORBIDDEN" })
    // Không đổi gì.
    expect(await db.student.count({ where: { userId: s.user.id } })).toBe(1)
  })

  it("[RF 5] gõ tên so khớp chính xác: khoảng trắng thừa / khác hoa thường → purge_confirm_mismatch", async () => {
    const s = await seedUser()
    const admin = await getAuthedCaller("admin_test")
    for (const typed of [` ${NAME}`, `${NAME} `, NAME.toUpperCase(), "aq_purg"]) {
      await expect(admin.admin.purgeUser({ userId: s.user.id, confirmUsername: typed })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "purge_confirm_mismatch" })
    }
    expect(await db.student.count({ where: { userId: s.user.id } })).toBe(1)
  })

  it("[RF 3] webhook payOS đến sau purge: không lỗi 500, không ghi gì", async () => {
    const s = await seedUser()
    const admin = await getAuthedCaller("admin_test")
    await admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })
    const logs = [vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "info")]
    const before = [await db.payment.count(), await db.placePayment.count(), await db.tuitionPayLinkPayment.count(), await db.placePayLinkPayment.count()]
    const data = {
      orderCode: 1, amount: 150000, description: "HP 1", accountNumber: "0", reference: "AQAFTER", transactionDateTime: "2026-10-11 10:00:00",
      currency: "VND", paymentLinkId: "hp-aq", code: "00", desc: "success",
    }
    const r = await handleTuitionWebhook(db, HOOK, { code: "00", desc: "success", success: true, data, signature: signWebhookData(KEY, data) })
    // Kênh payOS đã xoá cùng TK: như GV đã ngắt payOS → 404.
    expect(r.status).toBe(404)
    // Cả orderCode của link nơi dạy (≥ 1e9) cũng không ghi gì.
    const placeData = { ...data, orderCode: 1_000_000_001, reference: "AQAFTER2", paymentLinkId: "pl-aq" }
    expect((await handleTuitionWebhook(db, HOOK, { code: "00", desc: "success", success: true, data: placeData, signature: signWebhookData(KEY, placeData) })).status).toBe(404)
    expect([await db.payment.count(), await db.placePayment.count(), await db.tuitionPayLinkPayment.count(), await db.placePayLinkPayment.count()]).toEqual(before)
    for (const spy of logs) expect(spy.mock.calls.flat().join(" ")).not.toContain(KEY)
  })

  it("log admin: security_events của admin 'admin_purge_user', console.info không có tên", async () => {
    const s = await seedUser()
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const admin = await getAuthedCaller("admin_test")
    const adminUser = await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })
    await admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })
    expect(await db.securityEvent.count({ where: { userId: adminUser.id, event: "admin_purge_user" } })).toBe(1)
    const logged = info.mock.calls.flat().join(" ")
    expect(logged).toContain(String(s.user.id))
    expect(logged).not.toContain(NAME)
    expect(logged).not.toContain("Cô Xoá Hẳn")
  })

  it("deletedUsers trả purgeAvailableAt = deletedAt + 30 ngày", async () => {
    const s = await seedUser(10)
    const admin = await getAuthedCaller("admin_test")
    const row = (await admin.admin.deletedUsers()).find((u) => u.id === s.user.id)!
    expect(row.purgeAvailableAt.getTime()).toBe(s.user.deletedAt!.getTime() + 30 * DAY)
  })

  it("[RF 4] Tổng quan admin, TK mới, thống kê không tính bia mộ", async () => {
    const s = await seedUser()
    const admin = await getAuthedCaller("admin_test")
    await db.user.update({ where: { id: s.user.id }, data: { adminSeenAt: null } })
    const statsBefore = await getAdminStats(db)
    await admin.admin.purgeUser({ userId: s.user.id, confirmUsername: NAME })
    const overview = await admin.admin.overview()
    expect(overview.users.some((u) => u.id === s.user.id)).toBe(false)
    const fresh = await admin.admin.newAccounts()
    expect(fresh.items.some((u) => u.id === s.user.id)).toBe(false)
    expect({ ...(await getAdminStats(db)), updatedAt: null }).toEqual({ ...statsBefore, updatedAt: null })
  })
})
