// Safety wrapper around `prisma migrate reset --force`.
// Refuses to run if DATABASE_URL points to the same endpoint as .env (production).
// Force via ALLOW_PROD_RESET=YES (NEVER use unless absolutely certain).

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "dotenv"
import { spawnSync } from "node:child_process"

function extractEndpoint(url: string): string {
  const match = url.match(/@([^/]+)\//)
  return match ? match[1] : url
}

const liveUrl = process.env.DATABASE_URL || ""
if (liveUrl === "") {
  console.error("❌ DATABASE_URL chưa được set. Dừng db:reset.")
  process.exit(1)
}

const prodEnvPath = join(process.cwd(), ".env")
if (existsSync(prodEnvPath)) {
  const prodVars = parse(readFileSync(prodEnvPath))
  const prodUrl = prodVars["DATABASE_URL"] || ""
  if (prodUrl && extractEndpoint(prodUrl) === extractEndpoint(liveUrl)) {
    if (process.env.ALLOW_PROD_RESET !== "YES") {
      console.error("\n❌ [DANGER]: db:reset sẽ DROP TẤT CẢ TABLES trên endpoint trùng production!")
      console.error(`Endpoint: ${extractEndpoint(liveUrl)}`)
      console.error("Nếu thực sự cần (cực kỳ hiếm), set env ALLOW_PROD_RESET=YES.\n")
      process.exit(1)
    }
    console.warn(`⚠️  Đang RESET PRODUCTION (ALLOW_PROD_RESET=YES). Endpoint: ${extractEndpoint(liveUrl)}\n`)
  }
}

const result = spawnSync("npx", ["prisma", "migrate", "reset", "--force"], {
  stdio: "inherit",
  shell: true,
})
process.exit(result.status ?? 1)
