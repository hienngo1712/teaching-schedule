import { createHash } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { decryptField, encryptField, isEncrypted, loadKeyring, readKid } from "./field-crypto"
import { hashParentToken } from "./parent-token"

// idColumn: khoá chính số nguyên của bảng khi không phải "id" (teacher_payos dùng user_id). Chỉ đặt từ hằng trong code.
export type FieldTarget = { model: string; table: string; column: string; field: string; idColumn?: string }

// Tên bảng/cột thật (@@map/@map) là hằng, không nhận từ input nên nối vào SQL an toàn.
export const FIELD_TARGETS: readonly FieldTarget[] = [
  { model: "User", table: "users", column: "full_name", field: "fullName" },
  { model: "User", table: "users", column: "bank_account_number", field: "bankAccountNumber" },
  { model: "User", table: "users", column: "bank_account_name", field: "bankAccountName" },
  { model: "Student", table: "students", column: "full_name", field: "fullName" },
  { model: "Student", table: "students", column: "parent_name", field: "parentName" },
  { model: "Student", table: "students", column: "parent_phone", field: "parentPhone" },
  { model: "Student", table: "students", column: "notes", field: "notes" },
  { model: "Student", table: "students", column: "parent_link_token", field: "parentLinkToken" },
  { model: "SessionStudent", table: "session_students", column: "note", field: "note" },
  { model: "TeachingSession", table: "teaching_sessions", column: "notes", field: "notes" },
  { model: "TeachingSession", table: "teaching_sessions", column: "cancel_reason", field: "cancelReason" },
  { model: "MonthlyTuition", table: "monthly_tuition", column: "notes", field: "notes" },
  { model: "Payment", table: "payments", column: "note", field: "note" },
  { model: "PlanOrder", table: "plan_orders", column: "note", field: "note" },
  { model: "ChatMessage", table: "chat_messages", column: "body", field: "body" },
  { model: "TeacherPayos", table: "teacher_payos", column: "client_id", field: "clientId", idColumn: "user_id" },
  { model: "TeacherPayos", table: "teacher_payos", column: "api_key", field: "apiKey", idColumn: "user_id" },
  { model: "TeacherPayos", table: "teacher_payos", column: "checksum_key", field: "checksumKey", idColumn: "user_id" },
  { model: "TuitionPayLink", table: "tuition_pay_links", column: "account_number", field: "accountNumber" },
  { model: "TuitionPayLink", table: "tuition_pay_links", column: "account_name", field: "accountName" },
]

export type BackfillMode = "dry-run" | "apply" | "verify" | "decrypt" | "rotate"

export type FieldReport = {
  table: string
  column: string
  total: number
  empty: number
  plain: number
  encrypted: Record<string, number>
  undecryptable: number
  changed: number
  checksum: string
}

function nextValue(mode: BackfillMode, stored: string, plain: string, field: string, active: string): string {
  if (isEncrypted(stored)) {
    if (mode === "decrypt") return plain
    if (mode === "rotate" && readKid(stored) !== active) return encryptField(plain, field)
    return stored
  }
  return mode === "apply" ? encryptField(stored, field) : stored
}

// Đọc MỌI dòng (kể cả đã xoá mềm của Q). Ghi bằng raw SQL để không bump updated_at.
export async function runBackfill(
  raw: PrismaClient,
  mode: BackfillMode,
  opts: { batchSize?: number; log?: (line: string) => void } = {}
): Promise<FieldReport[]> {
  const batch = opts.batchSize ?? 200
  const log = opts.log ?? (() => {})
  const { active } = loadKeyring()
  const reports: FieldReport[] = []
  for (const t of FIELD_TARGETS) {
    const r: FieldReport = { table: t.table, column: t.column, total: 0, empty: 0, plain: 0, encrypted: {}, undecryptable: 0, changed: 0, checksum: "" }
    const hash = createHash("sha256")
    const idc = t.idColumn ?? "id"
    let lastId = 0
    for (;;) {
      const rows = await raw.$queryRawUnsafe<Array<{ id: number; v: string | null }>>(
        `SELECT "${idc}" AS id, "${t.column}" AS v FROM "${t.table}" WHERE "${idc}" > $1 ORDER BY "${idc}" LIMIT $2`,
        lastId,
        batch
      )
      if (rows.length === 0) break
      for (const row of rows) {
        lastId = row.id
        r.total++
        if (row.v === null || row.v === "") {
          r.empty++
          hash.update(`${row.id}\u0001${row.v === null ? "n" : "e"}\n`)
          continue
        }
        let plain: string
        try {
          plain = decryptField(row.v, t.field)
        } catch {
          // Không in giá trị: có thể là bản rõ tình cờ bắt đầu bằng tiền tố.
          r.undecryptable++
          log(`${t.table}.${t.column} ${idc}=${row.id} không giải mã được`)
          hash.update(`${row.id}\u0002\n`)
          continue
        }
        hash.update(`${row.id}\u0000${plain}\n`)
        let final = row.v
        const next = nextValue(mode, row.v, plain, t.field, active)
        if (next !== row.v) {
          const n = await raw.$executeRawUnsafe(
            `UPDATE "${t.table}" SET "${t.column}" = $1 WHERE "${idc}" = $2 AND "${t.column}" = $3`,
            next,
            row.id,
            row.v
          )
          if (n === 1) {
            r.changed++
            final = next
          } else {
            log(`${t.table}.${t.column} ${idc}=${row.id} bị sửa đồng thời, bỏ qua lượt này`)
          }
        }
        if (isEncrypted(final)) {
          const kid = readKid(final) ?? "?"
          r.encrypted[kid] = (r.encrypted[kid] ?? 0) + 1
        } else {
          r.plain++
        }
      }
    }
    r.checksum = hash.digest("hex")
    reports.push(r)
  }
  return reports
}

// Hash link phụ huynh chỉ được tính 1 lần lúc migration O1; code cũ còn chạy trong lúc deploy có thể tắt/tạo lại
// link mà không cập nhật hash → link đã tắt mở lại, link mới 404. Phải chạy trước O2 (sau O2 SQL không tính được).
export async function reconcileParentLinkHashes(
  raw: PrismaClient,
  opts: { fix: boolean }
): Promise<{ mismatched: number; fixed: number }> {
  const rows = await raw.$queryRaw<Array<{ id: number; tok: string | null; h: string | null }>>`
    SELECT id, parent_link_token AS tok, parent_link_token_hash AS h FROM students
    WHERE parent_link_token IS NOT NULL OR parent_link_token_hash IS NOT NULL ORDER BY id`
  let mismatched = 0
  let fixed = 0
  for (const r of rows) {
    const want = r.tok === null || r.tok === "" ? null : hashParentToken(decryptField(r.tok, "parentLinkToken"))
    if (want === r.h) continue
    mismatched++
    if (!opts.fix) continue
    const n = await raw.$executeRaw`
      UPDATE students SET parent_link_token_hash = ${want}
      WHERE id = ${r.id} AND parent_link_token IS NOT DISTINCT FROM ${r.tok}`
    fixed += n
  }
  return { mismatched, fixed }
}
