import { describe, it, expect } from "vitest"
import { buildAccountTrend, computeAccountCards, lastNDays, type StatUser } from "@/lib/admin-stats"

const NOW = new Date("2026-11-15T05:00:00Z") // 12:00 VN 15/11/2026
const DAY = 24 * 60 * 60 * 1000
const at = (days: number) => new Date(NOW.getTime() + days * DAY)
const user = (p: Partial<StatUser> = {}): StatUser => ({
  isActive: true, plan: "standard", planExpiresAt: null, trialEndsAt: null, lastActiveAt: null, ...p,
})

describe("computeAccountCards (spec K A1–A10)", () => {
  it("tổng gồm cả tài khoản khóa; thẻ gói bỏ tài khoản khóa", () => {
    const c = computeAccountCards(
      [user(), user({ isActive: false, plan: "pro", planExpiresAt: at(100) }), user({ isActive: false, trialEndsAt: at(5) })],
      NOW
    )
    expect(c.totalAccounts).toBe(3)
    expect(c.activeAccounts).toBe(1)
    expect(c.paying).toEqual({ plus: 0, pro: 0 })
    expect(c.trial).toBe(0)
  })

  it("trả phí còn hạn tách Plus/Pro, tính cả khi đang dùng thử song song; hết hạn không tính", () => {
    const c = computeAccountCards(
      [
        user({ plan: "plus", planExpiresAt: at(100), trialEndsAt: at(10) }),
        user({ plan: "pro", planExpiresAt: at(200) }),
        user({ plan: "pro", planExpiresAt: at(-1) }),
      ],
      NOW
    )
    expect(c.paying).toEqual({ plus: 1, pro: 1 })
    expect(c.trial).toBe(0)
  })

  it("dùng thử còn hạn không có gói trả phí → Đang dùng thử", () => {
    expect(computeAccountCards([user({ trialEndsAt: at(20) }), user({ trialEndsAt: at(-1) })], NOW).trial).toBe(1)
  })

  it("sắp hết hạn: biên đúng 30 ngày tính, 30 ngày + 1 phút không; Plus + dùng thử sắp hết không tính dùng thử", () => {
    const c = computeAccountCards(
      [
        user({ plan: "plus", planExpiresAt: at(30) }),
        user({ plan: "pro", planExpiresAt: new Date(at(30).getTime() + 60_000) }),
        user({ trialEndsAt: at(3) }),
        user({ plan: "plus", planExpiresAt: at(300), trialEndsAt: at(3) }),
      ],
      NOW
    )
    expect(c.expiringSoon).toEqual({ paid: 1, trial: 1 })
  })

  it("Standard sau dùng thử: hết dùng thử, không trả phí, dùng app trong 30 ngày; trialEndsAt null không tính", () => {
    const c = computeAccountCards(
      [
        user({ trialEndsAt: at(-10), lastActiveAt: at(-30) }),
        user({ trialEndsAt: at(-10), lastActiveAt: new Date(at(-30).getTime() - 60_000) }),
        user({ trialEndsAt: at(-10), lastActiveAt: at(-1), plan: "plus", planExpiresAt: at(-2) }),
        user({ trialEndsAt: null, lastActiveAt: at(-1) }),
        user({ trialEndsAt: at(-10), lastActiveAt: at(-1), plan: "plus", planExpiresAt: at(50) }),
        user({ trialEndsAt: at(-10), lastActiveAt: at(-1), isActive: false }),
      ],
      NOW
    )
    expect(c.standardAfterTrial).toBe(2)
  })

  it("Active 24h theo lastActiveAt, biên đúng 24 giờ", () => {
    const c = computeAccountCards(
      [user({ lastActiveAt: at(-1) }), user({ lastActiveAt: new Date(at(-1).getTime() - 60_000) }), user({ lastActiveAt: null })],
      NOW
    )
    expect(c.active24h).toBe(1)
  })

  it("Active 24h bỏ tài khoản bị khoá (spec U U26)", () => {
    const c = computeAccountCards([user({ isActive: false, lastActiveAt: at(-0.1) }), user({ lastActiveAt: at(-0.1) })], NOW)
    expect(c.active24h).toBe(1)
  })
})

describe("lastNDays", () => {
  it("cũ → mới, phần tử cuối là hôm nay giờ VN, qua tháng/năm", () => {
    expect(lastNDays(new Date("2026-11-30T17:30:00Z"), 3)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"])
    expect(lastNDays(new Date("2027-01-01T01:00:00Z"), 2)).toEqual(["2026-12-31", "2027-01-01"])
    expect(lastNDays(NOW, 30)).toHaveLength(30)
  })
})

describe("buildAccountTrend (spec K T1–T5)", () => {
  const days = ["2026-11-13", "2026-11-14", "2026-11-15"]
  it("điền 0, cột cuối isToday, tổng, trung bình 1 chữ số, ngày đông nhất hòa lấy ngày gần hơn", () => {
    const t = buildAccountTrend(
      days,
      [{ day: "2026-11-13", count: 2 }, { day: "2026-11-15", count: 2 }],
      [{ day: "2026-11-14", count: 5 }],
      "2026-11-01"
    )
    expect(t.days).toEqual([
      { day: "2026-11-13", newAccounts: 2, returning: 0, isToday: false },
      { day: "2026-11-14", newAccounts: 0, returning: 5, isToday: false },
      { day: "2026-11-15", newAccounts: 2, returning: 0, isToday: true },
    ])
    expect(t.totals).toEqual({ newAccounts: 4, avgPerDay: 1.3, returning: 5, busiestDay: { day: "2026-11-15", count: 2 } })
    expect(t.trackingSince).toBe("2026-11-01")
  })
  it("không có tài khoản mới → busiestDay null, trung bình 0", () => {
    const t = buildAccountTrend(days, [], [], null)
    expect(t.totals).toEqual({ newAccounts: 0, avgPerDay: 0, returning: 0, busiestDay: null })
    expect(t.trackingSince).toBeNull()
  })
})
