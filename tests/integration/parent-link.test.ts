import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"
import type { AttendanceStatus } from "@/lib/schemas/attendance"
import {
  getParentView,
  PARENT_TOKEN_REGEX,
} from "@/server/services/parent-link.service"

async function cleanup() {
  await db.monthlyTuition.deleteMany() // cascade xoá Payment (B)
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ data: { isActive: true } })
  await db.user.update({ where: { username: "teacher2" }, data: { fullName: "Giáo viên Test 2" } })
}

beforeEach(cleanup)
afterAll(cleanup)

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

// Ngày theo lịch VN, dạng "YYYY-MM-DD" (sessionDate lưu UTC midnight của ngày VN).
function vnDay(offset = 0): string {
  const { year, month, day } = vnDateParts()
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
}

function ym(offsetMonths = 0): string {
  const { year, month } = vnDateParts()
  const d = new Date(Date.UTC(year, month - 1 + offsetMonths, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function viewYm(v: { year: number; month: number }): string {
  return `${v.year}-${String(v.month).padStart(2, "0")}`
}

async function setup(caller: Caller, fullName = "HS Xem Link") {
  const subject = (await caller.subject.list({}))[0]
  const student = await caller.student.create({ fullName, grade: 5, tuitionFee: 100000 })
  const { token } = await caller.student.generateParentLink({ id: student.id })
  return { subject, student, token }
}

async function addSession(
  caller: Caller,
  subjectId: number,
  studentIds: number[],
  date: string,
  startTime: string,
  endTime: string,
  attendance?: AttendanceStatus
) {
  const s = await caller.session.create({ sessionDate: date, startTime, endTime, subjectId, studentIds })
  if (attendance) {
    await caller.attendance.update({
      sessionId: s.id,
      attendances: studentIds.map((studentId) => ({ studentId, attendance, fee: 100000 })),
    })
  }
  return s
}

describe("student.generateParentLink / disableParentLink", () => {
  it("tạo link → token 43 ký tự base64url, student.list trả đúng token", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Có Link", grade: 5 })
    const { token } = await caller.student.generateParentLink({ id: s.id })
    expect(token).toMatch(PARENT_TOKEN_REGEX)
    const list = await caller.student.list({ search: "HS Có Link" })
    expect(list.items[0].parentLinkToken).toBe(token)
  })

  it("tạo lại → token đổi, token cũ không còn trong DB", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Tạo Lại", grade: 5 })
    const first = await caller.student.generateParentLink({ id: s.id })
    const second = await caller.student.generateParentLink({ id: s.id })
    expect(second.token).not.toBe(first.token)
    expect(await db.student.findUnique({ where: { parentLinkToken: first.token } })).toBeNull()
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBe(second.token)
  })

  it("tắt link → parentLinkToken = null", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Tắt Link", grade: 5 })
    await caller.student.generateParentLink({ id: s.id })
    expect(await caller.student.disableParentLink({ id: s.id })).toEqual({ success: true })
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBeNull()
  })

  it("HS của user khác → NOT_FOUND cho cả tạo và tắt, token giữ nguyên", async () => {
    const owner = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const s = await owner.student.create({ fullName: "HS Của Người Khác", grade: 5 })
    const { token } = await owner.student.generateParentLink({ id: s.id })
    await expect(other.student.generateParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.student.disableParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBe(token)
  })

  it("chưa đăng nhập → UNAUTHORIZED", async () => {
    await expect(publicCaller.student.generateParentLink({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    await expect(publicCaller.student.disableParentLink({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})

describe("getParentView", () => {
  it("token cũ sau khi tạo lại, token đã tắt, sai dạng, không tồn tại → đều null như nhau", async () => {
    const caller = await getAuthedCaller()
    const { student, token: oldToken } = await setup(caller)
    expect(await getParentView(db, oldToken)).not.toBeNull()

    const { token: newToken } = await caller.student.generateParentLink({ id: student.id })
    expect(await getParentView(db, oldToken)).toBeNull()
    expect(await getParentView(db, newToken)).not.toBeNull()

    await caller.student.disableParentLink({ id: student.id })
    expect(await getParentView(db, newToken)).toBeNull()

    for (const bad of ["", "abc", "a".repeat(42) + "/", "a".repeat(44), "A".repeat(43)]) {
      expect(await getParentView(db, bad)).toBeNull()
    }
    expect(PARENT_TOKEN_REGEX.test("a".repeat(42) + "/")).toBe(false)
  })

  it("chỉ chứa dữ liệu của HS này: không lộ HS khác, SĐT, ghi chú, tiêu đề ca; mọi note lần thu = null", async () => {
    const caller = await getAuthedCaller()
    const subject = (await caller.subject.list({}))[0]
    const a = await caller.student.create({
      fullName: "HS An Riêng", grade: 5, tuitionFee: 100000,
      parentPhone: "0909111222", parentName: "PH Bí Mật", notes: "GhiChuHSBiMat",
    })
    const b = await caller.student.create({ fullName: "HS Bình Khác", grade: 5, tuitionFee: 100000 })
    const s = await caller.session.create({
      sessionDate: vnDay(0), startTime: "06:00", endTime: "07:00", subjectId: subject.id,
      studentIds: [a.id, b.id], title: "TieuDeCaBiMat", notes: "GhiChuCaBiMat",
    })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [
        { studentId: a.id, attendance: "present", fee: 100000, note: "GhiChuDiemDanhBiMat" },
        { studentId: b.id, attendance: "absent", fee: 100000 },
      ],
    })
    const { year, month } = vnDateParts()
    // Đối chiếu input thật của B trong .superpowers/g-bc-interfaces.md
    await caller.payment.create({
      studentId: a.id, year, month, amount: 50000, paidAt: vnDay(0), method: "cash", note: "GhiChuLanThuBiMat",
    })
    await caller.tuition.updateSettlement({ studentId: a.id, year, month, isFullPaid: false, notes: "GhiChuThangBiMat" })
    const { token } = await caller.student.generateParentLink({ id: a.id })

    const view = await getParentView(db, token)
    expect(view).not.toBeNull()
    expect(Object.keys(view!).sort()).toEqual(
      ["attendance", "month", "nextMonth", "notice", "prevMonth", "student", "upcoming", "year"]
    )
    expect(Object.keys(view!.student).sort()).toEqual(["fullName", "grade"])
    expect(view!.attendance).toHaveLength(1)
    expect(Object.keys(view!.attendance[0]).sort()).toEqual(
      ["attendance", "date", "endTime", "startTime", "subjectName"]
    )
    expect(view!.attendance[0].attendance).toBe("present")
    expect(view!.notice.payments.length).toBeGreaterThan(0)
    for (const p of view!.notice.payments) expect(p.note).toBeNull()
    // Không lộ id nội bộ: studentId đặt về 0, payment.id thay bằng chỉ số (0..n-1).
    expect(view!.notice.studentId).toBe(0)
    expect(view!.notice.payments.map((p) => p.id)).toEqual(
      view!.notice.payments.map((_, i) => i)
    )

    const json = JSON.stringify(view)
    const realPaymentIds = (await caller.payment.list({ studentId: a.id, year, month })).map((p) => p.id)
    for (const secret of [
      "HS Bình Khác", "0909111222", "PH Bí Mật", "GhiChuHSBiMat", "TieuDeCaBiMat", "GhiChuCaBiMat",
      "GhiChuDiemDanhBiMat", "GhiChuLanThuBiMat", "GhiChuThangBiMat",
      '"userId"', '"parentLinkToken"', '"passwordHash"', '"parentPhone"', token,
      `"studentId":${a.id}`,
      ...realPaymentIds.map((id) => `"id":${id}`),
    ]) {
      expect(json, `RSC payload lộ: ${secret}`).not.toContain(secret)
    }
  })

  it("giáo viên chưa đặt họ tên → teacherName 'Giáo viên', không lộ tên đăng nhập", async () => {
    const caller = await getAuthedCaller("teacher2")
    const { token } = await setup(caller)
    await db.user.update({ where: { username: "teacher2" }, data: { fullName: null } })
    const view = await getParentView(db, token)
    expect(view!.notice.teacherName).toBe("Giáo viên")
    expect(JSON.stringify(view)).not.toContain('"teacher2"')
  })

  it("điểm danh tháng: bỏ ca huỷ, đủ 4 trạng thái, sắp theo giờ, có mặt+muộn = presentSessions của phiếu", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    const today = vnDay(0)
    await addSession(caller, subject.id, [student.id], today, "09:00", "09:30", "present")
    await addSession(caller, subject.id, [student.id], today, "07:00", "07:30", "late")
    await addSession(caller, subject.id, [student.id], today, "11:00", "11:30", "absent")
    await addSession(caller, subject.id, [student.id], today, "13:00", "13:30")
    const cancelled = await addSession(caller, subject.id, [student.id], today, "15:00", "15:30", "present")
    await db.teachingSession.update({ where: { id: cancelled.id }, data: { status: "cancelled" } })

    const view = (await getParentView(db, token))!
    expect(view.attendance.map((r) => r.startTime)).toEqual(["07:00", "09:00", "11:00", "13:00"])
    expect(view.attendance.map((r) => r.attendance)).toEqual(["late", "present", "absent", "pending"])
    expect(view.attendance.every((r) => r.date === today && r.subjectName === subject.name)).toBe(true)
    expect(view.attendance[0].endTime).toBe("07:30")
    const attended = view.attendance.filter((r) => r.attendance === "present" || r.attendance === "late").length
    expect(attended).toBe(2)
    expect(view.notice.presentSessions).toBe(attended)
  })

  it("lịch sắp tới: bỏ ca quá khứ và ca huỷ, tối đa 10, sắp theo ngày rồi giờ", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    await addSession(caller, subject.id, [student.id], vnDay(-1), "06:00", "07:00")
    for (let i = 1; i <= 11; i++) {
      await addSession(caller, subject.id, [student.id], vnDay(i), "18:00", "19:00")
    }
    await addSession(caller, subject.id, [student.id], vnDay(1), "08:00", "09:00") // tạo sau nhưng giờ sớm hơn
    const cancelled = await addSession(caller, subject.id, [student.id], vnDay(2), "10:00", "11:00")
    await db.teachingSession.update({ where: { id: cancelled.id }, data: { status: "cancelled" } })

    const { upcoming } = (await getParentView(db, token))!
    expect(upcoming).toHaveLength(10)
    expect(upcoming[0]).toMatchObject({ date: vnDay(1), startTime: "08:00" })
    expect(upcoming[1]).toMatchObject({ date: vnDay(1), startTime: "18:00" })
    expect(upcoming.map((u) => u.date)).not.toContain(vnDay(-1))
    expect(upcoming.some((u) => u.startTime === "10:00")).toBe(false)
    const keys = upcoming.map((u) => `${u.date} ${u.startTime}`)
    expect(keys).toEqual([...keys].sort())
  })

  it("'hôm nay' tính theo giờ VN: 01:00 sáng VN (UTC còn là hôm qua) thì không hiện ca hôm qua", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    const d = vnDay(30)
    const prev = vnDay(29)
    await addSession(caller, subject.id, [student.id], prev, "18:00", "19:00")
    await addSession(caller, subject.id, [student.id], d, "18:00", "19:00")

    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(Date.parse(`${d}T00:00:00Z`) - 6 * 60 * 60 * 1000)) // = 01:00 ngày d giờ VN
    try {
      const view = (await getParentView(db, token))!
      expect(view.upcoming.map((u) => u.date)).toEqual([d])
    } finally {
      vi.useRealTimers()
    }
  })

  it("tháng: rỗng/sai dạng/ngoài khoảng/tương lai → tháng hiện tại; HS mới tạo → không có tháng trước/sau", async () => {
    const caller = await getAuthedCaller()
    const { token } = await setup(caller)
    for (const thang of [undefined, "", "2020-01", "2026-13", "2026-9", "2026-09-01", ym(1), ym(-1)]) {
      const v = (await getParentView(db, token, thang))!
      expect(viewYm(v), `thang=${String(thang)}`).toBe(ym(0))
    }
    const v = (await getParentView(db, token))!
    expect(v.prevMonth).toBeNull()
    expect(v.nextMonth).toBeNull()
  })

  it("HS cũ: xem được đúng 12 tháng, tháng thứ 13 về tháng hiện tại", async () => {
    const caller = await getAuthedCaller()
    const { student, token } = await setup(caller)
    await db.student.update({ where: { id: student.id }, data: { createdAt: new Date("2020-01-01T00:00:00Z") } })

    const oldest = (await getParentView(db, token, ym(-11)))!
    expect(viewYm(oldest)).toBe(ym(-11))
    expect(oldest.prevMonth).toBeNull()
    expect(oldest.nextMonth).toBe(ym(-10))
    expect(viewYm((await getParentView(db, token, ym(-12)))!)).toBe(ym(0))

    const current = (await getParentView(db, token))!
    expect(current.prevMonth).toBe(ym(-1))
    expect(current.nextMonth).toBeNull()

    let count = 1
    let p = current.prevMonth
    while (p) {
      count++
      p = (await getParentView(db, token, p))!.prevMonth
    }
    expect(count).toBe(12)
  }, 180000)

  it("tháng nhỏ nhất theo giờ VN: HS tạo 04:00 ngày 1 giờ VN (UTC còn tháng trước) → không có tháng trước", async () => {
    const caller = await getAuthedCaller()
    const { student, token } = await setup(caller)
    const { year, month } = vnDateParts()
    await db.student.update({
      where: { id: student.id },
      data: { createdAt: new Date(Date.UTC(year, month - 1, 1) - 3 * 60 * 60 * 1000) },
    })
    const v = (await getParentView(db, token, ym(-1)))!
    expect(viewYm(v)).toBe(ym(0))
    expect(v.prevMonth).toBeNull()
  })

  it("HS đã nghỉ vẫn xem được (lịch sắp tới rỗng); giáo viên bị khoá → null", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    await addSession(caller, subject.id, [student.id], vnDay(3), "18:00", "19:00")
    await caller.student.delete({ id: student.id }) // softDelete gỡ HS khỏi ca chưa kết thúc

    const view = await getParentView(db, token)
    expect(view).not.toBeNull()
    expect(view!.upcoming).toEqual([])

    await db.user.update({ where: { username: "teacher" }, data: { isActive: false } })
    expect(await getParentView(db, token)).toBeNull()
  })

  it("chỉ đọc: xem tháng hiện tại và tháng chưa mở không tạo MonthlyTuition/Payment, không sửa Student", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    await db.student.update({ where: { id: student.id }, data: { createdAt: new Date("2020-01-01T00:00:00Z") } })
    await addSession(caller, subject.id, [student.id], vnDay(0), "06:00", "07:00", "present")

    const before = {
      mt: await db.monthlyTuition.count(),
      pay: await db.payment.count(),
      updatedAt: (await db.student.findUniqueOrThrow({ where: { id: student.id } })).updatedAt.getTime(),
    }
    await getParentView(db, token)
    await getParentView(db, token, ym(-3))
    expect({
      mt: await db.monthlyTuition.count(),
      pay: await db.payment.count(),
      updatedAt: (await db.student.findUniqueOrThrow({ where: { id: student.id } })).updatedAt.getTime(),
    }).toEqual(before)
  })
})
