/**
 * @vitest-environment jsdom
 */
// Spec AR C1: ô tiền hiện dấu chấm nghìn kiểu VN, gõ tiếp vẫn ra đúng số (RF 4).
import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CurrencyInput } from "@/components/ui/currency-input"

function W({ onChange }: { onChange: (n: number | undefined) => void }) {
  const [v, setV] = useState<number | undefined>()
  return (
    <CurrencyInput
      value={v}
      onChange={(n) => {
        setV(n)
        onChange(n)
      }}
      aria-label="tien"
    />
  )
}

describe("CurrencyInput", () => {
  it("hiện 185.000 kiểu VN", () => {
    render(<CurrencyInput value={185000} onChange={() => {}} aria-label="tien" />)
    expect(screen.getByLabelText("tien")).toHaveProperty("value", "185.000")
  })

  it("gõ 1000 rồi 5 → 10.005 và onChange(10005)", async () => {
    const onChange = vi.fn()
    render(<W onChange={onChange} />)
    await userEvent.type(screen.getByLabelText("tien"), "10005")
    expect(screen.getByLabelText("tien")).toHaveProperty("value", "10.005")
    expect(onChange).toHaveBeenLastCalledWith(10005)
  })

  it("số triệu: 1.234.567", async () => {
    const onChange = vi.fn()
    render(<W onChange={onChange} />)
    await userEvent.type(screen.getByLabelText("tien"), "1234567")
    expect(screen.getByLabelText("tien")).toHaveProperty("value", "1.234.567")
    expect(onChange).toHaveBeenLastCalledWith(1234567)
  })

  it("xoá hết → undefined", () => {
    const onChange = vi.fn()
    render(<CurrencyInput value={5000} onChange={onChange} aria-label="tien" />)
    fireEvent.change(screen.getByLabelText("tien"), { target: { value: "" } })
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
