# D — Cảnh báo trên Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm khối "Cần chú ý" trên Dashboard gồm 3 nhóm: còn nợ tháng trước, lâu không có ca, ca nghỉ chưa xếp bù. Bấm dòng nợ thì sang màn Học phí với sheet chi tiết của đúng HS mở sẵn.

**Architecture:** Backend thêm `getCancelledWithoutMakeup` (session.service), `getDashboardAlerts(db, userId, now)` (report.service, chỉ đọc, dùng lại `getMonthlyTuitionStatus(..., false)`) và procedure `report.alerts`. Frontend thêm `src/components/dashboard/DashboardAlerts.tsx` đặt giữa các thẻ số liệu và `TodaySessions`. Màn Học phí thêm 1 `useEffect` mở sheet khi URL có `studentId`.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11 (không transformer: `Date` về client thành chuỗi), Prisma, Tailwind 3.4, shadcn/ui, lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-d-canh-bao-dashboard-design.md`

> Plan này nằm ở nhánh `docs/plans-b-g` cho tới khi được merge. Nếu không thấy file trên nhánh đang làm: `git show docs/plans-b-g:docs/superpowers/plans/2026-09-25-d-canh-bao-dashboard.md`.

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh DB đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` KHÁC `.env.test`. `.env` = PRODUCTION (host ep-polished-voice), `.env.test` = test (host ep-jolly-dew). Test chỉ chạy qua `pnpm test ...` (tự nạp .env.test qua `tests/env-setup.ts`).
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push --force-reset`, `pnpm build` (chạy migrate deploy lên prod), `pnpm dev` (dùng DB prod). Build kiểm tra bằng `pnpm exec next build`.
- Phần D **không có migration, không đổi schema Prisma**, không thêm dependency. (Nếu sau này cần migration: tạo bằng `prisma migrate dev --create-only` với URL của `.env.test`, không bao giờ áp lên prod thủ công; prod tự chạy `prisma migrate deploy` khi Vercel build sau merge.)
- Chạy test 1 file: `pnpm test <đường-dẫn>`. Không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ mất ~10–15 phút.
- E2E: cổng 3000 có thể bị project khác chiếm → dùng config tạm git-ignored `.superpowers/pw-3100.config.ts` (Task 5), cổng 3100, url kiểm tra `http://127.0.0.1:3100/login`, `reuseExistingServer: true`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. ResponsiveList render cả bảng lẫn thẻ → lọc phần tử visible hoặc dùng test id.
- i18n: `src/language/vi.json` và `en.json` phải cùng bộ key (hiện 306 key mỗi file; sau D là 315).
- Ghi chú code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc.
- Giữ nhận diện A1: indigo/slate, lucide-react, shadcn/ui, `rounded-lg`. Vùng chạm ≥44px trên mobile (`min-h-11`, `h-11`). Viewport mobile 390×844, breakpoint `md`.
- Service nhận tham số `now: Date = new Date()` để test cố định ngày; ngày/tháng tính bằng `vnDateParts(now)` (`src/lib/utils.ts`).
- Mỗi task kết thúc bằng: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit trên nhánh `feat/d-dashboard-alerts` (không commit lên main). **Agent thực hiện task KHÔNG merge, KHÔNG push** — người điều phối làm sau review cuối.
- Commit kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Không nhập mật khẩu/credential thật vào trình duyệt; không thao tác ghi trên tài khoản production.
- **Phụ thuộc B (lịch sử thu tiền):** spec D mục 4 S1 nói D không cần B. Nhưng nếu lúc thực hiện B **đã merge vào main** (có `model Payment` trong `prisma/schema.prisma`), thì `tuition.updatePayment` đã bị xoá, `TuitionDetailSheet` đã viết lại, `src/app/(app)/tuition/page.tsx` có thể đã đổi. Các task đụng tới học phí (Task 2, Task 4, Task 5) có ghi rõ chỗ phải **đối chiếu code thật**; lệch với plan thì theo code thật và ghi lại trong commit message.

## Điều chỉnh so với spec

1. `getCancelledWithoutMakeup` include thêm `_count`, `makeupSessions`, `makeupOf` (select `id`, `sessionDate`) và sắp `sessionStudents` theo tên, giống `getSessionDetail`, để `toDTO` trả DTO đầy đủ như các chỗ khác. Kết quả lọc không đổi.
2. Không tách unit test cho hàm đếm tháng (S3): hàm `countDebtMonths` để private trong `report.service.ts`, được phủ bởi integration test (3, 1, 12 tháng; gặp tháng tất toán thì dừng).
3. Test integration không gọi `tuition.updatePayment` để đặt tiền đã thu mà ghi thẳng `paidAmount`/`isFullPaid` vào snapshot `MonthlyTuition` (sau khi gọi `tuition.getMonthlyStatus` để snapshot có số đúng). Lý do: B sẽ xoá `updatePayment`; `paidAmount` vẫn là cột B giữ nguyên nghĩa (spec B mục 11), nên test chạy được cả trước lẫn sau B.
4. Dialog chi tiết ca (`SessionDetailDialog`, `SessionFormDialog`) render **ngoài** phần khối cảnh báo, để khi Khôi phục ca cuối cùng làm cả khối biến mất thì dialog không bị unmount giữa chừng.
5. E2E tạo dữ liệu qua HTTP tRPC (`page.request` dùng cookie đăng nhập, gọi dev server đang trỏ DB test) thay vì click UI hay import Prisma trong file e2e. Import Prisma trong e2e có nguy cơ nạp `.env` production nếu env chưa được ghim.

## Review Focus

1. **Khôi phục / xoá ca từ dialog làm cả 3 nhóm rỗng** → khối biến mất nhưng dialog/toast không bị cắt ngang, không lỗi console. Pin: cấu trúc render ở Task 3 (dialog ngoài `section`); kiểm tra tay ở Task 6.
2. **Server chạy UTC, giáo viên mở Dashboard 00:00–07:00 giờ VN** → cửa sổ 14/7/60 ngày và tháng hiện tại tính theo ngày VN. Pin: integration Task 2 (`now = 2026-09-24T18:00:00Z` và `2026-09-24T16:00:00Z`).
3. **Tên HS rất dài, ca nghỉ có nhiều HS** → dòng `truncate`, số tiền không xuống dòng, không tràn ngang 390px. Pin: e2e Task 5 dùng tên dài + `expectNoHorizontalScroll`.
4. **Đóng sheet Học phí sau khi mở từ link** → sheet không tự mở lại. Pin: e2e Task 5 bấm Escape rồi kiểm tra dialog biến mất và vẫn biến mất sau khi query refetch.
5. **HS trùng tên / HS nợ không nằm trong 3 dòng đầu** → link mở đúng HS theo `studentId`; "Xem tất cả" hiện đủ. Pin: Task 4 tra `studentId` (không theo tên); e2e Task 5 mở rộng nhóm trước khi tìm dòng.

---

## File Structure

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `src/server/services/session.service.ts` | Sửa | Thêm `getCancelledWithoutMakeup` (Task 1) |
| `src/server/services/report.service.ts` | Sửa | Thêm `getDashboardAlerts`, type `DashboardAlerts`, helper private `countDebtMonths` (Task 2) |
| `src/server/trpc/routers/report.ts` | Sửa | Procedure `alerts` (Task 2) |
| `tests/integration/dashboard-alerts.test.ts` | Mới (Task 1), sửa (Task 2) | Integration |
| `src/language/vi.json`, `en.json` | Sửa | 9 key mới (Task 3) |
| `src/components/dashboard/DashboardAlerts.tsx` | Mới | Khối "Cần chú ý" (Task 3) |
| `src/app/(app)/dashboard/page.tsx` | Sửa | Gắn `<DashboardAlerts />` (Task 3) |
| `src/app/(app)/tuition/page.tsx` | Sửa | Mở sẵn sheet theo `studentId` trên URL (Task 4) |
| `tests/e2e/dashboard-alerts.spec.ts` | Mới | E2E 390px (Task 5) |
| `.superpowers/pw-3100.config.ts` | Mới, git-ignored, xoá sau khi dùng | Config e2e cổng 3100 (Task 5) |

---

### Task 0: Tạo nhánh, kiểm tra DB test và trạng thái B

**Đọc trước:** Global Constraints ở trên; `docs/coding-rule.md` §6.1.

- [ ] **Step 1: Tạo nhánh từ main mới nhất**

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/d-dashboard-alerts
```
Nếu nhánh `feat/d-dashboard-alerts` đã có: `git checkout feat/d-dashboard-alerts` và dừng bước này.

- [ ] **Step 2: Xác nhận DB test khác production**

Run (Git Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: 2 host khác nhau (`env` chứa `ep-polished-voice`, `test` chứa `ep-jolly-dew`). Nếu giống → DỪNG, báo người dùng.

- [ ] **Step 3: Kiểm tra spec D có trên nhánh và B đã merge chưa**

Run:
```bash
ls docs/superpowers/specs/2026-09-25-d-canh-bao-dashboard-design.md
grep -n "^model Payment" prisma/schema.prisma || echo "B CHUA MERGE"
grep -n "updatePayment\|updateSettlement" src/server/trpc/routers/tuition.ts
```
Expected: spec tồn tại. Ghi lại kết quả cho các task sau:
- `B CHUA MERGE` + router còn `updatePayment` → làm đúng plan.
- Có `model Payment` → B đã merge: Task 2 (helper `setPaid`), Task 4, Task 5 phải đối chiếu code thật như ghi ở từng task. D vẫn làm được, không DỪNG.

Không commit ở task này.

---

### Task 1: `getCancelledWithoutMakeup` — ca huỷ chưa có ca bù

**Đọc trước:** spec mục 1 (ý "Ca huỷ"), mục 4 S7, mục 7.1. Code: `src/server/services/session.service.ts` (type `SessionWithSubjectAndStudents` dòng ~69, `toDTO` dòng ~88, `getSessionDetail`, `createMakeupSession`, `restoreSession`, `deleteSession`); mẫu test `tests/integration/tuition-readonly-no-write.test.ts`, `tests/integration/makeup-session.test.ts`.

**Files:**
- Modify: `src/server/services/session.service.ts` (thêm hàm ngay trước dòng `export { parseTimeToDate }` ở cuối file)
- Create: `tests/integration/dashboard-alerts.test.ts`

**Interfaces:**
- Consumes: `toDTO`, `SessionWithSubjectAndStudents` (private, cùng file); router có sẵn `session.create`, `session.addStudents`, `session.createMakeup({ id, sessionDate, startTime, endTime, cancelReason? })`, `session.delete({ id })`, `session.restore({ id })`, `attendance.update({ sessionId, attendances: [{ studentId, attendance, fee }] })`.
- Produces:
  - `export async function getCancelledWithoutMakeup(db: PrismaClient, userId: number, params: { from: Date }): Promise<SessionDTO[]>` — ca `status = "cancelled"`, `sessionDate >= from`, không có ca bù; sắp `sessionDate`, `startTime` tăng dần; `students` có `fullName`.
  - Trong `tests/integration/dashboard-alerts.test.ts`: các helper `cleanup()`, `userIdOf(username)`, `addSession(caller, opts)`, `cancelDirect(id)` và type `Caller` — Task 2 dùng lại.

- [ ] **Step 1: Viết test fail**

Tạo `tests/integration/dashboard-alerts.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { getCancelledWithoutMakeup } from "@/server/services/session.service"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

async function userIdOf(username: string) {
  return (await db.user.findUniqueOrThrow({ where: { username } })).id
}

// Tạo ca; nếu có presentFee thì điểm danh "có mặt" cho mọi HS với học phí đó.
async function addSession(
  caller: Caller,
  opts: { date: string; start?: string; end?: string; studentIds?: number[]; presentFee?: number }
) {
  const subjectId = (await caller.subject.list({}))[0].id
  const s = await caller.session.create({
    sessionDate: opts.date,
    startTime: opts.start ?? "08:00",
    endTime: opts.end ?? "09:00",
    subjectId,
  })
  if (opts.studentIds?.length) {
    await caller.session.addStudents({ sessionId: s.id, studentIds: opts.studentIds })
    if (opts.presentFee !== undefined) {
      const fee = opts.presentFee
      await caller.attendance.update({
        sessionId: s.id,
        attendances: opts.studentIds.map((studentId) => ({
          studentId,
          attendance: ATTENDANCE_STATUS.PRESENT,
          fee,
        })),
      })
    }
  }
  return s
}

// Huỷ trực tiếp (không tạo ca bù) — mô phỏng dữ liệu cũ.
async function cancelDirect(id: number) {
  await db.teachingSession.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date() },
  })
}

describe("getCancelledWithoutMakeup", () => {
  const from = new Date(Date.UTC(2026, 6, 27)) // 27/07/2026

  beforeEach(async () => {
    await cleanup()
  })

  it("ca bù bị xoá → ca gốc hiện; còn ca bù → không; khôi phục → biến mất", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Ca Nghỉ", grade: 4 })
    const orig = await addSession(caller, { date: "2026-09-15", studentIds: [st.id] })
    const { makeup } = await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-09-18", startTime: "08:00", endTime: "09:00",
    })

    const withMakeup = await getCancelledWithoutMakeup(db, userId, { from })
    expect(withMakeup.map((s) => s.id)).not.toContain(orig.id)

    await caller.session.delete({ id: makeup.id })
    const list = await getCancelledWithoutMakeup(db, userId, { from })
    expect(list.map((s) => s.id)).toEqual([orig.id])
    expect(list[0].status).toBe("cancelled")
    expect(list[0].students.map((x) => x.fullName)).toEqual(["HS Ca Nghỉ"])
    expect(list[0].makeupInfo).toBeNull()

    await caller.session.restore({ id: orig.id })
    expect(await getCancelledWithoutMakeup(db, userId, { from })).toEqual([])
  })

  it("lọc theo from (gồm mốc), gồm ca tương lai, bỏ ca chưa huỷ, sắp theo ngày rồi giờ", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const tooOld = await addSession(caller, { date: "2026-07-26" })
    const onEdge = await addSession(caller, { date: "2026-07-27" })
    const futureLate = await addSession(caller, { date: "2026-10-10", start: "10:00", end: "11:00" })
    const futureEarly = await addSession(caller, { date: "2026-10-10", start: "08:00", end: "09:00" })
    await addSession(caller, { date: "2026-09-20" }) // chưa huỷ
    for (const s of [tooOld, onEdge, futureLate, futureEarly]) await cancelDirect(s.id)

    const list = await getCancelledWithoutMakeup(db, userId, { from })
    expect(list.map((s) => s.id)).toEqual([onEdge.id, futureEarly.id, futureLate.id])
  })

  it("không lấy ca của giáo viên khác", async () => {
    const caller2 = await getAuthedCaller("teacher2")
    const other = await addSession(caller2, { date: "2026-09-20" })
    await cancelDirect(other.id)

    expect(await getCancelledWithoutMakeup(db, await userIdOf("teacher"), { from })).toEqual([])
    const own = await getCancelledWithoutMakeup(db, await userIdOf("teacher2"), { from })
    expect(own.map((s) => s.id)).toEqual([other.id])
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/dashboard-alerts.test.ts`
Expected: FAIL cả 3 test với `TypeError: ... getCancelledWithoutMakeup is not a function` (hàm chưa tồn tại).

- [ ] **Step 3: Cài đặt**

Trong `src/server/services/session.service.ts`, thêm ngay trước `export { parseTimeToDate }`:

```ts
// Ca huỷ không có ca bù: chỉ xảy ra khi ca bù bị xoá (luồng huỷ luôn tạo ca bù) hoặc dữ liệu cũ.
export async function getCancelledWithoutMakeup(
  db: PrismaClient,
  userId: number,
  params: { from: Date }
): Promise<SessionDTO[]> {
  const sessions = await db.teachingSession.findMany({
    where: {
      userId,
      status: "cancelled",
      sessionDate: { gte: params.from },
      makeupSessions: { none: {} },
    },
    include: {
      subject: true,
      sessionStudents: {
        include: { student: true },
        orderBy: { student: { fullName: "asc" } },
      },
      _count: { select: { sessionStudents: true } },
      makeupSessions: { select: { id: true, sessionDate: true } },
      makeupOf: { select: { id: true, sessionDate: true } },
    },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  })

  return sessions.map((s) => toDTO(s as SessionWithSubjectAndStudents))
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/dashboard-alerts.test.ts`
Expected: PASS 3/3.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/session.service.ts tests/integration/dashboard-alerts.test.ts
git commit -m "feat(session): getCancelledWithoutMakeup cho cảnh báo ca nghỉ chưa bù

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: `getDashboardAlerts` + procedure `report.alerts`

**Đọc trước:** spec mục 2, 4 (S2–S7, S9, S12), 7.2, 7.3, 9 (Integration), 10 (R1, R6). Code: `src/server/services/report.service.ts` (`getDashboardStats` — mẫu dùng `vnDateParts`), `src/server/services/tuition.service.ts` (`calcStudentTuition`, `getMonthlyTuitionStatus`, `getMonthlyOutstanding`), `src/server/trpc/routers/report.ts`, `tests/integration/dashboard-alerts.test.ts` (helper từ Task 1).

**Nếu B đã merge (Task 0 Step 3):** đọc `getMonthlyTuitionStatus` hiện tại — nếu `paidAmount` của item vẫn lấy từ `snapshot.paidAmount` thì giữ helper `setPaid` như dưới. Nếu B tính `paidAmount` từ bảng `Payment` khi đọc, sửa `setPaid` để tạo payment qua router của B (`payment.create`) và đặt `isFullPaid` qua `tuition.updateSettlement`; giữ nguyên mọi `expect`. Ghi lại trong commit message.

**Files:**
- Modify: `src/server/services/report.service.ts`
- Modify: `src/server/trpc/routers/report.ts`
- Modify: `tests/integration/dashboard-alerts.test.ts`

**Interfaces:**
- Consumes: `getCancelledWithoutMakeup(db, userId, { from: Date }): Promise<SessionDTO[]>` (Task 1); `getMonthlyTuitionStatus(db, userId, filter, persist=false)` trả `{ items: TuitionStatusDTO[] }` với `studentId, fullName, grade, paidAmount, isFullPaid, previousBalance, totalAmountDue`; `vnDateParts(now)`.
- Produces:
  ```ts
  export type DashboardAlerts = {
    year: number
    month: number
    debts: { studentId: number; fullName: string; grade: number; amount: number; months: number }[]
    idleStudents: { studentId: number; fullName: string; grade: number }[]
    unrescheduled: SessionDTO[]
  }
  export async function getDashboardAlerts(db: PrismaClient, userId: number, now?: Date): Promise<DashboardAlerts>
  ```
  - `months`: 1..12; bằng 12 nghĩa là "12 tháng trở lên" (client hiện "12+").
  - Procedure `report.alerts` (query, không input) → `DashboardAlerts`. Client nhận `sessionDate`/`cancelledAt` dạng chuỗi.

- [ ] **Step 1: Viết test fail**

Trong `tests/integration/dashboard-alerts.test.ts`, thêm import:

```ts
import { getDashboardAlerts } from "@/server/services/report.service"
```

Thêm helper ngay dưới `cancelDirect`:

```ts
const NOW = new Date("2026-09-25T03:00:00Z") // 10:00 25/09/2026 giờ VN

// Mở trang Học phí tháng đó (ghi snapshot đúng số) rồi đặt tiền đã thu thẳng vào snapshot.
async function setPaid(
  caller: Caller,
  studentId: number,
  month: number,
  paidAmount: number,
  isFullPaid: boolean
) {
  await caller.tuition.getMonthlyStatus({ year: 2026, month, studentId, limit: 1 })
  await db.monthlyTuition.update({
    where: { studentId_year_month: { studentId, year: 2026, month } },
    data: { paidAmount, isFullPaid },
  })
}

async function snapshot(
  studentId: number,
  year: number,
  month: number,
  totalAmountDue: number,
  opts: { paidAmount?: number; isFullPaid?: boolean } = {}
) {
  await db.monthlyTuition.create({
    data: {
      studentId, year, month, totalAmountDue,
      paidAmount: opts.paidAmount ?? 0,
      isFullPaid: opts.isFullPaid ?? false,
    },
  })
}
```

Thêm các `describe` cuối file:

```ts
describe("getDashboardAlerts — còn nợ tháng trước", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("số tiền khớp cột Dư nợ tháng trước của màn Học phí khi tháng này chưa thu", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Nợ", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })

    const alerts = await getDashboardAlerts(db, userId, NOW)
    const page = await caller.tuition.getMonthlyStatus({ year: 2026, month: 9, studentId: st.id, limit: 1 })

    expect(alerts.year).toBe(2026)
    expect(alerts.month).toBe(9)
    expect(page.items[0].previousBalance).toBe(100000)
    expect(alerts.debts).toEqual([
      { studentId: st.id, fullName: "HS Nợ", grade: 6, amount: page.items[0].previousBalance, months: 1 },
    ])
  })

  it("thu 1 phần tháng này → trừ vào nợ cũ trước; thu đủ → hết cảnh báo", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Thu Dần", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    await addSession(caller, { date: "2026-09-20", studentIds: [st.id], presentFee: 100000 })

    // Tổng phải đóng tháng 9 = 100000 nợ cũ + 100000 tháng này.
    await setPaid(caller, st.id, 9, 150000, false)
    const partial = await getDashboardAlerts(db, userId, NOW)
    expect(partial.debts.map((d) => d.amount)).toEqual([50000]) // min(100000, 200000 - 150000)

    await setPaid(caller, st.id, 9, 200000, false)
    expect((await getDashboardAlerts(db, userId, NOW)).debts).toEqual([])
  })

  it("tháng trước đã tất toán (isFullPaid) dù còn thiếu → không mang nợ sang, không cảnh báo", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Miễn Giảm", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await setPaid(caller, st.id, 8, 50000, true)

    expect((await getDashboardAlerts(db, userId, NOW)).debts).toEqual([])
  })

  it("tháng này đã tất toán → không cảnh báo", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Tất Toán", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    await setPaid(caller, st.id, 9, 0, true)

    expect((await getDashboardAlerts(db, userId, NOW)).debts).toEqual([])
  })

  it("nợ liên tiếp 6, 7, 8 → 3 tháng; sắp theo số tiền giảm dần", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const a = await caller.student.create({ fullName: "HS Nợ Dài", grade: 6 })
    const b = await caller.student.create({ fullName: "HS Nợ Ngắn", grade: 2 })
    await snapshot(a.id, 2026, 6, 100000)
    await snapshot(a.id, 2026, 7, 200000)
    await snapshot(a.id, 2026, 8, 300000)
    await snapshot(b.id, 2026, 8, 100000)

    const { debts } = await getDashboardAlerts(db, userId, NOW)
    expect(debts).toEqual([
      { studentId: a.id, fullName: "HS Nợ Dài", grade: 6, amount: 300000, months: 3 },
      { studentId: b.id, fullName: "HS Nợ Ngắn", grade: 2, amount: 100000, months: 1 },
    ])
  })

  it("tháng 7 đã tất toán → đếm dừng, còn 1 tháng", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Ngắt Quãng", grade: 6 })
    await snapshot(st.id, 2026, 6, 100000)
    await snapshot(st.id, 2026, 7, 200000, { isFullPaid: true })
    await snapshot(st.id, 2026, 8, 100000)

    const { debts } = await getDashboardAlerts(db, userId, NOW)
    expect(debts.map((d) => [d.amount, d.months])).toEqual([[100000, 1]])
  })

  it("nợ đủ 12 tháng trước → months = 12 (client hiện 12+)", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Nợ Lâu", grade: 6 })
    for (let i = 0; i < 12; i++) {
      const m = 9 + i // 2025-09 .. 2026-08
      await snapshot(st.id, m > 12 ? 2026 : 2025, m > 12 ? m - 12 : m, 100000)
    }

    const { debts } = await getDashboardAlerts(db, userId, NOW)
    expect(debts.map((d) => d.months)).toEqual([12])
  })

  it("HS đã nghỉ (isActive=false) còn nợ và không có ca → không xuất hiện ở nhóm nào", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Đã Nghỉ", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: st.id, limit: 1 })
    // Có ca tháng 9 → vẫn nằm trong danh sách màn Học phí, phải bị lọc bởi isActive.
    await addSession(caller, { date: "2026-09-02", studentIds: [st.id], presentFee: 100000 })
    await db.student.update({ where: { id: st.id }, data: { isActive: false } })

    const alerts = await getDashboardAlerts(db, userId, NOW)
    expect(alerts.debts).toEqual([])
    expect(alerts.idleStudents).toEqual([])
  })
})

describe("getDashboardAlerts — lâu không có ca", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("cửa sổ từ hôm nay −14 đến +7 ngày (gồm 2 đầu), bỏ ca huỷ, sắp theo lớp rồi tên", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const a = await caller.student.create({ fullName: "HS A", grade: 1 })
    const b = await caller.student.create({ fullName: "HS B", grade: 1 })
    const c = await caller.student.create({ fullName: "HS C", grade: 1 })
    const d = await caller.student.create({ fullName: "HS D", grade: 2 })
    const e = await caller.student.create({ fullName: "HS E", grade: 3 })
    const f = await caller.student.create({ fullName: "HS F", grade: 3 })
    await addSession(caller, { date: "2026-09-11", studentIds: [a.id] }) // đúng −14 → có ca
    await addSession(caller, { date: "2026-09-10", studentIds: [b.id] }) // −15 → ngoài cửa sổ
    await addSession(caller, { date: "2026-10-02", studentIds: [c.id] }) // đúng +7 → có ca
    const dSession = await addSession(caller, { date: "2026-09-20", studentIds: [d.id] })
    await cancelDirect(dSession.id) // chỉ có ca huỷ → vẫn cảnh báo
    await addSession(caller, { date: "2026-10-03", studentIds: [e.id] }) // +8 → ngoài cửa sổ
    // f: chưa có ca nào → cảnh báo

    const { idleStudents } = await getDashboardAlerts(db, userId, NOW)
    expect(idleStudents).toEqual([
      { studentId: b.id, fullName: "HS B", grade: 1 },
      { studentId: d.id, fullName: "HS D", grade: 2 },
      { studentId: e.id, fullName: "HS E", grade: 3 },
      { studentId: f.id, fullName: "HS F", grade: 3 },
    ])
  })

  it("tính theo ngày VN: 01:00 25/09 VN cho cùng kết quả; 23:00 24/09 VN thì cửa sổ lùi 1 ngày", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const a = await caller.student.create({ fullName: "HS A", grade: 1 })
    const b = await caller.student.create({ fullName: "HS B", grade: 1 })
    await addSession(caller, { date: "2026-09-11", studentIds: [a.id] })
    await addSession(caller, { date: "2026-09-10", studentIds: [b.id] })

    const base = await getDashboardAlerts(db, userId, NOW)
    const earlyMorningVN = await getDashboardAlerts(db, userId, new Date("2026-09-24T18:00:00Z"))
    expect(earlyMorningVN).toEqual(base)
    expect(base.idleStudents.map((s) => s.studentId)).toEqual([b.id])

    // 16:00Z 24/09 = 23:00 24/09 VN → −14 là 10/09 → HS B có ca trong cửa sổ.
    const lateEveningVN = await getDashboardAlerts(db, userId, new Date("2026-09-24T16:00:00Z"))
    expect(lateEveningVN.idleStudents).toEqual([])
  })
})

describe("getDashboardAlerts — ca nghỉ chưa xếp bù", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("chỉ lấy ca huỷ từ hôm nay −60 ngày (27/07) trở đi", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const old = await addSession(caller, { date: "2026-07-26" }) // −61
    const edge = await addSession(caller, { date: "2026-07-27" }) // −60
    await cancelDirect(old.id)
    await cancelDirect(edge.id)

    const { unrescheduled } = await getDashboardAlerts(db, userId, NOW)
    expect(unrescheduled.map((s) => s.id)).toEqual([edge.id])
  })
})

describe("getDashboardAlerts — an toàn", () => {
  beforeEach(async () => {
    await cleanup()
  })

  it("không ghi DB: số dòng MonthlyTuition trước/sau bằng nhau", async () => {
    const caller = await getAuthedCaller()
    const userId = await userIdOf("teacher")
    const st = await caller.student.create({ fullName: "HS Chỉ Đọc", grade: 6, tuitionFee: 100000 })
    await addSession(caller, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    await addSession(caller, { date: "2026-09-20", studentIds: [st.id], presentFee: 100000 })

    const before = await db.monthlyTuition.count()
    const alerts = await getDashboardAlerts(db, userId, NOW)
    expect(await db.monthlyTuition.count()).toBe(before)
    expect(before).toBe(0)
    // Chưa có snapshot nào → nợ lấy từ lịch sử, vẫn phải hiện.
    expect(alerts.debts.map((d) => [d.studentId, d.amount, d.months])).toEqual([[st.id, 100000, 1]])
  })

  it("đa người dùng: dữ liệu của giáo viên khác không xuất hiện", async () => {
    const caller2 = await getAuthedCaller("teacher2")
    const st = await caller2.student.create({ fullName: "HS Của GV2", grade: 5, tuitionFee: 100000 })
    await addSession(caller2, { date: "2026-08-10", studentIds: [st.id], presentFee: 100000 })
    const cancelled = await addSession(caller2, { date: "2026-09-20", start: "10:00", end: "11:00" })
    await cancelDirect(cancelled.id)

    const mine = await getDashboardAlerts(db, await userIdOf("teacher"), NOW)
    expect(mine.debts).toEqual([])
    expect(mine.idleStudents).toEqual([])
    expect(mine.unrescheduled).toEqual([])

    const theirs = await getDashboardAlerts(db, await userIdOf("teacher2"), NOW)
    expect(theirs.debts.map((d) => d.studentId)).toEqual([st.id])
    expect(theirs.idleStudents.map((s) => s.studentId)).toEqual([st.id])
    expect(theirs.unrescheduled.map((s) => s.id)).toEqual([cancelled.id])
  })

  it("router report.alerts trả đúng shape", async () => {
    const caller = await getAuthedCaller()
    const res = await caller.report.alerts()
    expect(Object.keys(res).sort()).toEqual(["debts", "idleStudents", "month", "unrescheduled", "year"])
    expect(typeof res.year).toBe("number")
    expect(res.month).toBeGreaterThanOrEqual(1)
    expect(res.month).toBeLessThanOrEqual(12)
    expect(Array.isArray(res.debts)).toBe(true)
    expect(Array.isArray(res.idleStudents)).toBe(true)
    expect(Array.isArray(res.unrescheduled)).toBe(true)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/dashboard-alerts.test.ts`
Expected: 3 test của Task 1 vẫn PASS; các test mới FAIL với `TypeError: ... getDashboardAlerts is not a function`, test router FAIL vì `caller.report.alerts` không tồn tại.

- [ ] **Step 3: Cài đặt service**

Trong `src/server/services/report.service.ts`, sửa import đầu file:

```ts
import { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { calcAttendanceRate, getLevel, vnDateParts } from "@/lib/utils"
import type { SessionDTO } from "@/lib/types/models"
import { assertOwnership } from "./_base.service"
import { getCancelledWithoutMakeup, getMonthSessions } from "./session.service"
import { getMonthlyOutstanding, getMonthlyTuitionStatus } from "./tuition.service"
```

Thêm cuối file:

```ts
export type DashboardAlerts = {
  year: number
  month: number
  debts: { studentId: number; fullName: string; grade: number; amount: number; months: number }[]
  idleStudents: { studentId: number; fullName: string; grade: number }[]
  unrescheduled: SessionDTO[]
}

const DEBT_LOOKBACK_MONTHS = 12

// Đếm lùi từ tháng trước các tháng liên tiếp còn nợ theo snapshot đã lưu.
// Chỉ để tham khảo: snapshot cũ có thể chưa tính lại sau khi sửa điểm danh (spec R1).
async function countDebtMonths(
  db: PrismaClient,
  studentIds: number[],
  year: number,
  month: number
): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  if (studentIds.length === 0) return result

  const rows = await db.monthlyTuition.findMany({
    where: {
      studentId: { in: studentIds },
      OR: [{ year: year - 1, month: { gte: month } }, { year, month: { lt: month } }],
    },
    select: { studentId: true, year: true, month: true, totalAmountDue: true, paidAmount: true, isFullPaid: true },
  })
  const owing = new Set(
    rows
      .filter((r) => !r.isFullPaid && r.totalAmountDue - r.paidAmount > 0)
      .map((r) => `${r.studentId}-${r.year}-${r.month}`)
  )

  for (const id of studentIds) {
    let count = 0
    let y = year
    let m = month
    while (count < DEBT_LOOKBACK_MONTHS) {
      m -= 1
      if (m === 0) {
        m = 12
        y -= 1
      }
      if (!owing.has(`${id}-${y}-${m}`)) break
      count++
    }
    result.set(id, Math.max(1, count))
  }
  return result
}

export async function getDashboardAlerts(
  db: PrismaClient,
  userId: number,
  now: Date = new Date()
): Promise<DashboardAlerts> {
  const { year, month, day } = vnDateParts(now)
  // sessionDate là @db.Date lưu nửa đêm UTC; Date.UTC tự tràn tháng khi cộng/trừ ngày.
  const dayOffset = (n: number) => new Date(Date.UTC(year, month - 1, day + n))
  const idleFrom = dayOffset(-14)
  const idleTo = dayOffset(7)
  const cancelFrom = dayOffset(-60)

  const [tuition, activeStudents, idle, unrescheduled] = await Promise.all([
    // Cùng tham số với getMonthlyOutstanding để số nợ khớp màn Học phí; persist=false: không ghi DB.
    getMonthlyTuitionStatus(db, userId, { year, month, status: "all", page: 1, limit: 1_000_000 }, false),
    db.student.findMany({ where: { userId, isActive: true }, select: { id: true } }),
    db.student.findMany({
      where: {
        userId,
        isActive: true,
        sessionStudents: {
          none: {
            session: {
              userId,
              status: { not: "cancelled" },
              sessionDate: { gte: idleFrom, lte: idleTo },
            },
          },
        },
      },
      select: { id: true, fullName: true, grade: true },
      orderBy: [{ grade: "asc" }, { fullName: "asc" }],
    }),
    getCancelledWithoutMakeup(db, userId, { from: cancelFrom }),
  ])

  const activeIds = new Set(activeStudents.map((s) => s.id))
  // Tiền thu tháng này trừ vào nợ cũ trước; tháng này đã tất toán thì coi như hết nợ (spec S2).
  const debtors = tuition.items
    .filter((it) => activeIds.has(it.studentId) && it.previousBalance > 0 && !it.isFullPaid)
    .map((it) => ({
      studentId: it.studentId,
      fullName: it.fullName,
      grade: it.grade,
      amount: Math.min(it.previousBalance, it.totalAmountDue - it.paidAmount),
    }))
    .filter((d) => d.amount > 0)

  const monthsById = await countDebtMonths(db, debtors.map((d) => d.studentId), year, month)
  const debts = debtors
    .map((d) => ({ ...d, months: monthsById.get(d.studentId) ?? 1 }))
    .sort((a, b) => b.amount - a.amount)

  return {
    year,
    month,
    debts,
    idleStudents: idle.map((s) => ({ studentId: s.id, fullName: s.fullName, grade: s.grade })),
    unrescheduled,
  }
}
```

- [ ] **Step 4: Thêm procedure**

Trong `src/server/trpc/routers/report.ts`, thêm `getDashboardAlerts` vào import từ `@/server/services/report.service` (giữ thứ tự chữ cái: `getDashboardAlerts, getDashboardStats, getMonthlySummary, getStudentReport`) và thêm sau `dashboard`:

```ts
  alerts: protectedProcedure
    .query(({ ctx }) => getDashboardAlerts(ctx.db, ctx.userId)),
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/dashboard-alerts.test.ts`
Expected: PASS toàn bộ (3 test Task 1 + 14 test mới).

- [ ] **Step 6: Chạy lại các test học phí/báo cáo liên quan (không đổi hành vi cũ)**

Run: `pnpm test tests/integration/report.test.ts tests/integration/tuition-readonly-no-write.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/report.service.ts src/server/trpc/routers/report.ts tests/integration/dashboard-alerts.test.ts
git commit -m "feat(report): report.alerts — nợ tháng trước, lâu không có ca, ca nghỉ chưa bù

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Component `DashboardAlerts` + i18n + gắn vào Dashboard

**Đọc trước:** spec mục 2 (tiêu chí UI), 4 (S10–S12), 6.1, 6.2, 8. Code: `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/TodaySessions.tsx` (mẫu mở `SessionDetailDialog` + `SessionFormDialog`, và cách đổi `sessionDate` chuỗi → `Date`), `src/components/sessions/SessionDetailDialog.tsx` (props `open, onOpenChange, session: SessionListDTO, onEdit`), `src/lib/utils.ts` (`formatCurrency`, `formatDate`, `formatDayOfWeek`), `src/components/ui/card.tsx`, `badge.tsx`, `skeleton.tsx`.

**Files:**
- Modify: `src/language/vi.json`, `src/language/en.json`
- Create: `src/components/dashboard/DashboardAlerts.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `trpc.report.alerts.useQuery()` → `RouterOutputs["report"]["alerts"]` = `{ year, month, debts[], idleStudents[], unrescheduled: SessionDTO[] (sessionDate là chuỗi) }` (Task 2). Key i18n sẵn có: `grade` ("Lớp"), `show_less_stats` ("Thu gọn").
- Produces: `export function DashboardAlerts(): JSX.Element` (không props). Test id cho e2e (Task 5): mỗi nhóm `data-testid="alert-group-debt" | "alert-group-idle" | "alert-group-unrescheduled"`; mỗi dòng `data-testid="alert-row"`. Link dòng nợ: `/tuition?year=Y&month=M&studentName=<fullName>&studentId=<id>`.

- [ ] **Step 1: Thêm 9 key i18n**

`src/language/vi.json`: thêm dấu phẩy sau dòng cuối `"hidden_suffix": "(đã ẩn)"` rồi thêm:

```json
  "alerts_title": "Cần chú ý",
  "alert_debt_title": "Còn nợ tháng trước",
  "alert_debt_desc": "Học sinh đang học còn nợ học phí cũ",
  "alert_debt_months": "Nợ {n} tháng",
  "alert_idle_title": "Lâu không có ca",
  "alert_idle_desc": "Không có ca trong 14 ngày qua và 7 ngày tới",
  "alert_unrescheduled_title": "Ca nghỉ chưa xếp bù",
  "alert_unrescheduled_desc": "Ca huỷ trong 60 ngày gần đây chưa có ca bù",
  "alert_view_all": "Xem tất cả ({n})"
```

`src/language/en.json`: thêm dấu phẩy sau `"hidden_suffix": "(hidden)"` rồi thêm:

```json
  "alerts_title": "Needs attention",
  "alert_debt_title": "Unpaid from previous months",
  "alert_debt_desc": "Active students with earlier unpaid tuition",
  "alert_debt_months": "{n} month(s) overdue",
  "alert_idle_title": "No recent sessions",
  "alert_idle_desc": "No sessions in the past 14 or next 7 days",
  "alert_unrescheduled_title": "Cancelled, no makeup",
  "alert_unrescheduled_desc": "Cancelled in the last 60 days without a makeup",
  "alert_view_all": "View all ({n})"
```

Kiểm tra:
```bash
node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(a.length,b.length,a.filter(k=>!b.includes(k)))"
```
Expected: `315 315 []`.

- [ ] **Step 2: Tạo `src/components/dashboard/DashboardAlerts.tsx`**

```tsx
"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { CalendarClock, CalendarX, Wallet } from "lucide-react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SessionDetailDialog } from "@/components/sessions/SessionDetailDialog"
import { SessionFormDialog } from "@/components/sessions/SessionFormDialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { formatCurrency, formatDate, formatDayOfWeek } from "@/lib/utils"
import type { SessionDTO, SessionListDTO } from "@/lib/types/models"

type Alerts = RouterOutputs["report"]["alerts"]
type UnrescheduledSession = Omit<Alerts["unrescheduled"][number], "sessionDate"> & { sessionDate: Date }

const PREVIEW_COUNT = 3
const ROW_CLASS = "flex min-h-11 w-full items-center gap-3 py-2 text-left"

type AlertGroupProps<T> = {
  testId: string
  icon: ReactNode
  title: string
  description: string
  items: T[]
  getKey: (item: T) => number
  renderRow: (item: T) => ReactNode
}

function AlertGroup<T>({ testId, icon, title, description, items, getKey, renderRow }: AlertGroupProps<T>) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT)

  return (
    <Card data-testid={testId} className="min-w-0 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</h3>
        <Badge variant="secondary" className="border-none bg-slate-100 text-slate-600">
          {items.length}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {visible.map((item) => (
          <li key={getKey(item)} data-testid="alert-row">
            {renderRow(item)}
          </li>
        ))}
      </ul>
      {items.length > PREVIEW_COUNT && (
        <Button variant="ghost" className="mt-1 h-11 w-full md:h-10" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t("show_less_stats") : t("alert_view_all").replace("{n}", String(items.length))}
        </Button>
      )}
    </Card>
  )
}

export function DashboardAlerts() {
  const { t } = useTranslation()
  const query = trpc.report.alerts.useQuery()

  const [selected, setSelected] = useState<SessionListDTO | undefined>()
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editing, setEditing] = useState<SessionDTO | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  const unrescheduled = useMemo<UnrescheduledSession[]>(
    () => (query.data?.unrescheduled ?? []).map((s) => ({ ...s, sessionDate: new Date(s.sessionDate) })),
    [query.data]
  )

  if (query.isPending) return <Skeleton className="h-24 w-full rounded-lg" />

  // Lỗi hoặc không có gì cần xử lý → ẩn cả khối (spec S10).
  const data = query.data
  const hasAlerts =
    !!data && (data.debts.length > 0 || data.idleStudents.length > 0 || unrescheduled.length > 0)

  return (
    <>
      {data && hasAlerts && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">{t("alerts_title")}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AlertGroup
              testId="alert-group-debt"
              icon={<Wallet className="size-4 shrink-0 text-red-600" />}
              title={t("alert_debt_title")}
              description={t("alert_debt_desc")}
              items={data.debts}
              getKey={(d) => d.studentId}
              renderRow={(d) => (
                <Link
                  href={`/tuition?${new URLSearchParams({
                    year: String(data.year),
                    month: String(data.month),
                    studentName: d.fullName,
                    studentId: String(d.studentId),
                  })}`}
                  className={ROW_CLASS}
                >
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium text-slate-900">{d.fullName}</span>
                    <span className="text-slate-500"> · {t("grade")} {d.grade}</span>
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap text-sm font-semibold text-red-600">{formatCurrency(d.amount)}</p>
                    <p className="whitespace-nowrap text-xs text-slate-500">
                      {t("alert_debt_months").replace("{n}", d.months >= 12 ? "12+" : String(d.months))}
                    </p>
                  </div>
                </Link>
              )}
            />
            <AlertGroup
              testId="alert-group-idle"
              icon={<CalendarX className="size-4 shrink-0 text-orange-600" />}
              title={t("alert_idle_title")}
              description={t("alert_idle_desc")}
              items={data.idleStudents}
              getKey={(s) => s.studentId}
              renderRow={(s) => (
                <Link href="/calendar" className={ROW_CLASS}>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium text-slate-900">{s.fullName}</span>
                    <span className="text-slate-500"> · {t("grade")} {s.grade}</span>
                  </p>
                </Link>
              )}
            />
            <AlertGroup
              testId="alert-group-unrescheduled"
              icon={<CalendarClock className="size-4 shrink-0 text-violet-600" />}
              title={t("alert_unrescheduled_title")}
              description={t("alert_unrescheduled_desc")}
              items={unrescheduled}
              getKey={(s) => s.id}
              renderRow={(s) => (
                <button
                  type="button"
                  className={ROW_CLASS}
                  onClick={() => {
                    setSelected(s)
                    setIsDetailOpen(true)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {formatDate(s.sessionDate)} {formatDayOfWeek(s.sessionDate)} · {s.startTime} · {s.subject.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {s.students.map((st) => st.fullName).join(", ")}
                    </p>
                  </div>
                </button>
              )}
            />
          </div>
        </section>
      )}

      {/* Dialog nằm ngoài khối: Khôi phục ca cuối cùng làm khối biến mất nhưng dialog không bị unmount giữa chừng. */}
      {selected && (
        <SessionDetailDialog
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          session={selected}
          onEdit={(session) => {
            setIsDetailOpen(false)
            setEditing(session)
            setIsFormOpen(true)
          }}
        />
      )}
      <SessionFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} editingSession={editing} />
    </>
  )
}
```

Ghi chú cho người làm: `setSelected(s)` truyền `UnrescheduledSession` vào state kiểu `SessionListDTO` — `TodaySessions` làm y hệt (đổi `sessionDate` sang `Date`, phần còn lại khớp `SessionListDTO`). Nếu `tsc` báo lệch kiểu ở đây, đọc lỗi và sửa kiểu `UnrescheduledSession` cho khớp, không dùng `any`.

- [ ] **Step 3: Gắn vào Dashboard**

Trong `src/app/(app)/dashboard/page.tsx`:
- Thêm import sau dòng import `TodaySessions`:
  ```tsx
  import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts"
  ```
- Thêm `<DashboardAlerts />` giữa nút "Xem thêm" và `<TodaySessions />`:
  ```tsx
      <Button variant="ghost" className="h-11 w-full md:hidden" onClick={() => setShowMore((v) => !v)}>
        {showMore ? t("show_less_stats") : t("show_more_stats")}
      </Button>

      <DashboardAlerts />

      <TodaySessions />
  ```

- [ ] **Step 4: Typecheck + lint + unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit`
Expected: không lỗi, unit pass.

- [ ] **Step 5: Commit**

```bash
git add src/language/vi.json src/language/en.json src/components/dashboard/DashboardAlerts.tsx "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): khối Cần chú ý với 3 nhóm cảnh báo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: Màn Học phí mở sẵn sheet theo `studentId` trên URL

**Đọc trước:** spec mục 6.3, 10 (R5). Code: `src/app/(app)/tuition/page.tsx`, `src/hooks/useFilters.ts` (`selectedStudentId` đọc `studentId`; `setGrade`/`setStatus`/`setSearch` tự xoá `studentId`), `src/hooks/useCalendar.ts` (đọc `year`, `month` từ URL).

**Nếu B đã merge (Task 0 Step 3):** mở `src/app/(app)/tuition/page.tsx` và `src/components/tuition/TuitionDetailSheet.tsx` bản hiện tại. Cần tìm đúng 2 thứ: danh sách item đang hiển thị (plan này dùng `query.data?.items`) và hàm/state mở sheet (plan này dùng `setSelectedStudent({ ...item, year, month })` + `setIsSheetOpen(true)`, chính là thân `handleOpenDetail`). Nếu tên khác, dùng tên thật, giữ nguyên logic "mở một lần theo `studentId`, nhớ bằng `useRef`", ghi lại trong commit message.

**Files:**
- Modify: `src/app/(app)/tuition/page.tsx`

**Interfaces:**
- Consumes: `useFilters().selectedStudentId: number | null`; `query.data?.items: TuitionStatusItem[]`; link từ Task 3: `/tuition?year=Y&month=M&studentName=<fullName>&studentId=<id>`.
- Produces: vào `/tuition?...&studentId=<id>` thì sheet chi tiết của HS đó tự mở đúng 1 lần; đóng sheet không mở lại.

- [ ] **Step 1: Sửa import và lấy `selectedStudentId`**

```tsx
import { useState, useEffect, useRef } from "react"
```

```tsx
  const { selectedGrade, setGrade, searchStudentName, setSearch, selectedStatus, setStatus, selectedStudentId } = useFilters()
```

- [ ] **Step 2: Thêm effect mở sheet**

Đặt ngay sau khai báo `handleOpenDetail`:

```tsx
  // Link từ Dashboard có studentId: mở sheet đúng HS một lần (tra theo id vì tên có thể trùng).
  const autoOpenedId = useRef<number | null>(null)
  useEffect(() => {
    if (!selectedStudentId || autoOpenedId.current === selectedStudentId) return
    const item = query.data?.items.find((i) => i.studentId === selectedStudentId)
    if (!item) return
    autoOpenedId.current = selectedStudentId
    setSelectedStudent({ ...item, year, month })
    setIsSheetOpen(true)
  }, [selectedStudentId, query.data, year, month])
```

Lý do không gọi `handleOpenDetail` trong effect: hàm tạo mới mỗi render, đưa vào deps sẽ làm `react-hooks/exhaustive-deps` cảnh báo; thân hàm chỉ có 2 dòng này.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi, không cảnh báo mới ở `tuition/page.tsx`.

- [ ] **Step 4: Commit**

Hành vi được kiểm chứng bằng e2e ở Task 5.

```bash
git add "src/app/(app)/tuition/page.tsx"
git commit -m "feat(tuition): mở sẵn sheet chi tiết khi URL có studentId

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: E2E 390px — khối cảnh báo, deep link Học phí, Xem tất cả

**Đọc trước:** spec mục 9 (E2E), Global Constraints (E2E). Code: `playwright.config.ts` (nạp `tests/env-setup` để webServer dùng DB test; `testDir: './tests/e2e'`), `tests/e2e/mobile.spec.ts` (login, ẩn `nextjs-portal`, `expectNoHorizontalScroll`), `src/app/api/trpc/[trpc]/route.ts` (endpoint `/api/trpc`, không transformer), `src/components/dashboard/DashboardAlerts.tsx` (test id từ Task 3), `src/components/tuition/TuitionDetailSheet.tsx` (sheet hiện `data.fullName`).

**Nếu B đã merge:** sheet chi tiết học phí đã viết lại — kiểm tra nó vẫn là `role="dialog"` và vẫn hiện tên HS; nếu khác, sửa locator ở Step 2 cho khớp.

**Files:**
- Create: `tests/e2e/dashboard-alerts.spec.ts`
- Create (git-ignored, xoá ở Step 5): `.superpowers/pw-3100.config.ts`

**Interfaces:**
- Consumes: test id `alert-group-debt`, `alert-group-idle`, `alert-row` (Task 3); nút "Xem tất cả (n)" / "Thu gọn"; deep link có `studentId=` (Task 3) và auto-open sheet (Task 4); tRPC HTTP: `POST /api/trpc/<path>` với body là input JSON, trả `{ result: { data } }`; `GET /api/trpc/<path>?input=<json>`.
- Produces: không.

- [ ] **Step 1: Config tạm cổng 3100 (chỉ khi cổng 3000 bận)**

Kiểm tra: `netstat -ano | findstr :3000` (PowerShell) hoặc `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000` (Git Bash). Nếu cổng 3000 trống, bỏ qua bước này và chạy thẳng `pnpm exec playwright test ...`. Không tắt tiến trình của project khác.

Tạo `.superpowers/pw-3100.config.ts` (thư mục `.superpowers/` đã bị git ignore; file vẫn nằm trong phạm vi `tsc`/`eslint` nên phải viết đúng kiểu):

```ts
import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

const baseServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!baseServer) throw new Error('playwright.config.ts thiếu webServer');

// Cổng 3000 bị project khác chiếm → chạy dev server riêng ở 3100, vẫn dùng env DB test của config gốc.
export default defineConfig({
  ...base,
  testDir: '../tests/e2e',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    ...baseServer,
    command: 'pnpm exec next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Viết e2e**

Tạo `tests/e2e/dashboard-alerts.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// Gọi tRPC qua HTTP bằng cookie đăng nhập của page → ghi vào DB test mà dev server đang dùng.
async function trpcMutation<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.post(`/api/trpc/${path}`, { data: input });
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

async function trpcQuery<T>(page: Page, path: string, input: unknown): Promise<T> {
  const res = await page.request.get(`/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`);
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).result.data as T;
}

// Ngày trong tháng TRƯỚC theo giờ VN (Dashboard tính tháng hiện tại theo VN).
function dayInPreviousVnMonth(): string {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - 1, day)).toISOString().slice(0, 10);
}

test.describe('Cảnh báo Dashboard (390px)', () => {
  const createdStudentIds: number[] = [];
  const createdSessionIds: number[] = [];

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

  // Dọn: xoá ca, nghỉ học (soft delete) HS đã tạo → không còn trong cảnh báo của lần chạy sau.
  test.afterEach(async ({ page }) => {
    for (const id of createdSessionIds.splice(0)) await trpcMutation(page, 'session.delete', { id });
    for (const id of createdStudentIds.splice(0)) await trpcMutation(page, 'student.delete', { id });
  });

  test('HS nợ tháng trước → bấm dòng nợ mở màn Học phí với sheet đúng HS', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E HS nợ có tên rất dài để kiểm tra truncate ${stamp}`;
    const fee = 9_000_000; // lớn để nằm trong 3 dòng đầu (nhóm nợ sắp theo số tiền giảm dần)

    const subjects = await trpcQuery<{ id: number }[]>(page, 'subject.list', { isActive: true });
    const student = await trpcMutation<{ id: number }>(page, 'student.create', {
      fullName: name, grade: 5, tuitionFee: fee,
    });
    createdStudentIds.push(student.id);
    const hour = String(Math.floor(Math.random() * 12) + 6).padStart(2, '0');
    const session = await trpcMutation<{ id: number }>(page, 'session.create', {
      sessionDate: dayInPreviousVnMonth(), startTime: `${hour}:05`, endTime: `${hour}:55`, subjectId: subjects[0].id,
    });
    createdSessionIds.push(session.id);
    await trpcMutation(page, 'session.addStudents', { sessionId: session.id, studentIds: [student.id] });
    await trpcMutation(page, 'attendance.update', {
      sessionId: session.id,
      attendances: [{ studentId: student.id, attendance: 'present', fee }],
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Cần chú ý' })).toBeVisible();
    const debtGroup = page.getByTestId('alert-group-debt');
    const viewAll = debtGroup.getByRole('button', { name: /Xem tất cả/ });
    if (await viewAll.isVisible()) await viewAll.click();
    const row = debtGroup.getByTestId('alert-row').filter({ hasText: name });
    await expect(row).toContainText('9.000.000');
    await expect(row).toContainText('Nợ 1 tháng');
    await expectNoHorizontalScroll(page);

    await row.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/tuition\\?.*studentId=${student.id}`));
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(name);

    // Đóng sheet → không tự mở lại (kể cả khi query refetch).
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('nhóm có hơn 3 dòng → Xem tất cả mở đủ, Thu gọn về 3', async ({ page }) => {
    const stamp = Date.now();
    for (let i = 1; i <= 4; i++) {
      const s = await trpcMutation<{ id: number }>(page, 'student.create', {
        fullName: `E2E HS chưa xếp lịch ${stamp} ${i}`, grade: 1,
      });
      createdStudentIds.push(s.id);
    }

    await page.goto('/dashboard');
    const idleGroup = page.getByTestId('alert-group-idle');
    await expect(idleGroup).toBeVisible();
    await expect(idleGroup.getByTestId('alert-row')).toHaveCount(3);

    const viewAll = idleGroup.getByRole('button', { name: /Xem tất cả \(\d+\)/ });
    const total = Number((await viewAll.textContent())?.match(/\((\d+)\)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(4);
    await viewAll.click();
    await expect(idleGroup.getByTestId('alert-row')).toHaveCount(total);
    await expectNoHorizontalScroll(page);

    await idleGroup.getByRole('button', { name: 'Thu gọn' }).click();
    await expect(idleGroup.getByTestId('alert-row')).toHaveCount(3);
  });
});
```

- [ ] **Step 3: Chạy e2e**

Run (cổng 3000 trống): `pnpm exec playwright test tests/e2e/dashboard-alerts.spec.ts`
Run (dùng config tạm): `pnpm exec playwright test --config .superpowers/pw-3100.config.ts dashboard-alerts`
Expected: 2 passed.

Nếu `trpcMutation` trả 4xx với lỗi định dạng input: đọc `src/app/api/trpc/[trpc]/route.ts` và bản `@trpc/server` trong `node_modules` để biết định dạng body non-batch (không transformer thì body là input JSON trần), sửa helper cho đúng; không đổi cách tạo dữ liệu sang import Prisma.

- [ ] **Step 4: Chạy lại e2e mobile có sẵn (Dashboard đã đổi layout)**

Run: `pnpm exec playwright test tests/e2e/mobile.spec.ts tests/e2e/layout-desktop.spec.ts` (thêm `--config .superpowers/pw-3100.config.ts` nếu dùng cổng 3100; khi đó truyền tên file dạng `mobile layout-desktop`).
Expected: pass như trước.

- [ ] **Step 5: Xoá config tạm, typecheck + lint, commit**

```bash
rm -f .superpowers/pw-3100.config.ts
pnpm exec tsc --noEmit && pnpm lint
git add tests/e2e/dashboard-alerts.spec.ts
git commit -m "test(e2e): cảnh báo Dashboard trên mobile (deep link Học phí, Xem tất cả)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: Kiểm chứng cuối + bàn giao

**Đọc trước:** Global Constraints; spec mục 2 (tiêu chí), 9 (Chung).

**Files:** không sửa file nào (chỉ sửa nếu một bước kiểm tra fail; khi đó commit riêng với message nói rõ lỗi).

- [ ] **Step 1: Xác nhận lại DB test**

Run:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: 2 host khác nhau.

- [ ] **Step 2: Bộ test đầy đủ (một lượt, không chạy song song lượt khác)**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm test`
Expected: lint sạch, tsc sạch, toàn bộ unit + integration pass (~10–15 phút).

- [ ] **Step 3: E2E toàn bộ**

Run: `pnpm exec playwright test` (hoặc tạo lại `.superpowers/pw-3100.config.ts` như Task 5 Step 1 và chạy `pnpm exec playwright test --config .superpowers/pw-3100.config.ts`, xong thì xoá file).
Expected: toàn bộ pass (upgrade-class có thể skip như trước).

- [ ] **Step 4: Build**

Run: `pnpm exec next build` (KHÔNG dùng `pnpm build`).
Expected: build OK.

- [ ] **Step 5: Bàn giao**

Agent thực hiện KHÔNG merge, KHÔNG push. Báo cho người điều phối: danh sách commit trên `feat/d-dashboard-alerts`, kết quả các lệnh trên, mọi chỗ đã lệch plan (đặc biệt nếu B đã merge).

Các bước kiểm tra tay còn lại cho người dùng (sau khi merge, trên production, chỉ xem, không ghi):
1. Dashboard ở 390px và desktop: khối "Cần chú ý" nằm sau các thẻ số liệu, trước "Ca dạy hôm nay"; desktop xếp 2 cột (`md`) / 3 cột (`xl`), nhóm rỗng không chiếm ô.
2. So một HS trong nhóm "Còn nợ tháng trước" với cột "Dư nợ tháng trước" trên màn Học phí tháng hiện tại (HS chưa thu đồng nào tháng này thì phải bằng nhau).
3. Bấm dòng nợ → màn Học phí đúng tháng, sheet đúng HS mở sẵn; đóng sheet không mở lại.
4. Nếu có ca trong nhóm "Ca nghỉ chưa xếp bù": bấm → dialog chi tiết ca mở ngay trên Dashboard; Khôi phục → dòng biến mất, dialog đóng bình thường (Review Focus 1).
5. Mở Dashboard lúc 00:00–07:00 giờ VN: tháng/ngày trong cảnh báo theo giờ VN.
