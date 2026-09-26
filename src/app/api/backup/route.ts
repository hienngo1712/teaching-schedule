import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { backupFileName, buildBackupWorkbook } from "@/server/services/backup.service"

export const dynamic = "force-dynamic"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// tRPC không trả được nhị phân nên dùng route riêng. Tự kiểm auth, không dựa vào middleware.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response(null, { status: 401 })

  try {
    const userId = Number(session.user.id)
    const now = new Date()
    const wb = await buildBackupWorkbook(db, userId, now)
    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${backupFileName(now)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[backup] Không tạo được file sao lưu", error)
    return new Response(null, { status: 500 })
  }
}
