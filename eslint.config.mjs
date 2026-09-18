import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { FlatCompat } from "@eslint/eslintrc"

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["tests/**"],
    rules: {
      // Nợ cũ: next lint trước đây không lint tests/ nên các chỗ `any` này chưa từng bị soi.
      // Để warn thay vì tắt hẳn, sẽ dọn ở một đợt riêng.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]
