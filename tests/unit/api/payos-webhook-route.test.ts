import { describe, it, expect, vi } from "vitest"
vi.mock("@/server/services/payos-order.service", () => ({ handlePayosWebhook: vi.fn() }))
vi.mock("@/server/db", () => ({ db: {} }))
import { handlePayosWebhook } from "@/server/services/payos-order.service"
import { POST } from "@/app/api/payos/webhook/route"

const req = (body: string) => new Request("http://localhost/api/payos/webhook", { method: "POST", body })

describe("POST /api/payos/webhook", () => {
  it("JSON hỏng → 400, không gọi service", async () => {
    expect((await POST(req("{oops"))).status).toBe(400)
    expect(handlePayosWebhook).not.toHaveBeenCalled()
  })
  it("trả đúng status của service, body không lộ chi tiết", async () => {
    vi.mocked(handlePayosWebhook).mockResolvedValueOnce({ status: 401, result: "sai chữ ký" })
    const r = await POST(req("{}"))
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ ok: false })
    vi.mocked(handlePayosWebhook).mockResolvedValueOnce({ status: 200, result: "đã kích hoạt" })
    expect(await (await POST(req("{}"))).json()).toEqual({ ok: true })
  })
  it("service ném lỗi → 500 (payOS gửi lại sau)", async () => {
    vi.mocked(handlePayosWebhook).mockRejectedValueOnce(new Error("db"))
    expect((await POST(req("{}"))).status).toBe(500)
  })
})
