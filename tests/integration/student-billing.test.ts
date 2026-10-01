import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"
import { monthKey } from "@/lib/billing"

async function resetStudents() {
  await db.studentBillingChange.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.student.deleteMany()
}

describe("Student Billing Mode (spec T)", () => {
  beforeEach(async () => {
    await resetStudents()
  })

  it("1. Tạo HS trọn tháng -> 1 dòng lịch sử fromKey=0, DTO trả đủ", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Trọn Tháng",
      grade: 5,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })

    expect(s.billingMode).toBe("monthly")
    expect(s.monthlyFee).toBe(400_000)

    const changes = await db.studentBillingChange.findMany({
      where: { studentId: s.id },
    })
    expect(changes).toHaveLength(1)
    expect(changes[0].fromKey).toBe(0)
    expect(changes[0].mode).toBe("monthly")
    expect(changes[0].monthlyFee).toBe(400_000)
  })

  it("2. Tạo HS mặc định -> 0 dòng lịch sử, billingMode=per_session", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Theo Buổi",
      grade: 6,
    })

    expect(s.billingMode).toBe("per_session")
    expect(s.monthlyFee).toBe(0)

    const changes = await db.studentBillingChange.findMany({
      where: { studentId: s.id },
    })
    expect(changes).toHaveLength(0)
  })

  it("3. Sửa HS theo buổi -> trọn tháng 300k -> 1 dòng fromKey=monthKey(tháng VN)", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Đổi Cách Thu",
      grade: 7,
    })

    const { year, month } = vnDateParts()
    const currentKey = monthKey(year, month)

    const updated = await caller.student.update({
      id: s.id,
      data: {
        billingMode: "monthly",
        monthlyFee: 300_000,
      },
    })
    expect(updated.billingMode).toBe("monthly")
    expect(updated.monthlyFee).toBe(300_000)

    const changes = await db.studentBillingChange.findMany({
      where: { studentId: s.id },
    })
    expect(changes).toHaveLength(1)
    expect(changes[0].fromKey).toBe(currentKey)
    expect(changes[0].mode).toBe("monthly")
    expect(changes[0].monthlyFee).toBe(300_000)
  })

  it("4. Sửa tiếp trong cùng tháng lên 350k -> vẫn 1 dòng tháng này với 350k", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Sửa Nhiều Lần",
      grade: 8,
    })

    const { year, month } = vnDateParts()
    const currentKey = monthKey(year, month)

    await caller.student.update({
      id: s.id,
      data: {
        billingMode: "monthly",
        monthlyFee: 300_000,
      },
    })
    await caller.student.update({
      id: s.id,
      data: {
        billingMode: "monthly",
        monthlyFee: 350_000,
      },
    })

    const changes = await db.studentBillingChange.findMany({
      where: { studentId: s.id },
    })
    expect(changes).toHaveLength(1)
    expect(changes[0].fromKey).toBe(currentKey)
    expect(changes[0].monthlyFee).toBe(350_000)
  })

  it("5. HS tạo trọn tháng 400k (dòng 0) -> sửa 500k -> sửa lại 400k -> chỉ còn dòng 0", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Đổi Rồi Đổi Lại",
      grade: 9,
      billingMode: "monthly",
      monthlyFee: 400_000,
    })

    await caller.student.update({
      id: s.id,
      data: {
        monthlyFee: 500_000,
      },
    })
    let changes = await db.studentBillingChange.findMany({
      where: { studentId: s.id },
    })
    expect(changes).toHaveLength(2)

    await caller.student.update({
      id: s.id,
      data: {
        monthlyFee: 400_000,
      },
    })
    changes = await db.studentBillingChange.findMany({
      where: { studentId: s.id },
    })
    expect(changes).toHaveLength(1)
    expect(changes[0].fromKey).toBe(0)
    expect(changes[0].monthlyFee).toBe(400_000)
  })

  it("6. Sửa chỉ fullName -> không thêm dòng lịch sử", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Tên Cũ",
      grade: 10,
    })

    await caller.student.update({
      id: s.id,
      consent: CONSENT_ACCEPTED,
      data: {
        fullName: "HS Tên Mới",
      },
    })

    const changes = await db.studentBillingChange.findMany({
      where: { studentId: s.id },
    })
    expect(changes).toHaveLength(0)
  })

  it("7. Input không hợp lệ -> BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await expect(caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Sai Mode",
      grade: 11,
      // @ts-expect-error test invalid billingMode
      billingMode: "weekly",
    })).rejects.toThrow()

    await expect(caller.student.create({
      consent: CONSENT_ACCEPTED,
      fullName: "HS Âm Tiền",
      grade: 12,
      monthlyFee: -1,
    })).rejects.toThrow()
  })
})
