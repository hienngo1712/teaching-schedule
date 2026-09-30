import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}
beforeEach(cleanup)
afterAll(cleanup)

// Task 6 thêm `consent: CONSENT_ACCEPTED` vào các lời gọi create dưới đây bằng codemod.
async function seed() {
  const t = await getAuthedCaller("teacher")
  const t2 = await getAuthedCaller("teacher2")
  const an = await t.student.create({ fullName: "Nguyễn Văn An", grade: 3 })
  const anh = await t.student.create({ fullName: "Trần Thị Ánh", grade: 3 })
  const binh = await t.student.create({ fullName: "Lê Bình An", grade: 5 })
  const duc = await t.student.create({ fullName: "Đức", grade: 3 })
  const dung = await t.student.create({ fullName: "Dũng", grade: 3 })
  await t2.student.create({ fullName: "An Của GV2", grade: 3 })
  return { t, an, anh, binh, duc, dung }
}

describe("Tìm/sắp tên HS trong bộ nhớ (spec O 6.4)", () => {
  it("student.list: tìm một phần tên, không phân biệt hoa thường, phân biệt dấu, không lộ HS GV khác", async () => {
    const { t } = await seed()
    const res = await t.student.list({ search: "AN" })
    expect(res.items.map((s) => s.fullName)).toEqual(["Nguyễn Văn An", "Lê Bình An"])
    expect(res.totalCount).toBe(2)
  })

  it("student.list: sắp lớp rồi tên tiếng Việt; phân trang đúng totalCount/totalPages", async () => {
    const { t } = await seed()
    const all = await t.student.list({})
    expect(all.items.map((s) => s.fullName)).toEqual(["Dũng", "Đức", "Nguyễn Văn An", "Trần Thị Ánh", "Lê Bình An"])
    const p2 = await t.student.list({ page: 2, limit: 2 })
    expect(p2.items.map((s) => s.fullName)).toEqual(["Nguyễn Văn An", "Trần Thị Ánh"])
    expect(p2.totalCount).toBe(5)
    expect(p2.totalPages).toBe(3)
  })

  it("tuition.getMonthlyStatus: tìm theo tên và sắp như cũ", async () => {
    const { t } = await seed()
    const { year, month } = vnDateParts()
    const res = await t.tuition.getMonthlyStatus({ year, month, search: "an" })
    expect(res.items.map((i) => i.fullName)).toEqual(["Nguyễn Văn An", "Lê Bình An"])
  })

  it("session.getMonth: lọc theo tên chỉ trả ca có HS khớp; HS trong ca sắp theo tên", async () => {
    const { t, an, duc, dung, anh } = await seed()
    const subject = await db.subject.findFirstOrThrow({ where: { user: { username: "teacher" } } })
    const { year, month } = vnDateParts()
    const day = `${year}-${String(month).padStart(2, "0")}-15`
    await t.session.create({ sessionDate: day, startTime: "08:00", endTime: "09:00", subjectId: subject.id, studentIds: [duc.id, an.id, dung.id] })
    await t.session.create({ sessionDate: day, startTime: "10:00", endTime: "11:00", subjectId: subject.id, studentIds: [anh.id] })
    const found = await t.session.getMonth({ year, month, studentName: "văn an", includeStudents: true })
    expect(found).toHaveLength(1)
    expect(found[0].students.map((s) => s.fullName)).toEqual(["Dũng", "Đức", "Nguyễn Văn An"])
    expect(await t.session.getMonth({ year, month, studentName: "không có ai" })).toEqual([])
  })
})
