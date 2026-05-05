import { config } from "dotenv"
import { existsSync } from "node:fs"
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

// Load biến môi trường từ .env.test
config({ path: testEnvPath, override: true })

// 3. KIỂM TRA DATABASE_URL SAU KHI LOAD
const dbUrl = process.env.DATABASE_URL || ""
const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") || dbUrl.includes("::1")
const hasTestKeyword = dbUrl.toLowerCase().includes("test")

// Nếu trỏ tới các dịch vụ Cloud nhạy cảm mà không có từ khóa 'test' trong DB name
const isSensitiveCloud = dbUrl.includes("neon.tech") || dbUrl.includes("vercel-storage.com") || dbUrl.includes("supabase.co")

if (isSensitiveCloud && !hasTestKeyword) {
  console.error("\n❌ [DANGER]: DATABASE_URL có vẻ đang trỏ tới Production (Cloud)!")
  console.error(`URL: ${dbUrl.split("@")[1] || dbUrl}`)
  console.error("Database name phải chứa từ khóa 'test' để xác nhận đây là DB dùng cho thử nghiệm.")
  console.error("Ví dụ: postgresql://.../my_database_test\n")
  process.exit(1)
}

if (!isLocal && !hasTestKeyword) {
  console.error("\n❌ [DANGER]: Database không an toàn cho testing!")
  console.error("DATABASE_URL phải trỏ về localhost hoặc tên database phải có hậu tố '_test'.\n")
  process.exit(1)
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
