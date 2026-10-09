/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PaidReturnContent } from "@/components/parent/PaidReturnContent"

describe("PaidReturnContent: trang payOS đưa phụ huynh về", () => {
  it("báo giáo viên tự nhận được, không cần báo lại", () => {
    render(<LanguageProvider forcedLanguage="vi"><PaidReturnContent /></LanguageProvider>)
    expect(screen.getByRole("heading", { name: "Đã xong bước thanh toán" })).toBeTruthy()
    expect(screen.getByText(/giáo viên sẽ tự nhận được, không cần báo lại/)).toBeTruthy()
  })
})
