import { describe, it, expect } from "vitest"
import { dueNow, getRowStatus, isInProgressMonth, isProvisional, noticeAgeDays, type DisplayRow } from "@/lib/tuition-display"

const base: DisplayRow = { previousBalance: 0, totalExpected: 0, totalAmountDue: 0, paidAmount: 0, isFullPaid: false, billingMode: "per_session", inProgress: false }
const NOW = new Date("2026-10-13T05:00:00Z") // 13/10 giờ VN

describe("tuition-display (spec Y §3.4, §3.5)", () => {
  it("isInProgressMonth: tháng hiện tại và tương lai = đang học", () => {
    expect(isInProgressMonth(2026, 10, NOW)).toBe(true)
    expect(isInProgressMonth(2026, 11, NOW)).toBe(true)
    expect(isInProgressMonth(2026, 9, NOW)).toBe(false)
  })
  it("tháng đã kết thúc: cần đóng = tổng − đã đóng", () => {
    expect(dueNow({ ...base, previousBalance: 200_000, totalExpected: 600_000, totalAmountDue: 800_000, paidAmount: 300_000 })).toBe(500_000)
  })
  it("tháng đang học, theo buổi: không cộng tiền tạm tính", () => {
    const r = { ...base, inProgress: true, previousBalance: 800_000, totalExpected: 300_000, totalAmountDue: 1_100_000 }
    expect(isProvisional(r)).toBe(true)
    expect(dueNow(r)).toBe(800_000)
    expect(dueNow({ ...r, paidAmount: 800_000 })).toBe(0)
  })
  it("tháng đang học, trọn tháng: cộng cả tháng", () => {
    const r = { ...base, inProgress: true, billingMode: "monthly" as const, previousBalance: 0, totalExpected: 400_000, totalAmountDue: 400_000 }
    expect(isProvisional(r)).toBe(false)
    expect(dueNow(r)).toBe(400_000)
  })
  it("đã miễn → 0; trả trước (âm) → 0", () => {
    expect(dueNow({ ...base, totalAmountDue: 500_000, isFullPaid: true })).toBe(0)
    expect(dueNow({ ...base, totalAmountDue: -100_000 })).toBe(0)
  })
  it("trạng thái tháng đang học: hết nợ cũ → Đã đóng đủ; chưa có gì phải đóng → in_progress", () => {
    const r = { ...base, inProgress: true, previousBalance: 800_000, totalExpected: 300_000, totalAmountDue: 1_100_000 }
    expect(getRowStatus(r)).toBe("unpaid")
    expect(getRowStatus({ ...r, paidAmount: 800_000 })).toBe("fully_paid")
    expect(getRowStatus({ ...r, previousBalance: 0, totalAmountDue: 300_000 })).toBe("in_progress")
  })
  it("noticeAgeDays theo ngày VN", () => {
    expect(noticeAgeDays(new Date("2026-10-05T03:00:00Z"), NOW)).toBe(8)
    expect(noticeAgeDays(new Date("2026-10-12T18:00:00Z"), NOW)).toBe(0) // 13/10 01:00 giờ VN
  })
})
