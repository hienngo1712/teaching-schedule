import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  // tsconfig đặt jsx:"preserve" cho Next.js, nên transformer của Vite không parse
  // được .tsx và mọi test import component/provider đều chết
  // (vd: useCalendar.ts import LanguageProvider.tsx).
  // Vite 8 dùng oxc, KHÔNG phải esbuild — đặt vào `esbuild` sẽ bị bỏ qua kèm
  // cảnh báo "oxc options will be used and esbuild options will be ignored".
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    globals: true,
    environment: "node",
    // Giữ "node": các test unit hiện tại chỉ import hàm thuần từ module .tsx,
    // không render component nên không cần DOM. Test nào thực sự cần DOM thì
    // thêm `// @vitest-environment jsdom` ở đầu chính file đó.
    // DB test là Neon remote: một test integration có hàng chục round-trip nên
    // 5s mặc định không đủ và gây đỏ chập chờn (vd
    // student-delete-schedule-sync.test.ts). Nâng trần chung thay vì rải
    // `}, 60000)` ở từng test.
    testTimeout: 60000,
    hookTimeout: 60000,
    // ORDER MATTERS: env-setup.ts MUST run before setup.ts. It pins
    // DATABASE_URL to .env.test BEFORE any module imports src/server/db.ts.
    setupFiles: ["./tests/env-setup.ts", "./tests/setup.ts"],
    // Integration tests share 1 DB → buộc chạy tuần tự, tránh race condition trên seed.
    pool: "forks",
    fileParallelism: false,
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/lib/**", "src/hooks/**"],
      thresholds: { lines: 70, functions: 70 },
    },
    // @ts-expect-error — vitest 4 runtime accepts top-level forks though types miss it
    forks: { singleFork: true },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
