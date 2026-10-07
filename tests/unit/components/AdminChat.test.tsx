/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminChat } from "@/components/admin/AdminChat"

const inbox = vi.hoisted(() => ({
  data: undefined as undefined | { items: unknown[]; hasMore: boolean },
  isError: false,
  lastLimit: 0,
}))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      chatInbox: {
        useQuery: (input: { limit: number }) => {
          inbox.lastLimit = input.limit
          return { data: inbox.data, isPending: !inbox.data && !inbox.isError, isError: inbox.isError, refetch: vi.fn() }
        },
      },
    },
  },
}))
vi.mock("@/components/admin/AdminChatThread", () => ({
  AdminChatThread: ({ userId, title, onBack }: { userId: number; title: string; onBack: () => void }) => (
    <div data-testid="thread">
      {userId}:{title}
      <button onClick={onBack}>back</button>
    </div>
  ),
}))

const rows = [
  { userId: 7, username: "co_lan", fullName: "Cô Lan", lastMessageAt: "2026-10-07T01:00:00.000Z", unread: 2, preview: "Cho hỏi", lastFromAdmin: false },
  { userId: 8, username: "thay_minh", fullName: null, lastMessageAt: "2026-10-06T01:00:00.000Z", unread: 0, preview: "Được ạ", lastFromAdmin: true },
]

beforeEach(() => {
  inbox.data = { items: rows, hasMore: true }
  inbox.isError = false
})
afterEach(cleanup)

const renderVi = () => render(<LanguageProvider forcedLanguage="vi"><AdminChat /></LanguageProvider>)

describe("AdminChat", () => {
  it("danh sách: tên hoặc username, tiền tố Bạn:, số chưa đọc, nút Xem thêm", () => {
    renderVi()
    const items = screen.getAllByTestId("admin-chat-item")
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain("Cô Lan")
    expect(items[0].textContent).toContain("co_lan")
    expect(items[0].textContent).toContain("2")
    expect(items[1].textContent).toContain("thay_minh")
    expect(items[1].textContent).toContain("Bạn: Được ạ")
    expect(screen.getByRole("button", { name: "Xem thêm" })).toBeTruthy()
    expect(screen.getByText("Chọn một cuộc trò chuyện để xem.")).toBeTruthy()
  })

  it("chọn 1 cuộc trò chuyện thì mở khung với đúng userId và tiêu đề; back quay lại", () => {
    renderVi()
    fireEvent.click(screen.getAllByTestId("admin-chat-item")[0])
    expect(screen.getByTestId("thread").textContent).toContain("7:Cô Lan")
    fireEvent.click(screen.getByText("back"))
    expect(screen.queryByTestId("thread")).toBeNull()
  })

  it("rỗng", () => {
    inbox.data = { items: [], hasMore: false }
    renderVi()
    expect(screen.getByText("Chưa có cuộc trò chuyện nào.")).toBeTruthy()
  })

  it("1 lượt polling lỗi khi đã có dữ liệu thì vẫn giữ danh sách", () => {
    inbox.isError = true
    renderVi()
    expect(screen.getAllByTestId("admin-chat-item")).toHaveLength(2)
    expect(screen.queryByText("Thử lại")).toBeNull()
  })

  it("Xem thêm dừng ở 200 (giới hạn của API) rồi ẩn nút", () => {
    renderVi()
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Xem thêm" }))
    expect(inbox.lastLimit).toBe(200)
    expect(screen.queryByRole("button", { name: "Xem thêm" })).toBeNull()
  })
})
