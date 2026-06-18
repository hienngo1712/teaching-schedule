import { describe, it, expect } from "vitest"
import { setAllAttendance } from "@/lib/attendance-state"

describe("setAllAttendance", () => {
  it("đặt tất cả về cùng trạng thái", () => {
    const state = {
      1: { studentId: 1, attendance: "pending", note: "", fee: 0 },
      2: { studentId: 2, attendance: "absent", note: "x", fee: 100 },
    }
    const next = setAllAttendance(state, "present")
    expect(next[1].attendance).toBe("present")
    expect(next[2].attendance).toBe("present")
  })

  it("KHÔNG mutate state cũ (immutability)", () => {
    const state = {
      1: { studentId: 1, attendance: "pending", note: "", fee: 0 },
    }
    const original = state[1]
    const next = setAllAttendance(state, "present")
    // object con cũ phải giữ nguyên, object mới phải khác reference
    expect(original.attendance).toBe("pending")
    expect(next[1]).not.toBe(original)
    expect(state[1]).toBe(original)
  })

  it("giữ nguyên các field khác (note, fee)", () => {
    const state = { 5: { studentId: 5, attendance: "late", note: "muộn", fee: 200 } }
    const next = setAllAttendance(state, "absent")
    expect(next[5]).toEqual({ studentId: 5, attendance: "absent", note: "muộn", fee: 200 })
  })
})
