import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server"
import { createTRPCReact } from "@trpc/react-query"
import type { AppRouter } from "@/server/trpc/root"

export const trpc = createTRPCReact<AppRouter>()

export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>
