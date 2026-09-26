// NOTE: Env loading + safety checks live in tests/env-setup.ts, which MUST
// run as the first setupFile in vitest.config.ts. This file assumes
// process.env.DATABASE_URL has already been pinned to .env.test and that any
// production endpoint mismatch already aborted the process.

import { db } from "@/server/db"
import bcrypt from "bcryptjs"
import { beforeAll, afterAll } from "vitest"
import { EXPECTED_TEST_ENDPOINT, FORBIDDEN_PROD_ENDPOINT } from "./env-setup"

function extractEndpoint(url: string): string {
  const match = url.match(/@([^/]+)\//)
  return match ? match[1] : url
}

beforeAll(async () => {
  // RUNTIME DOUBLE-CHECK — verify the LIVE Prisma connection points to the
  // test endpoint and NOT to production, RIGHT BEFORE any destructive op.
  // If env-setup.ts and module hoisting ever desync again, this catches it.
  const liveUrl = process.env.DATABASE_URL || ""
  const liveEndpoint = extractEndpoint(liveUrl)

  if (!EXPECTED_TEST_ENDPOINT || liveEndpoint !== EXPECTED_TEST_ENDPOINT) {
    console.error("\n❌ [DANGER]: Live DATABASE_URL endpoint does not match .env.test!")
    console.error(`Expected (.env.test): ${EXPECTED_TEST_ENDPOINT}`)
    console.error(`Live (process.env):   ${liveEndpoint}`)
    console.error("Aborting before any deleteMany() to protect production data.\n")
    process.exit(1)
  }
  if (FORBIDDEN_PROD_ENDPOINT && liveEndpoint === FORBIDDEN_PROD_ENDPOINT) {
    console.error("\n❌ [DANGER]: Live DATABASE_URL endpoint EQUALS production endpoint!")
    console.error(`Endpoint: ${liveEndpoint}`)
    console.error("Aborting before any deleteMany() to protect production data.\n")
    process.exit(1)
  }

  // Reset DB theo thứ tự FK
  try {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
    await db.payment.deleteMany() // cascade từ student đã đủ; ghi rõ cho thứ tự FK
    await db.student.deleteMany()
    await db.classUpgradeLog.deleteMany()
    await db.subject.deleteMany()
    await db.loginAttempt.deleteMany()
    await db.planOrder.deleteMany()
    await db.user.deleteMany()
  } catch (error) {
    console.error("\n❌ [DATABASE ERROR]: Không thể reset database test.")
    console.error("Vui lòng kiểm tra lại DATABASE_URL và kết nối mạng.")
    console.error(error)
    process.exit(1)
  }

  // Seed data cho tests
  // Test cũ dùng teacher/teacher2 cho mọi tính năng → cho Pro dài hạn để phân gói không làm vỡ.
  const PRO_UNTIL_2099 = new Date("2099-12-31T17:00:00.000Z")

  const user1 = await db.user.create({
    data: {
      username: "teacher",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Giáo viên Test",
      plan: "pro",
      planExpiresAt: PRO_UNTIL_2099,
    },
  })

  const user2 = await db.user.create({
    data: {
      username: "teacher2",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Giáo viên Test 2",
      plan: "pro",
      planExpiresAt: PRO_UNTIL_2099,
    },
  })

  const userStd = await db.user.create({
    data: {
      username: "teacher_std",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Giáo viên Standard",
    },
  })

  await db.user.create({
    data: {
      username: "admin_test",
      passwordHash: await bcrypt.hash("teacher123", 4),
      fullName: "Quản trị Test",
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

  await db.subject.create({
    data: {
      name: "Tiếng Anh",
      color: "#4F46E5",
      isDefault: true,
      userId: userStd.id,
    },
  })
})

afterAll(async () => {
  await db.$disconnect()
})
