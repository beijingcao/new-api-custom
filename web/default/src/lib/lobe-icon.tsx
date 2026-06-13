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
/**
 * LobeHub Icon Loader
 * Dynamically load and render icons from @lobehub/icons
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 */
import { useState, useEffect } from 'react'

let cachedModule: Record<string, unknown> | null = null
let loadPromise: Promise<Record<string, unknown>> | null = null

function ensureLoaded(): Promise<Record<string, unknown>> {
  if (cachedModule) return Promise.resolve(cachedModule)
  if (!loadPromise) {
    loadPromise = import('@lobehub/icons').then((mod) => {
      cachedModule = mod as unknown as Record<string, unknown>
      return cachedModule
    })
  }
  return loadPromise
}

// Start loading immediately when this module is first imported
ensureLoaded()

function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  if (v === 'true') return true
  if (v === 'false') return false

  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  return v
}

function Placeholder({ name, size }: { name?: string; size: number }) {
  const letter = name ? name.charAt(0).toUpperCase() : '?'
  return (
    <div
      className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
      style={{ width: size, height: size }}
    >
      {letter}
    </div>
  )
}

function resolveIcon(
  icons: Record<string, unknown>,
  iconName: string,
  size: number
): React.ReactNode {
  const segments = iconName.split('.')
  const baseKey = segments[0]
  const BaseIcon = icons[baseKey] as Record<string, unknown> | undefined

  let IconComponent: React.ComponentType<Record<string, unknown>> | undefined
  let propStartIndex: number

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]] as React.ComponentType<
      Record<string, unknown>
    >
    propStartIndex = 2
  } else {
    IconComponent = icons[baseKey] as
      | React.ComponentType<Record<string, unknown>>
      | undefined
    propStartIndex = segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1
  }

  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    return <Placeholder name={iconName} size={size} />
  }

  const props: Record<string, string | number | boolean> = {}
  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue
    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }
    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  if (props.size == null && size != null) {
    props.size = size
  }

  return <IconComponent {...props} />
}

function LazyLobeIcon({
  iconName,
  size,
}: {
  iconName: string
  size: number
}) {
  const [icons, setIcons] = useState(cachedModule)

  useEffect(() => {
    if (!cachedModule) {
      ensureLoaded().then(setIcons)
    }
  }, [])

  if (!icons) {
    return <Placeholder name={iconName} size={size} />
  }

  return <>{resolveIcon(icons, iconName, size)}</>
}

export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20
): React.ReactNode {
  if (!iconName || typeof iconName !== 'string' || !iconName.trim()) {
    return <Placeholder size={size} />
  }
  return <LazyLobeIcon iconName={iconName.trim()} size={size} />
}
