"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import vi from "@/language/vi.json"
import en from "@/language/en.json"
import dayjs from "dayjs"
import "dayjs/locale/vi"
import "dayjs/locale/en"

type Language = "vi" | "en"
type Translations = typeof vi

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: keyof Translations) => string
}

const translations: Record<Language, Translations> = { vi, en }

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({
  children,
  forcedLanguage,
}: {
  children: React.ReactNode
  // Trang công khai (link phụ huynh) cố định ngôn ngữ, không theo lựa chọn đã lưu trên máy.
  forcedLanguage?: Language
}) {
  const [language, setLanguageState] = useState<Language>(forcedLanguage ?? "vi")

  useEffect(() => {
    if (forcedLanguage) return
    const savedLang = localStorage.getItem("language") as Language
    if (savedLang && (savedLang === "vi" || savedLang === "en")) {
      setLanguageState(savedLang)
    }
  }, [forcedLanguage])

  useEffect(() => {
    // Sync dayjs locale
    dayjs.locale(language)
    // Sync html lang attribute
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (forcedLanguage) return
    localStorage.setItem("language", lang)
    // Optional: set cookie for server-side awareness if needed
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`
  }

  const t = (key: keyof Translations): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider")
  }
  return context
}
