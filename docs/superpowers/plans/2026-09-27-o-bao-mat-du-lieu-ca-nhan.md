# O — Bảo mật dữ liệu cá nhân (mã hoá trường nhạy cảm, ô đồng ý, rà soát bảo mật) — Implementation Plan

> **CẬP NHẬT 2026-09-28 (Claude Code, người dùng chốt): R chen giữa K và O.** Thứ tự merge mới: P → Q → K → **R** (Đã nghỉ/Xoá rõ ràng + Dọn Thùng rác, spec `docs/superpowers/specs/2026-09-28-r-da-nghi-don-thung-rac-design.md`, v0.7.0) → O. Vì vậy **mọi chỗ trong file này: `0.7.0` đọc là `0.8.0`, `0.7.1` đọc là `0.8.1`, `0.6.x` đọc là `0.7.x`** (đã thay sẵn bên dưới). Task 1 phải thấy thêm commit merge R (`feat: merge feat/r-… → main`); thiếu → DỪNG. R thêm cột `purged_at` ở `students`/`subjects` và ẩn danh HS khi dọn Thùng rác (`fullName` = "Học sinh đã xoá", `parentPhone`/`parentName`/`notes`/`parentLinkToken` = null): HS đã dọn vẫn đi qua mã hoá như mọi HS (chuỗi "Học sinh đã xoá" cũng được mã hoá khi ghi); backfill O2 xử lý cả HS `purged_at` khác null.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người đọc được DB không đọc được họ tên HS, SĐT/tên phụ huynh, ghi chú, họ tên GV, số TK/tên chủ TK, link phụ huynh (AES-256-GCM ở tầng Prisma extension, khoá trong env Vercel); mọi chức năng tìm/sắp/phân trang chạy như cũ; lưu TK ngân hàng / tạo-sửa HS / nhập Excel phải tick ô đồng ý (server từ chối nếu thiếu, ghi bằng chứng); thêm trang `/privacy`, cảnh báo + nhật ký khi tải sao lưu, header bảo mật; script mã hoá dữ liệu cũ có dry-run/verify/rollback.

**Architecture:** Thư viện thuần `src/server/crypto/field-crypto.ts` (AES-256-GCM, định dạng `enc:v1:<kid>:<iv>:<ct>:<tag>`, keyring từ env `DATA_ENCRYPTION_KEYS`/`DATA_ENCRYPTION_ACTIVE_KID`). `withFieldEncryption(client)` (`src/server/crypto/prisma-encryption.ts`) bọc `db` trong `db.ts`: mã hoá mọi chuỗi dưới khoá thuộc tập trường mã hoá khi ghi, giải mã khi đọc (cả include lồng), chặn `where/orderBy` theo trường mã hoá. Tìm/sắp theo tên HS chuyển sang bộ nhớ (`src/lib/name-search.ts`) trước khi bật extension. Link phụ huynh tra bằng SHA-256 (cột mới). Đồng ý: `consent: z.literal(true)` trong input tRPC + bảng `consent_records`; nhật ký `security_events`. Dữ liệu cũ: script `scripts/crypto-backfill.ts` (lõi `src/server/crypto/backfill.ts`) chạy riêng ở giai đoạn O2.

**Tech Stack:** Next.js 15.5 App Router, React 19, tRPC v11, Prisma 5.22 (client extension `query.$allOperations`, `Prisma.dmmf`) + PostgreSQL (Neon prod, Docker test), `node:crypto` (AES-256-GCM, SHA-256), zod 3.25, NextAuth 5 beta.32, Radix Checkbox/AlertDialog (shadcn), sonner, exceljs, Vitest 4 (+ jsdom, Testing Library), Playwright, tsx.

**Spec:** `docs/superpowers/specs/2026-09-27-o-bao-mat-du-lieu-ca-nhan-design.md` (U1–U5 người dùng; Q1–Q21 người viết spec chọn — giữ nguyên trừ chỗ ghi ở "Điều chỉnh so với spec"; mục 5 bảng trường; mục 7 phát hiện F1–F19; mục 10 giai đoạn O1/O2/O3; mục 14 câu hỏi H1–H5). Plan viết khi `main` = `86b37ff` (N `0.4.0`). Thứ tự merge (người dùng chốt): P (sửa backlog) → Q (xoá mềm toàn app + thùng rác, spec `docs/superpowers/specs/2026-09-27-q-xoa-mem-design.md`) → K (Tổng quan + Doanh thu admin, bảng `user_activity_days`) → O. Mọi mô tả "code hiện tại" là code lúc viết; P/Q/K có thể đã đổi file dùng chung (đặc biệt Q: cột `is_deleted`/`deleted_at`, có thể thêm extension/điều kiện lọc trong `db.ts` và service; spec O mục 6.13).

## Giai đoạn triển khai (mỗi giai đoạn merge/deploy riêng)

| Giai đoạn | Nhánh | Task | Deploy | Điều kiện bắt đầu | Điều kiện kết thúc / chuyển tiếp |
|---|---|---|---|---|---|
| **O1** | `feat/o-bao-mat-du-lieu` (từ `main` sau khi P, Q, K đã merge) | 1 → 10 | merge `--no-ff` + push → `0.8.0`, Vercel tự `prisma migrate deploy` | P, Q, K đã merge vào `main` | Người dùng đã đặt khoá prod ở Vercel Production + lưu dự phòng 2 nơi; Neon branch `backup-before-O1-<ngày>`; review cuối xanh. Sau deploy: kiểm spec mục 10 "Kiểm sau deploy O1" |
| **O2** | không có nhánh (không code) | — (runbook spec mục 10) | không deploy | O1 chạy ổn ≥ 24h, log không có `FieldDecryptError`/`FieldCryptoConfigError`/`EncryptedFieldQueryError`, người dùng duyệt | Người điều phối chạy `--dry-run` → `--apply` → `--verify` (mã thoát 0, checksum khớp), `--apply` lần 2 `changed = 0`; người dùng kiểm web |
| **O3** | `feat/o3-don-dep-ma-hoa` (từ `main` sau O2) | 11 | merge + push → `0.8.1` | O2 `--verify` mã thoát 0 trên prod | Sau deploy: người dùng xoá Neon branch chứa bản rõ theo lịch (spec 6.12) |

**Agent thực hiện task KHÔNG merge, KHÔNG push, KHÔNG chạy script lên prod.** Merge/deploy và O2 là việc của người điều phối sau khi người dùng duyệt.

## Global Constraints

- **AN TOÀN DB:** trước mọi lệnh chạm DB (kể cả `pnpm test`, `pnpm exec playwright test`, lệnh `prisma`, `scripts/crypto-backfill.ts`) đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, Neon, host `ep-polished-voice…`) KHÁC `.env.test` (Postgres local Docker `student-test-pg`, `localhost:5433`). **Không bao giờ sửa/ghi `.env`**, chỉ đọc host để so sánh (không in mật khẩu). Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`). Mọi file test (kể cả unit) chạy `tests/setup.ts` có kết nối DB → Docker Postgres phải đang chạy; lỗi kết nối DB thì DỪNG, báo người điều phối.
- **Migration:** KHÔNG dùng `pnpm db:migrate:*` / `scripts/migrate-dev.ts`. Tạo bằng `DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name <x>` (Bash, chỉ nạp 2 biến của `.env.test`, có chốt `localhost:5433`), đọc lại SQL, áp bằng `... pnpm exec prisma migrate deploy` lên DB test, kiểm dòng `Datasource "db": ... at "localhost:5433"`. KHÔNG áp lên prod thủ công (Vercel tự `prisma migrate deploy` khi build sau merge). Không destructive (không `DROP`/`TRUNCATE`/`DELETE`/`RENAME`; `ALTER COLUMN ... SET DATA TYPE TEXT` là nới cột, được phép). Prisma báo drift / đòi reset / hỏi xác nhận mất dữ liệu → DỪNG, báo người điều phối.
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push` (mọi dạng, kể cả `--force-reset`), `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`, `git stash`. Build kiểm bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị `.env.test`.
- **Script backfill** chỉ chạy trên DB test trong task (`CONFIRM_HOST=localhost:5433`). Chạy lên prod là việc người điều phối ở O2 sau khi người dùng duyệt. Không ghi URL/khoá prod vào bất kỳ file nào.
- **Khoá mã hoá:** khoá test đặt trong `.env.test` (gitignore; agent sinh ở Task 1). **Không commit khoá thật hay khoá test.** `.env.test.example` / `.env.example` chỉ ghi tên biến + lệnh sinh. Không in khoá ra log/báo cáo. Không bao giờ đặt khoá vào `.env`.
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ ~10–15 phút.
- **E2E:** `pnpm exec playwright test <file>` (cổng 3000; `playwright.config.ts` tự khởi `pnpm dev` với DB `.env.test`, `reuseExistingServer: false`). Cổng 3000 bận → không tắt tiến trình đó, DỪNG và báo. Trước lượt e2e đầu tiên của mỗi task chạy `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp lại seed). E2E ghi DB bằng Prisma trực tiếp phải kiểm `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` trong `beforeAll` (mẫu `tests/e2e/admin.spec.ts`). Tài khoản seed (mật khẩu `teacher123`): `teacher`, `teacher2` (Pro tới 2099), `teacher_std`, `admin_test`. Không nhập credential vào trình duyệt trên production; không ghi dữ liệu production.
- Giờ theo VN (UTC+7) như code sẵn có. i18n: `src/language/vi.json` và `en.json` cùng bộ key (`tsc` bắt thiếu key ở `en`); chuỗi mới không dùng gạch dài (—, –).
- Màu (A3): nhấn `primary` (#0F766E), trung tính slate, lỗi đỏ như code sẵn có; không indigo/violet/purple (`tests/unit/theme-legacy-colors.test.ts` phải pass). Nút/vùng chạm ≥ 44px trên mobile: `h-11 md:h-10`, dòng checkbox `min-h-11`.
- `tests/unit/next15-contract.test.ts` đỏ nếu `page.tsx`/`layout.tsx` có định danh `params`/`searchParams` (kể cả trong comment) → trang `/privacy` không đọc query.
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ lý do/ràng buộc/bẫy. **Không log giá trị dữ liệu cá nhân, khoá, hay input người dùng** ở bất kỳ `console.*` mới nào.
- Giữ kiểu xuống dòng của từng file (LF, `core.autocrlf=true`); không đổi hàng loạt xuống dòng.
- Làm trên nhánh của giai đoạn (bảng trên). **Không commit lên `main`.** Không đụng file untracked của người khác.
- **Đối chiếu code thật:** trước khi sửa file dùng chung (`prisma/schema.prisma`, `src/server/db.ts`, các service `student/tuition/session/report/backup/parent-link/settings`, router `student/settings`, `src/lib/schemas/*`, `src/lib/types/models.ts`, `next.config.mjs`, `src/middleware.ts`, `playwright.config.ts`, i18n, `tests/setup.ts`, `tests/helpers/*`) đọc file thật. P/Q/K đổi chỗ nào khác plan (thêm query, thêm model, cột `is_deleted`/`deleted_at` + extension/điều kiện xoá mềm của Q, thùng rác, đổi dashboard/report, thêm procedure admin, bảng `user_activity_days` của K) → giữ code của P/Q/K, chèn phần của O theo đúng ý plan, ghi "Ruling: …" vào báo cáo task. Luật riêng với Q (spec Q: extension trong `db.ts` tự thêm `isDeleted: false` cho đọc cấp cao của `Student/Subject/TeachingSession/Payment`; hằng `WITH_DELETED`; `trash.service.ts`): spec O mục 6.13 (thùng rác cũng mã hoá; `withFieldEncryption` bọc ngoài cùng; tìm tên ở thùng rác cũng chuyển sang bộ nhớ; khôi phục không cần tick đồng ý).
- Mỗi task kết thúc: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit (chỉ `git add` đúng file của task). Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Code lệch plan vì code thật khác mô tả → theo code thật, giữ đúng hành vi spec, ghi lại trong báo cáo task.

## Điều chỉnh so với spec

1. **Thứ tự task**: tìm/sắp trong bộ nhớ (Task 3) làm **trước** khi bật extension (Task 4) như spec 6.4 yêu cầu; migration (Task 2) trước cả hai để cột đã TEXT khi Task 4 ghi ciphertext dài.
2. **`encryptField` luôn mã hoá chuỗi khác rỗng**, kể cả chuỗi người dùng gõ bắt đầu bằng `enc:v1:` (spec 6.1 đã sửa theo). Không có đường nào ghi ciphertext đã có trở lại qua `db` (mọi giá trị đọc qua `db` đã giải mã).
3. **Chặn lọc theo trường mã hoá chỉ xét TÊN KHOÁ** trong `where/orderBy/cursor/having` (và tên trường dạng chuỗi chỉ trong `distinct/by`) — không xét giá trị chuỗi, để username kiểu `"notes"` không bị chặn nhầm khi đăng nhập.
4. **Raw SQL đi qua `db` cũng qua `decryptResult`** (Prisma áp `$allOperations` gốc cho cả `$queryRaw`): cột raw trùng tên khoá (`notes`, `note`) sẽ được giải mã. Test đọc ciphertext thô phải đặt alias (`SELECT notes AS raw_notes`). Script backfill dùng `PrismaClient` thường (không extension).
5. **`ConsentCheckbox` dùng chung** (`src/components/common/ConsentCheckbox.tsx`, MỚI) cho 3 form thay vì lặp markup.
6. **`recordConsent` chỉ khi `update` thật sự có trường cá nhân** (`updateTouchesPersonalData`), kể cả khi client gửi `consent: CONSENT_ACCEPTED` cho cập nhật chỉ `isActive`.
7. **`ipAddress` cắt 45 ký tự** trước khi ghi `consent_records`/`security_events` (cột VarChar(45); header `x-forwarded-for` có thể dài bất thường).
8. **`/api/backup` đổi chữ ký thành `GET(request: Request)`** để đọc IP; 5 lời gọi `GET()` trong `tests/integration/backup-route.test.ts` đổi sang `GET(req())`.
9. **Codemod test** (Task 6): script tạm trong scratchpad thêm `consent: CONSENT_ACCEPTED` vào mọi lời gọi caller `.student.create({` / `.student.update({` / `.student.importMany({` (không phải lời gọi Prisma có `data:`/`where:` ngay sau) và `'student.create', {` trong e2e; `updateBankAccount(` sửa tay. Thêm `consent: CONSENT_ACCEPTED` cho mọi `student.update` của caller là vô hại (spec Q10 cho phép gửi khi không cần).
10. **Matcher `/privacy`**: thêm `privacy` giống `login|register` (cũng mở `/privacyx` — không có route nên 404, vô hại); tránh nhóm con trong lookahead mà path-to-regexp có thể không nhận.
11. **E2E**: chỉ `parent-link.spec.ts` đổi (ghi thêm `parentLinkTokenHash`). Các e2e khác tạo dữ liệu bằng `new PrismaClient()` ghi bản rõ → vẫn đọc được (định dạng cũ), giữ nguyên; `plan-locks.spec.ts` còn `deleteMany({ where: { fullName: { startsWith } } })` trên client thường → không bị chặn, chạy được.
12. **Version**: Task 10 nâng `0.8.0` bằng commit riêng trước lượt e2e/build cuối; Task 11 nâng `0.8.1`.
13. Spec + plan O đang untracked trên `main` → Task 1 commit cả hai lên nhánh O1 trước khi code.
14. Plan có **11 task** (O1: 1–10, O3: 11). O2 không có task code (runbook ở spec mục 10, người điều phối chạy).

## Cập nhật theo trả lời của người dùng (H1–H5, 2026-09-27) — ƯU TIÊN hơn mọi chỗ khác

- **H2**: trang **Đăng ký** có ô đồng ý **bắt buộc**. Mọi màn có ô đồng ý (Đăng ký, TK ngân hàng, form HS tạo/sửa, nhập Excel) gửi kèm **một key thống nhất** trong payload của đúng API: `consent: { accepted: true, version: CONSENT_TEXT_VERSION }` (hằng `CONSENT_ACCEPTED`, schema `consentPayload`); server bắt buộc (version lệch → từ chối) và ghi `consent_records` (thêm scope `register`). Ô đồng ý **không** có link sang `/privacy`. Link `/privacy` đặt ở `/login` (bắt buộc) và chữ nhỏ ở chân `/register`.
- **H3**: sao lưu Excel không mật khẩu; giữ cảnh báo + nhật ký (như Task 8).
- **H4**: xoá vĩnh viễn làm ở **phần R riêng sau O** (không có task trong plan này); yêu cầu cho R ghi ở spec O mục 8.
- **H5**: trang Đăng ký có dòng gợi ý "Không nên dùng số điện thoại làm tên đăng nhập." (không chặn).
- **H1**: chưa trả lời → `PRIVACY_CONTACT` đọc `NEXT_PUBLIC_PRIVACY_CONTACT`, mặc định "email/Zalo của chủ ứng dụng"; người dùng điền env trước khi merge O1.

## Review Focus

1. **Còn chỗ lọc/sắp DB theo trường mã hoá** (P/Q/K có thể vừa thêm query `orderBy fullName`, lọc `notes`…, vd thùng rác của Q): người dùng mong tìm/sắp vẫn đúng, không lỗi 500. Pin: Task 4 chạy **full** `pnpm test` + Task 10 full e2e; extension ném `EncryptedFieldQueryError` nên chỗ sót nổ ngay. Task 3 Step 1 grep toàn `src/server` trước khi sửa.
2. **Bản ghi bản rõ cũ (trước O2) và bản ghi mã hoá mới cùng tồn tại**: danh sách, tìm, phiếu học phí, trang phụ huynh, sao lưu phải hiện đúng cả hai. Pin: Task 4 `tests/integration/field-encryption.test.ts` ("bản rõ chèn bằng raw vẫn đọc đúng và tìm được").
3. **Thiếu/sai khoá**: không bao giờ ghi bản rõ, lỗi không chứa dữ liệu/khoá. Pin: Task 1 unit `field-crypto.test.ts` ("thiếu env → FieldCryptoConfigError", "message không chứa khoá/bản rõ") + Task 4 unit ("encryptWriteArgs ném khi thiếu khoá").
4. **Gọi thẳng tRPC không có `consent`** (client cũ, script): server từ chối và **không ghi** dữ liệu. Pin: Task 6 `tests/integration/consent.test.ts` ("thiếu consent → BAD_REQUEST, count HS không đổi").
5. **Link phụ huynh tạo trước O1** phải còn mở được sau deploy (migration tự tính hash) và sau O2 (token bị mã hoá). Pin: Task 2 `o-migration.test.ts` (hash SQL = `hashParentToken`) + Task 5 `parent-link.test.ts` ("token cũ chỉ có bản rõ + hash từ SQL → getParentView trả dữ liệu") + Task 9 `crypto-backfill.test.ts` ("sau apply, link vẫn mở được").

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `src/server/crypto/field-crypto.ts` | Mới | AES-256-GCM, định dạng, keyring từ env | 1 |
| `tests/unit/crypto/field-crypto.test.ts` | Mới | Thư viện mã hoá | 1 |
| `.env.test` (cục bộ, KHÔNG commit) | Sửa | Khoá test `t1` | 1 |
| `.env.test.example`, `.env.example` | Sửa | Tên biến + lệnh sinh khoá | 1 |
| `playwright.config.ts` | Sửa | Truyền 2 biến khoá cho `pnpm dev` | 1 |
| `prisma/schema.prisma` | Sửa | Nới 7 cột TEXT, `parentLinkTokenHash`, `ConsentRecord`, `SecurityEvent` | 2 |
| `prisma/migrations/<ts>_o_encryption_consent/migration.sql` | Mới | Migration O1 (có câu UPDATE tính hash) | 2 |
| `tests/integration/o-migration.test.ts` | Mới | SQL không destructive, cột TEXT, hash | 2 |
| `tests/setup.ts` | Sửa | Xoá 2 bảng mới khi reset | 2 |
| `src/lib/name-search.ts` | Mới | Lọc/sắp tên trong bộ nhớ | 3 |
| `tests/unit/lib/name-search.test.ts` | Mới | | 3 |
| `src/server/services/student.service.ts` | Sửa | `listStudents` bộ nhớ, `findStudentIdsByName` (T3); `toStudentDTO` bỏ hash (T5) | 3, 5 |
| `src/server/services/tuition.service.ts`, `session.service.ts`, `report.service.ts`, `backup.service.ts` | Sửa | Bỏ lọc/sắp DB theo tên (T3); backup thêm dòng Lưu ý (T8) | 3, 8 |
| `tests/integration/name-search.test.ts` | Mới | Tìm/sắp/phân trang/multi-tenant | 3 |
| `src/server/crypto/prisma-encryption.ts` | Mới | Extension, map trường, chặn lọc | 4 |
| `src/server/db.ts` | Sửa | Bọc extension | 4 |
| `scripts/create-user.ts`, `scripts/list-users.ts`, `prisma/seed.ts` | Sửa | Dùng extension | 4 |
| `tests/unit/crypto/prisma-encryption.test.ts` | Mới | Đi cây, chặn lọc, DMMF | 4 |
| `tests/integration/field-encryption.test.ts` | Mới | Raw là ciphertext, đọc ra bản rõ, bản rõ cũ | 4 |
| `src/server/crypto/parent-token.ts` | Mới | `hashParentToken` | 5 |
| `src/server/services/parent-link.service.ts` | Sửa | Ghi/tra hash | 5 |
| `src/lib/types/models.ts` | Sửa | `StudentDTO` bỏ `parentLinkTokenHash` | 5 |
| `tests/integration/parent-link.test.ts`, `tests/e2e/parent-link.spec.ts` | Sửa | Hash | 5 |
| `src/lib/consent.ts` | Mới | Version, scope, `consentPayload`, `updateTouchesPersonalData` | 6 |
| `src/server/services/consent.service.ts` | Mới | `recordConsent`, `assertUpdateConsent` | 6 |
| `src/server/services/security-event.service.ts` | Mới | `logSecurityEvent` | 6 |
| `src/lib/schemas/settings.ts`, `src/lib/schemas/student.ts` | Sửa | Cờ `consent` | 6 |
| `src/server/trpc/routers/settings.ts`, `student.ts` | Sửa | Ghi đồng ý + sự kiện (T6); sự kiện link (T8) | 6, 8 |
| `tests/unit/lib/consent.test.ts`, `tests/integration/consent.test.ts` | Mới | | 6 |
| `tests/integration/*.test.ts`, `tests/e2e/*.spec.ts` gọi `student.create/update/importMany`, `updateBankAccount` | Sửa | Thêm `consent: CONSENT_ACCEPTED` (codemod) | 6 |
| `src/components/common/ConsentCheckbox.tsx` | Mới | Ô đồng ý + link chính sách | 7 |
| `src/components/settings/BankAccountCard.tsx`, `students/StudentFormDialog.tsx`, `students/ImportStudentsDialog.tsx` | Sửa | Ô đồng ý | 7 |
| `src/app/privacy/page.tsx`, `src/components/privacy/PrivacyContent.tsx` | Mới | Trang chính sách | 7 |
| `src/middleware.ts`, `tests/unit/middleware-matcher.test.ts` | Sửa | `/privacy` công khai | 7 |
| `src/app/login/LoginForm.tsx`, `src/app/register/RegisterForm.tsx` | Sửa | Link chính sách ở chân | 7 |
| `src/language/vi.json`, `en.json` | Sửa | `consent_*`, `privacy_*` (T7); `backup_confirm_*` (T8) | 7, 8 |
| `tests/unit/components/ConsentCheckbox.test.tsx`, `StudentFormDialog.test.tsx` (Mới), `ImportStudentsDialog.test.tsx` (Sửa) | | | 7 |
| e2e tạo HS/lưu TK qua UI | Sửa | Tick ô đồng ý | 7 |
| `src/components/layout/BackupConfirmDialog.tsx`, `AppHeader.tsx` | Mới / Sửa | Hộp cảnh báo sao lưu | 8 |
| `src/app/api/backup/route.ts` | Sửa | `GET(request)`, ghi `backup_download` | 8 |
| `next.config.mjs`, `tests/unit/security-headers.test.ts` | Sửa / Mới | Header bảo mật | 8 |
| `tests/integration/security-events.test.ts`, `backup-route.test.ts` | Mới / Sửa | | 8 |
| `src/server/crypto/backfill.ts`, `scripts/crypto-backfill.ts` | Mới | Mã hoá dữ liệu cũ | 9 |
| `tests/integration/crypto-backfill.test.ts` | Mới | | 9 |
| `tests/e2e/consent-privacy.spec.ts` | Mới | Luồng đồng ý, `/privacy`, cảnh báo sao lưu | 10 |
| `package.json` | Sửa | `0.8.0` (T10), `0.8.1` (T11) | 10, 11 |
| `docs/05-deploy.md` | Sửa | Mục "Khoá mã hoá dữ liệu" | 11 |

Thứ tự bắt buộc (tuần tự, mỗi task 1 agent mới): Task 1 → 2 → … → 10 (O1) → [merge O1, O2 của người điều phối] → Task 11 (O3). T2 cần không gì (nhưng chung nhánh T1); T3 cần không gì của T1/T2 về code nhưng chạy trên schema T2; T4 cần `field-crypto` (T1), cột TEXT (T2), không còn lọc DB theo tên (T3); T5 cần extension (T4) + cột hash (T2); T6 cần bảng `consent_records`/`security_events` (T2); T7 cần schema cờ `consent` (T6); T8 cần `logSecurityEvent` (T6); T9 cần `field-crypto` + `ENCRYPTED_FIELDS` (T1, T4); T10 cần tất cả; T11 cần O1 đã merge + O2 xong.

---

### Task 1: Nhánh, thư viện mã hoá AES-256-GCM, khoá test

**Đọc trước:** Global Constraints; "Giai đoạn triển khai"; "Điều chỉnh so với spec" ý 2, 13; spec mục 4 (Q1–Q4), 6.1, 6.2, 11 (Unit `field-crypto`); `docs/coding-rule.md` §6.1; `tests/env-setup.ts` (thấy `.env.test` được nạp toàn bộ vào `process.env`); `playwright.config.ts`; `.env.test.example`; `.env.example`.

**Files:**
- Create: `src/server/crypto/field-crypto.ts`
- Test (Mới): `tests/unit/crypto/field-crypto.test.ts`
- Modify: `.env.test` (cục bộ, không commit), `.env.test.example`, `.env.example`, `playwright.config.ts`

**Interfaces:**
- Consumes: không.
- Produces (`src/server/crypto/field-crypto.ts`):
  - `ENC_PREFIX = "enc:v1:"`
  - `class FieldCryptoConfigError extends Error`, `class FieldDecryptError extends Error`
  - `loadKeyring(): { active: string; keys: Map<string, Buffer> }`
  - `isEncrypted(value: unknown): value is string`
  - `encryptField(plain: string, field: string): string`
  - `decryptField(stored: string, field: string): string`
  - `readKid(stored: string): string | null`
  - Env: `DATA_ENCRYPTION_KEYS="t1:<base64 32 byte>"`, `DATA_ENCRYPTION_ACTIVE_KID="t1"` trong `.env.test`.

- [ ] **Step 0: Kiểm P, Q, K đã merge; tạo nhánh; commit spec + plan**

Run (Bash):
```bash
git checkout main
git pull --ff-only
git log --oneline -25 main
grep '"version"' package.json
git status --short
```
Expected: log `main` có commit merge của cả 3 phần theo thứ tự P (sửa backlog) → Q (xoá mềm, kiểu `feat: merge feat/q-… → main`) → K (Tổng quan + Doanh thu admin, kiểu `feat: merge feat/k-… → main`) → R (Đã nghỉ/Dọn Thùng rác, kiểu `feat: merge feat/r-… → main`). Thiếu merge R, K (hoặc Q) → **DỪNG, báo người điều phối "K (hoặc Q) chưa merge", không tạo nhánh.** Ghi `version` hiện tại vào báo cáo (theo spec Q/K: Q `0.5.0`, K `0.6.0`, R `0.7.0` → mong đợi `0.7.x`; Task 10 nâng lên `0.8.0`; nếu version hiện tại đã ≥ `0.8.0` → DỪNG, hỏi người điều phối số version). `git status --short` có 2 file untracked của O (spec + plan O); file khác của người dùng thì kệ, KHÔNG add.

Ghi vào báo cáo: (a) Q thêm những cột/bảng nào (tên cột xoá mềm, bảng thùng rác, có cột chữ tự do nào chứa dữ liệu cá nhân không — spec O 6.13 ý 5), Q có sửa `src/server/db.ts` (thêm extension) không; (b) K có thêm procedure/trang admin nào đọc dữ liệu học sinh / tài khoản ngân hàng của GV không (`git log -p` của commit merge K, tìm `db.student`, `bankAccount` trong `src/server/services/*admin*`, `src/server/trpc/routers/admin.ts`). Có → ghi "Phát hiện F17b" để người điều phối báo người dùng (không tự sửa).

Run:
```bash
git checkout -b feat/o-bao-mat-du-lieu
git add docs/superpowers/specs/2026-09-27-o-bao-mat-du-lieu-ca-nhan-design.md docs/superpowers/plans/2026-09-27-o-bao-mat-du-lieu-ca-nhan.md
git commit -m "docs(o): spec + plan bảo mật dữ liệu cá nhân

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 1: Sinh khoá test vào `.env.test` (không in khoá)**

Run (Bash):
```bash
grep -c '^DATA_ENCRYPTION_' .env || true
grep -q '^DATA_ENCRYPTION_KEYS=' .env.test || {
  K=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")
  printf '\n# Khoá mã hoá CHỈ cho DB test (spec O 6.2). Không dùng cho prod.\nDATA_ENCRYPTION_KEYS="t1:%s"\nDATA_ENCRYPTION_ACTIVE_KID="t1"\n' "$K" >> .env.test
}
grep -c '^DATA_ENCRYPTION_' .env.test
git check-ignore .env.test && echo "gitignore OK"
```
Expected: dòng đầu `0` (`.env` không có khoá; nếu > 0 → ghi vào báo cáo "`.env` đang chứa biến khoá — người dùng nên xoá", KHÔNG sửa `.env`); `2`; `gitignore OK`.

- [ ] **Step 2: Ghi tên biến vào file mẫu + Playwright**

`.env.test.example` thêm cuối file:
```
# Khoá mã hoá dữ liệu cá nhân cho DB test (spec O). Sinh bằng:
# node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
DATA_ENCRYPTION_KEYS="t1:<dán khoá vừa sinh>"
DATA_ENCRYPTION_ACTIVE_KID="t1"
```
`.env.example` thêm cuối file:
```
# === MÃ HOÁ DỮ LIỆU CÁ NHÂN (spec O) ===
# Prod: chỉ đặt ở Vercel (Production, Sensitive). LƯU DỰ PHÒNG TRƯỚC khi dán: mất khoá = mất dữ liệu.
# Sinh: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
DATA_ENCRYPTION_KEYS=""
DATA_ENCRYPTION_ACTIVE_KID=""
```
`playwright.config.ts`, trong `webServer.env` thêm 2 dòng sau `DIRECT_URL`:
```ts
      // Truyền tường minh để Next không đọc nhầm khoá từ .env (spec O 6.2).
      DATA_ENCRYPTION_KEYS: requireEnv('DATA_ENCRYPTION_KEYS'),
      DATA_ENCRYPTION_ACTIVE_KID: requireEnv('DATA_ENCRYPTION_ACTIVE_KID'),
```

- [ ] **Step 3: Viết test đỏ `tests/unit/crypto/field-crypto.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { randomBytes } from "node:crypto"
import {
  ENC_PREFIX,
  FieldCryptoConfigError,
  FieldDecryptError,
  decryptField,
  encryptField,
  isEncrypted,
  readKid,
} from "@/server/crypto/field-crypto"

// Các file test chạy chung 1 tiến trình (singleFork) → phải trả env về như cũ.
const ORIGINAL = { keys: process.env.DATA_ENCRYPTION_KEYS, active: process.env.DATA_ENCRYPTION_ACTIVE_KID }
const K1 = randomBytes(32).toString("base64")
const K2 = randomBytes(32).toString("base64")
function setEnv(keys: string | undefined, active: string | undefined) {
  if (keys === undefined) delete process.env.DATA_ENCRYPTION_KEYS
  else process.env.DATA_ENCRYPTION_KEYS = keys
  if (active === undefined) delete process.env.DATA_ENCRYPTION_ACTIVE_KID
  else process.env.DATA_ENCRYPTION_ACTIVE_KID = active
}

beforeEach(() => setEnv(`k1:${K1}`, "k1"))
afterAll(() => setEnv(ORIGINAL.keys, ORIGINAL.active))

const FORMAT = /^enc:v1:[a-z0-9]{1,8}:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]*:[A-Za-z0-9_-]{22}$/

describe("field-crypto (spec O 6.1)", () => {
  it("khứ hồi tiếng Việt có dấu, emoji, chuỗi dài; đúng định dạng", () => {
    for (const plain of ["Nguyễn Thị Ánh Tuyết", "0901234567", "Bé hay ốm 🤒", "x".repeat(1000)]) {
      const enc = encryptField(plain, "fullName")
      expect(enc).toMatch(FORMAT)
      expect(enc.startsWith(ENC_PREFIX)).toBe(true)
      expect(enc).not.toContain(plain)
      expect(decryptField(enc, "fullName")).toBe(plain)
    }
  })

  it("IV ngẫu nhiên: 2 lần mã hoá cùng chuỗi ra 2 kết quả khác nhau", () => {
    expect(encryptField("An", "fullName")).not.toBe(encryptField("An", "fullName"))
  })

  it("chuỗi rỗng giữ nguyên; bản rõ cũ (không tiền tố) đọc ra nguyên", () => {
    expect(encryptField("", "notes")).toBe("")
    expect(decryptField("Bản rõ cũ", "notes")).toBe("Bản rõ cũ")
    expect(isEncrypted("Bản rõ cũ")).toBe(false)
    expect(isEncrypted(null)).toBe(false)
  })

  it("chuỗi người dùng gõ bắt đầu bằng enc:v1: vẫn được mã hoá và giải mã đúng", () => {
    const typed = "enc:v1:đây là ghi chú"
    const enc = encryptField(typed, "notes")
    expect(enc).not.toBe(typed)
    expect(decryptField(enc, "notes")).toBe(typed)
  })

  it("sửa ciphertext/tag hoặc giải mã với trường khác (AAD) → FieldDecryptError, message không chứa bản rõ", () => {
    const enc = encryptField("Trần Văn Bình", "fullName")
    const parts = enc.split(":")
    const flip = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1)
    const badCt = [...parts.slice(0, 4), flip(parts[4]), parts[5]].join(":")
    const badTag = [...parts.slice(0, 5), flip(parts[5])].join(":")
    for (const [value, field] of [[badCt, "fullName"], [badTag, "fullName"], [enc, "bankAccountName"]] as const) {
      let err: unknown
      try { decryptField(value, field) } catch (e) { err = e }
      expect(err).toBeInstanceOf(FieldDecryptError)
      expect(String((err as Error).message)).not.toContain("Trần Văn Bình")
    }
  })

  it("kid không có khoá → FieldDecryptError", () => {
    const enc = encryptField("An", "fullName")
    setEnv(`k2:${K2}`, "k2")
    expect(() => decryptField(enc, "fullName")).toThrow(FieldDecryptError)
  })

  it("xoay khoá: ghi bằng khoá active, vẫn đọc được bản cũ kid khác", () => {
    const old = encryptField("An", "fullName")
    setEnv(`k1:${K1},k2:${K2}`, "k2")
    const fresh = encryptField("Bình", "fullName")
    expect(readKid(old)).toBe("k1")
    expect(readKid(fresh)).toBe("k2")
    expect(decryptField(old, "fullName")).toBe("An")
    expect(decryptField(fresh, "fullName")).toBe("Bình")
    expect(readKid("Bản rõ")).toBeNull()
  })

  it("cấu hình sai → FieldCryptoConfigError, message không chứa khoá", () => {
    const cases: [string | undefined, string | undefined][] = [
      [undefined, "k1"],
      [`k1:${K1}`, undefined],
      [`k1:${K1}`, "k9"],
      [`k1:${randomBytes(16).toString("base64")}`, "k1"],
      [`K_1:${K1}`, "K_1"],
      [`k1:${K1},k1:${K2}`, "k1"],
    ]
    for (const [keys, active] of cases) {
      setEnv(keys, active)
      let err: unknown
      try { encryptField("An", "fullName") } catch (e) { err = e }
      expect(err, `${keys}|${active}`).toBeInstanceOf(FieldCryptoConfigError)
      expect(String((err as Error).message)).not.toContain(K1)
      expect(String((err as Error).message)).not.toContain(K2)
    }
  })
})
```

- [ ] **Step 4: Chạy test, thấy đỏ**

Run: `pnpm test tests/unit/crypto/field-crypto.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/crypto/field-crypto"`.

- [ ] **Step 5: Viết `src/server/crypto/field-crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

// Định dạng tự mô tả (spec O Q2): đọc được cả bản rõ cũ lẫn bản mã hoá trong giai đoạn chuyển.
export const ENC_PREFIX = "enc:v1:"
const KID_RE = /^[a-z0-9]{1,8}$/
const IV_BYTES = 12
const TAG_BYTES = 16

export class FieldCryptoConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FieldCryptoConfigError"
  }
}

export class FieldDecryptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FieldDecryptError"
  }
}

type Keyring = { active: string; keys: Map<string, Buffer> }
let cache: { raw: string; ring: Keyring } | null = null

// Đọc lười ở lần dùng đầu: `next build` không cần khoá. Cache theo chuỗi env để test đổi env được.
export function loadKeyring(): Keyring {
  const rawKeys = process.env.DATA_ENCRYPTION_KEYS ?? ""
  const active = process.env.DATA_ENCRYPTION_ACTIVE_KID ?? ""
  const raw = `${rawKeys}|${active}`
  if (cache?.raw === raw) return cache.ring
  if (!rawKeys.trim()) throw new FieldCryptoConfigError("Thiếu DATA_ENCRYPTION_KEYS")
  const keys = new Map<string, Buffer>()
  for (const part of rawKeys.split(",")) {
    const i = part.indexOf(":")
    const kid = i > 0 ? part.slice(0, i).trim() : ""
    if (!KID_RE.test(kid)) throw new FieldCryptoConfigError("DATA_ENCRYPTION_KEYS: kid phải gồm 1-8 ký tự a-z0-9")
    if (keys.has(kid)) throw new FieldCryptoConfigError(`DATA_ENCRYPTION_KEYS: trùng kid ${kid}`)
    const key = Buffer.from(part.slice(i + 1).trim(), "base64")
    if (key.length !== 32) throw new FieldCryptoConfigError(`DATA_ENCRYPTION_KEYS: khoá ${kid} phải là 32 byte base64`)
    keys.set(kid, key)
  }
  if (!keys.has(active)) {
    throw new FieldCryptoConfigError("DATA_ENCRYPTION_ACTIVE_KID không có trong DATA_ENCRYPTION_KEYS")
  }
  const ring = { active, keys }
  cache = { raw, ring }
  return ring
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENC_PREFIX)
}

// AAD = tên trường: không chép được ciphertext số TK sang trường tên (hiện trên trang công khai).
export function encryptField(plain: string, field: string): string {
  if (plain === "") return ""
  const { active, keys } = loadKeyring()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", keys.get(active)!, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(field, "utf8"))
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}${active}:${iv.toString("base64url")}:${ct.toString("base64url")}:${tag.toString("base64url")}`
}

export function readKid(stored: string): string | null {
  if (!isEncrypted(stored)) return null
  const kid = stored.split(":")[2] ?? ""
  return KID_RE.test(kid) ? kid : null
}

// Lỗi chỉ nêu trường + kid: không bao giờ đưa giá trị vào message (message đi vào log).
export function decryptField(stored: string, field: string): string {
  if (!isEncrypted(stored)) return stored
  const parts = stored.split(":")
  const kid = readKid(stored)
  const fail = () => new FieldDecryptError(`Không giải mã được trường ${field} (kid=${kid ?? "?"})`)
  if (parts.length !== 6 || !kid) throw fail()
  const key = loadKeyring().keys.get(kid)
  if (!key) throw fail()
  const iv = Buffer.from(parts[3], "base64url")
  const ct = Buffer.from(parts[4], "base64url")
  const tag = Buffer.from(parts[5], "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw fail()
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES })
    decipher.setAAD(Buffer.from(field, "utf8"))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
  } catch {
    throw fail()
  }
}
```

- [ ] **Step 6: Chạy test, thấy xanh**

Run: `pnpm test tests/unit/crypto/field-crypto.test.ts`
Expected: PASS (8 test).

- [ ] **Step 7: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sạch.

```bash
git status --short   # .env.test KHÔNG được xuất hiện (gitignore)
git add src/server/crypto/field-crypto.ts tests/unit/crypto/field-crypto.test.ts .env.test.example .env.example playwright.config.ts
git commit -m "feat(o): thư viện mã hoá trường AES-256-GCM (enc:v1:kid), keyring từ env, khoá test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 2: Migration O1 (nới cột TEXT, hash link phụ huynh, 2 bảng mới)

**Đọc trước:** Global Constraints (AN TOÀN DB, Migration); spec mục 5 (cột nào nới), 6.5, 13; `prisma/schema.prisma` (thật — Q đã thêm `is_deleted`/`deleted_at`, K thêm `UserActivityDay`; spec O 6.13 ý 5 về cột chữ tự do mới của Q); `tests/integration/session-migration.test.ts` (mẫu test đọc SQL); `tests/setup.ts` (khối reset).

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_o_encryption_consent/migration.sql` (Prisma sinh + tay thêm 1 câu `UPDATE`)
- Modify: `tests/setup.ts`
- Test (Mới): `tests/integration/o-migration.test.ts`

**Interfaces:**
- Consumes: không.
- Produces:
  - Prisma: `User.fullName/bankAccountNumber/bankAccountName: string | null` (TEXT); `Student.fullName: string`, `parentPhone/parentName/parentLinkToken: string | null` (TEXT); `Student.parentLinkTokenHash: string | null` (`@unique`, VarChar(64)).
  - `db.consentRecord` (`id, userId, scope, textVersion, studentId: number | null, itemCount, ipAddress: string | null, createdAt`).
  - `db.securityEvent` (`id, userId, event, ipAddress: string | null, createdAt`).

- [ ] **Step 1: Sửa `prisma/schema.prisma`**

Model `User` (giữ nguyên các dòng khác):
```prisma
  fullName      String?           @map("full_name")
  ...
  bankAccountNumber String?           @map("bank_account_number")
  bankAccountName   String?           @map("bank_account_name")
```
Model `Student`:
```prisma
  fullName        String           @map("full_name")
  parentPhone     String?          @map("parent_phone")
  parentName      String?          @map("parent_name")
  ...
  parentLinkToken String?          @unique @map("parent_link_token")
  // SHA-256 hex của token để tra cứu; token thật được mã hoá (spec O Q9).
  parentLinkTokenHash String?      @unique @map("parent_link_token_hash") @db.VarChar(64)
```
Thêm cuối file:
```prisma
// Bằng chứng đồng ý chia sẻ dữ liệu (spec O Q11). Không FK: tests/setup.ts xoá users mỗi lượt.
model ConsentRecord {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  scope       String   @db.VarChar(20)
  textVersion String   @map("text_version") @db.VarChar(20)
  studentId   Int?     @map("student_id")
  itemCount   Int      @default(1) @map("item_count")
  ipAddress   String?  @map("ip_address") @db.VarChar(45)
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@map("consent_records")
}

// Nhật ký thao tác nhạy cảm, không lưu giá trị dữ liệu (spec O Q15). Không FK như trên.
model SecurityEvent {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  event     String   @db.VarChar(30)
  ipAddress String?  @map("ip_address") @db.VarChar(45)
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@map("security_events")
}
```

- [ ] **Step 2: Tạo migration trên DB test (chỉ tạo, chưa áp)**

Run (Bash):
```bash
TEST_URL=$(grep -E '^DATABASE_URL=' .env.test | cut -d= -f2- | tr -d '"')
TEST_DIRECT=$(grep -E '^DIRECT_URL=' .env.test | cut -d= -f2- | tr -d '"')
case "$TEST_URL" in *localhost:5433*) ;; *) echo "DỪNG: .env.test không trỏ localhost:5433"; exit 1;; esac
DATABASE_URL="$TEST_URL" DIRECT_URL="$TEST_DIRECT" pnpm exec prisma migrate dev --create-only --name o_encryption_consent
ls prisma/migrations | tail -3
```
Expected: in `Datasource "db": PostgreSQL database ... at "localhost:5433"`, tạo thư mục `<ts>_o_encryption_consent`. Prisma báo drift / đòi reset / hỏi xác nhận mất dữ liệu → **DỪNG, báo người điều phối.**

- [ ] **Step 3: Đọc SQL, thêm câu tính hash**

SQL Prisma sinh phải gồm (thứ tự có thể khác): 7 câu `ALTER TABLE ... ALTER COLUMN "<cột>" SET DATA TYPE TEXT` (`users`: `full_name`, `bank_account_number`, `bank_account_name`; `students`: `full_name`, `parent_phone`, `parent_name`, `parent_link_token`), `ALTER TABLE "students" ADD COLUMN "parent_link_token_hash" VARCHAR(64)`, `CREATE TABLE "consent_records"`, `CREATE TABLE "security_events"`, các `CREATE INDEX`, `CREATE UNIQUE INDEX "students_parent_link_token_hash_key"`. Có `DROP` bất kỳ → DỪNG, báo.

Chèn ngay **sau** câu `ADD COLUMN "parent_link_token_hash"` và **trước** `CREATE UNIQUE INDEX "students_parent_link_token_hash_key"`:
```sql
-- Link phụ huynh đã tạo trước O vẫn mở được ngay sau deploy (spec O 6.5).
UPDATE "students" SET "parent_link_token_hash" = encode(sha256(convert_to("parent_link_token", 'UTF8')), 'hex') WHERE "parent_link_token" IS NOT NULL;
```

- [ ] **Step 4: Áp lên DB test + generate**

Run (Bash):
```bash
TEST_URL=$(grep -E '^DATABASE_URL=' .env.test | cut -d= -f2- | tr -d '"')
TEST_DIRECT=$(grep -E '^DIRECT_URL=' .env.test | cut -d= -f2- | tr -d '"')
case "$TEST_URL" in *localhost:5433*) ;; *) echo "DỪNG"; exit 1;; esac
DATABASE_URL="$TEST_URL" DIRECT_URL="$TEST_DIRECT" pnpm exec prisma migrate deploy
pnpm exec prisma generate
```
Expected: `at "localhost:5433"`, `Applying migration ..._o_encryption_consent`, `All migrations have been successfully applied.`

- [ ] **Step 5: `tests/setup.ts` xoá 2 bảng mới khi reset**

Trong khối `try { ... deleteMany() }`, thêm trước `await db.user.deleteMany()`:
```ts
    await db.consentRecord.deleteMany()
    await db.securityEvent.deleteMany()
```

- [ ] **Step 6: Viết test `tests/integration/o-migration.test.ts`**

```ts
import { describe, it, expect, afterAll } from "vitest"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@/server/db"

// Đọc đúng SQL sẽ chạy trên production khi Vercel build.
function migrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations")
  const found = readdirSync(dir).filter((d) => d.endsWith("_o_encryption_consent"))
  expect(found).toHaveLength(1)
  return readFileSync(join(dir, found[0], "migration.sql"), "utf8")
}

afterAll(async () => {
  await db.student.deleteMany()
})

describe("Migration o_encryption_consent (spec O mục 13)", () => {
  it("không destructive: chỉ nới cột, thêm cột/bảng/index, 1 câu UPDATE tính hash", () => {
    const sql = migrationSql()
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE|RENAME)\b/i)
    expect(sql.match(/SET DATA TYPE TEXT/g) ?? []).toHaveLength(7)
    const updates = sql.match(/^UPDATE[^;]*;/gim) ?? []
    expect(updates).toHaveLength(1)
    expect(updates[0]).toContain('"parent_link_token_hash"')
    expect(sql).toContain('CREATE TABLE "consent_records"')
    expect(sql).toContain('CREATE TABLE "security_events"')
    expect(sql).toMatch(/CREATE UNIQUE INDEX "students_parent_link_token_hash_key"/)
    // Tính hash TRƯỚC khi tạo unique index.
    expect(sql.indexOf("UPDATE")).toBeLessThan(sql.indexOf("students_parent_link_token_hash_key"))
  })

  it("DB test đã áp: 7 cột là text", async () => {
    const rows = await db.$queryRaw<Array<{ t: string; c: string; dt: string }>>`
      SELECT table_name AS t, column_name AS c, data_type AS dt FROM information_schema.columns
      WHERE (table_name = 'users' AND column_name IN ('full_name','bank_account_number','bank_account_name'))
         OR (table_name = 'students' AND column_name IN ('full_name','parent_phone','parent_name','parent_link_token'))`
    expect(rows).toHaveLength(7)
    for (const r of rows) expect(r.dt, `${r.t}.${r.c}`).toBe("text")
  })

  it("câu UPDATE trong migration tính đúng SHA-256 hex của token (khớp Node)", async () => {
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const token = "A".repeat(20) + "b_-".repeat(7) + "Z".repeat(2)
    const s = await db.student.create({ data: { userId: teacher.id, fullName: "HS Hash", grade: 3, parentLinkToken: token } })
    const update = migrationSql().match(/^UPDATE[^;]*;/im)![0]
    await db.$executeRawUnsafe(update)
    const [row] = await db.$queryRaw<Array<{ h: string }>>`SELECT parent_link_token_hash AS h FROM students WHERE id = ${s.id}`
    expect(row.h).toBe(createHash("sha256").update(token, "utf8").digest("hex"))
  })
})
```

- [ ] **Step 7: Chạy test**

Run: `pnpm test tests/integration/o-migration.test.ts`
Expected: PASS (3 test). Token trong test dài đúng 43 ký tự (`20 + 21 + 2`).

Run thêm: `pnpm test tests/integration/session-migration.test.ts tests/integration/student.test.ts`
Expected: PASS (schema mới không làm vỡ test cũ).

- [ ] **Step 8: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add prisma/schema.prisma prisma/migrations/*_o_encryption_consent tests/setup.ts tests/integration/o-migration.test.ts
git commit -m "feat(o): migration nới cột cá nhân sang TEXT, hash link phụ huynh, bảng consent_records + security_events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Tìm kiếm và sắp xếp tên học sinh trong bộ nhớ (chưa mã hoá)

**Đọc trước:** Global Constraints (Đối chiếu code thật); "Điều chỉnh so với spec" ý 1; spec mục 1 (Tìm kiếm/sắp xếp), 4 (Q7, Q8), 6.4, 6.13 ý 3; code thật của `src/server/services/student.service.ts` (`listStudents`), `tuition.service.ts` (`getMonthlyTuitionStatus`), `session.service.ts` (`toDTO`, `getMonthSessions`, `getSessionDetail`, `getCancelledWithoutMakeup`), `report.service.ts` (HS lâu không học), `backup.service.ts` (sheet Học sinh); `tests/integration/student.test.ts` (mẫu `getAuthedCaller`).

**Files:**
- Create: `src/lib/name-search.ts`
- Modify: `src/server/services/student.service.ts`, `tuition.service.ts`, `session.service.ts`, `report.service.ts`, `backup.service.ts` (và file của Q nếu có lọc/sắp tên thùng rác — Step 1)
- Test (Mới): `tests/unit/lib/name-search.test.ts`, `tests/integration/name-search.test.ts`

**Interfaces:**
- Consumes: không (chạy trên schema Task 2, dữ liệu còn bản rõ).
- Produces:
  - `src/lib/name-search.ts`: `normalizeForSearch(s: string): string`, `nameMatches(fullName: string, term: string | undefined): boolean`, `compareViName(a: string, b: string): number`, `byGradeThenName<T extends { grade: number; fullName: string; id: number }>(a: T, b: T): number`.
  - `student.service.ts`: `findStudentIdsByName(db: PrismaClient, userId: number, term: string): Promise<number[]>`.
  - Sau task này **không còn** `where`/`orderBy` nào theo `fullName` (hay trường mã hoá khác ở spec mục 5) trong `src/server`.

- [ ] **Step 1: Kiểm kê chỗ lọc/sắp theo trường sẽ mã hoá**

Run (Bash):
```bash
grep -rn -E "(fullName|parentName|parentPhone|notes|note|bankAccountNumber|bankAccountName|cancelReason|parentLinkToken)\b[^,]*(contains|startsWith|endsWith|equals|\"asc\"|'asc'|\"desc\"|'desc'|mode:)" src/server
grep -rn -B3 -A3 "orderBy" src/server/services | grep -E "fullName|notes|note\b"
grep -rn "where: { parentLinkToken" src/server
```
Expected (code lúc viết plan): `student.service.ts` (list: `contains` + `orderBy`), `tuition.service.ts` (`contains` + `orderBy`), `session.service.ts` (`contains` trong `getMonthSessions`, 3 chỗ `orderBy: { student: { fullName` ), `report.service.ts` (`orderBy fullName`), `backup.service.ts` (`orderBy fullName`), `parent-link.service.ts` (`where: { parentLinkToken: token }` — để Task 5). Có thêm chỗ của P/Q/K (vd thùng rác Q) → sửa theo cùng cách ở Step 5, ghi "Ruling" vào báo cáo.

- [ ] **Step 2: Viết test đỏ `tests/unit/lib/name-search.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { byGradeThenName, compareViName, nameMatches, normalizeForSearch } from "@/lib/name-search"

describe("name-search (spec O 6.4)", () => {
  it("không phân biệt hoa thường, phân biệt dấu như ILIKE cũ", () => {
    expect(nameMatches("Nguyễn Văn An", "AN")).toBe(true)
    expect(nameMatches("Nguyễn Văn An", "văn a")).toBe(true)
    expect(nameMatches("Trần Thị Ánh", "an")).toBe(false)
    expect(nameMatches("Trần Thị Ánh", "ÁNH")).toBe(true)
  })

  it("NFC và NFD khớp nhau", () => {
    const nfd = "Nguyễn".normalize("NFD")
    expect(nameMatches("Nguyễn Văn An", nfd)).toBe(true)
    expect(normalizeForSearch(nfd)).toBe(normalizeForSearch("Nguyễn"))
  })

  it("term rỗng hoặc undefined khớp tất cả", () => {
    expect(nameMatches("Bất kỳ", "")).toBe(true)
    expect(nameMatches("Bất kỳ", undefined)).toBe(true)
  })

  it("sắp theo tiếng Việt: D trước Đ, A trước Ă/Â", () => {
    expect(["Đức", "Dũng", "Anh"].sort(compareViName)).toEqual(["Anh", "Dũng", "Đức"])
    expect(compareViName("Ân", "An")).toBeGreaterThan(0)
  })

  it("byGradeThenName: lớp trước, rồi tên, trùng tên theo id", () => {
    const rows = [
      { id: 3, grade: 5, fullName: "An" },
      { id: 2, grade: 3, fullName: "Bình" },
      { id: 9, grade: 3, fullName: "An" },
      { id: 1, grade: 3, fullName: "An" },
    ]
    expect(rows.sort(byGradeThenName).map((r) => r.id)).toEqual([1, 9, 2, 3])
  })
})
```

- [ ] **Step 3: Chạy, thấy đỏ**

Run: `pnpm test tests/unit/lib/name-search.test.ts`
Expected: FAIL — không resolve được `@/lib/name-search`.

- [ ] **Step 4: Viết `src/lib/name-search.ts`**

```ts
// Tên HS được mã hoá trong DB (spec O Q7) → mọi lọc/sắp theo tên chạy ở đây, sau khi giải mã.
const collator = new Intl.Collator("vi")

export function normalizeForSearch(s: string): string {
  return s.normalize("NFC").toLocaleLowerCase("vi")
}

// Giữ đúng hành vi ILIKE cũ: không phân biệt hoa thường, vẫn phân biệt dấu.
export function nameMatches(fullName: string, term: string | undefined): boolean {
  if (!term) return true
  return normalizeForSearch(fullName).includes(normalizeForSearch(term))
}

export function compareViName(a: string, b: string): number {
  return collator.compare(a, b)
}

export function byGradeThenName<T extends { grade: number; fullName: string; id: number }>(a: T, b: T): number {
  return a.grade - b.grade || compareViName(a.fullName, b.fullName) || a.id - b.id
}
```

Run: `pnpm test tests/unit/lib/name-search.test.ts` → Expected: PASS (5 test).

- [ ] **Step 5: Viết test tích hợp đỏ `tests/integration/name-search.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}
beforeEach(cleanup)
afterAll(cleanup)

// Task 6 thêm `consent: CONSENT_ACCEPTED` vào các lời gọi create dưới đây bằng codemod.
async function seed() {
  const t = await getAuthedCaller("teacher")
  const t2 = await getAuthedCaller("teacher2")
  const an = await t.student.create({ fullName: "Nguyễn Văn An", grade: 3 })
  const anh = await t.student.create({ fullName: "Trần Thị Ánh", grade: 3 })
  const binh = await t.student.create({ fullName: "Lê Bình An", grade: 5 })
  const duc = await t.student.create({ fullName: "Đức", grade: 3 })
  const dung = await t.student.create({ fullName: "Dũng", grade: 3 })
  await t2.student.create({ fullName: "An Của GV2", grade: 3 })
  return { t, an, anh, binh, duc, dung }
}

describe("Tìm/sắp tên HS trong bộ nhớ (spec O 6.4)", () => {
  it("student.list: tìm một phần tên, không phân biệt hoa thường, phân biệt dấu, không lộ HS GV khác", async () => {
    const { t } = await seed()
    const res = await t.student.list({ search: "AN" })
    expect(res.items.map((s) => s.fullName)).toEqual(["Nguyễn Văn An", "Lê Bình An"])
    expect(res.totalCount).toBe(2)
  })

  it("student.list: sắp lớp rồi tên tiếng Việt; phân trang đúng totalCount/totalPages", async () => {
    const { t } = await seed()
    const all = await t.student.list({})
    expect(all.items.map((s) => s.fullName)).toEqual(["Dũng", "Đức", "Nguyễn Văn An", "Trần Thị Ánh", "Lê Bình An"])
    const p2 = await t.student.list({ page: 2, limit: 2 })
    expect(p2.items.map((s) => s.fullName)).toEqual(["Nguyễn Văn An", "Trần Thị Ánh"])
    expect(p2.totalCount).toBe(5)
    expect(p2.totalPages).toBe(3)
  })

  it("tuition.getMonthlyStatus: tìm theo tên và sắp như cũ", async () => {
    const { t } = await seed()
    const { year, month } = vnDateParts()
    const res = await t.tuition.getMonthlyStatus({ year, month, search: "an" })
    expect(res.items.map((i) => i.fullName)).toEqual(["Nguyễn Văn An", "Lê Bình An"])
  })

  it("session.getMonth: lọc theo tên chỉ trả ca có HS khớp; HS trong ca sắp theo tên", async () => {
    const { t, an, duc, dung, anh } = await seed()
    const subject = await db.subject.findFirstOrThrow({ where: { user: { username: "teacher" } } })
    const { year, month } = vnDateParts()
    const day = `${year}-${String(month).padStart(2, "0")}-15`
    await t.session.create({ sessionDate: day, startTime: "08:00", endTime: "09:00", subjectId: subject.id, studentIds: [duc.id, an.id, dung.id] })
    await t.session.create({ sessionDate: day, startTime: "10:00", endTime: "11:00", subjectId: subject.id, studentIds: [anh.id] })
    const found = await t.session.getMonth({ year, month, studentName: "văn an", includeStudents: true })
    expect(found).toHaveLength(1)
    expect(found[0].students.map((s) => s.fullName)).toEqual(["Dũng", "Đức", "Nguyễn Văn An"])
    expect(await t.session.getMonth({ year, month, studentName: "không có ai" })).toEqual([])
  })
})
```
Nếu tên field/procedure thật khác (vd `tuition.getMonthlyStatus` đổi tên sau P/Q/K) → theo code thật, ghi Ruling.

Run: `pnpm test tests/integration/name-search.test.ts`
Expected: FAIL ít nhất ở ca sắp tiếng Việt (collation Postgres test không đặt "Dũng" trước "Đức" theo quy tắc `vi`) hoặc ca HS trong ca. Nếu tất cả đã xanh do collation trùng hợp → vẫn làm Step 6 (mục tiêu là bỏ lọc/sắp DB trước khi mã hoá), ghi vào báo cáo.

- [ ] **Step 6: Sửa service**

`student.service.ts` — thay thân `listStudents`:
```ts
export async function listStudents(
  db: PrismaClient,
  userId: number,
  filter: StudentFilterInput
): Promise<PaginatedResponse<StudentDTO>> {
  const { page, limit, grade, search, isActive, includeInactive } = filter
  const rows = await db.student.findMany({
    where: {
      userId,
      ...(isActive !== undefined ? { isActive } : includeInactive ? {} : { isActive: true }),
      ...(grade ? { grade } : {}),
    },
  })
  // Tên mã hoá trong DB (spec O Q7): lọc/sắp/cắt trang sau khi giải mã; mỗi GV ít HS nên tải hết vẫn nhẹ.
  const matched = rows.filter((s) => nameMatches(s.fullName, search)).sort(byGradeThenName)
  const start = (page - 1) * limit
  return {
    items: matched.slice(start, start + limit).map(withLevel),
    totalCount: matched.length,
    totalPages: Math.ceil(matched.length / limit),
  }
}
```
(Giữ điều kiện xoá mềm của Q trong `where` nếu code thật có.) Thêm cuối file:
```ts
// Lịch lọc theo tên HS: tìm id trước vì tên đã mã hoá (spec O 6.4). Gồm cả HS đã nghỉ như ILIKE cũ.
export async function findStudentIdsByName(db: PrismaClient, userId: number, term: string): Promise<number[]> {
  const rows = await db.student.findMany({ where: { userId }, select: { id: true, fullName: true } })
  return rows.filter((s) => nameMatches(s.fullName, term)).map((s) => s.id)
}
```
Import: `import { byGradeThenName, nameMatches } from "@/lib/name-search"`.

`tuition.service.ts` (`getMonthlyTuitionStatus`): xoá dòng `...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),` và `orderBy: [{ grade: "asc" }, { fullName: "asc" }],`; đổi `const students = await db.student.findMany({...})` thành
```ts
  const rows = await db.student.findMany({ /* where giữ nguyên, bỏ fullName + orderBy */ })
  // Tên mã hoá (spec O Q7): lọc + sắp trong bộ nhớ; hàm này vốn đã phân trang trong bộ nhớ.
  const students = rows.filter((s) => nameMatches(s.fullName, search)).sort(byGradeThenName)
```

`session.service.ts`:
- `getMonthSessions`: trước `db.teachingSession.findMany`:
```ts
  let nameIds: number[] | null = null
  if (studentName) {
    nameIds = await findStudentIdsByName(db, userId, studentName)
    if (nameIds.length === 0 || (studentId && !nameIds.includes(studentId))) return []
  }
  const studentFilter = studentId ? { id: studentId } : nameIds ? { id: { in: nameIds } } : null
```
  và thay khối `...(studentId || studentName ? { student: { ... } } : {})` bằng `...(studentFilter ? { student: studentFilter } : {})`; điều kiện ngoài `grade || studentName || studentId` giữ nguyên. Trong `include`, nhánh `includeStudents` đổi thành `{ sessionStudents: { include: { student: true } } }` (bỏ `orderBy`).
- `getSessionDetail`, `getCancelledWithoutMakeup`: xoá `orderBy: { student: { fullName: "asc" } },`.
- `toDTO`: sắp trước khi map:
```ts
  // Tên mã hoá nên không sắp được trong DB (spec O 6.4); sắp sau khi giải mã.
  const students = [...(s.sessionStudents ?? [])]
    .sort((a, b) => compareViName(a.student?.fullName ?? "", b.student?.fullName ?? "") || a.studentId - b.studentId)
    .map((ss) => ({ /* giữ nguyên như cũ */ }))
```
  Import `compareViName` từ `@/lib/name-search`, `findStudentIdsByName` từ `./student.service` (kiểm không tạo vòng import: `student.service` không import `session.service`).

`report.service.ts`: query HS lâu không học bỏ `orderBy: [{ grade: "asc" }, { fullName: "asc" }]`; chỗ trả `idleStudents` dùng `[...idle].sort(byGradeThenName).map(...)`.

`backup.service.ts`: query `students` bỏ `orderBy`; trước khi `addDataSheet(wb, "Học sinh", …)` dùng `students.sort(byGradeThenName)` (mảng mới tải, sắp tại chỗ được).

Chỗ của P/Q/K tìm thấy ở Step 1: cùng cách (lọc `nameMatches` + sắp `byGradeThenName`/`compareViName` sau khi tải theo `userId`).

- [ ] **Step 7: Chạy test**

Run: `pnpm test tests/integration/name-search.test.ts tests/unit/lib/name-search.test.ts`
Expected: PASS.

Run: `pnpm test tests/integration/student.test.ts tests/integration/tuition.test.ts tests/integration/session.test.ts tests/integration/report.test.ts tests/integration/backup.test.ts tests/integration/dashboard-alerts.test.ts tests/integration/tuition-status-filter.test.ts`
Expected: PASS. Ca nào đỏ vì thứ tự tên (collation cũ khác `vi`) → sửa kỳ vọng theo `vi` nếu hành vi mới đúng spec Q8, ghi vào báo cáo từng ca.

Run lại Step 1 → Expected: chỉ còn `parent-link.service.ts` (`where: { parentLinkToken`).

- [ ] **Step 8: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/name-search.ts src/server/services/student.service.ts src/server/services/tuition.service.ts src/server/services/session.service.ts src/server/services/report.service.ts src/server/services/backup.service.ts tests/unit/lib/name-search.test.ts tests/integration/name-search.test.ts
git commit -m "refactor(o): tìm/sắp tên học sinh trong bộ nhớ theo userId, bỏ lọc/sắp DB theo tên (chuẩn bị mã hoá)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
(Thêm file của Q/K nếu Step 1 có sửa, và file test đã chỉnh kỳ vọng.)

---

### Task 4: Prisma extension mã hoá/giải mã + chặn lọc, bật cho `db`, scripts

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 3, 4; spec mục 4 (Q4–Q6), 5 (bảng + `ENCRYPTED_FIELDS`), 6.3, 6.13 ý 2, 5; code thật `src/server/db.ts` (Q có thể đã thêm extension); `src/server/crypto/field-crypto.ts` (Task 1); `scripts/create-user.ts`, `scripts/list-users.ts`, `prisma/seed.ts`.

**Files:**
- Create: `src/server/crypto/prisma-encryption.ts`
- Modify: `src/server/db.ts`, `scripts/create-user.ts`, `scripts/list-users.ts`, `prisma/seed.ts`
- Test (Mới): `tests/unit/crypto/prisma-encryption.test.ts`, `tests/integration/field-encryption.test.ts`

**Interfaces:**
- Consumes: `encryptField`, `decryptField`, `isEncrypted`, `FieldCryptoConfigError` (Task 1); cột TEXT (Task 2); không còn lọc/sắp DB theo tên (Task 3).
- Produces (`src/server/crypto/prisma-encryption.ts`):
  - `ENCRYPTED_FIELDS: { User: readonly ["fullName","bankAccountNumber","bankAccountName"]; Student: readonly ["fullName","parentName","parentPhone","notes","parentLinkToken"]; SessionStudent: readonly ["note"]; TeachingSession: readonly ["notes","cancelReason"]; MonthlyTuition: readonly ["notes"]; Payment: readonly ["note"]; PlanOrder: readonly ["note"] }`
  - `ENCRYPTED_KEYS: ReadonlySet<string>`
  - `class EncryptedFieldQueryError extends Error`
  - `encryptWriteArgs<T>(args: T): T`, `decryptResult<T>(node: T, key?: string): T`, `assertNoEncryptedFilter(args: unknown): void`
  - `withFieldEncryption<C extends PrismaClient>(client: C): C`
  - `db` (từ `src/server/db.ts`) tự mã hoá/giải mã.

- [ ] **Step 1: Viết test đỏ `tests/unit/crypto/prisma-encryption.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"
import {
  ENCRYPTED_FIELDS,
  ENCRYPTED_KEYS,
  EncryptedFieldQueryError,
  assertNoEncryptedFilter,
  decryptResult,
  encryptWriteArgs,
} from "@/server/crypto/prisma-encryption"
import { FieldCryptoConfigError, decryptField, isEncrypted } from "@/server/crypto/field-crypto"

const ORIGINAL = { keys: process.env.DATA_ENCRYPTION_KEYS, active: process.env.DATA_ENCRYPTION_ACTIVE_KID }
beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEYS = `u1:${randomBytes(32).toString("base64")}`
  process.env.DATA_ENCRYPTION_ACTIVE_KID = "u1"
})
afterAll(() => {
  process.env.DATA_ENCRYPTION_KEYS = ORIGINAL.keys
  process.env.DATA_ENCRYPTION_ACTIVE_KID = ORIGINAL.active
})

describe("encryptWriteArgs (spec O 6.3)", () => {
  it("create: mã hoá trường thuộc tập, giữ nguyên trường khác, không sửa object gốc", () => {
    const args = { data: { userId: 1, fullName: "An", grade: 3, parentPhone: null, notes: undefined } }
    const out = encryptWriteArgs(args)
    expect(args.data.fullName).toBe("An")
    expect(isEncrypted(out.data.fullName)).toBe(true)
    expect(decryptField(out.data.fullName as string, "fullName")).toBe("An")
    expect(out.data.grade).toBe(3)
    expect(out.data.parentPhone).toBeNull()
    expect(out.data.notes).toBeUndefined()
  })

  it("createMany mảng, update { set }, upsert create+update, ghi lồng", () => {
    const many = encryptWriteArgs({ data: [{ fullName: "A" }, { fullName: "B" }] })
    expect(many.data.every((r) => isEncrypted(r.fullName))).toBe(true)
    const set = encryptWriteArgs({ where: { id: 1 }, data: { note: { set: "x" } } })
    expect(isEncrypted(set.data.note.set)).toBe(true)
    const up = encryptWriteArgs({ where: { id: 1 }, create: { notes: "c" }, update: { notes: "u" } })
    expect(isEncrypted(up.create.notes) && isEncrypted(up.update.notes)).toBe(true)
    const nested = encryptWriteArgs({ data: { notes: "ca", sessionStudents: { create: [{ studentId: 1, note: "vắng" }] } } })
    expect(isEncrypted(nested.data.sessionStudents.create[0].note)).toBe(true)
    const when = new Date("2026-01-01T00:00:00Z")
    expect(encryptWriteArgs({ data: { createdAt: when } }).data.createdAt).toBe(when)
  })

  it("thiếu khoá → ném FieldCryptoConfigError, không trả bản rõ", () => {
    delete process.env.DATA_ENCRYPTION_KEYS
    expect(() => encryptWriteArgs({ data: { fullName: "An" } })).toThrow(FieldCryptoConfigError)
  })
})

describe("decryptResult", () => {
  it("giải mã lồng nhiều cấp, mảng, bỏ qua bản rõ cũ và khoá khác", () => {
    const enc = encryptWriteArgs({ data: { fullName: "Bình", note: "ốm" } }).data
    const out = decryptResult({
      id: 1,
      title: enc.fullName,
      sessionStudents: [{ note: enc.note, student: { fullName: enc.fullName, grade: 3 } }],
      user: { fullName: "Bản rõ cũ" },
      _count: { sessionStudents: 1 },
    })
    expect(out.sessionStudents[0].note).toBe("ốm")
    expect(out.sessionStudents[0].student.fullName).toBe("Bình")
    expect(out.user.fullName).toBe("Bản rõ cũ")
    // `title` không thuộc tập → không giải mã.
    expect(isEncrypted(out.title)).toBe(true)
  })
})

describe("assertNoEncryptedFilter", () => {
  const bad = [
    { where: { fullName: { contains: "a" } } },
    { orderBy: [{ grade: "asc" }, { fullName: "asc" }] },
    { include: { sessionStudents: { orderBy: { student: { fullName: "asc" } } } } },
    { where: { sessionStudents: { some: { student: { fullName: "x" } } } } },
    { where: { AND: [{ userId: 1 }, { notes: { not: null } }] } },
    { distinct: ["fullName"] },
    { by: ["parentPhone"] },
    { where: { parentLinkToken: "t" } },
  ]
  it.each(bad.map((a) => [JSON.stringify(a), a]))("ném với %s", (_label, args) => {
    expect(() => assertNoEncryptedFilter(args)).toThrow(EncryptedFieldQueryError)
  })

  it("không ném với lọc trường thường, select trường mã hoá, giá trị chuỗi trùng tên khoá", () => {
    for (const args of [
      { where: { userId: 1, isActive: true }, orderBy: { id: "asc" } },
      { select: { fullName: true, notes: true } },
      { where: { username: "notes" } },
      { where: { parentLinkTokenHash: "abc" } },
      undefined,
    ]) {
      expect(() => assertNoEncryptedFilter(args)).not.toThrow()
    }
  })
})

describe("ENCRYPTED_FIELDS khớp schema (DMMF)", () => {
  it("mọi trường String trùng tên khoá mã hoá đều được khai báo; trường khai báo tồn tại và không còn VarChar", () => {
    const declaredOf = (m: string) => (ENCRYPTED_FIELDS as Record<string, readonly string[]>)[m] ?? []
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const f of model.fields) {
        if (f.kind !== "scalar" || f.type !== "String") continue
        if (ENCRYPTED_KEYS.has(f.name)) expect(declaredOf(model.name), `${model.name}.${f.name}`).toContain(f.name)
        if (declaredOf(model.name).includes(f.name)) {
          expect(f.nativeType?.[0], `${model.name}.${f.name} phải là TEXT`).not.toBe("VarChar")
        }
      }
    }
    for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
      const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model)
      expect(m, model).toBeDefined()
      for (const f of fields) expect(m!.fields.some((x) => x.name === f), `${model}.${f}`).toBe(true)
    }
  })
})
```
(Nếu `Prisma.dmmf` không có trong bản Prisma của repo → đọc `prisma/schema.prisma` bằng regex từng `model X { ... }` thay thế, giữ nguyên 2 khẳng định; ghi Ruling.)

- [ ] **Step 2: Chạy, thấy đỏ**

Run: `pnpm test tests/unit/crypto/prisma-encryption.test.ts`
Expected: FAIL — không resolve được `@/server/crypto/prisma-encryption`.

- [ ] **Step 3: Viết `src/server/crypto/prisma-encryption.ts`**

```ts
import type { PrismaClient } from "@prisma/client"
import { decryptField, encryptField, isEncrypted } from "./field-crypto"

// Quyết định theo spec O mục 5. Đi cây theo TÊN KHOÁ → model trùng tên trường phải cùng quyết định (test DMMF canh).
export const ENCRYPTED_FIELDS = {
  User: ["fullName", "bankAccountNumber", "bankAccountName"],
  Student: ["fullName", "parentName", "parentPhone", "notes", "parentLinkToken"],
  SessionStudent: ["note"],
  TeachingSession: ["notes", "cancelReason"],
  MonthlyTuition: ["notes"],
  Payment: ["note"],
  PlanOrder: ["note"],
} as const

export const ENCRYPTED_KEYS: ReadonlySet<string> = new Set<string>(Object.values(ENCRYPTED_FIELDS).flat())

const WRITE_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "upsert"])

export class EncryptedFieldQueryError extends Error {
  constructor(key: string) {
    super(`Không lọc/sắp xếp DB theo trường mã hoá: ${key}`)
    this.name = "EncryptedFieldQueryError"
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

// Chỉ xét TÊN KHOÁ, không xét giá trị: username "notes" vẫn đăng nhập được.
function findEncryptedKey(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const x of node) {
      const hit = findEncryptedKey(x)
      if (hit) return hit
    }
    return null
  }
  if (!isPlainObject(node)) return null
  for (const [k, v] of Object.entries(node)) {
    if (ENCRYPTED_KEYS.has(k)) return k
    const hit = findEncryptedKey(v)
    if (hit) return hit
  }
  return null
}

// Lọc/sắp theo ciphertext luôn sai im lặng → nổ ngay để lộ ra khi test (spec O Q5).
export function assertNoEncryptedFilter(args: unknown): void {
  if (!isPlainObject(args)) return
  for (const key of ["distinct", "by"]) {
    const v = args[key]
    for (const f of Array.isArray(v) ? v : [v]) {
      if (typeof f === "string" && ENCRYPTED_KEYS.has(f)) throw new EncryptedFieldQueryError(f)
    }
  }
  for (const key of ["where", "orderBy", "cursor", "having"]) {
    const hit = findEncryptedKey(args[key])
    if (hit) throw new EncryptedFieldQueryError(hit)
  }
  for (const key of ["include", "select"]) {
    const nested = args[key]
    if (!isPlainObject(nested)) continue
    for (const v of Object.values(nested)) if (isPlainObject(v)) assertNoEncryptedFilter(v)
  }
}

function encryptTree(node: unknown, key?: string): unknown {
  if (key && ENCRYPTED_KEYS.has(key)) {
    if (typeof node === "string") return encryptField(node, key)
    if (isPlainObject(node) && typeof node.set === "string") return { ...node, set: encryptField(node.set, key) }
    return node
  }
  if (Array.isArray(node)) return node.map((x) => encryptTree(x))
  if (!isPlainObject(node)) return node
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node)) out[k] = encryptTree(v, k)
  return out
}

// Trả bản sao: object của người gọi (vd rows nhập Excel) còn dùng tiếp với bản rõ.
export function encryptWriteArgs<T>(args: T): T {
  if (!isPlainObject(args)) return args
  const out: Record<string, unknown> = { ...args }
  for (const k of ["data", "create", "update"]) if (k in out) out[k] = encryptTree(out[k])
  return out as T
}

export function decryptResult<T>(node: T, key?: string): T {
  if (typeof node === "string") {
    return (key && ENCRYPTED_KEYS.has(key) && isEncrypted(node) ? decryptField(node, key) : node) as T
  }
  if (Array.isArray(node)) return node.map((x) => decryptResult(x, key)) as T
  if (!isPlainObject(node)) return node
  const obj = node as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) obj[k] = decryptResult(v, k)
  return node
}

export function withFieldEncryption<C extends PrismaClient>(client: C): C {
  return client.$extends({
    name: "field-encryption",
    query: {
      async $allOperations({ operation, args, query }) {
        assertNoEncryptedFilter(args)
        const finalArgs = WRITE_OPS.has(operation) ? encryptWriteArgs(args) : args
        return decryptResult(await query(finalArgs))
      },
    },
  }) as unknown as C
}
```
(Kiểu của `$extends` trong Prisma 5.22 có thể đòi ép kiểu khác ở `query(finalArgs)` — nếu `tsc` báo, ép `finalArgs as typeof args`; không đổi logic.)

- [ ] **Step 4: Chạy unit, thấy xanh**

Run: `pnpm test tests/unit/crypto/prisma-encryption.test.ts`
Expected: PASS.

- [ ] **Step 5: Viết test tích hợp đỏ `tests/integration/field-encryption.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { EncryptedFieldQueryError } from "@/server/crypto/prisma-encryption"

async function cleanup() {
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } })
}
beforeEach(cleanup)
afterAll(cleanup)

// Alias cột để $queryRaw qua `db` không bị decryptResult giải mã (tên cột trùng khoá như "notes").
type RawStudent = { fn: string; ph: string | null; pn: string | null; nt: string | null }

describe("Mã hoá trường cá nhân qua db (spec O 6.3)", () => {
  it("tạo HS qua caller: cột trong DB là ciphertext, đọc qua caller ra bản rõ", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ fullName: "Nguyễn Thị Mai", grade: 4, parentPhone: "0901234567", parentName: "Nguyễn Văn Hùng", notes: "Dị ứng sữa" })
    const [raw] = await db.$queryRaw<RawStudent[]>`
      SELECT full_name AS fn, parent_phone AS ph, parent_name AS pn, notes AS nt FROM students WHERE id = ${s.id}`
    for (const [v, plain] of [[raw.fn, "Nguyễn Thị Mai"], [raw.ph, "0901234567"], [raw.pn, "Nguyễn Văn Hùng"], [raw.nt, "Dị ứng sữa"]] as const) {
      expect(v?.startsWith("enc:v1:")).toBe(true)
      expect(v).not.toContain(plain)
    }
    const list = await t.student.list({ search: "mai" })
    expect(list.items[0]).toMatchObject({ fullName: "Nguyễn Thị Mai", parentPhone: "0901234567", parentName: "Nguyễn Văn Hùng", notes: "Dị ứng sữa" })
  })

  it("tài khoản ngân hàng: DB ciphertext, getBankAccount ra bản rõ", async () => {
    const t = await getAuthedCaller()
    const bank = { bankBin: "970436", bankAccountNumber: "0011001234567", bankAccountName: "NGUYEN VAN A" }
    await t.settings.updateBankAccount(bank)
    const [raw] = await db.$queryRaw<Array<{ n: string; a: string; b: string }>>`
      SELECT bank_account_number AS n, bank_account_name AS a, bank_bin AS b FROM users WHERE username = 'teacher'`
    expect(raw.n.startsWith("enc:v1:") && raw.a.startsWith("enc:v1:")).toBe(true)
    expect(raw.b).toBe("970436")
    expect(await t.settings.getBankAccount()).toEqual(bank)
  })

  it("ghi lồng: ca kèm sessionStudents có note → cả 2 cột ciphertext; include lồng giải mã", async () => {
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const subject = await db.subject.findFirstOrThrow({ where: { userId: teacher.id } })
    const st = await db.student.create({ data: { userId: teacher.id, fullName: "Phạm Quang", grade: 6 } })
    const ses = await db.teachingSession.create({
      data: {
        userId: teacher.id, subjectId: subject.id, notes: "Ôn thi",
        sessionDate: new Date("2026-03-02T00:00:00Z"),
        startTime: new Date("1970-01-01T08:00:00Z"), endTime: new Date("1970-01-01T09:00:00Z"),
        sessionStudents: { create: [{ studentId: st.id, grade: 6, fee: 0, note: "Vắng vì ốm" }] },
      },
      include: { sessionStudents: { include: { student: true } } },
    })
    expect(ses.notes).toBe("Ôn thi")
    expect(ses.sessionStudents[0].note).toBe("Vắng vì ốm")
    expect(ses.sessionStudents[0].student.fullName).toBe("Phạm Quang")
    const [raw] = await db.$queryRaw<Array<{ sn: string; nn: string }>>`
      SELECT ts.notes AS sn, ss.note AS nn FROM teaching_sessions ts JOIN session_students ss ON ss.session_id = ts.id WHERE ts.id = ${ses.id}`
    expect(raw.sn.startsWith("enc:v1:") && raw.nn.startsWith("enc:v1:")).toBe(true)
  })

  it("bản rõ cũ (trước O2) vẫn đọc và tìm được", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ fullName: "Tạm", grade: 2 })
    await db.$executeRaw`UPDATE students SET full_name = 'Hoàng Bản Rõ', notes = 'ghi chú cũ' WHERE id = ${s.id}`
    const list = await t.student.list({ search: "bản rõ" })
    expect(list.items.map((x) => [x.fullName, x.notes])).toEqual([["Hoàng Bản Rõ", "ghi chú cũ"]])
  })

  it("lọc DB theo trường mã hoá → EncryptedFieldQueryError; transaction thừa hưởng extension", async () => {
    await expect(db.student.findMany({ where: { fullName: "x" } })).rejects.toBeInstanceOf(EncryptedFieldQueryError)
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const id = await db.$transaction(async (tx) => (await tx.student.create({ data: { userId: teacher.id, fullName: "Trong Tx", grade: 1 } })).id)
    const [raw] = await db.$queryRaw<Array<{ fn: string }>>`SELECT full_name AS fn FROM students WHERE id = ${id}`
    expect(raw.fn.startsWith("enc:v1:")).toBe(true)
  })
})
```
(Ca `t.student.create` / `t.settings.updateBankAccount` ở đây sẽ được codemod Task 6 thêm `consent: CONSENT_ACCEPTED`.)

Run: `pnpm test tests/integration/field-encryption.test.ts`
Expected: FAIL — cột raw chưa bắt đầu `enc:v1:` (db chưa bọc extension).

- [ ] **Step 6: Bọc `db` trong `src/server/db.ts`**

Đọc file thật (Q có thể đã thêm extension). Giữ mọi extension sẵn có; bọc mã hoá **ngoài cùng**:
```ts
import { PrismaClient } from "@prisma/client"
import { withFieldEncryption } from "@/server/crypto/prisma-encryption"

// ... (globalForPrisma như cũ)

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    // Bỏ "query" log để tránh I/O stdout chậm 5–20ms mỗi query.
    log: ["error", "warn"],
  }).$extends({
    /* extension log truy vấn chậm như cũ (và extension của Q nếu có) */
  }) as unknown as PrismaClient
  // Mã hoá bọc ngoài cùng (spec O 6.3, 6.13): mọi đường ghi qua db đều mã hoá, kể cả thao tác xoá mềm.
  return withFieldEncryption(base)
}
```

- [ ] **Step 7: Scripts dùng extension**

`scripts/create-user.ts`, `scripts/list-users.ts`, `prisma/seed.ts`: đổi
```ts
const db = new PrismaClient()
```
thành
```ts
// Ghi/đọc họ tên qua extension mã hoá như app (spec O 6.3).
const db = withFieldEncryption(new PrismaClient())
```
với `import { withFieldEncryption } from "../src/server/crypto/prisma-encryption"` (đường dẫn tương đối: `prisma/seed.ts` cũng là `../src/...`). Không chạy các script này (chúng nạp `.env` = prod). Kiểm bằng `pnpm exec tsc --noEmit` (nếu `tsconfig` không bao `scripts/`/`prisma/` thì chạy thêm `pnpm exec tsc --noEmit --skipLibCheck --esModuleInterop --module esnext --moduleResolution bundler --target es2022 scripts/create-user.ts scripts/list-users.ts prisma/seed.ts` để chắc import đúng).

- [ ] **Step 8: Chạy test tích hợp + TOÀN BỘ bộ test**

Run: `pnpm test tests/integration/field-encryption.test.ts`
Expected: PASS (5 test).

Run: `pnpm test` (toàn bộ, ~10–15 phút, không chạy song song lượt khác)
Expected: PASS. Đỏ vì `EncryptedFieldQueryError` trong **code app** → chỗ lọc/sắp sót ở Task 3: sửa theo cách Task 3 Step 6, ghi Ruling. Đỏ vì **test** tự lọc theo trường mã hoá (vd `db.student.findUnique({ where: { parentLinkToken } })` ở `parent-link.test.ts`) → nếu là parent-link thì để nguyên cho Task 5 (ghi rõ tên test đang đỏ vào báo cáo, Task 5 sửa), còn lại sửa test sang tìm theo `id`/đọc rồi so trong bộ nhớ. Đỏ vì `FieldCryptoConfigError` → `.env.test` thiếu khoá (Task 1 Step 1). Đỏ vì test đọc raw so với bản rõ → đổi sang đọc qua `db` (giải mã) nếu mục đích test không phải kiểm bản thô.

- [ ] **Step 9: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/server/crypto/prisma-encryption.ts src/server/db.ts scripts/create-user.ts scripts/list-users.ts prisma/seed.ts tests/unit/crypto/prisma-encryption.test.ts tests/integration/field-encryption.test.ts
git commit -m "feat(o): Prisma extension mã hoá khi ghi, giải mã khi đọc (cả include lồng), chặn lọc/sắp theo trường mã hoá; bật cho db và scripts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
(Thêm file đã sửa ở Step 8 nếu có.)

---

### Task 5: Link phụ huynh tra bằng SHA-256, không trả hash ra client

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 11; spec mục 4 (Q9), 6.5, 7 (F2); code thật `src/server/services/parent-link.service.ts`, `student.service.ts` (`withLevel`, `createStudent`, `updateStudent`), `src/lib/types/models.ts` (`StudentDTO`), `tests/integration/parent-link.test.ts`, `tests/e2e/parent-link.spec.ts`, `tests/integration/backup.test.ts` (dòng `UPDATE "students" SET "parent_link_token"`).

**Files:**
- Create: `src/server/crypto/parent-token.ts`
- Modify: `src/server/services/parent-link.service.ts`, `src/server/services/student.service.ts`, `src/lib/types/models.ts`, `tests/integration/parent-link.test.ts`, `tests/e2e/parent-link.spec.ts`

**Interfaces:**
- Consumes: cột `parentLinkTokenHash` (Task 2); extension mã hoá `parentLinkToken` (Task 4).
- Produces: `hashParentToken(token: string): string` (64 ký tự hex). `StudentDTO` không có `parentLinkTokenHash`. `student.list/create/update` không trả `parentLinkTokenHash`.

- [ ] **Step 1: Viết test đỏ (bổ sung `tests/integration/parent-link.test.ts`)**

Đổi dòng đang lọc theo token (khoảng dòng 83):
```ts
    expect(await db.student.findUnique({ where: { parentLinkTokenHash: hashParentToken(first.token) } })).toBeNull()
```
Thêm import `import { hashParentToken } from "@/server/crypto/parent-token"` và khối:
```ts
describe("Link phụ huynh: tra theo hash, token mã hoá (spec O 6.5)", () => {
  it("tạo link: DB có hash SHA-256 + token ciphertext; list trả token rõ, không có hash", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ fullName: "HS Link", grade: 4 })
    const { token } = await t.student.generateParentLink({ id: s.id })
    const [raw] = await db.$queryRaw<Array<{ tok: string; h: string }>>`
      SELECT parent_link_token AS tok, parent_link_token_hash AS h FROM students WHERE id = ${s.id}`
    expect(raw.tok.startsWith("enc:v1:")).toBe(true)
    expect(raw.h).toBe(hashParentToken(token))
    expect(raw.h).toMatch(/^[0-9a-f]{64}$/)
    const item = (await t.student.list({})).items.find((x) => x.id === s.id)!
    expect(item.parentLinkToken).toBe(token)
    expect("parentLinkTokenHash" in item).toBe(false)
    expect(await getParentView(db, token)).not.toBeNull()
  })

  it("token cũ chỉ có bản rõ + hash tính bằng SQL của migration → vẫn mở được", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ fullName: "HS Link Cũ", grade: 4 })
    const token = "Q".repeat(43)
    await db.$executeRaw`UPDATE students SET parent_link_token = ${token},
      parent_link_token_hash = encode(sha256(convert_to(${token}, 'UTF8')), 'hex') WHERE id = ${s.id}`
    const view = await getParentView(db, token)
    expect(view?.student.fullName).toBe("HS Link Cũ")
  })

  it("tắt link: cả 2 cột null, link cũ 404", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ fullName: "HS Tắt", grade: 4 })
    const { token } = await t.student.generateParentLink({ id: s.id })
    await t.student.disableParentLink({ id: s.id })
    const [raw] = await db.$queryRaw<Array<{ tok: string | null; h: string | null }>>`
      SELECT parent_link_token AS tok, parent_link_token_hash AS h FROM students WHERE id = ${s.id}`
    expect(raw).toEqual({ tok: null, h: null })
    expect(await getParentView(db, token)).toBeNull()
  })
})
```

Run: `pnpm test tests/integration/parent-link.test.ts`
Expected: FAIL (không resolve `@/server/crypto/parent-token`).

- [ ] **Step 2: Viết `src/server/crypto/parent-token.ts`**

```ts
import { createHash } from "node:crypto"

// Token 256-bit ngẫu nhiên nên SHA-256 trần là đủ (không cần salt/HMAC). Khớp sha256() của Postgres trong migration O.
export function hashParentToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
```

- [ ] **Step 3: Sửa `parent-link.service.ts`**

- `generateParentLink`: `data: { parentLinkToken: token, parentLinkTokenHash: hashParentToken(token) }`.
- `disableParentLink`: `data: { parentLinkToken: null, parentLinkTokenHash: null }`.
- `getParentView`: `where: { parentLinkTokenHash: hashParentToken(token) }` (giữ kiểm `PARENT_TOKEN_REGEX` trước).
- Ghi chú 1 dòng ở `getParentView`: `// Tra theo hash: dump DB không cho ra token dùng được (spec O Q9).`

- [ ] **Step 4: Không trả hash ra client**

`src/lib/types/models.ts`:
```ts
export interface StudentDTO extends Omit<Student, "createdAt" | "updatedAt" | "parentLinkTokenHash"> {
```
`student.service.ts`: thay `withLevel` dùng cho HS bằng:
```ts
// Hash chỉ để tra link phụ huynh, không gửi ra client (spec O 6.5).
function toStudentDTO<T extends { grade: number; parentLinkTokenHash: string | null }>(s: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { parentLinkTokenHash, ...rest } = s
  return { ...rest, level: getLevel(s.grade) }
}
```
Dùng ở `listStudents`, `createStudent`, `updateStudent` (và mọi chỗ khác trả nguyên dòng `Student` ra router — grep `withLevel(`). Nếu `withLevel` còn chỗ khác dùng (không phải Student) thì giữ `withLevel`.

- [ ] **Step 5: E2E `tests/e2e/parent-link.spec.ts`**

Chỗ tạo HS bằng Prisma trực tiếp có `parentLinkToken: <token>` → thêm `parentLinkTokenHash: hashParentToken(<token>)` (import từ `../../src/server/crypto/parent-token`). Chỗ nào dò `db.student.findUnique({ where: { parentLinkToken` → đổi sang hash.

- [ ] **Step 6: Chạy test**

Run: `pnpm test tests/integration/parent-link.test.ts tests/integration/backup.test.ts tests/integration/student.test.ts`
Expected: PASS.

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` rồi `pnpm exec playwright test tests/e2e/parent-link.spec.ts`
Expected: PASS.

- [ ] **Step 7: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/server/crypto/parent-token.ts src/server/services/parent-link.service.ts src/server/services/student.service.ts src/lib/types/models.ts tests/integration/parent-link.test.ts tests/e2e/parent-link.spec.ts
git commit -m "feat(o): link phụ huynh tra bằng SHA-256, token lưu mã hoá, không trả hash ra client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: Đồng ý chia sẻ dữ liệu phía server + nhật ký bảo mật + codemod test

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 6, 7, 9; spec mục 4 (Q10, Q11, Q15), 6.6 (phần Schema, Server, Router), 6.9, 6.13 ý 4; code thật `src/lib/schemas/student.ts`, `src/lib/schemas/settings.ts`, `src/server/trpc/routers/student.ts`, `src/server/trpc/routers/settings.ts`, `src/server/trpc/index.ts` (`ctx.ip`), `tests/integration/settings.test.ts`.

**Files:**
- Create: `src/lib/consent.ts`, `src/server/services/consent.service.ts`, `src/server/services/security-event.service.ts`
- Modify: `src/lib/schemas/student.ts`, `src/lib/schemas/settings.ts`, `src/lib/schemas/auth.ts`, `src/server/trpc/routers/student.ts`, `src/server/trpc/routers/settings.ts`, `src/server/trpc/routers/auth.ts`
- Modify (codemod): mọi `tests/integration/*.test.ts`, `tests/e2e/*.spec.ts` gọi caller `student.create/update/importMany`, `auth.register`, `settings.updateBankAccount`
- Test (Mới): `tests/unit/lib/consent.test.ts`, `tests/integration/consent.test.ts`

**Interfaces:**
- Consumes: `db.consentRecord`, `db.securityEvent` (Task 2).
- Produces:
  - `src/lib/consent.ts`: `CONSENT_TEXT_VERSION = "2026-10-v1"`, `CONSENT_SCOPES`, `type ConsentScope = "register" | "bank_account" | "student" | "student_import"`, `STUDENT_PERSONAL_FIELDS`, `CONSENT_REQUIRED = "CONSENT_REQUIRED"`, `consentPayload` (zod object `{ accepted: literal(true), version }`, version phải bằng `CONSENT_TEXT_VERSION`), `type ConsentPayload`, `CONSENT_ACCEPTED`, `updateTouchesPersonalData(data: Partial<Record<"fullName"|"parentName"|"parentPhone"|"notes", unknown>>): boolean`, `isConsentError(e: { message?: string } | null | undefined): boolean`.
  - `consent.service.ts`: `recordConsent(db: PrismaClient, p: { userId: number; scope: ConsentScope; studentId?: number | null; itemCount?: number; ipAddress: string | null }): Promise<void>`, `assertUpdateConsent(data, consent: ConsentPayload | undefined): void`.
  - `security-event.service.ts`: `SECURITY_EVENTS`, `type SecurityEvent`, `logSecurityEvent(db: PrismaClient, p: { userId: number; event: SecurityEvent; ipAddress: string | null }): Promise<void>`, `ipFromRequest(req: Request): string | null`.
  - Input tRPC (field thống nhất `consent: ConsentPayload`): `auth.register` = `registerSchema` + `consent`; `student.create` = `studentCreateSchema` + `consent`; `student.update` = `{ id, data, consent?: ConsentPayload }`; `student.importMany` = `{ rows, consent }`; `settings.updateBankAccount` = `{ bankBin, bankAccountNumber, bankAccountName, consent } | null`.

- [ ] **Step 1: Viết test đỏ `tests/unit/lib/consent.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  CONSENT_ACCEPTED,
  CONSENT_REQUIRED,
  CONSENT_TEXT_VERSION,
  consentPayload,
  isConsentError,
  updateTouchesPersonalData,
} from "@/lib/consent"

describe("consent (spec O 6.6, bổ sung H2)", () => {
  const schema = z.object({ consent: consentPayload })
  it("chỉ nhận { accepted: true, version hiện hành }; mọi dạng khác báo CONSENT_REQUIRED", () => {
    expect(CONSENT_ACCEPTED).toEqual({ accepted: true, version: CONSENT_TEXT_VERSION })
    expect(schema.safeParse({ consent: CONSENT_ACCEPTED }).success).toBe(true)
    for (const v of [
      {},
      { consent: CONSENT_ACCEPTED },
      { consent: { accepted: false, version: CONSENT_TEXT_VERSION } },
      { consent: { accepted: true } },
      { consent: { accepted: true, version: "2000-01-v0" } },
    ]) {
      const r = schema.safeParse(v)
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error.issues[0].message).toBe(CONSENT_REQUIRED)
    }
  })

  it("updateTouchesPersonalData: chỉ trường cá nhân mới cần đồng ý", () => {
    expect(updateTouchesPersonalData({ fullName: "A" })).toBe(true)
    expect(updateTouchesPersonalData({ notes: null })).toBe(true)
    expect(updateTouchesPersonalData({})).toBe(false)
    expect(updateTouchesPersonalData({ isActive: false, grade: 3 } as Record<string, unknown>)).toBe(false)
  })

  it("isConsentError nhận cả lỗi zod (JSON) lẫn TRPCError", () => {
    expect(isConsentError({ message: '[{"message":"CONSENT_REQUIRED"}]' })).toBe(true)
    expect(isConsentError({ message: "CONSENT_REQUIRED" })).toBe(true)
    expect(isConsentError({ message: "khác" })).toBe(false)
    expect(isConsentError(null)).toBe(false)
  })
})
```

Run: `pnpm test tests/unit/lib/consent.test.ts` → Expected: FAIL (không resolve `@/lib/consent`).

- [ ] **Step 2: Viết `src/lib/consent.ts`**

```ts
import { z } from "zod"

// Đổi câu chữ ô đồng ý hoặc trang /privacy thì tăng version (bằng chứng ghi version đã hiện).
export const CONSENT_TEXT_VERSION = "2026-10-v1"
export const CONSENT_SCOPES = ["register", "bank_account", "student", "student_import"] as const
export type ConsentScope = (typeof CONSENT_SCOPES)[number]
export const STUDENT_PERSONAL_FIELDS = ["fullName", "parentName", "parentPhone", "notes"] as const
export const CONSENT_REQUIRED = "CONSENT_REQUIRED"

const required = { errorMap: () => ({ message: CONSENT_REQUIRED }) }
// Key đồng ý thống nhất gửi kèm payload của đúng API ("extra_data" theo người dùng). Version lệch = tab cũ, bắt tải lại.
export const consentPayload = z
  .object({ accepted: z.literal(true, required), version: z.string(required) }, required)
  .refine((c) => c.version === CONSENT_TEXT_VERSION, { message: CONSENT_REQUIRED })
export type ConsentPayload = z.infer<typeof consentPayload>
export const CONSENT_ACCEPTED: ConsentPayload = { accepted: true, version: CONSENT_TEXT_VERSION }

export function updateTouchesPersonalData(
  data: Partial<Record<(typeof STUDENT_PERSONAL_FIELDS)[number], unknown>>
): boolean {
  return STUDENT_PERSONAL_FIELDS.some((f) => data[f] !== undefined)
}

// Lỗi zod của tRPC có message là JSON issues → so chứa chuỗi.
export function isConsentError(e: { message?: string } | null | undefined): boolean {
  return !!e?.message?.includes(CONSENT_REQUIRED)
}
```

Run lại → Expected: PASS.

- [ ] **Step 3: Service đồng ý + nhật ký**

`src/server/services/consent.service.ts`:
```ts
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { CONSENT_REQUIRED, CONSENT_TEXT_VERSION, updateTouchesPersonalData, type ConsentPayload, type ConsentScope } from "@/lib/consent"

// Ghi TRƯỚC khi ghi dữ liệu: thời điểm đồng ý là lúc bấm Lưu (spec O Q11).
export async function recordConsent(
  db: PrismaClient,
  p: { userId: number; scope: ConsentScope; studentId?: number | null; itemCount?: number; ipAddress: string | null }
): Promise<void> {
  await db.consentRecord.create({
    data: {
      userId: p.userId,
      scope: p.scope,
      textVersion: CONSENT_TEXT_VERSION,
      studentId: p.studentId ?? null,
      itemCount: p.itemCount ?? 1,
      ipAddress: p.ipAddress?.slice(0, 45) ?? null,
    },
  })
}

// Đổi trạng thái/lớp/học phí không cần tick; chạm tên, SĐT, tên phụ huynh, ghi chú thì bắt buộc.
export function assertUpdateConsent(
  data: Parameters<typeof updateTouchesPersonalData>[0],
  consent: ConsentPayload | undefined
): void {
  if (updateTouchesPersonalData(data) && !consent) {
    throw new TRPCError({ code: "BAD_REQUEST", message: CONSENT_REQUIRED })
  }
}
```

`src/server/services/security-event.service.ts`:
```ts
import type { PrismaClient } from "@prisma/client"

export const SECURITY_EVENTS = [
  "backup_download",
  "bank_account_update",
  "bank_account_clear",
  "parent_link_create",
  "parent_link_disable",
] as const
export type SecurityEvent = (typeof SECURITY_EVENTS)[number]

// Chỉ ghi ai/làm gì/lúc nào/IP, không bao giờ ghi giá trị dữ liệu (spec O Q15).
export async function logSecurityEvent(
  db: PrismaClient,
  p: { userId: number; event: SecurityEvent; ipAddress: string | null }
): Promise<void> {
  await db.securityEvent.create({
    data: { userId: p.userId, event: p.event, ipAddress: p.ipAddress?.slice(0, 45) ?? null },
  })
}

// Cùng cách đọc IP với tRPC context: Vercel ghi đè x-forwarded-for.
export function ipFromRequest(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")
}
```

- [ ] **Step 4: Schema**

`src/lib/schemas/settings.ts`:
```ts
import { consentPayload } from "@/lib/consent"
// ...
// null = xoá thông tin ngân hàng (không cần đồng ý); lưu thì bắt buộc cờ đồng ý (spec O Q10).
export const updateBankAccountSchema = bankAccountSchema.extend({ consent: consentPayload }).nullable()
```
`src/lib/schemas/student.ts`:
```ts
import { consentPayload } from "@/lib/consent"
// ...
// Form dùng studentCreateSchema (không có cờ); input tRPC bắt buộc cờ đồng ý (spec O Q10).
export const studentCreateInputSchema = studentCreateSchema.extend({ consent: consentPayload })

export const studentUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: studentCreateSchema.partial(),
  consent: consentPayload.optional(),
})
```
và trong `studentImportSchema` thêm `consent: consentPayload,` cạnh `rows`.

`src/lib/schemas/auth.ts` (form Đăng ký vẫn dùng `registerSchema` làm resolver; input tRPC bắt buộc key đồng ý — bổ sung H2):
```ts
import { consentPayload } from "@/lib/consent"
// ...
export const registerInputSchema = registerSchema.extend({ consent: consentPayload })
```

- [ ] **Step 5: Router**

`src/server/trpc/routers/student.ts`:
```ts
  create: protectedProcedure
    .input(studentCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      await recordConsent(ctx.db, { userId: ctx.userId, scope: "student", ipAddress: ctx.ip })
      return createStudent(ctx.db, ctx.userId, input)
    }),

  update: protectedProcedure
    .input(studentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      assertUpdateConsent(input.data, input.consent)
      if (updateTouchesPersonalData(input.data)) {
        await recordConsent(ctx.db, { userId: ctx.userId, scope: "student", studentId: input.id, ipAddress: ctx.ip })
      }
      return updateStudent(ctx.db, ctx.userId, input.id, input.data)
    }),
```
`importMany`:
```ts
    .mutation(async ({ ctx, input }) => {
      await recordConsent(ctx.db, { userId: ctx.userId, scope: "student_import", itemCount: input.rows.length, ipAddress: ctx.ip })
      return importStudents(ctx.db, ctx.userId, input.rows)
    }),
```
(`createStudent` chỉ đọc từng trường nên cờ `consent` thừa trong `input` không lọt vào DB.)

`src/server/trpc/routers/auth.ts` — `register` đổi `.input(registerSchema)` thành `.input(registerInputSchema)`; ngay sau dòng tạo user thành công (`const user = await registerUser(ctx.db, input)`):
```ts
        // Cần id user mới nên ghi sau khi tạo; cùng request nên vẫn là bằng chứng lúc bấm Đăng ký (bổ sung H2).
        await recordConsent(ctx.db, { userId: user.id, scope: "register", ipAddress: ctx.ip })
```
(`registerUser` chỉ đọc `username/password/fullName` nên key `consent` thừa không vào DB. Thiếu key → zod từ chối TRƯỚC khi tạo user.)

`src/server/trpc/routers/settings.ts`:
```ts
  updateBankAccount: protectedProcedure
    .input(updateBankAccountSchema)
    .mutation(async ({ ctx, input }) => {
      if (input) await recordConsent(ctx.db, { userId: ctx.userId, scope: "bank_account", ipAddress: ctx.ip })
      const account = input
        ? { bankBin: input.bankBin, bankAccountNumber: input.bankAccountNumber, bankAccountName: input.bankAccountName }
        : null
      const result = await updateBankAccount(ctx.db, ctx.userId, account)
      await logSecurityEvent(ctx.db, { userId: ctx.userId, event: input ? "bank_account_update" : "bank_account_clear", ipAddress: ctx.ip })
      return result
    }),
```

- [ ] **Step 6: Viết test tích hợp `tests/integration/consent.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { CONSENT_ACCEPTED, CONSENT_TEXT_VERSION } from "@/lib/consent"
import { publicCaller } from "../helpers/trpc"

async function cleanup() {
  await db.user.deleteMany({ where: { username: { startsWith: "dk_consent_" } } })
  await db.student.deleteMany()
  await db.consentRecord.deleteMany()
  await db.securityEvent.deleteMany()
  await db.user.updateMany({ data: { bankBin: null, bankAccountNumber: null, bankAccountName: null } })
}
beforeEach(cleanup)
afterAll(cleanup)

const BANK = { bankBin: "970436", bankAccountNumber: "0011001234567", bankAccountName: "NGUYEN VAN A" }

describe("Đồng ý chia sẻ dữ liệu phía server (spec O 6.6)", () => {
  it("auth.register thiếu key đồng ý → BAD_REQUEST, không tạo user; có key → 1 bằng chứng scope register", async () => {
    // @ts-expect-error gọi như client cũ không gửi key
    await expect(publicCaller.auth.register({ username: "dk_consent_a", password: "MatKhau2026x", fullName: "A" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.user.count({ where: { username: "dk_consent_a" } })).toBe(0)
    await publicCaller.auth.register({ consent: CONSENT_ACCEPTED, username: "dk_consent_b", password: "MatKhau2026x", fullName: "B" })
    const u = await db.user.findUniqueOrThrow({ where: { username: "dk_consent_b" } })
    expect(await db.consentRecord.findFirstOrThrow({ where: { userId: u.id } })).toMatchObject({ scope: "register", textVersion: CONSENT_TEXT_VERSION })
  })

  it("key đồng ý mang version cũ (tab chưa tải lại) → BAD_REQUEST", async () => {
    const t = await getAuthedCaller()
    await expect(t.student.create({ consent: { accepted: true, version: "2000-01-v0" }, fullName: "Tab Cũ", grade: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("student.create thiếu consent → BAD_REQUEST, không ghi HS, không ghi bằng chứng", async () => {
    const t = await getAuthedCaller()
    // @ts-expect-error gọi như client cũ không gửi cờ
    await expect(t.student.create({ fullName: "Không Đồng Ý", grade: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.student.count()).toBe(0)
    expect(await db.consentRecord.count()).toBe(0)
  })

  it("student.create có consent → 1 bằng chứng scope student, đúng version, userId", async () => {
    const t = await getAuthedCaller()
    await t.student.create({ consent: CONSENT_ACCEPTED, fullName: "Có Đồng Ý", grade: 3 })
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    const rows = await db.consentRecord.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId: teacher.id, scope: "student", textVersion: CONSENT_TEXT_VERSION, studentId: null, itemCount: 1 })
  })

  it("student.update: sửa tên thiếu consent → CONSENT_REQUIRED, tên giữ nguyên; chỉ đổi isActive không cần", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ consent: CONSENT_ACCEPTED, fullName: "Tên Cũ", grade: 3 })
    await expect(t.student.update({ id: s.id, data: { fullName: "Tên Mới" } })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "CONSENT_REQUIRED" })
    expect((await t.student.list({})).items[0].fullName).toBe("Tên Cũ")
    await t.student.update({ id: s.id, data: { isActive: false } })
    expect(await db.consentRecord.count()).toBe(1)
    await t.student.update({ id: s.id, data: { fullName: "Tên Mới" }, consent: CONSENT_ACCEPTED })
    const last = await db.consentRecord.findFirstOrThrow({ orderBy: { id: "desc" } })
    expect(last).toMatchObject({ scope: "student", studentId: s.id })
  })

  it("student.importMany: thiếu consent bị từ chối; có consent ghi itemCount = số dòng", async () => {
    const t = await getAuthedCaller()
    const rows = [{ fullName: "Nhập A", grade: 3, tuitionFee: 0 }, { fullName: "Nhập B", grade: 4, tuitionFee: 0 }]
    // @ts-expect-error thiếu cờ
    await expect(t.student.importMany({ rows })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await db.student.count()).toBe(0)
    await t.student.importMany({ rows, consent: CONSENT_ACCEPTED })
    expect(await db.consentRecord.findFirstOrThrow()).toMatchObject({ scope: "student_import", itemCount: 2 })
  })

  it("settings.updateBankAccount: thiếu consent bị từ chối; có consent ghi bằng chứng + sự kiện; xoá (null) không cần", async () => {
    const t = await getAuthedCaller()
    // @ts-expect-error thiếu cờ
    await expect(t.settings.updateBankAccount(BANK)).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(await t.settings.getBankAccount()).toBeNull()
    await t.settings.updateBankAccount({ ...BANK, consent: CONSENT_ACCEPTED })
    expect(await t.settings.getBankAccount()).toEqual(BANK)
    expect(await db.consentRecord.findFirstOrThrow()).toMatchObject({ scope: "bank_account" })
    await t.settings.updateBankAccount(null)
    expect(await t.settings.getBankAccount()).toBeNull()
    const events = await db.securityEvent.findMany({ orderBy: { id: "asc" } })
    expect(events.map((e) => e.event)).toEqual(["bank_account_update", "bank_account_clear"])
    expect(await db.consentRecord.count()).toBe(1)
  })
})
```
(Các input thiếu `consent` dùng `// @ts-expect-error`; nếu tsc báo "unused @ts-expect-error" vì kiểu cho phép → schema chưa bắt buộc cờ, sửa schema.)

- [ ] **Step 7: Codemod test cũ**

Tạo script tạm ở scratchpad của phiên (KHÔNG commit), ví dụ `<scratchpad>/add-consent.js`:
```js
const fs = require("fs")
const path = require("path")
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
let n = 0
for (const f of walk("tests")) {
  if (f.endsWith(path.join("integration", "consent.test.ts"))) continue
  const before = fs.readFileSync(f, "utf8")
  // Lời gọi caller tRPC; bỏ qua Prisma (`{ data:` / `{ where:` ngay sau) và chỗ đã có cờ.
  let s = before.replace(/\.(student\.(?:create|update|importMany)|auth\.register)\(\{(?!\s*(data|where|consent)\s*:)/g, (_m, op) => `.${op}({ consent: CONSENT_ACCEPTED, `)
  s = s.replace(/(['"])(student\.create|auth\.register)\1,\s*\{(?!\s*consent\s*:)/g, (_m, q, op) => `${q}${op}${q}, { consent: CONSENT_ACCEPTED, `)
  if (s !== before && !/\bCONSENT_ACCEPTED\b.*from/.test(s)) {
    // e2e không chắc nhận alias "@/": dùng đường dẫn tương đối.
    const rel = path.relative(path.dirname(f), "src/lib/consent").split(path.sep).join("/")
    s = `import { CONSENT_ACCEPTED } from "${f.includes("e2e") ? rel : "@/lib/consent"}"\n` + s
  }
  if (s !== before) { fs.writeFileSync(f, s); n++; console.log("sửa", f) }
}
console.log("số file đã sửa:", n)
```
Run (Bash, từ gốc repo): `node <scratchpad>/add-consent.js`

Sửa tay `updateBankAccount(`: `grep -rn "updateBankAccount(" tests` → mọi lời gọi caller có tham số khác `null` đổi thành `updateBankAccount({ ...X, consent: CONSENT_ACCEPTED })` (hoặc thêm `consent: CONSENT_ACCEPTED` vào object literal). Không đổi lời gọi service trực tiếp `updateBankAccount(db, ...)`.

Run: `pnpm exec tsc --noEmit`
Expected: sạch. Lỗi còn lại dạng "Property 'consent' is missing" → lời gọi truyền biến (không phải object literal): thêm `consent: CONSENT_ACCEPTED` tay. Lỗi "Object literal may only specify known properties … consent" trên lời gọi Prisma → codemod bắt nhầm, gỡ tay.

`git diff --stat tests` → ghi số file đã sửa vào báo cáo.

- [ ] **Step 8: Chạy test**

Run: `pnpm test tests/unit/lib/consent.test.ts tests/integration/consent.test.ts tests/integration/settings.test.ts tests/integration/student.test.ts tests/integration/student-import.test.ts`
Expected: PASS.

Run: `pnpm test` (toàn bộ)
Expected: PASS. Ca đỏ vì `CONSENT_REQUIRED` → lời gọi codemod chưa bắt, thêm cờ tay.

- [ ] **Step 9: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/consent.ts src/server/services/consent.service.ts src/server/services/security-event.service.ts src/lib/schemas/student.ts src/lib/schemas/settings.ts src/server/trpc/routers/student.ts src/server/trpc/routers/settings.ts tests/unit/lib/consent.test.ts tests/integration/consent.test.ts
git add -u tests
git commit -m "feat(o): bắt buộc cờ đồng ý ở server khi lưu TK ngân hàng, tạo/sửa/nhập học sinh; ghi consent_records + security_events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```
(`git add -u tests` chỉ lấy file test đã theo dõi mà codemod sửa; kiểm `git status --short` trước, không có file lạ.)

---

### Task 7: Ô đồng ý ở Đăng ký + 3 form, trang `/privacy`, e2e tick ô

**Đọc trước:** Global Constraints (i18n, màu, 44px, next15-contract); "Điều chỉnh so với spec" ý 5, 10; spec mục 6.6 (UI + bảng văn bản), 6.7, 6.13 ý 7, 14 (H1, H2); code thật `StudentFormDialog.tsx`, `BankAccountCard.tsx`, `ImportStudentsDialog.tsx`, `src/components/ui/checkbox.tsx`, `src/middleware.ts`, `tests/unit/middleware-matcher.test.ts`, `src/app/login/LoginForm.tsx`, `src/app/register/RegisterForm.tsx`, `tests/unit/components/ImportStudentsDialog.test.tsx`; spec Q (thùng rác) để viết đúng câu mục "Lưu trữ và xoá".

**Files:**
- Create: `src/components/common/ConsentCheckbox.tsx`, `src/app/privacy/page.tsx`, `src/components/privacy/PrivacyContent.tsx`
- Create: `src/lib/privacy.ts`, `tests/unit/components/RegisterForm.test.tsx`
- Modify: `src/components/settings/BankAccountCard.tsx`, `src/components/students/StudentFormDialog.tsx`, `src/components/students/ImportStudentsDialog.tsx`, `.env.example`, `src/middleware.ts`, `src/app/login/LoginForm.tsx`, `src/app/register/RegisterForm.tsx`, `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/ConsentCheckbox.test.tsx` (Mới), `tests/unit/components/StudentFormDialog.test.tsx` (Mới), `tests/unit/components/ImportStudentsDialog.test.tsx` (Sửa), `tests/unit/middleware-matcher.test.ts` (Sửa); e2e tạo HS/nhập Excel qua UI (Sửa)

**Interfaces:**
- Consumes: input tRPC có cờ `consent` (Task 6), `isConsentError`, `CONSENT_TEXT_VERSION` (Task 6).
- Produces: `ConsentCheckbox({ id: string; label: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean })`; id cố định `bank-consent`, `student-consent`, `import-consent`; trang công khai `/privacy`.

- [ ] **Step 1: i18n**

Thêm vào `vi.json` và `en.json` (cùng key):

| Key | vi | en |
|---|---|---|
| `consent_bank` | Tôi đồng ý chia sẻ thông tin tài khoản ngân hàng này để ứng dụng lưu trữ (đã mã hoá) và in lên phiếu báo học phí gửi phụ huynh. | I agree to share this bank account so the app can store it (encrypted) and show it on tuition notices sent to parents. |
| `consent_student` | Tôi đồng ý chia sẻ dữ liệu cá nhân của học sinh và phụ huynh để ứng dụng lưu trữ (đã mã hoá), và xác nhận đã được phụ huynh cho phép. | I agree to share this student's and parent's personal data so the app can store it (encrypted), and I confirm the parent has given permission. |
| `consent_import` | Tôi đồng ý chia sẻ dữ liệu cá nhân của các học sinh trong danh sách để ứng dụng lưu trữ (đã mã hoá), và xác nhận đã được phụ huynh cho phép. | I agree to share the personal data of the students in this list so the app can store it (encrypted), and I confirm their parents have given permission. |
| `consent_register` | Tôi đồng ý để ứng dụng lưu trữ và xử lý dữ liệu cá nhân của tôi (họ tên, tên đăng nhập) và dữ liệu tôi nhập để quản lý lịch dạy. | I agree that the app stores and processes my personal data (name, username) and the data I enter to manage my teaching. |
| `register_username_hint` | Không nên dùng số điện thoại làm tên đăng nhập. | Avoid using your phone number as your username. |
| `consent_required` | Vui lòng tick ô đồng ý chia sẻ dữ liệu trước khi lưu. | Please tick the consent box before saving. |
| `privacy_title` | Chính sách bảo mật | Privacy Policy |
| `privacy_collect_title` | Dữ liệu chúng tôi lưu | Data we store |
| `privacy_collect_body` | Tài khoản giáo viên (tên đăng nhập, họ tên, mật khẩu đã băm), tài khoản ngân hàng nhận học phí, thông tin học sinh và phụ huynh do giáo viên nhập (họ tên, lớp, số điện thoại, ghi chú), lịch dạy, điểm danh và học phí. | Teacher accounts (username, full name, hashed password), the bank account for tuition, student and parent details entered by teachers (name, grade, phone, notes), schedules, attendance and tuition. |
| `privacy_purpose_title` | Mục đích sử dụng | How we use it |
| `privacy_purpose_body` | Chỉ để quản lý lịch dạy, điểm danh, học phí, tạo phiếu báo học phí và trang thông tin cho phụ huynh. Không bán, không quảng cáo, không chia sẻ cho bên thứ ba ngoài nhà cung cấp hạ tầng (Vercel, Neon, máy chủ tại Singapore). | Only to manage schedules, attendance and tuition, and to create tuition notices and parent pages. We do not sell data, show ads, or share it with third parties other than our hosting providers (Vercel, Neon, servers in Singapore). |
| `privacy_protect_title` | Cách chúng tôi bảo vệ | How we protect it |
| `privacy_protect_body` | Các trường cá nhân được mã hoá AES-256 trong cơ sở dữ liệu, mật khẩu được băm bcrypt, kết nối qua HTTPS. Mỗi giáo viên chỉ xem được dữ liệu của mình; quản trị viên chỉ xem thông tin gói. | Personal fields are encrypted with AES-256 in the database, passwords are hashed with bcrypt, and all traffic uses HTTPS. Each teacher can only see their own data; administrators only see plan information. |
| `privacy_teacher_title` | Trách nhiệm của giáo viên | Teacher responsibilities |
| `privacy_teacher_body` | Chỉ nhập dữ liệu học sinh khi đã được phụ huynh cho phép. Không chia sẻ công khai link phụ huynh. Giữ kín file sao lưu. | Only enter student data with the parent's permission. Do not share parent links publicly. Keep backup files private. |
| `privacy_delete_title` | Lưu trữ và xoá | Retention and deletion |
| `privacy_delete_body` | Dữ liệu được giữ trong thời gian tài khoản còn hoạt động. Dữ liệu bạn xoá được chuyển vào thùng rác. Muốn xoá vĩnh viễn hoặc xoá tài khoản, liên hệ {contact}. | Data is kept while your account is active. Data you delete goes to the trash. To delete it permanently or close your account, contact {contact}. |
| `privacy_version` | Phiên bản: {v} | Version: {v} |

Ghi chú: câu `privacy_delete_body` viết theo thùng rác của Q — đối chiếu tên gọi thật trong UI của Q (vd "Thùng rác") và sửa cho khớp; `{contact}` thay bằng `PRIVACY_CONTACT` (Step 7). Không dùng gạch dài.

- [ ] **Step 2: Viết test đỏ `tests/unit/components/ConsentCheckbox.test.tsx`**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ConsentCheckbox } from "@/components/common/ConsentCheckbox"

describe("ConsentCheckbox", () => {
  it("bấm chữ thì tick; KHÔNG có link rời form (bổ sung H2)", () => {
    const onChange = vi.fn()
    render(
      <LanguageProvider>
        <ConsentCheckbox id="x-consent" label="Tôi đồng ý chia sẻ" checked={false} onCheckedChange={onChange} />
      </LanguageProvider>
    )
    expect(screen.queryByRole("link")).toBeNull()
    fireEvent.click(screen.getByText("Tôi đồng ý chia sẻ"))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole("checkbox", { name: "Tôi đồng ý chia sẻ" })).toBeTruthy()
  })
})
```

Run: `pnpm test tests/unit/components/ConsentCheckbox.test.tsx` → Expected: FAIL (không resolve).

- [ ] **Step 3: Viết `src/components/common/ConsentCheckbox.tsx`**

```tsx
"use client"

import { Checkbox } from "@/components/ui/checkbox"

type Props = {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

// Mặc định không tick; nơi dùng reset về false mỗi lần mở form (spec O Q12).
// Không đặt link sang /privacy ở đây: người dùng không bị kéo rời form (bổ sung H2); link nằm ở /login.
export function ConsentCheckbox({ id, label, checked, onCheckedChange, disabled }: Props) {
  return (
    <div className="flex min-h-11 items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="mt-0.5 h-5 w-5"
      />
      <label htmlFor={id} className="cursor-pointer text-sm text-slate-700">
        {label}
      </label>
    </div>
  )
}
```
Run lại → Expected: PASS.

- [ ] **Step 4: Viết test đỏ `tests/unit/components/StudentFormDialog.test.tsx`**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CONSENT_ACCEPTED } from "@/lib/consent"

const createMutate = vi.fn()
const updateMutate = vi.fn()
vi.mock("@/lib/trpc", () => ({
  trpc: {
    student: {
      create: { useMutation: () => ({ mutate: createMutate, isPending: false }) },
      update: { useMutation: () => ({ mutate: updateMutate, isPending: false }) },
    },
  },
}))
vi.mock("@/hooks/usePlan", () => ({ usePlan: () => ({ me: null }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { StudentFormDialog } from "@/components/students/StudentFormDialog"

const STUDENT = {
  id: 7, userId: 1, fullName: "Trần An", grade: 3, parentPhone: null, parentName: null, notes: null,
  isActive: true, tuitionFee: 0, parentLinkToken: null, level: "tieu_hoc", createdAt: "", updatedAt: "",
} as never

function renderDialog(props: Partial<Parameters<typeof StudentFormDialog>[0]> = {}) {
  return render(
    <LanguageProvider>
      <StudentFormDialog open onOpenChange={() => {}} mode="create" {...props} />
    </LanguageProvider>
  )
}

beforeEach(() => {
  createMutate.mockReset()
  updateMutate.mockReset()
})

describe("StudentFormDialog: ô đồng ý (spec O 6.6)", () => {
  it("nút Thêm disabled tới khi tick; gửi kèm consent: CONSENT_ACCEPTED", async () => {
    renderDialog()
    const submit = screen.getByRole("button", { name: viText.add })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "Lê Văn Minh" } })
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    expect(createMutate.mock.calls[0][0]).toMatchObject({ fullName: "Lê Văn Minh", consent: CONSENT_ACCEPTED })
  })

  it("sửa: ô mặc định không tick; gửi { id, data, consent: CONSENT_ACCEPTED }", async () => {
    renderDialog({ mode: "edit", student: STUDENT })
    const checkbox = screen.getByRole("checkbox", { name: viText.consent_student })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: viText.update }))
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1))
    expect(updateMutate.mock.calls[0][0]).toMatchObject({ id: 7, consent: CONSENT_ACCEPTED, data: { fullName: "Trần An" } })
  })
})
```
(Nhãn nút/trường lấy từ `vi.json` thật; key khác tên → dùng key thật, ghi Ruling. `STUDENT` ép `as never` vì kiểu `RouterOutputs`.)

Run: `pnpm test tests/unit/components/StudentFormDialog.test.tsx` → Expected: FAIL (không có checkbox).

- [ ] **Step 5: Sửa 3 form**

`StudentFormDialog.tsx`:
```tsx
  const [consent, setConsent] = useState(false)
  // trong useEffect khi open: thêm setConsent(false) cạnh form.reset(...)
```
- `onSubmit`: đầu hàm `if (!consent) return`; `createMut.mutate({ ...data, consent: CONSENT_ACCEPTED })`; `updateMut.mutate({ id: student.id, data, consent: CONSENT_ACCEPTED })`.
- `onError` của 2 mutation: `if (isConsentError(e)) toast.error(t("consent_required")); else if (!planRequiredOf(e)) toast.error(e.message)`.
- Trước `<DialogFooter>`: `<ConsentCheckbox id="student-consent" label={t("consent_student")} checked={consent} onCheckedChange={setConsent} disabled={isPending} />`.
- Nút submit: `disabled={isPending || !consent}`.
- Import `useState` từ react, `ConsentCheckbox`, `isConsentError` + `CONSENT_ACCEPTED` từ `@/lib/consent`.

`BankAccountCard.tsx` (`BankAccountForm` mount lại theo `key` sau mỗi lần lưu nên `useState(false)` tự reset):
```tsx
  const [consent, setConsent] = useState(false)
```
- `save`: sau khi parse xong `mutation.mutate({ ...parsed.data, consent: CONSENT_ACCEPTED })`.
- `onError: (e) => setError(isConsentError(e) ? t("consent_required") : e.message)`.
- Chèn `<ConsentCheckbox id="bank-consent" label={t("consent_bank")} checked={consent} onCheckedChange={setConsent} disabled={mutation.isPending} />` ngay trên `{error && …}`.
- Nút Lưu: `disabled={mutation.isPending || !consent}`. Nút Xoá không đổi (`mutation.mutate(null)`).

`ImportStudentsDialog.tsx`:
- `const [consent, setConsent] = useState(false)`; đặt lại `setConsent(false)` ở mọi chỗ đang reset bước xem trước (chọn file mới, đóng dialog, nhập xong).
- Ngay trên `<DialogFooter …>` của bước xem trước: `<ConsentCheckbox id="import-consent" label={t("consent_import")} checked={consent} onCheckedChange={setConsent} disabled={importMut.isPending} />`.
- Nút nhập: `onClick={() => importMut.mutate({ rows: payload, consent: CONSENT_ACCEPTED })}`, `disabled={payload.length === 0 || importMut.isPending || !consent}`.
- Lỗi `isConsentError` → hiện `t("consent_required")` theo cách hiện lỗi sẵn có của dialog.

- [ ] **Step 6: Test ImportStudentsDialog**

Bổ sung `tests/unit/components/ImportStudentsDialog.test.tsx` 1 ca: mock `readImportWorkbook` trả về đúng kiểu thật (đọc `src/lib/student-import-excel.ts` + `student-import.ts` để dựng 1 dòng hợp lệ), mock `importCheck.mutateAsync` trả `{ matches: [null] }`, `importMany.useMutation` trả `{ mutate: importMutate, isPending: false }`; chọn file → tới bước xem trước → nút nhập (nhãn thật trong vi.json) `disabled`; tick `getByRole("checkbox", { name: viText.consent_import })` → bấm → `importMutate` được gọi với `expect.objectContaining({ consent: CONSENT_ACCEPTED })`. Giữ nguyên ca cũ (file > 2MB).

Run: `pnpm test tests/unit/components/StudentFormDialog.test.tsx tests/unit/components/ImportStudentsDialog.test.tsx tests/unit/components/ConsentCheckbox.test.tsx`
Expected: PASS.

- [ ] **Step 7: Trang `/privacy` + matcher + link chân trang**

`src/components/privacy/PrivacyContent.tsx`:
```tsx
"use client"

import Link from "next/link"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { CONSENT_TEXT_VERSION } from "@/lib/consent"
import { PRIVACY_CONTACT } from "@/lib/privacy"

const SECTIONS = [
  ["privacy_collect_title", "privacy_collect_body"],
  ["privacy_purpose_title", "privacy_purpose_body"],
  ["privacy_protect_title", "privacy_protect_body"],
  ["privacy_teacher_title", "privacy_teacher_body"],
  ["privacy_delete_title", "privacy_delete_body"],
] as const

export function PrivacyContent() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-slate-700">
      <h1 className="text-2xl font-semibold text-slate-900">{t("privacy_title")}</h1>
      {SECTIONS.map(([title, body]) => (
        <section key={title} className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{t(title)}</h2>
          <p className="leading-relaxed">{t(body).replace("{contact}", PRIVACY_CONTACT)}</p>
        </section>
      ))}
      <p className="text-sm text-slate-500">{t("privacy_version").replace("{v}", CONSENT_TEXT_VERSION)}</p>
      <Link href="/login" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2">
        {t("login")}
      </Link>
    </main>
  )
}
```
(Key `login` phải có sẵn trong vi.json; không có thì dùng key nút đăng nhập thật.)

`src/lib/privacy.ts` (MỚI; H1 chưa trả lời → **người dùng điền `NEXT_PUBLIC_PRIVACY_CONTACT` ở Vercel trước khi merge O1**):
```ts
// Kênh liên hệ yêu cầu xem/xoá dữ liệu (spec O H1). Next inline NEXT_PUBLIC_* lúc build.
export const PRIVACY_CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT || "email/Zalo của chủ ứng dụng"
```
`.env.example` thêm `NEXT_PUBLIC_PRIVACY_CONTACT=""  # vd "Zalo 09xx hoặc email …" — hiện trên /privacy`.

`src/app/privacy/page.tsx`:
```tsx
import type { Metadata } from "next"
import { PrivacyContent } from "@/components/privacy/PrivacyContent"

export const metadata: Metadata = { title: "Chính sách bảo mật" }

// Công khai, không đọc query (luật next15-contract); layout gốc đã có LanguageProvider.
export default function PrivacyPage() {
  return <PrivacyContent />
}
```

`src/middleware.ts` matcher: thêm `privacy` sau `register`:
```ts
    "/((?!login|register|privacy|p/|api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)",
```
(Đối chiếu matcher thật — P/Q/K có thể đã thêm ngoại lệ; chỉ chèn `privacy|`.)

`tests/unit/middleware-matcher.test.ts` thêm:
```ts
  it("/privacy là route công khai (spec O 6.7)", () => {
    expect(needsAuth("/privacy")).toBe(false)
  })
```

`LoginForm.tsx` (bắt buộc) và `RegisterForm.tsx` (chữ nhỏ, không bắt buộc bấm): dưới dòng link chuyển trang sẵn có thêm
```tsx
      <Link href="/privacy" className="mt-2 inline-flex min-h-11 items-center text-xs text-slate-500 hover:underline">
        {t("privacy_title")}
      </Link>
```
(Theo cách lấy `t` sẵn có của từng form; `tests/unit/components/LoginForm.test.tsx` thêm 1 ca: có link `/privacy`.)

`RegisterForm.tsx` (bổ sung H2, H5):
- Dưới ô tên đăng nhập: `<p className="text-xs text-slate-500">{t("register_username_hint")}</p>` (chỉ gợi ý, không chặn).
- `const [consent, setConsent] = useState(false)`; trước nút Đăng ký: `<ConsentCheckbox id="register-consent" label={t("consent_register")} checked={consent} onCheckedChange={setConsent} disabled={mutation.isPending} />`; nút `disabled={mutation.isPending || !consent}`; `mutation.mutate({ ...values, consent: CONSENT_ACCEPTED })`; lỗi `isConsentError` → `t("consent_required")`.
- Test MỚI `tests/unit/components/RegisterForm.test.tsx` (mock `@/lib/trpc` như `StudentFormDialog.test.tsx`, `auth.register.useMutation` trả `{ mutate, isPending: false }`): nút Đăng ký disabled tới khi tick `getByRole("checkbox", { name: viText.consent_register })`; điền form hợp lệ + tick + bấm → `mutate` nhận `expect.objectContaining({ consent: CONSENT_ACCEPTED })`; có chữ `viText.register_username_hint`.
- E2E đăng ký qua UI (`grep -rln "/register" tests/e2e`): tick `#register-consent` trước khi bấm Đăng ký.

- [ ] **Step 8: E2E tick ô**

Run (Bash): `grep -rln "fill('input\[id=\"fullName\"\]'" tests/e2e; grep -rln "Nhập Excel\|import-file-input" tests/e2e`
Với mỗi test tạo/sửa HS qua form: trước khi bấm nút Thêm/Cập nhật, thêm
```ts
    await page.getByRole('checkbox', { name: /đồng ý chia sẻ|agree to share/i }).click();
```
Với `students-import.spec.ts`: tick ô ở bước xem trước trước khi bấm nhập. Nếu có e2e lưu TK ngân hàng qua UI: tick ô `bank-consent` trước khi Lưu.

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` rồi lần lượt `pnpm exec playwright test <từng file vừa sửa>`
Expected: PASS.

- [ ] **Step 9: tsc + lint + test liên quan + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit/middleware-matcher.test.ts tests/unit/next15-contract.test.ts tests/unit/theme-legacy-colors.test.ts tests/unit/components/LoginForm.test.tsx`
Expected: sạch, PASS.

```bash
git add src/lib/privacy.ts .env.example tests/unit/components/RegisterForm.test.tsx src/components/common/ConsentCheckbox.tsx src/components/settings/BankAccountCard.tsx src/components/students/StudentFormDialog.tsx src/components/students/ImportStudentsDialog.tsx src/app/privacy/page.tsx src/components/privacy/PrivacyContent.tsx src/middleware.ts src/app/login/LoginForm.tsx src/app/register/RegisterForm.tsx src/language/vi.json src/language/en.json tests/unit/components/ConsentCheckbox.test.tsx tests/unit/components/StudentFormDialog.test.tsx tests/unit/components/ImportStudentsDialog.test.tsx tests/unit/middleware-matcher.test.ts
git add -u tests/e2e
git commit -m "feat(o): ô đồng ý chia sẻ dữ liệu ở form ngân hàng, học sinh, nhập Excel; trang /privacy công khai

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 8: Cảnh báo + nhật ký sao lưu, nhật ký link phụ huynh, header bảo mật

**Đọc trước:** Global Constraints; "Điều chỉnh so với spec" ý 8; spec mục 4 (Q14–Q16), 6.8, 6.9, 6.10, 7 (F4, F6, F8); code thật `src/components/layout/AppHeader.tsx` (+ mọi chỗ gọi `useBackupDownload`), `src/app/api/backup/route.ts`, `src/server/services/backup.service.ts` (khối sheet "Thông tin"), `src/server/trpc/routers/student.ts` (`generateParentLink`/`disableParentLink`), `next.config.mjs`, `tests/unit/components/AppHeader.test.tsx`, `tests/integration/backup-route.test.ts`.

**Files:**
- Create: `src/components/layout/BackupConfirmDialog.tsx`, `tests/unit/security-headers.test.ts`, `tests/integration/security-events.test.ts`
- Modify: `src/components/layout/AppHeader.tsx`, `src/app/api/backup/route.ts`, `src/server/services/backup.service.ts`, `src/server/trpc/routers/student.ts`, `next.config.mjs`, `src/language/vi.json`, `en.json`, `tests/unit/components/AppHeader.test.tsx`, `tests/integration/backup-route.test.ts`

**Interfaces:**
- Consumes: `logSecurityEvent`, `ipFromRequest` (Task 6).
- Produces: `BackupConfirmDialog({ open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void })`; `GET(request: Request)` ở `/api/backup`; sự kiện `backup_download`, `parent_link_create`, `parent_link_disable`.

- [ ] **Step 1: i18n**

| Key | vi | en |
|---|---|---|
| `backup_confirm_title` | Tải file sao lưu | Download backup file |
| `backup_confirm_desc` | File chứa toàn bộ dữ liệu cá nhân của học sinh, phụ huynh và tài khoản ngân hàng ở dạng chưa mã hoá. Chỉ lưu ở nơi an toàn, không gửi qua Zalo, Facebook hay email, xoá khi không còn cần. | The file contains all personal data of students, parents and your bank account, unencrypted. Keep it somewhere safe, do not send it via chat apps or email, and delete it when no longer needed. |
| `backup_confirm_download` | Tôi hiểu, tải xuống | I understand, download |

- [ ] **Step 2: Test đỏ**

`tests/integration/backup-route.test.ts`: thêm helper `const req = () => new Request("http://localhost/api/backup", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } })`, đổi mọi `GET()` thành `GET(req())`, thêm ca:
```ts
  it("tải thành công ghi 1 sự kiện backup_download kèm IP, không ghi khi 401", async () => {
    await db.securityEvent.deleteMany()
    // (dựng session như các ca thành công sẵn có trong file)
    const res = await GET(req())
    expect(res.status).toBe(200)
    const ev = await db.securityEvent.findMany()
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ event: "backup_download", ipAddress: "203.0.113.9" })
  })
```
(Theo cách mock `auth` sẵn có trong file để dựng phiên hợp lệ/không hợp lệ; ca 401 sẵn có thêm `expect(await db.securityEvent.count()).toBe(0)`.)

`tests/integration/security-events.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

async function cleanup() {
  await db.student.deleteMany()
  await db.securityEvent.deleteMany()
}
beforeEach(cleanup)
afterAll(cleanup)

// (thêm ở đầu file) import { CONSENT_ACCEPTED } from "@/lib/consent"
describe("security_events (spec O 6.9)", () => {
  it("tạo và tắt link phụ huynh ghi 2 sự kiện, không có cột giá trị", async () => {
    const t = await getAuthedCaller()
    const s = await t.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS Sự Kiện", grade: 5 })
    await t.student.generateParentLink({ id: s.id })
    await t.student.disableParentLink({ id: s.id })
    const ev = await db.securityEvent.findMany({ orderBy: { id: "asc" } })
    expect(ev.map((e) => e.event)).toEqual(["parent_link_create", "parent_link_disable"])
    expect(Object.keys(ev[0]).sort()).toEqual(["createdAt", "event", "id", "ipAddress", "userId"])
  })

  it("thao tác lỗi (HS không thuộc mình) không ghi sự kiện", async () => {
    const t2 = await getAuthedCaller("teacher2")
    const s = await t2.student.create({ consent: CONSENT_ACCEPTED, fullName: "HS GV2", grade: 5 })
    const t = await getAuthedCaller()
    await expect(t.student.generateParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await db.securityEvent.count()).toBe(0)
  })
})
```

`tests/unit/security-headers.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

type Rule = { source: string; headers: { key: string; value: string }[] }

async function rules(): Promise<Rule[]> {
  // Import động theo URL để tsc không đòi khai báo kiểu cho file .mjs.
  const mod = await import(pathToFileURL(join(process.cwd(), "next.config.mjs")).href)
  return mod.default.headers()
}

describe("Header bảo mật (spec O Q16)", () => {
  it("luật toàn trang có đủ 6 header và đứng trước luật /p", async () => {
    const all = await rules()
    const gi = all.findIndex((r) => r.source === "/:path*")
    const pi = all.findIndex((r) => r.source === "/p/:path*")
    expect(gi).toBeGreaterThanOrEqual(0)
    expect(pi).toBeGreaterThan(gi)
    const h = Object.fromEntries(all[gi].headers.map((x) => [x.key, x.value]))
    expect(h["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains")
    expect(h["X-Content-Type-Options"]).toBe("nosniff")
    expect(h["X-Frame-Options"]).toBe("DENY")
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()")
    expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'")
    const p = Object.fromEntries(all[pi].headers.map((x) => [x.key, x.value]))
    expect(p["Referrer-Policy"]).toBe("no-referrer")
  })
})
```

`tests/unit/components/AppHeader.test.tsx`: đổi mock `useBackupDownload` sang hàm ổn định (`const download = vi.hoisted(() => vi.fn())`, mock trả `{ download, isDownloading: false }`), thêm ca: mở menu → bấm "Sao lưu dữ liệu" → `download` **chưa** được gọi, thấy tiêu đề "Tải file sao lưu" → bấm "Tôi hiểu, tải xuống" → `download` được gọi 1 lần. Giữ các ca cũ (danh sách mục menu).

Run: `pnpm test tests/unit/security-headers.test.ts tests/unit/components/AppHeader.test.tsx tests/integration/security-events.test.ts tests/integration/backup-route.test.ts`
Expected: FAIL (chưa có header, dialog, sự kiện; `GET(req())` vẫn chạy nhưng không ghi sự kiện).

- [ ] **Step 3: Cài đặt**

`src/components/layout/BackupConfirmDialog.tsx`:
```tsx
"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }

// File sao lưu là bản rõ toàn bộ dữ liệu → nhắc trước khi tải (spec O Q14).
export function BackupConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("backup_confirm_title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("backup_confirm_desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 md:h-10">{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction className="h-11 md:h-10" onClick={onConfirm}>
            {t("backup_confirm_download")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```
`AppHeader.tsx`: `const [confirmBackup, setConfirmBackup] = useState(false)`; mục menu `onSelect={() => setConfirmBackup(true)}`; ngoài `DropdownMenu` render `<BackupConfirmDialog open={confirmBackup} onOpenChange={setConfirmBackup} onConfirm={() => { setConfirmBackup(false); backup.download() }} />`. Chỗ khác gọi `useBackupDownload` (grep) làm tương tự.

`backup.service.ts`: hằng
```ts
const NOTE_SENSITIVE = "File chứa dữ liệu cá nhân chưa mã hoá. Không gửi qua mạng xã hội hay email, xoá khi không còn cần."
```
và `info.addRow(["Lưu ý", NOTE_SENSITIVE])` sau 2 dòng "Lưu ý" sẵn có. (`tests/integration/backup.test.ts` nếu so số dòng sheet Thông tin → cập nhật kỳ vọng.)

`src/app/api/backup/route.ts`:
```ts
export async function GET(request: Request) {
  // ... như cũ tới writeBuffer()
    const buffer = await wb.xlsx.writeBuffer()
    // Xuất toàn bộ dữ liệu là thao tác nhạy cảm nhất → ghi nhật ký (spec O Q15).
    await logSecurityEvent(db, { userId, event: "backup_download", ipAddress: ipFromRequest(request) })
    return new Response(buffer, { /* như cũ */ })
```

`src/server/trpc/routers/student.ts`:
```ts
  generateParentLink: planProcedure("parentLink")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const res = await generateParentLink(ctx.db, ctx.userId, input.id)
      await logSecurityEvent(ctx.db, { userId: ctx.userId, event: "parent_link_create", ipAddress: ctx.ip })
      return res
    }),

  disableParentLink: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const res = await disableParentLink(ctx.db, ctx.userId, input.id)
      await logSecurityEvent(ctx.db, { userId: ctx.userId, event: "parent_link_disable", ipAddress: ctx.ip })
      return res
    }),
```

`next.config.mjs` trong `headers()` đặt luật này **đầu** mảng (trước `/p/:path*`):
```js
      // Toàn trang (spec O Q16). CSP chỉ gồm chỉ thị không chặn script inline của Next.
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
```

- [ ] **Step 4: Chạy test**

Run: `pnpm test tests/unit/security-headers.test.ts tests/unit/components/AppHeader.test.tsx tests/integration/security-events.test.ts tests/integration/backup-route.test.ts tests/integration/backup.test.ts tests/integration/parent-link.test.ts`
Expected: PASS.

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` rồi `pnpm exec playwright test tests/e2e/backup.spec.ts tests/e2e/parent-link.spec.ts`
Expected: PASS (e2e sao lưu bấm thêm nút "Tôi hiểu, tải xuống" trước khi chờ `download` — sửa spec nếu đỏ vì bước mới).

- [ ] **Step 5: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/components/layout/BackupConfirmDialog.tsx src/components/layout/AppHeader.tsx src/app/api/backup/route.ts src/server/services/backup.service.ts src/server/trpc/routers/student.ts next.config.mjs src/language/vi.json src/language/en.json tests/unit/security-headers.test.ts tests/unit/components/AppHeader.test.tsx tests/integration/security-events.test.ts tests/integration/backup-route.test.ts
git add -u tests
git commit -m "feat(o): cảnh báo trước khi tải sao lưu, nhật ký tải sao lưu/link phụ huynh, header bảo mật toàn trang

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 9: Script mã hoá dữ liệu cũ (dry-run / apply / verify / decrypt / rotate)

**Đọc trước:** Global Constraints (Script backfill, Khoá); spec mục 4 (Q17–Q19), 6.2 (xoay khoá), 6.11, 6.13 ý 1, 10 (O2 runbook); `src/server/crypto/field-crypto.ts`, `prisma-encryption.ts` (`ENCRYPTED_FIELDS`); `prisma/schema.prisma` (tên bảng/cột thật `@@map`/`@map`, cột xoá mềm của Q).

**Files:**
- Create: `src/server/crypto/backfill.ts`, `scripts/crypto-backfill.ts`
- Test (Mới): `tests/integration/crypto-backfill.test.ts`

**Interfaces:**
- Consumes: `encryptField`, `decryptField`, `isEncrypted`, `readKid`, `loadKeyring` (Task 1); `ENCRYPTED_FIELDS` (Task 4); `hashParentToken` (Task 5, trong test).
- Produces (`src/server/crypto/backfill.ts`):
  - `type FieldTarget = { model: string; table: string; column: string; field: string }`, `FIELD_TARGETS: readonly FieldTarget[]` (14 mục)
  - `type BackfillMode = "dry-run" | "apply" | "verify" | "decrypt" | "rotate"`
  - `type FieldReport = { table: string; column: string; total: number; empty: number; plain: number; encrypted: Record<string, number>; undecryptable: number; changed: number; checksum: string }`
  - `runBackfill(raw: PrismaClient, mode: BackfillMode, opts?: { batchSize?: number; log?: (line: string) => void }): Promise<FieldReport[]>`
  - CLI `pnpm exec tsx scripts/crypto-backfill.ts [--dry-run|--apply|--verify|--decrypt|--rotate] [--batch N]`, mã thoát 0/1/2.

- [ ] **Step 1: Viết test đỏ `tests/integration/crypto-backfill.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { randomBytes } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { db } from "@/server/db"
import { ENCRYPTED_FIELDS } from "@/server/crypto/prisma-encryption"
import { FIELD_TARGETS, runBackfill, type FieldReport } from "@/server/crypto/backfill"
import { readKid } from "@/server/crypto/field-crypto"
import { hashParentToken } from "@/server/crypto/parent-token"
import { getParentView } from "@/server/services/parent-link.service"

// Client THƯỜNG (không extension) để ghi bản rõ như dữ liệu trước O và đọc ciphertext thô.
const raw = new PrismaClient()
const ORIGINAL = { keys: process.env.DATA_ENCRYPTION_KEYS, active: process.env.DATA_ENCRYPTION_ACTIVE_KID }
const TOKEN = "T".repeat(43)

async function cleanup() {
  await raw.sessionStudent.deleteMany()
  await raw.teachingSession.deleteMany()
  await raw.student.deleteMany()
}
beforeEach(async () => {
  process.env.DATA_ENCRYPTION_KEYS = ORIGINAL.keys
  process.env.DATA_ENCRYPTION_ACTIVE_KID = ORIGINAL.active
  await cleanup()
})
afterAll(async () => {
  process.env.DATA_ENCRYPTION_KEYS = ORIGINAL.keys
  process.env.DATA_ENCRYPTION_ACTIVE_KID = ORIGINAL.active
  await cleanup()
  await raw.$disconnect()
})

const col = (reports: FieldReport[], table: string, column: string) =>
  reports.find((r) => r.table === table && r.column === column)!

async function seedPlain() {
  const teacher = await raw.user.findUniqueOrThrow({ where: { username: "teacher" } })
  const s = await raw.student.create({
    data: { userId: teacher.id, fullName: "Bản Rõ Một", grade: 3, parentPhone: "0901111222", notes: "ghi chú rõ", parentLinkToken: TOKEN, parentLinkTokenHash: hashParentToken(TOKEN) },
  })
  const deleted = await raw.student.create({ data: { userId: teacher.id, fullName: "Đã Xoá Mềm", grade: 4 } })
  // Thùng rác của Q cũng phải được mã hoá (spec O 6.13 ý 1). Đổi tên cột theo schema thật của Q.
  const cols = await raw.$queryRaw<Array<{ c: string }>>`SELECT column_name AS c FROM information_schema.columns WHERE table_name = 'students' AND column_name IN ('deleted_at','is_deleted')`
  if (cols.some((x) => x.c === "deleted_at")) await raw.$executeRawUnsafe(`UPDATE "students" SET "deleted_at" = now() WHERE id = $1`, deleted.id)
  if (cols.some((x) => x.c === "is_deleted")) await raw.$executeRawUnsafe(`UPDATE "students" SET "is_deleted" = true WHERE id = $1`, deleted.id)
  return { s, deleted }
}

async function rawStudent(id: number) {
  const [r] = await raw.$queryRaw<Array<{ fn: string; ph: string | null; nt: string | null; tok: string | null; up: Date }>>`
    SELECT full_name AS fn, parent_phone AS ph, notes AS nt, parent_link_token AS tok, updated_at AS up FROM students WHERE id = ${id}`
  return r
}

describe("Backfill mã hoá dữ liệu cũ (spec O 6.11)", () => {
  it("FIELD_TARGETS phủ đúng ENCRYPTED_FIELDS, mỗi cặp 1 lần", () => {
    const want = Object.entries(ENCRYPTED_FIELDS).flatMap(([m, fs]) => fs.map((f) => `${m}.${f}`)).sort()
    expect(FIELD_TARGETS.map((t) => `${t.model}.${t.field}`).sort()).toEqual(want)
  })

  it("dry-run không ghi; apply mã hoá cả dòng xoá mềm, giữ updated_at, checksum không đổi; apply lần 2 changed = 0; verify sạch", async () => {
    const { s, deleted } = await seedPlain()
    const before = await rawStudent(s.id)
    const dry = await runBackfill(raw, "dry-run")
    expect(col(dry, "students", "full_name").plain).toBeGreaterThanOrEqual(2)
    expect(dry.every((r) => r.changed === 0)).toBe(true)
    expect((await rawStudent(s.id)).fn).toBe("Bản Rõ Một")

    const applied = await runBackfill(raw, "apply")
    const after = await rawStudent(s.id)
    for (const v of [after.fn, after.ph, after.nt, after.tok]) expect(v?.startsWith("enc:v1:")).toBe(true)
    expect((await rawStudent(deleted.id)).fn.startsWith("enc:v1:")).toBe(true)
    expect(after.up.getTime()).toBe(before.up.getTime())
    for (const r of applied) {
      expect(r.checksum, `${r.table}.${r.column}`).toBe(col(dry, r.table, r.column).checksum)
      expect(r.plain).toBe(0)
    }

    const again = await runBackfill(raw, "apply")
    expect(again.every((r) => r.changed === 0)).toBe(true)
    const verify = await runBackfill(raw, "verify")
    expect(verify.every((r) => r.plain === 0 && r.undecryptable === 0)).toBe(true)

    // App (qua extension) vẫn đọc đúng; link phụ huynh cũ vẫn mở được.
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).fullName).toBe("Bản Rõ Một")
    expect((await getParentView(db, TOKEN))?.student.fullName).toBe("Bản Rõ Một")
  })

  it("rotate sang khoá mới; decrypt đưa về bản rõ; checksum giữ nguyên", async () => {
    const { s } = await seedPlain()
    const dry = await runBackfill(raw, "dry-run")
    await runBackfill(raw, "apply")
    const oldKid = readKid((await rawStudent(s.id)).fn)
    process.env.DATA_ENCRYPTION_KEYS = `${ORIGINAL.keys},r2:${randomBytes(32).toString("base64")}`
    process.env.DATA_ENCRYPTION_ACTIVE_KID = "r2"
    const rotated = await runBackfill(raw, "rotate")
    expect(readKid((await rawStudent(s.id)).fn)).toBe("r2")
    expect(col(rotated, "students", "full_name").encrypted[oldKid!] ?? 0).toBe(0)
    const back = await runBackfill(raw, "decrypt")
    expect((await rawStudent(s.id)).fn).toBe("Bản Rõ Một")
    for (const r of back) expect(r.checksum).toBe(col(dry, r.table, r.column).checksum)
  })

  it("chuỗi giả tiền tố enc:v1: không giải mã được → undecryptable, không bị ghi", async () => {
    const { s } = await seedPlain()
    await raw.$executeRaw`UPDATE students SET notes = 'enc:v1:t1:hong:hong:hong' WHERE id = ${s.id}`
    const lines: string[] = []
    const rep = await runBackfill(raw, "apply", { log: (l) => lines.push(l) })
    expect(col(rep, "students", "notes").undecryptable).toBe(1)
    expect((await rawStudent(s.id)).nt).toBe("enc:v1:t1:hong:hong:hong")
    expect(lines.join("\n")).toContain(`students.notes id=${s.id}`)
    expect(lines.join("\n")).not.toContain("hong:hong")
  })
})
```

Run: `pnpm test tests/integration/crypto-backfill.test.ts`
Expected: FAIL (không resolve `@/server/crypto/backfill`).

- [ ] **Step 2: Viết `src/server/crypto/backfill.ts`**

```ts
import { createHash } from "node:crypto"
import type { PrismaClient } from "@prisma/client"
import { decryptField, encryptField, isEncrypted, loadKeyring, readKid } from "./field-crypto"

export type FieldTarget = { model: string; table: string; column: string; field: string }

// Tên bảng/cột thật (@@map/@map) là hằng, không nhận từ input nên nối vào SQL an toàn.
export const FIELD_TARGETS: readonly FieldTarget[] = [
  { model: "User", table: "users", column: "full_name", field: "fullName" },
  { model: "User", table: "users", column: "bank_account_number", field: "bankAccountNumber" },
  { model: "User", table: "users", column: "bank_account_name", field: "bankAccountName" },
  { model: "Student", table: "students", column: "full_name", field: "fullName" },
  { model: "Student", table: "students", column: "parent_name", field: "parentName" },
  { model: "Student", table: "students", column: "parent_phone", field: "parentPhone" },
  { model: "Student", table: "students", column: "notes", field: "notes" },
  { model: "Student", table: "students", column: "parent_link_token", field: "parentLinkToken" },
  { model: "SessionStudent", table: "session_students", column: "note", field: "note" },
  { model: "TeachingSession", table: "teaching_sessions", column: "notes", field: "notes" },
  { model: "TeachingSession", table: "teaching_sessions", column: "cancel_reason", field: "cancelReason" },
  { model: "MonthlyTuition", table: "monthly_tuition", column: "notes", field: "notes" },
  { model: "Payment", table: "payments", column: "note", field: "note" },
  { model: "PlanOrder", table: "plan_orders", column: "note", field: "note" },
]

export type BackfillMode = "dry-run" | "apply" | "verify" | "decrypt" | "rotate"

export type FieldReport = {
  table: string
  column: string
  total: number
  empty: number
  plain: number
  encrypted: Record<string, number>
  undecryptable: number
  changed: number
  checksum: string
}

function nextValue(mode: BackfillMode, stored: string, plain: string, field: string, active: string): string {
  if (isEncrypted(stored)) {
    if (mode === "decrypt") return plain
    if (mode === "rotate" && readKid(stored) !== active) return encryptField(plain, field)
    return stored
  }
  return mode === "apply" ? encryptField(stored, field) : stored
}

// Đọc MỌI dòng (kể cả đã xoá mềm của Q). Ghi bằng raw SQL để không bump updated_at.
export async function runBackfill(
  raw: PrismaClient,
  mode: BackfillMode,
  opts: { batchSize?: number; log?: (line: string) => void } = {}
): Promise<FieldReport[]> {
  const batch = opts.batchSize ?? 200
  const log = opts.log ?? (() => {})
  const { active } = loadKeyring()
  const reports: FieldReport[] = []
  for (const t of FIELD_TARGETS) {
    const r: FieldReport = { table: t.table, column: t.column, total: 0, empty: 0, plain: 0, encrypted: {}, undecryptable: 0, changed: 0, checksum: "" }
    const hash = createHash("sha256")
    let lastId = 0
    for (;;) {
      const rows = await raw.$queryRawUnsafe<Array<{ id: number; v: string | null }>>(
        `SELECT id, "${t.column}" AS v FROM "${t.table}" WHERE id > $1 ORDER BY id LIMIT $2`,
        lastId,
        batch
      )
      if (rows.length === 0) break
      for (const row of rows) {
        lastId = row.id
        r.total++
        if (row.v === null || row.v === "") {
          r.empty++
          hash.update(`${row.id}\u0001${row.v === null ? "n" : "e"}\n`)
          continue
        }
        let plain: string
        try {
          plain = decryptField(row.v, t.field)
        } catch {
          // Không in giá trị: có thể là bản rõ tình cờ bắt đầu bằng tiền tố.
          r.undecryptable++
          log(`${t.table}.${t.column} id=${row.id} không giải mã được`)
          hash.update(`${row.id}\u0002\n`)
          continue
        }
        hash.update(`${row.id}\u0000${plain}\n`)
        let final = row.v
        const next = nextValue(mode, row.v, plain, t.field, active)
        if (next !== row.v) {
          const n = await raw.$executeRawUnsafe(
            `UPDATE "${t.table}" SET "${t.column}" = $1 WHERE id = $2 AND "${t.column}" = $3`,
            next,
            row.id,
            row.v
          )
          if (n === 1) {
            r.changed++
            final = next
          } else {
            log(`${t.table}.${t.column} id=${row.id} bị sửa đồng thời, bỏ qua lượt này`)
          }
        }
        if (isEncrypted(final)) {
          const kid = readKid(final) ?? "?"
          r.encrypted[kid] = (r.encrypted[kid] ?? 0) + 1
        } else {
          r.plain++
        }
      }
    }
    r.checksum = hash.digest("hex")
    reports.push(r)
  }
  return reports
}
```

- [ ] **Step 3: Chạy test, thấy xanh**

Run: `pnpm test tests/integration/crypto-backfill.test.ts`
Expected: PASS (4 test). Nếu id các bảng thật không phải số nguyên (vd Q đổi kiểu) → DỪNG, báo người điều phối.

- [ ] **Step 4: Viết CLI `scripts/crypto-backfill.ts`**

```ts
// Mã hoá dữ liệu cá nhân cũ (spec O 6.11). Mặc định dry-run; ghi cần CONFIRM_HOST khớp host DB.
//   DATABASE_URL=... DATA_ENCRYPTION_KEYS=... DATA_ENCRYPTION_ACTIVE_KID=... \
//   [CONFIRM_HOST=<host>] pnpm exec tsx scripts/crypto-backfill.ts [--dry-run|--apply|--verify|--decrypt|--rotate] [--batch 200]
import { PrismaClient } from "@prisma/client"
import { runBackfill, type BackfillMode } from "../src/server/crypto/backfill"
import { loadKeyring } from "../src/server/crypto/field-crypto"

const MODES: BackfillMode[] = ["dry-run", "apply", "verify", "decrypt", "rotate"]
const WRITE_MODES: BackfillMode[] = ["apply", "decrypt", "rotate"]

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const modes = MODES.filter((m) => args.includes(`--${m}`))
  if (modes.length > 1) {
    console.error("Chỉ chọn 1 chế độ")
    return 1
  }
  const mode = modes[0] ?? "dry-run"
  const bi = args.indexOf("--batch")
  const batchSize = bi >= 0 ? Number(args[bi + 1]) : 200
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    console.error("--batch phải là số nguyên dương")
    return 1
  }

  // Kiểm TRƯỚC khi tạo PrismaClient: thiếu biến thì Prisma sẽ tự nạp .env (= production).
  for (const name of ["DATABASE_URL", "DATA_ENCRYPTION_KEYS", "DATA_ENCRYPTION_ACTIVE_KID"]) {
    if (!process.env[name]) {
      console.error(`Thiếu biến môi trường ${name} (truyền trực tiếp trong lệnh, không đọc từ file)`)
      return 1
    }
  }
  const url = process.env.DATABASE_URL!
  const host = url.match(/@([^/?]+)/)?.[1] ?? "?"
  const ring = loadKeyring()
  console.log(`Chế độ: ${mode} | DB host: ${host} | kid active: ${ring.active} | kid có khoá: ${[...ring.keys.keys()].join(",")}`)
  if (WRITE_MODES.includes(mode) && process.env.CONFIRM_HOST !== host) {
    console.error(`Chế độ ${mode} ghi dữ liệu: cần CONFIRM_HOST=${host}`)
    return 1
  }

  const raw = new PrismaClient({ datasources: { db: { url } } })
  try {
    const reports = await runBackfill(raw, mode, { batchSize, log: (l) => console.log(l) })
    console.table(
      reports.map((r) => ({
        cot: `${r.table}.${r.column}`,
        total: r.total,
        empty: r.empty,
        plain: r.plain,
        encrypted: Object.entries(r.encrypted).map(([k, n]) => `${k}:${n}`).join(" ") || "0",
        undecryptable: r.undecryptable,
        changed: r.changed,
      }))
    )
    for (const r of reports) console.log(`checksum ${r.table}.${r.column} ${r.checksum}`)
    const dirty = reports.some((r) => r.undecryptable > 0 || (mode === "verify" && r.plain > 0))
    return dirty ? 2 : 0
  } finally {
    await raw.$disconnect()
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // Chỉ in tên lỗi + message (không chứa giá trị dữ liệu/khoá theo thiết kế field-crypto).
    console.error(`Lỗi: ${err instanceof Error ? `${err.name}: ${err.message}` : "không rõ"}`)
    process.exit(1)
  }
)
```

- [ ] **Step 5: Chạy thử CLI trên DB test (KHÔNG prod)**

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` (nạp seed; seed ghi qua `db` → đã mã hoá).

Run (Bash):
```bash
TEST_URL=$(grep -E '^DATABASE_URL=' .env.test | cut -d= -f2- | tr -d '"')
case "$TEST_URL" in *localhost:5433*) ;; *) echo "DỪNG"; exit 1;; esac
KEYS=$(grep -E '^DATA_ENCRYPTION_KEYS=' .env.test | cut -d= -f2- | tr -d '"')
ACT=$(grep -E '^DATA_ENCRYPTION_ACTIVE_KID=' .env.test | cut -d= -f2- | tr -d '"')
export DATABASE_URL="$TEST_URL" DATA_ENCRYPTION_KEYS="$KEYS" DATA_ENCRYPTION_ACTIVE_KID="$ACT"
pnpm exec tsx scripts/crypto-backfill.ts --dry-run; echo "exit=$?"
pnpm exec tsx scripts/crypto-backfill.ts --apply; echo "exit=$?"
CONFIRM_HOST=localhost:5433 pnpm exec tsx scripts/crypto-backfill.ts --apply; echo "exit=$?"
pnpm exec tsx scripts/crypto-backfill.ts --verify; echo "exit=$?"
env -u DATA_ENCRYPTION_KEYS pnpm exec tsx scripts/crypto-backfill.ts --dry-run; echo "exit=$?"
```
Expected: dòng đầu in `DB host: localhost:5433`, bảng 14 cột, `exit=0`; `--apply` không `CONFIRM_HOST` → `cần CONFIRM_HOST=localhost:5433`, `exit=1`; có `CONFIRM_HOST` → `exit=0`; `--verify` → `exit=0`; thiếu khoá → `Thiếu biến môi trường DATA_ENCRYPTION_KEYS`, `exit=1`. Không dòng nào in khoá. Dán bảng kết quả (không có dữ liệu) vào báo cáo.

- [ ] **Step 6: tsc + lint + commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/server/crypto/backfill.ts scripts/crypto-backfill.ts tests/integration/crypto-backfill.test.ts
git commit -m "feat(o): script mã hoá dữ liệu cũ (dry-run/apply/verify/decrypt/rotate, checksum, CONFIRM_HOST)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 10: Version 0.8.0, e2e luồng đồng ý / `/privacy` / sao lưu, hồi quy toàn bộ

**Đọc trước:** Global Constraints (E2E, CẤM `pnpm build`); "Giai đoạn triển khai" (O1); "Review Focus"; spec mục 2 (tiêu chí), 10 (O1: trước/sau merge), 11 (E2E).

**Files:**
- Modify: `package.json` (`version`)
- Create: `tests/e2e/consent-privacy.spec.ts`

**Interfaces:**
- Consumes: mọi task trước.
- Produces: nhánh O1 sẵn sàng cho review cuối + merge của người điều phối.

- [ ] **Step 1: Nâng version (commit riêng)**

Sửa `package.json` `"version": "0.8.0"`.
```bash
git add package.json
git commit -m "chore(o): nâng version 0.8.0 (epoch 0.7, mọi người đăng nhập lại 1 lần khi O lên)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 2: Viết `tests/e2e/consent-privacy.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

test.describe('Spec O: đồng ý chia sẻ dữ liệu, chính sách, cảnh báo sao lưu', () => {
  test('/privacy mở được khi chưa đăng nhập, có đủ mục', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Chính sách bảo mật' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
  });

  test('/login có link tới /privacy; /register bắt tick đồng ý và có gợi ý tên đăng nhập', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Chính sách bảo mật' })).toHaveAttribute('href', '/privacy');
    await page.goto('/register');
    await expect(page.getByText('Không nên dùng số điện thoại làm tên đăng nhập.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Đăng ký/ })).toBeDisabled();
    await page.locator('#register-consent').click();
    await expect(page.getByRole('button', { name: /Đăng ký/ })).toBeEnabled();
  });

  test('thêm HS: nút Thêm bị khoá tới khi tick ô đồng ý; ô đồng ý không có link rời form', async ({ page }) => {
    await login(page);
    await page.goto('/students');
    await page.click('text=Thêm học sinh');
    const name = `HS dong y ${Math.floor(Math.random() * 1_000_000)}`;
    await page.fill('input[id="fullName"]', name);
    const add = page.locator('button[type="submit"]:has-text("Thêm")');
    await expect(add).toBeDisabled();
    await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0);
    await page.getByRole('checkbox', { name: /đồng ý chia sẻ/i }).click();
    await expect(add).toBeEnabled();
    await add.click();
    await expect(page.locator('text=Đã thêm học sinh')).toBeVisible();
  });

  test('cài đặt ngân hàng: Lưu bị khoá tới khi tick', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    const save = page.getByRole('button', { name: 'Lưu' });
    await expect(save).toBeDisabled();
    await page.getByRole('checkbox', { name: /đồng ý chia sẻ/i }).click();
    await expect(save).toBeEnabled();
  });

  test('sao lưu: hiện cảnh báo trước khi tải', async ({ page }) => {
    await login(page);
    // Mở menu tài khoản theo cách của tests/e2e/backup.spec.ts.
    await page.getByRole('button', { name: /tài khoản|account/i }).first().click();
    await page.getByRole('menuitem', { name: 'Sao lưu dữ liệu' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('chưa mã hoá');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Tôi hiểu, tải xuống' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^SaoLuu_.*\.xlsx$/);
  });
});
```
(Selector mở menu tài khoản, nhãn nút "Lưu" của trang cài đặt, đường dẫn `/settings`: lấy theo code/e2e thật — `tests/e2e/backup.spec.ts` có sẵn cách mở menu; sửa cho khớp, ghi Ruling.)

- [ ] **Step 3: Chạy e2e**

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` rồi `pnpm exec playwright test tests/e2e/consent-privacy.spec.ts`
Expected: PASS.

Run: `pnpm test tests/integration/plan-launch-migration.test.ts` rồi `pnpm exec playwright test` (toàn bộ)
Expected: PASS. Đỏ vì bước tick ô / hộp cảnh báo sao lưu mới → sửa spec e2e tương ứng (thêm bước), ghi vào báo cáo.

- [ ] **Step 4: Hồi quy + build**

Run: `pnpm lint && pnpm exec tsc --noEmit`
Run: `pnpm test` (toàn bộ) → Expected: PASS.
Run (Bash):
```bash
TEST_URL=$(grep -E '^DATABASE_URL=' .env.test | cut -d= -f2- | tr -d '"')
TEST_DIRECT=$(grep -E '^DIRECT_URL=' .env.test | cut -d= -f2- | tr -d '"')
case "$TEST_URL" in *localhost:5433*) ;; *) echo "DỪNG"; exit 1;; esac
DATABASE_URL="$TEST_URL" DIRECT_URL="$TEST_DIRECT" pnpm exec next build
```
Expected: build thành công (không cần khoá lúc build — khoá đọc lười).

- [ ] **Step 5: Rà soát cuối (ghi kết quả vào báo cáo)**

Run (Bash):
```bash
# 1. Không còn lọc/sắp DB theo trường mã hoá trong code app
grep -rn -E "(fullName|parentName|parentPhone|notes|note|bankAccountNumber|bankAccountName|cancelReason|parentLinkToken)\b[^,]*(contains|startsWith|\"asc\"|'asc'|\"desc\"|'desc')" src/server || echo "sạch 1"
# 2. Raw SQL không chạm cột mã hoá
grep -rn -E "\\\$(queryRaw|executeRaw)" src | grep -E "full_name|parent_|notes|note|bank_account|cancel_reason" || echo "sạch 2"
# 3. console.* mới không in dữ liệu
git diff main --stat
git diff main -- src | grep -E "^\+.*console\.(log|info|warn|error)" || echo "sạch 3"
# 4. Không file khoá/URL prod nào bị commit
git diff main --name-only | grep -E "^\.env$|\.env\.test$" && echo "LỖI: có file env" || echo "sạch 4"
git diff main | grep -E "DATA_ENCRYPTION_KEYS=\"?[a-z0-9]+:[A-Za-z0-9+/]{40,}" && echo "LỖI: lộ khoá" || echo "sạch 5"
```
Expected: `sạch 1` … `sạch 5` (mục 3: nếu có dòng console mới, chỉ được in tên trường/kid/số đếm; trong Task 1–9 không thêm console nào trong `src`).

Báo cáo task gửi người điều phối kèm **checklist trước merge O1** (spec mục 10): (0) người dùng đã đặt `NEXT_PUBLIC_PRIVACY_CONTACT` (H1) ở Vercel Production; (1) người dùng đã sinh khoá `k1`, lưu dự phòng 2 nơi, đặt `DATA_ENCRYPTION_KEYS` + `DATA_ENCRYPTION_ACTIVE_KID` ở Vercel Production (Sensitive); (2) Neon branch `backup-before-O1-<ngày>`; (3) merge `--no-ff` + push; (4) kiểm sau deploy theo spec mục 10.

- [ ] **Step 6: Commit e2e**

```bash
git add tests/e2e/consent-privacy.spec.ts
git add -u tests/e2e
git commit -m "test(o): e2e ô đồng ý, trang /privacy, cảnh báo sao lưu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

## O2 — không có task code (người điều phối)

Theo spec mục 10 "O2": backup Neon `backup-before-O2-backfill-<ngày>` → `--dry-run` (lưu bảng + checksum) → `--apply` với `CONFIRM_HOST` → `--verify` (mã thoát 0, checksum khớp dry-run) → `--apply` lần 2 (`changed = 0`) → người dùng kiểm web bằng `qa_test`. Khoá dán từ **bản dự phòng** của người dùng; không ghi khoá/URL prod vào file. Rollback: `--decrypt`. Xong mới mở O3.

---

### Task 11 (O3): Cảnh báo bản rõ còn sót, tài liệu vận hành khoá, version 0.8.1

**Đọc trước:** Global Constraints; "Giai đoạn triển khai" (O3); spec mục 6.2, 6.11, 6.12, 10 (O3); `src/server/crypto/prisma-encryption.ts` (`decryptResult`); `docs/05-deploy.md`.

**Files:**
- Modify: `src/server/crypto/prisma-encryption.ts`, `docs/05-deploy.md`, `package.json`
- Test: `tests/unit/crypto/prisma-encryption.test.ts` (Sửa)

**Interfaces:**
- Consumes: O1 đã merge vào `main`, O2 đã chạy xong trên prod (`--verify` mã thoát 0).
- Produces: `decryptResult` cảnh báo 1 lần/khoá khi gặp bản rõ dưới trường mã hoá; `resetPlaintextWarnings(): void` (chỉ cho test).

- [ ] **Step 0: Kiểm điều kiện, tạo nhánh**

Run (Bash):
```bash
git checkout main
git pull --ff-only
git log --oneline -10 main
grep '"version"' package.json
```
Expected: có commit merge O1 (`feat: merge feat/o-bao-mat-du-lieu → main`), version `0.8.0`. Người điều phối đã xác nhận trong lời dặn task rằng O2 `--verify` trên prod mã thoát 0. Chưa có xác nhận → **DỪNG, hỏi người điều phối.**
```bash
git checkout -b feat/o3-don-dep-ma-hoa
```

- [ ] **Step 1: Test đỏ (bổ sung `tests/unit/crypto/prisma-encryption.test.ts`)**

```ts
import { vi } from "vitest"
import { resetPlaintextWarnings } from "@/server/crypto/prisma-encryption"

describe("O3: cảnh báo bản rõ còn sót (spec O 6.12)", () => {
  it("cảnh báo đúng 1 lần mỗi khoá, không in giá trị; chuỗi rỗng/null không cảnh báo", () => {
    resetPlaintextWarnings()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    decryptResult({ fullName: "Bí Mật A", notes: "", note: null })
    decryptResult([{ fullName: "Bí Mật B" }])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toBe("[crypto] còn bản rõ ở trường fullName")
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Bí Mật")
    warn.mockRestore()
  })
})
```
Run: `pnpm test tests/unit/crypto/prisma-encryption.test.ts` → Expected: FAIL (`resetPlaintextWarnings` chưa có).

- [ ] **Step 2: Cài đặt trong `prisma-encryption.ts`**

```ts
const warnedPlaintext = new Set<string>()

// Chỉ để test đặt lại trạng thái.
export function resetPlaintextWarnings(): void {
  warnedPlaintext.clear()
}

// Sau O2 mọi trường phải là ciphertext; bản rõ còn sót = có đường ghi vòng qua extension (spec O 6.12).
function warnPlaintext(key: string): void {
  if (warnedPlaintext.has(key)) return
  warnedPlaintext.add(key)
  console.warn(`[crypto] còn bản rõ ở trường ${key}`)
}
```
Trong `decryptResult`, nhánh chuỗi:
```ts
  if (typeof node === "string") {
    if (!key || !ENCRYPTED_KEYS.has(key)) return node
    if (isEncrypted(node)) return decryptField(node, key) as T
    if (node !== "") warnPlaintext(key)
    return node
  }
```

- [ ] **Step 3: Tài liệu `docs/05-deploy.md`**

Thêm mục cuối "Khoá mã hoá dữ liệu cá nhân (spec O)": 2 biến env (chỉ Production, Sensitive); lệnh sinh khoá; **lưu dự phòng 2 nơi trước khi dán, mất khoá = mất dữ liệu**; quy trình xoay khoá 4 bước (spec 6.2); lệnh `scripts/crypto-backfill.ts` các chế độ + `CONFIRM_HOST` + mã thoát; nhắc xoá Neon branch chứa bản rõ sau O2 (spec 6.12). Không chép khoá hay URL thật.

- [ ] **Step 4: Version + test + commit**

`package.json` → `"version": "0.8.1"`.

Run: `pnpm test tests/unit/crypto/prisma-encryption.test.ts tests/integration/field-encryption.test.ts tests/integration/crypto-backfill.test.ts`
Expected: PASS (ca "bản rõ cũ vẫn đọc được" của Task 4 vẫn xanh, chỉ thêm 1 dòng warn).
Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: sạch, PASS.

```bash
git add src/server/crypto/prisma-encryption.ts tests/unit/crypto/prisma-encryption.test.ts docs/05-deploy.md package.json
git commit -m "feat(o3): cảnh báo bản rõ còn sót ở trường mã hoá, tài liệu vận hành khoá, version 0.8.1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

Báo cáo cho người điều phối: sau khi merge O3, nhắc người dùng (spec 6.12) xoá các Neon branch tạo trước O2 (vd `backup-before-O1-…`, `backup-before-O2-backfill-…`, branch backup của các phần trước) sau thời gian giữ đã chọn, tạo 1 branch backup mới, và kiểm cửa sổ history retention của Neon.
