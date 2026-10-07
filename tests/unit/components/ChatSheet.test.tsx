/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ChatSheet } from "@/components/chat/ChatSheet"

const msg = { id: 1, fromAdmin: true, senderName: null, body: "Chào thầy cô", createdAt: "2026-10-07T01:00:00.000Z" }
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ chat: { messages: { invalidate: vi.fn() }, unread: { setData: vi.fn() } } }),
    chat: {
      // Lượt polling sau lỗi: React Query giữ data cũ nhưng isError = true.
      messages: {
        useInfiniteQuery: () => ({
          data: { pages: [{ items: [msg], nextCursor: null, otherReadAt: null }] },
          isPending: false,
          isError: true,
          hasNextPage: false,
          isFetchingNextPage: false,
          refetch: vi.fn(),
          fetchNextPage: vi.fn(),
        }),
      },
      send: { useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }) },
      markRead: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}))

afterEach(cleanup)

describe("ChatSheet", () => {
  it("1 lượt polling lỗi khi đã có tin thì vẫn hiện tin, không thay bằng báo lỗi", () => {
    render(<LanguageProvider forcedLanguage="vi"><ChatSheet onClose={() => {}} /></LanguageProvider>)
    expect(screen.getByText("Chào thầy cô")).toBeTruthy()
    expect(screen.queryByText("Thử lại")).toBeNull()
  })
})
