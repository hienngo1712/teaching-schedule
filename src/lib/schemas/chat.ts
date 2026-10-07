import { z } from "zod"

export const CHAT_BODY_MAX = 2000
export const CHAT_INBOX_PAGE = 30
export const CHAT_INBOX_MAX = 200

// trim chạy trước min/max nên chuỗi toàn khoảng trắng bị từ chối.
const chatBody = z.string().trim().min(1).max(CHAT_BODY_MAX)
const userId = z.number().int().positive()
const cursor = z.number().int().positive().optional()

export const chatSendSchema = z.object({ body: chatBody })
export const chatCursorSchema = z.object({ cursor })
export const adminChatThreadSchema = z.object({ userId, cursor })
export const adminChatSendSchema = z.object({ userId, body: chatBody })
export const adminChatUserSchema = z.object({ userId })
export const adminChatInboxSchema = z.object({ limit: z.number().int().min(1).max(CHAT_INBOX_MAX).default(CHAT_INBOX_PAGE) })
