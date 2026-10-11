import type { Prisma, PrismaClient } from "@prisma/client"
import {
  PER_SESSION,
  resolveBilling,
  resolvePlaceBilling,
  type Billing,
  type BillingChange,
  type BillingMode,
  type PlaceBillingChange,
} from "@/lib/billing"

// Nơi của HS tại tháng key: dòng lịch sử fromKey lớn nhất <= key
function placeAt(history: { fromKey: number; placeId: number }[], key: number): number | null {
  let found: { fromKey: number; placeId: number } | null = null
  for (const h of history) if (h.fromKey <= key && (!found || h.fromKey > found.fromKey)) found = h
  return found?.placeId ?? null
}

// Tải lịch sử cách thu của danh sách học sinh, gom theo studentId.
// Gộp thêm nơi học theo thời gian (spec AL §3): tháng HS ở nơi per_session thì dòng có free=true → phí 0.
export async function loadBillingChanges(
  db: PrismaClient | Prisma.TransactionClient,
  studentIds: number[]
): Promise<Map<number, BillingChange[]>> {
  const map = new Map<number, BillingChange[]>()
  if (studentIds.length === 0) return map

  const [rows, students, placeRows] = await Promise.all([
    db.studentBillingChange.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { fromKey: "asc" },
    }),
    db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, userId: true, placeId: true } }),
    db.studentPlaceChange.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, fromKey: true, placeId: true },
    }),
  ])

  for (const r of rows) {
    const list = map.get(r.studentId) ?? []
    list.push({
      fromKey: r.fromKey,
      mode: r.mode as BillingMode,
      monthlyFee: r.monthlyFee,
    })
    map.set(r.studentId, list)
  }

  const history = new Map<number, { fromKey: number; placeId: number }[]>()
  for (const r of placeRows) history.set(r.studentId, [...(history.get(r.studentId) ?? []), r])
  // HS chưa có lịch sử nhưng đã gắn nơi (dữ liệu cũ): coi như ở nơi đó từ đầu. Không nơi nào → theo học sinh.
  for (const s of students) if (!history.has(s.id) && s.placeId) history.set(s.id, [{ fromKey: 0, placeId: s.placeId }])
  if (history.size === 0) return map

  const placeIds = [...new Set([...history.values()].flat().map((h) => h.placeId))]
  const placeChanges = await db.placeBillingChange.findMany({
    where: { placeId: { in: placeIds } },
    select: { placeId: true, fromKey: true, billing: true },
  })
  const billingByPlace = new Map<number, PlaceBillingChange[]>()
  for (const c of placeChanges) billingByPlace.set(c.placeId, [...(billingByPlace.get(c.placeId) ?? []), c])
  // Không có nơi nào per_session thì không cần gộp (giữ nguyên lịch sử cách thu như trước AL).
  if (!placeChanges.some((c) => c.billing === "per_session")) return map

  for (const [studentId, hist] of history) {
    const own = map.get(studentId) ?? []
    const keys = new Set<number>([0, ...own.map((c) => c.fromKey), ...hist.map((h) => h.fromKey)])
    for (const h of hist) for (const c of billingByPlace.get(h.placeId) ?? []) keys.add(c.fromKey)
    const merged: BillingChange[] = [...keys]
      .sort((a, b) => a - b)
      .map((key) => {
        const b = resolveBilling(own, key)
        const placeId = placeAt(hist, key)
        const free = placeId !== null && resolvePlaceBilling(billingByPlace.get(placeId) ?? [], key) === "per_session"
        return free ? { fromKey: key, mode: b.mode, monthlyFee: b.monthlyFee, free: true } : { fromKey: key, ...b }
      })
    map.set(studentId, merged)
  }

  return map
}

// Ghi lịch sử nơi học (RULING AL Task 2): tạo HS → fromKey 0; đổi nơi → fromKey tháng hiện tại VN, upsert.
export async function recordPlaceChange(
  tx: Prisma.TransactionClient | PrismaClient,
  studentId: number,
  placeId: number,
  fromKey: number
): Promise<void> {
  await tx.studentPlaceChange.upsert({
    where: { studentId_fromKey: { studentId, fromKey } },
    create: { studentId, fromKey, placeId },
    update: { placeId },
  })
}

// Ghi lịch sử cách thu: upsert dòng fromKey; nếu trùng dòng trước thì xoá (spec T 3)
export async function recordBillingChange(
  tx: Prisma.TransactionClient,
  studentId: number,
  fromKey: number,
  next: Billing
): Promise<void> {
  const mode = next.mode
  const monthlyFee = next.mode === "per_session" ? 0 : next.monthlyFee

  await tx.studentBillingChange.upsert({
    where: { studentId_fromKey: { studentId, fromKey } },
    create: { studentId, fromKey, mode, monthlyFee },
    update: { mode, monthlyFee },
  })

  const prev = await tx.studentBillingChange.findFirst({
    where: { studentId, fromKey: { lt: fromKey } },
    orderBy: { fromKey: "desc" },
  })

  const prevBilling: Billing = prev
    ? { mode: prev.mode as BillingMode, monthlyFee: prev.monthlyFee }
    : PER_SESSION

  // Đổi rồi đổi về như tháng trước -> dòng tháng này thừa (xoá để tránh lịch sử rác)
  if (prevBilling.mode === mode && prevBilling.monthlyFee === monthlyFee) {
    await tx.studentBillingChange.delete({
      where: { studentId_fromKey: { studentId, fromKey } },
    })
  }
}
