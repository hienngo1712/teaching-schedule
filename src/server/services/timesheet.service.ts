// Bảng công + thu nhập nơi dạy tính theo ca/giờ (spec AM §3).
import { TRPCError } from "@trpc/server"
import type { Prisma, PrismaClient } from "@prisma/client"
import { assertOwnership } from "./_base.service"
import { monthKey, resolvePlaceBilling } from "@/lib/billing"
import { vnTodayIso } from "@/lib/payment-summary"
import { formatTime, vnDateParts } from "@/lib/utils"

export type RateUnit = "session" | "hour"
export type Rate = { unit: RateUnit; amount: number }
export type RateChange = { fromKey: number; unit: string; amount: number }
export type SessionKind = "done" | "upcoming" | "cancelled"
export type IncomeStatus = "none" | "unpaid" | "partial" | "paid"

// Giờ của ca = phút / 60, làm tròn 2 chữ số. Giờ kết thúc ≤ giờ bắt đầu (dữ liệu lạ) → 0, không âm.
export function sessionHours(start: Date, end: Date): number {
  const minutes = (end.getTime() - start.getTime()) / 60000
  if (minutes <= 0) return 0
  return Math.round((minutes / 60) * 100) / 100
}

// todayKey = "YYYY-MM-DD" theo ngày VN. Ca hôm nay (chưa huỷ) tính là đã dạy.
export function classifySession(s: { status: string; sessionDate: Date }, todayKey: string): SessionKind {
  if (s.status === "cancelled") return "cancelled"
  return s.sessionDate.toISOString().slice(0, 10) <= todayKey ? "done" : "upcoming"
}

// Đơn giá có hiệu lực tại tháng `key` (fromKey theo tháng như PlaceBillingChange). amount 0 = chưa có đơn giá.
export function resolveRate(changes: RateChange[], key: number): Rate | null {
  let matched: RateChange | null = null
  for (const c of changes) {
    if (c.fromKey <= key && (!matched || c.fromKey > matched.fromKey)) matched = c
  }
  if (!matched || matched.amount <= 0) return null
  return { unit: matched.unit === "hour" ? "hour" : "session", amount: matched.amount }
}

export function computeIncome({ doneCount, doneHours, rate }: { doneCount: number; doneHours: number; rate: Rate | null }): number | null {
  if (!rate) return null
  return rate.unit === "session" ? doneCount * rate.amount : Math.round(doneHours * rate.amount)
}

// Nhận dư vẫn là "paid" (phần dư hiện ở UI). Có giá nhưng dự kiến 0 và chưa nhận → "unpaid".
export function incomeStatus(expected: number | null, received: number): IncomeStatus {
  if (expected === null) return "none"
  if (received <= 0) return "unpaid"
  return received >= expected ? "paid" : "partial"
}

// ── Đọc DB ──────────────────────────────────────────────────────────────────

const sessionSelect = {
  id: true,
  placeId: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  status: true,
  cancelReason: true,
  makeupOfId: true,
  title: true,
  subject: { select: { name: true } },
  sessionStudents: { select: { attendance: true } },
} satisfies Prisma.TeachingSessionSelect

type SessionRow = Prisma.TeachingSessionGetPayload<{ select: typeof sessionSelect }>

export type TimesheetSession = {
  id: number
  date: string
  start: string
  end: string
  hours: number
  subject: string
  title: string | null
  presentCount: number
  totalCount: number
  kind: SessionKind
  isMakeup: boolean
  cancelReason?: string
}

export type TimesheetStats = {
  doneCount: number
  doneHours: number
  makeupCount: number
  cancelledCount: number
  cancelledHours: number
  scheduledCount: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

function monthRange(year: number, month: number) {
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) }
}

function toTimesheetSession(row: SessionRow, today: string): TimesheetSession {
  return {
    id: row.id,
    date: row.sessionDate.toISOString().slice(0, 10),
    start: formatTime(row.startTime),
    end: formatTime(row.endTime),
    hours: sessionHours(row.startTime, row.endTime),
    subject: row.subject.name,
    title: row.title,
    presentCount: row.sessionStudents.filter((s) => s.attendance === "present" || s.attendance === "late").length,
    totalCount: row.sessionStudents.length,
    kind: classifySession(row, today),
    isMakeup: row.makeupOfId !== null,
    ...(row.status === "cancelled" && row.cancelReason ? { cancelReason: row.cancelReason } : {}),
  }
}

// Ca bù tính công (đếm riêng); ca huỷ không tính; "Tổng đã xếp" gồm cả ca huỷ.
export function summarize(sessions: TimesheetSession[]): TimesheetStats {
  const done = sessions.filter((s) => s.kind === "done")
  const cancelled = sessions.filter((s) => s.kind === "cancelled")
  return {
    doneCount: done.length,
    doneHours: round2(done.reduce((a, s) => a + s.hours, 0)),
    makeupCount: done.filter((s) => s.isMakeup).length,
    cancelledCount: cancelled.length,
    cancelledHours: round2(cancelled.reduce((a, s) => a + s.hours, 0)),
    scheduledCount: sessions.length,
  }
}

// Nơi tính theo ca/giờ tại tháng; nơi đã xoá mềm chỉ giữ khi tháng đó có ca của nơi (spec AM RF 5).
async function perSessionPlaces(db: PrismaClient, userId: number, year: number, month: number) {
  const key = monthKey(year, month)
  const places = await db.teachingPlace.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      color: true,
      isDeleted: true,
      billingChanges: { select: { fromKey: true, billing: true } },
      rateChanges: { select: { fromKey: true, unit: true, amount: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
  const deletedIds = places.filter((p) => p.isDeleted).map((p) => p.id)
  const deletedWithSessions = new Set(
    deletedIds.length === 0
      ? []
      : (
          await db.teachingSession.groupBy({
            by: ["placeId"],
            where: { userId, isDeleted: false, placeId: { in: deletedIds }, sessionDate: monthRange(year, month) },
          })
        ).map((r) => r.placeId)
  )
  return places.filter(
    (p) => resolvePlaceBilling(p.billingChanges, key) === "per_session" && (!p.isDeleted || deletedWithSessions.has(p.id))
  )
}

async function ownedPlace(db: PrismaClient, userId: number, placeId: number) {
  const place = await db.teachingPlace.findFirst({
    where: { id: placeId },
    select: { id: true, userId: true, name: true, color: true, rateChanges: { select: { fromKey: true, unit: true, amount: true } } },
  })
  assertOwnership(place, userId)
  return place
}

async function loadSessions(db: PrismaClient, userId: number, placeIds: number[], year: number, month: number) {
  if (placeIds.length === 0) return []
  return db.teachingSession.findMany({
    where: { userId, isDeleted: false, placeId: { in: placeIds }, sessionDate: monthRange(year, month) },
    select: sessionSelect,
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }, { id: "asc" }],
  })
}

export async function getTimesheetMonth(db: PrismaClient, userId: number, input: { placeId?: number; year: number; month: number }) {
  const { year, month } = input
  const today = vnTodayIso()
  const place = input.placeId ? await ownedPlace(db, userId, input.placeId) : null
  const placeIds = place ? [place.id] : (await perSessionPlaces(db, userId, year, month)).map((p) => p.id)
  const sessions = (await loadSessions(db, userId, placeIds, year, month)).map((r) => toTimesheetSession(r, today))
  // Ca chưa gắn nơi chỉ có nghĩa khi GV có ≥ 2 nơi (1 nơi thì server tự gán).
  const placeCount = await db.teachingPlace.count({ where: { userId, isDeleted: false } })
  const unassignedCount =
    placeCount >= 2
      ? await db.teachingSession.count({ where: { userId, isDeleted: false, placeId: null, sessionDate: monthRange(year, month) } })
      : 0
  return {
    place: place && { id: place.id, name: place.name, color: place.color },
    stats: summarize(sessions),
    sessions,
    unassignedCount,
  }
}

async function receivedByPlace(db: PrismaClient, placeIds: number[], year: number, month: number) {
  if (placeIds.length === 0) return new Map<number, number>()
  const rows = await db.placePayment.groupBy({
    by: ["placeId"],
    where: { placeId: { in: placeIds }, year, month, isDeleted: false },
    _sum: { amount: true },
  })
  return new Map(rows.map((r) => [r.placeId, r._sum.amount ?? 0]))
}

export type IncomeRow = {
  placeId: number
  name: string
  color: string
  unit: RateUnit
  amount: number
  doneCount: number
  doneHours: number
  expected: number
  received: number
  status: IncomeStatus
  // Phiếu báo tháng này (spec AN §1): chưa gửi / đã gửi / số tiền đã đổi sau khi gửi.
  noticeStatus: "none" | "sent" | "changed"
  noticeSentAt: string | null
}

// Chỉ nơi theo ca/giờ có đơn giá tại tháng; tháng hiện tại chỉ tính ca đã dạy (≤ hôm nay).
export async function getIncomeMonth(db: PrismaClient, userId: number, input: { year: number; month: number }): Promise<IncomeRow[]> {
  const { year, month } = input
  const key = monthKey(year, month)
  const today = vnTodayIso()
  const places = (await perSessionPlaces(db, userId, year, month)).flatMap((p) => {
    const rate = resolveRate(p.rateChanges, key)
    return rate ? [{ ...p, rate }] : []
  })
  const ids = places.map((p) => p.id)
  const sessions = await loadSessions(db, userId, ids, year, month)
  const [received, notices] = await Promise.all([
    receivedByPlace(db, ids, year, month),
    ids.length === 0 ? [] : db.placeMonthNotice.findMany({ where: { placeId: { in: ids }, year, month } }),
  ])
  const noticeOf = new Map(notices.map((n) => [n.placeId, n]))
  return places.map((p) => {
    const stats = summarize(sessions.filter((s) => s.placeId === p.id).map((r) => toTimesheetSession(r, today)))
    const expected = computeIncome({ doneCount: stats.doneCount, doneHours: stats.doneHours, rate: p.rate }) ?? 0
    const got = received.get(p.id) ?? 0
    const sent = noticeOf.get(p.id)
    const remaining = Math.max(0, expected - got)
    return {
      placeId: p.id,
      name: p.name,
      color: p.color,
      unit: p.rate.unit,
      amount: p.rate.amount,
      doneCount: stats.doneCount,
      doneHours: stats.doneHours,
      expected,
      received: got,
      status: incomeStatus(expected, got),
      // Như phiếu HS: đã trả hết thì coi như đã gửi, không nhắc gửi lại.
      noticeStatus: !sent ? "none" : remaining === sent.sentAmount || remaining === 0 ? "sent" : "changed",
      noticeSentAt: sent?.sentAt.toISOString() ?? null,
    }
  })
}

// Đơn giá theo tháng (fromKey) nên 1 tháng chỉ có 1 mức: diễn giải 1 dòng (hoặc rỗng khi chưa có đơn giá).
export async function getIncomeDetail(
  db: PrismaClient,
  userId: number,
  input: { placeId: number; year: number; month: number },
  withPayments: boolean
) {
  const { year, month } = input
  const place = await ownedPlace(db, userId, input.placeId)
  const rate = resolveRate(place.rateChanges, monthKey(year, month))
  const stats = summarize((await loadSessions(db, userId, [place.id], year, month)).map((r) => toTimesheetSession(r, vnTodayIso())))
  const expected = computeIncome({ doneCount: stats.doneCount, doneHours: stats.doneHours, rate })
  const payments = withPayments
    ? await db.placePayment.findMany({
        where: { placeId: place.id, year, month, isDeleted: false },
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        select: { id: true, amount: true, receivedAt: true, note: true, source: true },
      })
    : null
  const received = payments
    ? payments.reduce((a, p) => a + p.amount, 0)
    : ((await receivedByPlace(db, [place.id], year, month)).get(place.id) ?? 0)
  return {
    place: { id: place.id, name: place.name, color: place.color },
    lines: rate && expected !== null ? [{ unit: rate.unit, amount: rate.amount, count: stats.doneCount, hours: stats.doneHours, total: expected }] : [],
    expected,
    received,
    status: incomeStatus(expected, received),
    payments: payments && payments.map((p) => ({ ...p, receivedAt: p.receivedAt.toISOString().slice(0, 10) })),
  }
}

// Đơn giá: nơi chưa có ca → áp mọi tháng (fromKey 0); có ca → từ tháng chọn (≤ tháng hiện tại, tối đa 12 tháng trước).
export async function setPlaceRate(
  db: PrismaClient,
  userId: number,
  input: { placeId: number; unit: RateUnit; amount: number; fromYear: number; fromMonth: number }
) {
  const place = await db.teachingPlace.findFirst({ where: { id: input.placeId, isDeleted: false }, select: { id: true, userId: true } })
  assertOwnership(place, userId)
  const { year, month } = vnDateParts()
  const cur = monthKey(year, month)
  // Như PlaceDTO.hasSessions: tính cả ca đã xoá (đã có lịch sử thì không ghi đè mọi tháng).
  const hasSessions = (await db.teachingSession.count({ where: { placeId: place.id } })) > 0
  return db.$transaction(async (tx) => {
    if (!hasSessions) {
      await tx.placeRateChange.deleteMany({ where: { placeId: place.id } })
      return tx.placeRateChange.create({ data: { placeId: place.id, fromKey: 0, unit: input.unit, amount: input.amount } })
    }
    const fromKey = monthKey(input.fromYear, input.fromMonth)
    if (fromKey > cur || fromKey < cur - 12) throw new TRPCError({ code: "BAD_REQUEST", message: "rate_month_out_of_range" })
    return tx.placeRateChange.upsert({
      where: { placeId_fromKey: { placeId: place.id, fromKey } },
      create: { placeId: place.id, fromKey, unit: input.unit, amount: input.amount },
      update: { unit: input.unit, amount: input.amount },
    })
  })
}

export async function getPlaceRateHistory(db: PrismaClient, userId: number, placeId: number) {
  const place = await ownedPlace(db, userId, placeId)
  return [...place.rateChanges]
    .sort((a, b) => b.fromKey - a.fromKey)
    .map((r) => ({
      fromKey: r.fromKey,
      // fromKey 0 = mọi tháng.
      fromYear: r.fromKey === 0 ? null : Math.floor(r.fromKey / 12),
      fromMonth: r.fromKey === 0 ? null : (r.fromKey % 12) + 1,
      unit: (r.unit === "hour" ? "hour" : "session") as RateUnit,
      amount: r.amount,
    }))
}

export async function createPlacePayment(
  db: PrismaClient,
  userId: number,
  input: { placeId: number; year: number; month: number; amount: number; receivedAt: string; note?: string }
) {
  const place = await db.teachingPlace.findFirst({ where: { id: input.placeId }, select: { id: true, userId: true } })
  assertOwnership(place, userId)
  return db.placePayment.create({
    data: {
      placeId: place.id,
      year: input.year,
      month: input.month,
      amount: input.amount,
      receivedAt: new Date(`${input.receivedAt}T00:00:00.000Z`),
      note: input.note || null,
    },
    select: { id: true },
  })
}

export async function deletePlacePayment(db: PrismaClient, userId: number, id: number) {
  const row = await db.placePayment.findFirst({ where: { id, isDeleted: false }, select: { id: true, place: { select: { userId: true } } } })
  assertOwnership(row && { userId: row.place.userId }, userId)
  await db.placePayment.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } })
  return { success: true as const }
}
