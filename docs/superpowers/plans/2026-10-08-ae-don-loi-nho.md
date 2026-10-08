# AE — Dọn lỗi nhỏ 0.15.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa gọn toàn bộ lỗi nhỏ còn tồn (lịch, góp ý, Có gì mới, học phí, điều hướng, trợ năng, 8 minor của tour, ảnh hướng dẫn), phát hành `0.15.1`.

**Architecture:** Mỗi task sửa một nhóm file độc lập, test đỏ trước. Không đổi schema, không API mới. Tour sửa ở `tour-controller.ts` (thuần, test bằng driver giả) và `TourRunner.tsx`.

**Tech Stack:** Next.js 15, React 19, tRPC v11, Prisma 5 (chỉ query, không migration), driver.js 1.9, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-ae-don-loi-nho-design.md`

## Global Constraints

**Nhánh, version**
- Nhánh `fix/ae-don-loi-nho` tạo từ `main` (main đã có commit spec + plan). Version cuối `0.15.1`. **Không migration, không lệnh prisma nào, không cài/nâng thư viện.**

**Chạy lệnh**
- Không `pnpm build` / `pnpm dev`. Test chỉ chạy với `.env.test` (localhost:5433). Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.
- Ngoại lệ đã được người dùng đồng ý (2026-10-08, "gom hết luôn sửa 1 thể"): Task 7 chạy `pnpm exec playwright test -c playwright.guide-shots.config.ts` (tự bật dev server như lần AA) và `pnpm guide:docx`.
- Test 3 tầng: mỗi task chỉ test của task + `pnpm exec tsc --noEmit` + `pnpm lint`; full `pnpm test` và full e2e 2 nửa **chỉ 1 lần ở Task 8**.
- Khoá test `D:\APINODEJS\student-managerment\.superpowers\test-lock.txt` bắt buộc trước mọi `pnpm test …` / `pnpm exec playwright test …`.
- e2e: RAM ≥ 3000 MB, foreground, seed trước bằng `pnpm test tests/integration/plan-launch-migration.test.ts`, chỉ dừng PID mình tạo, tắt dev server cổng 3000 khi xong.

**Chữ và giao diện**
- Chữ mới qua i18n `vi.json` + `en.json` cùng bộ key. Không dùng gạch dài (—, –) trong chữ hiển thị.
- Màu A3 (teal `primary`, slate). Không indigo/violet/purple. Vùng chạm ≥ 44px trên mobile.
- `page.tsx` / `layout.tsx` không có định danh `params` / `searchParams` (kể cả comment).

**Commit**
- Commit 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do.
- Mỗi task: test của task xanh + tsc + lint sạch → commit → ledger `.superpowers/sdd/2026-10-08-ae-don-loi-nho/progress.md`.
- **Không xoá / nới test cũ để qua.** Đổi kỳ vọng test cũ chỉ khi đúng hành vi mới, ghi Ruling.

## Review Focus

1. **Tour mới tắt mà hộp Thêm học sinh còn mở, Có gì mới bật đè lên.** Test: Task 5 WhatsNew "có hộp đang mở thì chờ, hộp đóng mới mở".
2. **Mũi tên trong ô nhập (gõ tên, chọn lớp) bị tour cướp làm nhảy bước.** Test: Task 4 "mũi tên trong input không chuyển bước".
3. **Bấm nút con trong dòng học phí (Đã đóng đủ) làm tour nhảy sang bước chi tiết.** Test: Task 4 "bấm nút con trong phần tử 👆 không tính".
4. **Cờ `tourActive` kẹt `true` khi lần chạy bị huỷ** (đổi trang lúc đang tải) → Có gì mới không bao giờ tự mở. Test: Task 5 "đổi trang khi đang tải: không chạy, cờ tắt".
5. **Miễn rồi đóng sheet gửi ghi chú lần 2** (ghi đè ghi chú vừa lưu từ thiết bị khác). Test: Task 2 "Miễn xong đóng sheet ngay: không gửi lại".

## Bên thực thi (người dùng chốt 2026-10-08)

- **Claude-OTD làm toàn bộ Task 1 → 8**, tuần tự, ở `D:\APINODEJS\student-managerment`, nhánh `fix/ae-don-loi-nho` (Claude tạo sẵn và checkout). Gehihi không làm plan này.
- Luật: `.superpowers/claude-otd/CLAUDE-OTD.md`. Ledger: `.superpowers/sdd/2026-10-08-ae-don-loi-nho/progress.md`.

---

### Task 1: Server — giới hạn góp ý, markSeen 2 tab, tách test onboarding

**Files:**
- Modify: `src/server/services/feedback.service.ts`
- Modify: `src/server/services/release.service.ts`
- Test: `tests/integration/feedback.test.ts`, `tests/unit/server/release-mark-seen.test.ts` (tạo mới), `tests/integration/onboarding.test.ts`

**Interfaces:** không đổi chữ ký hàm nào.

- [ ] **Step 1: Test đỏ, góp ý gửi dồn**

Thêm vào `tests/integration/feedback.test.ts` (dùng caller/helper sẵn có trong file, user giáo viên sạch góp ý):

```ts
it("7 lần gửi cùng lúc chỉ lọt đúng 5 (giới hạn 24h không bị vượt khi gửi dồn)", async () => {
  const caller = await getAuthedCaller("teacher")
  const results = await Promise.allSettled(
    Array.from({ length: 7 }, (_, i) => caller.feedback.submit({ rating: 5, message: `m${i}`, page: "/dashboard" }))
  )
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5)
  const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
  expect(await db.feedback.count({ where: { userId: u.id } })).toBe(5)
})
```

- [ ] **Step 2: Chạy, kỳ vọng FAIL**

Run: `pnpm test tests/integration/feedback.test.ts`
Expected: FAIL (fulfilled > 5). Nếu PASS ngay (DB local không tái hiện được tranh chấp): giữ test, ghi `Task 1: Ruling: test gửi dồn xanh trước khi sửa — vẫn sửa theo spec A3`, làm tiếp.

- [ ] **Step 3: Sửa `submitFeedback`**

```ts
// Khoá 2 số theo user (7401, 7402 đã dùng): 2 lần gửi cùng lúc phải chờ nhau, không cùng đọc "còn lượt".
const FEEDBACK_LOCK_NS = 7403

export async function submitFeedback(
  db: PrismaClient,
  userId: number,
  input: { rating: number; message?: string; page: string }
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FEEDBACK_LOCK_NS}::int, ${userId}::int)`
    const since = new Date(Date.now() - 24 * 3600_000)
    const recent = await tx.feedback.count({ where: { userId, createdAt: { gte: since } } })
    if (recent >= FEEDBACK_DAILY_LIMIT) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "FEEDBACK_LIMIT" })
    // Bản app lấy ở server, không tin client.
    await tx.feedback.create({
      data: { userId, rating: input.rating, message: input.message?.trim() || null, page: input.page, appVersion: pkg.version },
    })
    await tx.user.updateMany({ where: { id: userId, feedbackPromptAt: null }, data: { feedbackPromptAt: new Date() } })
    return { ok: true as const }
  })
}
```

- [ ] **Step 4: Chạy, kỳ vọng PASS**

Run: `pnpm test tests/integration/feedback.test.ts`
Expected: PASS toàn file.

- [ ] **Step 5: Test đỏ, markSeen bị tab khác ghi trước**

Tạo `tests/unit/server/release-mark-seen.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { markReleaseSeen } from "@/server/services/release.service"
import { RELEASES } from "@/lib/releases"

// RELEASES xếp mới nhất trước.
const [NEWEST, MID, OLD] = [RELEASES[0].version, RELEASES[1].version, RELEASES[2].version]

describe("markReleaseSeen", () => {
  it("tab khác vừa ghi bản mới hơn giữa lúc đọc và ghi: không đè lùi, trả bản mới nhất", async () => {
    const db = {
      user: {
        findUniqueOrThrow: vi.fn()
          .mockResolvedValueOnce({ lastSeenRelease: OLD })
          .mockResolvedValueOnce({ lastSeenRelease: NEWEST }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn(),
      },
    }
    expect(await markReleaseSeen(db as never, 1, MID)).toEqual({ lastSeenRelease: NEWEST })
    expect(db.user.update).not.toHaveBeenCalled()
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: 1, lastSeenRelease: OLD }, data: { lastSeenRelease: MID } })
  })

  it("không ai chen: ghi có điều kiện 1 lần", async () => {
    const db = {
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ lastSeenRelease: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
    }
    expect(await markReleaseSeen(db as never, 1, NEWEST)).toEqual({ lastSeenRelease: NEWEST })
    expect(db.user.updateMany).toHaveBeenCalledTimes(1)
  })
})
```

Run: `pnpm test tests/unit/server/release-mark-seen.test.ts`
Expected: FAIL (`updateMany` không được gọi; code cũ dùng `update`).

- [ ] **Step 6: Sửa `markReleaseSeen`**

```ts
// Tab cũ chưa tải lại sau deploy có thể gửi bản cũ hơn → không lùi.
export async function markReleaseSeen(db: PrismaClient, userId: number, version: string): Promise<{ lastSeenRelease: string | null }> {
  if (!isKnownRelease(version)) throw new TRPCError({ code: "BAD_REQUEST", message: "Phiên bản không hợp lệ" })
  const { lastSeenRelease } = await getReleaseStatus(db, userId)
  if (lastSeenRelease && compareVersions(version, lastSeenRelease) <= 0) return { lastSeenRelease }
  // Ghi có điều kiện: tab khác ghi xen giữa thì đọc lại rồi so tiếp, không đè.
  const { count } = await db.user.updateMany({ where: { id: userId, lastSeenRelease }, data: { lastSeenRelease: version } })
  if (count === 0) return markReleaseSeen(db, userId, version)
  return { lastSeenRelease: version }
}
```

Run: `pnpm test tests/unit/server/release-mark-seen.test.ts tests/integration/release.test.ts`
Expected: PASS cả 2 file.

- [ ] **Step 7: Tách test onboarding (chỉ test, không sửa code)**

Trong `tests/integration/onboarding.test.ts`, thay test `"HS và ca đã xoá mềm, điểm danh của ca đã xoá không tính"` bằng 2 test:

```ts
it("ca đã xoá mềm: không tính ca, không tính điểm danh của ca đó (HS vẫn tính)", async () => {
  const caller = await getAuthedCaller("teacher")
  const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
  const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS W2a", grade: 5, tuitionFee: 100_000 })
  const today = new Date().toISOString().slice(0, 10)
  const ses = await caller.session.create({ sessionDate: today, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [st.id] })
  await db.sessionStudent.updateMany({ where: { sessionId: ses.id }, data: { attendance: "present" } })
  await db.teachingSession.update({ where: { id: ses.id }, data: { isDeleted: true, deletedAt: new Date() } })
  expect((await caller.onboarding.status()).steps).toEqual({ ...NONE, student: true })
})

it("HS đã xoá mềm: không tính HS, không tính điểm danh của HS đó (ca vẫn tính)", async () => {
  const caller = await getAuthedCaller("teacher")
  const subjectId = (await caller.subject.list({})).find((s) => s.isDefault)!.id
  const st = await caller.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS W2b", grade: 5, tuitionFee: 100_000 })
  const today = new Date().toISOString().slice(0, 10)
  const ses = await caller.session.create({ sessionDate: today, startTime: "10:00", endTime: "11:00", subjectId, studentIds: [st.id] })
  await db.sessionStudent.updateMany({ where: { sessionId: ses.id }, data: { attendance: "present" } })
  await db.student.update({ where: { id: st.id }, data: { isDeleted: true, deletedAt: new Date() } })
  expect((await caller.onboarding.status()).steps).toEqual({ ...NONE, session: true })
})
```

Run: `pnpm test tests/integration/onboarding.test.ts`
Expected: PASS (test tách ra để chứng minh từng bộ lọc; xanh ngay là đúng). Nếu đỏ: đó là lỗi thật của bộ lọc → STOP báo Claude, không sửa test.

- [ ] **Step 8: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/server/services/feedback.service.ts src/server/services/release.service.ts tests/integration/feedback.test.ts tests/unit/server/release-mark-seen.test.ts tests/integration/onboarding.test.ts
git commit -m "fix: gop y gui don khong vuot gioi han, markSeen 2 tab khong ghi lui, tach test onboarding"
```

---

### Task 2: Học phí — Miễn không gửi lại ghi chú, giữ khoảng trắng ghi chú cũ

**Files:**
- Modify: `src/components/tuition/TuitionDetailSheet.tsx` (khoảng dòng 163–212)
- Test: `tests/unit/components/TuitionDetailSheetReviewFix.test.tsx` (thêm vào `describe("TuitionDetailSheet — Miễn có lý do")`)

- [ ] **Step 1: Test đỏ**

Dùng sẵn `renderSheet`, `openMenu`, `openWaive`, `mockUpdateSettlementMutate`, `mockClientSettlement` của file:

```ts
it("Miễn có lý do thành công rồi đóng sheet ngay (chưa refetch): không gửi lại ghi chú", () => {
  const { unmount } = renderSheet()
  openMenu()
  fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
  fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
  fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
  act(() => mockUpdateSettlementMutate.mock.calls[0][1].onSuccess())
  unmount()
  expect(mockClientSettlement).not.toHaveBeenCalled()
})

it("blur lưu ghi chú thành công rồi đóng sheet ngay: không gửi lại", () => {
  const { unmount } = renderSheet()
  const box = screen.getByPlaceholderText("Nhập ghi chú thanh toán (nếu có)...")
  fireEvent.change(box, { target: { value: "hẹn thứ 7" } })
  fireEvent.blur(box)
  act(() => mockUpdateSettlementMutate.mock.calls[0][1].onSuccess())
  unmount()
  expect(mockClientSettlement).not.toHaveBeenCalled()
})

it("Miễn có lý do giữ nguyên khoảng trắng của ghi chú cũ", () => {
  const spaced = { ...rowData, notes: "  dòng 1  " }
  currentRow = spaced
  renderSheet(spaced)
  openMenu()
  fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
  fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
  fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
  expect(mockUpdateSettlementMutate.mock.calls[0][0].notes).toBe("  dòng 1  \nMiễn: x")
})

it("ghi chú cũ toàn khoảng trắng → notes chỉ là 'Miễn: <lý do>'", () => {
  const blank = { ...rowData, notes: "   " }
  currentRow = blank
  renderSheet(blank)
  openMenu()
  fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
  fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
  fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
  expect(mockUpdateSettlementMutate.mock.calls[0][0].notes).toBe("Miễn: x")
})
```

(Nếu `mockUpdateSettlementMutate` của file không được reset giữa các test này, thêm `mockClientSettlement.mockReset()` vào `beforeEach` của describe — chỉ reset, không đổi test cũ.)

Run: `pnpm test tests/unit/components/TuitionDetailSheetReviewFix.test.tsx`
Expected: FAIL 3 test mới (2 test gửi lại + test khoảng trắng); test "toàn khoảng trắng" có thể xanh sẵn.

- [ ] **Step 2: Sửa**

```tsx
  // row.notes chưa kịp refetch sau khi lưu (blur / Miễn) → so với giá trị vừa lưu, tránh gửi lại khi đóng sheet.
  const lastSaved = useRef<string | null>(null)
  // Đóng sheet bằng Esc/vuốt không bắn blur → lưu ghi chú còn dở khi unmount (client thường, không phụ thuộc component).
  const pendingNotes = useRef({ notes, saved: row.notes ?? "" })
  pendingNotes.current = { notes, saved: lastSaved.current ?? row.notes ?? "" }
```

`handleBlurNotes`:

```tsx
  const handleBlurNotes = () => {
    if (notes !== (lastSaved.current ?? row.notes ?? "")) {
      const sent = notes
      updateSettlementMut.mutate(
        { studentId, year, month, notes: sent === "" ? null : sent },
        {
          onSuccess: () => {
            lastSaved.current = sent
            setNotesSaved(true)
            setTimeout(() => setNotesSaved(false), 2000)
          },
        }
      )
    }
  }
```

`handleConfirmWaive`:

```tsx
    // Lý do nối vào ghi chú đang có trong ô (kể cả chưa lưu), giữ nguyên khoảng trắng người dùng gõ.
    const nextNotes = reason ? [notes, t("waive_note").replace("{reason}", reason)].filter((s) => s.trim() !== "").join("\n") : null
    ...
        onSuccess: () => {
          // Đổi ô ghi chú chỉ khi miễn thành công: lỗi mà đổi trước thì lần lưu khi đóng sheet sẽ ghi "Miễn" dù chưa miễn.
          if (nextNotes !== null) {
            lastSaved.current = nextNotes
            setNotes(nextNotes)
          }
          ...
```

- [ ] **Step 3: Chạy lại cả nhóm test sheet**

Run: `pnpm test tests/unit/components/TuitionDetailSheetReviewFix.test.tsx tests/unit/components/TuitionDetailSheetPay.test.tsx tests/unit/components/TuitionDetailSheetNoticeMark.test.tsx tests/unit/components/TuitionDetailSheetNoticeButton.test.tsx`
Expected: PASS hết (gồm test cũ "nhập lý do → … 'ghi chú cũ\nMiễn: hoàn cảnh khó khăn'").

- [ ] **Step 4: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/tuition/TuitionDetailSheet.tsx tests/unit/components/TuitionDetailSheetReviewFix.test.tsx
git commit -m "fix: mien hoc phi khong gui lai ghi chu khi dong sheet, giu khoang trang ghi chu cu"
```

---

### Task 3: Lịch hôm nay theo giờ VN, lối vào Hướng dẫn, trợ năng

**Files:**
- Modify: `src/hooks/useCalendar.ts` (`buildCalendarGrid`, dòng ~72)
- Modify: `src/components/layout/AppHeader.tsx`, `src/app/guide/page.tsx`, `src/components/guide/GuideContent.tsx`
- Modify: `src/components/whats-new/WhatsNew.tsx`, `src/components/dashboard/StartCard.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`, `src/components/layout/MoreSheet.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/hooks/useCalendar.test.tsx`, `tests/unit/components/AppHeader.test.tsx`, `tests/unit/components/GuideContent.test.tsx`, `tests/unit/components/WhatsNew.test.tsx`, `tests/unit/components/StartCard.test.tsx`, `tests/unit/components/AppSidebarGuide.test.tsx`

**Interfaces:**
- Produces: `GuideContent({ canTour, home }: { canTour?: boolean; home?: string | null })`; i18n key `guide_back_home`.

- [ ] **Step 1: Test đỏ, ô hôm nay**

Thêm vào `tests/unit/hooks/useCalendar.test.tsx`:

```ts
it("ô hôm nay theo ngày VN, không theo giờ máy (01:30 sáng 1/11 giờ VN, máy chạy UTC)", () => {
  const prev = process.env.TZ
  process.env.TZ = "UTC"
  try {
    const { grid } = buildCalendarGrid(2026, 11, [], new Date("2026-10-31T18:30:00Z"))
    expect(grid.filter((c) => c.isToday).map((c) => c.date)).toEqual(["2026-11-01"])
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
})
```

Run: `pnpm test tests/unit/hooks/useCalendar.test.tsx`
Expected: FAIL (ô hôm nay là `2026-10-31`). Nếu xanh ngay vì máy không đổi được TZ lúc chạy: ghi Ruling, vẫn sửa.

- [ ] **Step 2: Sửa `buildCalendarGrid`**

```ts
  // Ngày VN: máy người dùng / CI chạy UTC thì getDate() lệch sang hôm trước tới 7h sáng.
  const vnToday = vnDateParts(today)
  const todayKey = ymd(vnToday.year, vnToday.month, vnToday.day)
```

(`vnDateParts` đã import sẵn ở đầu file.) Chạy lại → PASS.

- [ ] **Step 3: i18n**

Thêm vào cuối `vi.json` / `en.json` (giữ JSON hợp lệ):
- `"guide_back_home": "Về trang chính"` / `"guide_back_home": "Back to home"`
- `"tour_load_error": "Không tải được hướng dẫn, thử lại sau nhé."` / `"tour_load_error": "Could not load the guide, please try again."` (Task 5 dùng)

- [ ] **Step 4: Test đỏ, admin có lối vào Hướng dẫn + /guide khi đã đăng nhập**

`tests/unit/components/AppHeader.test.tsx` (mở menu avatar theo cách các test sẵn có trong file làm):

```ts
it("admin: menu avatar có HD sử dụng mở /guide tab mới", async () => {
  // render AppHeader variant="admin" như test admin sẵn có, mở menu avatar
  const link = await screen.findByRole("menuitem", { name: /HD sử dụng/ })
  expect(link.getAttribute("href")).toBe("/guide")
  expect(link.getAttribute("target")).toBe("_blank")
})
```

`tests/unit/components/GuideContent.test.tsx`:

```ts
it("đã đăng nhập: link cuối trang về trang chính, không còn Về trang đăng nhập", () => {
  renderVi(<GuideContent canTour home="/dashboard" />)   // dùng helper render sẵn có của file
  expect(screen.getByRole("link", { name: "Về trang chính" }).getAttribute("href")).toBe("/dashboard")
  expect(screen.queryByRole("link", { name: "Về trang đăng nhập" })).toBeNull()
})

it("chưa đăng nhập: giữ Về trang đăng nhập", () => {
  renderVi(<GuideContent />)
  expect(screen.getByRole("link", { name: "Về trang đăng nhập" }).getAttribute("href")).toBe("/login")
})
```

Run: `pnpm test tests/unit/components/AppHeader.test.tsx tests/unit/components/GuideContent.test.tsx`
Expected: FAIL 2 test mới (test thứ 3 xanh sẵn).

- [ ] **Step 5: Sửa**

`AppHeader.tsx`, nhánh `admin ?` thành fragment, thêm sau mục Quản trị (import `CircleHelp` từ lucide-react):

```tsx
              <>
                <DropdownMenuItem asChild>
                  <Link href={ADMIN_HOME}>
                    <ShieldCheck className="size-4 mr-2" />
                    {t("admin_page")}
                  </Link>
                </DropdownMenuItem>
                {/* Admin không có sidebar giáo viên: đây là lối duy nhất vào Hướng dẫn. */}
                <DropdownMenuItem asChild>
                  <a href="/guide" target="_blank" rel="noopener noreferrer">
                    <CircleHelp className="size-4 mr-2" />
                    {t("guide_nav")}
                    <span className="sr-only"> {t("opens_new_tab")}</span>
                  </a>
                </DropdownMenuItem>
              </>
```

`src/app/guide/page.tsx`:

```tsx
import { ADMIN_HOME, isAdminUsername } from "@/lib/admin"
...
export default async function GuidePage() {
  const user = (await auth())?.user
  const admin = !!user && isAdminUsername(user.username)
  const canTour = !!user && !admin && user.mustChangePassword !== true
  return <GuideContent canTour={canTour} home={!user ? null : admin ? ADMIN_HOME : "/dashboard"} />
}
```

`GuideContent.tsx`: thêm prop `home = null` (`{ canTour?: boolean; home?: string | null }`), link cuối:

```tsx
        {home ? (
          <Link href={home} className="inline-flex min-h-11 items-center text-sm text-primary underline">{t("guide_back_home")}</Link>
        ) : (
          <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-primary underline">{t("guide_back_login")}</Link>
        )}
```

Chạy lại 2 file → PASS. Kiểm e2e cũ có đếm `menuitem` của admin: `grep -rn "menuitem" tests/e2e`; có test đếm số mục menu **admin** thì sửa kỳ vọng +1 kèm Ruling (đúng hành vi mới).

- [ ] **Step 6: Test đỏ, trợ năng**

`WhatsNew.test.tsx` (dùng mock `useMediaQuery` / render sẵn có; ép mobile `false` như test mobile nếu có, không có thì mock `@/hooks/useMediaQuery` trả `false` trong test này):

```ts
it("mobile: nút Có gì mới là button có aria-haspopup=dialog, không bọc span onClick", () => {
  // render ở mobile
  const btn = screen.getByRole("button", { name: "Có gì mới" })
  expect(btn.getAttribute("aria-haspopup")).toBe("dialog")
  expect(btn.parentElement?.tagName).not.toBe("SPAN")
})
it("desktop: ô Có gì mới có aria-label", async () => {
  // render desktop, data chưa xem → ô tự mở
  expect((await screen.findByRole("dialog")).getAttribute("aria-label")).toBe("Có gì mới")
})
```

`StartCard.test.tsx`:

```ts
it("thanh tiến độ có role progressbar + giá trị; tiêu đề là heading", () => {
  // render với 2/5 bước xong theo cách test sẵn có
  const bar = screen.getByRole("progressbar", { name: "Bắt đầu sử dụng" })
  expect(bar.getAttribute("aria-valuenow")).toBe("2")
  expect(bar.getAttribute("aria-valuemax")).toBe("5")
  expect(screen.getByRole("heading", { name: "Bắt đầu sử dụng" })).toBeDefined()
})
```

`AppSidebarGuide.test.tsx`:

```ts
it("link HD sử dụng có chữ ẩn báo mở tab mới", () => {
  // render như test sẵn có
  expect(screen.getByRole("link", { name: /HD sử dụng.*mở tab mới/ })).toBeDefined()
})
```

(Nếu file có test MoreSheet thì thêm test tương tự; không có thì kiểm MoreSheet bằng e2e `mobile.spec.ts` sẵn có, không tạo file mới.)

Run: `pnpm test tests/unit/components/WhatsNew.test.tsx tests/unit/components/StartCard.test.tsx tests/unit/components/AppSidebarGuide.test.tsx`
Expected: FAIL các test mới. Nếu `getByRole("dialog")` của PopoverContent không có role dialog trong jsdom: tìm theo `screen.getByText(<tiêu đề bản mới>).closest("[aria-label]")` và ghi Ruling.

- [ ] **Step 7: Sửa**

`WhatsNew.tsx`: đổi `trigger` thành hàm nhận props thêm:

```tsx
  const trigger = (extra?: React.ComponentProps<typeof Button>) => (
    <Button variant="outline" className="relative h-11 gap-2 px-3 text-slate-700 md:h-10" aria-label={t("whatsnew_button")} {...extra}>
      ...giữ nguyên nội dung...
    </Button>
  )
```

Desktop: `<PopoverTrigger asChild>{trigger()}</PopoverTrigger>` và `<PopoverContent aria-label={t("whatsnew_button")} align="end" ...>`.
Mobile: thay `<span onClick={() => change(true)}>{trigger}</span>` bằng `{trigger({ onClick: () => change(true), "aria-haspopup": "dialog", "aria-expanded": open })}`.

`StartCard.tsx`: `<p className="font-semibold text-slate-900">{t("start_title")}</p>` → `<h2 className="font-semibold text-slate-900">…</h2>`; thanh tiến độ:

```tsx
        <div
          role="progressbar"
          aria-label={t("start_title")}
          aria-valuemin={0}
          aria-valuemax={START_STEPS.length}
          aria-valuenow={done}
          className="h-2 overflow-hidden rounded-full bg-slate-100"
        >
```

`AppSidebar.tsx` nhánh `item.external`: sau `<span>{label}</span>` thêm `<span className="sr-only"> {t("opens_new_tab")}</span>` (lấy `t` bằng `useTranslation()` trong `SidebarLink` nếu chưa có). `MoreSheet.tsx` nhánh `item.external`: thêm cùng `<span className="sr-only">` ngay trước `<ChevronRight …/>`.

Chạy lại 3 file → PASS.

- [ ] **Step 8: tsc + lint + chạy cả nhóm + commit**

Run: `pnpm test tests/unit/hooks/useCalendar.test.tsx tests/unit/components/AppHeader.test.tsx tests/unit/components/GuideContent.test.tsx tests/unit/components/WhatsNew.test.tsx tests/unit/components/StartCard.test.tsx tests/unit/components/AppSidebarGuide.test.tsx tests/unit/components/AppSidebar.test.tsx`
Expected: PASS.

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/hooks/useCalendar.ts src/components/layout/AppHeader.tsx src/app/guide/page.tsx src/components/guide/GuideContent.tsx src/components/whats-new/WhatsNew.tsx src/components/dashboard/StartCard.tsx src/components/layout/AppSidebar.tsx src/components/layout/MoreSheet.tsx src/language/vi.json src/language/en.json tests/unit/hooks/useCalendar.test.tsx tests/unit/components/AppHeader.test.tsx tests/unit/components/GuideContent.test.tsx tests/unit/components/WhatsNew.test.tsx tests/unit/components/StartCard.test.tsx tests/unit/components/AppSidebarGuide.test.tsx
git commit -m "fix: o hom nay theo gio VN, admin vao duoc huong dan, nhan tro nang cho Co gi moi, the Bat dau, link tab moi"
```

---

### Task 4: Tour controller — nút con trong bước 👆, chờ bước đầu lâu hơn, phím mũi tên

**Files:**
- Modify: `src/lib/tours.ts` (thêm hằng), `src/lib/tour-controller.ts`
- Test: `tests/unit/lib/tour-controller.test.ts`

**Interfaces:**
- Produces: `TOUR_FIRST_WAIT_MS = 8000` (tours.ts); `RunTourOptions.firstWaitMs?: number` (mặc định = `waitMs`, để test cũ giữ nguyên 3000).
- Consumes (Task 5): `runTour({ ..., firstWaitMs: TOUR_FIRST_WAIT_MS })`.

- [ ] **Step 1: Test đỏ**

Sửa `setup` trong test cho nhận thêm tuỳ chọn (không đổi test cũ):

```ts
function setup(steps: TourStep[], extra: Partial<Pick<RunTourOptions, "firstWaitMs">> = {}) {
  ...
  const handle = runTour({ driver, steps, t: t as never, onMissingClickTarget, onStartTour, onEnd, ...extra })
```

(import thêm `type RunTourOptions`). Test mới:

```ts
it("bước 👆 là cả dòng: bấm nút con trong dòng không tính, bấm vào dòng mới đi tiếp", async () => {
  const row = document.createElement("div")
  row.setAttribute("data-tour", "row")
  row.getBoundingClientRect = () => ({ width: 10, height: 10, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) })
  const inner = document.createElement("button")
  row.appendChild(inner)
  const cell = document.createElement("span")
  row.appendChild(cell)
  document.body.appendChild(row)
  const b = addTarget("b")
  const { calls } = setup([
    { target: "row", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
    { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
  ])
  await flush()
  inner.click()
  await vi.advanceTimersByTimeAsync(200)
  expect(calls).toHaveLength(1)
  cell.click()
  await vi.advanceTimersByTimeAsync(200)
  expect(calls[1].element).toBe(b)
})

it("bước đầu chờ theo firstWaitMs (trang tải nguội), bước sau vẫn 3 giây", async () => {
  const { calls, onEnd } = setup([
    { target: "late", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
    { target: "missing", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
  ], { firstWaitMs: 8000 })
  await vi.advanceTimersByTimeAsync(5000)
  addTarget("late")
  await vi.advanceTimersByTimeAsync(200)
  expect(calls).toHaveLength(1)
  calls[0].popover.onNextClick()
  await vi.advanceTimersByTimeAsync(2900)
  expect(onEnd).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(300)
  // Bước 2 thiếu → bỏ qua sau 3s (không phải 8s) → hết bước, tour tắt.
  expect(calls).toHaveLength(1)
  expect(onEnd).toHaveBeenCalledTimes(1)
})

it("mũi tên phải = Tiếp, trái = Quay lại", async () => {
  addTarget("a"); addTarget("b")
  const { calls } = setup([
    { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
    { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
  ])
  await flush()
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  await flush()
  expect(calls).toHaveLength(2)
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
  await flush()
  expect(calls).toHaveLength(3)
  expect(calls[2].popover.title).toContain("1/2")
})

it("mũi tên trong ô nhập không chuyển bước; bước 👆 không có Tiếp nên mũi tên không làm gì", async () => {
  addTarget("a"); addTarget("b")
  const input = document.createElement("input")
  document.body.appendChild(input)
  const { calls } = setup([
    { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
    { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body", advanceOn: "click" },
  ])
  await flush()
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  await flush()
  expect(calls).toHaveLength(1)
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  await flush()
  expect(calls).toHaveLength(2)
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  await flush()
  expect(calls).toHaveLength(2)
})

it("tour tắt thì gỡ listener phím", async () => {
  addTarget("a"); addTarget("b")
  const { calls, handle } = setup([
    { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body" },
    { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
  ])
  await flush()
  handle.stop()
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  await flush()
  expect(calls).toHaveLength(1)
})
```

Run: `pnpm test tests/unit/lib/tour-controller.test.ts`
Expected: FAIL 4 test mới (test "tắt thì gỡ listener" có thể xanh sẵn).

- [ ] **Step 2: Sửa**

`tours.ts`, cạnh `TOUR_WAIT_MS`:

```ts
// Bước đầu: trang vừa chuyển có thể tải nguội (dev, mạng chậm) lâu hơn 3 giây.
export const TOUR_FIRST_WAIT_MS = 8000
```

`tour-controller.ts`:

```ts
// Ô nhập / vùng tự xử lý mũi tên: không cướp phím làm nhảy bước.
const KEY_OWNERS = 'input, textarea, select, [contenteditable="true"], [role="radio"], [role="slider"], [role="combobox"], [role="option"], [role="menuitem"], [role="tab"]'
// Bước 👆 trên cả dòng: bấm phần tử bấm được bên trong dòng (Đã đóng đủ, Phiếu báo) không tính là bấm dòng.
const NESTED_INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="checkbox"]'
```

Trong `RunTourOptions` thêm `firstWaitMs?: number`. Trong `runTour`:

```ts
  const { driver, steps, t, waitMs = TOUR_WAIT_MS } = opts
  let nextWait = opts.firstWaitMs ?? waitMs
  let keyNav: { next?: () => void; prev?: () => void } = {}
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    if ((e.target as Element | null)?.closest?.(KEY_OWNERS)) return
    const fn = e.key === "ArrowRight" ? keyNav.next : keyNav.prev
    if (!fn) return
    e.preventDefault()
    fn()
  }
  // driver.js chỉ nghe mũi tên khi chạy kiểu nhiều bước; highlight() từng bước thì phải tự nghe.
  document.addEventListener("keydown", onKey, true)
```

`clearStep()` thêm `keyNav = {}`. `stop()` thêm `document.removeEventListener("keydown", onKey, true)`.
Trong `show()`: `const found = await waitForTarget(step.target, nextWait, () => stopped)` rồi ngay sau `await` đặt `nextWait = waitMs`. Tách `onNextClick` / `onPrevClick` thành hằng `onNext` / `onPrev` trong `show()`, truyền vào popover như cũ, và sau `driver.highlight(...)`:

```ts
    keyNav = { next: buttons.includes("next") ? onNext : undefined, prev: buttons.includes("previous") ? onPrev : undefined }
```

Bước 👆:

```ts
    if (isClick && el) {
      const target = el
      const onClick = (e: Event) => {
        const hit = (e.target as Element | null)?.closest?.(NESTED_INTERACTIVE)
        if (hit && hit !== target && target.contains(hit)) return
        target.removeEventListener("click", onClick)
        // Bước 👆 là mốc: Quay lại không được chỉ vào nút nằm sau hộp vừa mở.
        shown.length = 0
        void show(i + 1, true)
      }
      target.addEventListener("click", onClick)
      removeClick = () => target.removeEventListener("click", onClick)
    }
```

Run: `pnpm test tests/unit/lib/tour-controller.test.ts tests/unit/lib/tours.test.ts`
Expected: PASS toàn bộ (gồm 13 test cũ).

- [ ] **Step 3: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/lib/tours.ts src/lib/tour-controller.ts tests/unit/lib/tour-controller.test.ts
git commit -m "fix: tour bo qua bam nut con trong dong, cho buoc dau 8 giay, phim mui ten chuyen buoc"
```

---

### Task 5: TourRunner, Có gì mới, cuộn hộp trong tour, driver.css tải động

**Files:**
- Modify: `src/components/tour/TourRunner.tsx`, `src/components/whats-new/WhatsNew.tsx`, `src/app/globals.css`
- Test: `tests/unit/components/TourRunner.test.tsx`, `tests/unit/components/WhatsNew.test.tsx`, `tests/e2e/ad-tour.spec.ts`

**Interfaces:**
- Consumes: `TOUR_FIRST_WAIT_MS`, `RunTourOptions.firstWaitMs` (Task 4); i18n `tour_load_error` (Task 3).

- [ ] **Step 1: Test đỏ, TourRunner**

Thêm vào `TourRunner.test.tsx` (import thêm `StrictMode` từ react, `readFileSync` từ `node:fs`, `toast` đã mock):

```ts
it("StrictMode (dev): chỉ 1 driver, 1 lần runTour", async () => {
  render(<StrictMode><LanguageProvider forcedLanguage="vi"><TourRunner /></LanguageProvider></StrictMode>)
  await waitFor(() => expect(run.runTour).toHaveBeenCalled())
  await new Promise((r) => setTimeout(r, 0))
  expect(run.runTour).toHaveBeenCalledTimes(1)
  expect(driver).toHaveBeenCalledTimes(1)
})

it("đổi trang khi đang tải trạng thái: không chạy tour, cờ tắt", async () => {
  nav.search = "tour=attendance"
  nav.pathname = "/calendar"
  let resolve!: (v: unknown) => void
  status.fetch.mockReturnValue(new Promise((r) => { resolve = r }))
  const { rerender } = renderVi()
  nav.search = ""
  nav.pathname = "/students"
  rerender(<LanguageProvider forcedLanguage="vi"><TourRunner /></LanguageProvider>)
  resolve({ steps: { student: true, session: true } })
  await new Promise((r) => setTimeout(r, 0))
  expect(run.runTour).not.toHaveBeenCalled()
  expect(isTourActive()).toBe(false)
})

it("tải trạng thái Bắt đầu lỗi: báo lỗi, không chạy, cờ tắt", async () => {
  nav.search = "tour=attendance"
  nav.pathname = "/calendar"
  status.fetch.mockRejectedValue(new Error("mạng"))
  renderVi()
  await waitFor(() => expect(toast).toHaveBeenCalledWith("Không tải được hướng dẫn, thử lại sau nhé."))
  expect(run.runTour).not.toHaveBeenCalled()
  expect(isTourActive()).toBe(false)
})

it("truyền firstWaitMs cho bước đầu", async () => {
  renderVi()
  await waitFor(() => expect(run.runTour).toHaveBeenCalled())
  expect((run.runTour.mock.calls[0] as unknown as [{ firstWaitMs: number }])[0].firstWaitMs).toBe(8000)
})

it("driver.css không import tĩnh (chỉ tải khi chạy tour)", () => {
  const src = readFileSync("src/components/tour/TourRunner.tsx", "utf8")
  expect(src).not.toMatch(/^import\s+["']driver\.js\/dist\/driver\.css["']/m)
})
```

Run: `pnpm test tests/unit/components/TourRunner.test.tsx`
Expected: FAIL 5 test mới.

- [ ] **Step 2: Sửa `TourRunner.tsx`**

- Bỏ dòng `import "driver.js/dist/driver.css"` đầu file; bỏ ref `alive` và effect của nó (thay bằng `runId`).
- Import thêm `TOUR_FIRST_WAIT_MS`.

```tsx
  const handle = useRef<TourHandle | null>(null)
  // Mỗi lần chạy 1 số; đổi trang / lần chạy mới / StrictMode unmount làm lần cũ còn đang tải tự bỏ.
  const runId = useRef(0)
  const raw = params.get(TOUR_PARAM)

  // Chuyển trang thì tắt tour đang chạy, kể cả lần còn đang tải (chưa có handle).
  // stop() trước rồi mới tăng runId: end() của tour đang chạy phải còn khớp số để dọn handle.
  useEffect(
    () => () => {
      handle.current?.stop()
      runId.current++
      setTourActive(false)
    },
    [pathname]
  )
```

Trong effect `[raw]`, sau toast hộp đang mở:

```tsx
    const my = ++runId.current
    handle.current?.stop()
    setTourActive(true)
    const end = () => {
      if (my !== runId.current) return
      handle.current = null
      setTourActive(false)
    }

    void (async () => {
      try {
        ...
          const status = await utils.onboarding.status.fetch(undefined, { staleTime: 0 })
          if (my !== runId.current) return
          ...
        const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")])
        if (my !== runId.current) return
        const drv = driver({ ...như cũ... })
        handle.current = runTour({
          ...như cũ...,
          firstWaitMs: TOUR_FIRST_WAIT_MS,
        })
      } catch {
        if (my !== runId.current) return
        toast(t("tour_load_error"))
        end()
      }
    })()
```

Lưu ý thứ tự: `handle.current?.stop()` gọi `end` của lần cũ, lần cũ thấy `my` cũ ≠ `runId` nên không xoá `handle` / cờ, rồi lần mới bật cờ. StrictMode: cleanup giả lập unmount chạy effect `[pathname]` → `runId++` → lần chạy 1 tự bỏ, lần 2 chạy. Nếu `tsc` báo không có kiểu cho `import("driver.js/dist/driver.css")`: thêm file `src/types/css.d.ts` với `declare module "*.css"` **chỉ khi** repo chưa có khai báo tương tự (grep `declare module "\*.css"` trước), ghi Ruling.

Run: `pnpm test tests/unit/components/TourRunner.test.tsx`
Expected: PASS toàn file (gồm 7 test cũ).

- [ ] **Step 3: Test đỏ, Có gì mới chờ hộp đóng**

Thêm vào `WhatsNew.test.tsx` (theo cách test "đang có tour thì không tự mở" sẵn có render và đặt data chưa xem):

```ts
it("đang có hộp mở (vd tour vừa tắt trong hộp Thêm học sinh): chờ hộp đóng mới tự mở", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const d = document.createElement("div")
  d.setAttribute("role", "dialog")
  d.setAttribute("data-state", "open")
  document.body.appendChild(d)
  // render với status chưa xem như test "chưa xem → … tự mở"
  await vi.advanceTimersByTimeAsync(1500)
  expect(screen.queryByText(/* tiêu đề bản mới nhất như test cũ */)).toBeNull()
  d.remove()
  await vi.advanceTimersByTimeAsync(1100)
  expect(await screen.findByText(/* tiêu đề */)).toBeDefined()
  vi.useRealTimers()
})
```

Run: `pnpm test tests/unit/components/WhatsNew.test.tsx`
Expected: FAIL (ô mở ngay dù có hộp).

- [ ] **Step 4: Sửa effect tự mở trong `WhatsNew.tsx`**

```tsx
  useEffect(() => {
    // Đang chạy tour thì để sau, tour tắt mới tự mở (spec AD §4.2).
    if (!unseen || autoOpened.current || tourActive) return
    // Tour vừa tắt mà hộp (vd Thêm học sinh) còn mở: chờ hộp đóng rồi mới mở, không đè lên.
    const tryOpen = () => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return false
      autoOpened.current = true
      setOpen(true)
      return true
    }
    if (tryOpen()) return
    const id = setInterval(() => {
      if (tryOpen()) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [unseen, tourActive])
```

Run: `pnpm test tests/unit/components/WhatsNew.test.tsx`
Expected: PASS toàn file.

- [ ] **Step 5: CSS cuộn hộp**

Thêm vào khối TOUR trong `src/app/globals.css`:

```css
/* driver.js khoá cuộn cha trực tiếp của phần tử tô sáng; cha là hộp Radix (chi tiết ca trên mobile) thì phải cuộn được. */
.driver-active [role="dialog"].driver-active-element-parent-no-scroll {
  overflow-y: auto !important;
}
```

- [ ] **Step 6: e2e**

Thêm vào `tests/e2e/ad-tour.spec.ts`:

1. Trong test 390px/1280px Thêm học sinh, ngay sau `await expect(popover(page)).toContainText('Thêm học sinh')`:
   ```ts
   // driver.css tải động vẫn áp dụng.
   await expect(popover(page)).toHaveCSS('position', 'fixed');
   ```
2. Ngay sau bước "Họ tên và lớp" hiện (trước `#fullName`), thử phím: bấm `ArrowRight` khi focus **không** ở ô nhập phải sang "Cách thu học phí"; rồi `ArrowLeft` quay lại "Họ tên và lớp":
   ```ts
   await page.locator('.driver-popover-title').click(); // đưa focus ra khỏi ô nhập
   await page.keyboard.press('ArrowRight');
   await expect(popover(page)).toContainText('Cách thu học phí');
   await page.keyboard.press('ArrowLeft');
   await expect(popover(page)).toContainText('Họ tên và lớp');
   ```
   Nếu click tiêu đề bị Radix kéo focus về trong hộp (FocusScope) thì vẫn đúng: focus về nút trong hộp, không phải ô nhập. Nếu focus rơi vào ô nhập đầu tiên (autoFocus) thì dùng `await page.locator('#fullName').press('Tab')` tới nút không phải ô nhập; ghi Ruling cách đã dùng.
3. Test mới 390px, cuộn hộp chi tiết ca ở bước "sang ca khác". Tạo dữ liệu trong test (user `tour_demo` đã có): 1 môn, 1 HS, **2 ca cùng tháng hiện tại** (để có thanh chuyển ca), rồi:
   ```ts
   test('390px: tour Điểm danh, bước chuyển ca: hộp chi tiết ca vẫn cuộn được', async ({ browser }) => {
     // tạo môn + HS + 2 ca hôm nay và ngày mai (giờ VN) cho tour_demo bằng db, có sessionStudent
     const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
     await login(page);
     await page.goto('/calendar?tour=attendance');
     await page.locator('[data-tour="session-card"]:visible').first().click();
     await expect(popover(page)).toContainText(/* tiêu đề tour_attendance_2_title trong vi.json */);
     const dlg = page.getByRole('dialog');
     await expect(dlg).toHaveCSS('overflow-y', 'auto');
     await page.close();
   });
   ```
   Cleanup sẵn có của file đã xoá ca/HS/môn của `tour_demo`; test chạy trước test "Điểm danh khi chưa có ca" thì phải xoá ca ở cuối test này (gọi lại phần xoá `sessionStudent` + `teachingSession` của `cleanup`) để test đó vẫn đúng.

Run (khoá test, RAM ≥ 3000 MB, seed trước): `pnpm exec playwright test tests/e2e/ad-tour.spec.ts`
Expected: PASS toàn file (7 test).

- [ ] **Step 7: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/tour/TourRunner.tsx src/components/whats-new/WhatsNew.tsx src/app/globals.css tests/unit/components/TourRunner.test.tsx tests/unit/components/WhatsNew.test.tsx tests/e2e/ad-tour.spec.ts
git commit -m "fix: tour huy lan chay cu khi doi trang, bao loi tai, css tai dong, cuon hop chi tiet ca; Co gi moi cho hop dong"
```
(Nếu có tạo `src/types/css.d.ts` ở Step 2 thì add thêm file đó.)

---

### Task 6: Lỗi hydration React #418 ở /students

**Files:**
- Test: `tests/e2e/ae-hydration.spec.ts` (tạo mới)
- Modify: file gây lệch (tìm ở Step 2)

**Cách làm: superpowers:systematic-debugging.** Không đoán sửa trước khi thấy thông báo lỗi đầy đủ.

- [ ] **Step 1: e2e bắt lỗi hydration (đỏ trước)**

```ts
import { test, expect } from '@playwright/test';

// Dev server in thông báo hydration đầy đủ (prod chỉ có mã #418).
const HYDRATION = /hydrat|did not match|#418/i;

for (const path of ['/students', '/dashboard', '/calendar', '/tuition']) {
  test(`${path}: không có lỗi hydration`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && HYDRATION.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => { if (HYDRATION.test(e.message)) errors.push(e.message); });
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}
```

(Tài khoản `teacher` / mật khẩu: dùng đúng tài khoản seed mà các e2e khác dùng, xem `tests/e2e/students.spec.ts`.)

Run: `pnpm exec playwright test tests/e2e/ae-hydration.spec.ts`
Expected: FAIL ít nhất ở `/students`, kèm nội dung lệch (server vs client).
**Nếu xanh hết (không tái hiện được):** thêm 1 lượt với `test.use({ timezoneId: 'Asia/Ho_Chi_Minh', locale: 'vi-VN' })` và 1 lượt `localStorage.language = 'en'` (đặt qua `page.addInitScript` trước khi vào trang). Vẫn xanh → giữ file test (canh về sau), ghi `Task 6: Ruling: không tái hiện #418 ở dev — giữ test canh` và sang Task 7. Không tự sửa mò.

- [ ] **Step 2: Tìm nguyên nhân từ thông báo lỗi**

Đọc đoạn "+ client / - server" trong thông báo. Nghi vấn thường gặp (kiểm theo thứ tự, dừng khi khớp): chữ phụ thuộc giờ (`new Date()`, `toLocale*`, `getFullYear()` ở render, vd `UpgradeAllClassesButton` dòng `currentYear`), phụ thuộc `window` / `localStorage` / `matchMedia` khi render đầu, `process.env.NEXT_PUBLIC_*` khác nhau server/client. Ghi nguyên nhân vào ledger.

- [ ] **Step 3: Sửa tối thiểu**

Chữ phụ thuộc thời điểm/trình duyệt → tính trong `useEffect` (state khởi tạo trùng server) hoặc theo giờ VN cố định (`vnDateParts`). Không dùng `suppressHydrationWarning` trừ khi giá trị **cố ý** khác (vd đồng hồ), khi đó ghi Ruling.

Run: `pnpm exec playwright test tests/e2e/ae-hydration.spec.ts` + unit test của component đã sửa (nếu có).
Expected: PASS.

- [ ] **Step 4: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add tests/e2e/ae-hydration.spec.ts <file đã sửa>
git commit -m "fix: het loi hydration o trang hoc sinh"
```

Thêm `tests/e2e/ae-hydration.spec.ts` vào cuối `.superpowers/sdd/2026-10-03-y-thu-hoc-phi/half2.txt` (file ngoài git).

---

### Task 7: Chụp lại ảnh hướng dẫn không có chân trang dev

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`, `src/components/admin/AdminSidebar.tsx` (gắn `data-testid="build-info"` cho khối chân trang version)
- Modify: `tests/guide-shots/guide-shots.spec.ts` (`clean()`)
- Regenerate: `public/guide/*.jpg` (48 ảnh), `public/guide/huong-dan-su-dung.docx`
- Test: `tests/unit/components/AppSidebar.test.tsx`, `tests/unit/lib/guide-docx-file.test.ts`

- [ ] **Step 1: Test đỏ**

`AppSidebar.test.tsx`:

```ts
it("khối version có data-testid build-info (script chụp ảnh ẩn nó)", () => {
  // render như test sẵn có
  expect(document.querySelector('[data-testid="build-info"]')).not.toBeNull()
})
```

Run: `pnpm test tests/unit/components/AppSidebar.test.tsx` → FAIL.

- [ ] **Step 2: Sửa**

Gắn `data-testid="build-info"` vào `<div className="px-1 font-mono …">` của `AppSidebar` và `<div className="mt-auto px-1 font-mono …">` của `AdminSidebar`. Trong `clean()`:

```ts
    content: "nextjs-portal, [data-sonner-toaster], [data-testid=\"build-info\"] { visibility: hidden !important; }",
```

(Giữ `display: none` cho 2 selector cũ nếu muốn tách 2 rule; `build-info` dùng `visibility: hidden` để sidebar không đổi chiều cao so với ảnh cũ.)

Run: `pnpm test tests/unit/components/AppSidebar.test.tsx` → PASS.

- [ ] **Step 3: Chụp lại + dựng Word**

(Khoá test; RAM ≥ 3000 MB; cổng 3000 trống.)

```bash
pnpm exec playwright test -c playwright.guide-shots.config.ts
pnpm guide:docx
pnpm test tests/unit/lib/guide-docx-file.test.ts tests/unit/components/GuideShot.test.tsx
```

Expected: script chụp xanh, đủ 48 file; test docx PASS. Mở 2 ảnh bất kỳ (1 desktop có sidebar, 1 mobile) bằng công cụ đọc ảnh để tự kiểm không còn dòng `v0.x.x · …`; ghi tên 2 ảnh đã xem vào ledger.

- [ ] **Step 4: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/layout/AppSidebar.tsx src/components/admin/AdminSidebar.tsx tests/guide-shots/guide-shots.spec.ts tests/unit/components/AppSidebar.test.tsx public/guide
git commit -m "fix: chup lai anh huong dan khong co chan trang dev"
```

---

### Task 8: Phát hành 0.15.1 + chạy toàn bộ

**Files:**
- Modify: `package.json` (`"version": "0.15.1"`), `src/lib/releases.ts`
- Test: `tests/unit/lib/releases.test.ts` (nếu có test canh version khớp package.json thì nó tự canh)

- [ ] **Step 1: RELEASES**

Thêm đầu mảng `RELEASES`:

```ts
  {
    version: "0.15.1",
    date: "2026-10-08",
    title: "Sửa lỗi nhỏ",
    summary: "Sửa một số lỗi nhỏ ở lịch, học phí, hướng dẫn và nút Chỉ cho tôi.",
    notify: false,
    items: [
      { kind: "fix", title: "Lịch", body: "Ô hôm nay luôn đúng theo giờ Việt Nam." },
      { kind: "fix", title: "Học phí", body: "Miễn có lý do giữ nguyên ghi chú cũ và không lưu trùng khi đóng." },
      { kind: "fix", title: "Chỉ cho tôi", body: "Đi bằng phím mũi tên, hộp chi tiết ca cuộn được, không nhảy bước khi bấm nút trong dòng học phí." },
      { kind: "improve", title: "Hướng dẫn", body: "Ảnh hướng dẫn chụp lại theo giao diện mới; tài khoản quản trị mở được Hướng dẫn từ menu." },
    ],
  },
```

`package.json` → `0.15.1`.

- [ ] **Step 2: Full vitest (1 lần)**

Run (khoá test): `pnpm test > .superpowers/sdd/2026-10-08-ae-don-loi-nho/vitest.log 2>&1`; đọc đuôi log.
Expected: toàn bộ PASS (≥ 1645 + test mới).

- [ ] **Step 3: Full e2e 2 nửa (1 lần)**

Seed trước, RAM ≥ 3000 MB, foreground: chạy `half1.txt` rồi `half2.txt` như các plan trước.
Expected: toàn bộ PASS (chấp nhận đúng các test `skip` sẵn có).

- [ ] **Step 4: tsc + lint + commit + báo cáo**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add package.json src/lib/releases.ts
git commit -m "chore: phat hanh 0.15.1"
```

Viết `.superpowers/claude-otd/bao-cao-AE.md` (nhánh, commit, kết quả từng lệnh test, mọi `Ruling:`, nguyên nhân #418 tìm được) → ghi `DONE AE` vào kênh → dừng.
