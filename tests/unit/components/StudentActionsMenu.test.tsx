/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { StudentActionsMenu } from "@/components/students/StudentActionsMenu"

function setup(isActive: boolean) {
  const h = {
    onViewSchedule: vi.fn(),
    onParentLink: vi.fn(),
    onEdit: vi.fn(),
    onMarkDropped: vi.fn(),
    onMarkBack: vi.fn(),
    onDelete: vi.fn(),
  }
  render(
    <LanguageProvider>
      <StudentActionsMenu isActive={isActive} parentLinkLocked={false} {...h} />
    </LanguageProvider>
  )
  return h
}

describe("StudentActionsMenu (spec R mục 3)", () => {
  it("HS đang học: có Đã nghỉ (kèm mô tả), không có Học lại, có Xóa học sinh + mô tả", async () => {
    const h = setup(true)
    await userEvent.click(screen.getByRole("button", { name: "Menu hành động" }))
    expect(screen.getByRole("menuitem", { name: /Đã nghỉ.*Giữ học phí/ })).toBeTruthy()
    expect(screen.queryByRole("menuitem", { name: /Học lại/ })).toBeNull()
    const del = screen.getByRole("menuitem", { name: /Xóa học sinh.*nhập nhầm/ })
    fireEvent.click(del)
    expect(h.onDelete).toHaveBeenCalled()
  })

  it("HS đã nghỉ: có Học lại, không có Đã nghỉ", async () => {
    const h = setup(false)
    await userEvent.click(screen.getByRole("button", { name: "Menu hành động" }))
    expect(screen.queryByRole("menuitem", { name: /^Đã nghỉ/ })).toBeNull()
    fireEvent.click(screen.getByRole("menuitem", { name: /Học lại/ }))
    expect(h.onMarkBack).toHaveBeenCalled()
  })
})
