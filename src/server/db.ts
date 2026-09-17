import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    // Bỏ "query" log để tránh I/O stdout chậm 5–20ms mỗi query.
    log: ["error", "warn"],
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now()
        const result = await query(args)
        const duration = Date.now() - start
        if (duration > 100) { // Chỉ log các query chậm > 100ms để tránh noise
          console.log(`[Prisma] ${model}.${operation} - ${duration}ms`)
        }
        return result
      },
    },
  }) as unknown as PrismaClient
}

// $extends chỉ áp một lần lúc tạo, tránh bọc chồng lớp qua mỗi lần HMR.
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
