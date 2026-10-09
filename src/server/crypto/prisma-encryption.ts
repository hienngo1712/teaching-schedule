import type { PrismaClient } from "@prisma/client"
import { decryptField, encryptField, isEncrypted } from "./field-crypto"

// Quyết định theo spec O mục 5. Đi cây theo TÊN KHOÁ → model trùng tên trường phải cùng quyết định (test DMMF canh).
export const ENCRYPTED_FIELDS = {
  User: ["fullName", "bankAccountNumber", "bankAccountName"],
  Student: ["fullName", "parentName", "parentPhone", "notes", "parentLinkToken"],
  SessionStudent: ["note"],
  TeachingSession: ["notes", "cancelReason"],
  MonthlyTuition: ["notes"],
  Payment: ["note"],
  PlanOrder: ["note"],
  ChatMessage: ["body"],
  TeacherPayos: ["clientId", "apiKey", "checksumKey"],
  TuitionPayLink: ["accountNumber", "accountName"],
} as const

export const ENCRYPTED_KEYS: ReadonlySet<string> = new Set<string>(Object.values(ENCRYPTED_FIELDS).flat())

const WRITE_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert"])

export class EncryptedFieldQueryError extends Error {
  constructor(key: string) {
    super(`Không lọc/sắp xếp DB theo trường mã hoá: ${key}`)
    this.name = "EncryptedFieldQueryError"
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

// Chỉ xét TÊN KHOÁ, không xét giá trị: username "notes" vẫn đăng nhập được.
function findEncryptedKey(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const x of node) {
      const hit = findEncryptedKey(x)
      if (hit) return hit
    }
    return null
  }
  if (!isPlainObject(node)) return null
  for (const [k, v] of Object.entries(node)) {
    if (ENCRYPTED_KEYS.has(k)) return k
    const hit = findEncryptedKey(v)
    if (hit) return hit
  }
  return null
}

// Lọc/sắp theo ciphertext luôn sai im lặng → nổ ngay để lộ ra khi test (spec O Q5).
export function assertNoEncryptedFilter(args: unknown): void {
  if (!isPlainObject(args)) return
  for (const key of ["distinct", "by"]) {
    const v = args[key]
    for (const f of Array.isArray(v) ? v : [v]) {
      if (typeof f === "string" && ENCRYPTED_KEYS.has(f)) throw new EncryptedFieldQueryError(f)
    }
  }
  for (const key of ["where", "orderBy", "cursor", "having"]) {
    const hit = findEncryptedKey(args[key])
    if (hit) throw new EncryptedFieldQueryError(hit)
  }
  for (const key of ["include", "select"]) {
    const nested = args[key]
    if (!isPlainObject(nested)) continue
    for (const v of Object.values(nested)) if (isPlainObject(v)) assertNoEncryptedFilter(v)
  }
}

function encryptTree(node: unknown, key?: string): unknown {
  if (key && ENCRYPTED_KEYS.has(key)) {
    if (typeof node === "string") return encryptField(node, key)
    if (isPlainObject(node) && typeof node.set === "string") return { ...node, set: encryptField(node.set, key) }
    return node
  }
  if (Array.isArray(node)) return node.map((x) => encryptTree(x))
  if (!isPlainObject(node)) return node
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node)) out[k] = encryptTree(v, k)
  return out
}

// Trả bản sao: object của người gọi (vd rows nhập Excel) còn dùng tiếp với bản rõ.
export function encryptWriteArgs<T>(args: T): T {
  if (!isPlainObject(args)) return args
  const out: Record<string, unknown> = { ...args }
  for (const k of ["data", "create", "update"]) if (k in out) out[k] = encryptTree(out[k])
  return out as T
}

const warnedPlaintext = new Set<string>()

// Chỉ để test đặt lại trạng thái.
export function resetPlaintextWarnings(): void {
  warnedPlaintext.clear()
}

// Sau O2 mọi trường phải là ciphertext; bản rõ còn sót = có đường ghi vòng qua extension.
function warnPlaintext(key: string): void {
  if (warnedPlaintext.has(key)) return
  warnedPlaintext.add(key)
  console.warn(`[crypto] còn bản rõ ở trường ${key}`)
}

export function decryptResult<T>(node: T, key?: string): T {
  if (typeof node === "string") {
    if (!key || !ENCRYPTED_KEYS.has(key)) return node
    if (isEncrypted(node)) return decryptField(node, key) as T
    if (node !== "") warnPlaintext(key)
    return node
  }
  if (Array.isArray(node)) return node.map((x) => decryptResult(x, key)) as T
  if (!isPlainObject(node)) return node
  const obj = node as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) obj[k] = decryptResult(v, k)
  return node
}

export function withFieldEncryption<C extends PrismaClient>(client: C): C {
  return client.$extends({
    name: "field-encryption",
    query: {
      async $allOperations({ operation, args, query }) {
        assertNoEncryptedFilter(args)
        const finalArgs = WRITE_OPS.has(operation) ? encryptWriteArgs(args) : args
        return decryptResult(await query(finalArgs as typeof args))
      },
    },
  }) as unknown as C
}
