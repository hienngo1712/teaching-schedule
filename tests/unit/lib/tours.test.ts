import { describe, it, expect } from "vitest"
import vi from "@/language/vi.json"
import en from "@/language/en.json"
import { GUIDE_TOURS, MISSING_STEPS, TOURS, parseTourParam, tourHref, type TourStep } from "@/lib/tours"

const ALL_STEPS: TourStep[] = [...Object.values(TOURS).flatMap((t) => t.steps), ...Object.values(MISSING_STEPS)]

describe("tours", () => {
  it("đủ 6 tour, id khớp khoá, href đúng trang", () => {
    expect(Object.keys(TOURS).sort()).toEqual(["attendance", "bank", "import", "session", "student", "tuition"])
    for (const [id, tour] of Object.entries(TOURS)) expect(tour.id).toBe(id)
    expect(TOURS.student.href).toBe("/students")
    expect(TOURS.import.href).toBe("/students")
    expect(TOURS.session.href).toBe("/calendar")
    expect(TOURS.attendance.href).toBe("/calendar")
    expect(TOURS.tuition.href).toBe("/tuition")
    expect(TOURS.bank.href).toBe("/settings")
  })

  it("Điểm danh cần ca, Thu học phí cần học sinh; bước báo thiếu chuyển sang đúng tour", () => {
    expect(TOURS.attendance.requires).toBe("session")
    expect(TOURS.tuition.requires).toBe("student")
    expect(MISSING_STEPS.session).toMatchObject({ target: null, nextTour: "session" })
    expect(MISSING_STEPS.student).toMatchObject({ target: null, nextTour: "student" })
  })

  it("mọi key chữ có ở cả vi và en, không có gạch dài", () => {
    const keys = new Set<string>(["tour_next", "tour_prev", "tour_done", "tour_click_hint", "tour_show_me", "tour_close_dialog_first", "tour_target_missing"])
    for (const s of ALL_STEPS) {
      keys.add(s.titleKey)
      keys.add(s.bodyKey)
      if (s.nextLabelKey) keys.add(s.nextLabelKey)
    }
    for (const k of keys) {
      expect(vi, k).toHaveProperty(k)
      expect(en, k).toHaveProperty(k)
      expect((vi as Record<string, string>)[k]).not.toMatch(/[—–]/)
      expect((en as Record<string, string>)[k]).not.toMatch(/[—–]/)
    }
  })

  it("bước 👆 luôn có target", () => {
    for (const s of ALL_STEPS) if (s.advanceOn === "click") expect(s.target).not.toBeNull()
  })

  it("tourHref và parseTourParam", () => {
    expect(tourHref("student")).toBe("/students?tour=student")
    expect(tourHref("bank")).toBe("/settings?tour=bank")
    expect(parseTourParam("tuition")).toBe("tuition")
    expect(parseTourParam("abc")).toBeNull()
    expect(parseTourParam("toString")).toBeNull()
    expect(parseTourParam(null)).toBeNull()
  })

  it("/guide: 6 mục gắn đúng tour", () => {
    expect(GUIDE_TOURS).toEqual({
      "hoc-sinh": "student",
      "nhap-excel": "import",
      "lich-day": "session",
      "diem-danh": "attendance",
      "hoc-phi": "tuition",
      "tai-khoan-ngan-hang": "bank",
    })
  })
})
