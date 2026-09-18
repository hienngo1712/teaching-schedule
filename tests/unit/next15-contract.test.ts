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

  it("không page/layout nào nhận prop params hoặc searchParams", () => {
    // Prop này thành Promise ở Next 15. Dự án không dùng — nếu ai đó thêm vào
    // mà quên await, test này bắt được.
    const files = [
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/app/login/page.tsx",
      "src/app/register/page.tsx",
      "src/app/(app)/layout.tsx",
      "src/app/(app)/calendar/page.tsx",
      "src/app/(app)/dashboard/page.tsx",
      "src/app/(app)/reports/page.tsx",
      "src/app/(app)/students/page.tsx",
      "src/app/(app)/tuition/page.tsx",
    ]
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      expect(src, `${f} nhận prop params/searchParams mà chưa xử lý async`)
        .not.toMatch(/export default (async )?function \w+\(\s*\{[^}]*\b(params|searchParams)\b/)
    }
  })

  it("không dùng fetch() ở bất kỳ đâu trong src/ — nếu thêm phải tự khai báo cache", () => {
    // Next 15 bỏ cache mặc định của fetch. Dự án đi hết qua tRPC nên không
    // ảnh hưởng; quét đệ quy toàn bộ src/ (không chỉ 1 file) để giữ nguyên trạng đó.
    const offenders: string[] = []
    // Loại trừ khớp nhầm: prefetch(, refetch(, .fetch( (method call trên object khác).
    const fetchCallPattern = /(?<![\w.])fetch\(/

    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
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
