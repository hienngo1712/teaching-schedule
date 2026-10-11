import { Prisma, type PrismaClient } from "@prisma/client"

const LIMIT = 20
// Đồng hồ client lệch: upTo quá giờ server thì kẹp về now, tránh khoản sắp vào bị coi là đã đọc.
const FUTURE_SLACK_MS = 60_000

type NoticeBase = { id: number; amount: number; paidAt: Date; year: number; month: number; createdAt: Date; unread: boolean }
// kind: id của 2 bảng có thể trùng nhau, UI dùng `${kind}-${id}` làm key. Dòng HS giữ đúng dạng cũ (kind tuỳ chọn)
// để code/test luồng HS không đổi; dòng nơi dạy khai báo trường HS là undefined để đọc chung không lỗi kiểu.
export type PayosNoticeItem =
  | (NoticeBase & { kind?: "student"; studentId: number; studentName: string; studentDeleted: boolean })
  | (NoticeBase & {
      kind: "place"; placeId: number; placeName: string; placeDeleted: boolean
      studentId?: undefined; studentName?: undefined; studentDeleted?: undefined
    })

// Chỉ đợt thu còn sống (cùng quy tắc "PH đã chuyển" ở payos-paid.service): GV xoá đợt thì thông báo cũng mất.
const liveOf = (userId: number) => Prisma.sql`
  FROM tuition_pay_link_payments p JOIN tuition_pay_links l ON l.id = p.link_id
  WHERE l.user_id = ${userId}
    AND EXISTS (SELECT 1 FROM payments x WHERE x.batch_id = p.batch_id AND x.is_deleted = false)`

// Tiền phiếu nơi dạy (spec AO §3.4): dòng PlacePayment còn sống; GV xoá tay thì thông báo cũng mất.
const livePlaceOf = (userId: number) => Prisma.sql`
  FROM place_pay_link_payments p JOIN place_pay_links l ON l.id = p.link_id
  WHERE l.user_id = ${userId}
    AND EXISTS (SELECT 1 FROM place_payments x WHERE x.id = p.place_payment_id AND x.is_deleted = false)`

export async function listPayosNotices(db: PrismaClient, userId: number) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { payosSeenAt: true } })
  const seen = user.payosSeenAt
  // Hỏi 30s/lần mỗi tab: đếm bằng SQL, chỉ đọc + giải mã tên của 20 dòng hiện ra.
  const newer = seen ? Prisma.sql`AND p.created_at > ${seen}` : Prisma.empty
  // 20 dòng mới nhất của CẢ 2 nguồn, rồi mới đọc chi tiết từng nguồn.
  const [connected, ids, [{ unread }]] = await Promise.all([
    db.teacherPayos.count({ where: { userId } }),
    db.$queryRaw<{ kind: "student" | "place"; id: number }[]>`
      SELECT kind, id FROM (
        SELECT 'student' AS kind, p.id, p.created_at ${liveOf(userId)}
        UNION ALL
        SELECT 'place' AS kind, p.id, p.created_at ${livePlaceOf(userId)}
      ) u ORDER BY created_at DESC, id DESC LIMIT ${LIMIT}`,
    db.$queryRaw<{ unread: number }[]>`SELECT
      ((SELECT COUNT(*) ${liveOf(userId)} ${newer}) + (SELECT COUNT(*) ${livePlaceOf(userId)} ${newer}))::int AS unread`,
  ])
  if (!connected && ids.length === 0) return { enabled: false, unread: 0, items: [] as PayosNoticeItem[] }
  const idsOf = (kind: "student" | "place") => ids.filter((r) => r.kind === kind).map((r) => r.id)
  const placeIds = idsOf("place")
  const [rows, placeRows] = await Promise.all([
    db.tuitionPayLinkPayment.findMany({
      where: { id: { in: idsOf("student") } },
      select: {
        id: true, amount: true, paidAt: true, createdAt: true,
        link: { select: { studentId: true, year: true, month: true, student: { select: { fullName: true, isDeleted: true } } } },
      },
    }),
    placeIds.length === 0
      ? []
      : db.placePayLinkPayment.findMany({
          where: { id: { in: placeIds } },
          select: {
            id: true, amount: true, paidAt: true, createdAt: true,
            link: { select: { placeId: true, year: true, month: true, place: { select: { name: true, isDeleted: true } } } },
          },
        }),
  ])
  const isUnread = (c: Date) => !seen || c > seen
  const byKey = new Map<string, PayosNoticeItem>()
  for (const r of rows) {
    byKey.set(`student-${r.id}`, {
      kind: "student", id: r.id, studentId: r.link.studentId, studentName: r.link.student.fullName, studentDeleted: r.link.student.isDeleted,
      amount: r.amount, paidAt: r.paidAt, year: r.link.year, month: r.link.month, createdAt: r.createdAt, unread: isUnread(r.createdAt),
    })
  }
  for (const r of placeRows) {
    byKey.set(`place-${r.id}`, {
      kind: "place", id: r.id, placeId: r.link.placeId, placeName: r.link.place.name, placeDeleted: r.link.place.isDeleted,
      amount: r.amount, paidAt: r.paidAt, year: r.link.year, month: r.link.month, createdAt: r.createdAt, unread: isUnread(r.createdAt),
    })
  }
  return {
    enabled: true,
    unread,
    // Giữ thứ tự của câu SQL (createdAt giảm dần trên cả 2 nguồn).
    items: ids.map((r) => byKey.get(`${r.kind}-${r.id}`)).filter((i): i is PayosNoticeItem => i !== undefined),
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
