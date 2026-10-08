/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { isTourEvent, keepOpenOnTour } from "@/lib/tour-guard"

function eventOn(el: Element) {
  return { target: el, preventDefault: vi.fn() }
}

describe("tour-guard", () => {
  it("bấm trong khung tour hoặc lớp phủ tour: chặn Radix đóng hộp, không gọi handler gốc", () => {
    const pop = document.createElement("div")
    pop.className = "driver-popover"
    const btn = document.createElement("button")
    pop.appendChild(btn)
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    overlay.setAttribute("class", "driver-overlay")
    const original = vi.fn()
    const e1 = eventOn(btn)
    keepOpenOnTour(original)(e1)
    expect(isTourEvent(e1)).toBe(true)
    expect(e1.preventDefault).toHaveBeenCalled()
    const e2 = eventOn(overlay)
    keepOpenOnTour(original)(e2)
    expect(e2.preventDefault).toHaveBeenCalled()
    expect(original).not.toHaveBeenCalled()
  })

  it("bấm chỗ khác: để Radix xử lý như cũ, gọi handler gốc", () => {
    const other = document.createElement("div")
    const original = vi.fn()
    const e = eventOn(other)
    keepOpenOnTour(original)(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(original).toHaveBeenCalledWith(e)
  })
})
