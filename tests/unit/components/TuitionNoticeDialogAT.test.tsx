/**
 * @vitest-environment jsdom
 */
// AT: ô nhận xét tháng + nút link phụ huynh trong hộp phiếu học phí.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TuitionNoticeDialog } from "@/components/tuition/TuitionNoticeDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { saveAs } from "file-saver"

vi.mock("file-saver", () => ({ saveAs: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))
vi.mock("@/lib/share-image", () => ({
  canShareFiles: vi.fn(() => false),
  elementToPngBlob: vi.fn(() => Promise.resolve(new Blob(["x"]))),
  shareOrDownloadPng: vi.fn(),
}))
vi.mock("qrcode", () => ({ toDataURL: () => Promise.resolve("data:image/png;base64,x") }))

const h = vi.hoisted(() => ({
  saveMutate: vi.fn(),
  gate: { locked: false, allowed: true, openUpgrade: vi.fn() },
  linkProps: [] as unknown[],
}))

vi.mock("@/hooks/useFeatureGate", () => ({ useFeatureGate: () => h.gate }))
vi.mock("@/components/students/ParentLinkDialog", () => ({
  ParentLinkDialog: (props: { student: unknown; canGenerate?: boolean }) => {
    h.linkProps.push(props)
    return <div data-testid="parent-link-dialog" />
  },
}))

let data: Record<string, unknown>
let updatedAt = 1
let isError = false
let saveOpts: { onSuccess?: () => void; onError?: () => void } = {}
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ tuition: { getMonthlyStatus: { invalidate: vi.fn() } }, client: { tuition: { setNoticeSent: { mutate: vi.fn() } } } }),
    tuition: {
      getNotice: { useQuery: () => ({ data, isError, dataUpdatedAt: updatedAt, refetch: vi.fn() }) },
      setNoticeSent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveParentComment: {
        useMutation: (opts?: typeof saveOpts) => {
          saveOpts = opts ?? {}
          return { mutate: h.saveMutate, isPending: false }
        },
      },
    },
  },
}))

function notice(over: Record<string, unknown> = {}) {
  return {
    studentId: 1, fullName: "Nguyễn Văn A", grade: 5, year: 2026, month: 10, presentSessions: 0, totalSessions: 0,
    billingMode: "per_session", currentMonthFee: 0, previousBalance: 0, totalAmountDue: 0, paidAmount: 0,
    isFullPaid: false, presentDates: [], payments: [], remaining: 0, overpaid: 0, teacherName: "GV",
    bankConfigured: false, qr: null, parentComment: null, parentLinkToken: null, placeId: null, ...over,
  }
}

const ui = () => (
  <LanguageProvider forcedLanguage="vi">
    <TuitionNoticeDialog studentId={1} year={2026} month={10} onClose={() => {}} />
  </LanguageProvider>
)
const renderDialog = () => render(ui())

beforeEach(() => {
  vi.clearAllMocks()
  h.gate = { locked: false, allowed: true, openUpgrade: vi.fn() }
  h.linkProps = []
  updatedAt = 1
  isError = false
  saveOpts = {}
  window.URL.createObjectURL = vi.fn().mockReturnValue("blob:x")
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("TuitionNoticeDialog: nhận xét tháng (AT)", () => {
  it("ô nhận xét điền sẵn nội dung đã lưu; nút Lưu chỉ bật khi có thay đổi; bấm Lưu gửi đúng HS × tháng", () => {
    data = notice({ parentComment: "Cũ" })
    renderDialog()
    const box = screen.getByLabelText(/Nhận xét tháng/) as HTMLTextAreaElement
    expect(box.value).toBe("Cũ")
    const save = screen.getByRole("button", { name: "Lưu nhận xét" })
    expect(save.hasAttribute("disabled")).toBe(true)

    fireEvent.change(box, { target: { value: "Con ngoan.\nCố lên" } })
    expect(save.hasAttribute("disabled")).toBe(false)
    fireEvent.click(save)
    expect(h.saveMutate).toHaveBeenCalledWith({ studentId: 1, year: 2026, month: 10, parentComment: "Con ngoan.\nCố lên" })
  })

  it("giới hạn 2000 ký tự trên ô nhập", () => {
    data = notice()
    renderDialog()
    expect((screen.getByLabelText(/Nhận xét tháng/) as HTMLTextAreaElement).maxLength).toBe(2000)
  })
})

describe("TuitionNoticeDialog: không mất nhận xét (AT, LEADER điểm 5)", () => {
  it("rời ô (blur) có thay đổi → tự lưu (đã cắt khoảng trắng); blur lại không đổi gì → không lưu lần 2", () => {
    data = notice({ parentComment: "Cũ" })
    renderDialog()
    const box = screen.getByLabelText(/Nhận xét tháng/)
    fireEvent.blur(box)
    expect(h.saveMutate).not.toHaveBeenCalled()

    fireEvent.change(box, { target: { value: "  Mới  " } })
    fireEvent.blur(box)
    expect(h.saveMutate).toHaveBeenCalledTimes(1)
    expect(h.saveMutate).toHaveBeenCalledWith({ studentId: 1, year: 2026, month: 10, parentComment: "Mới" })
    fireEvent.blur(box)
    expect(h.saveMutate).toHaveBeenCalledTimes(1)
  })

  it("không có thay đổi → bấm Tải ảnh xuất ngay, không lưu", async () => {
    data = notice({ parentComment: "Cũ" })
    renderDialog()
    const dl = screen.getByRole("button", { name: /Tải ảnh/ })
    await waitFor(() => expect(dl.hasAttribute("disabled")).toBe(false))
    fireEvent.click(dl)
    expect(saveAs).toHaveBeenCalledTimes(1)
    expect(h.saveMutate).not.toHaveBeenCalled()
  })

  it("còn nhận xét chưa lưu → bấm Tải ảnh: lưu trước, chỉ xuất khi phiếu đã có nhận xét mới", async () => {
    data = notice({ parentComment: null })
    const { rerender } = renderDialog()
    const dl = screen.getByRole("button", { name: /Tải ảnh/ })
    await waitFor(() => expect(dl.hasAttribute("disabled")).toBe(false))

    fireEvent.change(screen.getByLabelText(/Nhận xét tháng/), { target: { value: "Con ngoan" } })
    fireEvent.click(dl)
    expect(h.saveMutate).toHaveBeenCalledWith({ studentId: 1, year: 2026, month: 10, parentComment: "Con ngoan" })
    expect(saveAs).not.toHaveBeenCalled()

    // Lưu xong → TRPCProvider refetch → phiếu có nhận xét mới, card chụp lại → mới xuất.
    saveOpts.onSuccess?.()
    data = notice({ parentComment: "Con ngoan" })
    updatedAt = 2
    rerender(ui())
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId("notice-comment").textContent).toContain("Con ngoan")
  })

  it("lưu lỗi → không xuất ảnh cũ", async () => {
    data = notice({ parentComment: null })
    const { rerender } = renderDialog()
    const dl = screen.getByRole("button", { name: /Tải ảnh/ })
    await waitFor(() => expect(dl.hasAttribute("disabled")).toBe(false))
    fireEvent.change(screen.getByLabelText(/Nhận xét tháng/), { target: { value: "X" } })
    fireEvent.click(dl)
    saveOpts.onError?.()
    rerender(ui())
    await new Promise((r) => setTimeout(r, 20))
    expect(saveAs).not.toHaveBeenCalled()
  })
})

describe("TuitionNoticeDialog: link phụ huynh (AT)", () => {
  it("bấm Link phụ huynh → mở ParentLinkDialog với token + placeId của HS", () => {
    data = notice({ parentLinkToken: "tok", placeId: 3 })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Link phụ huynh" }))
    expect(screen.getByTestId("parent-link-dialog")).toBeTruthy()
    expect(h.linkProps.at(-1)).toMatchObject({
      student: { id: 1, fullName: "Nguyễn Văn A", parentLinkToken: "tok", placeId: 3 },
      canGenerate: true,
    })
  })

  it("gói không có tính năng + HS chưa có link → mở hộp nâng cấp, không mở ParentLinkDialog", () => {
    h.gate = { locked: true, allowed: false, openUpgrade: vi.fn() }
    data = notice({ parentLinkToken: null })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Link phụ huynh" }))
    expect(h.gate.openUpgrade).toHaveBeenCalled()
    expect(screen.queryByTestId("parent-link-dialog")).toBeNull()
  })

  it("gói bị khoá nhưng HS đã có link → vẫn mở dialog (canGenerate=false)", () => {
    h.gate = { locked: true, allowed: false, openUpgrade: vi.fn() }
    data = notice({ parentLinkToken: "tok" })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Link phụ huynh" }))
    expect(h.gate.openUpgrade).not.toHaveBeenCalled()
    expect(h.linkProps.at(-1)).toMatchObject({ canGenerate: false })
  })

  it("đã có link → nút Sao chép link phụ huynh chép ngay vào clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    data = notice({ parentLinkToken: "tok" })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Sao chép link phụ huynh" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/p/tok`))
  })

  it("chưa có link → không có nút sao chép nhanh", () => {
    data = notice({ parentLinkToken: null })
    renderDialog()
    expect(screen.queryByRole("button", { name: "Sao chép link phụ huynh" })).toBeNull()
  })
})

describe("TuitionNoticeDialog: sửa lỗi QA vòng 3 (AT)", () => {
  it("[QA-4] lưu xong nhưng tải lại phiếu lỗi → huỷ lệnh xuất đang chờ, mở khoá nút, báo lỗi", async () => {
    const { toast } = await import("sonner")
    data = notice({ parentComment: null })
    const { rerender } = renderDialog()
    const dl = screen.getByRole("button", { name: /Tải ảnh/ })
    await waitFor(() => expect(dl.hasAttribute("disabled")).toBe(false))
    fireEvent.change(screen.getByLabelText(/Nhận xét tháng/), { target: { value: "Mới" } })
    fireEvent.click(dl)
    expect(screen.getByRole("button", { name: /Tải ảnh/ }).hasAttribute("disabled")).toBe(true)

    saveOpts.onSuccess?.()
    isError = true
    rerender(ui())
    await waitFor(() => expect(screen.getByRole("button", { name: /Tải ảnh/ }).hasAttribute("disabled")).toBe(false))
    expect(toast.error).toHaveBeenCalled()
    expect(saveAs).not.toHaveBeenCalled()
  })

  it("[QA-3] đang lưu B, sửa về đúng bản đã lưu A rồi blur → vẫn gửi A (so với bản đang gửi)", () => {
    data = notice({ parentComment: "A" })
    renderDialog()
    const box = screen.getByLabelText(/Nhận xét tháng/)
    fireEvent.change(box, { target: { value: "B" } })
    fireEvent.blur(box)
    fireEvent.change(box, { target: { value: "A" } })
    fireEvent.blur(box)
    expect(h.saveMutate).toHaveBeenCalledTimes(2)
    expect(h.saveMutate).toHaveBeenLastCalledWith({ studentId: 1, year: 2026, month: 10, parentComment: "A" })
  })

  it("[QA-2/QA-5] cụm link phụ huynh nằm hàng riêng (w-full) cả mobile lẫn desktop, footer cho xuống dòng", () => {
    data = notice({ parentLinkToken: "tok" })
    renderDialog()
    const linkBtn = screen.getByRole("button", { name: "Link phụ huynh" })
    const group = linkBtn.parentElement!
    expect(group.contains(screen.getByRole("button", { name: "Sao chép link phụ huynh" }))).toBe(true)
    expect(group.className).toMatch(/\bw-full\b/)
    // QA-5: desktop cũng 2 hàng (hộp 460px không chứa nổi 4 nút 1 hàng).
    expect(group.className).not.toMatch(/md:w-auto/)
    const footer = group.parentElement!
    expect(footer.className).toMatch(/\bflex-wrap\b/)
    expect(footer.className).not.toMatch(/md:flex-nowrap/)
    // Nút chạm ≥ 44px trên mobile.
    expect(linkBtn.className).toMatch(/\bh-11\b/)
  })
})
