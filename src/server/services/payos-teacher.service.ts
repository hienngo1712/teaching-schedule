import { randomBytes } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { cancelPaymentLink, confirmWebhook, payosBaseUrl, type PayosConfig } from "@/server/payos"
import { effectivePlan, hasFeature } from "@/lib/plans"
import type { PayosConnectInput } from "@/lib/schemas/payos"

export function teacherPayosConfig(row: { clientId: string; apiKey: string; checksumKey: string }): PayosConfig {
  return { clientId: row.clientId, apiKey: row.apiKey, checksumKey: row.checksumKey, baseUrl: payosBaseUrl() }
}

async function unlocked(db: PrismaClient, userId: number, now: Date) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, planExpiresAt: true, trialEndsAt: true } })
  return hasFeature(effectivePlan(u, now).plan, "payosTuition")
}

export async function getTeacherPayosStatus(db: PrismaClient, userId: number) {
  const row = await db.teacherPayos.findUnique({ where: { userId }, select: { connectedAt: true } })
  return { connected: row !== null, connectedAt: row?.connectedAt ?? null, featureUnlocked: await unlocked(db, userId, new Date()) }
}

export async function activeTeacherPayos(db: PrismaClient, userId: number, now = new Date()): Promise<PayosConfig | null> {
  const row = await db.teacherPayos.findUnique({ where: { userId } })
  if (!row || !(await unlocked(db, userId, now))) return null
  return teacherPayosConfig(row)
}

export async function connectTeacherPayos(db: PrismaClient, userId: number, input: PayosConnectInput, origin: string | null | undefined) {
  if (!(await unlocked(db, userId, new Date()))) throw new TRPCError({ code: "FORBIDDEN" })
  // Dán khoá kênh mua gói thì confirm-webhook ghi đè webhook mua gói của app.
  if (input.clientId === process.env.PAYOS_CLIENT_ID?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Đây là khoá kênh mua gói của app, hãy tạo kênh payOS riêng" })
  }
  if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "Không xác định được địa chỉ app" })
  const prev = await db.teacherPayos.findUnique({ where: { userId } })
  const hookId = prev?.hookId ?? randomBytes(32).toString("base64url")
  // Lưu khoá mới TRƯỚC khi confirm: payOS POST thử vào webhook, phải kiểm được chữ ký bằng khoá mới thì mới trả 200.
  const row = await db.teacherPayos.upsert({
    where: { userId },
    update: { ...input, hookId, connectedAt: new Date() },
    create: { userId, ...input, hookId },
    select: { connectedAt: true },
  })
  try {
    await confirmWebhook(teacherPayosConfig(input), `${origin}/api/payos/tuition/${hookId}`)
  } catch (e) {
    console.warn(`[payos] GV ${userId} kết nối lỗi: ${e instanceof Error ? e.message : "?"}`)
    if (prev) await db.teacherPayos.update({ where: { userId }, data: { clientId: prev.clientId, apiKey: prev.apiKey, checksumKey: prev.checksumKey, connectedAt: prev.connectedAt } })
    else await db.teacherPayos.delete({ where: { userId } })
    throw new TRPCError({ code: "BAD_REQUEST", message: "Không kết nối được payOS, kiểm tra lại 3 khoá" })
  }
  // Đổi sang kênh khác: link cũ ký bằng khoá kênh cũ sẽ bị webhook từ chối (401) → huỷ để không phát QR đó nữa.
  if (prev && prev.clientId !== input.clientId) await cancelActiveLinks(db, userId, teacherPayosConfig(prev))
  return { connectedAt: row.connectedAt }
}

async function cancelActiveLinks(db: PrismaClient, userId: number, cfg: PayosConfig) {
  const links = await db.tuitionPayLink.findMany({ where: { userId, status: "active" }, select: { id: true, payosLinkId: true } })
  for (const l of links) {
    if (!l.payosLinkId) continue
    try {
      await cancelPaymentLink(cfg, l.payosLinkId)
    } catch (e) {
      console.warn(`[payos] huỷ link HP lỗi: ${e instanceof Error ? e.message : "?"}`)
    }
  }
  await db.tuitionPayLink.updateMany({ where: { userId, status: "active" }, data: { status: "cancelled" } })
}

export async function disconnectTeacherPayos(db: PrismaClient, userId: number) {
  const row = await db.teacherPayos.findUnique({ where: { userId } })
  if (!row) return { success: true as const }
  await cancelActiveLinks(db, userId, teacherPayosConfig(row))
  await db.teacherPayos.delete({ where: { userId } })
  return { success: true as const }
}
