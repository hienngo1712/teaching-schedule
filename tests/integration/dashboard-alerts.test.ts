import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { recordPayment } from "../helpers/payment"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { getCancelledWithoutMakeup } from "@/server/services/session.service"
import { getDashboardAlerts } from "@/server/services/report.service"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function userIdOf(username: string) {
  return (await db.user.findUniqueOrThrow({ where: { username } })).id
}

// Tạo ca; nếu có presentFee thì điểm danh "có mặt" cho mọi HS với học phí đó.
async function addSession(
  caller: Caller,
  opts: { date: string; start?: string; end?: string; studentIds?: number[]; presentFee?: number }
) {
  const subjectId = (await caller.subject.list({}))[0].id
  const s = await caller.session.create({
    sessionDate: opts.date,
    startTime: opts.start ?? "08:00",
    endTime: opts.end ?? "09:00",
    subjectId,
  })
  if (opts.studentIds?.length) {
    await caller.session.addStudents({ sessionId: s.id, studentIds: opts.studentIds })
    if (opts.presentFee !== undefined) {
      const fee = opts.presentFee
      await caller.attendance.update({
        sessionId: s.id,
        attendances: opts.studentIds.map((studentId) => ({
          studentId,
          attendance: ATTENDANCE_STATUS.PRESENT,
          fee,
        })),
      })
    }
  }
  return s
}

// Huỷ trực tiếp (không tạo ca bù) — mô phỏng dữ liệu cũ.
async function cancelDirect(id: number) {
  await db.teachingSession.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date() },
  })
}

describe("getCancelledWithoutMakeup", () => {
  const from = new Date(Date.UTC(2026, 6, 27)) // 27/07/2026

  beforeEach(async () => {
    await cleanup()
  })

  it("ca bù bị xoá → ca gốc hiện; còn ca bù → không; khôi phục → biến mất", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Ca Nghỉ", grade: 4 })
    const orig = await addSession(caller, { date: "2026-09-15", studentIds: [st.id] })
    const { makeup } = await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-09-18", startTime: "08:00", endTime: "09:00",
    })

    const withMakeup = await getCancelledWithoutMakeup(db, userId, { from })
    expect(withMakeup.map((s) => s.id)).not.toContain(orig.id)

    await caller.session.delete({ id: makeup.id })
    const list = await getCancelledWithoutMakeup(db, userId, { from })
    expect(list.map((s) => s.id)).toEqual([orig.id])
    expect(list[0].status).toBe("cancelled")
    expect(list[0].students.map((x) => x.fullName)).toEqual(["HS Ca Nghỉ"])
    expect(list[0].makeupInfo).toBeNull()

    await caller.session.restore({ id: orig.id })
    expect(await getCancelledWithoutMakeup(db, userId, { from })).toEqual([])
  })

  it("lọc theo from (gồm mốc), gồm ca tương lai, bỏ ca chưa huỷ, sắp theo ngày rồi giờ", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const tooOld = await addSession(caller, { date: "2026-07-26" })
    const onEdge = await addSession(caller, { date: "2026-07-27" })
    const futureLate = await addSession(caller, { date: "2026-10-10", start: "10:00", end: "11:00" })
    const futureEarly = await addSession(caller, { date: "2026-10-10", start: "08:00", end: "09:00" })
    await addSession(caller, { date: "2026-09-20" }) // chưa huỷ
    for (const s of [tooOld, onEdge, futureLate, futureEarly]) await cancelDirect(s.id)

    const list = await getCancelledWithoutMakeup(db, userId, { from })
    expect(list.map((s) => s.id)).toEqual([onEdge.id, futureEarly.id, futureLate.id])
  })

  it("không lấy ca của giáo viên khác", async () => {
    const caller2 = await getAuthedCaller("teacher2")
    const other = await addSession(caller2, { date: "2026-09-20" })
    await cancelDirect(other.id)

    expect(await getCancelledWithoutMakeup(db, await userIdOf("teacher"), { from })).toEqual([])
    const own = await getCancelledWithoutMakeup(db, await userIdOf("teacher2"), { from })
    expect(own.map((s) => s.id)).toEqual([other.id])
  })
})

const NOW = new Date("2026-09-25T03:00:00Z") // 10:00 25/09/2026 giờ VN

// Mở trang Học phí tháng đó (ghi snapshot đúng số) rồi đặt tiền đã thu bằng payment.create
// (B đã merge: paidAmount chỉ được ghi bởi syncPaidAmount từ bảng payments, không update thẳng).
async function setPaid(
  caller: Caller,
  studentId: number,
  month: number,
  paidAmount: number,
  isFullPaid: boolean
) {
  await caller.tuition.getMonthlyStatus({ year: 2026, month, studentId, limit: 1 })
  const mt = await db.monthlyTuition.findUniqueOrThrow({
    where: { studentId_year_month: { studentId, year: 2026, month } },
  })
  const delta = paidAmount - mt.paidAmount
  if (delta > 0) {
    await recordPayment(caller, { studentId, year: 2026, month, amount: delta })
  }
  if (isFullPaid) {
    await caller.tuition.updateSettlement({ studentId, year: 2026, month, isFullPaid: true })
  }
}

async function snapshot(
  studentId: number,
  year: number,
  month: number,
  totalAmountDue: number,
  opts: { paidAmount?: number; isFullPaid?: boolean } = {}
) {
  await db.monthlyTuition.create({
    data: {
      studentId, year, month, totalAmountDue,
      paidAmount: opts.paidAmount ?? 0,
      isFullPaid: opts.isFullPaid ?? false,
    },
  })
}

describe("getDashboardAlerts — còn nợ tháng trước", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("số tiền khớp cột Dư nợ tháng trước của màn Học phí khi tháng này chưa thu", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Nợ", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })

    const alerts = await getDashboardAlerts(db, userId, NOW)
    const page = await caller.tuition.getMonthlyStatus({ year: 2026, month: 9, studentId: st.id, limit: 1 })

    expect(alerts.year).toBe(2026)
    expect(alerts.month).toBe(9)
    expect(page.items[0].previousBalance).toBe(100000)
    expect(alerts.debts).toEqual([
      { studentId: st.id, fullName: "HS Nợ", grade: 6, amount: page.items[0].previousBalance, months: 1 },
    ])
  })

  it("thu 1 phần tháng này → trừ vào nợ cũ trước; thu đủ → hết cảnh báo", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Thu Dần", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    await addSession(caller, { date: "2026-09-20", studentIds: [st.id], presentFee: 100000 })

    // Tổng phải đóng tháng 9 = 100000 nợ cũ + 100000 tháng này.
    await setPaid(caller, st.id, 9, 150000, false)
    const partial = await getDashboardAlerts(db, userId, NOW)
    expect(partial.debts.map((d) => d.amount)).toEqual([50000]) // min(100000, 200000 - 150000)

    await setPaid(caller, st.id, 9, 200000, false)
    expect((await getDashboardAlerts(db, userId, NOW)).debts).toEqual([])
  })

  it("tháng trước đã tất toán (isFullPaid) dù còn thiếu → không mang nợ sang, không cảnh báo", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Miễn Giảm", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await setPaid(caller, st.id, 8, 50000, true)

    expect((await getDashboardAlerts(db, userId, NOW)).debts).toEqual([])
  })

  it("tháng này đã tất toán → không cảnh báo", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Tất Toán", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    await setPaid(caller, st.id, 9, 0, true)

    expect((await getDashboardAlerts(db, userId, NOW)).debts).toEqual([])
  })

  it("nợ liên tiếp 6, 7, 8 → 3 tháng; sắp theo số tiền giảm dần", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const a = await caller.student.create({ fullName: "HS Nợ Dài", grade: 6 })
    const b = await caller.student.create({ fullName: "HS Nợ Ngắn", grade: 2 })
    await snapshot(a.id, 2026, 6, 100000)
    await snapshot(a.id, 2026, 7, 200000)
    await snapshot(a.id, 2026, 8, 300000)
    await snapshot(b.id, 2026, 8, 100000)

    const { debts } = await getDashboardAlerts(db, userId, NOW)
    expect(debts).toEqual([
      { studentId: a.id, fullName: "HS Nợ Dài", grade: 6, amount: 300000, months: 3 },
      { studentId: b.id, fullName: "HS Nợ Ngắn", grade: 2, amount: 100000, months: 1 },
    ])
  })

  it("tháng 7 đã tất toán → đếm dừng, còn 1 tháng", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Ngắt Quãng", grade: 6 })
    await snapshot(st.id, 2026, 6, 100000)
    await snapshot(st.id, 2026, 7, 200000, { isFullPaid: true })
    await snapshot(st.id, 2026, 8, 100000)

    const { debts } = await getDashboardAlerts(db, userId, NOW)
    expect(debts.map((d) => [d.amount, d.months])).toEqual([[100000, 1]])
  })

  it("nợ đủ 12 tháng trước → months = 12 (client hiện 12+)", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Nợ Lâu", grade: 6 })
    for (let i = 0; i < 12; i++) {
      const m = 9 + i // 2025-09 .. 2026-08
      await snapshot(st.id, m > 12 ? 2026 : 2025, m > 12 ? m - 12 : m, 100000)
    }

    const { debts } = await getDashboardAlerts(db, userId, NOW)
    expect(debts.map((d) => d.months)).toEqual([12])
  })

  it("HS đã nghỉ (isActive=false) còn nợ và không có ca → không xuất hiện ở nhóm nào", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Đã Nghỉ", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    // Có ca tháng 9 → vẫn nằm trong danh sách màn Học phí, phải bị lọc bởi isActive.
    await addSession(caller, { date: "2026-09-02", studentIds: [st.id], presentFee: 100000 })
    await db.student.update({ where: { id: st.id }, data: { isActive: false } })

    const alerts = await getDashboardAlerts(db, userId, NOW)
    expect(alerts.debts).toEqual([])
    expect(alerts.idleStudents).toEqual([])
  })
})

describe("getDashboardAlerts — lâu không có ca", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("cửa sổ từ hôm nay −14 đến +7 ngày (gồm 2 đầu), bỏ ca huỷ, sắp theo lớp rồi tên", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const a = await caller.student.create({ fullName: "HS A", grade: 1 })
    const b = await caller.student.create({ fullName: "HS B", grade: 1 })
    const c = await caller.student.create({ fullName: "HS C", grade: 1 })
    const d = await caller.student.create({ fullName: "HS D", grade: 2 })
    const e = await caller.student.create({ fullName: "HS E", grade: 3 })
    const f = await caller.student.create({ fullName: "HS F", grade: 3 })
    await addSession(caller, { date: "2026-09-11", studentIds: [a.id] }) // đúng −14 → có ca
    await addSession(caller, { date: "2026-09-10", studentIds: [b.id] }) // −15 → ngoài cửa sổ
    await addSession(caller, { date: "2026-10-02", studentIds: [c.id] }) // đúng +7 → có ca
    const dSession = await addSession(caller, { date: "2026-09-20", studentIds: [d.id] })
    await cancelDirect(dSession.id) // chỉ có ca huỷ → vẫn cảnh báo
    await addSession(caller, { date: "2026-10-03", studentIds: [e.id] }) // +8 → ngoài cửa sổ
    // f: chưa có ca nào → cảnh báo

    const { idleStudents } = await getDashboardAlerts(db, userId, NOW)
    expect(idleStudents).toEqual([
      { studentId: b.id, fullName: "HS B", grade: 1 },
      { studentId: d.id, fullName: "HS D", grade: 2 },
      { studentId: e.id, fullName: "HS E", grade: 3 },
      { studentId: f.id, fullName: "HS F", grade: 3 },
    ])
  })

  it("tính theo ngày VN: 01:00 25/09 VN cho cùng kết quả; 23:00 24/09 VN thì cửa sổ lùi 1 ngày", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const a = await caller.student.create({ fullName: "HS A", grade: 1 })
    const b = await caller.student.create({ fullName: "HS B", grade: 1 })
    await addSession(caller, { date: "2026-09-11", studentIds: [a.id] })
    await addSession(caller, { date: "2026-09-10", studentIds: [b.id] })

    const base = await getDashboardAlerts(db, userId, NOW)
    const earlyMorningVN = await getDashboardAlerts(db, userId, new Date("2026-09-24T18:00:00Z"))
    expect(earlyMorningVN).toEqual(base)
    expect(base.idleStudents.map((s) => s.studentId)).toEqual([b.id])

    // 16:00Z 24/09 = 23:00 24/09 VN → −14 là 10/09 → HS B có ca trong cửa sổ.
    const lateEveningVN = await getDashboardAlerts(db, userId, new Date("2026-09-24T16:00:00Z"))
    expect(lateEveningVN.idleStudents).toEqual([])
  })
})

describe("getDashboardAlerts — ca nghỉ chưa xếp bù", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("chỉ lấy ca huỷ từ hôm nay −60 ngày (27/07) trở đi", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const old = await addSession(caller, { date: "2026-07-26" }) // −61
    const edge = await addSession(caller, { date: "2026-07-27" }) // −60
    await cancelDirect(old.id)
    await cancelDirect(edge.id)

    const { unrescheduled } = await getDashboardAlerts(db, userId, NOW)
    expect(unrescheduled.map((s) => s.id)).toEqual([edge.id])
  })
})

describe("getDashboardAlerts — an toàn", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("không ghi DB: số dòng MonthlyTuition trước/sau bằng nhau", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Chỉ Đọc", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await addSession(caller, { date: "2026-09-20", studentIds: [st.id], presentFee: 100000 })

    const before = await db.monthlyTuition.count()
    const alerts = await getDashboardAlerts(db, userId, NOW)
    expect(await db.monthlyTuition.count()).toBe(before)
    expect(before).toBe(0)
    // Chưa có snapshot nào → nợ lấy từ lịch sử, vẫn phải hiện.
    expect(alerts.debts.map((d) => [d.studentId, d.amount, d.months])).toEqual([[st.id, 100000, 1]])
  })

  it("đa người dùng: dữ liệu của giáo viên khác không xuất hiện", async () => {
    const caller2 = await getAuthedCaller("teacher2")
    const st = await caller2.student.create({ fullName: "HS Của GV2", grade: 5, tuitionFee: 100000 })
    await addSession(caller2, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    const cancelled = await addSession(caller2, { date: "2026-09-20", start: "10:00", end: "11:00" })
    await cancelDirect(cancelled.id)

    const mine = await getDashboardAlerts(db, await userIdOf("teacher"), NOW)
    expect(mine.debts).toEqual([])
    expect(mine.idleStudents).toEqual([])
    expect(mine.unrescheduled).toEqual([])

    const theirs = await getDashboardAlerts(db, await userIdOf("teacher2"), NOW)
    expect(theirs.debts.map((d) => d.studentId)).toEqual([st.id])
    expect(theirs.idleStudents.map((s) => s.studentId)).toEqual([st.id])
    expect(theirs.unrescheduled.map((s) => s.id)).toEqual([cancelled.id])
  })

  it("router report.alerts trả đúng shape", async () => {
    const caller = await getAuthedCaller()
    const res = await caller.report.alerts()
    expect(Object.keys(res).sort()).toEqual(["debts", "idleStudents", "month", "unrescheduled", "year"])
    expect(typeof res.year).toBe("number")
    expect(res.month).toBeGreaterThanOrEqual(1)
    expect(res.month).toBeLessThanOrEqual(12)
    expect(Array.isArray(res.debts)).toBe(true)
    expect(Array.isArray(res.idleStudents)).toBe(true)
    expect(Array.isArray(res.unrescheduled)).toBe(true)
  })
})
