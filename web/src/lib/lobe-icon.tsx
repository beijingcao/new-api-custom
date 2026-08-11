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
 *
 * Loading strategy: each provider lives in its own directory
 * (`@lobehub/icons/es/<Provider>`) and is imported on demand via the
 * `@lobe-icons` resolve alias (see rsbuild.config.ts). The alias turns the
 * npm package path into a filesystem path so rspack can context-scan the
 * directory. We deliberately avoid `import('@lobehub/icons')` (the whole
 * namespace), which pulls every provider logo (~900 kB) into a single chunk.
 * Per-provider imports mean a page downloads just the icons it renders.
 */
import { useState, useEffect } from 'react'
import type React from 'react'

import { IconSub2api } from '@/assets/custom/icon-sub2api'

const CUSTOM_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Sub2API: IconSub2api,
}

// baseKey -> provider default export (or null when the name is unknown/invalid).
const providerCache = new Map<string, unknown>()
// baseKey -> in-flight import promise (dedupes concurrent loads of the same provider).
const providerPromises = new Map<string, Promise<unknown>>()

function loadProvider(baseKey: string): Promise<unknown> {
  if (providerCache.has(baseKey)) {
    return Promise.resolve(providerCache.get(baseKey))
  }
  let promise = providerPromises.get(baseKey)
  if (!promise) {
    promise = import(
      /* webpackChunkName: "lobe-[request]" */
      /* webpackExclude: /\/(components|features|hooks|types)\// */
      `@lobe-icons/${baseKey}/index.js`
    )
      .then((mod: { default?: unknown }) => {
        const def = mod?.default ?? null
        providerCache.set(baseKey, def)
        return def
      })
      .catch(() => {
        // Unknown provider name (e.g. a custom vendor icon that has no logo) —
        // cache the miss so we render the placeholder without retrying.
        providerCache.set(baseKey, null)
        return null
      })
    providerPromises.set(baseKey, promise)
  }
  return promise
}

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

/**
 * Render an icon from an already-loaded provider module. `baseIcon` is the
 * provider's default export — the exact object the previous implementation read
 * as `icons[baseKey]`, so name resolution (variants, chained props) is unchanged.
 */
function resolveIcon(
  baseIcon: Record<string, unknown> | undefined,
  iconName: string,
  size: number
): React.ReactNode {
  const segments = iconName.split('.')

  let IconComponent: React.ComponentType<Record<string, unknown>> | undefined
  let propStartIndex: number

  if (baseIcon && segments.length > 1 && baseIcon[segments[1]]) {
    IconComponent = baseIcon[segments[1]] as React.ComponentType<
      Record<string, unknown>
    >
    propStartIndex = 2
  } else {
    IconComponent = baseIcon as
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

function LazyLobeIcon({ iconName, size }: { iconName: string; size: number }) {
  const baseKey = iconName.split('.')[0]
  const CustomIcon = CUSTOM_ICONS[baseKey]
  const [baseIcon, setBaseIcon] = useState<unknown>(() =>
    providerCache.has(baseKey) ? providerCache.get(baseKey) : undefined
  )

  useEffect(() => {
    if (CustomIcon) return
    if (providerCache.has(baseKey)) {
      setBaseIcon(providerCache.get(baseKey))
      return
    }
    // New provider not yet loaded — show the placeholder while it streams in.
    setBaseIcon(undefined)
    let alive = true
    loadProvider(baseKey).then((def) => {
      if (alive) setBaseIcon(def)
    })
    return () => {
      alive = false
    }
  }, [baseKey, CustomIcon])

  if (CustomIcon) {
    return <CustomIcon size={size} />
  }

  if (!baseIcon) {
    return <Placeholder name={iconName} size={size} />
  }

  return <>{resolveIcon(baseIcon as Record<string, unknown>, iconName, size)}</>
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
