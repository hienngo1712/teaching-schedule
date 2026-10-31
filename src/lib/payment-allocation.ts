// Một tháng trong chuỗi dư nợ của 1 HS: tiền học tháng đó, đã thu ghi vào tháng đó, đã miễn chưa.
export type MonthLedger = { key: number; fee: number; paid: number; fullPaid: boolean }

/**
 * Nợ còn lại theo tháng phát sinh, FIFO: tiền thu trừ tháng cũ nhất trước, tháng miễn xoá nợ dương,
 * tín dụng trả dư trừ vào học phí tháng sau. Tổng = dư nợ cuối của computeClosingBalances khi dương.
 */
export function outstandingDebts(months: MonthLedger[]): { key: number; amount: number }[] {
  const queue: { key: number; amount: number }[] = []
  let credit = 0
  for (const m of [...months].sort((a, b) => a.key - b.key)) {
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
  return queue
}

// Chia khoản thu vào đúng các tháng còn nợ mà màn hình tách nợ hiện (outstandingDebts), cũ tới mới.
// Dư sau khi hết nợ → tháng cuối (tháng đang xem).
export function allocatePayment(months: MonthLedger[], amount: number): { key: number; amount: number }[] {
  if (amount <= 0) throw new Error("amount phải > 0")
  if (months.length === 0) throw new Error("months rỗng")
  const out = new Map<number, number>()
  let left = amount
  for (const d of outstandingDebts(months)) {
    if (left === 0) break
    const a = Math.min(left, d.amount)
    out.set(d.key, a)
    left -= a
  }
  if (left > 0) {
    const last = Math.max(...months.map((m) => m.key))
    out.set(last, (out.get(last) ?? 0) + left)
  }
  return [...out].map(([key, a]) => ({ key, amount: a }))
}

export function keyToYearMonth(key: number): { year: number; month: number } {
  return { year: Math.floor(key / 12), month: (key % 12) + 1 }
}
