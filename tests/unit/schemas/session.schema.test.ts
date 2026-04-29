import { describe, it, expect } from "vitest"
import { sessionCreateSchema } from "@/lib/schemas/session"

describe("sessionCreateSchema", () => {
  it("✓ accept valid session với subjectId", () => {
    expect(() =>
      sessionCreateSchema.parse({
        sessionDate: "2026-04-10",
        startTime: "08:00",
        endTime: "09:30",
        subjectId: 1,
      })
    ).not.toThrow()
  })

  it("✗ reject endTime <= startTime", () => {
    expect(() =>
      sessionCreateSchema.parse({
        sessionDate: "2026-04-10",
        startTime: "08:00",
        endTime: "07:30",
        subjectId: 1,
      })
    ).toThrow()
  })

  it("✗ reject equal times (08:00–08:00)", () => {
    expect(() =>
      sessionCreateSchema.parse({
        sessionDate: "2026-04-10",
        startTime: "08:00",
        endTime: "08:00",
        subjectId: 1,
      })
    ).toThrow()
  })

  it("✗ reject thiếu subjectId", () => {
    expect(() =>
      sessionCreateSchema.parse({
        sessionDate: "2026-04-10",
        startTime: "08:00",
        endTime: "09:30",
      })
    ).toThrow()
  })

  it("✗ reject sessionDate sai format", () => {
    expect(() =>
      sessionCreateSchema.parse({
        sessionDate: "10/04/2026",
        startTime: "08:00",
        endTime: "09:30",
        subjectId: 1,
      })
    ).toThrow()
  })

  it("✓ accept optional studentIds", () => {
    expect(() =>
      sessionCreateSchema.parse({
        sessionDate: "2026-04-10",
        startTime: "08:00",
        endTime: "09:30",
        subjectId: 1,
        studentIds: [1, 2, 3],
      })
    ).not.toThrow()
  })
})
