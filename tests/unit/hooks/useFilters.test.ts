/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react"
import { useFilters } from "@/hooks/useFilters"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))

describe("useFilters", () => {
  const mockPush = vi.fn()
  const mockPathname = "/calendar"
  
  beforeEach(() => {
    vi.clearAllMocks()
    ;vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>)
    ;vi.mocked(usePathname).mockReturnValue(mockPathname)
  })

  it("should initialize with null/empty values", () => {
    ;vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("") as ReturnType<typeof useSearchParams>)
    const { result } = renderHook(() => useFilters())
    
    expect(result.current.selectedGrade).toBeNull()
    expect(result.current.searchStudentName).toBe("")
    expect(result.current.selectedStudentId).toBeNull()
    expect(result.current.hasActiveFilter).toBe(false)
  })

  it("should get values from search params", () => {
    ;vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("grade=3&studentName=An&studentId=123") as ReturnType<typeof useSearchParams>)
    const { result } = renderHook(() => useFilters())
    
    expect(result.current.selectedGrade).toBe(3)
    expect(result.current.searchStudentName).toBe("An")
    expect(result.current.selectedStudentId).toBe(123)
    expect(result.current.hasActiveFilter).toBe(true)
  })

  it("should set grade and clear studentId", () => {
    ;vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("studentId=123") as ReturnType<typeof useSearchParams>)
    const { result } = renderHook(() => useFilters())
    
    act(() => {
      result.current.setGrade(5)
    })
    
    expect(mockPush).toHaveBeenCalledWith("/calendar?grade=5")
  })

  it("should set student name and clear studentId", () => {
    ;vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("studentId=123") as ReturnType<typeof useSearchParams>)
    const { result } = renderHook(() => useFilters())
    
    act(() => {
      result.current.setSearch("Bình")
    })
    
    expect(mockPush).toHaveBeenCalledWith("/calendar?studentName=B%C3%ACnh")
  })

  it("should set studentId", () => {
    ;vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("grade=3") as ReturnType<typeof useSearchParams>)
    const { result } = renderHook(() => useFilters())
    
    act(() => {
      result.current.setStudentId(456)
    })
    
    expect(mockPush).toHaveBeenCalledWith("/calendar?grade=3&studentId=456")
  })

  it("should reset filters", () => {
    ;vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("grade=3&studentName=An") as ReturnType<typeof useSearchParams>)
    const { result } = renderHook(() => useFilters())
    
    act(() => {
      result.current.resetFilters()
    })
    
    expect(mockPush).toHaveBeenCalledWith("/calendar")
  })
})
