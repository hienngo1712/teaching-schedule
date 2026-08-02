import { describe, it, expect } from "vitest"
import { buildPaymentAuditNote, formatVnDate, mergeOverpaidNote } from "@/lib/payment-notes"

describe("mergeOverpaidNote", () => {
  it("thêm auto-note vào ghi chú của user khi lần đầu trả dư", () => {
    const result = mergeOverpaidNote({
      rawNotes: "Ghi chú của phụ huynh",
      prevAutoNote: "",
      autoNote: "Trả dư 50.000đ",
    })
    expect(result).toBe("Ghi chú của phụ huynh\nTrả dư 50.000đ")
  })

  it("thêm auto-note khi ghi chú đang rỗng", () => {
    expect(mergeOverpaidNote({ rawNotes: "", prevAutoNote: "", autoNote: "Trả dư 50.000đ" })).toBe(
      "Trả dư 50.000đ"
    )
  })

  it("KHÔNG nhân đôi khi đổi ngôn ngữ: thay auto-note cũ bằng cái mới", () => {
    const result = mergeOverpaidNote({
      rawNotes: "Ghi chú\nOverpaid 50,000đ", // auto-note tiếng Anh đã chèn trước đó
      prevAutoNote: "Overpaid 50,000đ",
      autoNote: "Trả dư 50.000đ", // ngôn ngữ mới
    })
    expect(result).toBe("Ghi chú\nTrả dư 50.000đ")
    expect(result.split("\n").filter((l) => l.includes("dư") || l.includes("Overpaid"))).toHaveLength(1)
  })

  it("GỠ auto-note khi không còn trả dư (autoNote rỗng)", () => {
    expect(
      mergeOverpaidNote({ rawNotes: "Ghi chú\nTrả dư 50.000đ", prevAutoNote: "Trả dư 50.000đ", autoNote: "" })
    ).toBe("Ghi chú")
  })

  it("cập nhật số tiền dư khi auto-note thay đổi", () => {
    expect(
      mergeOverpaidNote({ rawNotes: "Trả dư 50.000đ", prevAutoNote: "Trả dư 50.000đ", autoNote: "Trả dư 80.000đ" })
    ).toBe("Trả dư 80.000đ")
  })

  it("không có gì để gỡ và không trả dư → giữ nguyên ghi chú user", () => {
    expect(mergeOverpaidNote({ rawNotes: "Ghi chú", prevAutoNote: "", autoNote: "" })).toBe("Ghi chú")
  })
})

describe("formatVnDate", () => {
  it("đổi sang ngày theo giờ VN (UTC+7), không dùng giờ server", () => {
    // 2026-08-01T18:30:00Z = 01:30 ngày 02/08 giờ VN
    expect(formatVnDate(new Date("2026-08-01T18:30:00Z"))).toBe("02/08/2026")
  })
})

describe("buildPaymentAuditNote", () => {
  const now = new Date("2026-08-02T03:00:00Z")

  it("KHÔNG ghi vết lần ghi nhận đầu tiên (0 → 500k)", () => {
    expect(
      buildPaymentAuditNote({
        notes: "Phụ huynh chuyển khoản",
        prevPaidAmount: 0,
        nextPaidAmount: 500000,
        prevIsFullPaid: false,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("Phụ huynh chuyển khoản")
  })

  it("ghi vết khi HỦY (500k → 0)", () => {
    expect(
      buildPaymentAuditNote({
        notes: "",
        prevPaidAmount: 500000,
        nextPaidAmount: 0,
        prevIsFullPaid: false,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("[02/08/2026] Hủy ghi nhận thanh toán: 500.000 đ → 0 đ")
  })

  it("ghi vết khi SỬA số tiền (500k → 300k), nối tiếp ghi chú cũ", () => {
    expect(
      buildPaymentAuditNote({
        notes: "Ghi chú cũ",
        prevPaidAmount: 500000,
        nextPaidAmount: 300000,
        prevIsFullPaid: false,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("Ghi chú cũ\n[02/08/2026] Sửa số tiền đã đóng: 500.000 đ → 300.000 đ")
  })

  it("ghi vết khi bỏ đánh dấu tất toán dù số tiền không đổi", () => {
    expect(
      buildPaymentAuditNote({
        notes: "",
        prevPaidAmount: 300000,
        nextPaidAmount: 300000,
        prevIsFullPaid: true,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("[02/08/2026] Bỏ đánh dấu tất toán")
  })

  it("gộp cả hai thay đổi vào MỘT dòng", () => {
    expect(
      buildPaymentAuditNote({
        notes: "",
        prevPaidAmount: 500000,
        nextPaidAmount: 0,
        prevIsFullPaid: true,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("[02/08/2026] Hủy ghi nhận thanh toán: 500.000 đ → 0 đ; bỏ đánh dấu tất toán")
  })

  it("không ghi gì khi không có thay đổi", () => {
    expect(
      buildPaymentAuditNote({
        notes: "Giữ nguyên",
        prevPaidAmount: 300000,
        nextPaidAmount: 300000,
        prevIsFullPaid: true,
        nextIsFullPaid: true,
        now,
      })
    ).toBe("Giữ nguyên")
  })
})
