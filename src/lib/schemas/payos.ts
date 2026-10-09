import { z } from "zod"

const key = z.string().trim().min(1).max(200)
export const payosConnectSchema = z.object({ clientId: key, apiKey: key, checksumKey: key })
export type PayosConnectInput = z.infer<typeof payosConnectSchema>
