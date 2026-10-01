import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.studentBillingChange.deleteMany()
  await db.student.deleteMany()
}

describe("Đánh dấu đã gửi phiếu học phí (spec V)", () => {
  beforeEach(clean)

  it("Task 1: setNoticeSent (true/false), tự tính số tiền, noticeStatus (sent/changed/none), bảo vệ quyền sở hữu", async () => {
    const caller = await getAuthedCaller("teacher")
    const caller2 = await getAuthedCaller("teacher2")

    const { year: curYear, month: curMonth } = vnDateParts()
    const prevYear = curMonth === 1 ? curYear - 1 : curYear
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1

    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    // Tạo HS theo buổi 100k
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Phiếu Báo V1",
      grade: 5,
      tuitionFee: 100_000,
    })

    // Tháng trước: 1 ca 50k có mặt, chưa thu tiền -> nợ chuyển sang tháng này = 50k
    const prevDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-15`
    const prevSession = await caller.session.create({
      sessionDate: prevDate,
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: prevSession.id,
      attendances: [{ studentId: st.id, attendance: "present", fee: 50_000 }],
    })

    // Tháng hiện tại: 1 ca 100k có mặt
    const curDate = `${curYear}-${String(curMonth).padStart(2, "0")}-05`
    const curSession1 = await caller.session.create({
      sessionDate: curDate,
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: curSession1.id,
      attendances: [{ studentId: st.id, attendance: "present", fee: 100_000 }],
    })

    // 1. Chưa có dòng monthly_tuition cho tháng hiện tại -> gọi setNoticeSent(sent: true)
    const resSent1 = await caller.tuition.setNoticeSent({
      studentId: st.id,
      year: curYear,
      month: curMonth,
      sent: true,
    })
    // Tổng nợ = 50k (tháng trước) + 100k (tháng này) = 150k
    expect(resSent1.noticeSentAmount).toBe(150_000)
    expect(resSent1.noticeSentAt).toBeInstanceOf(Date)

    // Kiểm tra dòng trong DB được tạo với carry-over đúng
    const dbTuition = await db.monthlyTuition.findUniqueOrThrow({
      where: { studentId_year_month: { studentId: st.id, year: curYear, month: curMonth } },
    })
    expect(dbTuition.previousBalance).toBe(50_000)
    expect(dbTuition.noticeSentAmount).toBe(150_000)
    expect(dbTuition.noticeSentAt).not.toBeNull()

    // getMonthlyStatus trả về noticeStatus = "sent"
    const status1 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item1 = status1.items.find((i) => i.studentId === st.id)!
    expect(item1.noticeStatus).toBe("sent")
    expect(item1.noticeSentAmount).toBe(150_000)
    expect(item1.noticeSentAt).not.toBeNull()

    // 2. Thêm 1 ca có mặt 100k trong tháng này -> số tiền phải đóng đổi từ 150k lên 250k
    const curSession2 = await caller.session.create({
      sessionDate: `${curYear}-${String(curMonth).padStart(2, "0")}-10`,
      startTime: "10:00",
      endTime: "11:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: curSession2.id,
      attendances: [{ studentId: st.id, attendance: "present", fee: 100_000 }],
    })

    // getMonthlyStatus giờ trả về "changed"
    const status2 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item2 = status2.items.find((i) => i.studentId === st.id)!
    expect(item2.noticeStatus).toBe("changed")
    expect(item2.noticeSentAmount).toBe(150_000)

    // Gửi lại -> "sent" với số tiền mới 250k
    const resSent2 = await caller.tuition.setNoticeSent({
      studentId: st.id,
      year: curYear,
      month: curMonth,
      sent: true,
    })
    expect(resSent2.noticeSentAmount).toBe(250_000)

    const status3 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item3 = status3.items.find((i) => i.studentId === st.id)!
    expect(item3.noticeStatus).toBe("sent")
    expect(item3.noticeSentAmount).toBe(250_000)

    // 3. Thu thêm 50k -> số còn phải đóng đổi từ 250k xuống 200k -> "changed"
    await caller.payment.create({
      studentId: st.id,
      year: curYear,
      month: curMonth,
      amount: 50_000,
      paidAt: `${curYear}-${String(curMonth).padStart(2, "0")}-12`,
      method: "cash",
    })

    const status4 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item4 = status4.items.find((i) => i.studentId === st.id)!
    expect(item4.noticeStatus).toBe("changed")

    // 4. setNoticeSent(sent: false) -> "none", 2 cột NULL
    const resSentFalse = await caller.tuition.setNoticeSent({
      studentId: st.id,
      year: curYear,
      month: curMonth,
      sent: false,
    })
    expect(resSentFalse.noticeSentAt).toBeNull()
    expect(resSentFalse.noticeSentAmount).toBeNull()

    const status5 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item5 = status5.items.find((i) => i.studentId === st.id)!
    expect(item5.noticeStatus).toBe("none")
    expect(item5.noticeSentAt).toBeNull()
    expect(item5.noticeSentAmount).toBeNull()

    // 5. caller2 gọi setNoticeSent cho st.id (của teacher1) -> NOT_FOUND
    await expect(
      caller2.tuition.setNoticeSent({
        studentId: st.id,
        year: curYear,
        month: curMonth,
        sent: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
