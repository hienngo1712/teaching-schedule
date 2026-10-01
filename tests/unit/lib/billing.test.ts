import { describe, it, expect } from "vitest"
import {
  monthKey,
  resolveBilling,
  monthFee,
  revenueForMonth,
  PER_SESSION,
  type BillingChange,
} from "@/lib/billing"

describe("billing library (spec T)", () => {
  it("monthKey tính đúng khóa tháng", () => {
    expect(monthKey(2026, 1)).toBe(2026 * 12)
    expect(monthKey(2026, 12) - monthKey(2026, 1)).toBe(11)
  })

  it("resolveBilling tìm đúng cách thu theo khóa tháng", () => {
    expect(resolveBilling([], monthKey(2026, 5))).toEqual(PER_SESSION)

    const k10 = monthKey(2026, 10)
    const changes: BillingChange[] = [
      { fromKey: k10, mode: "per_session", monthlyFee: 0 },
      { fromKey: 0, mode: "monthly", monthlyFee: 400_000 },
    ]

    // Tháng 9 áp dụng dòng fromKey = 0 (monthly 400k)
    expect(resolveBilling(changes, monthKey(2026, 9))).toEqual({
      mode: "monthly",
      monthlyFee: 400_000,
    })

    // Tháng 10 và 11 áp dụng dòng fromKey = k10 (per_session 0)
    expect(resolveBilling(changes, monthKey(2026, 10))).toEqual({
      mode: "per_session",
      monthlyFee: 0,
    })
    expect(resolveBilling(changes, monthKey(2026, 11))).toEqual({
      mode: "per_session",
      monthlyFee: 0,
    })
  })

  it("monthFee tính phí tháng đúng theo cách thu", () => {
    const monthlyBilling = { mode: "monthly" as const, monthlyFee: 400_000 }

    // Trọn tháng: không có ca -> 0đ
    expect(monthFee(monthlyBilling, [])).toBe(0)

    // Trọn tháng: có 1 ca vắng -> vẫn 400k
    expect(monthFee(monthlyBilling, [{ attendance: "absent", fee: 50_000 }])).toBe(400_000)

    // Trọn tháng: có 2 ca có mặt -> vẫn 400k
    expect(
      monthFee(monthlyBilling, [
        { attendance: "present", fee: 50_000 },
        { attendance: "present", fee: 50_000 },
      ])
    ).toBe(400_000)

    // Theo buổi: chỉ tính có mặt + đi muộn
    expect(
      monthFee(PER_SESSION, [
        { attendance: "present", fee: 50_000 },
        { attendance: "late", fee: 50_000 },
        { attendance: "absent", fee: 50_000 },
        { attendance: "pending", fee: 50_000 },
      ])
    ).toBe(100_000)
  })

  it("revenueForMonth tính dự kiến và thực tế đúng", () => {
    const monthlyBilling = { mode: "monthly" as const, monthlyFee: 400_000 }

    // Trọn tháng rỗng -> { 0, 0 }
    expect(revenueForMonth(monthlyBilling, [])).toEqual({ expected: 0, earned: 0 })

    // Trọn tháng chỉ có ca pending -> expected: 400k, earned: 0
    expect(
      revenueForMonth(monthlyBilling, [{ attendance: "pending", fee: 50_000 }])
    ).toEqual({ expected: 400_000, earned: 0 })

    // Trọn tháng có ca absent (đã điểm danh) -> expected: 400k, earned: 400k
    expect(
      revenueForMonth(monthlyBilling, [
        { attendance: "pending", fee: 50_000 },
        { attendance: "absent", fee: 50_000 },
      ])
    ).toEqual({ expected: 400_000, earned: 400_000 })

    // Theo buổi: expected = tổng fee, earned = fee có mặt/muộn
    expect(
      revenueForMonth(PER_SESSION, [
        { attendance: "present", fee: 50_000 },
        { attendance: "pending", fee: 50_000 },
      ])
    ).toEqual({ expected: 100_000, earned: 50_000 })
  })
})
