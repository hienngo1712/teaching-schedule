# B — Lịch sử thu tiền (bảng `Payment`)

> Phần B trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0. Không phụ thuộc phần nào. Là nền cho C, D, F, G (xem mục 11).

## 1. Bối cảnh

Hiện mỗi tháng học phí của 1 học sinh là 1 dòng `MonthlyTuition`. Tiền đã thu chỉ là **một con số** `paidAmount`, bị ghi đè mỗi lần bấm Lưu (`updateTuitionPayment` trong `src/server/services/tuition.service.ts`, mutation `tuition.updatePayment`). Hệ quả:

1. Phụ huynh đóng 2 lần trong tháng thì giáo viên phải tự cộng rồi nhập lại tổng. Không biết đã thu ngày nào, tiền mặt hay chuyển khoản.
2. Sửa/huỷ chỉ để lại dấu vết dạng chữ trong `notes` (`buildPaymentAuditNote` trong `src/lib/payment-notes.ts`, spec cũ `docs/superpowers/plans/2026-08-02-tuition-payment-edit-cancel.md`).
3. Phiếu báo (C), cảnh báo (D), sao lưu (F), link phụ huynh (G) đều cần danh sách từng lần thu, không chỉ tổng.

Các chỗ đang đọc `paidAmount` (phải giữ đúng số): `calcStudentTuition` (carry-over `totalAmountDue - paidAmount`), nhánh `historicalBalances` (`groupBy _sum paidAmount`), `getMonthlyOutstanding`, `getMonthlySummary.totalPaid` và `getDashboardStats.totalPaidMonth` (`report.service.ts`), `getTuitionBadgeStatus` (`src/lib/tuition-status.ts`), `StudentScheduleView.tsx`.

## 2. Mục tiêu và tiêu chí hoàn thành

Trên điện thoại (390px), trong sheet chi tiết học phí của 1 học sinh/tháng, giáo viên:

- Thêm 1 lần thu: số tiền, ngày thu (mặc định hôm nay giờ VN), hình thức (Tiền mặt / Chuyển khoản), ghi chú.
- Thấy danh sách các lần thu của tháng đó; sửa hoặc xoá từng lần.
- "Đã trả" của tháng = tổng các lần thu; badge, carry-over sang tháng sau, Dashboard, Báo cáo tự đúng theo.

Sau migration trên production: tổng `paidAmount` toàn bảng, mọi badge, "Còn nợ", "Đã thu" ở Báo cáo/Dashboard **không đổi 1 đồng** so với trước.

## 3. Quyết định đã chốt (người dùng)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Lưu từng lần thu | Bảng MỚI `Payment`: số tiền, ngày thu, hình thức (tiền mặt / chuyển khoản), ghi chú. Mỗi lần thu thuộc đúng 1 tháng học phí của 1 học sinh. |
| Q2 | "Đã trả" của tháng | = tổng các lần thu. Sửa / xoá từng lần. Bỏ ghi vết sửa/huỷ vào `notes` cho luồng mới. |
| Q3 | Dữ liệu cũ | Mỗi `MonthlyTuition` có `paidAmount > 0` → 1 `Payment` đúng số đó, ngày = `updatedAt`, tạo trong migration. Số liệu tổng không đổi. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Vấn đề | Chọn | Lý do |
|---|---|---|---|
| S1 | `paidAmount` | **Giữ làm cột tổng hợp**, service tính lại `= SUM(Payment.amount)` trong **cùng transaction** mỗi lần thêm/sửa/xoá. Không ai khác được ghi `paidAmount`. | Toàn bộ 7 chỗ đọc ở mục 1 (carry-over, lịch sử nợ, report, dashboard, badge) giữ nguyên, không phải viết lại query nào. Tính từ `Payment` mỗi lần đọc sẽ đụng vào `calcStudentTuition` và `groupBy` lịch sử — rủi ro cao nhất của app. Rủi ro lệch số được chặn bằng: 1 hàm duy nhất tính lại bằng `aggregate` (không cộng dồn), khoá dòng, và test bất biến. |
| S2 | `isFullPaid` | **Giữ nguyên nghĩa** "tất toán / miễn giảm phần còn lại" của tháng, độc lập với các lần thu. Xoá hết lần thu **không** tự bỏ tick. Đặt qua mutation MỚI `tuition.updateSettlement` (kèm `notes`). | Carry-over (`Math.min(0, residual)`) và badge `settled_waived` đang dựa vào nó; đây là quyết định nghiệp vụ, không suy ra từ tiền. |
| S3 | Auto-note "trả dư" | **Bỏ.** Không chèn chữ vào ghi chú nữa. | Badge `overpaid` đã hiện, sheet hiện dòng "Trả dư X" tính sẵn, tín dụng tự carry. Note tự chèn là thứ đã gây lỗi (spec 2026-08-02). |
| S4 | `totalPaid` Báo cáo / `totalPaidMonth` Dashboard | **Giữ theo tháng học phí** (tổng `paidAmount` của các tháng trong kỳ), không đổi sang theo ngày thu. | (a) Q3 lấy ngày = `updatedAt`, mà `updatedAt` bị đẩy lên mỗi lần snapshot tính lại → dòng tiền theo ngày của dữ liệu cũ sai và số Báo cáo cũ sẽ đổi, trái Q3. (b) Bộ lọc khối (`gradeMonthKeys`) chỉ đúng theo tháng học phí. (c) Không phải sửa report. Dòng tiền theo ngày thu để phần sau dùng `listPaymentsInRange` (mục 11) khi cần. |
| S5 | Hình thức của dữ liệu cũ | `cash`, ghi chú `"Chuyển từ dữ liệu cũ"`. | Không biết thật; ghi chú cho giáo viên biết để sửa nếu muốn. Không thêm giá trị "không rõ" vào enum. |
| S6 | Sửa 1 lần thu | Chỉ sửa số tiền, ngày, hình thức, ghi chú. **Không** chuyển sang tháng khác: xoá rồi thêm lại ở tháng đúng. | Chuyển tháng phải tính lại 2 dòng `MonthlyTuition`; hiếm dùng. |
| S7 | Hoàn tác trên toast, nút "Huỷ thanh toán", nút "Đóng tháng này" / "Đóng đủ nợ" | Bỏ. Xoá có hộp xác nhận; form thu tiền có 1 nút điền nhanh "Số còn lại". | Mỗi lần thu là 1 dòng, xoá nhầm thì thêm lại; bớt trạng thái phức tạp. |
| S8 | Ngày thu | Kiểu `@db.Date` giống `sessionDate`; input `"YYYY-MM-DD"`; không chặn ngày tương lai. | Theo quy ước ngày sẵn có (`dateRegex` trong `src/lib/schemas/session.ts`, đọc/hiển thị theo UTC bằng `formatDate`). |

## 5. Phạm vi

### Trong phạm vi
- Model + migration `Payment` kèm chuyển dữ liệu cũ (mục 8).
- Service `payment.service.ts`, router `payment.*`, mutation `tuition.updateSettlement` (mục 7).
- Viết lại `TuitionDetailSheet.tsx`, thêm `PaymentFormDialog.tsx` (mục 6).
- Xoá `tuition.updatePayment`, `updateTuitionPayment`, `updatePaymentSchema`, `buildPaymentAuditNote`, `mergeOverpaidNote` và test của chúng.
- i18n, test (mục 9, 10).

### Ngoài phạm vi (YAGNI)
- Màn "Sổ thu" riêng liệt kê mọi lần thu theo ngày, lọc, xuất file (để D/F).
- Phiếu thu / biên nhận, VietQR (C), đối soát chuyển khoản tự động.
- Đổi cách tính `totalPaid` sang dòng tiền (S4). Không sửa `report.service.ts`.
- Xoá cột `paidAmount`, đổi `calcStudentTuition`, đổi `tuition-status.ts`.
- Dọn các dòng ghi vết cũ đã nằm trong `notes`: giữ nguyên chữ, không tách ra.

## 6. Giao diện

### 6.1 Trang `/tuition`
Không đổi: bảng/thẻ, badge, nút "Ghi nhận" (`record_payment`) mở sheet.

### 6.2 `TuitionDetailSheet` (viết lại phần thân, giữ khung Dialog desktop / Sheet mobile)
Từ trên xuống:

1. **Tiêu đề**: như cũ (tên HS, tháng).
2. **Bảng tính**: Nợ tháng trước, Học phí tháng (x/y buổi), **Tổng phải đóng** (như cũ), thêm:
   - **Đã trả**: `paidAmount`.
   - **Còn lại**: `max(0, totalAmountDue - paidAmount)`; nếu `paidAmount > max(0, totalAmountDue)` và `totalAmountDue > 0` thì dòng này đổi thành **Trả dư** `paidAmount - totalAmountDue` màu xanh. Nếu `isFullPaid` và còn thiếu: hiện "Miễn giảm" thay cho "Còn lại".
3. **Lịch sử thu tiền**: tiêu đề nhỏ + nút **Thu tiền** (icon `Plus`, `h-11 md:h-10`) bên phải.
   - Mỗi lần thu 1 dòng (`rounded-lg border p-3`): ngày `dd/mm/yyyy`, huy hiệu hình thức (Tiền mặt / Chuyển khoản), số tiền in đậm bên phải, ghi chú bên dưới (`line-clamp-2 text-slate-500`), nút ⋯ (`size-11 md:size-9`, `aria-label` = "Menu hành động") mở menu **Sửa** / **Xoá**.
   - Thứ tự: ngày thu mới nhất trước, cùng ngày thì `id` lớn trước.
   - Rỗng: "Chưa có lần thu nào". Đang tải: 2 skeleton dòng.
4. **Tất toán & ghi chú tháng**: ô tick `mark_fully_paid`, cảnh báo miễn giảm (`settled_waived_warning`, giữ như cũ, tính từ `paidAmount` thật), ô ghi chú tháng (`notes`). Nút **Lưu** ở footer chỉ bật khi 2 trường này đổi; gọi `tuition.updateSettlement`.

Bỏ khỏi sheet: ô nhập "Số tiền đã đóng", 2 nút điền nhanh, khối "Đang ghi nhận", nút "Huỷ thanh toán" và hộp xác nhận của nó, auto-note trả dư, toast Hoàn tác.

### 6.3 `PaymentFormDialog` (MỚI, `src/components/tuition/PaymentFormDialog.tsx`)
Dialog thêm/sửa 1 lần thu, mở chồng lên sheet.
- Tiêu đề: "Thu tiền tháng {m}/{y}" / "Sửa lần thu".
- **Số tiền** (`CurrencyInput`, bắt buộc > 0). Dưới ô: nút **Số còn lại** (điền `max(0, totalAmountDue - paidAmount)`, ẩn khi = 0; khi sửa thì cộng lại số cũ của chính lần đang sửa).
- **Ngày thu** (`Input type="date"`, mặc định hôm nay theo `vnDateParts()`).
- **Hình thức**: 2 nút bật/tắt cạnh nhau `h-11`, `aria-pressed`: Tiền mặt (mặc định) / Chuyển khoản.
- **Ghi chú** (tuỳ chọn, tối đa 500 ký tự).
- Nút **Lưu** (`w-full sm:w-auto`), **Huỷ**. Thành công → toast "Đã lưu lần thu {số tiền}", đóng dialog, invalidate `payment.list`, `tuition`, `report`.

### 6.4 Xoá
Menu **Xoá** → AlertDialog: "Xoá lần thu {số tiền} ngày {dd/mm/yyyy}? Số đã trả của tháng sẽ giảm tương ứng." Nút **Xoá** (đỏ) / **Huỷ**.

## 7. Backend

### 7.1 Schema zod (`src/lib/schemas/payment.ts`, MỚI)
- `PAYMENT_METHODS = ["cash", "transfer"] as const`.
- `paymentCreateSchema`: `studentId` (int dương), `year`, `month` (1–12), `amount` (int, ≥ 1), `paidAt` (`dateRegex`), `method` (enum), `note` (string ≤ 500, optional, nullable, trim; rỗng → null).
- `paymentUpdateSchema`: `{ id, data: { amount?, paidAt?, method?, note? } }`.
- `paymentListSchema`: `{ studentId, year, month }`. `paymentDeleteSchema`: `{ id }`.

`src/lib/schemas/tuition.ts`: xoá `updatePaymentSchema`/`UpdatePaymentInput`; thêm `updateSettlementSchema` = `{ studentId, year, month, isFullPaid: boolean, notes?: string | null }`.

### 7.2 `src/server/services/payment.service.ts` (MỚI)
- `syncPaidAmount(tx, monthlyTuitionId)`: `aggregate _sum amount` của các Payment thuộc tháng đó → `update MonthlyTuition.paidAmount`. **Hàm duy nhất được ghi `paidAmount`** (ngoài nhánh `create` với `paidAmount: 0` sẵn có trong `getMonthlyTuitionStatus`).
- `ensureMonthlyTuition(db, userId, studentId, year, month)`: kiểm quyền (`assertOwnership` với student), gọi `getMonthlyTuitionStatus(..., { studentId, year, month, status: "all", page: 1, limit: 1 })` để snapshot có carry-over đúng (giữ đúng lý do ở `updateTuitionPayment` cũ, test `tuition-payment-snapshot.test.ts`); nếu vẫn chưa có dòng (HS nghỉ, tháng không có ca) thì `upsert` dòng rỗng như code cũ. Trả `MonthlyTuition`.
- `createPayment`, `updatePayment`, `deletePayment`: trong `db.$transaction(async tx => …)`:
  1. Khoá dòng tháng: `SELECT id FROM monthly_tuition WHERE id = $1 FOR UPDATE` (`tx.$queryRaw`) — chống bấm Lưu 2 lần làm `SUM` đọc thiếu.
  2. Ghi Payment.
  3. `syncPaidAmount`.
  Kiểm quyền update/delete: Payment → `monthlyTuition.student.userId`; không khớp → `NOT_FOUND`.
- `listPayments(db, userId, { studentId, year, month })`: trả `PaymentDTO[]` (mục 11), rỗng nếu chưa có tháng.

`tuition.service.ts`: xoá `updateTuitionPayment` và import `buildPaymentAuditNote`; thêm `updateSettlement(db, userId, input)`: `ensureMonthlyTuition` rồi update `isFullPaid`, `notes`. Không ghi vết.

### 7.3 Router
- MỚI `src/server/trpc/routers/payment.ts`: `payment.list` (query), `payment.create`, `payment.update`, `payment.delete` (mutation), đều `protectedProcedure`. Đăng ký `payment: paymentRouter` trong `root.ts`.
- `tuition.ts`: xoá `updatePayment`, thêm `updateSettlement`. Giữ `getMonthlyStatus`, `getMonthlyStatusReadOnly`.

### 7.4 Giữ nguyên
`calcStudentTuition`, `getMonthlyTuitionStatus`, `getMonthlyOutstanding`, `report.service.ts`, `tuition-status.ts`, `TuitionStatusDTO`. `formatVnDate` giữ trong `payment-notes.ts` (C dùng cho ngày lập phiếu).

## 8. Dữ liệu và migration

### 8.1 Model (MỚI trong `prisma/schema.prisma`)
```prisma
model Payment {
  id               Int            @id @default(autoincrement())
  monthlyTuitionId Int            @map("monthly_tuition_id")
  amount           Int
  paidAt           DateTime       @map("paid_at") @db.Date
  method           String         @default("cash") @db.VarChar(10)
  note             String?        @db.Text
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")
  monthlyTuition   MonthlyTuition @relation(fields: [monthlyTuitionId], references: [id], onDelete: Cascade)

  @@index([monthlyTuitionId])
  @@index([paidAt])
  @@map("payments")
}
```
`MonthlyTuition` thêm `payments Payment[]`. Xoá học sinh → cascade xoá `MonthlyTuition` → cascade xoá `Payment` (đúng hành vi hiện tại với tiền đã thu).

### 8.2 Migration `prisma/migrations/<timestamp>_add_payments/migration.sql`
Sinh phần DDL bằng `prisma migrate dev --create-only` **trên DB test/dev**, rồi thêm tay cuối file:
```sql
-- Chuyển dữ liệu cũ: mỗi tháng đã trả > 0 thành 1 lần thu. updated_at lưu UTC → cộng 7h lấy ngày VN.
INSERT INTO "payments" ("monthly_tuition_id", "amount", "paid_at", "method", "note", "created_at", "updated_at")
SELECT "id", "paid_amount", ("updated_at" + INTERVAL '7 hours')::date, 'cash', 'Chuyển từ dữ liệu cũ',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "monthly_tuition" WHERE "paid_amount" > 0;
```
Chỉ thêm bảng và thêm dòng; không sửa/xoá cột nào → an toàn với `prisma migrate deploy`, không cần 2 bước. Cả file chạy trong 1 transaction của Prisma.

### 8.3 Kiểm tra số liệu
Trước khi deploy: tạo Neon branch "Branch from current", chạy migration trên branch đó trước. Truy vấn chỉ đọc, chạy trước và sau:
```sql
-- (A) trước: số tháng đã trả và tổng tiền
SELECT COUNT(*), COALESCE(SUM("paid_amount"),0) FROM "monthly_tuition" WHERE "paid_amount" > 0;
-- (B) sau: phải bằng đúng (A)
SELECT COUNT(*), COALESCE(SUM("amount"),0) FROM "payments";
-- (C) sau: bất biến paidAmount = tổng Payment, phải ra 0 dòng
SELECT mt."id", mt."paid_amount", COALESCE(SUM(p."amount"),0) AS s
FROM "monthly_tuition" mt LEFT JOIN "payments" p ON p."monthly_tuition_id" = mt."id"
GROUP BY mt."id" HAVING mt."paid_amount" <> COALESCE(SUM(p."amount"),0);
```
Thêm: ghi lại `report.monthlySummary` (totalPaid, totalOutstanding) của 2–3 kỳ và Dashboard trước deploy, so sau deploy phải giống hệt (cột `paidAmount` không bị động tới).

Khe hở khi deploy: bản cũ còn chạy trong lúc Vercel build, nếu có ai bấm Lưu ở bản cũ sau khi migration chạy thì dòng đó lệch. Không ghi học phí trong lúc deploy; chạy (C) sau deploy, dòng nào lệch thì thêm 1 lần thu bù phần chênh.

## 9. i18n

Thêm vào cả `vi.json` và `en.json` (số key bằng nhau). Dùng lại key sẵn có: `notes`, `edit`, `delete`, `cancel`, `save`, `mark_fully_paid`, `settled_waived_warning*`, `total_amount_due`, `record_payment`.

| Key | vi | en |
|---|---|---|
| `payment_history` | Lịch sử thu tiền | Payment history |
| `add_payment` | Thu tiền | Record payment |
| `add_payment_title` | Thu tiền tháng | Payment for |
| `edit_payment` | Sửa lần thu | Edit payment |
| `payment_amount` | Số tiền | Amount |
| `payment_date` | Ngày thu | Payment date |
| `payment_method` | Hình thức | Method |
| `method_cash` | Tiền mặt | Cash |
| `method_transfer` | Chuyển khoản | Bank transfer |
| `fill_remaining` | Số còn lại | Remaining amount |
| `paid_total` | Đã trả | Paid |
| `remaining` | Còn lại | Remaining |
| `overpaid_amount` | Trả dư | Overpaid |
| `waived` | Miễn giảm | Waived |
| `no_payments` | Chưa có lần thu nào | No payments yet |
| `payment_saved` | Đã lưu lần thu | Payment saved |
| `delete_payment_confirm` | Xoá lần thu {amount} ngày {date}? Số đã trả của tháng sẽ giảm tương ứng. | Delete the {amount} payment on {date}? The month's paid total will decrease. |
| `settlement_saved` | Đã lưu tất toán và ghi chú | Settlement and notes saved |

Xoá key không còn dùng sau khi viết lại sheet (grep trước khi xoá): `recorded_amount`, `cancel_payment*`, `undo`, `undo_success`, `overpaid_note_prefix`, `overpaid_note_suffix`, `pay_current_month`, `pay_full_debt`, `amount_paid`, `update_payment`, `confirm_payment`, `payment_saved_for_month`. Thông báo lỗi server giữ tiếng Việt.

## 10. Kiểm thử

### Integration
- MỚI `tests/integration/payment.test.ts`:
  - Thêm 2 lần thu (300k + 200k) → `getMonthlyStatus.paidAmount = 500000`; `payment.list` trả 2 dòng đúng thứ tự, `paidAt` dạng `YYYY-MM-DD`.
  - Sửa số tiền 1 lần → `paidAmount` đổi đúng; xoá → giảm đúng; xoá hết → 0, `isFullPaid` giữ nguyên.
  - Thu cho tháng chưa mở → snapshot có `previousBalance` đúng (tương đương test snapshot cũ).
  - Carry-over: thu thiếu tháng 7 → tháng 8 `previousBalance` đúng; thu dư → tín dụng âm sang tháng 8.
  - Gọi `create` song song 2 lần (`Promise.all`) → `paidAmount` = tổng cả 2.
  - Multi-tenant: user khác `list/update/delete` → `NOT_FOUND`; `create` cho HS của user khác → `NOT_FOUND`.
  - `amount: 0`, `paidAt: "2026-13-01"`, `method: "card"` → `BAD_REQUEST`.
  - Xoá học sinh → Payment của HS đó bị xoá theo.
  - Bất biến: sau mỗi thao tác, `paidAmount` = `SUM(amount)` (helper trong test).
- Sửa các test đang gọi `tuition.updatePayment` (`tuition.test.ts`, `tuition-fullpaid-settlement.test.ts`, `tuition-payment-cancel.test.ts`, `tuition-payment-snapshot.test.ts`, `tuition-report-consistency.test.ts`, `tuition-status-filter.test.ts`, `group-b-financial.test.ts`, `report.test.ts`): thay bằng `payment.create` (+ `tuition.updateSettlement` khi cần `isFullPaid`); giữ nguyên các `expect` về số. Bỏ 2 test ghi vết notes trong `tuition-payment-cancel.test.ts`; test "chuyển tiền nhầm tháng 7 sang 8" viết lại bằng xoá + thêm.
- `tests/setup.ts`: thêm `db.payment.deleteMany()` trước `db.student.deleteMany()` (cascade đã đủ, ghi rõ cho thứ tự FK).

### Unit
- `tests/unit/lib/payment-notes.test.ts`: bỏ phần `mergeOverpaidNote`, `buildPaymentAuditNote`; giữ `formatVnDate`.
- MỚI `tests/unit/schemas/payment.schema.test.ts`: `paymentCreateSchema` (amount ≥ 1, ngày sai dạng, note rỗng → null).

### E2E (`tests/e2e/tuition-payments.spec.ts`, MỚI, 390×844)
Tạo HS + ca có mặt tháng hiện tại → `/tuition` → Ghi nhận → Thu tiền 100.000 tiền mặt → thấy dòng + "Đã trả 100.000" → Thu tiền lần 2 bằng nút "Số còn lại", Chuyển khoản → badge đổi "Đã đóng đủ" → Sửa lần 1 thành 50.000 → Xoá lần 2 (xác nhận) → "Đã trả 50.000". Kiểm không tràn ngang, nút ≥ 44px.

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch. Test chỉ chạy trên `.env.test`; không chạy migration lên `.env` production ở local.

## 11. Interface cho các phần sau

| Tên | Loại | Dùng bởi |
|---|---|---|
| `Payment` (`id`, `monthlyTuitionId`, `amount`, `paidAt`, `method`, `note`, `createdAt`, `updatedAt`) | model | C, D, F, G |
| `PAYMENT_METHODS` (`"cash" \| "transfer"`) | hằng, `src/lib/schemas/payment.ts` | C, F, G |
| `PaymentDTO` = `{ id, amount, paidAt: "YYYY-MM-DD", method, note }` | type MỚI, `src/lib/types/models.ts` | C, G |
| `MonthlyTuition.paidAmount` | cột tổng hợp, luôn = `SUM(Payment.amount)`; **chỉ đọc** với mọi phần sau | C, D, G |
| `listPayments(db, userId, { studentId, year, month })` | service | C (liệt kê các lần đã thu trên phiếu), G |
| `listPaymentsInRange(db, userId, { from, to })` → `(PaymentDTO & { studentId, year, month })[]` theo `paidAt` | service MỚI, viết khi D/F cần (không làm trong B) | D (dòng tiền), F |
| `getMonthlyTuitionStatus(..., persist=false)` | service sẵn có: số phải đóng / đã trả / còn lại | C, D, G |
| `createPayment` / `syncPaidAmount` | service; phần nào tạo lần thu (vd. C đánh dấu đã nhận chuyển khoản) **bắt buộc** đi qua đây | C |

F xuất bảng `payments` nguyên dạng; khi nhập lại phải chạy `syncPaidAmount` cho mọi tháng.

## 12. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| `paidAmount` lệch tổng Payment | 1 hàm `syncPaidAmount` tính bằng `aggregate`, trong transaction, có khoá dòng; test bất biến; truy vấn (C) mục 8.3 |
| Ngày thu dữ liệu cũ không phải ngày thu thật (`updatedAt` bị snapshot đẩy lên) | Người dùng đã chấp nhận (Q3); ghi chú "Chuyển từ dữ liệu cũ"; không dùng ngày này cho số Báo cáo (S4) |
| Migration lỗi giữa chừng trên production | Chỉ thêm bảng + INSERT, chạy trong transaction; thử trước trên Neon branch; so số (A)/(B) |
| Bỏ nút "Đóng đủ nợ" (vốn đồng thời tick tất toán) làm giáo viên quen tay bị hụt | Nút "Số còn lại" trong form thu tiền; tick tất toán vẫn ở sheet |
| Viết lại 8 file test làm mất độ phủ carry-over | Giữ nguyên mọi `expect` về số, chỉ đổi cách ghi tiền |
