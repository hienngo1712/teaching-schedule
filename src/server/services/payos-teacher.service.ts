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
  const existing = await db.teacherPayos.findUnique({ where: { userId }, select: { hookId: true } })
  const hookId = existing?.hookId ?? randomBytes(32).toString("base64url")
  try {
    await confirmWebhook(teacherPayosConfig(input), `${origin}/api/payos/tuition/${hookId}`)
  } catch (e) {
    console.warn(`[payos] GV ${userId} kết nối lỗi: ${e instanceof Error ? e.message : "?"}`)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Không kết nối được payOS, kiểm tra lại 3 khoá" })
  }
  const row = await db.teacherPayos.upsert({
    where: { userId },
    update: { ...input, connectedAt: new Date() },
    create: { userId, ...input, hookId },
    select: { connectedAt: true },
  })
  return { connectedAt: row.connectedAt }
}

export async function disconnectTeacherPayos(db: PrismaClient, userId: number) {
  const row = await db.teacherPayos.findUnique({ where: { userId } })
  if (!row) return { success: true as const }
  const links = await db.tuitionPayLink.findMany({ where: { userId, status: "active" }, select: { id: true, payosLinkId: true } })
  for (const l of links) {
    try {
      await cancelPaymentLink(teacherPayosConfig(row), l.payosLinkId)
    } catch (e) {
      console.warn(`[payos] huỷ link HP lỗi: ${e instanceof Error ? e.message : "?"}`)
    }
  }
  await db.tuitionPayLink.updateMany({ where: { userId, status: "active" }, data: { status: "cancelled" } })
  await db.teacherPayos.delete({ where: { userId } })
  return { success: true as const }
}
