/**
 * @vitest-environment jsdom
 */
// FIX AL F3: Lịch lặp có ô Nơi dạy cùng quy tắc form ca (chỉ hiện khi ≥ 2 nơi; mặc định theo HS đầu, rồi nơi theo học sinh đầu tiên).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const checkMutate = vi.fn()
vi.mock("@/lib/trpc", () => ({
  trpc: {
    subject: { list: { useQuery: () => ({ data: [{ id: 1, name: "Toán", color: "#000", isDefault: true }] }) } },
    student: { list: { useQuery: () => ({ data: { items: [{ id: 5, placeId: 2 }] } }) } },
    session: {
      bulkCreate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      checkBulkConflicts: { useMutation: () => ({ mutate: checkMutate, isPending: false }) },
      addRecurringStudents: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))
const placeState = vi.hoisted(() => ({ places: [] as { id: number; name: string; color: string; billing: string }[] }))
vi.mock("@/hooks/usePlaceSummary", () => ({
  usePlaceSummary: () => ({ places: placeState.places, multi: placeState.places.length >= 2 }),
}))
vi.mock("@/components/places/PlaceSelect", () => ({
  PlaceSelect: ({ id, value, onChange }: { id?: string; value?: number; onChange: (v: number) => void }) => (
    <select id={id} data-testid="place-select" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="" />
      {placeState.places.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  ),
}))
vi.mock("@/components/sessions/StudentPicker", () => ({
  StudentPicker: ({ onChange }: { onChange: (ids: number[]) => void }) => (
    <button type="button" onClick={() => onChange([5])}>chọn HS 5</button>
  ),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { BulkCreateDialog } from "@/components/sessions/BulkCreateDialog"

const HOME = { id: 1, name: "Lớp tại nhà", color: "#4F46E5", billing: "per_student" }
const CENTER = { id: 2, name: "TT Ánh Dương", color: "#0891B2", billing: "per_session" }

function renderDialog() {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <BulkCreateDialog open onOpenChange={() => {}} />
    </LanguageProvider>
  )
}

async function submit() {
  fireEvent.click(screen.getByRole("checkbox", { name: "T2" }))
  fireEvent.click(screen.getByRole("button", { name: "Tạo lịch lặp" }))
  await waitFor(() => expect(checkMutate).toHaveBeenCalledTimes(1))
  return checkMutate.mock.calls[0][0]
}

beforeEach(() => {
  checkMutate.mockReset()
  placeState.places = [HOME]
})

describe("BulkCreateDialog: Nơi dạy (FIX AL F3)", () => {
  it("TK 1 nơi: không có ô Nơi dạy, không gửi placeId", async () => {
    renderDialog()
    expect(screen.queryByText("Nơi dạy")).toBeNull()
    expect(await submit()).not.toHaveProperty("placeId")
  })

  it("≥ 2 nơi: có ô Nơi dạy, mặc định nơi theo học sinh đầu tiên, gửi placeId", async () => {
    placeState.places = [CENTER, HOME]
    renderDialog()
    expect(screen.getByLabelText("Nơi dạy")).toBeTruthy()
    expect(await submit()).toMatchObject({ placeId: HOME.id })
  })

  it("chọn HS → theo nơi học của HS đầu; tự chọn nơi thì giữ nơi đã chọn", async () => {
    placeState.places = [CENTER, HOME]
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "chọn HS 5" }))
    await waitFor(() => expect((screen.getByTestId("place-select") as HTMLSelectElement).value).toBe(String(CENTER.id)))
    fireEvent.change(screen.getByTestId("place-select"), { target: { value: String(HOME.id) } })
    expect(await submit()).toMatchObject({ placeId: HOME.id, studentIds: [5] })
  })

  it("tab Gán HS vào lịch sẵn: không có ô Nơi dạy", () => {
    placeState.places = [CENTER, HOME]
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Gán HS vào lịch sẵn" }))
    expect(screen.queryByLabelText("Nơi dạy")).toBeNull()
  })
})
