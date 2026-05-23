# Auto Class Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automatic and manual annual class upgrade — all active students gain +1 grade on July 1st each year (with grade-9 students deactivated), idempotent per `(userId, year)`, while preserving historical grade snapshots for past sessions/reports.

**Architecture:**
- Idempotency via new `ClassUpgradeLog(userId, year)` unique table.
- Lazy auto-trigger inside `auth.me` (runs once per (user, year) from July onwards, swallows errors).
- Manual button on `/students` calling new tRPC mutation `student.upgradeAllClasses`.
- Historical integrity via new `SessionStudent.grade` snapshot column — populated on student-assignment, never mutated by upgrade.
- Filter/report layers switch from `student.grade` → `sessionStudent.grade` for any "historical" query.

**Tech Stack:** Next.js 14, tRPC v11, Prisma + Neon Postgres, NextAuth, Zod, React Hook Form, shadcn/ui, TanStack Query, Vitest (unit + integration), Playwright (E2E).

**Spec reference:** `specs/14-auto-class-upgrade.md` (committed at `feat/auto-class-upgrade` branch, commit `b4c881c`).

**Branch:** `feat/auto-class-upgrade` (already created). All commits must land on this branch — never on `main`.

---

## File Structure

**Created:**
- `prisma/migrations/<timestamp>_add_class_upgrade_log_and_session_student_grade/migration.sql` — DDL for new table + new column + backfill.
- `src/components/students/UpgradeAllClassesButton.tsx` — manual upgrade button + AlertDialog.
- `tests/integration/student-upgrade.test.ts` — integration tests for upgrade service, idempotency, multi-tenant, historical snapshots, lazy auto-trigger.
- `tests/e2e/upgrade-class.spec.ts` — E2E browser test.

**Modified:**
- `prisma/schema.prisma` — add `ClassUpgradeLog` model, `SessionStudent.grade` field, relations.
- `src/server/services/student.service.ts` — add `upgradeAllClasses` + `getUpgradeLogThisYear`.
- `src/server/services/session.service.ts` — populate `sessionStudent.grade` in all 5 creation paths; switch month-filter from `student.grade` to `sessionStudent.grade`.
- `src/server/services/report.service.ts` — switch historical grade reads to `sessionStudent.grade`.
- `src/server/services/tuition.service.ts` — switch grade filter in monthly tuition to `sessionStudent.grade`.
- `src/server/trpc/routers/student.ts` — register two new procedures.
- `src/server/trpc/routers/auth.ts` — hook lazy auto-upgrade into `me`.
- `src/app/(app)/students/page.tsx` — render the new button.
- `src/components/students/StudentList.tsx` — slot the button in the toolbar (alternative location if page-level doesn't fit pattern).
- `src/language/vi.json`, `src/language/en.json` — i18n keys.

---

## Pre-flight: Verify branch & environment

- [ ] **Step 0.1: Confirm current branch is `feat/auto-class-upgrade`**

Run: `git branch --show-current`
Expected output: `feat/auto-class-upgrade`

If not on this branch:
```bash
git checkout feat/auto-class-upgrade
```
If branch missing:
```bash
git checkout -b feat/auto-class-upgrade
```

- [ ] **Step 0.2: Verify `.env` and `.env.test` exist and point to different Neon branches**

Run: `cat .env | grep DATABASE_URL && cat .env.test | grep DATABASE_URL`
Expected: two different URLs (production branch vs test branch). If `.env.test` is missing or matches `.env`, **STOP** and ask user — running migrations could destroy data.

- [ ] **Step 0.3: Pull latest deps**

Run: `pnpm install`
Expected: completes without errors; `prisma generate` runs via `postinstall`.

---

## Task 1: Prisma schema — add `ClassUpgradeLog` and `SessionStudent.grade`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Add `ClassUpgradeLog` model**

Open `prisma/schema.prisma`. Add this block before the closing of the file (after `SessionStudent` block):

```prisma
model ClassUpgradeLog {
  id                Int      @id @default(autoincrement())
  userId            Int      @map("user_id")
  year              Int
  executedAt        DateTime @default(now()) @map("executed_at")
  trigger           String   @db.VarChar(10)
  upgradedCount     Int      @default(0) @map("upgraded_count")
  deactivatedCount  Int      @default(0) @map("deactivated_count")

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, year])
  @@index([userId])
  @@map("class_upgrade_logs")
}
```

- [ ] **Step 1.2: Add relation to `User`**

In the existing `model User { ... }` block (around line 11–26), add this line in the relations section (after `sessions  TeachingSession[]`):

```prisma
  classUpgradeLogs ClassUpgradeLog[]
```

- [ ] **Step 1.3: Add `grade` column to `SessionStudent`**

In the existing `model SessionStudent { ... }` block (around line 124–138), add the `grade` field after `fee`:

```prisma
  grade      Int     @db.SmallInt
```

Then add an index inside the same block (just before `@@map`):

```prisma
  @@index([grade])
```

The full block after edit:

```prisma
model SessionStudent {
  id         Int             @id @default(autoincrement())
  sessionId  Int             @map("session_id")
  studentId  Int             @map("student_id")
  attendance String          @default("pending") @db.VarChar(10)
  note       String?
  fee        Int             @default(0)
  grade      Int             @db.SmallInt
  session    TeachingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  student    Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([sessionId, studentId])
  @@index([studentId])
  @@index([sessionId])
  @@index([grade])
  @@map("session_students")
}
```

- [ ] **Step 1.4: Generate migration against `.env.test` first (safer)**

Run:
```bash
pnpm dotenv -e .env.test -- prisma migrate dev --name add_class_upgrade_log_and_session_student_grade --create-only
```

Expected: Prisma creates the migration folder and SQL file but does NOT apply it yet (because of `--create-only`).
Expected message includes: `Migration created at prisma/migrations/<timestamp>_add_class_upgrade_log_and_session_student_grade/`.

**If `pnpm dotenv` is not available**, use: `npx dotenv-cli -e .env.test -- npx prisma migrate dev ...` or run with environment exported manually.

- [ ] **Step 1.5: Edit migration SQL to add backfill of `grade` column**

Open the generated `prisma/migrations/<timestamp>_add_class_upgrade_log_and_session_student_grade/migration.sql`.

Prisma's auto-generated SQL will likely add `grade` as `NOT NULL` directly which would fail on existing rows. Replace the `ALTER TABLE "session_students" ADD COLUMN "grade" ...` statement with this 3-step sequence:

```sql
-- Backfill-safe addition of session_students.grade
ALTER TABLE "session_students" ADD COLUMN "grade" SMALLINT;
UPDATE "session_students" ss
  SET "grade" = s."grade"
  FROM "students" s
  WHERE ss."student_id" = s."id";
ALTER TABLE "session_students" ALTER COLUMN "grade" SET NOT NULL;
```

Leave the `CREATE TABLE "class_upgrade_logs"`, indexes, and FK constraints exactly as Prisma generated them. The final file should contain (in order):
1. `CREATE TABLE "class_upgrade_logs" ...`
2. Indexes / unique constraint on `class_upgrade_logs`.
3. FK from `class_upgrade_logs.user_id` → `users.id`.
4. The 3-statement backfill block for `session_students.grade` (replaces auto-generated single-line ALTER).
5. `CREATE INDEX "session_students_grade_idx" ON "session_students"("grade")`.

- [ ] **Step 1.6: Apply migration to test DB**

Run:
```bash
pnpm dotenv -e .env.test -- prisma migrate deploy
```
Expected: `All migrations have been successfully applied.`

- [ ] **Step 1.7: Apply migration to production DB**

Run:
```bash
pnpm dotenv -e .env -- prisma migrate deploy
```
Expected: same `All migrations have been successfully applied.` message.

⚠️ **Backup first**: Confirm with user before applying to `.env` (production). Run only after explicit user confirmation.

- [ ] **Step 1.8: Regenerate Prisma client**

Run: `pnpm prisma generate`
Expected: `✔ Generated Prisma Client`.

- [ ] **Step 1.9: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors. (If `tsc` script not available, run via `pnpm exec tsc --noEmit`.)

- [ ] **Step 1.10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add ClassUpgradeLog table and SessionStudent.grade snapshot column"
```

---

## Task 2: Service — `upgradeAllClasses` and `getUpgradeLogThisYear` (TDD)

**Files:**
- Modify: `src/server/services/student.service.ts`
- Create: `tests/integration/student-upgrade.test.ts`

- [ ] **Step 2.1: Write failing integration test for manual upgrade — basic case**

Create `tests/integration/student-upgrade.test.ts`:

```typescript
import { describe, expect, it, beforeEach, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { TRPCError } from "@trpc/server"

async function resetUserData(username: string) {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) return
  await db.classUpgradeLog.deleteMany({ where: { userId: user.id } })
  await db.sessionStudent.deleteMany({
    where: { student: { userId: user.id } },
  })
  await db.student.deleteMany({ where: { userId: user.id } })
}

describe("upgradeAllClasses — manual", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    vi.useRealTimers()
  })

  it("upgrades grade 1–8 active students by +1", async () => {
    const caller = await getAuthedCaller("teacher")
    const s1 = await caller.student.create({ fullName: "HS Lop 1", grade: 1, tuitionFee: 0, isActive: true })
    const s5 = await caller.student.create({ fullName: "HS Lop 5", grade: 5, tuitionFee: 0, isActive: true })
    const s8 = await caller.student.create({ fullName: "HS Lop 8", grade: 8, tuitionFee: 0, isActive: true })

    const result = await caller.student.upgradeAllClasses()

    const after1 = await db.student.findUnique({ where: { id: s1.id } })
    const after5 = await db.student.findUnique({ where: { id: s5.id } })
    const after8 = await db.student.findUnique({ where: { id: s8.id } })

    expect(after1?.grade).toBe(2)
    expect(after5?.grade).toBe(6)
    expect(after8?.grade).toBe(9)
    expect(result.upgradedCount).toBe(3)
    expect(result.deactivatedCount).toBe(0)
    expect(result.year).toBe(new Date().getFullYear())
  })
})
```

- [ ] **Step 2.2: Run the test — verify it fails**

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts`
Expected: FAIL with `caller.student.upgradeAllClasses is not a function` (or similar — procedure not yet defined).

- [ ] **Step 2.3: Add `upgradeAllClasses` and `getUpgradeLogThisYear` to service**

Open `src/server/services/student.service.ts`. At the bottom of the file (after `softDeleteStudent`), add:

```typescript
import { TRPCError } from "@trpc/server"
import type { ClassUpgradeLog } from "@prisma/client"

export async function upgradeAllClasses(
  db: PrismaClient,
  userId: number,
  trigger: "auto" | "manual"
): Promise<{ upgradedCount: number; deactivatedCount: number; year: number }> {
  const year = new Date().getFullYear()

  const existing = await db.classUpgradeLog.findUnique({
    where: { userId_year: { userId, year } },
  })
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Bạn đã nâng lớp toàn bộ học sinh trong năm ${year} rồi.`,
    })
  }

  return db.$transaction(async (tx) => {
    const upgraded = await tx.student.updateMany({
      where: { userId, isActive: true, grade: { gte: 1, lte: 8 } },
      data: { grade: { increment: 1 } },
    })
    const deactivated = await tx.student.updateMany({
      where: { userId, isActive: true, grade: 9 },
      data: { isActive: false },
    })
    await tx.classUpgradeLog.create({
      data: {
        userId,
        year,
        trigger,
        upgradedCount: upgraded.count,
        deactivatedCount: deactivated.count,
      },
    })
    return {
      upgradedCount: upgraded.count,
      deactivatedCount: deactivated.count,
      year,
    }
  })
}

export async function getUpgradeLogThisYear(
  db: PrismaClient,
  userId: number
): Promise<ClassUpgradeLog | null> {
  return db.classUpgradeLog.findUnique({
    where: { userId_year: { userId, year: new Date().getFullYear() } },
  })
}
```

Add the `TRPCError` import at the top of the file if not already present:
```typescript
import { TRPCError } from "@trpc/server"
```

- [ ] **Step 2.4: Wire up tRPC procedure (so the test can call it)**

Open `src/server/trpc/routers/student.ts`. Update imports:

```typescript
import {
  createStudent,
  listStudents,
  softDeleteStudent,
  updateStudent,
  upgradeAllClasses,
  getUpgradeLogThisYear,
} from "@/server/services/student.service"
```

Add the two procedures to the router:

```typescript
export const studentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(studentFilterSchema)
    .query(({ ctx, input }) => listStudents(ctx.db, ctx.userId, input)),

  create: protectedProcedure
    .input(studentCreateSchema)
    .mutation(({ ctx, input }) => createStudent(ctx.db, ctx.userId, input)),

  update: protectedProcedure
    .input(studentUpdateSchema)
    .mutation(({ ctx, input }) =>
      updateStudent(ctx.db, ctx.userId, input.id, input.data)
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      softDeleteStudent(ctx.db, ctx.userId, input.id)
    ),

  upgradeAllClasses: protectedProcedure
    .mutation(({ ctx }) => upgradeAllClasses(ctx.db, ctx.userId, "manual")),

  getUpgradeLogThisYear: protectedProcedure
    .query(({ ctx }) => getUpgradeLogThisYear(ctx.db, ctx.userId)),
})
```

- [ ] **Step 2.5: Re-run the test — verify it passes**

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts`
Expected: PASS (`1 passed`).

- [ ] **Step 2.6: Add test — grade-9 deactivation**

Append to `tests/integration/student-upgrade.test.ts`:

```typescript
  it("deactivates grade-9 active students and keeps their grade=9", async () => {
    const caller = await getAuthedCaller("teacher")
    const s9 = await caller.student.create({ fullName: "HS Lop 9", grade: 9, tuitionFee: 0, isActive: true })

    const result = await caller.student.upgradeAllClasses()

    const after9 = await db.student.findUnique({ where: { id: s9.id } })
    expect(after9?.grade).toBe(9)
    expect(after9?.isActive).toBe(false)
    expect(result.upgradedCount).toBe(0)
    expect(result.deactivatedCount).toBe(1)
  })

  it("does NOT touch inactive students", async () => {
    const caller = await getAuthedCaller("teacher")
    const s = await caller.student.create({ fullName: "HS inactive", grade: 3, tuitionFee: 0, isActive: false })

    await caller.student.upgradeAllClasses()

    const after = await db.student.findUnique({ where: { id: s.id } })
    expect(after?.grade).toBe(3)
    expect(after?.isActive).toBe(false)
  })

  it("creates ClassUpgradeLog with trigger='manual' and correct counts", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "A", grade: 2, tuitionFee: 0, isActive: true })
    await caller.student.create({ fullName: "B", grade: 9, tuitionFee: 0, isActive: true })

    await caller.student.upgradeAllClasses()

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: user.id, year: new Date().getFullYear() } },
    })
    expect(log).not.toBeNull()
    expect(log?.trigger).toBe("manual")
    expect(log?.upgradedCount).toBe(1)
    expect(log?.deactivatedCount).toBe(1)
  })
```

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 2.7: Add idempotency test**

Append:

```typescript
  it("throws CONFLICT when called twice in the same year", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "A", grade: 2, tuitionFee: 0, isActive: true })

    await caller.student.upgradeAllClasses()

    await expect(caller.student.upgradeAllClasses()).rejects.toMatchObject({
      code: "CONFLICT",
    })
  })
```

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 2.8: Add multi-tenant isolation test**

If a second test user (e.g. `teacher2`) doesn't exist, create it inline in the test. Append:

```typescript
  it("does not affect students of other users", async () => {
    const user2 = await db.user.upsert({
      where: { username: "teacher2" },
      update: {},
      create: {
        username: "teacher2",
        passwordHash: "$2a$04$placeholder",
        fullName: "Teacher 2",
      },
    })
    // Clean teacher2 data
    await db.classUpgradeLog.deleteMany({ where: { userId: user2.id } })
    await db.sessionStudent.deleteMany({ where: { student: { userId: user2.id } } })
    await db.student.deleteMany({ where: { userId: user2.id } })

    const callerA = await getAuthedCaller("teacher")
    const callerB = await getAuthedCaller("teacher2")

    const sA = await callerA.student.create({ fullName: "A", grade: 2, tuitionFee: 0, isActive: true })
    const sB = await callerB.student.create({ fullName: "B", grade: 2, tuitionFee: 0, isActive: true })

    await callerA.student.upgradeAllClasses()

    const afterA = await db.student.findUnique({ where: { id: sA.id } })
    const afterB = await db.student.findUnique({ where: { id: sB.id } })
    expect(afterA?.grade).toBe(3)
    expect(afterB?.grade).toBe(2)   // untouched
  })
```

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 2.9: Add `getUpgradeLogThisYear` test**

Append:

```typescript
describe("getUpgradeLogThisYear", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
  })

  it("returns null when no log exists", async () => {
    const caller = await getAuthedCaller("teacher")
    const log = await caller.student.getUpgradeLogThisYear()
    expect(log).toBeNull()
  })

  it("returns the log after upgrade", async () => {
    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "A", grade: 2, tuitionFee: 0, isActive: true })
    await caller.student.upgradeAllClasses()

    const log = await caller.student.getUpgradeLogThisYear()
    expect(log).not.toBeNull()
    expect(log?.year).toBe(new Date().getFullYear())
    expect(log?.trigger).toBe("manual")
  })
})
```

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 2.10: Commit**

```bash
git add src/server/services/student.service.ts src/server/trpc/routers/student.ts tests/integration/student-upgrade.test.ts
git commit -m "feat(student): add upgradeAllClasses service and tRPC procedures with idempotency"
```

---

## Task 3: Populate `SessionStudent.grade` in all 5 creation paths

**Files:**
- Modify: `src/server/services/session.service.ts`

The five paths that create `SessionStudent` records (need grade snapshot):
1. `createSession` (line ~234, when `studentIds` provided)
2. `updateSession` (line ~327, when syncing students)
3. `bulkCreateSessions` (line ~643, when students assigned)
4. `addStudentsToSession` (line ~460)
5. `addStudentsToRecurringSessions` (line ~427)
6. `duplicateSession` (line ~812)
7. `bulkUpdateFutureSessions` (line ~752)

(That's 7 total — let's handle all.)

- [ ] **Step 3.1: Update `assertStudentsOwned` to return `grade` too**

In `src/server/services/session.service.ts`, find function `assertStudentsOwned` (around line 200) and update it:

```typescript
async function assertStudentsOwned(
  db: PrismaClient,
  userId: number,
  studentIds: number[]
): Promise<Array<{ id: number; tuitionFee: number; grade: number }>> {
  if (!studentIds.length) return []
  const owned = await db.student.findMany({
    where: { id: { in: studentIds }, userId },
    select: { id: true, tuitionFee: true, grade: true },
  })
  if (owned.length !== studentIds.length) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  return owned
}
```

- [ ] **Step 3.2: Update `studentFees` type annotations in all consumers**

Search the file for the type annotation `Array<{ id: number; tuitionFee: number }>` and replace each occurrence with `Array<{ id: number; tuitionFee: number; grade: number }>`. There are typically 3 such declarations (in `createSession`, `updateSession`, `bulkCreateSessions`).

- [ ] **Step 3.3: Add `grade` to every `sessionStudents.create / createMany`**

In `createSession` (around line 246), update:

```typescript
sessionStudents: {
  create: studentFees.map((s) => ({
    studentId: s.id,
    fee: s.tuitionFee,
    grade: s.grade,
  })),
},
```

In `updateSession`'s `sessionStudent.createMany` (around line 332):

```typescript
await tx.sessionStudent.createMany({
  data: studentFees.map((s) => ({
    sessionId: id,
    studentId: s.id,
    fee: s.tuitionFee,
    grade: s.grade,
  })),
})
```

In `addStudentsToSession` (around line 466):

```typescript
await tx.sessionStudent.createMany({
  data: studentFees.map((s) => ({
    sessionId,
    studentId: s.id,
    fee: s.tuitionFee,
    grade: s.grade,
  })),
})
```

In `addStudentsToRecurringSessions` — the `owned` fetch (line 403) now includes grade because we updated `assertStudentsOwned`. Update the `toCreate.push` (around line 420):

```typescript
toCreate.push({ sessionId, studentId: s.id, fee: s.tuitionFee, grade: s.grade })
```

Update the type annotation of `toCreate` (line 416):

```typescript
const toCreate: Array<{ sessionId: number; studentId: number; fee: number; grade: number }> = []
```

In `bulkCreateSessions` `sessionStudentsData` (around line 652):

```typescript
const sessionStudentsData = sessions.flatMap((session) =>
  studentFees.map((sf) => ({
    sessionId: session.id,
    studentId: sf.id,
    fee: sf.tuitionFee,
    grade: sf.grade,
  }))
)
```

In `duplicateSession` (around line 824):

```typescript
sessionStudents: {
  create: studentFees.map((s) => ({
    studentId: s.id,
    fee: s.tuitionFee,
    grade: s.grade,
  })),
},
```

In `bulkUpdateFutureSessions` (around line 758-769) — fetch `grade` too:

```typescript
const studentFees = await tx.student.findMany({
  where: { id: { in: data.studentIds }, userId },
  select: { id: true, tuitionFee: true, grade: true },
})

const toCreate: Array<{ sessionId: number; studentId: number; fee: number; grade: number }> = []
for (const sid of sessionIds) {
  for (const s of studentFees) {
    toCreate.push({ sessionId: sid, studentId: s.id, fee: s.tuitionFee, grade: s.grade })
  }
}
```

- [ ] **Step 3.4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. If you see `Property 'grade' is missing in type...`, locate the missing path and add `grade: ...`.

- [ ] **Step 3.5: Write integration test verifying snapshot is populated**

Append to `tests/integration/student-upgrade.test.ts`:

```typescript
describe("SessionStudent.grade snapshot", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
  })

  it("populates grade snapshot from current Student.grade on session create", async () => {
    const caller = await getAuthedCaller("teacher")
    const subject = (await caller.subject.list({}))[0]
    const student = await caller.student.create({
      fullName: "HS3", grade: 3, tuitionFee: 0, isActive: true,
    })
    const session = await caller.session.create({
      sessionDate: "2099-01-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })
    const ss = await db.sessionStudent.findFirst({
      where: { sessionId: session.id, studentId: student.id },
    })
    expect(ss?.grade).toBe(3)
  })

  it("preserves historical grade after upgradeAllClasses", async () => {
    const caller = await getAuthedCaller("teacher")
    const subject = (await caller.subject.list({}))[0]
    const student = await caller.student.create({
      fullName: "HS3", grade: 3, tuitionFee: 0, isActive: true,
    })
    const session = await caller.session.create({
      sessionDate: "2099-02-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.upgradeAllClasses()

    const ss = await db.sessionStudent.findFirst({
      where: { sessionId: session.id, studentId: student.id },
    })
    expect(ss?.grade).toBe(3)   // historical snapshot

    const studentAfter = await db.student.findUnique({ where: { id: student.id } })
    expect(studentAfter?.grade).toBe(4)   // current grade upgraded
  })

  it("new session after upgrade uses NEW current grade", async () => {
    const caller = await getAuthedCaller("teacher")
    const subject = (await caller.subject.list({}))[0]
    const student = await caller.student.create({
      fullName: "HS3", grade: 3, tuitionFee: 0, isActive: true,
    })
    await caller.student.upgradeAllClasses()

    const session = await caller.session.create({
      sessionDate: "2099-08-15",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })
    const ss = await db.sessionStudent.findFirst({
      where: { sessionId: session.id, studentId: student.id },
    })
    expect(ss?.grade).toBe(4)   // current grade after upgrade
  })
})
```

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts`
Expected: all tests PASS (11 total).

- [ ] **Step 3.6: Run full integration test suite to catch regressions**

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration`
Expected: all existing tests still pass. Pay attention to `tests/integration/session.test.ts` — sessionStudent creations there should now have grade populated automatically.

If any test fails because the test inserts `SessionStudent` directly without `grade`, fix by either:
- Updating the test to include `grade`, OR
- Using the service function (preferred).

- [ ] **Step 3.7: Commit**

```bash
git add src/server/services/session.service.ts tests/integration/student-upgrade.test.ts
git commit -m "feat(session): populate SessionStudent.grade snapshot on all assignment paths"
```

---

## Task 4: Switch grade filtering to use `SessionStudent.grade` for historical views

**Files:**
- Modify: `src/server/services/session.service.ts` (month filter)
- Modify: `src/server/services/report.service.ts`
- Modify: `src/server/services/tuition.service.ts`

- [ ] **Step 4.1: Write failing test — historical filter by grade**

Append to `tests/integration/student-upgrade.test.ts`:

```typescript
describe("Historical grade filtering after upgrade", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
  })

  it("session.getMonth with grade=3 returns past session even after student upgraded to grade 4", async () => {
    const caller = await getAuthedCaller("teacher")
    const subject = (await caller.subject.list({}))[0]
    const student = await caller.student.create({
      fullName: "HS3", grade: 3, tuitionFee: 0, isActive: true,
    })
    await caller.session.create({
      sessionDate: "2099-03-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subject.id,
      studentIds: [student.id],
    })

    await caller.student.upgradeAllClasses()

    const grade3Sessions = await caller.session.getMonth({ year: 2099, month: 3, grade: 3 })
    const grade4Sessions = await caller.session.getMonth({ year: 2099, month: 3, grade: 4 })

    expect(grade3Sessions.length).toBe(1)   // historical snapshot=3 matches
    expect(grade4Sessions.length).toBe(0)   // grade 4 (current) NOT a match for snapshot=3
  })
})
```

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts -t "Historical grade filtering"`
Expected: FAIL — first test passes incorrectly (filter still using `student.grade` which is now 4) and second test fails (current code would find the session via student.grade=4).

- [ ] **Step 4.2: Update `getMonthSessions` filter in `session.service.ts`**

Find the filter clause in `getMonthSessions` (around line 133–151):

```typescript
...(grade || studentName || studentId
  ? {
      sessionStudents: {
        some: {
          student: {
            ...(grade ? { grade } : {}),
            ...(studentId ? { id: studentId } : {}),
            ...(studentName
              ? {
                  fullName: {
                    contains: studentName,
                    mode: "insensitive",
                  },
                }
              : {}),
          },
        },
      },
    }
  : {}),
```

Replace with:

```typescript
...(grade || studentName || studentId
  ? {
      sessionStudents: {
        some: {
          ...(grade ? { grade } : {}),
          ...(studentId || studentName
            ? {
                student: {
                  ...(studentId ? { id: studentId } : {}),
                  ...(studentName
                    ? {
                        fullName: {
                          contains: studentName,
                          mode: "insensitive" as const,
                        },
                      }
                    : {}),
                },
              }
            : {}),
        },
      },
    }
  : {}),
```

This moves `grade` from `student.grade` (current) to `sessionStudent.grade` (snapshot) while keeping `studentName` / `studentId` on the joined `student` relation.

- [ ] **Step 4.3: Update `deriveLevel` and `toDTO` to use snapshot grade for level**

Within `session.service.ts`, find `toDTO` (around line 85) and update where it pulls `grade`:

```typescript
const students = s.sessionStudents?.map((ss) => ({
  id: ss.id,
  studentId: ss.studentId,
  fullName: ss.student?.fullName || "",
  grade: ss.grade,           // ← snapshot grade, not ss.student.grade
  attendance: ss.attendance,
  note: ss.note,
  fee: ss.fee,
})) ?? []
```

This ensures the FE receives the historical grade for each session.

Also check the `getMonthSessions` `include` clause (line 156–159) — even when `includeStudents=false`, the inner select is `{ student: { select: { grade: true } } }`. Change to read snapshot:

```typescript
include: {
  subject: true,
  ...(includeStudents
    ? { sessionStudents: { include: { student: true }, orderBy: { student: { fullName: 'asc' } } } }
    : { sessionStudents: { select: { grade: true } } }   // ← snapshot grade only
  ),
  _count: { select: { sessionStudents: true } },
},
```

Then update `deriveLevel`'s input shape — it currently reads `st.grade` from students after `toDTO`'s mapping, which already returns `ss.grade`. So `deriveLevel` itself doesn't need changes if the data comes from the mapped `students` array. But when `includeStudents=false`, `s.sessionStudents` is just `[{ grade: number }]` — also fine. Verify the function compiles.

- [ ] **Step 4.4: Run the failing test to verify it passes**

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts -t "Historical grade filtering"`
Expected: PASS.

- [ ] **Step 4.5: Update `report.service.ts` historical grade reads**

Open `src/server/services/report.service.ts`. Inspect the lines flagged by grep:
- Line ~78: `sessionStudents: { some: { student: { grade } } }` — switch to `sessionStudents: { some: { grade } }`.
- Line ~98: `s.sessionStudents.some(st => st.student.grade === g)` — change to `s.sessionStudents.some(st => st.grade === g)`.
- Line ~102: `students.filter(s => s.grade === g).length` — this counts **current students by grade** for the summary. This is a current-state view (e.g. "how many active students in grade X right now"). Decide based on intent:
  - If `byGrade.studentCount` should reflect current grade → leave as is.
  - If it should reflect historical (students who attended sessions tagged grade=g) → derive from `sessionStudents` instead.
  - **Per spec, byGrade is a historical summary** → switch to: count distinct studentIds in `sessionStudents` with `grade === g`.

  Replace line ~98–102 with:
  ```typescript
  const gradeSessions = sessions.filter(s => s.sessionStudents.some(st => st.grade === g))
  const gradeStudentIds = new Set<number>()
  for (const s of sessions) {
    for (const st of s.sessionStudents) {
      if (st.grade === g) gradeStudentIds.add(st.studentId)
    }
  }
  return {
    grade: g,
    sessionCount: gradeSessions.length,
    studentCount: gradeStudentIds.size,
  }
  ```
  (Adjust to match the surrounding function's return shape — the engineer should read 20 lines of context before/after.)

- Line ~112: `if (grade && ss.student.grade !== grade) return` — change to `if (grade && ss.grade !== grade) return`.

After these edits, ensure the `select` / `include` for `sessionStudents` brings in `grade` and `studentId`. Adjust the Prisma include accordingly. Run `pnpm exec tsc --noEmit` after each change.

- [ ] **Step 4.6: Update `tuition.service.ts` grade filter**

Open `src/server/services/tuition.service.ts`. Read lines 70–80:

```typescript
const { year, month, grade, search, status, page, limit } = filter
...
where: {
  userId,
  isActive: true,
  ...(grade ? { grade } : {}),
  ...
},
```

The `tuition` service filters students whose **current grade** matches. Per spec, the monthly tuition page should filter by **the grade the student was in during that month** — historical snapshot.

Decision (re-reading spec section 2.3): tuition.getMonthlyStatus filter `grade` → use `sessionStudent.grade` of that month.

Change strategy: filter students by *whether they have any `SessionStudent` record in this month with `grade === input.grade`*. Replace the `where` clause:

```typescript
where: {
  userId,
  ...(grade
    ? {
        sessionStudents: {
          some: {
            grade,
            session: {
              sessionDate: {
                gte: new Date(Date.UTC(year, month - 1, 1)),
                lt: new Date(Date.UTC(year, month, 1)),
              },
            },
          },
        },
      }
    : { isActive: true }),
  ...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),
},
```

Note: when `grade` is set, we drop the `isActive: true` constraint, because a student may have been deactivated (grade-9 → inactive) but still has historical sessions in that month. When `grade` is unset, keep `isActive: true` for current-roster behavior.

- [ ] **Step 4.7: Update the `orderBy` and any row-level grade display**

Line ~80 in `tuition.service.ts`: `orderBy: [{ grade: "asc" }, { fullName: "asc" }]` — this orders by current grade. Keep as-is (orders the current list by current grade — acceptable UX since the UI shows current grade column).

Line ~167 and ~240 — `grade: student.grade` returned in the row DTO. This is the row's `grade` field — used as **current grade**. Per spec table (section 2.3), tuition uses current grade for the column display but historical for the filter. Keep both: column = current, filter = historical.

If the spec was to ALSO show historical grade in the row (e.g. "you taught this student as grade 3 in May"), expand the DTO. The spec doesn't require this — leave row's grade as current.

- [ ] **Step 4.8: TypeScript check + integration tests**

Run: `pnpm exec tsc --noEmit && pnpm dotenv -e .env.test -- vitest run tests/integration`
Expected: all PASS.

If tests fail, read each failure carefully. Likely culprits: missing `grade` in a `select`, or type mismatch in `deriveLevel` / `toDTO`.

- [ ] **Step 4.9: Commit**

```bash
git add src/server/services/session.service.ts src/server/services/report.service.ts src/server/services/tuition.service.ts tests/integration/student-upgrade.test.ts
git commit -m "feat(historical): switch grade filters to use SessionStudent.grade snapshot for past months"
```

---

## Task 5: Lazy auto-trigger inside `auth.me`

**Files:**
- Modify: `src/server/trpc/routers/auth.ts`

- [ ] **Step 5.1: Write failing test for auto-trigger logic (with mocked date)**

Append to `tests/integration/student-upgrade.test.ts`:

```typescript
describe("Lazy auto-upgrade via auth.me", () => {
  beforeEach(async () => {
    await resetUserData("teacher")
    vi.useRealTimers()
  })

  it("auto-runs upgrade when calling auth.me on July 1st and no log exists", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-07-01T00:00:00Z"))

    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "A", grade: 2, tuitionFee: 0, isActive: true })

    await caller.auth.me()

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: user.id, year: 2099 } },
    })
    expect(log).not.toBeNull()
    expect(log?.trigger).toBe("auto")
  })

  it("does NOT auto-run before July (e.g. June)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-06-30T23:59:00Z"))

    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "A", grade: 2, tuitionFee: 0, isActive: true })

    await caller.auth.me()

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: user.id, year: 2099 } },
    })
    expect(log).toBeNull()
  })

  it("does NOT re-run when log already exists", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-07-15T00:00:00Z"))

    const caller = await getAuthedCaller("teacher")
    await caller.student.create({ fullName: "A", grade: 2, tuitionFee: 0, isActive: true })

    await caller.student.upgradeAllClasses()   // manual first
    const studentAfterManual = await db.student.findFirstOrThrow({
      where: { fullName: "A" },
    })

    await caller.auth.me()   // auto attempt — should skip

    const studentAfterAuto = await db.student.findFirstOrThrow({
      where: { fullName: "A" },
    })
    expect(studentAfterAuto.grade).toBe(studentAfterManual.grade) // unchanged

    const user = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const log = await db.classUpgradeLog.findUniqueOrThrow({
      where: { userId_year: { userId: user.id, year: 2099 } },
    })
    expect(log.trigger).toBe("manual")   // log not overwritten
  })
})
```

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts -t "Lazy auto-upgrade"`
Expected: FAIL — `auth.me` doesn't yet trigger upgrade.

- [ ] **Step 5.2: Add lazy auto-trigger to `auth.me`**

Open `src/server/trpc/routers/auth.ts`. Replace the existing `me` procedure (lines 9–15):

```typescript
import { upgradeAllClasses } from "@/server/services/student.service"

// ...

me: protectedProcedure.query(async ({ ctx }) => {
  const user = await ctx.db.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { id: true, username: true, fullName: true },
  })

  // Lazy auto-upgrade: từ tháng 7 trở đi, nếu user chưa có log năm nay → chạy 1 lần.
  // Lỗi auto KHÔNG được chặn login.
  const now = new Date()
  if (now.getMonth() >= 6) {
    const year = now.getFullYear()
    const log = await ctx.db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: ctx.userId, year } },
    })
    if (!log) {
      try {
        await upgradeAllClasses(ctx.db, ctx.userId, "auto")
      } catch (err) {
        console.error("[auto-upgrade] failed:", err)
      }
    }
  }

  return user
}),
```

- [ ] **Step 5.3: Run the auto-trigger tests**

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration/student-upgrade.test.ts -t "Lazy auto-upgrade"`
Expected: 3 tests PASS.

- [ ] **Step 5.4: Run full test suite to catch regressions**

Run: `pnpm dotenv -e .env.test -- vitest run tests/integration`
Expected: all PASS. (Note: any test that calls `auth.me` in July+ might trigger auto-upgrade — verify those tests do their own cleanup or use `vi.setSystemTime` to a non-July date.)

- [ ] **Step 5.5: Commit**

```bash
git add src/server/trpc/routers/auth.ts tests/integration/student-upgrade.test.ts
git commit -m "feat(auth): lazy auto class-upgrade trigger in auth.me from July onward"
```

---

## Task 6: Frontend — `UpgradeAllClassesButton` component

**Files:**
- Create: `src/components/students/UpgradeAllClassesButton.tsx`
- Modify: `src/components/students/StudentList.tsx` (slot the button)
- Modify: `src/language/vi.json`, `src/language/en.json`

- [ ] **Step 6.1: Add i18n keys**

Open `src/language/vi.json`. Locate the `students` section (search for `"students"` near a label like `add_student`). Add the nested object:

```json
"upgrade_all_button": "Nâng lớp hàng loạt",
"upgrade_all_confirm_title": "Nâng lớp toàn bộ học sinh?",
"upgrade_all_confirm_body": "Tất cả học sinh lớp 1–8 sẽ tăng 1 lớp. Học sinh lớp 9 sẽ chuyển sang trạng thái Đã nghỉ (lên lớp 10). Hành động này chỉ chạy 1 lần / năm và không thể hoàn tác.",
"upgrade_all_success": "Đã nâng lớp {upgraded} học sinh, {deactivated} học sinh lớp 9 chuyển sang Đã nghỉ.",
"upgrade_all_already_done": "Đã nâng lớp năm {year}"
```

Place them next to existing student-related keys. Match the project's existing flat-key convention (per `coding-rule.md` section 7, prefer short reusable keys).

Open `src/language/en.json` and add the English equivalents:
```json
"upgrade_all_button": "Bulk grade up",
"upgrade_all_confirm_title": "Upgrade all students?",
"upgrade_all_confirm_body": "All students in grades 1–8 will move up by 1 grade. Grade 9 students will be marked Inactive (moved to grade 10). This action runs only once per year and cannot be undone.",
"upgrade_all_success": "Upgraded {upgraded} students; {deactivated} grade-9 students set to Inactive.",
"upgrade_all_already_done": "Already upgraded for year {year}"
```

- [ ] **Step 6.2: Create the button component**

Create `src/components/students/UpgradeAllClassesButton.tsx`:

```typescript
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowUpCircle, Loader2 } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
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

export function UpgradeAllClassesButton() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)

  const logQuery = trpc.student.getUpgradeLogThisYear.useQuery()
  const alreadyDone = !!logQuery.data
  const currentYear = new Date().getFullYear()

  const mutation = trpc.student.upgradeAllClasses.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("upgrade_all_success")
          .replace("{upgraded}", String(data.upgradedCount))
          .replace("{deactivated}", String(data.deactivatedCount))
      )
      utils.student.list.invalidate()
      utils.student.getUpgradeLogThisYear.invalidate()
      setOpen(false)
    },
    onError: (err) => {
      toast.error(err.message)
      setOpen(false)
    },
  })

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={alreadyDone}
        title={
          alreadyDone
            ? t("upgrade_all_already_done").replace("{year}", String(currentYear))
            : undefined
        }
        className="w-full sm:w-auto"
      >
        <ArrowUpCircle className="size-4 mr-2" />
        {t("upgrade_all_button")}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("upgrade_all_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("upgrade_all_confirm_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                mutation.mutate()
              }}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

**Note:** Verify that i18n keys `cancel` and `confirm` already exist in `vi.json` / `en.json`. If not, add them (`cancel: "Hủy"`, `confirm: "Xác nhận"`).

- [ ] **Step 6.3: Slot the button into `StudentList.tsx`**

Open `src/components/students/StudentList.tsx`. Find the existing toolbar block where `+ Thêm học sinh` button is (around lines 139–148):

```tsx
<div className="sm:ml-auto">
  <Button
    onClick={() => setFormState({ open: true, mode: "create" })}
    className="w-full sm:w-auto"
  >
    <UserPlus className="size-4 mr-2" />
    {t("add_student")}
  </Button>
</div>
```

Replace with a flex container that renders both buttons:

```tsx
<div className="sm:ml-auto flex flex-col sm:flex-row gap-2">
  <UpgradeAllClassesButton />
  <Button
    onClick={() => setFormState({ open: true, mode: "create" })}
    className="w-full sm:w-auto"
  >
    <UserPlus className="size-4 mr-2" />
    {t("add_student")}
  </Button>
</div>
```

Add import at the top of `StudentList.tsx`:

```typescript
import { UpgradeAllClassesButton } from "./UpgradeAllClassesButton"
```

- [ ] **Step 6.4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6.5: Lint check**

Run: `pnpm lint --max-warnings=0`
Expected: 0 warnings, 0 errors. Fix any issues inline (typically unused imports or any-types).

- [ ] **Step 6.6: Manual browser smoke test**

Run: `pnpm dev` (server starts on port 3000).
- Open `http://localhost:3000`.
- Login with `teacher` / `teacher123` (or whatever local seed user).
- Go to `/students`.
- Verify "Nâng lớp hàng loạt" button shows in the toolbar.
- Click it → AlertDialog opens with Vietnamese content.
- Cancel → dialog closes, no DB change.
- Click again → Confirm.
- Verify toast success with counts.
- Verify the grade column for each student reflects +1 (or status badge "Đã nghỉ" for grade 9).
- Click the button again → it should be **disabled** (greyed out) with tooltip "Đã nâng lớp năm {year}".

If any UI bug or layout issue → fix and re-verify before commit.

⚠️ This step USES the database. After verifying, **revert local DB state** if testing against production env. Better: only do this manual test with `.env.local` pointing to test DB. Verify `pnpm dev` loads `.env.local` not `.env`.

- [ ] **Step 6.7: Commit**

```bash
git add src/components/students/UpgradeAllClassesButton.tsx src/components/students/StudentList.tsx src/language/vi.json src/language/en.json
git commit -m "feat(ui): add UpgradeAllClassesButton to /students page"
```

---

## Task 7: E2E test

**Files:**
- Create: `tests/e2e/upgrade-class.spec.ts`

- [ ] **Step 7.1: Write E2E test**

Create `tests/e2e/upgrade-class.spec.ts`:

```typescript
import { test, expect } from "@playwright/test"

test.describe("Class Upgrade flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.fill('[name="username"]', "teacher")
    await page.fill('[name="password"]', "teacher123")
    await page.click('[type="submit"]')
    await page.waitForURL(/\/dashboard|\/calendar|\/students/)
  })

  test("manual upgrade flow", async ({ page }) => {
    await page.goto("/students")

    // Click "Nâng lớp hàng loạt"
    const upgradeBtn = page.getByRole("button", { name: /nâng lớp hàng loạt|bulk grade up/i })
    await expect(upgradeBtn).toBeVisible()

    // If already done this year, skip the click — just verify disabled state
    const disabled = await upgradeBtn.isDisabled()
    if (disabled) {
      test.skip(true, "Already upgraded this year — skipping manual flow")
      return
    }

    await upgradeBtn.click()

    // Confirm dialog
    await expect(page.getByText(/nâng lớp toàn bộ học sinh|upgrade all students/i)).toBeVisible()
    await page.getByRole("button", { name: /xác nhận|confirm/i }).click()

    // Toast appears
    await expect(page.getByText(/đã nâng lớp|upgraded/i)).toBeVisible({ timeout: 5000 })

    // Button now disabled
    await expect(upgradeBtn).toBeDisabled()
  })
})
```

- [ ] **Step 7.2: Run E2E test**

Run: `pnpm test:e2e tests/e2e/upgrade-class.spec.ts`
Expected: 1 test PASS.

⚠️ Playwright config (`playwright.config.ts`) uses `webServer: pnpm dev` and `reuseExistingServer: true`. Ensure dev server runs with test DB env, otherwise this E2E would mutate production data. Recommended: start dev server manually with `pnpm dotenv -e .env.test -- pnpm dev` before running Playwright.

- [ ] **Step 7.3: Commit**

```bash
git add tests/e2e/upgrade-class.spec.ts
git commit -m "test(e2e): add class upgrade flow Playwright spec"
```

---

## Task 8: Final verification

- [ ] **Step 8.1: TypeScript**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8.2: Lint**

Run: `pnpm lint --max-warnings=0`
Expected: 0 warnings, 0 errors.

- [ ] **Step 8.3: Full test suite**

Run: `pnpm dotenv -e .env.test -- pnpm test`
Expected: all unit + integration tests PASS.

- [ ] **Step 8.4: Build**

Run: `pnpm build`
Expected: build succeeds without errors. Prisma migrate deploy may run as part of build — ensure DATABASE_URL points correctly.

- [ ] **Step 8.5: Push branch**

```bash
git push -u origin feat/auto-class-upgrade
```

- [ ] **Step 8.6: Open PR (manual step by user)**

User to open PR from `feat/auto-class-upgrade` → `main` on GitHub. Verify CI passes.

---

## Risk Notes for Reviewer

1. **Migration backfill correctness:** The backfill `UPDATE session_students SET grade = student.grade` runs **once at migration time**. It assumes no class upgrade has ever happened yet in the production DB. Confirmed by checking that `ClassUpgradeLog` is being introduced fresh.

2. **Auto-trigger inside `auth.me`:** Adds a DB write to a frequently-called endpoint. The guard (month check → log lookup → return early if exists) keeps the hot path to 1 indexed `findUnique` for 99.9% of requests. Verify no perf regression.

3. **`auth.me` swallow on error:** Auto-upgrade failures are logged but not thrown. This avoids blocking login. If the operations team needs visibility, they should monitor `console.error` output via Vercel logs.

4. **Tuition `grade` filter dropped `isActive: true`** when filter is set: students deactivated via upgrade (grade 9 → inactive) still appear in historical tuition views. This is intentional per spec.

5. **`pnpm dev` and `.env` precedence:** Make sure `.env.local` (test DB) is loaded before `.env` (production) when running locally. Verify in `package.json` or Next.js config.

6. **Branch policy:** All commits go to `feat/auto-class-upgrade`. Never push directly to `main`. Spec memory `feedback_git_branch_workflow` enforces this.

---

## Self-Review Notes

**Spec coverage check:**
- [x] §1.1 ClassUpgradeLog model — Task 1.
- [x] §1.2 SessionStudent.grade — Task 1.
- [x] §1.3 Migration with backfill — Task 1.
- [x] §2.1 upgradeAllClasses service — Task 2.
- [x] §2.2 populate snapshot on all 7 paths — Task 3.
- [x] §2.3 historical reads switched — Task 4.
- [x] §2.4 lazy auto-trigger in auth.me — Task 5.
- [x] §3.1 tRPC routes — Task 2.4.
- [x] §4.1 UpgradeAllClassesButton — Task 6.
- [x] §4.2 i18n keys — Task 6.1.
- [x] §5 Error matrix — implemented via TRPCError CONFLICT in Task 2.3.
- [x] §6 Tests — Tasks 2 (integration), 7 (e2e).
- [x] §8 Acceptance criteria — Task 8.

**No placeholders.** Every step has a concrete command or code.

**Type consistency:** `upgradeAllClasses` signature matches across service (Task 2.3), router (Task 2.4), and component (Task 6.2). `SessionStudent.grade` is referenced consistently as `Int @db.SmallInt` and read as `number` in TS.
