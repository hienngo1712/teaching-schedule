import { describe, it, expect, vi, afterEach } from "vitest"

// Ca biên bổ sung cho spec AS (QA): mốc ca cuối theo giờ VN, tháng 12 → 1, nhiều ca cùng ngày, ca huỷ sau ca cuối.
const h = vi.hoisted(() => ({ ensure: vi.fn(async () => { throw new Error("PASSED_GUARD") }) }))
vi.mock("@/server/services/tuition.service", () => ({ ensureMonthlyTuition: h.ensure, loadMonthLedgers: vi.fn() }))

import type { PrismaClient } from "@prisma/client"
import { isInProgressMonth, lastSessionEnd } from "@/lib/tuition-display"
import { recordPayment } from "@/server/services/payment.service"
import { anchorMonth } from "@/server/services/tuition-paylink.service"

// Cách DB trả về: sessionDate = 0h UTC của ngày VN, endTime = giờ VN trên ngày 1970-01-01 UTC
const ca = (date: string, end: string, extra: Partial<{ status: string; isDeleted: boolean }> = {}) => ({
  sessionDate: new Date(`${date}T00:00:00Z`),
  endTime: new Date(`1970-01-01T${end}:00Z`),
  status: "scheduled",
  isDeleted: false,
  ...extra,
})

describe("spec AS — ca biên mốc ca cuối", () => {
  it("đúng 18:30:00 VN là xong, 18:29:59.999 còn đang học", () => {
    const end = lastSessionEnd([ca("2026-10-28", "18:30")])
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-28T11:29:59.999Z"))).toBe(true)
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-28T11:30:00.000Z"))).toBe(false)
  })

  it("ca kết thúc 23:59 ngày cuối tháng: xong lúc 23:59 VN, trước đó còn đang học", () => {
    const end = lastSessionEnd([ca("2026-10-31", "23:59")])
    expect(end?.toISOString()).toBe("2026-10-31T16:59:00.000Z")
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-31T16:58:59Z"))).toBe(true)
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-31T16:59:00Z"))).toBe(false)
    // 1/11 0:00 VN: tháng 10 thành quá khứ
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-31T17:00:00Z"))).toBe(false)
  })

  it("tháng 12 → 1: ca cuối 31/12 22:00 VN, sang 1/1 VN thì tháng 12 là quá khứ, tháng 1 mới bắt đầu", () => {
    const end = lastSessionEnd([ca("2026-12-31", "22:00")])
    expect(end?.toISOString()).toBe("2026-12-31T15:00:00.000Z")
    expect(isInProgressMonth(2026, 12, end, new Date("2026-12-31T14:59:00Z"))).toBe(true)
    expect(isInProgressMonth(2026, 12, end, new Date("2026-12-31T15:00:00Z"))).toBe(false)
    const newYear = new Date("2026-12-31T17:00:00Z") // 1/1/2027 0:00 VN
    expect(isInProgressMonth(2026, 12, null, newYear)).toBe(false)
    expect(isInProgressMonth(2027, 1, null, newYear)).toBe(true)
  })

  it("nhiều ca cùng ngày, thứ tự lộn xộn: lấy ca kết thúc muộn nhất", () => {
    const end = lastSessionEnd([ca("2026-10-28", "09:30"), ca("2026-10-28", "18:30"), ca("2026-10-28", "15:30"), ca("2026-10-05", "21:00")])
    expect(end?.toISOString()).toBe("2026-10-28T11:30:00.000Z")
  })

  it("ca huỷ / đã xoá nằm sau ca cuối thật (cùng ngày và ngày sau) bị bỏ qua", () => {
    const end = lastSessionEnd([
      ca("2026-10-28", "20:00", { status: "cancelled" }),
      ca("2026-10-28", "18:30"),
      ca("2026-10-29", "10:00", { isDeleted: true }),
      ca("2026-10-30", "10:00", { status: "cancelled", isDeleted: true }),
    ])
    expect(end?.toISOString()).toBe("2026-10-28T11:30:00.000Z")
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-28T11:30:00Z"))).toBe(false)
  })

  it("ca 'completed' vẫn được tính như ca thường", () => {
    expect(lastSessionEnd([ca("2026-10-28", "18:30", { status: "completed" })])?.toISOString()).toBe("2026-10-28T11:30:00.000Z")
  })

  it("anchorMonth: tháng 1 đang học neo về 12 năm trước; đã xong giữ tháng 1", () => {
    expect(anchorMonth(2027, 1, true)).toEqual({ year: 2026, month: 12 })
    expect(anchorMonth(2027, 1, false)).toEqual({ year: 2027, month: 1 })
  })
})

describe("spec AS — recordPayment truy vấn ca đúng phạm vi", () => {
  afterEach(() => vi.useRealTimers())

  it("tháng 12: lọc theo userId, HS, khoảng [1/12, 1/1 năm sau); ca cuối đã xong thì cho ghi", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-12-31T15:00:00Z") }) // 31/12 22:00 VN
    const findMany = vi.fn(async () => [ca("2026-12-31", "22:00")])
    const db = { teachingSession: { findMany } } as unknown as PrismaClient
    await expect(recordPayment(db, 42, { studentId: 7, year: 2026, month: 12, amount: 100_000 })).rejects.toThrow("PASSED_GUARD")
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 42,
          sessionDate: { gte: new Date("2026-12-01T00:00:00Z"), lt: new Date("2027-01-01T00:00:00Z") },
          sessionStudents: { some: { studentId: 7 } },
        },
      })
    )
  })

  it("tháng quá khứ: luôn cho ghi dù không có ca", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-28T05:00:00Z") })
    const db = { teachingSession: { findMany: vi.fn(async () => []) } } as unknown as PrismaClient
    await expect(recordPayment(db, 1, { studentId: 1, year: 2026, month: 9, amount: 100_000 })).rejects.toThrow("PASSED_GUARD")
  })

  it("tháng tương lai: luôn chặn dù ca 'cuối' đã qua (dữ liệu bất thường)", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-28T05:00:00Z") })
    const db = { teachingSession: { findMany: vi.fn(async () => [ca("2026-11-01", "06:00")]) } } as unknown as PrismaClient
    await expect(recordPayment(db, 1, { studentId: 1, year: 2026, month: 11, amount: 100_000 })).rejects.toThrow(/chưa học xong/)
  })
})
