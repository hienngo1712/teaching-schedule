// Spec AN §1: phiếu báo theo nơi dạy (service) + link công khai cho người trả.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import {
  disablePlaceShareLink,
  ensurePlaceShareLink,
  getPlaceNotice,
  markPlaceNoticeSent,
  rotatePlaceShareLink,
} from "@/server/services/place-notice.service"
import { ENC_PREFIX } from "@/server/crypto/field-crypto"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const center = { name: "TT Ánh Dương", kind: "center" as const, color: "#0891B2", billing: "per_session" as const }

async function clean() {
  await db.placeMonthNotice.deleteMany()
  await db.placeShareLink.deleteMany()
  await db.placePayment.deleteMany()
  await db.placeRateChange.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

async function addSession(userId: number, placeId: number, date: string, opts: { status?: string; makeupOfId?: number } = {}) {
  const subject = (await db.subject.findFirst({ where: { userId } })) ?? (await db.subject.create({ data: { userId, name: "Toán", color: "#000000" } }))
  return db.teachingSession.create({
    data: {
      userId, placeId, subjectId: subject.id, sessionDate: day(date),
      startTime: time("08:00"), endTime: time("09:30"), status: opts.status ?? "scheduled", makeupOfId: opts.makeupOfId,
    },
  })
}

describe("AN: phiếu báo theo nơi dạy (service)", () => {
  let userId: number
  let placeId: number

  beforeEach(async () => {
    await clean()
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5, 0, 0))) // 20/10/2026
    const caller = await getAuthedCaller()
    const u = await db.user.update({ where: { username: "teacher" }, data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } })
    userId = u.id
    placeId = (await caller.place.create(center))!.id
    await caller.placeRate.set({ placeId, unit: "hour", amount: 185000, fromYear: 2026, fromMonth: 10 })
    await addSession(userId, placeId, "2026-10-05")
    const cancelled = await addSession(userId, placeId, "2026-10-08", { status: "cancelled" })
    await addSession(userId, placeId, "2026-10-12", { makeupOfId: cancelled.id })
    await addSession(userId, placeId, "2026-10-25") // chưa dạy
    await caller.placePayment.create({ placeId, year: 2026, month: 10, amount: 100000, receivedAt: "2026-10-15" })
  })
  afterEach(() => vi.useRealTimers())

  it("số liệu khớp income.detail; liệt kê ngày đã dạy (bù) và ngày huỷ; không ngân hàng → không QR", async () => {
    const caller = await getAuthedCaller()
    const n = await getPlaceNotice(db, userId, placeId, 2026, 10)
    const detail = await caller.income.detail({ placeId, year: 2026, month: 10 })
    expect(n.expected).toBe(detail.expected)
    expect(n).toMatchObject({
      place: { id: placeId, name: "TT Ánh Dương" },
      teacherName: "Giáo viên Test",
      subjects: ["Tiếng Anh"], // môn seed của teacher
      doneDates: [
        { date: "2026-10-05", isMakeup: false },
        { date: "2026-10-12", isMakeup: true },
      ],
      cancelledDates: ["2026-10-08"],
      doneCount: 2,
      doneHours: 3,
      rate: { unit: "hour", amount: 185000 },
      expected: 555000,
      received: 100000,
      remaining: 455000,
      sentAt: null,
      amountChanged: false,
    })
    expect(n.bank).toBeUndefined()
    expect(n.qr).toBeNull()
  })

  it("có ngân hàng → QR đúng số còn phải trả; nội dung CK không dấu, ≤ 25 ký tự", async () => {
    await db.user.update({ where: { id: userId }, data: { bankBin: "970436", bankAccountNumber: "0123456789", bankAccountName: "NGUYEN THU HA" } })
    const n = await getPlaceNotice(db, userId, placeId, 2026, 10)
    expect(n.bank).toMatchObject({ bankShortName: "Vietcombank", accountNumber: "0123456789", accountName: "NGUYEN THU HA" })
    expect(n.qr).toMatchObject({ amount: 455000, content: n.transferContent })
    expect(n.transferContent).toMatch(/^GV Test T10 TT Anh Duong/)
    expect(n.transferContent.length).toBeLessThanOrEqual(25)
    expect(n.transferContent).toMatch(/^[A-Za-z0-9 ]+$/)
  })

  it("đánh dấu đã gửi rồi thêm 1 ca đã dạy → amountChanged; bỏ đánh dấu", async () => {
    await markPlaceNoticeSent(db, userId, placeId, 2026, 10, true)
    let n = await getPlaceNotice(db, userId, placeId, 2026, 10)
    expect(n.sentAt).toBeInstanceOf(Date)
    expect(n).toMatchObject({ sentAmount: 455000, amountChanged: false })
    await addSession(userId, placeId, "2026-10-19")
    n = await getPlaceNotice(db, userId, placeId, 2026, 10)
    expect(n.amountChanged).toBe(true)
    await markPlaceNoticeSent(db, userId, placeId, 2026, 10, false)
    expect((await getPlaceNotice(db, userId, placeId, 2026, 10)).sentAt).toBeNull()
  })

  it("[RF 1] tháng 0 ca đã dạy / nơi chưa có đơn giá → BAD_REQUEST notice_empty", async () => {
    await expect(getPlaceNotice(db, userId, placeId, 2026, 9)).rejects.toMatchObject({ code: "BAD_REQUEST", message: "notice_empty" })
    const caller = await getAuthedCaller()
    const noRate = (await caller.place.create({ ...center, name: "TT Sao Mai" }))!
    await addSession(userId, noRate.id, "2026-10-05")
    await expect(getPlaceNotice(db, userId, noRate.id, 2026, 10)).rejects.toMatchObject({ code: "BAD_REQUEST", message: "notice_empty" })
  })

  it("nơi của user khác → NOT_FOUND", async () => {
    const other = await db.user.findUniqueOrThrow({ where: { username: "teacher2" } })
    await expect(getPlaceNotice(db, other.id, placeId, 2026, 10)).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(ensurePlaceShareLink(db, other.id, placeId)).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("link người trả: token 256-bit giữ nguyên khi gọi lại; DB lưu hash + token mã hoá; tạo mới đổi token; tắt thì mất", async () => {
    const a = await ensurePlaceShareLink(db, userId, placeId)
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a.path).toBe(`/n/${a.token}`)
    expect((await ensurePlaceShareLink(db, userId, placeId)).token).toBe(a.token)
    // Alias khác tên trường mã hoá: $queryRaw cũng qua extension, cột tên "token" sẽ bị giải mã khi đọc.
    const raw = await db.$queryRaw<{ tok: string; token_hash: string }[]>`SELECT token AS tok, token_hash FROM place_share_links WHERE place_id = ${placeId}`
    expect(raw[0].tok.startsWith(ENC_PREFIX)).toBe(true)
    expect(raw[0].token_hash).toMatch(/^[0-9a-f]{64}$/)
    const b = await rotatePlaceShareLink(db, userId, placeId)
    expect(b.token).not.toBe(a.token)
    await disablePlaceShareLink(db, userId, placeId)
    expect(await db.placeShareLink.count({ where: { placeId } })).toBe(0)
  })
})

describe("AN: router placeNotice + trạng thái phiếu ở Thu nhập", () => {
  beforeEach(async () => {
    await clean()
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5, 0, 0)))
  })
  afterEach(() => vi.useRealTimers())

  it("get/link/markSent; income.month có noticeStatus none → sent → changed; Standard → FORBIDDEN", async () => {
    const caller = await getAuthedCaller()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const p = (await caller.place.create(center))!
    await caller.placeRate.set({ placeId: p.id, unit: "session", amount: 200000, fromYear: 2026, fromMonth: 10 })
    await addSession(u.id, p.id, "2026-10-05")

    const n = await caller.placeNotice.get({ placeId: p.id, year: 2026, month: 10 })
    expect(n).toMatchObject({ placeName: "TT Ánh Dương", remaining: 200000, sentAt: null, amountChanged: false })
    expect((await caller.income.month({ year: 2026, month: 10 }))[0]).toMatchObject({ noticeStatus: "none", noticeSentAt: null })

    const link = await caller.placeNotice.link({ placeId: p.id })
    expect(link.path).toMatch(/^\/n\/[A-Za-z0-9_-]{43}$/)
    await caller.placeNotice.markSent({ placeId: p.id, year: 2026, month: 10, sent: true })
    expect((await caller.income.month({ year: 2026, month: 10 }))[0].noticeStatus).toBe("sent")
    await addSession(u.id, p.id, "2026-10-06")
    expect((await caller.income.month({ year: 2026, month: 10 }))[0].noticeStatus).toBe("changed")
    const rotated = await caller.placeNotice.rotate({ placeId: p.id })
    expect(rotated.token).not.toBe(link.token)
    await caller.placeNotice.disable({ placeId: p.id })

    const std = await getAuthedCaller("teacher_std")
    const sp = (await std.place.create(center))!
    await expect(std.placeNotice.get({ placeId: sp.id, year: 2026, month: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(std.placeNotice.link({ placeId: sp.id })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(std.placeNotice.markSent({ placeId: sp.id, year: 2026, month: 10, sent: true })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
