// Thuần, không kéo Prisma: middleware Edge (auth.config.ts) và layout server cùng dùng.
export function adminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAdminUsername(username?: string | null): boolean {
  if (!username) return false
  return adminUsernames().includes(username)
}
