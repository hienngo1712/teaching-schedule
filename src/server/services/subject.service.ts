import { TRPCError } from "@trpc/server"
import { Prisma, type PrismaClient, type Subject } from "@prisma/client"
import { assertOwnership } from "./_base.service"
import { WITH_DELETED, softDeleteData } from "@/server/soft-delete"
import { TX_OPTIONS } from "./payment.service"
import type {
  SubjectCreateInput,
  SubjectFilterInput,
  SubjectUpdateData,
} from "@/lib/schemas/subject"

export async function listSubjects(
  db: PrismaClient,
  userId: number,
  filter: SubjectFilterInput
): Promise<Subject[]> {
  return db.subject.findMany({
    where: {
      userId,
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}

const DUPLICATE_NAME = "Tên môn học đã tồn tại"
export const SUBJECT_IN_TRASH = "Môn này đang ở Thùng rác. Hãy khôi phục trong Thùng rác."

function badRequest(message: string) {
  return new TRPCError({ code: "BAD_REQUEST", message })
}

// Tên môn đã xoá vẫn giữ unique (spec Q Q2) → P2002 có thể do môn trong thùng rác.
async function duplicateNameError(db: PrismaClient, userId: number, name: string) {
  const clash = await db.subject.findUnique({ where: { userId_name: { userId, name }, ...WITH_DELETED } })
  if (clash?.isDeleted) return badRequest(SUBJECT_IN_TRASH)
  if (clash && !clash.isActive) return badRequest("Môn này đang bị ẩn. Hãy bấm Hiện lại trong danh sách môn đã ẩn.")
  return badRequest(DUPLICATE_NAME)
}

export async function createSubject(
  db: PrismaClient,
  userId: number,
  input: SubjectCreateInput
): Promise<Subject> {
  try {
    return await db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.subject.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }
      const sortOrder =
        input.sortOrder ??
        ((await tx.subject.aggregate({ where: { userId }, _max: { sortOrder: true } }))._max
          .sortOrder ?? -1) + 1
      return tx.subject.create({
        data: {
          userId,
          name: input.name,
          color: input.color,
          isDefault: input.isDefault,
          sortOrder,
        },
      })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw await duplicateNameError(db, userId, input.name)
    }
    throw e
  }
}

export async function updateSubject(
  db: PrismaClient,
  userId: number,
  id: number,
  data: SubjectUpdateData
): Promise<Subject> {
  const existing = await db.subject.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  // Ẩn qua update được phép cả khi môn đã có ca (khác delete): ca cũ vẫn trỏ tới môn.
  if (data.isActive === false && existing.isActive) {
    if (existing.isDefault) {
      throw badRequest("Không thể ẩn môn mặc định. Hãy chọn môn mặc định khác trước.")
    }
    const remaining = await db.subject.count({
      where: { userId, isActive: true, NOT: { id } },
    })
    if (remaining === 0) throw badRequest("Không thể ẩn môn cuối cùng")
  }
  // Luôn phải có một môn mặc định: chỉ đổi được bằng cách đặt môn khác làm mặc định.
  if (data.isDefault === false && existing.isDefault) {
    throw badRequest("Không thể bỏ môn mặc định. Hãy chọn môn mặc định khác trước.")
  }
  const willBeActive = data.isActive ?? existing.isActive
  if (data.isDefault === true && !willBeActive) {
    throw badRequest("Không thể đặt môn đã ẩn làm mặc định")
  }

  try {
    return await db.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.subject.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        })
      }
      return tx.subject.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      })
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw await duplicateNameError(db, userId, data.name ?? existing.name)
    }
    throw e
  }
}

export async function softDeleteSubject(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<{ success: true }> {
  return db.$transaction(async (tx) => {
    // FOR UPDATE trên dòng môn: chờ / chặn các transaction ghi ca đang giữ FOR KEY SHARE (lockLiveSubject).
    await tx.$queryRaw`SELECT id FROM subjects WHERE id = ${id} FOR UPDATE`
    const existing = await tx.subject.findUnique({ where: { id } })
    assertOwnership(existing, userId)
    if (existing.isDefault) {
      throw badRequest("Không thể xoá môn mặc định. Hãy chọn môn mặc định khác trước.")
    }
    // Ca đã xoá không tính: khôi phục ca đó sau này sẽ bị chặn cho tới khi khôi phục môn.
    const inUse = await tx.teachingSession.count({ where: { subjectId: id, userId } })
    if (inUse > 0) throw badRequest("Không thể xoá môn đang có ca dạy. Hãy xoá các ca đó hoặc chỉ ẩn môn.")
    if (existing.isActive) {
      const remaining = await tx.subject.count({ where: { userId, isActive: true, NOT: { id } } })
      if (remaining === 0) throw badRequest("Không thể xoá môn cuối cùng")
    }
    await tx.subject.update({ where: { id }, data: softDeleteData() })
    return { success: true }
  }, TX_OPTIONS)
}
