/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CurrencyInput } from "@/components/ui/currency-input"
import { TimeInput } from "@/components/ui/time-input"

function Currency({ initial }: { initial?: number }) {
  const [v, setV] = useState<number | undefined>(initial)
  return <CurrencyInput aria-label="tiền" value={v} onChange={setV} />
}

function Time() {
  const [v, setV] = useState("08:00")
  return <TimeInput aria-label="giờ" value={v} onChange={(e) => setV(e.target.value)} />
}

describe("CurrencyInput", () => {
  // Hotfix 0.9.1: ô hiển thị cập nhật trễ 1 nhịp (qua useEffect) → phím gõ liền nhau bị mất.
  it("mỗi lần gõ hiện ngay số đã định dạng, không chờ prop value", () => {
    render(<CurrencyInput aria-label="tiền" value={undefined} onChange={() => {}} />)
    const input = screen.getByLabelText("tiền") as HTMLInputElement
    fireEvent.change(input, { target: { value: "12" } })
    expect(input.value).toBe("12")
    fireEvent.change(input, { target: { value: "1234" } })
    expect(input.value).toBe("1,234")
  })

  it("gõ liên tục 400000 → 400,000", async () => {
    render(<Currency />)
    const input = screen.getByLabelText("tiền") as HTMLInputElement
    await userEvent.type(input, "400000")
    expect(input.value).toBe("400,000")
  })

  it("prop value đổi từ ngoài (reset form) vẫn cập nhật ô", () => {
    const { rerender } = render(<CurrencyInput aria-label="tiền" value={5000} onChange={() => {}} />)
    rerender(<CurrencyInput aria-label="tiền" value={70000} onChange={() => {}} />)
    expect((screen.getByLabelText("tiền") as HTMLInputElement).value).toBe("70,000")
  })
})

describe("TimeInput", () => {
  // Hotfix 0.9.1: ô đã đủ 5 ký tự (maxLength) nên gõ giờ mới bị chặn tới khi tự xoá.
  // user-event chặn gõ khi đủ maxLength kể cả lúc có vùng chọn (trình duyệt thật thì gõ đè) → kiểm vùng chọn.
  it("bấm vào ô đã có giờ → bôi đen cả 5 ký tự để gõ là thay", async () => {
    render(<Time />)
    const input = screen.getByLabelText("giờ") as HTMLInputElement
    await userEvent.click(input)
    await new Promise((r) => setTimeout(r, 10)) // người gõ không bấm phím trong cùng nhịp với cú click
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5])
  })
})
