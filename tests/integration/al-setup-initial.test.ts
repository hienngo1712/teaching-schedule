import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

// Spec AL §5: popup đăng ký tạo nơi theo ô tick; đã có nơi thì bỏ qua.
describe("place.setupInitial", () => {
  beforeEach(async () => {
    await db.student.deleteMany()
    await db.teachingPlace.deleteMany()
  })

  it("tick Lớp tại nhà + Trung tâm (2 tên, 1 trống) → đúng nơi, đúng cách tính", async () => {
    const caller = await getAuthedCaller()
    const list = await caller.place.setupInitial({ home: true, tutor: false, centers: ["TT Ánh Dương", "  "] })
    expect(list.map((p) => [p.name, p.kind, p.billing])).toEqual([
      ["Lớp tại nhà", "home", "per_student"],
      ["TT Ánh Dương", "center", "per_session"],
      ["Trung tâm", "center", "per_session"],
    ])
  })

  it("chỉ Gia sư; 2 trung tâm cùng để trống → Trung tâm, Trung tâm 2", async () => {
    const caller = await getAuthedCaller()
    const list = await caller.place.setupInitial({ home: false, tutor: true, centers: ["", ""] })
    expect(list.map((p) => p.name)).toEqual(["Gia sư", "Trung tâm", "Trung tâm 2"])
  })

  it("không tick gì → Lớp tại nhà", async () => {
    const caller = await getAuthedCaller()
    const list = await caller.place.setupInitial({ home: false, tutor: false, centers: [] })
    expect(list.map((p) => [p.name, p.billing])).toEqual([["Lớp tại nhà", "per_student"]])
  })

  // [RF 3] bấm đúp / 2 tab
  it("gọi 2 lần song song → chỉ tạo 1 bộ nơi; gọi lần 3 khi đã có nơi → không tạo thêm", async () => {
    const caller = await getAuthedCaller()
    const input = { home: true, tutor: true, centers: ["TT A"] }
    await Promise.all([caller.place.setupInitial(input), caller.place.setupInitial(input)])
    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(await db.teachingPlace.count({ where: { userId: user.id } })).toBe(3)
    await caller.place.setupInitial({ home: false, tutor: false, centers: ["TT B"] })
    expect(await db.teachingPlace.count({ where: { userId: user.id } })).toBe(3)
  })
})
