/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { UpgradeDialog } from "@/components/plan/UpgradeDialog"
import { closeUpgrade, openUpgrade } from "@/components/plan/upgrade-store"
import { useFeatureGate } from "@/hooks/useFeatureGate"

const mockPlan = vi.hoisted(() => ({ allow: true }))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: undefined, ready: true, fields: null, has: () => mockPlan.allow }),
}))

function GatedButton({ onRun }: { onRun: () => void }) {
  const gate = useFeatureGate("payments")
  return (
    <button type="button" onClick={gate.guard(onRun)}>
      Ghi nhận {gate.locked ? "khóa" : "mở"}
    </button>
  )
}

function renderWithDialog(ui: React.ReactNode) {
  return render(
    <LanguageProvider forcedLanguage="vi">
      {ui}
      <UpgradeDialog />
    </LanguageProvider>
  )
}

beforeEach(() => {
  mockPlan.allow = true
  act(() => closeUpgrade())
})

describe("UpgradeDialog", () => {
  it("gói Pro: chữ 'Nâng lên gói Pro…'; Để sau thì đóng", async () => {
    renderWithDialog(null)
    act(() => openUpgrade({ plan: "pro" }))
    expect(await screen.findByText("Nâng lên gói Pro để sử dụng tính năng này.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Xem gói" }).getAttribute("href")).toBe("/plan")
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }))
    await waitFor(() => expect(screen.queryByTestId("upgrade-dialog")).toBeNull())
  })

  it("gói Plus: chữ 'Nâng lên gói Plus hoặc Pro…'; có message riêng thì hiện message", async () => {
    renderWithDialog(null)
    act(() => openUpgrade({ plan: "plus" }))
    expect(await screen.findByText("Nâng lên gói Plus hoặc Pro để sử dụng tính năng này.")).toBeTruthy()
    act(() => openUpgrade({ plan: "plus", message: "Gói Standard tối đa 10 học sinh đang học." }))
    expect(await screen.findByText("Gói Standard tối đa 10 học sinh đang học.")).toBeTruthy()
  })
})

describe("useFeatureGate", () => {
  it("đủ gói → guard chạy handler, không mở popup", () => {
    const onRun = vi.fn()
    renderWithDialog(<GatedButton onRun={onRun} />)
    fireEvent.click(screen.getByRole("button", { name: /Ghi nhận mở/ }))
    expect(onRun).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("upgrade-dialog")).toBeNull()
  })

  it("thiếu gói → guard mở popup Plus, không chạy handler", async () => {
    mockPlan.allow = false
    const onRun = vi.fn()
    renderWithDialog(<GatedButton onRun={onRun} />)
    fireEvent.click(screen.getByRole("button", { name: /Ghi nhận khóa/ }))
    expect(onRun).not.toHaveBeenCalled()
    expect(await screen.findByText("Nâng lên gói Plus hoặc Pro để sử dụng tính năng này.")).toBeTruthy()
  })
})
