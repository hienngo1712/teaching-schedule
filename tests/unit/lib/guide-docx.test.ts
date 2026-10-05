import { describe, it, expect } from "vitest"
import JSZip from "jszip"
import {
  buildGuideDocx,
  buildUpdatesDocx,
  splitBold,
  GUIDE_DOCX_FILENAME,
  UPDATES_DOCX_FILENAME,
} from "@/lib/guide-docx"
import { RELEASES } from "@/lib/releases"
import { GUIDE_SECTIONS, type GuideSection } from "@/lib/guide-content"

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file("word/document.xml")!.async("string")
}

// JPEG 1×1 hợp lệ, đủ để docx nhúng.
const JPG = Uint8Array.from(
  atob(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
  ),
  (c) => c.charCodeAt(0)
)
const SECTIONS: GuideSection[] = [
  {
    id: "a",
    title: "A",
    steps: ["chữ", { text: "có ảnh", shot: "s1" }, { text: "thiếu ảnh", shot: "s2" }],
  },
]

async function mediaCount(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return Object.keys(zip.files).filter((f) => f.startsWith("word/media/")).length
}

describe("guide-docx", () => {
  it("splitBold tách **…** thành đoạn đậm, bỏ phần rỗng", () => {
    expect(splitBold("Bấm **Thêm** rồi **Lưu**")).toEqual([
      { text: "Bấm ", bold: false },
      { text: "Thêm", bold: true },
      { text: " rồi ", bold: false },
      { text: "Lưu", bold: true },
    ])
    expect(splitBold("**A**")).toEqual([{ text: "A", bold: true }])
  })

  it("tên file .docx", () => {
    expect(GUIDE_DOCX_FILENAME).toBe("huong-dan-su-dung.docx")
  })

  it("file đủ mọi mục: tiêu đề Heading1 đánh số, Bước N, Mẹo, không còn dấu **", async () => {
    const xml = await documentXml(await buildGuideDocx(GUIDE_SECTIONS))
    expect(xml).toContain("Hướng dẫn sử dụng Lịch dạy")
    expect(xml).toContain("Kèm ảnh minh hoạ máy tính và điện thoại")
    GUIDE_SECTIONS.forEach((s, i) => expect(xml).toContain(`${i + 1}. ${s.title}`))
    expect((xml.match(/w:pStyle w:val="Heading1"/g) ?? []).length).toBe(GUIDE_SECTIONS.length)
    expect(xml).toContain("Bước 1. ")
    expect(xml).toContain("Mẹo: ")
    expect(xml).not.toContain("**")
    expect(xml).toContain('w:fill="E6F4F1"')
  })

  it("file Các bản cập nhật: mỗi bản 1 Heading1 'v<version> · <tiêu đề>', ngày, nhãn loại, tên file", async () => {
    expect(UPDATES_DOCX_FILENAME).toBe("cac-ban-cap-nhat.docx")
    const xml = await documentXml(await buildUpdatesDocx(RELEASES))
    expect(xml).toContain("Các bản cập nhật Lịch dạy")
    expect((xml.match(/w:pStyle w:val="Heading1"/g) ?? []).length).toBe(RELEASES.length)
    for (const r of RELEASES) {
      expect(xml).toContain(`v${r.version} · ${r.title}`)
      for (const item of r.items) expect(xml).toContain(item.title)
    }
    expect(xml).toContain("05/10/2026")
    expect(xml).toContain("[Mới] ")
  })
})

describe("Word có ảnh (plan AA)", () => {
  it("chèn đủ 2 ảnh của shot có dữ liệu, bỏ qua shot thiếu, chữ đủ", async () => {
    const blob = await buildGuideDocx(SECTIONS, new Map([["s1", { desktop: JPG, mobile: JPG }]]))
    expect(await mediaCount(blob)).toBe(2)
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file("word/document.xml")!.async("string")
    expect(xml).toContain("có ảnh")
    expect(xml).toContain("thiếu ảnh")
    expect(xml).toContain("Kèm ảnh minh hoạ máy tính và điện thoại")
  })

  it("không truyền images → không có ảnh, vẫn ra file", async () => {
    expect(await mediaCount(await buildGuideDocx(SECTIONS))).toBe(0)
  })
})
