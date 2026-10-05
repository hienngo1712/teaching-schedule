import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from "docx"
import { type GuideSection, stepText } from "@/lib/guide-content"
import { formatReleaseDate, type Release } from "@/lib/releases"

export const GUIDE_DOCX_FILENAME = "huong-dan-su-dung.docx"
export const UPDATES_DOCX_FILENAME = "cac-ban-cap-nhat.docx"

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

function docTitle(title: string, subtitle: string): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: title, bold: true, size: 48, color: TEAL })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: subtitle, size: 20, color: "64748B" })],
    }),
  ]
}

// Heading 1 để Word hiện ở Navigation Pane; nền + gạch dưới cho tiêu đề nổi bật.
function heading1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "E6F4F1" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 32, color: TEAL })],
  })
}

function pack(title: string, children: Paragraph[]): Promise<Blob> {
  const doc = new Document({
    creator: "Lịch dạy",
    title,
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

export async function buildGuideDocx(sections: GuideSection[], version: string): Promise<Blob> {
  const children: Paragraph[] = [
    ...docTitle("Hướng dẫn sử dụng Lịch dạy", `Bản v${version}`),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Mục lục", bold: true, size: 26 })] }),
    ...sections.map((s, i) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun(`${i + 1}. ${s.title}`)] })),
  ]

  sections.forEach((s, i) => {
    children.push(
      heading1(`${i + 1}. ${s.title}`)
    )
    if (s.intro) children.push(new Paragraph({ spacing: { after: 120 }, children: runs(s.intro, { italics: true, color: "334155" }) }))
    s.steps.forEach((step, j) =>
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 100 },
          children: [new TextRun({ text: `Bước ${j + 1}. `, bold: true, color: TEAL }), ...runs(stepText(step))],
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

  return pack("Hướng dẫn sử dụng", children)
}

const KIND_TEXT: Record<Release["items"][number]["kind"], string> = { new: "Mới", improve: "Cải tiến", fix: "Sửa lỗi" }

export async function buildUpdatesDocx(releases: Release[]): Promise<Blob> {
  const children: Paragraph[] = [...docTitle("Các bản cập nhật Lịch dạy", `Bản mới nhất v${releases[0]?.version ?? ""}`)]
  for (const r of releases) {
    children.push(
      heading1(`v${r.version} · ${r.title}`),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: formatReleaseDate(r.date), size: 20, color: "64748B" })] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: r.summary, italics: true, color: "334155" })] })
    )
    for (const item of r.items) {
      children.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: `[${KIND_TEXT[item.kind]}] `, bold: true, color: TEAL }),
            new TextRun({ text: item.title, bold: true, color: "0F172A" }),
          ],
        }),
        new Paragraph({ indent: { left: 360 }, spacing: { after: 100 }, children: [new TextRun(item.body)] })
      )
    }
  }
  return pack("Các bản cập nhật", children)
}
