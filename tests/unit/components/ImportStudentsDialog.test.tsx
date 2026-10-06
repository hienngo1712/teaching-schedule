/**
 * @vitest-environment jsdom
 */
// Review #3: file > 2MB không được đọc arrayBuffer() trước khi kiểm kích thước
//   (đọc file lớn vào bộ nhớ trước khi biết là sẽ báo lỗi, tốn tài nguyên vô ích).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { toast } from "sonner"
import { ImportStudentsDialog } from "@/components/students/ImportStudentsDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { MAX_IMPORT_FILE_BYTES } from "@/lib/student-import"
import { CONSENT_ACCEPTED } from "@/lib/consent"
import viText from "@/language/vi.json"
import { readImportWorkbook } from "@/lib/student-import-excel"

// jsdom không có ResizeObserver mà Radix Checkbox cần (đo input ẩn).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const arrayBufferSpy = vi.fn()
const checkMutateAsync = vi.fn()
const importMutate = vi.fn()

vi.mock("@/lib/student-import-excel", () => ({
  buildImportTemplate: vi.fn(),
  readImportWorkbook: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    student: {
      importCheck: { useMutation: () => ({ mutateAsync: checkMutateAsync }) },
      importMany: { useMutation: () => ({ mutate: importMutate, isPending: false }) },
    },
  },
}))

function makeFile(size: number): File {
  const file = new File(["x"], "hoc-sinh.xlsx")
  Object.defineProperty(file, "size", { value: size })
  file.arrayBuffer = arrayBufferSpy.mockResolvedValue(new ArrayBuffer(size))
  return file
}

describe("ImportStudentsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("file > 2MB → báo lỗi size, KHÔNG gọi file.arrayBuffer()", async () => {
    render(
      <LanguageProvider>
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )
    const input = screen.getByTestId("import-file-input") as HTMLInputElement
    const file = makeFile(MAX_IMPORT_FILE_BYTES + 1)
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("File quá 2MB"))
    expect(arrayBufferSpy).not.toHaveBeenCalled()
  })

  it("chọn file hợp lệ → xem trước: nút nhập disabled tới khi tick ô đồng ý → gọi mutate với consent", async () => {
    const mockRows = [
      {
        rowNumber: 2,
        input: { fullName: "Nguyễn Văn An", grade: 3, tuitionFee: 100000 },
        errors: [],
      },
    ]
    vi.mocked(readImportWorkbook).mockResolvedValue({ ok: true, rows: mockRows, missingFee: false })
    checkMutateAsync.mockResolvedValue({ matches: [null] })

    render(
      <LanguageProvider>
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )

    const input = screen.getByTestId("import-file-input") as HTMLInputElement
    const file = makeFile(1024)
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    // Bước xem trước xuất hiện
    const submitBtn = await screen.findByRole("button", { name: viText.import_submit.replace("{n}", "1") })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)

    // Tick checkbox
    const checkbox = screen.getByRole("checkbox", { name: viText.consent_import })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(checkbox)
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false)

    // Bấm nhập
    fireEvent.click(submitBtn)
    await waitFor(() => expect(importMutate).toHaveBeenCalledTimes(1))
    expect(importMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: CONSENT_ACCEPTED,
        rows: expect.arrayContaining([
          expect.objectContaining({ fullName: "Nguyễn Văn An", grade: 3 }),
        ]),
      })
    )
  })

  it("U9: xem trước nhập 1 dòng Cách thu = tháng, Học phí = 400000 -> dòng xem trước có 400.000 và /tháng, không có 0 ₫", async () => {
    const mockRows = [
      {
        status: "ok" as const,
        rowNumber: 2,
        input: { fullName: "Trần Thị Tháng", grade: 5, tuitionFee: 0, billingMode: "monthly" as const, monthlyFee: 400000 },
        errors: [],
      },
    ]
    vi.mocked(readImportWorkbook).mockResolvedValue({ ok: true, rows: mockRows, missingFee: false })
    checkMutateAsync.mockResolvedValue({ matches: [null] })

    render(
      <LanguageProvider forcedLanguage="vi">
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )

    const input = screen.getByTestId("import-file-input") as HTMLInputElement
    const file = makeFile(1024)
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await screen.findByRole("button", { name: viText.import_submit.replace("{n}", "1") })
    const rowEl = screen.getByTestId("import-row")
    expect(rowEl.textContent).toContain("400.000")
    expect(rowEl.textContent).toContain("/tháng")
    expect(rowEl.textContent).not.toMatch(/(?:^|\s)0\s*[₫đ]/)
  })

  it("khối Google Form: mặc định gập, mở ra có nút forms.new (tab mới) + 5 câu hỏi + link hướng dẫn", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )
    const box = screen.getByTestId("import-google-form")
    expect(box.tagName).toBe("DETAILS")
    expect(box.hasAttribute("open")).toBe(false)
    fireEvent.click(screen.getByText("Chưa có danh sách? Nhờ phụ huynh điền qua Google Form"))
    const link = within(box).getByRole("link", { name: /Tạo Google Form/ })
    expect(link.getAttribute("href")).toBe("https://forms.new")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(link.textContent).toContain("(mở tab mới)")
    const items = within(box).getAllByTestId("google-form-question")
    expect(items.map((li) => li.querySelector("code")?.textContent)).toEqual(["Họ tên", "Lớp", "Tên phụ huynh", "SĐT phụ huynh", "Ghi chú"])
    expect(items[0].textContent).toContain("bật Bắt buộc")
    expect(items[2].textContent).not.toContain("bật Bắt buộc")
    expect(within(box).getByRole("link", { name: /Xem hướng dẫn chi tiết/ }).getAttribute("href")).toBe("/guide#nhap-excel")
  })

  it("bấm Sao chép → ghi đúng tên câu hỏi vào clipboard, báo đã sao chép", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(
      <LanguageProvider forcedLanguage="vi">
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: 'Sao chép "SĐT phụ huynh"' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("SĐT phụ huynh"))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã sao chép "SĐT phụ huynh"'))
  })

  it("clipboard bị chặn → báo lỗi, không vỡ", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } })
    render(
      <LanguageProvider forcedLanguage="vi">
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: 'Sao chép "Họ tên"' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Trình duyệt chặn sao chép, hãy gõ tay tên câu hỏi."))
  })

  it("file không có cột học phí → xem trước hiện dòng nhắc học phí 0đ", async () => {
    const mockRows = [
      {
        status: "ok" as const,
        rowNumber: 2,
        input: { fullName: "Nguyễn An", grade: 5, tuitionFee: 0, billingMode: "per_session" as const },
        errors: [],
      },
    ]
    vi.mocked(readImportWorkbook).mockResolvedValue({ ok: true, rows: mockRows, missingFee: true })
    checkMutateAsync.mockResolvedValue({ matches: [null] })

    render(
      <LanguageProvider forcedLanguage="vi">
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )
    const input = screen.getByTestId("import-file-input") as HTMLInputElement
    const file = makeFile(1024)
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    expect(await screen.findByTestId("import-missing-fee")).toBeTruthy()
  })

  it("file mẫu chuẩn → không có dòng nhắc", async () => {
    const mockRows = [
      {
        status: "ok" as const,
        rowNumber: 2,
        input: { fullName: "Nguyễn An", grade: 5, tuitionFee: 150000, billingMode: "per_session" as const },
        errors: [],
      },
    ]
    vi.mocked(readImportWorkbook).mockResolvedValue({ ok: true, rows: mockRows, missingFee: false })
    checkMutateAsync.mockResolvedValue({ matches: [null] })

    render(
      <LanguageProvider forcedLanguage="vi">
        <ImportStudentsDialog onClose={() => {}} />
      </LanguageProvider>
    )
    const input = screen.getByTestId("import-file-input") as HTMLInputElement
    const file = makeFile(1024)
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await screen.findByTestId("import-summary")
    expect(screen.queryByTestId("import-missing-fee")).toBeNull()
  })
})
