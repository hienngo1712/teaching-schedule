# C — Phiếu báo học phí + VietQR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Từ màn Học phí, giáo viên bấm "Phiếu báo" cho 1 học sinh/tháng → xem trước phiếu (số buổi, học phí, nợ cũ, các lần thu, còn phải trả, mã VietQR đúng số còn lại) → Chia sẻ (Web Share) hoặc Tải ảnh PNG; thêm trang `/settings` để lưu tài khoản ngân hàng nhận học phí.

**Architecture:** Server tạo toàn bộ DTO phiếu, kể cả payload VietQR (`src/lib/vietqr.ts` thuần, CRC16 tự viết), chỉ đọc DB (`getMonthlyTuitionStatus(..., false)` + `listPayments` của B). Client vẽ ảnh QR bằng `qrcode` (data URL PNG), render `TuitionNoticeCard` rồi chụp bằng `html2canvas` (đã có) thành Blob ngay khi phiếu sẵn sàng; nút Chia sẻ/Tải ảnh dùng Blob có sẵn. Tài khoản ngân hàng lưu ở 3 cột nullable mới trên `users`.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, Prisma 5, Zod 3, Tailwind 3, shadcn/ui, lucide-react, html2canvas, file-saver, `qrcode` (MỚI), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-c-phieu-bao-hoc-phi-vietqr-design.md` (phụ thuộc B: `docs/superpowers/specs/2026-09-25-b-lich-su-thu-tien-design.md` mục 7 và 11).

## Global Constraints

- **Phụ thuộc B:** chỉ code C khi B đã merge vào `main` (Task 1 kiểm tra; thiếu thì DỪNG). Mọi chỗ plan dùng interface của B (`Payment`, `PaymentDTO`, `listPayments`, `payment.create`, `tuition.updateSettlement`, `TuitionDetailSheet` bản B, key i18n của B): **đối chiếu interface thật trong code trước khi làm; lệch với plan thì theo code thật và ghi lại trong message commit + báo cáo task.**
- **AN TOÀN DB:** trước mọi lệnh DB đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` KHÁC `.env.test`. `.env` = PRODUCTION (host `ep-polished-voice`), `.env.test` = test (host `ep-jolly-dew`). Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test` qua `tests/env-setup.ts`).
- **CẤM:** `db:reset`, `prisma migrate reset`, `db push --force-reset`, `pnpm build` (chạy `prisma migrate deploy` lên prod), `pnpm dev` (dùng DB prod), `pnpm db:migrate:*`. Build kiểm tra bằng `pnpm exec next build`.
- **Migration mới:** tạo bằng `prisma migrate dev --create-only` với `DATABASE_URL`/`DIRECT_URL` của `.env.test` (lệnh có chốt chặn host ở Task 3; `package.json` KHÔNG có `dotenv-cli`, nên nạp `.env.test` bằng `set -a; . ./.env.test` trong subshell). Đọc lại SQL, áp lên DB test bằng `prisma migrate deploy` trong subshell đó. **KHÔNG bao giờ áp lên prod thủ công** (prod tự chạy `prisma migrate deploy` khi Vercel build sau merge).
- Chạy test 1 file: `pnpm test <đường-dẫn>`. Không chạy 2 lượt `pnpm test` song song (tranh DB test → treo). Bộ đầy đủ mất ~10–15 phút.
- **E2E:** cổng 3000 có thể bị project khác chiếm → dùng config tạm git-ignored `.superpowers/pw-3100.config.ts` (Task 8 có nội dung), port 3100, url kiểm tra `http://127.0.0.1:3100/login`, `reuseExistingServer: true`. Test mobile ẩn Next dev badge (`nextjs-portal`) bằng `addInitScript`. `ResponsiveList` render cả bảng lẫn thẻ → lọc phần tử visible hoặc dùng test id (`list-card`).
- **i18n:** `src/language/vi.json` và `en.json` phải cùng bộ key. Chuỗi mới không dùng dấu gạch dài. Thông báo lỗi server viết tiếng Việt.
- Giữ nhận diện A1: indigo/slate, lucide-react, shadcn/ui, `rounded-lg`. Vùng chạm mobile ≥ 44px (`size-11`, `h-11`), viewport kiểm thử 390×844, breakpoint `md`.
- `TuitionNoticeCard`: rộng cố định `360px`, nền trắng, chữ `slate-900`, chỉ block/grid; **không** `rounded-full`, `inline-flex`, `shadow`. Chụp `scale: 2` (ảnh 720px ngang).
- Payload VietQR: tag 59/60 KHÔNG đưa vào; nội dung CK `HP T{tháng} {Tên không dấu}`, chỉ `[A-Za-z0-9 ]`, tối đa **25** ký tự.
- Mở phiếu **không ghi gì vào DB**. `useExport.ts` giữ nguyên.
- Ghi chú code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc/bẫy.
- Làm trên nhánh `feat/c-tuition-notice` (không commit lên `main`). Agent thực hiện task **KHÔNG merge, KHÔNG push** — người điều phối làm sau review cuối. Commit kết thúc bằng 2 dòng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg
  ```
- Không nhập mật khẩu/credential vào trình duyệt; không thao tác ghi trên tài khoản production.
- Mỗi task kết thúc bằng: test của task xanh + `pnpm exec tsc --noEmit` sạch + `pnpm lint` sạch, rồi commit.

## Điều chỉnh so với spec

1. **i18n dùng lại key sẵn có** thay vì thêm mới: `student` ("Học sinh") thay `notice_student`; `grade` ("Lớp"); `total_amount_due` cho dòng "Tổng phải đóng" (cùng nhãn với sheet chi tiết → dễ đối chiếu); từ B: `paid_total` ("Đã trả"), `method_cash`, `method_transfer`, `payment_amount` ("Số tiền"). Còn 28 key mới.
2. **Thêm `src/lib/tuition-notice.ts`** (`noticeFeePerSession`, `noticePaymentState`) để logic hiển thị S9 + mục 6.3.5 test được bằng unit test thuần; card chỉ gọi 2 hàm này.
3. **`TuitionNoticeDialog` chỉ mount khi mở**, props `{ studentId, year, month, onClose }` (như `SubjectFormDialog` của A2) → Blob/state tự reset mỗi lần mở, không cần prop `open`.
4. **`elementToPngBlob` chờ các animation hữu hạn chạy xong và tắt animation trong bản clone** trước khi chụp: Sheet/Dialog có hiệu ứng trượt/phóng 300–500ms; nếu dữ liệu đã cache, phiếu sẵn sàng ngay khi khung còn đang trượt → ảnh lệch/trắng.
5. **`bankConfigured` = đủ 3 cột VÀ BIN còn trong `VN_BANKS`** (BIN bị bỏ khỏi danh sách sau này → coi như chưa cài, không tạo QR sai ngân hàng).
6. **Form Cài đặt tách thành `src/components/settings/BankAccountCard.tsx`**; `src/app/(app)/settings/page.tsx` chỉ ghép `PageHeader` + card (theo mẫu A2).
7. **Số tài khoản được `trim()` trước khi kiểm regex** (dán từ Zalo hay dính khoảng trắng đầu/cuối); khoảng trắng ở giữa vẫn bị từ chối.
8. **Nút "Tải ảnh" gọi thẳng `saveAs`**; chỉ nút "Chia sẻ" đi qua `shareOrDownloadPng`.
9. Integration so số tiền với `tuition.getMonthlyStatusReadOnly` (cùng hàm tính, không ghi) thay vì `getMonthlyStatus` để không làm bẩn phép kiểm "chỉ đọc".

## Review Focus

1. **Tên HS có dấu/ký tự lạ, rất dài** ("Nguyễn Thị Hường", "Đạt", tên 35+ ký tự) → nội dung CK chỉ ASCII `[A-Za-z0-9 ]`, ≤ 25 ký tự, không khoảng trắng cuối khi cắt đúng vào dấu cách. Pin: unit Task 2.
2. **Mở lại phiếu khi dữ liệu đã cache** (phiếu sẵn sàng trong lúc Sheet còn trượt vào) → ảnh tải về vẫn đủ nội dung, không trắng/lệch. Pin: e2e Task 8 tải ảnh ở cả lần mở từ thẻ và lần mở lại từ sheet, kiểm rộng 720px + đếm điểm ảnh tối.
3. **Dư tháng trước lớn hơn học phí tháng** (`totalAmountDue < 0`) → "Còn phải trả" 0, không QR, không hiện "trả dư" ảo. Pin: integration Task 4.
4. **Tháng không có buổi nào nhưng còn nợ cũ** → phiếu vẫn tạo, `presentDates` rỗng, QR = nợ cũ. Pin: integration Task 4.
5. **BIN đã lưu không còn trong `VN_BANKS`** → phiếu coi như chưa cài ngân hàng, không crash, không QR. Pin: integration Task 4.

---

## File Structure

| File | Trạng thái | Trách nhiệm | Task |
|---|---|---|---|
| `src/lib/vietqr.ts` | Mới | `crc16Ccitt`, `tlv`, `buildTransferContent`, `buildVietQrPayload` | 2 |
| `src/lib/vn-banks.ts` | Mới | `VnBank`, `VN_BANKS`, `findBank` | 2 |
| `prisma/schema.prisma` | Sửa | 3 cột ngân hàng trên `User` | 3 |
| `prisma/migrations/<ts>_add_user_bank_account/migration.sql` | Mới (sinh tự động) | `ALTER TABLE "users" ADD COLUMN` × 3 | 3 |
| `src/lib/schemas/settings.ts` | Mới | `bankAccountSchema`, `updateBankAccountSchema`, `BankAccountInput` | 3 |
| `src/server/services/settings.service.ts` | Mới | `getBankAccount`, `updateBankAccount` | 3 |
| `src/server/trpc/routers/settings.ts` | Mới | `settings.getBankAccount`, `settings.updateBankAccount` | 3 |
| `src/server/trpc/root.ts` | Sửa | đăng ký `settings` | 3 |
| `src/lib/types/models.ts` | Sửa | `TuitionNoticeDTO` | 4 |
| `src/lib/schemas/tuition.ts` | Sửa | `tuitionNoticeSchema`, `TuitionNoticeInput` | 4 |
| `src/server/services/tuition-notice.service.ts` | Mới | `getTuitionNotice` (chỉ đọc) | 4 |
| `src/server/trpc/routers/tuition.ts` | Sửa | `tuition.getNotice` | 4 |
| `src/language/vi.json`, `en.json` | Sửa | 28 key mới | 5 |
| `src/components/settings/BankAccountCard.tsx` | Mới | Form tài khoản nhận học phí | 5 |
| `src/app/(app)/settings/page.tsx` | Mới | Route `/settings` | 5 |
| `src/components/layout/AppHeader.tsx` | Sửa | Mục "Cài đặt" trong menu avatar | 5 |
| `package.json`, `pnpm-lock.yaml` | Sửa | `qrcode`, `@types/qrcode` | 6 |
| `src/lib/share-image.ts` | Mới | `elementToPngBlob`, `canShareFiles`, `shareOrDownloadPng` | 6 |
| `src/lib/tuition-notice.ts` | Mới | `noticeFeePerSession`, `noticePaymentState` | 6 |
| `src/components/tuition/TuitionNoticeCard.tsx` | Mới | Phiếu thuần hiển thị (G dùng lại) | 7 |
| `src/components/tuition/TuitionNoticeDialog.tsx` | Mới | Xem trước + Chia sẻ/Tải ảnh | 7 |
| `src/app/(app)/tuition/page.tsx` | Sửa | Nút "Phiếu báo" ở thẻ + bảng | 7 |
| `src/components/tuition/TuitionDetailSheet.tsx` | Sửa | Nút "Phiếu báo" ở footer (bản B) | 7 |
| `tests/unit/lib/vietqr.test.ts`, `tests/unit/lib/vn-banks.test.ts` | Mới | | 2 |
| `tests/unit/schemas/settings.schema.test.ts`, `tests/integration/settings.test.ts` | Mới | | 3 |
| `tests/integration/tuition-notice.test.ts` | Mới | | 4 |
| `tests/unit/lib/share-image.test.ts`, `tests/unit/lib/tuition-notice.test.ts` | Mới | | 6 |
| `tests/e2e/tuition-notice.spec.ts` | Mới | E2E 390px | 8 |

---

### Task 1: Nhánh + kiểm tra B đã merge

**Đọc trước:** spec C mục 12; spec B mục 7 và 11; `docs/coding-rule.md` §6.1.

**Files:** không sửa file nào.

**Interfaces:**
- Produces: nhánh `feat/c-tuition-notice` từ `main` mới nhất; xác nhận các interface B mà Task 4, 7 dùng.

- [ ] **Step 1: Cập nhật `main`**

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

- [ ] **Step 2: Kiểm tra B đã merge — thiếu bất kỳ dòng nào thì DỪNG, báo người dùng "B chưa merge vào main", không làm tiếp**

```bash
grep -n "^model Payment" prisma/schema.prisma
grep -n "export async function listPayments" src/server/services/payment.service.ts
grep -n "PaymentDTO" src/lib/types/models.ts
grep -n "payment: paymentRouter" src/server/trpc/root.ts
grep -n "updateSettlement" src/server/trpc/routers/tuition.ts
grep -n "payment" src/components/tuition/TuitionDetailSheet.tsx | head -5
node -e "const vi=require('./src/language/vi.json');const miss=['paid_total','method_cash','method_transfer','payment_amount'].filter(k=>!(k in vi));console.log(miss.length?'THIẾU: '+miss:'OK')"
```
Expected: mỗi `grep` in ít nhất 1 dòng; lệnh `node` in `OK`.

- [ ] **Step 3: Ghi lại chữ ký thật của B (để các task sau đối chiếu)**

Đọc và ghi vào báo cáo task (không tạo file):
- `listPayments(...)` trong `src/server/services/payment.service.ts`: tham số, kiểu trả về, thứ tự sắp.
- `PaymentDTO` trong `src/lib/types/models.ts` (plan giả định `{ id: number; amount: number; paidAt: string /* YYYY-MM-DD */; method: "cash" | "transfer"; note: string | null }`).
- Input của `payment.create` (plan giả định `{ studentId, year, month, amount, paidAt: "YYYY-MM-DD", method: "cash" | "transfer", note? }`) và `tuition.updateSettlement` (plan giả định `{ studentId, year, month, isFullPaid, notes? }`).
- Trong `TuitionDetailSheet.tsx` bản B: prop chứa `studentId/year/month` (plan giả định `data: (… & { year; month }) | null` như hiện tại) và vị trí nút **Lưu** ở footer.

- [ ] **Step 4: `qrcode` chưa có**

Run: `grep -n '"qrcode"\|"@types/qrcode"' package.json`
Expected: không in gì (Task 6 sẽ thêm). Nếu đã có, ghi lại phiên bản, Task 6 bỏ bước cài.

- [ ] **Step 5: Tạo nhánh**

```bash
git checkout -b feat/c-tuition-notice
```
(Nếu nhánh đã tồn tại: `git checkout feat/c-tuition-notice && git merge --ff-only main`.)

- [ ] **Step 6: Xác nhận DB test**

```bash
h(){ grep -E '^DATABASE_URL=' "$1" | sed -E 's#.*@([^/:?]+).*#\1#'; }; echo "env=$(h .env) test=$(h .env.test)"
```
Expected: 2 host khác nhau, `.env.test` chứa `ep-jolly-dew`. Giống nhau → DỪNG, báo người dùng.

(Không có commit ở task này.)

---

### Task 2: `vietqr.ts` + `vn-banks.ts` (TDD, thuần)

**Đọc trước:** spec C mục 4 (S6, S7), 7.1, 7.2, 10 (Unit).

**Files:**
- Create: `src/lib/vietqr.ts`, `src/lib/vn-banks.ts`
- Test: `tests/unit/lib/vietqr.test.ts`, `tests/unit/lib/vn-banks.test.ts`

**Interfaces:**
- Produces:
  - `crc16Ccitt(s: string): string` — 4 ký tự hex viết hoa.
  - `tlv(id: string, value: string): string` — ném `Error` nếu `value.length > 99`.
  - `buildTransferContent(fullName: string, month: number): string`
  - `buildVietQrPayload(input: { bin: string; accountNumber: string; amount: number; content: string }): string` — ném `Error` nếu `amount` không nguyên hoặc < 1.
  - `type VnBank = { bin: string; shortName: string; name: string }`, `VN_BANKS: readonly VnBank[]` (25 mục), `findBank(bin: string): VnBank | undefined`.

- [ ] **Step 1: Viết test fail**

`tests/unit/lib/vietqr.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { buildTransferContent, buildVietQrPayload, crc16Ccitt, tlv } from "@/lib/vietqr"

// Mẫu ở spec C §7.1 (đã tính tay bằng CRC-16/CCITT-FALSE).
const SAMPLE_INPUT = {
  bin: "970436",
  accountNumber: "0011001234567",
  amount: 850000,
  content: "HP T9 Nguyen Van A",
}
const SAMPLE_PAYLOAD =
  "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA530370454068500005802VN62220818HP T9 Nguyen Van A63041DD5"

describe("crc16Ccitt", () => {
  it("giá trị kiểm chuẩn CRC-16/CCITT-FALSE", () => {
    expect(crc16Ccitt("123456789")).toBe("29B1")
  })

  it("luôn đủ 4 ký tự hex viết hoa", () => {
    expect(crc16Ccitt("")).toBe("FFFF")
    expect(crc16Ccitt("A")).toMatch(/^[0-9A-F]{4}$/)
  })
})

describe("tlv", () => {
  it("id + độ dài 2 chữ số + giá trị", () => {
    expect(tlv("54", "5000")).toBe("54045000")
    expect(tlv("58", "VN")).toBe("5802VN")
  })

  it("giá trị dài hơn 99 ký tự → ném lỗi", () => {
    expect(() => tlv("08", "x".repeat(100))).toThrow()
  })
})

describe("buildVietQrPayload", () => {
  it("khớp payload mẫu trong spec từng ký tự", () => {
    expect(buildVietQrPayload(SAMPLE_INPUT)).toBe(SAMPLE_PAYLOAD)
  })

  it("đổi số tiền → tag 54 và CRC đổi theo", () => {
    const p = buildVietQrPayload({ ...SAMPLE_INPUT, amount: 850001 })
    expect(p).toContain("5406850001")
    expect(p.slice(-4)).toBe("E99E")
    expect(p.slice(-4)).toBe(crc16Ccitt(p.slice(0, -4)))
  })

  it("số tiền không nguyên dương → ném lỗi", () => {
    expect(() => buildVietQrPayload({ ...SAMPLE_INPUT, amount: 0 })).toThrow()
    expect(() => buildVietQrPayload({ ...SAMPLE_INPUT, amount: 1.5 })).toThrow()
  })
})

describe("buildTransferContent", () => {
  it("bỏ dấu, đổi Đ/đ", () => {
    expect(buildTransferContent("Nguyễn Văn Đạt", 9)).toBe("HP T9 Nguyen Van Dat")
    expect(buildTransferContent("Nguyễn Thị Hường", 10)).toBe("HP T10 Nguyen Thi Huong")
  })

  it("tên rất dài → tối đa 25 ký tự, chỉ [A-Za-z0-9 ]", () => {
    const c = buildTransferContent("Tôn Nữ Hoàng Thị Phương Thảo Nguyên", 12)
    expect(c).toBe("HP T12 Ton Nu Hoang Thi P")
    expect(c.length).toBeLessThanOrEqual(25)
    expect(c).toMatch(/^[A-Za-z0-9 ]+$/)
  })

  it("cắt trúng dấu cách → không để khoảng trắng cuối", () => {
    // "HP T12 Nguyen Thi Huongg " dài đúng 25 ký tự, ký tự cuối là dấu cách
    expect(buildTransferContent("Nguyen Thi Huongg Xuan", 12)).toBe("HP T12 Nguyen Thi Huongg")
  })

  it("ký tự đặc biệt và khoảng trắng thừa bị lọc/gộp", () => {
    expect(buildTransferContent("  Lê  O'Neil (Bin) ", 3)).toBe("HP T3 Le ONeil Bin")
  })
})
```

`tests/unit/lib/vn-banks.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { VN_BANKS, findBank } from "@/lib/vn-banks"

describe("VN_BANKS", () => {
  it("25 ngân hàng, BIN 6 chữ số, không trùng", () => {
    expect(VN_BANKS).toHaveLength(25)
    VN_BANKS.forEach((b) => expect(b.bin).toMatch(/^\d{6}$/))
    expect(new Set(VN_BANKS.map((b) => b.bin)).size).toBe(25)
    expect(new Set(VN_BANKS.map((b) => b.shortName)).size).toBe(25)
  })

  it("findBank theo BIN", () => {
    expect(findBank("970436")?.shortName).toBe("Vietcombank")
    expect(findBank("970422")?.shortName).toBe("MB")
    expect(findBank("999999")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/vietqr.test.ts tests/unit/lib/vn-banks.test.ts`
Expected: FAIL — không resolve `@/lib/vietqr`, `@/lib/vn-banks`.

- [ ] **Step 3: Viết `src/lib/vietqr.ts`**

```ts
// VietQR (NAPAS) theo chuẩn EMVCo MPM. Thuần: dùng được ở server lẫn client.

export function crc16Ccitt(s: string): string {
  // CRC-16/CCITT-FALSE: đa thức 0x1021, khởi tạo 0xFFFF, không đảo bit, không XOR cuối.
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

export function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Trường ${id} dài quá 99 ký tự`)
  return id + String(value.length).padStart(2, "0") + value
}

const NAPAS_GUID = "A000000727"
// Chuyển nhanh 24/7 tới số tài khoản (QRIBFTTC là tới số thẻ).
const SERVICE_TO_ACCOUNT = "QRIBFTTA"
// Giới hạn an toàn cho nội dung CK ở mọi ngân hàng (spec C S7).
const MAX_CONTENT_LENGTH = 25

export function buildTransferContent(fullName: string, month: number): string {
  // "đ/Đ" không tách được bằng NFD nên phải đổi riêng.
  return `HP T${month} ${fullName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CONTENT_LENGTH)
    .trimEnd()
}

export function buildVietQrPayload(input: {
  bin: string
  accountNumber: string
  amount: number
  content: string
}): string {
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error("Số tiền phải là số nguyên dương")
  }
  const merchant =
    tlv("00", NAPAS_GUID) +
    tlv("01", tlv("00", input.bin) + tlv("01", input.accountNumber)) +
    tlv("02", SERVICE_TO_ACCOUNT)
  // Không đưa tag 59/60 (tên/thành phố): app ngân hàng tự tra tên chủ TK (spec C S6).
  const body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merchant) +
    tlv("53", "704") +
    tlv("54", String(input.amount)) +
    tlv("58", "VN") +
    tlv("62", tlv("08", input.content)) +
    "6304"
  // CRC tính trên toàn chuỗi, kể cả "6304".
  return body + crc16Ccitt(body)
}
```

- [ ] **Step 4: Đối chiếu BIN với danh sách NAPAS/VietQR công bố**

Tra (chỉ lúc viết code, app không gọi): `https://api.vietqr.io/v2/banks` (trường `bin`, `shortName`) — nếu không truy cập được thì dùng trang danh sách ngân hàng của NAPAS/vietqr.net. So 25 BIN ở Step 5 với nguồn; BIN nào lệch thì sửa theo nguồn và ghi vào message commit. Không đổi `shortName` của Vietcombank và MB (test dùng).

- [ ] **Step 5: Viết `src/lib/vn-banks.ts`**

```ts
export type VnBank = { bin: string; shortName: string; name: string }

// BIN theo danh sách NAPAS/VietQR (đối chiếu khi code). Thêm ngân hàng = thêm 1 dòng.
export const VN_BANKS: readonly VnBank[] = [
  { bin: "970436", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam" },
  { bin: "970415", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam" },
  { bin: "970418", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { bin: "970405", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
  { bin: "970407", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
  { bin: "970422", shortName: "MB", name: "Ngân hàng TMCP Quân đội" },
  { bin: "970416", shortName: "ACB", name: "Ngân hàng TMCP Á Châu" },
  { bin: "970432", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: "970423", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
  { bin: "970403", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { bin: "970441", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: "970443", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn Hà Nội" },
  { bin: "970437", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh" },
  { bin: "970448", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông" },
  { bin: "970426", shortName: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam" },
  { bin: "970440", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á" },
  { bin: "970431", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: "970449", shortName: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam" },
  { bin: "970428", shortName: "Nam A Bank", name: "Ngân hàng TMCP Nam Á" },
  { bin: "970409", shortName: "Bac A Bank", name: "Ngân hàng TMCP Bắc Á" },
  { bin: "970425", shortName: "ABBANK", name: "Ngân hàng TMCP An Bình" },
  { bin: "970412", shortName: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam" },
  { bin: "970452", shortName: "Kienlongbank", name: "Ngân hàng TMCP Kiên Long" },
  { bin: "970454", shortName: "BVBank", name: "Ngân hàng TMCP Bản Việt" },
  { bin: "970419", shortName: "NCB", name: "Ngân hàng TMCP Quốc Dân" },
]

export function findBank(bin: string): VnBank | undefined {
  return VN_BANKS.find((b) => b.bin === bin)
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/vietqr.test.ts tests/unit/lib/vn-banks.test.ts`
Expected: PASS 13/13.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 8: Commit**

```bash
git add src/lib/vietqr.ts src/lib/vn-banks.ts tests/unit/lib/vietqr.test.ts tests/unit/lib/vn-banks.test.ts
git commit -m "feat(vietqr): payload VietQR EMVCo + CRC16, danh sách ngân hàng VN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 3: Migration + backend Cài đặt ngân hàng

**Đọc trước:** spec C mục 4 (S2), 7.3 (`settings.ts`), 7.4 (`settings.service.ts`), 7.5, 8, 10 (schema + `settings.test.ts`); `docs/coding-rule.md` §6.1; `src/server/trpc/routers/subject.ts` (mẫu router); `tests/helpers/trpc.ts` (seed có user `teacher`, `teacher2`).

**Files:**
- Modify: `prisma/schema.prisma` (model `User`)
- Create: `prisma/migrations/<timestamp>_add_user_bank_account/migration.sql` (sinh tự động)
- Create: `src/lib/schemas/settings.ts`, `src/server/services/settings.service.ts`, `src/server/trpc/routers/settings.ts`
- Modify: `src/server/trpc/root.ts`
- Test: `tests/unit/schemas/settings.schema.test.ts`, `tests/integration/settings.test.ts`

**Interfaces:**
- Consumes: `VN_BANKS` (Task 2).
- Produces:
  - Cột Prisma `User.bankBin`, `User.bankAccountNumber`, `User.bankAccountName` (`String?`).
  - `bankAccountSchema` (zod object `{ bankBin, bankAccountNumber, bankAccountName }`), `updateBankAccountSchema = bankAccountSchema.nullable()`, `type BankAccountInput = z.infer<typeof bankAccountSchema>`.
  - `getBankAccount(db: PrismaClient, userId: number): Promise<BankAccountInput | null>` (null khi thiếu bất kỳ cột nào).
  - `updateBankAccount(db: PrismaClient, userId: number, input: BankAccountInput | null): Promise<BankAccountInput | null>`.
  - tRPC `settings.getBankAccount()` (query), `settings.updateBankAccount(BankAccountInput | null)` (mutation).

- [ ] **Step 1: Sửa `prisma/schema.prisma`**

Trong `model User`, ngay dưới dòng `updatedAt ...`, thêm:

```prisma
  bankBin           String?           @map("bank_bin") @db.VarChar(8)
  bankAccountNumber String?           @map("bank_account_number") @db.VarChar(19)
  bankAccountName   String?           @map("bank_account_name") @db.VarChar(50)
```

- [ ] **Step 2: Sinh migration trên DB test (có chốt chặn host)**

```bash
(
  set -a; . ./.env.test; set +a
  for u in "$DATABASE_URL" "$DIRECT_URL"; do
    case "$u" in *ep-jolly-dew*) ;; *) echo "DỪNG: URL không phải DB test"; exit 1;; esac
  done
  pnpm exec prisma migrate dev --create-only --name add_user_bank_account
)
```
Expected: tạo thư mục `prisma/migrations/<timestamp>_add_user_bank_account/`.
- Nếu Prisma hỏi/đòi **reset** DB (drift) → trả lời không / Ctrl+C, DỪNG, báo người dùng. Không bao giờ đồng ý reset.
- Nếu lỗi tạo shadow database: sinh SQL không cần DB rồi tự tạo thư mục:
  ```bash
  git show HEAD:prisma/schema.prisma > .superpowers/old-schema.prisma
  ts=$(date -u +%Y%m%d%H%M%S); mkdir -p prisma/migrations/${ts}_add_user_bank_account
  pnpm exec prisma migrate diff --from-schema-datamodel .superpowers/old-schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/${ts}_add_user_bank_account/migration.sql
  rm .superpowers/old-schema.prisma
  ```

- [ ] **Step 3: Đọc lại SQL**

Run: `cat prisma/migrations/*_add_user_bank_account/migration.sql`
Expected: chỉ gồm (thứ tự cột có thể khác):
```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bank_account_name" VARCHAR(50),
ADD COLUMN     "bank_account_number" VARCHAR(19),
ADD COLUMN     "bank_bin" VARCHAR(8);
```
Có `DROP`, `DEFAULT`, `NOT NULL`, bảng khác → DỪNG, báo người dùng.

- [ ] **Step 4: Áp migration lên DB test + generate client**

```bash
(
  set -a; . ./.env.test; set +a
  for u in "$DATABASE_URL" "$DIRECT_URL"; do
    case "$u" in *ep-jolly-dew*) ;; *) echo "DỪNG: URL không phải DB test"; exit 1;; esac
  done
  pnpm exec prisma migrate deploy
)
pnpm exec prisma generate
```
Expected: `migrate deploy` báo áp 1 migration `..._add_user_bank_account`; generate thành công.

- [ ] **Step 5: Viết test fail**

`tests/unit/schemas/settings.schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { bankAccountSchema, updateBankAccountSchema } from "@/lib/schemas/settings"

const valid = {
  bankBin: "970436",
  bankAccountNumber: "0011001234567",
  bankAccountName: "NGUYEN VAN A",
}

describe("bankAccountSchema", () => {
  it("hợp lệ, giữ số 0 đầu, trim số TK và tên", () => {
    const r = bankAccountSchema.parse({
      ...valid,
      bankAccountNumber: " 0011001234567 ",
      bankAccountName: "  NGUYEN VAN A ",
    })
    expect(r).toEqual(valid)
  })

  it("BIN ngoài VN_BANKS → lỗi", () => {
    expect(bankAccountSchema.safeParse({ ...valid, bankBin: "999999" }).success).toBe(false)
  })

  it("số TK có dấu cách ở giữa, quá 19 ký tự, dưới 4 ký tự → lỗi", () => {
    for (const n of ["0011 001234", "1".repeat(20), "123"]) {
      expect(bankAccountSchema.safeParse({ ...valid, bankAccountNumber: n }).success).toBe(false)
    }
  })

  it("tên rỗng hoặc quá 50 ký tự → lỗi", () => {
    expect(bankAccountSchema.safeParse({ ...valid, bankAccountName: "   " }).success).toBe(false)
    expect(bankAccountSchema.safeParse({ ...valid, bankAccountName: "A".repeat(51) }).success).toBe(false)
  })

  it("updateBankAccountSchema nhận null (= xoá)", () => {
    expect(updateBankAccountSchema.parse(null)).toBeNull()
  })
})
```

`tests/integration/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"

const BANK = {
  bankBin: "970436",
  bankAccountNumber: "0011001234567",
  bankAccountName: "NGUYEN VAN A",
}

describe("settings.bankAccount", () => {
  beforeEach(async () => {
    await db.user.updateMany({
      data: { bankBin: null, bankAccountNumber: null, bankAccountName: null },
    })
  })

  it("✓ chưa cài → null", async () => {
    const caller = await getAuthedCaller()
    expect(await caller.settings.getBankAccount()).toBeNull()
  })

  it("✓ lưu rồi đọc lại đúng", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    expect(await caller.settings.getBankAccount()).toEqual(BANK)
  })

  it("✓ lưu null → xoá cả 3 cột", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    await caller.settings.updateBankAccount(null)
    expect(await caller.settings.getBankAccount()).toBeNull()
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect([u.bankBin, u.bankAccountNumber, u.bankAccountName]).toEqual([null, null, null])
  })

  it("✗ BIN ngoài danh sách → BAD_REQUEST", async () => {
    const caller = await getAuthedCaller()
    await expect(
      caller.settings.updateBankAccount({ ...BANK, bankBin: "999999" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("✓ thiếu 1 cột trong DB → coi như chưa cài", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    await db.user.update({ where: { username: "teacher" }, data: { bankAccountName: null } })
    expect(await caller.settings.getBankAccount()).toBeNull()
  })

  it("✓ user khác không thấy của nhau", async () => {
    const caller = await getAuthedCaller()
    const caller2 = await getAuthedCaller("teacher2")
    await caller.settings.updateBankAccount(BANK)
    expect(await caller2.settings.getBankAccount()).toBeNull()
  })
})
```

- [ ] **Step 6: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/schemas/settings.schema.test.ts tests/integration/settings.test.ts`
Expected: FAIL — không resolve `@/lib/schemas/settings`; `caller.settings` undefined.

- [ ] **Step 7: Viết `src/lib/schemas/settings.ts`**

```ts
import { z } from "zod"
import { VN_BANKS } from "@/lib/vn-banks"

export const bankAccountSchema = z.object({
  bankBin: z
    .string()
    .refine((bin) => VN_BANKS.some((b) => b.bin === bin), "Ngân hàng không hợp lệ"),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,19}$/, "Số tài khoản chỉ gồm 4 đến 19 chữ hoặc số, không dấu cách"),
  bankAccountName: z
    .string()
    .trim()
    .min(1, "Nhập tên chủ tài khoản")
    .max(50, "Tên chủ tài khoản tối đa 50 ký tự"),
})

// null = xoá thông tin ngân hàng
export const updateBankAccountSchema = bankAccountSchema.nullable()

export type BankAccountInput = z.infer<typeof bankAccountSchema>
```

- [ ] **Step 8: Viết `src/server/services/settings.service.ts`**

```ts
import type { PrismaClient } from "@prisma/client"
import type { BankAccountInput } from "@/lib/schemas/settings"

export async function getBankAccount(
  db: PrismaClient,
  userId: number
): Promise<BankAccountInput | null> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { bankBin: true, bankAccountNumber: true, bankAccountName: true },
  })
  // Thiếu 1 trường thì không tạo được QR → coi như chưa cài.
  if (!u.bankBin || !u.bankAccountNumber || !u.bankAccountName) return null
  return {
    bankBin: u.bankBin,
    bankAccountNumber: u.bankAccountNumber,
    bankAccountName: u.bankAccountName,
  }
}

export async function updateBankAccount(
  db: PrismaClient,
  userId: number,
  input: BankAccountInput | null
): Promise<BankAccountInput | null> {
  await db.user.update({
    where: { id: userId },
    data: {
      bankBin: input?.bankBin ?? null,
      bankAccountNumber: input?.bankAccountNumber ?? null,
      bankAccountName: input?.bankAccountName ?? null,
    },
  })
  return input
}
```

- [ ] **Step 9: Viết `src/server/trpc/routers/settings.ts` và đăng ký**

```ts
import { createTRPCRouter, protectedProcedure } from "@/server/trpc"
import { updateBankAccountSchema } from "@/lib/schemas/settings"
import { getBankAccount, updateBankAccount } from "@/server/services/settings.service"

export const settingsRouter = createTRPCRouter({
  getBankAccount: protectedProcedure.query(({ ctx }) => getBankAccount(ctx.db, ctx.userId)),

  updateBankAccount: protectedProcedure
    .input(updateBankAccountSchema)
    .mutation(({ ctx, input }) => updateBankAccount(ctx.db, ctx.userId, input)),
})
```

Trong `src/server/trpc/root.ts`: thêm `import { settingsRouter } from "@/server/trpc/routers/settings"` và dòng `settings: settingsRouter,` cuối object `createTRPCRouter({...})`.

- [ ] **Step 10: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/schemas/settings.schema.test.ts tests/integration/settings.test.ts`
Expected: PASS 11/11.

- [ ] **Step 11: Typecheck + lint + test multi-tenant/auth (đụng bảng `users`)**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/integration/auth.test.ts tests/integration/register.test.ts tests/integration/multi-tenant.test.ts`
Expected: không lỗi, pass.

- [ ] **Step 12: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/schemas/settings.ts src/server/services/settings.service.ts src/server/trpc/routers/settings.ts src/server/trpc/root.ts tests/unit/schemas/settings.schema.test.ts tests/integration/settings.test.ts
git commit -m "feat(settings): lưu tài khoản ngân hàng nhận học phí (3 cột nullable trên users)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 4: Service `getTuitionNotice` + `tuition.getNotice`

**Đọc trước:** spec C mục 4 (S4, S8), 7.3 (`tuitionNoticeSchema`), 7.4, 7.5, 10 (`tuition-notice.test.ts`), 12; `src/server/services/tuition.service.ts` (`getMonthlyTuitionStatus`, điều kiện `currentAttendance`); `src/server/services/payment.service.ts` của B (`listPayments`); `tests/integration/tuition-readonly-no-write.test.ts` (mẫu tạo HS/ca/điểm danh).

> Interface B dùng ở task này (`listPayments`, `PaymentDTO`, `payment.create`, `tuition.updateSettlement`): **đối chiếu interface thật trong code trước khi làm; lệch với plan thì theo code thật và ghi lại.**

**Files:**
- Modify: `src/lib/types/models.ts`, `src/lib/schemas/tuition.ts`, `src/server/trpc/routers/tuition.ts`
- Create: `src/server/services/tuition-notice.service.ts`
- Test: `tests/integration/tuition-notice.test.ts`

**Interfaces:**
- Consumes: `buildTransferContent`, `buildVietQrPayload`, `findBank` (Task 2); `getBankAccount`, `settings.updateBankAccount` (Task 3); `getMonthlyTuitionStatus(db, userId, filter, persist)`; B: `listPayments(db, userId, { studentId, year, month }): Promise<PaymentDTO[]>`, `PaymentDTO`, `payment.create`, `tuition.updateSettlement`.
- Produces:
  - `tuitionNoticeSchema` = `{ studentId: int > 0, year: int, month: 1–12 }`, `type TuitionNoticeInput`.
  - `interface TuitionNoticeDTO` trong `src/lib/types/models.ts` (đúng như Step 3).
  - `getTuitionNotice(db: PrismaClient, userId: number, input: TuitionNoticeInput): Promise<TuitionNoticeDTO>` — chỉ đọc; HS không thuộc user → `TRPCError NOT_FOUND`.
  - tRPC `tuition.getNotice({ studentId, year, month })` (query).

- [ ] **Step 1: Viết test fail**

`tests/integration/tuition-notice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { crc16Ccitt } from "@/lib/vietqr"

type Caller = Awaited<ReturnType<typeof getAuthedCaller>>
type Attendance = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS]

const BANK = {
  bankBin: "970436",
  bankAccountNumber: "0011001234567",
  bankAccountName: "NGUYEN VAN A",
}
const MAY = { year: 2026, month: 5 }

let nextHour = 7

async function cleanup() {
  // Payment trỏ tới MonthlyTuition → xoá trước.
  await db.payment.deleteMany()
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
  await db.user.updateMany({
    data: { bankBin: null, bankAccountNumber: null, bankAccountName: null },
  })
}

async function createStudent(caller: Caller, fullName = "Trần Thị Bé") {
  return caller.student.create({ fullName, grade: 5, tuitionFee: 100000 })
}

// Mỗi ca 1 khung giờ riêng để không vướng kiểm tra trùng giờ.
async function addSession(
  caller: Caller,
  studentId: number,
  date: string,
  attendance: Attendance,
  fee = 100000
) {
  const [subject] = await caller.subject.list({})
  const h = String(nextHour++).padStart(2, "0")
  const s = await caller.session.create({
    sessionDate: date,
    startTime: `${h}:00`,
    endTime: `${h}:45`,
    subjectId: subject.id,
  })
  await caller.session.addStudents({ sessionId: s.id, studentIds: [studentId] })
  await caller.attendance.update({
    sessionId: s.id,
    attendances: [{ studentId, attendance, fee }],
  })
  return s
}

async function pay(
  caller: Caller,
  studentId: number,
  month: number,
  amount: number,
  paidAt: string,
  method: "cash" | "transfer" = "cash"
) {
  await caller.payment.create({ studentId, year: 2026, month, amount, paidAt, method })
}

describe("tuition.getNotice", () => {
  beforeEach(async () => {
    await cleanup()
    nextHour = 7
  })

  it("✓ ngày có mặt: gồm có mặt + muộn, bỏ vắng và ca huỷ, sắp theo ngày; số khớp getMonthlyStatusReadOnly", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-11", ATTENDANCE_STATUS.LATE, 120000)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-08", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-06", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-13", ATTENDANCE_STATUS.ABSENT)
    const cancelled = await addSession(caller, st.id, "2026-05-15", ATTENDANCE_STATUS.PRESENT)
    await db.teachingSession.update({ where: { id: cancelled.id }, data: { status: "cancelled" } })

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.presentDates).toEqual([
      { date: "2026-05-04", fee: 100000 },
      { date: "2026-05-06", fee: 100000 },
      { date: "2026-05-08", fee: 100000 },
      { date: "2026-05-11", fee: 120000 },
    ])
    expect(n.presentDates.reduce((s, d) => s + d.fee, 0)).toBe(n.currentMonthFee)

    const {
      items: [status],
    } = await caller.tuition.getMonthlyStatusReadOnly({ ...MAY, studentId: st.id, limit: 1 })
    expect(n).toMatchObject({
      studentId: st.id,
      fullName: status.fullName,
      grade: status.grade,
      year: 2026,
      month: 5,
      presentSessions: status.presentSessions,
      currentMonthFee: status.totalExpected,
      previousBalance: status.previousBalance,
      totalAmountDue: status.totalAmountDue,
      paidAmount: status.paidAmount,
      isFullPaid: status.isFullPaid,
    })
    expect(n.presentSessions).toBe(4)
    expect(n.teacherName).toBe("Giáo viên Test")
  })

  it("✓ nợ tháng trước + 2 lần thu → previousBalance, payments, paidAmount, remaining", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-04-20", ATTENDANCE_STATUS.PRESENT)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 50000, "2026-05-10", "cash")
    await pay(caller, st.id, 5, 30000, "2026-05-20", "transfer")

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.previousBalance).toBe(100000)
    expect(n.totalAmountDue).toBe(200000)
    expect(n.paidAmount).toBe(80000)
    expect(n.remaining).toBe(120000)
    expect(n.overpaid).toBe(0)
    expect(n.payments.map((p) => [p.paidAt, p.method, p.amount]).sort()).toEqual([
      ["2026-05-10", "cash", 50000],
      ["2026-05-20", "transfer", 30000],
    ])
  })

  it("✓ chưa cài ngân hàng → không QR; cài rồi → QR đúng số còn lại + CRC", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)

    const before = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(before.remaining).toBe(100000)
    expect(before.bankConfigured).toBe(false)
    expect(before.qr).toBeNull()

    await caller.settings.updateBankAccount(BANK)
    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.bankConfigured).toBe(true)
    expect(n.qr).toMatchObject({
      bankShortName: "Vietcombank",
      accountNumber: BANK.bankAccountNumber,
      accountName: BANK.bankAccountName,
      amount: 100000,
      content: "HP T5 Tran Thi Be",
    })
    const payload = n.qr!.payload
    expect(payload).toContain("0006970436" + "0113" + BANK.bankAccountNumber)
    expect(payload).toContain("5406100000")
    expect(payload.slice(-4)).toBe(crc16Ccitt(payload.slice(0, -4)))
  })

  it("✓ trả đủ → remaining 0, không QR", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 100000, "2026-05-10")

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ remaining: 0, overpaid: 0, qr: null, bankConfigured: true })
  })

  it("✓ trả dư → overpaid đúng, không QR", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 150000, "2026-05-10")

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ remaining: 0, overpaid: 50000, qr: null })
  })

  it("✓ tất toán khi còn thiếu → remaining 0, không QR, không trả dư", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 5, 40000, "2026-05-10")
    await caller.tuition.updateSettlement({ studentId: st.id, ...MAY, isFullPaid: true, notes: null })

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ isFullPaid: true, remaining: 0, overpaid: 0, qr: null })
    expect(n.totalAmountDue).toBeGreaterThan(n.paidAmount)
  })

  it("✓ dư tháng trước lớn hơn học phí tháng (tổng âm) → remaining 0, overpaid 0, không QR", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-04-20", ATTENDANCE_STATUS.PRESENT)
    await pay(caller, st.id, 4, 250000, "2026-04-25")
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.previousBalance).toBe(-150000)
    expect(n.totalAmountDue).toBe(-50000)
    expect(n).toMatchObject({ remaining: 0, overpaid: 0, qr: null })
  })

  it("✓ tháng không có buổi nào nhưng còn nợ cũ → vẫn có phiếu, QR = nợ cũ", async () => {
    const caller = await getAuthedCaller()
    await caller.settings.updateBankAccount(BANK)
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-04-20", ATTENDANCE_STATUS.PRESENT)

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n.presentDates).toEqual([])
    expect(n.presentSessions).toBe(0)
    expect(n.remaining).toBe(100000)
    expect(n.qr?.amount).toBe(100000)
  })

  it("✓ BIN đã lưu không còn trong VN_BANKS → coi như chưa cài", async () => {
    const caller = await getAuthedCaller()
    await db.user.update({
      where: { username: "teacher" },
      data: { bankBin: "999999", bankAccountNumber: "123456", bankAccountName: "A" },
    })
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-05-04", ATTENDANCE_STATUS.PRESENT)

    const n = await caller.tuition.getNotice({ studentId: st.id, ...MAY })
    expect(n).toMatchObject({ bankConfigured: false, qr: null, remaining: 100000 })
  })

  it("✓ chỉ đọc: tháng chưa từng mở → không tạo MonthlyTuition", async () => {
    const caller = await getAuthedCaller()
    const st = await createStudent(caller)
    await addSession(caller, st.id, "2026-03-10", ATTENDANCE_STATUS.PRESENT)
    expect(await db.monthlyTuition.count({ where: { studentId: st.id } })).toBe(0)

    const n = await caller.tuition.getNotice({ studentId: st.id, year: 2026, month: 3 })
    expect(n.currentMonthFee).toBe(100000)
    expect(await db.monthlyTuition.count({ where: { studentId: st.id } })).toBe(0)
  })

  it("✗ HS của user khác → NOT_FOUND", async () => {
    const caller = await getAuthedCaller()
    const caller2 = await getAuthedCaller("teacher2")
    const st = await createStudent(caller)
    await expect(
      caller2.tuition.getNotice({ studentId: st.id, ...MAY })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm test tests/integration/tuition-notice.test.ts`
Expected: FAIL — `caller.tuition.getNotice is not a function` (hoặc lỗi type ở `getNotice`).

- [ ] **Step 3: Thêm DTO + schema**

Cuối `src/lib/types/models.ts` (dùng `PaymentDTO` do B định nghĩa trong cùng file):

```ts
/**
 * Phiếu báo học phí 1 HS/tháng (spec C §7.4). G dùng lại y nguyên.
 */
export interface TuitionNoticeDTO {
  studentId: number
  fullName: string
  grade: number
  year: number
  month: number
  presentSessions: number
  currentMonthFee: number
  previousBalance: number
  totalAmountDue: number
  paidAmount: number
  isFullPaid: boolean
  presentDates: { date: string; fee: number }[]
  payments: PaymentDTO[]
  remaining: number
  overpaid: number
  teacherName: string
  bankConfigured: boolean
  qr: {
    payload: string
    bankShortName: string
    accountNumber: string
    accountName: string
    amount: number
    content: string
  } | null
}
```

Cuối `src/lib/schemas/tuition.ts`:

```ts
export const tuitionNoticeSchema = z.object({
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

export type TuitionNoticeInput = z.infer<typeof tuitionNoticeSchema>
```

- [ ] **Step 4: Viết `src/server/services/tuition-notice.service.ts`**

```ts
import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { buildTransferContent, buildVietQrPayload } from "@/lib/vietqr"
import { findBank } from "@/lib/vn-banks"
import type { TuitionNoticeInput } from "@/lib/schemas/tuition"
import type { TuitionNoticeDTO } from "@/lib/types/models"
import { getMonthlyTuitionStatus } from "./tuition.service"
import { listPayments } from "./payment.service"
import { getBankAccount } from "./settings.service"

// Chỉ đọc: persist=false, không ghi MonthlyTuition/Payment.
export async function getTuitionNotice(
  db: PrismaClient,
  userId: number,
  { studentId, year, month }: TuitionNoticeInput
): Promise<TuitionNoticeDTO> {
  const { items } = await getMonthlyTuitionStatus(
    db,
    userId,
    { studentId, year, month, status: "all", page: 1, limit: 1 },
    false
  )
  const status = items[0]
  // Đã lọc theo userId → HS của user khác cũng rơi vào đây.
  if (!status) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy học sinh" })

  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 1))

  const [attended, payments, bank, user] = await Promise.all([
    // Cùng điều kiện với currentAttendance trong getMonthlyTuitionStatus để tổng fee khớp.
    db.sessionStudent.findMany({
      where: {
        studentId,
        attendance: { in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] },
        session: { userId, sessionDate: { gte: startDate, lt: endDate }, status: { not: "cancelled" } },
      },
      select: { fee: true, session: { select: { sessionDate: true } } },
      orderBy: [{ session: { sessionDate: "asc" } }, { session: { startTime: "asc" } }],
    }),
    listPayments(db, userId, { studentId, year, month }),
    getBankAccount(db, userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true, username: true } }),
  ])

  const { totalAmountDue, paidAmount, isFullPaid } = status
  // Khớp sheet chi tiết của B và getMonthlyOutstanding (spec C S8).
  const remaining = isFullPaid ? 0 : Math.max(0, totalAmountDue - paidAmount)
  const surplus = paidAmount - Math.max(0, totalAmountDue)
  const overpaid = !isFullPaid && surplus > 0 ? surplus : 0

  const bankInfo = bank ? findBank(bank.bankBin) : undefined
  const content = buildTransferContent(status.fullName, month)
  const qr =
    bank && bankInfo && remaining > 0
      ? {
          payload: buildVietQrPayload({
            bin: bankInfo.bin,
            accountNumber: bank.bankAccountNumber,
            amount: remaining,
            content,
          }),
          bankShortName: bankInfo.shortName,
          accountNumber: bank.bankAccountNumber,
          accountName: bank.bankAccountName,
          amount: remaining,
          content,
        }
      : null

  return {
    studentId: status.studentId,
    fullName: status.fullName,
    grade: status.grade,
    year,
    month,
    presentSessions: status.presentSessions,
    currentMonthFee: status.totalExpected,
    previousBalance: status.previousBalance,
    totalAmountDue,
    paidAmount,
    isFullPaid,
    presentDates: attended.map((a) => ({
      date: a.session.sessionDate.toISOString().slice(0, 10),
      fee: a.fee,
    })),
    payments,
    remaining,
    overpaid,
    teacherName: user.fullName ?? user.username,
    // BIN không còn trong VN_BANKS → coi như chưa cài để không tạo QR sai ngân hàng.
    bankConfigured: Boolean(bankInfo),
    qr,
  }
}
```

- [ ] **Step 5: Thêm query vào router**

Trong `src/server/trpc/routers/tuition.ts` (bản sau B): thêm `tuitionNoticeSchema` vào import từ `@/lib/schemas/tuition`, thêm `import { getTuitionNotice } from "@/server/services/tuition-notice.service"`, và thêm vào object router:

```ts
  // Phiếu báo: chỉ đọc, không ghi snapshot.
  getNotice: protectedProcedure
    .input(tuitionNoticeSchema)
    .query(({ ctx, input }) => getTuitionNotice(ctx.db, ctx.userId, input)),
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `pnpm test tests/integration/tuition-notice.test.ts`
Expected: PASS 11/11. Nếu test dùng `payment.create`/`updateSettlement` lỗi do chữ ký B khác plan → sửa test theo code thật (không sửa code B), ghi lại.

- [ ] **Step 7: Typecheck + lint + test học phí liên quan**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/integration/tuition.test.ts tests/integration/tuition-readonly-no-write.test.ts`
Expected: không lỗi, pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/models.ts src/lib/schemas/tuition.ts src/server/services/tuition-notice.service.ts src/server/trpc/routers/tuition.ts tests/integration/tuition-notice.test.ts
git commit -m "feat(tuition): tuition.getNotice trả dữ liệu phiếu báo + payload VietQR (chỉ đọc)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 5: i18n + trang `/settings` + mục menu avatar

**Đọc trước:** spec C mục 6.4, 9; `src/components/subjects/SubjectList.tsx` (mẫu trang A2: loading/lỗi/`PageHeader`); `src/components/layout/AppHeader.tsx`.

**Files:**
- Modify: `src/language/vi.json`, `src/language/en.json`
- Create: `src/components/settings/BankAccountCard.tsx`, `src/app/(app)/settings/page.tsx`
- Modify: `src/components/layout/AppHeader.tsx`

**Interfaces:**
- Consumes: `settings.getBankAccount`, `settings.updateBankAccount`, `bankAccountSchema`, `BankAccountInput` (Task 3); `VN_BANKS` (Task 2).
- Produces:
  - 28 key i18n: `tuition_notice`, `tuition_notice_title`, `notice_present_sessions`, `notice_fee_per_session`, `notice_dates`, `notice_month_fee`, `notice_prev_debt`, `notice_prev_credit`, `notice_remaining`, `notice_paid_in_full`, `notice_settled`, `notice_overpaid`, `notice_transfer_content`, `notice_teacher`, `notice_issued`, `notice_no_bank`, `open_settings`, `share`, `download_image`, `settings`, `bank_account_section`, `bank_account_desc`, `bank`, `account_number`, `account_name`, `bank_saved`, `clear_bank`, `clear_bank_confirm`.
  - Route `/settings`; label/ô: `Ngân hàng` (`#bank-bin`), `Số tài khoản` (`#bank-account-number`), `Tên chủ tài khoản` (`#bank-account-name`); nút `Lưu`, `Xoá thông tin` (e2e Task 8 dùng).
  - Mục menu avatar "Cài đặt" (`menuitem`).

- [ ] **Step 1: Thêm key (script ném lỗi nếu key đã tồn tại, giữ kiểu xuống dòng của file)**

```bash
node - <<'EOF'
const fs = require('fs')
const add = {
  vi: {
    tuition_notice: "Phiếu báo",
    tuition_notice_title: "PHIẾU BÁO HỌC PHÍ THÁNG",
    notice_present_sessions: "Số buổi có mặt",
    notice_fee_per_session: "Học phí/buổi",
    notice_dates: "Ngày học",
    notice_month_fee: "Học phí tháng",
    notice_prev_debt: "Nợ tháng trước",
    notice_prev_credit: "Dư tháng trước",
    notice_remaining: "Còn phải trả",
    notice_paid_in_full: "Đã thanh toán đủ",
    notice_settled: "Đã tất toán",
    notice_overpaid: "Trả dư {amount}, sẽ trừ vào tháng sau",
    notice_transfer_content: "Nội dung",
    notice_teacher: "Giáo viên",
    notice_issued: "Ngày lập",
    notice_no_bank: "Chưa cài tài khoản ngân hàng nên phiếu chưa có mã QR.",
    open_settings: "Mở Cài đặt",
    share: "Chia sẻ",
    download_image: "Tải ảnh",
    settings: "Cài đặt",
    bank_account_section: "Tài khoản nhận học phí",
    bank_account_desc: "Dùng để tạo mã QR trên phiếu báo học phí",
    bank: "Ngân hàng",
    account_number: "Số tài khoản",
    account_name: "Tên chủ tài khoản",
    bank_saved: "Đã lưu tài khoản ngân hàng",
    clear_bank: "Xoá thông tin",
    clear_bank_confirm: "Xoá thông tin tài khoản? Phiếu báo sẽ không còn mã QR.",
  },
  en: {
    tuition_notice: "Tuition notice",
    tuition_notice_title: "TUITION NOTICE FOR",
    notice_present_sessions: "Sessions attended",
    notice_fee_per_session: "Fee per session",
    notice_dates: "Dates",
    notice_month_fee: "Month fee",
    notice_prev_debt: "Previous balance due",
    notice_prev_credit: "Previous credit",
    notice_remaining: "Amount due",
    notice_paid_in_full: "Paid in full",
    notice_settled: "Settled",
    notice_overpaid: "Overpaid {amount}, carried to next month",
    notice_transfer_content: "Transfer note",
    notice_teacher: "Teacher",
    notice_issued: "Issued",
    notice_no_bank: "No bank account set, so the notice has no QR code.",
    open_settings: "Open settings",
    share: "Share",
    download_image: "Download image",
    settings: "Settings",
    bank_account_section: "Tuition bank account",
    bank_account_desc: "Used for the QR code on tuition notices",
    bank: "Bank",
    account_number: "Account number",
    account_name: "Account holder",
    bank_saved: "Bank account saved",
    clear_bank: "Clear",
    clear_bank_confirm: "Clear bank details? Notices will no longer have a QR code.",
  },
}
for (const l of ['vi', 'en']) {
  const p = `src/language/${l}.json`
  const raw = fs.readFileSync(p, 'utf8')
  const o = JSON.parse(raw)
  for (const [k, v] of Object.entries(add[l])) {
    if (k in o) throw new Error('dup ' + k)
    o[k] = v
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  fs.writeFileSync(p, JSON.stringify(o, null, 2).replace(/\n/g, eol) + (raw.endsWith('\n') ? eol : ''))
}
EOF
```
Nếu script ném `dup <key>` (B hoặc phần khác đã thêm key cùng tên): mở file xem nghĩa key đó; nghĩa trùng thì bỏ key khỏi script và dùng lại, khác nghĩa thì đổi tên key mới (vd thêm tiền tố `notice_`) và sửa mọi chỗ dùng trong Task 5, 7; ghi lại.

- [ ] **Step 2: Kiểm tra parity**

```bash
node -e "const vi=require('./src/language/vi.json'),en=require('./src/language/en.json');const a=Object.keys(vi),b=Object.keys(en);const d=[...a.filter(k=>!(k in en)),...b.filter(k=>!(k in vi))];console.log(a.length,b.length,d.length?'LỆCH: '+d:'OK')"
```
Expected: 2 số bằng nhau (= số trước khi chạy + 28) và `OK`.

- [ ] **Step 3: `BankAccountCard`**

`src/components/settings/BankAccountCard.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { trpc } from "@/lib/trpc"
import { VN_BANKS } from "@/lib/vn-banks"
import { bankAccountSchema, type BankAccountInput } from "@/lib/schemas/settings"
import { useTranslation } from "@/components/providers/LanguageProvider"

const BANK_OPTIONS = [...VN_BANKS].sort((a, b) => a.shortName.localeCompare(b.shortName))

export function BankAccountCard() {
  const { t } = useTranslation()
  const query = trpc.settings.getBankAccount.useQuery()

  if (query.isPending) return <Skeleton className="h-80 w-full max-w-xl rounded-lg" />
  if (query.isError) {
    return (
      <div className="max-w-xl rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
        <p className="text-sm text-slate-600">{t("load_error")}</p>
        <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
          {t("retry")}
        </Button>
      </div>
    )
  }
  // Đổi key khi lưu/xoá → form mount lại với giá trị mới từ server, không cần effect đồng bộ.
  return <BankAccountForm key={query.data ? "set" : "empty"} initial={query.data} />
}

function BankAccountForm({ initial }: { initial: BankAccountInput | null }) {
  const { t } = useTranslation()
  const [bankBin, setBankBin] = useState(initial?.bankBin ?? "")
  const [accountNumber, setAccountNumber] = useState(initial?.bankAccountNumber ?? "")
  const [accountName, setAccountName] = useState(initial?.bankAccountName ?? "")
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // Callback đặt ở hook (không ở mutate) vì form có thể mount lại trước khi mutate-callback chạy.
  const mutation = trpc.settings.updateBankAccount.useMutation({
    onSuccess: (_data, input) => {
      if (input) toast.success(t("bank_saved"))
    },
    onError: (e) => setError(e.message),
  })

  const save = () => {
    setError(null)
    const parsed = bankAccountSchema.safeParse({
      bankBin,
      bankAccountNumber: accountNumber,
      bankAccountName: accountName,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    mutation.mutate(parsed.data)
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">{t("bank_account_section")}</CardTitle>
        <CardDescription>{t("bank_account_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="bank-bin">{t("bank")}</Label>
          <Select value={bankBin} onValueChange={setBankBin}>
            <SelectTrigger id="bank-bin" className="h-11 md:h-10">
              <SelectValue placeholder={t("bank")} />
            </SelectTrigger>
            <SelectContent>
              {BANK_OPTIONS.map((b) => (
                <SelectItem key={b.bin} value={b.bin}>
                  {b.shortName} - {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-account-number">{t("account_number")}</Label>
          <Input
            id="bank-account-number"
            inputMode="numeric"
            autoComplete="off"
            maxLength={25}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="h-11 md:h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-account-name">{t("account_name")}</Label>
          <Input
            id="bank-account-name"
            autoComplete="off"
            maxLength={60}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            onBlur={() => setAccountName((v) => v.trim().toUpperCase())}
            className="h-11 md:h-10"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {initial && (
            <Button
              variant="outline"
              className="h-11 w-full text-red-600 sm:w-auto md:h-10"
              onClick={() => setConfirmClear(true)}
              disabled={mutation.isPending}
            >
              {t("clear_bank")}
            </Button>
          )}
          <Button
            onClick={save}
            disabled={mutation.isPending}
            className="h-11 w-full sm:ml-auto sm:w-auto md:h-10"
          >
            {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clear_bank")}</AlertDialogTitle>
            <AlertDialogDescription>{t("clear_bank_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClear(false)
                mutation.mutate(null)
              }}
            >
              {t("clear_bank")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
```

- [ ] **Step 4: Route**

`src/app/(app)/settings/page.tsx`:

```tsx
"use client"

import { PageHeader } from "@/components/common/PageHeader"
import { BankAccountCard } from "@/components/settings/BankAccountCard"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("settings")} />
      <BankAccountCard />
    </div>
  )
}
```

- [ ] **Step 5: Mục "Cài đặt" trong menu avatar**

Trong `src/components/layout/AppHeader.tsx`:
- Import lucide thêm `Settings`: `import { BookOpen, KeyRound, LogOut, Languages, Settings } from "lucide-react"`.
- Ngay sau khối `<DropdownMenuItem asChild><Link href="/subjects">…</Link></DropdownMenuItem>`, thêm:

```tsx
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4 mr-2" />
                {t("settings")}
              </Link>
            </DropdownMenuItem>
```

- [ ] **Step 6: Typecheck + lint + unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit`
Expected: không lỗi, unit pass.

- [ ] **Step 7: Commit**

```bash
git add src/language/vi.json src/language/en.json src/components/settings "src/app/(app)/settings/page.tsx" src/components/layout/AppHeader.tsx
git commit -m "feat(settings): trang Cài đặt tài khoản nhận học phí, vào từ menu avatar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 6: `qrcode` + helper chia sẻ ảnh + logic hiển thị phiếu

**Đọc trước:** spec C mục 4 (S5, S9, S11), 6.3 (khối 5), 7.6; `src/hooks/useExport.ts` (cách dùng `html2canvas`); `vitest.config.ts` (mặc định env `node`, file cần DOM thêm `// @vitest-environment jsdom`).

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/lib/share-image.ts`, `src/lib/tuition-notice.ts`
- Test: `tests/unit/lib/share-image.test.ts`, `tests/unit/lib/tuition-notice.test.ts`

**Interfaces:**
- Consumes: `TuitionNoticeDTO` (Task 4).
- Produces:
  - Dependency `qrcode` (+ dev `@types/qrcode`); dùng `import { toDataURL } from "qrcode"`.
  - `elementToPngBlob(el: HTMLElement): Promise<Blob>`, `canShareFiles(): boolean`, `shareOrDownloadPng(blob: Blob, filename: string, title: string): Promise<void>`.
  - `noticeFeePerSession(dates: { fee: number }[]): number | null` (null khi rỗng hoặc phí khác nhau), `type NoticePaymentState = "qr" | "none" | "settled" | "paid"`, `noticePaymentState(n: Pick<TuitionNoticeDTO, "remaining" | "qr" | "isFullPaid" | "totalAmountDue" | "paidAmount">): NoticePaymentState`.

- [ ] **Step 1: Cài `qrcode`**

```bash
pnpm add qrcode
pnpm add -D @types/qrcode
```
Expected: `package.json` có `"qrcode"` trong `dependencies`, `"@types/qrcode"` trong `devDependencies`. (`postinstall` chạy `prisma generate`, không đụng DB.)

- [ ] **Step 2: Viết test fail**

`tests/unit/lib/tuition-notice.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { noticeFeePerSession, noticePaymentState } from "@/lib/tuition-notice"

const qr = {
  payload: "x",
  bankShortName: "Vietcombank",
  accountNumber: "1",
  accountName: "A",
  amount: 1,
  content: "HP",
}
const base = { remaining: 0, qr: null, isFullPaid: false, totalAmountDue: 100000, paidAmount: 100000 }

describe("noticeFeePerSession", () => {
  it("không có buổi → null", () => {
    expect(noticeFeePerSession([])).toBeNull()
  })
  it("mọi buổi cùng phí → phí đó", () => {
    expect(noticeFeePerSession([{ fee: 100000 }, { fee: 100000 }])).toBe(100000)
  })
  it("phí khác nhau → null (ghi phí từng ngày)", () => {
    expect(noticeFeePerSession([{ fee: 100000 }, { fee: 120000 }])).toBeNull()
  })
})

describe("noticePaymentState", () => {
  it("còn nợ + có QR → qr", () => {
    expect(noticePaymentState({ ...base, remaining: 50000, qr, paidAmount: 50000 })).toBe("qr")
  })
  it("còn nợ, chưa cài ngân hàng → none", () => {
    expect(noticePaymentState({ ...base, remaining: 50000, paidAmount: 50000 })).toBe("none")
  })
  it("tất toán khi còn thiếu → settled", () => {
    expect(noticePaymentState({ ...base, isFullPaid: true, paidAmount: 40000 })).toBe("settled")
  })
  it("trả đủ hoặc dư (kể cả đã tick tất toán) → paid", () => {
    expect(noticePaymentState(base)).toBe("paid")
    expect(noticePaymentState({ ...base, paidAmount: 150000 })).toBe("paid")
    expect(noticePaymentState({ ...base, isFullPaid: true })).toBe("paid")
  })
  it("tổng âm (dư tháng trước lớn) → paid", () => {
    expect(noticePaymentState({ ...base, totalAmountDue: -50000, paidAmount: 0 })).toBe("paid")
  })
})
```

`tests/unit/lib/share-image.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("file-saver", () => ({ saveAs: vi.fn() }))

import { saveAs } from "file-saver"
import { canShareFiles, shareOrDownloadPng } from "@/lib/share-image"

function setShareSupport(share?: (data: ShareData) => Promise<void>, canShare?: () => boolean) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true })
  Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true })
}

const blob = new Blob(["png"], { type: "image/png" })

afterEach(() => {
  delete (navigator as { share?: unknown }).share
  delete (navigator as { canShare?: unknown }).canShare
  vi.mocked(saveAs).mockClear()
})

describe("canShareFiles", () => {
  it("trình duyệt không có canShare → false", () => {
    expect(canShareFiles()).toBe(false)
  })
  it("canShare nhận file → true", () => {
    setShareSupport(vi.fn(), () => true)
    expect(canShareFiles()).toBe(true)
  })
})

describe("shareOrDownloadPng", () => {
  it("chia sẻ được → gọi navigator.share với file PNG, không tải", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShareSupport(share, () => true)
    await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    const data = share.mock.calls[0][0] as ShareData
    expect(data.title).toBe("Phiếu")
    expect(data.files?.[0].name).toBe("phieu.png")
    expect(data.files?.[0].type).toBe("image/png")
    expect(saveAs).not.toHaveBeenCalled()
  })

  it("người dùng huỷ (AbortError) → im lặng, không tải", async () => {
    setShareSupport(vi.fn().mockRejectedValue(new DOMException("x", "AbortError")), () => true)
    await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    expect(saveAs).not.toHaveBeenCalled()
  })

  it("NotAllowedError (iOS mất user activation) → tải file", async () => {
    setShareSupport(vi.fn().mockRejectedValue(new DOMException("x", "NotAllowedError")), () => true)
    await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    expect(saveAs).toHaveBeenCalledWith(blob, "phieu.png")
  })

  it("không hỗ trợ chia sẻ file → tải file", async () => {
    await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    expect(saveAs).toHaveBeenCalledWith(blob, "phieu.png")
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm test tests/unit/lib/tuition-notice.test.ts tests/unit/lib/share-image.test.ts`
Expected: FAIL — không resolve `@/lib/tuition-notice`, `@/lib/share-image`.

- [ ] **Step 4: Viết `src/lib/tuition-notice.ts`**

```ts
import type { TuitionNoticeDTO } from "@/lib/types/models"

// Phí lưu theo từng buổi, có thể khác nhau → chỉ in 1 con số khi mọi buổi cùng phí (spec C S9).
export function noticeFeePerSession(dates: { fee: number }[]): number | null {
  if (dates.length === 0) return null
  const fee = dates[0].fee
  return dates.every((d) => d.fee === fee) ? fee : null
}

export type NoticePaymentState = "qr" | "none" | "settled" | "paid"

// Khối thanh toán cuối phiếu (spec C §6.3 mục 5). "none" = còn nợ nhưng chưa cài ngân hàng.
export function noticePaymentState(
  n: Pick<TuitionNoticeDTO, "remaining" | "qr" | "isFullPaid" | "totalAmountDue" | "paidAmount">
): NoticePaymentState {
  if (n.remaining > 0) return n.qr ? "qr" : "none"
  if (n.isFullPaid && n.totalAmountDue > n.paidAmount) return "settled"
  return "paid"
}
```

- [ ] **Step 5: Viết `src/lib/share-image.ts`**

```ts
import html2canvas from "html2canvas"
import { saveAs } from "file-saver"

// Sheet/Dialog trượt vào 300–500ms; chụp giữa chừng thì ảnh lệch. Bỏ qua animation vô hạn (spinner).
async function waitForFiniteAnimations(): Promise<void> {
  const running = document.getAnimations?.() ?? []
  const finite = running.filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
  await Promise.all(finite.map((a) => a.finished.catch(() => undefined)))
}

export async function elementToPngBlob(el: HTMLElement): Promise<Blob> {
  await waitForFiniteAnimations()
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    // Bản clone nằm trong iframe mới: animation sẽ chạy lại từ đầu nếu không tắt.
    onclone: (doc) => {
      const style = doc.createElement("style")
      style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}"
      doc.head.appendChild(style)
    },
  })
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Không tạo được ảnh"))), "image/png")
  })
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false
  return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] }) === true
}

export async function shareOrDownloadPng(blob: Blob, filename: string, title: string): Promise<void> {
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [new File([blob], filename, { type: "image/png" })], title })
      return
    } catch (e) {
      // Người dùng tự đóng bảng chia sẻ → không làm gì. Lỗi khác (NotAllowedError...) → tải file.
      if ((e as { name?: string })?.name === "AbortError") return
    }
  }
  saveAs(blob, filename)
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `pnpm test tests/unit/lib/tuition-notice.test.ts tests/unit/lib/share-image.test.ts`
Expected: PASS 14/14.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: không lỗi.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/share-image.ts src/lib/tuition-notice.ts tests/unit/lib/share-image.test.ts tests/unit/lib/tuition-notice.test.ts
git commit -m "feat(tuition): thêm qrcode, helper chụp/chia sẻ ảnh PNG và logic hiển thị phiếu báo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 7: `TuitionNoticeCard` + `TuitionNoticeDialog` + 3 lối vào "Phiếu báo"

**Đọc trước:** spec C mục 6.1, 6.2, 6.3, 11; `src/app/(app)/tuition/page.tsx`; `src/components/tuition/TuitionDetailSheet.tsx` **bản B** (khung Dialog desktop / Sheet mobile, footer có nút Lưu); `src/components/subjects/SubjectList.tsx` (mẫu mount-khi-mở).

> `TuitionDetailSheet` đã được B viết lại: **đối chiếu code thật trước khi sửa; lệch với plan (tên prop, vị trí footer) thì theo code thật và ghi lại.**

**Files:**
- Create: `src/components/tuition/TuitionNoticeCard.tsx`, `src/components/tuition/TuitionNoticeDialog.tsx`
- Modify: `src/app/(app)/tuition/page.tsx`, `src/components/tuition/TuitionDetailSheet.tsx`

**Interfaces:**
- Consumes: `tuition.getNotice`, `TuitionNoticeDTO` (Task 4); key i18n (Task 5) + key B (`paid_total`, `method_cash`, `method_transfer`, `payment_amount`); `elementToPngBlob`, `canShareFiles`, `shareOrDownloadPng`, `noticeFeePerSession`, `noticePaymentState`, `toDataURL` từ `qrcode` (Task 6); `formatCurrency`, `formatDate`, `removeVietnameseTones` (`src/lib/utils.ts`); `formatVnDate` (`src/lib/payment-notes.ts`).
- Produces:
  - `TuitionNoticeCard` — `forwardRef<HTMLDivElement, { notice: TuitionNoticeDTO; onReady?: () => void }>`, `data-testid="notice-card"`, không gọi tRPC (G dùng lại).
  - `TuitionNoticeDialog({ studentId, year, month, onClose }: { studentId: number; year: number; month: number; onClose: () => void })` — mount khi mở; `data-testid="tuition-notice"` trên khung nội dung.
  - Nút icon `aria-label="Phiếu báo"` trên thẻ mobile (`size-11`) và bảng desktop (`size-9`); nút chữ "Phiếu báo" ở footer sheet chi tiết (e2e Task 8 dùng).

- [ ] **Step 1: `TuitionNoticeCard`**

`src/components/tuition/TuitionNoticeCard.tsx`:

```tsx
"use client"

import { forwardRef, useEffect, useState } from "react"
import { toDataURL } from "qrcode"
import type { TuitionNoticeDTO } from "@/lib/types/models"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { formatVnDate } from "@/lib/payment-notes"
import { noticeFeePerSession, noticePaymentState } from "@/lib/tuition-notice"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = { notice: TuitionNoticeDTO; onReady?: () => void }

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Thuần hiển thị, G render lại ở trang phụ huynh. Chỉ block/grid, không rounded-full/inline-flex/shadow:
// html2canvas vẽ sai các thứ đó (xem useExport.ts).
export const TuitionNoticeCard = forwardRef<HTMLDivElement, Props>(function TuitionNoticeCard(
  { notice, onReady },
  ref
) {
  const { t } = useTranslation()
  const state = noticePaymentState(notice)
  const payload = state === "qr" && notice.qr ? notice.qr.payload : null
  const [qrSrc, setQrSrc] = useState<string | null>(null)

  useEffect(() => {
    // Không có QR thì sẵn sàng ngay; có QR thì chờ <img> tải xong (onLoad).
    if (!payload) {
      onReady?.()
      return
    }
    let cancelled = false
    toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 })
      .then((url) => {
        if (!cancelled) setQrSrc(url)
      })
      .catch((e) => console.error("Không tạo được mã QR:", e))
    return () => {
      cancelled = true
    }
  }, [payload, onReady])

  const fee = noticeFeePerSession(notice.presentDates)
  const dates = notice.presentDates
    .map((d) => (fee === null ? `${ddmm(d.date)} (${formatCurrency(d.fee)})` : ddmm(d.date)))
    .join(", ")

  const row = (label: string, value: string, className?: string) => (
    <div className={cn("grid grid-cols-[1fr_auto] gap-3", className)}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )

  return (
    <div
      ref={ref}
      data-testid="notice-card"
      style={{ width: 360 }}
      className="space-y-4 border border-slate-200 bg-white p-5 text-sm text-slate-900"
    >
      <h2 className="text-center text-base font-bold">
        {t("tuition_notice_title")} {notice.month}/{notice.year}
      </h2>

      <div className="space-y-1">
        <p>
          <span className="text-slate-500">{t("student")}: </span>
          <span className="font-semibold">{notice.fullName}</span>
        </p>
        <p>
          <span className="text-slate-500">{t("grade")}: </span>
          {notice.grade}
        </p>
      </div>

      <div className="space-y-1">
        {row(t("notice_present_sessions"), String(notice.presentSessions))}
        {fee !== null && row(t("notice_fee_per_session"), formatCurrency(fee))}
        {dates && (
          <p>
            <span className="text-slate-500">{t("notice_dates")}: </span>
            {dates}
          </p>
        )}
      </div>

      <div className="space-y-1 border-t border-slate-200 pt-3">
        {row(t("notice_month_fee"), formatCurrency(notice.currentMonthFee))}
        {notice.previousBalance > 0 && row(t("notice_prev_debt"), formatCurrency(notice.previousBalance))}
        {notice.previousBalance < 0 && row(t("notice_prev_credit"), formatCurrency(notice.previousBalance))}
        {row(t("total_amount_due"), formatCurrency(notice.totalAmountDue), "font-semibold")}
        {row(t("paid_total"), formatCurrency(notice.paidAmount))}
        {notice.payments.map((p) => (
          <p key={p.id} className="pl-3 text-xs text-slate-500">
            {formatDate(p.paidAt)} · {t(p.method === "cash" ? "method_cash" : "method_transfer")} ·{" "}
            {formatCurrency(p.amount)}
          </p>
        ))}
        {row(
          t("notice_remaining"),
          formatCurrency(notice.remaining),
          "border-t border-slate-200 pt-2 text-lg font-bold"
        )}
      </div>

      {state === "qr" && notice.qr && (
        <div className="space-y-1 border-t border-slate-200 pt-3 text-center">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL; html2canvas cần <img> thường
            <img
              src={qrSrc}
              alt="VietQR"
              width={200}
              height={200}
              className="mx-auto block"
              onLoad={onReady}
            />
          ) : (
            <div className="mx-auto bg-slate-100" style={{ width: 200, height: 200 }} />
          )}
          <p className="pt-2 font-semibold">{notice.qr.bankShortName}</p>
          <p>
            {t("account_number")}: {notice.qr.accountNumber}
          </p>
          <p>
            {t("account_name")}: {notice.qr.accountName}
          </p>
          <p>
            {t("payment_amount")}: {formatCurrency(notice.qr.amount)}
          </p>
          <p>
            {t("notice_transfer_content")}: {notice.qr.content}
          </p>
        </div>
      )}

      {state === "settled" && (
        <p className="border-t border-slate-200 pt-3 text-center font-semibold">{t("notice_settled")}</p>
      )}

      {state === "paid" && (
        <div className="border-t border-slate-200 pt-3 text-center">
          <p className="font-semibold">{t("notice_paid_in_full")}</p>
          {notice.overpaid > 0 && (
            <p className="text-slate-600">
              {t("notice_overpaid").replace("{amount}", formatCurrency(notice.overpaid))}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        <p>
          {t("notice_teacher")}: {notice.teacherName}
        </p>
        <p>
          {t("notice_issued")}: {formatVnDate(new Date())}
        </p>
      </div>
    </div>
  )
})
```

Nếu `eslint` báo rule `@next/next/no-img-element` không tồn tại trong config → bỏ dòng `eslint-disable`.

- [ ] **Step 2: `TuitionNoticeDialog`**

`src/components/tuition/TuitionNoticeDialog.tsx`:

```tsx
"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { saveAs } from "file-saver"
import { Download, Loader2, Share2 } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { removeVietnameseTones } from "@/lib/utils"
import { canShareFiles, elementToPngBlob, shareOrDownloadPng } from "@/lib/share-image"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TuitionNoticeCard } from "./TuitionNoticeCard"

type Props = { studentId: number; year: number; month: number; onClose: () => void }

// Chỉ mount khi mở → Blob và trạng thái tự reset mỗi lần mở.
export function TuitionNoticeDialog({ studentId, year, month, onClose }: Props) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const query = trpc.tuition.getNotice.useQuery({ studentId, year, month })
  const cardRef = useRef<HTMLDivElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [captureFailed, setCaptureFailed] = useState(false)
  const [shareable] = useState(canShareFiles)

  // Tạo sẵn ảnh ngay khi phiếu vẽ xong: Safari chặn navigator.share nếu gọi sau tác vụ bất đồng bộ (spec C S11).
  // Không phụ thuộc `t` (tạo mới mỗi render) để card không gọi lại onReady liên tục.
  const handleReady = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    setBlob(null)
    setCaptureFailed(false)
    elementToPngBlob(el)
      .then((b) => {
        // Card có thể đã mount lại (đổi Sheet ↔ Dialog) → bỏ kết quả của bản cũ.
        if (cardRef.current === el) setBlob(b)
      })
      .catch(() => {
        if (cardRef.current === el) setCaptureFailed(true)
      })
  }, [])

  const notice = query.data
  const title = `${t("tuition_notice_title")} ${month}/${year}`
  const filename = notice
    ? `phieu-bao-hoc-phi-T${month}-${year}-${removeVietnameseTones(notice.fullName)}.png`
    : ""

  const body = (
    <div className="flex-1 overflow-y-auto px-3 py-4 md:px-6">
      {query.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-600">{t("load_error")}</p>
          <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !notice ? (
        <Skeleton className="mx-auto h-[560px] w-[360px] max-w-full rounded-lg" />
      ) : (
        <div className="space-y-4">
          {!notice.bankConfigured && notice.remaining > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>{t("notice_no_bank")}</p>
              <Link href="/settings" className="mt-1 inline-block font-medium underline">
                {t("open_settings")}
              </Link>
            </div>
          )}
          {/* Phiếu rộng cố định 360px; màn hẹp hơn thì cuộn ngang trong khung, không tràn trang. */}
          <div className="overflow-x-auto">
            <div className="mx-auto w-fit">
              <TuitionNoticeCard ref={cardRef} notice={notice} onReady={handleReady} />
            </div>
          </div>
          {captureFailed && <p className="text-center text-sm text-red-600">{t("load_error")}</p>}
        </div>
      )}
    </div>
  )

  const footer = (
    <div className="flex gap-2 border-t border-slate-200 p-4 md:justify-end">
      {shareable && (
        <Button
          variant="outline"
          className="h-11 flex-1 md:h-10 md:flex-none"
          disabled={!blob}
          onClick={() => blob && shareOrDownloadPng(blob, filename, title)}
        >
          {blob ? <Share2 className="mr-2 size-4" /> : <Loader2 className="mr-2 size-4 animate-spin" />}
          {t("share")}
        </Button>
      )}
      <Button
        className="h-11 flex-1 md:h-10 md:flex-none"
        disabled={!blob}
        onClick={() => blob && saveAs(blob, filename)}
      >
        {blob ? <Download className="mr-2 size-4" /> : <Loader2 className="mr-2 size-4 animate-spin" />}
        {t("download_image")}
      </Button>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          data-testid="tuition-notice"
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[460px]"
        >
          <DialogHeader className="border-b border-slate-200 p-4">
            <DialogTitle>{t("tuition_notice")}</DialogTitle>
          </DialogHeader>
          {body}
          {footer}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        data-testid="tuition-notice"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[450px]"
      >
        <SheetHeader className="border-b border-slate-200 p-4">
          <SheetTitle>{t("tuition_notice")}</SheetTitle>
        </SheetHeader>
        {body}
        {footer}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Nút "Phiếu báo" ở trang `/tuition`**

Trong `src/app/(app)/tuition/page.tsx`:
- Import: thêm `Receipt` vào import lucide (`import { ChevronLeft, ChevronRight, Receipt, Wallet } from "lucide-react"`) và `import { TuitionNoticeDialog } from "@/components/tuition/TuitionNoticeDialog"`.
- Dưới `const [isSheetOpen, setIsSheetOpen] = useState(false)`, thêm:

```tsx
  const [noticeStudentId, setNoticeStudentId] = useState<number | null>(null)
```

- Ngay dưới hàm `payButton`, thêm:

```tsx
  const noticeButton = (item: TuitionStatusItem, className?: string) => (
    <Button
      size="icon"
      variant="outline"
      className={className}
      aria-label={t("tuition_notice")}
      onClick={(e) => {
        e.stopPropagation()
        setNoticeStudentId(item.studentId)
      }}
    >
      <Receipt className="size-4" />
    </Button>
  )
```

- Cột hành động của bảng: thay dòng cuối của `columns` bằng:

```tsx
    {
      header: <span className="sr-only">{t("action")}</span>,
      cell: (item) => (
        <div className="flex justify-end gap-2">
          {noticeButton(item, "size-9")}
          {payButton(item)}
        </div>
      ),
      className: "w-[180px] text-right",
    },
```

- Thẻ mobile: thay `{payButton(item, "h-11")}` bằng:

```tsx
              <div className="flex gap-2">
                {noticeButton(item, "size-11")}
                {payButton(item, "h-11")}
              </div>
```

- Cuối JSX, ngay trước `</div>` đóng ngoài cùng (sau `<TuitionDetailSheet ... />`), thêm:

```tsx
      {noticeStudentId !== null && (
        <TuitionNoticeDialog
          studentId={noticeStudentId}
          year={year}
          month={month}
          onClose={() => setNoticeStudentId(null)}
        />
      )}
```

(Nếu B đã đổi tên `payButton`/cấu trúc thẻ: giữ nguyên ý — nút icon đứng trước nút "Ghi nhận" ở cả bảng và thẻ; ghi lại.)

- [ ] **Step 4: Nút "Phiếu báo" ở footer `TuitionDetailSheet` (bản B)**

Trong `src/components/tuition/TuitionDetailSheet.tsx`:
- `Receipt` đã được import từ lucide ở bản hiện tại; nếu bản B bỏ thì thêm lại. Thêm `import { TuitionNoticeDialog } from "./TuitionNoticeDialog"`; đảm bảo `useState` có trong import từ `react`.
- Trong thân component, thêm state:

```tsx
  const [noticeOpen, setNoticeOpen] = useState(false)
```

- Ở footer (khối chứa nút **Lưu**), đặt nút này **bên trái** nút Lưu (cùng hàng):

```tsx
          <Button
            type="button"
            variant="outline"
            className="h-11 md:h-10"
            onClick={() => setNoticeOpen(true)}
            disabled={!data}
          >
            <Receipt className="mr-2 size-4" />
            {t("tuition_notice")}
          </Button>
```

- Render dialog phiếu (chồng lên sheet) ở cả 2 nhánh return (desktop `Dialog` và mobile `Sheet`) — cách gọn: bọc return bằng fragment, hoặc thêm ngay trước thẻ đóng `</DialogContent>` và `</SheetContent>`:

```tsx
      {noticeOpen && data && (
        <TuitionNoticeDialog
          studentId={data.studentId}
          year={data.year}
          month={data.month}
          onClose={() => setNoticeOpen(false)}
        />
      )}
```

(Nếu prop dữ liệu của sheet bản B không tên `data` hoặc không có `year/month`: lấy `studentId/year/month` từ prop thật; ghi lại.)

- [ ] **Step 5: Typecheck + lint + unit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test tests/unit`
Expected: không lỗi, unit pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/tuition/TuitionNoticeCard.tsx src/components/tuition/TuitionNoticeDialog.tsx "src/app/(app)/tuition/page.tsx" src/components/tuition/TuitionDetailSheet.tsx
git commit -m "feat(tuition): phiếu báo học phí có VietQR, xem trước, chia sẻ/tải ảnh PNG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

---

### Task 8: E2E + kiểm chứng cuối + kiểm tay bắt buộc

**Đọc trước:** spec C mục 2, 10 (E2E, Kiểm tay, Chung), 13; `tests/e2e/mobile.spec.ts` (mẫu tạo HS, tạo ca, điểm danh, xoá ca ở 390px); `playwright.config.ts`.

**Files:**
- Create: `tests/e2e/tuition-notice.spec.ts`
- Create (không commit): `.superpowers/pw-3100.config.ts`

**Interfaces:**
- Consumes: route `/settings`, nhãn ô và nút (Task 5); `data-testid="list-card"` (ResponsiveList), nút `aria-label="Phiếu báo"`, `data-testid="tuition-notice"`, `data-testid="notice-card"`, nút "Tải ảnh"/"Chia sẻ" (Task 7).

- [ ] **Step 1: Viết e2e**

`tests/e2e/tuition-notice.spec.ts`:

```ts
import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

// Tạo 1 ca hôm nay gắn HS rồi điểm danh "Có mặt" (giống mobile.spec.ts).
async function createPresentSession(page: Page, studentName: string, startHour: number, title: string) {
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Tạo ca dạy' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Bắt đầu (HH:mm)').fill(`${startHour}00`);
  await form.getByLabel('Kết thúc (HH:mm)').fill(`${startHour + 1}00`);
  await form.getByLabel('Môn học').click();
  await page.getByRole('option').first().click();
  await form.getByPlaceholder('Nhóm nâng cao').fill(title);
  await form.getByLabel(new RegExp(studentName)).click();
  await form.getByRole('button', { name: 'Tạo ca dạy' }).click();
  await expect(page.getByText('Tạo ca dạy thành công').first()).toBeVisible();

  await page.getByText(title).filter({ visible: true }).first().click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('button', { name: 'Có mặt' }).first().click();
  await detail.getByRole('button', { name: 'Lưu điểm danh' }).click();
  await expect(page.getByText('Đã lưu điểm danh').first()).toBeVisible();
  await page.keyboard.press('Escape');
}

async function deleteSession(page: Page, title: string) {
  await page.goto('/calendar');
  await page.getByText(title).filter({ visible: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Menu hành động' }).click();
  await page.getByRole('menuitem', { name: 'Xóa ca dạy' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa ca dạy' }).click();
  await expect(page.getByText('Đã xóa ca dạy').first()).toBeVisible();
}

async function openNoticeFromCard(page: Page, studentName: string) {
  await page.goto('/tuition');
  await page.getByPlaceholder('Tìm tên học sinh...').fill(studentName);
  const card = page.getByTestId('list-card').filter({ hasText: studentName });
  const btn = card.getByRole('button', { name: 'Phiếu báo' });
  await expect(btn).toBeVisible();
  await expectTouchTarget(btn);
  await btn.click();
  return card;
}

// Tải ảnh → kiểm tên file, rộng 720px (360 × scale 2), và ảnh không trắng trơn.
async function downloadAndCheck(page: Page, notice: Locator) {
  const btn = notice.getByRole('button', { name: 'Tải ảnh' });
  await expect(btn).toBeEnabled();
  await expectTouchTarget(btn);
  const [download] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  expect(download.suggestedFilename()).toMatch(/^phieu-bao-hoc-phi-T\d{1,2}-\d{4}-.+\.png$/);
  const png = readFileSync((await download.path())!);
  expect(png.length).toBeGreaterThan(0);
  expect(png.readUInt32BE(16)).toBe(720); // IHDR: bề rộng ảnh
  const darkPixels = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 100 && d[i + 1] < 100 && d[i + 2] < 100) n++;
    return n;
  }, png.toString('base64'));
  expect(darkPixels).toBeGreaterThan(5000);
}

test.describe('Phiếu báo học phí (390px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Headless không có bảng chia sẻ → bỏ Web Share để luôn đi nhánh tải file.
      delete (Navigator.prototype as { share?: unknown }).share;
      delete (Navigator.prototype as { canShare?: unknown }).canShare;
      // Huy hiệu dev của Next đè góc trái dưới ở 390px.
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal { display: none !important; }';
        document.head.appendChild(style);
      });
    });
    await page.goto('/login');
    await page.fill('input[name="username"]', 'teacher');
    await page.fill('input[name="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  // HS để lại trong DB test (đã có dòng học phí); DB test được reset khi chạy `pnpm test`.
  test('cài ngân hàng → phiếu có QR → tải ảnh → mở lại từ sheet → xoá ngân hàng', async ({ page }) => {
    const stamp = Date.now();
    const studentName = `HS Phiếu Nguyễn Thị Hường ${stamp}`;
    const titles = [`Ca phiếu A ${stamp}`, `Ca phiếu B ${stamp}`];
    const startHour = Math.floor(Math.random() * 4) + 13; // 13 tới 16, ca thứ 2 cách 2 giờ

    // 1. Cài đặt ngân hàng từ menu avatar
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await page.getByRole('menuitem', { name: 'Cài đặt' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await page.getByLabel('Ngân hàng').click();
    await page.getByRole('option', { name: /^Vietcombank - / }).click();
    await page.getByLabel('Số tài khoản').fill('0011001234567');
    const holder = page.getByLabel('Tên chủ tài khoản');
    await holder.fill('nguyen van a');
    await holder.blur();
    await expect(holder).toHaveValue('NGUYEN VAN A');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu tài khoản ngân hàng')).toBeVisible();
    await expectNoHorizontalScroll(page);

    // 2. HS học phí 150.000/buổi + 2 ca có mặt hôm nay
    await page.goto('/students');
    await page.getByRole('button', { name: 'Thêm học sinh' }).click();
    await page.fill('input[id="fullName"]', studentName);
    await page.click('button#grade');
    await page.getByRole('option', { name: 'Lớp 5' }).click();
    await page.locator('input#tuitionFee').fill('150000');
    await page.locator('button:has-text("Thêm")').last().click();
    await expect(page.getByText('Đã thêm học sinh')).toBeVisible();
    await createPresentSession(page, studentName, startHour, titles[0]);
    await createPresentSession(page, studentName, startHour + 2, titles[1]);

    // 3. Mở phiếu từ thẻ mobile
    const card = await openNoticeFromCard(page, studentName);
    const notice = page.getByTestId('tuition-notice');
    const noticeCard = notice.getByTestId('notice-card');
    await expect(noticeCard.getByText(studentName)).toBeVisible();
    await expect(noticeCard.getByText('Còn phải trả')).toBeVisible();
    await expect(noticeCard.getByText('300.000 đ').first()).toBeVisible();
    await expect(noticeCard.locator('img[src^="data:image/png"]')).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Chia sẻ' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await downloadAndCheck(page, notice);
    await page.keyboard.press('Escape');
    await expect(notice).toHaveCount(0);

    // 4. Mở lại từ sheet chi tiết (dữ liệu đã cache → chụp ngay khi khung còn trượt vào)
    await card.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Phiếu báo' }).click();
    await expect(noticeCard.getByText(studentName)).toBeVisible();
    await expect(noticeCard.locator('img[src^="data:image/png"]')).toBeVisible();
    await downloadAndCheck(page, notice);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // 5. Xoá thông tin ngân hàng → phiếu có dòng nhắc, không QR
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Xoá thông tin' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xoá thông tin' }).click();
    await expect(page.getByLabel('Số tài khoản')).toHaveValue('');
    await openNoticeFromCard(page, studentName);
    await expect(notice.getByText('Chưa cài tài khoản ngân hàng nên phiếu chưa có mã QR.')).toBeVisible();
    await expect(notice.getByRole('link', { name: 'Mở Cài đặt' })).toHaveAttribute('href', '/settings');
    await expect(noticeCard.locator('img')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 6. Dọn ca để lần chạy sau cùng ngày không vướng trùng giờ
    for (const title of titles) await deleteSession(page, title);
  });
});
```

Ghi chú khi chạy: nếu ô `#tuitionFee` (CurrencyInput) không nhận `fill`, dùng `click()` + `pressSequentially('150000')`. Nếu phí buổi không lấy từ `tuitionFee` khiến số khác `300.000 đ`, sửa kỳ vọng theo phí thật của ca (không sửa code app).

- [ ] **Step 2: Config tạm cổng 3100 (không commit)**

```bash
mkdir -p .superpowers
grep -qx '.superpowers/' .git/info/exclude || echo '.superpowers/' >> .git/info/exclude
cat > .superpowers/pw-3100.config.ts <<'EOF'
import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

const webServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer!;

export default defineConfig({
  ...base,
  testDir: '../tests/e2e',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    ...webServer,
    command: 'pnpm exec next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: true,
  },
});
EOF
git status --short .superpowers
```
Expected: `git status` không in gì (đã bị bỏ qua). `webServer.env` kế thừa `DATABASE_URL`/`DIRECT_URL` của `.env.test` từ `playwright.config.ts`. Chỉ dùng `reuseExistingServer: true` khi server đang chạy ở cổng 3100 (nếu có) cũng do Playwright khởi với `.env.test`; không chắc thì tắt nó trước.

- [ ] **Step 3: Chạy e2e**

Trước tiên reset DB test bằng bộ test đầy đủ (bước 4 dùng luôn kết quả này): `pnpm test`.
Run: `pnpm exec playwright test tests/e2e/tuition-notice.spec.ts --config .superpowers/pw-3100.config.ts` (nếu cổng 3000 trống có thể dùng `pnpm exec playwright test tests/e2e/tuition-notice.spec.ts`).
Expected: PASS 1/1.

Rồi chạy toàn bộ e2e: `pnpm exec playwright test --config .superpowers/pw-3100.config.ts`
Expected: toàn bộ pass (upgrade-class có thể skip như trước).

- [ ] **Step 4: Kiểm tra toàn bộ**

Run: `pnpm lint && pnpm test && pnpm exec next build`
Expected: lint sạch; unit + integration pass (gồm `vietqr`, `vn-banks`, `settings.schema`, `tuition-notice` (unit), `share-image`, `settings`, `tuition-notice` (integration)); build OK. Không chạy `pnpm build`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/tuition-notice.spec.ts
git commit -m "test(e2e): phiếu báo học phí trên mobile (cài ngân hàng, QR, tải ảnh, mở lại từ sheet)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0128L55kVDRGjUqDDqt8RXmg"
```

- [ ] **Step 6: Bàn giao — ghi vào báo cáo cho người điều phối các bước kiểm tay còn lại**

Agent thực hiện task **KHÔNG merge, KHÔNG push**. Báo cáo phải liệt kê nguyên văn các bước dưới đây để người dùng làm:

1. **BẮT BUỘC TRƯỚC KHI MERGE: quét QR bằng ≥ 2 app ngân hàng khác nhau** (vd Vietcombank + MB/Techcombank), ghi kết quả vào PR:
   - Chạy app local trỏ DB test (không phải prod):
     ```bash
     (
       set -a; . ./.env.test; set +a
       for u in "$DATABASE_URL" "$DIRECT_URL"; do
         case "$u" in *ep-jolly-dew*) ;; *) echo "DỪNG: URL không phải DB test"; exit 1;; esac
       done
       pnpm exec next dev -p 3100
     )
     ```
   - Người dùng tự đăng nhập `http://127.0.0.1:3100` (tài khoản test), vào Cài đặt nhập **1 tài khoản thật của giáo viên**, tạo HS + ca có mặt, mở Phiếu báo, quét QR trên màn hình bằng từng app.
   - Mỗi app phải hiện đúng: ngân hàng, số tài khoản, tên chủ TK (app tự tra), **số tiền = "Còn phải trả"**, **nội dung = dòng "Nội dung" trên phiếu**. KHÔNG bấm chuyển tiền thật (hoặc chỉ chuyển thử số nhỏ nếu người dùng muốn).
   - Nếu 1 app báo "mã QR không hợp lệ" → không merge; kiểm lại BIN của ngân hàng đó và payload.
2. Trên **iPhone Safari** và **Android Chrome** (sau khi deploy, hoặc qua bản local có HTTPS): bấm Chia sẻ → chọn Zalo → Zalo nhận ảnh PNG; chữ có dấu trong ảnh đúng (thử tên "Nguyễn Thị Hường"); bấm Tải ảnh ra file PNG mở được.
3. Migration: người điều phối thử `prisma migrate deploy` trên Neon branch "Branch from current" của prod trước khi merge (như B); sau khi Vercel deploy, chạy kiểm tra **chỉ đọc** trên prod:
   ```sql
   SELECT COUNT(*) FROM "users";  -- bằng số trước deploy
   SELECT COUNT(*) FROM "users" WHERE "bank_bin" IS NOT NULL
     OR "bank_account_number" IS NOT NULL OR "bank_account_name" IS NOT NULL;  -- = 0
   ```
4. Preview Vercel không có env → không dùng preview để kiểm tra.
```
