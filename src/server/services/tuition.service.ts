import { Prisma, type PrismaClient, type MonthlyTuition, type SessionStudent } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { assertOwnership } from "./_base.service"
import type { MonthlyTuitionFilterInput, UpdateSettlementInput, SetNoticeSentInput } from "@/lib/schemas/tuition"
import type { PaginatedResponse } from "@/lib/schemas/common"
import type { TuitionStatusDTO, NoticeStatus } from "@/lib/types/models"
import { byGradeThenName, nameMatches } from "@/lib/name-search"
import { monthFee, monthKey, resolveBilling, type Billing, type BillingChange } from "@/lib/billing"
import { loadBillingChanges } from "./billing.service"
import type { MonthLedger } from "@/lib/payment-allocation"
import { dueNow, getRowStatus, isInProgressMonth } from "@/lib/tuition-display"

type AttendanceRecord = SessionStudent & { session: { sessionDate: Date } }

function calcStudentTuition(
  attendance: AttendanceRecord[],
  snapshot: MonthlyTuition | undefined,
  previousBalance: number,
  billing: Billing,
): {
  totalSessions: number
  presentSessions: number
  currentMonthFee: number
  previousBalance: number
  totalAmountDue: number
  needsUpsert: boolean
} {
  const totalSessions = attendance.length
  const presentSessions = attendance.filter(
    a => a.attendance === ATTENDANCE_STATUS.PRESENT || a.attendance === ATTENDANCE_STATUS.LATE
  ).length
  const currentMonthFee = monthFee(
    billing,
    attendance.map(a => ({ attendance: a.attendance, fee: a.fee }))
  )

  const totalAmountDue = previousBalance + currentMonthFee

  // Ghi lại snapshot khi số tính ra lệch số đã lưu, kể cả tháng quá khứ —
  // carry-over của tháng kế tiếp đọc chính row này.
  const needsUpsert =
    !snapshot ||
    snapshot.totalSessions !== totalSessions ||
    snapshot.presentSessions !== presentSessions ||
    snapshot.currentMonthFee !== currentMonthFee ||
    snapshot.totalAmountDue !== totalAmountDue ||
    snapshot.previousBalance !== previousBalance

  return { totalSessions, presentSessions, currentMonthFee, previousBalance, totalAmountDue, needsUpsert }
}

// Dư nợ CUỐI từng tháng (khoá year*12+month-1) trước tháng `month`, đi lại từ dữ liệu gốc (tiền buổi có mặt,
// đã thu, tất toán); không tin previousBalance/totalAmountDue đã lưu: snapshot tháng HS không có trong danh sách
// có thể đóng băng. Tất toán = miễn nợ DƯƠNG còn lại của tháng đó; tín dụng trả dư (số ÂM) vẫn chuyển sang.
// Tháng trống giữa chừng mang nguyên dư nợ; khoá cuối luôn là tháng liền trước `month`.
export async function computeClosingBalances(
  db: PrismaClient,
  userId: number,
  studentIds: number[],
  year: number,
  month: number,
  billingMap?: Map<number, BillingChange[]>
): Promise<Map<number, Map<number, number>>> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const resolvedBillingMap = billingMap ?? (await loadBillingChanges(db, studentIds))

  const [snaps, links] = await Promise.all([
    db.monthlyTuition.findMany({
      where: { studentId: { in: studentIds }, OR: [{ year: { lt: year } }, { year, month: { lt: month } }] },
      select: { studentId: true, year: true, month: true, paidAmount: true, isFullPaid: true },
    }),
    db.sessionStudent.findMany({
      where: {
        studentId: { in: studentIds },
        session: { sessionDate: { lt: startDate }, userId, status: { not: "cancelled" }, isDeleted: false },
      },
      select: { studentId: true, fee: true, attendance: true, session: { select: { sessionDate: true } } },
    }),
  ])

  type MonthData = { links: { attendance: string; fee: number }[]; paid: number; fullPaid: boolean }
  const byStudent = new Map<number, Map<number, MonthData>>()
  const slot = (studentId: number, key: number) => {
    let months = byStudent.get(studentId)
    if (!months) byStudent.set(studentId, (months = new Map()))
    let d = months.get(key)
    if (!d) months.set(key, (d = { links: [], paid: 0, fullPaid: false }))
    return d
  }
  for (const s of snaps) {
    const d = slot(s.studentId, s.year * 12 + s.month - 1)
    d.paid = s.paidAmount
    d.fullPaid = s.isFullPaid
  }
  for (const l of links) {
    const date = l.session.sessionDate
    const key = date.getUTCFullYear() * 12 + date.getUTCMonth()
    slot(l.studentId, key).links.push({ attendance: l.attendance, fee: l.fee })
  }

  const lastKey = year * 12 + month - 2
  const result = new Map<number, Map<number, number>>()
  for (const [studentId, months] of byStudent) {
    const closing = new Map<number, number>()
    let balance = 0
    const changes = resolvedBillingMap.get(studentId) ?? []
    for (let key = Math.min(...months.keys()); key <= lastKey; key++) {
      const d = months.get(key)
      if (d) {
        const billing = resolveBilling(changes, key)
        const fee = monthFee(billing, d.links)
        const residual = balance + fee - d.paid
        balance = d.fullPaid ? Math.min(0, residual) : residual
      }
      closing.set(key, balance)
    }
    result.set(studentId, closing)
  }
  return result
}

// Sổ từng tháng của 1 HS tới hết tháng đích (gồm cả tháng đích) cho chia tiền FIFO; cùng nguồn với computeClosingBalances.
export async function loadMonthLedgers(
  db: PrismaClient | Prisma.TransactionClient,
  userId: number,
  studentId: number,
  year: number,
  month: number
): Promise<MonthLedger[]> {
  const endDate = new Date(Date.UTC(year, month, 1))
  const [billingMap, snaps, links] = await Promise.all([
    loadBillingChanges(db, [studentId]),
    db.monthlyTuition.findMany({
      where: { studentId, OR: [{ year: { lt: year } }, { year, month: { lte: month } }] },
      select: { year: true, month: true, paidAmount: true, isFullPaid: true },
    }),
    db.sessionStudent.findMany({
      where: { studentId, session: { sessionDate: { lt: endDate }, userId, status: { not: "cancelled" }, isDeleted: false } },
      select: { fee: true, attendance: true, session: { select: { sessionDate: true } } },
    }),
  ])
  const changes = billingMap.get(studentId) ?? []
  const byKey = new Map<number, { links: { attendance: string; fee: number }[]; paid: number; fullPaid: boolean }>()
  const slot = (key: number) => {
    let d = byKey.get(key)
    if (!d) byKey.set(key, (d = { links: [], paid: 0, fullPaid: false }))
    return d
  }
  for (const s of snaps) {
    const d = slot(monthKey(s.year, s.month))
    d.paid = s.paidAmount
    d.fullPaid = s.isFullPaid
  }
  for (const l of links) {
    const date = l.session.sessionDate
    slot(date.getUTCFullYear() * 12 + date.getUTCMonth()).links.push({ attendance: l.attendance, fee: l.fee })
  }
  slot(monthKey(year, month))
  return [...byKey]
    .sort(([a], [b]) => a - b)
    .map(([key, d]) => ({ key, fee: monthFee(resolveBilling(changes, key), d.links), paid: d.paid, fullPaid: d.fullPaid }))
}

export async function getMonthlyTuitionStatus(
  db: PrismaClient,
  userId: number,
  filter: MonthlyTuitionFilterInput,
  // persist=false cho đường chỉ đọc (dashboard/report): kết quả vẫn đúng, chỉ không ghi.
  persist = true,
  // Dashboard (spec P1): chỉ tính cho các HS này, bỏ lọc isActive/grade của danh sách màn Học phí.
  onlyStudentIds?: number[]
): Promise<PaginatedResponse<TuitionStatusDTO>> {
  const { year, month, grade, search, studentId, status, noticeFilter, page, limit } = filter
  if (onlyStudentIds && onlyStudentIds.length === 0) return { items: [], totalCount: 0, totalPages: 0 }

  // 1. Lấy toàn bộ học sinh active theo filter
  const rows = await db.student.findMany({
    where: onlyStudentIds
      ? { userId, id: { in: onlyStudentIds } }
      : {
          userId,
          ...(studentId
            ? { id: studentId }
            : grade
            ? {
                sessionStudents: {
                  some: {
                    grade,
                    session: {
                      isDeleted: false,
                      sessionDate: {
                        gte: new Date(Date.UTC(year, month - 1, 1)),
                        lt: new Date(Date.UTC(year, month, 1)),
                      },
                    },
                  },
                },
              }
            : {
                OR: [
                  { isActive: true },
                  {
                    sessionStudents: {
                      some: {
                        session: {
                          isDeleted: false,
                          sessionDate: {
                            gte: new Date(Date.UTC(year, month - 1, 1)),
                            lt: new Date(Date.UTC(year, month, 1)),
                          },
                        },
                      },
                    },
                  },
                ],
              }),
        },
  })
  // Tên mã hoá (spec O Q7): lọc + sắp trong bộ nhớ; hàm này vốn đã phân trang trong bộ nhớ.
  const students = rows.filter((s) => nameMatches(s.fullName, search)).sort(byGradeThenName)

  if (students.length === 0) return { items: [], totalCount: 0, totalPages: 0 }

  const studentIds = students.map(s => s.id)
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))

  // 2. Fetch song song: billing changes + điểm danh tháng hiện tại + snapshot tháng này + nợ đầu tháng
  const billingMapPromise = loadBillingChanges(db, studentIds)
  const [billingMap, currentAttendance, existingSnapshots, closingBalances] = await Promise.all([
    billingMapPromise,
    db.sessionStudent.findMany({
      where: {
        studentId: { in: studentIds },
        session: { sessionDate: { gte: startDate, lt: endDate }, userId, status: { not: "cancelled" }, isDeleted: false },
      },
      include: { session: true },
    }),
    db.monthlyTuition.findMany({
      where: { studentId: { in: studentIds }, year, month },
    }),
    billingMapPromise.then((bMap) => computeClosingBalances(db, userId, studentIds, year, month, bMap)),
  ])

  // 3. Dùng Map để tra cứu O(1) thay vì .find() O(n) trong vòng lặp
  const snapshotMap = new Map(existingSnapshots.map(sn => [sn.studentId, sn]))
  const attendanceMap = new Map<number, AttendanceRecord[]>()
  for (const a of currentAttendance) {
    const list = attendanceMap.get(a.studentId) ?? []
    list.push(a)
    attendanceMap.set(a.studentId, list)
  }

  // 5. Tính kết quả cho từng học sinh
  const targetKey = monthKey(year, month)
  const inProgress = isInProgressMonth(year, month)
  const results = students.map(student => {
    const attendance = attendanceMap.get(student.id) ?? []
    const snapshot = snapshotMap.get(student.id)
    const changes = billingMap.get(student.id) ?? []
    const billing = resolveBilling(changes, targetKey)
    const studentClosing = closingBalances.get(student.id)
    const { totalSessions, presentSessions, currentMonthFee, previousBalance, totalAmountDue, needsUpsert } =
      calcStudentTuition(attendance, snapshot, studentClosing?.get(year * 12 + month - 2) ?? 0, billing)

    let debtMonths = 0
    if (previousBalance > 0 && studentClosing) {
      for (let k = year * 12 + month - 2; k >= year * 12 + month - 13; k--) {
        const bal = studentClosing.get(k)
        if (bal !== undefined && bal > 0) debtMonths++
        else break
      }
    }

    const paidAmount = snapshot?.paidAmount ?? 0
    const isFullPaid = snapshot?.isFullPaid ?? false
    const remaining = dueNow({
      previousBalance,
      totalExpected: currentMonthFee,
      totalAmountDue,
      paidAmount,
      isFullPaid,
      billingMode: billing.mode,
      inProgress,
    })
    const noticeSentAt = snapshot?.noticeSentAt ?? null
    const noticeSentAmount = snapshot?.noticeSentAmount ?? null
    let noticeStatus: NoticeStatus = "none"
    if (noticeSentAt !== null) {
      // Đã đóng đủ thì phiếu hết tác dụng: không gợi ý gửi lại (review V I2).
      noticeStatus = remaining === noticeSentAmount || remaining === 0 ? "sent" : "changed"
    }

    return {
      studentId: student.id,
      fullName: student.fullName,
      grade: student.grade,
      totalSessions,
      presentSessions,
      totalExpected: currentMonthFee,
      paidAmount,
      isFullPaid,
      notes: snapshot?.notes ?? null,
      previousBalance,
      totalAmountDue,
      needsUpsert,
      billingMode: billing.mode,
      monthlyFee: billing.monthlyFee,
      noticeSentAt,
      noticeSentAmount,
      noticeStatus,
      inProgress,
      debtMonths,
    }
  })

  // 6. Upsert toàn bộ học sinh cần cập nhật (không chỉ trang hiện tại)
  const toUpsert = persist ? results.filter(i => i.needsUpsert) : []
  if (toUpsert.length > 0) {
    await Promise.all(
      toUpsert.map(item =>
        db.monthlyTuition.upsert({
          where: { studentId_year_month: { studentId: item.studentId, year, month } },
          update: {
            totalSessions: item.totalSessions,
            presentSessions: item.presentSessions,
            currentMonthFee: item.totalExpected,
            totalAmountDue: item.totalAmountDue,
            previousBalance: item.previousBalance,
          },
          create: {
            studentId: item.studentId,
            year,
            month,
            totalSessions: item.totalSessions,
            presentSessions: item.presentSessions,
            currentMonthFee: item.totalExpected,
            totalAmountDue: item.totalAmountDue,
            previousBalance: item.previousBalance,
            paidAmount: 0,
            isFullPaid: false,
          },
        })
      )
    )
  }

  // 7. Lọc theo status và noticeFilter — dùng chung helper với badge client.
  let filteredResults =
    status && status !== "all"
      ? results.filter(item => {
          const rowStatus = getRowStatus(item)
          if (status === "fully_paid") {
            return (
              rowStatus === "fully_paid" ||
              rowStatus === "overpaid" ||
              rowStatus === "settled_waived" ||
              rowStatus === "in_progress"
            )
          }
          if (status === "paid_this_month") return rowStatus === "paid_this_month"
          if (status === "partial") return rowStatus === "partial"
          if (status === "unpaid") return rowStatus === "unpaid"
          return true
        })
      : results

  if (noticeFilter && noticeFilter !== "all") {
    filteredResults = filteredResults.filter(item => {
      if (noticeFilter === "sent") {
        return item.noticeStatus === "sent"
      }
      if (noticeFilter === "unsent") {
        const remaining = dueNow(item)
        return (item.noticeStatus === "none" || item.noticeStatus === "changed") && remaining > 0
      }
      return true
    })
  }

  // 8. Phân trang
  const totalCount = filteredResults.length
  const skip = (page - 1) * limit
  const pageItems = filteredResults.slice(skip, skip + limit)

  return {
    items: pageItems.map((item) => ({
      studentId: item.studentId,
      fullName: item.fullName,
      grade: item.grade,
      totalSessions: item.totalSessions,
      presentSessions: item.presentSessions,
      totalExpected: item.totalExpected,
      paidAmount: item.paidAmount,
      isFullPaid: item.isFullPaid,
      notes: item.notes,
      previousBalance: item.previousBalance,
      totalAmountDue: item.totalAmountDue,
      billingMode: item.billingMode,
      monthlyFee: item.monthlyFee,
      noticeSentAt: item.noticeSentAt,
      noticeSentAmount: item.noticeSentAmount,
      noticeStatus: item.noticeStatus,
      inProgress: item.inProgress,
      debtMonths: item.debtMonths,
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  }
}

/**
 * Đảm bảo có dòng MonthlyTuition (kèm carry-over đúng) trước khi ghi tiền/tất toán.
 * Tạo dòng trần sẽ đông cứng previousBalance = 0 và làm mất nợ tháng trước
 * (xem tests/integration/tuition-payment-snapshot.test.ts).
 */
export async function ensureMonthlyTuition(
  db: PrismaClient,
  userId: number,
  studentId: number,
  year: number,
  month: number
): Promise<MonthlyTuition> {
  const student = await db.student.findUnique({ where: { id: studentId } })
  assertOwnership(student, userId)

  try {
    await getMonthlyTuitionStatus(db, userId, { studentId, year, month, status: "all", page: 1, limit: 1 })
  } catch (e) {
    // 2 request cùng mở tháng mới: upsert snapshot không nguyên tử, bên thua gặp P2002 nhưng dòng đã có.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e
  }

  return db.monthlyTuition.upsert({
    where: { studentId_year_month: { studentId, year, month } },
    update: {},
    create: { studentId, year, month },
  })
}

// Tất toán (miễn phần còn lại) + ghi chú tháng; không đụng paidAmount, không ghi vết.
export async function updateSettlement(
  db: PrismaClient,
  userId: number,
  input: UpdateSettlementInput
): Promise<MonthlyTuition> {
  const mt = await ensureMonthlyTuition(db, userId, input.studentId, input.year, input.month)
  return db.monthlyTuition.update({
    where: { id: mt.id },
    data: {
      ...(input.isFullPaid !== undefined && { isFullPaid: input.isFullPaid }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  })
}

export async function setNoticeSent(
  db: PrismaClient,
  userId: number,
  input: SetNoticeSentInput
): Promise<{ noticeSentAt: Date | null; noticeSentAmount: number | null }> {
  const mt = await ensureMonthlyTuition(db, userId, input.studentId, input.year, input.month)

  if (!input.sent) {
    return db.monthlyTuition.update({
      where: { id: mt.id },
      data: {
        noticeSentAt: null,
        noticeSentAmount: null,
      },
      select: { noticeSentAt: true, noticeSentAmount: true },
    })
  }

  const statusRes = await getMonthlyTuitionStatus(
    db,
    userId,
    {
      studentId: input.studentId,
      year: input.year,
      month: input.month,
      status: "all",
      page: 1,
      limit: 1,
    },
    false,
    [input.studentId]
  )
  const item = statusRes.items[0]
  const remaining = item ? dueNow(item) : 0

  return db.monthlyTuition.update({
    where: { id: mt.id },
    data: {
      noticeSentAt: new Date(),
      noticeSentAmount: remaining,
    },
    select: { noticeSentAt: true, noticeSentAmount: true },
  })
}

/**
 * Aggregate outstanding tuition for a month, using the EXACT same per-student
 * computation as the tuition page (carry-over included, netted per student).
 * Reuses getMonthlyTuitionStatus so Dashboard/Reports cannot drift from it.
 *
 * `totalOutstanding` = Σ max(0, totalAmountDue - paidAmount) per student — a
 * student's overpayment never offsets another student's debt.
 */
export async function getMonthlyOutstanding(
  db: PrismaClient,
  userId: number,
  params: { year: number; month: number; grade?: number }
): Promise<{ totalOutstanding: number }> {
  // R4 (CHỦ ĐÍCH, đừng "sửa" thành grade-aware từng tháng): "Còn nợ" là TỔNG nợ
  // lũy kế của HS đang thuộc khối lọc tại tháng cuối kỳ. Nợ là số dư chạy xuyên
  // nhiều tháng/khối, không tách sạch theo khối được — tách ra sẽ GIẤU nợ thật,
  // trái mục đích báo cáo "ai đang nợ". Khác cơ sở với totalPaid (dòng tiền trong
  // kỳ) là bình thường vì hai số đo hai thứ khác nhau.
  const { items } = await getMonthlyTuitionStatus(
    db,
    userId,
    {
      year: params.year,
      month: params.month,
      grade: params.grade,
      status: "all",
      page: 1,
      limit: 1_000_000,
    },
    false // read-only: chỉ tổng hợp, không ghi snapshot
  )

  let totalOutstanding = 0
  for (const it of items) {
    // isFullPaid = tất toán tháng cuối kỳ → không còn nợ dương (khớp carry-over)
    totalOutstanding += it.isFullPaid ? 0 : Math.max(0, it.totalAmountDue - it.paidAmount)
  }

  return { totalOutstanding }
}
