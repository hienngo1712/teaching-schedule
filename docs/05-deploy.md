# 05 — Deploy: Vercel + Neon

## Kiến trúc tổng thể

```
┌──────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Browser    │────▶│   Vercel (Edge/Node)  │────▶│  Neon PostgreSQL │
│   (Client)   │◀────│   Next.js Fullstack   │◀────│  (Serverless DB) │
└──────────────┘     └──────────────────────┘     └─────────────────┘
                              ▲
                     GitHub repo → auto deploy
```

---

## Bước 1: Neon Database (làm 1 lần)

```
1. Truy cập https://neon.tech → Sign up bằng GitHub

2. Tạo project:
   Dashboard → New Project
   - Name: "teaching-schedule"
   - Region: AWS ap-southeast-1 (Singapore) ← gần VN nhất
   - PostgreSQL: 16
   → Create Project

3. Lấy connection strings:
   Dashboard → Connection Details → chọn Framework: Prisma
   Copy 2 URL:

   DATABASE_URL=
   "postgresql://neondb_owner:xxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

   DIRECT_URL=
   "postgresql://neondb_owner:xxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

   Lưu ý:
   - DATABASE_URL: dùng connection pooler (thêm ?pgbouncer=true nếu cần)
   - DIRECT_URL: dùng direct connection (cho prisma migrate deploy)
   - Neon tự tạo user/password, không cần tạo thủ công

4. (Optional) Tạo branch "dev" cho local development:
   Dashboard → Branches → New Branch → "dev"
   → Lấy connection strings riêng cho branch dev
```

---

## Bước 2: Vercel Project (làm 1 lần)

```
1. Truy cập https://vercel.com → Sign up bằng GitHub

2. Import project:
   Dashboard → Add New Project
   → Import Git Repository → chọn "teaching-schedule"
   → Framework Preset: Next.js (auto-detect) ✓

3. Set Environment Variables:
   Settings → Environment Variables → Add

   ┌─────────────────────┬────────────────────────────────────────┬─────────────┐
   │ Name                │ Value                                  │ Environment │
   ├─────────────────────┼────────────────────────────────────────┼─────────────┤
   │ DATABASE_URL        │ postgresql://...neon.tech/...          │ All         │
   │ DIRECT_URL          │ postgresql://...neon.tech/...          │ All         │
   │ NEXTAUTH_SECRET     │ (chạy: openssl rand -base64 32)        │ All         │
   │ NEXTAUTH_URL        │ https://your-app.vercel.app            │ Production  │
   └─────────────────────┴────────────────────────────────────────┴─────────────┘

   Quan trọng:
   - NEXTAUTH_SECRET: tạo ngẫu nhiên, KHÔNG dùng giá trị mẫu
   - NEXTAUTH_URL: chỉ set Production (Preview để Vercel tự detect)
   - DATABASE_URL/DIRECT_URL: copy chính xác từ Neon, có ?sslmode=require

4. Build settings (thường auto-detect):
   Build Command:   pnpm build
   Install Command: pnpm install
   Output:          .next

5. Click Deploy → Vercel build lần đầu
```

---

## Prisma config cho Vercel + Neon

### `prisma/schema.prisma` — bắt buộc có directUrl
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")    // pooled — dùng khi query
  directUrl = env("DIRECT_URL")      // direct — dùng khi migrate
}
```

### `src/server/db.ts` — Prisma singleton
```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

### `package.json` — build tự động migrate
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```
> Vercel chạy `build` → `prisma migrate deploy` tự apply migrations trước khi build Next.js.

### `next.config.ts`
```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // KHÔNG cần output: "standalone" với Vercel
  typescript: { ignoreBuildErrors: false }, // BẮT BUỘC — catch lỗi TS
  eslint: { ignoreDuringBuilds: false },
}

export default nextConfig
```

---

## File quan trọng

### `.env.example` (commit vào repo, không có secrets)
```bash
# === DATABASE (Neon) ===
DATABASE_URL="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# === AUTH ===
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# === LOCAL DOCKER (thay thế Neon nếu muốn) ===
# DATABASE_URL="postgresql://teacher:TeachSecure2026@localhost:5432/teaching_schedule"
# DIRECT_URL="postgresql://teacher:TeachSecure2026@localhost:5432/teaching_schedule"
```

### `.gitignore`
```gitignore
node_modules/
.pnpm-store/
.next/
out/
.env
.env.local
.env.production.local
.env.test.local
prisma/generated/
coverage/
.DS_Store
Thumbs.db
```

---

## Workflow hàng ngày

```
                 Claude Code writes code
                         │
                    pnpm dev (local test)
                         │
                    pnpm build (verify TS)
                         │
                  git add + commit + push
                         │
              Vercel detects push → auto build
                         │
               prisma migrate deploy (tự động)
                         │
                    next build
                         │
                   Live trên Vercel URL
                   (~30–60 giây tổng)
```

### Git commit convention
```bash
feat: add bulk create sessions
fix: attendance not saving correctly
refactor: split session service
test: add integration tests for student router
docs: update phases checklist
```

---

## Custom Domain (tùy chọn)

```
1. Vercel Dashboard → Settings → Domains → Add Domain
2. Nhập: lichhoc.example.com
3. Vercel hiển thị DNS records cần thêm
4. Vào domain registrar → thêm CNAME/A record
5. Chờ propagation 5–30 phút
6. Vercel tự cấp SSL (Let's Encrypt, free)
7. Cập nhật NEXTAUTH_URL trong Vercel env vars
```

---

## Backup & An toàn dữ liệu

### Neon tự động backup
- Free tier: Point-in-Time Recovery trong 7 ngày
- Không cần cron script thủ công
- Restore: Neon Dashboard → Branches → Restore from timestamp

### Backup thủ công
```bash
pg_dump "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Neon Branching trước migration lớn
```
1. Neon Dashboard → Branches → New Branch "backup-pre-migration"
2. Chạy migration
3. OK → xóa branch backup / Lỗi → restore từ branch
```

---

## Troubleshooting

### Build fail trên Vercel

| Lỗi | Nguyên nhân | Cách fix |
|-----|-------------|----------|
| `PrismaClientInitializationError` | Thiếu DATABASE_URL | Kiểm tra env vars trong Vercel |
| `NEXTAUTH_SECRET is not set` | Thiếu NEXTAUTH_SECRET | Thêm env var |
| `prisma generate` fail | postinstall script thiếu | Thêm `"postinstall": "prisma generate"` |
| TypeScript errors | Code có lỗi TS | Fix local bằng `pnpm build` trước |
| Timeout khi migrate | Neon cold start | Deploy lại, hoặc ping DB trước |

> Kiểm tra log: Vercel Dashboard → Deployments → click deploy → View Build Logs

### Prisma + Neon issues

```
"prepared statement already exists"
→ Thêm ?pgbouncer=true vào DATABASE_URL (nếu dùng pooler)

"too many connections"
→ Đảm bảo dùng Prisma singleton pattern trong db.ts
→ Neon free: max 100 connections (đủ cho 1–2 user)

Cold start ~1–2s
→ Neon auto-suspend sau 5 phút idle (free tier)
→ Request đầu tiên chậm → bình thường, không ảnh hưởng UX
```

### Vercel Hobby timeout
```
API routes/tRPC: max 10s execution time
→ Đủ cho queries đơn giản của app này
→ Nếu bulkCreate chậm: chia batch nhỏ (max 50 sessions/lần)
```
