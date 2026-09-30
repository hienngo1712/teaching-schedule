import { describe, it, expect } from "vitest"
import { db } from "@/server/db"
import crypto from "crypto"

describe("Migration O — schema & backfill", () => {
  it("bảng consent_records và security_events ghi đọc được", async () => {
    const teacher = await db.user.findFirstOrThrow({ where: { username: "teacher" } })
    const c = await db.consentRecord.create({
      data: {
        userId: teacher.id,
        scope: "share_parent",
        textVersion: "2026-09-27",
        itemCount: 2,
        ipAddress: "127.0.0.1",
      },
    })
    expect(c.id).toBeGreaterThan(0)

    const e = await db.securityEvent.create({
      data: {
        userId: teacher.id,
        event: "backup_exported",
        ipAddress: "127.0.0.1",
      },
    })
    expect(e.id).toBeGreaterThan(0)
  })

  it("cột cá nhân nhận chuỗi dài > 255 ký tự (mã hoá ciphertext)", async () => {
    const teacher = await db.user.findFirstOrThrow({ where: { username: "teacher" } })
    const longString = "enc:v1:t1:" + "a".repeat(500)
    const s = await db.student.create({
      data: {
        fullName: longString,
        grade: 10,
        parentPhone: longString,
        parentName: longString,
        parentLinkToken: "test_tok_" + crypto.randomUUID(),
        parentLinkTokenHash: crypto.randomBytes(32).toString("hex"),
        userId: teacher.id,
      },
    })
    expect(s.fullName.length).toBeGreaterThan(255)
    expect(s.parentPhone?.length).toBeGreaterThan(255)
  })
})
