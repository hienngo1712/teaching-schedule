/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TourButton } from "@/components/tour/TourButton"

afterEach(cleanup)

describe("TourButton", () => {
  it("link tới trang có ?tour=, chữ Chỉ cho tôi", () => {
    render(<LanguageProvider forcedLanguage="vi"><TourButton id="tuition" /></LanguageProvider>)
    const link = screen.getByRole("link", { name: "Chỉ cho tôi" })
    expect(link.getAttribute("href")).toBe("/tuition?tour=tuition")
    expect(link.getAttribute("data-testid")).toBe("tour-button-tuition")
  })
})
