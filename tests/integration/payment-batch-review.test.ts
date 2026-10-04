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

const pad = (n: number) => String(n).padStart(2, "0")

// HS theo buổi 100k, mỗi tháng M0, M1, M2 (3 tháng trước → tháng trước) có 1 ca có mặt = 100k.
async function setup() {
  const caller = await getAuthedCaller("teacher")
  const { year, month } = vnDateParts()
  const cur = monthKey(year, month)
  const [M0, M1, M2] = [cur - 3, cur - 2, cur - 1].map(keyToYearMonth)
  const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
  const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS review Y", grade: 5, tuitionFee: 100_000 })
  const ids: number[] = []
  for (const m of [M0, M1, M2]) {
    const s = await caller.session.create({
      sessionDate: `${m.year}-${pad(m.month)}-10`, startTime: "08:00", endTime: "09:30", subjectId, studentIds: [st.id],
    })
    ids.push(s.id)
  }
  await db.sessionStudent.updateMany({ where: { sessionId: { in: ids } }, data: { attendance: "present", fee: 100_000 } })
  return { caller, st, M0, M1, M2 }
}

async function liveBatchSum(batchId: string) {
  const { _sum } = await db.payment.aggregate({ where: { batchId, isDeleted: false }, _sum: { amount: true } })
  return _sum.amount ?? 0
}

describe("Sửa sau review Y — đợt thu", () => {
  beforeEach(clean)

  it("2 lần sửa cùng 1 đợt song song không nhân đôi tiền", async () => {
    const { caller, st, M2 } = await setup()
    const { batchId } = await caller.payment.record({ studentId: st.id, ...M2, amount: 300_000 })
    const paidAt = `${M2.year}-${pad(M2.month)}-20`
    await Promise.allSettled([
      caller.payment.updateBatch({ batchId, amount: 200_000, paidAt }),
      caller.payment.updateBatch({ batchId, amount: 100_000, paidAt }),
    ])
    expect([100_000, 200_000]).toContain(await liveBatchSum(batchId))
  })

  it("xoá và sửa cùng 1 đợt song song: đợt đã xoá không sống lại", async () => {
    const { caller, st, M2 } = await setup()
    const { batchId } = await caller.payment.record({ studentId: st.id, ...M2, amount: 300_000 })
    const paidAt = `${M2.year}-${pad(M2.month)}-20`
    await Promise.allSettled([
      caller.payment.deleteBatch({ batchId }),
      caller.payment.updateBatch({ batchId, amount: 100_000, paidAt }),
    ])
    expect(await liveBatchSum(batchId)).toBe(0)
  })

  it("legacy-<id> trỏ vào dòng đã thuộc đợt Y → NOT_FOUND", async () => {
    const { caller, st, M2 } = await setup()
    const { batchId } = await caller.payment.record({ studentId: st.id, ...M2, amount: 100_000 })
    const row = await db.payment.findFirstOrThrow({ where: { batchId } })
    await expect(caller.payment.deleteBatch({ batchId: `legacy-${row.id}` })).rejects.toThrow(/NOT_FOUND/)
  })

  it("lịch sử: 2 đợt cùng ngày → đợt ghi sau đứng trước", async () => {
    const { caller, st, M0, M2 } = await setup()
    await caller.payment.record({ studentId: st.id, ...M2, amount: 50_000 })
    await caller.payment.record({ studentId: st.id, ...M2, amount: 30_000 })
    const batches = await caller.payment.listBatches({ studentId: st.id, ...M0 })
    expect(batches.map((b) => b.amount)).toEqual([30_000, 50_000])
  })

  it("thu tiền chỉ tạo dòng tháng cho tháng nhận tiền + tháng đang xem (không quét cả lịch sử)", async () => {
    const { caller, st, M0, M1, M2 } = await setup()
    await caller.payment.record({ studentId: st.id, ...M2, amount: 100_000 })
    const months = await db.monthlyTuition.findMany({ where: { studentId: st.id }, select: { year: true, month: true } })
    const keys = months.map((m) => monthKey(m.year, m.month)).sort((a, b) => a - b)
    expect(keys).toEqual([monthKey(M0.year, M0.month), monthKey(M2.year, M2.month)])
    expect(keys).not.toContain(monthKey(M1.year, M1.month))
  })
})

describe("Sửa sau review Y — updateSettlement gửi riêng từng trường", () => {
  beforeEach(clean)

  it("chỉ gửi notes không đổi isFullPaid; chỉ gửi isFullPaid không đổi notes", async () => {
    const { caller, st, M2 } = await setup()
    await caller.tuition.updateSettlement({ studentId: st.id, ...M2, isFullPaid: true })
    await caller.tuition.updateSettlement({ studentId: st.id, ...M2, notes: "lý do miễn" })
    let mt = await db.monthlyTuition.findFirstOrThrow({ where: { studentId: st.id, ...M2 } })
    expect(mt.isFullPaid).toBe(true)
    expect(mt.notes).toBe("lý do miễn")
    await caller.tuition.updateSettlement({ studentId: st.id, ...M2, isFullPaid: false })
    mt = await db.monthlyTuition.findFirstOrThrow({ where: { studentId: st.id, ...M2 } })
    expect(mt.isFullPaid).toBe(false)
    expect(mt.notes).toBe("lý do miễn")
  })
})
