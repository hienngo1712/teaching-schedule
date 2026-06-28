# Thiết kế: Tạo ca dạy bổ sung (ca bù) — Lịch dạy

- **Ngày:** 2026-06-28
- **Nhánh:** `feat/makeup-session`
- **Trạng thái:** Chờ duyệt (spec + plan) trước khi code

## 1. Bối cảnh & vấn đề

Khi một ca dạy định kỳ bị nghỉ vì lý do bất khả kháng (ví dụ ca **T2 17:00–18:30**) và được dạy bù vào ngày khác (ví dụ **T4 17:00–18:30**), giáo viên cần:

1. Tạo một **ca bù** để theo dõi lịch mới.
2. **Vô hiệu hóa ca gốc** để nó không bị tính 2 lần vào doanh thu.

**Nguyên nhân kỹ thuật:** Doanh thu kì vọng = tổng `sessionStudent.fee` của mọi ca trong kỳ. Trường `status` (`scheduled`/`completed`/`cancelled`) đã tồn tại trong `TeachingSession` nhưng **chưa được dùng** ở bất kỳ công thức nào. Hệ quả: nếu giữ cả ca gốc lẫn ca bù, doanh thu kì vọng bị cộng đôi → giáo viên nhầm giữa số tiền ước tính và số tiền thực tế.

## 2. Quyết định thiết kế (đã chốt với người dùng)

| # | Quyết định | Lựa chọn đã chốt |
|---|---|---|
| Q1 | Xử lý ca gốc | **Đánh dấu `cancelled` + loại khỏi doanh thu** (KHÔNG xóa hẳn — giữ lịch sử, có thể khôi phục) |
| Q2 | Hiển thị ca đã hủy | **Vẫn hiện trên Calendar**: style mờ/đỏ, gạch ngang, nhãn "Đã hủy", có link tới ca bù. Loại khỏi doanh thu kì vọng, doanh thu thực, tỉ lệ điểm danh |
| Q3 | Trường của ca bù | **Chọn ngày mới + giờ mới** (giờ mặc định điền sẵn = giờ ca gốc). Môn/học sinh/học phí sao chép từ ca gốc; điểm danh reset về "chưa điểm danh" |

Hướng tiếp cận: **A — "Hủy + ca bù liên kết"** (loại bỏ hướng B "dời ca tại chỗ" và hướng C "nhân bản + xóa hẳn" vì cả hai đều không giữ được audit trail / không hiển thị ca cũ "Đã hủy" cạnh ca bù).

## 3. Phạm vi

### Trong phạm vi
- Action "Tạo ca bù" trên 1 buổi (single occurrence) trong dialog chi tiết ca.
- Đánh dấu ca gốc `cancelled`, liên kết với ca bù.
- Loại ca `cancelled` khỏi MỌI công thức doanh thu / học phí / điểm danh.
- Hiển thị ca hủy (mờ + link) và ca bù (nhãn "Ca bù") trên Calendar.
- Khôi phục (hoàn tác hủy) — xem mục 7.
- i18n (vi + en), test.

### Ngoài phạm vi (YAGNI)
- Tạo ca bù hàng loạt cho cả chuỗi định kỳ (chỉ làm cho 1 buổi).
- Đổi môn/học sinh ngay trong form ca bù (đã có chức năng "Sửa ca" riêng).
- Thông báo/nhắc lịch tự động.

## 4. Thay đổi dữ liệu (Prisma)

Bổ sung vào model `TeachingSession`:

```prisma
model TeachingSession {
  // ... các trường hiện có ...
  status        String    @default("scheduled") @db.VarChar(20) // dùng lại; set "cancelled"

  // --- MỚI ---
  cancelReason  String?   @map("cancel_reason")
  cancelledAt   DateTime? @map("cancelled_at")
  makeupOfId    Int?      @map("makeup_of_id")

  makeupOf      TeachingSession?  @relation("Makeup", fields: [makeupOfId], references: [id], onDelete: SetNull)
  makeupSessions TeachingSession[] @relation("Makeup")

  @@index([makeupOfId])
}
```

- `status = "cancelled"`: ca gốc đã bị hủy.
- `cancelReason`: lý do nghỉ (tùy chọn, ví dụ "bất khả kháng").
- `cancelledAt`: mốc hủy (audit).
- `makeupOfId`: ca bù trỏ về ca gốc. Ca gốc tìm ca bù qua reverse relation `makeupSessions`.
- `onDelete: SetNull`: xóa ca bù không làm hỏng ca gốc.
- Quy ước nghiệp vụ: 1 ca gốc có tối đa 1 ca bù (DB cho phép nhiều, ứng dụng kiểm soát — xem mục 5).

→ Cần **1 migration** (`prisma migrate dev`).

## 5. Backend

### 5.1 Service: `createMakeupSession`
`src/server/services/session.service.ts`

```ts
createMakeupSession(db, userId, originalId, {
  sessionDate: string, // "YYYY-MM-DD"
  startTime: string,   // "HH:mm"
  endTime: string,     // "HH:mm"
  cancelReason?: string,
}): Promise<{ makeup: SessionDTO; cancelled: SessionDTO }>
```

Luồng:
1. Load ca gốc + `sessionStudents`; `assertOwnership`.
2. **Guard:** ca gốc chưa ở trạng thái `cancelled`; ca gốc chưa có ca bù (`makeupSessions` rỗng) → nếu vi phạm ném `TRPCError` `BAD_REQUEST` (vi: "Ca này đã có ca bù / đã bị hủy").
3. Validate `endTime > startTime`.
4. `checkOverlap` cho slot mới (xem 5.3 — bỏ qua ca `cancelled`; vẫn cần check vì ca bù có thể trùng ca khác đang hoạt động).
5. Transaction:
   - Cập nhật ca gốc: `status = "cancelled"`, `cancelReason`, `cancelledAt = now`.
   - Tạo ca mới: sao chép `subjectId`, `title`, `notes`, danh sách HS + `fee` + `grade` (điểm danh mặc định `pending`), `makeupOfId = originalId`, `status = "scheduled"`.
6. Trả về DTO của cả hai ca (UI cần refresh cả hai).

> Lưu ý: `cancelledAt = now` — `Date.now()`/`new Date()` chạy bình thường trong runtime service (giới hạn về Date chỉ áp dụng trong Workflow script, không liên quan tới code ứng dụng).

### 5.2 Schema (zod) — `src/lib/schemas/session.ts`
```ts
sessionCreateMakeupSchema = z.object({
  id: z.number().int().positive(),          // ca gốc
  sessionDate: z.string().regex(dateRegex),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  cancelReason: z.string().max(500).optional(),
}).refine(d => d.endTime > d.startTime, { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] })
```

### 5.3 `checkOverlap` — bỏ qua ca đã hủy
Thêm `AND status != 'cancelled'` vào câu raw SQL trong `checkOverlap`, để khung giờ của ca đã hủy được coi là **trống** (cho phép tạo ca khác vào đúng slot cũ nếu cần). Tương tự, các bộ kiểm tra trùng in-memory trong `bulkCreateSessions` / `checkBulkCreateConflicts` bỏ qua ca `cancelled`.

### 5.4 Router — `src/server/trpc/routers/session.ts`
```ts
createMakeup: protectedProcedure
  .input(sessionCreateMakeupSchema)
  .mutation(({ ctx, input }) => createMakeupSession(ctx.db, ctx.userId, input.id, input))
```

### 5.5 Khôi phục (hoàn tác hủy) — `restoreSession`
```ts
restoreSession(db, userId, id): Promise<SessionDTO>
```
- Load ca gốc (`status = cancelled`), `assertOwnership`.
- Transaction: **xóa ca bù liên kết** (`makeupSessions`) nếu có; đặt lại ca gốc `status = "scheduled"`, `cancelReason = null`, `cancelledAt = null`.
- `checkOverlap` cho ca gốc trước khi khôi phục (slot cũ có thể đã bị chiếm) → nếu trùng, ném lỗi rõ ràng.
- Router: `restore` procedure.

### 5.6 Loại ca `cancelled` khỏi mọi tính toán

Đây là phần lan tỏa rộng nhất — phải sửa **tất cả** chỗ gộp `sessionStudent.fee` / đếm ca / tính điểm danh:

| File | Hàm | Sửa |
|---|---|---|
| `report.service.ts` | `getMonthlySummary` | `teachingSession.findMany` thêm `status: { not: "cancelled" }`; `totalSessions`/`byGrade`/doanh thu/điểm danh không tính ca hủy |
| `report.service.ts` | `getDashboardStats` | `sessionsToday` count, `sessionsThisMonth` findMany thêm `status: { not: "cancelled" }` |
| `report.service.ts` | `getStudentReport` | Lọc bỏ ca `cancelled` khỏi `studentSessions` trước khi tính summary (dựa trên `SessionDTO.status`) |
| `tuition.service.ts` | `getMonthlyTuitionStatus` (currentAttendance ~dòng 136) | `where.session` thêm `status: { not: "cancelled" }` |
| `tuition.service.ts` | groupBy `totalExpectedBefore` (~dòng 181) | `where.session` thêm `status: { not: "cancelled" }` |

> **Quan trọng:** Bỏ sót bất kỳ chỗ nào trong `tuition.service.ts` sẽ làm ca hủy tính nhầm vào **tiền thực tế HS phải đóng**, không chỉ doanh thu kì vọng.

### 5.7 `getMonthSessions` — vẫn trả ca hủy (cho Calendar)
- KHÔNG lọc `cancelled` (Calendar phải hiển thị ca hủy mờ + link).
- `include` thêm `makeupSessions: { select: { id, sessionDate } }` và `makeupOf: { select: { id, sessionDate } }`.
- `toDTO` bổ sung: `status` (đã có), `makeupOfId`, `makeupInfo` (ca bù: `{ id, sessionDate }` lấy phần tử đầu của `makeupSessions`), `originalInfo` (`makeupOf` → `{ id, sessionDate }`).

## 6. Kiểu dữ liệu (DTO) — `src/lib/types/models.ts`
`SessionListDTO` bổ sung:
```ts
status: string
makeupOfId: number | null
makeupInfo?: { id: number; sessionDate: Date | string } | null   // ca gốc → ca bù
originalInfo?: { id: number; sessionDate: Date | string } | null // ca bù → ca gốc
cancelReason?: string | null
```

## 7. Frontend

### 7.1 `SessionDetailDialog.tsx`
- **Dropdown action mới "Tạo ca bù"** (icon `CalendarClock`), hiển thị khi ca chưa `cancelled` và chưa có ca bù.
- Dialog "Tạo ca bù": `Calendar` chọn ngày mới + 2 input giờ (prefill = giờ ca gốc) + ô lý do (textarea, tùy chọn). Submit → `session.createMakeup`.
- Khi mở dialog của ca **đã hủy**: hiện banner đỏ "Đã hủy — chuyển sang ca bù ngày DD/MM" (link mở ca bù) + nút **"Khôi phục"** (gọi `session.restore`, xác nhận qua AlertDialog vì sẽ xóa ca bù). Ẩn các action điểm danh/thêm HS.
- Toast + invalidate query `session.getMonth` (và `getDetail`) sau mỗi mutation.

### 7.2 `SessionCard.tsx` (Calendar)
- `status === "cancelled"`: thêm class mờ + `line-through` + viền/nền đỏ nhạt + nhãn "Đã hủy"; nếu có `makeupInfo` hiện dòng nhỏ "→ Bù: DD/MM".
- Ca bù (`makeupOfId != null`): nhãn nhỏ "Ca bù" + "(từ DD/MM)" lấy từ `originalInfo`.

### 7.3 i18n — `src/language/vi.json` + `en.json`
Khóa mới (vi / en): `create_makeup_session` ("Tạo ca bù" / "Create makeup session"), `makeup_session` ("Ca bù"), `cancelled_label` ("Đã hủy"), `makeup_for` ("Bù cho"), `makeup_on` ("Bù: {date}"), `from_date` ("từ {date}"), `cancel_reason` ("Lý do nghỉ"), `create_makeup_desc`, `restore_session` ("Khôi phục"), `restore_confirm_desc`, `make_up_success`, `make_up_error`, `restore_success`, `restore_error`.

## 8. Test (TDD)

**Unit — `session.service`**
- `createMakeupSession`: tạo ca bù copy đúng HS/fee/môn, điểm danh reset `pending`, ca gốc thành `cancelled` + `cancelledAt`, liên kết `makeupOfId`.
- Guard: ca đã `cancelled` / đã có ca bù → ném lỗi.
- Overlap: slot mới trùng ca đang hoạt động → ném `CONFLICT`; trùng slot của 1 ca `cancelled` → KHÔNG ném.
- `restoreSession`: xóa ca bù, ca gốc về `scheduled`; trùng slot khi khôi phục → ném lỗi.
- Ownership: ca/HS của user khác → `NOT_FOUND`.

**Integration — doanh thu/học phí**
- Trước/sau khi tạo ca bù: `expectedRevenueMonth` (dashboard) và `getMonthlySummary.expectedRevenue` KHÔNG đổi (ca hủy + ca bù triệt tiêu nhau, không cộng đôi).
- `getMonthlyTuitionStatus`: `totalExpected`/`currentMonthFee` của HS không tính ca `cancelled`.
- `getStudentReport`: ca `cancelled` không vào summary.

## 9. Rủi ro & lưu ý
- **Bỏ sót chỗ gộp doanh thu** là rủi ro lớn nhất → mục 5.6 liệt kê đầy đủ; test tích hợp mục 8 chốt chặn.
- **Khôi phục khi slot cũ đã bị chiếm**: xử lý bằng `checkOverlap` + lỗi rõ ràng (không tự ý ghi đè).
- **Migration**: chạy trên cả dev và prod (`db:migrate:all`).
- Ca bù vẫn có thể bị "Sửa ca"/"Xóa" như ca thường; xóa ca bù không tự khôi phục ca gốc (giáo viên dùng "Khôi phục" trên ca gốc).
```
