import { describe, it, expect } from "vitest"
import JSZip from "jszip"
import { buildGuideDocx, buildUpdatesDocx, splitBold, GUIDE_DOCX_FILENAME, UPDATES_DOCX_FILENAME } from "@/lib/guide-docx"
import { RELEASES } from "@/lib/releases"
import { GUIDE_SECTIONS } from "@/lib/guide-content"

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file("word/document.xml")!.async("string")
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
    const xml = await documentXml(await buildGuideDocx(GUIDE_SECTIONS, "0.11.1"))
    expect(xml).toContain("Hướng dẫn sử dụng Lịch dạy")
    expect(xml).toContain("0.11.1")
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
