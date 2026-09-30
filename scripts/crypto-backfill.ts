// Mã hoá dữ liệu cá nhân cũ (spec O 6.11). Mặc định dry-run; ghi cần CONFIRM_HOST khớp host DB.
//   DATABASE_URL=... DATA_ENCRYPTION_KEYS=... DATA_ENCRYPTION_ACTIVE_KID=... \
//   [CONFIRM_HOST=<host>] pnpm exec tsx scripts/crypto-backfill.ts [--dry-run|--apply|--verify|--decrypt|--rotate] [--batch 200]
import { PrismaClient } from "@prisma/client"
import { runBackfill, type BackfillMode } from "../src/server/crypto/backfill"
import { loadKeyring } from "../src/server/crypto/field-crypto"

const MODES: BackfillMode[] = ["dry-run", "apply", "verify", "decrypt", "rotate"]
const WRITE_MODES: BackfillMode[] = ["apply", "decrypt", "rotate"]

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const modes = MODES.filter((m) => args.includes(`--${m}`))
  if (modes.length > 1) {
    console.error("Chỉ chọn 1 chế độ")
    return 1
  }
  const mode = modes[0] ?? "dry-run"
  const bi = args.indexOf("--batch")
  const batchSize = bi >= 0 ? Number(args[bi + 1]) : 200
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    console.error("--batch phải là số nguyên dương")
    return 1
  }

  // Kiểm TRƯỚC khi tạo PrismaClient: thiếu biến thì Prisma sẽ tự nạp .env (= production).
  for (const name of ["DATABASE_URL", "DATA_ENCRYPTION_KEYS", "DATA_ENCRYPTION_ACTIVE_KID"]) {
    if (!process.env[name]) {
      console.error(`Thiếu biến môi trường ${name} (truyền trực tiếp trong lệnh, không đọc từ file)`)
      return 1
    }
  }
  const url = process.env.DATABASE_URL!
  const host = url.match(/@([^/?]+)/)?.[1] ?? "?"
  const ring = loadKeyring()
  console.log(`Chế độ: ${mode} | DB host: ${host} | kid active: ${ring.active} | kid có khoá: ${[...ring.keys.keys()].join(",")}`)
  if (WRITE_MODES.includes(mode) && process.env.CONFIRM_HOST !== host) {
    console.error(`Chế độ ${mode} ghi dữ liệu: cần CONFIRM_HOST=${host}`)
    return 1
  }

  const raw = new PrismaClient({ datasources: { db: { url } } })
  try {
    const reports = await runBackfill(raw, mode, { batchSize, log: (l) => console.log(l) })
    console.table(
      reports.map((r) => ({
        cot: `${r.table}.${r.column}`,
        total: r.total,
        empty: r.empty,
        plain: r.plain,
        encrypted: Object.entries(r.encrypted).map(([k, n]) => `${k}:${n}`).join(" ") || "0",
        undecryptable: r.undecryptable,
        changed: r.changed,
      }))
    )
    for (const r of reports) console.log(`checksum ${r.table}.${r.column} ${r.checksum}`)
    const dirty = reports.some((r) => r.undecryptable > 0 || (mode === "verify" && r.plain > 0))
    return dirty ? 2 : 0
  } finally {
    await raw.$disconnect()
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // Chỉ in tên lỗi + message (không chứa giá trị dữ liệu/khoá theo thiết kế field-crypto).
    console.error(`Lỗi: ${err instanceof Error ? `${err.name}: ${err.message}` : "không rõ"}`)
    process.exit(1)
  }
)
