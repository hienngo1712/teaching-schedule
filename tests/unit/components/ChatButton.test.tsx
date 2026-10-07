/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ChatButton } from "@/components/chat/ChatButton"

const unread = vi.hoisted(() => ({ count: 0 }))
vi.mock("@/lib/trpc", () => ({
  trpc: { chat: { unread: { useQuery: () => ({ data: { count: unread.count } }) } } },
}))
vi.mock("@/components/chat/ChatSheet", () => ({ ChatSheet: () => <div data-testid="chat-sheet" /> }))

beforeEach(() => {
  unread.count = 0
})
afterEach(cleanup)

function renderVi() {
  render(<LanguageProvider forcedLanguage="vi"><ChatButton /></LanguageProvider>)
}

describe("ChatButton", () => {
  it("không có tin chưa đọc: nhãn Nhắn hỗ trợ, không badge", () => {
    renderVi()
    expect(screen.getByRole("button", { name: "Nhắn hỗ trợ" })).toBeTruthy()
    expect(screen.queryByTestId("chat-unread")).toBeNull()
  })

  it("có 3 tin: badge 3 và nhãn có số", () => {
    unread.count = 3
    renderVi()
    expect(screen.getByRole("button", { name: "Nhắn hỗ trợ, 3 tin chưa đọc" })).toBeTruthy()
    expect(screen.getByTestId("chat-unread").textContent).toBe("3")
  })

  it("quá 9 hiện 9+", () => {
    unread.count = 12
    renderVi()
    expect(screen.getByTestId("chat-unread").textContent).toBe("9+")
  })

  it("bấm nút mở khung chat", () => {
    renderVi()
    expect(screen.queryByTestId("chat-sheet")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Nhắn hỗ trợ" }))
    expect(screen.getByTestId("chat-sheet")).toBeTruthy()
  })
})
