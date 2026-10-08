/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { isTourActive, setTourActive, useTourActive } from "@/lib/tour-store"

afterEach(() => setTourActive(false))

describe("tour-store", () => {
  it("hook đổi theo setTourActive", () => {
    const { result } = renderHook(() => useTourActive())
    expect(result.current).toBe(false)
    act(() => setTourActive(true))
    expect(result.current).toBe(true)
    expect(isTourActive()).toBe(true)
    act(() => setTourActive(false))
    expect(result.current).toBe(false)
  })
})
