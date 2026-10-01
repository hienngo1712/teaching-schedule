# U — Dọn lỗi nhỏ còn tồn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 31 lỗi nhỏ còn tồn (U1–U31) trong sổ theo dõi B → V, không thêm tính năng, không migration.

**Architecture:** Mỗi task gom các lỗi cùng khu vực code. Mỗi lỗi có 1 test RED → GREEN. Không đổi schema DB.

**Tech Stack:** Next.js 15, tRPC v11, React Query v5, Prisma 5.22, Vitest + Testing Library, Playwright, sonner.

**Spec:** `docs/superpowers/specs/2026-10-01-u-don-loi-nho-design.md`

## Global Constraints

- Nhánh `fix/u-don-loi-nho` từ `main` (spec/plan đã trên main). Version cuối `0.9.3` (patch).
- **Không migration, không sửa `prisma/schema.prisma`.**
- An toàn DB: chỉ `.env.test` (localhost:5433). Cấm `db:reset` / `migrate reset` / `db push` trên `.env`. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.
- Không `pnpm build` / `pnpm dev`. e2e: kiểm RAM ≥ 3000 MB, chạy foreground chia 2 nửa, dọn tiến trình sau mỗi lần chạy (LENH.md mục 2026-10-01).
- Commit Gehihi: 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + `pnpm exec tsc --noEmit` + `pnpm lint` sạch → commit → ledger `.superpowers/sdd/2026-10-01-u-don-loi-nho/progress.md`.
- Chuỗi giao diện mới: thêm đủ `src/language/vi.json` + `en.json` (cùng bộ key).

## Review Focus

1. U3: đóng phiếu báo ngay sau Chia sẻ → toast Hoàn tác vẫn hiện, bấm Hoàn tác thì bỏ dấu thật. Pin: Task 1 test.
2. U7: HS chuyển trọn tháng từ tháng này → ca tháng trước vẫn cho sửa phí/buổi, ca tháng này hiện "Trọn tháng". Pin: Task 2 test.
3. U13: khoá giới hạn gói không gây deadlock với nhập Excel / tạo đơn (cùng khoá `userId`, mỗi transaction chỉ khoá 1 lần). Pin: Task 3 test race + chạy lại `student-import.test.ts`, `plan-orders.test.ts`.
4. U12: HS **theo buổi** với `monthlyFee` 0/undefined vẫn lưu được; chỉ chặn trọn tháng 0đ. Pin: Task 2 test.
5. U19: thẻ ca không đổi chiều cao / không tràn khi render 2 chuỗi. Pin: Task 5 test + e2e `layout-desktop` hồi quy.

---

### Task 1: Phiếu báo (U1–U5)

**Files:** `src/components/tuition/TuitionDetailSheet.tsx`, `src/components/tuition/TuitionNoticeDialog.tsx`, `src/hooks/useFilters.ts`, test mock liên quan.
**Test:** `tests/unit/components/TuitionDetailSheetNoticeMark.test.tsx`, `tests/unit/components/TuitionNoticeDialog.test.tsx`, `tests/unit/hooks/useFilters.test.ts` (tạo nếu chưa có).

- [ ] **Step 1: Tests (RED)**
  1. U1: sheet, mutation `setNoticeSent` lỗi → `toast.error` được gọi **đúng 1 lần**.
  2. U4: `row.noticeStatus = "changed"` → hiện chữ "Đã gửi · số tiền đã đổi" (`data-testid="notice-changed-hint"`); `"sent"` → không hiện.
  3. U3: phiếu báo, bấm "Lưu ảnh"/"Tải ảnh" rồi **unmount dialog trước khi mutation resolve** → sau khi resolve vẫn gọi `toast(…notice_marked…, { action })`; gọi `action.onClick()` → client gọi `setNoticeSent` với `sent: false`.
  4. U5: `useFilters().filterParams` **không có** khoá `noticeFilter`.
  5. U2: các test cũ của sheet/dialog mock `trpc.useUtils` + `trpc.tuition.setNoticeSent.useMutation` đầy đủ (không dựa vào `?.`).
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt**
  - U2: bỏ mọi `trpc.useUtils?.()` và `trpc.tuition.setNoticeSent?.useMutation ? … : {…}` ở 2 file → gọi thẳng `trpc.useUtils()` / `trpc.tuition.setNoticeSent.useMutation(...)`. Sửa mock trong các test cũ cho đủ.
  - U1: trong sheet, nút đánh dấu gọi `setNoticeSentMut.mutate({ studentId, year, month, sent })` **không** truyền `onSuccess/onError` riêng; hook giữ `onSuccess: invalidate`, `onError: toast.error`.
  - U3: trong dialog, chuyển toàn bộ xử lý vào option của hook (React Query v5 vẫn chạy callback cấp `useMutation` khi component đã unmount; callback của `mutate()` thì không):
    ```ts
    const utils = trpc.useUtils()
    // Callback cấp hook vẫn chạy khi dialog đã đóng → không mất toast Hoàn tác.
    const setNoticeSentMutation = trpc.tuition.setNoticeSent.useMutation({
      onSuccess: (_res, vars) => {
        void utils.tuition.getMonthlyStatus.invalidate()
        if (!vars.sent) return
        toast(t("notice_marked"), {
          action: {
            label: t("undo"),
            onClick: () => {
              void utils.client.tuition.setNoticeSent
                .mutate({ ...vars, sent: false })
                .then(() => utils.tuition.getMonthlyStatus.invalidate())
            },
          },
        })
      },
      onError: () => toast.error(t("generic_error")),
    })
    const markNoticeSent = () => setNoticeSentMutation.mutate({ studentId, year, month, sent: true })
    ```
  - U4: trong khối phiếu báo của sheet, dưới `<span>` ngày gửi:
    ```tsx
    {row.noticeStatus === "changed" && (
      <span data-testid="notice-changed-hint" className="mt-0.5 block text-xs font-medium text-amber-700">
        {t("notice_changed")}
      </span>
    )}
    ```
  - U5: xoá dòng `noticeFilter: selectedNoticeFilter || undefined,` và `selectedNoticeFilter` khỏi deps của `filterParams` trong `useFilters.ts` (trang Học phí đã tự truyền `noticeFilter` ở `tuition/page.tsx:83`).
- [ ] **Step 3:** tests PASS; `pnpm test tests/unit/components/Tuition*` PASS.
- [ ] **Step 4: Commit** `fix(u): phiếu báo toast 1 lần, giữ Hoàn tác khi đóng, sheet hiện số tiền đã đổi`

### Task 2: Học phí theo tháng (U6–U12)

**Files:** `src/server/services/backup.service.ts`, `src/server/services/attendance.service.ts`, `src/server/services/session.service.ts`, `src/components/tuition/TuitionDetailSheet.tsx`, `src/components/students/ImportStudentsDialog.tsx`, `src/components/reports/ExportExcelButton.tsx`, `src/hooks/useExcelExport.ts`, `src/components/students/StudentFormDialog.tsx`, `src/lib/schemas/student.ts`, `src/server/services/student.service.ts`, `src/language/*.json`.
**Test:** `tests/integration/tuition-monthly.test.ts`, `tests/integration/backup.test.ts` (hoặc file sao lưu hiện có), `tests/unit/components/StudentFormDialog.test.tsx`, `tests/unit/components/ImportStudentsDialog.test.tsx`, `tests/unit/components/TuitionDetailSheet*.test.tsx`, `tests/unit/hooks/useExcelExport.test.ts` (nếu chưa có thì test ở `ExportExcelButton`).

**Interfaces — Produces:**
```ts
// student.ts (schema)
export const studentFormSchema = studentCreateSchema.refine(
  (v) => v.billingMode !== "monthly" || (v.monthlyFee ?? 0) > 0,
  { path: ["monthlyFee"], message: "Học phí tháng phải lớn hơn 0" }
)
// useExcelExport tuitionInfo thêm: billingMode: "per_session" | "monthly"; monthlyFee: number
```

- [ ] **Step 1: Tests (RED)**
  1. U6: HS A (có lịch sử cách thu) bị xoá mềm → dữ liệu sheet "Lịch sử cách thu" của sao lưu không có dòng của A.
  2. U7: HS theo buổi có ca tháng trước; đổi sang trọn tháng ở tháng hiện tại (`student.update`) → `attendance.get` ca tháng trước trả `billingMode "per_session"`, ca tháng này trả `"monthly"`; `session.getDetail` cũng vậy.
  3. U8: sheet với `row.billingMode = "monthly"`, `presentSessions 1`, `totalSessions 2` → hiện "Học phí tháng (trọn gói) · Đã học 1/2 buổi"; theo buổi giữ nhãn cũ.
  4. U9: xem trước nhập 1 dòng "Cách thu = tháng", "Học phí = 400000" → dòng xem trước có "400.000" và "/tháng", không có "0 ₫".
  5. U10: `exportStudentSchedule` với `tuitionInfo.billingMode = "monthly"`, `monthlyFee 400000` → ô A6 = "Học phí tháng (trọn gói)", D6 = "400.000 ₫" (theo `formatCurrency`).
  6. U11: form sửa HS đang học, đang trọn tháng 400k → đổi ô Học phí/tháng thành 500k → hiện ghi chú "Áp dụng từ tháng…".
  7. U12: form chọn Trọn tháng, để trống/0 → submit báo "Học phí tháng phải lớn hơn 0", không gọi mutation. Server: `student.create({ billingMode: "monthly", monthlyFee: 0 })` → BAD_REQUEST; `student.update` chuyển sang monthly với 0 → BAD_REQUEST; HS theo buổi `monthlyFee` bỏ trống → tạo được.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt**
  - U6: `backup.service.ts` truy vấn `studentBillingChange`: `where: { student: { userId, isDeleted: false } }`.
  - U7: trong `getAttendance` (attendance.service) và chỗ dựng `students` của `getSessionDetail` (session.service):
    ```ts
    // Cách thu theo tháng của ca, không theo hiện tại (ca tháng trước của HS vừa đổi cách thu).
    const key = monthKey(session.sessionDate.getUTCFullYear(), session.sessionDate.getUTCMonth() + 1)
    const changes = await loadBillingChanges(db, links.map((l) => l.studentId))
    // ... billingMode: resolveBilling(changes.get(ss.studentId) ?? [], key).mode
    ```
    (`sessionDate` là cột `@db.Date` → giờ UTC 00:00 đúng ngày VN.) Lưu ý HS chưa có dòng lịch sử nào → `PER_SESSION`, khớp `resolveBilling`.
  - U8: sheet, dòng `current_month_fee`: nếu `row.billingMode === "monthly"` dùng key mới `tuition_monthly_package_line` = vi `"Học phí tháng (trọn gói) · Đã học {p}/{n} buổi"`, en `"Monthly fee (package) · Attended {p}/{n} sessions"`.
  - U9: `ImportStudentsDialog.tsx`:
    ```ts
    const isMonthly = row.input.billingMode === "monthly"
    const fee = isMonthly ? row.input.monthlyFee ?? NaN : row.input.tuitionFee
    // details: Number.isNaN(fee) ? null : `${formatCurrency(fee)}${isMonthly ? t("per_month") : ""}`
    ```
  - U10: `ExportExcelButton` truyền thêm `billingMode: studentTuition.billingMode`, `monthlyFee: studentTuition.monthlyFee`; `useExcelExport` ô A6/D6: monthly → `"Học phí tháng (trọn gói)"` / `formatCurrency(tuitionInfo.monthlyFee)`, theo buổi giữ nguyên.
  - U11: `StudentFormDialog`:
    ```ts
    const curMonthlyFee = form.watch("monthlyFee")
    const isBillingModeChanged =
      mode === "edit" && Boolean(student?.isActive) && Boolean(student?.billingMode) &&
      (curBillingMode !== student?.billingMode ||
        (curBillingMode === "monthly" && (curMonthlyFee ?? 0) !== student?.monthlyFee))
    ```
  - U12: thêm `studentFormSchema` (Interfaces) và đổi `zodResolver(studentCreateSchema)` → `zodResolver(studentFormSchema)` trong form. Server: trong `createStudent` sau khi tính `monthlyFee`, và trong `updateStudent` sau khi tính `nextMonthlyFee`:
    ```ts
    if (mode === "monthly" && monthlyFee <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Học phí tháng phải lớn hơn 0" })
    ```
    (update dùng `nextMode` / `nextMonthlyFee`.)
- [ ] **Step 3:** tests PASS; `pnpm test tests/integration/tuition-monthly.test.ts tests/integration/student*.test.ts` PASS.
- [ ] **Step 4: Commit** `fix(u): học phí trọn tháng đúng ở điểm danh, sao lưu, nhập/xuất Excel, form`

### Task 3: Thùng rác và giới hạn gói (U13–U17)

**Files:** `src/server/services/student.service.ts`, `src/server/services/trash.service.ts`, `src/server/services/subject.service.ts`, `src/components/students/DeleteStudentDialog.tsx`, `src/server/services/user-admin.service.ts`.
**Test:** `tests/integration/student-limit-race.test.ts` (mới), `tests/integration/trash.test.ts` (hoặc file thùng rác hiện có), `tests/integration/subject*.test.ts`, `tests/unit/components/DeleteStudentDialog.test.tsx`.

**Interfaces — Produces:**
```ts
// student.service.ts
// Khoá theo user (cùng khoá với nhập Excel / tạo đơn) rồi mới đếm: 2 thao tác cùng lúc không vượt giới hạn gói.
export async function lockAndAssertCanActivate(tx: Prisma.TransactionClient, userId: number, n: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(userId)})`
  await assertCanActivateStudents(tx, userId, n)
}
```

- [ ] **Step 1: Tests (RED)**
  1. U13: user gói Standard còn đúng 1 chỗ → 2 `createStudent` (isActive) chạy đồng thời (barrier như `student-import.test.ts` “2 importMany đồng thời”, chặn ở `student.count`) → đúng 1 thành công, 1 lỗi giới hạn gói, số HS đang học = giới hạn. Tương tự: 1 `createStudent` + 1 `undeleteStudent` (HS đang học trong Thùng rác) đồng thời.
  2. U14: xoá môn trong khi 1 ca dùng môn đó được tạo đồng thời (barrier ở `teachingSession.count`) → không có ca nào trỏ tới môn đã xoá (hoặc xoá bị từ chối).
  3. U15: dọn vĩnh viễn môn (đã có ca trong Thùng rác) → khôi phục ca → lỗi CONFLICT chứa "đã bị dọn vĩnh viễn"; tương tự lần thu của HS đã dọn.
  4. U16: `DeleteStudentDialog` gọi `student.deleteCheck.useQuery` với option `staleTime: 0`.
  5. U17: `adminRestoreUser` → `console.info` chứa username.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt**
  - U13: thêm `lockAndAssertCanActivate`. `createStudent`: bỏ `assertCanActivateStudents(db…)` ở đầu, gọi `if (input.isActive) await lockAndAssertCanActivate(tx, userId, 1)` **đầu** `$transaction` đang có. `updateStudent`: chuyển kiểm `data.isActive === true && !existing.isActive` vào đầu transaction của nó (nếu nhánh đó không có transaction thì bọc `db.$transaction`). `undeleteStudent`: bọc `findFirst` + kiểm + `update` trong `db.$transaction(async (tx) => …, TX_OPTIONS)` với `lockAndAssertCanActivate`. `importStudents` giữ nguyên (đã khoá) — có thể đổi sang gọi helper, **không khoá 2 lần**.
  - U14: `softDeleteSubject`: bọc từ `findUnique` tới `update` trong `db.$transaction(async (tx) => { await tx.$executeRaw\`SELECT pg_advisory_xact_lock(${BigInt(userId)})\`; … }, TX_OPTIONS)`. `createSession` / `updateSession` không cần khoá thêm nếu test U14 xanh bằng cách đọc lại `subject.isDeleted` trong transaction tạo ca; nếu không, tạo ca kiểm `subject` còn sống ngay trước `create` trong cùng transaction — ghi Ruling.
  - U15: `undeleteSession` select thêm `subject.purgedAt`; `undeletePayment` select thêm `student.purgedAt`. Có `purgedAt` → `conflict("Môn {name} đã bị dọn vĩnh viễn nên không khôi phục được ca này.")` / `conflict("Học sinh này đã bị dọn vĩnh viễn nên không khôi phục được lần thu.")` (kiểm **trước** nhánh "đang ở Thùng rác").
  - U16: `trpc.student.deleteCheck.useQuery({ id: student.id }, { staleTime: 0 })`.
  - U17: `adminRestoreUser` đọc `username` (đã có user trong hàm hoặc select thêm) → `console.info(\`[admin] ${admin} khôi phục tài khoản ${user.username} (user ${userId})\`)`.
- [ ] **Step 3:** tests PASS; chạy lại `tests/integration/student-import.test.ts`, `tests/integration/plan-orders.test.ts`, `tests/integration/trash*.test.ts` PASS (không deadlock).
- [ ] **Step 4: Commit** `fix(u): khoá giới hạn gói khi thêm/bật/khôi phục HS, xoá môn an toàn, báo đúng khi đã dọn`

### Task 4: Đăng ký ghi consent cùng transaction (U18)

**Files:** `src/server/services/user.service.ts`, `src/server/trpc/routers/auth.ts`.
**Test:** `tests/integration/auth*.test.ts` hoặc `consent*.test.ts` hiện có.

**Interfaces — Produces:**
```ts
export async function registerUser(db: PrismaClient, input: RegisterInput, consent: { ipAddress: string | null }): Promise<{ id: number; username: string; fullName: string | null }>
```

- [ ] **Step 1: Test (RED)** — làm `consentRecord.create` ném lỗi (`db.$extends` ghi đè `consentRecord.create` như mẫu barrier) → `registerUser` ném lỗi **và** không còn user với username đó; gọi lại với db thường → tạo được (không báo trùng tên). Chạy → FAIL.
- [ ] **Step 2: Cài đặt** — trong `registerUser`, `user.create` + `consentRecord.create` (`scope "register"`, `textVersion: CONSENT_TEXT_VERSION`, `ipAddress: consent.ipAddress?.slice(0, 45) ?? null`) cùng `db.$transaction(async (tx) => …)`; giữ nguyên nhánh P2002 → "Tên đăng nhập đã tồn tại"; `seedSubjectsForUser` để sau transaction như cũ. Router `register` bỏ `recordConsent(...)` riêng, truyền `{ ipAddress: ctx.ip }`. Sửa các chỗ gọi `registerUser` khác (test helper/seed) cho đúng chữ ký.
- [ ] **Step 3:** test PASS; `pnpm test tests/integration/auth*.test.ts tests/integration/consent*.test.ts` PASS.
- [ ] **Step 4: Commit** `fix(u): đăng ký tạo tài khoản và ghi đồng ý trong cùng transaction`

### Task 5: Lịch và cài đặt (U19–U22)

**Files:** `src/components/calendar/SessionCard.tsx`, `src/components/calendar/SessionListItem.tsx`, `src/components/settings/BankSelect.tsx`, `src/components/sessions/SessionNavBar.tsx`.
**Test:** `tests/unit/components/SessionCard.test.tsx`, `tests/unit/components/SessionListItem.test.tsx` (mới), `tests/unit/components/BankSelect.test.tsx`, `tests/unit/components/SessionNavBar.test.tsx`.

- [ ] **Step 1: Tests (RED)**
  1. U19: `SessionCard` không import/gọi `useMediaQuery` (mock `useMediaQuery` để throw nếu bị gọi); DOM có chuỗi rút gọn trong phần tử class `md:hidden` và chuỗi đầy đủ trong `hidden md:inline` (vd grades [5] → "L5" và "Lớp 5").
  2. U20: `SessionListItem` dòng meta có class `flex-wrap`.
  3. U21: `BankSelect` mở → ô tìm có `aria-controls` = id của `listbox`; mũi tên xuống → `aria-activedescendant` = id của option đang active; mỗi option có `id`.
  4. U22: `SessionNavBar` với `current` không nằm trong `siblings` → không hiện chữ vị trí ("Ca …/…"), 2 nút đều disabled.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt**
  - U19: bỏ `useMediaQuery`; dựng 2 chuỗi meta:
    ```tsx
    const metaOf = (short: boolean) =>
      [label, formatGrades(session.grades ?? [], t("grade"), short), session.studentCount > 0 ? `${session.studentCount} ${t("student_abbrev")}` : ""]
        .filter(Boolean).join(" · ")
    // Ẩn/hiện bằng CSS thay vì useMediaQuery: không nháy L5 → Lớp 5 lúc tải, không gắn listener mỗi thẻ.
    <div className={cn("truncate text-slate-700", isCancelled && "line-through")}>
      <span className="md:hidden">{metaOf(true)}</span>
      <span className="hidden md:inline">{metaOf(false)}</span>
    </div>
    ```
  - U20: dòng meta `flex items-center gap-3` → `flex flex-wrap items-center gap-x-3 gap-y-1`.
  - U21: `const listId = useId()`; `<ul id={listId} role="listbox">`; option `id={\`${listId}-${idx}\`}`; `<Input role="combobox" aria-expanded={open} aria-controls={listId} aria-activedescendant={filteredBanks[activeIndex] ? \`${listId}-${activeIndex}\` : undefined} …>`.
  - U22: chỉ render `<span>` vị trí khi `currentIndex >= 0` (giữ 1 `<span aria-hidden />` trống để 2 nút không lệch vị trí).
- [ ] **Step 3:** tests PASS; `pnpm test tests/unit/components/Session* tests/unit/components/BankSelect.test.tsx` PASS.
- [ ] **Step 4: Commit** `fix(u): thẻ ca không nháy nhãn lớp, meta xuống dòng, aria ô ngân hàng, vị trí ca khi rời danh sách`

### Task 6: Admin và popup mua gói (U23–U28)

**Files:** `src/server/services/admin-stats.service.ts`, `src/lib/admin-stats.ts`, `src/components/admin/AccountTrend.tsx`, `src/components/admin/AdminRevenue.tsx`, `src/server/services/plan.service.ts`, `src/components/plan/PlanPurchaseDialog.tsx`.
**Test:** `tests/integration/admin-stats*.test.ts`, `tests/unit/lib/admin-stats.test.ts`, `tests/unit/components/AccountTrend.test.tsx`, `tests/unit/components/AdminRevenue.test.tsx`, `tests/integration/plan-orders.test.ts`, `tests/unit/components/PlanPurchaseDialog.test.tsx`.

- [ ] **Step 1: Tests (RED)**
  1. U23: spy `countNewAccounts` → `getAdminStats` gọi **1 lần**.
  2. U24: `AccountTrend` ngôn ngữ `en`, `avgPerDay 1234.5` → hiện theo `en-US` ("1,234.5"); `vi` → "1.234,5".
  3. U25: `AdminRevenue` thẻ tổng/từng loại có class `min-w-0`, số có `break-words` (hoặc `[overflow-wrap:anywhere]`).
  4. U26: `computeAccountCards` user `isActive false` có `lastActiveAt` trong 24h → `active24h` không tính; integration `getAdminStats` user bị khoá có `user_activity_days` trong 7 ngày → `active7d` không tính.
  5. U27: `plan.createOrder` trả `amount` = giá hiện hành; popup nhánh `purchase-load-error` hiện số tiền (`formatCurrency(amount)`).
  6. U28: `meQuery` có `failureCount 1`, `isFetching true` (đang retry) → hiện `purchase-load-error`, không hiện Skeleton.
  Chạy → FAIL.
- [ ] **Step 2: Cài đặt**
  - U23: bỏ `countNewAccounts(db)` khỏi `Promise.all` của `getAdminStats`, dùng `pending.newAccounts`; bỏ import thừa.
  - U24: `const { t, language } = useTranslation()` → `toLocaleString(language === "en" ? "en-US" : "vi-VN")`.
  - U25: thẻ thêm `min-w-0`; số `text-lg md:text-xl font-bold break-words` (thẻ tổng) và `text-base md:text-lg … break-words` (thẻ loại).
  - U26: `computeAccountCards`: dời dòng đếm `active24h` xuống **sau** `if (!u.isActive) continue`. SQL `active7` thêm `AND u.is_active = true`.
  - U27: `createOrder` trả `{ id, code, bonusMonths, amount }`; popup `setCreated({ id, code, amount })`, nhánh dự phòng thêm dòng `{t("plan_order_amount")}: {formatCurrency(created.amount)}` (key mới: vi "Số tiền", en "Amount").
  - U28: điều kiện Skeleton: `meQuery.isFetching && meQuery.failureCount === 0`.
- [ ] **Step 3:** tests PASS; `pnpm test tests/unit/components/Admin* tests/unit/components/AccountTrend.test.tsx tests/unit/components/PlanPurchaseDialog.test.tsx tests/integration/plan-orders.test.ts` PASS.
- [ ] **Step 4: Commit** `fix(u): thống kê admin bỏ TK khoá, số không tràn, popup mua gói hiện số tiền khi lỗi tải`

### Task 7: Vệ sinh test (U29–U31)

**Files:** `tests/e2e/helpers/db-cleanup.ts` (mới), `tests/e2e/tuition-notice.spec.ts`, `tests/e2e/v-da-gui-phieu.spec.ts` (nếu cũng dọn theo tên), `tests/e2e/trash.spec.ts`, `tests/integration/report-purged-student.test.ts` (mới).

**Interfaces — Produces:**
```ts
// tests/e2e/helpers/db-cleanup.ts
// Tên HS đã mã hoá nên không lọc startsWith trong DB được: tải id + tên, giải mã rồi lọc.
export async function studentIdsByNamePrefix(db: PrismaClient, prefix: string): Promise<number[]>
// Xoá cứng theo id; FK cascade dọn monthly_tuition, payments, session_students.
export async function hardDeleteStudents(db: PrismaClient, ids: number[]): Promise<void>
```

- [ ] **Step 1: Tests (RED)**
  1. U29: viết `studentIdsByNamePrefix` (dùng `isEncrypted` + `decryptField(value, "fullName")` từ `src/server/crypto/field-crypto.ts`) và unit test nhỏ `tests/unit/lib/db-cleanup.test.ts` với 1 tên mã hoá + 1 tên thường → trả đúng id. (RED trước khi có hàm.)
  2. U31: integration — HS có 1 lần thu 200k tháng trước → xoá mềm → `purgeTrash(…, "student")` → `report` tháng trước: tổng thu vẫn 200k; dòng HS (nếu báo cáo liệt kê) tên "Học sinh đã xoá". RED nếu báo cáo hụt (nếu PASS ngay thì giữ làm test hồi quy, ghi Ruling "test hồi quy, code đã đúng").
- [ ] **Step 2: Cài đặt**
  - `tuition-notice.spec.ts` (và spec khác dọn HS theo `fullName startsWith`): `beforeAll`/`afterAll` dùng `hardDeleteStudents(db, await studentIdsByNamePrefix(db, 'HS Phiếu'))`.
  - `trash.spec.ts`: gom id HS tạo trong test vào mảng ở phạm vi file; `test.afterAll` gọi `hardDeleteStudents` với cả HS còn nợ (sau các bước dọn qua API hiện có).
- [ ] **Step 3:** chạy `pnpm exec playwright test tests/e2e/tuition-notice.spec.ts tests/e2e/trash.spec.ts` 2 lần liên tiếp → PASS; sau đó đếm HS có tên giải mã bắt đầu "HS Phiếu" / "E2E Rác" trong DB test = 0 (script nhỏ dùng helper, không commit).
- [ ] **Step 4: Commit** `test(u): dọn HS e2e theo tên đã mã hoá, xoá cứng HS còn nợ, test báo cáo sau khi dọn`

### Task 8: Version, kiểm chứng toàn bộ

- [ ] **Step 1:** `package.json` version `0.9.2` → `0.9.3`.
- [ ] **Step 2:** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` → xanh (ghi số file/test).
- [ ] **Step 3:** e2e 2 nửa (kiểm RAM trước, dọn tiến trình sau) → xanh, ghi số pass/skip.
- [ ] **Step 4: Commit** `chore(u): nâng version 0.9.3`
- [ ] **Step 5:** báo cáo `.superpowers/gehihi/bao-cao-U.md` + dòng `DONE U` trên kênh. Danh sách kiểm tay cho Claude: sheet học phí HS trọn tháng (nhãn trọn gói, "số tiền đã đổi"), thẻ ca desktop không nháy, popup mua gói, form HS trọn tháng 0đ báo lỗi.
