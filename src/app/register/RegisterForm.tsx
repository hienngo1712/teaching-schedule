"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { registerFormSchema, type RegisterFormValues } from "@/lib/schemas/auth"
import { CONSENT_ACCEPTED, isConsentError } from "@/lib/consent"
import { ConsentCheckbox } from "@/components/common/ConsentCheckbox"
import { PrivacySummary } from "@/components/privacy/PrivacySummary"
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
  const [consent, setConsent] = useState(false)

  const schema = useMemo(() => registerFormSchema(t("register_password_mismatch")), [t])
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      confirmPassword: "",
    },
  })

  // Chỉ kiểm lại ô Nhập lại sau lần bấm Đăng ký đầu, để không báo lỗi khi người dùng còn đang gõ.
  const password = form.watch("password")
  useEffect(() => {
    if (form.formState.isSubmitted && form.getValues("confirmPassword")) void form.trigger("confirmPassword")
  }, [password, form])

  const mutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success(t("register_success"))
      router.push("/login")
    },
    onError: (err) => {
      if (isConsentError(err)) toast.error(t("consent_required"))
      else toast.error(err.message)
    },
  })

  function onSubmit(data: RegisterFormValues) {
    if (!consent) return
    const { confirmPassword, ...values } = data
    void confirmPassword
    mutation.mutate({ ...values, consent: CONSENT_ACCEPTED })
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
              <p className="text-xs text-slate-500">{t("register_username_hint")}</p>
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

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("register_confirm_password")}</FormLabel>
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

        <PrivacySummary showFullLink />

        <ConsentCheckbox
          id="register-consent"
          label={t("consent_register")}
          checked={consent}
          onCheckedChange={setConsent}
          disabled={mutation.isPending}
        />

        <Button type="submit" className="w-full" disabled={mutation.isPending || !consent}>
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
