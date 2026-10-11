"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlaceSummary } from "@/hooks/usePlaceSummary"
import { PlaceFormDialog } from "./PlaceFormDialog"

const ADD = "__add__"

type Props = { id?: string; value: number | undefined; onChange: (placeId: number) => void }

// Ô chọn nơi (mẫu AJ 05a/07b): chấm màu + tên, mục cuối "+ Thêm nơi dạy" mở form nơi dạy rồi chọn luôn nơi mới.
export function PlaceSelect({ id, value, onChange }: Props) {
  const { t } = useTranslation()
  const { places } = usePlaceSummary()
  const [adding, setAdding] = useState(false)
  const selected = places.find((p) => p.id === value)

  return (
    <>
      {/* Radix trong <form> có lúc gọi onValueChange("") khi form reset → bỏ qua, không thì Number("") = 0 đè nơi đã chọn. */}
      <Select
        value={value ? String(value) : undefined}
        onValueChange={(v) => {
          if (v === ADD) setAdding(true)
          else if (v) onChange(Number(v))
        }}
      >
        <SelectTrigger id={id}>
          {/* Tự vẽ nơi đang chọn: giá trị có thể được gán trước khi danh sách nơi tải xong (Radix khi đó để trống). */}
          <SelectValue>
            {selected && (
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />
                {selected.name}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {places.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={ADD} className="text-primary">
            <span className="flex items-center gap-2">
              <Plus className="size-4" />
              {t("add_place")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {adding && (
        <PlaceFormDialog usedColors={places.map((p) => p.color)} onClose={() => setAdding(false)} onSaved={onChange} />
      )}
    </>
  )
}
