import type { PrismaClient } from "@prisma/client"

export const SECURITY_EVENTS = [
  "backup_download",
  "bank_account_update",
  "bank_account_clear",
  "parent_link_create",
  "parent_link_disable",
] as const
export type SecurityEvent = (typeof SECURITY_EVENTS)[number]

// Chỉ ghi ai/làm gì/lúc nào/IP, không bao giờ ghi giá trị dữ liệu (spec O Q15).
export async function logSecurityEvent(
  db: PrismaClient,
  p: { userId: number; event: SecurityEvent; ipAddress: string | null }
): Promise<void> {
  await db.securityEvent.create({
    data: { userId: p.userId, event: p.event, ipAddress: p.ipAddress?.slice(0, 45) ?? null },
  })
}

// Cùng cách đọc IP với tRPC context: Vercel ghi đè x-forwarded-for.
export function ipFromRequest(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")
}
