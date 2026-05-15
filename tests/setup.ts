import { config, parse } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

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
// Đọc production URL từ .env (không override env hiện tại)
function extractEndpoint(url: string): string {
  // Lấy hostname từ URL: postgresql://user:pass@hostname/db → hostname
  const match = url.match(/@([^/]+)\//)
  return match ? match[1] : url
}

const prodEnvPath = join(process.cwd(), ".env")
if (existsSync(prodEnvPath)) {
  const prodVars = parse(readFileSync(prodEnvPath))
  const prodUrl = prodVars["DATABASE_URL"] || ""
  const testVars = parse(readFileSync(testEnvPath))
  const testUrl = testVars["DATABASE_URL"] || ""

  if (prodUrl && testUrl && extractEndpoint(prodUrl) === extractEndpoint(testUrl)) {
    console.error("\n❌ [DANGER]: .env.test đang trỏ vào CÙNG endpoint với production!")
    console.error(`Endpoint: ${extractEndpoint(testUrl)}`)
    console.error("Chạy tests sẽ XÓA SẠCH dữ liệu production. Tạo Neon branch riêng cho test.\n")
    process.exit(1)
  }
}

// Load biến môi trường từ .env.test
config({ path: testEnvPath, override: true })

// 4. KIỂM TRA DATABASE_URL SAU KHI LOAD
const dbUrl = process.env.DATABASE_URL || ""
const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") || dbUrl.includes("::1")

if (!isLocal) {
  const isSensitiveCloud =
    dbUrl.includes("neon.tech") ||
    dbUrl.includes("vercel-storage.com") ||
    dbUrl.includes("supabase.co")
  const hasTestKeyword = dbUrl.toLowerCase().includes("test")

  // Cảnh báo nếu cloud DB không có từ "test" trong URL (best-effort check)
  if (isSensitiveCloud && !hasTestKeyword) {
    console.warn("\n⚠️  [WARNING]: DATABASE_URL không chứa từ 'test'.")
    console.warn(`Endpoint: ${extractEndpoint(dbUrl)}`)
    console.warn("Đảm bảo đây là Neon branch test, không phải production.\n")
  }
}

// Thiết lập NODE_ENV và bcrypt cost
;(process.env as Record<string, string | undefined>).NODE_ENV = "test"

import { db } from "@/server/db"
import bcrypt from "bcryptjs"
import { beforeAll, afterAll } from "vitest"

beforeAll(async () => {
  // Reset DB theo thứ tự FK
  try {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
    await db.student.deleteMany()
    await db.subject.deleteMany()
    await db.loginAttempt.deleteMany()
    await db.user.deleteMany()
  } catch (error) {
    console.error("\n❌ [DATABASE ERROR]: Không thể reset database test.")
    console.error("Vui lòng kiểm tra lại DATABASE_URL và kết nối mạng.")
    console.error(error)
    process.exit(1)
  }

  // Seed data cho tests
  const user1 = await db.user.create({
    data: {
      username: "teacher",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Giáo viên Test",
    },
  })

  const user2 = await db.user.create({
    data: {
      username: "teacher2",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Giáo viên Test 2",
    },
  })

  await db.subject.create({
    data: {
      name: "Tiếng Anh",
      color: "#4F46E5",
      isDefault: true,
      userId: user1.id,
    },
  })

  await db.subject.create({
    data: {
      name: "Tiếng Anh",
      color: "#4F46E5",
      isDefault: true,
      userId: user2.id,
    },
  })
})

afterAll(async () => {
  await db.$disconnect()
})
