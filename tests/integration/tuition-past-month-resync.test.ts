import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

/**
 * Snapshot của tháng QUÁ KHỨ phải được ghi lại khi dữ liệu nguồn đổi.
 *
 * Trước đây `needsUpsert` chỉ đúng cho tháng hiện tại, nên sửa điểm danh / xóa
 * buổi ở tháng trước thì:
 *   - Màn học phí của CHÍNH tháng đó vẫn hiện đúng (số tính lại trong bộ nhớ), nhưng
 *   - row MonthlyTuition của tháng đó đông cứng ở giá trị cũ, mà carry-over của
 *     tháng KẾ TIẾP lại đọc chính row đó → nợ mang sang bị sai.
 */
describe("Tuition — snapshot tháng quá khứ tự đồng bộ lại", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("sửa điểm danh tháng trước → previousBalance tháng sau cập nhật theo", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({
      fullName: "HS Sửa Điểm Danh",
      grade: 5,
      tuitionFee: 100000,
    })

    // Tháng 3: có mặt, nợ 100k.
    const mar = await caller.session.create({
      sessionDate: "2026-03-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    await caller.session.addStudents({ sessionId: mar.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: mar.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
    })

    // Xem tháng 3 rồi tháng 4 → cả hai snapshot được ghi với nợ 100k.
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 3, studentId: student.id })
    const aprBefore = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 4, studentId: student.id,
    })
    expect(aprBefore.items[0].previousBalance).toBe(100000)

    // GV phát hiện điểm danh sai: HS thực ra VẮNG buổi tháng 3 → không tính tiền.
    await caller.attendance.update({
      sessionId: mar.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.ABSENT, fee: 100000 }],
    })

    // Xem lại tháng 3: phải về 0 VÀ phải ghi đè snapshot cũ.
    const marAfter = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 3, studentId: student.id,
    })
    expect(marAfter.items[0].totalAmountDue).toBe(0)

    const marRow = await db.monthlyTuition.findFirstOrThrow({
      where: { studentId: student.id, year: 2026, month: 3 },
    })
    expect(marRow.totalAmountDue).toBe(0)
    expect(marRow.currentMonthFee).toBe(0)
    expect(marRow.presentSessions).toBe(0)

    // Điểm mấu chốt: tháng 4 không được carry 100k nữa.
    const aprAfter = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 4, studentId: student.id,
    })
    expect(aprAfter.items[0].previousBalance).toBe(0)
    expect(aprAfter.items[0].totalAmountDue).toBe(0)
  }, 60000)

  it("xóa buổi của tháng trước → nợ mang sang tháng sau giảm theo", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const subjectId = subjects[0].id

    const student = await caller.student.create({
      fullName: "HS Xóa Buổi",
      grade: 6,
      tuitionFee: 100000,
    })

    const s1 = await caller.session.create({
      sessionDate: "2026-03-10", startTime: "08:00", endTime: "09:30", subjectId,
    })
    const s2 = await caller.session.create({
      sessionDate: "2026-03-12", startTime: "08:00", endTime: "09:30", subjectId,
    })
    for (const s of [s1, s2]) {
      await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
      await caller.attendance.update({
        sessionId: s.id,
        attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 100000 }],
      })
    }

    await caller.tuition.getMonthlyStatus({ year: 2026, month: 3, studentId: student.id })
    const aprBefore = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 4, studentId: student.id,
    })
    expect(aprBefore.items[0].previousBalance).toBe(200000)

    // Buổi 12/03 bị nhập nhầm → xóa hẳn.
    await caller.session.delete({ id: s2.id })

    await caller.tuition.getMonthlyStatus({ year: 2026, month: 3, studentId: student.id })
    const aprAfter = await caller.tuition.getMonthlyStatus({
      year: 2026, month: 4, studentId: student.id,
    })
    expect(aprAfter.items[0].previousBalance).toBe(100000)
  }, 60000)
})
