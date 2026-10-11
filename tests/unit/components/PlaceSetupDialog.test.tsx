/**
 * @vitest-environment jsdom
 */
// Spec AL §5: popup chọn nơi dạy (bước 1) + chọn gói (bước 2) cho TK chưa có nơi dạy.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const state = vi.hoisted(() => ({
  summary: { count: 0, hasPerStudent: true, hasPerSession: false } as { count: number; hasPerStudent: boolean; hasPerSession: boolean } | undefined,
  mutate: vi.fn(),
  onSuccess: undefined as undefined | (() => Promise<void> | void),
}))
vi.mock("@/hooks/usePlaceSummary", () => ({ usePlaceSummary: () => ({ summary: state.summary, places: [] }) }))
vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ me: { plan: "standard" }, fields: { plan: "standard", planExpiresAt: null, trialEndsAt: null } }),
}))
vi.mock("@/lib/plans", async (orig) => ({ ...(await orig<typeof import("@/lib/plans")>()), orderBlockedUntil: () => null }))
vi.mock("@/components/plan/PlanCompare", () => ({
  PlanCompare: ({ hideNewBadges }: { hideNewBadges?: boolean }) => <div data-testid="plan-compare" data-hide-new={String(!!hideNewBadges)} />,
}))
vi.mock("@/components/plan/PlanPurchaseDialog", () => ({ PlanPurchaseDialog: () => null }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ place: { invalidate: vi.fn() } }),
    place: {
      setupInitial: {
        useMutation: (opts: { onSuccess: () => Promise<void> | void }) => {
          state.onSuccess = opts.onSuccess
          return { mutate: state.mutate, isPending: false }
        },
      },
    },
  },
}))

import { PlaceSetupDialog } from "@/components/onboarding/PlaceSetupDialog"

const renderDialog = () =>
  render(
    <LanguageProvider forcedLanguage="vi">
      <PlaceSetupDialog />
    </LanguageProvider>
  )

beforeEach(() => {
  state.summary = { count: 0, hasPerStudent: true, hasPerSession: false }
  state.mutate.mockReset()
})

describe("PlaceSetupDialog", () => {
  it("bước 1: tick Trung tâm hiện ô tên, thêm được 2 tên; Tiếp tục gửi đúng payload", () => {
    renderDialog()
    expect(screen.getByText("Bạn đang dạy ở đâu?")).toBeTruthy()
    // Không có nút đóng (ẩn bằng CSS) và Escape không đóng được: phải chọn.
    expect(screen.getByTestId("place-setup-dialog").className).toContain("[&>button:last-child]:hidden")
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    expect(screen.getByTestId("place-setup-dialog")).toBeTruthy()
    fireEvent.click(screen.getByRole("checkbox", { name: /Trung tâm/ }))
    fireEvent.change(screen.getByLabelText("Tên trung tâm (không bắt buộc)"), { target: { value: "TT Ánh Dương" } })
    fireEvent.click(screen.getByRole("button", { name: /Thêm trung tâm/ }))
    const inputs = screen.getAllByLabelText("Tên trung tâm (không bắt buộc)")
    expect(inputs).toHaveLength(2)
    fireEvent.change(inputs[1], { target: { value: "TT Sao Mai" } })
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }))
    expect(state.mutate).toHaveBeenCalledWith({ home: false, tutor: false, centers: ["TT Ánh Dương", "TT Sao Mai"] })
  })

  it("không tick gì → gửi { home: true }", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }))
    expect(state.mutate).toHaveBeenCalledWith({ home: true, tutor: false, centers: [] })
  })

  it("bước 2: thẻ gói không có nhãn MỚI; Bắt đầu miễn phí đóng popup", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }))
    state.summary = { count: 1, hasPerStudent: true, hasPerSession: false }
    await state.onSuccess!()
    expect(await screen.findByText("Chọn gói để bắt đầu")).toBeTruthy()
    expect(screen.getByTestId("plan-compare").getAttribute("data-hide-new")).toBe("true")
    // < 768px: nút chính dính đáy popup, thẻ gói cuộn phía trên (FIX AL F1).
    const footer = screen.getByRole("button", { name: "Bắt đầu miễn phí" }).parentElement!
    expect(footer.className).toContain("sticky")
    expect(footer.className).toContain("-bottom-6")
    expect(footer.className).toContain("md:static")
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu miễn phí" }))
    await waitFor(() => expect(screen.queryByTestId("place-setup-dialog")).toBeNull())
  })

  it("TK đã có nơi dạy (TK cũ) hoặc chưa tải xong → không hiện popup", () => {
    state.summary = { count: 1, hasPerStudent: true, hasPerSession: false }
    const { unmount } = renderDialog()
    expect(screen.queryByTestId("place-setup-dialog")).toBeNull()
    unmount()
    state.summary = undefined
    renderDialog()
    expect(screen.queryByTestId("place-setup-dialog")).toBeNull()
  })
})
