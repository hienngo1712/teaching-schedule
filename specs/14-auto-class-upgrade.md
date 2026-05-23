# 14 — Auto Class Upgrade (Nâng lớp tự động hàng năm)

## Mục tiêu

Khi hết tháng 6 hàng năm, tự động nâng tất cả học sinh đang active lên 1 lớp. Học sinh lớp 9 được chuyển sang `isActive = false` (lên lớp 10, không dạy nữa). Đồng thời cung cấp nút bấm tay tại trang `/students` để giáo viên chủ động chạy. Mỗi user mỗi năm chỉ được upgrade 1 lần (idempotent).

**Quan trọng — Historical integrity:** Lịch học và báo cáo của các tháng TRƯỚC khi upgrade phải giữ nguyên thông tin lớp tại thời điểm đó. Ví dụ: HS A học lớp 3 từ 12/2025 đến 6/2026, khi sang 7/2026 lên lớp 4 thì các ca dạy / báo cáo / xuất Excel của các tháng cũ vẫn hiển thị HS A là lớp 3. Các năm tiếp theo cũng tương tự — không bao giờ overwrite snapshot lịch sử.

---

## 1. Database Changes

### 1.1. Bảng mới — `ClassUpgradeLog`

Audit log + idempotency guard. Mỗi `(userId, year)` chỉ có duy nhất 1 record.

```prisma
model ClassUpgradeLog {
  id                Int      @id @default(autoincrement())
  userId            Int      @map("user_id")
  user              User     @relation(fields: [userId], references: [id])
  year              Int                                       // Năm thực hiện upgrade (vd 2026 = upgrade T7/2026)
  executedAt        DateTime @default(now()) @map("executed_at")
  trigger           String   @db.VarChar(10)                  // "auto" | "manual"
  upgradedCount     Int      @default(0) @map("upgraded_count")
  deactivatedCount  Int      @default(0) @map("deactivated_count")

  @@unique([userId, year])
  @@index([userId])
  @@map("class_upgrade_logs")
}
```

Thêm relation vào `User`:
```prisma
classUpgradeLogs ClassUpgradeLog[]
```

### 1.2. Sửa bảng `SessionStudent` — thêm field `grade` (snapshot)

Lớp của HS tại thời điểm được gán vào ca dạy. Không bao giờ thay đổi sau khi upgrade.

```prisma
model SessionStudent {
  id         Int     @id @default(autoincrement())
  sessionId  Int     @map("session_id")
  studentId  Int     @map("student_id")
  attendance String  @default("pending") @db.VarChar(10)
  note       String? @db.Text
  fee        Int     @default(0)
  grade      Int     @db.SmallInt                              // ← MỚI

  session TeachingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  student Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([sessionId, studentId])
  @@index([sessionId])
  @@index([studentId])
  @@index([grade])                                             // hỗ trợ filter nhanh
  @@map("session_students")
}
```

### 1.3. Migration

`prisma/migrations/<timestamp>_add_class_upgrade_log_and_session_student_grade/migration.sql`:

```sql
-- 1) ClassUpgradeLog
CREATE TABLE "class_upgrade_logs" (
  "id"                SERIAL PRIMARY KEY,
  "user_id"           INTEGER NOT NULL REFERENCES "users"("id"),
  "year"              INTEGER NOT NULL,
  "executed_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trigger"           VARCHAR(10) NOT NULL,
  "upgraded_count"    INTEGER NOT NULL DEFAULT 0,
  "deactivated_count" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "class_upgrade_logs_user_id_year_key" ON "class_upgrade_logs"("user_id", "year");
CREATE INDEX "class_upgrade_logs_user_id_idx" ON "class_upgrade_logs"("user_id");

-- 2) SessionStudent.grade — nullable trước, backfill, sau đó NOT NULL
ALTER TABLE "session_students" ADD COLUMN "grade" SMALLINT;
UPDATE "session_students" ss
  SET "grade" = s."grade"
  FROM "students" s
  WHERE ss."student_id" = s."id";
ALTER TABLE "session_students" ALTER COLUMN "grade" SET NOT NULL;
CREATE INDEX "session_students_grade_idx" ON "session_students"("grade");
```

Áp dụng cho **cả 2 database**: `.env` (production) và `.env.test` (test branch).

---

## 2. Backend — Service Layer

### 2.1. `src/server/services/student.service.ts`

Hàm mới `upgradeAllClasses`:

```typescript
export async function upgradeAllClasses(
  db: PrismaClient,
  userId: number,
  trigger: "auto" | "manual"
): Promise<{ upgradedCount: number; deactivatedCount: number; year: number }> {
  const year = new Date().getFullYear()

  // 1) Idempotent guard
  const existing = await db.classUpgradeLog.findUnique({
    where: { userId_year: { userId, year } },
  })
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Bạn đã nâng lớp toàn bộ học sinh trong năm ${year} rồi.`,
    })
  }

  // 2) Transaction: upgrade + deactivate + insert log
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
    return { upgradedCount: upgraded.count, deactivatedCount: deactivated.count, year }
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

**Lưu ý quan trọng:** Hàm này **KHÔNG** đụng đến `SessionStudent.grade` — historical snapshot được bảo toàn.

### 2.2. Sửa các service đã có — populate `SessionStudent.grade` khi gán HS

Trong `src/server/services/session.service.ts`, tất cả nơi tạo bản ghi `SessionStudent` phải copy grade hiện tại từ `Student`:

- `createSession` (khi có `studentIds`)
- `addStudentsToSession`
- `bulkCreateSessions` (khi có `studentIds`)
- `addStudentsToRecurringSessions`
- `duplicateSession`

Pattern dùng chung:
```typescript
// Lấy grade hiện tại của các HS đã validate ownership
const studentGrades = await tx.student.findMany({
  where: { id: { in: studentIds }, userId },
  select: { id: true, grade: true },
})
const gradeMap = new Map(studentGrades.map((s) => [s.id, s.grade]))

await tx.sessionStudent.createMany({
  data: studentIds.map((sid) => ({
    sessionId,
    studentId: sid,
    grade: gradeMap.get(sid)!,        // ← snapshot
    fee: gradeMap.has(sid) ? ... : 0,
    attendance: "pending",
  })),
  skipDuplicates: true,
})
```

### 2.3. Đổi nguồn đọc grade — historical views

| File / Function | Đổi từ | Đổi sang |
|---|---|---|
| `session.service.ts → listSessionsForMonth` filter `grade` | `student: { grade: input.grade }` (nested) | `grade: input.grade` (trực tiếp trên `sessionStudent`) |
| `report.service.ts → getStudentReport` | Đọc `student.grade` để hiển thị | Đọc `sessionStudent.grade` của từng ca |
| `report.service.ts → getMonthlySummary` `byGrade` | Group theo `student.grade` | Group theo `sessionStudent.grade` |
| `tuition.service.ts → getMonthlyTuition` filter `grade` | `student: { grade }` | Join qua `sessionStudent.grade` của tháng đó |
| Excel export (`useExcelExport`) | `student.grade` | Đã trả về từ API → dùng field grade của row historical |

**Current-state views (không đổi):**
- `student.service.ts → listStudents` → vẫn `Student.grade`.
- `student.service.ts → getById` → vẫn `Student.grade`.
- Trang `/students` → grade hiện tại.

### 2.4. Hook lazy auto-trigger vào `auth.me`

Trong `src/server/trpc/routers/auth.ts`, procedure `me`:

```typescript
me: protectedProcedure.query(async ({ ctx }) => {
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, username: true, fullName: true },
  })
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" })

  // ── Auto class upgrade check ──
  // Chỉ chạy từ tháng 7 trở đi (đã "hết tháng 6")
  const now = new Date()
  if (now.getMonth() >= 6) {   // getMonth() 0-indexed: tháng 7 = index 6
    const year = now.getFullYear()
    const log = await ctx.db.classUpgradeLog.findUnique({
      where: { userId_year: { userId: ctx.userId, year } },
    })
    if (!log) {
      try {
        await upgradeAllClasses(ctx.db, ctx.userId, "auto")
      } catch (err) {
        // KHÔNG throw — auto upgrade fail không được chặn login.
        console.error("[auto-upgrade] failed:", err)
      }
    }
  }

  return user
})
```

---

## 3. Backend — tRPC Routes

### 3.1. `src/server/trpc/routers/student.ts`

Thêm 2 procedures:

```typescript
upgradeAllClasses: protectedProcedure
  .mutation(({ ctx }) =>
    upgradeAllClasses(ctx.db, ctx.userId, "manual")
  ),

getUpgradeLogThisYear: protectedProcedure
  .query(({ ctx }) =>
    getUpgradeLogThisYear(ctx.db, ctx.userId)
  ),
```

**Schema input:** không cần (procedure không nhận tham số). Output infer qua `RouterOutputs["student"]["upgradeAllClasses"]`.

---

## 4. Frontend

### 4.1. Trang `/students` — Thêm button "Nâng lớp hàng loạt"

**Vị trí:** Trong header của trang `/students`, cùng hàng với `+ Thêm học sinh`.

**Component mới:** `src/components/students/UpgradeAllClassesButton.tsx`

```
Props: (không có)

State:
  - open: boolean (AlertDialog mở/đóng)

Queries:
  - trpc.student.getUpgradeLogThisYear.useQuery()
    → nếu có log → button vẫn hiện nhưng disabled + tooltip "Đã nâng lớp năm {year}"

Mutation:
  - trpc.student.upgradeAllClasses.useMutation()
    onSuccess(data):
      - Toast success: "Đã nâng lớp {data.upgradedCount} học sinh, {data.deactivatedCount} học sinh lớp 9 chuyển sang Đã nghỉ"
      - invalidate student.list + student.getUpgradeLogThisYear
      - đóng dialog
    onError(err):
      - Toast destructive: err.message (chứa "đã nâng lớp ... rồi")

UI:
  Button "outline" size="default" icon ArrowUpCircle
  Label: t("students.upgradeAll.button")  ("Nâng lớp hàng loạt" / "Bulk grade up")

AlertDialog (shadcn):
  Title:  t("students.upgradeAll.confirmTitle")
  Body:   t("students.upgradeAll.confirmBody")
    "Tất cả học sinh lớp 1–8 sẽ tăng 1 lớp. Học sinh lớp 9 sẽ chuyển sang trạng thái Đã nghỉ (lên lớp 10).
     Hành động này chỉ chạy 1 lần / năm và không thể hoàn tác."
  Cancel: t("cancel")
  Action: t("confirm") → mutation.mutate()
          + disabled khi mutation.isPending → show spinner
```

### 4.2. i18n keys

Thêm vào `src/language/vi.json`:
```json
{
  "students": {
    "upgradeAll": {
      "button": "Nâng lớp hàng loạt",
      "confirmTitle": "Nâng lớp toàn bộ học sinh?",
      "confirmBody": "Tất cả học sinh lớp 1–8 sẽ tăng 1 lớp. Học sinh lớp 9 sẽ chuyển sang trạng thái Đã nghỉ (lên lớp 10). Hành động này chỉ chạy 1 lần / năm và không thể hoàn tác.",
      "successToast": "Đã nâng lớp {{upgraded}} học sinh, {{deactivated}} học sinh lớp 9 chuyển sang Đã nghỉ.",
      "alreadyDone": "Đã nâng lớp năm {{year}}"
    }
  }
}
```

Thêm vào `src/language/en.json` (tương ứng): `"Bulk grade up"`, `"Bulk upgrade all students?"`, v.v.

### 4.3. Component types

Dùng `RouterOutputs`:
```typescript
type UpgradeResult = RouterOutputs["student"]["upgradeAllClasses"]
type UpgradeLog    = RouterOutputs["student"]["getUpgradeLogThisYear"]
```

---

## 5. Error Matrix

| Trường hợp | Code | Message (user-facing) |
|---|---|---|
| Đã có log năm nay (manual or auto) | `CONFLICT` | "Bạn đã nâng lớp toàn bộ học sinh trong năm {year} rồi." |
| Chưa login | `UNAUTHORIZED` | (NextAuth redirect) |
| DB transaction failure | propagate | Toast lỗi chung |
| Auto trigger fail (trong `auth.me`) | swallowed | Log console, không chặn login |

---

## 6. Test Plan

### 6.1. Unit tests

Không có schema mới → không cần thêm unit test schema. Có thể thêm test cho helper nếu refactor logic.

### 6.2. Integration tests — `tests/integration/student-upgrade.test.ts`

**Setup mỗi test:** reset DB, seed 1 user, tạo HS các lớp khác nhau.

```
describe("upgradeAllClasses — manual")
  ✓ HS lớp 1–8 active → grade += 1
  ✓ HS lớp 9 active → isActive = false, grade vẫn = 9
  ✓ HS inactive sẵn → KHÔNG đụng (grade và isActive giữ nguyên)
  ✓ Tạo log với trigger="manual", upgradedCount + deactivatedCount đúng
  ✗ Gọi lần 2 cùng năm → CONFLICT, message chứa "đã nâng lớp"
  ✓ Multi-tenant: User A upgrade không ảnh hưởng HS của User B

describe("upgradeAllClasses — auto via auth.me")
  ✓ Tháng 7+ và chưa có log → auto chạy, tạo log trigger="auto"
  ✓ Tháng 5–6 → KHÔNG chạy (chưa hết T6)
  ✓ Đã có log năm nay → KHÔNG chạy lại
  ✓ Auto fail (mock DB error) → auth.me vẫn trả user, không throw

describe("Historical snapshot — SessionStudent.grade")
  Setup: HS A lớp 3, có ca tháng 5/2026 (snapshot=3). Run upgrade.
  ✓ Sau upgrade: Student.grade = 4
  ✓ Sau upgrade: SessionStudent của ca tháng 5/2026 vẫn grade = 3
  ✓ session.getMonth({ year:2026, month:5, grade:3 }) → trả ca có HS A
  ✓ session.getMonth({ year:2026, month:5, grade:4 }) → KHÔNG có HS A
  ✓ Tạo ca MỚI sau upgrade với HS A → SessionStudent.grade = 4 (current)
  ✓ report.monthlySummary({ year:2026, month:5 }).byGrade → đếm HS A vào lớp 3
  ✓ report.student({ studentId: A.id, year:2026, month:5 }) → trả grade=3 cho các ca tháng 5

describe("Multi-year scenario")
  Setup: HS A lớp 3 tháng 5/2026. Upgrade 2026 → lớp 4. Tạo ca tháng 8/2026. Upgrade 2027 → lớp 5.
  ✓ SessionStudent ca tháng 5/2026: grade=3 (vẫn vậy sau 2 lần upgrade)
  ✓ SessionStudent ca tháng 8/2026: grade=4 (vẫn vậy sau upgrade 2027)
  ✓ Student.grade = 5 (current)

describe("getUpgradeLogThisYear")
  ✓ Chưa có log → null
  ✓ Có log → trả record với đúng year, trigger, counts
```

### 6.3. E2E tests — `tests/e2e/upgrade-class.spec.ts`

```
test("Nâng lớp manual flow")
  - Login → vào /students
  - Quan sát grade của 1 HS (vd lớp 3)
  - Click "Nâng lớp hàng loạt" → AlertDialog hiện
  - Click "Xác nhận" → Toast success
  - Bảng cập nhật: HS đó hiện lớp 4
  - Click lần 2 → Toast destructive "đã nâng lớp"

test("Historical view sau upgrade")
  - Tạo HS lớp 3, gán vào ca tháng X (= tháng hiện tại)
  - Chạy upgrade
  - Vào /calendar tháng X, lọc theo lớp 3 → vẫn thấy HS đó
  - Lọc theo lớp 4 → KHÔNG thấy HS đó trong tháng X
  - Tạo ca mới tháng (X+1) với cùng HS → trong /calendar tháng (X+1) lọc lớp 4 → có
```

### 6.4. Manual web test

1. `pnpm db:seed` reset test DB.
2. Tạo 3 HS: lớp 1, lớp 5, lớp 9.
3. Tạo 1 ca tháng hiện tại, gán cả 3 HS.
4. Mở `/students` → bấm "Nâng lớp hàng loạt" → confirm.
5. Verify:
   - HS lớp 1 → lớp 2, HS lớp 5 → lớp 6, HS lớp 9 → ẩn (filter active).
   - Bấm nút lần 2 → Toast lỗi.
   - Mở `/calendar` tháng đó, lọc lớp 1 → vẫn thấy ca (snapshot=1).
   - Lọc lớp 2 → KHÔNG thấy.

---

## 7. Files Modified / Created

**Created:**
- `prisma/migrations/<ts>_add_class_upgrade_log_and_session_student_grade/migration.sql`
- `src/components/students/UpgradeAllClassesButton.tsx`
- `tests/integration/student-upgrade.test.ts`
- `tests/e2e/upgrade-class.spec.ts`

**Modified:**
- `prisma/schema.prisma` — thêm model `ClassUpgradeLog`, thêm field `grade` cho `SessionStudent`, relation `User.classUpgradeLogs`.
- `src/server/services/student.service.ts` — thêm `upgradeAllClasses`, `getUpgradeLogThisYear`.
- `src/server/services/session.service.ts` — populate `SessionStudent.grade` ở mọi nơi tạo bản ghi; đổi filter grade sang `sessionStudent.grade`.
- `src/server/services/report.service.ts` — dùng `sessionStudent.grade` cho historical reports.
- `src/server/services/tuition.service.ts` — filter grade qua `sessionStudent.grade`.
- `src/server/trpc/routers/student.ts` — thêm 2 procedures `upgradeAllClasses`, `getUpgradeLogThisYear`.
- `src/server/trpc/routers/auth.ts` — hook lazy auto-upgrade vào `me`.
- `src/app/(app)/students/page.tsx` — render `UpgradeAllClassesButton`.
- `src/language/vi.json`, `src/language/en.json` — thêm key `students.upgradeAll.*`.

---

## 8. Acceptance Criteria

- [ ] Migration apply thành công cho cả `.env` và `.env.test`.
- [ ] Manual click "Nâng lớp hàng loạt" → HS lớp 1–8 tăng 1 lớp, HS lớp 9 inactive, log tạo với trigger="manual".
- [ ] Click lần 2 cùng năm → Toast destructive, không có thay đổi DB.
- [ ] Lazy auto: chạy `auth.me` ở tháng 7+ không có log → upgrade chạy, log tạo trigger="auto".
- [ ] Lịch tháng cũ + báo cáo cũ giữ nguyên grade snapshot.
- [ ] Multi-tenant isolation đảm bảo (user A không ảnh hưởng user B).
- [ ] `pnpm test` pass tất cả suites.
- [ ] `pnpm build` pass không warning.
- [ ] `pnpm lint --max-warnings=0` pass.
- [ ] Manual test trên `pnpm dev` qua web: pass full flow.

---

## 9. Edge Cases Recap

| Edge Case | Behavior |
|---|---|
| User chưa có HS nào | upgrade chạy với upgradedCount=0, deactivatedCount=0, log vẫn tạo |
| HS inactive | KHÔNG đụng grade và isActive |
| HS đã được manual upgrade trong tháng 4 | Auto check tháng 7 thấy log → skip (đúng yêu cầu plan) |
| Auto upgrade fail (DB lỗi) | `auth.me` vẫn trả user, KHÔNG block login. Log console. |
| Multi-year HS A (3→4→5→...) | Mỗi `SessionStudent.grade` snapshot tại thời điểm gán, không bao giờ overwrite |
| User tạo ca mới sau upgrade | `SessionStudent.grade` = grade hiện tại (đã tăng) |
| HS được xóa rồi tạo lại (mới id) | Không liên quan; mỗi `SessionStudent` independent |
| Upgrade chạy đúng ngày 30/6 → 1/7 | Logic dùng `getMonth() >= 6` → chạy từ tháng 7. Manual có thể chạy bất kỳ lúc nào (vd tháng 6) — vẫn idempotent. |

---

## 10. Developer Workflow (nội bộ — không xuất hiện trong UI)

> **Branch policy:** Khi implement spec này, developer **BẮT BUỘC** checkout sang nhánh mới (vd `feat/auto-class-upgrade`). Không commit trực tiếp lên `main`. Đây là quy ước nội bộ cho dev — KHÔNG xuất hiện trong toast / error message / UI bất kỳ.

> **Migration safety:** Trước khi chạy migration trên `.env` (production), backup DB. Migration backfill `SessionStudent.grade` từ `Student.grade` chỉ chính xác khi chưa từng upgrade lần nào — phù hợp với trạng thái hiện tại.

---

## 11. Out of Scope (YAGNI)

- Cron job Vercel (đã thay bằng lazy auto-trigger).
- UI hiển thị history các năm upgrade (chỉ cần check log năm hiện tại).
- Undo / rollback upgrade (theo plan: "không thể hoàn tác").
- Manual upgrade từng HS riêng lẻ (đã có chức năng edit grade thông thường).
- Email/notification sau upgrade.
