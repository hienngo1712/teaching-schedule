import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  // tsconfig để jsx:"preserve" cho Next nên Vite không parse được .tsx.
  // Vite 8 dùng oxc, không phải esbuild — đặt vào `esbuild` sẽ bị bỏ qua.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    globals: true,
    environment: "node",
    // Giữ "node"; file nào cần DOM thì thêm `// @vitest-environment jsdom`.
    // DB test là Neon remote nên 5s mặc định gây đỏ chập chờn.
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
