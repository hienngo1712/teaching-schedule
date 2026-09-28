// Thuần (không Prisma): xem trước và copyMonth dùng chung để số xem trước khớp đúng lúc tạo (spec M mục 4–5).
import { vnDateParts } from "@/lib/utils"

export const COPY_MONTH_MAX_MONTHS = 3
export const COPY_MONTH_MAX_SESSIONS = 300
export const COPY_MONTH_WINDOW_DAYS = 14
const BIWEEKLY_MIN_GAP = 14

export type MonthRef = { year: number; month: number }
export type PatternKind = "regular" | "single" | "stopped" | "biweekly" | "no_students"

export type SourceSession = {
  sessionDate: Date
  startTime: string
  endTime: string
  subjectId: number
  subjectName: string
  title: string | null
  status: string
  makeupOfId: number | null
  studentIds: number[]
}

export type WeeklyPattern = {
  key: string
  weekday: number
  startTime: string
  endTime: string
  subjectId: number
  subjectName: string
  title: string | null
  studentIds: number[]
  droppedInactive: number
  count: number
  lastDate: Date
  kind: PatternKind
}

export type ExistingSession = { sessionDate: Date; startTime: string; endTime: string; status: string; label: string }

export type CopyCandidate = {
  patternKey: string
  sessionDate: Date
  startTime: string
  endTime: string
  subjectId: number
  subjectName: string
  title: string | null
  studentIds: number[]
}

export type MonthCount = { year: number; month: number; slots: number; created: number; existing: number; conflict: number; past: number }
export type CopyConflict = { patternKey: string; date: string; conflict: string }

// Xem trước chỉ cần vài xung đột mỗi mẫu; cắt chung sẽ làm mẫu sắp sau mất hết danh sách chi tiết (spec P M1).
export function capConflictsPerPattern(conflicts: CopyConflict[], max: number): CopyConflict[] {
  const seen = new Map<string, number>()
  return conflicts.filter((c) => {
    const n = seen.get(c.patternKey) ?? 0
    seen.set(c.patternKey, n + 1)
    return n < max
  })
}
export type CopyTotals = { created: number; existing: number; conflict: number; past: number }
export type MonthCopyPlan = {
  selectedKeys: string[]
  candidates: CopyCandidate[]
  perPattern: Record<string, MonthCount[]>
  months: { year: number; month: number; created: number }[]
  conflicts: CopyConflict[]
  totals: CopyTotals
}

export const monthIndex = (m: MonthRef) => m.year * 12 + m.month - 1
export const monthFromIndex = (i: number): MonthRef => ({ year: Math.floor(i / 12), month: (i % 12) + 1 })
export const shiftMonth = (m: MonthRef, n: number) => monthFromIndex(monthIndex(m) + n)

export function targetMonths(from: MonthRef, months: number): MonthRef[] {
  return Array.from({ length: months }, (_, i) => shiftMonth(from, i))
}

export const weekdayOf = (d: Date) => (d.getUTCDay() + 6) % 7
export const ymd = (d: Date) => d.toISOString().slice(0, 10)
export const patternKey = (weekday: number, startTime: string, endTime: string, subjectId: number) =>
  `${weekday}|${startTime}|${endTime}|${subjectId}`

export function conflictLabel(title: string | null, subjectName: string, startTime: string, endTime: string): string {
  return title ? `"${title}" (${subjectName})` : `Lớp ${subjectName} (${startTime}–${endTime})`
}

export function vnToday(now: Date = new Date()): Date {
  const { year, month, day } = vnDateParts(now)
  return new Date(Date.UTC(year, month - 1, day))
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const cancelledFirst = (s: SourceSession) => (s.status === "cancelled" ? 0 : 1)

export function deriveWeeklyPatterns(
  sessions: SourceSession[],
  year: number,
  month: number,
  activeStudentIds: ReadonlySet<number>
): WeeklyPattern[] {
  const windowStart = daysIn(year, month) - COPY_MONTH_WINDOW_DAYS + 1
  const groups = new Map<string, SourceSession[]>()
  for (const s of sessions) {
    // Ca bù không phải lịch gốc (M2); ca huỷ vẫn nằm đúng slot gốc nên giữ.
    if (s.makeupOfId !== null) continue
    const key = patternKey(weekdayOf(s.sessionDate), s.startTime, s.endTime, s.subjectId)
    const list = groups.get(key)
    if (list) list.push(s)
    else groups.set(key, [s])
  }

  const out: WeeklyPattern[] = []
  for (const [key, list] of groups) {
    // Cùng ngày có ca huỷ + ca dạy lại đúng slot: ca không huỷ đứng sau để làm "lần muộn nhất".
    const sorted = [...list].sort(
      (a, b) => a.sessionDate.getTime() - b.sessionDate.getTime() || cancelledFirst(a) - cancelledFirst(b)
    )
    const latest = sorted[sorted.length - 1]
    const dayNums = [...new Set(sorted.map((s) => s.sessionDate.getUTCDate()))]
    const studentIds = latest.studentIds.filter((id) => activeStudentIds.has(id))

    let kind: PatternKind
    if (dayNums.length === 1) kind = "single"
    else if (dayNums[dayNums.length - 1] < windowStart) kind = "stopped"
    else if (dayNums.every((d, i) => i === 0 || d - dayNums[i - 1] >= BIWEEKLY_MIN_GAP)) kind = "biweekly"
    else kind = "regular"
    if (latest.studentIds.length > 0 && studentIds.length === 0) kind = "no_students"

    out.push({
      key,
      weekday: weekdayOf(latest.sessionDate),
      startTime: latest.startTime,
      endTime: latest.endTime,
      subjectId: latest.subjectId,
      subjectName: latest.subjectName,
      title: latest.title,
      studentIds,
      droppedInactive: latest.studentIds.length - studentIds.length,
      count: dayNums.length,
      lastDate: latest.sessionDate,
      kind,
    })
  }
  return out.sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime) ||
      a.subjectId - b.subjectId
  )
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && aEnd > bStart

export function planMonthCopy(args: {
  patterns: WeeklyPattern[]
  selectedKeys?: readonly string[]
  targets: MonthRef[]
  existing: ExistingSession[]
  today: Date
}): MonthCopyPlan {
  const { patterns, targets, existing, today } = args
  const wanted = args.selectedKeys ? new Set(args.selectedKeys) : null
  const chosen = new Set(patterns.filter((p) => (wanted ? wanted.has(p.key) : p.kind === "regular")).map((p) => p.key))

  const perPattern: Record<string, MonthCount[]> = {}
  const slots: { p: WeeklyPattern; date: Date; count: MonthCount }[] = []
  for (const p of patterns) {
    perPattern[p.key] = targets.map((t) => {
      const count: MonthCount = { year: t.year, month: t.month, slots: 0, created: 0, existing: 0, conflict: 0, past: 0 }
      for (let d = 1; d <= daysIn(t.year, t.month); d++) {
        const date = new Date(Date.UTC(t.year, t.month - 1, d))
        if (weekdayOf(date) !== p.weekday) continue
        count.slots++
        if (chosen.has(p.key)) slots.push({ p, date, count })
      }
      return count
    })
  }
  slots.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.p.startTime.localeCompare(b.p.startTime) || a.p.key.localeCompare(b.p.key)
  )

  const candidates: CopyCandidate[] = []
  const conflicts: CopyConflict[] = []
  for (const { p, date, count } of slots) {
    if (date < today) {
      count.past++
      continue
    }
    const onDay = existing.filter((e) => e.sessionDate.getTime() === date.getTime())
    // Cùng slot kể cả ca huỷ → coi như đã có: chạy lại không hồi sinh ca giáo viên đã huỷ.
    if (onDay.some((e) => e.startTime === p.startTime && e.endTime === p.endTime)) {
      count.existing++
      continue
    }
    // Ca huỷ không chặn (khớp checkOverlap); ứng viên nhận trước cũng chặn ứng viên sau.
    const hit = onDay.find((e) => e.status !== "cancelled" && overlaps(p.startTime, p.endTime, e.startTime, e.endTime))
    const prev = hit
      ? undefined
      : candidates.find((c) => c.sessionDate.getTime() === date.getTime() && overlaps(p.startTime, p.endTime, c.startTime, c.endTime))
    const blocker = hit?.label ?? (prev && conflictLabel(prev.title, prev.subjectName, prev.startTime, prev.endTime))
    if (blocker) {
      count.conflict++
      conflicts.push({ patternKey: p.key, date: ymd(date), conflict: blocker })
      continue
    }
    count.created++
    candidates.push({
      patternKey: p.key,
      sessionDate: date,
      startTime: p.startTime,
      endTime: p.endTime,
      subjectId: p.subjectId,
      subjectName: p.subjectName,
      title: p.title,
      studentIds: p.studentIds,
    })
  }

  const all = Object.values(perPattern)
  const sum = (f: (c: MonthCount) => number) => all.reduce((s, list) => s + list.reduce((t, c) => t + f(c), 0), 0)
  return {
    selectedKeys: patterns.filter((p) => chosen.has(p.key)).map((p) => p.key),
    candidates,
    perPattern,
    months: targets.map((t, i) => ({ year: t.year, month: t.month, created: all.reduce((s, list) => s + list[i].created, 0) })),
    conflicts,
    totals: {
      created: sum((c) => c.created),
      existing: sum((c) => c.existing),
      conflict: sum((c) => c.conflict),
      past: sum((c) => c.past),
    },
  }
}
