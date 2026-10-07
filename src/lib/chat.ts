import dayjs from "@/lib/dayjs"

const VN_TZ = "Asia/Ho_Chi_Minh"

// Chu kỳ polling (spec AC §6.1); `live` dùng khi realtime đang nối (phần 2).
export const CHAT_POLL_MS = { unread: 60_000, adminUnread: 30_000, inbox: 10_000, thread: 5_000, live: 30_000 } as const

export const CHAT_PREVIEW_MAX = 60
export const CHAT_EVENT = "chat:new"
export const ADMIN_CHAT_CHANNEL = "private-chat-admins"

export function userChatChannel(userId: number): string {
  return `private-chat-user-${userId}`
}

export function chatPreview(body: string): string {
  const one = body.replace(/\s+/g, " ").trim()
  return one.length > CHAT_PREVIEW_MAX ? one.slice(0, CHAT_PREVIEW_MAX - 1) + "…" : one
}

// So ngày bằng chuỗi giờ VN: isSame của dayjs tz dễ lệch múi.
export function chatTime(date: Date | string, now: Date = new Date()): string {
  const d = dayjs(date).tz(VN_TZ)
  const sameDay = d.format("YYYY-MM-DD") === dayjs(now).tz(VN_TZ).format("YYYY-MM-DD")
  return d.format(sameDay ? "HH:mm" : "DD/MM HH:mm")
}
