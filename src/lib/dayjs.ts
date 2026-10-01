import dayjs from "dayjs"
import "dayjs/locale/vi"
import localizedFormat from "dayjs/plugin/localizedFormat"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.locale("vi")
dayjs.extend(localizedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export default dayjs
