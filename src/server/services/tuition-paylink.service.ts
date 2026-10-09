import type { PrismaClient } from "@prisma/client"
import { cancelPaymentLink, createPaymentLink } from "@/server/payos"
import { activeTeacherPayos } from "./payos-teacher.service"
import { isInProgressMonth } from "@/lib/tuition-display"
import { TX_OPTIONS } from "./payment.service"

// Khoá riêng (2 số, ns 8) để 2 lần mở phiếu cùng lúc không tạo 2 link; ns 7 là khoá ghi tiền của payment.service.
const LINK_LOCK_NS = 8
// payOS bắt expiredAt; QR trên ảnh phiếu có thể quét muộn nên để 1 năm.
const LINK_TTL_SECONDS = 365 * 24 * 3600

export function anchorMonth(year: number, month: number) {
  if (!isInProgressMonth(year, month)) return { year, month }
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export async function ensureTuitionPayLink(
  db: PrismaClient, userId: number, studentId: number,
  notice: { year: number; month: number }, amount: number,
  opts: { origin: string; returnPath: string }
) {
  const cfg = await activeTeacherPayos(db, userId)
  if (!cfg || amount <= 0) return null
  const anchor = anchorMonth(notice.year, notice.month)
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LINK_LOCK_NS}::int, ${studentId}::int)`
      const active = await tx.tuitionPayLink.findFirst({ where: { studentId, status: "active" }, orderBy: { id: "desc" } })
      if (active && active.amount === amount) return active
      if (active) {
        await cancelPaymentLink(cfg, active.payosLinkId).catch((e) => console.warn(`[payos] huỷ link HP lỗi: ${e instanceof Error ? e.message : "?"}`))
        await tx.tuitionPayLink.update({ where: { id: active.id }, data: { status: "cancelled" } })
      }
      const draft = await tx.tuitionPayLink.create({
        data: { userId, studentId, year: anchor.year, month: anchor.month, amount, payosLinkId: "", qrCode: "", checkoutUrl: "" },
      })
      const url = `${opts.origin}${opts.returnPath}`
      const r = await createPaymentLink(cfg, {
        orderCode: draft.id, amount, description: `HP ${draft.id}`, returnUrl: url, cancelUrl: url,
        expiredAt: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
      })
      return tx.tuitionPayLink.update({
        where: { id: draft.id },
        data: { payosLinkId: r.paymentLinkId, qrCode: r.qrCode, checkoutUrl: r.checkoutUrl, bankBin: r.bin, accountNumber: r.accountNumber, accountName: r.accountName },
      })
    }, TX_OPTIONS)
  } catch (e) {
    // Lỗi payOS rollback cả dòng nháp → phiếu rơi về VietQR.
    console.warn(`[payos] tạo link HP lỗi: ${e instanceof Error ? e.message : "?"}`)
    return null
  }
}
