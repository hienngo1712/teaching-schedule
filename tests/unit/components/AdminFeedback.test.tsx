/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminFeedback } from "@/components/admin/AdminFeedback"

const page1 = {
  items: [
    { id: 2, rating: 5, message: "Dòng 1\nDòng 2 <b>x</b>", page: "/students", appVersion: "0.13.0", createdAt: new Date("2026-10-06T03:00:00Z"), username: "co_lan", fullName: "Cô Lan" },
    { id: 1, rating: 2, message: null, page: "/tuition", appVersion: "0.13.0", createdAt: new Date("2026-10-05T03:00:00Z"), username: "thay_minh", fullName: null },
  ],
  nextCursor: 1, total: 2, average: 3.5, counts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 },
}

let pages: unknown[] = [page1]
let hasNextPage = true
let isPending = false
let isError = false
const fetchNextPage = vi.fn()
const refetch = vi.fn()

vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      feedbackList: {
        useInfiniteQuery: () => ({
          data: isPending || isError ? undefined : { pages },
          isPending,
          isError,
          hasNextPage,
          fetchNextPage,
          isFetchingNextPage: false,
          refetch,
        }),
      },
    },
  },
}))

function ui(lang: "vi" | "en" = "vi") {
  return (
    <LanguageProvider forcedLanguage={lang}>
      <AdminFeedback />
    </LanguageProvider>
  )
}

describe("AdminFeedback", () => {
  beforeEach(() => {
    pages = [page1]
    hasNextPage = true
    isPending = false
    isError = false
    fetchNextPage.mockReset()
    refetch.mockReset()
  })

  it("đầu trang: điểm trung bình, tổng, đếm từng mức sao", () => {
    render(ui())
    expect(screen.getByTestId("feedback-average").textContent).toContain("3,5")
    expect(screen.getByText("2 góp ý")).toBeTruthy()
    expect(screen.getByTestId("feedback-count-5").textContent).toContain("1")
    expect(screen.getByTestId("feedback-count-3").textContent).toContain("0")
  })

  it("mỗi góp ý: sao, nội dung giữ xuống dòng và không render HTML, tài khoản, trang, bản", () => {
    render(ui())
    const cards = screen.getAllByTestId("feedback-item")
    expect(cards).toHaveLength(2)
    expect(cards[0].querySelector("b")).toBeNull()
    expect(cards[0].textContent).toContain("<b>x</b>")
    expect(cards[0].querySelector(".whitespace-pre-line")).not.toBeNull()
    expect(cards[0].textContent).toContain("co_lan")
    expect(cards[0].textContent).toContain("/students")
    expect(cards[0].textContent).toContain("0.13.0")
    expect(cards[1].textContent).toContain("(Không ghi nội dung)")
    expect(screen.getAllByLabelText("5 sao").length).toBeGreaterThan(0)
  })

  it("Xem thêm gọi fetchNextPage; hết trang thì ẩn", () => {
    render(ui())
    fireEvent.click(screen.getByRole("button", { name: "Xem thêm" }))
    expect(fetchNextPage).toHaveBeenCalled()
    hasNextPage = false
    cleanup()
    render(ui())
    expect(screen.queryByRole("button", { name: "Xem thêm" })).toBeNull()
  })

  it("chưa có góp ý → chữ trống, average hiện -", () => {
    pages = [{ items: [], nextCursor: null, total: 0, average: null, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }]
    render(ui())
    expect(screen.getByText("Chưa có góp ý nào")).toBeTruthy()
    expect(screen.getByTestId("feedback-average").textContent).toContain("-")
  })

  it("giao diện tiếng Anh → điểm trung bình dùng dấu chấm", () => {
    render(ui("en"))
    expect(screen.getByTestId("feedback-average").textContent).toContain("3.5")
  })
})
