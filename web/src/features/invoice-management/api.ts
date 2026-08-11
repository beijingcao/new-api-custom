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
import { api } from '@/lib/api'

export interface InvoiceHeader {
  id: number
  user_id: number
  company_name: string
  tax_number: string
  bank_name: string
  bank_account: string
  email: string
  created_at: number
}

export interface InvoiceRequestDetail {
  id: number
  user_id: number
  header_id: number
  order_ids: string
  total_amount: number
  status: string
  note: string
  created_at: number
  username: string
  header: InvoiceHeader | null
}

interface PageResult {
  items: InvoiceRequestDetail[]
  total: number
  page: number
  page_size: number
}

export async function getAdminInvoiceRequests(
  page: number,
  pageSize: number,
  keyword?: string,
  status?: string
): Promise<{ success: boolean; data?: PageResult; message?: string }> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) params.set('keyword', keyword)
  if (status) params.set('status', status)
  const res = await api.get(`/api/invoice/admin/requests?${params.toString()}`)
  return res.data
}

export async function updateInvoiceRequest(
  id: number,
  status: string,
  note: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put(`/api/invoice/admin/request/${id}`, {
    status,
    note,
  })
  return res.data
}
