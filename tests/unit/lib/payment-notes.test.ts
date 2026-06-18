import { describe, it, expect } from "vitest"
import { mergeOverpaidNote } from "@/lib/payment-notes"

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
