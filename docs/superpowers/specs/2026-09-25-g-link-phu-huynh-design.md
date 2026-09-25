# G — Link chỉ-đọc cho phụ huynh

> Phần G trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0. Phụ thuộc **B** (`2026-09-25-b-lich-su-thu-tien-design.md`) và **C** (`2026-09-25-c-phieu-bao-hoc-phi-vietqr-design.md`), cả hai chưa code. G chỉ dùng interface ở mục 11 của B và C. Chỗ cần thêm ghi ở mục 12.

## 1. Bối cảnh

Hiện phụ huynh chỉ nhận ảnh phiếu báo (C) hoặc tin nhắn qua Zalo. Muốn biết con đi học ngày nào, tháng trước còn nợ bao nhiêu hay tuần sau học lúc mấy giờ, phụ huynh phải nhắn hỏi giáo viên.

Hiện trạng liên quan:
- Mọi route đều phải đăng nhập, trừ những route bị loại khỏi `matcher` trong `src/middleware.ts` (`login|register|api/auth|api/trpc|_next/static|_next/image|favicon.ico`). Callback `authorized` trong `src/server/auth.config.ts` chặn khi thiếu `auth.user`.
- `src/app/layout.tsx` (gốc) chỉ bọc `TRPCProvider`, `LanguageProvider`, `Toaster`, `SpeedInsights`. Phần đăng nhập nằm ở `src/app/(app)/layout.tsx` (`auth()`, `AppLayout`), nên route ngoài nhóm `(app)` không có header hay thanh tab.
- `LanguageProvider` (`src/components/providers/LanguageProvider.tsx`) mặc định `"vi"` và đọc `localStorage.language`.
- `tests/unit/next15-contract.test.ts` cấm mọi `page.tsx`/`layout.tsx` nhắc tới `params`/`searchParams`, chỉ trừ các file trong `ALLOWED`.
- `softDeleteStudent` đặt `isActive=false` và gỡ HS khỏi các ca chưa kết thúc, nên HS đã nghỉ không còn ca sắp tới.
- Rate limit đăng nhập dựa trên bảng `LoginAttempt` (`src/server/auth-credentials.ts`).

## 2. Mục tiêu và tiêu chí hoàn thành

- Ở màn Học sinh, giáo viên tạo được link cho 1 HS, rồi sao chép hoặc chia sẻ (qua Zalo) link đó. Giáo viên cũng tạo lại được link (link cũ ngừng hoạt động) và tắt được link.
- Phụ huynh mở link trên điện thoại (390px), không cần đăng nhập, thấy được:
  - phiếu báo học phí tháng hiện tại, giống hệt phiếu của C, có QR khi còn phải trả;
  - các tháng trước, trong giới hạn 12 tháng;
  - điểm danh của tháng đang xem;
  - lịch các ca sắp tới.
- Link sai, đã tạo lại hoặc đã tắt đều trả **404** giống nhau.
- Trang không lộ dữ liệu của HS khác. Thông tin giáo viên chỉ có tên và tài khoản nhận tiền (cần cho QR). Không lộ ghi chú của giáo viên.
- Mở trang **không ghi gì vào DB**. Response có `noindex` và không cho cache công khai.

## 3. Quyết định đã chốt (người dùng)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Phụ huynh thấy gì | Phiếu báo tháng hiện tại (như C, có QR); chọn xem tháng trước; điểm danh theo tháng (ngày học, có mặt/vắng); lịch ca sắp tới. |
| Q2 | Dạng link | Mỗi HS 1 link cố định, token ngẫu nhiên khó đoán (≥128 bit, base64url), không hết hạn. Có nút "Tạo lại link" (vô hiệu link cũ) và "Tắt link". Chỉ tạo khi giáo viên bấm tạo. |

## 4. Quyết định do người viết spec chọn (cần duyệt)

| # | Vấn đề | Chọn | Lý do |
|---|---|---|---|
| S1 | Lưu token | **1 cột nullable, unique trên `Student`**: `parentLinkToken`. Lưu token gốc, **không hash**. | Mỗi HS chỉ có 1 link, nên không cần bảng riêng. Nếu chỉ lưu hash thì không hiện lại được link để "Sao chép", mỗi lần muốn gửi lại giáo viên phải tạo lại link và phụ huynh cũ mất link. Hash chỉ có ích khi DB bị lộ, mà lúc đó toàn bộ dữ liệu HS cũng đã lộ rồi. |
| S2 | Độ dài token | `randomBytes(32).toString("base64url")`, ra 43 ký tự (256 bit). | Dư xa mức 128 bit. URL vẫn ngắn, dán vào Zalo không sao. |
| S3 | Render trang | **Server Component** `src/app/p/[token]/page.tsx` gọi thẳng service. **Không** làm tRPC public procedure. | Không mở thêm endpoint API công khai nào để dò. Dữ liệu chỉ đi qua 1 DTO đã lọc sẵn (S7). Thiết kế này cũng không cần thêm `publicProcedure` mới. |
| S4 | Chọn tháng | Query `?thang=YYYY-MM`. Trang có 2 link "‹ Tháng trước" / "Tháng sau ›", đổi tháng bằng render lại phía server. | Không cần state phía client. Tháng không hợp lệ hoặc ngoài khoảng thì tự về tháng hiện tại, không báo lỗi. |
| S5 | Khoảng tháng xem được | Từ tháng hiện tại (giờ VN, `vnDateParts`) lùi tối đa 11 tháng, không sớm hơn tháng của `Student.createdAt`. Không xem tháng tương lai. | Đủ 12 tháng cho một năm học. Không bày ra các tháng rỗng trước khi HS bắt đầu học. |
| S6 | HS đã nghỉ (`isActive=false`) | **Link vẫn hoạt động.** Muốn chặn thì giáo viên bấm "Tắt link". | HS nghỉ có thể còn nợ, phụ huynh cần xem. Lịch sắp tới tự rỗng vì `softDeleteStudent` đã gỡ ca. Nếu tài khoản giáo viên có `User.isActive=false` thì trả 404. |
| S7 | Lọc dữ liệu | Service trả `ParentViewDTO` liệt kê từng trường. Trong `notice.payments`, `note` được đặt thành `null`. Ca chỉ lộ ngày, giờ, tên môn (không có `title`, `notes`, không có HS khác). Không trả `parentPhone`, `parentName`, `Student.notes`. | Trang server truyền DTO xuống client component, và toàn bộ DTO nằm trong RSC payload (xem được bằng view-source). Vì vậy phải lọc ngay ở server chứ không trông vào việc giao diện không hiển thị. |
| S8 | Chống dò token | **Không làm rate limit.** Kiểm dạng token `/^[A-Za-z0-9_-]{43}$/` trước khi truy vấn DB. Sai dạng thì trả 404 luôn. | Không gian 2^256 không thể dò được. Rate limit kiểu `LoginAttempt` phải ghi DB mỗi request, trái với yêu cầu "chỉ đọc". Nếu bị spam thì dùng Vercel Firewall ở tầng hạ tầng. |
| S9 | Cache, index | `export const dynamic = "force-dynamic"`, để Next tự trả `Cache-Control: private, no-cache, no-store…`. `metadata.robots = { index: false, follow: false }`. `next.config.mjs` thêm `headers()` cho `/p/:path*` gồm `X-Robots-Tag: noindex, nofollow` và `Referrer-Policy: no-referrer`. | Next ghi đè `Cache-Control` tự đặt trong config ở production, nên dựa vào hành vi dynamic mặc định. `no-referrer` giữ cho token không rò qua header Referer. |
| S10 | Ngôn ngữ | **Luôn tiếng Việt.** `LanguageProvider` thêm prop `forcedLanguage?: "vi" \| "en"` (có prop này thì bỏ qua `localStorage`). Trang phụ huynh bọc `<LanguageProvider forcedLanguage="vi">`. | `TuitionNoticeCard` của C dùng `t()`. Nếu giáo viên để app tiếng Anh rồi tự mở thử link trên máy mình, phiếu sẽ ra tiếng Anh. Cách này vẫn giữ quy ước i18n (key có ở cả vi và en). |
| S11 | Ca sắp tới | Ca có `sessionDate` ≥ hôm nay (giờ VN), `status != "cancelled"`, có HS này. Tối đa **10 ca**, sắp theo ngày rồi giờ bắt đầu. | Đủ cho khoảng 2–3 tuần. Không cần phân trang. |
| S12 | Lối vào quản lý | Menu ⋯ của mỗi HS trong `StudentList` thêm mục **"Link phụ huynh"**, mở `ParentLinkDialog` (MỚI). | Theo đúng mẫu menu hành động sẵn có, dùng được ở cả thẻ mobile và bảng desktop. |

## 5. Phạm vi

### Trong phạm vi
- Migration cột `parent_link_token`.
- Service `parent-link.service.ts`, 2 mutation `student.generateParentLink` và `student.disableParentLink`.
- Route công khai `/p/[token]`, sửa `matcher`, header trong `next.config.mjs`.
- `ParentLinkDialog`, `ParentView`, prop `forcedLanguage`.
- Sửa `next15-contract.test.ts`, i18n, test.

### Ngoài phạm vi (YAGNI)
- Tài khoản hay đăng nhập cho phụ huynh, link hết hạn, nhiều link cho 1 HS, 1 link cho nhiều con.
- Rate limit, log lượt mở link, thông báo "phụ huynh đã xem".
- Phụ huynh xác nhận đã chuyển khoản, nhắn tin hay bình luận.
- Tải ảnh phiếu từ trang phụ huynh (có thể chụp màn hình), PDF.
- Tạo link hàng loạt cho mọi HS.

## 6. Giao diện

### 6.1 Lối vào ở màn Học sinh (`src/components/students/StudentList.tsx`)
`actionsMenu` thêm `DropdownMenuItem` **"Link phụ huynh"** (icon `Link2`), đặt sau "Xem lịch". Mục này hiện với cả HS đã nghỉ. Bấm vào thì `setParentLinkTarget(s)` để mở `ParentLinkDialog`.

### 6.2 `ParentLinkDialog` (MỚI, `src/components/students/ParentLinkDialog.tsx`)
Props `{ student: StudentRow | null; onOpenChange }`. Dùng `Dialog` (mobile và desktop chung). Tiêu đề: "Link phụ huynh · {fullName}".
- **Chưa có link** (`student.parentLinkToken == null`): hiện mô tả "Phụ huynh mở link là xem được học phí, điểm danh và lịch học của con, không cần đăng nhập." và nút **"Tạo link"** (`h-11 md:h-10`, `w-full sm:w-auto`).
- **Đã có link**: `Input readOnly` chứa `${window.location.origin}/p/${token}`, bấm vào thì chọn hết chữ. Các nút (`h-11 md:h-10`):
  - **Sao chép** (`Copy`): `navigator.clipboard.writeText` rồi toast "Đã sao chép link".
  - **Chia sẻ** (`Share2`): chỉ hiện khi có `navigator.share`. Gọi `navigator.share({ title, text: "Xem học phí và lịch học của {fullName}", url })` và bỏ qua `AbortError`. Zalo có trong bảng chia sẻ của máy.
  - **Tạo lại link** (`RefreshCw`, outline): AlertDialog "Link cũ sẽ ngừng hoạt động. Phụ huynh cần nhận link mới." Đồng ý thì gọi `generateParentLink`.
  - **Tắt link** (`Link2Off`, chữ đỏ): AlertDialog "Tắt link? Phụ huynh sẽ không mở được nữa." Đồng ý thì gọi `disableParentLink`.
- Mutation xong thì `utils.student.list.invalidate()` và toast. Link mới hiện ngay trong ô.

### 6.3 Trang `/p/[token]` (MỚI, `src/app/p/[token]/page.tsx`)
Server component, có `export const dynamic = "force-dynamic"` và `metadata = { title: "Thông tin học tập", robots: { index: false, follow: false } }`.

```ts
export default async function ParentPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ thang?: string }>
}) {
  const { token } = await params
  const { thang } = await searchParams
  const view = await getParentView(db, token, thang)
  if (!view) notFound()
  return <LanguageProvider forcedLanguage="vi"><ParentView view={view} /></LanguageProvider>
}
```
Không có `AppLayout`, không có nút đăng nhập, không có link nào dẫn vào app.

`ParentView` (MỚI, `src/components/parent/ParentView.tsx`, client) là 1 cột `max-w-md mx-auto px-4 py-6 space-y-6`, nền `bg-slate-50`:
1. **Đầu trang**: tên HS (đậm), "Lớp {grade}", "Giáo viên: {teacherName}".
2. **Chọn tháng**: hàng `‹ Tháng trước | Tháng {m}/{yyyy} | Tháng sau ›`. Hai link `next/link` tới `?thang=YYYY-MM`, vùng chạm `min-h-11`. Ở biên thì hiện dạng chữ mờ, không có link.
3. **Học phí**: `TuitionNoticeCard` của C với `notice={view.notice}`, căn giữa. Card rộng cố định 360px, trên màn 390px có `px-4` vẫn vừa (360 + 2×15 = 390). Nếu có `notice.qr` thì dưới card thêm 1 dòng nhỏ: "Chụp màn hình rồi chọn quét ảnh QR trong app ngân hàng."
4. **Điểm danh tháng {m}**: danh sách `view.attendance`, mỗi dòng gồm `T5 · 04/09 · 17:30–19:00 · Toán` và nhãn trạng thái: Có mặt (xanh), Muộn (vàng), Vắng (đỏ), Chưa điểm danh (xám). Trên cùng có dòng tóm tắt "Có mặt {n}/{tổng} buổi" (Muộn tính là có mặt, giống `calcStudentTuition`). Không có ca nào thì hiện "Tháng này chưa có buổi học."
5. **Lịch sắp tới**: `view.upcoming` hiện theo cùng dạng dòng, ca hôm nay có huy hiệu "Hôm nay". Rỗng thì hiện "Chưa có lịch học sắp tới."
6. **Chân trang**: "Trang chỉ để xem. Có thắc mắc, vui lòng liên hệ giáo viên."

Ngày dùng `formatDate`/`formatDayOfWeek` (đọc theo UTC). Giờ lấy chuỗi `HH:mm` từ server. Không dùng `rounded-full` hay `inline-flex` trong card (card là của C). Phần còn lại dùng Tailwind bình thường.

404 dùng `notFound()` và trang not-found mặc định của Next. Link sai, đã tạo lại hay đã tắt đều ra cùng một trang, không ai phân biệt được link từng tồn tại hay chưa.

## 7. Backend

### 7.1 `src/server/services/parent-link.service.ts` (MỚI)
- `generateParentLink(db, userId, studentId): Promise<{ token: string }>`: dùng `findUnique` + `assertOwnership` (từ `_base.service`), tạo `token = randomBytes(32).toString("base64url")` (`node:crypto`), rồi `update parentLinkToken`. Dùng cho cả "Tạo" lẫn "Tạo lại", vì ghi đè token là link cũ chết ngay. Nếu gặp P2002 (trùng token, gần như không thể xảy ra) thì thử lại 1 lần.
- `disableParentLink(db, userId, studentId): Promise<{ success: true }>`: dùng `assertOwnership`, rồi `update parentLinkToken: null`.
- `getParentView(db, token, thang?: string): Promise<ParentViewDTO | null>`, **chỉ đọc**:
  1. `token` không khớp `PARENT_TOKEN_REGEX` thì trả `null`.
  2. `student.findUnique({ where: { parentLinkToken: token }, select: { id, userId, fullName, grade, createdAt, user: { select: { isActive } } } })`. Không tìm thấy, hoặc `!user.isActive`, thì trả `null`.
  3. Tính `minMonth` = max(tháng hiện tại − 11, tháng VN của `createdAt`) và `maxMonth` = tháng hiện tại (`vnDateParts`). Parse `thang` theo `/^\d{4}-(0[1-9]|1[0-2])$/`. Sai dạng hoặc ngoài `[minMonth, maxMonth]` thì dùng `maxMonth`.
  4. `notice = await getTuitionNotice(db, student.userId, { studentId, year, month })` (C). Sau đó `notice.payments = notice.payments.map(p => ({ ...p, note: null }))`.
  5. `attendance`: `sessionStudent.findMany({ where: { studentId, session: { userId, sessionDate: { gte, lt }, status: { not: "cancelled" } } }, select: { attendance: true, session: { select: { sessionDate, startTime, endTime, subject: { select: { name: true } } } } } })`, sắp theo `sessionDate` rồi `startTime`. Điều kiện giống `currentAttendance` trong `getMonthlyTuitionStatus`, nên số buổi khớp phiếu.
  6. `upcoming`: truy vấn như bước 5 nhưng `sessionDate: { gte: todayVnUtcMidnight }`, `take: 10` (S11).
  7. Map sang `ParentViewDTO`. Chỉ lấy các trường ở 7.2, không spread object Prisma.
- `PARENT_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/` được export để test dùng.

### 7.2 `ParentViewDTO` (MỚI, `src/lib/types/models.ts`)
```ts
type ParentSessionDTO = {
  date: string; startTime: string; endTime: string   // "YYYY-MM-DD", "HH:mm"
  subjectName: string
  attendance: "pending" | "present" | "absent" | "late"
}
type ParentViewDTO = {
  student: { fullName: string; grade: number }
  year: number; month: number
  prevMonth: string | null; nextMonth: string | null   // "YYYY-MM" hoặc null ở biên
  notice: TuitionNoticeDTO                              // của C, payments[].note = null
  attendance: ParentSessionDTO[]
  upcoming: ParentSessionDTO[]
}
```
Tên giáo viên và tài khoản ngân hàng lấy từ `notice.teacherName` và `notice.qr`, là những trường C đã có.

### 7.3 Router (`src/server/trpc/routers/student.ts`)
- `generateParentLink: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(...)`.
- `disableParentLink`: input như trên.
- `getParentView` **không** có router, chỉ page server gọi.

`student.list` tự trả thêm `parentLinkToken`, vì `StudentDTO` extends `Student`, không cần sửa. Chỉ giáo viên chủ sở hữu thấy được trường này.

### 7.4 Route công khai
- `src/middleware.ts`: thêm `p/` vào `matcher`, thành `"/((?!login|register|p/|api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)"`. Phải có dấu `/` để không vô tình mở `/profile` hay các route khác bắt đầu bằng "p".
- `next.config.mjs`: thêm `async headers() { return [{ source: "/p/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] }] }`.
- `tests/unit/next15-contract.test.ts`: thêm `"src/app/p/[token]/page.tsx"` vào `ALLOWED`, kèm assertion mới là file đó phải chứa `await params` và `await searchParams`. Ghi chú: đây là page duy nhất dùng prop route, đã xử lý theo kiểu async của Next 15.

### 7.5 `LanguageProvider`
Thêm prop `forcedLanguage?: Language`. Khi có prop: state khởi tạo bằng giá trị đó, effect đọc `localStorage` bị bỏ qua, và `setLanguage` không ghi `localStorage`. Mọi chỗ đang dùng giữ nguyên, vì prop là tuỳ chọn.

## 8. Dữ liệu và migration

`prisma/schema.prisma`, model `Student` thêm:
```prisma
parentLinkToken String? @unique @map("parent_link_token") @db.VarChar(43)
```
Migration `prisma/migrations/<timestamp>_add_student_parent_link_token/migration.sql`, sinh bằng `prisma migrate dev --create-only` trên DB test:
```sql
ALTER TABLE "students" ADD COLUMN "parent_link_token" VARCHAR(43);
CREATE UNIQUE INDEX "students_parent_link_token_key" ON "students"("parent_link_token");
```
Cột nullable, không có default. Postgres cho nhiều dòng `NULL` trong unique index. Migration không đụng dữ liệu, chạy thẳng bằng `prisma migrate deploy`, và bản code cũ vẫn chạy trong lúc build. Nên thử trước trên Neon branch như B/C.

Kiểm tra trước và sau (chỉ đọc):
```sql
SELECT COUNT(*) FROM "students";                                        -- trước = sau
SELECT COUNT(*) FROM "students" WHERE "parent_link_token" IS NOT NULL;  -- sau = 0
```

## 9. i18n

Thêm vào cả `vi.json` và `en.json` (số key 2 file bằng nhau). Trước khi thêm, grep các key sẵn có để dùng lại: `grade`, `cancel`, `share` (C), `load_error`, trạng thái điểm danh… Trang phụ huynh luôn hiện bản `vi` (S10).

| Key | vi | en |
|---|---|---|
| `parent_link` | Link phụ huynh | Parent link |
| `parent_link_desc` | Phụ huynh mở link là xem được học phí, điểm danh và lịch học của con, không cần đăng nhập. | Parents can view tuition, attendance and schedule without signing in. |
| `create_link` | Tạo link | Create link |
| `copy_link` | Sao chép | Copy |
| `link_copied` | Đã sao chép link | Link copied |
| `regenerate_link` | Tạo lại link | Regenerate link |
| `regenerate_link_confirm` | Link cũ sẽ ngừng hoạt động. Phụ huynh cần nhận link mới. | The old link will stop working. Parents will need the new link. |
| `disable_link` | Tắt link | Disable link |
| `disable_link_confirm` | Tắt link? Phụ huynh sẽ không mở được nữa. | Disable link? Parents will no longer be able to open it. |
| `parent_share_text` | Xem học phí và lịch học của | View tuition and schedule for |
| `parent_page_title` | Thông tin học tập | Learning info |
| `prev_month` | Tháng trước | Previous month |
| `next_month` | Tháng sau | Next month |
| `parent_attendance` | Điểm danh tháng | Attendance for |
| `parent_present_summary` | Có mặt {n}/{total} buổi | Attended {n}/{total} sessions |
| `parent_no_sessions` | Tháng này chưa có buổi học. | No sessions this month. |
| `parent_upcoming` | Lịch sắp tới | Upcoming sessions |
| `parent_no_upcoming` | Chưa có lịch học sắp tới. | No upcoming sessions. |
| `today_badge` | Hôm nay | Today |
| `parent_qr_hint` | Chụp màn hình rồi chọn quét ảnh QR trong app ngân hàng. | Take a screenshot, then scan the QR image in your banking app. |
| `parent_footer` | Trang chỉ để xem. Có thắc mắc, vui lòng liên hệ giáo viên. | View only. Please contact the teacher with any questions. |

Không dùng dấu gạch dài. Thông báo lỗi server giữ tiếng Việt.

## 10. Kiểm thử

### Unit
- `tests/unit/next15-contract.test.ts`: sửa như mục 7.4.
- MỚI `tests/unit/components/LanguageProvider.test.tsx` (hoặc thêm vào file sẵn có nếu đã có): khi `localStorage.language = "en"` mà truyền `forcedLanguage="vi"` thì `t()` vẫn trả tiếng Việt.

### Integration (MỚI `tests/integration/parent-link.test.ts`)
- `generateParentLink`: token khớp `PARENT_TOKEN_REGEX` và `student.list` trả đúng token đó. Gọi lại lần nữa thì token đổi, `getParentView(token cũ)` trả `null`, token mới dùng được.
- `disableParentLink`: token thành `null`, `getParentView` trả `null`.
- User khác gọi `generate`/`disable` trên HS không phải của mình: `NOT_FOUND`.
- Token sai dạng (`"abc"`, 43 ký tự có `/`) hoặc đúng dạng nhưng không tồn tại: trả `null`.
- Cách ly dữ liệu: ca có 2 HS A và B, xem link của A thì `attendance` chỉ có dòng của A. `JSON.stringify(view)` không chứa tên B, `parentPhone`, `notes` của A, `title`/`notes` của ca. Mọi `notice.payments[].note` đều `null` (lần thu trong test có tạo note).
- `attendance`: không có ca huỷ; có đủ present/late/absent/pending; số dòng present+late = `notice.presentSessions`.
- `upcoming`: không có ca quá khứ (trước hôm nay VN), không có ca huỷ, tối đa 10, đúng thứ tự.
- Tháng: `thang` rỗng thì ra tháng hiện tại. `"2020-01"` (ngoài khoảng), `"2026-13"` hay tháng tương lai đều về tháng hiện tại. HS tạo tháng này thì `prevMonth = null`. HS cũ thì xem được đúng 12 tháng.
- HS `isActive=false` thì vẫn trả view (`upcoming` rỗng). `User.isActive=false` thì trả `null`.
- Chỉ đọc: gọi `getParentView` cho tháng chưa mở, số dòng `monthlyTuition` và `payment` không đổi (giống `tuition-readonly-no-write.test.ts`).

### E2E (MỚI `tests/e2e/parent-link.spec.ts`, 390×844)
Đăng nhập, tạo HS (tên có tiền tố `E2E`) cùng 1 ca đã điểm danh có mặt tháng này và 1 ca tuần sau. Vào `/students`, mở menu ⋯, chọn "Link phụ huynh", bấm "Tạo link", đọc URL trong ô. Mở **context mới không cookie** và `goto(url)`:
- status 200; header `x-robots-tag` chứa `noindex`, `cache-control` chứa `no-store`; có thẻ `meta[name=robots]` chứa `noindex`;
- thấy tên HS, "Còn phải trả", dòng điểm danh "Có mặt", mục "Lịch sắp tới" có ca tuần sau;
- bấm "Tháng trước" thì URL có `?thang=` và tiêu đề tháng đổi;
- không tràn ngang, link tháng ≥ 44px.

Quay lại context giáo viên, bấm "Tạo lại link". Mở URL cũ ở context mới thì ra 404. Bấm "Tắt link" thì URL mới cũng ra 404. Mở `/p/khongtontai` cũng ra 404, và không bị chuyển hướng sang `/login`.

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` đều sạch. Test chỉ chạy trên `.env.test`.

## 11. Interface cho các phần sau

| Tên | Loại | Ghi chú |
|---|---|---|
| `Student.parentLinkToken` | cột | F: nếu sao lưu bảng `students` nguyên dạng thì file có token, và ai giữ file đều mở được link. F nên bỏ cột này hoặc ghi rõ cảnh báo. |
| `getParentView`, `ParentViewDTO` | service / type | Chỉ page `/p/[token]` dùng. |
| `LanguageProvider forcedLanguage` | prop | Trang công khai nào cần cố định ngôn ngữ thì dùng. |

## 12. Yêu cầu với B/C

- **C, `TuitionNoticeCard`**: như C mục 11 đã hứa, card phải là client component thuần: không gọi tRPC, không `useSession`, chỉ cần `LanguageProvider`, và nhận được DTO đã serialize (mọi trường là string/number/null, không có `Date`). Card **không hiển thị** `payments[].note` (C mục 6.3 đã chỉ in ngày · hình thức · số tiền). G vẫn tự đặt `note` thành `null` phòng khi C đổi.
- **C, `getTuitionNotice`**: giữ đúng tính chất chỉ đọc (`persist=false`) và trả `NOT_FOUND` khi HS không thuộc `userId`. G gọi hàm này với `userId` lấy từ chính dòng HS tìm theo token, nên không lẫn sang user khác.
- **C, `TuitionNoticeDTO`**: không thêm trường nhạy cảm (SĐT phụ huynh, ghi chú tháng `MonthlyTuition.notes`). Nếu sau này cần thêm, phải cập nhật bước lọc ở G 7.1.4.
- **B**: không cần gì thêm. G chỉ nhận lần thu gián tiếp qua `getTuitionNotice`.
- Code G **sau khi** B và C đã merge vào `main`.

## 13. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Link bị chuyển tiếp cho người ngoài | Giáo viên "Tạo lại" hoặc "Tắt" bằng 1 thao tác. Trang không có SĐT hay ghi chú. Đây là đánh đổi người dùng đã chọn (link không hết hạn). |
| Lộ dữ liệu qua RSC payload | DTO liệt kê từng trường, không spread Prisma. Integration test quét `JSON.stringify(view)`. |
| Sửa `matcher` mở nhầm route khác | Viết `p/` có dấu `/`. E2E kiểm `/p/...` không chuyển hướng. Test sẵn có kiểm `/students` khi chưa đăng nhập vẫn bị chuyển về `/login`. |
| Token nằm trong log hay analytics (Vercel request log, `SpeedInsights` gửi path) | Chỉ chủ tài khoản Vercel (chính giáo viên) xem được. `Referrer-Policy: no-referrer` chặn rò ra bên thứ ba. Nếu cần thì sau này thêm `beforeSend` che path cho `SpeedInsights`. |
| Zalo/Facebook tạo bản xem trước link | Crawler chỉ thấy title chung "Thông tin học tập". `noindex` chặn máy tìm kiếm lập chỉ mục. |
| Card 360px chật trên máy < 390px | 360px là giới hạn của C. Khung trang cho `overflow-x-auto` riêng quanh card để không làm tràn cả trang. |
| Số trên trang phụ huynh lệch màn Học phí | Dùng chung `getTuitionNotice`, tức `getMonthlyTuitionStatus`. Điểm danh dùng cùng điều kiện lọc ca. |
