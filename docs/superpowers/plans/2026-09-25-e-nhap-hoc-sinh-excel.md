# E — Nhập học sinh từ Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Màn Học sinh có nút **Nhập Excel**: tải file mẫu `.xlsx`, chọn file đã điền, xem trước (lỗi / trùng / hợp lệ), bấm xác nhận để tạo cả lô trong 1 transaction (tất cả hoặc không).

**Architecture:** File đọc ở client bằng exceljs (nạp động). Phần thuần (chuẩn hóa ô, parse dòng, khóa trùng, dựng bảng xem trước) nằm ở `src/lib/student-import.ts`, dùng chung client/server, test bằng Vitest. Phần đụng exceljs (dựng file mẫu, đọc workbook) nằm ở `src/lib/student-import-excel.ts`, chỉ dialog import. Server thêm 2 procedure `student.importCheck` (tìm trùng DB) và `student.importMany` (validate lại, kiểm tra trùng lại, `createMany` trong `$transaction`).

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, Prisma 5, Zod 3, exceljs 4.4 + file-saver (đã có), Tailwind 3, shadcn/ui, lucide-react, Vitest 4, Playwright 1.59.

**Spec:** `docs/superpowers/specs/2026-09-25-e-nhap-hoc-sinh-excel-design.md`

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh đụng DB (test, migrate, seed) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` KHÁC `.env.test`. `.env` = PRODUCTION (host `ep-polished-voice`), `.env.test` = test (host `ep-jolly-dew`). Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`).
- **CẤM:** `pnpm db:reset`, `prisma migrate reset`, `prisma db push --force-reset`, `pnpm build` (chạy `prisma migrate deploy` lên prod), `pnpm dev` (dùng DB prod). Kiểm tra build bằng `pnpm exec next build`.
- Phần E **không đổi schema Prisma, không migration**. Nếu thấy cần migration → DỪNG, báo người dùng. (Quy tắc chung nếu có migration: tạo bằng `--create-only` với URL của `.env.test`, đọc lại SQL, chỉ áp lên DB test; không bao giờ áp lên prod thủ công.)
- Không thêm dependency. Dùng `exceljs` (^4.4.0) + `file-saver` sẵn có. exceljs ở client chỉ nạp bằng `import("exceljs")` động.
- Chạy test 1 file: `pnpm test <đường-dẫn>`. Không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ mất ~10–15 phút.
- **E2E:** cổng 3000 có thể bị project khác chiếm, không tắt tiến trình đó. Dùng config tạm git-ignored `.superpowers/pw-3100.config.ts` (nội dung ở Task 6), cổng 3100, url kiểm tra `http://127.0.0.1:3100/login`, `reuseExistingServer: true`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. `ResponsiveList` render cả bảng lẫn thẻ → lọc phần tử visible hoặc dùng test id.
- Viewport mobile kiểm thử 390×844. Vùng chạm tối thiểu 44px trên mobile (`h-11 md:h-10`, `min-h-11`).
- **i18n:** mọi chuỗi UI mới có ở cả `src/language/vi.json` và `en.json`, cùng bộ key. `t()` có kiểu `keyof typeof vi` nên key phải có trước khi code UI dùng. Chuỗi tiếng Việt mới không dùng dấu gạch dài.
- Thông báo lỗi từ service viết tiếng Việt như các service hiện có.
- Ghi chú code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy.
- `userId` luôn lấy từ `ctx.userId`, không nhận từ client (multi-tenant).
- Làm trên nhánh `feat/e-excel-import`, KHÔNG commit lên `main`. Agent thực hiện task **KHÔNG merge, KHÔNG push**; merge/push do người điều phối làm sau review cuối.
- Mỗi task kết thúc bằng: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit.
- Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Không nhập mật khẩu/credential thật vào trình duyệt; không thao tác ghi trên tài khoản production.

## Điều chỉnh so với spec

1. **Tách phần exceljs ra `src/lib/student-import-excel.ts`** (spec §7 để trong dialog). Lý do: đọc workbook / dựng mẫu test được bằng Vitest (tạo file thật bằng exceljs trong Node), dialog gọn hơn. File này chỉ dialog import; exceljs vẫn nạp động. Thêm test `tests/unit/lib/student-import-excel.test.ts`.
2. **Thêm hàm thuần** ngoài danh sách spec §7: `isImportHeader`, `findInFileDuplicates`, `buildPreview`, `toImportPayload` trong `src/lib/student-import.ts`, để luật đánh dấu trùng / thứ tự hiển thị / số N gửi đi có unit test.
3. **Nút và dialog chung file** `ImportStudentsDialog.tsx`, export `ImportStudentsButton` (kiểu `UpgradeAllClassesButton`); dialog chỉ mount khi mở nên state luôn mới, `StudentList` chỉ thêm 1 dòng.
4. **Một dòng vừa trùng DB vừa trùng dòng trước trong file** → hiện lý do trùng DB (cụ thể hơn). Nhiều HS trong DB cùng khóa → ưu tiên HS đang học (`orderBy isActive desc`).
5. **Nhãn tiêu đề mẫu** là `Họ tên*`, `Lớp*`, `Tên phụ huynh`, `SĐT phụ huynh`, `Học phí/buổi`, `Ghi chú`; khi kiểm tra tiêu đề bỏ qua dấu `*` cuối (người dùng xóa dấu sao vẫn hợp lệ).
6. **Dòng lỗi** có lớp không đọc được hiện `Lớp ?`; học phí không đọc được thì không hiện số tiền.
7. Client gửi `importMany` theo **thứ tự dòng trong file** (không theo thứ tự hiển thị lỗi → trùng → hợp lệ) để luật "dòng sau trùng dòng trước" khớp giữa client và server.
8. Thêm integration test **300 dòng** (tiêu chí "Đo được" §2) để chắc `createMany` trong transaction không vượt timeout mặc định 5s.

## Review Focus

1. **Excel đổi kiểu ô** (SĐT thành số `912345678`, học phí `"150.000"` / `"150,000đ"`, học phí chữ `"abc"`) → SĐT được bù `0`, học phí ra số nguyên, chữ vô nghĩa báo lỗi ô học phí (không âm thầm thành 0). Pin: unit Task 1.
2. **Tên giống nhau nhưng khác hoa thường / khoảng trắng / Unicode NFD** → coi là trùng; "An" và "Ân" không trùng. Pin: unit `nameKey` Task 1 + integration `importCheck` với tên lộn xộn Task 3.
3. **Chọn file lạ** (file không phải zip, mẫu sai cột, chỉ có dòng tiêu đề, >500 dòng, >2MB) → hiện đúng thông báo, không vỡ dialog. Pin: unit Task 2.
4. **Bấm nhập 2 lần / thử lại sau khi mạng chập chờn** → lần 2 bị `CONFLICT`, DB không có bản sao; nút nhập `disabled` khi đang gửi. Pin: integration Task 3; nút disabled đọc code ở review cuối.
5. **Lô lớn (300 dòng)** → nhập xong trong 1 lần gọi, không vượt timeout transaction. Pin: integration Task 3.

---

## File Structure

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `src/lib/student-import.ts` | Mới (Task 1) | Hằng số cột/giới hạn, `nameKey`, `cellToText`, `isImportHeader`, `parseImportRows`, `findInFileDuplicates`, `buildPreview`, `toImportPayload` |
| `src/lib/student-import-excel.ts` | Mới (Task 2) | `buildImportTemplate`, `readImportWorkbook` (exceljs nạp động) |
| `src/lib/schemas/student.ts` | Sửa (Task 3) | `studentImportCheckSchema`, `studentImportSchema` + type |
| `src/server/services/student.service.ts` | Sửa (Task 3) | `checkImportDuplicates`, `importStudents` |
| `src/server/trpc/routers/student.ts` | Sửa (Task 3) | `importCheck`, `importMany` |
| `src/language/vi.json`, `en.json` | Sửa (Task 4) | 25 key mới |
| `src/components/students/ImportStudentsDialog.tsx` | Mới (Task 5) | `ImportStudentsButton` + dialog 2 bước |
| `src/components/students/StudentList.tsx` | Sửa (Task 5) | Gắn nút vào `PageHeader` |
| `tests/unit/lib/student-import.test.ts` | Mới (Task 1) | |
| `tests/unit/lib/student-import-excel.test.ts` | Mới (Task 2) | |
| `tests/integration/student-import.test.ts` | Mới (Task 3) | |
| `tests/e2e/students-import.spec.ts` | Mới (Task 6) | E2E 390px |

---

### Task 0: Tạo nhánh, kiểm tra DB test

**Đọc trước:** Global Constraints ở trên; `docs/coding-rule.md` §6.1.

Phần E không phụ thuộc phần nào khác (B, C, D, F, G) nên không cần kiểm tra model mới.

- [ ] **Step 1: Tạo nhánh từ `main` mới nhất**

```bash
git fetch origin
git checkout main
git pull --ff-only
git checkout -b feat/e-excel-import
```

Nếu nhánh `feat/e-excel-import` đã có: `git checkout feat/e-excel-import` và `git merge --ff-only main` (không được thì DỪNG, báo người dùng).

Kiểm tra spec có trên nhánh: `ls docs/superpowers/specs/2026-09-25-e-nhap-hoc-sinh-excel-design.md`. File plan này có thể chỉ nằm trên nhánh `docs/plans-b-g`; nếu `main` chưa có, đọc bằng `git show docs/plans-b-g:docs/superpowers/plans/2026-09-25-e-nhap-hoc-sinh-excel.md`.

- [ ] **Step 2: Xác nhận DB test khác production**

Run:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=` chứa `ep-polished-voice`, `test=` chứa `ep-jolly-dew`, 2 host khác nhau. Nếu giống → DỪNG, báo người dùng.

- [ ] **Step 3: Xác nhận nền xanh**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi. (Không có commit ở task này.)

---

### Task 1: Hàm thuần đọc/chuẩn hóa dòng + đánh dấu trùng (TDD)

**Đọc trước:** spec §3 (Q2, Q3), §4 (D4, D5), §7, §10 mục Unit; `src/lib/schemas/student.ts` (`studentCreateSchema`, `phoneRegex`).

**Files:**
- Create: `src/lib/student-import.ts`
- Test: `tests/unit/lib/student-import.test.ts`

**Interfaces:**
- Consumes: `studentCreateSchema` từ `@/lib/schemas/student` (có sẵn).
- Produces (Task 2, 3, 5 dùng, đúng tên và kiểu):
  ```ts
  export const IMPORT_COLUMNS: readonly [
    { label: "Họ tên*"; field: "fullName" }, { label: "Lớp*"; field: "grade" },
    { label: "Tên phụ huynh"; field: "parentName" }, { label: "SĐT phụ huynh"; field: "parentPhone" },
    { label: "Học phí/buổi"; field: "tuitionFee" }, { label: "Ghi chú"; field: "notes" },
  ]
  export type ImportField = "fullName" | "grade" | "parentName" | "parentPhone" | "tuitionFee" | "notes"
  export const MAX_IMPORT_ROWS = 500
  export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024
  export type ImportRowInput = { fullName: string; grade: number; parentName?: string; parentPhone?: string; tuitionFee: number; notes?: string }
  export type ParsedImportRow = { rowNumber: number; input: ImportRowInput; errors: ImportField[] }
  export type ExistingMatch = { id: number; fullName: string; grade: number; isActive: boolean }
  export type PreviewRow = ParsedImportRow & { status: "error" | "duplicate" | "ok"; existing: ExistingMatch | null; sameAsRow: number | null }
  export function nameKey(fullName: string, grade: number): string
  export function cellToText(value: unknown): string
  export function isImportHeader(cells: unknown[]): boolean
  export function parseImportRows(rows: { rowNumber: number; cells: unknown[] }[]): ParsedImportRow[]
  export function findInFileDuplicates(rows: ParsedImportRow[]): (number | null)[]
  export function buildPreview(rows: ParsedImportRow[], matches: (ExistingMatch | null)[]): PreviewRow[]
  export function toImportPayload(preview: PreviewRow[], allowed: ReadonlySet<number>): (ImportRowInput & { allowDuplicate: boolean })[]
  ```
  `buildPreview`: `matches` xếp theo thứ tự **các dòng không lỗi** của `rows` (đúng thứ tự gửi `importCheck`). `allowed` = tập `rowNumber` của dòng trùng được tick "Vẫn nhập".

- [ ] **Step 1: Viết test fail**

`tests/unit/lib/student-import.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  IMPORT_COLUMNS,
  buildPreview,
  cellToText,
  findInFileDuplicates,
  isImportHeader,
  nameKey,
  parseImportRows,
  toImportPayload,
  type ParsedImportRow,
} from "@/lib/student-import"

const row = (rowNumber: number, ...cells: unknown[]) => ({ rowNumber, cells })
const parsed = (
  rowNumber: number,
  fullName: string,
  grade: number,
  errors: ParsedImportRow["errors"] = []
): ParsedImportRow => ({ rowNumber, input: { fullName, grade, tuitionFee: 0 }, errors })

describe("nameKey", () => {
  it("không phân biệt hoa thường, khoảng trắng thừa, NFD/NFC", () => {
    const k = nameKey("Nguyễn Văn An", 5)
    expect(nameKey("  nguyễn   VĂN an ", 5)).toBe(k)
    expect(nameKey("Nguyễn Văn An".normalize("NFD"), 5)).toBe(k)
  })

  it("giữ dấu: An khác Ân; khác lớp khác khóa", () => {
    expect(nameKey("An", 5)).not.toBe(nameKey("Ân", 5))
    expect(nameKey("An", 5)).not.toBe(nameKey("An", 6))
  })
})

describe("cellToText", () => {
  it("số, chuỗi, null, Date", () => {
    expect(cellToText(5)).toBe("5")
    expect(cellToText("  Bình  ")).toBe("Bình")
    expect(cellToText(null)).toBe("")
    expect(cellToText(undefined)).toBe("")
    expect(cellToText(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01")
  })

  it("richText, công thức, hyperlink, lỗi công thức", () => {
    expect(cellToText({ richText: [{ text: "Nguyễn " }, { text: "An" }] })).toBe("Nguyễn An")
    expect(cellToText({ formula: "A1+1", result: 5 })).toBe("5")
    expect(cellToText({ formula: "A1" })).toBe("")
    expect(cellToText({ text: "Chị Hoa", hyperlink: "mailto:hoa@x.vn" })).toBe("Chị Hoa")
    expect(cellToText({ error: "#N/A" })).toBe("")
  })
})

describe("isImportHeader", () => {
  it("khớp đúng nhãn mẫu", () => {
    expect(isImportHeader(IMPORT_COLUMNS.map((c) => c.label))).toBe(true)
  })

  it("chấp nhận hoa thường, khoảng trắng, NFD, thiếu dấu *", () => {
    expect(
      isImportHeader([" HỌ TÊN ", "lớp".normalize("NFD"), "Tên phụ huynh", "SĐT  phụ huynh", "Học phí/buổi", "Ghi chú"])
    ).toBe(true)
  })

  it("sai thứ tự hoặc thiếu cột → false", () => {
    expect(isImportHeader(["Lớp*", "Họ tên*", "Tên phụ huynh", "SĐT phụ huynh", "Học phí/buổi", "Ghi chú"])).toBe(false)
    expect(isImportHeader(["Họ tên*", "Lớp*"])).toBe(false)
    expect(isImportHeader([])).toBe(false)
  })
})

describe("parseImportRows", () => {
  it("bỏ dòng rỗng, giữ số dòng thật trong Excel", () => {
    const out = parseImportRows([
      row(2, "Nguyễn An", 5),
      row(3, null, "  ", undefined),
      row(4, "Trần Bình", "Lớp 3"),
    ])
    expect(out.map((r) => r.rowNumber)).toEqual([2, 4])
    expect(out.every((r) => r.errors.length === 0)).toBe(true)
  })

  it("dòng đầy đủ → input chuẩn hóa", () => {
    const [r] = parseImportRows([row(2, "Nguyễn An", 5, "Chị Hoa", "0912 345.678", "150.000", "Yếu toán")])
    expect(r.errors).toEqual([])
    expect(r.input).toEqual({
      fullName: "Nguyễn An",
      grade: 5,
      parentName: "Chị Hoa",
      parentPhone: "0912345678",
      tuitionFee: 150000,
      notes: "Yếu toán",
    })
  })

  it("lớp: 5, '5', 'Lớp 5', 'LỚP 7'", () => {
    const out = parseImportRows([row(2, "An An", 5), row(3, "Bình An", "5"), row(4, "Chi An", "Lớp 5"), row(5, "Dũng An", "LỚP 7")])
    expect(out.map((r) => r.input.grade)).toEqual([5, 5, 5, 7])
  })

  it("SĐT dạng số 9 chữ số → bù 0 đầu; gạch nối bị bỏ", () => {
    const out = parseImportRows([row(2, "An An", 5, null, 912345678), row(3, "Bình An", 5, null, "091-234-5678")])
    expect(out[0].input.parentPhone).toBe("0912345678")
    expect(out[1].input.parentPhone).toBe("0912345678")
    expect(out.every((r) => r.errors.length === 0)).toBe(true)
  })

  it("học phí: '150,000đ', số, rỗng → 0, chữ vô nghĩa → lỗi", () => {
    const out = parseImportRows([
      row(2, "An An", 5, null, null, "150,000đ"),
      row(3, "Bình An", 5, null, null, 200000),
      row(4, "Chi An", 5, null, null, null),
      row(5, "Dũng An", 5, null, null, "abc"),
    ])
    expect(out.map((r) => r.input.tuitionFee).slice(0, 3)).toEqual([150000, 200000, 0])
    expect(out[3].errors).toEqual(["tuitionFee"])
  })

  it("lớp 10, lớp 5.5, lớp rỗng → lỗi grade", () => {
    const out = parseImportRows([row(2, "An An", 10), row(3, "Bình An", 5.5), row(4, "Chi An", null, "x")])
    expect(out.map((r) => r.errors)).toEqual([["grade"], ["grade"], ["grade"]])
  })

  it("tên 1 ký tự → lỗi fullName", () => {
    expect(parseImportRows([row(2, "A", 5)])[0].errors).toEqual(["fullName"])
  })

  it("nhiều lỗi 1 dòng → đủ các field, theo thứ tự cột", () => {
    const [r] = parseImportRows([row(2, "A", 12, "x".repeat(101), "123", -5, "y".repeat(1001))])
    expect(r.errors).toEqual(["fullName", "grade", "parentName", "parentPhone", "tuitionFee", "notes"])
  })
})

describe("findInFileDuplicates", () => {
  it("dòng sau cùng khóa dòng trước → trả số dòng trước; dòng lỗi bỏ qua", () => {
    const rows = [
      parsed(2, "Nguyễn An", 5),
      parsed(3, "nguyễn  an", 5),
      parsed(4, "Nguyễn An", 6),
      parsed(5, "Trần Bình", 3, ["parentPhone"]),
      parsed(6, "Trần Bình", 3),
    ]
    expect(findInFileDuplicates(rows)).toEqual([null, 2, null, null, null])
  })
})

describe("buildPreview", () => {
  const existing = { id: 10, fullName: "Nguyễn An", grade: 5, isActive: false }

  it("gắn trạng thái và xếp lỗi → trùng → hợp lệ", () => {
    const rows = [
      parsed(2, "Trần Bình", 3),
      parsed(3, "Nguyễn An", 5),
      parsed(4, "Lê Chi", 12, ["grade"]),
      parsed(5, "trần bình", 3),
    ]
    // matches theo thứ tự các dòng không lỗi: 2, 3, 5
    const out = buildPreview(rows, [null, existing, null])
    expect(out.map((r) => [r.rowNumber, r.status])).toEqual([
      [4, "error"],
      [3, "duplicate"],
      [5, "duplicate"],
      [2, "ok"],
    ])
    expect(out[1].existing).toEqual(existing)
    expect(out[2]).toMatchObject({ existing: null, sameAsRow: 2 })
  })

  it("vừa trùng DB vừa trùng trong file → ưu tiên lý do DB", () => {
    const rows = [parsed(2, "Nguyễn An", 5), parsed(3, "Nguyễn An", 5)]
    const out = buildPreview(rows, [existing, existing])
    expect(out.every((r) => r.status === "duplicate" && r.existing?.id === 10)).toBe(true)
  })
})

describe("toImportPayload", () => {
  it("gồm dòng hợp lệ + dòng trùng đã tick, theo thứ tự dòng trong file", () => {
    const rows = [parsed(2, "Trần Bình", 3), parsed(3, "Nguyễn An", 5), parsed(4, "Lê Chi", 12, ["grade"]), parsed(5, "trần bình", 3)]
    const preview = buildPreview(rows, [null, { id: 10, fullName: "Nguyễn An", grade: 5, isActive: true }, null])

    expect(toImportPayload(preview, new Set()).map((r) => r.fullName)).toEqual(["Trần Bình"])

    const payload = toImportPayload(preview, new Set([3, 5]))
    expect(payload.map((r) => [r.fullName, r.allowDuplicate])).toEqual([
      ["Trần Bình", false],
      ["Nguyễn An", true],
      ["trần bình", true],
    ])
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/student-import.test.ts`
Expected: FAIL — không resolve được `@/lib/student-import`.

- [ ] **Step 3: Viết code**

`src/lib/student-import.ts`:

```ts
import { studentCreateSchema } from "@/lib/schemas/student"

// Tiêu đề cột luôn tiếng Việt bất kể ngôn ngữ giao diện: 1 mẫu, parser chỉ cần 1 bộ nhãn.
export const IMPORT_COLUMNS = [
  { label: "Họ tên*", field: "fullName" },
  { label: "Lớp*", field: "grade" },
  { label: "Tên phụ huynh", field: "parentName" },
  { label: "SĐT phụ huynh", field: "parentPhone" },
  { label: "Học phí/buổi", field: "tuitionFee" },
  { label: "Ghi chú", field: "notes" },
] as const

export type ImportField = (typeof IMPORT_COLUMNS)[number]["field"]

export const MAX_IMPORT_ROWS = 500
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024

export type ImportRowInput = {
  fullName: string
  grade: number
  parentName?: string
  parentPhone?: string
  tuitionFee: number
  notes?: string
}

export type ParsedImportRow = { rowNumber: number; input: ImportRowInput; errors: ImportField[] }

export type ExistingMatch = { id: number; fullName: string; grade: number; isActive: boolean }

export type PreviewRow = ParsedImportRow & {
  status: "error" | "duplicate" | "ok"
  existing: ExistingMatch | null
  sameAsRow: number | null
}

// Excel trên Mac / copy từ web có thể ra NFD: nhìn giống nhưng so khác. Giữ dấu để không gộp nhầm "An" với "Ân".
function normalizeText(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi")
}

export function nameKey(fullName: string, grade: number): string {
  return `${grade}|${normalizeText(fullName)}`
}

export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object") {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: unknown }
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim()
    if ("result" in v) return cellToText(v.result)
    if ("text" in v) return cellToText(v.text)
    return ""
  }
  return String(value).trim()
}

export function isImportHeader(cells: unknown[]): boolean {
  const clean = (s: string) => normalizeText(s).replace(/\s*\*$/, "")
  return IMPORT_COLUMNS.every((c, i) => clean(cellToText(cells[i])) === clean(c.label))
}

function parseGrade(raw: unknown): number {
  if (typeof raw === "number") return raw
  const m = normalizeText(cellToText(raw)).match(/^(?:lớp\s*)?(\d{1,2})$/)
  return m ? Number(m[1]) : NaN
}

function parsePhone(raw: unknown): string | undefined {
  const digits = cellToText(raw).replace(/[\s.\-]/g, "")
  if (!digits) return undefined
  // Ô SĐT kiểu số: Excel đã nuốt số 0 đầu.
  return typeof raw === "number" && digits.length === 9 ? `0${digits}` : digits
}

function parseFee(raw: unknown): number {
  if (typeof raw === "number") return raw
  const text = cellToText(raw)
  if (!text) return 0
  const digits = text.replace(/\D/g, "")
  // Chữ không có số nào → NaN để Zod báo lỗi ô, không âm thầm thành 0.
  return digits ? Number(digits) : NaN
}

function optionalText(raw: unknown): string | undefined {
  return cellToText(raw) || undefined
}

export function parseImportRows(rows: { rowNumber: number; cells: unknown[] }[]): ParsedImportRow[] {
  const result: ParsedImportRow[] = []
  for (const { rowNumber, cells } of rows) {
    if (IMPORT_COLUMNS.every((_, i) => cellToText(cells[i]) === "")) continue
    const input: ImportRowInput = {
      fullName: cellToText(cells[0]).normalize("NFC"),
      grade: parseGrade(cells[1]),
      parentName: optionalText(cells[2]),
      parentPhone: parsePhone(cells[3]),
      tuitionFee: parseFee(cells[4]),
      notes: optionalText(cells[5]),
    }
    const check = studentCreateSchema.safeParse(input)
    // Chỉ lấy tên field: message mặc định của Zod là tiếng Anh, UI tự dịch bằng key import_err_<field>.
    const errors = check.success
      ? []
      : IMPORT_COLUMNS.map((c) => c.field).filter((f) => check.error.issues.some((i) => i.path[0] === f))
    result.push({ rowNumber, input, errors })
  }
  return result
}

export function findInFileDuplicates(rows: ParsedImportRow[]): (number | null)[] {
  const first = new Map<string, number>()
  return rows.map((r) => {
    if (r.errors.length > 0) return null
    const key = nameKey(r.input.fullName, r.input.grade)
    const prev = first.get(key)
    if (prev !== undefined) return prev
    first.set(key, r.rowNumber)
    return null
  })
}

export function buildPreview(rows: ParsedImportRow[], matches: (ExistingMatch | null)[]): PreviewRow[] {
  const sameAs = findInFileDuplicates(rows)
  let validIndex = 0
  const all = rows.map((r, i): PreviewRow => {
    if (r.errors.length > 0) return { ...r, status: "error", existing: null, sameAsRow: null }
    const existing = matches[validIndex++] ?? null
    const sameAsRow = existing ? null : sameAs[i]
    const status = existing || sameAsRow !== null ? "duplicate" : "ok"
    return { ...r, status, existing, sameAsRow }
  })
  // Lỗi trước, rồi trùng, rồi hợp lệ: chỗ cần xử lý nằm trên cùng.
  return (["error", "duplicate", "ok"] as const).flatMap((s) => all.filter((r) => r.status === s))
}

export function toImportPayload(
  preview: PreviewRow[],
  allowed: ReadonlySet<number>
): (ImportRowInput & { allowDuplicate: boolean })[] {
  return preview
    .filter((r) => r.status === "ok" || (r.status === "duplicate" && allowed.has(r.rowNumber)))
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((r) => ({ ...r.input, allowDuplicate: r.status === "duplicate" }))
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/student-import.test.ts`
Expected: PASS toàn bộ (19 test). Nếu `"LỚP 7"` fail: kiểm tra `normalizeText` chạy trước regex (regex viết thường `lớp`).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/lib/student-import.ts tests/unit/lib/student-import.test.ts
git commit -m "feat(students): hàm thuần đọc/chuẩn hóa dòng nhập Excel và đánh dấu trùng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Đọc workbook và dựng file mẫu bằng exceljs (TDD)

**Đọc trước:** spec §6.2 (các lỗi đọc file), §6.4 (file mẫu), §7 đoạn cuối (luồng đọc); `src/hooks/useExcelExport.ts` dòng 1–20 (màu `headerBg` = `"FFE0E7FF"`) và dòng ~87 (`writeBuffer` + `new Blob([buffer])`).

**Files:**
- Create: `src/lib/student-import-excel.ts`
- Test: `tests/unit/lib/student-import-excel.test.ts`

**Interfaces:**
- Consumes (Task 1): `IMPORT_COLUMNS`, `MAX_IMPORT_ROWS`, `MAX_IMPORT_FILE_BYTES`, `isImportHeader`, `parseImportRows`, `type ParsedImportRow` từ `@/lib/student-import`.
- Produces (Task 5 dùng):
  ```ts
  export type ImportReadError = "file" | "size" | "template" | "empty" | "too_many"
  export type ImportReadResult = { ok: true; rows: ParsedImportRow[] } | { ok: false; error: ImportReadError }
  export async function buildImportTemplate(): Promise<ArrayBuffer>
  export async function readImportWorkbook(data: ArrayBuffer): Promise<ImportReadResult>
  ```
  Mã lỗi khớp key i18n `import_err_<mã>` (Task 4).

Ghi chú kỹ thuật: exceljs khai `load(buffer: Buffer)` nhưng bên trong gọi `JSZip.loadAsync`, nhận được `ArrayBuffer` (trình duyệt không có `Buffer`) → ép kiểu `data as Buffer`. Trong Node (Vitest), `writeBuffer()` trả Node `Buffer`, đưa thẳng vào `readImportWorkbook` được.

- [ ] **Step 1: Viết test fail**

`tests/unit/lib/student-import-excel.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import { IMPORT_COLUMNS, MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from "@/lib/student-import"
import { buildImportTemplate, readImportWorkbook } from "@/lib/student-import-excel"

const HEADER = IMPORT_COLUMNS.map((c) => c.label)

async function makeFile(fill: (sheet: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  fill(wb.addWorksheet("Hoc sinh"))
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

describe("readImportWorkbook", () => {
  it("đọc dòng dữ liệu, giữ số dòng thật, bỏ dòng trống ở giữa", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = HEADER
      s.getRow(2).values = ["Nguyễn An", 5, "Chị Hoa", 912345678, 150000, "Yếu toán"]
      s.getRow(4).values = ["Trần Bình", "Lớp 3"]
    })
    const res = await readImportWorkbook(data)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.rows.map((r) => r.rowNumber)).toEqual([2, 4])
    expect(res.rows[0].input).toMatchObject({ fullName: "Nguyễn An", grade: 5, parentPhone: "0912345678", tuitionFee: 150000 })
    expect(res.rows[1].input.grade).toBe(3)
  })

  it("file không phải xlsx → file", async () => {
    const data = new TextEncoder().encode("không phải file zip").buffer as ArrayBuffer
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "file" })
  })

  it("quá 2MB → size (không cần đọc)", async () => {
    expect(await readImportWorkbook(new ArrayBuffer(MAX_IMPORT_FILE_BYTES + 1))).toEqual({ ok: false, error: "size" })
  })

  it("tiêu đề sai mẫu → template", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = ["Tên", "Lớp", "SĐT"]
      s.getRow(2).values = ["Nguyễn An", 5]
    })
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "template" })
  })

  it("chỉ có tiêu đề → empty", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = HEADER
    })
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "empty" })
  })

  it(`quá ${MAX_IMPORT_ROWS} dòng → too_many`, async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = HEADER
      for (let i = 0; i <= MAX_IMPORT_ROWS; i++) s.addRow([`Học sinh ${i}`, 1])
    })
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "too_many" })
  })
})

describe("buildImportTemplate", () => {
  it("2 sheet, tiêu đề 6 cột đúng thứ tự, không có dòng ví dụ", async () => {
    const buf = await buildImportTemplate()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as Buffer)
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Hoc sinh", "Huong dan"])
    const sheet = wb.getWorksheet("Hoc sinh")!
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(HEADER)
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true)
    expect(sheet.actualRowCount).toBe(1)
  })

  it("đọc lại chính file mẫu → hợp lệ nhưng chưa có dòng (empty)", async () => {
    expect(await readImportWorkbook(await buildImportTemplate())).toEqual({ ok: false, error: "empty" })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/student-import-excel.test.ts`
Expected: FAIL — không resolve được `@/lib/student-import-excel`.

- [ ] **Step 3: Viết code**

`src/lib/student-import-excel.ts`:

```ts
import type { Row } from "exceljs"
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  isImportHeader,
  parseImportRows,
  type ParsedImportRow,
} from "@/lib/student-import"

export type ImportReadError = "file" | "size" | "template" | "empty" | "too_many"
export type ImportReadResult = { ok: true; rows: ParsedImportRow[] } | { ok: false; error: ImportReadError }

const HEADER_BG = "FFE0E7FF" // cùng màu headerBg của useExcelExport

const GUIDE_ROWS = [
  ["Cột", "Bắt buộc", "Cách điền", "Ví dụ"],
  ["Họ tên", "Có", "2 đến 100 ký tự", "Nguyễn Văn An"],
  ["Lớp", "Có", "Số từ 1 đến 9 (ghi \"Lớp 5\" cũng được)", "5"],
  ["Tên phụ huynh", "Không", "Tối đa 100 ký tự", "Chị Hoa"],
  ["SĐT phụ huynh", "Không", "Bắt đầu bằng 0 hoặc +84", "0912345678"],
  ["Học phí/buổi", "Không", "Số tiền VND, bỏ trống là 0", "150000"],
  ["Ghi chú", "Không", "Tối đa 1000 ký tự", "Yếu phần hình học"],
]

// exceljs ~1MB: nạp động để trang Học sinh không phải tải khi chưa dùng tới.
async function loadExcelJS() {
  return (await import("exceljs")).default
}

export async function buildImportTemplate(): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()

  const sheet = wb.addWorksheet("Hoc sinh")
  sheet.columns = IMPORT_COLUMNS.map((c) => ({ header: c.label, width: 22 }))
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } }
  })
  // Cột SĐT dạng text để Excel không nuốt số 0 đầu.
  sheet.getColumn(4).numFmt = "@"

  const guide = wb.addWorksheet("Huong dan")
  guide.addRows(GUIDE_ROWS)
  guide.getRow(1).font = { bold: true }
  for (let i = 1; i <= 4; i++) guide.getColumn(i).width = 28

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

export async function readImportWorkbook(data: ArrayBuffer): Promise<ImportReadResult> {
  if (data.byteLength > MAX_IMPORT_FILE_BYTES) return { ok: false, error: "size" }

  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()
  try {
    // Kiểu khai là Buffer nhưng JSZip bên trong nhận ArrayBuffer (trình duyệt không có Buffer).
    await wb.xlsx.load(data as Buffer)
  } catch {
    return { ok: false, error: "file" }
  }
  const sheet = wb.worksheets[0]
  if (!sheet) return { ok: false, error: "file" }

  const readCells = (row: Row) => IMPORT_COLUMNS.map((_, i) => row.getCell(i + 1).value)
  if (!isImportHeader(readCells(sheet.getRow(1)))) return { ok: false, error: "template" }

  const raw: { rowNumber: number; cells: unknown[] }[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) raw.push({ rowNumber, cells: readCells(row) })
  })
  const rows = parseImportRows(raw)
  if (rows.length === 0) return { ok: false, error: "empty" }
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: "too_many" }
  return { ok: true, rows }
}
```

Nếu `tsc` báo lỗi ở `as ArrayBuffer` / `as Buffer` (xung đột kiểu `Buffer` của exceljs và `@types/node`), đổi thành `as unknown as ArrayBuffer` / `as unknown as Buffer`, giữ nguyên ghi chú.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/student-import-excel.test.ts`
Expected: PASS 8/8.

- [ ] **Step 5: Typecheck + lint + test Task 1**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit/lib/student-import.test.ts`
Expected: không lỗi, pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/student-import-excel.ts tests/unit/lib/student-import-excel.test.ts
git commit -m "feat(students): đọc file Excel nhập học sinh và dựng file mẫu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Backend — `student.importCheck`, `student.importMany` (TDD)

**Đọc trước:** spec §4 (D3, D6, D7, D8), §8, §10 mục Integration; `src/lib/schemas/student.ts`; `src/server/services/student.service.ts` (`createStudent` dòng ~55–72 để ánh xạ field); `src/server/trpc/routers/student.ts`; `tests/integration/student.test.ts` (mẫu `resetStudents`, `getAuthedCaller`); `tests/setup.ts` (seed user `teacher` và `teacher2`).

**Files:**
- Modify: `src/lib/schemas/student.ts`
- Modify: `src/server/services/student.service.ts`
- Modify: `src/server/trpc/routers/student.ts`
- Test: `tests/integration/student-import.test.ts` (mới)

**Interfaces:**
- Consumes (Task 1): `nameKey(fullName: string, grade: number): string`, `type ExistingMatch` từ `@/lib/student-import`.
- Produces (Task 5 dùng):
  - `student.importCheck` (mutation) input `{ rows: { fullName: string; grade: number }[] }` (≤500) → `{ matches: (ExistingMatch | null)[] }` theo đúng thứ tự `rows`.
  - `student.importMany` (mutation) input `{ rows: { fullName; grade; parentName?; parentPhone?; notes?; tuitionFee?; allowDuplicate? }[] }` (1–500, mỗi dòng theo `studentCreateSchema` bỏ `isActive`) → `{ created: number }`. Trùng mà `allowDuplicate` false → `TRPCError CONFLICT` "Danh sách đã thay đổi, hãy chọn lại file để kiểm tra."
  - Schema: `studentImportCheckSchema`, `studentImportSchema`, type `StudentImportCheckInput`, `StudentImportInput`.

- [ ] **Step 1: Viết test fail**

`tests/integration/student-import.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function resetStudents() {
  await db.sessionStudent.deleteMany()
  await db.student.deleteMany()
}

async function countStudents(username = "teacher") {
  const user = await db.user.findUniqueOrThrow({ where: { username } })
  return db.student.count({ where: { userId: user.id } })
}

describe("Nhập học sinh từ Excel", () => {
  beforeEach(async () => {
    await resetStudents()
  })

  it("✓ importMany 3 dòng hợp lệ → created 3, field đúng, isActive=true", async () => {
    const caller = await getAuthedCaller()
    const res = await caller.student.importMany({
      rows: [
        { fullName: "Nguyễn An", grade: 5, parentName: "Chị Hoa", parentPhone: "0912345678", tuitionFee: 150000, notes: "Yếu toán" },
        { fullName: "Trần Bình", grade: 3 },
        { fullName: "Lê Chi", grade: 9, tuitionFee: 200000 },
      ],
    })
    expect(res).toEqual({ created: 3 })

    const list = await caller.student.list({ includeInactive: true, limit: 50 })
    expect(list.items).toHaveLength(3)
    expect(list.items.every((s) => s.isActive)).toBe(true)
    expect(list.items.find((s) => s.fullName === "Nguyễn An")).toMatchObject({
      grade: 5,
      parentName: "Chị Hoa",
      parentPhone: "0912345678",
      tuitionFee: 150000,
      notes: "Yếu toán",
    })
    expect(list.items.find((s) => s.fullName === "Trần Bình")).toMatchObject({
      parentName: null,
      parentPhone: null,
      notes: null,
      tuitionFee: 0,
    })
  })

  it("✗ 1 dòng sai trong lô (lớp 0 / SĐT sai) → BAD_REQUEST, không tạo em nào", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.student.importMany({ rows: [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Trần Bình", grade: 0 }] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(
      caller.student.importMany({
        rows: [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Trần Bình", grade: 3, parentPhone: "12345" }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await countStudents()).toBe(0)
  })

  it("✓ importCheck nhận ra trùng HS đang học và HS đã nghỉ; khác lớp không trùng", async () => {
    const caller = await getAuthedCaller()
    const an = await caller.student.create({ fullName: "Nguyễn Văn An", grade: 5 })
    const binh = await caller.student.create({ fullName: "Trần Bình", grade: 3 })
    await caller.student.delete({ id: binh.id })

    const { matches } = await caller.student.importCheck({
      rows: [
        { fullName: "  nguyễn   VĂN an ", grade: 5 },
        { fullName: "Trần Bình".normalize("NFD"), grade: 3 },
        { fullName: "Nguyễn Văn An", grade: 6 },
      ],
    })
    expect(matches[0]).toMatchObject({ id: an.id, isActive: true })
    expect(matches[1]).toMatchObject({ id: binh.id, isActive: false, fullName: "Trần Bình", grade: 3 })
    expect(matches[2]).toBeNull()
  })

  it("✓ importCheck: có cả HS đã nghỉ và đang học cùng khóa → trả HS đang học", async () => {
    const caller = await getAuthedCaller()
    const old = await caller.student.create({ fullName: "Nguyễn An", grade: 5 })
    await caller.student.delete({ id: old.id })
    const current = await caller.student.create({ fullName: "Nguyễn An", grade: 5 })
    const { matches } = await caller.student.importCheck({ rows: [{ fullName: "Nguyễn An", grade: 5 }] })
    expect(matches[0]).toMatchObject({ id: current.id, isActive: true })
  })

  it("✗/✓ importMany trùng HS có sẵn: allowDuplicate=false → CONFLICT; true → tạo", async () => {
    const caller = await getAuthedCaller()
    await caller.student.create({ fullName: "Nguyễn An", grade: 5 })

    await expect(
      caller.student.importMany({ rows: [{ fullName: "Trần Bình", grade: 3 }, { fullName: "nguyễn an", grade: 5 }] })
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("chọn lại file") })
    expect(await countStudents()).toBe(1)

    const res = await caller.student.importMany({
      rows: [{ fullName: "Trần Bình", grade: 3 }, { fullName: "nguyễn an", grade: 5, allowDuplicate: true }],
    })
    expect(res.created).toBe(2)
    expect(await countStudents()).toBe(3)
  })

  it("✗ hai dòng cùng khóa trong lô, dòng 2 không allowDuplicate → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.student.importMany({ rows: [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Nguyễn  An", grade: 5 }] })
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(await countStudents()).toBe(0)
  })

  it("✗ gọi importMany 2 lần cùng dữ liệu → lần 2 CONFLICT (chống nhập 2 lần)", async () => {
    const caller = await getAuthedCaller()
    const rows = [{ fullName: "Nguyễn An", grade: 5 }, { fullName: "Trần Bình", grade: 3 }]
    await caller.student.importMany({ rows })
    await expect(caller.student.importMany({ rows })).rejects.toMatchObject({ code: "CONFLICT" })
    expect(await countStudents()).toBe(2)
  })

  it("✓ multi-tenant: HS của user khác cùng tên + lớp không tính là trùng", async () => {
    const other = await getAuthedCaller("teacher2")
    await other.student.create({ fullName: "Nguyễn An", grade: 5 })
    const caller = await getAuthedCaller()
    const { matches } = await caller.student.importCheck({ rows: [{ fullName: "Nguyễn An", grade: 5 }] })
    expect(matches).toEqual([null])
    expect((await caller.student.importMany({ rows: [{ fullName: "Nguyễn An", grade: 5 }] })).created).toBe(1)
  })

  it("✗ 501 dòng → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const rows = Array.from({ length: 501 }, (_, i) => ({ fullName: `Học sinh ${i}`, grade: 1 }))
    await expect(caller.student.importMany({ rows })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(caller.student.importCheck({ rows })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await countStudents()).toBe(0)
  })

  it("✓ 300 dòng nhập trong 1 lần; kiểm tra lại → tất cả trùng", async () => {
    const caller = await getAuthedCaller()
    const rows = Array.from({ length: 300 }, (_, i) => ({ fullName: `Học sinh ${i}`, grade: (i % 9) + 1 }))
    expect((await caller.student.importMany({ rows })).created).toBe(300)
    const { matches } = await caller.student.importCheck({ rows })
    expect(matches.every((m) => m !== null)).toBe(true)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/student-import.test.ts`
Expected: FAIL — `tsc`/runtime báo `caller.student.importMany` / `importCheck` không tồn tại (TypeError: ... is not a function).

- [ ] **Step 3: Thêm schema**

Cuối phần schema trong `src/lib/schemas/student.ts` (trước các dòng `export type`):

```ts
// Giới hạn 500 dòng (spec E D2); không import MAX_IMPORT_ROWS vì student-import.ts import file này.
export const studentImportCheckSchema = z.object({
  rows: z.array(z.object({ fullName: z.string().max(100), grade: z.number().int() })).max(500),
})

// 1 dòng sai → Zod từ chối cả request: đúng "tất cả hoặc không".
export const studentImportSchema = z.object({
  rows: z
    .array(studentCreateSchema.omit({ isActive: true }).extend({ allowDuplicate: z.boolean().default(false) }))
    .min(1)
    .max(500),
})
```

Thêm vào nhóm type cuối file:

```ts
export type StudentImportCheckInput = z.infer<typeof studentImportCheckSchema>
export type StudentImportInput = z.infer<typeof studentImportSchema>
```

- [ ] **Step 4: Thêm service**

Trong `src/server/services/student.service.ts`, sửa import type:

```ts
import type {
  StudentCreateInput,
  StudentFilterInput,
  StudentImportCheckInput,
  StudentImportInput,
} from "@/lib/schemas/student"
```

và thêm import:

```ts
import { nameKey, type ExistingMatch } from "@/lib/student-import"
```

Thêm ngay sau hàm `createStudent`:

```ts
// Gồm cả HS đã nghỉ (spec E D3). Cùng khóa nhiều em → ưu tiên em đang học.
async function findExistingByKey(
  db: Prisma.TransactionClient,
  userId: number,
  rows: { fullName: string; grade: number }[]
): Promise<Map<string, ExistingMatch>> {
  const map = new Map<string, ExistingMatch>()
  if (rows.length === 0) return map
  const existing = await db.student.findMany({
    where: { userId, grade: { in: [...new Set(rows.map((r) => r.grade))] } },
    select: { id: true, fullName: true, grade: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { id: "asc" }],
  })
  for (const s of existing) {
    const key = nameKey(s.fullName, s.grade)
    if (!map.has(key)) map.set(key, s)
  }
  return map
}

export async function checkImportDuplicates(
  db: PrismaClient,
  userId: number,
  rows: StudentImportCheckInput["rows"]
): Promise<{ matches: (ExistingMatch | null)[] }> {
  const existing = await findExistingByKey(db, userId, rows)
  return { matches: rows.map((r) => existing.get(nameKey(r.fullName, r.grade)) ?? null) }
}

export async function importStudents(
  db: PrismaClient,
  userId: number,
  rows: StudentImportInput["rows"]
): Promise<{ created: number }> {
  return db.$transaction(async (tx) => {
    // Kiểm tra trùng lại lúc ghi: bấm 2 lần / thử lại sau lỗi mạng không sinh bản sao.
    const existing = await findExistingByKey(tx, userId, rows)
    const seen = new Set<string>()
    for (const r of rows) {
      const key = nameKey(r.fullName, r.grade)
      if ((existing.has(key) || seen.has(key)) && !r.allowDuplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Danh sách đã thay đổi, hãy chọn lại file để kiểm tra.",
        })
      }
      seen.add(key)
    }
    const { count } = await tx.student.createMany({
      data: rows.map((r) => ({
        userId,
        fullName: r.fullName,
        grade: r.grade,
        parentPhone: r.parentPhone ?? null,
        parentName: r.parentName ?? null,
        notes: r.notes ?? null,
        tuitionFee: r.tuitionFee,
        isActive: true,
      })),
    })
    return { created: count }
  })
}
```

(`Prisma` và `TRPCError` đã được import ở đầu file. `PrismaClient` truyền vào tham số kiểu `Prisma.TransactionClient` được.)

- [ ] **Step 5: Thêm router**

`src/server/trpc/routers/student.ts`: bổ sung import schema `studentImportCheckSchema`, `studentImportSchema` và service `checkImportDuplicates`, `importStudents`, rồi thêm vào cuối object router (sau `getUpgradeLogThisYear`):

```ts
  // mutation để 500 dòng đi trong body POST, không nhét vào URL GET
  importCheck: protectedProcedure
    .input(studentImportCheckSchema)
    .mutation(({ ctx, input }) => checkImportDuplicates(ctx.db, ctx.userId, input.rows)),

  importMany: protectedProcedure
    .input(studentImportSchema)
    .mutation(({ ctx, input }) => importStudents(ctx.db, ctx.userId, input.rows)),
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/student-import.test.ts`
Expected: PASS 10/10. Nếu test 300 dòng báo lỗi timeout transaction (`Transaction already closed` / P2028), thêm `{ timeout: 15000 }` làm tham số thứ 2 của `db.$transaction` (như `bulkCreateSessions` trong `session.service.ts`) và ghi lại trong báo cáo.

- [ ] **Step 7: Typecheck + lint + test student cũ**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/integration/student.test.ts`
Expected: không lỗi, pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas/student.ts src/server/services/student.service.ts src/server/trpc/routers/student.ts tests/integration/student-import.test.ts
git commit -m "feat(students): API importCheck/importMany nhập học sinh theo lô, tất cả hoặc không

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: i18n

**Đọc trước:** spec §9.

**Files:**
- Modify: `src/language/vi.json`, `src/language/en.json`

**Interfaces:**
- Produces 25 key (Task 5 dùng): `import_excel`, `import_students_title`, `import_hint`, `download_template`, `choose_file`, `choose_other_file`, `import_summary`, `import_row`, `import_dup_existing`, `import_dup_inactive`, `import_dup_in_file`, `import_anyway`, `import_submit`, `import_success`, `import_err_file`, `import_err_size`, `import_err_template`, `import_err_empty`, `import_err_too_many`, `import_err_fullName`, `import_err_grade`, `import_err_parentPhone`, `import_err_parentName`, `import_err_tuitionFee`, `import_err_notes`.
- Dùng lại key sẵn có (không thêm): `grade` ("Lớp"), `cancel`.
- Placeholder trong chuỗi (`{ok}`, `{dup}`, `{err}`, `{n}`, `{name}`, `{grade}`) được thay bằng `.replace()` ở UI như các chỗ khác trong dự án.

- [ ] **Step 1: Thêm key (script giữ thứ tự và kiểu xuống dòng của file, ném lỗi nếu key đã tồn tại)**

```bash
node - <<'EOF'
const fs = require('fs')
const add = {
  vi: {
    import_excel: "Nhập Excel",
    import_students_title: "Nhập học sinh từ Excel",
    import_hint: "Tải file mẫu, điền mỗi học sinh 1 dòng, rồi chọn file để xem trước.",
    download_template: "Tải file mẫu",
    choose_file: "Chọn file",
    choose_other_file: "Chọn file khác",
    import_summary: "{ok} hợp lệ · {dup} trùng · {err} lỗi",
    import_row: "Dòng {n}",
    import_dup_existing: "Trùng với {name} (lớp {grade})",
    import_dup_inactive: "Trùng với {name} (lớp {grade}, đã nghỉ)",
    import_dup_in_file: "Trùng dòng {n} trong file",
    import_anyway: "Vẫn nhập",
    import_submit: "Nhập {n} học sinh",
    import_success: "Đã nhập {n} học sinh",
    import_err_file: "Không đọc được file. Hãy chọn file .xlsx.",
    import_err_size: "File quá 2MB",
    import_err_template: "File không đúng mẫu. Hãy tải file mẫu.",
    import_err_empty: "File không có dòng dữ liệu",
    import_err_too_many: "Tối đa 500 học sinh mỗi lần",
    import_err_fullName: "Họ tên phải từ 2 đến 100 ký tự",
    import_err_grade: "Lớp phải là số từ 1 đến 9",
    import_err_parentPhone: "SĐT không hợp lệ",
    import_err_parentName: "Tên phụ huynh tối đa 100 ký tự",
    import_err_tuitionFee: "Học phí phải là số không âm",
    import_err_notes: "Ghi chú tối đa 1000 ký tự",
  },
  en: {
    import_excel: "Import Excel",
    import_students_title: "Import students from Excel",
    import_hint: "Download the template, fill one student per row, then choose the file to preview.",
    download_template: "Download template",
    choose_file: "Choose file",
    choose_other_file: "Choose another file",
    import_summary: "{ok} valid · {dup} duplicate · {err} errors",
    import_row: "Row {n}",
    import_dup_existing: "Matches {name} (grade {grade})",
    import_dup_inactive: "Matches {name} (grade {grade}, inactive)",
    import_dup_in_file: "Same as row {n} in file",
    import_anyway: "Import anyway",
    import_submit: "Import {n} students",
    import_success: "Imported {n} students",
    import_err_file: "Cannot read file. Please choose an .xlsx file.",
    import_err_size: "File exceeds 2MB",
    import_err_template: "File doesn't match the template. Please download it.",
    import_err_empty: "File has no data rows",
    import_err_too_many: "At most 500 students per import",
    import_err_fullName: "Name must be 2–100 characters",
    import_err_grade: "Grade must be a number from 1 to 9",
    import_err_parentPhone: "Invalid phone number",
    import_err_parentName: "Parent name max 100 characters",
    import_err_tuitionFee: "Fee must be a non-negative number",
    import_err_notes: "Notes max 1000 characters",
  },
}
for (const l of ['vi', 'en']) {
  const p = `src/language/${l}.json`
  const raw = fs.readFileSync(p, 'utf8')
  const o = JSON.parse(raw)
  for (const [k, v] of Object.entries(add[l])) {
    if (k in o) throw new Error('dup ' + k)
    o[k] = v
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  fs.writeFileSync(p, JSON.stringify(o, null, 2).replace(/\n/g, eol) + (raw.endsWith('\n') ? eol : ''))
}
EOF
```

- [ ] **Step 2: Kiểm tra parity**

Run:
```bash
node -e "const vi=require('./src/language/vi.json'),en=require('./src/language/en.json');const a=Object.keys(vi),b=Object.keys(en);const d=[...a.filter(k=>!(k in en)),...b.filter(k=>!(k in vi))];console.log(a.length,b.length,d.length?'LỆCH: '+d:'OK')"
```
Expected: 2 số bằng nhau và `OK`; mỗi file tăng đúng 25 key so với trước khi chạy script (lúc viết plan là `306 306` → `331 331`; nếu phần khác đã merge trước thì số gốc khác, chỉ cần +25 và `OK`).

Kiểm tra `git diff --stat src/language` chỉ có dòng thêm (không đổi thứ tự/định dạng key cũ).

- [ ] **Step 3: Typecheck + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint` → không lỗi.

```bash
git add src/language/vi.json src/language/en.json
git commit -m "chore(i18n): key cho nhập học sinh từ Excel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: UI — nút Nhập Excel + dialog 2 bước

**Đọc trước:** spec §6 (toàn bộ); `src/components/students/StudentList.tsx` (khối `PageHeader actions`); `src/components/students/UpgradeAllClassesButton.tsx` (kiểu nút chỉ hiện icon dưới `sm`); `src/components/students/StudentFormDialog.tsx` (class `DialogContent` toàn màn hình mobile); `src/components/ui/dialog.tsx`, `src/components/ui/checkbox.tsx`.

**Files:**
- Create: `src/components/students/ImportStudentsDialog.tsx`
- Modify: `src/components/students/StudentList.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `buildPreview`, `toImportPayload`, `type PreviewRow` từ `@/lib/student-import`.
  - Task 2: `buildImportTemplate(): Promise<ArrayBuffer>`, `readImportWorkbook(data: ArrayBuffer): Promise<ImportReadResult>`, `type ImportReadError` từ `@/lib/student-import-excel`.
  - Task 3: `trpc.student.importCheck.useMutation()` → `{ matches }`; `trpc.student.importMany.useMutation()` → `{ created }`.
  - Task 4: các key `import_*`, `download_template`, `choose_file`, `choose_other_file`, `grade`.
- Produces (e2e Task 6 dùng): nút `aria-label="Nhập Excel"`; trong dialog: nút "Tải file mẫu", nút "Chọn file", `data-testid="import-file-input"` (input file ẩn), `data-testid="import-summary"`, `data-testid="import-row"` mỗi thẻ dòng, checkbox tên "Vẫn nhập", nút "Nhập {n} học sinh".

- [ ] **Step 1: Tạo `ImportStudentsDialog.tsx`**

`src/components/students/ImportStudentsDialog.tsx`:

```tsx
"use client"

import { useRef, useState } from "react"
import { saveAs } from "file-saver"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc"
import { cn, formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { buildPreview, toImportPayload, type PreviewRow } from "@/lib/student-import"
import { buildImportTemplate, readImportWorkbook, type ImportReadError } from "@/lib/student-import-excel"

export function ImportStudentsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={t("import_excel")}
        className="h-11 px-3 md:h-10 md:px-4"
      >
        <FileSpreadsheet className="size-4 text-green-600 sm:mr-2" />
        <span className="hidden sm:inline">{t("import_excel")}</span>
      </Button>
      {open && <ImportStudentsDialog onClose={() => setOpen(false)} />}
    </>
  )
}

// Chỉ mount khi mở nên mỗi lần mở là state mới, không cần effect reset.
function ImportStudentsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [allowed, setAllowed] = useState<Set<number>>(new Set())
  const [readError, setReadError] = useState<ImportReadError | null>(null)
  const [reading, setReading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const checkMut = trpc.student.importCheck.useMutation()
  const importMut = trpc.student.importMany.useMutation({
    onSuccess: (data) => {
      toast.success(t("import_success").replace("{n}", String(data.created)))
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      saveAs(new Blob([await buildImportTemplate()]), "mau-nhap-hoc-sinh.xlsx")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setDownloading(false)
    }
  }

  const handleFile = async (file: File) => {
    setReadError(null)
    setReading(true)
    try {
      const result = await readImportWorkbook(await file.arrayBuffer())
      if (!result.ok) {
        setReadError(result.error)
        return
      }
      const valid = result.rows.filter((r) => r.errors.length === 0)
      const { matches } =
        valid.length > 0
          ? await checkMut.mutateAsync({
              rows: valid.map((r) => ({ fullName: r.input.fullName, grade: r.input.grade })),
            })
          : { matches: [] }
      setAllowed(new Set())
      setPreview(buildPreview(result.rows, matches))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setReading(false)
      // Xóa giá trị để chọn lại đúng file đó vẫn bắn onChange.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const toggleAllowed = (rowNumber: number, on: boolean) => {
    setAllowed((prev) => {
      const next = new Set(prev)
      if (on) next.add(rowNumber)
      else next.delete(rowNumber)
      return next
    })
  }

  const dupReason = (row: PreviewRow) =>
    row.existing
      ? t(row.existing.isActive ? "import_dup_existing" : "import_dup_inactive")
          .replace("{name}", row.existing.fullName)
          .replace("{grade}", String(row.existing.grade))
      : t("import_dup_in_file").replace("{n}", String(row.sameAsRow))

  const payload = preview ? toImportPayload(preview, allowed) : []
  const count = (s: PreviewRow["status"]) => String(preview?.filter((r) => r.status === s).length ?? 0)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-0 top-0 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-y-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>{t("import_students_title")}</DialogTitle>
        </DialogHeader>

        {preview === null ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t("import_hint")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={downloadTemplate} disabled={downloading} className="h-11 md:h-10">
                {downloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                {t("download_template")}
              </Button>
              <Button onClick={() => inputRef.current?.click()} disabled={reading} className="h-11 md:h-10">
                {reading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 size-4" />
                )}
                {t("choose_file")}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                data-testid="import-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
            </div>
            {readError && (
              <p role="alert" className="text-sm text-red-600">
                {t(`import_err_${readError}`)}
              </p>
            )}
          </div>
        ) : (
          <>
            <p data-testid="import-summary" className="text-sm font-medium text-slate-700">
              {t("import_summary")
                .replace("{ok}", count("ok"))
                .replace("{dup}", count("duplicate"))
                .replace("{err}", count("error"))}
            </p>
            <ul className="space-y-2">
              {preview.map((row) => {
                const fee = row.input.tuitionFee
                const details = [
                  row.input.parentName,
                  row.input.parentPhone,
                  Number.isNaN(fee) ? null : formatCurrency(fee),
                  row.input.notes,
                ].filter(Boolean)
                const checkboxId = `import-anyway-${row.rowNumber}`
                return (
                  <li
                    key={row.rowNumber}
                    data-testid="import-row"
                    className={cn(
                      "rounded-lg border p-3",
                      row.status === "error" && "border-red-200 bg-red-50",
                      row.status === "duplicate" && "border-amber-300 bg-amber-50/40"
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="text-slate-500">{t("import_row").replace("{n}", String(row.rowNumber))}</span>
                      <span className="min-w-0 max-w-full truncate font-medium text-slate-900">{row.input.fullName}</span>
                      <span className="text-slate-600">
                        {t("grade")} {Number.isNaN(row.input.grade) ? "?" : row.input.grade}
                      </span>
                    </div>
                    {details.length > 0 && (
                      <p className="mt-1 truncate text-xs text-slate-500">{details.join(" · ")}</p>
                    )}
                    {row.status === "error" && (
                      <ul className="mt-2 space-y-0.5 text-xs text-red-700">
                        {row.errors.map((f) => (
                          <li key={f}>{t(`import_err_${f}`)}</li>
                        ))}
                      </ul>
                    )}
                    {row.status === "duplicate" && (
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
                        <p className="text-xs text-amber-700">{dupReason(row)}</p>
                        <Label htmlFor={checkboxId} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            id={checkboxId}
                            checked={allowed.has(row.rowNumber)}
                            onCheckedChange={(v) => toggleAllowed(row.rowNumber, v === true)}
                          />
                          {t("import_anyway")}
                        </Label>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-auto gap-2 border-t bg-white px-6 py-3 sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:p-0">
              <Button
                variant="outline"
                onClick={() => setPreview(null)}
                disabled={importMut.isPending}
                className="h-11 md:h-10"
              >
                {t("choose_other_file")}
              </Button>
              <Button
                onClick={() => importMut.mutate({ rows: payload })}
                disabled={payload.length === 0 || importMut.isPending}
                className="h-11 w-full sm:w-auto md:h-10"
              >
                {importMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("import_submit").replace("{n}", String(payload.length))}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

Ghi chú khi làm:
- `t(\`import_err_${readError}\`)` và `t(\`import_err_${f}\`)` có kiểu template literal; `tsc` chấp nhận vì cả 11 key đã có ở Task 4. Nếu `tsc` không suy ra được, ép `as const` cho template string, **không** dùng `as any`.
- `DialogContent` của shadcn mặc định `grid`; `flex flex-col` trong className ghi đè nhờ `tailwind-merge` → chân dialog `mt-auto` + `sticky bottom-0` dính đáy khi danh sách dài ở mobile.
- Lỗi `CONFLICT` từ server hiện qua `toast.error(e.message)` và dialog giữ nguyên bước 2 (spec §6.3).

- [ ] **Step 2: Gắn nút vào `StudentList`**

Trong `src/components/students/StudentList.tsx`:
- Thêm import cạnh `UpgradeAllClassesButton`:
  ```ts
  import { ImportStudentsButton } from "./ImportStudentsDialog"
  ```
- Trong `actions` của `PageHeader`, chèn giữa `<UpgradeAllClassesButton />` và nút "Thêm học sinh":
  ```tsx
            <UpgradeAllClassesButton />
            <ImportStudentsButton />
            <Button onClick={() => setFormState({ open: true, mode: "create" })} className="h-11 md:h-10">
  ```

- [ ] **Step 3: Typecheck, lint, unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit/lib/student-import.test.ts`
Expected: không lỗi, pass.

- [ ] **Step 4: Kiểm tra exceljs không vào bundle trang Học sinh**

Run: `grep -n "from \"exceljs\"\|from 'exceljs'" src/components/students/*.tsx src/lib/student-import.ts`
Expected: không có kết quả (exceljs chỉ xuất hiện dạng `import("exceljs")` và `import type` trong `src/lib/student-import-excel.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/components/students/ImportStudentsDialog.tsx src/components/students/StudentList.tsx
git commit -m "feat(students): nút Nhập Excel và dialog xem trước trước khi nhập

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: E2E 390px + kiểm chứng cuối

**Đọc trước:** spec §10 mục E2E và Chung; `playwright.config.ts`; `tests/e2e/subjects.spec.ts` (mẫu login, ẩn `nextjs-portal`); Global Constraints (mục E2E, CẤM).

**Files:**
- Create: `tests/e2e/students-import.spec.ts`
- Create (không commit): `.superpowers/pw-3100.config.ts`

**Interfaces:**
- Consumes (Task 5): nút `aria-label="Nhập Excel"`, nút "Tải file mẫu", `data-testid="import-file-input"`, `data-testid="import-summary"`, checkbox "Vẫn nhập", nút "Nhập {n} học sinh"; toast "Đã nhập {n} học sinh"; ô tìm kiếm placeholder "Tìm tên học sinh..." của `StudentList`.

- [ ] **Step 1: Viết e2e**

File fixture được dựng **từ chính file mẫu vừa tải** (thêm dòng bằng exceljs trong Node) để kiểm tra luôn khớp mẫu ↔ parser.

`tests/e2e/students-import.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Nhập học sinh từ Excel (390px)', () => {
  test.beforeEach(async ({ page }) => {
    // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal { display: none !important; }';
        document.head.appendChild(style);
      });
    });
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  // HS nhập vào không xóa trong test → tên có tiền tố ngẫu nhiên; DB test được reset khi chạy `pnpm test`.
  test('tải mẫu, xem trước, nhập 2 em, nhập lại thấy trùng', async ({ page }, testInfo) => {
    const tag = `E2E-${Math.floor(Math.random() * 1_000_000)}`;
    const nameA = `${tag} An`;
    const nameB = `${tag} Bình`;

    await page.goto('/students');
    await page.getByRole('button', { name: 'Nhập Excel' }).click();
    const dialog = page.getByRole('dialog');

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Tải file mẫu' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mau-nhap-hoc-sinh.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await download.path());
    const sheet = wb.getWorksheet('Hoc sinh')!;
    sheet.addRow([nameA, 5, 'Chị Hoa', '0912345678', 150000, '']);
    sheet.addRow([nameB, 'Lớp 3', '', '', '', '']);
    sheet.addRow([`${tag} Lỗi`, 12, '', '', '', '']);
    const filePath = testInfo.outputPath('import.xlsx');
    await wb.xlsx.writeFile(filePath);

    await dialog.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(dialog.getByTestId('import-summary')).toHaveText('2 hợp lệ · 0 trùng · 1 lỗi');
    await expect(dialog.getByText('Lớp phải là số từ 1 đến 9')).toBeVisible();

    await dialog.getByRole('button', { name: 'Nhập 2 học sinh' }).click();
    await expect(page.getByText('Đã nhập 2 học sinh')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByPlaceholder('Tìm tên học sinh...').fill(tag);
    await expect(page.getByText(nameA, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(nameB, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(`${tag} Lỗi`)).toHaveCount(0);

    // Nhập lại đúng file → 2 dòng trùng, mặc định không nhập được gì
    await page.getByRole('button', { name: 'Nhập Excel' }).click();
    await page.getByRole('dialog').getByTestId('import-file-input').setInputFiles(filePath);
    const again = page.getByRole('dialog');
    await expect(again.getByTestId('import-summary')).toHaveText('0 hợp lệ · 2 trùng · 1 lỗi');
    await expect(again.getByText(`Trùng với ${nameA} (lớp 5)`)).toBeVisible();
    await expect(again.getByRole('button', { name: 'Nhập 0 học sinh' })).toBeDisabled();

    // Tick "Vẫn nhập" 1 dòng → số trên nút đổi (không bấm nhập)
    await again.getByRole('checkbox', { name: 'Vẫn nhập' }).first().click();
    await expect(again.getByRole('button', { name: 'Nhập 1 học sinh' })).toBeEnabled();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Tạo config tạm cổng 3100 (không commit)**

Kiểm tra cổng trống: `netstat -ano | findstr :3100` (PowerShell) — nếu đã có tiến trình không phải do chính bạn khởi bằng config này → dùng cổng khác (vd 3101, sửa cả 3 chỗ), không dùng lại server lạ.

`.superpowers/pw-3100.config.ts`:

```ts
// Config tạm, không commit: cổng 3000 có thể bị project khác chiếm.
import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

export default defineConfig({
  ...base,
  testDir: '../tests/e2e',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    ...(base.webServer as object),
    command: 'pnpm exec next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: true,
  },
});
```

`import base` kéo theo `import './tests/env-setup'` của `playwright.config.ts` → server con vẫn nhận `DATABASE_URL` của `.env.test` qua `webServer.env`. Thêm `.superpowers/` vào `.git/info/exclude` (cục bộ, không commit) nếu chưa có:

```bash
grep -qx '.superpowers/' .git/info/exclude || echo '.superpowers/' >> .git/info/exclude
```

- [ ] **Step 3: Chạy e2e mới + e2e Học sinh cũ**

Run: `pnpm exec playwright test students-import students mobile -c .superpowers/pw-3100.config.ts`
Expected: pass toàn bộ (test mới + `students.spec.ts` + `mobile.spec.ts` không vỡ vì nút mới trong `PageHeader`).

- [ ] **Step 4: Kiểm tra toàn bộ**

Run lần lượt (không song song):
```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm exec playwright test -c .superpowers/pw-3100.config.ts
pnpm exec next build
```
Expected: lint/tsc sạch; unit + integration pass (~10–15 phút); toàn bộ e2e pass (upgrade-class có thể skip như trước); build OK. **Không** chạy `pnpm build`.

Sau đó xóa config tạm hoặc giữ lại nhưng chắc chắn `git status` không liệt kê `.superpowers/`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/students-import.spec.ts
git commit -m "test(e2e): nhập học sinh từ Excel trên mobile (mẫu, xem trước, trùng)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 6: Bàn giao (không merge, không push)**

Báo cho người điều phối: danh sách commit trên `feat/e-excel-import`, kết quả Step 4, mọi chỗ đã lệch plan (vd có thêm `timeout` transaction ở Task 3). Ghi lại các bước kiểm tra tay còn lại cho người dùng (sau khi merge, trên production với dữ liệu thật của chính họ):

1. Mở file mẫu bằng Excel (Windows) và Excel/Numbers (Mac): 2 sheet "Hoc sinh", "Huong dan"; tiêu đề in đậm nền tím nhạt; gõ `0912345678` vào cột SĐT vẫn giữ số 0 đầu.
2. Điền vài dòng trên Mac (hoặc dán tên copy từ Zalo/web) → xem trước không báo lỗi lạ; nhập lại → hiện trùng.
3. Trên điện thoại thật: nút chỉ hiện icon, chọn file từ bộ nhớ/Drive được, chân dialog dính đáy khi danh sách dài, ô "Vẫn nhập" dễ bấm.
4. Chọn file 300 dòng → nhập trong 1 lần bấm, danh sách tự làm mới.
