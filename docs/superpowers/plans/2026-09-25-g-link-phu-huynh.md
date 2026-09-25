# G — Link chỉ-đọc cho phụ huynh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên tạo/tạo lại/tắt được 1 link cố định cho mỗi học sinh; phụ huynh mở `/p/<token>` không cần đăng nhập, xem phiếu học phí (có QR), 12 tháng gần nhất, điểm danh tháng và lịch sắp tới, chỉ đọc.

**Architecture:** 1 cột `Student.parentLinkToken` (unique, nullable). `parent-link.service.ts` có 2 hàm ghi (tạo/tắt, qua 2 mutation `student.*` được bảo vệ) và 1 hàm chỉ đọc `getParentView` trả DTO liệt kê từng trường. Trang Server Component `src/app/p/[token]/page.tsx` gọi thẳng service (không có endpoint tRPC công khai), bọc `LanguageProvider forcedLanguage="vi"` và render `ParentView` (client) dùng lại `TuitionNoticeCard` của C. `middleware.ts` loại `p/` khỏi matcher; `next.config.mjs` thêm `X-Robots-Tag` và `Referrer-Policy` cho `/p/*`.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, Prisma 5, Zod, Tailwind 3, shadcn/ui, lucide-react, Vitest (jsdom cho component), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-g-link-phu-huynh-design.md`

## Global Constraints

- **Phụ thuộc:** G code **sau khi** B (`2026-09-25-b-lich-su-thu-tien-design.md`) và C (`2026-09-25-c-phieu-bao-hoc-phi-vietqr-design.md`) đã merge vào `main`. Plan này viết theo interface ở mục 11 của B và C, lúc viết B/C **chưa có code**. Mọi task đụng tới interface của B/C (`getTuitionNotice`, `TuitionNoticeDTO`, `PaymentDTO`, `TuitionNoticeCard`, `payment.create`, `tuition.updateSettlement`, key i18n `share`): **đối chiếu interface thật trong code trước khi làm; lệch với plan thì theo code thật và ghi lại** vào `.superpowers/g-bc-interfaces.md` (Task 1 tạo file này) và vào báo cáo task.
- **AN TOÀN DB:** trước mọi lệnh DB đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` KHÁC `.env.test`. `.env` = PRODUCTION (host `ep-polished-voice`), `.env.test` = test (host `ep-jolly-dew`). Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`).
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push --force-reset`, `pnpm build` (chạy `migrate deploy` lên prod), `pnpm dev` (dùng DB prod). Build kiểm tra bằng `pnpm exec next build`.
- **Migration mới:** tạo bằng `prisma migrate dev --create-only` với `DATABASE_URL`/`DIRECT_URL` của `.env.test` (package.json **không có** `dotenv-cli`; lệnh an toàn đã viết sẵn ở Task 2), đọc lại SQL, áp lên DB test; KHÔNG bao giờ áp lên prod thủ công (prod tự chạy `prisma migrate deploy` khi Vercel build sau merge). Prisma hỏi reset hay báo drift thì DỪNG, không đồng ý, báo người dùng.
- Chạy test 1 file: `pnpm test <đường-dẫn>`; không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ mất ~10–15 phút.
- **E2E:** cổng 3000 có thể bị project khác chiếm, không tắt tiến trình đó. Dùng config tạm git-ignored `.superpowers/pw-3100.config.ts` (nội dung ở Task 6), port 3100, url kiểm tra `http://127.0.0.1:3100/login`, `reuseExistingServer: true`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. `ResponsiveList` render cả bảng lẫn thẻ → lọc phần tử visible hoặc dùng test id.
- i18n: `src/language/vi.json` và `en.json` phải cùng bộ key. Chuỗi mới không dùng dấu gạch dài (—).
- Thông báo lỗi server giữ tiếng Việt.
- Ghi chú code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy.
- Không thêm dependency. Giữ nhận diện A1: indigo/slate, lucide-react, shadcn/ui, vùng chạm ≥ 44px trên mobile (`h-11`, `min-h-11`), viewport mobile kiểm thử 390×844.
- Mỗi task kết thúc bằng: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit trên nhánh `feat/g-parent-link` (không commit lên `main`).
- **Agent thực hiện task KHÔNG merge, KHÔNG push.** Merge/push do người điều phối làm sau review cuối.
- Không nhập mật khẩu/credential vào trình duyệt; không thao tác ghi trên tài khoản production.
- Commit message kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```

## Điều chỉnh so với spec

1. **`teacherName` khi giáo viên chưa đặt họ tên:** C tính `user.fullName ?? username`, tức là lộ **tên đăng nhập** trên trang công khai. Spec nói "thông tin giáo viên chỉ có tên" nên `getParentView` ghi đè `notice.teacherName = user.fullName || "Giáo viên"` (select thêm `user.fullName`). Có test.
2. **Thêm 2 key i18n** ngoài 21 key của spec: `link_created` ("Đã tạo link mới") và `link_disabled` ("Đã tắt link") cho toast sau mutation (spec yêu cầu toast nhưng không đặt key). Nếu C chưa thêm key `share` thì Task 4 thêm `share`.
3. **Dùng lại key/hằng có sẵn thay vì thêm key:** tiêu đề tháng `${t("month")} ${m}/${yyyy}` ("Tháng 9/2026"), `${t("grade")} ${grade}` ("Lớp 5"), `${t("teacher_fallback")}: …` ("Giáo viên: …"). Nhãn điểm danh dùng hằng `ATTENDANCE_LABEL` trong `src/lib/constants.ts` (tiếng Việt, đúng vì trang luôn tiếng Việt). Key sẵn có `present`/`absent`/`late` có dấu `:` ở cuối nên không dùng được.
4. **`ParentLinkDialog` chỉ mount khi mở** (`{parentLinkTarget && <ParentLinkDialog key=… />}`), props `student` không null, kiểu hẹp `{ id; fullName; parentLinkToken }`. Token giữ trong state cục bộ, lấy từ kết quả mutation, vì prop `student` là bản chụp lúc mở menu. Không gọi `utils.student.list.invalidate()` thủ công: `TRPCProvider` đã invalidate toàn bộ query sau mọi mutation thành công.
5. **`DialogDescription` luôn hiện** (Radix cần cho a11y). Spec chỉ ghi mô tả ở trạng thái "chưa có link".
6. **`?thang=a&thang=b`** khiến `searchParams.thang` là mảng. Page chỉ truyền xuống khi là string, nếu không thì coi như không chọn tháng.
7. **Test thêm ngoài spec:** unit test regex matcher của middleware (`tests/unit/middleware-matcher.test.ts`) và unit test `ParentView` (`tests/unit/components/ParentView.test.tsx`, mock `TuitionNoticeCard`).
8. **E2E tạo dữ liệu (HS, ca, điểm danh) bằng Prisma trực tiếp** trong `beforeAll`, có chặn host phải là host `.env.test`. Phần giáo viên (mở menu, tạo, tạo lại, tắt link) vẫn đi qua UI như spec.

## Review Focus

1. **Truy vấn trùng tham số `?thang=2026-08&thang=2026-07`** → trang vẫn 200 và hiện tháng hiện tại, không 500. Pin: e2e Task 6.
2. **Giáo viên chưa đặt họ tên (`fullName = null`)** → phiếu ghi "Giáo viên", RSC payload không chứa tên đăng nhập. Pin: integration Task 3.
3. **HS tạo lúc 00:00–06:59 ngày 1 giờ VN** (theo UTC vẫn là tháng trước) → không có "Tháng trước", tháng nhỏ nhất tính theo giờ VN. Pin: integration Task 3.
4. **Mở link lúc 00:00–06:59 sáng giờ VN** (theo UTC vẫn là hôm qua) → "Lịch sắp tới" không hiện ca hôm qua. Pin: integration Task 3 (giả giờ hệ thống bằng `vi.useFakeTimers({ toFake: ["Date"] })`).
5. **Bấm "Tạo lại" / "Tắt" liên tục** → không gửi 2 request chồng nhau (nút `disabled` khi mutation đang chạy), ô link hiện token của lần gọi cuối. Pin: đọc code ở review cuối (Task 7 Step 4).

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `prisma/schema.prisma` | Sửa | `Student.parentLinkToken` | 2 |
| `prisma/migrations/<ts>_add_student_parent_link_token/migration.sql` | Mới | ADD COLUMN + UNIQUE INDEX | 2 |
| `src/server/services/parent-link.service.ts` | Mới | `PARENT_TOKEN_REGEX`, `generateParentLink`, `disableParentLink` (T2); `getParentView` (T3) | 2, 3 |
| `src/server/trpc/routers/student.ts` | Sửa | 2 mutation | 2 |
| `src/lib/types/models.ts` | Sửa | `ParentSessionDTO`, `ParentViewDTO` | 3 |
| `tests/integration/parent-link.test.ts` | Mới | Tạo/tắt link (T2), xem link + bảo mật (T3) | 2, 3 |
| `src/components/providers/LanguageProvider.tsx` | Sửa | prop `forcedLanguage` | 4 |
| `src/language/vi.json`, `en.json` | Sửa | 23 key mới (+`share` nếu thiếu) | 4 |
| `tests/unit/components/LanguageProvider.test.tsx` | Mới | | 4 |
| `src/components/parent/ParentView.tsx` | Mới | Giao diện trang phụ huynh | 5 |
| `src/app/p/[token]/page.tsx` | Mới | Route công khai | 5 |
| `src/middleware.ts` | Sửa | matcher loại `p/` | 5 |
| `next.config.mjs` | Sửa | `headers()` cho `/p/:path*` | 5 |
| `tests/unit/next15-contract.test.ts` | Sửa | `ALLOWED` + assertion await | 5 |
| `tests/unit/middleware-matcher.test.ts` | Mới | | 5 |
| `tests/unit/components/ParentView.test.tsx` | Mới | | 5 |
| `src/components/students/ParentLinkDialog.tsx` | Mới | Dialog tạo/sao chép/chia sẻ/tạo lại/tắt | 6 |
| `src/components/students/StudentList.tsx` | Sửa | Mục menu "Link phụ huynh" | 6 |
| `tests/e2e/parent-link.spec.ts` | Mới | E2E 390px | 6 |

---

### Task 1: Tạo nhánh, kiểm tra B và C đã merge

**Đọc trước:** Global Constraints ở trên; spec G mục 11–12; spec B mục 11; spec C mục 7.4 và 11.

**Files:**
- Create (git-ignored, không commit): `.superpowers/g-bc-interfaces.md`

**Interfaces:**
- Produces: nhánh `feat/g-parent-link`; file ghi chú `.superpowers/g-bc-interfaces.md` chứa chữ ký thật của các interface B/C mà task 3–6 dùng.

- [ ] **Step 1: Xác nhận DB test khác production**

Run:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: `env=` chứa `ep-polished-voice`, `test=` chứa `ep-jolly-dew`, 2 host khác nhau. Giống nhau → DỪNG, báo người dùng.

- [ ] **Step 2: Cập nhật main**

```bash
git status --short          # phải sạch; không sạch → DỪNG, báo người dùng
git fetch origin
git checkout main
git pull --ff-only
```

- [ ] **Step 3: Kiểm tra B và C đã merge**

Run:
```bash
grep -n "^model Payment" prisma/schema.prisma
grep -n "bankBin" prisma/schema.prisma
grep -rn "export async function getTuitionNotice" src/server/services/
ls src/components/tuition/TuitionNoticeCard.tsx src/lib/vietqr.ts
grep -n "TuitionNoticeDTO\|PaymentDTO" src/lib/types/models.ts
```
Expected: mỗi lệnh có kết quả (model `Payment`, cột `bankBin`, hàm `getTuitionNotice`, 2 file tồn tại, 2 type). **Thiếu bất kỳ mục nào → DỪNG, báo người dùng "B/C chưa merge vào main", không làm tiếp.**

- [ ] **Step 4: Tạo nhánh**

```bash
git checkout -b feat/g-parent-link   # nhánh đã có thì: git checkout feat/g-parent-link && git merge --ff-only main
```

Nếu file plan này chưa có trên `main` thì đọc nó từ nhánh docs: `git show docs/plans-b-g:docs/superpowers/plans/2026-09-25-g-link-phu-huynh.md`.

- [ ] **Step 5: Ghi lại interface thật của B/C**

Chạy và đọc kết quả:
```bash
grep -rn "export async function getTuitionNotice" -A 6 src/server/services/
grep -n "TuitionNoticeDTO\|PaymentDTO" -A 25 src/lib/types/models.ts
grep -n "export\|Props\|notice\|onReady\|note" src/components/tuition/TuitionNoticeCard.tsx
grep -n "create:\|updateSettlement" src/server/trpc/routers/payment.ts src/server/trpc/routers/tuition.ts
grep -n "paymentCreateSchema" -A 12 src/lib/schemas/payment.ts
grep -n "updateSettlementSchema" -A 8 src/lib/schemas/tuition.ts
grep -n '"share"\|Còn phải trả' src/language/vi.json src/components/tuition/TuitionNoticeCard.tsx
grep -n "updateBankAccount" src/server/trpc/routers/settings.ts
```

Tạo `.superpowers/g-bc-interfaces.md` (thư mục `.superpowers/` bị git bỏ qua; `git check-ignore -v .superpowers/g-bc-interfaces.md` phải in ra 1 dòng) ghi đúng những gì thấy, theo mẫu:

```markdown
# Interface B/C thật (đối chiếu cho plan G)
- getTuitionNotice: <file>:<dòng> — chữ ký: <chép nguyên>
- Có dùng persist=false / chỉ đọc: <có/không, dòng nào>
- Ném NOT_FOUND khi HS không thuộc userId: <có/không>
- TuitionNoticeDTO: <chép nguyên type>. Có Date không? <không/có trường nào>
- PaymentDTO: <chép nguyên type>
- TuitionNoticeCard: export <named/default> tên <...>, props <...>
- Card có hiển thị payments[].note không: <không/có>
- payment.create input: <chép>
- tuition.updateSettlement input: <chép>
- Key i18n "share": <có/không>
- Chữ "Còn phải trả" trên card: <key nào / literal>
- settings.updateBankAccount input: <chép>
- Lệch so với plan G: <liệt kê hoặc "không">
```

Nếu `getTuitionNotice` **không** chỉ đọc, hoặc **không** ném `NOT_FOUND` với HS của user khác, hoặc `TuitionNoticeDTO` có trường nhạy cảm (SĐT phụ huynh, `MonthlyTuition.notes`, ghi chú HS) → DỪNG, báo người dùng (vi phạm yêu cầu G mục 12).

- [ ] **Step 6: Baseline**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sạch. Không sạch → ghi lại lỗi có sẵn trên main vào báo cáo, không sửa.

(Không có commit ở task này.)

---

### Task 2: Cột `parentLinkToken`, tạo/tắt link

**Đọc trước:** spec G mục 4 (S1, S2), 7.1 (2 hàm đầu), 7.3, 8; `docs/coding-rule.md` §6.1; `src/server/services/_base.service.ts`; `src/server/trpc/routers/student.ts`; `tests/helpers/trpc.ts`.

**Files:**
- Modify: `prisma/schema.prisma` (model `Student`, sau dòng `tuitionFee`)
- Create: `prisma/migrations/<timestamp>_add_student_parent_link_token/migration.sql` (Prisma sinh)
- Create: `src/server/services/parent-link.service.ts`
- Modify: `src/server/trpc/routers/student.ts`
- Test: `tests/integration/parent-link.test.ts` (mới)

**Interfaces:**
- Consumes: `assertOwnership(record, userId)` từ `src/server/services/_base.service.ts`; `getAuthedCaller(username?)`, `publicCaller` từ `tests/helpers/trpc.ts`.
- Produces:
  - `Student.parentLinkToken: string | null` (Prisma), `student.list` tự trả thêm trường này.
  - `PARENT_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/` (export).
  - `generateParentLink(db: PrismaClient, userId: number, studentId: number): Promise<{ token: string }>`
  - `disableParentLink(db: PrismaClient, userId: number, studentId: number): Promise<{ success: true }>`
  - tRPC: `student.generateParentLink({ id: number })` → `{ token }`; `student.disableParentLink({ id: number })` → `{ success: true }`.

- [ ] **Step 1: Viết test fail**

Tạo `tests/integration/parent-link.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { PARENT_TOKEN_REGEX } from "@/server/services/parent-link.service"

async function cleanup() {
  await db.monthlyTuition.deleteMany() // cascade xoá Payment (B)
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({ data: { isActive: true } })
  await db.user.update({ where: { username: "teacher2" }, data: { fullName: "Giáo viên Test 2" } })
}

beforeEach(cleanup)
afterAll(cleanup)

describe("student.generateParentLink / disableParentLink", () => {
  it("tạo link → token 43 ký tự base64url, student.list trả đúng token", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Có Link", grade: 5 })
    const { token } = await caller.student.generateParentLink({ id: s.id })
    expect(token).toMatch(PARENT_TOKEN_REGEX)
    const list = await caller.student.list({ search: "HS Có Link" })
    expect(list.items[0].parentLinkToken).toBe(token)
  })

  it("tạo lại → token đổi, token cũ không còn trong DB", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Tạo Lại", grade: 5 })
    const first = await caller.student.generateParentLink({ id: s.id })
    const second = await caller.student.generateParentLink({ id: s.id })
    expect(second.token).not.toBe(first.token)
    expect(await db.student.findUnique({ where: { parentLinkToken: first.token } })).toBeNull()
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBe(second.token)
  })

  it("tắt link → parentLinkToken = null", async () => {
    const caller = await getAuthedCaller()
    const s = await caller.student.create({ fullName: "HS Tắt Link", grade: 5 })
    await caller.student.generateParentLink({ id: s.id })
    expect(await caller.student.disableParentLink({ id: s.id })).toEqual({ success: true })
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBeNull()
  })

  it("HS của user khác → NOT_FOUND cho cả tạo và tắt, token giữ nguyên", async () => {
    const owner = await getAuthedCaller()
    const other = await getAuthedCaller("teacher2")
    const s = await owner.student.create({ fullName: "HS Của Người Khác", grade: 5 })
    const { token } = await owner.student.generateParentLink({ id: s.id })
    await expect(other.student.generateParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(other.student.disableParentLink({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).parentLinkToken).toBe(token)
  })

  it("chưa đăng nhập → UNAUTHORIZED", async () => {
    await expect(publicCaller.student.generateParentLink({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    await expect(publicCaller.student.disableParentLink({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/parent-link.test.ts`
Expected: FAIL (không import được `@/server/services/parent-link.service`).

- [ ] **Step 3: Sửa schema**

Trong `prisma/schema.prisma`, model `Student`, thêm ngay dưới dòng `tuitionFee`:

```prisma
  parentLinkToken String?          @unique @map("parent_link_token") @db.VarChar(43)
```

- [ ] **Step 4: Sinh migration trên DB test (không đụng prod)**

Mỗi lệnh dưới đây chạy trong subshell chỉ nạp `DATABASE_URL`/`DIRECT_URL` của `.env.test`. Biến có sẵn trong process được ưu tiên hơn `.env` mà Prisma tự đọc.

a) Kiểm tra host trước:
```bash
( set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a; pnpm exec prisma migrate status )
```
Expected: dòng `Datasource "db": PostgreSQL database ... at "<host>"` có host chứa `ep-jolly-dew`. **Host chứa `ep-polished-voice` → DỪNG NGAY.** Nếu báo còn migration của B/C chưa áp trên DB test thì áp bằng lệnh c) trước (vẫn là DB test).

b) Sinh file migration:
```bash
( set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a; pnpm exec prisma migrate dev --create-only --name add_student_parent_link_token )
```
Nếu Prisma báo drift hoặc hỏi reset DB → DỪNG, không đồng ý, báo người dùng.

Đọc file vừa sinh `prisma/migrations/<timestamp>_add_student_parent_link_token/migration.sql`. Nội dung phải tương đương đúng 2 lệnh:
```sql
ALTER TABLE "students" ADD COLUMN "parent_link_token" VARCHAR(43);
CREATE UNIQUE INDEX "students_parent_link_token_key" ON "students"("parent_link_token");
```
Có thêm lệnh khác (DROP, ALTER cột khác) → DỪNG, báo người dùng.

c) Áp lên DB test và sinh client:
```bash
( set -a; eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.test)"; set +a; pnpm exec prisma migrate deploy )
pnpm exec prisma generate
```
Expected: `All migrations have been successfully applied` trên host `ep-jolly-dew`.

- [ ] **Step 5: Viết service**

Tạo `src/server/services/parent-link.service.ts`:

```ts
import { randomBytes } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { assertOwnership } from "./_base.service"

// 32 byte base64url = 43 ký tự. Kiểm dạng trước khi truy vấn để token rác không chạm DB.
export const PARENT_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/

async function assertStudentOwned(db: PrismaClient, userId: number, studentId: number) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true },
  })
  assertOwnership(student, userId)
}

export async function generateParentLink(
  db: PrismaClient,
  userId: number,
  studentId: number
): Promise<{ token: string }> {
  await assertStudentOwned(db, userId, studentId)
  // Ghi đè token = link cũ chết ngay. Trùng unique gần như không thể nên chỉ thử lại 1 lần.
  for (let attempt = 0; ; attempt++) {
    const token = randomBytes(32).toString("base64url")
    try {
      await db.student.update({ where: { id: studentId }, data: { parentLinkToken: token } })
      return { token }
    } catch (e) {
      const isDuplicate =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
      if (!isDuplicate || attempt > 0) throw e
    }
  }
}

export async function disableParentLink(
  db: PrismaClient,
  userId: number,
  studentId: number
): Promise<{ success: true }> {
  await assertStudentOwned(db, userId, studentId)
  await db.student.update({ where: { id: studentId }, data: { parentLinkToken: null } })
  return { success: true }
}
```

- [ ] **Step 6: Thêm router**

Trong `src/server/trpc/routers/student.ts`, thêm import:

```ts
import {
  disableParentLink,
  generateParentLink,
} from "@/server/services/parent-link.service"
```

và 2 procedure cuối object `createTRPCRouter({ ... })`, sau `getUpgradeLogThisYear`:

```ts
  generateParentLink: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => generateParentLink(ctx.db, ctx.userId, input.id)),

  disableParentLink: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => disableParentLink(ctx.db, ctx.userId, input.id)),
```

- [ ] **Step 7: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/parent-link.test.ts`
Expected: PASS 5/5.

- [ ] **Step 8: Test HS cũ vẫn xanh + typecheck + lint**

Run: `pnpm test tests/integration/student.test.ts && pnpm exec tsc --noEmit && pnpm lint`
Expected: pass, không lỗi.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/server/services/parent-link.service.ts src/server/trpc/routers/student.ts tests/integration/parent-link.test.ts
git commit -m "feat(student): cột parentLinkToken, mutation tạo/tắt link phụ huynh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: `getParentView` (chỉ đọc) + `ParentViewDTO` + test bảo mật

**Đọc trước:** spec G mục 2, 4 (S5–S8, S11), 7.1 (`getParentView`), 7.2, 10 (Integration), 12; `.superpowers/g-bc-interfaces.md` (Task 1); `src/lib/utils.ts` (`vnDateParts`, `formatTime`); `src/server/services/tuition.service.ts` dòng ~117–135 (điều kiện `currentAttendance`); `tests/integration/tuition-readonly-no-write.test.ts`.

Bảo mật là trọng tâm review của task này: mọi test trong Step 1 phải có.

**Files:**
- Modify: `src/lib/types/models.ts` (thêm 2 type cuối file)
- Modify: `src/server/services/parent-link.service.ts`
- Test: `tests/integration/parent-link.test.ts` (thêm `describe` mới)

**Interfaces:**
- Consumes:
  - `getTuitionNotice(db, userId, { studentId, year, month }): Promise<TuitionNoticeDTO>` (C, `src/server/services/tuition-notice.service.ts`; đối chiếu `.superpowers/g-bc-interfaces.md`).
  - `TuitionNoticeDTO` (C, `src/lib/types/models.ts`): có `teacherName: string`, `payments: PaymentDTO[]`, `presentSessions: number`, `qr: {...} | null`.
  - `PaymentDTO` (B): `{ id, amount, paidAt: "YYYY-MM-DD", method, note }`.
  - `caller.payment.create({ studentId, year, month, amount, paidAt, method, note })` (B), `caller.tuition.updateSettlement({ studentId, year, month, isFullPaid, notes })` (B).
  - Task 2: `generateParentLink`, `PARENT_TOKEN_REGEX`, `student.generateParentLink`, `student.disableParentLink`.
- Produces:
  - `type ParentSessionDTO = { date: string; startTime: string; endTime: string; subjectName: string; attendance: "pending" | "present" | "absent" | "late" }`
  - `type ParentViewDTO = { student: { fullName: string; grade: number }; year: number; month: number; prevMonth: string | null; nextMonth: string | null; notice: TuitionNoticeDTO; attendance: ParentSessionDTO[]; upcoming: ParentSessionDTO[] }`
  - `getParentView(db: PrismaClient, token: string, thang?: string): Promise<ParentViewDTO | null>`

- [ ] **Step 1: Viết test fail**

Trong `tests/integration/parent-link.test.ts`, sửa dòng import đầu file thành:

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { vnDateParts } from "@/lib/utils"
import type { AttendanceStatus } from "@/lib/schemas/attendance"
import {
  getParentView,
  PARENT_TOKEN_REGEX,
} from "@/server/services/parent-link.service"
```

Thêm dưới `afterAll(cleanup)`:

```ts
type Caller = Awaited<ReturnType<typeof getAuthedCaller>>

// Ngày theo lịch VN, dạng "YYYY-MM-DD" (sessionDate lưu UTC midnight của ngày VN).
function vnDay(offset = 0): string {
  const { year, month, day } = vnDateParts()
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
}

function ym(offsetMonths = 0): string {
  const { year, month } = vnDateParts()
  const d = new Date(Date.UTC(year, month - 1 + offsetMonths, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function viewYm(v: { year: number; month: number }): string {
  return `${v.year}-${String(v.month).padStart(2, "0")}`
}

async function setup(caller: Caller, fullName = "HS Xem Link") {
  const subject = (await caller.subject.list({}))[0]
  const student = await caller.student.create({ fullName, grade: 5, tuitionFee: 100000 })
  const { token } = await caller.student.generateParentLink({ id: student.id })
  return { subject, student, token }
}

async function addSession(
  caller: Caller,
  subjectId: number,
  studentIds: number[],
  date: string,
  startTime: string,
  endTime: string,
  attendance?: AttendanceStatus
) {
  const s = await caller.session.create({ sessionDate: date, startTime, endTime, subjectId, studentIds })
  if (attendance) {
    await caller.attendance.update({
      sessionId: s.id,
      attendances: studentIds.map((studentId) => ({ studentId, attendance, fee: 100000 })),
    })
  }
  return s
}
```

Thêm `describe` mới cuối file:

```ts
describe("getParentView", () => {
  it("token cũ sau khi tạo lại, token đã tắt, sai dạng, không tồn tại → đều null như nhau", async () => {
    const caller = await getAuthedCaller()
    const { student, token: oldToken } = await setup(caller)
    expect(await getParentView(db, oldToken)).not.toBeNull()

    const { token: newToken } = await caller.student.generateParentLink({ id: student.id })
    expect(await getParentView(db, oldToken)).toBeNull()
    expect(await getParentView(db, newToken)).not.toBeNull()

    await caller.student.disableParentLink({ id: student.id })
    expect(await getParentView(db, newToken)).toBeNull()

    for (const bad of ["", "abc", "a".repeat(42) + "/", "a".repeat(44), "A".repeat(43)]) {
      expect(await getParentView(db, bad)).toBeNull()
    }
    expect(PARENT_TOKEN_REGEX.test("a".repeat(42) + "/")).toBe(false)
  })

  it("chỉ chứa dữ liệu của HS này: không lộ HS khác, SĐT, ghi chú, tiêu đề ca; mọi note lần thu = null", async () => {
    const caller = await getAuthedCaller()
    const subject = (await caller.subject.list({}))[0]
    const a = await caller.student.create({
      fullName: "HS An Riêng", grade: 5, tuitionFee: 100000,
      parentPhone: "0909111222", parentName: "PH Bí Mật", notes: "GhiChuHSBiMat",
    })
    const b = await caller.student.create({ fullName: "HS Bình Khác", grade: 5, tuitionFee: 100000 })
    const s = await caller.session.create({
      sessionDate: vnDay(0), startTime: "06:00", endTime: "07:00", subjectId: subject.id,
      studentIds: [a.id, b.id], title: "TieuDeCaBiMat", notes: "GhiChuCaBiMat",
    })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [
        { studentId: a.id, attendance: "present", fee: 100000, note: "GhiChuDiemDanhBiMat" },
        { studentId: b.id, attendance: "absent", fee: 100000 },
      ],
    })
    const { year, month } = vnDateParts()
    // Đối chiếu input thật của B trong .superpowers/g-bc-interfaces.md
    await caller.payment.create({
      studentId: a.id, year, month, amount: 50000, paidAt: vnDay(0), method: "cash", note: "GhiChuLanThuBiMat",
    })
    await caller.tuition.updateSettlement({ studentId: a.id, year, month, isFullPaid: false, notes: "GhiChuThangBiMat" })
    const { token } = await caller.student.generateParentLink({ id: a.id })

    const view = await getParentView(db, token)
    expect(view).not.toBeNull()
    expect(Object.keys(view!).sort()).toEqual(
      ["attendance", "month", "nextMonth", "notice", "prevMonth", "student", "upcoming", "year"]
    )
    expect(Object.keys(view!.student).sort()).toEqual(["fullName", "grade"])
    expect(view!.attendance).toHaveLength(1)
    expect(Object.keys(view!.attendance[0]).sort()).toEqual(
      ["attendance", "date", "endTime", "startTime", "subjectName"]
    )
    expect(view!.attendance[0].attendance).toBe("present")
    expect(view!.notice.payments.length).toBeGreaterThan(0)
    for (const p of view!.notice.payments) expect(p.note).toBeNull()

    const json = JSON.stringify(view)
    for (const secret of [
      "HS Bình Khác", "0909111222", "PH Bí Mật", "GhiChuHSBiMat", "TieuDeCaBiMat", "GhiChuCaBiMat",
      "GhiChuDiemDanhBiMat", "GhiChuLanThuBiMat", "GhiChuThangBiMat",
      '"userId"', '"parentLinkToken"', '"passwordHash"', '"parentPhone"', token,
    ]) {
      expect(json, `RSC payload lộ: ${secret}`).not.toContain(secret)
    }
  })

  it("giáo viên chưa đặt họ tên → teacherName 'Giáo viên', không lộ tên đăng nhập", async () => {
    const caller = await getAuthedCaller("teacher2")
    const { token } = await setup(caller)
    await db.user.update({ where: { username: "teacher2" }, data: { fullName: null } })
    const view = await getParentView(db, token)
    expect(view!.notice.teacherName).toBe("Giáo viên")
    expect(JSON.stringify(view)).not.toContain('"teacher2"')
  })

  it("điểm danh tháng: bỏ ca huỷ, đủ 4 trạng thái, sắp theo giờ, có mặt+muộn = presentSessions của phiếu", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    const today = vnDay(0)
    await addSession(caller, subject.id, [student.id], today, "09:00", "09:30", "present")
    await addSession(caller, subject.id, [student.id], today, "07:00", "07:30", "late")
    await addSession(caller, subject.id, [student.id], today, "11:00", "11:30", "absent")
    await addSession(caller, subject.id, [student.id], today, "13:00", "13:30")
    const cancelled = await addSession(caller, subject.id, [student.id], today, "15:00", "15:30", "present")
    await db.teachingSession.update({ where: { id: cancelled.id }, data: { status: "cancelled" } })

    const view = (await getParentView(db, token))!
    expect(view.attendance.map((r) => r.startTime)).toEqual(["07:00", "09:00", "11:00", "13:00"])
    expect(view.attendance.map((r) => r.attendance)).toEqual(["late", "present", "absent", "pending"])
    expect(view.attendance.every((r) => r.date === today && r.subjectName === subject.name)).toBe(true)
    expect(view.attendance[0].endTime).toBe("07:30")
    const attended = view.attendance.filter((r) => r.attendance === "present" || r.attendance === "late").length
    expect(attended).toBe(2)
    expect(view.notice.presentSessions).toBe(attended)
  })

  it("lịch sắp tới: bỏ ca quá khứ và ca huỷ, tối đa 10, sắp theo ngày rồi giờ", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    await addSession(caller, subject.id, [student.id], vnDay(-1), "06:00", "07:00")
    for (let i = 1; i <= 11; i++) {
      await addSession(caller, subject.id, [student.id], vnDay(i), "18:00", "19:00")
    }
    await addSession(caller, subject.id, [student.id], vnDay(1), "08:00", "09:00") // tạo sau nhưng giờ sớm hơn
    const cancelled = await addSession(caller, subject.id, [student.id], vnDay(2), "10:00", "11:00")
    await db.teachingSession.update({ where: { id: cancelled.id }, data: { status: "cancelled" } })

    const { upcoming } = (await getParentView(db, token))!
    expect(upcoming).toHaveLength(10)
    expect(upcoming[0]).toMatchObject({ date: vnDay(1), startTime: "08:00" })
    expect(upcoming[1]).toMatchObject({ date: vnDay(1), startTime: "18:00" })
    expect(upcoming.map((u) => u.date)).not.toContain(vnDay(-1))
    expect(upcoming.some((u) => u.startTime === "10:00")).toBe(false)
    const keys = upcoming.map((u) => `${u.date} ${u.startTime}`)
    expect(keys).toEqual([...keys].sort())
  })

  it("'hôm nay' tính theo giờ VN: 01:00 sáng VN (UTC còn là hôm qua) thì không hiện ca hôm qua", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    const d = vnDay(30)
    const prev = vnDay(29)
    await addSession(caller, subject.id, [student.id], prev, "18:00", "19:00")
    await addSession(caller, subject.id, [student.id], d, "18:00", "19:00")

    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(Date.parse(`${d}T00:00:00Z`) - 6 * 60 * 60 * 1000)) // = 01:00 ngày d giờ VN
    try {
      const view = (await getParentView(db, token))!
      expect(view.upcoming.map((u) => u.date)).toEqual([d])
    } finally {
      vi.useRealTimers()
    }
  })

  it("tháng: rỗng/sai dạng/ngoài khoảng/tương lai → tháng hiện tại; HS mới tạo → không có tháng trước/sau", async () => {
    const caller = await getAuthedCaller()
    const { token } = await setup(caller)
    for (const thang of [undefined, "", "2020-01", "2026-13", "2026-9", "2026-09-01", ym(1), ym(-1)]) {
      const v = (await getParentView(db, token, thang))!
      expect(viewYm(v), `thang=${String(thang)}`).toBe(ym(0))
    }
    const v = (await getParentView(db, token))!
    expect(v.prevMonth).toBeNull()
    expect(v.nextMonth).toBeNull()
  })

  it("HS cũ: xem được đúng 12 tháng, tháng thứ 13 về tháng hiện tại", async () => {
    const caller = await getAuthedCaller()
    const { student, token } = await setup(caller)
    await db.student.update({ where: { id: student.id }, data: { createdAt: new Date("2020-01-01T00:00:00Z") } })

    const oldest = (await getParentView(db, token, ym(-11)))!
    expect(viewYm(oldest)).toBe(ym(-11))
    expect(oldest.prevMonth).toBeNull()
    expect(oldest.nextMonth).toBe(ym(-10))
    expect(viewYm((await getParentView(db, token, ym(-12)))!)).toBe(ym(0))

    const current = (await getParentView(db, token))!
    expect(current.prevMonth).toBe(ym(-1))
    expect(current.nextMonth).toBeNull()

    let count = 1
    let p = current.prevMonth
    while (p) {
      count++
      p = (await getParentView(db, token, p))!.prevMonth
    }
    expect(count).toBe(12)
  }, 180000)

  it("tháng nhỏ nhất theo giờ VN: HS tạo 04:00 ngày 1 giờ VN (UTC còn tháng trước) → không có tháng trước", async () => {
    const caller = await getAuthedCaller()
    const { student, token } = await setup(caller)
    const { year, month } = vnDateParts()
    await db.student.update({
      where: { id: student.id },
      data: { createdAt: new Date(Date.UTC(year, month - 1, 1) - 3 * 60 * 60 * 1000) },
    })
    const v = (await getParentView(db, token, ym(-1)))!
    expect(viewYm(v)).toBe(ym(0))
    expect(v.prevMonth).toBeNull()
  })

  it("HS đã nghỉ vẫn xem được (lịch sắp tới rỗng); giáo viên bị khoá → null", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    await addSession(caller, subject.id, [student.id], vnDay(3), "18:00", "19:00")
    await caller.student.delete({ id: student.id }) // softDelete gỡ HS khỏi ca chưa kết thúc

    const view = await getParentView(db, token)
    expect(view).not.toBeNull()
    expect(view!.upcoming).toEqual([])

    await db.user.update({ where: { username: "teacher" }, data: { isActive: false } })
    expect(await getParentView(db, token)).toBeNull()
  })

  it("chỉ đọc: xem tháng hiện tại và tháng chưa mở không tạo MonthlyTuition/Payment, không sửa Student", async () => {
    const caller = await getAuthedCaller()
    const { subject, student, token } = await setup(caller)
    await db.student.update({ where: { id: student.id }, data: { createdAt: new Date("2020-01-01T00:00:00Z") } })
    await addSession(caller, subject.id, [student.id], vnDay(0), "06:00", "07:00", "present")

    const before = {
      mt: await db.monthlyTuition.count(),
      pay: await db.payment.count(),
      updatedAt: (await db.student.findUniqueOrThrow({ where: { id: student.id } })).updatedAt.getTime(),
    }
    await getParentView(db, token)
    await getParentView(db, token, ym(-3))
    expect({
      mt: await db.monthlyTuition.count(),
      pay: await db.payment.count(),
      updatedAt: (await db.student.findUniqueOrThrow({ where: { id: student.id } })).updatedAt.getTime(),
    }).toEqual(before)
  })
})
```

Ghi chú cho người làm:
- Nếu input thật của `payment.create`/`tuition.updateSettlement` khác (xem `.superpowers/g-bc-interfaces.md`), sửa lời gọi cho đúng, **không bỏ** các chuỗi bí mật `GhiChuLanThuBiMat`/`GhiChuThangBiMat`.
- `publicCaller` vẫn được dùng ở describe của Task 2, giữ import.
- Nếu `vi.useFakeTimers({ toFake: ["Date"] })` làm Prisma treo hoặc lỗi thì dừng lại, báo trong báo cáo kèm log lỗi. **Không** xoá test mà không báo.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/parent-link.test.ts`
Expected: FAIL (`getParentView` chưa export). 5 test của Task 2 vẫn pass nếu chạy riêng.

- [ ] **Step 3: Thêm type**

Cuối `src/lib/types/models.ts` (sau `TuitionNoticeDTO` của C; nếu C đặt `TuitionNoticeDTO` chỗ khác thì import cho đúng):

```ts
// Trang phụ huynh công khai: chỉ liệt kê trường được phép lộ, không extends type Prisma.
export type ParentSessionDTO = {
  date: string // "YYYY-MM-DD"
  startTime: string // "HH:mm"
  endTime: string
  subjectName: string
  attendance: "pending" | "present" | "absent" | "late"
}

export type ParentViewDTO = {
  student: { fullName: string; grade: number }
  year: number
  month: number
  prevMonth: string | null // "YYYY-MM", null ở biên
  nextMonth: string | null
  notice: TuitionNoticeDTO // payments[].note luôn null
  attendance: ParentSessionDTO[]
  upcoming: ParentSessionDTO[]
}
```

- [ ] **Step 4: Viết `getParentView`**

Trong `src/server/services/parent-link.service.ts`, thêm import (sửa đường dẫn `getTuitionNotice` theo `.superpowers/g-bc-interfaces.md` nếu khác):

```ts
import { getTuitionNotice } from "./tuition-notice.service"
import { formatTime, vnDateParts } from "@/lib/utils"
import type { ParentSessionDTO, ParentViewDTO } from "@/lib/types/models"
```

Thêm cuối file:

```ts
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_MONTHS_BACK = 11
const UPCOMING_LIMIT = 10

const toMonthIndex = (year: number, month: number) => year * 12 + (month - 1)
const toYm = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`

const SESSION_SELECT = {
  attendance: true,
  session: {
    select: {
      sessionDate: true,
      startTime: true,
      endTime: true,
      subject: { select: { name: true } },
    },
  },
} satisfies Prisma.SessionStudentSelect

const SESSION_ORDER = [
  { session: { sessionDate: "asc" } },
  { session: { startTime: "asc" } },
] satisfies Prisma.SessionStudentOrderByWithRelationInput[]

type SessionRow = Prisma.SessionStudentGetPayload<{ select: typeof SESSION_SELECT }>

function toSessionDTO(row: SessionRow): ParentSessionDTO {
  return {
    date: row.session.sessionDate.toISOString().slice(0, 10),
    startTime: formatTime(row.session.startTime),
    endTime: formatTime(row.session.endTime),
    subjectName: row.session.subject.name,
    attendance: row.attendance as ParentSessionDTO["attendance"],
  }
}

// Chỉ đọc: trang công khai không được ghi gì vào DB (kể cả snapshot học phí).
export async function getParentView(
  db: PrismaClient,
  token: string,
  thang?: string
): Promise<ParentViewDTO | null> {
  if (!PARENT_TOKEN_REGEX.test(token)) return null

  const student = await db.student.findUnique({
    where: { parentLinkToken: token },
    select: {
      id: true,
      userId: true,
      fullName: true,
      grade: true,
      createdAt: true,
      user: { select: { isActive: true, fullName: true } },
    },
  })
  if (!student || !student.user.isActive) return null

  const now = vnDateParts()
  const maxIdx = toMonthIndex(now.year, now.month)
  const created = vnDateParts(student.createdAt)
  const minIdx = Math.max(maxIdx - MAX_MONTHS_BACK, toMonthIndex(created.year, created.month))
  let idx = maxIdx
  if (thang && MONTH_REGEX.test(thang)) {
    const [y, m] = thang.split("-").map(Number)
    const wanted = toMonthIndex(y, m)
    if (wanted >= minIdx && wanted <= maxIdx) idx = wanted
  }
  const year = Math.floor(idx / 12)
  const month = (idx % 12) + 1

  const notice = await getTuitionNotice(db, student.userId, { studentId: student.id, year, month })

  // Cùng điều kiện với currentAttendance trong getMonthlyTuitionStatus để số buổi khớp phiếu.
  const where = (sessionDate: Prisma.DateTimeFilter) => ({
    studentId: student.id,
    session: { userId: student.userId, sessionDate, status: { not: "cancelled" } },
  })
  const [monthRows, upcomingRows] = await Promise.all([
    db.sessionStudent.findMany({
      where: where({
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      }),
      select: SESSION_SELECT,
      orderBy: SESSION_ORDER,
    }),
    db.sessionStudent.findMany({
      where: where({ gte: new Date(Date.UTC(now.year, now.month - 1, now.day)) }),
      select: SESSION_SELECT,
      orderBy: SESSION_ORDER,
      take: UPCOMING_LIMIT,
    }),
  ])

  return {
    student: { fullName: student.fullName, grade: student.grade },
    year,
    month,
    prevMonth: idx > minIdx ? toYm(idx - 1) : null,
    nextMonth: idx < maxIdx ? toYm(idx + 1) : null,
    notice: {
      ...notice,
      // C lấy username khi thiếu họ tên: không được lộ tên đăng nhập ra trang công khai.
      teacherName: student.user.fullName || "Giáo viên",
      // Ghi chú lần thu là của giáo viên; tự lọc phòng khi card của C đổi cách hiển thị.
      payments: notice.payments.map((p) => ({ ...p, note: null })),
    },
    attendance: monthRows.map(toSessionDTO),
    upcoming: upcomingRows.map(toSessionDTO),
  }
}
```

Nếu `PaymentDTO.note` có kiểu không nhận `null` (vd. `string`), dừng lại, ghi vào báo cáo; không ép kiểu bằng `as any`.

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/parent-link.test.ts`
Expected: PASS 16/16.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/models.ts src/server/services/parent-link.service.ts tests/integration/parent-link.test.ts
git commit -m "feat(parent-link): getParentView chỉ đọc, DTO lọc từng trường, test cách ly dữ liệu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: `LanguageProvider forcedLanguage` + key i18n

**Đọc trước:** spec G mục 4 (S10), 7.5, 9; `src/components/providers/LanguageProvider.tsx`; `tests/unit/components/ResponsiveList.test.tsx` (mẫu test jsdom); `.superpowers/g-bc-interfaces.md` (key `share`).

**Files:**
- Modify: `src/components/providers/LanguageProvider.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/LanguageProvider.test.tsx` (mới)

**Interfaces:**
- Produces:
  - `LanguageProvider({ children, forcedLanguage?: "vi" | "en" })`. Có `forcedLanguage` thì bỏ qua `localStorage`, và `setLanguage` không ghi `localStorage`/cookie.
  - Key i18n (cả vi và en): `parent_link`, `parent_link_desc`, `create_link`, `copy_link`, `link_copied`, `regenerate_link`, `regenerate_link_confirm`, `disable_link`, `disable_link_confirm`, `parent_share_text`, `parent_page_title`, `prev_month`, `next_month`, `parent_attendance`, `parent_present_summary`, `parent_no_sessions`, `parent_upcoming`, `parent_no_upcoming`, `today_badge`, `parent_qr_hint`, `parent_footer`, `link_created`, `link_disabled`, và `share` (nếu C chưa có).

- [ ] **Step 1: Viết test fail**

Tạo `tests/unit/components/LanguageProvider.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { LanguageProvider, useTranslation } from "@/components/providers/LanguageProvider"

function Probe() {
  const { t, language, setLanguage } = useTranslation()
  return (
    <div>
      <p>{`${language}:${t("cancel")}`}</p>
      <button onClick={() => setLanguage("en")}>switch</button>
    </div>
  )
}

describe("LanguageProvider", () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it("forcedLanguage='vi' → vẫn tiếng Việt dù localStorage.language = 'en'", async () => {
    localStorage.setItem("language", "en")
    render(
      <LanguageProvider forcedLanguage="vi">
        <Probe />
      </LanguageProvider>
    )
    await act(async () => {})
    expect(screen.getByText("vi:Hủy")).toBeTruthy()
  })

  it("forcedLanguage: setLanguage không ghi localStorage", async () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <Probe />
      </LanguageProvider>
    )
    await act(async () => {
      screen.getByText("switch").click()
    })
    expect(localStorage.getItem("language")).toBeNull()
  })

  it("không có forcedLanguage → giữ hành vi cũ, đọc localStorage", async () => {
    localStorage.setItem("language", "en")
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    )
    expect(await screen.findByText("en:Cancel")).toBeTruthy()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/components/LanguageProvider.test.tsx`
Expected: 2 test `forcedLanguage` FAIL (prop bị bỏ qua: hiện `en:Cancel`, `localStorage` bị ghi `"en"`); test thứ 3 PASS.

- [ ] **Step 3: Sửa `LanguageProvider`**

Trong `src/components/providers/LanguageProvider.tsx`, thay chữ ký, state, effect đọc `localStorage` và `setLanguage`:

```tsx
export function LanguageProvider({
  children,
  forcedLanguage,
}: {
  children: React.ReactNode
  // Trang công khai (link phụ huynh) cố định ngôn ngữ, không theo lựa chọn đã lưu trên máy.
  forcedLanguage?: Language
}) {
  const [language, setLanguageState] = useState<Language>(forcedLanguage ?? "vi")

  useEffect(() => {
    if (forcedLanguage) return
    const savedLang = localStorage.getItem("language") as Language
    if (savedLang && (savedLang === "vi" || savedLang === "en")) {
      setLanguageState(savedLang)
    }
  }, [forcedLanguage])
```

(giữ nguyên effect đồng bộ `dayjs.locale`/`document.documentElement.lang`)

```tsx
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (forcedLanguage) return
    localStorage.setItem("language", lang)
    // Optional: set cookie for server-side awareness if needed
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`
  }
```

- [ ] **Step 4: Thêm key i18n**

Trước khi thêm: `grep -n '"share"\|"link_created"\|"prev_month"\|"today_badge"' src/language/vi.json`. Key nào đã có thì không thêm lại (ghi vào báo cáo).

Thêm vào cuối object của `src/language/vi.json` (nhớ dấu phẩy sau key cuối hiện có):

```json
  "parent_link": "Link phụ huynh",
  "parent_link_desc": "Phụ huynh mở link là xem được học phí, điểm danh và lịch học của con, không cần đăng nhập.",
  "create_link": "Tạo link",
  "copy_link": "Sao chép",
  "link_copied": "Đã sao chép link",
  "regenerate_link": "Tạo lại link",
  "regenerate_link_confirm": "Link cũ sẽ ngừng hoạt động. Phụ huynh cần nhận link mới.",
  "disable_link": "Tắt link",
  "disable_link_confirm": "Tắt link? Phụ huynh sẽ không mở được nữa.",
  "parent_share_text": "Xem học phí và lịch học của",
  "parent_page_title": "Thông tin học tập",
  "prev_month": "Tháng trước",
  "next_month": "Tháng sau",
  "parent_attendance": "Điểm danh tháng",
  "parent_present_summary": "Có mặt {n}/{total} buổi",
  "parent_no_sessions": "Tháng này chưa có buổi học.",
  "parent_upcoming": "Lịch sắp tới",
  "parent_no_upcoming": "Chưa có lịch học sắp tới.",
  "today_badge": "Hôm nay",
  "parent_qr_hint": "Chụp màn hình rồi chọn quét ảnh QR trong app ngân hàng.",
  "parent_footer": "Trang chỉ để xem. Có thắc mắc, vui lòng liên hệ giáo viên.",
  "link_created": "Đã tạo link mới",
  "link_disabled": "Đã tắt link"
```

và vào `src/language/en.json`:

```json
  "parent_link": "Parent link",
  "parent_link_desc": "Parents can view tuition, attendance and schedule without signing in.",
  "create_link": "Create link",
  "copy_link": "Copy",
  "link_copied": "Link copied",
  "regenerate_link": "Regenerate link",
  "regenerate_link_confirm": "The old link will stop working. Parents will need the new link.",
  "disable_link": "Disable link",
  "disable_link_confirm": "Disable link? Parents will no longer be able to open it.",
  "parent_share_text": "View tuition and schedule for",
  "parent_page_title": "Learning info",
  "prev_month": "Previous month",
  "next_month": "Next month",
  "parent_attendance": "Attendance for",
  "parent_present_summary": "Attended {n}/{total} sessions",
  "parent_no_sessions": "No sessions this month.",
  "parent_upcoming": "Upcoming sessions",
  "parent_no_upcoming": "No upcoming sessions.",
  "today_badge": "Today",
  "parent_qr_hint": "Take a screenshot, then scan the QR image in your banking app.",
  "parent_footer": "View only. Please contact the teacher with any questions.",
  "link_created": "New link created",
  "link_disabled": "Link disabled"
```

Nếu key `share` chưa có (C chưa thêm): thêm `"share": "Chia sẻ"` vào vi và `"share": "Share"` vào en.

- [ ] **Step 5: Kiểm tra số key bằng nhau**

Run:
```bash
node -e "const v=require('./src/language/vi.json'),e=require('./src/language/en.json');const a=Object.keys(v),b=Object.keys(e);console.log(a.length,b.length,a.filter(k=>!(k in e)),b.filter(k=>!(k in v)))"
```
Expected: 2 số bằng nhau, 2 mảng rỗng.

- [ ] **Step 6: Chạy test, typecheck, lint**

Run: `pnpm test tests/unit/components/LanguageProvider.test.tsx && pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS 3/3, không lỗi.

- [ ] **Step 7: Commit**

```bash
git add src/components/providers/LanguageProvider.tsx src/language/vi.json src/language/en.json tests/unit/components/LanguageProvider.test.tsx
git commit -m "feat(i18n): LanguageProvider nhận forcedLanguage, thêm key link phụ huynh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: Route công khai `/p/[token]` + `ParentView`

**Đọc trước:** spec G mục 4 (S3, S4, S9), 6.3, 7.4; `src/middleware.ts`; `next.config.mjs`; `tests/unit/next15-contract.test.ts`; `src/lib/utils.ts` (`formatDate`, `formatDayOfWeek`, `vnDateParts`, `cn`); `src/lib/constants.ts` (`ATTENDANCE_LABEL`); `.superpowers/g-bc-interfaces.md` (tên export và props của `TuitionNoticeCard`).

Bảo mật: middleware phải cho `/p/...` đi qua mà **không** mở route nào khác.

**Files:**
- Create: `src/components/parent/ParentView.tsx`
- Create: `src/app/p/[token]/page.tsx`
- Modify: `src/middleware.ts`
- Modify: `next.config.mjs`
- Modify: `tests/unit/next15-contract.test.ts`
- Test: `tests/unit/middleware-matcher.test.ts` (mới), `tests/unit/components/ParentView.test.tsx` (mới)

**Interfaces:**
- Consumes: `getParentView(db, token, thang?)`, `ParentViewDTO`, `ParentSessionDTO` (Task 3); `LanguageProvider forcedLanguage` + key i18n (Task 4); `TuitionNoticeCard` (C, props `{ notice: TuitionNoticeDTO; onReady?: () => void }`); `db` từ `@/server/db`.
- Produces: route `GET /p/<token>[?thang=YYYY-MM]` → 200 hoặc 404; `ParentView({ view }: { view: ParentViewDTO })`. Test id `parent-month` là tiêu đề tháng (e2e Task 6 dùng).

- [ ] **Step 1: Viết test fail**

`tests/unit/middleware-matcher.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

// Next đọc matcher như path-to-regexp; với dạng "/((?!...).*)" thì hiểu như regex thường.
const src = readFileSync("src/middleware.ts", "utf8")
const matcher = src.match(/"(\/\(\(\?!.*\)\.\*\))"/)?.[1] ?? ""
const needsAuth = (path: string) => new RegExp(`^${matcher}$`).test(path)

describe("middleware matcher", () => {
  it("đọc được matcher", () => {
    expect(matcher).not.toBe("")
  })

  it("/p/<token> là route công khai", () => {
    expect(needsAuth("/p/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ")).toBe(false)
    expect(needsAuth("/p/khongtontai")).toBe(false)
  })

  it("các route khác vẫn phải đăng nhập, kể cả route bắt đầu bằng 'p'", () => {
    for (const path of ["/", "/dashboard", "/students", "/profile", "/pay", "/p", "/tuition", "/api/other"]) {
      expect(needsAuth(path), path).toBe(true)
    }
  })

  it("giữ các ngoại lệ cũ", () => {
    for (const path of ["/login", "/register", "/api/auth/session", "/api/trpc/student.list", "/favicon.ico"]) {
      expect(needsAuth(path), path).toBe(false)
    }
  })
})
```

`tests/unit/components/ParentView.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ParentView } from "@/components/parent/ParentView"
import { vnDateParts } from "@/lib/utils"
import type { ParentViewDTO, TuitionNoticeDTO } from "@/lib/types/models"

vi.mock("next/navigation", () => ({ usePathname: () => "/p/tok" }))
// Card của C đã có test riêng; ở đây chỉ kiểm khung trang phụ huynh.
vi.mock("@/components/tuition/TuitionNoticeCard", () => ({
  TuitionNoticeCard: () => <div data-testid="notice-card" />,
}))

function todayVn(): string {
  const { year, month, day } = vnDateParts()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function makeView(over: Partial<ParentViewDTO> = {}): ParentViewDTO {
  return {
    student: { fullName: "Nguyễn Văn An", grade: 5 },
    year: 2026,
    month: 9,
    prevMonth: "2026-08",
    nextMonth: null,
    notice: { teacherName: "Cô Lan", qr: null, payments: [] } as unknown as TuitionNoticeDTO,
    attendance: [
      { date: "2026-09-03", startTime: "17:30", endTime: "19:00", subjectName: "Toán", attendance: "present" },
      { date: "2026-09-05", startTime: "17:30", endTime: "19:00", subjectName: "Toán", attendance: "late" },
      { date: "2026-09-10", startTime: "17:30", endTime: "19:00", subjectName: "Toán", attendance: "absent" },
    ],
    upcoming: [{ date: todayVn(), startTime: "18:00", endTime: "19:30", subjectName: "Toán", attendance: "pending" }],
    ...over,
  }
}

function renderView(view: ParentViewDTO) {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <ParentView view={view} />
    </LanguageProvider>
  )
}

describe("ParentView", () => {
  afterEach(cleanup)

  it("đầu trang, phiếu, tóm tắt có mặt (muộn tính có mặt), dòng điểm danh và nhãn", () => {
    renderView(makeView())
    expect(screen.getByText("Nguyễn Văn An")).toBeTruthy()
    expect(screen.getByText("Lớp 5")).toBeTruthy()
    expect(screen.getByText("Giáo viên: Cô Lan")).toBeTruthy()
    expect(screen.getByTestId("notice-card")).toBeTruthy()
    expect(screen.getByText("Điểm danh tháng 9")).toBeTruthy()
    expect(screen.getByText("Có mặt 2/3 buổi")).toBeTruthy()
    expect(screen.getByText("T5 · 03/09 · 17:30–19:00 · Toán")).toBeTruthy()
    expect(screen.getByText("Có mặt")).toBeTruthy()
    expect(screen.getByText("Muộn")).toBeTruthy()
    expect(screen.getByText("Vắng")).toBeTruthy()
    expect(screen.getByText("Trang chỉ để xem. Có thắc mắc, vui lòng liên hệ giáo viên.")).toBeTruthy()
  })

  it("chọn tháng: tháng trước là link ?thang=, tháng sau ở biên là chữ không có link", () => {
    renderView(makeView())
    expect(screen.getByTestId("parent-month").textContent).toBe("Tháng 9/2026")
    const prev = screen.getByRole("link", { name: /Tháng trước/ })
    expect(prev.getAttribute("href")).toBe("/p/tok?thang=2026-08")
    expect(screen.queryByRole("link", { name: /Tháng sau/ })).toBeNull()
    expect(screen.getByText(/Tháng sau/)).toBeTruthy()
  })

  it("ca hôm nay có huy hiệu 'Hôm nay'", () => {
    renderView(makeView())
    expect(screen.getByText("Hôm nay")).toBeTruthy()
  })

  it("rỗng → thông báo chưa có buổi / chưa có lịch", () => {
    renderView(makeView({ attendance: [], upcoming: [] }))
    expect(screen.getByText("Tháng này chưa có buổi học.")).toBeTruthy()
    expect(screen.getByText("Chưa có lịch học sắp tới.")).toBeTruthy()
    expect(screen.queryByText("Hôm nay")).toBeNull()
  })

  it("có QR → hiện dòng hướng dẫn quét; không QR → không hiện", () => {
    const withQr = makeView({
      notice: { teacherName: "Cô Lan", qr: { payload: "x" }, payments: [] } as unknown as TuitionNoticeDTO,
    })
    renderView(withQr)
    expect(screen.getByText("Chụp màn hình rồi chọn quét ảnh QR trong app ngân hàng.")).toBeTruthy()
    cleanup()
    renderView(makeView())
    expect(screen.queryByText("Chụp màn hình rồi chọn quét ảnh QR trong app ngân hàng.")).toBeNull()
  })
})
```

Nếu `TuitionNoticeCard` là default export (xem `.superpowers/g-bc-interfaces.md`), đổi mock thành `({ default: () => <div data-testid="notice-card" /> })` và import tương ứng ở Step 3.

Sửa `tests/unit/next15-contract.test.ts`. Trong test `"không page/layout nào dính tới params hoặc searchParams"`, thay 3 dòng ghi chú + khai báo `ALLOWED`:

```ts
    // Ngoại lệ: reports/page.tsx có biến local `params` (input tRPC); p/[token]/page.tsx là
    // page duy nhất dùng prop route, đã await theo kiểu async của Next 15 (test bên dưới).
    const ALLOWED = new Set(["src/app/(app)/reports/page.tsx", "src/app/p/[token]/page.tsx"])
```

và thêm test mới ngay sau test đó:

```ts
  it("trang phụ huynh await params và searchParams (prop route là Promise ở Next 15)", () => {
    const src = readFileSync("src/app/p/[token]/page.tsx", "utf8")
    expect(src).toContain("await params")
    expect(src).toContain("await searchParams")
  })
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/middleware-matcher.test.ts tests/unit/components/ParentView.test.tsx tests/unit/next15-contract.test.ts`
Expected: FAIL: matcher `/p/...` trả `true`; `ParentView` không import được; test "trang phụ huynh await..." lỗi ENOENT.

- [ ] **Step 3: Viết `ParentView`**

Tạo `src/components/parent/ParentView.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { TuitionNoticeCard } from "@/components/tuition/TuitionNoticeCard"
import { ATTENDANCE_LABEL } from "@/lib/constants"
import { cn, formatDate, formatDayOfWeek, vnDateParts } from "@/lib/utils"
import type { ParentSessionDTO, ParentViewDTO } from "@/lib/types/models"

const ATTENDANCE_STYLE: Record<ParentSessionDTO["attendance"], string> = {
  present: "bg-green-100 text-green-700",
  late: "bg-amber-100 text-amber-700",
  absent: "bg-red-100 text-red-700",
  pending: "bg-slate-100 text-slate-600",
}

function todayVn(): string {
  const { year, month, day } = vnDateParts()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function sessionLine(s: ParentSessionDTO): string {
  return `${formatDayOfWeek(s.date)} · ${formatDate(s.date).slice(0, 5)} · ${s.startTime}–${s.endTime} · ${s.subjectName}`
}

function MonthLink({ href, label }: { href: string | null; label: string }) {
  const base = "flex min-h-11 items-center px-3 text-sm"
  if (!href) return <span className={cn(base, "text-slate-300")}>{label}</span>
  return (
    <Link href={href} className={cn(base, "font-medium text-indigo-700")}>
      {label}
    </Link>
  )
}

export function ParentView({ view }: { view: ParentViewDTO }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const today = todayVn()
  const monthHref = (ym: string | null) => (ym ? `${pathname}?thang=${ym}` : null)
  const attended = view.attendance.filter(
    (s) => s.attendance === "present" || s.attendance === "late"
  ).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">{view.student.fullName}</h1>
          <p className="text-sm text-slate-600">{`${t("grade")} ${view.student.grade}`}</p>
          <p className="text-sm text-slate-600">{`${t("teacher_fallback")}: ${view.notice.teacherName}`}</p>
        </header>

        <nav className="flex items-center justify-between rounded-lg border border-slate-200 bg-white">
          <MonthLink href={monthHref(view.prevMonth)} label={`‹ ${t("prev_month")}`} />
          <span className="text-sm font-semibold text-slate-900" data-testid="parent-month">
            {`${t("month")} ${view.month}/${view.year}`}
          </span>
          <MonthLink href={monthHref(view.nextMonth)} label={`${t("next_month")} ›`} />
        </nav>

        <section>
          {/* Card của C rộng cố định 360px: máy hẹp hơn thì cuộn riêng card, không tràn cả trang. */}
          <div className="overflow-x-auto">
            <div className="mx-auto w-fit">
              <TuitionNoticeCard notice={view.notice} />
            </div>
          </div>
          {view.notice.qr && (
            <p className="mt-2 text-center text-xs text-slate-500">{t("parent_qr_hint")}</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">{`${t("parent_attendance")} ${view.month}`}</h2>
          {view.attendance.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("parent_no_sessions")}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">
                {t("parent_present_summary")
                  .replace("{n}", String(attended))
                  .replace("{total}", String(view.attendance.length))}
              </p>
              <ul className="mt-2 divide-y divide-slate-100">
                {view.attendance.map((s) => (
                  <li key={`${s.date}-${s.startTime}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{sessionLine(s)}</span>
                    <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", ATTENDANCE_STYLE[s.attendance])}>
                      {ATTENDANCE_LABEL[s.attendance]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">{t("parent_upcoming")}</h2>
          {view.upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("parent_no_upcoming")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {view.upcoming.map((s) => (
                <li key={`${s.date}-${s.startTime}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{sessionLine(s)}</span>
                  {s.date === today && (
                    <span className="shrink-0 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {t("today_badge")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pb-4 text-center text-xs text-slate-500">{t("parent_footer")}</footer>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Viết page**

Tạo `src/app/p/[token]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/server/db"
import { getParentView } from "@/server/services/parent-link.service"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { ParentView } from "@/components/parent/ParentView"

// Không cache: token sai/đã tắt phải 404 ngay, và Next tự trả Cache-Control private, no-store.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Thông tin học tập",
  robots: { index: false, follow: false },
}

export default async function ParentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ thang?: string | string[] }>
}) {
  const { token } = await params
  const { thang } = await searchParams
  // ?thang=a&thang=b cho ra mảng → coi như không chọn tháng.
  const view = await getParentView(db, token, typeof thang === "string" ? thang : undefined)
  if (!view) notFound()

  return (
    <LanguageProvider forcedLanguage="vi">
      <ParentView view={view} />
    </LanguageProvider>
  )
}
```

- [ ] **Step 5: Sửa middleware và next.config**

`src/middleware.ts`, thay khối `config`:

```ts
export const config = {
  matcher: [
    // "p/" có dấu "/" để chỉ mở /p/<token>, không mở nhầm /profile hay route khác bắt đầu bằng "p".
    "/((?!login|register|p/|api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)",
  ],
}
```

`next.config.mjs`, thêm vào object `nextConfig` (sau `env`):

```js
  // Trang phụ huynh: chặn máy tìm kiếm và không để token rò qua header Referer.
  async headers() {
    return [
      {
        source: "/p/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ]
  },
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/middleware-matcher.test.ts tests/unit/components/ParentView.test.tsx tests/unit/next15-contract.test.ts`
Expected: PASS toàn bộ (matcher 4, ParentView 5, next15-contract 6).

- [ ] **Step 7: Typecheck, lint, toàn bộ unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit`
Expected: không lỗi, unit pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/parent/ParentView.tsx "src/app/p/[token]/page.tsx" src/middleware.ts next.config.mjs tests/unit/next15-contract.test.ts tests/unit/middleware-matcher.test.ts tests/unit/components/ParentView.test.tsx
git commit -m "feat(parent-link): trang công khai /p/[token], mở matcher, noindex + no-referrer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: `ParentLinkDialog` + mục menu + E2E

**Đọc trước:** spec G mục 6.1, 6.2, 10 (E2E); `src/components/students/StudentList.tsx` (`actionsMenu`, dòng ~133–155; khối dialog cuối file); `src/components/ui/dialog.tsx`, `alert-dialog.tsx`; `tests/e2e/subjects.spec.ts` (mẫu 390px + ẩn dev badge); `playwright.config.ts`; `tests/env-setup.ts` (`EXPECTED_TEST_ENDPOINT`).

**Files:**
- Create: `src/components/students/ParentLinkDialog.tsx`
- Modify: `src/components/students/StudentList.tsx`
- Create (git-ignored, không commit): `.superpowers/pw-3100.config.ts`
- Test: `tests/e2e/parent-link.spec.ts` (mới)

**Interfaces:**
- Consumes: `trpc.student.generateParentLink` / `disableParentLink` (Task 2); key i18n (Task 4); route `/p/<token>` và test id `parent-month` (Task 5); `StudentRow.parentLinkToken` (từ `student.list`).
- Produces: `ParentLinkDialog({ student, onOpenChange }: { student: { id: number; fullName: string; parentLinkToken: string | null }; onOpenChange: (open: boolean) => void })`; test id `parent-link-url` cho ô link.

- [ ] **Step 1: Viết e2e (fail)**

Tạo `tests/e2e/parent-link.spec.ts`:

```ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';

test.use({ viewport: { width: 390, height: 844 } });

const db = new PrismaClient();
const NAME = `E2E Phụ huynh ${Math.floor(Math.random() * 100000)}`;
let studentId = 0;
const sessionIds: number[] = [];

function vnDay(offset: number): string {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + offset))
    .toISOString()
    .slice(0, 10);
}
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

async function hideDevBadge(page: Page) {
  // Huy hiệu dev của Next (chỉ có khi `next dev`) đè lên góc trái dưới ở 390px.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
}

// Context mới, không cookie: đúng góc nhìn phụ huynh.
async function openAsParent(browser: Browser, url: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await hideDevBadge(page);
  const res = await page.goto(url);
  return { context, page, res };
}

test.beforeAll(async () => {
  // Ghi thẳng DB: phải chắc đang trỏ DB test, không phải production.
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  const user = await db.user.findUniqueOrThrow({ where: { username: 'teacher' } });
  const subject = await db.subject.findFirstOrThrow({ where: { userId: user.id, isActive: true } });
  const createdAt = new Date();
  createdAt.setUTCMonth(createdAt.getUTCMonth() - 3); // để có "Tháng trước"
  const student = await db.student.create({
    data: { userId: user.id, fullName: NAME, grade: 5, tuitionFee: 100000, createdAt },
  });
  studentId = student.id;
  for (const [date, attendance] of [[vnDay(0), 'present'], [vnDay(7), 'pending']] as const) {
    const s = await db.teachingSession.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        sessionDate: new Date(`${date}T00:00:00Z`),
        startTime: time('05:00'),
        endTime: time('05:30'),
        sessionStudents: { create: { studentId, attendance, fee: 100000, grade: 5 } },
      },
    });
    sessionIds.push(s.id);
  }
});

test.afterAll(async () => {
  await db.teachingSession.deleteMany({ where: { id: { in: sessionIds } } });
  await db.monthlyTuition.deleteMany({ where: { studentId } });
  await db.student.deleteMany({ where: { id: studentId } });
  await db.$disconnect();
});

test('giáo viên tạo link, phụ huynh xem không cần đăng nhập, tạo lại và tắt thì link chết', async ({ page, browser }) => {
  await hideDevBadge(page);
  await page.goto('/login');
  await page.fill('input[name="username"]', 'teacher');
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Mở dialog từ menu ⋯ của HS
  await page.goto('/students');
  await page.getByPlaceholder('Tìm tên học sinh...').filter({ visible: true }).first().fill(NAME);
  const menuBtn = page.getByRole('button', { name: 'Menu hành động' }).filter({ visible: true });
  await expect(menuBtn).toHaveCount(1);
  await menuBtn.click();
  await page.getByRole('menuitem', { name: 'Link phụ huynh' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(`Link phụ huynh · ${NAME}`)).toBeVisible();
  await dialog.getByRole('button', { name: 'Tạo link' }).click();
  const urlBox = dialog.getByTestId('parent-link-url');
  await expect(urlBox).toHaveValue(/\/p\/[A-Za-z0-9_-]{43}$/);
  const url1 = await urlBox.inputValue();

  // Phụ huynh mở link
  const parent = await openAsParent(browser, url1);
  expect(parent.res!.status()).toBe(200);
  const headers = parent.res!.headers();
  expect(headers['x-robots-tag']).toContain('noindex');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cache-control']).toContain('no-store');
  await expect(parent.page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(parent.page.getByRole('heading', { name: NAME })).toBeVisible();
  await expect(parent.page.getByText('Còn phải trả').first()).toBeVisible();
  await expect(parent.page.getByText('Có mặt', { exact: true })).toBeVisible();
  await expect(parent.page.getByRole('heading', { name: 'Lịch sắp tới' })).toBeVisible();
  const [y, m, d] = vnDay(7).split('-');
  await expect(parent.page.getByText(new RegExp(`${d}/${m} · 05:00`))).toBeVisible();
  const overflow = await parent.page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const prevLink = parent.page.getByRole('link', { name: /Tháng trước/ });
  expect((await prevLink.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Đổi tháng
  const monthBefore = await parent.page.getByTestId('parent-month').textContent();
  await prevLink.click();
  await expect(parent.page).toHaveURL(/\?thang=\d{4}-\d{2}$/);
  await expect(parent.page.getByTestId('parent-month')).not.toHaveText(monthBefore ?? '');

  // Tham số tháng lặp → vẫn 200, về tháng hiện tại
  const dup = await parent.page.goto(`${url1}?thang=${y}-${m}&thang=2020-01`);
  expect(dup!.status()).toBe(200);
  await parent.context.close();

  // Tạo lại → link cũ 404
  await dialog.getByRole('button', { name: 'Tạo lại link' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã tạo link mới')).toBeVisible();
  await expect(urlBox).not.toHaveValue(url1);
  const url2 = await urlBox.inputValue();
  const old = await openAsParent(browser, url1);
  expect(old.res!.status()).toBe(404);
  await old.context.close();

  // Tắt → link mới cũng 404, dialog quay về trạng thái chưa có link
  await dialog.getByRole('button', { name: 'Tắt link' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã tắt link')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tạo link' })).toBeVisible();
  const disabled = await openAsParent(browser, url2);
  expect(disabled.res!.status()).toBe(404);
  await disabled.context.close();

  // Token không tồn tại → 404, không bị chuyển sang /login
  const origin = new URL(url1).origin;
  const missing = await openAsParent(browser, `${origin}/p/khongtontai`);
  expect(missing.res!.status()).toBe(404);
  await expect(missing.page).not.toHaveURL(/login/);
  await missing.context.close();
});

test('route khác vẫn chuyển về /login khi chưa đăng nhập', async ({ page }) => {
  await page.goto('/students');
  await expect(page).toHaveURL(/.*login/);
});
```

Ghi chú: chữ "Còn phải trả" lấy từ card của C (`.superpowers/g-bc-interfaces.md`). Nếu card dùng chữ khác thì sửa theo chữ thật, ghi vào báo cáo.

Tạo `.superpowers/pw-3100.config.ts` (nếu chưa có; `git check-ignore -v .superpowers/pw-3100.config.ts` phải in 1 dòng):

```ts
import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// Cổng 3000 có thể đang bị project khác chiếm → chạy dev server test ở 3100.
export default defineConfig({
  ...base,
  testDir: '../tests/e2e',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    ...(base.webServer as object),
    command: 'pnpm exec next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Chạy e2e, xác nhận fail**

Run: `pnpm exec playwright test tests/e2e/parent-link.spec.ts --config .superpowers/pw-3100.config.ts`
Expected: test 1 FAIL ở bước chọn menuitem "Link phụ huynh" (chưa có); test 2 PASS.

- [ ] **Step 3: Viết `ParentLinkDialog`**

Tạo `src/components/students/ParentLinkDialog.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, Link2Off, RefreshCw, Share2 } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type Props = {
  student: { id: number; fullName: string; parentLinkToken: string | null }
  onOpenChange: (open: boolean) => void
}

export function ParentLinkDialog({ student, onOpenChange }: Props) {
  const { t } = useTranslation()
  // Prop `student` là bản chụp lúc mở menu, không tự đổi sau mutation → giữ token cục bộ.
  const [token, setToken] = useState(student.parentLinkToken)
  const [confirm, setConfirm] = useState<"regenerate" | "disable" | null>(null)

  const generate = trpc.student.generateParentLink.useMutation({
    onSuccess: (res) => {
      setToken(res.token)
      setConfirm(null)
      toast.success(t("link_created"))
    },
    onError: (e) => toast.error(e.message),
  })
  const disable = trpc.student.disableParentLink.useMutation({
    onSuccess: () => {
      setToken(null)
      setConfirm(null)
      toast.success(t("link_disabled"))
    },
    onError: (e) => toast.error(e.message),
  })
  const busy = generate.isPending || disable.isPending

  const url = token ? `${window.location.origin}/p/${token}` : ""
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t("link_copied"))
    } catch {
      // Trình duyệt chặn clipboard: người dùng vẫn bấm vào ô để chọn và tự sao chép.
    }
  }

  const share = async () => {
    try {
      await navigator.share({
        title: t("parent_page_title"),
        text: `${t("parent_share_text")} ${student.fullName}`,
        url,
      })
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message)
    }
  }

  const btn = "h-11 md:h-10"

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`${t("parent_link")} · ${student.fullName}`}</DialogTitle>
            <DialogDescription>{t("parent_link_desc")}</DialogDescription>
          </DialogHeader>

          {token ? (
            <div className="space-y-3">
              <Input
                readOnly
                value={url}
                aria-label={t("parent_link")}
                data-testid="parent-link-url"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
              />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button className={btn} onClick={copy}>
                  <Copy className="mr-2 size-4" />
                  {t("copy_link")}
                </Button>
                {canShare && (
                  <Button variant="outline" className={btn} onClick={share}>
                    <Share2 className="mr-2 size-4" />
                    {t("share")}
                  </Button>
                )}
                <Button variant="outline" className={btn} disabled={busy} onClick={() => setConfirm("regenerate")}>
                  <RefreshCw className="mr-2 size-4" />
                  {t("regenerate_link")}
                </Button>
                <Button
                  variant="outline"
                  className={`${btn} text-red-600 hover:text-red-700`}
                  disabled={busy}
                  onClick={() => setConfirm("disable")}
                >
                  <Link2Off className="mr-2 size-4" />
                  {t("disable_link")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className={`${btn} w-full sm:w-auto`}
              disabled={busy}
              onClick={() => generate.mutate({ id: student.id })}
            >
              {t("create_link")}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "disable" ? t("disable_link") : t("regenerate_link")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "disable" ? t("disable_link_confirm") : t("regenerate_link_confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={confirm === "disable" ? "bg-red-600 hover:bg-red-700" : undefined}
              onClick={(e) => {
                // Giữ AlertDialog mở tới khi mutation xong (onSuccess tự đóng).
                e.preventDefault()
                if (confirm === "disable") disable.mutate({ id: student.id })
                else generate.mutate({ id: student.id })
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

Nếu key `share` nằm dưới tên khác (xem báo cáo Task 4 / `.superpowers/g-bc-interfaces.md`) thì dùng đúng tên đó.

- [ ] **Step 4: Thêm mục menu vào `StudentList`**

Trong `src/components/students/StudentList.tsx`:

Import icon: đổi dòng lucide thành

```ts
import { CalendarDays, Link2, MoreHorizontal, Pencil, Phone, Trash2, UserPlus } from "lucide-react"
```

Import dialog, dưới `import { StudentFormDialog } from "./StudentFormDialog"`:

```ts
import { ParentLinkDialog } from "./ParentLinkDialog"
```

State, ngay dưới `const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null)`:

```ts
  const [parentLinkTarget, setParentLinkTarget] = useState<StudentRow | null>(null)
```

Trong `actionsMenu`, ngay sau `DropdownMenuItem` "Xem lịch" (`{t("view_schedule")}`):

```tsx
        <DropdownMenuItem onSelect={() => setParentLinkTarget(s)}>
          <Link2 className="mr-2 size-4" />
          {t("parent_link")}
        </DropdownMenuItem>
```

Cuối JSX, ngay trước `<AlertDialog` xoá HS:

```tsx
      {parentLinkTarget && (
        <ParentLinkDialog
          key={parentLinkTarget.id}
          student={parentLinkTarget}
          onOpenChange={(open) => !open && setParentLinkTarget(null)}
        />
      )}
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 6: Chạy e2e, xác nhận pass**

Run: `pnpm exec playwright test tests/e2e/parent-link.spec.ts --config .superpowers/pw-3100.config.ts`
Expected: PASS 2/2.

- [ ] **Step 7: Chạy lại e2e học sinh (menu đã đổi)**

Run: `pnpm exec playwright test tests/e2e/students.spec.ts tests/e2e/mobile.spec.ts --config .superpowers/pw-3100.config.ts`
Expected: PASS (như trước task).

- [ ] **Step 8: Commit**

```bash
git add src/components/students/ParentLinkDialog.tsx src/components/students/StudentList.tsx tests/e2e/parent-link.spec.ts
git commit -m "feat(students): dialog Link phụ huynh (tạo, sao chép, chia sẻ, tạo lại, tắt) + e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 7: Kiểm chứng cuối

**Đọc trước:** Global Constraints; Review Focus; spec G mục 2, 8, 10 (Chung), 13.

**Files:** không sửa code, trừ khi phát hiện lỗi (sửa, thêm test, commit riêng).

- [ ] **Step 1: Xác nhận lại DB test**

Run:
```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: 2 host khác nhau.

- [ ] **Step 2: Toàn bộ test + lint + build**

Run (tuần tự, không song song):
```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm exec next build
```
Expected: lint/tsc sạch; unit + integration pass (~10–15 phút); build OK, route `/p/[token]` có ký hiệu dynamic (`ƒ`).

- [ ] **Step 3: Toàn bộ e2e**

Run: `pnpm exec playwright test --config .superpowers/pw-3100.config.ts`
Expected: pass (upgrade-class có thể skip như trước).

- [ ] **Step 4: Rà code theo Review Focus và bảo mật**

Kiểm bằng mắt và ghi kết quả vào báo cáo:
- `getParentView` không gọi hàm ghi nào (`create`/`update`/`upsert`/`delete`) và không gọi `getMonthlyTuitionStatus` với `persist=true`: `grep -n "create\|update\|upsert\|delete" src/server/services/parent-link.service.ts`. Chỉ được thấy `update` trong `generateParentLink`/`disableParentLink`.
- DTO trả về không spread object Prisma (chỉ spread `notice` của C).
- Không có tRPC procedure công khai mới: `grep -rn "publicProcedure" src/server/trpc/routers/` giống `main`.
- Nút Tạo lại/Tắt/Tạo link `disabled={busy}` (Review Focus 5).
- `src/app/p/[token]/page.tsx` không import `auth`/`AppLayout`, không có link vào app.

- [ ] **Step 5: Ghi bước kiểm tra tay cho người dùng (đưa vào báo cáo, không tự làm trên production)**

1. Trước merge: tạo Neon branch "Branch from current" từ production, chạy `prisma migrate deploy` lên branch đó, chạy 2 truy vấn chỉ đọc ở spec mục 8 trước/sau (`COUNT(*)` students không đổi; `parent_link_token IS NOT NULL` = 0).
2. Sau merge (Vercel tự `migrate deploy`): vào `/students` trên điện thoại, tạo link cho 1 HS, bấm "Chia sẻ" → chọn Zalo gửi cho chính mình, mở link trong Zalo (không đăng nhập): thấy phiếu, QR (nếu đã cài tài khoản ngân hàng ở `/settings`), điểm danh, lịch sắp tới; quét QR bằng app ngân hàng thấy đúng số tiền/nội dung.
3. Đổi app sang tiếng Anh, tự mở link trên cùng máy → trang vẫn tiếng Việt.
4. Bấm "Tạo lại link" → link cũ trong Zalo ra 404; "Tắt link" → link mới ra 404.
5. Xem trước link trong Zalo chỉ hiện tiêu đề "Thông tin học tập".

- [ ] **Step 6: Bàn giao**

Báo cáo cho người điều phối: kết quả Step 2–4, các lệch so với plan đã ghi ở `.superpowers/g-bc-interfaces.md`, danh sách kiểm tra tay Step 5. **Không merge, không push.**
