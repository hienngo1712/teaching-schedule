import { auth } from "@/server/auth"
import { AppLayout } from "@/components/layout/AppLayout"
import { SessionProvider } from "@/components/providers/SessionProvider"

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1 lần auth() server-side cho tất cả route trong (app); pass xuống SessionProvider
  // để client không phải gọi /api/auth/session.
  const session = await auth()

  return (
    <SessionProvider session={session}>
      <AppLayout>{children}</AppLayout>
    </SessionProvider>
  )
}
