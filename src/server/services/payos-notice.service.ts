import { Prisma, type PrismaClient } from "@prisma/client"

const LIMIT = 20
// Đồng hồ client lệch: upTo quá giờ server thì kẹp về now, tránh khoản sắp vào bị coi là đã đọc.
const FUTURE_SLACK_MS = 60_000

export type PayosNoticeItem = {
  id: number; studentId: number; studentName: string; studentDeleted: boolean
  amount: number; paidAt: Date; year: number; month: number; createdAt: Date; unread: boolean
}

// Chỉ đợt thu còn sống (cùng quy tắc "PH đã chuyển" ở payos-paid.service): GV xoá đợt thì thông báo cũng mất.
const liveOf = (userId: number) => Prisma.sql`
  FROM tuition_pay_link_payments p JOIN tuition_pay_links l ON l.id = p.link_id
  WHERE l.user_id = ${userId}
    AND EXISTS (SELECT 1 FROM payments x WHERE x.batch_id = p.batch_id AND x.is_deleted = false)`

export async function listPayosNotices(db: PrismaClient, userId: number) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { payosSeenAt: true } })
  const seen = user.payosSeenAt
  // Hỏi 30s/lần mỗi tab: đếm bằng SQL, chỉ đọc + giải mã tên của 20 dòng hiện ra.
  const [connected, ids, [{ unread }]] = await Promise.all([
    db.teacherPayos.count({ where: { userId } }),
    db.$queryRaw<{ id: number }[]>`SELECT p.id ${liveOf(userId)} ORDER BY p.created_at DESC, p.id DESC LIMIT ${LIMIT}`,
    db.$queryRaw<{ unread: number }[]>`SELECT COUNT(*)::int AS unread ${liveOf(userId)}
      ${seen ? Prisma.sql`AND p.created_at > ${seen}` : Prisma.empty}`,
  ])
  if (!connected && ids.length === 0) return { enabled: false, unread: 0, items: [] as PayosNoticeItem[] }
  const rows = await db.tuitionPayLinkPayment.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, amount: true, paidAt: true, createdAt: true,
      link: { select: { studentId: true, year: true, month: true, student: { select: { fullName: true, isDeleted: true } } } },
    },
  })
  const isUnread = (c: Date) => !seen || c > seen
  return {
    enabled: true,
    unread,
    items: rows.map((r): PayosNoticeItem => ({
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
