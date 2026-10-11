import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { monthKey } from "@/lib/billing"
import { getAuthedCaller } from "../helpers/trpc"

const NOW = new Date(Date.UTC(2026, 9, 20, 5, 0, 0)) // 20/10/2026

async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

const home = { name: "Lớp tại nhà", kind: "home" as const, color: "#4F46E5", billing: "per_student" as const }
const center = { name: "TT Ánh Dương", kind: "center" as const, color: "#0891B2", billing: "per_session" as const }

describe("AL: học sinh và ca gắn nơi dạy", () => {
  beforeEach(async () => {
    await clean()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  async function setup() {
    const caller = await getAuthedCaller()
    // Trung tâm tạo trước (sortOrder 0) để kiểm "mặc định = nơi theo học sinh đầu tiên", không phải nơi đầu tiên.
    const c = (await caller.place.create(center))!
    const h = (await caller.place.create(home))!
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    return { caller, c, h, subjectId }
  }

  it("(a) tạo HS không truyền nơi → nơi theo học sinh mặc định + lịch sử fromKey 0", async () => {
    const { caller, h } = await setup()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Mặc định", grade: 5 })
    expect(st.placeId).toBe(h.id)
    expect(await db.studentPlaceChange.findMany({ where: { studentId: st.id }, select: { fromKey: true, placeId: true } })).toEqual([
      { fromKey: 0, placeId: h.id },
    ])
  })

  it("(b) nơi của user khác → NOT_FOUND (tạo HS và tạo ca)", async () => {
    const { caller, subjectId } = await setup()
    const other = (await (await getAuthedCaller("teacher2")).place.create({ ...home, name: "Nơi GV2" }))!
    await expect(
      caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Lạ", grade: 5, placeId: other.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      caller.session.create({ sessionDate: "2026-10-22", startTime: "06:00", endTime: "07:00", subjectId, placeId: other.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("đổi nơi học → placeId mới + lịch sử từ tháng hiện tại, tháng cũ giữ nơi cũ", async () => {
    const { caller, c, h } = await setup()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Chuyển", grade: 5, placeId: h.id })
    await caller.student.update({ id: st.id, data: { placeId: c.id } })
    expect((await db.student.findUniqueOrThrow({ where: { id: st.id } })).placeId).toBe(c.id)
    expect(
      await db.studentPlaceChange.findMany({ where: { studentId: st.id }, orderBy: { fromKey: "asc" }, select: { fromKey: true, placeId: true } })
    ).toEqual([
      { fromKey: 0, placeId: h.id },
      { fromKey: monthKey(2026, 10), placeId: c.id },
    ])
  })

  it("(d) tạo ca không truyền nơi → nơi học của HS đầu; truyền nơi thì giữ nơi đó", async () => {
    const { caller, c, h, subjectId } = await setup()
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS TT", grade: 5, placeId: c.id })
    const s1 = await caller.session.create({ sessionDate: "2026-10-22", startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id] })
    expect(s1.placeId).toBe(c.id)
    const s2 = await caller.session.create({ sessionDate: "2026-10-23", startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id], placeId: h.id })
    expect(s2.placeId).toBe(h.id)
    const s3 = await caller.session.create({ sessionDate: "2026-10-24", startTime: "06:00", endTime: "07:00", subjectId })
    expect(s3.placeId).toBe(h.id)
  })

  it("(e) chép lịch tháng và lịch lặp giữ nơi của ca", async () => {
    const { caller, c, subjectId } = await setup()
    await caller.session.bulkCreate({
      startDate: "2026-10-01", endDate: "2026-10-31", weekdays: [3], startTime: "08:00", endTime: "09:00", subjectId, placeId: c.id,
    })
    const oct = await db.teachingSession.findMany({ where: { sessionDate: { gte: new Date(Date.UTC(2026, 9, 1)), lt: new Date(Date.UTC(2026, 10, 1)) } } })
    expect(oct.length).toBeGreaterThan(0)
    expect(oct.every((s) => s.placeId === c.id)).toBe(true)

    const preview = await caller.session.copyMonthPreview({ source: { year: 2026, month: 10 }, from: { year: 2026, month: 11 }, months: 1 })
    await caller.session.copyMonth({ source: { year: 2026, month: 10 }, from: { year: 2026, month: 11 }, months: 1, patternKeys: preview.patterns.map((p) => p.key) })
    const nov = await db.teachingSession.findMany({ where: { sessionDate: { gte: new Date(Date.UTC(2026, 10, 1)), lt: new Date(Date.UTC(2026, 11, 1)) } } })
    expect(nov.length).toBeGreaterThan(0)
    expect(nov.every((s) => s.placeId === c.id)).toBe(true)
  })

  it("(f) lịch lọc theo nơi dạy", async () => {
    const { caller, c, h, subjectId } = await setup()
    await caller.session.create({ sessionDate: "2026-10-22", startTime: "06:00", endTime: "07:00", subjectId, placeId: c.id })
    await caller.session.create({ sessionDate: "2026-10-23", startTime: "06:00", endTime: "07:00", subjectId, placeId: h.id })
    const onlyCenter = await caller.session.getMonth({ year: 2026, month: 10, placeId: c.id })
    expect(onlyCenter.map((s) => s.placeId)).toEqual([c.id])
    expect((await caller.session.getMonth({ year: 2026, month: 10 })).length).toBe(2)
  })

  it("danh sách HS lọc theo nơi học", async () => {
    const { caller, c, h } = await setup()
    await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Nhà", grade: 5, placeId: h.id })
    await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS TT", grade: 5, placeId: c.id })
    const onlyCenter = await caller.student.list({ placeId: c.id, page: 1, limit: 50 })
    expect(onlyCenter.items.map((s) => s.fullName)).toEqual(["HS TT"])
    expect((await caller.student.list({ page: 1, limit: 50 })).totalCount).toBe(2)
  })
})
