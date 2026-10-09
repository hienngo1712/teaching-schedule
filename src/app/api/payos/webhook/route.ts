import { db } from "@/server/db"
import { handlePayosWebhook } from "@/server/services/payos-order.service"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
  try {
    const { status } = await handlePayosWebhook(db, body)
    return Response.json({ ok: status === 200 }, { status })
  } catch (e) {
    console.error(`[payos] webhook lỗi: ${e instanceof Error ? e.message : "?"}`)
    return Response.json({ ok: false }, { status: 500 })
  }
}
