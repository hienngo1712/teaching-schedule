// Phiếu báo theo nơi dạy + link công khai cho người trả (spec AN §1–2).
import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { assertOwnership } from "./_base.service"
import { getBankAccount } from "./settings.service"
import { computeIncome, getTimesheetMonth, incomeStatus, resolveRate, type Rate } from "./timesheet.service"
import { hashParentToken } from "@/server/crypto/parent-token"
import { monthKey } from "@/lib/billing"
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
