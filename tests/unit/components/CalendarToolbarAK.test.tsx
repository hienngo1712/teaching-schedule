/**
 * @vitest-environment jsdom
 */
// AK: thanh Lịch dùng FilterBar — chip Lớp + chip chữ tìm, "Xoá lọc" thay nút "Xóa bộ lọc" cũ.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), usePathname: vi.fn(), useSearchParams: vi.fn() }))
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }))
vi.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({ locked: false, allowed: true, requiredPlan: "plus", openUpgrade: vi.fn(), guard: (fn: () => void) => fn }),
}))
vi.mock("@/components/reports/ExportExcelButton", () => ({
  ExportExcelButton: ({ asSubmenu }: { asSubmenu?: boolean }) =>
    asSubmenu ? <div role="menuitem">Xuất Excel</div> : <button type="button">Xuất Excel</button>,
}))

import { CalendarToolbar } from "@/components/calendar/CalendarToolbar"

const push = vi.fn()

function renderAt(qs: string) {
  vi.mocked(useRouter).mockReturnValue({ push, replace: push } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(usePathname).mockReturnValue("/calendar")
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(qs) as ReturnType<typeof useSearchParams>)
  render(
    <LanguageProvider forcedLanguage="vi">
      <CalendarToolbar onCreateClick={vi.fn()} onBulkCreateClick={vi.fn()} onCopyMonthClick={vi.fn()} sessions={[]} />
    </LanguageProvider>
  )
}

beforeEach(() => push.mockClear())

describe("CalendarToolbar — thanh lọc AK", () => {
  it("đang lọc Lớp 5 + tìm 'An': 2 chip, Bộ lọc (2); Xoá lọc về tất cả", () => {
    renderAt("grade=5&studentName=An")
    expect(screen.getByRole("button", { name: "Bỏ lọc Lớp 5" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Bỏ lọc “An”" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Bộ lọc (2)" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Xóa bộ lọc/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Xoá lọc" }))
    expect(push).toHaveBeenLastCalledWith("/calendar")
  })

  it("bấm chip Lớp 5 thì bỏ lọc lớp", () => {
    renderAt("grade=5")
    fireEvent.click(screen.getByRole("button", { name: "Bỏ lọc Lớp 5" }))
    expect(String(push.mock.calls.at(-1)?.[0])).not.toContain("grade=")
  })

  it("không còn nút Lịch lặp / Chép lịch tháng trong thanh (đã vào Tạo ca dạy ▾)", () => {
    renderAt("")
    expect(screen.queryByRole("button", { name: "Lịch lặp" })).toBeNull()
    expect(screen.queryByTestId("copy-month-button")).toBeNull()
  })

  // Người dùng chốt: Xuất Excel vào ⋯ (riêng Báo cáo giữ ngoài).
  it("Xuất Excel nằm trong menu ⋯, không còn nút riêng trên thanh", async () => {
    renderAt("")
    expect(screen.queryByRole("button", { name: "Xuất Excel" })).toBeNull()
    fireEvent.keyDown(screen.getByRole("button", { name: "Thêm thao tác" }), { key: "Enter" })
    expect(await screen.findByRole("menuitem", { name: "Xuất Excel" })).toBeTruthy()
  })
})
