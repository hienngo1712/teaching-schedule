// Luật phiên dùng chung cho middleware Edge và auth() Node: chỉ TS thuần, không import gì.
export const REMEMBER_MAX_AGE_S = 30 * 24 * 60 * 60
export const SHORT_IDLE_S = 8 * 60 * 60

// "0.3.1" → "0.3": chỉ nâng minor/major mới ép đăng nhập lại (spec N N2).
export function epochOf(version: string): string {
  const m = /^(\d+)\.(\d+)/.exec(version)
  return m ? `${m[1]}.${m[2]}` : version
}

// Phải viết nguyên `process.env.NEXT_PUBLIC_APP_VERSION` để Next inline lúc build (kể cả bundle Edge);
// đọc trong thân hàm để unit test đổi env được.
export function currentEpoch(): string {
  return epochOf(process.env.NEXT_PUBLIC_APP_VERSION || "0.0")
}

// Phiên không ghi nhớ hết khi quá 8h kể từ lần ký lại gần nhất (thư viện ký lại token mỗi request qua middleware).
export function isSessionExpired(p: { remember: boolean; iat: number | undefined; nowS: number }): boolean {
  if (p.remember || p.iat === undefined) return false
  return p.nowS - p.iat > SHORT_IDLE_S
}
