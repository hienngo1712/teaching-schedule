/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

// AK: Bộ lọc popover (laptop) / sheet (điện thoại), hàng chip, menu ⋯.
const desktop = vi.hoisted(() => ({ value: true }))
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => desktop.value }))

function bar(props: Partial<ComponentProps<typeof FilterBar>>) {
  return (
    <LanguageProvider forcedLanguage="vi">
      <FilterBar filters={<span>Ô lọc lớp</span>} {...props} />
    </LanguageProvider>
  )
}

const twoChips = (onRemove = vi.fn()) => [
  { key: "grade", label: "Lớp 5", onRemove },
  { key: "notice", label: "Chưa gửi", onRemove: vi.fn() },
]

describe("FilterBar AK — Bộ lọc, chip, ⋯", () => {
  beforeEach(() => {
    desktop.value = true
  })

  it("laptop: nút Bộ lọc (2) mở popover có ô lọc, Xoá lọc gọi onClearAll", async () => {
    const onClearAll = vi.fn()
    render(bar({ activeChips: twoChips(), onClearAll }))
    await userEvent.click(screen.getByRole("button", { name: "Bộ lọc (2)" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Ô lọc lớp")).toBeTruthy()
    await userEvent.click(within(dialog).getByRole("button", { name: "Xoá lọc" }))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it("điện thoại: nút Bộ lọc mở sheet, bấm Xong thì đóng", async () => {
    desktop.value = false
    render(bar({ activeChips: [], onClearAll: vi.fn() }))
    await userEvent.click(screen.getByRole("button", { name: "Bộ lọc" }))
    expect(await screen.findByText("Ô lọc lớp")).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Xong" }))
    await waitFor(() => expect(screen.queryByText("Ô lọc lớp")).toBeNull())
  })

  it("chip: bấm ✕ gọi onRemove đúng chip; không có chip thì không có hàng chip", async () => {
    const onRemove = vi.fn()
    const { rerender } = render(bar({ activeChips: twoChips(onRemove), onClearAll: vi.fn() }))
    await userEvent.click(screen.getByRole("button", { name: "Bỏ lọc Lớp 5" }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    rerender(bar({ activeChips: [], onClearAll: vi.fn() }))
    expect(screen.queryByRole("button", { name: /^Bỏ lọc/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Xoá lọc" })).toBeNull()
  })

  it("⋯: mở Thêm thao tác rồi chọn Xuất Excel gọi onSelect", async () => {
    const onSelect = vi.fn()
    render(bar({ moreActions: [{ key: "excel", label: "Xuất Excel", onSelect }] }))
    await userEvent.click(screen.getByRole("button", { name: "Thêm thao tác" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Xuất Excel" }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("tương thích: chỉ search + filters + activeCount như cũ → nút ghi Bộ lọc (1)", () => {
    render(bar({ search: { value: "", onChange: () => {}, placeholder: "Tìm" }, activeCount: 1 }))
    expect(screen.getByRole("button", { name: "Bộ lọc (1)" })).toBeTruthy()
  })

  // [RF 1] đổi khổ khi popover đang mở: ô lọc không render 2 lần
  it("popover đang mở rồi thu xuống điện thoại: ô lọc chỉ có tối đa 1 bản", async () => {
    const props = { activeChips: twoChips(), onClearAll: vi.fn() }
    const { rerender } = render(bar(props))
    await userEvent.click(screen.getByRole("button", { name: "Bộ lọc (2)" }))
    await screen.findByRole("dialog")
    desktop.value = false
    rerender(bar(props))
    expect(screen.queryAllByText("Ô lọc lớp").length).toBeLessThanOrEqual(1)
  })
})
