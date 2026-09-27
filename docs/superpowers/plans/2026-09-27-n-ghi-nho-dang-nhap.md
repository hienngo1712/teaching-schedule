# N — Ghi nhớ đăng nhập 30 ngày, ép đăng nhập lại khi nâng minor, đá phiên khi đổi/reset mật khẩu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/login` có checkbox "Ghi nhớ đăng nhập (30 ngày)" (tick → phiên trượt 30 ngày, không tick → trượt 8h như cũ); deploy bản lệch `major.minor` thì mọi phiên phải đăng nhập lại; khóa tài khoản / đổi mật khẩu / admin reset mật khẩu thì mọi máy khác bị đá ở request server kế tiếp (máy đang đổi mật khẩu vẫn đăng nhập); admin reset mật khẩu cho giáo viên bằng mật khẩu tạm hiện 1 lần, người dùng bị bắt đổi mật khẩu (chặn ở server) trước khi dùng tiếp.

**Architecture:** Luật thuần ở file MỚI `src/lib/session-policy.ts` (Edge-safe). `session.maxAge` = 30 ngày; callback `jwt` trong `auth.config.ts` (chạy cả middleware Edge lẫn `auth()` Node) trả `null` khi lệch epoch hoặc phiên không ghi nhớ quá 8h kể từ lần ký lại (`iat`). Phía Node, `auth.ts` thay callback `jwt` bằng `nodeJwt` (file MỚI `src/server/auth-node-callbacks.ts`) tra DB `isActive` + `sessionVersion` + `mustChangePassword` mỗi lần `auth()`. Đổi mật khẩu chuyển từ tRPC sang server action `changePasswordAction` (tăng `sessionVersion` rồi `signIn` lại bằng mật khẩu mới để cấp cookie mới cho máy đang dùng). Admin reset = `admin.resetPassword` (mật khẩu tạm crypto, `mustChangePassword = true`, tăng `sessionVersion`, ghi bảng MỚI `password_reset_logs`); cờ `mustChangePassword` chặn ở middleware, layout `(app)`, tRPC `enforceAuth`, `/api/backup`; trang MỚI `/change-password` để đổi. 1 migration: 2 cột `users` + 1 bảng.

**Tech Stack:** Next.js 15.5 App Router, React 19, NextAuth `5.0.0-beta.32` (`@auth/core@0.41.3`, JWT, middleware Edge), tRPC v11, Prisma 5.22 + PostgreSQL, zod 3.25, Radix Checkbox/AlertDialog (shadcn), sonner, bcryptjs, Vitest 4 (+ jsdom, Testing Library), Playwright (`next-auth/jwt` `encode/decode` để đọc/giả cookie).

**Spec:** `docs/superpowers/specs/2026-09-27-n-ghi-nho-dang-nhap-design.md` (N1–N5 người dùng chốt; Q1–Q16 giữ nguyên trừ chỗ ghi ở "Điều chỉnh so với spec"; mục cuối "Bổ sung … admin reset mật khẩu" R1–R3 người dùng chốt 2026-09-27). Thứ tự merge: L (`0.2.0`) → M (`0.3.0`) → N (`0.4.0`). Plan viết khi `main` = `200aa6f` (L đang ở nhánh `feat/l-bang-gia`, M chưa code) → mọi mô tả "code hiện tại" trong plan là code `main` lúc viết; L/M có thể đã đổi file dùng chung (xem Global Constraints "Đối chiếu code thật").

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh chạm DB (kể cả `pnpm test`, `pnpm exec playwright test`, lệnh `prisma`) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, Neon, host `ep-polished-voice…`) KHÁC `.env.test` (Postgres local Docker `student-test-pg`, `localhost:5433`). **Không bao giờ sửa/ghi `.env`**, chỉ đọc host để so sánh. Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người dùng.
- **Migration:** `scripts/migrate-dev.ts` (script `pnpm db:migrate:dev`) nạp `.env.local` rồi chạy `prisma migrate deploy` — KHÔNG dùng (không tạo migration, không chắc trỏ DB test). Tạo bằng `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name <x>` (Bash, subshell chỉ nạp 2 biến của `.env.test`, có chốt `localhost:5433`), đọc lại SQL, áp bằng `... pnpm exec prisma migrate deploy` lên DB test, kiểm dòng `Datasource "db": ... at "localhost:5433"`. KHÔNG áp lên prod (Vercel tự `prisma migrate deploy` khi build sau merge). Không destructive (chỉ `ALTER TABLE "users" ADD COLUMN ... DEFAULT`, `CREATE TABLE`, `CREATE INDEX`). Prisma báo drift / đòi reset / hỏi xác nhận → DỪNG, báo người điều phối.
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push` (mọi dạng, kể cả `--force-reset`), `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`, `git stash`. Build kiểm tra bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị `.env.test`.
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **E2E:** `pnpm exec playwright test <file>` (cổng 3000; `playwright.config.ts` tự khởi `pnpm dev` với DB `.env.test`, `ADMIN_USERNAMES=admin_test`, `reuseExistingServer: false`; `.env.test` có `NEXTAUTH_URL=http://localhost:3000` và `NEXTAUTH_SECRET` → cookie phiên tên `authjs.session-token`, không có tiền tố `__Secure-`). Cổng 3000 bận → không tắt tiến trình đó, DỪNG và báo người dùng. Trước lượt e2e đầu tiên của mỗi task chạy `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed: mọi user seed về mật khẩu `teacher123`, `sessionVersion 0`). E2E ghi DB bằng Prisma trực tiếp phải kiểm `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` trong `beforeAll` (mẫu `tests/e2e/admin.spec.ts`). Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. Dev server inline `NEXT_PUBLIC_APP_VERSION` lúc khởi động → đổi `package.json` phải chạy lượt e2e mới.
- Tài khoản seed DB test (mật khẩu `teacher123`): `teacher`, `teacher2` (Pro tới 2099), `teacher_std` (Standard), `admin_test` (admin trong test/e2e). Không nhập mật khẩu/credential nào khác vào trình duyệt ngoài tài khoản test do chính test tạo; **không nhập credential vào trình duyệt trên production; không ghi dữ liệu production.**
- i18n: `src/language/vi.json` và `en.json` cùng bộ key (`tsc` bắt thiếu key ở `en`). Chuỗi mới không dùng gạch dài (—, –). Thay biến bằng `.replace("{x}", ...)`.
- Màu (A3): nhấn `primary` (#0F766E), trung tính slate, lỗi đỏ như code sẵn có. **Không** indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts` phải pass). Nút/vùng chạm ≥44px trên mobile: `h-11 md:h-10`, dòng checkbox `min-h-11`.
- `tests/unit/next15-contract.test.ts` đỏ nếu `page.tsx`/`layout.tsx` có định danh `params`/`searchParams` (kể cả trong comment). Repo đọc query `/login?expired=1` ở client component `LoginForm.tsx` bằng `useSearchParams()` — giữ cách đó; page/layout MỚI (`src/app/change-password/page.tsx`) không đọc query.
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy; không mô tả lại code.
- Giữ kiểu xuống dòng của từng file (file trong repo đang là LF, `core.autocrlf=true`); không đổi hàng loạt xuống dòng.
- Làm trên nhánh `feat/n-ghi-nho-dang-nhap` (tạo ở Task 1 từ `main` mới nhất SAU KHI M đã merge). **Không commit lên `main`. Agent thực hiện task KHÔNG merge, KHÔNG push.** Không đụng file untracked của người khác.
- **Đối chiếu code thật:** trước khi sửa file dùng chung (`src/server/auth.config.ts`, `auth.ts`, `auth-credentials.ts`, 2 layout, `AppHeader.tsx`/`ChangePasswordDialog.tsx`, `AdminAccounts.tsx`, `src/server/trpc/index.ts`, `routers/admin.ts`, `user.service.ts`, i18n, `prisma/schema.prisma`, `tests/helpers/trpc.ts`) đọc file thật. L/M đổi chỗ nào khác plan (vd thêm procedure admin, thêm model, thêm key i18n, `registerUser` đọc số ngày dùng thử từ DB) → giữ code của L/M, chèn phần của N theo đúng ý plan, ghi "Ruling: …" vào báo cáo task.
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit (chỉ `git add` đúng file của task). Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Code lệch plan (vì code thật khác mô tả) → theo code thật, giữ đúng hành vi spec, ghi lại trong báo cáo task.

## Điều chỉnh so với spec

1. **1 migration chung `add_session_version_password_reset`** (spec mục 9: `_add_user_session_version`): gộp `users.session_version`, `users.must_change_password` (R2) và bảng MỚI `password_reset_logs` (R3). Lý do bảng mới: repo không có audit log chung (chỉ `login_attempts` cho đăng nhập, bảng lịch sử giá/dùng thử của L), R3 cho phép tạo khi không có sẵn. Không FK tới `users` (giống L): `tests/setup.ts` xóa `users` mỗi lượt, FK RESTRICT sẽ chặn. Test migration: `tests/integration/session-migration.test.ts`.
2. **`isSessionUserValid` → `getSessionUserState(userId, sessionVersion): Promise<{ mustChangePassword: boolean } | null>`** (cùng file `auth-credentials.ts`): cùng 1 truy vấn khóa chính trả luôn cờ `mustChangePassword` mới nhất từ DB cho R2 (`nodeJwt` ghi đè cờ trong token bằng giá trị DB).
3. **`session.user.remember` và `mustChangePassword` gán trong callback `session` của `auth.config.ts`** (spec 6.3: bọc `session` trong `auth.ts`): chỉ đọc token, không cần DB, và middleware cần `mustChangePassword` trong `auth.user` để redirect. `auth.ts` chỉ thay `jwt` bằng `nodeJwt`.
4. **Kiểu `Session.user.remember?: boolean`, `mustChangePassword?: boolean` (tùy chọn)** (spec: `remember: boolean`): để các fixture session sẵn có (`tests/integration/plan-gating.test.ts`, `tests/unit/layout/admin-redirect.test.ts`) không phải sửa; mọi chỗ đọc so chặt `=== true`.
5. **Unit test `session-policy` đặt ở `tests/unit/lib/session-policy.test.ts`** (spec: `tests/unit/session-policy.test.ts`) theo chỗ để test `src/lib/*` sẵn có.
6. **Chỉ 2 key i18n cho phần đăng nhập** (`remember_me`, `session_expired_relogin`; spec ghi "3 key" nhưng bảng chỉ có 2). `ChangePasswordDialog` đang viết cứng tiếng Việt → chuỗi toast/lỗi mới của luồng đổi mật khẩu cũng viết cứng tiếng Việt cho cùng giọng (không i18n hóa dialog cũ, ngoài phạm vi). Trang `/change-password` và dialog reset ở admin là UI mới → dùng key i18n (Task 5, 6).
7. **Tách form đổi mật khẩu thành `src/components/layout/ChangePasswordForm.tsx`** (MỚI, Task 4): dùng chung cho `ChangePasswordDialog` và trang bắt buộc `/change-password` (R2). Form tự reset khi dialog đóng (DialogContent unmount).
8. **"Mật khẩu mới phải khác mật khẩu hiện tại" áp cho mọi lần đổi** (R2 chỉ nói khác mật khẩu tạm): thêm `.refine` vào `changePasswordSchema` (server) + kiểm tương tự ở client. Đơn giản hơn phân biệt đang dùng mật khẩu tạm hay không.
9. **E2E đổi mật khẩu khôi phục `teacher123` bằng Prisma trong `finally`** (spec: A đổi lại qua dialog): bền hơn — nếu A bị đăng xuất nhầm, test vẫn trả DB về trạng thái cho test sau.
10. **E2E epoch dựng token giả từ payload thật** (decode cookie sau đăng nhập, chỉ đổi `epoch`) thay vì tự dựng từ đầu: payload giả luôn có `userId`/`sessionVersion` đúng DB nên chỉ epoch quyết định kết quả; ca "cùng epoch vào được" = đăng nhập thật + decode thấy `epoch` khớp `package.json`.
11. **`/api/backup` thêm kiểm `mustChangePassword` → 403** (R2 "chặn ở server"): middleware Edge đã chặn theo token, nhưng cờ đặt tay trong DB chỉ lộ ở `auth()` Node.
12. **`admin.resetPassword` với tài khoản admin → `FORBIDDEN`, id không tồn tại → `NOT_FOUND`.** Reset không xóa log đăng nhập sai (spec N không đổi luật rate limit) → tài khoản đang bị khóa 15 phút vẫn phải chờ hết khóa mới đăng nhập bằng mật khẩu tạm (ghi vào Rủi ro báo người dùng).
13. **Version:** Task 7 (agent) nâng `package.json` lên `0.4.0` bằng commit riêng TRƯỚC khi chạy e2e/build cuối (e2e epoch đọc `package.json`). Người điều phối không cần nâng lúc merge.
14. Spec N đang untracked trên `main` → Task 1 commit spec + plan lên nhánh feature trước khi code. Plan có 7 task.

## Review Focus

1. **Server action đổi mật khẩu chạy trên trang có middleware** (`/dashboard`, `/students`, `/change-password`…): response mang 2 `Set-Cookie` cùng tên — middleware ký lại token CŨ, action `signIn` ghi token MỚI. Người dùng mong máy đang đổi vẫn đăng nhập. Pin: e2e Task 4 `tests/e2e/auth.spec.ts` ("đổi mật khẩu: máy đang đổi vẫn đăng nhập…": A `goto('/students')` ở lại và cookie decode ra `sessionVersion` mới) + e2e Task 6 (đổi mật khẩu bắt buộc xong vào `/dashboard`). Nếu đỏ vì A bị về `/login`: DỪNG, ghi thứ tự header `set-cookie` của response POST action (Playwright `page.on('response')`), báo người điều phối — không tự vá bằng cách sửa matcher/cookie.
2. **Token cũ phát hành trước khi N lên** (không có `epoch`, không có `sessionVersion`): phải bị coi là chưa đăng nhập ở cả Edge lẫn Node, không vòng redirect. Pin: unit Task 2 `tests/unit/auth-jwt.test.ts` ("token cũ thiếu epoch → null") + integration Task 3 `tests/integration/session-validity.test.ts` ("token thiếu sessionVersion → null").
3. **Giáo viên đang bị bắt đổi mật khẩu gọi thẳng tRPC / tải sao lưu** (không qua UI): phải bị chặn ở server. Pin: integration Task 5 `tests/integration/password-reset.test.ts` (`auth.me` → `FORBIDDEN` khi cờ bật, hết chặn sau khi đổi) + `tests/integration/backup-route.test.ts` (cờ → 403).
4. **Còn cookie mà phiên hỏng ở trang `/login` / `/register`**: không vòng redirect, form hiện bình thường kèm thông báo nhẹ; đăng xuất (không còn cookie) thì không hiện thông báo. Pin: unit Task 2 `tests/unit/auth-authorized.test.ts` (cookie còn + không user → 302 `…&expired=1`; không cookie → `false`) + e2e Task 2 (token lệch epoch → `/login?…expired=1`, cookie bị xóa; test đăng xuất cũ không thấy `role=status`).
5. **Phiên không ghi nhớ ở ngưỡng 8h** (`iat` là giây, không phải ms; nhánh vừa đăng nhập không bị cắt nhầm): Pin: unit Task 1 `tests/unit/lib/session-policy.test.ts` (7h59m → còn, 8h01m → hết) + unit Task 2 `tests/unit/auth-jwt.test.ts` ("nhánh đăng nhập không bị luật epoch/8h chặn").

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `prisma/schema.prisma` | Sửa | `User.sessionVersion`, `User.mustChangePassword`, model `PasswordResetLog` | 1 |
| `prisma/migrations/<ts>_add_session_version_password_reset/migration.sql` | Mới | 2 cột + 1 bảng + index | 1 |
| `tests/integration/session-migration.test.ts` | Mới | SQL không destructive + DB test đã áp | 1 |
| `src/lib/session-policy.ts` | Mới | `REMEMBER_MAX_AGE_S`, `SHORT_IDLE_S`, `epochOf`, `currentEpoch`, `isSessionExpired` | 1 |
| `tests/unit/lib/session-policy.test.ts` | Mới | Luật thuần | 1 |
| `src/server/auth.config.ts` | Sửa | `maxAge`, type `AppJWT`/`User`/`Session`, `jwt` (epoch, 8h), `session`, `authorized` (expired; Task 5 thêm `mustChangePassword`) | 2, 5 |
| `src/server/auth.ts` | Sửa | `authorize` trả `remember` (T2), `sessionVersion`/`mustChangePassword` + `jwt: nodeJwt` (T3) | 2, 3 |
| `src/app/login/actions.ts`, `LoginForm.tsx` | Sửa | Checkbox, truyền cờ, thông báo `expired` | 2 |
| `src/language/vi.json`, `en.json` | Sửa | `remember_me`, `session_expired_relogin` (T2); `must_change_password_*` (T5); `admin_reset_*` (T6) | 2, 5, 6 |
| `tests/unit/auth-jwt.test.ts` | Mới | Callback `jwt` | 2 |
| `tests/unit/auth-authorized.test.ts` | Sửa | Cookie còn → expired (T2); `mustChangePassword` (T5) | 2, 5 |
| `tests/unit/components/LoginForm.test.tsx` | Mới | Checkbox + thông báo | 2 |
| `tests/e2e/auth.spec.ts` | Sửa | Ghi nhớ, epoch (T2); đổi mật khẩu đá máy khác (T4) | 2, 4 |
| `src/server/auth-credentials.ts` | Sửa | `AuthorizedUser` thêm 2 field, `getSessionUserState` | 3 |
| `src/server/auth-node-callbacks.ts` | Mới | `nodeJwt` | 3 |
| `src/app/(app)/layout.tsx`, `src/app/(admin)/admin/layout.tsx` | Sửa | Redirect `/login?expired=1` (T3); `(app)` thêm `/change-password` (T5) | 3, 5 |
| `tests/integration/session-validity.test.ts` | Mới | `getSessionUserState`, `nodeJwt` (T3), sau `changeUserPassword` (T4) | 3, 4 |
| `tests/integration/auth.test.ts` | Sửa | `authorizeCredentials` trả field mới (T3); khối đổi mật khẩu → `changeUserPassword` (T4) | 3, 4 |
| `tests/unit/layout/admin-redirect.test.ts` | Sửa | Layout khi session null (T3), `mustChangePassword` + trang `/change-password` (T5) | 3, 5 |
| `src/lib/schemas/auth.ts` | Sửa | `changePasswordSchema` refine (T4); `resetPasswordSchema` (T5) | 4, 5 |
| `src/server/services/user.service.ts` | Sửa | `changeUserPassword` | 4 |
| `src/app/actions/change-password.ts` | Mới | `changePasswordAction` | 4 |
| `src/components/layout/ChangePasswordForm.tsx` | Mới | Form đổi mật khẩu dùng chung | 4 |
| `src/components/layout/ChangePasswordDialog.tsx` | Sửa | Dùng form + action | 4 |
| `src/server/trpc/routers/auth.ts` | Sửa | Xóa `changePassword` | 4 |
| `tests/unit/schemas/auth.schema.test.ts` | Mới | `changePasswordSchema` (T4), `resetPasswordSchema` (T5) | 4, 5 |
| `tests/unit/change-password-action.test.ts` | Mới | Action (mock `auth`/`signIn`) | 4 |
| `tests/unit/components/ChangePasswordForm.test.tsx` | Mới | Form | 4 |
| `src/server/services/password-reset.service.ts` | Mới | `generateTempPassword`, `adminResetPassword` | 5 |
| `src/server/trpc/routers/admin.ts` | Sửa | `resetPassword` | 5 |
| `src/server/trpc/index.ts` | Sửa | `enforceAuth` chặn `mustChangePassword` | 5 |
| `src/app/api/backup/route.ts` | Sửa | 403 khi `mustChangePassword` | 5 |
| `src/app/change-password/page.tsx`, `ForcedChangePassword.tsx` | Mới | Trang đổi mật khẩu bắt buộc | 5 |
| `tests/helpers/trpc.ts` | Sửa | Session có `mustChangePassword` từ DB | 5 |
| `tests/unit/services/temp-password.test.ts` | Mới | Định dạng mật khẩu tạm | 5 |
| `tests/integration/password-reset.test.ts` | Mới | Reset, quyền, chặn tRPC | 5 |
| `tests/integration/backup-route.test.ts` | Sửa | 403 | 5 |
| `src/components/admin/ResetPasswordDialog.tsx` | Mới | Xác nhận + hiện mật khẩu tạm 1 lần | 6 |
| `src/components/admin/AdminAccounts.tsx` | Sửa | Nút "Reset mật khẩu" | 6 |
| `tests/unit/components/ResetPasswordDialog.test.tsx` | Mới | Dialog | 6 |
| `tests/e2e/admin-reset-password.spec.ts` | Mới | Luồng reset → bắt đổi → dashboard | 6 |
| `package.json` | Sửa | `version` → `0.4.0` | 7 |

Thứ tự bắt buộc (tuần tự, mỗi task 1 agent mới): Task 1 → 2 → … → 7. T2 cần `session-policy` (T1) và cột mới chưa cần; T3 cần cột `session_version`/`must_change_password` (T1) + type `AppJWT` (T2); T4 cần `nodeJwt` (T3); T5 cần `ChangePasswordForm` + `changeUserPassword` (T4), bảng `password_reset_logs` (T1); T6 cần `admin.resetPassword` + trang `/change-password` (T5); T7 cần tất cả.

---
### Task 1: Nhánh, migration (2 cột users + bảng password_reset_logs), luật phiên thuần

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 1, 5, 13, 14; spec mục 1 (cơ chế phiên), 4 (Q1, Q4, Q5, Q6, Q9, Q10), 6.1, 7 (Unit `session-policy`), 9, mục "Bổ sung" R2–R3; `docs/coding-rule.md` §6.1; `scripts/migrate-dev.ts` (để thấy vì sao KHÔNG dùng); `prisma/schema.prisma` (model `User` + model cuối file); `tests/integration/plan-launch-migration.test.ts` và (nếu L đã merge) `tests/integration/plan-settings-migration.test.ts` (kiểu test đọc SQL).

**Files:**
- Modify: `prisma/schema.prisma` (model `User` thêm 2 dòng; thêm model `PasswordResetLog` cuối file)
- Create: `prisma/migrations/<ts>_add_session_version_password_reset/migration.sql` (Prisma sinh)
- Create: `src/lib/session-policy.ts`
- Test (Mới): `tests/integration/session-migration.test.ts`, `tests/unit/lib/session-policy.test.ts`

**Interfaces:**
- Consumes: không.
- Produces:
  - Prisma: `User.sessionVersion: number` (mặc định 0), `User.mustChangePassword: boolean` (mặc định false); `db.passwordResetLog` (`id: number, userId: number, resetBy: string, createdAt: Date`).
  - `src/lib/session-policy.ts`: `REMEMBER_MAX_AGE_S = 2592000`, `SHORT_IDLE_S = 28800`, `epochOf(version: string): string`, `currentEpoch(): string`, `isSessionExpired(p: { remember: boolean; iat: number | undefined; nowS: number }): boolean`.

- [ ] **Step 0: Kiểm L, M đã merge; tạo nhánh; commit spec + plan**

Run (Bash):
```bash
git checkout main
git pull --ff-only
git merge-base --is-ancestor feat/l-bang-gia main && echo "L đã merge" || echo "L CHƯA merge"
git merge-base --is-ancestor feat/m-chep-lich-thang main && echo "M đã merge" || echo "M CHƯA merge"
git log --oneline -15 main
grep '"version"' package.json
git status --short
```
Expected: in `L đã merge` và `M đã merge` (log có commit kiểu `feat: merge feat/m-chep-lich-thang → main`). Nhánh `feat/m-chep-lich-thang` không tồn tại cục bộ hoặc in "CHƯA merge" mà log `main` không có commit merge M → **DỪNG, báo người điều phối "M chưa merge", không tạo nhánh.** Ghi lại `version` hiện tại vào báo cáo (L/M không nâng version thì vẫn là `0.1.0`; Task 7 nâng lên `0.4.0`). `git status --short` có 2 file untracked của N (`docs/superpowers/specs/2026-09-27-n-ghi-nho-dang-nhap-design.md`, `docs/superpowers/plans/2026-09-27-n-ghi-nho-dang-nhap.md`); file khác của người dùng thì kệ, KHÔNG add.

```bash
git checkout -b feat/n-ghi-nho-dang-nhap
git add docs/superpowers/specs/2026-09-27-n-ghi-nho-dang-nhap-design.md docs/superpowers/plans/2026-09-27-n-ghi-nho-dang-nhap.md
git commit -m "docs(n): spec + plan ghi nhớ đăng nhập 30 ngày, ép đăng nhập lại khi nâng minor, admin reset mật khẩu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
Expected: commit chỉ có 2 file. Nhánh đã có (agent trước làm dở) → `git checkout feat/n-ghi-nho-dang-nhap`, bỏ commit docs nếu `git log main..HEAD` đã có.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG, báo người dùng.

- [ ] **Step 2: Viết unit test luật phiên (RED)**

Tạo `tests/unit/lib/session-policy.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest"
import {
  REMEMBER_MAX_AGE_S,
  SHORT_IDLE_S,
  currentEpoch,
  epochOf,
  isSessionExpired,
} from "@/lib/session-policy"

const original = process.env.NEXT_PUBLIC_APP_VERSION
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION
  else process.env.NEXT_PUBLIC_APP_VERSION = original
})

describe("epochOf (spec N Q4)", () => {
  it("chỉ lấy major.minor: nâng patch không đổi epoch", () => {
    expect(epochOf("0.2.0")).toBe("0.2")
    expect(epochOf("0.2.1")).toBe(epochOf("0.2.0"))
    expect(epochOf("0.3.0")).not.toBe(epochOf("0.2.9"))
    expect(epochOf("1.0.0")).not.toBe(epochOf("0.9.9"))
    expect(epochOf("0.10.3")).toBe("0.10")
  })
  it("chuỗi lạ → giữ nguyên để vẫn so bằng được", () => {
    expect(epochOf("dev")).toBe("dev")
  })
})

describe("currentEpoch (spec N Q5)", () => {
  it("đọc env mỗi lần gọi, không cache", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "0.2.1"
    expect(currentEpoch()).toBe("0.2")
    process.env.NEXT_PUBLIC_APP_VERSION = "0.4.0"
    expect(currentEpoch()).toBe("0.4")
  })
  it("env trống hoặc thiếu → 0.0", () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION
    expect(currentEpoch()).toBe("0.0")
    process.env.NEXT_PUBLIC_APP_VERSION = ""
    expect(currentEpoch()).toBe("0.0")
  })
})

describe("isSessionExpired (spec N Q1)", () => {
  const nowS = 1_900_000_000
  it("hằng đúng giây: 30 ngày, 8 giờ", () => {
    expect(REMEMBER_MAX_AGE_S).toBe(30 * 24 * 60 * 60)
    expect(SHORT_IDLE_S).toBe(8 * 60 * 60)
  })
  it("ghi nhớ: không cắt theo 8h (JWT exp 30 ngày lo)", () => {
    expect(isSessionExpired({ remember: true, iat: nowS - 29 * 24 * 3600, nowS })).toBe(false)
  })
  it("không ghi nhớ: 7h59m còn, 8h01m hết", () => {
    expect(isSessionExpired({ remember: false, iat: nowS - (8 * 3600 - 60), nowS })).toBe(false)
    expect(isSessionExpired({ remember: false, iat: nowS - (8 * 3600 + 60), nowS })).toBe(true)
  })
  it("chưa có iat (vừa đăng nhập) → không hết", () => {
    expect(isSessionExpired({ remember: false, iat: undefined, nowS })).toBe(false)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/session-policy.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/session-policy"`.

- [ ] **Step 4: Tạo `src/lib/session-policy.ts`**

```ts
// Luật phiên dùng chung cho middleware Edge và auth() Node: chỉ TS thuần, không import gì.
export const REMEMBER_MAX_AGE_S = 30 * 24 * 60 * 60
export const SHORT_IDLE_S = 8 * 60 * 60

// "0.3.1" → "0.3": chỉ nâng minor/major mới ép đăng nhập lại (spec N N2).
export function epochOf(version: string): string {
  const m = /^(\d+)\.(\d+)/.exec(version)
  return m ? `${m[1]}.${m[2]}` : version
}

// Phải viết nguyên `process.env.NEXT_PUBLIC_APP_VERSION` để Next inline lúc build (kể cả bundle Edge);
// đọc trong thân hàm để unit test đổi env được.
export function currentEpoch(): string {
  return epochOf(process.env.NEXT_PUBLIC_APP_VERSION || "0.0")
}

// Phiên không ghi nhớ hết khi quá 8h kể từ lần ký lại gần nhất (thư viện ký lại token mỗi request qua middleware).
export function isSessionExpired(p: { remember: boolean; iat: number | undefined; nowS: number }): boolean {
  if (p.remember || p.iat === undefined) return false
  return p.nowS - p.iat > SHORT_IDLE_S
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/session-policy.test.ts`
Expected: PASS 8 test.

- [ ] **Step 6: Viết test migration (RED)**

Tạo `tests/integration/session-migration.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

// Đọc đúng SQL sẽ chạy trên production khi Vercel build.
function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_add_session_version_password_reset"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

describe("Migration add_session_version_password_reset (spec N mục 9, R2, R3)", () => {
  it("chỉ thêm cột có mặc định + tạo bảng/index, không đụng dữ liệu cũ", () => {
    const sql = migrationSql()
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME)\b/i)
    for (const stmt of sql.match(/ALTER TABLE[^;]*/g) ?? []) {
      expect(stmt).toMatch(/^ALTER TABLE "users" ADD COLUMN/)
    }
    expect(sql).toMatch(/"session_version" INTEGER NOT NULL DEFAULT 0/)
    expect(sql).toMatch(/"must_change_password" BOOLEAN NOT NULL DEFAULT false/)
    expect(sql).toContain('CREATE TABLE "password_reset_logs"')
  })

  it("DB test đã áp: user seed có sessionVersion 0, mustChangePassword false; bảng log đọc được", async () => {
    const t = await db.user.findUniqueOrThrow({
      where: { username: "teacher" },
      select: { sessionVersion: true, mustChangePassword: true },
    })
    expect(t).toEqual({ sessionVersion: 0, mustChangePassword: false })
    expect(await db.passwordResetLog.count()).toBeGreaterThanOrEqual(0)
  })
})
```

Run: `pnpm test tests/integration/session-migration.test.ts`
Expected: FAIL — `expected [] to have a length of 1` (chưa có thư mục migration). `tsc` lúc này cũng báo `sessionVersion`/`passwordResetLog` chưa có (chưa generate) — bình thường ở bước RED.

- [ ] **Step 7: Sửa `prisma/schema.prisma`**

Trong model `User`, ngay trước khối quan hệ (dòng `loginAttempts LoginAttempt[]`; đối chiếu code thật, L/M có thể đã thêm dòng quanh đó), thêm:
```prisma
  // Tăng khi đổi/reset mật khẩu → mọi JWT mang số cũ hết hiệu lực (spec N Q10).
  sessionVersion     Int               @default(0) @map("session_version")
  mustChangePassword Boolean           @default(false) @map("must_change_password")
```
Thêm cuối file:
```prisma
// Nhật ký admin reset mật khẩu (spec N R3), không lưu mật khẩu. Không FK: tests/setup.ts xóa users mỗi lượt.
model PasswordResetLog {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  resetBy   String   @map("reset_by") @db.VarChar(50)
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@map("password_reset_logs")
}
```

- [ ] **Step 8: Sinh migration trên DB test (Bash, không kết nối DB prod)**

```bash
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  case "$DIRECT_URL" in *localhost:5433*) ;; *) echo "DỪNG: DIRECT_URL không phải DB test"; exit 1;; esac
  pnpm exec prisma migrate dev --create-only --name add_session_version_password_reset
)
ls prisma/migrations | grep _add_session_version_password_reset
cat prisma/migrations/*_add_session_version_password_reset/migration.sql
```
Expected: in `Datasource "db": PostgreSQL database "…" … at "localhost:5433"` và `Prisma Migrate created the following migration without applying it …_add_session_version_password_reset`. Timestamp thư mục mới lớn hơn mọi migration của L/M. SQL chỉ gồm (thứ tự cột/khoảng trắng có thể khác):
```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "password_reset_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reset_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_logs_user_id_created_at_idx" ON "password_reset_logs"("user_id", "created_at");
```
DỪNG ngay, báo người dùng, KHÔNG đồng ý đề nghị nào nếu: Prisma báo drift / "We need to reset" / hỏi xác nhận; SQL có `DROP`, bảng khác, hoặc sửa cột khác (nghĩa là DB test lệch migration của L/M). Riêng khi lỗi chỉ vì không tạo được shadow database (thiếu quyền `CREATEDB`) hoặc báo môi trường "non-interactive": xóa thư mục migration rỗng (nếu có) rồi sinh SQL không cần kết nối DB:
```bash
mkdir -p .superpowers
git show main:prisma/schema.prisma > .superpowers/n-schema-before.prisma
ts=$(date -u +%Y%m%d%H%M%S); mkdir -p "prisma/migrations/${ts}_add_session_version_password_reset"
pnpm exec prisma migrate diff --from-schema-datamodel .superpowers/n-schema-before.prisma --to-schema-datamodel prisma/schema.prisma --script > "prisma/migrations/${ts}_add_session_version_password_reset/migration.sql"
rm .superpowers/n-schema-before.prisma
cat prisma/migrations/*_add_session_version_password_reset/migration.sql
```
(cùng Expected SQL; chạy trong Bash, không PowerShell vì `>` của PowerShell ghi UTF-16.)

Run (Bash): `file prisma/migrations/*_add_session_version_password_reset/migration.sql`
Expected: `ASCII text` hoặc `UTF-8 Unicode text`, không `UTF-16`, không `with BOM`.

- [ ] **Step 9: Áp migration lên DB test + generate client**

```bash
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  case "$DIRECT_URL" in *localhost:5433*) ;; *) echo "DỪNG: DIRECT_URL không phải DB test"; exit 1;; esac
  pnpm exec prisma migrate deploy
)
pnpm exec prisma generate
```
Expected: `Datasource "db": … at "localhost:5433"`, `Applying migration …_add_session_version_password_reset`, `All migrations have been successfully applied.`; `Generated Prisma Client`. `prisma generate` lỗi `EPERM … query_engine` (Windows khóa file vì tiến trình node khác) → báo người dùng đóng tiến trình đó, không tự kill.

- [ ] **Step 10: Chạy test migration, xác nhận pass**

Run: `pnpm test tests/integration/session-migration.test.ts`
Expected: PASS 2 test.

- [ ] **Step 11: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: sạch.

```bash
git add prisma/schema.prisma prisma/migrations/*_add_session_version_password_reset/migration.sql src/lib/session-policy.ts tests/unit/lib/session-policy.test.ts tests/integration/session-migration.test.ts
git commit -m "feat(n): luật phiên thuần (30 ngày, 8h, epoch major.minor) + migration users.session_version, must_change_password, password_reset_logs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Luật Edge (30 ngày / 8h / epoch, thông báo hết phiên) + checkbox "Ghi nhớ đăng nhập"

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 3, 4, 6, 10; Review Focus 2, 4, 5; spec mục 1, 4 (Q1–Q8), 6.2, 6.3 (đoạn `credentials`/`authorize`), 6.4, 6.5, 7 (Unit `auth-jwt`, `auth-authorized`, E2E phần ghi nhớ/epoch); `src/server/auth.config.ts`; `src/server/auth.ts`; `src/app/login/actions.ts`, `LoginForm.tsx`, `page.tsx`; `src/components/ui/checkbox.tsx`; `tests/unit/auth-authorized.test.ts`; `tests/e2e/auth.spec.ts`; `node_modules/.pnpm/@auth+core@0.41.3/node_modules/@auth/core/lib/actions/session.js` (callback `jwt` trả `null` → xóa cookie; ký lại token mỗi request).

**Files:**
- Modify: `src/server/auth.config.ts`, `src/server/auth.ts`, `src/app/login/actions.ts`, `src/app/login/LoginForm.tsx`, `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/auth-jwt.test.ts`, `tests/unit/components/LoginForm.test.tsx`
- Test (Sửa): `tests/unit/auth-authorized.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes (Task 1): `REMEMBER_MAX_AGE_S`, `currentEpoch()`, `isSessionExpired()` từ `@/lib/session-policy`.
- Produces:
  - `src/server/auth.config.ts`: `export type AppJWT = { userId?: string; username?: string; fullName?: string | null; remember?: boolean; epoch?: string; sessionVersion?: number; mustChangePassword?: boolean }`; module augmentation `next-auth`: `Session.user` thêm `remember?: boolean; mustChangePassword?: boolean`, `User` thêm `remember?: boolean; sessionVersion?: number; mustChangePassword?: boolean`; `authConfig.session.maxAge = REMEMBER_MAX_AGE_S`; callback `jwt` nhánh có `user` chép `remember` (`=== true`), `sessionVersion`, `mustChangePassword` (`=== true`), `epoch = currentEpoch()`; nhánh không `user` trả `null` khi lệch epoch / quá 8h.
  - Form `/login` gửi field `remember` = `"on"` khi tick; `loginAction` truyền `remember: "1" | "0"` vào `signIn`; `authorize` trả `remember: credentials?.remember === "1"`.
  - Key i18n: `remember_me`, `session_expired_relogin`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Viết unit test callback `jwt` (RED)**

Tạo `tests/unit/auth-jwt.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { authConfig } from "@/server/auth.config"

type P = Parameters<typeof authConfig.callbacks.jwt>[0]
const jwt = (token: Record<string, unknown>, user?: Record<string, unknown>) =>
  authConfig.callbacks.jwt({ token, user } as unknown as P)
const nowS = () => Math.floor(Date.now() / 1000)
const base = (over: Record<string, unknown> = {}) => ({
  userId: "1",
  username: "teacher",
  fullName: null,
  remember: false,
  epoch: "0.2",
  sessionVersion: 0,
  iat: nowS() - 60,
  ...over,
})

const original = process.env.NEXT_PUBLIC_APP_VERSION
beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_VERSION = "0.2.1"
})
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION
  else process.env.NEXT_PUBLIC_APP_VERSION = original
})

describe("authConfig.callbacks.jwt (spec N Q1, Q4, Q6)", () => {
  it("vừa đăng nhập có tick → remember true, epoch hiện tại, chép sessionVersion/mustChangePassword", async () => {
    const t = await jwt({}, { id: "1", username: "teacher", fullName: null, remember: true, sessionVersion: 3, mustChangePassword: true })
    expect(t).toMatchObject({ userId: "1", username: "teacher", remember: true, epoch: "0.2", sessionVersion: 3, mustChangePassword: true })
  })

  it("nhánh đăng nhập không bị luật epoch/8h chặn; remember vắng → false", async () => {
    const t = await jwt({ epoch: "0.0-old", iat: nowS() - 99_999 }, { id: "1", username: "teacher", fullName: null })
    expect(t).toMatchObject({ remember: false, epoch: "0.2", mustChangePassword: false })
  })

  it("lệch minor → null; chỉ lệch patch → giữ phiên", async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "0.3.0"
    expect(await jwt(base())).toBeNull()
    process.env.NEXT_PUBLIC_APP_VERSION = "0.2.5"
    expect(await jwt(base())).toMatchObject({ userId: "1" })
  })

  it("token cũ thiếu epoch (phát hành trước N) → null", async () => {
    const old = base()
    delete (old as Record<string, unknown>).epoch
    expect(await jwt(old)).toBeNull()
  })

  it("không ghi nhớ: 9h không hoạt động → null, 1h → giữ; ghi nhớ: 9h → giữ", async () => {
    expect(await jwt(base({ iat: nowS() - 9 * 3600 }))).toBeNull()
    expect(await jwt(base({ iat: nowS() - 3600 }))).toMatchObject({ userId: "1" })
    expect(await jwt(base({ remember: true, iat: nowS() - 9 * 3600 }))).toMatchObject({ userId: "1" })
  })

  it("remember là chuỗi (token bị sửa tay) không được coi là ghi nhớ", async () => {
    expect(await jwt(base({ remember: "0", iat: nowS() - 9 * 3600 }))).toBeNull()
  })
})

describe("authConfig.session.maxAge", () => {
  it("trần chung 30 ngày", () => {
    expect(authConfig.session.maxAge).toBe(30 * 24 * 60 * 60)
  })
})
```

- [ ] **Step 3: Sửa `tests/unit/auth-authorized.test.ts` (RED)**

Thay hàm `call` bằng bản có cookie giả (các ca cũ vẫn gọi `call(auth, path)` như trước):
```ts
function call(auth: unknown, path = "/dashboard", cookieNames: string[] = []) {
  const request = {
    nextUrl: new URL(path, "http://localhost:3000"),
    cookies: { getAll: () => cookieNames.map((name) => ({ name, value: "x" })) },
  }
  return authorized({ auth, request } as unknown as Parameters<typeof authorized>[0])
}
```
Thêm vào cuối `describe("authConfig.callbacks.authorized", …)`:
```ts
  it("không có user nhưng còn cookie phiên (hết hạn / lệch phiên bản) → 302 /login kèm callbackUrl + expired=1", () => {
    for (const name of ["authjs.session-token", "__Secure-authjs.session-token", "authjs.session-token.0"]) {
      const res = call(null, "/students?x=1", [name])
      expect(res, name).toBeInstanceOf(Response)
      expect((res as Response).status, name).toBe(302)
      const loc = new URL((res as Response).headers.get("location")!)
      expect(loc.pathname).toBe("/login")
      expect(loc.searchParams.get("callbackUrl")).toBe("http://localhost:3000/students?x=1")
      expect(loc.searchParams.get("expired")).toBe("1")
    }
  })

  it("không có user, không cookie phiên (chỉ cookie khác) → false để thư viện tự về /login", () => {
    expect(call(null, "/dashboard", ["authjs.csrf-token", "lang"])).toBe(false)
  })

  it("auth là object lỗi + còn cookie → vẫn chặn (redirect), không cho qua", () => {
    const res = call({ error: "Configuration" }, "/dashboard", ["authjs.session-token"])
    expect(res).toBeInstanceOf(Response)
  })
```

- [ ] **Step 4: Chạy 2 file test, xác nhận fail**

Run: `pnpm test tests/unit/auth-jwt.test.ts` rồi `pnpm test tests/unit/auth-authorized.test.ts`
Expected: `auth-jwt` FAIL (vd `expected { … } to match object { remember: true, epoch: "0.2" … }`, `expected { … } to be null`, maxAge `28800` ≠ `2592000`); `auth-authorized` FAIL ở 2 ca cookie (nhận `false` thay vì `Response`), các ca cũ PASS.

- [ ] **Step 5: Sửa `src/server/auth.config.ts`**

Đối chiếu code thật trước (L/M không dự kiến đụng file này). Thay toàn bộ file bằng:
```ts
// Edge-safe NextAuth config — chạy được trong Next.js middleware.
// KHÔNG import gì kéo theo native module (bcrypt, prisma, ...).
// File `auth.ts` extend config này thêm Credentials provider cho route handler Node.
import type { NextAuthConfig, DefaultSession } from "next-auth"
import { isAdminUsername } from "@/lib/admin"
import { REMEMBER_MAX_AGE_S, currentEpoch, isSessionExpired } from "@/lib/session-policy"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      fullName: string | null
      remember?: boolean
      mustChangePassword?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    username: string
    fullName: string | null
    remember?: boolean
    sessionVersion?: number
    mustChangePassword?: boolean
  }
}

export type AppJWT = {
  userId?: string
  username?: string
  fullName?: string | null
  remember?: boolean
  epoch?: string
  sessionVersion?: number
  mustChangePassword?: boolean
}

export const authConfig = {
  // Thư viện chỉ có 1 maxAge cho cả JWT lẫn cookie → đặt trần 30 ngày, phiên không ghi nhớ cắt 8h ở callback jwt (spec N Q1).
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE_S },
  pages: { signIn: "/login" },
  // Edge runtime: chưa khai báo provider — sẽ bổ sung ở `auth.ts` (Node).
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      // Phải kiểm tới `user`: khi cấu hình lỗi, `auth` là object chứa error nên
      // vẫn truthy (GHSA-8fpg-xm3f-6cx3) → `!!auth` sẽ cho qua.
      if (!auth?.user) {
        // Còn cookie phiên mà không có user = hết hạn hoặc lệch phiên bản → /login báo nhẹ (spec N Q7).
        // includes: bắt cả tiền tố __Secure- và cookie chia mảnh .0/.1.
        const hadSession = request.cookies.getAll().some((c) => c.name.includes("authjs.session-token"))
        if (!hadSession) return false
        const url = new URL("/login", request.nextUrl.origin)
        url.searchParams.set("callbackUrl", request.nextUrl.href)
        url.searchParams.set("expired", "1")
        return Response.redirect(url)
      }
      // J1: admin chỉ dùng khu quản trị. So chặt để "/administration" không bị coi là khu quản trị.
      const { pathname } = request.nextUrl
      const inAdminArea = pathname === "/admin" || pathname.startsWith("/admin/")
      if (isAdminUsername(auth.user.username) && !inAdminArea) {
        return Response.redirect(new URL("/admin/orders", request.nextUrl.origin))
      }
      return true
    },
    async jwt({ token, user }) {
      const t = token as typeof token & AppJWT
      if (user) {
        t.userId = user.id
        t.username = (user as { username: string }).username
        t.fullName = (user as { fullName: string | null }).fullName
        t.remember = user.remember === true
        t.sessionVersion = user.sessionVersion
        t.mustChangePassword = user.mustChangePassword === true
        t.epoch = currentEpoch()
        return t
      }
      // Trả null: middleware xóa cookie, auth() trả null. Token cũ không có epoch cũng rơi vào đây (spec N Q6).
      if (t.epoch !== currentEpoch()) return null
      const iat = typeof t.iat === "number" ? t.iat : undefined
      if (isSessionExpired({ remember: t.remember === true, iat, nowS: Math.floor(Date.now() / 1000) })) return null
      return t
    },
    async session({ session, token }) {
      const t = token as typeof token & AppJWT
      session.user.id = t.userId ?? ""
      session.user.username = t.username ?? ""
      session.user.fullName = t.fullName ?? null
      session.user.remember = t.remember === true
      session.user.mustChangePassword = t.mustChangePassword === true
      return session
    },
  },
} satisfies NextAuthConfig
```
Nếu `tsc` báo kiểu trả của `jwt` (`null` không gán được): kiểu thư viện là `Awaitable<JWT | null>` (`@auth/core/index.d.ts` dòng ~331) nên phải qua; lỗi khác → ghi Ruling, giữ hành vi.

- [ ] **Step 6: Chạy 2 file test, xác nhận pass**

Run: `pnpm test tests/unit/auth-jwt.test.ts` rồi `pnpm test tests/unit/auth-authorized.test.ts`
Expected: PASS toàn bộ (auth-jwt 7 test; auth-authorized 6 ca cũ + 3 ca mới).

- [ ] **Step 7: Viết unit test `LoginForm` (RED)**

Tạo `tests/unit/components/LoginForm.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const mocks = vi.hoisted(() => ({
  query: new URLSearchParams(),
  loginAction: vi.fn(async (_fd: FormData) => ({ ok: false as const, error: "INVALID_CREDENTIALS" as const })),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => mocks.query,
}))
vi.mock("@/app/login/actions", () => ({ loginAction: mocks.loginAction }))

import { LoginForm } from "@/app/login/LoginForm"

const REMEMBER = "Ghi nhớ đăng nhập (30 ngày)"
const EXPIRED = "Phiên đăng nhập đã hết hoặc có phiên bản mới. Vui lòng đăng nhập lại."

function renderForm(query = "") {
  mocks.query = new URLSearchParams(query)
  const view = render(
    <LanguageProvider forcedLanguage="vi">
      <LoginForm />
    </LanguageProvider>
  )
  fireEvent.change(view.container.querySelector('input[name="username"]')!, { target: { value: "teacher" } })
  fireEvent.change(view.container.querySelector('input[name="password"]')!, { target: { value: "teacher123" } })
  return view
}

beforeEach(() => {
  mocks.loginAction.mockClear()
})

describe("LoginForm — ghi nhớ đăng nhập (spec N 6.4)", () => {
  it("mặc định không tick; bấm vào chữ thì tick", () => {
    renderForm()
    const box = screen.getByRole("checkbox", { name: REMEMBER })
    expect(box.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(screen.getByText(REMEMBER))
    expect(box.getAttribute("aria-checked")).toBe("true")
  })

  it("tick → form gửi remember=on; không tick → không có remember", async () => {
    renderForm()
    fireEvent.click(screen.getByText(REMEMBER))
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
    await waitFor(() => expect(mocks.loginAction).toHaveBeenCalledTimes(1))
    expect(mocks.loginAction.mock.calls[0][0].get("remember")).toBe("on")

    mocks.loginAction.mockClear()
    fireEvent.click(screen.getByText(REMEMBER))
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
    await waitFor(() => expect(mocks.loginAction).toHaveBeenCalledTimes(1))
    expect(mocks.loginAction.mock.calls[0][0].get("remember")).toBeNull()
  })

  it("dòng checkbox cao ≥44px (min-h-11)", () => {
    renderForm()
    expect(screen.getByText(REMEMBER).closest("label")!.className).toContain("min-h-11")
  })
})

describe("LoginForm — thông báo hết phiên (spec N Q7)", () => {
  it("expired=1 → hộp role=status nền slate; không có thì không hiện", () => {
    renderForm("expired=1")
    const box = screen.getByRole("status")
    expect(box.textContent).toBe(EXPIRED)
    expect(box.className).toContain("bg-slate-50")
    expect(box.className).not.toMatch(/red/)
  })

  it("không có expired → không hiện", () => {
    renderForm("callbackUrl=%2Fstudents")
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("có lỗi đăng nhập → chỉ hiện lỗi, ẩn thông báo hết phiên", async () => {
    renderForm("expired=1")
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))
    await screen.findByRole("alert")
    expect(screen.queryByRole("status")).toBeNull()
  })
})
```

Run: `pnpm test tests/unit/components/LoginForm.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "checkbox" and name "Ghi nhớ đăng nhập (30 ngày)"` (và các ca thông báo).

- [ ] **Step 8: Thêm key i18n**

`src/language/vi.json`: ngay sau dòng `"logging_in": "Đang đăng nhập...",` thêm:
```json
  "remember_me": "Ghi nhớ đăng nhập (30 ngày)",
  "session_expired_relogin": "Phiên đăng nhập đã hết hoặc có phiên bản mới. Vui lòng đăng nhập lại.",
```
`src/language/en.json`: ngay sau dòng `"logging_in": "Logging in...",` thêm:
```json
  "remember_me": "Remember me (30 days)",
  "session_expired_relogin": "Your session has ended or a new version is available. Please sign in again.",
```

- [ ] **Step 9: Sửa `src/app/login/LoginForm.tsx`**

- Thêm import: `import { Checkbox } from "@/components/ui/checkbox"` (dưới import `PasswordInput`).
- Dưới dòng `const callbackUrl = …` thêm:
```tsx
  // Middleware/layout gắn expired=1 khi còn cookie mà phiên không hợp lệ (spec N Q7).
  const expired = searchParams.get("expired") === "1"
```
- Ngay sau thẻ mở `<form action={handleSubmit} className="space-y-4">` thêm:
```tsx
      {expired && !error && (
        <div
          role="status"
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        >
          {t("session_expired_relogin")}
        </div>
      )}
```
- Giữa khối ô mật khẩu (`</div>` đóng `space-y-2` của `password`) và `{error && (`, thêm:
```tsx
      {/* Mặc định không tick, không nhớ lựa chọn cũ: an toàn cho máy dùng chung (spec N 6.4). */}
      <label htmlFor="remember" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <Checkbox id="remember" name="remember" disabled={isPending} className="h-5 w-5" />
        <span>{t("remember_me")}</span>
      </label>
```

- [ ] **Step 10: Sửa `src/app/login/actions.ts` và `src/server/auth.ts`**

`actions.ts`: dưới dòng `const password = String(formData.get("password") ?? "")` thêm:
```ts
  // Radix Checkbox gửi "on" khi tick; signIn chỉ chuyển được chuỗi nên đổi sang "1"/"0" (spec N Q3).
  const remember = formData.get("remember") === "on"
```
và trong `signIn("credentials", { … })` thêm dòng `remember: remember ? "1" : "0",` ngay sau `password,`.

`auth.ts`: trong `credentials` thêm dòng sau `password: …`:
```ts
        remember: { label: "Remember", type: "text" },
```
và đổi dòng return cuối của `authorize` thành:
```ts
        return { id: user.id, username: user.username, fullName: user.fullName, remember: credentials?.remember === "1" }
```

- [ ] **Step 11: Chạy test `LoginForm`, xác nhận pass**

Run: `pnpm test tests/unit/components/LoginForm.test.tsx`
Expected: PASS 6 test.

Nếu riêng ca "tick → form gửi remember=on" đỏ vì `get("remember")` là `null` (input ẩn của Radix không vào FormData): chuyển checkbox sang có kiểm soát — thêm `const [remember, setRemember] = useState(false)`, `<Checkbox … checked={remember} onCheckedChange={(v) => setRemember(v === true)} />` (bỏ `name`), và đầu `handleSubmit` thêm `if (remember) formData.set("remember", "on")`. Ghi Ruling.

- [ ] **Step 12: Bổ sung e2e `tests/e2e/auth.spec.ts`**

Sửa dòng import đầu file thành:
```ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { decode, encode } from 'next-auth/jwt';
```
Ngay dưới khối import thêm:
```ts
// http://localhost nên cookie không có tiền tố __Secure-; salt mã hóa JWT = tên cookie.
const COOKIE = 'authjs.session-token';
const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';
const REMEMBER = 'Ghi nhớ đăng nhập (30 ngày)';

async function loginForm(page: Page, remember: boolean) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  if (remember) await page.getByText(REMEMBER).click();
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

async function sessionPayload(context: BrowserContext) {
  const c = (await context.cookies()).find((x) => x.name === COOKIE);
  expect(c, 'thiếu cookie phiên').toBeTruthy();
  const payload = await decode({ token: c!.value, secret: SECRET, salt: COOKIE });
  expect(payload, 'không giải mã được cookie phiên').toBeTruthy();
  return { cookie: c!, payload: payload! };
}
```
Trong test `logout successfully`, thêm cuối test (sau `await expect(page).toHaveURL(/.*login/);`):
```ts
  // Đăng xuất đã xóa cookie → không hiện thông báo "hết phiên" (spec N 6.5).
  await expect(page.locator('form').getByRole('status')).toHaveCount(0);
```
Thêm cuối file:
```ts
test('checkbox ghi nhớ mặc định không tick, bấm vào chữ thì tick', async ({ page }) => {
  await page.goto('/login');
  const box = page.getByRole('checkbox', { name: REMEMBER });
  await expect(box).not.toBeChecked();
  await page.getByText(REMEMBER).click();
  await expect(box).toBeChecked();
});

test('tick ghi nhớ → cookie hết hạn ~30 ngày, token remember=true, epoch khớp package.json', async ({ page, context }) => {
  await loginForm(page, true);
  const { cookie, payload } = await sessionPayload(context);
  expect(Math.abs(cookie.expires - (Date.now() / 1000 + 30 * 24 * 3600))).toBeLessThan(3600);
  expect(payload.remember).toBe(true);
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
  expect(payload.epoch).toBe(version.split('.').slice(0, 2).join('.'));
});

test('không tick → token remember=false (cắt 8h đã phủ ở unit auth-jwt)', async ({ page, context }) => {
  await loginForm(page, false);
  const { payload } = await sessionPayload(context);
  expect(payload.remember).toBe(false);
});

test('token lệch epoch → về /login?expired=1, thấy thông báo, cookie bị xóa', async ({ page, context }) => {
  await loginForm(page, false);
  const { payload } = await sessionPayload(context);
  const forged = await encode({ token: { ...payload, epoch: '0.0-old' }, secret: SECRET, salt: COOKIE });
  await context.addCookies([{ name: COOKIE, value: forged, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/students');
  await expect(page).toHaveURL(/\/login\?.*expired=1/);
  await expect(page.locator('form').getByRole('status')).toHaveText(
    'Phiên đăng nhập đã hết hoặc có phiên bản mới. Vui lòng đăng nhập lại.'
  );
  expect((await context.cookies()).find((x) => x.name === COOKIE)).toBeUndefined();
});
```
Nếu Playwright báo không import được `next-auth/jwt` (ESM): đổi thành `const { decode, encode } = await import('next-auth/jwt')` trong từng hàm dùng; ghi Ruling.

- [ ] **Step 13: Chạy e2e auth**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/auth.spec.ts
```
Expected: 7 passed (3 test cũ + 4 test mới). Ca lệch epoch đỏ vì URL `/login?callbackUrl=…` không có `expired=1` → kiểm lại nhánh cookie trong `authorized` (tên cookie thật in bằng `console.log((await context.cookies()).map(c => c.name))`).

- [ ] **Step 14: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: sạch.

```bash
git add src/server/auth.config.ts src/server/auth.ts src/app/login/actions.ts src/app/login/LoginForm.tsx src/language/vi.json src/language/en.json tests/unit/auth-jwt.test.ts tests/unit/auth-authorized.test.ts tests/unit/components/LoginForm.test.tsx tests/e2e/auth.spec.ts
git commit -m "feat(n): ghi nhớ đăng nhập 30 ngày, phiên thường trượt 8h, ép đăng nhập lại khi lệch major.minor, báo hết phiên ở /login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Kiểm phiên ở Node (isActive + sessionVersion), layout đẩy về /login?expired=1

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 2, 3; Review Focus 2; spec mục 4 (Q10–Q14), 6.3, 6.3b, 7 (Integration `session-validity`, `auth.test`); `src/server/auth-credentials.ts`; `src/server/auth.ts`; `src/server/auth.config.ts` (Task 2: `AppJWT`, callback `jwt`); `src/app/(app)/layout.tsx`; `src/app/(admin)/admin/layout.tsx`; `tests/unit/layout/admin-redirect.test.ts`; `tests/integration/auth.test.ts` (khối `Auth — authorizeCredentials`).

**Files:**
- Modify: `src/server/auth-credentials.ts`, `src/server/auth.ts`, `src/app/(app)/layout.tsx`, `src/app/(admin)/admin/layout.tsx`
- Create: `src/server/auth-node-callbacks.ts`
- Test (Mới): `tests/integration/session-validity.test.ts`
- Test (Sửa): `tests/integration/auth.test.ts`, `tests/unit/layout/admin-redirect.test.ts`

**Interfaces:**
- Consumes: Task 1 cột `User.sessionVersion`, `User.mustChangePassword`; Task 2 `authConfig.callbacks.jwt`, `type AppJWT` (export từ `@/server/auth.config`), `currentEpoch()`.
- Produces:
  - `src/server/auth-credentials.ts`: `type AuthorizedUser = { id: string; username: string; fullName: string | null; sessionVersion: number; mustChangePassword: boolean }`; `getSessionUserState(userId: number, sessionVersion: number | undefined): Promise<{ mustChangePassword: boolean } | null>`.
  - `src/server/auth-node-callbacks.ts`: `nodeJwt(params: Parameters<typeof authConfig.callbacks.jwt>[0]): Promise<(JWT & AppJWT) | null>` — chạy luật Edge, rồi (nếu không phải nhánh đăng nhập) tra DB; ghi `t.mustChangePassword` bằng giá trị DB.
  - `auth.ts`: `callbacks: { ...authConfig.callbacks, jwt: nodeJwt }`; `authorize` trả thêm `sessionVersion`, `mustChangePassword`.
  - Layout `(app)` và `(admin)/admin`: `session?.user` rỗng → `redirect("/login?expired=1")` trước mọi logic khác.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Viết integration test (RED)**

Tạo `tests/integration/session-validity.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest"
import { db } from "@/server/db"
import { getSessionUserState } from "@/server/auth-credentials"
import { nodeJwt } from "@/server/auth-node-callbacks"
import { currentEpoch } from "@/lib/session-policy"

let teacherId = 0
beforeAll(async () => {
  teacherId = (await db.user.findUniqueOrThrow({ where: { username: "teacher" } })).id
})
afterEach(async () => {
  await db.user.update({ where: { id: teacherId }, data: { isActive: true, sessionVersion: 0, mustChangePassword: false } })
})

type P = Parameters<typeof nodeJwt>[0]
const token = (over: Record<string, unknown> = {}) => ({
  userId: String(teacherId),
  username: "teacher",
  fullName: null,
  remember: false,
  epoch: currentEpoch(),
  sessionVersion: 0,
  mustChangePassword: false,
  iat: Math.floor(Date.now() / 1000) - 60,
  ...over,
})
const call = (tok: Record<string, unknown>, user?: Record<string, unknown>) => nodeJwt({ token: tok, user } as unknown as P)

describe("getSessionUserState (spec N Q10–Q11)", () => {
  it("đúng sessionVersion + đang hoạt động → trả cờ mustChangePassword", async () => {
    expect(await getSessionUserState(teacherId, 0)).toEqual({ mustChangePassword: false })
    await db.user.update({ where: { id: teacherId }, data: { mustChangePassword: true } })
    expect(await getSessionUserState(teacherId, 0)).toEqual({ mustChangePassword: true })
  })

  it("lệch version / token thiếu version / bị khóa / id không tồn tại / id không phải số → null", async () => {
    expect(await getSessionUserState(teacherId, 1)).toBeNull()
    expect(await getSessionUserState(teacherId, undefined)).toBeNull()
    expect(await getSessionUserState(999_999, 0)).toBeNull()
    expect(await getSessionUserState(Number("abc"), 0)).toBeNull()
    await db.user.update({ where: { id: teacherId }, data: { isActive: false } })
    expect(await getSessionUserState(teacherId, 0)).toBeNull()
  })
})

describe("nodeJwt (spec N Q11)", () => {
  it("token hợp lệ → giữ phiên", async () => {
    expect(await call(token())).toMatchObject({ userId: String(teacherId) })
  })

  it("sessionVersion trong DB tăng (đổi/reset mật khẩu) → null", async () => {
    await db.user.update({ where: { id: teacherId }, data: { sessionVersion: { increment: 1 } } })
    expect(await call(token())).toBeNull()
  })

  it("tài khoản bị khóa → null", async () => {
    await db.user.update({ where: { id: teacherId }, data: { isActive: false } })
    expect(await call(token())).toBeNull()
  })

  it("token cũ thiếu sessionVersion → null", async () => {
    const old = token()
    delete (old as Record<string, unknown>).sessionVersion
    expect(await call(old)).toBeNull()
  })

  it("lệch epoch → null ngay ở luật Edge", async () => {
    expect(await call(token({ epoch: "0.0-old" }))).toBeNull()
  })

  it("cờ mustChangePassword lấy từ DB, không tin token", async () => {
    await db.user.update({ where: { id: teacherId }, data: { mustChangePassword: true } })
    expect(await call(token({ mustChangePassword: false }))).toMatchObject({ mustChangePassword: true })
  })

  it("nhánh vừa đăng nhập không tra DB; token mới mang version mới qua được lần gọi kế tiếp", async () => {
    await db.user.update({ where: { id: teacherId }, data: { sessionVersion: 1 } })
    const fresh = await call({}, { id: String(teacherId), username: "teacher", fullName: null, sessionVersion: 1 })
    expect(fresh).toMatchObject({ sessionVersion: 1 })
    expect(await call({ ...fresh!, iat: Math.floor(Date.now() / 1000) })).toMatchObject({ sessionVersion: 1 })
    expect(await call(token({ sessionVersion: 0 }))).toBeNull()
  })
})
```
Trong `tests/integration/auth.test.ts`, test đầu `"✓ Login đúng → trả user + …"`: ngay sau `expect(user!.username).toBe("teacher")` thêm:
```ts
    expect(user!.sessionVersion).toBe(0)
    expect(user!.mustChangePassword).toBe(false)
```

Run: `pnpm test tests/integration/session-validity.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/auth-node-callbacks"` (hoặc `getSessionUserState is not a function`).

- [ ] **Step 3: Sửa `src/server/auth-credentials.ts`**

Thay type `AuthorizedUser` bằng:
```ts
export type AuthorizedUser = {
  id: string
  username: string
  fullName: string | null
  sessionVersion: number
  mustChangePassword: boolean
}
```
Trong `authorizeCredentials`, khối `return { … }` cuối thêm 2 dòng:
```ts
    sessionVersion: user.sessionVersion,
    mustChangePassword: user.mustChangePassword,
```
Thêm cuối file:
```ts
/**
 * Chạy mỗi lần auth() phía Node (spec N Q11): phiên còn hiệu lực khi user còn hoạt động
 * và sessionVersion khớp token. Trả cờ mustChangePassword mới nhất để chặn R2.
 */
export async function getSessionUserState(
  userId: number,
  sessionVersion: number | undefined
): Promise<{ mustChangePassword: boolean } | null> {
  if (!Number.isInteger(userId) || userId <= 0 || sessionVersion === undefined) return null
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true, sessionVersion: true, mustChangePassword: true },
  })
  if (!u || !u.isActive || u.sessionVersion !== sessionVersion) return null
  return { mustChangePassword: u.mustChangePassword }
}
```

- [ ] **Step 4: Tạo `src/server/auth-node-callbacks.ts`**

```ts
// Tách khỏi auth.ts để integration test gọi được mà không kéo next-auth runtime.
import { authConfig } from "@/server/auth.config"
import { getSessionUserState } from "@/server/auth-credentials"

type JwtParams = Parameters<typeof authConfig.callbacks.jwt>[0]

// Middleware Edge không dùng được Prisma nên chỉ auth() Node kiểm DB (spec N Q11), không cache (Q12).
export async function nodeJwt(params: JwtParams) {
  const t = await authConfig.callbacks.jwt(params)
  // Vừa đăng nhập: authorize vừa đọc DB xong, khỏi tra lại.
  if (!t || params.user) return t
  const state = await getSessionUserState(Number(t.userId), t.sessionVersion)
  if (!state) return null
  // Lấy cờ từ DB: admin đặt cờ bằng tay (không tăng version) vẫn có hiệu lực ngay.
  t.mustChangePassword = state.mustChangePassword
  return t
}
```

- [ ] **Step 5: Sửa `src/server/auth.ts`**

- Thêm import `import { nodeJwt } from "@/server/auth-node-callbacks"`.
- Trong `NextAuth({ …authConfig, … })`, ngay sau `...authConfig,` thêm:
```ts
  callbacks: { ...authConfig.callbacks, jwt: nodeJwt },
```
- Đổi return cuối của `authorize` (Task 2 đã có `remember`) thành:
```ts
        return {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          sessionVersion: user.sessionVersion,
          mustChangePassword: user.mustChangePassword,
          remember: credentials?.remember === "1",
        }
```

- [ ] **Step 6: Chạy integration, xác nhận pass**

Run: `pnpm test tests/integration/session-validity.test.ts` rồi `pnpm test tests/integration/auth.test.ts`
Expected: PASS toàn bộ (session-validity 9 test; auth.test như cũ + 2 expect mới).

- [ ] **Step 7: Unit test layout (RED)**

Sửa `tests/unit/layout/admin-redirect.test.ts`:
- Khối `vi.hoisted` thêm `notFound: vi.fn(() => { throw new Error("NOT_FOUND") }),` (sau `redirect`), và đổi kiểu `session` thành `null as null | { user: { id: string; username: string; fullName: string | null; mustChangePassword?: boolean }; expires: string }`.
- Đổi `vi.mock("next/navigation", …)` thành `vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))`.
- Thêm `vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: unknown }) => children }))`.
- Thêm import `import AdminGroupLayout from "@/app/(admin)/admin/layout"` dưới import `AppGroupLayout`.
- Trong `beforeEach` thêm `mocks.notFound.mockClear()`.
- Thêm cuối file:
```ts
// Middleware Edge không tra DB: phiên bị đá (đổi mật khẩu, khóa) chỉ lộ ra ở layout (spec N Q13).
describe("layout khi auth() trả null", () => {
  it("(app) → /login?expired=1", async () => {
    mocks.session = null
    await expect(AppGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /login?expired=1")
  })

  it("(admin) → /login?expired=1, không phải 404", async () => {
    mocks.session = null
    await expect(AdminGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /login?expired=1")
    expect(mocks.notFound).not.toHaveBeenCalled()
  })

  it("(admin) giáo viên vẫn 404; admin render bình thường", async () => {
    mocks.session = as("teacher")
    await expect(AdminGroupLayout({ children: "x" })).rejects.toThrow("NOT_FOUND")
    mocks.session = as("admin_test")
    await expect(AdminGroupLayout({ children: "x" })).resolves.toBeTruthy()
  })
})
```

Run: `pnpm test tests/unit/layout/admin-redirect.test.ts`
Expected: FAIL — 2 ca `auth() trả null` (layout `(app)` không redirect; admin layout ném `NOT_FOUND`).

- [ ] **Step 8: Sửa 2 layout**

`src/app/(app)/layout.tsx`: thay 2 dòng sau `const session = await auth()` (comment "Lưới thứ 2 …" + `if (isAdminUsername(…)) redirect(…)`) bằng:
```tsx
  // Middleware Edge không tra DB: phiên bị đá (đổi mật khẩu, khóa tài khoản) chỉ lộ ra ở đây (spec N Q13).
  if (!session?.user) redirect("/login?expired=1")
  // Lưới thứ 2 nếu middleware bị bỏ qua: admin không dùng màn giáo viên (spec J Q3).
  if (isAdminUsername(session.user.username)) redirect("/admin/orders")
```
`src/app/(admin)/admin/layout.tsx`: import đổi thành `import { notFound, redirect } from "next/navigation"`; ngay sau `const session = await auth()` thêm:
```tsx
  // Chưa đăng nhập vào /admin vốn đã bị middleware đẩy về /login nên redirect ở đây không lộ khu quản trị.
  if (!session?.user) redirect("/login?expired=1")
```
và đổi dòng kiểm admin thành `if (!isAdminUsername(session.user.username)) notFound()` (giữ comment 404 sẵn có).

- [ ] **Step 9: Chạy test layout + e2e auth**

Run:
```bash
pnpm test tests/unit/layout/admin-redirect.test.ts
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/auth.spec.ts tests/e2e/admin.spec.ts
```
Expected: unit PASS; e2e tất cả passed (đăng nhập thật đi qua `nodeJwt` + tra DB; admin vẫn vào `/admin/orders`, giáo viên vào `/admin` vẫn 404).

- [ ] **Step 10: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: sạch.

```bash
git add src/server/auth-credentials.ts src/server/auth-node-callbacks.ts src/server/auth.ts "src/app/(app)/layout.tsx" "src/app/(admin)/admin/layout.tsx" tests/integration/session-validity.test.ts tests/integration/auth.test.ts tests/unit/layout/admin-redirect.test.ts
git commit -m "feat(n): auth() phía Node kiểm isActive + sessionVersion mỗi request, layout đẩy phiên bị đá về /login?expired=1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: Đổi mật khẩu qua server action (máy đang đổi giữ đăng nhập, máy khác bị đá)

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 6, 7, 8, 9; Review Focus 1; spec mục 4 (Q15, Q16), 6.3c, 6.5 (dòng Đổi mật khẩu), 7 (Integration `auth.test`, E2E đổi mật khẩu), mục "Bổ sung" R2 (câu "Mật khẩu mới phải khác mật khẩu tạm", "Đổi thành công → `mustChangePassword = false`"); `src/server/trpc/routers/auth.ts`; `src/server/services/user.service.ts`; `src/lib/schemas/auth.ts`; `src/components/layout/ChangePasswordDialog.tsx`, `AppHeader.tsx` (chỗ dùng dialog); `src/app/login/actions.ts` (mẫu server action + `AuthError`); `tests/integration/auth.test.ts` (khối `Auth router — me / changePassword`); `tests/unit/components/AppHeader.test.tsx` (đã mock `ChangePasswordDialog`, không cần sửa).

**Files:**
- Modify: `src/lib/schemas/auth.ts`, `src/server/services/user.service.ts`, `src/server/trpc/routers/auth.ts`, `src/components/layout/ChangePasswordDialog.tsx`
- Create: `src/app/actions/change-password.ts`, `src/components/layout/ChangePasswordForm.tsx`
- Test (Mới): `tests/unit/schemas/auth.schema.test.ts`, `tests/unit/change-password-action.test.ts`, `tests/unit/components/ChangePasswordForm.test.tsx`
- Test (Sửa): `tests/integration/auth.test.ts`, `tests/integration/session-validity.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: Task 2 `Session.user.remember?`, `COOKIE`/`SECRET`/`loginForm`/`sessionPayload` trong `tests/e2e/auth.spec.ts`; Task 3 `nodeJwt`, `authorizeCredentials` trả `sessionVersion`/`mustChangePassword`.
- Produces:
  - `src/lib/schemas/auth.ts`: `changePasswordSchema` thêm `.refine` (mới ≠ hiện tại, message `"Mật khẩu mới phải khác mật khẩu hiện tại"`, path `["newPassword"]`); `ChangePasswordInput` giữ nguyên kiểu `{ currentPassword: string; newPassword: string }`.
  - `src/server/services/user.service.ts`: `changeUserPassword(db: PrismaClient, userId: number, currentPassword: string, newPassword: string): Promise<void>` — sai mật khẩu cũ ném `TRPCError BAD_REQUEST "Mật khẩu hiện tại không đúng"`; 1 `update` ghi `passwordHash`, `mustChangePassword: false`, `sessionVersion: { increment: 1 }`.
  - `src/app/actions/change-password.ts` (`"use server"`): `type ChangePasswordResult = { ok: true; relogin?: true } | { ok: false; error: "UNAUTHORIZED" | "WRONG_CURRENT" | "INVALID"; message?: string }`; `changePasswordAction(input: ChangePasswordInput): Promise<ChangePasswordResult>`.
  - `src/components/layout/ChangePasswordForm.tsx`: `ChangePasswordForm({ onSuccess, onCancel }: { onSuccess: (relogin: boolean) => void; onCancel?: () => void })` — ô `#current-pw`, `#new-pw`, `#confirm-pw`, nút submit "Đổi mật khẩu", nút "Hủy" chỉ khi có `onCancel`.
  - tRPC `auth.changePassword` bị XÓA.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Unit test schema (RED)**

Tạo `tests/unit/schemas/auth.schema.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { changePasswordSchema } from "@/lib/schemas/auth"

const firstMessage = (input: unknown) => {
  const r = changePasswordSchema.safeParse(input)
  return r.success ? null : r.error.issues[0]?.message
}

describe("changePasswordSchema (spec N R2)", () => {
  it("hợp lệ khi mới ≥10 ký tự và khác hiện tại", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "teacher123", newPassword: "NewSecret@2026" }).success).toBe(true)
  })
  it("mới < 10 ký tự → thông báo độ dài", () => {
    expect(firstMessage({ currentPassword: "teacher123", newPassword: "short" })).toBe("Mật khẩu mới phải có ít nhất 10 ký tự")
  })
  it("mới trùng hiện tại (vd giữ nguyên mật khẩu tạm) → từ chối", () => {
    expect(firstMessage({ currentPassword: "Lich-7k2m-Qx9f", newPassword: "Lich-7k2m-Qx9f" })).toBe(
      "Mật khẩu mới phải khác mật khẩu hiện tại"
    )
  })
  it("bỏ field lạ (client không gửi được username)", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "teacher123", newPassword: "NewSecret@2026", username: "x" })
    expect(r.success && "username" in r.data).toBe(false)
  })
})
```
Run: `pnpm test tests/unit/schemas/auth.schema.test.ts`
Expected: FAIL ở ca "mới trùng hiện tại" (nhận `null`).

- [ ] **Step 3: Sửa `src/lib/schemas/auth.ts`**

Thay khối `changePasswordSchema` bằng:
```ts
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(10, "Mật khẩu mới phải có ít nhất 10 ký tự")
      .max(200),
  })
  // Spec N R2: không giữ lại mật khẩu tạm admin cấp làm mật khẩu mới.
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Mật khẩu mới phải khác mật khẩu hiện tại",
    path: ["newPassword"],
  })
```
Run: `pnpm test tests/unit/schemas/auth.schema.test.ts`
Expected: PASS 4 test.

- [ ] **Step 4: Integration `changeUserPassword` (RED)**

Trong `tests/integration/auth.test.ts`:
- Dòng import vitest thêm `afterEach`: `import { describe, it, expect, beforeEach, afterEach } from "vitest"`.
- Thêm import `import { changeUserPassword } from "@/server/services/user.service"`.
- Đổi tên describe `"Auth router — me / changePassword"` thành `"Auth router — me"` và XÓA 3 test `auth.changePassword …` trong đó (giữ 2 test `auth.me`).
- Thêm cuối file:
```ts
describe("changeUserPassword (spec N Q15–Q16, R2)", () => {
  afterEach(async () => {
    await db.user.update({
      where: { username: "teacher" },
      data: { passwordHash: await bcrypt.hash("teacher123", 4), sessionVersion: 0, mustChangePassword: false },
    })
    await db.loginAttempt.deleteMany()
  })

  it("✓ đúng mật khẩu cũ → pass mới đăng nhập được, pass cũ hết, sessionVersion +1, tắt mustChangePassword", async () => {
    const before = await db.user.update({ where: { username: "teacher" }, data: { mustChangePassword: true } })
    await changeUserPassword(db, before.id, "teacher123", "NewSecret@2026")
    const after = await db.user.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.sessionVersion).toBe(before.sessionVersion + 1)
    expect(after.mustChangePassword).toBe(false)
    await db.loginAttempt.deleteMany()
    expect(await authorizeCredentials("teacher", "teacher123", null)).toBeNull()
    expect(await authorizeCredentials("teacher", "NewSecret@2026", null)).toMatchObject({
      sessionVersion: before.sessionVersion + 1,
      mustChangePassword: false,
    })
  })

  it("✗ sai mật khẩu cũ → BAD_REQUEST, hash và sessionVersion giữ nguyên", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    await expect(changeUserPassword(db, before.id, "wrong-password", "AnotherSecret@2026")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Mật khẩu hiện tại không đúng",
    })
    const after = await db.user.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.passwordHash).toBe(before.passwordHash)
    expect(after.sessionVersion).toBe(before.sessionVersion)
  })
})
```
Trong `tests/integration/session-validity.test.ts`: thêm import `import bcrypt from "bcryptjs"` và `import { changeUserPassword } from "@/server/services/user.service"`; thêm vào cuối `describe("nodeJwt …")`:
```ts
  it("sau changeUserPassword → token cũ null", async () => {
    await changeUserPassword(db, teacherId, "teacher123", "NewSecret@2026")
    try {
      expect(await call(token())).toBeNull()
    } finally {
      await db.user.update({ where: { id: teacherId }, data: { passwordHash: await bcrypt.hash("teacher123", 4) } })
    }
  })
```
Run: `pnpm test tests/integration/auth.test.ts`
Expected: FAIL — `changeUserPassword` không phải hàm (`… is not a function`) / lỗi import.

- [ ] **Step 5: Thêm `changeUserPassword` vào `src/server/services/user.service.ts`**

Thêm cuối file (đối chiếu code thật: L có thể đã đổi `registerUser`; chỉ thêm hàm mới, import `bcrypt`, `TRPCError`, `BCRYPT_COST`, `PrismaClient` đã có sẵn trong file):
```ts
// Đổi hash + tăng sessionVersion trong MỘT update: không có lúc hash mới mà token cũ còn sống (spec N Q15).
export async function changeUserPassword(
  db: PrismaClient,
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu hiện tại không đúng" })
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
  })
}
```
Run: `pnpm test tests/integration/auth.test.ts` rồi `pnpm test tests/integration/session-validity.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 6: Unit test server action (RED)**

Tạo `tests/unit/change-password-action.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  signIn: vi.fn(async (..._args: unknown[]) => undefined),
  change: vi.fn(async (..._args: unknown[]) => undefined),
}))
vi.mock("@/server/auth", () => ({ auth: async () => mocks.session, signIn: mocks.signIn }))
vi.mock("@/server/services/user.service", () => ({ changeUserPassword: mocks.change }))
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }))

import { AuthError } from "next-auth"
import { changePasswordAction } from "@/app/actions/change-password"
import type { ChangePasswordInput } from "@/lib/schemas/auth"

const OK_INPUT = { currentPassword: "teacher123", newPassword: "NewSecret@2026" }
const signedIn = (remember?: boolean) => ({
  user: { id: "7", username: "teacher", fullName: null, remember },
  expires: "",
})

beforeEach(() => {
  mocks.session = signedIn(true)
  mocks.signIn.mockReset()
  mocks.change.mockReset()
})

describe("changePasswordAction (spec N 6.3c)", () => {
  it("chưa đăng nhập → UNAUTHORIZED, không đổi gì", async () => {
    mocks.session = null
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: false, error: "UNAUTHORIZED" })
    expect(mocks.change).not.toHaveBeenCalled()
  })

  it("mật khẩu mới ngắn hoặc trùng → INVALID kèm thông báo zod", async () => {
    expect(await changePasswordAction({ currentPassword: "teacher123", newPassword: "short" })).toEqual({
      ok: false,
      error: "INVALID",
      message: "Mật khẩu mới phải có ít nhất 10 ký tự",
    })
    expect(await changePasswordAction({ currentPassword: "Lich-7k2m-Qx9f", newPassword: "Lich-7k2m-Qx9f" })).toEqual({
      ok: false,
      error: "INVALID",
      message: "Mật khẩu mới phải khác mật khẩu hiện tại",
    })
    expect(mocks.change).not.toHaveBeenCalled()
  })

  it("sai mật khẩu cũ → WRONG_CURRENT, không signIn", async () => {
    mocks.change.mockRejectedValueOnce(new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu hiện tại không đúng" }))
    expect(await changePasswordAction(OK_INPUT)).toEqual({
      ok: false,
      error: "WRONG_CURRENT",
      message: "Mật khẩu hiện tại không đúng",
    })
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it("đúng → đổi theo userId của phiên, signIn lại bằng mật khẩu mới, giữ ghi nhớ", async () => {
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: true })
    expect(mocks.change).toHaveBeenCalledWith(expect.anything(), 7, "teacher123", "NewSecret@2026")
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      username: "teacher",
      password: "NewSecret@2026",
      remember: "1",
      redirect: false,
    })
  })

  it("phiên không ghi nhớ → remember '0'; username lấy từ phiên, bỏ qua field client gửi", async () => {
    mocks.session = signedIn(undefined)
    await changePasswordAction({ ...OK_INPUT, username: "hacker" } as unknown as ChangePasswordInput)
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ username: "teacher", remember: "0" }))
  })

  it("signIn lại thất bại (vd rate limit) → mật khẩu đã đổi, báo relogin", async () => {
    mocks.signIn.mockRejectedValueOnce(new AuthError("CredentialsSignin"))
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: true, relogin: true })
  })
})
```
Run: `pnpm test tests/unit/change-password-action.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/actions/change-password"`.

- [ ] **Step 7: Tạo `src/app/actions/change-password.ts`**

```ts
"use server"

import { TRPCError } from "@trpc/server"
import { AuthError } from "next-auth"
import { auth, signIn } from "@/server/auth"
import { db } from "@/server/db"
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas/auth"
import { changeUserPassword } from "@/server/services/user.service"

export type ChangePasswordResult =
  | { ok: true; relogin?: true }
  | { ok: false; error: "UNAUTHORIZED" | "WRONG_CURRENT" | "INVALID"; message?: string }

// Server action thay tRPC vì route tRPC không ghi lại được cookie phiên cho máy đang đổi (spec N Q15).
export async function changePasswordAction(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const session = await auth()
  if (!session?.user) return { ok: false, error: "UNAUTHORIZED" }

  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID", message: parsed.error.issues[0]?.message }

  try {
    await changeUserPassword(db, Number(session.user.id), parsed.data.currentPassword, parsed.data.newPassword)
  } catch (e) {
    if (e instanceof TRPCError && e.code === "BAD_REQUEST") return { ok: false, error: "WRONG_CURRENT", message: e.message }
    throw e
  }

  // Cấp token mới mang sessionVersion mới; username/remember lấy từ phiên server, không nhận từ client.
  try {
    await signIn("credentials", {
      username: session.user.username,
      password: parsed.data.newPassword,
      remember: session.user.remember === true ? "1" : "0",
      redirect: false,
    })
  } catch (e) {
    // Mật khẩu đã đổi, chỉ không tự đăng nhập lại được (vd đang bị rate limit theo username).
    if (e instanceof AuthError) return { ok: true, relogin: true }
    throw e
  }
  return { ok: true }
}
```
Run: `pnpm test tests/unit/change-password-action.test.ts`
Expected: PASS 6 test.

- [ ] **Step 8: Unit test form (RED)**

Tạo `tests/unit/components/ChangePasswordForm.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  action: vi.fn(async (..._args: unknown[]) => ({ ok: true }) as unknown),
}))
vi.mock("@/app/actions/change-password", () => ({ changePasswordAction: mocks.action }))

import { ChangePasswordForm } from "@/components/layout/ChangePasswordForm"

function fill(container: HTMLElement, current: string, next: string, confirm = next) {
  fireEvent.change(container.querySelector("#current-pw")!, { target: { value: current } })
  fireEvent.change(container.querySelector("#new-pw")!, { target: { value: next } })
  fireEvent.change(container.querySelector("#confirm-pw")!, { target: { value: confirm } })
  fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }))
}

beforeEach(() => {
  mocks.action.mockReset()
  mocks.action.mockResolvedValue({ ok: true })
})

describe("ChangePasswordForm", () => {
  it("mật khẩu mới < 10 ký tự / trùng hiện tại / xác nhận lệch → báo lỗi tại chỗ, không gọi action", () => {
    const { container } = render(<ChangePasswordForm onSuccess={vi.fn()} />)
    fill(container, "teacher123", "short")
    expect(screen.getByRole("alert").textContent).toBe("Mật khẩu mới phải có ít nhất 10 ký tự")
    fill(container, "Lich-7k2m-Qx9f", "Lich-7k2m-Qx9f")
    expect(screen.getByRole("alert").textContent).toBe("Mật khẩu mới phải khác mật khẩu hiện tại")
    fill(container, "teacher123", "NewSecret@2026", "NewSecret@2027")
    expect(screen.getByRole("alert").textContent).toBe("Xác nhận mật khẩu không khớp")
    expect(mocks.action).not.toHaveBeenCalled()
  })

  it("thành công → onSuccess(false); relogin → onSuccess(true)", async () => {
    const onSuccess = vi.fn()
    const { container } = render(<ChangePasswordForm onSuccess={onSuccess} />)
    fill(container, "teacher123", "NewSecret@2026")
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(false))
    expect(mocks.action).toHaveBeenCalledWith({ currentPassword: "teacher123", newPassword: "NewSecret@2026" })
    mocks.action.mockResolvedValueOnce({ ok: true, relogin: true })
    fill(container, "teacher123", "NewSecret@2026")
    await waitFor(() => expect(onSuccess).toHaveBeenLastCalledWith(true))
  })

  it("sai mật khẩu cũ → hiện thông báo server; hết phiên → báo đăng nhập lại", async () => {
    mocks.action.mockResolvedValueOnce({ ok: false, error: "WRONG_CURRENT", message: "Mật khẩu hiện tại không đúng" })
    const { container } = render(<ChangePasswordForm onSuccess={vi.fn()} />)
    fill(container, "wrong-pass", "NewSecret@2026")
    expect((await screen.findByRole("alert")).textContent).toBe("Mật khẩu hiện tại không đúng")
    mocks.action.mockResolvedValueOnce({ ok: false, error: "UNAUTHORIZED" })
    fill(container, "teacher123", "NewSecret@2026")
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Phiên đăng nhập đã hết, vui lòng đăng nhập lại")
    )
  })

  it("nút Hủy chỉ có khi truyền onCancel", () => {
    const { unmount } = render(<ChangePasswordForm onSuccess={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Hủy" })).toBeNull()
    unmount()
    const onCancel = vi.fn()
    render(<ChangePasswordForm onSuccess={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```
Run: `pnpm test tests/unit/components/ChangePasswordForm.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/layout/ChangePasswordForm"`.

Nếu `screen.getByRole("button", { name: "Đổi mật khẩu" })` trùng với nút ẩn/hiện của `PasswordInput` (kiểm `src/components/ui/password-input.tsx`): dùng `container.querySelector('button[type="submit"]')`.

- [ ] **Step 9: Tạo `src/components/layout/ChangePasswordForm.tsx`**

```tsx
"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { changePasswordAction } from "@/app/actions/change-password"

// Dùng chung cho dialog trong menu tài khoản và trang đổi mật khẩu bắt buộc (spec N R2).
export function ChangePasswordForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (relogin: boolean) => void
  onCancel?: () => void
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 10) {
      setError("Mật khẩu mới phải có ít nhất 10 ký tự")
      return
    }
    if (next === current) {
      setError("Mật khẩu mới phải khác mật khẩu hiện tại")
      return
    }
    if (next !== confirm) {
      setError("Xác nhận mật khẩu không khớp")
      return
    }
    startTransition(async () => {
      const r = await changePasswordAction({ currentPassword: current, newPassword: next })
      if (r.ok) onSuccess(r.relogin === true)
      else if (r.error === "UNAUTHORIZED") setError("Phiên đăng nhập đã hết, vui lòng đăng nhập lại")
      else setError(r.message ?? "Mật khẩu hiện tại không đúng")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current-pw">Mật khẩu hiện tại</Label>
        <PasswordInput
          id="current-pw"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pw">Mật khẩu mới</Label>
        <PasswordInput
          id="new-pw"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-pw">Xác nhận mật khẩu mới</Label>
        <PasswordInput
          id="confirm-pw"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onCancel} disabled={isPending}>
            Hủy
          </Button>
        )}
        <Button type="submit" className="h-11 md:h-10" disabled={isPending}>
          {isPending ? "Đang lưu..." : "Đổi mật khẩu"}
        </Button>
      </div>
    </form>
  )
}
```
Lưu ý: ô `required` + `minLength` → trình duyệt thật chặn submit trước `handleSubmit`; jsdom không chặn nên unit test đi vào `handleSubmit`. Nếu jsdom chặn (không thấy `alert`), bỏ `minLength={10}` khỏi `#new-pw` (luật độ dài đã kiểm trong `handleSubmit` + server) và ghi Ruling.

Run: `pnpm test tests/unit/components/ChangePasswordForm.test.tsx`
Expected: PASS 4 test.

- [ ] **Step 10: Viết lại `ChangePasswordDialog.tsx` và xóa tRPC `changePassword`**

Thay toàn bộ `src/components/layout/ChangePasswordDialog.tsx` bằng:
```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ChangePasswordForm } from "./ChangePasswordForm"

export function ChangePasswordDialog({
  trigger,
}: {
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleSuccess(relogin: boolean) {
    setOpen(false)
    if (relogin) {
      toast.success("Đổi mật khẩu thành công, vui lòng đăng nhập lại")
      router.replace("/login")
      return
    }
    toast.success("Đổi mật khẩu thành công")
    // Nạp lại layout để SessionProvider nhận phiên mới vừa cấp.
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu</DialogTitle>
          <DialogDescription>
            Mật khẩu mới tối thiểu 10 ký tự.
          </DialogDescription>
        </DialogHeader>
        <ChangePasswordForm onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
```
`src/server/trpc/routers/auth.ts`: xóa nguyên procedure `changePassword: protectedProcedure … }),`; xóa import `bcrypt`; import schema đổi thành `import { registerSchema } from "@/lib/schemas/auth"`; bỏ `BCRYPT_COST,` khỏi khối import `@/server/auth-credentials` (còn `isRegisterRateLimited`, `recordRegisterAttempt`). Giữ `TRPCError`, `protectedProcedure` (còn dùng ở `register`/`me`).

Run (Bash):
```bash
grep -rn "auth\.changePassword\|changePassword:" src tests
```
Expected: không in gì.

- [ ] **Step 11: E2E đổi mật khẩu đá máy khác**

Trong `tests/e2e/auth.spec.ts`:
- Thêm import:
```ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
```
- Dưới hằng `REMEMBER` thêm:
```ts
const db = new PrismaClient();

test.beforeAll(() => {
  // Test dưới ghi DB bằng Prisma để khôi phục mật khẩu → chỉ chạy trên DB test.
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
});
test.afterAll(async () => {
  await db.$disconnect();
});

async function restoreTeacherPassword() {
  await db.user.update({
    where: { username: 'teacher' },
    data: { passwordHash: await bcrypt.hash('teacher123', 4), mustChangePassword: false },
  });
}
```
- Thêm cuối file:
```ts
test('đổi mật khẩu: máy đang đổi vẫn đăng nhập (giữ ghi nhớ), máy khác bị về /login?expired=1', async ({ browser }) => {
  const TEMP = 'TamThoi@2026x';
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  try {
    await loginForm(a, true);
    await loginForm(b, false);
    const before = (await sessionPayload(ctxA)).payload.sessionVersion as number;

    await a.click('button[aria-label="Mở menu tài khoản"]');
    await a.getByRole('menuitem', { name: 'Đổi mật khẩu' }).click();
    const dlg = a.getByRole('dialog');
    await dlg.locator('#current-pw').fill('teacher123');
    await dlg.locator('#new-pw').fill(TEMP);
    await dlg.locator('#confirm-pw').fill(TEMP);
    await dlg.locator('button[type="submit"]').click();
    await expect(a.getByText('Đổi mật khẩu thành công')).toBeVisible();

    await a.goto('/students');
    await expect(a).toHaveURL(/\/students$/);
    const after = (await sessionPayload(ctxA)).payload;
    expect(after.sessionVersion).toBe(before + 1);
    expect(after.remember).toBe(true);

    await b.goto('/students');
    await expect(b).toHaveURL(/\/login\?.*expired=1/);
  } finally {
    await restoreTeacherPassword();
    await ctxA.close();
    await ctxB.close();
  }
});
```

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/auth.spec.ts
```
Expected: 8 passed. Nếu test mới đỏ vì A bị về `/login` sau khi đổi (Review Focus 1): DỪNG, thu thứ tự header — thêm tạm vào test `a.on('response', async (r) => { if (r.request().method() === 'POST') console.log(r.url(), (await r.headersArray()).filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value.slice(0, 40))) })`, chạy lại, gửi kết quả cho người điều phối; không commit bản sửa đoán mò.

- [ ] **Step 12: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`, rồi `pnpm test tests/unit/components/AppHeader.test.tsx`
Expected: sạch; AppHeader PASS (mock `ChangePasswordDialog` không đổi).

```bash
git add src/lib/schemas/auth.ts src/server/services/user.service.ts src/server/trpc/routers/auth.ts src/app/actions/change-password.ts src/components/layout/ChangePasswordForm.tsx src/components/layout/ChangePasswordDialog.tsx tests/unit/schemas/auth.schema.test.ts tests/unit/change-password-action.test.ts tests/unit/components/ChangePasswordForm.test.tsx tests/integration/auth.test.ts tests/integration/session-validity.test.ts tests/e2e/auth.spec.ts
git commit -m "feat(n): đổi mật khẩu qua server action, tăng sessionVersion đá máy khác, máy đang đổi nhận token mới

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: Admin reset mật khẩu (server) + bắt đổi mật khẩu chặn ở server + trang /change-password

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 1, 2, 11, 12; Review Focus 3; spec mục "Bổ sung" R1–R3 (toàn bộ); `src/server/trpc/index.ts` (`enforceAuth`, `adminProcedure`); `src/server/trpc/routers/admin.ts` (L đã thêm procedure — chèn thêm, không xóa); `src/server/services/plan-admin.service.ts` (mẫu service admin nhận `adminUsername`); `src/lib/admin.ts` (`isAdminUsername`); `src/server/auth.config.ts` (`authorized`, Task 2); `src/app/(app)/layout.tsx` (Task 3); `src/app/api/backup/route.ts`; `src/app/login/page.tsx` + `LoginHeader.tsx` (mẫu trang đứng riêng có `Card`); `src/components/layout/ChangePasswordForm.tsx` (Task 4); `tests/helpers/trpc.ts`; `tests/integration/admin.test.ts` (mẫu `ADMIN_USERNAMES`); `tests/integration/backup-route.test.ts`; `tests/unit/auth-authorized.test.ts`, `tests/unit/layout/admin-redirect.test.ts`.

**Files:**
- Create: `src/server/services/password-reset.service.ts`, `src/app/change-password/page.tsx`, `src/app/change-password/ForcedChangePassword.tsx`
- Modify: `src/lib/schemas/auth.ts`, `src/server/trpc/routers/admin.ts`, `src/server/trpc/index.ts`, `src/server/auth.config.ts`, `src/app/(app)/layout.tsx`, `src/app/api/backup/route.ts`, `src/language/vi.json`, `src/language/en.json`, `tests/helpers/trpc.ts`
- Test (Mới): `tests/unit/services/temp-password.test.ts`, `tests/integration/password-reset.test.ts`
- Test (Sửa): `tests/unit/schemas/auth.schema.test.ts`, `tests/unit/auth-authorized.test.ts`, `tests/unit/layout/admin-redirect.test.ts`, `tests/integration/backup-route.test.ts`

**Interfaces:**
- Consumes: Task 1 `db.passwordResetLog`, cột `mustChangePassword`/`sessionVersion`; Task 2 `Session.user.mustChangePassword?`; Task 3 `nodeJwt` ghi cờ từ DB; Task 4 `ChangePasswordForm({ onSuccess, onCancel? })`, `changeUserPassword` (tắt cờ).
- Produces:
  - `src/lib/schemas/auth.ts`: `resetPasswordSchema = z.object({ userId: z.number().int().positive() })`.
  - `src/server/services/password-reset.service.ts`: `generateTempPassword(): string` (dạng `Lich-xxxx-xxxx`, 14 ký tự, bảng chữ bỏ `0 O o 1 l I`); `adminResetPassword(db: PrismaClient, adminUsername: string, userId: number): Promise<{ username: string; tempPassword: string }>`.
  - tRPC `admin.resetPassword({ userId }) → { username, tempPassword }` (adminProcedure). Lỗi: `NOT_FOUND`, `FORBIDDEN` (tài khoản admin).
  - `protectedProcedure` (qua `enforceAuth`) ném `TRPCError FORBIDDEN "MUST_CHANGE_PASSWORD"` khi `ctx.session.user.mustChangePassword === true`.
  - Route MỚI `/change-password` (qua middleware, cần đăng nhập). Middleware + layout `(app)` đẩy người có cờ về `/change-password`.
  - Key i18n: `must_change_password_title`, `must_change_password_desc`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Unit test mật khẩu tạm + schema (RED)**

Tạo `tests/unit/services/temp-password.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { generateTempPassword } from "@/server/services/password-reset.service"

describe("generateTempPassword (spec N R1)", () => {
  it("dạng Lich-xxxx-xxxx, 14 ký tự, không có ký tự dễ nhầm 0 O o 1 l I", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword()
      expect(p).toMatch(/^Lich-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)
      expect(p).toHaveLength(14)
      expect(p.slice(5)).not.toMatch(/[0Oo1lI]/)
    }
  })
  it("ngẫu nhiên: 200 lần không trùng", () => {
    expect(new Set(Array.from({ length: 200 }, generateTempPassword)).size).toBe(200)
  })
})
```
Trong `tests/unit/schemas/auth.schema.test.ts`: import đổi thành `import { changePasswordSchema, resetPasswordSchema } from "@/lib/schemas/auth"`; thêm cuối file:
```ts
describe("resetPasswordSchema (spec N R3)", () => {
  it("chỉ nhận userId nguyên dương", () => {
    expect(resetPasswordSchema.safeParse({ userId: 5 }).success).toBe(true)
    for (const userId of [0, -1, 1.5, "5"]) {
      expect(resetPasswordSchema.safeParse({ userId }).success, String(userId)).toBe(false)
    }
  })
})
```
Run: `pnpm test tests/unit/services/temp-password.test.ts` rồi `pnpm test tests/unit/schemas/auth.schema.test.ts`
Expected: FAIL — import không tồn tại (`password-reset.service`, `resetPasswordSchema`).

- [ ] **Step 3: Thêm schema + service**

`src/lib/schemas/auth.ts`, dưới `changePasswordSchema` thêm:
```ts
export const resetPasswordSchema = z.object({ userId: z.number().int().positive() })
```
Tạo `src/server/services/password-reset.service.ts`:
```ts
import { randomInt } from "node:crypto"
import bcrypt from "bcryptjs"
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { isAdminUsername } from "@/lib/admin"
import { BCRYPT_COST } from "@/server/auth-credentials"

// Bỏ 0/O/o và 1/l/I để đọc qua điện thoại không nhầm (spec N R1).
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomChunk(n: number): string {
  let s = ""
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

// 8 ký tự ngẫu nhiên từ crypto, dài 14 nên vẫn qua luật ≥10 ký tự.
export function generateTempPassword(): string {
  return `Lich-${randomChunk(4)}-${randomChunk(4)}`
}

// Mật khẩu tạm chỉ trả về đúng 1 lần cho admin; DB giữ hash, log không chứa mật khẩu (spec N R1, R3).
export async function adminResetPassword(
  db: PrismaClient,
  adminUsername: string,
  userId: number
): Promise<{ username: string; tempPassword: string }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
  if (isAdminUsername(user.username)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Không reset mật khẩu tài khoản quản trị" })
  }
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST)
  // Tăng sessionVersion để mọi máy đang đăng nhập tài khoản này bị đá ngay (spec N R2).
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
    }),
    db.passwordResetLog.create({ data: { userId: user.id, resetBy: adminUsername } }),
  ])
  return { username: user.username, tempPassword }
}
```
Run: `pnpm test tests/unit/services/temp-password.test.ts` rồi `pnpm test tests/unit/schemas/auth.schema.test.ts`
Expected: PASS.

- [ ] **Step 4: Integration reset + chặn tRPC (RED)**

Sửa `tests/helpers/trpc.ts`: trong `getAuthedCaller`, `session.user` thêm 2 dòng sau `email: null,`:
```ts
        remember: false,
        // Giống nodeJwt: cờ lấy từ DB để test chặn R2 thấy đúng trạng thái.
        mustChangePassword: user.mustChangePassword,
```
Tạo `tests/integration/password-reset.test.ts`:
```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { authorizeCredentials } from "@/server/auth-credentials"
import { nodeJwt } from "@/server/auth-node-callbacks"
import { changeUserPassword } from "@/server/services/user.service"
import { currentEpoch } from "@/lib/session-policy"

const TARGET = "reset_target"
let targetId = 0

async function resetTarget() {
  await db.loginAttempt.deleteMany({ where: { username: TARGET } })
  await db.user.update({
    where: { id: targetId },
    data: { passwordHash: await bcrypt.hash("teacher123", 4), mustChangePassword: false, sessionVersion: 0 },
  })
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { username: TARGET } })
  targetId = (
    await db.user.create({ data: { username: TARGET, passwordHash: await bcrypt.hash("teacher123", 4) } })
  ).id
})
beforeEach(async () => {
  process.env.ADMIN_USERNAMES = "admin_test"
  await db.passwordResetLog.deleteMany({ where: { userId: targetId } })
  await resetTarget()
})
afterAll(async () => {
  delete process.env.ADMIN_USERNAMES
  await db.passwordResetLog.deleteMany({ where: { userId: targetId } })
  await db.loginAttempt.deleteMany({ where: { username: TARGET } })
  await db.user.deleteMany({ where: { username: TARGET } })
})

type P = Parameters<typeof nodeJwt>[0]

describe("admin.resetPassword (spec N R1–R3)", () => {
  it("admin reset → mật khẩu tạm đăng nhập được, pass cũ hết, cờ bật, sessionVersion +1, có log, phiên cũ bị đá", async () => {
    const oldToken = { userId: String(targetId), username: TARGET, fullName: null, epoch: currentEpoch(), sessionVersion: 0, iat: Math.floor(Date.now() / 1000) }
    const admin = await getAuthedCaller("admin_test")
    const r = await admin.admin.resetPassword({ userId: targetId })
    expect(r.username).toBe(TARGET)
    expect(r.tempPassword).toMatch(/^Lich-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)

    const u = await db.user.findUniqueOrThrow({ where: { id: targetId } })
    expect(u.mustChangePassword).toBe(true)
    expect(u.sessionVersion).toBe(1)
    expect(u.passwordHash).not.toContain(r.tempPassword)

    const logs = await db.passwordResetLog.findMany({ where: { userId: targetId } })
    expect(logs).toHaveLength(1)
    expect(logs[0].resetBy).toBe("admin_test")
    expect(Object.keys(logs[0]).sort()).toEqual(["createdAt", "id", "resetBy", "userId"])

    expect(await nodeJwt({ token: oldToken } as unknown as P)).toBeNull()
    expect(await authorizeCredentials(TARGET, "teacher123", null)).toBeNull()
    expect(await authorizeCredentials(TARGET, r.tempPassword, null)).toMatchObject({ mustChangePassword: true, sessionVersion: 1 })
  })

  it("giáo viên gọi → FORBIDDEN; reset tài khoản admin → FORBIDDEN; id không tồn tại → NOT_FOUND", async () => {
    const teacher = await getAuthedCaller("teacher")
    await expect(teacher.admin.resetPassword({ userId: targetId })).rejects.toMatchObject({ code: "FORBIDDEN" })
    const admin = await getAuthedCaller("admin_test")
    const adminId = (await db.user.findUniqueOrThrow({ where: { username: "admin_test" } })).id
    await expect(admin.admin.resetPassword({ userId: adminId })).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(admin.admin.resetPassword({ userId: 999_999 })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await db.passwordResetLog.count({ where: { userId: targetId } })).toBe(0)
  })

  it("đang bị bắt đổi mật khẩu → tRPC nghiệp vụ FORBIDDEN; đổi xong hết chặn", async () => {
    const { tempPassword } = await (await getAuthedCaller("admin_test")).admin.resetPassword({ userId: targetId })
    const blocked = await getAuthedCaller(TARGET)
    await expect(blocked.auth.me()).rejects.toMatchObject({ code: "FORBIDDEN", message: "MUST_CHANGE_PASSWORD" })
    await expect(blocked.plan.me()).rejects.toMatchObject({ code: "FORBIDDEN" })

    await changeUserPassword(db, targetId, tempPassword, "MoiSauReset@2026")
    const freed = await getAuthedCaller(TARGET)
    await expect(freed.auth.me()).resolves.toMatchObject({ username: TARGET })
  })
})
```
Trong `tests/integration/backup-route.test.ts`, thêm sau test `"phiên có user.id rỗng → 401 …"`:
```ts
  it("đang bị bắt đổi mật khẩu → 403, không xuất dữ liệu (spec N R2)", async () => {
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    authMock.mockResolvedValue({ user: { id: String(teacher.id), mustChangePassword: true } })
    const res = await GET()
    expect(res.status).toBe(403)
  })
```
Run: `pnpm test tests/integration/password-reset.test.ts` rồi `pnpm test tests/integration/backup-route.test.ts`
Expected: FAIL — `admin.resetPassword` không tồn tại (`No "mutation"-procedure on path "admin.resetPassword"` hoặc lỗi tsc/đường dẫn); backup: nhận 200 thay vì 403.

- [ ] **Step 5: Router, enforceAuth, backup**

`src/server/trpc/routers/admin.ts`: thêm import
```ts
import { resetPasswordSchema } from "@/lib/schemas/auth"
import { adminResetPassword } from "@/server/services/password-reset.service"
```
và thêm procedure cuối object `createTRPCRouter({ … })` (sau procedure cuối hiện có, giữ mọi procedure của L):
```ts
  resetPassword: adminProcedure
    .input(resetPasswordSchema)
    .mutation(({ ctx, input }) => adminResetPassword(ctx.db, ctx.session.user.username, input.userId)),
```
`src/server/trpc/index.ts`, trong `enforceAuth` ngay sau khối `if (!ctx.session || !ctx.userId) { … }` thêm:
```ts
  // Spec N R2: đăng nhập bằng mật khẩu tạm thì chưa được dùng nghiệp vụ cho tới khi đổi mật khẩu.
  if (ctx.session.user.mustChangePassword === true) {
    throw new TRPCError({ code: "FORBIDDEN", message: "MUST_CHANGE_PASSWORD" })
  }
```
`src/app/api/backup/route.ts`, ngay sau dòng `if (!session?.user?.id) return new Response(null, { status: 401 })` thêm:
```ts
  // Cờ đặt tay trong DB chỉ lộ ở auth() Node, middleware Edge không thấy (spec N R2).
  if (session.user.mustChangePassword === true) return new Response(null, { status: 403 })
```
Run: `pnpm test tests/integration/password-reset.test.ts` rồi `pnpm test tests/integration/backup-route.test.ts` rồi `pnpm test tests/integration/admin.test.ts`
Expected: PASS toàn bộ (admin.test không đổi hành vi).

- [ ] **Step 6: Unit test middleware + layout + trang (RED)**

`tests/unit/auth-authorized.test.ts`: dưới hằng `TEACHER` thêm
```ts
const MUST_CHANGE = { user: { id: "1", username: "teacher", mustChangePassword: true }, expires: "" }
```
và thêm cuối describe:
```ts
  it("đang bị bắt đổi mật khẩu → mọi route (kể cả /api/backup) 302 về /change-password; ở /change-password thì cho qua", () => {
    for (const path of ["/dashboard", "/students", "/api/backup", "/plan"]) {
      const res = call(MUST_CHANGE, path)
      expect(res, path).toBeInstanceOf(Response)
      expect((res as Response).headers.get("location"), path).toBe("http://localhost:3000/change-password")
    }
    expect(call(MUST_CHANGE, "/change-password")).toBe(true)
    expect(call(TEACHER, "/change-password")).toBe(true)
  })
```
`tests/unit/layout/admin-redirect.test.ts`: thêm mock `vi.mock("@/app/change-password/ForcedChangePassword", () => ({ ForcedChangePassword: () => null }))`, import `import ChangePasswordPage from "@/app/change-password/page"`, và thêm cuối file:
```ts
describe("bắt đổi mật khẩu (spec N R2)", () => {
  const flagged = { user: { id: "1", username: "teacher", fullName: null, mustChangePassword: true }, expires: "" }

  it("(app) có cờ → /change-password", async () => {
    mocks.session = flagged
    await expect(AppGroupLayout({ children: "x" })).rejects.toThrow("REDIRECT /change-password")
  })

  it("/change-password: chưa đăng nhập → /login?expired=1; không có cờ → /dashboard; có cờ → hiện form", async () => {
    mocks.session = null
    await expect(ChangePasswordPage()).rejects.toThrow("REDIRECT /login?expired=1")
    mocks.session = as("teacher")
    await expect(ChangePasswordPage()).rejects.toThrow("REDIRECT /dashboard")
    mocks.session = flagged
    await expect(ChangePasswordPage()).resolves.toBeTruthy()
  })
})
```
Run: `pnpm test tests/unit/auth-authorized.test.ts` rồi `pnpm test tests/unit/layout/admin-redirect.test.ts`
Expected: FAIL — authorized trả `true` thay vì redirect; admin-redirect lỗi import `@/app/change-password/page`.

- [ ] **Step 7: Middleware + layout + trang `/change-password` + i18n**

`src/server/auth.config.ts`, trong `authorized`, thay 2 dòng
```ts
      // J1: admin chỉ dùng khu quản trị. So chặt để "/administration" không bị coi là khu quản trị.
      const { pathname } = request.nextUrl
```
bằng:
```ts
      const { pathname } = request.nextUrl
      // Spec N R2: mật khẩu tạm thì chỉ được ở trang đổi mật khẩu. Cờ trong token chỉ đổi khi reset/đổi mật khẩu,
      // cả hai đều cấp lại hoặc vô hiệu token nên đủ tin ở Edge; Node kiểm lại bằng DB.
      if (auth.user.mustChangePassword === true && pathname !== "/change-password") {
        return Response.redirect(new URL("/change-password", request.nextUrl.origin))
      }
      // J1: admin chỉ dùng khu quản trị. So chặt để "/administration" không bị coi là khu quản trị.
```
`src/app/(app)/layout.tsx`: ngay sau dòng `if (!session?.user) redirect("/login?expired=1")` thêm:
```tsx
  if (session.user.mustChangePassword === true) redirect("/change-password")
```
i18n — `src/language/vi.json`, sau dòng `"session_expired_relogin": …,` thêm:
```json
  "must_change_password_title": "Đổi mật khẩu để tiếp tục",
  "must_change_password_desc": "Tài khoản vừa được đặt lại mật khẩu. Hãy đặt mật khẩu mới (khác mật khẩu tạm) trước khi dùng tiếp.",
```
`src/language/en.json`, sau dòng `"session_expired_relogin": …,` thêm:
```json
  "must_change_password_title": "Change your password to continue",
  "must_change_password_desc": "Your password was just reset. Set a new password (different from the temporary one) before continuing.",
```
Tạo `src/app/change-password/ForcedChangePassword.tsx`:
```tsx
"use client"

import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ChangePasswordForm } from "@/components/layout/ChangePasswordForm"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function ForcedChangePassword() {
  const router = useRouter()
  const { t } = useTranslation()

  function handleSuccess(relogin: boolean) {
    router.replace(relogin ? "/login" : "/dashboard")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">{t("must_change_password_title")}</h1>
        <p className="text-sm text-slate-500">{t("must_change_password_desc")}</p>
      </div>
      <ChangePasswordForm onSuccess={handleSuccess} />
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full md:h-10"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        {t("logout")}
      </Button>
    </div>
  )
}
```
Tạo `src/app/change-password/page.tsx` (KHÔNG dùng định danh `params`/`searchParams`, kể cả trong comment):
```tsx
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/server/auth"
import { ForcedChangePassword } from "./ForcedChangePassword"

// Nằm ngoài nhóm (app) để không gọi tRPC nghiệp vụ (đang bị chặn) từ header/sidebar.
export default async function ChangePasswordPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?expired=1")
  if (session.user.mustChangePassword !== true) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <ForcedChangePassword />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: Chạy test task**

Run lần lượt:
```bash
pnpm test tests/unit/auth-authorized.test.ts
pnpm test tests/unit/layout/admin-redirect.test.ts
pnpm test tests/unit/next15-contract.test.ts
pnpm test tests/integration/password-reset.test.ts
pnpm test tests/integration/plan-gating.test.ts
```
Expected: PASS toàn bộ (`next15-contract` xác nhận trang mới không dính `searchParams`; `plan-gating` xác nhận session không có cờ vẫn qua `enforceAuth`).

- [ ] **Step 9: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`
Expected: sạch.

```bash
git add src/lib/schemas/auth.ts src/server/services/password-reset.service.ts src/server/trpc/routers/admin.ts src/server/trpc/index.ts src/server/auth.config.ts "src/app/(app)/layout.tsx" src/app/api/backup/route.ts src/app/change-password/page.tsx src/app/change-password/ForcedChangePassword.tsx src/language/vi.json src/language/en.json tests/helpers/trpc.ts tests/unit/services/temp-password.test.ts tests/unit/schemas/auth.schema.test.ts tests/unit/auth-authorized.test.ts tests/unit/layout/admin-redirect.test.ts tests/integration/password-reset.test.ts tests/integration/backup-route.test.ts
git commit -m "feat(n): admin.resetPassword (mật khẩu tạm crypto, đá mọi phiên, ghi log), bắt đổi mật khẩu chặn ở middleware/layout/tRPC/backup, trang /change-password

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: Nút "Reset mật khẩu" ở /admin/accounts + e2e luồng reset → bắt đổi → dashboard

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 6, 12; Review Focus 1; spec mục "Bổ sung" R1 (dialog xác nhận nêu tên đăng nhập, mật khẩu hiện 1 lần + nút Sao chép) và dòng Test e2e; `src/components/admin/AdminAccounts.tsx` (sau L Task 6 có hàm `actions(u)` + nút "Đặt dùng thử" ẩn khi `u.isAdmin`); `src/components/admin/SetPlanDialog.tsx` (mẫu dialog admin); `src/components/ui/alert-dialog.tsx`; `src/components/plan/PendingOrderCard.tsx` (mẫu sao chép + `plan_copied`); `tests/unit/components/PlanPurchaseDialog.test.tsx` (mẫu mock `@/lib/trpc`); `tests/e2e/admin.spec.ts` (mẫu `loginAs`, guard DB, 390px/1280px); `src/app/change-password/*` (Task 5).

**Files:**
- Create: `src/components/admin/ResetPasswordDialog.tsx`
- Modify: `src/components/admin/AdminAccounts.tsx`, `src/language/vi.json`, `src/language/en.json`
- Test (Mới): `tests/unit/components/ResetPasswordDialog.test.tsx`, `tests/e2e/admin-reset-password.spec.ts`

**Interfaces:**
- Consumes: Task 5 tRPC `admin.resetPassword({ userId: number }) → { username: string; tempPassword: string }`, trang `/change-password`; L `admin.overview.users[]` có `id`, `username`, `isAdmin` (kiểu `RouterOutputs["admin"]["overview"]["users"][number]`).
- Produces: `ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void })`; test id `temp-password`; key i18n `admin_reset_password`, `admin_reset_confirm` (có `{username}`), `admin_reset_done`, `admin_reset_close`.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Unit test dialog (RED)**

Tạo `tests/unit/components/ResetPasswordDialog.test.tsx`:
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { toast } from "sonner"

type Opts = { onSuccess?: (r: { username: string; tempPassword: string }) => void; onError?: (e: { message: string }) => void }
const mut = vi.hoisted(() => ({ mutate: vi.fn(), opts: null as null | Opts }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      resetPassword: {
        useMutation: (opts: Opts) => {
          mut.opts = opts
          return { mutate: mut.mutate, isPending: false }
        },
      },
    },
  },
}))

import { ResetPasswordDialog } from "@/components/admin/ResetPasswordDialog"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]
const USER = { id: 42, username: "co_lan" } as unknown as UserRow

function renderDialog(onClose = vi.fn()) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <ResetPasswordDialog user={USER} onClose={onClose} />
    </LanguageProvider>
  )
  return onClose
}

beforeEach(() => {
  mut.mutate.mockReset()
  vi.mocked(toast.success).mockClear()
})

describe("ResetPasswordDialog (spec N R1)", () => {
  it("bước xác nhận nêu tên đăng nhập; bấm Reset → gọi mutation với userId", () => {
    renderDialog()
    expect(screen.getByRole("alertdialog").textContent).toContain("co_lan")
    expect(screen.queryByTestId("temp-password")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Reset mật khẩu" }))
    expect(mut.mutate).toHaveBeenCalledWith({ userId: 42 })
  })

  it("thành công → hiện mật khẩu tạm + Sao chép; đóng thì gọi onClose", async () => {
    const onClose = renderDialog()
    act(() => mut.opts!.onSuccess!({ username: "co_lan", tempPassword: "Lich-7k2m-Qx9f" }))
    expect(screen.getByTestId("temp-password").textContent).toBe("Lich-7k2m-Qx9f")
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sao chép" })))
    expect(writeText).toHaveBeenCalledWith("Lich-7k2m-Qx9f")
    expect(toast.success).toHaveBeenCalledWith("Đã sao chép")
    expect(screen.queryByRole("button", { name: "Reset mật khẩu" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Tôi đã lưu mật khẩu" }))
    expect(onClose).toHaveBeenCalled()
  })

  it("Hủy ở bước xác nhận → onClose, không gọi mutation", () => {
    const onClose = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))
    expect(onClose).toHaveBeenCalled()
    expect(mut.mutate).not.toHaveBeenCalled()
  })

  it("nút cao ≥44px ở mobile", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: "Reset mật khẩu" }).className).toContain("h-11")
  })
})
```
Run: `pnpm test tests/unit/components/ResetPasswordDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/ResetPasswordDialog"`.

- [ ] **Step 3: i18n**

`src/language/vi.json`: thêm cạnh các key `admin_*` khác (sau key `admin_set_plan` hoặc key admin cuối của L):
```json
  "admin_reset_password": "Reset mật khẩu",
  "admin_reset_confirm": "Đặt lại mật khẩu cho {username}? Mọi thiết bị đang đăng nhập tài khoản này sẽ bị đăng xuất, người dùng phải đổi mật khẩu khi đăng nhập lại.",
  "admin_reset_done": "Mật khẩu tạm chỉ hiện một lần. Gửi cho người dùng, họ sẽ phải đổi mật khẩu ngay khi đăng nhập.",
  "admin_reset_close": "Tôi đã lưu mật khẩu",
```
`src/language/en.json` (cùng vị trí):
```json
  "admin_reset_password": "Reset password",
  "admin_reset_confirm": "Reset the password for {username}? Every device signed in to this account will be signed out, and the user must change the password at next sign in.",
  "admin_reset_done": "This temporary password is shown only once. Send it to the user, they must change it right after signing in.",
  "admin_reset_close": "I have saved it",
```
(Key có sẵn dùng lại: `cancel` "Hủy", `copy_link` "Sao chép", `plan_copied` "Đã sao chép".)

- [ ] **Step 4: Tạo `src/components/admin/ResetPasswordDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]

export function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { t } = useTranslation()
  // Chỉ giữ trong state của dialog: đóng là mất, không có đường xem lại (spec N R1).
  const [temp, setTemp] = useState<string | null>(null)
  const mut = trpc.admin.resetPassword.useMutation({
    onSuccess: (r) => setTemp(r.tempPassword),
    onError: (e) => toast.error(e.message),
  })

  const copy = async () => {
    if (!temp) return
    try {
      await navigator.clipboard.writeText(temp)
      toast.success(t("plan_copied"))
    } catch {
      // Trình duyệt chặn clipboard: mật khẩu vẫn hiện để tự chọn.
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{`${t("admin_reset_password")} · ${user.username}`}</AlertDialogTitle>
          <AlertDialogDescription>
            {temp ? t("admin_reset_done") : t("admin_reset_confirm").replace("{username}", user.username)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {temp && (
          <div className="flex items-center gap-2">
            <code
              data-testid="temp-password"
              className="flex-1 select-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-base text-foreground"
            >
              {temp}
            </code>
            <Button type="button" variant="outline" className="h-11 md:h-10" onClick={copy}>
              {t("copy_link")}
            </Button>
          </div>
        )}
        <AlertDialogFooter>
          {temp ? (
            <Button type="button" className="h-11 md:h-10" onClick={onClose}>
              {t("admin_reset_close")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="h-11 md:h-10" onClick={onClose} disabled={mut.isPending}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                className="h-11 md:h-10"
                onClick={() => mut.mutate({ userId: user.id })}
                disabled={mut.isPending}
              >
                {t("admin_reset_password")}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```
Run: `pnpm test tests/unit/components/ResetPasswordDialog.test.tsx`
Expected: PASS 4 test.

- [ ] **Step 5: Gắn nút vào `AdminAccounts.tsx`**

Đối chiếu code thật (sau L Task 6):
- Thêm import `import { ResetPasswordDialog } from "./ResetPasswordDialog"`.
- Dưới các `useState` dialog sẵn có thêm `const [resetFor, setResetFor] = useState<UserRow | null>(null)`.
- Trong hàm `actions(u)` của L, bên trong khối `{!u.isAdmin && ( … )}` bọc nút "Đặt dùng thử" thành fragment và thêm nút thứ 2:
```tsx
      {/* Admin không dùng gói/không reset được mật khẩu admin (spec L mục 15, spec N R3). */}
      {!u.isAdmin && (
        <>
          <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setTrialFor(u)}>
            {t("admin_set_trial")}
          </Button>
          <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setResetFor(u)}>
            {t("admin_reset_password")}
          </Button>
        </>
      )}
```
  Nếu code thật KHÔNG có `actions(u)`/`isAdmin` (L làm khác): tạo `actions(u)` như L plan (bọc `setPlanButton(u)` + nút reset trong `<div className="flex flex-wrap gap-2">`), dùng `u.isAdmin` nếu `overview` có, nếu không có thì ẩn bằng server (nút vẫn hiện, server trả `FORBIDDEN`) và ghi Ruling.
- Cạnh các dòng render dialog cuối component thêm:
```tsx
      {resetFor && <ResetPasswordDialog key={resetFor.id} user={resetFor} onClose={() => setResetFor(null)} />}
```

- [ ] **Step 6: E2E luồng reset**

Tạo `tests/e2e/admin-reset-password.spec.ts`:
```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

const db = new PrismaClient();
const TARGET = 'reset_e2e';
const NEW_PASSWORD = 'MoiSauReset@2026';
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function cleanup() {
  const u = await db.user.findUnique({ where: { username: TARGET } });
  if (!u) return;
  await db.passwordResetLog.deleteMany({ where: { userId: u.id } });
  await db.loginAttempt.deleteMany({ where: { username: TARGET } });
  await db.user.delete({ where: { id: u.id } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  await db.user.create({ data: { username: TARGET, passwordHash: await bcrypt.hash('teacher123', 4), fullName: 'Reset E2E' } });
});
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function newPage(browser: Browser, viewport = DESKTOP): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  return page;
}

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

test('admin reset → mật khẩu tạm hiện 1 lần → phiên cũ bị đá → đăng nhập bằng mật khẩu tạm bị bắt đổi → đổi xong vào dashboard', async ({ browser }) => {
  // Máy của giáo viên đang đăng nhập bằng mật khẩu cũ.
  const teacher = await newPage(browser);
  await login(teacher, TARGET, 'teacher123');
  await expect(teacher).toHaveURL(/.*dashboard/);

  const admin = await newPage(browser);
  await login(admin, 'admin_test', 'teacher123');
  await expect(admin).toHaveURL(/\/admin\/orders$/);
  await admin.goto('/admin/accounts');
  const row = admin.getByRole('row').filter({ hasText: TARGET });
  await row.getByRole('button', { name: 'Reset mật khẩu' }).click();
  const dlg = admin.getByRole('alertdialog');
  await expect(dlg).toContainText(TARGET);
  await dlg.getByRole('button', { name: 'Reset mật khẩu' }).click();
  const tempBox = dlg.getByTestId('temp-password');
  await expect(tempBox).toHaveText(/^Lich-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  const temp = (await tempBox.textContent())!.trim();
  await dlg.getByRole('button', { name: 'Tôi đã lưu mật khẩu' }).click();
  await expect(admin.getByRole('alertdialog')).toHaveCount(0);
  // Mở lại dialog chỉ thấy bước xác nhận, không còn mật khẩu cũ.
  await row.getByRole('button', { name: 'Reset mật khẩu' }).click();
  await expect(admin.getByTestId('temp-password')).toHaveCount(0);
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Hủy' }).click();

  await teacher.goto('/students');
  await expect(teacher).toHaveURL(/\/login\?.*expired=1/);

  await login(teacher, TARGET, temp);
  await expect(teacher).toHaveURL(/\/change-password$/);
  await teacher.goto('/students');
  await expect(teacher).toHaveURL(/\/change-password$/);

  await teacher.locator('#current-pw').fill(temp);
  await teacher.locator('#new-pw').fill(temp);
  await teacher.locator('#confirm-pw').fill(temp);
  await teacher.locator('button[type="submit"]').click();
  await expect(teacher.getByRole('alert')).toHaveText('Mật khẩu mới phải khác mật khẩu hiện tại');

  await teacher.locator('#new-pw').fill(NEW_PASSWORD);
  await teacher.locator('#confirm-pw').fill(NEW_PASSWORD);
  await teacher.locator('button[type="submit"]').click();
  await expect(teacher).toHaveURL(/.*dashboard/);
  await teacher.goto('/students');
  await expect(teacher).toHaveURL(/\/students$/);
});

test('390px: thẻ tài khoản có nút Reset mật khẩu cao ≥44px, tài khoản admin không có', async ({ browser }) => {
  const admin = await newPage(browser, MOBILE);
  await login(admin, 'admin_test', 'teacher123');
  await expect(admin).toHaveURL(/\/admin\/orders$/);
  await admin.goto('/admin/accounts');
  const card = admin.getByTestId('admin-user-card').filter({ hasText: TARGET });
  const box = await card.getByRole('button', { name: 'Reset mật khẩu' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const adminCard = admin.getByTestId('admin-user-card').filter({ hasText: 'admin_test' });
  await expect(adminCard.getByRole('button', { name: 'Reset mật khẩu' })).toHaveCount(0);
});
```

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/admin-reset-password.spec.ts tests/e2e/admin.spec.ts
```
Expected: tất cả passed. Nếu bước "đổi xong vào dashboard" bị về `/login` hoặc kẹt ở `/change-password`: đó là Review Focus 1 → DỪNG, thu header như Task 4 Step 11, báo người điều phối. Ca 390px: ở 390px bảng (`hidden md:block`) vẫn trong DOM → luôn lọc theo test id thẻ `admin-user-card`, không dùng `getByRole('row')`.

- [ ] **Step 7: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit` rồi `pnpm lint`, rồi `pnpm test tests/unit/theme-legacy-colors.test.ts`
Expected: sạch; PASS.

```bash
git add src/components/admin/ResetPasswordDialog.tsx src/components/admin/AdminAccounts.tsx src/language/vi.json src/language/en.json tests/unit/components/ResetPasswordDialog.test.tsx tests/e2e/admin-reset-password.spec.ts
git commit -m "feat(n): nút Reset mật khẩu ở màn Tài khoản & gói, mật khẩu tạm hiện 1 lần kèm Sao chép

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 7: Nâng version 0.4.0, kiểm chứng cuối, danh sách kiểm tra tay (không merge, không push)

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" (toàn bộ); Review Focus; spec mục 2, 6.5, 8, 9 và mục "Bổ sung"; `git log --oneline main..HEAD` (1 commit docs + 6 commit Task 1–6).

**Files:**
- Modify: `package.json` (chỉ dòng `"version"`)
- Chỉ sửa file của Task 1–6 nếu bước kiểm chứng phát hiện lỗi (mỗi sửa: test tái hiện → sửa → commit riêng `fix(n): …`, ghi vào báo cáo).

**Interfaces:**
- Consumes: toàn bộ Task 1–6.
- Produces: `package.json` `"version": "0.4.0"`; báo cáo cho người điều phối.

- [ ] **Step 1: Xác nhận DB test**

Run (Bash):
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=ep-polished-voice…` và `test=localhost`. Giống nhau → DỪNG.

- [ ] **Step 2: Nâng version (spec N N4)**

Run (Bash): `grep '"version"' package.json`
Expected: version hiện tại nhỏ hơn `0.4.0` (thường `0.1.0` vì L/M không nâng, hoặc `0.3.0`). Đã là `0.4.0` hoặc lớn hơn → không sửa, ghi vào báo cáo.

Sửa đúng 1 dòng trong `package.json`: `"version": "<cũ>",` → `"version": "0.4.0",` (Edit, giữ nguyên xuống dòng).

```bash
git add package.json
git commit -m "chore(n): nâng version 0.4.0 (epoch 0.4, mọi người đăng nhập lại 1 lần khi N lên)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 3: Quét sót**

Run (Bash):
```bash
grep -rn "8 \* 60 \* 60\|28800" src | grep -v "src/lib/session-policy.ts"
grep -rn "auth\.changePassword\|changePassword:" src tests
grep -n "prisma\|@/server/db\|bcrypt" src/server/auth.config.ts src/lib/session-policy.ts
grep -n "cookies:" src/server/auth.config.ts src/server/auth.ts
grep -rn "indigo-\|violet-\|purple-" src/app/login src/app/change-password src/components/layout/ChangePasswordForm.tsx src/components/admin/ResetPasswordDialog.tsx
git diff main..HEAD -- src/language | grep -P "^\+.*[—–]"
node -e "const a=Object.keys(require('./src/language/vi.json')),b=Object.keys(require('./src/language/en.json'));console.log(JSON.stringify([a.filter(k=>!b.includes(k)),b.filter(k=>!a.includes(k))]))"
git diff main..HEAD -- prisma/migrations | grep -E "^\+" | grep -iE "DROP|TRUNCATE|DELETE|UPDATE|RENAME"
git diff --stat main..HEAD -- prisma/ tests/setup.ts
grep -rn "tempPassword" src | grep -v "password-reset.service.ts\|ResetPasswordDialog.tsx\|routers/admin.ts"
grep -rn "console\.\(log\|info\)" src/server/services/password-reset.service.ts src/app/actions/change-password.ts
```
Expected: lệnh 1 không in gì (`maxAge` chỉ còn ở `session-policy.ts`); lệnh 2 không in gì; lệnh 3 không in gì (Edge không kéo Prisma/bcrypt); lệnh 4 không in gì (giữ cookie mặc định `httpOnly`, `sameSite: lax`, `secure`); lệnh 5, 6 không in gì; lệnh 7 in `[[],[]]`; lệnh 8 không in gì; lệnh 9 chỉ có `prisma/schema.prisma` và 1 thư mục `*_add_session_version_password_reset` (không có `tests/setup.ts`); lệnh 10, 11 không in gì (mật khẩu tạm không bị log hay đi chỗ khác).

- [ ] **Step 4: Toàn bộ unit + integration**

Run: `pnpm test` (~10–15 phút, không chạy song song lệnh test khác)
Expected: toàn bộ PASS, gồm `session-policy`, `auth-jwt`, `auth-authorized`, `LoginForm`, `admin-redirect`, `change-password-action`, `ChangePasswordForm`, `ResetPasswordDialog`, `auth.schema`, `temp-password`, `next15-contract`, `theme-legacy-colors`, `AppHeader`, `session-migration`, `session-validity`, `auth`, `password-reset`, `backup-route`, `plan-gating`, `admin`.

- [ ] **Step 5: E2E toàn bộ**

Run:
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test
```
Expected: tất cả passed (`upgrade-class` có thể `skipped` nếu DB test đã nâng lớp năm nay — chấp nhận). `auth.spec.ts` ca "epoch khớp package.json" phải thấy `epoch` = `0.4`. File nào fail: chạy lại riêng file đó 1 lần để loại chập chờn; vẫn fail → sửa theo mục Files, ghi vào báo cáo. Nếu nhiều file e2e cũ fail ở bước đăng nhập với `teacher`: kiểm `teacher` còn mật khẩu `teacher123` (test đổi mật khẩu phải khôi phục trong `finally`) — chạy lại lệnh seed rồi chạy lại.

- [ ] **Step 6: Lint + tsc + build (DB test)**

Run (Bash):
```bash
pnpm lint
pnpm exec tsc --noEmit
(
  set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a
  case "$DATABASE_URL" in *localhost:5433*) ;; *) echo "DỪNG: không phải DB test"; exit 1;; esac
  pnpm exec next build
)
```
Expected: sạch; build thành công, danh sách route có `/change-password` và `ƒ Middleware` (middleware Edge build được, chứng tỏ `auth.config.ts`/`session-policy.ts` không kéo Prisma). KHÔNG chạy `pnpm build` (có `prisma migrate deploy` lên `.env` production).

- [ ] **Step 7: Báo cáo cho người điều phối (không merge, không push)**

Gồm: version trước/sau; kết quả Step 3–6; `git log --oneline main..HEAD`; mọi Ruling/chỗ code lệch plan của Task 1–7 (kèm lý do); danh sách kiểm tra tay ở Step 8; và nhắc:
- **Trước khi merge, người điều phối tạo backup Neon** (Neon console → project production → "Branch from current", đặt tên kiểu `backup-before-N-session-version-2026-xx-xx`, ghi lại tên để rollback).
- Khi N lên production, **mọi người (kể cả admin) phải đăng nhập lại 1 lần** (epoch `0.4`, token cũ không có `epoch`/`sessionVersion`) — báo trước cho người dùng.
- Rủi ro đã biết: tài khoản đang bị khóa 15 phút vì đăng nhập sai nhiều lần vẫn phải chờ hết khóa mới dùng được mật khẩu tạm (N không đổi luật rate limit).

- [ ] **Step 8: Kiểm tra tay cho người dùng (sau khi merge + Vercel deploy; agent KHÔNG làm)**

1. **Backup trước merge:** đã có branch Neon `backup-before-N-…` (người điều phối tạo).
2. **Log build Vercel:** có `Applying migration …_add_session_version_password_reset` và `All migrations have been successfully applied`; thấy `Resetting` / `rolled back` → rollback ngay (khôi phục từ branch backup). Không chạy lệnh DB tay lên prod.
3. **Đăng nhập lại 1 lần:** mở web đang đăng nhập sẵn → bị về `/login` kèm câu "Phiên đăng nhập đã hết hoặc có phiên bản mới…". Sidebar hiện `v0.4.0`.
4. **Tài khoản `qa_test` (id 4, người dùng tự đăng nhập):** trình duyệt 1 tick "Ghi nhớ đăng nhập (30 ngày)", trình duyệt 2 không tick. DevTools → Application → Cookies: `__Secure-authjs.session-token` hạn ~30 ngày ở cả hai (đúng Q2). Trình duyệt 1 đổi mật khẩu (menu tài khoản → Đổi mật khẩu) → vẫn ở lại, chuyển trang được; trình duyệt 2 chuyển trang → về `/login?expired=1`. Đổi lại mật khẩu cũ ở trình duyệt 1.
5. **Admin reset (tùy chọn, chỉ trên `qa_test`, người dùng tự làm):** tài khoản admin → Tài khoản & gói → dòng `qa_test` → "Reset mật khẩu" → xác nhận → chép mật khẩu tạm → đăng nhập `qa_test` bằng mật khẩu tạm → bị đưa tới trang "Đổi mật khẩu để tiếp tục" → đặt lại mật khẩu → vào Tổng quan. Dòng tài khoản admin không có nút reset. Không reset tài khoản giáo viên thật để thử.
6. **Rollback:** code cũ không đọc 2 cột/bảng mới nên revert commit merge là đủ (mọi người lại đăng nhập lại 1 lần); cột/bảng thừa không gây hại, không cần xóa.

---

## Self-Review (người viết plan đã chạy)

- **Phủ spec:** mục 2 (T2 checkbox/30 ngày/8h/epoch; T3 khóa tài khoản; T4 đổi mật khẩu; `/p/<token>` không đụng — matcher giữ nguyên; T7 lint/test/e2e/build); N1 (T2), N2 (T1 `epochOf`, T2 `jwt`), N3 (T3 `getSessionUserState`, T4 `changeUserPassword` + action), N4 (T7 `0.4.0`), N5 (T2 `session_expired_relogin`); Q1–Q2 (T2 `maxAge` + `isSessionExpired`, không cấu hình cookie), Q3 (T2 form → action → `authorize`), Q4–Q6 (T1, T2), Q7 (T2 `authorized` + `LoginForm`), Q8 (không sửa `session.expires`), Q9 (T1), Q10 (T1 cột, T4/T5 tăng), Q11–Q12 (T3 `nodeJwt`, không cache), Q13 (T3 layout), Q14 (không xóa cookie), Q15 (T4 action + `signIn`), Q16 (T4 xóa tRPC); 6.1–6.5 (T1–T5); 7 Unit/Integration/E2E (T1–T4; ca e2e epoch đổi cách dựng có lý do); 8 R1–R4 (T7 báo cáo); 9 (T1 migration, T7 backup); Bổ sung R1 (T5 `generateTempPassword`/`adminResetPassword`, T6 dialog hiện 1 lần + Sao chép, ẩn với admin), R2 (T1 cột, T3 cờ từ DB, T4 tắt cờ + mới ≠ cũ, T5 chặn middleware/layout/tRPC/backup + trang `/change-password`), R3 (T5 `adminProcedure`, FORBIDDEN admin, bảng log), Test (T5 integration, T6 e2e).
- **Placeholder:** không có TBD/TODO; bước có nhánh điều kiện (shadow DB, Radix FormData, ESM `next-auth/jwt`, AdminAccounts khác L) đều có lệnh/code thay thế cụ thể.
- **Nhất quán tên:** `REMEMBER_MAX_AGE_S`, `SHORT_IDLE_S`, `epochOf`, `currentEpoch`, `isSessionExpired`, `AppJWT`, `getSessionUserState`, `nodeJwt`, `changeUserPassword`, `changePasswordAction`, `ChangePasswordResult`, `ChangePasswordForm`, `resetPasswordSchema`, `generateTempPassword`, `adminResetPassword`, `admin.resetPassword`, `ResetPasswordDialog`, `ForcedChangePassword`, `db.passwordResetLog`, cột `sessionVersion`/`mustChangePassword`, test id `temp-password`, message `MUST_CHANGE_PASSWORD`, cookie `authjs.session-token` dùng giống nhau ở mọi task.
- **Review Focus:** 5 dòng, mỗi dòng có test ở task sở hữu code (T4/T6 e2e cookie sau server action, T2/T3 token cũ, T5 tRPC + backup, T2 unit + e2e cookie hỏng, T1/T2 ngưỡng 8h).
