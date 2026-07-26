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
import { formatQuota, formatTimestamp } from '@/lib/format'

import { getUsers } from './api'
import {
  USER_ROLES,
  USER_STATUS,
  USER_STATUSES,
  isUserDeleted,
} from './constants'
import { downloadCsv } from './export-csv'
import { getUserSourceText } from './source'
import type { User } from './types'

const EXPORT_PAGE_SIZE = 100

/** Fetch every user across all pages — a fresh real-time snapshot. */
async function fetchAllUsers(): Promise<User[]> {
  const all: User[] = []
  let page = 1
  for (;;) {
    const res = await getUsers({ p: page, page_size: EXPORT_PAGE_SIZE })
    const data = res?.data
    if (!res?.success || !data || data.items.length === 0) break
    all.push(...data.items)
    if (all.length >= data.total) break
    page += 1
    if (page > 10000) break // hard safety stop against an unbounded loop
  }
  return all
}

function roleLabel(user: User, t: (key: string) => string): string {
  const config = USER_ROLES[user.role as keyof typeof USER_ROLES]
  return config ? t(config.labelKey) : String(user.role)
}

function statusLabel(user: User, t: (key: string) => string): string {
  const config = isUserDeleted(user)
    ? USER_STATUSES[USER_STATUS.DELETED]
    : USER_STATUSES[user.status as keyof typeof USER_STATUSES]
  return config ? t(config.labelKey) : String(user.status)
}

/**
 * Fetch all users and download them as a detailed CSV.
 * Returns the number of exported rows (0 => nothing to export).
 */
export async function exportUsersCsv(
  t: (key: string) => string
): Promise<number> {
  const users = await fetchAllUsers()
  if (users.length === 0) return 0

  const headers = [
    t('ID'),
    t('Username'),
    t('Display Name'),
    t('Source'),
    t('Email'),
    t('Group'),
    t('Role'),
    t('Status'),
    t('Remaining Quota'),
    t('Used Quota'),
    t('Requests'),
    t('Created At'),
    t('Last Login'),
    t('Remark'),
  ]

  const rows = users.map((user) => [
    user.id,
    user.username,
    user.display_name,
    getUserSourceText(user, t),
    user.email ?? '',
    user.group,
    roleLabel(user, t),
    statusLabel(user, t),
    formatQuota(user.quota),
    formatQuota(user.used_quota),
    user.request_count,
    user.created_at ? formatTimestamp(user.created_at) : '',
    user.last_login_at ? formatTimestamp(user.last_login_at) : '',
    user.remark ?? '',
  ])

  downloadCsv(`users_${Date.now()}.csv`, headers, rows)
  return users.length
}
