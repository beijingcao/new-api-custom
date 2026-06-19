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
import type { User } from './types'

/**
 * Registration / login source of a user.
 *
 * Priority follows the user request: if an email is present it is treated as
 * the source and shown verbatim; otherwise the first linked third-party
 * provider (in this order) is used as the source label.
 */
export const SOURCE_PROVIDERS: ReadonlyArray<{
  field: keyof User
  labelKey: string
}> = [
  { field: 'github_id', labelKey: 'GitHub' },
  { field: 'linux_do_id', labelKey: 'LinuxDO' },
  { field: 'wechat_id', labelKey: 'WeChat' },
  { field: 'telegram_id', labelKey: 'Telegram' },
  { field: 'discord_id', labelKey: 'Discord' },
  { field: 'oidc_id', labelKey: 'OIDC' },
]

export type UserSource =
  | { type: 'email'; value: string }
  | { type: 'provider'; labelKey: string }
  | { type: 'none' }

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** Derive how a user registered/signed in from the available identity fields. */
export function getUserSource(user: User): UserSource {
  if (nonEmpty(user.email)) {
    return { type: 'email', value: user.email.trim() }
  }
  for (const provider of SOURCE_PROVIDERS) {
    if (nonEmpty((user as Record<string, unknown>)[provider.field as string])) {
      return { type: 'provider', labelKey: provider.labelKey }
    }
  }
  return { type: 'none' }
}

/** Plain-text source, used for column sorting/search and CSV export. */
export function getUserSourceText(
  user: User,
  t: (key: string) => string
): string {
  const source = getUserSource(user)
  if (source.type === 'email') return source.value
  if (source.type === 'provider') return t(source.labelKey)
  return ''
}
