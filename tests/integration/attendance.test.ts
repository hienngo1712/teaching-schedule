import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function resetDB() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany()
}

describe("Attendance Router", () => {
  let subjectId: number
  let studentId: number
  let sessionId: number

  beforeAll(async () => {
    await resetDB()
    const caller = await getAuthedCaller()
    
    const subject = await caller.subject.create({ name: "Tiếng Anh" })
    subjectId = subject.id

    const student = await caller.student.create({ fullName: "Nguyễn An", grade: 3 })
    studentId = student.id

    const session = await caller.session.create({
      sessionDate: "2026-05-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [studentId],
    })
    sessionId = session.id
  })

  it("✓ get → trả danh sách HS + attendance mặc định pending", async () => {
    const caller = await getAuthedCaller()
    const list = await caller.attendance.get({ sessionId })
    expect(list.length).toBe(1)
    expect(list[0].fullName).toBe("Nguyễn An")
    expect(list[0].attendance).toBe("pending")
  })

  it("✓ update → cập nhật present và note", async () => {
    const caller = await getAuthedCaller()
    await caller.attendance.update({
      sessionId,
      attendances: [
        { studentId, attendance: "present", note: "Đi học đúng giờ" },
      ],
    })

    const list = await caller.attendance.get({ sessionId })
    expect(list[0].attendance).toBe("present")
    expect(list[0].note).toBe("Đi học đúng giờ")
  })

  it("✗ update → lỗi nếu studentId không có trong session", async () => {
    const caller = await getAuthedCaller()
    const otherStudent = await caller.student.create({ fullName: "Bình", grade: 4 })
    
    await expect(
      caller.attendance.update({
        sessionId,
        attendances: [
          { studentId: otherStudent.id, attendance: "present" },
        ],
      })
    ).rejects.toThrow("không có trong ca dạy này")
  })

  it("✓ session.addStudents → HS mới có attendance mặc định pending", async () => {
    const caller = await getAuthedCaller()
    const newStudent = await caller.student.create({ fullName: "Cường", grade: 5 })
    
    // addStudents nay là sync (replace), nên cần truyền cả list nếu muốn giữ HS cũ
    await caller.session.addStudents({
      sessionId,
      studentIds: [studentId, newStudent.id],
    })

    const list = await caller.attendance.get({ sessionId })
    expect(list.length).toBe(2)
    const cuong = list.find(s => s.studentId === newStudent.id)
    expect(cuong?.attendance).toBe("pending")
  })

  it("✓ session.removeStudent → gỡ HS khỏi session", async () => {
    const caller = await getAuthedCaller()
    const listBefore = await caller.attendance.get({ sessionId })
    const studentToRemove = listBefore[0].studentId

    await caller.session.removeStudent({
      sessionId,
      studentId: studentToRemove,
    })

    const listAfter = await caller.attendance.get({ sessionId })
    expect(listAfter.length).toBe(listBefore.length - 1)
    expect(listAfter.find(s => s.studentId === studentToRemove)).toBeUndefined()
  })
})
