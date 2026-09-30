/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { FilterBar } from "@/components/common/FilterBar"

describe("FilterBar — dồn trái trên desktop (spec S1)", () => {
  it("nhóm desktop không có md:ml-auto, wrapper ô tìm md:w-72 không có md:max-w-xs, container có flex-wrap", () => {
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <FilterBar
          search={{ value: "", onChange: () => {}, placeholder: "Tìm kiếm..." }}
          filters={<button role="combobox" aria-expanded="false" aria-controls="test-listbox">Khối</button>}
        />
      </LanguageProvider>
    )

    const outer = container.firstElementChild as HTMLElement
    expect(outer.className).toContain("flex-wrap")

    const searchInput = screen.getByPlaceholderText("Tìm kiếm...")
    const searchWrapper = searchInput.parentElement as HTMLElement
    expect(searchWrapper.className).toContain("md:w-72")
    expect(searchWrapper.className).not.toContain("md:max-w-xs")

    // Nhóm desktop chứa filters
    const desktopFilterGroup = screen.getAllByRole("combobox")[0].parentElement as HTMLElement
    expect(desktopFilterGroup.className).toContain("md:flex")
    expect(desktopFilterGroup.className).not.toContain("md:ml-auto")
  })
})
