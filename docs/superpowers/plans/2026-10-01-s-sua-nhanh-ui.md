# S — Sửa nhanh giao diện Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5 sửa đổi giao diện nhỏ: bộ lọc dồn trái 1 hàng, tìm ngân hàng, lưu phiếu vào thư viện Ảnh, ← → xem ca trong tháng, lớp trên thẻ ca.

**Architecture:** Chỉ client + 1 trường DTO (`grades`) ở server. Không migration, không đổi logic tiền. Mỗi mục là 1 task độc lập, test riêng.

**Tech Stack:** Next.js 15 App Router, tRPC v11 (không transformer), Prisma 5.22, Tailwind, Radix (Dialog/Popover/Select), Vitest + Testing Library (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-s-sua-nhanh-ui-design.md`

## Global Constraints

- Nhánh: `feat/s-sua-nhanh-ui` từ `main` (sau O1 832ffad). Spec + plan đã có trên `main` → **không** commit docs.
- Version khi xong: `0.8.1` (patch, epoch vẫn `0.8`, không bắt đăng nhập lại).
- `.env` = PRODUCTION. Test chỉ chạy `.env.test` (localhost:5433). **CẤM** `db:reset`, `migrate reset`, `db push`, `pnpm build`, `pnpm dev`, `git stash`. Build kiểm bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị `.env.test`. Đọc `docs/coding-rule.md` §6.1 trước mọi lệnh DB.
- Không thêm dependency. Popover dùng `@radix-ui/react-popover` (đã có, `src/components/ui/popover.tsx`).
- Ghi chú code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/bẫy.
- Chuỗi hiển thị qua `t()`; thêm key vào **cả** `src/language/vi.json` và `src/language/en.json`.
- Mobile: mọi nút/dòng chạm ≥ 44px; không tràn ngang ở 390px.
- Tên HS đã mã hoá (O1): không lọc/sắp DB theo tên; `grades` lấy từ `sessionStudents[].grade` (không mã hoá).
- Commit: tiêu đề 1 dòng tiếng Việt, **không body, không Co-Authored-By** (AGENTS.md §4).

## Review Focus

1. **Phím ← → khi đang gõ** ghi chú điểm danh / ô giờ học bù: không được đổi ca. Pin: Task 5 test "phím mũi tên trong textarea không đổi ca".
2. **Đổi ca khi hộp con đang mở** (thêm HS, học bù, xoá…): không đổi ca, state hộp con không lẫn sang ca khác. Pin: Task 5 dùng `key={session.id}` để remount + test "hộp con mở thì phím không đổi ca".
3. **Ca đã huỷ và bộ lọc HS**: danh sách đi đúng các ca đang hiện trên lịch (cả ca huỷ), đúng thứ tự ngày→giờ. Pin: Task 5 test với siblings chưa sắp.
4. **Ngân hàng đã chọn trước đó** (bin lưu trong DB) vẫn hiện đúng tên khi mở Cài đặt; e2e cũ `getByRole('combobox', { name: 'Ngân hàng' })` vẫn chạy. Pin: Task 3 test "giá trị ban đầu hiện đúng tên".
5. **Ảnh phiếu trên mobile chưa sẵn / lỗi chụp**: nút "Lưu ảnh" loading/mờ như nút cũ, không mở màn trống; đóng thì thu hồi object URL. Pin: Task 4 tests.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `src/lib/format-grades.ts` | Mới | `formatGrades(grades, gradeWord, compact)` | 1 |
| `src/lib/types/models.ts` | Sửa | `SessionListDTO.grades: number[]` | 1 |
| `src/server/services/session.service.ts` | Sửa | `toDTO` thêm `grades` | 1 |
| `src/components/calendar/SessionCard.tsx` | Sửa | Hiện lớp | 1 |
| `src/components/calendar/SessionListItem.tsx` | Sửa | Hiện lớp | 1 |
| `src/components/common/FilterBar.tsx` | Sửa | Dồn trái, ô tìm rộng cố định | 2 |
| `tests/e2e/filter-bar-align.spec.ts` | Viết lại | Kiểm dồn trái thay cho sát phải | 2 |
| `src/lib/vn-banks.ts` | Sửa | `aliases`, `searchBanks()` | 3 |
| `src/components/settings/BankSelect.tsx` | Mới | Combobox tìm ngân hàng | 3 |
| `src/components/settings/BankAccountCard.tsx` | Sửa | Dùng `BankSelect` | 3 |
| `src/components/tuition/NoticeImageViewer.tsx` | Mới | Màn xem ảnh toàn màn hình để nhấn giữ lưu | 4 |
| `src/components/tuition/TuitionNoticeDialog.tsx` | Sửa | Mobile: nút "Lưu ảnh" | 4 |
| `src/components/sessions/SessionNavBar.tsx` | Mới | `‹ Ca i/n ›` + phím + vuốt | 5 |
| `src/components/sessions/SessionDetailDialog.tsx` | Sửa | Props `siblings`, `onNavigate` | 5 |
| `src/components/calendar/MonthCalendar.tsx` | Sửa | Truyền siblings, `key` | 5 |
| `package.json` | Sửa | 0.8.1 | 6 |
| `tests/e2e/s-sua-nhanh-ui.spec.ts` | Mới | E2E S2–S5 | 6 |

---

### Task 1: Lớp trên thẻ ca (S5)

**Files:**
- Create: `src/lib/format-grades.ts`, `tests/unit/lib/format-grades.test.ts`
- Modify: `src/lib/types/models.ts:40-51`, `src/server/services/session.service.ts` (`toDTO`, ~dòng 102-140), `src/components/calendar/SessionCard.tsx`, `src/components/calendar/SessionListItem.tsx`
- Test: `tests/integration/session-grades.test.ts`

**Interfaces:**
- Produces: `formatGrades(grades: number[], gradeWord: string, compact?: boolean): string`; `SessionListDTO.grades: number[]`.

- [ ] **Step 1: Test unit `formatGrades`**

```ts
import { describe, it, expect } from "vitest"
import { formatGrades } from "@/lib/format-grades"

describe("formatGrades", () => {
  it.each([
    [[], "Lớp", false, ""],
    [[5], "Lớp", false, "Lớp 5"],
    [[4, 5], "Lớp", false, "Lớp 4, 5"],
    [[3, 4, 5], "Lớp", false, "Lớp 3–5"],
    [[3, 4, 5, 8], "Lớp", false, "Lớp 3–5, 8"],
    [[1, 3, 5], "Lớp", false, "Lớp 1, 3, 5"],
    [[5], "Lớp", true, "L5"],
    [[3, 4, 5], "Lớp", true, "L3–5"],
    [[5], "Grade", false, "Grade 5"],
    [[4, 5], "Grade", true, "G4, 5"],
  ])("%j %s compact=%s → %s", (g, word, compact, want) => {
    expect(formatGrades(g as number[], word as string, compact as boolean)).toBe(want)
  })
})
```

- [ ] **Step 2:** `pnpm test tests/unit/lib/format-grades.test.ts` → FAIL (module không có).

- [ ] **Step 3: Cài đặt**

```ts
// Gộp dãy lớp liên tiếp ≥ 3 thành "3–5" để thẻ ca trên lịch không dài.
export function formatGrades(grades: number[], gradeWord: string, compact = false): string {
  if (grades.length === 0) return ""
  const parts: string[] = []
  let i = 0
  while (i < grades.length) {
    let j = i
    while (j + 1 < grades.length && grades[j + 1] === grades[j] + 1) j++
    if (j - i >= 2) parts.push(`${grades[i]}–${grades[j]}`)
    else for (let k = i; k <= j; k++) parts.push(String(grades[k]))
    i = j + 1
  }
  return `${compact ? gradeWord[0] : `${gradeWord} `}${parts.join(", ")}`
}
```

- [ ] **Step 4:** chạy lại → PASS.

- [ ] **Step 5: Integration `grades`** — `tests/integration/session-grades.test.ts`: tạo HS lớp 4, lớp 5, lớp 5 (3 em, `consent: CONSENT_ACCEPTED`), 1 ca có cả 3 → `caller.session.getMonth({ year, month })` tìm ca → `grades` = `[4, 5]`. Xoá mềm HS lớp 4 (`caller.student.deactivate` rồi `caller.student.delete`) → `grades` = `[5]`. Ca không HS → `[]`. Theo mẫu setup trong `tests/integration/trash-purge.test.ts`. Chạy → FAIL (`grades` undefined).

- [ ] **Step 6: Server + type** — `models.ts` thêm `grades: number[]` vào `SessionListDTO`. `toDTO`: sau `const students = …` thêm
```ts
const grades = [...new Set(students.map((st) => st.grade).filter((g) => g > 0))].sort((a, b) => a - b)
```
và `grades,` vào object trả về (cạnh `level`). `students` ở đây đã lọc `LIVE_LINK` từ query nên HS đã xoá không tính. Chạy integration → PASS; `pnpm exec tsc --noEmit` sạch (sửa mọi chỗ tạo `SessionListDTO` giả trong test nếu tsc báo thiếu `grades`).

- [ ] **Step 7: UI** — `SessionCard.tsx`:
```tsx
const isMobile = !useMediaQuery("(min-width: 768px)")
const gradeText = formatGrades(session.grades ?? [], t("grade"), isMobile)
const meta = [label, gradeText, session.studentCount > 0 ? `${session.studentCount} ${t("student_abbrev")}` : ""].filter(Boolean).join(" · ")
```
Dòng 2 hiển thị `{meta}` (thay `{label} {studentCountText}`). `SessionListItem.tsx`: trước `<span>{studentCount} …</span>` thêm lớp (không compact) và 1 dấu `|` nếu có lớp. Component test `tests/unit/components/SessionCard.test.tsx`: grades `[5]`, 3 HS → text chứa `Lớp 5 · 3 HS`; grades `[]` → không có "Lớp".

- [ ] **Step 8:** `pnpm test tests/unit/lib/format-grades.test.ts tests/integration/session-grades.test.ts tests/unit/components/SessionCard.test.tsx` PASS; tsc + lint sạch.

- [ ] **Step 9: Commit** `feat(s): thẻ ca trên lịch hiện lớp (Lớp 5, Lớp 3–5), DTO ca thêm grades`

---

### Task 2: Bộ lọc dồn trái (S1)

**Files:**
- Modify: `src/components/common/FilterBar.tsx:26-41`
- Rewrite: `tests/e2e/filter-bar-align.spec.ts`
- Test: `tests/unit/components/FilterBar.test.tsx`

- [ ] **Step 1: Component test** — render `FilterBar` với `search` + `filters=<button role="combobox">Khối</button>`: nhóm desktop (`div` chứa filters, class `md:flex`) **không** có class `md:ml-auto`; wrapper ô tìm có `md:w-72` và **không** có `md:max-w-xs`; container ngoài có `flex-wrap`. Chạy → FAIL.

- [ ] **Step 2: Sửa**
  - Container: `className="flex flex-wrap items-center gap-2"`.
  - Wrapper ô tìm: `className="relative flex-1 md:w-72 md:flex-none"`.
  - Nhóm filters desktop: `className="hidden flex-wrap items-center gap-2 md:flex"` (bỏ `md:ml-auto`).
  - Nút "Lọc" mobile giữ nguyên.
  Chạy test → PASS.

- [ ] **Step 3: Viết lại e2e `tests/e2e/filter-bar-align.spec.ts`** — giữ `login` và test mobile 390px. Thay `rightGap` bằng kiểm dồn trái ở 1280px cho `/students`, `/tuition`, `/reports`:
```ts
async function leftLayout(page: Page) {
  await expect(page.locator('main [role="combobox"]:visible').first()).toBeVisible();
  return page.evaluate(() => {
    const search = document.querySelector<HTMLElement>('main input[placeholder]')!.getBoundingClientRect();
    const first = [...document.querySelectorAll<HTMLElement>('main [role="combobox"]')]
      .filter((el) => el.offsetParent)
      .map((el) => el.getBoundingClientRect())
      .sort((a, b) => a.left - b.left)[0];
    return { gap: Math.round(first.left - search.right), sameRow: Math.abs(first.top - search.top) < 8, h: [Math.round(search.height), Math.round(first.height)] };
  });
}
// kỳ vọng: sameRow true, 0 <= gap <= 16, hai chiều cao bằng nhau (±1)
```
`/reports` ở 1280px với tài khoản `teacher` (Pro): nếu trang không có ô tìm thì chỉ kiểm bộ lọc đầu tiên nằm sát mép trái khối `main h1` (±2px). Đọc trang trước khi viết.

- [ ] **Step 4:** `pnpm exec playwright test tests/e2e/filter-bar-align.spec.ts` PASS.

- [ ] **Step 5: Commit** `feat(s): bộ lọc thành hàng riêng dồn trái ngay trên bảng`

---

### Task 3: Tìm ngân hàng (S2)

**Files:**
- Modify: `src/lib/vn-banks.ts`, `src/components/settings/BankAccountCard.tsx:95-108`
- Create: `src/components/settings/BankSelect.tsx`
- Test: `tests/unit/lib/vn-banks.test.ts` (mới hoặc thêm), `tests/unit/components/BankSelect.test.tsx`

**Interfaces:**
- Produces: `VnBank.aliases?: string[]`; `searchBanks(query: string): readonly VnBank[]`; `<BankSelect id value onChange placeholder />`.

- [ ] **Step 1: Unit `searchBanks`**
  - `""` → đủ `VN_BANKS.length` (27).
  - `"vcb"` → `[Vietcombank]` đứng đầu.
  - `"VIETCOM"`, `"ngoại thương"`, `"ngoai thuong"` → có Vietcombank.
  - `"quan doi"` → có MB.
  - `"970436"` → Vietcombank.
  - `"zzz"` → `[]`.
  Chạy → FAIL.

- [ ] **Step 2: Cài đặt** — thêm `aliases` cho các ngân hàng có trong danh sách theo spec §3 (chỉ thêm cho bin đã có; không thêm ngân hàng mới). Rồi:
```ts
const norm = (s: string) => removeVietnameseTones(s).toLowerCase().trim()

// Khớp tên viết tắt/đầy đủ không dấu, bí danh hay gõ (vcb, tcb…) và BIN; bí danh khớp đúng xếp trước.
export function searchBanks(query: string): readonly VnBank[] {
  const q = norm(query)
  if (!q) return VN_BANKS
  const exact = VN_BANKS.filter((b) => b.aliases?.some((a) => norm(a) === q) || norm(b.shortName) === q)
  const rest = VN_BANKS.filter(
    (b) => !exact.includes(b) &&
      (norm(b.shortName).includes(q) || norm(b.name).includes(q) || b.bin.includes(q) || b.aliases?.some((a) => norm(a).includes(q)))
  )
  return [...exact, ...rest]
}
```
(import `removeVietnameseTones` từ `@/lib/utils`; nếu gây vòng import thì chép hàm chuẩn hoá nhỏ.) Chạy → PASS.

- [ ] **Step 3: Component test `BankSelect`** (jsdom, `LanguageProvider`):
  - `value="970436"` → nút `role="combobox"` tên "Ngân hàng" hiện `Vietcombank - …`.
  - Bấm nút → ô tìm có focus; gõ `vcb` → chỉ 1 `role="option"`; Enter → `onChange("970436")`, danh sách đóng.
  - Gõ `zzz` → hiện "Không tìm thấy ngân hàng".
  - ↓ ↓ Enter chọn dòng thứ 2 của danh sách đầy đủ. Esc đóng không đổi giá trị.
  Chạy → FAIL.

- [ ] **Step 4: Cài đặt `BankSelect.tsx`**: `Popover` (`@/components/ui/popover`). Trigger là `<Button variant="outline" role="combobox" id={id} aria-expanded aria-haspopup="listbox" className="h-11 w-full justify-between md:h-10">` (nhãn gắn qua `<Label htmlFor="bank-bin">` sẵn có). `PopoverContent` rộng bằng trigger (`w-[--radix-popover-trigger-width] p-0`): `Input` autoFocus (placeholder `t("bank_search_placeholder")`), `ul role="listbox" className="max-h-[50vh] overflow-y-auto"`, mỗi `li role="option" aria-selected` `min-h-11 md:min-h-9`. State `query`, `active` (index); ↑↓ đổi active + `scrollIntoView({ block: "nearest" })`; Enter chọn active; mở lại thì reset query. Key i18n mới: `bank_search_placeholder` ("Tìm ngân hàng…"/"Search bank…"), `bank_not_found` ("Không tìm thấy ngân hàng"/"No bank found").
  `BankAccountCard.tsx`: thay khối `<Select …>` bằng `<BankSelect id="bank-bin" value={bankBin} onChange={setBankBin} placeholder={t("bank")} />`; bỏ import Select nếu thừa.

- [ ] **Step 5:** test Task 3 PASS; `pnpm exec playwright test tests/e2e/tuition-notice.spec.ts` PASS (đang chọn `getByRole('combobox', { name: 'Ngân hàng' })` rồi `getByRole('option', { name: /^Vietcombank - / })`).

- [ ] **Step 6: Commit** `feat(s): ô chọn ngân hàng có tìm kiếm (không dấu, bí danh vcb/tcb, BIN)`

---

### Task 4: Lưu phiếu vào thư viện Ảnh (S3)

**Files:**
- Create: `src/components/tuition/NoticeImageViewer.tsx`
- Modify: `src/components/tuition/TuitionNoticeDialog.tsx:99-133`
- Test: `tests/unit/components/NoticeImageViewer.test.tsx`, thêm case vào test của `TuitionNoticeDialog` nếu có (không có thì tạo `tests/unit/components/TuitionNoticeDialog.test.tsx` mock `trpc.tuition.getNotice`, `useMediaQuery`, `@/lib/share-image`).

**Interfaces:**
- Produces: `<NoticeImageViewer blob: Blob, filename: string, title: string, onClose: () => void />`.

- [ ] **Step 1: Tests**
  - `NoticeImageViewer`: render với `blob` → có `<img>` `src` bắt đầu `blob:` (mock `URL.createObjectURL` trả `"blob:x"`), text `t("save_image_hint")`; `canShareFiles` mock true → có nút "Mở bảng chia sẻ", bấm → gọi `shareOrDownloadPng(blob, filename, title)`; false → không có nút. Bấm "Đóng" → `onClose`; unmount → `URL.revokeObjectURL("blob:x")`.
  - `TuitionNoticeDialog` mobile (`useMediaQuery` → false): blob chưa có → nút "Lưu ảnh" disabled; có blob → bấm mở viewer; desktop (true) → vẫn nút "Tải ảnh" gọi `saveAs`, không có "Lưu ảnh".
  Chạy → FAIL.

- [ ] **Step 2: Cài đặt viewer** — `Dialog` phủ kín (`DialogContent className="h-full w-full max-w-none bg-black p-0 sm:rounded-none"`, có `DialogTitle` ẩn `sr-only` = title). Thân: `<img src={url} alt={title} className="mx-auto max-h-[75vh] w-auto" />` (không `pointer-events-none`, không `user-select: none` — phải nhấn giữ được); dưới: `<p className="text-center text-sm text-white/80">{t("save_image_hint")}</p>`; nút "Mở bảng chia sẻ" (nếu `canShareFiles()`), nút "Đóng". `url` tạo bằng `useMemo(() => URL.createObjectURL(blob), [blob])`, `useEffect` cleanup revoke. Ghi chú 1 dòng: vì sao dùng `<img>` thật (menu nhấn giữ của trình duyệt lưu thẳng vào thư viện Ảnh).
  Key i18n: `save_image` ("Lưu ảnh"/"Save image"), `save_image_hint` ("Nhấn giữ ảnh → chọn Lưu vào Ảnh / Tải hình ảnh xuống"/"Press and hold the image → Save to Photos / Download image"), `open_share_sheet` ("Mở bảng chia sẻ"/"Open share sheet"), `close` (dùng key có sẵn nếu đã có).

- [ ] **Step 3: Dialog** — `TuitionNoticeDialog`: state `viewerOpen`. Footer: `isDesktop` → giữ nguyên nút "Tải ảnh"; mobile → nút chính "Lưu ảnh" (icon `ImageDown` từ lucide, cùng trạng thái loading/mờ như nút cũ) `onClick={() => blob && setViewerOpen(true)}`. Nút "Chia sẻ" giữ nguyên. Render `{viewerOpen && blob && <NoticeImageViewer … onClose={() => setViewerOpen(false)} />}`.

- [ ] **Step 4:** test Task 4 PASS; tsc, lint sạch.

- [ ] **Step 5: Commit** `feat(s): điện thoại lưu phiếu báo vào thư viện Ảnh (xem ảnh toàn màn hình, nhấn giữ lưu)`

---

### Task 5: ← → xem ca trong tháng (S4)

**Files:**
- Create: `src/components/sessions/SessionNavBar.tsx`
- Modify: `src/components/sessions/SessionDetailDialog.tsx` (Props dòng 48-60, header dòng ~234), `src/components/calendar/MonthCalendar.tsx:99-102, 276-283`
- Test: `tests/unit/components/SessionNavBar.test.tsx`

**Interfaces:**
- Consumes: `SessionListDTO` (có `sessionDate`, `startTime`).
- Produces: `sortSessions(list: SessionListDTO[]): SessionListDTO[]`; `<SessionNavBar siblings current onNavigate blocked />`; `SessionDetailDialog` props thêm `siblings?: SessionListDTO[]`, `onNavigate?: (s: SessionListDTO) => void`.

- [ ] **Step 1: Tests `SessionNavBar`** (3 ca giả, truyền **chưa sắp**: ngày 10 08:00, ngày 3 17:00, ngày 3 09:30):
  - current = ca ngày 3 17:00 → hiện `Ca 2/3`; bấm "Ca sau" → `onNavigate(ngày 10)`; bấm "Ca trước" → `onNavigate(ngày 3 09:30)`.
  - current = ca đầu → "Ca trước" disabled; current = ca cuối → "Ca sau" disabled.
  - `fireEvent.keyDown(window, { key: "ArrowRight" })` → onNavigate ca sau; `ArrowDown` cũng vậy; `ArrowLeft`/`ArrowUp` → ca trước.
  - keyDown ArrowRight với `target` là `<textarea>` / `<input>` / phần tử `role="combobox"` → **không** gọi.
  - `blocked = true` (hộp con đang mở) → phím không gọi.
  - Vuốt: `touchStart` x=200,y=100 → `touchEnd` x=100,y=110 → ca sau; dx < 60 hoặc |dy| > |dx| → không gọi.
  Chạy → FAIL.

- [ ] **Step 2: Cài đặt `SessionNavBar.tsx`**
```tsx
export function sortSessions(list: SessionListDTO[]): SessionListDTO[] {
  return [...list].sort((a, b) =>
    String(a.sessionDate).localeCompare(String(b.sessionDate)) || a.startTime.localeCompare(b.startTime) || a.id - b.id)
}

const TYPING = "input, textarea, select, [role=combobox], [contenteditable=true]"

// Phím mũi tên đổi ca, trừ khi đang gõ (ghi chú điểm danh) hoặc có hộp con mở.
```
`sessionDate` từ tRPC là chuỗi ISO (không transformer) — so chuỗi được; nếu là `Date` thì `toISOString()`. Nút `‹`/`›` (`ChevronLeft/Right`, `size-11 md:size-9`, `aria-label` `t("prev_session")`/`t("next_session")`), text giữa `t("session_position").replace("{i}", …).replace("{n}", …)` ("Ca {i}/{n}" / "Session {i}/{n}"). Lắng `keydown` trên `window` trong `useEffect`, bỏ qua khi `blocked` hoặc `(e.target as Element).closest?.(TYPING)`. Vuốt bắt trên chính thanh nav + vùng header (nhận `onTouchStart/End` qua wrapper).

- [ ] **Step 3: `SessionDetailDialog`** — thêm 2 props tuỳ chọn. `blocked = isAddStudentsOpen || isDuplicateDialogOpen || isMakeupOpen || isRestoreOpen || isDeleteDialogOpen`. Khi có `siblings && onNavigate && siblings.length > 1`: render `<SessionNavBar …/>` ngay trên `DialogHeader` (cả lúc loading, dùng `basicSession` làm current). Không truyền → không đổi gì (Dashboard, TodaySessions).

- [ ] **Step 4: `MonthCalendar`** — truyền `siblings={sessions}` (mảng đang vẽ lịch, đã theo bộ lọc; đổi kiểu cho khớp `SessionListDTO`) và `onNavigate={setSelectedSession}`; thêm `key={selectedSession.id}` cho `SessionDetailDialog` để mọi state nội bộ (ngày học bù, HS chọn, điểm danh) reset đúng ca mới. Ghi chú 1 dòng lý do `key`.

- [ ] **Step 5:** test Task 5 PASS; `pnpm test tests/unit/components` PASS (các test SessionDetailDialog/MonthCalendar sẵn có không vỡ); tsc, lint sạch. Key i18n: `prev_session`, `next_session`, `session_position`.

- [ ] **Step 6: Commit** `feat(s): chi tiết ca có ← → xem ca trước/sau trong tháng (Ca 12/60)`

---

### Task 6: Version 0.8.1, e2e, hồi quy

**Files:**
- Modify: `package.json` (`"version": "0.8.1"`)
- Create: `tests/e2e/s-sua-nhanh-ui.spec.ts`

- [ ] **Step 1: E2E** (đăng nhập `teacher`, dữ liệu tạo qua UI hoặc Prisma client test như các spec khác; tên có `Date.now()` để không trùng):
  - 1280px: tạo HS lớp 5 + ca hôm nay có HS đó → Lịch tháng: thẻ ca chứa `Lớp 5`.
  - 1280px: tạo 3 ca trong tháng hiện tại (giờ khác nhau) → mở ca đầu tiên của tháng trên lịch → thấy `Ca 1/` ; bấm "Ca sau" 2 lần → `Ca 3/`; nhấn phím `ArrowLeft` → `Ca 2/`.
  - 390px: Cài đặt → combobox "Ngân hàng" → gõ `vcb` → chỉ 1 option Vietcombank → chọn → tick đồng ý → Lưu → toast "Đã lưu tài khoản ngân hàng". Không tràn ngang.
  - 390px: mở phiếu báo học phí của HS có tiền (theo luồng `tuition-notice.spec.ts`) → bấm "Lưu ảnh" → thấy `img[src^="blob:"]` và dòng "Nhấn giữ ảnh". Không tràn ngang.
  - Dọn dữ liệu tạo ra ở `afterAll`.
- [ ] **Step 2:** `pnpm exec playwright test tests/e2e/s-sua-nhanh-ui.spec.ts tests/e2e/filter-bar-align.spec.ts tests/e2e/tuition-notice.spec.ts tests/e2e/calendar.spec.ts tests/e2e/mobile.spec.ts` PASS.
- [ ] **Step 3:** Version `0.8.1` trong `package.json`.
- [ ] **Step 4: Hồi quy toàn bộ** — `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (seed trước e2e: `pnpm test tests/integration/plan-launch-migration.test.ts`), `pnpm exec playwright test` full. Nếu e2e gặp lỗi dữ liệu test đã biết (plan-locks/teacher_std, rate limit đăng nhập cuối lượt) → chạy lại riêng file đó và ghi rõ trong báo cáo.
- [ ] **Step 5: Commit** `chore(s): nâng version 0.8.1, e2e sửa nhanh giao diện`
- [ ] **Step 6:** Viết báo cáo `.superpowers/gehihi/bao-cao-S.md` (commit list, kết quả test, rulings) và ghi `DONE S` vào `.superpowers/gehihi/kenh.md`.
