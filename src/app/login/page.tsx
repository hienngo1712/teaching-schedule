import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/server/auth"
import { LoginForm } from "./LoginForm"
import { LoginHeader } from "./LoginHeader"

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <LoginHeader />
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
