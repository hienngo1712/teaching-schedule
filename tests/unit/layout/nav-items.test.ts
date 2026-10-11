import { describe, it, expect } from "vitest"
import { MANAGE_ITEMS, MORE_ITEMS, NAV_ITEMS, filterByPlaces, isMoreActive, moreItems, tabItems } from "@/components/layout/nav-items"

describe("isMoreActive", () => {
  it.each(["/reports", "/subjects", "/settings", "/settings/x", "/plan", "/trash"])("%s → true", (path) => {
    expect(isMoreActive(path)).toBe(true)
  })

  it.each(["/dashboard", "/students", "/subjectsx"])("%s → false", (path) => {
    expect(isMoreActive(path)).toBe(false)
  })
})

describe("danh sách mục điều hướng", () => {
  it("NAV_ITEMS 7 mục (Bảng công sau Học phí, Chuyên cần sau Báo cáo); MANAGE_ITEMS và MORE_ITEMS đúng thứ tự, có mô tả", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/dashboard", "/calendar", "/students", "/tuition", "/timesheet", "/reports", "/attendance"])
    expect(MANAGE_ITEMS.map((i) => [i.href, i.labelKey])).toEqual([
      ["/subjects", "subject"],
      ["/places", "places"],
      ["/settings", "settings"],
      ["/plan", "my_plan"],
      ["/trash", "trash"],
      ["/guide", "guide_nav"],
    ])
    expect(MORE_ITEMS.map((i) => [i.href, i.labelKey, i.descKey])).toEqual([
      ["/timesheet", "timesheet", "more_timesheet_desc"],
      ["/reports", "reports", "more_reports_desc"],
      ["/attendance", "attendance_report", "more_attendance_desc"],
      ["/subjects", "subject", "more_subjects_desc"],
      ["/places", "places", "more_places_desc"],
      ["/settings", "settings", "more_settings_desc"],
      ["/plan", "my_plan", "more_plan_desc"],
      ["/trash", "trash", "more_trash_desc"],
      ["/guide", "guide_nav", "more_guide_desc"],
    ])
  })

  it("mục Báo cáo gắn tính năng monthlyReport (để khóa ở gói Standard)", () => {
    expect(NAV_ITEMS.find((i) => i.href === "/reports")?.feature).toBe("monthlyReport")
    expect(MORE_ITEMS.find((i) => i.href === "/reports")?.feature).toBe("monthlyReport")
  })

  it("HD sử dụng mở tab mới, icon khác Môn học", () => {
    const guide = MANAGE_ITEMS.find((i) => i.href === "/guide")!
    const subject = MANAGE_ITEMS.find((i) => i.href === "/subjects")!
    expect(guide.external).toBe(true)
    expect(guide.icon).not.toBe(subject.icon)
    expect(MORE_ITEMS.find((i) => i.href === "/guide")?.external).toBe(true)
  })
})

describe("Bảng công theo nơi dạy (spec AM §4.1, RF 4)", () => {
  const both = { hasPerStudent: true, hasPerSession: true }
  const onlySession = { hasPerStudent: false, hasPerSession: true }
  const onlyStudent = { hasPerStudent: true, hasPerSession: false }

  it("không có nơi theo ca/giờ (hoặc chưa tải xong) → không có Bảng công", () => {
    expect(filterByPlaces(NAV_ITEMS, onlyStudent).map((i) => i.href)).not.toContain("/timesheet")
    expect(filterByPlaces(NAV_ITEMS, undefined).map((i) => i.href)).not.toContain("/timesheet")
    expect(moreItems(onlyStudent).map((i) => i.href)).not.toContain("/timesheet")
  })

  it("chỉ theo ca/giờ: tab dưới có Bảng công thay chỗ Học phí; Thêm không lặp lại", () => {
    expect(tabItems(onlySession).map((i) => i.href)).toEqual(["/dashboard", "/calendar", "/students", "/timesheet"])
    expect(moreItems(onlySession).map((i) => i.href)).not.toContain("/timesheet")
    expect(isMoreActive("/timesheet", onlySession)).toBe(false)
  })

  it("có cả 2 cách tính: tab dưới giữ Học phí, Bảng công nằm trong Thêm", () => {
    expect(tabItems(both).map((i) => i.href)).toEqual(["/dashboard", "/calendar", "/students", "/tuition"])
    expect(moreItems(both)[0].href).toBe("/timesheet")
    expect(isMoreActive("/timesheet", both)).toBe(true)
  })
})

describe("Chuyên cần (spec AN §3)", () => {
  it("gắn tính năng attendanceMonth (khoá ở Standard); có cả ở sidebar lẫn sheet Thêm, không chiếm tab dưới", () => {
    expect(NAV_ITEMS.find((i) => i.href === "/attendance")?.feature).toBe("attendanceMonth")
    for (const summary of [
      { hasPerStudent: true, hasPerSession: false },
      { hasPerStudent: false, hasPerSession: true },
    ]) {
      expect(filterByPlaces(NAV_ITEMS, summary).map((i) => i.href)).toContain("/attendance")
      expect(tabItems(summary).map((i) => i.href)).not.toContain("/attendance")
      expect(moreItems(summary).map((i) => i.href)).toContain("/attendance")
    }
  })
})
