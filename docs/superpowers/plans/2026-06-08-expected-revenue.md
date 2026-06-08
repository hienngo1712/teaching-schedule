# Expected Revenue Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trường `expectedRevenue` (tổng fee của TẤT CẢ sessionStudent, bất kể điểm danh hay status) và hiển thị song song với doanh thu thực tế trên Dashboard, Reports, và báo cáo từng học sinh; đồng thời sửa naming bug trên trang Reports (card đang nhãn sai).

**Architecture:** Toàn bộ dữ liệu đã có trong DB — chỉ cần bỏ điều kiện lọc attendance trong vòng loop tính fee. Thêm field mới vào return type của 3 hàm service, pass-through lên tRPC router (TypeScript tự infer), cập nhật UI. Không có DB migration.

**Tech Stack:** Next.js 14 App Router · TypeScript · tRPC v11 · Prisma · Vitest (integration tests) · Tailwind CSS · shadcn/ui

---

## File Map

| File | Loại thay đổi |
|---|---|
| `src/server/services/report.service.ts` | Modify — thêm `expectedRevenue` vào 3 hàm |
| `tests/integration/report.test.ts` | Modify — thêm 2 test case mới |
| `src/language/vi.json` | Modify — thêm key `actual_revenue` |
| `src/language/en.json` | Modify — thêm key `actual_revenue` |
| `src/app/(app)/reports/page.tsx` | Modify — sửa naming bug + thêm card 6 |
| `src/app/(app)/dashboard/page.tsx` | Modify — thêm StatCard `expectedRevenueMonth` |
| `src/components/students/StudentScheduleView.tsx` | Modify — thêm `expectedFee` vào summary |

---

## Task 1: Viết failing tests cho `expectedRevenue`

**Files:**
- Modify: `tests/integration/report.test.ts`

- [ ] **Step 1.1: Thêm 2 test case vào cuối describe block**

Mở `tests/integration/report.test.ts`. Thêm 2 test cases **trước dấu đóng `})` cuối cùng** của `describe("Report Router", ...)` (trước dòng 96):

```typescript
  it("report.student → summary.expectedRevenue tính tổng tất cả fee không lọc attendance", async () => {
    // Tạo student mới với tuitionFee cụ thể để tránh ảnh hưởng test khác
    const studentFee = await caller.student.create({
      fullName: "HS Fee Kỳ Vọng",
      grade: 7,
      tuitionFee: 50000,
    })

    // Tạo session 1
    const sess1 = await caller.session.create({
      sessionDate: "2026-05-15",
      startTime: "14:00",
      endTime: "15:30",
      subjectId: subject.id,
      studentIds: [studentFee.id],
    })

    // Tạo session 2
    const sess2 = await caller.session.create({
      sessionDate: "2026-05-17",
      startTime: "14:00",
      endTime: "15:30",
      subjectId: subject.id,
      studentIds: [studentFee.id],
    })

    // Điểm danh: session 1 = present, session 2 = absent
    await caller.attendance.update({
      sessionId: sess1.id,
      attendances: [{ studentId: studentFee.id, attendance: "present" }],
    })
    await caller.attendance.update({
      sessionId: sess2.id,
      attendances: [{ studentId: studentFee.id, attendance: "absent" }],
    })

    const report = await caller.report.student({
      studentId: studentFee.id,
      year: 2026,
      month: 5,
    })

    // actualRevenue: chỉ present → 50000
    expect(report.summary.totalRevenue).toBe(50000)
    // expectedRevenue: cả 2 buổi → 100000
    expect(report.summary.expectedRevenue).toBe(100000)
  })

  it("report.monthlySummary → expectedRevenue >= totalRevenue khi có học sinh vắng", async () => {
    // Dùng grade: 7 để isolate với data của test trên
    const summary = await caller.report.monthlySummary({
      year: 2026,
      month: 5,
      grade: 7,
    })

    // expectedRevenue phải >= totalRevenue (vì có học sinh absent)
    expect(summary.expectedRevenue).toBeGreaterThanOrEqual(summary.totalRevenue)
    // expectedRevenue phải > totalRevenue vì có 1 buổi absent
    expect(summary.expectedRevenue).toBeGreaterThan(summary.totalRevenue)
    // Cụ thể: 2 session × 50000 = 100000
    expect(summary.expectedRevenue).toBe(100000)
    // Actual: chỉ 1 present × 50000 = 50000
    expect(summary.totalRevenue).toBe(50000)
  })
```

**Lưu ý:** `session.create` trả về object với `id` (standard tRPC). Nếu test báo `sess1.id undefined`, kiểm tra lại tên field trả về từ router.

- [ ] **Step 1.2: Chạy tests để xác nhận FAIL**

```bash
pnpm test:integration tests/integration/report.test.ts
```

Expected output: 2 test mới FAIL với lỗi kiểu `TypeError: Cannot read properties of undefined (reading 'expectedRevenue')` hoặc `expect(received).toBe(expected)` — confirm rằng field chưa tồn tại.

- [ ] **Step 1.3: Commit tests (chưa pass)**

```bash
git add tests/integration/report.test.ts
git commit -m "test(report): add failing tests for expectedRevenue field"
```

---

## Task 2: Implement `expectedRevenue` trong service

**Files:**
- Modify: `src/server/services/report.service.ts`

- [ ] **Step 2.1: Sửa `getMonthlySummary` — thêm `expectedRevenue` vào loop**

Tìm đoạn code tại khoảng dòng 139–154:

```typescript
  let totalRevenue = 0
  let presentRecords = 0
  let totalRecords = 0

  sessions.forEach(s => {
    s.sessionStudents.forEach(ss => {
      if (grade && ss.grade !== grade) return
      if (ss.attendance !== ATTENDANCE_STATUS.PENDING) {
        totalRecords++
        if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
          presentRecords++
          totalRevenue += ss.fee
        }
      }
    })
  })
```

Thay bằng:

```typescript
  let totalRevenue = 0
  let expectedRevenue = 0
  let presentRecords = 0
  let totalRecords = 0

  sessions.forEach(s => {
    s.sessionStudents.forEach(ss => {
      if (grade && ss.grade !== grade) return
      expectedRevenue += ss.fee
      if (ss.attendance !== ATTENDANCE_STATUS.PENDING) {
        totalRecords++
        if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
          presentRecords++
          totalRevenue += ss.fee
        }
      }
    })
  })
```

Sau đó tìm `return {` của hàm này (khoảng dòng 176) và thêm `expectedRevenue`:

```typescript
  return {
    totalSessions,
    totalStudents,
    totalRevenue,
    expectedRevenue,
    totalPaid,
    totalOutstanding,
    byGrade,
    overallAttendanceRate: Math.round(overallAttendanceRate * 10) / 10
  }
```

- [ ] **Step 2.2: Sửa `getDashboardStats` — thêm `expectedRevenueMonth`**

Tìm đoạn code khoảng dòng 218–233:

```typescript
  let totalRecords = 0
  let presentRecords = 0
  let totalRevenueMonth = 0

  sessionsThisMonth.forEach(s => {
    s.sessionStudents.forEach(ss => {
      if (ss.attendance !== ATTENDANCE_STATUS.PENDING) {
        totalRecords++
        if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
          presentRecords++
          totalRevenueMonth += ss.fee
        }
      }
    })
  })
```

Thay bằng:

```typescript
  let totalRecords = 0
  let presentRecords = 0
  let totalRevenueMonth = 0
  let expectedRevenueMonth = 0

  sessionsThisMonth.forEach(s => {
    s.sessionStudents.forEach(ss => {
      expectedRevenueMonth += ss.fee
      if (ss.attendance !== ATTENDANCE_STATUS.PENDING) {
        totalRecords++
        if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
          presentRecords++
          totalRevenueMonth += ss.fee
        }
      }
    })
  })
```

Sau đó tìm `return {` của `getDashboardStats` (khoảng dòng 239) và thêm `expectedRevenueMonth`:

```typescript
  return {
    totalStudents,
    sessionsToday,
    totalSessionsMonth,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    totalRevenueMonth,
    expectedRevenueMonth,
    totalUnpaidMonth,
  }
```

- [ ] **Step 2.3: Sửa `getStudentReport` — thêm `expectedRevenue` vào summary**

Tìm đoạn code khoảng dòng 41–47:

```typescript
  let totalRevenue = 0
  studentSessions.forEach(s => {
    const ss = s.students.find(x => x.studentId === studentId)
    if (ss && (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE)) {
      totalRevenue += ss.fee
    }
  })
```

Thay bằng:

```typescript
  let totalRevenue = 0
  let expectedRevenue = 0
  studentSessions.forEach(s => {
    const ss = s.students.find(x => x.studentId === studentId)
    if (ss) {
      expectedRevenue += ss.fee
      if (ss.attendance === ATTENDANCE_STATUS.PRESENT || ss.attendance === ATTENDANCE_STATUS.LATE) {
        totalRevenue += ss.fee
      }
    }
  })
```

Sau đó tìm `summary:` trong return của `getStudentReport` (khoảng dòng 49) và thêm `expectedRevenue`:

```typescript
  return {
    student,
    sessions: studentSessions,
    summary: { total, present, absent, late, pending, rate, totalRevenue, expectedRevenue }
  }
```

- [ ] **Step 2.4: Chạy tests để xác nhận PASS**

```bash
pnpm test:integration tests/integration/report.test.ts
```

Expected: tất cả tests PASS (kể cả 2 test mới). Nếu fail, kiểm tra lại logic expectedRevenue trong loop.

- [ ] **Step 2.5: Chạy full integration test suite để xác nhận không có regression**

```bash
pnpm test:integration
```

Expected: tất cả integration tests PASS. `totalOutstanding` và các field cũ không bị ảnh hưởng.

- [ ] **Step 2.6: Commit**

```bash
git add src/server/services/report.service.ts tests/integration/report.test.ts
git commit -m "feat(report): add expectedRevenue to getMonthlySummary, getDashboardStats, getStudentReport"
```

---

## Task 3: Thêm i18n key `actual_revenue`

**Files:**
- Modify: `src/language/vi.json`
- Modify: `src/language/en.json`

- [ ] **Step 3.1: Thêm key vào vi.json**

Tìm dòng có `"expected_revenue": "Doanh thu kỳ vọng"` trong `src/language/vi.json` và thêm key mới ngay sau nó:

```json
  "expected_revenue": "Doanh thu kỳ vọng",
  "actual_revenue": "Doanh thu thực tế",
```

- [ ] **Step 3.2: Thêm key vào en.json**

Tìm dòng có `"expected_revenue": "Expected Revenue"` trong `src/language/en.json` và thêm key mới ngay sau nó:

```json
  "expected_revenue": "Expected Revenue",
  "actual_revenue": "Actual Revenue",
```

- [ ] **Step 3.3: Commit**

```bash
git add src/language/vi.json src/language/en.json
git commit -m "i18n: add actual_revenue translation key (vi + en)"
```

---

## Task 4: Sửa Reports page — fix naming bug + thêm card 6

**Files:**
- Modify: `src/app/(app)/reports/page.tsx`

**Bối cảnh:** Card hiện tại có title `t("expected_revenue")` nhưng đang hiển thị `monthlySummary.totalRevenue` (doanh thu thực tế — PRESENT/LATE only). Đây là naming bug. Cần sửa label đó thành `t("actual_revenue")`, thêm sub-text gap, và thêm card mới cho `expectedRevenue` thực sự.

- [ ] **Step 4.1: Tính `gap` ở đầu component (sau khi có `monthlySummary`)**

Tìm dòng `const students = studentListData?.items ?? []` (khoảng dòng 66) và thêm sau nó:

```typescript
  const students = studentListData?.items ?? []
  const gap = (monthlySummary?.expectedRevenue ?? 0) - (monthlySummary?.totalRevenue ?? 0)
```

- [ ] **Step 4.2: Thay grid `lg:grid-cols-5` thành `lg:grid-cols-3 xl:grid-cols-6`**

Tìm dòng (khoảng dòng 117):

```typescript
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
```

Thay bằng:

```typescript
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
```

- [ ] **Step 4.3: Thêm card Expected Revenue (card mới, đặt TRƯỚC card actual revenue)**

Tìm card hiện tại có `t("expected_revenue")` (khoảng dòng 136–145):

```typescript
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("expected_revenue")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-indigo-600">
                  {monthlySummary ? formatCurrency(monthlySummary.totalRevenue) : "0 đ"}
                </div>
              </CardContent>
            </Card>
```

Thay toàn bộ đoạn đó bằng **2 card liên tiếp**:

```typescript
            {/* Card 3: Expected Revenue (mới) */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("expected_revenue")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-indigo-600">
                  {monthlySummary ? formatCurrency(monthlySummary.expectedRevenue) : "0 đ"}
                </div>
              </CardContent>
            </Card>
            {/* Card 4: Actual Revenue (fix naming bug từ expected → actual) */}
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase">{t("actual_revenue")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-emerald-600">
                  {monthlySummary ? formatCurrency(monthlySummary.totalRevenue) : "0 đ"}
                </div>
                {gap > 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    Hụt: {formatCurrency(gap)}
                  </p>
                )}
              </CardContent>
            </Card>
```

- [ ] **Step 4.4: Commit**

```bash
git add src/app/\(app\)/reports/page.tsx
git commit -m "feat(ui/reports): add expectedRevenue card, fix actual revenue label"
```

---

## Task 5: Thêm card Expected Revenue vào Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 5.1: Thay `xl:grid-cols-5` thành `xl:grid-cols-7`**

Tìm dòng (khoảng dòng 29):

```typescript
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
```

Thay bằng:

```typescript
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
```

- [ ] **Step 5.2: Thêm StatCard `expectedRevenueMonth` trước card `revenue_this_month`**

Tìm đoạn StatCard `revenue_this_month` (khoảng dòng 62–69):

```typescript
        <StatCard
          title={t("revenue_this_month")}
          value={stats ? formatCurrency(stats.totalRevenueMonth) : undefined}
          icon={<Banknote className="size-4 text-cyan-600" />}
          loading={isLoading}
          description={t("collected_this_month")}
          className="bg-cyan-50/50 border-cyan-100"
        />
```

Thêm StatCard mới **ngay TRƯỚC** đoạn trên:

```typescript
        <StatCard
          title={t("expected_revenue")}
          value={stats ? formatCurrency(stats.expectedRevenueMonth) : undefined}
          icon={<Banknote className="size-4 text-violet-600" />}
          loading={isLoading}
          description={t("revenue_this_month")}
          className="bg-violet-50/50 border-violet-100"
        />
        <StatCard
          title={t("revenue_this_month")}
          value={stats ? formatCurrency(stats.totalRevenueMonth) : undefined}
          icon={<Banknote className="size-4 text-cyan-600" />}
          loading={isLoading}
          description={t("collected_this_month")}
          className="bg-cyan-50/50 border-cyan-100"
        />
```

- [ ] **Step 5.3: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(ui/dashboard): add expectedRevenueMonth stat card"
```

---

## Task 6: Thêm `expectedFee` vào StudentScheduleView

**Files:**
- Modify: `src/components/students/StudentScheduleView.tsx`

**Bối cảnh:** Component này tính `totalFee` phía client (không dùng field từ service). Cần thêm `expectedFee` = tổng fee bất kể điểm danh, song song với `totalFee` hiện tại.

- [ ] **Step 6.1: Thêm `expectedFee` vào `useMemo` summary block**

Tìm đoạn `useMemo` tại khoảng dòng 71–97:

```typescript
  const summary = useMemo(() => {
    const total = studentSessions.length
    let present = 0
    let absent = 0
    let late = 0
    let pending = 0
    let totalFee = 0

    studentSessions.forEach(s => {
      const st = s.students.find(ss => ss.studentId === studentId)
      if (!st) return

      if (st.attendance === ATTENDANCE_STATUS.PRESENT) present++
      else if (st.attendance === ATTENDANCE_STATUS.ABSENT) absent++
      else if (st.attendance === ATTENDANCE_STATUS.LATE) late++
      else pending++

      if (st.attendance === ATTENDANCE_STATUS.PRESENT || st.attendance === ATTENDANCE_STATUS.LATE) {
        totalFee += st.fee ?? 0
      }
    })

    const rate = calcAttendanceRate(present + late, total - pending)

    return { total, present, absent, late, pending, rate, totalFee }

  }, [studentSessions, studentId])
```

Thay bằng:

```typescript
  const summary = useMemo(() => {
    const total = studentSessions.length
    let present = 0
    let absent = 0
    let late = 0
    let pending = 0
    let totalFee = 0
    let expectedFee = 0

    studentSessions.forEach(s => {
      const st = s.students.find(ss => ss.studentId === studentId)
      if (!st) return

      if (st.attendance === ATTENDANCE_STATUS.PRESENT) present++
      else if (st.attendance === ATTENDANCE_STATUS.ABSENT) absent++
      else if (st.attendance === ATTENDANCE_STATUS.LATE) late++
      else pending++

      expectedFee += st.fee ?? 0
      if (st.attendance === ATTENDANCE_STATUS.PRESENT || st.attendance === ATTENDANCE_STATUS.LATE) {
        totalFee += st.fee ?? 0
      }
    })

    const rate = calcAttendanceRate(present + late, total - pending)

    return { total, present, absent, late, pending, rate, totalFee, expectedFee }

  }, [studentSessions, studentId])
```

- [ ] **Step 6.2: Thay phần hiển thị `tuition_with_colon` thành 2 dòng expected/actual**

Tìm dòng (khoảng dòng 210):

```typescript
              <span>{t("tuition_with_colon")} <span className="text-indigo-600 font-bold">{formatCurrency(summary.totalFee)}</span></span>
```

Thay bằng:

```typescript
              <span>{t("expected_revenue")}: <span className="text-indigo-600 font-bold">{formatCurrency(summary.expectedFee)}</span></span>
              <span>{t("actual_revenue")}: <span className="text-emerald-600 font-bold">{formatCurrency(summary.totalFee)}</span></span>
```

- [ ] **Step 6.3: Commit**

```bash
git add src/components/students/StudentScheduleView.tsx
git commit -m "feat(ui/student-report): add expectedFee alongside actual fee in session summary"
```

---

## Task 7: TypeScript build check + final verification

- [ ] **Step 7.1: Chạy TypeScript type check**

```bash
pnpm tsc --noEmit
```

Expected: không có lỗi TypeScript. Nếu có lỗi kiểu `Property 'expectedRevenue' does not exist`, kiểm tra lại file `report.service.ts` — TypeScript infer trực tiếp từ return type của service qua tRPC, không cần khai báo type thủ công.

- [ ] **Step 7.2: Chạy toàn bộ integration tests**

```bash
pnpm test:integration
```

Expected: tất cả tests PASS. Chú ý đặc biệt các test liên quan đến `totalOutstanding` và `totalRevenue` trong các file:
- `tests/integration/tuition-report-consistency.test.ts`
- `tests/integration/active-student-consistency.test.ts`
- `tests/integration/tuition-payment-snapshot.test.ts`

- [ ] **Step 7.3: Final commit nếu có thay đổi còn sót**

```bash
git status
# Nếu có file chưa commit:
git add <file>
git commit -m "chore: final cleanup for expected-revenue feature"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - ✅ `getMonthlySummary` → `expectedRevenue` (Task 2.1)
  - ✅ `getDashboardStats` → `expectedRevenueMonth` (Task 2.2)
  - ✅ `getStudentReport` → `expectedRevenue` (Task 2.3)
  - ✅ Naming bug fix Reports page (Task 4.3)
  - ✅ New expected revenue card Reports (Task 4.3)
  - ✅ Gap display (Task 4.1 + 4.3)
  - ✅ Dashboard new StatCard (Task 5.2)
  - ✅ StudentScheduleView `expectedFee` (Task 6.1 + 6.2)
  - ✅ i18n `actual_revenue` key (Task 3)
  - ✅ Tests (Task 1 + 2.4)

- [x] **Không có placeholder:** Tất cả steps có code cụ thể ✅

- [x] **Type consistency:**
  - `expectedRevenue` dùng nhất quán trong service return và UI access
  - `expectedRevenueMonth` nhất quán giữa service và dashboard
  - `expectedFee` chỉ dùng trong `StudentScheduleView` (client-side)

- [x] **Safety — Prod/Test DB:**
  - Không có migration
  - Không có thay đổi schema
  - Tests dùng test DB (`.env.test`) theo config hiện tại — không đụng production
