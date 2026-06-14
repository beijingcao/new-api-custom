/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhRaw from './locales/zh.json'
import enRaw from './locales/en.json'

/**
 * Normalize a locale module into the flat key→value map that i18next expects
 * under a namespace.
 *
 * i18next v26 strictly requires `resources[lng][namespace]`, so a translation
 * map must live *under* the `translation` namespace, never be the namespace
 * map itself. Our locale JSON files are unfortunately not uniform:
 *   - en.json / zh.json are flat: `{ "Key": "Value" }`
 *   - fr/ja/ru/vi.json are wrapped: `{ "translation": { "Key": "Value" } }`
 * This helper accepts either shape and always returns the inner flat map, so
 * callers can wrap it consistently. (A flat file with a literal "translation"
 * string value is left untouched because we only unwrap object values.)
 */
function toTranslationBundle(
  data: Record<string, unknown>
): Record<string, string> {
  const inner = data?.translation
  if (inner && typeof inner === 'object') {
    return inner as Record<string, string>
  }
  return data as Record<string, string>
}

const zh = toTranslationBundle(zhRaw as Record<string, unknown>)
const en = toTranslationBundle(enRaw as Record<string, unknown>)

const localeLoaders: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  fr: () => import('./locales/fr.json'),
  ja: () => import('./locales/ja.json'),
  ru: () => import('./locales/ru.json'),
  vi: () => import('./locales/vi.json'),
}

export async function loadLocale(lng: string): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translation')) return
  const loader = localeLoaders[lng]
  if (!loader) return
  const mod = await loader()
  i18n.addResourceBundle(
    lng,
    'translation',
    toTranslationBundle(mod.default),
    true,
    true
  )
}

function getCachedSiteLanguage(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const s = JSON.parse(raw)
      if (s.site_language === 'en') return 'en'
    }
  } catch { /* empty */ }
  return 'zh'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: getCachedSiteLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh', 'fr', 'ru', 'ja', 'vi'],
    load: 'languageOnly',
    nsSeparator: false,
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
