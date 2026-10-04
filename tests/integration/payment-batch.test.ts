import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"
import { keyToYearMonth } from "@/lib/payment-allocation"
import { monthKey } from "@/lib/billing"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.studentBillingChange.deleteMany()
  await db.student.deleteMany()
}

describe("Payment batching & FIFO multi-month allocation (spec Y Task 2)", () => {
  beforeEach(clean)

  it("các kịch bản ghi / sửa / xoá / đợt / quyền", async () => {
    const caller = await getAuthedCaller("teacher")
    const caller2 = await getAuthedCaller("teacher2")

    const { year: curY, month: curM } = vnDateParts()
    const curK = monthKey(curY, curM)
    const m1K = curK - 2
    const m2K = curK - 1
    const M1 = keyToYearMonth(m1K)
    const M2 = keyToYearMonth(m2K)
    const M3 = { year: curY, month: curM }

    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id

    // Dựng HS theo buổi 100k
    const st = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS FIFO Test",
      grade: 5,
      tuitionFee: 100_000,
    })

    // T8 (M1): 2 ca có mặt = 200k
    const d1_1 = `${M1.year}-${String(M1.month).padStart(2, "0")}-05`
    const d1_2 = `${M1.year}-${String(M1.month).padStart(2, "0")}-10`
    const s1_1 = await caller.session.create({ sessionDate: d1_1, startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id] })
    const s1_2 = await caller.session.create({ sessionDate: d1_2, startTime: "10:00", endTime: "11:30", subjectId, studentIds: [st.id] })
    await db.sessionStudent.updateMany({ where: { sessionId: { in: [s1_1.id, s1_2.id] } }, data: { attendance: "present", fee: 100_000 } })

    // T9 (M2): 6 ca có mặt = 600k
    const s2Ids: number[] = []
    for (let day = 1; day <= 6; day++) {
      const d = `${M2.year}-${String(M2.month).padStart(2, "0")}-${String(day * 4).padStart(2, "0")}`
      const s = await caller.session.create({ sessionDate: d, startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id] })
      s2Ids.push(s.id)
    }
    await db.sessionStudent.updateMany({ where: { sessionId: { in: s2Ids } }, data: { attendance: "present", fee: 100_000 } })

    // 11. tuition.ledgers(M3) trả M1, M2, M3 tăng dần với fee đúng.
    const ledgers = await caller.tuition.ledgers({ studentId: st.id, ...M3 })
    expect(ledgers.map((l) => l.key)).toEqual([m1K, m2K, curK])
    expect(ledgers[0].fee).toBe(200_000)
    expect(ledgers[1].fee).toBe(600_000)
    expect(ledgers[2].fee).toBe(0)

    // 10. `method` optional: payment.create không truyền method -> lưu cash
    const legacyP = await caller.payment.create({
      studentId: st.id,
      year: M2.year,
      month: M2.month,
      amount: 100_000,
      paidAt: `${M2.year}-${String(M2.month).padStart(2, "0")}-15`,
    })
    expect(legacyP.method).toBe("cash")

    // Dọn legacy payment này trước khi test ca 1
    await caller.payment.delete({ id: legacyP.id })

    // 1. FIFO ghi ở tháng hiện tại: record({ year/month = M3, amount: 500_000 })
    const rec1 = await caller.payment.record({
      studentId: st.id,
      ...M3,
      amount: 500_000,
    })
    expect(rec1.allocations).toEqual([
      { year: M1.year, month: M1.month, amount: 200_000 },
      { year: M2.year, month: M2.month, amount: 300_000 },
    ])
    // getMonthlyStatus(M2): paidAmount của HS là 300_000
    const statM2 = await caller.tuition.getMonthlyStatus({ year: M2.year, month: M2.month, studentId: st.id })
    expect(statM2.items[0].paidAmount).toBe(300_000)
    // listBatches(M2) có 1 đợt amount 500k, 2 allocations
    const batchesM2 = await caller.payment.listBatches({ studentId: st.id, ...M2 })
    expect(batchesM2).toHaveLength(1)
    expect(batchesM2[0].batchId).toBe(rec1.batchId)
    expect(batchesM2[0].amount).toBe(500_000)
    expect(batchesM2[0].allocations).toEqual([
      { year: M1.year, month: M1.month, amount: 200_000 },
      { year: M2.year, month: M2.month, amount: 300_000 },
    ])

    // 9. Báo cáo: report tháng M1 đã thu 200k, tháng M2 đã thu 300k
    const repM1 = await caller.report.monthlySummary({ year: M1.year, month: M1.month })
    expect(repM1.totalPaid).toBe(200_000)
    const repM2 = await caller.report.monthlySummary({ year: M2.year, month: M2.month })
    expect(repM2.totalPaid).toBe(300_000)

    // 6. updateBatch: sửa đợt 500k thành 250k
    const upDate = `${M3.year}-${String(M3.month).padStart(2, "0")}-20`
    await caller.payment.updateBatch({
      batchId: rec1.batchId,
      amount: 250_000,
      paidAt: upDate,
      note: "ghi chú mới",
    })
    const batchesAfterUp = await caller.payment.listBatches({ studentId: st.id, ...M2 })
    expect(batchesAfterUp[0].amount).toBe(250_000)
    expect(batchesAfterUp[0].allocations).toEqual([
      { year: M1.year, month: M1.month, amount: 200_000 },
      { year: M2.year, month: M2.month, amount: 50_000 },
    ])

    // 5. deleteBatch: xoá đợt ca 1 -> paid M1, M2 về 0; listBatches rỗng
    await caller.payment.deleteBatch({ batchId: rec1.batchId })
    const statM1AfterDel = await caller.tuition.getMonthlyStatus({ year: M1.year, month: M1.month, studentId: st.id })
    const statM2AfterDel = await caller.tuition.getMonthlyStatus({ year: M2.year, month: M2.month, studentId: st.id })
    expect(statM1AfterDel.items[0].paidAmount).toBe(0)
    expect(statM2AfterDel.items[0].paidAmount).toBe(0)
    const batchesEmpty = await caller.payment.listBatches({ studentId: st.id, ...M2 })
    expect(batchesEmpty).toHaveLength(0)

    // 2. Đóng dư: nợ 800k (200k M1 + 600k M2), record(M2, 1_000_000)
    const recOver = await caller.payment.record({
      studentId: st.id,
      ...M2,
      amount: 1_000_000,
    })
    expect(recOver.allocations).toEqual([
      { year: M1.year, month: M1.month, amount: 200_000 },
      { year: M2.year, month: M2.month, amount: 800_000 },
    ])
    const statM3AfterOver = await caller.tuition.getMonthlyStatus({ year: M3.year, month: M3.month, studentId: st.id })
    expect(statM3AfterOver.items[0].previousBalance).toBe(-200_000)

    // Dọn đợt đóng dư
    await caller.payment.deleteBatch({ batchId: recOver.batchId })

    // 4. Tháng miễn bỏ qua: updateSettlement M1 isFullPaid = true
    await caller.tuition.updateSettlement({
      studentId: st.id,
      year: M1.year,
      month: M1.month,
      isFullPaid: true,
    })
    const recSkip = await caller.payment.record({
      studentId: st.id,
      ...M2,
      amount: 600_000,
    })
    expect(recSkip.allocations).toEqual([
      { year: M2.year, month: M2.month, amount: 600_000 },
    ])
    await caller.payment.deleteBatch({ batchId: recSkip.batchId })
    await caller.tuition.updateSettlement({ studentId: st.id, year: M1.year, month: M1.month, isFullPaid: false })

    // 3. 2 lần record song song ở M2 (mỗi lần 800k)
    await Promise.all([
      caller.payment.record({ studentId: st.id, ...M2, amount: 800_000 }),
      caller.payment.record({ studentId: st.id, ...M2, amount: 800_000 }),
    ])
    const statM1Parallel = await caller.tuition.getMonthlyStatus({ year: M1.year, month: M1.month, studentId: st.id })
    const statM2Parallel = await caller.tuition.getMonthlyStatus({ year: M2.year, month: M2.month, studentId: st.id })
    expect(statM1Parallel.items[0].paidAmount).toBe(200_000)
    expect(statM1Parallel.items[0].paidAmount + statM2Parallel.items[0].paidAmount).toBe(1_600_000)

    // Xoá hết payments để test legacy
    await db.payment.deleteMany()
    await db.monthlyTuition.updateMany({ data: { paidAmount: 0 } })

    // 7. Legacy: tạo bằng payment.create
    const leg = await caller.payment.create({
      studentId: st.id,
      year: M2.year,
      month: M2.month,
      amount: 100_000,
      paidAt: `${M2.year}-${String(M2.month).padStart(2, "0")}-10`,
      method: "cash",
    })
    const legBatches = await caller.payment.listBatches({ studentId: st.id, ...M2 })
    expect(legBatches).toHaveLength(1)
    expect(legBatches[0].batchId).toBe(`legacy-${leg.id}`)
    expect(legBatches[0].legacy).toBe(true)

    // updateBatch legacy
    await caller.payment.updateBatch({
      batchId: `legacy-${leg.id}`,
      amount: 150_000,
      paidAt: `${M2.year}-${String(M2.month).padStart(2, "0")}-11`,
      note: "sửa legacy",
    })
    const statM2Leg = await caller.tuition.getMonthlyStatus({ year: M2.year, month: M2.month, studentId: st.id })
    expect(statM2Leg.items[0].paidAmount).toBe(150_000)

    // deleteBatch legacy
    await caller.payment.deleteBatch({ batchId: `legacy-${leg.id}` })
    const statM2AfterLegDel = await caller.tuition.getMonthlyStatus({ year: M2.year, month: M2.month, studentId: st.id })
    expect(statM2AfterLegDel.items[0].paidAmount).toBe(0)

    // 8. Quyền: teacher2 gọi deleteBatch / updateBatch / record cho HS teacher -> NOT_FOUND; HS đã xoá mềm -> NOT_FOUND
    const freshRec = await caller.payment.record({ studentId: st.id, ...M2, amount: 100_000 })
    await expect(caller2.payment.deleteBatch({ batchId: freshRec.batchId })).rejects.toThrow("NOT_FOUND")
    await expect(caller2.payment.updateBatch({ batchId: freshRec.batchId, amount: 200_000, paidAt: `${M2.year}-${String(M2.month).padStart(2, "0")}-01`, note: null })).rejects.toThrow("NOT_FOUND")
    await expect(caller2.payment.record({ studentId: st.id, ...M2, amount: 100_000 })).rejects.toThrow("NOT_FOUND")

    // HS xoá mềm: xoá mềm trực tiếp qua db để kiểm tra guard của payment.record
    await db.student.update({ where: { id: st.id }, data: { isDeleted: true, deletedAt: new Date() } })
    await expect(caller.payment.record({ studentId: st.id, ...M2, amount: 100_000 })).rejects.toThrow("NOT_FOUND")
  })
})
