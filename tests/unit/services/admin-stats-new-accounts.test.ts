import { describe, it, expect, vi } from "vitest"

const h = vi.hoisted(() => ({ countNewAccounts: vi.fn(async () => 3) }))
vi.mock("@/server/services/new-accounts.service", () => ({ countNewAccounts: h.countNewAccounts }))
vi.mock("@/server/services/plan-admin.service", () => ({ getPendingCount: vi.fn(async () => ({ count: 2, newAccounts: 3 })) }))

import type { PrismaClient } from "@prisma/client"
import { getAdminStats } from "@/server/services/admin-stats.service"

describe("getAdminStats (spec U U23)", () => {
  it("không đếm tài khoản mới 2 lần: lấy từ getPendingCount", async () => {
    const db = { user: { findMany: vi.fn(async () => []) }, $queryRaw: vi.fn(async () => [{ count: 0 }]) } as unknown as PrismaClient
    const s = await getAdminStats(db)
    expect(h.countNewAccounts).not.toHaveBeenCalled()
    expect(s.newAccounts).toBe(3)
    expect(s.pendingOrders).toBe(2)
  })
})
