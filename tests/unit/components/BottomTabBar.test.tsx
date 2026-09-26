/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ComponentProps } from "react"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { BottomTabBar } from "@/components/layout/BottomTabBar"

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))
// jsdom không điều hướng thật được: giữ onClick của Link rồi chặn mặc định.
vi.mock("next/link", () => ({
  default: ({ href, onClick, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        e.preventDefault()
      }}
    />
  ),
}))

function renderBar() {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <BottomTabBar />
    </LanguageProvider>
  )
}

function moreButton() {
  const nav = screen.getByRole("navigation", { name: "Điều hướng chính" })
  return within(nav).getByRole("button", { name: "Thêm" })
}

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/dashboard")
})

describe("BottomTabBar", () => {
  it("4 tab link (Lịch dùng nhãn ngắn) + nút Thêm; không còn link Báo cáo", () => {
    renderBar()
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" })
    const links = within(nav).getAllByRole("link")
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Tổng quan", "/dashboard"],
      ["Lịch", "/calendar"],
      ["Học sinh", "/students"],
      ["Học phí", "/tuition"],
    ])
    expect(links[0].getAttribute("aria-current")).toBe("page")
    expect(within(nav).queryByRole("link", { name: "Báo cáo" })).toBeNull()
    expect(moreButton().getAttribute("aria-haspopup")).toBe("dialog")
    expect(moreButton().getAttribute("aria-current")).toBeNull()
  })

  it.each(["/reports", "/subjects", "/settings/x"])("ở %s → nút Thêm aria-current=page", (path) => {
    vi.mocked(usePathname).mockReturnValue(path)
    renderBar()
    expect(moreButton().getAttribute("aria-current")).toBe("page")
  })

  it("bấm Thêm → dialog 'Thêm' có 3 mục kèm mô tả; bấm mục thì sheet đóng", async () => {
    renderBar()
    fireEvent.click(moreButton())
    const dialog = await screen.findByRole("dialog", { name: "Thêm" })
    const links = within(dialog).getAllByRole("link")
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/reports", "/subjects", "/settings"])
    expect(within(dialog).getByText("Doanh thu, công nợ theo tháng và năm")).toBeTruthy()
    expect(within(dialog).getByText("Thêm, đổi màu, ẩn môn")).toBeTruthy()
    expect(within(dialog).getByText("Tài khoản ngân hàng nhận học phí")).toBeTruthy()

    fireEvent.click(within(dialog).getByRole("link", { name: /Cài đặt/ }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("Escape đóng sheet, bấm Thêm mở lại được", async () => {
    renderBar()
    fireEvent.click(moreButton())
    const dialog = await screen.findByRole("dialog", { name: "Thêm" })
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    fireEvent.click(moreButton())
    expect(await screen.findByRole("dialog", { name: "Thêm" })).toBeTruthy()
  })

  it("đổi pathname (vd nút Back) khi sheet đang mở thì sheet tự đóng", async () => {
    const { rerender } = renderBar()
    fireEvent.click(moreButton())
    await screen.findByRole("dialog", { name: "Thêm" })
    vi.mocked(usePathname).mockReturnValue("/students")
    rerender(
      <LanguageProvider forcedLanguage="vi">
        <BottomTabBar />
      </LanguageProvider>
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
