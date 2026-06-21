import { useEffect, useRef } from 'react'
import { useSystemConfigStore } from '@/stores/system-config-store'

/**
 * Injects admin-configured `<script>` tags into document.head.
 *
 * Unlike dangerouslySetInnerHTML (which uses innerHTML and does NOT execute
 * script tags per HTML5 spec), this hook parses the HTML string, extracts
 * every <script> element, and re-creates them with document.createElement
 * so the browser actually runs them.
 */
export function useHeadScript() {
  const headScript = useSystemConfigStore((s) => s.config.headScript)
  const injectedRef = useRef<HTMLElement[]>([])

  useEffect(() => {
    injectedRef.current.forEach((el) => el.remove())
    injectedRef.current = []

    if (!headScript?.trim()) return

    const container = document.createElement('div')
    container.innerHTML = headScript

    const scripts = container.querySelectorAll('script')
    scripts.forEach((original) => {
      const script = document.createElement('script')
      Array.from(original.attributes).forEach((attr) => {
        script.setAttribute(attr.name, attr.value)
      })
      if (original.textContent) {
        script.textContent = original.textContent
      }
      document.head.appendChild(script)
      injectedRef.current.push(script)
    })

    return () => {
      injectedRef.current.forEach((el) => el.remove())
      injectedRef.current = []
    }
  }, [headScript])
}
