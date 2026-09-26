"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { registerSchema, type RegisterInput } from "@/lib/schemas/auth"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function RegisterForm() {
  const router = useRouter()
  const { t } = useTranslation()

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
    },
  })

  const mutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success(t("register_success"))
      router.push("/login")
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  function onSubmit(values: RegisterInput) {
    mutation.mutate(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("username")}</FormLabel>
              <FormControl>
                <Input placeholder="giaovien123" {...field} disabled={mutation.isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fullname_optional")}</FormLabel>
              <FormControl>
                <Input placeholder="Nguyễn Văn A" {...field} disabled={mutation.isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("password")}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="••••••••••"
                  {...field}
                  disabled={mutation.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? t("processing") : t("register")}
        </Button>

        <div className="text-center text-sm">
          <span className="text-slate-500">{t("already_have_account")} </span>
          <Link href="/login" className="text-primary hover:underline font-medium">
            {t("login_now")}
          </Link>
        </div>
      </form>
    </Form>
  )
}
