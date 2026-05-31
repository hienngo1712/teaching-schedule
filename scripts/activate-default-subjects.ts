/**
 * One-time, IDEMPOTENT & NON-DESTRUCTIVE migration.
 *
 * Bật (isActive=true) hai môn "Toán" và "Tiếng Việt" cho MỌI user đang có.
 * - Nếu môn chưa tồn tại cho user → tạo mới (active) theo cấu hình DEFAULT_SUBJECTS.
 * - Nếu đã tồn tại → chỉ set isActive=true. KHÔNG xóa, KHÔNG đổi tên môn cũ.
 *
 * Cần thiết vì seedSubjectsForUser dùng upsert với `update: {}`, nên đổi default
 * trong code KHÔNG tác động tới account đã được seed từ trước.
 *
 * AN TOÀN: tự chặn nếu DATABASE_URL trùng endpoint của .env production,
 * trừ khi set ALLOW_PROD_SEED=YES (giống cơ chế của prisma/seed.ts).
 *
 * Chạy:  pnpm dlx tsx scripts/activate-default-subjects.ts
 * Prod:  ALLOW_PROD_SEED=YES pnpm dlx tsx scripts/activate-default-subjects.ts
 */
import { PrismaClient } from "@prisma/client"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "dotenv"
import { DEFAULT_SUBJECTS } from "./_seed-subjects"

const db = new PrismaClient()

const TARGET_NAMES = ["Toán", "Tiếng Việt"] as const

function extractEndpoint(url: string): string {
  const match = url.match(/@([^/]+)\//)
  return match ? match[1] : url
}

function assertNotProductionUnlessConfirmed(): void {
  const liveUrl = process.env.DATABASE_URL || ""
  if (!liveUrl) {
    console.error("❌ DATABASE_URL chưa được set. Dừng.")
    process.exit(1)
  }
  const prodEnvPath = join(process.cwd(), ".env")
  if (!existsSync(prodEnvPath)) return

  const prodVars = parse(readFileSync(prodEnvPath))
  const prodUrl = prodVars["DATABASE_URL"] || ""
  if (!prodUrl) return

  if (extractEndpoint(liveUrl) === extractEndpoint(prodUrl)) {
    if (process.env.ALLOW_PROD_SEED === "YES") {
      console.warn("⚠️  Đang chạy lên endpoint PRODUCTION (ALLOW_PROD_SEED=YES).")
      console.warn(`Endpoint: ${extractEndpoint(liveUrl)}`)
      return
    }
    console.error("\n❌ [DANGER]: Sẽ chạy lên endpoint trùng với production!")
    console.error(`Endpoint: ${extractEndpoint(liveUrl)}`)
    console.error("Nếu thực sự cần, set env ALLOW_PROD_SEED=YES.\n")
    process.exit(1)
  }
}

async function main() {
  assertNotProductionUnlessConfirmed()
  console.log(`🎯 Target DB endpoint: ${extractEndpoint(process.env.DATABASE_URL || "")}`)

  const targets = DEFAULT_SUBJECTS.filter((s) => TARGET_NAMES.includes(s.name as (typeof TARGET_NAMES)[number]))
  const users = await db.user.findMany({ select: { id: true, username: true } })
  console.log(`👥 ${users.length} user, kích hoạt: ${TARGET_NAMES.join(", ")}`)

  let created = 0
  let activated = 0
  for (const user of users) {
    for (const s of targets) {
      const existing = await db.subject.findUnique({
        where: { userId_name: { userId: user.id, name: s.name } },
        select: { id: true, isActive: true },
      })
      if (!existing) {
        await db.subject.create({
          data: {
            userId: user.id,
            name: s.name,
            color: s.color,
            isDefault: s.isDefault,
            sortOrder: s.sortOrder,
            isActive: true,
          },
        })
        created++
        console.log(`  + [${user.username}] tạo mới "${s.name}" (active)`)
      } else if (!existing.isActive) {
        await db.subject.update({ where: { id: existing.id }, data: { isActive: true } })
        activated++
        console.log(`  ✓ [${user.username}] bật "${s.name}"`)
      }
    }
  }

  console.log(`\n✅ Xong: tạo mới ${created}, kích hoạt ${activated}. Không xóa dữ liệu nào.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
