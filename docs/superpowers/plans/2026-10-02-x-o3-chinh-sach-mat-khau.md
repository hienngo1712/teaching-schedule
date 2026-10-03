# X — O3 + chính sách nổi bật + xác nhận mật khẩu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cảnh báo khi còn bản rõ ở trường mã hoá + tài liệu khoá (O3); khung tóm tắt 4 ý chính sách ở trang Đăng ký và `/privacy`; ô "Nhập lại mật khẩu" ở trang Đăng ký. Version `0.9.5`.

**Architecture:** O3 sửa 1 nhánh trong `decryptResult` (`src/server/crypto/prisma-encryption.ts`). Chính sách: component mới `PrivacySummary` dùng ở `RegisterForm` và `PrivacyContent`. Mật khẩu: schema riêng cho form (`registerFormSchema`) kiểm ở client, payload gửi server không đổi.

**Tech Stack:** Next.js 15 App Router, React 19, react-hook-form + zod 3.25, tRPC v11, lucide-react, Vitest + Testing Library (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-x-o3-chinh-sach-mat-khau-design.md`

## Global Constraints

- Nhánh `feat/x-o3-chinh-sach-mat-khau` từ `main` (spec/plan đã trên main). Version cuối `0.9.5` (patch).
- **Không migration, không sửa `prisma/schema.prisma`, không đổi API `auth.register`** (`registerSchema`, `registerInputSchema` giữ nguyên).
- An toàn DB: chỉ `.env.test` (localhost:5433). Cấm `db:reset` / `migrate reset` / `db push` trên `.env`. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.
- Không `pnpm build` / `pnpm dev`. e2e: kiểm RAM ≥ 3000 MB, chạy foreground chia 2 nửa, dọn tiến trình sau mỗi lần chạy (LENH.md).
- **Không đổi lời văn 5 mục chính sách, không nâng `CONSENT_TEXT_VERSION`.**
- **Không bao giờ in giá trị dữ liệu, khoá, URL DB thật** (log, docs, báo cáo).
- Màu A3: `primary` (#0F766E) / slate; không indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts`). Vùng chạm ≥ 44px trên mobile (`min-h-11`).
- Chuỗi giao diện mới thêm đủ `src/language/vi.json` + `en.json` (cùng bộ key); không dùng gạch dài (—, –) trong chuỗi.
- Commit Gehihi: 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + `pnpm exec tsc --noEmit` + `pnpm lint` sạch → commit → ledger `.superpowers/sdd/2026-10-02-x-o3-chinh-sach-mat-khau/progress.md`.

## Review Focus

1. **Cảnh báo bản rõ báo nhầm**: chuỗi đã giải mã không được đi qua `decryptResult` lần 2 trong cùng 1 kết quả; giá trị không thuộc trường mã hoá (vd `username`, `title`) không bao giờ cảnh báo. Pin: Task 1 test "trường không mã hoá / bản mã hoá không cảnh báo".
2. **Người dùng gõ lại ô Mật khẩu sau khi đã báo lỗi không khớp**: lỗi phải tự mất khi 2 ô khớp lại, không bắt bấm Đăng ký lần nữa mới mất. Pin: Task 3 test "sửa mật khẩu cho khớp → lỗi biến mất".
3. **Payload đăng ký lọt `confirmPassword`**: server dùng zod `.object` (strip) nên không vỡ, nhưng không được gửi mật khẩu 2 lần qua mạng. Pin: Task 3 test "payload không có confirmPassword".
4. **Link "Đọc đầy đủ" trên mobile**: mở tab mới, form giữ nguyên dữ liệu đã nhập; link cao ≥ 44px. Pin: Task 2 test (`target`, `rel`, `min-h-11`).
5. **`/privacy` vẫn đúng 5 mục `h2`**: khung tóm tắt không dùng heading (e2e cũ đếm `h2` = 5). Pin: Task 2 unit "PrivacyContent: 5 h2, có khung tóm tắt, không có link Đọc đầy đủ".

---

### Task 1: O3 — cảnh báo bản rõ còn sót + tài liệu khoá

**Files:**
- Modify: `src/server/crypto/prisma-encryption.ts:91-94` (`decryptResult`)
- Modify: `docs/05-deploy.md` (thêm mục cuối)
- Test: `tests/unit/crypto/prisma-encryption.test.ts` (bổ sung)

**Interfaces:**
- Produces: `resetPlaintextWarnings(): void` (export, chỉ cho test). Hành vi `decryptResult` không đổi kết quả trả về, chỉ thêm `console.warn`.

- [ ] **Step 1: Test đỏ** — thêm cuối `tests/unit/crypto/prisma-encryption.test.ts` (import `vi` vào dòng import vitest sẵn có; thêm `resetPlaintextWarnings` vào import từ `@/server/crypto/prisma-encryption`; `encryptField` import từ `@/server/crypto/field-crypto`):

```ts
describe("O3: cảnh báo bản rõ còn sót (spec X §2)", () => {
  it("cảnh báo đúng 1 lần mỗi tên trường, không in giá trị; rỗng/null không cảnh báo", () => {
    resetPlaintextWarnings()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    decryptResult({ fullName: "Bí Mật A", notes: "", note: null })
    decryptResult([{ fullName: "Bí Mật B" }])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toBe("[crypto] còn bản rõ ở trường fullName")
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Bí Mật")
    warn.mockRestore()
  })

  it("trường không mã hoá và bản đã mã hoá không cảnh báo; vẫn giải mã đúng", () => {
    resetPlaintextWarnings()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const out = decryptResult({ username: "gv1", title: "Ca 1", parentPhone: encryptField("0901", "parentPhone") })
    expect(out.parentPhone).toBe("0901")
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("mỗi trường cảnh báo riêng", () => {
    resetPlaintextWarnings()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    decryptResult({ fullName: "A", parentName: "B" })
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      "[crypto] còn bản rõ ở trường fullName",
      "[crypto] còn bản rõ ở trường parentName",
    ])
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: Chạy** `pnpm test tests/unit/crypto/prisma-encryption.test.ts` → Expected: FAIL (`resetPlaintextWarnings` is not a function / không export).

- [ ] **Step 3: Cài đặt** trong `src/server/crypto/prisma-encryption.ts`, ngay trên `export function decryptResult`:

```ts
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
```

Thay nhánh chuỗi của `decryptResult`:

```ts
  if (typeof node === "string") {
    if (!key || !ENCRYPTED_KEYS.has(key)) return node
    if (isEncrypted(node)) return decryptField(node, key) as T
    if (node !== "") warnPlaintext(key)
    return node
  }
```

- [ ] **Step 4: Chạy** `pnpm test tests/unit/crypto/prisma-encryption.test.ts tests/integration/field-encryption.test.ts tests/integration/crypto-backfill.test.ts` → Expected: PASS (test "bản rõ chèn bằng raw vẫn đọc đúng" vẫn xanh, chỉ có thêm dòng warn trong output).

- [ ] **Step 5: Tài liệu** — thêm cuối `docs/05-deploy.md`:

````markdown
## Khoá mã hoá dữ liệu cá nhân (spec O)

**Biến env** (Vercel → Production, kiểu Sensitive; không đặt ở Preview, không đặt trong `.env`):
- `DATA_ENCRYPTION_KEYS="k1:<base64 32 byte>[,k2:<base64 32 byte>]"`
- `DATA_ENCRYPTION_ACTIVE_KID="k1"` (khoá dùng để ghi; đọc theo `kid` trong từng giá trị)

**Sinh khoá:** `node -e "console.log('k1:' + require('crypto').randomBytes(32).toString('base64'))"`.
**Lưu dự phòng ở 2 nơi khác nhau trước khi dán vào Vercel. Mất khoá = mất toàn bộ dữ liệu đã mã hoá.** Không gửi khoá qua chat, không chụp màn hình.

**Xoay khoá** (nghi lộ khoá, hoặc 1–2 năm/lần):
1. Sinh `k2`, lưu dự phòng như trên.
2. Vercel: `DATA_ENCRYPTION_KEYS=k1:<cũ>,k2:<mới>`, `DATA_ENCRYPTION_ACTIVE_KID=k2` → redeploy.
3. Tạo Neon backup branch → chạy `--rotate` → `--verify` (mã thoát 0).
4. Bỏ `k1` khỏi env, redeploy. Giữ bản dự phòng `k1` tới khi mọi Neon branch chứa dữ liệu mã hoá bằng `k1` đã xoá.

**Script `scripts/crypto-backfill.ts`** (người dùng tự chạy ở terminal của mình, truyền env trong lệnh, script không đọc `.env`):
```
DATABASE_URL=... DATA_ENCRYPTION_KEYS=... DATA_ENCRYPTION_ACTIVE_KID=... [CONFIRM_HOST=<host DB>] \
  pnpm exec tsx scripts/crypto-backfill.ts [--dry-run|--apply|--verify|--decrypt|--rotate] [--batch 200]
```
- Mặc định `--dry-run` (chỉ đếm). `--apply` mã hoá bản rõ; `--verify` kiểm không còn bản rõ + giải mã được hết; `--decrypt` trả về bản rõ (rollback); `--rotate` mã hoá lại bằng khoá active.
- `--apply` / `--decrypt` / `--rotate` cần `CONFIRM_HOST` đúng bằng host trong `DATABASE_URL`.
- Mã thoát: `0` ổn, `1` cấu hình / xác nhận sai, `2` verify thấy bản rõ hoặc lỗi giải mã.

**Theo dõi:** Vercel log có `[crypto] còn bản rõ ở trường <tên>` = có đường ghi vòng qua extension → tìm và sửa, rồi chạy `--apply` lại. `FieldDecryptError` = thiếu/sai khoá.

**Neon branch chứa bản rõ:** branch backup tạo trước O2 còn dữ liệu chưa mã hoá → xoá sau khi O3 chạy ổn (người dùng tự xoá).
````

- [ ] **Step 6: Kiểm + commit**
Run: `pnpm exec tsc --noEmit` và `pnpm lint` → Expected: sạch.
```bash
git add src/server/crypto/prisma-encryption.ts tests/unit/crypto/prisma-encryption.test.ts docs/05-deploy.md
git commit -m "feat(x): O3 cảnh báo bản rõ còn sót ở trường mã hoá, tài liệu vận hành khoá"
```

---

### Task 2: Khung tóm tắt chính sách (Đăng ký + `/privacy`)

**Files:**
- Create: `src/components/privacy/PrivacySummary.tsx`
- Modify: `src/components/privacy/PrivacyContent.tsx`, `src/app/register/RegisterForm.tsx`, `src/components/common/ConsentCheckbox.tsx` (chỉ ghi chú), `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/PrivacySummary.test.tsx` (mới), `tests/unit/components/PrivacyContent.test.tsx` (mới), `tests/unit/components/RegisterForm.test.tsx` (sửa), `tests/e2e/consent-privacy.spec.ts` (sửa)

**Interfaces:**
- Produces: `PrivacySummary({ showFullLink?: boolean }): JSX.Element` (mặc định `false`). i18n key mới: `privacy_summary_title`, `privacy_summary_store_lead`, `privacy_summary_store`, `privacy_summary_protect_lead`, `privacy_summary_protect`, `privacy_summary_who_lead`, `privacy_summary_who`, `privacy_summary_delete_lead`, `privacy_summary_delete`, `privacy_read_full`.

- [ ] **Step 1: i18n** — thêm vào `src/language/vi.json` (ngay sau `"privacy_version"`):

```json
  "privacy_summary_title": "Trước khi đăng ký, bạn nên biết",
  "privacy_summary_store_lead": "Lưu gì:",
  "privacy_summary_store": "tài khoản của bạn và dữ liệu học sinh, lịch dạy, học phí do bạn nhập.",
  "privacy_summary_protect_lead": "Bảo vệ thế nào:",
  "privacy_summary_protect": "họ tên, số điện thoại, số tài khoản được mã hoá; mật khẩu không ai đọc được.",
  "privacy_summary_who_lead": "Ai xem được:",
  "privacy_summary_who": "chỉ bạn. Quản trị viên chỉ thấy thông tin gói. Không bán, không quảng cáo.",
  "privacy_summary_delete_lead": "Xoá dữ liệu:",
  "privacy_summary_delete": "dữ liệu xoá vào thùng rác; xoá hẳn hoặc xoá tài khoản thì liên hệ {contact}.",
  "privacy_read_full": "Đọc đầy đủ chính sách",
```
`src/language/en.json` (cùng vị trí):
```json
  "privacy_summary_title": "Before you sign up",
  "privacy_summary_store_lead": "What we store:",
  "privacy_summary_store": "your account and the student, schedule and tuition data you enter.",
  "privacy_summary_protect_lead": "How it is protected:",
  "privacy_summary_protect": "names, phone numbers and bank account numbers are encrypted; nobody can read your password.",
  "privacy_summary_who_lead": "Who can see it:",
  "privacy_summary_who": "only you. Admins only see plan information. No selling, no ads.",
  "privacy_summary_delete_lead": "Deleting data:",
  "privacy_summary_delete": "deleted data goes to the trash; to erase it or close your account, contact {contact}.",
  "privacy_read_full": "Read the full policy",
```

- [ ] **Step 2: Test đỏ** — `tests/unit/components/PrivacySummary.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PRIVACY_CONTACT } from "@/lib/privacy"
import { PrivacySummary } from "@/components/privacy/PrivacySummary"

function renderVi(ui: React.ReactElement) {
  return render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)
}

describe("PrivacySummary (spec X §3)", () => {
  it("hiện tiêu đề + 4 ý, thay {contact}, không dùng heading", () => {
    const { container } = renderVi(<PrivacySummary />)
    expect(screen.getByText(viText.privacy_summary_title)).toBeTruthy()
    for (const lead of [
      viText.privacy_summary_store_lead,
      viText.privacy_summary_protect_lead,
      viText.privacy_summary_who_lead,
      viText.privacy_summary_delete_lead,
    ]) {
      expect(screen.getByText(lead)).toBeTruthy()
    }
    expect(container.textContent).toContain(PRIVACY_CONTACT)
    expect(container.textContent).not.toContain("{contact}")
    expect(container.querySelector("h1,h2,h3")).toBeNull()
  })

  it("mặc định không có link Đọc đầy đủ", () => {
    renderVi(<PrivacySummary />)
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("showFullLink: link /privacy mở tab mới, rel noopener, cao ≥ 44px", () => {
    renderVi(<PrivacySummary showFullLink />)
    const link = screen.getByRole("link", { name: new RegExp(viText.privacy_read_full) })
    expect(link.getAttribute("href")).toBe("/privacy")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(link.className).toContain("min-h-11")
  })
})
```

`tests/unit/components/PrivacyContent.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { PrivacyContent } from "@/components/privacy/PrivacyContent"

describe("PrivacyContent (spec X §3.2)", () => {
  it("có khung tóm tắt, vẫn đúng 5 mục h2, không có link Đọc đầy đủ", () => {
    render(<LanguageProvider forcedLanguage="vi"><PrivacyContent /></LanguageProvider>)
    expect(screen.getByText(viText.privacy_summary_title)).toBeTruthy()
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5)
    expect(screen.queryByRole("link", { name: new RegExp(viText.privacy_read_full) })).toBeNull()
  })
})
```

Sửa `tests/unit/components/RegisterForm.test.tsx`, thay khối "Link tới /privacy":

```tsx
    // Khung tóm tắt + link đọc đầy đủ mở tab mới (spec X §3.1); không còn link chữ nhỏ ở chân form.
    expect(screen.getByText(viText.privacy_summary_title)).toBeTruthy()
    const privacyLink = screen.getByRole("link", { name: new RegExp(viText.privacy_read_full) })
    expect(privacyLink.getAttribute("href")).toBe("/privacy")
    expect(privacyLink.getAttribute("target")).toBe("_blank")
    expect(screen.queryByRole("link", { name: viText.privacy_title })).toBeNull()
```

- [ ] **Step 3: Chạy** `pnpm test tests/unit/components/PrivacySummary.test.tsx tests/unit/components/PrivacyContent.test.tsx tests/unit/components/RegisterForm.test.tsx` → Expected: FAIL (không tìm thấy module `PrivacySummary`; không thấy `privacy_summary_title`).

- [ ] **Step 4: Cài đặt** — `src/components/privacy/PrivacySummary.tsx`:

```tsx
"use client"

import { Database, ExternalLink, Lock, ShieldCheck, Trash2, UserRound, type LucideIcon } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PRIVACY_CONTACT } from "@/lib/privacy"
import type vi from "@/language/vi.json"

const POINTS: { icon: LucideIcon; lead: keyof typeof vi; body: keyof typeof vi }[] = [
  { icon: Database, lead: "privacy_summary_store_lead", body: "privacy_summary_store" },
  { icon: Lock, lead: "privacy_summary_protect_lead", body: "privacy_summary_protect" },
  { icon: UserRound, lead: "privacy_summary_who_lead", body: "privacy_summary_who" },
  { icon: Trash2, lead: "privacy_summary_delete_lead", body: "privacy_summary_delete" },
]

// Diễn giải lại 5 mục chính sách sẵn có, không thêm cam kết mới → không nâng CONSENT_TEXT_VERSION.
// Không dùng heading: /privacy phải giữ đúng 5 h2 (e2e consent-privacy).
export function PrivacySummary({ showFullLink = false }: { showFullLink?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-slate-700">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
        {t("privacy_summary_title")}
      </p>
      <ul className="space-y-2">
        {POINTS.map(({ icon: Icon, lead, body }) => (
          <li key={lead} className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <strong className="font-semibold text-slate-900">{t(lead)}</strong>{" "}
              {t(body).replace("{contact}", PRIVACY_CONTACT)}
            </span>
          </li>
        ))}
      </ul>
      {showFullLink && (
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline underline-offset-2"
        >
          {t("privacy_read_full")}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      )}
    </div>
  )
}
```

`src/components/privacy/PrivacyContent.tsx`: import `PrivacySummary`, chèn `<PrivacySummary />` ngay dưới `<h1>`.

`src/app/register/RegisterForm.tsx`:
- import `import { PrivacySummary } from "@/components/privacy/PrivacySummary"`.
- Chèn `<PrivacySummary showFullLink />` ngay **trên** `<ConsentCheckbox … />`.
- Xoá khối cuối `<div className="text-center"><Link href="/privacy" …>{t("privacy_title")}</Link></div>`.

`src/components/common/ConsentCheckbox.tsx`: thay dòng ghi chú thứ 2 bằng
`// Không đặt link trong ô đồng ý; trang Đăng ký có link "Đọc đầy đủ" mở tab mới ở khung tóm tắt (spec X).`

- [ ] **Step 5: Chạy lại** 3 file test Step 3 + `pnpm test tests/unit/components/ConsentCheckbox.test.tsx tests/unit/theme-legacy-colors.test.ts` → Expected: PASS.

- [ ] **Step 6: e2e** — trong `tests/e2e/consent-privacy.spec.ts`, test `'/login có link tới /privacy; /register …'`, sau `await page.goto('/register');` thêm:

```ts
    await expect(page.getByText('Trước khi đăng ký, bạn nên biết')).toBeVisible();
    const full = page.getByRole('link', { name: /Đọc đầy đủ chính sách/ });
    await expect(full).toHaveAttribute('href', '/privacy');
    await expect(full).toHaveAttribute('target', '_blank');
```
Test `/privacy …` thêm: `await expect(page.getByText('Trước khi đăng ký, bạn nên biết')).toBeVisible();` (vẫn giữ `toHaveCount(5)` cho h2).

Run: `pnpm exec playwright test tests/e2e/consent-privacy.spec.ts` → Expected: PASS (5 test).

- [ ] **Step 7: Kiểm + commit**
`pnpm exec tsc --noEmit` + `pnpm lint` → sạch.
```bash
git add src/components/privacy/PrivacySummary.tsx src/components/privacy/PrivacyContent.tsx src/app/register/RegisterForm.tsx src/components/common/ConsentCheckbox.tsx src/language/vi.json src/language/en.json tests/unit/components/PrivacySummary.test.tsx tests/unit/components/PrivacyContent.test.tsx tests/unit/components/RegisterForm.test.tsx tests/e2e/consent-privacy.spec.ts
git commit -m "feat(x): khung tóm tắt chính sách bảo mật ở trang Đăng ký và /privacy, link đọc đầy đủ mở tab mới"
```

---

### Task 3: Ô "Nhập lại mật khẩu" + version 0.9.5

**Files:**
- Modify: `src/lib/schemas/auth.ts`, `src/app/register/RegisterForm.tsx`, `src/language/vi.json`, `src/language/en.json`, `tests/e2e/consent-privacy.spec.ts`, `tests/e2e/admin-new-accounts.spec.ts`, `package.json`
- Test: `tests/unit/components/RegisterForm.test.tsx` (sửa + thêm), `tests/unit/schemas/register-form-schema.test.ts` (mới)

**Interfaces:**
- Consumes: `registerSchema` (giữ nguyên) từ `src/lib/schemas/auth.ts`.
- Produces: `registerFormSchema(mismatchMessage: string)` trả zod schema `{ username, password, fullName, confirmPassword }`; `type RegisterFormValues = z.infer<ReturnType<typeof registerFormSchema>>`. i18n: `register_confirm_password`, `register_password_mismatch`.

- [ ] **Step 1: i18n** — `vi.json` (cạnh các key `register_*`):
```json
  "register_confirm_password": "Nhập lại mật khẩu",
  "register_password_mismatch": "Mật khẩu nhập lại không khớp",
```
`en.json`:
```json
  "register_confirm_password": "Confirm password",
  "register_password_mismatch": "Passwords do not match",
```

- [ ] **Step 2: Test đỏ** — `tests/unit/schemas/register-form-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { registerFormSchema } from "@/lib/schemas/auth"

const base = { username: "gv_moi", password: "MatKhau123456", fullName: "" }

describe("registerFormSchema (spec X §4)", () => {
  it("khớp → hợp lệ", () => {
    expect(registerFormSchema("x").safeParse({ ...base, confirmPassword: "MatKhau123456" }).success).toBe(true)
  })

  it("không khớp → lỗi ở confirmPassword với message truyền vào", () => {
    const r = registerFormSchema("Không khớp").safeParse({ ...base, confirmPassword: "MatKhau12345" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues).toEqual([
        expect.objectContaining({ path: ["confirmPassword"], message: "Không khớp" }),
      ])
    }
  })

  it("ô xác nhận trống → không hợp lệ", () => {
    expect(registerFormSchema("x").safeParse({ ...base, confirmPassword: "" }).success).toBe(false)
  })
})
```

Trong `tests/unit/components/RegisterForm.test.tsx`: ở test sẵn có, sau dòng điền `password` thêm
```tsx
    fireEvent.change(screen.getByLabelText(viText.register_confirm_password), { target: { value: "MatKhau123456" } })
```
và sau `expect(registerMutate).toHaveBeenCalledWith(...)` thêm
```tsx
    expect(registerMutate.mock.calls[0][0]).not.toHaveProperty("confirmPassword")
```
Thêm `describe` mới cuối file:

```tsx
describe("RegisterForm: nhập lại mật khẩu (spec X §4)", () => {
  beforeEach(() => registerMutate.mockReset())

  function fill(pw: string, confirm: string) {
    fireEvent.change(screen.getByLabelText(viText.username), { target: { value: "giaovien_test" } })
    fireEvent.change(screen.getByLabelText(viText.password), { target: { value: pw } })
    fireEvent.change(screen.getByLabelText(viText.register_confirm_password), { target: { value: confirm } })
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_register }))
  }

  it("không khớp → hiện lỗi dưới ô xác nhận, không gọi đăng ký", async () => {
    render(<LanguageProvider><RegisterForm /></LanguageProvider>)
    fill("MatKhau123456", "MatKhau654321")
    fireEvent.click(screen.getByRole("button", { name: viText.register }))
    expect(await screen.findByText(viText.register_password_mismatch)).toBeTruthy()
    expect(registerMutate).not.toHaveBeenCalled()
  })

  it("sửa ô Mật khẩu cho khớp → lỗi biến mất, gửi được", async () => {
    render(<LanguageProvider><RegisterForm /></LanguageProvider>)
    fill("MatKhau123456", "MatKhau654321")
    fireEvent.click(screen.getByRole("button", { name: viText.register }))
    await screen.findByText(viText.register_password_mismatch)
    fireEvent.change(screen.getByLabelText(viText.password), { target: { value: "MatKhau654321" } })
    await waitFor(() => expect(screen.queryByText(viText.register_password_mismatch)).toBeNull())
    fireEvent.click(screen.getByRole("button", { name: viText.register }))
    await waitFor(() => expect(registerMutate).toHaveBeenCalledTimes(1))
    expect(registerMutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ password: "MatKhau654321", consent: CONSENT_ACCEPTED })
    )
    expect(registerMutate.mock.calls[0][0]).not.toHaveProperty("confirmPassword")
  })
})
```

- [ ] **Step 3: Chạy** `pnpm test tests/unit/schemas/register-form-schema.test.ts tests/unit/components/RegisterForm.test.tsx` → Expected: FAIL (`registerFormSchema` không export; không có ô label "Nhập lại mật khẩu").

- [ ] **Step 4: Cài đặt** — `src/lib/schemas/auth.ts`, sau `registerInputSchema`:

```ts
// Chỉ dùng ở form: ô nhập lại kiểm ở client, payload gửi server vẫn là registerSchema (spec X §4).
export function registerFormSchema(mismatchMessage: string) {
  return registerSchema
    .extend({ confirmPassword: z.string().min(1, mismatchMessage) })
    .refine((v) => v.password === v.confirmPassword, { message: mismatchMessage, path: ["confirmPassword"] })
}

export type RegisterFormValues = z.infer<ReturnType<typeof registerFormSchema>>
```

`src/app/register/RegisterForm.tsx`:
- Import: `useEffect, useMemo, useState` từ `react`; `registerFormSchema, type RegisterFormValues` thay cho `registerSchema, type RegisterInput`.
- Form:
```tsx
  const schema = useMemo(() => registerFormSchema(t("register_password_mismatch")), [t])
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", fullName: "", confirmPassword: "" },
  })

  // Resolver chỉ cập nhật lỗi của ô vừa sửa → đổi Mật khẩu phải tự kiểm lại ô Nhập lại.
  const password = form.watch("password")
  useEffect(() => {
    if (form.getValues("confirmPassword")) void form.trigger("confirmPassword")
  }, [password, form])
```
- Submit:
```tsx
  function onSubmit({ confirmPassword: _confirm, ...values }: RegisterFormValues) {
    if (!consent) return
    mutation.mutate({ ...values, consent: CONSENT_ACCEPTED })
  }
```
(nếu lint báo biến `_confirm` không dùng, dùng `const { confirmPassword, ...values } = data; void confirmPassword` theo quy ước lint của repo.)
- Thêm `FormField` ngay dưới ô `password`:
```tsx
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("register_confirm_password")}</FormLabel>
              <FormControl>
                <PasswordInput placeholder="••••••••••" {...field} disabled={mutation.isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
```

- [ ] **Step 5: Chạy lại** Step 3 + `pnpm test tests/integration/register.test.ts` → Expected: PASS (server không đổi).

- [ ] **Step 6: e2e điền thêm ô xác nhận**
- `tests/e2e/admin-new-accounts.spec.ts` `registerViaForm`: sau `page.fill('input[name="password"]', PASSWORD);` thêm `await page.fill('input[name="confirmPassword"]', PASSWORD);`
- `tests/e2e/consent-privacy.spec.ts` (test `/register`): không gửi form nên không cần điền; thêm kiểm `await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();`.
- Tìm thêm chỗ điền form Đăng ký: `grep -rn "goto('/register')" tests/e2e` → mỗi chỗ có `page.fill('input[name="password"]'` + submit thì thêm dòng điền `confirmPassword` cùng giá trị.

Run: `pnpm exec playwright test tests/e2e/consent-privacy.spec.ts tests/e2e/admin-new-accounts.spec.ts` → Expected: PASS.

- [ ] **Step 7: Version + bộ đầy đủ**
`package.json` → `"version": "0.9.5"`.
Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test` → Expected: sạch, PASS toàn bộ.
e2e đầy đủ 2 nửa theo LENH.md → Expected: PASS (ghi số test vào báo cáo).

- [ ] **Step 8: Commit**
```bash
git add src/lib/schemas/auth.ts src/app/register/RegisterForm.tsx src/language/vi.json src/language/en.json tests/unit/schemas/register-form-schema.test.ts tests/unit/components/RegisterForm.test.tsx tests/e2e/consent-privacy.spec.ts tests/e2e/admin-new-accounts.spec.ts package.json
git commit -m "feat(x): ô nhập lại mật khẩu ở trang Đăng ký; v0.9.5"
```

Báo cáo cho Claude: số test unit/e2e, mọi `Ruling:`; nhắc sau merge người dùng xoá Neon branch `backup-truoc-o1-ma-hoa` và cân nhắc xoay khoá.
