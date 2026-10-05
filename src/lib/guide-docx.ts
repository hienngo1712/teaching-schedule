import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from "docx"
import type { GuideSection } from "@/lib/guide-content"

export const GUIDE_DOCX_FILENAME = "huong-dan-su-dung.docx"

const TEAL = "0F766E"
const FONT = "Arial" // đủ dấu tiếng Việt trên mọi máy có Word

export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((p) => p.text !== "")
}

function runs(text: string, base: { italics?: boolean; color?: string } = {}) {
  return splitBold(text).map(
    (p) => new TextRun({ text: p.text, bold: p.bold, italics: base.italics, color: p.bold ? "0F172A" : base.color })
  )
}

export async function buildGuideDocx(sections: GuideSection[], version: string): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: "Hướng dẫn sử dụng Lịch dạy", bold: true, size: 48, color: TEAL })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: `Bản v${version}`, size: 20, color: "64748B" })],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Mục lục", bold: true, size: 26 })] }),
    ...sections.map((s, i) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun(`${i + 1}. ${s.title}`)] })),
  ]

  sections.forEach((s, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "E6F4F1" },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } },
        children: [new TextRun({ text: `${i + 1}. ${s.title}`, bold: true, size: 32, color: TEAL })],
      })
    )
    if (s.intro) children.push(new Paragraph({ spacing: { after: 120 }, children: runs(s.intro, { italics: true, color: "334155" }) }))
    s.steps.forEach((step, j) =>
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 100 },
          children: [new TextRun({ text: `Bước ${j + 1}. `, bold: true, color: TEAL }), ...runs(step)],
        })
      )
    )
    s.tips?.forEach((tip) =>
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 60, after: 60 },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "FEF3C7" },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: "D97706", space: 6 } },
          children: [new TextRun({ text: "Mẹo: ", bold: true }), ...runs(tip)],
        })
      )
    )
  })

  const doc = new Document({
    creator: "Lịch dạy",
    title: "Hướng dẫn sử dụng",
    styles: {
      default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { line: 276 } } } },
      // Heading1 mặc định của docx màu xanh dương; ép về teal + Arial cho đồng bộ app.
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 32, bold: true, color: TEAL } },
      ],
    },
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}
