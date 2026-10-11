import { randomBytes } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import bcrypt from "bcryptjs"
import { isAdminUsername } from "@/lib/admin"
import { TX_OPTIONS } from "./payment.service"
import { cancelActiveLinks, teacherPayosConfig } from "./payos-teacher.service"

// Xoá vĩnh viễn được sau 30 ngày nằm trong Đã xoá (spec AQ §2).
export const PURGE_WAIT_DAYS = 30
const DAY = 86_400_000

export function purgeAvailableAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + PURGE_WAIT_DAYS * DAY)
}

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })

export type PurgeResult = {
  deleted: { students: number; sessions: number; tuition: number; places: number; personal: number }
}

// Spec AQ §3–4: xoá mọi dữ liệu dạy học + cá nhân trong 1 transaction; giữ plan_orders (+ payments) và log admin,
// dòng users còn lại là "bia mộ" ẩn danh để khoá ngoại của đơn mua gói vẫn đúng.
export async function purgeUser(
  db: PrismaClient,
  admin: { id: number; username: string },
  userId: number,
  confirmUsername: string
): Promise<PurgeResult> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true, isDeleted: true, deletedAt: true, purgedAt: true } })
  if (!user) throw notFound()
  if (isAdminUsername(user.username) || userId === admin.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Không xoá được tài khoản quản trị" })
  }
  if (!user.isDeleted || user.purgedAt || !user.deletedAt) throw notFound()
  if (purgeAvailableAt(user.deletedAt) > new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "purge_too_early" })
  // So khớp nguyên văn (Review Focus 5): không trim, không đổi hoa thường.
  if (confirmUsername !== user.username) throw new TRPCError({ code: "BAD_REQUEST", message: "purge_confirm_mismatch" })

  // Huỷ link payOS đang mở để QR cũ không trả được nữa; lỗi payOS không chặn việc xoá (đã log trong cancelActiveLinks).
  const payos = await db.teacherPayos.findUnique({ where: { userId } })
  if (payos) await cancelActiveLinks(db, userId, teacherPayosConfig(payos))

  const tombHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10)

  const deleted = await db.$transaction(async (tx) => {
    // Bấm 2 lần / 2 tab: lần sau thấy purgedAt và dừng.
    const fresh = await tx.user.findUnique({ where: { id: userId }, select: { purgedAt: true, isDeleted: true } })
    if (!fresh || fresh.purgedAt || !fresh.isDeleted) throw notFound()

    const students = { where: { student: { userId } } }
    const tuition =
      (await tx.payment.deleteMany({ where: { monthlyTuition: { student: { userId } } } })).count +
      (await tx.monthlyTuition.deleteMany(students)).count +
      (await tx.tuitionPayLinkPayment.deleteMany({ where: { link: { userId } } })).count +
      (await tx.tuitionPayLink.deleteMany({ where: { userId } })).count
    const sessions =
      (await tx.sessionStudent.deleteMany({ where: { session: { userId } } })).count +
      (await tx.teachingSession.deleteMany({ where: { userId } })).count
    await tx.studentBillingChange.deleteMany(students)
    await tx.studentPlaceChange.deleteMany(students)
    const studentCount = (await tx.student.deleteMany({ where: { userId } })).count
    await tx.subject.deleteMany({ where: { userId } })
    await tx.classUpgradeLog.deleteMany({ where: { userId } })

    // Bảng con của nơi dạy xoá theo (onDelete Cascade): billing/rate changes, payments, share link, notices, pay links.
    const places = (await tx.teachingPlace.deleteMany({ where: { userId } })).count

    const personal =
      (await tx.teacherPayos.deleteMany({ where: { userId } })).count +
      (await tx.userActivityDay.deleteMany({ where: { userId } })).count +
      (await tx.consentRecord.deleteMany({ where: { userId } })).count +
      // Theo id hoặc tên cũ (đăng nhập thử khi chưa có id); xoá trước khi đổi tên thành deleted_<id>.
      (await tx.loginAttempt.deleteMany({ where: { OR: [{ userId }, { username: user.username }] } })).count +
      (await tx.securityEvent.deleteMany({ where: { userId } })).count +
      (await tx.feedback.deleteMany({ where: { userId } })).count +
      (await tx.chatConversation.deleteMany({ where: { userId } })).count

    await tx.user.update({
      where: { id: userId },
      data: {
        username: `deleted_${userId}`,
        fullName: `TK đã xoá #${userId}`,
        passwordHash: tombHash,
        bankBin: null,
        bankAccountNumber: null,
        bankAccountName: null,
        lastLoginAt: null,
        lastActiveAt: null,
        lastSeenRelease: null,
        onboardingDismissedAt: null,
        feedbackPromptAt: null,
        payosSeenAt: null,
        sessionVersion: { increment: 1 },
        purgedAt: new Date(),
      },
    })
    await tx.securityEvent.create({ data: { userId: admin.id, event: "admin_purge_user" } })

    return { students: studentCount, sessions, tuition, places, personal }
  }, TX_OPTIONS)

  // Chỉ id + số dòng, không tên / PII.
  console.info(`[admin] admin ${admin.id} xoá vĩnh viễn user ${userId}: ${JSON.stringify(deleted)}`)
  return { deleted }
}
