// Vitest global setup — chạy trước mọi test file.
// DB-seed (cho integration tests) sẽ thêm ở Phase 2 khi có User auth + multi-user.
import { config } from "dotenv"

// Load .env.test nếu có, fallback .env (Prisma CLI dùng .env)
config({ path: ".env.test" })
config()
