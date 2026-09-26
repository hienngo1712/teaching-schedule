import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

// Next đọc matcher như path-to-regexp; với dạng "/((?!...).*)" thì hiểu như regex thường.
const src = readFileSync("src/middleware.ts", "utf8")
const matcher = src.match(/"(\/\(\(\?!.*\)\.\*\))"/)?.[1] ?? ""
const needsAuth = (path: string) => new RegExp(`^${matcher}$`).test(path)

describe("middleware matcher", () => {
  it("đọc được matcher", () => {
    expect(matcher).not.toBe("")
  })

  it("/p/<token> là route công khai", () => {
    expect(needsAuth("/p/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ")).toBe(false)
    expect(needsAuth("/p/khongtontai")).toBe(false)
  })

  it("các route khác vẫn phải đăng nhập, kể cả route bắt đầu bằng 'p'", () => {
    for (const path of ["/", "/dashboard", "/students", "/profile", "/pay", "/p", "/tuition", "/api/other"]) {
      expect(needsAuth(path), path).toBe(true)
    }
  })

  it("giữ các ngoại lệ cũ", () => {
    for (const path of ["/login", "/register", "/api/auth/session", "/api/trpc/student.list", "/favicon.ico"]) {
      expect(needsAuth(path), path).toBe(false)
    }
  })
})
