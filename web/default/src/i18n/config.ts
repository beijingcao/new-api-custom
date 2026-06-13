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
import zh from './locales/zh.json'
import en from './locales/en.json'

const localeLoaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
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
  i18n.addResourceBundle(lng, 'translation', mod.default, true, true)
}

i18n
  .use(initReactI18next)
  .init({
    resources: { zh, en },
    lng: 'zh',
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
