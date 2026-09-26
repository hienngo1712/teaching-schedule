import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { TRPCProvider } from "@/components/providers/TRPCProvider"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { Toaster } from "@/components/ui/sonner"
import { SpeedInsights } from "@vercel/speed-insights/next"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "Quản lý lịch dạy",
  description: "Ứng dụng quản lý lịch dạy học cá nhân",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TRPCProvider>
          <LanguageProvider>
            {children}
            {/* Không có ThemeProvider (D1): ép sáng để máy đặt chế độ tối không ra toast tối. */}
            <Toaster richColors position="top-right" theme="light" />
            <SpeedInsights />
          </LanguageProvider>
        </TRPCProvider>
      </body>
    </html>
  )
}
