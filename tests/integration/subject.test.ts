import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function resetSubjects() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.subject.deleteMany()
}

async function createSessionFor(subjectId: number) {
  const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  await db.teachingSession.create({
    data: {
      userId: user.id,
      sessionDate: new Date("2026-05-01"),
      startTime: new Date("1970-01-01T08:00:00Z"),
      endTime: new Date("1970-01-01T09:30:00Z"),
      subjectId,
    },
  })
}

describe("Subject CRUD", () => {
  beforeEach(async () => {
    await resetSubjects()
  })

  it("✓ list → trả subjects user vừa tạo (≥1) kèm name + color", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Toán", color: "#0891B2" })
    const subjects = await caller.subject.list({})
    expect(subjects.length).toBeGreaterThanOrEqual(1)
    expect(subjects[0]).toHaveProperty("name")
    expect(subjects[0]).toHaveProperty("color")
  })

  it("✓ list → sort theo sortOrder ASC", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "C", sortOrder: 3 })
    await caller.subject.create({ name: "A", sortOrder: 1 })
    await caller.subject.create({ name: "B", sortOrder: 2 })
    const subjects = await caller.subject.list({})
    expect(subjects.map((s) => s.sortOrder)).toEqual([1, 2, 3])
  })

  it("✓ create → trả subject mới với fields đúng", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.subject.create({
      name: "Tiếng Anh",
      color: "#4F46E5",
      isDefault: true,
      sortOrder: 1,
    })
    expect(s.name).toBe("Tiếng Anh")
    expect(s.color).toBe("#4F46E5")
    expect(s.isDefault).toBe(true)
  })

  it("✓ create isDefault=true → subject khác bị set isDefault=false", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.subject.create({ name: "A", isDefault: true })
    await caller.subject.create({ name: "B", isDefault: true })
    const refreshed = await db.subject.findUnique({ where: { id: a.id } })
    expect(refreshed?.isDefault).toBe(false)
  })

  it("✗ create name trùng → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Toán" })
    await expect(caller.subject.create({ name: "Toán" })).rejects.toMatchObject(
      { code: "BAD_REQUEST" }
    )
  })

  it("✓ update name + color", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.subject.create({ name: "Lý", color: "#000000" })
    const updated = await caller.subject.update({
      id: s.id,
      data: { name: "Vật Lý", color: "#D97706" },
    })
    expect(updated.name).toBe("Vật Lý")
    expect(updated.color).toBe("#D97706")
  })

  it("✓ delete (soft) → không hiện trong list active", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Keep" })
    const target = await caller.subject.create({ name: "Bỏ" })
    await caller.subject.delete({ id: target.id })
    const active = await caller.subject.list({ isActive: true })
    expect(active.find((s) => s.id === target.id)).toBeUndefined()
  })

  it("✗ delete subject đang được dùng bởi session → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Backup" }) // tránh "subject cuối cùng"
    const target = await caller.subject.create({ name: "Đang dùng" })
    const user = await db.user.findUniqueOrThrow({
      where: { username: "teacher" },
    })
    await db.teachingSession.create({
      data: {
        userId: user.id,
        sessionDate: new Date("2026-05-01"),
        startTime: new Date("1970-01-01T08:00:00Z"),
        endTime: new Date("1970-01-01T09:30:00Z"),
        subjectId: target.id,
      },
    })
    await expect(
      caller.subject.delete({ id: target.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("✓ update isActive=false → ẩn được môn đã có ca, ca cũ giữ subjectId", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const target = await caller.subject.create({ name: "Đã dạy" })
    await createSessionFor(target.id)

    const updated = await caller.subject.update({ id: target.id, data: { isActive: false } })
    expect(updated.isActive).toBe(false)
    const active = await caller.subject.list({ isActive: true })
    expect(active.find((s) => s.id === target.id)).toBeUndefined()
    expect(await db.teachingSession.count({ where: { subjectId: target.id } })).toBe(1)
  })

  it("✗ ẩn môn mặc định → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const def = await caller.subject.create({ name: "Mặc định", isDefault: true })
    await caller.subject.create({ name: "Khác" })
    await expect(
      caller.subject.update({ id: def.id, data: { isActive: false } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("mặc định") })
  })

  it("✗ ẩn môn đang dạy cuối cùng → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const only = await caller.subject.create({ name: "Duy nhất" })
    await expect(
      caller.subject.update({ id: only.id, data: { isActive: false } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("cuối cùng") })
  })

  it("✓ update isActive=true → hiện lại môn đã ẩn", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const target = await caller.subject.create({ name: "Tạm ẩn" })
    await caller.subject.update({ id: target.id, data: { isActive: false } })
    await caller.subject.update({ id: target.id, data: { isActive: true } })
    const active = await caller.subject.list({ isActive: true })
    expect(active.find((s) => s.id === target.id)).toBeDefined()
  })

  it("✗ đặt môn đã ẩn làm mặc định → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const target = await caller.subject.create({ name: "Đang ẩn" })
    await caller.subject.update({ id: target.id, data: { isActive: false } })
    await expect(
      caller.subject.update({ id: target.id, data: { isDefault: true } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("đã ẩn") })
  })

  it("✗ bỏ mặc định ở môn đang mặc định → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const def = await caller.subject.create({ name: "Mặc định", isDefault: true })
    await caller.subject.create({ name: "Khác" })
    await expect(
      caller.subject.update({ id: def.id, data: { isDefault: false } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("mặc định khác") })
  })

  it("✓ create không truyền sortOrder → xếp cuối danh sách", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "A", sortOrder: 5 })
    await caller.subject.create({ name: "B", sortOrder: 2 })
    const created = await caller.subject.create({ name: "Mới" })
    expect(created.sortOrder).toBe(6)
    const list = await caller.subject.list({})
    expect(list[list.length - 1].id).toBe(created.id)
  })

  it("✗ create trùng tên môn đã ẩn → báo đang bị ẩn; trùng môn đang dạy → đã tồn tại", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const hidden = await caller.subject.create({ name: "Hóa" })
    await caller.subject.update({ id: hidden.id, data: { isActive: false } })

    await expect(caller.subject.create({ name: "Hóa" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("đang bị ẩn"),
    })
    await expect(caller.subject.create({ name: "Giữ lại" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Tên môn học đã tồn tại",
    })
  })
})
