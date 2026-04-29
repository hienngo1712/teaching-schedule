import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
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
