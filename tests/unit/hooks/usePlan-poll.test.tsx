/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

const useQuery = vi.fn<(...args: unknown[]) => { data: undefined }>(() => ({ data: undefined }))
vi.mock("@/lib/trpc", () => ({ trpc: { plan: { me: { useQuery: (...a: unknown[]) => useQuery(...a) } } } }))
import { usePlan } from "@/hooks/usePlan"

type Opts = { refetchInterval?: (q: { state: { data?: unknown } }) => number | false } | undefined
const optsOf = () => useQuery.mock.calls.at(-1)?.[1] as Opts
const payosPending = { state: { data: { pendingOrder: { method: "payos" } } } }

beforeEach(() => useQuery.mockClear())

describe("usePlan: hỏi lại đơn payOS chỉ ở nơi cần (trang Gói)", () => {
  it("mặc định (sidebar, banner…) không hỏi lại dù có đơn payOS chờ", () => {
    renderHook(() => usePlan())
    expect(optsOf()?.refetchInterval?.(payosPending) ?? false).toBe(false)
  })
  it("poll: true → 5s khi có đơn payOS chờ, dừng khi không còn", () => {
    renderHook(() => usePlan({ poll: true }))
    expect(optsOf()?.refetchInterval?.(payosPending)).toBe(5000)
    expect(optsOf()?.refetchInterval?.({ state: { data: { pendingOrder: null } } })).toBe(false)
  })
})
