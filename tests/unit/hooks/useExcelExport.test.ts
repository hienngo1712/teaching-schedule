/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useExcelExport } from "@/hooks/useExcelExport"
import ExcelJS from "exceljs"

// Mock saveAs để không tải file thật
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}))

describe("useExcelExport - U10: exportStudentSchedule với học phí trọn tháng", () => {
  it("tuitionInfo.billingMode = 'monthly' -> ô A6 = 'Học phí tháng (trọn gói)', D6 = '400.000 ₫'", async () => {
    let capturedWorkbook: ExcelJS.Workbook | null = null
    const origAddWorksheet = ExcelJS.Workbook.prototype.addWorksheet
    ExcelJS.Workbook.prototype.addWorksheet = function (this: ExcelJS.Workbook, ...args: Parameters<typeof origAddWorksheet>) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      capturedWorkbook = this
      return origAddWorksheet.apply(this, args)
    }
    const origWriteBuffer = ExcelJS.Workbook.prototype.xlsx.writeBuffer
    ExcelJS.Workbook.prototype.xlsx.writeBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))

    try {
      const { result } = renderHook(() => useExcelExport())
      await act(async () => {
        await result.current.exportStudentSchedule(
          { id: 1, fullName: "HS Trọn Tháng", grade: 5 },
          [],
          { total: 0, present: 0, absent: 0, late: 0, rate: 0 },
          "Tháng 5/2026",
          {
            tuitionFeePerSession: 50000,
            currentMonthFee: 400000,
            previousBalance: 0,
            totalAmountDue: 400000,
            billingMode: "monthly",
            monthlyFee: 400000,
          }
        )
      })

      expect(capturedWorkbook).not.toBeNull()
      const ws = capturedWorkbook!.getWorksheet("HS Trọn Tháng")
      expect(ws).toBeDefined()
      expect(ws!.getCell("A6").value).toBe("Học phí tháng (trọn gói)")
      expect(ws!.getCell("D6").value).toBe("400.000 đ")
    } finally {
      ExcelJS.Workbook.prototype.addWorksheet = origAddWorksheet
      ExcelJS.Workbook.prototype.xlsx.writeBuffer = origWriteBuffer
    }
  })
})
