import { test, expect, type Page, type Locator } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import ExcelJS from "exceljs"
import { buildImportTemplate } from "@/lib/student-import-excel"
import { seedDemo, cleanupDemo, setDemoBank, setDemoPayments } from "./demo-data"

test.describe.configure({ mode: "serial" })

const OUT = "public/guide"
let parentToken = ""
let sampleExcelPath = ""

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true })
  parentToken = await seedDemo()

  // Tạo sẵn file excel đúng chuẩn template có 1 dòng đúng, 1 dòng lỗi cho shot 6
  const templateBuf = await buildImportTemplate()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(templateBuf)
  const ws = wb.getWorksheet("Hoc sinh")!
  ws.addRow(["Nguyễn Minh Khang", 6, "Chị Hoa", "0912345678", 150000, "buổi", ""])
  ws.addRow(["", 7, "Anh Tuấn", "", 150000, "buổi", ""]) // Lỗi: thiếu tên
  // Ghi ra thư mục tạm của Playwright, không ghi đè file trong repo mỗi lần chạy.
  sampleExcelPath = test.info().outputPath("sample-import.xlsx")
  mkdirSync(dirname(sampleExcelPath), { recursive: true })
  await wb.xlsx.writeFile(sampleExcelPath)
})

test.afterAll(cleanupDemo)

async function clean(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal, [data-sonner-toaster] { display: none !important; } [data-testid=\"build-info\"] { visibility: hidden !important; }",
  })
}

async function mark(target: Locator) {
  await target.page().evaluate(() => {
    document.querySelectorAll("*").forEach((el) => {
      if ((el as HTMLElement).style.outline?.includes("rgb(239, 68, 68)") || (el as HTMLElement).style.outline?.includes("#ef4444")) {
        ;(el as HTMLElement).style.outline = ""
        ;(el as HTMLElement).style.outlineOffset = ""
      }
    })
  })
  await target.first().evaluate((el) => {
    ;(el as HTMLElement).style.outline = "3px solid #ef4444"
    ;(el as HTMLElement).style.outlineOffset = "2px"
  })
  await target.first().scrollIntoViewIfNeeded()
}

async function shot(page: Page, name: string, kind: "desktop" | "mobile") {
  await clean(page)
  await page.waitForTimeout(300)
  await page.screenshot({
    path: `${OUT}/${name}-${kind}.jpg`,
    type: "jpeg",
    quality: 80,
  })
}

test("capture-25-shots", async ({ page, browser }, testInfo) => {
  test.setTimeout(600000)
  page.setDefaultTimeout(20000)
  const kind = testInfo.project.name as "desktop" | "mobile"

  // 1. dang-ky: /register khi chưa đăng nhập, viền đỏ nút Đăng ký
  await page.goto("/register")
  await page.waitForSelector('button[type="submit"]')
  const regBtn = page.getByRole("button", { name: "Đăng ký", exact: true })
  await mark(regBtn)
  await shot(page, "dang-ky", kind)

  // 2. tong-quan-bat-dau: /dashboard, thẻ Bắt đầu sử dụng 3/5 bước
  await page.goto("/login")
  await page.waitForSelector('input[name="username"]')
  await page.fill('input[name="username"]', "guide_demo")
  await page.fill('input[name="password"]', "teacher123")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard")

  const startCard = page.locator("div.border-primary\\/30").first()
  await expect(startCard).toBeVisible()
  await mark(startCard)
  await shot(page, "tong-quan-bat-dau", kind)

  // Cài đặt ngân hàng và học phí sau shot 2 để từ shot 3 trở đi app có đầy đủ dữ liệu
  await setDemoBank()
  await setDemoPayments()

  // 3. mon-hoc-them: /subjects, hộp Thêm môn đang mở, viền đỏ ô chọn màu
  await page.goto("/subjects")
  await page.waitForSelector('button:has-text("Thêm môn")')
  await page.locator('button:has-text("Thêm môn")').first().click()
  const subjectDialog = page.getByRole("dialog")
  await expect(subjectDialog).toBeVisible()
  const colorContainer = subjectDialog.locator(".grid.grid-cols-5.gap-3").first()
  await mark(colorContainer)
  await shot(page, "mon-hoc-them", kind)
  await page.keyboard.press("Escape")

  // 4. hoc-sinh-danh-sach: /students, viền đỏ nút Thêm học sinh
  await page.goto("/students")
  await expect(page.locator("text=Nguyễn Minh Anh").locator("visible=true").first()).toBeVisible()
  const addStudentBtn = page.locator("button:has-text('Thêm học sinh')").first()
  await mark(addStudentBtn)
  await shot(page, "hoc-sinh-danh-sach", kind)

  // 5. hoc-sinh-them: hộp Thêm học sinh, đã gõ tên mẫu, viền đỏ phần Cách thu học phí
  await page.locator("button:has-text('Thêm học sinh')").first().click()
  const studentDialog = page.getByRole("dialog")
  await expect(studentDialog).toBeVisible()
  await studentDialog.locator("#fullName").fill("Lê Minh Tâm")
  const billingSection = studentDialog.locator('div[role="radiogroup"]').first()
  await mark(billingSection)
  await shot(page, "hoc-sinh-them", kind)
  await page.keyboard.press("Escape")

  // 6. nhap-excel-xem-truoc: hộp Nhập Excel sau khi chọn file có 1 dòng lỗi, viền đỏ dòng lỗi tô đỏ
  await page.getByTestId("add-student-more").click()
  await page.getByRole("menuitem", { name: "Nhập Excel" }).click()
  const importDialog = page.getByRole("dialog")
  await expect(importDialog).toBeVisible()
  await importDialog.getByTestId("import-file-input").setInputFiles(sampleExcelPath)
  await expect(importDialog.getByTestId("import-summary")).toBeVisible()
  const errRow = importDialog.locator("li.bg-red-50, [data-testid='import-row'].border-red-200, li:has-text('Lỗi')").first()
  await mark(errRow)
  await shot(page, "nhap-excel-xem-truoc", kind)
  await page.keyboard.press("Escape")

  // 7. lich-day-thang: /calendar tháng hiện tại có ca, viền đỏ nút + Thêm ca dạy mới
  await page.goto("/calendar")
  await page.waitForSelector('button:has-text("Tạo ca dạy"), button:has-text("Thêm ca dạy")')
  const addSessionBtn = page.locator('button:has-text("Tạo ca dạy"), button:has-text("Thêm ca dạy")').first()
  await mark(addSessionBtn)
  await shot(page, "lich-day-thang", kind)

  // 8. lich-day-tao-ca: hộp tạo ca, đã chọn môn + 2 HS, viền đỏ phần chọn học sinh
  await page.locator('button:has-text("Tạo ca dạy"), button:has-text("Thêm ca dạy")').first().click()
  const createSessionDialog = page.getByRole("dialog")
  await expect(createSessionDialog).toBeVisible()
  await createSessionDialog.locator("text=Nguyễn Minh Anh").first().click()
  await createSessionDialog.locator("text=Trần Gia Bảo").first().click()
  const studentSection = createSessionDialog.locator("input[placeholder*='học sinh']").locator("xpath=ancestor::div[contains(@class, 'space-y-3')]").first()
  await mark(studentSection)
  await shot(page, "lich-day-tao-ca", kind)
  await page.keyboard.press("Escape")

  // 9. lich-day-chi-tiet-ca: chi tiết 1 ca trong quá khứ, viền đỏ các nút thao tác
  if (kind === "mobile") {
    const dayWithDot = page.locator("button:has(div.rounded-full.size-1\\.5, div.rounded-full.size-1\\.5)").first()
    if (await dayWithDot.isVisible()) {
      await dayWithDot.click()
    }
  }
  const sessionItem = page.locator(".session-card, button:has(div.h-12)").locator("visible=true").first()
  await expect(sessionItem).toBeVisible()
  await sessionItem.click()
  const sessionDetailDialog = page.getByRole("dialog")
  await expect(sessionDetailDialog).toBeVisible()
  const actionHeader = sessionDetailDialog.getByRole("button", { name: "Menu hành động" })
  await mark(actionHeader)
  await shot(page, "lich-day-chi-tiet-ca", kind)

  // 11. diem-danh: chi tiết ca, danh sách điểm danh, viền đỏ cụm chọn trạng thái của 1 HS
  const statusGroup = sessionDetailDialog.locator("button[aria-pressed]").first().locator("xpath=..")
  await mark(statusGroup)
  await shot(page, "diem-danh", kind)

  // 12. diem-danh-ca-ke: chi tiết ca, viền đỏ nút mũi tên ca trước/ca sau
  const navBar = sessionDetailDialog.getByRole("button", { name: "Ca sau" }).locator("xpath=..")
  await mark(navBar)
  await shot(page, "diem-danh-ca-ke", kind)
  await page.keyboard.press("Escape")

  // 10. lich-day-chep-thang: hộp Chép lịch tháng đang mở, viền đỏ nút xác nhận chép
  await page.locator('[data-testid="copy-month-button"]').locator("visible=true").first().click()
  const copyDialog = page.locator('[data-testid="copy-month-dialog"]')
  await expect(copyDialog).toBeVisible()
  const confirmCopyBtn = copyDialog.locator('[data-testid="copy-confirm"]').first()
  await mark(confirmCopyBtn)
  await shot(page, "lich-day-chep-thang", kind)
  await page.keyboard.press("Escape")

  // 13. hoc-phi-danh-sach: /tuition tháng trước, viền đỏ cột/ô số cần đóng của 1 HS còn nợ cũ
  await page.goto("/tuition")
  const duyName = page.locator("text=Phạm Đức Duy").locator("visible=true").first()
  await expect(duyName).toBeVisible()
  const duyRow = page.locator("tr:has-text('Phạm Đức Duy'), [data-testid='list-card']:has-text('Phạm Đức Duy')").locator("visible=true").first()
  const debtCell = duyRow.locator("span:has-text('đ')").first()
  await mark(debtCell)
  await shot(page, "hoc-phi-danh-sach", kind)

  // 14. hoc-phi-da-dong-du: /tuition tháng trước, viền đỏ nút Đã đóng đủ trên 1 dòng
  const payFullBtn = page.locator('button:has-text("Đã đóng đủ")').locator("visible=true").first()
  await mark(payFullBtn)
  await shot(page, "hoc-phi-da-dong-du", kind)

  // 15. hoc-phi-dong-mot-phan: chi tiết HS, khung Đóng một phần đã nhập số tiền, có dòng xem trước
  await duyName.click()
  const payPartialBtn = page.locator("button:has-text('Đóng một phần')").locator("visible=true").first()
  await expect(payPartialBtn).toBeVisible()
  await payPartialBtn.click()

  const amountInput = page.locator("#pay-amount, input[placeholder='0']").locator("visible=true").first()
  await amountInput.fill("500000")
  const preview = page.locator("text=Trừ vào").locator("visible=true").first()
  await expect(preview).toBeVisible()
  await mark(preview)
  await shot(page, "hoc-phi-dong-mot-phan", kind)

  // 16. hoc-phi-mien: hộp Miễn phần còn thiếu, viền đỏ ô Lý do
  const moreBtn = page.getByRole("heading", { name: "Phạm Đức Duy" }).locator("xpath=ancestor::div[contains(@class, 'justify-between')]").locator("button").last()
  await moreBtn.click()
  await page.getByRole("menuitem", { name: "Miễn phần còn thiếu" }).click()
  const waiveDialog = page.getByRole("alertdialog")
  await expect(waiveDialog).toBeVisible()
  const reasonInput = waiveDialog.locator("#waive-reason")
  await mark(reasonInput)
  await shot(page, "hoc-phi-mien", kind)
  await page.keyboard.press("Escape")

  // 17. hoc-phi-phieu-bao: phiếu báo học phí có QR, viền đỏ mã QR
  const noticeBtn = page.locator("[role='dialog']").getByRole("button", { name: "Phiếu báo" }).first()
  await noticeBtn.click()
  const qrImg = page.locator('img[alt="VietQR"]').locator("visible=true").first()
  await expect(qrImg).toBeVisible()
  await mark(qrImg)
  await shot(page, "hoc-phi-phieu-bao", kind)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  // 18. link-phu-huynh: trang /p/<token> của 1 HS mẫu (chưa đăng nhập), không viền
  const pContext = await browser.newContext({
    viewport: kind === "desktop" ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    deviceScaleFactor: kind === "desktop" ? 1 : 2,
    isMobile: kind === "mobile",
    hasTouch: kind === "mobile",
  })
  const pPage = await pContext.newPage()
  await pPage.goto(`/p/${parentToken}`)
  await expect(pPage.locator("text=Nguyễn Minh Anh").locator("visible=true").first()).toBeVisible()
  await shot(pPage, "link-phu-huynh", kind)
  await pContext.close()

  // 19. bao-cao: /reports tháng trước, viền đỏ ô chọn tháng
  await page.goto("/reports")
  const monthSelector = page.locator("button[role='combobox'], select, button:has-text('Tháng')").locator("visible=true").first()
  await mark(monthSelector)
  await shot(page, "bao-cao", kind)

  // 20. cai-dat-ngan-hang: /settings phần Tài khoản nhận học phí, viền đỏ ô tìm ngân hàng
  await page.goto("/settings")
  const bankCombobox = page.locator('button[role="combobox"]').locator("visible=true").first()
  await mark(bankCombobox)
  await shot(page, "cai-dat-ngan-hang", kind)

  // 21. goi-dich-vu: trang Gói của tôi, viền đỏ khung Gói hiện tại ở đầu trang (bản 0.11.5)
  await page.goto("/plan")
  await mark(page.getByTestId("plan-current"))
  await shot(page, "goi-dich-vu", kind)

  // 21b. goi-thanh-toan: popup mua gói Pro, viền đỏ nhóm Cách thanh toán (bản 0.16.0, cần env payOS giả)
  await page.goto("/plan?buy=1")
  const payMethod = page.getByRole("radiogroup", { name: "Cách thanh toán" })
  await payMethod.scrollIntoViewIfNeeded()
  await mark(payMethod)
  await shot(page, "goi-thanh-toan", kind)

  // 22. thung-rac: /trash có 1 HS mẫu đã xoá, viền đỏ nút Khôi phục
  await page.goto("/trash")
  await page.locator("button[role='tab']:has-text('Học sinh')").click()
  await expect(page.locator("text=Đỗ Thảo Vy").locator("visible=true").first()).toBeVisible()
  const restoreBtn = page.locator("button:has-text('Khôi phục')").locator("visible=true").first()
  await mark(restoreBtn)
  await shot(page, "thung-rac", kind)

  // 23. sao-luu-menu: menu avatar đang mở, viền đỏ mục Sao lưu dữ liệu
  await page.goto("/dashboard")
  const avatarBtn = page.locator("button[aria-label='Mở menu tài khoản']").locator("visible=true").first()
  await avatarBtn.click()
  const backupItem = page.getByRole("menuitem", { name: "Sao lưu dữ liệu" })
  await expect(backupItem).toBeVisible()
  await mark(backupItem)
  await shot(page, "sao-luu-menu", kind)

  // 24. sao-luu-canh-bao: hộp cảnh báo sao lưu, viền đỏ nút Tôi hiểu, tải xuống
  await backupItem.click()
  const backupAlert = page.getByRole("alertdialog")
  await expect(backupAlert).toBeVisible()
  const downloadBtn = backupAlert.getByRole("button", { name: "Tôi hiểu, tải xuống" })
  await mark(downloadBtn)
  await shot(page, "sao-luu-canh-bao", kind)
})
