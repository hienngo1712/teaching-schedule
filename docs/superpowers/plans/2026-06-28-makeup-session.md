# Ca dạy bổ sung (ca bù) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép giáo viên tạo "ca bù" cho một buổi bị nghỉ: đánh dấu ca gốc `cancelled` (giữ lịch sử, có link tới ca bù), tạo ca mới sao chép HS/học phí, và loại ca `cancelled` khỏi mọi tính toán doanh thu/học phí/điểm danh.

**Architecture:** Next.js (App Router) + tRPC + Prisma (PostgreSQL). Logic nghiệp vụ nằm trong `src/server/services/*.service.ts`, expose qua router tRPC, gọi từ React component bằng `trpc.*.useMutation`. Tự tham chiếu trên `TeachingSession` (`makeupOfId`) liên kết ca gốc ↔ ca bù. Trường `status` (đã có, chưa dùng) được kích hoạt.

**Tech Stack:** TypeScript, Prisma, tRPC, Zod, React, vitest (unit + integration), dayjs.

**Spec:** `docs/superpowers/specs/2026-06-28-makeup-session-design.md`

**Quy ước test:** Integration test chạy tuần tự trên DB `.env.test`; dùng `getAuthedCaller()` (`tests/helpers/trpc.ts`) và reset bảng trong `beforeEach`. Lệnh: `pnpm test:integration <file>` / `pnpm test:unit <file>`.

---

## File Structure

**Tạo mới:**
- `prisma/migrations/<timestamp>_makeup_session/migration.sql` — sinh tự động bởi `prisma migrate dev`.
- `tests/integration/makeup-session.test.ts` — test service + loại trừ doanh thu.

**Sửa:**
- `prisma/schema.prisma` — thêm `cancelReason`, `cancelledAt`, `makeupOfId` + self-relation.
- `src/lib/constants.ts` — (đã có `SESSION_STATUS`; không cần sửa, chỉ import).
- `src/lib/schemas/session.ts` — `sessionCreateMakeupSchema` + type.
- `src/lib/types/models.ts` — bổ sung field DTO.
- `src/server/services/session.service.ts` — `createMakeupSession`, `restoreSession`, sửa `checkOverlap`, `toDTO`, `getMonthSessions` include, bulk overlap.
- `src/server/trpc/routers/session.ts` — procedure `createMakeup`, `restore`.
- `src/server/services/report.service.ts` — loại `cancelled` khỏi 3 hàm.
- `src/server/services/tuition.service.ts` — loại `cancelled` khỏi 2 query.
- `src/components/sessions/SessionDetailDialog.tsx` — action "Tạo ca bù" + banner/khôi phục.
- `src/components/calendar/SessionCard.tsx` — style ca hủy + nhãn ca bù.
- `src/language/vi.json`, `src/language/en.json` — khóa i18n.

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (model `TeachingSession`)

- [ ] **Step 1: Thêm field + relation vào `TeachingSession`**

Trong block `model TeachingSession { ... }`, thêm các dòng sau (đặt cạnh các trường vô hướng khác, trước phần quan hệ `sessionStudents`):

```prisma
  cancelReason    String?          @map("cancel_reason")
  cancelledAt     DateTime?        @map("cancelled_at")
  makeupOfId      Int?             @map("makeup_of_id")
  makeupOf        TeachingSession?  @relation("Makeup", fields: [makeupOfId], references: [id], onDelete: SetNull)
  makeupSessions  TeachingSession[] @relation("Makeup")
```

Và thêm index trong cùng model (cạnh các `@@index` hiện có):

```prisma
  @@index([makeupOfId])
```

- [ ] **Step 2: Tạo migration**

Run: `pnpm db:migrate:dev` (script `tsx scripts/migrate-dev.ts`) — nếu script yêu cầu tên, dùng `makeup_session`. Nếu script không nhận tham số tên, chạy trực tiếp:
`npx prisma migrate dev --name makeup_session`
Expected: tạo thư mục `prisma/migrations/<ts>_makeup_session/` và `prisma generate` chạy lại.

- [ ] **Step 3: Verify Prisma Client có field mới**

Run: `npx prisma generate`
Expected: không lỗi. (Field `makeupOfId`, `cancelReason`, `cancelledAt` xuất hiện trong type `TeachingSession`.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(makeup): schema + migration cho ca bù (status cancelled, makeupOfId)"
```

---

## Task 2: Zod schema cho createMakeup

**Files:**
- Modify: `src/lib/schemas/session.ts`
- Test: `tests/unit/schemas/session.schema.test.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `tests/unit/schemas/session.schema.test.ts` (import `sessionCreateMakeupSchema` ở đầu file cùng các import schema khác):

```ts
describe("sessionCreateMakeupSchema", () => {
  it("✓ hợp lệ với id + ngày + giờ", () => {
    const r = sessionCreateMakeupSchema.safeParse({
      id: 1,
      sessionDate: "2026-07-01",
      startTime: "17:00",
      endTime: "18:30",
    })
    expect(r.success).toBe(true)
  })

  it("✗ endTime <= startTime → fail", () => {
    const r = sessionCreateMakeupSchema.safeParse({
      id: 1,
      sessionDate: "2026-07-01",
      startTime: "18:30",
      endTime: "17:00",
    })
    expect(r.success).toBe(false)
  })

  it("✓ cancelReason tùy chọn", () => {
    const r = sessionCreateMakeupSchema.safeParse({
      id: 1,
      sessionDate: "2026-07-01",
      startTime: "17:00",
      endTime: "18:30",
      cancelReason: "Nghỉ lễ",
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `pnpm test:unit tests/unit/schemas/session.schema.test.ts`
Expected: FAIL — `sessionCreateMakeupSchema is not defined`.

- [ ] **Step 3: Thêm schema + type**

Trong `src/lib/schemas/session.ts`, thêm trước phần `export type` ở cuối file:

```ts
export const sessionCreateMakeupSchema = z
  .object({
    id: z.number().int().positive(),
    sessionDate: z.string().regex(dateRegex, "Ngày phải dạng YYYY-MM-DD"),
    startTime: z.string().regex(timeRegex, "Giờ phải dạng HH:mm"),
    endTime: z.string().regex(timeRegex, "Giờ phải dạng HH:mm"),
    cancelReason: z.string().max(500).optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
  })
```

Và thêm vào cụm export type ở cuối file:

```ts
export type SessionCreateMakeupInput = z.infer<typeof sessionCreateMakeupSchema>
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `pnpm test:unit tests/unit/schemas/session.schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/session.ts tests/unit/schemas/session.schema.test.ts
git commit -m "feat(makeup): zod schema sessionCreateMakeup"
```

---

## Task 3: `checkOverlap` bỏ qua ca đã hủy

**Files:**
- Modify: `src/server/services/session.service.ts:33-49` (raw SQL trong `checkOverlap`)
- Test: `tests/integration/makeup-session.test.ts` (tạo mới)

- [ ] **Step 1: Tạo file test + test đầu tiên**

Tạo `tests/integration/makeup-session.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function reset() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.subject.deleteMany()
}

describe("checkOverlap bỏ qua ca cancelled", () => {
  let subjectId: number

  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ slot của ca đã cancelled được coi là trống", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    // hủy ca gốc trực tiếp qua db (tạm thời — sẽ thay bằng createMakeup ở Task 4)
    await db.teachingSession.update({ where: { id: orig.id }, data: { status: "cancelled" } })

    // tạo ca khác trùng đúng slot → KHÔNG được ném CONFLICT
    const s2 = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    expect(s2.id).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: FAIL — ném `CONFLICT` "Trùng giờ với…" vì `checkOverlap` chưa bỏ qua `cancelled`.

- [ ] **Step 3: Sửa raw SQL trong `checkOverlap`**

Trong `src/server/services/session.service.ts`, thêm điều kiện `AND status != 'cancelled'` vào câu query của `checkOverlap`:

```ts
  const conflicts = await db.$queryRaw<
    Array<{ id: number; title: string | null; start_time: Date; end_time: Date }>
  >(Prisma.sql`
    SELECT id, title, start_time, end_time
    FROM teaching_sessions
    WHERE user_id      = ${userId}
      AND session_date = ${sessionDate}::date
      AND status      != 'cancelled'
      AND id          != ${excludeId ?? 0}
      AND start_time   < ${endTime}::time
      AND end_time     > ${startTime}::time
    LIMIT 1
  `)
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/session.service.ts tests/integration/makeup-session.test.ts
git commit -m "feat(makeup): checkOverlap bỏ qua ca cancelled"
```

---

## Task 4: Service `createMakeupSession` + router

**Files:**
- Modify: `src/server/services/session.service.ts` (thêm hàm `createMakeupSession`)
- Modify: `src/server/trpc/routers/session.ts` (procedure `createMakeup`)
- Test: `tests/integration/makeup-session.test.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm describe mới vào `tests/integration/makeup-session.test.ts`:

```ts
describe("createMakeup", () => {
  let subjectId: number
  let studentId: number

  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
    const st = await caller.student.create({ fullName: "An", grade: 3 })
    studentId = st.id
    await db.student.update({ where: { id: studentId }, data: { tuitionFee: 100000 } })
  })

  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ tạo ca bù: copy HS/fee, điểm danh pending, ca gốc cancelled + liên kết", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30",
      subjectId, studentIds: [studentId], title: "Lớp 3",
    })

    const res = await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30",
      cancelReason: "Nghỉ lễ",
    })

    expect(res.makeup.makeupOfId).toBe(orig.id)
    expect(res.makeup.status).toBe("scheduled")
    expect(res.makeup.students).toHaveLength(1)
    expect(res.makeup.students[0].fee).toBe(100000)
    expect(res.makeup.students[0].attendance).toBe("pending")
    expect(res.makeup.title).toBe("Lớp 3")
    expect(res.cancelled.status).toBe("cancelled")

    const reloaded = await db.teachingSession.findUniqueOrThrow({ where: { id: orig.id } })
    expect(reloaded.cancelReason).toBe("Nghỉ lễ")
    expect(reloaded.cancelledAt).not.toBeNull()
  })

  it("✗ tạo ca bù cho ca đã cancelled → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.createMakeup({ id: orig.id, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30" })
    await expect(
      caller.session.createMakeup({ id: orig.id, sessionDate: "2026-07-09", startTime: "17:00", endTime: "18:30" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("✗ ca bù trùng giờ ca đang hoạt động → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-07-06", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.create({
      sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30", subjectId, title: "Lớp khác",
    })
    await expect(
      caller.session.createMakeup({ id: orig.id, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30" })
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("✗ ca của user khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.session.createMakeup({ id: 999999, sessionDate: "2026-07-08", startTime: "17:00", endTime: "18:30" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: FAIL — `caller.session.createMakeup is not a function`.

- [ ] **Step 3: Viết hàm `createMakeupSession`**

Thêm vào `src/server/services/session.service.ts` (sau `duplicateSession`), import thêm `SessionCreateMakeupInput` từ schema:

```ts
export async function createMakeupSession(
  db: PrismaClient,
  userId: number,
  originalId: number,
  input: { sessionDate: string; startTime: string; endTime: string; cancelReason?: string }
): Promise<{ makeup: SessionDTO; cancelled: SessionDTO }> {
  const original = await db.teachingSession.findUnique({
    where: { id: originalId },
    include: { sessionStudents: true, makeupSessions: { select: { id: true } } },
  })
  assertOwnership(original, userId)

  if (original.status === "cancelled") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ca này đã bị hủy" })
  }
  if (original.makeupSessions.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ca này đã có ca bù" })
  }

  const sessionDate = parseSessionDate(input.sessionDate)
  const startTime = parseTimeToDate(input.startTime)
  const endTime = parseTimeToDate(input.endTime)

  if (endTime <= startTime) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Giờ kết thúc phải sau giờ bắt đầu" })
  }

  await checkOverlap(db, { userId, sessionDate, startTime, endTime, excludeId: originalId })

  const studentData = original.sessionStudents.map((ss) => ({
    studentId: ss.studentId,
    fee: ss.fee,
    grade: ss.grade,
  }))

  const [cancelled, makeup] = await db.$transaction(async (tx) => {
    const cancelledSession = await tx.teachingSession.update({
      where: { id: originalId },
      data: {
        status: "cancelled",
        cancelReason: input.cancelReason ?? null,
        cancelledAt: new Date(),
      },
      include: { subject: true, sessionStudents: { include: { student: true } } },
    })

    const makeupSession = await tx.teachingSession.create({
      data: {
        userId,
        sessionDate,
        startTime,
        endTime,
        subjectId: original.subjectId,
        title: original.title,
        notes: original.notes,
        makeupOfId: originalId,
        ...(studentData.length > 0 ? { sessionStudents: { create: studentData } } : {}),
      },
      include: { subject: true, sessionStudents: { include: { student: true } } },
    })

    return [cancelledSession, makeupSession]
  })

  return { makeup: toDTO(makeup), cancelled: toDTO(cancelled) }
}
```

- [ ] **Step 4: Thêm procedure vào router**

Trong `src/server/trpc/routers/session.ts`, import `sessionCreateMakeupSchema` và `createMakeupSession`, thêm procedure:

```ts
  createMakeup: protectedProcedure
    .input(sessionCreateMakeupSchema)
    .mutation(({ ctx, input }) =>
      createMakeupSession(ctx.db, ctx.userId, input.id, input)
    ),
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: PASS (toàn bộ describe `createMakeup`). Test `status` của DTO yêu cầu Task 5 đã thêm `status` vào DTO — nếu `res.makeup.status` `undefined`, làm Task 5 trước rồi chạy lại. Để tránh phụ thuộc, Task 5 nằm ngay sau và cũng được commit cùng nhánh.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/session.service.ts src/server/trpc/routers/session.ts tests/integration/makeup-session.test.ts
git commit -m "feat(makeup): service + router createMakeup"
```

---

## Task 5: DTO mang `status` + thông tin liên kết

**Files:**
- Modify: `src/lib/types/models.ts:29-36` (`SessionListDTO`)
- Modify: `src/server/services/session.service.ts` (`toDTO`, `getMonthSessions`, `getSessionDetail` include)
- Test: `tests/integration/makeup-session.test.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm describe vào `tests/integration/makeup-session.test.ts`:

```ts
describe("DTO liên kết ca bù", () => {
  let subjectId: number
  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
  })
  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ getMonth: ca gốc có makeupInfo, ca bù có originalInfo + status", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-08-03", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-08-05", startTime: "17:00", endTime: "18:30",
    })

    const list = await caller.session.getMonth({ year: 2026, month: 8 })
    const cancelled = list.find((s) => s.id === orig.id)!
    const makeup = list.find((s) => s.makeupOfId === orig.id)!

    expect(cancelled.status).toBe("cancelled")
    expect(cancelled.makeupInfo?.id).toBe(makeup.id)
    expect(makeup.originalInfo?.id).toBe(orig.id)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: FAIL — `makeupInfo`/`originalInfo` undefined.

- [ ] **Step 3: Bổ sung field vào `SessionListDTO`**

Trong `src/lib/types/models.ts`, sửa interface `SessionListDTO` thành:

```ts
export interface SessionListDTO extends Omit<TeachingSession, "startTime" | "endTime" | "createdAt" | "updatedAt"> {
  startTime: string
  endTime: string
  durationMins: number
  subject: SubjectDTO
  studentCount: number
  level: SchoolLevel | "mixed"
  makeupInfo?: { id: number; sessionDate: Date | string } | null
  originalInfo?: { id: number; sessionDate: Date | string } | null
}
```

(`status`, `makeupOfId`, `cancelReason`, `cancelledAt` đã tự có nhờ `extends Omit<TeachingSession, ...>`.)

- [ ] **Step 4: Cập nhật type include + `toDTO`**

Trong `src/server/services/session.service.ts`:

(a) Mở rộng type payload `SessionWithSubjectAndStudents`:

```ts
type SessionWithSubjectAndStudents = Prisma.TeachingSessionGetPayload<{
  include: {
    subject: true
    sessionStudents: { include: { student: true } }
  }
}> & {
  _count?: { sessionStudents: number }
  makeupSessions?: Array<{ id: number; sessionDate: Date }>
  makeupOf?: { id: number; sessionDate: Date } | null
}
```

(b) Trong `toDTO`, thêm vào object return (sau `students`):

```ts
    makeupOfId: s.makeupOfId,
    cancelReason: s.cancelReason,
    cancelledAt: s.cancelledAt,
    makeupInfo: s.makeupSessions && s.makeupSessions.length > 0
      ? { id: s.makeupSessions[0].id, sessionDate: s.makeupSessions[0].sessionDate }
      : null,
    originalInfo: s.makeupOf
      ? { id: s.makeupOf.id, sessionDate: s.makeupOf.sessionDate }
      : null,
```

(c) Trong `getMonthSessions`, thêm vào `include`:

```ts
      makeupSessions: { select: { id: true, sessionDate: true } },
      makeupOf: { select: { id: true, sessionDate: true } },
```

(d) Trong `getSessionDetail`, thêm cùng include như (c).

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: PASS (cả describe `createMakeup` test `status` lẫn `DTO liên kết`).

- [ ] **Step 6: Kiểm tra type tổng thể**

Run: `npx tsc --noEmit`
Expected: không lỗi type liên quan tới DTO.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/models.ts src/server/services/session.service.ts tests/integration/makeup-session.test.ts
git commit -m "feat(makeup): DTO mang status + makeupInfo/originalInfo"
```

---

## Task 6: Loại ca `cancelled` khỏi báo cáo & học phí

**Files:**
- Modify: `src/server/services/report.service.ts` (`getMonthlySummary`, `getDashboardStats`, `getStudentReport`)
- Modify: `src/server/services/tuition.service.ts` (2 query)
- Test: `tests/integration/makeup-session.test.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm describe vào `tests/integration/makeup-session.test.ts`:

```ts
describe("Loại ca cancelled khỏi doanh thu & học phí", () => {
  let subjectId: number
  let studentId: number
  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
    const st = await caller.student.create({ fullName: "Bình", grade: 4 })
    studentId = st.id
    await db.student.update({ where: { id: studentId }, data: { tuitionFee: 200000 } })
  })
  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ ca bù không làm tăng expectedRevenue (gốc hủy + bù = 1 ca tính tiền)", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-09-07", startTime: "17:00", endTime: "18:30", subjectId, studentIds: [studentId],
    })
    const before = await caller.report.monthlySummary({ year: 2026, month: 9 })

    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-09-09", startTime: "17:00", endTime: "18:30",
    })
    const after = await caller.report.monthlySummary({ year: 2026, month: 9 })

    expect(after.expectedRevenue).toBe(before.expectedRevenue)
    expect(after.totalSessions).toBe(before.totalSessions) // gốc bị loại, bù được tính → bằng nhau
  })

  it("✓ học phí tháng không tính ca cancelled", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-10-05", startTime: "17:00", endTime: "18:30", subjectId, studentIds: [studentId],
    })
    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-10-07", startTime: "17:00", endTime: "18:30",
    })
    const tuition = await caller.tuition.getMonthlyStatus({ year: 2026, month: 10, page: 1, limit: 50, status: "all" })
    const row = tuition.items.find((i) => i.studentId === studentId)!
    expect(row.totalSessions).toBe(1) // chỉ ca bù
  })
})
```

> Tên procedure đã đối chiếu với code: `tuition.getMonthlyStatus` (input gồm `year, month, page, limit, status?, grade?, search?, studentId?`) và `report.monthlySummary`.

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: FAIL — `after.expectedRevenue` gấp đôi `before`, `row.totalSessions === 2`.

- [ ] **Step 3: Sửa `report.service.ts` — `getMonthlySummary`**

Trong `db.teachingSession.findMany` của `getMonthlySummary`, thêm `status: { not: "cancelled" }` vào `where`:

```ts
    db.teachingSession.findMany({
      where: {
        userId,
        sessionDate: { gte: startDate, lt: endDate },
        status: { not: "cancelled" },
        ...(grade ? { sessionStudents: { some: { grade } } } : {})
      },
      include: { sessionStudents: { include: { student: true } } }
    }),
```

- [ ] **Step 4: Sửa `report.service.ts` — `getDashboardStats`**

Thêm `status: { not: "cancelled" }` vào cả 2 query session:

```ts
    db.teachingSession.count({
      where: { userId, sessionDate: today, status: { not: "cancelled" } }
    }),
    db.teachingSession.findMany({
      where: { userId, sessionDate: { gte: startOfMonth, lt: endOfMonth }, status: { not: "cancelled" } },
      include: { sessionStudents: true }
    }),
```

- [ ] **Step 5: Sửa `report.service.ts` — `getStudentReport`**

Sau khi lấy `sessions` từ `getMonthSessions`, lọc bỏ ca cancelled trước khi tính. Sửa dòng `const studentSessions = sessions.filter(...)` thành:

```ts
  const studentSessions = sessions
    .filter(s => s.status !== "cancelled")
    .filter(s => s.students.some(st => st.studentId === studentId))
```

- [ ] **Step 6: Sửa `tuition.service.ts` — query điểm danh tháng hiện tại**

Trong `getMonthlyTuitionStatus`, query `currentAttendance` (`db.sessionStudent.findMany`), thêm `status` vào filter `session`:

```ts
    db.sessionStudent.findMany({
      where: {
        studentId: { in: studentIds },
        session: { sessionDate: { gte: startDate, lt: endDate }, userId, status: { not: "cancelled" } },
      },
      include: { session: true },
    }),
```

- [ ] **Step 7: Sửa `tuition.service.ts` — groupBy lịch sử tồn đọng**

Trong `totalExpectedBefore` (`db.sessionStudent.groupBy`), thêm `status` vào filter `session`:

```ts
      db.sessionStudent.groupBy({
        by: ["studentId"],
        where: {
          studentId: { in: sIds },
          session: { sessionDate: { lt: startDate }, userId, status: { not: "cancelled" } },
          attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] },
        },
        _sum: { fee: true },
      }),
```

- [ ] **Step 8: Chạy test makeup + bộ test hồi quy báo cáo/học phí**

Run:
```
pnpm test:integration tests/integration/makeup-session.test.ts
pnpm test:integration tests/integration/report.test.ts tests/integration/tuition.test.ts tests/integration/tuition-report-consistency.test.ts
```
Expected: PASS toàn bộ (không làm vỡ test hiện có — ca không-cancelled vẫn tính như cũ).

- [ ] **Step 9: Commit**

```bash
git add src/server/services/report.service.ts src/server/services/tuition.service.ts tests/integration/makeup-session.test.ts
git commit -m "feat(makeup): loại ca cancelled khỏi doanh thu, báo cáo, học phí"
```

---

## Task 7: Service + router `restoreSession` (khôi phục)

**Files:**
- Modify: `src/server/services/session.service.ts` (thêm `restoreSession`)
- Modify: `src/server/trpc/routers/session.ts` (procedure `restore`)
- Test: `tests/integration/makeup-session.test.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm describe vào `tests/integration/makeup-session.test.ts`:

```ts
describe("restore (khôi phục ca hủy)", () => {
  let subjectId: number
  beforeAll(async () => {
    await reset()
    const caller = await getAuthedCaller()
    const subject = await caller.subject.create({ name: "Toán", color: "#0891B2" })
    subjectId = subject.id
  })
  beforeEach(async () => {
    await db.sessionStudent.deleteMany()
    await db.teachingSession.deleteMany()
  })

  it("✓ khôi phục: xóa ca bù, ca gốc về scheduled", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-11-02", startTime: "17:00", endTime: "18:30", subjectId,
    })
    const { makeup } = await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-11-04", startTime: "17:00", endTime: "18:30",
    })

    const restored = await caller.session.restore({ id: orig.id })
    expect(restored.status).toBe("scheduled")

    const makeupGone = await db.teachingSession.findUnique({ where: { id: makeup.id } })
    expect(makeupGone).toBeNull()
  })

  it("✗ khôi phục khi slot gốc đã bị chiếm → CONFLICT", async () => {
    const caller = await getAuthedCaller()
    const orig = await caller.session.create({
      sessionDate: "2026-11-09", startTime: "17:00", endTime: "18:30", subjectId,
    })
    await caller.session.createMakeup({
      id: orig.id, sessionDate: "2026-11-11", startTime: "17:00", endTime: "18:30",
    })
    // chiếm lại slot gốc
    await caller.session.create({
      sessionDate: "2026-11-09", startTime: "17:00", endTime: "18:30", subjectId, title: "Lớp mới",
    })
    await expect(caller.session.restore({ id: orig.id })).rejects.toMatchObject({ code: "CONFLICT" })
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: FAIL — `caller.session.restore is not a function`.

- [ ] **Step 3: Viết hàm `restoreSession`**

Thêm vào `src/server/services/session.service.ts` (sau `createMakeupSession`):

```ts
export async function restoreSession(
  db: PrismaClient,
  userId: number,
  id: number
): Promise<SessionDTO> {
  const original = await db.teachingSession.findUnique({
    where: { id },
    include: { makeupSessions: { select: { id: true } } },
  })
  assertOwnership(original, userId)

  if (original.status !== "cancelled") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ca này chưa bị hủy" })
  }

  // Slot cũ có thể đã bị ca khác chiếm — kiểm tra trước khi khôi phục.
  await checkOverlap(db, {
    userId,
    sessionDate: original.sessionDate,
    startTime: original.startTime,
    endTime: original.endTime,
    excludeId: id,
  })

  const restored = await db.$transaction(async (tx) => {
    const makeupIds = original.makeupSessions.map((m) => m.id)
    if (makeupIds.length > 0) {
      await tx.teachingSession.deleteMany({ where: { id: { in: makeupIds } } })
    }
    return tx.teachingSession.update({
      where: { id },
      data: { status: "scheduled", cancelReason: null, cancelledAt: null },
      include: {
        subject: true,
        sessionStudents: { include: { student: true } },
        makeupSessions: { select: { id: true, sessionDate: true } },
        makeupOf: { select: { id: true, sessionDate: true } },
      },
    })
  })

  return toDTO(restored as SessionWithSubjectAndStudents)
}
```

- [ ] **Step 4: Thêm procedure `restore`**

Trong `src/server/trpc/routers/session.ts`, import `restoreSession`, thêm:

```ts
  restore: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => restoreSession(ctx.db, ctx.userId, input.id)),
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `pnpm test:integration tests/integration/makeup-session.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/session.service.ts src/server/trpc/routers/session.ts tests/integration/makeup-session.test.ts
git commit -m "feat(makeup): service + router restore (khôi phục ca hủy)"
```

---

## Task 8: i18n keys

**Files:**
- Modify: `src/language/vi.json`, `src/language/en.json`

- [ ] **Step 1: Thêm khóa vào `vi.json`**

Thêm các cặp khóa (đặt cạnh các khóa session hiện có, giữ đúng cú pháp JSON dấu phẩy):

```json
  "create_makeup_session": "Tạo ca bù",
  "create_makeup_desc": "Chọn ngày và giờ dạy bù. Ca gốc sẽ được đánh dấu đã hủy và không tính vào doanh thu.",
  "makeup_session": "Ca bù",
  "cancelled_label": "Đã hủy",
  "makeup_on": "Bù: {date}",
  "from_date": "từ {date}",
  "cancel_reason": "Lý do nghỉ",
  "restore_session": "Khôi phục",
  "restore_confirm_desc": "Khôi phục ca gốc sẽ xóa ca bù đã tạo. Tiếp tục?",
  "makeup_success": "Đã tạo ca bù",
  "makeup_error": "Không tạo được ca bù",
  "restore_success": "Đã khôi phục ca dạy",
  "restore_error": "Không khôi phục được ca dạy"
```

- [ ] **Step 2: Thêm khóa tương ứng vào `en.json`**

```json
  "create_makeup_session": "Create makeup session",
  "create_makeup_desc": "Pick the makeup date and time. The original session will be marked cancelled and excluded from revenue.",
  "makeup_session": "Makeup",
  "cancelled_label": "Cancelled",
  "makeup_on": "Makeup: {date}",
  "from_date": "from {date}",
  "cancel_reason": "Cancellation reason",
  "restore_session": "Restore",
  "restore_confirm_desc": "Restoring the original session will delete the makeup session. Continue?",
  "makeup_success": "Makeup session created",
  "makeup_error": "Failed to create makeup session",
  "restore_success": "Session restored",
  "restore_error": "Failed to restore session"
```

- [ ] **Step 3: Verify JSON hợp lệ**

Run: `node -e "require('./src/language/vi.json'); require('./src/language/en.json'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add src/language/vi.json src/language/en.json
git commit -m "feat(makeup): i18n keys vi/en"
```

---

## Task 9: UI — action "Tạo ca bù" + khôi phục trong SessionDetailDialog

**Files:**
- Modify: `src/components/sessions/SessionDetailDialog.tsx`

- [ ] **Step 1: Thêm state + mutations**

Trong `SessionDetailDialog`, thêm import icon `CalendarClock, RotateCcw` từ `lucide-react`. Thêm state cạnh các state hiện có:

```tsx
  const [isMakeupOpen, setIsMakeupOpen] = useState(false)
  const [makeupDate, setMakeupDate] = useState<Date | undefined>(
    dayjs(basicSession.sessionDate).add(2, "day").toDate()
  )
  const [makeupStart, setMakeupStart] = useState(basicSession.startTime)
  const [makeupEnd, setMakeupEnd] = useState(basicSession.endTime)
  const [makeupReason, setMakeupReason] = useState("")
  const [isRestoreOpen, setIsRestoreOpen] = useState(false)
```

Thêm mutations (cạnh `duplicateMutation`):

```tsx
  const utils = trpc.useUtils()
  const makeupMutation = trpc.session.createMakeup.useMutation({
    onSuccess: () => {
      toast.success(t("makeup_success"))
      utils.session.getMonth.invalidate()
      setIsMakeupOpen(false)
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message || t("makeup_error")),
  })
  const restoreMutation = trpc.session.restore.useMutation({
    onSuccess: () => {
      toast.success(t("restore_success"))
      utils.session.getMonth.invalidate()
      setIsRestoreOpen(false)
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message || t("restore_error")),
  })
```

> Nếu file đã có cách invalidate khác (vd parent truyền callback), theo pattern hiện có thay cho `utils.session.getMonth.invalidate()`. Kiểm tra cách các mutation hiện tại (delete/duplicate) làm mới danh sách trong file/parent `MonthCalendar`.

- [ ] **Step 2: Thêm handler**

```tsx
  const handleCreateMakeup = () => {
    if (!makeupDate) return
    makeupMutation.mutate({
      id: basicSession.id,
      sessionDate: dayjs(makeupDate).format("YYYY-MM-DD"),
      startTime: makeupStart,
      endTime: makeupEnd,
      cancelReason: makeupReason || undefined,
    })
  }
```

- [ ] **Step 3: Thêm mục dropdown (chỉ khi chưa hủy & chưa có ca bù)**

Trong `DropdownMenuContent`, thêm trước mục "Xóa":

```tsx
                    {session.status !== "cancelled" && !session.makeupInfo && (
                      <DropdownMenuItem onClick={() => setIsMakeupOpen(true)}>
                        <CalendarClock className="mr-2 size-4" />
                        {t("create_makeup_session")}
                      </DropdownMenuItem>
                    )}
```

- [ ] **Step 4: Banner cho ca đã hủy + nút khôi phục**

Ngay sau `DialogHeader` (trước phần `notes`), thêm:

```tsx
              {session.status === "cancelled" && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-2">
                  <span>
                    {t("cancelled_label")}
                    {session.makeupInfo
                      ? ` — ${t("makeup_on").replace("{date}", dayjs(session.makeupInfo.sessionDate).format("DD/MM/YYYY"))}`
                      : ""}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setIsRestoreOpen(true)}>
                    <RotateCcw className="mr-2 size-3.5" />
                    {t("restore_session")}
                  </Button>
                </div>
              )}
```

- [ ] **Step 5: Dialog "Tạo ca bù"**

Thêm khối Dialog (cạnh dialog duplicate), dùng `Calendar` + 2 input giờ + textarea lý do:

```tsx
      <Dialog open={isMakeupOpen} onOpenChange={setIsMakeupOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("create_makeup_session")}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-slate-500">{t("create_makeup_desc")}</p>
            <Calendar mode="single" selected={makeupDate} onSelect={setMakeupDate} className="rounded-md border" />
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t("start_time") || "Bắt đầu"}</Label>
                <input type="time" value={makeupStart} onChange={(e) => setMakeupStart(e.target.value)}
                  className="w-full h-9 rounded-md border px-2 text-sm" />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t("end_time") || "Kết thúc"}</Label>
                <input type="time" value={makeupEnd} onChange={(e) => setMakeupEnd(e.target.value)}
                  className="w-full h-9 rounded-md border px-2 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("cancel_reason")}</Label>
              <textarea value={makeupReason} onChange={(e) => setMakeupReason(e.target.value)}
                rows={2} className="w-full rounded-md border px-2 py-1 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsMakeupOpen(false)} disabled={makeupMutation.isPending}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreateMakeup} disabled={makeupMutation.isPending || !makeupDate}>
              {makeupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("create_makeup_session")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

> `start_time`/`end_time` có thể chưa có key — fallback `|| "Bắt đầu"/"Kết thúc"` đã xử lý; nếu muốn sạch, thêm 2 key này vào Task 8.

- [ ] **Step 6: AlertDialog xác nhận khôi phục**

Thêm cạnh AlertDialog xóa:

```tsx
      <AlertDialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restore_session")}</AlertDialogTitle>
            <AlertDialogDescription>{t("restore_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoreMutation.mutate({ id: basicSession.id })}
              disabled={restoreMutation.isPending}>
              {restoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("restore_session")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 7: Kiểm tra build type**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 8: Commit**

```bash
git add src/components/sessions/SessionDetailDialog.tsx
git commit -m "feat(makeup): UI tạo ca bù + khôi phục trong dialog chi tiết"
```

---

## Task 10: UI — hiển thị ca hủy & ca bù trên SessionCard

**Files:**
- Modify: `src/components/calendar/SessionCard.tsx`

- [ ] **Step 1: Cập nhật render theo trạng thái**

Sửa `SessionCard` để xử lý ca `cancelled` và ca bù. Thay phần `return` bằng:

```tsx
  const isCancelled = session.status === "cancelled"
  const isMakeup = session.makeupOfId != null

  return (
    <button
      type="button"
      onClick={() => onClick?.(session)}
      className={cn(
        "session-card text-left w-full",
        level === "tieu_hoc" && "session-card--tieu-hoc",
        level === "thcs" && "session-card--thcs",
        level === "mixed" && "border-indigo-500 bg-indigo-50",
        isCancelled && "opacity-60 border-red-300 bg-red-50"
      )}
      title={`${session.startTime}–${session.endTime} · ${session.subject.name}`}
    >
      <div className={cn("font-medium text-slate-900", isCancelled && "line-through text-red-700")}>
        {session.startTime}–{session.endTime}
      </div>
      <div className={cn("truncate text-slate-700", isCancelled && "line-through")}>
        {label} {studentCountText}
      </div>
      {isCancelled && (
        <div className="text-[10px] font-semibold text-red-600">
          {t("cancelled_label")}
          {session.makeupInfo
            ? ` · ${t("makeup_on").replace("{date}", dayjs(session.makeupInfo.sessionDate).format("DD/MM"))}`
            : ""}
        </div>
      )}
      {isMakeup && !isCancelled && (
        <div className="text-[10px] font-semibold text-indigo-600">
          {t("makeup_session")}
          {session.originalInfo
            ? ` · ${t("from_date").replace("{date}", dayjs(session.originalInfo.sessionDate).format("DD/MM"))}`
            : ""}
        </div>
      )}
    </button>
  )
```

Thêm `import dayjs from "dayjs"` ở đầu file.

- [ ] **Step 2: Kiểm tra build type**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/SessionCard.tsx
git commit -m "feat(makeup): hiển thị ca hủy (mờ/gạch) + nhãn ca bù trên calendar"
```

---

## Task 11: Hồi quy toàn bộ + chạy app

**Files:** (không sửa — chỉ kiểm tra)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `pnpm test`
Expected: PASS toàn bộ unit + integration (đặc biệt `session.test.ts`, `report.test.ts`, `tuition*.test.ts`, `makeup-session.test.ts`).

- [ ] **Step 2: Lint + type-check**

Run: `pnpm lint && npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Smoke test thủ công (dev)**

Run: `pnpm dev`, sau đó trong app:
- Mở Lịch dạy → 1 ca → "Tạo ca bù" → chọn ngày/giờ → lưu.
- Kiểm tra: ca gốc hiện mờ/gạch + "Đã hủy · Bù: DD/MM"; ca bù hiện nhãn "Ca bù · từ DD/MM".
- Mở Tổng quan/Báo cáo: doanh thu kì vọng KHÔNG đổi so với trước khi tạo ca bù.
- Mở ca gốc → "Khôi phục" → ca bù biến mất, ca gốc trở lại bình thường.

- [ ] **Step 4: Commit (nếu có chỉnh sửa nhỏ phát sinh)**

```bash
git add -A
git commit -m "test(makeup): hồi quy + dọn dẹp"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** Q1 (cancelled) → Task 4; Q2 (hiển thị + loại doanh thu) → Task 6, 9, 10; Q3 (ngày+giờ, copy HS, reset điểm danh) → Task 4, 9. Schema (spec §4) → Task 1. Backend (§5) → Task 3,4,6,7. DTO (§6) → Task 5. FE (§7) → Task 9,10. i18n (§7.3) → Task 8. Test (§8) → rải trong Task 3–7. Khôi phục (§7.1/5.5) → Task 7,9.
- **Type consistency:** `createMakeupSession`/`restoreSession`/`createMakeup`/`restore`, `makeupInfo`/`originalInfo`/`makeupOfId` dùng nhất quán giữa service, DTO, test, UI.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh cụ thể.
- **Lưu ý phụ thuộc:** Task 4 test `status` của DTO cần Task 5 — đã ghi chú; thực thi tuần tự Task 1→11 đảm bảo đúng thứ tự.
