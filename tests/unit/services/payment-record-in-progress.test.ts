import { describe, it, expect, vi, afterEach } from "vitest"

// Dừng ngay sau bước chặn tháng đang học: đến được ensureMonthlyTuition nghĩa là đã cho ghi.
const h = vi.hoisted(() => ({ ensure: vi.fn(async () => { throw new Error("PASSED_GUARD") }) }))
vi.mock("@/server/services/tuition.service", () => ({ ensureMonthlyTuition: h.ensure, loadMonthLedgers: vi.fn() }))

import type { PrismaClient } from "@prisma/client"
import { recordPayment } from "@/server/services/payment.service"

// Ca cuối của HS trong tháng 10/2026: 28/10 17:00–18:30 giờ VN
function fakeDb(sessions: { sessionDate: Date; endTime: Date; status: string; isDeleted: boolean }[]) {
  return { teachingSession: { findMany: vi.fn(async () => sessions) } } as unknown as PrismaClient
}
const lastCa = { sessionDate: new Date("2026-10-28T00:00:00Z"), endTime: new Date("1970-01-01T18:30:00Z"), status: "scheduled", isDeleted: false }
const input = { studentId: 1, year: 2026, month: 10, amount: 500_000 }

describe("recordPayment: tháng hiện tại ghi được sau ca cuối (spec AS)", () => {
  afterEach(() => vi.useRealTimers())

  it("trước giờ kết thúc ca cuối → chặn", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-28T11:29:00Z") })
    await expect(recordPayment(fakeDb([lastCa]), 1, input)).rejects.toThrow(/chưa học xong/)
  })

  it("đúng giờ kết thúc ca cuối → cho ghi", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-28T11:30:00Z") })
    await expect(recordPayment(fakeDb([lastCa]), 1, input)).rejects.toThrow("PASSED_GUARD")
  })

  it("ca cuối bị huỷ, ca còn lại chưa xong → chặn", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-28T11:30:00Z") })
    const later = { ...lastCa, sessionDate: new Date("2026-10-30T00:00:00Z") }
    await expect(recordPayment(fakeDb([lastCa, later]), 1, input)).rejects.toThrow(/chưa học xong/)
    await expect(recordPayment(fakeDb([lastCa, { ...later, status: "cancelled" }]), 1, input)).rejects.toThrow("PASSED_GUARD")
  })

  it("HS không có ca trong tháng hiện tại → chặn", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-30T05:00:00Z") })
    await expect(recordPayment(fakeDb([]), 1, input)).rejects.toThrow(/chưa học xong/)
  })
})
