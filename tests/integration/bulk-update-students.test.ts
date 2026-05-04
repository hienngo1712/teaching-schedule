import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function resetSessions() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany()
}

describe("Bulk Update & Delete Future Sessions", () => {
  let subjectId: number
  let student1Id: number
  let student2Id: number
  let student3Id: number

  beforeAll(async () => {
    await resetSessions()
    const caller = await getAuthedCaller()
    
    const subject = await caller.subject.create({
      name: "Toán",
      color: "#0891B2",
    })
    subjectId = subject.id

    const st1 = await caller.student.create({ fullName: "Student 1", grade: 5 })
    const st2 = await caller.student.create({ fullName: "Student 2", grade: 5 })
    const st3 = await caller.student.create({ fullName: "Student 3", grade: 5 })
    
    student1Id = st1.id
    student2Id = st2.id
    student3Id = st3.id
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ bulkUpdateFuture: cập nhật danh sách học sinh (thay thế)", async () => {
    const caller = await getAuthedCaller()
    
    // 1. Tạo chuỗi 3 ca dạy vào các thứ Hai
    // 2026-05-04 (T2), 2026-05-11 (T2), 2026-05-18 (T2)
    await caller.session.bulkCreate({
      startDate: "2026-05-04",
      endDate: "2026-05-18",
      weekdays: [0], // Thứ 2
      startTime: "19:00",
      endTime: "21:00",
      subjectId,
      studentIds: [student1Id, student2Id, student3Id],
    })

    const initialSessions = await caller.session.getMonth({ year: 2026, month: 5 })
    expect(initialSessions.length).toBe(3)
    expect(initialSessions[0].studentCount).toBe(3)

    // 2. Thực hiện sửa hàng loạt từ ca đầu tiên: chỉ còn 1 học sinh
    await caller.session.updateFuture({
      id: initialSessions[0].id,
      data: {
        studentIds: [student1Id]
      }
    })

    // 3. Kiểm tra lại: tất cả các ca phải chỉ còn 1 học sinh
    const updatedSessions = await caller.session.getMonth({ year: 2026, month: 5 })
    expect(updatedSessions.length).toBe(3)
    expect(updatedSessions[0].studentCount).toBe(1)
    expect(updatedSessions[1].studentCount).toBe(1)
    expect(updatedSessions[2].studentCount).toBe(1)
    expect(updatedSessions[0].students[0].studentId).toBe(student1Id)
  })

  it("✓ bulkUpdateFuture: cập nhật thời gian và ghi chú", async () => {
    const caller = await getAuthedCaller()
    
    await caller.session.bulkCreate({
      startDate: "2026-06-01",
      endDate: "2026-06-15",
      weekdays: [0], 
      startTime: "19:00",
      endTime: "21:00",
      subjectId,
    })

    const sessions = await caller.session.getMonth({ year: 2026, month: 6 })
    
    await caller.session.updateFuture({
      id: sessions[0].id,
      data: {
        startTime: "18:00",
        endTime: "20:00",
        notes: "Ghi chú mới"
      }
    })

    const updated = await caller.session.getMonth({ year: 2026, month: 6 })
    updated.forEach(s => {
      expect(s.startTime).toBe("18:00")
      expect(s.endTime).toBe("20:00")
      expect(s.notes).toBe("Ghi chú mới")
    })
  })

  it("✓ bulkDeleteFuture: xóa các ca trong tương lai", async () => {
    const caller = await getAuthedCaller()
    
    // Tạo 4 ca tháng 7
    await caller.session.bulkCreate({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      weekdays: [2], // Thứ 4: 01, 08, 15, 22, 29 -> 5 ca
      startTime: "08:00",
      endTime: "10:00",
      subjectId,
    })

    let sessions = await caller.session.getMonth({ year: 2026, month: 7 })
    expect(sessions.length).toBe(5)

    // Xóa từ ca ngày 15/07 (ca thứ 3)
    const midSession = sessions[2]
    await caller.session.deleteFuture({ id: midSession.id })

    // Phải còn lại 2 ca (ngày 01 và 08)
    sessions = await caller.session.getMonth({ year: 2026, month: 7 })
    expect(sessions.length).toBe(2)
  })
})
