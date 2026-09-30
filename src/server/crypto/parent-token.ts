import { createHash } from "node:crypto"

// Token 256-bit ngẫu nhiên nên SHA-256 trần là đủ (không cần salt/HMAC). Khớp sha256() của Postgres trong migration O.
export function hashParentToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
