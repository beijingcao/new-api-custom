import { api } from '@/lib/api'

import type {
  InvoiceHeader,
  InvoiceRequest,
  InvoiceRequestsResponse,
} from './types'

export async function getInvoiceHeaders(): Promise<{
  success: boolean
  data: InvoiceHeader[]
}> {
  const res = await api.get('/api/user/invoice/headers')
  return res.data
}

export async function createInvoiceHeader(
  header: Omit<InvoiceHeader, 'id' | 'user_id' | 'created_at'>
): Promise<{ success: boolean; data: InvoiceHeader; message?: string }> {
  const res = await api.post('/api/user/invoice/header', header)
  return res.data
}

export async function deleteInvoiceHeader(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/user/invoice/header/${id}`)
  return res.data
}

export async function getInvoiceRequests(): Promise<InvoiceRequestsResponse> {
  const res = await api.get('/api/user/invoice/requests')
  return res.data
}

export async function submitInvoiceRequest(
  headerId: number,
  orderIds: string[]
): Promise<{ success: boolean; data: InvoiceRequest; message?: string }> {
  const res = await api.post('/api/user/invoice/request', {
    header_id: headerId,
    order_ids: orderIds,
  })
  return res.data
}
