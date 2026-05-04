import dayjs from "dayjs"
import "dayjs/locale/vi"
import localizedFormat from "dayjs/plugin/localizedFormat"

dayjs.locale("vi")
dayjs.extend(localizedFormat)

export default dayjs
