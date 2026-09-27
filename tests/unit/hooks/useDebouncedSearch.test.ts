/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useDebouncedSearch, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedSearch"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useDebouncedSearch", () => {
  it("chờ đúng 200ms", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(200)
  })

  it("gõ từng ký tự 'Minh' → chỉ commit 1 lần 'Minh' sau khi ngừng 200ms", () => {
    const commit = vi.fn()
    const { result } = renderHook(({ ext }) => useDebouncedSearch(ext, commit), { initialProps: { ext: "" } })
    for (const ch of ["M", "Mi", "Min", "Minh"]) {
      act(() => result.current[1](ch))
      expect(result.current[0]).toBe(ch)
      act(() => vi.advanceTimersByTime(50))
    }
    act(() => vi.advanceTimersByTime(149))
    expect(commit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith("Minh")
  })

  it("không commit lúc mount", () => {
    const commit = vi.fn()
    renderHook(() => useDebouncedSearch("An", commit))
    act(() => vi.advanceTimersByTime(1000))
    expect(commit).not.toHaveBeenCalled()
  })

  it("giá trị ngoài đổi (xóa lọc) → ô nhập đồng bộ lại, không commit lại", () => {
    const commit = vi.fn()
    const { result, rerender } = renderHook(({ ext }) => useDebouncedSearch(ext, commit), { initialProps: { ext: "An" } })
    rerender({ ext: "" })
    expect(result.current[0]).toBe("")
    act(() => vi.advanceTimersByTime(1000))
    expect(commit).not.toHaveBeenCalled()
  })

  it("URL cập nhật trễ bằng giá trị vừa commit không đè ký tự đang gõ", () => {
    const commit = vi.fn()
    const { result, rerender } = renderHook(({ ext }) => useDebouncedSearch(ext, commit), { initialProps: { ext: "" } })
    act(() => result.current[1]("Min"))
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current[1]("Minh"))
    rerender({ ext: "Min" })
    expect(result.current[0]).toBe("Minh")
  })
})
