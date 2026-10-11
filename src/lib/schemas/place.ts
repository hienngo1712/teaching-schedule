import { z } from "zod"

export const PLACE_KINDS = ["home", "tutor", "center"] as const
export const PLACE_BILLINGS = ["per_student", "per_session"] as const
export type PlaceKind = (typeof PLACE_KINDS)[number]

export const placeCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(PLACE_KINDS),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  billing: z.enum(PLACE_BILLINGS),
})

export const placeUpdateSchema = placeCreateSchema.partial().extend({ id: z.number().int().positive() })

export const placeSetupSchema = z.object({
  home: z.boolean(),
  tutor: z.boolean(),
  centers: z.array(z.string().trim().max(100)).max(10),
})

export type PlaceCreateInput = z.infer<typeof placeCreateSchema>
export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>
export type PlaceSetupInput = z.infer<typeof placeSetupSchema>

// Mặc định cách tính theo loại (spec AL §4.1): lớp tại nhà/gia sư theo học sinh, trung tâm theo ca/giờ.
export function defaultBilling(kind: PlaceKind): (typeof PLACE_BILLINGS)[number] {
  return kind === "center" ? "per_session" : "per_student"
}
