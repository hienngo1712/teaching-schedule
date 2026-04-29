// Tạo user mới + seed 5 subjects mặc định.
//
// Cách dùng:
//   pnpm user:create --username giaovien2 --password "MatKhau@2026" [--fullname "Nguyễn Thị B"]
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { parseArgs } from "node:util"
import { seedSubjectsForUser } from "./_seed-subjects"

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
      fullname: { type: "string" },
      password: { type: "string" },
    },
  })

  const username = values.username?.trim()
  const password = values.password
  const fullname = values.fullname?.trim()

  if (!username || !password) {
    console.error("❌ Thiếu --username hoặc --password")
    process.exit(1)
  }

  if (username.length < 3 || username.length > 50) {
    console.error("❌ Username phải dài 3–50 ký tự")
    process.exit(1)
  }

  const pwError = validatePassword(password)
  if (pwError) {
    console.error(`❌ ${pwError}`)
    process.exit(1)
  }

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    console.error(`❌ Username "${username}" đã tồn tại`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { username, passwordHash, fullName: fullname ?? null },
  })

  await seedSubjectsForUser(db, user.id)

  console.log(`✅ Tạo user "${user.username}" (id=${user.id}) + 5 subjects mặc định`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
