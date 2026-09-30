/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { FilterBar } from "@/components/common/FilterBar"

describe("FilterBar — dồn trái trên desktop (spec S1)", () => {
  it("nhóm desktop không có md:ml-auto, wrapper ô tìm tối đa md:max-w-72 không có md:max-w-xs, container có flex-wrap", () => {
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
    expect(searchWrapper.className).toContain("md:max-w-72")
    expect(searchWrapper.className).not.toContain("md:max-w-xs")

    // Nhóm desktop chứa filters
    const desktopFilterGroup = screen.getAllByRole("combobox")[0].parentElement as HTMLElement
    expect(desktopFilterGroup.className).toContain("md:flex")
    expect(desktopFilterGroup.className).not.toContain("md:ml-auto")
  })

  // Hotfix 0.8.2: như thanh Lịch dạy — 1 khung trắng, lọc bên trái, nút hành động bên phải cùng hàng.
  it("actions nằm trong cùng khung với ô tìm, dồn phải trên desktop", () => {
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <FilterBar
          search={{ value: "", onChange: () => {}, placeholder: "Tìm kiếm..." }}
          filters={<button role="combobox" aria-expanded="false" aria-controls="x">Khối</button>}
          actions={<button>Thêm học sinh</button>}
        />
      </LanguageProvider>
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain("rounded-xl")
    expect(card.className).toContain("bg-white")
    const action = screen.getByRole("button", { name: "Thêm học sinh" })
    expect(card.contains(action)).toBe(true)
    expect(card.contains(screen.getByPlaceholderText("Tìm kiếm..."))).toBe(true)
    expect((action.parentElement as HTMLElement).className).toContain("md:ml-auto")
  })
})
