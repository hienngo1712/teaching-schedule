import { describe, it, expect } from "vitest"
import { paymentSummaryLine, remainingToFill, vnTodayIso } from "@/lib/payment-summary"

describe("paymentSummaryLine", () => {
  it("còn thiếu → remaining", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 300000, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 200000,
    })
  })

  it("trả đủ → remaining 0", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 500000, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 0,
    })
  })

  it("trả dư khi có nợ → overpaid", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 700000, isFullPaid: false })).toEqual({
      kind: "overpaid",
      amount: 200000,
    })
  })

  it("tháng có tín dụng (tổng phải đóng ≤ 0) → remaining 0, không coi là trả dư", () => {
    expect(paymentSummaryLine({ totalAmountDue: -50000, paidAmount: 0, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 0,
    })
    expect(paymentSummaryLine({ totalAmountDue: 0, paidAmount: 10000, isFullPaid: false })).toEqual({
      kind: "remaining",
      amount: 0,
    })
  })

  it("đã tất toán mà còn thiếu → waived", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 300000, isFullPaid: true })).toEqual({
      kind: "waived",
      amount: 200000,
    })
  })

  it("đã tất toán và trả đủ → remaining 0", () => {
    expect(paymentSummaryLine({ totalAmountDue: 500000, paidAmount: 500000, isFullPaid: true })).toEqual({
      kind: "remaining",
      amount: 0,
    })
  })
})

describe("remainingToFill", () => {
  it("thêm mới: phần còn thiếu", () => {
    expect(remainingToFill(500000, 300000)).toBe(200000)
  })

  it("đã đủ, đã dư, hoặc có tín dụng → 0", () => {
    expect(remainingToFill(500000, 500000)).toBe(0)
    expect(remainingToFill(500000, 700000)).toBe(0)
    expect(remainingToFill(-50000, 0)).toBe(0)
  })

  it("khi sửa: bỏ số cũ của chính lần đang sửa ra khỏi số đã trả", () => {
    // Đã trả 700k (gồm lần đang sửa 400k) cho tổng 500k → điền 200k để vừa đủ.
    expect(remainingToFill(500000, 700000, 400000)).toBe(200000)
  })
})

describe("vnTodayIso", () => {
  it("dùng giờ VN (UTC+7), không dùng giờ UTC của máy", () => {
    // 2026-05-31T18:30Z = 01:30 ngày 01/06 giờ VN
    expect(vnTodayIso(new Date("2026-05-31T18:30:00Z"))).toBe("2026-06-01")
    expect(vnTodayIso(new Date("2026-01-05T03:00:00Z"))).toBe("2026-01-05")
  })
})
