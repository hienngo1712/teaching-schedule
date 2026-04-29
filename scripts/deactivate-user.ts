// Vô hiệu hóa user (soft) — isActive = false → không thể login.
// Data của user vẫn giữ nguyên trong DB.
//
// Cách dùng: pnpm user:deactivate --username giaovien2
import { PrismaClient } from "@prisma/client"
import { parseArgs } from "node:util"

const db = new PrismaClient()

async function main() {
  const { values } = parseArgs({
    options: { username: { type: "string" } },
  })

  const username = values.username?.trim()
  if (!username) {
    console.error("❌ Thiếu --username")
    process.exit(1)
  }

  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    console.error(`❌ Không tìm thấy user "${username}"`)
    process.exit(1)
  }

  if (!user.isActive) {
    console.log(`ℹ User "${username}" đã ở trạng thái deactivated từ trước`)
    return
  }

  await db.user.update({
    where: { id: user.id },
    data: { isActive: false },
  })

  console.log(`✅ Đã deactivate user "${username}" (id=${user.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
