// Chặn open redirect qua ?callbackUrl=. Middleware/next-auth gắn URL tuyệt đối cùng origin nên vẫn nhận, đổi về đường dẫn.
export function safeCallbackUrl(raw: string | null, origin: string, fallback = "/dashboard"): string {
  if (!raw) return fallback
  if (!raw.startsWith("/") && !raw.startsWith(origin + "/")) return fallback
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return fallback
  }
  // Trình duyệt bỏ tab/xuống dòng và coi "\" là "/" → so origin sau khi parse mới chắc.
  if (url.origin !== origin) return fallback
  const path = url.pathname + url.search + url.hash
  return path.startsWith("//") ? fallback : path
}
