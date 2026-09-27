import { describe, it, expect, beforeAll, afterEach } from "vitest"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { getSessionUserState } from "@/server/auth-credentials"
import { nodeJwt } from "@/server/auth-node-callbacks"
import { currentEpoch } from "@/lib/session-policy"
import { changeUserPassword } from "@/server/services/user.service"

let teacherId = 0
beforeAll(async () => {
  teacherId = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
})
afterEach(async () => {
  await db.user.update({ where: { id: teacherId }, data: { isActive: true, sessionVersion: 0, mustChangePassword: false } })
})

type P = Parameters<typeof nodeJwt>[0]
const token = (over: Record<string, unknown> = {}) => ({
  userId: String(teacherId),
  username: "teacher",
  fullName: null,
  remember: false,
  epoch: currentEpoch(),
  sessionVersion: 0,
  mustChangePassword: false,
  iat: Math.floor(Date.now() / 1000) - 60,
  ...over,
})
const call = (tok: Record<string, unknown>, user?: Record<string, unknown>) => nodeJwt({ token: tok, user } as unknown as P)

describe("getSessionUserState (spec N Q10–Q11)", () => {
  it("đúng sessionVersion + đang hoạt động → trả cờ mustChangePassword", async () => {
    expect(await getSessionUserState(teacherId, 0)).toEqual({ mustChangePassword: false })
    await db.user.update({ where: { id: teacherId }, data: { mustChangePassword: true } })
    expect(await getSessionUserState(teacherId, 0)).toEqual({ mustChangePassword: true })
  })

  it("lệch version / token thiếu version / bị khóa / id không tồn tại / id không phải số → null", async () => {
    expect(await getSessionUserState(teacherId, 1)).toBeNull()
    expect(await getSessionUserState(teacherId, undefined)).toBeNull()
    expect(await getSessionUserState(999_999, 0)).toBeNull()
    expect(await getSessionUserState(Number("abc"), 0)).toBeNull()
    await db.user.update({ where: { id: teacherId }, data: { isActive: false } })
    expect(await getSessionUserState(teacherId, 0)).toBeNull()
  })
})

describe("nodeJwt (spec N Q11)", () => {
  it("token hợp lệ → giữ phiên", async () => {
    expect(await call(token())).toMatchObject({ userId: String(teacherId) })
  })

  it("sessionVersion trong DB tăng (đổi/reset mật khẩu) → null", async () => {
    await db.user.update({ where: { id: teacherId }, data: { sessionVersion: { increment: 1 } } })
    expect(await call(token())).toBeNull()
  })

  it("tài khoản bị khóa → null", async () => {
    await db.user.update({ where: { id: teacherId }, data: { isActive: false } })
    expect(await call(token())).toBeNull()
  })

  it("token cũ thiếu sessionVersion → null", async () => {
    const old = token()
    delete (old as Record<string, unknown>).sessionVersion
    expect(await call(old)).toBeNull()
  })

  it("lệch epoch → null ngay ở luật Edge", async () => {
    expect(await call(token({ epoch: "0.0-old" }))).toBeNull()
  })

  it("cờ mustChangePassword lấy từ DB, không tin token", async () => {
    await db.user.update({ where: { id: teacherId }, data: { mustChangePassword: true } })
    expect(await call(token({ mustChangePassword: false }))).toMatchObject({ mustChangePassword: true })
  })

  it("nhánh vừa đăng nhập không tra DB; token mới mang version mới qua được lần gọi kế tiếp", async () => {
    await db.user.update({ where: { id: teacherId }, data: { sessionVersion: 1 } })
    const fresh = await call({}, { id: String(teacherId), username: "teacher", fullName: null, sessionVersion: 1 })
    expect(fresh).toMatchObject({ sessionVersion: 1 })
    expect(await call({ ...fresh!, iat: Math.floor(Date.now() / 1000) })).toMatchObject({ sessionVersion: 1 })
    expect(await call(token({ sessionVersion: 0 }))).toBeNull()
  })

  it("sau changeUserPassword → token cũ null", async () => {
    await changeUserPassword(db, teacherId, "teacher123", "NewSecret@2026")
    try {
      expect(await call(token())).toBeNull()
    } finally {
      await db.user.update({ where: { id: teacherId }, data: { passwordHash: await bcrypt.hash("teacher123", 4) } })
    }
  })
})
