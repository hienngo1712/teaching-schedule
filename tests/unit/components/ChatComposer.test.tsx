/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ChatComposer } from "@/components/chat/ChatComposer"

afterEach(cleanup)

function setup(onSend = vi.fn().mockResolvedValue(undefined), pending = false) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <ChatComposer onSend={onSend} pending={pending} />
    </LanguageProvider>
  )
  return { onSend, input: screen.getByLabelText("Nội dung tin nhắn"), button: screen.getByRole("button", { name: "Gửi" }) }
}

describe("ChatComposer", () => {
  it("rỗng hoặc toàn khoảng trắng thì nút Gửi tắt", () => {
    const { input, button } = setup()
    expect(button).toHaveProperty("disabled", true)
    fireEvent.change(input, { target: { value: "   " } })
    expect(button).toHaveProperty("disabled", true)
  })

  it("Enter gửi bản đã trim rồi xoá ô; Shift+Enter không gửi", async () => {
    const { onSend, input } = setup()
    fireEvent.change(input, { target: { value: "  Xin chào  " } })
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSend).toHaveBeenCalledWith("Xin chào")
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(""))
  })

  it("đang ghép chữ Telex/VNI thì Enter không gửi", () => {
    const { onSend, input } = setup()
    fireEvent.change(input, { target: { value: "Vieejt" } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })
    expect(onSend).not.toHaveBeenCalled()
  })

  it("gửi lỗi thì giữ nguyên chữ", async () => {
    const { input, button } = setup(vi.fn().mockRejectedValue(new Error("x")))
    fireEvent.change(input, { target: { value: "Còn đây" } })
    fireEvent.click(button)
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe("Còn đây"))
  })

  it("từ 1800 ký tự hiện bộ đếm; quá 2000 thì tắt nút", () => {
    const { input, button } = setup()
    fireEvent.change(input, { target: { value: "a".repeat(1799) } })
    expect(screen.queryByTestId("chat-counter")).toBeNull()
    fireEvent.change(input, { target: { value: "a".repeat(1800) } })
    expect(screen.getByTestId("chat-counter").textContent).toBe("1800/2000")
    fireEvent.change(input, { target: { value: "a".repeat(2001) } })
    expect(button).toHaveProperty("disabled", true)
  })

  it("đang gửi thì nút tắt", () => {
    const { input, button } = setup(undefined, true)
    fireEvent.change(input, { target: { value: "abc" } })
    expect(button).toHaveProperty("disabled", true)
  })

  it("ô nhập cao theo nội dung (max-h-32 chặn khoảng 4 dòng rồi cuộn), gửi xong về 1 dòng", async () => {
    const { input } = setup()
    Object.defineProperty(input, "scrollHeight", { configurable: true, value: 96 })
    fireEvent.change(input, { target: { value: "dòng 1\ndòng 2\ndòng 3" } })
    expect((input as HTMLTextAreaElement).style.height).toBe("96px")
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect((input as HTMLTextAreaElement).style.height).toBe(""))
  })
})
