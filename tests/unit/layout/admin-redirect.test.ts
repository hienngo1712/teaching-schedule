import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; username: string; fullName: string | null; mustChangePassword?: boolean }; expires: string },
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))
vi.mock("@/server/auth", () => ({ auth: async () => mocks.session }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))
vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/providers/SessionProvider", () => ({ SessionProvider: ({ children }: { children: unknown }) => children }))
vi.mock("@/app/login/LoginForm", () => ({ LoginForm: () => null }))
vi.mock("@/app/login/LoginHeader", () => ({ LoginHeader: () => null }))
vi.mock("@/app/change-password/ForcedChangePassword", () => ({ ForcedChangePassword: () => null }))

import AppGroupLayout from "@/app/(app)/layout"
import AdminGroupLayout from "@/app/(admin)/admin/layout"
import LoginPage from "@/app/login/page"
import ChangePasswordPage from "@/app/change-password/page"

const original = process.env.ADMIN_USERNAMES
const as = (username: string) => ({ user: { id: "1", username, fullName: null }, expires: "" })

beforeEach(() => {
  process.env.ADMIN_USERNAMES = "admin_test"
  mocks.redirect.mockClear()
  mocks.notFound.mockClear()
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

// Middleware Edge không tra DB: phiên bị đá (đổi mật khẩu, khóa) chỉ lộ ra ở layout (spec N Q13).
describe("layout khi auth() trả null", () => {
  it("(app) → /login?expired=1", async () => {
    mocks.session = null
    await expect(AppGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /login?expired=1")
  })

  it("(admin) → /login?expired=1, không phải 404", async () => {
    mocks.session = null
    await expect(AdminGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /login?expired=1")
    expect(mocks.notFound).not.toHaveBeenCalled()
  })

  it("(admin) giáo viên vẫn 404; admin render bình thường", async () => {
    mocks.session = as("teacher")
    await expect(AdminGroupLayout({ children: "x" })).rejects.toThrow("NOT_FOUND")
    mocks.session = as("admin_test")
    await expect(AdminGroupLayout({ children: "x" })).resolves.toBeTruthy()
  })
})

describe("bắt đổi mật khẩu (spec N R2)", () => {
  const flagged = { user: { id: "1", username: "teacher", fullName: null, mustChangePassword: true }, expires: "" }

  it("(app) có cờ → /change-password", async () => {
    mocks.session = flagged
    await expect(AppGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /change-password")
  })

  it("/change-password: chưa đăng nhập → /login?expired=1; không có cờ → /dashboard; có cờ → hiện form", async () => {
    mocks.session = null
    await expect(ChangePasswordPage()).rejects.toThrow("REDIRECT /login?expired=1")
    mocks.session = as("teacher")
    await expect(ChangePasswordPage()).rejects.toThrow("REDIRECT /dashboard")
    mocks.session = flagged
    await expect(ChangePasswordPage()).resolves.toBeTruthy()
  })
})
