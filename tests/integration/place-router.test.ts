import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { monthKey } from "@/lib/billing"
import { getAuthedCaller } from "../helpers/trpc"

const NOW = new Date(Date.UTC(2026, 9, 20, 5, 0, 0)) // 20/10/2026
const CUR = monthKey(2026, 10)

async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

const home = { name: "Lớp tại nhà", kind: "home" as const, color: "#4F46E5", billing: "per_student" as const }
const center = { name: "TT Ánh Dương", kind: "center" as const, color: "#0891B2", billing: "per_session" as const }

describe("Router place (spec AL §4.1)", () => {
  beforeEach(async () => {
    await clean()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it("tạo, liệt kê, sửa tên/màu; trùng tên → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.place.create(home)
    await caller.place.create(center)
    expect((await caller.place.list()).map((p) => [p.name, p.kind, p.billing])).toEqual([
      ["Lớp tại nhà", "home", "per_student"],
      ["TT Ánh Dương", "center", "per_session"],
    ])
    await caller.place.update({ id: a!.id, name: "Nhà riêng", color: "#059669" })
    expect((await caller.place.list())[0]).toMatchObject({ name: "Nhà riêng", color: "#059669" })
    await expect(caller.place.create({ ...center })).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("đổi cách tính: nơi chưa có dữ liệu ghi fromKey 0; có dữ liệu ghi tháng hiện tại", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.place.create(home)
    const b = await caller.place.create({ ...home, name: "Gia sư", kind: "tutor" })
    await caller.place.update({ id: a!.id, billing: "per_session" })
    expect(await db.placeBillingChange.findMany({ where: { placeId: a!.id }, select: { fromKey: true, billing: true } })).toEqual([
      { fromKey: 0, billing: "per_session" },
    ])

    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS", grade: 5 })
    await db.student.update({ where: { id: st.id }, data: { placeId: b!.id } })
    await caller.place.update({ id: b!.id, billing: "per_session" })
    const rows = await db.placeBillingChange.findMany({ where: { placeId: b!.id }, orderBy: { fromKey: "asc" }, select: { fromKey: true, billing: true } })
    expect(rows).toEqual([
      { fromKey: 0, billing: "per_student" },
      { fromKey: CUR, billing: "per_session" },
    ])
    // Đổi về như tháng trước → bỏ dòng tháng này.
    await caller.place.update({ id: b!.id, billing: "per_student" })
    expect(await db.placeBillingChange.count({ where: { placeId: b!.id } })).toBe(1)
  })

  // [RF 4]
  it("xoá: chặn nơi cuối, chặn khi còn HS đang học hoặc ca từ hôm nay; còn lại xoá mềm", async () => {
    const caller = await getAuthedCaller()
    const a = await caller.place.create(home)
    await expect(caller.place.delete({ id: a!.id })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "place_last" })

    const b = await caller.place.create(center)
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS TT", grade: 5 })
    await db.student.update({ where: { id: st.id }, data: { placeId: b!.id } })
    await expect(caller.place.delete({ id: b!.id })).rejects.toMatchObject({ message: "place_in_use" })

    await db.student.update({ where: { id: st.id }, data: { isActive: false } })
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const s = await caller.session.create({ sessionDate: "2026-10-25", startTime: "06:00", endTime: "07:00", subjectId })
    await db.teachingSession.update({ where: { id: s.id }, data: { placeId: b!.id } })
    await expect(caller.place.delete({ id: b!.id })).rejects.toMatchObject({ message: "place_in_use" })

    // Ca đã qua không chặn.
    await db.teachingSession.update({ where: { id: s.id }, data: { sessionDate: new Date(Date.UTC(2026, 9, 1)) } })
    await caller.place.delete({ id: b!.id })
    expect((await caller.place.list()).map((p) => p.name)).toEqual(["Lớp tại nhà"])
    // Tạo lại đúng tên nơi đã xoá → dựng lại nơi đó, không báo trùng.
    await caller.place.create(center)
    expect((await caller.place.list()).map((p) => p.name)).toEqual(["Lớp tại nhà", "TT Ánh Dương"])
  })

  it("summary: chưa có nơi / chỉ nhà / chỉ trung tâm / hỗn hợp", async () => {
    const caller = await getAuthedCaller()
    expect(await caller.place.summary()).toEqual({ count: 0, hasPerStudent: true, hasPerSession: false })
    const a = await caller.place.create(home)
    expect(await caller.place.summary()).toEqual({ count: 1, hasPerStudent: true, hasPerSession: false })
    await caller.place.create(center)
    expect(await caller.place.summary()).toEqual({ count: 2, hasPerStudent: true, hasPerSession: true })
    await caller.place.delete({ id: a!.id })
    expect(await caller.place.summary()).toEqual({ count: 1, hasPerStudent: false, hasPerSession: true })
  })

  it("user khác không sửa/xoá được nơi của mình → NOT_FOUND", async () => {
    const a = await (await getAuthedCaller("teacher")).place.create(home)
    const other = await getAuthedCaller("teacher2")
    await expect(other.place.update({ id: a!.id, name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.place.delete({ id: a!.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
