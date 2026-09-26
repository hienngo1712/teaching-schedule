import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/server/auth"
import { RegisterForm } from "./RegisterForm"
import { RegisterHeader } from "./RegisterHeader"

export default async function RegisterPage() {
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <RegisterHeader />
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  )
}
