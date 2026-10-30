import { describe, it, expect, vi, beforeEach } from "vitest"

const h = vi.hoisted(() => ({
  getMonthlyTuitionStatus: vi.fn(),
  ensureMonthlyTuition: vi.fn(),
}))
vi.mock("@/server/services/tuition.service", () => ({
  getMonthlyTuitionStatus: h.getMonthlyTuitionStatus,
  ensureMonthlyTuition: h.ensureMonthlyTuition,
}))
vi.mock("@/server/services/payment.service", () => ({ listPayments: vi.fn(async () => []) }))
vi.mock("@/server/services/settings.service", () => ({ getBankAccount: vi.fn(async () => null) }))
vi.mock("@/server/services/tuition-paylink.service", () => ({ ensureTuitionPayLink: vi.fn() }))

import type { PrismaClient } from "@prisma/client"
import { getTeacherTuitionNotice, getTuitionNotice, saveParentComment } from "@/server/services/tuition-notice.service"

const status = {
  studentId: 7, fullName: "HS A", grade: 5, totalSessions: 0, presentSessions: 0, billingMode: "per_session",
  monthlyFee: 0, totalExpected: 0, previousBalance: 0, totalAmountDue: 0, paidAmount: 0, isFullPaid: false,
  debtMonths: 0, currentMonthFee: 0,
}

function fakeDb(row: { parentComment: string | null; notes?: string | null } | null) {
  return {
    sessionStudent: { findMany: vi.fn(async () => []) },
    user: { findUniqueOrThrow: vi.fn(async () => ({ fullName: "GV", username: "gv" })) },
    monthlyTuition: {
      findUnique: vi.fn(async () => row),
      update: vi.fn(async ({ data }: { data: { parentComment: string | null } }) => ({ parentComment: data.parentComment })),
    },
    student: { findFirst: vi.fn(async () => ({ parentLinkToken: "tok", placeId: 3 })) },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getMonthlyTuitionStatus.mockResolvedValue({ items: [status] })
  h.ensureMonthlyTuition.mockResolvedValue({ id: 99 })
})

describe("getTuitionNotice: nhận xét tháng (AT)", () => {
  it("đọc parentComment đúng HS × tháng, không lộ notes nội bộ", async () => {
    const db = fakeDb({ parentComment: "Con tiến bộ.\nCố lên!", notes: "MIEN_NOI_BO" })
    const n = await getTuitionNotice(db as unknown as PrismaClient, 1, { studentId: 7, year: 2026, month: 10 })
    expect(n.parentComment).toBe("Con tiến bộ.\nCố lên!")
    expect(db.monthlyTuition.findUnique).toHaveBeenCalledWith({
      where: { studentId_year_month: { studentId: 7, year: 2026, month: 10 } },
      select: { parentComment: true },
    })
    expect(JSON.stringify(n)).not.toContain("MIEN_NOI_BO")
  })

  it("chưa có dòng học phí tháng đó → parentComment null", async () => {
    const n = await getTuitionNotice(fakeDb(null) as unknown as PrismaClient, 1, { studentId: 7, year: 2026, month: 11 })
    expect(n.parentComment).toBeNull()
  })
})

describe("saveParentComment (AT)", () => {
  it("kiểm quyền qua ensureMonthlyTuition rồi ghi đúng dòng", async () => {
    const db = fakeDb(null)
    const r = await saveParentComment(db as unknown as PrismaClient, 1, { studentId: 7, year: 2026, month: 10, parentComment: "Tốt" })
    expect(h.ensureMonthlyTuition).toHaveBeenCalledWith(db, 1, 7, 2026, 10)
    expect(db.monthlyTuition.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { parentComment: "Tốt" },
      select: { parentComment: true },
    })
    expect(r).toEqual({ parentComment: "Tốt" })
  })

  it("chuỗi rỗng → lưu null (ẩn mục trên phiếu)", async () => {
    const db = fakeDb(null)
    await saveParentComment(db as unknown as PrismaClient, 1, { studentId: 7, year: 2026, month: 10, parentComment: "" })
    expect(db.monthlyTuition.update).toHaveBeenCalledWith(expect.objectContaining({ data: { parentComment: null } }))
  })

  it("HS không thuộc user → lỗi từ ensureMonthlyTuition, không ghi", async () => {
    h.ensureMonthlyTuition.mockRejectedValue(new Error("FORBIDDEN"))
    const db = fakeDb(null)
    await expect(
      saveParentComment(db as unknown as PrismaClient, 2, { studentId: 7, year: 2026, month: 10, parentComment: "x" })
    ).rejects.toThrow()
    expect(db.monthlyTuition.update).not.toHaveBeenCalled()
  })
})

describe("getTeacherTuitionNotice (AT)", () => {
  it("kèm parentLinkToken + placeId, lọc HS theo userId", async () => {
    const db = fakeDb({ parentComment: null })
    const n = await getTeacherTuitionNotice(db as unknown as PrismaClient, 1, { studentId: 7, year: 2026, month: 10 })
    expect(n.parentLinkToken).toBe("tok")
    expect(n.placeId).toBe(3)
    expect(db.student.findFirst).toHaveBeenCalledWith({
      where: { id: 7, userId: 1 },
      select: { parentLinkToken: true, placeId: true },
    })
  })
})
