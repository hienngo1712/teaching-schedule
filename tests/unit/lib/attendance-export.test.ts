// Spec AN §3: Excel Chuyên cần tháng / năm học.
import { describe, it, expect } from "vitest"
import viText from "@/language/vi.json"
import { attendanceMonthTable, attendanceYearTable } from "@/lib/attendance-export"
import { schoolYearMonths } from "@/server/services/attendance-report.service"

const t = (k: string) => (viText as Record<string, string>)[k] ?? k
const student = { studentId: 1, fullName: "An", grade: 5, isDeleted: false, present: 2, late: 1, absent: 1, recorded: 3, rate: 66.7 }

describe("attendance-export", () => {
  it("bảng tháng: có mặt/tổng, tỉ lệ dấu phẩy", () => {
    const { header, rows } = attendanceMonthTable({ stats: { present: 2, late: 1, absent: 1, recorded: 3, rate: 66.7 }, students: [student] }, t)
    expect(header).toEqual(["STT", "Học sinh", "Lớp", "Có mặt", "Muộn", "Vắng", "Có mặt / tổng", "Tỉ lệ"])
    expect(rows).toEqual([[1, "An", 5, 2, 1, 1, "2/3", "66,7%"]])
  })

  it("bảng năm học: 9 cột tháng T9 → T5, tháng không có buổi để trống", () => {
    const months = schoolYearMonths(2026)
    const { header, rows } = attendanceYearTable(
      {
        months,
        stats: { present: 2, late: 1, absent: 1, recorded: 3, rate: 66.7 },
        students: [{ ...student, months: months.map((m, i) => ({ ...m, rate: i === 0 ? 100 : null })) }],
      },
      t
    )
    expect(header.slice(3, 12)).toEqual(["T9/2026", "T10/2026", "T11/2026", "T12/2026", "T1/2027", "T2/2027", "T3/2027", "T4/2027", "T5/2027"])
    expect(rows[0].slice(3)).toEqual(["100%", "", "", "", "", "", "", "", "", "66,7%"])
  })
})
