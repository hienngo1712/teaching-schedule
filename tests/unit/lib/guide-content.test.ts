import { describe, it, expect } from "vitest"
import { GUIDE_SECTIONS, GUIDE_IDS } from "@/lib/guide-content"
import { RELEASES } from "@/lib/releases"

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
})
