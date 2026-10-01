import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { studentLimit } from "@/lib/plans"
import { getAuthedCaller } from "../helpers/trpc"
import type { PrismaClient } from "@prisma/client"
import { createStudent } from "@/server/services/student.service"
import { restoreTrashItem } from "@/server/services/trash.service"
import { softDeleteSubject } from "@/server/services/subject.service"
import { createSession, updateSession } from "@/server/services/session.service"
import { WITH_DELETED } from "@/server/soft-delete"

const D = "2031-05-15"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany({ where: { name: { not: "Tiếng Anh" } } })
}

describe("student limit race & subject delete race (U13, U14)", () => {
  beforeEach(clean)

  it("U13: 2 createStudent đồng thời khi chỉ còn 1 chỗ -> đúng 1 thành công, 1 lỗi giới hạn", async () => {
    await getAuthedCaller("teacher_std")
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    const limit = studentLimit("standard")!

    // Tạo (limit - 1) học sinh để chỉ còn đúng 1 chỗ trống
    await db.student.createMany({
      data: Array.from({ length: limit - 1 }, (_, i) => ({
        userId: user.id,
        fullName: `HS Std ${i}`,
        grade: 1,
        isActive: true,
      })),
    })

    let releaseBarrier = () => {}
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve
    })

    const slowDb = db.$extends({
      query: {
        student: {
          async count({ args, query }) {
            await barrier
            return query(args)
          },
        },
      },
    }) as unknown as PrismaClient

    const p1 = createStudent(slowDb, user.id, {
      fullName: "HS Đua 1",
      grade: 3,
      isActive: true,
      tuitionFee: 0,
      billingMode: "per_session",
      monthlyFee: 0,
    })
    const p2 = createStudent(slowDb, user.id, {
      fullName: "HS Đua 2",
      grade: 4,
      isActive: true,
      tuitionFee: 0,
      billingMode: "per_session",
      monthlyFee: 0,
    })

    await new Promise((r) => setTimeout(r, 50))
    releaseBarrier()

    const results = await Promise.allSettled([p1, p2])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")

    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/tối đa/)

    const activeCount = await db.student.count({
      where: { userId: user.id, isActive: true, isDeleted: false },
    })
    expect(activeCount).toBe(limit)
  })

  it("U13: 1 createStudent + 1 undeleteStudent đồng thời khi chỉ còn 1 chỗ -> đúng 1 thành công", async () => {
    await getAuthedCaller("teacher_std")
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })
    const limit = studentLimit("standard")!

    // Tạo 1 HS trong thùng rác (isActive: true nhưng isDeleted: true)
    const trashStudent = await db.student.create({
      data: {
        userId: user.id,
        fullName: "HS Thùng Rác Đang Học",
        grade: 2,
        isActive: true,
        isDeleted: true,
        deletedAt: new Date(),
      },
    })

    // Tạo (limit - 1) HS đang học bình thường
    await db.student.createMany({
      data: Array.from({ length: limit - 1 }, (_, i) => ({
        userId: user.id,
        fullName: `HS Std Normal ${i}`,
        grade: 1,
        isActive: true,
      })),
    })

    let releaseBarrier = () => {}
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve
    })

    const slowDb = db.$extends({
      query: {
        student: {
          async count({ args, query }) {
            await barrier
            return query(args)
          },
        },
      },
    }) as unknown as PrismaClient

    const p1 = createStudent(slowDb, user.id, {
      fullName: "HS Thêm Mới",
      grade: 5,
      isActive: true,
      tuitionFee: 0,
      billingMode: "per_session",
      monthlyFee: 0,
    })
    const p2 = restoreTrashItem(slowDb, user.id, {
      type: "student",
      id: trashStudent.id,
    })

    await new Promise((r) => setTimeout(r, 50))
    releaseBarrier()

    const results = await Promise.allSettled([p1, p2])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")

    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/tối đa/)

    const activeCount = await db.student.count({
      where: { userId: user.id, isActive: true, isDeleted: false },
    })
    expect(activeCount).toBe(limit)
  })

  // Thứ tự gây lỗi: tạo ca kiểm môn xong → xoá môn chạy hết, commit → tạo ca mới ghi (spec U U14, review).
  async function raceCreateAfterDelete(run: (slow: PrismaClient, userId: number, subjectId: number) => Promise<unknown>) {
    const caller = await getAuthedCaller()
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const sub = await caller.subject.create({ name: `Môn Đua ${Math.random()}`, color: "#10B981" })
    let release = () => {}
    const barrier = new Promise<void>((r) => (release = r))
    const slowDb = db.$extends({
      query: {
        subject: {
          async findUnique({ args, query }) {
            const r = await query(args)
            await barrier
            return r
          },
        },
      },
    }) as unknown as PrismaClient
    const pCreate = run(slowDb, user.id, sub.id)
    await new Promise((r) => setTimeout(r, 50))
    await softDeleteSubject(db, user.id, sub.id)
    release()
    const res = await Promise.allSettled([pCreate])
    const subject = await db.subject.findFirstOrThrow({ where: { id: sub.id, ...WITH_DELETED } })
    const live = await db.teachingSession.count({ where: { subjectId: sub.id } })
    return { res: res[0], subject, live }
  }

  it("U14: tạo ca xen giữa lúc xoá môn → bị từ chối, không có ca trỏ tới môn đã xoá", async () => {
    const { res, subject, live } = await raceCreateAfterDelete((slow, userId, subjectId) =>
      createSession(slow, userId, { subjectId, sessionDate: D, startTime: "09:00", endTime: "10:00" })
    )
    expect(subject.isDeleted).toBe(true)
    expect(res.status).toBe("rejected")
    expect(live).toBe(0)
  })

  it("U14: đổi môn của ca xen giữa lúc xoá môn → bị từ chối", async () => {
    const caller = await getAuthedCaller()
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const defId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const sess = await createSession(db, user.id, { subjectId: defId, sessionDate: D, startTime: "11:00", endTime: "12:00" })
    const { res, live } = await raceCreateAfterDelete((slow, userId, subjectId) =>
      updateSession(slow, userId, sess.id, { subjectId })
    )
    expect(res.status).toBe("rejected")
    expect(live).toBe(0)
  })
})
