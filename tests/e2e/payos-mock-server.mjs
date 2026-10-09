// Giả api-merchant.payos.vn cho e2e: tạo link luôn thành công, huỷ link luôn OK.
import { createServer } from "node:http"
createServer((req, res) => {
  let raw = ""
  req.on("data", (c) => (raw += c))
  req.on("end", () => {
    res.setHeader("content-type", "application/json")
    if (req.url === "/v2/payment-requests") {
      const b = JSON.parse(raw || "{}")
      return res.end(JSON.stringify({ code: "00", data: { paymentLinkId: `pl-${b.orderCode}`, qrCode: `00020101021238570010A000000727PAYOS${b.orderCode}`, checkoutUrl: `https://pay.payos.vn/web/pl-${b.orderCode}`, bin: "970422", accountNumber: "0001234567", accountName: "GIAO VIEN TEST" } }))
    }
    if (req.url?.endsWith("/cancel")) return res.end(JSON.stringify({ code: "00", data: {} }))
    if (req.url === "/confirm-webhook") return res.end(JSON.stringify({ code: "00", data: {} }))
    if (req.url === "/health") return res.end("{}")
    res.statusCode = 404
    res.end("{}")
  })
}).listen(4010, "127.0.0.1")
