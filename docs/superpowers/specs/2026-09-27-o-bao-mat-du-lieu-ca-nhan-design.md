# O — Bảo mật dữ liệu cá nhân: mã hoá trường nhạy cảm trong DB, ô đồng ý chia sẻ, rà soát bảo mật

> Phần O. Thứ tự merge (người dùng chốt): **P** (sửa backlog) → **Q** (xoá mềm toàn app: cột `is_deleted`/`deleted_at` cho `users` và các bảng dữ liệu, thùng rác giáo viên; spec `docs/superpowers/specs/2026-09-27-q-xoa-mem-design.md`) → **K** (Tổng quan + Doanh thu admin, bảng `user_activity_days`) → **O**. Spec này đọc code trên `main` = `86b37ff` (N `0.4.0`), lúc Q/K chưa có code; P/Q/K có thể đã đổi file dùng chung (schema, `db.ts`, service student/tuition/session/report/backup, admin, i18n) — khi code phải đối chiếu code thật (mục 6.13 nói riêng về Q). Người dùng dặn: "lên plan THẬT KỸ về phần bảo mật, dữ liệu cá nhân khách hàng rất nhạy cảm".
>
> O chia **3 giai đoạn**: **O1** (code + 1 migration không destructive, deploy `0.7.0`) → **O2** (người điều phối chạy script mã hoá dữ liệu cũ trên prod, không deploy) → **O3** (dọn dẹp, deploy `0.7.1`). Mỗi giai đoạn có điều kiện chuyển riêng (mục 10).

## 1. Bối cảnh (đã đọc code)

**Dữ liệu và nơi lưu**
- Prisma 5.22 + Postgres Neon (prod host `ep-polished-voice…`, vùng sin1). `src/server/db.ts` tạo **một** `PrismaClient` có `$extends({ query: { $allOperations } })` chỉ để log truy vấn chậm (> 100ms, in `model.operation`, **không** in tham số). Mọi service nhận `db: PrismaClient` qua tham số; tRPC context truyền `db`. Build Vercel: `prisma generate && prisma migrate deploy && next build` → migration tự áp lên prod khi merge.
- Trường cá nhân lưu **bản rõ** hết, trừ `users.password_hash` (bcryptjs cost 10). Chi tiết mục 5.
- `students.parent_link_token` (G): 32 byte ngẫu nhiên base64url (43 ký tự), `@unique`, lưu bản rõ; trang công khai `/p/<token>` tra `findUnique({ where: { parentLinkToken: token } })`. Token cũng được trả về client trong `student.list` để `ParentLinkDialog` hiện lại link.
- Không có raw SQL nào đọc/ghi cột cá nhân (raw SQL chỉ ở `checkOverlap` đọc `title`, `bulk*FutureSessions` đọc `id/session_date`, `payment` `FOR UPDATE`, các `pg_advisory_xact_lock`).

**Tìm kiếm / sắp xếp theo tên học sinh (chạy trong DB)**
- `student.service.listStudents`: `where.fullName = { contains, mode: "insensitive" }`, `orderBy [grade, fullName]`, `skip/take` phân trang **trong DB**.
- `tuition.service.getMonthlyTuitionStatus`: `where.fullName contains`, `orderBy [grade, fullName]`, rồi **phân trang trong bộ nhớ** (`filteredResults.slice`).
- `session.service.getMonthSessions`: lọc ca qua `sessionStudents.some.student.fullName contains`; `include sessionStudents orderBy { student: { fullName } }` (cũng ở `getSessionDetail`, `getCancelledWithoutMakeup`).
- `report.service` (idle students) và `backup.service` (sheet Học sinh) `orderBy fullName`.
- Ô tìm ở Học sinh / Học phí / Lịch dùng `useDebouncedSearch` → đẩy chữ tìm lên URL (`?search=`) → tRPC query.
- Giới hạn học sinh đang học: Standard 10, Plus 40, Pro không giới hạn (`STUDENT_LIMITS`). Mỗi giáo viên thực tế vài chục tới vài trăm HS (kể cả đã nghỉ).

**Form nhập dữ liệu cá nhân**
- `BankAccountCard.tsx` → `settings.updateBankAccount` (input `bankAccountSchema.nullable()`; `null` = xoá).
- `StudentFormDialog.tsx` → `student.create` (input `studentCreateSchema`) / `student.update` (`{ id, data: studentCreateSchema.partial() }`; form sửa gửi **toàn bộ** trường). `student.update` còn được gọi với `data: { isActive }` trong test.
- `ImportStudentsDialog.tsx` → `student.importMany({ rows })` (≤ 500 dòng).
- Đăng ký (`/register`) nhận `fullName` của giáo viên.
- Không có chỗ nào ghi nhận "đồng ý", không có trang chính sách.

**Đầu ra chứa dữ liệu cá nhân**
- `/api/backup` (F): file Excel đủ mọi bảng (họ tên HS, SĐT/tên phụ huynh, ghi chú, số tài khoản…), không mật khẩu; bấm menu là tải ngay (`AppHeader` `DropdownMenuItem onSelect={backup.download}`).
- Trang phụ huynh `/p/<token>`: tên HS, lớp, điểm danh, phiếu học phí (tên GV, **số TK + tên chủ TK** trong VietQR). Đã ẩn `studentId`, username, ghi chú thu tiền; header `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`; `force-dynamic`.
- Admin (`admin.overview`): username, họ tên GV, ngày tạo, lần đăng nhập cuối, **số** HS đang học, gói. Không có procedure admin nào đọc học sinh / tài khoản ngân hàng của GV.

**Log**
- `console.*` phía server: `[Prisma] model.op - ms`, `[tRPC] path - ms`, `[tRPC] <path>: <error.message>` (route handler `onError`), `[backup] … error`, `[admin] <admin> duyệt đơn …`, `[auto-upgrade] failed: err`. Không chỗ nào in họ tên/SĐT/số TK. Rủi ro còn lại: `error.message` của lỗi bất ngờ (xem mục 7).

**Bảo mật sẵn có**
- Đăng nhập: rate limit theo username (5 lần sai/15 phút) + theo IP (20/15 phút), bảng `login_attempts`; đăng ký 5 lần/IP/15 phút; đổi mật khẩu dùng chung bộ đếm (N). Phiên JWT (JWE của Auth.js), `sessionVersion`, `mustChangePassword` (N).
- Multi-tenant: mọi service lọc `userId`, `assertOwnership` trả `NOT_FOUND`.
- Header: chỉ `/p/:path*` có header riêng; chưa có HSTS/CSP/X-Frame-Options toàn trang (Vercel tự thêm HSTS cho `*.vercel.app`).
- Env: `.env` = PRODUCTION; `.env.test` (gitignore) = Postgres Docker `localhost:5433`; `.env.test.example` được commit. Preview Vercel **không** có env (memory "merge thẳng lên prod").
- Scripts `scripts/create-user.ts`, `list-users.ts`, `reset-password.ts`, `deactivate-user.ts`, `activate-default-subjects.ts`, `prisma/seed.ts` tự `new PrismaClient()` (không qua `db.ts`). E2E `admin*.spec`, `auth.spec`, `copy-month.spec`, `parent-link.spec`, `plan*.spec`, `renew-offer.spec` cũng `new PrismaClient()`.

## 2. Mục tiêu và tiêu chí hoàn thành

- Người đọc được DB (dump, backup branch mới, SQL console) **không** đọc được: họ tên HS, SĐT/tên phụ huynh, mọi ghi chú tự do, họ tên GV, số TK + tên chủ TK, link phụ huynh. Chỉ app đang chạy (có khoá trong env Vercel) giải mã được.
- Mọi chức năng hiện có chạy như cũ: tìm tên HS (không phân biệt hoa thường), sắp xếp theo lớp rồi tên, phân trang, nhập Excel kiểm trùng, phiếu học phí VietQR, trang phụ huynh, sao lưu Excel.
- Đăng ký tài khoản, lưu tài khoản ngân hàng, tạo/sửa học sinh (khi có trường cá nhân), nhập Excel học sinh: **phải tick** ô đồng ý mới bấm Lưu được; server từ chối nếu thiếu cờ; mỗi lần đồng ý ghi 1 bằng chứng (ai, lúc nào, loại dữ liệu, phiên bản văn bản, IP).
- Có trang công khai `/privacy` (vi/en) để ô đồng ý link tới.
- Dữ liệu cũ được mã hoá bằng script chạy có kiểm soát (dry-run, idempotent, kiểm checksum trước/sau), có đường lùi.
- Không migration destructive; không lọt bản rõ qua log/lỗi.
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch.

## 3. Yêu cầu người dùng (nguyên văn tóm tắt)

| # | Nội dung |
|---|---|
| U1 | Mã hoá dữ liệu cá nhân trong DB (hacker đọc DB không đọc được). Giữ bcrypt mật khẩu. Kiểm kê mọi trường, bảng quyết định mã hoá/không + lý do. AES-256-GCM, IV ngẫu nhiên, định dạng có version + key id, khoá ở env Vercel, quy trình sinh/backup/xoay khoá. Chọn tầng áp dụng, không lọt bản rõ qua log/lỗi/backup. Giải quyết tìm kiếm tên HS. Di chuyển dữ liệu cũ an toàn 2 bước, idempotent, dry-run, backup Neon, rollback. |
| U2 | Ô đồng ý "đã đồng ý chia sẻ dữ liệu cá nhân" bắt buộc tick mới cho Lưu ở form ngân hàng, form HS (tạo + sửa), nhập Excel HS. Lưu bằng chứng. Server từ chối nếu thiếu cờ. Văn bản vi/en ngắn, link trang chính sách. |
| U3 | Rà soát bảo mật khác (backup Excel, trang phụ huynh, log, audit log, header, rate limit, quyền admin, xoá tài khoản, Neon backup branch còn bản rõ). |
| U4 | Lỗi server tiếng Anh: ngoài phạm vi. |
| U5 | Version: giai đoạn đầu của O là `0.7.0`. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| Q1 | Thuật toán | AES-256-GCM (`node:crypto`), IV 12 byte ngẫu nhiên mỗi lần ghi, tag 16 byte, **AAD = tên trường** (vd `"fullName"`, `"bankAccountNumber"`) | GCM vừa mã hoá vừa xác thực (sửa 1 byte là giải mã báo lỗi). AAD theo tên trường chặn kiểu tấn công chép ciphertext của `bankAccountNumber` sang `fullName` (trường hiện trên trang công khai). Không dùng id bản ghi làm AAD vì lúc `create` chưa có id |
| Q2 | Định dạng lưu | `enc:v1:<kid>:<iv>:<ct>:<tag>` (iv/ct/tag base64url, không padding). `kid` = `[a-z0-9]{1,8}` | Tiền tố `enc:v1:` tự mô tả → đọc được cả dữ liệu cũ (bản rõ) lẫn mới trong giai đoạn chuyển; `v1` để đổi thuật toán sau; `kid` để xoay khoá. Chuỗi rỗng `""` và `null` giữ nguyên (không có thông tin) |
| Q3 | Khoá | Env `DATA_ENCRYPTION_KEYS="k1:<base64 32 byte>[,k2:<…>]"` + `DATA_ENCRYPTION_ACTIVE_KID="k1"`. Ghi luôn bằng khoá active; đọc bằng khoá theo `kid` trong chuỗi. Chỉ đặt ở Vercel **Production**, kiểu "Sensitive". Không trong DB/repo/`.env` | Tách khoá khỏi DB: dump DB không kèm khoá. Nhiều khoá song song để xoay mà không ngừng dịch vụ. Preview không có env (memory) nên không cần |
| Q4 | Thiếu/sai khoá | **Fail closed**: ghi trường mã hoá khi thiếu khoá → ném lỗi (không bao giờ ghi bản rõ); đọc chuỗi `enc:` mà không có `kid` đó hoặc tag sai → ném `FieldDecryptError` (thông điệp chỉ có tên trường + kid, không có giá trị). Khoá đọc lười (lần dùng đầu) → `next build` không cần khoá | Ghi bản rõ "tạm" khi thiếu khoá là lỗ hổng im lặng. Lỗi hiện rõ ngay khi deploy thiếu khoá |
| Q5 | Tầng áp dụng | **Prisma client extension** `withFieldEncryption(client)` bọc trong `db.ts`: (a) trước các thao tác ghi (`create`, `createMany`, `createManyAndReturn`, `update`, `updateMany`, `upsert`) đi cây `data` (cả ghi lồng nhau) và mã hoá mọi giá trị chuỗi dưới khoá thuộc tập trường mã hoá; (b) sau **mọi** thao tác, đi cây kết quả (cả `include`/`select` lồng) và giải mã mọi chuỗi có tiền tố `enc:v1:` dưới khoá thuộc tập đó; (c) **chặn** `where`/`orderBy`/`cursor`/`distinct`/`by` tham chiếu trường mã hoá (ném lỗi lập trình) | Một chỗ duy nhất: service/test/seed không phải nhớ gọi encrypt. Quên decrypt ở service (cách B) chỉ lộ ciphertext ra UI, nhưng **quên encrypt là lưu bản rõ im lặng** — tầng extension loại bỏ lỗi đó. Đi cây theo tên khoá phủ được `include: { student: true }` lồng nhiều cấp mà `result` extension của Prisma 5 không chắc phủ. Chặn `where/orderBy` biến lỗi "tìm theo ciphertext luôn ra rỗng" thành lỗi nổ ngay khi test |
| Q6 | Tập trường mã hoá theo tên khoá | Bảng `ENCRYPTED_FIELDS` theo model (mục 5) + tập khoá hợp `ENCRYPTED_KEYS`. Test đọc `Prisma.dmmf`: mọi trường String của **mọi** model có tên thuộc `ENCRYPTED_KEYS` phải nằm trong `ENCRYPTED_FIELDS` của model đó | Đi cây theo tên khoá nên hai model cùng tên trường (vd `note`) phải cùng quyết định. Test buộc người thêm cột mới trùng tên phải quyết định tường minh |
| Q7 | Tìm kiếm tên HS khi tên đã mã hoá | **Giải mã và lọc trong bộ nhớ theo `userId`**: tải mọi HS của GV khớp các điều kiện không phải tên (lớp, đang học), giải mã, lọc `includes` không phân biệt hoa thường (NFC + `toLocaleLowerCase("vi")`), sắp `grade` rồi tên (`Intl.Collator("vi")`), rồi `id`, phân trang bằng `slice`. Lịch: tìm id HS khớp tên trước (`findStudentIdsByName`) rồi lọc ca `studentId in ids` | Blind index (HMAC) chỉ khớp **chính xác** cả chuỗi, ô tìm hiện là "chứa". N-gram blind index lộ tần suất và phức tạp. Không mã hoá tên HS thì bỏ mất trường nhạy cảm nhất (tên trẻ vị thành niên + trang công khai). Mỗi GV ít HS (Standard 10, Plus 40, Pro vài trăm): tải + giải mã vài trăm dòng ~vài ms. Học phí vốn đã phân trang trong bộ nhớ |
| Q8 | Giới hạn của Q7 | Chấp nhận: (1) tìm vẫn phân biệt dấu như ILIKE hiện tại (gõ "nguyen" không ra "Nguyễn" — giữ hành vi cũ); (2) thứ tự tên theo quy tắc tiếng Việt của ICU, có thể khác nhẹ thứ tự collation Postgres cũ; (3) `student.list` đọc toàn bộ HS của GV mỗi lần (O(n)); ổn tới ~5.000 HS/GV. Quá mức đó mới tính cache/blind index (ngoài phạm vi) | Ghi rõ để người dùng biết |
| Q9 | `parentLinkToken` | Thêm cột `parent_link_token_hash` (SHA-256 hex, `@unique`) để **tra cứu**; cột `parent_link_token` giữ lại nhưng **mã hoá** (chỉ để GV xem lại link). Migration tự tính hash cho token sẵn có bằng `sha256()` của Postgres → link cũ sống ngay khi deploy | Token là "chìa khoá" xem dữ liệu HS (kể cả số TK GV). Để bản rõ thì dump DB + web đang chạy = đọc được mọi trang phụ huynh. Token 256-bit ngẫu nhiên nên SHA-256 không cần HMAC/salt |
| Q10 | Đồng ý: truyền cờ (chốt theo H2) | **Một key thống nhất** trong payload của đúng API (người dùng gọi là "extra_data"): `consent: { accepted: true, version: CONSENT_TEXT_VERSION }` (zod `consentPayload`, hằng `CONSENT_ACCEPTED`), bắt buộc ở `auth.register`, `student.create`, `student.importMany`, `settings.updateBankAccount` (khi không `null`); `student.update` có `consent` tuỳ chọn, server bắt buộc khi `data` chạm `fullName`/`parentName`/`parentPhone`/`notes`. Version khác bản hiện hành (tab cũ) → từ chối | Server tự từ chối (U2), không tin UI. Version trong payload = bằng chứng đúng câu chữ người dùng đã thấy |
| Q11 | Đồng ý: bằng chứng | Bảng MỚI `consent_records` (`userId`, `scope` ∈ `register`/`bank_account`/`student`/`student_import`, `textVersion`, `studentId?`, `itemCount`, `ipAddress?`, `createdAt`). Ghi **trước** khi ghi dữ liệu, trong cùng request; phiên bản văn bản lấy hằng server `CONSENT_TEXT_VERSION` | Thời điểm đồng ý là lúc bấm Lưu; ghi trước = bằng chứng tồn tại kể cả khi lưu dữ liệu lỗi (dư 1 bản ghi vô hại). Không FK (như các bảng log khác: `tests/setup.ts` xoá `users` mỗi lượt) |
| Q12 | Đồng ý: tick mỗi lần | Ô mặc định **không** tick mỗi lần mở form (kể cả sửa), nút Lưu/Đăng ký `disabled` tới khi tick. Ô đồng ý **không** chứa link rời form (H2) | U2 + H2 |
| Q13 | Trang chính sách | Trang MỚI công khai `/privacy` (vi/en); thêm `privacy` vào ngoại lệ matcher. Link tới `/privacy` đặt ở màn **Đăng nhập** (bắt buộc) và chữ nhỏ ở chân **Đăng ký** (không bắt buộc bấm); **không** đặt trong ô đồng ý (H2) | Người dùng tự đọc, không bị kéo rời form |
| Q14 | Sao lưu Excel | Giữ file không mật khẩu (exceljs không mã hoá được file; thư viện mã hoá xlsx đều bỏ bảo trì). Thêm hộp xác nhận cảnh báo trước khi tải + dòng "Lưu ý" trong sheet Thông tin + ghi nhật ký tải | Rủi ro chính là file trôi nổi sau khi tải; cảnh báo + nhật ký là cách rẻ, không thêm phụ thuộc. Mật khẩu file: câu hỏi H3 |
| Q15 | Nhật ký truy cập | Bảng MỚI `security_events` (`userId`, `event`, `ipAddress?`, `createdAt`; **không** có giá trị dữ liệu). Sự kiện: `backup_download`, `bank_account_update`, `bank_account_clear`, `parent_link_create`, `parent_link_disable`. Chưa có UI xem (ngoài phạm vi) | Đủ để điều tra "ai đã xuất toàn bộ dữ liệu / đổi số TK nhận tiền lúc nào". Không log mỗi lần đọc (quá nhiều, ít giá trị) |
| Q16 | Header bảo mật | Toàn trang: `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. Giữ luật `/p/:path*` (đặt **sau** luật toàn trang để `no-referrer` thắng) | CSP đầy đủ `script-src` cần nonce cho script inline của Next → dễ vỡ, để sau. Các chỉ thị chọn không chặn script nào |
| Q17 | Dữ liệu cũ | Mã hoá **tại chỗ** (cùng cột), không thêm cột `_enc` rồi drop cột cũ. Bước 1 (O1): nới cột VarChar → TEXT (không destructive, Postgres không viết lại bảng), code mới ghi mã hoá + đọc được cả 2 định dạng. Bước 2 (O2): script `scripts/crypto-backfill.ts` mã hoá dòng cũ. Bước 3 (O3): kiểm 0 bản rõ, cảnh báo khi gặp bản rõ, dọn backup branch | Tiền tố `enc:v1:` cho đọc 2 định dạng mà không cần cột mới → không có bước drop cột. Rollback = script chạy ngược `--decrypt` |
| Q18 | Script chạy prod | Không tự đọc `.env`; phải truyền `DATABASE_URL` + khoá qua env của lệnh và `CONFIRM_HOST=<host>` khớp host trong `DATABASE_URL` mới cho `--apply`/`--decrypt`/`--rotate`; mặc định `--dry-run`. Ghi bằng raw SQL `UPDATE … WHERE id = $2 AND <cột> = $3` (không bump `updated_at`, bỏ qua dòng vừa bị sửa đồng thời) | Chống chạy nhầm DB; idempotent; không đổi "Cập nhật lần cuối" trong file sao lưu |
| Q19 | Kiểm trước/sau | Script in số dòng theo trường: `null/rỗng`, `bản rõ`, `mã hoá theo kid`, `lỗi giải mã` và **checksum SHA-256** của danh sách `(id, giá trị rõ)` sắp theo id. `--verify` giải mã toàn bộ, checksum phải bằng checksum in ở dry-run trước `--apply` | Chứng minh giải mã lại ra đúng dữ liệu cũ, không in dữ liệu |
| Q20 | Version | O1 nâng `0.7.0` (mọi người đăng nhập lại 1 lần theo luật epoch của N). O3 nâng `0.7.1` | U5; O3 không cần ép đăng nhập lại |
| Q21 | Tìm theo tên học sinh trên URL / log | Giữ như cũ (ngoài phạm vi) | Chữ tìm (một phần tên) nằm trong URL query → log request Vercel (giữ ngắn hạn). Sửa triệt để phải bỏ đồng bộ ô tìm lên URL + tRPC POST; ghi ở mục 7 |

## 5. Kiểm kê trường và quyết định mã hoá

| Model.trường (cột) | Kiểu hiện tại | Nội dung | Mã hoá? | Lý do |
|---|---|---|---|---|
| `User.passwordHash` | VarChar(255) | bcrypt | Không (giữ bcrypt) | Băm một chiều, đã đúng chuẩn |
| `User.username` | VarChar(50) `@unique` | tên đăng nhập | **Không** | Tra cứu khi đăng nhập (`findUnique`), unique, admin cần nhận diện; rate limit theo username. Có thể là tên thật/SĐT → khuyến nghị ở `/register` (câu hỏi H5) |
| `User.fullName` | VarChar(100) → TEXT | họ tên GV | **Có** | Định danh trực tiếp; hiện trên phiếu học phí/trang phụ huynh, admin xem được (qua app, đã giải mã) |
| `User.bankBin` | VarChar(8) | mã ngân hàng | Không | Chỉ là mã ngân hàng công khai (vd 970436), không định danh |
| `User.bankAccountNumber` | VarChar(19) → TEXT | số TK | **Có** | Dữ liệu tài chính |
| `User.bankAccountName` | VarChar(50) → TEXT | tên chủ TK | **Có** | Họ tên thật |
| `User.plan/planExpiresAt/trialEndsAt/sessionVersion/…` | | cấu hình | Không | Không phải dữ liệu cá nhân nhạy cảm; admin lọc/sắp theo |
| `User.lastLoginAt/createdAt` | | thời điểm | Không | Admin sắp xếp; ít nhạy cảm |
| `Student.fullName` | VarChar(100) → TEXT | họ tên HS (trẻ vị thành niên) | **Có** | Nhạy cảm nhất; tìm kiếm giải quyết bằng Q7 |
| `Student.parentName` | VarChar(100) → TEXT | tên phụ huynh | **Có** | Định danh |
| `Student.parentPhone` | VarChar(15) → TEXT | SĐT phụ huynh | **Có** | Định danh + liên lạc |
| `Student.notes` | TEXT | ghi chú tự do | **Có** | GV có thể ghi sức khoẻ, hoàn cảnh gia đình |
| `Student.parentLinkToken` | VarChar(43) → TEXT `@unique` | link phụ huynh | **Có** + cột hash mới | Q9 |
| `Student.grade/tuitionFee/isActive` | | số/cờ | Không | Lọc/sắp trong DB; không định danh khi tách khỏi tên |
| `SessionStudent.note` | TEXT | ghi chú điểm danh | **Có** | Có thể ghi lý do vắng (ốm…) |
| `TeachingSession.notes` | TEXT | ghi chú ca | **Có** | Ghi chú tự do |
| `TeachingSession.cancelReason` | TEXT | lý do huỷ | **Có** | Có thể chứa lý do cá nhân (HS ốm) |
| `TeachingSession.title` | VarChar(200) | nhãn ca | **Không** | Nhãn lớp ("Toán 9A"); raw SQL `checkOverlap` đọc để báo trùng giờ. Rủi ro GV gõ tên HS vào tiêu đề: ghi ở mục 7 |
| `MonthlyTuition.notes` | TEXT | ghi chú học phí | **Có** | Ghi chú tự do (miễn giảm, hoàn cảnh) |
| `Payment.note` | TEXT | ghi chú lần thu | **Có** | Ghi chú tự do (người nộp, nội dung CK) |
| `PlanOrder.note` | TEXT | ghi chú admin khi từ chối/đặt gói | **Có** | Trùng tên khoá `note` (Q6); ít nhạy cảm nhưng mã hoá không tốn gì, không có truy vấn lọc |
| `Subject.name/color` | | tên môn | Không | Không phải dữ liệu cá nhân |
| `LoginAttempt.username/ipAddress` | | nhật ký đăng nhập | Không | Rate limit truy vấn theo 2 cột này; đề xuất xoá bản ghi > 90 ngày (mục 7, ngoài phạm vi) |
| `PlanOrder.code/amount/decidedBy` | | đơn gói | Không | Mã CK ngẫu nhiên, admin tra cứu |
| `PasswordResetLog/PlanPriceChange/TrialDayChange` | | nhật ký admin | Không | Không có dữ liệu cá nhân ngoài username admin |
| `consent_records`, `security_events` (MỚI) | | bằng chứng/nhật ký | Không | Chỉ id, loại, thời điểm, IP; không chứa giá trị dữ liệu |

`ENCRYPTED_FIELDS` (theo tên Prisma):

```ts
User: ["fullName", "bankAccountNumber", "bankAccountName"]
Student: ["fullName", "parentName", "parentPhone", "notes", "parentLinkToken"]
SessionStudent: ["note"]
TeachingSession: ["notes", "cancelReason"]
MonthlyTuition: ["notes"]
Payment: ["note"]
PlanOrder: ["note"]
```

`ENCRYPTED_KEYS` = `fullName, bankAccountNumber, bankAccountName, parentName, parentPhone, notes, parentLinkToken, note, cancelReason`. Ciphertext dài hơn bản rõ (~ 4/3 × độ dài + 50 ký tự) → mọi cột VarChar trong danh sách nới thành TEXT; zod vẫn giới hạn độ dài **bản rõ** như cũ. Độ dài ciphertext vẫn lộ độ dài bản rõ (chấp nhận).

## 6. Thiết kế chi tiết

### 6.1 Thư viện mã hoá `src/server/crypto/field-crypto.ts` (MỚI, chỉ Node)

```ts
export const ENC_PREFIX = "enc:v1:"
export class FieldCryptoConfigError extends Error {}   // thiếu/sai định dạng khoá
export class FieldDecryptError extends Error {}        // kid lạ, tag sai, chuỗi hỏng — message chỉ có field + kid
export function isEncrypted(value: unknown): value is string            // startsWith(ENC_PREFIX)
export function encryptField(plain: string, field: string): string      // "" → "" ; mọi chuỗi khác đều mã hoá (kể cả chuỗi người dùng gõ bắt đầu bằng "enc:v1:")
export function decryptField(stored: string, field: string): string     // không có tiền tố → trả nguyên (bản rõ cũ)
export function readKid(stored: string): string | null                  // kid trong chuỗi mã hoá
export function loadKeyring(): { active: string; keys: Map<string, Buffer> } // đọc env, cache theo chuỗi env
```

- Env: `DATA_ENCRYPTION_KEYS` = danh sách `kid:base64` cách nhau dấu phẩy; mỗi khoá base64 **phải** giải ra đúng 32 byte; `kid` khớp `/^[a-z0-9]{1,8}$/`, không trùng. `DATA_ENCRYPTION_ACTIVE_KID` phải có trong danh sách. Sai → `FieldCryptoConfigError` (message nêu biến nào sai, **không** in khoá).
- Cache keyring theo chuỗi `KEYS + "|" + ACTIVE` (test đổi env được, production parse 1 lần).
- `encryptField`: `iv = randomBytes(12)`; `createCipheriv("aes-256-gcm", key, iv)`; `setAAD(Buffer.from(field, "utf8"))`; `ct = update(plain, "utf8") + final()`; `tag = getAuthTag()` → `enc:v1:${kid}:${b64url(iv)}:${b64url(ct)}:${b64url(tag)}`.
- `decryptField`: tách đúng 6 phần (`enc`,`v1`,kid,iv,ct,tag; ct có thể rỗng); iv 12 byte, tag 16 byte; `setAuthTag`, `setAAD(field)`; lỗi bất kỳ → `FieldDecryptError("Không giải mã được trường <field> (kid=<kid>)")`.
- File không import Prisma/Next → dùng được trong script, test unit, e2e.

### 6.2 Quản lý khoá (quy trình cho người dùng)

**Sinh khoá** (trên máy người dùng, không qua chat/AI):
```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```
Giá trị env: `DATA_ENCRYPTION_KEYS=k1:<chuỗi vừa sinh>`, `DATA_ENCRYPTION_ACTIVE_KID=k1`.

**Lưu dự phòng — BẮT BUỘC trước khi dán vào Vercel** (biến "Sensitive" của Vercel không cho xem lại giá trị):
1. Trình quản lý mật khẩu (Bitwarden/1Password/Google Password Manager…): mục "Lịch dạy – DATA_ENCRYPTION_KEYS k1 (prod)", ghi kèm ngày tạo.
2. Bản offline thứ hai ở nơi khác: giấy in cất két, hoặc USB mã hoá. Không chụp màn hình, không gửi Zalo/email/chat, không lưu trong repo/`.env`/Drive không mã hoá.
3. Kiểm bản dự phòng: ở O2, người điều phối chạy `--dry-run`/`--verify` bằng khoá **dán từ bản dự phòng** (không phải clipboard lúc tạo) — giải mã được bản ghi do web tạo = bản dự phòng đúng.
4. **Mất khoá = mất vĩnh viễn** mọi trường đã mã hoá (kể cả trong mọi backup Neon sau O2). Không có cửa sau.

**Đặt khoá**: Vercel → Project → Settings → Environment Variables → thêm 2 biến, môi trường **Production**, bật Sensitive. Đặt **trước** khi merge O1 (thiếu khoá → mọi lần ghi trường cá nhân lỗi ngay).

**Test/dev**: `.env.test` (gitignore) có khoá test riêng `t1:<ngẫu nhiên>` do agent sinh; `.env.test.example` chỉ ghi tên biến + lệnh sinh. `playwright.config.ts` truyền tường minh 2 biến từ `.env.test` cho `pnpm dev` (không để Next đọc nhầm từ `.env`). Không bao giờ đặt khoá prod trong `.env`.

**Xoay khoá** (khi nghi lộ khoá, hoặc định kỳ 1–2 năm):
1. Sinh `k2`, lưu dự phòng như trên.
2. Vercel: `DATA_ENCRYPTION_KEYS=k1:<cũ>,k2:<mới>`, `DATA_ENCRYPTION_ACTIVE_KID=k2` → redeploy (bản ghi mới dùng k2, bản cũ vẫn đọc bằng k1).
3. Backup Neon → `scripts/crypto-backfill.ts --rotate` (giải mã k1, mã hoá k2) → `--verify` thấy 0 dòng `kid=k1`.
4. Bỏ `k1` khỏi env, redeploy. Giữ bản dự phòng k1 tới khi mọi backup Neon chứa k1 hết hạn/đã xoá.
Nếu khoá bị lộ: xoay ngay; backup cũ mã hoá bằng khoá lộ coi như lộ.

### 6.3 Prisma extension `src/server/crypto/prisma-encryption.ts` (MỚI)

```ts
export const ENCRYPTED_FIELDS: Readonly<Record<string, readonly string[]>> // mục 5
export const ENCRYPTED_KEYS: ReadonlySet<string>
export class EncryptedFieldQueryError extends Error {}
export function encryptWriteArgs<T>(args: T): T      // clone sâu, không sửa object của người gọi
export function decryptResult<T>(value: T): T
export function assertNoEncryptedFilter(args: unknown): void
export function withFieldEncryption<C extends PrismaClient>(client: C): C
```

- `withFieldEncryption(client)` = `client.$extends({ name: "field-encryption", query: { $allOperations({ operation, args, query }) { … } } })`:
  1. `assertNoEncryptedFilter(args)`: đi `where`, `orderBy`, `cursor`, `distinct`, `by`, `having` ở gốc **và** lồng trong `include`/`select` (vd `include: { sessionStudents: { orderBy: { student: { fullName } } } }`); gặp khoá thuộc `ENCRYPTED_KEYS` (hoặc chuỗi thuộc tập đó trong mảng `distinct`/`by`) → ném `EncryptedFieldQueryError("Không lọc/sắp xếp DB theo trường mã hoá: <key>")`.
  2. Thao tác ghi (`create`, `createMany`, `createManyAndReturn`, `update`, `updateMany`, `upsert`): `args = encryptWriteArgs(args)` — đi `data` (object hoặc mảng), `create`/`update` của upsert, và object lồng (ghi lồng `sessionStudents: { create: [...] }`); với khoá thuộc `ENCRYPTED_KEYS`: chuỗi → `encryptField(v, key)`; `{ set: string }` → mã hoá `set`; `null`/`undefined` giữ nguyên. Không đụng `where` bên trong `data` (đã bị bước 1 chặn nếu chạm trường mã hoá). Bỏ qua `Date`, `Buffer`, `Prisma.Decimal`.
  3. `result = await query(args)` → `return decryptResult(result)`: đi đệ quy object thường + mảng; chuỗi dưới khoá thuộc `ENCRYPTED_KEYS` và `isEncrypted` → `decryptField(v, key)`; còn lại giữ nguyên.
- `db.ts`: `withFieldEncryption(new PrismaClient({ log }).$extends(timing))` — timing trong, mã hoá ngoài. Interactive transaction (`db.$transaction(async tx => …)`) thừa hưởng extension.
- Raw SQL (`$queryRaw`/`$executeRaw`) **không** qua extension. Hiện không raw SQL nào đọc/ghi cột mã hoá; Review Focus giữ luật: raw SQL mới chạm cột mã hoá phải tự gọi `encryptField`/`decryptField`.
- Scripts (`scripts/create-user.ts`, `list-users.ts`, `prisma/seed.ts`) đổi `new PrismaClient()` → `withFieldEncryption(new PrismaClient())`. E2E: chỉ `parent-link.spec.ts` cần sửa (hash token, 6.5); các e2e khác ghi bản rõ bằng client thường vẫn đọc được (định dạng cũ) — giữ nguyên.
- `tests/setup.ts` dùng `db` → seed tự mã hoá.

### 6.4 Tìm kiếm và sắp xếp trong bộ nhớ

File MỚI `src/lib/name-search.ts` (thuần, client-safe):
```ts
export function normalizeForSearch(s: string): string   // s.normalize("NFC").toLocaleLowerCase("vi")
export function nameMatches(fullName: string, term: string | undefined): boolean // term rỗng/undefined → true
export function compareViName(a: string, b: string): number // Intl.Collator("vi").compare
export function byGradeThenName<T extends { grade: number; fullName: string; id: number }>(a: T, b: T): number
```

Sửa (mọi chỗ đang `where`/`orderBy` theo `fullName`):

| Chỗ | Cách mới |
|---|---|
| `listStudents` | `findMany({ where: { userId, isActive?, grade? } })` (bỏ `fullName`, bỏ `orderBy/skip/take`) → `filter(nameMatches)` → `sort(byGradeThenName)` → `totalCount = length`, `items = slice((page-1)*limit, page*limit)` |
| `getMonthlyTuitionStatus` | bỏ `fullName contains` + `orderBy fullName` khỏi query; sau khi tải: `filter(nameMatches(s.fullName, search))`, `sort(byGradeThenName)` rồi chạy logic cũ |
| `getMonthSessions` | có `studentName` → `ids = await findStudentIdsByName(db, userId, studentName)`; rỗng → trả `[]`; điều kiện `student: { id: … }` (có `studentId` thì `studentId` phải ∈ `ids`, không thì trả `[]`). Bỏ `orderBy student.fullName` trong `include`; `toDTO` sắp `students` theo `compareViName` rồi `studentId` |
| `getSessionDetail`, `getCancelledWithoutMakeup` | bỏ `orderBy student.fullName` (toDTO đã sắp) |
| `report.service` (HS lâu không học) | bỏ `orderBy fullName`, sắp `byGradeThenName` sau khi tải |
| `backup.service` sheet Học sinh | bỏ `orderBy fullName`, sắp `byGradeThenName` (tie `id`) |

`findStudentIdsByName(db, userId, term)` (MỚI, `student.service.ts`): tải `select { id, fullName }` mọi HS của `userId` (kể cả đã nghỉ, như ILIKE cũ), trả id khớp.

Làm **trước** khi bật extension (task riêng) để hành vi tìm/sắp được test xanh với bản rõ, rồi bật mã hoá không đổi hành vi.

### 6.5 Link phụ huynh

- Migration: `ALTER TABLE "students" ADD COLUMN "parent_link_token_hash" VARCHAR(64)`; `UPDATE "students" SET "parent_link_token_hash" = encode(sha256(convert_to("parent_link_token", 'UTF8')), 'hex') WHERE "parent_link_token" IS NOT NULL`; `CREATE UNIQUE INDEX "students_parent_link_token_hash_key"`.
- `src/server/crypto/parent-token.ts` (MỚI): `hashParentToken(token: string): string` = `createHash("sha256").update(token, "utf8").digest("hex")`.
- `generateParentLink`: ghi `{ parentLinkToken: token, parentLinkTokenHash: hashParentToken(token) }` (token được extension mã hoá). Trùng unique (P2002) → thử lại 1 lần như cũ.
- `disableParentLink`: ghi cả 2 cột `null`.
- `getParentView`: `findUnique({ where: { parentLinkTokenHash: hashParentToken(token) } })` (sau khi kiểm regex như cũ).
- Không trả `parentLinkTokenHash` ra client: `StudentDTO` = `Omit<Student, "createdAt" | "updatedAt" | "parentLinkTokenHash">` (đối chiếu định nghĩa thật); `toStudentDTO()` bỏ trường này ở `listStudents`/`createStudent`/`updateStudent`.
- Giữ `@unique` trên `parent_link_token` (ciphertext ngẫu nhiên nên không đụng nhau) — không drop index.

### 6.6 Đồng ý chia sẻ dữ liệu

`src/lib/consent.ts` (MỚI, client-safe):
```ts
export const CONSENT_TEXT_VERSION = "2026-10-v1"
export const CONSENT_SCOPES = ["register", "bank_account", "student", "student_import"] as const
export type ConsentScope = (typeof CONSENT_SCOPES)[number]
export const STUDENT_PERSONAL_FIELDS = ["fullName", "parentName", "parentPhone", "notes"] as const
// Key thống nhất trong payload (H2): { accepted: true, version } với version phải bằng CONSENT_TEXT_VERSION.
export const consentPayload = z.object({ accepted: z.literal(true), version: z.string() }).refine((c) => c.version === CONSENT_TEXT_VERSION) // lỗi: "CONSENT_REQUIRED"
export const CONSENT_ACCEPTED = { accepted: true, version: CONSENT_TEXT_VERSION } as const
```

Schema:
- `settings`: `updateBankAccountSchema = bankAccountSchema.extend({ consent: consentPayload }).nullable()`; `BankAccountInput` giữ nguyên (3 trường).
- `student`: `studentCreateInputSchema = studentCreateSchema.extend({ consent: consentPayload })` (cho `student.create`); `studentUpdateSchema` thêm `consent: consentPayload.optional()`; `studentImportSchema` thêm `consent: consentPayload`. `studentCreateSchema` (resolver của form) **không** đổi.

Server (`src/server/services/consent.service.ts`, MỚI):
```ts
export async function recordConsent(db: PrismaClient, p: { userId: number; scope: ConsentScope; studentId?: number | null; itemCount?: number; ipAddress: string | null }): Promise<void>
export function updateTouchesPersonalData(data: Partial<StudentCreateInput>): boolean
export function assertUpdateConsent(data: Partial<StudentCreateInput>, consent: ConsentPayload | undefined): void // thiếu → TRPCError BAD_REQUEST "CONSENT_REQUIRED"
```
Router:
- `settings.updateBankAccount`: input khác `null` → `recordConsent(scope bank_account)` → `updateBankAccount(…, 3 trường)` → `logSecurityEvent(bank_account_update)`; `null` → không cần đồng ý, log `bank_account_clear`.
- `student.create`: `recordConsent(scope student)` → `createStudent(…, input bỏ consent)`.
- `student.update`: `assertUpdateConsent(input.data, input.consent)`; có trường cá nhân → `recordConsent(scope student, studentId = input.id)` → `updateStudent`. (Ghi đồng ý trước `assertOwnership` của service: id lạ vẫn chỉ ghi 1 dòng đồng ý của chính user đó, vô hại.)
- `student.importMany`: `recordConsent(scope student_import, itemCount = rows.length)` → `importStudents`.

UI (Checkbox Radix sẵn có, dòng `min-h-11`, nút Lưu `disabled={!consent || isPending}`, reset `false` mỗi lần mở form/dialog):
- `BankAccountCard`: ô dưới 3 trường, trên hàng nút. Nút "Xoá thông tin ngân hàng" không cần tick.
- `StudentFormDialog`: ô cuối form (sau Ghi chú), cả tạo và sửa; gửi `{ ...data, consent: CONSENT_ACCEPTED }` / `{ id, data, consent: CONSENT_ACCEPTED }`.
- `ImportStudentsDialog`: ô ngay trên footer bước xem trước; gửi `{ rows, consent: CONSENT_ACCEPTED }`.
- Ô đồng ý **không** có link sang `/privacy` (H2). Client gửi `consent: CONSENT_ACCEPTED` trong payload của đúng API.
- **Đăng ký** (H2, H5): ô `consent_register` bắt buộc tick mới bấm Đăng ký được; `auth.register` nhận `consent`, ghi `consent_records` scope `register` ngay sau khi tạo user (cần `userId`); dưới ô tên đăng nhập có gợi ý nhẹ `register_username_hint` "Không nên dùng số điện thoại làm tên đăng nhập." (không chặn).
- Lỗi server `CONSENT_REQUIRED` (client cũ / gọi thẳng) → hiện `consent_required`.

Văn bản (i18n):

| Key | vi | en |
|---|---|---|
| `consent_bank` | Tôi đồng ý chia sẻ thông tin tài khoản ngân hàng này để ứng dụng lưu trữ (đã mã hoá) và in lên phiếu báo học phí gửi phụ huynh. | I agree to share this bank account so the app can store it (encrypted) and show it on tuition notices sent to parents. |
| `consent_student` | Tôi đồng ý chia sẻ dữ liệu cá nhân của học sinh và phụ huynh để ứng dụng lưu trữ (đã mã hoá), và xác nhận đã được phụ huynh cho phép. | I agree to share this student's and parent's personal data so the app can store it (encrypted), and I confirm the parent has given permission. |
| `consent_import` | Tôi đồng ý chia sẻ dữ liệu cá nhân của các học sinh trong danh sách để ứng dụng lưu trữ (đã mã hoá), và xác nhận đã được phụ huynh cho phép. | I agree to share the personal data of the students in this list so the app can store it (encrypted), and I confirm their parents have given permission. |
| `consent_register` | Tôi đồng ý để ứng dụng lưu trữ và xử lý dữ liệu cá nhân của tôi (họ tên, tên đăng nhập) và dữ liệu tôi nhập để quản lý lịch dạy. | I agree that the app stores and processes my personal data (name, username) and the data I enter to manage my teaching. |
| `register_username_hint` | Không nên dùng số điện thoại làm tên đăng nhập. | Avoid using your phone number as your username. |
| `consent_required` | Vui lòng tick ô đồng ý chia sẻ dữ liệu trước khi lưu. | Please tick the consent box before saving. |

(Chuỗi mới không dùng gạch dài theo luật i18n của repo.)

### 6.7 Trang `/privacy` (MỚI, công khai)

- `src/app/privacy/page.tsx` (Server Component, `metadata.title`), nội dung ở `src/components/privacy/PrivacyContent.tsx` (client, `useTranslation` theo ngôn ngữ đã chọn; trang bọc `LanguageProvider` như `/p`). Không đọc `params`/`searchParams` (luật `next15-contract`).
- Middleware matcher thêm `privacy` vào danh sách loại trừ; `tests/unit/middleware-matcher.test.ts` thêm ca.
- Nội dung khung (vi; en dịch tương đương), mỗi mục 1–3 câu, key i18n `privacy_*`:
  1. **Dữ liệu thu thập**: tài khoản giáo viên (tên đăng nhập, họ tên, mật khẩu đã băm), tài khoản ngân hàng nhận học phí, thông tin học sinh/phụ huynh do giáo viên nhập (họ tên, lớp, SĐT, ghi chú), lịch dạy, điểm danh, học phí.
  2. **Mục đích**: quản lý lịch dạy, điểm danh, học phí; tạo phiếu báo học phí và trang thông tin cho phụ huynh. Không bán, không quảng cáo, không chia sẻ cho bên thứ ba ngoài nhà cung cấp hạ tầng (Vercel, Neon — máy chủ Singapore).
  3. **Bảo vệ**: mã hoá AES-256 các trường cá nhân trong cơ sở dữ liệu, mật khẩu băm bcrypt, kết nối HTTPS, mỗi giáo viên chỉ xem dữ liệu của mình; quản trị viên chỉ xem thông tin gói.
  4. **Trách nhiệm giáo viên**: chỉ nhập dữ liệu học sinh khi đã được phụ huynh cho phép; không chia sẻ công khai link phụ huynh; giữ kín file sao lưu.
  5. **Lưu trữ và xoá**: dữ liệu giữ trong thời gian tài khoản hoạt động; muốn xoá tài khoản/dữ liệu thì liên hệ quản trị viên (mục 12 H1).
  6. **Phiên bản**: `CONSENT_TEXT_VERSION`.
- Link "Chính sách bảo mật" ở màn `/login` (bắt buộc) và chữ nhỏ ở chân `/register`.
- Kênh liên hệ (H1 chưa trả lời): hằng `PRIVACY_CONTACT` trong `src/lib/privacy.ts` đọc `NEXT_PUBLIC_PRIVACY_CONTACT`, mặc định "email/Zalo của chủ ứng dụng"; câu mục 5 dùng `{contact}`. **Người dùng điền env ở Vercel trước khi merge O1.**
- Không phải văn bản pháp lý đã thẩm định; người dùng tự đối chiếu Luật Bảo vệ dữ liệu cá nhân (hiệu lực 01/01/2026) và Nghị định 13/2023/NĐ-CP nếu cần.

### 6.8 Sao lưu Excel

- Menu "Sao lưu dữ liệu" (mọi chỗ gọi `useBackupDownload`) mở `AlertDialog` MỚI `BackupConfirmDialog`: tiêu đề `backup_confirm_title`, nội dung `backup_confirm_desc`, nút `backup_confirm_download` → gọi `download()` như cũ.
- `backup.service`: thêm dòng `info.addRow(["Lưu ý", NOTE_SENSITIVE])`, `NOTE_SENSITIVE = "File chứa dữ liệu cá nhân chưa mã hoá. Không gửi qua mạng xã hội hay email, xoá khi không còn cần."`.
- `/api/backup`: tạo workbook thành công → `logSecurityEvent(db, { userId, event: "backup_download", ipAddress })` (IP đọc từ header `x-forwarded-for`/`x-real-ip` của `request`).

| Key | vi | en |
|---|---|---|
| `backup_confirm_title` | Tải file sao lưu | Download backup file |
| `backup_confirm_desc` | File chứa toàn bộ dữ liệu cá nhân của học sinh, phụ huynh và tài khoản ngân hàng ở dạng chưa mã hoá. Chỉ lưu ở nơi an toàn, không gửi qua Zalo, Facebook hay email, xoá khi không còn cần. | The file contains all personal data of students, parents and your bank account, unencrypted. Keep it somewhere safe, do not send it via chat apps or email, and delete it when no longer needed. |
| `backup_confirm_download` | Tôi hiểu, tải xuống | I understand, download |

### 6.9 Nhật ký bảo mật `security_events`

`src/server/services/security-event.service.ts` (MỚI):
```ts
export const SECURITY_EVENTS = ["backup_download", "bank_account_update", "bank_account_clear", "parent_link_create", "parent_link_disable"] as const
export type SecurityEvent = (typeof SECURITY_EVENTS)[number]
export async function logSecurityEvent(db: PrismaClient, p: { userId: number; event: SecurityEvent; ipAddress: string | null }): Promise<void>
```
Gọi ở: `/api/backup`, router `settings.updateBankAccount`, router `student.generateParentLink` / `disableParentLink` (sau khi service thành công). Ghi lỗi thì thao tác trả lỗi (`await` thẳng; DB lỗi thì thao tác chính cũng không đáng tin).

### 6.10 Header bảo mật

`next.config.mjs` `headers()` thêm luật `source: "/:path*"` với 6 header ở Q16, đặt **trước** luật `/p/:path*` (cùng khoá header thì luật sau ghi đè → `/p` giữ `Referrer-Policy: no-referrer`). Unit test MỚI `tests/unit/security-headers.test.ts` import `next.config.mjs`, gọi `headers()` và kiểm.

### 6.11 Script mã hoá dữ liệu cũ `scripts/crypto-backfill.ts` (MỚI)

Lõi ở `src/server/crypto/backfill.ts` (để integration test gọi được):
```ts
export type FieldTarget = { model: string; table: string; column: string; field: string }
export const FIELD_TARGETS: readonly FieldTarget[] // 14 cặp bảng/cột thật tương ứng ENCRYPTED_FIELDS
export type FieldReport = { table: string; column: string; total: number; empty: number; plain: number; encrypted: Record<string, number>; undecryptable: number; changed: number; checksum: string }
export type BackfillMode = "dry-run" | "apply" | "verify" | "decrypt" | "rotate"
export async function runBackfill(raw: PrismaClient /* client THƯỜNG, không extension */, mode: BackfillMode, opts?: { batchSize?: number; log?: (line: string) => void }): Promise<FieldReport[]>
```
- Đọc theo lô `SELECT id, "<column>" AS v FROM "<table>" WHERE id > $1 ORDER BY id LIMIT $2` — **không** lọc `is_deleted`/`deleted_at` của Q (thùng rác cũng mã hoá, 6.13) (`$queryRawUnsafe`, tên bảng/cột lấy từ hằng `FIELD_TARGETS`, không từ input).
- Checksum = SHA-256 của chuỗi nối theo id tăng: `id + "\u0000" + giá trị rõ + "\n"` (giá trị mã hoá thì giải mã trước; `null` → `id + "\u0001\n"`). Cùng dữ liệu rõ ⇒ cùng checksum ở mọi mode (tính trên giá trị **sau** khi xử lý).
- `dry-run`: đếm + checksum, không ghi.
- `apply`: bản rõ khác rỗng → `UPDATE "<table>" SET "<column>" = $1 WHERE id = $2 AND "<column>" = $3`. Đã mã hoá → bỏ qua (idempotent).
- `verify`: như dry-run; CLI thoát mã 2 nếu `plain > 0` hoặc `undecryptable > 0`.
- `decrypt` (rollback): dòng mã hoá → ghi bản rõ.
- `rotate`: dòng mã hoá có `kid ≠ active` → giải mã + mã hoá lại bằng khoá active.
- Chuỗi **có** tiền tố `enc:v1:` mà giải mã lỗi (sai khoá / bản rõ trùng hợp bắt đầu bằng tiền tố) → `undecryptable`, không ghi, log `table.column id=<id>` (không in giá trị).
- `updated_at` không đổi (raw SQL không qua `@updatedAt`).

CLI `scripts/crypto-backfill.ts`:
- `pnpm exec tsx scripts/crypto-backfill.ts [--dry-run|--apply|--verify|--decrypt|--rotate] [--batch 200]`; mặc định `--dry-run`.
- Bắt buộc env có sẵn trong lệnh: `DATABASE_URL`, `DATA_ENCRYPTION_KEYS`, `DATA_ENCRYPTION_ACTIVE_KID` (kiểm **trước** khi tạo PrismaClient; thiếu → thoát, không để Prisma tự nạp `.env`).
- In host DB (phần giữa `@` và `/`), kid active, danh sách kid có khoá; không in khoá/giá trị.
- `--apply|--decrypt|--rotate` cần `CONFIRM_HOST` bằng đúng host đó, không thì thoát mã 1.
- In bảng report + tổng; mã thoát 0 (ổn) / 1 (cấu hình/xác nhận sai) / 2 (verify thấy bản rõ hoặc lỗi giải mã).

### 6.12 O3 — dọn dẹp (sau khi O2 xong)

- `decryptResult`: gặp chuỗi **không** mã hoá, khác rỗng, dưới khoá mã hoá → `console.warn("[crypto] còn bản rõ ở trường <key>")` tối đa 1 lần/khoá/tiến trình (không in giá trị).
- Không bỏ khả năng đọc bản rõ (an toàn hơn nổ lỗi; e2e cũ vẫn tạo dữ liệu bản rõ bằng client thường).
- `docs/05-deploy.md` thêm mục "Khoá mã hoá dữ liệu" (biến env, sinh, dự phòng, xoay, lệnh script) — không chứa khoá.
- Người dùng: xoá các Neon backup branch tạo **trước** O2 (chứa bản rõ) sau thời gian giữ (đề xuất 14 ngày sau O2), tạo 1 branch backup mới sau O2; kiểm cửa sổ "history retention" (PITR) của Neon — bản rõ còn trong lịch sử tới hết cửa sổ đó; Neon branch test cũ chép từ prod (vd `ep-jolly-dew`) nếu còn → xoá.


### 6.13 Quan hệ với Q (xoá mềm + thùng rác) — đối chiếu code sau khi Q merge

Q (merge trước K và O) thêm `is_deleted`/`deleted_at` cho `users` và các bảng dữ liệu, thùng rác cho giáo viên. Spec O viết khi Q chưa có code (đã đọc spec Q: cột `isDeleted` + `deletedAt` ở `students`, `subjects`, `teaching_sessions`, `payments`; `users` thêm `isDeleted`/`deletedAt`/`deletedBy`; extension trong `db.ts` tự thêm `isDeleted: false` vào `where` của thao tác đọc cấp cao 4 model đó, `User` kiểm tay; `trash.list` sắp `deletedAt desc` không sắp theo tên; **không** có xoá vĩnh viễn (Q13); version Q `0.5.0`, K `0.6.0`, O `0.7.0`). Các luật sau là **bất biến** phải giữ, cách làm cụ thể theo code thật của Q:

1. **Dữ liệu trong thùng rác vẫn là dữ liệu cá nhân → mã hoá như dữ liệu thường.** Ghi qua `db` (kể cả thao tác xoá mềm/khôi phục của Q) đi qua extension nên tự mã hoá. Script backfill đọc bằng raw SQL **mọi dòng** (không lọc `is_deleted`/`deleted_at`) → dòng đã xoá mềm cũng được mã hoá/giải mã/checksum. Test backfill có ca dòng đã xoá mềm (Task 9).
2. **Thứ tự extension trong `db.ts`**: nếu Q thêm extension (vd tự thêm điều kiện `deletedAt: null`, đổi `delete` thành `update`), giữ nguyên extension của Q và bọc `withFieldEncryption` **ngoài cùng** (áp cuối). Chặn lọc của O chỉ xét khoá thuộc tập trường mã hoá nên không đụng điều kiện `is_deleted`/`deleted_at`.
3. **Tìm theo tên ở thùng rác**: nếu Q có ô tìm/sắp theo tên trong thùng rác (DB `contains`/`orderBy fullName`) → chuyển sang lọc/sắp trong bộ nhớ như 6.4 (Task 3 grep toàn `src/server`). `listStudents`/`findStudentIdsByName` giữ đúng điều kiện loại dòng đã xoá mềm mà Q đặt ra (đối chiếu code: nếu Q lọc ở service thì giữ điều kiện đó trong `where`).
4. **Khôi phục từ thùng rác không cần tick đồng ý** (không nhập dữ liệu mới; đồng ý đã ghi lúc tạo/sửa). Nếu Q cho sửa dữ liệu trong thùng rác thì áp luật Q10 như sửa thường.
5. **Trường mới của Q**: nếu Q thêm cột chữ tự do chứa dữ liệu cá nhân (vd lý do xoá, ghi chú) → thêm vào `ENCRYPTED_FIELDS` + nới TEXT trong migration O (Ruling). Cột trùng tên khoá mã hoá thì test DMMF (Task 4) bắt buộc quyết định.
6. **Quyền được xoá dữ liệu (F5)**: sau Q, "xoá" của giáo viên là xoá mềm (dữ liệu còn trong DB, đã mã hoá sau O2). Xoá vĩnh viễn theo yêu cầu (dọn thùng rác sau N ngày, xoá tài khoản kèm dữ liệu) **không làm trong O** — đề xuất phần riêng sau O (H4), đối chiếu thiết kế thùng rác của Q. Ghi chú cho phần đó: dữ liệu xoá vĩnh viễn vẫn còn trong Neon backup/PITR tới hết thời gian giữ (đã mã hoá sau O2); nếu muốn xoá "tức thì" cả trong backup thì cần khoá riêng theo từng giáo viên (crypto-shredding) — ngoài phạm vi, chỉ ghi ý.
7. `/privacy` mục "Lưu trữ và xoá" viết theo hành vi thật sau Q: "Dữ liệu bạn xoá được chuyển vào thùng rác; muốn xoá vĩnh viễn hoặc xoá tài khoản, liên hệ quản trị viên" (đối chiếu tên/luật thùng rác của Q khi viết chữ, Task 7).

## 7. Rà soát bảo mật (U3) — phát hiện, mức độ, xử lý

| # | Phát hiện | Mức | Xử lý |
|---|---|---|---|
| F1 | Mọi trường cá nhân (tên HS, SĐT/tên phụ huynh, ghi chú, họ tên GV, số TK, tên chủ TK) lưu bản rõ trong DB và mọi backup Neon | **Cao** | O1 (mã hoá khi ghi) + O2 (mã hoá dữ liệu cũ) |
| F2 | `parent_link_token` lưu bản rõ, là chìa khoá xem trang phụ huynh (tên HS, điểm danh, số TK GV). Dump DB + web đang chạy = đọc mọi trang phụ huynh | **Cao** | O1: tra cứu bằng SHA-256 (cột mới), token mã hoá (6.5) |
| F3 | Sau O2, Neon backup branch cũ (vd `backup-before-N-…`) và lịch sử PITR vẫn chứa bản rõ | Trung bình | O3: quy trình xoá branch cũ sau thời gian giữ, chờ hết cửa sổ PITR (6.12) |
| F4 | Sao lưu Excel: đủ mọi dữ liệu cá nhân, không mật khẩu, bấm menu là tải (không xác nhận), không ghi nhật ký | Trung bình | O1: hộp cảnh báo + dòng "Lưu ý" + `security_events` (6.8). Mật khẩu file: ngoài phạm vi (H3) |
| F5 | "Quyền được xoá": trước Q, xoá HS chỉ là `isActive = false`; Q thêm xoá mềm + thùng rác nhưng dữ liệu vẫn nằm trong DB; chưa có xoá vĩnh viễn / xoá tài khoản kèm dữ liệu | Trung bình | Ngoài phạm vi O: đề xuất phần riêng sau O (dọn thùng rác vĩnh viễn, xoá tài khoản), đối chiếu thiết kế Q (6.13 ý 6). O mã hoá cả dữ liệu trong thùng rác và ghi kênh liên hệ trong `/privacy` (H1, H4) |
| F6 | Thiếu header bảo mật toàn trang (trang có thể bị nhúng iframe → clickjacking; thiếu `nosniff`) | Trung bình | O1: header Q16 (6.10) |
| F7 | Người vận hành có quyền Vercel (env) + Neon vẫn giải mã được mọi thứ — giới hạn cố hữu của mã hoá phía ứng dụng | Trung bình | Không sửa bằng code. Khuyến nghị người dùng bật 2FA cho GitHub, Vercel, Neon; hạn chế người có quyền; không chia sẻ khoá |
| F8 | Không có nhật ký thao tác nhạy cảm (xuất dữ liệu, đổi TK nhận tiền, tạo/tắt link phụ huynh) | Thấp | O1: `security_events` (6.9). UI xem nhật ký: ngoài phạm vi |
| F9 | Scripts `scripts/*.ts`, `prisma/seed.ts` dùng `PrismaClient` thường → sau O1 sẽ ghi bản rõ / hiện ciphertext | Thấp | O1: bọc `withFieldEncryption` (6.3) |
| F10 | Chữ tìm tên HS nằm trong URL (`?search=`) → log request Vercel, lịch sử trình duyệt | Thấp | Ngoài phạm vi (Q21). Log Vercel giữ ngắn hạn; sửa triệt để phải bỏ đồng bộ ô tìm lên URL |
| F11 | `[tRPC] <path>: <error.message>` log mọi lỗi; `ZodError.message` là JSON issues (không chứa giá trị chuỗi cho lỗi regex/min/max, nhưng lỗi enum/literal có `received`); lỗi Prisma không chứa giá trị | Thấp | Chấp nhận. `FieldDecryptError`/`EncryptedFieldQueryError`/`FieldCryptoConfigError` chỉ chứa tên trường/kid. Review Focus: không thêm log in input/giá trị |
| F12 | Đăng nhập: username không tồn tại trả nhanh hơn (bỏ qua bcrypt) → dò được username theo thời gian; đăng ký vốn đã báo "Tên đăng nhập đã tồn tại" | Thấp | Ngoài phạm vi (đã có rate limit) |
| F13 | `login_attempts` giữ IP vĩnh viễn | Thấp | Ngoài phạm vi; đề xuất xoá bản ghi > 90 ngày |
| F14 | `TeachingSession.title` không mã hoá — GV có thể gõ tên HS vào tiêu đề ca | Thấp | Ngoài phạm vi; đề xuất placeholder gợi ý "vd: Toán 9A" |
| F15 | CSP chưa giới hạn `script-src` (phòng thủ chiều sâu chống XSS). Code không dùng `dangerouslySetInnerHTML`; React tự escape | Thấp | O1 chỉ thêm các chỉ thị an toàn (Q16); CSP nonce đầy đủ: ngoài phạm vi |
| F16 | Trang phụ huynh: token 256-bit ngẫu nhiên (không đoán được), token sai/tắt/hết Pro đều 404 như nhau, không cache, `noindex`, `no-referrer`, ẩn `studentId`/username/ghi chú thu tiền. Không rate limit | Thông tin | Giữ nguyên (brute force 2^256 không khả thi). Số TK GV hiện cho phụ huynh là chủ đích (VietQR) |
| F17 | Admin chỉ xem username, họ tên, số HS đang học, gói, đơn — không có đường đọc dữ liệu HS/ngân hàng của GV | Thông tin | Giữ. Task 1 kiểm K (doanh thu admin) không thêm đường đọc dữ liệu HS; có thì báo người điều phối |
| F18 | Rate limit đăng nhập (username + IP), đăng ký (IP), đổi mật khẩu (dùng chung bộ đếm) đã có, lưu DB | Thông tin | Giữ |
| F19 | JWT phiên chứa họ tên GV nhưng là JWE (mã hoá bằng `NEXTAUTH_SECRET`), cookie `httpOnly`/`secure`/`lax` | Thông tin | Giữ |

## 8. Phạm vi

### Trong phạm vi (O1 + O3)
- `src/server/crypto/field-crypto.ts`, `prisma-encryption.ts`, `parent-token.ts`, `backfill.ts` (MỚI); `src/server/db.ts`.
- `src/lib/name-search.ts`, `src/lib/consent.ts` (MỚI).
- Refactor tìm/sắp: `student.service`, `tuition.service`, `session.service`, `report.service`, `backup.service`.
- Link phụ huynh: `parent-link.service`, `StudentDTO`.
- Đồng ý: schema `settings`/`student`, `consent.service` (MỚI), router `settings`/`student`, `BankAccountCard`, `StudentFormDialog`, `ImportStudentsDialog`.
- `security-event.service` (MỚI), `/api/backup`, `BackupConfirmDialog` (MỚI), `AppHeader`.
- Trang `/privacy` (MỚI), `middleware.ts` matcher, link ở `/login`, `/register`.
- `next.config.mjs` header.
- 1 migration O1 (mục 13).
- `scripts/crypto-backfill.ts` (MỚI), bọc extension cho `scripts/create-user.ts`, `list-users.ts`, `prisma/seed.ts`.
- `.env.test` (cục bộ, không commit), `.env.test.example`, `.env.example`, `playwright.config.ts`.
- i18n vi/en; test unit/integration/e2e; `package.json` `0.7.0` (O1), `0.7.1` (O3); `docs/05-deploy.md` (O3).

### Ngoài phạm vi (YAGNI / để sau)
- **Phần R (sau O, người dùng đã chốt làm — H4)**: admin xoá hẳn tài khoản đã xoá mềm; giáo viên dọn thùng rác (xoá vĩnh viễn). Yêu cầu cho R: (1) dữ liệu lúc đó đã mã hoá, xoá hẳn = `DELETE` dòng (kèm quan hệ con: ca, điểm danh, học phí, lần thu, `consent_records`/`security_events` theo quyết định giữ bằng chứng của R); (2) Neon PITR và các branch backup vẫn giữ bản cũ tới hết thời gian giữ → ghi rõ trong `/privacy` và thông báo cho người yêu cầu; muốn xoá tức thì cả trong backup thì cần khoá riêng từng giáo viên (crypto-shredding), R tự quyết; (3) audit: ghi ai xoá, lúc nào, xoá gì (không ghi giá trị), không cho xoá tài khoản admin; (4) xác nhận 2 bước, không hoàn tác; (5) tuân thủ AN TOÀN DB (script/migration không destructive trên prod ngoài thao tác xoá theo yêu cầu).
- Mật khẩu cho file Excel sao lưu (H3: người dùng chốt KHÔNG làm), xác thực lại mật khẩu trước khi tải.
- Xoá vĩnh viễn (dọn thùng rác của Q) / xoá tài khoản kèm dữ liệu (F5, H4, 6.13); crypto-shredding theo khoá từng giáo viên; UI xem nhật ký bảo mật / lịch sử đồng ý.
- Tìm không dấu ("nguyen" ra "Nguyễn"), blind index, cache danh sách HS.
- CSP `script-src` với nonce; bỏ chữ tìm khỏi URL (F10); chống dò username theo thời gian (F12); dọn `login_attempts` (F13).
- Mã hoá `username`, `title`, IP.
- Lỗi server tiếng Anh (U4).

## 9. Ảnh hưởng tới phần khác

| Khu | Ảnh hưởng |
|---|---|
| Học sinh (danh sách, tìm, phân trang) | Kết quả như cũ; thứ tự tên theo quy tắc tiếng Việt (Q8). Truy vấn tải toàn bộ HS của GV rồi cắt trang |
| Học phí | Như cũ (vốn phân trang trong bộ nhớ) |
| Lịch (lọc theo tên HS) | Thêm 1 truy vấn nhẹ lấy id HS khớp tên |
| Báo cáo / Dashboard | Như cũ; sắp tên trong bộ nhớ |
| Nhập Excel | Kiểm trùng dùng tên đã giải mã (như cũ); thêm ô đồng ý |
| Phiếu học phí / VietQR | Số TK, tên chủ TK, tên HS giải mã trước khi dựng nội dung CK → không đổi |
| Trang phụ huynh | Tra theo hash; link cũ sống nhờ migration tự tính hash |
| Sao lưu Excel | Dữ liệu giải mã (như cũ); thêm hộp xác nhận + dòng lưu ý + nhật ký |
| Admin | `admin.overview` đọc `User.fullName` → được giải mã tự động; không đổi |
| Đăng nhập | JWT lấy `fullName` đã giải mã; `username` không đổi → tra cứu như cũ |
| Hiệu năng | Mỗi lần đọc/ghi thêm AES-GCM (micro giây/trường) + đi cây kết quả; `student.list` O(số HS của GV) |
| Scripts vận hành | `create-user`/`list-users`/seed dùng extension; `reset-password`/`deactivate-user`/`activate-default-subjects` không chạm trường mã hoá — giữ |
| Deploy | Khoá phải có trong env Production **trước** merge O1. `0.7.0` → mọi người đăng nhập lại 1 lần |

## 10. Giai đoạn triển khai và điều kiện chuyển

### O1 — code + migration (nhánh `feat/o-bao-mat-du-lieu`, `0.7.0`)
Nội dung: mọi thứ ở mục 8 trừ phần O3. Sau deploy: bản ghi **mới/sửa** được mã hoá; bản ghi cũ vẫn bản rõ (đọc bình thường); link phụ huynh tra theo hash.

**Trước khi merge O1 (người điều phối + người dùng):**
1. Người dùng sinh khoá `k1`, lưu dự phòng 2 nơi (6.2), đặt 2 biến env ở Vercel **Production**.
2. Neon: "Branch from current" → `backup-before-O1-<yyyy-mm-dd>`.
3. Merge `--no-ff` → push → Vercel build tự `prisma migrate deploy`.

**Kiểm sau deploy O1** (tài khoản `qa_test`, người dùng tự đăng nhập):
- Mở Học sinh, Học phí, Lịch, Báo cáo, trang phụ huynh có sẵn (link cũ còn mở được) → hiển thị bình thường.
- Tạo 1 HS thử (tick đồng ý) → hiện đúng tên; tìm theo một phần tên ra đúng.
- Người điều phối chạy `--dry-run` lên prod (O2 bước 2) → thấy `encrypted k1 ≥ 1` ở `students.full_name` (bản ghi vừa tạo) và giải mã được (`undecryptable = 0`) → **khoá prod đúng và bản dự phòng đúng** (chạy bằng khoá dán từ bản dự phòng).

**Điều kiện chuyển sang O2**: O1 chạy ổn ≥ 24 giờ, không lỗi `FieldDecryptError`/`FieldCryptoConfigError`/`EncryptedFieldQueryError` trong log Vercel, người dùng duyệt chạy script.

### O2 — mã hoá dữ liệu cũ (không deploy; người điều phối chạy, người dùng duyệt)
Lệnh chạy từ máy người điều phối (Git Bash), **không** ghi khoá/URL prod vào file; `<PROD_DIRECT_URL>` = `DIRECT_URL` của `.env` (host `ep-polished-voice…`, không pooler):

```bash
# 1. Backup Neon: Branch from current → backup-before-O2-backfill-<yyyy-mm-dd> (chứa bản rõ, xoá ở O3)
# 2. Dry-run: ghi lại bảng số dòng + checksum từng cột
DATABASE_URL='<PROD_DIRECT_URL>' DATA_ENCRYPTION_KEYS='k1:<từ bản dự phòng>' DATA_ENCRYPTION_ACTIVE_KID='k1' \
  pnpm exec tsx scripts/crypto-backfill.ts --dry-run
# 3. Apply
DATABASE_URL='<PROD_DIRECT_URL>' DATA_ENCRYPTION_KEYS='k1:<…>' DATA_ENCRYPTION_ACTIVE_KID='k1' \
  CONFIRM_HOST='<host in ở bước 2>' pnpm exec tsx scripts/crypto-backfill.ts --apply
# 4. Verify (mã thoát phải 0)
DATABASE_URL='<PROD_DIRECT_URL>' DATA_ENCRYPTION_KEYS='k1:<…>' DATA_ENCRYPTION_ACTIVE_KID='k1' \
  pnpm exec tsx scripts/crypto-backfill.ts --verify; echo "exit=$?"
```

Kiểm trước/sau (ghi vào báo cáo cho người dùng, không kèm dữ liệu):
- Mỗi cột: `total` trước = sau; `empty` trước = sau; sau apply `plain = 0`, `undecryptable = 0`, `encrypted.k1 = total − empty`.
- **Checksum từng cột ở bước 4 bằng đúng bước 2** (giải mã lại ra đúng dữ liệu cũ).
- Chạy lại `--apply` lần 2 → `changed = 0` ở mọi cột (idempotent).
- Mở web bằng `qa_test`: danh sách HS, tìm tên, phiếu học phí, trang phụ huynh, sao lưu Excel → đúng dữ liệu.

**Rollback O2** (nếu có sự cố hiển thị): `--decrypt` (cùng env + `CONFIRM_HOST`) đưa dữ liệu về bản rõ; code O1 vẫn đọc được. Hỏng nặng: đổi `DATABASE_URL` sang branch `backup-before-O2-backfill-…` (mất dữ liệu phát sinh sau thời điểm backup — chỉ dùng khi bất đắc dĩ).
**Rollback O1** (hiếm): chạy `--decrypt` trước, rồi revert commit merge O1 và deploy. Migration O1 chỉ nới cột + thêm cột/bảng, code cũ chạy được với schema mới (không cần gỡ migration).

**Điều kiện chuyển sang O3**: `--verify` mã thoát 0 trên prod, người dùng kiểm web ổn.

### O3 — dọn dẹp (nhánh `feat/o3-don-dep-ma-hoa`, `0.7.1`)
Code: cảnh báo bản rõ còn sót (6.12), tài liệu vận hành. Sau deploy: người dùng xoá Neon branch chứa bản rõ theo lịch ở 6.12, chạy `--verify` lần cuối.

## 11. Kiểm thử

### Unit
- `tests/unit/crypto/field-crypto.test.ts`: mã hoá → giải mã khứ hồi (tiếng Việt có dấu, emoji, chuỗi 1000 ký tự); 2 lần mã hoá cùng chuỗi ra 2 ciphertext khác nhau; định dạng khớp `/^enc:v1:[a-z0-9]{1,8}:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]*:[A-Za-z0-9_-]{22}$/`; `""` giữ nguyên; bản rõ không tiền tố → `decryptField` trả nguyên; sửa 1 ký tự ct/tag → `FieldDecryptError`; giải mã với field khác (AAD) → lỗi; kid lạ → lỗi; message lỗi **không** chứa bản rõ; chuỗi người dùng gõ bắt đầu bằng `enc:v1:` vẫn được mã hoá và giải mã ra đúng; khoá không đủ 32 byte / kid sai định dạng / thiếu env / active không có trong danh sách → `FieldCryptoConfigError` không chứa khoá; 2 khoá: ghi bằng active, đọc được bản cũ kid khác.
- `tests/unit/crypto/prisma-encryption.test.ts`: `encryptWriteArgs` (create/createMany mảng/update `{ set }`/upsert create+update/ghi lồng; không sửa object gốc; `null` giữ nguyên; `Date` giữ nguyên); `decryptResult` (lồng include nhiều cấp, mảng, `_count`); `assertNoEncryptedFilter` ném với `where.fullName`, `orderBy [{ fullName }]`, `include.x.orderBy.student.fullName`, `where.sessionStudents.some.student.fullName`, `distinct: ["fullName"]`; không ném với `where.userId`, `select.fullName`. **DMMF**: mọi trường String mọi model trùng tên `ENCRYPTED_KEYS` phải nằm trong `ENCRYPTED_FIELDS[model]`, và mọi mục trong `ENCRYPTED_FIELDS` tồn tại + không có `@db.VarChar` (đã nới TEXT).
- `tests/unit/lib/name-search.test.ts`: không phân biệt hoa thường ("AN" khớp "Trần Văn An"), NFC vs NFD khớp nhau, phân biệt dấu như ILIKE cũ ("an" không khớp "Ân"), term rỗng khớp tất cả, `byGradeThenName` (lớp trước, tên theo `vi`, trùng tên theo id).
- `tests/unit/lib/consent.test.ts`: `consentPayload` nhận `CONSENT_ACCEPTED`, từ chối thiếu/`true`/`accepted: false`/version cũ với message `CONSENT_REQUIRED`; `updateTouchesPersonalData`.
- `tests/unit/security-headers.test.ts`, `tests/unit/middleware-matcher.test.ts` (`/privacy` không qua middleware).
- Component: `BankAccountCard`, `StudentFormDialog`, `ImportStudentsDialog` (nút Lưu disabled tới khi tick; gửi `consent: CONSENT_ACCEPTED`; mở lại form thì bỏ tick), `BackupConfirmDialog`.

### Integration (DB test local)
- `tests/integration/o-migration.test.ts`: SQL không có `DROP`/`TRUNCATE`/`DELETE`; cột đã TEXT; `parent_link_token_hash` tính đúng bằng `hashParentToken` cho token có sẵn (chạy lại câu UPDATE trên dữ liệu test).
- `tests/integration/field-encryption.test.ts`: tạo HS qua caller → `SELECT full_name, parent_phone, notes FROM students` (raw) bắt đầu `enc:v1:` và không chứa bản rõ; đọc qua caller ra bản rõ; `User.bankAccountNumber` raw mã hoá; ghi lồng (tạo ca kèm `sessionStudents` có `note`) raw mã hoá; bản ghi bản rõ chèn bằng raw SQL đọc qua `db` vẫn ra đúng (giai đoạn chuyển); `db.student.findMany({ where: { fullName: "x" } })` ném `EncryptedFieldQueryError`; transaction thừa hưởng.
- Tìm/sắp (`student.test.ts`, `tuition.test.ts`, `session.test.ts` bổ sung): tìm một phần tên không phân biệt hoa thường; phân trang `totalCount/totalPages` đúng khi lọc; thứ tự lớp rồi tên; lịch lọc theo tên chỉ trả ca có HS khớp; không lộ HS của GV khác (multi-tenant).
- `parent-link.test.ts`: link tạo mới mở được; raw `parent_link_token` mã hoá, `parent_link_token_hash` = SHA-256; tắt link → 2 cột null; `student.list` không có `parentLinkTokenHash`.
- `consent.test.ts` (MỚI): thiếu `consent` → `BAD_REQUEST` và **không** ghi dữ liệu; có → 1 dòng `consent_records` đúng scope/version/userId/studentId/itemCount; update chỉ `isActive` không cần đồng ý; xoá TK ngân hàng không cần.
- `security-events.test.ts` (MỚI) + `backup-route.test.ts`: tải sao lưu ghi `backup_download`; đổi/xoá TK ngân hàng, tạo/tắt link ghi sự kiện; không có cột giá trị.
- `crypto-backfill.test.ts` (MỚI): chèn bản rõ bằng raw → dry-run đếm đúng, không ghi; apply → raw mã hoá, `updated_at` không đổi, checksum sau = trước; apply lần 2 `changed = 0`; verify ổn; `decrypt` trả bản rõ, checksum giữ; `rotate` sang kid mới; chuỗi giả tiền tố `enc:v1:` hỏng → `undecryptable`, không ghi; dòng đã xoá mềm (cột của Q) cũng được mã hoá.

### E2E
- Sửa các spec tạo HS/nhập Excel/lưu TK ngân hàng qua UI để tick ô đồng ý (tìm `fill('input[id="fullName"]'`, `bank-account-number`, nút nhập Excel); `trpcMutation(page, 'student.create', …)` thêm `consent: CONSENT_ACCEPTED`.
- MỚI `tests/e2e/consent-privacy.spec.ts`: nút Lưu HS disabled tới khi tick; bấm link Chính sách mở `/privacy` (không cần đăng nhập, có tiêu đề); lưu TK ngân hàng cần tick; hộp cảnh báo sao lưu hiện trước khi tải.
- `parent-link.spec.ts`: tạo token qua client thường thì ghi thêm `parentLinkTokenHash: hashParentToken(token)`.

## 12. Rủi ro

| # | Rủi ro | Xử lý |
|---|---|---|
| R1 | Mất khoá → mất dữ liệu vĩnh viễn | Dự phòng 2 nơi trước khi đặt env, kiểm bản dự phòng bằng `--dry-run` ở O1/O2 (6.2) |
| R2 | Deploy O1 khi chưa đặt khoá → mọi thao tác ghi HS/TK lỗi | Checklist trước merge (mục 10); fail closed nên không ghi bản rõ |
| R3 | Chỗ nào đó còn lọc/sắp DB theo trường mã hoá → kết quả sai im lặng | Extension ném `EncryptedFieldQueryError`; full test suite + e2e bắt |
| R4 | Raw SQL mới đọc/ghi cột mã hoá bỏ qua extension | Review Focus; hiện không có |
| R5 | `student.list` chậm khi GV có rất nhiều HS | Q8: ổn tới ~5.000; theo dõi log `[tRPC] … ms` |
| R6 | Thứ tự tên đổi nhẹ so với trước | Chấp nhận (Q8), theo quy tắc tiếng Việt |
| R7 | Tab cũ (bản trước O1) gửi form không có `consent` → lỗi `CONSENT_REQUIRED` | `0.7.0` ép đăng nhập lại (epoch N) → tải lại trang; thông báo `consent_required` |
| R8 | Backfill chạy nhầm DB | `CONFIRM_HOST`, không tự đọc `.env`, mặc định dry-run |
| R9 | Backfill chạy lúc GV đang sửa → ghi đè | `UPDATE … WHERE <cột> = <giá trị cũ>` bỏ qua dòng vừa đổi; lượt sau (hoặc `--verify`) bắt nốt |
| R10 | Bản rõ vẫn nằm trong Neon backup/PITR, log cũ | O3 quy trình xoá; Vercel log giữ ngắn hạn |
| R11 | P/Q/K đổi file dùng chung (schema, `db.ts`, service, admin, i18n); Q có thể thêm extension xoá mềm | Đối chiếu code thật, Ruling (Global Constraints) |
| R12 | Prisma extension đổi kiểu `db` làm vỡ kiểu `PrismaClient` ở service | `db.ts` giữ `as unknown as PrismaClient` như hiện tại |

## 13. Migration (O1, 1 migration, không destructive)

`prisma/schema.prisma`:
- `User.fullName String?` (bỏ `@db.VarChar(100)`), `bankAccountNumber String?` (bỏ `@db.VarChar(19)`), `bankAccountName String?` (bỏ `@db.VarChar(50)`).
- `Student.fullName String`, `parentPhone String?`, `parentName String?`, `parentLinkToken String? @unique` (bỏ các `@db.VarChar`); thêm `parentLinkTokenHash String? @unique @map("parent_link_token_hash") @db.VarChar(64)`.
- Model MỚI:
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
SQL (Prisma sinh bằng `--create-only`, tay thêm câu `UPDATE` tính hash): `ALTER COLUMN … SET DATA TYPE TEXT` (7 cột), `ADD COLUMN parent_link_token_hash`, `UPDATE … sha256`, `CREATE UNIQUE INDEX`, 2 `CREATE TABLE` + index. Không `DROP`. VarChar → TEXT trên Postgres không viết lại bảng.

`tests/setup.ts`: thêm `consentRecord.deleteMany()`, `securityEvent.deleteMany()` vào khối reset (không FK nên thứ tự tuỳ ý).

## 14. Câu hỏi cho người dùng (đã trả lời 2026-09-27)

| # | Câu hỏi | Trả lời |
|---|---|---|
| H1 | Kênh liên hệ trên `/privacy` | **Chưa trả lời** → `NEXT_PUBLIC_PRIVACY_CONTACT` (mặc định "email/Zalo của chủ ứng dụng"), người dùng điền trước khi merge O1 |
| H2 | Ô đồng ý ở Đăng ký | **Có, bắt buộc.** Mọi ô đồng ý gửi 1 key thống nhất `consent` trong payload của đúng API; ô đồng ý không có link; link `/privacy` ở màn Đăng nhập (và chữ nhỏ ở Đăng ký) |
| H3 | Mật khẩu file sao lưu | **Không**; chỉ cảnh báo + nhật ký |
| H4 | Xoá vĩnh viễn | **Có, làm ở phần R riêng sau O** (mục 8) |
| H5 | Gợi ý không dùng SĐT làm tên đăng nhập | **Có**, dòng gợi ý nhẹ ở Đăng ký, không chặn |
