// Spec AN §2: trang người trả /n/<token> — chỉ đọc, không bao giờ có tên HS, 5 trường hợp 404.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ensurePlaceShareLink, getPublicPlaceNotice, rotatePlaceShareLink } from "@/server/services/place-notice.service"

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`)
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const SECRET_NAME = "Bí Mật Xyz"
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

describe("AN: trang người trả /n/<token>", () => {
  let userId: number
  let placeId: number
  let token: string

  beforeEach(async () => {
    await clean()
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5, 0, 0))) // 20/10/2026
    const caller = await getAuthedCaller()
    const u = await db.user.update({
      where: { username: "teacher" },
      data: { isActive: true, plan: "pro", planExpiresAt: new Date(Date.UTC(2027, 0, 1)), bankBin: "970436", bankAccountNumber: "0123456789", bankAccountName: "NGUYEN THU HA" },
    })
    userId = u.id
    placeId = (await caller.place.create(center))!.id
    await caller.placeRate.set({ placeId, unit: "hour", amount: 185000, fromYear: 2026, fromMonth: 10 })
    const subject = (await db.subject.findFirst({ where: { userId } }))!
    const st = await db.student.create({ data: { userId, fullName: `HS ${SECRET_NAME}`, grade: 5, placeId } })
    const base = { userId, placeId, subjectId: subject.id, startTime: time("08:00"), endTime: time("09:30") }
    await db.teachingSession.create({
      data: { ...base, sessionDate: day("2026-10-05"), title: `Lớp ${SECRET_NAME}`, sessionStudents: { create: { studentId: st.id, attendance: "present", grade: 5 } } },
    })
    await db.teachingSession.create({ data: { ...base, sessionDate: day("2026-10-07"), status: "cancelled", cancelReason: `${SECRET_NAME} ốm` } })
    token = (await ensurePlaceShareLink(db, userId, placeId)).token
  })
  afterEach(async () => {
    vi.useRealTimers()
    await db.user.update({ where: { id: userId }, data: { isActive: true, plan: "pro", planExpiresAt: new Date(Date.UTC(2099, 0, 1)), bankBin: null, bankAccountNumber: null, bankAccountName: null } })
  })

  it("token đúng: tên nơi, GV, phiếu có QR + số còn phải trả; ca chỉ có ngày/giờ/môn/số giờ/số HS có mặt; KHÔNG có tên HS", async () => {
    const view = (await getPublicPlaceNotice(db, token))!
    expect(view).toMatchObject({ placeName: "TT Ánh Dương", teacherName: "Giáo viên Test", year: 2026, month: 10 })
    expect(view.notice).toMatchObject({ remaining: 277500, doneCount: 1 })
    expect(view.notice!.qr).toMatchObject({ amount: 277500 })
    expect(view.sessions.map((s) => [s.date, s.kind, s.presentCount])).toEqual([
      ["2026-10-05", "done", 1],
      ["2026-10-07", "cancelled", 0],
    ])
    expect(Object.keys(view.sessions[0]).sort()).toEqual(["date", "end", "hours", "isMakeup", "kind", "presentCount", "start", "subject", "totalCount"])
    const json = JSON.stringify(view)
    expect(json).not.toContain(SECRET_NAME)
    expect(json).not.toMatch(/"id":/) // không lộ id nội bộ
  })

  it("404 (null): token sai / sai dạng, nơi đã xoá, nơi không còn theo ca/giờ, GV bị khoá, GV hết Plus", async () => {
    expect(await getPublicPlaceNotice(db, "A".repeat(43))).toBeNull()
    expect(await getPublicPlaceNotice(db, "khong-dung-dang")).toBeNull()

    await db.user.update({ where: { id: userId }, data: { isActive: false } })
    expect(await getPublicPlaceNotice(db, token)).toBeNull()
    await db.user.update({ where: { id: userId }, data: { isActive: true, plan: "standard", planExpiresAt: null, trialEndsAt: null } })
    expect(await getPublicPlaceNotice(db, token)).toBeNull()
    // Gia hạn là sống lại (như D9 của link PH).
    await db.user.update({ where: { id: userId }, data: { plan: "plus", planExpiresAt: new Date(Date.UTC(2027, 0, 1)) } })
    expect(await getPublicPlaceNotice(db, token)).not.toBeNull()

    const caller = await getAuthedCaller()
    await caller.place.update({ id: placeId, billing: "per_student" })
    expect(await getPublicPlaceNotice(db, token)).toBeNull()
    await caller.place.update({ id: placeId, billing: "per_session" })
    expect(await getPublicPlaceNotice(db, token)).not.toBeNull()

    await db.teachingPlace.update({ where: { id: placeId }, data: { isDeleted: true, deletedAt: new Date() } })
    expect(await getPublicPlaceNotice(db, token)).toBeNull()
  })

  it("tháng: ngoài 6 tháng hoặc sai dạng → tháng hiện tại; tháng chưa có ca đã dạy → notice null (Chưa có phiếu)", async () => {
    expect((await getPublicPlaceNotice(db, token, "2025-01"))!.month).toBe(10)
    expect((await getPublicPlaceNotice(db, token, "2026-13"))!.month).toBe(10)
    expect((await getPublicPlaceNotice(db, token, "2026-11"))!.month).toBe(10)
    // Không chặn theo ngày tạo nơi (nơi tạo hôm nay vẫn xem được tháng trước có ca).
    const apr = (await getPublicPlaceNotice(db, token, "2026-04"))!
    expect([apr.year, apr.month, apr.prevMonth, apr.nextMonth]).toEqual([2026, 4, null, "2026-05"])
    expect(apr.notice).toBeNull()
    expect((await getPublicPlaceNotice(db, token, "2026-03"))!.month).toBe(10)
  })

  it("[RF 3] tạo link mới: token cũ 404 ngay; [RF 2] đổi tên nơi / ngân hàng → trang hiện thông tin mới", async () => {
    const fresh = (await rotatePlaceShareLink(db, userId, placeId)).token
    expect(await getPublicPlaceNotice(db, token)).toBeNull()
    const caller = await getAuthedCaller()
    await caller.place.update({ id: placeId, name: "TT Ánh Dương Mới" })
    await db.user.update({ where: { id: userId }, data: { bankAccountNumber: "9999999999" } })
    const view = (await getPublicPlaceNotice(db, fresh))!
    expect(view.placeName).toBe("TT Ánh Dương Mới")
    expect(view.notice!.bank!.accountNumber).toBe("9999999999")
  })
})
