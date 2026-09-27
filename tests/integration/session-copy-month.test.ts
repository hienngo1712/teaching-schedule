import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import { TRPCError } from "@trpc/server"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { formatTime, parseTimeToDate } from "@/lib/utils"

// Tháng xa để không dính "ngày đã qua".
const D = (s: string) => new Date(`${s}T00:00:00.000Z`)
const SRC = { year: 2030, month: 1 }
const FEB = { year: 2030, month: 2 }

let uid = 0
let uid2 = 0
let subjectId = 0
let subject2Id = 0
let stA = 0
let stB = 0
let stC = 0
let st2 = 0
const monKey = () => `0|17:00|19:00|${subjectId}`

type MkOpts = { status?: string; makeupOfId?: number; title?: string; notes?: string; studentIds?: number[] }
async function mk(userId: number, subject: number, date: string, start: string, end: string, o: MkOpts = {}) {
  return db.teachingSession.create({
    data: {
      userId,
      subjectId: subject,
      sessionDate: D(date),
      startTime: parseTimeToDate(start),
      endTime: parseTimeToDate(end),
      title: o.title ?? null,
      notes: o.notes ?? null,
      status: o.status ?? "scheduled",
      makeupOfId: o.makeupOfId ?? null,
      sessionStudents: { create: (o.studentIds ?? []).map((studentId) => ({ studentId, fee: 1, grade: 1 })) },
    },
  })
}

// 1/2030 của teacher: T2 17–19 (14 huỷ + bù T6 18/1; 28 là lần cuối có HS A, B, C(nghỉ)), T4 08–09:30 chỉ HS C → no_students, T7 26 lẻ.
async function seedSource() {
  await mk(uid, subjectId, "2030-01-07", "17:00", "19:00", { title: "Nhóm A", studentIds: [stA] })
  const cancelled = await mk(uid, subjectId, "2030-01-14", "17:00", "19:00", { title: "Nhóm A", status: "cancelled", studentIds: [stA] })
  await mk(uid, subjectId, "2030-01-18", "17:00", "19:00", { title: "Bù", makeupOfId: cancelled.id, studentIds: [stA] })
  await mk(uid, subjectId, "2030-01-21", "17:00", "19:00", { title: "Nhóm A", studentIds: [stA] })
  await mk(uid, subjectId, "2030-01-28", "17:00", "19:00", { title: "Nhóm A2", notes: "ôn chương 3", studentIds: [stA, stB, stC] })
  for (const d of ["02", "09", "16", "23", "30"]) {
    await mk(uid, subjectId, `2030-01-${d}`, "08:00", "09:30", { studentIds: [stC] })
  }
  await mk(uid, subjectId, "2030-01-26", "10:00", "11:00")
}

const countFrom = (userId: number, from: string) =>
  db.teachingSession.count({ where: { userId, sessionDate: { gte: D(from) } } })

async function errorOf(p: Promise<unknown>): Promise<TRPCError> {
  const e = await p.then(() => null, (err: unknown) => err)
  expect(e).toBeInstanceOf(TRPCError)
  return e as TRPCError
}

describe("session.copyMonthPreview / copyMonth (spec M)", () => {
  beforeAll(async () => {
    uid = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
    uid2 = (await db.user.findUniqueOrThrow({ where: { username: "teacher2" } })).id
    subjectId = (await db.subject.create({ data: { userId: uid, name: "Toán M", color: "#0891B2" } })).id
    subject2Id = (await db.subject.create({ data: { userId: uid2, name: "Văn M", color: "#0891B2" } })).id
    stA = (await db.student.create({ data: { userId: uid, fullName: "HS A chép", grade: 5, tuitionFee: 100000 } })).id
    stB = (await db.student.create({ data: { userId: uid, fullName: "HS B chép", grade: 4, tuitionFee: 80000 } })).id
    stC = (await db.student.create({ data: { userId: uid, fullName: "HS C nghỉ", grade: 3, tuitionFee: 50000, isActive: false } })).id
    st2 = (await db.student.create({ data: { userId: uid2, fullName: "HS của teacher2", grade: 5, tuitionFee: 90000 } })).id
  })

  beforeEach(async () => {
    await db.teachingSession.deleteMany({ where: { userId: { in: [uid, uid2] } } })
    await db.student.update({ where: { id: stA }, data: { tuitionFee: 100000, grade: 5 } })
  })

  afterAll(async () => {
    await db.teachingSession.deleteMany({ where: { userId: { in: [uid, uid2] } } })
    await db.student.deleteMany({ where: { id: { in: [stA, stB, stC, st2] } } })
    await db.subject.deleteMany({ where: { id: { in: [subjectId, subject2Id] } } })
  })

  it("xem trước mặc định: ca bù không thành mẫu, chỉ regular chọn sẵn, bỏ HS đã nghỉ", async () => {
    await seedSource()
    const p = await (await getAuthedCaller("teacher")).session.copyMonthPreview({ source: SRC, from: FEB, months: 1 })
    expect(p.patterns.map((x) => [x.weekday, x.startTime, x.kind, x.selected])).toEqual([
      [0, "17:00", "regular", true],
      [2, "08:00", "no_students", false],
      [5, "10:00", "single", false],
    ])
    expect(p.patterns[0]).toMatchObject({
      key: monKey(),
      title: "Nhóm A2",
      studentCount: 2,
      droppedInactive: 1,
      lastDate: "2030-01-28",
      subject: { id: subjectId, name: "Toán M", color: "#0891B2" },
      perMonth: [{ year: 2030, month: 2, slots: 4, created: 4, existing: 0, conflict: 0, past: 0 }],
    })
    expect(p.totals).toEqual({ created: 4, existing: 0, conflict: 0, past: 0 })
    expect(p.months).toEqual([{ year: 2030, month: 2, created: 4 }])
    expect(p.conflicts).toEqual([])
  })

  it("copyMonth 1 tháng: đúng thứ, HS còn học, fee/grade hiện tại, pending, không notes, không phải ca bù", async () => {
    await seedSource()
    await db.student.update({ where: { id: stA }, data: { tuitionFee: 150000, grade: 6 } })
    const res = await (await getAuthedCaller("teacher")).session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey()] })
    expect(res).toEqual({ created: 4, months: [{ year: 2030, month: 2, created: 4 }], skipped: { existing: 0, conflict: 0, past: 0 } })

    const rows = await db.teachingSession.findMany({
      where: { userId: uid, sessionDate: { gte: D("2030-02-01"), lt: D("2030-03-01") } },
      include: { sessionStudents: true },
      orderBy: { sessionDate: "asc" },
    })
    expect(rows.map((r) => r.sessionDate.toISOString().slice(0, 10))).toEqual(["2030-02-04", "2030-02-11", "2030-02-18", "2030-02-25"])
    for (const r of rows) {
      expect(r).toMatchObject({ subjectId, title: "Nhóm A2", notes: null, status: "scheduled", makeupOfId: null, cancelReason: null })
      expect([formatTime(r.startTime), formatTime(r.endTime)]).toEqual(["17:00", "19:00"])
      expect(r.sessionStudents.map((s) => s.studentId).sort((a, b) => a - b)).toEqual([stA, stB].sort((a, b) => a - b))
      expect(r.sessionStudents.find((s) => s.studentId === stA)).toMatchObject({ attendance: "pending", fee: 150000, grade: 6 })
      expect(r.sessionStudents.find((s) => s.studentId === stB)).toMatchObject({ attendance: "pending", fee: 80000, grade: 4 })
    }
  })

  it("idempotent: chạy lại không tạo trùng; ca đã chép bị huỷ không hồi sinh", async () => {
    await seedSource()
    const c = await getAuthedCaller("teacher")
    const input = { source: SRC, from: FEB, months: 1, patternKeys: [monKey()] }
    await c.session.copyMonth(input)
    expect(await c.session.copyMonth(input)).toMatchObject({ created: 0, skipped: { existing: 4, conflict: 0, past: 0 } })
    const first = await db.teachingSession.findFirstOrThrow({ where: { userId: uid, sessionDate: D("2030-02-04") } })
    await db.teachingSession.update({ where: { id: first.id }, data: { status: "cancelled", cancelledAt: new Date() } })
    expect((await c.session.copyMonth(input)).created).toBe(0)
    expect(await countFrom(uid, "2030-02-01")).toBe(4)
  })

  it("ca tay chồng giờ ở tháng đích → conflict, ca tay giữ nguyên; ca huỷ khác giờ không chặn", async () => {
    await seedSource()
    const manual = await mk(uid, subjectId, "2030-02-11", "17:30", "18:30", { title: "Ca tay" })
    await mk(uid, subjectId, "2030-02-18", "16:00", "17:30", { status: "cancelled" })
    const c = await getAuthedCaller("teacher")
    const p = await c.session.copyMonthPreview({ source: SRC, from: FEB, months: 1 })
    expect(p.totals).toEqual({ created: 3, existing: 0, conflict: 1, past: 0 })
    expect(p.conflicts).toEqual([{ patternKey: monKey(), date: "2030-02-11", conflict: '"Ca tay" (Toán M)' }])
    expect((await c.session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey()] })).created).toBe(3)
    expect(await db.teachingSession.findUniqueOrThrow({ where: { id: manual.id } })).toMatchObject({ title: "Ca tay", status: "scheduled" })
  })

  it("3 tháng qua năm (11/2030 → 1/2031): đúng từng tháng", async () => {
    await seedSource()
    const res = await (await getAuthedCaller("teacher")).session.copyMonth({
      source: SRC,
      from: { year: 2030, month: 11 },
      months: 3,
      patternKeys: [monKey()],
    })
    expect(res.months).toEqual([
      { year: 2030, month: 11, created: 4 },
      { year: 2030, month: 12, created: 5 },
      { year: 2031, month: 1, created: 4 },
    ])
    expect(res.created).toBe(13)
  })

  it("2 request song song chỉ tạo 1 lần (khóa advisory + tính lại trong transaction)", async () => {
    await seedSource()
    const c = await getAuthedCaller("teacher")
    const input = { source: SRC, from: FEB, months: 1, patternKeys: [monKey()] }
    const [a, b] = await Promise.all([c.session.copyMonth(input), c.session.copyMonth(input)])
    expect([a.created, b.created].sort((x, y) => x - y)).toEqual([0, 4])
    expect(await countFrom(uid, "2030-02-01")).toBe(4)
  })

  it("vượt 300 ca → BAD_REQUEST trước khi ghi, không có ca nào được tạo", async () => {
    const data = []
    for (const day of ["07", "14", "21", "28", "01", "08", "15", "22", "29"]) {
      for (let h = 6; h < 22; h++) {
        const hh = String(h).padStart(2, "0")
        data.push({ userId: uid, subjectId, sessionDate: D(`2030-01-${day}`), startTime: parseTimeToDate(`${hh}:00`), endTime: parseTimeToDate(`${hh}:50`) })
      }
    }
    await db.teachingSession.createMany({ data })
    const c = await getAuthedCaller("teacher")
    const p = await c.session.copyMonthPreview({ source: SRC, from: FEB, months: 3 })
    expect(p.totals.created).toBe(416)
    const err = await errorOf(c.session.copyMonth({ source: SRC, from: FEB, months: 3, patternKeys: p.patterns.map((x) => x.key) }))
    expect(err.code).toBe("BAD_REQUEST")
    expect(err.message).toBe("Quá nhiều ca, hãy chọn ít tháng hơn")
    expect(await countFrom(uid, "2030-02-01")).toBe(0)
  })

  it("key lạ bị bỏ qua; toàn key lạ → BAD_REQUEST", async () => {
    await seedSource()
    const c = await getAuthedCaller("teacher")
    const ok = await c.session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey(), "6|23:00|23:30|999999"] })
    expect(ok.created).toBe(4)
    const err = await errorOf(c.session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: ["6|23:00|23:30|999999"] }))
    expect(err.code).toBe("BAD_REQUEST")
    expect(err.message).toBe("Không có mẫu lịch hợp lệ để chép")
  })

  it("multi-tenant: ca/HS của user khác không kéo vào, không gây existing/conflict", async () => {
    await seedSource()
    await mk(uid2, subject2Id, "2030-02-04", "17:00", "19:00", { studentIds: [st2] })
    const res = await (await getAuthedCaller("teacher")).session.copyMonth({ source: SRC, from: FEB, months: 1, patternKeys: [monKey()] })
    expect(res).toMatchObject({ created: 4, skipped: { existing: 0, conflict: 0, past: 0 } })
    const p2 = await (await getAuthedCaller("teacher2")).session.copyMonthPreview({ source: SRC, from: FEB, months: 1 })
    expect(p2.patterns).toEqual([])
    const links = await db.sessionStudent.findMany({ where: { session: { userId: uid } }, select: { studentId: true } })
    expect(links.some((l) => l.studentId === st2)).toBe(false)
  })
})
