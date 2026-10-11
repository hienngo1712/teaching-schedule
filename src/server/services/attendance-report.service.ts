// Chuyên cần (spec AN §3): chỉ ca không huỷ, buổi đã điểm danh (khác pending). Có mặt = present + late, muộn đếm riêng.
import type { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { byGradeThenName } from "@/lib/name-search"

export type AttendanceCounts = { present: number; late: number; absent: number; recorded: number; rate: number | null }
export type AttendanceFilter = { placeId?: number; grade?: number }

const round1 = (n: number) => Math.round(n * 10) / 10

function counts(rows: { attendance: string }[]): AttendanceCounts {
  let present = 0
  let late = 0
  let absent = 0
  for (const r of rows) {
    if (r.attendance === ATTENDANCE_STATUS.PRESENT) present++
    else if (r.attendance === ATTENDANCE_STATUS.LATE) {
      present++
      late++
    } else if (r.attendance === ATTENDANCE_STATUS.ABSENT) absent++
  }
  const recorded = present + absent
  return { present, late, absent, recorded, rate: recorded > 0 ? round1((present / recorded) * 100) : null }
}

// HS đã xoá vẫn có ở tháng cũ (spec R8): đọc qua quan hệ sessionStudent nên không bị lọc xoá mềm.
async function loadLinks(db: PrismaClient, userId: number, from: Date, to: Date, filter: AttendanceFilter) {
  return db.sessionStudent.findMany({
    where: {
      attendance: { not: ATTENDANCE_STATUS.PENDING },
      ...(filter.grade !== undefined ? { grade: filter.grade } : {}),
      session: {
        userId,
        isDeleted: false,
        status: { not: "cancelled" },
        sessionDate: { gte: from, lt: to },
        ...(filter.placeId !== undefined ? { placeId: filter.placeId } : {}),
      },
    },
    select: {
      studentId: true,
      attendance: true,
      session: { select: { sessionDate: true } },
      student: { select: { fullName: true, grade: true, isDeleted: true } },
    },
  })
}

type Link = Awaited<ReturnType<typeof loadLinks>>[number]

function groupByStudent(links: Link[]) {
  const map = new Map<number, { studentId: number; fullName: string; grade: number; isDeleted: boolean; links: Link[] }>()
  for (const l of links) {
    const s = map.get(l.studentId) ?? { studentId: l.studentId, fullName: l.student.fullName, grade: l.student.grade, isDeleted: l.student.isDeleted, links: [] }
    s.links.push(l)
    map.set(l.studentId, s)
  }
  return [...map.values()].sort((a, b) => byGradeThenName({ ...a, id: a.studentId }, { ...b, id: b.studentId }))
}

export async function getAttendanceMonth(db: PrismaClient, userId: number, input: { year: number; month: number } & AttendanceFilter) {
  const links = await loadLinks(db, userId, new Date(Date.UTC(input.year, input.month - 1, 1)), new Date(Date.UTC(input.year, input.month, 1)), input)
  const total = counts(links)
  return {
    stats: { present: total.present, late: total.late, absent: total.absent, recorded: total.recorded, rate: total.rate ?? 0 },
    students: groupByStudent(links).map(({ links: ls, ...s }) => ({ ...s, ...counts(ls) })),
  }
}

// Năm học N–N+1 = T9 năm N → T5 năm N+1 (9 tháng).
export function schoolYearMonths(startYear: number): { year: number; month: number }[] {
  return Array.from({ length: 9 }, (_, i) => {
    const m = 9 + i
    return m > 12 ? { year: startYear + 1, month: m - 12 } : { year: startYear, month: m }
  })
}

export async function getAttendanceSchoolYear(db: PrismaClient, userId: number, input: { startYear: number } & AttendanceFilter) {
  const months = schoolYearMonths(input.startYear)
  const links = await loadLinks(db, userId, new Date(Date.UTC(input.startYear, 8, 1)), new Date(Date.UTC(input.startYear + 1, 5, 1)), input)
  const keyOf = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth()
  const total = counts(links)
  return {
    months,
    stats: { present: total.present, late: total.late, absent: total.absent, recorded: total.recorded, rate: total.rate ?? 0 },
    students: groupByStudent(links).map(({ links: ls, ...s }) => ({
      ...s,
      ...counts(ls),
      months: months.map((m) => ({ ...m, rate: counts(ls.filter((l) => keyOf(l.session.sessionDate) === m.year * 12 + m.month - 1)).rate })),
    })),
  }
}
