import { describe, it, expect, vi } from "vitest"

vi.mock("@/server/services/billing.service", () => ({ loadBillingChanges: vi.fn(async () => new Map()) }))
vi.mock("@/server/services/payos-paid.service", () => ({ loadPayosPaid: vi.fn(async () => new Map()) }))

import type { PrismaClient } from "@prisma/client"
import { getMonthlyTuitionStatus } from "@/server/services/tuition.service"

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

// HS 7: T8 có mặt 2 buổi × 100k (đã trả 50k), T9 có mặt 1 buổi × 280k; xem tháng 10 (chưa có ca).
function fakeDb() {
  const history = [
    { studentId: 7, fee: 100000, attendance: "present", session: { sessionDate: d("2026-08-03") } },
    { studentId: 7, fee: 100000, attendance: "present", session: { sessionDate: d("2026-08-10") } },
    { studentId: 7, fee: 280000, attendance: "present", session: { sessionDate: d("2026-09-07") } },
  ]
  const snaps = [{ studentId: 7, year: 2026, month: 8, paidAmount: 50000, isFullPaid: false }]
  return {
    student: { findMany: vi.fn(async () => [{ id: 7, fullName: "HS A", grade: 5, placeId: null, isActive: true }]) },
    sessionStudent: {
      // `include` = điểm danh tháng đang xem; `select` = lịch sử cho nợ cũ.
      findMany: vi.fn(async (args: { include?: unknown }) => (args.include ? [] : history)),
    },
    monthlyTuition: {
      // where có `OR` = các tháng trước; còn lại = snapshot tháng đang xem.
      findMany: vi.fn(async (args: { where: { OR?: unknown } }) => (args.where.OR ? snaps : [])),
      upsert: vi.fn(async () => ({})),
    },
  }
}

describe("getMonthlyTuitionStatus: tách nợ cũ từng tháng (AU)", () => {
  it("trả debtBreakdown theo FIFO, tổng = previousBalance", async () => {
    const { items } = await getMonthlyTuitionStatus(
      fakeDb() as unknown as PrismaClient, 1,
      { year: 2026, month: 10, status: "all", page: 1, limit: 10 }, false
    )
    const row = items[0]
    expect(row.previousBalance).toBe(430000)
    expect(row.debtBreakdown).toEqual([
      { year: 2026, month: 8, amount: 150000 },
      { year: 2026, month: 9, amount: 280000 },
    ])
  })
})
