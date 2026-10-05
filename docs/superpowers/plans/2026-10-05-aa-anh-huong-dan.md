# AA — Ảnh chụp màn hình trong Hướng dẫn sử dụng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Các bước chính trong `/guide` có ảnh chụp màn hình thật, gồm khổ máy tính và khổ điện thoại. File Word tải về cũng chèn cả 2 ảnh. Version `0.12.0`.

**Architecture:** Một script Playwright chạy tay tự tạo tài khoản mẫu trên DB test và chụp ảnh. Ảnh JPEG lưu vào `public/guide/`. Bước có ảnh trong `guide-content.ts` mang mã `shot`. Trang `/guide` hiện khung ảnh có nút chuyển Máy tính / Điện thoại. File Word dựng sẵn bằng `pnpm guide:docx` (chèn chính các file JPEG đó) thành file tĩnh, nút Tải Word tải thẳng.

**Tech Stack:** Next.js 15, React 19, Playwright, Vitest + Testing Library, `docx` v9 (`ImageRun`), `jszip` (chỉ trong test).

**Spec:** Không có file spec riêng. Nguồn là quyết định của người dùng ngày 2026-10-05, ghi ở mục dưới. Plan này là nguồn duy nhất.

## Quyết định của người dùng (2026-10-05)

- Chỉ chụp **bước chính**, tức bước mở màn hình mới hoặc thao tác khó hình dung. Khoảng 24 cặp ảnh, danh sách cố định ở Task 1.
- Mỗi ảnh có 2 khổ: **máy tính 1280×800** và **điện thoại 390×844**. Chỗ cần bấm có **viền đỏ**.
- Ảnh chụp bằng **dữ liệu giả trên DB test**. Tuyệt đối không chụp từ prod hay dữ liệu thật.
- Trang `/guide`: ảnh nằm ngay dưới bước, có 2 nút **Máy tính | Điện thoại**. Mặc định chọn theo thiết bị người xem. Bấm ảnh để phóng to. Ảnh tải lười (`loading="lazy"`).
- File Word: **chèn cả 2 ảnh**, ảnh máy tính to, ảnh điện thoại nhỏ ngay bên dưới.
- (Bổ sung sau duyệt) File Word hướng dẫn **làm sẵn** thành file tĩnh, nút Tải Word là link tải thẳng cho nhẹ. Trang Các bản cập nhật giữ cách cũ. Chi tiết ở Task 4.

## Global Constraints

- Nhánh `feat/aa-anh-huong-dan` từ `main` 952eaf2 (v0.11.4).
- **Không migration, không đổi `prisma/schema.prisma`, không lệnh prisma nào.**
- **Không cài thêm thư viện.** Playwright chụp thẳng JPEG (`type: 'jpeg'`). `docx` và `jszip` đã có sẵn.
- An toàn DB: chỉ `.env.test` (localhost:5433). Cấm `db:reset`, `migrate reset` và `db push` trên mọi DB. Script chụp ảnh phải assert `DATABASE_URL` chứa `@${EXPECTED_TEST_ENDPOINT}/` trước khi ghi gì, giống `tests/e2e/w-huong-dan-co-gi-moi.spec.ts`.
- Không chạy `pnpm build` và `pnpm dev` riêng lẻ. Script chụp ảnh tự bật dev server qua `webServer` của config riêng, giống e2e. **Người dùng đã đồng ý cho chạy config chụp ảnh này.**
- e2e:
  - RAM ≥ 3000 MB trước khi chạy, chạy foreground.
  - Chia 2 nửa theo `.superpowers/sdd/2026-10-03-y-thu-hoc-phi/half1.txt` và `half2.txt`.
  - Chỉ dừng đúng PID do mình tạo (xem LENH.md). Cấm `Stop-Process` hàng loạt mọi tiến trình node.
- **Không xoá hoặc nới test cũ để qua.** Chỉ được đổi kỳ vọng test cũ khi đúng hành vi mới, và phải ghi `Ruling:` trong ledger.
- Chuỗi giao diện mới đi qua i18n: thêm cùng key vào `src/language/vi.json` và `en.json`. Không dùng gạch dài (—, –) trong chuỗi mới.
- Giao diện:
  - Màu: không dùng indigo, violet, purple.
  - Vùng chạm trên mobile ≥ 44px (`h-11 md:h-8` như code sẵn có).
- Commit 1 dòng, không body, không Co-Authored-By.
- Ghi chú code bằng tiếng Việt có dấu, mỗi ghi chú 1–2 dòng.
- Sau mỗi task:
  1. Test của task xanh, `pnpm exec tsc --noEmit` và `pnpm lint` sạch.
  2. Commit.
  3. Ghi 1 dòng `Task N: complete (...)` vào ledger `.superpowers/sdd/2026-10-05-aa-anh-huong-dan/progress.md`.
- Lệch plan ngoài tên hoặc đường dẫn thì STOP, ghi lý do vào kênh, không tự đoán.

## Hằng số dùng chung (mọi task phải dùng đúng)

| Tên | Giá trị |
|---|---|
| Thư mục ảnh | `public/guide/` (thư mục `public/` chưa có, Task 1 tạo) |
| Tên file | `<shot>-desktop.jpg`, `<shot>-mobile.jpg` |
| URL | `/guide/<shot>-desktop.jpg` (middleware đã bỏ qua mọi đường dẫn bắt đầu bằng `guide`, nên ảnh tải được khi chưa đăng nhập) |
| Kích thước file máy tính | 1280×800 px (viewport 1280×800, deviceScaleFactor 1) |
| Kích thước file điện thoại | 780×1688 px (viewport 390×844, deviceScaleFactor 2) |
| JPEG | `quality: 80`, chỉ chụp phần viewport (không `fullPage`) |
| Viền đỏ | `outline: 3px solid #ef4444; outline-offset: 2px` |
| Mã shot | kebab-case `[a-z0-9-]+`, không trùng |

## Danh sách ảnh (24 shot)

`Bước` là chỉ số 0-based trong `steps` của mục hiện tại ở `src/lib/guide-content.ts`. Cột **Viền đỏ** là phần tử được tô viền đỏ.

| # | Mục (`id`) | Bước | shot | Màn hình cần chụp | Viền đỏ |
|---|---|---|---|---|---|
| 1 | bat-dau | 0 | `dang-ky` | `/register` khi chưa đăng nhập | nút **Đăng ký** |
| 2 | bat-dau | 3 | `tong-quan-bat-dau` | `/dashboard`, thẻ Bắt đầu sử dụng 3/5 bước | thẻ Bắt đầu sử dụng |
| 3 | mon-hoc | 1 | `mon-hoc-them` | `/subjects`, hộp Thêm môn đang mở | ô chọn màu |
| 4 | hoc-sinh | 0 | `hoc-sinh-danh-sach` | `/students` có 6 HS | nút **Thêm học sinh** |
| 5 | hoc-sinh | 2 | `hoc-sinh-them` | hộp Thêm học sinh, đã gõ tên mẫu | phần **Cách thu học phí** |
| 6 | nhap-excel | 2 | `nhap-excel-xem-truoc` | hộp Nhập Excel sau khi chọn file có 1 dòng lỗi | dòng lỗi tô đỏ |
| 7 | lich-day | 0 | `lich-day-thang` | `/calendar` tháng hiện tại có ca | nút **+ Thêm ca dạy mới** |
| 8 | lich-day | 1 | `lich-day-tao-ca` | hộp tạo ca, đã chọn môn + 2 HS | phần chọn học sinh |
| 9 | lich-day | 3 | `lich-day-chi-tiet-ca` | chi tiết 1 ca trong quá khứ | các nút thao tác (sửa/chuyển/huỷ/ca bù) |
| 10 | lich-day | 4 | `lich-day-chep-thang` | hộp Chép lịch tháng đang mở | nút xác nhận chép |
| 11 | diem-danh | 1 | `diem-danh` | chi tiết ca, danh sách điểm danh | cụm chọn trạng thái của 1 HS |
| 12 | diem-danh | 3 | `diem-danh-ca-ke` | chi tiết ca | nút mũi tên ca trước/ca sau |
| 13 | hoc-phi | 0 | `hoc-phi-danh-sach` | `/tuition` tháng trước | cột/ô số cần đóng của 1 HS còn nợ cũ |
| 14 | hoc-phi | 1 | `hoc-phi-da-dong-du` | `/tuition` tháng trước | nút **Đã đóng đủ** trên 1 dòng |
| 15 | hoc-phi | 2 | `hoc-phi-dong-mot-phan` | chi tiết HS, khung **Đóng một phần** đã nhập số tiền, có dòng xem trước | dòng xem trước |
| 16 | hoc-phi | 4 | `hoc-phi-mien` | hộp **Miễn phần còn thiếu** | ô **Lý do** |
| 17 | hoc-phi | 5 | `hoc-phi-phieu-bao` | phiếu báo học phí có QR | mã QR |
| 18 | hoc-phi | 7 | `link-phu-huynh` | trang `/p/<token>` của 1 HS mẫu (chưa đăng nhập) | không viền |
| 19 | bao-cao | 1 | `bao-cao` | `/reports` tháng trước | ô chọn tháng |
| 20 | tai-khoan-ngan-hang | 1 | `cai-dat-ngan-hang` | `/settings` phần Tài khoản nhận học phí (đã điền mẫu) | ô tìm ngân hàng |
| 21 | goi-dich-vu | 0 | `goi-cua-toi` | trang Gói của tôi | thẻ gói đang dùng |
| 22 | thung-rac | 1 | `thung-rac` | `/trash` có 1 HS mẫu đã xoá | nút **Khôi phục** |
| 23 | sao-luu | 0 | `sao-luu-menu` | menu avatar đang mở | mục **Sao lưu dữ liệu** |
| 24 | sao-luu | 2 | `sao-luu-canh-bao` | hộp cảnh báo sao lưu | nút **Tôi hiểu, tải xuống** |

**Đường dẫn trang:**
- Đường dẫn thật (`/calendar`, `/tuition`, `/reports`, trang Gói…) lấy từ `src/components/layout/nav-items.ts`. Bảng trên ghi tên gợi ý; tên thật khác thì dùng tên thật, ghi Ruling.
- Trên điện thoại, mục nào phải đi qua tab **Thêm** thì vẫn mở thẳng URL. Viền đỏ đặt đúng phần tử tương ứng trên giao diện mobile.
- Shot nào không làm được thì **STOP và ghi kênh**, không bỏ qua im lặng. Ví dụ: tính năng đổi giao diện, không có nút tương ứng.

## Review Focus

1. Ảnh không được lộ dữ liệu thật hay khoá bí mật: chỉ có tài khoản `guide_demo` với tên giả, số TK giả `0123456789`. Script chạy nhầm `.env` (prod) phải dừng ngay trước khi ghi.
2. Một file ảnh bị thiếu (bị xoá, đổi tên shot) thì test đỏ. Không được để ảnh vỡ lọt lên prod. Ngược lại, file ảnh thừa không còn dùng cũng làm test đỏ.
3. Sửa chữ trong `guide-content.ts` hoặc chụp lại ảnh mà quên chạy `pnpm guide:docx` thì test đỏ. Không bao giờ lên prod file Word cũ.
4. Người dùng màn hình nhỏ mở `/guide` thì mặc định hiện ảnh điện thoại, máy tính thì hiện ảnh máy tính. Bấm nút chuyển không đổi cuộn trang. Ảnh phóng to đóng được bằng phím Esc và nút đóng.
5. Script chụp chạy lại lần 2 trên cùng DB vẫn ra đúng ảnh: dọn sạch dữ liệu `guide_demo` cũ trước khi tạo, và dọn lại sau khi xong.

---

### Task 1: Script chụp ảnh + dữ liệu mẫu + 48 file ảnh

**Files:**
- Create: `playwright.guide-shots.config.ts`
- Create: `tests/guide-shots/demo-data.ts`
- Create: `tests/guide-shots/guide-shots.spec.ts`
- Create: `public/guide/*.jpg` (48 file, do script sinh ra)
- Modify: `LENH.md` (thêm 1 mục ngắn "Chụp lại ảnh hướng dẫn": lệnh chạy, khi nào cần chạy lại)

**Interfaces:**
- Produces: 48 file `public/guide/<shot>-{desktop,mobile}.jpg` đúng 24 mã shot trong bảng. Task 2 dựa vào đúng các tên này.

- [ ] **Step 1: Tạo `playwright.guide-shots.config.ts`**

Chép phần `requireEnv` và `webServer` **y nguyên** từ `playwright.config.ts`, kể cả `reuseExistingServer: false` và khối `env`. Phần khác:

```ts
// Config riêng để chụp ảnh /guide. Không nằm trong e2e thường: chạy tay khi giao diện đổi.
import './tests/env-setup';
import { defineConfig } from '@playwright/test';

// requireEnv(...) chép y nguyên từ playwright.config.ts

export default defineConfig({
  testDir: './tests/guide-shots',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 180000,
  expect: { timeout: 30000 },
  use: { baseURL: 'http://localhost:3000', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ],
  webServer: { /* chép y nguyên từ playwright.config.ts */ },
});
```

Kiểm: `playwright.config.ts` có `testDir: './tests/e2e'` nên e2e thường không chạy thư mục mới. `vitest.config.ts` chỉ include `tests/unit` và `tests/integration`, nên vitest cũng không chạy. Không cần sửa 2 file đó.

- [ ] **Step 2: Viết `tests/guide-shots/demo-data.ts`**

Hàm `seedDemo()` và `cleanupDemo()`. Tạo dữ liệu bằng tRPC caller thật (`getAuthedCaller` từ `tests/helpers/trpc`, đã kiểm import chạy được ngoài vitest) để học phí và mã hoá đúng như app. Chỉ dùng `db` (từ `@/server/db`) cho việc caller không làm được. Yêu cầu dữ liệu:

- **User `guide_demo`:**
  - mật khẩu `teacher123` (hash bằng `bcryptjs`, cost giống `prisma/seed.ts`), `fullName: "Cô Lan"`;
  - `plan: "pro"`, `planExpiresAt` +365 ngày;
  - `lastSeenRelease: RELEASES[0].version`, để ô Có gì mới không tự mở;
  - `onboardingDismissedAt: null`, `mustChangePassword: false`;
  - môn mặc định tạo bằng `seedSubjectsForUser`.
- **6 HS**, tên giả: Nguyễn Minh Anh (lớp 6), Trần Gia Bảo (6), Lê Khánh Chi (7), Phạm Đức Duy (8), Hoàng Thu Hà (9), Vũ Quốc Khánh (5).
  - 4 HS đầu thu theo buổi, 150.000đ/buổi.
  - 2 HS cuối thu trọn tháng, 800.000đ/tháng.
  - Phụ huynh tên giả, SĐT dạng `0900000001`…
- **Ca dạy** của **tháng trước** và **tháng này**: lặp T2/T4/T6 17:30–19:00 (4 HS đầu) và T3/T5 18:00–19:30 (2 HS cuối). Dùng `session.bulkCreate` hoặc API lặp có sẵn, xem input schema trong `src/server/trpc/routers/session.ts`.
- **Điểm danh:**
  - ca trong quá khứ: phần lớn có mặt, mỗi HS 1–2 buổi vắng (1 có phép, 1 không phép);
  - ca của **2 tháng trước** (thêm vài ca) để có **nợ cũ** cho Phạm Đức Duy.
- **Học phí tháng trước:**
  - Nguyễn Minh Anh và Trần Gia Bảo đã đóng đủ (`payment.record`);
  - Lê Khánh Chi đóng một phần 300.000đ;
  - còn lại chưa đóng.
- **Link phụ huynh** cho Nguyễn Minh Anh (`student.generateParentLink`). `seedDemo()` trả về token để chụp shot 18.
- **1 HS đã xoá mềm** "Đỗ Thảo Vy" (tạo rồi `student.delete`) cho shot 22.
- **Tài khoản ngân hàng:** **chưa** đặt lúc seed, để thẻ Bắt đầu hiện 3/5. Hàm riêng `setDemoBank()` đặt sau shot 2: BIN `970436`, STK `0123456789`, chủ TK `NGUYEN THI LAN`.

`cleanupDemo()`:
- xoá cứng mọi dữ liệu của user `guide_demo` theo đúng thứ tự FK: payments, monthlyTuition, sessionStudent, teachingSession, studentBillingChange, student, subject, consentRecord, planOrder, rồi user;
- chỉ lọc theo `userId` của `guide_demo`;
- user chưa có thì không làm gì;
- bảng nào khác chặn FK thì thêm vào đúng chỗ và ghi Ruling.

Đầu cả 2 hàm phải có:

```ts
expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`)
```

Nếu caller không tạo được thứ gì (ví dụ không có API lặp ca), dùng `db` với client đã có field encryption (`@/server/db`). **Không** dùng `new PrismaClient()` thô cho bảng có trường mã hoá.

- [ ] **Step 3: Viết `tests/guide-shots/guide-shots.spec.ts`**

Khung bắt buộc (phần từng shot tự viết theo bảng, selector tham khảo các file e2e sẵn có cùng màn hình):

```ts
import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { seedDemo, cleanupDemo, setDemoBank } from './demo-data';

test.describe.configure({ mode: 'serial' });

const OUT = 'public/guide';
let parentToken = '';

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await cleanupDemo();
  parentToken = await seedDemo();
});
test.afterAll(cleanupDemo);

// Ẩn badge dev của Next và toast để ảnh sạch.
async function clean(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal,[data-sonner-toaster]{display:none!important}' });
}
async function mark(target: Locator) {
  await target.first().evaluate((el) => { (el as HTMLElement).style.outline = '3px solid #ef4444'; (el as HTMLElement).style.outlineOffset = '2px'; });
  await target.first().scrollIntoViewIfNeeded();
}
async function shot(page: Page, name: string, kind: 'desktop' | 'mobile') {
  await clean(page);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/${name}-${kind}.jpg`, type: 'jpeg', quality: 80 });
}
```

- Mỗi shot là 1 `test(...)`. Lấy `kind` từ `test.info().project.name`.
- Đăng nhập bằng `guide_demo` / `teacher123` qua form `/login`, giống hàm `login` trong e2e.
- Thứ tự test theo bảng: shot 2 chạy trước `setDemoBank()`, tức gọi `setDemoBank()` ở đầu test shot 3.
- Dữ liệu mà test tạo thêm khi đang chụp (ví dụ mở hộp Chép lịch tháng rồi Huỷ) không được lưu thật. Chỉ mở hộp và chụp, **không bấm xác nhận**.
- Riêng shot 6 (Nhập Excel): tải file mẫu và viết 1 dòng đúng + 1 dòng sai (thiếu tên). Cách làm giống `tests/e2e/students-import.spec.ts` dòng 37–48.
- Chạy 2 project nối tiếp. Mỗi project tự seed và dọn vì `beforeAll` chạy theo từng project. Chấp nhận như vậy.

- [ ] **Step 4: Chạy script**

Kiểm RAM ≥ 3000 MB: `(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024`. Sau đó:

```
pnpm exec playwright test -c playwright.guide-shots.config.ts
```

Expected: 48 passed. `public/guide` có đúng 48 file `.jpg`, mỗi file 20–250 KB. Sau khi chạy, dừng đúng PID mình tạo, nếu còn.

- [ ] **Step 5: Tự xem ảnh**

Mở ít nhất 6 ảnh: 3 desktop, 3 mobile, gồm shot 2, 13, 17. Kiểm:
- đúng màn hình, có viền đỏ đúng chỗ;
- không có badge dev hay toast, không có ô Có gì mới che màn;
- không có tên người thật.

Ảnh nào sai thì sửa script rồi chạy lại cả bộ.

- [ ] **Step 6: Thêm mục vào `LENH.md`**

Thêm vào cuối:

```markdown
## Chụp lại ảnh hướng dẫn (/guide)
Khi giao diện màn hình có trong bảng ảnh của plan AA đổi: kiểm RAM ≥ 3000 MB rồi chạy
`pnpm exec playwright test -c playwright.guide-shots.config.ts` (chỉ DB test, tự tạo + dọn tài khoản guide_demo).
Xem lại vài ảnh trong public/guide trước khi commit.
```

- [ ] **Step 7: Commit**

```bash
git add playwright.guide-shots.config.ts tests/guide-shots public/guide LENH.md
git commit -m "feat: script chụp ảnh hướng dẫn + 48 ảnh máy tính/điện thoại"
```

---

### Task 2: Gắn ảnh vào nội dung hướng dẫn + test file ảnh đủ

**Files:**
- Modify: `src/lib/guide-content.ts`
- Modify: `src/components/guide/GuideContent.tsx` (chỉ đổi `step` → `stepText(step)`, chưa hiện ảnh)
- Modify: `src/lib/guide-docx.ts` (chỉ đổi `step` → `stepText(step)`, chưa chèn ảnh)
- Test: `tests/unit/lib/guide-content.test.ts`

**Interfaces:**
- Consumes: 48 file từ Task 1.
- Produces (trong `src/lib/guide-content.ts`):
  ```ts
  export type GuideShotKind = "desktop" | "mobile"
  export type GuideStep = string | { text: string; shot: string }
  export type GuideSection = { id: string; title: string; intro?: string; steps: GuideStep[]; tips?: string[] }
  export const GUIDE_SHOT_SIZE: Record<GuideShotKind, { width: number; height: number }> = {
    desktop: { width: 1280, height: 800 },
    mobile: { width: 780, height: 1688 },
  }
  export function stepText(step: GuideStep): string
  export function stepShot(step: GuideStep): string | undefined
  export function guideShotSrc(shot: string, kind: GuideShotKind): string // "/guide/<shot>-<kind>.jpg"
  export const GUIDE_SHOTS: readonly string[] // mọi shot theo thứ tự xuất hiện
  ```

- [ ] **Step 1: Viết test (đỏ)**

Thêm vào `tests/unit/lib/guide-content.test.ts`:

```ts
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { GUIDE_SHOTS, guideShotSrc, stepShot, stepText } from "@/lib/guide-content"

describe("ảnh hướng dẫn (plan AA)", () => {
  const files = new Set(readdirSync(join(process.cwd(), "public/guide")))

  it("có 24 shot, không trùng, đúng dạng kebab-case", () => {
    expect(GUIDE_SHOTS.length).toBe(24)
    expect(new Set(GUIDE_SHOTS).size).toBe(GUIDE_SHOTS.length)
    for (const s of GUIDE_SHOTS) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it("mỗi shot có đủ ảnh máy tính và điện thoại", () => {
    for (const s of GUIDE_SHOTS) {
      expect(files.has(`${s}-desktop.jpg`), s).toBe(true)
      expect(files.has(`${s}-mobile.jpg`), s).toBe(true)
    }
  })

  it("không có file ảnh thừa không bước nào dùng", () => {
    const used = new Set(GUIDE_SHOTS.flatMap((s) => [`${s}-desktop.jpg`, `${s}-mobile.jpg`]))
    expect([...files].filter((f) => !used.has(f))).toEqual([])
  })

  it("stepText / stepShot / guideShotSrc", () => {
    expect(stepText("a **b**")).toBe("a **b**")
    expect(stepShot("a")).toBeUndefined()
    expect(stepText({ text: "x", shot: "y" })).toBe("x")
    expect(stepShot({ text: "x", shot: "y" })).toBe("y")
    expect(guideShotSrc("hoc-phi-mien", "mobile")).toBe("/guide/hoc-phi-mien-mobile.jpg")
  })
})
```

Test cũ `"không có gạch dài, không có chỗ trống chưa viết"` đọc `JSON.stringify(GUIDE_SECTIONS)` nên vẫn chạy được, giữ nguyên.

- [ ] **Step 2: Chạy test, thấy đỏ**

Run: `pnpm exec cross-env NODE_ENV=test vitest run tests/unit/lib/guide-content.test.ts`
Expected: FAIL (`GUIDE_SHOTS` chưa export).

- [ ] **Step 3: Viết code**

Trong `guide-content.ts`:
- thêm các type, hằng số và hàm ở mục Interfaces;
- đổi 24 bước trong bảng Task 1 thành `{ text: "<chữ cũ y nguyên>", shot: "<mã>" }`, **không sửa chữ**;
- tạo `GUIDE_SHOTS = GUIDE_SECTIONS.flatMap((s) => s.steps.map(stepShot).filter((x): x is string => !!x))`.

Trong `GuideContent.tsx` và `guide-docx.ts`: chỗ đang dùng `step` làm chuỗi thì đổi thành `stepText(step)`.

- [ ] **Step 4: Chạy test, thấy xanh**

Run: `pnpm exec cross-env NODE_ENV=test vitest run tests/unit/lib tests/unit/components/GuideContent.test.tsx`
Expected: PASS hết. Kiểm thêm: `guide-docx.test.ts` cũ vẫn xanh.

- [ ] **Step 5: Commit**

```bash
git add src/lib/guide-content.ts src/components/guide/GuideContent.tsx src/lib/guide-docx.ts tests/unit/lib/guide-content.test.ts
git commit -m "feat: gắn mã ảnh vào 24 bước hướng dẫn, test đủ file ảnh"
```

---

### Task 3: Khung ảnh trên trang /guide

**Files:**
- Create: `src/components/guide/GuideShot.tsx`
- Modify: `src/components/guide/GuideContent.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/GuideShot.test.tsx`

**Interfaces:**
- Consumes: `GuideShotKind`, `GUIDE_SHOT_SIZE`, `guideShotSrc`, `stepShot`, `stepText` từ Task 2. `useMediaQuery` từ `src/hooks/useMediaQuery.ts`. `Dialog` từ `src/components/ui/dialog.tsx`.
- Produces: `export function GuideShot({ shot, alt }: { shot: string; alt: string })`.

i18n mới (cả `vi.json` và `en.json`):

| key | vi | en |
|---|---|---|
| `guide_shot_desktop` | Máy tính | Desktop |
| `guide_shot_mobile` | Điện thoại | Phone |
| `guide_shot_zoom` | Phóng to ảnh | Enlarge image |

- [ ] **Step 1: Viết test (đỏ)**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { GuideShot } from "@/components/guide/GuideShot"

function setMobile(isMobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("max-width") ? isMobile : !isMobile,
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
const ui = () => render(<LanguageProvider forcedLanguage="vi"><GuideShot shot="hoc-phi-mien" alt="Miễn phần còn thiếu" /></LanguageProvider>)
const img = () => screen.getAllByRole("img", { name: "Miễn phần còn thiếu" })[0] as HTMLImageElement

describe("GuideShot (plan AA)", () => {
  beforeEach(() => setMobile(false))

  it("máy tính: mặc định ảnh desktop, lazy, có width/height", () => {
    ui()
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
    expect(img().getAttribute("loading")).toBe("lazy")
    expect(img().getAttribute("width")).toBe("1280")
    expect(screen.getByRole("button", { name: "Máy tính" }).getAttribute("aria-pressed")).toBe("true")
  })

  it("điện thoại: mặc định ảnh mobile", () => {
    setMobile(true)
    ui()
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-mobile.jpg")
    expect(screen.getByRole("button", { name: "Điện thoại" }).getAttribute("aria-pressed")).toBe("true")
  })

  it("bấm Điện thoại → đổi ảnh; bấm Máy tính → đổi lại", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Điện thoại" }))
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-mobile.jpg")
    fireEvent.click(screen.getByRole("button", { name: "Máy tính" }))
    expect(img().getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
  })

  it("bấm Phóng to → mở hộp có ảnh đang chọn", () => {
    ui()
    fireEvent.click(screen.getByRole("button", { name: "Phóng to ảnh" }))
    const dialog = screen.getByRole("dialog")
    expect(dialog.querySelector("img")!.getAttribute("src")).toBe("/guide/hoc-phi-mien-desktop.jpg")
  })
})
```

Thêm 1 test vào `tests/unit/components/GuideContent.test.tsx`: số khung ảnh trên trang bằng `GUIDE_SHOTS.length`. Đếm bằng `container.querySelectorAll('[data-testid="guide-shot"]')`.

- [ ] **Step 2: Chạy test, thấy đỏ**

Run: `pnpm exec cross-env NODE_ENV=test vitest run tests/unit/components/GuideShot.test.tsx tests/unit/components/GuideContent.test.tsx`
Expected: FAIL (chưa có `GuideShot`).

- [ ] **Step 3: Viết `GuideShot.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { GUIDE_SHOT_SIZE, guideShotSrc, type GuideShotKind } from "@/lib/guide-content"

export function GuideShot({ shot, alt }: { shot: string; alt: string }) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [kind, setKind] = useState<GuideShotKind>("desktop")
  const [zoom, setZoom] = useState(false)
  // Mặc định theo thiết bị người xem; useMediaQuery trả false ở lần render đầu nên đồng bộ sau.
  useEffect(() => setKind(isMobile ? "mobile" : "desktop"), [isMobile])
  const size = GUIDE_SHOT_SIZE[kind]
  const src = guideShotSrc(shot, kind)
  const tab = (k: GuideShotKind, label: string) => (
    <button
      type="button"
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
      className={`h-11 rounded-md px-3 text-sm font-medium md:h-8 ${kind === k ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  )
  return (
    <figure data-testid="guide-shot" className="mt-2 rounded-lg border bg-slate-50 p-2 print:hidden">
      <div className="mb-2 flex items-center gap-1">
        {tab("desktop", t("guide_shot_desktop"))}
        {tab("mobile", t("guide_shot_mobile"))}
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label={t("guide_shot_zoom")}
          className="ml-auto flex size-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:size-8"
        >
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </div>
      <button type="button" onClick={() => setZoom(true)} className="block w-full" tabIndex={-1} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh đã nén sẵn, không tốn quota tối ưu ảnh của Vercel */}
        <img
          src={src}
          alt={alt}
          width={size.width}
          height={size.height}
          loading="lazy"
          className={`mx-auto h-auto rounded border bg-white ${kind === "mobile" ? "max-w-[240px]" : "w-full"}`}
        />
      </button>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-auto p-2 sm:max-w-5xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- như trên */}
          <img src={src} alt={alt} width={size.width} height={size.height} className={`mx-auto h-auto ${kind === "mobile" ? "max-w-[390px]" : "w-full"}`} />
        </DialogContent>
      </Dialog>
    </figure>
  )
}
```

Lưu ý: nút bọc ảnh có `aria-hidden` nên ảnh không bị đọc 2 lần. Test dùng `getAllByRole(...)[0]`. Nếu `getAllByRole` không thấy ảnh vì `aria-hidden`, bỏ `aria-hidden` trên nút bọc, giữ `tabIndex={-1}`, ghi Ruling.

`alt` truyền từ `GuideContent` = chữ của bước đã bỏ dấu `**`: `stepText(step).replaceAll("**", "")`.

- [ ] **Step 4: Gắn vào `GuideContent.tsx`**

Trong `<li>` của bước:

```tsx
<li key={j} className="break-inside-avoid">
  <Rich text={stepText(step)} />
  {stepShot(step) && <GuideShot shot={stepShot(step)!} alt={stepText(step).replaceAll("**", "")} />}
</li>
```

- [ ] **Step 5: Chạy test, thấy xanh**

Run: lệnh như Step 2.
Expected: PASS hết.

- [ ] **Step 6: Commit**

```bash
git add src/components/guide src/language tests/unit/components/GuideShot.test.tsx tests/unit/components/GuideContent.test.tsx
git commit -m "feat: khung ảnh máy tính/điện thoại trong trang hướng dẫn"
```

---

### Task 4: File Word làm sẵn có ảnh, nút tải thẳng

> **Đổi theo quyết định người dùng 2026-10-05 (sau khi duyệt plan):** file Word hướng dẫn **làm sẵn** thành file tĩnh `public/guide/huong-dan-su-dung.docx`. Nút **Tải Word** ở `/guide` là link tải thẳng, không dựng file trên trình duyệt nữa. Trang **Các bản cập nhật** GIỮ nguyên cách cũ: dựng trên trình duyệt, chỉ có chữ.

**Files:**
- Modify: `src/lib/guide-docx.ts`
- Modify: `src/lib/guide-content.ts` (thêm 2 hằng đường dẫn/tên file)
- Create: `scripts/build-guide-docx.ts`
- Create: `public/guide/huong-dan-su-dung.docx` (do script sinh)
- Modify: `package.json` (thêm script `"guide:docx": "tsx scripts/build-guide-docx.ts"`, không cài gì)
- Modify: `src/components/common/DocxDownloadButton.tsx`
- Modify: `LENH.md` (mục "Chụp lại ảnh hướng dẫn" của Task 1: thêm dòng chạy `pnpm guide:docx` sau khi chụp ảnh hoặc sửa `guide-content.ts`)
- Test: `tests/unit/lib/guide-docx.test.ts`, `tests/unit/lib/guide-docx-file.test.ts` (mới), `tests/unit/components/GuideContent.test.tsx`, `tests/unit/lib/guide-content.test.ts`

**Interfaces:**
- Consumes: `stepShot`, `stepText`, `GUIDE_SHOTS` từ Task 2; 48 ảnh từ Task 1.
- Produces:
  ```ts
  // src/lib/guide-content.ts (hằng chuỗi, import tĩnh không kéo thư viện docx vào trang)
  export const GUIDE_DOCX_PATH = "/guide/huong-dan-su-dung.docx"
  export const GUIDE_DOCX_FILENAME = "huong-dan-su-dung.docx"

  // src/lib/guide-docx.ts
  export type GuideShotImages = Map<string, { desktop?: Uint8Array; mobile?: Uint8Array }>
  // Bỏ tham số version: file làm sẵn không được cũ đi mỗi lần nâng version.
  export async function buildGuideDocx(sections: GuideSection[], images?: GuideShotImages): Promise<Blob>
  export { GUIDE_DOCX_FILENAME } from "@/lib/guide-content" // giữ tên export cũ cho code/test đang dùng
  ```

**Quy tắc dựng file**
- Dòng phụ đề dưới tiêu đề đổi từ `Bản v${version}` thành `Kèm ảnh minh hoạ máy tính và điện thoại`.
- Ngay sau đoạn `Bước N.` có shot, chèn đoạn ảnh với `indent: { left: 360 }`:
  - ảnh máy tính: `new ImageRun({ type: "jpg", data, transformation: { width: 576, height: 360 } })`, `spacing: { after: 80 }`;
  - ảnh điện thoại: `transformation: { width: 166, height: 360 }`, `spacing: { after: 160 }`.
- Shot nào không có ảnh trong `images` thì bỏ ảnh, giữ chữ.

- [ ] **Step 1: Viết test dựng file (đỏ)**

Trong `tests/unit/lib/guide-docx.test.ts`:
- đổi `buildGuideDocx(GUIDE_SECTIONS, "0.11.1")` thành `buildGuideDocx(GUIDE_SECTIONS)`;
- nếu có kiểm chữ `Bản v...` thì đổi sang kiểm `Kèm ảnh minh hoạ máy tính và điện thoại`, ghi Ruling;
- thêm:

```ts
import JSZip from "jszip"
import type { GuideSection } from "@/lib/guide-content"

// JPEG 1×1 hợp lệ, đủ để docx nhúng.
const JPG = Uint8Array.from(atob("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="), (c) => c.charCodeAt(0))
const SECTIONS: GuideSection[] = [{ id: "a", title: "A", steps: ["chữ", { text: "có ảnh", shot: "s1" }, { text: "thiếu ảnh", shot: "s2" }] }]

async function mediaCount(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return Object.keys(zip.files).filter((f) => f.startsWith("word/media/")).length
}

describe("Word có ảnh (plan AA)", () => {
  it("chèn đủ 2 ảnh của shot có dữ liệu, bỏ qua shot thiếu, chữ đủ", async () => {
    const blob = await buildGuideDocx(SECTIONS, new Map([["s1", { desktop: JPG, mobile: JPG }]]))
    expect(await mediaCount(blob)).toBe(2)
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file("word/document.xml")!.async("string")
    expect(xml).toContain("có ảnh")
    expect(xml).toContain("thiếu ảnh")
    expect(xml).toContain("Kèm ảnh minh hoạ máy tính và điện thoại")
  })

  it("không truyền images → không có ảnh, vẫn ra file", async () => {
    expect(await mediaCount(await buildGuideDocx(SECTIONS))).toBe(0)
  })
})
```

Nếu `docx` báo lỗi với chuỗi base64 JPEG trên, sinh một JPEG 1×1 hợp lệ khác và ghi Ruling. Không đổi sang PNG.

- [ ] **Step 2: Viết test kiểm file làm sẵn khớp nội dung (đỏ)**

Tạo `tests/unit/lib/guide-docx-file.test.ts`. Test này là chốt chặn để không bao giờ lên prod một file Word cũ:

```ts
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import JSZip from "jszip"
import { buildGuideDocx } from "@/lib/guide-docx"
import { GUIDE_SECTIONS, GUIDE_SHOTS } from "@/lib/guide-content"

const DIR = join(process.cwd(), "public/guide")
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
// Chỉ so chữ hiển thị (các <w:t>), không so cả XML vì id nội bộ của docx có thể khác giữa 2 lần dựng.
const texts = (xml: string) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("|")

async function open(buf: Uint8Array) {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file("word/document.xml")!.async("string")
  const media = await Promise.all(Object.keys(zip.files).filter((f) => f.startsWith("word/media/")).map((f) => zip.file(f)!.async("uint8array")))
  return { xml, media }
}

describe("public/guide/huong-dan-su-dung.docx (plan AA)", () => {
  it("chữ khớp nội dung hướng dẫn hiện tại; ảnh trong file đúng là 48 ảnh hiện tại (sai → chạy pnpm guide:docx)", async () => {
    const saved = await open(readFileSync(join(DIR, "huong-dan-su-dung.docx")))
    const fresh = await open(new Uint8Array(await (await buildGuideDocx(GUIDE_SECTIONS)).arrayBuffer()))
    expect(texts(saved.xml)).toBe(texts(fresh.xml))
    const want = GUIDE_SHOTS.flatMap((s) => ["desktop", "mobile"].map((k) => sha(readFileSync(join(DIR, `${s}-${k}.jpg`))))).sort()
    expect(saved.media.map(sha).sort()).toEqual(want)
  })
})
```

Trong `tests/unit/lib/guide-content.test.ts` (test của Task 2), test "không có file ảnh thừa" chỉ được xét file `.jpg`. Đổi dòng tạo `files` thành:

```ts
const files = new Set(readdirSync(join(process.cwd(), "public/guide")).filter((f) => f.endsWith(".jpg")))
```

Ghi Ruling: thư mục giờ có thêm file `.docx`.

- [ ] **Step 3: Chạy test, thấy đỏ**

Run: `pnpm exec cross-env NODE_ENV=test vitest run tests/unit/lib/guide-docx.test.ts tests/unit/lib/guide-docx-file.test.ts`
Expected: FAIL, vì chữ ký `buildGuideDocx` còn cũ và chưa có file `.docx`.

- [ ] **Step 4: Sửa `guide-docx.ts` và `guide-content.ts`**

- `guide-content.ts`: thêm `GUIDE_DOCX_PATH` và `GUIDE_DOCX_FILENAME` như mục Interfaces.
- `guide-docx.ts`:
  - bỏ khai báo `GUIDE_DOCX_FILENAME` cũ, re-export từ `guide-content`;
  - import thêm `ImageRun` từ `docx`, và `stepShot`, `stepText` từ `@/lib/guide-content`;
  - đổi chữ ký thành `buildGuideDocx(sections, images?)`, dùng phụ đề mới, chèn ảnh theo quy tắc.

- [ ] **Step 5: Viết `scripts/build-guide-docx.ts` rồi tạo file**

```ts
// Dựng sẵn file Word hướng dẫn (kèm ảnh) vào public/guide. Chạy lại sau khi chụp ảnh hoặc sửa guide-content.ts.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildGuideDocx, type GuideShotImages } from "../src/lib/guide-docx"
import { GUIDE_SECTIONS, GUIDE_SHOTS } from "../src/lib/guide-content"

const DIR = join(process.cwd(), "public/guide")
const images: GuideShotImages = new Map(
  GUIDE_SHOTS.map((s) => [s, { desktop: readFileSync(join(DIR, `${s}-desktop.jpg`)), mobile: readFileSync(join(DIR, `${s}-mobile.jpg`)) }])
)

buildGuideDocx(GUIDE_SECTIONS, images).then(async (blob) => {
  const out = join(DIR, "huong-dan-su-dung.docx")
  writeFileSync(out, Buffer.from(await blob.arrayBuffer()))
  console.log(`OK ${out} (${Math.round(blob.size / 1024)} KB)`)
})
```

`tsx` đã giải được alias `@/` khi chạy `prisma/seed.ts` và `tests/helpers/trpc`. Nếu ở đây vẫn lỗi alias thì chỉ sửa import trong script, không sửa `guide-docx.ts`, và ghi Ruling.

Thêm vào mục `scripts` của `package.json`: `"guide:docx": "tsx scripts/build-guide-docx.ts"`. Sau đó chạy:

```
pnpm guide:docx
```

Expected: in ra `OK ...huong-dan-su-dung.docx (<N> KB)` với N dưới 12000. Ghi N vào ledger.

- [ ] **Step 6: Đổi nút Tải Word ở /guide thành link tải thẳng**

Trong `DocxDownloadButton.tsx`:
- `doc === "guide"`: render một link, không import động thư viện nào:
  ```tsx
  <Button asChild variant="outline" className="h-11 gap-2 md:h-10 print:hidden">
    <a href={GUIDE_DOCX_PATH} download={GUIDE_DOCX_FILENAME}>
      <FileDown className="size-4" aria-hidden />
      {t("guide_download_docx")}
    </a>
  </Button>
  ```
  2 hằng import tĩnh từ `@/lib/guide-content`, không import từ `@/lib/guide-docx`.
- `doc === "updates"`: giữ nguyên luồng cũ (import động, `buildUpdatesDocx`, `saveAs`). Hook (`useState` và các hook khác) phải gọi trước nhánh `if (doc === "guide") return ...` để đúng luật hook.
- Bỏ import `GUIDE_SECTIONS` nếu không còn dùng.

Sửa `tests/unit/components/GuideContent.test.tsx`:
- Test đầu đang dùng `getByRole("button", { name: viText.guide_download_docx })`: đổi sang `getByRole("link", ...)`, vẫn kiểm class `print:hidden`.
- Test "bấm Tải Word": đổi thành kiểm link có `href="/guide/huong-dan-su-dung.docx"` và `download="huong-dan-su-dung.docx"`.
- Bỏ mock `file-saver` và `@/lib/guide-docx` trong file này nếu không còn cần.
- Ghi Ruling: đây là thay đổi hành vi có chủ đích. `UpdatesContent.test.tsx` không đổi gì và vẫn phải xanh.

- [ ] **Step 7: Chạy test, thấy xanh**

Run: `pnpm exec cross-env NODE_ENV=test vitest run tests/unit/lib tests/unit/components/GuideContent.test.tsx tests/unit/components/UpdatesContent.test.tsx`, rồi chạy `pnpm test`.
Expected: tất cả PASS.

- [ ] **Step 8: Để file mẫu cho Claude kiểm**

Chép `public/guide/huong-dan-su-dung.docx` vào `.superpowers/sdd/2026-10-05-aa-anh-huong-dan/huong-dan-mau.docx`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/guide-docx.ts src/lib/guide-content.ts scripts/build-guide-docx.ts public/guide/huong-dan-su-dung.docx package.json src/components/common/DocxDownloadButton.tsx LENH.md tests/unit
git commit -m "feat: file Word hướng dẫn làm sẵn có ảnh, nút tải thẳng"
```

---

### Task 5: Bản 0.12.0 + e2e + kiểm toàn bộ

**Files:**
- Modify: `package.json` (`"version": "0.12.0"`)
- Modify: `src/lib/releases.ts` (thêm mục đầu)
- Modify: `tests/e2e/w-huong-dan-co-gi-moi.spec.ts` (thêm 1 test)

- [ ] **Step 1: Mục RELEASES**

Thêm vào **đầu** mảng `RELEASES`:

```ts
{
  version: "0.12.0",
  date: "2026-10-05",
  title: "Hướng dẫn có ảnh minh hoạ",
  summary: "Các bước chính trong Hướng dẫn sử dụng có ảnh chụp màn hình máy tính và điện thoại.",
  notify: true,
  items: [
    { kind: "new", title: "Ảnh minh hoạ từng bước", body: "Bước chính có ảnh chụp màn hình, chỗ cần bấm có viền đỏ. Chọn Máy tính hoặc Điện thoại, bấm ảnh để phóng to.", guideId: "bat-dau" },
    { kind: "improve", title: "File Word có ảnh", body: "File Word tải từ trang hướng dẫn có kèm ảnh minh hoạ." },
  ],
},
```

Và `package.json` → `"version": "0.12.0"`.

- [ ] **Step 2: e2e**

Thêm vào `describe('Spec W')` của `tests/e2e/w-huong-dan-co-gi-moi.spec.ts`:

```ts
test('/guide: ảnh minh hoạ tải được, chuyển Điện thoại đổi ảnh', async ({ page }) => {
  await page.goto('/guide');
  const fig = page.locator('section#hoc-phi [data-testid="guide-shot"]').first();
  await fig.scrollIntoViewIfNeeded();
  const img = fig.locator('img');
  await expect(img).toHaveAttribute('src', /-desktop\.jpg$/);
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1280);
  await fig.getByRole('button', { name: 'Điện thoại' }).click();
  await expect(img).toHaveAttribute('src', /-mobile\.jpg$/);
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(780);
});
```

Test mở ô Có gì mới (dùng `LATEST_NOTIFY`) giờ sẽ trỏ sang 0.12.0. Nếu test cũ nào đỏ vì đó, sửa setup cho đúng, ghi Ruling. Không xoá test.

- [ ] **Step 3: Kiểm toàn bộ**

1. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`: tất cả xanh.
2. Kiểm RAM ≥ 3000 MB, rồi chạy e2e nửa 1: `pnpm exec playwright test $(cat .superpowers/sdd/2026-10-03-y-thu-hoc-phi/half1.txt)`.
3. Dọn PID của mình, kiểm RAM, rồi chạy nửa 2 theo `half2.txt`.
4. Expected: mọi e2e PASS. Số skipped giữ nguyên như trước (1).

- [ ] **Step 4: Commit + báo cáo**

```bash
git add package.json src/lib/releases.ts tests/e2e/w-huong-dan-co-gi-moi.spec.ts
git commit -m "chore: v0.12.0 hướng dẫn có ảnh minh hoạ"
```

1. Ghi ledger `Task 5: complete (...)`.
2. Viết báo cáo `.superpowers/gehihi/bao-cao-AA.md`:
   - số vitest và e2e;
   - mọi Ruling;
   - tổng dung lượng `public/guide`;
   - kích thước file Word mẫu;
   - danh sách shot đã đổi tên hoặc đổi trang so với bảng, nếu có.
3. Ghi `DONE AA` vào kênh.
