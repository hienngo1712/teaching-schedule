export type GuideShotKind = "desktop" | "mobile"
export type GuideStep = string | { text: string; shot: string }
export type GuideSection = { id: string; title: string; intro?: string; steps: GuideStep[]; tips?: string[] }

export const GUIDE_SHOT_SIZE: Record<GuideShotKind, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 780, height: 1688 },
}

export function stepText(step: GuideStep): string {
  return typeof step === "string" ? step : step.text
}

export function stepShot(step: GuideStep): string | undefined {
  return typeof step === "string" ? undefined : step.shot
}

export function guideShotSrc(shot: string, kind: GuideShotKind): string {
  return `/guide/${shot}-${kind}.jpg`
}

export const GUIDE_DOCX_PATH = "/guide/huong-dan-su-dung.docx"
export const GUIDE_DOCX_FILENAME = "huong-dan-su-dung.docx"

// Nguồn duy nhất cho /guide (và file Word tải từ trang này). Chỉ tiếng Việt (spec W §3.1).
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "bat-dau",
    title: "Bắt đầu",
    intro: "Mỗi giáo viên dùng 1 tài khoản riêng, chỉ bạn xem được dữ liệu của mình.",
    steps: [
      { text: "Mở trang **Đăng ký**, nhập tên đăng nhập (chữ, số, dấu gạch dưới), mật khẩu ít nhất 10 ký tự và **Nhập lại mật khẩu**.", shot: "dang-ky" },
      "Đọc khung tóm tắt chính sách bảo mật, tick ô đồng ý rồi bấm **Đăng ký**.",
      "Đăng nhập. Tick **Ghi nhớ đăng nhập** nếu dùng máy riêng để không phải đăng nhập lại mỗi ngày.",
      { text: "Trên **Tổng quan** có thẻ **Bắt đầu sử dụng** gồm 5 bước. Làm lần lượt, bước xong tự được đánh dấu.", shot: "tong-quan-bat-dau" },
      "Đổi mật khẩu: bấm vào avatar góc phải trên, chọn **Đổi mật khẩu**.",
    ],
    tips: ["Không nên dùng số điện thoại làm tên đăng nhập.", "Tài khoản mới dùng gói Standard. Quản trị viên có thể cho dùng thử gói Pro một số ngày, xem hạn ở **Gói của tôi**."],
  },
  {
    id: "mon-hoc",
    title: "Môn học",
    intro: "App đã tạo sẵn vài môn khi bạn đăng ký.",
    steps: [
      "Mở **Môn học** (trên điện thoại: tab **Thêm** rồi **Môn học**).",
      { text: "Bấm **Thêm môn** để thêm môn mới, chọn màu để dễ nhìn trên lịch.", shot: "mon-hoc-them" },
      "Tắt các môn không dạy để danh sách chọn môn gọn hơn.",
      "Đặt 1 môn làm mặc định để khi tạo ca app chọn sẵn môn đó.",
    ],
  },
  {
    id: "hoc-sinh",
    title: "Học sinh",
    steps: [
      { text: "Mở **Học sinh**, bấm **Thêm học sinh**.", shot: "hoc-sinh-danh-sach" },
      "Nhập họ tên, lớp, tên và số điện thoại phụ huynh (không bắt buộc).",
      { text: "Chọn **Cách thu học phí**: **Theo buổi** (nhập học phí mỗi buổi) hoặc **Trọn tháng** (nhập học phí cả tháng, không phụ thuộc số buổi).", shot: "hoc-sinh-them" },
      "Tick ô đồng ý lưu dữ liệu rồi bấm **Thêm**.",
      "Học sinh nghỉ hẳn: mở học sinh, tắt **Đang học**. Học sinh vẫn còn trong lịch sử và học phí cũ.",
    ],
    tips: [
      "Đổi cách thu hoặc mức học phí chỉ áp dụng từ tháng bạn chọn, các tháng trước giữ nguyên.",
      "Số học sinh đang học tối đa phụ thuộc gói của bạn.",
    ],
  },
  {
    id: "nhap-excel",
    title: "Nhập học sinh từ Excel",
    steps: [
      "Ở **Học sinh**, bấm **Nhập Excel** rồi **Tải file mẫu**.",
      "Điền mỗi học sinh 1 dòng theo đúng cột trong file mẫu, lưu lại.",
      { text: "Chọn file đã điền. App hiện bảng xem trước, dòng lỗi được tô đỏ kèm lý do.", shot: "nhap-excel-xem-truoc" },
      "Sửa dòng lỗi trong file rồi chọn lại, hoặc bỏ qua dòng lỗi. Tick ô đồng ý và bấm nhập.",
      "Chưa có danh sách: trong hộp **Nhập Excel** mở **Chưa có danh sách? Nhờ phụ huynh điền qua Google Form**, bấm **Tạo Google Form** (cần tài khoản Google).",
      "Tạo 5 câu hỏi đúng tên: **Họ tên**, **Lớp**, **Tên phụ huynh**, **SĐT phụ huynh**, **Ghi chú** (bấm nút sao chép cạnh từng tên rồi dán). Họ tên và Lớp bật **Bắt buộc**; Lớp nên dùng **Menu thả xuống** 1 đến 12.",
      "Bấm **Xuất bản**, gửi link cho phụ huynh. Đủ câu trả lời: tab **Câu trả lời** → **Liên kết với Trang tính** → **Tệp → Tải xuống → Microsoft Excel (.xlsx)**.",
      "Chọn file vừa tải ở hộp **Nhập Excel** như file mẫu. File từ form không có học phí: học sinh có học phí 0đ, sửa trong hồ sơ học sinh.",
    ],
  },
  {
    id: "lich-day",
    title: "Lịch dạy",
    steps: [
      { text: "Mở **Lịch dạy**, bấm **+ Tạo ca dạy**.", shot: "lich-day-thang" },
      { text: "Chọn ngày, giờ bắt đầu, giờ kết thúc, môn và các học sinh trong ca.", shot: "lich-day-tao-ca" },
      "Muốn ca lặp hằng tuần: chọn **Lặp lại vào các thứ** và khoảng ngày.",
      { text: "Bấm vào ca để xem chi tiết, sửa, chuyển sang ngày giờ khác, huỷ ca (ghi lý do) hoặc tạo **Ca bù**.", shot: "lich-day-chi-tiet-ca" },
      { text: "Cuối tháng dùng **Chép lịch tháng** để chép lịch sang tháng sau.", shot: "lich-day-chep-thang" },
    ],
    tips: ["App báo khi ca mới trùng giờ với ca đã có."],
  },
  {
    id: "diem-danh",
    title: "Điểm danh",
    steps: [
      "Mở ca cần điểm danh trên **Lịch dạy**.",
      { text: "Bấm dấu tích (có mặt) hoặc dấu X (vắng) cho từng học sinh. Bấm **Tất cả có mặt** để đánh dấu nhanh cả ca.", shot: "diem-danh" },
      "Bấm **Lưu điểm danh**. Học phí theo buổi được tính theo điểm danh này.",
      { text: "Dùng nút mũi tên để sang ca trước / ca sau trong tháng mà không cần quay lại lịch.", shot: "diem-danh-ca-ke" },
    ],
  },
  {
    id: "hoc-phi",
    title: "Học phí",
    steps: [
      { text: "Mở **Học phí**: app mở sẵn **tháng trước** (tháng vừa học xong). Mỗi học sinh có số cần đóng, ghi rõ phần nợ tháng cũ và tiền tháng đó.", shot: "hoc-phi-danh-sach" },
      { text: "Phụ huynh đóng đủ: bấm **Đã đóng đủ** trên dòng học sinh. Lỡ tay thì bấm **Hoàn tác** trên thông báo.", shot: "hoc-phi-da-dong-du" },
      { text: "Đóng thiếu hoặc đóng nhiều tháng: bấm vào học sinh → **Đóng một phần**, nhập số tiền. Tiền tự trừ vào tháng cũ nhất trước, có dòng xem trước trừ tháng nào.", shot: "hoc-phi-dong-mot-phan" },
      "Tháng đang học (chưa học xong) chỉ **tạm tính** và **không ghi được tiền**, kể cả học sinh đóng trọn tháng. Phụ huynh đóng trước thì ghi ở tháng trước, phần dư tự trừ sang tháng sau.",
      { text: "Muốn miễn phần còn thiếu: mở học sinh ở tháng đã học xong → menu ⋮ → **Miễn phần còn thiếu**.", shot: "hoc-phi-mien" },
      { text: "Bấm **Phiếu báo** để tạo phiếu học phí có mã QR, rồi lưu ảnh hoặc chia sẻ cho phụ huynh.", shot: "hoc-phi-phieu-bao" },
      "Gửi xong, bấm **Đánh dấu đã gửi** để lọc được học sinh chưa gửi phiếu. Số tiền đổi sau khi gửi sẽ có nhãn báo; phiếu gửi từ 7 ngày mà chưa đóng có nhãn màu cam.",
      { text: "**Link phụ huynh**: phụ huynh mở link là xem được học phí, điểm danh và lịch học của con, không cần đăng nhập.", shot: "link-phu-huynh" },
    ],
    tips: ["Không chia sẻ công khai link phụ huynh."],
  },
  {
    id: "bao-cao",
    title: "Báo cáo tháng",
    steps: [
      "Mở **Báo cáo** (gói có tính năng báo cáo tháng).",
      { text: "Chọn tháng để xem doanh thu, số đã thu, còn nợ và điểm danh.", shot: "bao-cao" },
      "Học sinh đã xoá vẫn được tính trong số liệu các tháng cũ.",
    ],
  },
  {
    id: "tai-khoan-ngan-hang",
    title: "Tài khoản nhận học phí",
    steps: [
      "Mở **Cài đặt**, phần **Tài khoản nhận học phí**.",
      { text: "Gõ tên để tìm ngân hàng, nhập số tài khoản và tên chủ tài khoản.", shot: "cai-dat-ngan-hang" },
      "Tick ô đồng ý rồi bấm **Lưu**. Phiếu báo học phí sẽ có mã QR chuyển khoản đúng số tiền.",
    ],
  },
  {
    id: "goi-dich-vu",
    title: "Gói dịch vụ",
    steps: [
      { text: "Mở **Gói của tôi** để xem gói đang dùng, hạn dùng và tính năng của từng gói Standard, Plus, Pro.", shot: "goi-dich-vu" },
      "Bấm mua hoặc gia hạn, chọn thời hạn và cách thanh toán rồi bấm **Tạo đơn**. App hiện mã QR, mã đơn và số tiền.",
      "Chọn **Kích hoạt ngay sau khi chuyển khoản**: quét QR payOS, gói bật trong vài giây khi tiền vào, không phải chờ duyệt.",
      "Chọn **Chuyển khoản, chờ admin duyệt**: chuyển khoản đúng nội dung mã đơn, rồi báo chủ app (Gọi, Zalo, Facebook ngay trên thẻ đơn). Gói được kích hoạt sau khi quản trị viên xác nhận.",
    ],
    tips: ["Gia hạn sớm trước khi hết hạn được tặng thêm tháng."],
  },
  {
    id: "thung-rac",
    title: "Thùng rác",
    steps: [
      "Học sinh, môn, ca dạy, lần thu đã xoá đều vào **Thùng rác**.",
      { text: "Mở **Thùng rác**, chọn loại, bấm **Khôi phục** để lấy lại.", shot: "thung-rac" },
      "Khôi phục ca hoặc lần thu cần học sinh và môn của nó còn tồn tại.",
    ],
  },
  {
    id: "sao-luu",
    title: "Sao lưu Excel",
    steps: [
      { text: "Bấm avatar góc phải trên, chọn **Sao lưu dữ liệu**.", shot: "sao-luu-menu" },
      "Đọc cảnh báo: file sao lưu không mã hoá, chỉ lưu ở nơi an toàn.",
      { text: "Bấm **Tôi hiểu, tải xuống** để tải file Excel chứa toàn bộ dữ liệu của bạn.", shot: "sao-luu-canh-bao" },
    ],
  },
  {
    id: "bao-mat",
    title: "Bảo mật dữ liệu",
    steps: [
      "Họ tên, số điện thoại, ghi chú, số tài khoản được mã hoá trong cơ sở dữ liệu.",
      "Chỉ bạn xem được dữ liệu của mình. Quản trị viên chỉ thấy thông tin gói.",
      "Đọc đầy đủ ở trang **Chính sách bảo mật** (link ở trang đăng nhập).",
    ],
    tips: ["Chỉ nhập dữ liệu học sinh khi phụ huynh đã cho phép."],
  },
]

export const GUIDE_IDS: ReadonlySet<string> = new Set(GUIDE_SECTIONS.map((s) => s.id))

export const GUIDE_SHOTS: readonly string[] = GUIDE_SECTIONS.flatMap((s) =>
  s.steps.map(stepShot).filter((x): x is string => !!x)
)
