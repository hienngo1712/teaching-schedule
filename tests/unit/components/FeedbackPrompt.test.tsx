/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FeedbackPrompt } from "@/components/feedback/FeedbackPrompt"
import { RELEASES } from "@/lib/releases"

let promptData: { shouldPrompt: boolean } | undefined
let releaseData: { lastSeenRelease: string | null } | undefined
const dismiss = vi.fn()

vi.mock("@/lib/trpc", () => ({
  trpc: {
    feedback: {
      promptStatus: {
        useQuery: () => ({ data: promptData }),
      },
      dismissPrompt: {
        useMutation: () => ({ mutate: dismiss }),
      },
    },
    release: {
      status: {
        useQuery: () => ({ data: releaseData }),
      },
    },
  },
}))

vi.mock("@/components/feedback/FeedbackDialog", () => ({
  FeedbackDialog: ({ onClose, prompted }: { onClose: (sent: boolean) => void; prompted?: boolean }) => (
    <div data-testid="fb-dialog" data-prompted={String(prompted)}>
      <button onClick={() => onClose(false)}>close</button>
      <button onClick={() => onClose(true)}>sent</button>
    </div>
  ),
}))

describe("FeedbackPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    promptData = undefined
    releaseData = undefined
  })

  it("đủ điều kiện và Có gì mới đã xem → hiện hộp prompted", () => {
    promptData = { shouldPrompt: true }
    releaseData = { lastSeenRelease: RELEASES[0].version }
    render(<FeedbackPrompt />)
    expect(screen.getByTestId("fb-dialog").getAttribute("data-prompted")).toBe("true")
  })

  it("Có gì mới chưa xem → không hiện, kể cả khi sau đó đã xem trong cùng lượt tải", () => {
    promptData = { shouldPrompt: true }
    releaseData = { lastSeenRelease: null }
    const { rerender } = render(<FeedbackPrompt />)
    expect(screen.queryByTestId("fb-dialog")).toBeNull()
    releaseData = { lastSeenRelease: RELEASES[0].version }
    rerender(<FeedbackPrompt />)
    expect(screen.queryByTestId("fb-dialog")).toBeNull()
  })

  it("shouldPrompt=false hoặc đang tải → không hiện", () => {
    promptData = undefined
    releaseData = { lastSeenRelease: RELEASES[0].version }
    const { rerender } = render(<FeedbackPrompt />)
    expect(screen.queryByTestId("fb-dialog")).toBeNull()
    promptData = { shouldPrompt: false }
    rerender(<FeedbackPrompt />)
    expect(screen.queryByTestId("fb-dialog")).toBeNull()
  })

  it("đóng không gửi → gọi dismissPrompt, hộp biến mất; gửi rồi thì không gọi", () => {
    promptData = { shouldPrompt: true }
    releaseData = { lastSeenRelease: RELEASES[0].version }
    const { unmount } = render(<FeedbackPrompt />)
    fireEvent.click(screen.getByText("close"))
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("fb-dialog")).toBeNull()
    unmount()
    dismiss.mockClear()
    render(<FeedbackPrompt />)
    fireEvent.click(screen.getByText("sent"))
    expect(dismiss).not.toHaveBeenCalled()
  })
})
