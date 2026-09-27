/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PlanCompare } from "@/components/plan/PlanCompare"

type Me = RouterOutputs["plan"]["me"]

function makeMe(over: Partial<Me> = {}): Me {
  return {
    plan: "standard",
    source: "free",
    expiresAt: null,
    paidPlan: "standard",
    planExpiresAt: null,
    trialEndsAt: null,
    activeStudents: 3,
    studentLimit: 10,
    plusCreditOrder: null,
    pendingOrder: null,
    orders: [],
    paymentReady: true,
    isAdmin: false,
    ...over,
  } as Me
}

function renderCompare(me: Me, plusBlocked = false) {
  const onChoose = vi.fn()
  render(
    <LanguageProvider forcedLanguage="vi">
      <PlanCompare me={me} plusBlocked={plusBlocked} onChoose={onChoose} />
    </LanguageProvider>
  )
  return onChoose
}

describe("PlanCompare", () => {
  it("Standard miễn phí: thẻ Standard có Đang dùng + số HS, không có dòng hạn; thẻ khác không có Đang dùng", () => {
    renderCompare(makeMe({ activeStudents: 3 }))
    const std = screen.getByTestId("plan-card-standard")
    expect(std.textContent).toContain("Đang dùng")
    expect(std.textContent).toContain("Đang có 3 học sinh đang học")
    expect(std.textContent).not.toContain("Dùng đến hết ngày")
    expect(screen.getByTestId("plan-card-plus").textContent).not.toContain("Đang dùng")
    expect(screen.getByTestId("plan-card-pro").textContent).not.toContain("Đang dùng")
  })

  it("dùng thử Pro: thẻ Pro có nhãn Dùng thử + Dùng đến hết ngày", () => {
    renderCompare(makeMe({ plan: "pro", source: "trial", expiresAt: "2026-11-01T17:00:00.000Z", activeStudents: 12 }))
    const pro = screen.getByTestId("plan-card-pro")
    expect(pro.textContent).toContain("Dùng thử")
    expect(pro.textContent).toContain("Dùng đến hết ngày 01/11/2026")
    expect(pro.textContent).toContain("Đang có 12 học sinh đang học")
    expect(screen.getByTestId("plan-card-standard").textContent).not.toContain("Đang dùng")
  })

  it("CTA: Chọn gói Pro gọi onChoose('pro'); Plus bị D7 thì CTA khóa; Standard không có CTA", () => {
    const onChoose = renderCompare(makeMe(), true)
    fireEvent.click(screen.getByRole("button", { name: "Chọn gói Pro" }))
    expect(onChoose).toHaveBeenCalledWith("pro")
    expect((screen.getByRole("button", { name: "Chọn gói Plus" }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(screen.getByTestId("plan-card-standard")).queryByRole("button")).toBeNull()
  })

  it("desktop: lưới items-stretch, thẻ Pro không còn nhô lên", () => {
    renderCompare(makeMe())
    const pro = screen.getByTestId("plan-card-pro")
    expect(pro.parentElement!.className).toContain("md:items-stretch")
    expect(pro.parentElement!.className).not.toContain("md:items-start")
    expect(pro.className).not.toContain("md:-mt-2")
  })
})
