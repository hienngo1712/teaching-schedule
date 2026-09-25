import { describe, it, expect } from "vitest"
import { noticeFeePerSession, noticePaymentState } from "@/lib/tuition-notice"

const qr = {
  payload: "x",
  bankShortName: "Vietcombank",
  accountNumber: "1",
  accountName: "A",
  amount: 1,
  content: "HP",
}
const base = { remaining: 0, qr: null, isFullPaid: false, totalAmountDue: 100000, paidAmount: 100000 }

describe("noticeFeePerSession", () => {
  it("không có buổi → null", () => {
    expect(noticeFeePerSession([])).toBeNull()
  })
  it("mọi buổi cùng phí → phí đó", () => {
    expect(noticeFeePerSession([{ fee: 100000 }, { fee: 100000 }])).toBe(100000)
  })
  it("phí khác nhau → null (ghi phí từng ngày)", () => {
    expect(noticeFeePerSession([{ fee: 100000 }, { fee: 120000 }])).toBeNull()
  })
})

describe("noticePaymentState", () => {
  it("còn nợ + có QR → qr", () => {
    expect(noticePaymentState({ ...base, remaining: 50000, qr, paidAmount: 50000 })).toBe("qr")
  })
  it("còn nợ, chưa cài ngân hàng → none", () => {
    expect(noticePaymentState({ ...base, remaining: 50000, paidAmount: 50000 })).toBe("none")
  })
  it("tất toán khi còn thiếu → settled", () => {
    expect(noticePaymentState({ ...base, isFullPaid: true, paidAmount: 40000 })).toBe("settled")
  })
  it("trả đủ hoặc dư (kể cả đã tick tất toán) → paid", () => {
    expect(noticePaymentState(base)).toBe("paid")
    expect(noticePaymentState({ ...base, paidAmount: 150000 })).toBe("paid")
    expect(noticePaymentState({ ...base, isFullPaid: true })).toBe("paid")
  })
  it("tổng âm (dư tháng trước lớn) → paid", () => {
    expect(noticePaymentState({ ...base, totalAmountDue: -50000, paidAmount: 0 })).toBe("paid")
  })
})
