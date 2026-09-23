import { describe, it, expect } from "vitest"
import { publicCaller } from "../helpers/trpc"
import { db } from "@/server/db"

describe("User Registration", () => {
  const testUser = {
    username: `test_reg_${Date.now()}`,
    password: "Password123!",
    fullName: "Test Registration",
  }

  it("✓ register successfully → create user + seed subjects", async () => {
    const result = await publicCaller.auth.register(testUser)
    
    expect(result.username).toBe(testUser.username)
    expect(result.fullName).toBe(testUser.fullName)
    expect(result.id).toBeDefined()

    // Verify user in DB
    const userInDb = await db.user.findUnique({ where: { username: testUser.username } })
    expect(userInDb).toBeDefined()
    expect(userInDb?.fullName).toBe(testUser.fullName)

    // Verify subjects seeded
    const subjects = await db.subject.findMany({ where: { userId: userInDb?.id } })
    expect(subjects.length).toBeGreaterThanOrEqual(1)
    const english = subjects.find(s => s.name === "Tiếng Anh")
    expect(english).toBeDefined()
    expect(english?.isDefault).toBe(true)
  })

  it("✗ register with existing username → throw BAD_REQUEST", async () => {
    await expect(publicCaller.auth.register(testUser)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Tên đăng nhập đã tồn tại",
    })
  })

  it("✗ register with invalid username → throw validation error", async () => {
    await expect(publicCaller.auth.register({
      username: "ab", // too short
      password: "Password123!",
    })).rejects.toThrow()
    
    await expect(publicCaller.auth.register({
      username: "user@invalid", // invalid chars
      password: "Password123!",
    })).rejects.toThrow()
  })

  it("✗ register with invalid password → throw validation error", async () => {
    await expect(publicCaller.auth.register({
      username: "valid_user",
      password: "123", // too short
    })).rejects.toThrow()
  })
})
