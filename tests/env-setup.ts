// CRITICAL: This file MUST be the FIRST entry in vitest.config setupFiles.
// It loads .env.test BEFORE any other module (especially src/server/db.ts)
// is imported, so PrismaClient sees the test DATABASE_URL — not production.
//
// Background: ES module imports are hoisted. If a setupFile contains both
// `import { db } from "@/server/db"` and `config({ path: .env.test })`,
// the db import runs FIRST, PrismaClient auto-loads .env (production), and
// any subsequent deleteMany() wipes production. This happened once.
//
// Separating env loading into a side-effect-only module that runs as the
// first setupFile guarantees env vars are set before db.ts is loaded.

import { config, parse } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function extractEndpoint(url: string): string {
  const match = url.match(/@([^/]+)\//)
  return match ? match[1] : url
}

// 1. NGĂN CHẶN CHẠY TRÊN VERCEL/PRODUCTION
if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
  console.error("\n❌ [SECURITY ERROR]: Đang ở môi trường PRODUCTION/VERCEL!")
  console.error("Hệ thống đã chặn hành động chạy tests để bảo vệ dữ liệu khách hàng.\n")
  process.exit(1)
}

// 2. BẮT BUỘC DÙNG .ENV.TEST
const testEnvPath = join(process.cwd(), ".env.test")
if (!existsSync(testEnvPath)) {
  console.error("\n❌ [ERROR]: Thiếu file .env.test!")
  console.error("Để chạy integration tests, bạn bắt buộc phải tạo file .env.test.")
  console.error("Vui lòng copy từ .env.test.example và trỏ DATABASE_URL vào database test riêng.\n")
  process.exit(1)
}

// 3. SO SÁNH ENDPOINT VỚI PRODUCTION TRƯỚC KHI LOAD
const prodEnvPath = join(process.cwd(), ".env")
let prodEndpoint: string | null = null
if (existsSync(prodEnvPath)) {
  const prodVars = parse(readFileSync(prodEnvPath))
  const prodUrl = prodVars["DATABASE_URL"] || ""
  const testVars = parse(readFileSync(testEnvPath))
  const testUrl = testVars["DATABASE_URL"] || ""

  prodEndpoint = prodUrl ? extractEndpoint(prodUrl) : null

  if (prodUrl && testUrl && extractEndpoint(prodUrl) === extractEndpoint(testUrl)) {
    console.error("\n❌ [DANGER]: .env.test đang trỏ vào CÙNG endpoint với production!")
    console.error(`Endpoint: ${extractEndpoint(testUrl)}`)
    console.error("Chạy tests sẽ XÓA SẠCH dữ liệu production. Tạo Neon branch riêng cho test.\n")
    process.exit(1)
  }
}

// 4. CRITICAL — Clear any pre-existing DATABASE_URL / DIRECT_URL from process.env
// before loading .env.test. Prisma falls back to .env if process.env.DATABASE_URL
// is missing AND its loader sees .env file. By aggressively clearing then setting,
// we guarantee the value comes from .env.test.
delete process.env.DATABASE_URL
delete process.env.DIRECT_URL

// 5. Load .env.test
config({ path: testEnvPath, override: true })

// 6. FINAL ASSERTION — process.env.DATABASE_URL must now equal .env.test URL
// AND must NOT equal production endpoint.
const dbUrl: string = process.env.DATABASE_URL ?? ""
if (dbUrl === "") {
  console.error("\n❌ [ERROR]: DATABASE_URL chưa được set sau khi load .env.test.\n")
  process.exit(1)
}
if (prodEndpoint && extractEndpoint(dbUrl) === prodEndpoint) {
  console.error("\n❌ [DANGER]: Sau khi load .env.test, DATABASE_URL VẪN trỏ vào production endpoint!")
  console.error(`Endpoint: ${extractEndpoint(dbUrl)}`)
  console.error("Có lỗi trong .env.test hoặc shell env. Test bị chặn để bảo vệ production.\n")
  process.exit(1)
}

// Cảnh báo nếu cloud DB không có từ "test" trong URL (best-effort)
const isLocal: boolean = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") || dbUrl.includes("::1")
if (!isLocal) {
  const isSensitiveCloud: boolean =
    dbUrl.includes("neon.tech") ||
    dbUrl.includes("vercel-storage.com") ||
    dbUrl.includes("supabase.co")
  const hasTestKeyword: boolean = dbUrl.toLowerCase().includes("test")
  if (isSensitiveCloud && !hasTestKeyword) {
    console.warn("\n⚠️  [WARNING]: DATABASE_URL không chứa từ 'test'.")
    console.warn(`Endpoint: ${extractEndpoint(dbUrl)}`)
    console.warn("Đảm bảo đây là Neon branch test, không phải production.\n")
  }
}

// Thiết lập NODE_ENV
;(process.env as Record<string, string | undefined>).NODE_ENV = "test"

// Export expected endpoint for runtime double-check in setup.ts beforeAll.
// (Re-read from .env.test fresh — guarantees consistency.)
const testVarsFinal = parse(readFileSync(testEnvPath))
export const EXPECTED_TEST_ENDPOINT = extractEndpoint(testVarsFinal["DATABASE_URL"] || "")
export const FORBIDDEN_PROD_ENDPOINT = prodEndpoint
