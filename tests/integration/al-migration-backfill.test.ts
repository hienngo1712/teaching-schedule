import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

// Đọc đúng phần backfill trong file migration AL (sau mốc "-- BACKFILL"), tách từng câu SQL.
function backfillStatements(): string[] {
  const dir = join(process.cwd(), "prisma/migrations")
  const name = readdirSync(dir).find((d) => d.endsWith("_al_teaching_places"))!
  const sql = readFileSync(join(dir, name, "migration.sql"), "utf8")
  const tail = sql.slice(sql.indexOf("-- BACKFILL"))
  return tail
    .split(/;\s*\r?\n/)
    .map((s) => s.split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n").trim())
    .filter(Boolean)
}

async function runBackfill() {
  for (const stmt of backfillStatements()) await db.$executeRawUnsafe(stmt)
}

async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.student.deleteMany()
  await db.studentPlaceChange.deleteMany()
  await db.teachingPlace.deleteMany()
}

describe("AL migration: backfill Lớp tại nhà", () => {
  beforeEach(clean)
  afterEach(() => vi.useRealTimers())

  async function seedData() {
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, 5, 0, 0)))
    const result: { username: string }[] = []
    for (const username of ["teacher", "teacher2"]) {
      const caller = await getAuthedCaller(username)
      const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: `HS ${username}`, grade: 6, tuitionFee: 150_000 })
      const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
      for (const date of ["2026-08-12", "2026-09-10"]) {
        const s = await caller.session.create({ sessionDate: date, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id] })
        await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
      }
      result.push({ username })
    }
    // Như dữ liệu trước migration: chưa có nơi dạy, HS/ca chưa gắn nơi.
    await db.student.updateMany({ data: { placeId: null } })
    await db.teachingSession.updateMany({ data: { placeId: null } })
    await db.teachingPlace.deleteMany()
    return result
  }

  it("mỗi user có đúng 1 nơi 'Lớp tại nhà' per_student, mọi HS/ca có placeId, chạy lại không nhân đôi", async () => {
    await seedData()
    await runBackfill()

    const users = await db.user.findMany({ select: { id: true } })
    const places = await db.teachingPlace.findMany({ include: { billingChanges: true } })
    expect(places).toHaveLength(users.length)
    for (const u of users) {
      const mine = places.filter((p) => p.userId === u.id)
      expect(mine).toHaveLength(1)
      expect(mine[0]).toMatchObject({ name: "Lớp tại nhà", kind: "home", color: "#4F46E5", sortOrder: 0 })
      expect(mine[0].billingChanges.map((b) => [b.fromKey, b.billing])).toEqual([[0, "per_student"]])
    }
    expect(await db.student.count({ where: { placeId: null } })).toBe(0)
    expect(await db.teachingSession.count({ where: { placeId: null } })).toBe(0)
    // HS/ca gắn đúng nơi của chính user đó.
    for (const st of await db.student.findMany({ include: { place: true } })) expect(st.place!.userId).toBe(st.userId)
    for (const s of await db.teachingSession.findMany({ include: { place: true } })) expect(s.place!.userId).toBe(s.userId)
    // Lịch sử ẩn nơi học (RULING AL Task 2): mỗi HS 1 dòng fromKey 0 trỏ đúng nơi hiện tại.
    for (const st of await db.student.findMany({ include: { placeChanges: true } })) {
      expect(st.placeChanges.map((c) => [c.fromKey, c.placeId])).toEqual([[0, st.placeId]])
    }

    await runBackfill()
    expect(await db.teachingPlace.count()).toBe(users.length)
    expect(await db.placeBillingChange.count()).toBe(users.length)
    expect(await db.studentPlaceChange.count()).toBe(await db.student.count())
  })

  it("số tiền Tổng quan và Báo cáo trước = sau backfill", async () => {
    await seedData()
    const caller = await getAuthedCaller("teacher")
    const before = {
      dashboard: await caller.report.dashboard(),
      aug: await caller.report.monthlySummary({ year: 2026, month: 8 }),
      sep: await caller.report.monthlySummary({ year: 2026, month: 9 }),
    }
    await runBackfill()
    const after = {
      dashboard: await caller.report.dashboard(),
      aug: await caller.report.monthlySummary({ year: 2026, month: 8 }),
      sep: await caller.report.monthlySummary({ year: 2026, month: 9 }),
    }
    expect(after).toEqual(before)
    expect(before.dashboard.totalUnpaidMonth).toBe(300_000)
  })
})
