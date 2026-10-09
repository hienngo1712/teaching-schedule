import { describe, it, expect } from "vitest"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import {
  GUIDE_SECTIONS,
  GUIDE_IDS,
  GUIDE_SHOTS,
  guideShotSrc,
  stepShot,
  stepText,
} from "@/lib/guide-content"
import { RELEASES } from "@/lib/releases"
import { GOOGLE_FORM_QUESTIONS } from "@/lib/student-import"

const EXPECTED_IDS = [
  "bat-dau", "mon-hoc", "hoc-sinh", "nhap-excel", "lich-day", "diem-danh", "hoc-phi",
  "bao-cao", "tai-khoan-ngan-hang", "goi-dich-vu", "thung-rac", "sao-luu", "bao-mat",
]

describe("guide-content (spec W §3.1)", () => {
  it("đủ 13 mục đúng thứ tự, id không trùng, mỗi mục ≥ 2 bước", () => {
    expect(GUIDE_SECTIONS.map((s) => s.id)).toEqual(EXPECTED_IDS)
    expect(GUIDE_IDS.size).toBe(GUIDE_SECTIONS.length)
    for (const s of GUIDE_SECTIONS) expect(s.steps.length, s.id).toBeGreaterThanOrEqual(2)
  })

  it("mọi guideId trong bản cập nhật và thẻ Bắt đầu đều có mục tương ứng", () => {
    const fromReleases = RELEASES.flatMap((r) => r.items.map((i) => i.guideId)).filter(Boolean) as string[]
    const fromStart = ["hoc-sinh", "lich-day", "diem-danh", "hoc-phi", "tai-khoan-ngan-hang"]
    for (const id of [...fromReleases, ...fromStart]) expect(GUIDE_IDS.has(id), id).toBe(true)
  })

  it("không có gạch dài, không có chỗ trống chưa viết", () => {
    const text = JSON.stringify(GUIDE_SECTIONS)
    expect(text).not.toMatch(/[—–]/)
    expect(text).not.toMatch(/TODO|TBD|\.\.\./)
  })

  it("tên nút khớp giao diện thật (đối chiếu ảnh chụp AA)", () => {
    const text = JSON.stringify(GUIDE_SECTIONS)
    expect(text).toContain("**+ Tạo ca dạy**")
    expect(text).not.toContain("Thêm ca dạy mới")
    expect(text).toContain("**Lưu điểm danh**")
    expect(text).not.toContain("vắng có phép")
  })

  it("mẹo dùng thử đúng thực tế: không hứa tài khoản mới tự có Pro, nói rõ do quản trị viên đặt", () => {
    const tips = GUIDE_SECTIONS.find((s) => s.id === "bat-dau")!.tips!.join(" ")
    expect(tips).not.toContain("Tài khoản mới được dùng thử gói Pro")
    expect(tips).toContain("Standard")
    expect(tips.toLowerCase()).toContain("quản trị viên")
  })

  it("mục nhập Excel có cách tự tạo Google Form (spec AB)", () => {
    const text = JSON.stringify(GUIDE_SECTIONS.find((s) => s.id === "nhap-excel"))
    expect(text).toContain("**Tạo Google Form**")
    for (const q of GOOGLE_FORM_QUESTIONS) expect(text).toContain(`**${q.title}**`)
    expect(text).toContain("Microsoft Excel (.xlsx)")
  })
})

describe("ảnh hướng dẫn (plan AA)", () => {
  const files = new Set(readdirSync(join(process.cwd(), "public/guide")).filter((f) => f.endsWith(".jpg")))

  it("có 25 shot, không trùng, đúng dạng kebab-case", () => {
    expect(GUIDE_SHOTS.length).toBe(25)
    expect(new Set(GUIDE_SHOTS).size).toBe(GUIDE_SHOTS.length)
    for (const s of GUIDE_SHOTS) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it("mỗi shot có đủ ảnh máy tính và điện thoại", () => {
    for (const s of GUIDE_SHOTS) {
      expect(files.has(`${s}-desktop.jpg`), s).toBe(true)
      expect(files.has(`${s}-mobile.jpg`), s).toBe(true)
    }
  })

  it("không có file ảnh thừa không bước nào dùng", () => {
    const used = new Set(GUIDE_SHOTS.flatMap((s) => [`${s}-desktop.jpg`, `${s}-mobile.jpg`]))
    expect([...files].filter((f) => !used.has(f))).toEqual([])
  })

  it("stepText / stepShot / guideShotSrc", () => {
    expect(stepText("a **b**")).toBe("a **b**")
    expect(stepShot("a")).toBeUndefined()
    expect(stepText({ text: "x", shot: "y" })).toBe("x")
    expect(stepShot({ text: "x", shot: "y" })).toBe("y")
    expect(guideShotSrc("hoc-phi-mien", "mobile")).toBe("/guide/hoc-phi-mien-mobile.jpg")
  })
})
