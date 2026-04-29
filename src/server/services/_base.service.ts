import { TRPCError } from "@trpc/server"

/**
 * Verify record thuộc về userId. Throw NOT_FOUND nếu null hoặc khác user.
 *
 * QUAN TRỌNG: trả NOT_FOUND (không phải FORBIDDEN) cả khi record của user khác,
 * để không tiết lộ sự tồn tại của record đó với user hiện tại.
 *
 * Dùng trước mọi update / delete operation trong các service.
 */
export function assertOwnership(
  record: { userId: number } | null | undefined,
  userId: number
): asserts record is { userId: number } {
  if (!record || record.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
}
