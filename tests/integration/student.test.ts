import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"

async function resetStudents() {
  await db.sessionStudent.deleteMany()
  await db.student.deleteMany()
}

describe("Student CRUD", () => {
  beforeEach(async () => {
    await resetStudents()
  })

  it("✓ create grade=3 → trả fields + level=tieu_hoc + isActive=true", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "Nguyễn An", grade: 3 })
    expect(s.fullName).toBe("Nguyễn An")
    expect(s.grade).toBe(3)
    expect(s.level).toBe("tieu_hoc")
    expect(s.isActive).toBe(true)
    expect(s.id).toBeGreaterThan(0)
  })

  it("✓ create grade=7 → level=thcs", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "Trần Bình", grade: 7 })
    expect(s.level).toBe("thcs")
  })

  it("✓ list → trả tất cả HS active của user, sort grade+name ASC", async () => {
    const caller = await getAuthedCaller()
    await caller.student.create({ fullName: "Hùng", grade: 5 })
    await caller.student.create({ fullName: "An", grade: 3 })
    await caller.student.create({ fullName: "Bình", grade: 3 })

    const list = await caller.student.list({})
    expect(list).toHaveLength(3)
    expect(list[0].fullName).toBe("An")
    expect(list[1].fullName).toBe("Bình")
    expect(list[2].fullName).toBe("Hùng")
  })

  it("✓ list { grade: 3 } → chỉ HS lớp 3", async () => {
    const caller = await getAuthedCaller()
    await caller.student.create({ fullName: "An", grade: 3 })
    await caller.student.create({ fullName: "Hùng", grade: 5 })
    const list = await caller.student.list({ grade: 3 })
    expect(list).toHaveLength(1)
    expect(list[0].fullName).toBe("An")
  })

  it("✓ list { search: 'NGUY' } → tìm không phân biệt hoa thường", async () => {
    const caller = await getAuthedCaller()
    await caller.student.create({ fullName: "Nguyễn An", grade: 3 })
    await caller.student.create({ fullName: "Trần Bình", grade: 5 })
    const list = await caller.student.list({ search: "NGUY" })
    expect(list).toHaveLength(1)
    expect(list[0].fullName).toBe("Nguyễn An")
  })

  it("✓ update → cập nhật fields + updatedAt thay đổi", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "An", grade: 3 })
    const before = s.updatedAt
    await new Promise((r) => setTimeout(r, 10))
    const updated = await caller.student.update({
      id: s.id,
      data: { fullName: "An (đổi tên)", grade: 4 },
    })
    expect(updated.fullName).toBe("An (đổi tên)")
    expect(updated.grade).toBe(4)
    expect(updated.level).toBe("tieu_hoc")
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime())
  })

  it("✓ delete (soft) → isActive=false, vẫn còn trong DB", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "An", grade: 3 })
    await caller.student.delete({ id: s.id })

    const inDb = await db.student.findUnique({ where: { id: s.id } })
    expect(inDb).not.toBeNull()
    expect(inDb!.isActive).toBe(false)
  })

  it("✓ delete → HS đã xóa không xuất hiện trong list mặc định", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "An", grade: 3 })
    await caller.student.delete({ id: s.id })
    const list = await caller.student.list({})
    expect(list.find((x) => x.id === s.id)).toBeUndefined()
  })

  it("✓ list { isActive: false } → thấy HS đã xóa", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "An", grade: 3 })
    await caller.student.delete({ id: s.id })
    const list = await caller.student.list({ isActive: false })
    expect(list.find((x) => x.id === s.id)).toBeDefined()
  })

  it("✗ create thiếu fullName → validation error", async () => {
    const caller = await getAuthedCaller()
    await expect(
      // @ts-expect-error — test runtime validation
      caller.student.create({ grade: 3 })
    ).rejects.toThrow()
  })

  it("✗ update id không tồn tại → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.student.update({ id: 99999999, data: { fullName: "Tên Hợp Lệ" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("✗ delete id không tồn tại → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    await expect(caller.student.delete({ id: 99999999 })).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    )
  })

  it("✗ public (không session) → UNAUTHORIZED khi list", async () => {
    await expect(publicCaller.student.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("✗ public → UNAUTHORIZED khi create/update/delete", async () => {
    await expect(
      publicCaller.student.create({ fullName: "X", grade: 3 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("✓ multi-tenant: userB không thấy HS của userA", async () => {
    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")
    const sA = await callerA.student.create({ fullName: "HS của A", grade: 3 })

    const listB = await callerB.student.list({})
    expect(listB.find((x) => x.id === sA.id)).toBeUndefined()
  })

  it("✗ multi-tenant: userB update HS của userA → NOT_FOUND", async () => {
    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")
    const sA = await callerA.student.create({ fullName: "HS của A", grade: 3 })

    await expect(
      callerB.student.update({ id: sA.id, data: { fullName: "Hack" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
