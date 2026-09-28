import type { PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { vnDateParts } from "@/lib/utils"
import { getMonthlyTuitionStatus } from "./tuition.service"

export type DeleteCheck =
  | { allowed: true }
  | { allowed: false; reason: "active_with_data" }
  | { allowed: false; reason: "debt"; debt: number }

// Chỉ xoá HS "sạch" (spec R2): chưa có dữ liệu học, hoặc đã nghỉ và hết nợ lũy kế.
export async function checkStudentDeletable(
  db: PrismaClient,
  userId: number,
  student: { id: number; isActive: boolean }
): Promise<DeleteCheck> {
  const [attended, paid] = await Promise.all([
    db.sessionStudent.count({
      where: {
        studentId: student.id,
        attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] },
        session: { isDeleted: false },
      },
    }),
    db.payment.count({ where: { monthlyTuition: { studentId: student.id } } }),
  ])
  if (attended === 0 && paid === 0) return { allowed: true }
  if (student.isActive) return { allowed: false, reason: "active_with_data" }

  const { year, month } = vnDateParts()
  const status = await getMonthlyTuitionStatus(
    db,
    userId,
    { year, month, status: "all", page: 1, limit: 1 },
    false,
    [student.id]
  )
  const row = status.items[0]
  const debt = row && !row.isFullPaid ? Math.max(0, row.totalAmountDue - row.paidAmount) : 0
  return debt > 0 ? { allowed: false, reason: "debt", debt } : { allowed: true }
}
