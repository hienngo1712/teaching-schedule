import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { randomBytes } from "node:crypto"
import {
  ENC_PREFIX,
  FieldCryptoConfigError,
  FieldDecryptError,
  decryptField,
  encryptField,
  isEncrypted,
  readKid,
} from "@/server/crypto/field-crypto"

// Các file test chạy chung 1 tiến trình (singleFork) → phải trả env về như cũ.
const ORIGINAL = { keys: process.env.DATA_ENCRYPTION_KEYS, active: process.env.DATA_ENCRYPTION_ACTIVE_KID }
const K1 = randomBytes(32).toString("base64")
const K2 = randomBytes(32).toString("base64")
function setEnv(keys: string | undefined, active: string | undefined) {
  if (keys === undefined) delete process.env.DATA_ENCRYPTION_KEYS
  else process.env.DATA_ENCRYPTION_KEYS = keys
  if (active === undefined) delete process.env.DATA_ENCRYPTION_ACTIVE_KID
  else process.env.DATA_ENCRYPTION_ACTIVE_KID = active
}

beforeEach(() => setEnv(`k1:${K1}`, "k1"))
afterAll(() => setEnv(ORIGINAL.keys, ORIGINAL.active))

const FORMAT = /^enc:v1:[a-z0-9]{1,8}:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]*:[A-Za-z0-9_-]{22}$/

describe("field-crypto (spec O 6.1)", () => {
  it("khứ hồi tiếng Việt có dấu, emoji, chuỗi dài; đúng định dạng", () => {
    for (const plain of ["Nguyễn Thị Ánh Tuyết", "0901234567", "Bé hay ốm 🤒", "x".repeat(1000)]) {
      const enc = encryptField(plain, "fullName")
      expect(enc).toMatch(FORMAT)
      expect(enc.startsWith(ENC_PREFIX)).toBe(true)
      expect(enc).not.toContain(plain)
      expect(decryptField(enc, "fullName")).toBe(plain)
    }
  })

  it("IV ngẫu nhiên: 2 lần mã hoá cùng chuỗi ra 2 kết quả khác nhau", () => {
    expect(encryptField("An", "fullName")).not.toBe(encryptField("An", "fullName"))
  })

  it("chuỗi rỗng giữ nguyên; bản rõ cũ (không tiền tố) đọc ra nguyên", () => {
    expect(encryptField("", "notes")).toBe("")
    expect(decryptField("Bản rõ cũ", "notes")).toBe("Bản rõ cũ")
    expect(isEncrypted("Bản rõ cũ")).toBe(false)
    expect(isEncrypted(null)).toBe(false)
  })

  it("chuỗi người dùng gõ bắt đầu bằng enc:v1: vẫn được mã hoá và giải mã đúng", () => {
    const typed = "enc:v1:đây là ghi chú"
    const enc = encryptField(typed, "notes")
    expect(enc).not.toBe(typed)
    expect(decryptField(enc, "notes")).toBe(typed)
  })

  it("sửa ciphertext/tag hoặc giải mã với trường khác (AAD) → FieldDecryptError, message không chứa bản rõ", () => {
    const enc = encryptField("Trần Văn Bình", "fullName")
    const parts = enc.split(":")
    const flip = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1)
    const badCt = [...parts.slice(0, 4), flip(parts[4]), parts[5]].join(":")
    const badTag = [...parts.slice(0, 5), flip(parts[5])].join(":")
    for (const [value, field] of [[badCt, "fullName"], [badTag, "fullName"], [enc, "bankAccountName"]] as const) {
      let err: unknown
      try { decryptField(value, field) } catch (e) { err = e }
      expect(err).toBeInstanceOf(FieldDecryptError)
      expect(String((err as Error).message)).not.toContain("Trần Văn Bình")
    }
  })

  it("kid không có khoá → FieldDecryptError", () => {
    const enc = encryptField("An", "fullName")
    setEnv(`k2:${K2}`, "k2")
    expect(() => decryptField(enc, "fullName")).toThrow(FieldDecryptError)
  })

  it("xoay khoá: ghi bằng khoá active, vẫn đọc được bản cũ kid khác", () => {
    const old = encryptField("An", "fullName")
    setEnv(`k1:${K1},k2:${K2}`, "k2")
    const fresh = encryptField("Bình", "fullName")
    expect(readKid(old)).toBe("k1")
    expect(readKid(fresh)).toBe("k2")
    expect(decryptField(old, "fullName")).toBe("An")
    expect(decryptField(fresh, "fullName")).toBe("Bình")
    expect(readKid("Bản rõ")).toBeNull()
  })

  it("cấu hình sai → FieldCryptoConfigError, message không chứa khoá", () => {
    const cases: [string | undefined, string | undefined][] = [
      [undefined, "k1"],
      [`k1:${K1}`, undefined],
      [`k1:${K1}`, "k9"],
      [`k1:${randomBytes(16).toString("base64")}`, "k1"],
      [`K_1:${K1}`, "K_1"],
      [`k1:${K1},k1:${K2}`, "k1"],
    ]
    for (const [keys, active] of cases) {
      setEnv(keys, active)
      let err: unknown
      try { encryptField("An", "fullName") } catch (e) { err = e }
      expect(err, `${keys}|${active}`).toBeInstanceOf(FieldCryptoConfigError)
      expect(String((err as Error).message)).not.toContain(K1)
      expect(String((err as Error).message)).not.toContain(K2)
    }
  })
})
