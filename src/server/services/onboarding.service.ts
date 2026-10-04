import type { PrismaClient } from "@prisma/client"

export type OnboardingStatus = {
  dismissed: boolean
  steps: { student: boolean; session: boolean; attendance: boolean; payment: boolean; bank: boolean }
}

export async function getOnboardingStatus(db: PrismaClient, userId: number): Promise<OnboardingStatus> {
  const [user, student, session, attendance, payment] = await Promise.all([
    // bankAccountNumber mã hoá → đọc ra rồi kiểm ở JS, không lọc DB.
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardingDismissedAt: true, bankAccountNumber: true } }),
    db.student.findFirst({ where: { userId }, select: { id: true } }),
    db.teachingSession.findFirst({ where: { userId }, select: { id: true } }),
    // Quan hệ lồng không được extension xoá mềm lọc → tự thêm isDeleted.
    db.sessionStudent.findFirst({
      where: { attendance: { not: "pending" }, session: { userId, isDeleted: false }, student: { isDeleted: false } },
      select: { id: true },
    }),
    db.payment.findFirst({ where: { monthlyTuition: { student: { userId, isDeleted: false } } }, select: { id: true } }),
  ])
  return {
    dismissed: user.onboardingDismissedAt !== null,
    steps: { student: !!student, session: !!session, attendance: !!attendance, payment: !!payment, bank: !!user.bankAccountNumber },
  }
}

export async function dismissOnboarding(db: PrismaClient, userId: number) {
  await db.user.update({ where: { id: userId }, data: { onboardingDismissedAt: new Date() } })
  return { ok: true as const }
}
