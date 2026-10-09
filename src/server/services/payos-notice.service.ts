import type { PrismaClient } from "@prisma/client"

const LIMIT = 20
// Đồng hồ client lệch: upTo quá giờ server thì kẹp về now, tránh khoản sắp vào bị coi là đã đọc.
const FUTURE_SLACK_MS = 60_000

export type PayosNoticeItem = {
  id: number; studentId: number; studentName: string; studentDeleted: boolean
  amount: number; paidAt: Date; year: number; month: number; createdAt: Date; unread: boolean
}

// Chỉ đợt thu còn sống (cùng quy tắc "PH đã chuyển" ở payos-paid.service): GV xoá đợt thì thông báo cũng mất.
// Đọc mọi dòng của GV để đếm unread chính xác; mỗi GV chỉ vài trăm giao dịch/năm.
async function liveRows(db: PrismaClient, userId: number) {
  const rows = await db.tuitionPayLinkPayment.findMany({
    where: { link: { userId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, amount: true, paidAt: true, createdAt: true, batchId: true,
      link: { select: { studentId: true, year: true, month: true, student: { select: { fullName: true, isDeleted: true } } } },
    },
  })
  if (rows.length === 0) return rows
  const live = new Set((await db.payment.findMany({
    where: { batchId: { in: rows.map((r) => r.batchId) }, isDeleted: false },
    select: { batchId: true }, distinct: ["batchId"],
  })).map((p) => p.batchId))
  return rows.filter((r) => live.has(r.batchId))
}

export async function listPayosNotices(db: PrismaClient, userId: number) {
  const [user, connected, rows] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { payosSeenAt: true } }),
    db.teacherPayos.count({ where: { userId } }),
    liveRows(db, userId),
  ])
  if (!connected && rows.length === 0) return { enabled: false, unread: 0, items: [] as PayosNoticeItem[] }
  const isUnread = (c: Date) => !user.payosSeenAt || c > user.payosSeenAt
  return {
    enabled: true,
    unread: rows.filter((r) => isUnread(r.createdAt)).length,
    items: rows.slice(0, LIMIT).map((r): PayosNoticeItem => ({
      id: r.id, studentId: r.link.studentId, studentName: r.link.student.fullName, studentDeleted: r.link.student.isDeleted,
      amount: r.amount, paidAt: r.paidAt, year: r.link.year, month: r.link.month, createdAt: r.createdAt, unread: isUnread(r.createdAt),
    })),
  }
}

export async function markPayosNoticesSeen(db: PrismaClient, userId: number, upTo: Date) {
  const now = new Date()
  const target = upTo.getTime() > now.getTime() + FUTURE_SLACK_MS ? now : upTo
  const cur = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { payosSeenAt: true } })
  if (cur.payosSeenAt && cur.payosSeenAt >= target) return { seenAt: cur.payosSeenAt }
  await db.user.update({ where: { id: userId }, data: { payosSeenAt: target } })
  return { seenAt: target }
}
