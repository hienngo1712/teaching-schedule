import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import config from "../../../tailwind.config"

type Triple = [number, number, number]

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
const rootStart = css.indexOf(":root")
const root = css.slice(rootStart, css.indexOf("}", rootStart))

function token(name: string): Triple {
  const m = root.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%;`))
  if (!m) throw new Error(`Thiếu token --${name}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function hslToRgb([h, s, l]: Triple): Triple {
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as Triple
}

const rgb = (name: string) => hslToRgb(token(name))
const hex = (c: Triple) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()

function luminance(c: Triple) {
  const [r, g, b] = c.map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Triple, b: Triple) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Nền nhãn "đóng một phần": bg-primary/[0.08] phủ trên thẻ trắng.
function tint8(name: string): Triple {
  return rgb(name).map((v) => Math.round(255 * 0.92 + v * 0.08)) as Triple
}

describe("globals.css — bảng màu", () => {
  it.each([
    ["background", "#FFFFFF"],
    ["page", "#F6F7F9"],
    ["foreground", "#111827"],
    ["card", "#FFFFFF"],
    ["card-foreground", "#111827"],
    ["popover", "#FFFFFF"],
    ["popover-foreground", "#111827"],
    ["primary", "#0F766E"],
    ["ring", "#0F766E"],
    ["primary-foreground", "#FFFFFF"],
    ["muted-foreground", "#6B7280"],
    ["secondary", "#F3F4F6"],
    ["muted", "#F3F4F6"],
    ["accent", "#F3F4F6"],
    ["secondary-foreground", "#111827"],
    ["accent-foreground", "#111827"],
    ["border", "#E7E9EE"],
    ["input", "#E7E9EE"],
    ["debt", "#B42318"],
    ["debt-soft", "#FEF3F2"],
    ["success", "#067647"],
    ["success-soft", "#ECFDF3"],
  ])("--%s = %s", (name, expected) => {
    expect(hex(rgb(name))).toBe(expected)
  })

  it("bo góc 14px, không còn khối .dark", () => {
    expect(root).toMatch(/--radius:\s*0\.875rem;/)
    expect(css).not.toMatch(/\.dark\s*\{/)
  })
})

describe("globals.css — tương phản WCAG ≥ 4.5", () => {
  it.each([
    ["primary-foreground", "primary"],
    ["foreground", "card"],
    ["muted-foreground", "card"],
    ["muted-foreground", "page"],
    ["primary", "card"],
    ["primary", "page"],
    ["debt", "card"],
    ["debt", "debt-soft"],
    ["success", "success-soft"],
  ])("%s trên %s", (fg, bg) => {
    expect(contrast(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it("primary trên nền trắng pha 8% màu nhấn", () => {
    expect(contrast(rgb("primary"), tint8("primary"))).toBeGreaterThanOrEqual(4.5)
  })
})

describe("tailwind.config", () => {
  const ext = config.theme?.extend as Record<string, Record<string, unknown>>

  it("có màu page, debt, success; bo góc theo token; font Geist", () => {
    expect(ext.colors.page).toBe("hsl(var(--page))")
    expect(ext.colors.debt).toEqual({ DEFAULT: "hsl(var(--debt))", soft: "hsl(var(--debt-soft))" })
    expect(ext.colors.success).toEqual({ DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" })
    expect(ext.borderRadius).toEqual({
      xl: "var(--radius)",
      lg: "var(--radius)",
      md: "calc(var(--radius) - 4px)",
      sm: "calc(var(--radius) - 6px)",
    })
    expect((ext.fontFamily.sans as string[])[0]).toBe("var(--font-geist-sans)")
    expect((ext.fontFamily.mono as string[])[0]).toBe("var(--font-geist-mono)")
  })
})
