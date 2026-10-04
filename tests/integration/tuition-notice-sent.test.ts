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
    // Spec Y D9: tháng đang học theo buổi không cộng tạm tính vào số cần đóng ngay -> 50k
    expect(resSent1.noticeSentAmount).toBe(50_000)
    expect(resSent1.noticeSentAt).toBeInstanceOf(Date)

    // Kiểm tra dòng trong DB được tạo với carry-over đúng
    const dbTuition = await db.monthlyTuition.findUniqueOrThrow({
      where: { studentId_year_month: { studentId: st.id, year: curYear, month: curMonth } },
    })
    expect(dbTuition.previousBalance).toBe(50_000)
    expect(dbTuition.noticeSentAmount).toBe(50_000)
    expect(dbTuition.noticeSentAt).not.toBeNull()

    // getMonthlyStatus trả về noticeStatus = "sent"
    const status1 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item1 = status1.items.find((i) => i.studentId === st.id)!
    expect(item1.noticeStatus).toBe("sent")
    expect(item1.noticeSentAmount).toBe(50_000)
    expect(item1.noticeSentAt).not.toBeNull()

    // 2. Thêm 1 ca có mặt 100k trong tháng này -> vì đang học theo buổi nên số cần đóng ngay vẫn là 50k -> noticeStatus vẫn là "sent"
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

    const status2 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item2 = status2.items.find((i) => i.studentId === st.id)!
    expect(item2.noticeStatus).toBe("sent")

    // 3. Thu 20k -> số nợ cũ giảm từ 50k xuống 30k -> "changed"
    await caller.payment.create({
      studentId: st.id,
      year: curYear,
      month: curMonth,
      amount: 20_000,
      paidAt: `${curYear}-${String(curMonth).padStart(2, "0")}-12`,
      method: "cash",
    })

    const status4 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item4 = status4.items.find((i) => i.studentId === st.id)!
    expect(item4.noticeStatus).toBe("changed")

    // Gửi lại -> "sent" với số tiền mới 30k
    const resSent2 = await caller.tuition.setNoticeSent({
      studentId: st.id,
      year: curYear,
      month: curMonth,
      sent: true,
    })
    expect(resSent2.noticeSentAmount).toBe(30_000)

    const status3 = await caller.tuition.getMonthlyStatus({ year: curYear, month: curMonth })
    const item3 = status3.items.find((i) => i.studentId === st.id)!
    expect(item3.noticeStatus).toBe("sent")
    expect(item3.noticeSentAmount).toBe(30_000)

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

  // Review V I2: đã đóng đủ thì phiếu hết tác dụng → không gợi ý gửi lại (nhãn "số tiền đã đổi").
  it("gửi phiếu rồi thu đủ → noticeStatus 'sent', không phải 'changed'", async () => {
    const caller = await getAuthedCaller("teacher")
    const { year, month } = vnDateParts()
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Đóng đủ V", grade: 5, tuitionFee: 100_000 })
    const day = `${year}-${String(month).padStart(2, "0")}-05`
    const s = await caller.session.create({ sessionDate: day, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [st.id] })
    await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    await caller.tuition.setNoticeSent({ studentId: st.id, year, month, sent: true })
    await caller.payment.create({ studentId: st.id, year, month, amount: 100_000, paidAt: day, method: "cash" })
    const item = (await caller.tuition.getMonthlyStatus({ year, month })).items.find((i) => i.studentId === st.id)!
    expect(item.noticeStatus).toBe("sent")
  })

  it("Task 2: Bộ lọc noticeFilter (all / unsent / sent) và phân trang", async () => {
    const caller = await getAuthedCaller("teacher")
    const { year: curY, month: curM } = vnDateParts()
    // Dùng tháng trước đã kết thúc để tiền buổi là số cần đóng thực tế (không phải tạm tính)
    const targetK = (curY * 12 + curM - 1) - 1
    const year = Math.floor(targetK / 12)
    const month = (targetK % 12) + 1
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    // 4 HS: A (sent), B (unsent nợ), C (đã đóng đủ chưa gửi), D (changed)
    const stA = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS A Sent", grade: 5, tuitionFee: 100_000 })
    const stB = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS B Unsent", grade: 5, tuitionFee: 100_000 })
    const stC = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS C Paid", grade: 5, tuitionFee: 100_000 })
    const stD = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS D Changed", grade: 5, tuitionFee: 100_000 })

    const curDate = `${year}-${String(month).padStart(2, "0")}-05`
    const session = await caller.session.create({
      sessionDate: curDate,
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [stA.id, stB.id, stC.id, stD.id],
    })
    await caller.attendance.update({
      sessionId: session.id,
      attendances: [
        { studentId: stA.id, attendance: "present", fee: 100_000 },
        { studentId: stB.id, attendance: "present", fee: 100_000 },
        { studentId: stC.id, attendance: "present", fee: 100_000 },
        { studentId: stD.id, attendance: "present", fee: 100_000 },
      ],
    })

    // A: đánh dấu đã gửi
    await caller.tuition.setNoticeSent({ studentId: stA.id, year, month, sent: true })

    // C: đóng đủ tiền
    await caller.payment.create({
      studentId: stC.id,
      year,
      month,
      amount: 100_000,
      paidAt: curDate,
      method: "cash",
    })

    // D: đánh dấu đã gửi, sau đó thêm 1 ca 50k
    await caller.tuition.setNoticeSent({ studentId: stD.id, year, month, sent: true })
    const session2 = await caller.session.create({
      sessionDate: `${year}-${String(month).padStart(2, "0")}-10`,
      startTime: "10:00",
      endTime: "11:30",
      subjectId,
      studentIds: [stD.id],
    })
    await caller.attendance.update({
      sessionId: session2.id,
      attendances: [{ studentId: stD.id, attendance: "present", fee: 50_000 }],
    })

    // Kiểm tra noticeFilter = "all" (hoặc không truyền) -> cả 4 HS
    const resAll = await caller.tuition.getMonthlyStatus({ year, month, noticeFilter: "all" })
    expect(resAll.totalCount).toBe(4)
    expect(resAll.items.map((i) => i.studentId).sort()).toEqual([stA.id, stB.id, stC.id, stD.id].sort())

    // Kiểm tra noticeFilter = "unsent" -> [B, D] (C bị loại vì còn nợ = 0, A bị loại vì sent)
    const resUnsent = await caller.tuition.getMonthlyStatus({ year, month, noticeFilter: "unsent" })
    expect(resUnsent.totalCount).toBe(2)
    expect(resUnsent.items.map((i) => i.studentId).sort()).toEqual([stB.id, stD.id].sort())

    // Kiểm tra noticeFilter = "sent" -> [A] (D bị loại vì changed)
    const resSent = await caller.tuition.getMonthlyStatus({ year, month, noticeFilter: "sent" })
    expect(resSent.totalCount).toBe(1)
    expect(resSent.items[0].studentId).toBe(stA.id)

    // Phân trang với noticeFilter = "unsent"
    const p1 = await caller.tuition.getMonthlyStatus({ year, month, noticeFilter: "unsent", page: 1, limit: 1 })
    expect(p1.items).toHaveLength(1)
    expect(p1.totalCount).toBe(2)
    expect(p1.totalPages).toBe(2)

    const p2 = await caller.tuition.getMonthlyStatus({ year, month, noticeFilter: "unsent", page: 2, limit: 1 })
    expect(p2.items).toHaveLength(1)
    expect(p2.items[0].studentId).not.toBe(p1.items[0].studentId)
  })
})
