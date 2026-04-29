// Vitest global setup — chạy trước mọi test file.
import { config } from "dotenv"

// Load .env.test nếu có, fallback .env (Prisma CLI dùng .env)
config({ path: ".env.test" })
config()

// NODE_ENV=test → bcrypt cost = 4 (nhanh hơn cho test)
;(process.env as Record<string, string | undefined>).NODE_ENV =
  process.env.NODE_ENV ?? "test"

import { db } from "@/server/db"
import bcrypt from "bcryptjs"
import { beforeAll, afterAll } from "vitest"

beforeAll(async () => {
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
})

afterAll(async () => {
  await db.$disconnect()
})
