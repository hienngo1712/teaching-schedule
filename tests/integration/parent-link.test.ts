import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { PARENT_TOKEN_REGEX } from "@/server/services/parent-link.service"

async function cleanup() {
  await db.monthlyTuition.deleteMany() // cascade xoá Payment (B)
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ data: { isActive: true } })
  await db.user.update({ where: { username: "teacher2" }, data: { fullName: "Giáo viên Test 2" } })
}

beforeEach(cleanup)
afterAll(cleanup)

describe("student.generateParentLink / disableParentLink", () => {
  it("tạo link → token 43 ký tự base64url, student.list trả đúng token", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Có Link", grade: 5 })
    const { token } = await caller.student.generateParentLink({ id: s.id })
    expect(token).toMatch(PARENT_TOKEN_REGEX)
    const list = await caller.student.list({ search: "HS Có Link" })
    expect(list.items[0].parentLinkToken).toBe(token)
  })

  it("tạo lại → token đổi, token cũ không còn trong DB", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Tạo Lại", grade: 5 })
    const first = await caller.student.generateParentLink({ id: s.id })
    const second = await caller.student.generateParentLink({ id: s.id })
    expect(second.token).not.toBe(first.token)
    expect(await db.student.findUnique({ where: { parentLinkToken: first.token } })).toBeNull()
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBe(second.token)
  })

  it("tắt link → parentLinkToken = null", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Tắt Link", grade: 5 })
    await caller.student.generateParentLink({ id: s.id })
    expect(await caller.student.disableParentLink({ id: s.id })).toEqual({ success: true })
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBeNull()
  })

  it("HS của user khác → NOT_FOUND cho cả tạo và tắt, token giữ nguyên", async () => {
    const owner = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const s = await owner.student.create({ fullName: "HS Của Người Khác", grade: 5 })
    const { token } = await owner.student.generateParentLink({ id: s.id })
    await expect(other.student.generateParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.student.disableParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBe(token)
  })

  it("chưa đăng nhập → UNAUTHORIZED", async () => {
    await expect(publicCaller.student.generateParentLink({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    await expect(publicCaller.student.disableParentLink({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})
