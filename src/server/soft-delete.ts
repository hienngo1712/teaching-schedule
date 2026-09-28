// Xoá mềm (spec Q). User không nằm đây: đăng ký/đăng nhập/admin phải thấy tài khoản đã xoá.
export const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set(["Student", "Subject", "TeachingSession", "Payment"])

const READ_OPS: ReadonlySet<string> = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy",
])

export const LIVE = { isDeleted: false } as const
// Lọc danh sách sessionStudents: HS đã xoá không hiện ở ca/điểm danh/học phí.
export const LIVE_LINK = { student: { isDeleted: false } } as const
// Số liệu tiền/điểm danh lịch sử (Báo cáo, Tổng quan) tính cả HS đã xoá: tiền đã thu là tiền thật (spec R8).
export const HISTORY_LINK = {} as const
// Có khoá isDeleted nên extension không đè; Prisma bỏ qua undefined → đọc cả bản đã xoá.
export const WITH_DELETED = { isDeleted: undefined }
export const RESTORE_DATA = { isDeleted: false, deletedAt: null } as const

export function softDeleteData(now: Date = new Date()) {
  return { isDeleted: true as const, deletedAt: now }
}

// Chỉ lọc cấp cao nhất của thao tác đọc: include/some/none/_count và raw SQL phải lọc tay (xem plan Q).
export function withLiveFilter(model: string | undefined, operation: string, args: unknown): unknown {
  if (!model || !SOFT_DELETE_MODELS.has(model) || !READ_OPS.has(operation)) return args
  const a = (args ?? {}) as { where?: Record<string, unknown> }
  const where = a.where ?? {}
  if ("isDeleted" in where) return args
  return { ...a, where: { ...where, isDeleted: false } }
}
