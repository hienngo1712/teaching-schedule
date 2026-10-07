import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { isAdminUsername } from "@/lib/admin"
import { chatPreview } from "@/lib/chat"

export const CHAT_PAGE_SIZE = 30
export const CHAT_RATE_LIMIT = 30
export const CHAT_RATE_WINDOW_MS = 10 * 60_000

export type ChatMessageDto = { id: number; fromAdmin: boolean; senderName: string | null; body: string; createdAt: Date }

const MESSAGE_SELECT = { id: true, fromAdmin: true, senderName: true, body: true, createdAt: true } as const

// Trang theo id giảm dần, trả về cũ → mới để giao diện vẽ từ trên xuống.
async function pageMessages(db: PrismaClient, conversationId: number, cursor: number | undefined, withSender: boolean) {
  const rows = await db.chatMessage.findMany({
    where: { conversationId, ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: { id: "desc" },
    take: CHAT_PAGE_SIZE + 1,
    select: MESSAGE_SELECT,
  })
  const page = rows.slice(0, CHAT_PAGE_SIZE)
  const nextCursor = rows.length > CHAT_PAGE_SIZE ? page[page.length - 1].id : null
  const items: ChatMessageDto[] = page.reverse().map((m) => ({ ...m, senderName: withSender ? m.senderName : null }))
  return { items, nextCursor }
}

export async function sendUserMessage(db: PrismaClient, user: { id: number; username: string }, body: string) {
  const since = new Date(Date.now() - CHAT_RATE_WINDOW_MS)
  const recent = await db.chatMessage.count({
    where: { fromAdmin: false, createdAt: { gte: since }, conversation: { userId: user.id } },
  })
  if (recent >= CHAT_RATE_LIMIT) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "CHAT_LIMIT" })
  const now = new Date()
  return db.$transaction(async (tx) => {
    // where chỉ có khoá unique và create cùng giá trị → Prisma chạy ON CONFLICT, 2 tin đầu cùng lúc không lỗi.
    const conv = await tx.chatConversation.upsert({
      where: { userId: user.id },
      create: { userId: user.id, adminUnreadCount: 1, lastMessageAt: now },
      update: { adminUnreadCount: { increment: 1 }, lastMessageAt: now },
      select: { id: true },
    })
    const msg = await tx.chatMessage.create({
      data: { conversationId: conv.id, fromAdmin: false, senderName: user.username, body, createdAt: now },
      select: MESSAGE_SELECT,
    })
    return { ...msg, senderName: null } satisfies ChatMessageDto
  })
}

export async function getUserUnread(db: PrismaClient, userId: number) {
  const conv = await db.chatConversation.findUnique({ where: { userId }, select: { userUnreadCount: true } })
  return { count: conv?.userUnreadCount ?? 0 }
}

export async function listUserMessages(db: PrismaClient, userId: number, cursor?: number) {
  const conv = await db.chatConversation.findUnique({ where: { userId }, select: { id: true, adminReadAt: true } })
  if (!conv) return { items: [] as ChatMessageDto[], nextCursor: null, otherReadAt: null }
  return { ...(await pageMessages(db, conv.id, cursor, false)), otherReadAt: conv.adminReadAt }
}

export async function markUserRead(db: PrismaClient, userId: number) {
  await db.chatConversation.updateMany({ where: { userId }, data: { userUnreadCount: 0, userReadAt: new Date() } })
  return { ok: true as const }
}

const LIVE_USER = { user: { isDeleted: false } } as const

export async function getAdminUnread(db: PrismaClient) {
  const conversations = await db.chatConversation.count({ where: { adminUnreadCount: { gt: 0 }, ...LIVE_USER } })
  return { conversations }
}

export async function listAdminInbox(db: PrismaClient, limit: number) {
  const rows = await db.chatConversation.findMany({
    where: LIVE_USER,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      userId: true,
      lastMessageAt: true,
      adminUnreadCount: true,
      user: { select: { username: true, fullName: true } },
      messages: { orderBy: { id: "desc" }, take: 1, select: { body: true, fromAdmin: true } },
    },
  })
  return {
    items: rows.slice(0, limit).map((r) => ({
      userId: r.userId,
      username: r.user.username,
      fullName: r.user.fullName,
      lastMessageAt: r.lastMessageAt,
      unread: r.adminUnreadCount,
      preview: chatPreview(r.messages[0]?.body ?? ""),
      lastFromAdmin: r.messages[0]?.fromAdmin ?? false,
    })),
    hasMore: rows.length > limit,
  }
}

export async function listAdminMessages(db: PrismaClient, userId: number, cursor?: number) {
  const conv = await db.chatConversation.findFirst({ where: { userId, ...LIVE_USER }, select: { id: true, userReadAt: true } })
  if (!conv) return { items: [] as ChatMessageDto[], nextCursor: null, otherReadAt: null }
  return { ...(await pageMessages(db, conv.id, cursor, true)), otherReadAt: conv.userReadAt }
}

export async function sendAdminMessage(db: PrismaClient, adminUsername: string, userId: number, body: string) {
  const target = await db.user.findUnique({ where: { id: userId }, select: { username: true, isDeleted: true } })
  if (!target || target.isDeleted || isAdminUsername(target.username)) throw new TRPCError({ code: "NOT_FOUND" })
  const now = new Date()
  return db.$transaction(async (tx) => {
    // Admin trả lời tức là đã đọc phía admin.
    const conv = await tx.chatConversation.upsert({
      where: { userId },
      create: { userId, userUnreadCount: 1, adminReadAt: now, lastMessageAt: now },
      update: { userUnreadCount: { increment: 1 }, adminUnreadCount: 0, adminReadAt: now, lastMessageAt: now },
      select: { id: true },
    })
    const msg = await tx.chatMessage.create({
      data: { conversationId: conv.id, fromAdmin: true, senderName: adminUsername, body, createdAt: now },
      select: MESSAGE_SELECT,
    })
    return msg satisfies ChatMessageDto
  })
}

export async function markAdminRead(db: PrismaClient, userId: number) {
  await db.chatConversation.updateMany({ where: { userId }, data: { adminUnreadCount: 0, adminReadAt: new Date() } })
  return { ok: true as const }
}
