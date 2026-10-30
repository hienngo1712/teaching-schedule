import { describe, it, expect } from "vitest"
import { debtLines, splitDebt } from "@/lib/debt-breakdown"
import type { MonthLedger } from "@/lib/payment-allocation"

// Khoá tháng = year*12 + month-1 (như monthKey).
const k = (year: number, month: number) => year * 12 + month - 1
const L = (year: number, month: number, fee: number, paid = 0, fullPaid = false): MonthLedger => ({
  key: k(year, month), fee, paid, fullPaid,
})
// Đang xem tháng 10/2026 → tháng cuối tính nợ cũ là 9/2026.
const LAST = k(2026, 9)

describe("splitDebt — tách nợ cũ từng tháng theo FIFO (AU)", () => {
  it("chưa trả gì 2 tháng → từng tháng đủ tiền, cũ → mới; tổng = previousBalance", () => {
    const parts = splitDebt([L(2026, 8, 200000), L(2026, 9, 280000)], LAST, 480000)
    expect(parts).toEqual([
      { year: 2026, month: 8, amount: 200000 },
      { year: 2026, month: 9, amount: 280000 },
    ])
  })

  it("trả một phần → trừ tháng cũ nhất trước (FIFO), kể cả tiền ghi ở tháng sau", () => {
    // T7 300k, T8 200k, T9 280k; trả 350k ghi ở T8 → T7 hết, T8 còn 150k.
    const parts = splitDebt([L(2026, 7, 300000), L(2026, 8, 200000, 350000), L(2026, 9, 280000)], LAST, 430000)
    expect(parts).toEqual([
      { year: 2026, month: 8, amount: 150000 },
      { year: 2026, month: 9, amount: 280000 },
    ])
  })

  it("tháng được miễn (isFullPaid) xoá hết nợ dương tới tháng đó", () => {
    const parts = splitDebt([L(2026, 7, 300000), L(2026, 8, 200000, 0, true), L(2026, 9, 280000)], LAST, 280000)
    expect(parts).toEqual([{ year: 2026, month: 9, amount: 280000 }])
  })

  it("dư trả trước (tín dụng) trừ vào tháng sau", () => {
    // T7 trả dư 100k → T8 200k chỉ còn 100k.
    const parts = splitDebt([L(2026, 7, 300000, 400000), L(2026, 8, 200000), L(2026, 9, 280000)], LAST, 380000)
    expect(parts).toEqual([
      { year: 2026, month: 8, amount: 100000 },
      { year: 2026, month: 9, amount: 280000 },
    ])
  })

  it("tháng 0 đ không thành dòng; tháng trống giữa chừng không sao", () => {
    const parts = splitDebt([L(2026, 7, 300000), L(2026, 8, 0), L(2026, 9, 100000)], LAST, 400000)
    expect(parts).toEqual([
      { year: 2026, month: 7, amount: 300000 },
      { year: 2026, month: 9, amount: 100000 },
    ])
  })

  it("nợ quá 12 tháng → phần cũ hơn gộp thành 'Trước tháng N' (N = tháng đầu cửa sổ 12 tháng)", () => {
    // 14 tháng 8/2025..9/2026, mỗi tháng 100k, chưa trả.
    const ledgers: MonthLedger[] = []
    for (let key = k(2025, 8); key <= LAST; key++) ledgers.push({ key, fee: 100000, paid: 0, fullPaid: false })
    const parts = splitDebt(ledgers, LAST, 1400000)!
    expect(parts).toHaveLength(13)
    expect(parts[0]).toEqual({ year: 2025, month: 10, amount: 200000, before: true })
    expect(parts[1]).toEqual({ year: 2025, month: 10, amount: 100000 })
    expect(parts[12]).toEqual({ year: 2026, month: 9, amount: 100000 })
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(1400000)
  })

  it("qua năm: tháng 12/2025 và 1/2026", () => {
    const parts = splitDebt([L(2025, 12, 100000), L(2026, 1, 150000)], k(2026, 1), 250000)
    expect(parts).toEqual([
      { year: 2025, month: 12, amount: 100000 },
      { year: 2026, month: 1, amount: 150000 },
    ])
  })

  it("bỏ qua tháng sau tháng cuối (không tính tháng đang xem)", () => {
    const parts = splitDebt([L(2026, 9, 280000), L(2026, 10, 999999)], LAST, 280000)
    expect(parts).toEqual([{ year: 2026, month: 9, amount: 280000 }])
  })

  it("không có nợ (previousBalance ≤ 0) → null", () => {
    expect(splitDebt([L(2026, 9, 100000, 100000)], LAST, 0)).toBeNull()
    expect(splitDebt([L(2026, 9, 100000, 200000)], LAST, -100000)).toBeNull()
  })

  it("tổng không khớp previousBalance → null (quay về dòng gộp)", () => {
    expect(splitDebt([L(2026, 8, 200000), L(2026, 9, 280000)], LAST, 500000)).toBeNull()
  })

  it("dữ liệu lạ (học phí âm) → null", () => {
    expect(splitDebt([L(2026, 8, -100000), L(2026, 9, 280000)], LAST, 180000)).toBeNull()
  })
})

describe("debtLines — dòng nợ cũ để hiển thị (AU)", () => {
  const dict: Record<string, string> = {
    debt_prev_month_label: "Tháng {m} còn thiếu",
    debt_n_months_label: "Nợ {n} tháng trước",
    debt_before_month: "Trước tháng {m}",
    debt_total_prev: "Tổng nợ cũ",
  }
  const t = (key: string) => dict[key]
  const base = { year: 2026, month: 10, previousBalance: 480000, debtMonths: 2 }

  it("nhiều tháng → từng tháng (month) + dòng tổng (total)", () => {
    expect(debtLines(t, { ...base, debtBreakdown: [{ year: 2026, month: 8, amount: 200000 }, { year: 2026, month: 9, amount: 280000 }] })).toEqual([
      { label: "Tháng 8 còn thiếu", amount: 200000, kind: "month" },
      { label: "Tháng 9 còn thiếu", amount: 280000, kind: "month" },
      { label: "Tổng nợ cũ", amount: 480000, kind: "total" },
    ])
  })

  it("1 tháng → 1 dòng 'Tháng N còn thiếu' đúng tháng phát sinh", () => {
    expect(debtLines(t, { ...base, previousBalance: 200000, debtBreakdown: [{ year: 2026, month: 8, amount: 200000 }] })).toEqual([
      { label: "Tháng 8 còn thiếu", amount: 200000, kind: "total" },
    ])
  })

  it("khác năm → ghi kèm năm; dòng gộp phần cũ → 'Trước tháng N/YYYY'", () => {
    const lines = debtLines(t, {
      ...base, year: 2026, month: 2, previousBalance: 300000,
      debtBreakdown: [{ year: 2025, month: 3, amount: 100000, before: true }, { year: 2025, month: 12, amount: 100000 }, { year: 2026, month: 1, amount: 100000 }],
    })
    expect(lines.map((l) => l.label)).toEqual(["Trước tháng 3/2025", "Tháng 12/2025 còn thiếu", "Tháng 1 còn thiếu", "Tổng nợ cũ"])
  })

  it("không tách được → dòng gộp như cũ", () => {
    expect(debtLines(t, { ...base, debtBreakdown: null })).toEqual([{ label: "Nợ 2 tháng trước", amount: 480000, kind: "total" }])
    expect(debtLines(t, { ...base, debtMonths: 1, previousBalance: 100000 })).toEqual([
      { label: "Tháng 9 còn thiếu", amount: 100000, kind: "total" },
    ])
  })

  it("không có nợ → rỗng", () => {
    expect(debtLines(t, { ...base, previousBalance: 0 })).toEqual([])
    expect(debtLines(t, { ...base, previousBalance: -50000 })).toEqual([])
  })
})
