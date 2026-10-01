import type { PrismaClient } from '@prisma/client';
import { decryptField, isEncrypted } from '../../../src/server/crypto/field-crypto';

// Tên HS đã mã hoá nên không lọc startsWith trong DB được: tải id + tên, giải mã rồi lọc.
export async function studentIdsByNamePrefix(db: PrismaClient, prefix: string): Promise<number[]> {
  const rows = await db.student.findMany({ select: { id: true, fullName: true } });
  return rows
    .filter((r) => (isEncrypted(r.fullName) ? decryptField(r.fullName, 'fullName') : r.fullName).startsWith(prefix))
    .map((r) => r.id);
}

// Xoá cứng theo id; FK cascade dọn monthly_tuition, payments, session_students.
export async function hardDeleteStudents(db: PrismaClient, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.student.deleteMany({ where: { id: { in: ids } } });
}
