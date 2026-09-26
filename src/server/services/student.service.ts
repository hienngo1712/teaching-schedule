import { Prisma, type PrismaClient, type ClassUpgradeLog } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { getLevel } from "@/lib/utils"
import { assertOwnership } from "./_base.service"
import { assertCanActivateStudents } from "./plan.service"
import type {
  StudentCreateInput,
  StudentFilterInput,
  StudentImportCheckInput,
  StudentImportInput,
} from "@/lib/schemas/student"
import type { PaginatedResponse } from "@/lib/schemas/common"
import type { SchoolLevel, StudentDTO } from "@/lib/types/models"
import { nameKey, type ExistingMatch } from "@/lib/student-import"

function withLevel<T extends { grade: number }>(s: T): T & { level: SchoolLevel } {
  return { ...s, level: getLevel(s.grade) }
}

export async function listStudents(
  db: PrismaClient,
  userId: number,
  filter: StudentFilterInput
): Promise<PaginatedResponse<StudentDTO>> {
  const { page, limit, grade, search, isActive, includeInactive } = filter
  const skip = (page - 1) * limit
  const take = limit

  const where = {
    userId,
    ...(isActive !== undefined
      ? { isActive }
      : includeInactive
      ? {}
      : { isActive: true }),
    ...(grade ? { grade } : {}),
    ...(search
      ? { fullName: { contains: search, mode: "insensitive" as const } }
      : {}),
  }

  const [students, totalCount] = await Promise.all([
    db.student.findMany({
      where,
      orderBy: [{ grade: "asc" }, { fullName: "asc" }],
      skip,
      take,
    }),
    db.student.count({ where }),
  ])

  return {
    items: students.map(withLevel),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  }
}

export async function createStudent(
  db: PrismaClient,
  userId: number,
  input: StudentCreateInput
): Promise<StudentDTO> {
  if (input.isActive) await assertCanActivateStudents(db, userId, 1)
  const student = await db.student.create({
    data: {
      userId,
      fullName: input.fullName,
      grade: input.grade,
      parentPhone: input.parentPhone ?? null,
      parentName: input.parentName ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive,
      tuitionFee: input.tuitionFee,
    },
  })
  return withLevel(student)
}

// Gồm cả HS đã nghỉ (spec E D3). Cùng khóa nhiều em → ưu tiên em đang học.
async function findExistingByKey(
  db: Prisma.TransactionClient,
  userId: number,
  rows: { fullName: string; grade: number }[]
): Promise<Map<string, ExistingMatch>> {
  const map = new Map<string, ExistingMatch>()
  if (rows.length === 0) return map
  const existing = await db.student.findMany({
    where: { userId, grade: { in: [...new Set(rows.map((r) => r.grade))] } },
    select: { id: true, fullName: true, grade: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { id: "asc" }],
  })
  for (const s of existing) {
    const key = nameKey(s.fullName, s.grade)
    if (!map.has(key)) map.set(key, s)
  }
  return map
}

export async function checkImportDuplicates(
  db: PrismaClient,
  userId: number,
  rows: StudentImportCheckInput["rows"]
): Promise<{ matches: (ExistingMatch | null)[] }> {
  const existing = await findExistingByKey(db, userId, rows)
  return { matches: rows.map((r) => existing.get(nameKey(r.fullName, r.grade)) ?? null) }
}

export async function importStudents(
  db: PrismaClient,
  userId: number,
  rows: StudentImportInput["rows"]
): Promise<{ created: number }> {
  return db.$transaction(async (tx) => {
    // Khóa theo userId trong transaction: 2 request cùng lúc phải kiểm tra trùng tuần tự,
    // không thì cả 2 đều SELECT thấy "chưa có" ở READ COMMITTED rồi cùng insert ra bản sao.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(userId)})`
    await assertCanActivateStudents(tx, userId, rows.length)
    // Kiểm tra trùng lại lúc ghi: bấm 2 lần / thử lại sau lỗi mạng không sinh bản sao.
    const existing = await findExistingByKey(tx, userId, rows)
    const seen = new Set<string>()
    for (const r of rows) {
      const key = nameKey(r.fullName, r.grade)
      if ((existing.has(key) || seen.has(key)) && !r.allowDuplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Danh sách đã thay đổi, hãy chọn lại file để kiểm tra.",
        })
      }
      seen.add(key)
    }
    const { count } = await tx.student.createMany({
      data: rows.map((r) => ({
        userId,
        fullName: r.fullName,
        grade: r.grade,
        parentPhone: r.parentPhone ?? null,
        parentName: r.parentName ?? null,
        notes: r.notes ?? null,
        tuitionFee: r.tuitionFee,
        isActive: true,
      })),
    })
    return { created: count }
  })
}

export async function updateStudent(
  db: PrismaClient,
  userId: number,
  id: number,
  data: Partial<StudentCreateInput>
): Promise<StudentDTO> {
  const existing = await db.student.findUnique({ where: { id } })
  assertOwnership(existing, userId)
  if (data.isActive === true && !existing.isActive) await assertCanActivateStudents(db, userId, 1)

  const student = await db.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.grade !== undefined && { grade: data.grade }),
        ...(data.parentPhone !== undefined && {
          parentPhone: data.parentPhone ?? null,
        }),
        ...(data.parentName !== undefined && {
          parentName: data.parentName ?? null,
        }),
        ...(data.notes !== undefined && { notes: data.notes ?? null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.tuitionFee !== undefined && { tuitionFee: data.tuitionFee }),
      },
    })

    // Đổi grade → đồng bộ snapshot grade các buổi CHƯA kết thúc. Buổi đã dạy xong
    // (kể cả sáng nay) giữ nguyên grade lịch sử — dùng đúng filter endTime-aware
    // như softDeleteStudent để không ghi đè buổi đã qua trong ngày hôm nay.
    if (data.grade !== undefined && data.grade !== existing.grade) {
      const now = new Date()
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      )
      const links = await tx.sessionStudent.findMany({
        where: {
          studentId: id,
          session: { userId, sessionDate: { gte: todayUTC } },
        },
        select: {
          id: true,
          session: { select: { sessionDate: true, endTime: true } },
        },
      })
      const nowMs = now.getTime()
      const toSync = links
        .filter(({ session }) => {
          const sd = session.sessionDate
          const et = session.endTime
          const endMs = Date.UTC(
            sd.getUTCFullYear(),
            sd.getUTCMonth(),
            sd.getUTCDate(),
            et.getUTCHours(),
            et.getUTCMinutes(),
            et.getUTCSeconds()
          )
          return endMs > nowMs
        })
        .map((l) => l.id)
      if (toSync.length > 0) {
        await tx.sessionStudent.updateMany({
          where: { id: { in: toSync } },
          data: { grade: data.grade },
        })
      }
    }

    return updated
  })

  return withLevel(student)
}

export async function softDeleteStudent(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<{ success: true }> {
  const existing = await db.student.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  // Mốc "hôm nay" theo UTC, khớp cách sessionDate được lưu (Date.UTC trong parseSessionDate).
  const now = new Date()
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  await db.$transaction(async (tx) => {
    // Ứng viên: các buổi từ hôm nay trở đi mà HS đang tham gia. (Buổi quá khứ
    // không đụng tới để bảo toàn lịch sử điểm danh & doanh thu.)
    const links = await tx.sessionStudent.findMany({
      where: {
        studentId: id,
        session: { userId, sessionDate: { gte: todayUTC } },
      },
      select: {
        id: true,
        session: { select: { sessionDate: true, endTime: true } },
      },
    })

    // Chỉ gỡ buổi CHƯA kết thúc (thời điểm kết thúc còn ở tương lai). Buổi hôm nay
    // đã dạy xong vẫn được giữ — sessionDate là @db.Date nên phải kết hợp với
    // endTime để xác định buổi đã qua, tránh xóa nhầm snapshot buổi đã dạy.
    const nowMs = now.getTime()
    const toRemove = links
      .filter(({ session }) => {
        const sd = session.sessionDate
        const et = session.endTime
        const endMs = Date.UTC(
          sd.getUTCFullYear(),
          sd.getUTCMonth(),
          sd.getUTCDate(),
          et.getUTCHours(),
          et.getUTCMinutes(),
          et.getUTCSeconds()
        )
        return endMs > nowMs
      })
      .map((l) => l.id)

    if (toRemove.length > 0) {
      await tx.sessionStudent.deleteMany({ where: { id: { in: toRemove } } })
    }

    await tx.student.update({ where: { id }, data: { isActive: false } })
  })
  return { success: true }
}

export async function upgradeAllClasses(
  db: PrismaClient,
  userId: number,
  trigger: "auto" | "manual"
): Promise<{ upgradedCount: number; deactivatedCount: number; year: number }> {
  const year = new Date().getUTCFullYear()
  const conflictError = new TRPCError({
    code: "CONFLICT",
    message: `Bạn đã nâng lớp toàn bộ học sinh trong năm ${year} rồi.`,
  })

  try {
    return await db.$transaction(async (tx) => {
      // Idempotency check INSIDE the transaction to avoid TOCTOU race where
      // two concurrent callers both pass the check and one hits the unique
      // constraint with an opaque P2002 error.
      const existing = await tx.classUpgradeLog.findUnique({
        where: { userId_year: { userId, year } },
      })
      if (existing) throw conflictError

      // Lấy HS ra trường (grade >= 12, gồm cả dữ liệu lỗi grade > 12) TRƯỚC khi tăng lớp
      // để không bắt nhầm HS lớp 11 vừa lên 12.
      const graduatingStudents = await tx.student.findMany({
        where: { userId, isActive: true, grade: { gte: 12 } },
        select: { id: true },
      })
      const graduatingIds = graduatingStudents.map((s) => s.id)

      const upgraded = await tx.student.updateMany({
        where: { userId, isActive: true, grade: { gte: 1, lte: 11 } },
        data: { grade: { increment: 1 } },
      })
      const deactivated = graduatingIds.length > 0
        ? await tx.student.updateMany({
            where: { id: { in: graduatingIds } },
            data: { isActive: false },
          })
        : { count: 0 }
      await tx.classUpgradeLog.create({
        data: {
          userId,
          year,
          trigger,
          upgradedCount: upgraded.count,
          deactivatedCount: deactivated.count,
        },
      })
      return {
        upgradedCount: upgraded.count,
        deactivatedCount: deactivated.count,
        year,
      }
    })
  } catch (err) {
    // Defense-in-depth: if two callers race past the in-tx check (extremely
    // rare given short transaction window), the unique constraint catches it.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw conflictError
    }
    throw err
  }
}

export async function getUpgradeLogThisYear(
  db: PrismaClient,
  userId: number
): Promise<ClassUpgradeLog | null> {
  return db.classUpgradeLog.findUnique({
    // getUTCFullYear để khớp năm mà upgradeAllClasses ghi log (tránh lệch local/UTC ở ranh giới năm)
    where: { userId_year: { userId, year: new Date().getUTCFullYear() } },
  })
}
