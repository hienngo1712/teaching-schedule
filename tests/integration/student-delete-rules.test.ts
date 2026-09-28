import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"

const { year: curY, month: curM } = vnDateParts()
const prevM = curM === 1 ? 12 : curM - 1
const prevY = curM === 1 ? curY - 1 : curY
const PAST = `${prevY}-${String(prevM).padStart(2, "0")}-06` // tháng quá khứ cố định; nợ lũy kế tính tới tháng VN hiện tại

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function withPresent(fee = 100_000) {
  const caller = await getAuthedCaller()
  const st = await caller.student.create({ fullName: "HS Quy tắc", grade: 6, tuitionFee: fee })
  const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
  const s = await caller.session.create({ sessionDate: PAST, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [st.id] })
  await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
  return { caller, st, s }
}

describe("Quy tắc xoá học sinh (spec R2)", () => {
  beforeEach(clean)

  it("HS mới chưa có dữ liệu → xoá được", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Nhầm", grade: 3 })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
    await caller.student.delete({ id: st.id })
    expect(await db.student.findUnique({ where: { id: st.id, isDeleted: true } })).not.toBeNull()
  })

  it("buổi vắng (absent) không tính là dữ liệu → xoá được", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Vắng", grade: 3, tuitionFee: 100_000 })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: PAST, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "absent" }] })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
  })

  it("đang học + có buổi có mặt → active_with_data, delete → BAD_REQUEST", async () => {
    const { caller, st } = await withPresent()
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: false, reason: "active_with_data" })
    await expect(caller.student.delete({ id: st.id })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/Đã nghỉ/) })
  })

  it("đang học + chỉ có lần thu → active_with_data", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Thu", grade: 6 })
    await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 10_000, paidAt: "2030-05-20", method: "cash" })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: false, reason: "active_with_data" })
  })

  it("lần thu đã ở Thùng rác không tính là dữ liệu", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "HS Thu nhầm", grade: 6 })
    const p = await caller.payment.create({ studentId: st.id, year: 2030, month: 5, amount: 10_000, paidAt: "2030-05-20", method: "cash" })
    await caller.payment.delete({ id: p.id })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
  })

  it("đã nghỉ, nợ từ tháng trước (carry-over) → debt đúng số, delete → BAD_REQUEST", async () => {
    const { caller, st } = await withPresent(100_000)
    await caller.student.deactivate({ id: st.id })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: false, reason: "debt", debt: 100_000 })
    await expect(caller.student.delete({ id: st.id })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/100\.000/) })
  })

  it("đã nghỉ, đã trả hết → xoá được", async () => {
    const { caller, st } = await withPresent(100_000)
    await caller.payment.create({ studentId: st.id, year: prevY, month: prevM, amount: 100_000, paidAt: `${prevY}-${String(prevM).padStart(2, "0")}-20`, method: "cash" })
    await caller.student.deactivate({ id: st.id })
    expect(await caller.student.deleteCheck({ id: st.id })).toEqual({ allowed: true })
    await caller.student.delete({ id: st.id })
  })

  it("HS người khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const st = await caller.student.create({ fullName: "HS Của tôi", grade: 3 })
    await expect(other.student.deleteCheck({ id: st.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
