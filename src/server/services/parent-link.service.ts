import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { assertOwnership } from "./_base.service"

// 32 byte base64url = 43 ký tự. Kiểm dạng trước khi truy vấn để token rác không chạm DB.
export const PARENT_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/

async function assertStudentOwned(db: PrismaClient, userId: number, studentId: number) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  })
  assertOwnership(student, userId)
}

export async function generateParentLink(
  db: PrismaClient,
  userId: number,
  studentId: number
): Promise<{ token: string }> {
  await assertStudentOwned(db, userId, studentId)
  // Ghi đè token = link cũ chết ngay. Trùng unique gần như không thể nên chỉ thử lại 1 lần.
  for (let attempt = 0; ; attempt++) {
    const token = randomBytes(32).toString("base64url")
    try {
      await db.student.update({ where: { id: studentId }, data: { parentLinkToken: token } })
      return { token }
    } catch (e) {
      const isDuplicate =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
      if (!isDuplicate || attempt > 0) throw e
    }
  }
}

export async function disableParentLink(
  db: PrismaClient,
  userId: number,
  studentId: number
): Promise<{ success: true }> {
  await assertStudentOwned(db, userId, studentId)
  await db.student.update({ where: { id: studentId }, data: { parentLinkToken: null } })
  return { success: true }
}
