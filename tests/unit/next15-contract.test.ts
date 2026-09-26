import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { headers } from "next/headers"

// Khóa các hợp đồng mà Next 15 vừa đổi, để lần nâng sau đỏ ngay nếu lệch.
describe("Hợp đồng Next 15", () => {
  it("headers() là async — gọi ngoài request scope phải throw, không còn trả object đồng bộ như Next 14", () => {
    // Trong vitest luôn ở ngoài request scope. Next 15 throw ở đây thay vì
    // trả object đồng bộ (hành vi Next 14). Nếu ai đó lùi về sync API, lỗi
    // này sẽ biến mất hoặc đổi loại — test đỏ.
    expect(() => headers()).toThrowError(/outside a request scope/i)

    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies: Record<string, string>
    }
    const nextMajor = Number(pkg.dependencies.next.replace(/[^\d.]/g, "").split(".")[0])
    expect(nextMajor).toBeGreaterThanOrEqual(15)
  })

  it("login action await headers() thay vì dùng trực tiếp", () => {
    const src = readFileSync("src/app/login/actions.ts", "utf8")
    expect(src).toContain("await headers()")
    expect(src).not.toMatch(/[^t]\bheaders\(\)\.get/)
  })

  it("không page/layout nào dính tới params hoặc searchParams", () => {
    // Prop này thành Promise ở Next 15. Dự án không dùng — quét đệ quy mọi
    // page.tsx/layout.tsx (không whitelist danh sách cứng, vì file MỚI thêm
    // sau này cũng phải bị bắt) và tìm định danh params/searchParams bằng
    // word-boundary, để bắt cả kiểu destructure ở thân hàm (`const { params } = props`)
    // chứ không chỉ destructure ngay ở tham số.
    const identifierPattern = /\b(params|searchParams)\b/
    // Ngoại lệ: reports/page.tsx có biến local `params` (input tRPC); p/[token]/page.tsx là
    // page duy nhất dùng prop route, đã await theo kiểu async của Next 15 (test bên dưới).
    const ALLOWED = new Set(["src/app/(app)/reports/page.tsx", "src/app/p/[token]/page.tsx"])

    const offenders: string[] = []
    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.name === "page.tsx" || entry.name === "layout.tsx") {
          const normalized = full.split("\\").join("/")
          if (ALLOWED.has(normalized)) continue
          const src = readFileSync(full, "utf8")
          if (identifierPattern.test(src)) {
            offenders.push(normalized)
          }
        }
      }
    }
    walk("src/app")

    expect(offenders, `Các file dính params/searchParams chưa xử lý async: ${offenders.join(", ")}`).toEqual([])
  })

  it("trang phụ huynh await params và searchParams (prop route là Promise ở Next 15)", () => {
    const src = readFileSync("src/app/p/[token]/page.tsx", "utf8")
    expect(src).toContain("await params")
    expect(src).toContain("await searchParams")
  })

  it("không dùng fetch() ở bất kỳ đâu trong src/ — nếu thêm phải tự khai báo cache", () => {
    // Next 15 bỏ cache mặc định của fetch. Dự án đi hết qua tRPC nên không
    // ảnh hưởng; quét đệ quy toàn bộ src/ (không chỉ 1 file) để giữ nguyên trạng đó.
    const offenders: string[] = []
    // Loại trừ khớp nhầm: prefetch(, refetch(, .fetch( (method call trên object khác).
    const fetchCallPattern = /(?<![\w.])fetch\(/
    // useBackupDownload gọi fetch trên trình duyệt tới GET /api/backup (route trả nhị
    // phân, tRPC không trả được) — không liên quan cache dữ liệu render của Next 15.
    const ALLOWED = new Set(["src/hooks/useBackupDownload.ts"])

    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (ALLOWED.has(full.split("\\").join("/"))) continue
          const src = readFileSync(full, "utf8")
          if (fetchCallPattern.test(src)) {
            offenders.push(full)
          }
        }
      }
    }
    walk("src")

    expect(offenders, `Các file gọi fetch() trực tiếp: ${offenders.join(", ")}`).toEqual([])
  })

  it("build script giữ đúng 3 lệnh, không thêm bớt", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"))
    expect(pkg.scripts.build).toBe(
      "prisma generate && prisma migrate deploy && next build"
    )
  })
})
