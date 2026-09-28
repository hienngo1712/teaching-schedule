/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const gate = vi.hoisted(() => ({ locked: false, allowed: true, openUpgrade: vi.fn() }))
vi.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({ ...gate, requiredPlan: "pro", guard: (fn: () => void) => fn }),
}))

import { AddStudentSplitButton } from "@/components/students/AddStudentSplitButton"

function renderBtn(addLockPlan: "plus" | "pro" | null = null) {
  const onAdd = vi.fn()
  const onImport = vi.fn()
  render(
    <LanguageProvider forcedLanguage="vi">
      <AddStudentSplitButton onAdd={onAdd} onImport={onImport} addLockPlan={addLockPlan} />
    </LanguageProvider>
  )
  return { onAdd, onImport }
}
const openMenu = () => fireEvent.keyDown(screen.getByRole("button", { name: "Mở thêm lựa chọn" }), { key: "Enter" })

beforeEach(() => {
  gate.locked = false
  gate.allowed = true
  gate.openUpgrade.mockReset()
})

describe("AddStudentSplitButton (spec P11)", () => {
  it("phần chính 'Thêm học sinh' gọi onAdd; mũi tên có tên truy cập, ≥44px mobile", () => {
    const { onAdd } = renderBtn()
    fireEvent.click(screen.getByRole("button", { name: "Thêm học sinh" }))
    expect(onAdd).toHaveBeenCalled()
    const more = screen.getByRole("button", { name: "Mở thêm lựa chọn" })
    expect(more.className).toContain("h-11")
    expect(more.className).toContain("w-11")
  })

  it("menu chỉ 1 mục chữ Nhập Excel, không icon; gói Pro chọn → onImport", async () => {
    const { onImport } = renderBtn()
    openMenu()
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Nhập Excel"])
    expect(items[0].querySelector("svg")).toBeNull()
    fireEvent.click(items[0])
    expect(onImport).toHaveBeenCalled()
    expect(gate.openUpgrade).not.toHaveBeenCalled()
  })

  it("Standard/Plus (locked): mục có ổ khóa, chọn → popup nâng cấp, không mở nhập", async () => {
    gate.locked = true
    gate.allowed = false
    const { onImport } = renderBtn()
    openMenu()
    const item = await screen.findByRole("menuitem", { name: /Nhập Excel/ })
    expect(item.querySelector('[data-testid="lock-badge"]')).not.toBeNull()
    fireEvent.click(item)
    expect(gate.openUpgrade).toHaveBeenCalled()
    expect(onImport).not.toHaveBeenCalled()
  })

  it("chưa biết gói: mục tạm khóa", async () => {
    gate.locked = false
    gate.allowed = false
    renderBtn()
    openMenu()
    expect((await screen.findByRole("menuitem", { name: /Nhập Excel/ })).getAttribute("aria-disabled")).toBe("true")
  })

  it("hết hạn mức HS: phần chính có ổ khóa gói", () => {
    renderBtn("plus")
    expect(screen.getByRole("button", { name: /Thêm học sinh/ }).querySelector('[data-testid="lock-badge"]')).not.toBeNull()
  })
})
