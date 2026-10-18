# AR — Dọn lỗi nhỏ + bộ lọc Tài khoản 0.26.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Màn `/admin/accounts` có tìm theo tên đăng nhập/họ tên, lọc khoảng ngày tạo, sắp Mới nhất/Cũ nhất; sửa 11 lỗi nhỏ đã chốt; phát hành `0.26.0`.

**Architecture:** Bộ lọc thuần client trên `admin.overview.users` (đã trả đủ danh sách), tách hàm lọc thuần `filterAccounts` để unit test. Các lỗi nhỏ sửa tại chỗ, mỗi task một nhóm file độc lập, test đỏ trước.

**Tech Stack:** Next.js 15, React 19, tRPC v11, Prisma 5 (không migration), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-ar-don-loi-nho-loc-tai-khoan-design.md`

## Global Constraints

**Nhánh, version**
- Worktree `D:\APINODEJS\student-managerment-otd`, nhánh `fix/ar-don-loi-nho-loc-tk` tạo từ `main` 313959c. Commit đầu `[AR] Spec và plan`: chép 2 file spec + plan từ thư mục chính.
- Version cuối `0.26.0`. **Không migration, không lệnh prisma ghi DB, không cài/nâng thư viện, không đổi API server** (trừ D3 là tuỳ chọn transaction).

**Chạy lệnh**
- Không `pnpm build` / `pnpm dev` thủ công. Test chỉ với `.env.test` (localhost:5433). Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.
- Test 3 tầng: mỗi task chỉ test của task + `pnpm exec tsc --noEmit` + `pnpm lint`; full `pnpm test` và full e2e 2 nửa **chỉ 1 lần ở Task 8**.
- Khoá test `D:\APINODEJS\student-managerment\.superpowers\test-lock.txt` trước mọi `pnpm test …` / `pnpm exec playwright test …`.
- e2e: RAM ≥ 3000 MB, foreground, seed trước bằng `pnpm test tests/integration/plan-launch-migration.test.ts`, chỉ dừng PID mình tạo, tắt dev server cổng 3000 khi xong.

**Chữ và giao diện**
- Chữ mới qua i18n `src/language/vi.json` + `en.json` cùng bộ key. Không dùng gạch dài (—, –) trong chữ hiển thị.
- Màu A3 (teal `primary`, slate). Vùng chạm ≥ 44px trên mobile. Mobile-first: chụp 375 trước, tự mở ảnh xem, ghi tên ảnh vào ledger.

**Commit**
- Commit 1 dòng `[AR] …`, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do.
- Mỗi task: test xanh + tsc + lint sạch → commit → ledger `.superpowers/sdd/2026-10-12-ar-don-loi-nho-loc-tai-khoan/progress.md` → PROGRESS lên kênh.
- **Không xoá / nới test cũ để qua.** Đổi kỳ vọng test cũ chỉ khi đúng hành vi mới, ghi Ruling.

## Review Focus

1. **Tài khoản tạo lúc 0h–7h sáng giờ VN bị lọc lệch ngày** (so UTC). Test: Task 1 "createdAt 2026-10-11T18:30Z thuộc ngày 12/10 VN".
2. **Tài khoản `fullName` null** làm tìm kiếm văng lỗi. Test: Task 1 "fullName null vẫn tìm theo username".
3. **Đang ở trang 3 rồi gõ tìm → trang trống** (không về trang 1 khi số dòng không đổi). Test: Task 1 "đổi sắp xếp về trang 1".
4. **Ô tiền gõ tiếp sau khi đã có dấu chấm** ra số sai (vd `1.000` + `5` → `1` hoặc `10005`?). Test: Task 5 "gõ 1000 rồi 5 → 10.005 và onChange(10005)".
5. **Ảnh phiếu học phí tải về đổi kích thước** khi bỏ width cố định. Test: Task 2 kiểm thẻ trong `TuitionNoticeDialog` vẫn rộng 360px.

## Bên thực thi

- **Claude-OTD làm Task 1 → 8**, tuần tự. Luật: `.superpowers/claude-otd/CLAUDE-OTD.md`. Báo cáo cuối: `D:\APINODEJS\student-managerment\.superpowers\claude-otd\bao-cao-AR.md`.

---

### Task 1: Bộ lọc màn Tài khoản

**Files:**
- Create: `src/components/admin/account-filter.ts`
- Modify: `src/components/admin/AdminAccounts.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/account-filter.test.ts` (mới), `tests/unit/components/AdminAccounts.test.tsx`, `tests/e2e/ar-loc-tai-khoan.spec.ts` (mới)

**Interfaces:**
- Produces:
```ts
export type AccountSort = "newest" | "oldest"
export type AccountFilter = { search: string; from: string | null; to: string | null; sort: AccountSort } // from/to: "yyyy-MM-dd"
export const DEFAULT_ACCOUNT_FILTER: AccountFilter
export function filterAccounts<T extends { id: number; username: string; fullName: string | null; createdAt: Date | string }>(rows: T[], f: AccountFilter): T[]
```

- [ ] **Step 1: Test đỏ hàm thuần** `tests/unit/components/account-filter.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { DEFAULT_ACCOUNT_FILTER as D, filterAccounts } from "@/components/admin/account-filter"

const rows = [
  { id: 1, username: "hien_admin", fullName: "Admin", createdAt: new Date("2026-09-26T03:00:00Z") },
  { id: 2, username: "Suiuoi", fullName: "Ms Ly", createdAt: new Date("2026-05-05T03:00:00Z") },
  { id: 3, username: "qa_test", fullName: null, createdAt: new Date("2026-10-11T18:30:00Z") }, // 12/10 01:30 VN
  { id: 4, username: "ngominhnhat", fullName: "Ngô Minh Bình", createdAt: new Date("2026-06-12T03:00:00Z") },
]
const ids = (r: { id: number }[]) => r.map((x) => x.id)

describe("filterAccounts", () => {
  it("mặc định sắp mới nhất trước", () => expect(ids(filterAccounts(rows, D))).toEqual([3, 1, 4, 2]))
  it("Cũ nhất", () => expect(ids(filterAccounts(rows, { ...D, sort: "oldest" }))).toEqual([2, 4, 1, 3]))
  it("tìm theo username, không phân biệt hoa thường, bỏ khoảng trắng 2 đầu", () =>
    expect(ids(filterAccounts(rows, { ...D, search: "  SUIU " }))).toEqual([2]))
  it("tìm theo họ tên có dấu", () => expect(ids(filterAccounts(rows, { ...D, search: "minh bình" }))).toEqual([4]))
  it("fullName null vẫn tìm theo username", () => expect(ids(filterAccounts(rows, { ...D, search: "qa_" }))).toEqual([3]))
  it("khoảng ngày bao 2 đầu, theo ngày VN", () => {
    expect(ids(filterAccounts(rows, { ...D, from: "2026-10-12", to: "2026-10-12" }))).toEqual([3])
    expect(ids(filterAccounts(rows, { ...D, from: "2026-06-12", to: "2026-09-26" }))).toEqual([1, 4])
  })
  it("chỉ Từ ngày hoặc chỉ Đến ngày", () => {
    expect(ids(filterAccounts(rows, { ...D, from: "2026-09-01" }))).toEqual([3, 1])
    expect(ids(filterAccounts(rows, { ...D, to: "2026-06-12" }))).toEqual([4, 2])
  })
  it("Từ > Đến ra rỗng, không lỗi", () => expect(filterAccounts(rows, { ...D, from: "2026-10-01", to: "2026-09-01" })).toEqual([]))
})
```

- [ ] **Step 2:** `pnpm test tests/unit/components/account-filter.test.ts` → FAIL (module chưa có).

- [ ] **Step 3: Viết `account-filter.ts`** — dùng `normalizeForSearch` (`@/lib/name-search`) và `vnDayKey` (`@/lib/activity`, kiểm định dạng trả về là `yyyy-MM-dd`; nếu khác thì tự tính ngày VN bằng `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })`, ghi Ruling). Sắp theo `createdAt` rồi `id` cùng chiều. Không sửa mảng gốc.

- [ ] **Step 4:** chạy lại → PASS.

- [ ] **Step 5: Gắn vào `AdminAccounts.tsx`** (chỉ tab Đang dùng):
  - `const [filter, setFilter] = useState(DEFAULT_ACCOUNT_FILTER)`; `const rows = useMemo(() => filterAccounts(query.data?.users ?? [], filter), [query.data, filter])`; truyền `rows` vào `usePagination`.
  - Mọi lần đổi filter gọi `setCurrentPage(1)` (usePagination chỉ tự về trang 1 khi số dòng đổi, đổi sắp thì không).
  - `<FilterBar search={…} primaryFilter={<Select sort…/>} filters={<2 ô date có Label/>} activeChips={…} onClearAll={…} />` giữa tablist và bảng. Ô Select rộng theo chữ, `h-11 md:h-10`.
  - `emptyText`: rỗng do lọc → `t("admin_accounts_no_match")`, chưa có dữ liệu → giữ "-".
  - Key i18n mới (vi / en): `admin_accounts_search` "Tìm tên đăng nhập hoặc họ tên" / "Search username or full name"; `admin_sort_newest` "Mới nhất" / "Newest"; `admin_sort_oldest` "Cũ nhất" / "Oldest"; `admin_created_from` "Tạo từ ngày" / "Created from"; `admin_created_to` "Đến ngày" / "Created to"; `admin_chip_from` "Từ {date}" / "From {date}"; `admin_chip_to` "Đến {date}" / "To {date}"; `admin_accounts_no_match` "Không có tài khoản phù hợp" / "No matching accounts". Kiểm key trùng sẵn có trước khi thêm.

- [ ] **Step 6: Unit component** thêm vào `AdminAccounts.test.tsx` (theo mock trpc sẵn có của file): gõ "suiu" → còn 1 dòng; dòng đầu mặc định là tài khoản `createdAt` mới nhất; đang ở trang 2 (25 dòng, pageSize 20) đổi Sắp xếp → về trang 1; lọc không khớp → thấy "Không có tài khoản phù hợp". Chạy đỏ trước khi gắn (nếu đã gắn ở Step 5 thì viết test trước Step 5).

- [ ] **Step 7: e2e** `tests/e2e/ar-loc-tai-khoan.spec.ts`, đăng nhập admin như `admin-accounts.spec.ts`, 2 khổ 375 + 1280:
  - Tạo 1 tài khoản mới qua luồng đăng ký hoặc helper sẵn có (theo `admin-accounts.spec.ts`), tên `e2e_ar_<stamp>`.
  - Dòng/thẻ đầu tiên là tài khoản vừa tạo (Mới nhất mặc định).
  - Gõ `e2e_ar_<stamp>` → chỉ 1 dòng; xoá ô tìm → đủ lại.
  - Chọn Cũ nhất → tài khoản vừa tạo không còn ở trang 1 (khi > 20 tài khoản) hoặc nằm cuối.
  - `document.documentElement.scrollWidth <= clientWidth`.
  - Chụp `.superpowers/mockups/aj/that-ar/loc-tai-khoan-{375,1280}.png` + `loc-tai-khoan-sheet-375.png` (sheet Lọc mở), tự xem.

- [ ] **Step 8:** test task + tsc + lint → commit `[AR] Bộ lọc tìm, ngày tạo, sắp xếp ở màn Tài khoản`.

---

### Task 2: Hiển thị điện thoại (A1 phiếu học phí, A2 tên môn, A3 nút X)

**Files:**
- Modify: `src/components/tuition/TuitionNoticeCard.tsx:69`, `src/components/subjects/SubjectList.tsx:67`, `src/components/ui/dialog.tsx:49-52`, `src/components/ui/sheet.tsx:73-76`
- Test: unit sẵn có của các component (tìm trong `tests/unit/components/`), e2e trang phụ huynh (tìm spec `/p/` sẵn có, vd theo `an-nguoi-tra`)

- [ ] **A1.** Test đỏ: e2e trang phụ huynh 360px — `scrollWidth <= clientWidth`, thẻ phiếu cách mép ≥ 16px 2 bên (mẫu e2e `an-nguoi-tra` của PlaceNoticeCard). Sửa: bỏ `style={{ width: 360 }}`, thêm `w-full max-w-[360px]` ở variant default; bỏ khung cuộn ngang bao ngoài ở `ParentView` nếu có (như AN đã làm với PayerView). **Kiểm `TuitionNoticeDialog`:** ảnh tải về phải giữ rộng 360px — nếu dialog dựa vào width cố định để chụp ảnh thì bọc thẻ trong khung `w-[360px]` ở dialog. Unit/e2e kiểm thẻ trong dialog rộng 360. Ảnh `that-ar/phieu-phu-huynh-{360,375}.png`.
- [ ] **A2.** Test đỏ (unit SubjectList): tên 60 ký tự không có class `truncate`, có `break-words`. Sửa cùng kiểu FIX AL của PlaceList (`git log --oneline -- src/components/places/PlaceList.tsx` để xem). Ảnh `that-ar/mon-hoc-375.png` với tên dài.
- [ ] **A3.** Test đỏ (unit cho `DialogContent` và `SheetContent`): nút Close có class `size-11` (và `md:size-9`). Sửa: nút `absolute right-2 top-2 flex size-11 items-center justify-center md:right-3 md:top-3 md:size-9`, icon giữ `h-4 w-4`, giữ `sr-only`. Chụp 1 hộp (vd Thêm học sinh) + 1 sheet (Chi tiết học phí) ở 375: X không đè tiêu đề. Nếu có hộp nào tiêu đề bị X đè, thêm `pr-10` cho header của hộp đó, ghi vào ledger.
- [ ] test task + tsc + lint → commit `[AR] Phiếu học phí, tên môn, nút đóng vừa ngón tay trên điện thoại`.

---

### Task 3: Escape đóng sheet Chi tiết học phí từ Dashboard (B1)

**Files:** tìm theo dấu vết; test `tests/e2e/dashboard-alerts.spec.ts:59`.

- [ ] **Step 1:** chạy riêng `pnpm exec playwright test tests/e2e/dashboard-alerts.spec.ts` → xác nhận đỏ ở bước Escape (ghi lỗi nguyên văn vào ledger).
- [ ] **Step 2:** dùng superpowers:systematic-debugging. Gợi ý chỗ xem: sheet được mở khi điều hướng từ Dashboard sang `/tuition?…` (sheet mở theo query string) — Escape có thể đóng sheet nhưng effect đọc query mở lại; hoặc focus không nằm trong sheet nên Radix không nhận Escape; hoặc `onEscapeKeyDown`/`onInteractOutside` bị chặn ở `sheet.tsx`. Ghi giả thuyết + bằng chứng vào ledger.
- [ ] **Step 3:** sửa gốc trong code app (unit đỏ trước nếu tái hiện được ở unit). Nếu gốc là test sai: sửa test, ghi `Task 3: Ruling: …` kèm bằng chứng.
- [ ] **Step 4:** chạy file e2e 2 lần liền xanh → commit `[AR] Escape đóng sheet học phí mở từ Dashboard`.

---

### Task 4: Ghi chú gửi 2 lần (B2) + tour/Có gì mới (B3)

**Files:**
- Modify: `src/components/tuition/TuitionDetailSheet.tsx` (quanh `handleBlurNotes`, dòng ~517), `src/components/tour/TourRunner.tsx:44`, `src/components/whats-new/WhatsNew.tsx:33`, chỗ xử lý `nextTour` (`tour-controller.ts` / `TourRunner.tsx`)
- Test: unit sẵn có của các file này

- [ ] **B2.** Test đỏ: gõ ghi chú → blur → bấm X ngay → mutation lưu ghi chú gọi đúng 1 lần. Sửa: nhớ giá trị đã lưu gần nhất (ref) và bỏ qua lần gửi khi giá trị không đổi / đang gửi cùng giá trị.
- [ ] **B3a.** Test đỏ: có `[role="alertdialog"][data-state="open"]` → tour không chạy / Có gì mới không tự mở. Sửa: selector `'[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'` (gom 1 hằng dùng chung nếu cả 2 file cùng import được, không thì sửa 2 chỗ).
- [ ] **B3b.** Test đỏ: tour A kết thúc có `nextTour` B → trong lúc chuyển, cờ đang chạy tour (`tourActive` hoặc tên thật trong code) vẫn `true`, WhatsNew không mở; B xong mới tắt. Sửa tối thiểu tại chỗ tắt cờ.
- [ ] test task + tsc + lint → commit `[AR] Ghi chú không gửi 2 lần, tour không bị Có gì mới chen`.

---

### Task 5: Ô tiền dấu chấm kiểu VN (C1)

**Files:**
- Modify: `src/components/ui/currency-input.tsx`
- Test: `tests/unit/components/currency-input.test.tsx` (tạo nếu chưa có) + mọi test đang kỳ vọng `,` trong ô tiền (`grep -rn "000,\|,000" tests/`)

- [ ] **Step 1: Test đỏ:**

```tsx
it("hiện 185.000 kiểu VN", () => { render(<CurrencyInput value={185000} onChange={() => {}} aria-label="tien" />); expect(screen.getByLabelText("tien")).toHaveValue("185.000") })
it("gõ 1000 rồi 5 → 10.005", async () => {
  const onChange = vi.fn()
  function W() { const [v, setV] = useState<number | undefined>(); return <CurrencyInput value={v} onChange={(n) => { setV(n); onChange(n) }} aria-label="tien" /> }
  render(<W />); await userEvent.type(screen.getByLabelText("tien"), "10005")
  expect(screen.getByLabelText("tien")).toHaveValue("10.005"); expect(onChange).toHaveBeenLastCalledWith(10005)
})
it("xoá hết → undefined", …)
```

- [ ] **Step 2:** FAIL. **Step 3:** `format` dùng `toLocaleString("vi-VN")` (kiểm Node trả dấu chấm; nếu môi trường thiếu ICU thì tự chèn dấu chấm bằng regex, ghi Ruling); `handleChange` bỏ mọi ký tự không phải số `replace(/\D/g, "")`.
- [ ] **Step 4:** chạy test ô tiền + mọi test liên quan 10 chỗ dùng (`AdminPrices`, `TrialDaysDialog`, `TrialDaysForm`, `PlaceFormDialog`, `AttendancePanel`, `StudentFormDialog`, `PlacePaymentDialog`, `PayBlock`, `PaymentFormDialog`) và e2e nào `fill` ô tiền rồi kỳ vọng chữ có dấu phẩy. Đổi kỳ vọng `,` → `.`, ghi Ruling. Chú ý `TrialDaysDialog/Form` là số ngày (nhỏ, không có dấu nghìn) — kiểm không vỡ.
- [ ] commit `[AR] Ô nhập tiền dùng dấu chấm nghìn`.

---

### Task 6: Kỹ thuật nhỏ (D3 transaction góp ý, D4 css.d.ts)

- [ ] **D3.** `feedback.service.ts:18` `db.$transaction(async (tx) => …, TX_OPTIONS)` — import `TX_OPTIONS` từ `payment.service.ts` nếu không tạo vòng import; vòng thì khai báo `{ maxWait: 10_000, timeout: 10_000 }` tại chỗ kèm ghi chú 1 dòng. Test: unit/integration feedback sẵn có xanh (thay đổi cấu hình, không cần test đỏ; ghi Ruling).
- [ ] **D4.** `src/types/css.d.ts` → `declare module "driver.js/dist/driver.css"`. `pnpm exec tsc --noEmit` sạch (nếu `globals.css` import tĩnh báo lỗi kiểu thì Next đã có khai báo riêng — kiểm, không thêm lại `*.css`).
- [ ] tsc + lint + test feedback → commit `[AR] Transaction góp ý 10s, thu hẹp khai báo css`.

---

### Task 7: e2e lúc đỏ lúc xanh (D1 filter-bar-align, D2 auth.spec:107)

- [ ] **Step 1:** chạy `pnpm exec playwright test tests/e2e/filter-bar-align.spec.ts tests/e2e/auth.spec.ts --repeat-each=3` (và chạy kèm vài spec đứng trước chúng trong lô full e2e để tái hiện). Ghi tỉ lệ đỏ + lỗi nguyên văn.
- [ ] **Step 2:** systematic-debugging. Gợi ý: `filter-bar-align` lần đầu về `/login?expired=1` → session/cookie epoch cũ do spec trước (vd `auth.spec` đổi epoch/cookie hoặc dev server biên dịch lần đầu); `boundingBox()` null khi trang chưa render xong → chờ phần tử `toBeVisible` trước khi đo. `auth.spec:107` có thể đua với redirect/biên dịch trang `/students` lần đầu.
- [ ] **Step 3:** sửa gốc (ưu tiên sửa test chờ đúng điều kiện; không thêm `waitForTimeout` cố định; không `test.retry`). Ghi Ruling.
- [ ] **Step 4:** `--repeat-each=3` 2 file xanh hết → commit `[AR] Ổn định e2e filter-bar-align và auth`.

---

### Task 8: Phát hành 0.26.0 + full test

- [ ] `package.json` → `0.26.0`. `src/lib/releases.ts` thêm mục 0.26.0 (theo mẫu mục trước, `notify` như các đợt dọn lỗi): vi "Ô nhập tiền dùng dấu chấm (185.000); phiếu học phí trang phụ huynh vừa màn điện thoại; tên môn dài hiện đủ; nút đóng hộp dễ bấm hơn; sửa vài lỗi nhỏ." — mục admin (bộ lọc Tài khoản) chỉ ghi nếu mẫu releases có phần dành cho admin; không thì bỏ khỏi note giáo viên. Bản en tương ứng.
- [ ] Full `pnpm test` (redirect ra file, đọc đuôi) + full e2e 2 nửa. Kỳ vọng: không còn đỏ `dashboard-alerts:59`, `filter-bar-align`, `auth.spec:107`. Đỏ nào khác: chạy lại riêng, ghi rõ.
- [ ] commit `[AR] Phát hành 0.26.0` → viết `bao-cao-AR.md` (mỗi task: commit, test, Ruling, ảnh đã xem; câu hỏi nếu có) → DONE AR lên kênh. **Không merge, không push.**
