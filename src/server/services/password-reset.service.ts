import { randomInt } from "node:crypto"
import bcrypt from "bcryptjs"
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { isAdminUsername } from "@/lib/admin"
import { BCRYPT_COST } from "@/server/auth-credentials"

// Bỏ 0/O/o và 1/l/I để đọc qua điện thoại không nhầm (spec N R1).
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomChunk(n: number): string {
  let s = ""
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

// 8 ký tự ngẫu nhiên từ crypto, dài 14 nên vẫn qua luật ≥10 ký tự.
export function generateTempPassword(): string {
  return `Lich-${randomChunk(4)}-${randomChunk(4)}`
}

// Mật khẩu tạm chỉ trả về đúng 1 lần cho admin; DB giữ hash, log không chứa mật khẩu (spec N R1, R3).
export async function adminResetPassword(
  db: PrismaClient,
  adminUsername: string,
  userId: number
): Promise<{ username: string; tempPassword: string }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
  if (isAdminUsername(user.username)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Không reset mật khẩu tài khoản quản trị" })
  }
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST)
  // Tăng sessionVersion để mọi máy đang đăng nhập tài khoản này bị đá ngay (spec N R2).
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
    }),
    db.passwordResetLog.create({ data: { userId: user.id, resetBy: adminUsername } }),
  ])
  return { username: user.username, tempPassword }
}
