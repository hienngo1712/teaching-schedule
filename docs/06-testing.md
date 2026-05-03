# 06 — Testing Strategy

## Tổng quan 3 tầng test

```
Unit tests        → Vitest, không cần DB, chạy < 5 giây
Integration tests → Vitest + DB Neon thật (branch test), chạy ~30 giây
E2E tests         → Playwright, chạy browser thật, ~2–5 phút
```

---

## Config

### `vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/lib/**", "src/hooks/**"],
      thresholds: { lines: 70, functions: 70 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
```

### `playwright.config.ts`
```typescript
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
### `tests/setup.ts`
```typescript
import { config } from "dotenv"
import { existsSync } from "node:fs"

// ⚠️ QUAN TRỌNG: Tách biệt database test và production
// 1. Luôn dùng file .env.test cho testing
// 2. Không bao giờ trỏ .env.test tới database production
// 3. Nếu dùng Neon, hãy tạo một branch riêng (ví dụ: 'test')

const testEnvPath = join(process.cwd(), ".env.test")
if (existsSync(testEnvPath)) {
  config({ path: ".env.test" })
} else {
  // Logic ngăn chặn xóa nhầm dữ liệu production
}
```

---

## Tách biệt Database (Isolation)

Để tránh việc chạy test làm mất dữ liệu thật (do lệnh `deleteMany()` trong `setup.ts`), bạn **bắt buộc** phải thực hiện các bước sau:

### 1. Tạo Database cho Test
- **Cách A (Khuyên dùng):** Nếu dùng Neon, truy cập Dashboard → Branches → New Branch → Đặt tên là `test`. Copy `DATABASE_URL` của branch này.
- **Cách B (Local):** Dùng Docker hoặc cài đặt PostgreSQL local, tạo DB tên `teaching_schedule_test`.

### 2. Tạo file `.env.test`
Copy từ `.env.test.example` và dán URL database test vào:
```bash
DATABASE_URL="postgresql://...neon.tech/neondb_test?sslmode=require"
DIRECT_URL="postgresql://...neon.tech/neondb_test?sslmode=require"
```

### 3. Quy trình chạy
Khi bạn chạy `pnpm test`, Vitest sẽ tự động ưu tiên load biến môi trường từ `.env.test`. Nếu file này không tồn tại và bạn đang trỏ tới Neon trong `.env`, hệ thống sẽ chặn không cho chạy test để bảo vệ dữ liệu.

---

## Unit Tests
### `tests/helpers/trpc.ts`
```typescript
import { appRouter } from "@/server/trpc/root"
import { createCallerFactory } from "@/server/trpc"
import { db } from "@/server/db"

const createCaller = createCallerFactory(appRouter)

// Caller với session hợp lệ
export async function getAuthedCaller() {
  const user = await db.user.findFirst({ where: { username: "teacher" } })
  return createCaller({
    db,
    session: {
      user: { id: String(user!.id), name: user!.fullName, email: null },
      expires: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    },
  })
}

// Caller không có session
export const publicCaller = createCaller({ db, session: null })
```

---

## Unit Tests

### `tests/unit/utils/utils.test.ts`
```typescript
describe("getLevel", () => {
  it("lớp 1–5 → tieu_hoc", () => {
    expect(getLevel(1)).toBe("tieu_hoc")
    expect(getLevel(5)).toBe("tieu_hoc")
  })
  it("lớp 6–9 → thcs", () => {
    expect(getLevel(6)).toBe("thcs")
    expect(getLevel(9)).toBe("thcs")
  })
})

describe("calcAttendanceRate", () => {
  it("2 present / 3 total → 66.67", () => {
    expect(calcAttendanceRate(2, 3)).toBeCloseTo(66.67)
  })
  it("0 / 0 → 0 (không chia cho 0)", () => {
    expect(calcAttendanceRate(0, 0)).toBe(0)
  })
})

describe("isTimeAfter", () => {
  it("09:30 > 08:00 → true", () => expect(isTimeAfter("09:30", "08:00")).toBe(true))
  it("08:00 > 09:30 → false", () => expect(isTimeAfter("08:00", "09:30")).toBe(false))
  it("08:00 = 08:00 → false", () => expect(isTimeAfter("08:00", "08:00")).toBe(false))
})
```

### `tests/unit/schemas/student.schema.test.ts`
```typescript
describe("studentCreateSchema", () => {
  it("✓ accept valid data", () => {
    expect(() => studentCreateSchema.parse({
      fullName: "Nguyễn Văn An", grade: 3
    })).not.toThrow()
  })
  it("✗ reject empty fullName", () => {
    expect(() => studentCreateSchema.parse({ fullName: "", grade: 3 })).toThrow()
  })
  it("✗ reject grade = 0", () => {
    expect(() => studentCreateSchema.parse({ fullName: "An", grade: 0 })).toThrow()
  })
  it("✗ reject grade = 10", () => {
    expect(() => studentCreateSchema.parse({ fullName: "An", grade: 10 })).toThrow()
  })
  it("✓ accept valid VN phone", () => {
    expect(() => studentCreateSchema.parse({
      fullName: "An", grade: 3, parentPhone: "0901234567"
    })).not.toThrow()
  })
  it("✓ trim whitespace on fullName", () => {
    const result = studentCreateSchema.parse({ fullName: "  An  ", grade: 3 })
    expect(result.fullName).toBe("An")
  })
})
```

### `tests/unit/schemas/session.schema.test.ts`
```typescript
describe("sessionCreateSchema", () => {
  it("✓ accept valid session với subjectId", () => {
    expect(() => sessionCreateSchema.parse({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId: 1
    })).not.toThrow()
  })
  it("✗ reject endTime <= startTime", () => {
    expect(() => sessionCreateSchema.parse({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "07:30", subjectId: 1
    })).toThrow()
  })
  it("✗ reject equal times (08:00–08:00)", () => {
    expect(() => sessionCreateSchema.parse({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "08:00", subjectId: 1
    })).toThrow()
  })
  it("✗ reject thiếu subjectId", () => {
    expect(() => sessionCreateSchema.parse({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30"
    })).toThrow()
  })
  it("✓ accept optional studentIds", () => {
    expect(() => sessionCreateSchema.parse({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30",
      subjectId: 1, studentIds: [1, 2, 3]
    })).not.toThrow()
  })
})
```

### `tests/unit/schemas/subject.schema.test.ts` ← MỚI
```typescript
describe("subjectCreateSchema", () => {
  it("✓ accept { name: 'Tiếng Anh', color: '#4F46E5' }", () => { ... })
  it("✗ reject name rỗng", () => { ... })
  it("✗ reject color không phải hex 6 ký tự", () => {
    expect(() => subjectCreateSchema.parse({ name: "Toán", color: "blue" })).toThrow()
    expect(() => subjectCreateSchema.parse({ name: "Toán", color: "#FFF" })).toThrow()
  })
  it("✓ accept color default khi không truyền", () => {
    const result = subjectCreateSchema.parse({ name: "Toán" })
    expect(result.color).toBe("#4F46E5")
  })
})
```

### `tests/unit/utils/time.test.ts` ← MỚI
```typescript
describe("Time helpers", () => {
  describe("parseTimeToDate", () => {
    it("'08:00' → Date với UTC hours=8, minutes=0", () => {
      const d = parseTimeToDate("08:00")
      expect(d.getUTCHours()).toBe(8)
      expect(d.getUTCMinutes()).toBe(0)
    })
    it("'14:30' → Date với UTC hours=14, minutes=30", () => {
      const d = parseTimeToDate("14:30")
      expect(d.getUTCHours()).toBe(14)
      expect(d.getUTCMinutes()).toBe(30)
    })
  })

  describe("formatTime", () => {
    it("Date(08:00 UTC) → '08:00'", () => {
      const d = new Date(0)
      d.setUTCHours(8, 0, 0, 0)
      expect(formatTime(d)).toBe("08:00")
    })
    it("roundtrip: parseTimeToDate → formatTime → '14:30'", () => {
      expect(formatTime(parseTimeToDate("14:30"))).toBe("14:30")
    })
  })

  describe("calcDurationMinutes", () => {
    it("08:00 → 09:30 = 90 phút", () => {
      expect(calcDurationMinutes(parseTimeToDate("08:00"), parseTimeToDate("09:30"))).toBe(90)
    })
    it("14:00 → 15:00 = 60 phút", () => {
      expect(calcDurationMinutes(parseTimeToDate("14:00"), parseTimeToDate("15:00"))).toBe(60)
    })
    it("08:00 → 08:45 = 45 phút", () => {
      expect(calcDurationMinutes(parseTimeToDate("08:00"), parseTimeToDate("08:45"))).toBe(45)
    })
  })

  describe("formatDuration", () => {
    it("45 → '45 phút'", () => expect(formatDuration(45)).toBe("45 phút"))
    it("60 → '1h'",      () => expect(formatDuration(60)).toBe("1h"))
    it("90 → '1h 30p'",  () => expect(formatDuration(90)).toBe("1h 30p"))
    it("120 → '2h'",     () => expect(formatDuration(120)).toBe("2h"))
  })
})
```

### `tests/unit/hooks/useCalendar.test.ts`
```typescript
describe("useCalendar grid", () => {
  it("Tháng 4/2026 bắt đầu T4 → 2 ô trống đầu (T2, T3)", () => {
    const { grid } = buildCalendarGrid(2026, 4, [])
    expect(grid[0].isCurrentMonth).toBe(false) // T2
    expect(grid[1].isCurrentMonth).toBe(false) // T3
    expect(grid[2].dayNumber).toBe(1)           // T4 = ngày 1
  })
  it("Tháng 4 có đúng 30 ngày", () => {
    const { grid } = buildCalendarGrid(2026, 4, [])
    const currentMonth = grid.filter(c => c.isCurrentMonth)
    expect(currentMonth).toHaveLength(30)
  })
  it("prevMonth từ 1/2026 → 12/2025", () => {
    // test logic thuần
  })
  it("monthLabel đúng format", () => {
    expect(buildMonthLabel(2026, 4)).toBe("Tháng 4 / 2026")
  })
  it("daysOfWeek đúng thứ tự T2–CN", () => {
    expect(DAY_NAMES).toEqual(["T2","T3","T4","T5","T6","T7","CN"])
  })
})
```

### `tests/unit/hooks/useFilters.test.ts`
```typescript
describe("useFilters", () => {
  it("initial state: tất cả null/empty", () => { ... })
  it("set grade → filterParams có grade", () => { ... })
  it("resetFilters → tất cả về null", () => { ... })
  it("hasActiveFilter: true khi có grade", () => { ... })
  it("hasActiveFilter: true khi có searchStudentName", () => { ... })
  it("hasActiveFilter: false khi tất cả empty", () => { ... })
})
```

---

## Integration Tests

### `tests/integration/auth.test.ts`
```typescript
describe("Auth", () => {
  it("✓ Login thành công → ghi LoginAttempt success=true", async () => { ... })
  it("✗ Login sai password → ghi LoginAttempt success=false", async () => { ... })
  it("✗ Login username không tồn tại → lỗi (không lộ user có tồn tại không)", async () => { ... })
  it("✓ auth.me → trả user info", async () => { ... })
  it("✗ auth.me không session → UNAUTHORIZED", async () => { ... })
  it("✓ auth.changePassword đúng → đổi thành công", async () => { ... })
  it("✗ auth.changePassword sai current → BAD_REQUEST", async () => { ... })

  // Rate limit
  it("✗ 5 lần sai liên tiếp → lần 6 bị block dù đúng password", async () => {
    // Ghi 5 LoginAttempt thất bại trong 15 phút gần nhất
    // Thử login lần 6 → expect RATE_LIMITED error
  })
  it("✓ Sau 15 phút → rate limit reset, login được", async () => { ... })
})
```

### `tests/integration/multi-tenant.test.ts` ← MỚI — BẮT BUỘC
```typescript
// Setup: 2 users riêng biệt (userA và userB)
// Mục đích: đảm bảo dữ liệu HOÀN TOÀN tách biệt

describe("Multi-tenant isolation", () => {
  let callerA: AppCaller
  let callerB: AppCaller
  let studentA: Student
  let sessionA: TeachingSession

  beforeAll(async () => {
    callerA = await getAuthedCallerForUser("userA")
    callerB = await getAuthedCallerForUser("userB")

    // UserA tạo dữ liệu
    studentA = await callerA.student.create({ fullName: "HS của A", grade: 3 })
    sessionA = await callerA.session.create({
      sessionDate: "2026-05-01", startTime: "08:00", endTime: "09:30",
      subjectId: (await callerA.subject.list({}))[0].id
    })
  })

  // ── Student isolation ─────────────────────────────────────────
  it("UserB không thấy student của UserA", async () => {
    const students = await callerB.student.list({})
    const ids = students.map(s => s.id)
    expect(ids).not.toContain(studentA.id)
  })

  it("UserB không thể update student của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.student.update({ id: studentA.id, data: { fullName: "Hack" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("UserB không thể xóa student của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.student.delete({ id: studentA.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Session isolation ─────────────────────────────────────────
  it("UserB không thấy session của UserA trong getMonth", async () => {
    const sessions = await callerB.session.getMonth({ year: 2026, month: 5 })
    const ids = sessions.map(s => s.id)
    expect(ids).not.toContain(sessionA.id)
  })

  it("UserB không thể update session của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.session.update({ id: sessionA.id, data: { title: "Hack" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("UserB không thể thêm student của UserA vào session của UserB → NOT_FOUND", async () => {
    const mySession = await callerB.session.create({
      sessionDate: "2026-05-02", startTime: "08:00", endTime: "09:30",
      subjectId: (await callerB.subject.list({}))[0].id
    })
    // studentA thuộc userA → userB không được dùng
    await expect(
      callerB.session.addStudents({ sessionId: mySession.id, studentIds: [studentA.id] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Subject isolation ─────────────────────────────────────────
  it("UserB không thấy subject của UserA", async () => {
    const subjectsA = await callerA.subject.list({})
    const subjectsB = await callerB.subject.list({})
    const idsA = subjectsA.map(s => s.id)
    const idsB = subjectsB.map(s => s.id)
    expect(idsA.some(id => idsB.includes(id))).toBe(false)
  })

  it("UserB không thể update subject của UserA → NOT_FOUND", async () => {
    const subjectA = (await callerA.subject.list({}))[0]
    await expect(
      callerB.subject.update({ id: subjectA.id, data: { name: "Hack" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Attendance isolation ──────────────────────────────────────
  it("UserB không thể lấy attendance của session UserA → NOT_FOUND", async () => {
    await expect(
      callerB.attendance.get({ sessionId: sessionA.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("UserB không thể update attendance của session UserA → NOT_FOUND", async () => {
    await expect(
      callerB.attendance.update({ sessionId: sessionA.id, attendances: [] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // ── Report isolation ──────────────────────────────────────────
  it("UserB không thể xem report student của UserA → NOT_FOUND", async () => {
    await expect(
      callerB.report.student({ studentId: studentA.id, period: "month", year: 2026, month: 5 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("report.monthlySummary chỉ trả data của user đó", async () => {
    const summaryA = await callerA.report.monthlySummary({ year: 2026, month: 5 })
    const summaryB = await callerB.report.monthlySummary({ year: 2026, month: 5 })
    // UserB chưa có session tháng 5 → total = 0
    expect(summaryB.totalSessions).toBe(0)
    // UserA có → total > 0
    expect(summaryA.totalSessions).toBeGreaterThan(0)
  })
})

### `tests/integration/student.test.ts`
```typescript
describe("Student CRUD", () => {
  it("✓ create → trả đầy đủ fields + level đúng", async () => {
    const caller = await getAuthedCaller()
    const student = await caller.student.create({ fullName: "Nguyễn An", grade: 3 })
    expect(student.grade).toBe(3)
    expect(student.level).toBe("tieu_hoc")
    expect(student.isActive).toBe(true)
  })
  it("✓ create grade=7 → level = thcs", async () => { ... })
  it("✓ list → trả tất cả HS active", async () => { ... })
  it("✓ list { grade: 3 } → chỉ trả HS lớp 3", async () => { ... })
  it("✓ list { search: 'nguyễn' } → tìm không phân biệt hoa/thường", async () => { ... })
  it("✓ update → cập nhật đúng fields, updatedAt thay đổi", async () => { ... })
  it("✓ delete → set isActive=false, KHÔNG xóa khỏi DB", async () => { ... })
  it("✓ delete → HS đã xóa không hiện trong list mặc định", async () => { ... })
  it("✗ create thiếu fullName → throw validation error", async () => { ... })
  it("✗ update id không tồn tại → throw NOT_FOUND", async () => { ... })
  it("✗ tất cả procedures không có session → UNAUTHORIZED", async () => { ... })
})
```

### `tests/integration/subject.test.ts` ← MỚI
```typescript
describe("Subject CRUD", () => {
  it("✓ list → trả subjects từ seed (≥1)", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    expect(subjects.length).toBeGreaterThanOrEqual(1)
    expect(subjects[0]).toHaveProperty("name")
    expect(subjects[0]).toHaveProperty("color")
  })
  it("✓ list → sort theo sortOrder ASC", async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const orders = subjects.map(s => s.sortOrder)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })
  it("✓ create → trả subject mới", async () => { ... })
  it("✓ create isDefault=true → subject khác set isDefault=false", async () => { ... })
  it("✗ create name trùng → throw BAD_REQUEST", async () => { ... })
  it("✓ update name + color", async () => { ... })
  it("✓ delete (soft) → không hiện trong list active", async () => { ... })
  it("✗ delete subject đang được dùng bởi session → throw BAD_REQUEST", async () => { ... })
})
```

### `tests/integration/session.test.ts`
```typescript
describe("Session CRUD", () => {
  // Setup: cần subjectId hợp lệ từ seed
  let subjectId: number

  beforeAll(async () => {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    subjectId = subjects[0].id
  })

  it("✓ create → trả id + fields đúng + subject included", async () => {
    const caller = await getAuthedCaller()
    const session = await caller.session.create({
      sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30", subjectId
    })
    expect(session.startTime).toBe("08:00")   // đã format từ Date → string
    expect(session.endTime).toBe("09:30")
    expect(session.durationMins).toBe(90)
    expect(session.subject.id).toBe(subjectId)
  })
  it("✓ create với studentIds → tạo ca + gán HS", async () => { ... })
  it("✓ getMonth → trả kèm subject (eager load)", async () => { ... })
  it("✓ getMonth → startTime/endTime format là 'HH:mm'", async () => { ... })
  it("✓ getMonth(2026, 4) → trả tất cả ca trong tháng 4", async () => { ... })
  it("✓ getMonth { grade: 3 } → chỉ trả ca có HS lớp 3", async () => { ... })
  it("✓ getMonth tháng không có ca → trả []", async () => { ... })
  it("✓ update → cập nhật title, notes", async () => { ... })
  it("✓ delete → xóa ca + cascade xóa session_students", async () => { ... })
  it("✓ delete → HS vẫn còn trong bảng students", async () => { ... })

  // ── Overlap Detection ─────────────────────────────────────────
  it("✗ create trùng giờ hoàn toàn → throw CONFLICT", async () => {
    const caller = await getAuthedCaller()
    // Ca 1: 08:00–09:30
    await caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId
    })
    // Ca 2: cùng giờ → CONFLICT
    await expect(caller.session.create({
      sessionDate: "2026-05-10", startTime: "08:00", endTime: "09:30", subjectId
    })).rejects.toThrow("CONFLICT")
  })
  it("✗ create trùng giờ một phần (08:30–10:00 vs 08:00–09:30) → throw CONFLICT", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-05-11", startTime: "08:00", endTime: "09:30", subjectId
    })
    await expect(caller.session.create({
      sessionDate: "2026-05-11", startTime: "08:30", endTime: "10:00", subjectId
    })).rejects.toThrow("CONFLICT")
  })
  it("✓ create tiếp ngay sau (09:30–11:00 vs 08:00–09:30) → KHÔNG conflict", async () => {
    const caller = await getAuthedCaller()
    await caller.session.create({
      sessionDate: "2026-05-12", startTime: "08:00", endTime: "09:30", subjectId
    })
    await expect(caller.session.create({
      sessionDate: "2026-05-12", startTime: "09:30", endTime: "11:00", subjectId
    })).resolves.toBeDefined()
  })
  it("✓ create cùng giờ nhưng khác ngày → KHÔNG conflict", async () => { ... })
  it("✓ update giờ không trùng → OK", async () => { ... })
  it("✗ update giờ trùng với ca khác → throw CONFLICT", async () => { ... })
  it("✓ update chính ca đó (không đổi giờ) → KHÔNG tự conflict", async () => { ... })

  // ── bulkCreate ────────────────────────────────────────────────
  it("✓ bulkCreate weekdays=[1,3,5] → tạo đúng số ca T2,T4,T6", async () => { ... })
  it("✓ bulkCreate với studentIds → tất cả ca đều có HS", async () => { ... })
  it("✓ bulkCreate bỏ qua ngày bị trùng giờ → trả { created, skipped }", async () => {
    // Tạo sẵn 1 ca T2 trùng giờ → bulkCreate phải bỏ qua ngày đó
    // created + skipped = tổng ngày T2 trong range
  })
  it("✓ bulkCreate khoảng 0 ngày → { created: 0, skipped: 0 }", async () => { ... })

  // ── duplicate ─────────────────────────────────────────────────
  it("✓ duplicate → ca mới + cùng HS + attendance reset pending", async () => { ... })
  it("✗ duplicate vào ngày trùng giờ → throw CONFLICT", async () => { ... })

  it("✓ addStudents → attendance default pending", async () => { ... })
  it("✓ addStudents duplicate → không tạo bản ghi trùng", async () => { ... })
  it("✓ removeStudent → xóa đúng liên kết", async () => { ... })
})
```

### `tests/integration/attendance.test.ts`
```typescript
describe("Attendance", () => {
  it("✓ update → cập nhật present/absent/late", async () => { ... })
  it("✓ update partial → chỉ cập nhật HS trong payload", async () => { ... })
  it("✓ get → trả danh sách HS + attendance + note", async () => { ... })
  it("✓ get ca chưa gán HS → trả []", async () => { ... })
  it("✓ note được lưu đúng", async () => { ... })
  it("✓ xóa HS (soft) → vẫn giữ attendance records cũ", async () => { ... })
})
```

### `tests/integration/report.test.ts`
```typescript
describe("Reports", () => {
  it("✓ report.student → trả sessions + summary đúng", async () => { ... })
  it("✓ summary: total, present, absent, late, rate tính đúng", async () => {
    // Setup: 1 HS, 4 sessions: 2 present, 1 absent, 1 pending
    // attendanceRate = 2 / (4-1) * 100 = 66.67% (loại pending)
  })
  it("✓ report.student HS chưa có buổi → summary all zeros", async () => { ... })
  it("✓ report.grade → trả tất cả HS + sessions tháng đó", async () => { ... })
  it("✓ report.monthlySummary → trả tổng hợp by grade", async () => { ... })
  it("✓ report.monthlySummary tháng trống → all zeros", async () => { ... })
})
```

---

## E2E Tests (Playwright)

### `tests/e2e/auth.spec.ts`
```typescript
test("redirect /login khi chưa đăng nhập", async ({ page }) => {
  await page.goto("/calendar")
  await expect(page).toHaveURL("/login")
})
test("login thành công → redirect /calendar", async ({ page }) => {
  await page.goto("/login")
  await page.fill('[name="username"]', "teacher")
  await page.fill('[name="password"]', "teacher123")
  await page.click('[type="submit"]')
  await expect(page).toHaveURL("/calendar")
})
test("login thất bại → hiện thông báo lỗi", async ({ page }) => { ... })
test("logout → redirect /login", async ({ page }) => { ... })
```

### `tests/e2e/students.spec.ts`
```typescript
test("thêm HS → hiện trong bảng", async ({ page }) => { ... })
test("sửa HS → giá trị cập nhật trong bảng", async ({ page }) => { ... })
test("xóa HS → biến mất khỏi bảng (confirm dialog)", async ({ page }) => { ... })
test("lọc theo lớp → đúng kết quả", async ({ page }) => { ... })
test("search tên → đúng kết quả", async ({ page }) => { ... })
```

### `tests/e2e/calendar.spec.ts`
```typescript
test("hiển thị tháng hiện tại", async ({ page }) => { ... })
test("navigate tháng trước → label cập nhật", async ({ page }) => { ... })
test("tạo ca → card hiện đúng ô ngày", async ({ page }) => { ... })
test("click card → mở detail dialog", async ({ page }) => { ... })
test("sửa ca → card cập nhật", async ({ page }) => { ... })
test("xóa ca → card biến mất", async ({ page }) => { ... })
```

### `tests/e2e/attendance.spec.ts`
```typescript
test("gán HS vào ca → hiện trong detail dialog", async ({ page }) => { ... })
test("điểm danh → lưu → mở lại → trạng thái đúng", async ({ page }) => { ... })
test("quick-all Có mặt → tất cả chuyển present", async ({ page }) => { ... })
```

### `tests/e2e/export.spec.ts`
```typescript
test("chụp PNG → file downloaded", async ({ page }) => {
  // Setup filter 1 HS, check download event
  const downloadPromise = page.waitForEvent("download")
  await page.click('[data-testid="btn-capture-png"]')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain(".png")
})
test("xuất Excel → file downloaded", async ({ page }) => { ... })
test("ReportsView hiển thị đúng số liệu", async ({ page }) => { ... })
```

---

## Khi nào chạy test gì

```
SAU MỖI SUB-PHASE:
  pnpm test:unit          → nhanh < 5s
  pnpm test:integration   → nếu có tRPC/DB code
  Test thủ công browser   → nếu có UI code

SAU MỖI PHASE (trước push):
  pnpm test               → unit + integration
  pnpm build              → TypeScript + build check
  Push → verify Vercel URL

PHASE 8 (final):
  pnpm test:all           → unit + integration + E2E
  Final Acceptance Checklist (xem docs/08-review.md)
```

---

## Test data conventions

```typescript
// Dùng consistent test data để dễ debug:
const TEST_STUDENT = {
  tieuHoc: { fullName: "Nguyễn Văn An", grade: 3 },   // tieu_hoc
  thcs:    { fullName: "Trần Thị Bình", grade: 7 },   // thcs
}

const TEST_SESSION = {
  morning: { sessionDate: "2026-04-10", startTime: "08:00", endTime: "09:30" },
  afternoon: { sessionDate: "2026-04-10", startTime: "14:00", endTime: "15:30" },
}

// Reset DB trước mỗi test suite (trong setup.ts)
// KHÔNG dùng mock DB cho integration tests → test với DB thật
```
