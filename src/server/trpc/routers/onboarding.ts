import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { dismissOnboarding, getOnboardingStatus } from "@/server/services/onboarding.service"

export const onboardingRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) => getOnboardingStatus(ctx.db, ctx.userId)),
  dismiss: protectedProcedure.mutation(({ ctx }) => dismissOnboarding(ctx.db, ctx.userId)),
})
