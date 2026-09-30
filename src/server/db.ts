import { PrismaClient } from "@prisma/client"
import { withLiveFilter } from "./soft-delete"
import { withFieldEncryption } from "./crypto/prisma-encryption"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    // Bỏ "query" log để tránh I/O stdout chậm 5–20ms mỗi query.
    log: ["error", "warn"],
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now()
        // Tự bỏ bản đã xoá mềm ở thao tác đọc cấp cao (spec Q Q1); quan hệ/raw SQL lọc tay.
        const result = await query(withLiveFilter(model, operation, args) as typeof args)
        const duration = Date.now() - start
        if (duration > 100) { // Chỉ log các query chậm > 100ms để tránh noise
          console.log(`[Prisma] ${model}.${operation} - ${duration}ms`)
        }
        return result
      },
    },
  }) as unknown as PrismaClient

  // Mã hoá bọc ngoài cùng (spec O 6.3, 6.13): mọi đường ghi qua db đều mã hoá, kể cả thao tác xoá mềm.
  return withFieldEncryption(base)
}

// $extends chỉ áp một lần lúc tạo, tránh bọc chồng lớp qua mỗi lần HMR.
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
