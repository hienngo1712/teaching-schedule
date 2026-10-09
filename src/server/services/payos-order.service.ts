import { Prisma, type PrismaClient } from "@prisma/client"
import { ORDER_TTL_DAYS, addDays } from "@/lib/plans"
import { createPaymentLink, getPayosConfig, parsePayosDateTime, verifyWebhookSignature } from "@/server/payos"
import { expireStaleOrders } from "./plan.service"
import { activateOrderInTx } from "./plan-admin.service"

// false = payOS lỗi → caller đổi đơn sang vietqr (không chặn người mua).
export async function attachPayosLink(db: PrismaClient, order: { id: number; code: string; amount: number; createdAt: Date }, origin: string): Promise<boolean> {
  const cfg = getPayosConfig()
  if (!cfg) return false
  try {
    const link = await createPaymentLink(cfg, {
      orderCode: order.id,
      amount: order.amount,
      description: `SM ${order.code}`,
      returnUrl: `${origin}/plan`,
      cancelUrl: `${origin}/plan`,
      expiredAt: Math.floor(addDays(order.createdAt, ORDER_TTL_DAYS).getTime() / 1000),
    })
    await db.planOrder.update({ where: { id: order.id }, data: { payosLinkId: link.paymentLinkId, payosQr: link.qrCode, payosCheckoutUrl: link.checkoutUrl } })
    return true
  } catch (e) {
    console.warn(`[payos] tạo link đơn ${order.id} lỗi: ${e instanceof Error ? e.message : "?"}`)
    return false
  }
}

type WebhookData = { orderCode: number; amount: number; reference: string; transactionDateTime: string; paymentLinkId: string }

function readBody(body: unknown): { data: Record<string, unknown>; signature: string } | null {
  if (!body || typeof body !== "object") return null
  const b = body as { data?: unknown; signature?: unknown }
  if (!b.data || typeof b.data !== "object" || typeof b.signature !== "string") return null
  return { data: b.data as Record<string, unknown>, signature: b.signature }
}

export async function handlePayosWebhook(db: PrismaClient, body: unknown): Promise<{ status: 200 | 400 | 401 | 503; result: string }> {
  const cfg = getPayosConfig()
  if (!cfg) return { status: 503, result: "chưa cấu hình" }
  const parsed = readBody(body)
  if (!parsed) return { status: 400, result: "thiếu data" }
  if (!verifyWebhookSignature(cfg.checksumKey, parsed.data, parsed.signature)) return { status: 401, result: "sai chữ ký" }
  const d = parsed.data as unknown as WebhookData
  if (!Number.isInteger(d.orderCode) || !Number.isInteger(d.amount) || typeof d.reference !== "string") return { status: 200, result: "dữ liệu lạ" }

  const owner = await db.planOrder.findUnique({ where: { id: d.orderCode }, select: { userId: true, payosLinkId: true } })
  // Giao dịch thử của payOS (orderCode 123) có thể trùng id đơn thật: chỉ nhận khi đúng link của đơn.
  if (!owner || !owner.payosLinkId || owner.payosLinkId !== d.paymentLinkId) return { status: 200, result: "không khớp đơn" }

  const now = new Date()
  let result: string
  try {
    result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(owner.userId)})`
      await expireStaleOrders(tx, now, owner.userId)
      const order = await tx.planOrder.findUniqueOrThrow({ where: { id: d.orderCode }, select: { status: true, amount: true, payosRef: true, paidAmount: true } })
      if (order.payosRef === d.reference) return "gửi lặp"
      const paidAmount = (order.paidAmount ?? 0) + d.amount
      await tx.planOrder.update({
        where: { id: d.orderCode },
        data: { paidAmount, paidAt: parsePayosDateTime(d.transactionDateTime), payosRef: d.reference },
      })
      if (order.status !== "pending" || paidAmount < order.amount) return `cần xử lý (${order.status}, ${paidAmount}/${order.amount})`
      const done = await activateOrderInTx(tx, d.orderCode, "payos", now, "pending")
      return done ? "đã kích hoạt" : "cần xử lý (không duyệt được)"
    })
  } catch (e) {
    // reference đã gắn ở đơn khác (unique payos_ref): coi như đã xử lý, payOS không cần gửi lại.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") result = "reference trùng"
    else throw e
  }
  console.info(`[payos] đơn ${d.orderCode}: ${result}`)
  return { status: 200, result }
}
