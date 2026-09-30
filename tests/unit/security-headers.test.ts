import { describe, it, expect } from "vitest"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

type Rule = { source: string; headers: { key: string; value: string }[] }

async function rules(): Promise<Rule[]> {
  // Import động theo URL để tsc không đòi khai báo kiểu cho file .mjs.
  const mod = await import(pathToFileURL(join(process.cwd(), "next.config.mjs")).href)
  return mod.default.headers()
}

describe("Header bảo mật (spec O Q16)", () => {
  it("luật toàn trang có đủ 6 header và đứng trước luật /p", async () => {
    const all = await rules()
    const gi = all.findIndex((r) => r.source === "/:path*")
    const pi = all.findIndex((r) => r.source === "/p/:path*")
    expect(gi).toBeGreaterThanOrEqual(0)
    expect(pi).toBeGreaterThan(gi)
    const h = Object.fromEntries(all[gi].headers.map((x) => [x.key, x.value]))
    expect(h["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains")
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
    expect(h["X-Frame-Options"]).toBe("DENY")
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()")
    expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'")
    const p = Object.fromEntries(all[pi].headers.map((x) => [x.key, x.value]))
    expect(p["Referrer-Policy"]).toBe("no-referrer")
  })
})
