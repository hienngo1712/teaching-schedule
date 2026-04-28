import { describe, it, expect } from "vitest"
import { publicCaller } from "../helpers/trpc"

describe("health.ping", () => {
  it("trả status ok", async () => {
    const res = await publicCaller.health.ping()
    expect(res.status).toBe("ok")
  })

  it("trả timestamp ISO 8601 hợp lệ", async () => {
    const res = await publicCaller.health.ping()
    expect(res.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(new Date(res.timestamp).toString()).not.toBe("Invalid Date")
  })
})
