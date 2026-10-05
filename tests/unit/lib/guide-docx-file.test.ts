import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import JSZip from "jszip"
import { buildGuideDocx } from "@/lib/guide-docx"
import { GUIDE_SECTIONS, GUIDE_SHOTS } from "@/lib/guide-content"

const DIR = join(process.cwd(), "public/guide")
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
// Chỉ so chữ hiển thị (các <w:t>), không so cả XML vì id nội bộ của docx có thể khác giữa 2 lần dựng.
const texts = (xml: string) =>
  [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("|")

async function open(buf: Uint8Array) {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file("word/document.xml")!.async("string")
  const media = await Promise.all(
    Object.keys(zip.files)
      .filter((f) => f.startsWith("word/media/") && !zip.files[f]?.dir)
      .map((f) => zip.file(f)!.async("uint8array"))
  )
  return { xml, media }
}

describe("public/guide/huong-dan-su-dung.docx (plan AA)", () => {
  it("chữ khớp nội dung hướng dẫn hiện tại; ảnh trong file đúng là 48 ảnh hiện tại (sai → chạy pnpm guide:docx)", async () => {
    const saved = await open(readFileSync(join(DIR, "huong-dan-su-dung.docx")))
    const fresh = await open(new Uint8Array(await (await buildGuideDocx(GUIDE_SECTIONS)).arrayBuffer()))
    expect(texts(saved.xml)).toBe(texts(fresh.xml))
    const want = GUIDE_SHOTS.flatMap((s) =>
      ["desktop", "mobile"].map((k) => sha(readFileSync(join(DIR, `${s}-${k}.jpg`))))
    ).sort()
    expect(saved.media.map(sha).sort()).toEqual(want)
  })
})
