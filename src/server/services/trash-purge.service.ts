import type { PrismaClient } from "@prisma/client"
import type { TrashType } from "@/lib/schemas/trash"
import { TX_OPTIONS } from "./payment.service"

export const DELETED_STUDENT_NAME = "Học sinh đã xoá"
const PURGE_ORDER: TrashType[] = ["payment", "session", "student", "subject"]

// Dọn vĩnh viễn 1 loại (spec R5–R7). Chỉ bản isDeleted của userId, bỏ bản đã dọn (purgedAt).
export async function purgeTrash(db: PrismaClient, userId: number, type: TrashType): Promise<number> {
  const now = new Date()
  const n = await db.$transaction(async (tx) => {
    if (type === "payment") {
      const r = await tx.payment.deleteMany({ where: { isDeleted: true, monthlyTuition: { student: { userId } } } })
      return r.count
    }
    if (type === "session") {
      const r = await tx.teachingSession.deleteMany({ where: { userId, isDeleted: true } })
      return r.count
    }
    if (type === "student") {
      // Ẩn danh thay vì xoá cứng: giữ lần thu/học phí/điểm danh để doanh thu không hụt (spec R5).
      const r = await tx.student.updateMany({
        where: { userId, isDeleted: true, purgedAt: null },
        data: { fullName: DELETED_STUDENT_NAME, parentPhone: null, parentName: null, notes: null, parentLinkToken: null, purgedAt: now },
      })
      return r.count
    }
    // Môn còn ca (kể cả ca đã xoá) không xoá cứng được vì khoá ngoại → chỉ ẩn vĩnh viễn.
    const free = await tx.subject.deleteMany({ where: { userId, isDeleted: true, purgedAt: null, sessions: { none: {} } } })
    const kept = await tx.subject.findMany({ where: { userId, isDeleted: true, purgedAt: null }, select: { id: true, name: true } })
    // Đổi tên để nhả ràng buộc unique (userId, name): môn đã dọn không khôi phục được nên không được giữ tên.
    for (const s of kept) {
      const suffix = ` (đã xoá #${s.id})`
      await tx.subject.update({ where: { id: s.id }, data: { name: s.name.slice(0, 100 - suffix.length) + suffix, purgedAt: now } })
    }
    return free.count + kept.length
  }, TX_OPTIONS)
  console.info(`[trash] user ${userId} dọn ${type}: ${n}`)
  return n
}

export async function purgeAllTrash(db: PrismaClient, userId: number): Promise<{ purged: Record<TrashType, number> }> {
  const purged = { session: 0, student: 0, payment: 0, subject: 0 }
  for (const type of PURGE_ORDER) purged[type] = await purgeTrash(db, userId, type)
  return { purged }
}
