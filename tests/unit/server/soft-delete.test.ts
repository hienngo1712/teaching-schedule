import { describe, it, expect } from "vitest"
import { LIVE, LIVE_LINK, RESTORE_DATA, SOFT_DELETE_MODELS, WITH_DELETED, softDeleteData, withLiveFilter } from "@/server/soft-delete"

const READS = ["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy"]
const WRITES = ["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert", "delete", "deleteMany"]

describe("withLiveFilter (spec Q Q1)", () => {
  it("4 model xoá mềm, không có User", () => {
    expect([...SOFT_DELETE_MODELS].sort()).toEqual(["Payment", "Student", "Subject", "TeachingSession"])
  })

  it.each(READS)("đọc %s → thêm isDeleted:false, giữ nguyên field khác", (op) => {
    const args = { where: { userId: 1 }, select: { id: true } }
    expect(withLiveFilter("Student", op, args)).toEqual({ where: { userId: 1, isDeleted: false }, select: { id: true } })
    expect(args.where).toEqual({ userId: 1 }) // không sửa object gốc
  })

  it("args hoặc where thiếu → vẫn lọc", () => {
    expect(withLiveFilter("TeachingSession", "findMany", undefined)).toEqual({ where: { isDeleted: false } })
    expect(withLiveFilter("Payment", "count", {})).toEqual({ where: { isDeleted: false } })
  })

  it("where đã có khoá isDeleted (kể cả undefined) → không đè", () => {
    expect(withLiveFilter("Student", "findMany", { where: { isDeleted: true } })).toEqual({ where: { isDeleted: true } })
    const both = { where: { id: 3, ...WITH_DELETED } }
    expect(withLiveFilter("Subject", "findUnique", both)).toBe(both)
  })

  it.each(WRITES)("ghi %s → không đụng (dọn test, khôi phục)", (op) => {
    const args = { where: { id: 1 } }
    expect(withLiveFilter("Student", op, args)).toBe(args)
  })

  it("model khác (User, SessionStudent, MonthlyTuition) hoặc raw (model undefined) → không đụng", () => {
    for (const m of ["User", "SessionStudent", "MonthlyTuition", undefined]) {
      const args = { where: { id: 1 } }
      expect(withLiveFilter(m, "findMany", args)).toBe(args)
    }
  })
})

describe("hằng dùng chung", () => {
  it("giá trị đúng", () => {
    expect(LIVE).toEqual({ isDeleted: false })
    expect(LIVE_LINK).toEqual({ student: { isDeleted: false } })
    expect(RESTORE_DATA).toEqual({ isDeleted: false, deletedAt: null })
    const now = new Date("2026-10-01T03:00:00Z")
    expect(softDeleteData(now)).toEqual({ isDeleted: true, deletedAt: now })
    expect("isDeleted" in WITH_DELETED).toBe(true)
  })
})
