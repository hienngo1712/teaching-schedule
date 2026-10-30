# Handoff AS — Tính tiền học ngay sau ca cuối của tháng

Nhánh: `feat/as-tinh-tien-sau-ca-cuoi` · Vai: **LEADER** (giao việc, duyệt) · **DEV** (code) · **QA** (kiểm thử)

Quy ước: mỗi vai chỉ ghi vào mục của mình, ghi thêm ở cuối mục (không xoá của người khác). Câu hỏi cho vai khác ghi ở mục **Trao đổi**, ghi rõ `[DEV → LEADER]`...

---

## 1. LEADER — Yêu cầu

### Bối cảnh
Hiện tại tháng hiện hành luôn bị coi là "đang học" (`isInProgressMonth` ở `src/lib/tuition-display.ts` chỉ so tháng/năm). Hệ quả: dạy xong ca cuối ngày 28/10 nhưng phải chờ tới 1/11 mới ghi được tiền học tháng 10.

### Yêu cầu của user
Tháng được tính tiền **ngay sau khi kết thúc ca cuối cùng của tháng đó**. Ví dụ ca cuối 28/10 17:00–18:30 → từ 18:30 ngày 28/10 (giờ VN) là tính tiền tháng 10 được.

### Quyết định của LEADER (giả định đã chốt)
1. **Ca cuối tính theo từng học sinh**: ca `TeachingSession` cuối cùng trong tháng mà HS đó có mặt trong danh sách (attendance), `status != cancelled`, `isDeleted = false`. Mốc = `sessionDate` + `endTime`, so theo giờ VN.
2. **Tháng quá khứ** → luôn "đã xong" (giữ nguyên). **Tháng tương lai** → luôn "đang học" (giữ nguyên).
3. **Tháng hiện tại mà HS không có ca nào** → giữ hành vi cũ (đang học tới hết tháng). Không tự ý đổi.
4. Nếu sau khi "đã xong" giáo viên thêm ca mới vào cuối tháng → tháng lại thành "đang học" tới hết ca mới đó. Chấp nhận, không cần xử lý thêm.
5. Áp dụng cho mọi chỗ đang dùng `isInProgressMonth`, gồm:
   - `src/server/services/payment.service.ts` (chặn ghi tiền — `recordPayment`)
   - `src/server/services/tuition.service.ts` (cờ `inProgress` → tạm tính / `dueNow`)
   - `src/server/services/tuition-notice.service.ts` (phiếu báo học phí)
   - `src/server/services/tuition-paylink.service.ts` (`anchorMonth` — tháng neo QR payOS)
   - `src/app/(app)/tuition/page.tsx` (`isCurrentOrFuture` phía UI) — DEV kiểm xem UI dùng biến này để làm gì; nếu là chặn nút ghi tiền thì phải dựa theo `inProgress` từng dòng từ server thay vì chỉ tháng.
6. Không đổi schema DB, không migration.

### Tiêu chí hoàn thành
- Unit test cho hàm quyết định "tháng đã xong chưa" phủ: tháng quá khứ; tháng tương lai; tháng hiện tại trước giờ kết thúc ca cuối (vd 28/10 18:29 VN) → đang học; đúng/sau giờ kết thúc (18:30) → đã xong; ca huỷ/đã xoá bị bỏ qua; HS không có ca → đang học; ranh giới múi giờ (ca tối VN mà UTC đã sang ngày khác).
- `recordPayment` cho ghi tiền tháng hiện tại khi ca cuối của HS đã kết thúc, vẫn chặn khi chưa.
- `pnpm lint`, `pnpm test:unit` xanh; `npx tsc --noEmit` không lỗi mới.
- Integration test chỉ chạy theo đúng `docs/coding-rule.md` §6.1 (`.env.test` khác `.env`). Lỗi `Test timed out in 5000ms` là do Neon chậm — so baseline với `main` trước khi kết luận.

### Quy tắc bắt buộc
- Đọc `docs/CLAUDE.md` + `docs/coding-rule.md` trước khi code. TUYỆT ĐỐI không chạy lệnh DB lên `.env` production.
- Code tối giản, sửa đúng phạm vi, theo style sẵn có.
- Commit trên nhánh `feat/as-tinh-tien-sau-ca-cuoi`, message 1 dòng `[AS] ...`, không body, không Co-Authored-By. Không push, không merge.

---

## 2. DEV — Báo cáo

_(DEV ghi: các file đã sửa, cách làm, commit hash, kết quả lint/test, điểm cần QA chú ý)_

Commit code + test: `be375da` (nhánh `feat/as-tinh-tien-sau-ca-cuoi`, chưa push/merge).

### Cách làm
- `src/lib/tuition-display.ts`:
  - Thêm hàm thuần `lastSessionEnd(sessions)`: bỏ ca `cancelled`/`isDeleted`, trả mốc kết thúc muộn nhất (Date UTC) hoặc `null`. Ghép mốc: `sessionDate` (@db.Date, đọc ra 0h UTC của ngày VN) + phần giờ của `endTime` (@db.Time(0), đọc ra giờ VN trên ngày 1970-01-01 UTC) − 7h. Cách lưu này khớp `parseTimeToDate`/`formatTime`/`formatDate` trong `src/lib/utils.ts`.
  - `isInProgressMonth(year, month, lastEnd, now?)`: tháng quá khứ → `false`, tương lai → `true` (giữ nguyên); tháng hiện tại → `lastEnd === null || now < lastEnd`. Tham số `lastEnd` để **bắt buộc** (không mặc định) để mọi chỗ gọi phải truyền mốc ca cuối, không lọt chỗ nào còn hành vi cũ.
- `tuition.service.ts`: tính `inProgress` theo từng HS từ `currentAttendance` đã truy vấn sẵn (đã lọc userId, tháng, không huỷ, không xoá, `include: { session: true }` có sẵn `endTime`) → **không thêm truy vấn nào**, không N+1.
- `payment.service.ts` (`recordPayment`): thêm 1 truy vấn `teachingSession.findMany` (ca của HS trong tháng, theo userId) rồi dùng `lastSessionEnd` để quyết định chặn.
- `tuition-notice.service.ts`: dùng luôn `status.inProgress` của dòng HS (từ `getMonthlyTuitionStatus`) thay vì tự tính lại.
- `tuition-paylink.service.ts`: `anchorMonth(year, month, inProgress)` nhận cờ của HS; `ensureTuitionPayLink` nhận `notice.inProgress` (phiếu báo truyền xuống).
- `src/app/(app)/tuition/page.tsx`: `isCurrentOrFuture` **chỉ dùng để hiện dòng chữ** "Tháng đang học: tiền buổi chỉ tạm tính." (không chặn nút; nút ghi tiền ở `page.tsx` dòng 135 và `TuitionDetailSheet` đã dựa `item.inProgress` từ server). Đổi thành `anyInProgress = items.some((i) => i.inProgress)`.
- Không đổi schema, không migration.

### File đã sửa
- `src/lib/tuition-display.ts`, `src/server/services/payment.service.ts`, `src/server/services/tuition.service.ts`, `src/server/services/tuition-notice.service.ts`, `src/server/services/tuition-paylink.service.ts`, `src/app/(app)/tuition/page.tsx`
- Test: `tests/unit/lib/tuition-display.test.ts` (sửa test cũ + thêm 4 ca), `tests/unit/services/payment-record-in-progress.test.ts` (mới, db giả + `vi.useFakeTimers({ toFake: ["Date"] })`), `tests/integration/tuition-paylink.test.ts` (chữ ký `anchorMonth` mới), `tests/integration/tuition-in-progress.test.ts` (thêm ca ngày cuối tháng 23:00–23:59 cho 2 HS để tháng hiện tại vẫn "đang học" — nếu không, hôm nay 30/10 các ca ngày 2/4/5/6 đã xong nên test cũ sẽ đỏ).

### Kết quả kiểm tra (số liệu thật)
- TDD: chạy 2 file test mới trên code cũ (stash phần src) → **7 failed / 8 passed**; trên code mới → **15/15 passed**.
- `npx tsc --noEmit`: **0 lỗi** (ban đầu báo lỗi `teachingPlace`/`placeId`... do Prisma client cũ; chạy `npx prisma generate` — chỉ sinh code, không đụng DB — xong thì sạch).
- `pnpm lint`: **0 errors, 2 warnings** (cả 2 ở `_plans.js`, có sẵn, không liên quan).
- Unit test: **KHÔNG chạy được `pnpm test:unit` nguyên bản** vì `tests/setup.ts` luôn nối DB test `localhost:5433` (xem Trao đổi). Thay vào đó chạy toàn bộ `tests/unit` bằng config tạm ở scratchpad **bỏ `tests/env-setup.ts` + `tests/setup.ts`** (không đụng DB nào): **184/185 file, 1283/1284 test pass**. Ca đỏ duy nhất `tests/unit/lib/db-cleanup.test.ts` báo `Thiếu DATA_ENCRYPTION_KEYS` — do config tạm không nạp `.env.test`, không liên quan thay đổi này.
- Integration test: **chưa chạy** (không có DB test, xem Trao đổi). Đã xác minh `.env.test` trỏ `localhost`, khác host Neon của `.env`. Không chạy bất kỳ lệnh migrate/reset/seed/db push nào.

### QA nên tập trung
1. Chạy `pnpm test:unit` và `pnpm test:integration` nguyên bản khi có DB test 5433 (đặc biệt `tuition-in-progress`, `tuition-paylink`, `payment-batch`, `tuition-payos-webhook`).
2. Ranh giới giờ: ca kết thúc 18:30 VN → 18:29 còn chặn, 18:30 cho ghi; ca tối 22:00–23:59 VN (UTC đã sang 15:00–16:59Z cùng ngày); HS có ca huỷ/xoá nằm sau ca cuối thật.
3. Cùng một tháng hiện tại, 2 HS: HS A đã xong ca cuối (ghi tiền được, dòng hết "tạm tính", phiếu báo tính đủ tiền tháng, QR payOS neo tháng hiện tại), HS B chưa xong/không có ca (vẫn chặn, neo tháng trước).
4. Dòng chữ "Tháng đang học..." ở màn Học phí: giờ chỉ hiện khi trang hiện tại có ít nhất 1 dòng `inProgress` (tháng tương lai không có HS nào → không hiện; trước đây vẫn hiện).
5. Thêm ca mới sau khi tháng đã "xong" → tháng lại thành đang học (quyết định 4 của LEADER).
6. Ca qua nửa đêm (endTime < startTime) không được xử lý riêng — mốc lấy theo ngày `sessionDate` + `endTime`; nếu app cho tạo loại ca này thì mốc sẽ sớm hơn thực tế 1 ngày.

---

## 3. QA — Báo cáo

_(QA ghi: danh sách ca kiểm thử, kết quả PASS/FAIL, lỗi tìm thấy kèm bước tái hiện, kết luận)_

---

## 4. Trao đổi

[DEV → LEADER] Không chạy được test có DB: `tests/setup.ts` (setupFiles, chạy cho cả `tests/unit`) cần Postgres test ở `localhost:5433` (container Docker `student-test-pg`). Docker Desktop đang tắt; tôi đã bật Docker Desktop, nhưng khi bật thì container của project khác `barber-shop-db` tự khởi động và chiếm cổng 5433 nên `student-test-pg` không start được. Tôi định `docker stop barber-shop-db` nhưng bị hệ thống quyền từ chối (đụng workload khác) nên dừng lại. Đã kiểm tra `barber-shop-db` chỉ có DB `barber_dev`/`barber_test`, không có `student_test` → test không thể xoá nhầm dữ liệu của nó. Cần user/LEADER quyết: dừng `barber-shop-db` rồi `docker start student-test-pg` để QA chạy `pnpm test:unit` + `pnpm test:integration`. Lưu ý thêm: Docker Desktop vẫn đang bật cùng các container tự khởi động (`barber-shop-db`, `postgresnodocker`, `redis`, `adminernodocker`).

[DEV → LEADER] Lệch nhỏ so với gợi ý: `isInProgressMonth` đổi chữ ký thành `(year, month, lastEnd, now?)` với `lastEnd` bắt buộc; `anchorMonth` nhận cờ `inProgress` thay vì tự tính. Lý do: phiếu báo/QR dùng đúng cờ của dòng HS từ `getMonthlyTuitionStatus`, tránh truy vấn lặp và tránh lệch giữa các chỗ.

---

## 5. LEADER — Kết luận

