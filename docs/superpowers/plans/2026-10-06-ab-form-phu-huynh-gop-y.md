# AB — Form Google cho phụ huynh + Hòm thư góp ý Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhập được file câu trả lời Google Form (đọc cột theo tên). Dialog nhập có nút tạo bản sao form mẫu. Thêm hòm thư góp ý 1–5 sao: mở từ menu avatar, tự hỏi 1 lần, admin xem ở `/admin/feedback`. Version `0.13.0`.

**Architecture:**
- Phần 1 không đụng server. `student-import.ts` có thêm `mapImportColumnsByName` + `remapImportCells`. `readImportWorkbook` dùng 2 hàm này khi file không khớp mẫu chuẩn, xếp lại các ô về đúng 7 cột rồi dùng chung `parseImportRows`.
- Phần 2: bảng `feedbacks` + cột `users.feedback_prompt_at`; service `feedback.service.ts`; router `feedback` (chỉ giáo viên) + `admin.feedbackList`.
- UI phần 2: `FeedbackDialog` (menu avatar), `FeedbackPrompt` (trên `/dashboard`), `AdminFeedback` (trang admin).

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11 + React Query v5 (`useInfiniteQuery`), Prisma 5.22 + PostgreSQL, exceljs, shadcn Dialog/DropdownMenu, lucide-react, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-ab-form-phu-huynh-gop-y-design.md`

## Global Constraints

**Nhánh, version, ID form**
- Nhánh `feat/ab-form-gop-y`, đã có commit spec từ `main` `ddd639a`. Version cuối `0.13.0`.
- **ID form mẫu:** Claude và chủ app đang tạo form. Gehihi dùng hằng giữ chỗ `GOOGLE_FORM_TEMPLATE_ID = "THAY_ID_FORM_MAU"`. Claude thay ID thật trước khi merge. Test không phụ thuộc giá trị ID.

**Migration và an toàn DB**
- **Migration chỉ thêm**: bảng `feedbacks` + cột null `users.feedback_prompt_at`.
- Tạo migration bằng `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name add_feedback`, đọc SQL, rồi áp lên DB test bằng `... pnpm exec prisma migrate deploy` (kiểm dòng `localhost:5433`).
- Không áp prod: Vercel tự `migrate deploy` khi build. Prisma đòi reset hoặc báo drift thì DỪNG, báo Claude.
- **Nếu người thực thi là Gehaha (OpenCode):** `opencode.json` cấm `prisma migrate`, nên Claude tạo sẵn schema + migration trên nhánh. Gehaha bắt đầu từ Step 2 của Task 3.
- Chỉ dùng `.env.test` (localhost:5433). Cấm `db:reset` / `migrate reset` / `db push` / `pnpm db:migrate:*` trên mọi DB. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.

**Chạy lệnh**
- Không `pnpm build` / `pnpm dev`. e2e: RAM ≥ 3000 MB, chạy foreground, chia 2 nửa, dọn tiến trình (LENH.md).
- vitest integration dùng chung 1 DB test: không chạy 2 lượt test cùng lúc.

**Mã hoá, quyền**
- **Không lọc/sắp DB theo trường mã hoá** (`Student.fullName`, `bankAccountNumber`…). Bảng `feedbacks` không có trường mã hoá.
- Admin xác định bằng `isAdminUsername` (`@/lib/admin`), env `ADMIN_USERNAMES`.

**Chữ và giao diện**
- Mọi chữ giao diện mới qua i18n `vi.json` + `en.json` cùng bộ key. Nội dung hướng dẫn chỉ tiếng Việt. Chuỗi mới không dùng gạch dài (—, –).
- Màu A3: `primary` (#0F766E), teal, slate, amber. **Không indigo/violet/purple.**
- Vùng chạm ≥ 44px trên mobile (`size-11` / `min-h-11` / `h-11 md:h-10`).
- `page.tsx` / `layout.tsx` không có định danh `params` / `searchParams` (kể cả trong comment), do `tests/unit/next15-contract.test.ts` canh.

**Commit**
- Commit của Gehihi: 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + `pnpm exec tsc --noEmit` + `pnpm lint` sạch → commit → ghi ledger `.superpowers/sdd/2026-10-06-ab-form-phu-huynh-gop-y/progress.md`.

## Review Focus

1. **Hộp tự hỏi góp ý chặn e2e cũ.** Tài khoản seed có thể đủ 7 ngày dùng app trong DB test lâu ngày. Cách chặn: `tests/setup.ts` đặt `feedbackPromptAt: new Date()` cho mọi tài khoản seed (cạnh `onboardingDismissedAt`). Test: Task 3 Step 6.
2. **Đọc theo tên làm hỏng file mẫu cũ.** File đúng mẫu app phải cho kết quả y như trước (kể cả 5/6/7 cột). Đọc theo tên chỉ chạy khi `parseImportHeader` báo không hợp lệ. Test: Task 1 "mẫu chuẩn vẫn đi đường cũ".
3. **File Google có thêm cột (ví dụ câu "Trường") hoặc cột bị đổi thứ tự** phải nhận đúng. Cột lạ chen giữa không được lọt vào Ghi chú. Test: Task 1.
4. **Gửi góp ý dồn dập.** Lần thứ 6 trong 24 giờ bị TOO_MANY_REQUESTS và giao diện báo đúng câu. Test: Task 3 integration + Task 4 component.
5. **Hai hộp chồng nhau:** "Có gì mới" chưa xem thì không tự hỏi góp ý trong lượt tải đó, kể cả khi vừa đóng "Có gì mới". Test: Task 4 "không bật khi có Có gì mới".

---

### Task 1: Đọc file theo tên cột (file Google Form)

**Files:**
- Modify: `src/lib/student-import.ts` (thêm `GOOGLE_FORM_TEMPLATE_ID`, `googleFormCopyUrl`, `mapImportColumnsByName`, `remapImportCells`)
- Modify: `src/lib/student-import-excel.ts` (`readImportWorkbook`, kiểu `ImportReadResult`)
- Test: `tests/unit/lib/student-import.test.ts`, `tests/unit/lib/student-import-excel.test.ts`

**Interfaces:**
- Produces:
  - `GOOGLE_FORM_TEMPLATE_ID: string`;
  - `googleFormCopyUrl(): string` (trả `https://docs.google.com/forms/d/${GOOGLE_FORM_TEMPLATE_ID}/copy`);
  - `type ImportColumnMap = Partial<Record<ImportField, number>>`;
  - `mapImportColumnsByName(cells: unknown[]): ImportColumnMap | null`;
  - `remapImportCells(cells: unknown[], map: ImportColumnMap): unknown[]`;
  - `ImportReadResult` nhánh ok thành `{ ok: true; rows: ParsedImportRow[]; missingFee: boolean }`.

- [ ] **Step 1: Test hàm thuần (đỏ)** — thêm vào cuối `tests/unit/lib/student-import.test.ts` (bổ sung import tương ứng):

```ts
describe("mapImportColumnsByName (spec AB §2.2)", () => {
  it("file Google: bỏ Dấu thời gian, nhận cột theo tên, bỏ dấu và hoa thường", () => {
    const map = mapImportColumnsByName(["Dấu thời gian", "Họ tên", "Lớp", "Tên phụ huynh", "SĐT phụ huynh", "Ghi chú"])
    expect(map).toEqual({ fullName: 1, grade: 2, parentName: 3, parentPhone: 4, notes: 5 })
  })
  it("tên khác được chấp nhận, Timestamp tiếng Anh, cột lạ bỏ qua, đổi thứ tự", () => {
    const map = mapImportColumnsByName(["Timestamp", "LỚP", "Trường", "ho va ten", "Số điện thoại phụ huynh"])
    expect(map).toEqual({ grade: 1, fullName: 3, parentPhone: 4 })
  })
  it("trùng tên lấy cột đầu; nhận cả Học phí/buổi, Cách thu, dấu * cuối", () => {
    const map = mapImportColumnsByName(["Họ tên*", "Họ tên", "Lớp*", "Học phí/buổi", "Cách thu"])
    expect(map).toEqual({ fullName: 0, grade: 2, tuitionFee: 3, billingMode: 4 })
  })
  it("thiếu Họ tên hoặc Lớp → null", () => {
    expect(mapImportColumnsByName(["Dấu thời gian", "Họ tên", "Tên phụ huynh"])).toBeNull()
    expect(mapImportColumnsByName(["Lớp", "Ghi chú"])).toBeNull()
    expect(mapImportColumnsByName([])).toBeNull()
  })
})

describe("remapImportCells", () => {
  it("xếp về đúng thứ tự 7 cột mẫu, cột thiếu là null", () => {
    const map = { fullName: 1, grade: 2, parentPhone: 4, notes: 5 }
    expect(remapImportCells(["t", "An", "5", "x", 912345678, "Yếu"], map)).toEqual(["An", "5", null, 912345678, null, null, "Yếu"])
  })
})

it("googleFormCopyUrl trỏ tới /copy của form mẫu", () => {
  expect(googleFormCopyUrl()).toBe(`https://docs.google.com/forms/d/${GOOGLE_FORM_TEMPLATE_ID}/copy`)
  expect(GOOGLE_FORM_TEMPLATE_ID.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Chạy** `pnpm test tests/unit/lib/student-import.test.ts`. Expected: FAIL (chưa export các hàm).

- [ ] **Step 3: Cài đặt** trong `src/lib/student-import.ts`, đặt ngay sau `isImportHeader`:

```ts
// Form Google mẫu (spec AB §2.1). Không phải bí mật; thầy cô bấm /copy để có bản riêng trong Drive.
export const GOOGLE_FORM_TEMPLATE_ID = "THAY_ID_FORM_MAU"

export function googleFormCopyUrl(): string {
  return `https://docs.google.com/forms/d/${GOOGLE_FORM_TEMPLATE_ID}/copy`
}

const NAME_ALIASES: Record<ImportField, string[]> = {
  fullName: ["ho ten", "ho ten hoc sinh", "ho va ten"],
  grade: ["lop"],
  parentName: ["ten phu huynh"],
  parentPhone: ["sdt phu huynh", "so dien thoai phu huynh"],
  tuitionFee: ["hoc phi", "hoc phi/buoi"],
  billingMode: ["cach thu"],
  notes: ["ghi chu"],
}

export type ImportColumnMap = Partial<Record<ImportField, number>>

// File Google Form / tự làm: tìm cột theo tên, cột lạ bỏ qua, trùng tên lấy cột đầu.
export function mapImportColumnsByName(cells: unknown[]): ImportColumnMap | null {
  const map: ImportColumnMap = {}
  cells.forEach((cell, i) => {
    const label = stripDiacritics(cellToText(cell)).replace(/\s*\*$/, "")
    for (const field of Object.keys(NAME_ALIASES) as ImportField[]) {
      if (map[field] === undefined && NAME_ALIASES[field].includes(label)) map[field] = i
    }
  })
  return map.fullName !== undefined && map.grade !== undefined ? map : null
}

// Xếp về đúng thứ tự 7 cột của mẫu để dùng chung parseImportRows.
export function remapImportCells(cells: unknown[], map: ImportColumnMap): unknown[] {
  return IMPORT_COLUMNS.map((c) => {
    const i = map[c.field]
    return i === undefined ? null : cells[i]
  })
}
```

- [ ] **Step 4: Chạy** `pnpm test tests/unit/lib/student-import.test.ts`. Expected: PASS.

- [ ] **Step 5: Test đọc workbook (đỏ)** — thêm vào `tests/unit/lib/student-import-excel.test.ts`:

```ts
describe("readImportWorkbook — file Google Form (spec AB)", () => {
  it("có Dấu thời gian + cột lạ chen giữa: đọc đúng, học phí 0, theo buổi, missingFee=true", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = ["Dấu thời gian", "Họ tên", "Lớp", "Trường", "Tên phụ huynh", "SĐT phụ huynh", "Ghi chú"]
      s.getRow(2).values = ["06/10/2026 9:00:00", "Nguyễn An", "5", "TH Kim Đồng", "Chị Hoa", 912345678, "Yếu toán"]
      s.getRow(3).values = ["06/10/2026 9:05:00", "Trần Bình", "Lớp 3"]
    })
    const res = await readImportWorkbook(data)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.missingFee).toBe(true)
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0].errors).toEqual([])
    expect(res.rows[0].input).toMatchObject({ fullName: "Nguyễn An", grade: 5, parentName: "Chị Hoa", parentPhone: "0912345678", tuitionFee: 0, billingMode: "per_session", notes: "Yếu toán" })
    expect(res.rows[1].input).toMatchObject({ fullName: "Trần Bình", grade: 3 })
  })

  it("đã xoá cột Dấu thời gian (không khớp mẫu vì cột 5 là Ghi chú) vẫn đọc theo tên", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = ["Họ tên", "Lớp", "Tên phụ huynh", "SĐT phụ huynh", "Ghi chú"]
      s.getRow(2).values = ["Lê Chi", 7, "", "0987654321", "Học tối"]
    })
    const res = await readImportWorkbook(data)
    expect(res.ok && res.rows[0].input).toMatchObject({ fullName: "Lê Chi", grade: 7, parentPhone: "0987654321", notes: "Học tối" })
  })

  it("thiếu cột Lớp → template", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = ["Dấu thời gian", "Họ tên", "SĐT phụ huynh"]
      s.getRow(2).values = ["x", "An", "0912345678"]
    })
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "template" })
  })

  it("mẫu chuẩn vẫn đi đường cũ, missingFee=false", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = HEADER
      s.getRow(2).values = ["Nguyễn An", 5, "", "", 150000, "tháng", ""]
    })
    const res = await readImportWorkbook(data)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.missingFee).toBe(false)
    expect(res.rows[0].input).toMatchObject({ billingMode: "monthly", monthlyFee: 150000 })
  })
})
```

- [ ] **Step 6: Chạy** `pnpm test tests/unit/lib/student-import-excel.test.ts`. Expected: FAIL (`missingFee` undefined, Google file → template).

- [ ] **Step 7: Cài đặt** trong `src/lib/student-import-excel.ts`:

```ts
export type ImportReadResult =
  | { ok: true; rows: ParsedImportRow[]; missingFee: boolean }
  | { ok: false; error: ImportReadError }
```

Thay đoạn từ `const readCells` tới `return { ok: true, rows }` trong `readImportWorkbook` bằng:

```ts
  // File Google có thể nhiều hơn 7 cột (Dấu thời gian, câu hỏi thầy cô tự thêm).
  const width = Math.max(sheet.columnCount, IMPORT_COLUMNS.length)
  const readCells = (row: Row) => Array.from({ length: width }, (_, i) => row.getCell(i + 1).value)
  const header = readCells(sheet.getRow(1))
  const headerLayout = parseImportHeader(header)
  const byName = headerLayout.valid ? null : mapImportColumnsByName(header)
  if (!headerLayout.valid && !byName) return { ok: false, error: "template" }

  const raw: { rowNumber: number; cells: unknown[] }[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return
    const cells = readCells(row)
    raw.push({ rowNumber, cells: byName ? remapImportCells(cells, byName) : cells.slice(0, IMPORT_COLUMNS.length) })
  })
  const rows = parseImportRows(raw, { hasBillingColumn: byName ? true : headerLayout.hasBillingColumn })
  if (rows.length === 0) return { ok: false, error: "empty" }
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: "too_many" }
  return { ok: true, rows, missingFee: byName !== null && byName.tuitionFee === undefined }
```

Thêm `mapImportColumnsByName`, `remapImportCells`, `IMPORT_COLUMNS` (nếu chưa có) vào import từ `@/lib/student-import`.

- [ ] **Step 8: Chạy** `pnpm test tests/unit/lib/student-import-excel.test.ts tests/unit/lib/student-import.test.ts`. Expected: PASS.
  - Một test cũ mong `template` cho file **có đủ** cột Họ tên + Lớp (ví dụ cột đổi thứ tự) thì giờ đỏ: đổi kỳ vọng sang "đọc theo tên được". Đây là hành vi mới có chủ đích. Ghi `Ruling:` vào ledger, nêu tên test.
  - Test cũ mong `template` cho file **thiếu** Họ tên hoặc Lớp phải giữ nguyên.
  - Chỗ khác dùng `result.rows` không cần đổi.

- [ ] **Step 9: Commit**

```bash
git add src/lib/student-import.ts src/lib/student-import-excel.ts tests/unit/lib/student-import.test.ts tests/unit/lib/student-import-excel.test.ts
git commit -m "feat: nhap file Google Form doc cot theo ten"
```

---

### Task 2: Dialog nhập: khối Google Form + dòng nhắc học phí + hướng dẫn

**Files:**
- Modify: `src/components/students/ImportStudentsDialog.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Modify: `src/lib/guide-content.ts` (mục `nhap-excel`)
- Regenerate: `public/guide/huong-dan-su-dung.docx` (`pnpm guide:docx`)
- Test: `tests/unit/components/ImportStudentsDialog.test.tsx`, `tests/unit/lib/guide-content.test.ts`

**Interfaces:**
- Consumes: `googleFormCopyUrl()`, `ImportReadResult.missingFee` (Task 1).

- [ ] **Step 1: i18n.** Thêm vào `vi.json` và `en.json`, đặt cạnh nhóm `import_*`:

| key | vi | en |
|---|---|---|
| `import_form_title` | Chưa có danh sách? Nhờ phụ huynh điền | No list yet? Ask parents to fill in |
| `import_form_button` | Tạo Google Form | Create Google Form |
| `import_form_step1` | Bấm Tạo bản sao, rồi Gửi link form cho phụ huynh. | Click Make a copy, then Send the form link to parents. |
| `import_form_step2` | Đủ câu trả lời: vào tab Câu trả lời, chọn Liên kết với Trang tính, rồi Tệp → Tải xuống → Microsoft Excel (.xlsx). | When answers are in: open the Responses tab, choose Link to Sheets, then File → Download → Microsoft Excel (.xlsx). |
| `import_form_step3` | Chọn file đó bằng nút Chọn file ở trên. | Choose that file with the Choose file button above. |
| `import_form_guide` | Xem hướng dẫn chi tiết | See detailed guide |
| `import_missing_fee` | File không có học phí, học sinh sẽ có học phí 0đ. Sửa trong hồ sơ học sinh sau khi nhập. | The file has no fee column, students will get a 0đ fee. Edit it in each student's profile after importing. |

- [ ] **Step 2: Test component (đỏ)** — thêm vào `tests/unit/components/ImportStudentsDialog.test.tsx`. Dùng đúng cách render và mock trpc sẵn có của file. Mock `readImportWorkbook` theo cách file đang làm; file chưa mock thì dùng file thật tạo bằng exceljs như các test hiện có.

```tsx
it("có khối Google Form: link /copy mở tab mới, có chữ ẩn báo tab mới, link hướng dẫn", () => {
  renderDialog()
  const link = screen.getByRole("link", { name: /Tạo Google Form/ })
  expect(link.getAttribute("href")).toBe(googleFormCopyUrl())
  expect(link.getAttribute("target")).toBe("_blank")
  expect(link.getAttribute("rel")).toContain("noopener")
  expect(link.textContent).toContain("(mở tab mới)")
  expect(screen.getByRole("link", { name: /Xem hướng dẫn chi tiết/ }).getAttribute("href")).toBe("/guide#nhap-excel")
})

it("file không có cột học phí → xem trước hiện dòng nhắc học phí 0đ", async () => {
  // file Google: Dấu thời gian, Họ tên, Lớp, 1 dòng hợp lệ (dựng bằng helper sẵn có của file test)
  await chooseFile(googleFile)
  expect(await screen.findByText(/học sinh sẽ có học phí 0đ/)).toBeTruthy()
})

it("file mẫu chuẩn → không có dòng nhắc", async () => {
  await chooseFile(templateFile)
  await screen.findByTestId("import-summary")
  expect(screen.queryByText(/học sinh sẽ có học phí 0đ/)).toBeNull()
})
```

`renderDialog`, `chooseFile`, `googleFile`, `templateFile`: dùng helper/fixture sẵn có trong file test. Thiếu thì viết helper nhỏ ở đầu file, theo đúng kiểu test hiện tại: `fireEvent.change(screen.getByTestId("import-file-input"), { target: { files: [file] } })`.

- [ ] **Step 3: Chạy** `pnpm test tests/unit/components/ImportStudentsDialog.test.tsx`. Expected: FAIL.

- [ ] **Step 4: Cài đặt** trong `ImportStudentsDialog.tsx`:
  - Import thêm `ExternalLink` từ `lucide-react`, `Link` từ `next/link`, `googleFormCopyUrl` từ `@/lib/student-import`.
  - State `const [missingFee, setMissingFee] = useState(false)`. Trong `handleFile` sau khi đọc ok: `setMissingFee(result.missingFee)`.
  - Trong nhánh `preview === null`, ngay sau khối `readError`, thêm:

```tsx
<div data-testid="import-google-form" className="rounded-lg border bg-slate-50 p-3 text-sm">
  <p className="font-medium text-slate-900">{t("import_form_title")}</p>
  <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
    <li>{t("import_form_step1")}</li>
    <li>{t("import_form_step2")}</li>
    <li>{t("import_form_step3")}</li>
  </ol>
  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
    <Button asChild variant="outline" className="h-11 md:h-10">
      <a href={googleFormCopyUrl()} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 size-4" aria-hidden />
        {t("import_form_button")}
        <span className="sr-only"> {t("opens_new_tab")}</span>
      </a>
    </Button>
    <Link href="/guide#nhap-excel" target="_blank" className="inline-flex min-h-11 items-center text-primary underline-offset-2 hover:underline md:min-h-0">
      {t("import_form_guide")}
      <span className="sr-only"> {t("opens_new_tab")}</span>
    </Link>
  </div>
</div>
```

  - Trong nhánh xem trước, ngay dưới `<p data-testid="import-summary">`:

```tsx
{missingFee && (
  <p data-testid="import-missing-fee" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
    {t("import_missing_fee")}
  </p>
)}
```

  - Test tìm link hướng dẫn bằng `name: /Xem hướng dẫn chi tiết/` vẫn khớp, vì tên truy cập gồm cả phần sr-only.

- [ ] **Step 5: Chạy** `pnpm test tests/unit/components/ImportStudentsDialog.test.tsx`. Expected: PASS.

- [ ] **Step 6: Hướng dẫn.** Trong `src/lib/guide-content.ts` mục `nhap-excel`, thêm 3 bước **sau** bước "Sửa dòng lỗi…":

```ts
      "Chưa có danh sách: trong hộp **Nhập Excel** bấm **Tạo Google Form**. Google tạo bản sao form vào Drive của thầy cô (cần tài khoản Google), bấm **Gửi** để lấy link gửi phụ huynh.",
      "Đủ câu trả lời: mở tab **Câu trả lời**, chọn **Liên kết với Trang tính**, rồi **Tệp → Tải xuống → Microsoft Excel (.xlsx)**.",
      "Chọn file vừa tải ở hộp **Nhập Excel** như file mẫu. File từ form không có học phí: học sinh có học phí 0đ, sửa trong hồ sơ học sinh.",
```

  - Thêm vào `tests/unit/lib/guide-content.test.ts`, trong describe đầu:

```ts
  it("mục nhập Excel có cách dùng Google Form (spec AB)", () => {
    const text = JSON.stringify(GUIDE_SECTIONS.find((s) => s.id === "nhap-excel"))
    expect(text).toContain("**Tạo Google Form**")
    expect(text).toContain("Microsoft Excel (.xlsx)")
  })
```

  - Chạy `pnpm guide:docx` để dựng lại `public/guide/huong-dan-su-dung.docx`.

- [ ] **Step 7: Chạy** `pnpm test tests/unit/lib/guide-content.test.ts tests/unit/lib/guide-docx-file.test.ts tests/unit/components/ImportStudentsDialog.test.tsx`. Expected: PASS. `guide-docx-file` đỏ nghĩa là quên chạy `pnpm guide:docx`.

- [ ] **Step 8: Commit**

```bash
git add src/components/students/ImportStudentsDialog.tsx src/language/vi.json src/language/en.json src/lib/guide-content.ts public/guide/huong-dan-su-dung.docx tests/unit/components/ImportStudentsDialog.test.tsx tests/unit/lib/guide-content.test.ts
git commit -m "feat: hop nhap Excel co nut tao Google Form cho phu huynh"
```

---

### Task 3: Bảng góp ý + router `feedback` + `admin.feedbackList`

**Files:**
- Modify: `prisma/schema.prisma`; Create: `prisma/migrations/<ts>_add_feedback/migration.sql` (Prisma sinh)
- Create: `src/server/services/feedback.service.ts`, `src/server/trpc/routers/feedback.ts`
- Modify: `src/server/trpc/root.ts`, `src/server/trpc/routers/admin.ts`, `tests/setup.ts`
- Test: `tests/integration/feedback.test.ts`

**Interfaces:**
- Produces:
  - `feedback.submit({ rating: number; message?: string; page: string }) → { ok: true }`
  - `feedback.promptStatus() → { shouldPrompt: boolean }`
  - `feedback.dismissPrompt() → { ok: true }`
  - `admin.feedbackList({ cursor?: number }) → FeedbackListResult`, trong đó:

```ts
type FeedbackListResult = {
  items: { id: number; rating: number; message: string | null; page: string; appVersion: string; createdAt: Date; username: string; fullName: string | null }[]
  nextCursor: number | null
  total: number
  average: number | null // 1 chữ số thập phân
  counts: Record<1 | 2 | 3 | 4 | 5, number>
}
```

  - Hằng: `FEEDBACK_DAILY_LIMIT = 5`, `FEEDBACK_PROMPT_MIN_DAYS = 7`, `FEEDBACK_PAGE_SIZE = 50`, `FEEDBACK_MESSAGE_MAX = 1000`.

- [ ] **Step 1: Schema + migration.** Trong `prisma/schema.prisma`:
  - Thêm vào `User` (dưới `onboardingDismissedAt`):

```prisma
  // Đã tự hỏi góp ý (gửi hay đóng đều tính); khác null thì không tự hỏi nữa (spec AB §3.1).
  feedbackPromptAt      DateTime? @map("feedback_prompt_at")
```

  - Thêm `feedbacks Feedback[]` vào danh sách quan hệ của `User`.
  - Thêm model mới ở cuối file:

```prisma
// Góp ý của giáo viên (spec AB). CASCADE để tests/setup.ts xoá users không vỡ.
model Feedback {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  rating     Int
  message    String?  @db.VarChar(1000)
  page       String   @db.VarChar(100)
  appVersion String   @map("app_version") @db.VarChar(20)
  createdAt  DateTime @default(now()) @map("created_at")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([userId, createdAt])
  @@map("feedbacks")
}
```

  - Tạo migration theo Global Constraints. SQL phải chỉ có `ALTER TABLE "users" ADD COLUMN "feedback_prompt_at"`, `CREATE TABLE "feedbacks"`, 2 `CREATE INDEX`, 1 `ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE CASCADE`. Không có DROP/RENAME.
  - Áp lên DB test bằng `migrate deploy`, rồi chạy `pnpm exec prisma generate`.

- [ ] **Step 2: Test integration (đỏ)** — tạo `tests/integration/feedback.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import pkg from "../../package.json"

const SEED = ["teacher", "teacher2", "admin_test"]

async function clean() {
  await db.feedback.deleteMany()
  await db.userActivityDay.deleteMany({ where: { user: { username: { in: SEED } } } })
  await db.user.updateMany({ where: { username: { in: SEED } }, data: { feedbackPromptAt: null } })
}

async function addActiveDays(username: string, n: number) {
  const u = await db.user.findUniqueOrThrow({ where: { username } })
  await db.userActivityDay.createMany({
    data: Array.from({ length: n }, (_, i) => ({ userId: u.id, day: new Date(Date.UTC(2026, 0, i + 1)), firstSeenAt: new Date() })),
  })
}

describe("feedback (spec AB §3.2)", () => {
  beforeEach(async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    await clean()
  })
  afterEach(async () => {
    delete process.env.ADMIN_USERNAMES
    await clean()
    // Trả lại như tests/setup.ts để e2e không bị hộp tự hỏi.
    await db.user.updateMany({ where: { username: { in: SEED } }, data: { feedbackPromptAt: new Date() } })
  })

  it("submit lưu đúng, trim, message rỗng → null, bản lấy từ server, đặt feedbackPromptAt", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.feedback.submit({ rating: 4, message: "  Thêm xuất PDF  ", page: "/students" })
    await caller.feedback.submit({ rating: 5, message: "   ", page: "/dashboard" })
    const rows = await db.feedback.findMany({ orderBy: { id: "asc" } })
    expect(rows.map((r) => [r.rating, r.message, r.page])).toEqual([[4, "Thêm xuất PDF", "/students"], [5, null, "/dashboard"]])
    expect(rows[0].appVersion).toBe(pkg.version)
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(u.feedbackPromptAt).not.toBeNull()
  })

  it("rating 0, 6, 1.5 và message > 1000 bị BAD_REQUEST", async () => {
    const caller = await getAuthedCaller("teacher")
    for (const rating of [0, 6, 1.5]) {
      await expect(caller.feedback.submit({ rating, page: "/" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    }
    await expect(caller.feedback.submit({ rating: 3, message: "a".repeat(1001), page: "/" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.feedback.count()).toBe(0)
  })

  it("admin bị FORBIDDEN ở cả 3 thủ tục", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.feedback.submit({ rating: 5, page: "/" })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.feedback.promptStatus()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.feedback.dismissPrompt()).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("lần thứ 6 trong 24 giờ bị TOO_MANY_REQUESTS; góp ý cũ hơn 24 giờ không tính", async () => {
    const caller = await getAuthedCaller("teacher")
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.feedback.create({ data: { userId: u.id, rating: 3, page: "/", appVersion: "0", createdAt: new Date(Date.now() - 25 * 3600_000) } })
    for (let i = 0; i < 5; i++) await caller.feedback.submit({ rating: 5, page: "/" })
    await expect(caller.feedback.submit({ rating: 5, page: "/" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" })
    // Giới hạn tính theo từng tài khoản.
    await (await getAuthedCaller("teacher2")).feedback.submit({ rating: 5, page: "/" })
  })

  it("promptStatus: cần đủ 7 ngày dùng, chưa hỏi, chưa gửi", async () => {
    const caller = await getAuthedCaller("teacher")
    await addActiveDays("teacher", 6)
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: false })
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.userActivityDay.create({ data: { userId: u.id, day: new Date(Date.UTC(2026, 1, 1)), firstSeenAt: new Date() } })
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: true })

    await caller.feedback.dismissPrompt()
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: false })
  })

  it("đã gửi góp ý (dù feedbackPromptAt bị xoá) thì không hỏi", async () => {
    const caller = await getAuthedCaller("teacher")
    await addActiveDays("teacher", 7)
    await caller.feedback.submit({ rating: 2, page: "/" })
    await db.user.update({ where: { username: "teacher" }, data: { feedbackPromptAt: null } })
    expect(await caller.feedback.promptStatus()).toEqual({ shouldPrompt: false })
  })

  it("dismissPrompt chỉ ghi lần đầu", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.feedback.dismissPrompt()
    const first = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).feedbackPromptAt
    await new Promise((r) => setTimeout(r, 5))
    await caller.feedback.dismissPrompt()
    const second = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).feedbackPromptAt
    expect(second?.getTime()).toBe(first?.getTime())
  })

  it("admin.feedbackList: mới nhất trước, 50/trang, trung bình 1 chữ số, đếm sao; giáo viên bị FORBIDDEN", async () => {
    const t = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await db.feedback.createMany({
      data: Array.from({ length: 52 }, (_, i) => ({ userId: t.id, rating: (i % 5) + 1, message: `m${i}`, page: "/", appVersion: "0.13.0" })),
    })
    const admin = await getAuthedCaller("admin_test")
    const p1 = await admin.admin.feedbackList({})
    expect(p1.items).toHaveLength(50)
    expect(p1.items[0].message).toBe("m51")
    expect(p1.items[0]).toMatchObject({ username: "teacher" })
    expect(p1.total).toBe(52)
    expect(p1.counts).toEqual({ 1: 11, 2: 11, 3: 10, 4: 10, 5: 10 })
    expect(p1.average).toBe(2.9) // (11+22+30+40+50)/52 = 2.94 → 2.9
    expect(p1.nextCursor).not.toBeNull()
    const p2 = await admin.admin.feedbackList({ cursor: p1.nextCursor! })
    expect(p2.items.map((i) => i.message)).toEqual(["m1", "m0"])
    expect(p2.nextCursor).toBeNull()
    await expect((await getAuthedCaller("teacher")).admin.feedbackList({})).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("chưa có góp ý → average null, counts toàn 0", async () => {
    const res = await (await getAuthedCaller("admin_test")).admin.feedbackList({})
    expect(res).toMatchObject({ items: [], total: 0, average: null, nextCursor: null, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  })
})
```

  - Nếu file khác đã đặt `ADMIN_USERNAMES` theo cách riêng (xem `tests/integration/admin.test.ts`), làm theo đúng cách đó.

- [ ] **Step 3: Chạy** `pnpm test tests/integration/feedback.test.ts`. Expected: FAIL (`caller.feedback` undefined).

- [ ] **Step 4: Service** — tạo `src/server/services/feedback.service.ts`:

```ts
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import pkg from "../../../package.json"

export const FEEDBACK_DAILY_LIMIT = 5
export const FEEDBACK_PROMPT_MIN_DAYS = 7
export const FEEDBACK_PAGE_SIZE = 50
export const FEEDBACK_MESSAGE_MAX = 1000

export async function submitFeedback(
  db: PrismaClient,
  userId: number,
  input: { rating: number; message?: string; page: string }
) {
  const since = new Date(Date.now() - 24 * 3600_000)
  const recent = await db.feedback.count({ where: { userId, createdAt: { gte: since } } })
  if (recent >= FEEDBACK_DAILY_LIMIT) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "FEEDBACK_LIMIT" })
  await db.$transaction([
    // Bản app lấy ở server, không tin client.
    db.feedback.create({
      data: { userId, rating: input.rating, message: input.message?.trim() || null, page: input.page, appVersion: pkg.version },
    }),
    db.user.updateMany({ where: { id: userId, feedbackPromptAt: null }, data: { feedbackPromptAt: new Date() } }),
  ])
  return { ok: true as const }
}

export async function getFeedbackPromptStatus(db: PrismaClient, userId: number) {
  const [user, sent, days] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { feedbackPromptAt: true } }),
    db.feedback.count({ where: { userId } }),
    db.userActivityDay.count({ where: { userId } }),
  ])
  return { shouldPrompt: user.feedbackPromptAt === null && sent === 0 && days >= FEEDBACK_PROMPT_MIN_DAYS }
}

export async function dismissFeedbackPrompt(db: PrismaClient, userId: number) {
  await db.user.updateMany({ where: { id: userId, feedbackPromptAt: null }, data: { feedbackPromptAt: new Date() } })
  return { ok: true as const }
}

export async function listFeedback(db: PrismaClient, cursor?: number) {
  const [rows, total, groups] = await Promise.all([
    db.feedback.findMany({
      where: cursor ? { id: { lt: cursor } } : undefined,
      orderBy: { id: "desc" },
      take: FEEDBACK_PAGE_SIZE + 1,
      select: {
        id: true, rating: true, message: true, page: true, appVersion: true, createdAt: true,
        user: { select: { username: true, fullName: true } },
      },
    }),
    db.feedback.count(),
    db.feedback.groupBy({ by: ["rating"], _count: { _all: true } }),
  ])
  const page = rows.slice(0, FEEDBACK_PAGE_SIZE)
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
  let sum = 0
  for (const g of groups) {
    counts[g.rating as 1 | 2 | 3 | 4 | 5] = g._count._all
    sum += g.rating * g._count._all
  }
  return {
    items: page.map(({ user, ...f }) => ({ ...f, username: user.username, fullName: user.fullName })),
    nextCursor: rows.length > FEEDBACK_PAGE_SIZE ? page[page.length - 1].id : null,
    total,
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
    counts,
  }
}
```

- [ ] **Step 5: Router.**
  - Tạo `src/server/trpc/routers/feedback.ts`:

```ts
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { isAdminUsername } from "@/lib/admin"
import {
  FEEDBACK_MESSAGE_MAX,
  dismissFeedbackPrompt,
  getFeedbackPromptStatus,
  submitFeedback,
} from "@/server/services/feedback.service"

// Góp ý chỉ dành cho giáo viên; admin không dùng app như giáo viên.
const teacherProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (isAdminUsername(ctx.session.user.username)) throw new TRPCError({ code: "FORBIDDEN" })
  return next()
})

export const feedbackRouter = createTRPCRouter({
  submit: teacherProcedure
    .input(
      z.object({
        rating: z.number().int().min(1).max(5),
        message: z.string().max(FEEDBACK_MESSAGE_MAX).optional(),
        page: z.string().min(1).max(100),
      })
    )
    .mutation(({ ctx, input }) => submitFeedback(ctx.db, ctx.userId, input)),
  promptStatus: teacherProcedure.query(({ ctx }) => getFeedbackPromptStatus(ctx.db, ctx.userId)),
  dismissPrompt: teacherProcedure.mutation(({ ctx }) => dismissFeedbackPrompt(ctx.db, ctx.userId)),
})
```

  - `root.ts`: import và thêm `feedback: feedbackRouter`.
  - `admin.ts`: thêm `feedbackList: adminProcedure.input(z.object({ cursor: z.number().int().positive().optional() })).query(({ ctx, input }) => listFeedback(ctx.db, input.cursor)),` kèm import.

- [ ] **Step 6: `tests/setup.ts`.** Thêm `feedbackPromptAt: new Date(),` vào **mọi** chỗ đang có `onboardingDismissedAt: new Date(),` (4 tài khoản seed). Thêm `await db.feedback.deleteMany()` vào đầu chuỗi dọn của setup, hoặc dựa vào CASCADE khi xoá users nếu setup xoá users.

- [ ] **Step 7: Chạy** `pnpm test tests/integration/feedback.test.ts`. Expected: PASS (9 test). Tiếp theo chạy `pnpm test` toàn bộ. Expected: xanh hết.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/server/services/feedback.service.ts src/server/trpc/routers/feedback.ts src/server/trpc/root.ts src/server/trpc/routers/admin.ts tests/setup.ts tests/integration/feedback.test.ts
git commit -m "feat: bang gop y va router feedback"
```

---

### Task 4: Hộp góp ý: menu avatar + tự hỏi trên Tổng quan

**Files:**
- Create: `src/components/feedback/FeedbackDialog.tsx`, `src/components/feedback/FeedbackPrompt.tsx`
- Modify: `src/components/layout/AppHeader.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/FeedbackDialog.test.tsx`, `tests/unit/components/FeedbackPrompt.test.tsx`, `tests/unit/components/AppHeader.test.tsx`

**Interfaces:**
- Consumes: `feedback.submit`, `feedback.promptStatus`, `feedback.dismissPrompt` (Task 3); `release.status` + `hasUnseenRelease` (đã có).
- Produces:
  - `FeedbackDialog({ onClose: (sent: boolean) => void; prompted?: boolean })`. Parent chỉ mount khi mở, giống `ImportStudentsDialog`.
  - `FeedbackPrompt()`.

- [ ] **Step 1: i18n** (vi / en):

| key | vi | en |
|---|---|---|
| `feedback_menu` | Góp ý | Feedback |
| `feedback_title` | Góp ý cho app | Send feedback |
| `feedback_prompt_subtitle` | Thầy cô thấy app thế nào? | How do you like the app? |
| `feedback_rating_label` | Chấm điểm | Rating |
| `feedback_star` | {n} sao | {n} stars |
| `feedback_message_label` | Cần thêm gì, sửa gì? (không bắt buộc) | What should we add or fix? (optional) |
| `feedback_send` | Gửi | Send |
| `feedback_later` | Để sau | Later |
| `feedback_thanks` | Cảm ơn thầy cô đã góp ý! | Thanks for your feedback! |
| `feedback_limit` | Thầy cô đã gửi nhiều góp ý hôm nay, mai gửi tiếp nhé | You've sent a lot of feedback today, please try again tomorrow |

- [ ] **Step 2: Test `FeedbackDialog` (đỏ)** — tạo `tests/unit/components/FeedbackDialog.test.tsx`. Mock `@/lib/trpc` có `feedback.submit.useMutation` (bắt `opts` để gọi `onSuccess` / `onError`), mock `sonner`, mock `next/navigation` (`usePathname: () => "/students"`), polyfill `ResizeObserver` như `AppHeader.test.tsx`, bọc `LanguageProvider forcedLanguage="vi"`.

```tsx
it("chưa chọn sao thì Gửi bị tắt; chọn 4 sao rồi gửi đúng dữ liệu", () => {
  render(ui())
  const send = screen.getByRole("button", { name: "Gửi" })
  expect(send).toHaveProperty("disabled", true)
  fireEvent.click(screen.getByRole("radio", { name: "4 sao" }))
  fireEvent.change(screen.getByLabelText(/Cần thêm gì, sửa gì/), { target: { value: "Thêm báo cáo năm" } })
  fireEvent.click(send)
  expect(mutate).toHaveBeenCalledWith({ rating: 4, message: "Thêm báo cáo năm", page: "/students" })
})

it("bàn phím: mũi tên phải/trái đổi sao, chặn ở 1 và 5", () => {
  render(ui())
  const group = screen.getByRole("radiogroup", { name: "Chấm điểm" })
  fireEvent.click(screen.getByRole("radio", { name: "5 sao" }))
  fireEvent.keyDown(group, { key: "ArrowRight" })
  expect(screen.getByRole("radio", { name: "5 sao" }).getAttribute("aria-checked")).toBe("true")
  fireEvent.keyDown(group, { key: "ArrowLeft" })
  expect(screen.getByRole("radio", { name: "4 sao" }).getAttribute("aria-checked")).toBe("true")
})

it("đếm ký tự, tối đa 1000", () => {
  render(ui())
  const box = screen.getByLabelText(/Cần thêm gì, sửa gì/)
  expect(box.getAttribute("maxLength")).toBe("1000")
  fireEvent.change(box, { target: { value: "abc" } })
  expect(screen.getByText("3/1000")).toBeTruthy()
})

it("gửi xong: toast cảm ơn, onClose(true)", () => {
  render(ui())
  fireEvent.click(screen.getByRole("radio", { name: "3 sao" }))
  fireEvent.click(screen.getByRole("button", { name: "Gửi" }))
  mutationOpts.onSuccess()
  expect(toast.success).toHaveBeenCalledWith("Cảm ơn thầy cô đã góp ý!")
  expect(onClose).toHaveBeenCalledWith(true)
})

it("quá giới hạn: báo câu riêng, không đóng", () => {
  render(ui())
  mutationOpts.onError({ data: { code: "TOO_MANY_REQUESTS" }, message: "FEEDBACK_LIMIT" })
  expect(toast.error).toHaveBeenCalledWith("Thầy cô đã gửi nhiều góp ý hôm nay, mai gửi tiếp nhé")
  expect(onClose).not.toHaveBeenCalled()
})

it("prompted: có tiêu đề phụ và nút Để sau → onClose(false); không prompted thì không có Để sau", () => {
  const { unmount } = render(ui({ prompted: true }))
  expect(screen.getByText("Thầy cô thấy app thế nào?")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Để sau" }))
  expect(onClose).toHaveBeenCalledWith(false)
  unmount()
  render(ui())
  expect(screen.queryByRole("button", { name: "Để sau" })).toBeNull()
})
```

- [ ] **Step 3: Chạy** `pnpm test tests/unit/components/FeedbackDialog.test.tsx`. Expected: FAIL (không có module).

- [ ] **Step 4: Cài đặt** `src/components/feedback/FeedbackDialog.tsx`:

```tsx
"use client"

import { useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Loader2, Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

const MAX = 1000
const STARS = [1, 2, 3, 4, 5]

export function FeedbackDialog({ onClose, prompted = false }: { onClose: (sent: boolean) => void; prompted?: boolean }) {
  const { t } = useTranslation()
  const page = usePathname() ?? "/"
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState("")
  const starRefs = useRef<(HTMLButtonElement | null)[]>([])
  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success(t("feedback_thanks"))
      onClose(true)
    },
    onError: (e) => toast.error(e.data?.code === "TOO_MANY_REQUESTS" ? t("feedback_limit") : e.message),
  })

  const pick = (n: number) => {
    setRating(n)
    starRefs.current[n - 1]?.focus()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") pick(Math.min(5, Math.max(1, rating + 1)))
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") pick(Math.max(1, rating - 1))
    else return
    e.preventDefault()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("feedback_title")}</DialogTitle>
          {prompted ? <DialogDescription>{t("feedback_prompt_subtitle")}</DialogDescription> : <DialogDescription className="sr-only">{t("feedback_title")}</DialogDescription>}
        </DialogHeader>
        <div role="radiogroup" aria-label={t("feedback_rating_label")} onKeyDown={onKeyDown} className="flex justify-center gap-1">
          {STARS.map((n) => (
            <button
              key={n}
              ref={(el) => { starRefs.current[n - 1] = el }}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t("feedback_star").replace("{n}", String(n))}
              tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
              onClick={() => setRating(n)}
              className="flex size-11 items-center justify-center rounded-md hover:bg-slate-100"
            >
              <Star className={cn("size-7", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="feedback-message">{t("feedback_message_label")}</Label>
          <textarea
            id="feedback-message"
            value={message}
            maxLength={MAX}
            rows={4}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-right text-xs text-slate-500">{message.length}/{MAX}</p>
        </div>
        <DialogFooter className="gap-2">
          {prompted && (
            <Button variant="outline" onClick={() => onClose(false)} className="h-11 md:h-10">{t("feedback_later")}</Button>
          )}
          <Button
            onClick={() => submit.mutate({ rating, message, page })}
            disabled={rating === 0 || submit.isPending}
            className="h-11 md:h-10"
          >
            {submit.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("feedback_send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

  - Dự án đã có component `Textarea` (`@/components/ui/textarea`) thì dùng nó thay `<textarea>` thô.
  - `message` gửi nguyên văn, server tự trim. Riêng test mong `message: "Thêm báo cáo năm"` thì khớp nguyên văn.

- [ ] **Step 5: Chạy** `pnpm test tests/unit/components/FeedbackDialog.test.tsx`. Expected: PASS.

- [ ] **Step 6: Test `FeedbackPrompt` (đỏ)** — tạo `tests/unit/components/FeedbackPrompt.test.tsx`. Mock `@/lib/trpc` với biến điều khiển được `promptData`, `releaseData`, `dismiss`. Mock `@/components/feedback/FeedbackDialog` thành `({ onClose, prompted }) => <div data-testid="fb-dialog" data-prompted={String(prompted)}><button onClick={() => onClose(false)}>close</button><button onClick={() => onClose(true)}>sent</button></div>`.

```tsx
it("đủ điều kiện và Có gì mới đã xem → hiện hộp prompted", () => {
  promptData = { shouldPrompt: true }; releaseData = { lastSeenRelease: RELEASES[0].version }
  render(<FeedbackPrompt />)
  expect(screen.getByTestId("fb-dialog").getAttribute("data-prompted")).toBe("true")
})

it("Có gì mới chưa xem → không hiện, kể cả khi sau đó đã xem trong cùng lượt tải", () => {
  promptData = { shouldPrompt: true }; releaseData = { lastSeenRelease: null }
  const { rerender } = render(<FeedbackPrompt />)
  expect(screen.queryByTestId("fb-dialog")).toBeNull()
  releaseData = { lastSeenRelease: RELEASES[0].version }
  rerender(<FeedbackPrompt />)
  expect(screen.queryByTestId("fb-dialog")).toBeNull()
})

it("shouldPrompt=false hoặc đang tải → không hiện", () => {
  promptData = undefined; releaseData = { lastSeenRelease: RELEASES[0].version }
  const { rerender } = render(<FeedbackPrompt />)
  expect(screen.queryByTestId("fb-dialog")).toBeNull()
  promptData = { shouldPrompt: false }
  rerender(<FeedbackPrompt />)
  expect(screen.queryByTestId("fb-dialog")).toBeNull()
})

it("đóng không gửi → gọi dismissPrompt, hộp biến mất; gửi rồi thì không gọi", () => {
  promptData = { shouldPrompt: true }; releaseData = { lastSeenRelease: RELEASES[0].version }
  const { unmount } = render(<FeedbackPrompt />)
  fireEvent.click(screen.getByText("close"))
  expect(dismiss).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId("fb-dialog")).toBeNull()
  unmount(); dismiss.mockClear()
  render(<FeedbackPrompt />)
  fireEvent.click(screen.getByText("sent"))
  expect(dismiss).not.toHaveBeenCalled()
})
```

- [ ] **Step 7: Cài đặt** `src/components/feedback/FeedbackPrompt.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { trpc } from "@/lib/trpc"
import { hasUnseenRelease } from "@/lib/releases"
import { FeedbackDialog } from "./FeedbackDialog"

// Chốt 1 lần mỗi lượt tải: Có gì mới đang chờ thì bỏ qua cả lượt, tránh 2 hộp nối nhau (spec AB §3.3).
export function FeedbackPrompt() {
  const prompt = trpc.feedback.promptStatus.useQuery()
  const release = trpc.release.status.useQuery()
  const dismiss = trpc.feedback.dismissPrompt.useMutation()
  const [decision, setDecision] = useState<"wait" | "show" | "skip">("wait")

  useEffect(() => {
    if (decision !== "wait" || !prompt.data || !release.data) return
    setDecision(prompt.data.shouldPrompt && !hasUnseenRelease(release.data.lastSeenRelease) ? "show" : "skip")
  }, [decision, prompt.data, release.data])

  if (decision !== "show") return null
  return (
    <FeedbackDialog
      prompted
      onClose={(sent) => {
        setDecision("skip")
        if (!sent) dismiss.mutate()
      }}
    />
  )
}
```

  - Thêm `<FeedbackPrompt />` vào `src/app/(app)/dashboard/page.tsx` ngay sau `<StartCard />`, kèm import.
  - Test "shouldPrompt=false rồi đổi sang true": quyết định đã chốt `skip` thì không bật lại. Đây là hành vi đúng, không cần test thêm.

- [ ] **Step 8: Chạy** `pnpm test tests/unit/components/FeedbackPrompt.test.tsx`. Expected: PASS.

- [ ] **Step 9: Menu avatar (test đỏ trước).**
  - Trong `tests/unit/components/AppHeader.test.tsx`:
    - thêm vào mock trpc `feedback: { submit: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }`;
    - mock `next/navigation` (`usePathname: () => "/dashboard"`) nếu file chưa mock.
  - Thêm 2 test: (a) với giáo viên (`useSession` trả `username: "teacher"`, làm theo cách file đang đổi session giữa các test), mở menu avatar có mục "Góp ý", bấm vào thì có dialog tiêu đề "Góp ý cho app"; (b) với admin (`admin_test`, `variant="admin"`) thì không có mục "Góp ý".
  - Chạy cho đỏ, rồi cài đặt trong `AppHeader.tsx`:
    - import `MessageSquare` từ `lucide-react` và `FeedbackDialog`;
    - state `const [feedbackOpen, setFeedbackOpen] = useState(false)`;
    - trong nhánh giáo viên (sau mục Sao lưu, chuyển nhánh `admin ? ... : ...` thành fragment 2 mục):

```tsx
<>
  <DropdownMenuItem onSelect={() => setConfirmBackup(true)} disabled={backup.isDownloading}>
    <DatabaseBackup className="size-4 mr-2" />
    {t("backup_data")}
  </DropdownMenuItem>
  <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
    <MessageSquare className="size-4 mr-2" />
    {t("feedback_menu")}
  </DropdownMenuItem>
</>
```

    - cạnh `<BackupConfirmDialog …/>` thêm `{feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}`.

- [ ] **Step 10: Chạy** `pnpm test tests/unit/components/AppHeader.test.tsx tests/unit/components/FeedbackDialog.test.tsx tests/unit/components/FeedbackPrompt.test.tsx`. Expected: PASS. Nếu test dashboard nào render `DashboardPage` mà thiếu mock `feedback` thì thêm mock `FeedbackPrompt: () => null`.

- [ ] **Step 11: Commit**

```bash
git add src/components/feedback src/components/layout/AppHeader.tsx "src/app/(app)/dashboard/page.tsx" src/language/vi.json src/language/en.json tests/unit/components/FeedbackDialog.test.tsx tests/unit/components/FeedbackPrompt.test.tsx tests/unit/components/AppHeader.test.tsx
git commit -m "feat: hop gop y tu menu va tu hoi 1 lan tren Tong quan"
```

---

### Task 5: Trang admin `/admin/feedback`

**Files:**
- Create: `src/app/(admin)/admin/feedback/page.tsx`, `src/components/admin/AdminFeedback.tsx`
- Modify: `src/components/admin/admin-nav.ts`, `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/AdminFeedback.test.tsx`; kiểm các test đang đếm `ADMIN_NAV_ITEMS` (grep `ADMIN_NAV_ITEMS` trong `tests/`)

**Interfaces:**
- Consumes: `admin.feedbackList` (Task 3), `FeedbackListResult`.

- [ ] **Step 1: i18n** (vi / en):

| key | vi | en |
|---|---|---|
| `admin_feedback` | Góp ý | Feedback |
| `admin_tab_feedback` | Góp ý | Feedback |
| `admin_feedback_avg` | Điểm trung bình | Average rating |
| `admin_feedback_total` | {n} góp ý | {n} responses |
| `admin_feedback_empty` | Chưa có góp ý nào | No feedback yet |
| `admin_feedback_more` | Xem thêm | Load more |
| `admin_feedback_no_message` | (Không ghi nội dung) | (No message) |

- [ ] **Step 2: Test (đỏ)** — `tests/unit/components/AdminFeedback.test.tsx`. Mock `trpc.admin.feedbackList.useInfiniteQuery` trả về `{ data: { pages: [page1] }, isPending: false, isError: false, hasNextPage, fetchNextPage, isFetchingNextPage: false, refetch }`.

```tsx
const page1 = {
  items: [
    { id: 2, rating: 5, message: "Dòng 1\nDòng 2 <b>x</b>", page: "/students", appVersion: "0.13.0", createdAt: new Date("2026-10-06T03:00:00Z"), username: "co_lan", fullName: "Cô Lan" },
    { id: 1, rating: 2, message: null, page: "/tuition", appVersion: "0.13.0", createdAt: new Date("2026-10-05T03:00:00Z"), username: "thay_minh", fullName: null },
  ],
  nextCursor: 1, total: 2, average: 3.5, counts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 },
}

it("đầu trang: điểm trung bình, tổng, đếm từng mức sao", () => {
  render(ui())
  expect(screen.getByTestId("feedback-average").textContent).toContain("3,5")
  expect(screen.getByText("2 góp ý")).toBeTruthy()
  expect(screen.getByTestId("feedback-count-5").textContent).toContain("1")
  expect(screen.getByTestId("feedback-count-3").textContent).toContain("0")
})

it("mỗi góp ý: sao, nội dung giữ xuống dòng và không render HTML, tài khoản, trang, bản", () => {
  render(ui())
  const cards = screen.getAllByTestId("feedback-item")
  expect(cards).toHaveLength(2)
  expect(cards[0].querySelector("b")).toBeNull()
  expect(cards[0].textContent).toContain("<b>x</b>")
  expect(cards[0].querySelector(".whitespace-pre-line")).not.toBeNull()
  expect(cards[0].textContent).toContain("co_lan")
  expect(cards[0].textContent).toContain("/students")
  expect(cards[0].textContent).toContain("0.13.0")
  expect(cards[1].textContent).toContain("(Không ghi nội dung)")
  expect(screen.getAllByLabelText("5 sao").length).toBeGreaterThan(0)
})

it("Xem thêm gọi fetchNextPage; hết trang thì ẩn", () => {
  render(ui())
  fireEvent.click(screen.getByRole("button", { name: "Xem thêm" }))
  expect(fetchNextPage).toHaveBeenCalled()
  hasNextPage = false
  cleanup(); render(ui())
  expect(screen.queryByRole("button", { name: "Xem thêm" })).toBeNull()
})

it("chưa có góp ý → chữ trống, average hiện -", () => {
  pages = [{ items: [], nextCursor: null, total: 0, average: null, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }]
  render(ui())
  expect(screen.getByText("Chưa có góp ý nào")).toBeTruthy()
  expect(screen.getByTestId("feedback-average").textContent).toContain("-")
})
```

- [ ] **Step 3: Chạy** `pnpm test tests/unit/components/AdminFeedback.test.tsx`. Expected: FAIL.

- [ ] **Step 4: Cài đặt.**
  - `src/app/(admin)/admin/feedback/page.tsx`:

```tsx
import { AdminFeedback } from "@/components/admin/AdminFeedback"

export default function AdminFeedbackPage() {
  return <AdminFeedback />
}
```

  - `admin-nav.ts`: import `MessageSquare`, thêm cuối mảng `{ href: "/admin/feedback", labelKey: "admin_feedback", shortKey: "admin_tab_feedback", icon: MessageSquare }`.
  - `src/components/admin/AdminFeedback.tsx`:

```tsx
"use client"

import { Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { dateOrDash } from "./admin-format"

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
      ))}
    </span>
  )
}

export function AdminFeedback() {
  const { t } = useTranslation()
  const query = trpc.admin.feedbackList.useInfiniteQuery({}, { getNextPageParam: (last) => last.nextCursor ?? undefined })
  const first = query.data?.pages[0]
  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const star = (n: number) => t("feedback_star").replace("{n}", String(n))

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_feedback")} />
      {query.isPending ? (
        <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />
      ) : query.isError || !first ? (
        <div className="text-center text-sm text-slate-600">
          {t("load_error")}{" "}
          <Button variant="link" onClick={() => query.refetch()}>{t("retry")}</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[auto_1fr] sm:gap-6">
            <div>
              <p className="text-sm text-slate-500">{t("admin_feedback_avg")}</p>
              <p data-testid="feedback-average" className="text-3xl font-semibold text-slate-900">
                {first.average === null ? "-" : first.average.toLocaleString("vi-VN")}
              </p>
              <p className="text-sm text-slate-500">{t("admin_feedback_total").replace("{n}", String(first.total))}</p>
            </div>
            <ul className="space-y-1">
              {([5, 4, 3, 2, 1] as const).map((n) => {
                const c = first.counts[n]
                return (
                  <li key={n} data-testid={`feedback-count-${n}`} className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-slate-600">{star(n)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                      <span className="block h-full bg-amber-400" style={{ width: `${first.total ? (c / first.total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-slate-700">{c}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          {items.length === 0 ? (
            <p className="text-center text-sm text-slate-500">{t("admin_feedback_empty")}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((f) => (
                <li key={f.id} data-testid="feedback-item" className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={f.rating} label={star(f.rating)} />
                    <span className="text-xs text-slate-500">{dateOrDash(f.createdAt)}</span>
                  </div>
                  <p className={cn("mt-2 whitespace-pre-line text-sm", f.message ? "text-slate-900" : "italic text-slate-400")}>
                    {f.message ?? t("admin_feedback_no_message")}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{f.username}</span>
                    {f.fullName ? ` (${f.fullName})` : ""} · {f.page} · v{f.appVersion}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {query.hasNextPage && (
            <div className="text-center">
              <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="h-11 md:h-10">
                {query.isFetchingNextPage && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("admin_feedback_more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

  - `dateOrDash` phải hiện giờ VN đúng như các trang admin khác. Nó chỉ hiện ngày thì vẫn dùng, cho thống nhất với các trang kia.
  - Test mong `"3,5"`, ứng với `toLocaleString("vi-VN")`.

- [ ] **Step 5: Chạy** `pnpm test tests/unit/components/AdminFeedback.test.tsx` rồi `grep -rn "ADMIN_NAV_ITEMS" tests/`. Test nào đếm số mục (6) thì đổi thành 7, ghi `Ruling:` vào ledger. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/feedback/page.tsx" src/components/admin/AdminFeedback.tsx src/components/admin/admin-nav.ts src/language/vi.json src/language/en.json tests/unit/components/AdminFeedback.test.tsx
git commit -m "feat: trang admin xem gop y"
```

---

### Task 6: e2e + RELEASES 0.13.0

**Files:**
- Create: `tests/e2e/ab-form-gop-y.spec.ts`
- Modify: `src/lib/releases.ts`, `package.json`

- [ ] **Step 1: e2e** — tạo `tests/e2e/ab-form-gop-y.spec.ts`. Đăng nhập theo mẫu `students-import.spec.ts` (ẩn `nextjs-portal`); hàm `loginAs` lấy theo `admin.spec.ts`.

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const db = new PrismaClient();
const tag = `E2E-AB-${Math.floor(Math.random() * 1_000_000)}`;

async function loginAs(browser: Browser, username: string, viewport = { width: 390, height: 844 }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(username === 'admin_test' ? /\/admin\/overview$/ : /.*dashboard/);
  return page;
}

test.afterAll(async () => {
  await db.feedback.deleteMany({ where: { message: { startsWith: tag } } });
  await db.$disconnect();
});

test('nhập file câu trả lời Google Form ra đúng học sinh, có nhắc học phí 0đ', async ({ browser }, testInfo) => {
  const page = await loginAs(browser, 'teacher');
  await page.goto('/students');
  await page.getByTestId('add-student-more').click();
  await page.getByRole('menuitem', { name: 'Nhập Excel' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: /Tạo Google Form/ })).toHaveAttribute('href', /docs\.google\.com\/forms\/d\/.+\/copy$/);

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Câu trả lời biểu mẫu 1');
  sheet.addRow(['Dấu thời gian', 'Họ tên', 'Lớp', 'Tên phụ huynh', 'SĐT phụ huynh', 'Ghi chú']);
  sheet.addRow(['06/10/2026 9:00:00', `${tag} An`, '5', 'Chị Hoa', 912345678, 'Yếu toán']);
  sheet.addRow(['06/10/2026 9:01:00', `${tag} An`, '5', 'Chị Hoa', 912345678, 'Gửi lại']);
  const filePath = testInfo.outputPath('google-form.xlsx');
  await wb.xlsx.writeFile(filePath);

  await dialog.getByTestId('import-file-input').setInputFiles(filePath);
  await expect(dialog.getByTestId('import-summary')).toHaveText('1 hợp lệ · 1 trùng · 0 lỗi');
  await expect(dialog.getByTestId('import-missing-fee')).toBeVisible();
  await dialog.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i }).click();
  await dialog.getByRole('button', { name: 'Nhập 1 học sinh' }).click();
  await expect(page.getByText('Đã nhập 1 học sinh')).toBeVisible();
  await page.getByPlaceholder('Tìm tên học sinh...').fill(tag);
  await expect(page.getByText(`${tag} An`, { exact: true }).filter({ visible: true })).toBeVisible();
});

test('gửi góp ý từ menu avatar, admin thấy ở trang Góp ý', async ({ browser }) => {
  const page = await loginAs(browser, 'teacher');
  await page.getByRole('button', { name: /Tài khoản|Account/ }).click();
  await page.getByRole('menuitem', { name: 'Góp ý' }).click();
  const dialog = page.getByRole('dialog', { name: 'Góp ý cho app' });
  await dialog.getByRole('radio', { name: '4 sao' }).click();
  await dialog.getByLabel(/Cần thêm gì, sửa gì/).fill(`${tag} thêm báo cáo năm`);
  await dialog.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.getByText('Cảm ơn thầy cô đã góp ý!')).toBeVisible();

  const admin = await loginAs(browser, 'admin_test', { width: 1280, height: 900 });
  await admin.goto('/admin/feedback');
  const card = admin.getByTestId('feedback-item').filter({ hasText: `${tag} thêm báo cáo năm` });
  await expect(card).toBeVisible();
  await expect(card).toContainText('teacher');
  await expect(card).toContainText('/dashboard');
});
```

  - Học sinh tạo trong e2e: dọn theo cách của `students-import.spec.ts` (giữ tiền tố ngẫu nhiên). File đó có `afterAll` xoá theo `studentIdsByNamePrefix` thì làm y như vậy với `tag`.
  - Tên nút avatar lấy từ i18n `account_menu`. Đọc giá trị trong `vi.json` rồi sửa regex cho khớp.
  - Chữ "Đã nhập 1 học sinh" / "Nhập 1 học sinh": kiểm đúng chuỗi trong `vi.json` (`import_success`, `import_submit`).

- [ ] **Step 2: RELEASES + version.** `package.json` → `"version": "0.13.0"`. Thêm vào **đầu** `RELEASES`:

```ts
  {
    version: "0.13.0",
    date: "2026-10-06",
    title: "Phụ huynh tự điền danh sách, hòm thư góp ý",
    summary: "Gửi Google Form cho phụ huynh điền thông tin học sinh rồi nhập thẳng vào app. Thêm mục Góp ý để thầy cô chấm điểm và gửi ý kiến.",
    notify: true,
    items: [
      { kind: "new", title: "Nhờ phụ huynh điền qua Google Form", body: "Ở Nhập Excel, bấm Tạo Google Form để có form riêng, gửi link cho phụ huynh. Tải câu trả lời về dạng .xlsx rồi nhập thẳng, không phải sửa file.", guideId: "nhap-excel" },
      { kind: "new", title: "Hòm thư góp ý", body: "Mở menu tài khoản, chọn Góp ý để chấm 1 đến 5 sao và ghi điều cần thêm, cần sửa." },
    ],
  },
```

- [ ] **Step 3: Kiểm toàn bộ.**
  - `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`. Expected: sạch / xanh.
  - Sau đó chạy e2e chia 2 nửa theo LENH.md (file mới nằm ở nửa chứa chữ `a`). Expected: xanh. Ghi số test pass/fail vào ledger.
  - Test `releases.test.ts` canh `RELEASES[0].version === package.json`.
  - Nếu `guide-docx-file.test.ts` đỏ vì đổi phần cập nhật: chạy lại `pnpm guide:docx` (chỉ dựng file hướng dẫn) rồi commit file.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/ab-form-gop-y.spec.ts src/lib/releases.ts package.json
git commit -m "chore: v0.13.0 form phu huynh va gop y"
```

- [ ] **Step 5: Báo Claude.** Ghi vào `.superpowers/gehihi/kenh.md`: các commit, số test unit / integration / e2e, các dòng `Ruling:`. Nhắc rằng `GOOGLE_FORM_TEMPLATE_ID` vẫn là giá trị giữ chỗ.
