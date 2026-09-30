"use client"

import { Checkbox } from "@/components/ui/checkbox"

type Props = {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

// Mặc định không tick; nơi dùng reset về false mỗi lần mở form (spec O Q12).
// Không đặt link sang /privacy ở đây: người dùng không bị kéo rời form (bổ sung H2); link nằm ở /login.
export function ConsentCheckbox({ id, label, checked, onCheckedChange, disabled }: Props) {
  return (
    <div className="flex min-h-11 items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="mt-0.5 h-5 w-5"
      />
      <label htmlFor={id} className="cursor-pointer text-sm text-slate-700">
        {label}
      </label>
    </div>
  )
}
