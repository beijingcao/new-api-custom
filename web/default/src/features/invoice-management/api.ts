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
  pageSize: number
): Promise<{ success: boolean; data?: PageResult; message?: string }> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
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
