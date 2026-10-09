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

  it("/privacy là route công khai (spec O 6.7)", () => {
    expect(needsAuth("/privacy")).toBe(false)
  })

  it("/guide và /updates là route công khai (spec W)", () => {
    expect(needsAuth("/guide")).toBe(false)
    expect(needsAuth("/updates")).toBe(false)
  })

  it("/api/payos/webhook là route công khai (spec AG §5: payOS gọi không đăng nhập)", () => {
    expect(needsAuth("/api/payos/webhook")).toBe(false)
  })

  it("/api/payos/tuition/<hookId> là route công khai (spec AH §4.1: webhook học phí)", () => {
    expect(needsAuth("/api/payos/tuition/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ")).toBe(false)
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
