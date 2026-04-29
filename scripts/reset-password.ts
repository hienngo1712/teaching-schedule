// Reset password cho user (admin override — dùng khi user quên mật khẩu).
//
// Cách dùng: pnpm user:reset-pw --username giaovien2 --password "MatKhauMoi@2026"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"
import { parseArgs } from "node:util"

const db = new PrismaClient()

function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Password phải ít nhất 10 ký tự"
  if (!/[A-Z]/.test(pw)) return "Password phải có ít nhất 1 chữ HOA"
  if (!/[a-z]/.test(pw)) return "Password phải có ít nhất 1 chữ thường"
  if (!/[0-9]/.test(pw)) return "Password phải có ít nhất 1 chữ số"
  return null
}

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      password: { type: "string" },
    },
  })

  const username = values.username?.trim()
  const password = values.password
  if (!username || !password) {
    console.error("❌ Thiếu --username hoặc --password")
    process.exit(1)
  }

  const pwError = validatePassword(password)
  if (pwError) {
    console.error(`❌ ${pwError}`)
    process.exit(1)
  }

  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    console.error(`❌ Không tìm thấy user "${username}"`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  // Xóa LoginAttempt fail gần đây để user không bị rate-limited oan
  await db.loginAttempt.deleteMany({
    where: {
      username,
      success: false,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
  })

  console.log(`✅ Đã reset password cho "${username}" + xóa rate-limit gần đây`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
