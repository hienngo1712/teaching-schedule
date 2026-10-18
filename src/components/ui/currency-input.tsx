import * as React from "react"
import { Input } from "./input"

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | undefined
  onChange: (value: number | undefined) => void
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("")

    const format = (val: number | undefined) => {
      if (val === undefined || isNaN(val)) return ""
      // Dấu chấm nghìn kiểu VN: 185.000 (spec AR C1).
      return val.toLocaleString("vi-VN")
    }

    React.useEffect(() => {
      setDisplayValue(format(value))
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Bỏ mọi ký tự không phải số (dấu chấm nghìn) trước khi đọc số.
      const rawValue = e.target.value.replace(/\D/g, "")
      if (rawValue === "") {
        setDisplayValue("")
        onChange(undefined)
        return
      }

      const numValue = parseInt(rawValue, 10)
      if (!isNaN(numValue)) {
        // Hiện ngay, không chờ effect theo prop: chờ thì phím gõ liền sau bị React ghi đè mất.
        setDisplayValue(format(numValue))
        onChange(numValue)
      }
    }

    return (
      <Input
        {...props}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        type="text"
        inputMode="numeric"
      />
    )
  }
)

CurrencyInput.displayName = "CurrencyInput"
