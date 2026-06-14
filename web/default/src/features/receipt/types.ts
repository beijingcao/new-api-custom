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

export interface InvoiceRequest {
  id: number
  user_id: number
  header_id: number
  order_ids: string
  total_amount: number
  status: string
  created_at: number
}

export interface InvoiceRequestsResponse {
  success: boolean
  data: InvoiceRequest[]
  invoiced_ids: string[]
  invoiced_status: Record<string, string>
}

export interface TopupOrder {
  id: number
  user_id: number
  amount: number
  money: number
  trade_no: string
  payment_method: string
  create_time: number
  complete_time?: number
  status: string
}
