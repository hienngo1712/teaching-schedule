import { headers } from "next/headers"

// Tách khỏi file "use server": hàm export ở đó sẽ thành server action gọi được từ client.
export async function getRequestIp(): Promise<string | null> {
  const h = await headers()
  const fwd = h.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() ?? h.get("x-real-ip")
}
