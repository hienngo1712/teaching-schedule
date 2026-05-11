import { z } from "zod"

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(1000).default(5),
})

export type PaginatedResponse<T> = {
  items: T[]
  totalCount: number
  totalPages: number
}
