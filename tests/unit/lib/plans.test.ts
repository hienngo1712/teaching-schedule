import { describe, it, expect } from "vitest"
import {
  addDays,
  addMonthsVn,
  computeBonusMonths,
  computeNewExpiry,
  computeUpgradeCredit,
  daysLeft,
  effectivePlan,
  expiryFromLastDay,
  FEATURE_PLAN,
  featuresAddedIn,
  formatValidUntil,
  hasFeature,
  isMultiMonthReport,
  minPlanForStudents,
  orderBlockedUntil,
  paidDaysLeft,
  PLAN_FEATURES,
  PLAN_PRICES,
  planBanner,
  planLabel,
  planRequiredOf,
  renewOffer,
  studentLimit,
  trialEndFor,
  vnStartOfDay,
  type PlanFields,
} from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"

// Giờ VN dạng "YYYY-MM-DDTHH:mm" → Date.
const vn = (s: string) => new Date(`${s}:00+07:00`)
const iso = (d: Date | null) => d?.toISOString() ?? null
const u = (p: Partial<PlanFields> = {}): PlanFields => ({ plan: "standard", planExpiresAt: null, trialEndsAt: null, ...p })
const NOW = vn("2026-09-26T10:00")
const TODAY = vnStartOfDay(NOW)
// Gói trả phí còn đúng `d` ngày (hạn = 00:00 VN của hôm nay + d).
const paidLeft = (plan: "plus" | "pro", d: number) => u({ plan, planExpiresAt: addDays(TODAY, d) })

describe("vnStartOfDay / addDays", () => {
  it("06:59 VN vẫn là ngày VN đó (UTC còn ngày hôm trước)", () => {
    expect(iso(vnStartOfDay(vn("2026-09-26T06:59")))).toBe("2026-09-25T17:00:00.000Z")
    expect(iso(vnStartOfDay(vn("2026-09-26T23:59")))).toBe("2026-09-25T17:00:00.000Z")
    expect(iso(vnStartOfDay(vn("2026-09-26T00:00")))).toBe("2026-09-25T17:00:00.000Z")
  })
  it("addDays cộng đúng số ngày", () => {
    expect(iso(addDays(vn("2026-09-26T00:00"), 60))).toBe(iso(vn("2026-11-25T00:00")))
  })
})

describe("giá", () => {
  it("kỳ 2 năm gấp đôi giá năm (P1)", () => {
    expect(PLAN_PRICES).toEqual({
      plus: { month: 49000, year: 490000, "2year": 980000 },
      pro: { month: 99000, year: 990000, "2year": 1980000 },
    })
  })
})

describe("effectivePlan", () => {
  const F = vn("2026-10-10T00:00")
  const P = vn("2026-09-01T00:00")
  it("không gì → standard/free", () => {
    expect(effectivePlan(u(), NOW)).toEqual({ plan: "standard", source: "free", expiresAt: null })
  })
  it("trial còn hạn → pro/trial", () => {
    expect(effectivePlan(u({ trialEndsAt: F }), NOW)).toEqual({ plan: "pro", source: "trial", expiresAt: F })
  })
  it("trial hết + Plus còn hạn → plus/paid", () => {
    expect(effectivePlan(u({ plan: "plus", planExpiresAt: F, trialEndsAt: P }), NOW)).toEqual({ plan: "plus", source: "paid", expiresAt: F })
  })
  it("Plus còn hạn + trial còn hạn → pro/trial (D5 lấy gói cao hơn)", () => {
    const T = vn("2026-10-05T00:00")
    expect(effectivePlan(u({ plan: "plus", planExpiresAt: F, trialEndsAt: T }), NOW)).toEqual({ plan: "pro", source: "trial", expiresAt: T })
  })
  it("Pro còn hạn + trial → pro/paid (hòa hạng tính paid)", () => {
    expect(effectivePlan(u({ plan: "pro", planExpiresAt: F, trialEndsAt: vn("2026-12-01T00:00") }), NOW)).toEqual({ plan: "pro", source: "paid", expiresAt: F })
  })
  it("đúng mốc hạn (now = expiresAt) → đã hết", () => {
    expect(effectivePlan(u({ plan: "plus", planExpiresAt: F }), F).plan).toBe("standard")
    expect(effectivePlan(u({ trialEndsAt: F }), F).plan).toBe("standard")
  })
  it("mốc giờ VN: 23:30 ngày cuối còn hạn, 00:00 hôm sau hết", () => {
    const exp = vn("2026-09-27T00:00")
    expect(effectivePlan(u({ plan: "plus", planExpiresAt: exp }), vn("2026-09-26T23:30")).plan).toBe("plus")
    expect(effectivePlan(u({ plan: "plus", planExpiresAt: exp }), vn("2026-09-27T00:00")).plan).toBe("standard")
  })
  it("giá trị plan lạ trong DB → coi như standard", () => {
    expect(effectivePlan(u({ plan: "gold", planExpiresAt: F }), NOW).plan).toBe("standard")
  })
})

describe("hasFeature / studentLimit / minPlanForStudents / planLabel", () => {
  it("bậc thang: gói trên có đủ gói dưới", () => {
    expect(hasFeature("standard", "payments")).toBe(false)
    expect(hasFeature("plus", "payments")).toBe(true)
    expect(hasFeature("plus", "monthlyReport")).toBe(true)
    expect(hasFeature("plus", "multiMonthReport")).toBe(false)
    expect(hasFeature("plus", "parentLink")).toBe(false)
    for (const f of ["payments", "tuitionNotice", "monthlyReport", "parentLink", "dashboardAlerts", "studentImport", "multiMonthReport"] as const) {
      expect(hasFeature("pro", f)).toBe(true)
    }
  })
  it("giới hạn HS 10 / 40 / không giới hạn", () => {
    expect([studentLimit("standard"), studentLimit("plus"), studentLimit("pro")]).toEqual([10, 40, null])
  })
  it("gói nhỏ nhất đủ chỗ", () => {
    expect(minPlanForStudents(11)).toBe("plus")
    expect(minPlanForStudents(40)).toBe("plus")
    expect(minPlanForStudents(41)).toBe("pro")
  })
  it("planLabel: tên gói, giá trị lạ giữ nguyên", () => {
    expect([planLabel("standard"), planLabel("plus"), planLabel("pro"), planLabel("gold")]).toEqual(["Standard", "Plus", "Pro", "gold"])
  })
})

describe("PLAN_FEATURES (P11: bậc thang không lặp, 1 nguồn với chặn quyền)", () => {
  it("không id nào lặp; mỗi thẻ chỉ liệt kê tính năng gói đó thêm mới, không tính năng nào ở 2 thẻ", () => {
    const ids = PLAN_FEATURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    const std = featuresAddedIn("standard")
    const plus = featuresAddedIn("plus")
    const pro = featuresAddedIn("pro")
    expect(std.filter((id) => plus.includes(id) || pro.includes(id))).toEqual([])
    expect(plus.filter((id) => pro.includes(id))).toEqual([])
    expect([...std, ...plus, ...pro].sort()).toEqual([...ids].sort())
  })
  it("mọi tính năng bị chặn quyền có trong danh sách, gắn đúng gói của FEATURE_PLAN", () => {
    for (const [feature, plan] of Object.entries(FEATURE_PLAN)) {
      expect(PLAN_FEATURES.filter((f) => f.id === feature).map((f) => f.plan)).toEqual([plan])
    }
  })
  it("thẻ Standard / Plus / Pro", () => {
    expect(featuresAddedIn("standard")).toEqual(["schedule", "attendance", "students", "tuitionCalc", "dashboardStats", "backup"])
    expect(featuresAddedIn("plus")).toEqual(["payments", "tuitionNotice", "monthlyReport"])
    expect(featuresAddedIn("pro")).toEqual(["parentLink", "dashboardAlerts", "studentImport", "multiMonthReport", "unlimitedStudents"])
  })
})

describe("isMultiMonthReport (D10)", () => {
  it.each([
    [{ year: 2026, month: 5 }, false],
    [{ year: 2026, month: 5, toYear: 2026, toMonth: 5 }, false],
    [{ year: 2026, month: 5, toMonth: 5 }, false],
    [{ year: 2026, month: 1, toYear: 2026, toMonth: 12 }, true],
    [{ year: 2026, month: 5, toMonth: 6 }, true],
    [{ year: 2026, month: 5, toYear: 2027 }, true],
    [{ year: 2026, month: 5, grade: 3 }, true],
  ])("%j → %s", (input, expected) => {
    expect(isMultiMonthReport(input)).toBe(expected)
  })
})

describe("computeNewExpiry (D6)", () => {
  it("mua mới: từ đầu ngày VN hôm nay (tháng / năm / 2 năm)", () => {
    expect(iso(computeNewExpiry(u(), "plus", "month", NOW))).toBe(iso(vn("2026-10-26T00:00")))
    expect(iso(computeNewExpiry(u(), "pro", "year", NOW))).toBe(iso(vn("2027-09-26T00:00")))
    expect(iso(computeNewExpiry(u(), "pro", "2year", NOW))).toBe(iso(vn("2028-09-26T00:00")))
  })
  it("gia hạn cùng gói còn hạn: cộng dồn", () => {
    const x = u({ plan: "plus", planExpiresAt: vn("2026-10-10T00:00") })
    expect(iso(computeNewExpiry(x, "plus", "month", NOW))).toBe(iso(vn("2026-11-10T00:00")))
  })
  it("tháng tặng cộng chung với kỳ mua", () => {
    const x = paidLeft("plus", 45)
    expect(iso(computeNewExpiry(x, "plus", "year", NOW, 2))).toBe(iso(addMonthsVn(addDays(TODAY, 45), 14)))
  })
  it("gói cũ đã hết hạn: tính từ hôm nay", () => {
    const x = u({ plan: "plus", planExpiresAt: vn("2026-09-01T00:00") })
    expect(iso(computeNewExpiry(x, "plus", "month", NOW))).toBe(iso(vn("2026-10-26T00:00")))
  })
  it("mua trong trial: tính từ trialEndsAt", () => {
    const x = u({ trialEndsAt: vn("2026-10-20T00:00") })
    expect(iso(computeNewExpiry(x, "plus", "month", NOW))).toBe(iso(vn("2026-11-20T00:00")))
  })
  it("Plus còn hạn → mua Pro: tính từ hôm nay (ngày quy đổi cộng riêng)", () => {
    const x = u({ plan: "plus", planExpiresAt: vn("2026-12-01T00:00") })
    expect(iso(computeNewExpiry(x, "pro", "month", NOW))).toBe(iso(vn("2026-10-26T00:00")))
  })
  it("31/1 + 1 tháng = 28/2 (năm thường) hoặc 29/2 (năm nhuận)", () => {
    expect(iso(computeNewExpiry(u(), "plus", "month", vn("2027-01-31T08:00")))).toBe(iso(vn("2027-02-28T00:00")))
    expect(iso(computeNewExpiry(u(), "plus", "month", vn("2028-01-31T08:00")))).toBe(iso(vn("2028-02-29T00:00")))
  })
  it("+1 năm từ 29/2 → 28/2 năm sau", () => {
    expect(iso(computeNewExpiry(u(), "pro", "year", vn("2028-02-29T08:00")))).toBe(iso(vn("2029-02-28T00:00")))
  })
})

describe("orderBlockedUntil (D7 Pro → Plus)", () => {
  it("Pro trả phí còn hạn đặt Plus → trả hạn Pro", () => {
    const exp = vn("2026-12-01T00:00")
    expect(orderBlockedUntil(u({ plan: "pro", planExpiresAt: exp }), "plus", NOW)).toEqual(exp)
  })
  it("Pro hết hạn, đặt Pro, hoặc chỉ trial → không chặn", () => {
    expect(orderBlockedUntil(u({ plan: "pro", planExpiresAt: vn("2026-09-01T00:00") }), "plus", NOW)).toBeNull()
    expect(orderBlockedUntil(u({ plan: "pro", planExpiresAt: vn("2026-12-01T00:00") }), "pro", NOW)).toBeNull()
    expect(orderBlockedUntil(u({ trialEndsAt: vn("2026-12-01T00:00") }), "plus", NOW)).toBeNull()
  })
})

describe("paidDaysLeft / computeBonusMonths (spec 6.6)", () => {
  it("paidDaysLeft: chỉ gói trả phí còn hạn, ngày dùng cuối = 1", () => {
    expect(paidDaysLeft(paidLeft("plus", 1), NOW)).toBe(1)
    expect(paidDaysLeft(paidLeft("plus", 45), NOW)).toBe(45)
    expect(paidDaysLeft(paidLeft("plus", 0), NOW)).toBeNull()
    expect(paidDaysLeft(u({ trialEndsAt: addDays(TODAY, 20) }), NOW)).toBeNull()
    expect(paidDaysLeft(u(), NOW)).toBeNull()
  })
  it.each([
    [61, 0, 2],
    [60, 2, 4],
    [31, 2, 4],
    [30, 1, 2],
    [1, 1, 2],
    [0, 0, 2],
  ])("gia hạn cùng gói còn %i ngày → 1 năm +%i, 2 năm +%i", (d, year, twoYear) => {
    const x = paidLeft("plus", d)
    expect(computeBonusMonths(x, "plus", "year", NOW)).toBe(year)
    expect(computeBonusMonths(x, "plus", "2year", NOW)).toBe(twoYear)
  })
  it("kỳ tháng luôn 0", () => {
    for (const d of [0, 1, 30, 31, 45, 60, 61]) expect(computeBonusMonths(paidLeft("pro", d), "pro", "month", NOW)).toBe(0)
    expect(computeBonusMonths(u(), "pro", "month", NOW)).toBe(0)
  })
  it("mua mới / đang trial: 1 năm 0, 2 năm +2 (trial không tính là gia hạn sớm)", () => {
    expect(computeBonusMonths(u(), "plus", "year", NOW)).toBe(0)
    expect(computeBonusMonths(u(), "plus", "2year", NOW)).toBe(2)
    const trial = u({ trialEndsAt: addDays(TODAY, 20) })
    expect(computeBonusMonths(trial, "pro", "year", NOW)).toBe(0)
    expect(computeBonusMonths(trial, "pro", "2year", NOW)).toBe(2)
  })
  it("2 năm không cộng dồn: còn 45 ngày được +4 (không phải 2 + 4)", () => {
    expect(computeBonusMonths(paidLeft("pro", 45), "pro", "2year", NOW)).toBe(4)
  })
  it("Plus → Pro năm còn 45 ngày: +2 tháng và có ngày quy đổi", () => {
    const x = paidLeft("plus", 45)
    expect(computeBonusMonths(x, "pro", "year", NOW)).toBe(2)
    // 490.000 × 45/365 = 60.411đ → floor(60.411 × 365 / 990.000) = 22 ngày Pro.
    expect(computeUpgradeCredit(x, { amount: 490000, period: "year", bonusMonths: 0 }, "year", NOW)).toEqual({ remainingValue: 60411, creditDays: 22 })
  })
})

describe("computeUpgradeCredit (D7 quy đổi)", () => {
  // Plus năm mua 01/01/2026 → hạn 01/01/2027. Ngày 03/03/2026 đã dùng 61 ngày, còn 304/365.
  const plusYear = u({ plan: "plus", planExpiresAt: vn("2027-01-01T00:00") })
  const now = vn("2026-03-03T10:00")
  const order = { amount: 490000, period: "year", bonusMonths: 0 }

  it("ví dụ spec: còn 408.110đ → Pro năm +150 ngày, Pro tháng +123 ngày (Pro 2 năm cùng đơn giá năm)", () => {
    expect(computeUpgradeCredit(plusYear, order, "year", now)).toEqual({ remainingValue: 408110, creditDays: 150 })
    expect(computeUpgradeCredit(plusYear, order, "month", now)).toEqual({ remainingValue: 408110, creditDays: 123 })
    expect(computeUpgradeCredit(plusYear, order, "2year", now)).toEqual({ remainingValue: 408110, creditDays: 150 })
  })
  it("Plus tháng 49.000đ còn 10 ngày → Pro tháng +4 ngày (làm tròn xuống)", () => {
    expect(computeUpgradeCredit(paidLeft("plus", 10), { amount: 49000, period: "month", bonusMonths: 0 }, "month", NOW)).toEqual({ remainingValue: 16333, creditDays: 4 })
  })
  it("đơn tặng 0đ hoặc admin đặt tay (period null) → 0 ngày", () => {
    expect(computeUpgradeCredit(plusYear, { amount: 0, period: "year", bonusMonths: 0 }, "year", now)).toEqual({ remainingValue: 0, creditDays: 0 })
    expect(computeUpgradeCredit(plusYear, { amount: 490000, period: null, bonusMonths: 0 }, "year", now)).toEqual({ remainingValue: 0, creditDays: 0 })
    expect(computeUpgradeCredit(plusYear, null, "year", now)).toEqual({ remainingValue: 0, creditDays: 0 })
  })
  it("Plus mua trong trial (còn 400 ngày) → chặn trên bằng cả kỳ: không vượt số tiền đã trả", () => {
    expect(computeUpgradeCredit(paidLeft("plus", 400), order, "year", NOW)).toEqual({ remainingValue: 490000, creditDays: 180 })
  })
  it("Plus 2 năm có +2 tháng tặng, đã dùng 60 ngày → tổng ngày tính cả tháng tặng, không quy đổi đủ 980.000đ", () => {
    // Mua 01/01/2026, hạn 01/03/2028 (26 tháng = 790 ngày); 02/03/2026 còn 730 ngày trên 730 + 61.
    const x = u({ plan: "plus", planExpiresAt: vn("2028-03-01T00:00") })
    const r = computeUpgradeCredit(x, { amount: 980000, period: "2year", bonusMonths: 2 }, "year", vn("2026-03-02T10:00"))
    expect(r.remainingValue).toBe(Math.round((980000 * 730) / 791))
    expect(r.remainingValue).toBeLessThan(980000)
  })
  it("Plus năm gia hạn sớm +2 tháng, đã dùng 60 ngày → chia cho 365 + 61 ngày", () => {
    const x = u({ plan: "plus", planExpiresAt: vn("2027-03-01T00:00") })
    const r = computeUpgradeCredit(x, { amount: 490000, period: "year", bonusMonths: 2 }, "year", vn("2026-03-02T10:00"))
    expect(r.remainingValue).toBe(Math.round((490000 * 364) / 426))
  })
  it("Plus đã hết hạn hoặc đang là Pro → 0", () => {
    expect(computeUpgradeCredit(u({ plan: "plus", planExpiresAt: vn("2026-03-01T00:00") }), order, "year", now).creditDays).toBe(0)
    expect(computeUpgradeCredit(u({ plan: "pro", planExpiresAt: vn("2027-01-01T00:00") }), order, "year", now).creditDays).toBe(0)
  })
})

describe("trialEndFor / daysLeft / formatValidUntil / expiryFromLastDay", () => {
  it("dùng thử: ngày đăng ký là ngày 1, hạn = 00:00 VN của ngày thứ 61", () => {
    expect(iso(trialEndFor(vn("2026-09-26T23:59")))).toBe(iso(vn("2026-11-25T00:00")))
    expect(iso(trialEndFor(vn("2026-09-26T00:30")))).toBe(iso(vn("2026-11-25T00:00")))
  })
  it("daysLeft tính cả hôm nay", () => {
    expect(daysLeft(vn("2026-09-27T00:00"), vn("2026-09-26T23:30"))).toBe(1)
    expect(daysLeft(vn("2026-10-03T00:00"), vn("2026-09-26T08:00"))).toBe(7)
    expect(daysLeft(vn("2026-09-26T00:00"), vn("2026-09-26T08:00"))).toBe(0)
  })
  it("Dùng đến hết ngày = ngày VN của (hạn − 1ms)", () => {
    expect(formatValidUntil(vn("2026-09-27T00:00"))).toBe("26/09/2026")
  })
  it("ngày dùng cuối → hạn 00:00 VN hôm sau", () => {
    expect(iso(expiryFromLastDay("2026-12-31"))).toBe(iso(vn("2027-01-01T00:00")))
  })
})

describe("planRequiredOf", () => {
  it("đọc data.planRequired của lỗi tRPC phía client", () => {
    expect(planRequiredOf({ data: { planRequired: "pro" } })).toBe("pro")
    expect(planRequiredOf({ data: { planRequired: null } })).toBeNull()
    expect(planRequiredOf(new Error("x"))).toBeNull()
    expect(planRequiredOf(undefined)).toBeNull()
  })
})

describe("planBanner (spec 8.5)", () => {
  it("trial còn 3 ngày → trial_ending", () => {
    const exp = vn("2026-09-29T00:00")
    expect(planBanner(u({ trialEndsAt: exp }), NOW, false)).toEqual({ kind: "trial_ending", plan: "pro", days: 3, key: iso(exp) })
  })
  it("trial còn 20 ngày → không hiện", () => {
    expect(planBanner(u({ trialEndsAt: vn("2026-10-16T00:00") }), NOW, false)).toBeNull()
  })
  it("gói trả phí còn 2 ngày → không hiện (nhường popup 8.6)", () => {
    expect(planBanner(paidLeft("plus", 2), NOW, false)).toBeNull()
  })
  it("có đơn chờ → không hiện", () => {
    expect(planBanner(u({ trialEndsAt: vn("2026-09-29T00:00") }), NOW, true)).toBeNull()
  })
  it("Plus hết hạn 2 ngày trước → expired; 10 ngày trước → không hiện", () => {
    const exp = vn("2026-09-24T00:00")
    expect(planBanner(u({ plan: "plus", planExpiresAt: exp }), NOW, false)).toEqual({ kind: "expired", plan: "plus", days: 0, key: iso(exp) })
    expect(planBanner(u({ plan: "plus", planExpiresAt: vn("2026-09-16T00:00") }), NOW, false)).toBeNull()
  })
  it("trial hết hôm qua → expired gói Pro", () => {
    const exp = vn("2026-09-26T00:00")
    expect(planBanner(u({ trialEndsAt: exp }), NOW, false)).toEqual({ kind: "expired", plan: "pro", days: 0, key: iso(exp) })
  })
  it("Standard từ đầu → không hiện; Pro 2099 → không hiện", () => {
    expect(planBanner(u(), NOW, false)).toBeNull()
    expect(planBanner(u({ plan: "pro", planExpiresAt: new Date("2099-12-31T17:00:00Z") }), NOW, false)).toBeNull()
  })
})

describe("renewOffer (spec 8.6)", () => {
  it("còn 45 ngày: ưu đãi 2 năm +4, 1 năm +2; sau ngày còn 31 ngày giảm còn +2 / +1", () => {
    const x = paidLeft("plus", 45)
    const offer = renewOffer(x, NOW, false)
    expect(offer).toMatchObject({ plan: "plus", daysLeft: 45, year: 2, twoYear: 4, after: { year: 1, twoYear: 2 } })
    expect(iso(offer!.expiresAt)).toBe(iso(addDays(TODAY, 45)))
    // Ngày cuối còn 31 ngày = hôm nay + 14 → "Sau ngày 10/10" ưu đãi giảm.
    expect(formatVnDate(offer!.dropsAfter!)).toBe("10/10/2026")
  })
  it("còn 10 ngày: +2 / +1, không có mốc giảm (hết hạn là mất ưu đãi)", () => {
    expect(renewOffer(paidLeft("pro", 10), NOW, false)).toMatchObject({ plan: "pro", daysLeft: 10, year: 1, twoYear: 2, dropsAfter: null, after: null })
  })
  it("còn 60 ngày có, 61 ngày không; có đơn chờ, trial, Standard, đã hết hạn → không", () => {
    expect(renewOffer(paidLeft("plus", 60), NOW, false)?.daysLeft).toBe(60)
    expect(renewOffer(paidLeft("plus", 61), NOW, false)).toBeNull()
    expect(renewOffer(paidLeft("plus", 45), NOW, true)).toBeNull()
    expect(renewOffer(u({ trialEndsAt: addDays(TODAY, 5) }), NOW, false)).toBeNull()
    expect(renewOffer(u(), NOW, false)).toBeNull()
    expect(renewOffer(paidLeft("plus", 0), NOW, false)).toBeNull()
  })
})
