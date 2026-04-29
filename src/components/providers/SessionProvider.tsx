"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <NextAuthSessionProvider
      // Pass initial session từ server → loại bỏ fetch /api/auth/session ban đầu.
      session={session}
      // Tắt mọi background refetch — session chỉ thay đổi khi signIn/signOut.
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </NextAuthSessionProvider>
  )
}
