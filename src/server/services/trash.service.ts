import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"
import { formatTime } from "@/lib/utils"
import type { PaginatedResponse } from "@/lib/schemas/common"
import type { TrashListInput, TrashRestoreInput, TrashType } from "@/lib/schemas/trash"
import type { TrashItemDTO } from "@/lib/types/models"
import { LIVE, RESTORE_DATA } from "@/server/soft-delete"
import { assertOwnership } from "./_base.service"
import { checkOverlap, lockLiveSubject } from "./session.service"
import { lockMonth, syncPaidAmount, TX_OPTIONS } from "./payment.service"
import { lockAndAssertCanActivate } from "./student.service"

const DELETED = { isDeleted: true } as const
const ORDER = [{ deletedAt: "desc" as const }, { id: "desc" as const }]
const ymd = (d: Date) => d.toISOString().slice(0, 10)

function conflict(message: string): never {
  throw new TRPCError({ code: "CONFLICT", message })
}

export async function getTrashCounts(db: PrismaClient, userId: number): Promise<Record<TrashType, number>> {
  const [session, student, payment, subject] = await Promise.all([
    db.teachingSession.count({ where: { userId, ...DELETED } }),
    db.student.count({ where: { userId, ...DELETED, purgedAt: null } }),
    db.payment.count({ where: { ...DELETED, monthlyTuition: { student: { userId } } } }),
    db.subject.count({ where: { userId, ...DELETED, purgedAt: null } }),
  ])
  return { session, student, payment, subject }
}

export async function listTrash(
  db: PrismaClient,
  userId: number,
  { type, page, limit }: TrashListInput
): Promise<PaginatedResponse<TrashItemDTO>> {
  const skip = (page - 1) * limit
  let items: TrashItemDTO[]
  let totalCount: number
  if (type === "session") {
    const where = { userId, ...DELETED }
    const [rows, n] = await Promise.all([
      db.teachingSession.findMany({
        where,
        orderBy: ORDER,
        skip,
        take: limit,
        select: {
          id: true,
          deletedAt: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          title: true,
          makeupOfId: true,
          subject: { select: { name: true } },
        },
      }),
      db.teachingSession.count({ where }),
    ])
    items = rows.map((r) => ({
      type,
      id: r.id,
      deletedAt: r.deletedAt!,
      sessionDate: ymd(r.sessionDate),
      startTime: formatTime(r.startTime),
      endTime: formatTime(r.endTime),
      subjectName: r.subject.name,
      title: r.title,
      isMakeup: r.makeupOfId !== null,
    }))
    totalCount = n
  } else if (type === "student") {
    const where = { userId, ...DELETED, purgedAt: null }
    const [rows, n] = await Promise.all([
      db.student.findMany({
        where,
        orderBy: ORDER,
        skip,
        take: limit,
        select: { id: true, deletedAt: true, fullName: true, grade: true },
      }),
      db.student.count({ where }),
    ])
    items = rows.map((r) => ({
      type,
      id: r.id,
      deletedAt: r.deletedAt!,
      fullName: r.fullName,
      grade: r.grade,
    }))
    totalCount = n
  } else if (type === "payment") {
    const where = { ...DELETED, monthlyTuition: { student: { userId } } }
    const [rows, n] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: ORDER,
        skip,
        take: limit,
        select: {
          id: true,
          deletedAt: true,
          amount: true,
          paidAt: true,
          monthlyTuition: {
            select: {
              year: true,
              month: true,
              student: { select: { fullName: true } },
            },
          },
        },
      }),
      db.payment.count({ where }),
    ])
    items = rows.map((r) => ({
      type,
      id: r.id,
      deletedAt: r.deletedAt!,
      amount: r.amount,
      paidAt: ymd(r.paidAt),
      studentName: r.monthlyTuition.student.fullName,
      year: r.monthlyTuition.year,
      month: r.monthlyTuition.month,
    }))
    totalCount = n
  } else {
    const where = { userId, ...DELETED, purgedAt: null }
    const [rows, n] = await Promise.all([
      db.subject.findMany({
        where,
        orderBy: ORDER,
        skip,
        take: limit,
        select: { id: true, deletedAt: true, name: true, color: true },
      }),
      db.subject.count({ where }),
    ])
    items = rows.map((r) => ({
      type,
      id: r.id,
      deletedAt: r.deletedAt!,
      name: r.name,
      color: r.color,
    }))
    totalCount = n
  }
  return { items, totalCount, totalPages: Math.ceil(totalCount / limit) }
}

export async function undeleteSession(db: PrismaClient, userId: number, id: number): Promise<void> {
  const s = await db.teachingSession.findUnique({
    where: { id, ...DELETED },
    include: {
      subject: { select: { name: true, isDeleted: true, purgedAt: true } },
      makeupOf: {
        select: {
          status: true,
          isDeleted: true,
          makeupSessions: { where: LIVE, select: { id: true } },
        },
      },
    },
  })
  assertOwnership(s, userId)
  if (s.subject.purgedAt) conflict(`Môn ${s.subject.name} đã bị dọn vĩnh viễn nên không khôi phục được ca này.`)
  if (s.subject.isDeleted) conflict(`Môn ${s.subject.name} đang ở Thùng rác. Hãy khôi phục môn trước.`)
  if (s.makeupOfId !== null) {
    const o = s.makeupOf
    // Ca gốc phải còn đang huỷ và chưa có ca bù khác, nếu không sẽ có 2 ca bù hoặc ca bù cho ca đã dạy.
    if (!o || o.isDeleted || o.status !== "cancelled" || o.makeupSessions.length > 0) {
      conflict("Ca gốc không còn chờ ca bù nên không khôi phục được ca bù này.")
    }
  }
  if (s.status !== "cancelled") {
    await checkOverlap(db, {
      userId,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      excludeId: id,
    })
  }
  // Khoá môn như lúc tạo ca: xoá môn xen giữa thì không khôi phục ca trỏ vào môn đã xoá (spec U U14).
  await db.$transaction(async (tx) => {
    await lockLiveSubject(tx, userId, s.subjectId)
    await tx.teachingSession.update({ where: { id }, data: RESTORE_DATA })
  })
}

export async function undeleteStudent(db: PrismaClient, userId: number, id: number): Promise<void> {
  await db.$transaction(async (tx) => {
    const st = await tx.student.findFirst({ where: { id, ...DELETED, purgedAt: null } })
    assertOwnership(st, userId)
    if (st.isActive) await lockAndAssertCanActivate(tx, userId, 1)
    await tx.student.update({ where: { id }, data: RESTORE_DATA })
  }, TX_OPTIONS)
}

export async function undeletePayment(db: PrismaClient, userId: number, id: number): Promise<void> {
  const p = await db.payment.findUnique({
    where: { id, ...DELETED },
    include: {
      monthlyTuition: {
        select: {
          student: {
            select: { userId: true, fullName: true, isDeleted: true, purgedAt: true },
          },
        },
      },
    },
  })
  if (!p || p.monthlyTuition.student.userId !== userId) throw new TRPCError({ code: "NOT_FOUND" })
  const st = p.monthlyTuition.student
  if (st.purgedAt) conflict("Học sinh này đã bị dọn vĩnh viễn nên không khôi phục được lần thu.")
  if (st.isDeleted) conflict(`Học sinh ${st.fullName} đang ở Thùng rác. Hãy khôi phục học sinh trước.`)
  await db.$transaction(async (tx) => {
    await lockMonth(tx, p.monthlyTuitionId)
    await tx.payment.update({ where: { id }, data: RESTORE_DATA })
    await syncPaidAmount(tx, p.monthlyTuitionId)
  }, TX_OPTIONS)
}

export async function undeleteSubject(db: PrismaClient, userId: number, id: number): Promise<void> {
  const s = await db.subject.findFirst({ where: { id, ...DELETED, purgedAt: null } })
  assertOwnership(s, userId)
  await db.subject.update({ where: { id }, data: RESTORE_DATA })
}

export async function restoreTrashItem(
  db: PrismaClient,
  userId: number,
  { type, id }: TrashRestoreInput
): Promise<{ success: true }> {
  if (type === "session") await undeleteSession(db, userId, id)
  else if (type === "student") await undeleteStudent(db, userId, id)
  else if (type === "payment") await undeletePayment(db, userId, id)
  else await undeleteSubject(db, userId, id)
  return { success: true }
}
