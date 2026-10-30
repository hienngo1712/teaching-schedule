import type { MonthLedger } from "./payment-allocation"

// Một dòng nợ cũ: tháng còn thiếu bao nhiêu. before = gộp mọi tháng cũ hơn (year, month) ("Trước tháng N").
export type DebtPart = { year: number; month: number; amount: number; before?: true }

// Cửa sổ như debtMonths (12 tháng); cũ hơn thì gộp 1 dòng.
const WINDOW = 12

const toYm = (key: number) => ({ year: Math.floor(key / 12), month: (key % 12) + 1 })

/**
 * Tách nợ cũ (dư nợ cuối tháng `lastKey`) theo tháng phát sinh, FIFO: tiền thu trừ tháng cũ nhất trước,
 * tháng miễn xoá nợ dương, tín dụng trả dư trừ vào học phí tháng sau — cùng công thức computeClosingBalances.
 * Không khớp previousBalance / dữ liệu lạ → null để giao diện quay về dòng gộp (spec AU B2).
 */
export function splitDebt(ledgers: MonthLedger[], lastKey: number, previousBalance: number): DebtPart[] | null {
  if (previousBalance <= 0) return null
  const queue: { key: number; amount: number }[] = []
  let credit = 0
  for (const m of [...ledgers].sort((a, b) => a.key - b.key)) {
    if (m.key > lastKey) break
    if (m.fee < 0 || m.paid < 0) return null
    let fee = m.fee
    const used = Math.min(credit, fee)
    credit -= used
    fee -= used
    if (fee > 0) queue.push({ key: m.key, amount: fee })
    let paid = m.paid
    while (paid > 0 && queue.length > 0) {
      const head = queue[0]
      const take = Math.min(paid, head.amount)
      head.amount -= take
      paid -= take
      if (head.amount === 0) queue.shift()
    }
    credit += paid
    // Miễn: dư nợ dương về 0, tín dụng giữ nguyên (Math.min(0, residual)).
    if (m.fullPaid) queue.length = 0
  }
  if (queue.reduce((s, q) => s + q.amount, 0) !== previousBalance) return null

  const start = lastKey - WINDOW + 1
  const older = queue.filter((q) => q.key < start).reduce((s, q) => s + q.amount, 0)
  const parts: DebtPart[] = older > 0 ? [{ ...toYm(start), amount: older, before: true }] : []
  for (const q of queue) if (q.key >= start) parts.push({ ...toYm(q.key), amount: q.amount })
  return parts
}

type DebtKey = "debt_prev_month_label" | "debt_n_months_label" | "debt_before_month" | "debt_total_prev"
export type DebtLine = { label: string; amount: number; kind: "month" | "total" }

// Dòng nợ cũ cho phiếu/trang PH/sheet chi tiết: nhiều tháng → từng tháng + tổng; không tách được → dòng gộp cũ.
export function debtLines(
  t: (key: DebtKey) => string,
  row: { year: number; month: number; previousBalance: number; debtMonths: number; debtBreakdown?: DebtPart[] | null }
): DebtLine[] {
  if (row.previousBalance <= 0) return []
  // Khác năm đang xem thì ghi kèm năm (12/2025).
  const m = (p: { year: number; month: number }) => (p.year === row.year ? String(p.month) : `${p.month}/${p.year}`)
  const parts = row.debtBreakdown
  if (parts && parts.length > 0) {
    const lines = parts.map((p): DebtLine => ({
      label: t(p.before ? "debt_before_month" : "debt_prev_month_label").replace("{m}", m(p)),
      amount: p.amount,
      kind: "month",
    }))
    if (lines.length === 1) return [{ ...lines[0], kind: "total" }]
    return [...lines, { label: t("debt_total_prev"), amount: row.previousBalance, kind: "total" }]
  }
  const label =
    row.debtMonths > 1
      ? t("debt_n_months_label").replace("{n}", String(row.debtMonths))
      : t("debt_prev_month_label").replace("{m}", String(row.month === 1 ? 12 : row.month - 1))
  return [{ label, amount: row.previousBalance, kind: "total" }]
}
