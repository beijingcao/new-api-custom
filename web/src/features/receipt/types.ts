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
