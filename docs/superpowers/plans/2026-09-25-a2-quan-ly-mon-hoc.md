# A2 — Màn Quản lý môn học Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang `/subjects` (vào từ menu avatar) để thêm, sửa, đặt mặc định, ẩn và hiện lại môn học; sửa backend `subject.*` cho phép ẩn/hiện môn đã có ca.

**Architecture:** Backend giữ router cũ, chỉ mở rộng `subject.update` (nhận `isActive` + 3 quy tắc chặn) và `subject.create` (tự xếp cuối, báo rõ khi trùng tên môn đã ẩn). Frontend thêm `SubjectList` + `SubjectFormDialog` trong `src/components/subjects/`, 2 hàm thuần trong `src/lib/` (chọn màu kế tiếp, giữ môn đã ẩn trong ô chọn khi sửa ca).

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, Prisma, Zod, Tailwind 3, shadcn/ui, lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-a2-quan-ly-mon-hoc-design.md`

## Global Constraints

- Không đổi schema Prisma, không migration. Không thêm dependency.
- Giữ nhận diện A1: indigo/slate, Geist, lucide-react, shadcn/ui, bo góc `rounded-lg`.
- Vùng chạm tối thiểu 44px trên mobile (`size-11`, `h-11`). Viewport kiểm thử mobile 390×844, breakpoint `md`.
- i18n: mọi chuỗi UI mới có ở cả `src/language/vi.json` và `en.json`, số key 2 file bằng nhau. Chuỗi mới không dùng dấu gạch dài.
- Thông báo lỗi từ service viết tiếng Việt như các service hiện có.
- Ghi chú trong code: tiếng Việt có dấu, 1-2 dòng, chỉ ghi lý do/bẫy.
- **An toàn dữ liệu production:** test chỉ chạy khi `DATABASE_URL` trong `.env.test` khác `.env`. **Không chạy `pnpm build`** ở local (gồm `prisma migrate deploy` lên production); kiểm tra build bằng `pnpm exec next build`. `pnpm dev` dùng `.env` (production): không dùng để kiểm tra tay có thao tác ghi.
- E2E: nếu cổng 3000 đang bận bởi tiến trình khác, không tắt tiến trình đó; dùng config tạm (git-ignored) import `playwright.config.ts` và đổi cổng.
- Làm trên nhánh `feat/a2-subjects`. Commit message kết thúc bằng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```

## Điều chỉnh so với spec

1. Tiêu đề trang và mục menu dùng lại key sẵn có `subject` ("Môn học") thay vì thêm `subjects_page`. Còn 15 key mới.
2. Dialog thêm/sửa chỉ mount khi mở (`{form.open && <SubjectFormDialog/>}`) để state khởi tạo thẳng từ props, không cần `useEffect` reset.
3. Nút Lưu bị vô hiệu khi tên rỗng (sau trim) thay vì hiện lỗi "bắt buộc" → không cần key lỗi riêng.

## Review Focus

1. **Tên môn rất dài (~50 ký tự)** → thẻ môn `truncate`, trang không tràn ngang ở 390px. Pin: e2e Task 6 dùng tên dài và kiểm tra `scrollWidth`.
2. **Ẩn môn mặc định / môn cuối cùng** → toast hiện đúng lý do từ server, môn không bị ẩn. Pin: integration Task 1.
3. **Sửa ca cũ có môn đã ẩn** → ô chọn môn không trống, hiện "{tên} (đã ẩn)". Pin: unit `withCurrentSubject` Task 2.
4. **Tạo môn trùng tên với môn đã ẩn** → lỗi nói rõ "đang bị ẩn", không phải "đã tồn tại". Pin: integration Task 1.
5. **Bấm Lưu liên tục** → không gửi 2 request (nút `disabled` khi `isPending`); nếu có, unique constraint trả lỗi hiển thị dưới ô tên. Pin: đọc code ở review cuối.

---

## File Structure

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `src/lib/schemas/subject.ts` | Sửa | `sortOrder` optional; `update.data` nhận `isActive` |
| `src/server/services/subject.service.ts` | Sửa | Quy tắc ẩn/hiện/mặc định; xếp cuối; lỗi trùng tên môn ẩn |
| `src/lib/subject-colors.ts` | Mới | `SUBJECT_COLORS`, `pickNextColor()` |
| `src/lib/subject-options.ts` | Mới | `withCurrentSubject()` |
| `src/language/vi.json`, `en.json` | Sửa | 15 key mới |
| `src/components/subjects/SubjectFormDialog.tsx` | Mới | Dialog thêm/sửa |
| `src/components/subjects/SubjectList.tsx` | Mới | Trang danh sách 2 nhóm, menu ⋯, xác nhận ẩn |
| `src/app/(app)/subjects/page.tsx` | Mới | Route `/subjects` |
| `src/components/layout/AppHeader.tsx` | Sửa | Mục "Môn học" trong menu avatar |
| `src/components/sessions/SessionFormDialog.tsx` | Sửa | Ô chọn môn giữ môn đã ẩn khi sửa ca |
| `tests/integration/subject.test.ts` | Sửa | 7 test mới |
| `tests/unit/lib/subject-colors.test.ts` | Mới | |
| `tests/unit/lib/subject-options.test.ts` | Mới | |
| `tests/e2e/subjects.spec.ts` | Mới | E2E 390px |

---

### Task 0: Tạo nhánh

- [ ] **Step 1**

```bash
git checkout docs/spec-a2-subjects
git checkout -b feat/a2-subjects
```

- [ ] **Step 2: Xác nhận DB test**

Run:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: 2 host khác nhau. Nếu giống → DỪNG, báo người dùng.

---

### Task 1: Backend — ẩn/hiện, xếp cuối, lỗi trùng tên môn ẩn

**Files:**
- Modify: `src/lib/schemas/subject.ts`
- Modify: `src/server/services/subject.service.ts`
- Test: `tests/integration/subject.test.ts`

**Interfaces:**
- Produces: `subject.update({ id, data: { name?, color?, isDefault?, sortOrder?, isActive? } })`; `subject.create({ name, color?, isDefault?, sortOrder? })` — `sortOrder` bỏ trống thì xếp cuối.

- [ ] **Step 1: Viết test fail**

Thêm vào `tests/integration/subject.test.ts`: hàm tiện ích ngay dưới `resetSubjects`:

```ts
async function createSessionFor(subjectId: number) {
  const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  await db.teachingSession.create({
    data: {
      userId: user.id,
      sessionDate: new Date("2026-05-01"),
      startTime: new Date("1970-01-01T08:00:00Z"),
      endTime: new Date("1970-01-01T09:30:00Z"),
      subjectId,
    },
  })
}
```

Và các test sau, đặt cuối `describe("Subject CRUD", ...)`:

```ts
  it("✓ update isActive=false → ẩn được môn đã có ca, ca cũ giữ subjectId", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const target = await caller.subject.create({ name: "Đã dạy" })
    await createSessionFor(target.id)

    const updated = await caller.subject.update({ id: target.id, data: { isActive: false } })
    expect(updated.isActive).toBe(false)
    const active = await caller.subject.list({ isActive: true })
    expect(active.find((s) => s.id === target.id)).toBeUndefined()
    expect(await db.teachingSession.count({ where: { subjectId: target.id } })).toBe(1)
  })

  it("✗ ẩn môn mặc định → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const def = await caller.subject.create({ name: "Mặc định", isDefault: true })
    await caller.subject.create({ name: "Khác" })
    await expect(
      caller.subject.update({ id: def.id, data: { isActive: false } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("mặc định") })
  })

  it("✗ ẩn môn đang dạy cuối cùng → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const only = await caller.subject.create({ name: "Duy nhất" })
    await expect(
      caller.subject.update({ id: only.id, data: { isActive: false } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("cuối cùng") })
  })

  it("✓ update isActive=true → hiện lại môn đã ẩn", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const target = await caller.subject.create({ name: "Tạm ẩn" })
    await caller.subject.update({ id: target.id, data: { isActive: false } })
    await caller.subject.update({ id: target.id, data: { isActive: true } })
    const active = await caller.subject.list({ isActive: true })
    expect(active.find((s) => s.id === target.id)).toBeDefined()
  })

  it("✗ đặt môn đã ẩn làm mặc định → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const target = await caller.subject.create({ name: "Đang ẩn" })
    await caller.subject.update({ id: target.id, data: { isActive: false } })
    await expect(
      caller.subject.update({ id: target.id, data: { isDefault: true } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("đã ẩn") })
  })

  it("✓ create không truyền sortOrder → xếp cuối danh sách", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "A", sortOrder: 5 })
    await caller.subject.create({ name: "B", sortOrder: 2 })
    const created = await caller.subject.create({ name: "Mới" })
    expect(created.sortOrder).toBe(6)
    const list = await caller.subject.list({})
    expect(list[list.length - 1].id).toBe(created.id)
  })

  it("✗ create trùng tên môn đã ẩn → báo đang bị ẩn; trùng môn đang dạy → đã tồn tại", async () => {
    const caller = await getAuthedCaller()
    await caller.subject.create({ name: "Giữ lại", isDefault: true })
    const hidden = await caller.subject.create({ name: "Hóa" })
    await caller.subject.update({ id: hidden.id, data: { isActive: false } })

    await expect(caller.subject.create({ name: "Hóa" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("đang bị ẩn"),
    })
    await expect(caller.subject.create({ name: "Giữ lại" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Tên môn học đã tồn tại",
    })
  })
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm vitest run tests/integration/subject.test.ts`
Expected: FAIL. Test ẩn môn đã có ca / hiện lại / đặt mặc định môn ẩn fail vì `isActive` bị Zod bỏ qua (môn không đổi); test chặn ẩn không ném lỗi; test `sortOrder` nhận `0` thay vì `6`; test trùng tên môn ẩn nhận "Tên môn học đã tồn tại". 8 test cũ vẫn pass.

- [ ] **Step 3: Sửa schema**

`src/lib/schemas/subject.ts`:

```ts
export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên môn không được rỗng").max(100),
  color: z
    .string()
    .regex(hexColorRegex, "Màu phải dạng hex 6 ký tự")
    .default("#4F46E5"),
  isDefault: z.boolean().default(false),
  // Bỏ trống → service xếp cuối (max + 1)
  sortOrder: z.number().int().min(0).optional(),
})

export const subjectUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: subjectCreateSchema.partial().extend({ isActive: z.boolean().optional() }),
})
```

Thêm kiểu dùng cho service, dưới các type sẵn có:

```ts
export type SubjectUpdateData = SubjectUpdateInput["data"]
```

- [ ] **Step 4: Sửa service**

Trong `src/server/services/subject.service.ts`:

Import thêm `SubjectUpdateData`:

```ts
import type {
  SubjectCreateInput,
  SubjectFilterInput,
  SubjectUpdateData,
} from "@/lib/schemas/subject"
```

Thêm hàm dùng chung (trên `createSubject`):

```ts
const DUPLICATE_NAME = "Tên môn học đã tồn tại"

function badRequest(message: string) {
  return new TRPCError({ code: "BAD_REQUEST", message })
}
```

Trong `createSubject`, thay `tx.subject.create({...})` bằng bản tính `sortOrder`:

```ts
      const sortOrder =
        input.sortOrder ??
        ((await tx.subject.aggregate({ where: { userId }, _max: { sortOrder: true } }))._max
          .sortOrder ?? -1) + 1
      return tx.subject.create({
        data: {
          userId,
          name: input.name,
          color: input.color,
          isDefault: input.isDefault,
          sortOrder,
        },
      })
```

và thay khối `catch` của `createSubject`:

```ts
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Trùng với môn đã ẩn thì người dùng không thấy môn đó ở đâu → chỉ cách bật lại
      const clash = await db.subject.findUnique({
        where: { userId_name: { userId, name: input.name } },
      })
      if (clash && !clash.isActive) {
        throw badRequest("Môn này đang bị ẩn. Hãy bấm Hiện lại trong danh sách môn đã ẩn.")
      }
      throw badRequest(DUPLICATE_NAME)
    }
    throw e
  }
```

Thay chữ ký và phần đầu `updateSubject`:

```ts
export async function updateSubject(
  db: PrismaClient,
  userId: number,
  id: number,
  data: SubjectUpdateData
): Promise<Subject> {
  const existing = await db.subject.findUnique({ where: { id } })
  assertOwnership(existing, userId)

  // Ẩn qua update được phép cả khi môn đã có ca (khác delete): ca cũ vẫn trỏ tới môn.
  if (data.isActive === false && existing.isActive) {
    if (existing.isDefault) {
      throw badRequest("Không thể ẩn môn mặc định. Hãy chọn môn mặc định khác trước.")
    }
    const remaining = await db.subject.count({
      where: { userId, isActive: true, NOT: { id } },
    })
    if (remaining === 0) throw badRequest("Không thể ẩn môn cuối cùng")
  }
  const willBeActive = data.isActive ?? existing.isActive
  if (data.isDefault === true && !willBeActive) {
    throw badRequest("Không thể đặt môn đã ẩn làm mặc định")
  }
```

Trong `tx.subject.update` của `updateSubject`, thêm dòng vào `data`:

```ts
          ...(data.isActive !== undefined && { isActive: data.isActive }),
```

Trong `catch` của `updateSubject`, thay `message: "Tên môn học đã tồn tại"` bằng `DUPLICATE_NAME` (giữ nguyên cấu trúc `throw new TRPCError`, hoặc `throw badRequest(DUPLICATE_NAME)`).

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `pnpm vitest run tests/integration/subject.test.ts`
Expected: PASS 15/15.

- [ ] **Step 6: Typecheck + các test có gọi `subject.create`**

Run: `pnpm exec tsc --noEmit && pnpm vitest run tests/integration/attendance.test.ts tests/integration/bulk-update-students.test.ts tests/integration/makeup-session.test.ts`
Expected: không lỗi, pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/schemas/subject.ts src/server/services/subject.service.ts tests/integration/subject.test.ts
git commit -m "feat(subject): ẩn/hiện môn qua update, môn mới xếp cuối, báo rõ trùng tên môn đã ẩn"
```

---

### Task 2: Hàm thuần — màu kế tiếp, giữ môn đã ẩn trong ô chọn

**Files:**
- Create: `src/lib/subject-colors.ts`, `src/lib/subject-options.ts`
- Test: `tests/unit/lib/subject-colors.test.ts`, `tests/unit/lib/subject-options.test.ts`

**Interfaces:**
- Produces:
  - `SUBJECT_COLORS: readonly string[]` (10 mã hex in hoa), `pickNextColor(usedColors: string[]): string`
  - `type SubjectOption = { id: number; name: string; color: string }`, `withCurrentSubject(active: SubjectOption[], current?: SubjectOption): (SubjectOption & { hidden: boolean })[]`

- [ ] **Step 1: Viết test fail**

`tests/unit/lib/subject-colors.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { SUBJECT_COLORS, pickNextColor } from "@/lib/subject-colors"

describe("pickNextColor", () => {
  it("chưa dùng màu nào → màu đầu bảng", () => {
    expect(pickNextColor([])).toBe(SUBJECT_COLORS[0])
  })

  it("bỏ qua màu đã dùng, không phân biệt hoa thường", () => {
    expect(pickNextColor(["#4f46e5", SUBJECT_COLORS[1]])).toBe(SUBJECT_COLORS[2])
  })

  it("đã dùng hết → quay về màu đầu bảng", () => {
    expect(pickNextColor([...SUBJECT_COLORS])).toBe(SUBJECT_COLORS[0])
  })

  it("bảng có 10 màu hex không trùng", () => {
    expect(SUBJECT_COLORS).toHaveLength(10)
    expect(new Set(SUBJECT_COLORS).size).toBe(10)
    SUBJECT_COLORS.forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/))
  })
})
```

`tests/unit/lib/subject-options.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { withCurrentSubject } from "@/lib/subject-options"

const toan = { id: 1, name: "Toán", color: "#0891B2" }
const anh = { id: 2, name: "Tiếng Anh", color: "#4F46E5" }
const hoa = { id: 3, name: "Hóa", color: "#DC2626" }

describe("withCurrentSubject", () => {
  it("không có môn hiện tại → giữ nguyên danh sách, hidden=false", () => {
    expect(withCurrentSubject([toan, anh])).toEqual([
      { ...toan, hidden: false },
      { ...anh, hidden: false },
    ])
  })

  it("môn hiện tại đang dạy → không thêm trùng", () => {
    expect(withCurrentSubject([toan, anh], anh)).toHaveLength(2)
  })

  it("môn hiện tại đã ẩn → thêm vào cuối với hidden=true", () => {
    const result = withCurrentSubject([toan, anh], hoa)
    expect(result).toHaveLength(3)
    expect(result[2]).toEqual({ ...hoa, hidden: true })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm vitest run tests/unit/lib/subject-colors.test.ts tests/unit/lib/subject-options.test.ts`
Expected: FAIL — không resolve `@/lib/subject-colors`, `@/lib/subject-options`.

- [ ] **Step 3: Viết code**

`src/lib/subject-colors.ts`:

```ts
// Bảng màu cố định (spec A2 §5.3): đủ đậm trên nền trắng, gồm 5 màu của môn mặc định.
export const SUBJECT_COLORS = [
  "#4F46E5",
  "#0891B2",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
  "#2563EB",
  "#65A30D",
  "#475569",
] as const

export function pickNextColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toUpperCase()))
  return SUBJECT_COLORS.find((c) => !used.has(c)) ?? SUBJECT_COLORS[0]
}
```

`src/lib/subject-options.ts`:

```ts
export type SubjectOption = { id: number; name: string; color: string }

// Ô chọn môn chỉ lấy môn đang dạy; khi sửa ca có môn đã ẩn phải thêm môn đó để ô không trống.
export function withCurrentSubject(
  active: SubjectOption[],
  current?: SubjectOption
): (SubjectOption & { hidden: boolean })[] {
  const items = active.map((s) => ({ ...s, hidden: false }))
  if (current && !active.some((s) => s.id === current.id)) {
    items.push({ ...current, hidden: true })
  }
  return items
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm vitest run tests/unit/lib/subject-colors.test.ts tests/unit/lib/subject-options.test.ts`
Expected: PASS 7/7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subject-colors.ts src/lib/subject-options.ts tests/unit/lib/subject-colors.test.ts tests/unit/lib/subject-options.test.ts
git commit -m "feat(subject): bảng màu môn, giữ môn đã ẩn trong ô chọn khi sửa ca"
```

---

### Task 3: i18n

**Files:**
- Modify: `src/language/vi.json`, `src/language/en.json`

**Interfaces:**
- Produces key: `subjects_desc`, `add_subject`, `edit_subject`, `subject_name`, `subject_color`, `subject_default_hint`, `subjects_active`, `subjects_hidden`, `set_default`, `hide`, `unhide`, `default_badge`, `hide_subject_confirm`, `subject_saved`, `hidden_suffix`. Dùng lại key sẵn có: `subject`, `edit`, `save`, `cancel`, `actions`, `load_error`, `retry`.

- [ ] **Step 1: Thêm key (script giữ thứ tự và kiểu xuống dòng của file, ném lỗi nếu key đã tồn tại)**

```bash
node - <<'EOF'
const fs = require('fs')
const add = {
  vi: {
    subjects_desc: "Màu môn hiện ở danh sách ca dạy",
    add_subject: "Thêm môn",
    edit_subject: "Sửa môn",
    subject_name: "Tên môn",
    subject_color: "Màu",
    subject_default_hint: "Môn mặc định khi tạo ca",
    subjects_active: "Đang dạy",
    subjects_hidden: "Đã ẩn",
    set_default: "Đặt làm mặc định",
    hide: "Ẩn",
    unhide: "Hiện lại",
    default_badge: "Mặc định",
    hide_subject_confirm: "Ẩn môn {name}? Môn sẽ không hiện khi tạo ca mới. Các ca đã có vẫn giữ nguyên.",
    subject_saved: "Đã lưu môn học",
    hidden_suffix: "(đã ẩn)",
  },
  en: {
    subjects_desc: "Subject colors appear in the session list",
    add_subject: "Add subject",
    edit_subject: "Edit subject",
    subject_name: "Subject name",
    subject_color: "Color",
    subject_default_hint: "Default subject for new sessions",
    subjects_active: "Active",
    subjects_hidden: "Hidden",
    set_default: "Set as default",
    hide: "Hide",
    unhide: "Show again",
    default_badge: "Default",
    hide_subject_confirm: "Hide {name}? It won't appear when creating new sessions. Existing sessions stay unchanged.",
    subject_saved: "Subject saved",
    hidden_suffix: "(hidden)",
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
Expected: `306 306 OK`

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → không lỗi.

```bash
git add src/language/vi.json src/language/en.json
git commit -m "chore(i18n): key cho màn Quản lý môn học"
```

---

### Task 4: Trang `/subjects` + mục menu avatar

**Files:**
- Create: `src/components/subjects/SubjectFormDialog.tsx`
- Create: `src/components/subjects/SubjectList.tsx`
- Create: `src/app/(app)/subjects/page.tsx`
- Modify: `src/components/layout/AppHeader.tsx`

**Interfaces:**
- Consumes: `SUBJECT_COLORS`, `pickNextColor` (Task 2); `PageHeader` (A1); `subject.list/create/update` (Task 1); key Task 3.
- Produces: `data-testid="subject-card"` trên mỗi thẻ môn, `data-testid="subjects-active"` / `"subjects-hidden"` trên 2 nhóm (e2e Task 6 dùng).

- [ ] **Step 1: `SubjectFormDialog`**

`src/components/subjects/SubjectFormDialog.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { SUBJECT_COLORS, pickNextColor } from "@/lib/subject-colors"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Subject = RouterOutputs["subject"]["list"][number]

type Props = {
  subject?: Subject
  usedColors: string[]
  onClose: () => void
}

// Chỉ mount khi mở (xem SubjectList) nên state khởi tạo thẳng từ props, không cần effect reset.
export function SubjectFormDialog({ subject, usedColors, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(subject?.name ?? "")
  const [color, setColor] = useState(subject?.color ?? pickNextColor(usedColors))
  const [isDefault, setIsDefault] = useState(subject?.isDefault ?? false)
  const [error, setError] = useState<string | null>(null)

  const handlers = {
    onSuccess: () => {
      toast.success(t("subject_saved"))
      onClose()
    },
    onError: (e: { message: string }) => setError(e.message),
  }
  const createMut = trpc.subject.create.useMutation(handlers)
  const updateMut = trpc.subject.update.useMutation(handlers)
  const isPending = createMut.isPending || updateMut.isPending
  const trimmed = name.trim()

  const save = () => {
    setError(null)
    if (subject) {
      updateMut.mutate({ id: subject.id, data: { name: trimmed, color, isDefault } })
    } else {
      createMut.mutate({ name: trimmed, color, isDefault })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? t("edit_subject") : t("add_subject")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject-name">{t("subject_name")}</Label>
            <Input
              id="subject-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className="h-11 md:h-10"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("subject_color")}</p>
            <div className="grid grid-cols-5 gap-3">
              {SUBJECT_COLORS.map((c) => {
                const selected = color.toUpperCase() === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={selected}
                    onClick={() => setColor(c)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full",
                      selected && "ring-2 ring-slate-900 ring-offset-2"
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {selected && <Check className="size-5 text-white" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </div>

          {(!subject || subject.isActive) && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="subject-default"
                checked={isDefault}
                onCheckedChange={(v) => setIsDefault(v === true)}
              />
              <Label htmlFor="subject-default">{t("subject_default_hint")}</Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 md:h-10">
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={!trimmed || isPending} className="h-11 md:h-10">
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: `SubjectList`**

`src/components/subjects/SubjectList.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Star } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/common/PageHeader"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { SubjectFormDialog } from "./SubjectFormDialog"

type Subject = RouterOutputs["subject"]["list"][number]

export function SubjectList() {
  const { t } = useTranslation()
  const query = trpc.subject.list.useQuery({})
  const updateMut = trpc.subject.update.useMutation({
    onError: (e) => toast.error(e.message),
  })

  const [form, setForm] = useState<{ open: false } | { open: true; subject?: Subject }>({
    open: false,
  })
  const [hideTarget, setHideTarget] = useState<Subject | null>(null)

  const subjects = query.data ?? []
  const active = subjects.filter((s) => s.isActive)
  const hidden = subjects.filter((s) => !s.isActive)

  const renderCard = (s: Subject) => (
    <div
      key={s.id}
      data-testid="subject-card"
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
      <span className={cn("min-w-0 flex-1 truncate font-medium", s.isActive ? "text-slate-900" : "text-slate-500")}>
        {s.name}
      </span>
      {s.isDefault && (
        <Badge variant="outline" className="shrink-0 border-indigo-200 bg-indigo-50 text-indigo-700">
          {t("default_badge")}
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 shrink-0 md:size-9" aria-label={t("actions")}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setForm({ open: true, subject: s })}>
            <Pencil className="mr-2 size-4" />
            {t("edit")}
          </DropdownMenuItem>
          {s.isActive && !s.isDefault && (
            <DropdownMenuItem onSelect={() => updateMut.mutate({ id: s.id, data: { isDefault: true } })}>
              <Star className="mr-2 size-4" />
              {t("set_default")}
            </DropdownMenuItem>
          )}
          {s.isActive ? (
            <DropdownMenuItem onSelect={() => setHideTarget(s)}>
              <EyeOff className="mr-2 size-4" />
              {t("hide")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => updateMut.mutate({ id: s.id, data: { isActive: true } })}>
              <Eye className="mr-2 size-4" />
              {t("unhide")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("subject")}
        description={t("subjects_desc")}
        actions={
          <Button onClick={() => setForm({ open: true })} className="h-11 md:h-10">
            <Plus className="mr-2 size-4" />
            {t("add_subject")}
          </Button>
        }
      />

      {query.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-600">{t("load_error")}</p>
          <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <>
          <section data-testid="subjects-active" className="space-y-3">
            <h2 className="text-sm font-medium text-slate-500">{t("subjects_active")}</h2>
            <div className="grid gap-3 md:grid-cols-2">{active.map(renderCard)}</div>
          </section>

          {hidden.length > 0 && (
            <section data-testid="subjects-hidden" className="space-y-3">
              <h2 className="text-sm font-medium text-slate-500">{t("subjects_hidden")}</h2>
              <div className="grid gap-3 md:grid-cols-2">{hidden.map(renderCard)}</div>
            </section>
          )}
        </>
      )}

      {form.open && (
        <SubjectFormDialog
          subject={form.subject}
          usedColors={subjects.map((s) => s.color)}
          onClose={() => setForm({ open: false })}
        />
      )}

      <AlertDialog open={hideTarget !== null} onOpenChange={(open) => !open && setHideTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("hide")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("hide_subject_confirm").replace("{name}", hideTarget?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (hideTarget) updateMut.mutate({ id: hideTarget.id, data: { isActive: false } })
                setHideTarget(null)
              }}
            >
              {t("hide")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 3: Route**

`src/app/(app)/subjects/page.tsx`:

```tsx
"use client"

import { SubjectList } from "@/components/subjects/SubjectList"

export default function SubjectsPage() {
  return <SubjectList />
}
```

- [ ] **Step 4: Mục "Môn học" trong menu avatar**

Trong `src/components/layout/AppHeader.tsx`:
- Thêm `import Link from "next/link"`; lucide import thêm `BookOpen`: `import { BookOpen, KeyRound, LogOut, Languages } from "lucide-react"`.
- Ngay sau `<DropdownMenuContent align="end" className="w-48">` (menu avatar), trước `<ChangePasswordDialog`, thêm:

```tsx
            <DropdownMenuItem asChild>
              <Link href="/subjects">
                <BookOpen className="size-4 mr-2" />
                {t("subject")}
              </Link>
            </DropdownMenuItem>
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/components/subjects "src/app/(app)/subjects/page.tsx" src/components/layout/AppHeader.tsx
git commit -m "feat(subjects): trang Quản lý môn học, vào từ menu avatar"
```

---

### Task 5: Ô chọn môn giữ môn đã ẩn khi sửa ca

**Files:**
- Modify: `src/components/sessions/SessionFormDialog.tsx` (khối `FormField name="subjectId"`, dòng ~245-275)

**Interfaces:**
- Consumes: `withCurrentSubject` (Task 2); `editingSession.subject: { id, name, color }` (`SessionDTO` → `SubjectDTO`).

- [ ] **Step 1: Sửa**

Thêm import:

```ts
import { withCurrentSubject } from "@/lib/subject-options"
```

Ngay sau dòng `const { data: subjects = [] } = trpc.subject.list.useQuery({ isActive: true })`, thêm:

```ts
  const subjectOptions = withCurrentSubject(
    subjects,
    editingSession
      ? { id: editingSession.subjectId, name: editingSession.subject.name, color: editingSession.subject.color }
      : undefined
  )
```

Trong `SelectContent` của ô môn học, thay `subjects.map((s) => (` bằng `subjectOptions.map((s) => (` và dòng `{s.name}` bằng:

```tsx
                              {s.name}
                              {s.hidden && <span className="text-slate-400">{t("hidden_suffix")}</span>}
```

(Giữ nguyên effect chọn môn mặc định — nó vẫn dùng `subjects`, chỉ chạy khi tạo ca mới.)

- [ ] **Step 2: Typecheck, lint, unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm vitest run tests/unit`
Expected: không lỗi, unit pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/sessions/SessionFormDialog.tsx
git commit -m "fix(sessions): sửa ca có môn đã ẩn, ô chọn môn vẫn hiện môn đó"
```

---

### Task 6: E2E + kiểm chứng cuối

**Files:**
- Create: `tests/e2e/subjects.spec.ts`

- [ ] **Step 1: Viết e2e**

`tests/e2e/subjects.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function subjectOptionCount(page: Page, name: string) {
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Môn học').click();
  await expect(page.getByRole('option').first()).toBeVisible();
  const count = await page.getByRole('option', { name }).count();
  await page.keyboard.press('Escape'); // đóng listbox
  await page.keyboard.press('Escape'); // đóng dialog
  return count;
}

test.describe('Quản lý môn học (390px)', () => {
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

  // Môn chỉ ẩn được, không xóa → tên ngẫu nhiên tiền tố E2E; DB test được reset khi chạy `pnpm test`.
  test('thêm, đổi màu, ẩn rồi hiện lại một môn', async ({ page }) => {
    const name = `E2E môn có tên khá dài để kiểm tra truncate ${Math.floor(Math.random() * 100000)}`;

    // Vào từ menu avatar
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await page.getByRole('menuitem', { name: 'Môn học' }).click();
    await expect(page).toHaveURL(/\/subjects/);

    // Thêm môn
    await page.getByRole('button', { name: 'Thêm môn' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tên môn').fill(name);
    await dialog.getByRole('button', { name: '#DB2777' }).click();
    await dialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu môn học')).toBeVisible();

    const card = page.getByTestId('subject-card').filter({ hasText: name });
    await expect(card).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Đổi màu
    await card.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Sửa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '#65A30D' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu môn học').first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Ẩn → không còn trong ô chọn môn khi tạo ca
    await card.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Ẩn' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Ẩn', exact: true }).click();
    await expect(page.getByTestId('subjects-hidden').getByText(name)).toBeVisible();
    expect(await subjectOptionCount(page, name)).toBe(0);

    // Hiện lại → có lại trong ô chọn môn
    await page.goto('/subjects');
    await card.getByRole('button', { name: 'Menu hành động' }).click();
    await page.getByRole('menuitem', { name: 'Hiện lại' }).click();
    await expect(page.getByTestId('subjects-active').getByText(name)).toBeVisible();
    expect(await subjectOptionCount(page, name)).toBe(1);
  });
});
```

Ghi chú: DB test có thể còn môn ẩn từ lần chạy e2e trước (môn không xóa được), nên nhóm "Đã ẩn" có thể luôn hiện; test kiểm tra môn nằm trong nhóm nào qua `data-testid`, không dựa vào tiêu đề nhóm.

- [ ] **Step 2: Chạy e2e toàn bộ**

Run (trước tiên `pnpm test` để reset DB test): `pnpm exec playwright test` (hoặc config tạm nếu cổng 3000 bận — xem Global Constraints).
Expected: toàn bộ pass (upgrade-class có thể skip như trước).

- [ ] **Step 3: Kiểm tra toàn bộ**

Run: `pnpm lint && pnpm test && pnpm exec next build`
Expected: lint sạch, unit + integration pass, build OK.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/subjects.spec.ts
git commit -m "test(e2e): quản lý môn học trên mobile (thêm, đổi màu, ẩn, hiện lại)"
```

- [ ] **Step 5: Bàn giao**

Hỏi người dùng cách hoàn tất nhánh (merge / PR / giữ). Preview Vercel không có env → không dùng preview; người dùng tự kiểm tra trên production sau khi merge.
