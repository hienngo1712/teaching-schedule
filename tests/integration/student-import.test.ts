import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function resetStudents() {
  await db.sessionStudent.deleteMany()
  await db.student.deleteMany()
}

async function countStudents(username = "teacher") {
  const user = await db.user.findUniqueOrThrow({ where: { username } })
  return db.student.count({ where: { userId: user.id } })
}

describe("Nhập học sinh từ Excel", () => {
  beforeEach(async () => {
    await resetStudents()
  })

  it("✓ importMany 3 dòng hợp lệ → created 3, field đúng, isActive=true", async () => {
    const caller = await getAuthedCaller()
    const res = await caller.student.importMany({
      rows: [
        { fullName: "Nguyễn An", grade: 5, parentName: "Chị Hoa", parentPhone: "0912345678", tuitionFee: 150000, notes: "Yếu toán" },
        { fullName: "Trần Bình", grade: 3 },
        { fullName: "Lê Chi", grade: 9, tuitionFee: 200000 },
      ],
    })
    expect(res).toEqual({ created: 3 })

    const list = await caller.student.list({ includeInactive: true, limit: 50 })
    expect(list.items).toHaveLength(3)
    expect(list.items.every((s) => s.isActive)).toBe(true)
    expect(list.items.find((s) => s.fullName === "Nguyễn An")).toMatchObject({
      grade: 5,
      parentName: "Chị Hoa",
      parentPhone: "0912345678",
      tuitionFee: 150000,
      notes: "Yếu toán",
    })
    expect(list.items.find((s) => s.fullName === "Trần Bình")).toMatchObject({
      parentName: null,
      parentPhone: null,
      notes: null,
      tuitionFee: 0,
    })
  })

  it("✗ 1 dòng sai trong lô (lớp 0 / SĐT sai) → BAD_REQUEST, không tạo em nào", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.student.importMany({ rows: [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Trần Bình", grade: 0 }] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(
      caller.student.importMany({
        rows: [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Trần Bình", grade: 3, parentPhone: "12345" }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await countStudents()).toBe(0)
  })

  it("✓ importCheck nhận ra trùng HS đang học và HS đã nghỉ; khác lớp không trùng", async () => {
    const caller = await getAuthedCaller()
    const an = await caller.student.create({ fullName: "Nguyễn Văn An", grade: 5 })
    const binh = await caller.student.create({ fullName: "Trần Bình", grade: 3 })
    await caller.student.delete({ id: binh.id })

    const { matches } = await caller.student.importCheck({
      rows: [
        { fullName: "  nguyễn   VĂN an ", grade: 5 },
        { fullName: "Trần Bình".normalize("NFD"), grade: 3 },
        { fullName: "Nguyễn Văn An", grade: 6 },
      ],
    })
    expect(matches[0]).toMatchObject({ id: an.id, isActive: true })
    expect(matches[1]).toMatchObject({ id: binh.id, isActive: false, fullName: "Trần Bình", grade: 3 })
    expect(matches[2]).toBeNull()
  })

  it("✓ importCheck: có cả HS đã nghỉ và đang học cùng khóa → trả HS đang học", async () => {
    const caller = await getAuthedCaller()
    const old = await caller.student.create({ fullName: "Nguyễn An", grade: 5 })
    await caller.student.delete({ id: old.id })
    const current = await caller.student.create({ fullName: "Nguyễn An", grade: 5 })
    const { matches } = await caller.student.importCheck({ rows: [{ fullName: "Nguyễn An", grade: 5 }] })
    expect(matches[0]).toMatchObject({ id: current.id, isActive: true })
  })

  it("✗/✓ importMany trùng HS có sẵn: allowDuplicate=false → CONFLICT; true → tạo", async () => {
    const caller = await getAuthedCaller()
    await caller.student.create({ fullName: "Nguyễn An", grade: 5 })

    await expect(
      caller.student.importMany({ rows: [{ fullName: "Trần Bình", grade: 3 }, { fullName: "nguyễn an", grade: 5 }] })
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("chọn lại file") })
    expect(await countStudents()).toBe(1)

    const res = await caller.student.importMany({
      rows: [{ fullName: "Trần Bình", grade: 3 }, { fullName: "nguyễn an", grade: 5, allowDuplicate: true }],
    })
    expect(res.created).toBe(2)
    expect(await countStudents()).toBe(3)
  })

  it("✗ hai dòng cùng khóa trong lô, dòng 2 không allowDuplicate → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.student.importMany({ rows: [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Nguyễn  An", grade: 5 }] })
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(await countStudents()).toBe(0)
  })

  it("✗ gọi importMany 2 lần cùng dữ liệu → lần 2 CONFLICT (chống nhập 2 lần)", async () => {
    const caller = await getAuthedCaller()
    const rows = [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Trần Bình", grade: 3 }]
    await caller.student.importMany({ rows })
    await expect(caller.student.importMany({ rows })).rejects.toMatchObject({ code: "CONFLICT" })
    expect(await countStudents()).toBe(2)
  })

  it("✓ multi-tenant: HS của user khác cùng tên + lớp không tính là trùng", async () => {
    const other = await getAuthedCaller("teacher2")
    await other.student.create({ fullName: "Nguyễn An", grade: 5 })
    const caller = await getAuthedCaller()
    const { matches } = await caller.student.importCheck({ rows: [{ fullName: "Nguyễn An", grade: 5 }] })
    expect(matches).toEqual([null])
    expect((await caller.student.importMany({ rows: [{ fullName: "Nguyễn An", grade: 5 }] })).created).toBe(1)
  })

  it("✗ 501 dòng → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const rows = Array.from({ length: 501 }, (_, i) => ({ fullName: `Học sinh ${i}`, grade: 1 }))
    await expect(caller.student.importMany({ rows })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(caller.student.importCheck({ rows })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await countStudents()).toBe(0)
  })

  it("✓ 300 dòng nhập trong 1 lần; kiểm tra lại → tất cả trùng", async () => {
    const caller = await getAuthedCaller()
    const rows = Array.from({ length: 300 }, (_, i) => ({ fullName: `Học sinh ${i}`, grade: (i % 9) + 1 }))
    expect((await caller.student.importMany({ rows })).created).toBe(300)
    const { matches } = await caller.student.importCheck({ rows })
    expect(matches.every((m) => m !== null)).toBe(true)
  })
})
