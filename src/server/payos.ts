import { createHmac, timingSafeEqual } from "node:crypto"

export type PayosConfig = { clientId: string; apiKey: string; checksumKey: string; baseUrl: string }

const DEFAULT_BASE = "https://api-merchant.payos.vn"
const TIMEOUT_MS = 5000

export function getPayosConfig(): PayosConfig | null {
  const clientId = process.env.PAYOS_CLIENT_ID?.trim()
  const apiKey = process.env.PAYOS_API_KEY?.trim()
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim()
  if (!clientId || !apiKey || !checksumKey) return null
  return { clientId, apiKey, checksumKey, baseUrl: process.env.PAYOS_API_BASE?.trim() || DEFAULT_BASE }
}

const hmac = (key: string, s: string) => createHmac("sha256", key).update(s).digest("hex")

export function signPaymentRequest(
  key: string,
  d: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string }
): string {
  return hmac(key, `amount=${d.amount}&cancelUrl=${d.cancelUrl}&description=${d.description}&orderCode=${d.orderCode}&returnUrl=${d.returnUrl}`)
}

// Theo SDK payOS: khoá xếp alphabet, null/undefined (kể cả chuỗi "null") thành rỗng.
export function signWebhookData(key: string, data: Record<string, unknown>): string {
  const s = Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k]
      const empty = v === null || v === undefined || v === "null" || v === "undefined"
      return `${k}=${empty ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)}`
    })
    .join("&")
  return hmac(key, s)
}

export function verifyWebhookSignature(key: string, data: Record<string, unknown>, signature: string): boolean {
  const a = Buffer.from(signWebhookData(key, data))
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function call(cfg: PayosConfig, path: string, body: unknown): Promise<{ code?: string; desc?: string; data?: unknown }> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: { "x-client-id": cfg.clientId, "x-api-key": cfg.apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`payOS HTTP ${res.status}`)
  const json = (await res.json()) as { code?: string; desc?: string; data?: unknown }
  if (json.code !== "00") throw new Error(`payOS ${json.code}: ${json.desc ?? ""}`)
  return json
}

export async function createPaymentLink(
  cfg: PayosConfig,
  input: { orderCode: number; amount: number; description: string; returnUrl: string; cancelUrl: string; expiredAt: number }
): Promise<{ paymentLinkId: string; qrCode: string; checkoutUrl: string }> {
  const json = await call(cfg, "/v2/payment-requests", { ...input, signature: signPaymentRequest(cfg.checksumKey, input) })
  const d = json.data as { paymentLinkId?: string; qrCode?: string; checkoutUrl?: string } | undefined
  if (!d?.paymentLinkId || !d.qrCode || !d.checkoutUrl) throw new Error("payOS thiếu dữ liệu link")
  return { paymentLinkId: d.paymentLinkId, qrCode: d.qrCode, checkoutUrl: d.checkoutUrl }
}

export async function cancelPaymentLink(cfg: PayosConfig, paymentLinkId: string): Promise<void> {
  await call(cfg, `/v2/payment-requests/${encodeURIComponent(paymentLinkId)}/cancel`, { cancellationReason: "Huỷ đơn" })
}

// Huỷ link để QR cũ không trả được nữa; lỗi chỉ log (link vẫn tự hết hạn).
export async function cancelPayosLinkSafe(paymentLinkId: string): Promise<void> {
  const cfg = getPayosConfig()
  if (!cfg) return
  try {
    await cancelPaymentLink(cfg, paymentLinkId)
  } catch (e) {
    console.warn(`[payos] huỷ link lỗi: ${e instanceof Error ? e.message : "?"}`)
  }
}

export function parsePayosDateTime(s: string): Date {
  return new Date(`${s.trim().replace(" ", "T")}+07:00`)
}
