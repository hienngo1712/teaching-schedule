import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function clean() {
  await db.chatMessage.deleteMany()
  await db.chatConversation.deleteMany()
  await db.user.updateMany({ where: { username: { in: ["teacher", "teacher2"] } }, data: { isDeleted: false, deletedAt: null } })
}

const userIdOf = async (username: string) => (await db.user.findUniqueOrThrow({ where: { username } })).id

describe("chat (spec AC §5)", () => {
  beforeEach(async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    await clean()
  })
  afterEach(async () => {
    delete process.env.ADMIN_USERNAMES
    await clean()
  })

  it("giáo viên gửi: tạo cuộc trò chuyện, trim, tăng adminUnreadCount, trả DTO không có senderName", async () => {
    const t = await getAuthedCaller("teacher")
    const msg = await t.chat.send({ body: "  Cho hỏi cách nhập Excel  " })
    expect(msg).toMatchObject({ fromAdmin: false, senderName: null, body: "Cho hỏi cách nhập Excel" })
    await t.chat.send({ body: "Cảm ơn" })
    const conv = await db.chatConversation.findUniqueOrThrow({ where: { userId: await userIdOf("teacher") } })
    expect(conv.adminUnreadCount).toBe(2)
    expect(conv.userUnreadCount).toBe(0)
    const stored = await db.chatMessage.findFirstOrThrow({ where: { id: msg.id } })
    expect(stored.senderName).toBe("teacher")
  })

  it("rỗng sau trim hoặc > 2000 ký tự bị BAD_REQUEST, không tạo gì", async () => {
    const t = await getAuthedCaller("teacher")
    await expect(t.chat.send({ body: "   \n " })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(t.chat.send({ body: "a".repeat(2001) })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.chatConversation.count()).toBe(0)
  })

  it("body trong DB là ciphertext, đọc qua API ra bản rõ", async () => {
    const t = await getAuthedCaller("teacher")
    const msg = await t.chat.send({ body: "SĐT phụ huynh 0901234567" })
    // Alias cột để decryptResult không giải mã.
    const [raw] = await db.$queryRaw<Array<{ b: string }>>`SELECT body AS b FROM chat_messages WHERE id = ${msg.id}`
    expect(raw.b.startsWith("enc:v1:")).toBe(true)
    expect(raw.b).not.toContain("0901234567")
    const page = await t.chat.messages({})
    expect(page.items[0].body).toBe("SĐT phụ huynh 0901234567")
  })

  it("admin trả lời: tăng userUnreadCount, xoá adminUnreadCount; markRead 2 phía; otherReadAt", async () => {
    const t = await getAuthedCaller("teacher")
    const admin = await getAuthedCaller("admin_test")
    const uid = await userIdOf("teacher")
    await t.chat.send({ body: "Hỏi 1" })
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 1 })

    const reply = await admin.admin.chatSend({ userId: uid, body: "Chào thầy" })
    expect(reply).toMatchObject({ fromAdmin: true, senderName: "admin_test" })
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 0 })
    expect(await t.chat.unread()).toEqual({ count: 1 })

    // Phía giáo viên không thấy username admin.
    const teacherView = await t.chat.messages({})
    expect(teacherView.items.map((m) => m.senderName)).toEqual([null, null])
    expect(teacherView.otherReadAt).not.toBeNull()

    await t.chat.markRead()
    expect(await t.chat.unread()).toEqual({ count: 0 })
    const adminView = await admin.admin.chatMessages({ userId: uid })
    expect(adminView.otherReadAt).not.toBeNull()
    expect(adminView.items.map((m) => m.senderName)).toEqual(["teacher", "admin_test"])

    await t.chat.send({ body: "Hỏi 2" })
    await admin.admin.chatMarkRead({ userId: uid })
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 0 })
  })

  it("chưa có cuộc trò chuyện: unread 0, messages rỗng, markRead không lỗi", async () => {
    const t = await getAuthedCaller("teacher")
    expect(await t.chat.unread()).toEqual({ count: 0 })
    expect(await t.chat.messages({})).toEqual({ items: [], nextCursor: null, otherReadAt: null })
    expect(await t.chat.markRead()).toEqual({ ok: true })
  })

  it("phân trang 30 tin, trong trang cũ → mới, nextCursor đúng", async () => {
    const t = await getAuthedCaller("teacher")
    const uid = await userIdOf("teacher")
    const conv = await db.chatConversation.create({ data: { userId: uid } })
    for (let i = 0; i < 32; i++) {
      await db.chatMessage.create({ data: { conversationId: conv.id, fromAdmin: false, senderName: "teacher", body: `m${i}` } })
    }
    const p1 = await t.chat.messages({})
    expect(p1.items).toHaveLength(30)
    expect(p1.items[0].body).toBe("m2")
    expect(p1.items[29].body).toBe("m31")
    expect(p1.nextCursor).toBe(p1.items[0].id)
    const p2 = await t.chat.messages({ cursor: p1.nextCursor! })
    expect(p2.items.map((m) => m.body)).toEqual(["m0", "m1"])
    expect(p2.nextCursor).toBeNull()
  })

  it("giới hạn 30 tin / 10 phút cho giáo viên; tin cũ hơn không tính; admin không giới hạn", async () => {
    const t = await getAuthedCaller("teacher")
    const uid = await userIdOf("teacher")
    const conv = await db.chatConversation.create({ data: { userId: uid } })
    const old = new Date(Date.now() - 11 * 60_000)
    await db.chatMessage.create({ data: { conversationId: conv.id, fromAdmin: false, senderName: "teacher", body: "cũ", createdAt: old } })
    await db.chatMessage.createMany({
      data: Array.from({ length: 29 }, (_, i) => ({ conversationId: conv.id, fromAdmin: false, senderName: "teacher", body: `x${i}` })),
    })
    await t.chat.send({ body: "tin thứ 30" })
    await expect(t.chat.send({ body: "tin thứ 31" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: "CHAT_LIMIT" })
    const admin = await getAuthedCaller("admin_test")
    for (let i = 0; i < 31; i++) await admin.admin.chatSend({ userId: uid, body: `a${i}` })
  })

  it("giáo viên A không thấy tin của B; quyền chéo bị FORBIDDEN", async () => {
    const a = await getAuthedCaller("teacher")
    const b = await getAuthedCaller("teacher2")
    await a.chat.send({ body: "bí mật của A" })
    expect((await b.chat.messages({})).items).toEqual([])
    expect(await b.chat.unread()).toEqual({ count: 0 })

    const admin = await getAuthedCaller("admin_test")
    await expect(admin.chat.send({ body: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.chat.unread()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(a.admin.chatInbox({})).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(a.admin.chatSend({ userId: await userIdOf("teacher2"), body: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("chatSend tới tài khoản không tồn tại, đã xoá mềm hoặc admin → NOT_FOUND", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.chatSend({ userId: 999999, body: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(admin.admin.chatSend({ userId: await userIdOf("admin_test"), body: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await db.user.update({ where: { username: "teacher2" }, data: { isDeleted: true, deletedAt: new Date() } })
    await expect(admin.admin.chatSend({ userId: await userIdOf("teacher2"), body: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("chatInbox: mới nhất trước, preview cắt 60 ký tự, lastFromAdmin, ẩn tài khoản xoá mềm, hasMore", async () => {
    const admin = await getAuthedCaller("admin_test")
    await (await getAuthedCaller("teacher")).chat.send({ body: "a".repeat(80) })
    await new Promise((r) => setTimeout(r, 5))
    await (await getAuthedCaller("teacher2")).chat.send({ body: "Xin   chào\nadmin" })
    await admin.admin.chatSend({ userId: await userIdOf("teacher2"), body: "Chào cô" })

    const inbox = await admin.admin.chatInbox({})
    expect(inbox.items.map((i) => i.username)).toEqual(["teacher2", "teacher"])
    expect(inbox.items[0]).toMatchObject({ preview: "Chào cô", lastFromAdmin: true, unread: 0 })
    expect(inbox.items[1]).toMatchObject({ preview: "a".repeat(59) + "…", lastFromAdmin: false, unread: 1, fullName: "Giáo viên Test" })
    expect(inbox.hasMore).toBe(false)
    expect((await admin.admin.chatInbox({ limit: 1 })).hasMore).toBe(true)

    await db.user.update({ where: { username: "teacher" }, data: { isDeleted: true, deletedAt: new Date() } })
    expect((await admin.admin.chatInbox({})).items.map((i) => i.username)).toEqual(["teacher2"])
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 0 })
  })
})
