/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionAmountCell } from "@/components/tuition/TuitionAmountCell"
import type { DisplayRow } from "@/lib/tuition-display"

type Item = DisplayRow & { debtMonths: number }

const baseItem: Item = {
  previousBalance: 0,
  totalExpected: 0,
  totalAmountDue: 0,
  paidAmount: 0,
  isFullPaid: false,
  billingMode: "per_session",
  inProgress: false,
  debtMonths: 0,
}

describe("TuitionAmountCell (spec Y §4.4)", () => {
  it("tháng đã kết thúc, nợ cũ 1 tháng: số to '800.000 đ', dòng nhỏ 'T8 còn 200.000 · T9 600.000'", () => {
    const item: Item = {
      ...baseItem,
      previousBalance: 200_000,
      totalExpected: 600_000,
      totalAmountDue: 800_000,
      paidAmount: 0,
      debtMonths: 1,
    }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionAmountCell item={item} month={9} />
      </LanguageProvider>
    )
    expect(screen.getByText("800.000 đ")).toBeDefined()
    expect(screen.getByText("T8 còn 200.000 đ · T9 600.000 đ")).toBeDefined()
  })

  it("tháng đã kết thúc, nợ cũ 3 tháng: dòng nhỏ 'Nợ 3 tháng trước 200.000 · T9 600.000'", () => {
    const item: Item = {
      ...baseItem,
      previousBalance: 200_000,
      totalExpected: 600_000,
      totalAmountDue: 800_000,
      paidAmount: 0,
      debtMonths: 3,
    }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionAmountCell item={item} month={9} />
      </LanguageProvider>
    )
    expect(screen.getByText("Nợ 3 tháng trước 200.000 đ · T9 600.000 đ")).toBeDefined()
  })

  it("tháng đang học theo buổi: số to = nợ cũ, dòng nhỏ 'T10 tạm tính 300.000'", () => {
    const item: Item = {
      ...baseItem,
      inProgress: true,
      billingMode: "per_session",
      previousBalance: 200_000,
      totalExpected: 300_000,
      totalAmountDue: 500_000,
      paidAmount: 0,
      debtMonths: 1,
    }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionAmountCell item={item} month={10} />
      </LanguageProvider>
    )
    expect(screen.getByText("200.000 đ")).toBeDefined()
    expect(screen.getByText("T9 còn 200.000 đ · T10 tạm tính 300.000 đ")).toBeDefined()
  })

  it("không nợ cũ, tháng kết thúc: chỉ số to, không dòng nhỏ", () => {
    const item: Item = {
      ...baseItem,
      previousBalance: 0,
      totalExpected: 600_000,
      totalAmountDue: 600_000,
      paidAmount: 0,
      debtMonths: 0,
    }
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionAmountCell item={item} month={9} />
      </LanguageProvider>
    )
    expect(screen.getByText("600.000 đ")).toBeDefined()
    expect(container.querySelectorAll("span")).toHaveLength(1)
  })
})
