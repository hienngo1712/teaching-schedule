import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { studentLimit } from "@/lib/plans"
import { getAuthedCaller } from "../helpers/trpc"
import type { PrismaClient } from "@prisma/client"
import { createStudent } from "@/server/services/student.service"
import { restoreTrashItem } from "@/server/services/trash.service"
import { softDeleteSubject } from "@/server/services/subject.service"
import { createSession } from "@/server/services/session.service"

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

  it("U14: xoá môn trong khi 1 ca dùng môn đó được tạo đồng thời -> không có ca nào trỏ tới môn đã xoá", async () => {
    const caller = await getAuthedCaller()
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const sub = await caller.subject.create({ name: "Môn Đua", color: "#10B981" })

    let releaseBarrier = () => {}
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve
    })

    const slowDb = db.$extends({
      query: {
        teachingSession: {
          async count({ args, query }) {
            await barrier
            return query(args)
          },
        },
      },
    }) as unknown as PrismaClient

    const pDelete = softDeleteSubject(slowDb, user.id, sub.id)
    const pCreateSession = createSession(db, user.id, {
      subjectId: sub.id,
      sessionDate: D,
      startTime: "09:00",
      endTime: "10:00",
    })

    await new Promise((r) => setTimeout(r, 50))
    releaseBarrier()

    const results = await Promise.allSettled([pDelete, pCreateSession])
    const deletedSubject = await db.subject.findUnique({ where: { id: sub.id } })
    const sessions = await db.teachingSession.findMany({ where: { subjectId: sub.id } })

    if (deletedSubject?.isDeleted) {
      // Nếu môn đã xoá thì không được có ca nào trỏ tới môn này
      expect(sessions.length).toBe(0)
    } else {
      // Nếu môn không bị xoá thì việc xoá môn phải bị từ chối
      const delResult = results[0]
      expect(delResult.status).toBe("rejected")
    }
  })
})
