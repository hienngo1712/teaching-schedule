// Xem danh sách user.
// Cách dùng: pnpm user:list
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  if (users.length === 0) {
    console.log("(chưa có user nào)")
    return
  }

  console.table(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName ?? "",
      active: u.isActive ? "yes" : "no",
      lastLogin: u.lastLoginAt?.toISOString() ?? "-",
      createdAt: u.createdAt.toISOString().slice(0, 10),
    }))
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
