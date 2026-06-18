import { Prisma, PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import type { RegisterInput } from "@/lib/schemas/auth"
import { BCRYPT_COST } from "@/server/auth-credentials"
import { seedSubjectsForUser } from "./subject-defaults"

// Re-export để giữ tương thích cho code đang import từ module này.
export { DEFAULT_SUBJECTS, seedSubjectsForUser } from "./subject-defaults"

export async function registerUser(db: PrismaClient, input: RegisterInput) {
  const { username, password, fullName } = input

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tên đăng nhập đã tồn tại",
    })
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  let user
  try {
    user = await db.user.create({
      data: {
        username,
        passwordHash,
        fullName: fullName || null,
      },
    })
  } catch (err) {
    // Race: hai request cùng username vượt qua findUnique ở trên → unique
    // constraint (P2002). Trả lỗi thân thiện thay vì rò Prisma error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tên đăng nhập đã tồn tại" })
    }
    throw err
  }

  await seedSubjectsForUser(db, user.id)

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
  }
}
