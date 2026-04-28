import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/server/trpc/root"
import { createTRPCContext } from "@/server/trpc"

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts),
    onError({ error, path }) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[tRPC] ${path}: ${error.message}`)
      }
    },
  })

export { handler as GET, handler as POST }
