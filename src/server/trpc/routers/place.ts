import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { placeCreateSchema, placeSetupSchema, placeUpdateSchema } from "@/lib/schemas/place"
import { createPlace, deletePlace, getPlaceSummary, listPlaces, setupInitialPlaces, updatePlace } from "@/server/services/place.service"

// Nơi dạy (spec AL §4.1): mọi gói đều dùng được.
export const placeRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => listPlaces(ctx.db, ctx.userId)),

  summary: protectedProcedure.query(({ ctx }) => getPlaceSummary(ctx.db, ctx.userId)),

  create: protectedProcedure.input(placeCreateSchema).mutation(({ ctx, input }) => createPlace(ctx.db, ctx.userId, input)),

  update: protectedProcedure.input(placeUpdateSchema).mutation(({ ctx, input }) => updatePlace(ctx.db, ctx.userId, input)),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => deletePlace(ctx.db, ctx.userId, input.id)),

  setupInitial: protectedProcedure.input(placeSetupSchema).mutation(({ ctx, input }) => setupInitialPlaces(ctx.db, ctx.userId, input)),
})
