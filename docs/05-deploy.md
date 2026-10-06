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

---

## Mỗi lần nâng version

1. Sửa `package.json` `version` (phần lớn → minor, sửa nhỏ → patch).
2. Thêm 1 mục **đầu** `RELEASES` trong `src/lib/releases.ts`: `version` trùng `package.json`, `date` = ngày deploy, `title`, `summary`, `items` (mỗi mục 1–2 câu, viết cho giáo viên đọc, không thuật ngữ kỹ thuật; gắn `guideId` nếu có mục hướng dẫn liên quan).
3. `notify: true` khi giáo viên thấy được thay đổi (tính năng mới, đổi cách dùng); `false` cho sửa lỗi nhỏ. Bản `notify: true` sẽ tự mở ô "Có gì mới" 1 lần cho mọi giáo viên.
4. Tính năng mới đổi cách dùng → sửa mục tương ứng trong `src/lib/guide-content.ts`.
5. `tests/unit/lib/releases.test.ts` đỏ nếu quên bước 2.

---

## Khoá mã hoá dữ liệu cá nhân (spec O)

**Biến env** (Vercel → Production, kiểu Sensitive; không đặt ở Preview, không đặt trong `.env`):
- `DATA_ENCRYPTION_KEYS="k1:<base64 32 byte>[,k2:<base64 32 byte>]"`
- `DATA_ENCRYPTION_ACTIVE_KID="k1"` (khoá dùng để ghi; đọc theo `kid` trong từng giá trị)

**Sinh khoá:** `node -e "console.log('k1:' + require('crypto').randomBytes(32).toString('base64'))"`.
**Lưu dự phòng ở 2 nơi khác nhau trước khi dán vào Vercel. Mất khoá = mất toàn bộ dữ liệu đã mã hoá.** Không gửi khoá qua chat, không chụp màn hình.

**Xoay khoá** (nghi lộ khoá, hoặc 1–2 năm/lần):
1. Sinh `k2`, lưu dự phòng như trên.
2. Vercel: `DATA_ENCRYPTION_KEYS=k1:<cũ>,k2:<mới>`, `DATA_ENCRYPTION_ACTIVE_KID=k2` → redeploy.
3. Tạo Neon backup branch → chạy `--rotate` → `--verify` (mã thoát 0).
4. Bỏ `k1` khỏi env, redeploy. Giữ bản dự phòng `k1` tới khi mọi Neon branch chứa dữ liệu mã hoá bằng `k1` đã xoá.

**Script `scripts/crypto-backfill.ts`** (người dùng tự chạy ở terminal của mình, truyền env trong lệnh, script không đọc `.env`):
```
DATABASE_URL=... DATA_ENCRYPTION_KEYS=... DATA_ENCRYPTION_ACTIVE_KID=... [CONFIRM_HOST=<host DB>] \
  pnpm exec tsx scripts/crypto-backfill.ts [--dry-run|--apply|--verify|--decrypt|--rotate] [--batch 200]
```
- Mặc định `--dry-run` (chỉ đếm). `--apply` mã hoá bản rõ; `--verify` kiểm không còn bản rõ + giải mã được hết; `--decrypt` trả về bản rõ (rollback); `--rotate` mã hoá lại bằng khoá active.
- `--apply` / `--decrypt` / `--rotate` cần `CONFIRM_HOST` đúng bằng host trong `DATABASE_URL`.
- Mã thoát: `0` ổn, `1` cấu hình / xác nhận sai, `2` verify thấy bản rõ hoặc lỗi giải mã.

**Theo dõi:** Vercel log có `[crypto] còn bản rõ ở trường <tên>` = có đường ghi vòng qua extension → tìm và sửa, rồi chạy `--apply` lại. `FieldDecryptError` = thiếu/sai khoá.

**Neon branch chứa bản rõ:** branch backup tạo trước O2 còn dữ liệu chưa mã hoá → xoá sau khi O3 chạy ổn (người dùng tự xoá).

---

## Khôi phục khi Vercel bị khoá / chuyển sang project mới (Pro)

Vercel chỉ chạy code và giữ biến môi trường. **Dữ liệu nằm ở Neon, code nằm ở GitHub** (`hienngo1712/teaching-schedule`), nên Vercel bị khoá thì không mất dữ liệu. Thứ phải tự giữ là giá trị các biến env.

**Bản lưu giá trị:** file `private_key.7z` (7-Zip, AES-256), một bản trên máy, một bản trên Drive. Mật khẩu file ghi giấy, để riêng, không để cùng chỗ với file. Đổi khoá nào thì sửa file đó ngay. Không ghi giá trị vào repo, chat hay ảnh chụp.

### Biến env Production cần có

| Biến | Lấy lại ở đâu nếu mất | Mất thì sao |
|---|---|---|
| `DATA_ENCRYPTION_KEYS` (`k1:<base64 32 byte>`) | **Chỉ có trong bản lưu.** Không sinh lại được | **Mất vĩnh viễn** tên HS, SĐT, số tài khoản đã mã hoá |
| `DATA_ENCRYPTION_ACTIVE_KID` | `k1` (đổi khi xoay khoá, xem mục trên) | App báo lỗi cấu hình |
| `DATABASE_URL` | Neon → Connect, **bật** Connection pooling (host có `-pooler`) | App không kết nối DB |
| `DIRECT_URL` | Neon → Connect, **tắt** Connection pooling | `prisma migrate deploy` lỗi khi build |
| `NEXTAUTH_SECRET` | Sinh mới bằng lệnh ở mục "Khoá mã hoá" (bỏ tiền tố `k1:`) | Không mất dữ liệu, mọi người phải đăng nhập lại 1 lần |
| `NEXTAUTH_URL` | Địa chỉ trang mới, vd `https://student-manager-vn.vercel.app` | Đăng nhập chuyển hướng sai |
| `ADMIN_USERNAMES` | Tên đăng nhập admin, cách nhau dấu phẩy | Không vào được `/admin` |
| `PLAN_BANK_BIN`, `PLAN_BANK_ACCOUNT_NUMBER`, `PLAN_BANK_ACCOUNT_NAME` | Tài khoản nhận tiền gói của chủ app | QR thanh toán gói trống |
| `NEXT_PUBLIC_PRIVACY_CONTACT` | Email/SĐT liên hệ trên `/privacy` | Trang chính sách thiếu liên hệ |

`NEXT_PUBLIC_*` được gắn vào lúc build: đổi giá trị thì phải Redeploy.

### Dựng lại project
1. Vercel → **Add New → Project** → import repo `hienngo1712/teaching-schedule`, framework Next.js.
2. Kiểm cấu hình có sẵn trong repo, không cần chỉnh:
   - Build Command: lấy từ `package.json` (`prisma generate && prisma migrate deploy && next build`).
   - Node: `24.x` (`engines`).
   - Region function: `sin1` (`vercel.json`, gần Neon Singapore).
3. **Settings → Environment Variables**: dán các biến trong bảng, chọn **Production**. Bật Sensitive cho 4 biến bí mật (`DATA_ENCRYPTION_KEYS`, `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`). Không đặt cho Preview.
4. Deploy. Build tự chạy `migrate deploy`; DB đã có đủ bảng nên không có migration mới.
5. Kiểm sau deploy:
   - Đăng nhập tài khoản giáo viên → danh sách học sinh hiện đúng tên (khoá mã hoá đúng). Thấy lỗi `FieldDecryptError` trong log nghĩa là sai/thiếu `DATA_ENCRYPTION_KEYS`.
   - Đăng nhập admin → vào được `/admin/overview`.
   - Trang Gói của tôi → QR thanh toán có số tài khoản.
   - `/updates` hiện đúng bản mới nhất.

### Tên miền
Địa chỉ `*.vercel.app` gắn với project cũ. Project cũ còn tồn tại (kể cả bị khoá) thì project mới **không lấy lại được** tên đó, phải dùng tên khác và báo giáo viên link mới. Muốn đổi nhà không đổi link thì nên mua tên miền riêng (mục Custom Domain ở trên) và trỏ về project đang chạy.

### Nâng Hobby → Pro (không chuyển project)
Vercel → Settings → Billing → nâng gói cho team đang chứa project. Project, env, tên miền giữ nguyên, không cần làm các bước trên.
