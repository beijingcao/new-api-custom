import { useEffect } from 'react'
import { useStatus } from './use-status'

export function useUmamiAnalytics() {
  const { status } = useStatus()

  const scriptUrl = (status?.umami_script_url as string) || ''
  const websiteId = (status?.umami_website_id as string) || ''

  useEffect(() => {
    const trimmedUrl = scriptUrl.trim()
    const trimmedId = websiteId.trim()

    if (!trimmedUrl || !trimmedId) return

    const existing = document.querySelector(
      'script[data-umami-dynamic]'
    ) as HTMLScriptElement | null
    if (existing) {
      if (
        existing.src === trimmedUrl &&
        existing.getAttribute('data-website-id') === trimmedId
      ) {
        return
      }
      existing.remove()
    }

    const script = document.createElement('script')
    script.defer = true
    script.src = trimmedUrl
    script.setAttribute('data-website-id', trimmedId)
    script.setAttribute('data-umami-dynamic', 'true')
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [scriptUrl, websiteId])
}
