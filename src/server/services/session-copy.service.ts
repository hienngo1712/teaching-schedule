import { TRPCError } from "@trpc/server"
import type { Prisma, PrismaClient } from "@prisma/client"
import { formatTime, parseTimeToDate } from "@/lib/utils"
import {
  COPY_MONTH_MAX_SESSIONS,
  conflictLabel,
  deriveWeeklyPatterns,
  planMonthCopy,
  targetMonths,
  vnToday,
  ymd,
  type ExistingSession,
  type MonthRef,
  type SourceSession,
} from "@/lib/copy-month"
import type { SessionCopyMonthInput, SessionCopyMonthPreviewInput } from "@/lib/schemas/session"

type Db = PrismaClient | Prisma.TransactionClient
type CopyRange = { source: MonthRef; from: MonthRef; months: number }

// Dạng 2 khóa int4 để không chung khóa bigint userId của plan/student; 7401 là khóa bảng giá (L).
export const COPY_MONTH_LOCK_NS = 7402
const MAX_PREVIEW_CONFLICTS = 50

const monthStart = (m: MonthRef) => new Date(Date.UTC(m.year, m.month - 1, 1))
const nextMonthStart = (m: MonthRef) => new Date(Date.UTC(m.year, m.month, 1))

async function loadCopyContext(db: Db, userId: number, input: CopyRange) {
  const rows = await db.teachingSession.findMany({
    where: { userId, sessionDate: { gte: monthStart(input.source), lt: nextMonthStart(input.source) } },
    select: {
      sessionDate: true,
      startTime: true,
      endTime: true,
      subjectId: true,
      title: true,
      status: true,
      makeupOfId: true,
      subject: { select: { name: true, color: true } },
      sessionStudents: { select: { studentId: true } },
    },
  })
  const subjects = new Map<number, { id: number; name: string; color: string }>()
  const sources: SourceSession[] = rows.map((r) => {
    subjects.set(r.subjectId, { id: r.subjectId, name: r.subject.name, color: r.subject.color })
    return {
      sessionDate: r.sessionDate,
      startTime: formatTime(r.startTime),
      endTime: formatTime(r.endTime),
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      title: r.title,
      status: r.status,
      makeupOfId: r.makeupOfId,
      studentIds: r.sessionStudents.map((s) => s.studentId),
    }
  })

  const allIds = [...new Set(sources.flatMap((s) => s.studentIds))]
  const students =
    allIds.length === 0
      ? []
      : await db.student.findMany({
          where: { userId, isActive: true, id: { in: allIds } },
          select: { id: true, tuitionFee: true, grade: true },
        })
  const patterns = deriveWeeklyPatterns(sources, input.source.year, input.source.month, new Set(students.map((s) => s.id)))

  const targets = targetMonths(input.from, input.months)
  const existingRows = await db.teachingSession.findMany({
    where: { userId, sessionDate: { gte: monthStart(targets[0]), lt: nextMonthStart(targets[targets.length - 1]) } },
    select: { sessionDate: true, startTime: true, endTime: true, status: true, title: true, subject: { select: { name: true } } },
  })
  const existing: ExistingSession[] = existingRows.map((r) => {
    const startTime = formatTime(r.startTime)
    const endTime = formatTime(r.endTime)
    return { sessionDate: r.sessionDate, startTime, endTime, status: r.status, label: conflictLabel(r.title, r.subject.name, startTime, endTime) }
  })

  return { patterns, targets, existing, subjects, students: new Map(students.map((s) => [s.id, s])), today: vnToday() }
}

export async function previewCopyMonth(db: PrismaClient, userId: number, input: SessionCopyMonthPreviewInput) {
  const ctx = await loadCopyContext(db, userId, input)
  const plan = planMonthCopy({ patterns: ctx.patterns, selectedKeys: input.patternKeys, targets: ctx.targets, existing: ctx.existing, today: ctx.today })
  const selected = new Set(plan.selectedKeys)
  return {
    patterns: ctx.patterns.map((p) => ({
      key: p.key,
      weekday: p.weekday,
      startTime: p.startTime,
      endTime: p.endTime,
      subject: ctx.subjects.get(p.subjectId)!,
      title: p.title,
      studentCount: p.studentIds.length,
      droppedInactive: p.droppedInactive,
      kind: p.kind,
      lastDate: ymd(p.lastDate),
      selected: selected.has(p.key),
      perMonth: plan.perPattern[p.key],
    })),
    months: plan.months,
    totals: plan.totals,
    conflicts: plan.conflicts.slice(0, MAX_PREVIEW_CONFLICTS),
  }
}

export async function copyMonth(db: PrismaClient, userId: number, input: SessionCopyMonthInput) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COPY_MONTH_LOCK_NS}::int, ${userId}::int)`
      // Đọc lại + tính lại sau khóa: request song song thứ 2 thấy ca của request 1 là "existing".
      const ctx = await loadCopyContext(tx, userId, input)
      const known = new Set(ctx.patterns.map((p) => p.key))
      const keys = input.patternKeys.filter((k) => known.has(k))
      if (keys.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Không có mẫu lịch hợp lệ để chép" })
      }
      const plan = planMonthCopy({ patterns: ctx.patterns, selectedKeys: keys, targets: ctx.targets, existing: ctx.existing, today: ctx.today })
      if (plan.candidates.length > COPY_MONTH_MAX_SESSIONS) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quá nhiều ca, hãy chọn ít tháng hơn" })
      }
      const { existing, conflict, past } = plan.totals
      const result = { created: plan.candidates.length, months: plan.months, skipped: { existing, conflict, past } }
      if (plan.candidates.length === 0) return result

      const created = await tx.teachingSession.createManyAndReturn({
        data: plan.candidates.map((c) => ({
          userId,
          sessionDate: c.sessionDate,
          startTime: parseTimeToDate(c.startTime),
          endTime: parseTimeToDate(c.endTime),
          subjectId: c.subjectId,
          title: c.title,
          notes: null,
        })),
      })
      // Ngày + giờ bắt đầu là duy nhất trong lô vì planMonthCopy đã loại ứng viên chồng giờ nhau.
      const byDaySlot = new Map(plan.candidates.map((c) => [`${ymd(c.sessionDate)}|${c.startTime}`, c]))
      const links = created.flatMap((row) => {
        const cand = byDaySlot.get(`${ymd(row.sessionDate)}|${formatTime(row.startTime)}`)!
        return cand.studentIds.map((studentId) => {
          const st = ctx.students.get(studentId)!
          return { sessionId: row.id, studentId, fee: st.tuitionFee, grade: st.grade }
        })
      })
      if (links.length > 0) await tx.sessionStudent.createMany({ data: links })
      return result
    },
    { timeout: 15000 }
  )
}
