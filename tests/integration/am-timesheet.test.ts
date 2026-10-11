// Spec AM §3, §6: router timesheet / income / placeRate / placePayment.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

async function clean() {
  await db.placePayment.deleteMany()
  await db.placeRateChange.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

const home = { name: "Lớp tại nhà", kind: "home" as const, color: "#4F46E5", billing: "per_student" as const }
const center = { name: "TT Ánh Dương", kind: "center" as const, color: "#0891B2", billing: "per_session" as const }

async function userOf(username: string) {
  return db.user.findUniqueOrThrow({ where: { username } })
}

async function subjectFor(userId: number) {
  return (await db.subject.findFirst({ where: { userId } })) ?? db.subject.create({ data: { userId, name: "Toán", color: "#000000" } })
}

async function addSession(
  userId: number,
  placeId: number | null,
  date: string,
  opts: { start?: string; end?: string; status?: string; cancelReason?: string; makeupOfId?: number; studentId?: number } = {}
) {
  const subject = await subjectFor(userId)
  return db.teachingSession.create({
    data: {
      userId,
      placeId,
      subjectId: subject.id,
      sessionDate: day(date),
      startTime: time(opts.start ?? "08:00"),
      endTime: time(opts.end ?? "09:30"),
      status: opts.status ?? "scheduled",
      cancelReason: opts.cancelReason,
      makeupOfId: opts.makeupOfId,
      ...(opts.studentId ? { sessionStudents: { create: { studentId: opts.studentId, attendance: "present", grade: 5 } } } : {}),
    },
  })
}

describe("AM: bảng công + thu nhập nơi dạy", () => {
  beforeEach(async () => {
    await clean()
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5, 0, 0))) // 20/10/2026 12:00 VN
  })
  afterEach(() => vi.useRealTimers())

  it("kịch bản spec: 2 ca đã qua 1,5 giờ + 1 ca mai + 1 ca huỷ ở nơi theo giờ 185k → 2 ca / 3 giờ / 555.000", async () => {
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    const p = (await caller.place.create(center))!
    await caller.placeRate.set({ placeId: p.id, unit: "hour", amount: 185000, fromYear: 2026, fromMonth: 10 })
    const st = await db.student.create({ data: { userId: u.id, fullName: "HS A", grade: 5, placeId: p.id } })
    await addSession(u.id, p.id, "2026-10-05", { studentId: st.id })
    await addSession(u.id, p.id, "2026-10-12")
    await addSession(u.id, p.id, "2026-10-21")
    await addSession(u.id, p.id, "2026-10-08", { status: "cancelled", cancelReason: "Nghỉ lễ" })

    const ts = await caller.timesheet.month({ placeId: p.id, year: 2026, month: 10 })
    expect(ts.place).toMatchObject({ id: p.id, name: "TT Ánh Dương" })
    expect(ts.stats).toEqual({ doneCount: 2, doneHours: 3, makeupCount: 0, cancelledCount: 1, cancelledHours: 1.5, scheduledCount: 4 })
    expect(ts.sessions.map((s) => [s.date, s.kind, s.hours])).toEqual([
      ["2026-10-05", "done", 1.5],
      ["2026-10-08", "cancelled", 1.5],
      ["2026-10-12", "done", 1.5],
      ["2026-10-21", "upcoming", 1.5],
    ])
    expect(ts.sessions[0]).toMatchObject({ start: "08:00", end: "09:30", presentCount: 1, totalCount: 1, isMakeup: false })
    expect(ts.sessions[1].cancelReason).toBe("Nghỉ lễ")
    expect(ts.unassignedCount).toBe(0)

    expect(await caller.income.month({ year: 2026, month: 10 })).toEqual([
      expect.objectContaining({ placeId: p.id, name: "TT Ánh Dương", unit: "hour", amount: 185000, doneCount: 2, doneHours: 3, expected: 555000, received: 0, status: "unpaid" }),
    ])
  })

  it("ca bù tính công và đếm riêng", async () => {
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    const p = (await caller.place.create(center))!
    const cancelled = await addSession(u.id, p.id, "2026-10-03", { status: "cancelled" })
    await addSession(u.id, p.id, "2026-10-05", { makeupOfId: cancelled.id })
    const ts = await caller.timesheet.month({ placeId: p.id, year: 2026, month: 10 })
    expect(ts.stats).toMatchObject({ doneCount: 1, makeupCount: 1, cancelledCount: 1 })
    expect(ts.sessions.find((s) => s.isMakeup)?.kind).toBe("done")
  })

  it("[RF 3] ghi nhận 500k → một phần; xoá → chưa nhận", async () => {
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    const p = (await caller.place.create(center))!
    await caller.placeRate.set({ placeId: p.id, unit: "hour", amount: 185000, fromYear: 2026, fromMonth: 10 })
    await addSession(u.id, p.id, "2026-10-05")
    await addSession(u.id, p.id, "2026-10-12")
    const pay = await caller.placePayment.create({ placeId: p.id, year: 2026, month: 10, amount: 500000, receivedAt: "2026-10-15", note: "Chuyển khoản" })
    expect((await caller.income.month({ year: 2026, month: 10 }))[0]).toMatchObject({ received: 500000, status: "partial" })
    const detail = await caller.income.detail({ placeId: p.id, year: 2026, month: 10 })
    expect(detail.lines).toEqual([{ unit: "hour", amount: 185000, count: 2, hours: 3, total: 555000 }])
    expect(detail.payments).toEqual([expect.objectContaining({ id: pay.id, amount: 500000, receivedAt: "2026-10-15", note: "Chuyển khoản" })])
    await caller.placePayment.delete({ id: pay.id })
    expect((await caller.income.month({ year: 2026, month: 10 }))[0]).toMatchObject({ received: 0, status: "unpaid" })
    expect((await caller.income.detail({ placeId: p.id, year: 2026, month: 10 })).payments).toEqual([])
  })

  it("[RF 2] đổi giá từ tháng sau: tháng trước giá cũ; sửa 'áp dụng từ' về tháng trước thì tháng đó đổi theo", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 11, 20, 5, 0, 0))) // 20/12/2026
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    const p = (await caller.place.create(center))!
    await addSession(u.id, p.id, "2026-10-05")
    await addSession(u.id, p.id, "2026-11-05")
    await caller.placeRate.set({ placeId: p.id, unit: "hour", amount: 185000, fromYear: 2026, fromMonth: 10 })
    await caller.placeRate.set({ placeId: p.id, unit: "hour", amount: 200000, fromYear: 2026, fromMonth: 11 })
    expect((await caller.income.month({ year: 2026, month: 10 }))[0].expected).toBe(277500)
    expect((await caller.income.month({ year: 2026, month: 11 }))[0].expected).toBe(300000)
    await caller.placeRate.set({ placeId: p.id, unit: "hour", amount: 200000, fromYear: 2026, fromMonth: 10 })
    expect((await caller.income.month({ year: 2026, month: 10 }))[0].expected).toBe(300000)
    expect((await caller.placeRate.history({ placeId: p.id })).map((r) => [r.fromYear, r.fromMonth, r.amount])).toEqual([
      [2026, 11, 200000],
      [2026, 10, 200000],
    ])
    // Quá 12 tháng trước / tháng tương lai → BAD_REQUEST.
    await expect(caller.placeRate.set({ placeId: p.id, unit: "hour", amount: 1, fromYear: 2025, fromMonth: 11 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(caller.placeRate.set({ placeId: p.id, unit: "hour", amount: 1, fromYear: 2027, fromMonth: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("nơi chưa có ca: đơn giá áp cho mọi tháng; nơi chưa có đơn giá không có trong Thu nhập", async () => {
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    const a = (await caller.place.create(center))!
    const b = (await caller.place.create({ ...center, name: "TT Sao Mai" }))!
    await caller.placeRate.set({ placeId: a.id, unit: "session", amount: 250000, fromYear: 2026, fromMonth: 10 })
    expect(await db.placeRateChange.findMany({ where: { placeId: a.id }, select: { fromKey: true } })).toEqual([{ fromKey: 0 }])
    await addSession(u.id, a.id, "2026-09-05")
    await addSession(u.id, b.id, "2026-09-06")
    expect((await caller.income.month({ year: 2026, month: 9 })).map((r) => [r.name, r.expected])).toEqual([["TT Ánh Dương", 250000]])
  })

  it("nơi theo học sinh có đơn giá cũ (đã đổi cách tính) không có trong Thu nhập", async () => {
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    const p = (await caller.place.create(center))!
    await caller.placeRate.set({ placeId: p.id, unit: "session", amount: 200000, fromYear: 2026, fromMonth: 10 })
    await addSession(u.id, p.id, "2026-10-05")
    await caller.place.update({ id: p.id, billing: "per_student" })
    expect(await caller.income.month({ year: 2026, month: 10 })).toEqual([])
    expect((await caller.timesheet.month({ year: 2026, month: 10 })).sessions).toEqual([])
  })

  it("nơi của user khác → NOT_FOUND", async () => {
    const owner = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const p = (await owner.place.create(center))!
    const pay = await owner.placePayment.create({ placeId: p.id, year: 2026, month: 10, amount: 100000, receivedAt: "2026-10-15" })
    await expect(other.timesheet.month({ placeId: p.id, year: 2026, month: 10 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.income.detail({ placeId: p.id, year: 2026, month: 10 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.placeRate.set({ placeId: p.id, unit: "hour", amount: 1, fromYear: 2026, fromMonth: 10 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.placeRate.history({ placeId: p.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.placePayment.create({ placeId: p.id, year: 2026, month: 10, amount: 1, receivedAt: "2026-10-15" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.placePayment.delete({ id: pay.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("Standard: timesheet.month / placePayment.create → FORBIDDEN; income.month được", async () => {
    const std = await getAuthedCaller("teacher_std")
    const p = (await std.place.create(center))!
    await expect(std.timesheet.month({ placeId: p.id, year: 2026, month: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(std.placePayment.create({ placeId: p.id, year: 2026, month: 10, amount: 1, receivedAt: "2026-10-15" })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await std.placeRate.set({ placeId: p.id, unit: "session", amount: 200000, fromYear: 2026, fromMonth: 10 })
    expect(await std.income.month({ year: 2026, month: 10 })).toHaveLength(1)
    // Lịch sử nhận là gói Plus: Standard xem diễn giải, không có payments.
    expect((await std.income.detail({ placeId: p.id, year: 2026, month: 10 })).payments).toBeNull()
  })

  it("[RF 5] nơi xoá mềm: tháng cũ vẫn tính ở Tất cả; tháng mới không hiện", async () => {
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    await caller.place.create(home)
    const p = (await caller.place.create(center))!
    await caller.placeRate.set({ placeId: p.id, unit: "session", amount: 200000, fromYear: 2026, fromMonth: 10 })
    await addSession(u.id, p.id, "2026-09-05")
    await db.teachingPlace.update({ where: { id: p.id }, data: { isDeleted: true, deletedAt: new Date() } })
    const sep = await caller.timesheet.month({ year: 2026, month: 9 })
    expect(sep.stats.doneCount).toBe(1)
    expect((await caller.income.month({ year: 2026, month: 9 })).map((r) => r.placeId)).toEqual([p.id])
    expect(await caller.income.month({ year: 2026, month: 10 })).toEqual([])
  })

  it("Tất cả nơi: chỉ ca ở nơi theo ca/giờ; đếm ca chưa gắn nơi khi có ≥ 2 nơi", async () => {
    const caller = await getAuthedCaller()
    const u = await userOf("teacher")
    const h = (await caller.place.create(home))!
    const c = (await caller.place.create(center))!
    await addSession(u.id, h.id, "2026-10-05")
    await addSession(u.id, c.id, "2026-10-06")
    await addSession(u.id, null, "2026-10-07")
    const all = await caller.timesheet.month({ year: 2026, month: 10 })
    expect(all.place).toBeNull()
    expect(all.sessions.map((s) => s.date)).toEqual(["2026-10-06"])
    expect(all.unassignedCount).toBe(1)
  })
})
