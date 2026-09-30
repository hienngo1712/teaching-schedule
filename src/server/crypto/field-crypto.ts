import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

// Định dạng tự mô tả (spec O Q2): đọc được cả bản rõ cũ lẫn bản mã hoá trong giai đoạn chuyển.
export const ENC_PREFIX = "enc:v1:"
const KID_RE = /^[a-z0-9]{1,8}$/
const IV_BYTES = 12
const TAG_BYTES = 16

export class FieldCryptoConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FieldCryptoConfigError"
  }
}

export class FieldDecryptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FieldDecryptError"
  }
}

type Keyring = { active: string; keys: Map<string, Buffer> }
let cache: { raw: string; ring: Keyring } | null = null

// Đọc lười ở lần dùng đầu: `next build` không cần khoá. Cache theo chuỗi env để test đổi env được.
export function loadKeyring(): Keyring {
  const rawKeys = process.env.DATA_ENCRYPTION_KEYS ?? ""
  const active = process.env.DATA_ENCRYPTION_ACTIVE_KID ?? ""
  const raw = `${rawKeys}|${active}`
  if (cache?.raw === raw) return cache.ring
  if (!rawKeys.trim()) throw new FieldCryptoConfigError("Thiếu DATA_ENCRYPTION_KEYS")
  const keys = new Map<string, Buffer>()
  for (const part of rawKeys.split(",")) {
    const i = part.indexOf(":")
    const kid = i > 0 ? part.slice(0, i).trim() : ""
    if (!KID_RE.test(kid)) throw new FieldCryptoConfigError("DATA_ENCRYPTION_KEYS: kid phải gồm 1-8 ký tự a-z0-9")
    if (keys.has(kid)) throw new FieldCryptoConfigError(`DATA_ENCRYPTION_KEYS: trùng kid ${kid}`)
    const key = Buffer.from(part.slice(i + 1).trim(), "base64")
    if (key.length !== 32) throw new FieldCryptoConfigError(`DATA_ENCRYPTION_KEYS: khoá ${kid} phải là 32 byte base64`)
    keys.set(kid, key)
  }
  if (!keys.has(active)) {
    throw new FieldCryptoConfigError("DATA_ENCRYPTION_ACTIVE_KID không có trong DATA_ENCRYPTION_KEYS")
  }
  const ring = { active, keys }
  cache = { raw, ring }
  return ring
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENC_PREFIX)
}

// AAD = tên trường: không chép được ciphertext số TK sang trường tên (hiện trên trang công khai).
export function encryptField(plain: string, field: string): string {
  if (plain === "") return ""
  const { active, keys } = loadKeyring()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", keys.get(active)!, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(field, "utf8"))
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}${active}:${iv.toString("base64url")}:${ct.toString("base64url")}:${tag.toString("base64url")}`
}

export function readKid(stored: string): string | null {
  if (!isEncrypted(stored)) return null
  const kid = stored.split(":")[2] ?? ""
  return KID_RE.test(kid) ? kid : null
}

// Lỗi chỉ nêu trường + kid: không bao giờ đưa giá trị vào message (message đi vào log).
export function decryptField(stored: string, field: string): string {
  if (!isEncrypted(stored)) return stored
  const parts = stored.split(":")
  const kid = readKid(stored)
  const fail = () => new FieldDecryptError(`Không giải mã được trường ${field} (kid=${kid ?? "?"})`)
  if (parts.length !== 6 || !kid) throw fail()
  const key = loadKeyring().keys.get(kid)
  if (!key) throw fail()
  const iv = Buffer.from(parts[3], "base64url")
  const ct = Buffer.from(parts[4], "base64url")
  const tag = Buffer.from(parts[5], "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw fail()
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES })
    decipher.setAAD(Buffer.from(field, "utf8"))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
  } catch {
    throw fail()
  }
}
