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
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Markdown } from '@/components/ui/markdown'
import { PublicLayout } from '@/components/layout'
import { useHomePageContent } from './hooks'

// The built-in marketing landing page is lazy-loaded: its Hero pulls the
// large @lobehub/icons bundle, which must not weigh down the home route
// when a custom HomePageContent is configured (then it never renders).
const DefaultHome = lazy(() => import('./components/default-home'))

// Operator-authored home content can be a full HTML document whose styling
// lives in inline <style>/<link> elements. That content must render as raw
// HTML — exactly like the About/Download/Legal pages do — because routing it
// through <Markdown> runs it through DOMPurify, which strips <style>/<link>
// and leaves the page unstyled. Plain Markdown content still uses <Markdown>.
function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

export function Home() {
  const { t } = useTranslation()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isLoaded, isUrl } = useHomePageContent()
  const isHtml = !isUrl && isLikelyHtml(content)

  if (!isLoaded) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='flex min-h-screen items-center justify-center'>
          <div className='text-muted-foreground'>{t('Loading...')}</div>
        </main>
      </PublicLayout>
    )
  }

  if (content) {
    return (
      <PublicLayout showMainContainer={false}>
        <main className='overflow-x-hidden'>
          {isUrl ? (
            <iframe
              src={content}
              className='h-screen w-full border-none'
              title={t('Custom Home Page')}
            />
          ) : (
            <div className='container mx-auto py-8'>
              {isHtml ? (
                <div
                  className='prose prose-neutral dark:prose-invert max-w-none custom-home-content'
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <Markdown className='custom-home-content'>{content}</Markdown>
              )}
            </div>
          )}
        </main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <Suspense
        fallback={
          <main className='flex min-h-screen items-center justify-center'>
            <div className='text-muted-foreground'>{t('Loading...')}</div>
          </main>
        }
      >
        <DefaultHome isAuthenticated={isAuthenticated} />
      </Suspense>
    </PublicLayout>
  )
}
