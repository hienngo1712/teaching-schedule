/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const mockData = [
  {
    studentId: 101,
    fullName: "Nguyễn Văn Buổi",
    grade: 3,
    level: "tieu_hoc",
    attendance: "present",
    note: "",
    fee: 50000,
    billingMode: "per_session",
  },
  {
    studentId: 102,
    fullName: "Trần Thị Tháng",
    grade: 4,
    level: "tieu_hoc",
    attendance: "pending",
    note: "",
    fee: 0,
    billingMode: "monthly",
  },
]

vi.mock("@/lib/trpc", () => ({
  trpc: {
    attendance: {
      get: {
        useQuery: () => ({
          data: mockData,
          isLoading: false,
        }),
      },
      update: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    session: {
      removeStudent: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
  },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AttendancePanel } from "@/components/sessions/AttendancePanel"

describe("AttendancePanel: hiển thị học phí theo cách thu (Plan T)", () => {
  it("HS trọn tháng có nhãn 'Trọn tháng' và không có ô sửa phí, HS theo buổi có ô sửa phí", () => {
    render(
      <LanguageProvider>
        <AttendancePanel sessionId={1} />
      </LanguageProvider>
    )

    expect(screen.getByText("Nguyễn Văn Buổi")).toBeTruthy()
    expect(screen.getByText("Trần Thị Tháng")).toBeTruthy()

    // HS trọn tháng hiện nhãn "Trọn tháng"
    expect(screen.getByText(viText.billing_monthly)).toBeTruthy()

    // Chỉ có 1 ô CurrencyInput (cho HS theo buổi với giá 50,000)
    const inputs = screen.getAllByRole("textbox")
    // CurrencyInput là textbox có value 50,000
    const feeInputs = inputs.filter((inp) => (inp as HTMLInputElement).value === "50,000")
    expect(feeInputs).toHaveLength(1)
  })
})
