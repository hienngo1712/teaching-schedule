import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function resetSessions() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany()
}

describe("Session CRUD + overlap", () => {
  let subjectId: number

  beforeAll(async () => {
    await resetSessions()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({
      name: "Toán",
      color: "#0891B2",
    })
    subjectId = subject.id
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  // ── Create / GetMonth ─────────────────────────────────────────
  it("✓ create → trả id + startTime/endTime format HH:mm + subject", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.session.create({
      sessionDate: "2026-04-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    expect(s.id).toBeGreaterThan(0)
    expect(s.startTime).toBe("08:00")
    expect(s.endTime).toBe("09:30")
    expect(s.durationMins).toBe(90)
    expect(s.subject.id).toBe(subjectId)
    expect(s.subject.name).toBe("Toán")
  })

  it("✓ create với studentIds → tạo ca + gán HS", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "An", grade: 3 })
    const s = await caller.session.create({
      sessionDate: "2026-04-11",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    expect(s.studentCount).toBe(1)
    expect(s.students[0].fullName).toBe("An")
  })

  it("✓ getMonth(2026, 4) trả tất cả ca tháng 4 với subject + format HH:mm", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-04-05",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    const list = await caller.session.getMonth({ year: 2026, month: 4 })
    expect(list.length).toBe(1)
    expect(list[0].startTime).toBe("08:00")
    expect(list[0].subject.name).toBe("Toán")
  })

  it("✓ getMonth tháng không có ca → []", async () => {
    const caller = await getAuthedCaller()
    const list = await caller.session.getMonth({ year: 2026, month: 7 })
    expect(list).toEqual([])
  })

  // ── Update ───────────────────────────────────────────────────
  it("✓ update title, notes", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.session.create({
      sessionDate: "2026-04-12",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    const updated = await caller.session.update({
      id: s.id,
      data: { title: "Ôn tập", notes: "Mang vở bài tập" },
    })
    expect(updated.title).toBe("Ôn tập")
    expect(updated.notes).toBe("Mang vở bài tập")
  })

  it("✓ update studentIds → thay thế danh sách HS", async () => {
    const caller = await getAuthedCaller()
    const st1 = await caller.student.create({ fullName: "Student 1", grade: 5 })
    const st2 = await caller.student.create({ fullName: "Student 2", grade: 5 })
    
    // Tạo ca với st1
    const s = await caller.session.create({
      sessionDate: "2026-04-14",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st1.id],
    })
    expect(s.studentCount).toBe(1)

    // Cập nhật thành st2
    const updated = await caller.session.update({
      id: s.id,
      data: { studentIds: [st2.id] }
    })
    expect(updated.studentCount).toBe(1)
    expect(updated.students[0].studentId).toBe(st2.id)

    // Cập nhật thành rỗng
    const empty = await caller.session.update({
      id: s.id,
      data: { studentIds: [] }
    })
    expect(empty.studentCount).toBe(0)
  })

  // ── Delete ───────────────────────────────────────────────────
  it("✓ delete → xóa ca + cascade session_students", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({ fullName: "Bình", grade: 4 })
    const s = await caller.session.create({
      sessionDate: "2026-04-13",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.session.delete({ id: s.id })
    const found = await db.teachingSession.findUnique({ where: { id: s.id } })
    expect(found).toBeNull()
    const links = await db.sessionStudent.findMany({
      where: { sessionId: s.id },
    })
    expect(links).toEqual([])
    // HS vẫn còn
    const stillThere = await db.student.findUnique({ where: { id: st.id } })
    expect(stillThere).not.toBeNull()
  })

  // ── Overlap (8 cases) ────────────────────────────────────────
  it("✗ overlap: trùng giờ hoàn toàn → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-05-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    await expect(
      caller.session.create({
        sessionDate: "2026-05-10",
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("✗ overlap: trùng một phần (08:30–10:00 vs 08:00–09:30) → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-05-11",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    await expect(
      caller.session.create({
        sessionDate: "2026-05-11",
        startTime: "08:30",
        endTime: "10:00",
        subjectId,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("✓ tiếp nối (09:30–11:00 ngay sau 08:00–09:30) → KHÔNG conflict", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-05-12",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    await expect(
      caller.session.create({
        sessionDate: "2026-05-12",
        startTime: "09:30",
        endTime: "11:00",
        subjectId,
      })
    ).resolves.toBeDefined()
  })

  it("✓ cùng giờ khác ngày → KHÔNG conflict", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-05-13",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    await expect(
      caller.session.create({
        sessionDate: "2026-05-14",
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
      })
    ).resolves.toBeDefined()
  })

  it("✓ update giờ không trùng → OK", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.session.create({
      sessionDate: "2026-05-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    const updated = await caller.session.update({
      id: s.id,
      data: { startTime: "10:00", endTime: "11:30" },
    })
    expect(updated.startTime).toBe("10:00")
  })

  it("✗ update giờ trùng với ca khác → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-05-16",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    const s2 = await caller.session.create({
      sessionDate: "2026-05-16",
      startTime: "10:00",
      endTime: "11:30",
      subjectId,
    })
    await expect(
      caller.session.update({
        id: s2.id,
        data: { startTime: "08:30", endTime: "09:30" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("✓ update chính ca đó (không đổi giờ) → KHÔNG tự conflict", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.session.create({
      sessionDate: "2026-05-17",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })
    // Đổi sang giờ trùng với chính nó (excludeId loại bỏ self)
    const updated = await caller.session.update({
      id: s.id,
      data: { startTime: "08:00", endTime: "09:30", title: "Cập nhật" },
    })
    expect(updated.title).toBe("Cập nhật")
  })

  it("✗ create với subjectId của user khác → NOT_FOUND", async () => {
    const callerA = await getAuthedCaller()
    const callerB = await getAuthedCaller("teacher2")
    const subjectB = await callerB.subject.create({ name: "Lý B" })
    await expect(
      callerA.session.create({
        sessionDate: "2026-05-20",
        startTime: "08:00",
        endTime: "09:30",
        subjectId: subjectB.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Bulk Create ──────────────────────────────────────────────
  describe("bulkCreate", () => {
    it("✓ tạo nhiều ca đúng thứ trong tuần", async () => {
      const caller = await getAuthedCaller()
      const res = await caller.session.bulkCreate({
        startDate: "2026-04-01", // T4
        endDate: "2026-04-10",   // T6
        weekdays: [0, 2, 4],     // T2, T4, T6
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
      })
      // T4 (1), T6 (3), T2 (6), T4 (8), T6 (10) → 5 ca
      expect(res.created).toBe(5)
      expect(res.skipped).toBe(0)

      const list = await caller.session.getMonth({ year: 2026, month: 4 })
      expect(list.length).toBe(5)
    })

    it("✓ bulkCreate với studentIds → gán HS cho tất cả ca", async () => {
      const caller = await getAuthedCaller()
      const st = await caller.student.create({ fullName: "An", grade: 3 })
      await caller.session.bulkCreate({
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        weekdays: [2, 4], // T4, T6
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
        studentIds: [st.id],
      })
      const list = await caller.session.getMonth({ year: 2026, month: 4 })
      expect(list.length).toBe(2)
      expect(list[0].studentCount).toBe(1)
      expect(list[1].studentCount).toBe(1)
    })

    it("✓ skip ca bị trùng giờ → trả số lượng skipped", async () => {
      const caller = await getAuthedCaller()
      // Tạo sẵn 1 ca trùng giờ vào T4 ngày 01/04
      await caller.session.create({
        sessionDate: "2026-04-01",
        startTime: "08:00",
        endTime: "09:00",
        subjectId,
      })

      const res = await caller.session.bulkCreate({
        startDate: "2026-04-01",
        endDate: "2026-04-01",
        weekdays: [2], // T4
        startTime: "08:30",
        endTime: "10:00",
        subjectId,
      })
      expect(res.created).toBe(0)
      expect(res.skipped).toBe(1)
    })

    it("✓ checkBulkConflicts trả danh sách ca bị trùng", async () => {
      const caller = await getAuthedCaller()
      // Tạo sẵn 1 ca vào T4 ngày 01/04
      await caller.session.create({
        sessionDate: "2026-04-01",
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
        title: "Lớp Toán A",
      })

      const conflicts = await caller.session.checkBulkConflicts({
        startDate: "2026-04-01",
        endDate: "2026-04-05",
        weekdays: [2, 4], // T4, T6
        startTime: "08:30",
        endTime: "10:00",
        subjectId,
      })

      expect(conflicts.length).toBe(1)
      expect(conflicts[0].date).toBe("01/04/2026")
      expect(conflicts[0].conflict).toContain("Lớp Toán A")
    })
  })

  // ── Duplicate ────────────────────────────────────────────────
  describe("duplicate", () => {
    it("✓ duplicate → ca mới + cùng HS + attendance reset pending", async () => {
      const caller = await getAuthedCaller()
      const st = await caller.student.create({ fullName: "Bình", grade: 4 })
      const s = await caller.session.create({
        sessionDate: "2026-04-20",
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
        studentIds: [st.id],
      })

      // Điểm danh ca gốc là present
      await caller.attendance.update({
        sessionId: s.id,
        attendances: [{ studentId: st.id, attendance: "present" }],
      })

      const dup = await caller.session.duplicate({
        id: s.id,
        targetDate: "2026-04-27",
      })

      expect(dup.sessionDate.toISOString()).toContain("2026-04-27")
      expect(dup.startTime).toBe(s.startTime)
      expect(dup.studentCount).toBe(1)
      expect(dup.students[0].attendance).toBe("pending") // Reset về pending
    })

    it("✗ duplicate vào ngày trùng giờ → CONFLICT", async () => {
      const caller = await getAuthedCaller()
      const s = await caller.session.create({
        sessionDate: "2026-04-21",
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
      })
      // Ca đã có ở ngày đích
      await caller.session.create({
        sessionDate: "2026-04-28",
        startTime: "08:00",
        endTime: "09:30",
        subjectId,
      })

      await expect(
        caller.session.duplicate({ id: s.id, targetDate: "2026-04-28" })
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })
  })
})

// ── updateFuture (bulk) — giữ điểm danh & multi-tenant ───────────────
describe("updateFuture (bulk)", () => {
  let subjectId: number

  beforeAll(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
    await db.student.deleteMany()
    await db.subject.deleteMany()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Lý", color: "#0891B2" })
    subjectId = subject.id
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ updateFuture với studentIds (cùng danh sách) → KHÔNG reset điểm danh", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.student.create({ fullName: "An", grade: 5 })
    const b = await caller.student.create({ fullName: "Bình", grade: 5 })

    const s = await caller.session.create({
      sessionDate: "2026-09-07", // thứ 2
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [a.id, b.id],
    })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [
        { studentId: a.id, attendance: "present" },
        { studentId: b.id, attendance: "absent" },
      ],
    })

    await caller.session.updateFuture({
      id: s.id,
      data: { title: "Đổi tiêu đề", studentIds: [a.id, b.id] },
    })

    const detail = await caller.session.getDetail({ id: s.id })
    const byId = Object.fromEntries(detail.students.map((st) => [st.studentId, st.attendance]))
    expect(detail.studentCount).toBe(2)
    expect(byId[a.id]).toBe("present")
    expect(byId[b.id]).toBe("absent")
  })

  it("✗ updateFuture đổi subjectId sang môn của user khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const callerB = await getAuthedCaller("teacher2")
    const subjB = await callerB.subject.create({ name: "Hóa B", color: "#16A34A" })

    const s = await caller.session.create({
      sessionDate: "2026-09-08",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })

    await expect(
      caller.session.updateFuture({ id: s.id, data: { subjectId: subjB.id } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("✗ updateFuture với studentIds chứa HS của user khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const callerB = await getAuthedCaller("teacher2")
    const stB = await callerB.student.create({ fullName: "HS của B", grade: 5 })

    const s = await caller.session.create({
      sessionDate: "2026-09-09",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
    })

    await expect(
      caller.session.updateFuture({ id: s.id, data: { studentIds: [stB.id] } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

// Tránh TRPCError import unused
void TRPCError
