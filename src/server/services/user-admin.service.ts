import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { isAdminUsername } from "@/lib/admin"

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })

// Xoá mềm: giữ username + dữ liệu để khôi phục; tăng sessionVersion để đá mọi phiên ngay (spec Q Q7).
export async function adminDeleteUser(db: PrismaClient, admin: string, userId: number): Promise<{ success: true }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true, isDeleted: true } })
  if (!user || user.isDeleted) throw notFound()
  if (isAdminUsername(user.username)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Không xoá được tài khoản quản trị" })
  }
  // updateMany + điều kiện isDeleted: bấm 2 lần / 2 tab thì lần sau count = 0.
  const { count } = await db.user.updateMany({
    where: { id: userId, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date(), deletedBy: admin, sessionVersion: { increment: 1 } },
  })
  if (count === 0) throw notFound()
  console.info(`[admin] ${admin} xoá tài khoản ${user.username} (user ${userId})`)
  return { success: true }
}

export async function adminRestoreUser(db: PrismaClient, admin: string, userId: number): Promise<{ success: true }> {
  const { count } = await db.user.updateMany({
    where: { id: userId, isDeleted: true },
    data: { isDeleted: false, deletedAt: null, deletedBy: null },
  })
  if (count === 0) throw notFound()
  console.info(`[admin] ${admin} khôi phục tài khoản user ${userId}`)
  return { success: true }
}

export async function listDeletedUsers(db: PrismaClient) {
  return db.user.findMany({
    where: { isDeleted: true },
    orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
    select: { id: true, username: true, fullName: true, deletedAt: true, deletedBy: true },
  })
}
