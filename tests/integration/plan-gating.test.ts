import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { TRPCError } from "@trpc/server"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { db } from "@/server/db"
import { appRouter } from "@/server/trpc/root"
import { getAuthedCaller } from "../helpers/trpc"
import { PlanRequiredError } from "@/server/services/plan.service"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>
type Call = (c: Caller, sid: number) => Promise<unknown>

const FAR = new Date("2099-12-31T17:00:00.000Z")
const Y = 2026
const M = 5

async function setPlan(plan: "standard" | "plus" | "pro") {
  await db.user.update({
    where: { username: "teacher_std" },
    data: { plan, planExpiresAt: plan === "standard" ? null : FAR, trialEndsAt: null },
  })
}

async function errorOf(p: Promise<unknown>): Promise<unknown> {
  return p.then(() => null, (e: unknown) => e)
}

async function expectPlanRequired(p: Promise<unknown>, plan: "plus" | "pro") {
  const err = await errorOf(p)
  expect(err).toBeInstanceOf(TRPCError)
  expect((err as TRPCError).code).toBe("FORBIDDEN")
  expect((err as TRPCError).cause).toBeInstanceOf(PlanRequiredError)
  expect(((err as TRPCError).cause as PlanRequiredError).plan).toBe(plan)
}

// Lỗi khác FORBIDDEN (NOT_FOUND...) nghĩa là đã qua chốt gói, vào tới service.
async function expectPassesGate(p: Promise<unknown>) {
  const err = await errorOf(p)
  if (err) expect((err as TRPCError).code).not.toBe("FORBIDDEN")
}

const PLUS_CASES: [string, Call][] = [
  ["payment.list", (c, sid) => c.payment.list({ studentId: sid, year: Y, month: M })],
  ["payment.create", (c, sid) => c.payment.create({ studentId: sid, year: Y, month: M, amount: 1000, method: "cash", paidAt: "2026-05-15" })],
  ["payment.update", (c) => c.payment.update({ id: 999999, data: { amount: 1000 } })],
  ["payment.delete", (c) => c.payment.delete({ id: 999999 })],
  ["tuition.updateSettlement", (c, sid) => c.tuition.updateSettlement({ studentId: sid, year: Y, month: M, isFullPaid: false })],
  ["tuition.getNotice", (c, sid) => c.tuition.getNotice({ studentId: sid, year: Y, month: M })],
  ["report.monthlySummary 1 tháng", (c) => c.report.monthlySummary({ year: Y, month: M })],
  ["report.monthlySummary toMonth trùng tháng đầu", (c) => c.report.monthlySummary({ year: Y, month: M, toYear: Y, toMonth: M })],
  ["report.student 1 tháng", (c, sid) => c.report.student({ studentId: sid, year: Y, month: M })],
]

const PRO_CASES: [string, Call][] = [
  ["report.monthlySummary nhiều tháng", (c) => c.report.monthlySummary({ year: Y, month: 1, toYear: Y, toMonth: 12 })],
  ["report.monthlySummary có grade", (c) => c.report.monthlySummary({ year: Y, month: M, grade: 3 })],
  ["report.student nhiều tháng", (c, sid) => c.report.student({ studentId: sid, year: Y, month: 1, toMonth: 3 })],
  ["report.alerts", (c) => c.report.alerts()],
  ["student.importCheck", (c) => c.student.importCheck({ rows: [{ fullName: "Kiểm Tra", grade: 1 }] })],
  ["student.importMany", (c) => c.student.importMany({ rows: [{ fullName: "Nhập Thử Gói", grade: 1 }] })],
  ["student.generateParentLink", (c, sid) => c.student.generateParentLink({ id: sid })],
]

describe("Chặn theo gói (spec I mục 6.3)", () => {
  let sid = 0
  let userId = 0

  beforeAll(async () => {
    userId = (await db.user.findUniqueOrThrow({ where: { username: "teacher_std" } })).id
    sid = (await db.student.create({ data: { userId, fullName: "HS Chặn Gói", grade: 3, tuitionFee: 100000 } })).id
  })

  afterAll(async () => {
    await db.monthlyTuition.deleteMany({ where: { student: { userId } } })
    await db.student.deleteMany({ where: { userId } })
    await setPlan("standard")
  })

  it.each(PLUS_CASES)("Standard: %s → FORBIDDEN, planRequired=plus", async (_name, call) => {
    await setPlan("standard")
    await expectPlanRequired(call(await getAuthedCaller("teacher_std"), sid), "plus")
  })

  it.each(PRO_CASES)("Standard: %s → FORBIDDEN, planRequired=pro", async (_name, call) => {
    await setPlan("standard")
    await expectPlanRequired(call(await getAuthedCaller("teacher_std"), sid), "pro")
  })

  it.each(PLUS_CASES)("Plus: %s → qua chốt gói", async (_name, call) => {
    await setPlan("plus")
    await expectPassesGate(call(await getAuthedCaller("teacher_std"), sid))
  })

  it.each(PRO_CASES)("Plus: %s → FORBIDDEN, planRequired=pro", async (_name, call) => {
    await setPlan("plus")
    await expectPlanRequired(call(await getAuthedCaller("teacher_std"), sid), "pro")
  })

  it.each([...PLUS_CASES, ...PRO_CASES])("Pro: %s → qua chốt gói", async (_name, call) => {
    await setPlan("pro")
    await expectPassesGate(call(await getAuthedCaller("teacher_std"), sid))
  })

  it("Standard vẫn dùng các procedure không chặn (mục 6.3 'Không chặn')", async () => {
    await setPlan("standard")
    const c = await getAuthedCaller("teacher_std")
    await expect(c.student.list({})).resolves.toBeDefined()
    await expect(c.tuition.getMonthlyStatus({ year: Y, month: M })).resolves.toBeDefined()
    await expect(c.tuition.getMonthlyStatusReadOnly({ year: Y, month: M })).resolves.toBeDefined()
    await expect(c.report.dashboard()).resolves.toBeDefined()
    await expect(c.student.disableParentLink({ id: sid })).resolves.toEqual({ success: true })
  })

  it("đổi gói có hiệu lực ngay (không nằm trong JWT): trial còn hạn → qua; hết trial → chặn", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "standard", planExpiresAt: null, trialEndsAt: new Date(Date.now() + 86_400_000) } })
    const c = await getAuthedCaller("teacher_std")
    await expectPassesGate(c.report.alerts())
    await db.user.update({ where: { id: userId }, data: { trialEndsAt: new Date(Date.now() - 1000) } })
    await expectPlanRequired(c.report.alerts(), "pro")
  })

  it("HTTP: lỗi thiếu gói có data.planRequired; lỗi khác có planRequired=null", async () => {
    await setPlan("standard")
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } })
    const call = (session: boolean) =>
      fetchRequestHandler({
        endpoint: "/api/trpc",
        req: new Request("http://localhost/api/trpc/report.alerts"),
        router: appRouter,
        createContext: async () => ({
          db,
          session: session
            ? {
                user: { id: String(u.id), username: u.username, fullName: u.fullName, name: u.fullName, email: null },
                expires: new Date(Date.now() + 3_600_000).toISOString(),
              }
            : null,
          userId: session ? u.id : null,
          ip: null,
        }),
      })

    const res = await call(true)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.message).toBe("Tính năng này cần gói Pro")
    expect(body.error.data.code).toBe("FORBIDDEN")
    expect(body.error.data.planRequired).toBe("pro")

    const anon = await (await call(false)).json()
    expect(anon.error.data.code).toBe("UNAUTHORIZED")
    expect(anon.error.data.planRequired).toBeNull()
  })
})
