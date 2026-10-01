/**
 * @vitest-environment jsdom
 */
// Review #3: file > 2MB không được đọc arrayBuffer() trước khi kiểm kích thước
//   (đọc file lớn vào bộ nhớ trước khi biết là sẽ báo lỗi, tốn tài nguyên vô ích).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
    vi.mocked(readImportWorkbook).mockResolvedValue({ ok: true, rows: mockRows })
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
    vi.mocked(readImportWorkbook).mockResolvedValue({ ok: true, rows: mockRows })
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
})
