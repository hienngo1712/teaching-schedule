"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { trpc } from "@/lib/trpc"
import { VN_BANKS } from "@/lib/vn-banks"
import { bankAccountSchema, type BankAccountInput } from "@/lib/schemas/settings"
import { useTranslation } from "@/components/providers/LanguageProvider"

const BANK_OPTIONS = [...VN_BANKS].sort((a, b) => a.shortName.localeCompare(b.shortName))

export function BankAccountCard() {
  const { t } = useTranslation()
  const query = trpc.settings.getBankAccount.useQuery()

  if (query.isPending) return <Skeleton className="h-80 w-full max-w-xl rounded-lg" />
  if (query.isError) {
    return (
      <div className="max-w-xl rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
        <p className="text-sm text-slate-600">{t("load_error")}</p>
        <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
          {t("retry")}
        </Button>
      </div>
    )
  }
  // Đổi key khi lưu/xoá → form mount lại với giá trị mới từ server, không cần effect đồng bộ.
  return <BankAccountForm key={query.data ? "set" : "empty"} initial={query.data} />
}

function BankAccountForm({ initial }: { initial: BankAccountInput | null }) {
  const { t } = useTranslation()
  const [bankBin, setBankBin] = useState(initial?.bankBin ?? "")
  const [accountNumber, setAccountNumber] = useState(initial?.bankAccountNumber ?? "")
  const [accountName, setAccountName] = useState(initial?.bankAccountName ?? "")
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // Callback đặt ở hook (không ở mutate) vì form có thể mount lại trước khi mutate-callback chạy.
  const mutation = trpc.settings.updateBankAccount.useMutation({
    onSuccess: (_data, input) => {
      if (input) toast.success(t("bank_saved"))
    },
    onError: (e) => setError(e.message),
  })

  const save = () => {
    setError(null)
    const parsed = bankAccountSchema.safeParse({
      bankBin,
      bankAccountNumber: accountNumber,
      bankAccountName: accountName,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    mutation.mutate(parsed.data)
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">{t("bank_account_section")}</CardTitle>
        <CardDescription>{t("bank_account_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="bank-bin">{t("bank")}</Label>
          <Select value={bankBin} onValueChange={setBankBin}>
            <SelectTrigger id="bank-bin" className="h-11 md:h-10">
              <SelectValue placeholder={t("bank")} />
            </SelectTrigger>
            <SelectContent>
              {BANK_OPTIONS.map((b) => (
                <SelectItem key={b.bin} value={b.bin}>
                  {b.shortName} - {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-account-number">{t("account_number")}</Label>
          <Input
            id="bank-account-number"
            inputMode="numeric"
            autoComplete="off"
            maxLength={25}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="h-11 md:h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-account-name">{t("account_name")}</Label>
          <Input
            id="bank-account-name"
            autoComplete="off"
            maxLength={60}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            onBlur={() => setAccountName((v) => v.trim().toUpperCase())}
            className="h-11 md:h-10"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {initial && (
            <Button
              variant="outline"
              className="h-11 w-full text-red-600 sm:w-auto md:h-10"
              onClick={() => setConfirmClear(true)}
              disabled={mutation.isPending}
            >
              {t("clear_bank")}
            </Button>
          )}
          <Button
            onClick={save}
            disabled={mutation.isPending}
            className="h-11 w-full sm:ml-auto sm:w-auto md:h-10"
          >
            {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clear_bank")}</AlertDialogTitle>
            <AlertDialogDescription>{t("clear_bank_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClear(false)
                mutation.mutate(null)
              }}
            >
              {t("clear_bank")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
