import { describe, it, expect } from "vitest"
import { MANAGE_ITEMS, MORE_ITEMS, NAV_ITEMS, isMoreActive } from "@/components/layout/nav-items"

describe("isMoreActive", () => {
  it.each(["/reports", "/subjects", "/settings", "/settings/x", "/plan"])("%s → true", (path) => {
    expect(isMoreActive(path)).toBe(true)
  })

  it.each(["/dashboard", "/students", "/subjectsx"])("%s → false", (path) => {
    expect(isMoreActive(path)).toBe(false)
  })
})

describe("danh sách mục điều hướng", () => {
  it("NAV_ITEMS giữ 5 mục; MANAGE_ITEMS và MORE_ITEMS đúng thứ tự, có mô tả", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/dashboard", "/calendar", "/students", "/tuition", "/reports"])
    expect(MANAGE_ITEMS.map((i) => [i.href, i.labelKey])).toEqual([
      ["/subjects", "subject"],
      ["/settings", "settings"],
      ["/plan", "my_plan"],
    ])
    expect(MORE_ITEMS.map((i) => [i.href, i.labelKey, i.descKey])).toEqual([
      ["/reports", "reports", "more_reports_desc"],
      ["/subjects", "subject", "more_subjects_desc"],
      ["/settings", "settings", "more_settings_desc"],
      ["/plan", "my_plan", "more_plan_desc"],
    ])
  })

  it("mục Báo cáo gắn tính năng monthlyReport (để khóa ở gói Standard)", () => {
    expect(NAV_ITEMS.find((i) => i.href === "/reports")?.feature).toBe("monthlyReport")
    expect(MORE_ITEMS.find((i) => i.href === "/reports")?.feature).toBe("monthlyReport")
  })
})
