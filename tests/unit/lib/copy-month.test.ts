import { describe, it, expect } from "vitest"
import {
  capConflictsPerPattern,
  conflictLabel,
  deriveWeeklyPatterns,
  monthFromIndex,
  monthIndex,
  planMonthCopy,
  shiftMonth,
  targetMonths,
  vnToday,
  weekdayOf,
  ymd,
  type ExistingSession,
  type SourceSession,
  type WeeklyPattern,
} from "@/lib/copy-month"

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)
const S = (date: string, start: string, end: string, o: Partial<SourceSession> = {}): SourceSession => ({
  sessionDate: D(date),
  startTime: start,
  endTime: end,
  subjectId: 1,
  subjectName: "Toán",
  title: null,
  status: "scheduled",
  makeupOfId: null,
  studentIds: [],
  ...o,
})
// Nhiều ca cùng giờ trong 1 tháng: days("2030-01", [7, 14], ...) → 2030-01-07, 2030-01-14.
const days = (ym: string, list: number[], start: string, end: string, o: Partial<SourceSession> = {}) =>
  list.map((d) => S(`${ym}-${String(d).padStart(2, "0")}`, start, end, o))
const ALL = new Set([1, 2, 3])
const kinds = (ps: WeeklyPattern[]) => ps.map((p) => [p.weekday, p.startTime, p.kind])

const P = (weekday: number, start: string, end: string, o: Partial<WeeklyPattern> = {}): WeeklyPattern => ({
  key: `${weekday}|${start}|${end}|1`,
  weekday,
  startTime: start,
  endTime: end,
  subjectId: 1,
  subjectName: "Toán",
  title: null,
  studentIds: [1],
  droppedInactive: 0,
  count: 4,
  lastDate: D("2030-01-28"),
  kind: "regular",
  ...o,
})
const E = (date: string, start: string, end: string, status = "scheduled", label = "Lớp Toán"): ExistingSession => ({
  sessionDate: D(date),
  startTime: start,
  endTime: end,
  status,
  label,
})
const FEB = [{ year: 2030, month: 2 }]
const EARLY = D("2020-01-01")
const dates = (plan: ReturnType<typeof planMonthCopy>) => plan.candidates.map((c) => ymd(c.sessionDate))

describe("tiện ích tháng / ngày", () => {
  it("monthIndex / monthFromIndex / shiftMonth cuộn năm", () => {
    expect(monthFromIndex(monthIndex({ year: 2030, month: 12 }))).toEqual({ year: 2030, month: 12 })
    expect(shiftMonth({ year: 2030, month: 12 }, 1)).toEqual({ year: 2031, month: 1 })
    expect(shiftMonth({ year: 2030, month: 1 }, -1)).toEqual({ year: 2029, month: 12 })
  })
  it("targetMonths: 1..3 tháng liên tiếp, qua năm", () => {
    expect(targetMonths({ year: 2030, month: 5 }, 1)).toEqual([{ year: 2030, month: 5 }])
    expect(targetMonths({ year: 2030, month: 11 }, 3)).toEqual([
      { year: 2030, month: 11 },
      { year: 2030, month: 12 },
      { year: 2031, month: 1 },
    ])
  })
  it("weekdayOf theo getUTCDay: 0 = T2 … 6 = CN", () => {
    expect(weekdayOf(D("2030-01-07"))).toBe(0)
    expect(weekdayOf(D("2030-01-06"))).toBe(6)
  })
  it("vnToday: 00:30 giờ VN ngày 1/2 (UTC còn 31/1) → 2030-02-01", () => {
    expect(ymd(vnToday(new Date("2030-01-31T17:30:00.000Z")))).toBe("2030-02-01")
    expect(ymd(vnToday(new Date("2030-01-31T16:59:00.000Z")))).toBe("2030-01-31")
  })
  it("conflictLabel cùng định dạng checkBulkCreateConflicts", () => {
    expect(conflictLabel("Nhóm A", "Toán", "17:00", "19:00")).toBe('"Nhóm A" (Toán)')
    expect(conflictLabel(null, "Toán", "17:00", "19:00")).toBe("Lớp Toán (17:00–19:00)")
  })
})

describe("deriveWeeklyPatterns (spec 4.2)", () => {
  it("4 tuần T2 + 5 tuần T4 → 2 mẫu regular, đúng key/giờ/count, sắp theo thứ", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [2, 9, 16, 23, 30], "08:00", "09:30", { subjectId: 2, subjectName: "Lý" }),
        ...days("2030-01", [7, 14, 21, 28], "17:00", "19:00"),
      ],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([
      [0, "17:00", "regular"],
      [2, "08:00", "regular"],
    ])
    expect(ps[0]).toMatchObject({ key: "0|17:00|19:00|1", endTime: "19:00", count: 4 })
    expect(ps[1]).toMatchObject({ key: "2|08:00|09:30|2", subjectName: "Lý", count: 5 })
    expect(ymd(ps[0].lastDate)).toBe("2030-01-28")
  })

  it("ca huỷ có ca bù vẫn góp vào mẫu gốc; ca bù (makeupOfId) không tạo mẫu", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 21, 28], "17:00", "19:00"),
        S("2030-01-14", "17:00", "19:00", { status: "cancelled" }),
        S("2030-01-18", "17:00", "19:00", { makeupOfId: 99 }),
      ],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([[0, "17:00", "regular"]])
    expect(ps[0].count).toBe(4)
  })

  it("ca huỷ không có ca bù (kể cả là lần cuối) vẫn tính", () => {
    const ps = deriveWeeklyPatterns(
      [...days("2030-01", [7, 14, 21], "17:00", "19:00"), S("2030-01-28", "17:00", "19:00", { status: "cancelled" })],
      2030,
      1,
      ALL
    )
    expect(ps[0]).toMatchObject({ kind: "regular", count: 4 })
    expect(ymd(ps[0].lastDate)).toBe("2030-01-28")
  })

  it("1 lần → single; đổi lịch giữa tháng (T3 tuần 1–2 → T5 tuần 3–5) → T3 stopped, T5 regular", () => {
    const ps = deriveWeeklyPatterns(
      [
        S("2030-01-26", "10:00", "11:00"),
        ...days("2030-01", [1, 8], "17:00", "19:00"),
        ...days("2030-01", [17, 24, 31], "17:00", "19:00"),
      ],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([
      [1, "17:00", "stopped"],
      [3, "17:00", "regular"],
      [5, "10:00", "single"],
    ])
  })

  it("cách tuần (2, 16, 30) → biweekly; lỡ 1 buổi (1, 8, 22, 29) → regular", () => {
    const ps = deriveWeeklyPatterns(
      [...days("2030-01", [2, 16, 30], "08:00", "09:00"), ...days("2030-01", [1, 8, 22, 29], "17:00", "19:00")],
      2030,
      1,
      ALL
    )
    expect(kinds(ps)).toEqual([
      [1, "17:00", "regular"],
      [2, "08:00", "biweekly"],
    ])
  })

  it("đổi HS tuần cuối → studentIds + title lấy từ lần muộn nhất; không có notes", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 14, 21], "17:00", "19:00", { title: "Nhóm A", studentIds: [1] }),
        S("2030-01-28", "17:00", "19:00", { title: "Nhóm A2", studentIds: [1, 2] }),
      ],
      2030,
      1,
      ALL
    )
    expect(ps[0]).toMatchObject({ title: "Nhóm A2", studentIds: [1, 2], droppedInactive: 0 })
    expect("notes" in ps[0]).toBe(false)
  })

  it("HS lần cuối đều đã nghỉ → no_students; nghỉ 1 phần → giữ loại, bỏ HS nghỉ; ca không HS giữ loại", () => {
    const active = new Set([1, 2])
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 14, 21, 28], "17:00", "19:00", { studentIds: [3] }),
        ...days("2030-01", [7, 14, 21, 28], "19:00", "20:00", { studentIds: [1, 3] }),
        ...days("2030-01", [2, 9, 16, 23, 30], "08:00", "09:00"),
      ],
      2030,
      1,
      active
    )
    expect(ps.map((p) => [p.startTime, p.kind, p.studentIds, p.droppedInactive])).toEqual([
      ["17:00", "no_students", [], 1],
      ["19:00", "regular", [1], 1],
      ["08:00", "regular", [], 0],
    ])
  })

  it("tháng 2: cửa sổ 14 ngày tính theo ngày cuối thật (2028 nhuận 29 ngày, 2027 28 ngày)", () => {
    expect(kinds(deriveWeeklyPatterns(days("2028-02", [1, 8, 15], "17:00", "19:00"), 2028, 2, ALL))).toEqual([[1, "17:00", "stopped"]])
    expect(kinds(deriveWeeklyPatterns(days("2027-02", [1, 8, 15], "17:00", "19:00"), 2027, 2, ALL))).toEqual([[0, "17:00", "regular"]])
  })

  it("cùng ngày có ca huỷ + ca dạy lại đúng slot: đếm 1 ngày, lần muộn nhất là ca không huỷ", () => {
    const ps = deriveWeeklyPatterns(
      [
        ...days("2030-01", [7, 14, 21], "17:00", "19:00", { studentIds: [1] }),
        S("2030-01-28", "17:00", "19:00", { studentIds: [2] }),
        S("2030-01-28", "17:00", "19:00", { status: "cancelled", studentIds: [1] }),
      ],
      2030,
      1,
      ALL
    )
    expect(ps[0]).toMatchObject({ count: 4, studentIds: [2] })
  })
})

describe("planMonthCopy (spec 5)", () => {
  it("sinh đúng ngày theo thứ (T2 4 lần, T6 5 lần), không ra ngoài tháng, sắp theo ngày", () => {
    const mon = P(0, "17:00", "19:00")
    const fri = P(4, "08:00", "09:00")
    const plan = planMonthCopy({ patterns: [mon, fri], targets: [{ year: 2030, month: 3 }], existing: [], today: EARLY })
    expect(dates(plan)).toEqual([
      "2030-03-01", "2030-03-04", "2030-03-08", "2030-03-11", "2030-03-15",
      "2030-03-18", "2030-03-22", "2030-03-25", "2030-03-29",
    ])
    expect(plan.perPattern[mon.key]).toEqual([{ year: 2030, month: 3, slots: 4, created: 4, existing: 0, conflict: 0, past: 0 }])
    expect(plan.perPattern[fri.key][0]).toMatchObject({ slots: 5, created: 5 })
    expect(plan.months).toEqual([{ year: 2030, month: 3, created: 9 }])
    expect(plan.candidates[0]).toMatchObject({ patternKey: fri.key, startTime: "08:00", endTime: "09:00", subjectId: 1, studentIds: [1] })
  })

  it("cùng slot (kể cả ca huỷ) → existing; chồng giờ ca không huỷ → conflict có nhãn; ca huỷ khác giờ không chặn", () => {
    const mon = P(0, "17:00", "19:00")
    const plan = planMonthCopy({
      patterns: [mon],
      targets: FEB,
      existing: [
        E("2030-02-04", "17:00", "19:00", "cancelled"),
        E("2030-02-11", "17:30", "18:30", "scheduled", '"Ca tay" (Toán)'),
        E("2030-02-18", "16:00", "17:30", "cancelled"),
      ],
      today: EARLY,
    })
    expect(plan.totals).toEqual({ created: 2, existing: 1, conflict: 1, past: 0 })
    expect(plan.conflicts).toEqual([{ patternKey: mon.key, date: "2030-02-11", conflict: '"Ca tay" (Toán)' }])
    expect(dates(plan)).toEqual(["2030-02-18", "2030-02-25"])
  })

  it("2 mẫu được chọn chồng giờ cùng thứ → mẫu sắp sau bị conflict, nhãn theo mẫu trước", () => {
    const a = P(0, "17:00", "19:00", { title: "Nhóm A" })
    const b = P(0, "18:00", "20:00")
    const plan = planMonthCopy({ patterns: [a, b], selectedKeys: [a.key, b.key], targets: FEB, existing: [], today: EARLY })
    expect(plan.perPattern[a.key][0]).toMatchObject({ created: 4, conflict: 0 })
    expect(plan.perPattern[b.key][0]).toMatchObject({ created: 0, conflict: 4 })
    expect(plan.conflicts[0]).toEqual({ patternKey: b.key, date: "2030-02-04", conflict: '"Nhóm A" (Toán)' })
  })

  it("ngày trước hôm nay VN → past; đúng hôm nay vẫn tạo", () => {
    const plan = planMonthCopy({ patterns: [P(0, "17:00", "19:00")], targets: FEB, existing: [], today: D("2030-02-11") })
    expect(plan.totals).toEqual({ created: 3, existing: 0, conflict: 0, past: 1 })
    expect(dates(plan)).toEqual(["2030-02-11", "2030-02-18", "2030-02-25"])
  })

  it("nhiều tháng qua năm (11/2026 → 1/2027)", () => {
    const plan = planMonthCopy({
      patterns: [P(0, "17:00", "19:00")],
      targets: targetMonths({ year: 2026, month: 11 }, 3),
      existing: [],
      today: EARLY,
    })
    expect(plan.months).toEqual([
      { year: 2026, month: 11, created: 5 },
      { year: 2026, month: 12, created: 4 },
      { year: 2027, month: 1, created: 4 },
    ])
    expect(plan.totals.created).toBe(13)
  })

  it("không có selectedKeys → chỉ regular; có selectedKeys → đúng các key đó, key lạ bị bỏ; mẫu không chọn vẫn có slots", () => {
    const mon = P(0, "17:00", "19:00")
    const sat = P(5, "10:00", "11:00", { kind: "single", count: 1 })
    const byDefault = planMonthCopy({ patterns: [mon, sat], targets: FEB, existing: [], today: EARLY })
    expect(byDefault.selectedKeys).toEqual([mon.key])
    expect(byDefault.perPattern[sat.key][0]).toMatchObject({ slots: 4, created: 0 })
    const picked = planMonthCopy({ patterns: [mon, sat], selectedKeys: [sat.key, "9|00:00|01:00|1"], targets: FEB, existing: [], today: EARLY })
    expect(picked.selectedKeys).toEqual([sat.key])
    expect(dates(picked)).toEqual(["2030-02-02", "2030-02-09", "2030-02-16", "2030-02-23"])
    expect(picked.perPattern[mon.key][0]).toMatchObject({ slots: 4, created: 0 })
  })
})

describe("capConflictsPerPattern (spec P M1)", () => {
  it("cắt theo từng mẫu, giữ thứ tự; mẫu sau không bị mẫu trước chiếm hết", () => {
    const mk = (patternKey: string, i: number) => ({ patternKey, date: `2030-02-${String(i + 1).padStart(2, "0")}`, conflict: "x" })
    const input = [...Array.from({ length: 25 }, (_, i) => mk("A", i)), ...Array.from({ length: 3 }, (_, i) => mk("B", i))]
    const out = capConflictsPerPattern(input, 20)
    expect(out.filter((c) => c.patternKey === "A")).toHaveLength(20)
    expect(out.filter((c) => c.patternKey === "B")).toHaveLength(3)
    expect(out[0]).toEqual(input[0])
  })
})
