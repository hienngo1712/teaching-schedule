import { describe, it, expect } from "vitest"
import { allocatePayment, keyToYearMonth, type MonthLedger } from "@/lib/payment-allocation"
import { monthKey } from "@/lib/billing"

const k = (m: number) => monthKey(2026, m)
const L = (m: number, fee: number, paid = 0, fullPaid = false): MonthLedger => ({ key: k(m), fee, paid, fullPaid })

describe("allocatePayment (spec Y §3.2)", () => {
  it("trả tháng cũ nhất trước: nợ T8 200k + T9 600k, đưa 500k → T8 200k, T9 300k", () => {
    expect(allocatePayment([L(8, 200_000), L(9, 600_000)], 500_000)).toEqual([
      { key: k(8), amount: 200_000 }, { key: k(9), amount: 300_000 },
    ])
  })
  it("đóng đủ đúng số → không dư", () => {
    expect(allocatePayment([L(9, 800_000)], 800_000)).toEqual([{ key: k(9), amount: 800_000 }])
  })
  it("đóng dư → phần dư vào tháng cuối danh sách (tháng đang xem)", () => {
    expect(allocatePayment([L(9, 800_000), L(10, 300_000)], 1_200_000)).toEqual([
      { key: k(9), amount: 800_000 }, { key: k(10), amount: 400_000 },
    ])
  })
  it("tháng đã trả một phần chỉ nhận phần còn thiếu", () => {
    expect(allocatePayment([L(9, 800_000, 500_000), L(10, 300_000)], 300_000)).toEqual([{ key: k(9), amount: 300_000 }])
  })
  it("tháng đã miễn (fullPaid) bị bỏ qua", () => {
    expect(allocatePayment([L(8, 200_000, 0, true), L(9, 600_000)], 600_000)).toEqual([{ key: k(9), amount: 600_000 }])
  })
  it("trả trước (credit) tháng trước trừ vào tháng sau", () => {
    // T9 trả dư 100k → T10 chỉ còn 200k thiếu.
    expect(allocatePayment([L(9, 800_000, 900_000), L(10, 300_000)], 200_000)).toEqual([{ key: k(10), amount: 200_000 }])
  })
  it("không có nợ → toàn bộ vào tháng cuối", () => {
    expect(allocatePayment([L(9, 0), L(10, 0)], 100_000)).toEqual([{ key: k(10), amount: 100_000 }])
  })
  it("số tiền ≤ 0 hoặc danh sách rỗng → ném lỗi", () => {
    expect(() => allocatePayment([L(9, 100)], 0)).toThrow()
    expect(() => allocatePayment([], 100)).toThrow()
  })
  it("keyToYearMonth đảo monthKey", () => {
    expect(keyToYearMonth(monthKey(2026, 1))).toEqual({ year: 2026, month: 1 })
    expect(keyToYearMonth(monthKey(2025, 12))).toEqual({ year: 2025, month: 12 })
  })
})
