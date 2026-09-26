# A3 — Làm mới phong cách (màu, thẻ, bo góc, điều hướng) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi toàn app sang 1 màu nhấn `#0F766E`, thẻ trắng viền 1px bo 14px không bóng, font Geist, và điều hướng mới (sidebar có nhóm "Quản lý", tab "Thêm" mở bottom sheet trên mobile, menu avatar gọn lại), không đổi nghiệp vụ/route/dữ liệu.

**Architecture:** Token màu/bo góc/font đặt một chỗ (`globals.css` + `tailwind.config.ts`) để primitive shadcn tự ăn theo; màn chỉ sửa chỗ gắn màu tay (indigo/violet/purple, màu icon, màu giá trị). Điều hướng: `nav-items.ts` thêm `MANAGE_ITEMS`, `MORE_ITEMS`, `isMoreActive`; `BottomTabBar` còn 4 link + nút "Thêm" mở `MoreSheet` (MỚI, dùng `Sheet` sẵn có).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 3.4, shadcn/ui (Radix), lucide-react 1.11, Vitest 4 (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-a3-lam-moi-phong-cach-design.md` (đọc kỹ mục 5 và mục 10 D1–D10)

**Mockup (nguồn sự thật giao diện, chỉ để nhìn):** `C:\Users\NGO QUANG HIEN\AppData\Local\Temp\claude\D--APINODEJS-student-managerment\b89357e3-1f9d-4ec4-88fd-c36d505d9632\scratchpad\a3-remote\project\` — `Main`, `DashboardMobile`, `TuitionMobile`, `MoreSheetMobile`, `StyleGuide` (`.dc.html`). Màu nhấn chốt `#0F766E` ở mọi nơi (bỏ qua các lựa chọn `#4338CA`/`#1D4ED8`/`#C2410C` trong thanh chỉnh của mockup).

## Global Constraints

- **Không migration, không đổi schema Prisma, không thêm dependency.** Màu môn học (`Subject.color`, `SUBJECT_COLORS`, `subject-defaults.ts`, `@default("#4F46E5")`) giữ nguyên (D2). Hằng `COLORS` trong `src/lib/constants.ts` không đụng.
- Không đổi logic nghiệp vụ, route, dữ liệu. `TuitionNoticeCard.tsx` không sửa (ảnh phiếu gửi Zalo). Màu cấp học tiểu học/THCS và màu điểm danh giữ nguyên (D5). Màu `destructive` (nút xoá, "Đăng xuất" đỏ) giữ nguyên.
- Không làm dark mode (D1). Không đổi `ui/button.tsx`, `ui/badge.tsx`, `ui/sheet.tsx`. Chiều cao nút giữ `h-11 md:h-10` ở màn, primitive `h-10` (D9).
- Bảng màu (hex chốt): nền trang `#F6F7F9`, thẻ `#FFFFFF`, viền `#E7E9EE`, chữ chính `#111827`, chữ phụ `#6B7280`, nhấn `#0F766E`, nợ `#B42318` / `#FEF3F2`, đã đủ `#067647` / `#ECFDF3`. Đỏ nợ chỉ dùng cho tiền nợ và trạng thái nợ.
- Vùng chạm tối thiểu 44px trên mobile (`size-11`, `h-11`, mục sheet `min-h-14`). Viewport kiểm thử mobile 390×844, breakpoint `md`.
- i18n: `src/language/vi.json` và `en.json` phải cùng bộ key (hiện 398 key mỗi file; sau A3 là 404).
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy.
- **AN TOÀN DB:** trước mọi lệnh chạy test đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` KHÁC `.env.test`. `.env` = PRODUCTION (Neon, host `ep-polished-voice…`) — **không bao giờ sửa/ghi `.env`**, chỉ được đọc host để so sánh. `.env.test` = Postgres local Docker `localhost:5433`. Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) đều chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người dùng.
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push --force-reset`, `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod). Build kiểm tra bằng `pnpm exec next build`.
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **E2E:** chạy bằng cấu hình mặc định `playwright.config.ts` (cổng 3000, tự khởi `pnpm dev` với `DATABASE_URL` của `.env.test`, `reuseExistingServer: false`): `pnpm exec playwright test <file>`. Nếu cổng 3000 đang bận → không tắt tiến trình đó, DỪNG và báo người dùng. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript` như các spec sẵn có. `ResponsiveList` render cả bảng lẫn thẻ → lọc phần tử visible hoặc dùng test id.
- Không nhập mật khẩu/credential vào trình duyệt ngoài tài khoản seed `teacher` của DB test; không thao tác ghi trên production.
- Làm trên nhánh `feat/a3-phong-cach` (không bao giờ commit lên `main`). **Agent thực hiện task KHÔNG merge, KHÔNG push** (người điều phối làm sau review cuối).
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit. Commit message kết thúc bằng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Không đụng file untracked của người khác trong `.superpowers/`.

## Điều chỉnh so với spec

1. **Giá trị HSL của token lấy 1 chữ số thập phân** (vd `--primary: 175.3 77.4% 26.1%`) thay vì bảng HSL làm tròn ở spec 5.1. Lý do: HSL làm tròn của spec cho ra `rgb(15,117,109)` (≠ `#0F766E`), trong khi spec mục 8 kiểm `background-color = rgb(15, 118, 110)`. Giá trị mới đổi ngược đúng từng hex trong bảng (unit test Task 1 kiểm). Tỉ lệ tương phản không đổi (chữ phụ/nền trang ≈ 4.51, đạt).
2. **Trạng thái mở của sheet "Thêm" gắn với `pathname`** (`openAt === pathname`) thay vì `useState<boolean>`: đổi route bằng nút Back khi sheet đang mở thì sheet tự đóng. Vẫn giữ `onOpenChange(false)` trong `onClick` từng mục như spec (cần khi bấm mục trỏ tới đúng trang đang đứng).
3. **Thêm 1 unit test quét `src/`** (`tests/unit/theme-legacy-colors.test.ts`) thay cho lệnh grep thủ công ở spec 5.5, để "không còn indigo/violet/purple" được kiểm mỗi lần chạy `pnpm test`.
4. `ParentView.tsx`: ngoài đổi indigo như spec, đổi nền `bg-slate-50` → `bg-page` (spec mục 2 gồm cả trang phụ huynh; đây là chỗ nền trang thứ 4 ngoài 3 chỗ spec liệt kê).
5. `AppHeader`: thêm `min-w-0` cho khối lời chào (nút ngôn ngữ/avatar to lên 44px, tên dài phải cắt thay vì đẩy tràn); avatar hover `hover:bg-[#E5E7EB]` (spec không ghi màu hover, bỏ indigo cũ).
6. Nút "Ghi nhận" (`payButton`) đổi variant theo trạng thái ở **cả bảng desktop lẫn thẻ mobile** vì hai nơi dùng chung hàm `payButton` (spec chỉ nhắc thẻ mobile).
7. `tailwind.config.ts` giữ nguyên `darkMode: ["class"]` (vô hại khi không còn khối `.dark`; không nằm trong yêu cầu).
8. Spec và plan A3 đang là file untracked trên `main` → Task 1 commit chúng lên nhánh feature trước khi code.

## Review Focus

1. **Đang mở sheet "Thêm" thì bấm Back của trình duyệt/Android** → route đổi, sheet phải tự đóng (không treo lớp phủ trên trang mới). Pin: unit test Task 2 "đổi pathname thì sheet tự đóng".
2. **Đóng sheet bằng Escape / nút X** → sheet đóng, không điều hướng, nút "Thêm" không bị kẹt trạng thái mở (bấm lại mở được). Pin: unit test Task 2 "Escape đóng sheet, bấm Thêm mở lại được".
3. **Tên giáo viên rất dài trên header 390px** (nút ngôn ngữ và avatar giờ 44px) → lời chào cắt `…`, không tràn ngang. Pin: Task 3 thêm `min-w-0`; e2e Task 3 kiểm `expectNoHorizontalScroll` ở `/dashboard` sau khi đổi header (tên seed ngắn, nên review cuối đọc code chắc chắn có `min-w-0 truncate`).
4. **Máy đặt chế độ tối hệ điều hành** → toast vẫn sáng (không có `ThemeProvider`, D1). Pin: Task 1 bước grep `theme="light"` trong `layout.tsx`; kiểm tay ở Task 7.
5. **Số tiền 9 chữ số với Geist ở thẻ học phí mobile (17px semibold) + 2 nút** → không tràn thẻ ở 390px; nhãn tiếng Anh ở tab bar (`Dashboard`, `Calendar`, `Students`, `Tuition`, `More`) cắt `truncate`, không tràn. Pin: `layout-desktop.spec.ts` (thẻ số liệu 100.000.000 đ, chạy lại Task 5/7) + kiểm tay Task 7 bước so mockup (đổi ngôn ngữ EN).

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `src/app/globals.css` | Sửa | Token mới, xoá `.dark`, ô "hôm nay" lịch dùng màu nhấn | 1 |
| `tailwind.config.ts` | Sửa | Màu `page`/`debt`/`success`, bo góc theo token, font Geist | 1 |
| `src/components/ui/card.tsx` | Sửa | Bỏ `shadow-sm` | 1 |
| `src/app/layout.tsx` | Sửa | `Toaster theme="light"` | 1 |
| `tests/unit/lib/theme-contrast.test.ts` | Mới | Bảng màu đúng hex + tương phản ≥ 4.5 + cấu hình tailwind | 1 |
| `src/components/layout/nav-items.ts` | Sửa | `NavItem`, `MANAGE_ITEMS`, `MORE_ITEMS`, `isMoreActive` | 2 |
| `src/components/layout/MoreSheet.tsx` | Mới | Bottom sheet "Thêm" (Báo cáo, Môn học, Cài đặt) | 2 |
| `src/components/layout/BottomTabBar.tsx` | Sửa | 4 link + nút "Thêm", vạch active | 2 |
| `src/language/vi.json`, `en.json` | Sửa | 6 key mới | 2 |
| `tests/unit/layout/nav-items.test.ts` | Mới | `isMoreActive`, danh sách mục | 2 |
| `tests/unit/components/BottomTabBar.test.tsx` | Mới | Tab bar + sheet | 2 |
| `tests/e2e/mobile.spec.ts` | Sửa | Tab mới, sheet Thêm (Task 2); menu avatar (Task 3) | 2, 3 |
| `tests/e2e/subjects.spec.ts`, `tuition-notice.spec.ts` | Sửa | Vào Môn học/Cài đặt qua sheet Thêm | 2 |
| `src/components/layout/AppSidebar.tsx` | Sửa | Sidebar 232px, logo mới, nhóm "Quản lý" | 3 |
| `src/components/layout/AppHeader.tsx` | Sửa | Kích thước header/nút, bỏ Môn học/Cài đặt khỏi menu avatar | 3 |
| `src/components/layout/AppLayout.tsx` | Sửa | `bg-page` | 3 |
| `tests/unit/components/AppSidebar.test.tsx` | Mới | Nhóm Quản lý, `aria-current` | 3 |
| `tests/e2e/layout-desktop.spec.ts` | Sửa | Sidebar 1280px (Task 3); màu nút "Tạo ca dạy" (Task 6) | 3, 6 |
| `src/components/tuition/TuitionStatusBadge.tsx` | Sửa | Màu 3 nhóm trạng thái | 4 |
| `src/app/(app)/tuition/page.tsx` | Sửa | Màu số tiền thẻ mobile, variant nút Ghi nhận, bỏ viền slate | 4 |
| `src/components/tuition/TuitionDetailSheet.tsx` | Sửa | Nợ cũ / còn nợ `text-debt` | 4 |
| `tests/unit/components/TuitionStatusBadge.test.tsx` | Mới | | 4 |
| `tests/unit/components/TuitionPageMobileCard.test.tsx` | Sửa | Thêm test màu số tiền + variant nút | 4 |
| `tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx` | Sửa | Thêm test dòng còn nợ `text-debt` | 4 |
| `src/components/common/StatCard.tsx`, `PageHeader.tsx`, `ResponsiveList.tsx` | Sửa | Kiểu chữ/token | 5 |
| `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/reports/page.tsx` | Sửa | Icon/giá trị thẻ số liệu | 5 |
| `src/components/dashboard/DashboardAlerts.tsx`, `TodaySessions.tsx` | Sửa | Badge đếm, tiền nợ, icon, viền | 5 |
| `tests/unit/components/DashboardPage.test.tsx`, `DashboardAlerts.test.tsx` | Mới | | 5 |
| Lịch, học sinh, môn học, phiên dạy, báo cáo, phụ huynh, login/register (14 file, xem Task 6) | Sửa | Thay indigo → màu nhấn, bỏ bóng | 6 |
| `tests/unit/theme-legacy-colors.test.ts` | Mới | Quét `src/` không còn indigo/violet/purple | 6 |

---

### Task 1: Nhánh + token màu, bo góc, font, Card, Toaster

**Đọc trước:** Global Constraints; spec mục 5.1, 5.2, 5.3, 8 (Unit, theme-contrast), 10 (D1, D3, D4); `docs/coding-rule.md` §6.1.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `src/components/ui/card.tsx:12`
- Modify: `src/app/layout.tsx:38`
- Test (Mới): `tests/unit/lib/theme-contrast.test.ts`

**Interfaces:**
- Consumes: không.
- Produces (các task sau dùng class Tailwind này): `bg-page`, `text-debt`, `bg-debt-soft`, `text-success`, `bg-success-soft`, `bg-primary/[0.08]`, `text-primary`, `ring-primary`, `text-muted-foreground`, `text-foreground`; `rounded-lg` = `rounded-xl` = 14px, `rounded-md` = 10px, `rounded-sm` = 8px; `font-sans` = Geist, `font-mono` = Geist Mono.

- [ ] **Step 0: Tạo nhánh, commit spec + plan**

```bash
git checkout main
git status --short
git checkout -b feat/a3-phong-cach
git add docs/superpowers/specs/2026-09-26-a3-lam-moi-phong-cach-design.md docs/superpowers/plans/2026-09-26-a3-lam-moi-phong-cach.md
git commit -m "docs(a3): spec + plan làm mới phong cách

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

Nếu nhánh `feat/a3-phong-cach` đã có thì `git checkout feat/a3-phong-cach` và bỏ qua lệnh commit docs nếu đã commit. Xác nhận phụ thuộc đã merge: `git log --oneline -1 main` phải chứa `c79aed3` hoặc mới hơn, và `test -f src/components/subjects/SubjectList.tsx && test -f src/components/parent/ParentView.tsx && echo OK` in `OK`. Thiếu → DỪNG, báo người dùng.

- [ ] **Step 1: Xác nhận DB test**

Run:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` (Neon) và `test=localhost`. Giống nhau → DỪNG, báo người dùng.

- [ ] **Step 2: Viết test fail**

Tạo `tests/unit/lib/theme-contrast.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import config from "../../../tailwind.config"

type Triple = [number, number, number]

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
const rootStart = css.indexOf(":root")
const root = css.slice(rootStart, css.indexOf("}", rootStart))

function token(name: string): Triple {
  const m = root.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%;`))
  if (!m) throw new Error(`Thiếu token --${name}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function hslToRgb([h, s, l]: Triple): Triple {
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as Triple
}

const rgb = (name: string) => hslToRgb(token(name))
const hex = (c: Triple) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()

function luminance(c: Triple) {
  const [r, g, b] = c.map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Triple, b: Triple) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Nền nhãn "đóng một phần": bg-primary/[0.08] phủ trên thẻ trắng.
function tint8(name: string): Triple {
  return rgb(name).map((v) => Math.round(255 * 0.92 + v * 0.08)) as Triple
}

describe("globals.css — bảng màu", () => {
  it.each([
    ["background", "#FFFFFF"],
    ["page", "#F6F7F9"],
    ["foreground", "#111827"],
    ["card", "#FFFFFF"],
    ["card-foreground", "#111827"],
    ["popover", "#FFFFFF"],
    ["popover-foreground", "#111827"],
    ["primary", "#0F766E"],
    ["ring", "#0F766E"],
    ["primary-foreground", "#FFFFFF"],
    ["muted-foreground", "#6B7280"],
    ["secondary", "#F3F4F6"],
    ["muted", "#F3F4F6"],
    ["accent", "#F3F4F6"],
    ["secondary-foreground", "#111827"],
    ["accent-foreground", "#111827"],
    ["border", "#E7E9EE"],
    ["input", "#E7E9EE"],
    ["debt", "#B42318"],
    ["debt-soft", "#FEF3F2"],
    ["success", "#067647"],
    ["success-soft", "#ECFDF3"],
  ])("--%s = %s", (name, expected) => {
    expect(hex(rgb(name))).toBe(expected)
  })

  it("bo góc 14px, không còn khối .dark", () => {
    expect(root).toMatch(/--radius:\s*0\.875rem;/)
    expect(css).not.toMatch(/\.dark\s*\{/)
  })
})

describe("globals.css — tương phản WCAG ≥ 4.5", () => {
  it.each([
    ["primary-foreground", "primary"],
    ["foreground", "card"],
    ["muted-foreground", "card"],
    ["muted-foreground", "page"],
    ["primary", "card"],
    ["primary", "page"],
    ["debt", "card"],
    ["debt", "debt-soft"],
    ["success", "success-soft"],
  ])("%s trên %s", (fg, bg) => {
    expect(contrast(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it("primary trên nền trắng pha 8% màu nhấn", () => {
    expect(contrast(rgb("primary"), tint8("primary"))).toBeGreaterThanOrEqual(4.5)
  })
})

describe("tailwind.config", () => {
  const ext = config.theme?.extend as Record<string, Record<string, unknown>>

  it("có màu page, debt, success; bo góc theo token; font Geist", () => {
    expect(ext.colors.page).toBe("hsl(var(--page))")
    expect(ext.colors.debt).toEqual({ DEFAULT: "hsl(var(--debt))", soft: "hsl(var(--debt-soft))" })
    expect(ext.colors.success).toEqual({ DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" })
    expect(ext.borderRadius).toEqual({
      xl: "var(--radius)",
      lg: "var(--radius)",
      md: "calc(var(--radius) - 4px)",
      sm: "calc(var(--radius) - 6px)",
    })
    expect((ext.fontFamily.sans as string[])[0]).toBe("var(--font-geist-sans)")
    expect((ext.fontFamily.mono as string[])[0]).toBe("var(--font-geist-mono)")
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/theme-contrast.test.ts`
Expected: FAIL — `--page`, `--debt`… báo "Thiếu token", `--primary` ra `#18181B` thay vì `#0F766E`, khối `.dark` còn, `ext.colors.page` là `undefined`, `ext.fontFamily` là `undefined`.

- [ ] **Step 4: Sửa `src/app/globals.css`**

Thay toàn bộ khối `:root { ... }` và khối `.dark { ... }` (dòng 6–50) bằng đúng một khối `:root`:

```css
  :root {
    /* HSL lấy 1 số lẻ để đổi ngược đúng hex của bảng màu A3 (tests/unit/lib/theme-contrast.test.ts). */
    --background: 0 0% 100%;
    --page: 220 20% 97.1%;
    --foreground: 220.9 39.3% 11%;
    --card: 0 0% 100%;
    --card-foreground: 220.9 39.3% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 220.9 39.3% 11%;
    --primary: 175.3 77.4% 26.1%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14.3% 95.9%;
    --secondary-foreground: 220.9 39.3% 11%;
    --muted: 220 14.3% 95.9%;
    --muted-foreground: 220 8.9% 46.1%;
    --accent: 220 14.3% 95.9%;
    --accent-foreground: 220.9 39.3% 11%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 222.9 17.1% 92%;
    --input: 222.9 17.1% 92%;
    --ring: 175.3 77.4% 26.1%;
    /* Đỏ nợ chỉ dùng cho tiền nợ / trạng thái nợ, không dùng cho nút xoá (destructive). */
    --debt: 4.2 76.5% 40%;
    --debt-soft: 5 85.7% 97.3%;
    --success: 154.8 90.3% 24.3%;
    --success-soft: 144.7 81% 95.9%;
    --radius: 0.875rem;
  }
```

Giữ nguyên khối `@layer base { * { @apply border-border; } body { ... } }` (nền `body` vẫn `bg-background` trắng — D3; nền trang đặt ở `AppLayout`/login/register/ParentView bằng `bg-page`).

Đổi `.calendar-day-cell--today`:

```css
.calendar-day-cell--today {
  @apply bg-primary/[0.08] ring-1 ring-inset ring-primary/40;
}
```

- [ ] **Step 5: Sửa `tailwind.config.ts`**

Thêm import ở đầu file (dưới `import tailwindcssAnimate ...`):

```ts
import defaultTheme from "tailwindcss/defaultTheme"
```

Trong `extend.colors`, thêm ngay sau dòng `foreground: "hsl(var(--foreground))",`:

```ts
        page: "hsl(var(--page))",
        debt: {
          DEFAULT: "hsl(var(--debt))",
          soft: "hsl(var(--debt-soft))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          soft: "hsl(var(--success-soft))",
        },
```

Thay khối `borderRadius` bằng:

```ts
      // Thẻ rounded-lg/xl = 14px, nút/ô nhập rounded-md = 10px: đạt mockup không phải sửa từng file (D4).
      borderRadius: {
        xl: "var(--radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      // layout.tsx đã nạp biến --font-geist-*, trước đây thiếu khai báo nên body chạy font hệ thống.
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...defaultTheme.fontFamily.mono],
      },
```

- [ ] **Step 6: Sửa `src/components/ui/card.tsx` và `src/app/layout.tsx`**

`card.tsx` dòng 12: `"rounded-lg border bg-card text-card-foreground shadow-sm"` → `"rounded-lg border bg-card text-card-foreground"`.

`layout.tsx` dòng 38:

```tsx
            {/* Không có ThemeProvider (D1): ép sáng để máy đặt chế độ tối không ra toast tối. */}
            <Toaster richColors position="top-right" theme="light" />
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/theme-contrast.test.ts`
Expected: PASS toàn bộ (22 + 1 + 9 + 1 + 1 test).

Nếu riêng cặp `muted-foreground` / `page` fail: hạ `--muted-foreground` còn `220 9% 43%`, sửa kỳ vọng hex của `muted-foreground` trong test theo giá trị mới (in ra bằng `hex(rgb("muted-foreground"))`), ghi lại lý do trong báo cáo task.

- [ ] **Step 8: Grep xác nhận**

Run:
```bash
grep -n 'theme="light"' src/app/layout.tsx
grep -n "shadow" src/components/ui/card.tsx
grep -n "\.dark" src/app/globals.css
```
Expected: dòng 1 có kết quả; dòng 2 và 3 rỗng.

- [ ] **Step 9: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 10: Commit**

```bash
git add src/app/globals.css tailwind.config.ts src/components/ui/card.tsx src/app/layout.tsx tests/unit/lib/theme-contrast.test.ts
git commit -m "feat(theme): token màu nhấn #0F766E, bo góc 14/10px, font Geist, thẻ không bóng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Điều hướng mobile — `nav-items`, tab "Thêm", `MoreSheet`, i18n, e2e mobile

**Đọc trước:** Global Constraints; Review Focus 1, 2; spec mục 5.4 (`nav-items.ts`, `BottomTabBar.tsx`, `MoreSheet.tsx`), 7, 8 (nav-items test, E2E cần sửa, E2E thêm 390px), 10 (D7, D8); file `src/components/layout/BottomTabBar.tsx`, `src/components/layout/nav-items.ts`, `src/components/ui/sheet.tsx`, `tests/e2e/mobile.spec.ts`.

**Files:**
- Modify: `src/components/layout/nav-items.ts`
- Create: `src/components/layout/MoreSheet.tsx`
- Modify: `src/components/layout/BottomTabBar.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/layout/nav-items.test.ts`, `tests/unit/components/BottomTabBar.test.tsx`
- Modify: `tests/e2e/mobile.spec.ts`, `tests/e2e/subjects.spec.ts:45-47`, `tests/e2e/tuition-notice.spec.ts:116-118`

**Interfaces:**
- Consumes: class token Task 1 (`text-primary`, `bg-primary`, `bg-primary/[0.08]`, `text-muted-foreground`).
- Produces (Task 3 dùng):
  - `export type NavItem = (typeof NAV_ITEMS)[number]` — `{ href: string; labelKey: keyof typeof vi; icon: LucideIcon }`
  - `export const MANAGE_ITEMS: NavItem[]` — `/subjects` (`subject`, `BookOpen`), `/settings` (`settings`, `Settings`)
  - `export const MORE_ITEMS: (NavItem & { descKey: keyof typeof vi })[]` — `/reports`, `/subjects`, `/settings`
  - `export function isMoreActive(pathname: string): boolean`
  - `export function MoreSheet(props: { open: boolean; onOpenChange: (open: boolean) => void }): JSX.Element`
  - i18n key: `more`, `calendar_short`, `manage_group`, `more_reports_desc`, `more_subjects_desc`, `more_settings_desc`.

- [ ] **Step 1: Viết test fail cho `nav-items`**

Tạo `tests/unit/layout/nav-items.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { MANAGE_ITEMS, MORE_ITEMS, NAV_ITEMS, isMoreActive } from "@/components/layout/nav-items"

describe("isMoreActive", () => {
  it.each(["/reports", "/subjects", "/settings", "/settings/x"])("%s → true", (path) => {
    expect(isMoreActive(path)).toBe(true)
  })

  it.each(["/dashboard", "/students", "/subjectsx"])("%s → false", (path) => {
    expect(isMoreActive(path)).toBe(false)
  })
})

describe("danh sách mục điều hướng", () => {
  it("NAV_ITEMS giữ 5 mục; MANAGE_ITEMS và MORE_ITEMS đúng thứ tự, có mô tả", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/dashboard", "/calendar", "/students", "/tuition", "/reports"])
    expect(MANAGE_ITEMS.map((i) => [i.href, i.labelKey])).toEqual([
      ["/subjects", "subject"],
      ["/settings", "settings"],
    ])
    expect(MORE_ITEMS.map((i) => [i.href, i.labelKey, i.descKey])).toEqual([
      ["/reports", "reports", "more_reports_desc"],
      ["/subjects", "subject", "more_subjects_desc"],
      ["/settings", "settings", "more_settings_desc"],
    ])
  })
})
```

- [ ] **Step 2: Viết test fail cho tab bar + sheet**

Tạo `tests/unit/components/BottomTabBar.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ComponentProps } from "react"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { BottomTabBar } from "@/components/layout/BottomTabBar"

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }))
// jsdom không điều hướng thật được: giữ onClick của Link rồi chặn mặc định.
vi.mock("next/link", () => ({
  default: ({ href, onClick, ...rest }: ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        e.preventDefault()
      }}
    />
  ),
}))

function renderBar() {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <BottomTabBar />
    </LanguageProvider>
  )
}

function moreButton() {
  const nav = screen.getByRole("navigation", { name: "Điều hướng chính" })
  return within(nav).getByRole("button", { name: "Thêm" })
}

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/dashboard")
})

describe("BottomTabBar", () => {
  it("4 tab link (Lịch dùng nhãn ngắn) + nút Thêm; không còn link Báo cáo", () => {
    renderBar()
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" })
    const links = within(nav).getAllByRole("link")
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Tổng quan", "/dashboard"],
      ["Lịch", "/calendar"],
      ["Học sinh", "/students"],
      ["Học phí", "/tuition"],
    ])
    expect(links[0].getAttribute("aria-current")).toBe("page")
    expect(within(nav).queryByRole("link", { name: "Báo cáo" })).toBeNull()
    expect(moreButton().getAttribute("aria-haspopup")).toBe("dialog")
    expect(moreButton().getAttribute("aria-current")).toBeNull()
  })

  it.each(["/reports", "/subjects", "/settings/x"])("ở %s → nút Thêm aria-current=page", (path) => {
    vi.mocked(usePathname).mockReturnValue(path)
    renderBar()
    expect(moreButton().getAttribute("aria-current")).toBe("page")
  })

  it("bấm Thêm → dialog 'Thêm' có 3 mục kèm mô tả; bấm mục thì sheet đóng", async () => {
    renderBar()
    fireEvent.click(moreButton())
    const dialog = await screen.findByRole("dialog", { name: "Thêm" })
    const links = within(dialog).getAllByRole("link")
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/reports", "/subjects", "/settings"])
    expect(within(dialog).getByText("Doanh thu, công nợ theo tháng và năm")).toBeTruthy()
    expect(within(dialog).getByText("Thêm, đổi màu, ẩn môn")).toBeTruthy()
    expect(within(dialog).getByText("Tài khoản ngân hàng nhận học phí")).toBeTruthy()

    fireEvent.click(within(dialog).getByRole("link", { name: /Cài đặt/ }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("Escape đóng sheet, bấm Thêm mở lại được", async () => {
    renderBar()
    fireEvent.click(moreButton())
    const dialog = await screen.findByRole("dialog", { name: "Thêm" })
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    fireEvent.click(moreButton())
    expect(await screen.findByRole("dialog", { name: "Thêm" })).toBeTruthy()
  })

  it("đổi pathname (vd nút Back) khi sheet đang mở thì sheet tự đóng", async () => {
    const { rerender } = renderBar()
    fireEvent.click(moreButton())
    await screen.findByRole("dialog", { name: "Thêm" })
    vi.mocked(usePathname).mockReturnValue("/students")
    rerender(
      <LanguageProvider forcedLanguage="vi">
        <BottomTabBar />
      </LanguageProvider>
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/layout/nav-items.test.ts tests/unit/components/BottomTabBar.test.tsx`
Expected: FAIL — `isMoreActive`/`MANAGE_ITEMS`/`MORE_ITEMS` không tồn tại (import undefined → "is not a function"); tab bar có 5 link, nhãn "Lịch dạy", không có nút "Thêm".

- [ ] **Step 4: Thêm key i18n**

Trước tiên xác nhận chưa có key trùng:
```bash
grep -nE '"(more|calendar_short|manage_group|more_reports_desc|more_subjects_desc|more_settings_desc)"' src/language/vi.json src/language/en.json
```
Expected: rỗng.

Thêm vào cuối object `src/language/vi.json` (sau key cuối cùng hiện có, nhớ thêm dấu phẩy cho dòng trước):

```json
  "more": "Thêm",
  "calendar_short": "Lịch",
  "manage_group": "Quản lý",
  "more_reports_desc": "Doanh thu, công nợ theo tháng và năm",
  "more_subjects_desc": "Thêm, đổi màu, ẩn môn",
  "more_settings_desc": "Tài khoản ngân hàng nhận học phí"
```

Thêm vào cuối `src/language/en.json`:

```json
  "more": "More",
  "calendar_short": "Calendar",
  "manage_group": "Manage",
  "more_reports_desc": "Revenue and debts by month and year",
  "more_subjects_desc": "Add, recolor, hide subjects",
  "more_settings_desc": "Bank account for tuition"
```

Kiểm tra:
```bash
node -e "const v=Object.keys(require('./src/language/vi.json')),e=Object.keys(require('./src/language/en.json'));console.log(v.length,e.length,v.filter(k=>!e.includes(k)),e.filter(k=>!v.includes(k)))"
```
Expected: `404 404 [] []`.

- [ ] **Step 5: Sửa `src/components/layout/nav-items.ts`**

Thay import lucide bằng:

```ts
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
```

Giữ nguyên `NAV_ITEMS` và `isNavActive`. Thêm cuối file:

```ts
export type NavItem = (typeof NAV_ITEMS)[number]

export const MANAGE_ITEMS: NavItem[] = [
  { href: "/subjects", labelKey: "subject", icon: BookOpen },
  { href: "/settings", labelKey: "settings", icon: Settings },
]

// Tab "Thêm" trên mobile gom các màn không có tab riêng.
export const MORE_ITEMS: (NavItem & { descKey: keyof typeof vi })[] = [
  { href: "/reports", labelKey: "reports", icon: BarChart3, descKey: "more_reports_desc" },
  { href: "/subjects", labelKey: "subject", icon: BookOpen, descKey: "more_subjects_desc" },
  { href: "/settings", labelKey: "settings", icon: Settings, descKey: "more_settings_desc" },
]

export function isMoreActive(pathname: string) {
  return MORE_ITEMS.some((i) => isNavActive(pathname, i.href))
}
```

- [ ] **Step 6: Tạo `src/components/layout/MoreSheet.tsx`**

```tsx
"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { MORE_ITEMS } from "./nav-items"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MoreSheet({ open, onOpenChange }: Props) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Sheet phủ cả tab bar (D8); không có mô tả nên tắt aria-describedby để Radix không cảnh báo. */}
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="rounded-t-[20px] px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="sr-only">{t("more")}</SheetTitle>
        <div aria-hidden className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#D5D8DE]" />
        <ul className="flex flex-col gap-1">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-14 items-center gap-3.5 rounded-xl px-3 hover:bg-accent"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-medium text-foreground">{t(item.labelKey)}</span>
                    <span className="text-xs text-muted-foreground">{t(item.descKey)}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-[#9CA3AF]" />
                </Link>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 7: Viết lại `src/components/layout/BottomTabBar.tsx`**

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Ellipsis } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { NAV_ITEMS, isMoreActive, isNavActive } from "./nav-items"
import { MoreSheet } from "./MoreSheet"

const TAB_ITEMS = NAV_ITEMS.slice(0, 4)

function tabClass(active: boolean) {
  return cn(
    "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]",
    active ? "font-semibold text-primary" : "font-medium text-muted-foreground"
  )
}

function ActiveBar() {
  return <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-5 -translate-x-1/2 rounded-full bg-primary" />
}

export function BottomTabBar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  // Gắn trạng thái mở với pathname: đổi route (kể cả nút Back) là sheet tự đóng.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const moreActive = isMoreActive(pathname)

  return (
    <nav
      aria-label={t("main_navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {active && <ActiveBar />}
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">
                  {t(item.href === "/calendar" ? "calendar_short" : item.labelKey)}
                </span>
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-current={moreActive ? "page" : undefined}
            onClick={() => setOpenAt(pathname)}
            className={tabClass(moreActive)}
          >
            {moreActive && <ActiveBar />}
            <Ellipsis className="size-5" />
            <span className="max-w-full truncate px-1">{t("more")}</span>
          </button>
        </li>
      </ul>
      <MoreSheet open={openAt === pathname} onOpenChange={(open) => setOpenAt(open ? pathname : null)} />
    </nav>
  )
}
```

- [ ] **Step 8: Chạy unit test, xác nhận pass**

Run: `pnpm test tests/unit/layout/nav-items.test.ts tests/unit/components/BottomTabBar.test.tsx`
Expected: PASS (8 + 6 test).

- [ ] **Step 9: Sửa e2e `tests/e2e/mobile.spec.ts`**

Thay `SCREENS` (dòng 5–11):

```ts
const SCREENS = [
  { tab: 'Tổng quan', url: /dashboard/ },
  { tab: 'Lịch', url: /calendar/ },
  { tab: 'Học sinh', url: /students/ },
  { tab: 'Học phí', url: /tuition/ },
];
```

Thêm hàm dưới `expectNoHorizontalScroll`:

```ts
function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Điều hướng chính' });
}

async function openMore(page: Page) {
  await mainNav(page).getByRole('button', { name: 'Thêm', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Thêm' });
  await expect(sheet).toBeVisible();
  return sheet;
}
```

Thay test `'thanh tab đáy chuyển đủ 5 màn, không màn nào tràn ngang'` (dòng 37–46) bằng 2 test:

```ts
  test('thanh tab đáy: 4 tab + Báo cáo qua nút Thêm, không màn nào tràn ngang', async ({ page }) => {
    const nav = mainNav(page);
    await expect(nav).toBeVisible();
    for (const s of SCREENS) {
      await nav.getByRole('link', { name: s.tab, exact: true }).click();
      await expect(page).toHaveURL(s.url);
      await expect(nav.getByRole('link', { name: s.tab, exact: true })).toHaveAttribute('aria-current', 'page');
      await expectNoHorizontalScroll(page);
    }

    const sheet = await openMore(page);
    await sheet.getByRole('link', { name: /Báo cáo/ }).click();
    await expect(page).toHaveURL(/reports/);
    await expect(sheet).toBeHidden();
    await expect(nav.getByRole('button', { name: 'Thêm', exact: true })).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalScroll(page);
  });

  test('sheet Thêm: 3 mục cao ≥ 56px có mô tả; vào Cài đặt rồi Môn học', async ({ page }) => {
    const more = mainNav(page).getByRole('button', { name: 'Thêm', exact: true });
    let sheet = await openMore(page);
    await expect(sheet.getByRole('link')).toHaveCount(3);
    const items = [
      { name: /Báo cáo/, desc: 'Doanh thu, công nợ theo tháng và năm' },
      { name: /Môn học/, desc: 'Thêm, đổi màu, ẩn môn' },
      { name: /Cài đặt/, desc: 'Tài khoản ngân hàng nhận học phí' },
    ];
    for (const it of items) {
      const link = sheet.getByRole('link', { name: it.name });
      await expect(link).toContainText(it.desc);
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(56);
    }
    await expectNoHorizontalScroll(page);

    await sheet.getByRole('link', { name: /Cài đặt/ }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(sheet).toBeHidden();
    await expect(more).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalScroll(page);

    sheet = await openMore(page);
    await sheet.getByRole('link', { name: /Môn học/ }).click();
    await expect(page).toHaveURL(/\/subjects/);
    await expect(sheet).toBeHidden();
    await expect(more).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalScroll(page);
  });
```

- [ ] **Step 10: Sửa `tests/e2e/subjects.spec.ts` và `tests/e2e/tuition-notice.spec.ts`**

`subjects.spec.ts` dòng 45–47, thay:

```ts
    // Vào từ menu avatar
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await page.getByRole('menuitem', { name: 'Môn học' }).click();
```

bằng:

```ts
    // Vào từ tab Thêm (menu avatar không còn mục Môn học)
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('dialog', { name: 'Thêm' }).getByRole('link', { name: /Môn học/ }).click();
    await expect(page.getByRole('dialog', { name: 'Thêm' })).toBeHidden();
```

(giữ dòng `await expect(page).toHaveURL(/\/subjects/);` ngay sau.)

`tuition-notice.spec.ts` dòng 116–118, thay:

```ts
    // 1. Cài đặt ngân hàng từ menu avatar
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await page.getByRole('menuitem', { name: 'Cài đặt' }).click();
```

bằng:

```ts
    // 1. Cài đặt ngân hàng từ tab Thêm
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('dialog', { name: 'Thêm' }).getByRole('link', { name: /Cài đặt/ }).click();
    await expect(page.getByRole('dialog', { name: 'Thêm' })).toBeHidden();
```

(giữ dòng `await expect(page).toHaveURL(/\/settings/);` ngay sau.)

Lưu ý: các test tạo HS dùng `page.locator('button:has-text("Thêm")').last()` — nút "Thêm" của tab bar nằm trước dialog trong DOM nên `.last()` vẫn là nút của form; không sửa.

- [ ] **Step 11: Chạy e2e**

Run: `pnpm exec playwright test tests/e2e/mobile.spec.ts tests/e2e/subjects.spec.ts tests/e2e/tuition-notice.spec.ts`
Expected: PASS toàn bộ. (Cổng 3000 bận → DỪNG, báo người dùng.)

- [ ] **Step 12: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 13: Commit**

```bash
git add src/components/layout/nav-items.ts src/components/layout/MoreSheet.tsx src/components/layout/BottomTabBar.tsx src/language/vi.json src/language/en.json tests/unit/layout/nav-items.test.ts tests/unit/components/BottomTabBar.test.tsx tests/e2e/mobile.spec.ts tests/e2e/subjects.spec.ts tests/e2e/tuition-notice.spec.ts
git commit -m "feat(nav): tab Thêm mở bottom sheet (Báo cáo, Môn học, Cài đặt) trên mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Sidebar desktop, header, menu avatar, nền trang

**Đọc trước:** Global Constraints; Review Focus 3; spec mục 5.4 (`AppSidebar.tsx`, `AppHeader.tsx`, `AppLayout.tsx`), 8 (E2E thêm desktop, mục menu avatar trong E2E 390px), 10 (D6, D10); file `src/components/layout/AppSidebar.tsx`, `AppHeader.tsx`, `AppLayout.tsx`, `nav-items.ts` (sau Task 2), `tests/e2e/layout-desktop.spec.ts`, `tests/e2e/mobile.spec.ts`.

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx` (viết lại)
- Modify: `src/components/layout/AppHeader.tsx`
- Modify: `src/components/layout/AppLayout.tsx:10`
- Test (Mới): `tests/unit/components/AppSidebar.test.tsx`
- Modify: `tests/e2e/mobile.spec.ts` (thêm 1 test), `tests/e2e/layout-desktop.spec.ts` (thêm 1 describe)

**Interfaces:**
- Consumes (Task 2): `NAV_ITEMS`, `MANAGE_ITEMS`, `isNavActive`, `type NavItem` từ `./nav-items`; key `manage_group`. Token Task 1: `bg-page`, `bg-primary/[0.08]`, `text-primary`, `text-muted-foreground`, `font-mono`.
- Produces: link sidebar có `aria-current="page"` khi active (e2e dùng); menu avatar đúng 3 `menuitem`.

- [ ] **Step 1: Viết test fail**

Tạo `tests/unit/components/AppSidebar.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AppSidebar } from "@/components/layout/AppSidebar"

vi.mock("next/navigation", () => ({ usePathname: () => "/subjects" }))

describe("AppSidebar", () => {
  it("5 mục chính + nhóm Quản lý (Môn học, Cài đặt); mục đang mở có aria-current", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <AppSidebar />
      </LanguageProvider>
    )
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/calendar",
      "/students",
      "/tuition",
      "/reports",
      "/subjects",
      "/settings",
    ])
    expect(screen.getByText("Quản lý")).toBeTruthy()
    const subjects = screen.getByRole("link", { name: "Môn học" })
    expect(subjects.getAttribute("aria-current")).toBe("page")
    expect(subjects.className).toContain("text-primary")
    expect(screen.getByRole("link", { name: "Tổng quan" }).getAttribute("aria-current")).toBeNull()
  })
})
```

Thêm vào `tests/e2e/mobile.spec.ts`, trong `test.describe('Mobile 390px', ...)`, sau test sheet Thêm:

```ts
  test('menu avatar chỉ còn Sao lưu dữ liệu, Đổi mật khẩu, Đăng xuất', async ({ page }) => {
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Sao lưu dữ liệu' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Đổi mật khẩu' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Đăng xuất' })).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expectNoHorizontalScroll(page);
  });
```

Thêm vào cuối `tests/e2e/layout-desktop.spec.ts`:

```ts
test.describe('Sidebar desktop 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('nhóm Quản lý có Môn học, Cài đặt; link đang mở có aria-current', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Quản lý', { exact: true })).toBeVisible();

    await sidebar.getByRole('link', { name: 'Môn học' }).click();
    await expect(page).toHaveURL(/\/subjects/);
    await expect(sidebar.getByRole('link', { name: 'Môn học' })).toHaveAttribute('aria-current', 'page');

    await sidebar.getByRole('link', { name: 'Cài đặt' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(sidebar.getByRole('link', { name: 'Cài đặt' })).toHaveAttribute('aria-current', 'page');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/components/AppSidebar.test.tsx`
Expected: FAIL — chỉ có 5 link, không có "Quản lý".

Run: `pnpm exec playwright test tests/e2e/mobile.spec.ts tests/e2e/layout-desktop.spec.ts -g "menu avatar|Sidebar desktop"`
Expected: FAIL — menu avatar có 5 `menuitem`; sidebar không có "Quản lý".

- [ ] **Step 3: Viết lại `src/components/layout/AppSidebar.tsx`**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { MANAGE_ITEMS, NAV_ITEMS, isNavActive, type NavItem } from "./nav-items"

function SidebarLink({ item, pathname, label }: { item: NavItem; pathname: string; label: string }) {
  const Icon = item.icon
  const active = isNavActive(pathname, item.href)
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        active
          ? "bg-primary/[0.08] font-semibold text-primary"
          : "font-medium text-[#4B5563] hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-7 border-r bg-white px-3.5 py-5">
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex size-8 items-center justify-center rounded-[9px] bg-primary">
          <GraduationCap className="size-[18px] text-white" />
        </span>
        <span className="text-base font-semibold text-foreground">{t("calendar")}</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-[#F0F1F4] pt-4">
        <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {t("manage_group")}
        </p>
        {MANAGE_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} />
        ))}
      </div>

      <div className="px-1 font-mono text-[11px] leading-tight text-muted-foreground">
        <div>
          v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_BUILD_SHA}
        </div>
        <div>{process.env.NEXT_PUBLIC_BUILD_TIME}</div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Sửa `src/components/layout/AppHeader.tsx`**

1. Xoá dòng `import Link from "next/link"`; đổi import lucide thành:
```tsx
import { DatabaseBackup, KeyRound, LogOut, Languages } from "lucide-react"
```
2. Thẻ `<header>` và lời chào (dòng 33–37):
```tsx
    <header className="flex h-14 items-center justify-between gap-3 border-b bg-white px-4 md:h-16 md:px-8">
      {/* min-w-0: nút 44px bên phải to hơn, tên dài phải cắt chứ không đẩy tràn ngang. */}
      <span className="min-w-0 truncate text-sm text-muted-foreground">
        {t("hello")},{" "}
        <span className="font-medium text-foreground">{fullName}</span>
      </span>
```
3. Nút ngôn ngữ (dòng 42):
```tsx
            <Button variant="outline" size="icon" className="size-11 text-slate-600 md:size-10">
```
4. Nút avatar (dòng 64–69):
```tsx
            <button
              className="flex size-11 items-center justify-center rounded-full bg-[#EEF0F4] text-[13px] font-semibold text-[#374151] hover:bg-[#E5E7EB] md:size-10"
              aria-label={t("account_menu")}
            >
```
5. Xoá 2 `DropdownMenuItem asChild` chứa `<Link href="/subjects">` và `<Link href="/settings">` (dòng 72–83). Menu còn: Sao lưu dữ liệu, `ChangePasswordDialog` (Đổi mật khẩu), `DropdownMenuSeparator`, Đăng xuất — giữ nguyên code các mục này.

Thêm `shrink-0` vào `<div className="flex items-center gap-2">` bọc 2 nút: `<div className="flex shrink-0 items-center gap-2">`.

- [ ] **Step 5: Sửa `src/components/layout/AppLayout.tsx`**

Dòng 10: `bg-slate-50` → `bg-page`:
```tsx
    <div className="flex h-[100dvh] overflow-hidden bg-page">
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/components/AppSidebar.test.tsx tests/unit/components/BottomTabBar.test.tsx`
Expected: PASS.

Run: `pnpm exec playwright test tests/e2e/mobile.spec.ts tests/e2e/layout-desktop.spec.ts tests/e2e/auth.spec.ts tests/e2e/backup.spec.ts`
Expected: PASS toàn bộ (auth/backup vẫn dùng menu avatar cho Đăng xuất/Sao lưu, không sửa).

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi (không còn import thừa `Link`, `BookOpen`, `Settings` trong `AppHeader`).

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/AppSidebar.tsx src/components/layout/AppHeader.tsx src/components/layout/AppLayout.tsx tests/unit/components/AppSidebar.test.tsx tests/e2e/mobile.spec.ts tests/e2e/layout-desktop.spec.ts
git commit -m "feat(nav): sidebar có nhóm Quản lý, header 44px, menu avatar gọn, nền trang #F6F7F9

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: Học phí — nhãn trạng thái, thẻ mobile, sheet chi tiết

**Đọc trước:** Global Constraints; Review Focus 5; spec mục 5.5 (dòng `TuitionStatusBadge`, `tuition/page.tsx`, `TuitionDetailSheet.tsx`, `border-slate-200`), 5.6; mockup `TuitionMobile.dc.html`; file `src/components/tuition/TuitionStatusBadge.tsx`, `src/lib/tuition-status.ts`, `src/app/(app)/tuition/page.tsx` (dòng 85–99, 210–245), `src/components/tuition/TuitionDetailSheet.tsx` (dòng 158–210), `tests/unit/components/TuitionPageMobileCard.test.tsx`, `tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx`.

**Files:**
- Modify: `src/components/tuition/TuitionStatusBadge.tsx`
- Modify: `src/app/(app)/tuition/page.tsx`
- Modify: `src/components/tuition/TuitionDetailSheet.tsx:166,204`
- Test (Mới): `tests/unit/components/TuitionStatusBadge.test.tsx`
- Test (Sửa): `tests/unit/components/TuitionPageMobileCard.test.tsx`, `tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx`

**Interfaces:**
- Consumes: token Task 1 (`bg-debt-soft`, `text-debt`, `bg-success-soft`, `text-success`, `bg-primary/[0.08]`, `text-primary`, `text-muted-foreground`, `text-foreground`); `getTuitionBadgeStatus(item: TuitionStatusInput): TuitionBadgeStatus` và `type TuitionBadgeStatus` từ `@/lib/tuition-status` (sẵn có).
- Produces: không có interface mới cho task sau.

- [ ] **Step 1: Viết test fail cho badge**

Tạo `tests/unit/components/TuitionStatusBadge.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TuitionStatusBadge } from "@/components/tuition/TuitionStatusBadge"
import type { TuitionStatusInput } from "@/lib/tuition-status"

const base: TuitionStatusInput = {
  paidAmount: 0,
  isFullPaid: false,
  totalExpected: 400000,
  previousBalance: 0,
  totalAmountDue: 400000,
}

const DEBT = ["bg-debt-soft", "text-debt"]
const PARTIAL = ["bg-primary/[0.08]", "text-primary"]
const DONE = ["bg-success-soft", "text-success"]

describe("TuitionStatusBadge — màu theo nhóm trạng thái", () => {
  it.each<[string, TuitionStatusInput, string, string[]]>([
    ["unpaid", base, "Chưa đóng", DEBT],
    ["partial", { ...base, paidAmount: 100000 }, "Chưa đóng đủ", PARTIAL],
    [
      "paid_this_month",
      { ...base, previousBalance: 200000, totalAmountDue: 600000, paidAmount: 400000 },
      "Đóng đủ tháng này",
      PARTIAL,
    ],
    ["fully_paid", { ...base, paidAmount: 400000 }, "Đã đóng đủ", DONE],
    ["overpaid", { ...base, paidAmount: 500000 }, "Đóng thừa tiền", DONE],
    ["settled_waived", { ...base, isFullPaid: true, paidAmount: 300000 }, "Tất toán (miễn giảm)", DONE],
  ])("%s → %s", (_status, item, label, classes) => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionStatusBadge item={item} />
      </LanguageProvider>
    )
    const cls = screen.getByText(label).className
    for (const c of classes) expect(cls).toContain(c)
    expect(cls).not.toMatch(/(red|green|blue|amber|purple|teal)-\d/)
  })

  it("no_sessions giữ outline xám", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionStatusBadge item={{ ...base, totalExpected: 0, totalAmountDue: 0 }} />
      </LanguageProvider>
    )
    expect(screen.getByText("Không có buổi học").className).toContain("text-slate-400")
  })
})
```

- [ ] **Step 2: Viết test fail cho thẻ mobile + sheet chi tiết**

Trong `tests/unit/components/TuitionPageMobileCard.test.tsx`:

Sửa dòng import vitest thành `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"` và thêm `import { formatCurrency } from "@/lib/utils"`.

Thêm cuối file:

```tsx
describe("TuitionPage - màu thẻ mobile", () => {
  afterEach(() => {
    getMonthlyStatusQuery.data.items = [item]
  })

  function cardAmount(value: number) {
    return screen
      .getAllByText(formatCurrency(value))
      .find((el) => el.tagName === "DIV" && el.closest('[role="button"]'))!
  }

  function cardPayButton() {
    return screen.getAllByRole("button", { name: "Ghi nhận" }).find((b) => b.closest('[role="button"]'))!
  }

  it("chưa đóng → số tiền đỏ nợ 17px, nút Ghi nhận nền màu nhấn", () => {
    renderPage()
    const amount = cardAmount(400000)
    expect(amount.className).toContain("text-debt")
    expect(amount.className).toContain("text-[17px]")
    expect(amount.className).toContain("tabular-nums")
    expect(cardPayButton().className).toContain("bg-primary")
  })

  it("đóng một phần → số tiền chữ chính", () => {
    getMonthlyStatusQuery.data.items = [{ ...item, paidAmount: 100000 }]
    renderPage()
    expect(cardAmount(400000).className).toContain("text-foreground")
  })

  it("đã đóng đủ → số tiền chữ phụ, nút Ghi nhận viền (outline)", () => {
    getMonthlyStatusQuery.data.items = [{ ...item, paidAmount: 400000 }]
    renderPage()
    expect(cardAmount(400000).className).toContain("text-muted-foreground")
    const btn = cardPayButton().className
    expect(btn).toContain("border-input")
    expect(btn).not.toContain("bg-primary")
  })
})
```

Trong `tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx`, thêm cuối file:

```tsx
describe("TuitionDetailSheet - màu nợ", () => {
  it("còn phải trả > 0 → dòng còn lại dùng đỏ nợ", () => {
    renderSheet()
    expect(screen.getByTestId("remaining-line").className).toContain("text-debt")
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/components/TuitionStatusBadge.test.tsx tests/unit/components/TuitionPageMobileCard.test.tsx tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx`
Expected: FAIL — badge còn `bg-red-100`/`bg-amber-100`/`bg-purple-100`…; số tiền thẻ `text-slate-900 text-lg`; nút Ghi nhận luôn outline; dòng còn lại `text-red-600`. 3 test cũ của thẻ mobile và 2 test cũ của sheet vẫn pass.

- [ ] **Step 4: Sửa `TuitionStatusBadge.tsx`**

Thêm hằng dưới các import:

```tsx
// Chỉ 3 nhóm màu: nợ (đỏ nợ), đang dở (màu nhấn), đã xong (xanh lá). hover giữ nền vì badge không bấm được.
const DEBT = "border-none bg-debt-soft text-debt hover:bg-debt-soft"
const IN_PROGRESS = "border-none bg-primary/[0.08] text-primary hover:bg-primary/[0.08]"
const DONE = "border-none bg-success-soft text-success hover:bg-success-soft"
```

Đổi `className` từng nhánh, giữ icon và chữ:
- `overpaid`, `settled_waived`, `fully_paid`: `className={DONE}`
- `paid_this_month`, `partial`: `className={IN_PROGRESS}`
- `unpaid`: `className={DEBT}`
- `no_sessions`: giữ nguyên.

Ví dụ nhánh `unpaid`:

```tsx
    case "unpaid":
      return (
        <Badge className={DEBT}>
          <AlertCircle className="size-3 mr-1" /> {t("unpaid")}
        </Badge>
      )
```

- [ ] **Step 5: Sửa `src/app/(app)/tuition/page.tsx`**

Import: `import { formatCurrency } from "@/lib/utils"` → `import { cn, formatCurrency } from "@/lib/utils"`; thêm `import { getTuitionBadgeStatus, type TuitionBadgeStatus } from "@/lib/tuition-status"`.

Thêm ngay dưới `type TuitionStatusItem = ...`:

```tsx
const SETTLED: TuitionBadgeStatus[] = ["fully_paid", "overpaid", "settled_waived"]

// Chỉ "chưa đóng" tô đỏ nợ; đã đủ thì lùi về chữ phụ để mắt dồn vào HS còn phải thu.
function amountClass(status: TuitionBadgeStatus) {
  if (status === "unpaid") return "text-debt"
  return SETTLED.includes(status) ? "text-muted-foreground" : "text-foreground"
}
```

Trong `payButton`: `variant="outline"` → `variant={SETTLED.includes(getTuitionBadgeStatus(item)) ? "outline" : "default"}`.

Trong `renderCard`:
- `className="rounded-lg border border-slate-200 bg-white p-4 transition-transform active:scale-[0.98]"` → `className="rounded-lg border bg-white p-4 transition-transform active:scale-[0.98]"`
- Khối số tiền:
```tsx
                <div
                  className={cn(
                    "whitespace-nowrap text-[17px] font-semibold tabular-nums tracking-tight",
                    amountClass(getTuitionBadgeStatus(item))
                  )}
                >
                  {formatCurrency(item.totalAmountDue)}
                </div>
```

Không đổi nhóm nút đổi tháng (`rounded-lg border border-slate-200` dòng 150) trong task này; nếu nhìn quá tròn thì Task 7 xử lý.

- [ ] **Step 6: Sửa `TuitionDetailSheet.tsx`**

Dòng 166 (nợ cũ `row.previousBalance > 0`) và dòng 204 (`summary.amount > 0`): `? "text-red-600"` → `? "text-debt"`. Không đổi các màu xanh/teal khác.

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/components/TuitionStatusBadge.test.tsx tests/unit/components/TuitionPageMobileCard.test.tsx tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx tests/unit/lib/tuition-status.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 8: E2E học phí**

Run: `pnpm exec playwright test tests/e2e/tuition-payments.spec.ts tests/e2e/tuition-deeplink.spec.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 10: Commit**

```bash
git add src/components/tuition/TuitionStatusBadge.tsx "src/app/(app)/tuition/page.tsx" src/components/tuition/TuitionDetailSheet.tsx tests/unit/components/TuitionStatusBadge.test.tsx tests/unit/components/TuitionPageMobileCard.test.tsx tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx
git commit -m "feat(tuition): nhãn trạng thái 3 nhóm màu, thẻ mobile tô số tiền theo trạng thái

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: Tổng quan, Báo cáo, thẻ số liệu, tiêu đề trang, khối dùng chung

**Đọc trước:** Global Constraints; Review Focus 5; spec mục 5.5 (dòng `dashboard/page.tsx`, `reports/page.tsx`, `StatCard.tsx`, `DashboardAlerts.tsx`, `ResponsiveList.tsx`/`TodaySessions.tsx`, `PageHeader.tsx`); mockup `DashboardMobile.dc.html`, `Main.dc.html`; file `src/components/common/StatCard.tsx`, `src/components/common/PageHeader.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/reports/page.tsx` (dòng 130–175), `src/components/dashboard/DashboardAlerts.tsx`, `src/components/common/ResponsiveList.tsx`, `src/components/dashboard/TodaySessions.tsx`.

**Files:**
- Modify: `src/components/common/StatCard.tsx`, `src/components/common/PageHeader.tsx`, `src/components/common/ResponsiveList.tsx:61,74,82`
- Modify: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/reports/page.tsx:137-170`
- Modify: `src/components/dashboard/DashboardAlerts.tsx`, `src/components/dashboard/TodaySessions.tsx:44`
- Test (Mới): `tests/unit/components/DashboardPage.test.tsx`, `tests/unit/components/DashboardAlerts.test.tsx`

**Interfaces:**
- Consumes: token Task 1 (`text-primary`, `text-debt`, `text-muted-foreground`, `text-foreground`, `bg-primary/[0.08]`).
- Produces: `StatCard` giữ nguyên props `{ label, value?, hint?, icon?, loading?, valueClassName? }` và `data-testid="stat-card"`/`"stat-value"`; class mặc định của giá trị có `text-foreground font-semibold tracking-tight` (bị `valueClassName` ghi đè màu qua `cn`).

- [ ] **Step 1: Viết test fail**

Tạo `tests/unit/components/DashboardPage.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import DashboardPage from "@/app/(app)/dashboard/page"

const stats = {
  sessionsToday: 2,
  totalRevenueMonth: 1000000,
  totalPaidMonth: 600000,
  totalUnpaidMonth: 400000,
  totalStudents: 5,
  totalSessionsMonth: 12,
  attendanceRate: 90,
  expectedRevenueMonth: 1200000,
}

vi.mock("@/lib/trpc", () => ({
  trpc: { report: { dashboard: { useQuery: () => ({ data: stats, isLoading: false }) } } },
}))
// Hai khối dưới có test riêng; ở đây chỉ kiểm thẻ số liệu.
vi.mock("@/components/dashboard/DashboardAlerts", () => ({ DashboardAlerts: () => null }))
vi.mock("@/components/dashboard/TodaySessions", () => ({ TodaySessions: () => null }))

function renderPage() {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <DashboardPage />
    </LanguageProvider>
  )
}

function valueOf(label: string) {
  const card = screen.getAllByTestId("stat-card").find((c) => c.querySelector("p")?.textContent === label)
  if (!card) throw new Error(`Không thấy thẻ ${label}`)
  return card.querySelector('[data-testid="stat-value"]') as HTMLElement
}

describe("Dashboard — thẻ số liệu", () => {
  it("Đã thu tô màu nhấn, Còn nợ tô đỏ nợ, thẻ khác chữ chính semibold", () => {
    renderPage()
    expect(valueOf("Đã thu").className).toContain("text-primary")
    expect(valueOf("Còn nợ").className).toContain("text-debt")
    const plain = valueOf("Ca dạy hôm nay").className
    expect(plain).toContain("text-foreground")
    expect(plain).toContain("font-semibold")
    expect(plain).not.toContain("font-bold")
  })

  it("icon của cả 8 thẻ dùng chữ phụ, không còn màu rời rạc", () => {
    renderPage()
    const icons = screen.getAllByTestId("stat-card").flatMap((c) => [...c.querySelectorAll("svg")])
    expect(icons).toHaveLength(8)
    for (const svg of icons) expect(svg.getAttribute("class")).toContain("text-muted-foreground")
  })
})
```

Tạo `tests/unit/components/DashboardAlerts.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts"
import { formatCurrency } from "@/lib/utils"

const alerts = {
  year: 2026,
  month: 9,
  debts: [{ studentId: 1, fullName: "Nguyễn Văn An", grade: 5, amount: 1800000, months: 2 }],
  idleStudents: [{ studentId: 2, fullName: "Trần Bình", grade: 3 }],
  unrescheduled: [],
}

vi.mock("@/lib/trpc", () => ({
  trpc: { report: { alerts: { useQuery: () => ({ data: alerts, isPending: false }) } } },
}))
// Dialog ca dạy kéo theo nhiều query tRPC, không liên quan màu của khối cảnh báo.
vi.mock("@/components/sessions/SessionDetailDialog", () => ({ SessionDetailDialog: () => null }))
vi.mock("@/components/sessions/SessionFormDialog", () => ({ SessionFormDialog: () => null }))

describe("DashboardAlerts — màu", () => {
  it("tiền nợ đỏ nợ; số đếm nền màu nhấn; icon chữ phụ", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <DashboardAlerts />
      </LanguageProvider>
    )
    const debt = screen.getByTestId("alert-group-debt")
    expect(within(debt).getByText(formatCurrency(1800000)).className).toContain("text-debt")
    for (const id of ["alert-group-debt", "alert-group-idle"]) {
      const group = screen.getByTestId(id)
      expect(within(group).getByText("1").className).toContain("bg-primary/[0.08]")
      expect(group.querySelector("svg")!.getAttribute("class")).toContain("text-muted-foreground")
    }
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/components/DashboardPage.test.tsx tests/unit/components/DashboardAlerts.test.tsx`
Expected: FAIL — "Đã thu" không có `text-primary`, giá trị `font-bold text-slate-900`, icon `text-emerald-600`…; tiền nợ `text-red-600`, badge `bg-slate-100`, icon `text-red-600`/`text-orange-600`.

- [ ] **Step 3: Sửa `StatCard.tsx`**

```tsx
    <Card data-testid="stat-card" className="bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon}
        </div>
        {loading || value === undefined ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          // nowrap: số tiền 9 chữ số không được gãy "100.000.000 / đ" ở thẻ 2 cột 390px
          <p
            data-testid="stat-value"
            className={cn("mt-1 whitespace-nowrap text-lg font-semibold tracking-tight text-foreground xl:text-2xl", valueClassName)}
          >
            {value}
          </p>
        )}
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
```

- [ ] **Step 4: Sửa `PageHeader.tsx`**

```tsx
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
```

- [ ] **Step 5: Sửa `dashboard/page.tsx`**

Cả 8 `icon={<X className="size-4 text-…-600" />}` → `icon={<X className="size-4 text-muted-foreground" />}` (giữ đúng icon: `CalendarDays`, `Banknote`, `Wallet`, `AlertCircle`, `Users`, `CalendarCheck`, `BarChart3`, `Banknote`).

Thêm `valueClassName`:
- thẻ `collected_amount`: `valueClassName="text-primary"`
- thẻ `unpaid_this_month`: `valueClassName="text-debt"`

- [ ] **Step 6: Sửa `reports/page.tsx`** (khối `StatCard` khi chưa chọn HS)

- `expected_revenue`: xoá `valueClassName="text-indigo-600"`
- `actual_revenue`: xoá `valueClassName="text-emerald-600"` (giữ nguyên `hint`, dòng "Hụt" `text-orange-600` giữ)
- `collected_amount`: `valueClassName="text-green-600"` → `valueClassName="text-primary"`
- `uncollected_amount`: `valueClassName="text-orange-600"` → `valueClassName="text-debt"`

- [ ] **Step 7: Sửa `DashboardAlerts.tsx`**

- Badge đếm trong `AlertGroup`: `className="border-none bg-slate-100 text-slate-600"` → `className="border-none bg-primary/[0.08] text-primary hover:bg-primary/[0.08]"`
- Icon 3 nhóm: `text-red-600` (Wallet), `text-orange-600` (CalendarX), `text-violet-600` (CalendarClock) → `text-muted-foreground` (giữ `size-4 shrink-0`)
- Tiền nợ: `text-sm font-semibold text-red-600` → `text-sm font-semibold text-debt`

- [ ] **Step 8: Sửa `ResponsiveList.tsx` và `TodaySessions.tsx`**

- `ResponsiveList.tsx` dòng 61 và 74: `border border-dashed border-slate-200` → `border border-dashed`; dòng 82: `rounded-lg border border-slate-200 bg-white` → `rounded-lg border bg-white`.
- `TodaySessions.tsx` dòng 44: `border border-dashed border-slate-200` → `border border-dashed`.

- [ ] **Step 9: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/components/DashboardPage.test.tsx tests/unit/components/DashboardAlerts.test.tsx tests/unit/components/ResponsiveList.test.tsx`
Expected: PASS.

Run: `pnpm exec playwright test tests/e2e/layout-desktop.spec.ts tests/e2e/dashboard-alerts.spec.ts`
Expected: PASS (số tiền 100.000.000 đ không tràn thẻ ở 390/1024/1280/1366 với font Geist).

- [ ] **Step 10: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 11: Commit**

```bash
git add src/components/common/StatCard.tsx src/components/common/PageHeader.tsx src/components/common/ResponsiveList.tsx "src/app/(app)/dashboard/page.tsx" "src/app/(app)/reports/page.tsx" src/components/dashboard/DashboardAlerts.tsx src/components/dashboard/TodaySessions.tsx tests/unit/components/DashboardPage.test.tsx tests/unit/components/DashboardAlerts.test.tsx
git commit -m "feat(dashboard): thẻ số liệu một màu nhấn, tiền nợ đỏ nợ, tiêu đề trang theo mockup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: Quét màu còn lại — lịch, học sinh, môn học, báo cáo, phụ huynh, đăng nhập

**Đọc trước:** Global Constraints; spec mục 5.5 (các dòng còn lại), 8 (E2E desktop "Tạo ca dạy"), 10 (D5); các file liệt kê dưới.

**Files:**
- Test (Mới): `tests/unit/theme-legacy-colors.test.ts`
- Modify: `tests/e2e/layout-desktop.spec.ts` (thêm 1 test vào describe `Sidebar desktop 1280px` của Task 3)
- Modify: `src/components/calendar/MonthCalendar.tsx`, `SessionCard.tsx`, `SessionListItem.tsx`, `CalendarToolbar.tsx`
- Modify: `src/components/reports/ReportPeriodPicker.tsx`
- Modify: `src/components/students/StudentScheduleView.tsx`, `StudentList.tsx`
- Modify: `src/components/subjects/SubjectList.tsx`
- Modify: `src/components/sessions/SessionDetailDialog.tsx:227`
- Modify: `src/components/parent/ParentView.tsx`
- Modify: `src/app/login/LoginHeader.tsx`, `LoginForm.tsx`, `page.tsx`; `src/app/register/RegisterHeader.tsx`, `RegisterForm.tsx`, `page.tsx`

**Interfaces:**
- Consumes: token Task 1 (`bg-primary`, `text-primary`, `bg-primary/[0.08]`, `ring-primary`, `text-debt`, `bg-page`); describe `'Sidebar desktop 1280px'` (đã có `beforeEach` đăng nhập) trong `layout-desktop.spec.ts` từ Task 3.
- Produces: `src/` không còn class `indigo-*`, `violet-*`, `purple-*`.

- [ ] **Step 1: Viết test fail**

Tạo `tests/unit/theme-legacy-colors.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const SRC = join(process.cwd(), "src")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe("A3 — một màu nhấn", () => {
  it("src/ không còn class indigo/violet/purple", () => {
    const hits = walk(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .flatMap((line, i) =>
            /(indigo|violet|purple)-\d/.test(line) ? [`${relative(SRC, f)}:${i + 1}: ${line.trim()}`] : []
          )
      )
    expect(hits).toEqual([])
  })
})
```

Thêm vào describe `'Sidebar desktop 1280px'` trong `tests/e2e/layout-desktop.spec.ts`:

```ts
  test('nút Tạo ca dạy dùng màu nhấn #0F766E', async ({ page }) => {
    await page.goto('/calendar');
    const btn = page.getByRole('button', { name: 'Tạo ca dạy' }).first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  });
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/theme-legacy-colors.test.ts`
Expected: FAIL — liệt kê các dòng còn indigo ở `MonthCalendar`, `SessionCard`, `SessionListItem`, `CalendarToolbar`, `ReportPeriodPicker`, `SessionDetailDialog`, `StudentList`, `StudentScheduleView`, `SubjectList`, `ParentView`, `LoginHeader`, `LoginForm`, `RegisterHeader`, `RegisterForm`. (Nếu còn dòng ở file của Task 1–5 → task đó sót, sửa luôn và ghi vào báo cáo.)

Run: `pnpm exec playwright test tests/e2e/layout-desktop.spec.ts -g "Tạo ca dạy"`
Expected: FAIL — nhận `rgb(15, 23, 42)` (`bg-slate-900`).

- [ ] **Step 3: Lịch**

`CalendarToolbar.tsx`:
- dòng 59: `"bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm"` → `"bg-white p-3 md:p-4 rounded-xl border"`
- dòng 119 (nút `clear_filters`): `"text-indigo-600 h-9 px-2 hover:bg-indigo-50 font-medium"` → `"text-primary h-9 px-2 hover:bg-primary/[0.08] font-medium"`
- dòng 142 (nút tạo ca): `className="gap-2 h-11 md:h-10 bg-slate-900 hover:bg-slate-800 shadow-md shadow-slate-200 px-4 md:px-6"` → `className="gap-2 h-11 md:h-10 px-4 md:px-6"`

`MonthCalendar.tsx`:
- dòng 122 legend "Hỗn hợp": `className="border-indigo-500 bg-indigo-50"` → `className="border-slate-500 bg-slate-100"`
- dòng 127: bỏ ` shadow-sm` khỏi `"hidden md:grid border rounded-lg overflow-hidden bg-slate-200 grid-cols-7 gap-px shadow-sm"`
- dòng 154: bỏ ` shadow-sm` khỏi `"border rounded-xl overflow-hidden bg-slate-200 grid grid-cols-7 gap-px shadow-sm"`
- dòng 178: `"bg-indigo-50 ring-2 ring-inset ring-indigo-500 z-10"` → `"bg-primary/[0.08] ring-2 ring-inset ring-primary z-10"`
- dòng 184: `"text-indigo-700"` → `"text-primary"`
- dòng 193: `"bg-indigo-500"` → `"bg-primary"`
- dòng 205: `"size-2 rounded-full bg-indigo-500"` → `"size-2 rounded-full bg-primary"`
- dòng 223: `text-indigo-600` → `text-primary`

`SessionCard.tsx`:
- dòng 31: `level === "mixed" && "border-indigo-500 bg-indigo-50"` → `level === "mixed" && "border-slate-500 bg-slate-100"`
- dòng 51: `text-indigo-600` → `text-primary`

`SessionListItem.tsx`:
- dòng 20: bỏ ` shadow-sm`
- dòng 26: `bg-indigo-50 ... text-indigo-600` → `bg-primary/[0.08] ... text-primary`

- [ ] **Step 4: Báo cáo, học sinh, môn học, phiên dạy**

`ReportPeriodPicker.tsx`:
- dòng 39: bỏ ` shadow-sm` ở cuối className nút kích hoạt
- dòng 41: `text-indigo-500` → `text-primary`
- dòng 57, 64, 71: `"bg-white shadow-sm text-indigo-600"` → `"bg-white shadow-sm text-primary"`

`StudentScheduleView.tsx`:
- dòng 130: `<Card className="border-slate-200 shadow-md bg-white">` → `<Card className="bg-white">`
- dòng 143: `className="text-indigo-600 border-indigo-200 bg-indigo-50 font-bold px-3 py-1 text-sm"` → `className="text-primary border-transparent bg-primary/[0.08] font-bold px-3 py-1 text-sm"`
- dòng 218: `text-indigo-600` → `text-primary`
- dòng 228: `<Card className="border-slate-200 shadow-sm bg-white">` → `<Card className="bg-white">`
- dòng 231: `text-indigo-600` → `text-primary`
- dòng 280: nhánh cuối `"text-red-600"` → `"text-debt"` (chỉ nhánh chưa đóng; `text-green-600`/`text-amber-600` và số buổi vắng dòng 213 giữ nguyên)

`StudentList.tsx`:
- dòng 249: `"rounded-lg border border-slate-200 bg-white p-4"` → `"rounded-lg border bg-white p-4"`
- dòng 267: `text-indigo-700` → `text-primary`

`SubjectList.tsx`:
- dòng 53: `"flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4"` → `"flex items-center gap-3 rounded-lg border bg-white p-4"`
- dòng 60: `className="shrink-0 border-indigo-200 bg-indigo-50 text-indigo-700"` → `className="shrink-0 border-transparent bg-primary/[0.08] text-primary"`

`SessionDetailDialog.tsx` dòng 227: `text-indigo-500` → `text-primary`.

- [ ] **Step 5: Phụ huynh, đăng nhập, đăng ký**

`ParentView.tsx`:
- dòng 31: `"font-medium text-indigo-700"` → `"font-medium text-primary"`
- dòng 47: `<main className="min-h-screen bg-slate-50">` → `<main className="min-h-screen bg-page">`
- dòng 110: `"shrink-0 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"` → `"shrink-0 rounded bg-primary/[0.08] px-2 py-0.5 text-xs font-medium text-primary"`

`LoginHeader.tsx` dòng 13 và `RegisterHeader.tsx` dòng 13: `bg-indigo-600` → `bg-primary`.

`LoginForm.tsx` dòng 83 và `RegisterForm.tsx` dòng 105: `text-indigo-600` → `text-primary`.

`src/app/login/page.tsx` dòng 14 và `src/app/register/page.tsx` dòng 14: `bg-slate-50` → `bg-page`.

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/theme-legacy-colors.test.ts tests/unit/components/ParentView.test.tsx`
Expected: PASS.

Run:
```bash
grep -rnE "(indigo|violet|purple)-[0-9]" src
```
Expected: rỗng.

Run: `pnpm exec playwright test tests/e2e/layout-desktop.spec.ts tests/e2e/calendar.spec.ts tests/e2e/students.spec.ts tests/e2e/parent-link.spec.ts tests/e2e/auth.spec.ts tests/e2e/mobile.spec.ts`
Expected: PASS (nút "Tạo ca dạy" `rgb(15, 118, 110)`; mobile vẫn không thấy chữ "Hỗn hợp").

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 8: Commit**

```bash
git add tests/unit/theme-legacy-colors.test.ts tests/e2e/layout-desktop.spec.ts src/components/calendar src/components/reports/ReportPeriodPicker.tsx src/components/students/StudentScheduleView.tsx src/components/students/StudentList.tsx src/components/subjects/SubjectList.tsx src/components/sessions/SessionDetailDialog.tsx src/components/parent/ParentView.tsx src/app/login src/app/register
git commit -m "feat(theme): bỏ indigo/violet/purple toàn app, nút tạo ca dùng màu nhấn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

(Trước khi `git add src/components/calendar`, chạy `git status --short src/components/calendar` để chắc chỉ có 4 file của task này.)

---

### Task 7: Kiểm chứng cuối

**Đọc trước:** Global Constraints; Review Focus; spec mục 2, 8 (Chung), 9.

**Files:** không sửa code, trừ khi phát hiện lỗi (sửa, thêm test, commit riêng).

- [ ] **Step 1: Xác nhận lại DB test**

Run:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: 2 host khác nhau (`test=localhost`).

- [ ] **Step 2: Toàn bộ test + lint + build**

Run (tuần tự, không song song):
```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm exec next build
```
Expected: lint/tsc sạch; unit + integration pass (~10–15 phút); build OK.

- [ ] **Step 3: Toàn bộ e2e**

Run: `pnpm exec playwright test`
Expected: pass (upgrade-class có thể skip như trước). Cổng 3000 bận → DỪNG, báo người dùng.

- [ ] **Step 4: Rà code theo tiêu chí spec và Review Focus**

Chạy và ghi kết quả vào báo cáo:
```bash
grep -rnE "(indigo|violet|purple)-[0-9]" src
grep -rn "text-debt\|bg-debt" src
grep -rn "bg-slate-50\b" src/components/layout src/app/login src/app/register src/components/parent
git diff main --stat -- prisma src/server src/lib/constants.ts src/lib/subject-colors.ts src/components/tuition/TuitionNoticeCard.tsx
```
Expected: dòng 1 rỗng; dòng 2 chỉ ở tiền nợ/trạng thái nợ (`TuitionStatusBadge`, `tuition/page.tsx`, `TuitionDetailSheet`, `StudentScheduleView`, `dashboard/page.tsx`, `reports/page.tsx`, `DashboardAlerts`); dòng 3 rỗng; dòng 4 rỗng (không đụng backend, schema, màu môn, phiếu báo).

Đọc lại: `AppHeader` có `min-w-0 truncate` ở lời chào (Review Focus 3); `BottomTabBar` dùng `openAt === pathname` (Review Focus 1); `layout.tsx` có `theme="light"` (Review Focus 4).

- [ ] **Step 5: So mockup bằng mắt (không dùng DB production)**

Nếu có thể chạy trình duyệt trên server e2e (DB test): mở 5 màn (Tổng quan, Lịch, Học sinh, Học phí, sheet Thêm) ở 390px và 1440px, so với mockup. Ghi các chỗ lệch. Rà riêng rủi ro spec mục 9: ô logo login/register 48px `rounded-lg` (giờ 14px) và nhóm nút đổi tháng `tuition/page.tsx:150` — nếu trông quá tròn thì hạ về `rounded-md` tại chỗ, commit riêng `fix(theme): ...`. Đổi ngôn ngữ sang EN, xác nhận tab bar không tràn (Review Focus 5).

- [ ] **Step 6: Ghi bước kiểm tra tay cho người dùng (đưa vào báo cáo, không tự làm trên production)**

1. Sau merge, trên điện thoại: tab bar 5 ô (Tổng quan · Lịch · Học sinh · Học phí · Thêm); bấm Thêm → sheet 3 mục; vào Báo cáo/Môn học/Cài đặt thấy tab Thêm sáng; bấm Back khi sheet mở → sheet đóng.
2. Máy tính: sidebar có nhóm "Quản lý" sát đáy; menu avatar chỉ còn Sao lưu dữ liệu, Đổi mật khẩu, Đăng xuất.
3. Để điện thoại ở chế độ tối, thao tác lưu gì đó → toast vẫn nền sáng.
4. Tạo phiếu báo học phí → tải ảnh / chia sẻ Zalo: phiếu hiển thị bình thường (giờ chữ là Geist thay font hệ thống — phiếu không đổi màu/bố cục).
5. Lưới lịch desktop: màu THCS (emerald) có dễ lẫn với màu nhấn không (spec mục 9, chấp nhận trong A3).
6. Trang phụ huynh `/p/[token]` mở trên Zalo: link tháng và nhãn "Hôm nay" màu nhấn mới.

- [ ] **Step 7: Bàn giao**

Báo cáo cho người điều phối: kết quả Step 2–5, mọi lệch so với plan (kể cả `--muted-foreground` nếu phải hạ ở Task 1), danh sách kiểm tra tay Step 6. **Không merge, không push.**
