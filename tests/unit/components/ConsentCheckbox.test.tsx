/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ConsentCheckbox } from "@/components/common/ConsentCheckbox"

describe("ConsentCheckbox", () => {
  it("bấm chữ thì tick; KHÔNG có link rời form (bổ sung H2)", () => {
    const onChange = vi.fn()
    render(
      <LanguageProvider>
        <ConsentCheckbox id="x-consent" label="Tôi đồng ý chia sẻ" checked={false} onCheckedChange={onChange} />
      </LanguageProvider>
    )
    expect(screen.queryByRole("link")).toBeNull()
    fireEvent.click(screen.getByText("Tôi đồng ý chia sẻ"))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole("checkbox", { name: "Tôi đồng ý chia sẻ" })).toBeTruthy()
  })
})
