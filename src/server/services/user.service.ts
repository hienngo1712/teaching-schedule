import { Prisma, PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import type { RegisterInput } from "@/lib/schemas/auth"
import { BCRYPT_COST, isRateLimited } from "@/server/auth-credentials"
import { seedSubjectsForUser } from "./subject-defaults"
import { trialEndFor } from "@/lib/plans"
import { getDefaultTrialDays } from "./trial.service"
import { CONSENT_TEXT_VERSION } from "@/lib/consent"
import { RELEASES } from "@/lib/releases"

// Re-export để giữ tương thích cho code đang import từ module này.
export { DEFAULT_SUBJECTS, seedSubjectsForUser } from "./subject-defaults"

export async function registerUser(
  db: PrismaClient,
  input: RegisterInput,
  consent?: { ipAddress: string | null }
) {
  const { username, password, fullName } = input

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tên đăng nhập đã tồn tại",
    })
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const trialDays = await getDefaultTrialDays(db)
  let user
  try {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          passwordHash,
          fullName: fullName || null,
          // D4: gán ở đây (không dùng default DB) để tài khoản cũ không bị gán nhầm dùng thử.
          // Số ngày đọc lúc đăng ký: đổi mặc định chỉ ảnh hưởng tài khoản tạo sau (spec L mục 15 T2).
          trialEndsAt: trialEndFor(new Date(), trialDays),
          // Tài khoản mới chưa dùng bản cũ → không tự mở "Có gì mới" (spec W §5.4).
          lastSeenRelease: RELEASES[0].version,
        },
      })

      if (consent) {
        await tx.consentRecord.create({
          data: {
            userId: created.id,
            scope: "register",
            textVersion: CONSENT_TEXT_VERSION,
            ipAddress: consent.ipAddress?.slice(0, 45) ?? null,
          },
        })
      }

      return created
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

// Đổi hash + tăng sessionVersion trong MỘT update: không có lúc hash mới mà token cũ còn sống (spec N Q15).
export async function changeUserPassword(
  db: PrismaClient,
  userId: number,
  currentPassword: string,
  newPassword: string,
  ipAddress: string | null = null
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  // Dùng chung bộ đếm sai với đăng nhập: phiên bị lộ không thành chỗ dò mật khẩu không giới hạn.
  if (await isRateLimited(user.username, ipAddress)) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "RATE_LIMITED" })
  }
  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) {
    await db.loginAttempt.create({
      data: { username: user.username, ipAddress, success: false, userId: user.id },
    })
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu hiện tại không đúng" })
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
  })
}
