import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "dotenv"

const db = new PrismaClient()

const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 12

function extractEndpoint(url: string): string {
  const match = url.match(/@([^/]+)\//)
  return match ? match[1] : url
}

// SAFETY: nếu DATABASE_URL hiện tại trùng endpoint của .env production VÀ
// user không set ALLOW_PROD_SEED=YES, chặn để không seed nhầm lên production.
function assertNotProductionUnlessConfirmed(): void {
  const liveUrl = process.env.DATABASE_URL || ""
  if (!liveUrl) {
    console.error("❌ DATABASE_URL chưa được set. Dừng seed.")
    process.exit(1)
  }
  const prodEnvPath = join(process.cwd(), ".env")
  if (!existsSync(prodEnvPath)) return // không có .env production để so sánh

  const prodVars = parse(readFileSync(prodEnvPath))
  const prodUrl = prodVars["DATABASE_URL"] || ""
  if (!prodUrl) return

  if (extractEndpoint(liveUrl) === extractEndpoint(prodUrl)) {
    if (process.env.ALLOW_PROD_SEED === "YES") {
      console.warn("⚠️  Seed đang chạy lên endpoint PRODUCTION (ALLOW_PROD_SEED=YES).")
      console.warn(`Endpoint: ${extractEndpoint(liveUrl)}`)
      return
    }
    console.error("\n❌ [DANGER]: Seed sẽ chạy lên endpoint trùng với production!")
    console.error(`Endpoint: ${extractEndpoint(liveUrl)}`)
    console.error("Nếu thực sự cần seed production, set env ALLOW_PROD_SEED=YES.\n")
    process.exit(1)
  }
}

async function seedSubjectsForUser(userId: number) {
  const defaults = [
    { name: "Tiếng Anh", color: "#4F46E5", isDefault: true, sortOrder: 1 },
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
  assertNotProductionUnlessConfirmed()

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

  console.log(`✅ Seed OK: user "${user.username}" (id=${user.id}) + 1 subject`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
