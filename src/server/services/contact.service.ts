import type { PrismaClient } from "@prisma/client"
import type { ContactInput } from "@/lib/schemas/contact"

// Dòng mới nhất là liên hệ hiện hành (spec AG §3, mẫu PlanPriceChange).
export async function getContact(db: PrismaClient): Promise<{ phone: string; facebookUrl: string | null } | null> {
  return db.contactChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { phone: true, facebookUrl: true },
  })
}

export async function updateContact(db: PrismaClient, admin: string, input: ContactInput): Promise<{ success: true }> {
  await db.contactChange.create({ data: { phone: input.phone, facebookUrl: input.facebookUrl, changedBy: admin } })
  console.info(`[admin] ${admin} sửa liên hệ chủ app`)
  return { success: true }
}

export async function getContactHistory(db: PrismaClient) {
  return db.contactChange.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: { id: true, phone: true, facebookUrl: true, changedBy: true, createdAt: true },
  })
}
