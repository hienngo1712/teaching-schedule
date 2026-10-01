import { describe, it, expect, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { encryptField } from "@/server/crypto/field-crypto"
import { studentIdsByNamePrefix } from "../../e2e/helpers/db-cleanup"

describe("studentIdsByNamePrefix (spec U U29)", () => {
  it("lọc theo tên sau khi giải mã, cả tên chưa mã hoá", async () => {
    const rows = [
      { id: 1, fullName: encryptField("HS Phiếu 1", "fullName") },
      { id: 2, fullName: "HS Phiếu cũ" },
      { id: 3, fullName: encryptField("Nguyễn An", "fullName") },
    ]
    const db = { student: { findMany: vi.fn(async () => rows) } } as unknown as PrismaClient
    expect(await studentIdsByNamePrefix(db, "HS Phiếu")).toEqual([1, 2])
  })
})
