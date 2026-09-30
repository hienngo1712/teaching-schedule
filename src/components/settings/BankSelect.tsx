"use client"

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { findBank, searchBanks } from "@/lib/vn-banks"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  id?: string
  value?: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BankSelect({ id, value, onChange, placeholder }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const activeItemRef = useRef<HTMLLIElement | null>(null)

  const selectedBank = findBank(value || "")
  const filteredBanks = searchBanks(query)

  // Reset query và active index khi mở popover
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      setQuery("")
      // Tìm trong danh sách đầy đủ: query cũ (vd sau Esc) sẽ bị xoá, chỉ số phải khớp danh sách mới.
      const idx = searchBanks("").findIndex((b) => b.bin === value)
      setActiveIndex(idx >= 0 ? idx : 0)
    }
  }

  // Cuộn tới item đang active khi dùng phím mũi tên
  useEffect(() => {
    if (open && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest" })
    }
  }, [activeIndex, open])

  const selectBank = useCallback(
    (bin: string) => {
      onChange(bin)
      setOpen(false)
    },
    [onChange]
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => (filteredBanks.length > 0 ? Math.min(prev + 1, filteredBanks.length - 1) : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredBanks[activeIndex]) {
        selectBank(filteredBanks[activeIndex].bin)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          id={id}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="h-11 w-full justify-between font-normal md:h-10"
        >
          <span className="truncate">
            {selectedBank ? (
              `${selectedBank.shortName} - ${selectedBank.name}`
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("bank_search_placeholder")}
            className="h-9"
          />
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
          {filteredBanks.length === 0 ? (
            <li className="p-3 text-center text-sm text-slate-500">{t("bank_not_found")}</li>
          ) : (
            filteredBanks.map((b, idx) => {
              const isSelected = b.bin === value
              const isActive = idx === activeIndex
              return (
                <li
                  key={b.bin}
                  ref={isActive ? activeItemRef : null}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectBank(b.bin)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex min-h-11 cursor-pointer select-none items-center justify-between rounded px-2.5 py-1.5 text-sm md:min-h-9",
                    isActive ? "bg-accent text-accent-foreground" : "text-slate-900",
                    isSelected && "font-semibold"
                  )}
                >
                  <span className="truncate">
                    {b.shortName} - {b.name}
                  </span>
                  {isSelected && <Check className="ml-2 size-4 shrink-0 text-primary" />}
                </li>
              )
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
