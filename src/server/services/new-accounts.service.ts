import type { Prisma } from "@prisma/client"
import { adminUsernames } from "@/lib/admin"
import type { Db } from "./plan.service"

// Tài khoản mới admin chưa xem (spec K R1): không admin, chưa xóa mềm (Q).
export function newAccountsWhere(): Prisma.UserWhereInput {
  return { adminSeenAt: null, isDeleted: false, username: { notIn: adminUsernames() } }
}

export function countNewAccounts(db: Db): Promise<number> {
  return db.user.count({ where: newAccountsWhere() })
}
