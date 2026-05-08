# 11 — Multi-language Support (IMPLEMENTED)

## Overview
The application supports multi-language functionality using a custom `LanguageProvider` and a `useTranslation` hook. Currently, it supports Vietnamese (default) and English.

## Translation Files
Translations are stored as JSON files in `src/language/`:
- `vi.json`: Vietnamese translations.
- `en.json`: English translations.

Both files must share the same keys to ensure consistency.

## Implementation Details

### LanguageProvider (`src/components/providers/LanguageProvider.tsx`)
- Manages the current language state (`vi` or `en`).
- Persists the selected language in `localStorage`.
- Sets a `NEXT_LOCALE` cookie for potential server-side use.
- Provides a `t(key)` function to retrieve translated strings.

### useTranslation Hook
Used in client components to access the translation function and current language state.

```typescript
import { useTranslation } from "@/components/providers/LanguageProvider"

const { t, language, setLanguage } = useTranslation()

return (
  <div>
    <h1>{t("dashboard")}</h1>
    <button onClick={() => setLanguage("en")}>Switch to English</button>
  </div>
)
```

## How to Add New Translations
1. Open `src/language/vi.json` and add a new key-value pair.
2. Open `src/language/en.json` and add the same key with the English translation.
3. Use the key with the `t()` function in your components.

## Planned Flow (Phase 11)
1. **Identify static text**: Locate all hardcoded Vietnamese text in components.
2. **Extract to JSON**: Move the text to `vi.json` and `en.json` with appropriate keys.
3. **Replace with `t()`**: Use the `useTranslation` hook to replace hardcoded text.
4. **Language Switcher**: Add a language toggle in the `AppHeader` or `AppSidebar`.
5. **Testing**: Verify that all translated text renders correctly in both languages.
