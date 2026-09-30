import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync("./package.json", "utf8"))

// Dấu vân tay của bản build, hiển thị ở sidebar để biết web đang chạy commit nào.
// Vercel set VERCEL_GIT_COMMIT_SHA lúc build; chạy local thì ghi "local".
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)
// next build nạp file này lại trong từng worker (server/client): tính giờ riêng mỗi nơi sẽ lệch → React #418 ở sidebar.
// Chốt 1 mốc ở tiến trình chính, worker con thừa hưởng qua env.
process.env.APP_BUILD_TIMESTAMP ||= String(Date.now())
const vn = new Date(Number(process.env.APP_BUILD_TIMESTAMP) + 7 * 60 * 60 * 1000)
const pad = (n) => String(n).padStart(2, "0")
const buildTime = `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}`

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_SHA: sha,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  // Trang phụ huynh: chặn máy tìm kiếm và không để token rò qua header Referer.
  async headers() {
    return [
      // Toàn trang (spec O Q16). CSP chỉ gồm chỉ thị không chặn script inline của Next.
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
      {
        source: "/p/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ]
  },
};

export default nextConfig;
