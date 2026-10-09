import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"

beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await db.contactChange.deleteMany()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await db.contactChange.deleteMany()
})

describe("contact", () => {
  it("chưa cài → get null; admin lưu → get trả dòng mới nhất; history 5 dòng mới nhất", async () => {
    expect(await publicCaller.contact.get()).toBeNull()
    const admin = await getAuthedCaller("admin_test")
    for (let i = 0; i < 6; i++) await admin.contact.update({ phone: `097947955${i}`, facebookUrl: "" })
    await admin.contact.update({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })
    expect(await publicCaller.contact.get()).toEqual({ phone: "0979479550", facebookUrl: "https://www.facebook.com/ngo.quang.hien.657661" })
    const h = await admin.contact.history()
    expect(h).toHaveLength(5)
    expect(h[0]).toMatchObject({ phone: "0979479550", changedBy: "admin_test" })
  })
  it("giáo viên không sửa được", async () => {
    await expect((await getAuthedCaller("teacher_std")).contact.update({ phone: "0979479550", facebookUrl: "" })).rejects.toThrow()
  })
})
