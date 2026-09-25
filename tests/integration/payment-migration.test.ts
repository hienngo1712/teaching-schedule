import { describe, it, expect, beforeEach } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"
import { findPaidAmountMismatches } from "../helpers/payment"

const MARKER = "-- Chuyển dữ liệu cũ"

// Lấy đúng câu INSERT sẽ chạy trên production để kiểm tra, không chép lại SQL vào test.
function dataCopySql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_payments"))
  expect(found).toHaveLength(1)
  const sql = readFileSync(join(dir, found[0], "migration.sql"), "utf8")
  const start = sql.indexOf(MARKER)
  expect(start).toBeGreaterThan(-1)
  return sql.slice(start)
}

async function seedTuition(studentId: number, month: number, paidAmount: number, updatedAtUtc: string) {
  const mt = await db.monthlyTuition.create({
    data: { studentId, year: 2026, month, paidAmount, totalAmountDue: 300000 },
  })
  // @updatedAt luôn ghi giờ hiện tại → đặt lại bằng SQL để mô phỏng dữ liệu cũ.
  await db.$executeRaw`UPDATE "monthly_tuition" SET "updated_at" = ${updatedAtUtc}::timestamp WHERE "id" = ${mt.id}`
  return mt
}

describe("Migration add_payments — chuyển dữ liệu cũ", () => {
  beforeEach(async () => {
    await db.monthlyTuition.deleteMany() // cascade xoá payments
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
    await db.student.deleteMany()
  })

  it("mỗi tháng paidAmount > 0 thành đúng 1 Payment; số lượng và tổng tiền không đổi; bất biến giữ", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const st = await db.student.create({ data: { userId: user.id, fullName: "HS Dữ Liệu Cũ", grade: 5 } })
    const late = await seedTuition(st.id, 5, 300000, "2026-05-31 18:30:00") // 01:30 ngày 01/06 giờ VN
    const early = await seedTuition(st.id, 4, 150000, "2026-04-10 03:00:00")
    await seedTuition(st.id, 3, 0, "2026-03-10 03:00:00") // chưa trả → không sinh Payment

    // (A) spec §8.3
    const [before] = await db.$queryRaw<Array<{ n: number; total: number }>>`
      SELECT COUNT(*)::int AS n, COALESCE(SUM("paid_amount"), 0)::int AS total
      FROM "monthly_tuition" WHERE "paid_amount" > 0`

    await db.$executeRawUnsafe(dataCopySql())

    // (B) spec §8.3: phải bằng đúng (A)
    const [after] = await db.$queryRaw<Array<{ n: number; total: number }>>`
      SELECT COUNT(*)::int AS n, COALESCE(SUM("amount"), 0)::int AS total FROM "payments"`
    expect(before).toEqual({ n: 2, total: 450000 })
    expect(after).toEqual(before)

    // (C) spec §8.3: 0 dòng lệch
    expect(await findPaidAmountMismatches()).toEqual([])

    const payments = await db.payment.findMany()
    const byMonth = new Map(payments.map((p) => [p.monthlyTuitionId, p]))
    expect(byMonth.get(late.id)!.paidAt.toISOString().slice(0, 10)).toBe("2026-06-01")
    expect(byMonth.get(early.id)!.paidAt.toISOString().slice(0, 10)).toBe("2026-04-10")
    expect(byMonth.get(late.id)!.amount).toBe(300000)
    for (const p of payments) {
      expect(p.method).toBe("cash")
      expect(p.note).toBe("Chuyển từ dữ liệu cũ")
    }
  })

  it("xoá MonthlyTuition → Payment bị xoá theo (FK cascade)", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const st = await db.student.create({ data: { userId: user.id, fullName: "HS Cascade", grade: 5 } })
    await seedTuition(st.id, 5, 100000, "2026-05-10 03:00:00")
    await db.$executeRawUnsafe(dataCopySql())
    expect(await db.payment.count()).toBe(1)

    await db.student.delete({ where: { id: st.id } }) // xoá cứng → cascade MonthlyTuition → Payment
    expect(await db.payment.count()).toBe(0)
  })
})
