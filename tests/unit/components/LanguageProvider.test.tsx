/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { LanguageProvider, useTranslation } from "@/components/providers/LanguageProvider"

function Probe() {
  const { t, language, setLanguage } = useTranslation()
  return (
    <div>
      <p>{`${language}:${t("cancel")}`}</p>
      <button onClick={() => setLanguage("en")}>switch</button>
    </div>
  )
}

describe("LanguageProvider", () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it("forcedLanguage='vi' → vẫn tiếng Việt dù localStorage.language = 'en'", async () => {
    localStorage.setItem("language", "en")
    render(
      <LanguageProvider forcedLanguage="vi">
        <Probe />
      </LanguageProvider>
    )
    await act(async () => {})
    expect(screen.getByText("vi:Hủy")).toBeTruthy()
  })

  it("forcedLanguage: setLanguage không ghi localStorage", async () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <Probe />
      </LanguageProvider>
    )
    await act(async () => {
      screen.getByText("switch").click()
    })
    expect(localStorage.getItem("language")).toBeNull()
  })

  it("không có forcedLanguage → giữ hành vi cũ, đọc localStorage", async () => {
    localStorage.setItem("language", "en")
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    )
    expect(await screen.findByText("en:Cancel")).toBeTruthy()
  })
})
