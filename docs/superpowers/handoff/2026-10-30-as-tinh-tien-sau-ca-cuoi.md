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

- Sửa L1 (theo quyết định LEADER): `TuitionDetailSheet.tsx` `lastDone = keyToYearMonth(Math.min(monthKey(year, month) - 1, monthKey(today.year, today.month)))`; thêm test "xem tháng 11 khi hôm nay tháng 10 → Sang tháng 10" trong `TuitionDetailSheetReviewFix.test.tsx` (đỏ trên code cũ, xanh sau sửa). 9 file test sheet học phí/tuition/payment liên quan: 81/81 PASS (config không DB); `tsc` 0 lỗi; lint 0 errors, 2 warnings có sẵn ở `_plans.js`. L2–L5 không sửa.

---

## 3. QA — Báo cáo

_(QA ghi: danh sách ca kiểm thử, kết quả PASS/FAIL, lỗi tìm thấy kèm bước tái hiện, kết luận)_

QA kiểm trên `a94eaf5` (code `be375da`). Không chạy lệnh DB nào, không đụng container Docker nào.

### A. Review code (đối chiếu yêu cầu mục 1)
| # | Điểm kiểm | Kết quả |
|---|---|---|
| R1 | Ghép mốc `sessionDate + (endTime % 86 400 000) − 7h` khớp cách lưu (`parseTimeToDate` đặt giờ VN trên 1970-01-01 UTC, `@db.Date` 0h UTC) | PASS |
| R2 | Ca qua nửa đêm: `src/lib/schemas/session.ts:18,36,71` bắt `endTime > startTime` khi tạo/sửa → không tồn tại, điểm 6 của DEV không phải rủi ro thực | PASS |
| R3 | Ca huỷ/xoá: màn Học phí lọc ở truy vấn (`tuition.service.ts` `status not cancelled, isDeleted false`), `recordPayment` lọc trong `lastSessionEnd` → cùng kết quả | PASS |
| R4 | Phạm vi ca giống nhau giữa màn Học phí và ghi tiền: cùng `userId`, cùng khoảng tháng, không lọc theo nơi dạy ở cả 2 (`placeId` chỉ lọc HS) → nhất quán | PASS |
| R5 | Quyền: truy vấn mới trong `recordPayment` có `userId`; `ensureMonthlyTuition` vẫn kiểm quyền ngay sau | PASS |
| R6 | Phiếu báo / link PH (`parent-link.service.ts:143`) / QR payOS dùng chung `status.inProgress` của dòng HS → không lệch | PASS |
| R7 | Webhook payOS (`tuition-payos-webhook.service.ts:35`) ghi theo tháng neo đã lưu trong `tuition_pay_links`, không tự tính lại → không bị ảnh hưởng | PASS |
| R8 | Grep `isInProgressMonth`/`vnDateParts`/`monthKey(`/`inProgress`/`tuition_viewing_current` trong `src/`: không còn chỗ gọi kiểu cũ; client (nút Thu đủ `page.tsx:135`, `TuitionDetailSheet.tsx:270,358`, `TuitionNoticeCard`) đều dựa `inProgress` từ server | PASS (xem L1, L2) |
| R9 | Integration test DEV sửa (`tuition-in-progress`): ca thêm 23:00–23:59 để `attendance` mặc định `pending`, `fee` 0 → không làm đổi `totalExpected` 300k | PASS (đọc code, chưa chạy) |

### B. Test bổ sung của QA
File mới `tests/unit/lib/tuition-in-progress-edges.test.ts` (10 ca, đều PASS):
- đúng 18:30:00.000 VN → xong; 18:29:59.999 → đang học
- ca 23:59 ngày cuối tháng: 23:58:59 đang học, 23:59 xong, 0:00 ngày 1 → tháng quá khứ
- tháng 12 → 1: ca 31/12 22:00 VN; sang 1/1 VN tháng 12 là quá khứ, tháng 1 (không ca) đang học
- nhiều ca cùng ngày, thứ tự lộn xộn → lấy ca kết thúc muộn nhất
- ca huỷ / đã xoá nằm sau ca cuối thật (cùng ngày và ngày sau) bị bỏ qua
- ca `completed` vẫn tính
- `anchorMonth(2027, 1, true)` → 12/2026; `false` → giữ 1/2027
- `recordPayment` tháng 12: truy vấn đúng `userId`, `studentId`, khoảng `[1/12/2026, 1/1/2027)`, ca cuối xong → cho ghi
- `recordPayment` tháng quá khứ không ca → cho ghi; tháng tương lai → luôn chặn

### C. Kết quả chạy (số liệu thật, máy local 30/10/2026)
- Unit test, config tạm không nạp `tests/env-setup.ts` + `tests/setup.ts` (không nối DB): **186 file, 1293/1294 test PASS**. Ca đỏ duy nhất `tests/unit/lib/db-cleanup.test.ts` (`Thiếu DATA_ENCRYPTION_KEYS`); chạy lại riêng file này với `DATA_ENCRYPTION_KEYS*` lấy từ `.env.test` → **1/1 PASS** ⇒ lỗi môi trường, không phải hồi quy.
- 3 file test liên quan AS (`tuition-display`, `payment-record-in-progress`, `tuition-in-progress-edges`): **25/25 PASS**.
- `npx tsc --noEmit`: exit 0, **0 lỗi**.
- `pnpm lint`: **0 errors, 2 warnings** (cả 2 ở `_plans.js`, có sẵn).
- **CHƯA CHẠY** (thiếu DB test 5433): `pnpm test:unit` nguyên bản và toàn bộ `pnpm test:integration`, đặc biệt `tests/integration/tuition-in-progress.test.ts`, `tuition-paylink.test.ts`, `payment-batch*`, `tuition-payos-webhook*`. Kịch bản 2 HS cùng tháng (điểm 3 của DEV) và thêm ca mới sau khi xong (điểm 5) chỉ kiểm bằng đọc code, chưa chạy end-to-end.

### D. Lỗi / quan sát (không có lỗi chặn)
- **L1 — Thấp (UX):** `src/components/tuition/TuitionDetailSheet.tsx:186-187, 360-363` — `lastDone` luôn là tháng trước tháng hiện tại theo lịch. Tái hiện: hôm nay 30/10, HS A đã xong ca cuối tháng 10; mở Học phí tháng **11** (tương lai) → sheet báo "ghi ở tháng 9" và nút "Sang tháng 9", trong khi tháng 10 đã ghi được. Trước AS không lệch vì tháng 10 khi đó cũng đang học. Gợi ý: nếu sửa thì dùng tháng hiện tại khi tháng hiện tại của HS đã xong (cần thêm dữ liệu từ server) — hoặc LEADER chấp nhận.
- **L2 — Thấp (UX):** `src/app/(app)/tuition/page.tsx:247, 355` — `anyInProgress` chỉ xét `items` của **trang đang xem** nên dòng "Tháng đang học…" có thể hiện ở trang 1 mà không hiện ở trang 2 cùng tháng. Chấp nhận được vì nội dung dòng chữ đúng với các dòng trên trang.
- **L3 — Thông tin:** `inProgress` tính lúc truy vấn; nếu màn Học phí mở sẵn qua mốc 18:30 thì nút "Thu đủ" chỉ hiện sau khi dữ liệu được tải lại (đổi tab/focus). Server đã cho ghi đúng mốc.
- **L4 — Thông tin (có sẵn từ trước, ngoài phạm vi):** `createPayment` (`src/server/services/payment.service.ts:262`, router `payment.ts:29`) không có chặn tháng đang học, cả trên `main`. Không do AS gây ra.
- **L5 — Thông tin:** phiếu báo đã gửi giữa tháng (chỉ gồm nợ cũ) → sau ca cuối, `remaining` cộng đủ tiền tháng nên `noticeStatus` chuyển `changed` (gợi ý gửi lại). Đúng ý đồ, nêu để LEADER biết.
- **L6 — Thông tin:** `isInProgressMonth` không kiểm `lastEnd` có thuộc tháng đang xét; mọi chỗ gọi hiện đều lọc ca theo đúng tháng nên không ảnh hưởng.

### E. Kết luận
**ĐẠT CÓ ĐIỀU KIỆN** — logic đúng yêu cầu, unit/tsc/lint sạch. Điều kiện: chạy `pnpm test:unit` + `pnpm test:integration` nguyên bản khi có DB test 5433 trước khi merge; LEADER quyết L1 (sửa hay chấp nhận).

---

## 4. Trao đổi

[DEV → LEADER] Không chạy được test có DB: `tests/setup.ts` (setupFiles, chạy cho cả `tests/unit`) cần Postgres test ở `localhost:5433` (container Docker `student-test-pg`). Docker Desktop đang tắt; tôi đã bật Docker Desktop, nhưng khi bật thì container của project khác `barber-shop-db` tự khởi động và chiếm cổng 5433 nên `student-test-pg` không start được. Tôi định `docker stop barber-shop-db` nhưng bị hệ thống quyền từ chối (đụng workload khác) nên dừng lại. Đã kiểm tra `barber-shop-db` chỉ có DB `barber_dev`/`barber_test`, không có `student_test` → test không thể xoá nhầm dữ liệu của nó. Cần user/LEADER quyết: dừng `barber-shop-db` rồi `docker start student-test-pg` để QA chạy `pnpm test:unit` + `pnpm test:integration`. Lưu ý thêm: Docker Desktop vẫn đang bật cùng các container tự khởi động (`barber-shop-db`, `postgresnodocker`, `redis`, `adminernodocker`).

[DEV → LEADER] Lệch nhỏ so với gợi ý: `isInProgressMonth` đổi chữ ký thành `(year, month, lastEnd, now?)` với `lastEnd` bắt buộc; `anchorMonth` nhận cờ `inProgress` thay vì tự tính. Lý do: phiếu báo/QR dùng đúng cờ của dòng HS từ `getMonthlyTuitionStatus`, tránh truy vấn lặp và tránh lệch giữa các chỗ.

[QA → DEV] L1: khi xem tháng tương lai, sheet học phí gợi ý "ghi ở tháng {lastDone}" = tháng trước tháng hiện tại, dù tháng hiện tại của HS đã xong ca cuối. Có muốn trả thêm cờ/tháng gợi ý từ server, hay để nguyên?

[DEV → QA] Trả lời L1: không trả thêm cờ từ server. LEADER chốt `lastDone = min(tháng đang xem − 1, tháng hiện tại)`: xem T11 khi T10 đã xong → gợi ý T10; xem T10 đang học → T9. Nếu xem T11 mà T10 của HS chưa xong thì giáo viên sang T10 sẽ thấy gợi ý T9 (LEADER chấp nhận). Đã sửa, xem mục 2.

[QA → LEADER] Integration test (`tuition-in-progress`, `tuition-paylink`, `payment-batch`, `tuition-payos-webhook`) vẫn chưa chạy được vì cổng 5433. Cần user dừng `barber-shop-db` + start `student-test-pg` rồi chạy lại trước khi merge.

---

## 5. LEADER — Kết luận

