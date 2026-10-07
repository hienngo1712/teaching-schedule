# AC — Nhắn tin hỗ trợ giáo viên ↔ admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên nhắn tin với đội hỗ trợ ngay trong app; admin xem và trả lời ở `/admin/chat`. Phần 1 (0.14.0) cập nhật bằng polling. Phần 2 (0.14.1) thêm Pusher Channels báo tin mới tức thì, polling giữ làm dự phòng.

**Architecture:**
- DB: 2 bảng `chat_conversations` (1 dòng / giáo viên, có bộ đếm chưa đọc 2 phía) và `chat_messages` (`body` mã hoá qua `ENCRYPTED_FIELDS`).
- Server: `chat.service.ts`; router `chat` (giáo viên) + 5 thủ tục `admin.chat*`; `teacherProcedure` dùng chung chuyển vào `src/server/trpc/index.ts`.
- Client: `src/lib/chat.ts` (hằng, định dạng); component dùng chung `ChatMessageList`, `ChatComposer`; phía giáo viên có `ChatButton` + `ChatSheet` trong `AppHeader`; phía admin có `AdminChat` ở `/admin/chat` + badge nav.
- `TRPCProvider` bỏ qua invalidate toàn cục khi mutation có `meta.skipGlobalInvalidate`.
- Phần 2: `src/server/realtime.ts` (gói `pusher`, chỉ gửi `{ userId, messageId }`), route `POST /api/realtime/auth`, `src/lib/realtime-client.ts` (gói `pusher-js`, tải động), hook `useChatRealtime`.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11 + React Query v5 (`useInfiniteQuery`, `refetchInterval`), Prisma 5.22 + PostgreSQL, NextAuth v5, shadcn Sheet/Textarea, lucide-react, dayjs (tz), Vitest + Testing Library, Playwright. Phần 2 thêm `pusher` (server) và `pusher-js` (client).

**Spec:** `docs/superpowers/specs/2026-10-07-ac-chat-ho-tro-design.md`

## Global Constraints

**Nhánh, version**
- Phần 1: nhánh `feat/ac-chat-ho-tro` tạo từ `main` (đã có commit spec + plan). Version cuối `0.14.0`.
- Phần 2: nhánh `feat/ac2-chat-pusher` tạo từ `main` **sau khi phần 1 đã merge**. Version cuối `0.14.1`. Claude ghi `GO AC2` vào kênh khi chủ app đã tạo app Pusher (Task 9 Step 0).

**Migration và an toàn DB**
- **Migration chỉ thêm** (Task 1): 2 bảng mới, index, khoá ngoại CASCADE. Không có DROP/RENAME/ALTER cột cũ.
- Tạo bằng `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name add_chat`, đọc SQL, rồi áp lên DB test bằng `... pnpm exec prisma migrate deploy` (kiểm dòng Datasource in `localhost:5433`).
- Không áp prod: Vercel tự `migrate deploy` khi build. Prisma đòi reset hoặc báo drift → DỪNG, báo Claude.
- Chỉ dùng `.env.test`. Cấm `db:reset` / `migrate reset` / `db push` / `pnpm db:migrate:*`. Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên.

**Chạy lệnh**
- Không `pnpm build` / `pnpm dev`. Kiểm build bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị trong `.env.test`.
- vitest integration dùng chung 1 DB test: không chạy 2 lượt test cùng lúc.
- e2e: RAM ≥ 3000 MB, chạy foreground, seed trước bằng `pnpm test tests/integration/plan-launch-migration.test.ts`, tắt dev server cổng 3000 khi xong.

**Mã hoá, quyền**
- `ChatMessage.body` mã hoá. **Không lọc / sắp / groupBy theo `body`** (extension sẽ ném `EncryptedFieldQueryError`).
- Admin xác định bằng `isAdminUsername` (`@/lib/admin`). Giáo viên **không bao giờ** truyền `userId` vào thủ tục `chat.*`; luôn dùng `ctx.userId`.
- Tin trả cho giáo viên có `senderName: null` (không lộ username admin).

**Chữ và giao diện**
- Mọi chữ giao diện mới qua i18n `vi.json` + `en.json` cùng bộ key (Task 2 thêm toàn bộ). Chuỗi mới không dùng gạch dài (—, –).
- Màu A3: `primary`, teal, slate, amber. **Không indigo/violet/purple.**
- Vùng chạm ≥ 44px trên mobile (`size-11` / `min-h-11` / `h-11 md:h-10`).
- `page.tsx` / `layout.tsx` không có định danh `params` / `searchParams` (kể cả trong comment), do `tests/unit/next15-contract.test.ts` canh.

**Commit**
- Commit của Gehihi: 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + `pnpm exec tsc --noEmit` + `pnpm lint` sạch → commit → ghi ledger `.superpowers/sdd/2026-10-07-ac-chat-ho-tro/progress.md`.

## Review Focus

1. **Lộ cuộc trò chuyện của người khác.** Mọi thủ tục `chat.*` lấy theo `ctx.userId`; admin endpoints là `adminProcedure`. Test: Task 3 "giáo viên A không thấy tin của B", "FORBIDDEN chéo".
2. **Nội dung tin lưu bản rõ.** `body` phải là `enc:v1:` trong DB. Test: Task 3 "body là ciphertext".
3. **Gửi tin làm cả app tải lại.** `MutationCache.onSuccess` hiện `invalidateQueries()` toàn bộ; mutation chat phải có `meta: SKIP_GLOBAL_INVALIDATE`. Test: Task 2 unit `shouldInvalidateAll`.
4. **Enter khi gõ Telex/VNI gửi nửa chữ.** `ChatComposer` bỏ qua Enter khi `isComposing` hoặc `keyCode === 229`. Test: Task 4.
5. **Header giáo viên tràn ngang ở 375px** khi thêm nút chat cạnh RenewOffer + Có gì mới + Ngôn ngữ + avatar. Lời chào phải co lại (`min-w-0 truncate` đã có). Test: Task 7 e2e đo `scrollWidth`.
6. **Polling chạy khi khung đóng / tab ẩn.** Chỉ `chat.unread` và `admin.chatUnread` polling thường trực; React Query mặc định không polling khi tab ẩn (`refetchIntervalInBackground: false`), không đổi mặc định này.
7. **(Phần 2) Admin bị middleware chuyển hướng khi gọi `/api/realtime/auth`.** Matcher phải loại trừ `api/realtime`. Test: Task 9 matcher.
8. **(Phần 2) Pusher nhận nội dung tin.** Payload chỉ `{ userId, messageId }`. Lỗi Pusher không làm `send` thất bại. Test: Task 8.

---

## PHẦN 1 — Chat bằng polling (0.14.0)

### Task 1: Schema, migration, mã hoá, `teacherProcedure` dùng chung

**Files:**
- Modify: `prisma/schema.prisma`; Create: `prisma/migrations/<ts>_add_chat/migration.sql` (Prisma sinh)
- Modify: `src/server/crypto/prisma-encryption.ts`, `src/server/trpc/index.ts`, `src/server/trpc/routers/feedback.ts`, `tests/setup.ts`
- Test: `tests/unit/crypto/prisma-encryption.test.ts` (test DMMF sẵn có), `tests/integration/feedback.test.ts` (sẵn có)

**Interfaces:**
- Produces: model `ChatConversation`, `ChatMessage`; `teacherProcedure` export từ `@/server/trpc`.

- [ ] **Step 1: Schema.** Trong `prisma/schema.prisma`:
  - Thêm vào danh sách quan hệ của `User` (dưới `feedbacks Feedback[]`): `chatConversation ChatConversation?`
  - Thêm 2 model ở cuối file, đúng như spec §4:

```prisma
// Mỗi giáo viên 1 cuộc trò chuyện với đội hỗ trợ (spec AC §4). CASCADE để tests/setup.ts xoá users không vỡ.
model ChatConversation {
  id               Int       @id @default(autoincrement())
  userId           Int       @unique @map("user_id")
  lastMessageAt    DateTime  @default(now()) @map("last_message_at")
  // Bộ đếm chưa đọc lưu sẵn để badge chỉ cần 1 truy vấn nhẹ mỗi lần polling.
  userUnreadCount  Int       @default(0) @map("user_unread_count")
  adminUnreadCount Int       @default(0) @map("admin_unread_count")
  userReadAt       DateTime? @map("user_read_at")
  adminReadAt      DateTime? @map("admin_read_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages         ChatMessage[]

  @@index([lastMessageAt])
  @@map("chat_conversations")
}

model ChatMessage {
  id             Int              @id @default(autoincrement())
  conversationId Int              @map("conversation_id")
  fromAdmin      Boolean          @map("from_admin")
  // Username người gửi lúc gửi; danh sách admin theo env có thể đổi về sau.
  senderName     String           @map("sender_name") @db.VarChar(50)
  body           String           @db.Text
  createdAt      DateTime         @default(now()) @map("created_at")
  conversation   ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, id])
  @@index([conversationId, createdAt])
  @@map("chat_messages")
}
```

- [ ] **Step 2: Migration.** Tạo theo Global Constraints, tên `add_chat`. SQL chỉ được có: 2 `CREATE TABLE`, `CREATE UNIQUE INDEX "chat_conversations_user_id_key"`, 3 `CREATE INDEX`, 2 `ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE CASCADE`. Không có DROP/RENAME. Áp DB test bằng `migrate deploy`, rồi `pnpm exec prisma generate`.

- [ ] **Step 3: Mã hoá.** Trong `ENCRYPTED_FIELDS` (`src/server/crypto/prisma-encryption.ts`) thêm dòng cuối:

```ts
  ChatMessage: ["body"],
```

  - Chạy `pnpm test tests/unit/crypto/prisma-encryption.test.ts`. Expected: PASS (test DMMF thấy `ChatMessage.body` là TEXT, không model nào khác có trường `body`).

- [ ] **Step 4: `teacherProcedure` dùng chung.** Trong `src/server/trpc/index.ts`, thêm cuối file:

```ts
// Thủ tục chỉ cho giáo viên: admin không dùng app như giáo viên (góp ý, chat).
export const teacherProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (isAdminUsername(ctx.session.user.username)) throw new TRPCError({ code: "FORBIDDEN" })
  return next()
})
```

  - Trong `src/server/trpc/routers/feedback.ts`: xoá khai báo `teacherProcedure` cục bộ cùng import `TRPCError`, `isAdminUsername`, `protectedProcedure` không còn dùng; import `teacherProcedure` từ `@/server/trpc`.

- [ ] **Step 5: `tests/setup.ts`.** Trong chuỗi dọn, thêm ngay trước `await db.feedback.deleteMany()`:

```ts
    await db.chatMessage.deleteMany()
    await db.chatConversation.deleteMany()
```

- [ ] **Step 6: Chạy** `pnpm test tests/integration/feedback.test.ts tests/unit/crypto/prisma-encryption.test.ts`. Expected: PASS hết (feedback vẫn FORBIDDEN với admin).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/server/crypto/prisma-encryption.ts src/server/trpc/index.ts src/server/trpc/routers/feedback.ts tests/setup.ts
git commit -m "feat: bang chat va teacherProcedure dung chung"
```

---

### Task 2: `src/lib/chat.ts`, i18n, `TRPCProvider` bỏ qua invalidate toàn cục

**Files:**
- Create: `src/lib/chat.ts`
- Modify: `src/components/providers/TRPCProvider.tsx`, `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/lib/chat.test.ts`, `tests/unit/components/TRPCProvider.test.ts`

**Interfaces:**
- Produces:
  - `CHAT_POLL_MS = { unread: 60_000, adminUnread: 30_000, inbox: 10_000, thread: 5_000, live: 30_000 }`;
  - `CHAT_PREVIEW_MAX = 60`; `chatPreview(body: string): string`; `chatTime(date: Date | string, now?: Date): string`;
  - `CHAT_EVENT = "chat:new"`; `ADMIN_CHAT_CHANNEL = "private-chat-admins"`; `userChatChannel(userId: number): string` (dùng ở phần 2, khai báo luôn để server/client chung 1 nguồn);
  - `SKIP_GLOBAL_INVALIDATE = { skipGlobalInvalidate: true }`; `shouldInvalidateAll(meta: unknown): boolean` (export từ `TRPCProvider.tsx`).

- [ ] **Step 1: Test (đỏ)** — tạo `tests/unit/lib/chat.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { chatPreview, chatTime, userChatChannel, CHAT_PREVIEW_MAX } from "@/lib/chat"

describe("chatPreview", () => {
  it("gộp khoảng trắng, xuống dòng; ngắn thì giữ nguyên", () => {
    expect(chatPreview("  Xin   chào\n\nadmin ")).toBe("Xin chào admin")
  })
  it("dài hơn 60 ký tự thì cắt còn 59 + …", () => {
    const out = chatPreview("a".repeat(80))
    expect(out).toBe("a".repeat(59) + "…")
    expect(out.length).toBe(CHAT_PREVIEW_MAX)
  })
  it("đúng 60 ký tự thì không cắt", () => {
    expect(chatPreview("b".repeat(60))).toBe("b".repeat(60))
  })
})

describe("chatTime (giờ VN)", () => {
  const now = new Date("2026-10-07T10:00:00Z") // 17:00 VN
  it("cùng ngày VN → HH:mm", () => {
    expect(chatTime(new Date("2026-10-07T01:05:00Z"), now)).toBe("08:05")
  })
  it("khác ngày VN → DD/MM HH:mm, kể cả cùng ngày UTC", () => {
    // 2026-10-06T16:30Z = 23:30 ngày 06/10 giờ VN
    expect(chatTime(new Date("2026-10-06T16:30:00Z"), now)).toBe("06/10 23:30")
    expect(chatTime(new Date("2026-10-07T17:30:00Z"), new Date("2026-10-07T16:00:00Z"))).toBe("08/10 00:30")
  })
  it("nhận chuỗi ISO (dữ liệu tRPC không có transformer)", () => {
    expect(chatTime("2026-10-07T01:05:00.000Z", now)).toBe("08:05")
  })
})

it("tên kênh giáo viên", () => {
  expect(userChatChannel(42)).toBe("private-chat-user-42")
})
```

  - Ghi chú: tRPC của app **không có** superjson transformer, nên `Date` từ server tới client là chuỗi ISO. `chatTime` và mọi so sánh thời gian ở client phải nhận `Date | string`. Kiểm `src/components/providers/TRPCProvider.tsx` / `src/server/trpc/index.ts`; nếu đã có transformer thì giữ nguyên test, không sao.

- [ ] **Step 2: Chạy** `pnpm test tests/unit/lib/chat.test.ts`. Expected: FAIL (chưa có module).

- [ ] **Step 3: Cài đặt** — tạo `src/lib/chat.ts`:

```ts
import dayjs from "@/lib/dayjs"

const VN_TZ = "Asia/Ho_Chi_Minh"

// Chu kỳ polling (spec AC §6.1); `live` dùng khi realtime đang nối (phần 2).
export const CHAT_POLL_MS = { unread: 60_000, adminUnread: 30_000, inbox: 10_000, thread: 5_000, live: 30_000 } as const

export const CHAT_PREVIEW_MAX = 60
export const CHAT_EVENT = "chat:new"
export const ADMIN_CHAT_CHANNEL = "private-chat-admins"

export function userChatChannel(userId: number): string {
  return `private-chat-user-${userId}`
}

export function chatPreview(body: string): string {
  const one = body.replace(/\s+/g, " ").trim()
  return one.length > CHAT_PREVIEW_MAX ? one.slice(0, CHAT_PREVIEW_MAX - 1) + "…" : one
}

// So ngày bằng chuỗi giờ VN: isSame của dayjs tz dễ lệch múi.
export function chatTime(date: Date | string, now: Date = new Date()): string {
  const d = dayjs(date).tz(VN_TZ)
  const sameDay = d.format("YYYY-MM-DD") === dayjs(now).tz(VN_TZ).format("YYYY-MM-DD")
  return d.format(sameDay ? "HH:mm" : "DD/MM HH:mm")
}
```

- [ ] **Step 4: Chạy lại** `pnpm test tests/unit/lib/chat.test.ts`. Expected: PASS.

- [ ] **Step 5: `TRPCProvider` (test đỏ trước)** — tạo `tests/unit/components/TRPCProvider.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { shouldInvalidateAll, SKIP_GLOBAL_INVALIDATE } from "@/components/providers/TRPCProvider"

describe("shouldInvalidateAll (spec AC §5.1)", () => {
  it("mặc định làm mới toàn bộ", () => {
    expect(shouldInvalidateAll(undefined)).toBe(true)
    expect(shouldInvalidateAll({})).toBe(true)
    expect(shouldInvalidateAll({ skipGlobalInvalidate: false })).toBe(true)
  })
  it("mutation chat có meta thì bỏ qua", () => {
    expect(shouldInvalidateAll(SKIP_GLOBAL_INVALIDATE)).toBe(false)
  })
})
```

  - Cài đặt trong `src/components/providers/TRPCProvider.tsx` (ngoài component):

```ts
// Mutation gửi liên tục (chat) tự làm mới query của mình, không tải lại cả app (spec AC §5.1).
export const SKIP_GLOBAL_INVALIDATE = { skipGlobalInvalidate: true } as const

export function shouldInvalidateAll(meta: unknown): boolean {
  return !(typeof meta === "object" && meta !== null && (meta as { skipGlobalInvalidate?: unknown }).skipGlobalInvalidate === true)
}
```

  - Đổi `onSuccess` trong `MutationCache` thành:

```ts
        onSuccess: (_data, _variables, _context, mutation) => {
          if (shouldInvalidateAll(mutation.options.meta)) client.invalidateQueries()
        },
```

  - Comment cũ ở trên ("Bất kỳ mutation nào thành công → làm mới TOÀN BỘ query…") sửa thành "…trừ mutation có `SKIP_GLOBAL_INVALIDATE`".
  - Chạy `pnpm test tests/unit/components/TRPCProvider.test.ts`. Expected: PASS.

- [ ] **Step 6: i18n.** Thêm vào **cả** `src/language/vi.json` và `src/language/en.json` (đặt cạnh nhóm `feedback_*` / `admin_feedback_*`):

| key | vi | en |
|---|---|---|
| `chat_open` | Nhắn hỗ trợ | Message support |
| `chat_open_unread` | Nhắn hỗ trợ, {n} tin chưa đọc | Message support, {n} unread |
| `chat_title` | Nhắn với hỗ trợ | Chat with support |
| `chat_desc` | Hỏi cách dùng, báo lỗi hay góp ý. Admin trả lời ngay tại đây. | Ask how to use the app, report a bug or share ideas. Admin replies right here. |
| `chat_empty` | Chưa có tin nhắn. Gửi câu hỏi đầu tiên nhé. | No messages yet. Send your first question. |
| `chat_placeholder` | Nhập tin nhắn… | Type a message… |
| `chat_input_label` | Nội dung tin nhắn | Message |
| `chat_send` | Gửi | Send |
| `chat_send_error` | Chưa gửi được, thử lại nhé | Could not send, please try again |
| `chat_limit` | Thầy cô gửi nhanh quá, đợi vài phút rồi gửi tiếp nhé | You are sending too fast, please wait a few minutes |
| `chat_support` | Hỗ trợ | Support |
| `chat_seen` | Đã xem | Seen |
| `chat_load_older` | Xem tin cũ hơn | Load older messages |
| `chat_you` | Bạn: | You: |
| `admin_chat` | Tin nhắn | Messages |
| `admin_tab_chat` | Nhắn | Chat |
| `admin_chat_empty` | Chưa có cuộc trò chuyện nào. | No conversations yet. |
| `admin_chat_pick` | Chọn một cuộc trò chuyện để xem. | Pick a conversation to view. |
| `admin_chat_back` | Quay lại danh sách | Back to list |
| `admin_chat_unread_label` | {n} cuộc trò chuyện chưa đọc | {n} unread conversations |

  - Dùng lại key có sẵn: `load_error`, `retry`, `admin_feedback_more` ("Xem thêm").
  - Chạy test i18n sẵn có (`pnpm test tests/unit` có test so bộ key 2 file). Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/chat.ts src/components/providers/TRPCProvider.tsx src/language/vi.json src/language/en.json tests/unit/lib/chat.test.ts tests/unit/components/TRPCProvider.test.ts
git commit -m "feat: tien ich chat, i18n va bo qua invalidate toan cuc"
```

---

### Task 3: Service + router `chat` + `admin.chat*`

**Files:**
- Create: `src/lib/schemas/chat.ts`, `src/server/services/chat.service.ts`, `src/server/trpc/routers/chat.ts`
- Modify: `src/server/trpc/root.ts`, `src/server/trpc/routers/admin.ts`
- Test: `tests/integration/chat.test.ts`

**Interfaces:**
- Consumes: `chatPreview` từ `@/lib/chat` (Task 2).
- Produces:

```ts
type ChatMessageDto = { id: number; fromAdmin: boolean; senderName: string | null; body: string; createdAt: Date }
type ChatPage = { items: ChatMessageDto[]; nextCursor: number | null; otherReadAt: Date | null }
type ChatInboxItem = { userId: number; username: string; fullName: string | null; lastMessageAt: Date; unread: number; preview: string; lastFromAdmin: boolean }

chat.unread() → { count: number }
chat.messages({ cursor?: number }) → ChatPage
chat.send({ body: string }) → ChatMessageDto
chat.markRead() → { ok: true }
admin.chatUnread() → { conversations: number }
admin.chatInbox({ limit?: number }) → { items: ChatInboxItem[]; hasMore: boolean }
admin.chatMessages({ userId: number; cursor?: number }) → ChatPage
admin.chatSend({ userId: number; body: string }) → ChatMessageDto
admin.chatMarkRead({ userId: number }) → { ok: true }
```

  - Hằng: `CHAT_BODY_MAX = 2000` (ở `@/lib/schemas/chat`), `CHAT_PAGE_SIZE = 30`, `CHAT_RATE_LIMIT = 30`, `CHAT_RATE_WINDOW_MS = 600_000` (ở service).

- [ ] **Step 1: Schema zod** — tạo `src/lib/schemas/chat.ts`:

```ts
import { z } from "zod"

export const CHAT_BODY_MAX = 2000
export const CHAT_INBOX_PAGE = 30

// trim chạy trước min/max nên chuỗi toàn khoảng trắng bị từ chối.
const chatBody = z.string().trim().min(1).max(CHAT_BODY_MAX)
const userId = z.number().int().positive()
const cursor = z.number().int().positive().optional()

export const chatSendSchema = z.object({ body: chatBody })
export const chatCursorSchema = z.object({ cursor })
export const adminChatThreadSchema = z.object({ userId, cursor })
export const adminChatSendSchema = z.object({ userId, body: chatBody })
export const adminChatUserSchema = z.object({ userId })
export const adminChatInboxSchema = z.object({ limit: z.number().int().min(1).max(200).default(CHAT_INBOX_PAGE) })
```

- [ ] **Step 2: Test integration (đỏ)** — tạo `tests/integration/chat.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function clean() {
  await db.chatMessage.deleteMany()
  await db.chatConversation.deleteMany()
  await db.user.updateMany({ where: { username: { in: ["teacher", "teacher2"] } }, data: { isDeleted: false, deletedAt: null } })
}

const userIdOf = async (username: string) => (await db.user.findUniqueOrThrow({ where: { username } })).id

describe("chat (spec AC §5)", () => {
  beforeEach(async () => {
    process.env.ADMIN_USERNAMES = "admin_test"
    await clean()
  })
  afterEach(async () => {
    delete process.env.ADMIN_USERNAMES
    await clean()
  })

  it("giáo viên gửi: tạo cuộc trò chuyện, trim, tăng adminUnreadCount, trả DTO không có senderName", async () => {
    const t = await getAuthedCaller("teacher")
    const msg = await t.chat.send({ body: "  Cho hỏi cách nhập Excel  " })
    expect(msg).toMatchObject({ fromAdmin: false, senderName: null, body: "Cho hỏi cách nhập Excel" })
    await t.chat.send({ body: "Cảm ơn" })
    const conv = await db.chatConversation.findUniqueOrThrow({ where: { userId: await userIdOf("teacher") } })
    expect(conv.adminUnreadCount).toBe(2)
    expect(conv.userUnreadCount).toBe(0)
    const stored = await db.chatMessage.findFirstOrThrow({ where: { id: msg.id } })
    expect(stored.senderName).toBe("teacher")
  })

  it("rỗng sau trim hoặc > 2000 ký tự bị BAD_REQUEST, không tạo gì", async () => {
    const t = await getAuthedCaller("teacher")
    await expect(t.chat.send({ body: "   \n " })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(t.chat.send({ body: "a".repeat(2001) })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.chatConversation.count()).toBe(0)
  })

  it("body trong DB là ciphertext, đọc qua API ra bản rõ", async () => {
    const t = await getAuthedCaller("teacher")
    const msg = await t.chat.send({ body: "SĐT phụ huynh 0901234567" })
    // Alias cột để decryptResult không giải mã.
    const [raw] = await db.$queryRaw<Array<{ b: string }>>`SELECT body AS b FROM chat_messages WHERE id = ${msg.id}`
    expect(raw.b.startsWith("enc:v1:")).toBe(true)
    expect(raw.b).not.toContain("0901234567")
    const page = await t.chat.messages({})
    expect(page.items[0].body).toBe("SĐT phụ huynh 0901234567")
  })

  it("admin trả lời: tăng userUnreadCount, xoá adminUnreadCount; markRead 2 phía; otherReadAt", async () => {
    const t = await getAuthedCaller("teacher")
    const admin = await getAuthedCaller("admin_test")
    const uid = await userIdOf("teacher")
    await t.chat.send({ body: "Hỏi 1" })
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 1 })

    const reply = await admin.admin.chatSend({ userId: uid, body: "Chào thầy" })
    expect(reply).toMatchObject({ fromAdmin: true, senderName: "admin_test" })
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 0 })
    expect(await t.chat.unread()).toEqual({ count: 1 })

    // Phía giáo viên không thấy username admin.
    const teacherView = await t.chat.messages({})
    expect(teacherView.items.map((m) => m.senderName)).toEqual([null, null])
    expect(teacherView.otherReadAt).not.toBeNull()

    await t.chat.markRead()
    expect(await t.chat.unread()).toEqual({ count: 0 })
    const adminView = await admin.admin.chatMessages({ userId: uid })
    expect(adminView.otherReadAt).not.toBeNull()
    expect(adminView.items.map((m) => m.senderName)).toEqual(["teacher", "admin_test"])

    await t.chat.send({ body: "Hỏi 2" })
    await admin.admin.chatMarkRead({ userId: uid })
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 0 })
  })

  it("chưa có cuộc trò chuyện: unread 0, messages rỗng, markRead không lỗi", async () => {
    const t = await getAuthedCaller("teacher")
    expect(await t.chat.unread()).toEqual({ count: 0 })
    expect(await t.chat.messages({})).toEqual({ items: [], nextCursor: null, otherReadAt: null })
    expect(await t.chat.markRead()).toEqual({ ok: true })
  })

  it("phân trang 30 tin, trong trang cũ → mới, nextCursor đúng", async () => {
    const t = await getAuthedCaller("teacher")
    const uid = await userIdOf("teacher")
    const conv = await db.chatConversation.create({ data: { userId: uid } })
    for (let i = 0; i < 32; i++) {
      await db.chatMessage.create({ data: { conversationId: conv.id, fromAdmin: false, senderName: "teacher", body: `m${i}` } })
    }
    const p1 = await t.chat.messages({})
    expect(p1.items).toHaveLength(30)
    expect(p1.items[0].body).toBe("m2")
    expect(p1.items[29].body).toBe("m31")
    expect(p1.nextCursor).toBe(p1.items[0].id)
    const p2 = await t.chat.messages({ cursor: p1.nextCursor! })
    expect(p2.items.map((m) => m.body)).toEqual(["m0", "m1"])
    expect(p2.nextCursor).toBeNull()
  })

  it("giới hạn 30 tin / 10 phút cho giáo viên; tin cũ hơn không tính; admin không giới hạn", async () => {
    const t = await getAuthedCaller("teacher")
    const uid = await userIdOf("teacher")
    const conv = await db.chatConversation.create({ data: { userId: uid } })
    const old = new Date(Date.now() - 11 * 60_000)
    await db.chatMessage.create({ data: { conversationId: conv.id, fromAdmin: false, senderName: "teacher", body: "cũ", createdAt: old } })
    await db.chatMessage.createMany({
      data: Array.from({ length: 29 }, (_, i) => ({ conversationId: conv.id, fromAdmin: false, senderName: "teacher", body: `x${i}` })),
    })
    await t.chat.send({ body: "tin thứ 30" })
    await expect(t.chat.send({ body: "tin thứ 31" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: "CHAT_LIMIT" })
    const admin = await getAuthedCaller("admin_test")
    for (let i = 0; i < 31; i++) await admin.admin.chatSend({ userId: uid, body: `a${i}` })
  })

  it("giáo viên A không thấy tin của B; quyền chéo bị FORBIDDEN", async () => {
    const a = await getAuthedCaller("teacher")
    const b = await getAuthedCaller("teacher2")
    await a.chat.send({ body: "bí mật của A" })
    expect((await b.chat.messages({})).items).toEqual([])
    expect(await b.chat.unread()).toEqual({ count: 0 })

    const admin = await getAuthedCaller("admin_test")
    await expect(admin.chat.send({ body: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.chat.unread()).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(a.admin.chatInbox({})).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(a.admin.chatSend({ userId: await userIdOf("teacher2"), body: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("chatSend tới tài khoản không tồn tại, đã xoá mềm hoặc admin → NOT_FOUND", async () => {
    const admin = await getAuthedCaller("admin_test")
    await expect(admin.admin.chatSend({ userId: 999999, body: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(admin.admin.chatSend({ userId: await userIdOf("admin_test"), body: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await db.user.update({ where: { username: "teacher2" }, data: { isDeleted: true, deletedAt: new Date() } })
    await expect(admin.admin.chatSend({ userId: await userIdOf("teacher2"), body: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("chatInbox: mới nhất trước, preview cắt 60 ký tự, lastFromAdmin, ẩn tài khoản xoá mềm, hasMore", async () => {
    const admin = await getAuthedCaller("admin_test")
    await (await getAuthedCaller("teacher")).chat.send({ body: "a".repeat(80) })
    await new Promise((r) => setTimeout(r, 5))
    await (await getAuthedCaller("teacher2")).chat.send({ body: "Xin   chào\nadmin" })
    await admin.admin.chatSend({ userId: await userIdOf("teacher2"), body: "Chào cô" })

    const inbox = await admin.admin.chatInbox({})
    expect(inbox.items.map((i) => i.username)).toEqual(["teacher2", "teacher"])
    expect(inbox.items[0]).toMatchObject({ preview: "Chào cô", lastFromAdmin: true, unread: 0 })
    expect(inbox.items[1]).toMatchObject({ preview: "a".repeat(59) + "…", lastFromAdmin: false, unread: 1, fullName: "Giáo viên Test" })
    expect(inbox.hasMore).toBe(false)
    expect((await admin.admin.chatInbox({ limit: 1 })).hasMore).toBe(true)

    await db.user.update({ where: { username: "teacher" }, data: { isDeleted: true, deletedAt: new Date() } })
    expect((await admin.admin.chatInbox({})).items.map((i) => i.username)).toEqual(["teacher2"])
    expect(await admin.admin.chatUnread()).toEqual({ conversations: 0 })
  })
})
```

  - `fullName` của `teacher` lấy đúng giá trị seed trong `tests/setup.ts` ("Giáo viên Test"); seed khác thì sửa theo seed.

- [ ] **Step 3: Chạy** `pnpm test tests/integration/chat.test.ts`. Expected: FAIL (`t.chat` undefined).

- [ ] **Step 4: Service** — tạo `src/server/services/chat.service.ts`:

```ts
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { isAdminUsername } from "@/lib/admin"
import { chatPreview } from "@/lib/chat"

export const CHAT_PAGE_SIZE = 30
export const CHAT_RATE_LIMIT = 30
export const CHAT_RATE_WINDOW_MS = 10 * 60_000

export type ChatMessageDto = { id: number; fromAdmin: boolean; senderName: string | null; body: string; createdAt: Date }

const MESSAGE_SELECT = { id: true, fromAdmin: true, senderName: true, body: true, createdAt: true } as const

// Trang theo id giảm dần, trả về cũ → mới để giao diện vẽ từ trên xuống.
async function pageMessages(db: PrismaClient, conversationId: number, cursor: number | undefined, withSender: boolean) {
  const rows = await db.chatMessage.findMany({
    where: { conversationId, ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: { id: "desc" },
    take: CHAT_PAGE_SIZE + 1,
    select: MESSAGE_SELECT,
  })
  const page = rows.slice(0, CHAT_PAGE_SIZE)
  const nextCursor = rows.length > CHAT_PAGE_SIZE ? page[page.length - 1].id : null
  const items: ChatMessageDto[] = page.reverse().map((m) => ({ ...m, senderName: withSender ? m.senderName : null }))
  return { items, nextCursor }
}

export async function sendUserMessage(db: PrismaClient, user: { id: number; username: string }, body: string) {
  const since = new Date(Date.now() - CHAT_RATE_WINDOW_MS)
  const recent = await db.chatMessage.count({
    where: { fromAdmin: false, createdAt: { gte: since }, conversation: { userId: user.id } },
  })
  if (recent >= CHAT_RATE_LIMIT) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "CHAT_LIMIT" })
  const now = new Date()
  return db.$transaction(async (tx) => {
    // where chỉ có khoá unique và create cùng giá trị → Prisma chạy ON CONFLICT, 2 tin đầu cùng lúc không lỗi.
    const conv = await tx.chatConversation.upsert({
      where: { userId: user.id },
      create: { userId: user.id, adminUnreadCount: 1, lastMessageAt: now },
      update: { adminUnreadCount: { increment: 1 }, lastMessageAt: now },
      select: { id: true },
    })
    const msg = await tx.chatMessage.create({
      data: { conversationId: conv.id, fromAdmin: false, senderName: user.username, body, createdAt: now },
      select: MESSAGE_SELECT,
    })
    return { ...msg, senderName: null } satisfies ChatMessageDto
  })
}

export async function getUserUnread(db: PrismaClient, userId: number) {
  const conv = await db.chatConversation.findUnique({ where: { userId }, select: { userUnreadCount: true } })
  return { count: conv?.userUnreadCount ?? 0 }
}

export async function listUserMessages(db: PrismaClient, userId: number, cursor?: number) {
  const conv = await db.chatConversation.findUnique({ where: { userId }, select: { id: true, adminReadAt: true } })
  if (!conv) return { items: [] as ChatMessageDto[], nextCursor: null, otherReadAt: null }
  return { ...(await pageMessages(db, conv.id, cursor, false)), otherReadAt: conv.adminReadAt }
}

export async function markUserRead(db: PrismaClient, userId: number) {
  await db.chatConversation.updateMany({ where: { userId }, data: { userUnreadCount: 0, userReadAt: new Date() } })
  return { ok: true as const }
}

const LIVE_USER = { user: { isDeleted: false } } as const

export async function getAdminUnread(db: PrismaClient) {
  const conversations = await db.chatConversation.count({ where: { adminUnreadCount: { gt: 0 }, ...LIVE_USER } })
  return { conversations }
}

export async function listAdminInbox(db: PrismaClient, limit: number) {
  const rows = await db.chatConversation.findMany({
    where: LIVE_USER,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      userId: true,
      lastMessageAt: true,
      adminUnreadCount: true,
      user: { select: { username: true, fullName: true } },
      messages: { orderBy: { id: "desc" }, take: 1, select: { body: true, fromAdmin: true } },
    },
  })
  return {
    items: rows.slice(0, limit).map((r) => ({
      userId: r.userId,
      username: r.user.username,
      fullName: r.user.fullName,
      lastMessageAt: r.lastMessageAt,
      unread: r.adminUnreadCount,
      preview: chatPreview(r.messages[0]?.body ?? ""),
      lastFromAdmin: r.messages[0]?.fromAdmin ?? false,
    })),
    hasMore: rows.length > limit,
  }
}

export async function listAdminMessages(db: PrismaClient, userId: number, cursor?: number) {
  const conv = await db.chatConversation.findFirst({ where: { userId, ...LIVE_USER }, select: { id: true, userReadAt: true } })
  if (!conv) return { items: [] as ChatMessageDto[], nextCursor: null, otherReadAt: null }
  return { ...(await pageMessages(db, conv.id, cursor, true)), otherReadAt: conv.userReadAt }
}

export async function sendAdminMessage(db: PrismaClient, adminUsername: string, userId: number, body: string) {
  const target = await db.user.findUnique({ where: { id: userId }, select: { username: true, isDeleted: true } })
  if (!target || target.isDeleted || isAdminUsername(target.username)) throw new TRPCError({ code: "NOT_FOUND" })
  const now = new Date()
  return db.$transaction(async (tx) => {
    // Admin trả lời tức là đã đọc phía admin.
    const conv = await tx.chatConversation.upsert({
      where: { userId },
      create: { userId, userUnreadCount: 1, adminReadAt: now, lastMessageAt: now },
      update: { userUnreadCount: { increment: 1 }, adminUnreadCount: 0, adminReadAt: now, lastMessageAt: now },
      select: { id: true },
    })
    const msg = await tx.chatMessage.create({
      data: { conversationId: conv.id, fromAdmin: true, senderName: adminUsername, body, createdAt: now },
      select: MESSAGE_SELECT,
    })
    return msg satisfies ChatMessageDto
  })
}

export async function markAdminRead(db: PrismaClient, userId: number) {
  await db.chatConversation.updateMany({ where: { userId }, data: { adminUnreadCount: 0, adminReadAt: new Date() } })
  return { ok: true as const }
}
```

- [ ] **Step 5: Router.**
  - Tạo `src/server/trpc/routers/chat.ts`:

```ts
import { createTRPCRouter, teacherProcedure } from "@/server/trpc"
import { chatCursorSchema, chatSendSchema } from "@/lib/schemas/chat"
import { getUserUnread, listUserMessages, markUserRead, sendUserMessage } from "@/server/services/chat.service"

export const chatRouter = createTRPCRouter({
  unread: teacherProcedure.query(({ ctx }) => getUserUnread(ctx.db, ctx.userId)),
  messages: teacherProcedure.input(chatCursorSchema).query(({ ctx, input }) => listUserMessages(ctx.db, ctx.userId, input.cursor)),
  send: teacherProcedure
    .input(chatSendSchema)
    .mutation(({ ctx, input }) => sendUserMessage(ctx.db, { id: ctx.userId, username: ctx.session.user.username }, input.body)),
  markRead: teacherProcedure.mutation(({ ctx }) => markUserRead(ctx.db, ctx.userId)),
})
```

  - `root.ts`: import và thêm `chat: chatRouter` (cuối object, sau `feedback`).
  - `admin.ts`: thêm import schema + service, rồi thêm vào `adminRouter`:

```ts
  chatUnread: adminProcedure.query(({ ctx }) => getAdminUnread(ctx.db)),
  chatInbox: adminProcedure.input(adminChatInboxSchema).query(({ ctx, input }) => listAdminInbox(ctx.db, input.limit)),
  chatMessages: adminProcedure
    .input(adminChatThreadSchema)
    .query(({ ctx, input }) => listAdminMessages(ctx.db, input.userId, input.cursor)),
  chatSend: adminProcedure
    .input(adminChatSendSchema)
    .mutation(({ ctx, input }) => sendAdminMessage(ctx.db, ctx.session.user.username, input.userId, input.body)),
  chatMarkRead: adminProcedure.input(adminChatUserSchema).mutation(({ ctx, input }) => markAdminRead(ctx.db, input.userId)),
```

  - `admin.chatInbox({})` phải chạy được (limit có default). Nếu tRPC báo input bắt buộc, giữ `.default(CHAT_INBOX_PAGE)` trong schema và gọi `{}` như test.

- [ ] **Step 6: Chạy** `pnpm test tests/integration/chat.test.ts`. Expected: PASS (10 test). Sau đó chạy `pnpm test` toàn bộ. Expected: xanh hết.

- [ ] **Step 7: Commit**

```bash
git add src/lib/schemas/chat.ts src/server/services/chat.service.ts src/server/trpc/routers/chat.ts src/server/trpc/root.ts src/server/trpc/routers/admin.ts tests/integration/chat.test.ts
git commit -m "feat: router chat va admin.chat*"
```

---

### Task 4: Component dùng chung `ChatComposer` + `ChatMessageList`

**Files:**
- Create: `src/components/chat/ChatComposer.tsx`, `src/components/chat/ChatMessageList.tsx`
- Test: `tests/unit/components/ChatComposer.test.tsx`, `tests/unit/components/ChatMessageList.test.tsx`

**Interfaces:**
- Produces:

```ts
type ChatMessageView = { id: number; fromAdmin: boolean; senderName: string | null; body: string; createdAt: Date | string }

ChatComposer(props: { onSend: (body: string) => Promise<unknown>; pending: boolean })
ChatMessageList(props: {
  items: ChatMessageView[]
  viewer: "teacher" | "admin"
  otherReadAt: Date | string | null
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  emptyText: string
})
```

- [ ] **Step 1: Test `ChatComposer` (đỏ)** — tạo `tests/unit/components/ChatComposer.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ChatComposer } from "@/components/chat/ChatComposer"

afterEach(cleanup)

function setup(onSend = vi.fn().mockResolvedValue(undefined), pending = false) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <ChatComposer onSend={onSend} pending={pending} />
    </LanguageProvider>
  )
  return { onSend, input: screen.getByLabelText("Nội dung tin nhắn"), button: screen.getByRole("button", { name: "Gửi" }) }
}

describe("ChatComposer", () => {
  it("rỗng hoặc toàn khoảng trắng thì nút Gửi tắt", () => {
    const { input, button } = setup()
    expect(button).toHaveProperty("disabled", true)
    fireEvent.change(input, { target: { value: "   " } })
    expect(button).toHaveProperty("disabled", true)
  })

  it("Enter gửi bản đã trim rồi xoá ô; Shift+Enter không gửi", async () => {
    const { onSend, input } = setup()
    fireEvent.change(input, { target: { value: "  Xin chào  " } })
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSend).toHaveBeenCalledWith("Xin chào")
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe(""))
  })

  it("đang ghép chữ Telex/VNI thì Enter không gửi", () => {
    const { onSend, input } = setup()
    fireEvent.change(input, { target: { value: "Vieejt" } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })
    expect(onSend).not.toHaveBeenCalled()
  })

  it("gửi lỗi thì giữ nguyên chữ", async () => {
    const { input, button } = setup(vi.fn().mockRejectedValue(new Error("x")))
    fireEvent.change(input, { target: { value: "Còn đây" } })
    fireEvent.click(button)
    await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe("Còn đây"))
  })

  it("từ 1800 ký tự hiện bộ đếm; quá 2000 thì tắt nút", () => {
    const { input, button } = setup()
    fireEvent.change(input, { target: { value: "a".repeat(1799) } })
    expect(screen.queryByTestId("chat-counter")).toBeNull()
    fireEvent.change(input, { target: { value: "a".repeat(1800) } })
    expect(screen.getByTestId("chat-counter").textContent).toBe("1800/2000")
    fireEvent.change(input, { target: { value: "a".repeat(2001) } })
    expect(button).toHaveProperty("disabled", true)
  })

  it("đang gửi thì nút tắt", () => {
    const { input, button } = setup(undefined, true)
    fireEvent.change(input, { target: { value: "abc" } })
    expect(button).toHaveProperty("disabled", true)
  })
})
```

- [ ] **Step 2: Cài đặt** — tạo `src/components/chat/ChatComposer.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Loader2, SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { CHAT_BODY_MAX } from "@/lib/schemas/chat"
import { cn } from "@/lib/utils"

const COUNTER_FROM = CHAT_BODY_MAX - 200

export function ChatComposer({ onSend, pending }: { onSend: (body: string) => Promise<unknown>; pending: boolean }) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const trimmed = text.trim()
  const tooLong = text.length > CHAT_BODY_MAX
  const canSend = trimmed.length > 0 && !tooLong && !pending

  async function submit() {
    if (!canSend) return
    try {
      await onSend(trimmed)
      setText("")
    } catch {
      // Nơi gọi đã toast; giữ chữ để gửi lại.
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="flex items-end gap-2 border-t bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="min-w-0 flex-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Gõ Telex/VNI đang ghép chữ thì Enter chỉ chốt chữ, không gửi (Safari báo keyCode 229).
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            void submit()
          }}
          rows={1}
          aria-label={t("chat_input_label")}
          placeholder={t("chat_placeholder")}
          className="max-h-32 min-h-11 resize-none"
        />
        {text.length >= COUNTER_FROM && (
          <p data-testid="chat-counter" className={cn("mt-1 text-right text-xs", tooLong ? "text-red-600" : "text-slate-500")}>
            {text.length}/{CHAT_BODY_MAX}
          </p>
        )}
      </div>
      <Button type="submit" size="icon" className="size-11 shrink-0" disabled={!canSend} aria-label={t("chat_send")}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
      </Button>
    </form>
  )
}
```

  - `fireEvent.keyDown(input, { key: "Enter", isComposing: true })` trong jsdom gán `nativeEvent.isComposing`. Nếu jsdom bản đang dùng bỏ qua thuộc tính này, chỉ giữ ca `keyCode: 229` và ghi Ruling.

- [ ] **Step 3: Test `ChatMessageList` (đỏ)** — tạo `tests/unit/components/ChatMessageList.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ChatMessageList } from "@/components/chat/ChatMessageList"

afterEach(cleanup)

const items = [
  { id: 1, fromAdmin: false, senderName: "teacher", body: "Hỏi <b>x</b>\ndòng 2", createdAt: "2026-10-07T01:00:00.000Z" },
  { id: 2, fromAdmin: true, senderName: "admin_test", body: "Trả lời", createdAt: "2026-10-07T01:05:00.000Z" },
]

function renderList(props: Partial<Parameters<typeof ChatMessageList>[0]> = {}) {
  const onLoadOlder = vi.fn()
  render(
    <LanguageProvider forcedLanguage="vi">
      <ChatMessageList items={items} viewer="teacher" otherReadAt={null} hasOlder={false} loadingOlder={false} onLoadOlder={onLoadOlder} emptyText="Trống" {...props} />
    </LanguageProvider>
  )
  return { onLoadOlder }
}

describe("ChatMessageList", () => {
  it("giáo viên xem: tin mình bên phải, tin admin bên trái có nhãn Hỗ trợ, không hiện username admin", () => {
    renderList()
    const [mine, theirs] = screen.getAllByTestId("chat-message")
    expect(mine.getAttribute("data-mine")).toBe("true")
    expect(theirs.getAttribute("data-mine")).toBe("false")
    expect(within(theirs).getByText("Hỗ trợ")).toBeTruthy()
    expect(screen.queryByText("admin_test")).toBeNull()
    // Không render HTML.
    expect(within(mine).getByText(/Hỏi <b>x<\/b>/)).toBeTruthy()
  })

  it("admin xem: tin admin bên phải kèm username admin", () => {
    renderList({ viewer: "admin" })
    const [teacherMsg, adminMsg] = screen.getAllByTestId("chat-message")
    expect(teacherMsg.getAttribute("data-mine")).toBe("false")
    expect(adminMsg.getAttribute("data-mine")).toBe("true")
    expect(within(adminMsg).getByText("admin_test")).toBeTruthy()
  })

  it("Đã xem dưới tin cuối của mình khi otherReadAt không sớm hơn", () => {
    renderList({ viewer: "admin", otherReadAt: "2026-10-07T01:04:00.000Z" })
    expect(screen.queryByText("Đã xem")).toBeNull()
    cleanup()
    renderList({ viewer: "admin", otherReadAt: "2026-10-07T01:05:00.000Z" })
    expect(screen.getByText("Đã xem")).toBeTruthy()
  })

  it("nút Xem tin cũ hơn khi hasOlder; rỗng thì hiện emptyText", () => {
    const { onLoadOlder } = renderList({ hasOlder: true })
    fireEvent.click(screen.getByRole("button", { name: "Xem tin cũ hơn" }))
    expect(onLoadOlder).toHaveBeenCalled()
    cleanup()
    renderList({ items: [] })
    expect(screen.getByText("Trống")).toBeTruthy()
  })
})
```

- [ ] **Step 4: Cài đặt** — tạo `src/components/chat/ChatMessageList.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { chatTime } from "@/lib/chat"
import { cn } from "@/lib/utils"

export type ChatMessageView = { id: number; fromAdmin: boolean; senderName: string | null; body: string; createdAt: Date | string }

type Props = {
  items: ChatMessageView[]
  viewer: "teacher" | "admin"
  otherReadAt: Date | string | null
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  emptyText: string
}

export function ChatMessageList({ items, viewer, otherReadAt, hasOlder, loadingOlder, onLoadOlder, emptyText }: Props) {
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const isMine = (m: ChatMessageView) => (viewer === "admin" ? m.fromAdmin : !m.fromAdmin)
  const lastId = items[items.length - 1]?.id
  const lastMine = [...items].reverse().find(isMine)
  const seen = lastMine && otherReadAt !== null && new Date(otherReadAt).getTime() >= new Date(lastMine.createdAt).getTime()

  // Chỉ cuộn xuống khi có tin mới nhất đổi; tải tin cũ không kéo người đọc đi.
  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [lastId])

  return (
    <div ref={boxRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-page p-3">
      {hasOlder && (
        <div className="flex justify-center">
          <Button variant="outline" className="h-11 md:h-9" onClick={onLoadOlder} disabled={loadingOlder}>
            {loadingOlder && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("chat_load_older")}
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="pt-10 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        items.map((m) => {
          const mine = isMine(m)
          return (
            <div key={m.id} data-testid="chat-message" data-mine={mine} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              {!mine && viewer === "teacher" && <span className="mb-0.5 text-xs font-medium text-primary">{t("chat_support")}</span>}
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-900"
                )}
              >
                {m.body}
              </p>
              <span className="mt-0.5 text-[11px] text-slate-500">
                {viewer === "admin" && m.fromAdmin && m.senderName ? `${m.senderName} · ` : ""}
                {chatTime(m.createdAt)}
              </span>
              {m.id === lastMine?.id && seen && <span className="text-[11px] text-slate-500">{t("chat_seen")}</span>}
            </div>
          )
        })
      )}
    </div>
  )
}
```

  - Test "admin xem … username admin" tìm `getByText("admin_test")`; chữ thật là `admin_test · 08:05`. Nếu `getByText` không khớp chuỗi con, đưa `senderName` vào `<span>` riêng (giữ dấu ` · ` bên ngoài) thay vì sửa test.

- [ ] **Step 5: Chạy** `pnpm test tests/unit/components/ChatComposer.test.tsx tests/unit/components/ChatMessageList.test.tsx`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat tests/unit/components/ChatComposer.test.tsx tests/unit/components/ChatMessageList.test.tsx
git commit -m "feat: component danh sach tin va o nhap chat"
```

---

### Task 5: Giáo viên — nút chat trên header + khung chat

**Files:**
- Create: `src/components/chat/ChatButton.tsx`, `src/components/chat/ChatSheet.tsx`
- Modify: `src/components/layout/AppHeader.tsx`
- Test: `tests/unit/components/ChatButton.test.tsx`; cập nhật `tests/unit/components/AppHeader.test.tsx` nếu test đó mock `trpc` theo danh sách cố định

**Interfaces:**
- Consumes: `trpc.chat.*`, `ChatMessageList`, `ChatComposer`, `CHAT_POLL_MS`, `SKIP_GLOBAL_INVALIDATE`.
- Produces: `ChatButton()` (không prop), `ChatSheet({ onClose })`.

- [ ] **Step 1: Test (đỏ)** — tạo `tests/unit/components/ChatButton.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ChatButton } from "@/components/chat/ChatButton"

const unread = vi.hoisted(() => ({ count: 0 }))
vi.mock("@/lib/trpc", () => ({
  trpc: { chat: { unread: { useQuery: () => ({ data: { count: unread.count } }) } } },
}))
vi.mock("@/components/chat/ChatSheet", () => ({ ChatSheet: () => <div data-testid="chat-sheet" /> }))

beforeEach(() => {
  unread.count = 0
})
afterEach(cleanup)

function renderVi() {
  render(<LanguageProvider forcedLanguage="vi"><ChatButton /></LanguageProvider>)
}

describe("ChatButton", () => {
  it("không có tin chưa đọc: nhãn Nhắn hỗ trợ, không badge", () => {
    renderVi()
    expect(screen.getByRole("button", { name: "Nhắn hỗ trợ" })).toBeTruthy()
    expect(screen.queryByTestId("chat-unread")).toBeNull()
  })

  it("có 3 tin: badge 3 và nhãn có số", () => {
    unread.count = 3
    renderVi()
    expect(screen.getByRole("button", { name: "Nhắn hỗ trợ, 3 tin chưa đọc" })).toBeTruthy()
    expect(screen.getByTestId("chat-unread").textContent).toBe("3")
  })

  it("quá 9 hiện 9+", () => {
    unread.count = 12
    renderVi()
    expect(screen.getByTestId("chat-unread").textContent).toBe("9+")
  })

  it("bấm nút mở khung chat", () => {
    renderVi()
    expect(screen.queryByTestId("chat-sheet")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Nhắn hỗ trợ" }))
    expect(screen.getByTestId("chat-sheet")).toBeTruthy()
  })
})
```

- [ ] **Step 2: Cài đặt `ChatButton`** — tạo `src/components/chat/ChatButton.tsx`:

```tsx
"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS } from "@/lib/chat"
import { ChatSheet } from "./ChatSheet"

export function ChatButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const count = trpc.chat.unread.useQuery(undefined, { refetchInterval: CHAT_POLL_MS.unread }).data?.count ?? 0
  const label = count > 0 ? t("chat_open_unread").replace("{n}", String(count)) : t("chat_open")

  return (
    <>
      <Button variant="outline" size="icon" className="relative size-11 text-slate-600 md:size-10" aria-label={label} onClick={() => setOpen(true)}>
        <MessageCircle className="size-5" />
        {count > 0 && (
          <span
            data-testid="chat-unread"
            aria-hidden
            className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-amber-100 px-1 text-center text-[11px] font-semibold leading-5 text-amber-800"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
      {open && <ChatSheet onClose={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 3: Cài đặt `ChatSheet`** — tạo `src/components/chat/ChatSheet.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { SKIP_GLOBAL_INVALIDATE } from "@/components/providers/TRPCProvider"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS } from "@/lib/chat"
import { ChatComposer } from "./ChatComposer"
import { ChatMessageList } from "./ChatMessageList"

export function ChatSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const query = trpc.chat.messages.useInfiniteQuery(
    {},
    { getNextPageParam: (last) => last.nextCursor ?? undefined, refetchInterval: CHAT_POLL_MS.thread }
  )
  const send = trpc.chat.send.useMutation({
    meta: SKIP_GLOBAL_INVALIDATE,
    onSuccess: () => utils.chat.messages.invalidate(),
    onError: (e) => toast.error(t(e.message === "CHAT_LIMIT" ? "chat_limit" : "chat_send_error")),
  })
  const { mutate: markRead } = trpc.chat.markRead.useMutation({
    meta: SKIP_GLOBAL_INVALIDATE,
    onSuccess: () => utils.chat.unread.setData(undefined, { count: 0 }),
  })

  // pages[0] là trang mới nhất; mỗi trang đã xếp cũ → mới.
  const pages = query.data?.pages ?? []
  const items = [...pages].reverse().flatMap((p) => p.items)
  const newestAdminId = items.reduce((max, m) => (m.fromAdmin && m.id > max ? m.id : max), 0)
  const markedUpTo = useRef(0)

  useEffect(() => {
    if (newestAdminId > markedUpTo.current) {
      markedUpTo.current = newestAdminId
      markRead()
    }
  }, [newestAdminId, markRead])

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle>{t("chat_title")}</SheetTitle>
          <SheetDescription>{t("chat_desc")}</SheetDescription>
        </SheetHeader>
        {query.isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        ) : query.isError ? (
          <div className="flex-1 p-6 text-center text-sm text-slate-600">
            {t("load_error")}{" "}
            <Button variant="link" onClick={() => query.refetch()}>{t("retry")}</Button>
          </div>
        ) : (
          <ChatMessageList
            items={items}
            viewer="teacher"
            otherReadAt={pages[0]?.otherReadAt ?? null}
            hasOlder={query.hasNextPage}
            loadingOlder={query.isFetchingNextPage}
            onLoadOlder={() => query.fetchNextPage()}
            emptyText={t("chat_empty")}
          />
        )}
        <ChatComposer pending={send.isPending} onSend={(body) => send.mutateAsync({ body })} />
      </SheetContent>
    </Sheet>
  )
}
```

  - Nếu `useMutation` của tRPC không nhận `meta` (lỗi type), truyền qua `trpc.chat.send.useMutation({ ...opts, meta })` vẫn phải tới `mutation.options.meta`; kiểm bằng test Task 2 + e2e (gửi tin không làm tải lại dashboard). Ghi Ruling nếu phải đổi cách.
  - Khung chat mở trên `/dashboard` (polling 5 giây) **không được** làm các query khác refetch: kiểm ở e2e Task 7: trong 12 giây mở khung và gửi 1 tin, không có request `/api/trpc/` nào ngoài `chat.*`.

- [ ] **Step 4: Gắn vào header.** Trong `src/components/layout/AppHeader.tsx`:
  - import `ChatButton` từ `@/components/chat/ChatButton`;
  - thêm `{!admin && <ChatButton />}` ngay sau `{!admin && <WhatsNew />}` (trước nút ngôn ngữ).
  - Nếu `tests/unit/components/AppHeader.test.tsx` mock `@/lib/trpc` theo danh sách cố định, thêm `chat: { unread: { useQuery: () => ({ data: { count: 0 } }) } }` vào mock (hoặc mock `@/components/chat/ChatButton`). Test admin variant phải xác nhận **không** có nút "Nhắn hỗ trợ".

- [ ] **Step 5: Chạy** `pnpm test tests/unit/components/ChatButton.test.tsx tests/unit/components/AppHeader.test.tsx`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/ChatButton.tsx src/components/chat/ChatSheet.tsx src/components/layout/AppHeader.tsx tests/unit/components/ChatButton.test.tsx tests/unit/components/AppHeader.test.tsx
git commit -m "feat: nut chat va khung chat cho giao vien"
```

---

### Task 6: Admin — mục nav "Tin nhắn", badge, trang `/admin/chat`

**Files:**
- Create: `src/app/(admin)/admin/chat/page.tsx`, `src/components/admin/AdminChat.tsx`, `src/components/admin/AdminChatThread.tsx`
- Modify: `src/components/admin/admin-nav.ts`, `src/components/admin/AdminSidebar.tsx`, `src/components/admin/AdminTabBar.tsx`
- Test: `tests/unit/components/AdminNav.test.tsx` (sửa), `tests/unit/components/AdminChat.test.tsx` (mới)

**Interfaces:**
- Consumes: `trpc.admin.chatUnread|chatInbox|chatMessages|chatSend|chatMarkRead`, `ChatMessageList`, `ChatComposer`.
- Produces: `AdminChat()`, `AdminChatThread({ userId, title, onBack })`.

- [ ] **Step 1: Sửa test nav (đỏ)** trong `tests/unit/components/AdminNav.test.tsx`:
  - mock trpc thêm `chatUnread`:

```tsx
const chat = vi.hoisted(() => ({ data: undefined as undefined | { conversations: number } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      pendingCount: { useQuery: () => ({ data: pending.data }) },
      chatUnread: { useQuery: () => ({ data: chat.data }) },
    },
  },
}))
```

  - `beforeEach` thêm `chat.data = undefined`.
  - Danh sách href mong đợi thành 8 mục: `/admin/overview`, `/admin/orders`, **`/admin/chat`**, `/admin/accounts`, `/admin/history`, `/admin/prices`, `/admin/revenue`, `/admin/feedback`. Đổi chữ "đúng 7 mục" / "7 tab" thành 8.
  - Thêm test:

```tsx
  it("badge chat chưa đọc ở sidebar và tab bar", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/overview")
    chat.data = { conversations: 2 }
    renderVi(<AdminSidebar />)
    expect(screen.getByTestId("admin-chat-unread").textContent).toBe("2")
    expect(screen.getByTestId("admin-chat-unread").getAttribute("aria-label")).toBe("2 cuộc trò chuyện chưa đọc")
    cleanup()
    renderVi(<AdminTabBar />)
    expect(screen.getByTestId("admin-chat-unread").textContent).toBe("2")
  })
```

- [ ] **Step 2: Nav.**
  - `admin-nav.ts`: import `MessagesSquare` và chèn sau mục `/admin/orders`:

```ts
  { href: "/admin/chat", labelKey: "admin_chat", shortKey: "admin_tab_chat", icon: MessagesSquare },
```

  - `AdminTabBar.tsx`: `grid-cols-7` → `grid-cols-8`; lấy `const chatUnread = trpc.admin.chatUnread.useQuery(undefined, { refetchInterval: CHAT_POLL_MS.adminUnread }).data?.conversations ?? 0`; trong `<span className="relative">` thêm badge cùng kiểu badge đơn chờ:

```tsx
                  {item.href === "/admin/chat" && chatUnread > 0 && (
                    <span
                      data-testid="admin-chat-unread"
                      aria-label={t("admin_chat_unread_label").replace("{n}", String(chatUnread))}
                      className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-amber-100 px-1 text-center text-[10px] font-semibold leading-4 text-amber-800"
                    >
                      {chatUnread}
                    </span>
                  )}
```

  - `AdminSidebar.tsx`: cùng query, badge cạnh nhãn giống `admin-pending-count`:

```tsx
              {item.href === "/admin/chat" && chatUnread > 0 && (
                <span
                  data-testid="admin-chat-unread"
                  aria-label={t("admin_chat_unread_label").replace("{n}", String(chatUnread))}
                  className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold leading-5 text-amber-800"
                >
                  {chatUnread}
                </span>
              )}
```

  - Chạy `pnpm test tests/unit/components/AdminNav.test.tsx`. Expected: PASS.

- [ ] **Step 3: Test trang (đỏ)** — tạo `tests/unit/components/AdminChat.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { AdminChat } from "@/components/admin/AdminChat"

const inbox = vi.hoisted(() => ({
  data: undefined as undefined | { items: unknown[]; hasMore: boolean },
}))
vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { chatInbox: { useQuery: () => ({ data: inbox.data, isPending: !inbox.data, isError: false, refetch: vi.fn() }) } } },
}))
vi.mock("@/components/admin/AdminChatThread", () => ({
  AdminChatThread: ({ userId, title, onBack }: { userId: number; title: string; onBack: () => void }) => (
    <div data-testid="thread">
      {userId}:{title}
      <button onClick={onBack}>back</button>
    </div>
  ),
}))

const rows = [
  { userId: 7, username: "co_lan", fullName: "Cô Lan", lastMessageAt: "2026-10-07T01:00:00.000Z", unread: 2, preview: "Cho hỏi", lastFromAdmin: false },
  { userId: 8, username: "thay_minh", fullName: null, lastMessageAt: "2026-10-06T01:00:00.000Z", unread: 0, preview: "Được ạ", lastFromAdmin: true },
]

beforeEach(() => {
  inbox.data = { items: rows, hasMore: true }
})
afterEach(cleanup)

const renderVi = () => render(<LanguageProvider forcedLanguage="vi"><AdminChat /></LanguageProvider>)

describe("AdminChat", () => {
  it("danh sách: tên hoặc username, tiền tố Bạn:, số chưa đọc, nút Xem thêm", () => {
    renderVi()
    const items = screen.getAllByTestId("admin-chat-item")
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain("Cô Lan")
    expect(items[0].textContent).toContain("co_lan")
    expect(items[0].textContent).toContain("2")
    expect(items[1].textContent).toContain("thay_minh")
    expect(items[1].textContent).toContain("Bạn: Được ạ")
    expect(screen.getByRole("button", { name: "Xem thêm" })).toBeTruthy()
    expect(screen.getByText("Chọn một cuộc trò chuyện để xem.")).toBeTruthy()
  })

  it("chọn 1 cuộc trò chuyện thì mở khung với đúng userId và tiêu đề; back quay lại", () => {
    renderVi()
    fireEvent.click(screen.getAllByTestId("admin-chat-item")[0])
    expect(screen.getByTestId("thread").textContent).toContain("7:Cô Lan")
    fireEvent.click(screen.getByText("back"))
    expect(screen.queryByTestId("thread")).toBeNull()
  })

  it("rỗng", () => {
    inbox.data = { items: [], hasMore: false }
    renderVi()
    expect(screen.getByText("Chưa có cuộc trò chuyện nào.")).toBeTruthy()
  })
})
```

- [ ] **Step 4: Cài đặt `AdminChat`** — tạo `src/components/admin/AdminChat.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS, chatTime } from "@/lib/chat"
import { CHAT_INBOX_PAGE } from "@/lib/schemas/chat"
import { cn } from "@/lib/utils"
import { AdminChatThread } from "./AdminChatThread"

export function AdminChat() {
  const { t } = useTranslation()
  const [limit, setLimit] = useState(CHAT_INBOX_PAGE)
  const [selected, setSelected] = useState<{ userId: number; title: string } | null>(null)
  const inbox = trpc.admin.chatInbox.useQuery({ limit }, { refetchInterval: CHAT_POLL_MS.inbox, placeholderData: (prev) => prev })

  const list = inbox.isPending ? (
    <Loader2 className="mx-auto mt-6 size-6 animate-spin text-slate-400" />
  ) : inbox.isError || !inbox.data ? (
    <div className="p-4 text-center text-sm text-slate-600">
      {t("load_error")}{" "}
      <Button variant="link" onClick={() => inbox.refetch()}>{t("retry")}</Button>
    </div>
  ) : inbox.data.items.length === 0 ? (
    <p className="p-6 text-center text-sm text-slate-500">{t("admin_chat_empty")}</p>
  ) : (
    <ul className="divide-y">
      {inbox.data.items.map((c) => (
        <li key={c.userId}>
          <button
            data-testid="admin-chat-item"
            onClick={() => setSelected({ userId: c.userId, title: c.fullName ?? c.username })}
            className={cn(
              "flex min-h-14 w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50",
              selected?.userId === c.userId && "bg-primary/[0.06]"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-sm", c.unread > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>
                  {c.fullName ?? c.username}
                  {c.fullName && <span className="ml-1 font-normal text-slate-500">{c.username}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{chatTime(c.lastMessageAt)}</span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-sm text-slate-500">
                  {c.lastFromAdmin ? `${t("chat_you")} ` : ""}
                  {c.preview}
                </span>
                {c.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold leading-5 text-amber-800">{c.unread}</span>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
      {inbox.data.hasMore && (
        <li className="p-3 text-center">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setLimit((n) => n + CHAT_INBOX_PAGE)}>
            {t("admin_feedback_more")}
          </Button>
        </li>
      )}
    </ul>
  )

  return (
    <div className="space-y-4">
      <PageHeader title={t("admin_chat")} />
      {/* Chiều cao cố định để 2 cột cuộn riêng; trừ header 56/64px, tiêu đề trang và tab bar mobile. */}
      <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] overflow-hidden rounded-xl border bg-white md:h-[calc(100dvh-11rem)]">
        <div className={cn("w-full overflow-y-auto md:block md:w-80 md:shrink-0 md:border-r", selected && "hidden")}>{list}</div>
        <div className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
          {selected ? (
            <AdminChatThread key={selected.userId} userId={selected.userId} title={selected.title} onBack={() => setSelected(null)} />
          ) : (
            <p className="m-auto p-6 text-center text-sm text-slate-500">{t("admin_chat_pick")}</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

  - Test "Chọn một cuộc trò chuyện để xem." chạy trong jsdom nên phần tử `hidden md:flex` vẫn có trong DOM; giữ nguyên.
  - Mốc chiều cao `13rem` / `11rem` là ước lượng; chỉnh theo ảnh e2e Task 7 sao cho ô nhập không bị tab bar mobile che và không có thanh cuộn thứ hai ở `<main>`. Ghi Ruling nếu đổi.

- [ ] **Step 5: Cài đặt `AdminChatThread`** — tạo `src/components/admin/AdminChatThread.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { SKIP_GLOBAL_INVALIDATE } from "@/components/providers/TRPCProvider"
import { ChatComposer } from "@/components/chat/ChatComposer"
import { ChatMessageList } from "@/components/chat/ChatMessageList"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS } from "@/lib/chat"

export function AdminChatThread({ userId, title, onBack }: { userId: number; title: string; onBack: () => void }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const query = trpc.admin.chatMessages.useInfiniteQuery(
    { userId },
    { getNextPageParam: (last) => last.nextCursor ?? undefined, refetchInterval: CHAT_POLL_MS.thread }
  )
  const refreshLists = () => Promise.all([utils.admin.chatInbox.invalidate(), utils.admin.chatUnread.invalidate()])
  const send = trpc.admin.chatSend.useMutation({
    meta: SKIP_GLOBAL_INVALIDATE,
    onSuccess: () => Promise.all([utils.admin.chatMessages.invalidate({ userId }), refreshLists()]),
    onError: () => toast.error(t("chat_send_error")),
  })
  const { mutate: markRead } = trpc.admin.chatMarkRead.useMutation({ meta: SKIP_GLOBAL_INVALIDATE, onSuccess: refreshLists })

  const pages = query.data?.pages ?? []
  const items = [...pages].reverse().flatMap((p) => p.items)
  const newestTeacherId = items.reduce((max, m) => (!m.fromAdmin && m.id > max ? m.id : max), 0)
  const markedUpTo = useRef(0)

  useEffect(() => {
    if (newestTeacherId > markedUpTo.current) {
      markedUpTo.current = newestTeacherId
      markRead({ userId })
    }
  }, [newestTeacherId, markRead, userId])

  return (
    <>
      <div className="flex min-h-14 items-center gap-2 border-b px-2">
        <Button variant="ghost" size="icon" className="size-11 md:hidden" onClick={onBack} aria-label={t("admin_chat_back")}>
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="truncate px-1 text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {query.isPending ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <ChatMessageList
          items={items}
          viewer="admin"
          otherReadAt={pages[0]?.otherReadAt ?? null}
          hasOlder={query.hasNextPage}
          loadingOlder={query.isFetchingNextPage}
          onLoadOlder={() => query.fetchNextPage()}
          emptyText={t("admin_chat_empty")}
        />
      )}
      <ChatComposer pending={send.isPending} onSend={(body) => send.mutateAsync({ userId, body })} />
    </>
  )
}
```

  - `ChatComposer` có `pb-[…safe-area…]`; trong khu admin mobile, tab bar cố định che đáy, nên khung `AdminChat` đã trừ chiều cao tab bar ở Step 4.

- [ ] **Step 6: Trang** — tạo `src/app/(admin)/admin/chat/page.tsx`:

```tsx
import { AdminChat } from "@/components/admin/AdminChat"

export default function AdminChatPage() {
  return <AdminChat />
}
```

- [ ] **Step 7: Chạy** `pnpm test tests/unit/components/AdminNav.test.tsx tests/unit/components/AdminChat.test.tsx tests/unit/next15-contract.test.ts`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(admin\)/admin/chat src/components/admin/AdminChat.tsx src/components/admin/AdminChatThread.tsx src/components/admin/admin-nav.ts src/components/admin/AdminSidebar.tsx src/components/admin/AdminTabBar.tsx tests/unit/components/AdminNav.test.tsx tests/unit/components/AdminChat.test.tsx
git commit -m "feat: trang tin nhan admin va badge chua doc"
```

---

### Task 7: e2e + RELEASES 0.14.0

**Files:**
- Create: `tests/e2e/ac-chat-ho-tro.spec.ts`
- Modify: `src/lib/releases.ts`, `package.json` (version `0.14.0`)
- Test: e2e trên, `tests/unit/lib/releases.test.ts` (sẵn có)

- [ ] **Step 1: e2e** — tạo `tests/e2e/ac-chat-ho-tro.spec.ts`. Chép hàm `loginAs` từ `tests/e2e/ab-form-gop-y.spec.ts` (giữ nguyên style ẩn `nextjs-portal`). Dọn tin trước test bằng `PrismaClient` như file AB (chỉ chạy khi `DATABASE_URL` là DB test, dùng đúng cách file AB đang kiểm).

```ts
test('giáo viên nhắn, admin thấy badge và trả lời, giáo viên thấy tin Hỗ trợ', async ({ browser }) => {
  test.setTimeout(90_000);
  const tag = `AC${Date.now()}`;

  const teacher = await loginAs(browser, 'teacher'); // mobile 390x844
  await teacher.getByRole('button', { name: /^Nhắn hỗ trợ/ }).click();
  await teacher.getByLabel('Nội dung tin nhắn').fill(`${tag} hỏi cách nhập Excel`);
  await teacher.keyboard.press('Enter');
  await expect(teacher.getByTestId('chat-message').filter({ hasText: `${tag} hỏi cách nhập Excel` })).toBeVisible();
  await teacher.keyboard.press('Escape');

  const admin = await loginAs(browser, 'admin_test', { width: 1280, height: 900 });
  await expect(admin.getByTestId('admin-chat-unread').first()).toHaveText('1', { timeout: 35_000 });
  await admin.goto('/admin/chat');
  await admin.getByTestId('admin-chat-item').filter({ hasText: 'teacher' }).first().click();
  await expect(admin.getByText(`${tag} hỏi cách nhập Excel`)).toBeVisible();
  await expect(admin.getByTestId('admin-chat-unread')).toHaveCount(0, { timeout: 15_000 });
  await admin.getByLabel('Nội dung tin nhắn').fill(`${tag} vào Học sinh, chọn Nhập Excel`);
  await admin.getByRole('button', { name: 'Gửi' }).click();

  // Badge giáo viên polling 60 giây: tải lại trang để không phải chờ.
  await teacher.reload();
  await expect(teacher.getByTestId('chat-unread')).toHaveText('1');
  await teacher.getByRole('button', { name: /^Nhắn hỗ trợ/ }).click();
  const reply = teacher.getByTestId('chat-message').filter({ hasText: `${tag} vào Học sinh` });
  await expect(reply).toHaveAttribute('data-mine', 'false');
  await expect(reply.getByText('Hỗ trợ')).toBeVisible();
  await expect(reply.getByText('admin_test')).toHaveCount(0);
  await expect(teacher.getByTestId('chat-unread')).toHaveCount(0, { timeout: 10_000 });
});

test('header giáo viên 375px không tràn ngang', async ({ browser }) => {
  const page = await loginAs(browser, 'teacher', { width: 375, height: 812 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.getByRole('button', { name: /^Nhắn hỗ trợ/ }).boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
});

test('mở khung chat không làm các query khác tải lại liên tục', async ({ browser }) => {
  const page = await loginAs(browser, 'teacher');
  await page.getByRole('button', { name: /^Nhắn hỗ trợ/ }).click();
  const others: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/trpc/') && !/\/api\/trpc\/chat\./.test(u)) others.push(u);
  });
  await page.getByLabel('Nội dung tin nhắn').fill('kiểm tra invalidate');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(12_000);
  expect(others).toEqual([]);
});
```

  - Batch link gộp nhiều thủ tục vào 1 URL (`chat.messages,chat.unread`). Regex `\/api\/trpc\/chat\.` chỉ kiểm thủ tục đầu; nếu URL gộp có thủ tục ngoài `chat.*`, tách tên bằng `decodeURIComponent(u.split('/api/trpc/')[1].split('?')[0]).split(',')` rồi lọc từng tên. Ghi Ruling nếu sửa.
  - Chạy e2e chia 2 nửa theo LENH.md: `pnpm exec playwright test tests/e2e/ac-chat-ho-tro.spec.ts`. Expected: PASS 3 test.

- [ ] **Step 2: RELEASES + version.** `package.json` → `"version": "0.14.0"`. Thêm vào đầu `RELEASES` trong `src/lib/releases.ts`:

```ts
  {
    version: "0.14.0",
    date: "2026-10-07",
    title: "Nhắn tin với hỗ trợ",
    summary: "Bấm nút tin nhắn trên thanh trên cùng để hỏi cách dùng, báo lỗi hay góp ý. Admin trả lời ngay trong app.",
    notify: true,
    items: [
      { kind: "new", title: "Nhắn tin với hỗ trợ", body: "Nút tin nhắn có số tin chưa đọc. Mở ra để xem trả lời và gửi tiếp, không cần chuyển sang Zalo." },
    ],
  },
```

  - Chạy `pnpm test tests/unit/lib/releases.test.ts`. Expected: PASS.

- [ ] **Step 3: Kiểm toàn bộ.** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (toàn bộ, 1 lượt), kiểm build bằng `pnpm exec next build` với URL `.env.test`. Expected: sạch hết.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/ac-chat-ho-tro.spec.ts src/lib/releases.ts package.json
git commit -m "test: e2e chat ho tro, phat hanh 0.14.0"
```

- [ ] **Step 5: Bàn giao.** Ghi `bao-cao-AC.md` + dòng `DONE AC` vào kênh (nhánh, SHA đầu nhánh, kết quả test, các Ruling).

---

## PHẦN 2 — Pusher Channels (0.14.1)

> Chỉ bắt đầu khi phần 1 đã merge vào `main` **và** có dòng `CLAUDE → GEHIHI: GO AC2` trong kênh.

### Task 8: Server phát sự kiện (`src/server/realtime.ts`)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (thêm `pusher`, `pusher-js`)
- Create: `src/server/realtime.ts`
- Modify: `src/server/trpc/routers/chat.ts`, `src/server/trpc/routers/admin.ts`, `.env.example`
- Test: `tests/unit/server/realtime.test.ts`

**Interfaces:**
- Produces:
  - `publishChat(userId: number, messageId: number): Promise<void>`;
  - `canSubscribe(user: { id: string; username: string }, channel: string): boolean`;
  - `authorizeChatChannel(socketId: string, channel: string): { auth: string } | null` (null khi realtime tắt);
  - `resetRealtimeForTest(): void`.

- [ ] **Step 1: Thêm gói.** `pnpm add pusher pusher-js`. Kiểm `pnpm-lock.yaml` chỉ thêm 2 gói này và phụ thuộc của chúng.

- [ ] **Step 2: Test (đỏ)** — tạo `tests/unit/server/realtime.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const trigger = vi.fn()
const authorizeChannel = vi.fn(() => ({ auth: "key:sig" }))
const ctor = vi.fn()
vi.mock("pusher", () => ({
  default: class {
    constructor(opts: unknown) { ctor(opts) }
    trigger = trigger
    authorizeChannel = authorizeChannel
  },
}))

import { publishChat, canSubscribe, authorizeChatChannel, resetRealtimeForTest } from "@/server/realtime"

const ENV = { PUSHER_APP_ID: "1", PUSHER_SECRET: "s", NEXT_PUBLIC_PUSHER_KEY: "k", NEXT_PUBLIC_PUSHER_CLUSTER: "ap1" }

beforeEach(() => {
  trigger.mockReset().mockResolvedValue({})
  ctor.mockReset()
  resetRealtimeForTest()
  process.env.ADMIN_USERNAMES = "admin_test"
})
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k]
  delete process.env.ADMIN_USERNAMES
})

describe("publishChat (spec AC §6.2)", () => {
  it("thiếu env thì không tạo client, không gọi", async () => {
    await publishChat(5, 9)
    expect(ctor).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it("đủ env: gửi 1 lần tới kênh giáo viên + kênh admin, payload chỉ có id", async () => {
    Object.assign(process.env, ENV)
    await publishChat(5, 9)
    expect(ctor).toHaveBeenCalledWith({ appId: "1", key: "k", secret: "s", cluster: "ap1", useTLS: true })
    expect(trigger).toHaveBeenCalledWith(["private-chat-user-5", "private-chat-admins"], "chat:new", { userId: 5, messageId: 9 })
  })

  it("Pusher lỗi thì chỉ ghi log, không ném", async () => {
    Object.assign(process.env, ENV)
    trigger.mockRejectedValue(new Error("quota"))
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(publishChat(5, 9)).resolves.toBeUndefined()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})

describe("canSubscribe", () => {
  it("giáo viên chỉ vào kênh của mình", () => {
    expect(canSubscribe({ id: "5", username: "teacher" }, "private-chat-user-5")).toBe(true)
    expect(canSubscribe({ id: "5", username: "teacher" }, "private-chat-user-6")).toBe(false)
    expect(canSubscribe({ id: "5", username: "teacher" }, "private-chat-admins")).toBe(false)
  })
  it("admin chỉ vào kênh admin", () => {
    expect(canSubscribe({ id: "1", username: "admin_test" }, "private-chat-admins")).toBe(true)
    expect(canSubscribe({ id: "1", username: "admin_test" }, "private-chat-user-5")).toBe(false)
  })
})

describe("authorizeChatChannel", () => {
  it("tắt realtime → null; bật → kết quả của Pusher", () => {
    expect(authorizeChatChannel("1.2", "private-chat-admins")).toBeNull()
    Object.assign(process.env, ENV)
    resetRealtimeForTest()
    expect(authorizeChatChannel("1.2", "private-chat-admins")).toEqual({ auth: "key:sig" })
    expect(authorizeChannel).toHaveBeenCalledWith("1.2", "private-chat-admins")
  })
})
```

- [ ] **Step 3: Cài đặt** — tạo `src/server/realtime.ts`:

```ts
import Pusher from "pusher"
import { isAdminUsername } from "@/lib/admin"
import { ADMIN_CHAT_CHANNEL, CHAT_EVENT, userChatChannel } from "@/lib/chat"

// undefined = chưa đọc env; null = realtime tắt (thiếu env), app chạy bằng polling.
let client: Pusher | null | undefined

function getClient(): Pusher | null {
  if (client !== undefined) return client
  const { PUSHER_APP_ID: appId, PUSHER_SECRET: secret, NEXT_PUBLIC_PUSHER_KEY: key, NEXT_PUBLIC_PUSHER_CLUSTER: cluster } = process.env
  client = appId && secret && key && cluster ? new Pusher({ appId, key, secret, cluster, useTLS: true }) : null
  return client
}

export function resetRealtimeForTest(): void {
  client = undefined
}

// Chỉ gửi id: nội dung tin là dữ liệu cá nhân, không đưa qua bên thứ ba (spec AC §2).
export async function publishChat(userId: number, messageId: number): Promise<void> {
  const c = getClient()
  if (!c) return
  try {
    await c.trigger([userChatChannel(userId), ADMIN_CHAT_CHANNEL], CHAT_EVENT, { userId, messageId })
  } catch (error) {
    console.error("[realtime] Không gửi được sự kiện chat", error)
  }
}

export function canSubscribe(user: { id: string; username: string }, channel: string): boolean {
  if (isAdminUsername(user.username)) return channel === ADMIN_CHAT_CHANNEL
  return channel === userChatChannel(Number(user.id))
}

export function authorizeChatChannel(socketId: string, channel: string): { auth: string } | null {
  const c = getClient()
  return c ? c.authorizeChannel(socketId, channel) : null
}
```

  - Test thứ 2 của `authorizeChatChannel` gọi `resetRealtimeForTest()` sau khi đặt env, vì lần gọi đầu đã cache `null`.

- [ ] **Step 4: Phát sự kiện sau khi lưu.**
  - `routers/chat.ts`, thủ tục `send`:

```ts
  send: teacherProcedure.input(chatSendSchema).mutation(async ({ ctx, input }) => {
    const msg = await sendUserMessage(ctx.db, { id: ctx.userId, username: ctx.session.user.username }, input.body)
    await publishChat(ctx.userId, msg.id)
    return msg
  }),
```

  - `routers/admin.ts`, thủ tục `chatSend`: tương tự với `publishChat(input.userId, msg.id)`.
  - `.env.example` thêm mục:

```
# === CHAT REALTIME (spec AC phần 2, tuỳ chọn) ===
# Thiếu 1 biến là chat tự chạy bằng polling. Cluster ap1 = Singapore, gần Vercel sin1.
PUSHER_APP_ID=""
PUSHER_SECRET=""
NEXT_PUBLIC_PUSHER_KEY=""
NEXT_PUBLIC_PUSHER_CLUSTER="ap1"
```

- [ ] **Step 5: Chạy** `pnpm test tests/unit/server/realtime.test.ts tests/integration/chat.test.ts`. Expected: PASS (integration không có env Pusher nên `publishChat` không làm gì).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/server/realtime.ts src/server/trpc/routers/chat.ts src/server/trpc/routers/admin.ts .env.example tests/unit/server/realtime.test.ts
git commit -m "feat: phat su kien chat qua Pusher"
```

---

### Task 9: Route `POST /api/realtime/auth` + middleware

**Files:**
- Create: `src/app/api/realtime/auth/route.ts`
- Modify: `src/middleware.ts`, `docs/05-deploy.md`
- Test: `tests/integration/realtime-auth-route.test.ts`, `tests/unit/middleware-matcher.test.ts`

- [ ] **Step 0 (chủ app, làm tay trước khi `GO AC2`):** tạo app Pusher Channels, cluster `ap1`; đặt 4 biến env trên Vercel **Production** (Preview không cần). Claude ghi lại các bước này vào `docs/05-deploy.md` ở Step 4.

- [ ] **Step 1: Test (đỏ).**
  - `tests/unit/middleware-matcher.test.ts`, test "giữ các ngoại lệ cũ": thêm `"/api/realtime/auth"` vào danh sách **không** cần đăng nhập ở middleware. Thêm test riêng:

```ts
  it("/api/realtime/auth không qua middleware để admin không bị chuyển hướng (spec AC §6.2)", () => {
    expect(needsAuth("/api/realtime/auth")).toBe(false)
    // Các API khác vẫn qua middleware.
    expect(needsAuth("/api/backup")).toBe(true)
  })
```

  - Tạo `tests/integration/realtime-auth-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/server/db"

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))
const realtime = vi.hoisted(() => ({ enabled: true }))
vi.mock("@/server/realtime", async (orig) => {
  const actual = await orig<typeof import("@/server/realtime")>()
  return {
    ...actual,
    authorizeChatChannel: (socketId: string, channel: string) => (realtime.enabled ? { auth: `k:${socketId}:${channel}` } : null),
  }
})

import { auth } from "@/server/auth"
import { POST } from "@/app/api/realtime/auth/route"

const authMock = auth as unknown as ReturnType<typeof vi.fn>

function req(fields: Record<string, string>) {
  return new Request("http://localhost/api/realtime/auth", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  })
}

describe("POST /api/realtime/auth", () => {
  beforeEach(() => {
    authMock.mockReset()
    realtime.enabled = true
    process.env.ADMIN_USERNAMES = "admin_test"
  })

  it("không có phiên → 401", async () => {
    authMock.mockResolvedValue(null)
    expect((await POST(req({ socket_id: "1.2", channel_name: "private-chat-admins" }))).status).toBe(401)
  })

  it("đang bị bắt đổi mật khẩu → 403", async () => {
    authMock.mockResolvedValue({ user: { id: "5", username: "teacher", mustChangePassword: true } })
    expect((await POST(req({ socket_id: "1.2", channel_name: "private-chat-user-5" }))).status).toBe(403)
  })

  it("thiếu trường → 400", async () => {
    authMock.mockResolvedValue({ user: { id: "5", username: "teacher" } })
    expect((await POST(req({ socket_id: "1.2" }))).status).toBe(400)
  })

  it("giáo viên xin kênh người khác hoặc kênh admin → 403", async () => {
    const t = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    authMock.mockResolvedValue({ user: { id: String(t.id), username: "teacher" } })
    expect((await POST(req({ socket_id: "1.2", channel_name: `private-chat-user-${t.id + 1}` }))).status).toBe(403)
    expect((await POST(req({ socket_id: "1.2", channel_name: "private-chat-admins" }))).status).toBe(403)
  })

  it("hợp lệ → 200 JSON auth; realtime tắt → 503", async () => {
    const t = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    authMock.mockResolvedValue({ user: { id: String(t.id), username: "teacher" } })
    const ok = await POST(req({ socket_id: "1.2", channel_name: `private-chat-user-${t.id}` }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ auth: `k:1.2:private-chat-user-${t.id}` })
    realtime.enabled = false
    expect((await POST(req({ socket_id: "1.2", channel_name: `private-chat-user-${t.id}` }))).status).toBe(503)
  })

  it("admin xin kênh admin → 200", async () => {
    authMock.mockResolvedValue({ user: { id: "1", username: "admin_test" } })
    expect((await POST(req({ socket_id: "1.2", channel_name: "private-chat-admins" }))).status).toBe(200)
  })
})
```

- [ ] **Step 2: Chạy** `pnpm test tests/integration/realtime-auth-route.test.ts tests/unit/middleware-matcher.test.ts`. Expected: FAIL.

- [ ] **Step 3: Cài đặt.**
  - Tạo `src/app/api/realtime/auth/route.ts`:

```ts
import { auth } from "@/server/auth"
import { authorizeChatChannel, canSubscribe } from "@/server/realtime"

export const dynamic = "force-dynamic"

// pusher-js gửi form socket_id + channel_name. Không qua middleware (admin sẽ bị chuyển hướng) nên tự kiểm phiên.
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return new Response(null, { status: 401 })
  if (session.user.mustChangePassword === true) return new Response(null, { status: 403 })

  const form = await request.formData().catch(() => null)
  const socketId = form?.get("socket_id")
  const channel = form?.get("channel_name")
  if (typeof socketId !== "string" || typeof channel !== "string") return new Response(null, { status: 400 })
  if (!canSubscribe(session.user, channel)) return new Response(null, { status: 403 })

  try {
    const result = authorizeChatChannel(socketId, channel)
    return result ? Response.json(result) : new Response(null, { status: 503 })
  } catch {
    // Pusher ném khi socket_id sai định dạng.
    return new Response(null, { status: 400 })
  }
}
```

  - `src/middleware.ts`: matcher thêm `api/realtime` (cạnh `api/trpc`):

```ts
    "/((?!login|register|privacy|guide|updates|p/|api/auth|api/trpc|api/realtime|_next/static|_next/image|favicon.ico).*)",
```

  - Lookahead khớp theo tiền tố như `api/trpc` đang làm: mọi đường dẫn bắt đầu bằng `/api/realtime` đều bỏ qua middleware. Chỉ có 1 route này nên chấp nhận.

- [ ] **Step 4: Tài liệu.** `docs/05-deploy.md` thêm mục "Chat realtime (Pusher)": tạo app Channels, chọn cluster `ap1`, lấy App ID / Key / Secret, đặt 4 biến trên Vercel Production, redeploy; kiểm bằng cách mở `/admin/chat` và xem tab Network có kết nối `wss://ws-ap1.pusher.com`. Ghi rõ: xoá biến là tắt realtime, chat vẫn chạy bằng polling.

- [ ] **Step 5: Chạy lại** test Step 2. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/realtime src/middleware.ts docs/05-deploy.md tests/integration/realtime-auth-route.test.ts tests/unit/middleware-matcher.test.ts
git commit -m "feat: route xac thuc kenh Pusher"
```

---

### Task 10: Client nối Pusher, đổi chu kỳ polling, RELEASES 0.14.1

**Files:**
- Create: `src/lib/realtime-client.ts`, `src/hooks/useChatRealtime.ts`, `src/components/chat/AdminChatLive.tsx`
- Modify: `src/components/chat/ChatSheet.tsx`, `src/components/admin/AdminLayout.tsx`, `src/components/admin/AdminChat.tsx`, `src/components/admin/AdminChatThread.tsx`, `src/lib/releases.ts`, `package.json`
- Test: `tests/unit/hooks/useChatRealtime.test.tsx`

**Interfaces:**
- Produces:
  - `getPusher(): Promise<PusherClient | null>`;
  - `useChatRealtime(channel: string | null, onEvent: (e: { userId: number; messageId: number }) => void): boolean` (true khi đang nối và đã vào kênh);
  - `AdminChatLiveProvider({ children })`, `useAdminChatLive(): boolean`.

- [ ] **Step 1: Client Pusher** — tạo `src/lib/realtime-client.ts`:

```ts
import type PusherClient from "pusher-js"

let instance: Promise<PusherClient | null> | null = null

// Tải pusher-js động: không có env thì không tải gói, không mở kết nối.
export function getPusher(): Promise<PusherClient | null> {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  if (!key || !cluster) return Promise.resolve(null)
  instance ??= import("pusher-js").then(
    ({ default: Pusher }) => new Pusher(key, { cluster, channelAuthorization: { endpoint: "/api/realtime/auth", transport: "ajax" } })
  )
  return instance
}
```

- [ ] **Step 2: Test hook (đỏ)** — tạo `tests/unit/hooks/useChatRealtime.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

type Handler = (data?: unknown) => void
const channelHandlers = new Map<string, Handler>()
const connHandlers = new Map<string, Handler>()
const fake = {
  connection: {
    state: "connected",
    bind: (e: string, h: Handler) => connHandlers.set(e, h),
    unbind: (e: string) => connHandlers.delete(e),
  },
  subscribe: vi.fn(() => ({
    bind: (e: string, h: Handler) => channelHandlers.set(e, h),
    unbind: (e: string) => channelHandlers.delete(e),
  })),
  unsubscribe: vi.fn(),
}
const pusher = vi.hoisted(() => ({ value: null as unknown }))
vi.mock("@/lib/realtime-client", () => ({ getPusher: () => Promise.resolve(pusher.value) }))

import { useChatRealtime } from "@/hooks/useChatRealtime"

beforeEach(() => {
  channelHandlers.clear()
  connHandlers.clear()
  fake.subscribe.mockClear()
  fake.unsubscribe.mockClear()
  pusher.value = fake
})

describe("useChatRealtime", () => {
  it("không có Pusher (thiếu env) → luôn false", async () => {
    pusher.value = null
    const { result } = renderHook(() => useChatRealtime("private-chat-user-5", vi.fn()))
    await Promise.resolve()
    expect(result.current).toBe(false)
  })

  it("channel null thì không subscribe", async () => {
    renderHook(() => useChatRealtime(null, vi.fn()))
    await Promise.resolve()
    expect(fake.subscribe).not.toHaveBeenCalled()
  })

  it("vào kênh thành công → true; nhận chat:new gọi onEvent; mất kết nối → false; unmount thì unsubscribe", async () => {
    const onEvent = vi.fn()
    const { result, unmount } = renderHook(() => useChatRealtime("private-chat-user-5", onEvent))
    await waitFor(() => expect(fake.subscribe).toHaveBeenCalledWith("private-chat-user-5"))
    act(() => channelHandlers.get("pusher:subscription_succeeded")!())
    expect(result.current).toBe(true)
    act(() => channelHandlers.get("chat:new")!({ userId: 5, messageId: 9 }))
    expect(onEvent).toHaveBeenCalledWith({ userId: 5, messageId: 9 })
    act(() => connHandlers.get("state_change")!({ previous: "connected", current: "unavailable" }))
    expect(result.current).toBe(false)
    unmount()
    expect(fake.unsubscribe).toHaveBeenCalledWith("private-chat-user-5")
  })
})
```

- [ ] **Step 3: Hook** — tạo `src/hooks/useChatRealtime.ts`:

```ts
"use client"

import { useEffect, useRef, useState } from "react"
import { getPusher } from "@/lib/realtime-client"
import { CHAT_EVENT } from "@/lib/chat"

export type ChatEvent = { userId: number; messageId: number }

// true = đang nối và đã vào kênh; nơi gọi dùng để giãn polling (spec AC §6.2).
export function useChatRealtime(channel: string | null, onEvent: (e: ChatEvent) => void): boolean {
  const [live, setLive] = useState(false)
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!channel) return
    let cancelled = false
    let cleanup = () => {}
    void getPusher().then((p) => {
      if (!p || cancelled) return
      let subscribed = false
      const ch = p.subscribe(channel)
      const onMessage = (data: ChatEvent) => handler.current(data)
      const onOk = () => {
        subscribed = true
        setLive(p.connection.state === "connected")
      }
      const onFail = () => setLive(false)
      const onState = ({ current }: { current: string }) => setLive(current === "connected" && subscribed)
      ch.bind(CHAT_EVENT, onMessage)
      ch.bind("pusher:subscription_succeeded", onOk)
      ch.bind("pusher:subscription_error", onFail)
      p.connection.bind("state_change", onState)
      cleanup = () => {
        ch.unbind(CHAT_EVENT, onMessage)
        ch.unbind("pusher:subscription_succeeded", onOk)
        ch.unbind("pusher:subscription_error", onFail)
        p.connection.unbind("state_change", onState)
        p.unsubscribe(channel)
      }
    })
    return () => {
      cancelled = true
      cleanup()
      setLive(false)
    }
  }, [channel])

  return live
}
```

  - Chạy `pnpm test tests/unit/hooks/useChatRealtime.test.tsx`. Expected: PASS.

- [ ] **Step 4: Nối vào giáo viên.** Trong `ChatSheet.tsx`:
  - lấy `const { data: session } = useSession()` (`next-auth/react`), `const channel = session?.user?.id ? userChatChannel(Number(session.user.id)) : null`;
  - `const live = useChatRealtime(channel, () => { void utils.chat.messages.invalidate() })`;
  - `refetchInterval: live ? CHAT_POLL_MS.live : CHAT_POLL_MS.thread`.
  - Badge `ChatButton` giữ 60 giây (giáo viên chỉ nối khi khung mở, spec §6.2).

- [ ] **Step 5: Nối vào admin.** Tạo `src/components/chat/AdminChatLive.tsx`:

```tsx
"use client"

import { createContext, useContext } from "react"
import { trpc } from "@/lib/trpc"
import { ADMIN_CHAT_CHANNEL } from "@/lib/chat"
import { useChatRealtime } from "@/hooks/useChatRealtime"

const LiveContext = createContext(false)

// Admin giữ 1 kết nối suốt khu /admin; mỗi tin mới làm mới badge, hộp thư và đúng cuộc trò chuyện.
export function AdminChatLiveProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils()
  const live = useChatRealtime(ADMIN_CHAT_CHANNEL, ({ userId }) => {
    void utils.admin.chatUnread.invalidate()
    void utils.admin.chatInbox.invalidate()
    void utils.admin.chatMessages.invalidate({ userId })
  })
  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>
}

export function useAdminChatLive(): boolean {
  return useContext(LiveContext)
}
```

  - `AdminLayout.tsx`: bọc nội dung bằng `<AdminChatLiveProvider>`.
  - `AdminChat.tsx`: `refetchInterval: live ? CHAT_POLL_MS.live : CHAT_POLL_MS.inbox` với `const live = useAdminChatLive()`.
  - `AdminChatThread.tsx`: `refetchInterval: live ? CHAT_POLL_MS.live : CHAT_POLL_MS.thread`.
  - `AdminSidebar` / `AdminTabBar`: `refetchInterval: live ? CHAT_POLL_MS.live * 2 : CHAT_POLL_MS.adminUnread`.
  - Test sẵn có của các component admin render ngoài provider → `useAdminChatLive()` trả `false` mặc định, không cần mock. Test nào mock `@/lib/trpc` mà render `AdminLayout` thì thêm `useUtils` vào mock.

- [ ] **Step 6: RELEASES + version.** `package.json` → `0.14.1`. Thêm đầu `RELEASES`:

```ts
  {
    version: "0.14.1",
    date: "2026-10-07",
    title: "Tin nhắn hỗ trợ đến ngay",
    summary: "Khi đang mở khung tin nhắn, trả lời của admin hiện ra ngay, không phải chờ.",
    notify: false,
    items: [
      { kind: "improve", title: "Tin nhắn đến tức thì", body: "Trả lời của admin hiện ngay khi khung tin nhắn đang mở." },
    ],
  },
```

- [ ] **Step 7: Kiểm toàn bộ.** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm exec next build` (URL `.env.test`), chạy lại `tests/e2e/ac-chat-ho-tro.spec.ts`. Không có env Pusher nên e2e đi đường polling như phần 1. Expected: xanh hết.

- [ ] **Step 8: Commit + bàn giao**

```bash
git add src/lib/realtime-client.ts src/hooks/useChatRealtime.ts src/components/chat src/components/admin/AdminLayout.tsx src/components/admin/AdminChat.tsx src/components/admin/AdminChatThread.tsx src/components/admin/AdminSidebar.tsx src/components/admin/AdminTabBar.tsx src/lib/releases.ts package.json tests/unit/hooks/useChatRealtime.test.tsx
git commit -m "feat: chat realtime qua Pusher, phat hanh 0.14.1"
```

  - Ghi `bao-cao-AC2.md` + `DONE AC2` vào kênh.
  - **Kiểm thật sau merge (Claude / chủ app, không phải Gehihi):** trên production mở 2 trình duyệt (giáo viên mobile, admin desktop), gửi qua lại; tin phải hiện < 2 giây; tab Network có WebSocket `ws-ap1.pusher.com`; payload sự kiện trong khung WS chỉ có `userId`, `messageId`.
