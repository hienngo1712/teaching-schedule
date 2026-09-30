import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { CONSENT_ACCEPTED } from "@/lib/consent"

async function cleanup() {
  await db.student.deleteMany()
  await db.securityEvent.deleteMany()
}
beforeEach(cleanup)
afterAll(cleanup)

describe("security_events (spec O 6.9)", () => {
  it("tạo và tắt link phụ huynh ghi 2 sự kiện, không có cột giá trị", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Sự Kiện", grade: 5 })
    await t.student.generateParentLink({ id: s.id })
    await t.student.disableParentLink({ id: s.id })
    const ev = await db.securityEvent.findMany({ orderBy: { id: "asc" } })
    expect(ev.map((e) => e.event)).toEqual(["parent_link_create", "parent_link_disable"])
    expect(Object.keys(ev[0]).sort()).toEqual(["createdAt", "event", "id", "ipAddress", "userId"])
  })

  it("thao tác lỗi (HS không thuộc mình) không ghi sự kiện", async () => {
    const t2 = await getAuthedCaller("teacher2")
    const s = await t2.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS GV2", grade: 5 })
    const t = await getAuthedCaller()
    await expect(t.student.generateParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await db.securityEvent.count()).toBe(0)
  })
})
