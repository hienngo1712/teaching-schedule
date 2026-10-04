// Một tháng trong chuỗi dư nợ của 1 HS: tiền học tháng đó, đã thu ghi vào tháng đó, đã miễn chưa.
export type MonthLedger = { key: number; fee: number; paid: number; fullPaid: boolean }

// Chia khoản thu vào các tháng còn nợ từ cũ tới mới, cùng công thức dư cuối với computeClosingBalances
// (tháng miễn xoá nợ dương, trả dư chuyển sang). Dư sau tháng cuối → tháng cuối (tháng đang xem).
export function allocatePayment(months: MonthLedger[], amount: number): { key: number; amount: number }[] {
  if (amount <= 0) throw new Error("amount phải > 0")
  if (months.length === 0) throw new Error("months rỗng")
  const sorted = [...months].sort((a, b) => a.key - b.key)
  const out = new Map<number, number>()
  let balance = 0
  let left = amount
  for (const m of sorted) {
    let residual = balance + m.fee - m.paid
    if (m.fullPaid) residual = Math.min(0, residual)
    if (left > 0 && residual > 0) {
      const a = Math.min(left, residual)
      out.set(m.key, a)
      left -= a
      residual -= a
    }
    balance = residual
  }
  if (left > 0) {
    const last = sorted[sorted.length - 1].key
    out.set(last, (out.get(last) ?? 0) + left)
  }
  return [...out].map(([key, a]) => ({ key, amount: a }))
}

export function keyToYearMonth(key: number): { year: number; month: number } {
  return { year: Math.floor(key / 12), month: (key % 12) + 1 }
}
