/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionStatusBadge } from "@/components/tuition/TuitionStatusBadge"
import type { TuitionStatusInput } from "@/lib/tuition-status"

const base: TuitionStatusInput = {
  paidAmount: 0,
  isFullPaid: false,
  totalExpected: 400000,
  previousBalance: 0,
  totalAmountDue: 400000,
}

const DEBT = ["bg-debt-soft", "text-debt"]
const PARTIAL = ["bg-primary/[0.08]", "text-primary"]
const DONE = ["bg-success-soft", "text-success"]

describe("TuitionStatusBadge — màu theo nhóm trạng thái", () => {
  it.each<[string, TuitionStatusInput, string, string[]]>([
    ["unpaid", base, "Chưa đóng", DEBT],
    ["partial", { ...base, paidAmount: 100000 }, "Chưa đóng đủ", PARTIAL],
    [
      "paid_this_month",
      { ...base, previousBalance: 200000, totalAmountDue: 600000, paidAmount: 400000 },
      "Đóng đủ tháng này",
      PARTIAL,
    ],
    ["fully_paid", { ...base, paidAmount: 400000 }, "Đã đóng đủ", DONE],
    ["overpaid", { ...base, paidAmount: 500000 }, "Đóng thừa tiền", DONE],
    ["settled_waived", { ...base, isFullPaid: true, paidAmount: 300000 }, "Tất toán (miễn giảm)", DONE],
  ])("%s → %s", (_status, item, label, classes) => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionStatusBadge item={item} />
      </LanguageProvider>
    )
    const cls = screen.getByText(label).className
    for (const c of classes) expect(cls).toContain(c)
    expect(cls).not.toMatch(/(red|green|blue|amber|purple|teal)-\d/)
  })

  it("no_sessions giữ outline xám", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionStatusBadge item={{ ...base, totalExpected: 0, totalAmountDue: 0 }} />
      </LanguageProvider>
    )
    expect(screen.getByText("Không có buổi học").className).toContain("text-slate-400")
  })
})
