import { describe, it, expect, vi, afterEach } from "vitest"
import { createHmac } from "node:crypto"
import {
  cancelPaymentLink, createPaymentLink, getPayosConfig, parsePayosDateTime,
  signPaymentRequest, signWebhookData, verifyWebhookSignature,
} from "@/server/payos"

const KEY = "test-checksum-key"
const h = (s: string) => createHmac("sha256", KEY).update(s).digest("hex")
const cfg = { clientId: "test-client", apiKey: "test-api-key", checksumKey: KEY, baseUrl: "https://payos.test" }

afterEach(() => {
  vi.restoreAllMocks()
  for (const k of ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY", "PAYOS_API_BASE"]) delete process.env[k]
})

describe("getPayosConfig", () => {
  it("thiếu 1 khoá → null; đủ → mặc định base payOS thật, trim", () => {
    process.env.PAYOS_CLIENT_ID = " c "; process.env.PAYOS_API_KEY = "a"
    expect(getPayosConfig()).toBeNull()
    process.env.PAYOS_CHECKSUM_KEY = "k"
    expect(getPayosConfig()).toEqual({ clientId: "c", apiKey: "a", checksumKey: "k", baseUrl: "https://api-merchant.payos.vn" })
    process.env.PAYOS_API_BASE = "http://127.0.0.1:4010"
    expect(getPayosConfig()?.baseUrl).toBe("http://127.0.0.1:4010")
  })
})

describe("chữ ký", () => {
  it("link: đúng thứ tự amount,cancelUrl,description,orderCode,returnUrl", () => {
    const d = { amount: 99000, cancelUrl: "https://x/plan", description: "SM ABC123", orderCode: 42, returnUrl: "https://x/plan" }
    expect(signPaymentRequest(KEY, d)).toBe(h("amount=99000&cancelUrl=https://x/plan&description=SM ABC123&orderCode=42&returnUrl=https://x/plan"))
  })
  it("webhook: sắp xếp khoá, null/undefined thành rỗng", () => {
    const data = { orderCode: 42, amount: 99000, description: "SM ABC123", counterAccountName: null, virtualAccountName: undefined }
    expect(signWebhookData(KEY, data)).toBe(h("amount=99000&counterAccountName=&description=SM ABC123&orderCode=42&virtualAccountName="))
  })
  it("verify: đúng → true; sai 1 ký tự / độ dài khác / khoá khác → false", () => {
    const data = { orderCode: 1, amount: 1000 }
    const sig = signWebhookData(KEY, data)
    expect(verifyWebhookSignature(KEY, data, sig)).toBe(true)
    expect(verifyWebhookSignature(KEY, data, sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a"))).toBe(false)
    expect(verifyWebhookSignature(KEY, data, "abc")).toBe(false)
    expect(verifyWebhookSignature("khac", data, sig)).toBe(false)
  })
})

describe("gọi API", () => {
  it("createPaymentLink gửi header + chữ ký, trả 3 trường", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "00", data: { paymentLinkId: "pl1", qrCode: "000201QR", checkoutUrl: "https://pay.payos.vn/web/pl1" } }), { status: 200 })
    )
    const input = { orderCode: 42, amount: 99000, description: "SM ABC123", returnUrl: "https://x/plan", cancelUrl: "https://x/plan", expiredAt: 1800000000 }
    await expect(createPaymentLink(cfg, input)).resolves.toEqual({ paymentLinkId: "pl1", qrCode: "000201QR", checkoutUrl: "https://pay.payos.vn/web/pl1" })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("https://payos.test/v2/payment-requests")
    expect((init!.headers as Record<string, string>)["x-client-id"]).toBe("test-client")
    expect((init!.headers as Record<string, string>)["x-api-key"]).toBe("test-api-key")
    const body = JSON.parse(init!.body as string)
    expect(body).toMatchObject({ ...input, signature: signPaymentRequest(KEY, input) })
  })
  it("createPaymentLink: code khác 00 → ném lỗi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "231", desc: "Đơn đã tồn tại" }), { status: 200 }))
    await expect(createPaymentLink(cfg, { orderCode: 1, amount: 1, description: "SM A", returnUrl: "r", cancelUrl: "c", expiredAt: 1 })).rejects.toThrow()
  })
  it("cancelPaymentLink gọi đúng URL; HTTP 500 → ném lỗi", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ code: "00" }), { status: 200 }))
    await cancelPaymentLink(cfg, "pl1")
    expect(fetchSpy.mock.calls[0][0]).toBe("https://payos.test/v2/payment-requests/pl1/cancel")
    fetchSpy.mockResolvedValueOnce(new Response("err", { status: 500 }))
    await expect(cancelPaymentLink(cfg, "pl1")).rejects.toThrow()
  })
})

it("parsePayosDateTime: giờ VN", () => {
  expect(parsePayosDateTime("2026-10-09 20:15:00").toISOString()).toBe("2026-10-09T13:15:00.000Z")
})
