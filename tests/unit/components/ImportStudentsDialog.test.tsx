/**
 * @vitest-environment jsdom
 */
// Review #3: file > 2MB không được đọc arrayBuffer() trước khi kiểm kích thước
//   (đọc file lớn vào bộ nhớ trước khi biết là sẽ báo lỗi, tốn tài nguyên vô ích).
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ImportStudentsButton } from "@/components/students/ImportStudentsDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { MAX_IMPORT_FILE_BYTES } from "@/lib/student-import"

const arrayBufferSpy = vi.fn()

vi.mock("@/lib/student-import-excel", () => ({
  buildImportTemplate: vi.fn(),
  readImportWorkbook: vi.fn(),
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    student: {
      importCheck: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      importMany: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

function makeFile(size: number): File {
  const file = new File(["x"], "hoc-sinh.xlsx")
  Object.defineProperty(file, "size", { value: size })
  file.arrayBuffer = arrayBufferSpy.mockResolvedValue(new ArrayBuffer(0))
  return file
}

describe("ImportStudentsDialog", () => {
  it("file > 2MB → báo lỗi size, KHÔNG gọi file.arrayBuffer()", async () => {
    render(
      <LanguageProvider>
        <ImportStudentsButton />
      </LanguageProvider>
    )
    fireEvent.click(screen.getByLabelText("Nhập Excel"))
    const input = screen.getByTestId("import-file-input") as HTMLInputElement
    const file = makeFile(MAX_IMPORT_FILE_BYTES + 1)
    Object.defineProperty(input, "files", { value: [file] })
    fireEvent.change(input)

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("File quá 2MB"))
    expect(arrayBufferSpy).not.toHaveBeenCalled()
  })
})
