import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync("./package.json", "utf8"))

// Dấu vân tay của bản build, hiển thị ở sidebar để biết web đang chạy commit nào.
// Vercel set VERCEL_GIT_COMMIT_SHA lúc build; chạy local thì ghi "local".
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)
const vn = new Date(Date.now() + 7 * 60 * 60 * 1000)
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
};

export default nextConfig;
