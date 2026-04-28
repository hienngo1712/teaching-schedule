// Helper xóa toàn bộ dữ liệu test theo thứ tự FK an toàn.
// Phase 2+ sẽ dùng trong integration tests trước mỗi suite.
import { db } from "@/server/db"

export async function resetDb() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.subject.deleteMany()
  await db.student.deleteMany()
  await db.user.deleteMany()
}

export { db }
