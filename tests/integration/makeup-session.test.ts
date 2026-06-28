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
