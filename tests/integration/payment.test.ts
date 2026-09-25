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
