"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"

export interface TimeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void
}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value, onChange, onValueChange, ...props }, ref) => {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, "") // Chỉ lấy số
      
      if (val.length > 4) val = val.slice(0, 4)
      
      let formatted = val
      if (val.length > 2) {
        formatted = val.slice(0, 2) + ":" + val.slice(2)
      }
      
      // Tạo một event giả lập để react-hook-form có thể nhận được
      const target = e.target
      target.value = formatted
      
      if (onChange) {
        onChange(e)
      }
      
      if (onValueChange) {
        onValueChange(formatted)
      }
      
      // Restore value for the actual input element if needed (though target.value change usually suffices)
    }

    return (
      <Input
        {...props}
        ref={ref}
        value={value}
        onChange={handleInputChange}
        placeholder="HH:mm (ví dụ: 1700 → 17:00)"
        className={className}
        maxLength={5}
      />
    )
  }
)
TimeInput.displayName = "TimeInput"

export { TimeInput }
