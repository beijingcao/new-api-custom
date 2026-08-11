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
      for (const attr of original.attributes) {
        script.setAttribute(attr.name, attr.value)
      }
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
