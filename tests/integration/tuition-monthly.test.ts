import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { monthKey } from "@/lib/billing"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.studentBillingChange.deleteMany()
  await db.student.deleteMany()
}

describe("Học phí trọn tháng & nợ chuyển (spec T)", () => {
  beforeEach(clean)

  it("1. HS trọn tháng 400k: tháng 3 có 2 ca (1 có mặt, 1 vắng) -> totalExpected 400k, 1/2 buổi, monthly", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Trọn Gói T3",
      grade: 5,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    const s1 = await caller.session.create({
      sessionDate: "2026-03-05",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    const s2 = await caller.session.create({
      sessionDate: "2026-03-12",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })

    await caller.attendance.update({
      sessionId: s1.id,
      attendances: [{ studentId: st.id, attendance: "present" }],
    })
    await caller.attendance.update({
      sessionId: s2.id,
      attendances: [{ studentId: st.id, attendance: "absent" }],
    })

    const res = await caller.tuition.getMonthlyStatus({ year: 2026, month: 3 })
    const item = res.items.find((i) => i.studentId === st.id)
    expect(item).toBeDefined()
    expect(item).toMatchObject({
      totalExpected: 400_000,
      totalSessions: 2,
      presentSessions: 1,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
  })

  it("2. Tháng 4 không có ca -> totalExpected 0, previousBalance 400k từ tháng 3", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Nợ T3 Sang T4",
      grade: 6,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    const s1 = await caller.session.create({
      sessionDate: "2026-03-05",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s1.id,
      attendances: [{ studentId: st.id, attendance: "present" }],
    })

    // Mở thẳng tháng 4 (không cần mở tháng 3 trước)
    const res = await caller.tuition.getMonthlyStatus({ year: 2026, month: 4 })
    const item = res.items.find((i) => i.studentId === st.id)
    expect(item).toBeDefined()
    expect(item).toMatchObject({
      totalExpected: 0,
      previousBalance: 400_000,
      totalAmountDue: 400_000,
      totalSessions: 0,
      presentSessions: 0,
    })
  })

  it("3. Ca đã huỷ hoặc ca đã xoá không làm tháng thành có ca", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Ca Huỷ",
      grade: 7,
      billingMode: "monthly",
      monthlyFee: 350_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    // Ca 1 bị huỷ
    const s1 = await caller.session.create({
      sessionDate: "2026-05-10",
      startTime: "10:00",
      endTime: "11:00",
      subjectId,
      studentIds: [st.id],
    })
    await db.teachingSession.update({
      where: { id: s1.id },
      data: { status: "cancelled" },
    })

    // Ca 2 bị xoá mềm vào thùng rác
    const s2 = await caller.session.create({
      sessionDate: "2026-05-20",
      startTime: "10:00",
      endTime: "11:00",
      subjectId,
      studentIds: [st.id],
    })
    await caller.session.delete({ id: s2.id })

    const res = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })
    const item = res.items.find((i) => i.studentId === st.id)
    expect(item).toBeDefined()
    expect(item!.totalExpected).toBe(0)
    expect(item!.totalSessions).toBe(0)
  })

  it("4. Đổi theo buổi sang trọn tháng: nợ chuyển đúng kể cả khi không mở tháng trước", async () => {
    const caller = await getAuthedCaller()
    // Tạo HS theo buổi 50k
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Chuyển Cách Thu",
      grade: 8,
      tuitionFee: 50_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    // Tháng 3 có 2 ca có mặt = 100k
    const s1 = await caller.session.create({
      sessionDate: "2026-03-02",
      startTime: "14:00",
      endTime: "15:30",
      subjectId,
      studentIds: [st.id],
    })
    const s2 = await caller.session.create({
      sessionDate: "2026-03-09",
      startTime: "14:00",
      endTime: "15:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s1.id,
      attendances: [{ studentId: st.id, attendance: "present" }],
    })
    await caller.attendance.update({
      sessionId: s2.id,
      attendances: [{ studentId: st.id, attendance: "present" }],
    })

    // Mô phỏng đổi sang trọn tháng 300k từ tháng 4/2026
    const k4 = monthKey(2026, 4)
    await db.studentBillingChange.create({
      data: {
        studentId: st.id,
        fromKey: k4,
        mode: "monthly",
        monthlyFee: 300_000,
      },
    })
    await db.student.update({
      where: { id: st.id },
      data: { billingMode: "monthly", monthlyFee: 300_000 },
    })

    // Tháng 4 có 1 ca có mặt
    const s3 = await caller.session.create({
      sessionDate: "2026-04-06",
      startTime: "14:00",
      endTime: "15:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s3.id,
      attendances: [{ studentId: st.id, attendance: "present" }],
    })

    // Mở thẳng tháng 5 (chưa từng mở tháng 3, 4)
    const res5 = await caller.tuition.getMonthlyStatus({ year: 2026, month: 5 })
    const item5 = res5.items.find((i) => i.studentId === st.id)
    expect(item5).toBeDefined()
    // Nợ chuyển sang tháng 5 = 100k (tháng 3) + 300k (tháng 4) = 400k
    expect(item5!.previousBalance).toBe(400_000)

    // Kiểm tra mở tháng 3: trả billingMode "per_session", totalExpected 100k
    const res3 = await caller.tuition.getMonthlyStatus({ year: 2026, month: 3 })
    const item3 = res3.items.find((i) => i.studentId === st.id)
    expect(item3!.totalExpected).toBe(100_000)
    expect(item3!.billingMode).toBe("per_session")

    // Kiểm tra mở tháng 4: trả billingMode "monthly", totalExpected 300k, previousBalance 100k
    const res4 = await caller.tuition.getMonthlyStatus({ year: 2026, month: 4 })
    const item4 = res4.items.find((i) => i.studentId === st.id)
    expect(item4!.totalExpected).toBe(300_000)
    expect(item4!.billingMode).toBe("monthly")
    expect(item4!.monthlyFee).toBe(300_000)
    expect(item4!.previousBalance).toBe(100_000)
  })

  it("5. Thu 400k tháng 3 -> tháng 4 previousBalance = 0", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Đã Đóng Đủ",
      grade: 5,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    const s1 = await caller.session.create({
      sessionDate: "2026-03-05",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s1.id,
      attendances: [{ studentId: st.id, attendance: "present" }],
    })

    // Thu tiền tháng 3
    await caller.payment.create({
      studentId: st.id,
      year: 2026,
      month: 3,
      amount: 400_000,
      paidAt: "2026-03-20",
      method: "transfer",
    })

    const res = await caller.tuition.getMonthlyStatus({ year: 2026, month: 4 })
    const item = res.items.find((i) => i.studentId === st.id)
    expect(item!.previousBalance).toBe(0)
  })

  it("6. Tất toán tháng có trọn gói mà mới thu 100k -> không mang nợ dương sang tháng sau", async () => {
    const caller = await getAuthedCaller()
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Tất Toán",
      grade: 6,
      billingMode: "monthly",
      monthlyFee: 500_000,
    })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    const s1 = await caller.session.create({
      sessionDate: "2026-03-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId,
      studentIds: [st.id],
    })
    await caller.attendance.update({
      sessionId: s1.id,
      attendances: [{ studentId: st.id, attendance: "present" }],
    })

    // Mới thu 100k
    await caller.payment.create({
      studentId: st.id,
      year: 2026,
      month: 3,
      amount: 100_000,
      paidAt: "2026-03-15",
      method: "cash",
    })

    // Giáo viên tất toán tháng 3 (miễn 400k còn lại)
    await caller.tuition.updateSettlement({
      studentId: st.id,
      year: 2026,
      month: 3,
      isFullPaid: true,
    })

    const res = await caller.tuition.getMonthlyStatus({ year: 2026, month: 4 })
    const item = res.items.find((i) => i.studentId === st.id)
    expect(item!.previousBalance).toBe(0)
  })
})
