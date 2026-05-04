# 03 — API (tRPC + Auth)

## tRPC Setup

### `src/server/trpc/index.ts` — Context có `userId`

```typescript
type Context = {
  db:      PrismaClient
  session: Session | null
  userId:  number | null    // ← shortcut từ session.user.id (đã parse sang number)
  ip:      string | null    // ← từ request header, dùng cho rate limit
}

// publicProcedure   — không cần auth
// protectedProcedure — check session, throw UNAUTHORIZED nếu null
//   → tự động inject userId vào ctx (guaranteed non-null sau middleware)
```

### `src/server/trpc/root.ts`

```typescript
export const appRouter = createTRPCRouter({
  health:     healthRouter,
  auth:       authRouter,
  subject:    subjectRouter,
  student:    studentRouter,
  session:    sessionRouter,
  attendance: attendanceRouter,
  report:     reportRouter,
})
export type AppRouter = typeof appRouter
```

---

## Auth — Cập nhật cho multi-tenant + bảo mật

### NextAuth (`src/server/auth.ts`)

```typescript
// Credentials provider: username + password
// Strategy: JWT — expire 8h (giảm từ 72h)
// bcrypt verify với cost 12

// Credentials handler:
// 1. Lấy IP từ request headers
// 2. Kiểm tra rate limit: query LoginAttempt 15 phút gần nhất theo username
//    → Nếu >= 5 lần thất bại: throw "Tài khoản tạm khóa 15 phút"
// 3. Tìm user: db.user.findUnique({ where: { username, isActive: true } })
// 4. bcrypt.compare(password, user.passwordHash)
// 5. Ghi LoginAttempt { username, ipAddress, success, userId }
// 6. Nếu thành công: cập nhật user.lastLoginAt
// 7. Return { id, username, fullName } hoặc null

// Session callback: token thêm { userId: user.id, fullName: user.fullName }
// JWT callback: propagate userId vào session
```

### Rate Limit Logic

```typescript
// Trong Credentials authorize():
const recentFails = await db.loginAttempt.count({
  where: {
    username,
    success: false,
    createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
  },
})
if (recentFails >= 5) {
  throw new Error("RATE_LIMITED") // NextAuth sẽ trả lỗi này về UI
}
```

### Middleware (`src/middleware.ts`)

```typescript
export { auth as middleware } from "@/server/auth"
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

---

## Auth Router

```
auth.me → protectedProcedure
  Input:  (none)
  Output: { id, username, fullName }

auth.changePassword → protectedProcedure
  Input:  { currentPassword: string, newPassword: string (min 10 chars) }
  Output: { success: true }
  Logic:
    1. Verify currentPassword với bcrypt
    2. Hash newPassword với cost 12
    3. Update user.passwordHash
    Throw BAD_REQUEST nếu currentPassword sai
```

---

## Zod Schemas (`src/lib/schemas/`)

### student.ts — không đổi (userId inject từ ctx, không từ input)
```typescript
export const studentCreateSchema = z.object({
  fullName:    z.string().min(2).max(100).trim(),
  grade:       z.number().int().min(1).max(9),
  parentPhone: z.string().regex(/^(0|\+84)[0-9]{8,9}$/).optional().or(z.literal("")),
  parentName:  z.string().max(100).optional(),
  notes:       z.string().optional(),
})
// userId KHÔNG có trong schema — được inject từ ctx.userId tại service
```

### subject.ts
```typescript
export const subjectCreateSchema = z.object({
  name:      z.string().min(1).max(100).trim(),
  color:     z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#4F46E5"),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
})
```

### session.ts
```typescript
export const sessionCreateSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:   z.string().regex(/^\d{2}:\d{2}$/),
  endTime:     z.string().regex(/^\d{2}:\d{2}$/),
  subjectId:   z.number().int().positive(),
  title:       z.string().max(200).optional(),
  notes:       z.string().optional(),
  studentIds:  z.array(z.number().int().positive()).optional(),
}).refine(d => d.endTime > d.startTime, {
  message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"],
})

export const sessionBulkCreateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdays:  z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/),
  subjectId: z.number().int().positive(),
  title:     z.string().max(200).optional(),
  notes:     z.string().optional(),
  studentIds: z.array(z.number().int().positive()).optional(),
})

export const sessionBulkDeleteFutureSchema = z.object({
  id: z.number().int().positive(),
})

export const sessionBulkUpdateFutureSchema = z.object({
  id: z.number().int().positive(),
  data: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
    subjectId: z.number().int().positive().optional(),
    title:     z.string().max(200).optional(),
    notes:     z.string().optional(),
    studentIds: z.array(z.number().int().positive()).optional(),
  })
})
```

### attendance.ts
```typescript
export const attendanceStatusSchema = z.enum(["pending", "present", "absent", "late"])
export const attendanceUpdateSchema = z.object({
  sessionId:   z.number().int().positive(),
  attendances: z.array(z.object({
    studentId:  z.number().int().positive(),
    attendance: attendanceStatusSchema,
    note:       z.string().optional(),
  })),
})
```

---

## Ownership Middleware — BẮT BUỘC trong mọi service

**Quy tắc vàng:** Mọi query đều scope theo `userId`. Trước update/delete phải verify ownership.

```typescript
// src/server/services/_base.service.ts
// Helper dùng chung trong tất cả services

/**
 * Verify record thuộc về userId. Throw FORBIDDEN nếu không phải.
 * Dùng trước mọi update / delete operation.
 */
export async function assertOwnership(
  record: { userId: number } | null,
  userId: number,
  resourceName = "Resource"
): Promise<void> {
  if (!record) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  if (record.userId !== userId) {
    // QUAN TRỌNG: trả NOT_FOUND thay vì FORBIDDEN
    // → Không để lộ sự tồn tại của record với user khác
    throw new TRPCError({ code: "NOT_FOUND" })
  }
}
```

> **Lý do trả `NOT_FOUND` thay `FORBIDDEN`:** Nếu trả `FORBIDDEN`, attacker biết record tồn tại và thuộc user khác. Trả `NOT_FOUND` không để lộ thông tin.

---

## Subject Router

```
subject.list → protectedProcedure
  Input:  { isActive?: boolean }
  Output: Subject[]
  Query:  WHERE userId = ctx.userId AND isActive = input.isActive
          ORDER BY sortOrder ASC

subject.create → protectedProcedure
  Input:  subjectCreateSchema
  Output: Subject
  Logic:
    - Nếu isDefault=true → UPDATE subjects SET is_default=false WHERE user_id=userId trước
    - INSERT với userId = ctx.userId

subject.update → protectedProcedure
  Input:  { id, data: Partial<subjectCreateSchema> }
  Output: Subject
  Logic:
    - assertOwnership(await db.subject.findUnique({ where: { id } }), ctx.userId)
    - update

subject.delete → protectedProcedure
  Input:  { id }
  Output: { success: true }
  Logic:
    - assertOwnership(...)
    - Kiểm tra còn subject nào active không → không cho xóa subject cuối cùng
    - Soft delete: isActive = false
```

---

## Student Router

```
student.list → protectedProcedure
  Input:  { grade?, search?, isActive? }
  Output: Array<Student & { level }>
  Query:  WHERE userId = ctx.userId AND ...filters

student.create → protectedProcedure
  Input:  studentCreateSchema
  Output: Student & { level }
  Logic:  INSERT với userId = ctx.userId

student.update → protectedProcedure
  Input:  { id, data }
  Output: Student & { level }
  Logic:  assertOwnership(...) → update

student.delete → protectedProcedure
  Input:  { id }
  Logic:  assertOwnership(...) → soft delete
```

---

## Session Router

```
session.getMonth → protectedProcedure
  Input:  { year, month, grade?, studentName? }
  Output: SessionWithStudentsAndSubject[]
  Query:  WHERE userId = ctx.userId AND sessionDate IN [range]
          → filter grade/studentName TRONG data của user này

session.create → protectedProcedure
  Input:  sessionCreateSchema
  Logic:
    1. assertOwnership subject: subject.userId === ctx.userId
    2. parseTimeToDate → checkOverlap(db, { userId: ctx.userId, ... })
    3. INSERT với userId = ctx.userId

session.update → protectedProcedure
  Input:  { id, data }
  Logic:
    1. assertOwnership session
    2. Nếu đổi subjectId: assertOwnership subject mới
    3. checkOverlap(..., excludeId: id)
    4. update

session.delete → protectedProcedure
  Input:  { id }
  Logic:  assertOwnership(...) → hard delete

session.deleteFuture → protectedProcedure
  Input:  sessionBulkDeleteFutureSchema
  Logic:  assertOwnership session → xóa các ca cùng thứ, giờ, môn trong tương lai

session.updateFuture → protectedProcedure
  Input:  sessionBulkUpdateFutureSchema
  Logic:  assertOwnership session → cập nhật các ca cùng thứ, giờ, môn trong tương lai

session.addStudents → protectedProcedure
  Input:  { sessionId, studentIds }
  Logic:
    1. assertOwnership session
    2. Verify tất cả studentIds thuộc ctx.userId:
       const students = await db.student.findMany({ where: { id: { in: studentIds }, userId: ctx.userId } })
       if (students.length !== studentIds.length) throw NOT_FOUND
    3. upsert sessionStudents

session.addRecurringStudents → protectedProcedure
  Input:  { studentIds, startTime, endTime, startDate, endDate, weekdays }
  Logic:  Tìm các ca khớp lịch trong khoảng và gán HS hàng loạt

session.removeStudent → protectedProcedure
  Input:  { sessionId, studentId }
  Logic:  assertOwnership session → delete

session.duplicate → protectedProcedure
  Input:  { id, targetDate }
  Logic:  assertOwnership → checkOverlap → copy với userId = ctx.userId

session.bulkCreate → protectedProcedure
  Input:  bulkCreateSchema
  Logic:  assertOwnership subject → loop dates → checkOverlap per date → create
  Output: { created: number, skipped: number }
```

---

## Attendance Router

```
attendance.get → protectedProcedure
  Input:  { sessionId }
  Logic:  assertOwnership session trước
  Output: Array<{ studentId, fullName, grade, level, attendance, note }>

attendance.update → protectedProcedure
  Input:  attendanceUpdateSchema
  Logic:
    1. assertOwnership session
    2. Verify studentIds thuộc session này (không cho update HS lạ)
    3. upsert attendance records
```

---

## Report Router

```
report.student → protectedProcedure
  Input:  { studentId, year, month }
  Logic:  assertOwnership student
  Output: { student, sessions[], summary: { ..., totalHours } }

report.monthlySummary → protectedProcedure
  Input:  { year, month }
  Query:  WHERE userId = ctx.userId
  Output: { totalSessions, totalStudents, byGrade, bySubject, overallAttendanceRate }

report.dashboard → protectedProcedure
  Input:  (none)
  Output: { totalStudents, sessionsToday, totalSessionsMonth, attendanceRate }
```


---

## Error Handling

```typescript
throw new TRPCError({ code: "UNAUTHORIZED" })    // chưa login
throw new TRPCError({ code: "NOT_FOUND" })        // không tồn tại HOẶC không thuộc user này
throw new TRPCError({ code: "BAD_REQUEST" })      // input không hợp lệ
throw new TRPCError({ code: "CONFLICT" })         // trùng giờ
throw new TRPCError({ code: "FORBIDDEN" })        // chỉ dùng cho các action admin-only
throw new TRPCError({ code: "TOO_MANY_REQUESTS" }) // rate limit (auth)

// KHÔNG dùng FORBIDDEN cho ownership check → dùng NOT_FOUND để tránh lộ thông tin
```

---

## Security Checklist — BẮT BUỘC khi code

```
□ Mọi query phải có WHERE userId = ctx.userId
□ Trước mọi update/delete: gọi assertOwnership()
□ Trả NOT_FOUND (không phải FORBIDDEN) cho unauthorized access
□ Không log password, hash, hay session token
□ Validate subjectId + studentIds thuộc userId trước khi dùng
□ Rate limit: kiểm tra LoginAttempt trước khi verify password
□ Ghi LoginAttempt mọi lần login (thành công và thất bại)
□ bcrypt cost = 12 (production) / 4 (test)
□ JWT expire = 8h
```
