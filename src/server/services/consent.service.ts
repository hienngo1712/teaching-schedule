import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { CONSENT_REQUIRED, CONSENT_TEXT_VERSION, updateTouchesPersonalData, type ConsentPayload, type ConsentScope } from "@/lib/consent"

// Ghi TRƯỚC khi ghi dữ liệu: thời điểm đồng ý là lúc bấm Lưu (spec O Q11).
export async function recordConsent(
  db: PrismaClient,
  p: { userId: number; scope: ConsentScope; studentId?: number | null; itemCount?: number; ipAddress: string | null }
): Promise<void> {
  await db.consentRecord.create({
    data: {
      userId: p.userId,
      scope: p.scope,
      textVersion: CONSENT_TEXT_VERSION,
      studentId: p.studentId ?? null,
      itemCount: p.itemCount ?? 1,
      ipAddress: p.ipAddress?.slice(0, 45) ?? null,
    },
  })
}

// Đổi trạng thái/lớp/học phí không cần tick; chạm tên, SĐT, tên phụ huynh, ghi chú thì bắt buộc.
export function assertUpdateConsent(
  data: Parameters<typeof updateTouchesPersonalData>[0],
  consent: ConsentPayload | undefined
): void {
  if (updateTouchesPersonalData(data) && !consent) {
    throw new TRPCError({ code: "BAD_REQUEST", message: CONSENT_REQUIRED })
  }
}
