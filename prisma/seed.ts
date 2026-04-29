import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"

const db = new PrismaClient()

const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 12

async function seedSubjectsForUser(userId: number) {
  const defaults = [
    { name: "Tiếng Anh", color: "#4F46E5", isDefault: true, sortOrder: 1 },
    { name: "Toán", color: "#0891B2", isDefault: false, sortOrder: 2 },
    { name: "Ngữ Văn", color: "#059669", isDefault: false, sortOrder: 3 },
    { name: "Vật Lý", color: "#D97706", isDefault: false, sortOrder: 4 },
    { name: "Hóa Học", color: "#DC2626", isDefault: false, sortOrder: 5 },
  ]
  for (const s of defaults) {
    await db.subject.upsert({
      where: { userId_name: { userId, name: s.name } },
      update: {},
      create: { ...s, userId },
    })
  }
}

async function main() {
  const passwordHash = await bcrypt.hash("teacher123", BCRYPT_COST)

  const user = await db.user.upsert({
    where: { username: "teacher" },
    update: {},
    create: {
      username: "teacher",
      passwordHash,
      fullName: "Giáo viên",
    },
  })

  await seedSubjectsForUser(user.id)

  console.log(`✅ Seed OK: user "${user.username}" (id=${user.id}) + 5 subjects`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
