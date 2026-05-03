import { config } from "dotenv"
import { existsSync } from "node:fs"
import { join } from "node:path"

if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
  console.error("\n❌ ERROR: Cảnh báo bảo mật CHÍNH MẠNG!")
  console.error("Bạn đang cố gắng chạy tests trên môi trường Production (Vercel).")
  console.error("Hành động này sẽ XÓA SẠCH dữ liệu thật của ứng dụng.")
  console.error("Hệ thống đã tự động chặn lại.\n")
  process.exit(1)
}

// Load .env.test nếu có
const testEnvPath = join(process.cwd(), ".env.test")
if (existsSync(testEnvPath)) {
  config({ path: ".env.test" })
} else {
  // Nếu không có .env.test, CẤM chạy integration tests nếu DATABASE_URL đang trỏ tới Neon
  // (tránh trường hợp người dùng quên và làm mất dữ liệu production/dev)
  config() // Load .env mặc định
  
  if (process.env.DATABASE_URL?.includes("neon.tech") || process.env.DATABASE_URL?.includes("vercel-storage.com")) {
    console.error("\n❌ ERROR: Cảnh báo bảo mật!")
    console.error("Bạn đang chạy tests với DATABASE_URL trỏ tới Production DB nhưng chưa có .env.test.")
    console.error("Hành động này sẽ XÓA SẠCH dữ liệu trong database hiện tại.")
    console.error("Vui lòng tạo file .env.test và dùng một database/branch riêng cho testing.\n")
    process.exit(1)
  }
}

// NODE_ENV=test → bcrypt cost = 4 (nhanh hơn cho test)
;(process.env as Record<string, string | undefined>).NODE_ENV =
  process.env.NODE_ENV ?? "test"

import { db } from "@/server/db"
import bcrypt from "bcryptjs"
import { beforeAll, afterAll } from "vitest"

beforeAll(async () => {
  // Kiểm tra lần cuối trước khi xóa
  if (process.env.DATABASE_URL?.includes("neon.tech") && !existsSync(testEnvPath)) {
    throw new Error("Không được phép chạy tests trên Neon database nếu không có .env.test")
  }

  // Reset DB theo thứ tự FK
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany()
  await db.loginAttempt.deleteMany()
  await db.user.deleteMany()

  await db.user.create({
    data: {
      username: "teacher",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Giáo viên Test",
    },
  })

  await db.user.create({
    data: {
      username: "teacher2",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Giáo viên Test 2",
    },
  })
})

afterAll(async () => {
  await db.$disconnect()
})
