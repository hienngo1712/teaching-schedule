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

---

## 3. QA — Báo cáo

---

## 4. Trao đổi

- [DEV → LEADER] Vị trí mục NHẬN XÉT: đặt sau khối tiền (tổng / đã đóng / còn lại), ngay trước QR — vẫn đúng "sau Ngày học, trước QR". Không chèn ngay dưới dòng "Ngày học" để khỏi tách phần ngày học với khối tiền. Muốn sát "Ngày học" như mẫu cô Quỳnh thì chỉ cần dời 1 khối trong `TuitionNoticeCard.tsx`.
- [DEV → LEADER] Làm thêm ngoài đề: mã hoá cột `parentComment` (thêm vào `ENCRYPTED_FIELDS` + `FIELD_TARGETS`) vì đây là văn bản tự do về học sinh, cùng loại với `MonthlyTuition.notes` đang mã hoá theo spec O; test DMMF / backfill yêu cầu 2 danh sách khớp nhau. Cột mới nên không cần backfill.
- [DEV → LEADER] Nút link PH đặt ở footer hộp phiếu (đúng yêu cầu), không đặt ở menu từng dòng.
- [DEV → LEADER] Chưa làm quy tắc coding-rule "Hướng dẫn đi cùng tính năng" (guide-content, ảnh guide, tours, releases "Có gì mới") vì đề AT không giao. Cần trước khi phát hành thì giao thêm.
- [DEV → LEADER] Bản sao lưu Excel (`backup.service.ts`) chưa xuất cột nhận xét tháng; ngoài phạm vi, ghi lại để cân nhắc.
- [DEV → LEADER] Nhận xét lưu bằng nút "Lưu nhận xét" (không tự lưu). Gõ mà chưa Lưu rồi tải ảnh thì ảnh chưa có nhận xét mới.

---

## 5. LEADER — Kết luận


[LEADER → DEV] Trả lời 5 điểm:
1. Vị trí NHẬN XÉT: giữ nguyên (sau khối tiền, trước QR). Phiếu mình đã để "Ngày học" ở trên, nên thứ tự vẫn khớp mẫu: tiền → nhận xét → QR.
2. Mã hoá `parentComment`: ĐỒNG Ý giữ, cho nhất quán với `notes` (spec O).
3. Hướng dẫn đi kèm: BẮT BUỘC theo coding-rule. Làm `guide-content.ts` + `releases.ts` ("Có gì mới"). Tour chỉ thêm nếu thao tác nhiều bước (viết nhận xét → lưu → gửi phiếu thì đủ ngắn, tuỳ DEV, ghi lý do). Ảnh `tests/guide-shots` + `pnpm guide:docx` cần app + DB: nếu không chạy được thì ghi rõ là việc còn treo, không bịa.
4. Backup Excel: THÊM cột nhận xét tháng nếu backup đang xuất `notes` của MonthlyTuition (không để mất dữ liệu khi khôi phục). Nếu có import/restore thì đọc lại được cột này.
5. Không để mất nhận xét: tự lưu khi rời ô (blur) như ô Ghi chú ở `TuitionDetailSheet`. Khi bấm tải ảnh/gửi/chia sẻ phiếu mà còn nhận xét chưa lưu thì lưu trước rồi mới xuất. Giữ nút Lưu cũng được.
