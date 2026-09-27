/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { handleRadioGroupKeyDown } from "@/lib/radio-group-keys"

function Group({ disabled }: { disabled?: string }) {
  const [v, setV] = useState("a")
  return (
    <div role="radiogroup" aria-label="nhóm" onKeyDown={handleRadioGroupKeyDown}>
      {["a", "b", "c"].map((x) => (
        <button key={x} type="button" role="radio" aria-checked={v === x} tabIndex={v === x ? 0 : -1} disabled={x === disabled} onClick={() => setV(x)}>
          {x}
        </button>
      ))}
    </div>
  )
}
const radio = (name: string) => screen.getByRole("radio", { name })
function press(key: string) {
  fireEvent.keyDown(document.activeElement!, { key })
}

describe("handleRadioGroupKeyDown (spec P J3)", () => {
  it("ArrowRight/ArrowDown → radio kế tiếp được chọn + focus; vòng về đầu", () => {
    render(<Group />)
    radio("a").focus()
    press("ArrowRight")
    expect(radio("b").getAttribute("aria-checked")).toBe("true")
    expect(document.activeElement).toBe(radio("b"))
    press("ArrowDown")
    press("ArrowDown")
    expect(radio("a").getAttribute("aria-checked")).toBe("true")
  })
  it("ArrowLeft từ đầu → cuối; Home/End", () => {
    render(<Group />)
    radio("a").focus()
    press("ArrowLeft")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
    press("Home")
    expect(radio("a").getAttribute("aria-checked")).toBe("true")
    press("End")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
  })
  it("bỏ qua radio disabled; phím khác không làm gì", () => {
    render(<Group disabled="b" />)
    radio("a").focus()
    press("ArrowRight")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
    press("x")
    expect(radio("c").getAttribute("aria-checked")).toBe("true")
  })
  it("roving tabindex: chỉ radio đang chọn có tabIndex 0", () => {
    render(<Group />)
    expect([radio("a"), radio("b"), radio("c")].map((r) => r.tabIndex)).toEqual([0, -1, -1])
  })
})
