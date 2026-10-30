import { describe, it, expect, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { buildBackupWorkbook } from "@/server/services/backup.service"

// AT: sheet "Học phí tháng" phải xuất nhận xét tháng gửi PH để sao lưu không mất dữ liệu.
const tuitionRow = {
  id: 1, studentId: 7, year: 2026, month: 10, totalSessions: 4, presentSessions: 4, previousBalance: 0,
  currentMonthFee: 400000, totalAmountDue: 400000, paidAmount: 0, isFullPaid: false,
  notes: "Nội bộ", parentComment: "Con ngoan.\nCố lên!", updatedAt: new Date("2026-10-30T00:00:00Z"),
  student: { fullName: "HS A" },
}

function fakeDb() {
  const tuitionFindMany = vi.fn(async () => [tuitionRow])
  // Mọi bảng khác rỗng; chỉ user + monthlyTuition có dữ liệu.
  const db = new Proxy({} as Record<string, unknown>, {
    get: (_t, model: string) => {
      if (model === "user") return { findUniqueOrThrow: vi.fn(async () => ({ username: "gv", fullName: "GV", bankBin: null, bankAccountNumber: null, bankAccountName: null })) }
      if (model === "monthlyTuition") return { findMany: tuitionFindMany }
      return { findMany: vi.fn(async () => []) }
    },
  })
  return { db: db as unknown as PrismaClient, tuitionFindMany }
}

describe("buildBackupWorkbook: nhận xét tháng (AT)", () => {
  it("select parentComment và có cột 'Nhận xét gửi phụ huynh' ngay sau 'Ghi chú'", async () => {
    const { db, tuitionFindMany } = fakeDb()
    const wb = await buildBackupWorkbook(db, 1, new Date("2026-10-30T05:00:00Z"))

    const args = (tuitionFindMany.mock.calls[0] as unknown as [{ select: Record<string, unknown> }])[0]
    expect(args.select.parentComment).toBe(true)

    const ws = wb.getWorksheet("Học phí tháng")!
    const headers = (ws.getRow(1).values as unknown[]).slice(1)
    const i = headers.indexOf("Nhận xét gửi phụ huynh")
    expect(i).toBe(headers.indexOf("Ghi chú") + 1)
    expect(ws.getRow(2).getCell(i + 1).value).toBe("Con ngoan.\nCố lên!")
  })
})
