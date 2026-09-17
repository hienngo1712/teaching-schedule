import { describe, it, expect } from "vitest"
import { getTuitionBadgeStatus, type TuitionStatusInput } from "@/lib/tuition-status"

function item(over: Partial<TuitionStatusInput> = {}): TuitionStatusInput {
  return {
    paidAmount: 0,
    isFullPaid: false,
    totalExpected: 0,
    previousBalance: 0,
    totalAmountDue: 0,
    ...over,
  }
}

describe("getTuitionBadgeStatus", () => {
  it("chưa có buổi nào & không nợ → no_sessions", () => {
    expect(getTuitionBadgeStatus(item())).toBe("no_sessions")
  })

  it("có nợ, chưa đóng đồng nào → unpaid", () => {
    expect(
      getTuitionBadgeStatus(item({ totalExpected: 200000, totalAmountDue: 200000 }))
    ).toBe("unpaid")
  })

  it("đóng một phần → partial", () => {
    expect(
      getTuitionBadgeStatus(
        item({ paidAmount: 50000, totalExpected: 200000, totalAmountDue: 200000 })
      )
    ).toBe("partial")
  })

  // Đây là nhánh mà bản chép ở StudentScheduleView bị THIẾU: HS đã trả đủ tổng nợ
  // nhưng GV chưa tick "tất toán" → trang Học phí hiện "Đóng đủ", màn Báo cáo
  // trước đây lại hiện "Đóng một phần".
  it("trả đủ tổng nợ nhưng CHƯA tick tất toán → vẫn là fully_paid", () => {
    expect(
      getTuitionBadgeStatus(
        item({ paidAmount: 200000, totalExpected: 200000, totalAmountDue: 200000 })
      )
    ).toBe("fully_paid")
  })

  it("đã tick tất toán, tiền khớp → fully_paid", () => {
    expect(
      getTuitionBadgeStatus(
        item({ paidAmount: 200000, isFullPaid: true, totalExpected: 200000, totalAmountDue: 200000 })
      )
    ).toBe("fully_paid")
  })

  it("đã tick tất toán nhưng tiền thực đóng thiếu → settled_waived (miễn/giảm)", () => {
    expect(
      getTuitionBadgeStatus(
        item({ paidAmount: 150000, isFullPaid: true, totalExpected: 200000, totalAmountDue: 200000 })
      )
    ).toBe("settled_waived")
  })

  it("trả nhiều hơn tổng nợ → overpaid, ưu tiên hơn fully_paid", () => {
    expect(
      getTuitionBadgeStatus(
        item({ paidAmount: 250000, totalExpected: 200000, totalAmountDue: 200000 })
      )
    ).toBe("overpaid")
  })

  it("đóng đủ tháng này nhưng còn nợ cũ → paid_this_month", () => {
    expect(
      getTuitionBadgeStatus(
        item({ paidAmount: 200000, totalExpected: 200000, previousBalance: 100000, totalAmountDue: 300000 })
      )
    ).toBe("paid_this_month")
  })

  it("còn credit tháng trước (nợ âm), chưa đóng gì → no_sessions, không phải unpaid", () => {
    expect(
      getTuitionBadgeStatus(item({ previousBalance: -50000, totalAmountDue: -50000 }))
    ).toBe("no_sessions")
  })
})
