import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { db } from "@/server/db"
import { RESTORE_DATA } from "@/server/soft-delete"
import { buildBackupWorkbook } from "@/server/services/backup.service"
import { getParentView } from "@/server/services/parent-link.service"
import { getAuthedCaller } from "../helpers/trpc"

// Tháng quá khứ cố định để phiếu/phụ huynh (giới hạn 12 tháng) không đụng; học phí tính mọi tháng.
const Y = 2024
const M = 5
const DAY = "2024-05-06"
const TOKEN = "q".repeat(43)

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function setup() {
  const caller = await getAuthedCaller()
  const st = await caller.student.create({ fullName: "HS Phí", grade: 6, tuitionFee: 100_000 })
  const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
  const s = await caller.session.create({ sessionDate: DAY, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [st.id] })
  await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
  const p = await caller.payment.create({ studentId: st.id, year: Y, month: M, amount: 40_000, paidAt: "2024-05-20", method: "cash" })
  return { caller, st, s, p }
}

async function row(caller: Awaited<ReturnType<typeof getAuthedCaller>>, studentId: number) {
  const r = await caller.tuition.getMonthlyStatus({ year: Y, month: M, status: "all", page: 1, limit: 50 })
  return r.items.find((i) => i.studentId === studentId)
}

describe("Học phí khi xoá / khôi phục (spec Q mục 6)", () => {
  beforeAll(clean)
  beforeEach(clean)

  it("xoá ca → buổi không tính; khôi phục → về số cũ", async () => {
    const { caller, st, s } = await setup()
    expect(await row(caller, st.id)).toMatchObject({ totalSessions: 1, totalExpected: 100_000, paidAmount: 40_000 })
    await caller.session.delete({ id: s.id })
    expect(await row(caller, st.id)).toMatchObject({ totalSessions: 0, totalExpected: 0, paidAmount: 40_000 })
    await db.teachingSession.update({ where: { id: s.id }, data: RESTORE_DATA })
    expect(await row(caller, st.id)).toMatchObject({ totalSessions: 1, totalExpected: 100_000 })
  })

  it("xoá lần thu → paidAmount giảm ngay, không hiện trong danh sách, không sửa/xoá lại được", async () => {
    const { caller, st, p } = await setup()
    await caller.payment.delete({ id: p.id })
    const mt = await db.monthlyTuition.findUniqueOrThrow({ where: { studentId_year_month: { studentId: st.id, year: Y, month: M } } })
    expect(mt.paidAmount).toBe(0)
    expect(await caller.payment.list({ studentId: st.id, year: Y, month: M })).toEqual([])
    await expect(caller.payment.update({ id: p.id, data: { amount: 1 } })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(caller.payment.delete({ id: p.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await db.payment.findUnique({ where: { id: p.id, isDeleted: true } })).not.toBeNull()
  })

  it("xoá HS (đã nghỉ, hết nợ) → biến khỏi học phí + sao lưu, Báo cáo vẫn giữ tiền; ghi tiền cho HS đã xoá → NOT_FOUND", async () => {
    const { caller, st } = await setup()
    const userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
    // R2: HS có dữ liệu phải Đã nghỉ + hết nợ (đã thu 40.000 / phí 100.000 → trả nốt 60.000).
    await caller.payment.create({ studentId: st.id, year: Y, month: M, amount: 60_000, paidAt: "2024-05-21", method: "cash" })
    await caller.student.deactivate({ id: st.id })
    await caller.student.delete({ id: st.id })

    expect(await row(caller, st.id)).toBeUndefined()
    const sum = await caller.report.monthlySummary({ year: Y, month: M })
    // R8: tiền đã thu + học phí đã dạy của HS đã xoá vẫn tính.
    expect(sum).toMatchObject({ totalRevenue: 100_000, totalPaid: 100_000, totalStudents: 1 })
    await expect(caller.payment.create({ studentId: st.id, year: Y, month: M, amount: 1, paidAt: "2024-05-22", method: "cash" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" })

    const wb = await buildBackupWorkbook(db, userId, new Date())
    for (const name of ["Học sinh", "Điểm danh", "Học phí tháng", "Lần thu"]) {
      const ws = wb.getWorksheet(name)
      if (!ws) continue
      const texts: string[] = []
      ws.eachRow((r) => texts.push(String(r.values)))
      expect(texts.join("|")).not.toContain("HS Phí")
    }
  })

  it("trang phụ huynh: ca đã xoá không hiện; HS đã xoá → null", async () => {
    const { caller, st, s } = await setup()
    await db.student.update({ where: { id: st.id }, data: { parentLinkToken: TOKEN } })
    // Chỉ kiểm được tháng trong 12 tháng gần nhất: dời ca về tháng hiện tại VN.
    const now = new Date(Date.now() + 7 * 3600_000)
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    await db.teachingSession.update({ where: { id: s.id }, data: { sessionDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } })
    expect((await getParentView(db, TOKEN, ym))!.attendance).toHaveLength(1)
    await caller.session.delete({ id: s.id })
    expect((await getParentView(db, TOKEN, ym))!.attendance).toHaveLength(0)
    await caller.student.deactivate({ id: st.id }) // R2: HS có lần thu phải Đã nghỉ + hết nợ mới xoá được
    await caller.student.delete({ id: st.id })
    expect(await getParentView(db, TOKEN, ym)).toBeNull()
  })
})
