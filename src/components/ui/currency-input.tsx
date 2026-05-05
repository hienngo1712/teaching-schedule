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
      return val.toLocaleString("en-US")
    }

    React.useEffect(() => {
      setDisplayValue(format(value))
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/,/g, "")
      if (rawValue === "") {
        onChange(undefined)
        return
      }

      const numValue = parseInt(rawValue, 10)
      if (!isNaN(numValue)) {
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
