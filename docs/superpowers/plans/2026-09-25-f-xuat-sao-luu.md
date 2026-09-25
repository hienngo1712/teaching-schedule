# F — Xuất sao lưu dữ liệu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên bấm "Sao lưu dữ liệu" trong menu avatar và tải về 1 file `.xlsx` gồm sheet "Thông tin" cùng 7 sheet dữ liệu (Học sinh, Môn học, Ca dạy, Điểm danh, Học phí tháng, Lần thu, Lịch sử lên lớp). File chỉ chứa dữ liệu của chính user đó.

**Architecture:** Service MỚI `backup.service.ts` chạy song song các `findMany` (có `select` liệt kê từng cột, `where` theo chủ sở hữu), rồi dựng workbook `exceljs` qua 1 helper `addDataSheet` dùng chung, trong đó mỗi cột khai báo tiêu đề, độ rộng, kiểu ô và hàm lấy giá trị. Route Handler MỚI `GET /api/backup` tự kiểm `auth()` và trả file nhị phân. Client có hook MỚI `useBackupDownload` (fetch → blob → `saveAs`, bọc trong `toast.promise`) và 1 mục mới trong menu avatar của `AppHeader`.

**Tech Stack:** Next.js 15 App Router (Route Handler), NextAuth v5 (`auth()`), Prisma 5, exceljs 4 (đã có), file-saver (đã có), sonner, lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-f-xuat-sao-luu-design.md`. Spec liên quan: B `docs/superpowers/specs/2026-09-25-b-lich-su-thu-tien-design.md` (mục 8.1, 11), C `docs/superpowers/specs/2026-09-25-c-phieu-bao-hoc-phi-vietqr-design.md` (mục 6.4, 7.2, 8), G `docs/superpowers/specs/2026-09-25-g-link-phu-huynh-design.md` (mục 8, 11).

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh đụng DB (kể cả `pnpm test`), đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` KHÁC `.env.test`. `.env` là PRODUCTION (host `ep-polished-voice`), `.env.test` là test (host `ep-jolly-dew`). Test chỉ chạy qua `pnpm test ...`, vì lệnh này tự nạp `.env.test` qua `tests/env-setup.ts`.
- **CẤM:** `pnpm db:reset`, `prisma migrate reset`, `prisma db push --force-reset`, `pnpm build` (lệnh này chạy `prisma migrate deploy` lên prod), `pnpm dev` (dùng DB prod). Kiểm tra build bằng `pnpm exec next build`.
- F **không đổi schema, không migration** (spec mục 4). Nếu thấy cần migration thì DỪNG và báo lại.
- Không thêm dependency: `exceljs`, `file-saver`, `sonner`, `lucide-react` đều đã có trong `package.json`.
- Chạy test 1 file: `pnpm test <đường-dẫn>`. Không chạy 2 lượt `pnpm test` song song vì 2 lượt sẽ tranh DB test và treo. Bộ đầy đủ mất khoảng 10–15 phút.
- Mỗi file test integration/unit đều được `tests/setup.ts` reset DB test và seed lại 2 user `teacher` và `teacher2` (mỗi user có sẵn 1 môn mặc định "Tiếng Anh", mật khẩu `teacher123`).
- E2E: cổng 3000 có thể đang bị project khác chiếm. Dùng config tạm git-ignored `.superpowers/pw-3100.config.ts` (nội dung ở Task 7): cổng 3100, url kiểm tra `http://127.0.0.1:3100/login`, `reuseExistingServer: true`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`.
- i18n: `src/language/vi.json` và `en.json` phải có cùng bộ key. Chuỗi mới không dùng dấu gạch dài. Nội dung file Excel ghi cứng tiếng Việt, không theo ngôn ngữ giao diện (spec D5).
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy.
- **Không bao giờ xuất:** `passwordHash`, `LoginAttempt`, `User.isActive`/`lastLoginAt`, `Student.parentLinkToken` (cột của G, ai giữ file sẽ mở được link phụ huynh), hay bất kỳ token/khóa bí mật nào. Mọi truy vấn dùng `select` liệt kê từng cột. Không dùng `include`, không spread cả bản ghi.
- Chỉ đọc DB: không ghi, không gọi `getMonthlyTuitionStatus`.
- Làm trên nhánh `feat/f-backup-export`, không commit lên `main`. Agent thực hiện task **KHÔNG merge, KHÔNG push**. Người điều phối merge/push sau review cuối.
- Mỗi task kết thúc khi: test của task xanh, `pnpm exec tsc --noEmit` sạch, `pnpm lint` sạch, rồi mới commit.
- Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Không nhập mật khẩu/credential vào trình duyệt. Không thao tác ghi trên tài khoản production.

## Điều chỉnh so với spec

1. **Test 401 của route** (spec mục 8 "Unit") được đặt trong `tests/integration/backup-route.test.ts`, chung file với test 200/500, vì 2 test sau cần DB test. Vẫn dùng `vi.mock("@/server/auth")` như spec.
2. **Hook kiểm thêm `Content-Type`:** spec mục 5.2 chỉ yêu cầu ném lỗi khi `!res.ok`. Nhưng middleware không loại trừ `/api/backup`, nên nếu phiên hết hạn thì `fetch` sẽ đi theo redirect về `/login` và nhận HTML với status 200. Hook vì thế ném lỗi khi `Content-Type` không chứa `spreadsheetml`, để không lưu 1 file HTML mang đuôi `.xlsx`.
3. **Chặn bấm 2 lần bằng `useRef`**, ngoài state `isDownloading`: state chỉ đổi sau lần render kế tiếp, còn ref chặn được ngay.
4. **Thêm hàm thuần `filenameFromDisposition`** (export từ file hook) để unit test được phần lấy tên file.
5. **Cột "Năm học"** ở sheet Lịch sử lên lớp xuất nguyên số `year` đang lưu (vd `2026`), không đổi thành "2026-2027", vì sao lưu là chép nguyên dạng (spec D6).
6. **Sheet "Thông tin"** ghi số dòng theo nhãn `Số dòng: <tên sheet>` cho 7 sheet dữ liệu. Không đếm sheet "Cài đặt" (Task 4) vì sheet đó không phải bảng dữ liệu.
7. **Sheet "Cài đặt"** (Task 4) là bước có điều kiện: chỉ làm khi C đã merge (`User.bankBin` có trong schema). Chưa có thì bỏ qua Task 4, không chặn F.

## Review Focus

1. **Phiên đăng nhập hết hạn lúc bấm** → middleware chuyển về `/login`, `fetch` nhận HTML 200. Phải hiện toast lỗi, không được lưu file HTML đuôi `.xlsx`. Test chốt: unit hook ở Task 6.
2. **`session.user.id` là chuỗi rỗng** (callback `session` trong `auth.config.ts` đặt `""` khi token thiếu `userId`) → route phải trả 401, không được chạy với `Number("") = 0`. Test chốt: `backup-route.test.ts` ở Task 5.
3. **Bấm "Sao lưu dữ liệu" 2 lần thật nhanh** → chỉ có 1 request, 1 file. Test chốt: unit hook ở Task 6.
4. **Ghi chú/tên bắt đầu bằng `=`** (vd ghi chú `=HYPERLINK("http://x")`) → ô phải là chuỗi, không thành công thức Excel. Test chốt: integration ở Task 2.
5. **Trường rỗng** (HS không có SĐT, tên phụ huynh, ghi chú) → ô trống thật, không phải chuỗi `"null"`/`"undefined"`. Test chốt: integration ở Task 2.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `src/server/services/backup.service.ts` | Mới | `backupFileName`, `buildBackupWorkbook`, helper `addDataSheet` | 2, 3, (4) |
| `src/app/api/backup/route.ts` | Mới | `GET /api/backup`: auth → workbook → Response nhị phân | 5 |
| `src/hooks/useBackupDownload.ts` | Mới | `useBackupDownload()`, `filenameFromDisposition()` | 6 |
| `src/components/layout/AppHeader.tsx` | Sửa | Mục "Sao lưu dữ liệu" trong menu avatar | 6 |
| `src/language/vi.json`, `en.json` | Sửa | 4 key mới | 6 |
| `tests/unit/services/backup-filename.test.ts` | Mới | Unit `backupFileName` | 2 |
| `tests/integration/backup.test.ts` | Mới | Integration workbook | 2, 3, (4) |
| `tests/integration/backup-route.test.ts` | Mới | Route 401/200/500 | 5 |
| `tests/unit/hooks/useBackupDownload.test.ts` | Mới | Hook: tên file, chặn bấm đôi, phiên hết hạn | 6 |
| `tests/e2e/backup.spec.ts` | Mới | E2E 390×844 | 7 |
| `.superpowers/pw-3100.config.ts` | Mới, git-ignored | Config e2e cổng 3100 (không commit) | 7 |

---

### Task 1: Tạo nhánh + kiểm tra phụ thuộc (B bắt buộc, C/G ghi nhận)

**Đọc trước:** spec F mục 0 (đầu file) và mục 9 (dòng "Code F trước khi B merge"); spec B mục 11.

**Files:** không sửa file nào.

**Interfaces:**
- Consumes: không.
- Produces (ghi vào báo cáo task để task sau đối chiếu): chữ ký thật của `payment.create` (input), `PAYMENT_METHODS`, trạng thái C (có `bankBin`, `findBank` không), trạng thái G (có `parentLinkToken` không).

- [ ] **Step 1: Cập nhật main**

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

- [ ] **Step 2: Kiểm tra B đã merge. Thiếu bất kỳ dòng nào thì DỪNG, báo người dùng "F phụ thuộc B, B chưa merge"**

```bash
grep -n "model Payment" prisma/schema.prisma
grep -n "PAYMENT_METHODS" src/lib/schemas/payment.ts
grep -n "export async function createPayment" src/server/services/payment.service.ts
grep -n "payment" src/server/trpc/root.ts
grep -n "payment.deleteMany" tests/setup.ts
```
Expected: mỗi lệnh in ít nhất 1 dòng. Nếu có lệnh không in gì (hoặc báo file không tồn tại) → **DỪNG toàn bộ plan**, không tạo nhánh, không làm tiếp.

- [ ] **Step 3: Ghi lại interface thật của B**

```bash
sed -n '/model Payment/,/^}/p' prisma/schema.prisma
cat src/lib/schemas/payment.ts
```
Đối chiếu với plan này: model `Payment` có `id, monthlyTuitionId, amount, paidAt (@db.Date), method, note, createdAt, updatedAt` và quan hệ `monthlyTuition`. `PAYMENT_METHODS = ["cash", "transfer"] as const`. Input của `payment.create` là `{ studentId, year, month, amount, paidAt: "YYYY-MM-DD", method, note? }`. **Nếu code thật lệch với plan thì theo code thật, và ghi rõ chỗ lệch vào báo cáo task** (Task 3 dùng các tên này).

- [ ] **Step 4: Ghi nhận C và G (không chặn)**

```bash
grep -n "bankBin\|bankAccountNumber\|bankAccountName" prisma/schema.prisma || echo "C: CHƯA CÓ → bỏ qua Task 4"
grep -n "export function findBank" src/lib/vn-banks.ts || echo "C: chưa có findBank"
grep -n "parentLinkToken" prisma/schema.prisma || echo "G: CHƯA CÓ cột token"
```
Ghi kết quả vào báo cáo task.

- [ ] **Step 5: Tạo nhánh**

```bash
git checkout -b feat/f-backup-export
```
(Nếu nhánh đã tồn tại: `git checkout feat/f-backup-export && git merge --ff-only main`. Nếu không fast-forward được thì DỪNG và báo lại.)

- [ ] **Step 6: Xác nhận DB test khác production**

Đọc `docs/coding-rule.md` §6.1, rồi chạy:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=` chứa `ep-polished-voice`, `test=` chứa `ep-jolly-dew`, 2 host khác nhau. Nếu giống nhau → DỪNG.

- [ ] **Step 7: Kiểm tra nền xanh trước khi code**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi. Task này không commit (không có thay đổi).

---

### Task 2: Service — tên file, helper sheet, sheet Thông tin / Học sinh / Môn học

**Đọc trước:** spec F mục 3 (D3–D7), 6.3 (quy ước ô, bảng cột của 3 sheet này), 6.4, 8. Đọc code `src/lib/utils.ts` (`formatTime`, `formatDayOfWeek`), `src/lib/payment-notes.ts` (`formatVnDate`: cách cộng 7 giờ), `tests/helpers/trpc.ts` (`getAuthedCaller`), `tests/setup.ts`.

**Files:**
- Create: `src/server/services/backup.service.ts`
- Create: `tests/unit/services/backup-filename.test.ts`
- Create: `tests/integration/backup.test.ts`

**Interfaces:**
- Consumes: Prisma models `User`, `Student`, `Subject`. Router có sẵn: `student.create({ fullName, grade, parentName?, parentPhone?, notes?, tuitionFee? })`, `student.update({ id, data: { isActive } })`, `subject.create({ name })`, `subject.update({ id, data: { isActive } })`.
- Produces:
  - `backupFileName(now: Date): string`, trả `SaoLuu_YYYY-MM-DD_HHmm.xlsx` theo giờ VN.
  - `buildBackupWorkbook(db: PrismaClient, userId: number, now: Date): Promise<ExcelJS.Workbook>`. Sau Task 2, workbook có sheet theo thứ tự `["Thông tin", "Học sinh", "Môn học"]`; Task 3 thêm 5 sheet nữa.
  - Helper nội bộ (không export) `addDataSheet<T>(wb, name, rows: T[], columns: Column<T>[]): number`, trả số dòng dữ liệu. Task 3 và 4 dùng lại helper này.

- [ ] **Step 1: Viết unit test fail cho tên file**

`tests/unit/services/backup-filename.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { backupFileName } from "@/server/services/backup.service"

describe("backupFileName", () => {
  it("quy về giờ VN, qua nửa đêm thì sang ngày mới", () => {
    expect(backupFileName(new Date("2026-09-25T17:30:00Z"))).toBe("SaoLuu_2026-09-26_0030.xlsx")
  })

  it("đệm 0 cho tháng/ngày/giờ/phút", () => {
    expect(backupFileName(new Date("2026-01-05T02:05:00Z"))).toBe("SaoLuu_2026-01-05_0905.xlsx")
  })
})
```

- [ ] **Step 2: Viết integration test fail**

`tests/integration/backup.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest"
import ExcelJS from "exceljs"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { buildBackupWorkbook } from "@/server/services/backup.service"

const NOW = new Date("2026-09-25T14:30:00Z")

const DATA_SHEETS = ["Học sinh", "Môn học"]

const HEADERS: Record<string, string[]> = {
  "Thông tin": ["Mục", "Giá trị"],
  "Học sinh": [
    "ID", "Họ tên", "Lớp", "Tên phụ huynh", "SĐT phụ huynh", "Học phí/buổi",
    "Đang học", "Ghi chú", "Ngày tạo", "Cập nhật lần cuối",
  ],
  "Môn học": ["ID", "Tên môn", "Màu (hex)", "Mặc định", "Đang dạy", "Thứ tự", "Ngày tạo"],
}

// Số bản ghi của user theo đúng điều kiện chủ sở hữu ở spec mục 6.3.
const COUNTERS: Record<string, (userId: number) => Promise<number>> = {
  "Học sinh": (userId) => db.student.count({ where: { userId } }),
  "Môn học": (userId) => db.subject.count({ where: { userId } }),
}

// Cột token của G chỉ có sau khi G merge; có thì phải chắc chắn không lọt ra file.
const HAS_PARENT_TOKEN =
  Prisma.dmmf.datamodel.models
    .find((m) => m.name === "Student")
    ?.fields.some((f) => f.name === "parentLinkToken") ?? false
const PARENT_TOKEN = "BKtoken_" + "x".repeat(35) // 43 ký tự, đúng dạng token G

const FOREIGN_TEXTS = ["Người Lạ GV2", "Môn Lạ GV2"]

async function loadBackup(userId: number): Promise<ExcelJS.Workbook> {
  const wb = await buildBackupWorkbook(db, userId, NOW)
  const buf = await wb.xlsx.writeBuffer()
  const loaded = new ExcelJS.Workbook()
  await loaded.xlsx.load(buf)
  return loaded
}

function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name)
  if (!ws) throw new Error(`Thiếu sheet ${name}`)
  return ws
}

function headersOf(ws: ExcelJS.Worksheet): unknown[] {
  return (ws.getRow(1).values as unknown[]).slice(1)
}

function cellOf(ws: ExcelJS.Worksheet, id: number, header: string): ExcelJS.Cell {
  const col = headersOf(ws).indexOf(header)
  if (col < 0) throw new Error(`Sheet ${ws.name} không có cột ${header}`)
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    if (row.getCell(1).value === id) return row.getCell(col + 1)
  }
  throw new Error(`Sheet ${ws.name} không có dòng ID ${id}`)
}

function infoValue(wb: ExcelJS.Workbook, label: string): ExcelJS.CellValue {
  const ws = sheet(wb, "Thông tin")
  for (let r = 2; r <= ws.rowCount; r++) {
    if (ws.getRow(r).getCell(1).value === label) return ws.getRow(r).getCell(2).value
  }
  throw new Error(`Sheet Thông tin không có mục ${label}`)
}

function allCellTexts(wb: ExcelJS.Workbook): string[] {
  const texts: string[] = []
  wb.eachSheet((ws) =>
    ws.eachRow((row) => row.eachCell((cell) => texts.push(String(cell.value))))
  )
  return texts
}

describe("buildBackupWorkbook", () => {
  let teacherId: number
  let passwordHash: string
  let anId: number
  let binhId: number
  let hiddenSubjectId: number

  beforeAll(async () => {
    const a = await getAuthedCaller("teacher")
    const b = await getAuthedCaller("teacher2")
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    teacherId = teacher.id
    passwordHash = teacher.passwordHash

    const an = await a.student.create({
      fullName: "An Sao Lưu", grade: 3, parentName: "Mẹ An",
      parentPhone: "0912345678", tuitionFee: 150000, notes: '=HYPERLINK("http://x")',
    })
    anId = an.id
    // 20:00 UTC = 03:00 sáng hôm sau giờ VN → bắt lỗi quên cộng 7 giờ.
    await db.student.update({ where: { id: anId }, data: { createdAt: new Date("2026-01-01T20:00:00Z") } })

    const binh = await a.student.create({ fullName: "Bình Sao Lưu", grade: 5 })
    binhId = binh.id
    await a.student.update({ id: binhId, data: { isActive: false } })

    const hidden = await a.subject.create({ name: "Lý Sao Lưu" })
    hiddenSubjectId = hidden.id
    await a.subject.update({ id: hiddenSubjectId, data: { isActive: false } })

    await b.student.create({ fullName: "Người Lạ GV2", grade: 4 })
    await b.subject.create({ name: "Môn Lạ GV2" })

    if (HAS_PARENT_TOKEN) {
      await db.$executeRaw`UPDATE "students" SET "parent_link_token" = ${PARENT_TOKEN} WHERE "id" = ${anId}`
    }
  })

  it("đủ sheet đúng thứ tự, dòng 1 đúng tiêu đề", async () => {
    const wb = await loadBackup(teacherId)
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Thông tin", ...DATA_SHEETS])
    for (const ws of wb.worksheets) {
      expect(headersOf(ws), ws.name).toEqual(HEADERS[ws.name])
    }
  })

  it("số dòng mỗi sheet = số bản ghi của user, sheet Thông tin ghi đúng số đó", async () => {
    const wb = await loadBackup(teacherId)
    for (const name of DATA_SHEETS) {
      const expected = await COUNTERS[name](teacherId)
      expect(expected, name).toBeGreaterThan(0)
      expect(sheet(wb, name).actualRowCount - 1, name).toBe(expected)
      expect(infoValue(wb, `Số dòng: ${name}`), name).toBe(expected)
    }
  })

  it("không lọt dữ liệu user khác, passwordHash hay cột nhạy cảm", async () => {
    const texts = allCellTexts(await loadBackup(teacherId))
    for (const foreign of FOREIGN_TEXTS) {
      expect(texts.some((t) => t.includes(foreign)), foreign).toBe(false)
    }
    expect(texts.some((t) => t.includes(passwordHash))).toBe(false)
    const wb = await loadBackup(teacherId)
    for (const ws of wb.worksheets) {
      for (const h of headersOf(ws)) expect(String(h)).not.toMatch(/password|mật khẩu|token/i)
    }
  })

  it.runIf(HAS_PARENT_TOKEN)("không xuất Student.parentLinkToken (cột của G)", async () => {
    const texts = allCellTexts(await loadBackup(teacherId))
    expect(texts.some((t) => t.includes(PARENT_TOKEN))).toBe(false)
  })

  it("Học sinh: SĐT giữ số 0, tiền là số nguyên, Có/Không, ô rỗng, mốc thời gian giờ VN", async () => {
    const ws = sheet(await loadBackup(teacherId), "Học sinh")

    const phone = cellOf(ws, anId, "SĐT phụ huynh")
    expect(phone.value).toBe("0912345678")
    expect(phone.numFmt).toBe("@")

    const fee = cellOf(ws, anId, "Học phí/buổi")
    expect(fee.value).toBe(150000)
    expect(Number.isInteger(fee.value)).toBe(true)
    expect(fee.numFmt).toBe("#,##0")

    expect(cellOf(ws, anId, "Đang học").value).toBe("Có")
    expect(cellOf(ws, binhId, "Đang học").value).toBe("Không")

    // Chuỗi bắt đầu bằng "=" vẫn phải là chuỗi, không thành công thức.
    expect(cellOf(ws, anId, "Ghi chú").value).toBe('=HYPERLINK("http://x")')

    expect(cellOf(ws, binhId, "SĐT phụ huynh").value).toBeNull()
    expect(cellOf(ws, binhId, "Tên phụ huynh").value).toBeNull()
    expect(cellOf(ws, binhId, "Ghi chú").value).toBeNull()

    const created = cellOf(ws, anId, "Ngày tạo")
    expect(created.value).toBeInstanceOf(Date)
    expect((created.value as Date).toISOString()).toBe("2026-01-02T03:00:00.000Z")
    expect(created.numFmt).toBe("dd/mm/yyyy hh:mm")
  })

  it("Môn học: xuất cả môn đã ẩn, cột Mặc định / Đang dạy", async () => {
    const wb = await loadBackup(teacherId)
    const ws = sheet(wb, "Môn học")
    expect(cellOf(ws, hiddenSubjectId, "Đang dạy").value).toBe("Không")
    expect(cellOf(ws, hiddenSubjectId, "Mặc định").value).toBe("Không")
    const seeded = await db.subject.findFirstOrThrow({ where: { userId: teacherId, name: "Tiếng Anh" } })
    expect(cellOf(ws, seeded.id, "Mặc định").value).toBe("Có")
    expect(cellOf(ws, seeded.id, "Màu (hex)").value).toBe("#4F46E5")
  })

  it("Thông tin: tài khoản, họ tên, thời điểm xuất giờ VN", async () => {
    const wb = await loadBackup(teacherId)
    expect(infoValue(wb, "Tài khoản")).toBe("teacher")
    expect(infoValue(wb, "Họ tên")).toBe("Giáo viên Test")
    const at = infoValue(wb, "Thời điểm xuất")
    expect(at).toBeInstanceOf(Date)
    expect((at as Date).toISOString()).toBe("2026-09-25T21:30:00.000Z")
  })

  it("user chưa có dữ liệu: đủ sheet, chỉ có dòng tiêu đề", async () => {
    const empty = await db.user.create({ data: { username: "backup_empty", passwordHash: "x" } })
    const wb = await loadBackup(empty.id)
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Thông tin", ...DATA_SHEETS])
    for (const name of DATA_SHEETS) {
      expect(sheet(wb, name).actualRowCount, name).toBe(1)
      expect(infoValue(wb, `Số dòng: ${name}`), name).toBe(0)
    }
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/services/backup-filename.test.ts tests/integration/backup.test.ts`
Expected: FAIL, lỗi import `@/server/services/backup.service` (file chưa có).

- [ ] **Step 4: Viết service**

`src/server/services/backup.service.ts`:

```ts
import ExcelJS from "exceljs"
import type { PrismaClient } from "@prisma/client"

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const HEADER_BG = "FFE0E7FF"

type Kind = "text" | "phone" | "money" | "date" | "datetime"
type CellValue = string | number | Date | null | undefined

interface Column<T> {
  header: string
  width: number
  kind?: Kind
  value: (row: T) => CellValue
}

const NUM_FMT: Partial<Record<Kind, string>> = {
  phone: "@",
  money: "#,##0",
  date: "dd/mm/yyyy",
  datetime: "dd/mm/yyyy hh:mm",
}

const NOTE_READONLY = "File chỉ để lưu trữ và đối chiếu. Ứng dụng không nhập lại file này."
const NOTE_TUITION = "Học phí tháng là số đã lưu; tháng chưa mở trang Học phí có thể chưa có dòng."

// exceljs đổi Date sang số serial theo UTC → phải cộng 7 giờ thì ô mới hiện đúng giờ VN.
function vnTime(d: Date | null): Date | null {
  return d ? new Date(d.getTime() + VN_OFFSET_MS) : null
}

function yesNo(b: boolean): string {
  return b ? "Có" : "Không"
}

export function backupFileName(now: Date): string {
  const vn = new Date(now.getTime() + VN_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, "0")
  const date = `${vn.getUTCFullYear()}-${p(vn.getUTCMonth() + 1)}-${p(vn.getUTCDate())}`
  return `SaoLuu_${date}_${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}.xlsx`
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } }
  })
}

function addDataSheet<T>(wb: ExcelJS.Workbook, name: string, rows: T[], columns: Column<T>[]): number {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width }))
  styleHeader(ws)
  for (const r of rows) {
    const row = ws.addRow(columns.map((c) => c.value(r) ?? null))
    columns.forEach((c, i) => {
      const fmt = c.kind && NUM_FMT[c.kind]
      if (fmt) row.getCell(i + 1).numFmt = fmt
    })
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return rows.length
}

export async function buildBackupWorkbook(
  db: PrismaClient,
  userId: number,
  now: Date
): Promise<ExcelJS.Workbook> {
  // Mọi truy vấn đều liệt kê cột: thêm cột nhạy cảm vào schema sau này không tự lọt ra file.
  const [user, students, subjects] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, fullName: true },
    }),
    db.student.findMany({
      where: { userId },
      orderBy: [{ grade: "asc" }, { fullName: "asc" }, { id: "asc" }],
      select: {
        id: true, fullName: true, grade: true, parentName: true, parentPhone: true,
        tuitionFee: true, isActive: true, notes: true, createdAt: true, updatedAt: true,
      },
    }),
    db.subject.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true, name: true, color: true, isDefault: true, isActive: true,
        sortOrder: true, createdAt: true,
      },
    }),
  ])

  const wb = new ExcelJS.Workbook()
  // Tạo trước để "Thông tin" đứng đầu; nội dung điền sau khi biết số dòng từng sheet.
  const info = wb.addWorksheet("Thông tin", { views: [{ state: "frozen", ySplit: 1 }] })
  const counts: [string, number][] = []

  counts.push(["Học sinh", addDataSheet(wb, "Học sinh", students, [
    { header: "ID", width: 8, value: (s) => s.id },
    { header: "Họ tên", width: 26, value: (s) => s.fullName },
    { header: "Lớp", width: 6, value: (s) => s.grade },
    { header: "Tên phụ huynh", width: 22, value: (s) => s.parentName },
    { header: "SĐT phụ huynh", width: 15, kind: "phone", value: (s) => s.parentPhone },
    { header: "Học phí/buổi", width: 14, kind: "money", value: (s) => s.tuitionFee },
    { header: "Đang học", width: 10, value: (s) => yesNo(s.isActive) },
    { header: "Ghi chú", width: 30, value: (s) => s.notes },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (s) => vnTime(s.createdAt) },
    { header: "Cập nhật lần cuối", width: 17, kind: "datetime", value: (s) => vnTime(s.updatedAt) },
  ])])

  counts.push(["Môn học", addDataSheet(wb, "Môn học", subjects, [
    { header: "ID", width: 8, value: (s) => s.id },
    { header: "Tên môn", width: 22, value: (s) => s.name },
    { header: "Màu (hex)", width: 11, value: (s) => s.color },
    { header: "Mặc định", width: 10, value: (s) => yesNo(s.isDefault) },
    { header: "Đang dạy", width: 10, value: (s) => yesNo(s.isActive) },
    { header: "Thứ tự", width: 8, value: (s) => s.sortOrder },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (s) => vnTime(s.createdAt) },
  ])])

  info.columns = [{ header: "Mục", width: 32 }, { header: "Giá trị", width: 80 }]
  styleHeader(info)
  info.addRow(["Tài khoản", user.username])
  info.addRow(["Họ tên", user.fullName ?? null])
  info.addRow(["Thời điểm xuất", vnTime(now)]).getCell(2).numFmt = NUM_FMT.datetime!
  for (const [name, n] of counts) info.addRow([`Số dòng: ${name}`, n])
  info.addRow(["Lưu ý", NOTE_READONLY])
  info.addRow(["Lưu ý", NOTE_TUITION])

  return wb
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/services/backup-filename.test.ts tests/integration/backup.test.ts`
Expected: PASS toàn bộ. Test `parentLinkToken` hiện "skipped" nếu G chưa merge.

Nếu test `Ngày tạo` lệch 7 giờ, kiểm tra `vnTime` đã được gọi. Nếu `numFmt` đọc lại khác (vd `dd/mm/yyyy\ hh:mm`), in `created.numFmt` ra xem và báo lại. **Không sửa test cho khớp code.**

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 7: Commit**

```bash
git add src/server/services/backup.service.ts tests/unit/services/backup-filename.test.ts tests/integration/backup.test.ts
git commit -F - <<'EOF'
feat(backup): service dựng file sao lưu (Thông tin, Học sinh, Môn học)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
EOF
```

---

### Task 3: Service — sheet Ca dạy, Điểm danh, Học phí tháng, Lần thu, Lịch sử lên lớp

**Đọc trước:** spec F mục 6.3 (bảng truy vấn, bảng cột, nhãn giá trị), mục 8 (các gạch đầu dòng về ngày, nhãn). Spec B mục 8.1 và 11. File `src/server/services/backup.service.ts` và `tests/integration/backup.test.ts` (từ Task 2). `src/lib/constants.ts` (`ATTENDANCE_LABEL`), `src/lib/utils.ts` (`formatTime`, `formatDayOfWeek`), `src/lib/schemas/payment.ts` (`PAYMENT_METHODS`, của B). **Đối chiếu interface thật của B** (tên model `payment`, field, router `payment.create`, input) trước khi làm. Lệch với plan thì theo code thật và ghi lại trong báo cáo task.

**Files:**
- Modify: `src/server/services/backup.service.ts`
- Modify: `tests/integration/backup.test.ts`

**Interfaces:**
- Consumes: `addDataSheet`, `vnTime`, `yesNo`, `NUM_FMT` (Task 2). Model `Payment` của B (`id, monthlyTuitionId, amount, paidAt, method, note, createdAt, updatedAt, monthlyTuition`). `PAYMENT_METHODS` từ `@/lib/schemas/payment`. Router: `session.create({ sessionDate, startTime, endTime, subjectId, title?, studentIds? })`, `session.createMakeup({ id, sessionDate, startTime, endTime, cancelReason? })` → `{ makeup, cancelled }`, `attendance.update({ sessionId, attendances: [{ studentId, attendance }] })`, `payment.create({ studentId, year, month, amount, paidAt, method, note? })` (B).
- Produces: `buildBackupWorkbook` trả sheet theo thứ tự `["Thông tin", "Học sinh", "Môn học", "Ca dạy", "Điểm danh", "Học phí tháng", "Lần thu", "Lịch sử lên lớp"]`.

- [ ] **Step 1: Mở rộng test (RED)**

Trong `tests/integration/backup.test.ts`:

(a) Thay `DATA_SHEETS`:

```ts
const DATA_SHEETS = [
  "Học sinh", "Môn học", "Ca dạy", "Điểm danh", "Học phí tháng", "Lần thu", "Lịch sử lên lớp",
]
```

(b) Thêm vào object `HEADERS` (sau `"Môn học"`):

```ts
  "Ca dạy": [
    "ID", "Ngày", "Thứ", "Bắt đầu", "Kết thúc", "ID môn", "Môn", "Tiêu đề", "Trạng thái",
    "Lý do hủy", "Thời điểm hủy", "Bù cho ca (ID)", "Số học sinh", "Ghi chú", "Ngày tạo",
  ],
  "Điểm danh": [
    "ID", "ID ca", "Ngày ca", "ID học sinh", "Học sinh", "Lớp lúc học", "Điểm danh",
    "Học phí buổi", "Ghi chú",
  ],
  "Học phí tháng": [
    "ID", "ID học sinh", "Học sinh", "Năm", "Tháng", "Tổng buổi", "Buổi có mặt", "Nợ trước",
    "Học phí tháng", "Tổng phải đóng", "Đã trả", "Đã tất toán", "Ghi chú", "Cập nhật lần cuối",
  ],
  "Lần thu": [
    "ID", "ID học phí tháng", "ID học sinh", "Học sinh", "Năm", "Tháng", "Ngày thu", "Số tiền",
    "Hình thức", "Ghi chú", "Ngày tạo", "Cập nhật lần cuối",
  ],
  "Lịch sử lên lớp": ["ID", "Năm học", "Thời điểm chạy", "Cách chạy", "Số HS lên lớp", "Số HS cho nghỉ"],
```

(c) Thêm vào object `COUNTERS`:

```ts
  "Ca dạy": (userId) => db.teachingSession.count({ where: { userId } }),
  "Điểm danh": (userId) => db.sessionStudent.count({ where: { session: { userId } } }),
  "Học phí tháng": (userId) => db.monthlyTuition.count({ where: { student: { userId } } }),
  "Lần thu": (userId) => db.payment.count({ where: { monthlyTuition: { student: { userId } } } }),
  "Lịch sử lên lớp": (userId) => db.classUpgradeLog.count({ where: { userId } }),
```

(d) Thay `FOREIGN_TEXTS`:

```ts
const FOREIGN_TEXTS = ["Người Lạ GV2", "Môn Lạ GV2", "Ca Lạ GV2", "Tiền Lạ GV2"]
```

(e) Trong `describe`, thêm biến cạnh các biến sẵn có:

```ts
  let normalSessionId: number
  let cancelledSessionId: number
  let makeupSessionId: number
  let paymentId: number
```

(f) Trong `beforeAll`, sửa dòng `await b.student.create({ fullName: "Người Lạ GV2", grade: 4 })` thành `const stranger = await b.student.create({ fullName: "Người Lạ GV2", grade: 4, tuitionFee: 90000 })`. Sau đó thêm vào **cuối** `beforeAll` (sau khối `if (HAS_PARENT_TOKEN)`):

```ts
    const [english] = await a.subject.list({ isActive: true })
    const normal = await a.session.create({
      sessionDate: "2026-05-04", startTime: "17:00", endTime: "18:30",
      subjectId: english.id, title: "Lớp 3", studentIds: [anId],
    })
    normalSessionId = normal.id
    await a.attendance.update({ sessionId: normal.id, attendances: [{ studentId: anId, attendance: "present" }] })

    const orig = await a.session.create({
      sessionDate: "2026-05-05", startTime: "17:00", endTime: "18:30",
      subjectId: english.id, studentIds: [anId],
    })
    const { makeup } = await a.session.createMakeup({
      id: orig.id, sessionDate: "2026-05-07", startTime: "17:00", endTime: "18:30", cancelReason: "Nghỉ ốm",
    })
    cancelledSessionId = orig.id
    makeupSessionId = makeup.id

    await a.payment.create({
      studentId: anId, year: 2026, month: 5, amount: 150000,
      paidAt: "2026-05-10", method: "transfer", note: "CK tháng 5",
    })
    paymentId = (await db.payment.findFirstOrThrow({
      where: { monthlyTuition: { studentId: anId } }, select: { id: true },
    })).id

    await db.classUpgradeLog.create({
      data: { userId: teacherId, year: 2026, trigger: "manual", upgradedCount: 2, deactivatedCount: 1 },
    })

    const [english2] = await b.subject.list({ isActive: true })
    await b.session.create({
      sessionDate: "2026-05-04", startTime: "08:00", endTime: "09:00",
      subjectId: english2.id, title: "Ca Lạ GV2", studentIds: [stranger.id],
    })
    await b.payment.create({
      studentId: stranger.id, year: 2026, month: 5, amount: 90000,
      paidAt: "2026-05-11", method: "cash", note: "Tiền Lạ GV2",
    })
```

(g) Thêm các test mới vào cuối `describe` (trước dấu `})` đóng):

```ts
  it("Ca dạy: ngày là ô Date dd/mm/yyyy, giờ HH:mm, nhãn trạng thái, ca bù trỏ ca gốc", async () => {
    const ws = sheet(await loadBackup(teacherId), "Ca dạy")

    const day = cellOf(ws, normalSessionId, "Ngày")
    expect(day.value).toBeInstanceOf(Date)
    expect((day.value as Date).toISOString()).toBe("2026-05-04T00:00:00.000Z")
    expect(day.numFmt).toBe("dd/mm/yyyy")
    expect(cellOf(ws, normalSessionId, "Thứ").value).toBe("T2")
    expect(cellOf(ws, normalSessionId, "Bắt đầu").value).toBe("17:00")
    expect(cellOf(ws, normalSessionId, "Kết thúc").value).toBe("18:30")
    expect(cellOf(ws, normalSessionId, "Môn").value).toBe("Tiếng Anh")
    expect(cellOf(ws, normalSessionId, "Trạng thái").value).toBe("Đã lên lịch")
    expect(cellOf(ws, normalSessionId, "Số học sinh").value).toBe(1)
    expect(cellOf(ws, normalSessionId, "Bù cho ca (ID)").value).toBeNull()

    expect(cellOf(ws, cancelledSessionId, "Trạng thái").value).toBe("Đã hủy")
    expect(cellOf(ws, cancelledSessionId, "Lý do hủy").value).toBe("Nghỉ ốm")
    const cancelledAt = cellOf(ws, cancelledSessionId, "Thời điểm hủy")
    expect(cancelledAt.value).toBeInstanceOf(Date)
    expect(cancelledAt.numFmt).toBe("dd/mm/yyyy hh:mm")

    expect(cellOf(ws, makeupSessionId, "Bù cho ca (ID)").value).toBe(cancelledSessionId)
  })

  it("Điểm danh: nhãn Có mặt, học phí buổi là số nguyên, ngày ca là Date", async () => {
    const ws = sheet(await loadBackup(teacherId), "Điểm danh")
    const ss = await db.sessionStudent.findFirstOrThrow({ where: { sessionId: normalSessionId, studentId: anId } })
    expect(cellOf(ws, ss.id, "Điểm danh").value).toBe("Có mặt")
    expect(cellOf(ws, ss.id, "Học phí buổi").value).toBe(150000)
    expect(cellOf(ws, ss.id, "Học phí buổi").numFmt).toBe("#,##0")
    expect(cellOf(ws, ss.id, "Lớp lúc học").value).toBe(3)
    expect(cellOf(ws, ss.id, "Học sinh").value).toBe("An Sao Lưu")
    expect((cellOf(ws, ss.id, "Ngày ca").value as Date).toISOString()).toBe("2026-05-04T00:00:00.000Z")
  })

  it("Học phí tháng: xuất nguyên dạng đang lưu, tiền là số nguyên", async () => {
    const ws = sheet(await loadBackup(teacherId), "Học phí tháng")
    const mt = await db.monthlyTuition.findUniqueOrThrow({
      where: { studentId_year_month: { studentId: anId, year: 2026, month: 5 } },
    })
    expect(cellOf(ws, mt.id, "Đã trả").value).toBe(mt.paidAmount)
    expect(cellOf(ws, mt.id, "Tổng phải đóng").value).toBe(mt.totalAmountDue)
    expect(Number.isInteger(cellOf(ws, mt.id, "Tổng phải đóng").value)).toBe(true)
    expect(cellOf(ws, mt.id, "Đã tất toán").value).toBe(mt.isFullPaid ? "Có" : "Không")
  })

  it("Lần thu: nhãn Chuyển khoản, ngày thu Date, số tiền nguyên, năm/tháng từ học phí tháng", async () => {
    const ws = sheet(await loadBackup(teacherId), "Lần thu")
    expect(cellOf(ws, paymentId, "Hình thức").value).toBe("Chuyển khoản")
    expect(cellOf(ws, paymentId, "Số tiền").value).toBe(150000)
    const paidAt = cellOf(ws, paymentId, "Ngày thu")
    expect((paidAt.value as Date).toISOString()).toBe("2026-05-10T00:00:00.000Z")
    expect(paidAt.numFmt).toBe("dd/mm/yyyy")
    expect(cellOf(ws, paymentId, "ID học sinh").value).toBe(anId)
    expect(cellOf(ws, paymentId, "Năm").value).toBe(2026)
    expect(cellOf(ws, paymentId, "Tháng").value).toBe(5)
    expect(cellOf(ws, paymentId, "Ghi chú").value).toBe("CK tháng 5")
  })

  it("Lịch sử lên lớp: nhãn Thủ công, thời điểm chạy là mốc giờ VN", async () => {
    const ws = sheet(await loadBackup(teacherId), "Lịch sử lên lớp")
    const log = await db.classUpgradeLog.findFirstOrThrow({ where: { userId: teacherId } })
    expect(cellOf(ws, log.id, "Cách chạy").value).toBe("Thủ công")
    expect(cellOf(ws, log.id, "Năm học").value).toBe(2026)
    const at = cellOf(ws, log.id, "Thời điểm chạy")
    expect((at.value as Date).getTime()).toBe(log.executedAt.getTime() + 7 * 60 * 60 * 1000)
    expect(at.numFmt).toBe("dd/mm/yyyy hh:mm")
  })
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/backup.test.ts`
Expected: FAIL. Test thứ tự sheet thiếu 5 sheet mới; các test mới báo `Thiếu sheet ...`.

- [ ] **Step 3: Sửa service**

Trong `src/server/services/backup.service.ts`:

(a) Thêm import:

```ts
import { ATTENDANCE_LABEL } from "@/lib/constants"
import { formatDayOfWeek, formatTime } from "@/lib/utils"
import type { PAYMENT_METHODS } from "@/lib/schemas/payment"
```

(b) Thêm hằng nhãn, đặt dưới `NOTE_TUITION`:

```ts
const SESSION_STATUS_LABEL: Record<string, string> = { scheduled: "Đã lên lịch", cancelled: "Đã hủy" }
// Gắn kiểu theo PAYMENT_METHODS của B: B thêm hình thức mới thì tsc báo ở đây.
const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
}
const UPGRADE_TRIGGER_LABEL: Record<string, string> = { auto: "Tự động", manual: "Thủ công" }

function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value
}
```

(c) Thay toàn bộ khối `const [user, students, subjects] = await Promise.all([...])` bằng:

```ts
  const [user, students, subjects, sessions, attendances, tuitions, payments, upgradeLogs] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, fullName: true },
    }),
    db.student.findMany({
      where: { userId },
      orderBy: [{ grade: "asc" }, { fullName: "asc" }, { id: "asc" }],
      select: {
        id: true, fullName: true, grade: true, parentName: true, parentPhone: true,
        tuitionFee: true, isActive: true, notes: true, createdAt: true, updatedAt: true,
      },
    }),
    db.subject.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true, name: true, color: true, isDefault: true, isActive: true,
        sortOrder: true, createdAt: true,
      },
    }),
    db.teachingSession.findMany({
      where: { userId },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }, { id: "asc" }],
      select: {
        id: true, sessionDate: true, startTime: true, endTime: true, subjectId: true, title: true,
        status: true, cancelReason: true, cancelledAt: true, makeupOfId: true, notes: true, createdAt: true,
        subject: { select: { name: true } },
        _count: { select: { sessionStudents: true } },
      },
    }),
    db.sessionStudent.findMany({
      where: { session: { userId } },
      orderBy: [{ session: { sessionDate: "asc" } }, { session: { startTime: "asc" } }, { id: "asc" }],
      select: {
        id: true, sessionId: true, studentId: true, grade: true, attendance: true, fee: true, note: true,
        session: { select: { sessionDate: true } },
        student: { select: { fullName: true } },
      },
    }),
    db.monthlyTuition.findMany({
      where: { student: { userId } },
      orderBy: [{ year: "asc" }, { month: "asc" }, { studentId: "asc" }],
      select: {
        id: true, studentId: true, year: true, month: true, totalSessions: true, presentSessions: true,
        previousBalance: true, currentMonthFee: true, totalAmountDue: true, paidAmount: true,
        isFullPaid: true, notes: true, updatedAt: true,
        student: { select: { fullName: true } },
      },
    }),
    db.payment.findMany({
      where: { monthlyTuition: { student: { userId } } },
      orderBy: [{ paidAt: "asc" }, { id: "asc" }],
      select: {
        id: true, monthlyTuitionId: true, amount: true, paidAt: true, method: true, note: true,
        createdAt: true, updatedAt: true,
        monthlyTuition: {
          select: { studentId: true, year: true, month: true, student: { select: { fullName: true } } },
        },
      },
    }),
    db.classUpgradeLog.findMany({
      where: { userId },
      orderBy: { year: "asc" },
      select: {
        id: true, year: true, executedAt: true, trigger: true, upgradedCount: true, deactivatedCount: true,
      },
    }),
  ])
```

(d) Ngay sau lệnh `counts.push(["Môn học", addDataSheet(...)])`, thêm:

```ts
  counts.push(["Ca dạy", addDataSheet(wb, "Ca dạy", sessions, [
    { header: "ID", width: 8, value: (s) => s.id },
    // @db.Date đã là 00:00 UTC đúng ngày → không cộng 7 giờ.
    { header: "Ngày", width: 12, kind: "date", value: (s) => s.sessionDate },
    { header: "Thứ", width: 6, value: (s) => formatDayOfWeek(s.sessionDate) },
    { header: "Bắt đầu", width: 9, value: (s) => formatTime(s.startTime) },
    { header: "Kết thúc", width: 9, value: (s) => formatTime(s.endTime) },
    { header: "ID môn", width: 8, value: (s) => s.subjectId },
    { header: "Môn", width: 18, value: (s) => s.subject.name },
    { header: "Tiêu đề", width: 20, value: (s) => s.title },
    { header: "Trạng thái", width: 13, value: (s) => label(SESSION_STATUS_LABEL, s.status) },
    { header: "Lý do hủy", width: 22, value: (s) => s.cancelReason },
    { header: "Thời điểm hủy", width: 17, kind: "datetime", value: (s) => vnTime(s.cancelledAt) },
    { header: "Bù cho ca (ID)", width: 13, value: (s) => s.makeupOfId },
    { header: "Số học sinh", width: 11, value: (s) => s._count.sessionStudents },
    { header: "Ghi chú", width: 30, value: (s) => s.notes },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (s) => vnTime(s.createdAt) },
  ])])

  counts.push(["Điểm danh", addDataSheet(wb, "Điểm danh", attendances, [
    { header: "ID", width: 8, value: (a) => a.id },
    { header: "ID ca", width: 8, value: (a) => a.sessionId },
    { header: "Ngày ca", width: 12, kind: "date", value: (a) => a.session.sessionDate },
    { header: "ID học sinh", width: 11, value: (a) => a.studentId },
    { header: "Học sinh", width: 26, value: (a) => a.student.fullName },
    { header: "Lớp lúc học", width: 11, value: (a) => a.grade },
    { header: "Điểm danh", width: 15, value: (a) => label(ATTENDANCE_LABEL, a.attendance) },
    { header: "Học phí buổi", width: 13, kind: "money", value: (a) => a.fee },
    { header: "Ghi chú", width: 30, value: (a) => a.note },
  ])])

  counts.push(["Học phí tháng", addDataSheet(wb, "Học phí tháng", tuitions, [
    { header: "ID", width: 8, value: (t) => t.id },
    { header: "ID học sinh", width: 11, value: (t) => t.studentId },
    { header: "Học sinh", width: 26, value: (t) => t.student.fullName },
    { header: "Năm", width: 7, value: (t) => t.year },
    { header: "Tháng", width: 7, value: (t) => t.month },
    { header: "Tổng buổi", width: 10, value: (t) => t.totalSessions },
    { header: "Buổi có mặt", width: 11, value: (t) => t.presentSessions },
    { header: "Nợ trước", width: 13, kind: "money", value: (t) => t.previousBalance },
    { header: "Học phí tháng", width: 13, kind: "money", value: (t) => t.currentMonthFee },
    { header: "Tổng phải đóng", width: 14, kind: "money", value: (t) => t.totalAmountDue },
    { header: "Đã trả", width: 13, kind: "money", value: (t) => t.paidAmount },
    { header: "Đã tất toán", width: 11, value: (t) => yesNo(t.isFullPaid) },
    { header: "Ghi chú", width: 30, value: (t) => t.notes },
    { header: "Cập nhật lần cuối", width: 17, kind: "datetime", value: (t) => vnTime(t.updatedAt) },
  ])])

  counts.push(["Lần thu", addDataSheet(wb, "Lần thu", payments, [
    { header: "ID", width: 8, value: (p) => p.id },
    { header: "ID học phí tháng", width: 15, value: (p) => p.monthlyTuitionId },
    { header: "ID học sinh", width: 11, value: (p) => p.monthlyTuition.studentId },
    { header: "Học sinh", width: 26, value: (p) => p.monthlyTuition.student.fullName },
    { header: "Năm", width: 7, value: (p) => p.monthlyTuition.year },
    { header: "Tháng", width: 7, value: (p) => p.monthlyTuition.month },
    { header: "Ngày thu", width: 12, kind: "date", value: (p) => p.paidAt },
    { header: "Số tiền", width: 13, kind: "money", value: (p) => p.amount },
    { header: "Hình thức", width: 13, value: (p) => label(PAYMENT_METHOD_LABEL, p.method) },
    { header: "Ghi chú", width: 30, value: (p) => p.note },
    { header: "Ngày tạo", width: 17, kind: "datetime", value: (p) => vnTime(p.createdAt) },
    { header: "Cập nhật lần cuối", width: 17, kind: "datetime", value: (p) => vnTime(p.updatedAt) },
  ])])

  counts.push(["Lịch sử lên lớp", addDataSheet(wb, "Lịch sử lên lớp", upgradeLogs, [
    { header: "ID", width: 8, value: (l) => l.id },
    { header: "Năm học", width: 9, value: (l) => l.year },
    { header: "Thời điểm chạy", width: 17, kind: "datetime", value: (l) => vnTime(l.executedAt) },
    { header: "Cách chạy", width: 11, value: (l) => label(UPGRADE_TRIGGER_LABEL, l.trigger) },
    { header: "Số HS lên lớp", width: 13, value: (l) => l.upgradedCount },
    { header: "Số HS cho nghỉ", width: 14, value: (l) => l.deactivatedCount },
  ])])
```

Nếu tsc báo `label(PAYMENT_METHOD_LABEL, ...)` không nhận `Record<"cash" | "transfer", string>`, thì đổi chữ ký `label` thành `function label(map: Readonly<Record<string, string>>, value: string)`. Không bỏ kiểu `PAYMENT_METHOD_LABEL`.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/backup.test.ts tests/unit/services/backup-filename.test.ts`
Expected: PASS toàn bộ (test token G có thể "skipped").

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/backup.service.ts tests/integration/backup.test.ts
git commit -F - <<'EOF'
feat(backup): thêm sheet Ca dạy, Điểm danh, Học phí tháng, Lần thu, Lịch sử lên lớp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
EOF
```

---

### Task 4 (CÓ ĐIỀU KIỆN): Sheet "Cài đặt", chỉ làm khi C đã merge

**Điều kiện:** chạy `grep -n "bankBin" prisma/schema.prisma` và `grep -n "export function findBank" src/lib/vn-banks.ts`. **Nếu một trong hai lệnh không in gì thì BỎ QUA toàn bộ Task 4**, ghi "C chưa merge, bỏ qua sheet Cài đặt" vào báo cáo, rồi sang Task 5.

**Đọc trước:** spec F mục 6.5; spec C mục 6.4 (trang `/settings` hiển thị: ngân hàng, số tài khoản, tên chủ tài khoản), 7.2 (`findBank`), 8 (3 cột trên `User`). File `src/server/services/backup.service.ts`, `tests/integration/backup.test.ts`. **Đối chiếu code thật của C** (tên cột, `findBank(bin)` trả `{ bin, shortName, name } | undefined`, trang `/settings` hiện những field nào). Nếu trang Cài đặt lúc đó có thêm field khác (không nhạy cảm) thì thêm dòng tương ứng, và ghi lại trong báo cáo.

**Files:**
- Modify: `src/server/services/backup.service.ts`
- Modify: `tests/integration/backup.test.ts`

**Interfaces:**
- Consumes: `User.bankBin`, `User.bankAccountNumber`, `User.bankAccountName` (C); `findBank(bin: string)` từ `@/lib/vn-banks`; `styleHeader`, `NUM_FMT` (Task 2).
- Produces: sheet thứ 9 `"Cài đặt"` đặt sau `"Lịch sử lên lớp"`, dạng "Mục"/"Giá trị", 3 dòng: `Ngân hàng`, `Số tài khoản`, `Tên chủ tài khoản`.

- [ ] **Step 1: Test (RED)**

Trong `tests/integration/backup.test.ts`:

(a) Thêm vào `HEADERS`: `"Cài đặt": ["Mục", "Giá trị"],`

(b) Thay kỳ vọng thứ tự sheet ở **2 chỗ** (test "đủ sheet đúng thứ tự" và test "user chưa có dữ liệu"): đổi `["Thông tin", ...DATA_SHEETS]` thành `["Thông tin", ...DATA_SHEETS, "Cài đặt"]`.

(c) Thêm test cuối `describe`:

```ts
  it("Cài đặt: ngân hàng, số tài khoản giữ số 0, tên chủ tài khoản", async () => {
    await db.user.update({
      where: { id: teacherId },
      data: { bankBin: "970436", bankAccountNumber: "0011223344", bankAccountName: "NGUYEN VAN A" },
    })
    const ws = sheet(await loadBackup(teacherId), "Cài đặt")
    const rows = new Map<string, ExcelJS.Cell>()
    for (let r = 2; r <= ws.rowCount; r++) rows.set(String(ws.getRow(r).getCell(1).value), ws.getRow(r).getCell(2))
    expect(rows.get("Ngân hàng")?.value).toBe("Vietcombank")
    expect(rows.get("Số tài khoản")?.value).toBe("0011223344")
    expect(rows.get("Số tài khoản")?.numFmt).toBe("@")
    expect(rows.get("Tên chủ tài khoản")?.value).toBe("NGUYEN VAN A")
  })

  it("Cài đặt: chưa cài ngân hàng thì các ô giá trị để trống", async () => {
    const empty = await db.user.findUniqueOrThrow({ where: { username: "backup_empty" } })
    const ws = sheet(await loadBackup(empty.id), "Cài đặt")
    for (let r = 2; r <= ws.rowCount; r++) expect(ws.getRow(r).getCell(2).value).toBeNull()
  })
```
(Test thứ 2 dùng user `backup_empty` do test "user chưa có dữ liệu" tạo. Test đó nằm phía trên nên chạy trước, vì vitest chạy tuần tự trong file.) Nếu `shortName` của BIN `970436` trong `VN_BANKS` thật không phải `"Vietcombank"` thì sửa kỳ vọng theo `findBank("970436")!.shortName`.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/backup.test.ts`
Expected: FAIL (thiếu sheet "Cài đặt").

- [ ] **Step 3: Sửa service**

(a) Import: `import { findBank } from "@/lib/vn-banks"`

(b) Trong `Promise.all`, đổi `select` của `db.user.findUniqueOrThrow` thành:

```ts
      select: { username: true, fullName: true, bankBin: true, bankAccountNumber: true, bankAccountName: true },
```

(c) Ngay trước `return wb`, thêm:

```ts
  // Chỉ các field hiện trên trang Cài đặt; không bao giờ thêm mật khẩu/token vào đây.
  const settings = wb.addWorksheet("Cài đặt", { views: [{ state: "frozen", ySplit: 1 }] })
  settings.columns = [{ header: "Mục", width: 32 }, { header: "Giá trị", width: 40 }]
  styleHeader(settings)
  const bankName = user.bankBin ? (findBank(user.bankBin)?.shortName ?? user.bankBin) : null
  settings.addRow(["Ngân hàng", bankName])
  settings.addRow(["Số tài khoản", user.bankAccountNumber ?? null]).getCell(2).numFmt = NUM_FMT.phone!
  settings.addRow(["Tên chủ tài khoản", user.bankAccountName ?? null])
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/backup.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/backup.service.ts tests/integration/backup.test.ts
git commit -F - <<'EOF'
feat(backup): thêm sheet Cài đặt (tài khoản nhận học phí)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
EOF
```

---

### Task 5: Route Handler `GET /api/backup`

**Đọc trước:** spec F mục 3 (D1), 6.2, 8 (Unit: 401). Code `src/server/auth.ts` (export `auth`), `src/server/auth.config.ts` (callback `session` đặt `user.id = ""` khi token thiếu), `src/server/trpc/index.ts` (cách `createTRPCContext` lấy `userId`), `src/app/api/trpc/[trpc]/route.ts` (mẫu route), `middleware.ts` (matcher không loại trừ `/api/backup`).

**Files:**
- Create: `src/app/api/backup/route.ts`
- Create: `tests/integration/backup-route.test.ts`

**Interfaces:**
- Consumes: `auth(): Promise<Session | null>` từ `@/server/auth`; `db` từ `@/server/db`; `backupFileName(now)`, `buildBackupWorkbook(db, userId, now)` (Task 2–3).
- Produces: `GET /api/backup`. Kết quả: `200` kèm body `.xlsx`, header `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="SaoLuu_YYYY-MM-DD_HHmm.xlsx"`, `Cache-Control: no-store`. `401` khi không có phiên hoặc `user.id` rỗng. `500` khi lỗi (body rỗng). Task 6 dựa vào `Content-Type` và `Content-Disposition` này.

- [ ] **Step 1: Test (RED)**

`tests/integration/backup-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import ExcelJS from "exceljs"
import { db } from "@/server/db"

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))

import { auth } from "@/server/auth"
import { GET } from "@/app/api/backup/route"

// `auth` của NextAuth có nhiều overload, ép về dạng đơn giản để mock.
const authMock = auth as unknown as ReturnType<typeof vi.fn>

describe("GET /api/backup", () => {
  beforeEach(() => {
    authMock.mockReset()
  })

  it("không có phiên → 401", async () => {
    authMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("phiên có user.id rỗng → 401, không chạy với userId 0", async () => {
    authMock.mockResolvedValue({ user: { id: "" } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("đã đăng nhập → 200, đúng header, body là xlsx đọc được", async () => {
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    authMock.mockResolvedValue({ user: { id: String(teacher.id) } })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="SaoLuu_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx"$/
    )
    expect(res.headers.get("Cache-Control")).toBe("no-store")

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await res.arrayBuffer())
    expect(wb.getWorksheet("Học sinh")).toBeDefined()
    expect(wb.getWorksheet("Lần thu")).toBeDefined()
  })

  it("lỗi bất ngờ (user không tồn tại) → 500, không lộ chi tiết", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    authMock.mockResolvedValue({ user: { id: "999999999" } })
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.text()).toBe("")
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/backup-route.test.ts`
Expected: FAIL, lỗi import `@/app/api/backup/route` (file chưa có).

- [ ] **Step 3: Viết route**

`src/app/api/backup/route.ts`:

```ts
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { backupFileName, buildBackupWorkbook } from "@/server/services/backup.service"

export const dynamic = "force-dynamic"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// tRPC không trả được nhị phân nên dùng route riêng. Tự kiểm auth, không dựa vào middleware.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response(null, { status: 401 })

  try {
    const userId = Number(session.user.id)
    const now = new Date()
    const wb = await buildBackupWorkbook(db, userId, now)
    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${backupFileName(now)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[backup] Không tạo được file sao lưu", error)
    return new Response(null, { status: 500 })
  }
}
```

Nếu tsc báo kiểu `buffer` (exceljs `Buffer`) không gán được cho `BodyInit`, đổi thành `new Response(new Uint8Array(buffer as ArrayBuffer), { ... })`.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/backup-route.test.ts`
Expected: PASS 4 test.

- [ ] **Step 5: Typecheck + lint + build**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm exec next build`
Expected: không lỗi. Output build có dòng `ƒ /api/backup`.
Nếu build lỗi do bundle `exceljs` phía server (lỗi resolve module của exceljs), thêm `serverExternalPackages: ["exceljs"],` vào object `nextConfig` trong `next.config.mjs` rồi build lại, và ghi lại trong báo cáo. **Không dùng `pnpm build`.**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/backup/route.ts tests/integration/backup-route.test.ts
git commit -F - <<'EOF'
feat(backup): route GET /api/backup trả file .xlsx

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
EOF
```
(Nếu có sửa `next.config.mjs` thì `git add` cả file đó.)

---

### Task 6: Hook `useBackupDownload` + mục menu + i18n

**Đọc trước:** spec F mục 5 (lối vào, hành vi), 7 (i18n). Code `src/components/layout/AppHeader.tsx`, `src/components/providers/LanguageProvider.tsx` (`t: (key: keyof Translations) => string`, key lấy từ `vi.json`), `src/hooks/useExcelExport.ts` (cách dùng `saveAs`, `toast`), `tests/unit/hooks/useFilters.test.ts` (mẫu `renderHook` + `// @vitest-environment jsdom`).

**Files:**
- Create: `src/hooks/useBackupDownload.ts`
- Create: `tests/unit/hooks/useBackupDownload.test.ts`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Modify: `src/components/layout/AppHeader.tsx`

**Interfaces:**
- Consumes: `GET /api/backup` (Task 5): header `Content-Type` chứa `spreadsheetml`, `Content-Disposition: attachment; filename="..."`.
- Produces:
  - `filenameFromDisposition(header: string | null): string`, trả tên file hoặc `"SaoLuu.xlsx"`.
  - `useBackupDownload(): { download: () => void; isDownloading: boolean }`.
  - Key i18n mới: `backup_data`, `backup_preparing`, `backup_done`, `backup_error`.

- [ ] **Step 1: Thêm i18n**

Kiểm tra chưa có key trùng: `grep -n '"backup_' src/language/vi.json src/language/en.json`. Expected: không in gì.

Thêm vào **cuối** object trong `src/language/vi.json` (nhớ thêm dấu phẩy sau key đứng trước):

```json
  "backup_data": "Sao lưu dữ liệu",
  "backup_preparing": "Đang tạo file sao lưu…",
  "backup_done": "Đã tải file sao lưu",
  "backup_error": "Không tạo được file sao lưu. Thử lại sau."
```

Và vào cuối `src/language/en.json`:

```json
  "backup_data": "Back up data",
  "backup_preparing": "Preparing backup file…",
  "backup_done": "Backup file downloaded",
  "backup_error": "Could not create the backup file. Please try again."
```

Kiểm tra: `grep -c '":' src/language/vi.json src/language/en.json`. Expected: 2 số bằng nhau, và mỗi số tăng đúng 4 so với trước khi sửa (B/C có thể đã thêm key, nên đừng so với con số cố định).

- [ ] **Step 2: Viết unit test fail cho hook**

`tests/unit/hooks/useBackupDownload.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

vi.mock("file-saver", () => ({ saveAs: vi.fn() }))
vi.mock("sonner", () => ({ toast: { promise: vi.fn() } }))
vi.mock("@/components/providers/LanguageProvider", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { saveAs } from "file-saver"
import { toast } from "sonner"
import { filenameFromDisposition, useBackupDownload } from "@/hooks/useBackupDownload"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function xlsxResponse(): Response {
  // Body dạng chuỗi: Blob của jsdom không phải Blob của undici, Response sẽ đọc sai.
  return new Response("x", {
    status: 200,
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": 'attachment; filename="SaoLuu_2026-09-25_2130.xlsx"',
    },
  })
}

describe("filenameFromDisposition", () => {
  it("lấy tên trong filename=\"...\"", () => {
    expect(filenameFromDisposition('attachment; filename="SaoLuu_2026-09-25_2130.xlsx"')).toBe(
      "SaoLuu_2026-09-25_2130.xlsx"
    )
  })

  it("không có header hoặc sai dạng → SaoLuu.xlsx", () => {
    expect(filenameFromDisposition(null)).toBe("SaoLuu.xlsx")
    expect(filenameFromDisposition("attachment")).toBe("SaoLuu.xlsx")
  })
})

describe("useBackupDownload", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("tải xong → saveAs đúng tên file, toast.promise có 3 chuỗi i18n", async () => {
    fetchMock.mockResolvedValue(xlsxResponse())
    const { result } = renderHook(() => useBackupDownload())

    act(() => result.current.download())

    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith("/api/backup")
    expect(vi.mocked(saveAs).mock.calls[0][1]).toBe("SaoLuu_2026-09-25_2130.xlsx")
    expect(toast.promise).toHaveBeenCalledWith(expect.any(Promise), {
      loading: "backup_preparing",
      success: "backup_done",
      error: "backup_error",
    })
    await waitFor(() => expect(result.current.isDownloading).toBe(false))
  })

  it("bấm 2 lần liên tiếp → chỉ 1 request", async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    const { result } = renderHook(() => useBackupDownload())

    act(() => {
      result.current.download()
      result.current.download()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.isDownloading).toBe(true)

    await act(async () => resolve(xlsxResponse()))
    await waitFor(() => expect(result.current.isDownloading).toBe(false))
  })

  it("phiên hết hạn (bị chuyển về trang login, nhận HTML 200) → báo lỗi, không lưu file", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } })
    )
    const { result } = renderHook(() => useBackupDownload())

    act(() => result.current.download())

    const promise = vi.mocked(toast.promise).mock.calls[0][0] as Promise<unknown>
    await expect(promise).rejects.toThrow()
    expect(saveAs).not.toHaveBeenCalled()
  })

  it("server lỗi 500 → promise reject, không lưu file", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
    const { result } = renderHook(() => useBackupDownload())

    act(() => result.current.download())

    const promise = vi.mocked(toast.promise).mock.calls[0][0] as Promise<unknown>
    await expect(promise).rejects.toThrow()
    expect(saveAs).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/hooks/useBackupDownload.test.ts`
Expected: FAIL, lỗi import `@/hooks/useBackupDownload`.

- [ ] **Step 4: Viết hook**

`src/hooks/useBackupDownload.ts`:

```ts
import { useRef, useState } from "react"
import { saveAs } from "file-saver"
import { toast } from "sonner"
import { useTranslation } from "@/components/providers/LanguageProvider"

const FALLBACK_NAME = "SaoLuu.xlsx"

export function filenameFromDisposition(header: string | null): string {
  return header?.match(/filename="([^"]+)"/)?.[1] ?? FALLBACK_NAME
}

async function fetchBackup(): Promise<void> {
  const res = await fetch("/api/backup")
  // Phiên hết hạn thì middleware chuyển về /login → fetch nhận HTML 200, phải chặn.
  if (!res.ok || !res.headers.get("Content-Type")?.includes("spreadsheetml")) {
    throw new Error(`Sao lưu thất bại (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  saveAs(blob, filenameFromDisposition(res.headers.get("Content-Disposition")))
}

export function useBackupDownload() {
  const { t } = useTranslation()
  const [isDownloading, setIsDownloading] = useState(false)
  // State chỉ đổi sau lần render kế tiếp; ref chặn ngay lần bấm thứ 2.
  const busy = useRef(false)

  function download() {
    if (busy.current) return
    busy.current = true
    setIsDownloading(true)
    const task = fetchBackup().finally(() => {
      busy.current = false
      setIsDownloading(false)
    })
    toast.promise(task, {
      loading: t("backup_preparing"),
      success: t("backup_done"),
      error: t("backup_error"),
    })
  }

  return { download, isDownloading }
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/hooks/useBackupDownload.test.ts`
Expected: PASS 6 test. Nếu có cảnh báo "unhandled rejection" ở 2 test lỗi thì đó là do `toast.promise` bị mock nên không bắt lỗi. Test đã `await expect(promise).rejects`, nên cảnh báo không được xuất hiện. Nếu vẫn thấy cảnh báo thì báo lại, không tắt cảnh báo.

- [ ] **Step 6: Thêm mục menu vào `AppHeader.tsx`**

(a) Đổi dòng import icon:

```ts
import { BookOpen, DatabaseBackup, KeyRound, LogOut, Languages } from "lucide-react"
```

(b) Thêm import hook, dưới import `useTranslation`:

```ts
import { useBackupDownload } from "@/hooks/useBackupDownload"
```

(c) Trong `AppHeader()`, ngay dưới dòng `const { t, language, setLanguage } = useTranslation()`:

```ts
  const backup = useBackupDownload()
```

(d) Ngay sau khối `<DropdownMenuItem asChild><Link href="/subjects">…</Link></DropdownMenuItem>` và **trước** `<ChangePasswordDialog`, thêm:

```tsx
            <DropdownMenuItem onSelect={backup.download} disabled={backup.isDownloading}>
              <DatabaseBackup className="size-4 mr-2" />
              {t("backup_data")}
            </DropdownMenuItem>
```

- [ ] **Step 7: Typecheck + lint + unit liên quan**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit/hooks`
Expected: không lỗi, unit pass.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useBackupDownload.ts tests/unit/hooks/useBackupDownload.test.ts src/language/vi.json src/language/en.json src/components/layout/AppHeader.tsx
git commit -F - <<'EOF'
feat(backup): mục Sao lưu dữ liệu trong menu avatar, tải file qua toast

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
EOF
```

---

### Task 7: E2E + kiểm chứng toàn bộ

**Đọc trước:** spec F mục 8 (E2E, Chung), 9 (iOS Safari). `playwright.config.ts` (nạp `./tests/env-setup` để webServer dùng DB test), `tests/e2e/subjects.spec.ts` (mẫu đăng nhập, ẩn badge dev, menu avatar ở 390px). Global Constraints phần E2E.

**Files:**
- Create: `tests/e2e/backup.spec.ts`
- Create (không commit, git-ignored): `.superpowers/pw-3100.config.ts`

**Interfaces:**
- Consumes: mục menu `t("backup_data")` = "Sao lưu dữ liệu", toast `t("backup_done")` = "Đã tải file sao lưu" (Task 6); `GET /api/backup` (Task 5). Nút mở menu tài khoản có `aria-label` = `t("account_menu")` = "Mở menu tài khoản".
- Produces: không.

- [ ] **Step 1: Viết e2e**

`tests/e2e/backup.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Sao lưu dữ liệu (390px)', () => {
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

  test('menu avatar → Sao lưu dữ liệu → tải file .xlsx đủ sheet', async ({ page }) => {
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Sao lưu dữ liệu' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^SaoLuu_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);

    const filePath = await download.path();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    expect(wb.getWorksheet('Học sinh')).toBeDefined();
    expect(wb.getWorksheet('Lần thu')).toBeDefined();

    await expect(page.getByText('Đã tải file sao lưu')).toBeVisible();
  });
});
```

- [ ] **Step 2: Tạo config tạm cổng 3100 (không commit)**

Kiểm tra `.superpowers/` đã bị git ignore: `git check-ignore -v .superpowers/pw-3100.config.ts`. Expected: in ra 1 dòng rule. Nếu không in gì thì DỪNG, không tạo file trong repo mà hỏi người điều phối.

Kiểm tra cổng 3100 đang trống hoặc đang là server test của chính nhánh này, **không phải** server dùng `.env`: PowerShell `Get-NetTCPConnection -LocalPort 3100 -ErrorAction SilentlyContinue`. Nếu có tiến trình lạ đang giữ cổng → DỪNG và hỏi, không tắt tiến trình đó.

`.superpowers/pw-3100.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// Cổng 3000 có thể bị project khác chiếm. playwright.config đã nạp .env.test vào process.env.
export default defineConfig({
  ...base,
  testDir: '../tests/e2e',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    command: 'pnpm exec next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      DIRECT_URL: process.env.DIRECT_URL ?? '',
      NODE_ENV: 'development',
    },
    reuseExistingServer: true,
    timeout: 120000,
  },
});
```

- [ ] **Step 3: Chạy e2e mới**

Trước đó chạy `pnpm test tests/integration/health.test.ts` để reset và seed lại DB test (có user `teacher`/`teacher123`). Rồi chạy:
`pnpm exec playwright test tests/e2e/backup.spec.ts -c .superpowers/pw-3100.config.ts`
(Nếu cổng 3000 trống thì dùng thẳng `pnpm exec playwright test tests/e2e/backup.spec.ts`.)
Expected: 1 passed.

- [ ] **Step 4: Commit e2e**

```bash
git add tests/e2e/backup.spec.ts
git commit -F - <<'EOF'
test(e2e): sao lưu dữ liệu trên mobile, tải và đọc lại file .xlsx

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
EOF
```

- [ ] **Step 5: Kiểm tra toàn bộ (chạy tuần tự, không song song)**

Run lần lượt:
1. `pnpm lint`. Expected: sạch.
2. `pnpm exec tsc --noEmit`. Expected: sạch.
3. `pnpm test`. Expected: toàn bộ unit + integration pass (mất khoảng 10–15 phút).
4. `pnpm exec playwright test -c .superpowers/pw-3100.config.ts` (hoặc không có `-c` nếu cổng 3000 trống). Expected: toàn bộ pass (`upgrade-class` có thể skip như trước).
5. `pnpm exec next build`. Expected: build OK, có route `ƒ /api/backup`. **Không chạy `pnpm build`.**

Có lỗi thì sửa trong phạm vi F, commit riêng với message mô tả lỗi, rồi chạy lại từ bước lỗi.

- [ ] **Step 6: Bàn giao**

Không merge, không push. Báo lại cho người điều phối:
- Danh sách commit của nhánh `feat/f-backup-export`.
- Task 4 đã làm hay bỏ qua (C đã merge chưa); test token G chạy hay skip (G đã merge chưa).
- Mọi chỗ code thật của B/C/G lệch với plan và cách đã xử lý.
- Các bước kiểm tra tay còn lại cho người dùng (sau khi merge, trên production):
  1. Trên iPhone (Safari), mở menu avatar → "Sao lưu dữ liệu" → file tải về được (spec mục 9: iOS Safari với blob), mở bằng app Tệp / Excel / Google Sheets đọc được.
  2. Mở file: sheet "Thông tin" đứng đầu, thời điểm xuất đúng giờ VN, số dòng từng sheet khớp với dữ liệu thật; cột ngày hiện `dd/mm/yyyy`, lọc/sắp xếp theo ngày được; SĐT giữ số 0 đầu.
  3. Tìm trong file (Ctrl+F) không thấy mật khẩu hay link phụ huynh (`/p/...`).
  4. Thử 1 lần trên máy tính (desktop), menu avatar có mục mới giữa "Môn học" và "Đổi mật khẩu".
