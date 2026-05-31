// Nguồn sự thật DUY NHẤT cho danh sách subject mặc định + hàm seed.
//
// Module này CỐ Ý không import gì ngoài `type PrismaClient` để có thể dùng
// được ở mọi nơi mà không kéo theo dependency nặng:
//   - app runtime (src/server/services/user.service.ts → flow đăng ký)
//   - scripts chạy bằng tsx (scripts/_seed-subjects.ts, prisma/seed.ts)
// KHÔNG dùng alias "@/" ở đây: tsx không resolve alias, các script import
// module này bằng đường dẫn tương đối nên phải giữ nó "alias-free".
import type { PrismaClient } from "@prisma/client"

export const DEFAULT_SUBJECTS = [
  { name: "Tiếng Anh", color: "#4F46E5", isDefault: true, sortOrder: 1, isActive: true },
  { name: "Toán", color: "#0891B2", isDefault: false, sortOrder: 2, isActive: true },
  { name: "Tiếng Việt", color: "#059669", isDefault: false, sortOrder: 3, isActive: true },
  { name: "Vật Lý", color: "#D97706", isDefault: false, sortOrder: 4, isActive: false },
  { name: "Hóa Học", color: "#DC2626", isDefault: false, sortOrder: 5, isActive: false },
] as const

export async function seedSubjectsForUser(db: PrismaClient, userId: number) {
  for (const s of DEFAULT_SUBJECTS) {
    await db.subject.upsert({
      where: { userId_name: { userId, name: s.name } },
      update: {},
      create: { ...s, userId },
    })
  }
}
