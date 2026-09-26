// Thuần, dùng chung client/server. Mọi mốc hạn là 00:00 giờ VN của ngày sau ngày dùng cuối (spec I D3).
import { vnDateParts } from "@/lib/utils"
import { formatVnDate } from "@/lib/payment-notes"

export const PLANS = ["standard", "plus", "pro"] as const
export type Plan = (typeof PLANS)[number]
export type PaidPlan = Exclude<Plan, "standard">
export const PERIODS = ["month", "year", "2year"] as const
export type Period = (typeof PERIODS)[number]
export type PlanSource = "paid" | "trial" | "free"

export const PLAN_RANK: Record<Plan, number> = { standard: 0, plus: 1, pro: 2 }
export const PLAN_LABEL: Record<Plan, string> = { standard: "Standard", plus: "Plus", pro: "Pro" }
export const PLAN_PRICES: Record<PaidPlan, Record<Period, number>> = {
  plus: { month: 49000, year: 490000, "2year": 980000 },
  pro: { month: 99000, year: 990000, "2year": 1980000 },
}
export const PERIOD_MONTHS: Record<Period, number> = { month: 1, year: 12, "2year": 24 }
// Số ngày danh nghĩa 1 kỳ cho quy đổi D7: đơn giá ngày = giá / số ngày (99.000/30, 990.000/365).
export const PERIOD_DAYS: Record<Period, number> = { month: 30, year: 365, "2year": 730 }
export const STUDENT_LIMITS: Record<Plan, number | null> = { standard: 10, plus: 40, pro: null }
export const TRIAL_DAYS = 60
// Kỳ 2 năm luôn tặng tối thiểu 2 tháng (P1); gia hạn sớm thay bằng mức cao hơn, không cộng dồn.
export const TWO_YEAR_BONUS_MONTHS = 2

export const FEATURE_PLAN = {
  payments: "plus",
  tuitionNotice: "plus",
  monthlyReport: "plus",
  parentLink: "pro",
  dashboardAlerts: "pro",
  studentImport: "pro",
  multiMonthReport: "pro",
} as const satisfies Record<string, PaidPlan>
export type Feature = keyof typeof FEATURE_PLAN

// Bảng so sánh gói (P11): mỗi dòng gắn gói nhỏ nhất có nó, lấy gói từ FEATURE_PLAN để thẻ và chặn quyền không lệch nhau.
export const PLAN_FEATURES = [
  { id: "schedule", plan: "standard" },
  { id: "attendance", plan: "standard" },
  { id: "students", plan: "standard" },
  { id: "tuitionCalc", plan: "standard" },
  { id: "dashboardStats", plan: "standard" },
  { id: "backup", plan: "standard" },
  { id: "payments", plan: FEATURE_PLAN.payments },
  { id: "tuitionNotice", plan: FEATURE_PLAN.tuitionNotice },
  { id: "monthlyReport", plan: FEATURE_PLAN.monthlyReport },
  { id: "parentLink", plan: FEATURE_PLAN.parentLink },
  { id: "dashboardAlerts", plan: FEATURE_PLAN.dashboardAlerts },
  { id: "studentImport", plan: FEATURE_PLAN.studentImport },
  { id: "multiMonthReport", plan: FEATURE_PLAN.multiMonthReport },
  { id: "unlimitedStudents", plan: "pro" },
] as const satisfies readonly { id: string; plan: Plan }[]
export type PlanFeatureId = (typeof PLAN_FEATURES)[number]["id"]

export function featuresAddedIn(plan: Plan): PlanFeatureId[] {
  return PLAN_FEATURES.filter((f) => f.plan === plan).map((f) => f.id)
}

export type PlanFields = { plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null }
export type EffectivePlan = { plan: Plan; source: PlanSource; expiresAt: Date | null }
export type CreditOrder = { amount: number; period: string | null; bonusMonths: number }
export type PlanBannerState = { kind: "trial_ending" | "expired"; plan: Plan; days: number; key: string }
export type RenewOfferState = {
  plan: PaidPlan
  daysLeft: number
  expiresAt: Date
  year: number
  twoYear: number
  dropsAfter: Date | null
  after: { year: number; twoYear: number } | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const BANNER_DAYS = 7
const OFFER_DAYS = 60
const OFFER_LOW_DAYS = 30

export function isPlan(v: string): v is Plan {
  return (PLANS as readonly string[]).includes(v)
}
export function isPaidPlan(v: string): v is PaidPlan {
  return v === "plus" || v === "pro"
}
export function isPeriod(v: string | null): v is Period {
  return v !== null && (PERIODS as readonly string[]).includes(v)
}
// Cột plan trong DB là VARCHAR: giá trị lạ thì hiện nguyên văn thay vì vỡ UI.
export function planLabel(v: string): string {
  return isPlan(v) ? PLAN_LABEL[v] : v
}

export function vnStartOfDay(d: Date): Date {
  const { year, month, day } = vnDateParts(d)
  return new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS)
}

// VN không có giờ mùa hè nên cộng thẳng mili giây là đúng ngày.
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS)
}

// d phải là 00:00 giờ VN. Tháng đích thiếu ngày thì lùi về ngày cuối tháng (31/1 + 1 tháng = 28 hoặc 29/2).
export function addMonthsVn(d: Date, months: number): Date {
  const { year, month, day } = vnDateParts(d)
  const first = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, lastDay)) - VN_OFFSET_MS)
}

export function effectivePlan(u: PlanFields, now: Date): EffectivePlan {
  const paid: Plan = isPlan(u.plan) ? u.plan : "standard"
  const paidActive = paid !== "standard" && u.planExpiresAt !== null && u.planExpiresAt > now
  const trialActive = u.trialEndsAt !== null && u.trialEndsAt > now
  // D5: lấy gói cao hơn; hòa hạng (Pro trả phí + trial) tính là "paid".
  if (paidActive && (!trialActive || paid === "pro")) {
    return { plan: paid, source: "paid", expiresAt: u.planExpiresAt }
  }
  if (trialActive) return { plan: "pro", source: "trial", expiresAt: u.trialEndsAt }
  return { plan: "standard", source: "free", expiresAt: null }
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_PLAN[feature]]
}

export function studentLimit(plan: Plan): number | null {
  return STUDENT_LIMITS[plan]
}

export function minPlanForStudents(total: number): PaidPlan {
  const plus = STUDENT_LIMITS.plus
  return plus !== null && total <= plus ? "plus" : "pro"
}

// D10: nhiều tháng (Năm/Khoảng) hoặc lọc lớp là báo cáo Pro; đúng 1 tháng là Plus.
export function isMultiMonthReport(i: { year: number; month: number; toYear?: number; toMonth?: number; grade?: number }): boolean {
  if (i.grade !== undefined) return true
  if (i.toYear === undefined && i.toMonth === undefined) return false
  return (i.toYear ?? i.year) !== i.year || (i.toMonth ?? i.month) !== i.month
}

// D7: đang có Pro trả phí còn hạn thì không cho đặt Plus. Trả hạn Pro để UI ghi "còn hạn tới …".
export function orderBlockedUntil(u: PlanFields, orderPlan: PaidPlan, now: Date): Date | null {
  if (orderPlan === "plus" && u.plan === "pro" && u.planExpiresAt !== null && u.planExpiresAt > now) {
    return u.planExpiresAt
  }
  return null
}

// D6: mốc = muộn nhất (đầu ngày VN hôm nay, trial còn hạn, cùng gói còn hạn). Tháng tặng cộng chung với kỳ để chỉ cắt cuối tháng 1 lần.
export function computeNewExpiry(u: PlanFields, orderPlan: PaidPlan, period: Period, now: Date, extraMonths = 0): Date {
  let base = vnStartOfDay(now)
  if (u.trialEndsAt && u.trialEndsAt > now && u.trialEndsAt > base) base = u.trialEndsAt
  if (u.plan === orderPlan && u.planExpiresAt && u.planExpiresAt > now && u.planExpiresAt > base) base = u.planExpiresAt
  return addMonthsVn(base, PERIOD_MONTHS[period] + extraMonths)
}

// Số ngày VN còn dùng được, tính cả hôm nay.
export function daysLeft(expiresAt: Date, now: Date): number {
  if (expiresAt <= now) return 0
  const lastDay = vnStartOfDay(new Date(expiresAt.getTime() - 1))
  return Math.round((lastDay.getTime() - vnStartOfDay(now).getTime()) / DAY_MS) + 1
}

// Chỉ gói trả phí còn hạn; dùng thử không tính (spec 6.6).
export function paidDaysLeft(u: PlanFields, now: Date): number | null {
  if (!isPaidPlan(u.plan) || !u.planExpiresAt || u.planExpiresAt <= now) return null
  return daysLeft(u.planExpiresAt, now)
}

// Bảng tặng spec 6.6. Không cộng dồn: kỳ 2 năm gia hạn sớm lấy +4/+2 thay cho +2 mặc định.
export function computeBonusMonths(u: PlanFields, orderPlan: PaidPlan, period: Period, now: Date): number {
  if (period === "month") return 0
  const days = paidDaysLeft(u, now)
  const early = u.plan === orderPlan || (u.plan === "plus" && orderPlan === "pro")
  if (days !== null && early && days <= OFFER_LOW_DAYS) return period === "year" ? 1 : 2
  if (days !== null && early && days <= OFFER_DAYS) return period === "year" ? 2 : 4
  return period === "2year" ? TWO_YEAR_BONUS_MONTHS : 0
}

// D7: phần tiền Plus còn lại đổi thành ngày Pro. Chặn trên bằng cả kỳ để Plus mua trong trial không quy đổi vượt số tiền đã trả.
export function computeUpgradeCredit(
  u: PlanFields,
  lastPlusOrder: CreditOrder | null,
  targetPeriod: Period,
  now: Date
): { remainingValue: number; creditDays: number } {
  const none = { remainingValue: 0, creditDays: 0 }
  if (u.plan !== "plus" || !u.planExpiresAt || u.planExpiresAt <= now) return none
  if (!lastPlusOrder || lastPlusOrder.amount <= 0 || !isPeriod(lastPlusOrder.period)) return none
  // Tháng tặng nằm trong số ngày đơn đã mua, không tính thì dùng hết phần tặng rồi vẫn quy đổi đủ tiền.
  const totalDays = PERIOD_DAYS[lastPlusOrder.period] + Math.round((lastPlusOrder.bonusMonths * 365) / 12)
  const left = Math.round((u.planExpiresAt.getTime() - vnStartOfDay(now).getTime()) / DAY_MS)
  const remainingDays = Math.min(totalDays, left)
  const remainingValue = Math.round((lastPlusOrder.amount * remainingDays) / totalDays)
  const creditDays = Math.floor((remainingValue * PERIOD_DAYS[targetPeriod]) / PLAN_PRICES.pro[targetPeriod])
  return { remainingValue, creditDays }
}

export function trialEndFor(createdAt: Date): Date {
  return addDays(vnStartOfDay(createdAt), TRIAL_DAYS)
}

export function formatValidUntil(expiresAt: Date): string {
  return formatVnDate(new Date(expiresAt.getTime() - 1))
}

export function expiryFromLastDay(lastDay: string): Date {
  const [y, m, d] = lastDay.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1) - VN_OFFSET_MS)
}

export function planRequiredOf(err: unknown): PaidPlan | null {
  const p = (err as { data?: { planRequired?: unknown } } | null | undefined)?.data?.planRequired
  return p === "plus" || p === "pro" ? p : null
}

// Gói trả phí sắp hết hạn không có banner: popup gia hạn (renewOffer) lo phần đó (spec 8.5 dòng cuối).
export function planBanner(u: PlanFields, now: Date, hasPendingOrder: boolean): PlanBannerState | null {
  if (hasPendingOrder) return null
  const eff = effectivePlan(u, now)
  if (eff.source === "trial" && eff.expiresAt) {
    const days = daysLeft(eff.expiresAt, now)
    return days >= 1 && days <= BANNER_DAYS
      ? { kind: "trial_ending", plan: "pro", days, key: eff.expiresAt.toISOString() }
      : null
  }
  if (eff.source === "paid") return null
  const recent = (d: Date | null): d is Date => d !== null && d <= now && now.getTime() - d.getTime() < BANNER_DAYS * DAY_MS
  const candidates: { plan: Plan; at: Date }[] = []
  if (isPaidPlan(u.plan) && recent(u.planExpiresAt)) candidates.push({ plan: u.plan, at: u.planExpiresAt })
  if (recent(u.trialEndsAt)) candidates.push({ plan: "pro", at: u.trialEndsAt })
  const last = candidates.sort((a, b) => b.at.getTime() - a.at.getTime())[0]
  return last ? { kind: "expired", plan: last.plan, days: 0, key: last.at.toISOString() } : null
}

// Popup gia hạn sớm (spec 8.6): gói trả phí còn 1–60 ngày, không có đơn chờ.
export function renewOffer(u: PlanFields, now: Date, hasPendingOrder: boolean): RenewOfferState | null {
  const days = paidDaysLeft(u, now)
  if (hasPendingOrder || days === null || days > OFFER_DAYS || !isPaidPlan(u.plan) || !u.planExpiresAt) return null
  const plan = u.plan
  const bonus = (at: Date) => ({ year: computeBonusMonths(u, plan, "year", at), twoYear: computeBonusMonths(u, plan, "2year", at) })
  const base = { plan, daysLeft: days, expiresAt: u.planExpiresAt, ...bonus(now) }
  if (days <= OFFER_LOW_DAYS) return { ...base, dropsAfter: null, after: null }
  // Ngày VN cuối cùng còn 31 ngày; hôm sau ưu đãi xuống mức 1–30 ngày.
  const dropsAfter = addDays(u.planExpiresAt, -(OFFER_LOW_DAYS + 1))
  return { ...base, dropsAfter, after: bonus(addDays(dropsAfter, 1)) }
}
