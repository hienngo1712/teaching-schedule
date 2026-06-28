import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function reset() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany()
}

describe("checkOverlap bỏ qua ca cancelled", () => {
  let subjectId: number

  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ slot của ca đã cancelled được coi là trống", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    // hủy ca gốc trực tiếp qua db (tạm thời — sẽ thay bằng createMakeup ở Task 4)
    await db.teachingSession.update({ where: { id: orig.id }, data: { status: "cancelled" } })

    // tạo ca khác trùng đúng slot → KHÔNG được ném CONFLICT
    const s2 = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    expect(s2.id).toBeGreaterThan(0)
  })
})

describe("createMakeup", () => {
  let subjectId: number
  let studentId: number

  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
    const st = await caller.student.create({ fullName: "An", grade: 3 })
    studentId = st.id
    await db.student.update({ where: { id: studentId }, data: { tuitionFee: 100000 } })
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ tạo ca bù: copy HS/fee, điểm danh pending, ca gốc cancelled + liên kết", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30",
      subjectId, studentIds: [studentId], title: "Lớp 3",
    })

    const res = await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30",
      cancelReason: "Nghỉ lễ",
    })

    expect(res.makeup.makeupOfId).toBe(orig.id)
    expect(res.makeup.status).toBe("scheduled")
    expect(res.makeup.students).toHaveLength(1)
    expect(res.makeup.students[0].fee).toBe(100000)
    expect(res.makeup.students[0].attendance).toBe("pending")
    expect(res.makeup.title).toBe("Lớp 3")
    expect(res.cancelled.status).toBe("cancelled")

    const reloaded = await db.teachingSession.findUniqueOrThrow({ where: { id: orig.id } })
    expect(reloaded.cancelReason).toBe("Nghỉ lễ")
    expect(reloaded.cancelledAt).not.toBeNull()
  })

  it("✗ tạo ca bù cho ca đã cancelled → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.createMakeup({ id: orig.id, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30" })
    await expect(
      caller.session.createMakeup({ id: orig.id, sessionDate: "2026-07-09", startTime: "17:00", endTime: "18:30" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("✗ ca bù trùng giờ ca đang hoạt động → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.create({
      sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30", subjectId, title: "Lớp khác",
    })
    await expect(
      caller.session.createMakeup({ id: orig.id, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30" })
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("✗ ca của user khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.session.createMakeup({ id: 999999, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("DTO liên kết ca bù", () => {
  let subjectId: number
  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
  })
  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ getMonth: ca gốc có makeupInfo, ca bù có originalInfo + status", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-08-03", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-08-05", startTime: "17:00", endTime: "18:30",
    })

    const list = await caller.session.getMonth({ year: 2026, month: 8 })
    const cancelled = list.find((s) => s.id === orig.id)!
    const makeup = list.find((s) => s.makeupOfId === orig.id)!

    expect(cancelled.status).toBe("cancelled")
    expect(cancelled.makeupInfo?.id).toBe(makeup.id)
    expect(makeup.originalInfo?.id).toBe(orig.id)
  })
})

describe("Loại ca cancelled khỏi doanh thu & học phí", () => {
  let subjectId: number
  let studentId: number
  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
    const st = await caller.student.create({ fullName: "Bình", grade: 4 })
    studentId = st.id
    await db.student.update({ where: { id: studentId }, data: { tuitionFee: 200000 } })
  })
  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ ca bù không làm tăng expectedRevenue (gốc hủy + bù = 1 ca tính tiền)", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-09-07", startTime: "17:00", endTime: "18:30", subjectId, studentIds: [studentId],
    })
    const before = await caller.report.monthlySummary({ year: 2026, month: 9 })

    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-09-09", startTime: "17:00", endTime: "18:30",
    })
    const after = await caller.report.monthlySummary({ year: 2026, month: 9 })

    expect(after.expectedRevenue).toBe(before.expectedRevenue)
    expect(after.totalSessions).toBe(before.totalSessions) // gốc bị loại, bù được tính → bằng nhau
  }, 30_000)

  it("✓ học phí tháng không tính ca cancelled", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-10-05", startTime: "17:00", endTime: "18:30", subjectId, studentIds: [studentId],
    })
    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-10-07", startTime: "17:00", endTime: "18:30",
    })
    const tuition = await caller.tuition.getMonthlyStatus({ year: 2026, month: 10, page: 1, limit: 50, status: "all" })
    const row = tuition.items.find((i) => i.studentId === studentId)!
    expect(row.totalSessions).toBe(1) // chỉ ca bù
  }, 30_000)
})

describe("restore (khôi phục ca hủy)", () => {
  let subjectId: number
  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
  })
  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ khôi phục: xóa ca bù, ca gốc về scheduled", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-11-02", startTime: "17:00", endTime: "18:30", subjectId,
    })
    const { makeup } = await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-11-04", startTime: "17:00", endTime: "18:30",
    })

    const restored = await caller.session.restore({ id: orig.id })
    expect(restored.status).toBe("scheduled")

    const makeupGone = await db.teachingSession.findUnique({ where: { id: makeup.id } })
    expect(makeupGone).toBeNull()
  })

  it("✗ khôi phục khi slot gốc đã bị chiếm → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-11-09", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-11-11", startTime: "17:00", endTime: "18:30",
    })
    // chiếm lại slot gốc
    await caller.session.create({
      sessionDate: "2026-11-09", startTime: "17:00", endTime: "18:30", subjectId, title: "Lớp mới",
    })
    await expect(caller.session.restore({ id: orig.id })).rejects.toMatchObject({ code: "CONFLICT" })
  })
})
