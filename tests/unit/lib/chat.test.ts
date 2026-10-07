import { describe, it, expect } from "vitest"
import { chatPreview, chatTime, userChatChannel, CHAT_PREVIEW_MAX } from "@/lib/chat"

describe("chatPreview", () => {
  it("gộp khoảng trắng, xuống dòng; ngắn thì giữ nguyên", () => {
    expect(chatPreview("  Xin   chào\n\nadmin ")).toBe("Xin chào admin")
  })
  it("dài hơn 60 ký tự thì cắt còn 59 + …", () => {
    const out = chatPreview("a".repeat(80))
    expect(out).toBe("a".repeat(59) + "…")
    expect(out.length).toBe(CHAT_PREVIEW_MAX)
  })
  it("đúng 60 ký tự thì không cắt", () => {
    expect(chatPreview("b".repeat(60))).toBe("b".repeat(60))
  })
})

describe("chatTime (giờ VN)", () => {
  const now = new Date("2026-10-07T10:00:00Z") // 17:00 VN
  it("cùng ngày VN → HH:mm", () => {
    expect(chatTime(new Date("2026-10-07T01:05:00Z"), now)).toBe("08:05")
  })
  it("khác ngày VN → DD/MM HH:mm, kể cả cùng ngày UTC", () => {
    // 2026-10-06T16:30Z = 23:30 ngày 06/10 giờ VN
    expect(chatTime(new Date("2026-10-06T16:30:00Z"), now)).toBe("06/10 23:30")
    expect(chatTime(new Date("2026-10-07T17:30:00Z"), new Date("2026-10-07T16:00:00Z"))).toBe("08/10 00:30")
  })
  it("nhận chuỗi ISO (dữ liệu tRPC không có transformer)", () => {
    expect(chatTime("2026-10-07T01:05:00.000Z", now)).toBe("08:05")
  })
})

it("tên kênh giáo viên", () => {
  expect(userChatChannel(42)).toBe("private-chat-user-42")
})
