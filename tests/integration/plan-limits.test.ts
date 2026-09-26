import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { TRPCError } from "@trpc/server"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { PlanRequiredError } from "@/server/services/plan.service"
import { importStudents } from "@/server/services/student.service"
import { getParentView } from "@/server/services/parent-link.service"

const FAR = new Date("2099-12-31T17:00:00.000Z")
let userId = 0

async function setPlan(plan: "standard" | "plus" | "pro") {
  await db.user.update({ where: { id: userId }, data: { plan, planExpiresAt: plan === "standard" ? null : FAR, trialEndsAt: null } })
}

async function addStudents(n: number, isActive = true) {
  await db.student.createMany({
    data: Array.from({ length: n }, (_, i) => ({ userId, fullName: `HS Giới Hạn ${i + 1}`, grade: 3, isActive })),
  })
}

async function cleanup() {
  await db.monthlyTuition.deleteMany({ where: { student: { userId } } })
  await db.sessionStudent.deleteMany({ where: { session: { userId } } })
  await db.teachingSession.deleteMany({ where: { userId } })
  await db.student.deleteMany({ where: { userId } })
}

async function errorOf(p: Promise<unknown>): Promise<TRPCError> {
  const e = await p.then(() => null, (x: unknown) => x)
  expect(e).toBeInstanceOf(TRPCError)
  return e as TRPCError
}

beforeEach(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
  await cleanup()
  await setPlan("standard")
})

afterAll(async () => {
  await cleanup()
  await setPlan("standard")
})

describe("Giới hạn HS đang học (spec I D8)", () => {
  it("Standard: 9 HS → tạo thêm được; đủ 10 → tạo bị chặn, planRequired=plus, message có số", async () => {
    await addStudents(9)
    const c = await getAuthedCaller("teacher_std")
    await c.student.create({ fullName: "HS Thứ Mười", grade: 3 })
    const e = await errorOf(c.student.create({ fullName: "HS Thứ Mười Một", grade: 3 }))
    expect(e.code).toBe("FORBIDDEN")
    expect((e.cause as PlanRequiredError).plan).toBe("plus")
    expect(e.message).toBe("Gói Standard tối đa 10 học sinh đang học (hiện có 10)")
    expect(await db.student.count({ where: { userId, isActive: true } })).toBe(10)
  })

  it("đủ 10: tạo HS 'Đã nghỉ' vẫn được", async () => {
    await addStudents(10)
    const c = await getAuthedCaller("teacher_std")
    const s = await c.student.create({ fullName: "HS Nghỉ Sẵn", grade: 3, isActive: false })
    expect(s.isActive).toBe(false)
  })

  it("đủ 10: bật lại HS nghỉ bị chặn; sửa HS đang học (kể cả gửi isActive:true) vẫn được", async () => {
    await addStudents(10)
    const c = await getAuthedCaller("teacher_std")
    const dropped = await c.student.create({ fullName: "HS Đã Nghỉ", grade: 3, isActive: false })
    const e = await errorOf(c.student.update({ id: dropped.id, data: { isActive: true } }))
    expect(e.code).toBe("FORBIDDEN")
    expect((e.cause as PlanRequiredError).plan).toBe("plus")
    expect((await db.student.findUniqueOrThrow({ where: { id: dropped.id } })).isActive).toBe(false)

    const active = await db.student.findFirstOrThrow({ where: { userId, isActive: true } })
    const renamed = await c.student.update({ id: active.id, data: { fullName: "Đổi Tên Được", isActive: true } })
    expect(renamed.fullName).toBe("Đổi Tên Được")
  })

  it("Plus: đủ 40 → chặn, planRequired=pro", async () => {
    await setPlan("plus")
    await addStudents(40)
    const c = await getAuthedCaller("teacher_std")
    const e = await errorOf(c.student.create({ fullName: "HS Bốn Mốt", grade: 3 }))
    expect((e.cause as PlanRequiredError).plan).toBe("pro")
    expect(e.message).toBe("Gói Plus tối đa 40 học sinh đang học (hiện có 40)")
  })

  it("Pro: không giới hạn", async () => {
    await setPlan("pro")
    await addStudents(45)
    const c = await getAuthedCaller("teacher_std")
    await expect(c.student.create({ fullName: "HS Bốn Sáu", grade: 3 })).resolves.toMatchObject({ isActive: true })
  })

  it("hạ gói còn 12 HS đang học: list đủ 12, điểm danh vẫn lưu, không HS nào bị tắt", async () => {
    await addStudents(12)
    const c = await getAuthedCaller("teacher_std")
    const list = await c.student.list({ limit: 50 })
    expect(list.items).toHaveLength(12)
    const subject = (await c.subject.list({}))[0]
    const st = list.items[0]
    const session = await c.session.create({
      sessionDate: "2026-05-04",
      startTime: "08:00",
      endTime: "09:00",
      subjectId: subject.id,
      studentIds: [st.id],
    })
    await c.attendance.update({ sessionId: session.id, attendances: [{ studentId: st.id, attendance: "present" }] })
    const link = await db.sessionStudent.findFirstOrThrow({ where: { sessionId: session.id, studentId: st.id } })
    expect(link.attendance).toBe("present")
    expect(await db.student.count({ where: { userId, isActive: true } })).toBe(12)
  })

  it("importStudents (service) ở Standard: 9 + 2 dòng → chặn cả lô; Pro qua", async () => {
    await addStudents(9)
    const rows = [
      { fullName: "Nhập Một", grade: 2, tuitionFee: 0, allowDuplicate: false },
      { fullName: "Nhập Hai", grade: 2, tuitionFee: 0, allowDuplicate: false },
    ]
    const e = await errorOf(importStudents(db, userId, rows))
    expect((e.cause as PlanRequiredError).plan).toBe("plus")
    expect(await db.student.count({ where: { userId } })).toBe(9)
    await setPlan("pro")
    await expect(importStudents(db, userId, rows)).resolves.toEqual({ created: 2 })
  })
})

describe("Link phụ huynh khi chủ TK hết Pro (spec I D9)", () => {
  it("Standard → getParentView null, token giữ nguyên; trial hoặc Pro → cùng token sống lại", async () => {
    await setPlan("pro")
    const c = await getAuthedCaller("teacher_std")
    const s = await c.student.create({ fullName: "HS Có Link", grade: 5 })
    const { token } = await c.student.generateParentLink({ id: s.id })
    expect(await getParentView(db, token)).not.toBeNull()

    await setPlan("standard")
    expect(await getParentView(db, token)).toBeNull()
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBe(token)

    await db.user.update({ where: { id: userId }, data: { trialEndsAt: new Date(Date.now() + 86_400_000) } })
    expect(await getParentView(db, token)).not.toBeNull()

    await setPlan("pro")
    expect((await getParentView(db, token))?.student.fullName).toBe("HS Có Link")
  })
})
