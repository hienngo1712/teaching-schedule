import { describe, it, expect, afterEach } from "vitest"
import { adminUsernames, isAdminUsername } from "@/lib/admin"

const original = process.env.ADMIN_USERNAMES

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_USERNAMES
  else process.env.ADMIN_USERNAMES = original
})

describe("isAdminUsername", () => {
  it("khớp chính xác từng tên sau khi trim, phân biệt hoa thường", () => {
    process.env.ADMIN_USERNAMES = " admin_test , hien_admin "
    expect(isAdminUsername("admin_test")).toBe(true)
    expect(isAdminUsername("hien_admin")).toBe(true)
    expect(isAdminUsername("admin")).toBe(false)
    expect(isAdminUsername("Admin_test")).toBe(false)
    expect(isAdminUsername(" admin_test")).toBe(false)
  })

  it("env thiếu hoặc rỗng → false", () => {
    delete process.env.ADMIN_USERNAMES
    expect(isAdminUsername("admin_test")).toBe(false)
    process.env.ADMIN_USERNAMES = ""
    expect(isAdminUsername("admin_test")).toBe(false)
  })

  it("username null/undefined/rỗng → false, kể cả env có dấu phẩy thừa", () => {
    process.env.ADMIN_USERNAMES = "a,,b,"
    expect(isAdminUsername("")).toBe(false)
    expect(isAdminUsername(null)).toBe(false)
    expect(isAdminUsername(undefined)).toBe(false)
    expect(isAdminUsername("b")).toBe(true)
  })
})

describe("adminUsernames", () => {
  it("tách, bỏ khoảng trắng và phần tử rỗng; không có env → []", () => {
    process.env.ADMIN_USERNAMES = " a , b,,"
    expect(adminUsernames()).toEqual(["a", "b"])
    delete process.env.ADMIN_USERNAMES
    expect(adminUsernames()).toEqual([])
  })
})
