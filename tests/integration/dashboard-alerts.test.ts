import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { getCancelledWithoutMakeup } from "@/server/services/session.service"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function userIdOf(username: string) {
  return (await db.user.findUniqueOrThrow({ where: { username } })).id
}

// Tạo ca; nếu có presentFee thì điểm danh "có mặt" cho mọi HS với học phí đó.
async function addSession(
  caller: Caller,
  opts: { date: string; start?: string; end?: string; studentIds?: number[]; presentFee?: number }
) {
  const subjectId = (await caller.subject.list({}))[0].id
  const s = await caller.session.create({
    sessionDate: opts.date,
    startTime: opts.start ?? "08:00",
    endTime: opts.end ?? "09:00",
    subjectId,
  })
  if (opts.studentIds?.length) {
    await caller.session.addStudents({ sessionId: s.id, studentIds: opts.studentIds })
    if (opts.presentFee !== undefined) {
      const fee = opts.presentFee
      await caller.attendance.update({
        sessionId: s.id,
        attendances: opts.studentIds.map((studentId) => ({
          studentId,
          attendance: ATTENDANCE_STATUS.PRESENT,
          fee,
        })),
      })
    }
  }
  return s
}

// Huỷ trực tiếp (không tạo ca bù) — mô phỏng dữ liệu cũ.
async function cancelDirect(id: number) {
  await db.teachingSession.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date() },
  })
}

describe("getCancelledWithoutMakeup", () => {
  const from = new Date(Date.UTC(2026, 6, 27)) // 27/07/2026

  beforeEach(async () => {
    await cleanup()
  })

  it("ca bù bị xoá → ca gốc hiện; còn ca bù → không; khôi phục → biến mất", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Ca Nghỉ", grade: 4 })
    const orig = await addSession(caller, { date: "2026-09-15", studentIds: [st.id] })
    const { makeup } = await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-09-18", startTime: "08:00", endTime: "09:00",
    })

    const withMakeup = await getCancelledWithoutMakeup(db, userId, { from })
    expect(withMakeup.map((s) => s.id)).not.toContain(orig.id)

    await caller.session.delete({ id: makeup.id })
    const list = await getCancelledWithoutMakeup(db, userId, { from })
    expect(list.map((s) => s.id)).toEqual([orig.id])
    expect(list[0].status).toBe("cancelled")
    expect(list[0].students.map((x) => x.fullName)).toEqual(["HS Ca Nghỉ"])
    expect(list[0].makeupInfo).toBeNull()

    await caller.session.restore({ id: orig.id })
    expect(await getCancelledWithoutMakeup(db, userId, { from })).toEqual([])
  })

  it("lọc theo from (gồm mốc), gồm ca tương lai, bỏ ca chưa huỷ, sắp theo ngày rồi giờ", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const tooOld = await addSession(caller, { date: "2026-07-26" })
    const onEdge = await addSession(caller, { date: "2026-07-27" })
    const futureLate = await addSession(caller, { date: "2026-10-10", start: "10:00", end: "11:00" })
    const futureEarly = await addSession(caller, { date: "2026-10-10", start: "08:00", end: "09:00" })
    await addSession(caller, { date: "2026-09-20" }) // chưa huỷ
    for (const s of [tooOld, onEdge, futureLate, futureEarly]) await cancelDirect(s.id)

    const list = await getCancelledWithoutMakeup(db, userId, { from })
    expect(list.map((s) => s.id)).toEqual([onEdge.id, futureEarly.id, futureLate.id])
  })

  it("không lấy ca của giáo viên khác", async () => {
    const caller2 = await getAuthedCaller("teacher2")
    const other = await addSession(caller2, { date: "2026-09-20" })
    await cancelDirect(other.id)

    expect(await getCancelledWithoutMakeup(db, await userIdOf("teacher"), { from })).toEqual([])
    const own = await getCancelledWithoutMakeup(db, await userIdOf("teacher2"), { from })
    expect(own.map((s) => s.id)).toEqual([other.id])
  })
})
