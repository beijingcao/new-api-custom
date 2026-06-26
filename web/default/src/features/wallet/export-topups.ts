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
import { downloadCsv } from '@/lib/csv'
import { getAllBillingHistory, isApiSuccess } from './api'
import { getPaymentMethodName, getStatusConfig, formatTimestamp } from './lib/billing'
import type { TopupRecord } from './types'

const EXPORT_PAGE_SIZE = 100

/**
 * Fetch every topup order matching the current admin search keyword, across all
 * pages — a fresh real-time snapshot rather than just the visible page.
 */
async function fetchAllTopupOrders(
  keyword: string,
  status: string
): Promise<TopupRecord[]> {
  const all: TopupRecord[] = []
  let page = 1
  for (;;) {
    const res = await getAllBillingHistory(
      page,
      EXPORT_PAGE_SIZE,
      keyword || undefined,
      status || undefined
    )
    const data = res?.data
    if (!isApiSuccess(res) || !data || !data.items || data.items.length === 0) {
      break
    }
    all.push(...data.items)
    if (all.length >= (data.total || 0)) break
    page += 1
    if (page > 10000) break // hard safety stop against an unbounded loop
  }
  return all
}

/**
 * Fetch all topup orders matching the current search and download them as a
 * detailed CSV. Returns the number of exported rows (0 => nothing to export).
 */
export async function exportTopupOrdersCsv(
  t: (key: string) => string,
  keyword = '',
  status = ''
): Promise<number> {
  const orders = await fetchAllTopupOrders(keyword, status)
  if (orders.length === 0) return 0

  const headers = [
    t('Order Number'),
    t('User ID'),
    t('Username'),
    t('Payment Method'),
    t('Amount'),
    t('Payment'),
    t('Status'),
    t('Created At'),
    t('Complete Time'),
  ]

  const rows = orders.map((o) => [
    o.trade_no,
    o.user_id,
    o.username ?? '',
    getPaymentMethodName(o.payment_method, t),
    o.amount,
    o.money,
    t(getStatusConfig(o.status).label),
    o.create_time ? formatTimestamp(o.create_time) : '',
    o.complete_time ? formatTimestamp(o.complete_time) : '',
  ])

  downloadCsv(`topup_orders_${Date.now()}.csv`, headers, rows)
  return orders.length
}
