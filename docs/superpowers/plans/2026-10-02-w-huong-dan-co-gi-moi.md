# W — Hướng dẫn + thẻ "Bắt đầu" + "Có gì mới" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang `/guide` (in ra PDF được), thẻ 5 bước trên Tổng quan cho người mới, nút + ô "Có gì mới" tự mở 1 lần mỗi bản có tính năng mới, trang `/updates`. Version `0.10.0`.

**Architecture:** Nội dung tĩnh trong code: `src/lib/guide-content.ts` (hướng dẫn) và `src/lib/releases.ts` (các bản cập nhật). 2 cột mới trên `users` (`last_seen_release`, `onboarding_dismissed_at`) + 2 router tRPC nhỏ (`release`, `onboarding`). UI: `StartCard` trên `/dashboard`, `WhatsNew` trong `AppHeader`, 2 trang công khai `/guide`, `/updates` (bố cục như `/privacy`, nút "Tải PDF" = `window.print()` + class `print:` của Tailwind).

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, React Query v5, Prisma 5.22 + PostgreSQL, shadcn Popover/Sheet (Radix), lucide-react, Tailwind 3.4 (`print:` variant), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-w-huong-dan-co-gi-moi-design.md`

## Global Constraints

- Nhánh `feat/w-huong-dan-co-gi-moi` từ `main` **sau khi X (0.9.5) đã merge**. Version cuối `0.10.0` (minor → mọi người đăng nhập lại 1 lần; đúng ý spec §6).
- **Migration chỉ thêm 2 cột null** trên `users`. Tạo bằng `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name add_release_onboarding`, đọc SQL, áp `... pnpm exec prisma migrate deploy` lên DB test (kiểm dòng `localhost:5433`). Không áp prod (Vercel tự `migrate deploy` khi build). Prisma đòi reset / báo drift → DỪNG, báo Claude.
- An toàn DB: chỉ `.env.test` (localhost:5433). Cấm `db:reset` / `migrate reset` / `db push` / `pnpm db:migrate:*` trên mọi DB. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.
- Không `pnpm build` / `pnpm dev`. e2e: RAM ≥ 3000 MB, foreground, chia 2 nửa, dọn tiến trình (LENH.md).
- **Không lọc/sắp DB theo trường mã hoá** (`bankAccountNumber`, `fullName`…): extension ném `EncryptedFieldQueryError`. Đọc ra rồi kiểm ở JS.
- Xoá mềm: `Student/Subject/TeachingSession/Payment` tự lọc `isDeleted:false` ở cấp cao nhất; quan hệ lồng (`session: {…}`) phải tự thêm `isDeleted: false`.
- Nội dung hướng dẫn và bản cập nhật **chỉ tiếng Việt**; nhãn khung (tiêu đề trang, nút, mục lục, nhãn loại) qua i18n `vi.json` + `en.json` cùng bộ key. Chuỗi mới không dùng gạch dài (—, –).
- Màu A3: `primary` (#0F766E), teal, slate, amber; **không indigo/violet/purple** (`tests/unit/theme-legacy-colors.test.ts`). Vùng chạm ≥ 44px mobile (`size-11` / `min-h-11`).
- `page.tsx` / `layout.tsx` không có định danh `params` / `searchParams` (kể cả comment) — `tests/unit/next15-contract.test.ts`.
- Commit Gehihi: 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + `pnpm exec tsc --noEmit` + `pnpm lint` sạch → commit → ledger `.superpowers/sdd/2026-10-02-w-huong-dan-co-gi-moi/progress.md`.

## Review Focus

1. **Ô "Có gì mới" tự mở chặn thao tác ở mọi e2e cũ** (tài khoản seed có `last_seen_release` null): `tests/setup.ts` phải đặt `lastSeenRelease` = bản mới nhất và `onboardingDismissedAt` cho 4 tài khoản seed; e2e riêng của W tự đặt null rồi trả lại. Pin: Task 1 Step 6 + Task 5 e2e.
2. **Đóng ô khi mạng lỗi / markSeen lỗi**: ô đóng bình thường, không toast lỗi, lần tải sau mở lại. Pin: Task 4 test "markSeen lỗi → không toast, ô vẫn đóng".
3. **Gửi version cũ / lạ lên `markSeen`** (tab cũ chưa tải lại sau deploy): không lùi `last_seen_release`, version không có trong `RELEASES` → BAD_REQUEST. Pin: Task 1 integration.
4. **Thẻ Bắt đầu đếm nhầm**: HS/ca đã xoá mềm, điểm danh của ca đã xoá, dữ liệu user khác không được tính. Pin: Task 2 integration.
5. **Quên thêm mục cập nhật khi nâng version sau này**: test `RELEASES[0].version === package.json` đỏ ngay. Pin: Task 1 unit.

---

### Task 1: Dữ liệu bản cập nhật + cột DB + router `release` + đăng ký ghi `lastSeenRelease` + version 0.10.0

**Files:**
- Create: `src/lib/releases.ts`, `src/server/services/release.service.ts`, `src/server/trpc/routers/release.ts`, `prisma/migrations/<timestamp>_add_release_onboarding/migration.sql` (Prisma sinh)
- Modify: `prisma/schema.prisma` (model `User`), `src/server/trpc/root.ts`, `src/server/services/user.service.ts` (`registerUser`), `tests/setup.ts`, `package.json`
- Test: `tests/unit/lib/releases.test.ts` (mới), `tests/integration/release.test.ts` (mới)

**Interfaces:**
- Produces (`src/lib/releases.ts`):
  - `type ReleaseKind = "new" | "improve" | "fix"`
  - `type ReleaseItem = { kind: ReleaseKind; title: string; body: string; guideId?: string }`
  - `type Release = { version: string; date: string; title: string; summary: string; notify: boolean; items: ReleaseItem[] }`
  - `RELEASES: Release[]` (mới nhất đầu tiên)
  - `compareVersions(a: string, b: string): number` (âm/0/dương)
  - `latestNotifyRelease(): Release | undefined`
  - `hasUnseenRelease(lastSeen: string | null): boolean`
  - `isKnownRelease(version: string): boolean`
  - `shortVersion(version: string): string` (`"0.10.0"` → `"v0.10"`)
  - `formatReleaseDate(date: string): string` (`"2026-10-05"` → `"05/10/2026"`)
- Produces (tRPC): `release.status` → `{ lastSeenRelease: string | null }`; `release.markSeen({ version: string })` → `{ lastSeenRelease: string | null }`.
- Produces (DB): `User.lastSeenRelease String? @db.VarChar(20)`, `User.onboardingDismissedAt DateTime?` (Task 2 dùng).

- [ ] **Step 1: Schema + migration**

`prisma/schema.prisma`, model `User`, sau dòng `deletedBy`:
```prisma
  // Bản "Có gì mới" đã xem gần nhất; null = chưa xem bản nào (spec W §5.4).
  lastSeenRelease       String?   @map("last_seen_release") @db.VarChar(20)
  onboardingDismissedAt DateTime? @map("onboarding_dismissed_at")
```
Tạo migration theo Global Constraints. SQL mong đợi (đọc lại, không có DROP/RENAME):
```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_seen_release" VARCHAR(20),
ADD COLUMN     "onboarding_dismissed_at" TIMESTAMP(3);
```
Áp lên DB test bằng `migrate deploy`, rồi `pnpm exec prisma generate`.

- [ ] **Step 2: Test đỏ (unit)** — `tests/unit/lib/releases.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import {
  RELEASES, compareVersions, latestNotifyRelease, hasUnseenRelease, isKnownRelease, shortVersion, formatReleaseDate,
} from "@/lib/releases"

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string }

describe("releases (spec W §5.1)", () => {
  it("bản đầu danh sách = version package.json: nâng version phải thêm mục cập nhật", () => {
    expect(RELEASES[0].version).toBe(pkg.version)
  })

  it("sắp mới → cũ, không trùng version, ngày dạng YYYY-MM-DD, mỗi bản ≥ 1 mục", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0)
    }
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.items.length).toBeGreaterThan(0)
      expect(r.version.length).toBeLessThanOrEqual(20)
    }
  })

  it("compareVersions so theo số, không theo chữ", () => {
    expect(compareVersions("0.10.0", "0.9.5")).toBeGreaterThan(0)
    expect(compareVersions("0.9.5", "0.10.0")).toBeLessThan(0)
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0)
    expect(compareVersions("0.10", "0.10.0")).toBe(0)
  })

  it("hasUnseenRelease: null = chưa xem gì; đã xem bản notify mới nhất → false", () => {
    const latest = latestNotifyRelease()!
    expect(hasUnseenRelease(null)).toBe(true)
    expect(hasUnseenRelease(latest.version)).toBe(false)
    expect(hasUnseenRelease("0.0.1")).toBe(true)
    expect(hasUnseenRelease("99.0.0")).toBe(false)
  })

  it("isKnownRelease, shortVersion, formatReleaseDate", () => {
    expect(isKnownRelease(RELEASES[0].version)).toBe(true)
    expect(isKnownRelease("0.0.0-la")).toBe(false)
    expect(shortVersion("0.10.0")).toBe("v0.10")
    expect(formatReleaseDate("2026-10-05")).toBe("05/10/2026")
  })
})
```

- [ ] **Step 3: Test đỏ (integration)** — `tests/integration/release.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { RELEASES } from "@/lib/releases"
import { CONSENT_ACCEPTED } from "@/lib/consent"

const LATEST = RELEASES[0].version
const OLDER = RELEASES[RELEASES.length - 1].version

describe("release router (spec W §5.4)", () => {
  beforeEach(async () => {
    await db.user.update({ where: { username: "teacher" }, data: { lastSeenRelease: null } })
  })

  it("status trả lastSeenRelease của chính mình", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.release.status()).toEqual({ lastSeenRelease: null })
  })

  it("markSeen ghi version; không lùi khi gửi version cũ hơn", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.release.markSeen({ version: LATEST })).toEqual({ lastSeenRelease: LATEST })
    if (OLDER !== LATEST) {
      expect(await caller.release.markSeen({ version: OLDER })).toEqual({ lastSeenRelease: LATEST })
    }
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(u.lastSeenRelease).toBe(LATEST)
  })

  it("version lạ → BAD_REQUEST, không ghi", async () => {
    const caller = await getAuthedCaller("teacher")
    await expect(caller.release.markSeen({ version: "9.9.9" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(u.lastSeenRelease).toBeNull()
  })

  it("không đăng nhập → UNAUTHORIZED", async () => {
    await expect(publicCaller.release.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("đăng ký mới ghi lastSeenRelease = bản mới nhất (không tự mở ô)", async () => {
    await db.user.deleteMany({ where: { username: "gv_w_moi" } })
    await publicCaller.auth.register({ username: "gv_w_moi", password: "MatKhau123456", fullName: "", consent: CONSENT_ACCEPTED })
    const u = await db.user.findUniqueOrThrow({ where: { username: "gv_w_moi" } })
    expect(u.lastSeenRelease).toBe(LATEST)
    expect(u.onboardingDismissedAt).toBeNull()
    await db.consentRecord.deleteMany({ where: { userId: u.id } })
    await db.subject.deleteMany({ where: { userId: u.id } })
    await db.user.delete({ where: { id: u.id } })
  })
})
```
(Nếu `auth.register` cần `ip` từ ctx hoặc xoá user vướng FK khác, đọc `tests/integration/register.test.ts` và dọn theo cách file đó làm; ghi Ruling.)

- [ ] **Step 4: Chạy** `pnpm test tests/unit/lib/releases.test.ts tests/integration/release.test.ts` → Expected: FAIL (không có module `@/lib/releases`, không có router `release`).

- [ ] **Step 5: Cài đặt**

`src/lib/releases.ts`:
```ts
export type ReleaseKind = "new" | "improve" | "fix"
export type ReleaseItem = { kind: ReleaseKind; title: string; body: string; guideId?: string }
export type Release = {
  version: string
  date: string // YYYY-MM-DD
  title: string
  summary: string
  // true = có thay đổi người dùng thấy → ô "Có gì mới" tự mở; bản sửa nhỏ để false, chỉ hiện ở /updates.
  notify: boolean
  items: ReleaseItem[]
}

// Mới nhất đầu tiên. Mỗi lần nâng version (kể cả patch) phải thêm 1 mục (test releases.test.ts canh).
export const RELEASES: Release[] = [
  {
    version: "0.10.0",
    date: "2026-10-05",
    title: "Hướng dẫn sử dụng và thông báo bản mới",
    summary: "Có trang hướng dẫn đầy đủ, thẻ Bắt đầu cho người mới, và ô này để bạn biết mỗi bản có gì.",
    notify: true,
    items: [
      { kind: "new", title: "Hướng dẫn sử dụng", body: "Mở ở menu tài khoản (góc phải trên). Có nút Tải PDF để lưu hoặc gửi cho đồng nghiệp.", guideId: "bat-dau" },
      { kind: "new", title: "Thẻ Bắt đầu trên Tổng quan", body: "5 bước làm quen, tự đánh dấu khi bạn làm xong, có thể ẩn đi.", guideId: "bat-dau" },
      { kind: "new", title: "Có gì mới", body: "Mỗi bản có tính năng mới, ô này tự mở 1 lần. Bấm nút Có gì mới để xem lại." },
      { kind: "improve", title: "Dữ liệu cá nhân được mã hoá", body: "Họ tên, số điện thoại, số tài khoản trong cơ sở dữ liệu đã được mã hoá toàn bộ.", guideId: "bao-mat" },
    ],
  },
  {
    version: "0.9.5",
    date: "2026-10-03",
    title: "Đăng ký rõ ràng hơn",
    summary: "Tóm tắt chính sách bảo mật ngay khi đăng ký, thêm ô nhập lại mật khẩu.",
    notify: false,
    items: [
      { kind: "improve", title: "Tóm tắt chính sách bảo mật", body: "Trang Đăng ký hiện 4 ý chính trước khi bạn tick đồng ý.", guideId: "bao-mat" },
      { kind: "improve", title: "Nhập lại mật khẩu khi đăng ký", body: "Gõ mật khẩu 2 lần để tránh gõ nhầm.", guideId: "bat-dau" },
    ],
  },
]

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export function latestNotifyRelease(): Release | undefined {
  return RELEASES.find((r) => r.notify)
}

export function hasUnseenRelease(lastSeen: string | null): boolean {
  const latest = latestNotifyRelease()
  if (!latest) return false
  return lastSeen === null || compareVersions(latest.version, lastSeen) > 0
}

export function isKnownRelease(version: string): boolean {
  return RELEASES.some((r) => r.version === version)
}

export function shortVersion(version: string): string {
  return "v" + version.split(".").slice(0, 2).join(".")
}

export function formatReleaseDate(date: string): string {
  return date.split("-").reverse().join("/")
}
```
Ngày `date` của `0.10.0` / `0.9.5`: sửa thành ngày merge thật ở task cuối (Task 5 Step 5).

`src/server/services/release.service.ts`:
```ts
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "@prisma/client"
import { compareVersions, isKnownRelease } from "@/lib/releases"

export async function getReleaseStatus(db: PrismaClient, userId: number) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { lastSeenRelease: true } })
  return { lastSeenRelease: u.lastSeenRelease }
}

// Tab cũ chưa tải lại sau deploy có thể gửi bản cũ hơn → không lùi.
export async function markReleaseSeen(db: PrismaClient, userId: number, version: string) {
  if (!isKnownRelease(version)) throw new TRPCError({ code: "BAD_REQUEST", message: "Phiên bản không hợp lệ" })
  const { lastSeenRelease } = await getReleaseStatus(db, userId)
  if (lastSeenRelease && compareVersions(version, lastSeenRelease) <= 0) return { lastSeenRelease }
  await db.user.update({ where: { id: userId }, data: { lastSeenRelease: version } })
  return { lastSeenRelease: version }
}
```
(Kiểu `db`: dùng đúng kiểu các service khác trong repo đang dùng, vd `settings.service.ts`.)

`src/server/trpc/routers/release.ts`:
```ts
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { getReleaseStatus, markReleaseSeen } from "@/server/services/release.service"

export const releaseRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) => getReleaseStatus(ctx.db, ctx.userId)),
  markSeen: protectedProcedure
    .input(z.object({ version: z.string().min(1).max(20) }))
    .mutation(({ ctx, input }) => markReleaseSeen(ctx.db, ctx.userId, input.version)),
})
```
`src/server/trpc/root.ts`: import + thêm `release: releaseRouter,` vào `appRouter`.

`src/server/services/user.service.ts` (`registerUser`, trong `tx.user.create` `data`), thêm:
```ts
          // Tài khoản mới chưa dùng bản cũ → không tự mở "Có gì mới" (spec W §5.4).
          lastSeenRelease: RELEASES[0].version,
```
và `import { RELEASES } from "@/lib/releases"`.

- [ ] **Step 6: Seed test không bị ô/thẻ che** — `tests/setup.ts`: thêm `import { RELEASES } from "@/lib/releases"` và vào `data` của cả 4 `db.user.create` (teacher, teacher2, teacher_std, admin_test):
```ts
      // Không để ô "Có gì mới" / thẻ Bắt đầu che e2e cũ; e2e của W tự đặt lại null (spec W).
      lastSeenRelease: RELEASES[0].version,
      onboardingDismissedAt: new Date(),
```

- [ ] **Step 7: Version** — `package.json` → `"version": "0.10.0"`.

- [ ] **Step 8: Chạy** `pnpm test tests/unit/lib/releases.test.ts tests/integration/release.test.ts tests/integration/register.test.ts` → Expected: PASS.
`pnpm exec tsc --noEmit` + `pnpm lint` → sạch.

- [ ] **Step 9: Commit**
```bash
git add prisma/schema.prisma prisma/migrations src/lib/releases.ts src/server/services/release.service.ts src/server/trpc/routers/release.ts src/server/trpc/root.ts src/server/services/user.service.ts tests/setup.ts tests/unit/lib/releases.test.ts tests/integration/release.test.ts package.json
git commit -m "feat(w): dữ liệu bản cập nhật, cột last_seen_release/onboarding_dismissed_at, router release; v0.10.0"
```

---

### Task 2: Thẻ "Bắt đầu" trên Tổng quan

**Files:**
- Create: `src/server/services/onboarding.service.ts`, `src/server/trpc/routers/onboarding.ts`, `src/components/dashboard/StartCard.tsx`
- Modify: `src/server/trpc/root.ts`, `src/app/(app)/dashboard/page.tsx`, `src/language/vi.json`, `src/language/en.json`
- Test: `tests/integration/onboarding.test.ts` (mới), `tests/unit/components/StartCard.test.tsx` (mới)

**Interfaces:**
- Consumes: `User.onboardingDismissedAt` (Task 1).
- Produces: `onboarding.status` → `OnboardingStatus = { dismissed: boolean; steps: { student: boolean; session: boolean; attendance: boolean; payment: boolean; bank: boolean } }`; `onboarding.dismiss()` → `{ ok: true }`. Hằng `START_STEPS` trong `StartCard.tsx` dùng `guideId` của Task 3: `hoc-sinh`, `lich-day`, `diem-danh`, `hoc-phi`, `tai-khoan-ngan-hang` (Task 3 test canh các id này tồn tại).

- [ ] **Step 1: Test đỏ (integration)** — `tests/integration/onboarding.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { CONSENT_ACCEPTED } from "@/lib/consent"

async function clean() {
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.studentBillingChange.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ where: { username: { in: ["teacher", "teacher2"] } }, data: { onboardingDismissedAt: null, bankAccountNumber: null, bankBin: null, bankAccountName: null } })
}

const NONE = { student: false, session: false, attendance: false, payment: false, bank: false }

describe("onboarding (spec W §4)", () => {
  beforeEach(clean)

  it("chưa có gì → 5 bước false, chưa ẩn", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.onboarding.status()).toEqual({ dismissed: false, steps: NONE })
  })

  it("tick theo dữ liệu thật, không lẫn user khác", async () => {
    const caller = await getAuthedCaller("teacher")
    const other = await getAuthedCaller("teacher2")
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS W1", grade: 5, tuitionFee: 100_000 })
    const today = new Date().toISOString().slice(0, 10)
    const ses = await caller.session.create({ sessionDate: today, startTime: "08:00", endTime: "09:00", subjectId, studentIds: [st.id] })
    let s = await caller.onboarding.status()
    expect(s.steps).toMatchObject({ student: true, session: true, attendance: false, payment: false, bank: false })
    expect((await other.onboarding.status()).steps).toEqual(NONE)

    await db.sessionStudent.updateMany({ where: { sessionId: ses.id }, data: { attendance: "present" } })
    await db.user.update({ where: { username: "teacher" }, data: { bankAccountNumber: "0123456789" } })
    s = await caller.onboarding.status()
    expect(s.steps).toMatchObject({ attendance: true, bank: true })
  })

  it("HS và ca đã xoá mềm, điểm danh của ca đã xoá không tính", async () => {
    const caller = await getAuthedCaller("teacher")
    const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
    const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS W2", grade: 5, tuitionFee: 100_000 })
    const today = new Date().toISOString().slice(0, 10)
    const ses = await caller.session.create({ sessionDate: today, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [st.id] })
    await db.sessionStudent.updateMany({ where: { sessionId: ses.id }, data: { attendance: "present" } })
    await db.teachingSession.update({ where: { id: ses.id }, data: { isDeleted: true, deletedAt: new Date() } })
    await db.student.update({ where: { id: st.id }, data: { isDeleted: true, deletedAt: new Date() } })
    expect((await caller.onboarding.status()).steps).toEqual(NONE)
  })

  it("dismiss → dismissed true, chỉ ảnh hưởng chính mình", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.onboarding.dismiss()).toEqual({ ok: true })
    expect((await caller.onboarding.status()).dismissed).toBe(true)
    expect((await (await getAuthedCaller("teacher2")).onboarding.status()).dismissed).toBe(false)
  })
})
```
Bước `payment`: thêm 1 case dùng đúng API thu tiền mà `tests/integration/payment.test.ts` đang dùng (đọc file đó, chép cách tạo 1 lần thu cho HS của `teacher`) → `steps.payment` true; teacher2 vẫn false.

- [ ] **Step 2: Test đỏ (component)** — `tests/unit/components/StartCard.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const statusData = { current: undefined as unknown }
const dismissMutate = vi.fn()
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ onboarding: { status: { setData: vi.fn(), invalidate: vi.fn() } } }),
    onboarding: {
      status: { useQuery: () => ({ data: statusData.current }) },
      dismiss: { useMutation: () => ({ mutate: dismissMutate, isPending: false }) },
    },
  },
}))

import { StartCard } from "@/components/dashboard/StartCard"

const steps = (o: Partial<Record<"student" | "session" | "attendance" | "payment" | "bank", boolean>> = {}) => ({
  student: false, session: false, attendance: false, payment: false, bank: false, ...o,
})
const renderVi = () => render(<LanguageProvider forcedLanguage="vi"><StartCard /></LanguageProvider>)

describe("StartCard (spec W §4)", () => {
  beforeEach(() => dismissMutate.mockReset())

  it("đang tải → không render gì", () => {
    statusData.current = undefined
    const { container } = renderVi()
    expect(container.textContent).toBe("")
  })

  it("hiện 5 bước, tiến độ 2/5, bước xong có dấu xong", () => {
    statusData.current = { dismissed: false, steps: steps({ student: true, session: true }) }
    renderVi()
    expect(screen.getByText(viText.start_title)).toBeTruthy()
    expect(screen.getByText(viText.start_progress.replace("{n}", "2").replace("{total}", "5"))).toBeTruthy()
    expect(screen.getAllByTestId("start-step")).toHaveLength(5)
    expect(screen.getAllByTestId("start-step-done")).toHaveLength(2)
  })

  it("link hướng dẫn mở tab mới tới đúng mục", () => {
    statusData.current = { dismissed: false, steps: steps() }
    renderVi()
    const links = screen.getAllByRole("link", { name: viText.start_guide })
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/guide#hoc-sinh", "/guide#lich-day", "/guide#diem-danh", "/guide#hoc-phi", "/guide#tai-khoan-ngan-hang",
    ])
    expect(links.every((a) => a.getAttribute("target") === "_blank")).toBe(true)
  })

  it("đủ 5 bước hoặc đã ẩn → không render", () => {
    statusData.current = { dismissed: false, steps: steps({ student: true, session: true, attendance: true, payment: true, bank: true }) }
    expect(renderVi().container.textContent).toBe("")
    statusData.current = { dismissed: true, steps: steps() }
    expect(renderVi().container.textContent).toBe("")
  })

  it("bấm Ẩn → gọi dismiss", () => {
    statusData.current = { dismissed: false, steps: steps() }
    renderVi()
    fireEvent.click(screen.getByRole("button", { name: viText.start_dismiss }))
    expect(dismissMutate).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Chạy** `pnpm test tests/integration/onboarding.test.ts tests/unit/components/StartCard.test.tsx` → Expected: FAIL (không có router `onboarding`, không có `StartCard`).

- [ ] **Step 4: i18n** — `vi.json`:
```json
  "start_title": "Bắt đầu sử dụng",
  "start_progress": "Đã xong {n}/{total}",
  "start_step_student": "Thêm học sinh đầu tiên",
  "start_step_session": "Tạo ca dạy đầu tiên",
  "start_step_session_hint": "App đã tạo sẵn vài môn học, sửa ở mục Môn học.",
  "start_step_attendance": "Điểm danh 1 ca",
  "start_step_payment": "Ghi nhận học phí lần đầu",
  "start_step_bank": "Cài tài khoản nhận học phí",
  "start_step_bank_hint": "Cần để phiếu báo học phí có mã QR chuyển khoản.",
  "start_open": "Mở",
  "start_guide": "Xem hướng dẫn",
  "start_dismiss": "Ẩn thẻ Bắt đầu",
```
`en.json`:
```json
  "start_title": "Getting started",
  "start_progress": "{n}/{total} done",
  "start_step_student": "Add your first student",
  "start_step_session": "Create your first session",
  "start_step_session_hint": "Some subjects are created for you; edit them under Subjects.",
  "start_step_attendance": "Take attendance for a session",
  "start_step_payment": "Record your first tuition payment",
  "start_step_bank": "Set up your bank account",
  "start_step_bank_hint": "Needed for the QR code on tuition notices.",
  "start_open": "Open",
  "start_guide": "View guide",
  "start_dismiss": "Hide Getting started",
```

- [ ] **Step 5: Cài đặt**

`src/server/services/onboarding.service.ts`:
```ts
import type { PrismaClient } from "@prisma/client"

export type OnboardingStatus = {
  dismissed: boolean
  steps: { student: boolean; session: boolean; attendance: boolean; payment: boolean; bank: boolean }
}

export async function getOnboardingStatus(db: PrismaClient, userId: number): Promise<OnboardingStatus> {
  const [user, student, session, attendance, payment] = await Promise.all([
    // bankAccountNumber mã hoá → đọc ra rồi kiểm ở JS, không lọc DB.
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardingDismissedAt: true, bankAccountNumber: true } }),
    db.student.findFirst({ where: { userId }, select: { id: true } }),
    db.teachingSession.findFirst({ where: { userId }, select: { id: true } }),
    // Quan hệ lồng không được extension xoá mềm lọc → tự thêm isDeleted.
    db.sessionStudent.findFirst({
      where: { attendance: { not: "pending" }, session: { userId, isDeleted: false }, student: { isDeleted: false } },
      select: { id: true },
    }),
    db.payment.findFirst({ where: { monthlyTuition: { student: { userId } } }, select: { id: true } }),
  ])
  return {
    dismissed: user.onboardingDismissedAt !== null,
    steps: { student: !!student, session: !!session, attendance: !!attendance, payment: !!payment, bank: !!user.bankAccountNumber },
  }
}

export async function dismissOnboarding(db: PrismaClient, userId: number) {
  await db.user.update({ where: { id: userId }, data: { onboardingDismissedAt: new Date() } })
  return { ok: true as const }
}
```

`src/server/trpc/routers/onboarding.ts`:
```ts
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { dismissOnboarding, getOnboardingStatus } from "@/server/services/onboarding.service"

export const onboardingRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) => getOnboardingStatus(ctx.db, ctx.userId)),
  dismiss: protectedProcedure.mutation(({ ctx }) => dismissOnboarding(ctx.db, ctx.userId)),
})
```
`root.ts`: thêm `onboarding: onboardingRouter,`.

`src/components/dashboard/StartCard.tsx`:
```tsx
"use client"

import Link from "next/link"
import { CheckCircle2, Circle, ExternalLink, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type vi from "@/language/vi.json"

type StepKey = "student" | "session" | "attendance" | "payment" | "bank"

const START_STEPS: { key: StepKey; label: keyof typeof vi; hint?: keyof typeof vi; href: string; guideId: string }[] = [
  { key: "student", label: "start_step_student", href: "/students", guideId: "hoc-sinh" },
  { key: "session", label: "start_step_session", hint: "start_step_session_hint", href: "/calendar", guideId: "lich-day" },
  { key: "attendance", label: "start_step_attendance", href: "/calendar", guideId: "diem-danh" },
  { key: "payment", label: "start_step_payment", href: "/tuition", guideId: "hoc-phi" },
  { key: "bank", label: "start_step_bank", hint: "start_step_bank_hint", href: "/settings", guideId: "tai-khoan-ngan-hang" },
]

export function StartCard() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const { data } = trpc.onboarding.status.useQuery()
  const dismiss = trpc.onboarding.dismiss.useMutation({
    onSuccess: () => utils.onboarding.status.setData(undefined, (old) => (old ? { ...old, dismissed: true } : old)),
  })

  if (!data || data.dismissed) return null
  const done = START_STEPS.filter((s) => data.steps[s.key]).length
  if (done === START_STEPS.length) return null

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{t("start_title")}</p>
            <p className="text-sm text-slate-500">
              {t("start_progress").replace("{n}", String(done)).replace("{total}", String(START_STEPS.length))}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:size-10"
            aria-label={t("start_dismiss")}
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-primary" style={{ width: `${(done / START_STEPS.length) * 100}%` }} />
        </div>
        <ul className="divide-y">
          {START_STEPS.map((s) => {
            const ok = data.steps[s.key]
            return (
              <li key={s.key} data-testid="start-step" className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                {ok ? (
                  <CheckCircle2 data-testid="start-step-done" className="size-5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-slate-300" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className={ok ? "text-sm text-slate-400 line-through" : "text-sm font-medium text-slate-900"}>{t(s.label)}</p>
                  {s.hint && !ok && <p className="text-xs text-slate-500">{t(s.hint)}</p>}
                </div>
                <a
                  href={`/guide#${s.guideId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 text-xs text-primary underline underline-offset-2"
                >
                  {t("start_guide")}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
                {!ok && (
                  <Button asChild variant="outline" size="sm" className="h-11 md:h-9">
                    <Link href={s.href}>{t("start_open")}</Link>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
```
Ghi chú: nút "Mở" là link nhưng tên accessible "Mở" — test Step 2 lọc link theo tên "Xem hướng dẫn" nên không lẫn.

`src/app/(app)/dashboard/page.tsx`: import `StartCard`, chèn `<StartCard />` ngay dưới `<PageHeader … />`. (Spec ghi "trên DashboardAlerts"; đặt dưới tiêu đề để người mới thấy đầu tiên, vẫn ở trên DashboardAlerts.)

- [ ] **Step 6: Chạy lại** Step 3 + `pnpm test tests/integration/dashboard-alerts.test.ts` → Expected: PASS.
`tsc` + `lint` sạch.

- [ ] **Step 7: Commit**
```bash
git add src/server/services/onboarding.service.ts src/server/trpc/routers/onboarding.ts src/server/trpc/root.ts src/components/dashboard/StartCard.tsx "src/app/(app)/dashboard/page.tsx" src/language/vi.json src/language/en.json tests/integration/onboarding.test.ts tests/unit/components/StartCard.test.tsx
git commit -m "feat(w): thẻ Bắt đầu 5 bước trên Tổng quan, tự tick theo dữ liệu, ẩn được"
```

---

### Task 3: Trang hướng dẫn `/guide`

**Files:**
- Create: `src/lib/guide-content.ts`, `src/components/guide/GuideContent.tsx`, `src/components/common/PrintButton.tsx`, `src/app/guide/page.tsx`
- Modify: `src/middleware.ts` (matcher), `src/components/layout/AppHeader.tsx` (mục menu), `src/app/login/LoginForm.tsx` (link), `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/lib/guide-content.test.ts` (mới), `tests/unit/components/GuideContent.test.tsx` (mới), `tests/unit/middleware-matcher.test.ts` (sửa)

**Interfaces:**
- Consumes: `RELEASES` (Task 1) để kiểm `guideId`; id bước của `StartCard` (Task 2).
- Produces: `type GuideSection = { id: string; title: string; intro?: string; steps: string[]; tips?: string[] }`, `GUIDE_SECTIONS: GuideSection[]`, `GUIDE_IDS: ReadonlySet<string>`; `PrintButton({ label }: { label: string })`. i18n: `guide_title`, `guide_toc`, `guide_menu`, `print_pdf`, `guide_back_login`.

- [ ] **Step 1: Test đỏ** — `tests/unit/lib/guide-content.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { GUIDE_SECTIONS, GUIDE_IDS } from "@/lib/guide-content"
import { RELEASES } from "@/lib/releases"

const EXPECTED_IDS = [
  "bat-dau", "mon-hoc", "hoc-sinh", "nhap-excel", "lich-day", "diem-danh", "hoc-phi",
  "bao-cao", "tai-khoan-ngan-hang", "goi-dich-vu", "thung-rac", "sao-luu", "bao-mat",
]

describe("guide-content (spec W §3.1)", () => {
  it("đủ 13 mục đúng thứ tự, id không trùng, mỗi mục ≥ 2 bước", () => {
    expect(GUIDE_SECTIONS.map((s) => s.id)).toEqual(EXPECTED_IDS)
    expect(GUIDE_IDS.size).toBe(GUIDE_SECTIONS.length)
    for (const s of GUIDE_SECTIONS) expect(s.steps.length, s.id).toBeGreaterThanOrEqual(2)
  })

  it("mọi guideId trong bản cập nhật và thẻ Bắt đầu đều có mục tương ứng", () => {
    const fromReleases = RELEASES.flatMap((r) => r.items.map((i) => i.guideId)).filter(Boolean) as string[]
    const fromStart = ["hoc-sinh", "lich-day", "diem-danh", "hoc-phi", "tai-khoan-ngan-hang"]
    for (const id of [...fromReleases, ...fromStart]) expect(GUIDE_IDS.has(id), id).toBe(true)
  })

  it("không có gạch dài, không có chỗ trống chưa viết", () => {
    const text = JSON.stringify(GUIDE_SECTIONS)
    expect(text).not.toMatch(/[—–]/)
    expect(text).not.toMatch(/TODO|TBD|\.\.\./)
  })
})
```

`tests/unit/components/GuideContent.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { GuideContent } from "@/components/guide/GuideContent"
import { GUIDE_SECTIONS } from "@/lib/guide-content"

describe("GuideContent (spec W §3.2)", () => {
  it("h1, mục lục link tới từng anchor, mỗi mục 1 section có id, nút Tải PDF ẩn khi in", () => {
    const { container } = render(<LanguageProvider forcedLanguage="vi"><GuideContent /></LanguageProvider>)
    expect(screen.getByRole("heading", { level: 1, name: viText.guide_title })).toBeTruthy()
    const toc = screen.getByRole("navigation", { name: viText.guide_toc })
    expect(toc.querySelectorAll("a").length).toBe(GUIDE_SECTIONS.length)
    for (const s of GUIDE_SECTIONS) {
      expect(container.querySelector(`section#${s.id}`)).not.toBeNull()
      expect(toc.querySelector(`a[href="#${s.id}"]`)).not.toBeNull()
    }
    const print = screen.getByRole("button", { name: viText.print_pdf })
    expect(print.className).toContain("print:hidden")
    expect(toc.className).toContain("print:hidden")
  })
})
```

`tests/unit/middleware-matcher.test.ts`: thêm
```ts
  it("/guide và /updates là route công khai (spec W)", () => {
    expect(needsAuth("/guide")).toBe(false)
    expect(needsAuth("/updates")).toBe(false)
  })
```

- [ ] **Step 2: Chạy** `pnpm test tests/unit/lib/guide-content.test.ts tests/unit/components/GuideContent.test.tsx tests/unit/middleware-matcher.test.ts` → Expected: FAIL.

- [ ] **Step 3: i18n** — `vi.json`:
```json
  "guide_title": "Hướng dẫn sử dụng",
  "guide_toc": "Mục lục",
  "guide_menu": "Hướng dẫn sử dụng",
  "print_pdf": "Tải PDF",
  "guide_back_login": "Về trang đăng nhập",
```
`en.json`:
```json
  "guide_title": "User guide",
  "guide_toc": "Contents",
  "guide_menu": "User guide",
  "print_pdf": "Download PDF",
  "guide_back_login": "Back to login",
```

- [ ] **Step 4: Nội dung** — `src/lib/guide-content.ts`. **Trước khi chép, mở từng màn tương ứng trong code (`src/app/(app)/*`, component, `vi.json`) và sửa tên nút/menu in đậm cho khớp đúng giao diện hiện tại**; chỗ nào nội dung dưới đây sai so với code (vd nút tên khác, tính năng không có), sửa theo code và ghi `Ruling:` trong báo cáo. Tên nút đặt trong `**…**` (component in đậm).

```ts
export type GuideSection = { id: string; title: string; intro?: string; steps: string[]; tips?: string[] }

// Nguồn duy nhất cho /guide (và bản PDF in từ trang này). Chỉ tiếng Việt (spec W §3.1).
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "bat-dau",
    title: "Bắt đầu",
    intro: "Mỗi giáo viên dùng 1 tài khoản riêng, chỉ bạn xem được dữ liệu của mình.",
    steps: [
      "Mở trang **Đăng ký**, nhập tên đăng nhập (chữ, số, dấu gạch dưới), mật khẩu ít nhất 10 ký tự và **Nhập lại mật khẩu**.",
      "Đọc khung tóm tắt chính sách bảo mật, tick ô đồng ý rồi bấm **Đăng ký**.",
      "Đăng nhập. Tick **Ghi nhớ đăng nhập** nếu dùng máy riêng để không phải đăng nhập lại mỗi ngày.",
      "Trên **Tổng quan** có thẻ **Bắt đầu sử dụng** gồm 5 bước. Làm lần lượt, bước xong tự được đánh dấu.",
      "Đổi mật khẩu: bấm vào avatar góc phải trên, chọn **Đổi mật khẩu**.",
    ],
    tips: ["Không nên dùng số điện thoại làm tên đăng nhập.", "Tài khoản mới được dùng thử gói Pro miễn phí một thời gian."],
  },
  {
    id: "mon-hoc",
    title: "Môn học",
    intro: "App đã tạo sẵn vài môn khi bạn đăng ký.",
    steps: [
      "Mở **Môn học** (trên điện thoại: tab **Thêm** rồi **Môn học**).",
      "Bấm **Thêm môn** để thêm môn mới, chọn màu để dễ nhìn trên lịch.",
      "Tắt các môn không dạy để danh sách chọn môn gọn hơn.",
      "Đặt 1 môn làm mặc định để khi tạo ca app chọn sẵn môn đó.",
    ],
  },
  {
    id: "hoc-sinh",
    title: "Học sinh",
    steps: [
      "Mở **Học sinh**, bấm **Thêm học sinh**.",
      "Nhập họ tên, lớp, tên và số điện thoại phụ huynh (không bắt buộc).",
      "Chọn **Cách thu học phí**: **Theo buổi** (nhập học phí mỗi buổi) hoặc **Trọn tháng** (nhập học phí cả tháng, không phụ thuộc số buổi).",
      "Tick ô đồng ý lưu dữ liệu rồi bấm **Thêm**.",
      "Học sinh nghỉ hẳn: mở học sinh, tắt **Đang học**. Học sinh vẫn còn trong lịch sử và học phí cũ.",
    ],
    tips: [
      "Đổi cách thu hoặc mức học phí chỉ áp dụng từ tháng bạn chọn, các tháng trước giữ nguyên.",
      "Số học sinh đang học tối đa phụ thuộc gói của bạn.",
    ],
  },
  {
    id: "nhap-excel",
    title: "Nhập học sinh từ Excel",
    steps: [
      "Ở **Học sinh**, bấm **Nhập Excel** rồi **Tải file mẫu**.",
      "Điền mỗi học sinh 1 dòng theo đúng cột trong file mẫu, lưu lại.",
      "Chọn file đã điền. App hiện bảng xem trước, dòng lỗi được tô đỏ kèm lý do.",
      "Sửa dòng lỗi trong file rồi chọn lại, hoặc bỏ qua dòng lỗi. Tick ô đồng ý và bấm nhập.",
    ],
  },
  {
    id: "lich-day",
    title: "Lịch dạy",
    steps: [
      "Mở **Lịch dạy**, bấm **+ Thêm ca dạy mới**.",
      "Chọn ngày, giờ bắt đầu, giờ kết thúc, môn và các học sinh trong ca.",
      "Muốn ca lặp hằng tuần: chọn **Lặp lại vào các thứ** và khoảng ngày.",
      "Bấm vào ca để xem chi tiết, sửa, chuyển sang ngày giờ khác, huỷ ca (ghi lý do) hoặc tạo **Ca bù**.",
      "Cuối tháng dùng **Chép lịch tháng** để chép lịch sang tháng sau.",
    ],
    tips: ["App báo khi ca mới trùng giờ với ca đã có."],
  },
  {
    id: "diem-danh",
    title: "Điểm danh",
    steps: [
      "Mở ca cần điểm danh trên **Lịch dạy**.",
      "Chọn trạng thái cho từng học sinh: có mặt, vắng có phép hoặc vắng không phép.",
      "Bấm **Lưu**. Học phí theo buổi được tính theo điểm danh này.",
      "Dùng nút mũi tên để sang ca trước / ca sau trong tháng mà không cần quay lại lịch.",
    ],
  },
  {
    id: "hoc-phi",
    title: "Học phí",
    steps: [
      "Mở **Học phí**, chọn tháng. Mỗi học sinh có số buổi, học phí, nợ tháng trước và số đã thu.",
      "Bấm vào học sinh để xem chi tiết, bấm **Ghi nhận** để ghi 1 lần thu (tiền mặt hoặc chuyển khoản).",
      "Bấm **Phiếu báo** để tạo phiếu học phí có mã QR, rồi lưu ảnh hoặc chia sẻ cho phụ huynh.",
      "Gửi xong, bấm **Đánh dấu đã gửi** để lọc được học sinh chưa gửi phiếu. Số tiền đổi sau khi gửi sẽ có nhãn báo.",
      "**Link phụ huynh**: phụ huynh mở link là xem được học phí, điểm danh và lịch học của con, không cần đăng nhập.",
    ],
    tips: ["Không chia sẻ công khai link phụ huynh."],
  },
  {
    id: "bao-cao",
    title: "Báo cáo tháng",
    steps: [
      "Mở **Báo cáo** (gói có tính năng báo cáo tháng).",
      "Chọn tháng để xem doanh thu, số đã thu, còn nợ và điểm danh.",
      "Học sinh đã xoá vẫn được tính trong số liệu các tháng cũ.",
    ],
  },
  {
    id: "tai-khoan-ngan-hang",
    title: "Tài khoản nhận học phí",
    steps: [
      "Mở **Cài đặt**, phần **Tài khoản nhận học phí**.",
      "Gõ tên để tìm ngân hàng, nhập số tài khoản và tên chủ tài khoản.",
      "Tick ô đồng ý rồi bấm **Lưu**. Phiếu báo học phí sẽ có mã QR chuyển khoản đúng số tiền.",
    ],
  },
  {
    id: "goi-dich-vu",
    title: "Gói dịch vụ",
    steps: [
      "Mở **Gói của tôi** để xem gói đang dùng, hạn dùng và tính năng của từng gói Standard, Plus, Pro.",
      "Bấm mua hoặc gia hạn, chọn thời hạn. App hiện mã đơn và số tiền cần chuyển khoản.",
      "Chuyển khoản đúng nội dung mã đơn. Gói được kích hoạt sau khi quản trị viên xác nhận.",
    ],
    tips: ["Gia hạn sớm trước khi hết hạn được tặng thêm tháng."],
  },
  {
    id: "thung-rac",
    title: "Thùng rác",
    steps: [
      "Học sinh, môn, ca dạy, lần thu đã xoá đều vào **Thùng rác**.",
      "Mở **Thùng rác**, chọn loại, bấm **Khôi phục** để lấy lại.",
      "Khôi phục ca hoặc lần thu cần học sinh và môn của nó còn tồn tại.",
    ],
  },
  {
    id: "sao-luu",
    title: "Sao lưu Excel",
    steps: [
      "Bấm avatar góc phải trên, chọn **Sao lưu dữ liệu**.",
      "Đọc cảnh báo: file sao lưu không mã hoá, chỉ lưu ở nơi an toàn.",
      "Bấm **Tôi hiểu, tải xuống** để tải file Excel chứa toàn bộ dữ liệu của bạn.",
    ],
  },
  {
    id: "bao-mat",
    title: "Bảo mật dữ liệu",
    steps: [
      "Họ tên, số điện thoại, ghi chú, số tài khoản được mã hoá trong cơ sở dữ liệu.",
      "Chỉ bạn xem được dữ liệu của mình. Quản trị viên chỉ thấy thông tin gói.",
      "Đọc đầy đủ ở trang **Chính sách bảo mật** (link ở trang đăng nhập).",
    ],
    tips: ["Chỉ nhập dữ liệu học sinh khi phụ huynh đã cho phép."],
  },
]

export const GUIDE_IDS: ReadonlySet<string> = new Set(GUIDE_SECTIONS.map((s) => s.id))
```

- [ ] **Step 5: Component + trang**

`src/components/common/PrintButton.tsx`:
```tsx
"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

// "Tải PDF" = hộp in của trình duyệt (chọn Lưu dưới dạng PDF), không cần thư viện PDF (spec W §3.2).
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" className="h-11 gap-2 md:h-10 print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  )
}
```

`src/components/guide/GuideContent.tsx`:
```tsx
"use client"

import Link from "next/link"
import { Fragment } from "react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PrintButton } from "@/components/common/PrintButton"
import { GUIDE_SECTIONS } from "@/lib/guide-content"

// "**Nút**" → <strong>; nội dung tĩnh trong code nên không cần thư viện markdown.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-900">{part}</strong> : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  )
}

export function GuideContent() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-slate-700 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t("guide_title")}</h1>
        <PrintButton label={t("print_pdf")} />
      </div>

      <nav aria-label={t("guide_toc")} className="rounded-lg border bg-slate-50 p-4 print:hidden">
        <p className="mb-2 font-semibold text-slate-900">{t("guide_toc")}</p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {GUIDE_SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-11 items-center text-primary hover:underline md:min-h-8">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {GUIDE_SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} className="scroll-mt-4 space-y-3 break-inside-avoid">
          <h2 className="text-lg font-semibold text-slate-900">{i + 1}. {s.title}</h2>
          {s.intro && <p className="leading-relaxed"><Rich text={s.intro} /></p>}
          <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
            {s.steps.map((step, j) => <li key={j} className="break-inside-avoid"><Rich text={step} /></li>)}
          </ol>
          {s.tips && (
            <ul className="space-y-1 rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm">
              {s.tips.map((tip, j) => <li key={j}><Rich text={tip} /></li>)}
            </ul>
          )}
        </section>
      ))}

      <div className="flex flex-wrap gap-4 border-t pt-4 print:hidden">
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-sm text-primary underline">{t("privacy_title")}</Link>
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-primary underline">{t("guide_back_login")}</Link>
      </div>
    </main>
  )
}
```

`src/app/guide/page.tsx`:
```tsx
import type { Metadata } from "next"
import { GuideContent } from "@/components/guide/GuideContent"

export const metadata: Metadata = { title: "Hướng dẫn sử dụng" }

// Công khai để gửi link cho giáo viên khác; không đọc query (luật next15-contract).
export default function GuidePage() {
  return <GuideContent />
}
```

`src/middleware.ts` matcher: thêm `guide|updates` sau `privacy`:
`"/((?!login|register|privacy|guide|updates|p/|api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)"`.
(Trang `/updates` làm ở Task 4; mở trước trong matcher để 1 lần sửa.)

`src/components/layout/AppHeader.tsx`: trong `DropdownMenuContent`, ngay trước `<ChangePasswordDialog …>`, thêm (cho cả teacher lẫn admin):
```tsx
            <DropdownMenuItem asChild>
              <a href="/guide" target="_blank" rel="noopener noreferrer">
                <BookOpen className="size-4 mr-2" />
                {t("guide_menu")}
              </a>
            </DropdownMenuItem>
```
(import `BookOpen` từ `lucide-react`.)

`src/app/login/LoginForm.tsx`: khối cuối chứa link `/privacy` đổi thành 2 link cạnh nhau:
```tsx
      <div className="flex justify-center gap-4">
        <Link href="/guide" className="mt-2 inline-flex min-h-11 items-center text-xs text-slate-500 hover:underline">
          {t("guide_menu")}
        </Link>
        <Link href="/privacy" className="mt-2 inline-flex min-h-11 items-center text-xs text-slate-500 hover:underline">
          {t("privacy_title")}
        </Link>
      </div>
```

- [ ] **Step 6: Chạy lại** Step 2 + `pnpm test tests/unit/next15-contract.test.ts tests/unit/theme-legacy-colors.test.ts` → Expected: PASS.
Nếu có test LoginForm / AppHeader sẵn có đỏ do thêm link/mục menu, sửa test cho khớp và ghi Ruling.
`tsc` + `lint` sạch.

- [ ] **Step 7: Commit**
```bash
git add src/lib/guide-content.ts src/components/guide/GuideContent.tsx src/components/common/PrintButton.tsx src/app/guide/page.tsx src/middleware.ts src/components/layout/AppHeader.tsx src/app/login/LoginForm.tsx src/language/vi.json src/language/en.json tests/unit/lib/guide-content.test.ts tests/unit/components/GuideContent.test.tsx tests/unit/middleware-matcher.test.ts
git commit -m "feat(w): trang hướng dẫn /guide 13 mục, in ra PDF, link ở menu tài khoản và trang đăng nhập"
```

---

### Task 4: Nút + ô "Có gì mới" và trang `/updates`

**Files:**
- Create: `src/components/whats-new/WhatsNewPanel.tsx`, `src/components/whats-new/WhatsNew.tsx`, `src/components/whats-new/UpdatesContent.tsx`, `src/app/updates/page.tsx`
- Modify: `src/components/layout/AppHeader.tsx`, `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/WhatsNew.test.tsx` (mới), `tests/unit/components/UpdatesContent.test.tsx` (mới)

**Interfaces:**
- Consumes: `RELEASES`, `latestNotifyRelease`, `hasUnseenRelease`, `shortVersion`, `formatReleaseDate`, `type Release` (Task 1); tRPC `release.status`, `release.markSeen` (Task 1); `PrintButton` (Task 3).
- Produces: `WhatsNewPanel({ release, onClose }: { release: Release; onClose: () => void })`, `WhatsNew()` (không prop; chỉ đặt ở biến thể teacher), `UpdatesContent()`. i18n: `whatsnew_button`, `whatsnew_label`, `whatsnew_more`, `whatsnew_learn_more`, `whatsnew_close`, `whatsnew_kind_new`, `whatsnew_kind_improve`, `whatsnew_kind_fix`, `updates_title`, `updates_guide_link`.

- [ ] **Step 1: i18n** — `vi.json`:
```json
  "whatsnew_button": "Có gì mới",
  "whatsnew_label": "CÓ GÌ MỚI",
  "whatsnew_more": "và {n} thay đổi khác",
  "whatsnew_learn_more": "Tìm hiểu thêm",
  "whatsnew_close": "Đóng",
  "whatsnew_kind_new": "MỚI",
  "whatsnew_kind_improve": "CẢI TIẾN",
  "whatsnew_kind_fix": "SỬA LỖI",
  "updates_title": "Các bản cập nhật",
  "updates_guide_link": "Xem hướng dẫn",
```
`en.json`:
```json
  "whatsnew_button": "What's new",
  "whatsnew_label": "WHAT'S NEW",
  "whatsnew_more": "and {n} more changes",
  "whatsnew_learn_more": "Learn more",
  "whatsnew_close": "Close",
  "whatsnew_kind_new": "NEW",
  "whatsnew_kind_improve": "IMPROVED",
  "whatsnew_kind_fix": "FIX",
  "updates_title": "Release notes",
  "updates_guide_link": "View guide",
```

- [ ] **Step 2: Test đỏ** — `tests/unit/components/WhatsNew.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { latestNotifyRelease, type Release } from "@/lib/releases"

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

const status = { current: undefined as { lastSeenRelease: string | null } | undefined }
const markSeen = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ release: { status: { setData: vi.fn() } } }),
    release: {
      status: { useQuery: () => ({ data: status.current }) },
      markSeen: { useMutation: () => ({ mutate: markSeen }) },
    },
  },
}))

import { WhatsNew } from "@/components/whats-new/WhatsNew"
import { WhatsNewPanel } from "@/components/whats-new/WhatsNewPanel"

const LATEST = latestNotifyRelease()!
const renderVi = (ui: React.ReactElement) => render(<LanguageProvider forcedLanguage="vi">{ui}</LanguageProvider>)

beforeEach(() => {
  markSeen.mockReset()
  toastError.mockReset()
  // Desktop: Popover.
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("WhatsNew (spec W §5.2–5.4)", () => {
  it("chưa xem → có chấm báo và ô tự mở với tiêu đề bản mới nhất", async () => {
    status.current = { lastSeenRelease: null }
    renderVi(<WhatsNew />)
    expect(screen.getByTestId("whatsnew-dot")).toBeTruthy()
    expect(await screen.findByText(LATEST.title)).toBeTruthy()
  })

  it("đóng ô → markSeen đúng version bản notify mới nhất, không toast", async () => {
    status.current = { lastSeenRelease: null }
    renderVi(<WhatsNew />)
    await screen.findByText(LATEST.title)
    fireEvent.click(screen.getByRole("button", { name: viText.whatsnew_close }))
    await waitFor(() => expect(screen.queryByText(LATEST.title)).toBeNull())
    expect(markSeen).toHaveBeenCalledWith({ version: LATEST.version })
    expect(toastError).not.toHaveBeenCalled()
  })

  it("đã xem → không chấm, không tự mở; bấm nút vẫn mở được, đóng không gọi markSeen", async () => {
    status.current = { lastSeenRelease: LATEST.version }
    renderVi(<WhatsNew />)
    expect(screen.queryByTestId("whatsnew-dot")).toBeNull()
    expect(screen.queryByText(LATEST.title)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: new RegExp(viText.whatsnew_button) }))
    expect(await screen.findByText(LATEST.title)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: viText.whatsnew_close }))
    await waitFor(() => expect(screen.queryByText(LATEST.title)).toBeNull())
    expect(markSeen).not.toHaveBeenCalled()
  })

  it("đang tải status → không tự mở", () => {
    status.current = undefined
    renderVi(<WhatsNew />)
    expect(screen.queryByText(LATEST.title)).toBeNull()
  })
})

describe("WhatsNewPanel (spec W §5.3)", () => {
  const many: Release = {
    version: "9.0.0", date: "2026-12-01", title: "Bản thử", summary: "Tóm tắt", notify: true,
    items: Array.from({ length: 7 }, (_, i) => ({ kind: "new" as const, title: `Mục ${i + 1}`, body: "Mô tả" })),
  }

  it("tối đa 5 mục + 'và 2 thay đổi khác'; ngày dd/MM/yyyy; Tìm hiểu thêm mở /updates#v9.0.0 tab mới", () => {
    renderVi(<WhatsNewPanel release={many} onClose={() => {}} />)
    expect(screen.getAllByTestId("whatsnew-item")).toHaveLength(5)
    expect(screen.getByText(viText.whatsnew_more.replace("{n}", "2"))).toBeTruthy()
    expect(screen.getByText("01/12/2026")).toBeTruthy()
    const more = screen.getByRole("link", { name: new RegExp(viText.whatsnew_learn_more) })
    expect(more.getAttribute("href")).toBe("/updates#v9.0.0")
    expect(more.getAttribute("target")).toBe("_blank")
  })

  it("nhãn loại theo kind", () => {
    renderVi(<WhatsNewPanel release={{ ...many, items: [
      { kind: "new", title: "A", body: "a" }, { kind: "improve", title: "B", body: "b" }, { kind: "fix", title: "C", body: "c" },
    ] }} onClose={() => {}} />)
    expect(screen.getByText(viText.whatsnew_kind_new)).toBeTruthy()
    expect(screen.getByText(viText.whatsnew_kind_improve)).toBeTruthy()
    expect(screen.getByText(viText.whatsnew_kind_fix)).toBeTruthy()
  })
})
```

`tests/unit/components/UpdatesContent.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { UpdatesContent } from "@/components/whats-new/UpdatesContent"
import { RELEASES } from "@/lib/releases"

describe("UpdatesContent (spec W §5.5)", () => {
  it("mỗi bản 1 khối id=v<version>, đủ mục, link hướng dẫn cho mục có guideId, nút Tải PDF", () => {
    const { container } = render(<LanguageProvider forcedLanguage="vi"><UpdatesContent /></LanguageProvider>)
    expect(screen.getByRole("heading", { level: 1, name: viText.updates_title })).toBeTruthy()
    for (const r of RELEASES) {
      const block = container.querySelector(`[id="v${r.version}"]`)
      expect(block, r.version).not.toBeNull()
      expect(block!.querySelectorAll("li").length).toBe(r.items.length)
    }
    const guided = RELEASES.flatMap((r) => r.items).filter((i) => i.guideId).length
    expect(screen.getAllByRole("link", { name: viText.updates_guide_link })).toHaveLength(guided)
    expect(screen.getByRole("button", { name: viText.print_pdf })).toBeTruthy()
  })
})
```

- [ ] **Step 3: Chạy** `pnpm test tests/unit/components/WhatsNew.test.tsx tests/unit/components/UpdatesContent.test.tsx` → Expected: FAIL (không có module).

- [ ] **Step 4: Cài đặt**

`src/components/whats-new/WhatsNewPanel.tsx`:
```tsx
"use client"

import { ArrowUpCircle, ExternalLink, Sparkles, Wrench, X, type LucideIcon } from "lucide-react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { formatReleaseDate, type Release, type ReleaseKind } from "@/lib/releases"
import type vi from "@/language/vi.json"

const MAX_ITEMS = 5

const KIND: Record<ReleaseKind, { icon: LucideIcon; label: keyof typeof vi; box: string; badge: string }> = {
  new: { icon: Sparkles, label: "whatsnew_kind_new", box: "bg-primary/10 text-primary", badge: "bg-primary/10 text-primary" },
  improve: { icon: ArrowUpCircle, label: "whatsnew_kind_improve", box: "bg-amber-50 text-amber-600", badge: "bg-amber-50 text-amber-700" },
  fix: { icon: Wrench, label: "whatsnew_kind_fix", box: "bg-slate-100 text-slate-600", badge: "bg-slate-100 text-slate-600" },
}

// Bố cục theo mẫu người dùng gửi (iOne), màu theo app (spec W §5.3).
export function WhatsNewPanel({ release, onClose }: { release: Release; onClose: () => void }) {
  const { t } = useTranslation()
  const shown = release.items.slice(0, MAX_ITEMS)
  const rest = release.items.length - shown.length
  return (
    <div className="overflow-hidden rounded-xl bg-white">
      <div className="relative bg-gradient-to-br from-primary to-teal-900 p-5 pr-12 text-white">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold tracking-wide">{t("whatsnew_label")}</span>
          <span className="text-white/80">{formatReleaseDate(release.date)}</span>
        </div>
        <p className="mt-2 text-lg font-semibold">{release.title}</p>
        <p className="mt-1 text-sm text-white/85">{release.summary}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("whatsnew_close")}
          className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-white/90 hover:bg-white/15 md:size-9"
        >
          <X className="size-5" />
        </button>
      </div>
      <ul className="max-h-[50vh] space-y-4 overflow-y-auto p-5">
        {shown.map((item, i) => {
          const k = KIND[item.kind]
          const Icon = k.icon
          return (
            <li key={i} data-testid="whatsnew-item" className="flex gap-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${k.box}`}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                  {item.title}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${k.badge}`}>{t(k.label)}</span>
                </p>
                <p className="text-sm text-slate-600">{item.body}</p>
              </div>
            </li>
          )
        })}
        {rest > 0 && <li className="text-sm text-slate-500">{t("whatsnew_more").replace("{n}", String(rest))}</li>}
      </ul>
      <div className="flex justify-end border-t p-4">
        <a
          href={`/updates#v${release.version}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 md:h-10"
        >
          {t("whatsnew_learn_more")}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
    </div>
  )
}
```

`src/components/whats-new/WhatsNew.tsx`:
```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { trpc } from "@/lib/trpc"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { hasUnseenRelease, latestNotifyRelease, shortVersion } from "@/lib/releases"
import { WhatsNewPanel } from "./WhatsNewPanel"

export function WhatsNew() {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const utils = trpc.useUtils()
  const { data } = trpc.release.status.useQuery()
  // Lỗi mạng: lần tải sau ô mở lại, không làm phiền bằng toast (spec W §5.4).
  const markSeen = trpc.release.markSeen.useMutation()
  const [open, setOpen] = useState(false)
  const autoOpened = useRef(false)
  const latest = latestNotifyRelease()
  const unseen = data !== undefined && hasUnseenRelease(data.lastSeenRelease)

  useEffect(() => {
    if (unseen && !autoOpened.current) {
      autoOpened.current = true
      setOpen(true)
    }
  }, [unseen])

  if (!latest) return null

  function change(next: boolean) {
    setOpen(next)
    if (next || !unseen || !latest) return
    utils.release.status.setData(undefined, { lastSeenRelease: latest.version })
    markSeen.mutate({ version: latest.version })
  }

  const trigger = (
    <Button variant="outline" className="relative h-11 gap-2 px-3 text-slate-700 md:h-10" aria-label={t("whatsnew_button")}>
      <Sparkles className="size-5 text-primary" aria-hidden />
      <span className="hidden md:inline">{t("whatsnew_button")}</span>
      <span className="hidden rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary md:inline">{shortVersion(latest.version)}</span>
      {unseen && <span data-testid="whatsnew-dot" className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-white" />}
    </Button>
  )
  const panel = <WhatsNewPanel release={latest} onClose={() => change(false)} />

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={change}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" className="w-[420px] max-w-[calc(100vw-2rem)] p-0">{panel}</PopoverContent>
      </Popover>
    )
  }
  return (
    <>
      <span onClick={() => change(true)}>{trigger}</span>
      <Sheet open={open} onOpenChange={change}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">{t("whatsnew_button")}</SheetTitle>
          {panel}
        </SheetContent>
      </Sheet>
    </>
  )
}
```
Ghi chú cài đặt:
- `[&>button]:hidden` ẩn nút X mặc định của `SheetContent` (panel đã có X). Đọc `src/components/ui/sheet.tsx` để chắc nút đóng là `button` con trực tiếp; nếu khác, ẩn theo cách component cho phép, ghi Ruling.
- Bọc trigger mobile bằng `span onClick` để không lồng `Button` trong `SheetTrigger`; nếu lint a11y báo, đổi sang `SheetTrigger asChild` với trigger trực tiếp và ghi Ruling.

`src/components/layout/AppHeader.tsx`: import `WhatsNew`; trong `<div className="flex shrink-0 items-center gap-2">`, ngay sau `{!admin && <RenewOffer />}`, thêm `{!admin && <WhatsNew />}`.

`src/components/whats-new/UpdatesContent.tsx`:
```tsx
"use client"

import Link from "next/link"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PrintButton } from "@/components/common/PrintButton"
import { RELEASES, formatReleaseDate } from "@/lib/releases"
import type vi from "@/language/vi.json"

const KIND_LABEL: Record<"new" | "improve" | "fix", keyof typeof vi> = {
  new: "whatsnew_kind_new",
  improve: "whatsnew_kind_improve",
  fix: "whatsnew_kind_fix",
}

export function UpdatesContent() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-slate-700 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t("updates_title")}</h1>
        <PrintButton label={t("print_pdf")} />
      </div>
      {RELEASES.map((r) => (
        <section key={r.version} id={`v${r.version}`} className="scroll-mt-4 space-y-3 border-t pt-6 break-inside-avoid">
          <p className="text-sm text-slate-500">v{r.version} · {formatReleaseDate(r.date)}</p>
          <h2 className="text-lg font-semibold text-slate-900">{r.title}</h2>
          <p>{r.summary}</p>
          <ul className="space-y-3">
            {r.items.map((item, i) => (
              <li key={i} className="break-inside-avoid">
                <p className="font-semibold text-slate-900">
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{t(KIND_LABEL[item.kind])}</span>
                  {item.title}
                </p>
                <p className="text-sm">{item.body}</p>
                {item.guideId && (
                  <a href={`/guide#${item.guideId}`} className="inline-flex min-h-11 items-center text-sm text-primary underline print:hidden md:min-h-8">
                    {t("updates_guide_link")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link href="/guide" className="inline-flex min-h-11 items-center text-sm text-primary underline print:hidden">{t("guide_title")}</Link>
    </main>
  )
}
```

`src/app/updates/page.tsx`:
```tsx
import type { Metadata } from "next"
import { UpdatesContent } from "@/components/whats-new/UpdatesContent"

export const metadata: Metadata = { title: "Các bản cập nhật" }

// Công khai như /guide; không đọc query (luật next15-contract).
export default function UpdatesPage() {
  return <UpdatesContent />
}
```

- [ ] **Step 5: Chạy lại** Step 3 + `pnpm test tests/unit/theme-legacy-colors.test.ts tests/unit/next15-contract.test.ts tests/unit/layout` → Expected: PASS. Test `AppHeader` sẵn có (nếu có) đỏ vì thiếu mock `release.status` → thêm mock `release: { status: { useQuery: () => ({ data: { lastSeenRelease: "<bản mới nhất>" } }) }, markSeen: { useMutation: () => ({ mutate: vi.fn() }) } }` và `useUtils` trả `release.status.setData`, ghi Ruling.
`tsc` + `lint` sạch.

- [ ] **Step 6: Commit**
```bash
git add src/components/whats-new src/app/updates/page.tsx src/components/layout/AppHeader.tsx src/language/vi.json src/language/en.json tests/unit/components/WhatsNew.test.tsx tests/unit/components/UpdatesContent.test.tsx
git commit -m "feat(w): nút và ô Có gì mới tự mở 1 lần mỗi bản, trang /updates"
```

---

### Task 5: e2e + luật nâng version + kiểm toàn bộ

**Files:**
- Create: `tests/e2e/w-huong-dan-co-gi-moi.spec.ts`
- Modify: `docs/05-deploy.md`
- Test: e2e mới + toàn bộ

**Interfaces:**
- Consumes: mọi thứ Task 1–4.

- [ ] **Step 1: e2e** — `tests/e2e/w-huong-dan-co-gi-moi.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { RELEASES } from '../../src/lib/releases';

// Kiểm endpoint test như tests/e2e/admin.spec.ts trước khi ghi DB bằng Prisma.
const db = new PrismaClient();
const LATEST = RELEASES[0].version;
const LATEST_NOTIFY = RELEASES.find((r) => r.notify)!;

test.beforeAll(async () => {
  // Chép đúng khối kiểm DATABASE_URL (EXPECTED_TEST_ENDPOINT) của tests/e2e/admin.spec.ts vào đây.
  await db.user.update({ where: { username: 'teacher_std' }, data: { lastSeenRelease: null, onboardingDismissedAt: null } });
});

test.afterAll(async () => {
  await db.user.update({ where: { username: 'teacher_std' }, data: { lastSeenRelease: LATEST, onboardingDismissedAt: new Date() } });
  await db.$disconnect();
});

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Spec W', () => {
  test('/guide và /updates mở được khi chưa đăng nhập', async ({ page }) => {
    await page.goto('/guide');
    await expect(page.getByRole('heading', { level: 1, name: 'Hướng dẫn sử dụng' })).toBeVisible();
    await expect(page.locator('section#hoc-sinh')).toBeVisible();
    await page.goto('/updates');
    await expect(page.getByRole('heading', { level: 1, name: 'Các bản cập nhật' })).toBeVisible();
    await expect(page.locator(`[id="v${LATEST}"]`)).toBeVisible();
  });

  test('chưa xem bản mới: ô tự mở 1 lần, đóng xong tải lại không mở; thẻ Bắt đầu hiện', async ({ page }) => {
    await login(page, 'teacher_std');
    await expect(page.getByText(LATEST_NOTIFY.title)).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();
    await expect(page.getByText(LATEST_NOTIFY.title)).toBeHidden();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeVisible();
    await expect(page.getByText(LATEST_NOTIFY.title)).toBeHidden();
    const u = await db.user.findUniqueOrThrow({ where: { username: 'teacher_std' } });
    expect(u.lastSeenRelease).toBe(LATEST_NOTIFY.version);
  });

  test('bấm Ẩn thẻ Bắt đầu → mất hẳn sau khi tải lại', async ({ page }) => {
    await login(page, 'teacher_std');
    await page.getByRole('button', { name: 'Ẩn thẻ Bắt đầu' }).click();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeHidden();
    await page.reload();
    await expect(page.getByText('Bắt đầu sử dụng')).toBeHidden();
  });

  test('Tìm hiểu thêm mở /updates ở tab mới', async ({ page, context }) => {
    await login(page, 'teacher');
    await page.getByRole('button', { name: /Có gì mới/ }).click();
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: /Tìm hiểu thêm/ }).click(),
    ]);
    await expect(tab).toHaveURL(new RegExp(`/updates#v${LATEST_NOTIFY.version.replace(/\./g, '\\.')}$`));
  });
});
```
(Test 2 chạy trước test 3 trong file — giữ thứ tự, `fullyParallel` của repo nếu bật thì thêm `test.describe.configure({ mode: 'serial' })` và ghi Ruling.)

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed) rồi `pnpm exec playwright test tests/e2e/w-huong-dan-co-gi-moi.spec.ts` → Expected: PASS (4 test).

- [ ] **Step 2: Luật nâng version** — thêm vào `docs/05-deploy.md` (trước mục khoá mã hoá):

```markdown
## Mỗi lần nâng version

1. Sửa `package.json` `version` (phần lớn → minor, sửa nhỏ → patch).
2. Thêm 1 mục **đầu** `RELEASES` trong `src/lib/releases.ts`: `version` trùng `package.json`, `date` = ngày deploy, `title`, `summary`, `items` (mỗi mục 1–2 câu, viết cho giáo viên đọc, không thuật ngữ kỹ thuật; gắn `guideId` nếu có mục hướng dẫn liên quan).
3. `notify: true` khi giáo viên thấy được thay đổi (tính năng mới, đổi cách dùng); `false` cho sửa lỗi nhỏ. Bản `notify: true` sẽ tự mở ô "Có gì mới" 1 lần cho mọi giáo viên.
4. Tính năng mới đổi cách dùng → sửa mục tương ứng trong `src/lib/guide-content.ts`.
5. `tests/unit/lib/releases.test.ts` đỏ nếu quên bước 2.
```

- [ ] **Step 3: Toàn bộ**
Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test` → Expected: sạch, PASS toàn bộ.
e2e đầy đủ 2 nửa theo LENH.md → Expected: PASS (ghi số test). Có e2e cũ đỏ vì ô "Có gì mới" hoặc thẻ Bắt đầu che → kiểm tài khoản đó có trong `tests/setup.ts` Step 6 Task 1 chưa; tài khoản tạo trong e2e qua đăng ký thì đã có `lastSeenRelease` (thẻ Bắt đầu có thể hiện — sửa locator của test cũ cho cụ thể hơn, ghi Ruling; không tắt tính năng).

- [ ] **Step 4: Commit**
```bash
git add tests/e2e/w-huong-dan-co-gi-moi.spec.ts docs/05-deploy.md
git commit -m "test(w): e2e hướng dẫn, Có gì mới, thẻ Bắt đầu; luật thêm mục cập nhật khi nâng version"
```

- [ ] **Step 5: Ngày phát hành** — Claude (không phải Gehihi) sửa `date` của `0.10.0` (và `0.9.5` nếu khác) trong `src/lib/releases.ts` thành ngày merge thật ngay trước khi merge.

Báo cáo cho Claude: số test unit/e2e, mọi `Ruling:`, chỗ nội dung hướng dẫn đã sửa so với plan (Task 3 Step 4).
