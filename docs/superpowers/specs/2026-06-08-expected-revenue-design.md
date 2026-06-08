# Expected Revenue Display — Design Spec

**Date:** 2026-06-08  
**Status:** Approved for implementation

---

## Problem

The app currently shows **actual revenue** (fees from PRESENT/LATE sessions only). When a student is absent or a teacher cancels a session, there is no way to see the projected total income for the month. Additionally, the Reports page has a naming bug: the card labeled "Doanh thu kỳ vọng" (expected revenue) actually displays actual revenue.

---

## Goal

Add a true **Doanh thu kỳ vọng** figure = sum of ALL scheduled session fees, regardless of attendance status or session status (including cancelled sessions). Display it alongside actual revenue on Dashboard, Reports, and per-student views, with a gap indicator showing the difference.

---

## Definition

| Field | Formula | Scope |
|---|---|---|
| `totalRevenue` (existing) | sum(`ss.fee`) where `attendance IN (PRESENT, LATE)` | unchanged |
| `expectedRevenue` (new) | sum(`ss.fee`) for ALL `sessionStudent` records in period | no attendance/status filter |
| `gap` (UI-only) | `expectedRevenue − totalRevenue` | computed at render time |

A cancelled session's `sessionStudent` records remain in the DB (status=cancelled, records intact), so their fees are naturally included in `expectedRevenue`.

---

## Affected Files

### 1. `src/server/services/report.service.ts`

**`getMonthlySummary()`** — add `expectedRevenue` alongside the existing `totalRevenue` loop:

```
let expectedRevenue = 0
sessions.forEach(s => {
  s.sessionStudents.forEach(ss => {
    if (grade && ss.grade !== grade) return
    expectedRevenue += ss.fee          // no attendance filter
  })
})
```

Return: add `expectedRevenue` to the returned object. `totalRevenue` and all other fields unchanged.

**`getDashboardStats()`** — add `expectedRevenueMonth` in the existing `sessionsThisMonth` loop:

```
let expectedRevenueMonth = 0
sessionsThisMonth.forEach(s => {
  s.sessionStudents.forEach(ss => {
    expectedRevenueMonth += ss.fee     // no attendance filter
  })
})
```

Return: add `expectedRevenueMonth`. All other fields unchanged.

**`getStudentReport()`** — add `expectedRevenue` to summary:

```
let expectedRevenue = 0
studentSessions.forEach(s => {
  const ss = s.students.find(x => x.studentId === studentId)
  if (ss) expectedRevenue += ss.fee
})
```

Return: add `expectedRevenue` to `summary`. `totalRevenue` and all other fields unchanged.

> **No DB schema changes.** All new fields are computed from data already fetched by existing queries.

---

### 2. `src/language/vi.json` and `en.json`

Add one new key (existing `expected_revenue` already present):

```json
"actual_revenue": "Doanh thu thực tế"   // vi.json
"actual_revenue": "Actual Revenue"       // en.json
```

---

### 3. `src/app/(app)/reports/page.tsx`

**Bug fix:** The current card at line 138 is labeled `t("expected_revenue")` but renders `monthlySummary.totalRevenue` (actual revenue). Fix the label to `t("actual_revenue")`.

**New card:** Add a 6th card showing `monthlySummary.expectedRevenue` with:
- Title: `t("expected_revenue")`
- Value: `formatCurrency(monthlySummary.expectedRevenue)`
- Sub-text below actual revenue card: `Hụt: {formatCurrency(gap)}` (only shown when gap > 0)

**Grid:** change `lg:grid-cols-5` → `lg:grid-cols-3 xl:grid-cols-6` (responsive).

Card order: Students | Attendance Rate | **Expected Revenue** | Actual Revenue | Collected | Outstanding

---

### 4. `src/app/(app)/dashboard/page.tsx`

Add a new `StatCard` for expected revenue:

```tsx
<StatCard
  title={t("expected_revenue")}
  value={stats ? formatCurrency(stats.expectedRevenueMonth) : undefined}
  icon={<Banknote className="size-4 text-violet-600" />}
  loading={isLoading}
  description={t("revenue_this_month")}  // reuse existing key
  className="bg-violet-50/50 border-violet-100"
/>
```

Place it **before** the existing `revenue_this_month` card so the flow reads: Expected → Actual → Unpaid.

**Grid:** change `xl:grid-cols-5` → `xl:grid-cols-4 2xl:grid-cols-7` or keep as-is and let it wrap into two rows (7 cards total). Keep wrapping behaviour — do not force single row on small viewports.

---

### 5. `src/components/students/StudentScheduleView.tsx`

The component recalculates revenue client-side (does not use the server's `summary.totalRevenue`). Add `expectedFee` to the `useMemo` summary block:

```ts
let expectedFee = 0
studentSessions.forEach(s => {
  const st = s.students.find(ss => ss.studentId === studentId)
  if (!st) return
  // ... existing attendance counts unchanged ...
  expectedFee += st.fee ?? 0             // add this — no attendance filter
  if (st.attendance === PRESENT || st.attendance === LATE) {
    totalFee += st.fee ?? 0
  }
})
return { ..., totalFee, expectedFee }
```

Display: add `expectedFee` line in the summary section alongside existing `totalFee`:

```
Kỳ vọng: {formatCurrency(summary.expectedFee)}
Thực tế: {formatCurrency(summary.totalFee)}
```

Replace the single "tuition_with_colon" line. No new i18n keys needed — use `t("expected_revenue")` and `t("actual_revenue")`.

---

## Test Strategy

### Existing tests — must not break

- `tests/integration/report.test.ts` — no assertions on revenue value; adding new fields is non-breaking.
- `tests/integration/tuition-report-consistency.test.ts` — asserts on `totalOutstanding` only; untouched.
- `tests/integration/active-student-consistency.test.ts` — asserts on `totalStudents`; untouched.
- `tests/integration/tuition-payment-snapshot.test.ts` — asserts on tuition page fields; untouched.

### New test assertions to add

In `tests/integration/report.test.ts`, add to the `monthlySummary` test case:

1. **When all sessions are PRESENT:** `expectedRevenue === totalRevenue` (no gap).
2. **When a student is ABSENT:** `expectedRevenue > totalRevenue`; gap = absent student's fee.
3. **When a session is CANCELLED (status=cancelled):** `expectedRevenue` still includes those fees; `totalRevenue` does not.

> **No test DB schema changes.** New computed fields don't require migrations. Test and production DBs are unaffected structurally.

---

## Conflict Analysis

| Screen | Impact | Risk |
|---|---|---|
| Reports page | Label fix + new card + grid change | Low — additive only |
| Dashboard | New stat card | Low — additive only |
| StudentScheduleView | New `expectedFee` field in summary | Low — additive, no prop change |
| Tuition page | None | None |
| Calendar page | None | None |
| Students page | None | None |
| DB schema / migrations | None | None |
| Existing API shape | New fields added to return type | Non-breaking (additive) |
| Existing tests | All existing assertions pass | Verified above |
