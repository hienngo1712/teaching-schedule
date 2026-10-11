// Spec AM §3: hàm thuần tính công / thu nhập nơi dạy theo ca/giờ.
import { describe, it, expect } from "vitest"
import { classifySession, computeIncome, incomeStatus, resolveRate, sessionHours } from "@/server/services/timesheet.service"
import { monthKey } from "@/lib/billing"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe("sessionHours", () => {
  it("90 phút = 1.5 giờ; làm tròn 2 chữ số", () => {
    expect(sessionHours(time("08:00"), time("09:30"))).toBe(1.5)
    expect(sessionHours(time("08:00"), time("08:40"))).toBe(0.67)
  })
  it("[RF 1] giờ kết thúc ≤ giờ bắt đầu (dữ liệu lạ, 23:30–00:30) → 0, không âm", () => {
    expect(sessionHours(time("23:30"), time("00:30"))).toBe(0)
    expect(sessionHours(time("10:00"), time("10:00"))).toBe(0)
  })
})

describe("classifySession", () => {
  const today = "2026-10-11"
  it("ranh giới hôm nay: ca hôm nay đã dạy, ca mai sắp dạy", () => {
    expect(classifySession({ status: "scheduled", sessionDate: day("2026-10-11") }, today)).toBe("done")
    expect(classifySession({ status: "completed", sessionDate: day("2026-10-10") }, today)).toBe("done")
    expect(classifySession({ status: "scheduled", sessionDate: day("2026-10-12") }, today)).toBe("upcoming")
  })
  it("ca huỷ luôn là cancelled (cả ca đã qua lẫn ca tương lai)", () => {
    expect(classifySession({ status: "cancelled", sessionDate: day("2026-10-01") }, today)).toBe("cancelled")
    expect(classifySession({ status: "cancelled", sessionDate: day("2026-10-20") }, today)).toBe("cancelled")
  })
})

describe("resolveRate", () => {
  const changes = [
    { fromKey: monthKey(2026, 9), unit: "hour", amount: 185000 },
    { fromKey: monthKey(2026, 11), unit: "session", amount: 250000 },
  ]
  it("không có dòng hoặc chưa tới tháng hiệu lực → null", () => {
    expect(resolveRate([], monthKey(2026, 10))).toBeNull()
    expect(resolveRate(changes, monthKey(2026, 8))).toBeNull()
  })
  it("đổi giá: theo tháng (fromKey), mức có hiệu lực tại tháng", () => {
    expect(resolveRate(changes, monthKey(2026, 10))).toEqual({ unit: "hour", amount: 185000 })
    expect(resolveRate(changes, monthKey(2026, 11))).toEqual({ unit: "session", amount: 250000 })
  })
  it("amount = 0 → chưa có đơn giá (null)", () => {
    expect(resolveRate([{ fromKey: 0, unit: "session", amount: 0 }], monthKey(2026, 10))).toBeNull()
  })
})

describe("computeIncome", () => {
  it("không có đơn giá → null", () => {
    expect(computeIncome({ doneCount: 2, doneHours: 3, rate: null })).toBeNull()
  })
  it("theo ca = số ca × đơn giá", () => {
    expect(computeIncome({ doneCount: 4, doneHours: 6, rate: { unit: "session", amount: 200000 } })).toBe(800000)
  })
  it("theo giờ = round(giờ × đơn giá)", () => {
    expect(computeIncome({ doneCount: 2, doneHours: 3, rate: { unit: "hour", amount: 185000 } })).toBe(555000)
    expect(computeIncome({ doneCount: 1, doneHours: 0.67, rate: { unit: "hour", amount: 100001 } })).toBe(67001)
  })
})

describe("incomeStatus", () => {
  it("chưa có đơn giá → none", () => {
    expect(incomeStatus(null, 0)).toBe("none")
    expect(incomeStatus(null, 100000)).toBe("none")
  })
  it("chưa nhận / một phần / đủ / nhận dư (dư tính ở UI) → paid", () => {
    expect(incomeStatus(555000, 0)).toBe("unpaid")
    expect(incomeStatus(555000, 500000)).toBe("partial")
    expect(incomeStatus(555000, 555000)).toBe("paid")
    expect(incomeStatus(555000, 600000)).toBe("paid")
  })
  it("dự kiến 0 (có giá nhưng chưa dạy ca nào) → không phải 'đủ'", () => {
    expect(incomeStatus(0, 0)).toBe("unpaid")
  })
})
