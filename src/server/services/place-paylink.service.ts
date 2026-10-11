import type { PlacePayLink, PrismaClient } from "@prisma/client"
import { cancelPaymentLink, createPaymentLink } from "@/server/payos"
import { activeTeacherPayos } from "./payos-teacher.service"
import { TX_OPTIONS } from "./payment.service"

// orderCode gửi payOS = PLACE_ORDER_OFFSET + PlacePayLink.id. TuitionPayLink.id (orderCode luồng HS) không bao giờ
// chạm mức này, payOS nhận orderCode tới 2^53 → webhook rẽ nhánh theo orderCode mà không đụng luồng HS (spec AO §2).
export const PLACE_ORDER_OFFSET = 1_000_000_000

// Khoá riêng (2 số, ns 9): 2 lần mở phiếu cùng nơi cùng lúc không tạo 2 link. ns 7/8 là của payment/tuition-paylink.
const LINK_LOCK_NS = 9
// Như link HP: QR trên ảnh phiếu có thể quét muộn nên để 1 năm.
const LINK_TTL_SECONDS = 365 * 24 * 3600

// link: QR payOS dùng được; failed: GV có payOS nhưng tạo link lỗi → phiếu rơi về VietQR và báo nhẹ.
export type PlacePayLinkResult = { link: PlacePayLink | null; failed: boolean }

export async function ensurePlacePayLink(
  db: PrismaClient, userId: number, placeId: number,
  period: { year: number; month: number }, amount: number,
  opts: { origin: string; returnPath: string }
): Promise<PlacePayLinkResult> {
  // Hết Pro / chưa nối: không tạo link mới (link đã phát vẫn nhận tiền qua webhook).
  const cfg = await activeTeacherPayos(db, userId, new Date(), "payosPlace")
  if (!cfg) return { link: null, failed: false }
  const { year, month } = period
  try {
    const link = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LINK_LOCK_NS}::int, ${placeId}::int)`
      const actives = await tx.placePayLink.findMany({ where: { placeId, year, month, status: "active" }, orderBy: { id: "desc" } })
      const same = amount > 0 ? actives.find((l) => l.amount === amount && l.payosLinkId !== "") : undefined
      // Số tiền đổi (kể cả về 0 khi đã nhận đủ bằng tay): huỷ link cũ để QR cũ không trả sai số nữa (spec AO §3.1).
      for (const old of actives) {
        if (old.id === same?.id) continue
        await tx.placePayLink.update({ where: { id: old.id }, data: { status: "cancelled" } })
        if (!old.payosLinkId) continue
        try {
          await cancelPaymentLink(cfg, old.payosLinkId)
        } catch (e) {
          console.warn(`[payos] huỷ link nơi dạy lỗi: ${e instanceof Error ? e.message : "?"}`)
        }
      }
      if (amount <= 0) return null
      if (same) return same
      const draft = await tx.placePayLink.create({
        data: { userId, placeId, year, month, amount, payosLinkId: "", qrCode: "", checkoutUrl: "" },
      })
      const url = `${opts.origin}${opts.returnPath}`
      const r = await createPaymentLink(cfg, {
        orderCode: PLACE_ORDER_OFFSET + draft.id, amount, description: `ND ${draft.id}`, returnUrl: url, cancelUrl: url,
        expiredAt: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
      })
      return tx.placePayLink.update({
        where: { id: draft.id },
        data: { payosLinkId: r.paymentLinkId, qrCode: r.qrCode, checkoutUrl: r.checkoutUrl, bankBin: r.bin, accountNumber: r.accountNumber, accountName: r.accountName },
      })
    }, TX_OPTIONS)
    return { link, failed: false }
  } catch (e) {
    // Lỗi payOS rollback cả dòng nháp → phiếu rơi về VietQR.
    console.warn(`[payos] tạo link nơi dạy lỗi: ${e instanceof Error ? e.message : "?"}`)
    return { link: null, failed: true }
  }
}
