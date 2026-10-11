import { TRPCError } from "@trpc/server"
import { Prisma, type PrismaClient } from "@prisma/client"
import { assertOwnership } from "./_base.service"
import { monthKey, resolvePlaceBilling, type PlaceBilling } from "@/lib/billing"
import { vnDateParts } from "@/lib/utils"
import type { PlaceCreateInput, PlaceKind, PlaceUpdateInput } from "@/lib/schemas/place"

export type PlaceDTO = {
  id: number
  name: string
  kind: PlaceKind
  color: string
  billing: PlaceBilling
  sortOrder: number
  activeStudents: number
  futureSessions: number
  // Đã có HS/ca (kể cả cũ): đổi cách tính sẽ áp từ tháng hiện tại, form cần cảnh báo.
  hasData: boolean
}

export type PlaceSummary = { count: number; hasPerStudent: boolean; hasPerSession: boolean }

function currentKey() {
  const { year, month } = vnDateParts()
  return monthKey(year, month)
}

function todayVn() {
  const { year, month, day } = vnDateParts()
  return new Date(Date.UTC(year, month - 1, day))
}

const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message })

async function loadPlaces(db: PrismaClient | Prisma.TransactionClient, userId: number) {
  return db.teachingPlace.findMany({
    where: { userId, isDeleted: false },
    include: { billingChanges: { select: { fromKey: true, billing: true } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}

export async function listPlaces(db: PrismaClient, userId: number): Promise<PlaceDTO[]> {
  const key = currentKey()
  const [places, students, sessions, allStudents, allSessions] = await Promise.all([
    loadPlaces(db, userId),
    db.student.groupBy({ by: ["placeId"], where: { userId, isActive: true }, _count: true }),
    db.teachingSession.groupBy({
      by: ["placeId"],
      where: { userId, sessionDate: { gte: todayVn() }, status: { not: "cancelled" } },
      _count: true,
    }),
    db.student.groupBy({ by: ["placeId"], where: { userId }, _count: true }),
    db.teachingSession.groupBy({ by: ["placeId"], where: { userId }, _count: true }),
  ])
  const count = (rows: { placeId: number | null; _count: number }[], id: number) =>
    rows.find((r) => r.placeId === id)?._count ?? 0
  return places.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind as PlaceKind,
    color: p.color,
    billing: resolvePlaceBilling(p.billingChanges, key),
    sortOrder: p.sortOrder,
    activeStudents: count(students, p.id),
    futureSessions: count(sessions, p.id),
    hasData: count(allStudents, p.id) + count(allSessions, p.id) > 0,
  }))
}

// Tính theo tháng hiện tại VN. Chưa có nơi nào thì coi như theo học sinh (spec AL §2) để không ẩn nhầm Học phí.
export async function getPlaceSummary(db: PrismaClient, userId: number): Promise<PlaceSummary> {
  const key = currentKey()
  const billings = (await loadPlaces(db, userId)).map((p) => resolvePlaceBilling(p.billingChanges, key))
  return {
    count: billings.length,
    hasPerStudent: billings.length === 0 || billings.includes("per_student"),
    hasPerSession: billings.includes("per_session"),
  }
}

// Tên trùng nơi đã xoá mềm (unique userId+name vẫn giữ): dựng lại nơi đó thay vì báo trùng.
async function reviveDeleted(tx: Prisma.TransactionClient, userId: number, input: PlaceCreateInput, sortOrder: number) {
  const old = await tx.teachingPlace.findUnique({ where: { userId_name: { userId, name: input.name } } })
  if (!old || !old.isDeleted) return null
  await tx.placeBillingChange.deleteMany({ where: { placeId: old.id } })
  return tx.teachingPlace.update({
    where: { id: old.id },
    data: {
      kind: input.kind,
      color: input.color,
      sortOrder,
      isDeleted: false,
      deletedAt: null,
      billingChanges: { create: { fromKey: 0, billing: input.billing } },
    },
  })
}

export async function createPlaceTx(tx: Prisma.TransactionClient, userId: number, input: PlaceCreateInput) {
  const sortOrder =
    ((await tx.teachingPlace.aggregate({ where: { userId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1
  const revived = await reviveDeleted(tx, userId, input, sortOrder)
  if (revived) return revived
  return tx.teachingPlace.create({
    data: {
      userId,
      name: input.name,
      kind: input.kind,
      color: input.color,
      sortOrder,
      // Nơi mới chưa có HS/ca: cách tính áp cho mọi tháng.
      billingChanges: { create: { fromKey: 0, billing: input.billing } },
    },
  })
}

function conflictOnDuplicate(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new TRPCError({ code: "CONFLICT", message: "place_duplicate" })
  }
  throw e
}

export async function createPlace(db: PrismaClient, userId: number, input: PlaceCreateInput) {
  try {
    return await db.$transaction((tx) => createPlaceTx(tx, userId, input))
  } catch (e) {
    conflictOnDuplicate(e)
  }
}

export async function updatePlace(db: PrismaClient, userId: number, input: PlaceUpdateInput) {
  const existing = await db.teachingPlace.findFirst({
    where: { id: input.id, isDeleted: false },
    include: { billingChanges: { select: { fromKey: true, billing: true } } },
  })
  assertOwnership(existing, userId)
  const key = currentKey()

  try {
    return await db.$transaction(async (tx) => {
      if (input.billing && input.billing !== resolvePlaceBilling(existing.billingChanges, key)) {
        const used =
          (await tx.student.count({ where: { placeId: existing.id } })) +
          (await tx.teachingSession.count({ where: { placeId: existing.id } }))
        if (used === 0) {
          // Chưa có dữ liệu: đổi luôn cho mọi tháng.
          await tx.placeBillingChange.deleteMany({ where: { placeId: existing.id } })
          await tx.placeBillingChange.create({ data: { placeId: existing.id, fromKey: 0, billing: input.billing } })
        } else {
          // Có dữ liệu: áp từ tháng hiện tại VN, tháng cũ giữ nguyên (như đổi cách thu của HS).
          await tx.placeBillingChange.upsert({
            where: { placeId_fromKey: { placeId: existing.id, fromKey: key } },
            create: { placeId: existing.id, fromKey: key, billing: input.billing },
            update: { billing: input.billing },
          })
          // Đổi rồi đổi về như tháng trước → dòng tháng này thừa.
          const before = existing.billingChanges.filter((c) => c.fromKey < key)
          if (before.length > 0 && resolvePlaceBilling(before, key - 1) === input.billing) {
            await tx.placeBillingChange.delete({ where: { placeId_fromKey: { placeId: existing.id, fromKey: key } } })
          }
        }
      }
      return tx.teachingPlace.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.kind !== undefined && { kind: input.kind }),
          ...(input.color !== undefined && { color: input.color }),
        },
      })
    })
  } catch (e) {
    conflictOnDuplicate(e)
  }
}

export async function deletePlace(db: PrismaClient, userId: number, id: number) {
  return db.$transaction(async (tx) => {
    const existing = await tx.teachingPlace.findFirst({ where: { id, isDeleted: false } })
    assertOwnership(existing, userId)
    if ((await tx.teachingPlace.count({ where: { userId, isDeleted: false } })) <= 1) throw bad("place_last")
    const students = await tx.student.count({ where: { placeId: id, isActive: true } })
    const sessions = await tx.teachingSession.count({
      where: { placeId: id, sessionDate: { gte: todayVn() }, status: { not: "cancelled" } },
    })
    if (students > 0 || sessions > 0) throw bad("place_in_use")
    await tx.teachingPlace.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } })
    return { success: true as const }
  })
}

// Nơi phải của chính user và chưa xoá; sai → NOT_FOUND (không lộ nơi của người khác).
export async function assertPlaceOwned(db: PrismaClient | Prisma.TransactionClient, userId: number, placeId: number) {
  const place = await db.teachingPlace.findFirst({ where: { id: placeId, isDeleted: false }, select: { userId: true } })
  assertOwnership(place, userId)
}

// Nơi mặc định (spec AL §2): nơi theo học sinh đầu tiên theo sortOrder; không có thì nơi đầu tiên; chưa có nơi → null.
export async function defaultPlaceId(db: PrismaClient | Prisma.TransactionClient, userId: number): Promise<number | null> {
  const key = currentKey()
  const places = await loadPlaces(db, userId)
  return (places.find((p) => resolvePlaceBilling(p.billingChanges, key) === "per_student") ?? places[0])?.id ?? null
}

// Nơi của ca mới (spec AL §4.3): nơi chọn trong form, không có thì nơi học của HS đầu tiên, rồi mới tới nơi mặc định.
export async function resolveSessionPlace(
  db: PrismaClient | Prisma.TransactionClient,
  userId: number,
  placeId: number | undefined,
  studentIds: number[] | undefined
): Promise<number | null> {
  if (placeId) {
    await assertPlaceOwned(db, userId, placeId)
    return placeId
  }
  if (studentIds?.length) {
    const first = await db.student.findFirst({ where: { id: studentIds[0], userId }, select: { placeId: true } })
    if (first?.placeId) return first.placeId
  }
  return defaultPlaceId(db, userId)
}
