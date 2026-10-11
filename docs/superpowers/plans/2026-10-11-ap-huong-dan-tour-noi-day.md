# AP — Hướng dẫn + ảnh + tour Nơi dạy: Implementation Plan

> **For agentic workers:** superpowers:executing-plans. Test trước → code → test liên quan → commit.

**Goal:** `/guide` và file Word có đủ mục cho tính năng AK→AO, ảnh chụp lại toàn bộ theo giao diện mới, thêm tour "Chỉ cho tôi" cho Nơi dạy và Thu nhập, ghi luật "tính năng mới phải kèm hướng dẫn" vào tài liệu dự án.

**Architecture:** chỉ dữ liệu + UI phụ:
- `src/lib/guide-content.ts`
- `src/lib/tours.ts`
- thuộc tính `data-tour` trên component sẵn có
- i18n `tour_*`
- `tests/guide-shots/*`
- `public/guide/*`
- `docs/coding-rule.md`

**Spec:** `docs/superpowers/specs/2026-10-11-ap-huong-dan-tour-noi-day-design.md`.

**Nhánh:** `feat/ap-huong-dan` từ `main` (đã có AK→AO, v0.23.0). Worktree `D:\APINODEJS\student-managerment-otd`: `git fetch` không cần (cùng repo), `git checkout -b feat/ap-huong-dan main`.

## Global Constraints

- **Không** migration, **không** đổi logic nghiệp vụ / API.
- Nội dung hướng dẫn: tiếng Việt, giọng văn như mục sẵn có, tên nút in đậm khớp đúng chữ trên giao diện hiện tại.
- Tour: vi + en đủ key; data-tour đặt trên phần tử có sẵn, không đổi bố cục.
- Ảnh: dữ liệu demo, không chân trang dev, không số tài khoản / khoá thật. Khổ desktop 1280×800, mobile 780×1688 như `GUIDE_SHOT_SIZE`.
- Test 3 tầng: mỗi task test liên quan + tsc + lint; full vitest + full e2e (xoá `.next` trước) ở task phát hành.
- Version **0.24.0**. Commit `[AP] ...`. Không merge, không push.

## Review Focus

1. Tên nút / đường đi trong hướng dẫn khớp giao diện thật (vd **Thêm** → **Nơi dạy** trên điện thoại, **Tạo ca dạy ▾**, **⋯**). Đọc lại từng bước đối chiếu ảnh.
2. Tour `income` khi user chưa có nơi theo ca/giờ: hiện bước thiếu và chuyển sang tour `place`, không treo.
3. Tour trên mobile 375: các bước nằm trong dialog / sheet (form nơi dạy, sheet chi tiết thu nhập) tô sáng được, nút Tiếp không bị che.
4. Gói Standard chạy tour `income`: không bật UpgradeDialog giữa tour; bước "Ghi nhận đã nhận" mô tả cần gói Plus.
5. Mọi `shot` trong `GUIDE_SECTIONS` có đủ 2 file ảnh; file Word mở được, có 4 mục mới.

---

### Task 1: Nội dung hướng dẫn (mục mới + sửa mục cũ)

**Files:**
- Modify: `src/lib/guide-content.ts`
- Test: test hiện có của guide-content (tìm `GUIDE_SECTIONS` trong `tests/`), mở rộng

**Steps:**
- [ ] **RED:** test có 4 id `noi-day`, `bang-cong`, `phieu-noi-day`, `chuyen-can` theo đúng thứ tự spec §3; mỗi mục ≥ 1 shot; không id trùng.
- [ ] Viết 4 mục theo spec §3 (đúng tên shot spec §5).
- [ ] Sửa 9 mục cũ theo bảng spec §4. Mở từng màn trên dev server để chép đúng chữ nút.
- [ ] GREEN + tsc + lint → Commit `[AP] Nội dung hướng dẫn Nơi dạy, Bảng công, Phiếu, Chuyên cần`

### Task 2: Tour `place` và `income`

**Files:**
- Modify: `src/lib/tours.ts`:
  - `TourId` thêm `"place" | "income"`
  - `TOURS`
  - `MISSING_STEPS` thêm `perSessionPlace`
  - `GUIDE_TOURS`
- Modify: `requires` của Tour mở rộng; logic kiểm `requires` (tìm nơi dùng `MISSING_STEPS` / `requires` trong `TourRunner.tsx` / `tour-guard.ts`) thêm điều kiện "có nơi per_session" (dùng `place.summary` → `hasPerSession`).
- Modify: thêm `data-tour` vào `PlaceList` / nút Thêm nơi dạy, `PlaceFormDialog` (name / kind / billing / rate / submit), `IncomeTab` (tháng, dòng nơi, nút Phiếu báo), `IncomeDetailSheet` (nút Ghi nhận đã nhận).
- Modify: `src/language/vi.json`, `en.json` (key `tour_place_*`, `tour_income_*`, `tour_need_place_*`).
- Test: unit tours (theo mẫu test tour AD) + e2e `tests/e2e/ap-tour-noi-day.spec.ts`.

**Steps:**
- [ ] **RED unit:**
  - mọi target của 2 tour có `data-tour` trong component render
  - `GUIDE_TOURS` trỏ id tồn tại
  - `parseTourParam("place")` hợp lệ
  - key i18n đủ vi + en
- [ ] Code → GREEN.
- [ ] **e2e:**
  - (a) `/places?tour=place` chạy 6 bước ở 1280 và 375
  - (b) user có nơi theo ca + đơn giá: `/timesheet?tab=income&tour=income` chạy hết **[RF 3]**
  - (c) user chỉ có nơi theo học sinh: bước thiếu → bấm Tiếp → sang tour `place` **[RF 2]**
  - (d) user Standard: không có UpgradeDialog trong lúc tour **[RF 4]**
- [ ] tsc + lint → Commit `[AP] Tour Chỉ cho tôi cho Nơi dạy và Thu nhập`

### Task 3: Dữ liệu demo + chụp lại toàn bộ ảnh + file Word

**Files:**
- Modify: `tests/guide-shots/demo-data.ts` (theo spec §5: 2 nơi, đơn giá, ca đã dạy, 1 lần nhận, tài khoản ngân hàng demo, HS/ca gắn nơi)
- Modify: `tests/guide-shots/guide-shots.spec.ts` (thêm 13 shot mới; sửa thao tác các shot cũ theo giao diện mới: Bộ lọc, Tạo ca dạy ▾, ⋯)
- Output: `public/guide/*.jpg`, `public/guide/huong-dan-su-dung.docx`

**Steps:**
- [ ] **RED:** test đối chiếu `GUIDE_SHOTS` ↔ file trong `public/guide` (cả `-desktop.jpg` và `-mobile.jpg`) **[RF 5]**. Mở rộng test có sẵn nếu đã có.
- [ ] Sửa demo-data + spec chụp, chạy guide-shots (khoá test, RAM ≥ 3000 MB).
- [ ] **Tự xem** ảnh mobile của 4 mục mới và các ảnh có thanh lọc. Ghi trong báo cáo đã xem ảnh nào.
- [ ] `pnpm guide:docx`, kiểm file Word có 4 mục mới.
- [ ] Commit `[AP] Chụp lại ảnh hướng dẫn và file Word`

### Task 4: Luật "tính năng mới kèm hướng dẫn" trong tài liệu

**Files:**
- Modify: `docs/coding-rule.md`: thêm mục ngắn ở phần quy trình / phát hành, nội dung theo spec §7.
- Modify: `.superpowers/gehihi/LENH.md` và `.superpowers/gehaha/GEHAHA.md` nếu tồn tại: thêm 1 dòng cùng nội dung. Các file này git-ignored nên chỉ sửa tại chỗ, không commit.

**Steps:**
- [ ] Viết → Commit `[AP] Luật tính năng mới phải kèm hướng dẫn, ảnh và tour`

### Task 5: Phát hành 0.24.0

- [ ] version 0.24.0 + "Có gì mới" (spec §8).
- [ ] Xoá `.next`, full vitest + full e2e 2 nửa.
- [ ] Commit `[AP] Phát hành 0.24.0`. Báo cáo `.superpowers/claude-otd/bao-cao-AP.md` (liệt kê ảnh đã tự xem). Ghi `DONE AP`. Không merge, không push.
