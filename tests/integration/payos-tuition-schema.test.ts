import { describe, it, expect } from "vitest"
import { db } from "@/server/db"

describe("schema AH", () => {
  it("khoá payOS giáo viên lưu dạng mã hoá, đọc ra chuỗi gốc", async () => {
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.teacherPayos.upsert({
      where: { userId: u.id },
      update: { clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: "h".repeat(43) },
      create: { userId: u.id, clientId: "t-client", apiKey: "t-api", checksumKey: "t-checksum", hookId: "h".repeat(43) },
    })
    const raw = await db.$queryRaw<{ api_key: string; checksum_key: string }[]>`SELECT api_key, checksum_key FROM teacher_payos WHERE user_id = ${u.id}`
    expect(raw[0].api_key).not.toBe("t-api")
    expect(raw[0].checksum_key).not.toBe("t-checksum")
    expect((await db.teacherPayos.findUniqueOrThrow({ where: { userId: u.id } })).checksumKey).toBe("t-checksum")
    await db.teacherPayos.delete({ where: { userId: u.id } })
  })
})
