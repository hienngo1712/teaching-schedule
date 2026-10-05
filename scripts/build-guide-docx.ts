// Dựng sẵn file Word hướng dẫn (kèm ảnh) vào public/guide. Chạy lại sau khi chụp ảnh hoặc sửa guide-content.ts.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildGuideDocx, type GuideShotImages } from "../src/lib/guide-docx"
import { GUIDE_SECTIONS, GUIDE_SHOTS } from "../src/lib/guide-content"

const DIR = join(process.cwd(), "public/guide")
const images: GuideShotImages = new Map(
  GUIDE_SHOTS.map((s) => [
    s,
    {
      desktop: readFileSync(join(DIR, `${s}-desktop.jpg`)),
      mobile: readFileSync(join(DIR, `${s}-mobile.jpg`)),
    },
  ])
)

buildGuideDocx(GUIDE_SECTIONS, images).then(async (blob) => {
  const out = join(DIR, "huong-dan-su-dung.docx")
  writeFileSync(out, Buffer.from(await blob.arrayBuffer()))
  console.log(`OK ${out} (${Math.round(blob.size / 1024)} KB)`)
})
