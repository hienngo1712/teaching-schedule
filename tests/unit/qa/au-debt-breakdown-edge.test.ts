// QA gói AU: ca biên tách nợ (bất biến ngẫu nhiên, khớp allocatePayment, refactor computeClosingBalances giữ kết quả).
import { describe, it, expect, vi } from "vitest"

vi.mock("@/server/services/billing.service", () => ({ loadBillingChanges: vi.fn(async () => new Map()) }))

import type { PrismaClient } from "@prisma/client"
import { splitDebt, type DebtPart } from "@/lib/debt-breakdown"
import { allocatePayment, type MonthLedger } from "@/lib/payment-allocation"
import { computeClosingBalances } from "@/server/services/tuition.service"

// Bộ sinh số giả ngẫu nhiên cố định hạt giống → test lặp lại được.
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
}

// Dư nợ cuối tháng theo đúng công thức computeClosingBalances / allocatePayment.
function closing(ledgers: MonthLedger[], lastKey: number): number {
  let bal = 0
  for (const m of [...ledgers].sort((a, b) => a.key - b.key)) {
    if (m.key > lastKey) break
    const r = bal + m.fee - m.paid
    bal = m.fullPaid ? Math.min(0, r) : r
  }
  return bal
}

function randomLedgers(next: () => number, first: number, last: number): MonthLedger[] {
  const out: MonthLedger[] = []
  for (let key = first; key <= last; key++) {
    if (next() < 0.15) continue // tháng trống
    const fee = Math.floor(next() * 5) * 50000
    const r = next()
    const paid = r < 0.4 ? 0 : r < 0.7 ? Math.floor(next() * fee / 10000) * 10000 : r < 0.9 ? fee : fee + Math.floor(next() * 4) * 50000
    out.push({ key, fee, paid, fullPaid: next() < 0.1 })
  }
  return out
}

const LAST = 2026 * 12 + 8 // tháng 9/2026
const sum = (p: DebtPart[]) => p.reduce((s, x) => s + x.amount, 0)

describe("splitDebt — bất biến trên 2000 bộ sổ ngẫu nhiên (QA AU)", () => {
  it("dư nợ > 0 thì luôn tách được; tổng = dư nợ; mỗi dòng > 0, tăng dần, ≤ học phí tháng đó; tối đa 13 dòng", () => {
    const next = rng(42)
    let checked = 0
    for (let i = 0; i < 2000; i++) {
      const ledgers = randomLedgers(next, LAST - 20, LAST)
      const prev = closing(ledgers, LAST)
      const parts = splitDebt(ledgers, LAST, prev)
      if (prev <= 0) {
        expect(parts).toBeNull()
        continue
      }
      checked++
      expect(parts).not.toBeNull()
      expect(sum(parts!)).toBe(prev)
      expect(parts!.length).toBeLessThanOrEqual(13)
      const fees = new Map(ledgers.map((l) => [l.key, l.fee]))
      let lastK = -Infinity
      for (const p of parts!) {
        const k = p.year * 12 + p.month - 1
        expect(p.amount).toBeGreaterThan(0)
        expect(k).toBeLessThanOrEqual(LAST)
        expect(k).toBeGreaterThanOrEqual(LAST - 11)
        if (!p.before) {
          expect(k).toBeGreaterThan(lastK)
          expect(p.amount).toBeLessThanOrEqual(fees.get(k)!)
          lastK = k
        }
      }
      // "Trước tháng N" chỉ đứng đầu, N = tháng đầu cửa sổ 12 tháng.
      parts!.slice(1).forEach((p) => expect(p.before).toBeUndefined())
      if (parts![0].before) expect(parts![0].year * 12 + parts![0].month - 1).toBe(LAST - 11)
    }
    expect(checked).toBeGreaterThan(300)
  })

  it("khớp allocatePayment: ghi thêm khoản thu X (chia FIFO) → bảng tách mới = bảng cũ trừ X từ tháng cũ nhất", () => {
    const next = rng(7)
    let checked = 0
    for (let i = 0; i < 1000; i++) {
      // Bỏ tháng miễn: allocatePayment (có từ trước AU) có thể chia tiền vào tháng nằm trước tháng miễn → tiền bị miễn mất (ghi ở báo cáo QA, ngoài phạm vi AU).
      const ledgers = randomLedgers(next, LAST - 10, LAST).map((l) => ({ ...l, fullPaid: false }))
      const prev = closing(ledgers, LAST)
      if (prev <= 50000 || ledgers.length === 0) continue
      const before = splitDebt(ledgers, LAST, prev)!
      const x = Math.max(10000, Math.floor((next() * (prev - 10000)) / 10000) * 10000)
      const alloc = allocatePayment(ledgers, x)
      const after = ledgers.map((l) => ({ ...l, paid: l.paid + (alloc.find((a) => a.key === l.key)?.amount ?? 0) }))
      expect(closing(after, LAST)).toBe(prev - x)
      // FIFO tay trên bảng cũ.
      let left = x
      const expected: DebtPart[] = []
      for (const p of before) {
        const take = Math.min(left, p.amount)
        left -= take
        if (p.amount - take > 0) expected.push({ ...p, amount: p.amount - take })
      }
      expect(splitDebt(after, LAST, prev - x)).toEqual(expected.length ? expected : null)
      checked++
    }
    expect(checked).toBeGreaterThan(100)
  })

  it("tháng miễn khi đang có tín dụng: giữ tín dụng, tháng sau trừ tín dụng trước", () => {
    const k = (m: number) => 2026 * 12 + m - 1
    // T6 trả dư 100k (tín dụng), T7 miễn (học phí 50k, không thu) → còn tín dụng 50k; T8 150k → nợ 100k.
    const ledgers: MonthLedger[] = [
      { key: k(6), fee: 100000, paid: 200000, fullPaid: false },
      { key: k(7), fee: 50000, paid: 0, fullPaid: true },
      { key: k(8), fee: 150000, paid: 0, fullPaid: false },
    ]
    expect(closing(ledgers, k(8))).toBe(100000)
    expect(splitDebt(ledgers, k(8), 100000)).toEqual([{ year: 2026, month: 8, amount: 100000 }])
  })

  it("dư nợ = 0 sau khi trả đủ đúng lúc (không còn dòng) → null", () => {
    const k = (m: number) => 2026 * 12 + m - 1
    expect(splitDebt([{ key: k(8), fee: 100000, paid: 100000, fullPaid: false }], k(8), 0)).toBeNull()
  })

  it("số thu âm (dữ liệu lạ) → null, không hiện số sai", () => {
    const k = (m: number) => 2026 * 12 + m - 1
    expect(splitDebt([{ key: k(8), fee: 100000, paid: -50000, fullPaid: false }], k(8), 150000)).toBeNull()
  })
})

describe("computeClosingBalances sau refactor — giữ đúng kết quả công thức cũ (QA AU)", () => {
  it("nhiều HS, tháng trống, miễn, trả dư, có ca vắng/chưa điểm danh: khớp bản tính tay theo code cũ", async () => {
    const next = rng(2026)
    const studentIds = [1, 2, 3, 4]
    const snaps: { studentId: number; year: number; month: number; paidAmount: number; isFullPaid: boolean }[] = []
    const links: { studentId: number; fee: number; attendance: string; session: { sessionDate: Date } }[] = []
    const ATT = ["present", "late", "absent", "pending"]
    for (const sid of studentIds) {
      for (let m = 0; m < 18; m++) {
        const year = 2025 + Math.floor((m + 3) / 12)
        const month = ((m + 3) % 12) + 1 // 4/2025 → 9/2026
        if (next() < 0.2) continue
        const n = Math.floor(next() * 4)
        for (let s = 0; s < n; s++) {
          links.push({ studentId: sid, fee: 100000, attendance: ATT[Math.floor(next() * 4)], session: { sessionDate: new Date(Date.UTC(year, month - 1, 3 + s * 7)) } })
        }
        if (next() < 0.7) snaps.push({ studentId: sid, year, month, paidAmount: Math.floor(next() * 5) * 50000, isFullPaid: next() < 0.1 })
      }
    }
    const db = {
      monthlyTuition: { findMany: vi.fn(async () => snaps) },
      sessionStudent: { findMany: vi.fn(async () => links) },
    } as unknown as PrismaClient
    const got = await computeClosingBalances(db, 1, studentIds, 2026, 10)

    // Bản tính tay theo đúng vòng lặp computeClosingBalances trên main (trước AU), billing mặc định = theo buổi.
    for (const sid of studentIds) {
      const months = new Map<number, { fee: number; paid: number; fullPaid: boolean }>()
      const slot = (key: number) => months.get(key) ?? months.set(key, { fee: 0, paid: 0, fullPaid: false }).get(key)!
      for (const s of snaps.filter((x) => x.studentId === sid)) {
        const d = slot(s.year * 12 + s.month - 1)
        d.paid = s.paidAmount
        d.fullPaid = s.isFullPaid
      }
      for (const l of links.filter((x) => x.studentId === sid)) {
        const d = slot(l.session.sessionDate.getUTCFullYear() * 12 + l.session.sessionDate.getUTCMonth())
        if (l.attendance === "present" || l.attendance === "late") d.fee += l.fee
      }
      const want = new Map<number, number>()
      let bal = 0
      for (let key = Math.min(...months.keys()); key <= 2026 * 12 + 8; key++) {
        const d = months.get(key)
        if (d) {
          const r = bal + d.fee - d.paid
          bal = d.fullPaid ? Math.min(0, r) : r
        }
        want.set(key, bal)
      }
      expect(got.get(sid)).toEqual(want)
    }
  })
})
