import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import type { RegisterInput } from "@/lib/schemas/auth"

export const DEFAULT_SUBJECTS = [
  { name: "Tiếng Anh", color: "#4F46E5", isDefault: true, sortOrder: 1, isActive: true },
  { name: "Toán", color: "#0891B2", isDefault: false, sortOrder: 2, isActive: true },
  { name: "Tiếng Việt", color: "#059669", isDefault: false, sortOrder: 3, isActive: true },
  { name: "Vật Lý", color: "#D97706", isDefault: false, sortOrder: 4, isActive: false },
  { name: "Hóa Học", color: "#DC2626", isDefault: false, sortOrder: 5, isActive: false },
] as const

export async function seedSubjectsForUser(db: PrismaClient, userId: number) {
  for (const s of DEFAULT_SUBJECTS) {
    await db.subject.upsert({
      where: { userId_name: { userId, name: s.name } },
      update: {},
      create: { ...s, userId },
    })
  }
}

export async function registerUser(db: PrismaClient, input: RegisterInput) {
  const { username, password, fullName } = input

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tên đăng nhập đã tồn tại",
    })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: {
      username,
      passwordHash,
      fullName: fullName || null,
    },
  })

  await seedSubjectsForUser(db, user.id)

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
  }
}
