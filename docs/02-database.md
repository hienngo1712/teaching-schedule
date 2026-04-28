# 02 — Database Schema

## Quyết định thiết kế (Design Decisions)

### 1. Kiểu dữ liệu thời gian — `@db.Time(0)`
Dùng PostgreSQL native `TIME` thay `VarChar("HH:mm")` để tính duration, kiểm tra overlap bằng SQL thuần. Prisma map sang `Date` object. Convert bằng `parseTimeToDate()` / `formatTime()` trong `utils.ts`.

### 2. Model `Subject` riêng
Tránh typo free-text. Subject có `name`, `color` (hex cho SessionCard), `isDefault`, `sortOrder`. Mỗi user có subjects riêng (`userId` FK).

### 3. Overlap Detection — service-level raw query
Prisma không support `EXCLUDE` constraint. Dùng raw SQL `start < B.end AND end > B.start` trong service trước mỗi create/update. Throw `CONFLICT`.

### 4. Multi-tenant — `userId` FK trên mọi bảng dữ liệu ← MỚI

**Yêu cầu:** 3–5 user, mỗi người có dữ liệu hoàn toàn tách biệt. User A không thấy dữ liệu User B.

**Giải pháp:** Thêm `userId` (FK → `User.id`) vào **tất cả** bảng dữ liệu:
- `subjects`
- `students`
- `teaching_sessions`

`SessionStudent` không cần `userId` vì đã liên kết qua `sessionId` → session đã có `userId`.

**Enforcement tại service layer:** Mọi query đều thêm `where: { userId: ctx.session.user.id }`. Middleware kiểm tra ownership trước update/delete. Không thể truy cập data của user khác dù biết ID.

**Không dùng Row-Level Security (RLS) của PostgreSQL** vì Prisma không hỗ trợ set `app.current_user_id` tự động trong serverless context — dễ bị quên, nguy hiểm hơn enforce ở service layer.

### 5. Bảo mật account — bcrypt + rate limit + audit log ← MỚI

- Password hash: `bcrypt` cost factor **12** (thay vì 10 — chậm hơn nhưng brute-force khó hơn)
- Rate limit đăng nhập: **5 lần thất bại / 15 phút** per username → lock tạm thời
- `LoginAttempt` model lưu log mỗi lần thử đăng nhập (thành công/thất bại, IP, timestamp)
- Session JWT expire: **8h** (thay vì 72h — ít rủi ro nếu token bị lộ)
- Không có "Remember me" — app nội bộ không cần
- `lastLoginAt` trên User để detect bất thường

---

## Prisma Schema đầy đủ

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── USER ────────────────────────────────────────────────────────
model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique @db.VarChar(50)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  fullName     String?   @map("full_name") @db.VarChar(100)
  isActive     Boolean   @default(true) @map("is_active")   // admin có thể deactivate
  lastLoginAt  DateTime? @map("last_login_at")               // audit
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  // Quan hệ dữ liệu của user này
  subjects  Subject[]
  students  Student[]
  sessions  TeachingSession[]

  // Audit
  loginAttempts LoginAttempt[]

  @@map("users")
}

// ─── LOGIN ATTEMPT (rate limit + audit) ──────────────────────────
model LoginAttempt {
  id        Int      @id @default(autoincrement())
  username  String   @db.VarChar(50)    // username được thử (có thể không tồn tại)
  ipAddress String?  @map("ip_address") @db.VarChar(45)  // IPv4/IPv6
  success   Boolean
  userId    Int?     @map("user_id")    // null nếu username không tồn tại
  user      User?    @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")

  @@index([username, createdAt])   // query rate limit theo username + thời gian
  @@index([ipAddress, createdAt])  // query rate limit theo IP
  @@map("login_attempts")
}

// ─── SUBJECT ─────────────────────────────────────────────────────
model Subject {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")              // ← MULTI-TENANT
  user      User     @relation(fields: [userId], references: [id])
  name      String   @db.VarChar(100)
  color     String   @default("#4F46E5") @db.VarChar(7)
  isDefault Boolean  @default(false) @map("is_default")
  isActive  Boolean  @default(true) @map("is_active")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  sessions TeachingSession[]

  @@unique([userId, name])          // tên môn unique PER USER (không phải global)
  @@index([userId, isActive, sortOrder])
  @@map("subjects")
}

// ─── STUDENT ─────────────────────────────────────────────────────
model Student {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")              // ← MULTI-TENANT
  user        User     @relation(fields: [userId], references: [id])
  fullName    String   @map("full_name") @db.VarChar(100)
  grade       Int      @db.SmallInt                  // 1–9
  parentPhone String?  @map("parent_phone") @db.VarChar(15)
  parentName  String?  @map("parent_name") @db.VarChar(100)
  notes       String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  sessionStudents SessionStudent[]

  @@index([userId, grade])
  @@index([userId, isActive])
  @@map("students")
}

// ─── TEACHING SESSION ────────────────────────────────────────────
model TeachingSession {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")              // ← MULTI-TENANT
  user        User     @relation(fields: [userId], references: [id])
  sessionDate DateTime @map("session_date") @db.Date
  startTime   DateTime @map("start_time") @db.Time(0)
  endTime     DateTime @map("end_time") @db.Time(0)

  subjectId   Int      @map("subject_id")
  subject     Subject  @relation(fields: [subjectId], references: [id])

  title       String?  @db.VarChar(200)
  notes       String?  @db.Text
  status      String   @default("scheduled") @db.VarChar(20)

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  sessionStudents SessionStudent[]

  @@index([userId, sessionDate])
  @@index([userId, sessionDate, startTime])
  @@index([subjectId])
  @@map("teaching_sessions")
}

// ─── SESSION STUDENT ─────────────────────────────────────────────
model SessionStudent {
  id         Int     @id @default(autoincrement())
  sessionId  Int     @map("session_id")
  studentId  Int     @map("student_id")
  attendance String  @default("pending") @db.VarChar(10)
  note       String? @db.Text

  session TeachingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  student Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)

  // userId không cần — ownership đã enforce qua session.userId và student.userId
  @@unique([sessionId, studentId])
  @@index([studentId])
  @@index([sessionId])
  @@map("session_students")
}
```

---

## Seed data

### `prisma/seed.ts`

```typescript
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

// COST_FACTOR = 12 (production hardened)
const BCRYPT_COST = process.env.NODE_ENV === "test" ? 4 : 12

async function seedSubjectsForUser(userId: number) {
  const defaults = [
    { name: "Tiếng Anh", color: "#4F46E5", isDefault: true,  sortOrder: 1 },
    { name: "Toán",      color: "#0891B2", isDefault: false, sortOrder: 2 },
    { name: "Ngữ Văn",  color: "#059669", isDefault: false, sortOrder: 3 },
    { name: "Vật Lý",   color: "#D97706", isDefault: false, sortOrder: 4 },
    { name: "Hóa Học",  color: "#DC2626", isDefault: false, sortOrder: 5 },
  ]
  for (const s of defaults) {
    await db.subject.upsert({
      where: { userId_name: { userId, name: s.name } },
      update: {},
      create: { ...s, userId },
    })
  }
}

async function main() {
  const passwordHash = await bcrypt.hash("teacher123", BCRYPT_COST)

  const user = await db.user.upsert({
    where: { username: "teacher" },
    update: {},
    create: { username: "teacher", passwordHash, fullName: "Giáo viên" },
  })

  await seedSubjectsForUser(user.id)

  console.log(`✅ Seed OK: user "${user.username}" + 5 subjects`)
}

main().catch(console.error).finally(() => db.$disconnect())
```

---

## Admin CLI Scripts

### `scripts/create-user.ts` — tạo user mới từ terminal

```typescript
// Cách dùng:
// pnpm tsx scripts/create-user.ts --username giaovien2 --fullname "Nguyễn Thị B" --password "MatKhau@2026"

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { parseArgs } from "node:util"

const db = new PrismaClient()

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    fullname: { type: "string" },
    password: { type: "string" },
  },
})

async function main() {
  const { username, fullname, password } = values

  if (!username || !password) {
    console.error("❌ Thiếu --username hoặc --password")
    process.exit(1)
  }

  // Validate password strength
  if (password.length < 10) {
    console.error("❌ Password phải ít nhất 10 ký tự")
    process.exit(1)
  }

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) {
    console.error(`❌ Username "${username}" đã tồn tại`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { username, passwordHash, fullName: fullname },
  })

  // Seed subjects mặc định cho user mới
  await seedSubjectsForUser(user.id)

  console.log(`✅ Tạo user thành công: ${username} (id=${user.id})`)
}

main().catch(console.error).finally(() => db.$disconnect())
```

### `scripts/list-users.ts` — xem danh sách users

```typescript
// pnpm tsx scripts/list-users.ts
async function main() {
  const users = await db.user.findMany({
    select: { id: true, username: true, fullName: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  console.table(users)
}
```

### `scripts/deactivate-user.ts` — vô hiệu hóa user

```typescript
// pnpm tsx scripts/deactivate-user.ts --username giaovien2
// Soft deactivate: isActive = false → không thể login
// Data vẫn giữ nguyên trong DB
```

### `scripts/reset-password.ts` — reset password

```typescript
// pnpm tsx scripts/reset-password.ts --username giaovien2 --password "NewPass@2026"
// Dùng khi user quên mật khẩu — không có flow "forgot password" qua email
```

### `package.json` — thêm scripts

```json
{
  "scripts": {
    "user:create":     "tsx scripts/create-user.ts",
    "user:list":       "tsx scripts/list-users.ts",
    "user:deactivate": "tsx scripts/deactivate-user.ts",
    "user:reset-pw":   "tsx scripts/reset-password.ts"
  }
}
```

---

## Prisma Client Singleton

### `src/server/db.ts`

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

---

## Overlap Detection

### Hàm `checkOverlap()` — thêm `userId` filter

```typescript
export async function checkOverlap(db: PrismaClient, params: {
  userId:      number   // ← BẮT BUỘC — chỉ check overlap trong data của user này
  sessionDate: Date
  startTime:   Date
  endTime:     Date
  excludeId?:  number
}): Promise<void> {
  const { userId, sessionDate, startTime, endTime, excludeId } = params

  const conflicts = await db.$queryRaw<Array<{
    id: number; title: string | null; start_time: Date; end_time: Date
  }>>`
    SELECT id, title, start_time, end_time
    FROM teaching_sessions
    WHERE user_id    = ${userId}
      AND session_date = ${sessionDate}::date
      AND id         != ${excludeId ?? 0}
      AND start_time  < ${endTime}::time
      AND end_time    > ${startTime}::time
    LIMIT 1
  `

  if (conflicts.length > 0) {
    const c = conflicts[0]
    const label = c.title ? `"${c.title}"` : `ca ${formatTime(c.start_time)}–${formatTime(c.end_time)}`
    throw new TRPCError({ code: "CONFLICT", message: `Trùng giờ với ${label} đã có trong ngày này` })
  }
}
```

---

## Time Helpers (`src/lib/utils.ts`)

```typescript
export function parseTimeToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number)
  const d = new Date(0); d.setUTCHours(h, m, 0, 0); return d
}
export function formatTime(date: Date): string {
  return dayjs(date).utc().format("HH:mm")
}
export function calcDurationMinutes(start: Date, end: Date): number {
  return dayjs(end).diff(dayjs(start), "minute")
}
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}p`
}
```

---

## DB Conventions

| Quy tắc | Chi tiết |
|---------|----------|
| Multi-tenant | `userId` FK bắt buộc trên: `subjects`, `students`, `teaching_sessions` |
| Mọi query | Phải có `where: { userId }` — enforce tại service layer |
| Ownership check | Trước update/delete: verify record.userId === ctx.userId |
| Xóa HS / Subject | Soft delete: `isActive = false` |
| Xóa Session | Hard delete — cascade `session_students` |
| Deactivate User | `isActive = false` — data giữ nguyên, không thể login |
| Password hash | bcrypt cost **12** (production), **4** (test — nhanh hơn) |
| Session JWT | Expire **8h** |
| Rate limit | 5 fail / 15 phút per username → `LoginAttempt` table |
| Subject unique | `@@unique([userId, name])` — unique per user, không phải global |
