/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { BankSelect } from "@/components/settings/BankSelect"

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe("BankSelect — combobox tìm ngân hàng (spec S2)", () => {
  it("value='970436' → nút role='combobox' tên 'Ngân hàng' hiện Vietcombank", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <label htmlFor="bank-bin">Ngân hàng</label>
        <BankSelect id="bank-bin" value="970436" onChange={() => {}} placeholder="Chọn ngân hàng" />
      </LanguageProvider>
    )

    const btn = screen.getByRole("combobox", { name: "Ngân hàng" })
    expect(btn.textContent).toContain("Vietcombank - ")
  })

  it("bấm nút → gõ vcb → chỉ 1 option Vietcombank → Enter gọi onChange('970436')", () => {
    const onChange = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <label htmlFor="bank-bin">Ngân hàng</label>
        <BankSelect id="bank-bin" value="" onChange={onChange} placeholder="Chọn ngân hàng" />
      </LanguageProvider>
    )

    const btn = screen.getByRole("combobox", { name: "Ngân hàng" })
    fireEvent.click(btn)

    const searchInput = screen.getByPlaceholderText("Tìm ngân hàng…")
    fireEvent.change(searchInput, { target: { value: "vcb" } })

    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain("Vietcombank")

    fireEvent.keyDown(searchInput, { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith("970436")
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("gõ 'zzz' → hiện 'Không tìm thấy ngân hàng'", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <label htmlFor="bank-bin">Ngân hàng</label>
        <BankSelect id="bank-bin" value="" onChange={() => {}} placeholder="Chọn ngân hàng" />
      </LanguageProvider>
    )

    fireEvent.click(screen.getByRole("combobox", { name: "Ngân hàng" }))
    const searchInput = screen.getByPlaceholderText("Tìm ngân hàng…")
    fireEvent.change(searchInput, { target: { value: "zzz" } })

    expect(screen.getByText("Không tìm thấy ngân hàng")).toBeDefined()
    expect(screen.queryByRole("option")).toBeNull()
  })

  it("↓ Enter chọn dòng thứ 2 của danh sách", () => {
    const onChange = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <label htmlFor="bank-bin">Ngân hàng</label>
        <BankSelect id="bank-bin" value="" onChange={onChange} placeholder="Chọn ngân hàng" />
      </LanguageProvider>
    )

    fireEvent.click(screen.getByRole("combobox", { name: "Ngân hàng" }))
    const searchInput = screen.getByPlaceholderText("Tìm ngân hàng…")

    // Dòng 0 mặc định là Vietcombank (index 0), ấn ArrowDown chuyển sang dòng 1 (VietinBank 970415)
    fireEvent.keyDown(searchInput, { key: "ArrowDown" })
    fireEvent.keyDown(searchInput, { key: "Enter" })

    expect(onChange).toHaveBeenCalledWith("970415")
  })

  it("Esc đóng danh sách không đổi giá trị", () => {
    const onChange = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <label htmlFor="bank-bin">Ngân hàng</label>
        <BankSelect id="bank-bin" value="" onChange={onChange} placeholder="Chọn ngân hàng" />
      </LanguageProvider>
    )

    fireEvent.click(screen.getByRole("combobox", { name: "Ngân hàng" }))
    expect(screen.getByRole("listbox")).toBeDefined()

    const searchInput = screen.getByPlaceholderText("Tìm ngân hàng…")
    fireEvent.keyDown(searchInput, { key: "Escape" })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  // Review S M3: tìm → Esc → mở lại → Enter phải giữ ngân hàng đã chọn, không nhảy sang dòng khác.
  it("đã chọn VietinBank, tìm 'vietin' rồi Esc, mở lại Enter → vẫn VietinBank", () => {
    const onChange = vi.fn()
    render(
      <LanguageProvider forcedLanguage="vi">
        <label htmlFor="bank-bin">Ngân hàng</label>
        <BankSelect id="bank-bin" value="970415" onChange={onChange} placeholder="Chọn ngân hàng" />
      </LanguageProvider>
    )
    const btn = screen.getByRole("combobox", { name: "Ngân hàng" })
    fireEvent.click(btn)
    fireEvent.change(screen.getByPlaceholderText("Tìm ngân hàng…"), { target: { value: "vietin" } })
    fireEvent.keyDown(screen.getByPlaceholderText("Tìm ngân hàng…"), { key: "Escape" })
    fireEvent.click(screen.getByRole("combobox", { name: "Ngân hàng" }))
    fireEvent.keyDown(screen.getByPlaceholderText("Tìm ngân hàng…"), { key: "Enter" })
    expect(onChange).toHaveBeenLastCalledWith("970415")
  })
})
