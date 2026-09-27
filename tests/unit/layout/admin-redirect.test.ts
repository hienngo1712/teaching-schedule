import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; username: string; fullName: string | null }; expires: string },
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock("@/server/auth", () => ({ auth: async () => mocks.session }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/providers/SessionProvider", () => ({ SessionProvider: ({ children }: { children: unknown }) => children }))
vi.mock("@/app/login/LoginForm", () => ({ LoginForm: () => null }))
vi.mock("@/app/login/LoginHeader", () => ({ LoginHeader: () => null }))

import AppGroupLayout from "@/app/(app)/layout"
import LoginPage from "@/app/login/page"

const original = process.env.ADMIN_USERNAMES
const as = (username: string) => ({ user: { id: "1", username, fullName: null }, expires: "" })

beforeEach(() => {
  process.env.ADMIN_USERNAMES = "admin_test"
  mocks.redirect.mockClear()
})
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_USERNAMES
  else process.env.ADMIN_USERNAMES = original
})

// Lớp 2 (spec J Q3): middleware bị bỏ qua hoặc Edge thiếu env thì server vẫn chuyển admin.
describe("(app)/layout", () => {
  it("admin → redirect /admin/orders", async () => {
    mocks.session = as("admin_test")
    await expect(AppGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /admin/orders")
  })

  it("giáo viên → render bình thường, không redirect", async () => {
    mocks.session = as("teacher")
    await expect(AppGroupLayout({ children: "x" })).resolves.toBeTruthy()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})

describe("/login khi đã đăng nhập", () => {
  it("admin → /admin/orders, giáo viên → /dashboard", async () => {
    mocks.session = as("admin_test")
    await expect(LoginPage()).rejects.toThrow("REDIRECT /admin/orders")
    mocks.session = as("teacher")
    await expect(LoginPage()).rejects.toThrow("REDIRECT /dashboard")
  })
})
