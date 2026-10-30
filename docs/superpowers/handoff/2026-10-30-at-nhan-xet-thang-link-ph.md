# Handoff AT — Nhận xét tháng trên phiếu học phí + lấy link phụ huynh ngay ở màn Học phí

Nhánh: `feat/at-nhan-xet-thang-link-ph` · Thư mục làm việc (worktree): `D:\APINODEJS\student-managerment-at`
Vai: **LEADER** (giao việc, duyệt) · **DEV** (code) · **QA** (kiểm thử)

Quy ước: mỗi vai chỉ ghi thêm vào mục của mình. Câu hỏi giữa các vai ghi ở mục **Trao đổi** dạng `[DEV → LEADER] ...`.

---

## 1. LEADER — Yêu cầu

### Yêu cầu A — Nhận xét tháng gửi phụ huynh
User muốn phiếu học phí (ảnh phiếu + trang link phụ huynh `/p/[token]`) có mục **NHẬN XÉT** của giáo viên cho cả tháng, nằm sau "Ngày đi học" và trước mã QR thanh toán (giống mẫu "Phiếu học phí cô Quỳnh"). Mục đích: phụ huynh mở link sẽ đọc nhận xét và chuyển tiền luôn, giáo viên không phải nhắn nhận xét riêng từng bạn.

Quyết định đã chốt (user đã duyệt chỗ ghi):
1. Nhận xét lưu **theo từng học sinh × từng tháng**. Thêm cột mới, nullable, ví dụ `MonthlyTuition.parentComment` (`parent_comment`, `@db.Text`). **KHÔNG** dùng lại `MonthlyTuition.notes`, vì đó là ghi chú nội bộ (có cả lý do miễn học phí), không được lộ cho phụ huynh. **KHÔNG** dùng `Student.notes`.
2. **Chỗ giáo viên viết: trong hộp phiếu học phí** (`src/components/tuition/TuitionNoticeDialog.tsx`, phần xem trước phiếu trước khi gửi). Có ô textarea "Nhận xét tháng (phụ huynh sẽ thấy)", lưu được, và phần xem trước cập nhật theo.
3. Hiển thị trong `TuitionNoticeCard` (dùng chung cho ảnh phiếu và `ParentView`). Không có nhận xét thì không hiện mục này. Giữ xuống dòng, chống XSS (render text thường, không dùng HTML).
4. Giới hạn độ dài hợp lý (vd 2000 ký tự) bằng Zod. Kiểm quyền sở hữu HS như các mutation học phí khác.
5. Thêm nhận xét/đổi nhận xét **không** làm phiếu chuyển trạng thái "đã thay đổi cần gửi lại" (trạng thái đó chỉ theo số tiền).

### Yêu cầu B — Lấy link phụ huynh ngay ở màn Học phí
Hiện muốn lấy link phụ huynh phải sang màn Học sinh (`ParentLinkDialog` qua `StudentActionsMenu`). User muốn ở hộp phiếu học phí của màn Học phí có nút **sao chép / mở link phụ huynh** luôn.
1. Dùng lại `src/components/students/ParentLinkDialog.tsx` (hoặc logic của nó), không viết lại. Tôn trọng chốt gói `useFeatureGate("parentLink")` như `StudentList.tsx` đang làm: gói không có tính năng và HS chưa có link thì mở hộp nâng cấp.
2. HS chưa có link thì cho tạo link như ở màn Học sinh. Đã có thì có nút sao chép nhanh.
3. Đặt nút trong hộp phiếu học phí, cạnh các nút gửi/tải ảnh phiếu. Nếu thấy hợp hơn ở menu từng dòng màn Học phí thì ghi lý do ở mục Trao đổi.

### Quy tắc bắt buộc
- Đọc `docs/CLAUDE.md` và `docs/coding-rule.md` (đặc biệt §6.1 bảo vệ DB production) trước khi code.
- **Migration**: tự viết thư mục migration mới trong `prisma/migrations/` (chỉ `ALTER TABLE ... ADD COLUMN ... NULL`, không destructive), sửa `prisma/schema.prisma`, chạy `npx prisma generate`. **TUYỆT ĐỐI KHÔNG** chạy `prisma migrate deploy/dev/reset`, `db push`, `pnpm db:*` lên `.env` hoặc `.env.local`. Chỉ được áp migration lên DB test `localhost:5433` (`.env.test`) nếu DB đó chạy được.
- DB test `localhost:5433` hiện có thể chưa lên (Docker không mở được cổng). Không được stop/xoá/sửa container Docker nào. Không có DB thì chạy unit test bằng config vitest tạm ở scratchpad, bỏ `tests/env-setup.ts` và `tests/setup.ts`, và ghi rõ test nào chưa chạy.
- Thêm chuỗi i18n theo cách project đang làm (tìm hàm `t(...)`).
- Code tối giản, sửa đúng phạm vi, theo style sẵn có. Có unit test cho schema/service/hiển thị nhận xét.
- Commit trên nhánh `feat/at-nhan-xet-thang-link-ph`, message 1 dòng `[AT] ...`, không body, không Co-Authored-By. Không push, không merge.

### Tiêu chí hoàn thành
- Giáo viên mở phiếu học phí của 1 HS, viết nhận xét, lưu. Ảnh phiếu và trang `/p/[token]` hiện mục NHẬN XÉT đúng nội dung, đúng xuống dòng, đặt trước QR.
- Tháng khác của cùng HS không bị dính nhận xét. HS khác không thấy. `notes` nội bộ không lộ ra phiếu.
- Từ hộp phiếu học phí sao chép/tạo được link phụ huynh. Chốt gói hoạt động như màn Học sinh.
- `pnpm lint`, `npx tsc --noEmit` sạch. Unit test xanh (số liệu thật).

---

## 2. DEV — Báo cáo

**Commit:** `3986c2d` (code + test + migration). Nhánh `feat/at-nhan-xet-thang-link-ph`, chưa push/merge.

### Migration (chỉ viết file, CHƯA áp lên DB nào)
- `prisma/migrations/20261030120000_at_parent_comment/migration.sql`: `ALTER TABLE "monthly_tuition" ADD COLUMN "parent_comment" TEXT;` (nullable, không destructive).
- `prisma/schema.prisma`: `MonthlyTuition.parentComment String? @map("parent_comment") @db.Text`. Đã chạy `npx prisma generate`. Không chạy migrate / db push / pnpm build / pnpm db:*.

### Cách làm
**A — Nhận xét tháng**
- `src/lib/schemas/tuition.ts`: `parentCommentSchema` = `tuitionNoticeSchema` + `parentComment: z.string().trim().max(2000)`. Chuỗi rỗng = xoá.
- `src/server/services/tuition-notice.service.ts`:
  - `getTuitionNotice` đọc thêm `monthlyTuition.findUnique({ studentId_year_month }, select: { parentComment })` → DTO có `parentComment` (null nếu chưa có). Chỉ select `parentComment`, không đụng `notes`.
  - `saveParentComment`: gọi `ensureMonthlyTuition` (kiểm quyền sở hữu HS + tạo dòng tháng đúng carry-over, như `updateSettlement`) rồi update `parentComment` (rỗng → null). Không đụng `noticeSentAt/noticeSentAmount` nên trạng thái "đã gửi / cần gửi lại" không đổi.
- `src/server/trpc/routers/tuition.ts`: mutation `tuition.saveParentComment` dùng `planProcedure("tuitionNotice")` (cùng chốt gói với `getNotice`).
- `src/lib/types/models.ts`: `TuitionNoticeDTO.parentComment: string | null`. Trang PH (`parent-link.service` spread `notice`) tự có nhận xét, không phải sửa.
- `src/components/tuition/TuitionNoticeCard.tsx`: mục "Nhận xét" (`data-testid="notice-comment"`) đặt sau khối tiền, ngay trước QR (tức là sau "Ngày học", trước QR), có ở cả bản thường và bản rộng (trang PH desktop). Render text thường (React tự escape), `whitespace-pre-wrap break-words` giữ xuống dòng. Không có nhận xét thì ẩn.
- `src/components/tuition/TuitionNoticeDialog.tsx`: dưới phần xem trước phiếu có textarea "Nhận xét tháng (phụ huynh sẽ thấy)" (`maxLength=2000`) + nút "Lưu nhận xét" (chỉ bật khi có thay đổi). Lưu xong TRPCProvider tự invalidate → `getNotice` refetch → phiếu xem trước + ảnh chụp lại có nhận xét.
- Mã hoá: thêm `parentComment` vào `ENCRYPTED_FIELDS.MonthlyTuition` (`src/server/crypto/prisma-encryption.ts`) và `FIELD_TARGETS` (`src/server/crypto/backfill.ts`), giống `MonthlyTuition.notes` (xem mục Trao đổi).
- i18n (`src/language/vi.json`, `en.json`): `notice_comment`, `parent_comment_label`, `parent_comment_placeholder`, `save_comment`, `comment_saved`, `copy_parent_link`.

**B — Link phụ huynh ở hộp phiếu học phí**
- Lấy token: `tuition.getNotice` (chỉ dùng ở màn giáo viên) đổi sang gọi `getTeacherTuitionNotice` = `getTuitionNotice` + `student.findFirst({ id, userId }, select: { parentLinkToken, placeId })`. Lý do: dòng học phí (`getMonthlyTuitionStatus`) không có token, thêm vào đó sẽ phải giải mã token cho mọi HS trong danh sách; còn nhét vào `TuitionNoticeDTO` thì token sẽ đi theo phiếu ra trang PH. Tách hàm riêng thì trang `/p/[token]` vẫn dùng `getTuitionNotice`, không có token.
- Footer hộp phiếu thêm nút **"Link phụ huynh"** (cạnh Chia sẻ / Tải ảnh / Lưu ảnh), mở lại `ParentLinkDialog` (không viết lại), truyền `{ id, fullName, parentLinkToken, placeId }` và `canGenerate={linkGate.allowed}`. Chốt gói giống `StudentList.tsx`: `useFeatureGate("parentLink")`; khoá + HS chưa có link → `openUpgrade()`; khoá nhưng đã có link → vẫn mở dialog (nút Tạo lại có khoá).
- HS đã có link → thêm nút icon **"Sao chép link phụ huynh"** chép thẳng `origin/p/<token>` (toast giống ParentLinkDialog). Tạo link trong dialog xong → invalidate toàn cục → `getNotice` refetch → nút sao chép nhanh hiện ra.

### Kiểm tra (số liệu thật, chạy 2026-10-30)
- `npx tsc --noEmit`: sạch (0 lỗi).
- `pnpm lint`: `ESLint: No issues found`.
- Unit test (toàn bộ `tests/unit`, config tạm ở scratchpad bỏ `tests/env-setup.ts` + `tests/setup.ts`, `DATABASE_URL` trỏ cổng chết `localhost:5999` để không chạm DB, `DATA_ENCRYPTION_KEYS` là khoá ngẫu nhiên): **188 file / 1297 test pass, 0 fail**.
  - Test mới (viết trước, đã đỏ trước khi code): `tests/unit/schemas/tuition-parent-comment.schema.test.ts` (4), `tests/unit/services/tuition-notice-comment.test.ts` (6), `tests/unit/components/TuitionNoticeCardComment.test.tsx` (4), `tests/unit/components/TuitionNoticeDialogAT.test.tsx` (7) = 21 test.
  - Sửa test cũ: thêm `parentComment: null` vào fixture `ParentView`, `TuitionNoticeCard`, `TuitionNoticeCardVariant`; thêm mock `saveParentComment` + `useFeatureGate` vào `TuitionNoticeDialog.test.tsx`.
- **Integration test CHƯA chạy được**: DB test `localhost:5433` trả `ECONNREFUSED`. Đã viết sẵn:
  - `tests/integration/tuition-notice.test.ts` — describe `tuition.saveParentComment (AT)` (4 test): đúng HS × tháng, tháng khác / HS khác null, `notes` không lộ; chuỗi rỗng xoá; lưu nhận xét không đổi `noticeStatus` "sent"; HS của user khác không ghi được; `getNotice` trả `parentLinkToken`.
  - `tests/integration/parent-link.test.ts`: trang PH có `notice.parentComment`, không có `parentLinkToken`.
  - `tests/integration/plan-gating.test.ts`: thêm `tuition.saveParentComment` vào PLUS_CASES.

### QA nên kiểm
1. Áp migration lên DB test (5433) rồi chạy `tests/integration/tuition-notice.test.ts`, `parent-link.test.ts`, `plan-gating.test.ts`, `crypto-backfill.test.ts`.
2. Viết nhận xét nhiều dòng → Lưu → ảnh phiếu (Tải ảnh / Lưu ảnh / Chia sẻ) có mục NHẬN XÉT đúng xuống dòng, trước QR; kiểm html2canvas vẽ `white-space: pre-wrap` đúng.
3. Trang `/p/[token]` (mobile + desktop bản rộng) hiện nhận xét; chuyển sang tháng khác thì không có.
4. Nhận xét có `<b>` / `<script>` hiện nguyên chữ.
5. Phiếu đã "Đã gửi" → sửa nhận xét → vẫn "Đã gửi" (không thành "Cần gửi lại").
6. Nút "Link phụ huynh": gói không có `parentLink` + HS chưa có link → hộp nâng cấp; HS đã có link → mở dialog, nút Tạo lại có khoá. Gói có tính năng: tạo link → nút sao chép nhanh xuất hiện, sao chép đúng URL.
7. ParentLinkDialog mở chồng trên hộp phiếu (Dialog desktop / Sheet mobile): đóng ParentLinkDialog không đóng luôn hộp phiếu.
8. Footer mobile có thêm 1–2 nút: kiểm không tràn ở 360px.

### Vòng 2 — làm theo LEADER trả lời (điểm 3, 4, 5; điểm 1, 2 giữ nguyên)
**Commit:** `780c0ec`.

**(4) Sao lưu Excel** — `src/server/services/backup.service.ts`: query `monthlyTuition` select thêm `parentComment`; sheet "Học phí tháng" thêm cột **"Nhận xét gửi phụ huynh"** ngay sau "Ghi chú". App **không có** chức năng khôi phục/nhập lại từ file sao lưu (chỉ có nhập học sinh từ Excel, và "khôi phục" ở Thùng rác là khôi phục bản ghi đã xoá mềm), nên không có chỗ đọc lại cột này. Test: unit mới `tests/unit/services/backup-parent-comment.test.ts` (đỏ trước khi sửa); integration `tests/integration/backup.test.ts` cập nhật danh sách cột (chưa chạy, không có DB).

**(5) Không mất nhận xét** — `src/components/tuition/TuitionNoticeDialog.tsx`:
- Rời ô (blur) → tự lưu (giống ô Ghi chú ở `TuitionDetailSheet`). Vẫn giữ nút "Lưu nhận xét". Có ref nhớ bản vừa gửi để blur + bấm nút / bấm xuất không lưu 2 lần.
- Bấm Chia sẻ / Tải ảnh / Lưu ảnh khi nhận xét chưa lưu (hoặc đang lưu): lưu trước, các nút tạm khoá, **chỉ xuất khi phiếu đã tải lại có nhận xét mới VÀ ảnh đã chụp lại theo nhận xét đó** (ảnh nhớ kèm nhận xét lúc chụp, nên ảnh cũ không bị xuất nhầm). Lưu lỗi → huỷ lệnh xuất, báo lỗi.
- Hạn chế đã biết: Chia sẻ sau khi phải lưu là gọi sau tác vụ bất đồng bộ, Safari có thể chặn `navigator.share`; khi đó `shareOrDownloadPng` có sẵn đường lùi là tải file về. Không có nhận xét chưa lưu thì Chia sẻ chạy ngay như cũ.
- Test: thêm 4 test vào `tests/unit/components/TuitionNoticeDialogAT.test.tsx` (blur tự lưu + không lưu lặp; không đổi thì xuất ngay; còn chưa lưu thì lưu trước, chỉ xuất sau khi phiếu có nhận xét mới; lưu lỗi thì không xuất). 3 test đỏ trước khi sửa.

**(3) Hướng dẫn đi kèm**
- `src/lib/guide-content.ts` mục "Học phí": thêm 2 bước chữ (Nhận xét tháng; lấy link phụ huynh ngay trong hộp phiếu). Không thêm shot mới.
- `src/lib/releases.ts`: bản **0.27.0** (2026-10-30, `notify: true`), 2 mục trỏ `guideId: "hoc-phi"`. `package.json` nâng `0.26.0 → 0.27.0` (test `releases.test.ts` bắt bản đầu = version package).
- `public/guide/huong-dan-su-dung.docx`: chạy lại `pnpm guide:docx` (script chỉ đọc `guide-content.ts` + ảnh sẵn có, không chạm DB) → test `guide-docx-file` khớp.
- Tour: **không thêm**. Tour "tuition" đã có bước chỉ nút Phiếu báo; thao tác mới (gõ nhận xét → tự lưu → gửi phiếu) chỉ 1 bước trong hộp, không cần tour nhiều bước.
- **Còn treo:** chụp lại ảnh `hoc-phi-phieu-bao` (và nếu muốn thì `link-phu-huynh`) qua `tests/guide-shots` cần app + DB, chưa chạy được → ảnh hướng dẫn hiện chưa có ô nhận xét / nút link. Sau khi chụp lại phải chạy lại `pnpm guide:docx`.

**Kiểm tra vòng 2 (chạy thật 2026-10-30):** `npx tsc --noEmit` 0 lỗi · `pnpm lint` sạch · unit test toàn bộ `tests/unit` (cùng config tạm, không chạm DB): **189 file / 1302 test pass, 0 fail**. Integration vẫn chưa chạy (5433 `ECONNREFUSED`).

**Lưu ý cho LEADER:** nhánh AS (đang QA) nếu cũng nâng lên 0.27.0 thì khi merge sẽ đụng `package.json` + `releases.ts`; bên merge sau đổi số bản.

### Vòng 3 — sửa lỗi QA (QA-1..4) + merge main
**Commit:** merge `6a6a14f` (Merge branch 'main', không xung đột) · sửa lỗi `1ea1b92`.

**0. Merge main** (gói AS): git tự gộp, **không có xung đột**. `tuition-notice.service.ts` sau merge dùng `status.inProgress` + truyền `inProgress` cho `ensureTuitionPayLink` (của AS), phần AT (`parentComment`, `getTeacherTuitionNotice`, `saveParentComment`) giữ nguyên. Main vẫn ở `0.26.0`, nhánh AT `0.27.0` → không đụng số bản.

Mọi sửa trong `src/components/tuition/TuitionNoticeDialog.tsx`:
- **QA-1 (lưu khi đóng hộp):** thêm `useEffect` cleanup gọi `saveComment()` qua ref lúc unmount (giống `TuitionDetailSheet`, spec AR B2), chỉ khi người dùng có sửa ô (`comment !== null`). Gọi `mutate` của hook: TanStack Query vẫn chạy mutation sau unmount, `MutationCache` của TRPCProvider vẫn invalidate. Ca `[BUG QA-1]` trong `TuitionNoticeDialogAT.qa.test.tsx` đã đổi `it.fails` → `it`, xanh.
- **QA-2 (footer 360px):** footer `flex flex-wrap … md:flex-nowrap md:justify-end`; cụm "Link phụ huynh" + nút sao chép bọc trong `div.flex.w-full.gap-2.md:w-auto` → mobile cụm link 1 hàng riêng, hàng dưới là Chia sẻ + Lưu ảnh (mỗi hàng ≤ 2 nút chữ, mỗi nút `h-11` = 44px); desktop vẫn 1 hàng. Test chỉ kiểm cấu trúc class (jsdom không đo được bề rộng) → **QA nên đo lại thật ở 360px**.
- **QA-3 (sửa luôn, gọn):** so nội dung với "bản server sẽ có" = `sentComment ?? savedComment` (bản đang/vừa gửi, chưa gửi thì bản đã lưu), thay vì chỉ so bản đã lưu. Đang lưu B mà sửa về A rồi blur → gửi A. Dùng chung cho blur, nút Lưu, lưu khi đóng.
- **QA-4:** `useEffect` — đang chờ xuất mà `query.isError` → huỷ lệnh xuất (mở khoá 3 nút) + `toast.error(load_error)`.

**TDD:** 3 test mới trong `tests/unit/components/TuitionNoticeDialogAT.test.tsx` (`[QA-2]`, `[QA-3]`, `[QA-4]`) + ca `[BUG QA-1]` của QA; cả 4 đỏ trước khi sửa, xanh sau khi sửa.

**Kiểm tra vòng 3 (chạy thật 2026-10-30, sau merge main):** `node_modules/.bin/tsc --noEmit` exit 0 · `pnpm lint` `ESLint: No issues found` · unit toàn bộ `tests/unit` (config tạm, không chạm DB): **193 file / 1335 test pass, 0 fail**. Không chạy integration / `pnpm test` / migrate (để LEADER chạy).

### Vòng 4 — QA-5 (footer desktop tràn hộp 460px)
**Commit:** `b14c8d7`.
- `src/components/tuition/TuitionNoticeDialog.tsx`: bỏ `md:flex-nowrap` ở footer và `md:w-auto` ở cụm link phụ huynh → **desktop cũng 2 hàng như mobile**: hàng 1 "Link phụ huynh" + nút sao chép, hàng 2 Chia sẻ + Tải ảnh. Cả 2 hàng canh phải trên desktop (`md:justify-end`). Không nới bề rộng hộp (vẫn `sm:max-w-[460px]`).
- TDD: test `[QA-2/QA-5]` trong `tests/unit/components/TuitionNoticeDialogAT.test.tsx` đổi sang kiểm footer **không** có `md:flex-nowrap`, cụm link **không** có `md:w-auto` (vẫn `w-full`, `flex-wrap`, `h-11`); đỏ trước khi sửa, xanh sau khi sửa. jsdom không đo được bề rộng → nhờ QA đo lại thật.
- Kiểm tra (chạy thật): vitest config tạm cho `tests/unit/components/TuitionNoticeDialog*` → **3 file / 31 test pass**; `node_modules/.bin/tsc --noEmit` exit 0; `pnpm lint` `ESLint: No issues found`. Không chạy toàn bộ unit/integration/migrate (LEADER đang chạy nền).

---

## 3. QA — Báo cáo

Kiểm trên HEAD `3f08e14` (code DEV `3986c2d` + `780c0ec`), chạy 2026-10-30. Không chạy integration / `pnpm test` / prisma / build (DB 5433 đang dùng cho nhánh khác).

### Kết quả lệnh (chạy thật)
- `npx tsc --noEmit`: exit 0, 0 lỗi.
- `pnpm lint`: exit 0, sạch.
- Unit toàn bộ `tests/unit` (config tạm của DEV, `DATABASE_URL` cổng chết 5999, khoá mã hoá ngẫu nhiên): **191 file pass, 1312 test pass + 1 expected fail** (ca `it.fails` ghi lỗi QA-1 bên dưới), 0 fail.
- Test QA mới (đã commit): `tests/unit/qa/at-parent-comment-edge.test.ts` (7 test: schema chỉ khoảng trắng → rỗng, cắt trước khi đếm 2000, thiếu/null bị chặn, giữ thẻ HTML dạng chữ; mã hoá `parentComment` khi update + đọc lại giữ xuống dòng, null không mã hoá, ciphertext không giải mã chéo sang `notes`) và `tests/unit/components/TuitionNoticeDialogAT.qa.test.tsx` (3 test + 1 `it.fails`: blur rồi bấm Tải ảnh chỉ lưu 1 lần và nút xuất khoá khi chờ; xoá hết → gửi chuỗi rỗng; lưu lỗi rồi blur lại thì được gửi lại; ca lỗi QA-1).

### Ca kiểm thử (review code + test)
| # | Ca | Kết quả |
|---|----|---------|
| 1 | `notes` nội bộ không lộ: `getTuitionNotice` chỉ `select: { parentComment }` | PASS |
| 2 | `parentLinkToken` không ra trang `/p`: trang PH gọi `getTuitionNotice` (không phải `getTeacherTuitionNotice`), `TuitionNoticeDTO` không có token | PASS |
| 3 | `saveParentComment`: `planProcedure("tuitionNotice")` + `ensureMonthlyTuition` → `assertOwnership` | PASS |
| 4 | XSS: render `{notice.parentComment}` text thường, không `dangerouslySetInnerHTML` | PASS |
| 5 | Giới hạn 2000 (Zod trim rồi max; textarea `maxLength=2000`) | PASS |
| 6 | Mã hoá: `ENCRYPTED_FIELDS.MonthlyTuition` + `FIELD_TARGETS` khớp (bảng `monthly_tuition`, cột `parent_comment`); extension mã hoá theo tên khoá nên update/upsert/findUnique đều đi qua | PASS |
| 7 | Đúng HS × tháng (`studentId_year_month`); update theo `mt.id` | PASS |
| 8 | Đổi nhận xét không đụng `noticeSentAt/noticeSentAmount` → không thành "cần gửi lại" | PASS (review; integration chưa chạy) |
| 9 | Blur tự lưu, không lưu đôi khi blur + bấm xuất; lưu lỗi huỷ xuất; không xuất ảnh cũ (ảnh nhớ `blobComment`, card `key=dataUpdatedAt` chụp lại sau refetch) | PASS |
| 10 | Đóng hộp bằng Esc khi nhận xét chưa lưu | **FAIL — QA-1** |
| 11 | Nút Link phụ huynh: chốt gói giống `StudentList.tsx:172`, `canGenerate={linkGate.allowed}`; sao chép `origin/p/<token>` giống `ParentLinkDialog`; tạo link → invalidate toàn cục → refetch → nút sao chép hiện | PASS |
| 12 | Footer mobile 360px khi có thêm nút | **FAIL — QA-2** |
| 13 | Migration: `ALTER TABLE "monthly_tuition" ADD COLUMN "parent_comment" TEXT;` nullable, không destructive; schema `@map("parent_comment") @db.Text`, `@@map("monthly_tuition")` | PASS |
| 14 | Backup Excel: select + cột "Nhận xét gửi phụ huynh" sau "Ghi chú" | PASS |
| 15 | i18n: 6 khoá mới có đủ vi/en; vi.json/en.json cùng bộ khoá (so bằng script, 0 lệch) | PASS |
| 16 | guide-content (2 bước chữ), releases 0.27.0 + `package.json` 0.27.0 | PASS (ảnh guide-shots còn treo như DEV ghi) |

### Lỗi
- **QA-1 (Trung bình — mất dữ liệu)** `src/components/tuition/TuitionNoticeDialog.tsx:54-57, 210`: chỉ lưu khi `onBlur`, không lưu lúc unmount. Đóng hộp bằng **Esc** (hoặc kiểu đóng nào gỡ ô mà không bắn blur) thì nhận xét đang gõ bị mất. Mẫu LEADER chỉ định `TuitionDetailSheet.tsx:165-180` có `useEffect` cleanup lưu ghi chú còn dở khi unmount (comment ghi rõ "Đóng sheet bằng Esc/vuốt không bắn blur", spec AR B2); hộp phiếu thiếu phần này. Tái hiện: mở Phiếu báo → gõ nhận xét (không bấm ra ngoài) → nhấn Esc → mở lại phiếu: nhận xét không còn. Test tái hiện: `TuitionNoticeDialogAT.qa.test.tsx` ca `[BUG QA-1]` (đang `it.fails`; sửa xong đổi thành `it`).
- **QA-2 (Trung bình — UI mobile)** `src/components/tuition/TuitionNoticeDialog.tsx:229-243`: footer `flex gap-2` + nút `whitespace-nowrap`, thêm "Link phụ huynh" + nút sao chép 44px. Đo trong Chrome (dựng lại đúng class: 360px, padding 16, gap 8, chữ 14px, px-4, icon 16 + mr-2): máy chia sẻ được (`canShareFiles` = true, thường là điện thoại) có link → nội dung rộng **475px**; chưa có link → **423px**; không có nút Chia sẻ → 360px vừa. Tức trên điện thoại thật footer tràn ngang/bị cắt nút. Gợi ý: cho footer xuống 2 hàng trên mobile (`flex-wrap`/grid) hoặc rút nút link thành icon.
- **QA-3 (Thấp)** `TuitionNoticeDialog.tsx:118-123`: lưu B đang chạy, người dùng sửa về đúng bản đã lưu A rồi blur → bị bỏ qua (`text === savedComment`), B ghi đè; sau refetch ô hiện A nhưng phiếu là B (ô báo "chưa lưu", bấm Lưu được). Không mất dữ liệu, chỉ ghi nhận.
- **QA-4 (Thấp)** Bấm xuất khi chờ lưu, nếu lưu thành công nhưng refetch phiếu lỗi thì `pendingExport` treo, 3 nút xuất khoá tới khi đóng hộp. Hiếm.

### Chưa kiểm (cần LEADER chạy)
- Integration: `tests/integration/tuition-notice.test.ts`, `parent-link.test.ts`, `plan-gating.test.ts`, `backup.test.ts`, `crypto-backfill.test.ts` (cần áp migration lên 5433).
- html2canvas vẽ `white-space: pre-wrap` trong ảnh thật; trang `/p` thật; ParentLinkDialog chồng lên Sheet trên mobile thật.

### Kết luận: **KHÔNG ĐẠT** (vòng này)
Bảo mật/riêng tư, mã hoá, migration, chốt gói đều đúng. Cần sửa QA-1 (yêu cầu LEADER điểm 5 "không để mất nhận xét", có mẫu sẵn ở `TuitionDetailSheet`) và QA-2 (footer tràn trên điện thoại). QA-3/QA-4 tuỳ LEADER.

### Vòng 2 QA (kiểm lại DEV vòng 3: `6a6a14f` merge main + `1ea1b92` sửa lỗi; HEAD `10a6855`)

**Lệnh (chạy thật 2026-10-30):** `node_modules/.bin/tsc --noEmit` exit 0 · `pnpm lint` exit 0 · unit toàn bộ `tests/unit` (config tạm, `DATABASE_URL` cổng chết 5999, không chạm DB): **193 file / 1335 test pass, 0 fail** (ca `[BUG QA-1]` đã thành `it` và xanh). Không chạy integration / `pnpm test` / migrate.

**Merge main (AS):** `git diff main HEAD -- src/server src/lib/tuition-display.ts` chỉ còn phần AT (`tuition-notice.service.ts` thêm parentComment / getTeacherTuitionNotice / saveParentComment, router, crypto, backup). `tuition-paylink.service.ts`, `tuition-display.ts`, `tuition.service.ts`, `payment.service.ts` giống hệt main → logic AS (`status.inProgress` theo ca cuối, `anchorMonth(..., inProgress)`) còn nguyên. PASS.

| Lỗi | Kiểm lại | Kết quả |
|-----|----------|---------|
| QA-1 | `TuitionNoticeDialog.tsx:128-132`: cleanup unmount gọi `saveComment()` qua ref, chỉ khi đã sửa ô; dùng `mutate` của hook (TanStack Query v5 vẫn chạy mutation + callback sau unmount). Blur đã gửi cùng nội dung thì không gửi lại (`sentComment`). Test `[BUG QA-1]` xanh | PASS |
| QA-2 | Đo thật trong Chrome (dựng lại đúng class, **font Geist thật** của app nạp từ `src/app/fonts/GeistVF.woff`): mobile 360px, vi/en × có/chưa link × có/không Chia sẻ (8 ca) → **2 hàng, rộng 360px, không tràn, không cắt chữ**, kể cả ca có Chia sẻ + HS đã có link | PASS (mobile) |
| QA-3 | `:119-125` so với `sentComment ?? savedComment`; test `[QA-3]` xanh | PASS |
| QA-4 | `:161-166` `query.isError` khi đang chờ xuất → huỷ lệnh, mở khoá, báo lỗi; test `[QA-4]` xanh | PASS |

**Lỗi mới — QA-5 (Trung bình, desktop):** `src/components/tuition/TuitionNoticeDialog.tsx:246` footer `md:flex-nowrap md:justify-end` nằm trong `DialogContent ... overflow-hidden sm:max-w-[460px]` (`:322`). Trên desktop **có nút Chia sẻ** khi `canShareFiles()` = true. Đã kiểm thật: Chrome 156 Windows trên máy này trả `true` (Safari macOS cũng chia sẻ file được). Đo với font Geist, khung 460px:
- vi, HS đã có link + Chia sẻ + Tải ảnh: **484px** → tràn 24px.
- en, đã có link: **513px**; en, chưa có link: **465px** → tràn.
- Không có Chia sẻ: 363px / 401px, vừa.

Vì `justify-end` + `overflow-hidden`, phần tràn bị cắt ở **mép trái**, tức là chính nút "Link phụ huynh" bị cắt. Trước AT footer desktop chỉ có Chia sẻ + Tải ảnh nên không bị. Tái hiện: Chrome Windows, màn ≥768px, mở Phiếu báo của HS đã có link phụ huynh → nút "Link phụ huynh" bị cắt mép trái. Gợi ý: bỏ `md:flex-nowrap` (desktop cũng được xuống dòng khi thiếu chỗ) hoặc nới `sm:max-w` của hộp.

**Kết luận vòng 2: KHÔNG ĐẠT.** QA-1..QA-4 đã sửa đúng, mobile 360px hết tràn, merge main không làm hỏng logic AS. Còn QA-5 (footer desktop tràn khi trình duyệt chia sẻ được file, cắt nút Link phụ huynh). Sửa 1 dòng class rồi QA đo lại là xong.

### Vòng 3 QA (kiểm lại QA-5, DEV vòng 4 `b14c8d7`; HEAD `8c425e1`)

**Diff `b14c8d7` (src):** chỉ `TuitionNoticeDialog.tsx` footer: bỏ `md:flex-nowrap` ở hộp ngoài, cụm link đổi `md:w-auto` → `md:justify-end` (giữ `w-full`). Mobile không đổi (chỉ lớp `md:` thay đổi). Không đụng logic.

**Đo thật** (Chrome 156 Windows, dựng lại đúng class sau sửa, font Geist thật của app; `contentW` = hàng rộng nhất + padding 2×16):

| Khung | vi có link + Chia sẻ | vi có link, không Chia sẻ | vi chưa link + Chia sẻ | vi chưa link, không Chia sẻ | en có link + Chia sẻ | en có link, không Chia sẻ | en chưa link + Chia sẻ | en chưa link, không Chia sẻ |
|---|---|---|---|---|---|---|---|---|
| Desktop 460px (2 hàng, canh phải) | 263 | 245 | 263 | 197 | 320 | 217 | 320 | 208 |
| Mobile 360px (2 hàng) | 360 | 360 | 360 | 360 | 360 | 360 | 360 | 360 |

16/16 ca: 2 hàng, không tràn, không cắt chữ. Desktop rộng nhất 320px < 460px (trước sửa 484–513px).

**Test:** vitest config tạm cho `tests/unit/components/TuitionNoticeDialog*` (không nối DB): **3 file / 31 test pass, 0 fail**. Không chạy integration / `pnpm test` / migrate.

**Kết luận vòng 3: ĐẠT.** QA-1..QA-5 đã sửa và kiểm lại. Còn treo ngoài phạm vi QA: integration (LEADER chạy), ảnh `tests/guide-shots` + `pnpm guide:docx`, kiểm ảnh html2canvas / trang `/p` trên app thật.

---

## 4. Trao đổi

- [DEV → LEADER] Vị trí mục NHẬN XÉT: đặt sau khối tiền (tổng / đã đóng / còn lại), ngay trước QR — vẫn đúng "sau Ngày học, trước QR". Không chèn ngay dưới dòng "Ngày học" để khỏi tách phần ngày học với khối tiền. Muốn sát "Ngày học" như mẫu cô Quỳnh thì chỉ cần dời 1 khối trong `TuitionNoticeCard.tsx`.
- [DEV → LEADER] Làm thêm ngoài đề: mã hoá cột `parentComment` (thêm vào `ENCRYPTED_FIELDS` + `FIELD_TARGETS`) vì đây là văn bản tự do về học sinh, cùng loại với `MonthlyTuition.notes` đang mã hoá theo spec O; test DMMF / backfill yêu cầu 2 danh sách khớp nhau. Cột mới nên không cần backfill.
- [DEV → LEADER] Nút link PH đặt ở footer hộp phiếu (đúng yêu cầu), không đặt ở menu từng dòng.
- [DEV → LEADER] Chưa làm quy tắc coding-rule "Hướng dẫn đi cùng tính năng" (guide-content, ảnh guide, tours, releases "Có gì mới") vì đề AT không giao. Cần trước khi phát hành thì giao thêm.
- [DEV → LEADER] Bản sao lưu Excel (`backup.service.ts`) chưa xuất cột nhận xét tháng; ngoài phạm vi, ghi lại để cân nhắc.
- [DEV → LEADER] Nhận xét lưu bằng nút "Lưu nhận xét" (không tự lưu). Gõ mà chưa Lưu rồi tải ảnh thì ảnh chưa có nhận xét mới.
- [QA → DEV] QA-1: thêm lưu-khi-unmount như `TuitionDetailSheet.tsx:165-180` (đọc ref nội dung + bản đã gửi, gọi `utils.client.tuition.saveParentComment.mutate`). Sửa xong đổi `it.fails` ca `[BUG QA-1]` trong `tests/unit/components/TuitionNoticeDialogAT.qa.test.tsx` thành `it`.
- [QA → DEV] QA-2: footer hộp phiếu tràn ở 360px khi có nút Chia sẻ (đo 423–475px). Đề nghị chia 2 hàng trên mobile.
- [QA → LEADER] Integration chưa chạy (theo lệnh không đụng 5433); nhờ LEADER chạy 5 file liệt kê ở mục 3 sau khi áp migration lên DB test.
- [DEV → QA] QA-1: đã sửa — lưu khi unmount qua ref. Dùng `mutate` của hook (không dùng `utils.client`) để ca `[BUG QA-1]` giữ nguyên assert `saveMutate`; mutation vẫn chạy sau unmount, TRPCProvider vẫn invalidate. Ca đã đổi `it.fails` → `it`, xanh.
- [DEV → QA] QA-2: đã sửa — mobile 2 hàng (cụm link phụ huynh 1 hàng riêng, nút ảnh hàng dưới), desktop 1 hàng. Nhờ đo lại bề rộng thật ở 360px (có/không nút Chia sẻ, có/không link).
- [DEV → QA] QA-3: đã sửa (gọn) — so với bản đang gửi `sentComment ?? savedComment`.
- [DEV → QA] QA-4: đã sửa — tải lại phiếu lỗi khi đang chờ xuất → huỷ lệnh, mở khoá nút, báo lỗi.
- [QA → DEV] Vòng 2: QA-1..QA-4 PASS, mobile 360px không tràn (8 ca đo thật). Lỗi mới QA-5: footer desktop (hộp 460px) tràn 5–53px khi có nút Chia sẻ (Chrome Windows có `canShareFiles()` = true), cắt nút "Link phụ huynh" ở mép trái. Đề nghị bỏ `md:flex-nowrap` ở `TuitionNoticeDialog.tsx:246` hoặc nới bề rộng hộp.
- [QA → LEADER] Vòng 3: QA-5 đã sửa (`b14c8d7`), đo thật 16 ca desktop 460px / mobile 360px đều không tràn. Kết luận ĐẠT; còn chờ LEADER chạy integration.

---

## 5. LEADER — Kết luận


[LEADER → DEV] Trả lời 5 điểm:
1. Vị trí NHẬN XÉT: giữ nguyên (sau khối tiền, trước QR). Phiếu mình đã để "Ngày học" ở trên, nên thứ tự vẫn khớp mẫu: tiền → nhận xét → QR.
2. Mã hoá `parentComment`: ĐỒNG Ý giữ, cho nhất quán với `notes` (spec O).
3. Hướng dẫn đi kèm: BẮT BUỘC theo coding-rule. Làm `guide-content.ts` + `releases.ts` ("Có gì mới"). Tour chỉ thêm nếu thao tác nhiều bước (viết nhận xét → lưu → gửi phiếu thì đủ ngắn, tuỳ DEV, ghi lý do). Ảnh `tests/guide-shots` + `pnpm guide:docx` cần app + DB: nếu không chạy được thì ghi rõ là việc còn treo, không bịa.
4. Backup Excel: THÊM cột nhận xét tháng nếu backup đang xuất `notes` của MonthlyTuition (không để mất dữ liệu khi khôi phục). Nếu có import/restore thì đọc lại được cột này.
5. Không để mất nhận xét: tự lưu khi rời ô (blur) như ô Ghi chú ở `TuitionDetailSheet`. Khi bấm tải ảnh/gửi/chia sẻ phiếu mà còn nhận xét chưa lưu thì lưu trước rồi mới xuất. Giữ nút Lưu cũng được.
