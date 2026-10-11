// Phiếu báo theo nơi dạy + link công khai cho người trả (spec AN §1–2).
import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { assertOwnership } from "./_base.service"
import { getBankAccount } from "./settings.service"
import { computeIncome, getTimesheetMonth, incomeStatus, resolveRate, type Rate } from "./timesheet.service"
import { hashParentToken } from "@/server/crypto/parent-token"
import { monthKey, resolvePlaceBilling } from "@/lib/billing"
import { effectivePlan, hasFeature } from "@/lib/plans"
import { vnDateParts } from "@/lib/utils"
import { buildPlaceTransferContent, buildVietQrPayload } from "@/lib/vietqr"
import { findBank } from "@/lib/vn-banks"

// Cùng dạng token với link phụ huynh: 32 byte base64url = 43 ký tự.
export const PLACE_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/

export type PlaceNotice = {
  place: { id: number; name: string; color: string }
  year: number
  month: number
  teacherName: string
  subjects: string[]
  doneDates: { date: string; isMakeup: boolean }[]
  cancelledDates: string[]
  doneCount: number
  doneHours: number
  rate: Rate
  expected: number
  received: number
  remaining: number
  status: ReturnType<typeof incomeStatus>
  bank?: { bankShortName: string; accountNumber: string; accountName: string }
  transferContent: string
  qr: { payload: string; amount: number; content: string } | null
  createdAt: string
  sentAt: Date | null
  sentAmount: number | null
  amountChanged: boolean
}

const emptyNotice = () => new TRPCError({ code: "BAD_REQUEST", message: "notice_empty" })

export async function getPlaceNotice(db: PrismaClient, userId: number, placeId: number, year: number, month: number): Promise<PlaceNotice> {
  // getTimesheetMonth kiểm chủ sở hữu (NOT_FOUND) và trả ca của nơi trong tháng.
  const ts = await getTimesheetMonth(db, userId, { placeId, year, month })
  const [rates, payments, sent, bank, user] = await Promise.all([
    db.placeRateChange.findMany({ where: { placeId }, select: { fromKey: true, unit: true, amount: true } }),
    db.placePayment.aggregate({ where: { placeId, year, month, isDeleted: false }, _sum: { amount: true } }),
    db.placeMonthNotice.findUnique({ where: { placeId_year_month: { placeId, year, month } } }),
    getBankAccount(db, userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true } }),
  ])
  const rate = resolveRate(rates, monthKey(year, month))
  const { doneCount, doneHours } = ts.stats
  // Review Focus 1: 0 ca đã dạy hoặc chưa có đơn giá → không có phiếu.
  if (!rate || doneCount === 0) throw emptyNotice()

  const done = ts.sessions.filter((s) => s.kind === "done")
  const expected = computeIncome({ doneCount, doneHours, rate })!
  const received = payments._sum.amount ?? 0
  const remaining = Math.max(0, expected - received)
  // Trang công khai: không lộ tên đăng nhập khi GV chưa nhập họ tên.
  const teacherName = user.fullName || "Giáo viên"
  const transferContent = buildPlaceTransferContent(teacherName, month, ts.place!.name)
  // BIN không còn trong danh sách ngân hàng → coi như chưa cài để không tạo QR sai.
  const bankInfo = bank ? findBank(bank.bankBin) : undefined
  const sentAmount = sent?.sentAmount ?? null

  return {
    place: ts.place!,
    year,
    month,
    teacherName,
    subjects: [...new Set(done.map((s) => s.subject))],
    doneDates: done.map((s) => ({ date: s.date, isMakeup: s.isMakeup })),
    cancelledDates: ts.sessions.filter((s) => s.kind === "cancelled").map((s) => s.date),
    doneCount,
    doneHours,
    rate,
    expected,
    received,
    remaining,
    status: incomeStatus(expected, received),
    ...(bank && bankInfo
      ? { bank: { bankShortName: bankInfo.shortName, accountNumber: bank.bankAccountNumber, accountName: bank.bankAccountName } }
      : {}),
    transferContent,
    qr:
      bank && bankInfo && remaining > 0
        ? {
            payload: buildVietQrPayload({ bin: bankInfo.bin, accountNumber: bank.bankAccountNumber, amount: remaining, content: transferContent }),
            amount: remaining,
            content: transferContent,
          }
        : null,
    createdAt: new Date().toISOString(),
    sentAt: sent?.sentAt ?? null,
    sentAmount,
    // Như phiếu HS: đã trả hết thì không nhắc gửi lại.
    amountChanged: sent !== null && remaining !== sentAmount && remaining !== 0,
  }
}

export async function markPlaceNoticeSent(db: PrismaClient, userId: number, placeId: number, year: number, month: number, sent: boolean) {
  if (!sent) {
    const place = await db.teachingPlace.findFirst({ where: { id: placeId }, select: { userId: true } })
    assertOwnership(place, userId)
    await db.placeMonthNotice.deleteMany({ where: { placeId, year, month } })
    return { sentAt: null, sentAmount: null }
  }
  const notice = await getPlaceNotice(db, userId, placeId, year, month)
  const now = new Date()
  await db.placeMonthNotice.upsert({
    where: { placeId_year_month: { placeId, year, month } },
    create: { placeId, year, month, sentAt: now, sentAmount: notice.remaining },
    update: { sentAt: now, sentAmount: notice.remaining },
  })
  return { sentAt: now, sentAmount: notice.remaining }
}

async function assertActivePlace(db: PrismaClient, userId: number, placeId: number) {
  const place = await db.teachingPlace.findFirst({ where: { id: placeId, isDeleted: false }, select: { userId: true } })
  assertOwnership(place, userId)
}

async function createLink(db: PrismaClient, placeId: number) {
  // Trùng hash gần như không thể nên chỉ thử lại 1 lần (như generateParentLink).
  for (let attempt = 0; ; attempt++) {
    const token = randomBytes(32).toString("base64url")
    try {
      // 1 lệnh upsert: đi qua extension mã hoá (token lưu dạng enc:v1:…), ghi đè = link cũ chết ngay.
      const data = { token, tokenHash: hashParentToken(token), createdAt: new Date() }
      await db.placeShareLink.upsert({ where: { placeId }, create: { placeId, ...data }, update: data })
      return { token, path: `/n/${token}` }
    } catch (e) {
      const isDuplicate = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
      if (!isDuplicate || attempt > 0) throw e
    }
  }
}

// Có link rồi thì dùng lại (token đọc ra đã giải mã); chưa có thì tạo.
export async function ensurePlaceShareLink(db: PrismaClient, userId: number, placeId: number) {
  await assertActivePlace(db, userId, placeId)
  const existing = await db.placeShareLink.findUnique({ where: { placeId }, select: { token: true } })
  if (existing) return { token: existing.token, path: `/n/${existing.token}` }
  return createLink(db, placeId)
}

// Tạo link mới: link cũ 404 ngay (Review Focus 3).
export async function rotatePlaceShareLink(db: PrismaClient, userId: number, placeId: number) {
  await assertActivePlace(db, userId, placeId)
  return createLink(db, placeId)
}

export async function disablePlaceShareLink(db: PrismaClient, userId: number, placeId: number) {
  await assertActivePlace(db, userId, placeId)
  await db.placeShareLink.deleteMany({ where: { placeId } })
  return { success: true as const }
}

// ── Trang người trả /n/<token> (spec AN §2) ─────────────────────────────────

// Dữ liệu thẻ phiếu dùng chung cho hộp phiếu (GV) và trang người trả: không id nội bộ, không trạng thái gửi.
export type PlaceNoticeCardData = Omit<PlaceNotice, "place" | "sentAt" | "sentAmount" | "amountChanged" | "status"> & { placeName: string }

export function toNoticeCard(n: PlaceNotice): PlaceNoticeCardData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bỏ các trường nội bộ/trạng thái gửi
  const { place, sentAt, sentAmount, amountChanged, status, ...rest } = n
  return { ...rest, placeName: place.name }
}

export type PayerSession = {
  date: string
  start: string
  end: string
  subject: string
  hours: number
  presentCount: number
  // Số HS của ca (chỉ là số): ca chưa gắn HS thì không ghi "0 HS có mặt".
  totalCount: number
  kind: "done" | "upcoming" | "cancelled"
  isMakeup: boolean
}

export type PayerViewDTO = {
  placeName: string
  teacherName: string
  year: number
  month: number
  prevMonth: string | null
  nextMonth: string | null
  notice: PlaceNoticeCardData | null
  sessions: PayerSession[]
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
// Tối đa 6 tháng về trước (spec AN §2).
const PAYER_MONTHS_BACK = 6
const toIdx = (year: number, month: number) => year * 12 + (month - 1)
const toYm = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`

// Chỉ đọc. null = 404 như token sai: token sai, nơi đã xoá, nơi không còn theo ca/giờ, GV bị khoá/xoá, GV hết gói Plus.
export async function getPublicPlaceNotice(db: PrismaClient, token: string, thang?: string): Promise<PayerViewDTO | null> {
  if (!PLACE_TOKEN_REGEX.test(token)) return null
  const link = await db.placeShareLink.findUnique({
    where: { tokenHash: hashParentToken(token) },
    select: {
      place: {
        select: {
          id: true,
          name: true,
          isDeleted: true,
          createdAt: true,
          billingChanges: { select: { fromKey: true, billing: true } },
          user: { select: { id: true, isActive: true, isDeleted: true, fullName: true, plan: true, planExpiresAt: true, trialEndsAt: true } },
        },
      },
    },
  })
  const place = link?.place
  if (!place || place.isDeleted) return null
  const { user } = place
  if (!user.isActive || user.isDeleted) return null
  // Như D9 của link PH: hết gói thì tạm 404, token giữ nguyên để gia hạn là sống lại.
  if (!hasFeature(effectivePlan(user, new Date()).plan, "placeNotice")) return null
  const now = vnDateParts()
  if (resolvePlaceBilling(place.billingChanges, monthKey(now.year, now.month)) !== "per_session") return null

  const maxIdx = toIdx(now.year, now.month)
  const created = vnDateParts(place.createdAt)
  const minIdx = Math.max(maxIdx - PAYER_MONTHS_BACK, toIdx(created.year, created.month))
  let idx = maxIdx
  if (thang && MONTH_REGEX.test(thang)) {
    const [y, m] = thang.split("-").map(Number)
    if (toIdx(y, m) >= minIdx && toIdx(y, m) <= maxIdx) idx = toIdx(y, m)
  }
  const year = Math.floor(idx / 12)
  const month = (idx % 12) + 1

  let notice: PlaceNoticeCardData | null = null
  try {
    notice = toNoticeCard(await getPlaceNotice(db, user.id, place.id, year, month))
  } catch (e) {
    // Review Focus 1: tháng chưa có ca đã dạy / chưa có giá → "Chưa có phiếu".
    if (!(e instanceof TRPCError && e.message === "notice_empty")) throw e
  }
  const ts = await getTimesheetMonth(db, user.id, { placeId: place.id, year, month })

  return {
    placeName: place.name,
    teacherName: user.fullName || "Giáo viên",
    year,
    month,
    prevMonth: idx > minIdx ? toYm(idx - 1) : null,
    nextMonth: idx < maxIdx ? toYm(idx + 1) : null,
    notice,
    // Không có tiêu đề ca / lý do huỷ: GV có thể gõ tên HS vào đó. Chỉ số HS có mặt.
    sessions: ts.sessions.map((s) => ({
      date: s.date,
      start: s.start,
      end: s.end,
      subject: s.subject,
      hours: s.hours,
      presentCount: s.presentCount,
      totalCount: s.totalCount,
      kind: s.kind,
      isMakeup: s.isMakeup,
    })),
  }
}
