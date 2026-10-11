/**
 * @vitest-environment jsdom
 */
// AK: Tạo ca dạy ▾ gồm Lịch lặp + Chép lịch tháng (chép lịch có khoá gói như cũ).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const gate = vi.hoisted(() => ({ locked: false, openUpgrade: vi.fn() }))
vi.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({
    ...gate,
    allowed: !gate.locked,
    requiredPlan: "plus",
    guard: (fn: () => void) => () => (gate.locked ? gate.openUpgrade() : fn()),
  }),
}))

import { CreateSessionSplitButton } from "@/components/calendar/CreateSessionSplitButton"

function renderBtn() {
  const h = { onCreate: vi.fn(), onBulkCreate: vi.fn(), onCopyMonth: vi.fn() }
  render(
    <LanguageProvider forcedLanguage="vi">
      <CreateSessionSplitButton {...h} />
    </LanguageProvider>
  )
  return h
}
const openMenu = () => fireEvent.keyDown(screen.getByRole("button", { name: "Mở thêm lựa chọn" }), { key: "Enter" })

beforeEach(() => {
  gate.locked = false
  gate.openUpgrade.mockReset()
})

describe("CreateSessionSplitButton", () => {
  it("nút chính Tạo ca dạy gọi onCreate, giữ data-tour session-add", () => {
    const h = renderBtn()
    const main = screen.getByRole("button", { name: "Tạo ca dạy" })
    expect(main.getAttribute("data-tour")).toBe("session-add")
    fireEvent.click(main)
    expect(h.onCreate).toHaveBeenCalled()
  })

  it("▾ có Lịch lặp và Chép lịch tháng; chọn từng mục gọi đúng hàm", async () => {
    const h = renderBtn()
    openMenu()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Lịch lặp", "Chép lịch tháng"])
    fireEvent.click(items[0])
    expect(h.onBulkCreate).toHaveBeenCalled()
    openMenu()
    fireEvent.click(await screen.findByTestId("copy-month-button"))
    expect(h.onCopyMonth).toHaveBeenCalled()
  })

  // [RF 3] Standard chọn Chép lịch tháng → popup nâng gói, không mở hộp chép.
  it("chép lịch bị khoá: có ổ khoá, chọn thì mở nâng gói, không gọi onCopyMonth", async () => {
    gate.locked = true
    const h = renderBtn()
    openMenu()
    const copy = await screen.findByTestId("copy-month-button")
    expect(copy.querySelector('[data-testid="lock-badge"]')).not.toBeNull()
    fireEvent.click(copy)
    expect(gate.openUpgrade).toHaveBeenCalled()
    expect(h.onCopyMonth).not.toHaveBeenCalled()
  })
})
