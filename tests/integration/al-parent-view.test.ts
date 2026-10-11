import { CONSENT_ACCEPTED } from "@/lib/consent"
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { vnDateParts } from "@/lib/utils"
import { getParentView } from "@/server/services/parent-link.service"
import { getAuthedCaller } from "../helpers/trpc"

// Spec AL §4.6: HS ở nơi tính theo ca/giờ → trang PH chỉ có lịch + điểm danh, không phiếu/QR.
async function clean() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.teachingPlace.deleteMany()
}

describe("AL: trang phụ huynh theo nơi học", () => {
  beforeEach(clean)

  async function setup() {
    const caller = await getAuthedCaller()
    const home = (await caller.place.create({ name: "Lớp tại nhà", kind: "home", color: "#4F46E5", billing: "per_student" }))!
    const center = (await caller.place.create({ name: "TT Ánh Dương", kind: "center", color: "#0891B2", billing: "per_session" }))!
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const { year, month, day } = vnDateParts()
    const date = `${year}-${String(month).padStart(2, "0")}-${String(Math.max(1, day - 1)).padStart(2, "0")}`
    const make = async (name: string, placeId: number) => {
      const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: name, grade: 5, tuitionFee: 200_000, placeId })
      const s = await caller.session.create({ sessionDate: date, startTime: "06:00", endTime: "07:00", subjectId, studentIds: [st.id], placeId })
      await caller.attendance.update({ sessionId: s.id, attendances: [{ studentId: st.id, attendance: "present" }] })
      const { token } = await caller.student.generateParentLink({ id: st.id })
      return token
    }
    return { home, center, make }
  }

  it("HS ở trung tâm per_session: không có phiếu báo/QR, vẫn có điểm danh; buổi ghi tên nơi khi ≥ 2 nơi", async () => {
    const { center, make } = await setup()
    const view = await getParentView(db, await make("HS TT", center.id))
    expect(view).not.toBeNull()
    expect(view!.notice).toBeNull()
    expect(view!.teacherName).toBeTruthy()
    expect(view!.attendance).toHaveLength(1)
    expect(view!.attendance[0].placeName).toBe("TT Ánh Dương")
  })

  it("HS ở nơi theo học sinh: phiếu báo như cũ", async () => {
    const { home, make } = await setup()
    const view = await getParentView(db, await make("HS Nhà", home.id))
    expect(view!.notice).not.toBeNull()
    expect(view!.notice!.currentMonthFee).toBe(200_000)
  })

  it("GV chỉ 1 nơi: buổi không ghi tên nơi", async () => {
    const { home, center, make } = await setup()
    await db.teachingPlace.update({ where: { id: center.id }, data: { isDeleted: true } })
    const view = await getParentView(db, await make("HS Một nơi", home.id))
    expect(view!.attendance[0].placeName).toBeUndefined()
  })
})
