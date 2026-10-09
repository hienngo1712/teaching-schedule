import { expect } from "@playwright/test"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { RELEASES } from "@/lib/releases"
import { CONSENT_ACCEPTED } from "@/lib/consent"
import { seedSubjectsForUser } from "@/server/services/subject-defaults"
import { signWebhookData } from "@/server/payos"
import { handleTuitionWebhook } from "@/server/services/tuition-payos-webhook.service"
import { getAuthedCaller } from "../helpers/trpc"
import { EXPECTED_TEST_ENDPOINT } from "../env-setup"

export function getDemoMonths() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "numeric", day: "numeric" })
  const parts = formatter.formatToParts(now)
  const currentYear = Number(parts.find((p) => p.type === "year")!.value)
  const currentMonth = Number(parts.find((p) => p.type === "month")!.value)
  const currentDay = Number(parts.find((p) => p.type === "day")!.value)

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

  const prev2Month = prevMonth === 1 ? 12 : prevMonth - 1
  const prev2Year = prevMonth === 1 ? prevYear - 1 : prevYear

  const pad = (n: number) => String(n).padStart(2, "0")

  return {
    today: `${currentYear}-${pad(currentMonth)}-${pad(currentDay)}`,
    current: { year: currentYear, month: currentMonth, start: `${currentYear}-${pad(currentMonth)}-01`, end: `${currentYear}-${pad(currentMonth)}-28` },
    prev: { year: prevYear, month: prevMonth, start: `${prevYear}-${pad(prevMonth)}-01`, end: `${prevYear}-${pad(prevMonth)}-28` },
    prev2: { year: prev2Year, month: prev2Month, start: `${prev2Year}-${pad(prev2Month)}-01`, end: `${prev2Year}-${pad(prev2Month)}-28` },
  }
}

export async function cleanupDemo() {
  expect(process.env.DATABASE_URL ?? "").toContain(`@${EXPECTED_TEST_ENDPOINT}/`)

  // Rate limit chỉ đếm lần đăng nhập sai; chỉ dọn log của guide_demo, không đụng tài khoản khác.
  await db.loginAttempt.deleteMany({ where: { username: "guide_demo" } })

  const user = await db.user.findUnique({ where: { username: "guide_demo" } })
  if (!user) return

  await db.tuitionPayLink.deleteMany({ where: { userId: user.id } })
  await db.teacherPayos.deleteMany({ where: { userId: user.id } })

  const students = await db.student.findMany({ where: { userId: user.id }, select: { id: true } })
  const studentIds = students.map((s) => s.id)
  if (studentIds.length > 0) {
    const mts = await db.monthlyTuition.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } })
    const mtIds = mts.map((m) => m.id)
    if (mtIds.length > 0) {
      await db.payment.deleteMany({ where: { monthlyTuitionId: { in: mtIds } } })
    }
    await db.monthlyTuition.deleteMany({ where: { studentId: { in: studentIds } } })
    await db.sessionStudent.deleteMany({ where: { studentId: { in: studentIds } } })
    await db.studentBillingChange.deleteMany({ where: { studentId: { in: studentIds } } })
  }

  const sessions = await db.teachingSession.findMany({ where: { userId: user.id }, select: { id: true } })
  const sessionIds = sessions.map((s) => s.id)
  if (sessionIds.length > 0) {
    await db.sessionStudent.deleteMany({ where: { sessionId: { in: sessionIds } } })
  }

  await db.teachingSession.deleteMany({ where: { userId: user.id } })
  await db.student.deleteMany({ where: { userId: user.id } })
  await db.subject.deleteMany({ where: { userId: user.id } })
  await db.consentRecord.deleteMany({ where: { userId: user.id } })
  await db.planOrder.deleteMany({ where: { userId: user.id } })
  await db.userActivityDay.deleteMany({ where: { userId: user.id } })
  await db.classUpgradeLog.deleteMany({ where: { userId: user.id } })
  await db.user.delete({ where: { id: user.id } })
}

export async function setDemoBank() {
  expect(process.env.DATABASE_URL ?? "").toContain(`@${EXPECTED_TEST_ENDPOINT}/`)

  const user = await db.user.findUnique({ where: { username: "guide_demo" } })
  if (!user) return

  await db.user.update({
    where: { id: user.id },
    data: {
      bankBin: "970436",
      bankAccountNumber: "0123456789",
      bankAccountName: "NGUYEN THI LAN",
    },
  })
}

// Khoá payOS giả của giáo viên demo (spec AH): phiếu gọi mock 4010, webhook ký bằng DEMO_CHECKSUM.
const DEMO_HOOK = "g".repeat(43)
const DEMO_CHECKSUM = "t-checksum"

export async function clearDemoPayos() {
  expect(process.env.DATABASE_URL ?? "").toContain(`@${EXPECTED_TEST_ENDPOINT}/`)
  const user = await db.user.findUnique({ where: { username: "guide_demo" } })
  if (!user) return
  await db.teacherPayos.deleteMany({ where: { userId: user.id } })
}

export async function setDemoPayos() {
  expect(process.env.DATABASE_URL ?? "").toContain(`@${EXPECTED_TEST_ENDPOINT}/`)
  const user = await db.user.findUniqueOrThrow({ where: { username: "guide_demo" } })
  const keys = { clientId: "t-client", apiKey: "t-api", checksumKey: DEMO_CHECKSUM }
  await db.teacherPayos.upsert({ where: { userId: user.id }, update: keys, create: { userId: user.id, ...keys, hookId: DEMO_HOOK } })
}

// Giả phụ huynh trả đủ link payOS đang mở của HS (gọi thẳng service webhook như payOS gửi).
export async function payDemoPayos(studentName: string) {
  expect(process.env.DATABASE_URL ?? "").toContain(`@${EXPECTED_TEST_ENDPOINT}/`)
  const user = await db.user.findUniqueOrThrow({ where: { username: "guide_demo" } })
  const links = await db.tuitionPayLink.findMany({ where: { userId: user.id, status: "active" }, include: { student: { select: { fullName: true } } } })
  const link = links.find((l) => l.student.fullName === studentName)
  if (!link) throw new Error(`Không có link payOS đang mở cho ${studentName}`)
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "medium" }).format(new Date())
  const data = {
    orderCode: link.id, amount: link.amount, description: `HP ${link.id}`, accountNumber: "0001234567", reference: `DEMO${link.id}`,
    transactionDateTime: p, currency: "VND", paymentLinkId: link.payosLinkId, code: "00", desc: "success",
    counterAccountBankId: "", counterAccountBankName: "", counterAccountName: null, counterAccountNumber: null, virtualAccountName: null, virtualAccountNumber: "",
  }
  const r = await handleTuitionWebhook(db, DEMO_HOOK, { code: "00", desc: "success", success: true, data, signature: signWebhookData(DEMO_CHECKSUM, data) })
  expect(r.status).toBe(200)
}

export async function seedDemo(): Promise<string> {
  expect(process.env.DATABASE_URL ?? "").toContain(`@${EXPECTED_TEST_ENDPOINT}/`)

  await cleanupDemo()

  const passwordHash = await bcrypt.hash("teacher123", 4)
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const user = await db.user.create({
    data: {
      username: "guide_demo",
      passwordHash,
      fullName: "Cô Lan",
      plan: "pro",
      planExpiresAt: expiresAt,
      lastSeenRelease: RELEASES[0].version,
      onboardingDismissedAt: null,
      mustChangePassword: false,
    },
  })

  await seedSubjectsForUser(db, user.id)

  const mathSubject = await db.subject.findFirstOrThrow({ where: { userId: user.id, name: "Toán" } })
  const engSubject = await db.subject.findFirstOrThrow({ where: { userId: user.id, name: "Tiếng Anh" } })

  const caller = await getAuthedCaller("guide_demo")

  // 6 học sinh
  const s1 = await caller.student.create({
    fullName: "Nguyễn Minh Anh",
    grade: 6,
    billingMode: "per_session",
    tuitionFee: 150000,
    parentName: "Chị Mai",
    parentPhone: "0900000001",
    consent: CONSENT_ACCEPTED,
  })

  const s2 = await caller.student.create({
    fullName: "Trần Gia Bảo",
    grade: 6,
    billingMode: "per_session",
    tuitionFee: 150000,
    parentName: "Anh Nam",
    parentPhone: "0900000002",
    consent: CONSENT_ACCEPTED,
  })

  const s3 = await caller.student.create({
    fullName: "Lê Khánh Chi",
    grade: 7,
    billingMode: "per_session",
    tuitionFee: 150000,
    parentName: "Chị Hạnh",
    parentPhone: "0900000003",
    consent: CONSENT_ACCEPTED,
  })

  const s4 = await caller.student.create({
    fullName: "Phạm Đức Duy",
    grade: 8,
    billingMode: "per_session",
    tuitionFee: 150000,
    parentName: "Anh Dũng",
    parentPhone: "0900000004",
    consent: CONSENT_ACCEPTED,
  })

  const s5 = await caller.student.create({
    fullName: "Hoàng Thu Hà",
    grade: 9,
    billingMode: "monthly",
    monthlyFee: 800000,
    tuitionFee: 0,
    parentName: "Chị Lan",
    parentPhone: "0900000005",
    consent: CONSENT_ACCEPTED,
  })

  const s6 = await caller.student.create({
    fullName: "Vũ Quốc Khánh",
    grade: 5,
    billingMode: "monthly",
    monthlyFee: 800000,
    tuitionFee: 0,
    parentName: "Anh Hùng",
    parentPhone: "0900000006",
    consent: CONSENT_ACCEPTED,
  })

  // Học sinh đã xoá mềm
  const sDel = await caller.student.create({
    fullName: "Đỗ Thảo Vy",
    grade: 6,
    billingMode: "per_session",
    tuitionFee: 150000,
    parentName: "Chị Oanh",
    parentPhone: "0900000007",
    consent: CONSENT_ACCEPTED,
  })
  await caller.student.delete({ id: sDel.id })

  // Tạo token link phụ huynh cho s1
  const parentLinkRes = await caller.student.generateParentLink({ id: s1.id })

  const months = getDemoMonths()

  // 1. Ca của 2 tháng trước cho s4 (tạo nợ cũ)
  const prev2_1 = await caller.session.create({
    sessionDate: `${months.prev2.year}-${String(months.prev2.month).padStart(2, "0")}-10`,
    startTime: "17:30",
    endTime: "19:00",
    subjectId: mathSubject.id,
    studentIds: [s4.id],
  })
  const prev2_2 = await caller.session.create({
    sessionDate: `${months.prev2.year}-${String(months.prev2.month).padStart(2, "0")}-15`,
    startTime: "17:30",
    endTime: "19:00",
    subjectId: mathSubject.id,
    studentIds: [s4.id],
  })
  await caller.attendance.update({
    sessionId: prev2_1.id,
    attendances: [{ studentId: s4.id, attendance: "present" }],
  })
  await caller.attendance.update({
    sessionId: prev2_2.id,
    attendances: [{ studentId: s4.id, attendance: "present" }],
  })

  // 2. Ca tháng trước:
  // Lớp Toán (T2, T4, T6)
  await caller.session.bulkCreate({
    startDate: months.prev.start,
    endDate: months.prev.end,
    weekdays: [1, 3, 5],
    startTime: "17:30",
    endTime: "19:00",
    subjectId: mathSubject.id,
    studentIds: [s1.id, s2.id, s3.id, s4.id],
  })

  // Lớp Tiếng Anh (T3, T5)
  await caller.session.bulkCreate({
    startDate: months.prev.start,
    endDate: months.prev.end,
    weekdays: [2, 4],
    startTime: "18:00",
    endTime: "19:30",
    subjectId: engSubject.id,
    studentIds: [s5.id, s6.id],
  })

  // 3. Ca tháng này:
  await caller.session.bulkCreate({
    startDate: months.current.start,
    endDate: months.current.end,
    weekdays: [1, 3, 5],
    startTime: "17:30",
    endTime: "19:00",
    subjectId: mathSubject.id,
    studentIds: [s1.id, s2.id, s3.id, s4.id],
  })

  await caller.session.bulkCreate({
    startDate: months.current.start,
    endDate: months.current.end,
    weekdays: [2, 4],
    startTime: "18:00",
    endTime: "19:30",
    subjectId: engSubject.id,
    studentIds: [s5.id, s6.id],
  })

  // Điểm danh các ca trong quá khứ (đến hôm nay)
  const pastSessions = await db.teachingSession.findMany({
    where: {
      userId: user.id,
      sessionDate: { lte: new Date(`${months.today}T23:59:59.999Z`) },
      isDeleted: false,
    },
    include: { sessionStudents: true },
    orderBy: { sessionDate: "asc" },
  })

  for (let i = 0; i < pastSessions.length; i++) {
    const s = pastSessions[i]
    if (s.id === prev2_1.id || s.id === prev2_2.id) continue
    const attendances = s.sessionStudents.map((ss, idx) => {
      let attendance: "present" | "absent" | "late" = "present"
      if (idx === 0 && i % 4 === 1) attendance = "absent"
      else if (idx === 1 && i % 5 === 2) attendance = "late"
      return { studentId: ss.studentId, attendance }
    })
    await caller.attendance.update({ sessionId: s.id, attendances })
  }

  return parentLinkRes.token
}

export async function setDemoPayments() {
  expect(process.env.DATABASE_URL ?? "").toContain(`@${EXPECTED_TEST_ENDPOINT}/`)

  const user = await db.user.findUnique({ where: { username: "guide_demo" } })
  if (!user) return

  const students = await db.student.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  })
  if (students.length < 3) return

  const caller = await getAuthedCaller("guide_demo")
  const months = getDemoMonths()
  const prevPaidAt = `${months.prev.year}-${String(months.prev.month).padStart(2, "0")}-25`

  await caller.payment.record({
    studentId: students[0].id,
    year: months.prev.year,
    month: months.prev.month,
    amount: 1500000,
    paidAt: prevPaidAt,
  })
  await caller.payment.record({
    studentId: students[1].id,
    year: months.prev.year,
    month: months.prev.month,
    amount: 1500000,
    paidAt: prevPaidAt,
  })
  await caller.payment.record({
    studentId: students[2].id,
    year: months.prev.year,
    month: months.prev.month,
    amount: 300000,
    paidAt: prevPaidAt,
  })
}
