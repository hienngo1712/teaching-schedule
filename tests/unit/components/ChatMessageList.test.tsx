/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ChatMessageList } from "@/components/chat/ChatMessageList"

afterEach(cleanup)

const items = [
  { id: 1, fromAdmin: false, senderName: "teacher", body: "Hỏi <b>x</b>\ndòng 2", createdAt: "2026-10-07T01:00:00.000Z" },
  { id: 2, fromAdmin: true, senderName: "admin_test", body: "Trả lời", createdAt: "2026-10-07T01:05:00.000Z" },
]

function renderList(props: Partial<Parameters<typeof ChatMessageList>[0]> = {}) {
  const onLoadOlder = vi.fn()
  render(
    <LanguageProvider forcedLanguage="vi">
      <ChatMessageList items={items} viewer="teacher" otherReadAt={null} hasOlder={false} loadingOlder={false} onLoadOlder={onLoadOlder} emptyText="Trống" {...props} />
    </LanguageProvider>
  )
  return { onLoadOlder }
}

describe("ChatMessageList", () => {
  it("giáo viên xem: tin mình bên phải, tin admin bên trái có nhãn Hỗ trợ, không hiện username admin", () => {
    renderList()
    const [mine, theirs] = screen.getAllByTestId("chat-message")
    expect(mine.getAttribute("data-mine")).toBe("true")
    expect(theirs.getAttribute("data-mine")).toBe("false")
    expect(within(theirs).getByText("Hỗ trợ")).toBeTruthy()
    expect(screen.queryByText("admin_test")).toBeNull()
    // Không render HTML.
    expect(within(mine).getByText(/Hỏi <b>x<\/b>/)).toBeTruthy()
  })

  it("admin xem: tin admin bên phải kèm username admin", () => {
    renderList({ viewer: "admin" })
    const [teacherMsg, adminMsg] = screen.getAllByTestId("chat-message")
    expect(teacherMsg.getAttribute("data-mine")).toBe("false")
    expect(adminMsg.getAttribute("data-mine")).toBe("true")
    expect(within(adminMsg).getByText("admin_test")).toBeTruthy()
  })

  it("Đã xem dưới tin cuối của mình khi otherReadAt không sớm hơn", () => {
    renderList({ viewer: "admin", otherReadAt: "2026-10-07T01:04:00.000Z" })
    expect(screen.queryByText("Đã xem")).toBeNull()
    cleanup()
    renderList({ viewer: "admin", otherReadAt: "2026-10-07T01:05:00.000Z" })
    expect(screen.getByText("Đã xem")).toBeTruthy()
  })

  it("nút Xem tin cũ hơn khi hasOlder; rỗng thì hiện emptyText", () => {
    const { onLoadOlder } = renderList({ hasOlder: true })
    fireEvent.click(screen.getByRole("button", { name: "Xem tin cũ hơn" }))
    expect(onLoadOlder).toHaveBeenCalled()
    cleanup()
    renderList({ items: [] })
    expect(screen.getByText("Trống")).toBeTruthy()
  })
})
