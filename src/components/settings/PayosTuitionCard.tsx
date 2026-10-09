"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Skeleton } from "@/components/ui/skeleton"
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
import { ContactOwner } from "@/components/common/ContactOwner"
import { LockedSection } from "@/components/plan/LockedSection"
import { PlanBadge } from "@/components/plan/PlanBadge"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import dayjs from "@/lib/dayjs"

const KEY_FIELDS = [
  { id: "clientId", label: "payos_client_id" },
  { id: "apiKey", label: "payos_api_key" },
  { id: "checksumKey", label: "payos_checksum_key" },
] as const
type Keys = Record<(typeof KEY_FIELDS)[number]["id"], string>
const EMPTY: Keys = { clientId: "", apiKey: "", checksumKey: "" }

export function PayosTuitionCard() {
  const { t } = useTranslation()
  const status = trpc.payos.status.useQuery()
  const [help1, help2] = t("payos_help").split("{guide}")

  return (
    <Card data-testid="payos-card" className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          {t("payos_card_title")}
          <PlanBadge plan="pro" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-primary/5 p-3 text-sm text-slate-700">{t("payos_benefit")}</p>
        <p className="text-xs leading-relaxed text-slate-600">{t("payos_cost_note")}</p>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {help1}
            <Link href="/guide#payos-hoc-phi" className="font-medium text-primary underline underline-offset-2">
              {t("payos_guide_link")}
            </Link>
            {help2}
          </p>
          <ContactOwner />
        </div>
        {status.isPending ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : status.data?.connected ? (
          <Connected connectedAt={status.data.connectedAt} paused={!status.data.featureUnlocked} />
        ) : status.data?.featureUnlocked ? (
          <ConnectForm />
        ) : (
          <LockedSection plan="pro" label={t("payos_unlock_pro")}>
            <KeyInputs values={EMPTY} onChange={() => {}} disabled />
          </LockedSection>
        )}
      </CardContent>
    </Card>
  )
}

function KeyInputs({ values, onChange, disabled }: { values: Keys; onChange: (k: keyof Keys, v: string) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      {KEY_FIELDS.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={`payos-${f.id}`}>{t(f.label)}</Label>
          {disabled ? (
            <Input id={`payos-${f.id}`} disabled className="h-11 md:h-10" />
          ) : (
            <PasswordInput
              id={`payos-${f.id}`}
              autoComplete="off"
              value={values[f.id]}
              onChange={(e) => onChange(f.id, e.target.value)}
              className="h-11 md:h-10"
            />
          )}
        </div>
      ))}
    </div>
  )
}

function ConnectForm() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [keys, setKeys] = useState<Keys>(EMPTY)
  const connect = trpc.payos.connect.useMutation({
    onSuccess: () => {
      toast.success(t("payos_connected_ok"))
      setKeys(EMPTY)
      void utils.payos.status.invalidate()
    },
  })
  const filled = KEY_FIELDS.every((f) => keys[f.id].trim() !== "")

  return (
    <div className="space-y-3">
      <KeyInputs values={keys} onChange={(k, v) => setKeys((s) => ({ ...s, [k]: v }))} />
      {connect.error && <p className="text-sm text-red-600">{connect.error.message}</p>}
      <Button
        type="button"
        className="h-11 w-full md:h-10 md:w-auto"
        disabled={!filled || connect.isPending}
        onClick={() => connect.mutate(keys)}
      >
        {connect.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {t("payos_connect")}
      </Button>
    </div>
  )
}

function Connected({ connectedAt, paused }: { connectedAt: Date | string | null; paused: boolean }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [confirming, setConfirming] = useState(false)
  const disconnect = trpc.payos.disconnect.useMutation({
    onSuccess: () => {
      setConfirming(false)
      void utils.payos.status.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const since = connectedAt ? dayjs(connectedAt).tz("Asia/Ho_Chi_Minh").format("D/M/YYYY") : ""

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-emerald-700">{t("payos_connected_since").replace("{d}", since)}</p>
      {paused && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t("payos_paused")}</p>}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full text-red-600 md:h-10 md:w-auto"
        onClick={() => setConfirming(true)}
      >
        {t("payos_disconnect")}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("payos_disconnect")}</AlertDialogTitle>
            <AlertDialogDescription>{t("payos_disconnect_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-10" disabled={disconnect.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-red-600 hover:bg-red-700 md:h-10"
              disabled={disconnect.isPending}
              onClick={(e) => {
                e.preventDefault()
                disconnect.mutate()
              }}
            >
              {t("payos_disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
