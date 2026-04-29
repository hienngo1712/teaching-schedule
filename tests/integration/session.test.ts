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
})

// Tránh TRPCError import unused
void TRPCError
