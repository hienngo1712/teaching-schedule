# AC — Nhắn tin hỗ trợ giữa giáo viên và admin

> Ngày: 2026-10-07 · Người yêu cầu: chủ ứng dụng · Phiên bản: **0.14.0** (phần 1, minor, **có migration**: 2 bảng mới) và **0.14.1** (phần 2, patch, không migration).
> Hướng đã chọn: DB (Neon) là nơi lưu tin duy nhất, gửi và đọc qua tRPC. Phần 1 cập nhật bằng **polling**. Phần 2 thêm **Pusher Channels** để báo "có tin mới" tức thì, polling giữ làm dự phòng.

## 1. Mục tiêu

- Giáo viên hỏi cách dùng, báo lỗi, hỏi về đơn gói ngay trong app, không phải chuyển sang Zalo.
- Admin thấy mọi cuộc trò chuyện ở một chỗ, trả lời, biết tin nào chưa đọc.
- Không dựng server riêng. Chạy được trên Vercel Hobby (serverless) + Neon như hiện tại.

## 2. Vì sao chọn cách này

| Cách | Lý do bỏ / chọn |
|---|---|
| WebSocket tự dựng trong Next.js | Vercel serverless không giữ được kết nối WebSocket; mỗi request có thể chạy ở instance khác nhau. **Bỏ.** |
| SSE / tRPC subscription trên Vercel | Mỗi kết nối giữ 1 function chạy suốt (Hobby có giới hạn thời gian), vẫn cần kênh phát tin chung giữa các instance (Postgres `LISTEN/NOTIFY` cần kết nối DB riêng mỗi người). **Bỏ.** |
| Server Socket.IO riêng (Fly, Railway) | Thêm 1 server phải tự vận hành, tự kiểm JWT, tự nối DB. Quá sức so với nhu cầu. **Bỏ.** |
| Chỉ polling | Không cần dịch vụ ngoài, làm được ngay. Trễ vài giây, tốn truy vấn DB. **Phần 1.** |
| Dịch vụ realtime có sẵn (Pusher) | Server chỉ gọi HTTP `trigger`; trình duyệt nối WebSocket thẳng tới Pusher, Vercel không phải giữ kết nối. Có cụm `ap1` (Singapore) gần Vercel `sin1`. Gói Sandbox miễn phí đủ cho quy mô app (lúc viết: 200 kết nối đồng thời, 200k tin/ngày; kiểm lại khi đăng ký). **Phần 2.** |

Nguyên tắc: **Pusher chỉ mang tín hiệu `{ userId, messageId }`, không mang nội dung tin.** Nội dung là dữ liệu cá nhân, chỉ nằm trong DB (đã mã hoá). Pusher hỏng hoặc hết hạn mức thì chat vẫn chạy bằng polling.

## 3. Phạm vi người dùng

- **Một cuộc trò chuyện cho mỗi giáo viên**, nói chuyện với "đội hỗ trợ". Admin nào trong `ADMIN_USERNAMES` cũng đọc và trả lời được.
- Giáo viên **không thấy username admin** (chỉ thấy nhãn "Hỗ trợ"), tránh lộ tên đăng nhập admin.
- Admin thấy tin nào do admin nào gửi (username lúc gửi).
- Tài khoản admin không có khung chat giáo viên (admin bị chuyển về `/admin` như hiện tại).
- Tài khoản đã xoá mềm (`users.is_deleted`) không hiện trong hộp thư admin; admin không gửi được tới tài khoản đó.

## 4. Dữ liệu (migration, chỉ thêm)

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

- `User` thêm quan hệ `chatConversation ChatConversation?`.
- **Mã hoá:** thêm `ChatMessage: ["body"]` vào `ENCRYPTED_FIELDS` (`src/server/crypto/prisma-encryption.ts`). `body` là `TEXT` nên qua test DMMF. Không lọc, không sắp theo `body`.
- `fromAdmin` lưu cứng lúc gửi, không suy ra từ `ADMIN_USERNAMES` lúc đọc.
- Bộ đếm:
  - giáo viên gửi → `adminUnreadCount + 1`;
  - admin gửi → `userUnreadCount + 1`, đồng thời `adminUnreadCount = 0`, `adminReadAt = now` (đã trả lời tức là đã đọc);
  - giáo viên mở khung chat → `userUnreadCount = 0`, `userReadAt = now`;
  - admin mở cuộc trò chuyện → `adminUnreadCount = 0`, `adminReadAt = now`.
- Tin đầu tiên tạo cuộc trò chuyện bằng `upsert` theo `userId` (Prisma 5 chạy `ON CONFLICT` nên 2 tin đầu gửi cùng lúc không lỗi trùng khoá).

## 5. API

### 5.1 Ràng buộc chung
- Nội dung: `z.string().trim().min(1).max(2000)` (`CHAT_BODY_MAX = 2000`). Rỗng sau khi trim → BAD_REQUEST.
- **Giới hạn gửi của giáo viên: 30 tin / 10 phút.** Quá thì TOO_MANY_REQUESTS, message `CHAT_LIMIT`. Admin không giới hạn.
- Phân trang tin: 30 tin mỗi trang, theo `id` giảm dần (`cursor` = id tin cũ nhất đã có). Trả về trong trang theo thứ tự **cũ → mới**.
- Tin trả cho giáo viên có `senderName: null`.
- `teacherProcedure` (đang khai báo riêng trong `routers/feedback.ts`) chuyển vào `src/server/trpc/index.ts` để `feedback` và `chat` dùng chung.
- Mutation của chat **không làm mới toàn bộ query**: `TRPCProvider` bỏ qua `invalidateQueries()` khi `mutation.meta.skipGlobalInvalidate === true`. Chat tự làm mới query của mình.

### 5.2 Router `chat` (chỉ giáo viên, admin bị FORBIDDEN)
- `chat.unread() → { count }`: số tin admin gửi mà giáo viên chưa đọc. Chưa có cuộc trò chuyện → 0.
- `chat.messages({ cursor? }) → { items, nextCursor, otherReadAt }`. `otherReadAt` = `adminReadAt`. Chưa có cuộc trò chuyện → `{ items: [], nextCursor: null, otherReadAt: null }`.
- `chat.send({ body }) → ChatMessageDto`.
- `chat.markRead() → { ok: true }`.

### 5.3 Thêm vào router `admin` (`adminProcedure`)
- `admin.chatUnread() → { conversations }`: số cuộc trò chuyện có `adminUnreadCount > 0` của tài khoản chưa xoá.
- `admin.chatInbox({ limit = 30, tối đa 200 }) → { items, hasMore }`. Sắp `lastMessageAt` giảm dần. Mỗi dòng gồm `userId`, `username`, `fullName`, `lastMessageAt`, `unread` (= `adminUnreadCount`), `preview` (tin cuối, gộp khoảng trắng, tối đa 60 ký tự, quá thì cắt và thêm `…`), `lastFromAdmin`.
- `admin.chatMessages({ userId, cursor? }) → { items, nextCursor, otherReadAt }`. `otherReadAt` = `userReadAt`. `senderName` có giá trị.
- `admin.chatSend({ userId, body }) → ChatMessageDto`. Người nhận không tồn tại, đã xoá mềm hoặc là admin → NOT_FOUND. Chưa có cuộc trò chuyện thì tạo (admin chủ động nhắn được về sau, xem §9).
- `admin.chatMarkRead({ userId }) → { ok: true }`.

## 6. Cập nhật tin mới

### 6.1 Phần 1: polling (chỉ khi tab đang hiện, mặc định của React Query)
| Ở đâu | Query | Chu kỳ |
|---|---|---|
| Giáo viên, nút chat trên header | `chat.unread` | 60 giây |
| Giáo viên, khung chat đang mở | `chat.messages` | 5 giây |
| Admin, badge ở sidebar và tab bar | `admin.chatUnread` | 30 giây |
| Admin, trang `/admin/chat` | `admin.chatInbox` | 10 giây |
| Admin, cuộc trò chuyện đang mở | `admin.chatMessages` | 5 giây |

Không polling khi khung chat đóng (trừ badge). Mỗi lượt polling đi qua `auth()` (1 truy vấn đọc user) + 1 truy vấn nhẹ; chấp nhận được với số người dùng hiện tại. Phần 2 giảm chu kỳ nhanh xuống 30 giây.

### 6.2 Phần 2: Pusher Channels
- Env: `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` (= `ap1`). Thiếu bất kỳ biến nào thì realtime tắt im lặng, app chạy như phần 1. Test và local không cần Pusher.
- Kênh private:
  - `private-chat-user-<userId>`: chỉ chính giáo viên đó được vào;
  - `private-chat-admins`: chỉ admin được vào.
- Sự kiện `chat:new`, dữ liệu `{ userId, messageId }`. Gửi tới **cả 2 kênh** sau khi lưu tin thành công (giáo viên gửi hay admin gửi đều vậy). Lỗi gọi Pusher chỉ ghi log, **không làm hỏng việc gửi tin**.
- Route `POST /api/realtime/auth` (form `socket_id`, `channel_name` do pusher-js gửi):
  - không có phiên → 401; đang bị bắt đổi mật khẩu → 403;
  - thiếu trường → 400; kênh không được phép → 403; realtime tắt → 503;
  - hợp lệ → JSON của `pusher.authorizeChannel`.
- `src/middleware.ts`: thêm `api/realtime` vào danh sách loại trừ của matcher. Nếu không, admin gọi route này sẽ bị chuyển hướng về `/admin/overview`. Route tự kiểm phiên như `api/backup`.
- **Ai giữ kết nối:**
  - giáo viên **chỉ khi khung chat đang mở** (badge vẫn polling 60 giây) → số kết nối đồng thời nhỏ;
  - admin giữ 1 kết nối trong suốt khu `/admin`.
- Đang kết nối được thì polling nhanh (5 và 10 giây) đổi thành 30 giây làm lưới an toàn. Mất kết nối thì tự quay lại chu kỳ phần 1.
- Nhận `chat:new` → invalidate đúng query liên quan (`chat.messages` / `admin.chatUnread`, `admin.chatInbox`, `admin.chatMessages({ userId })`).
- CSP hiện không có `connect-src` nên WebSocket tới `*.pusher.com` không bị chặn. Nếu sau này thêm `connect-src` thì phải mở `wss://ws-ap1.pusher.com` và `https://sockjs-ap1.pusher.com`.

## 7. Giao diện

### 7.1 Giáo viên
- Header (`AppHeader`, variant teacher): nút icon `MessageCircle` đặt trước nút ngôn ngữ, `size-11 md:size-10`. Có tin chưa đọc thì hiện số (quá 9 hiện `9+`), nền amber như badge đơn chờ của admin. `aria-label` "Nhắn hỗ trợ" hoặc "Nhắn hỗ trợ, {n} tin chưa đọc".
- Bấm nút → `Sheet` bên phải, mobile rộng toàn màn (`w-full sm:max-w-md`):
  - Tiêu đề "Nhắn với hỗ trợ". Mô tả "Hỏi cách dùng, báo lỗi hay góp ý. Admin trả lời ngay tại đây."
  - Danh sách tin cuộn được (`role="log"`, `aria-live="polite"`). Tin của mình nằm phải, nền `primary`. Tin của admin nằm trái, nền `slate-100`, có nhãn "Hỗ trợ". Dưới mỗi tin là giờ: cùng ngày (giờ VN) hiện `HH:mm`, khác ngày hiện `DD/MM HH:mm`.
  - Có tin cũ hơn → nút "Xem tin cũ hơn" ở đầu danh sách.
  - Dưới tin cuối cùng của mình hiện "Đã xem" khi `otherReadAt` không sớm hơn giờ của tin đó.
  - Chưa có tin: "Chưa có tin nhắn. Gửi câu hỏi đầu tiên nhé."
  - Nội dung hiện dạng chữ thường, giữ xuống dòng (`whitespace-pre-wrap break-words`), không render HTML, không tự tạo link.
  - Mở khung hoặc có tin admin mới khi khung đang mở → gọi `chat.markRead`, badge về 0.
- Ô nhập (`ChatComposer`, dùng chung với admin):
  - `Textarea` cao tối thiểu 44px, tối đa khoảng 4 dòng rồi cuộn.
  - Enter gửi, Shift+Enter xuống dòng. **Đang ghép chữ (Telex/VNI, `isComposing` hoặc `keyCode 229`) thì Enter không gửi.**
  - Nút Gửi `size-11`, tắt khi rỗng, quá 2000 ký tự hoặc đang gửi.
  - Từ 1800 ký tự hiện bộ đếm `n/2000`, quá thì chữ đỏ.
  - Gửi xong xoá ô. Lỗi thì giữ nguyên chữ và toast: `CHAT_LIMIT` → "Thầy cô gửi nhanh quá, đợi vài phút rồi gửi tiếp nhé"; lỗi khác → "Chưa gửi được, thử lại nhé".

### 7.2 Admin
- Mục nav mới **"Tin nhắn"** (nhãn ngắn "Nhắn", icon `MessagesSquare`), đặt ngay sau "Đơn chờ" trong `ADMIN_NAV_ITEMS`. Tab bar mobile thành **8 cột** (`grid-cols-8`; 375px / 8 ≈ 46px, vẫn ≥ 44px).
- Badge số cuộc trò chuyện chưa đọc trên mục nav (sidebar và tab bar), cùng kiểu badge đơn chờ, `data-testid="admin-chat-unread"`.
- Trang `/admin/chat`:
  - Desktop (`md:`): 2 cột, trái là danh sách (320px), phải là cuộc trò chuyện.
  - Mobile: chưa chọn thì hiện danh sách; chọn rồi thì hiện cuộc trò chuyện, có nút "Quay lại danh sách" 44px.
  - Mỗi dòng danh sách hiện họ tên (hoặc username) + username, đoạn trích tin cuối (tin của admin có tiền tố "Bạn: "), giờ, số chưa đọc. Nút "Xem thêm" (dùng lại key `admin_feedback_more`) khi `hasMore`, mỗi lần thêm 30.
  - Desktop chưa chọn: "Chọn một cuộc trò chuyện để xem."
  - Rỗng: "Chưa có cuộc trò chuyện nào."
  - Khung trò chuyện dùng lại `ChatMessageList` + `ChatComposer`. Tin admin nằm phải, có username admin nhỏ phía dưới. Mở cuộc trò chuyện hoặc có tin giáo viên mới khi đang mở → `admin.chatMarkRead`.
- Màu theo A3: `primary`, teal, slate, amber. Không dùng indigo/violet/purple.

### 7.3 i18n
Mọi chữ mới có trong cả `vi.json` và `en.json`. Không dùng gạch dài (—, –).

## 8. Bảo mật
- Mọi thủ tục đi qua `protectedProcedure`, nên tài khoản đang bị bắt đổi mật khẩu bị chặn như các thủ tục khác.
- Giáo viên chỉ đọc được cuộc trò chuyện của mình: truy vấn luôn lấy theo `ctx.userId`, không nhận `userId` từ client.
- Nội dung mã hoá trong DB; Pusher không nhận nội dung.
- React tự escape nội dung; không dùng `dangerouslySetInnerHTML`.

## 9. Ngoài phạm vi
- Gửi ảnh hoặc file, chỉ báo "đang gõ…", sửa hoặc xoá tin, tìm kiếm tin.
- Thông báo đẩy hoặc email khi có tin mới lúc người nhận không mở app.
- Nút "Nhắn tin" từ trang Tài khoản admin (API `admin.chatSend` đã hỗ trợ tạo cuộc trò chuyện mới; giao diện để sau).
- Hiện badge chat trong `BottomTabBar` của giáo viên.

## 10. Kiểm thử
- **Integration `chat`:**
  - gửi tạo cuộc trò chuyện, trim, rỗng hoặc > 2000 ký tự bị từ chối;
  - cột `body` trong DB là ciphertext (`enc:v1:`), đọc qua API ra bản rõ;
  - bộ đếm chưa đọc 2 phía và `markRead`;
  - phân trang 30 tin, thứ tự cũ → mới, `nextCursor`;
  - giới hạn 30 tin / 10 phút (tin cũ hơn không tính, admin không bị giới hạn);
  - giáo viên A không thấy tin của B; admin bị FORBIDDEN ở `chat.*`, giáo viên bị FORBIDDEN ở `admin.chat*`;
  - giáo viên không thấy `senderName`;
  - tài khoản xoá mềm bị ẩn khỏi hộp thư, gửi tới thì NOT_FOUND; gửi tới admin thì NOT_FOUND;
  - `chatInbox` sắp đúng, `preview` cắt 60 ký tự, `hasMore`.
- **Unit:** `chatPreview`, `chatTime` (đổi ngày theo giờ VN); `TRPCProvider` bỏ qua invalidate khi có meta; `ENCRYPTED_FIELDS` khớp DMMF (test sẵn có).
- **Component:**
  - `ChatComposer`: Enter gửi, Shift+Enter không, đang ghép chữ không gửi, rỗng thì nút tắt, bộ đếm;
  - `ChatMessageList`: bên trái/phải theo người xem, "Đã xem", nút tin cũ;
  - `ChatButton` badge `9+`;
  - `AdminChat` danh sách và chuyển màn mobile;
  - nav admin 8 mục + badge.
- **e2e:** giáo viên gửi tin (mobile 390px) → admin thấy badge, mở, trả lời → giáo viên thấy tin "Hỗ trợ" và badge (chờ theo polling, timeout 15 giây). Header 375px không tràn ngang.
- **Phần 2:**
  - unit `realtime.ts`: thiếu env thì không gọi; gửi đúng 2 kênh; payload không có nội dung; lỗi Pusher không ném;
  - route `/api/realtime/auth` đủ các mã 400/401/403/503/200;
  - matcher test thêm `/api/realtime/auth`;
  - hook đổi chu kỳ polling khi đang kết nối.
- `RELEASES` 0.14.0 (notify: true) và 0.14.1 (notify: false); `package.json` theo từng phần.
