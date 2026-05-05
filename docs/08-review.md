# 08 — Review & Acceptance

## Review checklist sau mỗi sub-phase

```
┌────────────────────────────────────────────────────────────────┐
│  REVIEW LẦN 1 — LOGIC & CODE QUALITY (đọc code)               │
│  ─────────────────────────────────────────────────             │
│  □ Code match spec trong docs/ liên quan?                      │
│  □ TypeScript: không có `any`, types đầy đủ?                  │
│  □ Zod schemas validate đúng edge cases?                      │
│  □ Prisma: include/select tối ưu, không có N+1?               │
│  □ Error handling: throw đúng TRPCError code?                 │
│  □ Biến/function tiếng Anh rõ nghĩa?                         │
│  □ Comment tiếng Việt ở logic nghiệp vụ phức tạp?            │
│  □ Không có console.log debug thừa?                            │
│  □ Không có hardcoded values (dùng constants.ts)?             │
│  □ "use client" chỉ đặt khi thực sự cần?                    │
│                                                                │
│  REVIEW LẦN 2 — HOẠT ĐỘNG & UX (chạy thật)                   │
│  ─────────────────────────────────────────────────             │
│  □ `pnpm build` — PASS, không có errors/warnings?            │
│  □ `pnpm test:unit` (hoặc test:integration) — PASS?          │
│  □ Test thủ công trên browser — đúng hành vi mong muốn?      │
│  □ Mobile viewport (375px) — layout không bị vỡ?             │
│  □ Loading state — có skeleton/spinner khi fetch?             │
│  □ Empty state — có thông báo khi list rỗng?                  │
│  □ Error state — hiển thị lỗi khi API fail?                   │
│  □ Console browser — không có errors/warnings?               │
│  □ UI labels/messages bằng tiếng Việt?                       │
│  □ Toast notification sau actions (add/edit/delete/export)?   │
│                                                                │
│  ✅ CẢ 2 PASS → Commit + sang sub-phase tiếp                 │
│  ❌ CÓ FAIL  → Fix ngay, KHÔNG chuyển sub-phase              │
└────────────────────────────────────────────────────────────────┘
```

---

## Quy tắc code bắt buộc

### TypeScript
```typescript
// ❌ KHÔNG làm:
const data: any = response
function process(input: any) { ... }

// ✅ ĐÚNG:
const data: SessionWithStudents = response
function process(input: z.infer<typeof sessionCreateSchema>) { ... }
```

### Prisma — tránh N+1
```typescript
// ❌ KHÔNG làm (N+1):
const sessions = await db.teachingSession.findMany()
for (const session of sessions) {
  session.students = await db.sessionStudent.findMany(...)
}

// ✅ ĐÚNG (eager load):
const sessions = await db.teachingSession.findMany({
  include: { sessionStudents: { include: { student: true } } }
})
```

### tRPC errors
```typescript
// ❌ KHÔNG throw generic Error:
throw new Error("Not found")

// ✅ ĐÚNG:
throw new TRPCError({ code: "NOT_FOUND", message: "Học sinh không tồn tại" })
throw new TRPCError({ code: "UNAUTHORIZED" })
throw new TRPCError({ code: "BAD_REQUEST", message: "Grade phải từ 1 đến 9" })
```

### "use client" directive
```typescript
// ❌ KHÔNG đặt "use client" ở tất cả components
// → chỉ đặt khi component dùng: useState, useEffect, event handlers, browser APIs

// ✅ Server Components (KHÔNG cần "use client"):
//    - pages có thể là server component nếu chỉ fetch data
//    - Layout components không có interaction

// ✅ Client Components (CẦN "use client"):
//    - Forms, dialogs, interactive components
//    - Bất kỳ component dùng tRPC hooks (useQuery, useMutation)
```

### Constants — không hardcode
```typescript
// ❌ KHÔNG:
if (grade <= 5) return "tieu_hoc"
const colors = { primary: "#4F46E5" }
const days = ["T2", "T3", ...]

// ✅ ĐÚNG: dùng từ constants.ts
import { LEVEL, COLORS, DAY_NAMES } from "@/lib/constants"
```

---

## Final Acceptance Checklist (Phase 8)

Chạy checklist này trên **Vercel production URL** sau Phase 8 Sub 8.6.

### AUTH
- [ ] Truy cập /dashboard chưa login → redirect /login
- [ ] Login teacher/teacher123 → vào /dashboard
- [ ] Refresh trang → vẫn logged in
- [ ] Logout → về /login, không access được /dashboard

### STUDENTS
- [ ] Thêm HS "Nguyễn Văn An" lớp 3 → badge "Tiểu học" xanh dương
- [ ] Thêm HS "Trần Thị Bình" lớp 7 → badge "THCS" xanh lá
- [ ] Sửa HS → giá trị cập nhật ngay
- [ ] Xóa HS → hiện confirm → sau confirm: biến mất khỏi list
- [ ] Lọc lớp 3 → chỉ thấy HS lớp 3
- [ ] Search "an" → tìm thấy "Nguyễn Văn An"

### CALENDAR & SESSIONS
- [ ] Calendar hiển thị tháng hiện tại, header đúng "Tháng M / YYYY"
- [ ] Navigate ◄ → tháng trước, header cập nhật
- [ ] Ô hôm nay có highlight (indigo-50)
- [ ] Click ô ngày trống → dialog tạo ca, ngày đó pre-fill
- [ ] Tạo ca 10/4, 08:00–09:30, title "Nhóm A" → card xuất hiện đúng ô
- [ ] Click card → dialog chi tiết mở
- [ ] Sửa title → card cập nhật
- [ ] Xóa ca → confirm → card biến mất

### SESSIONS + STUDENTS
- [ ] Tạo ca + gán 2 HS → card hiện "2 HS"
- [ ] Mở ca → bảng 2 HS
- [ ] Thêm 1 HS vào ca (từ detail dialog) → bảng 3 HS
- [ ] Gỡ 1 HS → bảng 2 HS

### ATTENDANCE
- [ ] Điểm danh: HS1 Có mặt, HS2 Vắng, HS3 Muộn → Lưu
- [ ] Đóng dialog → mở lại → trạng thái đúng (persistent)
- [ ] Ghi chú "Xin phép" cho HS Vắng → lưu → đúng
- [ ] "Điểm danh tất cả: Có mặt" → tất cả chuyển present trong 1 click

### FILTERS
- [ ] Filter lớp 3 → calendar chỉ hiện ca có HS lớp 3
- [ ] URL thay đổi thành ?grade=3
- [ ] Filter tên "An" → chỉ hiện ca có HS tên chứa "An"
- [ ] Chọn 1 HS → StudentScheduleView hiện bên dưới calendar
- [ ] Schedule view: đúng ngày, thứ, giờ, điểm danh, tổng kết %
- [ ] Xóa filter → calendar hiện tất cả

### EXPORT
- [ ] Chụp PNG lịch 1 HS → file .png download, ảnh sạch (không có nút)
- [ ] Xuất Excel "Lịch tháng" → .xlsx download, mở OK, format đúng
- [ ] Xuất Excel "Lịch HS" → điểm danh có màu green/red/amber
- [ ] Xuất Excel "Theo lớp" → cross-tab đúng, freeze panes OK
- [ ] Xuất Excel "Tổng hợp" → nhiều sheets

### BULK CREATE
- [ ] Tạo lịch lặp T2+T4+T6, tháng 5/2026 → đúng số ca
- [ ] Preview danh sách ngày hiện đúng trước khi confirm
- [ ] Duplicate ca → ca mới đúng thông tin, attendance reset pending

### DASHBOARD
- [ ] "Tổng học sinh": đúng số HS active
- [ ] "Ca hôm nay": đúng số ca ngày hôm nay
- [ ] "Tỉ lệ điểm danh tháng này": có số liệu

### RESPONSIVE
- [ ] Mobile (375px): sidebar collapse, hamburger menu hoạt động
- [ ] Mobile: calendar chuyển sang list view
- [ ] Mobile: dialog full-screen
- [ ] Tablet (768px): layout OK
- [ ] Desktop: full sidebar layout

### UI QUALITY
- [ ] Loading skeleton khi đang fetch data
- [ ] Empty state rõ ràng khi list trống
- [ ] Confirm dialog trước tất cả actions xóa
- [ ] Toast notification sau: thêm, sửa, xóa, export, lưu điểm danh
- [ ] Không có console.error trong browser DevTools
- [ ] Favicon hiển thị, tab title đúng "Quản lý lịch dạy"

---

## Commit message convention

```bash
feat: add student CRUD operations
feat: implement monthly calendar grid
feat: bulk create recurring sessions
fix: attendance not persisting after dialog close
fix: calendar grid wrong day for months starting on weekend
refactor: extract session business logic to service layer
test: add integration tests for attendance router
test: add E2E tests for student management
style: add responsive mobile calendar list view
docs: update phases checklist
chore: upgrade next-auth to v5 beta 25
```
