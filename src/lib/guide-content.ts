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
      "Lần đầu vào app hiện hộp **Bạn đang dạy ở đâu?**: chọn nơi bạn dạy rồi chọn gói hoặc bấm **Bắt đầu miễn phí** (xem mục **Nơi dạy**).",
      { text: "Trên **Tổng quan** có thẻ **Bắt đầu sử dụng** gồm 5 bước. Làm lần lượt, bước xong tự được đánh dấu.", shot: "tong-quan-bat-dau" },
      "Thẻ **Còn nợ** ở **Tổng quan** tách 2 dòng: **Tháng này** và **Các tháng trước**.",
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
      { text: "Mở **Học sinh**, bấm **Thêm học sinh** trên đầu trang.", shot: "hoc-sinh-danh-sach" },
      "Nhập họ tên, lớp, tên và số điện thoại phụ huynh (không bắt buộc). Có từ 2 nơi dạy trở lên thì chọn thêm **Nơi học**.",
      { text: "Chọn **Cách thu học phí**: **Theo buổi** (nhập học phí mỗi buổi) hoặc **Trọn tháng** (nhập học phí cả tháng, không phụ thuộc số buổi).", shot: "hoc-sinh-them" },
      "Tick ô đồng ý lưu dữ liệu rồi bấm **Thêm**.",
      "Học sinh nghỉ hẳn: mở học sinh, tắt **Đang học**. Học sinh vẫn còn trong lịch sử và học phí cũ.",
      "Lọc theo lớp, trạng thái, nơi học: bấm **Bộ lọc**. Mỗi lọc đang bật hiện thành 1 nhãn, bấm **Xoá lọc** để bỏ hết.",
      "Đầu năm học: bấm **⋯** cạnh ô tìm kiếm → **Nâng lớp hàng loạt** để tăng 1 lớp cho cả danh sách.",
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
      "Ở **Học sinh**, bấm mũi tên cạnh **Thêm học sinh** → **Nhập Excel**, rồi **Tải file mẫu**.",
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
      { text: "Có từ 2 nơi dạy trở lên thì form ca có thêm ô **Nơi dạy**. Thẻ ca trên lịch có chấm màu và tên nơi.", shot: "lich-day-noi-day" },
      "Muốn ca lặp hằng tuần: bấm mũi tên cạnh **Tạo ca dạy** → **Lịch lặp**, chọn **Lặp lại vào các thứ** và khoảng ngày.",
      { text: "Bấm vào ca để xem chi tiết, sửa, chuyển sang ngày giờ khác, huỷ ca (ghi lý do) hoặc tạo **Ca bù**.", shot: "lich-day-chi-tiet-ca" },
      { text: "Cuối tháng bấm mũi tên cạnh **Tạo ca dạy**, chọn **Chép lịch tháng** để chép lịch sang tháng sau.", shot: "lich-day-chep-thang" },
    ],
    tips: [
      "App báo khi ca mới trùng giờ với ca đã có.",
      "**Xuất Excel** lịch tháng nằm trong nút **⋯**. Lọc lớp, nơi dạy ở **Bộ lọc**.",
    ],
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
    id: "noi-day",
    title: "Nơi dạy",
    intro: "Bạn có thể dạy ở nhiều nơi (lớp tại nhà, gia sư, trung tâm), mỗi nơi tính tiền một kiểu.",
    steps: [
      { text: "Lúc mới đăng ký, hộp **Bạn đang dạy ở đâu?** hiện ra: chọn một hoặc nhiều nơi, trung tâm thì nhập tên. Sau đó chọn gói hoặc bấm **Bắt đầu miễn phí**.", shot: "noi-day-popup" },
      { text: "Mở **Nơi dạy** (điện thoại: **Thêm** → **Nơi dạy**). Danh sách chia 2 nhóm: tính tiền theo học sinh và tính tiền theo ca/giờ.", shot: "noi-day-danh-sach" },
      { text: "Bấm **Thêm nơi dạy**, nhập tên, chọn loại và **Cách tính tiền**: **Theo học sinh (học phí)** như hiện nay, hoặc **Theo ca/giờ, nơi này trả** (học sinh ở nơi đó không có học phí).", shot: "noi-day-form" },
      "Có từ 2 nơi trở lên: form học sinh có ô **Nơi học**, form ca có ô **Nơi dạy**, thẻ ca trên lịch có chấm màu và tên nơi.",
      "Đổi cách tính tiền của một nơi chỉ áp dụng từ tháng hiện tại. Các tháng trước giữ nguyên, nợ cũ không mất.",
    ],
    tips: [
      "Không xoá được nơi cuối cùng, hoặc nơi còn học sinh đang học hay ca sắp tới. Chuyển học sinh, ca sang nơi khác trước.",
      "Chỉ dạy ở trung tâm (theo ca/giờ): mục **Học phí** và **Báo cáo** tự ẩn, thay bằng **Bảng công**.",
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
    tips: [
      "Lọc **Trạng thái** nằm ngoài. Các lọc khác (lớp, **Nơi học** khi có nhiều nơi) nằm trong **Bộ lọc**; bấm dấu x trên nhãn để bỏ từng lọc, **Xoá lọc** để bỏ hết.",
      "Không chia sẻ công khai link phụ huynh.",
    ],
  },
  {
    id: "bao-cao",
    title: "Báo cáo tháng",
    steps: [
      "Mở **Báo cáo** (gói có tính năng báo cáo tháng).",
      { text: "Chọn tháng để xem doanh thu, số đã thu, còn nợ và điểm danh.", shot: "bao-cao" },
      "Có nhiều nơi dạy: bấm **Bộ lọc** → **Nơi học** để xem riêng một nơi. Cả màn (số tổng hợp, biểu đồ, danh sách ca) lọc theo nơi đó.",
      "Bấm **Xuất Excel** để tải báo cáo đang xem.",
      "Học sinh đã xoá vẫn được tính trong số liệu các tháng cũ.",
    ],
  },
  {
    id: "bang-cong",
    title: "Bảng công và Thu nhập",
    intro: "Dành cho nơi tính tiền theo ca/giờ: đối chiếu số ca, số giờ với trung tâm và theo dõi tiền nơi đó đã trả.",
    steps: [
      { text: "Đặt **Đơn giá**: mở **Nơi dạy**, sửa nơi dạy, chọn **Theo ca** hoặc **Theo giờ** rồi nhập số tiền. Nơi đã có ca thì chọn **Áp dụng từ tháng**. Để trống nếu chưa muốn tính thu nhập.", shot: "bang-cong-don-gia" },
      { text: "Mở **Bảng công** (điện thoại: **Thêm** → **Bảng công**), tab **Bảng công** (gói Plus): chọn nơi và tháng để xem số ca đã dạy, số giờ, ca bù, ca huỷ.", shot: "bang-cong" },
      "Bấm **⋯** → **Xuất Excel** hoặc **Tải ảnh** để gửi trung tâm. Mặc định không kèm tiền; tick **Kèm số tiền** nếu cần.",
      { text: "Tab **Thu nhập**: mỗi nơi có thu nhập dự kiến, đã nhận, còn thiếu và trạng thái **Chưa nhận**, **Nhận một phần** hoặc **Đã nhận đủ**.", shot: "thu-nhap" },
      { text: "Bấm vào một nơi để xem diễn giải. Trung tâm trả tiền thì bấm **Ghi nhận đã nhận** (gói Plus).", shot: "thu-nhap-chi-tiet" },
      { text: "**Tổng quan** có thẻ **Thu nhập tháng này** và **Giờ dạy tháng này**. Gói Pro có thêm nhóm **Nơi dạy còn thiếu tiền tháng trước** ở **Cần chú ý**.", shot: "tong-quan-thu-nhap" },
    ],
    tips: [
      "Ca đã dạy là ca không huỷ và có ngày từ hôm nay trở về trước. Ca bù vẫn tính công.",
      "Gói Pro: tab **Thu nhập** có thẻ **Thu nhập 12 tháng gần nhất**.",
    ],
  },
  {
    id: "phieu-noi-day",
    title: "Phiếu báo cho nơi dạy",
    steps: [
      { text: "Ở tab **Thu nhập**, bấm **Phiếu báo** trên dòng nơi dạy (gói Plus).", shot: "phieu-noi-day" },
      "Phiếu có các ngày đã dạy, số ca, số giờ, đơn giá, đã nhận, còn phải trả và mã QR chuyển khoản (cần **Tài khoản nhận học phí** trong **Cài đặt**).",
      "Bấm **Sao chép link gửi**, hoặc **Lưu ảnh** (máy tính: **Tải ảnh**), rồi gửi cho trung tâm. App tự đánh dấu **Đã gửi**, bấm **Hoàn tác** nếu lỡ tay.",
      { text: "Trung tâm mở link là xem được phiếu và các ca đã dạy, không có tên học sinh, không cần đăng nhập.", shot: "phieu-noi-day-nguoi-tra" },
      "Gửi nhầm link: ở **Nơi dạy**, bấm **⋯** của nơi đó → **Tạo link mới cho người trả** (link cũ hết hiệu lực ngay) hoặc **Tắt link người trả**.",
    ],
    tips: [
      "Tháng chưa có ca đã dạy, hoặc nơi chưa có đơn giá, thì chưa tạo được phiếu.",
      "Gói Pro đã nối payOS: phiếu có QR payOS, tiền vào là app tự ghi **Đã nhận** (xem mục payOS).",
    ],
  },
  {
    id: "chuyen-can",
    title: "Chuyên cần",
    steps: [
      { text: "Mở **Chuyên cần** (điện thoại: **Thêm** → **Chuyên cần**). Xem theo tháng (gói Plus): tỉ lệ đi học, số buổi có mặt, vắng, muộn; mỗi học sinh có thanh tỉ lệ.", shot: "chuyen-can-thang" },
      { text: "Bấm ô chọn kỳ → **Năm học** (gói Pro): tháng 9 đến tháng 5 năm sau, mỗi học sinh 1 dải màu theo tháng.", shot: "chuyen-can-nam-hoc" },
      "Bấm **Bộ lọc** để lọc theo nơi dạy hoặc lớp (gói Pro). Bấm **Xuất Excel** để tải bảng đang xem.",
    ],
    tips: ["Tỉ lệ đi học = (có mặt + muộn) / số buổi đã điểm danh. Ca huỷ và buổi chưa điểm danh không tính."],
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
    id: "payos-hoc-phi",
    title: "Tự đánh dấu học phí bằng payOS (gói Pro)",
    intro: "Phụ huynh quét QR payOS trên phiếu, tiền vào là app tự ghi khoản thu và đánh dấu **Đã đóng đủ**, không phải rà sao kê rồi đánh dấu tay. Dùng payOS: 100 giao dịch miễn phí trọn đời + 500 miễn phí trong 6 tháng; muốn nhiều hơn (1.000 giao dịch/năm) phải mua gói Pro của payOS ~2.000đ/giao dịch ≈ 2 triệu/năm. Không cần tự đánh dấu thì cứ dùng VietQR miễn phí trọn đời như bình thường.",
    steps: [
      "Đăng ký tài khoản tại **payos.vn** và xác thực danh tính theo hướng dẫn của payOS.",
      "Liên kết tài khoản ngân hàng nhận học phí (nên chọn ngân hàng payOS hỗ trợ liên kết).",
      "Tạo một **kênh thanh toán riêng** cho học phí.",
      "Kênh vừa tạo hiện trong danh sách kênh.",
      "Mở kênh, vào tab **Thông tin tích hợp**, chép **Client ID**, **API Key**, **Checksum Key**. Không bấm nút ↻ cạnh Checksum Key (đổi khoá làm app mất kết nối). Không cần tự điền webhook, app tự cài.",
      { text: "Trong app: **Cài đặt**, thẻ **Tự đánh dấu học phí bằng payOS**, dán 3 khoá rồi bấm **Kết nối**.", shot: "cai-payos" },
      { text: "Gửi phiếu như thường: phiếu có QR payOS đúng số đang nợ, phụ huynh quét để trả.", shot: "phieu-payos" },
      { text: "Tiền vào: tháng tự thành **Đã đóng đủ**, huy hiệu hiện **PH đã chuyển … lúc … ngày …**.", shot: "da-chuyen-payos" },
      { text: "Chuông 🔔 **Tiền vào qua payOS** trên cùng báo ngay khoản vừa vào và của học sinh nào, không cần tải lại trang; bấm một dòng để mở học sinh đó.", shot: "chuong-payos" },
      "Kết nối payOS dùng chung cho học phí và phiếu nơi dạy (gói Pro). Chuông có cả dòng tiền nơi dạy trả; bấm vào mở đúng nơi đó ở **Thu nhập**.",
    ],
    tips: ["Cần hỗ trợ cài payOS? Gọi, nhắn Zalo hoặc Facebook cho admin ở mục **Cần hỗ trợ?** cuối trang."],
  },
  {
    id: "goi-dich-vu",
    title: "Gói dịch vụ",
    steps: [
      { text: "Mở **Gói của tôi** để xem gói đang dùng, hạn dùng và tính năng của từng gói Standard, Plus, Pro.", shot: "goi-dich-vu" },
      "Bấm mua hoặc gia hạn, chọn thời hạn và cách thanh toán rồi bấm **Tạo đơn**. App hiện mã QR, mã đơn và số tiền.",
      { text: "Chọn **Kích hoạt ngay sau khi chuyển khoản**: quét QR payOS, gói bật trong vài giây khi tiền vào, không phải chờ duyệt.", shot: "goi-thanh-toan" },
      "Chọn **Chuyển khoản, chờ admin duyệt**: chuyển khoản đúng nội dung mã đơn, rồi báo chủ app (Gọi, Zalo, Facebook ngay trên thẻ đơn). Gói được kích hoạt sau khi quản trị viên xác nhận.",
    ],
    tips: [
      "Số học sinh đang học tối đa: Standard 20, Plus 50, Pro không giới hạn.",
      "Gia hạn sớm trước khi hết hạn được tặng thêm tháng.",
    ],
  },
  {
    id: "thung-rac",
    title: "Thùng rác",
    steps: [
      "Học sinh, môn, ca dạy, lần thu đã xoá đều vào **Thùng rác**.",
      { text: "Mở **Thùng rác**, chọn loại, bấm **Khôi phục** để lấy lại.", shot: "thung-rac" },
      "Khôi phục ca hoặc lần thu cần học sinh và môn của nó còn tồn tại.",
      "Muốn dọn hẳn: bấm **⋯** → dọn tab đang xem hoặc **Dọn sạch thùng rác**. Trên điện thoại, hàng tab loại vuốt ngang để xem hết.",
    ],
  },
  {
    id: "sao-luu",
    title: "Sao lưu Excel",
    steps: [
      { text: "Bấm avatar góc phải trên, chọn **Sao lưu dữ liệu**.", shot: "sao-luu-menu" },
      "Đọc cảnh báo: file sao lưu không mã hoá, chỉ lưu ở nơi an toàn.",
      { text: "Bấm **Tôi hiểu, tải xuống** để tải file Excel chứa toàn bộ dữ liệu của bạn.", shot: "sao-luu-canh-bao" },
      "File có cả sheet **Nơi dạy**, **Đơn giá** và **Tiền nơi dạy trả**.",
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
