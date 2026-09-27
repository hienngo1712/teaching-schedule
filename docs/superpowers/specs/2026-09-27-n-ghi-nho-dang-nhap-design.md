# N — Ghi nhớ đăng nhập 30 ngày, ép đăng nhập lại khi nâng version minor

> Phần N, làm sau M (chép lịch tháng). Thứ tự merge: L (`0.2.0`) → M (`0.3.0`) → N (`0.4.0`). L đang code trên nhánh `feat/l-bang-gia`. Spec này đọc code trên `main`. Đụng khu đăng nhập (`auth.config.ts`, `auth.ts`, `/login`), luồng đổi mật khẩu, 2 layout server và i18n. Có **1 migration nhỏ** (thêm cột `users.session_version`, không destructive). **Không** đổi luật rate limit / audit log đăng nhập.

## 1. Bối cảnh

Hiện trạng (đã đọc code, `next-auth@5.0.0-beta.32`, `@auth/core@0.41.3`):

- `src/server/auth.config.ts` (Edge-safe, middleware dùng): `session: { strategy: "jwt", maxAge: 8 * 60 * 60 }`, không đặt `updateAge`, không khai báo `cookies` (cookie mặc định của Auth.js: `authjs.session-token`, trên HTTPS là `__Secure-authjs.session-token`; `httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` theo giao thức). Callback `jwt` chỉ chép `userId/username/fullName` lúc đăng nhập; `authorized` chặn chưa đăng nhập + đẩy admin về `/admin/orders` (J Q3).
- `src/server/auth.ts` (Node): `NextAuth({ ...authConfig, providers: [Credentials] })`. `authorize` đọc `username/password`, gọi `authorizeCredentials()` (rate limit + `LoginAttempt` + `lastLoginAt`), trả `{ id, username, fullName }`.
- `src/middleware.ts`: `NextAuth(authConfig).auth` làm middleware. Matcher loại trừ `login|register|p/|api/auth|api/trpc|_next/...` → trang phụ huynh `/p/<token>` và tRPC không qua middleware.
- `src/app/login/actions.ts`: server action `loginAction(formData)` → `signIn("credentials", { username, password, redirect: false })`. `LoginForm.tsx` gửi form qua action rồi `router.replace(callbackUrl)`.
- Version: `next.config.mjs` đọc `package.json` → `env.NEXT_PUBLIC_APP_VERSION` (inline lúc build vào **mọi** bundle, kể cả middleware Edge). `package.json` đang là `0.1.0` và **chưa từng được nâng** kể từ commit khởi tạo.
- Không có chỗ nào khác gọi `signIn` (đăng ký xong không tự đăng nhập).
- Đổi mật khẩu: `ChangePasswordDialog.tsx` gọi tRPC `auth.changePassword` (`src/server/trpc/routers/auth.ts`): so `currentPassword`, hash, `update passwordHash`. Không đụng phiên nào. Integration test ở `tests/integration/auth.test.ts` (`describe("Auth router — me / changePassword")`).
- `User.isActive` chỉ được kiểm trong `authorizeCredentials()` lúc đăng nhập; JWT đã cấp vẫn sống tới hết hạn. Hiện chưa có UI nào đặt `isActive = false` cho user (chỉ sửa tay DB).
- `(app)/layout.tsx` gọi `auth()` nhưng **không** redirect khi `session` null (dựa hết vào middleware); `(admin)/admin/layout.tsx` gặp `session` null thì `notFound()`. `/api/backup` tự trả 401 khi không có session. tRPC context gọi `auth()` mỗi request, `enforceAuth` ném `UNAUTHORIZED`.

**Cơ chế phiên thật của thư viện** (`@auth/core/lib/actions/session.js`, `next-auth/lib/index.js`):

1. Mỗi request qua middleware: giải mã JWT (hết `exp` → xóa cookie) → gọi callback `jwt({ token })` → nếu trả `null` thì **xóa cookie** và coi là chưa đăng nhập; nếu không thì **ký lại JWT** với `exp = now + session.maxAge` và đặt lại cookie `Expires = now + session.maxAge`. Middleware giữ nguyên `Set-Cookie` này kể cả khi `authorized` trả redirect.
2. `auth()` trong Server Component / tRPC context cũng chạy callback `jwt` (trả `null` → session `null`) nhưng không ghi được cookie.
3. `updateAge` chỉ áp cho phiên database; với JWT, phiên được gia hạn ở **mọi** request qua middleware.
4. `session.maxAge` là **một giá trị chung** cho `exp` của JWT và `Expires` của cookie; `SessionStore.chunk()` luôn truyền `expires` tường minh. Không có cách cấu hình maxAge hay "cookie phiên trình duyệt" theo từng phiên.

→ Hôm nay: phiên **trượt 8 giờ** (mỗi lần chuyển trang qua middleware gia hạn thêm 8h; 8h không mở trang nào thì hết). Cookie là cookie bền 8h, **đóng trình duyệt không đăng xuất**.

## 2. Mục tiêu và tiêu chí hoàn thành

- `/login` có checkbox "Ghi nhớ đăng nhập", mặc định **không** tick.
- Tick: phiên trượt **30 ngày** (mở web là gia hạn; 30 ngày không mở thì phải đăng nhập lại). Cookie `Expires` ≈ 30 ngày.
- Không tick: giữ đúng hành vi hiện tại — phiên trượt **8 giờ**.
- Khi deploy bản có `major.minor` khác bản lúc đăng nhập (vd `0.2.x` → `0.3.0`, hoặc `0.9.x` → `1.0.0`), mọi phiên (tick hay không) bị coi là chưa đăng nhập ở lần request kế tiếp → về `/login` kèm thông báo nhẹ. Nâng patch (`0.2.0` → `0.2.1`) không ảnh hưởng.
- Tài khoản bị khóa (`isActive = false`) → mọi phiên của tài khoản đó bị coi là chưa đăng nhập ở request server kế tiếp.
- Đổi mật khẩu → máy đang đổi vẫn đăng nhập (được cấp token mới, giữ lựa chọn ghi nhớ); mọi máy khác bị đăng xuất ở request server kế tiếp.
- Trang phụ huynh `/p/<token>` không bị ảnh hưởng.
- `pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch.

## 3. Quyết định đã chốt (người dùng)

| # | Nội dung |
|---|---|
| N1 | Checkbox "Ghi nhớ đăng nhập" trên `/login`. Tick → 30 ngày, tự gia hạn. Không tick → như hiện tại (8h). |
| N2 | Ép đăng nhập lại chỉ khi nâng version minor (và major); patch không ép. Áp dụng cho cả hai loại phiên. |
| N3 | Làm luôn trong N: đá phiên cũ khi tài khoản bị khóa hoặc đổi mật khẩu. Máy đang đổi mật khẩu vẫn đăng nhập, máy khác bị đăng xuất. Chấp nhận 1 migration nhỏ. |
| N4 | Version: N lên là `0.4.0` (sau L `0.2.0`, M `0.3.0`). Khi N lên mọi người đăng nhập lại 1 lần (token cũ không có `epoch`). |
| N5 | Giữ câu thông báo chung ở Q7. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| Q1 | Làm maxAge khác nhau theo lựa chọn thế nào | `session.maxAge = 30 ngày` (trần chung, thư viện tự lo `exp` + cookie). Phiên không tick bị cắt ở callback `jwt`: nếu `remember !== true` và `now - token.iat > 8h` → `return null` | Thư viện chỉ có 1 maxAge (mục 1.4). `token.iat` của JWT đang giữ chính là lúc request trước ký lại token (thư viện ký lại mỗi request) → so với 8h là đúng "8h không hoạt động", khớp hành vi hiện tại |
| Q2 | Cookie của phiên không tick | Chấp nhận cookie mang `Expires` 30 ngày; server tự từ chối sau 8h không hoạt động và xóa cookie ở request đó | Làm cookie phiên trình duyệt (không `Expires`) phải chép đè `Set-Cookie` trong middleware và server action — mong manh, dễ vỡ khi nâng next-auth. Hôm nay cookie cũng bền (8h), đóng trình duyệt không đăng xuất, nên hành vi người dùng thấy không đổi. Rủi ro: cookie hết hiệu lực vẫn nằm trong trình duyệt tới lần request kế tiếp — vô hại vì server không chấp nhận |
| Q3 | Truyền `remember` | Form: `<Checkbox name="remember">` (Radix tự sinh input ẩn giá trị `"on"` khi tick) → `loginAction` đọc `formData.get("remember") === "on"` → `signIn("credentials", { username, password, remember: remember ? "1" : "0", redirect: false })` → `authorize` đọc `credentials.remember === "1"`, trả thêm `remember` trong user → callback `jwt` (nhánh `user`) ghi `t.remember` | `signIn` chuyển mọi field thành body `x-www-form-urlencoded` nên chỉ đi được chuỗi; `authorize` nhận nguyên body |
| Q4 | Epoch | `epochOf(version) = "major.minor"` (vd `"0.3.0"` → `"0.3"`). Lúc đăng nhập ghi `t.epoch = currentEpoch()`. Mọi lần gọi callback `jwt` sau đó: `t.epoch !== currentEpoch()` → `return null` | Một chỗ kiểm duy nhất phủ cả middleware (Edge) lẫn `auth()` (layout, `/login`, tRPC context, `/api/backup`) vì `auth.ts` spread `authConfig` |
| Q5 | Edge đọc version | `process.env.NEXT_PUBLIC_APP_VERSION` — Next inline lúc build vào cả bundle middleware nhờ `env` trong `next.config.mjs`. Đọc trong thân hàm `currentEpoch()` (không cache ra hằng module) để unit test đổi được env | Không cần biến môi trường runtime. Vitest không chạy qua Next nên env trống → fallback `"0.0"` |
| Q6 | Token cũ (trước khi N lên) không có `epoch` | Coi như lệch epoch → phải đăng nhập lại một lần khi N deploy | Token cũ vốn chỉ sống tối đa 8h; đơn giản hơn nhánh "thiếu field thì cho qua". Bản chứa N nâng `package.json` lên `0.4.0` (N4) nên việc đăng nhập lại khớp luật epoch |
| Q7 | Thông báo khi bị đẩy về `/login` | Có. Trong `authorized`: không có `auth.user` **mà** request có cookie tên chứa `authjs.session-token` → tự redirect `/login?callbackUrl=<href>&expired=1`. `LoginForm` thấy `expired=1` → hộp thông tin nhạt (slate/primary, không đỏ) `session_expired_relogin` | Callback `jwt` trả `null` không cho biết lý do; cookie còn mà phiên không hợp lệ = hết hạn hoặc lệch version. Dùng một câu chung cho cả hai. Đăng xuất đã xóa cookie nên không hiện nhầm |
| Q8 | `session.expires` trả về client | Không sửa (vẫn ghi now + 30 ngày cho cả phiên không tick) | Không chỗ nào đọc (`SessionProvider` tắt refetch); tránh code thừa |
| Q9 | Vị trí logic | File MỚI `src/lib/session-policy.ts` (thuần, Edge-safe): hằng `REMEMBER_MAX_AGE_S = 30*24*3600`, `SHORT_IDLE_S = 8*3600`; `epochOf(version)`, `currentEpoch()`, `isSessionExpired({ remember, iat, nowS })`. `auth.config.ts` import dùng | Test được không cần next-auth runtime, giống cách `src/lib/admin.ts` (J Q4) |
| Q10 | Cột đánh dấu để đá phiên (N3) | `User.sessionVersion Int @default(0)` (cột `session_version`). JWT lưu `sessionVersion` lúc đăng nhập; đổi mật khẩu thì `increment: 1`. Khóa tài khoản kiểm thẳng `isActive`, không cần tăng version | So số nguyên bằng nhau là chính xác tuyệt đối. `passwordChangedAt` phải so với thời điểm đăng nhập tính bằng giây (`iat` bị ký lại mỗi request nên phải thêm field `loginAt` riêng), dễ lỗi cùng-giây và lệch đồng hồ giữa app và DB. Số nguyên còn dùng lại được cho "đăng xuất mọi thiết bị" sau này |
| Q11 | Lớp nào kiểm DB | Chỉ phía **Node**: `auth.ts` bọc callback `jwt` của `authConfig` — chạy xong luật Edge (epoch, 8h) thì tra DB `select { isActive, sessionVersion }` theo `userId` (khóa chính). Không khớp / không thấy user / `isActive = false` → `return null`. Middleware Edge **không** kiểm (không dùng được Prisma) | Mọi chỗ đọc dữ liệu đều đi qua `auth()` Node: layout `(app)` và `(admin)`, tRPC context, `/api/backup`, `/login`, `/register` |
| Q12 | Cache kết quả tra DB | **Không cache**, tra mỗi lần `auth()` chạy (1 lần/render layout, 1 lần/request tRPC; batch tRPC dùng chung 1 context) | Truy vấn khóa chính ~vài ms (DB cùng vùng sin1). Cache trong bộ nhớ function serverless không chia sẻ giữa instance, lại làm trễ việc đá phiên. Độ trễ chấp nhận: **ngay ở request server kế tiếp** (bấm một nút gọi tRPC hoặc chuyển trang) |
| Q13 | Chuyển trang khi DB báo phiên hết mà middleware vẫn cho qua | `(app)/layout.tsx` và `(admin)/admin/layout.tsx`: `!session?.user` → `redirect("/login?expired=1")` (admin layout làm bước này **trước** `notFound()`) | Middleware không biết phiên đã bị đá; layout là lưới chặn. Không kèm `callbackUrl` (layout không có sẵn pathname) → đăng nhập lại vào `/dashboard` (admin tự sang `/admin/orders`). Không lộ khu quản trị vì chưa đăng nhập vào `/admin` vốn đã bị middleware đẩy về `/login` |
| Q14 | Cookie của máy bị đá | Để nguyên; không xóa được từ Server Component. Middleware vẫn ký lại (Edge thấy hợp lệ) nhưng mọi `auth()` Node trả `null`. Đăng nhập lại ghi đè cookie | Chỉ tốn vài byte; không có đường nào dùng được cookie đó để đọc dữ liệu |
| Q15 | Máy đang đổi mật khẩu giữ đăng nhập thế nào | Đổi từ tRPC sang **server action** `changePasswordAction` (MỚI): `auth()` lấy phiên hiện tại → service `changeUserPassword()` (so mật khẩu cũ, hash, `passwordHash` + `sessionVersion: { increment: 1 }` trong **một** `update`) → `signIn("credentials", { username, password: newPassword, remember: session.user.remember ? "1" : "0", redirect: false })` cấp token mới mang `sessionVersion` mới | tRPC route handler không có cách sạch để ghi lại cookie phiên. `update()` của NextAuth chạy lại callback `jwt` với token cũ → bị chính luật Q11 chặn, và nếu cho `update` lấy version mới từ DB thì máy bị lộ token cũng tự "làm mới" được. `signIn` bằng mật khẩu mới vừa là bằng chứng, vừa dùng đúng đường cấp cookie của thư viện |
| Q16 | tRPC `auth.changePassword` cũ | **Xóa**; logic chuyển vào `changeUserPassword()` trong `src/server/services/user.service.ts`; test integration chuyển sang gọi service + action | Giữ lại thì có một đường đổi mật khẩu tự đá luôn máy đang dùng. Một đường duy nhất |

## 5. Phạm vi

### Trong phạm vi
- `src/lib/session-policy.ts` (MỚI).
- `src/server/auth.config.ts`: `maxAge`, type `AppJWT` + `User`, callback `jwt`, `authorized` (thông báo).
- `src/server/auth.ts`: `authorize` đọc `remember`.
- `src/app/login/actions.ts`, `src/app/login/LoginForm.tsx`: checkbox, truyền cờ, thông báo `expired`.
- `src/language/vi.json`, `en.json`: 3 key.
- Migration `users.session_version`; `authorizeCredentials()` trả thêm `sessionVersion`; hàm MỚI `isSessionUserValid()`.
- `auth.ts` bọc callback `jwt` (tra DB) + `session` (lộ `remember`).
- `(app)/layout.tsx`, `(admin)/admin/layout.tsx`: redirect khi `session` null.
- Đổi mật khẩu: `changeUserPassword()` (service), `changePasswordAction` (server action MỚI), `ChangePasswordDialog.tsx` gọi action; xóa `auth.changePassword` tRPC.
- `package.json` → `0.4.0`.
- Test unit + integration + e2e (mục 7).

### Ngoài phạm vi (YAGNI)
- UI khóa tài khoản (admin chưa có; N chỉ bảo đảm khóa bằng bất kỳ cách nào cũng đá phiên).
- Màn "thiết bị đang đăng nhập", nút "đăng xuất mọi thiết bị" (cột `sessionVersion` để sẵn đường).
- Cookie phiên trình duyệt cho lựa chọn không tick (Q2).
- Tự động nâng version khi deploy (vẫn nâng tay trong `package.json`).
- Đổi luật trượt 8h hiện tại (vd gia hạn cả khi gọi tRPC).

## 6. Thiết kế chi tiết

### 6.1 `src/lib/session-policy.ts` (MỚI)

```ts
export const REMEMBER_MAX_AGE_S = 30 * 24 * 60 * 60
export const SHORT_IDLE_S = 8 * 60 * 60

// "0.3.1" → "0.3". Chuỗi lạ → trả nguyên chuỗi (vẫn so bằng được).
export function epochOf(version: string): string
// Next inline NEXT_PUBLIC_APP_VERSION lúc build, kể cả bundle middleware Edge.
export function currentEpoch(): string // epochOf(process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0")
// Phiên không ghi nhớ: hết khi quá 8h kể từ lần ký lại gần nhất (iat). Phiên ghi nhớ: `exp` 30 ngày của JWT lo.
export function isSessionExpired(p: { remember: boolean; iat: number | undefined; nowS: number }): boolean
```

`isSessionExpired`: `remember` → `false`; `iat` không có → `false` (lúc vừa đăng nhập token chưa có `iat`); còn lại `nowS - iat > SHORT_IDLE_S`.

### 6.2 `auth.config.ts`

- `session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE_S }`.
- `AppJWT` thêm `remember?: boolean; epoch?: string`. `interface User` thêm `remember?: boolean`.
- Callback `jwt({ token, user })`:
  1. Có `user` (vừa đăng nhập): chép như cũ + `t.remember = user.remember === true`, `t.epoch = currentEpoch()`, trả `t`.
  2. Không có `user`: `t.epoch !== currentEpoch()` → `return null`; `isSessionExpired({ remember: t.remember === true, iat: t.iat, nowS: Math.floor(Date.now()/1000) })` → `return null`; còn lại trả `t`.
- `authorized`: nhánh `!auth?.user` đổi thành: nếu `request.cookies.getAll().some(c => c.name.includes("authjs.session-token"))` → `Response.redirect(new URL("/login?callbackUrl=" + encodeURIComponent(request.nextUrl.href) + "&expired=1", origin))`; không thì `return false` như cũ (thư viện tự redirect `/login?callbackUrl=...`). `includes` để bắt cả tiền tố `__Secure-` và cookie chia mảnh `.0/.1`. Không vòng lặp vì `/login` nằm ngoài matcher; cookie hỏng đã được thư viện gắn `Set-Cookie` xóa trên chính response redirect.
- Kiểu trả của callback `jwt` là `JWT | null` — kiểm lại với type của beta.32 khi code.

### 6.3 `auth.ts`

`credentials` thêm `remember: { type: "text" }` (khai báo cho rõ, không bắt buộc). `authorize` trả `{ id, username, fullName, sessionVersion, remember: credentials?.remember === "1" }`.

`auth.config.ts` (bổ sung cho 6.2): `AppJWT` + `User` thêm `sessionVersion?: number`; nhánh `user` của `jwt` chép `t.sessionVersion = user.sessionVersion`. Edge chỉ mang field, **không** so.

Callback bọc trong `auth.ts` (Node):

```ts
callbacks: {
  ...authConfig.callbacks,
  async jwt(params) {
    const t = await authConfig.callbacks.jwt(params)
    // Vừa đăng nhập: authorize vừa đọc DB xong, khỏi tra lại.
    if (!t || params.user) return t
    return (await isSessionUserValid(Number(t.userId), t.sessionVersion)) ? t : null
  },
  async session(params) {
    const s = await authConfig.callbacks.session(params)
    s.user.remember = (params.token as AppJWT).remember === true
    return s
  },
}
```

- `isSessionUserValid(userId, sessionVersion)` (MỚI, trong `src/server/auth-credentials.ts` — file đã import `db`, test không cần next-auth): `findUnique({ where: { id }, select: { isActive: true, sessionVersion: true } })`; trả `true` khi user tồn tại, `isActive`, và `sessionVersion === ` giá trị trong token (token thiếu field → `false`). `userId` không phải số → `false`.
- Để integration test gọi được luồng bọc mà không kéo next-auth runtime, tách thân `jwt` bọc thành hàm `nodeJwt(params)` trong file MỚI `src/server/auth-node-callbacks.ts` (chỉ import `authConfig` + `isSessionUserValid`); `auth.ts` dùng lại.
- `Session.user` thêm `remember: boolean` (type ở `auth.config.ts`).
- `AuthorizedUser` + `authorizeCredentials()` trả thêm `sessionVersion: user.sessionVersion`.

### 6.3b Layout server

- `src/app/(app)/layout.tsx`: sau `auth()`, `if (!session?.user) redirect("/login?expired=1")`, rồi mới kiểm admin như cũ.
- `src/app/(admin)/admin/layout.tsx`: `if (!session?.user) redirect("/login?expired=1")` trước `notFound()`.
- `/api/backup` giữ 401 như cũ (đã tự kiểm). tRPC giữ `UNAUTHORIZED` như cũ.

### 6.3c Đổi mật khẩu

`src/server/services/user.service.ts` thêm:

```ts
// Tăng sessionVersion cùng lúc đổi hash → mọi token cũ hết hiệu lực trong cùng một lệnh ghi.
export async function changeUserPassword(db, userId: number, currentPassword: string, newPassword: string): Promise<void>
```
Thân chuyển nguyên từ `auth.changePassword` (so `bcrypt.compare`, hash `BCRYPT_COST`); sai mật khẩu cũ ném `TRPCError BAD_REQUEST "Mật khẩu hiện tại không đúng"` như cũ (action bắt và đổi thành kết quả). `update.data = { passwordHash, sessionVersion: { increment: 1 } }`.

`src/app/actions/change-password.ts` (MỚI, `"use server"`):

```ts
export type ChangePasswordResult =
  | { ok: true; relogin?: true }
  | { ok: false; error: "UNAUTHORIZED" | "WRONG_CURRENT" | "INVALID"; message?: string }
export async function changePasswordAction(input: ChangePasswordInput): Promise<ChangePasswordResult>
```
1. `auth()`; không có user → `UNAUTHORIZED`.
2. `changePasswordSchema.safeParse(input)`; lỗi → `INVALID` + message đầu tiên.
3. `changeUserPassword(db, Number(session.user.id), ...)`; `BAD_REQUEST` → `WRONG_CURRENT`.
4. `signIn("credentials", { username: session.user.username, password: newPassword, remember: session.user.remember ? "1" : "0", redirect: false })` → `{ ok: true }`. `signIn` ném `AuthError` (vd đang bị rate limit theo username vì vừa sai nhiều lần) → mật khẩu **đã đổi**, trả `{ ok: true, relogin: true }`.

`ChangePasswordDialog.tsx`: thay `trpc.auth.changePassword.useMutation` bằng `useTransition` + `changePasswordAction`. `ok` → toast "Đổi mật khẩu thành công", đóng dialog, reset form như cũ, `router.refresh()`. `relogin` → toast thêm "vui lòng đăng nhập lại" và `router.replace("/login")`. Lỗi → `setError(message ?? "Mật khẩu hiện tại không đúng")`. Kiểm `next.length < 10` / `confirm` phía client giữ nguyên.

Xóa procedure `changePassword` và import thừa (`changePasswordSchema`, `bcrypt`, `BCRYPT_COST` nếu không còn dùng) khỏi `src/server/trpc/routers/auth.ts`.

Khóa tài khoản: không có code mới ngoài `isSessionUserValid` — đặt `isActive = false` bằng bất kỳ cách nào là phiên chết ở request server kế tiếp.

### 6.4 `/login`

`actions.ts`: `const remember = formData.get("remember") === "on"`, truyền `remember: remember ? "1" : "0"` vào `signIn`. `LoginResult` không đổi.

`LoginForm.tsx`, giữa ô mật khẩu và hộp lỗi:

```tsx
<label htmlFor="remember" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
  <Checkbox id="remember" name="remember" disabled={isPending} className="h-5 w-5" />
  <span>{t("remember_me")}</span>
</label>
```

- Dùng `@/components/ui/checkbox` sẵn có (Radix, viền + nền tick `primary` = #0F766E theo A3). Vùng chạm cả dòng `min-h-11` (44px).
- Mặc định không tick (không `defaultChecked`), không nhớ lựa chọn lần trước — an toàn cho máy dùng chung.
- `searchParams.get("expired") === "1"` và chưa có lỗi → trên form hiện `<div role="status">` nền `bg-slate-50` viền `slate-200` chữ `slate-700`, nội dung `session_expired_relogin`. Có lỗi đăng nhập thì chỉ hiện lỗi.

i18n (vi / en):

| Key | vi | en |
|---|---|---|
| `remember_me` | Ghi nhớ đăng nhập (30 ngày) | Remember me (30 days) |
| `session_expired_relogin` | Phiên đăng nhập đã hết hoặc có phiên bản mới. Vui lòng đăng nhập lại. | Your session has ended or a new version is available. Please sign in again. |

(Không thêm dòng gợi ý "máy dùng chung" — mặc định không tick đã đủ; thêm nếu người dùng muốn.)

### 6.5 Ảnh hưởng tới phần khác

| Khu | Ảnh hưởng |
|---|---|
| Khu `/admin` | Như giáo viên: cùng checkbox, cùng luật 30 ngày / 8h / epoch. Redirect admin trong `authorized` giữ nguyên (chạy sau nhánh chưa đăng nhập) |
| `/p/<token>` phụ huynh | Không qua middleware, không gọi `auth()` → không ảnh hưởng |
| `/login`, `/register` | `auth()` với token lệch epoch / quá 8h trả `null` → hiện form bình thường, không vòng redirect |
| tRPC | Không qua middleware nên **không** gia hạn phiên (như hôm nay). Token hết/lệch → `auth()` `null` → `UNAUTHORIZED` như khi hết 8h hôm nay; lần chuyển trang kế tiếp middleware đẩy về `/login` |
| `/api/backup` | Qua middleware → cùng luật |
| Đăng xuất | `signOut({ callbackUrl: "/login" })` xóa cookie như cũ; không có cookie nên không hiện thông báo `expired` |
| Đổi mật khẩu | Máy đang đổi nhận token mới (giữ `remember`); máy khác: request tRPC kế tiếp `UNAUTHORIZED`, chuyển trang kế tiếp về `/login?expired=1` (Q11–Q15) |
| Khóa tài khoản | Như máy khác khi đổi mật khẩu |
| Hiệu năng | Thêm 1 truy vấn khóa chính mỗi lần `auth()` Node (layout, request tRPC). Log `createTRPCContext took` (> 100ms) sẵn có sẽ lộ nếu chậm |
| Deploy | Bản lệch `major.minor` → mọi người đăng nhập lại một lần. N lên `0.4.0` → cũng vậy. Dev local: đổi `package.json` phải khởi động lại `next dev` (env inline lúc build) |

## 7. Kiểm thử

### Unit (MỚI `tests/unit/session-policy.test.ts`)
- `epochOf`: `"0.2.0"` và `"0.2.1"` → cùng `"0.2"`; `"0.3.0"` ≠ `"0.2.9"`; `"1.0.0"` ≠ `"0.9.9"`.
- `currentEpoch()` đọc `process.env.NEXT_PUBLIC_APP_VERSION` mỗi lần gọi; env trống → `"0.0"`.
- `isSessionExpired`: remember + iat 29 ngày trước → false; không remember + iat 7h59m → false; 8h01m → true; iat thiếu → false.

### Unit (MỚI `tests/unit/auth-jwt.test.ts`, gọi thẳng `authConfig.callbacks.jwt` như `auth-authorized.test.ts`)
- Nhánh đăng nhập: `user.remember = true` → token có `remember: true`, `epoch` = epoch hiện tại; `remember` vắng → `false`.
- Token `epoch` khác (đổi env từ `0.2.1` sang `0.3.0`) → `null`; đổi sang `0.2.5` → trả token.
- Token thiếu `epoch` (token cũ) → `null`.
- Không remember, `iat = now - 9h` → `null`; `iat = now - 1h` → token. Remember, `iat = now - 9h` → token.

### Unit (bổ sung `tests/unit/auth-authorized.test.ts`)
- `auth = null` + request có cookie `authjs.session-token` (và `__Secure-authjs.session-token`) → Response 302 tới `/login?callbackUrl=...&expired=1`.
- `auth = null`, không cookie → `false` (giữ ca cũ). Helper `call()` phải thêm `request.cookies` giả.

### Integration (chỉ chạy trên `.env.test`, Postgres local Docker; DB test phải `migrate` để có cột mới)
- `tests/integration/session-validity.test.ts` (MỚI):
  - `isSessionUserValid`: `teacher` + đúng `sessionVersion` → true; lệch version → false; token thiếu version → false; `isActive = false` → false; id không tồn tại → false. `afterEach` trả `isActive = true`, `sessionVersion = 0`.
  - `nodeJwt`: token hợp lệ của `teacher` → trả token; sau `changeUserPassword` → `null`; nhánh có `user` → không tra DB (token mới mang `sessionVersion` mới qua được lần gọi kế tiếp).
- `tests/integration/auth.test.ts` (sửa): khối `changePassword` đổi sang gọi `changeUserPassword()`: đúng mật khẩu cũ → hash mới đăng nhập được, `sessionVersion` tăng 1; sai → `BAD_REQUEST`, `sessionVersion` giữ nguyên. Ca "newPassword < 10 ký tự" chuyển sang unit schema (hoặc test `changePasswordAction` trả `INVALID` nếu mock được `auth`). `authorizeCredentials` trả `sessionVersion`. Test tự khôi phục mật khẩu `teacher123`.

### E2E (bổ sung `tests/e2e/auth.spec.ts`)
- Đổi mật khẩu đá máy khác: 2 `browser.newContext()` A (tick ghi nhớ) và B cùng đăng nhập `teacher`. A mở menu tài khoản → Đổi mật khẩu → đổi sang mật khẩu tạm → A vẫn ở lại, `goto('/students')` vào được. B `goto('/students')` → `/login?expired=1`. `finally`: A đổi lại `teacher123` (qua dialog) để test khác không vỡ.
- Khóa tài khoản chỉ phủ ở integration (e2e không ghi DB trực tiếp).
- Có checkbox `remember`, mặc định không tick; bấm vào chữ cũng tick được.
- Tick + đăng nhập → cookie `authjs.session-token` có `expires` cách now khoảng 30 ngày (± 1h); giải mã bằng `decode` của `next-auth/jwt` (secret `NEXTAUTH_SECRET` trong `.env.test`, salt = tên cookie) thấy `remember: true`.
- Không tick → payload `remember: false`. (Cắt 8h không giả được giờ server trong e2e → đã phủ ở unit `auth-jwt`.)
- Lệch epoch: dựng token bằng `encode` của `next-auth/jwt` với payload hợp lệ của `teacher` nhưng `epoch: "0.0-old"`, gắn cookie → `goto('/dashboard')` → URL `/login` có `expired=1`, thấy câu `session_expired_relogin`; cookie bị xóa.
- Cùng epoch với bản đang chạy (đọc `package.json` trong test) → vào được `/dashboard`. Ca "nâng patch không ép" phủ ở unit (e2e không đổi version được khi server đang chạy).
- Ca đăng xuất cũ vẫn pass và không hiện thông báo `expired`.

### Review Focus
- Callback `jwt` chỉ trả `null` ở nhánh **không** có `user`; nhánh đăng nhập không bị epoch/idle chặn nhầm.
- `iat` đúng là giây (không phải ms); so `> SHORT_IDLE_S` dùng `Math.floor(Date.now()/1000)`.
- `session-policy.ts` không import gì ngoài TS thuần (chạy được ở Edge).
- `remember` so chặt `=== "1"` / `=== true`, không để chuỗi `"0"` thành truthy.
- `authorized`: nhánh cookie-còn-mà-không-có-user không tạo vòng redirect, giữ `callbackUrl`; ca GHSA-8fpg-xm3f-6cx3 (`auth` là object lỗi) vẫn bị chặn.
- Cookie giữ `httpOnly`, `sameSite: lax`, `secure` mặc định — không thêm cấu hình `cookies`.
- Không còn chỗ nào hard-code `8 * 60 * 60` ngoài `session-policy.ts`.
- `auth.config.ts` / `session-policy.ts` không import Prisma (middleware Edge vẫn build được); tra DB chỉ nằm ở `auth.ts` / `auth-node-callbacks.ts`.
- `changeUserPassword` đổi hash và tăng `sessionVersion` trong **một** `update` (không có khoảnh khắc hash mới mà version cũ).
- `changePasswordAction` lấy `username` và `remember` từ `auth()` phía server, không nhận từ client.
- Layout redirect khi `session` null đặt trước mọi logic khác; admin layout không còn `notFound()` cho người chưa đăng nhập.
- Không còn chỗ gọi `trpc.auth.changePassword`.

## 8. Rủi ro

| # | Rủi ro | Xử lý |
|---|---|---|
| R1 | Phiên 30 ngày kéo dài thời gian một token bị lộ (máy dùng chung quên đăng xuất) còn hiệu lực | Mặc định không tick; chỉ phiên có tick mới 30 ngày. Nâng minor là "nút đăng xuất tất cả" thô |
| R2 | Máy bị đá vẫn qua được middleware (Edge không tra DB); tới đích mới bị chặn | Mọi đường đọc dữ liệu (layout, tRPC, `/api/backup`) đều qua `auth()` Node (Q11, Q13). Trang tĩnh không có dữ liệu thì không có gì lộ |
| R2b | `signIn` sau khi đổi mật khẩu thất bại (rate limit theo username) | Trả `relogin`: mật khẩu đã đổi, máy này phải đăng nhập lại bằng mật khẩu mới — an toàn, chỉ bất tiện |
| R2c | Thêm 1 truy vấn DB mỗi `auth()` | Khóa chính, vài ms; theo dõi log `createTRPCContext took`. Nếu chậm mới tính cache ngắn (ngoài phạm vi) |
| R3 | Luật epoch chỉ có tác dụng nếu version thật sự được nâng — `package.json` đứng yên `0.1.0` từ đầu | L → `0.2.0`, M → `0.3.0`, N → `0.4.0` (N4). Về sau: bản muốn ép đăng nhập lại thì nâng minor; bản thường nâng patch |
| R4 | Nâng next-auth làm đổi cơ chế ký lại token / `iat` | Unit `auth-jwt` + e2e bắt được; `isSessionExpired` chỉ dựa `iat` chuẩn JWT |

## 9. Migration

`remember`, `epoch` nằm trong JWT + version build-time. Riêng N3 cần **1 migration**:

- `prisma/schema.prisma`, model `User`: `sessionVersion Int @default(0) @map("session_version")`.
- Thư mục MỚI `prisma/migrations/<timestamp>_add_user_session_version/migration.sql`, sinh bằng `pnpm db:migrate:dev` trên DB test local (`.env.test`, Postgres Docker `localhost:5433`), nội dung chỉ:

```sql
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
```

Không destructive: chỉ thêm cột có mặc định, không đụng dữ liệu cũ; user sẵn có nhận `0`. `tests/setup.ts` không cần sửa (seed user dùng mặc định).

**Trước khi merge/deploy**:
1. **Backup Neon**: tạo branch "Branch from current" trên project Neon prod (tên kiểu `backup-before-N-session-version-2026-xx-xx`), ghi lại tên để rollback.
2. Build Vercel tự chạy `prisma migrate deploy` (script `build`).
3. Sau deploy: mọi người đăng nhập lại 1 lần (epoch `0.4` + token cũ không có `epoch`/`sessionVersion`) — đúng N4. Kiểm trên tài khoản `qa_test`: đăng nhập tick ghi nhớ, đổi mật khẩu trên một trình duyệt, trình duyệt kia bị về `/login`; đổi lại mật khẩu cũ.

## Bổ sung (người dùng chốt 2026-09-27): admin reset mật khẩu

- **R1 — Nút "Reset mật khẩu"** ở màn `/admin/accounts` (cạnh "Đặt gói"; ẩn với tài khoản admin — `overview.users[].isAdmin`). Bấm → AlertDialog xác nhận nêu tên đăng nhập → server sinh **mật khẩu tạm ngẫu nhiên** (crypto, ~12 ký tự dễ đọc, bỏ ký tự dễ nhầm 0/O/1/l; vd `Lich-7k2m-Qx9f`) → hash bcrypt như `user.service` → trả mật khẩu tạm cho admin **đúng 1 lần** trong dialog kèm nút Sao chép (không log, không lưu dạng rõ, không hiện lại). KHÔNG dùng mật khẩu mặc định cố định.
- **R2 — Bắt đổi mật khẩu:** thêm cột `User.mustChangePassword Boolean @default(false)` (gộp chung migration của N với `sessionVersion`). Reset → `mustChangePassword = true` + tăng `sessionVersion` (mọi máy đang đăng nhập bị đá). Đăng nhập bằng mật khẩu tạm → mọi route giáo viên chuyển tới trang/dialog đổi mật khẩu bắt buộc (không vào được dashboard/tRPC nghiệp vụ cho tới khi đổi; chặn ở server, không chỉ UI). Đổi thành công → `mustChangePassword = false`, giữ đăng nhập máy hiện tại (luồng `changePasswordAction` của N). Mật khẩu mới phải khác mật khẩu tạm.
- **R3 — Server:** `admin.resetPassword({ userId })` qua `adminProcedure`; không cho reset tài khoản trong ADMIN_USERNAMES; ghi audit (ai reset, lúc nào, cho user nào — dùng audit log sẵn có nếu có, không lưu mật khẩu).
- **Test:** integration (mật khẩu tạm đăng nhập được, sessionVersion tăng → phiên cũ bị đá, mustChangePassword chặn tRPC nghiệp vụ, đổi xong hết chặn, giáo viên gọi resetPassword → FORBIDDEN, không reset được admin); e2e admin reset → dialog hiện mật khẩu 1 lần → đăng nhập bằng mật khẩu tạm ở context khác → bị bắt đổi → đổi xong vào dashboard.
